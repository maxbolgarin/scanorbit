import { eq } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { jwt } from '../../lib/jwt.js';
import { HTTP400Error } from '../../lib/errors.js';
import { users } from '../../db/schema.js';
import { emailService } from '../emailService.js';
import { signupCodes, refreshTokenStore } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import { generateVerificationCode, secureCompare, VERIFICATION_CODE_EXPIRY_HOURS } from './helpers.js';

async function verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
  // Get user by email
  const [user] = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      emailVerificationCode: users.emailVerificationCode,
      emailVerificationExpiresAt: users.emailVerificationExpiresAt,
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new HTTP400Error('User not found');
  }

  if (user.emailVerified) {
    return { success: true, message: 'Email already verified' };
  }

  if (!user.emailVerificationCode || !user.emailVerificationExpiresAt) {
    throw new HTTP400Error('No verification code found. Please request a new one.');
  }

  if (new Date() > user.emailVerificationExpiresAt) {
    throw new HTTP400Error('Verification code expired. Please request a new one.');
  }

  // Use constant-time comparison to prevent timing attacks
  if (!secureCompare(user.emailVerificationCode, code)) {
    throw new HTTP400Error('Invalid verification code');
  }

  // Mark email as verified and clear verification code
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Invalidate existing sessions so user re-authenticates with verified status
  await refreshTokenStore.revokeAllForUser(user.id);

  return { success: true, message: 'Email verified successfully' };
}

async function resendVerificationCode(email: string): Promise<{ message: string }> {
  // Get user by email
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    // Don't reveal if user exists
    return { message: 'If an account exists with this email, a verification code will be sent.' };
  }

  if (user.emailVerified) {
    // Return same generic message to prevent account enumeration
    return { message: 'If an account exists with this email, a verification code will be sent.' };
  }

  // Generate new verification code
  const verificationCode = generateVerificationCode();
  const verificationExpiresAt = new Date(
    Date.now() + VERIFICATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000
  );

  // Update user with new verification code
  await db
    .update(users)
    .set({
      emailVerificationCode: verificationCode,
      emailVerificationExpiresAt: verificationExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Send verification email
  await emailService.sendVerificationEmail(email, verificationCode, user.fullName ?? undefined);

  return { message: 'If an account exists with this email, a verification code will be sent.' };
}

/**
 * Send verification code to email (Step 1)
 */
async function sendVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase();

  // Check if email already registered
  const existing = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].emailVerified) {
      // Email exists and is verified - user should login instead
      logger.warn('Attempted to send verification code to verified email', {
        email: normalizedEmail,
        reason: 'email_already_verified',
      });
      throw new HTTP400Error('An account with this email already exists. Please sign in instead.');
    }
    // Email exists but isn't verified - allow them to proceed (completing signup)
    logger.info('Sending verification code to unverified existing email', {
      email: normalizedEmail,
      reason: 'completing_signup',
    });
  }

  // Check resend cooldown
  const cooldown = await signupCodes.checkResendCooldown(normalizedEmail);
  if (!cooldown.allowed) {
    throw new HTTP400Error(`Please wait ${cooldown.waitSeconds} seconds before requesting a new code.`);
  }

  // Generate and store code
  const code = generateVerificationCode();
  await signupCodes.setCode(normalizedEmail, code);
  await signupCodes.setResendCooldown(normalizedEmail);

  // Send email
  const emailResult = await emailService.sendVerificationEmail(normalizedEmail, code);
  if (!emailResult.success) {
    // If email sending fails, clean up the stored code and throw error
    await signupCodes.deleteCode(normalizedEmail);
    const errorMessage = emailResult.error || 'Unknown error';
    logger.error('Failed to send verification email', undefined, {
      email: normalizedEmail,
      error: errorMessage,
      reason: 'email_send_failed',
    });
    throw new HTTP400Error('Unable to send verification code. Please try again or contact support.');
  }

  return { success: true, message: 'Verification code sent to your email.' };
}

/**
 * Verify the code and return signup token (Step 2)
 */
async function verifySignupCode(
  email: string,
  code: string
): Promise<{ success: boolean; signupToken: string }> {
  const normalizedEmail = email.toLowerCase();

  // Get stored code first — expired codes should not burn attempts
  const storedCode = await signupCodes.getCode(normalizedEmail);
  if (!storedCode) {
    throw new HTTP400Error('Verification code expired. Please request a new one.');
  }

  // Atomic rate limit check + increment (prevents TOCTOU race)
  const attempts = await signupCodes.checkAndIncrementAttempts(normalizedEmail);
  if (!attempts.allowed) {
    throw new HTTP400Error('Too many attempts. Please wait 15 minutes and try again.');
  }

  // Compare codes using constant-time comparison to prevent timing attacks
  if (!secureCompare(storedCode, code)) {
    throw new HTTP400Error(
      `Invalid verification code. ${attempts.attemptsRemaining} attempt${attempts.attemptsRemaining !== 1 ? 's' : ''} remaining.`
    );
  }

  // Code is valid - delete it and reset attempts
  await signupCodes.deleteCode(normalizedEmail);
  await signupCodes.resetAttempts(normalizedEmail);

  // Generate signup token
  const signupToken = await jwt.signSignupToken(normalizedEmail);

  return { success: true, signupToken };
}

/**
 * Resend verification code
 */
async function resendSignupCode(email: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase();

  // Check if email already registered
  const existing = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].emailVerified) {
      // Email exists and is verified - user should login instead
      logger.warn('Attempted to resend verification code to verified email', {
        email: normalizedEmail,
        reason: 'email_already_verified',
      });
      throw new HTTP400Error('An account with this email already exists. Please sign in instead.');
    }
    // Email exists but isn't verified - allow them to proceed (completing signup)
    logger.info('Resending verification code to unverified existing email', {
      email: normalizedEmail,
      reason: 'completing_signup',
    });
  }

  // Check cooldown
  const cooldown = await signupCodes.checkResendCooldown(normalizedEmail);
  if (!cooldown.allowed) {
    throw new HTTP400Error(`Please wait ${cooldown.waitSeconds} seconds before requesting a new code.`);
  }

  // Generate and store new code
  const code = generateVerificationCode();
  await signupCodes.setCode(normalizedEmail, code);
  await signupCodes.setResendCooldown(normalizedEmail);

  // Send email
  const emailResult = await emailService.sendVerificationEmail(normalizedEmail, code);
  if (!emailResult.success) {
    // If email sending fails, clean up the stored code and throw error
    await signupCodes.deleteCode(normalizedEmail);
    const errorMessage = emailResult.error || 'Unknown error';
    logger.error('Failed to resend verification email', undefined, {
      email: normalizedEmail,
      error: errorMessage,
      reason: 'email_send_failed',
    });
    throw new HTTP400Error('Unable to send verification code. Please try again or contact support.');
  }

  return { success: true, message: 'New verification code sent to your email.' };
}

export const verificationMethods = {
  verifyEmail,
  resendVerificationCode,
  sendVerificationCode,
  verifySignupCode,
  resendSignupCode,
};

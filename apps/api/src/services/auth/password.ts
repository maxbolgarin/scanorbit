import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { HTTP400Error, HTTP401Error } from '../../lib/errors.js';
import { users } from '../../db/schema.js';
import { emailService } from '../emailService.js';
import { passwordResetStore, refreshTokenStore } from '../../lib/redis.js';
import { authOperationsTotal } from '../../lib/metrics.js';
import { logger } from '../../lib/logger.js';
import { SALT_ROUNDS } from './helpers.js';

/**
 * Change user password
 */
async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  // Get user with password hash
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new HTTP401Error('User not found');
  }

  // Check if user has a password (OAuth-only users can't change password)
  if (!user.passwordHash) {
    throw new HTTP400Error('This account uses social sign-in and does not have a password to change.');
  }

  // Verify current password
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    throw new HTTP400Error('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Revoke all refresh tokens for this user (logout from all devices)
  // This is a security measure - password change should invalidate all sessions
  await refreshTokenStore.revokeAllForUser(userId);

  return { success: true, message: 'Password changed successfully' };
}

/**
 * Set password for OAuth-only users (users without a password)
 */
async function setPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  // Get user with password hash
  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new HTTP401Error('User not found');
  }

  // Only allow setting password if user doesn't have one (OAuth-only users)
  if (user.passwordHash) {
    throw new HTTP400Error('You already have a password. Use change password instead.');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Set password
  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true, message: 'Password set successfully' };
}

/**
 * Request password reset - sends email with reset link
 * Returns generic message for security (doesn't reveal if email exists)
 */
async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const normalizedEmail = email.toLowerCase();

  // Find user by email
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  // Generic response message (same for all cases to prevent email enumeration)
  const genericMessage = 'If an account exists with this email, a reset link has been sent.';

  // If user doesn't exist, return generic success (security - don't reveal user existence)
  if (!user) {
    logger.info('Password reset requested for non-existent email', { email: normalizedEmail });
    return { message: genericMessage };
  }

  // Note: OAuth-only users (no passwordHash) can also use password reset
  // to set their initial password, enabling email/password login

  // Generate secure reset token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Store token → email mapping in Redis (1 hour TTL)
  await passwordResetStore.setToken(resetToken, normalizedEmail);

  // Send password reset email
  const emailResult = await emailService.sendPasswordResetEmail(
    normalizedEmail,
    resetToken,
    user.fullName ?? undefined
  );

  if (!emailResult.success) {
    // Clean up token if email fails
    await passwordResetStore.deleteToken(resetToken);
    logger.error('Failed to send password reset email', undefined, {
      email: normalizedEmail,
      error: emailResult.error || 'Unknown error',
    });
    // Still return generic message
    return { message: genericMessage };
  }

  logger.info('Password reset email sent', { email: normalizedEmail });
  authOperationsTotal.inc({ operation: 'password_reset_request', status: 'success' });

  return { message: genericMessage };
}

/**
 * Reset password using token
 */
async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  // Get email from Redis using token
  // Atomically consume token (GET + DEL) to prevent concurrent double-use
  const email = await passwordResetStore.consumeToken(token);

  if (!email) {
    authOperationsTotal.inc({ operation: 'password_reset', status: 'invalid_token' });
    throw new HTTP400Error('Invalid or expired reset link. Please request a new password reset.');
  }

  // Find user by email
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new HTTP400Error('Invalid or expired reset link. Please request a new password reset.');
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update user's password
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Revoke all refresh tokens for this user (logout from all devices)
  // This is a security measure - password reset should invalidate all sessions
  await refreshTokenStore.revokeAllForUser(user.id);

  logger.info('Password reset successful', { userId: user.id });
  authOperationsTotal.inc({ operation: 'password_reset', status: 'success' });

  return { message: 'Password reset successfully. You can now sign in with your new password.' };
}

export const passwordMethods = {
  changePassword,
  setPassword,
  requestPasswordReset,
  resetPassword,
};

import crypto, { timingSafeEqual } from 'crypto';
import bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../lib/db.js';
import { jwt } from '../lib/jwt.js';
import { HTTP400Error, HTTP401Error } from '../lib/errors.js';
import { users, orgs, userOrgMembers, userOauthAccounts } from '../db/schema.js';
import type { User, Org } from '../db/schema.js';
import { emailService } from './emailService.js';
import { signupCodes, redis, twoFactorStore, passwordResetStore, accountLockoutStore, refreshTokenStore } from '../lib/redis.js';
import { consentService } from './consentService.js';
import { authOperationsTotal } from '../lib/metrics.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { encryptOAuthTokenOptional } from '../lib/crypto.js';
import type { GoogleUserInfo, GoogleAuthResult, GitHubUserInfo, GitHubAuthResult } from '../types/index.js';

const SALT_ROUNDS = 10;
const VERIFICATION_CODE_EXPIRY_HOURS = 24;
const OAUTH_STATE_EXPIRY_SECONDS = 600; // 10 minutes

// Initialize Google OAuth client
const googleClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.callbackUrl
);

// Generate a 6-digit verification code using cryptographically secure random
function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Constant-time string comparison to prevent timing attacks
 * Used for verification codes to prevent attackers from timing
 * how long comparison takes to narrow down valid codes
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return timingSafeEqual(bufA, bufB);
}

// Generate URL-safe slug from org name
function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  // Add cryptographically random suffix to ensure uniqueness
  const suffix = crypto.randomUUID().substring(0, 8);
  return `${baseSlug}-${suffix}`;
}

interface SignupResult {
  user: Pick<User, 'id' | 'email' | 'fullName'>;
  org: Pick<Org, 'id' | 'name' | 'slug'> | null;
  message: string;
}

interface LoginResult {
  requires2FA?: false;
  user: Pick<User, 'id' | 'email' | 'fullName'> & { emailVerified: boolean; twoFactorEnabled: boolean };
  orgs: Pick<Org, 'id' | 'name' | 'slug'>[];
}

interface LoginResultWith2FA {
  requires2FA: true;
  challengeToken: string;
}

type LoginResponse = LoginResult | LoginResultWith2FA;

export const authService = {
  async signup(
    email: string,
    password: string,
    fullName: string,
    orgName?: string
  ): Promise<SignupResult> {
    // Check if user already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      authOperationsTotal.inc({ operation: 'signup', status: 'duplicate_email' });
      throw new HTTP400Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = new Date(
      Date.now() + VERIFICATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000
    );

    // Use transaction to ensure data consistency
    const { user, org } = await db.transaction(async (tx) => {
      // Create user with verification code
      const [createdUser] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          fullName,
          emailVerified: false,
          emailVerificationCode: verificationCode,
          emailVerificationExpiresAt: verificationExpiresAt,
        })
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        });

      let createdOrg: Pick<Org, 'id' | 'name' | 'slug'> | null = null;

      // Create org if name provided
      if (orgName && orgName.trim().length >= 2) {
        const slug = generateSlug(orgName.trim());

        const [newOrg] = await tx
          .insert(orgs)
          .values({
            name: orgName.trim(),
            slug,
          })
          .returning({
            id: orgs.id,
            name: orgs.name,
            slug: orgs.slug,
          });

        createdOrg = newOrg;

        // Add user to org as admin
        await tx.insert(userOrgMembers).values({
          userId: createdUser.id,
          orgId: createdOrg.id,
          role: 'admin',
        });
      }

      return { user: createdUser, org: createdOrg };
    });

    // Send verification email (outside transaction - external operation)
    await emailService.sendVerificationEmail(email, verificationCode, fullName);

    authOperationsTotal.inc({ operation: 'signup', status: 'success' });

    return {
      user,
      org,
      message: 'Account created. Please check your email for the verification code.',
    };
  },

  async verifyEmail(email: string, code: string): Promise<{ success: boolean; message: string }> {
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

    return { success: true, message: 'Email verified successfully' };
  },

  async resendVerificationCode(email: string): Promise<{ message: string }> {
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
      throw new HTTP400Error('Email already verified');
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
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    // Check for account lockout (protection against brute force attacks)
    const lockoutStatus = await accountLockoutStore.checkLockout(email);
    if (lockoutStatus.locked) {
      authOperationsTotal.inc({ operation: 'login', status: 'account_locked' });
      const minutes = Math.ceil(lockoutStatus.remainingLockoutSeconds / 60);
      throw new HTTP401Error(
        `Account temporarily locked due to too many failed login attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'} or reset your password.`
      );
    }

    // Get user by email
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        emailVerified: users.emailVerified,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      // Record failed attempt even for non-existent users to prevent user enumeration timing attacks
      await accountLockoutStore.recordFailedAttempt(email);
      authOperationsTotal.inc({ operation: 'login', status: 'user_not_found' });
      throw new HTTP401Error('Invalid credentials');
    }

    // Check if user has a password (might be OAuth-only)
    if (!user.passwordHash) {
      authOperationsTotal.inc({ operation: 'login', status: 'oauth_only_user' });
      throw new HTTP400Error('This account uses social sign-in. Please sign in with Google or GitHub.');
    }

    // Verify password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      // Record failed attempt
      await accountLockoutStore.recordFailedAttempt(email);
      authOperationsTotal.inc({ operation: 'login', status: 'invalid_password' });
      throw new HTTP401Error('Invalid credentials');
    }

    // Clear lockout counter on successful password verification
    await accountLockoutStore.clearLockout(email);

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Create challenge token and return
      const challengeToken = await twoFactorStore.createChallenge(user.id);
      authOperationsTotal.inc({ operation: 'login', status: '2fa_required' });
      return {
        requires2FA: true,
        challengeToken,
      };
    }

    // Get user's orgs
    const userOrgs = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, user.id));

    authOperationsTotal.inc({ operation: 'login', status: 'success' });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      orgs: userOrgs,
    };
  },

  /**
   * Complete login after 2FA verification
   * Called from 2FA verify endpoint
   */
  async completeLoginAfter2FA(userId: string): Promise<LoginResult> {
    // Get user
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        emailVerified: users.emailVerified,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    // Get user's orgs
    const userOrgs = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, userId));

    authOperationsTotal.inc({ operation: 'login_2fa', status: 'success' });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      orgs: userOrgs,
    };
  },

  async getMe(userId: string) {
    // Get user
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        emailVerified: users.emailVerified,
        twoFactorEnabled: users.twoFactorEnabled,
        createdAt: users.createdAt,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    // Get user's orgs with role and tier
    const userOrgs = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
        logoUrl: orgs.logoUrl,
        tier: orgs.tier,
        role: userOrgMembers.role,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, user.id));

    // Return user data with computed hasPassword field (never expose actual hash)
    const { passwordHash, ...userWithoutHash } = user;
    return {
      user: {
        ...userWithoutHash,
        hasPassword: !!passwordHash,
      },
      orgs: userOrgs
    };
  },

  async switchOrg(userId: string, orgId: string): Promise<void> {
    // Verify user has access to the SPECIFIC org being switched to
    const [membership] = await db
      .select({ id: userOrgMembers.id })
      .from(userOrgMembers)
      .where(and(
        eq(userOrgMembers.userId, userId),
        eq(userOrgMembers.orgId, orgId)
      ))
      .limit(1);

    if (!membership) {
      throw new HTTP401Error('You do not have access to this organization');
    }

    // Access verified - token generation is handled by the route
  },

  // ============================================
  // New Signup Flow Methods
  // ============================================

  /**
   * Send verification code to email (Step 1)
   */
  async sendVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
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
  },

  /**
   * Verify the code and return signup token (Step 2)
   */
  async verifySignupCode(
    email: string,
    code: string
  ): Promise<{ success: boolean; signupToken: string }> {
    const normalizedEmail = email.toLowerCase();

    // Check rate limit
    const attempts = await signupCodes.checkAttempts(normalizedEmail);
    if (!attempts.allowed) {
      throw new HTTP400Error('Too many attempts. Please wait 15 minutes and try again.');
    }

    // Increment attempts
    await signupCodes.incrementAttempts(normalizedEmail);

    // Get stored code
    const storedCode = await signupCodes.getCode(normalizedEmail);
    if (!storedCode) {
      throw new HTTP400Error('Verification code expired. Please request a new one.');
    }

    // Compare codes using constant-time comparison to prevent timing attacks
    if (!secureCompare(storedCode, code)) {
      const remaining = attempts.attemptsRemaining - 1;
      throw new HTTP400Error(
        `Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      );
    }

    // Code is valid - delete it and reset attempts
    await signupCodes.deleteCode(normalizedEmail);
    await signupCodes.resetAttempts(normalizedEmail);

    // Generate signup token
    const signupToken = await jwt.signSignupToken(normalizedEmail);

    return { success: true, signupToken };
  },

  /**
   * Complete signup with password (Step 3)
   */
  async completeSignup(
    signupToken: string,
    password: string,
    consentInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ user: Pick<User, 'id' | 'email' | 'fullName'> }> {
    // Verify signup token
    let tokenPayload;
    try {
      tokenPayload = await jwt.verifySignupToken(signupToken);
    } catch {
      throw new HTTP400Error('Session expired. Please start the signup process again.');
    }

    const email = tokenPayload.email;

    // Double-check email not already registered
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      // Use generic message to prevent user enumeration
      throw new HTTP400Error('Unable to complete registration. Please try again or contact support.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user (emailVerified: true since we verified the code)
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        fullName: '',
        emailVerified: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
      });

    // Log consent for GDPR compliance
    await consentService.logSignupConsent({
      userId: user.id,
      email,
      ipAddress: consentInfo?.ipAddress,
      userAgent: consentInfo?.userAgent,
    });

    // Cleanup any remaining Redis data
    await signupCodes.cleanup(email);

    return { user };
  },

  /**
   * Change user password
   */
  async changePassword(
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
  },

  /**
   * Set password for OAuth-only users (users without a password)
   */
  async setPassword(
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
  },

  /**
   * Update user profile (name only - email change requires verification)
   */
  async updateProfile(
    userId: string,
    updates: { fullName?: string }
  ): Promise<{ user: Pick<User, 'id' | 'email' | 'fullName'> }> {
    // Check if user has an active subscription — name changes are restricted
    if (updates.fullName !== undefined) {
      const [membership] = await db
        .select({ subscriptionStatus: orgs.subscriptionStatus })
        .from(userOrgMembers)
        .innerJoin(orgs, eq(orgs.id, userOrgMembers.orgId))
        .where(eq(userOrgMembers.userId, userId))
        .limit(1);

      if (membership && (membership.subscriptionStatus === 'active' || membership.subscriptionStatus === 'trialing')) {
        throw new HTTP400Error('Name cannot be changed while you have an active subscription. Please contact support.');
      }
    }

    // Build update object
    const updateData: { fullName?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (updates.fullName !== undefined) {
      updateData.fullName = updates.fullName;
    }

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
      });

    if (!updatedUser) {
      throw new HTTP401Error('User not found');
    }

    return { user: updatedUser };
  },

  /**
   * Resend verification code
   */
  async resendSignupCode(email: string): Promise<{ success: boolean; message: string }> {
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
  },

  // ============================================
  // Google OAuth Methods
  // ============================================

  /**
   * Generate OAuth state parameter for CSRF protection
   */
  async generateOAuthState(): Promise<string> {
    const state = crypto.randomBytes(32).toString('hex');
    await redis.set(`oauth_state:${state}`, '1', 'EX', OAUTH_STATE_EXPIRY_SECONDS);
    return state;
  },

  /**
   * Verify OAuth state parameter
   */
  async verifyOAuthState(state: string): Promise<boolean> {
    const exists = await redis.get(`oauth_state:${state}`);
    if (exists) {
      await redis.del(`oauth_state:${state}`);
      return true;
    }
    return false;
  },

  /**
   * Generate Google OAuth authorization URL
   */
  getGoogleAuthUrl(state: string): string {
    return googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      state,
      prompt: 'consent',
    });
  },

  /**
   * Handle Google OAuth callback (authorization code flow)
   */
  async handleGoogleCallback(code: string, state: string): Promise<GoogleAuthResult> {
    // Verify state parameter
    if (!await this.verifyOAuthState(state)) {
      authOperationsTotal.inc({ operation: 'google_oauth', status: 'invalid_state' });
      throw new HTTP400Error('Invalid OAuth state. Please try again.');
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Verify and decode ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      authOperationsTotal.inc({ operation: 'google_oauth', status: 'no_email' });
      throw new HTTP400Error('Failed to get user info from Google');
    }

    return this.processGoogleAuth({
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      fullName: payload.name,
      picture: payload.picture,
      accessToken: tokens.access_token ?? undefined,
      refreshToken: tokens.refresh_token ?? undefined,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      rawProfile: payload as unknown as Record<string, unknown>,
    });
  },

  /**
   * Handle Google ID token (frontend-initiated flow with Google Sign-In)
   */
  async handleGoogleIdToken(idToken: string): Promise<GoogleAuthResult> {
    // Verify ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      authOperationsTotal.inc({ operation: 'google_oauth', status: 'invalid_token' });
      throw new HTTP400Error('Invalid ID token');
    }

    return this.processGoogleAuth({
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      fullName: payload.name,
      picture: payload.picture,
      rawProfile: payload as unknown as Record<string, unknown>,
    });
  },

  /**
   * Process Google authentication - create or link user
   */
  async processGoogleAuth(googleUser: GoogleUserInfo): Promise<GoogleAuthResult> {
    const normalizedEmail = googleUser.email.toLowerCase();

    // Check if OAuth account already exists
    const existingOAuth = await db
      .select({ userId: userOauthAccounts.userId })
      .from(userOauthAccounts)
      .where(and(
        eq(userOauthAccounts.provider, 'google'),
        eq(userOauthAccounts.providerUserId, googleUser.googleId)
      ))
      .limit(1);

    if (existingOAuth.length > 0) {
      // Existing OAuth account - just log in
      authOperationsTotal.inc({ operation: 'google_oauth', status: 'existing_oauth' });
      return this.completeOAuthLogin(existingOAuth[0].userId, googleUser, false);
    }

    // Check if user exists by email (for account linking)
    const existingUser = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      // Link Google account to existing user
      await this.linkGoogleAccount(existingUser[0].id, googleUser);

      // Mark email as verified if Google says it's verified
      if (googleUser.emailVerified && !existingUser[0].emailVerified) {
        await db
          .update(users)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, existingUser[0].id));
      }

      authOperationsTotal.inc({ operation: 'google_oauth', status: 'linked_account' });
      return this.completeOAuthLogin(existingUser[0].id, googleUser, false);
    }

    // Create new user with Google account
    const newUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash: null, // OAuth-only user, no password
          fullName: googleUser.fullName || '',
          emailVerified: googleUser.emailVerified,
        })
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        });

      // Link OAuth account (encrypt tokens before storage)
      await tx.insert(userOauthAccounts).values({
        userId: user.id,
        provider: 'google',
        providerUserId: googleUser.googleId,
        providerEmail: googleUser.email,
        accessToken: encryptOAuthTokenOptional(googleUser.accessToken),
        refreshToken: encryptOAuthTokenOptional(googleUser.refreshToken),
        tokenExpiresAt: googleUser.tokenExpiresAt,
        rawProfile: googleUser.rawProfile,
      });

      return user;
    });

    authOperationsTotal.inc({ operation: 'google_oauth', status: 'new_user' });
    return this.completeOAuthLogin(newUser.id, googleUser, true);
  },

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(userId: string, googleUser: GoogleUserInfo): Promise<void> {
    // Encrypt tokens before storage
    await db.insert(userOauthAccounts).values({
      userId,
      provider: 'google',
      providerUserId: googleUser.googleId,
      providerEmail: googleUser.email,
      accessToken: encryptOAuthTokenOptional(googleUser.accessToken),
      refreshToken: encryptOAuthTokenOptional(googleUser.refreshToken),
      tokenExpiresAt: googleUser.tokenExpiresAt,
      rawProfile: googleUser.rawProfile,
    });
  },

  /**
   * Complete OAuth login - get user data and issue JWT
   * If 2FA is enabled, returns challenge token instead
   */
  async completeOAuthLogin(
    userId: string,
    _googleUser: GoogleUserInfo,
    isNewUser: boolean
  ): Promise<GoogleAuthResult> {
    // Get user info
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    // Check if 2FA is enabled (not for new users as they can't have 2FA yet)
    if (user.twoFactorEnabled && !isNewUser) {
      const challengeToken = await twoFactorStore.createChallenge(userId);
      authOperationsTotal.inc({ operation: 'google_oauth', status: '2fa_required' });
      return {
        requires2FA: true,
        challengeToken,
        isNewUser: false,
      };
    }

    // Get user's orgs
    const userOrgs = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, userId));

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      orgs: userOrgs,
      isNewUser,
      hasOrg: userOrgs.length > 0,
    };
  },

  // ============================================
  // GitHub OAuth Methods
  // ============================================

  /**
   * Generate GitHub OAuth authorization URL
   */
  getGithubAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.callbackUrl,
      scope: 'user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  },

  /**
   * Handle GitHub OAuth callback
   */
  async handleGithubCallback(code: string, state: string): Promise<GitHubAuthResult> {
    // Verify state parameter
    if (!await this.verifyOAuthState(state)) {
      authOperationsTotal.inc({ operation: 'github_oauth', status: 'invalid_state' });
      throw new HTTP400Error('Invalid OAuth state. Please try again.');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };

    if (tokenData.error || !tokenData.access_token) {
      authOperationsTotal.inc({ operation: 'github_oauth', status: 'token_error' });
      throw new HTTP400Error(tokenData.error_description || 'Failed to get access token from GitHub');
    }

    const accessToken = tokenData.access_token;

    // Fetch user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      authOperationsTotal.inc({ operation: 'github_oauth', status: 'user_fetch_error' });
      throw new HTTP400Error('Failed to get user info from GitHub');
    }

    const userData = await userResponse.json() as {
      id: number;
      login: string;
      name?: string;
      email?: string;
      avatar_url?: string;
    };

    // Fetch user emails (needed if primary email is private)
    let email = userData.email;
    let emailVerified = false;

    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json() as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;

        // Find primary verified email
        const primaryEmail = emails.find(e => e.primary && e.verified);
        if (primaryEmail) {
          email = primaryEmail.email;
          emailVerified = primaryEmail.verified;
        } else {
          // Fallback to any verified email
          const verifiedEmail = emails.find(e => e.verified);
          if (verifiedEmail) {
            email = verifiedEmail.email;
            emailVerified = verifiedEmail.verified;
          }
        }
      }
    } else {
      // If email was in profile, assume it's verified (GitHub only shows verified emails in profile)
      emailVerified = true;
    }

    if (!email) {
      authOperationsTotal.inc({ operation: 'github_oauth', status: 'no_email' });
      throw new HTTP400Error('No email address associated with your GitHub account. Please add a verified email to your GitHub account.');
    }

    return this.processGithubAuth({
      githubId: userData.id.toString(),
      email,
      emailVerified,
      fullName: userData.name,
      picture: userData.avatar_url,
      username: userData.login,
      accessToken,
      rawProfile: userData as unknown as Record<string, unknown>,
    });
  },

  /**
   * Process GitHub authentication - create or link user
   */
  async processGithubAuth(githubUser: GitHubUserInfo): Promise<GitHubAuthResult> {
    const normalizedEmail = githubUser.email.toLowerCase();

    // Check if OAuth account already exists
    const existingOAuth = await db
      .select({ userId: userOauthAccounts.userId })
      .from(userOauthAccounts)
      .where(and(
        eq(userOauthAccounts.provider, 'github'),
        eq(userOauthAccounts.providerUserId, githubUser.githubId)
      ))
      .limit(1);

    if (existingOAuth.length > 0) {
      // Existing OAuth account - just log in
      authOperationsTotal.inc({ operation: 'github_oauth', status: 'existing_oauth' });
      return this.completeGithubOAuthLogin(existingOAuth[0].userId, githubUser, false);
    }

    // Check if user exists by email (for account linking)
    const existingUser = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      // Link GitHub account to existing user
      await this.linkGithubAccount(existingUser[0].id, githubUser);

      // Mark email as verified if GitHub says it's verified
      if (githubUser.emailVerified && !existingUser[0].emailVerified) {
        await db
          .update(users)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, existingUser[0].id));
      }

      authOperationsTotal.inc({ operation: 'github_oauth', status: 'linked_account' });
      return this.completeGithubOAuthLogin(existingUser[0].id, githubUser, false);
    }

    // Create new user with GitHub account
    const newUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash: null, // OAuth-only user, no password
          fullName: githubUser.fullName || '',
          emailVerified: githubUser.emailVerified,
        })
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        });

      // Link OAuth account (encrypt tokens before storage)
      await tx.insert(userOauthAccounts).values({
        userId: user.id,
        provider: 'github',
        providerUserId: githubUser.githubId,
        providerEmail: githubUser.email,
        accessToken: encryptOAuthTokenOptional(githubUser.accessToken),
        refreshToken: null, // GitHub doesn't provide refresh tokens
        tokenExpiresAt: null, // GitHub tokens don't expire
        rawProfile: githubUser.rawProfile,
      });

      return user;
    });

    authOperationsTotal.inc({ operation: 'github_oauth', status: 'new_user' });
    return this.completeGithubOAuthLogin(newUser.id, githubUser, true);
  },

  /**
   * Link GitHub account to existing user
   */
  async linkGithubAccount(userId: string, githubUser: GitHubUserInfo): Promise<void> {
    // Encrypt tokens before storage
    await db.insert(userOauthAccounts).values({
      userId,
      provider: 'github',
      providerUserId: githubUser.githubId,
      providerEmail: githubUser.email,
      accessToken: encryptOAuthTokenOptional(githubUser.accessToken),
      refreshToken: null, // GitHub doesn't provide refresh tokens
      tokenExpiresAt: null, // GitHub tokens don't expire
      rawProfile: githubUser.rawProfile,
    });
  },

  /**
   * Complete GitHub OAuth login - get user data and issue JWT
   * If 2FA is enabled, returns challenge token instead
   */
  async completeGithubOAuthLogin(
    userId: string,
    _githubUser: GitHubUserInfo,
    isNewUser: boolean
  ): Promise<GitHubAuthResult> {
    // Get user info
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    // Check if 2FA is enabled (not for new users as they can't have 2FA yet)
    if (user.twoFactorEnabled && !isNewUser) {
      const challengeToken = await twoFactorStore.createChallenge(userId);
      authOperationsTotal.inc({ operation: 'github_oauth', status: '2fa_required' });
      return {
        requires2FA: true,
        challengeToken,
        isNewUser: false,
      };
    }

    // Get user's orgs
    const userOrgs = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, userId));

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      orgs: userOrgs,
      isNewUser,
      hasOrg: userOrgs.length > 0,
    };
  },

  // ============================================
  // Password Reset Methods
  // ============================================

  /**
   * Request password reset - sends email with reset link
   * Returns generic message for security (doesn't reveal if email exists)
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
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
  },

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Get email from Redis using token
    const email = await passwordResetStore.getEmail(token);

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
      // This shouldn't happen, but handle gracefully
      await passwordResetStore.deleteToken(token);
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

    // Delete token from Redis (single-use)
    await passwordResetStore.deleteToken(token);

    // Revoke all refresh tokens for this user (logout from all devices)
    // This is a security measure - password reset should invalidate all sessions
    await refreshTokenStore.revokeAllForUser(user.id);

    logger.info('Password reset successful', { userId: user.id });
    authOperationsTotal.inc({ operation: 'password_reset', status: 'success' });

    return { message: 'Password reset successfully. You can now sign in with your new password.' };
  },
};

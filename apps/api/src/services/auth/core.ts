import bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { jwt } from '../../lib/jwt.js';
import { HTTP400Error, HTTP401Error, HTTP403Error, getPgErrorCode } from '../../lib/errors.js';
import { users, orgs, userOrgMembers } from '../../db/schema.js';
import type { User, Org } from '../../db/schema.js';
import { emailService } from '../emailService.js';
import { signupCodes, twoFactorStore, accountLockoutStore } from '../../lib/redis.js';
import { consentService } from '../consentService.js';
import { authOperationsTotal, userSignupsTotal, userLoginsTotal } from '../../lib/metrics.js';
import { logger } from '../../lib/logger.js';
import { publishTelegramEvent } from '../telegramEventService.js';
import { generateVerificationCode, generateSlug, SALT_ROUNDS, VERIFICATION_CODE_EXPIRY_HOURS } from './helpers.js';
import type { SignupResult, LoginResponse, LoginResult } from './helpers.js';

async function signup(
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
    throw new HTTP400Error('Unable to create account. If you already have an account, please sign in.');
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
  // Wrapped in try-catch to prevent email delivery failures from crashing signup.
  // The user record is already committed, so failing here would leave them stuck
  // (can't retry signup due to "email exists", but never received the code).
  try {
    await emailService.sendVerificationEmail(email, verificationCode, fullName);
  } catch (emailError) {
    logger.error('Failed to send verification email during signup', emailError as Error, { email: email.toLowerCase() });
    // User can request a new code via "resend verification" flow
  }

  authOperationsTotal.inc({ operation: 'signup', status: 'success' });
  userSignupsTotal.inc({ method: 'email' });
  publishTelegramEvent({ type: 'user_signup', userId: user.id, method: 'email' });

  return {
    user,
    org,
    message: 'Account created. Please check your email for the verification code.',
  };
}

async function login(email: string, password: string): Promise<LoginResponse> {
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
    userLoginsTotal.inc({ method: 'email', status: '2fa_required' });
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
  userLoginsTotal.inc({ method: 'email', status: 'success' });

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
}

/**
 * Complete login after 2FA verification
 * Called from 2FA verify endpoint
 */
async function completeLoginAfter2FA(userId: string): Promise<LoginResult> {
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
  userLoginsTotal.inc({ method: 'email', status: 'success' });

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
}

async function getMe(userId: string) {
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
      createdAt: orgs.createdAt,
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
}

async function switchOrg(userId: string, orgId: string): Promise<void> {
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
    throw new HTTP403Error('You do not have access to this organization');
  }

  // Access verified - token generation is handled by the route
}

/**
 * Complete signup with password (Step 3)
 */
async function completeSignup(
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
  let user;
  try {
    [user] = await db
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
  } catch (err: unknown) {
    // Handle race condition: unique constraint violation on email
    if (getPgErrorCode(err) === '23505') {
      throw new HTTP400Error('Unable to complete registration. Please try again or contact support.');
    }
    throw err;
  }

  // Log consent for GDPR compliance
  await consentService.logSignupConsent({
    userId: user.id,
    email,
    ipAddress: consentInfo?.ipAddress,
    userAgent: consentInfo?.userAgent,
  });

  // Cleanup any remaining Redis data
  await signupCodes.cleanup(email);

  userSignupsTotal.inc({ method: 'email' });
  publishTelegramEvent({ type: 'user_signup', userId: user.id, method: 'email' });

  return { user };
}

/**
 * Update user profile (name only - email change requires verification)
 */
async function updateProfile(
  userId: string,
  updates: { fullName?: string }
): Promise<{ user: Pick<User, 'id' | 'email' | 'fullName' | 'createdAt' | 'emailVerified' | 'twoFactorEnabled'> & { hasPassword: boolean } }> {
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
      createdAt: users.createdAt,
      emailVerified: users.emailVerified,
      twoFactorEnabled: users.twoFactorEnabled,
      passwordHash: users.passwordHash,
    });

  if (!updatedUser) {
    throw new HTTP401Error('User not found');
  }

  const { passwordHash, ...userWithoutHash } = updatedUser;
  return { user: { ...userWithoutHash, hasPassword: !!passwordHash } };
}

export const coreAuthMethods = {
  signup,
  login,
  completeLoginAfter2FA,
  getMe,
  switchOrg,
  completeSignup,
  updateProfile,
};

import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { jwt } from '../lib/jwt.js';
import { HTTP400Error, HTTP401Error } from '../lib/errors.js';
import { users, orgs, userOrgMembers } from '../db/schema.js';
import type { User, Org } from '../db/schema.js';
import { emailService } from './emailService.js';
import { signupCodes } from '../lib/redis.js';
import { consentService } from './consentService.js';

const SALT_ROUNDS = 10;
const VERIFICATION_CODE_EXPIRY_HOURS = 24;

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

  // Add random suffix to ensure uniqueness
  const suffix = Date.now().toString(36);
  return `${baseSlug}-${suffix}`;
}

interface SignupResult {
  user: Pick<User, 'id' | 'email' | 'fullName'>;
  org: Pick<Org, 'id' | 'name' | 'slug'> | null;
  token: string;
  message: string;
}

interface LoginResult {
  user: Pick<User, 'id' | 'email' | 'fullName'> & { emailVerified: boolean };
  orgs: Pick<Org, 'id' | 'name' | 'slug'>[];
  token: string;
}

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
      throw new HTTP400Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = new Date(
      Date.now() + VERIFICATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000
    );

    // Create user with verification code
    const [user] = await db
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

    let org: Pick<Org, 'id' | 'name' | 'slug'> | null = null;

    // Create org if name provided
    if (orgName && orgName.trim().length >= 2) {
      const slug = generateSlug(orgName.trim());

      const [createdOrg] = await db
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

      org = createdOrg;

      // Add user to org as admin
      await db.insert(userOrgMembers).values({
        userId: user.id,
        orgId: org.id,
        role: 'admin',
      });
    }

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationCode, fullName);

    // Sign JWT
    const token = await jwt.sign({
      userId: user.id,
      orgId: org?.id ?? null,
    });

    return {
      user,
      org,
      token,
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

    if (user.emailVerificationCode !== code) {
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

  async login(email: string, password: string): Promise<LoginResult> {
    // Get user by email
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('Invalid credentials');
    }

    // Verify password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new HTTP401Error('Invalid credentials');
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

    // Sign JWT with first org as default
    const token = await jwt.sign({
      userId: user.id,
      orgId: userOrgs[0]?.id ?? null,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
      },
      orgs: userOrgs,
      token,
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
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    // Get user's orgs with role
    const userOrgs = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
        logoUrl: orgs.logoUrl,
        role: userOrgMembers.role,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, user.id));

    return { user, orgs: userOrgs };
  },

  async switchOrg(userId: string, orgId: string): Promise<string> {
    // Verify user has access to org
    const [membership] = await db
      .select({ id: userOrgMembers.id })
      .from(userOrgMembers)
      .where(eq(userOrgMembers.userId, userId))
      .limit(1);

    if (!membership) {
      throw new HTTP401Error('You do not have access to this organization');
    }

    // Sign new JWT with selected org
    return jwt.sign({ userId, orgId });
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
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new HTTP400Error('This email is already registered. Try logging in.');
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
    await emailService.sendVerificationEmail(normalizedEmail, code);

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

    // Compare codes
    if (storedCode !== code) {
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
  ): Promise<{ user: Pick<User, 'id' | 'email' | 'fullName'>; token: string }> {
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
      throw new HTTP400Error('This email is already registered.');
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

    // Sign auth JWT
    const token = await jwt.sign({
      userId: user.id,
      orgId: null,
    });

    return { user, token };
  },

  /**
   * Resend verification code
   */
  async resendSignupCode(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase();

    // Check if email already registered
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new HTTP400Error('This email is already registered. Try logging in.');
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
    await emailService.sendVerificationEmail(normalizedEmail, code);

    return { success: true, message: 'New verification code sent to your email.' };
  },
};

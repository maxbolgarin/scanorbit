import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { HTTP400Error, HTTP401Error } from '../lib/errors.js';
import { twoFactorStore, totpReplayStore } from '../lib/redis.js';
import {
  generateTotpSecret,
  generateQRCodeUri,
  verifyTotpCode,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyRecoveryCode,
  removeRecoveryCodeAtIndex,
  countRemainingRecoveryCodes,
} from '../lib/totp.js';

export interface TwoFactorSetupInitResult {
  qrCodeUri: string;
  secret: string; // For manual entry
}

export interface TwoFactorSetupVerifyResult {
  recoveryCodes: string[];
}

export interface TwoFactorStatusResult {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export const twoFactorService = {
  /**
   * Get user's 2FA status
   */
  async getStatus(userId: string): Promise<TwoFactorStatusResult> {
    const [user] = await db
      .select({
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorRecoveryCodes: users.twoFactorRecoveryCodes,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    return {
      enabled: user.twoFactorEnabled,
      recoveryCodesRemaining: countRemainingRecoveryCodes(user.twoFactorRecoveryCodes),
    };
  },

  /**
   * Initialize 2FA setup - generate secret and store temporarily in Redis
   */
  async initSetup(userId: string): Promise<TwoFactorSetupInitResult> {
    // Get user email for QR code
    const [user] = await db
      .select({
        email: users.email,
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new HTTP400Error('Two-factor authentication is already enabled');
    }

    // Generate new TOTP secret
    const secret = generateTotpSecret();
    const qrCodeUri = generateQRCodeUri(secret, user.email);

    // Store temporarily in Redis (10 min TTL)
    await twoFactorStore.setSetupSecret(userId, { secret, qrCodeUri });

    return {
      qrCodeUri,
      secret, // For manual entry if QR scan doesn't work
    };
  },

  /**
   * Verify TOTP code and enable 2FA
   * Returns recovery codes on success
   */
  async verifyAndEnable(userId: string, code: string): Promise<TwoFactorSetupVerifyResult> {
    // Get temporary setup data from Redis
    const setupData = await twoFactorStore.getSetupSecret(userId);

    if (!setupData) {
      throw new HTTP400Error('2FA setup session expired. Please start setup again.');
    }

    // Atomic rate limit check + increment (prevents TOCTOU race)
    const attempts = await twoFactorStore.checkAndIncrementVerifyAttempts(`setup:${userId}`);
    if (!attempts.allowed) {
      throw new HTTP400Error('Too many verification attempts. Please try again later.');
    }

    // Verify the TOTP code against the temporary secret
    const isValid = verifyTotpCode(setupData.secret, code);

    if (!isValid) {
      throw new HTTP400Error(
        `Invalid verification code. ${attempts.attemptsRemaining} attempt${attempts.attemptsRemaining !== 1 ? 's' : ''} remaining.`
      );
    }

    // Code is valid - enable 2FA
    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(recoveryCodes);

    // Encrypt the secret for storage
    const encryptedSecret = encryptSecret(setupData.secret);

    // Update user in database
    await db
      .update(users)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: encryptedSecret,
        twoFactorRecoveryCodes: hashedCodes,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Clean up Redis
    await twoFactorStore.deleteSetupSecret(userId);
    await twoFactorStore.resetVerifyAttempts(`setup:${userId}`);

    return {
      recoveryCodes, // Return plaintext codes for user to save
    };
  },

  /**
   * Disable 2FA (requires password verification and TOTP code)
   */
  async disable(userId: string, password: string, code: string): Promise<void> {
    // Get user data
    const [user] = await db
      .select({
        passwordHash: users.passwordHash,
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorSecret: users.twoFactorSecret,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new HTTP400Error('Two-factor authentication is not enabled');
    }

    // Rate limiting FIRST (before password check to prevent brute force on expensive bcrypt)
    const attempts = await twoFactorStore.checkAndIncrementVerifyAttempts(`disable:${userId}`);
    if (!attempts.allowed) {
      throw new HTTP400Error('Too many attempts. Please try again later.');
    }

    // Verify password (if user has one - OAuth-only users may not)
    if (user.passwordHash) {
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        throw new HTTP400Error('Invalid password');
      }
    }

    // Verify TOTP code
    const decryptedSecret = decryptSecret(user.twoFactorSecret);
    const isValid = verifyTotpCode(decryptedSecret, code);

    if (!isValid) {
      throw new HTTP400Error(
        `Invalid verification code. ${attempts.attemptsRemaining} attempt${attempts.attemptsRemaining !== 1 ? 's' : ''} remaining.`
      );
    }

    // Disable 2FA
    await db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Clean up rate limiting
    await twoFactorStore.resetVerifyAttempts(`disable:${userId}`);
  },

  /**
   * Verify TOTP code during login challenge.
   * Includes replay protection — each code can only be used once.
   */
  async verify(userId: string, code: string): Promise<boolean> {
    // Get user's 2FA data
    const [user] = await db
      .select({
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorSecret: users.twoFactorSecret,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new HTTP400Error('Two-factor authentication is not enabled');
    }

    // Check for replay attack — reject already-used codes
    if (await totpReplayStore.isCodeUsed(userId, code)) {
      return false;
    }

    // Decrypt and verify
    const decryptedSecret = decryptSecret(user.twoFactorSecret);
    const isValid = verifyTotpCode(decryptedSecret, code);

    // Mark code as used to prevent replay within the validity window
    if (isValid) {
      await totpReplayStore.markCodeUsed(userId, code);
    }

    return isValid;
  },

  /**
   * Verify recovery code during login (single use)
   */
  async verifyRecoveryCode(userId: string, recoveryCode: string): Promise<boolean> {
    // Get user's 2FA data
    // Use transaction with row lock to prevent concurrent double-use of the same recovery code
    return db.transaction(async (tx) => {
      const [user] = await tx
        .select({
          twoFactorEnabled: users.twoFactorEnabled,
          twoFactorRecoveryCodes: users.twoFactorRecoveryCodes,
        })
        .from(users)
        .where(eq(users.id, userId))
        .for('update')
        .limit(1);

      if (!user) {
        throw new HTTP401Error('User not found');
      }

      if (!user.twoFactorEnabled || !user.twoFactorRecoveryCodes) {
        throw new HTTP400Error('Two-factor authentication is not enabled');
      }

      // Verify recovery code
      const result = await verifyRecoveryCode(recoveryCode, user.twoFactorRecoveryCodes);

      if (!result.valid) {
        return false;
      }

      // Remove used recovery code
      const updatedCodes = removeRecoveryCodeAtIndex(user.twoFactorRecoveryCodes, result.index);

      await tx
        .update(users)
        .set({
          twoFactorRecoveryCodes: updatedCodes,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return true;
    });
  },

  /**
   * Get recovery codes (requires password verification)
   * Note: Returns masked codes (user can only view once during setup)
   */
  async getRecoveryCodesCount(userId: string): Promise<{ remaining: number }> {
    const [user] = await db
      .select({
        twoFactorRecoveryCodes: users.twoFactorRecoveryCodes,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    return {
      remaining: countRemainingRecoveryCodes(user.twoFactorRecoveryCodes),
    };
  },

  /**
   * Regenerate recovery codes (requires password and TOTP verification)
   */
  async regenerateRecoveryCodes(
    userId: string,
    password: string,
    code: string
  ): Promise<{ recoveryCodes: string[] }> {
    // Get user data
    const [user] = await db
      .select({
        passwordHash: users.passwordHash,
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorSecret: users.twoFactorSecret,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP401Error('User not found');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new HTTP400Error('Two-factor authentication is not enabled');
    }

    // Rate limiting FIRST (before password check to prevent brute force on expensive bcrypt)
    const attempts = await twoFactorStore.checkAndIncrementVerifyAttempts(`regen:${userId}`);
    if (!attempts.allowed) {
      throw new HTTP400Error('Too many attempts. Please try again later.');
    }

    // Verify password (if user has one)
    if (user.passwordHash) {
      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        throw new HTTP400Error('Invalid password');
      }
    }

    // Verify TOTP code
    const decryptedSecret = decryptSecret(user.twoFactorSecret);
    const isValid = verifyTotpCode(decryptedSecret, code);

    if (!isValid) {
      throw new HTTP400Error(
        `Invalid verification code. ${attempts.attemptsRemaining} attempt${attempts.attemptsRemaining !== 1 ? 's' : ''} remaining.`
      );
    }

    // Generate new recovery codes
    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(recoveryCodes);

    // Update database
    await db
      .update(users)
      .set({
        twoFactorRecoveryCodes: hashedCodes,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Clean up rate limiting
    await twoFactorStore.resetVerifyAttempts(`regen:${userId}`);

    return { recoveryCodes };
  },
};

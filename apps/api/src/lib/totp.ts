import crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as OTPAuth from 'otpauth';
import { config } from './config.js';

const TOTP_ISSUER = 'ScanOrbit';
const TOTP_ALGORITHM = 'SHA1';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_WINDOW = 1; // Allow 1 step before/after for clock skew

const RECOVERY_CODE_LENGTH = 8;
const RECOVERY_CODE_COUNT = 10;
const BCRYPT_ROUNDS = 10;

// AES-256-GCM encryption parameters
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from config (hex string to buffer)
 */
function getEncryptionKey(): Buffer {
  const keyHex = config.totpEncryptionKey;
  if (keyHex.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Generate a cryptographically secure TOTP secret
 * Returns base32-encoded secret (20 bytes = 160 bits)
 */
export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

/**
 * Generate the otpauth:// URI for QR code
 * This URI is scanned by authenticator apps
 */
export function generateQRCodeUri(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: email,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  return totp.toString();
}

/**
 * Verify a TOTP code against the secret.
 * Allows 1-step window for clock skew tolerance.
 * This is the low-level check without replay protection.
 * Use verifyTotpCodeWithReplayProtection for login flows.
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // Generate the expected code for each window step and compare with timing-safe equality
  // to prevent timing side-channel attacks on the verification
  for (let step = -TOTP_WINDOW; step <= TOTP_WINDOW; step++) {
    const expected = totp.generate({ timestamp: Date.now() + step * TOTP_PERIOD * 1000 });
    const expectedBuf = Buffer.from(expected, 'utf8');
    const codeBuf = Buffer.from(code, 'utf8');
    if (expectedBuf.length === codeBuf.length && crypto.timingSafeEqual(expectedBuf, codeBuf)) {
      return true;
    }
  }
  return false;
}

/**
 * TOTP replay protection window in seconds.
 * Codes are valid for TOTP_PERIOD * (2 * TOTP_WINDOW + 1) = 90 seconds.
 */
export const TOTP_REPLAY_TTL = TOTP_PERIOD * (2 * TOTP_WINDOW + 1);

/**
 * Encrypt a TOTP secret using AES-256-GCM
 * Returns a string in format: iv:authTag:ciphertext (all base64)
 */
export function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + auth tag + ciphertext, all base64 encoded
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt a TOTP secret encrypted with encryptSecret()
 */
export function decryptSecret(encryptedString: string): string {
  const key = getEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generate recovery codes (human-readable format: XXXX-XXXX)
 * Returns array of plaintext codes
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    // Generate random bytes and convert to alphanumeric
    const bytes = crypto.randomBytes(RECOVERY_CODE_LENGTH);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters (0, O, 1, I)
    let code = '';

    for (let j = 0; j < RECOVERY_CODE_LENGTH; j++) {
      code += chars[bytes[j] % chars.length];
    }

    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Hash a recovery code for storage
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  // Normalize: remove dashes and uppercase
  const normalized = code.replace(/-/g, '').toUpperCase();
  return bcrypt.hash(normalized, BCRYPT_ROUNDS);
}

/**
 * Hash all recovery codes for storage
 * Returns JSON string of hashed codes
 */
export async function hashRecoveryCodes(codes: string[]): Promise<string> {
  const hashedCodes = await Promise.all(codes.map(hashRecoveryCode));
  return JSON.stringify(hashedCodes);
}

/**
 * Verify a recovery code against stored hashes
 * Returns { valid: boolean, index: number } where index is the position of the matched code
 */
export async function verifyRecoveryCode(
  code: string,
  hashedCodesJson: string
): Promise<{ valid: boolean; index: number }> {
  // Normalize: remove dashes and uppercase
  const normalized = code.replace(/-/g, '').toUpperCase();

  let hashedCodes: string[];
  try {
    hashedCodes = JSON.parse(hashedCodesJson);
  } catch {
    return { valid: false, index: -1 };
  }

  // Check against each hashed code
  for (let i = 0; i < hashedCodes.length; i++) {
    const hash = hashedCodes[i];
    if (hash && await bcrypt.compare(normalized, hash)) {
      return { valid: true, index: i };
    }
  }

  return { valid: false, index: -1 };
}

/**
 * Remove a used recovery code from the stored hashes
 * Returns the updated JSON string
 */
export function removeRecoveryCodeAtIndex(hashedCodesJson: string, index: number): string {
  let hashedCodes: string[];
  try {
    hashedCodes = JSON.parse(hashedCodesJson);
  } catch {
    return hashedCodesJson;
  }

  // Replace the used code with null to maintain indices
  // (or we could splice it out, but null makes it clear it was used)
  if (index >= 0 && index < hashedCodes.length) {
    hashedCodes[index] = '';
  }

  return JSON.stringify(hashedCodes);
}

/**
 * Count remaining valid recovery codes
 */
export function countRemainingRecoveryCodes(hashedCodesJson: string | null): number {
  if (!hashedCodesJson) return 0;

  try {
    const hashedCodes: string[] = JSON.parse(hashedCodesJson);
    return hashedCodes.filter(code => code && code.length > 0).length;
  } catch {
    return 0;
  }
}

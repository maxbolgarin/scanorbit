import crypto from 'crypto';
import { config } from './config.js';

// AES-256-GCM encryption parameters
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key for OAuth tokens (hex string to buffer)
 */
function getOAuthEncryptionKey(): Buffer {
  const keyHex = config.oauthEncryptionKey;
  if (keyHex.length !== 64) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns a string in format: iv:authTag:ciphertext (all base64)
 */
export function encryptOAuthToken(plaintext: string): string {
  const key = getOAuthEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + auth tag + ciphertext, all base64 encoded
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt an OAuth token encrypted with encryptOAuthToken()
 */
export function decryptOAuthToken(encryptedString: string): string {
  const key = getOAuthEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
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
 * Encrypt an OAuth token if it exists, otherwise return null/undefined
 */
export function encryptOAuthTokenOptional(token: string | null | undefined): string | null {
  if (!token) return null;
  return encryptOAuthToken(token);
}

/**
 * Decrypt an OAuth token if it exists and is in encrypted format, otherwise return as-is
 * This allows backward compatibility with existing unencrypted tokens
 */
export function decryptOAuthTokenOptional(token: string | null | undefined): string | null {
  if (!token) return null;

  // Check if token is in encrypted format (iv:authTag:ciphertext with base64)
  // Encrypted tokens have exactly 2 colons and the parts look like base64
  const parts = token.split(':');
  if (parts.length === 3 && parts.every(p => /^[A-Za-z0-9+/=]+$/.test(p))) {
    try {
      return decryptOAuthToken(token);
    } catch {
      // If decryption fails, assume it's a legacy unencrypted token
      return token;
    }
  }

  // Not encrypted, return as-is (backward compatibility)
  return token;
}

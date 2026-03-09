import { describe, it, expect } from 'vitest';
import {
  encryptOAuthToken,
  decryptOAuthToken,
  encryptOAuthTokenOptional,
  decryptOAuthTokenOptional,
  encryptExternalId,
  decryptExternalId,
  encryptExternalIdOptional,
  decryptExternalIdOptional,
} from '../../lib/crypto.js';

describe('OAuth Token Encryption', () => {
  it('encrypts and decrypts a token roundtrip', () => {
    const original = 'gho_abc123_my_oauth_token';
    const encrypted = encryptOAuthToken(original);
    const decrypted = decryptOAuthToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertexts for same input (random IV)', () => {
    const token = 'same-token';
    const enc1 = encryptOAuthToken(token);
    const enc2 = encryptOAuthToken(token);
    expect(enc1).not.toBe(enc2);
  });

  it('encrypted format is iv:authTag:ciphertext', () => {
    const encrypted = encryptOAuthToken('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // Each part should be base64
    for (const part of parts) {
      expect(() => Buffer.from(part, 'base64')).not.toThrow();
    }
  });

  it('throws on invalid encrypted format', () => {
    expect(() => decryptOAuthToken('invalid')).toThrow('Invalid encrypted token format');
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptOAuthToken('secret');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    parts[2] = Buffer.from('tampered').toString('base64');
    expect(() => decryptOAuthToken(parts.join(':'))).toThrow();
  });
});

describe('OAuth Token Optional helpers', () => {
  it('encryptOAuthTokenOptional returns null for null/undefined', () => {
    expect(encryptOAuthTokenOptional(null)).toBeNull();
    expect(encryptOAuthTokenOptional(undefined)).toBeNull();
  });

  it('encryptOAuthTokenOptional encrypts non-null values', () => {
    const result = encryptOAuthTokenOptional('token');
    expect(result).not.toBeNull();
    expect(decryptOAuthToken(result!)).toBe('token');
  });

  it('decryptOAuthTokenOptional returns null for null/undefined', () => {
    expect(decryptOAuthTokenOptional(null)).toBeNull();
    expect(decryptOAuthTokenOptional(undefined)).toBeNull();
  });

  it('decryptOAuthTokenOptional decrypts encrypted tokens', () => {
    const encrypted = encryptOAuthToken('my-token');
    expect(decryptOAuthTokenOptional(encrypted)).toBe('my-token');
  });

  it('decryptOAuthTokenOptional returns legacy unencrypted tokens as-is', () => {
    expect(decryptOAuthTokenOptional('plain-legacy-token')).toBe('plain-legacy-token');
  });
});

describe('External ID Encryption', () => {
  it('encrypts and decrypts external ID roundtrip', () => {
    const original = 'ext-id-12345-abcde';
    const encrypted = encryptExternalId(original);
    const decrypted = decryptExternalId(encrypted);
    expect(decrypted).toBe(original);
  });

  it('throws on invalid format', () => {
    expect(() => decryptExternalId('bad')).toThrow('Invalid encrypted external ID format');
  });
});

describe('External ID Optional helpers', () => {
  it('encryptExternalIdOptional returns null for null/undefined', () => {
    expect(encryptExternalIdOptional(null)).toBeNull();
    expect(encryptExternalIdOptional(undefined)).toBeNull();
  });

  it('decryptExternalIdOptional returns null for null/undefined', () => {
    expect(decryptExternalIdOptional(null)).toBeNull();
    expect(decryptExternalIdOptional(undefined)).toBeNull();
  });

  it('decryptExternalIdOptional decrypts encrypted IDs', () => {
    const encrypted = encryptExternalId('my-ext-id');
    expect(decryptExternalIdOptional(encrypted)).toBe('my-ext-id');
  });

  it('decryptExternalIdOptional returns legacy unencrypted IDs as-is', () => {
    expect(decryptExternalIdOptional('legacy-plain-id')).toBe('legacy-plain-id');
  });
});

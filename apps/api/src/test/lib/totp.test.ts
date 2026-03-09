import { describe, it, expect } from 'vitest';
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
  TOTP_REPLAY_TTL,
} from '../../lib/totp.js';

describe('totp', () => {
  describe('generateTotpSecret', () => {
    it('returns a base32-encoded string', () => {
      const secret = generateTotpSecret();
      expect(secret).toBeTruthy();
      expect(secret.length).toBeGreaterThan(10);
      // Base32 alphabet
      expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    });

    it('generates unique secrets', () => {
      const s1 = generateTotpSecret();
      const s2 = generateTotpSecret();
      expect(s1).not.toBe(s2);
    });
  });

  describe('generateQRCodeUri', () => {
    it('returns otpauth URI', () => {
      const secret = generateTotpSecret();
      const uri = generateQRCodeUri(secret, 'user@test.com');
      expect(uri).toContain('otpauth://totp/');
      expect(uri).toContain('ScanOrbit');
      expect(uri).toContain('user%40test.com');
      expect(uri).toContain('secret=');
    });
  });

  describe('verifyTotpCode', () => {
    it('rejects invalid code', () => {
      const secret = generateTotpSecret();
      expect(verifyTotpCode(secret, '000000')).toBe(false);
    });
  });

  describe('TOTP_REPLAY_TTL', () => {
    it('equals 90 seconds (30 * 3)', () => {
      expect(TOTP_REPLAY_TTL).toBe(90);
    });
  });

  describe('encryptSecret / decryptSecret', () => {
    it('encrypts and decrypts roundtrip', () => {
      const original = generateTotpSecret();
      const encrypted = encryptSecret(original);
      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(original);
    });

    it('encrypted format has 3 base64 parts', () => {
      const encrypted = encryptSecret('JBSWY3DPEHPK3PXP');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });

    it('throws on invalid encrypted format', () => {
      expect(() => decryptSecret('invalid')).toThrow('Invalid encrypted secret format');
    });

    it('produces different ciphertexts for same input (random IV)', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const e1 = encryptSecret(secret);
      const e2 = encryptSecret(secret);
      expect(e1).not.toBe(e2);
    });
  });

  describe('generateRecoveryCodes', () => {
    it('generates 10 codes', () => {
      const codes = generateRecoveryCodes();
      expect(codes).toHaveLength(10);
    });

    it('codes are in XXXX-XXXX format', () => {
      const codes = generateRecoveryCodes();
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      }
    });

    it('codes are unique', () => {
      const codes = generateRecoveryCodes();
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });
  });

  describe('hashRecoveryCodes', () => {
    it('returns JSON string of hashed codes', async () => {
      const codes = ['ABCD-EFGH', 'WXYZ-1234'];
      const hashed = await hashRecoveryCodes(codes);
      const parsed = JSON.parse(hashed);
      expect(parsed).toHaveLength(2);
      // Hashes should be bcrypt strings
      for (const h of parsed) {
        expect(h).toMatch(/^\$2[aby]?\$/);
      }
    });
  });

  describe('verifyRecoveryCode', () => {
    it('verifies a valid recovery code', async () => {
      const codes = ['ABCD-EFGH', 'WXYZ-1234'];
      const hashed = await hashRecoveryCodes(codes);
      const result = await verifyRecoveryCode('ABCD-EFGH', hashed);
      expect(result.valid).toBe(true);
      expect(result.index).toBe(0);
    });

    it('verifies code case-insensitively and without dashes', async () => {
      const codes = ['ABCD-EFGH'];
      const hashed = await hashRecoveryCodes(codes);
      const result = await verifyRecoveryCode('abcdefgh', hashed);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid code', async () => {
      const codes = ['ABCD-EFGH'];
      const hashed = await hashRecoveryCodes(codes);
      const result = await verifyRecoveryCode('XXXX-YYYY', hashed);
      expect(result.valid).toBe(false);
      expect(result.index).toBe(-1);
    });

    it('handles invalid JSON', async () => {
      const result = await verifyRecoveryCode('ABCD-EFGH', 'not-json');
      expect(result.valid).toBe(false);
    });
  });

  describe('removeRecoveryCodeAtIndex', () => {
    it('removes code at specified index', () => {
      const json = JSON.stringify(['hash1', 'hash2', 'hash3']);
      const result = removeRecoveryCodeAtIndex(json, 1);
      const parsed = JSON.parse(result);
      expect(parsed[1]).toBe('');
      expect(parsed[0]).toBe('hash1');
      expect(parsed[2]).toBe('hash3');
    });

    it('handles invalid JSON gracefully', () => {
      const result = removeRecoveryCodeAtIndex('not-json', 0);
      expect(result).toBe('not-json');
    });

    it('handles out of range index', () => {
      const json = JSON.stringify(['hash1']);
      const result = removeRecoveryCodeAtIndex(json, 5);
      expect(JSON.parse(result)).toEqual(['hash1']);
    });
  });

  describe('countRemainingRecoveryCodes', () => {
    it('counts non-empty codes', () => {
      const json = JSON.stringify(['hash1', '', 'hash3', '']);
      expect(countRemainingRecoveryCodes(json)).toBe(2);
    });

    it('returns 0 for null', () => {
      expect(countRemainingRecoveryCodes(null)).toBe(0);
    });

    it('returns 0 for invalid JSON', () => {
      expect(countRemainingRecoveryCodes('not-json')).toBe(0);
    });

    it('counts all codes when none removed', () => {
      const json = JSON.stringify(['h1', 'h2', 'h3']);
      expect(countRemainingRecoveryCodes(json)).toBe(3);
    });
  });
});

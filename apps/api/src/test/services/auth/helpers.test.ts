import { describe, it, expect, vi } from 'vitest';

vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    verifyIdToken = vi.fn();
    generateAuthUrl = vi.fn();
    getToken = vi.fn();
  }
  return { OAuth2Client: MockOAuth2Client };
});

vi.mock('../../../lib/config.js', () => ({
  config: {
    frontendUrl: 'http://localhost:3000',
    google: { clientId: 'test', clientSecret: 'test', callbackUrl: 'http://localhost:3000/auth/google/callback' },
    github: { clientId: 'test', clientSecret: 'test', callbackUrl: 'http://localhost:3000/auth/github/callback' },
  },
}));

import {
  generateVerificationCode,
  secureCompare,
  generateSlug,
  minimizeOAuthProfile,
  SALT_ROUNDS,
  VERIFICATION_CODE_EXPIRY_HOURS,
  OAUTH_STATE_EXPIRY_SECONDS,
} from '../../../services/auth/helpers.js';

describe('auth helpers', () => {
  describe('constants', () => {
    it('SALT_ROUNDS is 10', () => {
      expect(SALT_ROUNDS).toBe(10);
    });

    it('VERIFICATION_CODE_EXPIRY_HOURS is 2', () => {
      expect(VERIFICATION_CODE_EXPIRY_HOURS).toBe(2);
    });

    it('OAUTH_STATE_EXPIRY_SECONDS is 600', () => {
      expect(OAUTH_STATE_EXPIRY_SECONDS).toBe(600);
    });
  });

  describe('generateVerificationCode', () => {
    it('returns a 6-digit string', () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('returns different codes on successive calls', () => {
      const codes = new Set(Array.from({ length: 20 }, () => generateVerificationCode()));
      // With 20 random codes, we expect at least 2 unique values
      expect(codes.size).toBeGreaterThan(1);
    });

    it('code is between 100000 and 999999', () => {
      for (let i = 0; i < 50; i++) {
        const code = parseInt(generateVerificationCode(), 10);
        expect(code).toBeGreaterThanOrEqual(100000);
        expect(code).toBeLessThanOrEqual(999999);
      }
    });
  });

  describe('secureCompare', () => {
    it('returns true for equal strings', () => {
      expect(secureCompare('abc', 'abc')).toBe(true);
    });

    it('returns false for different strings of same length', () => {
      expect(secureCompare('abc', 'abd')).toBe(false);
    });

    it('returns false for different lengths', () => {
      expect(secureCompare('abc', 'abcd')).toBe(false);
    });

    it('returns true for empty strings', () => {
      expect(secureCompare('', '')).toBe(true);
    });

    it('returns false when one is empty', () => {
      expect(secureCompare('', 'a')).toBe(false);
    });
  });

  describe('generateSlug', () => {
    it('lowercases and slugifies a name', () => {
      const slug = generateSlug('My Test Org');
      expect(slug).toMatch(/^my-test-org-[a-f0-9]{8}$/);
    });

    it('removes special characters', () => {
      const slug = generateSlug('Org@Name!#$%');
      expect(slug).toMatch(/^orgname-[a-f0-9]{8}$/);
    });

    it('collapses multiple spaces and dashes', () => {
      const slug = generateSlug('org   name---test');
      expect(slug).toMatch(/^org-name-test-[a-f0-9]{8}$/);
    });

    it('trims whitespace', () => {
      const slug = generateSlug('  padded  ');
      expect(slug).toMatch(/^padded-[a-f0-9]{8}$/);
    });

    it('truncates long names to 50 chars before suffix', () => {
      const longName = 'a'.repeat(100);
      const slug = generateSlug(longName);
      // base slug (50 chars) + '-' + 8 char uuid suffix = 59
      expect(slug.length).toBeLessThanOrEqual(59);
    });

    it('generates unique slugs for same input', () => {
      const slug1 = generateSlug('Same Name');
      const slug2 = generateSlug('Same Name');
      expect(slug1).not.toBe(slug2);
    });
  });

  describe('minimizeOAuthProfile', () => {
    it('extracts only essential Google fields', () => {
      const raw = {
        sub: '123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        iss: 'accounts.google.com',
        aud: 'client-id',
        picture: 'https://example.com/photo.jpg',
        locale: 'en',
        given_name: 'Test',
        family_name: 'User',
      };
      const result = minimizeOAuthProfile(raw, 'google');
      expect(result).toEqual({
        sub: '123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        iss: 'accounts.google.com',
        aud: 'client-id',
      });
      expect(result).not.toHaveProperty('picture');
      expect(result).not.toHaveProperty('locale');
    });

    it('extracts only essential GitHub fields', () => {
      const raw = {
        id: 456,
        login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        type: 'User',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'developer',
        company: 'Acme',
      };
      const result = minimizeOAuthProfile(raw, 'github');
      expect(result).toEqual({
        id: 456,
        login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        type: 'User',
      });
      expect(result).not.toHaveProperty('avatar_url');
      expect(result).not.toHaveProperty('bio');
    });

    it('handles missing fields gracefully', () => {
      const result = minimizeOAuthProfile({}, 'google');
      expect(result).toEqual({
        sub: undefined,
        email: undefined,
        email_verified: undefined,
        name: undefined,
        iss: undefined,
        aud: undefined,
      });
    });
  });
});

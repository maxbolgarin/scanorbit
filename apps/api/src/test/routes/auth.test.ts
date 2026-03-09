import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createUser, createOrg } from '../helpers/factories.js';

// Rate limiter mocks (must use vi.hoisted for redis references)
const { mockEval, mockTtl } = vi.hoisted(() => ({
  mockEval: vi.fn().mockResolvedValue(1),
  mockTtl: vi.fn().mockResolvedValue(900),
}));

vi.mock('../../lib/redis.js', () => ({
  redis: { eval: mockEval, ttl: mockTtl, on: vi.fn() },
  twoFactorStore: {
    getChallenge: vi.fn().mockResolvedValue(null),
    deleteChallenge: vi.fn().mockResolvedValue(undefined),
    checkVerifyAttempts: vi.fn().mockResolvedValue({ allowed: true, attemptsRemaining: 5 }),
    incrementVerifyAttempts: vi.fn().mockResolvedValue(1),
    resetVerifyAttempts: vi.fn().mockResolvedValue(undefined),
  },
  refreshTokenStore: {
    store: vi.fn().mockResolvedValue(undefined),
    validate: vi.fn().mockResolvedValue(null),
    isValid: vi.fn().mockResolvedValue(true),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/ip.js', () => ({
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('../../middlewares/auth.js', () => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-id');
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));

const { mockAuthService, mockTwoFactorService } = vi.hoisted(() => ({
  mockAuthService: {
    signup: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
    switchOrg: vi.fn(),
    sendVerificationCode: vi.fn(),
    verifySignupCode: vi.fn(),
    completeSignup: vi.fn(),
    resendSignupCode: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerificationCode: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    setPassword: vi.fn(),
    updateProfile: vi.fn(),
    completeLoginAfter2FA: vi.fn(),
    generateOAuthState: vi.fn(),
    getGoogleAuthUrl: vi.fn(),
    handleGoogleCallback: vi.fn(),
    handleGoogleIdToken: vi.fn(),
    getGithubAuthUrl: vi.fn(),
    handleGithubCallback: vi.fn(),
    completeOAuthSignup: vi.fn(),
  },
  mockTwoFactorService: {
    getStatus: vi.fn(),
    initSetup: vi.fn(),
    verifyAndEnable: vi.fn(),
    disable: vi.fn(),
    verify: vi.fn(),
    verifyRecoveryCode: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
  },
}));

vi.mock('../../services/authService.js', () => ({
  authService: mockAuthService,
}));

vi.mock('../../services/twoFactorService.js', () => ({
  twoFactorService: mockTwoFactorService,
}));

vi.mock('../../lib/authTokens.js', () => ({
  setAuthTokens: vi.fn().mockResolvedValue({ accessToken: 'mock-access-token' }),
}));

vi.mock('../../lib/jwt.js', () => ({
  jwt: {
    signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
    verifyRefreshToken: vi.fn(),
  },
}));

vi.mock('../../services/listmonkService.js', () => ({
  listmonkService: {
    onUserSignup: vi.fn().mockResolvedValue(undefined),
    updateAttribsByEmail: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/dripSchedulerService.js', () => ({
  sendImmediate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

import authRoute from '../../routes/auth.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('Auth Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/auth', authRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    mockEval.mockResolvedValue(1);
    mockTtl.mockResolvedValue(900);
  });

  // ===========================================
  // Signup Flow
  // ===========================================

  describe('POST /auth/send-code', () => {
    it('sends verification code', async () => {
      mockAuthService.sendVerificationCode.mockResolvedValue({ message: 'Code sent' });

      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      });
      expect(res.status).toBe(200);
      expect(mockAuthService.sendVerificationCode).toHaveBeenCalledWith('user@example.com');
    });

    it('rejects invalid email', async () => {
      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-valid' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/verify-code', () => {
    it('verifies code and returns signup token', async () => {
      mockAuthService.verifySignupCode.mockResolvedValue({
        signupToken: 'token-123',
        message: 'Email verified',
      });

      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', code: '123456' }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.signupToken).toBe('token-123');
    });

    it('rejects wrong-length code', async () => {
      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', code: '12345' }), // 5 digits
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/complete-signup', () => {
    it('completes signup with valid data', async () => {
      const user = createUser();
      mockAuthService.completeSignup.mockResolvedValue({ user });

      const res = await app.request('/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signupToken: 'valid-token',
          password: 'SecurePass123!',
          consent: true,
        }),
      });
      expect(res.status).toBe(201);
      const body = await jsonBody(res);
      expect(body.accessToken).toBe('mock-access-token');
    });

    it('rejects without consent', async () => {
      const res = await app.request('/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signupToken: 'valid-token',
          password: 'SecurePass123!',
          consent: false,
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects short password', async () => {
      const res = await app.request('/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signupToken: 'valid-token',
          password: 'short',
          consent: true,
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ===========================================
  // Login
  // ===========================================

  describe('POST /auth/login', () => {
    it('logs in successfully', async () => {
      const user = createUser();
      const org = createOrg();
      mockAuthService.login.mockResolvedValue({ user, orgs: [org] });

      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.user).toBeDefined();
      expect(body.accessToken).toBe('mock-access-token');
    });

    it('returns 2FA challenge when enabled', async () => {
      mockAuthService.login.mockResolvedValue({
        requires2FA: true,
        challengeToken: 'challenge-123',
      });

      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.requires2FA).toBe(true);
      expect(body.challengeToken).toBe('challenge-123');
    });

    it('rejects empty password', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: '' }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ===========================================
  // Logout
  // ===========================================

  describe('POST /auth/logout', () => {
    it('logs out successfully', async () => {
      const res = await app.request('/auth/logout', { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.message).toContain('Logged out');
    });
  });

  // ===========================================
  // Refresh
  // ===========================================

  describe('POST /auth/refresh', () => {
    it('returns 401 without refresh token cookie', async () => {
      const res = await app.request('/auth/refresh', { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  // ===========================================
  // Me
  // ===========================================

  describe('GET /auth/me', () => {
    it('returns current user', async () => {
      const user = createUser({ id: 'test-user-id' });
      mockAuthService.getMe.mockResolvedValue({
        user: { id: user.id, email: user.email, fullName: user.fullName },
        orgs: [],
      });

      const res = await app.request('/auth/me');
      expect(res.status).toBe(200);
    });
  });

  // ===========================================
  // Switch Org
  // ===========================================

  describe('POST /auth/switch-org', () => {
    it('switches org', async () => {
      mockAuthService.switchOrg.mockResolvedValue(undefined);

      const res = await app.request('/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: crypto.randomUUID() }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.accessToken).toBe('mock-access-token');
    });

    it('rejects non-uuid orgId', async () => {
      const res = await app.request('/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: 'not-uuid' }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ===========================================
  // Password Reset
  // ===========================================

  describe('POST /auth/forgot-password', () => {
    it('sends password reset email', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'If an account exists, a reset email was sent',
      });

      const res = await app.request('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('resets password with valid token', async () => {
      mockAuthService.resetPassword.mockResolvedValue({ message: 'Password reset' });

      const res = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-reset-token', password: 'NewPass123!' }),
      });
      expect(res.status).toBe(200);
    });

    it('rejects short password', async () => {
      const res = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid', password: 'short' }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ===========================================
  // Change/Set Password
  // ===========================================

  describe('POST /auth/change-password', () => {
    it('changes password', async () => {
      mockAuthService.changePassword.mockResolvedValue({ message: 'Password changed' });

      const res = await app.request('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'OldPass123', newPassword: 'NewPass456!' }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/set-password', () => {
    it('sets password for OAuth user', async () => {
      mockAuthService.setPassword.mockResolvedValue({ message: 'Password set' });

      const res = await app.request('/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: 'NewPass456!' }),
      });
      expect(res.status).toBe(200);
    });
  });

  // ===========================================
  // Profile
  // ===========================================

  describe('PATCH /auth/profile', () => {
    it('updates profile', async () => {
      mockAuthService.updateProfile.mockResolvedValue({ fullName: 'New Name' });

      const res = await app.request('/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'New Name' }),
      });
      expect(res.status).toBe(200);
    });
  });

  // ===========================================
  // 2FA
  // ===========================================

  describe('GET /auth/2fa/status', () => {
    it('returns 2FA status', async () => {
      mockTwoFactorService.getStatus.mockResolvedValue({
        enabled: false,
        hasRecoveryCodes: false,
      });

      const res = await app.request('/auth/2fa/status');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/2fa/setup/init', () => {
    it('initiates 2FA setup', async () => {
      mockTwoFactorService.initSetup.mockResolvedValue({
        qrCodeUri: 'otpauth://totp/...',
        secret: 'ABCDEF',
      });

      const res = await app.request('/auth/2fa/setup/init', { method: 'POST' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/2fa/setup/verify', () => {
    it('verifies and enables 2FA', async () => {
      mockTwoFactorService.verifyAndEnable.mockResolvedValue({
        success: true,
        recoveryCodes: ['code1', 'code2'],
      });

      const res = await app.request('/auth/2fa/setup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/2fa/disable', () => {
    it('disables 2FA', async () => {
      mockTwoFactorService.disable.mockResolvedValue(undefined);

      const res = await app.request('/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'password123', code: '123456' }),
      });
      expect(res.status).toBe(200);
    });
  });

  // ===========================================
  // OAuth
  // ===========================================

  describe('POST /auth/google/token', () => {
    it('handles Google ID token exchange', async () => {
      const user = createUser();
      mockAuthService.handleGoogleIdToken.mockResolvedValue({
        user: { id: user.id, email: user.email, fullName: user.fullName },
        orgs: [],
        isNewUser: true,
        hasOrg: false,
      });

      const res = await app.request('/auth/google/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'google-id-token' }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.isNewUser).toBe(true);
    });

    it('returns consent required for new users', async () => {
      mockAuthService.handleGoogleIdToken.mockResolvedValue({
        requiresConsent: true,
        consentToken: 'consent-123',
      });

      const res = await app.request('/auth/google/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'google-id-token' }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.requiresConsent).toBe(true);
    });
  });

  describe('POST /auth/oauth/complete-signup', () => {
    it('completes OAuth signup with consent', async () => {
      mockAuthService.completeOAuthSignup.mockResolvedValue({
        userId: 'user-1',
        email: 'user@example.com',
        fullName: 'Test User',
      });

      const res = await app.request('/auth/oauth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentToken: 'consent-123',
          termsAccepted: true,
          privacyAccepted: true,
          marketingConsent: false,
        }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.isNewUser).toBe(true);
    });

    it('rejects without terms acceptance', async () => {
      const res = await app.request('/auth/oauth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentToken: 'consent-123',
          termsAccepted: false,
          privacyAccepted: true,
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ===========================================
  // Rate Limiting
  // ===========================================

  describe('Rate Limiting', () => {
    it('returns 429 when rate limited on login', async () => {
      // Simulate being over the rate limit
      mockEval.mockResolvedValue(25); // Over limit
      mockTtl.mockResolvedValue(300);

      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
      });
      expect(res.status).toBe(429);
    });
  });
});

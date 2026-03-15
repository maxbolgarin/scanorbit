import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockResendSend } = vi.hoisted(() => ({
  mockResendSend: vi.fn().mockResolvedValue({ data: { id: 'msg-123' }, error: null }),
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    frontendUrl: 'http://localhost:3000',
    bugReportEmail: 'support@scanorbit.cloud',
    email: {
      from: 'ScanOrbit <noreply@scanorbit.cloud>',
      resend: {
        apiKey: 'test-resend-key',
      },
    },
  },
}));

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: mockResendSend };
    },
  };
});

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { emailService } from '../../services/emailService.js';

describe('emailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResendSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null });
  });

  describe('sendVerificationEmail', () => {
    it('sends verification email with code', async () => {
      const result = await emailService.sendVerificationEmail('user@test.com', '123456');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockResendSend).toHaveBeenCalled();
      const call = mockResendSend.mock.calls[0][0];
      expect(call.to).toBe('user@test.com');
      expect(call.subject).toContain('Verify');
      expect(call.text).toContain('123456');
      expect(call.html).toContain('123456');
    });

    it('includes name when provided', async () => {
      const result = await emailService.sendVerificationEmail('user@test.com', '123456', 'John');
      expect(result.success).toBe(true);
      const call = mockResendSend.mock.calls[0][0];
      expect(call.text).toContain('John');
    });

    it('handles Resend API failure', async () => {
      mockResendSend.mockResolvedValue({ data: null, error: { message: 'API timeout' } });
      const result = await emailService.sendVerificationEmail('user@test.com', '123456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('API timeout');
    });

    it('handles Resend network error', async () => {
      mockResendSend.mockRejectedValue(new Error('Network error'));
      const result = await emailService.sendVerificationEmail('user@test.com', '123456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email with link', async () => {
      const result = await emailService.sendPasswordResetEmail('user@test.com', 'reset-token-123');
      expect(result.success).toBe(true);
      const call = mockResendSend.mock.calls[0][0];
      expect(call.subject).toContain('Reset');
      expect(call.html).toContain('reset-token-123');
      expect(call.text).toContain('reset-token-123');
    });

    it('includes name when provided', async () => {
      await emailService.sendPasswordResetEmail('user@test.com', 'token', 'Jane');
      const call = mockResendSend.mock.calls[0][0];
      expect(call.text).toContain('Jane');
    });
  });

  describe('sendTrialEndingEmail', () => {
    it('sends trial ending notification', async () => {
      const trialEnd = new Date('2025-12-31');
      const result = await emailService.sendTrialEndingEmail('user@test.com', trialEnd, 'pro');
      expect(result.success).toBe(true);
      const call = mockResendSend.mock.calls[0][0];
      expect(call.subject).toContain('trial');
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('sends payment failed notification', async () => {
      const result = await emailService.sendPaymentFailedEmail('user@test.com', 'pro');
      expect(result.success).toBe(true);
      const call = mockResendSend.mock.calls[0][0];
      expect(call.subject).toContain('payment failed');
    });
  });

  describe('verifyConnection', () => {
    it('verifies Resend connection', async () => {
      const result = await emailService.verifyConnection();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('resend');
    });
  });
});

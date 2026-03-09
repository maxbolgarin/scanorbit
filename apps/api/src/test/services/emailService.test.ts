import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({ messageId: 'msg-123' }),
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    frontendUrl: 'http://localhost:3000',
    email: {
      provider: 'smtp',
      from: 'noreply@scanorbit.io',
      smtp: {
        enabled: true,
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        user: 'testuser',
        pass: 'testpass',
      },
      resend: {
        apiKey: '',
      },
    },
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
      verify: vi.fn().mockResolvedValue(true),
    }),
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn(),
}));

import { emailService } from '../../services/emailService.js';

describe('emailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'msg-123' });
  });

  describe('sendVerificationEmail', () => {
    it('sends verification email with code', async () => {
      const result = await emailService.sendVerificationEmail('user@test.com', '123456');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockSendMail).toHaveBeenCalled();
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('user@test.com');
      expect(call.subject).toContain('Verify');
      expect(call.text).toContain('123456');
      expect(call.html).toContain('123456');
    });

    it('includes name when provided', async () => {
      const result = await emailService.sendVerificationEmail('user@test.com', '123456', 'John');
      expect(result.success).toBe(true);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.text).toContain('John');
    });

    it('handles SMTP failure', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP timeout'));
      const result = await emailService.sendVerificationEmail('user@test.com', '123456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP timeout');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email with link', async () => {
      const result = await emailService.sendPasswordResetEmail('user@test.com', 'reset-token-123');
      expect(result.success).toBe(true);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('Reset');
      expect(call.html).toContain('reset-token-123');
      expect(call.text).toContain('reset-token-123');
    });

    it('includes name when provided', async () => {
      await emailService.sendPasswordResetEmail('user@test.com', 'token', 'Jane');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.text).toContain('Jane');
    });
  });

  describe('sendTrialEndingEmail', () => {
    it('sends trial ending notification', async () => {
      const trialEnd = new Date('2025-12-31');
      const result = await emailService.sendTrialEndingEmail('user@test.com', trialEnd, 'pro');
      expect(result.success).toBe(true);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('trial');
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('sends payment failed notification', async () => {
      const result = await emailService.sendPaymentFailedEmail('user@test.com', 'pro');
      expect(result.success).toBe(true);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('payment failed');
    });
  });

  describe('verifyConnection', () => {
    it('verifies SMTP connection', async () => {
      const result = await emailService.verifyConnection();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('smtp');
    });
  });
});

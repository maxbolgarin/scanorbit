import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let updateResult: unknown[] = [];

const mockTransaction = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    update: vi.fn(() => createChain(updateResult)),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  pool: {},
}));

const { mockTwoFactorStore, mockTotpReplayStore } = vi.hoisted(() => ({
  mockTwoFactorStore: {
    setSetupSecret: vi.fn().mockResolvedValue(undefined),
    getSetupSecret: vi.fn().mockResolvedValue(null),
    deleteSetupSecret: vi.fn().mockResolvedValue(undefined),
    checkVerifyAttempts: vi.fn().mockResolvedValue({ allowed: true, attemptsRemaining: 5 }),
    checkAndIncrementVerifyAttempts: vi.fn().mockResolvedValue({ allowed: true, attemptsRemaining: 4 }),
    incrementVerifyAttempts: vi.fn().mockResolvedValue(1),
    resetVerifyAttempts: vi.fn().mockResolvedValue(undefined),
  },
  mockTotpReplayStore: {
    isCodeUsed: vi.fn().mockResolvedValue(false),
    markCodeUsed: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/redis.js', () => ({
  twoFactorStore: mockTwoFactorStore,
  totpReplayStore: mockTotpReplayStore,
}));

vi.mock('../../lib/totp.js', () => ({
  generateTotpSecret: vi.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateQRCodeUri: vi.fn().mockReturnValue('otpauth://totp/ScanOrbit:user@test.com?secret=JBSWY3DPEHPK3PXP'),
  verifyTotpCode: vi.fn().mockReturnValue(true),
  encryptSecret: vi.fn().mockReturnValue('encrypted-secret'),
  decryptSecret: vi.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateRecoveryCodes: vi.fn().mockReturnValue(['code1', 'code2', 'code3']),
  hashRecoveryCodes: vi.fn().mockResolvedValue(['hashed1', 'hashed2', 'hashed3']),
  verifyRecoveryCode: vi.fn().mockResolvedValue({ valid: true, index: 0 }),
  removeRecoveryCodeAtIndex: vi.fn().mockReturnValue(['hashed2', 'hashed3']),
  countRemainingRecoveryCodes: vi.fn().mockReturnValue(3),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { twoFactorService } from '../../services/twoFactorService.js';

describe('twoFactorService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    // Restore totp mocks that may have been overridden
    const totp = await import('../../lib/totp.js');
    vi.mocked(totp.verifyTotpCode).mockReturnValue(true);
    vi.mocked(totp.verifyRecoveryCode).mockResolvedValue({ valid: true, index: 0 });
    // Restore redis store mocks
    mockTwoFactorStore.checkVerifyAttempts.mockResolvedValue({ allowed: true, attemptsRemaining: 5 });
    mockTwoFactorStore.checkAndIncrementVerifyAttempts.mockResolvedValue({ allowed: true, attemptsRemaining: 4 });
    mockTwoFactorStore.getSetupSecret.mockResolvedValue(null);
    mockTotpReplayStore.isCodeUsed.mockResolvedValue(false);
    // Setup transaction mock for verifyRecoveryCode
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => createChain(selectResult) as any),
        update: vi.fn(() => createChain(updateResult) as any),
      };
      return fn(tx);
    });
  });

  describe('getStatus', () => {
    it('returns 2FA status', async () => {
      selectResult = [{ twoFactorEnabled: true, twoFactorRecoveryCodes: ['h1', 'h2'] }];
      const status = await twoFactorService.getStatus('user-1');
      expect(status.enabled).toBe(true);
      expect(status.recoveryCodesRemaining).toBe(3); // mocked countRemainingRecoveryCodes
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      await expect(twoFactorService.getStatus('missing')).rejects.toThrow('User not found');
    });
  });

  describe('initSetup', () => {
    it('generates secret and QR code', async () => {
      selectResult = [{ email: 'user@test.com', twoFactorEnabled: false }];

      const result = await twoFactorService.initSetup('user-1');
      expect(result.qrCodeUri).toContain('otpauth://');
      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(mockTwoFactorStore.setSetupSecret).toHaveBeenCalledWith('user-1', expect.any(Object));
    });

    it('throws 400 when 2FA already enabled', async () => {
      selectResult = [{ email: 'user@test.com', twoFactorEnabled: true }];
      await expect(twoFactorService.initSetup('user-1'))
        .rejects.toThrow('already enabled');
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      await expect(twoFactorService.initSetup('missing')).rejects.toThrow('User not found');
    });
  });

  describe('verifyAndEnable', () => {
    it('enables 2FA with valid code', async () => {
      mockTwoFactorStore.getSetupSecret.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeUri: 'otpauth://...',
      });

      const result = await twoFactorService.verifyAndEnable('user-1', '123456');
      expect(result.recoveryCodes).toHaveLength(3);
      expect(mockTwoFactorStore.deleteSetupSecret).toHaveBeenCalledWith('user-1');
    });

    it('throws 400 when setup session expired', async () => {
      mockTwoFactorStore.getSetupSecret.mockResolvedValue(null);
      await expect(twoFactorService.verifyAndEnable('user-1', '123456'))
        .rejects.toThrow('setup session expired');
    });

    it('throws 400 when rate limited', async () => {
      mockTwoFactorStore.getSetupSecret.mockResolvedValue({ secret: 'x', qrCodeUri: 'y' });
      mockTwoFactorStore.checkAndIncrementVerifyAttempts.mockResolvedValue({ allowed: false, attemptsRemaining: 0 });

      await expect(twoFactorService.verifyAndEnable('user-1', '123456'))
        .rejects.toThrow('Too many verification attempts');
    });

    it('throws 400 for invalid code', async () => {
      mockTwoFactorStore.getSetupSecret.mockResolvedValue({ secret: 'x', qrCodeUri: 'y' });
      mockTwoFactorStore.checkAndIncrementVerifyAttempts.mockResolvedValue({ allowed: true, attemptsRemaining: 3 });
      const { verifyTotpCode } = await import('../../lib/totp.js');
      vi.mocked(verifyTotpCode).mockReturnValue(false);

      await expect(twoFactorService.verifyAndEnable('user-1', 'wrong'))
        .rejects.toThrow('Invalid verification code');
    });
  });

  describe('verify', () => {
    it('verifies TOTP code', async () => {
      selectResult = [{ twoFactorEnabled: true, twoFactorSecret: 'encrypted' }];
      const result = await twoFactorService.verify('user-1', '123456');
      expect(result).toBe(true);
      expect(mockTotpReplayStore.markCodeUsed).toHaveBeenCalled();
    });

    it('rejects replayed code', async () => {
      selectResult = [{ twoFactorEnabled: true, twoFactorSecret: 'encrypted' }];
      mockTotpReplayStore.isCodeUsed.mockResolvedValue(true);

      const result = await twoFactorService.verify('user-1', '123456');
      expect(result).toBe(false);
    });

    it('throws 400 when 2FA not enabled', async () => {
      selectResult = [{ twoFactorEnabled: false, twoFactorSecret: null }];
      await expect(twoFactorService.verify('user-1', '123456'))
        .rejects.toThrow('not enabled');
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      await expect(twoFactorService.verify('missing', '123456'))
        .rejects.toThrow('User not found');
    });
  });

  describe('verifyRecoveryCode', () => {
    it('verifies and removes recovery code', async () => {
      selectResult = [{ twoFactorEnabled: true, twoFactorRecoveryCodes: ['h1', 'h2'] }];
      const result = await twoFactorService.verifyRecoveryCode('user-1', 'code1');
      expect(result).toBe(true);
    });

    it('returns false for invalid recovery code', async () => {
      selectResult = [{ twoFactorEnabled: true, twoFactorRecoveryCodes: ['h1'] }];
      const { verifyRecoveryCode } = await import('../../lib/totp.js');
      vi.mocked(verifyRecoveryCode).mockResolvedValue({ valid: false, index: -1 });

      const result = await twoFactorService.verifyRecoveryCode('user-1', 'wrong');
      expect(result).toBe(false);
    });

    it('throws 400 when 2FA not enabled', async () => {
      selectResult = [{ twoFactorEnabled: false, twoFactorRecoveryCodes: null }];
      await expect(twoFactorService.verifyRecoveryCode('user-1', 'code'))
        .rejects.toThrow('not enabled');
    });
  });

  describe('getRecoveryCodesCount', () => {
    it('returns remaining count', async () => {
      selectResult = [{ twoFactorRecoveryCodes: ['h1', 'h2', 'h3'] }];
      const result = await twoFactorService.getRecoveryCodesCount('user-1');
      expect(result.remaining).toBe(3);
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      await expect(twoFactorService.getRecoveryCodesCount('missing'))
        .rejects.toThrow('User not found');
    });
  });
});

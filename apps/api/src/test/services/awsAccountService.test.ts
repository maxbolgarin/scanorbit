import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];
let deleteResult: unknown[] = [];
const mockTransaction = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
    delete: vi.fn(() => createChain(deleteResult)),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  pool: {},
}));

vi.mock('../../lib/redis.js', () => ({
  redis: { rpush: vi.fn().mockResolvedValue(1), on: vi.fn(), publish: vi.fn().mockResolvedValue(0) },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/config.js', () => ({
  config: { awsRegion: 'us-east-1' },
}));

vi.mock('../../lib/metrics.js', () => ({
  scansTriggered: { inc: vi.fn() },
  jobsEnqueued: { inc: vi.fn() },
  awsAccountsConnected: { inc: vi.fn(), dec: vi.fn() },
}));

vi.mock('../../lib/crypto.js', () => ({
  encryptExternalIdOptional: vi.fn().mockReturnValue('encrypted-ext-id'),
  decryptExternalIdOptional: vi.fn().mockReturnValue('decrypted-ext-id'),
}));

vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  AssumeRoleCommand: vi.fn(),
  GetCallerIdentityCommand: vi.fn(),
}));

import { awsAccountService } from '../../services/awsAccountService.js';

describe('awsAccountService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    deleteResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    vi.mocked(db.delete).mockImplementation(() => createChain(deleteResult) as any);
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => createChain([]) as any),
        insert: vi.fn(() => createChain([]) as any),
        update: vi.fn(() => createChain([]) as any),
        delete: vi.fn(() => createChain([]) as any),
      };
      return fn(tx);
    });
  });

  describe('getAccounts', () => {
    it('returns accounts with decrypted external IDs', async () => {
      selectResult = [
        { id: 'acc-1', name: 'Production', externalId: 'encrypted' },
        { id: 'acc-2', name: 'Staging', externalId: null },
      ];
      const accounts = await awsAccountService.getAccounts('org-1');
      expect(accounts).toHaveLength(2);
    });

    it('returns empty array when no accounts', async () => {
      selectResult = [];
      const accounts = await awsAccountService.getAccounts('org-1');
      expect(accounts).toEqual([]);
    });
  });

  describe('getAccount', () => {
    it('returns account with decrypted external ID', async () => {
      selectResult = [{ id: 'acc-1', name: 'Production', orgId: 'org-1', externalId: 'encrypted' }];
      const account = await awsAccountService.getAccount('org-1', 'acc-1');
      expect(account.name).toBe('Production');
    });

    it('throws 404 when not found', async () => {
      selectResult = [];
      await expect(awsAccountService.getAccount('org-1', 'missing'))
        .rejects.toThrow('AWS account not found');
    });
  });

  describe('createAccount', () => {
    it('creates account successfully', async () => {
      const newAccount = {
        id: 'acc-new',
        name: 'Production',
        awsAccountId: '123456789012',
        roleArn: 'arn:aws:iam::123456789012:role/ScanOrbit',
        externalId: 'encrypted-ext-id',
        status: 'pending',
      };

      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => createChain([]) as any), // no existing accounts
          insert: vi.fn(() => createChain([newAccount]) as any),
          update: vi.fn(() => createChain([]) as any),
          delete: vi.fn(() => createChain([]) as any),
        };
        return fn(tx);
      });

      const account = await awsAccountService.createAccount('org-1', {
        name: 'Production',
        awsAccountId: '123456789012',
        roleArn: 'arn:aws:iam::123456789012:role/ScanOrbit',
        externalId: 'my-ext-id',
      });
      expect(account.id).toBe('acc-new');
      expect(account.status).toBe('pending');
    });

    it('throws 400 for duplicate AWS account ID', async () => {
      mockTransaction.mockImplementation(async (fn: any) => {
        let callCount = 0;
        const tx = {
          select: vi.fn(() => {
            callCount++;
            if (callCount === 1) return createChain([{ id: 'existing' }]) as any; // existing by AWS ID
            return createChain([]) as any;
          }),
          insert: vi.fn(() => createChain([]) as any),
          update: vi.fn(() => createChain([]) as any),
          delete: vi.fn(() => createChain([]) as any),
        };
        return fn(tx);
      });

      await expect(awsAccountService.createAccount('org-1', {
        name: 'New',
        awsAccountId: '123456789012',
        roleArn: 'arn:aws:iam::123456789012:role/ScanOrbit',
      })).rejects.toThrow('already connected');
    });

    it('throws 400 for duplicate name', async () => {
      mockTransaction.mockImplementation(async (fn: any) => {
        let callCount = 0;
        const tx = {
          select: vi.fn(() => {
            callCount++;
            if (callCount === 1) return createChain([]) as any; // no existing by ID
            return createChain([{ id: 'existing' }]) as any; // existing by name
          }),
          insert: vi.fn(() => createChain([]) as any),
          update: vi.fn(() => createChain([]) as any),
          delete: vi.fn(() => createChain([]) as any),
        };
        return fn(tx);
      });

      await expect(awsAccountService.createAccount('org-1', {
        name: 'Duplicate',
        awsAccountId: '123456789012',
        roleArn: 'arn:aws:iam::123456789012:role/ScanOrbit',
      })).rejects.toThrow('name already exists');
    });

    it('throws 400 for invalid AWS account ID', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      await expect(awsAccountService.createAccount('org-1', {
        name: 'Test',
        awsAccountId: 'invalid',
        roleArn: 'arn:aws:iam::123456789012:role/ScanOrbit',
      })).rejects.toThrow('Invalid AWS account ID');
    });

    it('throws 400 for invalid role ARN', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      await expect(awsAccountService.createAccount('org-1', {
        name: 'Test',
        awsAccountId: '123456789012',
        roleArn: 'invalid-arn',
      })).rejects.toThrow('Invalid role ARN');
    });
  });

  describe('deleteAccount', () => {
    it('deletes account and cancels active scans', async () => {
      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => createChain([{ id: 'acc-1' }]) as any),
          insert: vi.fn(() => createChain([]) as any),
          update: vi.fn(() => createChain([]) as any),
          delete: vi.fn(() => createChain([]) as any),
        };
        return fn(tx);
      });
      await awsAccountService.deleteAccount('org-1', 'acc-1');
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('throws 404 when account not found', async () => {
      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => createChain([]) as any),
          insert: vi.fn(() => createChain([]) as any),
          update: vi.fn(() => createChain([]) as any),
          delete: vi.fn(() => createChain([]) as any),
        };
        return fn(tx);
      });
      await expect(awsAccountService.deleteAccount('org-1', 'missing'))
        .rejects.toThrow('AWS account not found');
    });
  });

  describe('updateEnabledScanners', () => {
    it('updates enabled scanners', async () => {
      // getAccount returns the account, then update returns updated
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return createChain([{ id: 'acc-1', name: 'Test', orgId: 'org-1', externalId: null }]) as any;
      });
      updateResult = [{ id: 'acc-1', enabledScanners: ['ec2', 'rds'], externalId: null }];

      const account = await awsAccountService.updateEnabledScanners('org-1', 'acc-1', ['ec2', 'rds'] as any);
      expect(account.id).toBe('acc-1');
    });

    it('throws 404 when account not found', async () => {
      selectResult = [];
      await expect(awsAccountService.updateEnabledScanners('org-1', 'missing', []))
        .rejects.toThrow('AWS account not found');
    });
  });

  describe('getScan', () => {
    it('returns scan', async () => {
      selectResult = [{ id: 'scan-1', status: 'complete', orgId: 'org-1' }];
      const scan = await awsAccountService.getScan('org-1', 'scan-1');
      expect(scan.status).toBe('complete');
    });

    it('throws 404 when not found', async () => {
      selectResult = [];
      await expect(awsAccountService.getScan('org-1', 'missing'))
        .rejects.toThrow('Scan not found');
    });
  });

  describe('getActiveScans', () => {
    it('returns active scans', async () => {
      selectResult = [
        { id: 'scan-1', status: 'running' },
        { id: 'scan-2', status: 'queued' },
      ];
      const scans = await awsAccountService.getActiveScans('org-1');
      expect(scans).toHaveLength(2);
    });

    it('returns empty when no active scans', async () => {
      selectResult = [];
      const scans = await awsAccountService.getActiveScans('org-1');
      expect(scans).toEqual([]);
    });
  });

  describe('getRecentScans', () => {
    it('returns recent scans', async () => {
      selectResult = [{ id: 'scan-1', status: 'complete' }];
      const scans = await awsAccountService.getRecentScans('org-1');
      expect(scans).toHaveLength(1);
    });

    it('returns recent scans with custom limit', async () => {
      selectResult = [];
      const scans = await awsAccountService.getRecentScans('org-1', 5);
      expect(scans).toEqual([]);
    });
  });

  describe('getScanHistory', () => {
    it('returns scan history for account', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ id: 'acc-1', orgId: 'org-1', externalId: null }]) as any; // getAccount
        return createChain([{ id: 'scan-1' }, { id: 'scan-2' }]) as any;
      });

      const history = await awsAccountService.getScanHistory('org-1', 'acc-1');
      expect(history).toHaveLength(2);
    });

    it('throws 404 when account not found', async () => {
      selectResult = [];
      await expect(awsAccountService.getScanHistory('org-1', 'missing'))
        .rejects.toThrow('AWS account not found');
    });
  });
});

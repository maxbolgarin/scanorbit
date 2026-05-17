import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let deleteResult: unknown[] = [];

let executeRowCount = 0;

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    delete: vi.fn(() => createChain(deleteResult)),
    update: vi.fn(() => createChain([])),
    execute: vi.fn(() => Promise.resolve({ rowCount: executeRowCount })),
  },
  pool: {},
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    retentionResourcesDays: 90,
    retentionFindingsResolvedDays: 180,
    retentionScansDays: 365,
    retentionAuditLogsDays: 730,
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { runRetentionCleanup, getRetentionStats } from '../../services/retentionService.js';

describe('retentionService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    deleteResult = [];
    executeRowCount = 0;
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.delete).mockImplementation(() => createChain(deleteResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain([]) as any);
    vi.mocked(db.execute).mockImplementation(() => Promise.resolve({ rowCount: executeRowCount }) as any);
  });

  describe('runRetentionCleanup', () => {
    it('runs all cleanup tasks', async () => {
      const { db } = await import('../../lib/db.js');

      // Resources/findings/audit logs use db.delete returning rows
      vi.mocked(db.delete).mockImplementation(() =>
        createChain([{ id: 'item-1' }]) as any
      );
      // Scans uses db.execute
      vi.mocked(db.execute).mockImplementation(() =>
        Promise.resolve({ rowCount: 1 }) as any
      );

      const result = await runRetentionCleanup();
      expect(result.resourcesDeleted).toBe(1);
      expect(result.findingsDeleted).toBe(1);
      expect(result.scansDeleted).toBe(1);
      expect(result.auditLogsArchived).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('captures errors without failing entire job', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.execute).mockImplementation(() => {
        throw new Error('DB error');
      });
      vi.mocked(db.delete).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await runRetentionCleanup();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getRetentionStats', () => {
    it('returns retention statistics', async () => {
      selectResult = [{ count: 5 }];

      const stats = await getRetentionStats();
      expect(stats).toHaveProperty('staleResources');
      expect(stats).toHaveProperty('oldFindings');
      expect(stats).toHaveProperty('oldAuditLogs');
    });
  });
});

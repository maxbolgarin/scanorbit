import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];

// Transaction-aware mock: db.transaction(async (tx) => { ... }) passes tx with same methods
const createTxMock = () => ({
  select: vi.fn(() => createChain(selectResult)),
  insert: vi.fn(() => createChain(insertResult)),
  update: vi.fn(() => createChain(updateResult)),
});

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
    transaction: vi.fn(async (fn: (tx: ReturnType<typeof createTxMock>) => Promise<unknown>) => {
      const tx = createTxMock();
      return fn(tx);
    }),
  },
  pool: {},
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { recoverStuckJobs } from '../../services/stuckJobService.js';

describe('stuckJobService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    // Reset transaction mock to use current selectResult/insertResult/updateResult
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => createChain(selectResult)),
        insert: vi.fn(() => createChain(insertResult)),
        update: vi.fn(() => createChain(updateResult)),
      };
      return fn(tx);
    });
  });

  describe('recoverStuckJobs', () => {
    it('returns zero counts when no stuck jobs', async () => {
      selectResult = [];

      const result = await recoverStuckJobs();
      expect(result.stuckJobsRecovered).toBe(0);
      expect(result.stuckScansErrored).toBe(0);
      expect(result.jobsMovedToDLQ).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('recovers stuck job with low recovery count', async () => {
      const { db } = await import('../../lib/db.js');

      // Transaction mock: tx.select returns stuck job
      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => createChain([{
            id: 'job-1',
            scanId: 'scan-1',
            type: 'scan_account',
            payload: {},
            recoveryCount: 0,
            startedAt: new Date(Date.now() - 3600000),
          }])),
          insert: vi.fn(() => createChain([])),
          update: vi.fn(() => createChain([])),
        };
        return fn(tx);
      });

      // Orphaned scans query (outside transaction) returns empty
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      const result = await recoverStuckJobs();
      expect(result.stuckJobsRecovered).toBe(1);
    });

    it('moves job to DLQ after max recovery attempts', async () => {
      const { db } = await import('../../lib/db.js');

      // Transaction mock: tx.select returns job at max recovery count
      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => createChain([{
            id: 'job-1',
            scanId: 'scan-1',
            type: 'scan_account',
            payload: {},
            recoveryCount: 3,
            startedAt: new Date(Date.now() - 3600000),
          }])),
          insert: vi.fn(() => createChain([])),
          update: vi.fn(() => createChain([])),
        };
        return fn(tx);
      });

      // Orphaned scans query returns empty
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      const result = await recoverStuckJobs();
      expect(result.jobsMovedToDLQ).toBe(1);
      expect(result.stuckScansErrored).toBe(1);
    });

    it('handles orphaned scans', async () => {
      const { db } = await import('../../lib/db.js');

      // Transaction: no stuck jobs
      vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
        const tx = {
          select: vi.fn(() => createChain([])),
          insert: vi.fn(() => createChain([])),
          update: vi.fn(() => createChain([])),
        };
        return fn(tx);
      });

      // Orphaned scans query returns one orphaned scan
      vi.mocked(db.select).mockImplementation(() => createChain([{
        id: 'scan-1',
        status: 'running',
        createdAt: new Date(Date.now() - 3600000),
      }]) as any);

      const result = await recoverStuckJobs();
      expect(result.stuckScansErrored).toBe(1);
    });

    it('captures errors without failing', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.transaction).mockRejectedValue(new Error('DB error'));

      const result = await recoverStuckJobs();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

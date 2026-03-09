import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
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
  });

  describe('recoverStuckJobs', () => {
    it('returns zero counts when no stuck jobs', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      const result = await recoverStuckJobs();
      expect(result.stuckJobsRecovered).toBe(0);
      expect(result.stuckScansErrored).toBe(0);
      expect(result.jobsMovedToDLQ).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('recovers stuck job with low recovery count', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // stuck running jobs
          return createChain([{
            id: 'job-1',
            scanId: 'scan-1',
            type: 'scan_account',
            payload: {},
            recoveryCount: 0,
            startedAt: new Date(Date.now() - 3600000), // 1 hour ago
          }]) as any;
        }
        // orphaned scans query returns empty
        return createChain([]) as any;
      });

      const result = await recoverStuckJobs();
      expect(result.stuckJobsRecovered).toBe(1);
      expect(db.update).toHaveBeenCalled();
    });

    it('moves job to DLQ after max recovery attempts', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{
            id: 'job-1',
            scanId: 'scan-1',
            type: 'scan_account',
            payload: {},
            recoveryCount: 3, // MAX_RECOVERY_COUNT
            startedAt: new Date(Date.now() - 3600000),
          }]) as any;
        }
        return createChain([]) as any;
      });

      const result = await recoverStuckJobs();
      expect(result.jobsMovedToDLQ).toBe(1);
      expect(result.stuckScansErrored).toBe(1);
      expect(db.insert).toHaveBeenCalled(); // dead letter insert
    });

    it('handles orphaned scans', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([]) as any; // no stuck jobs
        if (callCount === 2) {
          // orphaned scans
          return createChain([{
            id: 'scan-1',
            status: 'running',
            createdAt: new Date(Date.now() - 3600000),
          }]) as any;
        }
        // active job check: no active job
        return createChain([]) as any;
      });

      const result = await recoverStuckJobs();
      expect(result.stuckScansErrored).toBe(1);
    });

    it('captures errors without failing', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await recoverStuckJobs();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

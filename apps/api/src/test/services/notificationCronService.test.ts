import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];

const { mockRedis, mockWebhookDeliveryService } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    status: 'ready',
  },
  mockWebhookDeliveryService: {
    enqueueDelivery: vi.fn().mockResolvedValue('delivery-id-1'),
    startDeliveryWorker: vi.fn(),
  },
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
  },
  pool: {},
}));

vi.mock('../../lib/redis.js', () => ({
  redis: mockRedis,
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/webhookDeliveryService.js', () => ({
  webhookDeliveryService: mockWebhookDeliveryService,
}));

vi.mock('../../db/schema.js', () => ({
  scans: {
    id: 'id',
    orgId: 'org_id',
    awsAccountId: 'aws_account_id',
    status: 'status',
    completedAt: 'completed_at',
    resourcesDiscovered: 'resources_discovered',
    findingsNew: 'findings_new',
    findingsResolved: 'findings_resolved',
  },
  findings: {
    id: 'id',
    orgId: 'org_id',
    lastScanId: 'last_scan_id',
    severity: 'severity',
    firstDetectedAt: 'first_detected_at',
    lastDetectedAt: 'last_detected_at',
    type: 'type',
    summary: 'summary',
    resourceId: 'resource_id',
  },
  orgWebhooks: {
    id: 'id',
    orgId: 'org_id',
    isActive: 'is_active',
    eventTypes: 'event_types',
    url: 'url',
    secret: 'secret',
  },
}));

import {
  startNotificationCron,
  processNotifications,
  dispatchScanCompleted,
  dispatchNewFindings,
} from '../../services/notificationCronService.js';

const makeScan = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'scan-1',
  orgId: 'org-1',
  awsAccountId: 'aws-account-1',
  status: 'complete',
  resourcesDiscovered: 10,
  findingsNew: 2,
  findingsResolved: 1,
  completedAt: new Date(),
  hasKey: true,
  resourcesDelta: 0,
  errorMessage: null,
  createdAt: new Date(),
  ...overrides,
});

const makeWebhook = (eventTypes: string[], overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'webhook-1',
  orgId: 'org-1',
  url: 'https://example.com/webhook',
  secret: 'encrypted-secret',
  eventTypes,
  isActive: true,
  description: null,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeFinding = (severity: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  id: `finding-${severity}-1`,
  orgId: 'org-1',
  awsAccountId: 'aws-account-1',
  resourceId: 'resource-1',
  certificateId: null,
  type: 'public_access',
  severity,
  summary: `${severity} finding`,
  details: {},
  status: 'open',
  resolvedAt: null,
  snoozedUntil: null,
  firstDetectedAt: new Date(),
  lastDetectedAt: new Date(),
  detectionCount: 1,
  lastScanId: 'scan-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('notificationCronService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockWebhookDeliveryService.enqueueDelivery.mockResolvedValue('delivery-id-1');

    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
  });

  describe('startNotificationCron', () => {
    it('registers a setInterval with 60s interval', () => {
      const spy = vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startNotificationCron();

      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
      spy.mockRestore();
    });

    it('acquires distributed lock before processing', async () => {
      const spy = vi.spyOn(global, 'setInterval').mockImplementation((fn) => {
        // Invoke the callback immediately to test lock acquisition
        (fn as () => void)();
        return 0 as any;
      });

      startNotificationCron();

      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalledWith('notif:cron:lock', '1', 'EX', 55, 'NX');
      });

      spy.mockRestore();
    });

    it('skips processing when lock not acquired', async () => {
      mockRedis.set.mockResolvedValue(null); // Lock not acquired

      const spy = vi.spyOn(global, 'setInterval').mockImplementation((fn) => {
        (fn as () => void)();
        return 0 as any;
      });

      startNotificationCron();

      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalledWith('notif:cron:lock', '1', 'EX', 55, 'NX');
      });

      // enqueueDelivery should not be called because lock was not acquired
      expect(mockWebhookDeliveryService.enqueueDelivery).not.toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  describe('processNotifications', () => {
    it('finds completed scans and dispatches webhooks', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();
      const webhook = makeWebhook(['scan.completed']);

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Query for completed scans
          return createChain([scan]) as any;
        }
        if (callCount === 2) {
          // Query for active webhooks (dispatchScanCompleted)
          return createChain([webhook]) as any;
        }
        if (callCount === 3) {
          // Query for new findings
          return createChain([]) as any;
        }
        return createChain([]) as any;
      });

      await processNotifications();

      // Should set dedup key for the scan
      expect(mockRedis.set).toHaveBeenCalledWith('notif:scan:scan-1', '1', 'EX', 86400, 'NX');

      // Should enqueue delivery for scan.completed
      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledWith(
        'webhook-1',
        'scan.completed',
        expect.objectContaining({ event: 'scan.completed' }),
      );
    });

    it('skips already-processed scans via Redis dedup', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();

      // Return the scan from the completed scans query
      vi.mocked(db.select).mockImplementation(() => createChain([scan]) as any);

      // Dedup check: redis.set returns null = key already exists (already processed)
      mockRedis.set.mockResolvedValue(null);

      await processNotifications();

      // Should NOT enqueue any deliveries because this scan was already processed
      expect(mockWebhookDeliveryService.enqueueDelivery).not.toHaveBeenCalled();
    });

    it('processes multiple completed scans', async () => {
      const { db } = await import('../../lib/db.js');

      const scan1 = makeScan({ id: 'scan-1' });
      const scan2 = makeScan({ id: 'scan-2' });
      const webhook = makeWebhook(['scan.completed']);

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Completed scans
          return createChain([scan1, scan2]) as any;
        }
        // Return webhook for each scan's dispatchScanCompleted call, empty for findings
        if (callCount % 2 === 0) {
          return createChain([webhook]) as any;
        }
        return createChain([]) as any;
      });

      await processNotifications();

      expect(mockRedis.set).toHaveBeenCalledWith('notif:scan:scan-1', '1', 'EX', 86400, 'NX');
      expect(mockRedis.set).toHaveBeenCalledWith('notif:scan:scan-2', '1', 'EX', 86400, 'NX');
    });
  });

  describe('dispatchScanCompleted', () => {
    it('enqueues delivery only for webhooks subscribed to scan.completed', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();
      const subscribedWebhook = makeWebhook(['scan.completed', 'finding.new_critical']);
      const unsubscribedWebhook = makeWebhook(['finding.new_high'], { id: 'webhook-2' });

      vi.mocked(db.select).mockImplementation(() =>
        createChain([subscribedWebhook, unsubscribedWebhook]) as any,
      );

      await dispatchScanCompleted(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledTimes(1);
      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledWith(
        'webhook-1',
        'scan.completed',
        expect.objectContaining({
          event: 'scan.completed',
          data: expect.objectContaining({
            scanId: 'scan-1',
            orgId: 'org-1',
          }),
        }),
      );
    });

    it('does not enqueue when no webhooks subscribed to scan.completed', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();
      const webhook = makeWebhook(['finding.new_critical']);

      vi.mocked(db.select).mockImplementation(() => createChain([webhook]) as any);

      await dispatchScanCompleted(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).not.toHaveBeenCalled();
    });

    it('does not enqueue when no active webhooks exist', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();

      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      await dispatchScanCompleted(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).not.toHaveBeenCalled();
    });

    it('includes all scan fields in payload', async () => {
      const { db } = await import('../../lib/db.js');

      const completedAt = new Date('2026-04-01T12:00:00Z');
      const scan = makeScan({
        id: 'scan-abc',
        orgId: 'org-xyz',
        awsAccountId: 'aws-123',
        resourcesDiscovered: 42,
        findingsNew: 5,
        findingsResolved: 3,
        completedAt,
      });
      const webhook = makeWebhook(['scan.completed']);

      vi.mocked(db.select).mockImplementation(() => createChain([webhook]) as any);

      await dispatchScanCompleted(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledWith(
        'webhook-1',
        'scan.completed',
        expect.objectContaining({
          data: expect.objectContaining({
            scanId: 'scan-abc',
            orgId: 'org-xyz',
            awsAccountId: 'aws-123',
            resourcesDiscovered: 42,
            findingsNew: 5,
            findingsResolved: 3,
            completedAt: completedAt.toISOString(),
          }),
        }),
      );
    });
  });

  describe('dispatchNewFindings', () => {
    it('detects new critical findings and dispatches finding.new_critical event', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();
      const criticalFinding = makeFinding('critical');
      const webhook = makeWebhook(['finding.new_critical']);

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // new findings query
          return createChain([criticalFinding]) as any;
        }
        if (callCount === 2) {
          // active webhooks query
          return createChain([webhook]) as any;
        }
        return createChain([]) as any;
      });

      await dispatchNewFindings(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledWith(
        'webhook-1',
        'finding.new_critical',
        expect.objectContaining({
          event: 'finding.new_critical',
          data: expect.objectContaining({
            scanId: 'scan-1',
            orgId: 'org-1',
            count: 1,
            findings: expect.arrayContaining([
              expect.objectContaining({
                id: 'finding-critical-1',
                severity: 'critical',
              }),
            ]),
          }),
        }),
      );
    });

    it('detects new high findings and dispatches finding.new_high event', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();
      const highFinding = makeFinding('high');
      const webhook = makeWebhook(['finding.new_high']);

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // new findings query
          return createChain([highFinding]) as any;
        }
        if (callCount === 2) {
          // active webhooks query
          return createChain([webhook]) as any;
        }
        return createChain([]) as any;
      });

      await dispatchNewFindings(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledWith(
        'webhook-1',
        'finding.new_high',
        expect.objectContaining({
          event: 'finding.new_high',
          data: expect.objectContaining({
            count: 1,
            findings: expect.arrayContaining([
              expect.objectContaining({ severity: 'high' }),
            ]),
          }),
        }),
      );
    });

    it('dispatches both critical and high events when both are present', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();
      const criticalFinding = makeFinding('critical', { id: 'finding-crit' });
      const highFinding = makeFinding('high', { id: 'finding-high' });
      const webhook = makeWebhook(['finding.new_critical', 'finding.new_high']);

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // new findings query — both critical and high
          return createChain([criticalFinding, highFinding]) as any;
        }
        // active webhooks queries (called once per severity type)
        return createChain([webhook]) as any;
      });

      await dispatchNewFindings(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledTimes(2);
      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledWith(
        'webhook-1', 'finding.new_critical', expect.any(Object),
      );
      expect(mockWebhookDeliveryService.enqueueDelivery).toHaveBeenCalledWith(
        'webhook-1', 'finding.new_high', expect.any(Object),
      );
    });

    it('does nothing when no new critical/high findings', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();

      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      await dispatchNewFindings(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).not.toHaveBeenCalled();
    });

    it('does not dispatch finding.new_critical when webhook not subscribed to it', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();
      const criticalFinding = makeFinding('critical');
      // Webhook only subscribes to scan.completed, not finding.new_critical
      const webhook = makeWebhook(['scan.completed']);

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([criticalFinding]) as any;
        }
        return createChain([webhook]) as any;
      });

      await dispatchNewFindings(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).not.toHaveBeenCalled();
    });

    it('does not dispatch finding.new_high when webhook not subscribed to it', async () => {
      const { db } = await import('../../lib/db.js');

      const scan = makeScan();
      const highFinding = makeFinding('high');
      const webhook = makeWebhook(['scan.completed']);

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([highFinding]) as any;
        }
        return createChain([webhook]) as any;
      });

      await dispatchNewFindings(scan as any);

      expect(mockWebhookDeliveryService.enqueueDelivery).not.toHaveBeenCalled();
    });
  });
});

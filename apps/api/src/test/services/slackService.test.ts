import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain, createMockDb } from '../helpers/mockDb.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let deleteResult: unknown[] = [];

// Use vi.hoisted() so mockDb is available when vi.mock() factory is hoisted
const { mockDb } = vi.hoisted(() => {
  const createBasicChain = (val: unknown[] = []) => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select', 'insert', 'update', 'delete', 'from', 'where', 'set', 'values',
      'returning', 'limit', 'offset', 'orderBy', 'groupBy', 'innerJoin', 'leftJoin',
      'rightJoin', 'fullJoin', 'having', 'as', 'onConflictDoNothing', 'onConflictDoUpdate', 'for',
    ];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (resolve: (v: unknown) => unknown) => resolve(val);
    return chain;
  };

  const db = {
    select: vi.fn(() => createBasicChain()),
    insert: vi.fn(() => createBasicChain()),
    update: vi.fn(() => createBasicChain()),
    delete: vi.fn(() => createBasicChain()),
    selectDistinct: vi.fn(() => createBasicChain()),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };

  return { mockDb: db };
});

vi.mock('../../lib/db.js', () => ({ db: mockDb }));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/crypto.js', () => ({
  encryptOAuthToken: vi.fn((v: string) => `encrypted:${v}`),
  decryptOAuthToken: vi.fn((v: string) => v.replace('encrypted:', '')),
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    slack: {
      clientId: 'test-slack-client-id',
      clientSecret: 'test-slack-client-secret',
      signingSecret: 'test-slack-signing-secret',
    },
    frontendUrl: 'http://localhost:3000',
  },
}));

// ---------------------------------------------------------------------------
// Subject under test — import AFTER mocks
// ---------------------------------------------------------------------------
import { slackService } from '../../services/slackService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeIntegration = (overrides: Record<string, unknown> = {}) => ({
  id: 'integration-1',
  orgId: 'org-1',
  teamId: 'T12345',
  teamName: 'Test Team',
  accessToken: 'encrypted:xoxb-test-token',
  botUserId: 'U12345',
  installedBy: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const makeMapping = (overrides: Record<string, unknown> = {}) => ({
  id: 'mapping-1',
  slackIntegrationId: 'integration-1',
  eventType: 'scan.completed',
  channelId: 'C12345',
  channelName: 'general',
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('slackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    deleteResult = [];

    mockDb.select.mockImplementation(() => createChain(selectResult) as any);
    mockDb.insert.mockImplementation(() => createChain(insertResult) as any);
    mockDb.update.mockImplementation(() => createChain([]) as any);
    mockDb.delete.mockImplementation(() => createChain(deleteResult) as any);
    mockDb.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof createMockDb>) => Promise<unknown>) => {
      const tx = createMockDb();
      return fn(tx);
    });
  });

  // -------------------------------------------------------------------------
  // getOAuthUrl
  // -------------------------------------------------------------------------

  describe('getOAuthUrl', () => {
    it('returns correct Slack OAuth authorize URL with expected scopes and state', () => {
      const url = slackService.getOAuthUrl('org-1');

      expect(url).toContain('https://slack.com/oauth/v2/authorize');
      expect(url).toContain('client_id=test-slack-client-id');
      expect(url).toContain('chat%3Awrite');
      expect(url).toContain('channels%3Aread');
      expect(url).toContain('groups%3Aread');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=');

      // Decode state and verify it contains orgId
      const stateParam = new URL(url).searchParams.get('state');
      expect(stateParam).not.toBeNull();
      const decoded = JSON.parse(Buffer.from(stateParam!, 'base64url').toString());
      expect(decoded).toEqual({ orgId: 'org-1' });
    });

    it('uses frontendUrl for redirect_uri', () => {
      const url = slackService.getOAuthUrl('org-1');
      expect(url).toContain(encodeURIComponent('http://localhost:3000/integrations/slack/callback'));
    });
  });

  // -------------------------------------------------------------------------
  // handleOAuthCallback
  // -------------------------------------------------------------------------

  describe('handleOAuthCallback', () => {
    it('exchanges code for token, encrypts it, and stores in DB', async () => {
      const mockOAuthResponse = {
        ok: true,
        access_token: 'xoxb-real-token',
        team: { id: 'T12345', name: 'Test Team' },
        bot_user_id: 'U12345',
      };

      const integration = makeIntegration();
      insertResult = [integration];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockOAuthResponse),
      }));

      const { encryptOAuthToken } = await import('../../lib/crypto.js');

      const result = await slackService.handleOAuthCallback('auth-code', 'org-1', 'user-1');

      // fetch was called with slack OAuth endpoint
      const mockFetch = vi.mocked(fetch);
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://slack.com/api/oauth.v2.access');

      // token was encrypted
      expect(encryptOAuthToken).toHaveBeenCalledWith('xoxb-real-token');

      // result is the integration record
      expect(result).toEqual(integration);

      vi.unstubAllGlobals();
    });

    it('throws when Slack OAuth returns ok=false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: false, error: 'invalid_code' }),
      }));

      await expect(
        slackService.handleOAuthCallback('bad-code', 'org-1', 'user-1')
      ).rejects.toThrow('Slack OAuth failed: invalid_code');

      vi.unstubAllGlobals();
    });
  });

  // -------------------------------------------------------------------------
  // getIntegration
  // -------------------------------------------------------------------------

  describe('getIntegration', () => {
    it('returns integration when it exists', async () => {
      const integration = makeIntegration();
      selectResult = [integration];

      const result = await slackService.getIntegration('org-1');
      expect(result).toEqual(integration);
    });

    it('returns null when no integration exists', async () => {
      selectResult = [];

      const result = await slackService.getIntegration('org-1');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // listChannels
  // -------------------------------------------------------------------------

  describe('listChannels', () => {
    it('decrypts token, calls Slack API, and returns formatted channels', async () => {
      const integration = makeIntegration();
      selectResult = [integration];

      const mockChannelsResponse = {
        ok: true,
        channels: [
          { id: 'C001', name: 'general', is_private: false },
          { id: 'C002', name: 'private-team', is_private: true },
        ],
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockChannelsResponse),
      }));

      const { decryptOAuthToken } = await import('../../lib/crypto.js');

      const result = await slackService.listChannels('org-1');

      // token was decrypted
      expect(decryptOAuthToken).toHaveBeenCalledWith('encrypted:xoxb-test-token');

      // fetch was called with correct auth header
      const mockFetch = vi.mocked(fetch);
      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer xoxb-test-token');

      // channels are mapped correctly
      expect(result).toEqual([
        { id: 'C001', name: 'general', isPrivate: false },
        { id: 'C002', name: 'private-team', isPrivate: true },
      ]);

      vi.unstubAllGlobals();
    });

    it('throws 404 when no integration exists', async () => {
      selectResult = [];

      await expect(slackService.listChannels('org-1')).rejects.toThrow('Slack integration not found');
    });

    it('throws when Slack API returns ok=false', async () => {
      const integration = makeIntegration();
      selectResult = [integration];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: false, error: 'not_authed' }),
      }));

      await expect(slackService.listChannels('org-1')).rejects.toThrow('Slack API error: not_authed');

      vi.unstubAllGlobals();
    });
  });

  // -------------------------------------------------------------------------
  // sendMessage
  // -------------------------------------------------------------------------

  describe('sendMessage', () => {
    it('sends message with correct authorization header and body', async () => {
      const integration = makeIntegration();
      selectResult = [integration];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: true }),
      }));

      await slackService.sendMessage('org-1', 'C12345', 'Hello world');

      const mockFetch = vi.mocked(fetch);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://slack.com/api/chat.postMessage');
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer xoxb-test-token');
      expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body as string);
      expect(body.channel).toBe('C12345');
      expect(body.text).toBe('Hello world');

      vi.unstubAllGlobals();
    });

    it('includes blocks when provided', async () => {
      const integration = makeIntegration();
      selectResult = [integration];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: true }),
      }));

      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } }];
      await slackService.sendMessage('org-1', 'C12345', 'Hello', blocks);

      const mockFetch = vi.mocked(fetch);
      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.blocks).toEqual(blocks);

      vi.unstubAllGlobals();
    });

    it('silently returns when no integration exists', async () => {
      selectResult = [];

      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await slackService.sendMessage('org-1', 'C12345', 'Hello');

      expect(mockFetch).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('logs error when Slack API returns ok=false', async () => {
      const integration = makeIntegration();
      selectResult = [integration];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: false, error: 'channel_not_found' }),
      }));

      const { logger } = await import('../../lib/logger.js');

      // Should not throw
      await expect(slackService.sendMessage('org-1', 'C12345', 'Hello')).resolves.toBeUndefined();
      expect(vi.mocked(logger.error)).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  // -------------------------------------------------------------------------
  // sendNotification
  // -------------------------------------------------------------------------

  describe('sendNotification', () => {
    it('looks up channel mappings and sends to each matched channel', async () => {
      const integration = makeIntegration();
      const mapping = makeMapping({ channelId: 'C-scan', channelName: 'scan-results' });

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([integration]) as any; // getIntegration for sendNotification
        if (selectCallCount === 2) return createChain([mapping]) as any;      // channel mappings query
        return createChain([integration]) as any; // getIntegration inside sendMessage
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: true }),
      }));

      await slackService.sendNotification('org-1', 'scan.completed', {
        data: { resourcesDiscovered: 42, findingsNew: 3 },
      });

      const mockFetch = vi.mocked(fetch);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.channel).toBe('C-scan');
      expect(body.text).toContain('42 resources');
      expect(body.text).toContain('3 new findings');

      vi.unstubAllGlobals();
    });

    it('silently returns when no integration exists', async () => {
      selectResult = [];

      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await slackService.sendNotification('org-1', 'scan.completed', {});

      expect(mockFetch).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('sends to multiple channels when multiple mappings exist', async () => {
      const integration = makeIntegration();
      const mappings = [
        makeMapping({ id: 'mapping-1', channelId: 'C001' }),
        makeMapping({ id: 'mapping-2', channelId: 'C002' }),
      ];

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([integration]) as any; // getIntegration for sendNotification
        if (selectCallCount === 2) return createChain(mappings) as any;       // channel mappings
        return createChain([integration]) as any; // getIntegration inside each sendMessage
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: true }),
      }));

      await slackService.sendNotification('org-1', 'scan.completed', { data: {} });

      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);

      vi.unstubAllGlobals();
    });

    it('formats finding.new_critical notification correctly', async () => {
      const integration = makeIntegration();
      const mapping = makeMapping({ eventType: 'finding.new_critical' });

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([integration]) as any;
        if (selectCallCount === 2) return createChain([mapping]) as any;
        return createChain([integration]) as any;
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ ok: true }),
      }));

      await slackService.sendNotification('org-1', 'finding.new_critical', { data: { count: 5 } });

      const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.text).toContain('5 new critical findings');

      vi.unstubAllGlobals();
    });
  });

  // -------------------------------------------------------------------------
  // updateChannelMappings
  // -------------------------------------------------------------------------

  describe('updateChannelMappings', () => {
    it('deletes old mappings and inserts new ones in a transaction', async () => {
      const integration = makeIntegration();
      selectResult = [integration];

      const newMappings = [
        { eventType: 'scan.completed', channelId: 'C001', channelName: 'general' },
        { eventType: 'finding.new_critical', channelId: 'C002', channelName: 'alerts' },
      ];

      const insertedMappings = newMappings.map((m, i) => makeMapping({ id: `mapping-${i + 1}`, ...m }));

      mockDb.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof createMockDb>) => Promise<unknown>) => {
        const tx = createMockDb();
        tx.insert.mockImplementation(() => createChain(insertedMappings) as any);
        return fn(tx);
      });

      const result = await slackService.updateChannelMappings('org-1', newMappings);

      expect(mockDb.transaction).toHaveBeenCalledOnce();
      expect(result).toEqual(insertedMappings);
    });

    it('returns empty array when mappings list is empty', async () => {
      const integration = makeIntegration();
      selectResult = [integration];

      mockDb.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof createMockDb>) => Promise<unknown>) => {
        const tx = createMockDb();
        return fn(tx);
      });

      const result = await slackService.updateChannelMappings('org-1', []);
      expect(result).toEqual([]);
    });

    it('throws 404 when no integration exists', async () => {
      selectResult = [];

      await expect(
        slackService.updateChannelMappings('org-1', [
          { eventType: 'scan.completed', channelId: 'C001', channelName: 'general' },
        ])
      ).rejects.toThrow('Slack integration not found');
    });
  });

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------

  describe('disconnect', () => {
    it('deletes the integration (channel mappings cascade-deleted by DB)', async () => {
      deleteResult = [{ id: 'integration-1' }];

      await slackService.disconnect('org-1');

      expect(mockDb.delete).toHaveBeenCalledOnce();
    });

    it('resolves without error even when no integration exists', async () => {
      deleteResult = [];

      await expect(slackService.disconnect('org-1')).resolves.toBeUndefined();
    });
  });
});

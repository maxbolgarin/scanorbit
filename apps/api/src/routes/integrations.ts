import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { requireOrgId } from '../middlewares/requireOrgId.js';
import { webhookService } from '../services/webhookService.js';
import { notificationPreferenceService } from '../services/notificationPreferenceService.js';
import { slackService } from '../services/slackService.js';
import { verifyOrgAdmin } from '../services/orgService.js';
import { ALL_NOTIFICATION_EVENT_TYPES, type Variables } from '../types/index.js';

const integrationsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication and org context
integrationsRoute.use(requireAuth);
integrationsRoute.use(requireOrgId);

// Validation schemas
const updatePreferencesSchema = z.object({
  digestFrequency: z.enum(['daily', 'weekly', 'off']).optional(),
  timezone: z.string().max(50).optional(),
  notifyScanComplete: z.boolean().optional(),
  notifyCriticalFindings: z.boolean().optional(),
  notifyHighFindings: z.boolean().optional(),
});

const httpUrlSchema = z.string().url().max(2048).refine(
  u => u.startsWith('https://') || u.startsWith('http://'),
  'URL must use http or https',
);

const eventTypesSchema = z.array(
  z.enum(ALL_NOTIFICATION_EVENT_TYPES as [string, ...string[]]),
).min(1);

const createWebhookSchema = z.object({
  url: httpUrlSchema,
  eventTypes: eventTypesSchema,
  description: z.string().max(255).optional(),
});

const updateWebhookSchema = z.object({
  url: httpUrlSchema.optional(),
  eventTypes: eventTypesSchema.optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(255).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// POST /integrations/webhooks — create webhook (admin-only)
integrationsRoute.post('/webhooks', zValidator('json', createWebhookSchema), async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');

  await verifyOrgAdmin(orgId, userId);

  const data = c.req.valid('json');
  const result = await webhookService.createWebhook(orgId, {
    ...data,
    createdBy: userId,
  });

  return c.json({ data: result }, 201);
});

// GET /integrations/webhooks — list webhooks (strip secret defensively)
integrationsRoute.get('/webhooks', async (c) => {
  const orgId = c.get('orgId');

  const webhooks = await webhookService.listWebhooks(orgId);
  const stripped = webhooks.map((w) => {
    const { secret: _secret, ...rest } = w as typeof w & { secret?: string };
    return rest;
  });
  return c.json({ data: stripped });
});

// PATCH /integrations/webhooks/:id — update webhook (admin-only)
integrationsRoute.patch('/webhooks/:id', zValidator('json', updateWebhookSchema), async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  const webhookId = c.req.param('id');

  await verifyOrgAdmin(orgId, userId);

  const data = c.req.valid('json');
  const webhook = await webhookService.updateWebhook(orgId, webhookId, data);

  // Strip secret from response
  const { secret: _secret, ...safeWebhook } = webhook;
  return c.json({ data: safeWebhook });
});

// DELETE /integrations/webhooks/:id — delete webhook (admin-only)
integrationsRoute.delete('/webhooks/:id', async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  const webhookId = c.req.param('id');

  await verifyOrgAdmin(orgId, userId);

  await webhookService.deleteWebhook(orgId, webhookId);
  return c.json({ data: { deleted: true } });
});

// POST /integrations/webhooks/:id/test — test webhook delivery (admin-only)
integrationsRoute.post('/webhooks/:id/test', async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  const webhookId = c.req.param('id');

  await verifyOrgAdmin(orgId, userId);

  const result = await webhookService.testWebhook(orgId, webhookId);
  return c.json({ data: result });
});

// GET /integrations/webhooks/:id/deliveries — get delivery logs (paginated)
integrationsRoute.get(
  '/webhooks/:id/deliveries',
  zValidator('query', paginationSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const webhookId = c.req.param('id');


    const { page, limit } = c.req.valid('query');
    const { data, total } = await webhookService.getDeliveryLogs(orgId, webhookId, page, limit);

    return c.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

// GET /integrations/preferences — get notification preferences
integrationsRoute.get('/preferences', async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');


  const prefs = await notificationPreferenceService.getPreferences(userId, orgId);
  return c.json({ data: prefs });
});

// PATCH /integrations/preferences — update notification preferences
integrationsRoute.patch('/preferences', zValidator('json', updatePreferencesSchema), async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');


  const body = c.req.valid('json');
  const prefs = await notificationPreferenceService.updatePreferences(userId, orgId, body);
  return c.json({ data: prefs });
});

// GET /integrations/slack — get Slack integration status
integrationsRoute.get('/slack', async (c) => {
  const orgId = c.get('orgId');


  const integration = await slackService.getIntegration(orgId);
  if (!integration) return c.json({ data: null });
  // Strip accessToken from response
  const { accessToken: _accessToken, ...safe } = integration;
  return c.json({ data: safe });
});

// GET /integrations/slack/authorize — get OAuth authorize URL (admin-only)
integrationsRoute.get('/slack/authorize', async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');

  await verifyOrgAdmin(orgId, userId);

  const url = slackService.getOAuthUrl(orgId);
  return c.json({ data: { url } });
});

// POST /integrations/slack/callback — handle OAuth callback (admin-only)
integrationsRoute.post(
  '/slack/callback',
  zValidator('json', z.object({ code: z.string() })),
  async (c) => {
    const orgId = c.get('orgId');
    const userId = c.get('userId');

    await verifyOrgAdmin(orgId, userId);

    const { code } = c.req.valid('json');
    const integration = await slackService.handleOAuthCallback(code, orgId, userId);
    const { accessToken: _accessToken, ...safe } = integration;
    return c.json({ data: safe });
  }
);

// GET /integrations/slack/channels — list Slack channels
integrationsRoute.get('/slack/channels', async (c) => {
  const orgId = c.get('orgId');


  const channels = await slackService.listChannels(orgId);
  return c.json({ data: channels });
});

// PUT /integrations/slack/channels — update channel mappings (admin-only)
integrationsRoute.put(
  '/slack/channels',
  zValidator(
    'json',
    z.object({
      mappings: z.array(
        z.object({
          eventType: z.enum(ALL_NOTIFICATION_EVENT_TYPES as [string, ...string[]]),
          channelId: z.string(),
          channelName: z.string(),
        })
      ).refine(
        arr => new Set(arr.map(m => m.eventType)).size === arr.length,
        'Duplicate event types not allowed',
      ),
    })
  ),
  async (c) => {
    const orgId = c.get('orgId');
    const userId = c.get('userId');

    await verifyOrgAdmin(orgId, userId);

    const { mappings } = c.req.valid('json');
    const result = await slackService.updateChannelMappings(orgId, mappings);
    return c.json({ data: result });
  }
);

// DELETE /integrations/slack — disconnect Slack (admin-only)
integrationsRoute.delete('/slack', async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');

  await verifyOrgAdmin(orgId, userId);

  await slackService.disconnect(orgId);
  return c.json({ data: { success: true } });
});

export default integrationsRoute;

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { requireOrgId } from '../middlewares/requireOrgId.js';
import { requireNoProcessingRestriction } from '../middlewares/processingRestriction.js';
import { webhookService } from '../services/webhookService.js';
import { getOrgTier, verifyOrgAdmin } from '../services/orgService.js';
import { HTTP403Error } from '../lib/errors.js';
import { TIER_LIMITS, type Variables } from '../types/index.js';

const integrationsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication and org context
integrationsRoute.use(requireAuth);
integrationsRoute.use(requireOrgId);
// Block write operations when GDPR processing restriction is active (Article 18)
integrationsRoute.use('*', async (c, next) => {
  if (c.req.method !== 'GET') {
    return requireNoProcessingRestriction(c, next);
  }
  await next();
});

// Validation schemas
const createWebhookSchema = z.object({
  url: z.string().url().max(2048),
  eventTypes: z.array(z.string()).min(1),
  description: z.string().max(255).optional(),
});

const updateWebhookSchema = z.object({
  url: z.string().url().max(2048).optional(),
  eventTypes: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(255).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Helper: check that the org's tier allows webhook configuration
async function checkWebhookTier(orgId: string): Promise<void> {
  const tier = await getOrgTier(orgId);
  if (!TIER_LIMITS[tier].canConfigureWebhooks) {
    throw new HTTP403Error('Webhook configuration is not available on your current plan. Upgrade to Pro or Team to configure webhooks.');
  }
}

// POST /integrations/webhooks — create webhook (admin-only, tier-gated)
integrationsRoute.post('/webhooks', zValidator('json', createWebhookSchema), async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');

  await checkWebhookTier(orgId);
  await verifyOrgAdmin(orgId, userId);

  const data = c.req.valid('json');
  const result = await webhookService.createWebhook(orgId, {
    ...data,
    createdBy: userId,
  });

  return c.json({ data: result }, 201);
});

// GET /integrations/webhooks — list webhooks (tier-gated), strip secret
integrationsRoute.get('/webhooks', async (c) => {
  const orgId = c.get('orgId');

  await checkWebhookTier(orgId);

  const webhooks = await webhookService.listWebhooks(orgId);
  // Strip secret field from each webhook
  const safeWebhooks = webhooks.map(({ secret: _secret, ...rest }) => rest);

  return c.json({ data: safeWebhooks });
});

// PATCH /integrations/webhooks/:id — update webhook (admin-only, tier-gated)
integrationsRoute.patch('/webhooks/:id', zValidator('json', updateWebhookSchema), async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  const webhookId = c.req.param('id');

  await checkWebhookTier(orgId);
  await verifyOrgAdmin(orgId, userId);

  const data = c.req.valid('json');
  const webhook = await webhookService.updateWebhook(orgId, webhookId, data);

  // Strip secret from response
  const { secret: _secret, ...safeWebhook } = webhook;
  return c.json({ data: safeWebhook });
});

// DELETE /integrations/webhooks/:id — delete webhook (admin-only, tier-gated)
integrationsRoute.delete('/webhooks/:id', async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  const webhookId = c.req.param('id');

  await checkWebhookTier(orgId);
  await verifyOrgAdmin(orgId, userId);

  await webhookService.deleteWebhook(orgId, webhookId);
  return c.json({ data: { deleted: true } });
});

// POST /integrations/webhooks/:id/test — test webhook delivery (admin-only, tier-gated)
integrationsRoute.post('/webhooks/:id/test', async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  const webhookId = c.req.param('id');

  await checkWebhookTier(orgId);
  await verifyOrgAdmin(orgId, userId);

  const result = await webhookService.testWebhook(orgId, webhookId);
  return c.json({ data: result });
});

// GET /integrations/webhooks/:id/deliveries — get delivery logs (paginated, tier-gated)
integrationsRoute.get(
  '/webhooks/:id/deliveries',
  zValidator('query', paginationSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const webhookId = c.req.param('id');

    await checkWebhookTier(orgId);

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

export default integrationsRoute;

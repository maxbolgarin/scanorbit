import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../lib/db.js';
import {
  users,
  orgs,
  userOrgMembers,
  userOauthAccounts,
  auditLogs,
  dataDeletionRequests,
  consentLogs,
  dripLog,
} from '../db/schema.js';
import { requireAuth } from '../middlewares/auth.js';
import { logDataAccess } from '../middlewares/auditLog.js';
import { consentService } from '../services/consentService.js';
import { listmonkService } from '../services/listmonkService.js';
import { getClientIP } from '../lib/ip.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { Variables } from '../types/index.js';

const gdpr = new Hono<{ Variables: Variables }>();

// All GDPR routes require authentication
gdpr.use('/*', requireAuth);

// =============================================================================
// GET /api/gdpr/export - Export user's personal data (GDPR Article 20)
// =============================================================================
gdpr.get('/export', async (c) => {
  const userId = c.get('userId');

  // Log this sensitive operation
  await logDataAccess(
    userId,
    'export',
    '/gdpr/export',
    getClientIP(c) || null,
    c.req.header('user-agent') || null
  );

  // Fetch all user data
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Get user's org memberships
  const memberships = await db
    .select({
      orgId: userOrgMembers.orgId,
      role: userOrgMembers.role,
      title: userOrgMembers.title,
      joinedAt: userOrgMembers.createdAt,
      orgName: orgs.name,
      orgSlug: orgs.slug,
    })
    .from(userOrgMembers)
    .innerJoin(orgs, eq(userOrgMembers.orgId, orgs.id))
    .where(eq(userOrgMembers.userId, userId));

  // Get consent logs
  const consents = await db
    .select()
    .from(consentLogs)
    .where(eq(consentLogs.userId, userId))
    .orderBy(desc(consentLogs.consentedAt));

  // Get audit logs (last 90 days for privacy)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const userAuditLogs = await db
    .select({
      timestamp: auditLogs.timestamp,
      action: auditLogs.action,
      method: auditLogs.method,
      path: auditLogs.path,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.userId, userId),
        gte(auditLogs.timestamp, ninetyDaysAgo)
      )
    )
    .orderBy(desc(auditLogs.timestamp))
    .limit(1000);

  // Get billing data from user's organizations
  const billingData = await db
    .select({
      orgName: orgs.name,
      tier: orgs.tier,
      subscriptionStatus: orgs.subscriptionStatus,
      trialEndsAt: orgs.trialEndsAt,
      subscriptionEndsAt: orgs.subscriptionEndsAt,
    })
    .from(userOrgMembers)
    .innerJoin(orgs, eq(userOrgMembers.orgId, orgs.id))
    .where(eq(userOrgMembers.userId, userId));

  // Get connected OAuth accounts (GDPR Article 15 - all personal data)
  const oauthAccounts = await db
    .select({
      provider: userOauthAccounts.provider,
      providerEmail: userOauthAccounts.providerEmail,
      createdAt: userOauthAccounts.createdAt,
    })
    .from(userOauthAccounts)
    .where(eq(userOauthAccounts.userId, userId));

  // Get email marketing history
  const emailMarketingData = await db
    .select({
      sequenceName: dripLog.sequenceName,
      emailDay: dripLog.emailDay,
      sentAt: dripLog.sentAt,
    })
    .from(dripLog)
    .where(eq(dripLog.subscriberEmail, user.email))
    .orderBy(desc(dripLog.sentAt));

  // Build export data
  const exportData = {
    exportedAt: new Date().toISOString(),
    gdprInfo: {
      dataController: 'ScanOrbit',
      purpose: 'GDPR Article 20 - Right to Data Portability',
      retentionPeriod: 'Data is retained according to our privacy policy',
    },
    personalData: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    connectedAccounts: oauthAccounts.map((a) => ({
      provider: a.provider,
      providerEmail: a.providerEmail,
      connectedAt: a.createdAt,
    })),
    organizations: memberships.map((m) => ({
      name: m.orgName,
      slug: m.orgSlug,
      role: m.role,
      title: m.title,
      joinedAt: m.joinedAt,
    })),
    billing: billingData.map((b) => ({
      organization: b.orgName,
      tier: b.tier,
      subscriptionStatus: b.subscriptionStatus,
      trialEndsAt: b.trialEndsAt,
      subscriptionEndsAt: b.subscriptionEndsAt,
    })),
    emailMarketing: emailMarketingData.map((e) => ({
      campaign: e.sequenceName,
      emailDay: e.emailDay,
      sentAt: e.sentAt,
    })),
    consents: consents.map((c) => ({
      type: c.consentType,
      version: c.consentVersion,
      given: c.consentGiven,
      timestamp: c.consentedAt,
    })),
    activityLog: userAuditLogs,
  };

  // Return as JSON with download headers
  c.header('Content-Disposition', `attachment; filename="scanorbit-data-export-${userId}.json"`);
  c.header('Content-Type', 'application/json');

  return c.json(exportData);
});

// =============================================================================
// POST /api/gdpr/delete - Request account deletion (GDPR Article 17)
// =============================================================================
const deletionRequestSchema = z.object({
  reason: z.string().optional(),
});

gdpr.post('/delete', zValidator('json', deletionRequestSchema), async (c) => {
  const userId = c.get('userId');
  const { reason } = c.req.valid('json');

  // Get user
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Check for existing pending request
  const existingRequest = await db
    .select()
    .from(dataDeletionRequests)
    .where(
      and(
        eq(dataDeletionRequests.userId, userId),
        eq(dataDeletionRequests.status, 'pending')
      )
    );

  if (existingRequest.length > 0) {
    return c.json({
      error: 'A deletion request is already pending',
      requestId: existingRequest[0].id,
      requestedAt: existingRequest[0].requestedAt,
    }, 409);
  }

  // Create deletion request with 30-day grace period
  const scheduledDeletionAt = new Date();
  scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 30);

  const [request] = await db
    .insert(dataDeletionRequests)
    .values({
      userId,
      email: user.email,
      requestType: 'full_deletion',
      status: 'pending',
      reason,
      scheduledDeletionAt,
      ipAddress: getClientIP(c),
      userAgent: c.req.header('user-agent'),
    })
    .returning();

  // Log this sensitive operation
  await logDataAccess(
    userId,
    'delete',
    '/gdpr/delete',
    getClientIP(c) || null,
    c.req.header('user-agent') || null
  );

  return c.json({
    message: 'Deletion request created',
    requestId: request.id,
    scheduledDeletionAt: request.scheduledDeletionAt,
    gracePeriodDays: 30,
    note: 'You can cancel this request within 30 days by contacting support',
  }, 201);
});

// =============================================================================
// DELETE /api/gdpr/delete/:requestId - Cancel deletion request
// =============================================================================
gdpr.delete('/delete/:requestId', async (c) => {
  const userId = c.get('userId');
  const requestId = c.req.param('requestId');

  // Find the request
  const [request] = await db
    .select()
    .from(dataDeletionRequests)
    .where(
      and(
        eq(dataDeletionRequests.id, requestId),
        eq(dataDeletionRequests.userId, userId),
        eq(dataDeletionRequests.status, 'pending')
      )
    );

  if (!request) {
    return c.json({ error: 'Deletion request not found or already processed' }, 404);
  }

  // Cancel the request
  await db
    .update(dataDeletionRequests)
    .set({
      status: 'cancelled',
      processedAt: new Date(),
      notes: 'Cancelled by user',
    })
    .where(eq(dataDeletionRequests.id, requestId));

  return c.json({
    message: 'Deletion request cancelled',
    requestId,
  });
});

// =============================================================================
// GET /api/gdpr/audit-logs - View user's audit logs
// =============================================================================
const auditLogsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'startDate must be before or equal to endDate' }
);

gdpr.get('/audit-logs', zValidator('query', auditLogsQuerySchema), async (c) => {
  const userId = c.get('userId');
  const { limit, offset, startDate, endDate } = c.req.valid('query');

  // Build query conditions
  const conditions = [eq(auditLogs.userId, userId)];

  if (startDate) {
    conditions.push(gte(auditLogs.timestamp, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(auditLogs.timestamp, new Date(endDate)));
  }

  const logs = await db
    .select({
      id: auditLogs.id,
      timestamp: auditLogs.timestamp,
      action: auditLogs.action,
      method: auditLogs.method,
      path: auditLogs.path,
      statusCode: auditLogs.statusCode,
      ipAddress: auditLogs.ipAddress,
      durationMs: auditLogs.durationMs,
    })
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit)
    .offset(offset);

  return c.json({
    logs,
    pagination: {
      limit,
      offset,
      hasMore: logs.length === limit,
    },
  });
});

// =============================================================================
// GET /api/gdpr/deletion-status - Check deletion request status
// =============================================================================
gdpr.get('/deletion-status', async (c) => {
  const userId = c.get('userId');

  const requests = await db
    .select()
    .from(dataDeletionRequests)
    .where(eq(dataDeletionRequests.userId, userId))
    .orderBy(desc(dataDeletionRequests.requestedAt));

  return c.json({
    requests: requests.map((r) => ({
      id: r.id,
      requestType: r.requestType,
      status: r.status,
      reason: r.reason,
      requestedAt: r.requestedAt,
      scheduledDeletionAt: r.scheduledDeletionAt,
      processedAt: r.processedAt,
    })),
  });
});

// =============================================================================
// GET /api/gdpr/consent/marketing - Get marketing consent status
// =============================================================================
gdpr.get('/consent/marketing', async (c) => {
  const userId = c.get('userId');

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const [latestConsent] = await db
    .select()
    .from(consentLogs)
    .where(
      and(
        eq(consentLogs.userId, userId),
        eq(consentLogs.consentType, 'marketing')
      )
    )
    .orderBy(desc(consentLogs.consentedAt))
    .limit(1);

  return c.json({
    marketingConsent: latestConsent?.consentGiven ?? false,
    lastUpdated: latestConsent?.consentedAt ?? null,
  });
});

// =============================================================================
// PUT /api/gdpr/consent/marketing - Update marketing consent (GDPR Article 7)
// =============================================================================
const marketingConsentSchema = z.object({
  consentGiven: z.boolean(),
});

gdpr.put('/consent/marketing', zValidator('json', marketingConsentSchema), async (c) => {
  const userId = c.get('userId');
  const { consentGiven } = c.req.valid('json');

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Log consent change (immutable record)
  await consentService.logConsent({
    userId,
    email: user.email,
    consentType: 'marketing',
    consentGiven,
    ipAddress: getClientIP(c),
    userAgent: c.req.header('user-agent'),
  });

  // Update Listmonk subscription status
  if (consentGiven) {
    await listmonkService.subscribe(user.email, user.fullName);
  } else {
    await listmonkService.unsubscribe(user.email);
  }

  // Audit log
  await logDataAccess(
    userId,
    'update',
    '/gdpr/consent/marketing',
    getClientIP(c) || null,
    c.req.header('user-agent') || null
  );

  return c.json({ success: true, marketingConsent: consentGiven });
});

// =============================================================================
// GET /api/gdpr/consent/history - Get user's consent history (GDPR Article 7)
// =============================================================================
gdpr.get('/consent/history', async (c) => {
  const userId = c.get('userId');

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const history = await consentService.getConsentHistory(user.email);

  return c.json({
    consents: history.map((h) => ({
      type: h.consentType,
      version: h.consentVersion,
      given: h.consentGiven,
      timestamp: h.consentedAt,
    })),
  });
});

// =============================================================================
// GET /api/gdpr/profile - Get user's personal data (GDPR Article 15)
// =============================================================================
gdpr.get('/profile', async (c) => {
  const userId = c.get('userId');

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    fullName: user.fullName,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

// =============================================================================
// PATCH /api/gdpr/profile - Update personal data (GDPR Article 16 - Rectification)
// =============================================================================
const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(64).optional(),
});

gdpr.patch('/profile', zValidator('json', updateProfileSchema), async (c) => {
  const userId = c.get('userId');
  const updates = c.req.valid('json');

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const [updated] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  // Audit log for rectification
  await logDataAccess(
    userId,
    'update',
    '/gdpr/profile',
    getClientIP(c) || null,
    c.req.header('user-agent') || null
  );

  return c.json({
    fullName: updated.fullName,
    email: updated.email,
    emailVerified: updated.emailVerified,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

export default gdpr;

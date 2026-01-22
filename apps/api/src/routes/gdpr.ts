import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../lib/db.js';
import {
  users,
  orgs,
  userOrgMembers,
  auditLogs,
  dataDeletionRequests,
  consentLogs,
} from '../db/schema.js';
import { requireAuth } from '../middlewares/auth.js';
import { logDataAccess } from '../middlewares/auditLog.js';
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
    c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null,
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
    organizations: memberships.map((m) => ({
      name: m.orgName,
      slug: m.orgSlug,
      role: m.role,
      title: m.title,
      joinedAt: m.joinedAt,
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
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      userAgent: c.req.header('user-agent'),
    })
    .returning();

  // Log this sensitive operation
  await logDataAccess(
    userId,
    'delete',
    '/gdpr/delete',
    c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null,
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

export default gdpr;

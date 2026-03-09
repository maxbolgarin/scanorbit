import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { HTTP403Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

/**
 * GDPR Article 18 - Right to Restriction of Processing
 *
 * When a user has requested restriction of processing, this middleware
 * blocks write operations (scans, account creation, data modifications)
 * while still allowing:
 * - Read-only access to existing data
 * - GDPR operations (export, deletion, restriction toggle)
 * - Auth operations (login, logout, token refresh)
 */
export const requireNoProcessingRestriction = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  const userId = c.get('userId');
  if (!userId) {
    await next();
    return;
  }

  const [user] = await db
    .select({ processingRestricted: users.processingRestricted })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.processingRestricted) {
    throw new HTTP403Error(
      'Your account has an active processing restriction (GDPR Article 18). ' +
      'Write operations are blocked. You can lift this restriction in your privacy settings.'
    );
  }

  await next();
};

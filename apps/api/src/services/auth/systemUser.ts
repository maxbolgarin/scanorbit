import { eq } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { users, orgs, userOrgMembers } from '../../db/schema.js';
import { getPgErrorCode } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

/**
 * In single-user / auth-disabled mode, every request is silently mapped to a
 * built-in admin user that owns a default org. The user + org are lazy-created
 * on first request and cached for the lifetime of the process.
 *
 * Anchor by email so two concurrent processes can't create competing rows.
 */
const SYSTEM_USER_EMAIL = 'admin@local';
const SYSTEM_USER_FULLNAME = 'Admin';
const SYSTEM_ORG_NAME = 'Default';
const SYSTEM_ORG_SLUG = 'default';

let cache: { userId: string; orgId: string } | null = null;
let inflight: Promise<{ userId: string; orgId: string }> | null = null;

export async function ensureSystemUserAndOrg(): Promise<{ userId: string; orgId: string }> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const result = await resolve();
    cache = result;
    return result;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function resolve(): Promise<{ userId: string; orgId: string }> {
  // 1. User
  let userId: string;
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, SYSTEM_USER_EMAIL))
    .limit(1);

  if (existingUser.length > 0) {
    userId = existingUser[0].id;
  } else {
    try {
      const [row] = await db
        .insert(users)
        .values({
          email: SYSTEM_USER_EMAIL,
          fullName: SYSTEM_USER_FULLNAME,
          passwordHash: null,
          emailVerified: true,
        })
        .returning({ id: users.id });
      userId = row.id;
      logger.info('[systemUser] created built-in admin', { userId });
    } catch (err) {
      // Concurrent creation — re-read.
      if (getPgErrorCode(err) === '23505') {
        const [row] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, SYSTEM_USER_EMAIL))
          .limit(1);
        userId = row.id;
      } else {
        throw err;
      }
    }
  }

  // 2. Org membership
  const membership = await db
    .select({ orgId: userOrgMembers.orgId })
    .from(userOrgMembers)
    .where(eq(userOrgMembers.userId, userId))
    .limit(1);

  if (membership.length > 0) {
    return { userId, orgId: membership[0].orgId };
  }

  // 3. No org yet — create default org and assign admin role
  const [org] = await db
    .insert(orgs)
    .values({
      name: SYSTEM_ORG_NAME,
      slug: SYSTEM_ORG_SLUG,
    })
    .returning({ id: orgs.id });

  await db.insert(userOrgMembers).values({
    userId,
    orgId: org.id,
    role: 'admin',
  });

  logger.info('[systemUser] created default org', { orgId: org.id, userId });
  return { userId, orgId: org.id };
}

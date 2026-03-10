/**
 * Drip email scheduler.
 *
 * - Daily cron: loops all sequences, finds subscribers due for an email, sends via Listmonk TX API.
 * - sendImmediate: fires day-0 emails instantly from event handlers.
 * - Dedup: drip_log table prevents duplicate sends.
 */

import { createHmac } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { dripLog } from '../db/schema.js';
import { listmonkService } from './listmonkService.js';
import { SEQUENCES, type DripSequence, type DripStep } from './dripConfig.js';
import { logger } from '../lib/logger.js';

export function buildUnsubscribeUrl(email: string): string {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? 'default-secret';
  const token = createHmac('sha256', secret).update(email.toLowerCase()).digest('hex');
  const base = process.env.API_PUBLIC_URL ?? 'https://scanorbit.cloud';
  return `${base}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

const POLL_INTERVAL_MS = 60_000;
const TARGET_HOUR_UTC = 8; // 9 AM CET = 8 AM UTC

// ── Dedup ────────────────────────────────────────────────────────────

async function wasSent(email: string, seq: string, day: number): Promise<boolean> {
  const [row] = await db
    .select({ id: dripLog.id })
    .from(dripLog)
    .where(and(
      eq(dripLog.subscriberEmail, email),
      eq(dripLog.sequenceName, seq),
      eq(dripLog.emailDay, day),
    ))
    .limit(1);
  return !!row;
}

async function markSent(email: string, seq: string, day: number): Promise<void> {
  await db.insert(dripLog).values({
    subscriberEmail: email,
    sequenceName: seq,
    emailDay: day,
  }).onConflictDoNothing();
}

// ── Core ─────────────────────────────────────────────────────────────

function daysSince(date: string | Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function getStepForToday(
  sub: { attribs: Record<string, unknown>; created_at: string },
  seq: DripSequence,
): DripStep | null {
  const startDate = seq.dateAttrib && sub.attribs[seq.dateAttrib]
    ? sub.attribs[seq.dateAttrib] as string
    : sub.created_at;
  const days = daysSince(startDate);
  return seq.steps.find(s => s.day === days) ?? null;
}

async function processSequence(seq: DripSequence): Promise<void> {
  if (seq.listId === 0) return;

  const subs = await listmonkService.queryByList(seq.listId);
  if (!subs.length) return;

  let sent = 0;
  for (const sub of subs) {
    const step = getStepForToday(sub, seq);
    if (!step || step.templateId === 0) continue;
    if (await wasSent(sub.email, seq.name, step.day)) continue;

    try {
      const ok = await listmonkService.sendTx({
        email: sub.email,
        templateId: step.templateId,
        data: {
          first_name: sub.name?.split(' ')[0] || 'there',
          unsubscribe_url: buildUnsubscribeUrl(sub.email),
          ...sub.attribs as Record<string, unknown>,
        },
        fromEmail: step.fromEmail,
      });
      if (ok) {
        await markSent(sub.email, seq.name, step.day);
        sent++;
      }
    } catch (err) {
      logger.error(`[Drip] ${seq.name} day ${step.day} → ${sub.email} failed`, err as Error);
    }
  }

  if (sent > 0) logger.info(`[Drip] "${seq.name}": sent ${sent} email(s)`);
}

async function runDripScheduler(): Promise<void> {
  const now = new Date();
  if (now.getUTCHours() !== TARGET_HOUR_UTC) return;

  // Prevent double-runs within the same day
  const todayKey = `drip:ran:${now.toISOString().slice(0, 10)}`;
  const alreadyRan = await redis.set(todayKey, '1', 'EX', 86400, 'NX');
  if (!alreadyRan) return;

  logger.info('[Drip] Scheduler starting');
  for (const seq of SEQUENCES) {
    try {
      await processSequence(seq);
    } catch (err) {
      logger.error(`[Drip] Sequence "${seq.name}" failed`, err as Error);
    }
  }
  logger.info('[Drip] Scheduler done');
}

// ── sendImmediate (day-0 emails from event handlers) ─────────────────

/**
 * Send a day-0 email immediately. Fire-and-forget safe (never throws).
 * Call from event handlers: signup, scan-complete, trial-start, payment.
 */
export async function sendImmediate(params: {
  sequenceName: string;
  email: string;
  name?: string | null;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const seq = SEQUENCES.find(s => s.name === params.sequenceName);
    if (!seq) return;

    const step = seq.steps.find(s => s.day === 0);
    if (!step || step.templateId === 0) return;

    if (await wasSent(params.email, seq.name, 0)) return;

    const ok = await listmonkService.sendTx({
      email: params.email,
      templateId: step.templateId,
      data: {
        first_name: params.name?.split(' ')[0] || 'there',
        unsubscribe_url: buildUnsubscribeUrl(params.email),
        ...(params.data ?? {}),
      },
      fromEmail: step.fromEmail,
    });
    if (ok) await markSent(params.email, seq.name, 0);
  } catch (err) {
    logger.error(`[Drip] sendImmediate "${params.sequenceName}" → ${params.email} failed`, err as Error);
  }
}

// ── Startup ──────────────────────────────────────────────────────────

export function startDripScheduler(): void {
  if (!listmonkService.isConfigured()) {
    logger.info('[Drip] Listmonk not configured, skipping scheduler');
    return;
  }

  const safeRunDripScheduler = async (): Promise<void> => {
    try {
      await runDripScheduler();
    } catch (error) {
      logger.error('[Drip] Unhandled error in scheduler tick', error as Error);
    }
  };

  setInterval(safeRunDripScheduler, POLL_INTERVAL_MS);
  logger.info('[Drip] Scheduler started (checks every 60s, runs at 9 AM CET)');
}

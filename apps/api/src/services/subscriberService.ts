/**
 * Email subscriber management service.
 * Replaces Listmonk API calls with local PostgreSQL operations via Drizzle ORM.
 * Manages subscriber lifecycle (lists, attributes, status) for drip campaigns.
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { config } from '../lib/config.js';
import { emailSubscribers } from '../db/schema.js';
import { clearDripLog } from './dripSchedulerService.js';
import { logger } from '../lib/logger.js';

function maskEmail(email: string): string {
  const [local] = email.split('@');
  return `${local?.slice(0, 3)}***`;
}

function isConfigured(): boolean {
  return !!config.email.resend.apiKey;
}

// ── Internal helpers ──────────────────────────────────────────────────

/** Add subscriber to a list. Creates or re-enables if exists. */
async function addToList(
  email: string,
  list: string,
  name?: string | null,
  attributes?: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(emailSubscribers)
    .values({
      email,
      name: name || null,
      list,
      status: 'active',
      attributes: attributes ?? {},
    })
    .onConflictDoUpdate({
      target: [emailSubscribers.email, emailSubscribers.list],
      set: {
        status: 'active',
        ...(name ? { name } : {}),
        updatedAt: new Date(),
      },
    });
}

/** Remove subscriber from specific lists. */
async function removeFromLists(email: string, lists: string[]): Promise<void> {
  if (lists.length === 0) return;
  for (const list of lists) {
    await db
      .delete(emailSubscribers)
      .where(and(eq(emailSubscribers.email, email), eq(emailSubscribers.list, list)));
  }
}

/** Move subscriber from old lists to a new list. Atomic: add first, then remove. */
async function moveToList(email: string, fromLists: string[], toList: string): Promise<void> {
  // Get existing attributes and name from any current row
  const [existing] = await db
    .select({ name: emailSubscribers.name, attributes: emailSubscribers.attributes })
    .from(emailSubscribers)
    .where(eq(emailSubscribers.email, email))
    .limit(1);

  await addToList(email, toList, existing?.name, existing?.attributes as Record<string, unknown>);
  // Remove from old lists (but not the target list)
  const removable = fromLists.filter(l => l !== toList);
  await removeFromLists(email, removable);
}

export const subscriberService = {
  /**
   * Subscribe an email to the default newsletter list.
   * Idempotent — re-enables unsubscribed/bounced subscribers.
   */
  async subscribe(
    email: string,
    name?: string | null,
    listNames?: string[],
  ): Promise<boolean> {
    const targetLists = listNames ?? ['subscribers'];
    try {
      for (const list of targetLists) {
        await addToList(email, list, name);
      }
      logger.info(`[Subscriber] Subscribed ${maskEmail(email)} to [${targetLists.join(', ')}]`);
      return true;
    } catch (error) {
      logger.error('[Subscriber] subscribe failed', error as Error);
      return false;
    }
  },

  /**
   * Unsubscribe by email (GDPR opt-out).
   * Sets status to 'unsubscribed' on all lists.
   */
  async unsubscribe(email: string): Promise<boolean> {
    try {
      const result = await db
        .update(emailSubscribers)
        .set({ status: 'unsubscribed', updatedAt: new Date() })
        .where(eq(emailSubscribers.email, email));
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`[Subscriber] Unsubscribed ${maskEmail(email)}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[Subscriber] unsubscribe failed', error as Error);
      return false;
    }
  },

  /**
   * Delete a subscriber entirely (GDPR account deletion).
   */
  async deleteSubscriber(email: string): Promise<boolean> {
    try {
      const result = await db
        .delete(emailSubscribers)
        .where(eq(emailSubscribers.email, email));
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`[Subscriber] Deleted ${maskEmail(email)}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[Subscriber] deleteSubscriber failed', error as Error);
      return false;
    }
  },

  // ── Campaign list transition methods ──────────────────────────────

  /**
   * User signed up (free account).
   * Add to free-new, remove from cold-leads and subscribers.
   */
  async onUserSignup(email: string, name?: string | null): Promise<void> {
    if (!isConfigured()) return;
    try {
      await addToList(email, 'free-new', name);
      await removeFromLists(email, ['cold-leads', 'subscribers']);
      logger.info(`[Subscriber] onUserSignup: ${maskEmail(email)} → free-new`);
    } catch (error) {
      logger.error('[Subscriber] onUserSignup failed', error as Error);
    }
  },

  /**
   * User completed their first scan.
   * Move from free-new to free-scanned.
   */
  async onFirstScanComplete(email: string): Promise<void> {
    if (!isConfigured()) return;
    try {
      await moveToList(email, ['free-new'], 'free-scanned');
      logger.info(`[Subscriber] onFirstScanComplete: ${maskEmail(email)} → free-scanned`);
    } catch (error) {
      logger.error('[Subscriber] onFirstScanComplete failed', error as Error);
    }
  },

  /**
   * User started a trial (via Stripe checkout).
   * Move from free-new/free-scanned/subscribers/cold-leads to trial-new.
   */
  async onTrialStart(email: string): Promise<void> {
    if (!isConfigured()) return;
    try {
      await moveToList(email, ['free-new', 'free-scanned', 'subscribers', 'cold-leads'], 'trial-new');
      logger.info(`[Subscriber] onTrialStart: ${maskEmail(email)} → trial-new`);
    } catch (error) {
      logger.error('[Subscriber] onTrialStart failed', error as Error);
    }
  },

  /**
   * Trial user became active (2+ scans).
   * Move from trial-new to trial-active.
   */
  async onTrialActive(email: string): Promise<void> {
    if (!isConfigured()) return;
    try {
      await moveToList(email, ['trial-new'], 'trial-active');
      logger.info(`[Subscriber] onTrialActive: ${maskEmail(email)} → trial-active`);
    } catch (error) {
      logger.error('[Subscriber] onTrialActive failed', error as Error);
    }
  },

  /**
   * User paid (trial ended → active subscription).
   * Move from trial-new/trial-active/free-new/free-scanned to paid-pro or paid-team.
   */
  async onPayment(email: string, tier: 'pro' | 'team'): Promise<void> {
    if (!isConfigured()) return;
    try {
      const targetList = tier === 'team' ? 'paid-team' : 'paid-pro';
      await moveToList(email, ['trial-new', 'trial-active', 'free-new', 'free-scanned'], targetList);
      logger.info(`[Subscriber] onPayment: ${maskEmail(email)} → ${targetList}`);
    } catch (error) {
      logger.error('[Subscriber] onPayment failed', error as Error);
    }
  },

  /**
   * User changed plan (Pro ↔ Team).
   */
  async onPlanChange(email: string, fromTier: 'pro' | 'team', toTier: 'pro' | 'team'): Promise<void> {
    if (!isConfigured() || fromTier === toTier) return;
    try {
      const fromList = fromTier === 'team' ? 'paid-team' : 'paid-pro';
      const toList = toTier === 'team' ? 'paid-team' : 'paid-pro';
      await moveToList(email, [fromList], toList);
      logger.info(`[Subscriber] onPlanChange: ${maskEmail(email)} ${fromList} → ${toList}`);
    } catch (error) {
      logger.error('[Subscriber] onPlanChange failed', error as Error);
    }
  },

  /**
   * User churned (subscription canceled or deleted).
   * Trial cancellations: keep in trial-active for day-9 win-back email.
   * Paid cancellations: move to subscribers immediately.
   */
  async onChurn(email: string, isTrialCancellation = false): Promise<void> {
    if (!isConfigured()) return;
    try {
      if (isTrialCancellation) {
        // Keep in trial-active for win-back. Ensure they're on trial-active.
        await addToList(email, 'trial-active');
        await removeFromLists(email, ['trial-new']);
        // Mark as cancelled so the win-back drip step fires
        await this.updateAttribsByEmail(email, { trial_cancelled_at: new Date().toISOString() });
        logger.info(`[Subscriber] onChurn (trial): ${maskEmail(email)} → stays in trial-active for win-back`);
      } else {
        await moveToList(email, ['paid-pro', 'paid-team', 'trial-new', 'trial-active'], 'subscribers');
        // Set subscribed_at so the subscribers drip sequence fires from day 0
        await this.updateAttribsByEmail(email, { subscribed_at: new Date().toISOString() });
        // Clear old drip_log entries so the subscribers sequence can restart
        await clearDripLog(email, 'subscribers');
        logger.info(`[Subscriber] onChurn: ${maskEmail(email)} → subscribers`);
      }
    } catch (error) {
      logger.error('[Subscriber] onChurn failed', error as Error);
    }
  },

  /**
   * Cleanup trial-active subscribers whose sequence is complete (10+ days since trial start).
   * Moves them to subscribers after the win-back window.
   */
  async cleanupExpiredTrialActive(): Promise<void> {
    if (!isConfigured()) return;
    try {
      const subs = await this.queryByList('trial-active');
      const TEN_DAYS_MS = 10 * 86_400_000;
      const now = Date.now();

      for (const sub of subs) {
        const trialStart = (sub.attributes as Record<string, unknown>).trial_started_at as string | undefined;
        if (!trialStart) continue;
        if (now - new Date(trialStart).getTime() <= TEN_DAYS_MS) continue;

        await moveToList(sub.email, ['trial-active'], 'subscribers');
        await this.updateAttribsByEmail(sub.email, { subscribed_at: new Date().toISOString() });
        await clearDripLog(sub.email, 'trial-active');
        await clearDripLog(sub.email, 'subscribers');
        logger.info(`[Subscriber] cleanupExpiredTrialActive: ${maskEmail(sub.email)} → subscribers`);
      }
    } catch (error) {
      logger.error('[Subscriber] cleanupExpiredTrialActive failed', error as Error);
    }
  },

  // ── Subscriber queries ────────────────────────────────────────────

  /**
   * Query all active subscribers in a list.
   * Returns subscriber data compatible with the drip scheduler.
   */
  async queryByList(listName: string): Promise<Array<{
    email: string;
    name: string | null;
    attributes: Record<string, unknown>;
    created_at: string;
  }>> {
    const rows = await db
      .select()
      .from(emailSubscribers)
      .where(and(eq(emailSubscribers.list, listName), eq(emailSubscribers.status, 'active')));

    return rows.map(r => ({
      email: r.email,
      name: r.name,
      attributes: r.attributes as Record<string, unknown>,
      created_at: r.createdAt.toISOString(),
    }));
  },

  /**
   * Update subscriber attributes by email (merges with existing).
   * Updates ALL rows for this email across all lists.
   */
  async updateAttribsByEmail(email: string, attribs: Record<string, unknown>): Promise<boolean> {
    try {
      const result = await db
        .update(emailSubscribers)
        .set({
          attributes: sql`${emailSubscribers.attributes} || ${JSON.stringify(attribs)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(emailSubscribers.email, email));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('[Subscriber] updateAttribsByEmail failed', error as Error);
      return false;
    }
  },

  isConfigured,
};

import { listmonkConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';

interface ListmonkSubscriber {
  id: number;
  email: string;
  name: string;
  status: 'enabled' | 'disabled' | 'blocklisted';
}

function getAuthHeader(): string {
  return `Basic ${  Buffer.from(
    `${listmonkConfig.apiUser}:${listmonkConfig.apiPassword}`
  ).toString('base64')}`;
}

function isConfigured(): boolean {
  return !!listmonkConfig.apiPassword;
}

function listsConfigured(): boolean {
  const l = listmonkConfig.lists;
  return isConfigured() && (
    l.freeNew > 0 || l.freeScanned > 0 || l.trialNew > 0 ||
    l.trialActive > 0 || l.paidPro > 0 || l.paidTeam > 0
  );
}

function maskEmail(email: string): string {
  const [local] = email.split('@');
  return `${local?.slice(0, 3)}***`;
}

/** Filter out unconfigured (0) list IDs */
function validListIds(ids: number[]): number[] {
  return ids.filter(id => id > 0);
}

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  if (!isConfigured()) {
    logger.warn('[Listmonk] Not configured, skipping API call');
    return null;
  }

  try {
    const res = await fetch(`${listmonkConfig.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error(`[Listmonk] API error ${res.status}: ${text}`);
      return null;
    }

    return await res.json() as T;
  } catch (error) {
    logger.error('[Listmonk] API request failed', error as Error);
    return null;
  }
}

/** Look up a subscriber by email. Returns subscriber ID or null. */
async function getSubscriberByEmail(email: string): Promise<number | null> {
  const search = await apiRequest<{ data: { results: ListmonkSubscriber[] } }>(
    'GET',
    `/api/subscribers?query=subscribers.email='${encodeURIComponent(email)}'&page=1&per_page=1`,
  );

  return search?.data?.results?.[0]?.id ?? null;
}

/** Ensure a subscriber exists in Listmonk. Creates if missing. Returns subscriber ID or null. */
async function ensureSubscriber(email: string, name?: string | null): Promise<number | null> {
  const existing = await getSubscriberByEmail(email);
  if (existing) return existing;

  // Create subscriber without any lists — lists are managed separately
  const result = await apiRequest<{ data: ListmonkSubscriber }>(
    'POST',
    '/api/subscribers',
    {
      email,
      name: name || '',
      status: 'enabled',
      lists: [],
      preconfirm_subscriptions: true,
    },
  );

  return result?.data?.id ?? null;
}

/** Add a subscriber to the given lists */
async function addToLists(subscriberId: number, listIds: number[]): Promise<boolean> {
  const ids = validListIds(listIds);
  if (ids.length === 0) return true;

  const result = await apiRequest<unknown>(
    'PUT',
    '/api/subscribers/lists',
    { ids: [subscriberId], action: 'add', target_list_ids: ids },
  );

  return result !== null;
}

/** Remove a subscriber from the given lists */
async function removeFromLists(subscriberId: number, listIds: number[]): Promise<boolean> {
  const ids = validListIds(listIds);
  if (ids.length === 0) return true;

  const result = await apiRequest<unknown>(
    'PUT',
    '/api/subscribers/lists',
    { ids: [subscriberId], action: 'remove', target_list_ids: ids },
  );

  return result !== null;
}

/** Move a subscriber: remove from old lists, add to new lists */
async function moveSubscriber(
  subscriberId: number,
  fromListIds: number[],
  toListIds: number[],
): Promise<boolean> {
  const removeOk = await removeFromLists(subscriberId, fromListIds);
  const addOk = await addToLists(subscriberId, toListIds);
  return removeOk && addOk;
}

const lists = listmonkConfig.lists;

export const listmonkService = {
  /**
   * Subscribe an email to the default newsletter list.
   * Fire-and-forget safe — never throws, returns boolean success.
   */
  async subscribe(
    email: string,
    name?: string | null,
    listIds?: number[],
  ): Promise<boolean> {
    const targetLists = (listIds ?? [listmonkConfig.defaultListId]).map(id => ({ id }));

    const result = await apiRequest<{ data: ListmonkSubscriber }>(
      'POST',
      '/api/subscribers',
      {
        email,
        name: name || '',
        status: 'enabled',
        lists: targetLists,
        preconfirm_subscriptions: true,
      },
    );

    if (result) {
      logger.info(`[Listmonk] Subscribed ${maskEmail(email)}`);
      return true;
    }
    return false;
  },

  /**
   * Unsubscribe by email (e.g., for GDPR deletion requests).
   */
  async unsubscribe(email: string): Promise<boolean> {
    const subscriberId = await getSubscriberByEmail(email);
    if (!subscriberId) return false;

    const result = await apiRequest<unknown>(
      'PUT',
      `/api/subscribers/${subscriberId}`,
      { status: 'blocklisted' },
    );

    if (result !== null) {
      logger.info(`[Listmonk] Unsubscribed ${maskEmail(email)}`);
      return true;
    }
    return false;
  },

  /**
   * Delete a subscriber from Listmonk entirely (for GDPR account deletion)
   */
  async deleteSubscriber(email: string): Promise<boolean> {
    const subscriberId = await getSubscriberByEmail(email);
    if (!subscriberId) return false;

    const result = await apiRequest<unknown>(
      'DELETE',
      `/api/subscribers/${subscriberId}`,
    );

    if (result !== null) {
      logger.info(`[Listmonk] Deleted subscriber ${maskEmail(email)}`);
      return true;
    }
    return false;
  },

  // ── Campaign list transition methods ──────────────────────────────

  /**
   * User signed up (free account).
   * Add to free-new, remove from cold-leads and subscribers.
   */
  async onUserSignup(email: string, name?: string | null): Promise<void> {
    if (!listsConfigured()) return;
    try {
      const subscriberId = await ensureSubscriber(email, name);
      if (!subscriberId) return;

      await addToLists(subscriberId, [lists.freeNew]);
      await removeFromLists(subscriberId, [lists.coldLeads, lists.subscribers]);
      logger.info(`[Listmonk] onUserSignup: ${maskEmail(email)} → free-new`);
    } catch (error) {
      logger.error('[Listmonk] onUserSignup failed', error as Error);
    }
  },

  /**
   * User completed their first scan.
   * Move from free-new to free-scanned.
   */
  async onFirstScanComplete(email: string): Promise<void> {
    if (!listsConfigured()) return;
    try {
      const subscriberId = await getSubscriberByEmail(email);
      if (!subscriberId) return;

      await moveSubscriber(subscriberId, [lists.freeNew], [lists.freeScanned]);
      logger.info(`[Listmonk] onFirstScanComplete: ${maskEmail(email)} → free-scanned`);
    } catch (error) {
      logger.error('[Listmonk] onFirstScanComplete failed', error as Error);
    }
  },

  /**
   * User started a trial (via Stripe checkout).
   * Move from free-new/free-scanned to trial-new.
   */
  async onTrialStart(email: string): Promise<void> {
    if (!listsConfigured()) return;
    try {
      const subscriberId = await getSubscriberByEmail(email);
      if (!subscriberId) return;

      await moveSubscriber(
        subscriberId,
        [lists.freeNew, lists.freeScanned],
        [lists.trialNew],
      );
      logger.info(`[Listmonk] onTrialStart: ${maskEmail(email)} → trial-new`);
    } catch (error) {
      logger.error('[Listmonk] onTrialStart failed', error as Error);
    }
  },

  /**
   * Trial user became active (2+ scans).
   * Move from trial-new to trial-active.
   */
  async onTrialActive(email: string): Promise<void> {
    if (!listsConfigured()) return;
    try {
      const subscriberId = await getSubscriberByEmail(email);
      if (!subscriberId) return;

      await moveSubscriber(subscriberId, [lists.trialNew], [lists.trialActive]);
      logger.info(`[Listmonk] onTrialActive: ${maskEmail(email)} → trial-active`);
    } catch (error) {
      logger.error('[Listmonk] onTrialActive failed', error as Error);
    }
  },

  /**
   * User paid (trial ended → active subscription).
   * Move from trial-new/trial-active to paid-pro or paid-team.
   */
  async onPayment(email: string, tier: 'pro' | 'team'): Promise<void> {
    if (!listsConfigured()) return;
    try {
      const subscriberId = await getSubscriberByEmail(email);
      if (!subscriberId) return;

      const targetList = tier === 'team' ? lists.paidTeam : lists.paidPro;
      await moveSubscriber(
        subscriberId,
        [lists.trialNew, lists.trialActive],
        [targetList],
      );
      logger.info(`[Listmonk] onPayment: ${maskEmail(email)} → paid-${tier}`);
    } catch (error) {
      logger.error('[Listmonk] onPayment failed', error as Error);
    }
  },

  /**
   * User changed plan (Pro ↔ Team).
   */
  async onPlanChange(email: string, fromTier: 'pro' | 'team', toTier: 'pro' | 'team'): Promise<void> {
    if (!listsConfigured() || fromTier === toTier) return;
    try {
      const subscriberId = await getSubscriberByEmail(email);
      if (!subscriberId) return;

      const fromList = fromTier === 'team' ? lists.paidTeam : lists.paidPro;
      const toList = toTier === 'team' ? lists.paidTeam : lists.paidPro;
      await moveSubscriber(subscriberId, [fromList], [toList]);
      logger.info(`[Listmonk] onPlanChange: ${maskEmail(email)} paid-${fromTier} → paid-${toTier}`);
    } catch (error) {
      logger.error('[Listmonk] onPlanChange failed', error as Error);
    }
  },

  /**
   * User churned (subscription canceled or deleted).
   * Move from any paid/trial list to subscribers.
   */
  async onChurn(email: string): Promise<void> {
    if (!listsConfigured()) return;
    try {
      const subscriberId = await getSubscriberByEmail(email);
      if (!subscriberId) return;

      await moveSubscriber(
        subscriberId,
        [lists.paidPro, lists.paidTeam, lists.trialNew, lists.trialActive],
        [lists.subscribers],
      );
      logger.info(`[Listmonk] onChurn: ${maskEmail(email)} → subscribers`);
    } catch (error) {
      logger.error('[Listmonk] onChurn failed', error as Error);
    }
  },

  // ── Transactional email & subscriber queries ────────────────────────

  /**
   * Send a transactional email via Listmonk.
   * Content lives in Listmonk templates — code just passes template ID + data.
   * Returns false if templateId is 0 (not configured yet).
   */
  async sendTx(params: {
    email: string;
    templateId: number;
    data?: Record<string, unknown>;
    fromEmail?: string;
  }): Promise<boolean> {
    if (params.templateId === 0) return false;
    const result = await apiRequest<unknown>(
      'POST',
      '/api/tx',
      {
        subscriber_email: params.email,
        template_id: params.templateId,
        data: params.data ?? {},
        ...(params.fromEmail ? { from_email: params.fromEmail } : {}),
      },
    );
    if (result !== null) {
      logger.info(`[Listmonk] TX → ${maskEmail(params.email)} (template ${params.templateId})`);
      return true;
    }
    return false;
  },

  /**
   * Query all subscribers in a Listmonk list.
   * Returns empty array if listId is 0 (not configured).
   */
  async queryByList(listId: number, perPage = 100): Promise<Array<{
    id: number;
    email: string;
    name: string;
    attribs: Record<string, unknown>;
    created_at: string;
  }>> {
    if (listId === 0) return [];
    const q = encodeURIComponent(
      `subscribers.id IN (SELECT subscriber_id FROM subscriber_lists WHERE list_id=${listId} AND status='confirmed')`
    );
    const result = await apiRequest<{
      data: { results: Array<{ id: number; email: string; name: string; attribs: Record<string, unknown>; created_at: string }> }
    }>('GET', `/api/subscribers?query=${q}&per_page=${perPage}`);
    return result?.data?.results ?? [];
  },

  /**
   * Update subscriber attributes by email (merges with existing).
   */
  async updateAttribsByEmail(email: string, attribs: Record<string, unknown>): Promise<boolean> {
    const subscriberId = await getSubscriberByEmail(email);
    if (!subscriberId) return false;

    const sub = await apiRequest<{ data: { email: string; name: string; status: string; attribs: Record<string, unknown> } }>(
      'GET', `/api/subscribers/${subscriberId}`
    );
    if (!sub) return false;

    const result = await apiRequest<unknown>(
      'PUT',
      `/api/subscribers/${subscriberId}`,
      {
        email: sub.data.email,
        name: sub.data.name,
        status: sub.data.status,
        attribs: { ...sub.data.attribs, ...attribs },
      },
    );
    return result !== null;
  },

  isConfigured,
  listsConfigured,
};

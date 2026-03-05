import { listmonkConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';

interface ListmonkSubscriber {
  id: number;
  email: string;
  name: string;
  status: 'enabled' | 'disabled' | 'blocklisted';
}

function getAuthHeader(): string {
  return 'Basic ' + Buffer.from(
    `${listmonkConfig.apiUser}:${listmonkConfig.apiPassword}`
  ).toString('base64');
}

function isConfigured(): boolean {
  return !!listmonkConfig.apiPassword;
}

function maskEmail(email: string): string {
  const [local] = email.split('@');
  return `${local?.slice(0, 3)}***`;
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
    const lists = (listIds ?? [listmonkConfig.defaultListId]).map(id => ({ id }));

    const result = await apiRequest<{ data: ListmonkSubscriber }>(
      'POST',
      '/api/subscribers',
      {
        email,
        name: name || '',
        status: 'enabled',
        lists,
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
    const search = await apiRequest<{ data: { results: ListmonkSubscriber[] } }>(
      'GET',
      `/api/subscribers?query=subscribers.email='${encodeURIComponent(email)}'&page=1&per_page=1`,
    );

    if (!search?.data?.results?.length) return false;

    const subscriberId = search.data.results[0].id;
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

  isConfigured,
};

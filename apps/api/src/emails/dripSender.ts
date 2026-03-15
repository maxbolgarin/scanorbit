/**
 * Drip email sender — renders templates and sends via Resend.
 * Renders Handlebars templates and sends via Resend API.
 */

import { getResendClient } from '../services/emailService.js';
import { renderTemplate } from './templateLoader.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

function maskEmail(email: string): string {
  const [local] = email.split('@');
  return `${local?.slice(0, 3)}***`;
}

/**
 * Send a drip campaign email via Resend.
 * Returns true on success, false on failure (never throws).
 */
export async function sendDripEmail(params: {
  email: string;
  sequenceName: string;
  template: string;
  subject: string;
  data: Record<string, unknown>;
  fromEmail?: string;
}): Promise<boolean> {
  const client = getResendClient();
  if (!client) {
    logger.warn('[Drip] Resend client not configured, skipping send');
    return false;
  }

  try {
    const html = renderTemplate(params.sequenceName, params.template, params.data);

    const { error } = await client.emails.send({
      from: params.fromEmail || config.email.from,
      to: params.email,
      subject: params.subject,
      html,
      tags: [
        { name: 'sequence', value: params.sequenceName },
        { name: 'template', value: params.template },
      ],
    });

    if (error) {
      logger.error(`[Drip] Resend send failed for ${maskEmail(params.email)}`, { error: error.message });
      return false;
    }

    logger.info(`[Drip] Sent ${params.sequenceName}/${params.template} → ${maskEmail(params.email)}`);
    return true;
  } catch (err) {
    logger.error(`[Drip] Failed to send ${params.sequenceName}/${params.template}`, err as Error);
    return false;
  }
}

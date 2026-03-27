import { eq, desc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { consentLogs } from '../db/schema.js';
import { logger } from '../lib/logger.js';

// Current version of terms and privacy policy
const CURRENT_TERMS_VERSION = '1.0';

// Mask email for logging (PII protection)
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***@***';
  const masked = localPart.length > 2
    ? `${localPart[0]}***${localPart[localPart.length - 1]}`
    : '***';
  return `${masked}@${domain}`;
}

interface ConsentMetadata {
  signupSource?: string;
  referrer?: string;
  [key: string]: unknown;
}

interface LogConsentParams {
  userId?: string;
  email: string;
  consentType: 'terms_and_privacy' | 'marketing' | 'processing_restriction' | 'objection' | 'withdrawal_waiver';
  consentGiven: boolean;
  ipAddress?: string;
  userAgent?: string;
  metadata?: ConsentMetadata;
}

export const consentService = {
  /**
   * Log user consent for GDPR compliance
   * This creates an immutable record of when and how consent was given
   */
  async logConsent(params: LogConsentParams): Promise<void> {
    const {
      userId,
      email,
      consentType,
      consentGiven,
      ipAddress,
      userAgent,
      metadata = {},
    } = params;

    await db.insert(consentLogs).values({
      userId: userId || null,
      email: email.toLowerCase(),
      consentType,
      consentVersion: CURRENT_TERMS_VERSION,
      consentGiven,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      metadata: {
        ...metadata,
        loggedAt: new Date().toISOString(),
      },
    });

    logger.info('Consent logged', { consentType, email: maskEmail(email), consentGiven });
  },

  /**
   * Log signup consent (terms and privacy policy)
   * Called when user completes signup
   */
  async logSignupConsent(params: {
    userId: string;
    email: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.logConsent({
      userId: params.userId,
      email: params.email,
      consentType: 'terms_and_privacy',
      consentGiven: true,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        signupSource: 'web',
        action: 'signup_completed',
      },
    });
  },

  /**
   * Log withdrawal waiver consent (EU 14-day cooling-off period waiver)
   * Called when user consents to immediate service access before checkout
   */
  async logWithdrawalWaiverConsent(params: {
    userId: string;
    email: string;
    orgId: string;
    targetTier: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.logConsent({
      userId: params.userId,
      email: params.email,
      consentType: 'withdrawal_waiver',
      consentGiven: true,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        action: 'checkout_withdrawal_waiver',
        orgId: params.orgId,
        targetTier: params.targetTier,
      },
    });
  },

  /**
   * Get consent history for a user (for GDPR data export)
   */
  async getConsentHistory(email: string) {
    return db
      .select()
      .from(consentLogs)
      .where(eq(consentLogs.email, email.toLowerCase()))
      .orderBy(desc(consentLogs.consentedAt));
  },

  /**
   * Get current terms version
   */
  getCurrentTermsVersion(): string {
    return CURRENT_TERMS_VERSION;
  },
};

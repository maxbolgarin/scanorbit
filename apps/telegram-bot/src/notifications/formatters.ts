import type { TelegramEvent } from '../types.js';

export function formatEvent(event: TelegramEvent): string {
  switch (event.type) {
    case 'user_signup':
      return (
        `<b>New User Signup</b>\n` +
        `User: <code>${event.userId.slice(0, 8)}</code>\n` +
        `Method: ${event.method}`
      );

    case 'scan_started':
      return (
        `<b>Scan Started</b>\n` +
        `Org: <code>${event.orgId.slice(0, 8)}</code>\n` +
        `Scan: <code>${event.scanId.slice(0, 8)}</code>`
      );

    case 'aws_account_connected':
      return (
        `<b>AWS Account Connected</b>\n` +
        `Org: <code>${event.orgId.slice(0, 8)}</code>\n` +
        `AWS ID: <code>${event.awsAccountId}</code>`
      );

    case 'subscription_change': {
      const labels: Record<string, string> = {
        trial_started: 'Trial Started',
        activated: 'Subscription Activated',
        canceled: 'Subscription Canceled',
        payment_failed: 'Payment Failed',
      };
      return (
        `<b>${labels[event.event] || event.event}</b>\n` +
        `Org: <code>${event.orgId.slice(0, 8)}</code>\n` +
        `Tier: ${event.tier.toUpperCase()}`
      );
    }

    case 'stuck_jobs':
      return (
        `<b>Stuck Jobs Recovered</b>\n` +
        `Recovered: ${event.stuckJobsRecovered}\n` +
        `Scans errored: ${event.stuckScansErrored}\n` +
        `Moved to DLQ: ${event.jobsMovedToDLQ}`
      );
  }
}

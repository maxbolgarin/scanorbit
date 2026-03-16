export type TelegramEvent =
  | { type: 'user_signup'; email: string; method: 'email' | 'google' | 'github'; timestamp: string }
  | { type: 'scan_started'; orgId: string; accountName: string; scanId: string; timestamp: string }
  | { type: 'aws_account_connected'; orgId: string; accountName: string; awsAccountId: string; timestamp: string }
  | { type: 'subscription_change'; orgId: string; orgName: string; tier: string; event: 'trial_started' | 'activated' | 'canceled' | 'payment_failed'; timestamp: string }
  | { type: 'stuck_jobs'; stuckJobsRecovered: number; stuckScansErrored: number; jobsMovedToDLQ: number; timestamp: string };

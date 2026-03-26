export type TelegramEvent =
  | { type: 'user_signup'; userId: string; method: 'email' | 'google' | 'github'; timestamp: string }
  | { type: 'scan_started'; orgId: string; scanId: string; timestamp: string }
  | { type: 'aws_account_connected'; orgId: string; awsAccountId: string; timestamp: string }
  | { type: 'subscription_change'; orgId: string; tier: string; event: 'trial_started' | 'activated' | 'canceled' | 'payment_failed'; timestamp: string }
  | { type: 'stuck_jobs'; stuckJobsRecovered: number; stuckScansErrored: number; jobsMovedToDLQ: number; timestamp: string };

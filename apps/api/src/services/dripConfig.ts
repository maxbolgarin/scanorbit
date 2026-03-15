/**
 * Drip campaign sequence configuration.
 * Maps (sequence, day) → template file + subject line.
 *
 * Templates live in src/emails/templates/{sequence.name}/{step.template}.html
 */

export interface DripStep {
  day: number;
  template: string;
  subject: string;
  fromEmail?: string;
  /** If set, the step is only sent when this subscriber attribute is present (truthy). */
  requiredAttrib?: string;
}

export interface DripSequence {
  name: string;
  dateAttrib?: string;
  steps: DripStep[];
}

export const SEQUENCES: DripSequence[] = [
  {
    name: 'free-new',
    dateAttrib: 'signup_at',
    steps: [
      { day: 0, template: 'day0-welcome', subject: 'Your account is ready — here\'s how to run your first scan' },
      { day: 2, template: 'day2-security', subject: 'Connecting your AWS account is safe — here\'s why' },
      { day: 5, template: 'day5-value', subject: 'What are you missing in your AWS account?' },
    ],
  },
  {
    name: 'free-scanned',
    dateAttrib: 'scan_completed_at',
    steps: [
      { day: 0, template: 'day0-results', subject: 'Your scan results are ready' },
      { day: 2, template: 'day2-critical', subject: 'About your critical findings' },
      { day: 5, template: 'day5-cost', subject: 'Your AWS account is probably wasting money' },
      { day: 10, template: 'day10-breakup', subject: 'Your scan data has a shelf life', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
    ],
  },
  {
    name: 'trial-new',
    dateAttrib: 'trial_started_at',
    steps: [
      { day: 0, template: 'day0-welcome', subject: 'Your 7-day Pro trial is active' },
      { day: 3, template: 'day3-stuck', subject: 'Need help getting started?' },
    ],
  },
  {
    name: 'trial-active',
    dateAttrib: 'trial_started_at',
    steps: [
      { day: 3, template: 'day3-deepen', subject: 'Getting more from your scans' },
      { day: 5, template: 'day5-warning', subject: '2 days left on your trial' },
      { day: 6, template: 'day6-lastday', subject: 'Your trial ends tomorrow' },
      { day: 9, template: 'day9-winback', subject: 'Your findings are still there', fromEmail: 'Maksim <maksim@scanorbit.cloud>', requiredAttrib: 'trial_cancelled_at' },
    ],
  },
  {
    name: 'subscribers',
    dateAttrib: 'subscribed_at',
    steps: [
      { day: 0, template: 'day0-welcome', subject: 'Welcome — here\'s what most AWS accounts get wrong', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
      { day: 3, template: 'day3-security', subject: '5 AWS misconfigurations that show up in almost every account', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
      { day: 7, template: 'day7-cost', subject: 'Your AWS bill probably has 20% waste in it', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
      { day: 11, template: 'day11-gdpr', subject: 'Is your AWS infrastructure actually GDPR-compliant?', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
      { day: 16, template: 'day16-social-proof', subject: 'What a first scan usually reveals', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
      { day: 21, template: 'day21-final-cta', subject: 'Your free AWS scan is waiting', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
    ],
  },
  {
    name: 'cold-leads',
    dateAttrib: 'imported_at',
    steps: [
      { day: 0, template: 'day0-pain', subject: 'Quick question about your AWS setup', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
      { day: 4, template: 'day4-gdpr', subject: 'Where are your AWS resources actually running?', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
      { day: 10, template: 'day10-breakup', subject: 'Last one from me', fromEmail: 'Maksim <maksim@scanorbit.cloud>' },
    ],
  },
  {
    name: 'paid-pro',
    dateAttrib: 'paid_at',
    steps: [
      { day: 0, template: 'day0-welcome', subject: 'Welcome to Pro — you\'re all set' },
    ],
  },
  {
    name: 'paid-team',
    dateAttrib: 'paid_at',
    steps: [
      { day: 0, template: 'day0-welcome', subject: 'Your Team plan is active' },
    ],
  },
];

/**
 * setup-listmonk.ts
 *
 * Run once to create all 8 lists and 24 transactional templates in Listmonk via API.
 * Outputs the IDs to paste into .env/.env.prod.
 *
 * USAGE:
 *   LISTMONK_URL=http://localhost:9000 \
 *   LISTMONK_USER=admin \
 *   LISTMONK_TOKEN=your-token \
 *   pnpm dlx tsx apps/listmonk-setup/setup_listmonk.ts
 *
 * Or with node (compile first):
 *   node dist/setup-listmonk.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────

const BASE_URL = (process.env.LISTMONK_URL || 'http://localhost:9000').replace(/\/+$/, '');
const USERNAME = process.env.LISTMONK_USER || 'admin';
// LISTMONK_TOKEN can be either a Listmonk API token or the admin password.
const TOKEN = process.env.LISTMONK_TOKEN || '';

if (!TOKEN) {
  console.error('Set LISTMONK_TOKEN env var');
  process.exit(1);
}

const AUTH = `Basic ${Buffer.from(`${USERNAME}:${TOKEN}`).toString('base64')}`;

// ─── API helper ──────────────────────────────────────────────────────

async function api(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: AUTH },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

// ─── Lists ───────────────────────────────────────────────────────────

const LISTS_TO_CREATE: ListDef[] = [
  { name: 'cold-leads',    type: 'private', optin: 'single', description: 'Manually imported prospects' },
  { name: 'subscribers',   type: 'public',  optin: 'double', description: 'Opted in via website, blog, lead magnets' },
  { name: 'free-new',      type: 'private', optin: 'single', description: 'Signed up, haven\'t scanned yet' },
  { name: 'free-scanned',  type: 'private', optin: 'single', description: 'Completed their one free scan' },
  { name: 'trial-new',     type: 'private', optin: 'single', description: 'Started trial, low activity' },
  { name: 'trial-active',  type: 'private', optin: 'single', description: 'Trial users actively using the product' },
  { name: 'paid-pro',      type: 'private', optin: 'single', description: 'Paying Pro customers' },
  { name: 'paid-team',     type: 'private', optin: 'single', description: 'Paying Team customers' },
];

// ─── Templates ───────────────────────────────────────────────────────

const TEMPLATE_DIR_CANDIDATES = [
  path.join(__dirname, 'templates'),
];

const TEMPLATES_DIR = TEMPLATE_DIR_CANDIDATES.find(candidate => fs.existsSync(candidate));

if (!TEMPLATES_DIR) {
  console.error(`Template directory not found. Checked: ${TEMPLATE_DIR_CANDIDATES.join(', ')}`);
  process.exit(1);
}

const RESOLVED_TEMPLATES_DIR = TEMPLATES_DIR;

interface TemplateDef {
  filename: string;
  name: string;
  subject: string;
  sequence: string;
  day: number;
}

interface ListDef {
  name: string;
  type: 'private' | 'public';
  optin: 'single' | 'double';
  description: string;
}

interface ExistingList {
  id: number;
  name: string;
}

interface ExistingTemplate {
  id: number;
  name: string;
}

const TEMPLATES_TO_CREATE: TemplateDef[] = [
  // Cold leads
  { filename: '01-cold-day0-pain.html',               name: 'cold-day0-pain',               subject: 'Quick question about your AWS setup',                        sequence: 'cold-leads', day: 0 },
  { filename: '02-cold-day4-gdpr.html',               name: 'cold-day4-gdpr',               subject: 'Where are your AWS resources actually running?',             sequence: 'cold-leads', day: 4 },
  { filename: '03-cold-day10-breakup.html',            name: 'cold-day10-breakup',            subject: 'Last one from me',                                           sequence: 'cold-leads', day: 10 },
  // Subscribers
  { filename: '04-subs-day0-welcome.html',             name: 'subs-day0-welcome',             subject: "Welcome — here's what most AWS accounts get wrong",          sequence: 'subscribers', day: 0 },
  { filename: '05-subs-day3-security.html',            name: 'subs-day3-security',            subject: '5 AWS misconfigurations that show up in almost every account', sequence: 'subscribers', day: 3 },
  { filename: '06-subs-day7-cost.html',                name: 'subs-day7-cost',                subject: 'Your AWS bill probably has 20% waste in it',                 sequence: 'subscribers', day: 7 },
  { filename: '07-subs-day11-gdpr.html',               name: 'subs-day11-gdpr',               subject: 'Is your AWS infrastructure actually GDPR-compliant?',        sequence: 'subscribers', day: 11 },
  { filename: '08-subs-day16-social-proof.html',       name: 'subs-day16-social-proof',       subject: 'What a first scan usually reveals',                          sequence: 'subscribers', day: 16 },
  { filename: '09-subs-day21-final-cta.html',          name: 'subs-day21-final-cta',          subject: 'Your free AWS scan is waiting',                              sequence: 'subscribers', day: 21 },
  // Free-new
  { filename: '10-free-new-day0-welcome.html',         name: 'free-new-day0-welcome',         subject: "Your account is ready — here's how to run your first scan",  sequence: 'free-new', day: 0 },
  { filename: '11-free-new-day2-security.html',        name: 'free-new-day2-security',        subject: "Connecting your AWS account is safe — here's why",           sequence: 'free-new', day: 2 },
  { filename: '12-free-new-day5-value.html',           name: 'free-new-day5-value',           subject: 'What are you missing in your AWS account?',                  sequence: 'free-new', day: 5 },
  // Free-scanned
  { filename: '13-free-scanned-day0-results.html',     name: 'free-scanned-day0-results',     subject: 'Your scan results are ready',                                sequence: 'free-scanned', day: 0 },
  { filename: '14-free-scanned-day2-critical.html',    name: 'free-scanned-day2-critical',    subject: 'About your critical findings',                               sequence: 'free-scanned', day: 2 },
  { filename: '15-free-scanned-day5-cost.html',        name: 'free-scanned-day5-cost',        subject: 'Your AWS account is probably wasting money',                 sequence: 'free-scanned', day: 5 },
  { filename: '16-free-scanned-day10-breakup.html',    name: 'free-scanned-day10-breakup',    subject: 'Your scan data has a shelf life',                            sequence: 'free-scanned', day: 10 },
  // Trial-new
  { filename: '17-trial-new-day0-welcome.html',        name: 'trial-new-day0-welcome',        subject: 'Your 7-day Pro trial is active',                             sequence: 'trial-new', day: 0 },
  { filename: '18-trial-new-day3-stuck.html',          name: 'trial-new-day3-stuck',          subject: 'Need help getting started?',                                 sequence: 'trial-new', day: 3 },
  // Trial-active
  { filename: '19-trial-active-day3-deepen.html',      name: 'trial-active-day3-deepen',      subject: 'Getting more from your scans',                               sequence: 'trial-active', day: 3 },
  { filename: '20-trial-active-day5-warning.html',     name: 'trial-active-day5-warning',     subject: '2 days left on your trial',                                  sequence: 'trial-active', day: 5 },
  { filename: '21-trial-active-day6-lastday.html',     name: 'trial-active-day6-lastday',     subject: 'Your trial ends tomorrow',                                   sequence: 'trial-active', day: 6 },
  { filename: '22-trial-active-day9-winback.html',     name: 'trial-active-day9-winback',     subject: 'Your findings are still there',                              sequence: 'trial-active', day: 9 },
  // Paid
  { filename: '23-paid-pro-day0-welcome.html',         name: 'paid-pro-day0-welcome',         subject: "Welcome to Pro — you're all set",                            sequence: 'paid-pro', day: 0 },
  { filename: '24-paid-team-day0-welcome.html',        name: 'paid-team-day0-welcome',        subject: 'Your Team plan is active',                                   sequence: 'paid-team', day: 0 },
];

async function fetchExistingLists(): Promise<Map<string, ExistingList>> {
  const res = await api('GET', '/api/lists?per_page=all');
  const lists = Array.isArray(res?.data?.results) ? res.data.results : [];

  return new Map(
    lists
      .filter((list: any) => typeof list?.name === 'string' && typeof list?.id === 'number')
      .map((list: any) => [list.name, { id: list.id, name: list.name }]),
  );
}

async function fetchExistingTemplates(): Promise<Map<string, ExistingTemplate>> {
  const res = await api('GET', '/api/templates');
  const templates = Array.isArray(res?.data) ? res.data : [];

  return new Map(
    templates
      .filter((template: any) => typeof template?.name === 'string' && typeof template?.id === 'number')
      .map((template: any) => [template.name, { id: template.id, name: template.name }]),
  );
}

async function upsertList(list: ListDef, existingLists: Map<string, ExistingList>): Promise<number> {
  const payload = {
    name: list.name,
    type: list.type,
    optin: list.optin,
    status: 'active',
    description: list.description,
    tags: ['scanorbit', 'auto-created'],
  };

  const existing = existingLists.get(list.name);

  if (existing) {
    await api('PUT', `/api/lists/${existing.id}`, payload);
    return existing.id;
  }

  const res = await api('POST', '/api/lists', payload);
  const id = res.data.id;
  existingLists.set(list.name, { id, name: list.name });
  return id;
}

async function upsertTemplate(
  tpl: TemplateDef,
  body: string,
  existingTemplates: Map<string, ExistingTemplate>,
): Promise<number> {
  const payload = {
    name: tpl.name,
    type: 'tx',
    subject: tpl.subject,
    body,
  };

  const existing = existingTemplates.get(tpl.name);

  if (existing) {
    await api('PUT', `/api/templates/${existing.id}`, payload);
    return existing.id;
  }

  const res = await api('POST', '/api/templates', payload);
  const id = res.data.id;
  existingTemplates.set(tpl.name, { id, name: tpl.name });
  return id;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`Connecting to Listmonk at ${BASE_URL}...\n`);
  const [existingLists, existingTemplates] = await Promise.all([
    fetchExistingLists(),
    fetchExistingTemplates(),
  ]);

  // ── Create lists ───────────────────────────────────────────────────

  console.log('=== Syncing Lists ===\n');
  const listIds: Record<string, number> = {};

  for (const list of LISTS_TO_CREATE) {
    try {
      const existed = existingLists.has(list.name);
      const id = await upsertList(list, existingLists);
      listIds[list.name] = id;
      console.log(`  ${existed ? '↻' : '✓'} List "${list.name}" → ID ${id}`);
    } catch (err: any) {
      console.error(`  ✗ Failed to sync list "${list.name}":`, err.message);
    }
  }

  // ── Create transactional templates ─────────────────────────────────

  console.log('\n=== Syncing Transactional Templates ===\n');
  const templateIds: Record<string, number> = {};

  for (const tpl of TEMPLATES_TO_CREATE) {
    const filepath = path.join(RESOLVED_TEMPLATES_DIR, tpl.filename);

    if (!fs.existsSync(filepath)) {
      console.error(`  ✗ File not found: ${filepath}`);
      continue;
    }

    const body = fs.readFileSync(filepath, 'utf-8');

    try {
      const existed = existingTemplates.has(tpl.name);
      const id = await upsertTemplate(tpl, body, existingTemplates);
      templateIds[tpl.name] = id;
      console.log(`  ${existed ? '↻' : '✓'} Template "${tpl.name}" → ID ${id}`);
    } catch (err: any) {
      console.error(`  ✗ Failed to sync template "${tpl.name}":`, err.message);
    }
  }

  // ── Output config ──────────────────────────────────────────────────

  console.log('\n=== Generated Config ===\n');

  console.log('// Paste into .env/.env.prod:\n');
  const listKeyMap: Record<string, string> = {
    'cold-leads': 'LISTMONK_LIST_COLD_LEADS',
    'subscribers': 'LISTMONK_LIST_SUBSCRIBERS',
    'free-new': 'LISTMONK_LIST_FREE_NEW',
    'free-scanned': 'LISTMONK_LIST_FREE_SCANNED',
    'trial-new': 'LISTMONK_LIST_TRIAL_NEW',
    'trial-active': 'LISTMONK_LIST_TRIAL_ACTIVE',
    'paid-pro': 'LISTMONK_LIST_PAID_PRO',
    'paid-team': 'LISTMONK_LIST_PAID_TEAM',
  };
  for (const [name, key] of Object.entries(listKeyMap)) {
    const id = listIds[name] ?? 0;
    console.log(`${key}=${id}`);
  }
  console.log('');

  console.log('// Template IDs:\n');
  const templateKeyMap: Record<string, string> = {
    'cold-day0-pain': 'LISTMONK_TEMPLATE_COLD_DAY0_PAIN',
    'cold-day4-gdpr': 'LISTMONK_TEMPLATE_COLD_DAY4_GDPR',
    'cold-day10-breakup': 'LISTMONK_TEMPLATE_COLD_DAY10_BREAKUP',
    'subs-day0-welcome': 'LISTMONK_TEMPLATE_SUBS_DAY0_WELCOME',
    'subs-day3-security': 'LISTMONK_TEMPLATE_SUBS_DAY3_SECURITY',
    'subs-day7-cost': 'LISTMONK_TEMPLATE_SUBS_DAY7_COST',
    'subs-day11-gdpr': 'LISTMONK_TEMPLATE_SUBS_DAY11_GDPR',
    'subs-day16-social-proof': 'LISTMONK_TEMPLATE_SUBS_DAY16_SOCIAL_PROOF',
    'subs-day21-final-cta': 'LISTMONK_TEMPLATE_SUBS_DAY21_FINAL_CTA',
    'free-new-day0-welcome': 'LISTMONK_TEMPLATE_FREE_NEW_DAY0_WELCOME',
    'free-new-day2-security': 'LISTMONK_TEMPLATE_FREE_NEW_DAY2_SECURITY',
    'free-new-day5-value': 'LISTMONK_TEMPLATE_FREE_NEW_DAY5_VALUE',
    'free-scanned-day0-results': 'LISTMONK_TEMPLATE_FREE_SCANNED_DAY0_RESULTS',
    'free-scanned-day2-critical': 'LISTMONK_TEMPLATE_FREE_SCANNED_DAY2_CRITICAL',
    'free-scanned-day5-cost': 'LISTMONK_TEMPLATE_FREE_SCANNED_DAY5_COST',
    'free-scanned-day10-breakup': 'LISTMONK_TEMPLATE_FREE_SCANNED_DAY10_BREAKUP',
    'trial-new-day0-welcome': 'LISTMONK_TEMPLATE_TRIAL_NEW_DAY0_WELCOME',
    'trial-new-day3-stuck': 'LISTMONK_TEMPLATE_TRIAL_NEW_DAY3_STUCK',
    'trial-active-day3-deepen': 'LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY3_DEEPEN',
    'trial-active-day5-warning': 'LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY5_WARNING',
    'trial-active-day6-lastday': 'LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY6_LASTDAY',
    'trial-active-day9-winback': 'LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY9_WINBACK',
    'paid-pro-day0-welcome': 'LISTMONK_TEMPLATE_PAID_PRO_DAY0_WELCOME',
    'paid-team-day0-welcome': 'LISTMONK_TEMPLATE_PAID_TEAM_DAY0_WELCOME',
  };

  for (const [name, key] of Object.entries(templateKeyMap)) {
    const id = templateIds[name] ?? 0;
    console.log(`${key}=${id}`);
  }
  console.log('');

  const configOut = {
    lists: listIds,
    templates: templateIds,
    generatedAt: new Date().toISOString(),
  };
  const configPath = path.join(__dirname, 'listmonk-ids.json');
  fs.writeFileSync(configPath, JSON.stringify(configOut, null, 2));
  console.log(`\nIDs saved to ${configPath}`);
  console.log('\nDone! Review the templates in Listmonk UI → Campaigns → Templates');
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});

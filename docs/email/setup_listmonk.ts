/**
 * setup-listmonk.ts
 *
 * Run once to create all 8 lists and 24 transactional templates in Listmonk via API.
 * Outputs the IDs to paste into drip-config.ts and listmonk-client.ts.
 *
 * USAGE:
 *   LISTMONK_URL=http://localhost:9000 \
 *   LISTMONK_USER=admin \
 *   LISTMONK_TOKEN=your-token \
 *   npx ts-node setup-listmonk.ts
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

const LISTS_TO_CREATE = [
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

const TEMPLATES_DIR = path.join(__dirname, 'templates');

interface TemplateDef {
  filename: string;
  name: string;
  subject: string;
  sequence: string;
  day: number;
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

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`Connecting to Listmonk at ${BASE_URL}...\n`);

  // ── Create lists ───────────────────────────────────────────────────

  console.log('=== Creating Lists ===\n');
  const listIds: Record<string, number> = {};

  for (const list of LISTS_TO_CREATE) {
    try {
      const res = await api('POST', '/api/lists', {
        name: list.name,
        type: list.type,
        optin: list.optin,
        description: list.description,
        tags: ['scanorbit', 'auto-created'],
      });
      const id = res.data.id;
      listIds[list.name] = id;
      console.log(`  ✓ List "${list.name}" → ID ${id}`);
    } catch (err: any) {
      // List might already exist
      if (err.message.includes('duplicate') || err.message.includes('exists')) {
        console.log(`  ⊘ List "${list.name}" already exists, fetching ID...`);
        const all = await api('GET', '/api/lists?per_page=50');
        const found = all.data.results.find((l: any) => l.name === list.name);
        if (found) {
          listIds[list.name] = found.id;
          console.log(`    → ID ${found.id}`);
        }
      } else {
        console.error(`  ✗ Failed to create list "${list.name}":`, err.message);
      }
    }
  }

  // ── Create transactional templates ─────────────────────────────────

  console.log('\n=== Creating Transactional Templates ===\n');
  const templateIds: Record<string, number> = {};

  for (const tpl of TEMPLATES_TO_CREATE) {
    const filepath = path.join(TEMPLATES_DIR, tpl.filename);

    if (!fs.existsSync(filepath)) {
      console.error(`  ✗ File not found: ${filepath}`);
      continue;
    }

    const body = fs.readFileSync(filepath, 'utf-8');

    try {
      const res = await api('POST', '/api/templates', {
        name: tpl.name,
        type: 'tx',           // "tx" = transactional template
        subject: tpl.subject,
        body: body,
      });
      const id = res.data.id;
      templateIds[tpl.name] = id;
      console.log(`  ✓ Template "${tpl.name}" → ID ${id}`);
    } catch (err: any) {
      if (err.message.includes('duplicate') || err.message.includes('exists')) {
        console.log(`  ⊘ Template "${tpl.name}" already exists, skipping`);
      } else {
        console.error(`  ✗ Failed to create template "${tpl.name}":`, err.message);
      }
    }
  }

  // ── Output config ──────────────────────────────────────────────────

  console.log('\n=== Generated Config ===\n');

  // List IDs for listmonk-client.ts
  console.log('// Paste into LISTS in listmonk-client.ts:\n');
  console.log('export const LISTS = {');
  const listKeyMap: Record<string, string> = {
    'cold-leads': 'COLD_LEADS', 'subscribers': 'SUBSCRIBERS',
    'free-new': 'FREE_NEW', 'free-scanned': 'FREE_SCANNED',
    'trial-new': 'TRIAL_NEW', 'trial-active': 'TRIAL_ACTIVE',
    'paid-pro': 'PAID_PRO', 'paid-team': 'PAID_TEAM',
  };
  for (const [name, key] of Object.entries(listKeyMap)) {
    const id = listIds[name] ?? 0;
    console.log(`  ${key}: ${id},`);
  }
  console.log('} as const;\n');

  // Template IDs for drip-config.ts
  console.log('// Paste into SEQUENCES in drip-config.ts:\n');

  const sequenceGroups: Record<string, { day: number; templateId: number; name: string }[]> = {};
  for (const tpl of TEMPLATES_TO_CREATE) {
    if (!sequenceGroups[tpl.sequence]) sequenceGroups[tpl.sequence] = [];
    sequenceGroups[tpl.sequence].push({
      day: tpl.day,
      templateId: templateIds[tpl.name] ?? 0,
      name: tpl.name,
    });
  }

  for (const [seq, steps] of Object.entries(sequenceGroups)) {
    console.log(`// ${seq}`);
    console.log(`steps: [`);
    for (const step of steps) {
      const from = seq === 'cold-leads'
        ? `, fromEmail: 'Maksim <maksim@scanorbit.cloud>'`
        : step.name.includes('breakup') || step.name.includes('winback')
          ? `, fromEmail: 'Maksim <maksim@scanorbit.cloud>'`
          : '';
      console.log(`  { day: ${step.day}, templateId: ${step.templateId}${from} },  // ${step.name}`);
    }
    console.log(`],\n`);
  }

  // ── Write config file ──────────────────────────────────────────────

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
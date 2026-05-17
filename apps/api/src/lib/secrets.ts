import { readFileSync } from 'fs';

const SECRETS_DIR = '/run/secrets';

/**
 * Read a Docker secret from /run/secrets/<name>, falling back to env var.
 * In development, secret files don't exist, so env vars are used.
 */
export function readSecret(envKey: string, secretName: string, defaultValue: string = ''): string {
  try {
    return readFileSync(`${SECRETS_DIR}/${secretName}`, 'utf8').trim();
  } catch {
    // Secret file not found — fall back to environment variable
  }
  return process.env[envKey] || defaultValue;
}

/**
 * Read a required secret. Throws in any environment if neither secret file
 * nor env var is set — never silently falls back to a hard-coded value.
 */
export function readRequiredSecret(envKey: string, secretName: string): string {
  try {
    return readFileSync(`${SECRETS_DIR}/${secretName}`, 'utf8').trim();
  } catch {
    // Secret file not found — fall back to environment variable
  }

  const value = process.env[envKey];
  if (value && value.length > 0) return value;

  throw new Error(
    `${envKey} is required. Generate one with \`openssl rand -hex 32\` and ` +
    `set ${envKey}=<value> in .env (or mount /run/secrets/${secretName}).`,
  );
}

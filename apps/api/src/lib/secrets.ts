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
 * Read a required secret. Throws in production if neither secret file nor env var exists.
 */
export function readRequiredSecret(envKey: string, secretName: string, devDefault: string): string {
  try {
    return readFileSync(`${SECRETS_DIR}/${secretName}`, 'utf8').trim();
  } catch {
    // Secret file not found — fall back to environment variable
  }

  if (process.env[envKey]) {
    return process.env[envKey]!;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Secret '${secretName}' (env: ${envKey}) is required in production`);
  }

  return devDefault;
}

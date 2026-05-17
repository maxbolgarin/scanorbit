/**
 * Type-safe utilities for extracting data from raw AWS API responses.
 * These functions handle null/undefined gracefully and provide runtime type checking.
 */

// Base helper functions for safe extraction
export function getString(obj: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!obj) return null;
  const value = obj[key];
  return typeof value === 'string' ? value : null;
}

export function getNumber(obj: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!obj) return null;
  const value = obj[key];
  return typeof value === 'number' ? value : null;
}

export function getBoolean(obj: Record<string, unknown> | null | undefined, key: string): boolean | null {
  if (!obj) return null;
  const value = obj[key];
  return typeof value === 'boolean' ? value : null;
}

export function getArray<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  key: string
): T[] {
  if (!obj) return [];
  const value = obj[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

export function getObject(
  obj: Record<string, unknown> | null | undefined,
  key: string
): Record<string, unknown> | null {
  if (!obj) return null;
  const value = obj[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getNestedString(
  obj: Record<string, unknown> | null | undefined,
  ...path: string[]
): string | null {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

export function getNestedNumber(
  obj: Record<string, unknown> | null | undefined,
  ...path: string[]
): number | null {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'number' ? current : null;
}

export function getNestedBoolean(
  obj: Record<string, unknown> | null | undefined,
  ...path: string[]
): boolean | null {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'boolean' ? current : null;
}

// Format helpers
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatGiB(gib: number | null | undefined): string {
  if (gib === null || gib === undefined) return '-';
  return `${gib} GiB`;
}

export function formatMiB(mib: number | null | undefined): string {
  if (mib === null || mib === undefined) return '-';
  return `${mib} MiB`;
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

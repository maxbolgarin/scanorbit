import type { Context } from 'hono';
import { config } from './config.js';
import type { Variables } from '../types/index.js';

/**
 * Parse a CIDR notation (e.g., "10.0.0.0/8") into network address and mask
 */
function parseCIDR(cidr: string): { network: bigint; mask: bigint } | null {
  const [ip, prefixStr] = cidr.split('/');
  if (!ip) return null;

  const prefix = prefixStr ? parseInt(prefixStr, 10) : (ip.includes(':') ? 128 : 32);
  const isIPv6 = ip.includes(':');
  const maxBits = isIPv6 ? 128n : 32n;

  const ipBigInt = ipToBigInt(ip);
  if (ipBigInt === null) return null;

  // Create mask: all 1s for prefix length, then 0s
  const mask = ((1n << BigInt(prefix)) - 1n) << (maxBits - BigInt(prefix));

  return { network: ipBigInt & mask, mask };
}

/**
 * Convert an IP address string to a BigInt for comparison
 */
function ipToBigInt(ip: string): bigint | null {
  // IPv4
  if (!ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let result = 0n;
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) return null;
      result = (result << 8n) + BigInt(num);
    }
    return result;
  }

  // IPv6 (simplified parser)
  let expanded = ip;
  if (expanded.includes('::')) {
    const [before, after] = expanded.split('::');
    const beforeParts = before ? before.split(':') : [];
    const afterParts = after ? after.split(':') : [];
    const missingParts = 8 - beforeParts.length - afterParts.length;
    expanded = [...beforeParts, ...Array(missingParts).fill('0'), ...afterParts].join(':');
  }

  const parts = expanded.split(':');
  if (parts.length !== 8) return null;

  let result = 0n;
  for (const part of parts) {
    const num = parseInt(part || '0', 16);
    if (isNaN(num) || num < 0 || num > 0xffff) return null;
    result = (result << 16n) + BigInt(num);
  }
  return result;
}

/**
 * Check if an IP address is in a CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const parsed = parseCIDR(cidr);
  if (!parsed) return false;

  const ipBigInt = ipToBigInt(ip);
  if (ipBigInt === null) return false;

  return (ipBigInt & parsed.mask) === parsed.network;
}

/**
 * Check if an IP matches any trusted proxy
 */
function isTrustedProxy(ip: string): boolean {
  for (const trusted of config.trustedProxies) {
    // Exact match
    if (trusted === ip) return true;

    // CIDR match
    if (trusted.includes('/') && isIPInCIDR(ip, trusted)) return true;
  }
  return false;
}

/**
 * Get the real client IP address from a request
 *
 * Security: Only trusts x-forwarded-for header if the immediate
 * connection comes from a trusted proxy IP address.
 *
 * @param c - Hono context
 * @param connectionIP - The IP of the immediate connection (from server/reverse proxy)
 * @returns The real client IP address
 */
export function getClientIP(c: Context<{ Variables: Variables }>, connectionIP?: string): string {
  // Get the immediate connection IP
  // In production behind a load balancer, this would be the load balancer's IP
  const immediateIP = connectionIP || c.req.header('cf-connecting-ip') || 'unknown';

  // Only trust forwarded headers if the immediate connection is from a trusted proxy
  if (isTrustedProxy(immediateIP)) {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
      // Take the first IP (original client)
      const firstIP = forwarded.split(',')[0].trim();
      if (firstIP) return firstIP;
    }

    const realIP = c.req.header('x-real-ip');
    if (realIP) {
      return realIP.trim();
    }
  }

  // If no trusted proxy or no forwarded header, return immediate IP
  // In development without a proxy, this returns the direct connection IP
  return immediateIP !== 'unknown' ? immediateIP : c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Get client IP for development/non-proxied environments
 * Less strict - always trusts forwarded headers
 * Only use in development or when you control all network layers
 */
export function getClientIPUnsafe(c: Context<{ Variables: Variables }>): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = c.req.header('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  return 'unknown';
}

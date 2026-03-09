import { describe, it, expect, vi } from 'vitest';
import type { Context } from 'hono';
import type { Variables } from '../../types/index.js';

vi.mock('../../lib/config.js', () => ({
  config: {
    trustedProxies: ['10.0.0.0/8', '172.16.0.0/12', '192.168.1.1'],
  },
}));

import { getClientIP, getClientIPUnsafe } from '../../lib/ip.js';

function createMockContext(headers: Record<string, string> = {}): Context<{ Variables: Variables }> {
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()] || undefined,
    },
  } as unknown as Context<{ Variables: Variables }>;
}

describe('getClientIP', () => {
  it('returns cf-connecting-ip when no trusted proxy', () => {
    const c = createMockContext({ 'cf-connecting-ip': '1.2.3.4' });
    expect(getClientIP(c)).toBe('1.2.3.4');
  });

  it('trusts x-forwarded-for from trusted proxy (exact match)', () => {
    const c = createMockContext({
      'x-forwarded-for': '5.6.7.8, 192.168.1.1',
    });
    expect(getClientIP(c, '192.168.1.1')).toBe('5.6.7.8');
  });

  it('trusts x-forwarded-for from trusted proxy (CIDR match)', () => {
    const c = createMockContext({
      'x-forwarded-for': '5.6.7.8',
    });
    expect(getClientIP(c, '10.1.2.3')).toBe('5.6.7.8');
  });

  it('does not trust x-forwarded-for from untrusted IP', () => {
    const c = createMockContext({
      'x-forwarded-for': '5.6.7.8',
    });
    expect(getClientIP(c, '203.0.113.1')).toBe('203.0.113.1');
  });

  it('uses x-real-ip from trusted proxy when no x-forwarded-for', () => {
    const c = createMockContext({
      'x-real-ip': '9.8.7.6',
    });
    expect(getClientIP(c, '10.0.0.1')).toBe('9.8.7.6');
  });

  it('returns connectionIP when provided and not trusted', () => {
    const c = createMockContext({});
    expect(getClientIP(c, '8.8.8.8')).toBe('8.8.8.8');
  });

  it('falls back to x-forwarded-for when IP is unknown', () => {
    const c = createMockContext({
      'x-forwarded-for': '1.1.1.1',
    });
    expect(getClientIP(c)).toBe('1.1.1.1');
  });
});

describe('getClientIPUnsafe', () => {
  it('returns x-forwarded-for first IP', () => {
    const c = createMockContext({
      'x-forwarded-for': '1.2.3.4, 10.0.0.1',
    });
    expect(getClientIPUnsafe(c)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const c = createMockContext({
      'x-real-ip': '5.6.7.8',
    });
    expect(getClientIPUnsafe(c)).toBe('5.6.7.8');
  });

  it('returns unknown when no headers', () => {
    const c = createMockContext({});
    expect(getClientIPUnsafe(c)).toBe('unknown');
  });
});

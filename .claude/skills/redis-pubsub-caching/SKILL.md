---
name: redis-pubsub-caching
description: Redis caching, pub/sub, Lua scripts, and store patterns with ioredis. Use when working with Redis, caching, rate limiting, or real-time events.
---

# Redis Patterns

ioredis-based caching, pub/sub, and atomic operations in this project.

## Key Files

- `apps/api/src/lib/redis.ts` — Client setup + all store objects (~658 lines)
- `apps/api/src/services/telegramEventService.ts` — Pub/sub publisher
- `apps/api/src/test/helpers/mockRedis.ts` — Mock factories

## Client Setup

```typescript
// ioredis with TLS support and exponential backoff
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  ...(isTLS && { tls: { rejectUnauthorized: true, ca: caCert, minVersion: 'TLSv1.3' } }),
});
```

Dev port: **16379** (docker-compose). Production uses `rediss://` with TLS.

## Store Pattern

Each feature gets its own store object with focused methods:

| Store | TTL | Purpose |
|-------|-----|---------|
| `signupCodes` | 5min | Email verification codes |
| `totpReplayStore` | 30s | Prevent TOTP code reuse |
| `twoFactorStore` | 5min | 2FA challenge tokens |
| `accountLockoutStore` | 1hr | Failed login tracking |
| `passwordResetStore` | 1hr | Single-use reset tokens |
| `refreshTokenStore` | 7d+10min | Session management |
| `oauthConsentStore` | 10min | OAuth consent data |

## Basic Operations

```typescript
// Set with TTL
await redis.setex(key, TTL_SECONDS, value);

// Get
const value = await redis.get(key);

// Delete
await redis.del(key);

// Check existence
const exists = await redis.exists(key);  // Returns 0 or 1
```

## Lua Scripts for Atomicity

### Atomic INCR + EXPIRE (rate limiting / lockout):

```typescript
const count = await redis.eval(
  'local c = redis.call("INCR", KEYS[1]) if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end return c',
  1, key, TTL
);
```

### Atomic GET + DEL (single-use tokens):

```typescript
const value = await redis.eval(
  'local v = redis.call("GET", KEYS[1]) if v then redis.call("DEL", KEYS[1]) end return v',
  1, key
);
```

Use Lua when you need multiple Redis commands to execute atomically.

## Pipeline Usage

For multi-command operations that should be batched (not necessarily atomic):

```typescript
const pipeline = redis.pipeline();
pipeline.setex(tokenKey, TTL, userId);
pipeline.sadd(userSetKey, tokenId);
pipeline.expire(userSetKey, TTL);
const results = await pipeline.exec();

// CRITICAL: Check results manually — errors are NOT auto-thrown
for (const [error, result] of results) {
  if (error) throw new Error(`Pipeline command failed: ${error.message}`);
}
```

## Pub/Sub: Fire-and-Forget Events

```typescript
// Never throws — errors only logged as warnings
export function publishTelegramEvent(event: TelegramEvent): void {
  redis.publish(CHANNEL, JSON.stringify({ ...event, timestamp: new Date().toISOString() }))
    .catch(err => logger.warn('[Telegram] Failed to publish event', { error: err.message }));
}
```

Event types: `user_signup`, `scan_started`, `aws_account_connected`, `subscription_change`, `stuck_jobs`.

## Webhook Deduplication (NX + EX)

```typescript
async isNewWebhookEvent(eventId: string): Promise<boolean> {
  try {
    const result = await redis.set(`stripe:event:${eventId}`, '1', 'EX', TTL, 'NX');
    return result === 'OK';  // 'OK' = new, null = duplicate
  } catch {
    return true;  // Allow processing if Redis is down
  }
}
```

## Testing Redis

### Use `createMockRedis()` from `test/helpers/mockRedis.ts`:

```typescript
vi.mock('../../lib/redis.js', () => ({
  redis: createMockRedis(),
  refreshTokenStore: { store: vi.fn().mockResolvedValue(undefined), ... },
  signupCodes: { setCode: vi.fn(), getCode: vi.fn(), deleteCode: vi.fn() },
}));
```

### Mock Redis publish in tests:

```typescript
vi.mock('../../lib/redis.js', () => ({
  redis: { publish: vi.fn().mockResolvedValue(1), on: vi.fn() },
}));
```

## Common Mistakes

- `pipeline.exec()` returns `[error, result][]` — always check error element
- Refresh token TTL has 10-minute buffer over JWT expiry to prevent race conditions
- Pub/sub is fire-and-forget: do NOT await or expect it to succeed
- Webhook dedup falls back to allowing processing (prefers duplicates over missed events)
- Use `redis.eval()` with Lua for any multi-step atomic operation, NOT sequential commands

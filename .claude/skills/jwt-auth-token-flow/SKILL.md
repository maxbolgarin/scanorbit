---
name: jwt-auth-token-flow
description: JWT auth with jose library, token types, refresh flow, and Redis storage. Use when working on authentication, tokens, or auth middleware.
---

# JWT Auth Token Flow

Authentication uses jose library for JWT signing/verification with three token types and Redis-backed session management.

## Key Files

- `apps/api/src/lib/jwt.ts` — Token signing and verification
- `apps/api/src/lib/authTokens.ts` — `setAuthTokens()` orchestration
- `apps/api/src/lib/redis.ts` — `refreshTokenStore` and related stores
- `apps/api/src/middlewares/auth.ts` — `requireAuth` and `optionalAuth`
- `apps/api/src/routes/auth.ts` — Auth endpoints

## Token Types

| Type | Expiry | Secret | Storage | Payload |
|------|--------|--------|---------|---------|
| access | 5min (configurable via `ACCESS_TOKEN_EXPIRY_MINUTES`) | `JWT_SECRET` | Frontend memory | `{userId, orgId, type: 'access'}` |
| refresh | 7d | `JWT_REFRESH_SECRET` | httpOnly secure cookie | `{userId, tokenId (UUID), type: 'refresh'}` |
| signup | 30min | `JWT_SECRET` | N/A (email link) | `{email, type: 'signup'}` |

## jose Library Usage

### Signing:

```typescript
const token = await new jose.SignJWT(payload)
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime(expiryString)  // '5m', '7d', '30m'
  .sign(secret);
```

### Verification:

```typescript
const { payload } = await jose.jwtVerify(token, secret);
if (payload.type !== expectedType) throw new Error('Invalid token type');
```

Secrets are created with `new TextEncoder().encode(secretString)`.

## setAuthTokens() Flow (Critical Order)

In `lib/authTokens.ts`:

```
1. Sign access token + refresh token (with unique tokenId)
2. Store tokenId→userId in Redis (MUST succeed)
3. Set refresh token as httpOnly cookie (only after Redis confirms)
4. Return { accessToken }
```

**If Redis fails at step 2, the cookie is NEVER set.** This prevents "token revoked" errors from orphaned JWTs.

## Refresh Token Storage in Redis

The `refreshTokenStore` maintains two data structures:

- `refresh:token:{tokenId}` → `userId` (string, TTL: 7d + 10min buffer)
- `refresh:user:{userId}` → Set of active tokenIds (enables session listing and bulk revocation)

### Store (pipeline for atomicity):

```typescript
pipeline.setex(refreshTokenKey(tokenId), TTL, userId);
pipeline.sadd(userRefreshTokensKey(userId), tokenId);
pipeline.expire(userRefreshTokensKey(userId), TTL);
await pipeline.exec();
// Then verify with redis.exists()
```

### Revoke all sessions:

```typescript
const tokenIds = await redis.smembers(userRefreshTokensKey(userId));
await redis.del(...tokenIds.map(refreshTokenKey), userRefreshTokensKey(userId));
```

## Auth Middleware

### `requireAuth` — enforces authentication:

```typescript
const token = authHeader?.replace('Bearer ', '');
if (!token) throw new HTTP401Error('Missing authentication token');
const payload = await jwt.verifyAccessToken(token);
c.set('userId', payload.userId);
c.set('orgId', payload.orgId ?? '');
```

### `optionalAuth` — silent on missing/invalid tokens:

Does not throw. Sets context if valid token present, otherwise skips.

## Token Type Checking

Every verification function checks the `type` field to prevent confusion attacks (e.g., using a refresh token as an access token). This is enforced in `jwt.ts`.

## Testing Auth

### Mock the JWT module:

```typescript
vi.mock('../../lib/jwt.js', () => ({
  jwt: {
    verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'user-1', orgId: 'org-1' }),
    signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
    signRefreshToken: vi.fn().mockResolvedValue({ token: 'mock-refresh', tokenId: 'tid-1' }),
  },
}));
```

### Test 401 scenarios:

- Missing `Authorization` header
- Invalid/expired token (mock `verifyAccessToken` to throw)
- Empty `userId` in payload

### Auth middleware bypass in route tests:

```typescript
vi.mock('../../middlewares/auth.js', () => ({
  requireAuth: vi.fn(async (c, next) => {
    c.set('userId', 'test-user-id');
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));
```

## Common Mistakes

- Using `JWT_SECRET` for refresh tokens (must use `JWT_REFRESH_SECRET`)
- Not checking token `type` field during verification
- Setting cookie before confirming Redis storage succeeded
- Forgetting the 10-minute TTL buffer on refresh token Redis keys
- Pipeline errors from `exec()` are `[error, result][]` tuples — errors are NOT auto-thrown

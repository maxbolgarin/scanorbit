---
name: api-error-debugging-workflow
description: Debug API errors by tracing through Hono routes, Zod validation, services, and DB. Use when investigating HTTP errors or test failures.
---

# API Error Debugging Workflow

Step-by-step process for debugging API errors in this Hono.js application.

## Step 1: Identify the Error

Check the error response format:

```json
// Standard HTTP error
{ "error": "HTTP404Error", "message": "Finding not found" }

// Validation error (Zod)
{ "error": "ValidationError", "message": "Invalid request data",
  "details": [{ "path": "limit", "message": "Number must be less than or equal to 100" }] }

// Database error (generic to client)
{ "error": "DatabaseError", "message": "A database error occurred. Please try again later." }
```

## Step 2: Locate the Route Handler

1. Check `apps/api/src/routes/index.ts` for route mounting
2. Routes mount at root level: `/auth`, `/orgs`, `/aws/accounts`, `/stripe`, `/findings`, etc.
3. Public API at `/api/v1` with API key auth
4. Open the specific route file in `apps/api/src/routes/`

## Step 3: Check Zod Validation

Routes use `@hono/zod-validator`:

```typescript
findingsRoute.get('/', zValidator('query', querySchema), async (c) => {
  const filters = c.req.valid('query');  // Already validated
});
```

Validation targets: `'query'`, `'json'`, `'param'`, `'header'`

If you see `ValidationError`, check the Zod schema definition in the route file.

## Step 4: Check Middleware Chain

Middleware order matters. Common middleware:

1. **`requireAuth`** — Verifies JWT, sets `userId`/`orgId` on context. Throws `HTTP401Error`.
2. **`requireOrgId`** — Ensures `orgId` is set. Throws `HTTP400Error('No organization selected')`.
3. **`requireNoProcessingRestriction`** — GDPR check. Throws `HTTP403Error` for write ops on restricted accounts.
4. **Rate limiting** — Throws `HTTP429Error`.

## Step 5: Check Service Logic

Services are in `apps/api/src/services/`. Common error patterns:

```typescript
// Not found
if (!finding) throw new HTTP404Error('Finding not found');

// Validation
if (!VALID_STATUSES.includes(data.status)) throw new HTTP400Error('Invalid status');

// Tier limits
if (accountCount >= maxAccounts) throw new HTTP403Error('Limit exceeded. Upgrade your plan.');

// Duplicate
if (existing.length > 0) throw new HTTP400Error('Already exists');
```

**All queries are org-scoped**: every `WHERE` includes `eq(table.orgId, orgId)`.

## Step 6: Check Database Errors

Use `getPgErrorCode()` from `lib/errors.ts` to extract PostgreSQL error codes from Drizzle-wrapped errors:

```typescript
import { getPgErrorCode } from '../lib/errors.js';
const code = getPgErrorCode(error); // e.g., '23505' for unique violation
```

The error handler logs DB details (code, detail, hint) server-side but returns a generic message to clients.

## Error Class Hierarchy

All in `apps/api/src/lib/errors.ts`:

| Class | Status | Default Message |
|-------|--------|----------------|
| `HTTP400Error` | 400 | Bad Request |
| `HTTP401Error` | 401 | Unauthorized |
| `HTTP403Error` | 403 | Forbidden |
| `HTTP404Error` | 404 | Not Found |
| `HTTP409Error` | 409 | Conflict |
| `HTTP429Error` | 429 | Too Many Requests |
| `HTTP500Error` | 500 | Internal Server Error |
| `HTTP503Error` | 503 | Service Unavailable |

## Error Handler Middleware

Located at `apps/api/src/middlewares/errorHandler.ts`. Registered via `app.onError(errorHandler)`.

Processing order:
1. **HTTPError** → JSON response with `statusCode` and `message`. Expected 401s on `/auth/me` and `/auth/refresh` are not logged.
2. **ZodError** → 400 with `details` array of `{path, message}`.
3. **Database error** (detected by `code` property or message keywords) → generic 500.
4. **Unhandled** → generic 500, full stack logged.

All errors increment `errorsTotal` Prometheus counter with `{type, route}` labels.

## Error Propagation Flow

```
Route Handler → throws HTTPError/ZodError/Error
    ↓
Global errorHandler middleware
    ↓
Type check → appropriate JSON response + status code
    ↓
Metrics incremented + structured logging
```

## Common Debugging Scenarios

**401 on protected route**: Check `Authorization: Bearer <token>` header. Token may be expired (5min access tokens).

**400 with no details**: Service-level validation, not Zod. Check the service function.

**403 with tier message**: User's org is on FREE tier. Check `TIER_LIMITS` in `types/index.ts`.

**403 with GDPR message**: User has `processingRestricted: true`. Only read operations allowed.

**500 with "database error"**: Check server logs for the actual PostgreSQL error code and detail.

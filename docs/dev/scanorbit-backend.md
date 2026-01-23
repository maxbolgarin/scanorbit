# ScanOrbit Node.js + TypeScript Backend – Implementation Guide

## 1. Architecture Overview

### 1.1 Tech Stack

| Component | Library | Version |
|-----------|---------|---------|
| **Runtime** | Node.js | 24.x |
| **Framework** | Hono.js | 4.x |
| **Database** | PostgreSQL + Drizzle ORM | 17.x, 0.45.x |
| **Type Validation** | Zod | 3.x |
| **Authentication** | jose (JWT) + OAuth + TOTP | 6.x |
| **Password Hashing** | bcrypt | 6.x |
| **2FA** | otpauth (TOTP) | 9.x |
| **Cache/Queue** | Redis (ioredis) | 5.x |
| **AWS SDK** | @aws-sdk/client-sts | 3.x |
| **Billing** | Stripe | 17.x |
| **Email** | Nodemailer | 7.x |
| **Metrics** | prom-client | 15.x |
| **Error Handling** | Custom error classes | - |

### 1.2 Project Structure

```
apps/api/
├── src/
│   ├── index.ts                 # Hono app entry point
│   ├── middlewares/
│   │   ├── auth.ts              # JWT verification
│   │   ├── errorHandler.ts      # Global error handling
│   │   ├── rateLimit.ts         # Rate limiting
│   │   ├── requestId.ts         # Request ID tracking
│   │   └── structuredLogger.ts  # Structured logging
│   ├── routes/
│   │   ├── index.ts             # Route aggregation
│   │   ├── auth.ts              # /auth/* (login, signup, 2FA, OAuth)
│   │   ├── orgs.ts              # /orgs/* endpoints
│   │   ├── aws-accounts.ts      # /aws/accounts/* endpoints
│   │   ├── aws-scans.ts         # /aws/scans/* endpoints
│   │   ├── resources.ts         # /resources/* endpoints
│   │   ├── findings.ts          # /findings/* endpoints
│   │   ├── gdpr.ts              # /gdpr/* (data export, deletion)
│   │   └── stripe.ts            # /stripe/* (billing, webhooks)
│   ├── services/
│   │   ├── authService.ts       # Auth business logic
│   │   ├── orgService.ts
│   │   ├── awsAccountService.ts
│   │   ├── resourceService.ts
│   │   ├── findingService.ts
│   │   ├── twoFactorService.ts  # 2FA/TOTP management
│   │   ├── emailService.ts      # Email sending
│   │   ├── stripeService.ts     # Stripe billing
│   │   ├── consentService.ts    # GDPR consent tracking
│   │   └── retentionService.ts  # Data retention cleanup
│   ├── db/
│   │   └── schema.ts            # Drizzle schema definitions
│   ├── lib/
│   │   ├── db.ts                # Drizzle client setup
│   │   ├── redis.ts             # ioredis client
│   │   ├── jwt.ts               # jose JWT helpers
│   │   ├── crypto.ts            # Encryption utilities
│   │   ├── config.ts            # Environment config
│   │   └── errors.ts            # Error classes
│   └── types/
│       └── index.ts             # Shared types
├── drizzle/                     # Generated migrations
├── package.json
├── tsconfig.json
├── drizzle.config.cjs
├── .env.example
└── Dockerfile
```

**Note:** The codebase uses a flat structure without controllers or repositories. Routes call services directly, and services use Drizzle ORM for database access.

---

## 2. Database Schema (Drizzle ORM)

### 2.1 Schema Definition

The schema is defined in `apps/api/src/db/schema.ts` using Drizzle ORM:

```typescript
import { pgTable, uuid, varchar, text, timestamp, jsonb, numeric, uniqueIndex, index, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organizations
export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  logoUrl: varchar('logo_url', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// AWS Accounts
export const awsAccounts = pgTable('aws_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  awsAccountId: varchar('aws_account_id', { length: 12 }).notNull(),
  roleArn: varchar('role_arn', { length: 255 }).notNull(),
  externalId: varchar('external_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  lastError: text('last_error'),
  lastScanAt: timestamp('last_scan_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('aws_accounts_org_account_idx').on(table.orgId, table.awsAccountId),
]);

// Resources
export const resources = pgTable('resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  awsAccountId: uuid('aws_account_id').notNull().references(() => awsAccounts.id, { onDelete: 'cascade' }),
  resourceId: varchar('resource_id', { length: 255 }).notNull(),
  service: varchar('service', { length: 50 }).notNull(),
  region: varchar('region', { length: 50 }),
  name: varchar('name', { length: 255 }),
  state: varchar('state', { length: 50 }),
  tags: jsonb('tags').default({}).notNull(),
  costEstimateMonthly: numeric('cost_estimate_monthly', { precision: 10, scale: 2 }),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('resources_org_account_resource_idx').on(table.orgId, table.awsAccountId, table.resourceId),
]);

// Findings
export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  awsAccountId: uuid('aws_account_id').notNull().references(() => awsAccounts.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id').references(() => resources.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 50 }).notNull(),
  summary: text('summary').notNull(),
  details: jsonb('details').default({}).notNull(),
  status: varchar('status', { length: 50 }).default('open').notNull(),
  resolvedAt: timestamp('resolved_at'),
  snoozedUntil: timestamp('snoozed_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AwsAccount = typeof awsAccounts.$inferSelect;
export type NewAwsAccount = typeof awsAccounts.$inferInsert;
export type Finding = typeof findings.$inferSelect;
export type NewFinding = typeof findings.$inferInsert;
```

### 2.2 Migrations

Migrations are managed with Drizzle Kit:

```bash
# Generate migrations from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio for database browsing
pnpm db:studio
```

---

## 3. Core Implementation

### 3.1 Database Connection (lib/db.ts)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { config } from './config';

// Create postgres.js client
const client = postgres(config.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

export default db;
```

### 3.2 Using Drizzle ORM

```typescript
import { db } from '../lib/db';
import { users, orgs, awsAccounts, eq, and } from '../db/schema';

// Select with relations
const user = await db.query.users.findFirst({
  where: eq(users.email, email),
  with: { orgMembers: true },
});

// Insert
const [newUser] = await db.insert(users)
  .values({ email, passwordHash, fullName })
  .returning();

// Update
await db.update(awsAccounts)
  .set({ status: 'ok', lastScanAt: new Date() })
  .where(eq(awsAccounts.id, accountId));

// Complex query
const accounts = await db.select()
  .from(awsAccounts)
  .where(and(
    eq(awsAccounts.orgId, orgId),
    eq(awsAccounts.status, 'ok')
  ));
```

### 3.3 Auth Service (services/authService.ts)

```typescript
import * as bcrypt from 'bcrypt';
import { db } from '../lib/db';
import { users, orgs, userOrgMembers, eq } from '../db/schema';
import { signToken, verifyToken } from '../lib/jwt';
import { HTTP400Error, HTTP401Error } from '../lib/errors';

export const authService = {
  async signup(email: string, password: string, fullName: string) {
    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      throw new HTTP400Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [user] = await db.insert(users)
      .values({ email, passwordHash, fullName })
      .returning();

    // Create org (auto-generated from email domain)
    const domain = email.split('@')[1];
    const slug = domain.replace(/\./g, '-') + '-' + Date.now();
    const [org] = await db.insert(orgs)
      .values({ name: domain, slug })
      .returning();

    // Add user to org
    await db.insert(userOrgMembers)
      .values({ userId: user.id, orgId: org.id, role: 'admin' });

    return { user, org };
  },

  async login(email: string, password: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw new HTTP401Error('Invalid credentials');
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new HTTP401Error('Invalid credentials');
    }

    // Get user's orgs
    const memberships = await db.query.userOrgMembers.findMany({
      where: eq(userOrgMembers.userId, user.id),
      with: { org: true },
    });

    // Sign JWT using jose
    const token = await signToken({
      userId: user.id,
      orgId: memberships[0]?.org.id || null,
    });

    return { token, user, orgs: memberships.map(m => m.org) };
  },
};
```

### 3.4 JWT Helpers (lib/jwt.ts)

```typescript
import * as jose from 'jose';
import { config } from './config';

const accessSecret = new TextEncoder().encode(config.jwtSecret);
const refreshSecret = new TextEncoder().encode(config.jwtRefreshSecret);

// Access tokens: short-lived (5 min), stored in frontend memory
export async function signAccessToken(payload: { userId: string; orgId: string | null }) {
  return await new jose.SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(accessSecret);
}

// Refresh tokens: long-lived (7 days), stored in httpOnly cookie
export async function signRefreshToken(userId: string, tokenId: string) {
  return await new jose.SignJWT({ userId, tokenId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(refreshSecret);
}
```

### 3.3 Auth Routes (routes/auth.ts)

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authService } from '../services/authService';

const authRoute = new Hono();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /auth/signup
authRoute.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, password, fullName } = c.req.valid('json');

  const { user, org } = await authService.signup(email, password, fullName || '');

  // Issue access token (5 min) and refresh token (7 day) in httpOnly cookie
  const accessToken = await jwt.signAccessToken({ userId: user.id, orgId: org?.id ?? null });
  const { token: refreshToken, tokenId } = await jwt.signRefreshToken(user.id);
  await refreshTokenStore.store(tokenId, user.id);
  setCookie(c, 'refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 604800 });

  return c.json({ user, org, accessToken }, 201);
});

// POST /auth/login
authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const { user, orgs } = await authService.login(email, password);

  // Issue access token (5 min) and refresh token (7 day) in httpOnly cookie
  const accessToken = await jwt.signAccessToken({ userId: user.id, orgId: orgs[0]?.id ?? null });
  const { token: refreshToken, tokenId } = await jwt.signRefreshToken(user.id);
  await refreshTokenStore.store(tokenId, user.id);
  setCookie(c, 'refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'Strict', maxAge: 604800 });

  return c.json({ user, orgs, accessToken }, 200);
});

// POST /auth/logout
authRoute.post('/logout', async (c) => {
  const refreshToken = getCookie(c, 'refresh_token');
  if (refreshToken) {
    try {
      const payload = await jwt.verifyRefreshToken(refreshToken);
      await refreshTokenStore.revoke(payload.tokenId);
    } catch { /* ignore */ }
  }
  deleteCookie(c, 'refresh_token');
  return c.json({ message: 'Logged out' });
});

export default authRoute;
```

### 3.4 AWS Accounts Route (routes/aws-accounts.ts)

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { awsAccountService } from '../services/awsAccountService';

const awsRoute = new Hono();

awsRoute.use(requireAuth);

const createAccountSchema = z.object({
  name: z.string(),
  awsAccountId: z.string().length(12),
  roleArn: z.string(),
  externalId: z.string().optional(),
});

// GET /aws/accounts
awsRoute.get('/', async (c) => {
  const orgId = c.get('orgId');
  const accounts = await awsAccountService.getAccounts(orgId);
  return c.json(accounts);
});

// POST /aws/accounts
awsRoute.post('/', zValidator('json', createAccountSchema), async (c) => {
  const orgId = c.get('orgId');
  const data = c.req.valid('json');

  const account = await awsAccountService.createAccount(orgId, data);
  return c.json(account, 201);
});

// POST /aws/accounts/:id/test
awsRoute.post('/:id/test', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  const result = await awsAccountService.testConnection(orgId, accountId);
  return c.json(result);
});

// POST /aws/accounts/:id/scan (enqueue scan)
awsRoute.post('/:id/scan', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  const scan = await awsAccountService.enqueueScan(orgId, accountId);
  return c.json(scan, 202);
});

// GET /aws/accounts/:id/scans (scan history)
awsRoute.get('/:id/scans', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  const scans = await awsAccountService.getScanHistory(orgId, accountId);
  return c.json(scans);
});

export default awsRoute;
```

---

## 4. Middleware

### 4.1 Auth Middleware (middlewares/auth.ts)

```typescript
import type { Context, Next } from 'hono';
import { jwt } from '../lib/jwt.js';
import { HTTP401Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

/**
 * Authentication middleware that requires a valid access token
 * Access token must be provided in the Authorization header:
 * Authorization: Bearer <access_token>
 */
export const requireAuth = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new HTTP401Error('Missing authentication token');
  }

  try {
    const payload = await jwt.verifyAccessToken(token);

    if (!payload.userId) {
      throw new HTTP401Error('Invalid token payload');
    }

    c.set('userId', payload.userId);
    c.set('orgId', payload.orgId ?? '');
  } catch (error) {
    if (error instanceof HTTP401Error) {
      throw error;
    }
    throw new HTTP401Error('Invalid or expired token');
  }

  await next();
};

// Optional auth - doesn't throw if no token, but sets user if present
export const optionalAuth = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    try {
      const payload = await jwt.verifyAccessToken(token);
      if (payload.userId) {
        c.set('userId', payload.userId);
        c.set('orgId', payload.orgId ?? '');
      }
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }

  await next();
};
```

### 4.2 Error Handler (middleware/errorHandler.ts)

```typescript
import { Context } from 'hono';
import { HTTP400Error, HTTP401Error, HTTP404Error } from '../lib/errors';

export const errorHandler = async (err: Error, c: Context) => {
  if (err instanceof HTTP400Error) {
    return c.json({ error: err.message }, 400);
  }
  if (err instanceof HTTP401Error) {
    return c.json({ error: err.message }, 401);
  }
  if (err instanceof HTTP404Error) {
    return c.json({ error: err.message }, 404);
  }

  // Log unexpected errors
  console.error('Unhandled error:', err);

  return c.json({ error: 'Internal server error' }, 500);
};
```

---

## 5. App Entry Point (src/index.ts)

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRoute from './routes/auth';
import awsRoute from './routes/aws-accounts';
import resourceRoute from './routes/resources';
import findingRoute from './routes/findings';
import { errorHandler } from './middleware/errorHandler';

const app = new Hono();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(logger());

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// API routes
app.route('/auth', authRoute);
app.route('/aws/accounts', awsRoute);
app.route('/resources', resourceRoute);
app.route('/findings', findingRoute);

// Error handler (catch all)
app.onError(errorHandler);

export default app;
```

---

## 6. Development & Deployment

### 6.1 Development Setup

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run dev server
pnpm --filter @scanorbit/api dev  # Uses tsx for hot reload

# Database migrations
pnpm --filter @scanorbit/api db:generate
pnpm --filter @scanorbit/api db:migrate
pnpm --filter @scanorbit/api db:studio  # Browse database
```

### 6.2 package.json

```json
{
  "name": "@scanorbit/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist node_modules",
    "db:generate": "drizzle-kit generate --config=drizzle.config.cjs",
    "db:migrate": "drizzle-kit migrate --config=drizzle.config.cjs",
    "db:studio": "drizzle-kit studio --config=drizzle.config.cjs"
  },
  "dependencies": {
    "@aws-sdk/client-sts": "^3.726.1",
    "@hono/node-server": "^1.14.1",
    "@hono/zod-validator": "^0.4.3",
    "bcrypt": "^6.0.0",
    "drizzle-orm": "^0.45.1",
    "hono": "^4.11.3",
    "ioredis": "^5.9.0",
    "jose": "^6.1.3",
    "postgres": "^3.4.7",
    "zod": "^3.24.3"
  },
  "devDependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/node": "^22.14.1",
    "dotenv": "^16.4.7",
    "drizzle-kit": "^0.30.5",
    "tsx": "^4.19.5",
    "typescript": "^5.7.3"
  }
}
```

### 6.3 Dockerfile (for Docker Compose deployment)

```dockerfile
# Development stage
FROM node:22-alpine AS development
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### 6.4 Environment Variables (.env)

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scanorbit
REDIS_URL=redis://localhost:6379

# JWT secrets (access token: 5min, refresh token: 7d)
JWT_SECRET=your-super-secret-key-change-in-prod
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-prod

AWS_REGION=eu-west-1

CORS_ORIGIN=http://localhost:3000
```

---

## 7. API Documentation

### 7.1 Core Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/signup` | ❌ | Create user + org |
| `POST` | `/auth/login` | ❌ | Authenticate user |
| `POST` | `/auth/logout` | ✅ | Clear session |
| `GET` | `/me` | ✅ | Current user + org |
| `GET` | `/aws/accounts` | ✅ | List AWS accounts |
| `POST` | `/aws/accounts` | ✅ | Add AWS account |
| `POST` | `/aws/accounts/:id/test` | ✅ | Test connection |
| `POST` | `/aws/accounts/:id/scan` | ✅ | Enqueue scan |
| `GET` | `/aws/accounts/:id/scans` | ✅ | Scan history |
| `GET` | `/resources` | ✅ | List resources (with filters) |
| `GET` | `/resources/:id` | ✅ | Resource detail |
| `PATCH` | `/resources/:id` | ✅ | Edit resource tags |
| `GET` | `/findings` | ✅ | List findings (with filters) |
| `GET` | `/findings/:id` | ✅ | Finding detail |
| `PATCH` | `/findings/:id` | ✅ | Mark resolved / snooze |

---

## 8. Service Layer Patterns

Each service follows the same pattern:

1. **Validation**: Zod schema (in routes via `@hono/zod-validator`)
2. **Authorization**: Check org membership (via auth middleware)
3. **Business Logic**: Service method
4. **Data Access**: Drizzle ORM queries (in services)
5. **Response**: Typed JSON

Example:

```typescript
// Route (routes/aws-accounts.ts)
awsRoute.post('/', zValidator('json', createAccountSchema), async (c) => {
  const orgId = c.get('orgId');  // From auth middleware
  const data = c.req.valid('json');  // Validated input
  const account = await awsAccountService.createAccount(orgId, data);  // Service call
  return c.json(account, 201);  // Typed response
});

// Service (services/awsAccountService.ts)
async createAccount(orgId: string, data: CreateAccountInput) {
  const [account] = await db.insert(awsAccounts)
    .values({ orgId, ...data })
    .returning();
  return account;
}
```

---

## 9. Key Considerations

1. **Connection Pooling**: postgres.js client handles up to 20 concurrent connections (configurable in `lib/db.ts`)
2. **Drizzle ORM**: Type-safe queries with schema inference (`$inferSelect`, `$inferInsert`)
3. **Error Handling**: Custom error classes (`HTTP400Error`, `HTTP401Error`, `HTTP404Error`) with automatic status codes
4. **JWT Strategy**: Using `jose` library for JWT signing/verification; access tokens (5 min) via Bearer header, refresh tokens (7 days) via httpOnly cookie
5. **JSONB for Flexibility**: tags, details, raw provider data stored as JSONB columns
6. **Indexes**: Composite unique indexes on common query patterns (org_id + aws_account_id, etc.)
7. **Migrations**: Managed by Drizzle Kit (`db:generate`, `db:migrate`)
8. **ESM**: Project uses ES modules (`"type": "module"` in package.json)

---

## 10. Implementation Status

### Completed
- Auth routes (signup, login, logout)
- AWS accounts CRUD + connection testing
- Resources listing with filters
- Findings listing with filters
- Drizzle ORM schema with migrations
- JWT authentication middleware
- Error handling middleware

### Pending
- Integration tests

---

## 11. Two-Factor Authentication (2FA)

### 11.1 Overview

ScanOrbit implements TOTP-based two-factor authentication using the `otpauth` library. The 2FA flow includes:

1. **Setup**: Generate secret, display QR code, verify with TOTP code
2. **Login**: Require TOTP or recovery code after password verification
3. **Disable**: Require password and TOTP code to disable
4. **Recovery**: Support single-use recovery codes

### 11.2 2FA Service (services/twoFactorService.ts)

```typescript
import { TOTP, Secret } from 'otpauth';
import { db } from '../lib/db';
import { users, eq } from '../db/schema';
import { encrypt, decrypt } from '../lib/crypto';
import { twoFactorStore } from '../lib/redis';

export interface TwoFactorSetupInitResult {
  qrCodeUri: string;
  secret: string;
}

export interface TwoFactorSetupVerifyResult {
  recoveryCodes: string[];
}

export interface TwoFactorStatusResult {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export const twoFactorService = {
  // Get 2FA status for a user
  async getStatus(userId: string): Promise<TwoFactorStatusResult>,

  // Initialize 2FA setup - returns QR code URI and secret
  async initSetup(userId: string): Promise<TwoFactorSetupInitResult>,

  // Verify TOTP code and enable 2FA - returns recovery codes
  async verifyAndEnable(userId: string, code: string): Promise<TwoFactorSetupVerifyResult>,

  // Disable 2FA (requires password and TOTP code)
  async disable(userId: string, password: string, code: string): Promise<void>,

  // Verify TOTP code during login
  async verify(userId: string, code: string): Promise<boolean>,

  // Verify recovery code (single use)
  async verifyRecoveryCode(userId: string, recoveryCode: string): Promise<boolean>,

  // Get remaining recovery codes count
  async getRecoveryCodesCount(userId: string): Promise<{ remaining: number }>,

  // Regenerate recovery codes (requires password and TOTP)
  async regenerateRecoveryCodes(userId: string, password: string, code: string): Promise<{ recoveryCodes: string[] }>,
};
```

### 11.3 2FA Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth/2fa/status` | ✅ | Get 2FA status |
| `POST` | `/auth/2fa/setup/init` | ✅ | Start 2FA setup (get QR code) |
| `POST` | `/auth/2fa/setup/verify` | ✅ | Verify code and enable 2FA |
| `POST` | `/auth/2fa/disable` | ✅ | Disable 2FA |
| `POST` | `/auth/2fa/verify` | ❌ | Verify 2FA during login challenge |
| `POST` | `/auth/2fa/recovery` | ❌ | Use recovery code during login |
| `POST` | `/auth/2fa/recovery/regenerate` | ✅ | Regenerate recovery codes |

### 11.4 2FA Login Flow

```typescript
// 1. User logs in with email/password
const { user, requiresTwoFactor, challengeToken } = await authService.login(email, password);

if (requiresTwoFactor) {
  // 2. Frontend shows 2FA input
  // 3. User enters TOTP code
  const isValid = await twoFactorService.verify(user.id, totpCode);

  // Or uses recovery code
  const isValid = await twoFactorService.verifyRecoveryCode(user.id, recoveryCode);

  if (isValid) {
    // 4. Issue tokens
    const accessToken = await jwt.signAccessToken({ userId: user.id, orgId });
    const { token: refreshToken } = await jwt.signRefreshToken(user.id);
  }
}
```

### 11.5 Security Features

- **Rate Limiting**: Max 5 verification attempts per 15 minutes
- **Encrypted Secrets**: TOTP secrets encrypted at rest with AES-256-GCM
- **Hashed Recovery Codes**: Recovery codes stored as bcrypt hashes
- **Temporary Setup Storage**: Setup secrets stored in Redis with 10-minute TTL
- **Password Verification**: Required for disable and regenerate operations

---

## 12. OAuth Integration

### 12.1 Overview

ScanOrbit supports OAuth login via Google and GitHub. OAuth users can:
- Create accounts without passwords
- Link OAuth to existing accounts
- Use 2FA with OAuth accounts

### 12.2 OAuth Configuration

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# OAuth encryption (for state tokens)
OAUTH_ENCRYPTION_KEY=32-byte-hex-key
```

### 12.3 OAuth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth/google` | ❌ | Initiate Google OAuth flow |
| `GET` | `/auth/google/callback` | ❌ | Handle Google OAuth callback |
| `POST` | `/auth/google/token` | ❌ | Exchange Google ID token (frontend flow) |
| `GET` | `/auth/github` | ❌ | Initiate GitHub OAuth flow |
| `GET` | `/auth/github/callback` | ❌ | Handle GitHub OAuth callback |

### 12.4 OAuth Flow

```typescript
// 1. Frontend redirects to /auth/google or /auth/github
// 2. User authenticates with provider
// 3. Provider redirects back to callback URL
// 4. Backend creates/updates user and issues tokens

authRoute.get('/google/callback', async (c) => {
  const code = c.req.query('code');

  // Exchange code for tokens
  const { id_token } = await exchangeGoogleCode(code);

  // Verify ID token and get user info
  const googleUser = await verifyGoogleIdToken(id_token);

  // Find or create user
  let user = await db.query.users.findFirst({
    where: eq(users.googleId, googleUser.sub),
  });

  if (!user) {
    // Create new user with Google ID
    [user] = await db.insert(users)
      .values({
        email: googleUser.email,
        googleId: googleUser.sub,
        fullName: googleUser.name,
        emailVerified: true, // Google emails are pre-verified
      })
      .returning();
  }

  // Issue tokens and redirect
  const accessToken = await jwt.signAccessToken({ userId: user.id, orgId });
  return c.redirect(`${config.frontendUrl}/dashboard?oauth=success`);
});
```

### 12.5 Database Schema for OAuth

```typescript
export const users = pgTable('users', {
  // ... existing fields

  // OAuth provider IDs
  googleId: varchar('google_id', { length: 255 }).unique(),
  githubId: varchar('github_id', { length: 255 }).unique(),

  // Email verification
  emailVerified: boolean('email_verified').default(false),

  // Password is optional for OAuth-only users
  passwordHash: varchar('password_hash', { length: 255 }),
});
```

---

## 13. Stripe Billing Integration

### 13.1 Overview

ScanOrbit uses Stripe for subscription billing with a trial-first model:

- **Free Tier**: Limited accounts, limited scans
- **Pro Tier**: More accounts, more scans, priority support
- **Team Tier**: Unlimited accounts, unlimited scans, SSO, priority support

### 13.2 Stripe Configuration

```env
# Stripe API keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe price IDs (from Stripe Dashboard)
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# Trial period
STRIPE_TRIAL_DAYS=14
```

### 13.3 Stripe Service (services/stripeService.ts)

```typescript
import Stripe from 'stripe';
import { db } from '../lib/db';
import { orgs, users, eq } from '../db/schema';
import { config } from '../lib/config';

export const stripeService = {
  // Get or create Stripe customer for an organization
  async getOrCreateCustomer(orgId: string, userId: string): Promise<string>,

  // Create checkout session for starting a trial subscription
  async createCheckoutSession(
    orgId: string,
    userId: string,
    targetTier: 'pro' | 'team',
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }>,

  // Create customer portal session for managing subscription
  async createPortalSession(
    orgId: string,
    userId: string,
    returnUrl: string
  ): Promise<{ url: string }>,

  // Handle checkout session completion (webhook)
  async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void>,

  // Handle subscription updates (webhook)
  async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void>,

  // Cancel subscription
  async cancelSubscription(orgId: string, userId: string, immediate?: boolean): Promise<void>,

  // Construct and verify webhook event
  constructWebhookEvent(payload: string, signature: string): Stripe.Event,

  // Handle invoice payment failure (webhook)
  async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void>,

  // Check if Stripe is properly configured
  isConfigured(): boolean,
};
```

### 13.4 Stripe Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stripe/checkout` | ✅ | Create checkout session |
| `POST` | `/stripe/portal` | ✅ | Create customer portal session |
| `POST` | `/stripe/webhook` | ❌ | Handle Stripe webhooks |

### 13.5 Stripe Webhook Handler

```typescript
stripeRoute.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  const body = await c.req.raw.text();

  let event: Stripe.Event;
  try {
    event = stripeService.constructWebhookEvent(body, signature!);
  } catch (err) {
    return c.json({ error: 'Webhook signature verification failed' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await stripeService.handleCheckoutComplete(event.data.object);
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await stripeService.handleSubscriptionChange(event.data.object);
      break;
    case 'invoice.payment_failed':
      await stripeService.handlePaymentFailed(event.data.object);
      break;
  }

  return c.json({ received: true });
});
```

### 13.6 Database Schema for Billing

```typescript
export const orgs = pgTable('orgs', {
  // ... existing fields

  // Stripe integration
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),

  // Subscription status
  tier: varchar('tier', { length: 50 }).default('free').notNull(),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('none'),
  trialEndsAt: timestamp('trial_ends_at'),
  subscriptionEndsAt: timestamp('subscription_ends_at'),
  tierUpgradedAt: timestamp('tier_upgraded_at'),
});
```

---

## 14. Email Service

### 14.1 Overview

ScanOrbit uses Nodemailer for transactional emails:
- Email verification codes
- Password reset links
- Subscription notifications (planned)

### 14.2 Email Configuration

```env
# SMTP configuration
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM="ScanOrbit <noreply@scanorbit.io>"
```

### 14.3 Email Service (services/emailService.ts)

```typescript
import nodemailer from 'nodemailer';
import { config } from '../lib/config';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export const emailService = {
  // Send verification email with 6-digit code
  async sendVerificationEmail(
    email: string,
    code: string,
    name?: string
  ): Promise<EmailResult>,

  // Send password reset email with reset link
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    name?: string
  ): Promise<EmailResult>,

  // Verify SMTP connection (health check)
  async verifyConnection(): Promise<boolean>,
};
```

### 14.4 Email Templates

Emails use HTML templates with inline styles for compatibility:

```typescript
function getVerificationEmailHtml(code: string, name?: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1>Verify your email</h1>
        <p>Hello${name ? ` ${name}` : ''},</p>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; padding: 20px; background: #f5f5f5;">
          ${code}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>— The ScanOrbit Team</p>
      </body>
    </html>
  `;
}
```

### 14.5 Development Mode

When SMTP is not configured, emails are logged to console:

```typescript
if (!transport) {
  console.log(`[EMAIL] To: ${email}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body: ${text}`);
  return { success: true, messageId: `console-${Date.now()}` };
}
```

---

## 15. Rate Limiting & Security

### 15.1 Rate Limiting Middleware

```typescript
import { redis } from '../lib/redis';

const rateLimitConfig = {
  auth: { window: 60, max: 10 },      // 10 requests/minute for auth
  api: { window: 60, max: 100 },      // 100 requests/minute for API
  twoFactor: { window: 900, max: 5 }, // 5 attempts/15min for 2FA
};

export const rateLimit = (type: keyof typeof rateLimitConfig) => async (c, next) => {
  const config = rateLimitConfig[type];
  const key = `rate:${type}:${c.req.ip}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, config.window);
  }

  if (current > config.max) {
    throw new HTTP429Error('Too many requests');
  }

  await next();
};
```

### 15.2 Request ID Middleware

```typescript
import { randomUUID } from 'crypto';

export const requestId = async (c, next) => {
  const id = c.req.header('x-request-id') || randomUUID();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
};
```

### 15.3 Structured Logging

```typescript
export const structuredLogger = async (c, next) => {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
    userId: c.get('userId'),
    orgId: c.get('orgId'),
  }));
};
```

---

## 16. Metrics & Monitoring

### 16.1 Prometheus Metrics

The API exposes Prometheus metrics via `prom-client`:

```typescript
import { collectDefaultMetrics, Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

// Custom metrics
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// Metrics endpoint
app.get('/metrics', async (c) => {
  return c.text(await register.metrics());
});
```

### 16.2 Health Check

```typescript
app.get('/health', async (c) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    email: config.smtp.enabled ? await emailService.verifyConnection() : true,
    stripe: stripeService.isConfigured(),
  };

  const healthy = Object.values(checks).every(Boolean);

  return c.json({ status: healthy ? 'ok' : 'degraded', checks }, healthy ? 200 : 503);
});
```

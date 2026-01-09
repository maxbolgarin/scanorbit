# ScanOrbit Node.js + TypeScript Backend – Implementation Guide

## 1. Architecture Overview

### 1.1 Tech Stack

| Component | Library | Version |
|-----------|---------|---------|
| **Runtime** | Node.js | 22.x |
| **Framework** | Hono.js | 4.x |
| **Database** | PostgreSQL + Drizzle ORM | 17.x, 0.45.x |
| **Type Validation** | Zod | 3.x |
| **Authentication** | jose (JWT) | 6.x |
| **Password Hashing** | bcrypt | 6.x |
| **Cache/Queue** | Redis (ioredis) | 5.x |
| **AWS SDK** | @aws-sdk/client-sts | 3.x |
| **Error Handling** | Custom error classes | - |

### 1.2 Project Structure

```
apps/api/
├── src/
│   ├── index.ts                 # Hono app entry point
│   ├── middlewares/
│   │   ├── auth.ts              # JWT verification
│   │   └── errorHandler.ts      # Global error handling
│   ├── routes/
│   │   ├── index.ts             # Route aggregation
│   │   ├── auth.ts              # /auth/* endpoints
│   │   ├── orgs.ts              # /orgs/* endpoints
│   │   ├── aws-accounts.ts      # /aws/accounts/* endpoints
│   │   ├── resources.ts         # /resources/* endpoints
│   │   └── findings.ts          # /findings/* endpoints
│   ├── services/
│   │   ├── authService.ts       # Auth business logic
│   │   ├── orgService.ts
│   │   ├── awsAccountService.ts
│   │   ├── resourceService.ts
│   │   └── findingService.ts
│   ├── db/
│   │   └── schema.ts            # Drizzle schema definitions
│   ├── lib/
│   │   ├── db.ts                # Drizzle client setup
│   │   ├── redis.ts             # ioredis client
│   │   ├── jwt.ts               # jose JWT helpers
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

const secret = new TextEncoder().encode(config.JWT_SECRET);

export async function signToken(payload: { userId: string; orgId: string | null }) {
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.JWT_EXPIRY || '7d')
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jose.jwtVerify(token, secret);
  return payload as { userId: string; orgId: string | null };
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

  // Set JWT in httpOnly cookie
  c.header('Set-Cookie', `jwt=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);

  return c.json({ user, org, token }, 201);
});

// POST /auth/login
authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const { token, user, orgs } = await authService.login(email, password);

  c.header('Set-Cookie', `jwt=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);

  return c.json({ user, orgs, token }, 200);
});

// POST /auth/logout
authRoute.post('/logout', (c) => {
  c.header('Set-Cookie', 'jwt=; Max-Age=0');
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
import { getCookie } from 'hono/cookie';
import { jwt } from '../lib/jwt.js';
import { HTTP401Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

export const requireAuth = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  // Try to get token from Authorization header first, then from cookie
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? getCookie(c, 'jwt');

  if (!token) {
    throw new HTTP401Error('Missing authentication token');
  }

  try {
    const payload = await jwt.verify(token);

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
  const token = authHeader?.replace('Bearer ', '') ?? getCookie(c, 'jwt');

  if (token) {
    try {
      const payload = await jwt.verify(token);
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

JWT_SECRET=your-super-secret-key-change-in-prod
JWT_EXPIRY=7d

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
4. **JWT Strategy**: Using `jose` library for JWT signing/verification; supports httpOnly cookies + Bearer token
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
- Email verification flow
- Password reset flow
- Audit logging
- Rate limiting
- Integration tests

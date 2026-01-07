# ScanOrbit Node.js + TypeScript Backend – Complete Implementation Guide

## 1. Architecture Overview

### 1.1 Tech Stack

- **Framework**: Hono.js (TypeScript-first, minimal, fast, edge-friendly)
- **Database**: PostgreSQL with pg (node-postgres)
- **Type Validation**: Zod (schema validation + type inference)
- **ORM/Query Builder**: pg (raw SQL) or Knex.js (optional query builder)
- **Authentication**: JWT (stored in httpOnly cookies)
- **Password Hashing**: bcrypt
- **Job Queue**: Redis (simple queue or Bull for complex workflows)
- **Logging**: pino (structured JSON logging)
- **Environment**: dotenv
- **Error Handling**: Custom error classes + centralized error handler
- **API Documentation**: OpenAPI/Swagger (optional)

### 1.2 Project Structure

```
/api
├── src/
│   ├── index.ts                 # Hono app entry point
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification
│   │   ├── errorHandler.ts      # Global error handling
│   │   ├── logger.ts            # Request/response logging
│   │   └── cors.ts              # CORS setup
│   ├── routes/
│   │   ├── index.ts             # Route aggregation
│   │   ├── auth.ts              # /auth/* endpoints
│   │   ├── orgs.ts              # /orgs/* endpoints
│   │   ├── aws-accounts.ts      # /aws/accounts/* endpoints
│   │   ├── resources.ts         # /resources/* endpoints
│   │   └── findings.ts          # /findings/* endpoints
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── orgsController.ts
│   │   ├── awsAccountsController.ts
│   │   ├── resourcesController.ts
│   │   └── findingsController.ts
│   ├── services/
│   │   ├── authService.ts       # Auth business logic
│   │   ├── orgService.ts
│   │   ├── awsAccountService.ts
│   │   ├── resourceService.ts
│   │   ├── findingService.ts
│   │   └── awsDiscovery.ts      # AWS API calls (wrapper)
│   ├── repositories/
│   │   ├── userRepository.ts
│   │   ├── orgRepository.ts
│   │   ├── awsAccountRepository.ts
│   │   ├── resourceRepository.ts
│   │   └── findingRepository.ts
│   ├── lib/
│   │   ├── db.ts                # Postgres connection pool
│   │   ├── redis.ts             # Redis client
│   │   ├── jwt.ts               # JWT sign/verify helpers
│   │   ├── aws.ts               # AWS SDK setup
│   │   ├── logger.ts            # Logger instance
│   │   └── errors.ts            # Error classes
│   ├── types/
│   │   ├── index.ts             # Shared types
│   │   ├── entities.ts          # DB entity types
│   │   ├── api.ts               # Request/response types
│   │   └── aws.ts               # AWS-specific types
│   ├── migrations/
│   │   └── *.sql                # Database migrations
│   └── config/
│       └── index.ts             # Environment config
├── package.json
├── tsconfig.json
├── .env.example
└── Dockerfile
```

---

## 2. Database Schema (PostgreSQL)

### 2.1 Core Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  logo_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-Org memberships
CREATE TABLE user_org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, org_id)
);

-- AWS Accounts
CREATE TABLE aws_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  aws_account_id VARCHAR(12) NOT NULL,
  role_arn VARCHAR(255) NOT NULL,
  external_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- 'ok', 'error'
  last_error TEXT,
  last_scan_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, aws_account_id)
);

-- Scans (track scan jobs)
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  aws_account_id UUID NOT NULL REFERENCES aws_accounts(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'running', 'complete', 'error'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  resources_discovered INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resources
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  aws_account_id UUID NOT NULL REFERENCES aws_accounts(id) ON DELETE CASCADE,
  resource_id VARCHAR(255) NOT NULL, -- ARN or provider ID
  service VARCHAR(50) NOT NULL, -- 'ec2', 'ebs', 'rds', 's3', 'alb', 'acm'
  region VARCHAR(50),
  name VARCHAR(255),
  state VARCHAR(50), -- 'available', 'running', 'pending', etc.
  tags JSONB DEFAULT '{}',
  cost_estimate_monthly NUMERIC(10,2),
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  raw JSONB, -- Full provider response
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, aws_account_id, resource_id)
);

-- Certificates
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  aws_account_id UUID NOT NULL REFERENCES aws_accounts(id) ON DELETE CASCADE,
  identifier VARCHAR(255) NOT NULL, -- ARN or fingerprint
  source VARCHAR(50) NOT NULL, -- 'acm', 'endpoint_scan'
  primary_domain VARCHAR(255),
  alt_names JSONB DEFAULT '[]',
  not_before TIMESTAMP,
  not_after TIMESTAMP,
  issuer VARCHAR(255),
  algorithm VARCHAR(50),
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, aws_account_id, identifier)
);

-- Findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  aws_account_id UUID NOT NULL REFERENCES aws_accounts(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- 'orphaned_volume', 'ssl_expiry', 'data_residency_violation'
  severity VARCHAR(50) NOT NULL, -- 'low', 'medium', 'high'
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'open', -- 'resolved', 'snoozed', 'ignored'
  resolved_at TIMESTAMP,
  snoozed_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs (for background workers)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'scan_account', 'analyze_orphans'
  payload JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'queued', -- 'running', 'complete', 'error'
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_user_org_members_user_id ON user_org_members(user_id);
CREATE INDEX idx_user_org_members_org_id ON user_org_members(org_id);
CREATE INDEX idx_aws_accounts_org_id ON aws_accounts(org_id);
CREATE INDEX idx_resources_org_id ON resources(org_id);
CREATE INDEX idx_resources_account_id ON resources(aws_account_id);
CREATE INDEX idx_resources_service ON resources(service);
CREATE INDEX idx_findings_org_id ON findings(org_id);
CREATE INDEX idx_findings_type ON findings(type);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_certificates_org_id ON certificates(org_id);
```

---

## 3. Core Implementation

### 3.1 Database Connection (lib/db.ts)

```typescript
import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text);
    }
    return res;
  } catch (error) {
    console.error('Query error:', text, error);
    throw error;
  }
};

export default pool;
```

### 3.2 Auth Service (services/authService.ts)

```typescript
import * as bcrypt from 'bcrypt';
import { query } from '../lib/db';
import { jwt } from '../lib/jwt';
import { HTTP400Error, HTTP401Error } from '../lib/errors';

export const authService = {
  async signup(email: string, password: string, fullName: string) {
    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new HTTP400Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email',
      [email, passwordHash, fullName]
    );

    // Create org (auto-generated from email domain)
    const domain = email.split('@')[1];
    const slug = domain.replace(/\./g, '-');
    const org = await query(
      'INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING id, name',
      [domain, slug]
    );

    // Add user to org
    await query('INSERT INTO user_org_members (user_id, org_id, role) VALUES ($1, $2, $3)', [
      user.rows[0].id,
      org.rows[0].id,
      'admin',
    ]);

    return { user: user.rows[0], org: org.rows[0] };
  },

  async login(email: string, password: string) {
    const result = await query('SELECT id, password_hash FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      throw new HTTP401Error('Invalid credentials');
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      throw new HTTP401Error('Invalid credentials');
    }

    // Get user's orgs
    const orgs = await query(
      'SELECT o.* FROM orgs o JOIN user_org_members m ON o.id = m.org_id WHERE m.user_id = $1',
      [user.id]
    );

    // Sign JWT
    const token = jwt.sign({
      userId: user.id,
      orgId: orgs.rows[0]?.id || null, // Default to first org
    });

    return { token, user, orgs: orgs.rows };
  },

  async verifyToken(token: string) {
    return jwt.verify(token);
  },
};
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

### 4.1 Auth Middleware (middleware/auth.ts)

```typescript
import { Context, Next } from 'hono';
import { jwt } from '../lib/jwt';
import { HTTP401Error } from '../lib/errors';

export const requireAuth = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || 
                c.req.cookie('jwt');

  if (!token) {
    throw new HTTP401Error('Missing token');
  }

  try {
    const payload = jwt.verify(token);
    c.set('userId', payload.userId);
    c.set('orgId', payload.orgId);
  } catch (error) {
    throw new HTTP401Error('Invalid token');
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
# Install dependencies
npm install hono @hono/node-server pg zod @hono/zod-validator bcrypt jsonwebtoken pino dotenv

# TypeScript & Dev tools
npm install -D typescript tsx ts-node @types/node @types/pg

# Run dev server
npm run dev  # Uses tsx for hot reload
```

### 6.2 package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "pg": "^8.12.0",
    "zod": "^3.23.0",
    "@hono/zod-validator": "^0.2.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.1.2",
    "pino": "^8.17.0",
    "dotenv": "^16.4.5"
  }
}
```

### 6.3 Dockerfile (for Docker Compose deployment)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### 6.4 Environment Variables (.env)

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://user:password@postgres:5432/scanorbit
REDIS_URL=redis://redis:6379

JWT_SECRET=your-super-secret-key-change-in-prod
JWT_EXPIRY=7d

AWS_REGION=eu-west-1

FRONTEND_URL=http://localhost:3000
LOG_LEVEL=info
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

1. **Validation**: Zod schema (in routes)
2. **Authorization**: Check org membership
3. **Business Logic**: Service method
4. **Repository**: Data access
5. **Response**: Typed JSON

Example:

```typescript
// Route → validates input
// Service → checks auth + applies business logic
// Repository → queries database
// Response → JSON with types
```

---

## 9. Key Considerations

1. **Connection Pooling**: pg Pool handles up to 20 concurrent connections
2. **Query Logging**: Warn if query > 1s
3. **Error Handling**: Custom error classes with HTTP status codes
4. **JWT Strategy**: httpOnly cookies + short expiry
5. **JSONB for Flexibility**: tags, details, raw provider data stored as JSONB
6. **Indexes**: On common filter columns (org_id, type, severity, status)
7. **Migrations**: Use node-pg-migrate or manual SQL scripts

---

## 10. Next Steps

1. Implement Findings endpoints (list, detail, update status)
2. Implement Resources endpoints (list, detail, edit tags)
3. Implement AWS discovery service (ScanAwsAccount worker integration)
4. Add validation for all inputs (Zod schemas)
5. Add logging/observability
6. Write unit + integration tests
7. Set up CI/CD pipeline (GitHub Actions)

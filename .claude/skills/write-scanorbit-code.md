---
name: write-scanorbit-code
description: Write code that perfectly fits ScanOrbit project conventions across API routes, services, DB schema, tests, frontend components, hooks, stores, and Go workers
trigger: When writing, modifying, or generating code for any part of the ScanOrbit codebase
---

# ScanOrbit Code Conventions

Follow these patterns EXACTLY when writing code for this project. Every template is derived from the actual codebase.

---

## 1. API Routes (`apps/api/src/routes/`)

### Template

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { requireOrgId } from '../middlewares/requireOrgId.js';
import { requireNoProcessingRestriction } from '../middlewares/processingRestriction.js';
import { fooService } from '../services/fooService.js';
import { verifyOrgAdmin } from '../services/orgService.js';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

const fooRoute = new Hono<{ Variables: Variables }>();

// Auth + org context
fooRoute.use(requireAuth);
fooRoute.use(requireOrgId);
// GDPR: block writes when processing restricted
fooRoute.use('*', async (c, next) => {
  if (c.req.method !== 'GET') {
    return requireNoProcessingRestriction(c, next);
  }
  await next();
});

// Zod schemas at top of file, BEFORE route handlers
const createFooSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

// GET list
fooRoute.get('/', async (c) => {
  const orgId = c.get('orgId');
  const items = await fooService.getItems(orgId);
  return c.json({ data: items });
});

// POST create (admin-only)
fooRoute.post('/', zValidator('json', createFooSchema), async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  await verifyOrgAdmin(orgId, userId);
  const data = c.req.valid('json');
  const item = await fooService.createItem(orgId, data);
  return c.json({ data: item }, 201);
});

// GET single
fooRoute.get('/:id', async (c) => {
  const orgId = c.get('orgId');
  const id = c.req.param('id');
  if (!id) throw new HTTP400Error('ID is required');
  const item = await fooService.getItem(orgId, id);
  return c.json({ data: item });
});

// DELETE (admin-only)
fooRoute.delete('/:id', async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  await verifyOrgAdmin(orgId, userId);
  const id = c.req.param('id');
  if (!id) throw new HTTP400Error('ID is required');
  await fooService.deleteItem(orgId, id);
  return c.json({ message: 'Item deleted successfully' });
});

export default fooRoute;
```

### Response Patterns
- **Create**: `c.json({ data: item }, 201)`
- **Read single**: `c.json({ data: item })`
- **Read list**: `c.json({ data: items })`
- **Paginated**: `c.json({ data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })`
- **Delete**: `c.json({ message: 'Foo deleted successfully' })`
- **Async job**: `c.json({ data: job }, 202)`
- **Boolean action**: `c.json({ data: { revoked: true } })`

### Registration in `routes/index.ts`
```typescript
import fooRoute from './foo.js';
routes.route('/foo', fooRoute);
```

### Rate Limiting (security endpoints only)
```typescript
import { rateLimiters } from '../middlewares/rateLimit.js';
fooRoute.post('/sensitive', rateLimiters.sendCodeStrict((c: any) => c.req.valid('json').email), async (c) => { ... });
```

---

## 2. Services (`apps/api/src/services/`)

### Template: ES Module Singleton

```typescript
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP400Error, HTTP403Error, HTTP404Error } from '../lib/errors.js';
import { foos } from '../db/schema.js';
import type { Foo } from '../db/schema.js';
import { logger } from '../lib/logger.js';

interface CreateFooData {
  name: string;
  description?: string;
}

export const fooService = {
  async getItems(orgId: string): Promise<Foo[]> {
    return db
      .select()
      .from(foos)
      .where(eq(foos.orgId, orgId))
      .orderBy(desc(foos.createdAt));
  },

  async getItem(orgId: string, id: string): Promise<Foo> {
    const [item] = await db
      .select()
      .from(foos)
      .where(and(eq(foos.id, id), eq(foos.orgId, orgId)))
      .limit(1);

    if (!item) {
      throw new HTTP404Error('Foo not found');
    }
    return item;
  },

  async createItem(orgId: string, data: CreateFooData): Promise<Foo> {
    const item = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: foos.id })
        .from(foos)
        .where(and(eq(foos.orgId, orgId), eq(foos.name, data.name)))
        .limit(1);

      if (existing) {
        throw new HTTP400Error('Item with this name already exists');
      }

      const [created] = await tx
        .insert(foos)
        .values({ orgId, name: data.name, description: data.description })
        .returning();

      return created;
    });

    return item;
  },

  async deleteItem(orgId: string, id: string): Promise<void> {
    await this.getItem(orgId, id); // Verify exists + org scope
    await db.delete(foos).where(eq(foos.id, id));
  },
};
```

### DB Query Patterns
- **Select with conditions**: `db.select().from(table).where(and(eq(col, val), eq(col, val))).limit(1)`
- **Destructure single result**: `const [item] = await db.select()...`
- **Transaction**: `db.transaction(async (tx) => { ... })` — use `tx` not `db` inside
- **Count**: `const [{ value: count }] = await db.select({ value: sql<number>\`count(*)::int\` }).from(table).where(condition)`
- **Update**: `await db.update(table).set({ name: 'new' }).where(eq(table.id, id)).returning()`

### Tier Checks
```typescript
import { getOrgTier } from '../services/orgService.js';
import { TIER_LIMITS } from '../types/index.js';

const tier = await getOrgTier(orgId);
if (!TIER_LIMITS[tier].canViewAuditLogs) {
  throw new HTTP403Error('Feature available on Team plan only.');
}
```

---

## 3. Database Schema (`apps/api/src/db/schema.ts`)

```typescript
import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const foos = pgTable('foos', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  metadata: jsonb('metadata'),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  count: integer('count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('foos_org_id_idx').on(table.orgId),
  uniqueIndex('foos_org_name_idx').on(table.orgId, table.name),
]);

export const foosRelations = relations(foos, ({ one, many }) => ({
  org: one(orgs, {
    fields: [foos.orgId],
    references: [orgs.id],
  }),
}));

export type Foo = typeof foos.$inferSelect;
export type NewFoo = typeof foos.$inferInsert;
```

### Rules
- Table names: plural, snake_case (`aws_accounts`, `org_invitations`)
- DB columns: snake_case (`org_id`), TS fields: camelCase (`orgId`)
- Always include `id` (uuid), `createdAt`, `updatedAt`
- Foreign keys: `<table>_id` pattern, specify `onDelete`
- Indexes in third arg of `pgTable()` as array
- Relations defined separately with `relations()`
- Export both `$inferSelect` and `$inferInsert` types

---

## 4. Tests (`apps/api/src/test/`)

### Service Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];
let deleteResult: unknown[] = [];
const mockTransaction = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
    delete: vi.fn(() => createChain(deleteResult)),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  pool: {},
}));

vi.mock('../../lib/redis.js', () => ({
  redis: { rpush: vi.fn().mockResolvedValue(1), on: vi.fn() },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import AFTER vi.mock() calls
import { fooService } from '../../services/fooService.js';

describe('fooService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // CRITICAL: Reset result arrays
    selectResult = [];
    insertResult = [];
    updateResult = [];
    deleteResult = [];
    // CRITICAL: Restore mockImplementation (clearAllMocks does NOT reset these)
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    vi.mocked(db.delete).mockImplementation(() => createChain(deleteResult) as any);
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => createChain([]) as any),
        insert: vi.fn(() => createChain([]) as any),
        update: vi.fn(() => createChain([]) as any),
        delete: vi.fn(() => createChain([]) as any),
      };
      return fn(tx);
    });
  });

  it('returns items for org', async () => {
    selectResult = [{ id: '1', name: 'Test', orgId: 'org-1' }];
    const items = await fooService.getItems('org-1');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Test');
  });

  it('throws 404 when item not found', async () => {
    selectResult = [];
    await expect(fooService.getItem('org-1', 'missing'))
      .rejects.toThrow('Foo not found');
  });
});
```

### Route Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';

vi.mock('../../middlewares/auth.js', () => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-id');
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));

vi.mock('../../middlewares/requireOrgId.js', () => ({
  requireOrgId: vi.fn(async (_c: any, next: any) => { await next(); }),
}));

vi.mock('../../middlewares/processingRestriction.js', () => ({
  requireNoProcessingRestriction: vi.fn(async (_c: any, next: any) => { await next(); }),
}));

// vi.hoisted() for mock objects referenced in vi.mock() factories
const { mockFooService } = vi.hoisted(() => ({
  mockFooService: {
    getItems: vi.fn(),
    createItem: vi.fn(),
    getItem: vi.fn(),
    deleteItem: vi.fn(),
  },
}));

vi.mock('../../services/fooService.js', () => ({ fooService: mockFooService }));
vi.mock('../../services/orgService.js', () => ({ verifyOrgAdmin: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../lib/metrics.js', () => ({ errorsTotal: { inc: vi.fn() } }));

// Import AFTER all vi.mock()
import fooRoute from '../../routes/foo.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('Foo Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/foo', fooRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
  });

  it('GET /foo returns list', async () => {
    mockFooService.getItems.mockResolvedValue([{ id: '1', name: 'Test' }]);
    const res = await app.request('/foo');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('POST /foo creates item', async () => {
    mockFooService.createItem.mockResolvedValue({ id: '1', name: 'New' });
    const res = await app.request('/foo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    });
    expect(res.status).toBe(201);
  });

  it('POST /foo rejects invalid body', async () => {
    const res = await app.request('/foo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
```

### Factory Pattern (`test/helpers/factories.ts`)
```typescript
export function createFoo(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    orgId: crypto.randomUUID(),
    name: 'Test Foo',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

### Critical Test Rules
- **`vi.clearAllMocks()` does NOT reset `mockImplementation()`** -- manually restore in `beforeEach`
- All `vi.mock()` at top level, BEFORE imports of module under test
- `vi.hoisted()` when mock objects are referenced inside `vi.mock()` factory functions
- Always mock: `lib/db.js`, `lib/redis.js`, `lib/logger.js`, `lib/metrics.js`
- Route tests MUST mount `errorHandler` with `app.onError(errorHandler)`

---

## 5. Error Handling

```typescript
import { HTTP400Error, HTTP401Error, HTTP403Error, HTTP404Error, HTTP409Error, HTTP429Error } from '../lib/errors.js';

throw new HTTP404Error('Resource not found');
throw new HTTP400Error('Invalid input');
throw new HTTP403Error('Only admins can perform this action');
throw new HTTP409Error('Resource already exists');
throw new HTTP429Error('Please wait before trying again');
```

Error response format (global `errorHandler`):
```json
{ "error": "HTTP404Error", "message": "Resource not found" }
```

Validation errors (automatic from `zValidator`):
```json
{ "error": "ValidationError", "message": "Invalid request data", "details": [{ "path": "name", "message": "Required" }] }
```

---

## 6. Frontend Components (`apps/app/src/components/`)

### Component Template

```tsx
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface MyComponentProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  onAction?: () => void;
}

export function MyComponent({ title, description, icon: Icon, className, onAction }: MyComponentProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {onAction && <Button onClick={onAction} variant="outline" size="sm">Action</Button>}
      </CardContent>
    </Card>
  );
}
```

### Page Template

```tsx
export default function MyPage() {
  const { org } = useAuthStore();
  const { data, isLoading } = useFoos();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
          <p className="text-muted-foreground">Description text</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Action</Button>
        </div>
      </div>

      {/* Stats cards */}
      {!isLoading && <StatsCards data={data} />}

      {/* Empty state */}
      {!isLoading && !data?.length && (
        <EmptyState icon={SearchX} title="No items" description="Get started by creating one." />
      )}

      {/* Content */}
      {data?.length > 0 && (
        <div className="space-y-4">
          <Filters />
          <DataTable items={data} />
        </div>
      )}
    </div>
  );
}
```

### Color Tokens (Tailwind CSS 4)
- **Text**: `text-primary`, `text-muted-foreground`, `text-destructive`
- **Background**: `bg-primary`, `bg-muted`, `bg-card`, `bg-accent`, `bg-destructive/10`
- **Border**: `border`, `border-destructive/50`
- **Status**: `text-status-critical`, `text-status-high`, `text-status-warning`, `text-status-success`, `bg-status-critical`, `bg-status-success`
- **Responsive**: `hidden md:table-cell`, `text-sm sm:text-base`, `p-3 md:p-6`

### Rules
- Named exports for components (not default), default exports for pages
- Props interface with `Props` suffix: `interface FooProps {}`
- PascalCase filenames for components
- `cn()` from `@/lib/utils` for class merging
- Icons from `lucide-react`
- Radix UI primitives from `@/components/ui/*`
- Import paths use `@/` alias

---

## 7. React Query Hooks (`apps/app/src/hooks/`)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";

// Query with filters
export function useFoos(filters?: FooFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["foos", filters],
    queryFn: () => api.getFoos(filters),
    enabled: options?.enabled ?? true,
  });
}

// Query single item
export function useFoo(id: string) {
  return useQuery({
    queryKey: ["foo", id],
    queryFn: () => api.getFoo(id),
    enabled: !!id,
  });
}

// Mutation with cache invalidation
export function useCreateFoo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createFoo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foos"] });
    },
  });
}

// Mutation with optimistic update
export function useUpdateFooStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateFooStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
```

### Rules
- kebab-case filenames: `use-foos.ts`
- `queryKey` MUST include all filter parameters
- `enabled: !!id` for conditional fetching
- Mutations invalidate ALL related query keys on success

---

## 8. Zustand Stores (`apps/app/src/stores/`)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FooState {
  items: Foo[];
  selectedId: string | null;
  setItems: (items: Foo[]) => void;
  setSelectedId: (id: string | null) => void;
}

export const useFooStore = create<FooState>()(
  persist(
    (set, get) => ({
      items: [],
      selectedId: null,
      setItems: (items) => set({ items }),
      setSelectedId: (id) => set({ selectedId: id }),
    }),
    {
      name: "scanorbit:foo",
      partialize: (state) => ({
        selectedId: state.selectedId, // Only persist what's needed
      }),
    }
  )
);
```

### Rules
- kebab-case filenames: `foo-store.ts`
- Always use `persist` middleware with `partialize` to limit persisted state
- Storage key: `"scanorbit:<name>"` or `"<name>-storage"`
- Actions mutate via `set()`, read via `get()`
- Access token stored in memory (NOT in store/localStorage)

---

## 9. Forms

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
});

type FormData = z.infer<typeof schema>;

function MyForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await api.createFoo(data);
      toast({ title: "Created", description: "Item created successfully", type: "success" });
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} disabled={isSubmitting} />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <LoadingSpinner size="sm" className="mr-2" /> : null}
        Create
      </Button>
    </form>
  );
}
```

---

## 10. Toast Notifications

```typescript
import { useToast } from "@/hooks/use-toast";
// or import { toast } from "@/hooks/use-toast"; (outside components)

const { toast } = useToast();
toast({ title: "Created", description: "Item created successfully", type: "success" });
toast({ title: "Error", description: "Could not create item", type: "error" });
toast({ title: "Warning", description: "Some operations failed", type: "warning" });
```

---

## 11. Go Workers (`workers/`)

### Structure
```
workers/
  cmd/scanner/main.go       # Entry, metrics on :9090
  cmd/analyzer/main.go      # Entry, metrics on :9091
  internal/
    scanner/                 # AWS resource discovery
    analyzers/               # Security/cost analysis
    store/                   # PostgreSQL (pgx)
    queue/                   # Redis job queue
    config/                  # Env config loading
    crypto/                  # AES-256 encryption
    metrics/                 # Prometheus metrics
    models/                  # Data structures
    awsclient/               # AWS SDK wrapper
    recovery/                # Error recovery
    pricing/                 # AWS pricing data
    testutil/                # Test fixtures
```

### Patterns
```go
// Structured logging (zerolog)
logger := zerolog.New(os.Stdout).With().Timestamp().Str("service", "scanner").Logger()
logger.Info().Str("account_id", accountID).Msg("starting scan")

// Error wrapping
return nil, fmt.Errorf("get resources: %w", err)

// Graceful shutdown
ctx, cancel := context.WithCancel(context.Background())
defer cancel()
sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
go func() { <-sigCh; cancel() }()
```

### Conventions
- `CGO_ENABLED=0` static binaries
- Run as `nobody:nobody` in Docker
- `testcontainers-go` for integration tests (tagged `integration`)
- snake_case for JSON/Redis fields (`job_id`, `account_id`)
- Prometheus metrics on separate port

---

## 12. General Conventions

### ESM Imports (API)
```typescript
// Always .js extension
import { fooService } from '../services/fooService.js';
import type { Foo } from '../db/schema.js';
```

### Const Enums
```typescript
export const FooStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;
export type FooStatus = (typeof FooStatus)[keyof typeof FooStatus];
```

### TypeScript
- Strict mode, `noUnusedLocals`, `noUnusedParameters`
- `prefer-const`, no `var`
- `import type` for type-only imports (consistent-type-imports)
- No `any` (warn) -- use `unknown` + type guards
- Unused vars prefixed with `_` are allowed
- `eqeqeq` except `== null`

### Logging
```typescript
import { logger } from '../lib/logger.js';
logger.info('User created', { userId, orgId });
logger.error('Failed to create user', error, { userId, orgId });
logger.warn('Rate limit approaching', { ip, remaining });
```

---

## 13. Quick Reference

| DO | DON'T |
|---|---|
| `export const fooService = { ... }` | Create service classes |
| Use `.js` extensions in API imports | Import without extension |
| `and(eq(...), eq(...))` for WHERE | Raw SQL for simple queries |
| Scope all queries by `orgId` | Query without tenant isolation |
| Restore `mockImplementation` in `beforeEach` | Rely on `vi.clearAllMocks()` alone |
| `vi.hoisted()` for mock objects in `vi.mock()` | Reference outer variables in `vi.mock()` |
| Throw `HTTP4xxError` classes | Return error responses manually |
| `cn()` for Tailwind class merging | Concatenate class strings |
| `@/` alias for frontend imports | Relative paths in frontend |
| Named exports for components | Default exports for components |
| `interface FooProps {}` | `type FooProps = {}` |
| `zValidator('json', schema)` | Parse body manually |
| `queryKey: ["items", filters]` | Forget filters in query key |
| Invalidate related queries on mutation | Forget cache invalidation |
| `persist` + `partialize` for Zustand | Persist entire store state |
| `z.infer<typeof schema>` for form types | Manually duplicate form types |
| `sql<number>\`count(*)::int\`` | `count()` without cast |

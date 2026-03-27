---
name: drizzle-orm-migrations
description: Drizzle ORM schema, migrations, and query patterns for PostgreSQL. Use when modifying database schema, writing queries, or managing migrations.
---

# Drizzle ORM & Migrations

Schema definition, migration workflow, and query patterns for this project's PostgreSQL database.

## Key Files

- `apps/api/src/db/schema.ts` — Full schema definition (single source of truth)
- `apps/api/src/db/migrate.ts` — Migration runner with smart sync
- `apps/api/drizzle.config.cjs` — Drizzle Kit config
- `apps/api/src/db/migrations/` — Generated SQL migrations + journal
- `apps/api/src/lib/db.ts` — Connection pool setup

## Schema Patterns

### Table definition:

```typescript
import { pgTable, uuid, varchar, text, timestamp, jsonb, numeric, boolean, integer,
         index, uniqueIndex } from 'drizzle-orm/pg-core';

export const tableName = pgTable('table_name', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(false).notNull(),
  count: integer('count').default(0).notNull(),
  cost: numeric('cost', { precision: 10, scale: 2 }),
  metadata: jsonb('metadata').default({}).notNull(),
  typedArray: jsonb('typed_array').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // Foreign key with cascade delete
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  // Optional FK with set null
  resourceId: uuid('resource_id').references(() => resources.id, { onDelete: 'set null' }),
}, (table) => [
  // Unique composite index
  uniqueIndex('table_org_name_idx').on(table.orgId, table.name),
  // Query performance index
  index('table_status_idx').on(table.orgId, table.status),
]);
```

### Common column patterns:

- UUID PKs: `uuid('id').primaryKey().defaultRandom()`
- Timestamps: `timestamp('created_at').defaultNow().notNull()`
- Typed JSONB: `jsonb('field').$type<MyType>().default(defaultValue).notNull()`
- Enums as varchar: `varchar('status', { length: 50 }).default('open').notNull()`

## Migration Workflow

### 1. Modify schema in `db/schema.ts`

### 2. Generate migration:

```bash
pnpm db:generate
```

Creates a numbered SQL file in `db/migrations/` and updates `meta/_journal.json`.

### 3. Review the generated SQL before applying.

### 4. Apply migration:

```bash
pnpm db:migrate
```

### 5. Open Drizzle Studio (optional):

```bash
make db-studio
```

## Query Patterns

### Basic select with filters:

```typescript
import { eq, and, desc, count, inArray, sql } from 'drizzle-orm';

const [item] = await db
  .select()
  .from(table)
  .where(and(eq(table.id, id), eq(table.orgId, orgId)))
  .limit(1);
```

### Pagination:

```typescript
const page = filters.page ?? 1;
const limit = Math.min(filters.limit ?? 50, 100);
const offset = (page - 1) * limit;

const [countResult] = await db
  .select({ count: count() })
  .from(table)
  .where(and(...conditions));

const data = await db
  .select()
  .from(table)
  .where(and(...conditions))
  .orderBy(desc(table.createdAt))
  .limit(limit)
  .offset(offset);
```

### Dynamic conditions:

```typescript
const conditions = [eq(table.orgId, orgId)];
if (filters.status) conditions.push(eq(table.status, filters.status));
if (filters.severity) conditions.push(eq(table.severity, filters.severity));

const data = await db.select().from(table).where(and(...conditions));
```

### Parallel queries with Promise.all:

```typescript
const [byStatus, bySeverity, [totalResult]] = await Promise.all([
  db.select({ status: t.status, count: count() }).from(t).where(eq(t.orgId, orgId)).groupBy(t.status),
  db.select({ severity: t.severity, count: count() }).from(t).where(eq(t.orgId, orgId)).groupBy(t.severity),
  db.select({ count: count() }).from(t).where(eq(t.orgId, orgId)),
]);
```

### Transactions:

```typescript
const result = await db.transaction(async (tx) => {
  // Check limits
  const [{ value: itemCount }] = await tx
    .select({ value: count() })
    .from(table)
    .where(eq(table.orgId, orgId));

  if (itemCount >= maxItems) throw new HTTP403Error('Limit exceeded');

  // Insert
  const [created] = await tx
    .insert(table)
    .values({ orgId, ...data })
    .returning();

  return created;
});
```

### Bulk update with returning:

```typescript
const result = await db
  .update(table)
  .set({ status: 'resolved', updatedAt: new Date() })
  .where(and(inArray(table.id, ids), eq(table.orgId, orgId)))
  .returning({ id: table.id });
```

## DB Connection

```typescript
// lib/db.ts — Pool with 20 max connections, 2s connect timeout, TLS 1.3+
const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
export const db = drizzle(pool, { schema });
```

## Smart Migration System

The migration runner in `db/migrate.ts`:
- Checks if target database exists (creates if needed)
- Detects manually-applied migrations and syncs the tracking table
- Uses SHA-256 hashes for migration file integrity
- Handles both `src/` and `dist/` execution paths

## Common Mistakes

- Forgetting `.notNull()` on columns that should not be nullable
- Not adding indexes for frequently filtered columns (especially `orgId` composites)
- Forgetting to include `updatedAt: new Date()` in update operations
- Not scoping queries to `orgId` — every user-facing query must be org-scoped
- Using `db.insert().values()` without `.returning()` when you need the created record

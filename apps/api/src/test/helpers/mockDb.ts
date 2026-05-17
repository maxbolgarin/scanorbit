import { vi } from 'vitest';

/**
 * Creates a chainable mock that simulates Drizzle ORM query builder.
 * Each method returns `this` for chaining, and the chain is thenable
 * so `await db.select().from().where()` resolves to the configured value.
 */
export function createChain(resolvedValue: unknown = [], meta?: { rowCount?: number }) {
  const chain: Record<string, unknown> = {};

  const methods = [
    'select', 'insert', 'update', 'delete', 'selectDistinct',
    'from', 'where', 'set', 'values', 'returning',
    'limit', 'offset', 'orderBy', 'groupBy',
    'innerJoin', 'leftJoin', 'rightJoin', 'fullJoin',
    'having', 'as', 'onConflictDoNothing', 'onConflictDoUpdate', 'for',
  ];

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  // Make the chain thenable (so `await chain` resolves)
  chain.then = (resolve: (v: unknown) => unknown) => {
    if (meta) {
      return resolve(Object.assign(resolvedValue ?? {}, meta));
    }
    return resolve(resolvedValue);
  };

  return chain;
}

/**
 * Creates a mock db object that returns fresh chains.
 * Use `mockDbResult` to configure what specific queries return.
 */
export function createMockDb() {
  const mockDb = {
    select: vi.fn(() => createChain([])),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
    delete: vi.fn(() => createChain([])),
    selectDistinct: vi.fn(() => createChain([])),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Transaction mock: pass a mock tx that behaves like db
      const tx = createMockDb();
      return fn(tx);
    }),
    query: {} as Record<string, unknown>,
  };
  return mockDb;
}

/**
 * Creates a mock pool object (matches pg.Pool interface for tests)
 */
export function createMockPool(): {
  query: ReturnType<typeof vi.fn>;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  connect: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
} {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    totalCount: 20,
    idleCount: 18,
    waitingCount: 0,
    connect: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
}

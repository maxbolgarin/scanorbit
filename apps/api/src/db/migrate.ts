import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../lib/config.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const { Pool } = pg;

// SSL config for self-signed PostgreSQL certificates (same as db.ts)
const useSSL = config.databaseUrl.includes('sslmode=require');
const caCert = process.env.DB_CA_CERT
  ? readFileSync(process.env.DB_CA_CERT)
  : undefined;
const sslConfig = useSSL ? { ssl: { rejectUnauthorized: true, ca: caCert, minVersion: 'TLSv1.3' as const } } : {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Ensure the target database exists.
 * Connects to the default 'postgres' database and creates the target database if it doesn't exist.
 */
async function ensureDatabaseExists(): Promise<void> {
  const dbUrl = new URL(config.databaseUrl);
  const targetDb = dbUrl.pathname.slice(1); // Remove leading '/'

  if (!targetDb) {
    console.log('⚠️  No database name found in DATABASE_URL, skipping database creation check');
    return;
  }

  // Connect to the default 'postgres' database
  dbUrl.pathname = '/postgres';
  const adminPool = new Pool({
    connectionString: dbUrl.toString(),
    max: 1,
    ...sslConfig,
  });

  try {
    // Check if database exists
    const result = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );

    if (result.rows.length === 0) {
      console.log(`📦 Database "${targetDb}" does not exist, creating...`);
      // Use double quotes for the database name to handle special characters
      await adminPool.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`✅ Database "${targetDb}" created successfully\n`);
    } else {
      console.log(`✅ Database "${targetDb}" exists\n`);
    }
  } finally {
    await adminPool.end();
  }
}

// Resolve migrations folder - always use source directory, not dist
// If running from dist, go up to src; if running from src, use current dir
function getMigrationsDir(): string {
  const currentDir = __dirname;
  // Check if we're in dist folder
  if (currentDir.includes('/dist/') || currentDir.includes('\\dist\\')) {
    // Replace dist/db with src/db
    const srcDir = currentDir.replace(/[/\\]dist[/\\]db/, '/src/db').replace(/[/\\]dist[/\\]db/, '\\src\\db');
    const migrationsDir = join(srcDir, 'migrations');
    // Fallback: try going up from dist/db to src/db
    if (!existsSync(migrationsDir)) {
      const altPath = join(currentDir, '..', '..', 'src', 'db', 'migrations');
      if (existsSync(altPath)) {
        return altPath;
      }
    }
    return migrationsDir;
  }
  // Running from source, use current directory
  return join(__dirname, 'migrations');
}

interface MigrationEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface MigrationJournal {
  version: string;
  dialect: string;
  entries: MigrationEntry[];
}

function loadMigrationJournal(): MigrationJournal {
  const migrationsDir = getMigrationsDir();
  const journalPath = join(migrationsDir, 'meta', '_journal.json');
  if (!existsSync(journalPath)) {
    throw new Error(`Migration journal not found at: ${journalPath}`);
  }
  const journalContent = readFileSync(journalPath, 'utf-8');
  return JSON.parse(journalContent) as MigrationJournal;
}

interface AppliedMigration {
  id: number;
  hash: string;
  createdAt: Date;
}

async function ensureMigrationsTable(pool: pg.Pool): Promise<void> {
  // Check if migrations table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = '__drizzle_migrations'
    );
  `);

  if (!tableCheck.rows[0].exists) {
    // Create the migrations table that Drizzle expects
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL UNIQUE,
        created_at bigint
      );
    `);
    console.log('📝 Created __drizzle_migrations tracking table\n');
  }
}

async function getAppliedMigrations(pool: pg.Pool): Promise<AppliedMigration[]> {
  try {
    // Ensure migrations table exists
    await ensureMigrationsTable(pool);

    const result = await pool.query(`
      SELECT id, hash, created_at FROM __drizzle_migrations 
      ORDER BY created_at ASC
    `);

    return result.rows.map((row) => ({
      id: row.id,
      hash: row.hash,
      createdAt: row.created_at ? new Date(Number(row.created_at)) : new Date(),
    }));
  } catch (error) {
    console.error('Error checking applied migrations:', error);
    return [];
  }
}

/**
 * Calculate hash for a migration file (same algorithm Drizzle uses)
 * Drizzle uses SHA-256 hash of the migration file content
 */
function calculateMigrationHash(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  // Drizzle uses SHA-256 hash
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Sync migration tracking by reading migration files and inserting their hashes.
 * This is useful when migrations were applied manually or tracking got out of sync.
 *
 * IMPORTANT: Only pass entries that are KNOWN to have been applied to the database.
 * Syncing unapplied migrations will cause them to be skipped permanently.
 *
 * @param maxEntries - Only sync the first N journal entries (to avoid marking unapplied migrations as applied)
 */
async function syncMigrationTracking(
  pool: pg.Pool,
  migrationsFolder: string,
  journal: MigrationJournal,
  maxEntries?: number
): Promise<void> {
  let syncedCount = 0;

  const entries = maxEntries !== undefined
    ? journal.entries.slice(0, maxEntries)
    : journal.entries;

  for (const entry of entries) {
    const fileName = `${entry.tag}.sql`;
    const filePath = join(migrationsFolder, fileName);

    if (!existsSync(filePath)) {
      console.warn(`  ⚠️  Migration file not found: ${fileName}`);
      continue;
    }

    // Calculate hash from file content
    const hash = calculateMigrationHash(filePath);

    // Check if this hash is already in the database
    const existing = await pool.query(
      'SELECT id FROM __drizzle_migrations WHERE hash = $1',
      [hash]
    );

    if (existing.rows.length === 0) {
      // Insert migration hash using folderMillis as created_at (matches Drizzle's behavior)
      await pool.query(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when]
      );
      syncedCount++;
      console.log(`  ✅ Synced: ${entry.tag}`);
    } else {
      console.log(`  ⏭️  Already tracked: ${entry.tag}`);
    }
  }

  if (syncedCount > 0) {
    console.log(`\n✅ Synced ${syncedCount} migration(s) to tracking table`);
  } else {
    console.log(`\n✅ All migrations already tracked`);
  }
}

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  // Ensure the target database exists before attempting migrations
  await ensureDatabaseExists();

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 1, // Use single connection for migrations
    ...sslConfig,
  });

  try {
    const db = drizzle(pool);

    // Load migration journal
    const journal = loadMigrationJournal();
    console.log(`📋 Found ${journal.entries.length} migration(s) in journal\n`);

    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(pool);
    console.log(`✅ ${appliedMigrations.length} migration(s) already applied`);
    if (appliedMigrations.length > 0) {
      appliedMigrations.forEach((applied, index) => {
        const migration = journal.entries.find((e) => e.tag === applied.hash);
        const name = migration ? migration.tag : applied.hash;
        const date = applied.createdAt.toISOString();
        console.log(`  ${index + 1}. ${name} (applied ${date})`);
      });
    }
    console.log('');

    // Show all available migrations
    console.log(`📋 Available migrations (${journal.entries.length} total):\n`);
    journal.entries.forEach((migration, index) => {
      const isApplied = index < appliedMigrations.length;
      const status = isApplied ? '✅ Applied' : '⏳ Pending';
      const date = new Date(migration.when).toISOString();
      console.log(`  ${index + 1}. ${migration.tag} - ${status}`);
      console.log(`     Created: ${date}`);
      console.log('');
    });

    // Note: We show status above, but always let Drizzle's migrator determine
    // what needs to be applied, as it uses content hashes, not tag names.
    // The pending migrations check above is just for display purposes.
    
    console.log(`🔄 Applying migrations with Drizzle migrator...\n`);

    // Resolve migrations folder path (always use source directory)
    const migrationsFolder = getMigrationsDir();
    console.log(`📁 Migrations folder: ${migrationsFolder}`);
    
    // Verify migrations folder exists
    if (!existsSync(migrationsFolder)) {
      throw new Error(`Migrations folder not found: ${migrationsFolder}`);
    }
    
    // Verify journal file exists
    const journalPath = join(migrationsFolder, 'meta', '_journal.json');
    if (!existsSync(journalPath)) {
      throw new Error(`Migration journal not found: ${journalPath}`);
    }
    console.log(`✅ Migrations folder verified\n`);

    // Ensure migrations table exists before running migrations
    await ensureMigrationsTable(pool);

    // Check if we need to sync migrations (tables exist but tracking table is empty)
    const appliedMigrationsBefore = await getAppliedMigrations(pool);
    const appTablesCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name NOT LIKE '__drizzle%'
      AND table_name IN ('users', 'orgs', 'aws_accounts')
    `);
    const hasAppTables = parseInt(appTablesCheck.rows[0].count) > 0;

    // If tables exist but no migrations are tracked, sync only the initial schema migration (0000).
    // We must NOT sync subsequent migrations because they may not have been applied yet —
    // marking them as applied would cause Drizzle to skip them permanently.
    if (hasAppTables && appliedMigrationsBefore.length === 0) {
      console.log('⚠️  Detected existing tables but empty migrations table.');
      console.log('   Syncing only the initial schema migration (0000)...\n');

      try {
        await syncMigrationTracking(pool, migrationsFolder, journal, 1);
        console.log('✅ Initial migration tracking synced!\n');
      } catch (syncError) {
        console.warn('⚠️  Could not auto-sync migrations:', syncError instanceof Error ? syncError.message : String(syncError));
        console.log('   Continuing with normal migration process...\n');
      }
    }

    // Drop stale drizzle-schema migrations table if it exists (we use public schema)
    await pool.query(`DROP TABLE IF EXISTS drizzle.__drizzle_migrations`);
    await pool.query(`DROP SCHEMA IF EXISTS drizzle`);

    // Fix created_at values: Drizzle compares created_at against folderMillis (journal entry timestamps).
    // If created_at was set to Date.now() by a previous sync, it may be larger than folderMillis of
    // future migrations, causing them to be skipped. Re-sync created_at with journal entry timestamps.
    const currentMigrations = await getAppliedMigrations(pool);
    for (const entry of journal.entries) {
      const filePath = join(migrationsFolder, `${entry.tag}.sql`);
      if (!existsSync(filePath)) continue;
      const hash = calculateMigrationHash(filePath);
      const existing = currentMigrations.find((m) => m.hash === hash);
      if (existing) {
        await pool.query(
          'UPDATE __drizzle_migrations SET created_at = $1 WHERE hash = $2',
          [entry.when, hash]
        );
      }
    }

    // Run migrations with drizzle's migrator
    // Drizzle will determine which migrations need to be applied based on folderMillis timestamps
    try {
      await migrate(db, {
        migrationsFolder,
        migrationsSchema: 'public',
      });
      console.log('✅ Migrations check completed!\n');
    } catch (error) {
      // Check if error is due to column/table already existing (migration already applied)
      const err = error as Error & { cause?: { code?: string; message?: string } };
      const isAlreadyExistsError = 
        err.cause?.code === '42701' || // duplicate_column
        err.cause?.code === '42P07' || // duplicate_table
        err.message?.includes('already exists') ||
        err.cause?.message?.includes('already exists');

      if (isAlreadyExistsError) {
        console.warn('⚠️  Migration failed because changes already exist in database.');
        console.warn('   This usually means the migration was applied manually.');
        console.warn('   Attempting to sync migration tracking...\n');

        // The "already exists" error proves the failing migration's SQL was applied to the DB.
        // Sync ALL journal entries so Drizzle's tracking catches up with the actual schema state.
        try {
          await syncMigrationTracking(pool, migrationsFolder, journal);
          console.log('✅ Migration tracking synced after error!\n');

          // Try running migrations again after sync
          await migrate(db, {
            migrationsFolder,
            migrationsSchema: 'public',
          });
          console.log('✅ Migrations check completed after sync!\n');
        } catch (retryError) {
          // Retry also failed — re-throw to fail the process
          throw retryError;
        }
      } else {
        // Other errors - re-throw to fail the process
        throw error;
      }
    }

    const finalMigrations = await getAppliedMigrations(pool);
    console.log(`📊 Final state: ${finalMigrations.length} migration(s) applied\n`);

    // Show all applied migrations with details
    const finalMigrationsList = await getAppliedMigrations(pool);
    if (finalMigrationsList.length > 0) {
      console.log('All applied migrations:');
      finalMigrationsList.forEach((applied, index) => {
        const migration = journal.entries.find((e) => e.tag === applied.hash);
        const name = migration ? migration.tag : applied.hash;
        const date = applied.createdAt.toISOString();
        console.log(`  ${index + 1}. ${name}`);
        console.log(`     Applied: ${date}`);
      });
      console.log('');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('migrate.ts') ||
                     process.argv[1]?.endsWith('migrate.js');

if (isMainModule) {
  runMigrations().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runMigrations };

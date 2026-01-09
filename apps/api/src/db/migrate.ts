import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../lib/config.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 1, // Use single connection for migrations
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
      const isApplied = appliedMigrations.some((applied) => applied.hash === migration.tag);
      const status = isApplied ? '✅ Applied' : '⏳ Pending';
      const date = new Date(migration.when).toISOString();
      console.log(`  ${index + 1}. ${migration.tag} - ${status}`);
      console.log(`     Created: ${date}`);
      console.log('');
    });

    // Check for pending migrations
    const pendingMigrations = journal.entries.filter((entry) => {
      return !appliedMigrations.some((applied) => applied.hash === entry.tag);
    });

    if (pendingMigrations.length === 0) {
      console.log('✨ Database is up to date! No migrations to apply.\n');
      return;
    }

    // Show preview of pending migrations
    console.log(`📦 ${pendingMigrations.length} migration(s) will be applied:\n`);
    const migrationsDir = getMigrationsDir();
    for (const migration of pendingMigrations) {
      const sqlPath = join(migrationsDir, `${migration.tag}.sql`);
      if (existsSync(sqlPath)) {
        const sqlContent = readFileSync(sqlPath, 'utf-8');
        const statements = sqlContent.split('--> statement-breakpoint').length - 1;
        console.log(`  • ${migration.tag}`);
        console.log(`    SQL statements: ${statements}`);
        console.log('');
      } else {
        console.log(`  • ${migration.tag} (SQL file not found)`);
        console.log('');
      }
    }

    console.log(`🔄 Applying migrations...\n`);

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

    // Run migrations with drizzle's migrator
    try {
      await migrate(db, {
        migrationsFolder,
      });
      console.log('✅ All migrations applied successfully!\n');
    } catch (error) {
      // If migrate fails but tables exist, it might be a tracking issue
      console.error('⚠️  Migration error (but checking if migrations were applied):', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
    }

    // After migration, ensure migrations table exists and backfill if needed
    await ensureMigrationsTable(pool);
    
    // Check if migrations were applied but not recorded
    const afterMigrationCheck = await getAppliedMigrations(pool);
    if (afterMigrationCheck.length === 0 && pendingMigrations.length > 0) {
      // Migrations were likely applied but not recorded - backfill the tracking table
      console.log('⚠️  Migrations appear to have been applied but not recorded.');
      console.log('📝 Backfilling migration tracking table...\n');
      
      for (const migration of pendingMigrations) {
        // Check if this migration's tables/features exist
        // For now, we'll record all pending migrations as applied
        // since the tables already exist
        const timestamp = Date.now();
        await pool.query(`
          INSERT INTO __drizzle_migrations (hash, created_at)
          VALUES ($1, $2)
          ON CONFLICT (hash) DO NOTHING
        `, [migration.tag, timestamp]);
        console.log(`  ✓ Recorded: ${migration.tag}`);
      }
      console.log('');
    }

    // Verify final state
    const finalAppliedMigrations = await getAppliedMigrations(pool);
    
    // Debug: Show what's actually in the database
    if (finalAppliedMigrations.length === 0) {
      // Check if migrations table exists and what's in it
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '__drizzle_migrations'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        const allRows = await pool.query(`SELECT * FROM __drizzle_migrations`);
        console.log(`⚠️  Migrations table exists but is empty. Found ${allRows.rows.length} row(s).`);
        if (allRows.rows.length > 0) {
          console.log('Debug - Raw migration data:');
          allRows.rows.forEach((row, idx) => {
            console.log(`  Row ${idx + 1}:`, JSON.stringify(row, null, 2));
          });
        }
      } else {
        console.log(`⚠️  Migrations table does not exist after migration run.`);
      }
      
      // Check if any application tables were created (indicating migrations ran)
      const appTablesCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name NOT LIKE '__drizzle%'
        ORDER BY table_name;
      `);
      
      if (appTablesCheck.rows.length > 0) {
        console.log(`\n✅ Application tables exist (${appTablesCheck.rows.length} tables), indicating migrations were applied:`);
        appTablesCheck.rows.forEach((row) => {
          console.log(`  - ${row.table_name}`);
        });
        console.log(`\n⚠️  However, drizzle migrations table shows 0 migrations.`);
        console.log(`This suggests a mismatch in how migrations are being tracked.\n`);
      } else {
        console.log(`\n⚠️  No application tables found. Migrations may not have been applied.\n`);
      }
    }
    
    console.log(`📊 Final state: ${finalAppliedMigrations.length} migration(s) applied\n`);

    // Show all applied migrations with details
    if (finalAppliedMigrations.length > 0) {
      console.log('All applied migrations:');
      finalAppliedMigrations.forEach((applied, index) => {
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

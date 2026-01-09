/**
 * Database reset script - drops all tables and re-runs migrations
 * Usage: pnpm db:reset
 */

import { config } from '../lib/config.js';
import postgres from 'postgres';

async function resetDatabase() {
  console.log('Connecting to database...');

  const sql = postgres(config.databaseUrl, { max: 1 });

  try {
    console.log('Dropping all tables...');

    // Drop all tables in the public schema
    await sql`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `;

    // Also drop the drizzle migrations table if it exists
    await sql`DROP TABLE IF EXISTS drizzle.__drizzle_migrations CASCADE`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;

    console.log('All tables dropped successfully!');
    console.log('');
    console.log('Run migrations to recreate tables:');
    console.log('  pnpm db:migrate');
  } catch (error) {
    console.error('Failed to reset database:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

resetDatabase();

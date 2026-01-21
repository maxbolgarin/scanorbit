/**
 * GDPR Data Retention Cleanup Job
 *
 * This job runs daily to clean up data according to retention policies:
 * - Delete stale resources (>90 days since last seen)
 * - Delete resolved findings (>180 days)
 * - Delete old scan records (>365 days)
 * - Archive old audit logs (>730 days / 2 years)
 * - Process pending user deletion requests
 *
 * Run manually: npx tsx src/jobs/retention-cleanup.ts
 * Run via cron: 0 3 * * * cd /app && node dist/jobs/retention-cleanup.js
 */

import { runRetentionCleanup, getRetentionStats } from '../services/retentionService.js';
import { db } from '../lib/db.js';
import { auditLogs } from '../db/schema.js';

async function main() {
  console.log('='.repeat(60));
  console.log('GDPR Data Retention Cleanup Job');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    // Get stats before cleanup
    console.log('\n[Stats] Before cleanup:');
    const beforeStats = await getRetentionStats();
    console.log(JSON.stringify(beforeStats, null, 2));

    // Run cleanup
    console.log('\n[Cleanup] Running retention cleanup...');
    const result = await runRetentionCleanup();

    // Log results
    console.log('\n[Results] Cleanup completed:');
    console.log(JSON.stringify(result, null, 2));

    // Log to audit table
    await db.insert(auditLogs).values({
      action: 'retention_cleanup',
    });

    // Get stats after cleanup
    console.log('\n[Stats] After cleanup:');
    const afterStats = await getRetentionStats();
    console.log(JSON.stringify(afterStats, null, 2));

    if (result.errors.length > 0) {
      console.error('\n[Errors] Some errors occurred:');
      result.errors.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Job completed successfully');
    console.log(`Finished at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (err) {
    console.error('\n[Fatal] Job failed with error:', err);
    process.exit(1);
  }
}

main();

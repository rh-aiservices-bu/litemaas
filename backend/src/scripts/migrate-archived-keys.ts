#!/usr/bin/env ts-node

/**
 * Migration script to add archived_at column and backfill orphaned API keys.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx src/scripts/migrate-archived-keys.ts
 */

import { createApp } from '../app';

async function main() {
  console.log('🔧 Starting archived_at migration...\n');

  const app = await createApp();

  try {
    // Step 1: Add column if missing
    console.log('1️⃣  Adding archived_at column (if not exists)...');
    await app.dbUtils.query(`
      ALTER TABLE api_keys
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE
    `);
    await app.dbUtils.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_archived_at ON api_keys(archived_at)
    `);
    console.log('   ✅ Column and index ensured.\n');

    // Step 2: Count orphaned keys before backfill
    const before = await app.dbUtils.queryOne<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM api_keys
      WHERE is_active = false
        AND archived_at IS NULL
        AND id NOT IN (SELECT DISTINCT api_key_id FROM api_key_models)
    `);
    const orphanCount = parseInt(before?.count || '0', 10);
    console.log(`2️⃣  Found ${orphanCount} orphaned key(s) to backfill.\n`);

    if (orphanCount > 0) {
      // Step 3: Backfill archived_at using best available timestamp
      const result = await app.dbUtils.query(`
        UPDATE api_keys
        SET archived_at = COALESCE(revoked_at, updated_at, CURRENT_TIMESTAMP)
        WHERE is_active = false
          AND archived_at IS NULL
          AND id NOT IN (SELECT DISTINCT api_key_id FROM api_key_models)
      `);
      console.log(`3️⃣  Backfilled ${result.rowCount} key(s) with archived_at.\n`);
    } else {
      console.log('3️⃣  No backfill needed.\n');
    }

    // Step 4: Summary
    const summary = await app.dbUtils.queryOne<{ total: string; archived: string }>(`
      SELECT
        COUNT(*) as total,
        COUNT(archived_at) as archived
      FROM api_keys
    `);
    console.log(`📊 Summary: ${summary?.archived || 0} archived out of ${summary?.total || 0} total keys.`);
    console.log('\n✅ Migration complete.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();

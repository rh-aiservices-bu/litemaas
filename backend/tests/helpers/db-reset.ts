/**
 * Database reset helper for integration tests
 *
 * Provides utilities to:
 * - Reset test database to clean state
 * - Truncate all tables while preserving schema
 * - Seed minimal required data
 */

import { Pool } from 'pg';

/**
 * Truncate all tables in test database
 * WARNING: Only works with litemaas_test database (safety check included)
 */
export async function truncateAllTables(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Safety check
    const result = await client.query('SELECT current_database()');
    const dbName = result.rows[0].current_database;

    if (dbName !== 'litemaas_test') {
      throw new Error(
        `🚨 SAFETY VIOLATION: Attempted to truncate tables in ${dbName}! ` +
          'This operation is ONLY allowed on litemaas_test database.',
      );
    }

    // Get all table names (excluding system tables)
    const tables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
    `);

    if (tables.rows.length === 0) {
      console.warn('⚠️  No tables found to truncate');
      return;
    }

    // Truncate all tables with CASCADE to handle foreign keys
    const tableNames = tables.rows.map((row) => row.tablename).join(', ');
    await client.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);

    console.log(`✅ Truncated ${tables.rows.length} tables in test database`);
  } finally {
    client.release();
  }
}

/**
 * Seed minimal required data for tests
 * This includes the default team and any other required base data
 */
export async function seedMinimalData(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Insert default team (UUID from backend code)
    await client.query(`
      INSERT INTO teams (id, name, description, created_at, updated_at)
      VALUES (
        'a0000000-0000-4000-8000-000000000001',
        'Default Team',
        'Auto-assigned to all users',
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('✅ Seeded minimal required data');
  } finally {
    client.release();
  }
}

/**
 * Complete database reset: truncate all tables and reseed
 */
export async function resetDatabase(pool: Pool): Promise<void> {
  console.log('🔄 Resetting test database...');
  await truncateAllTables(pool);
  await seedMinimalData(pool);
  console.log('✅ Test database reset complete');
}

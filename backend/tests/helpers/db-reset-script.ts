/**
 * CLI script to reset test database
 * Usage: npm run test:db:reset
 */

import { Pool } from 'pg';
import { resetDatabase } from './db-reset.js';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://pgadmin:thisisadmin@localhost:5432/litemaas_test',
});

async function main() {
  try {
    await resetDatabase(pool);
    console.log('✅ Test database reset successful');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test database reset failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

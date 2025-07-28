#!/usr/bin/env ts-node

/**
 * Manual script to run database migrations
 * Usage: npm run db:migrate or ts-node src/scripts/run-migrations.ts
 */

import { createApp } from '../app';

async function runMigrations() {
  console.log('🚀 Starting manual database migration...');

  try {
    // Create the app to initialize all plugins including database
    const app = await createApp({ logger: true });

    // Wait for the app to be ready (this will trigger migrations)
    await app.ready();

    console.log('✅ Migration process completed successfully!');

    // Close the app
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };

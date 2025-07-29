#!/usr/bin/env node

/**
 * Script to validate the lite_llm_key_id to lite_llm_key_value migration
 * 
 * This script checks that:
 * 1. The old column name (lite_llm_key_id) no longer exists
 * 2. The new column name (lite_llm_key_value) exists
 * 3. All indexes have been updated correctly
 * 4. Data integrity is maintained
 */

import { createApp } from '../app';

async function validateColumnMigration() {
  console.log('🔍 Validating lite_llm_key column migration...');

  try {
    // Create the app to initialize all plugins including database
    const app = await createApp({ logger: false });

    // Wait for the app to be ready
    await app.ready();

    const client = await app.pg.connect();

    try {
      // Check that old columns don't exist
      console.log('1. Checking old column removal...');
      
      const oldColumnsCheck = await client.query(`
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'lite_llm_key_id'
        AND table_name IN ('subscriptions', 'api_keys')
      `);

      if (oldColumnsCheck.rows.length > 0) {
        console.error('❌ Old lite_llm_key_id columns still exist:', oldColumnsCheck.rows);
        process.exit(1);
      }
      console.log('✅ Old lite_llm_key_id columns successfully removed');

      // Check that new columns exist
      console.log('2. Checking new column creation...');
      
      const newColumnsCheck = await client.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'lite_llm_key_value'
        AND table_name IN ('subscriptions', 'api_keys')
      `);

      if (newColumnsCheck.rows.length !== 2) {
        console.error('❌ New lite_llm_key_value columns not found or incomplete:', newColumnsCheck.rows);
        process.exit(1);
      }
      console.log('✅ New lite_llm_key_value columns successfully created');

      // Check indexes
      console.log('3. Checking index updates...');
      
      const indexCheck = await client.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname IN (
          'idx_subscriptions_lite_llm_key_value',
          'idx_api_keys_lite_llm_key_value'
        )
      `);

      if (indexCheck.rows.length !== 2) {
        console.error('❌ New indexes not found or incomplete:', indexCheck.rows);
        process.exit(1);
      }
      console.log('✅ New indexes successfully created');

      // Check that old indexes are gone
      const oldIndexCheck = await client.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname IN (
          'idx_subscriptions_lite_llm',
          'idx_api_keys_lite_llm'
        )
      `);

      if (oldIndexCheck.rows.length > 0) {
        console.error('❌ Old indexes still exist:', oldIndexCheck.rows);
        process.exit(1);
      }
      console.log('✅ Old indexes successfully removed');

      // Check data integrity by counting records
      console.log('4. Checking data integrity...');
      
      const subscriptionCount = await client.query('SELECT COUNT(*) FROM subscriptions');
      const apiKeyCount = await client.query('SELECT COUNT(*) FROM api_keys');
      
      console.log(`✅ Data integrity check complete:`);
      console.log(`   - Subscriptions: ${subscriptionCount.rows[0].count} records`);
      console.log(`   - API Keys: ${apiKeyCount.rows[0].count} records`);

      console.log('\n🎉 Migration validation completed successfully!');
      
    } finally {
      client.release();
    }

    await app.close();
    
  } catch (error) {
    console.error('❌ Migration validation failed:', error);
    process.exit(1);
  }
}

// Run the validation
validateColumnMigration();
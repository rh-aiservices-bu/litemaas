#!/usr/bin/env ts-node

/**
 * Subscription Migration Validation Script
 * 
 * Validates that the subscription self-service migration was successful.
 * Can be run independently to check migration status.
 * 
 * Usage: 
 *   npm run validate:migration
 *   or tsx src/scripts/validate-migration.ts
 */

import { createApp } from '../app';
import { validateSubscriptionMigration } from './migrate-subscriptions';

async function runValidation() {
  console.log('🔍 Starting subscription migration validation...');
  
  try {
    // Create the app to initialize all plugins including database
    const app = await createApp({ logger: false }); // Disable detailed logging for validation
    
    // Wait for the app to be ready
    await app.ready();
    
    if (app.isDatabaseMockMode()) {
      console.log('⚠️ Running in mock mode - validation simulation only');
    }
    
    // Run validation
    const validation = await validateSubscriptionMigration(app);
    
    console.log('\n📊 Validation Results:');
    console.log('==================');
    
    for (const [checkName, result] of Object.entries(validation.checks)) {
      const status = result.passed ? '✅' : '❌';
      const details = result.details ? ` (${result.details})` : '';
      console.log(`${status} ${checkName}${details}`);
    }
    
    console.log('==================');
    
    if (validation.isValid) {
      console.log('🎉 All validation checks passed! Migration is successful.');
    } else {
      console.log('⚠️ Some validation checks failed. Please review the results.');
      
      // Provide recommendations
      console.log('\n💡 Recommendations:');
      if (!validation.checks.noPendingSubscriptions?.passed) {
        console.log('- Run the migration script to convert pending subscriptions');
      }
      if (!validation.checks.noDuplicateSubscriptions?.passed) {
        console.log('- Run the migration script to remove duplicate subscriptions');
      }
      if (!validation.checks.uniqueConstraintExists?.passed) {
        console.log('- Add the unique constraint manually or run the migration script');
      }
      if (!validation.checks.defaultStatusActive?.passed) {
        console.log('- Update the default status to "active" manually');
      }
      if (!validation.checks.statusConstraintUpdated?.passed) {
        console.log('- Update the status constraint to exclude "pending"');
      }
    }
    
    // Additional statistics
    console.log('\n📈 Current Statistics:');
    
    // Get subscription counts by status
    const statusCounts = await app.dbUtils.query(`
      SELECT status, COUNT(*) as count 
      FROM subscriptions 
      GROUP BY status 
      ORDER BY count DESC
    `);
    
    if (statusCounts.rows.length > 0) {
      console.log('Subscriptions by status:');
      for (const row of statusCounts.rows) {
        console.log(`  ${row.status}: ${row.count}`);
      }
    } else {
      console.log('No subscriptions found in the database');
    }
    
    // Get total subscription count
    const totalResult = await app.dbUtils.query(`
      SELECT COUNT(*) as total FROM subscriptions
    `);
    const total = totalResult.rows[0]?.total || 0;
    console.log(`Total subscriptions: ${total}`);
    
    // Close the app
    await app.close();
    
    process.exit(validation.isValid ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runValidation();
}

export { runValidation };
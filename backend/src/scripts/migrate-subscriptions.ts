#!/usr/bin/env ts-node

/**
 * Subscription Self-Service Migration Script
 *
 * This script migrates the subscription system from approval-based to self-service:
 * 1. Converts all pending subscriptions to active
 * 2. Removes duplicate subscriptions (keeps most recent)
 * 3. Adds unique constraint to prevent future duplicates
 * 4. Updates default status and constraints
 *
 * Note: This migration was executed as part of the subscription refactor.
 * This script serves as documentation and can be used for future reference.
 *
 * Usage:
 *   npm run migrate:subscriptions
 *   or ts-node src/scripts/migrate-subscriptions.ts
 */

import { createApp } from '../app';
import { FastifyInstance } from 'fastify';

interface MigrationResult {
  pendingConverted: number;
  duplicatesRemoved: number;
  constraintAdded: boolean;
  defaultStatusUpdated: boolean;
  indexesCreated: boolean;
  success: boolean;
  error?: string;
}

export async function migrateSubscriptionsToSelfService(
  fastify: FastifyInstance,
): Promise<MigrationResult> {
  const startTime = Date.now();
  fastify.log.info('🚀 Starting subscription migration to self-service model');

  let pendingConverted = 0;
  let duplicatesRemoved = 0;
  let constraintAdded = false;
  let defaultStatusUpdated = false;
  let indexesCreated = false;

  try {
    // Step 1: Convert all pending subscriptions to active
    fastify.log.info('📝 Step 1: Converting pending subscriptions to active...');
    const pendingResult = await fastify.dbUtils.query(`
      UPDATE subscriptions 
      SET status = 'active', updated_at = CURRENT_TIMESTAMP 
      WHERE status = 'pending'
      RETURNING id
    `);

    pendingConverted = pendingResult.rowCount || 0;
    fastify.log.info(`✅ Converted ${pendingConverted} pending subscriptions to active`);

    // Step 2: Identify and remove duplicate subscriptions (keep most recent)
    fastify.log.info('🔍 Step 2: Identifying and removing duplicate subscriptions...');

    // First, get a count of duplicates for logging
    const duplicateCountResult = await fastify.dbUtils.query(`
      WITH duplicates AS (
        SELECT user_id, model_id, COUNT(*) as count
        FROM subscriptions
        GROUP BY user_id, model_id
        HAVING COUNT(*) > 1
      )
      SELECT SUM(count - 1) as total_duplicates FROM duplicates
    `);

    const expectedDuplicates = duplicateCountResult.rows[0]?.total_duplicates || 0;
    fastify.log.info(`📊 Found ${expectedDuplicates} duplicate subscriptions to remove`);

    // Remove duplicates (keep most recent per user-model pair)
    const duplicateRemovalResult = await fastify.dbUtils.query(`
      WITH duplicates AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY user_id, model_id 
          ORDER BY created_at DESC
        ) as rn
        FROM subscriptions
      )
      DELETE FROM subscriptions 
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
      RETURNING id
    `);

    duplicatesRemoved = duplicateRemovalResult.rowCount || 0;
    fastify.log.info(`🗑️ Removed ${duplicatesRemoved} duplicate subscriptions`);

    // Step 3: Add unique constraint to prevent future duplicates
    fastify.log.info('🔒 Step 3: Adding unique constraint for user-model subscriptions...');
    try {
      await fastify.dbUtils.query(`
        ALTER TABLE subscriptions 
        ADD CONSTRAINT unique_user_model_subscription 
        UNIQUE (user_id, model_id)
      `);
      constraintAdded = true;
      fastify.log.info('✅ Added unique constraint for user-model subscriptions');
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message?.includes('already exists')) {
        fastify.log.info('ℹ️ Unique constraint already exists, skipping...');
        constraintAdded = true;
      } else {
        throw error;
      }
    }

    // Step 4: Update default status from 'pending' to 'active'
    fastify.log.info('⚙️ Step 4: Updating default subscription status...');
    await fastify.dbUtils.query(`
      ALTER TABLE subscriptions 
      ALTER COLUMN status SET DEFAULT 'active'
    `);
    defaultStatusUpdated = true;
    fastify.log.info('✅ Updated default subscription status to active');

    // Step 5: Update status check constraint (remove pending)
    fastify.log.info('📋 Step 5: Updating status constraints...');
    try {
      // Drop existing constraint if it exists
      await fastify.dbUtils.query(`
        ALTER TABLE subscriptions 
        DROP CONSTRAINT IF EXISTS subscriptions_status_check
      `);

      // Add new constraint without 'pending'
      await fastify.dbUtils.query(`
        ALTER TABLE subscriptions 
        ADD CONSTRAINT subscriptions_status_check 
        CHECK (status IN ('active', 'suspended', 'cancelled', 'expired'))
      `);
      fastify.log.info('✅ Updated status check constraint (removed pending)');
    } catch (error: unknown) {
      const err = error as Error;
      fastify.log.warn(err, 'Failed to update status constraint, continuing...');
    }

    // Step 6: Create performance indexes
    fastify.log.info('📈 Step 6: Creating performance indexes...');
    try {
      await fastify.dbUtils.query(`
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_model_unique 
        ON subscriptions(user_id, model_id)
      `);

      await fastify.dbUtils.query(`
        CREATE INDEX IF NOT EXISTS idx_subscriptions_active_status 
        ON subscriptions(status) WHERE status = 'active'
      `);

      indexesCreated = true;
      fastify.log.info('✅ Created performance indexes');
    } catch (error: unknown) {
      const err = error as Error;
      fastify.log.warn(err, 'Failed to create some indexes, continuing...');
      indexesCreated = false;
    }

    // Step 7: Verification queries
    fastify.log.info('🔍 Step 7: Verifying migration results...');

    // Check no pending subscriptions remain
    const remainingPendingResult = await fastify.dbUtils.query<{ count: string }>(`
      SELECT COUNT(*) as count FROM subscriptions WHERE status = 'pending'
    `);
    const remainingPending = parseInt(remainingPendingResult.rows[0]?.count || '0');

    // Check for any remaining duplicates
    const remainingDuplicatesResult = await fastify.dbUtils.query(`
      SELECT user_id, model_id, COUNT(*) as count
      FROM subscriptions 
      GROUP BY user_id, model_id 
      HAVING COUNT(*) > 1
    `);
    const remainingDuplicates = remainingDuplicatesResult.rows.length;

    // Log verification results
    if (remainingPending > 0) {
      fastify.log.warn(`⚠️ Warning: ${remainingPending} pending subscriptions still exist`);
    } else {
      fastify.log.info('✅ Verification: No pending subscriptions remain');
    }

    if (remainingDuplicates > 0) {
      fastify.log.warn(
        `⚠️ Warning: ${remainingDuplicates} duplicate subscription pairs still exist`,
      );
    } else {
      fastify.log.info('✅ Verification: No duplicate subscriptions remain');
    }

    const duration = Date.now() - startTime;
    fastify.log.info(`🎉 Subscription migration completed successfully in ${duration}ms`);

    return {
      pendingConverted,
      duplicatesRemoved,
      constraintAdded,
      defaultStatusUpdated,
      indexesCreated,
      success: true,
    };
  } catch (error: unknown) {
    const err = error as Error;
    const duration = Date.now() - startTime;
    fastify.log.error(err, `❌ Subscription migration failed after ${duration}ms`);

    return {
      pendingConverted,
      duplicatesRemoved,
      constraintAdded,
      defaultStatusUpdated,
      indexesCreated,
      success: false,
      error: err.message,
    };
  }
}

/**
 * Rollback function to revert the migration changes
 * Use with extreme caution - this will restore the approval-based workflow
 */
export async function rollbackSubscriptionMigration(
  fastify: FastifyInstance,
): Promise<MigrationResult> {
  fastify.log.warn('🚨 Starting subscription migration rollback - USE WITH CAUTION');

  try {
    // Step 1: Remove unique constraint
    fastify.log.info('🔓 Removing unique constraint...');
    await fastify.dbUtils.query(`
      ALTER TABLE subscriptions 
      DROP CONSTRAINT IF EXISTS unique_user_model_subscription
    `);

    // Step 2: Restore original status constraint (add pending back)
    fastify.log.info('📋 Restoring original status constraint...');
    await fastify.dbUtils.query(`
      ALTER TABLE subscriptions 
      DROP CONSTRAINT IF EXISTS subscriptions_status_check
    `);

    await fastify.dbUtils.query(`
      ALTER TABLE subscriptions 
      ADD CONSTRAINT subscriptions_status_check 
      CHECK (status IN ('pending', 'active', 'suspended', 'cancelled', 'expired'))
    `);

    // Step 3: Restore default status to 'pending'
    fastify.log.info('⚙️ Restoring default status to pending...');
    await fastify.dbUtils.query(`
      ALTER TABLE subscriptions 
      ALTER COLUMN status SET DEFAULT 'pending'
    `);

    // Step 4: Remove migration-specific indexes
    fastify.log.info('🗑️ Removing migration indexes...');
    await fastify.dbUtils.query(`
      DROP INDEX IF EXISTS idx_subscriptions_user_model_unique
    `);

    await fastify.dbUtils.query(`
      DROP INDEX IF EXISTS idx_subscriptions_active_status
    `);

    fastify.log.warn('✅ Subscription migration rollback completed');

    return {
      pendingConverted: 0,
      duplicatesRemoved: 0,
      constraintAdded: false,
      defaultStatusUpdated: true,
      indexesCreated: false,
      success: true,
    };
  } catch (error: unknown) {
    const err = error as Error;
    fastify.log.error(err, '❌ Subscription migration rollback failed');
    throw err;
  }
}

/**
 * Data integrity validation function
 * Checks the current state of subscriptions after migration
 */
export async function validateSubscriptionMigration(fastify: FastifyInstance): Promise<{
  isValid: boolean;
  checks: Record<string, { passed: boolean; details?: string }>;
}> {
  fastify.log.info('🔍 Validating subscription migration state...');

  const checks: Record<string, { passed: boolean; details?: string }> = {};

  try {
    // Check 1: No pending subscriptions
    const pendingResult = await fastify.dbUtils.query<{ count: string }>(`
      SELECT COUNT(*) as count FROM subscriptions WHERE status = 'pending'
    `);
    const pendingCount = parseInt(pendingResult.rows[0]?.count || '0');
    checks.noPendingSubscriptions = {
      passed: pendingCount === 0,
      details: pendingCount > 0 ? `Found ${pendingCount} pending subscriptions` : undefined,
    };

    // Check 2: No duplicate subscriptions
    const duplicateResult = await fastify.dbUtils.query(`
      SELECT user_id, model_id, COUNT(*) as count
      FROM subscriptions 
      GROUP BY user_id, model_id 
      HAVING COUNT(*) > 1
    `);
    checks.noDuplicateSubscriptions = {
      passed: duplicateResult.rows.length === 0,
      details:
        duplicateResult.rows.length > 0
          ? `Found ${duplicateResult.rows.length} duplicate pairs`
          : undefined,
    };

    // Check 3: Unique constraint exists
    const constraintResult = await fastify.dbUtils.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'subscriptions' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name = 'unique_user_model_subscription'
    `);
    checks.uniqueConstraintExists = {
      passed: constraintResult.rows.length > 0,
    };

    // Check 4: Default status is 'active'
    const defaultResult = await fastify.dbUtils.query<{ column_default: string }>(`
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions' 
      AND column_name = 'status'
    `);
    const defaultValue = defaultResult.rows[0]?.column_default || '';
    checks.defaultStatusActive = {
      passed: defaultValue.includes('active'),
      details: `Current default: ${defaultValue}`,
    };

    // Check 5: Status constraint doesn't include 'pending'
    const checkConstraintResult = await fastify.dbUtils.query<{ check_clause: string }>(`
      SELECT check_clause 
      FROM information_schema.check_constraints cc
      JOIN information_schema.constraint_column_usage ccu 
      ON cc.constraint_name = ccu.constraint_name
      WHERE ccu.table_name = 'subscriptions' 
      AND ccu.column_name = 'status'
    `);
    const checkClause = checkConstraintResult.rows[0]?.check_clause || '';
    checks.statusConstraintUpdated = {
      passed: !checkClause.includes('pending'),
      details: `Current constraint: ${checkClause}`,
    };

    const allPassed = Object.values(checks).every((check) => check.passed);

    fastify.log.info(
      {
        isValid: allPassed,
        checks,
      },
      'Subscription migration validation completed',
    );

    return {
      isValid: allPassed,
      checks,
    };
  } catch (error: unknown) {
    const err = error as Error;
    fastify.log.error(err, 'Failed to validate subscription migration');
    return {
      isValid: false,
      checks: {
        validationError: {
          passed: false,
          details: err.message,
        },
      },
    };
  }
}

/**
 * Main function to run the migration script
 */
async function runSubscriptionMigration() {
  console.log('🚀 Starting subscription migration script...');

  try {
    // Create the app to initialize all plugins including database
    const app = await createApp({ logger: true });

    // Wait for the app to be ready
    await app.ready();

    if (app.isDatabaseMockMode()) {
      console.log('⚠️ Running in mock mode - migration simulation only');
    }

    // Run the migration
    const result = await migrateSubscriptionsToSelfService(app);

    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log(
        `📊 Results: ${result.pendingConverted} pending converted, ${result.duplicatesRemoved} duplicates removed`,
      );

      // Run validation
      const validation = await validateSubscriptionMigration(app);
      if (validation.isValid) {
        console.log('✅ Migration validation passed');
      } else {
        console.log('⚠️ Migration validation failed:', validation.checks);
      }
    } else {
      console.error('❌ Migration failed:', result.error);
      process.exit(1);
    }

    // Close the app
    await app.close();
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Migration script failed:', err);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runSubscriptionMigration();
}

export { runSubscriptionMigration };

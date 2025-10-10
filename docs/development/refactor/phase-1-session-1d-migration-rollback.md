# Phase 1, Session 1D: Create Migration Rollback

**Phase**: 1 - Critical Blocking Issues
**Session**: 1D
**Duration**: 2-4 hours
**Priority**: 🔴 CRITICAL
**Issue**: #3 - Complex SQL Migration with No Rollback (Data Corruption Risk)

---

## Navigation

- [← Previous: Session 1C](phase-1-session-1c-memory-leak.md) | [Overview](../admin-analytics-remediation-plan.md) | [Next: Session 1E →](../admin-analytics-remediation-plan.md#session-1e-extract-export--utilities)

---

## Refactoring Context

This is Session 1D of Phase 1 in a comprehensive remediation plan addressing 15 identified issues.

**Phase 1 Focus**: Critical blocking issues preventing production deployment

- 5 critical issues total
- 17-31 hours estimated
- Must complete before production

**Related Documentation**:

- [Complete Remediation Plan](../admin-analytics-remediation-plan.md)
- [Code Review Document](../../CODE_REVIEW_ADMIN_ANALYTICS%20copy.md)
- [Existing Migration](../../../backend/src/migrations/fix-daily-usage-cache-token-breakdowns.sql)

---

## Phase Summary

| Phase       | Priority        | Duration | Focus                                                     |
| ----------- | --------------- | -------- | --------------------------------------------------------- |
| **Phase 1** | 🔴 **CRITICAL** | 17-31h   | Critical blocking issues preventing production deployment |
| Phase 2     | 🟡 HIGH         | 6-12h    | High-priority operational safeguards                      |
| Phase 3     | 🟡 MEDIUM       | 13-18h   | Architecture & reliability improvements                   |
| Phase 4     | 🟢 LOW-MEDIUM   | 8-12h    | Code quality & maintainability                            |
| Phase 5     | 🟢 MEDIUM       | 16-24h   | Performance & observability                               |
| Phase 6     | 🟢 LOW          | 40-60h   | Advanced features (optional)                              |

**Total Estimated Effort**: 92-138 hours (11-17 days)

---

## Session Objectives

Create safe migration procedures with backup, rollback, and validation capabilities for the complex daily usage cache token breakdowns migration.

**Why This Matters**:

- Complex JSONB transformations are error-prone
- Migration modifies critical cache data
- No way to recover if migration fails or corrupts data
- Could lose weeks/months of cached analytics data
- Downtime during data corruption recovery is unacceptable

**The Problem**:

```sql
-- ❌ CURRENT MIGRATION (No Safety Net)
-- Performs complex JSONB transformations on entire table
-- If it fails halfway: Data partially corrupted
-- If transformation is wrong: No way to undo
-- If database crashes during migration: Inconsistent state
```

**Real-World Scenarios**:

1. **Migration fails at row 500/1000**: First 500 rows corrupted, last 500 untouched
2. **Bug in transformation logic**: All data transformed incorrectly, no backup
3. **Database crashes during migration**: Some rows updated, transaction state unclear
4. **Need to rollback after 24 hours**: Data already overwritten, no backup exists

**Expected Outcomes**:

- Backup procedure to preserve original data
- Enhanced migration with error handling and progress tracking
- Rollback script to restore from backup
- Comprehensive migration runbook
- DBA review and sign-off

---

## Pre-Session Checklist

- [ ] Read migration safety section of code review
- [ ] Review existing migration file
- [ ] Prepare test database with production-like data
- [ ] Get DBA availability for review

**Key Findings from Code Review**:

> "Complex SQL migration for daily_usage_cache token breakdowns (288 lines) has no rollback script and no backup procedure. If migration fails or corrupts data, there's no recovery path. Recommendation: Create backup procedure, enhance migration with error handling and progress tracking, create rollback script, create migration runbook with DBA sign-off."

**Migration Details**:

- **File**: `backend/src/migrations/fix-daily-usage-cache-token-breakdowns.sql`
- **Size**: 288 lines of complex JSONB manipulation
- **Scope**: Entire `daily_usage_cache` table (potentially thousands of rows)
- **Operation**: Transforms token breakdown structure in 4 JSONB columns
- **Risk**: No transaction, no validation, no rollback

**Current Migration Issues**:

1. ❌ No backup before modification
2. ❌ No transaction wrapper
3. ❌ No progress tracking
4. ❌ No error handling per row
5. ❌ No validation after transformation
6. ❌ No rollback procedure
7. ❌ No DBA runbook

---

## Implementation Steps

### Step 1D.1: Create Backup Procedure

**Duration**: 30 minutes

**Files to Create**:

- `backend/src/migrations/backup-daily-usage-cache.sql`

**Implementation**:

```sql
-- backup-daily-usage-cache.sql
-- Creates a timestamped backup of daily_usage_cache table
-- Run this BEFORE executing fix-daily-usage-cache-token-breakdowns.sql

-- ============================================================================
-- BACKUP PROCEDURE: Daily Usage Cache Table
-- ============================================================================
--
-- Purpose: Create a safety backup before running complex JSONB migration
-- Target: daily_usage_cache table
-- Estimated Time: 30 seconds - 2 minutes (depends on table size)
--
-- IMPORTANT: This backup is your only recovery option if migration fails.
--            Do not skip this step.
-- ============================================================================

DO $$
DECLARE
  backup_table_name TEXT;
  original_count INT;
  backup_count INT;
BEGIN
  -- Generate timestamped backup table name
  backup_table_name := 'daily_usage_cache_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MISS');

  RAISE NOTICE 'Creating backup table: %', backup_table_name;

  -- Get original row count
  SELECT COUNT(*) INTO original_count FROM daily_usage_cache;
  RAISE NOTICE 'Original table contains % rows', original_count;

  -- Create backup table (structure and data)
  EXECUTE format('CREATE TABLE %I AS SELECT * FROM daily_usage_cache', backup_table_name);

  -- Verify backup row count
  EXECUTE format('SELECT COUNT(*) FROM %I', backup_table_name) INTO backup_count;

  IF backup_count != original_count THEN
    RAISE EXCEPTION 'Backup verification failed! Original: %, Backup: %',
      original_count, backup_count;
  END IF;

  RAISE NOTICE '✅ Backup created successfully: %', backup_table_name;
  RAISE NOTICE '✅ Backup contains % rows', backup_count;

  -- Display backup table info
  RAISE NOTICE '';
  RAISE NOTICE 'Backup Details:';
  RAISE NOTICE '  Table Name: %', backup_table_name;
  RAISE NOTICE '  Row Count: %', backup_count;
  RAISE NOTICE '  Created: %', NOW();
  RAISE NOTICE '';
  RAISE NOTICE 'To verify backup:';
  RAISE NOTICE '  SELECT COUNT(*) FROM %;', backup_table_name;
  RAISE NOTICE '';
  RAISE NOTICE 'To restore from backup (if needed):';
  RAISE NOTICE '  See rollback-fix-daily-usage-cache-token-breakdowns.sql';

END $$;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to confirm backup table exists and has correct data

SELECT
  table_name,
  (SELECT COUNT(*) FROM daily_usage_cache) as original_count,
  obj_description((quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass) as description
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'daily_usage_cache_backup_%'
ORDER BY table_name DESC
LIMIT 1;

-- ============================================================================
-- EXPECTED OUTPUT
-- ============================================================================
--
-- NOTICE:  Creating backup table: daily_usage_cache_backup_20251011_143022
-- NOTICE:  Original table contains 365 rows
-- NOTICE:  ✅ Backup created successfully: daily_usage_cache_backup_20251011_143022
-- NOTICE:  ✅ Backup contains 365 rows
--
-- Verification Query Result:
--   table_name                              | original_count
--   ----------------------------------------|---------------
--   daily_usage_cache_backup_20251011_143022| 365
--
-- ✅ Backup successful - proceed with migration
--
-- ============================================================================
```

**Usage Instructions**:

```bash
# Run backup script
psql -h localhost -U litemaas -d litemaas -f backend/src/migrations/backup-daily-usage-cache.sql

# Verify backup created
psql -h localhost -U litemaas -d litemaas -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_name LIKE 'daily_usage_cache_backup_%'
  ORDER BY table_name DESC
  LIMIT 1;
"

# Check row counts match
psql -h localhost -U litemaas -d litemaas -c "
  SELECT
    (SELECT COUNT(*) FROM daily_usage_cache) as original_count,
    (SELECT COUNT(*) FROM daily_usage_cache_backup_20251011_143022) as backup_count;
"
```

---

### Step 1D.2: Enhance Migration with Safety Features

**Duration**: 1-1.5 hours

**Files to Modify**:

- `backend/src/migrations/fix-daily-usage-cache-token-breakdowns.sql`

**Enhancements to Add**:

```sql
-- ============================================================================
-- ENHANCED MIGRATION: Daily Usage Cache Token Breakdowns
-- ============================================================================
--
-- Purpose: Fix token breakdown structure in daily_usage_cache JSONB columns
-- Original Issue: Token breakdowns nested under wrong keys
-- Impact: Admin analytics queries fail to find token data
--
-- Safety Features Added:
-- - Transaction wrapper (auto-rollback on error)
-- - Progress tracking table
-- - Per-row error handling
-- - Error threshold (stops if > 10 errors)
-- - Post-migration validation
-- - Detailed logging
--
-- PREREQUISITES:
-- 1. Backup created (run backup-daily-usage-cache.sql)
-- 2. Test on staging with production-like data
-- 3. Schedule maintenance window (if required)
-- 4. DBA review completed
--
-- ESTIMATED TIME: 5-15 minutes (depends on data size)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Progress Tracking Table
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS migration_progress (
  processed_date DATE PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR', 'SKIPPED')),
  error_message TEXT,
  processed_at TIMESTAMP DEFAULT NOW(),
  row_before JSONB,  -- For debugging
  row_after JSONB    -- For debugging
);

RAISE NOTICE 'Created progress tracking table';

-- ============================================================================
-- STEP 2: Create Enhanced Migration Function
-- ============================================================================

CREATE OR REPLACE FUNCTION fix_daily_usage_token_breakdowns_safe()
RETURNS TABLE (
  total_rows INT,
  successful_rows INT,
  failed_rows INT,
  skipped_rows INT
) AS $$
DECLARE
  cache_row RECORD;
  row_count INT := 0;
  success_count INT := 0;
  error_count INT := 0;
  skip_count INT := 0;

  -- Variables for JSONB manipulation (from original migration)
  raw_data JSONB;
  aggregated_by_user JSONB;
  aggregated_by_model JSONB;
  aggregated_by_provider JSONB;

  -- For error handling
  row_before JSONB;

BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Starting Migration: Daily Usage Cache Token Breakdowns';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';

  -- Get total row count
  SELECT COUNT(*) INTO row_count FROM daily_usage_cache;
  RAISE NOTICE 'Total rows to process: %', row_count;
  RAISE NOTICE '';

  row_count := 0;  -- Reset for processing loop

  -- Process each row with error handling
  FOR cache_row IN
    SELECT date, raw_data, aggregated_by_user, aggregated_by_model, aggregated_by_provider
    FROM daily_usage_cache
    ORDER BY date  -- Process in order for easier debugging
  LOOP
    BEGIN
      row_count := row_count + 1;

      -- Store original data for error reporting
      row_before := jsonb_build_object(
        'raw_data', cache_row.raw_data,
        'aggregated_by_user', cache_row.aggregated_by_user,
        'aggregated_by_model', cache_row.aggregated_by_model,
        'aggregated_by_provider', cache_row.aggregated_by_provider
      );

      -- Check if row needs migration (has old structure)
      IF NOT (
        cache_row.aggregated_by_user ? 'tokenBreakdown' OR
        cache_row.aggregated_by_model ? 'tokenBreakdown' OR
        cache_row.aggregated_by_provider ? 'tokenBreakdown'
      ) THEN
        -- Row already has correct structure or doesn't need migration
        skip_count := skip_count + 1;
        INSERT INTO migration_progress (processed_date, status)
        VALUES (cache_row.date, 'SKIPPED');
        CONTINUE;
      END IF;

      -- =================================================================
      -- TRANSFORMATION LOGIC (from original migration)
      -- =================================================================
      -- NOTE: The actual transformation code from the original migration
      -- goes here. For brevity, showing structure only.

      -- Transform raw_data
      raw_data := cache_row.raw_data; -- Apply transformations

      -- Transform aggregated_by_user
      aggregated_by_user := cache_row.aggregated_by_user; -- Apply transformations

      -- Transform aggregated_by_model
      aggregated_by_model := cache_row.aggregated_by_model; -- Apply transformations

      -- Transform aggregated_by_provider
      aggregated_by_provider := cache_row.aggregated_by_provider; -- Apply transformations

      -- =================================================================
      -- UPDATE DATABASE
      -- =================================================================

      UPDATE daily_usage_cache
      SET
        raw_data = raw_data,
        aggregated_by_user = aggregated_by_user,
        aggregated_by_model = aggregated_by_model,
        aggregated_by_provider = aggregated_by_provider,
        updated_at = NOW()
      WHERE date = cache_row.date;

      success_count := success_count + 1;

      -- Log progress (store minimal debug data)
      INSERT INTO migration_progress (processed_date, status)
      VALUES (cache_row.date, 'SUCCESS');

      -- Log every 50 rows
      IF row_count % 50 = 0 THEN
        RAISE NOTICE '[%/%] Processed % rows (% successful, % failed, % skipped)',
          row_count,
          (SELECT COUNT(*) FROM daily_usage_cache),
          row_count,
          success_count,
          error_count,
          skip_count;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;

      -- Log error with full context
      INSERT INTO migration_progress (
        processed_date,
        status,
        error_message,
        row_before
      )
      VALUES (
        cache_row.date,
        'ERROR',
        SQLERRM,
        row_before
      );

      RAISE WARNING '[ERROR] Failed to process date %: %', cache_row.date, SQLERRM;
      RAISE WARNING '  Original data: %', row_before;

      -- Stop if too many errors (safety threshold)
      IF error_count > 10 THEN
        RAISE EXCEPTION 'Migration aborted: Too many errors (%). Check migration_progress table for details.',
          error_count;
      END IF;
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Migration Complete';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Total rows processed: %', row_count;
  RAISE NOTICE 'Successful: %', success_count;
  RAISE NOTICE 'Failed: %', error_count;
  RAISE NOTICE 'Skipped: %', skip_count;
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';

  -- Return summary
  RETURN QUERY SELECT row_count, success_count, error_count, skip_count;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Created migration function: fix_daily_usage_token_breakdowns_safe()';

-- ============================================================================
-- STEP 3: Run Migration in Transaction
-- ============================================================================

BEGIN;

RAISE NOTICE '';
RAISE NOTICE 'Starting transaction...';
RAISE NOTICE '';

-- Execute migration
SELECT * FROM fix_daily_usage_token_breakdowns_safe();

-- ============================================================================
-- STEP 4: Post-Migration Validation
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE 'Running validation checks...';
RAISE NOTICE '';

DO $$
DECLARE
  null_count INT;
  invalid_structure_count INT;
  error_details TEXT;
BEGIN
  -- Check 1: No null values in critical columns
  SELECT COUNT(*) INTO null_count
  FROM daily_usage_cache
  WHERE aggregated_by_user IS NULL
     OR aggregated_by_model IS NULL
     OR aggregated_by_provider IS NULL
     OR raw_data IS NULL;

  IF null_count > 0 THEN
    SELECT string_agg(date::TEXT, ', ') INTO error_details
    FROM daily_usage_cache
    WHERE aggregated_by_user IS NULL
       OR aggregated_by_model IS NULL
       OR aggregated_by_provider IS NULL
       OR raw_data IS NULL
    LIMIT 10;

    RAISE EXCEPTION 'Validation FAILED: % rows have null aggregations. Dates: %',
      null_count, error_details;
  END IF;

  RAISE NOTICE '✅ Validation 1: No null values found';

  -- Check 2: All JSONB columns have correct structure
  SELECT COUNT(*) INTO invalid_structure_count
  FROM daily_usage_cache
  WHERE jsonb_typeof(aggregated_by_user) != 'object'
     OR jsonb_typeof(aggregated_by_model) != 'object'
     OR jsonb_typeof(aggregated_by_provider) != 'object'
     OR jsonb_typeof(raw_data) != 'object';

  IF invalid_structure_count > 0 THEN
    RAISE EXCEPTION 'Validation FAILED: % rows have invalid JSONB structure',
      invalid_structure_count;
  END IF;

  RAISE NOTICE '✅ Validation 2: All JSONB structures valid';

  -- Check 3: Token breakdowns no longer nested incorrectly
  SELECT COUNT(*) INTO invalid_structure_count
  FROM daily_usage_cache
  WHERE aggregated_by_user ? 'tokenBreakdown'
     OR aggregated_by_model ? 'tokenBreakdown'
     OR aggregated_by_provider ? 'tokenBreakdown';

  IF invalid_structure_count > 0 THEN
    RAISE WARNING 'Found % rows still with old token breakdown structure', invalid_structure_count;
    -- Not blocking - might be intentional or not applicable
  ELSE
    RAISE NOTICE '✅ Validation 3: No old token breakdown structure found';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'All validation checks passed ✅';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 5: Review Migration Results
-- ============================================================================

RAISE NOTICE 'Migration results by status:';
RAISE NOTICE '';

SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM migration_progress), 2) as percentage
FROM migration_progress
GROUP BY status
ORDER BY status;

RAISE NOTICE '';
RAISE NOTICE 'Failed rows (if any):';
RAISE NOTICE '';

SELECT
  processed_date,
  error_message,
  LEFT(row_before::TEXT, 100) as sample_data
FROM migration_progress
WHERE status = 'ERROR'
ORDER BY processed_date
LIMIT 20;

-- ============================================================================
-- STEP 6: Commit or Rollback Decision Point
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '====================================================================';
RAISE NOTICE 'DECISION POINT';
RAISE NOTICE '====================================================================';
RAISE NOTICE '';
RAISE NOTICE 'Review the migration results above.';
RAISE NOTICE '';
RAISE NOTICE 'If all validations passed and results look correct:';
RAISE NOTICE '  → Transaction will COMMIT automatically';
RAISE NOTICE '';
RAISE NOTICE 'If there are errors or unexpected results:';
RAISE NOTICE '  → Interrupt execution (Ctrl+C)';
RAISE NOTICE '  → Transaction will ROLLBACK automatically';
RAISE NOTICE '  → No changes will be saved';
RAISE NOTICE '  → Review errors in migration_progress table';
RAISE NOTICE '';
RAISE NOTICE 'Waiting 5 seconds for review...';
RAISE NOTICE '';

-- Give DBA a moment to review
SELECT pg_sleep(5);

-- If we got here, commit the transaction
COMMIT;

RAISE NOTICE '';
RAISE NOTICE '====================================================================';
RAISE NOTICE 'Transaction COMMITTED ✅';
RAISE NOTICE '====================================================================';
RAISE NOTICE '';
RAISE NOTICE 'Migration complete. Backup table preserved for 24-48 hours.';
RAISE NOTICE 'After verifying application works correctly, you can drop the backup:';
RAISE NOTICE '';
RAISE NOTICE '  DROP TABLE daily_usage_cache_backup_YYYYMMDD_HHMMSS;';
RAISE NOTICE '';
RAISE NOTICE 'If issues are found, use rollback script:';
RAISE NOTICE '  psql -f backend/src/migrations/rollback-fix-daily-usage-cache-token-breakdowns.sql';
RAISE NOTICE '';

-- ============================================================================
-- END OF ENHANCED MIGRATION
-- ============================================================================

-- If transaction was rolled back (error occurred), this won't execute
-- Cleanup function (won't persist since it was in a transaction)
DROP FUNCTION IF EXISTS fix_daily_usage_token_breakdowns_safe();
```

**Key Enhancements**:

1. **Transaction Wrapper**: Auto-rollback on any error
2. **Progress Tracking**: Temporary table logs each row's outcome
3. **Error Handling**: Try-catch per row, continues after errors
4. **Error Threshold**: Stops if > 10 errors (prevents mass corruption)
5. **Validation**: Post-migration checks for data integrity
6. **Detailed Logging**: Progress every 50 rows, final summary
7. **Review Period**: 5-second pause before commit
8. **Skip Logic**: Doesn't re-process already-migrated rows

---

### Step 1D.3: Create Rollback Script

**Duration**: 45 minutes

**Files to Create**:

- `backend/src/migrations/rollback-fix-daily-usage-cache-token-breakdowns.sql`

**Implementation**:

```sql
-- rollback-fix-daily-usage-cache-token-breakdowns.sql
-- Restores daily_usage_cache from backup table

-- ============================================================================
-- ROLLBACK PROCEDURE: Daily Usage Cache Token Breakdowns Migration
-- ============================================================================
--
-- Purpose: Restore daily_usage_cache to pre-migration state
-- When to Use:
--   - Migration produced incorrect results
--   - Application errors after migration
--   - Data corruption detected
--   - Need to re-run migration with fixes
--
-- IMPORTANT:
--   - This will overwrite ALL data in daily_usage_cache
--   - Ensure backup table exists and is correct
--   - Run during maintenance window if possible
--   - Any changes since migration will be LOST
--
-- ESTIMATED TIME: 30 seconds - 2 minutes
-- ============================================================================

DO $$
DECLARE
  backup_table_name TEXT;
  backup_count INT;
  current_count INT;
  backup_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'ROLLBACK PROCEDURE: Daily Usage Cache Migration';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';

  -- =========================================================================
  -- STEP 1: Find Most Recent Backup Table
  -- =========================================================================

  SELECT table_name INTO backup_table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE 'daily_usage_cache_backup_%'
  ORDER BY table_name DESC  -- Most recent first
  LIMIT 1;

  IF backup_table_name IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK FAILED: No backup table found. Cannot proceed.';
  END IF;

  RAISE NOTICE 'Found backup table: %', backup_table_name;

  -- =========================================================================
  -- STEP 2: Verify Backup Table
  -- =========================================================================

  -- Check if table exists and has data
  EXECUTE format('SELECT COUNT(*) FROM %I', backup_table_name) INTO backup_count;

  IF backup_count = 0 THEN
    RAISE EXCEPTION 'ROLLBACK FAILED: Backup table % is empty', backup_table_name;
  END IF;

  RAISE NOTICE 'Backup table contains % rows', backup_count;

  -- Get current table count for comparison
  SELECT COUNT(*) INTO current_count FROM daily_usage_cache;
  RAISE NOTICE 'Current table contains % rows', current_count;

  -- =========================================================================
  -- STEP 3: Display Rollback Plan
  -- =========================================================================

  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'ROLLBACK PLAN';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Source: % (% rows)', backup_table_name, backup_count;
  RAISE NOTICE 'Target: daily_usage_cache (% rows)', current_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Actions:';
  RAISE NOTICE '  1. TRUNCATE daily_usage_cache';
  RAISE NOTICE '  2. INSERT data from %', backup_table_name;
  RAISE NOTICE '  3. VERIFY row counts match';
  RAISE NOTICE '';
  RAISE NOTICE 'WARNING: Current data in daily_usage_cache will be LOST';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';

  -- =========================================================================
  -- CONFIRMATION CHECKPOINT
  -- =========================================================================

  -- Uncomment this line to enable manual confirmation:
  -- RAISE EXCEPTION 'PREVIEW ONLY - To proceed, comment out this line in the script';

  RAISE NOTICE 'Proceeding with rollback in 3 seconds...';
  PERFORM pg_sleep(3);

  -- =========================================================================
  -- STEP 4: Execute Rollback
  -- =========================================================================

  BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Step 1/3: Truncating daily_usage_cache...';

    TRUNCATE TABLE daily_usage_cache;

    RAISE NOTICE '✅ Table truncated';
    RAISE NOTICE '';
    RAISE NOTICE 'Step 2/3: Restoring data from backup...';

    EXECUTE format('INSERT INTO daily_usage_cache SELECT * FROM %I', backup_table_name);

    RAISE NOTICE '✅ Data restored';
    RAISE NOTICE '';
    RAISE NOTICE 'Step 3/3: Verifying restoration...';

    SELECT COUNT(*) INTO current_count FROM daily_usage_cache;

    IF current_count != backup_count THEN
      RAISE EXCEPTION 'Rollback verification FAILED: Expected % rows, got %',
        backup_count, current_count;
    END IF;

    RAISE NOTICE '✅ Verification successful';
    RAISE NOTICE '';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'ROLLBACK COMPLETE ✅';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Restored % rows from %', current_count, backup_table_name;
    RAISE NOTICE '====================================================================';
    RAISE NOTICE '';

  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Rollback FAILED: %', SQLERRM;
  END;

END $$;

-- ============================================================================
-- POST-ROLLBACK VERIFICATION
-- ============================================================================

RAISE NOTICE 'Running post-rollback verification...';
RAISE NOTICE '';

-- Verify row count
SELECT COUNT(*) as total_rows FROM daily_usage_cache;

-- Verify date range
SELECT
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT date) as unique_dates
FROM daily_usage_cache;

-- Verify JSONB columns not null
SELECT
  COUNT(*) as total_rows,
  SUM(CASE WHEN aggregated_by_user IS NULL THEN 1 ELSE 0 END) as null_user,
  SUM(CASE WHEN aggregated_by_model IS NULL THEN 1 ELSE 0 END) as null_model,
  SUM(CASE WHEN aggregated_by_provider IS NULL THEN 1 ELSE 0 END) as null_provider,
  SUM(CASE WHEN raw_data IS NULL THEN 1 ELSE 0 END) as null_raw
FROM daily_usage_cache;

-- Sample a few rows to verify data looks correct
SELECT
  date,
  jsonb_typeof(aggregated_by_user) as user_type,
  jsonb_typeof(aggregated_by_model) as model_type,
  jsonb_typeof(aggregated_by_provider) as provider_type,
  cached_at
FROM daily_usage_cache
ORDER BY date DESC
LIMIT 10;

RAISE NOTICE '';
RAISE NOTICE '====================================================================';
RAISE NOTICE 'POST-ROLLBACK VERIFICATION COMPLETE';
RAISE NOTICE '====================================================================';
RAISE NOTICE '';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Test application to verify functionality';
RAISE NOTICE '2. Review migration errors if re-running';
RAISE NOTICE '3. Keep backup table until migration succeeds';
RAISE NOTICE '';

-- ============================================================================
-- END OF ROLLBACK SCRIPT
-- ============================================================================
```

**Usage**:

```bash
# Execute rollback
psql -h localhost -U litemaas -d litemaas \
  -f backend/src/migrations/rollback-fix-daily-usage-cache-token-breakdowns.sql

# Expected output:
#   Found backup table: daily_usage_cache_backup_20251011_143022
#   Backup table contains 365 rows
#   Current table contains 365 rows
#   ...
#   ROLLBACK COMPLETE ✅
#   Restored 365 rows from daily_usage_cache_backup_20251011_143022
```

---

### Step 1D.4: Create Migration Runbook

**Duration**: 1 hour

**Files to Create**:

- `docs/operations/migration-runbook-daily-usage-cache.md`

**Implementation** (comprehensive 1500+ line runbook - showing structure):

````markdown
# Migration Runbook: Daily Usage Cache Token Breakdowns

**Migration**: `fix-daily-usage-cache-token-breakdowns.sql`
**Version**: 2.0 (Enhanced with safety features)
**Date**: 2025-10-11
**DBA**: [Name]
**Estimated Duration**: 5-15 minutes (depends on data size)

---

## Executive Summary

**Purpose**: Fix token breakdown structure in `daily_usage_cache` JSONB columns

**Impact**:

- **Target Table**: `daily_usage_cache`
- **Operation**: UPDATE (modifies JSONB columns)
- **Scope**: All rows in table
- **Downtime**: None (application continues running)
- **Risk Level**: MEDIUM (complex JSONB transformation, mitigated by backup/rollback)

**Success Rate**:

- Tested on staging: 100% success
- Expected production: > 99% success

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Pre-Migration Steps](#pre-migration-steps)
4. [Migration Execution](#migration-execution)
5. [Post-Migration Validation](#post-migration-validation)
6. [Rollback Procedure](#rollback-procedure)
7. [Troubleshooting](#troubleshooting)
8. [Success Criteria](#success-criteria)
9. [Emergency Contacts](#emergency-contacts)

---

## Prerequisites

### Required Permissions

```sql
-- Verify you have required permissions
SELECT
  has_table_privilege('daily_usage_cache', 'SELECT') as can_read,
  has_table_privilege('daily_usage_cache', 'UPDATE') as can_update,
  has_table_privilege('daily_usage_cache', 'INSERT') as can_insert,
  has_database_privilege(current_database(), 'CREATE') as can_create_table;

-- Expected: All should return 't' (true)
```
````

### Required Tools

- PostgreSQL client (`psql`) version 12+
- Database credentials with write access
- Backup storage (if backing up entire database)
- ~30 minutes of uninterrupted time

### Communication

- [ ] Stakeholders notified of planned migration
- [ ] Backup DBA available (if primary DBA unavailable)
- [ ] DevOps team on standby
- [ ] Monitoring dashboard accessible

---

## Pre-Migration Checklist

**Review** (24 hours before):

- [ ] Test migration on staging with production-like data
- [ ] Measure execution time on staging
- [ ] Review transformation logic for correctness
- [ ] Backup strategy confirmed
- [ ] Rollback plan tested
- [ ] DBA review completed

**Prepare** (1 hour before):

- [ ] Database monitoring ready
- [ ] Backup storage verified (sufficient space)
- [ ] Migration scripts reviewed
- [ ] Rollback scripts accessible
- [ ] Emergency contacts confirmed

**Validate** (immediately before):

- [ ] Application running normally
- [ ] No other migrations in progress
- [ ] Database health check passed
- [ ] Backup schedule not conflicting
- [ ] Maintenance window (if scheduled)

---

## Pre-Migration Steps

### Step 1: Baseline Metrics (2 minutes)

```sql
-- Record current state for comparison
SELECT
  COUNT(*) as total_rows,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  SUM(CASE WHEN aggregated_by_user IS NULL THEN 1 ELSE 0 END) as null_users,
  SUM(CASE WHEN aggregated_by_model IS NULL THEN 1 ELSE 0 END) as null_models,
  SUM(CASE WHEN aggregated_by_provider IS NULL THEN 1 ELSE 0 END) as null_providers,
  pg_size_pretty(pg_total_relation_size('daily_usage_cache')) as table_size
FROM daily_usage_cache;
```

**Record Results**:

```
Total Rows: _________
Date Range: _________ to _________
Table Size: _________
Null Aggregations: _________ (should be 0)
```

### Step 2: Create Backup (5 minutes)

```bash
# Run backup script
psql -h localhost -U litemaas -d litemaas \
  -f backend/src/migrations/backup-daily-usage-cache.sql \
  2>&1 | tee migration-backup-$(date +%Y%m%d_%H%M%S).log
```

**Expected Output**:

```
NOTICE:  Creating backup table: daily_usage_cache_backup_20251011_143022
NOTICE:  Original table contains 365 rows
NOTICE:  ✅ Backup created successfully
NOTICE:  ✅ Backup contains 365 rows
```

**Verify Backup**:

```sql
-- Check backup table exists and has correct row count
SELECT
  table_name,
  (SELECT COUNT(*) FROM daily_usage_cache) as original_count
FROM information_schema.tables
WHERE table_name LIKE 'daily_usage_cache_backup_%'
ORDER BY table_name DESC
LIMIT 1;
```

**✅ Checkpoint**: Backup verified before proceeding

---

## Migration Execution

### Step 3: Run Enhanced Migration (5-15 minutes)

```bash
# Execute migration script
psql -h localhost -U litemaas -d litemaas \
  -f backend/src/migrations/fix-daily-usage-cache-token-breakdowns.sql \
  2>&1 | tee migration-execution-$(date +%Y%m%d_%H%M%S).log

# Monitor progress in real-time (optional, in another terminal)
tail -f /var/log/postgresql/postgresql.log | grep -i "notice"
```

**Expected Progress Output**:

```
NOTICE:  Created progress tracking table
NOTICE:  Created migration function
NOTICE:  Starting transaction...
NOTICE:  ====================================================================
NOTICE:  Starting Migration: Daily Usage Cache Token Breakdowns
NOTICE:  ====================================================================
NOTICE:  Total rows to process: 365
NOTICE:  [50/365] Processed 50 rows (48 successful, 0 failed, 2 skipped)
NOTICE:  [100/365] Processed 100 rows (96 successful, 0 failed, 4 skipped)
...
NOTICE:  ====================================================================
NOTICE:  Migration Complete
NOTICE:  ====================================================================
NOTICE:  Total rows processed: 365
NOTICE:  Successful: 361
NOTICE:  Failed: 0
NOTICE:  Skipped: 4
NOTICE:  ====================================================================
NOTICE:  Running validation checks...
NOTICE:  ✅ Validation 1: No null values found
NOTICE:  ✅ Validation 2: All JSONB structures valid
NOTICE:  ✅ Validation 3: No old token breakdown structure found
NOTICE:  ====================================================================
NOTICE:  All validation checks passed ✅
NOTICE:  ====================================================================
NOTICE:  Waiting 5 seconds for review...
[... 5 second pause ...]
NOTICE:  ====================================================================
NOTICE:  Transaction COMMITTED ✅
NOTICE:  ====================================================================
```

**⚠️ Warning Signs** (STOP if you see):

- `ERROR:` messages
- `Migration aborted: Too many errors`
- `Validation FAILED:`
- Unexpected `ROLLBACK` message
- Lock timeout errors

**If Warning Signs Appear**:

1. Stop execution (Ctrl+C if still running)
2. Transaction will auto-rollback
3. Review error messages in log file
4. Check `migration_progress` table for failed rows
5. Do NOT proceed to validation
6. Consult [Troubleshooting](#troubleshooting) section

---

## Post-Migration Validation

### Step 4: Database Validation (2 minutes)

```sql
-- Check migration results summary
SELECT status, COUNT(*)
FROM migration_progress
GROUP BY status;
-- Expected: All rows 'SUCCESS' or 'SKIPPED', zero 'ERROR'

-- Verify no null values
SELECT COUNT(*) as null_count
FROM daily_usage_cache
WHERE aggregated_by_user IS NULL
   OR aggregated_by_model IS NULL
   OR aggregated_by_provider IS NULL;
-- Expected: 0

-- Verify JSONB structure
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN jsonb_typeof(aggregated_by_user) = 'object' THEN 1 ELSE 0 END) as valid_user,
  SUM(CASE WHEN jsonb_typeof(aggregated_by_model) = 'object' THEN 1 ELSE 0 END) as valid_model,
  SUM(CASE WHEN jsonb_typeof(aggregated_by_provider) = 'object' THEN 1 ELSE 0 END) as valid_provider
FROM daily_usage_cache;
-- Expected: total = valid_user = valid_model = valid_provider

-- Spot check a few rows
SELECT
  date,
  aggregated_by_user->>'totalRequests' as user_requests,
  aggregated_by_model->>'totalRequests' as model_requests,
  cached_at
FROM daily_usage_cache
ORDER BY date DESC
LIMIT 10;
-- Expected: Reasonable values, no errors
```

### Step 5: Application Testing (10 minutes)

**Test Admin Analytics Endpoints**:

```bash
# Test 1: Analytics endpoint
curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }'

# Expected: 200 OK with analytics data

# Test 2: User breakdown
curl -X POST http://localhost:8081/api/v1/admin/usage/user-breakdown \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }'

# Expected: 200 OK with user breakdown

# Test 3: Model breakdown
curl -X POST http://localhost:8081/api/v1/admin/usage/model-breakdown \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }'

# Expected: 200 OK with model breakdown
```

**Frontend Testing**:

- [ ] Navigate to Admin Usage page
- [ ] Verify all charts load without errors
- [ ] Check token breakdown data displays
- [ ] Test date range filtering
- [ ] Verify no console errors

**Check Error Logs**:

```bash
# Backend errors
grep -i error logs/backend.log | tail -n 50

# Expected: No new errors related to admin usage
```

### Step 6: Performance Validation (5 minutes)

```sql
-- Measure query performance (should be fast)
EXPLAIN ANALYZE
SELECT aggregated_by_user
FROM daily_usage_cache
WHERE date BETWEEN '2025-01-01' AND '2025-01-31';
-- Expected: Execution time < 100ms
```

---

## Rollback Procedure

**When to Rollback**:

- Migration produced incorrect results
- Application errors after migration
- Data corruption detected
- Validation failures

### Immediate Rollback (5 minutes)

**Step 1: Stop Application** (optional, if errors severe):

```bash
# Stop backend to prevent cache updates during rollback
systemctl stop litemaas-backend
```

**Step 2: Execute Rollback Script**:

```bash
psql -h localhost -U litemaas -d litemaas \
  -f backend/src/migrations/rollback-fix-daily-usage-cache-token-breakdowns.sql \
  2>&1 | tee migration-rollback-$(date +%Y%m%d_%H%M%S).log
```

**Step 3: Verify Rollback**:

```sql
-- Check row count matches backup
SELECT COUNT(*) FROM daily_usage_cache;

-- Spot check data integrity
SELECT date, cached_at
FROM daily_usage_cache
ORDER BY date
LIMIT 10;
```

**Step 4: Restart Application**:

```bash
systemctl start litemaas-backend
```

**Step 5: Test Application**:

- Verify admin analytics endpoints working
- Check frontend for errors
- Review logs for issues

**Step 6: Investigate Failure**:

- Review migration log file
- Check `migration_progress` table (if accessible)
- Identify root cause
- Fix migration script
- Re-test on staging before retry

---

## Troubleshooting

[... Extensive troubleshooting section with common issues and solutions ...]

---

## Success Criteria

**Migration Success**:

- [ ] All validation checks passed
- [ ] Zero rows with 'ERROR' status
- [ ] Application tests pass
- [ ] No error logs
- [ ] Performance acceptable
- [ ] Frontend charts display correctly

**Ready for Cleanup** (after 24-48 hours):

- [ ] No issues reported
- [ ] Application stable
- [ ] Stakeholders confirmed
- [ ] Backup table can be dropped

---

## Emergency Contacts

- **DBA**: [Name] - [Contact]
- **DevOps**: [Name] - [Contact]
- **Engineering Lead**: [Name] - [Contact]
- **On-Call**: [Number]

---

## Timeline

| Step                   | Duration | Total Elapsed |
| ---------------------- | -------- | ------------- |
| Baseline metrics       | 2 min    | 0:02          |
| Create backup          | 5 min    | 0:07          |
| Execute migration      | 5-15 min | 0:12-0:22     |
| Database validation    | 2 min    | 0:14-0:24     |
| Application testing    | 10 min   | 0:24-0:34     |
| Performance validation | 5 min    | 0:29-0:39     |

**Total Estimated Time**: 30-40 minutes (including buffer)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Next Review**: After migration completion

````

---

### Step 1D.5: Test on Staging

**Duration**: 30 minutes

**Actions**:

1. **Prepare Staging Database**:
   ```bash
   # Create production-like dataset
   # - 365 days of data
   # - Multiple users, models, providers
   # - Realistic JSONB structures
````

2. **Run Backup Script**:

   ```bash
   psql -h staging-db -U litemaas -d litemaas \
     -f backend/src/migrations/backup-daily-usage-cache.sql
   ```

3. **Run Migration Script**:

   ```bash
   psql -h staging-db -U litemaas -d litemaas \
     -f backend/src/migrations/fix-daily-usage-cache-token-breakdowns.sql
   ```

4. **Verify Results**:
   - Check all rows processed successfully
   - Verify data transformations correct
   - Test application functionality
   - Measure execution time

5. **Test Rollback Script**:

   ```bash
   psql -h staging-db -U litemaas -d litemaas \
     -f backend/src/migrations/rollback-fix-daily-usage-cache-token-breakdowns.sql
   ```

6. **Verify Rollback**:
   - Check data restored correctly
   - Verify row counts match
   - Test application still works

**Document Results**:

```markdown
### Staging Test Results

**Environment**: Staging database
**Data Size**: 365 rows
**Execution Time**: 8 minutes

**Migration Results**:

- Total rows: 365
- Successful: 361
- Failed: 0
- Skipped: 4

**Rollback Test**:

- Restoration time: 45 seconds
- Data integrity: ✅ Verified
- Application: ✅ Working

**Sign-Off**: [DBA Name] - [Date]
```

---

## Session 1D Deliverables

- [ ] Backup procedure script created
- [ ] Migration enhanced with safety features
- [ ] Rollback script created and tested
- [ ] Migration runbook documented (1500+ lines)
- [ ] Tested on staging with production-like data
- [ ] DBA sign-off obtained

---

## Session 1D Acceptance Criteria

### Functional Requirements

- [ ] Backup procedure creates timestamped backup
- [ ] Backup verification confirms row counts match
- [ ] Migration wrapped in transaction (auto-rollback on error)
- [ ] Progress logging added (per-row tracking)
- [ ] Error handling for each row (try-catch)
- [ ] Error threshold prevents mass corruption (> 10 errors)
- [ ] Skip logic for already-migrated rows
- [ ] Post-migration validation queries
- [ ] Rollback script tested successfully
- [ ] Rollback restores exact backup state

### Technical Requirements

- [ ] Tested on production-like data (size and complexity)
- [ ] Execution time measured and acceptable (< 15 min)
- [ ] DBA review completed
- [ ] Runbook complete with:
  - [ ] Prerequisites checklist
  - [ ] Step-by-step procedures
  - [ ] Validation queries
  - [ ] Troubleshooting guide
  - [ ] Rollback procedure
  - [ ] Success criteria
  - [ ] Emergency contacts
  - [ ] Timeline estimates

### Documentation

- [ ] Backup procedure documented
- [ ] Enhanced migration documented
- [ ] Rollback procedure documented
- [ ] Runbook comprehensive and clear
- [ ] Expected outputs documented
- [ ] Warning signs documented

---

## Session 1D Validation

### Staging Tests

```bash
# Full staging test workflow
./scripts/test-migration-staging.sh

# Expected workflow:
# 1. Create production-like data
# 2. Run backup
# 3. Run migration
# 4. Verify results
# 5. Test application
# 6. Run rollback
# 7. Verify restoration
# 8. Re-run migration (idempotency test)
```

### Code Review

**Review Checklist**:

- [ ] Backup script creates timestamped table
- [ ] Backup verification checks row count
- [ ] Migration has transaction wrapper
- [ ] Migration has progress tracking
- [ ] Migration has error handling per row
- [ ] Migration has error threshold
- [ ] Migration has post-validation
- [ ] Rollback finds most recent backup
- [ ] Rollback verifies before proceeding
- [ ] Rollback has verification after
- [ ] Runbook is comprehensive
- [ ] All SQL scripts have comments

---

## Troubleshooting

### Issue: Backup script fails with "permission denied"

**Cause**: Insufficient database permissions

**Solution**:

```sql
-- Grant required permissions
GRANT CREATE ON DATABASE litemaas TO litemaas_user;

-- Verify permissions
SELECT has_database_privilege('litemaas', 'CREATE');
```

---

### Issue: Migration times out

**Cause**: Large dataset, complex transformations

**Solution**:

```sql
-- Increase statement timeout
SET statement_timeout = '30min';

-- Then run migration
\i backend/src/migrations/fix-daily-usage-cache-token-breakdowns.sql
```

---

### Issue: Rollback can't find backup table

**Cause**: Backup table name doesn't match pattern

**Solution**:

```sql
-- List all backup tables
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE 'daily_usage_cache%'
ORDER BY table_name;

-- If backup table has different name, update rollback script
-- Or manually specify backup table:
DO $$
DECLARE
  backup_table_name TEXT := 'your_backup_table_name';
BEGIN
  -- ... rest of rollback script
END $$;
```

---

## Next Steps

**Next Session**: Session 1E - Extract Export & Utilities (Service Refactoring Begins)

**Before Next Session**:

- ✅ Staging tests complete
- ✅ DBA sign-off obtained
- ✅ Runbook reviewed by team
- ✅ Production migration scheduled

**Session 1E Preview**:

- Begin service file refactoring (Issue #1)
- Extract export functionality to separate service
- Extract utility functions to separate module
- Duration: 2-3 hours

---

## Session Summary Template

**After Completing This Session**:

```markdown
### Session 1D: Create Migration Rollback - Completed

**Date**: [YYYY-MM-DD]
**Actual Duration**: [X hours]
**Status**: ✅ Complete

**Deliverables**:

- ✅ Backup procedure created and tested
- ✅ Migration enhanced with safety features
- ✅ Rollback script created and tested
- ✅ Comprehensive runbook (1500+ lines)
- ✅ DBA sign-off obtained

**Staging Test Results**:

- Data size: 365 rows
- Migration time: 8 minutes
- Success rate: 100%
- Rollback time: 45 seconds

**DBA Sign-Off**: [Name] - [Date]

**Production Migration**:

- Scheduled: [Date/Time]
- Maintenance window: [Yes/No]
- Stakeholders notified: [Yes]

**Issues Encountered**: [None / List any]

**Next Session**: 1E - Extract Export & Utilities
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Next Review**: After Session 1D completion

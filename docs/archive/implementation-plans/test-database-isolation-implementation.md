# Test Database Isolation Implementation Plan

**Created**: 2025-10-14
**Status**: Ready for Implementation
**Priority**: HIGH - Currently tests modify development database

## Executive Summary

Integration tests currently run against the development database (`litemaas`), causing:

- Real subscriptions being marked as inactive
- API keys being invalidated
- Development data being modified/deleted

**Solution**: Create separate `litemaas_test` database for all test execution.

**Good News**: No second LiteLLM instance needed - tests already use mock mode when `LITELLM_API_URL` is empty.

## Root Cause Analysis

### Evidence

1. **Only one database exists**: PostgreSQL query shows only `litemaas` database
2. **vitest.config.ts uses dev database**: Line 38-39 defaults to `postgresql://pgadmin:thisisadmin@localhost:5432/litemaas`
3. **Integration tests perform real operations**:
   - `createTestUsers()` does INSERT/UPDATE on real users table
   - Subscription tests mark subscriptions as `'inactive'`
   - API key tests can invalidate real keys
   - No database cleanup between test runs

### When This Started

- **Commit `cd09ae4`** (admin/analytics feature) introduced 14,000 lines of integration test code
- Before this, only unit tests existed (which mock the database)
- Recent commits `e11cf3f` and `cd09ae4` added real database-touching tests

## Implementation Plan

### Phase 1: Create and Initialize Test Database

#### Step 1.1: Create Test Database

```bash
# Connect to PostgreSQL
psql -U pgadmin -h localhost -p 5432 -d postgres

# Create test database
CREATE DATABASE litemaas_test;

# Verify creation
\l litemaas_test

# Exit psql
\q
```

**Expected Result**: `litemaas_test` database exists alongside `litemaas`

#### Step 1.2: Copy Schema to Test Database

**Option A: Using pg_dump (Recommended)**

```bash
# Dump schema only (no data) from dev database
pg_dump -U pgadmin -h localhost -p 5432 \
  --schema-only \
  --no-owner \
  --no-privileges \
  litemaas > /tmp/litemaas_schema.sql

# Apply schema to test database
psql -U pgadmin -h localhost -p 5432 -d litemaas_test < /tmp/litemaas_schema.sql

# Cleanup
rm /tmp/litemaas_schema.sql
```

**Option B: Using existing migration scripts (if they exist)**

```bash
# Check for migration scripts
ls backend/src/lib/database-migrations.ts
# If migrations exist, run them against test database
```

**Verification**:

```sql
-- Check tables exist in test database
psql -U pgadmin -h localhost -p 5432 -d litemaas_test -c "\dt"
```

### Phase 2: Update Test Configuration

#### Step 2.1: Update vitest.config.ts

**File**: `backend/vitest.config.ts`

**Change**: Line 38-39

```typescript
// BEFORE:
DATABASE_URL:
  process.env.DATABASE_URL || 'postgresql://pgadmin:thisisadmin@localhost:5432/litemaas',

// AFTER:
DATABASE_URL: 'postgresql://pgadmin:thisisadmin@localhost:5432/litemaas_test',
```

**Rationale**:

- Remove fallback to dev database
- Hardcode test database URL
- Never allow tests to run against non-test database

**Testing**:

```bash
cd backend
npm run test:unit
# Should pass, uses test database
```

#### Step 2.2: Update .env.example

**File**: `backend/.env.example`

**Add** (after line 11):

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/litemaas

# Test Database Configuration (used by vitest)
# Tests will ALWAYS use this database, not DATABASE_URL
# DO NOT point this at your development or production database!
TEST_DATABASE_URL=postgresql://pgadmin:thisisadmin@localhost:5432/litemaas_test
```

**Rationale**: Document the test database for other developers

#### Step 2.3: Add Database Safety Check

**File**: `backend/tests/integration/setup.ts`

**Add** after imports (around line 15):

```typescript
/**
 * CRITICAL: Safety check to prevent tests from running against non-test databases
 */
function verifyTestDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';

  // Check that we're using a test database
  if (!dbUrl.includes('litemaas_test')) {
    throw new Error(
      '🚨 CRITICAL ERROR: Tests must run against litemaas_test database!\n' +
        `Current DATABASE_URL: ${dbUrl}\n` +
        'Tests WILL NOT run against development or production databases.\n' +
        'Please check backend/vitest.config.ts configuration.',
    );
  }

  // Additional check: warn if database name contains 'prod' or is exactly 'litemaas'
  if (dbUrl.includes('/litemaas_prod') || dbUrl.includes('/litemaas_production')) {
    throw new Error('🚨 CRITICAL: Tests detected production database URL!');
  }

  if (dbUrl.endsWith('/litemaas')) {
    throw new Error(
      '🚨 CRITICAL: Tests detected development database URL!\n' +
        'Database URL ends with /litemaas instead of /litemaas_test',
    );
  }

  console.log('✅ Test database verification passed: Using litemaas_test');
}

// Run verification immediately
verifyTestDatabase();
```

**Rationale**: Fail-fast if tests accidentally target wrong database

### Phase 3: Create Database Management Scripts

#### Step 3.1: Create Database Reset Helper

**File**: `backend/tests/helpers/db-reset.ts` (NEW FILE)

```typescript
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
```

**Rationale**: Provide safe, reusable database cleanup utilities

#### Step 3.2: Update package.json Scripts

**File**: `backend/package.json`

**Add** to `scripts` section (around line 25):

```json
"test:db:reset": "tsx tests/helpers/db-reset-script.ts",
"test:db:setup": "npm run test:db:reset && echo 'Test database ready'",
```

#### Step 3.3: Create Reset Script Executable

**File**: `backend/tests/helpers/db-reset-script.ts` (NEW FILE)

```typescript
/**
 * CLI script to reset test database
 * Usage: npm run test:db:reset
 */

import { Pool } from 'pg';
import { resetDatabase } from './db-reset';

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
```

**Rationale**: Allow manual database reset via npm script

### Phase 4: Optional Enhancements

#### Step 4.1: Add beforeEach Database Cleanup (Optional)

**File**: `backend/tests/integration/setup.ts`

**Add** (if desired for complete isolation between tests):

```typescript
import { resetDatabase } from '../helpers/db-reset';

beforeEach(async () => {
  // Optional: Reset database before each test
  // This ensures complete isolation but slows down tests
  // await resetDatabase(app.pg.pool);
});
```

**Note**: Only enable if needed - it will slow down tests significantly

#### Step 4.2: Add Database Migration Sync Script (Optional)

**File**: `backend/scripts/sync-test-db-schema.sh` (NEW FILE)

```bash
#!/bin/bash
# Sync test database schema with development database
# Run this after making schema changes to dev database

set -e

echo "🔄 Syncing test database schema with development database..."

# Dump dev schema
pg_dump -U pgadmin -h localhost -p 5432 \
  --schema-only \
  --no-owner \
  --no-privileges \
  litemaas > /tmp/litemaas_schema.sql

# Drop and recreate test database
psql -U pgadmin -h localhost -p 5432 -d postgres <<EOF
DROP DATABASE IF EXISTS litemaas_test;
CREATE DATABASE litemaas_test;
EOF

# Apply schema
psql -U pgadmin -h localhost -p 5432 -d litemaas_test < /tmp/litemaas_schema.sql

# Cleanup
rm /tmp/litemaas_schema.sql

echo "✅ Test database schema synced successfully"
```

**Make executable**:

```bash
chmod +x backend/scripts/sync-test-db-schema.sh
```

**Rationale**: Easy way to keep test database schema in sync with development

### Phase 5: Update Documentation

#### Step 5.1: Update README or Setup Docs

**File**: `docs/development/setup.md` or `README.md`

**Add section**:

````markdown
## Test Database Setup

### Initial Setup

LiteMaaS uses a separate database for tests to prevent contamination of development data.

1. **Create test database**:
   ```bash
   psql -U pgadmin -h localhost -p 5432 -d postgres -c "CREATE DATABASE litemaas_test;"
   ```
````

2. **Initialize schema**:

   ```bash
   # From project root
   cd backend
   npm run test:db:setup
   ```

3. **Verify tests work**:
   ```bash
   npm test
   ```

### Important Notes

- ⚠️ **Tests will NEVER run against your development database**
- The test database is hardcoded in `vitest.config.ts`
- Integration tests automatically create test users and data
- Test data is NOT automatically cleaned up between runs (for speed)

### Resetting Test Database

If tests start failing due to stale data:

```bash
npm run test:db:reset
```

### Syncing Test Schema with Dev

After making schema changes to development database:

```bash
./scripts/sync-test-db-schema.sh
```

````

#### Step 5.2: Update backend/CLAUDE.md

**File**: `backend/CLAUDE.md`

**Add** to "Testing" section (around line 230):
```markdown
# Testing

**IMPORTANT**: Tests use a separate `litemaas_test` database, NOT the development database.

## Test Database Setup

Before running tests for the first time:
```bash
# Create test database
psql -U pgadmin -h localhost -p 5432 -d postgres -c "CREATE DATABASE litemaas_test;"

# Initialize schema
npm run test:db:setup
````

## Running Tests

```bash
npm run test:unit        # Unit tests (mocked, no database)
npm run test:integration # Integration tests (real database: litemaas_test)
npm run test:security    # Security tests
npm run test:coverage    # Coverage report
```

## Test Database Management

```bash
npm run test:db:reset    # Reset test database to clean state
npm run test:db:setup    # Initialize/reset test database schema
```

**Safety**: Tests include multiple safety checks to prevent running against development/production databases.

````

## Verification Steps

After implementation, verify:

### 1. Test Database Exists
```bash
psql -U pgadmin -h localhost -p 5432 -d postgres -c "\l litemaas_test"
# Should show litemaas_test database
````

### 2. Tests Use Test Database

```bash
cd backend
npm test 2>&1 | grep "Test database verification passed"
# Should see: ✅ Test database verification passed: Using litemaas_test
```

### 3. Safety Check Works

```bash
# Temporarily edit vitest.config.ts to use 'litemaas' instead of 'litemaas_test'
npm test
# Should fail with: 🚨 CRITICAL ERROR: Tests must run against litemaas_test database!
# Revert the change
```

### 4. Development Database Untouched

```bash
# Check your dev database subscriptions
psql -U pgadmin -h localhost -p 5432 -d litemaas -c "SELECT id, status FROM subscriptions WHERE status = 'inactive';"

# Run tests
cd backend && npm test

# Check dev database again - should be unchanged
psql -U pgadmin -h localhost -p 5432 -d litemaas -c "SELECT id, status FROM subscriptions WHERE status = 'inactive';"
```

## Rollback Plan

If something goes wrong:

1. **Revert vitest.config.ts**:

   ```bash
   git checkout backend/vitest.config.ts
   ```

2. **Remove test database** (optional):

   ```bash
   psql -U pgadmin -h localhost -p 5432 -d postgres -c "DROP DATABASE litemaas_test;"
   ```

3. **Keep using unit tests only** (they're safe):
   ```bash
   npm run test:unit
   ```

## Implementation Checklist

- [ ] Phase 1.1: Create `litemaas_test` database
- [ ] Phase 1.2: Copy schema to test database
- [ ] Phase 2.1: Update `vitest.config.ts` with test database URL
- [ ] Phase 2.2: Update `.env.example` with test database documentation
- [ ] Phase 2.3: Add safety check to `tests/integration/setup.ts`
- [ ] Phase 3.1: Create `tests/helpers/db-reset.ts`
- [ ] Phase 3.2: Update `package.json` with test:db:\* scripts
- [ ] Phase 3.3: Create `tests/helpers/db-reset-script.ts`
- [ ] Phase 4.1: (Optional) Add beforeEach cleanup
- [ ] Phase 4.2: (Optional) Create schema sync script
- [ ] Phase 5.1: Update setup documentation
- [ ] Phase 5.2: Update `backend/CLAUDE.md`
- [ ] Verification: All 4 verification steps pass
- [ ] Verification: Run full test suite successfully
- [ ] Verification: Confirm dev database unchanged after tests

## Estimated Time

- **Phase 1**: 5-10 minutes (database creation and schema copy)
- **Phase 2**: 10-15 minutes (configuration updates and safety checks)
- **Phase 3**: 15-20 minutes (database management scripts)
- **Phase 4**: 10-15 minutes (optional enhancements)
- **Phase 5**: 10-15 minutes (documentation updates)
- **Verification**: 10 minutes

**Total**: 60-85 minutes for complete implementation and testing

## FAQ

### Q: Do I need a second LiteLLM instance for tests?

**A**: No! Tests already use mock mode when `LITELLM_API_URL` is empty (see `vitest.config.ts:44-46`).

### Q: Why didn't this happen before?

**A**: Integration tests with real database operations were recently added in commit `cd09ae4` (admin/analytics feature). Before that, only unit tests existed (which mock the database).

### Q: Can I use the same PostgreSQL instance?

**A**: Yes! Both `litemaas` (dev) and `litemaas_test` can coexist on the same PostgreSQL server.

### Q: Will this slow down tests?

**A**: Integration tests will have the same speed. Unit tests are unaffected (still use mocks). Optional per-test cleanup (Phase 4.1) would slow tests if enabled.

### Q: What if I forget to reset the test database?

**A**: Tests will continue working with accumulated data. Only reset if you encounter test failures due to stale data.

### Q: How do I keep test and dev schemas in sync?

**A**: Use the sync script (Phase 4.2) or re-run the schema dump command after schema changes.

## Notes for AI Assistants

When implementing this plan:

1. Follow phases sequentially
2. Test after each phase
3. Don't skip safety checks (Phase 2.3)
4. Phases 4 and 5 are important for long-term maintenance
5. Use the verification steps to confirm success

## Success Criteria

✅ Test database `litemaas_test` exists
✅ Test database has same schema as `litemaas`
✅ All tests pass using test database
✅ Safety checks prevent tests from using dev database
✅ Development database remains unchanged after running tests
✅ Documentation updated for future developers

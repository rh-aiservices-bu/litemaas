# Phase 5, Session 5A: Database Optimization

**Phase**: 5 - Performance & Observability
**Session**: 5A - Database Optimization
**Duration**: 4-6 hours
**Priority**: 🟢 MEDIUM
**Issues**: Performance optimization for database queries

---

## Navigation

- **Previous Phase**: [Phase 4: Code Quality](./phase-4-code-quality.md)
- **Next Session**: [Session 5B: Performance Testing](./phase-5-session-5b-performance-testing.md)
- **Parallel Session**: Can run concurrently with Phase 4
- **Parent Document**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

### Session Overview

Session 5A focuses on database-level optimizations for the admin analytics feature. The daily usage cache table and related queries need optimization to handle large datasets efficiently (10K+ users, 365+ days of data).

### Prerequisites

Before starting Session 5A, ensure:

- ✅ Phase 1 (Service refactoring) completed - Clean service layer
- ✅ Migration safety procedures in place (Phase 1, Session 1D)
- ✅ Staging environment available for testing
- ✅ Database backup procedures tested
- ✅ DBA availability for review

### Related Documentation

- [Admin Analytics Implementation Plan](../features/admin-usage-analytics-implementation-plan.md)
- [Database Schema](../../backend/src/migrations/)
- [Migration Runbook](../../operations/migration-runbook.md)

---

## Phase 5 Summary

**Phase Goal**: Operational excellence through performance optimization and monitoring

**Phase Duration**: 16-24 hours (3 sessions)
**Sessions**:

- **Session 5A**: Database Optimization (4-6 hours) - THIS SESSION
- **Session 5B**: Performance Testing (6-8 hours)
- **Session 5C**: Monitoring & Metrics (6-10 hours)

**Impact**: High - Ensures system can scale to production workloads

---

## Session 5A Objectives

### Primary Goals

1. **Add Database Indexes**: Optimize query performance with strategic indexes
2. **Optimize Query Plans**: Improve complex JSONB aggregation queries
3. **Batch Operations**: Reduce database round trips
4. **Query Analysis**: Use EXPLAIN ANALYZE to identify bottlenecks
5. **Cache Table Optimization**: Improve daily_usage_cache table structure

### Deliverables

- [ ] Database indexes added for common query patterns
- [ ] Query plans optimized (measured with EXPLAIN ANALYZE)
- [ ] Batch operations implemented where applicable
- [ ] Query performance documentation
- [ ] Migration scripts for index changes

### Success Metrics

- Analytics query time: < 500ms (90th percentile)
- Breakdown queries: < 1 second (90th percentile)
- Cache rebuild: < 5 minutes for 365 days
- Index usage: > 95% of queries use indexes

---

## Implementation Steps

### Step 5A.1: Analyze Current Query Performance (1 hour)

#### Objectives

- Identify slow queries using EXPLAIN ANALYZE
- Measure current performance baselines
- Document query patterns

#### Pre-Work Checklist

- [ ] Access to production-like staging database
- [ ] pgAdmin or psql access configured
- [ ] Sample dataset loaded (1000+ users, 90+ days)
- [ ] Query logging enabled in PostgreSQL

#### Implementation

**Enable Query Logging** (if not already enabled):

```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_statement = 'all'; -- Log all statements (development only)

-- Reload configuration
SELECT pg_reload_conf();
```

**Analyze Key Queries**:

```sql
-- Query 1: Get analytics summary for date range
EXPLAIN ANALYZE
SELECT
  date,
  raw_data,
  aggregated_by_user,
  aggregated_by_model,
  aggregated_by_provider
FROM daily_usage_cache
WHERE date BETWEEN '2024-01-01' AND '2024-03-31'
ORDER BY date;

-- Expected output analysis:
-- - Seq Scan vs Index Scan
-- - Planning time
-- - Execution time
-- - Rows scanned vs rows returned
```

**Document Baseline Performance**:

```markdown
### Query Performance Baseline

**Query 1: Date Range Scan (90 days)**

- Planning Time: 0.5ms
- Execution Time: 245ms
- Method: Sequential Scan
- Rows Scanned: 90
- Rows Returned: 90
- **ISSUE**: No index on date column

**Query 2: JSONB Aggregation (User Breakdown)**

- Planning Time: 1.2ms
- Execution Time: 1,850ms
- Method: Sequential Scan + JSONB operations
- Rows Scanned: 90
- **ISSUE**: JSONB aggregation is slow, no GIN index

**Query 3: Cache Lookup by Date**

- Planning Time: 0.3ms
- Execution Time: 125ms
- Method: Sequential Scan
- **ISSUE**: Primary key not optimal for date lookups

**Query 4: Check if Date is Cached**

- Planning Time: 0.2ms
- Execution Time: 85ms
- Method: Sequential Scan
- **ISSUE**: Repeated lookups slow without index
```

---

### Step 5A.2: Design Index Strategy (45 minutes)

#### Objectives

- Design indexes for common query patterns
- Balance read performance vs write overhead
- Plan index maintenance strategy

#### Index Design

**Analyze Query Patterns**:

```sql
-- Query pattern 1: Date range scans (most common)
SELECT * FROM daily_usage_cache
WHERE date BETWEEN ? AND ?
ORDER BY date;

-- Index needed: B-tree on date column
-- Benefit: Fast range scans and sorting

-- Query pattern 2: Single date lookup
SELECT * FROM daily_usage_cache WHERE date = ?;

-- Index needed: Same B-tree on date
-- Benefit: Fast equality lookups

-- Query pattern 3: JSONB field searches
SELECT * FROM daily_usage_cache
WHERE aggregated_by_user @> '{"user123": {}}';

-- Index needed: GIN index on JSONB columns
-- Benefit: Fast containment queries

-- Query pattern 4: Recent data queries (today, last 7 days)
SELECT * FROM daily_usage_cache
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;

-- Index needed: B-tree on date (DESC) for reverse scans
-- Benefit: Fast "recent data" queries
```

**Index Strategy Document**:

```markdown
### Index Strategy for daily_usage_cache

**Index 1: Primary Date Index**

- Type: B-tree
- Column: date
- Purpose: Date range queries, sorting, uniqueness
- Usage: 95% of queries
- Impact: High benefit, low overhead (date changes rarely)

**Index 2: JSONB GIN Indexes**

- Type: GIN (Generalized Inverted Index)
- Columns: aggregated_by_user, aggregated_by_model, aggregated_by_provider
- Purpose: Fast JSONB containment and key searches
- Usage: 60% of queries (breakdowns)
- Impact: High benefit, moderate overhead (JSONB updates)

**Index 3: Composite Index for Cache Checks**

- Type: B-tree
- Columns: (date, cached_at)
- Purpose: Verify cache completeness
- Usage: 30% of queries
- Impact: Medium benefit, low overhead

**Rejected Indexes**:

- Full-text search on raw_data: Not needed (structured queries only)
- Partial indexes on date: Dataset is small enough for full index
```

---

### Step 5A.3: Create Database Indexes (1-1.5 hours)

#### Objectives

- Create migration script for index additions
- Test index creation on staging
- Measure performance improvement

#### Pre-Work Checklist

- [ ] Migration script template ready
- [ ] Staging database backup created
- [ ] Rollback script prepared
- [ ] DBA available for review

#### Implementation

**Create Migration Script**:

**File**: `backend/src/migrations/add-daily-usage-cache-indexes.sql`

```sql
-- Migration: Add indexes to daily_usage_cache table
-- Purpose: Optimize admin analytics queries
-- Author: [Your Name]
-- Date: 2025-10-11
-- Estimated Duration: 2-5 minutes (depends on data size)

-- Step 1: Create index on date column (primary query pattern)
DO $$
BEGIN
  -- Check if index already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'daily_usage_cache'
      AND indexname = 'idx_daily_usage_cache_date'
  ) THEN
    CREATE INDEX CONCURRENTLY idx_daily_usage_cache_date
    ON daily_usage_cache (date);

    RAISE NOTICE 'Created index: idx_daily_usage_cache_date';
  ELSE
    RAISE NOTICE 'Index idx_daily_usage_cache_date already exists';
  END IF;
END $$;

-- Step 2: Create GIN index on aggregated_by_user JSONB column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'daily_usage_cache'
      AND indexname = 'idx_daily_usage_cache_user_jsonb'
  ) THEN
    CREATE INDEX CONCURRENTLY idx_daily_usage_cache_user_jsonb
    ON daily_usage_cache USING GIN (aggregated_by_user);

    RAISE NOTICE 'Created index: idx_daily_usage_cache_user_jsonb';
  ELSE
    RAISE NOTICE 'Index idx_daily_usage_cache_user_jsonb already exists';
  END IF;
END $$;

-- Step 3: Create GIN index on aggregated_by_model JSONB column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'daily_usage_cache'
      AND indexname = 'idx_daily_usage_cache_model_jsonb'
  ) THEN
    CREATE INDEX CONCURRENTLY idx_daily_usage_cache_model_jsonb
    ON daily_usage_cache USING GIN (aggregated_by_model);

    RAISE NOTICE 'Created index: idx_daily_usage_cache_model_jsonb';
  ELSE
    RAISE NOTICE 'Index idx_daily_usage_cache_model_jsonb already exists';
  END IF;
END $$;

-- Step 4: Create GIN index on aggregated_by_provider JSONB column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'daily_usage_cache'
      AND indexname = 'idx_daily_usage_cache_provider_jsonb'
  ) THEN
    CREATE INDEX CONCURRENTLY idx_daily_usage_cache_provider_jsonb
    ON daily_usage_cache USING GIN (aggregated_by_provider);

    RAISE NOTICE 'Created index: idx_daily_usage_cache_provider_jsonb';
  ELSE
    RAISE NOTICE 'Index idx_daily_usage_cache_provider_jsonb already exists';
  END IF;
END $$;

-- Step 5: Create composite index for cache completeness checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'daily_usage_cache'
      AND indexname = 'idx_daily_usage_cache_date_cached_at'
  ) THEN
    CREATE INDEX CONCURRENTLY idx_daily_usage_cache_date_cached_at
    ON daily_usage_cache (date, cached_at);

    RAISE NOTICE 'Created index: idx_daily_usage_cache_date_cached_at';
  ELSE
    RAISE NOTICE 'Index idx_daily_usage_cache_date_cached_at already exists';
  END IF;
END $$;

-- Verify all indexes created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'daily_usage_cache'
ORDER BY indexname;

-- Analyze table to update statistics
ANALYZE daily_usage_cache;

RAISE NOTICE 'Migration complete. All indexes created and table analyzed.';
```

**Create Rollback Script**:

**File**: `backend/src/migrations/rollback-daily-usage-cache-indexes.sql`

```sql
-- Rollback: Remove indexes from daily_usage_cache table
-- Purpose: Revert add-daily-usage-cache-indexes.sql migration
-- Author: [Your Name]
-- Date: 2025-10-11

-- Drop all created indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_daily_usage_cache_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_daily_usage_cache_user_jsonb;
DROP INDEX CONCURRENTLY IF EXISTS idx_daily_usage_cache_model_jsonb;
DROP INDEX CONCURRENTLY IF EXISTS idx_daily_usage_cache_provider_jsonb;
DROP INDEX CONCURRENTLY IF EXISTS idx_daily_usage_cache_date_cached_at;

-- Verify indexes removed
SELECT
  indexname
FROM pg_indexes
WHERE tablename = 'daily_usage_cache';

RAISE NOTICE 'Rollback complete. All indexes removed.';
```

**Test on Staging**:

```bash
# Backup staging database
pg_dump -h staging-db -U litemaas -d litemaas > backup_before_indexes_$(date +%Y%m%d_%H%M%S).sql

# Run migration
psql -h staging-db -U litemaas -d litemaas -f backend/src/migrations/add-daily-usage-cache-indexes.sql

# Verify indexes created
psql -h staging-db -U litemaas -d litemaas -c "SELECT indexname FROM pg_indexes WHERE tablename = 'daily_usage_cache';"

# Test rollback
psql -h staging-db -U litemaas -d litemaas -f backend/src/migrations/rollback-daily-usage-cache-indexes.sql

# Re-run migration for testing
psql -h staging-db -U litemaas -d litemaas -f backend/src/migrations/add-daily-usage-cache-indexes.sql
```

**Measure Performance Improvement**:

```sql
-- Run same queries from Step 5A.1 with EXPLAIN ANALYZE

-- Query 1: Date Range Scan (should use idx_daily_usage_cache_date)
EXPLAIN ANALYZE
SELECT * FROM daily_usage_cache
WHERE date BETWEEN '2024-01-01' AND '2024-03-31'
ORDER BY date;

-- Expected improvement:
-- Before: Seq Scan, 245ms
-- After: Index Scan using idx_daily_usage_cache_date, <50ms

-- Query 2: JSONB Aggregation (should use GIN indexes)
EXPLAIN ANALYZE
SELECT
  jsonb_each(aggregated_by_user)
FROM daily_usage_cache
WHERE date BETWEEN '2024-01-01' AND '2024-03-31';

-- Expected improvement:
-- Before: Seq Scan + JSONB ops, 1,850ms
-- After: Index Scan + JSONB ops, <500ms
```

**Document Performance Gains**:

```markdown
### Index Performance Impact

**Query 1: Date Range Scan**

- Before: 245ms (Sequential Scan)
- After: 42ms (Index Scan on idx_daily_usage_cache_date)
- **Improvement**: 83% faster

**Query 2: JSONB User Aggregation**

- Before: 1,850ms (Sequential Scan + JSONB)
- After: 385ms (Index Scan + GIN index)
- **Improvement**: 79% faster

**Query 3: Single Date Lookup**

- Before: 125ms (Sequential Scan)
- After: 8ms (Index Scan)
- **Improvement**: 94% faster

**Overall Impact**:

- Average query time: 67% reduction
- 90th percentile: 75% reduction
- Index overhead: ~15% slower writes (acceptable tradeoff)
```

---

### Step 5A.4: Optimize Complex Queries (1.5-2 hours)

#### Objectives

- Rewrite slow JSONB aggregation queries
- Use PostgreSQL JSONB functions efficiently
- Add query hints where beneficial

#### Pre-Work Checklist

- [ ] Review current aggregation logic
- [ ] Test queries on staging with realistic data
- [ ] Benchmark before/after performance

#### Implementation

**Optimize User Breakdown Query**:

```typescript
// ❌ Before: Multiple database round trips

async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
  // Get cache data
  const cacheData = await this.getCachedData(filters.startDate, filters.endDate);

  // Extract user data (client-side JSONB processing)
  const userMap = new Map<string, UserMetrics>();
  for (const day of cacheData) {
    const users = day.aggregated_by_user as Record<string, any>;
    for (const [userId, metrics] of Object.entries(users)) {
      const existing = userMap.get(userId) || this.createEmptyMetrics();
      userMap.set(userId, this.mergeMetrics(existing, metrics));
    }
  }

  // Fetch user details (N queries or 1 batch query)
  const userIds = Array.from(userMap.keys());
  const users = await this.getUsersByIds(userIds);

  // Merge data
  return this.mergeUserDataWithMetrics(users, userMap);
}
```

```typescript
// ✅ After: Single optimized query with database-side aggregation

async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
  const query = `
    WITH user_metrics AS (
      -- Aggregate JSONB data using PostgreSQL functions
      SELECT
        user_key AS user_id,
        SUM((user_data->>'totalRequests')::int) AS total_requests,
        SUM((user_data->>'totalTokens')::bigint) AS total_tokens,
        SUM((user_data->>'promptTokens')::bigint) AS prompt_tokens,
        SUM((user_data->>'completionTokens')::bigint) AS completion_tokens,
        SUM((user_data->>'totalCost')::numeric) AS total_cost
      FROM (
        -- Expand JSONB into rows
        SELECT
          jsonb_object_keys(aggregated_by_user) AS user_key,
          jsonb_each(aggregated_by_user) AS user_data
        FROM daily_usage_cache
        WHERE date BETWEEN $1 AND $2
      ) AS expanded
      GROUP BY user_key
    )
    -- Join with user table in single query
    SELECT
      um.user_id,
      COALESCE(u.username, 'Unknown User') AS username,
      u.email,
      u.role,
      um.total_requests,
      um.total_tokens,
      um.prompt_tokens,
      um.completion_tokens,
      um.total_cost
    FROM user_metrics um
    LEFT JOIN users u ON u.id = um.user_id
    ORDER BY um.total_cost DESC;
  `;

  const result = await this.fastify.pg.query(query, [
    filters.startDate,
    filters.endDate,
  ]);

  return result.rows.map(row => ({
    userId: row.user_id,
    username: row.username,
    email: row.email,
    role: row.role,
    totalRequests: parseInt(row.total_requests, 10),
    totalTokens: parseInt(row.total_tokens, 10),
    promptTokens: parseInt(row.prompt_tokens, 10),
    completionTokens: parseInt(row.completion_tokens, 10),
    totalCost: parseFloat(row.total_cost),
  }));
}
```

**Measure Improvement**:

```sql
-- Test optimized query
EXPLAIN ANALYZE
WITH user_metrics AS (
  SELECT
    user_key AS user_id,
    SUM((user_data->>'totalRequests')::int) AS total_requests,
    SUM((user_data->>'totalTokens')::bigint) AS total_tokens,
    SUM((user_data->>'totalCost')::numeric) AS total_cost
  FROM (
    SELECT
      jsonb_object_keys(aggregated_by_user) AS user_key,
      jsonb_each(aggregated_by_user) AS user_data
    FROM daily_usage_cache
    WHERE date BETWEEN '2024-01-01' AND '2024-03-31'
  ) AS expanded
  GROUP BY user_key
)
SELECT
  um.*,
  u.username,
  u.email
FROM user_metrics um
LEFT JOIN users u ON u.id = um.user_id
ORDER BY um.total_cost DESC;

-- Expected: Uses GIN index, < 500ms for 90 days
```

**Optimize Model Breakdown Query** (similar pattern):

```typescript
async getModelBreakdown(filters: AdminUsageFilters): Promise<ModelBreakdown[]> {
  const query = `
    SELECT
      model_key AS model,
      SUM((model_data->>'totalRequests')::int) AS total_requests,
      SUM((model_data->>'totalTokens')::bigint) AS total_tokens,
      SUM((model_data->>'totalCost')::numeric) AS total_cost
    FROM (
      SELECT
        jsonb_object_keys(aggregated_by_model) AS model_key,
        jsonb_each(aggregated_by_model) AS model_data
      FROM daily_usage_cache
      WHERE date BETWEEN $1 AND $2
        AND aggregated_by_model IS NOT NULL
    ) AS expanded
    GROUP BY model_key
    ORDER BY SUM((model_data->>'totalCost')::numeric) DESC;
  `;

  const result = await this.fastify.pg.query(query, [
    filters.startDate,
    filters.endDate,
  ]);

  return result.rows.map(row => ({
    model: row.model,
    totalRequests: parseInt(row.total_requests, 10),
    totalTokens: parseInt(row.total_tokens, 10),
    totalCost: parseFloat(row.total_cost),
  }));
}
```

---

### Step 5A.5: Implement Batch Operations (1 hour)

#### Objectives

- Reduce database round trips for cache operations
- Use bulk inserts for cache updates
- Implement efficient batch queries

#### Implementation

**Batch Cache Updates**:

```typescript
// ❌ Before: Update cache one day at a time
async rebuildCache(startDate: string, endDate: string): Promise<void> {
  const dates = this.getDateRange(startDate, endDate);

  for (const date of dates) {
    const data = await this.aggregateForDate(date);
    await this.updateCacheForDate(date, data); // N database writes
  }
}

// ✅ After: Batch upsert all days
async rebuildCache(startDate: string, endDate: string): Promise<void> {
  const dates = this.getDateRange(startDate, endDate);

  // Aggregate all dates in parallel
  const aggregationPromises = dates.map(date =>
    this.aggregateForDate(date)
  );
  const allData = await Promise.all(aggregationPromises);

  // Batch upsert using PostgreSQL UNNEST
  const query = `
    INSERT INTO daily_usage_cache (
      date,
      raw_data,
      aggregated_by_user,
      aggregated_by_model,
      aggregated_by_provider,
      cached_at
    )
    SELECT * FROM UNNEST(
      $1::date[],
      $2::jsonb[],
      $3::jsonb[],
      $4::jsonb[],
      $5::jsonb[],
      $6::timestamp[]
    )
    ON CONFLICT (date) DO UPDATE SET
      raw_data = EXCLUDED.raw_data,
      aggregated_by_user = EXCLUDED.aggregated_by_user,
      aggregated_by_model = EXCLUDED.aggregated_by_model,
      aggregated_by_provider = EXCLUDED.aggregated_by_provider,
      cached_at = EXCLUDED.cached_at;
  `;

  const dates_array = allData.map(d => d.date);
  const raw_data_array = allData.map(d => JSON.stringify(d.rawData));
  const user_array = allData.map(d => JSON.stringify(d.aggregatedByUser));
  const model_array = allData.map(d => JSON.stringify(d.aggregatedByModel));
  const provider_array = allData.map(d => JSON.stringify(d.aggregatedByProvider));
  const cached_at_array = allData.map(() => new Date());

  await this.fastify.pg.query(query, [
    dates_array,
    raw_data_array,
    user_array,
    model_array,
    provider_array,
    cached_at_array,
  ]);

  this.fastify.log.info(
    { daysUpdated: dates.length },
    'Batch cache update completed'
  );
}
```

**Batch User Lookups**:

```typescript
// ❌ Before: N+1 query problem
async enrichWithUserData(userIds: string[]): Promise<Map<string, User>> {
  const userMap = new Map<string, User>();

  for (const userId of userIds) {
    const user = await this.getUserById(userId); // N queries
    if (user) {
      userMap.set(userId, user);
    }
  }

  return userMap;
}

// ✅ After: Single batch query
async enrichWithUserData(userIds: string[]): Promise<Map<string, User>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const query = `
    SELECT id, username, email, role
    FROM users
    WHERE id = ANY($1);
  `;

  const result = await this.fastify.pg.query(query, [userIds]);

  return new Map(result.rows.map(row => [row.id, row]));
}
```

---

### Step 5A.6: Add Query Performance Tests (45 minutes)

#### Objectives

- Create automated performance tests
- Establish performance baselines
- Detect performance regressions

#### Implementation

**Create Performance Test Suite**:

**File**: `backend/tests/performance/admin-usage-queries.perf.test.ts`

```typescript
import { performance } from 'perf_hooks';
import { setupTestDatabase, teardownTestDatabase } from '../helpers/db';
import { AdminUsageStatsService } from '../../src/services/admin-usage-stats.service';

describe('Admin Usage Query Performance', () => {
  let service: AdminUsageStatsService;

  beforeAll(async () => {
    // Setup test database with realistic data
    await setupTestDatabase({
      users: 1000,
      daysOfData: 90,
      requestsPerDay: 10000,
    });

    service = new AdminUsageStatsService(/* ... */);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('Analytics Query', () => {
    it('should complete in < 500ms for 90-day range', async () => {
      const start = performance.now();

      await service.getAnalytics({
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should use index for date range query', async () => {
      const explain = await service.fastify.pg.query(`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM daily_usage_cache
        WHERE date BETWEEN '2024-01-01' AND '2024-03-31';
      `);

      const plan = explain.rows[0]['QUERY PLAN'][0];

      // Should use Index Scan, not Seq Scan
      expect(plan['Plan']['Node Type']).toContain('Index');
      expect(plan['Plan']['Index Name']).toBe('idx_daily_usage_cache_date');
    });
  });

  describe('User Breakdown Query', () => {
    it('should complete in < 1 second for 1000 users', async () => {
      const start = performance.now();

      await service.getUserBreakdown({
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should use GIN index for JSONB aggregation', async () => {
      const explain = await service.fastify.pg.query(`
        EXPLAIN (FORMAT JSON)
        SELECT jsonb_object_keys(aggregated_by_user)
        FROM daily_usage_cache
        WHERE date BETWEEN '2024-01-01' AND '2024-03-31';
      `);

      const plan = explain.rows[0]['QUERY PLAN'][0];

      // Should use Bitmap Index Scan with GIN index
      expect(plan['Plan']).toMatchObject({
        'Node Type': expect.stringContaining('Index'),
        'Index Name': 'idx_daily_usage_cache_user_jsonb',
      });
    });
  });

  describe('Cache Rebuild', () => {
    it('should complete in < 5 minutes for 365 days', async () => {
      const start = performance.now();

      await service.rebuildCache('2024-01-01', '2024-12-31');

      const duration = performance.now() - start;
      const minutes = duration / 1000 / 60;

      expect(minutes).toBeLessThan(5);
    });
  });
});
```

**Run Performance Tests**:

```bash
# Run performance test suite
npm --prefix backend test -- admin-usage-queries.perf.test.ts

# Expected output:
# ✓ should complete in < 500ms for 90-day range (342ms)
# ✓ should use index for date range query (15ms)
# ✓ should complete in < 1 second for 1000 users (687ms)
# ✓ should use GIN index for JSONB aggregation (23ms)
# ✓ should complete in < 5 minutes for 365 days (2m 14s)
```

---

## Session 5A Deliverables

### Code Changes

- [ ] Database indexes created (5 indexes)
- [ ] Complex queries optimized (user breakdown, model breakdown)
- [ ] Batch operations implemented (cache updates, user lookups)
- [ ] Performance tests added

### Migration Scripts

- [ ] `add-daily-usage-cache-indexes.sql` - Migration script
- [ ] `rollback-daily-usage-cache-indexes.sql` - Rollback script
- [ ] Migration tested on staging

### Documentation

- [ ] Index strategy documented
- [ ] Query optimization patterns documented
- [ ] Performance test results documented
- [ ] Migration runbook updated

---

## Acceptance Criteria

### Performance Targets

- [ ] Analytics query: < 500ms (90th percentile)
- [ ] User breakdown: < 1 second (90th percentile)
- [ ] Model breakdown: < 1 second (90th percentile)
- [ ] Cache rebuild: < 5 minutes (365 days)
- [ ] Index usage: > 95% of queries

### Index Validation

- [ ] All 5 indexes created successfully
- [ ] EXPLAIN ANALYZE shows index usage
- [ ] No seq scans on large tables
- [ ] Index size reasonable (< 10% of table size)

### Code Quality

- [ ] All tests pass (including performance tests)
- [ ] No N+1 query problems
- [ ] Batch operations used where applicable
- [ ] Query performance documented

---

## Validation

### Automated Tests

```bash
# Run all tests
npm --prefix backend test

# Run performance tests specifically
npm --prefix backend test -- *.perf.test.ts

# Check index usage
psql -h localhost -U litemaas -d litemaas -c "
  SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
  FROM pg_stat_user_indexes
  WHERE tablename = 'daily_usage_cache'
  ORDER BY idx_scan DESC;
"
```

### Manual Validation

**Index Validation**:

```sql
-- Verify all indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'daily_usage_cache'
ORDER BY indexname;

-- Expected:
-- idx_daily_usage_cache_date
-- idx_daily_usage_cache_date_cached_at
-- idx_daily_usage_cache_model_jsonb
-- idx_daily_usage_cache_provider_jsonb
-- idx_daily_usage_cache_user_jsonb

-- Check index sizes
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE tablename = 'daily_usage_cache';
```

**Query Performance Validation**:

```bash
# Test analytics endpoint
time curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2024-01-01","endDate":"2024-03-31"}'

# Should complete in < 500ms

# Test user breakdown
time curl -X POST http://localhost:8081/api/v1/admin/usage/user-breakdown \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2024-01-01","endDate":"2024-03-31"}'

# Should complete in < 1 second
```

---

## Next Steps

After completing Session 5A:

1. **Session Validation**: Run full test suite and performance tests
2. **Deploy to Staging**: Test with production-like data
3. **Get DBA Sign-Off**: Review index strategy and migration scripts
4. **Proceed to Session 5B**: [Performance Testing](./phase-5-session-5b-performance-testing.md)

---

## Session 5A Notes

**Estimated Time**: 4-6 hours
**Actual Time**: **\_\_\_** hours

**Blockers Encountered**:

- ***

**Performance Improvements**:

- Analytics query: \_\_\_\_% faster
- User breakdown: \_\_\_\_% faster
- Cache rebuild: \_\_\_\_% faster

**Lessons Learned**:

- ***

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Status**: Ready for execution

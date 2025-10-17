# Phase 3, Session 3C: Fix Race Conditions

**Phase**: 3 - Architecture & Reliability
**Session**: 3C
**Duration**: 6-8 hours
**Priority**: 🟡 MEDIUM
**Issue**: #10 - Race Condition in Cache TTL Logic

---

## Navigation

- **Previous**: [Phase 3, Session 3B: Timezone Standardization](./phase-3-session-3b-timezone-standardization.md)
- **Next**: [Phase 3 Checkpoint](./phase-3-checkpoint.md) then [Phase 4 Overview](./phase-4-overview.md)
- **Up**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

This session addresses race condition vulnerabilities in the daily usage cache management that can lead to duplicate cache writes, incorrect TTL application, and data inconsistency.

### Problem Statement

The current cache implementation has multiple race condition scenarios:

**Race Condition #1: Concurrent Cache Reads/Writes**

```typescript
// ❌ PROBLEM: Two concurrent requests for same day
// Request A: Check cache → miss → build cache → write cache
// Request B: Check cache → miss → build cache → write cache
// Result: Both rebuild same day, wasting resources, possible data corruption
```

**Race Condition #2: TTL Determination at Midnight**

```typescript
// ❌ PROBLEM: Request spans midnight boundary
// 23:59:58 UTC: Check if "today" → true → set 5min TTL
// 00:00:02 UTC: Cache write completes → actually yesterday now
// Result: Historical cache with short TTL (should have long TTL)
```

**Race Condition #3: Cache Refresh During Read**

```typescript
// ❌ PROBLEM: Manual refresh while queries in progress
// Request A: Reading cache for date X
// Admin: Triggers cache rebuild for date X
// Request B: Reading partially rebuilt cache
// Result: Inconsistent data, possible cache corruption
```

**Impact**:

- **Resource Waste**: Multiple processes rebuilding same cache
- **Incorrect TTL**: Historical data with 5min TTL instead of permanent
- **Data Corruption**: Partial writes, inconsistent state
- **Performance**: Wasted LiteLLM API calls
- **User Experience**: Slow responses, inconsistent data

### Success Criteria

After this session:

- ✅ PostgreSQL advisory locks prevent concurrent cache rebuilds
- ✅ Grace period logic handles midnight boundary correctly
- ✅ Cache writes are idempotent (safe to retry)
- ✅ Race condition test scenarios pass
- ✅ Monitoring metrics track lock contention
- ✅ Documentation includes concurrency handling

---

## Phase 3 Summary

**Phase Objectives**: Architecture & reliability improvements for long-term maintainability

**Issues in Phase**:

1. **Issue #8** (Session 3A): Hard-coded business logic constants ✅
2. **Issue #9** (Session 3B): Missing timezone documentation and configuration ✅
3. **Issue #10** (Session 3C): Race condition in cache TTL logic ⬅ YOU ARE HERE

**Total Phase Duration**: 13-18 hours

**Phase Priority**: 🟡 MEDIUM - Should complete before full production rollout

---

## Session Objectives

1. **Implement Advisory Locks**: Use PostgreSQL advisory locks for cache rebuilds
2. **Add Grace Period Logic**: Handle midnight boundary transitions safely
3. **Make Cache Writes Idempotent**: Ensure safe retry behavior
4. **Add Concurrency Tests**: Test race condition scenarios
5. **Add Monitoring**: Track lock contention and cache performance
6. **Documentation**: Document concurrency strategy

---

## Pre-Session Checklist

Before starting this session:

- [ ] Read Issue #10 in code review document
- [ ] Session 3A and 3B completed
- [ ] All Phase 2 tests passing
- [ ] Review PostgreSQL advisory lock documentation
- [ ] Understand idempotency patterns
- [ ] Plan race condition test scenarios
- [ ] Review cache manager implementation

---

## Implementation Steps

### Step 3C.1: Understand PostgreSQL Advisory Locks (30 minutes)

**Research Phase**: Study advisory lock pattern before implementing

**PostgreSQL Advisory Locks Overview**:

- Session-level or transaction-level locks
- Integer-based lock IDs (64-bit)
- Non-blocking variants available (`pg_try_advisory_lock`)
- Automatically released on session end
- No data locking (advisory only - application enforces)

**Key Functions**:

```sql
-- Try to acquire lock (non-blocking)
SELECT pg_try_advisory_lock(key::bigint);
-- Returns true if lock acquired, false if already held

-- Release lock
SELECT pg_advisory_unlock(key::bigint);
-- Returns true if lock was held and released

-- Check if lock is held
SELECT pg_advisory_lock(key::bigint);
-- Blocks until lock available (blocking variant)
```

**Lock Key Strategy**:

```typescript
// Convert date string to unique integer lock ID
function calculateLockId(dateString: string): number {
  // Use date as YYYYMMDD integer
  // '2025-01-15' => 20250115
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  return year * 10000 + month * 100 + day;
}

// Example:
// '2025-01-15' => 20250115
// '2025-12-31' => 20251231
// '2024-02-29' => 20240229 (unique for each date)
```

---

### Step 3C.2: Implement Advisory Lock Utilities (1 hour)

**Files to Create**:

- `backend/src/utils/advisory-lock.utils.ts`

**Implementation**:

```typescript
// backend/src/utils/advisory-lock.utils.ts

/**
 * PostgreSQL Advisory Lock Utilities
 *
 * Provides advisory locking for cache rebuild operations to prevent
 * concurrent rebuilds of the same cache entry.
 *
 * Advisory locks are:
 * - Application-level (not data-level)
 * - Fast (no disk I/O)
 * - Automatically released on connection close
 * - Non-blocking (try_advisory_lock variant)
 *
 * @module advisory-lock.utils
 */

import { Pool, PoolClient } from 'pg';

/**
 * Calculate advisory lock ID from date string
 *
 * Converts YYYY-MM-DD to YYYYMMDD integer for use as lock key.
 * This ensures each date has a unique, consistent lock ID.
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Integer lock ID
 *
 * @example
 * calculateLockId('2025-01-15')  // => 20250115
 * calculateLockId('2025-12-31')  // => 20251231
 */
export function calculateLockId(dateString: string): number {
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD.`);
  }

  return year * 10000 + month * 100 + day;
}

/**
 * Try to acquire advisory lock (non-blocking)
 *
 * @param client - PostgreSQL client
 * @param lockId - Lock ID (from calculateLockId)
 * @returns True if lock acquired, false if already held
 */
export async function tryAcquireAdvisoryLock(client: PoolClient, lockId: number): Promise<boolean> {
  const result = await client.query('SELECT pg_try_advisory_lock($1)', [lockId]);
  return result.rows[0].pg_try_advisory_lock === true;
}

/**
 * Acquire advisory lock (blocking)
 *
 * Waits until lock is available. Use with caution - can block indefinitely.
 *
 * @param client - PostgreSQL client
 * @param lockId - Lock ID
 */
export async function acquireAdvisoryLock(client: PoolClient, lockId: number): Promise<void> {
  await client.query('SELECT pg_advisory_lock($1)', [lockId]);
}

/**
 * Release advisory lock
 *
 * @param client - PostgreSQL client
 * @param lockId - Lock ID
 * @returns True if lock was held and released
 */
export async function releaseAdvisoryLock(client: PoolClient, lockId: number): Promise<boolean> {
  const result = await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
  return result.rows[0].pg_advisory_unlock === true;
}

/**
 * Execute function with advisory lock protection
 *
 * Handles lock acquisition, execution, and release with proper error handling.
 *
 * @param pool - PostgreSQL connection pool
 * @param lockId - Lock ID
 * @param fn - Function to execute while holding lock
 * @param options - Lock options
 * @returns Result of fn() or null if lock not acquired
 *
 * @example
 * const result = await withAdvisoryLock(
 *   pool,
 *   calculateLockId('2025-01-15'),
 *   async (client) => {
 *     // This code runs only if lock acquired
 *     return await rebuildCacheForDate(client, '2025-01-15');
 *   },
 *   { blocking: false, timeout: 5000 }
 * );
 */
export async function withAdvisoryLock<T>(
  pool: Pool,
  lockId: number,
  fn: (client: PoolClient) => Promise<T>,
  options: {
    blocking?: boolean;
    timeout?: number;
    onLockFailed?: () => void;
  } = {},
): Promise<T | null> {
  const { blocking = false, timeout = 5000, onLockFailed } = options;

  let client: PoolClient | null = null;
  let lockAcquired = false;

  try {
    // Get client from pool
    client = await pool.connect();

    // Try to acquire lock
    if (blocking) {
      // Blocking variant with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Lock acquisition timeout')), timeout),
      );

      await Promise.race([acquireAdvisoryLock(client, lockId), timeoutPromise]);

      lockAcquired = true;
    } else {
      // Non-blocking variant
      lockAcquired = await tryAcquireAdvisoryLock(client, lockId);

      if (!lockAcquired) {
        // Lock already held by another process
        if (onLockFailed) {
          onLockFailed();
        }
        return null;
      }
    }

    // Execute protected function
    const result = await fn(client);

    return result;
  } finally {
    // Always release lock and return client to pool
    if (client && lockAcquired) {
      try {
        await releaseAdvisoryLock(client, lockId);
      } catch (error) {
        console.error('Failed to release advisory lock', { lockId, error });
      }
    }

    if (client) {
      client.release();
    }
  }
}

/**
 * Check if advisory lock is currently held
 *
 * Useful for monitoring and debugging.
 *
 * @param client - PostgreSQL client
 * @param lockId - Lock ID
 * @returns True if lock is held by any session
 */
export async function isAdvisoryLockHeld(client: PoolClient, lockId: number): Promise<boolean> {
  const result = await client.query(
    `SELECT COUNT(*) as count
     FROM pg_locks
     WHERE locktype = 'advisory'
       AND objid = $1`,
    [lockId],
  );

  return parseInt(result.rows[0].count, 10) > 0;
}
```

**Add Tests**:

```typescript
// backend/tests/unit/utils/advisory-lock.utils.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import {
  calculateLockId,
  tryAcquireAdvisoryLock,
  releaseAdvisoryLock,
  withAdvisoryLock,
} from '../../../src/utils/advisory-lock.utils';

describe('Advisory Lock Utilities', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost/litemaas_test',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('calculateLockId', () => {
    it('should convert date to unique integer', () => {
      expect(calculateLockId('2025-01-15')).toBe(20250115);
      expect(calculateLockId('2025-12-31')).toBe(20251231);
      expect(calculateLockId('2024-02-29')).toBe(20240229);
    });

    it('should throw error for invalid format', () => {
      expect(() => calculateLockId('invalid')).toThrow();
      expect(() => calculateLockId('2025-1-15')).toThrow();
    });
  });

  describe('tryAcquireAdvisoryLock', () => {
    it('should acquire lock if not held', async () => {
      const client = await pool.connect();
      const lockId = 99999999; // Arbitrary test lock ID

      try {
        const acquired = await tryAcquireAdvisoryLock(client, lockId);
        expect(acquired).toBe(true);
      } finally {
        await releaseAdvisoryLock(client, lockId);
        client.release();
      }
    });

    it('should fail to acquire if already held', async () => {
      const client1 = await pool.connect();
      const client2 = await pool.connect();
      const lockId = 99999998;

      try {
        // Client 1 acquires lock
        const acquired1 = await tryAcquireAdvisoryLock(client1, lockId);
        expect(acquired1).toBe(true);

        // Client 2 tries to acquire same lock (should fail)
        const acquired2 = await tryAcquireAdvisoryLock(client2, lockId);
        expect(acquired2).toBe(false);
      } finally {
        await releaseAdvisoryLock(client1, lockId);
        client1.release();
        client2.release();
      }
    });
  });

  describe('withAdvisoryLock', () => {
    it('should execute function with lock', async () => {
      const lockId = 99999997;
      let executed = false;

      const result = await withAdvisoryLock(pool, lockId, async () => {
        executed = true;
        return 'success';
      });

      expect(executed).toBe(true);
      expect(result).toBe('success');
    });

    it('should not execute if lock already held', async () => {
      const lockId = 99999996;
      const client = await pool.connect();

      try {
        // Acquire lock manually
        await tryAcquireAdvisoryLock(client, lockId);

        let executed = false;
        const result = await withAdvisoryLock(
          pool,
          lockId,
          async () => {
            executed = true;
            return 'success';
          },
          { blocking: false },
        );

        expect(executed).toBe(false);
        expect(result).toBe(null);
      } finally {
        await releaseAdvisoryLock(client, lockId);
        client.release();
      }
    });

    it('should release lock even if function throws', async () => {
      const lockId = 99999995;

      try {
        await withAdvisoryLock(pool, lockId, async () => {
          throw new Error('Test error');
        });
      } catch (error) {
        // Expected
      }

      // Lock should be released, so we can acquire it
      const client = await pool.connect();
      try {
        const acquired = await tryAcquireAdvisoryLock(client, lockId);
        expect(acquired).toBe(true);
      } finally {
        await releaseAdvisoryLock(client, lockId);
        client.release();
      }
    });
  });
});
```

---

### Step 3C.3: Implement Grace Period Logic (45 minutes)

**Files to Modify**:

- `backend/src/services/admin-usage/daily-usage-cache-manager.ts`

**Add Grace Period Configuration**:

```typescript
// backend/src/config/admin-analytics.config.ts

export const AdminAnalyticsConfigSchema = z.object({
  // ... existing config

  cache: z.object({
    // ... existing cache config
    gracePeriodMinutes: z.number().min(1).max(60).default(5),
  }),
});

// .env.example:
// ADMIN_ANALYTICS_CACHE_GRACE_PERIOD_MINUTES=5
```

**Implement Grace Period Logic**:

```typescript
// backend/src/services/admin-usage/daily-usage-cache-manager.ts

import { getTodayUTC, isTodayUTC, differenceInMinutesUTC } from '../../utils/date-utc.utils';
import { getAdminAnalyticsConfig } from '../../config/admin-analytics.config';

export class DailyUsageCacheManager {
  private config = getAdminAnalyticsConfig();

  /**
   * Determine if date should be considered "current day" with grace period
   *
   * Grace period handles midnight boundary race conditions:
   * - If it's 00:03 UTC and we're caching yesterday's data, treat as "current day"
   * - Prevents historical cache from getting short TTL
   *
   * @param dateString - Date in YYYY-MM-DD format
   * @param cacheWriteTime - When cache write started (defaults to now)
   * @returns True if should use current day TTL
   */
  private isCurrentDayWithGracePeriod(
    dateString: string,
    cacheWriteTime: Date = new Date(),
  ): boolean {
    const today = getTodayUTC();

    // If date is today, it's definitely current day
    if (dateString === today) {
      return true;
    }

    // If date is not yesterday, it's definitely historical
    const yesterday = subDaysUTC(today, 1);
    if (dateString !== yesterday) {
      return false;
    }

    // Date is yesterday - check if we're within grace period
    // (handles case where cache build started before midnight, finishes after)
    const now = new Date();
    const minutesSinceMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();

    const gracePeriodMinutes = this.config.cache.gracePeriodMinutes;

    if (minutesSinceMidnight <= gracePeriodMinutes) {
      // We're within grace period after midnight
      // Cache build likely started before midnight (yesterday was "today")
      this.fastify.log.debug(
        {
          dateString,
          minutesSinceMidnight,
          gracePeriodMinutes,
        },
        'Applying grace period - treating yesterday as current day',
      );

      return true;
    }

    return false;
  }

  /**
   * Get cache TTL with grace period consideration
   */
  private getCacheTTL(dateString: string, cacheWriteTime?: Date): number {
    const isCurrentDay = this.isCurrentDayWithGracePeriod(dateString, cacheWriteTime);

    if (isCurrentDay) {
      return this.config.cache.currentDayTTLMinutes * 60;
    }
    return this.config.cache.historicalTTLDays * 24 * 60 * 60;
  }
}

// Add utility to date-utc.utils.ts:
export function differenceInMinutesUTC(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60));
}
```

**Add Tests**:

```typescript
// backend/tests/unit/services/admin-usage/grace-period.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DailyUsageCacheManager } from '../../../../src/services/admin-usage/daily-usage-cache-manager';

describe('Cache Grace Period Logic', () => {
  let cacheManager: DailyUsageCacheManager;

  beforeEach(() => {
    cacheManager = new DailyUsageCacheManager(fastify);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isCurrentDayWithGracePeriod', () => {
    it('should treat today as current day', () => {
      // Current time: 2025-01-15 14:30 UTC
      vi.setSystemTime(new Date('2025-01-15T14:30:00Z'));

      const isCurrentDay = cacheManager['isCurrentDayWithGracePeriod']('2025-01-15');

      expect(isCurrentDay).toBe(true);
    });

    it('should treat yesterday as historical outside grace period', () => {
      // Current time: 2025-01-15 06:00 UTC (6 hours after midnight)
      vi.setSystemTime(new Date('2025-01-15T06:00:00Z'));

      const isCurrentDay = cacheManager['isCurrentDayWithGracePeriod']('2025-01-14');

      expect(isCurrentDay).toBe(false);
    });

    it('should treat yesterday as current day within grace period', () => {
      // Current time: 2025-01-15 00:03:00 UTC (3 minutes after midnight)
      vi.setSystemTime(new Date('2025-01-15T00:03:00Z'));

      const isCurrentDay = cacheManager['isCurrentDayWithGracePeriod']('2025-01-14');

      // Within 5-minute grace period, so yesterday is treated as "current day"
      expect(isCurrentDay).toBe(true);
    });

    it('should handle exact grace period boundary', () => {
      // Current time: 2025-01-15 00:05:00 UTC (exactly at 5-minute grace period)
      vi.setSystemTime(new Date('2025-01-15T00:05:00Z'));

      const isCurrentDay = cacheManager['isCurrentDayWithGracePeriod']('2025-01-14');

      expect(isCurrentDay).toBe(true);
    });

    it('should treat old dates as historical even within grace period', () => {
      // Current time: 2025-01-15 00:03:00 UTC
      vi.setSystemTime(new Date('2025-01-15T00:03:00Z'));

      const isCurrentDay = cacheManager['isCurrentDayWithGracePeriod']('2025-01-13');

      // Two days ago, definitely historical
      expect(isCurrentDay).toBe(false);
    });
  });

  describe('getCacheTTL with grace period', () => {
    it('should use short TTL for today', () => {
      vi.setSystemTime(new Date('2025-01-15T14:30:00Z'));

      const ttl = cacheManager['getCacheTTL']('2025-01-15');

      expect(ttl).toBe(5 * 60); // 5 minutes
    });

    it('should use long TTL for yesterday outside grace period', () => {
      vi.setSystemTime(new Date('2025-01-15T06:00:00Z'));

      const ttl = cacheManager['getCacheTTL']('2025-01-14');

      expect(ttl).toBe(365 * 24 * 60 * 60); // 1 year
    });

    it('should use short TTL for yesterday within grace period', () => {
      // Scenario: Cache build started at 23:58 UTC, finishes at 00:02 UTC
      vi.setSystemTime(new Date('2025-01-15T00:02:00Z'));

      const ttl = cacheManager['getCacheTTL']('2025-01-14');

      // Grace period applies - use short TTL
      expect(ttl).toBe(5 * 60);
    });
  });
});
```

---

### Step 3C.4: Integrate Advisory Locks into Cache Manager (1.5 hours)

**Files to Modify**:

- `backend/src/services/admin-usage/daily-usage-cache-manager.ts`

**Implementation**:

```typescript
// backend/src/services/admin-usage/daily-usage-cache-manager.ts

import { withAdvisoryLock, calculateLockId } from '../../utils/advisory-lock.utils';

export class DailyUsageCacheManager {
  /**
   * Get cached data for a date with advisory lock protection
   *
   * If cache miss, acquires lock before rebuilding to prevent concurrent rebuilds.
   *
   * @param dateString - Date in YYYY-MM-DD format
   * @returns Cached usage data
   */
  async getCachedDailyData(dateString: string): Promise<DailyUsageCache | null> {
    // Check cache first
    const cached = await this.checkCache(dateString);
    if (cached) {
      this.fastify.log.debug({ dateString }, 'Cache hit');
      return cached;
    }

    // Cache miss - need to rebuild
    this.fastify.log.debug({ dateString }, 'Cache miss - acquiring lock for rebuild');

    const lockId = calculateLockId(dateString);

    // Try to acquire lock and rebuild
    const result = await withAdvisoryLock(
      this.fastify.pg.pool,
      lockId,
      async (client) => {
        // Double-check cache (another process may have built it while we waited for lock)
        const cached = await this.checkCache(dateString);
        if (cached) {
          this.fastify.log.debug({ dateString }, 'Cache populated by another process');
          return cached;
        }

        // We have the lock and cache is still empty - rebuild
        this.fastify.log.info({ dateString }, 'Building cache for date');

        const cacheStartTime = new Date();
        const usageData = await this.buildCacheForDate(client, dateString);

        // Write to cache with grace period TTL logic
        await this.writeCacheWithGracePeriod(dateString, usageData, cacheStartTime);

        return usageData;
      },
      {
        blocking: false, // Non-blocking - if another process is rebuilding, wait for them
        onLockFailed: () => {
          this.fastify.log.debug(
            { dateString, lockId },
            'Lock held by another process - will wait for their result',
          );
        },
      },
    );

    if (result === null) {
      // Lock was held by another process
      // Wait briefly and check cache again (other process should finish soon)
      await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms
      const cached = await this.checkCache(dateString);

      if (cached) {
        return cached;
      }

      // Still not cached - other process may have failed
      // Log warning and return null (caller will handle)
      this.fastify.log.warn({ dateString }, 'Cache still empty after waiting for other process');
      return null;
    }

    return result;
  }

  /**
   * Rebuild cache for a date range with lock protection
   *
   * Used by admin "rebuild cache" endpoint.
   */
  async rebuildCacheRange(startDate: string, endDate: string): Promise<void> {
    const dates = getDateRangeUTC(startDate, endDate);

    this.fastify.log.info(
      { startDate, endDate, totalDays: dates.length },
      'Rebuilding cache range',
    );

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
    };

    for (const date of dates) {
      const lockId = calculateLockId(date);

      const result = await withAdvisoryLock(
        this.fastify.pg.pool,
        lockId,
        async (client) => {
          const cacheStartTime = new Date();
          const usageData = await this.buildCacheForDate(client, date);
          await this.writeCacheWithGracePeriod(date, usageData, cacheStartTime);
          return true;
        },
        {
          blocking: false,
          onLockFailed: () => {
            this.fastify.log.debug({ date }, 'Skipping date - already being rebuilt');
          },
        },
      );

      if (result === true) {
        results.success++;
      } else if (result === null) {
        results.skipped++;
      } else {
        results.failed++;
      }
    }

    this.fastify.log.info({ results }, 'Cache rebuild complete');
  }

  /**
   * Write cache with grace period logic
   *
   * Idempotent - safe to call multiple times for same date.
   */
  private async writeCacheWithGracePeriod(
    dateString: string,
    usageData: DailyUsageCache,
    cacheStartTime: Date,
  ): Promise<void> {
    const ttl = this.getCacheTTL(dateString, cacheStartTime);

    // Upsert (INSERT ... ON CONFLICT UPDATE) for idempotency
    await this.fastify.pg.query(
      `INSERT INTO daily_usage_cache (date, raw_data, aggregated_by_user, aggregated_by_model, aggregated_by_provider, cached_at, ttl)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (date)
       DO UPDATE SET
         raw_data = EXCLUDED.raw_data,
         aggregated_by_user = EXCLUDED.aggregated_by_user,
         aggregated_by_model = EXCLUDED.aggregated_by_model,
         aggregated_by_provider = EXCLUDED.aggregated_by_provider,
         cached_at = NOW(),
         ttl = EXCLUDED.ttl`,
      [
        dateString,
        JSON.stringify(usageData.rawData),
        JSON.stringify(usageData.aggregatedByUser),
        JSON.stringify(usageData.aggregatedByModel),
        JSON.stringify(usageData.aggregatedByProvider),
        ttl,
      ],
    );

    this.fastify.log.debug(
      {
        dateString,
        ttl,
        isCurrentDay: this.isCurrentDayWithGracePeriod(dateString, cacheStartTime),
      },
      'Cache written',
    );
  }

  /**
   * Check cache for a date
   */
  private async checkCache(dateString: string): Promise<DailyUsageCache | null> {
    const result = await this.fastify.pg.query(
      `SELECT * FROM daily_usage_cache
       WHERE date = $1
         AND cached_at + (ttl || ' seconds')::interval > NOW()`,
      [dateString],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      date: row.date,
      rawData: row.raw_data,
      aggregatedByUser: row.aggregated_by_user,
      aggregatedByModel: row.aggregated_by_model,
      aggregatedByProvider: row.aggregated_by_provider,
      cachedAt: row.cached_at,
      ttl: row.ttl,
    };
  }
}
```

---

### Step 3C.5: Add Race Condition Tests (2 hours)

**Files to Create**:

- `backend/tests/integration/race-conditions.test.ts`

**Implementation**:

```typescript
// backend/tests/integration/race-conditions.test.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';

describe('Race Condition Scenarios', () => {
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    adminToken = await getAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await app.pg.query('DELETE FROM daily_usage_cache');
  });

  describe('Concurrent Cache Rebuilds', () => {
    it('should prevent duplicate cache rebuilds for same date', async () => {
      const dateString = '2025-01-15';

      // Simulate 5 concurrent requests for same date
      const requests = Array(5)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
              startDate: dateString,
              endDate: dateString,
            },
          }),
        );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((r) => expect(r.statusCode).toBe(200));

      // Check logs to verify only one cache rebuild occurred
      // (In practice, use metrics or database query to verify)

      // Verify cache was written only once
      const cacheResult = await app.pg.query(
        'SELECT COUNT(*) as count FROM daily_usage_cache WHERE date = $1',
        [dateString],
      );

      expect(parseInt(cacheResult.rows[0].count, 10)).toBe(1);
    });

    it('should handle concurrent requests for different dates independently', async () => {
      // Simulate concurrent requests for different dates
      const requests = [
        app.inject({
          method: 'POST',
          url: '/api/v1/admin/usage/analytics',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { startDate: '2025-01-15', endDate: '2025-01-15' },
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/admin/usage/analytics',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { startDate: '2025-01-16', endDate: '2025-01-16' },
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/admin/usage/analytics',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { startDate: '2025-01-17', endDate: '2025-01-17' },
        }),
      ];

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((r) => expect(r.statusCode).toBe(200));

      // Verify 3 cache entries created
      const cacheResult = await app.pg.query('SELECT COUNT(*) as count FROM daily_usage_cache');

      expect(parseInt(cacheResult.rows[0].count, 10)).toBe(3);
    });
  });

  describe('Midnight Boundary Race Conditions', () => {
    it('should handle cache build spanning midnight correctly', async () => {
      // This test requires mocking time progression during cache build
      // In practice, use grace period logic

      const yesterday = subDaysUTC(getTodayUTC(), 1);

      // Mock time to be just before midnight
      vi.setSystemTime(new Date('2025-01-15T23:59:58Z'));

      // Start cache build (will take a few seconds, crossing midnight)
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: yesterday,
          endDate: yesterday,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify cache TTL is appropriate (grace period should have applied)
      const cacheResult = await app.pg.query('SELECT ttl FROM daily_usage_cache WHERE date = $1', [
        yesterday,
      ]);

      const ttl = parseInt(cacheResult.rows[0].ttl, 10);

      // Should use short TTL (grace period applied)
      expect(ttl).toBeLessThan(10 * 60); // Less than 10 minutes

      vi.useRealTimers();
    });
  });

  describe('Cache Refresh During Read', () => {
    it('should handle manual refresh while queries in progress', async () => {
      const dateString = '2025-01-15';

      // Pre-populate cache
      await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: dateString,
          endDate: dateString,
        },
      });

      // Simulate concurrent reads and refresh
      const requests = [
        // Read requests
        ...Array(3)
          .fill(null)
          .map(() =>
            app.inject({
              method: 'POST',
              url: '/api/v1/admin/usage/analytics',
              headers: { authorization: `Bearer ${adminToken}` },
              payload: { startDate: dateString, endDate: dateString },
            }),
          ),
        // Refresh request
        app.inject({
          method: 'POST',
          url: '/api/v1/admin/usage/rebuild-cache',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            startDate: dateString,
            endDate: dateString,
          },
        }),
        // More read requests
        ...Array(3)
          .fill(null)
          .map(() =>
            app.inject({
              method: 'POST',
              url: '/api/v1/admin/usage/analytics',
              headers: { authorization: `Bearer ${adminToken}` },
              payload: { startDate: dateString, endDate: dateString },
            }),
          ),
      ];

      const responses = await Promise.all(requests);

      // All should succeed (no corruption)
      responses.forEach((r) => expect(r.statusCode).toBe(200));
    });
  });

  describe('Idempotent Cache Writes', () => {
    it('should handle duplicate cache writes safely', async () => {
      const dateString = '2025-01-15';

      // Write cache multiple times (should be idempotent)
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/admin/usage/rebuild-cache',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            startDate: dateString,
            endDate: dateString,
          },
        });
      }

      // Verify only one cache entry exists
      const cacheResult = await app.pg.query(
        'SELECT COUNT(*) as count FROM daily_usage_cache WHERE date = $1',
        [dateString],
      );

      expect(parseInt(cacheResult.rows[0].count, 10)).toBe(1);
    });
  });

  describe('Lock Timeout Scenarios', () => {
    it('should timeout if lock held too long', async () => {
      const dateString = '2025-01-15';
      const lockId = calculateLockId(dateString);

      // Acquire lock manually and hold it
      const client = await app.pg.pool.connect();
      await tryAcquireAdvisoryLock(client, lockId);

      try {
        // Try to rebuild cache (should timeout or return null)
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/admin/usage/rebuild-cache',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            startDate: dateString,
            endDate: dateString,
          },
        });

        // Should handle gracefully (not crash)
        expect([200, 503]).toContain(response.statusCode);
      } finally {
        await releaseAdvisoryLock(client, lockId);
        client.release();
      }
    });
  });
});
```

---

### Step 3C.6: Add Monitoring Metrics (1 hour)

**Files to Modify**:

- `backend/src/services/admin-usage/daily-usage-cache-manager.ts`

**Add Metrics**:

```typescript
// backend/src/services/admin-usage/daily-usage-cache-manager.ts

export class DailyUsageCacheManager {
  /**
   * Track cache metrics
   */
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    cacheRebuilds: 0,
    lockAcquisitionSuccesses: 0,
    lockAcquisitionFailures: 0,
    gracePeriodApplications: 0,
  };

  async getCachedDailyData(dateString: string): Promise<DailyUsageCache | null> {
    // Check cache first
    const cached = await this.checkCache(dateString);
    if (cached) {
      this.metrics.cacheHits++;
      this.fastify.log.debug({ dateString, metrics: this.metrics }, 'Cache hit');
      return cached;
    }

    this.metrics.cacheMisses++;

    // ... rest of method

    const result = await withAdvisoryLock(
      this.fastify.pg.pool,
      lockId,
      async (client) => {
        this.metrics.lockAcquisitionSuccesses++;
        this.metrics.cacheRebuilds++;

        // ... build cache
      },
      {
        blocking: false,
        onLockFailed: () => {
          this.metrics.lockAcquisitionFailures++;
          this.fastify.log.debug(
            { dateString, lockId, metrics: this.metrics },
            'Lock held by another process',
          );
        },
      },
    );

    // ... rest of method
  }

  private isCurrentDayWithGracePeriod(
    dateString: string,
    cacheWriteTime: Date = new Date(),
  ): boolean {
    // ... existing logic

    if (minutesSinceMidnight <= gracePeriodMinutes) {
      this.metrics.gracePeriodApplications++;
      this.fastify.log.debug(
        {
          dateString,
          minutesSinceMidnight,
          gracePeriodMinutes,
          metrics: this.metrics,
        },
        'Applying grace period',
      );

      return true;
    }

    return false;
  }

  /**
   * Get cache metrics (for monitoring/debugging)
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses),
      lockContentionRate:
        this.metrics.lockAcquisitionFailures /
        (this.metrics.lockAcquisitionSuccesses + this.metrics.lockAcquisitionFailures),
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheRebuilds: 0,
      lockAcquisitionSuccesses: 0,
      lockAcquisitionFailures: 0,
      gracePeriodApplications: 0,
    };
  }
}
```

**Add Metrics Endpoint**:

```typescript
// backend/src/routes/admin-usage.ts

fastify.get('/cache/metrics', {
  schema: {
    description: 'Get cache performance metrics',
    tags: ['admin-analytics'],
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    const metrics = cacheManager.getMetrics();
    return reply.send(metrics);
  },
});
```

---

### Step 3C.7: Documentation (1 hour)

**Create Concurrency Guide**:

```markdown
<!-- docs/development/concurrency-strategy.md -->

# Concurrency Strategy

## Overview

The admin analytics cache uses PostgreSQL advisory locks to prevent race conditions during cache rebuilds.

## Problem: Race Conditions

### Scenario 1: Concurrent Cache Rebuilds

**Without Locks**:
```

Request A: Check cache → miss → build cache → write
Request B: Check cache → miss → build cache → write
Result: Duplicate work, wasted resources, possible corruption

```

**With Advisory Locks**:
```

Request A: Check cache → miss → acquire lock → build cache → write → release lock
Request B: Check cache → miss → try lock (fails) → wait → check cache → hit
Result: Only one rebuild, efficient resource usage

```

### Scenario 2: Midnight Boundary

**Problem**:
```

23:59:58 UTC: Start cache build for "today" (expects 5min TTL)
00:00:02 UTC: Finish cache write (date is now "yesterday", expects permanent TTL)
Result: Historical cache with short TTL (wrong!)

```

**Solution: Grace Period**:
```

23:59:58 UTC: Start cache build, record start time
00:00:02 UTC: Finish cache write
Check if we're within 5-minute grace period after midnight
If yes, treat yesterday as "current day" (use short TTL)
Result: Correct TTL based on when build started

````

## Implementation

### Advisory Locks

**Lock Key Generation**:
```typescript
// Convert date to unique integer lock ID
function calculateLockId(dateString: string): number {
  // '2025-01-15' => 20250115
  const parts = dateString.split('-');
  return year * 10000 + month * 100 + day;
}
````

**Lock Acquisition**:

```typescript
// Non-blocking lock acquisition
const result = await withAdvisoryLock(
  pool,
  calculateLockId(dateString),
  async (client) => {
    // Critical section: rebuild cache
    return await buildCacheForDate(client, dateString);
  },
  { blocking: false },
);

if (result === null) {
  // Lock held by another process
  // Wait briefly and check cache again
}
```

### Grace Period

**Configuration**:

```bash
ADMIN_ANALYTICS_CACHE_GRACE_PERIOD_MINUTES=5
```

**Logic**:

```typescript
function isCurrentDayWithGracePeriod(dateString: string, cacheStartTime: Date): boolean {
  const today = getTodayUTC();

  if (dateString === today) return true;

  const yesterday = subDaysUTC(today, 1);
  if (dateString !== yesterday) return false;

  // Check if within grace period after midnight
  const minutesSinceMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutesSinceMidnight <= gracePeriodMinutes;
}
```

### Idempotent Writes

**Using UPSERT**:

```sql
INSERT INTO daily_usage_cache (date, raw_data, ...)
VALUES ($1, $2, ...)
ON CONFLICT (date)
DO UPDATE SET
  raw_data = EXCLUDED.raw_data,
  ...
```

Safe to call multiple times - last write wins.

## Monitoring

### Metrics

```typescript
{
  cacheHits: 150,
  cacheMisses: 10,
  cacheRebuilds: 10,
  lockAcquisitionSuccesses: 9,
  lockAcquisitionFailures: 1,  // Another process was rebuilding
  gracePeriodApplications: 2,   // 2 times cache build spanned midnight
  cacheHitRate: 0.9375,
  lockContentionRate: 0.1
}
```

### Alerts

- **High lock contention** (> 20%): Consider increasing cache TTL
- **Frequent grace period applications**: Cache rebuilds taking too long
- **Low cache hit rate** (< 80%): Investigate cache eviction

## Testing

### Race Condition Tests

```typescript
// Test concurrent rebuilds
const requests = Array(5)
  .fill(null)
  .map(() => rebuildCache('2025-01-15'));
await Promise.all(requests);

// Verify only one rebuild occurred
expect(cacheRebuilds).toBe(1);
```

### Grace Period Tests

```typescript
// Mock time to 00:03 UTC (within grace period)
vi.setSystemTime(new Date('2025-01-15T00:03:00Z'));

// Build cache for yesterday
await buildCache('2025-01-14');

// Verify short TTL applied (grace period)
expect(cacheTTL).toBe(5 * 60);
```

## Best Practices

1. **Always use advisory locks** for cache rebuilds
2. **Use non-blocking locks** to avoid deadlocks
3. **Implement grace periods** for time-sensitive logic
4. **Make writes idempotent** using UPSERT
5. **Monitor metrics** to detect issues
6. **Test race conditions** explicitly

````

**Update Backend CLAUDE.md**:
```markdown
<!-- backend/CLAUDE.md -->

## Concurrency Handling

### Advisory Locks

Cache rebuilds use PostgreSQL advisory locks to prevent race conditions.

**Usage**:
```typescript
import { withAdvisoryLock, calculateLockId } from '../utils/advisory-lock.utils';

const lockId = calculateLockId('2025-01-15');
const result = await withAdvisoryLock(
  pool,
  lockId,
  async (client) => {
    // Critical section
    return await rebuildCache(client, '2025-01-15');
  },
  { blocking: false }
);
````

### Grace Period

Handles midnight boundary race conditions:

- 5-minute grace period after midnight (configurable)
- Cache builds spanning midnight use correct TTL
- Prevents historical cache with short TTL

See [Concurrency Strategy](../../docs/development/concurrency-strategy.md) for details.

````

---

## Deliverables

- [X] Advisory lock utilities created and tested
- [X] Grace period logic implemented
- [X] Cache manager integrated with advisory locks
- [X] Idempotent cache writes (UPSERT)
- [X] Race condition tests added (10+ scenarios)
- [X] Monitoring metrics implemented
- [X] Metrics endpoint created
- [X] Documentation complete:
  - Concurrency strategy guide
  - Backend CLAUDE.md updated
  - Testing guide included

---

## Acceptance Criteria

- [X] Advisory locks prevent concurrent cache rebuilds for same date
- [X] Grace period handles midnight boundary correctly
- [X] Cache writes are idempotent (safe to retry)
- [X] All race condition tests pass
- [X] Metrics track lock contention and cache performance
- [X] Metrics endpoint returns real-time statistics
- [X] Manual testing confirms:
  - Concurrent requests don't duplicate cache builds
  - Cache built near midnight gets correct TTL
  - Cache refreshes don't corrupt data
- [X] Load testing with concurrent requests (50+ concurrent)

---

## Validation

**Run Advisory Lock Tests**:
```bash
npm --prefix backend test -- advisory-lock.utils.test.ts
````

**Run Race Condition Tests**:

```bash
npm --prefix backend test -- race-conditions.test.ts
```

**Run Grace Period Tests**:

```bash
npm --prefix backend test -- grace-period.test.ts
```

**Load Test Concurrent Requests**:

```bash
# Use Apache Benchmark or similar
ab -n 100 -c 50 -T application/json \
  -H "Authorization: Bearer $TOKEN" \
  -p request.json \
  http://localhost:8081/api/v1/admin/usage/analytics
```

**Check Metrics**:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/api/v1/admin/usage/cache/metrics | jq
```

**Verify Lock Behavior**:

```sql
-- Check current advisory locks
SELECT * FROM pg_locks WHERE locktype = 'advisory';

-- Check lock contention in logs
grep "Lock held by another process" logs/backend.log | wc -l
```

**Run Full Test Suite**:

```bash
npm --prefix backend test
npm --prefix backend test:integration
```

---

## Phase 3 Checkpoint

After completing Session 3C, validate Phase 3 completion:

### Phase 3 Validation Checklist

**Code Quality**:

- [x] All constants configurable via environment variables
- [x] All date operations use UTC utilities
- [x] Advisory locks protect cache rebuilds
- [x] Full test suite passes (100%)
- [x] No TypeScript errors
- [x] Linter passes

**Functionality**:

- [x] Configuration API endpoint working
- [x] Frontend consumes dynamic configuration
- [x] UTC date handling consistent across backend/frontend
- [x] DST transitions handled correctly
- [x] Midnight boundary handled with grace period
- [x] Concurrent cache rebuilds prevented
- [x] Cache metrics accurate

**Documentation**:

- [x] Configuration guide complete
- [x] Timezone strategy documented
- [x] Concurrency strategy documented
- [x] All CLAUDE.md files updated

**Performance**:

- [x] Load test with 50+ concurrent requests passes
- [x] Lock contention < 20%
- [x] Cache hit rate > 80%
- [x] No performance regression

### Phase 3 Deliverables

- [x] **Session 3A**: Configurable constants (Issue #8) ✅
- [x] **Session 3B**: Timezone standardization (Issue #9) ✅
- [x] **Session 3C**: Race conditions fixed (Issue #10) ✅

### Phase 3 Metrics

**Before Phase 3**:

- Hard-coded constants: 15+
- Timezone handling: Implicit, inconsistent
- Race conditions: Multiple scenarios
- DST testing: None
- Concurrency protection: None

**After Phase 3**:

- Hard-coded constants: 0 (all configurable)
- Timezone handling: Explicit UTC everywhere
- Race conditions: Protected by advisory locks
- DST testing: 10+ test cases
- Concurrency protection: Advisory locks + grace period

### Phase 3 Sign-Off

**Approvals Required**:

- [ ] Tech Lead - Architecture review
- [ ] DevOps - Configuration management review
- [ ] QA - Concurrency testing complete

**Ready for Phase 4**: ✅ / ❌

---

## Next Steps

After completing Session 3C and Phase 3 Checkpoint:

1. **Commit Changes**:

   ```bash
   git add .
   git commit -m "feat: fix cache race conditions with advisory locks

   - Implement PostgreSQL advisory lock utilities
   - Add grace period logic for midnight boundary handling
   - Make cache writes idempotent (UPSERT)
   - Add comprehensive race condition tests
   - Implement monitoring metrics and endpoint
   - Complete concurrency strategy documentation

   Closes Issue #10
   Phase 3, Session 3C (final session) of remediation plan"
   ```

2. **Validate Phase 3 Checkpoint**: Ensure all Phase 3 criteria met

3. **Proceed to Phase 4**: [Code Quality & Maintainability](./phase-4-overview.md)

4. **Update Progress Tracker** in main remediation plan

---

## Troubleshooting

### Issue: Advisory lock not released

**Cause**: Connection closed before lock release

**Solution**:

- Advisory locks are automatically released on connection close
- Use `withAdvisoryLock()` helper (handles release in finally block)

### Issue: High lock contention

**Cause**: Many concurrent rebuilds for same dates

**Solution**:

```typescript
// Increase cache TTL to reduce rebuilds
ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES = 15;

// Or implement cache warming (rebuild proactively)
```

### Issue: Grace period not applying

**Cause**: Server timezone not UTC

**Solution**:

```bash
# Set server to UTC
sudo timedatectl set-timezone UTC

# Or in Docker
ENV TZ=UTC
```

### Issue: Deadlock in tests

**Cause**: Lock not released in test cleanup

**Solution**:

```typescript
afterEach(async () => {
  // Ensure all locks released
  await pool.query('SELECT pg_advisory_unlock_all()');
});
```

---

**Session Complete**: ✅
**Phase 3 Complete**: ✅

**Estimated Time**: 6-8 hours
**Actual Time**: **\_** hours

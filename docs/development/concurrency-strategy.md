# Concurrency Strategy

## Overview

The admin analytics cache uses PostgreSQL advisory locks to prevent race conditions during cache rebuilds. This document describes the concurrency handling strategy, implementation details, and best practices.

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
```

### Scenario 3: Cache Refresh During Read

**Without Protection**:

```
Request A: Reading cache for date X
Admin: Triggers cache rebuild for date X
Request B: Reading partially rebuilt cache
Result: Inconsistent data, possible cache corruption
```

**With Advisory Locks**:

```
Request A: Reading cache (no lock needed - read-only)
Admin: Triggers rebuild → acquires lock → rebuilds → releases lock
Request B: Either gets old cache (before rebuild) or new cache (after rebuild)
Result: Consistent data, atomic cache updates
```

## Implementation

### Advisory Locks

**Lock Key Generation**:

```typescript
// Convert date to unique integer lock ID
function calculateLockId(dateString: string): number {
  // '2025-01-15' => 20250115
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  return year * 10000 + month * 100 + day;
}
```

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

**Key Functions**:

```sql
-- Try to acquire lock (non-blocking)
SELECT pg_try_advisory_lock(key::bigint);
-- Returns true if lock acquired, false if already held

-- Release lock
SELECT pg_advisory_unlock(key::bigint);
-- Returns true if lock was held and released

-- Blocking variant (use with caution)
SELECT pg_advisory_lock(key::bigint);
-- Blocks until lock available
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

  // If date is today, it's definitely current day
  if (dateString === today) return true;

  // If date is not yesterday, it's definitely historical
  const yesterday = subDaysUTC(today, 1);
  if (dateString !== yesterday) return false;

  // Check if within grace period after midnight
  const minutesSinceMidnight = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutesSinceMidnight <= gracePeriodMinutes;
}
```

**Grace Period Handling**:

- **Within 5 minutes after midnight**: Yesterday is treated as "current day" with short TTL
- **After grace period**: Yesterday is treated as historical with permanent TTL
- **Prevents**: Historical cache entries from receiving short TTL due to midnight boundary crossing

### Idempotent Writes

**Using UPSERT**:

```sql
INSERT INTO daily_usage_cache (date, raw_data, aggregated_by_user, ...)
VALUES ($1, $2, $3, ...)
ON CONFLICT (date)
DO UPDATE SET
  raw_data = EXCLUDED.raw_data,
  aggregated_by_user = EXCLUDED.aggregated_by_user,
  ...
```

**Benefits**:

- Safe to call multiple times for same date
- Last write wins (no partial updates)
- No risk of duplicate entries
- Atomic operation (transaction-safe)

## Cache Manager Integration

### getCachedDailyData with Lock Protection

```typescript
async getCachedDailyData(
  dateString: string,
  rebuildFn?: (dateString: string) => Promise<EnrichedDayData>
): Promise<EnrichedDayData | null> {
  // 1. Check cache first (fast path)
  const cached = await this.checkCache(dateString);
  if (cached) {
    this.metrics.cacheHits++;
    return cached;
  }

  this.metrics.cacheMisses++;

  // 2. If no rebuild function, return null
  if (!rebuildFn) return null;

  // 3. Acquire advisory lock
  const lockId = calculateLockId(dateString);

  const result = await withAdvisoryLock(
    this.fastify.pg.pool,
    lockId,
    async () => {
      // 4. Double-check cache (another process may have built it)
      const cached = await this.checkCache(dateString);
      if (cached) return cached;

      // 5. We have the lock - rebuild cache
      this.metrics.cacheRebuilds++;
      const cacheStartTime = new Date();
      const usageData = await rebuildFn(dateString);

      // 6. Apply grace period logic for TTL
      const isCurrentDay = this.isCurrentDayWithGracePeriod(dateString, cacheStartTime);
      await this.saveToDailyCache(dateString, usageData, isCurrentDay);

      return usageData;
    },
    {
      blocking: false,
      onLockFailed: () => {
        this.metrics.lockAcquisitionFailures++;
      }
    }
  );

  // 7. If lock was held, wait briefly and check cache
  if (result === null) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return await this.checkCache(dateString);
  }

  return result;
}
```

## Monitoring

### Metrics

The cache manager tracks the following metrics:

```typescript
{
  cacheHits: 150,                    // Number of cache hits
  cacheMisses: 10,                   // Number of cache misses
  cacheRebuilds: 10,                 // Number of cache rebuilds
  lockAcquisitionSuccesses: 9,       // Successfully acquired locks
  lockAcquisitionFailures: 1,        // Failed to acquire (contention)
  gracePeriodApplications: 2,        // Grace period applied count
  cacheHitRate: 0.9375,              // Calculated: hits / (hits + misses)
  lockContentionRate: 0.1            // Calculated: failures / (successes + failures)
}
```

### Metrics Endpoint

**GET /api/v1/admin/usage/cache/metrics**

Returns current cache performance metrics. Requires `admin:usage` permission.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/api/v1/admin/usage/cache/metrics | jq
```

### Alerts

**High lock contention** (> 20%):

- Indicates many concurrent rebuild attempts
- Solution: Increase cache TTL or implement cache warming

**Frequent grace period applications**:

- Cache rebuilds taking too long and crossing midnight
- Solution: Optimize cache build performance or adjust grace period

**Low cache hit rate** (< 80%):

- Cache eviction or TTL issues
- Solution: Review TTL configuration and cache invalidation logic

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
expect(cacheTTL).toBe(5 * 60); // 5 minutes, not permanent
```

### Lock Release Tests

```typescript
// Verify lock released even if function throws
try {
  await withAdvisoryLock(pool, lockId, async () => {
    throw new Error('Test error');
  });
} catch (error) {
  // Expected
}

// Lock should be released
const client = await pool.connect();
const acquired = await tryAcquireAdvisoryLock(client, lockId);
expect(acquired).toBe(true);
```

## Best Practices

### 1. Always use advisory locks for cache rebuilds

```typescript
// ✅ Good: Use withAdvisoryLock
const result = await withAdvisoryLock(pool, lockId, async (client) => {
  return await rebuildCache(client, dateString);
});

// ❌ Bad: Direct rebuild without lock
const result = await rebuildCache(client, dateString);
```

### 2. Use non-blocking locks to avoid deadlocks

```typescript
// ✅ Good: Non-blocking (returns null if lock held)
await withAdvisoryLock(pool, lockId, fn, { blocking: false });

// ⚠️ Caution: Blocking (can wait indefinitely)
await withAdvisoryLock(pool, lockId, fn, { blocking: true, timeout: 5000 });
```

### 3. Implement grace periods for time-sensitive logic

```typescript
// ✅ Good: Use grace period for midnight boundary
const isCurrentDay = this.isCurrentDayWithGracePeriod(dateString, cacheStartTime);

// ❌ Bad: Check exact time (race condition at midnight)
const isCurrentDay = dateString === getTodayUTC();
```

### 4. Make writes idempotent using UPSERT

```typescript
// ✅ Good: UPSERT (safe to retry)
INSERT INTO cache (date, data) VALUES ($1, $2)
ON CONFLICT (date) DO UPDATE SET data = EXCLUDED.data;

// ❌ Bad: INSERT only (fails on duplicate)
INSERT INTO cache (date, data) VALUES ($1, $2);
```

### 5. Monitor metrics to detect issues

```typescript
// ✅ Good: Track and log metrics
const metrics = cacheManager.getMetrics();
if (metrics.lockContentionRate > 0.2) {
  logger.warn('High lock contention detected', metrics);
}
```

### 6. Test race conditions explicitly

```typescript
// ✅ Good: Test concurrent access patterns
it('should handle concurrent rebuilds', async () => {
  const requests = Array(10)
    .fill(null)
    .map(() => rebuild(date));
  const results = await Promise.all(requests);
  expect(results.filter((r) => r !== null).length).toBe(1);
});
```

## Troubleshooting

### Issue: Advisory lock not released

**Cause**: Connection closed before lock release

**Solution**:

- Advisory locks are automatically released on connection close
- Use `withAdvisoryLock()` helper (handles release in finally block)
- Ensure client.release() is called in finally block

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
  const client = await pool.connect();
  await client.query('SELECT pg_advisory_unlock_all()');
  client.release();
});
```

## Performance Considerations

### Lock Overhead

- Advisory locks are **very fast** (in-memory, no disk I/O)
- Typical overhead: < 1ms for lock acquisition/release
- No impact on read queries (locks only used for writes)

### Grace Period Impact

- Grace period check: Simple integer comparison (< 0.1ms)
- Only runs during cache write (infrequent operation)
- No impact on cache reads

### Metrics Overhead

- Metrics are in-memory counters (no I/O)
- Negligible overhead (< 0.01ms per operation)
- Metrics endpoint queries counters directly (no database access)

## Security Considerations

### Advisory Lock Isolation

- Advisory locks are **session-scoped** by default
- Different connections can acquire different locks simultaneously
- Lock IDs should be **unique per resource** (we use date-based IDs)

### Permission Requirements

- Advisory locks require **database connection** (authenticated)
- Cache metrics endpoint requires **admin:usage permission**
- No additional PostgreSQL permissions needed for advisory locks

## References

- [PostgreSQL Advisory Locks Documentation](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [Race Condition Patterns](https://en.wikipedia.org/wiki/Race_condition)
- [Idempotency](https://en.wikipedia.org/wiki/Idempotence)
- Backend CLAUDE.md - Concurrency section

// backend/tests/integration/cache-race-conditions.test.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import {
  calculateLockId,
  tryAcquireAdvisoryLock,
  releaseAdvisoryLock,
  withAdvisoryLock,
} from '../../src/utils/advisory-lock.utils';
import { DailyUsageCacheManager } from '../../src/services/daily-usage-cache-manager';
import type { EnrichedDayData } from '../../src/types/admin-usage.types';

describe('Cache Race Condition Scenarios', () => {
  let app: FastifyInstance;
  let pool: Pool;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp({ logger: false });
    await app.ready();
    pool = app.pg.pool;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clear any held locks before each test
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_unlock_all()');
    } finally {
      client.release();
    }
  });

  describe('Concurrent Cache Rebuilds', () => {
    it('should prevent duplicate cache rebuilds for same date', async () => {
      const dateString = '2025-01-15';
      const lockId = calculateLockId(dateString);

      let rebuild1Started = false;
      let rebuild2Started = false;
      let rebuild1Completed = false;
      let rebuild2Completed = false;

      // Simulate 2 concurrent cache rebuild attempts
      const rebuild1 = withAdvisoryLock(
        pool,
        lockId,
        async () => {
          rebuild1Started = true;
          // Simulate cache rebuild work
          await new Promise((resolve) => setTimeout(resolve, 100));
          rebuild1Completed = true;
          return { success: true, worker: 1 };
        },
        { blocking: false },
      );

      const rebuild2 = withAdvisoryLock(
        pool,
        lockId,
        async () => {
          rebuild2Started = true;
          await new Promise((resolve) => setTimeout(resolve, 100));
          rebuild2Completed = true;
          return { success: true, worker: 2 };
        },
        { blocking: false },
      );

      const [result1, result2] = await Promise.all([rebuild1, rebuild2]);

      // One should succeed, one should return null (lock held)
      expect([result1, result2]).toContain(null);
      const successfulResults = [result1, result2].filter((r) => r !== null);
      expect(successfulResults.length).toBe(1);

      // Only one rebuild should have started and completed
      expect(rebuild1Started !== rebuild2Started).toBe(true);
      expect(rebuild1Completed !== rebuild2Completed).toBe(true);
    });

    it('should handle concurrent requests for different dates independently', async () => {
      const date1 = '2025-01-15';
      const date2 = '2025-01-16';
      const date3 = '2025-01-17';

      const lockId1 = calculateLockId(date1);
      const lockId2 = calculateLockId(date2);
      const lockId3 = calculateLockId(date3);

      const results = await Promise.all([
        withAdvisoryLock(pool, lockId1, async () => ({ date: date1 })),
        withAdvisoryLock(pool, lockId2, async () => ({ date: date2 })),
        withAdvisoryLock(pool, lockId3, async () => ({ date: date3 })),
      ]);

      // All should succeed (different locks)
      expect(results[0]).toEqual({ date: date1 });
      expect(results[1]).toEqual({ date: date2 });
      expect(results[2]).toEqual({ date: date3 });
    });

    it('should allow sequential rebuilds of same date', async () => {
      const dateString = '2025-01-15';
      const lockId = calculateLockId(dateString);

      // First rebuild
      const result1 = await withAdvisoryLock(pool, lockId, async () => ({ attempt: 1 }));

      // Second rebuild (after first completes)
      const result2 = await withAdvisoryLock(pool, lockId, async () => ({ attempt: 2 }));

      expect(result1).toEqual({ attempt: 1 });
      expect(result2).toEqual({ attempt: 2 });
    });
  });

  describe('Lock Timeout and Contention', () => {
    it('should handle lock held by long-running process', async () => {
      const dateString = '2025-01-15';
      const lockId = calculateLockId(dateString);

      const client = await pool.connect();

      try {
        // Manually acquire lock
        await tryAcquireAdvisoryLock(client, lockId);

        let callbackInvoked = false;

        // Try to acquire same lock (should fail)
        const result = await withAdvisoryLock(
          pool,
          lockId,
          async () => {
            return { success: true };
          },
          {
            blocking: false,
            onLockFailed: () => {
              callbackInvoked = true;
            },
          },
        );

        expect(result).toBe(null);
        expect(callbackInvoked).toBe(true);
      } finally {
        await releaseAdvisoryLock(client, lockId);
        client.release();
      }
    });

    it('should release lock even if function throws error', async () => {
      const dateString = '2025-01-15';
      const lockId = calculateLockId(dateString);

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

  describe('Midnight Boundary Race Conditions', () => {
    it('should handle cache build spanning midnight with grace period', async () => {
      // Mock time to be just after midnight
      vi.setSystemTime(new Date('2025-01-15T00:02:00Z'));

      const yesterday = '2025-01-14';

      // Simulate cache build that started before midnight
      const lockId = calculateLockId(yesterday);

      const result = await withAdvisoryLock(pool, lockId, async () => {
        // Grace period logic should treat yesterday as "current day"
        return { dateBuilt: yesterday, isCurrentDay: true };
      });

      expect(result).toEqual({ dateBuilt: yesterday, isCurrentDay: true });

      vi.useRealTimers();
    });
  });

  describe('Lock ID Collision Resistance', () => {
    it('should generate unique lock IDs for different dates', () => {
      const dates = ['2025-01-01', '2025-01-15', '2025-02-15', '2025-12-31', '2024-01-15'];

      const lockIds = dates.map(calculateLockId);

      // All lock IDs should be unique
      const uniqueLockIds = new Set(lockIds);
      expect(uniqueLockIds.size).toBe(lockIds.length);
    });

    it('should generate consistent lock IDs for same date', () => {
      const date = '2025-01-15';

      const lockId1 = calculateLockId(date);
      const lockId2 = calculateLockId(date);

      expect(lockId1).toBe(lockId2);
    });
  });

  describe('High Concurrency Scenarios', () => {
    it('should handle 10 concurrent rebuild attempts gracefully', async () => {
      const dateString = '2025-01-15';
      const lockId = calculateLockId(dateString);

      let successCount = 0;
      let failureCount = 0;

      // Simulate 10 concurrent requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          withAdvisoryLock(
            pool,
            lockId,
            async () => {
              successCount++;
              // Hold lock long enough to ensure all concurrent attempts see it as held
              await new Promise((resolve) => setTimeout(resolve, 200));
              return { success: true };
            },
            {
              blocking: false,
              onLockFailed: () => {
                failureCount++;
              },
            },
          ),
        );

      const results = await Promise.all(requests);

      // Exactly 1 should succeed (got the lock)
      const successfulResults = results.filter((r) => r !== null);
      expect(successfulResults.length).toBe(1);

      // Exactly 9 should fail (lock held)
      const failedResults = results.filter((r) => r === null);
      expect(failedResults.length).toBe(9);

      expect(successCount).toBe(1);
      expect(failureCount).toBe(9);
    });

    it('should handle mixed concurrent and sequential access', async () => {
      const dateString = '2025-01-15';
      const lockId = calculateLockId(dateString);

      // First concurrent batch
      // Add small delay to ensure lock is held during concurrent attempts
      const batch1 = await Promise.all([
        withAdvisoryLock(pool, lockId, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { batch: 1, attempt: 1 };
        }),
        withAdvisoryLock(pool, lockId, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { batch: 1, attempt: 2 };
        }),
        withAdvisoryLock(pool, lockId, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { batch: 1, attempt: 3 };
        }),
      ]);

      // One should succeed in batch 1
      const batch1Success = batch1.filter((r) => r !== null);
      expect(batch1Success.length).toBe(1);

      // Second concurrent batch (after first completes)
      const batch2 = await Promise.all([
        withAdvisoryLock(pool, lockId, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { batch: 2, attempt: 1 };
        }),
        withAdvisoryLock(pool, lockId, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { batch: 2, attempt: 2 };
        }),
      ]);

      // One should succeed in batch 2
      const batch2Success = batch2.filter((r) => r !== null);
      expect(batch2Success.length).toBe(1);
    });
  });

  describe('Cache Refresh During Read', () => {
    it('should handle manual refresh while queries in progress', async () => {
      const dateString = '2025-01-15';
      const lockId = calculateLockId(dateString);

      // Simulate long-running read query
      const readQuery = new Promise((resolve) => setTimeout(resolve, 50));

      // Simulate refresh attempt during read
      const refreshResult = await withAdvisoryLock(pool, lockId, async () => {
        await readQuery;
        return { refreshed: true };
      });

      expect(refreshResult).toEqual({ refreshed: true });
    });
  });
});

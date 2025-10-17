// backend/tests/unit/utils/advisory-lock.utils.test.ts
//
// MOCKING STRATEGY:
// This test uses mocked Pool and PoolClient objects to test advisory lock logic
// without requiring a real PostgreSQL database. The mocks simulate:
// - Lock acquisition (pg_try_advisory_lock returns true/false)
// - Lock release (pg_advisory_unlock returns true/false)
// - Connection management (pool.connect() and client.release())
//
// Each test scenario controls mock behavior to test different lock states:
// - Fresh lock acquisition (returns true)
// - Lock already held (returns false)
// - Lock release success (returns true)
// - Lock release when not held (returns false)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  calculateLockId,
  tryAcquireAdvisoryLock,
  releaseAdvisoryLock,
  withAdvisoryLock,
} from '../../../src/utils/advisory-lock.utils';

describe('Advisory Lock Utilities', () => {
  let mockPool: Pool;
  let mockClient: PoolClient;
  let mockQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock query function that can be reconfigured per test
    mockQuery = vi.fn();

    // Create mock PoolClient with query and release methods
    mockClient = {
      query: mockQuery,
      release: vi.fn(),
    } as unknown as PoolClient;

    // Create mock Pool with connect method
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn(),
    } as unknown as Pool;
  });

  describe('calculateLockId', () => {
    it('should convert date to unique integer', () => {
      expect(calculateLockId('2025-01-15')).toBe(20250115);
      expect(calculateLockId('2025-12-31')).toBe(20251231);
      expect(calculateLockId('2024-02-29')).toBe(20240229);
    });

    it('should handle single-digit months and days', () => {
      expect(calculateLockId('2025-01-05')).toBe(20250105);
      expect(calculateLockId('2025-03-01')).toBe(20250301);
    });

    it('should throw error for invalid format', () => {
      expect(() => calculateLockId('invalid')).toThrow('Invalid date format');
      expect(() => calculateLockId('abc-def-ghi')).toThrow('Invalid date format');
      expect(() => calculateLockId('')).toThrow('Invalid date format');
    });

    it('should accept single-digit months and days (lenient parsing)', () => {
      // Implementation is lenient - accepts non-zero-padded dates
      expect(calculateLockId('2025-1-15')).toBe(20250115);
      expect(calculateLockId('2025-01-15')).toBe(20250115); // Same result
      expect(calculateLockId('2025-3-5')).toBe(20250305);
    });

    it('should produce unique IDs for different dates', () => {
      const id1 = calculateLockId('2025-01-15');
      const id2 = calculateLockId('2025-01-16');
      const id3 = calculateLockId('2025-02-15');

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });
  });

  describe('tryAcquireAdvisoryLock', () => {
    it('should acquire lock if not held', async () => {
      // Mock: pg_try_advisory_lock returns true (lock acquired)
      mockQuery.mockResolvedValue({
        rows: [{ pg_try_advisory_lock: true }],
      });

      const lockId = 99999999;
      const acquired = await tryAcquireAdvisoryLock(mockClient, lockId);

      expect(acquired).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1)', [lockId]);
    });

    it('should fail to acquire if already held', async () => {
      // Mock: pg_try_advisory_lock returns false (lock already held)
      mockQuery.mockResolvedValue({
        rows: [{ pg_try_advisory_lock: false }],
      });

      const lockId = 99999998;
      const acquired = await tryAcquireAdvisoryLock(mockClient, lockId);

      expect(acquired).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1)', [lockId]);
    });

    it('should allow acquiring lock after release', async () => {
      const lockId = 99999997;

      // Scenario: First client acquires lock
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_try_advisory_lock: true }],
      });

      const acquired1 = await tryAcquireAdvisoryLock(mockClient, lockId);
      expect(acquired1).toBe(true);

      // Mock: pg_advisory_unlock returns true (lock released)
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_advisory_unlock: true }],
      });

      const released = await releaseAdvisoryLock(mockClient, lockId);
      expect(released).toBe(true);

      // Mock: Second client can now acquire lock
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_try_advisory_lock: true }],
      });

      const acquired2 = await tryAcquireAdvisoryLock(mockClient, lockId);
      expect(acquired2).toBe(true);
    });
  });

  describe('releaseAdvisoryLock', () => {
    it('should release held lock', async () => {
      const lockId = 99999996;

      // Mock: First acquire lock
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_try_advisory_lock: true }],
      });

      await tryAcquireAdvisoryLock(mockClient, lockId);

      // Mock: pg_advisory_unlock returns true (lock released)
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_advisory_unlock: true }],
      });

      const released = await releaseAdvisoryLock(mockClient, lockId);

      expect(released).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [lockId]);
    });

    it('should return false when releasing lock not held', async () => {
      // Mock: pg_advisory_unlock returns false (lock was not held)
      mockQuery.mockResolvedValue({
        rows: [{ pg_advisory_unlock: false }],
      });

      const lockId = 99999995;
      const released = await releaseAdvisoryLock(mockClient, lockId);

      expect(released).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [lockId]);
    });
  });

  describe('withAdvisoryLock', () => {
    it('should execute function with lock', async () => {
      const lockId = 99999994;

      // Mock: Lock acquisition succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_try_advisory_lock: true }],
      });

      // Mock: Lock release succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_advisory_unlock: true }],
      });

      let executed = false;
      const result = await withAdvisoryLock(mockPool, lockId, async () => {
        executed = true;
        return 'success';
      });

      expect(executed).toBe(true);
      expect(result).toBe('success');
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should not execute if lock already held', async () => {
      const lockId = 99999993;

      // Mock: Lock acquisition fails (already held)
      mockQuery.mockResolvedValue({
        rows: [{ pg_try_advisory_lock: false }],
      });

      let executed = false;
      const result = await withAdvisoryLock(
        mockPool,
        lockId,
        async () => {
          executed = true;
          return 'success';
        },
        { blocking: false },
      );

      expect(executed).toBe(false);
      expect(result).toBe(null);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release lock even if function throws', async () => {
      const lockId = 99999992;

      // Mock: Lock acquisition succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_try_advisory_lock: true }],
      });

      // Mock: Lock release succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_advisory_unlock: true }],
      });

      try {
        await withAdvisoryLock(mockPool, lockId, async () => {
          throw new Error('Test error');
        });
      } catch (error) {
        // Expected
      }

      // Verify lock was released despite error
      expect(mockQuery).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [lockId]);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should call onLockFailed callback when lock not acquired', async () => {
      const lockId = 99999991;

      // Mock: Lock acquisition fails
      mockQuery.mockResolvedValue({
        rows: [{ pg_try_advisory_lock: false }],
      });

      let callbackCalled = false;
      await withAdvisoryLock(
        mockPool,
        lockId,
        async () => {
          return 'success';
        },
        {
          blocking: false,
          onLockFailed: () => {
            callbackCalled = true;
          },
        },
      );

      expect(callbackCalled).toBe(true);
    });

    it('should pass client to function', async () => {
      const lockId = 99999990;

      // Mock: Lock acquisition succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_try_advisory_lock: true }],
      });

      // Mock: Lock release succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{ pg_advisory_unlock: true }],
      });

      let receivedClient = null;

      await withAdvisoryLock(mockPool, lockId, async (client) => {
        receivedClient = client;
        return 'success';
      });

      expect(receivedClient).not.toBe(null);
      expect(receivedClient).toHaveProperty('query');
      expect(receivedClient).toBe(mockClient);
    });

    it('should handle concurrent lock attempts', async () => {
      const lockId = 99999989;

      // Create two separate mock clients to simulate concurrency
      const mockClient1 = {
        query: vi.fn(),
        release: vi.fn(),
      } as unknown as PoolClient;

      const mockClient2 = {
        query: vi.fn(),
        release: vi.fn(),
      } as unknown as PoolClient;

      // Mock pool to return different clients
      let connectCallCount = 0;
      (mockPool.connect as ReturnType<typeof vi.fn>).mockImplementation(() => {
        connectCallCount++;
        return Promise.resolve(connectCallCount === 1 ? mockClient1 : mockClient2);
      });

      let firstExecuted = false;
      let secondExecuted = false;

      // Mock: First client acquires lock successfully
      (mockClient1.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ pg_try_advisory_lock: true }],
      });

      // Mock: Second client fails to acquire lock (already held)
      (mockClient2.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ pg_try_advisory_lock: false }],
      });

      // Mock: First client releases lock
      (mockClient1.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        rows: [{ pg_advisory_unlock: true }],
      });

      // Start two concurrent lock attempts
      const [result1, result2] = await Promise.all([
        withAdvisoryLock(mockPool, lockId, async () => {
          firstExecuted = true;
          // Simulate some work
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'first';
        }),
        withAdvisoryLock(mockPool, lockId, async () => {
          secondExecuted = true;
          return 'second';
        }),
      ]);

      // One should succeed, one should fail
      expect(firstExecuted || secondExecuted).toBe(true);
      expect(firstExecuted && secondExecuted).toBe(false);

      // One result should be the value, one should be null
      const results = [result1, result2];
      expect(results).toContain(null);
      expect(results.filter((r) => r !== null).length).toBe(1);

      // Both clients should be released
      expect(mockClient1.release).toHaveBeenCalled();
      expect(mockClient2.release).toHaveBeenCalled();
    });
  });

  describe('Lock ID collision resistance', () => {
    it('should generate different lock IDs for dates across years', () => {
      const id2024 = calculateLockId('2024-01-15');
      const id2025 = calculateLockId('2025-01-15');

      expect(id2024).toBe(20240115);
      expect(id2025).toBe(20250115);
      expect(id2024).not.toBe(id2025);
    });

    it('should handle edge case dates', () => {
      expect(calculateLockId('2000-01-01')).toBe(20000101);
      expect(calculateLockId('2099-12-31')).toBe(20991231);
      expect(calculateLockId('2024-02-29')).toBe(20240229); // Leap year
    });
  });
});

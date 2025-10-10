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

import type { Pool, PoolClient } from 'pg';

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

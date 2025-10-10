/**
 * DailyUsageCacheManager Service
 *
 * Manages the daily usage cache for admin usage analytics.
 * Implements day-by-day caching strategy with different TTLs for historical vs current day data.
 *
 * Cache Strategy:
 * - Historical days (> 1 day old): Permanent cache (never expires)
 * - Current day: 5-minute TTL (is_complete = false)
 *
 * @example
 * ```typescript
 * const cacheManager = new DailyUsageCacheManager(fastify);
 *
 * // Get cached data for a specific date
 * const data = await cacheManager.getCachedDailyData(new Date('2024-01-15'));
 *
 * // Save new data to cache
 * await cacheManager.saveToDailyCache(new Date(), enrichedData, true);
 *
 * // Get aggregated data for a date range
 * const rangeData = await cacheManager.getDateRangeData(startDate, endDate);
 * ```
 */

import type { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';
import type {
  EnrichedDayData,
  AggregatedUsageData as AdminAggregatedUsageData,
} from '../types/admin-usage.types.js';
import { withAdvisoryLock, calculateLockId } from '../utils/advisory-lock.utils.js';
import { getTodayUTC, subDaysUTC } from './admin-usage/admin-usage.utils.js';
import { getAdminAnalyticsConfig } from '../config/admin-analytics.config.js';

/**
 * NOTE: We import and use EnrichedDayData and AggregatedUsageData from admin-usage.types.ts
 * to ensure type compatibility with IDailyUsageCacheManager interface. The cache manager
 * stores and retrieves data in the same structure that AdminUsageStatsService expects.
 *
 * The types below are internal helpers for database storage/retrieval only.
 */

/**
 * Internal metrics types for database storage (simplified versions)
 */
interface DayMetrics {
  api_requests: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  spend: number;
  successful_requests: number;
  failed_requests: number;
}

interface UserMetrics {
  user_id: string;
  username?: string;
  email?: string;
  role?: string;
  api_requests: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  spend: number;
  successful_requests: number;
  failed_requests: number;
}

interface ModelMetrics {
  model_id: string;
  api_requests: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  spend: number;
  successful_requests: number;
  failed_requests: number;
}

interface ProviderMetrics {
  provider: string;
  api_requests: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  spend: number;
}

/**
 * DailyUsageCacheManager
 *
 * Manages caching of daily usage data from LiteLLM with intelligent TTL strategy.
 * Historical days are cached permanently, current day TTL is configurable via USAGE_CACHE_TTL_MINUTES env var.
 */
export class DailyUsageCacheManager extends BaseService {
  private readonly CURRENT_DAY_TTL_MS: number;
  private readonly config = getAdminAnalyticsConfig();

  /**
   * Cache performance metrics
   */
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    cacheRebuilds: 0,
    lockAcquisitionSuccesses: 0,
    lockAcquisitionFailures: 0,
    gracePeriodApplications: 0,
  };

  constructor(fastify: FastifyInstance) {
    super(fastify);
    // Initialize TTL from config (defaults to 5 minutes)
    const ttlMinutes = Number(fastify.config.USAGE_CACHE_TTL_MINUTES) || 5;
    this.CURRENT_DAY_TTL_MS = ttlMinutes * 60 * 1000;
    this.fastify.log.info(
      { ttlMinutes, ttlMs: this.CURRENT_DAY_TTL_MS },
      'DailyUsageCacheManager initialized with configurable TTL',
    );
  }

  /**
   * Get cached daily data from database with advisory lock protection
   *
   * For historical days (> 1 day old), returns cached data permanently.
   * For current day, checks if cache is stale (> 5 minutes old) and rebuilds with lock protection.
   *
   * @param dateString - The date to get cached data for (YYYY-MM-DD)
   * @param rebuildFn - Optional function to rebuild cache if missing (for integration with AdminUsageStatsService)
   * @returns Cached data or null if not cached or stale
   * @throws ApplicationError if database operation fails
   */
  async getCachedDailyData(
    dateString: string,
    rebuildFn?: (dateString: string) => Promise<EnrichedDayData>,
  ): Promise<EnrichedDayData | null> {
    // Check cache first
    const cached = await this.checkCache(dateString);
    if (cached) {
      this.metrics.cacheHits++;
      this.fastify.log.debug({ dateString, metrics: this.metrics }, 'Cache hit');
      return cached;
    }

    this.metrics.cacheMisses++;

    // If no rebuild function provided, just return null
    if (!rebuildFn) {
      this.fastify.log.debug({ dateString }, 'Cache miss - no rebuild function provided');
      return null;
    }

    // Cache miss - need to rebuild with lock protection
    this.fastify.log.debug({ dateString }, 'Cache miss - acquiring lock for rebuild');

    const lockId = calculateLockId(dateString);

    // Try to acquire lock and rebuild
    const result = await withAdvisoryLock(
      this.fastify.pg.pool,
      lockId,
      async () => {
        this.metrics.lockAcquisitionSuccesses++;

        // Double-check cache (another process may have built it while we waited for lock)
        const cached = await this.checkCache(dateString);
        if (cached) {
          this.fastify.log.debug({ dateString }, 'Cache populated by another process');
          return cached;
        }

        // We have the lock and cache is still empty - rebuild
        this.metrics.cacheRebuilds++;
        this.fastify.log.info({ dateString }, 'Building cache for date');

        const usageData = await rebuildFn(dateString);

        // Determine if this is current day for TTL purposes (using grace period logic)
        const isCurrentDay = this.isCurrentDayWithGracePeriod(dateString);

        // Write to cache with appropriate TTL
        await this.saveToDailyCache(dateString, usageData, isCurrentDay);

        return usageData;
      },
      {
        blocking: false,
        onLockFailed: () => {
          this.metrics.lockAcquisitionFailures++;
          this.fastify.log.debug(
            { dateString, lockId, metrics: this.metrics },
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
      this.fastify.log.warn({ dateString }, 'Cache still empty after waiting for other process');
      return null;
    }

    return result;
  }

  /**
   * Check cache for a date
   *
   * Internal method used by getCachedDailyData.
   *
   * @param dateString - Date in YYYY-MM-DD format
   * @returns Cached data or null if not found or stale
   */
  private async checkCache(dateString: string): Promise<EnrichedDayData | null> {
    try {
      const result = await this.executeQuery<{ rows: any[] }>(
        `SELECT
          date,
          raw_data,
          aggregated_by_user,
          aggregated_by_model,
          aggregated_by_provider,
          total_metrics,
          updated_at,
          is_complete
        FROM daily_usage_cache
        WHERE date = $1`,
        [dateString],
        'checking cache',
      );

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Check if current day cache is stale
      if (!row.is_complete) {
        const cacheAge = Date.now() - new Date(row.updated_at).getTime();
        if (cacheAge > this.CURRENT_DAY_TTL_MS) {
          this.fastify.log.debug({ date: dateString, cacheAge }, 'Current day cache is stale');
          return null;
        }
      }

      // Convert date from PostgreSQL Date object to YYYY-MM-DD string
      const formattedDate =
        row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;

      // Create a copy of rawData and ensure its date is also a string
      let rawData = row.raw_data;
      if (rawData && rawData.date instanceof Date) {
        rawData = {
          ...rawData,
          date: rawData.date.toISOString().split('T')[0],
        };
      }

      return {
        date: formattedDate,
        metrics: row.total_metrics,
        breakdown: {
          models: row.aggregated_by_model || {},
          providers: row.aggregated_by_provider || {},
          users: row.aggregated_by_user || {},
        },
        rawData,
      };
    } catch (error) {
      this.fastify.log.error({ error, dateString }, 'Failed to check cache');
      throw this.mapDatabaseError(error, 'checking cache');
    }
  }

  /**
   * Determine if date should be considered "current day" with grace period
   *
   * Grace period handles midnight boundary race conditions:
   * - If it's 00:03 UTC and we're caching yesterday's data, treat as "current day"
   * - Prevents historical cache from getting short TTL
   *
   * @param dateString - Date in YYYY-MM-DD format
   * @returns True if should use current day TTL
   */
  private isCurrentDayWithGracePeriod(dateString: string): boolean {
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
      this.metrics.gracePeriodApplications++;
      this.fastify.log.debug(
        {
          dateString,
          minutesSinceMidnight,
          gracePeriodMinutes,
          metrics: this.metrics,
        },
        'Applying grace period - treating yesterday as current day',
      );

      return true;
    }

    return false;
  }

  /**
   * Save daily data to cache
   *
   * Upserts data into the cache. Sets is_complete flag based on whether this is current day.
   *
   * @param date - The date being cached
   * @param data - The enriched usage data to cache
   * @param isCurrentDay - Whether this is today's data (gets shorter TTL)
   * @throws ApplicationError if database operation fails
   */
  async saveToDailyCache(
    dateString: string,
    data: EnrichedDayData,
    isCurrentDay: boolean,
  ): Promise<void> {
    // dateString is already in YYYY-MM-DD format, no conversion needed

    try {
      await this.executeQuery(
        `INSERT INTO daily_usage_cache (
          date,
          raw_data,
          aggregated_by_user,
          aggregated_by_model,
          aggregated_by_provider,
          total_metrics,
          is_complete,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (date)
        DO UPDATE SET
          raw_data = EXCLUDED.raw_data,
          aggregated_by_user = EXCLUDED.aggregated_by_user,
          aggregated_by_model = EXCLUDED.aggregated_by_model,
          aggregated_by_provider = EXCLUDED.aggregated_by_provider,
          total_metrics = EXCLUDED.total_metrics,
          is_complete = EXCLUDED.is_complete,
          updated_at = NOW()`,
        [
          dateString,
          JSON.stringify(data.rawData),
          JSON.stringify(data.breakdown.users),
          JSON.stringify(data.breakdown.models),
          JSON.stringify(data.breakdown.providers),
          JSON.stringify(data.metrics),
          !isCurrentDay, // is_complete = true for historical days
        ],
        'saving to daily cache',
      );

      this.fastify.log.info(
        { date: dateString, isComplete: !isCurrentDay },
        'Successfully cached daily usage data',
      );
    } catch (error) {
      this.fastify.log.error({ error, dateString }, 'Failed to save to daily cache');
      throw this.mapDatabaseError(error, 'saving to daily cache');
    }
  }

  /**
   * Get aggregated data for a date range
   *
   * Efficiently retrieves and aggregates cached data across multiple days.
   *
   * @param startDate - Start of date range (inclusive)
   * @param endDate - End of date range (inclusive)
   * @returns Aggregated usage data across the date range
   * @throws ApplicationError if database operation fails
   */
  async getDateRangeData(
    startDate: string,
    endDate: string,
  ): Promise<AdminAggregatedUsageData | null> {
    // startDate and endDate are already in YYYY-MM-DD format
    // Simple string comparison is sufficient for validation
    if (startDate > endDate) {
      throw this.createValidationError(
        'Start date must be before or equal to end date',
        'dateRange',
        { startDate, endDate },
        'Ensure start date is before end date',
      );
    }

    try {
      const result = await this.executeQuery<{ rows: any[] }>(
        `SELECT
          date,
          aggregated_by_user,
          aggregated_by_model,
          aggregated_by_provider,
          total_metrics,
          raw_data
        FROM daily_usage_cache
        WHERE date BETWEEN $1 AND $2
        ORDER BY date ASC`,
        [startDate, endDate],
        'getting date range data',
      );

      if (!result.rows || result.rows.length === 0) {
        this.fastify.log.debug({ startDate, endDate }, 'No cached data found for date range');

        // Return empty aggregated data
        return this.createEmptyAggregatedData(startDate, endDate);
      }

      // Aggregate across all days
      return this.aggregateMultipleDays(result.rows, startDate, endDate);
    } catch (error) {
      this.fastify.log.error({ error, startDate, endDate }, 'Failed to get date range data');
      throw this.mapDatabaseError(error, 'getting date range data');
    }
  }

  /**
   * Invalidate current day cache to force refresh
   *
   * Sets the updated_at timestamp to be older than TTL, forcing next read to refetch.
   */
  async invalidateTodayCache(): Promise<void> {
    const today = this.formatDate(new Date());

    try {
      await this.executeQuery(
        `UPDATE daily_usage_cache
         SET is_complete = false,
             updated_at = NOW() - INTERVAL '10 minutes'
         WHERE date = $1`,
        [today],
        'invalidating today cache',
      );

      this.fastify.log.info({ date: today }, 'Invalidated current day cache');
    } catch (error) {
      this.fastify.log.error({ error }, 'Failed to invalidate today cache');
      throw this.mapDatabaseError(error, 'invalidating today cache');
    }
  }

  /**
   * Clean up old cache data
   *
   * Removes cache entries older than retention period (for data retention policies).
   *
   * @param retentionDays - Number of days to retain (default: 365)
   * @returns Number of rows deleted
   * @throws ApplicationError if database operation fails
   */
  async cleanupOldCache(retentionDays: number = 365): Promise<number> {
    if (retentionDays < 1) {
      throw this.createValidationError(
        'Retention days must be at least 1',
        'retentionDays',
        retentionDays,
        'Provide a positive number of days to retain',
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const formattedCutoff = this.formatDate(cutoffDate);

    try {
      const result = await this.executeQuery<{ rowCount: number }>(
        `DELETE FROM daily_usage_cache WHERE date < $1`,
        [formattedCutoff],
        'cleaning up old cache',
      );

      const deletedCount = result.rowCount || 0;

      this.fastify.log.info(
        { deletedCount, cutoffDate: formattedCutoff },
        'Cleaned up old cache data',
      );

      return deletedCount;
    } catch (error) {
      this.fastify.log.error({ error, cutoffDate: formattedCutoff }, 'Failed to cleanup old cache');
      throw this.mapDatabaseError(error, 'cleaning up old cache');
    }
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Format date as YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Create empty aggregated data structure
   */
  private createEmptyAggregatedData(startDate: string, endDate: string): AdminAggregatedUsageData {
    return {
      period: {
        startDate,
        endDate,
      },
      totalMetrics: {
        api_requests: 0,
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        spend: 0,
        successful_requests: 0,
        failed_requests: 0,
        success_rate: 0,
      },
      byUser: {},
      byModel: {},
      byProvider: {},
    };
  }

  /**
   * Aggregate data from multiple days
   */
  private aggregateMultipleDays(
    rows: any[],
    startDate: string,
    endDate: string,
  ): AdminAggregatedUsageData {
    const aggregated = this.createEmptyAggregatedData(startDate, endDate);

    for (const row of rows) {
      // Aggregate total metrics
      this.aggregateMetrics(aggregated.totalMetrics, row.total_metrics);

      // Aggregate by user
      this.aggregateUserMetrics(aggregated.byUser, row.aggregated_by_user || {});

      // Aggregate by model
      this.aggregateModelMetrics(aggregated.byModel, row.aggregated_by_model || {});

      // Aggregate by provider
      this.aggregateProviderMetrics(aggregated.byProvider, row.aggregated_by_provider || {});
    }

    // Calculate success rate
    if (aggregated.totalMetrics.api_requests > 0) {
      aggregated.totalMetrics.success_rate =
        (aggregated.totalMetrics.successful_requests / aggregated.totalMetrics.api_requests) * 100;
    }

    return aggregated;
  }

  /**
   * Aggregate day metrics into total
   */
  private aggregateMetrics(total: DayMetrics, day: DayMetrics): void {
    total.api_requests += day.api_requests || 0;
    total.total_tokens += day.total_tokens || 0;
    total.prompt_tokens += day.prompt_tokens || 0;
    total.completion_tokens += day.completion_tokens || 0;
    total.spend += day.spend || 0;
    total.successful_requests += day.successful_requests || 0;
    total.failed_requests += day.failed_requests || 0;
  }

  /**
   * Aggregate user metrics
   */
  private aggregateUserMetrics(
    total: Record<string, UserMetrics>,
    day: Record<string, UserMetrics>,
  ): void {
    for (const [userId, metrics] of Object.entries(day)) {
      if (!total[userId]) {
        total[userId] = {
          user_id: userId,
          username: metrics.username,
          email: metrics.email,
          role: metrics.role,
          api_requests: 0,
          total_tokens: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          spend: 0,
          successful_requests: 0,
          failed_requests: 0,
        };
      }

      total[userId].api_requests += metrics.api_requests || 0;
      total[userId].total_tokens += metrics.total_tokens || 0;
      total[userId].prompt_tokens += metrics.prompt_tokens || 0;
      total[userId].completion_tokens += metrics.completion_tokens || 0;
      total[userId].spend += metrics.spend || 0;
      total[userId].successful_requests += metrics.successful_requests || 0;
      total[userId].failed_requests += metrics.failed_requests || 0;
    }
  }

  /**
   * Aggregate model metrics
   */
  private aggregateModelMetrics(
    total: Record<string, ModelMetrics>,
    day: Record<string, ModelMetrics>,
  ): void {
    for (const [modelId, metrics] of Object.entries(day)) {
      if (!total[modelId]) {
        total[modelId] = {
          model_id: modelId,
          api_requests: 0,
          total_tokens: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          spend: 0,
          successful_requests: 0,
          failed_requests: 0,
        };
      }

      total[modelId].api_requests += metrics.api_requests || 0;
      total[modelId].total_tokens += metrics.total_tokens || 0;
      total[modelId].prompt_tokens += metrics.prompt_tokens || 0;
      total[modelId].completion_tokens += metrics.completion_tokens || 0;
      total[modelId].spend += metrics.spend || 0;
      total[modelId].successful_requests += metrics.successful_requests || 0;
      total[modelId].failed_requests += metrics.failed_requests || 0;
    }
  }

  /**
   * Aggregate provider metrics
   */
  private aggregateProviderMetrics(
    total: Record<string, ProviderMetrics>,
    day: Record<string, ProviderMetrics>,
  ): void {
    for (const [provider, metrics] of Object.entries(day)) {
      if (!total[provider]) {
        total[provider] = {
          provider,
          api_requests: 0,
          total_tokens: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          spend: 0,
        };
      }

      total[provider].api_requests += metrics.api_requests || 0;
      total[provider].total_tokens += metrics.total_tokens || 0;
      total[provider].prompt_tokens += metrics.prompt_tokens || 0;
      total[provider].completion_tokens += metrics.completion_tokens || 0;
      total[provider].spend += metrics.spend || 0;
    }
  }

  /**
   * Get cache performance metrics
   *
   * Returns current metrics including hit rate and lock contention rate.
   * Useful for monitoring and debugging cache performance.
   *
   * @returns Cache metrics object
   */
  getMetrics() {
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const totalLockAttempts =
      this.metrics.lockAcquisitionSuccesses + this.metrics.lockAcquisitionFailures;

    return {
      ...this.metrics,
      cacheHitRate: totalCacheRequests > 0 ? this.metrics.cacheHits / totalCacheRequests : 0,
      lockContentionRate:
        totalLockAttempts > 0 ? this.metrics.lockAcquisitionFailures / totalLockAttempts : 0,
    };
  }

  /**
   * Reset cache metrics
   *
   * Useful for testing or resetting metrics after monitoring period.
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

// backend/tests/unit/services/daily-usage-cache-manager.grace-period.test.ts

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { DailyUsageCacheManager } from '../../../src/services/daily-usage-cache-manager';
import { initAdminAnalyticsConfig } from '../../../src/config/admin-analytics.config';
import type { FastifyInstance } from 'fastify';

// Mock the date utilities to work with fake timers
vi.mock('../../../src/services/admin-usage/admin-usage.utils.js', async () => {
  const actual = await vi.importActual('../../../src/services/admin-usage/admin-usage.utils.js');
  return {
    ...actual,
    getTodayUTC: () => {
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    subDaysUTC: (dateString: string, days: number) => {
      const date = new Date(dateString);
      date.setUTCDate(date.getUTCDate() - days);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
  };
});

describe('DailyUsageCacheManager - Grace Period Logic', () => {
  let fastify: Partial<FastifyInstance>;
  let cacheManager: DailyUsageCacheManager;

  beforeAll(() => {
    // Initialize admin analytics configuration
    initAdminAnalyticsConfig();
  });

  beforeEach(() => {
    // Mock Fastify instance
    fastify = {
      log: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as any,
      config: {
        USAGE_CACHE_TTL_MINUTES: '5',
      } as any,
    } as Partial<FastifyInstance>;

    cacheManager = new DailyUsageCacheManager(fastify as FastifyInstance);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isCurrentDayWithGracePeriod', () => {
    it('should treat today as current day', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 14:30 UTC
      vi.setSystemTime(new Date('2025-01-15T14:30:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-15');

      expect(isCurrentDay).toBe(true);
    });

    it('should treat yesterday as historical outside grace period', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 06:00 UTC (6 hours after midnight)
      vi.setSystemTime(new Date('2025-01-15T06:00:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      expect(isCurrentDay).toBe(false);
    });

    it('should treat yesterday as current day within grace period', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 00:03:00 UTC (3 minutes after midnight)
      vi.setSystemTime(new Date('2025-01-15T00:03:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      // Within 5-minute grace period, so yesterday is treated as "current day"
      expect(isCurrentDay).toBe(true);
    });

    it('should handle exact grace period boundary (at 5 minutes)', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 00:05:00 UTC (exactly at 5-minute grace period)
      vi.setSystemTime(new Date('2025-01-15T00:05:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      expect(isCurrentDay).toBe(true);
    });

    it('should handle just after grace period boundary (at 6 minutes)', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 00:06:00 UTC (1 minute after grace period)
      vi.setSystemTime(new Date('2025-01-15T00:06:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      expect(isCurrentDay).toBe(false);
    });

    it('should treat old dates as historical even within grace period', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 00:03:00 UTC
      vi.setSystemTime(new Date('2025-01-15T00:03:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-13');

      // Two days ago, definitely historical
      expect(isCurrentDay).toBe(false);
    });

    it('should handle midnight edge case (00:00:00 UTC)', () => {
      vi.useFakeTimers();
      // Current time: Exactly midnight
      vi.setSystemTime(new Date('2025-01-15T00:00:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      // At midnight (0 minutes), within grace period
      expect(isCurrentDay).toBe(true);
    });

    it('should treat future dates as not current day', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 14:30 UTC
      vi.setSystemTime(new Date('2025-01-15T14:30:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-16');

      expect(isCurrentDay).toBe(false);
    });

    it('should increment gracePeriodApplications metric when applied', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 00:03:00 UTC (within grace period)
      vi.setSystemTime(new Date('2025-01-15T00:03:00Z'));

      const metricsBefore = (cacheManager as any).metrics.gracePeriodApplications;

      (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      const metricsAfter = (cacheManager as any).metrics.gracePeriodApplications;

      expect(metricsAfter).toBe(metricsBefore + 1);
    });

    it('should not increment metric when grace period not applied', () => {
      vi.useFakeTimers();
      // Current time: 2025-01-15 14:30 UTC (not near midnight)
      vi.setSystemTime(new Date('2025-01-15T14:30:00Z'));

      const metricsBefore = (cacheManager as any).metrics.gracePeriodApplications;

      (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-15');

      const metricsAfter = (cacheManager as any).metrics.gracePeriodApplications;

      expect(metricsAfter).toBe(metricsBefore);
    });
  });

  describe('Grace Period Scenarios', () => {
    it('should handle cache build spanning midnight correctly', () => {
      vi.useFakeTimers();
      // Scenario: Cache build starts at 23:59:58, finishes at 00:00:02
      vi.setSystemTime(new Date('2025-01-15T00:00:02Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      // Grace period should apply - cache build likely started before midnight
      expect(isCurrentDay).toBe(true);
    });

    it('should handle long cache build that finishes well after grace period', () => {
      vi.useFakeTimers();
      // Scenario: Cache build took 10 minutes, now at 00:10:00
      vi.setSystemTime(new Date('2025-01-15T00:10:00Z'));

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      // Outside grace period - should be historical
      expect(isCurrentDay).toBe(false);
    });

    it('should handle DST transition correctly (always uses UTC)', () => {
      vi.useFakeTimers();
      // UTC doesn't have DST, but testing time handling
      vi.setSystemTime(new Date('2025-03-09T00:03:00Z')); // US DST transition date

      const isCurrentDay = (cacheManager as any).isCurrentDayWithGracePeriod('2025-03-08');

      // Should work the same way regardless of DST in local timezone
      expect(isCurrentDay).toBe(true);
    });
  });

  describe('Metrics Integration', () => {
    it('should track grace period applications in metrics', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T00:02:00Z'));

      const metricsBefore = cacheManager.getMetrics().gracePeriodApplications;

      // Trigger grace period logic multiple times
      (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');
      (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');
      (cacheManager as any).isCurrentDayWithGracePeriod('2025-01-14');

      const metrics = cacheManager.getMetrics();

      expect(metrics.gracePeriodApplications).toBe(metricsBefore + 3);
    });

    it('should provide grace period count in metrics', () => {
      const metrics = cacheManager.getMetrics();

      expect(metrics).toHaveProperty('gracePeriodApplications');
      expect(typeof metrics.gracePeriodApplications).toBe('number');
    });
  });
});

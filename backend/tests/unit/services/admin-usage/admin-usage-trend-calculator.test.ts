// backend/tests/unit/services/admin-usage/admin-usage-trend-calculator.test.ts

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { AdminUsageTrendCalculator } from '../../../../src/services/admin-usage/admin-usage-trend-calculator.js';
import { initTestConfig } from '../../../helpers/test-config.js';
import type { FastifyInstance } from 'fastify';

describe('AdminUsageTrendCalculator', () => {
  let calculator: AdminUsageTrendCalculator;
  let mockFastify: Partial<FastifyInstance>;
  let configCleanup: () => void;

  // Initialize admin analytics configuration before all tests
  beforeAll(() => {
    const { cleanup } = initTestConfig();
    configCleanup = cleanup;
  });

  // Cleanup admin analytics configuration after all tests
  afterAll(() => {
    configCleanup();
  });

  beforeEach(() => {
    mockFastify = {
      log: {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
      } as any,
    };
    calculator = new AdminUsageTrendCalculator(mockFastify as FastifyInstance);
  });

  describe('calculateTrend', () => {
    it('should calculate upward trend', () => {
      const trend = calculator.calculateTrend('requests', 150, 100);
      expect(trend.current).toBe(150);
      expect(trend.previous).toBe(100);
      expect(trend.percentageChange).toBe(50);
      expect(trend.direction).toBe('up');
      expect(trend.isSignificant).toBe(true);
    });

    it('should calculate downward trend', () => {
      const trend = calculator.calculateTrend('requests', 50, 100);
      expect(trend.percentageChange).toBe(-50);
      expect(trend.direction).toBe('down');
      expect(trend.isSignificant).toBe(true);
    });

    it('should identify stable trend (< 1% change)', () => {
      const trend = calculator.calculateTrend('requests', 100, 100.5);
      expect(Math.abs(trend.percentageChange)).toBeLessThan(1);
      expect(trend.direction).toBe('stable');
      expect(trend.isSignificant).toBe(false);
    });

    it('should handle zero previous value (avoid division by zero)', () => {
      const trend = calculator.calculateTrend('requests', 100, 0);
      expect(trend.percentageChange).toBe(100);
      expect(trend.direction).toBe('up');
      expect(trend.isSignificant).toBe(true);
    });

    it('should handle both values being zero', () => {
      const trend = calculator.calculateTrend('requests', 0, 0);
      expect(trend.percentageChange).toBe(0);
      expect(trend.direction).toBe('stable');
      expect(trend.isSignificant).toBe(false);
    });

    it('should round percentage to 1 decimal place', () => {
      const trend = calculator.calculateTrend('requests', 123, 100);
      expect(trend.percentageChange).toBe(23.0); // Not 23.0000...
    });
  });

  describe('calculateAllTrends', () => {
    it('should calculate trends for all standard metrics', () => {
      const currentMetrics = {
        totalRequests: 150,
        totalTokens: 7500,
        promptTokens: 4500,
        completionTokens: 3000,
        totalCost: 1.875,
      };

      const previousMetrics = {
        totalRequests: 100,
        totalTokens: 5000,
        promptTokens: 3000,
        completionTokens: 2000,
        totalCost: 1.25,
      };

      const trends = calculator.calculateAllTrends(currentMetrics, previousMetrics);

      expect(trends).toHaveLength(5);
      expect(trends.find((t) => t.metric === 'requests')?.percentageChange).toBe(50);
      expect(trends.find((t) => t.metric === 'tokens')?.percentageChange).toBe(50);
      expect(trends.find((t) => t.metric === 'cost')?.percentageChange).toBe(50);
    });
  });

  describe('calculateUserTrends', () => {
    it('should calculate active user count trend', () => {
      const currentUsers = [
        { userId: '1', username: 'user1', totalRequests: 100, totalTokens: 5000, totalCost: 1.25 },
        { userId: '2', username: 'user2', totalRequests: 50, totalTokens: 2500, totalCost: 0.625 },
      ];

      const previousUsers = [
        { userId: '1', username: 'user1', totalRequests: 80, totalTokens: 4000, totalCost: 1.0 },
      ];

      const trends = calculator.calculateUserTrends(currentUsers, previousUsers);
      const activeUsersTrend = trends.find((t) => t.metric === 'activeUsers');

      expect(activeUsersTrend?.current).toBe(2);
      expect(activeUsersTrend?.previous).toBe(1);
      expect(activeUsersTrend?.percentageChange).toBe(100);
    });

    it('should calculate average requests per user', () => {
      const currentUsers = [
        { userId: '1', username: 'user1', totalRequests: 100, totalTokens: 5000, totalCost: 1.25 },
        { userId: '2', username: 'user2', totalRequests: 50, totalTokens: 2500, totalCost: 0.625 },
      ];

      const previousUsers = [
        { userId: '1', username: 'user1', totalRequests: 100, totalTokens: 5000, totalCost: 1.25 },
        { userId: '2', username: 'user2', totalRequests: 100, totalTokens: 5000, totalCost: 1.25 },
      ];

      const trends = calculator.calculateUserTrends(currentUsers, previousUsers);
      const avgTrend = trends.find((t) => t.metric === 'avgRequestsPerUser');

      expect(avgTrend?.current).toBe(75); // (100 + 50) / 2
      expect(avgTrend?.previous).toBe(100); // (100 + 100) / 2
      expect(avgTrend?.direction).toBe('down');
    });
  });

  describe('comparePeriods', () => {
    it('should generate period comparison summary', () => {
      const currentMetrics = {
        totalRequests: 200,
        totalTokens: 10000,
        promptTokens: 6000,
        completionTokens: 4000,
        totalCost: 2.5,
      };

      const previousMetrics = {
        totalRequests: 100,
        totalTokens: 5000,
        promptTokens: 3000,
        completionTokens: 2000,
        totalCost: 1.25,
      };

      const comparison = calculator.comparePeriods(currentMetrics, previousMetrics);

      expect(comparison.trends).toHaveLength(5);
      expect(comparison.summary.overallDirection).toBe('up');
      expect(comparison.summary.significantChanges).toBe(5); // All changed by 100%
    });

    it('should identify most increased and decreased metrics', () => {
      const currentMetrics = {
        totalRequests: 200, // +100%
        totalTokens: 7500, // +50%
        promptTokens: 3000, // 0%
        completionTokens: 2000, // 0%
        totalCost: 1.0, // -20%
      };

      const previousMetrics = {
        totalRequests: 100,
        totalTokens: 5000,
        promptTokens: 3000,
        completionTokens: 2000,
        totalCost: 1.25,
      };

      const comparison = calculator.comparePeriods(currentMetrics, previousMetrics);

      expect(comparison.summary.mostIncreased).toBe('requests');
      expect(comparison.summary.mostDecreased).toBe('cost');
    });
  });

  describe('getTrendEmoji', () => {
    it('should return correct emojis', () => {
      expect(calculator.getTrendEmoji('up')).toBe('📈');
      expect(calculator.getTrendEmoji('down')).toBe('📉');
      expect(calculator.getTrendEmoji('stable')).toBe('➡️');
    });
  });

  describe('getTrendColor', () => {
    it('should return green for upward usage trend', () => {
      expect(calculator.getTrendColor('up', 'usage')).toBe('green');
    });

    it('should return green for downward cost trend', () => {
      expect(calculator.getTrendColor('down', 'cost')).toBe('green');
    });

    it('should return red for upward cost trend', () => {
      expect(calculator.getTrendColor('up', 'cost')).toBe('red');
    });

    it('should return gray for stable trend', () => {
      expect(calculator.getTrendColor('stable', 'usage')).toBe('gray');
      expect(calculator.getTrendColor('stable', 'cost')).toBe('gray');
    });
  });
});

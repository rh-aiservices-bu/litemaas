// backend/src/services/admin-usage/admin-usage-trend-calculator.ts

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { roundTo } from './admin-usage.utils';
import { getAdminAnalyticsConfig } from '../../config/admin-analytics.config.js';

/**
 * Trend data for a single metric
 */
export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  percentageChange: number;
  direction: 'up' | 'down' | 'stable';
  isSignificant: boolean;
}

/**
 * Service for calculating usage trends and comparing periods
 *
 * Provides consistent trend calculation logic across all analytics endpoints.
 * Handles edge cases like zero division and stability thresholds.
 */
export class AdminUsageTrendCalculator extends BaseService {
  private config = getAdminAnalyticsConfig();

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  // ============================================================================
  // Single Metric Trend Calculation
  // ============================================================================

  /**
   * Calculate trend for a single metric
   *
   * Compares current period value to previous period value and determines
   * direction and magnitude of change.
   *
   * @param metric - Metric name (for logging/debugging)
   * @param current - Current period value
   * @param previous - Previous period value
   * @returns Trend data with direction and percentage change
   *
   * @example
   * calculateTrend('requests', 150, 100)
   * // Returns: { metric: 'requests', current: 150, previous: 100, percentageChange: 50, direction: 'up', isSignificant: true }
   */
  calculateTrend(metric: string, current: number, previous: number): TrendData {
    // Handle division by zero
    if (previous === 0) {
      return {
        metric,
        current,
        previous,
        percentageChange: current > 0 ? 100 : 0,
        direction: current > 0 ? 'up' : 'stable',
        isSignificant: current > 0,
      };
    }

    const percentageChange = this.calculatePercentageChange(current, previous);
    const direction = this.calculateTrendDirection(percentageChange);
    const isSignificant = Math.abs(percentageChange) >= this.config.trends.stabilityThreshold;

    return {
      metric,
      current,
      previous,
      percentageChange: roundTo(percentageChange, this.config.trends.calculationPrecision),
      direction,
      isSignificant,
    };
  }

  /**
   * Calculate percentage change between two values
   *
   * @param current - Current value
   * @param previous - Previous value
   * @returns Percentage change (positive = increase, negative = decrease)
   */
  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  /**
   * Determine trend direction based on percentage change
   *
   * Uses configured stability threshold to determine if change is significant.
   * Changes at or below threshold are considered "stable".
   *
   * @param percentageChange - Percentage change value
   * @returns Trend direction: 'up', 'down', or 'stable'
   */
  private calculateTrendDirection(percentageChange: number): 'up' | 'down' | 'stable' {
    if (Math.abs(percentageChange) <= this.config.trends.stabilityThreshold) {
      return 'stable';
    }
    return percentageChange > 0 ? 'up' : 'down';
  }

  // ============================================================================
  // Multi-Metric Trend Calculation
  // ============================================================================

  /**
   * Calculate trends for all standard metrics
   *
   * @param currentMetrics - Current period aggregated metrics
   * @param previousMetrics - Previous period aggregated metrics
   * @returns Array of trend data for each metric
   */
  calculateAllTrends(currentMetrics: UsageMetrics, previousMetrics: UsageMetrics): TrendData[] {
    return [
      this.calculateTrend('requests', currentMetrics.totalRequests, previousMetrics.totalRequests),
      this.calculateTrend('tokens', currentMetrics.totalTokens, previousMetrics.totalTokens),
      this.calculateTrend(
        'promptTokens',
        currentMetrics.promptTokens,
        previousMetrics.promptTokens,
      ),
      this.calculateTrend(
        'completionTokens',
        currentMetrics.completionTokens,
        previousMetrics.completionTokens,
      ),
      this.calculateTrend('cost', currentMetrics.totalCost, previousMetrics.totalCost),
    ];
  }

  /**
   * Calculate trends for user-specific metrics
   *
   * @param currentUsers - Current period user breakdown
   * @param previousUsers - Previous period user breakdown
   * @returns Trend data for user counts and activity
   */
  calculateUserTrends(currentUsers: UserBreakdown[], previousUsers: UserBreakdown[]): TrendData[] {
    const currentActiveUsers = currentUsers.length;
    const previousActiveUsers = previousUsers.length;

    const currentAvgRequests =
      currentUsers.length > 0
        ? currentUsers.reduce((sum, u) => sum + u.totalRequests, 0) / currentUsers.length
        : 0;

    const previousAvgRequests =
      previousUsers.length > 0
        ? previousUsers.reduce((sum, u) => sum + u.totalRequests, 0) / previousUsers.length
        : 0;

    return [
      this.calculateTrend('activeUsers', currentActiveUsers, previousActiveUsers),
      this.calculateTrend('avgRequestsPerUser', currentAvgRequests, previousAvgRequests),
    ];
  }

  /**
   * Calculate trends for model-specific metrics
   *
   * @param currentModels - Current period model breakdown
   * @param previousModels - Previous period model breakdown
   * @returns Trend data for model counts and usage
   */
  calculateModelTrends(
    currentModels: ModelBreakdown[],
    previousModels: ModelBreakdown[],
  ): TrendData[] {
    const currentUniqueModels = currentModels.length;
    const previousUniqueModels = previousModels.length;

    const currentAvgCostPerModel =
      currentModels.length > 0
        ? currentModels.reduce((sum, m) => sum + m.totalCost, 0) / currentModels.length
        : 0;

    const previousAvgCostPerModel =
      previousModels.length > 0
        ? previousModels.reduce((sum, m) => sum + m.totalCost, 0) / previousModels.length
        : 0;

    return [
      this.calculateTrend('uniqueModels', currentUniqueModels, previousUniqueModels),
      this.calculateTrend('avgCostPerModel', currentAvgCostPerModel, previousAvgCostPerModel),
    ];
  }

  // ============================================================================
  // Comparison Helpers
  // ============================================================================

  /**
   * Compare two periods and generate summary
   *
   * @param currentMetrics - Current period metrics
   * @param previousMetrics - Previous period metrics
   * @returns Comparison summary with trends and highlights
   */
  comparePeriods(currentMetrics: UsageMetrics, previousMetrics: UsageMetrics): PeriodComparison {
    const trends = this.calculateAllTrends(currentMetrics, previousMetrics);

    // Identify most significant changes
    const sortedTrends = [...trends].sort(
      (a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange),
    );

    const mostIncreased = sortedTrends.find((t) => t.direction === 'up');
    const mostDecreased = sortedTrends.find((t) => t.direction === 'down');

    return {
      trends,
      summary: {
        overallDirection: this.determineOverallDirection(trends),
        mostIncreased: mostIncreased?.metric,
        mostDecreased: mostDecreased?.metric,
        significantChanges: trends.filter((t) => t.isSignificant).length,
      },
    };
  }

  /**
   * Determine overall trend direction based on all metrics
   *
   * Uses a weighted approach: cost and requests are more important than tokens alone.
   *
   * @param trends - Array of trend data
   * @returns Overall trend direction
   */
  private determineOverallDirection(trends: TrendData[]): 'up' | 'down' | 'stable' {
    const weights: Record<string, number> = {
      cost: 3,
      requests: 2,
      tokens: 1,
      promptTokens: 0.5,
      completionTokens: 0.5,
    };

    let weightedScore = 0;
    let totalWeight = 0;

    for (const trend of trends) {
      const weight = weights[trend.metric] || 1;
      const score = trend.direction === 'up' ? 1 : trend.direction === 'down' ? -1 : 0;
      weightedScore += score * weight;
      totalWeight += weight;
    }

    const avgScore = weightedScore / totalWeight;

    if (Math.abs(avgScore) < 0.3) {
      return 'stable';
    }
    return avgScore > 0 ? 'up' : 'down';
  }

  // ============================================================================
  // Validation & Helpers
  // ============================================================================

  /**
   * Validate that two periods have same length
   *
   * @param currentDays - Number of days in current period
   * @param previousDays - Number of days in previous period
   * @returns True if periods are equal length
   */
  validatePeriodLength(currentDays: number, previousDays: number): boolean {
    return currentDays === previousDays;
  }

  /**
   * Get trend emoji for UI display
   *
   * @param direction - Trend direction
   * @returns Emoji string
   */
  getTrendEmoji(direction: 'up' | 'down' | 'stable'): string {
    const emojis: Record<typeof direction, string> = {
      up: '📈',
      down: '📉',
      stable: '➡️',
    };
    return emojis[direction];
  }

  /**
   * Get trend color for UI display
   *
   * @param direction - Trend direction
   * @param metricType - Type of metric (cost trends down is good, requests up is good)
   * @returns Color string (for CSS/PatternFly)
   */
  getTrendColor(
    direction: 'up' | 'down' | 'stable',
    metricType: 'cost' | 'usage' = 'usage',
  ): string {
    if (direction === 'stable') {
      return 'gray';
    }

    // For cost metrics, down is good (green), up is concerning (red)
    // For usage metrics, up is good (green), down might be concerning (yellow)
    if (metricType === 'cost') {
      return direction === 'down' ? 'green' : 'red';
    } else {
      return direction === 'up' ? 'green' : 'yellow';
    }
  }

  /**
   * Create empty trend data (fallback when comparison data unavailable)
   *
   * Returns a stable trend with the current value and zero previous value.
   * Used when there's no historical data to compare against.
   *
   * @param metric - Metric name
   * @param current - Current value
   * @returns Empty trend data
   */
  createEmptyTrend(metric: string, current: number): TrendData {
    return {
      metric,
      current,
      previous: 0,
      percentageChange: 0,
      direction: 'stable',
      isSignificant: false,
    };
  }

  /**
   * Create empty trends for all standard metrics
   *
   * Returns a complete set of stable trends with current values and zero previous values.
   * Used when there's no historical data to compare against.
   *
   * @param currentTotals - Current period aggregated totals
   * @returns Object with all standard trend fields
   */
  createEmptyTrendsForMetrics(currentTotals: {
    totalRequests: number;
    totalCost: number;
    activeUsers: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  }) {
    return {
      requestsTrend: this.createEmptyTrend('requests', currentTotals.totalRequests),
      costTrend: this.createEmptyTrend('cost', currentTotals.totalCost),
      usersTrend: this.createEmptyTrend('users', currentTotals.activeUsers),
      totalTokensTrend: this.createEmptyTrend('totalTokens', currentTotals.totalTokens),
      promptTokensTrend: this.createEmptyTrend('promptTokens', currentTotals.promptTokens),
      completionTokensTrend: this.createEmptyTrend(
        'completionTokens',
        currentTotals.completionTokens,
      ),
    };
  }

  /**
   * Calculate all standard trends by comparing current and previous period totals
   *
   * @param currentTotals - Current period aggregated totals
   * @param comparisonTotals - Previous period aggregated totals
   * @returns Object with all standard trend fields
   */
  calculateAllStandardTrends(
    currentTotals: {
      totalRequests: number;
      totalCost: number;
      activeUsers: number;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
    },
    comparisonTotals: {
      totalRequests: number;
      totalCost: number;
      activeUsers: number;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
    },
  ) {
    return {
      requestsTrend: this.calculateTrend(
        'requests',
        currentTotals.totalRequests,
        comparisonTotals.totalRequests,
      ),
      costTrend: this.calculateTrend('cost', currentTotals.totalCost, comparisonTotals.totalCost),
      usersTrend: this.calculateTrend(
        'users',
        currentTotals.activeUsers,
        comparisonTotals.activeUsers,
      ),
      totalTokensTrend: this.calculateTrend(
        'totalTokens',
        currentTotals.totalTokens,
        comparisonTotals.totalTokens,
      ),
      promptTokensTrend: this.calculateTrend(
        'promptTokens',
        currentTotals.promptTokens,
        comparisonTotals.promptTokens,
      ),
      completionTokensTrend: this.calculateTrend(
        'completionTokens',
        currentTotals.completionTokens,
        comparisonTotals.completionTokens,
      ),
    };
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Aggregated usage metrics for a period
 */
export interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

/**
 * User breakdown entry
 */
export interface UserBreakdown {
  userId: string;
  username: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
}

/**
 * Model breakdown entry
 */
export interface ModelBreakdown {
  model: string;
  provider: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
}

/**
 * Period comparison result
 */
export interface PeriodComparison {
  trends: TrendData[];
  summary: {
    overallDirection: 'up' | 'down' | 'stable';
    mostIncreased?: string;
    mostDecreased?: string;
    significantChanges: number;
  };
}

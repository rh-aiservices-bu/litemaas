# Phase 1, Session 1F: Extract Trend & Enrichment Services

**Phase**: 1 - Critical Blocking Issues
**Session**: 1F
**Duration**: 2-4 hours
**Priority**: 🔴 CRITICAL
**Issue**: #1 - 2,833-line Service File

---

## Navigation

**Up**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)
**Previous**: [Session 1E - Extract Export & Utilities](./phase-1-session-1e-extract-export-utilities.md)
**Next**: [Session 1G - Extract Aggregation Service](./phase-1-session-1g-extract-aggregation.md)

---

## Context

This session continues the service file refactoring effort, building on Session 1E's work. We'll extract trend calculation and data enrichment logic into dedicated services.

**Current State** (after Session 1E):

- Main service: ~2,100 lines (reduced from 2,833)
- Export service: ~300 lines ✅
- Utilities module: ~400 lines ✅

**Target State** (after this session):

- Main service: ~1,300 lines (further reduction)
- Trend calculator: ~400 lines
- Enrichment service: ~400 lines
- Export service: ~300 lines (from 1E)
- Utilities: ~400 lines (from 1E)

---

## Phase 1 Summary

**Phase 1: Critical Blocking Issues** - Service File Refactoring (Issue #1):

1. ✅ Session 1A - Rate Limiting Implementation
2. ✅ Session 1B - Date Range Validation
3. ✅ Session 1C - Fix ResizeObserver Memory Leak
4. ✅ Session 1D - Create Migration Rollback
5. ✅ Session 1E - Extract Export & Utilities
6. **🔵 Session 1F - Extract Trend & Enrichment Services** (YOU ARE HERE)
7. Session 1G - Extract Aggregation Service
8. Session 1H - Refactor Main Service as Orchestrator

---

## Session Objectives

Extract trend calculation logic and data enrichment (user/API key mapping) into separate, focused services.

**Deliverables**:

- `AdminUsageTrendCalculator` service (~400 lines)
- `AdminUsageEnrichmentService` service (~400 lines)
- Tests for both services
- Updated main service delegating to new services
- ~800 additional lines removed from main service

**Why This Matters**:

- **Trend Calculator**: Complex business logic for comparing periods, calculating deltas, determining trend direction
- **Enrichment Service**: Database-heavy operations for user/API key lookups, avoiding N+1 queries

---

## Pre-Session Checklist

- [ ] Session 1E completed and committed
- [ ] All tests passing from Session 1E
- [ ] Review trend calculation logic in main service
- [ ] Review enrichment logic in main service
- [ ] Identify database queries used by enrichment
- [ ] Plan to avoid N+1 query problems
- [ ] Update feature branch: `git checkout refactor/session-1e-extract-export-utils` or create new branch

---

## Implementation Steps

### Step 1F.1: Create Trend Calculator Service (1-1.5 hours)

**Objective**: Extract all trend calculation logic into a dedicated service.

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage-trend-calculator.ts`

**Methods to Extract**:

- `calculateTrend()` - Calculate trend for a single metric
- `calculateTrendDirection()` - Determine up/down/stable
- `calculateAllTrends()` - Calculate trends for all metrics
- `calculatePercentageChange()` - Calculate percentage difference
- `comparePeriods()` - Compare current vs previous period

**Implementation**:

Create `backend/src/services/admin-usage/admin-usage-trend-calculator.ts`:

```typescript
// backend/src/services/admin-usage/admin-usage-trend-calculator.ts

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { TREND_STABILITY_THRESHOLD, roundTo } from './admin-usage.utils';

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
    const isSignificant = Math.abs(percentageChange) >= TREND_STABILITY_THRESHOLD;

    return {
      metric,
      current,
      previous,
      percentageChange: roundTo(percentageChange, 1),
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
   * Uses TREND_STABILITY_THRESHOLD to determine if change is significant.
   * Changes below threshold are considered "stable".
   *
   * @param percentageChange - Percentage change value
   * @returns Trend direction: 'up', 'down', or 'stable'
   */
  private calculateTrendDirection(percentageChange: number): 'up' | 'down' | 'stable' {
    if (Math.abs(percentageChange) < TREND_STABILITY_THRESHOLD) {
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
```

**Create Tests**:

Create `backend/tests/unit/services/admin-usage/admin-usage-trend-calculator.test.ts`:

```typescript
// backend/tests/unit/services/admin-usage/admin-usage-trend-calculator.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { buildFastifyApp } from '../../../helpers/test-app';
import { AdminUsageTrendCalculator } from '../../../../src/services/admin-usage/admin-usage-trend-calculator';

describe('AdminUsageTrendCalculator', () => {
  let fastify: any;
  let calculator: AdminUsageTrendCalculator;

  beforeEach(async () => {
    fastify = await buildFastifyApp();
    calculator = new AdminUsageTrendCalculator(fastify);
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
```

---

### Step 1F.2: Create Enrichment Service (1-1.5 hours)

**Objective**: Extract user and API key enrichment logic, with optimized database queries to avoid N+1 problems.

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage-enrichment.service.ts`

**Methods to Extract**:

- `enrichWithUserData()` - Add user info to usage data
- `enrichWithAPIKeyData()` - Add API key info
- `getUserMapping()` - Batch fetch users
- `getAPIKeyMapping()` - Batch fetch API keys
- `createUnknownUser()` - Handle missing user data

**Implementation**:

Create `backend/src/services/admin-usage/admin-usage-enrichment.service.ts`:

```typescript
// backend/src/services/admin-usage/admin-usage-enrichment.service.ts

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { ApplicationError } from '../../utils/errors';
import { UNKNOWN_USER_ID, UNKNOWN_USERNAME } from './admin-usage.utils';

/**
 * Service for enriching usage data with user and API key information
 *
 * Provides efficient data enrichment using batch queries to avoid N+1 problems.
 * Handles missing data gracefully with unknown user/key placeholders.
 */
export class AdminUsageEnrichmentService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  // ============================================================================
  // User Enrichment
  // ============================================================================

  /**
   * Enrich usage data with user information
   *
   * Takes usage data keyed by API key and enriches with user details.
   * Uses batch queries to efficiently fetch user data.
   *
   * @param apiKeyUsage - Map of API key hash to usage data
   * @returns Map enriched with user data (userId, username, email, role)
   */
  async enrichWithUserData(apiKeyUsage: Map<string, UsageData>): Promise<EnrichedUsageData[]> {
    try {
      // Get API key to user mapping (batch query)
      const apiKeys = Array.from(apiKeyUsage.keys());
      const apiKeyMapping = await this.getAPIKeyUserMapping(apiKeys);

      // Get unique user IDs
      const userIds = [
        ...new Set(
          Object.values(apiKeyMapping)
            .map((m) => m.userId)
            .filter((id) => id !== null),
        ),
      ];

      // Batch fetch user data
      const users = await this.getUsersById(userIds);
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Enrich each entry
      const enriched: EnrichedUsageData[] = [];

      for (const [apiKey, usage] of apiKeyUsage.entries()) {
        const mapping = apiKeyMapping[apiKey];
        const user = mapping ? userMap.get(mapping.userId) : null;

        enriched.push({
          ...usage,
          apiKeyHash: apiKey,
          apiKeyAlias: mapping?.keyAlias || 'Unknown Key',
          userId: user?.id || UNKNOWN_USER_ID,
          username: user?.username || UNKNOWN_USERNAME,
          email: user?.email || null,
          role: user?.role || 'user',
        });
      }

      return enriched;
    } catch (error) {
      this.fastify.log.error({ error }, 'Failed to enrich with user data');
      throw ApplicationError.internal('Failed to enrich usage data', { error });
    }
  }

  /**
   * Batch fetch API key to user mapping
   *
   * Uses single query with IN clause to avoid N+1 problem.
   *
   * @param apiKeys - Array of API key hashes
   * @returns Mapping of API key to user ID and alias
   */
  private async getAPIKeyUserMapping(
    apiKeys: string[],
  ): Promise<Record<string, { userId: string; keyAlias: string }>> {
    if (apiKeys.length === 0) {
      return {};
    }

    try {
      // Single query for all API keys
      const result = await this.fastify.pg.query(
        `SELECT key_hash, user_id, name
         FROM api_keys
         WHERE key_hash = ANY($1)
           AND deleted_at IS NULL`,
        [apiKeys],
      );

      // Build mapping
      return result.rows.reduce(
        (acc, row) => {
          acc[row.key_hash] = {
            userId: row.user_id,
            keyAlias: row.name || 'Unnamed Key',
          };
          return acc;
        },
        {} as Record<string, { userId: string; keyAlias: string }>,
      );
    } catch (error) {
      this.fastify.log.error(
        { error, apiKeyCount: apiKeys.length },
        'Failed to fetch API key mapping',
      );
      throw ApplicationError.internal('Failed to fetch API key mapping', { error });
    }
  }

  /**
   * Batch fetch users by IDs
   *
   * Uses single query with IN clause to avoid N+1 problem.
   *
   * @param userIds - Array of user IDs
   * @returns Array of user objects
   */
  private async getUsersById(userIds: string[]): Promise<UserData[]> {
    if (userIds.length === 0) {
      return [];
    }

    try {
      // Single query for all users
      const result = await this.fastify.pg.query(
        `SELECT id, username, email, role
         FROM users
         WHERE id = ANY($1)
           AND deleted_at IS NULL`,
        [userIds],
      );

      return result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
      }));
    } catch (error) {
      this.fastify.log.error({ error, userIdCount: userIds.length }, 'Failed to fetch users');
      throw ApplicationError.internal('Failed to fetch users', { error });
    }
  }

  // ============================================================================
  // Aggregation by User
  // ============================================================================

  /**
   * Aggregate enriched usage data by user
   *
   * Combines usage from multiple API keys belonging to same user.
   *
   * @param enrichedData - Array of enriched usage data
   * @returns Map of user ID to aggregated usage
   */
  aggregateByUser(enrichedData: EnrichedUsageData[]): Map<string, UserUsageAggregate> {
    const userAggregates = new Map<string, UserUsageAggregate>();

    for (const data of enrichedData) {
      const userId = data.userId;
      const existing = userAggregates.get(userId);

      if (existing) {
        // Add to existing aggregate
        existing.totalRequests += data.totalRequests;
        existing.totalTokens += data.totalTokens;
        existing.promptTokens += data.promptTokens;
        existing.completionTokens += data.completionTokens;
        existing.totalCost += data.totalCost;
        existing.apiKeyCount += 1;
      } else {
        // Create new aggregate
        userAggregates.set(userId, {
          userId: data.userId,
          username: data.username,
          email: data.email,
          role: data.role,
          totalRequests: data.totalRequests,
          totalTokens: data.totalTokens,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalCost: data.totalCost,
          apiKeyCount: 1,
        });
      }
    }

    return userAggregates;
  }

  /**
   * Aggregate enriched usage data by model
   *
   * Groups usage by model name across all users.
   *
   * @param enrichedData - Array of enriched usage data (with model info)
   * @returns Map of model name to aggregated usage
   */
  aggregateByModel(enrichedData: EnrichedUsageDataWithModel[]): Map<string, ModelUsageAggregate> {
    const modelAggregates = new Map<string, ModelUsageAggregate>();

    for (const data of enrichedData) {
      const modelKey = `${data.model}|${data.provider || 'unknown'}`;
      const existing = modelAggregates.get(modelKey);

      if (existing) {
        existing.totalRequests += data.totalRequests;
        existing.totalTokens += data.totalTokens;
        existing.promptTokens += data.promptTokens;
        existing.completionTokens += data.completionTokens;
        existing.totalCost += data.totalCost;
        existing.uniqueUsers.add(data.userId);
      } else {
        modelAggregates.set(modelKey, {
          model: data.model,
          provider: data.provider,
          totalRequests: data.totalRequests,
          totalTokens: data.totalTokens,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalCost: data.totalCost,
          uniqueUsers: new Set([data.userId]),
        });
      }
    }

    return modelAggregates;
  }

  // ============================================================================
  // Validation & Helpers
  // ============================================================================

  /**
   * Check if user data is complete
   *
   * @param userData - User data to check
   * @returns True if all required fields present
   */
  isCompleteUserData(userData: Partial<UserData>): boolean {
    return !!(userData.id && userData.username);
  }

  /**
   * Create unknown user placeholder
   *
   * @returns Unknown user data object
   */
  createUnknownUser(): UserData {
    return {
      id: UNKNOWN_USER_ID,
      username: UNKNOWN_USERNAME,
      email: null,
      role: 'user',
    };
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Basic usage data (not yet enriched)
 */
export interface UsageData {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

/**
 * Enriched usage data with user info
 */
export interface EnrichedUsageData extends UsageData {
  apiKeyHash: string;
  apiKeyAlias: string;
  userId: string;
  username: string;
  email: string | null;
  role: string;
}

/**
 * Enriched usage data with model info
 */
export interface EnrichedUsageDataWithModel extends EnrichedUsageData {
  model: string;
  provider: string | null;
}

/**
 * User data from database
 */
export interface UserData {
  id: string;
  username: string;
  email: string | null;
  role: string;
}

/**
 * Aggregated usage by user
 */
export interface UserUsageAggregate {
  userId: string;
  username: string;
  email: string | null;
  role: string;
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  apiKeyCount: number;
}

/**
 * Aggregated usage by model
 */
export interface ModelUsageAggregate {
  model: string;
  provider: string | null;
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  uniqueUsers: Set<string>;
}
```

**Create Tests** (abbreviated for space):

Create `backend/tests/unit/services/admin-usage/admin-usage-enrichment.service.test.ts`:

```typescript
// backend/tests/unit/services/admin-usage/admin-usage-enrichment.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildFastifyApp } from '../../../helpers/test-app';
import { AdminUsageEnrichmentService } from '../../../../src/services/admin-usage/admin-usage-enrichment.service';

describe('AdminUsageEnrichmentService', () => {
  let fastify: any;
  let enrichmentService: AdminUsageEnrichmentService;

  beforeEach(async () => {
    fastify = await buildFastifyApp();
    enrichmentService = new AdminUsageEnrichmentService(fastify);

    // Mock database queries
    fastify.pg.query = vi.fn();
  });

  describe('enrichWithUserData', () => {
    it('should enrich usage data with user information', async () => {
      const apiKeyUsage = new Map([
        [
          'key1',
          {
            totalRequests: 100,
            totalTokens: 5000,
            promptTokens: 3000,
            completionTokens: 2000,
            totalCost: 1.25,
          },
        ],
      ]);

      // Mock API key mapping query
      fastify.pg.query.mockResolvedValueOnce({
        rows: [
          {
            key_hash: 'key1',
            user_id: 'user-1',
            name: 'My API Key',
          },
        ],
      });

      // Mock user query
      fastify.pg.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            username: 'john.doe',
            email: 'john@example.com',
            role: 'user',
          },
        ],
      });

      const enriched = await enrichmentService.enrichWithUserData(apiKeyUsage);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].userId).toBe('user-1');
      expect(enriched[0].username).toBe('john.doe');
      expect(enriched[0].email).toBe('john@example.com');
      expect(enriched[0].apiKeyAlias).toBe('My API Key');
      expect(enriched[0].totalRequests).toBe(100);
    });

    it('should handle unknown users gracefully', async () => {
      const apiKeyUsage = new Map([
        [
          'unknown-key',
          {
            totalRequests: 10,
            totalTokens: 500,
            promptTokens: 300,
            completionTokens: 200,
            totalCost: 0.125,
          },
        ],
      ]);

      // Mock empty API key mapping (key not found)
      fastify.pg.query.mockResolvedValueOnce({ rows: [] });

      // Mock empty user query
      fastify.pg.query.mockResolvedValueOnce({ rows: [] });

      const enriched = await enrichmentService.enrichWithUserData(apiKeyUsage);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].userId).toBe('00000000-0000-0000-0000-000000000000');
      expect(enriched[0].username).toBe('Unknown User');
      expect(enriched[0].apiKeyAlias).toBe('Unknown Key');
    });

    it('should use single query for multiple API keys (avoid N+1)', async () => {
      const apiKeyUsage = new Map([
        [
          'key1',
          {
            totalRequests: 100,
            totalTokens: 5000,
            promptTokens: 3000,
            completionTokens: 2000,
            totalCost: 1.25,
          },
        ],
        [
          'key2',
          {
            totalRequests: 50,
            totalTokens: 2500,
            promptTokens: 1500,
            completionTokens: 1000,
            totalCost: 0.625,
          },
        ],
        [
          'key3',
          {
            totalRequests: 25,
            totalTokens: 1250,
            promptTokens: 750,
            completionTokens: 500,
            totalCost: 0.3125,
          },
        ],
      ]);

      // Mock API key mapping (all in single query)
      fastify.pg.query.mockResolvedValueOnce({
        rows: [
          { key_hash: 'key1', user_id: 'user-1', name: 'Key 1' },
          { key_hash: 'key2', user_id: 'user-1', name: 'Key 2' },
          { key_hash: 'key3', user_id: 'user-2', name: 'Key 3' },
        ],
      });

      // Mock user query (all in single query)
      fastify.pg.query.mockResolvedValueOnce({
        rows: [
          { id: 'user-1', username: 'john.doe', email: 'john@example.com', role: 'user' },
          { id: 'user-2', username: 'jane.smith', email: 'jane@example.com', role: 'admin' },
        ],
      });

      await enrichmentService.enrichWithUserData(apiKeyUsage);

      // Should have called pg.query exactly twice (not 6 times for N+1)
      expect(fastify.pg.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('aggregateByUser', () => {
    it('should combine usage from multiple API keys for same user', () => {
      const enrichedData = [
        {
          apiKeyHash: 'key1',
          apiKeyAlias: 'Key 1',
          userId: 'user-1',
          username: 'john.doe',
          email: 'john@example.com',
          role: 'user',
          totalRequests: 100,
          totalTokens: 5000,
          promptTokens: 3000,
          completionTokens: 2000,
          totalCost: 1.25,
        },
        {
          apiKeyHash: 'key2',
          apiKeyAlias: 'Key 2',
          userId: 'user-1',
          username: 'john.doe',
          email: 'john@example.com',
          role: 'user',
          totalRequests: 50,
          totalTokens: 2500,
          promptTokens: 1500,
          completionTokens: 1000,
          totalCost: 0.625,
        },
      ];

      const aggregated = enrichmentService.aggregateByUser(enrichedData);

      expect(aggregated.size).toBe(1);
      const userAggregate = aggregated.get('user-1');
      expect(userAggregate?.totalRequests).toBe(150);
      expect(userAggregate?.totalTokens).toBe(7500);
      expect(userAggregate?.totalCost).toBe(1.875);
      expect(userAggregate?.apiKeyCount).toBe(2);
    });
  });
});
```

---

### Step 1F.3: Update Main Service (30 minutes)

**Files to Modify**:

- `backend/src/services/admin-usage-stats.service.ts`

**Changes**:

```typescript
// Import new services
import { AdminUsageTrendCalculator } from './admin-usage/admin-usage-trend-calculator';
import { AdminUsageEnrichmentService } from './admin-usage/admin-usage-enrichment.service';

export class AdminUsageStatsService extends BaseService {
  private trendCalculator: AdminUsageTrendCalculator;
  private enrichmentService: AdminUsageEnrichmentService;
  // ... existing services

  constructor(/* ... */) {
    super(fastify);
    // ... existing initialization
    this.trendCalculator = new AdminUsageTrendCalculator(fastify);
    this.enrichmentService = new AdminUsageEnrichmentService(fastify);
  }

  // Delegate trend calculations
  private calculateTrends(
    currentMetrics: UsageMetrics,
    previousMetrics: UsageMetrics,
  ): TrendData[] {
    return this.trendCalculator.calculateAllTrends(currentMetrics, previousMetrics);
  }

  // Delegate enrichment
  private async enrichUsageData(apiKeyUsage: Map<string, UsageData>): Promise<EnrichedUsageData[]> {
    return this.enrichmentService.enrichWithUserData(apiKeyUsage);
  }

  // Remove extracted methods (now in trend calculator):
  // - calculateTrend()
  // - calculateTrendDirection()
  // - calculatePercentageChange()
  // - comparePeriods()

  // Remove extracted methods (now in enrichment service):
  // - enrichWithUserData()
  // - getAPIKeyUserMapping()
  // - getUsersById()
  // - aggregateByUser()
}
```

---

### Step 1F.4: Test & Commit (30 minutes)

**Test**:

```bash
# Run new tests
npm --prefix backend test -- admin-usage-trend-calculator.test.ts
npm --prefix backend test -- admin-usage-enrichment.service.test.ts

# Run full test suite
npm --prefix backend test

# Type check
npm --prefix backend run type-check
```

**Commit**:

```bash
git add backend/src/services/admin-usage/
git add backend/tests/unit/services/admin-usage/
git add backend/src/services/admin-usage-stats.service.ts

git commit -m "refactor: extract trend calculator and enrichment services

- Create AdminUsageTrendCalculator for trend analysis (~400 lines)
  - Single metric trend calculation with direction and significance
  - Multi-metric trend calculation for all standard metrics
  - Period comparison with summary statistics
  - Helper methods for UI display (emojis, colors)
- Create AdminUsageEnrichmentService for user/API key enrichment (~400 lines)
  - Batch queries to avoid N+1 problems
  - User data enrichment from API keys
  - Aggregation by user and model
  - Graceful handling of missing data
- Update main service to use extracted services
- Add comprehensive tests for both services
- All existing tests pass

Reduces main service file by ~800 additional lines
Related to Issue #1: Service file size reduction
Phase 1, Session 1F of refactoring plan

Actual time: X hours (estimated: 2-4 hours)"
```

---

## Deliverables

**Files Created**:

- ✅ `backend/src/services/admin-usage/admin-usage-trend-calculator.ts` (~400 lines)
- ✅ `backend/src/services/admin-usage/admin-usage-enrichment.service.ts` (~400 lines)
- ✅ `backend/tests/unit/services/admin-usage/admin-usage-trend-calculator.test.ts`
- ✅ `backend/tests/unit/services/admin-usage/admin-usage-enrichment.service.test.ts`

**Files Modified**:

- ✅ `backend/src/services/admin-usage-stats.service.ts` (reduced by ~800 lines)

**Cumulative Progress** (after Sessions 1E + 1F):

- Main service: ~1,300 lines (reduced from 2,833)
- Extracted services: 4 files, ~1,500 lines total
- Total reduction: ~1,500 lines from main service

---

## Acceptance Criteria

**Code Quality**:

- ✅ Trend calculator < 500 lines
- ✅ Enrichment service < 500 lines
- ✅ All methods have JSDoc comments
- ✅ TypeScript strict mode compliance
- ✅ No linter warnings

**Functionality**:

- ✅ Trend calculation accurate (percentage, direction, significance)
- ✅ Enrichment uses batch queries (verified in tests)
- ✅ Unknown users handled gracefully
- ✅ All aggregation logic preserved

**Testing**:

- ✅ Test coverage > 90%
- ✅ Edge cases tested (zero division, empty arrays, unknown users)
- ✅ N+1 query prevention verified
- ✅ All existing tests passing

---

## Next Steps

**Next Session** (1G):

- Extract aggregation service (~800 lines)
- Most complex extraction (JSONB aggregation logic)
- Further reduce main service size

**Link**: [Session 1G - Extract Aggregation Service](./phase-1-session-1g-extract-aggregation.md)

---

_Last Updated: 2025-10-11_
_Session Status: Ready for Execution_

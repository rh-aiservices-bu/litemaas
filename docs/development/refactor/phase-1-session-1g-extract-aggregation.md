# Phase 1, Session 1G: Extract Aggregation Service

**Phase**: 1 - Critical Blocking Issues
**Session**: 1G
**Duration**: 2-4 hours
**Priority**: 🔴 CRITICAL
**Issue**: #1 - 2,833-line Service File

---

## Navigation

**Up**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)
**Previous**: [Session 1F - Extract Trend & Enrichment Services](./phase-1-session-1f-extract-trend-enrichment.md)
**Next**: [Session 1H - Refactor Main Service as Orchestrator](./phase-1-session-1h-refactor-orchestrator.md)

---

## Context

This session tackles the most complex part of the refactoring: extracting the core aggregation logic that processes JSONB data from the daily usage cache and LiteLLM API.

**Current State** (after Sessions 1E-1F):

- Main service: ~1,300 lines
- Export service: ~300 lines ✅
- Utilities: ~400 lines ✅
- Trend calculator: ~400 lines ✅
- Enrichment service: ~400 lines ✅

**Target State** (after this session):

- Main service: ~500 lines (orchestrator only)
- Aggregation service: ~800 lines (complex JSONB logic)
- Total: 5 services + utilities, all < 900 lines

---

## Phase 1 Summary

**Phase 1: Critical Blocking Issues** - Service File Refactoring (Issue #1):

1. ✅ Session 1A - Rate Limiting Implementation
2. ✅ Session 1B - Date Range Validation
3. ✅ Session 1C - Fix ResizeObserver Memory Leak
4. ✅ Session 1D - Create Migration Rollback
5. ✅ Session 1E - Extract Export & Utilities
6. ✅ Session 1F - Extract Trend & Enrichment Services
7. **🔵 Session 1G - Extract Aggregation Service** (YOU ARE HERE)
8. Session 1H - Refactor Main Service as Orchestrator

---

## Session Objectives

Extract the core aggregation logic that processes usage data from multiple sources (cache and LiteLLM API) and performs complex JSONB operations.

**Deliverables**:

- `AdminUsageAggregationService` class (~800 lines)
- Tests for aggregation service
- Updated main service delegating to aggregation service
- ~800 additional lines removed from main service

**Why This Matters**:

- **Most Complex Logic**: JSONB aggregation, nested data structures, cache management
- **Performance Critical**: Handles large datasets efficiently
- **Core Business Logic**: Aggregation rules define analytics accuracy

---

## Pre-Session Checklist

- [ ] Sessions 1E-1F completed and committed
- [ ] All tests passing from previous sessions
- [ ] Review aggregation methods in main service
- [ ] Review daily usage cache structure (JSONB columns)
- [ ] Review LiteLLM API response structure
- [ ] Understand cache vs live data merge logic
- [ ] Plan for handling partial cache data

---

## Implementation Steps

### Step 1G.1: Create Aggregation Service (2-3 hours)

**Objective**: Extract all aggregation logic into a dedicated service.

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage-aggregation.service.ts`

**Methods to Extract**:

- `aggregateUsageData()` - Main aggregation orchestrator
- `aggregateFromCache()` - Aggregate cached daily data
- `aggregateFromLiteLLM()` - Aggregate live LiteLLM data
- `mergeAggregations()` - Merge cached and live data
- `aggregateByUser()` - Group by user ID
- `aggregateByModel()` - Group by model name
- `aggregateByProvider()` - Group by provider name
- `processJSONBAggregation()` - Extract data from JSONB columns
- `calculateTotals()` - Sum metrics across aggregations

**Implementation**:

Create `backend/src/services/admin-usage/admin-usage-aggregation.service.ts`:

```typescript
// backend/src/services/admin-usage/admin-usage-aggregation.service.ts

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { ApplicationError } from '../../utils/errors';
import type { AdminUsageFilters } from '../../types/admin-usage.types';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ensureNumber, roundTo } from './admin-usage.utils';

/**
 * Service for aggregating usage data from cache and LiteLLM API
 *
 * Handles complex JSONB aggregation from daily usage cache and merges with
 * live data from LiteLLM API. Provides aggregation by user, model, and provider.
 */
export class AdminUsageAggregationService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  // ============================================================================
  // Main Aggregation Orchestration
  // ============================================================================

  /**
   * Aggregate usage data based on filters
   *
   * Coordinates data fetching from cache and LiteLLM API, merges results,
   * and returns aggregated data.
   *
   * @param filters - Admin usage filters
   * @param aggregationType - Type of aggregation ('user', 'model', 'provider', 'total')
   * @returns Aggregated usage data
   */
  async aggregateUsageData(
    filters: AdminUsageFilters,
    aggregationType: AggregationType,
  ): Promise<AggregationResult> {
    try {
      const { startDate, endDate } = filters;
      const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;

      this.fastify.log.debug(
        {
          filters,
          aggregationType,
          days,
        },
        'Starting usage data aggregation',
      );

      // Fetch data from cache (completed days)
      const cachedData = await this.aggregateFromCache(filters, aggregationType);

      // Check if we need live data (includes today or recent data)
      const needsLiveData = this.shouldFetchLiveData(endDate);

      let liveData: AggregationResult | null = null;
      if (needsLiveData) {
        liveData = await this.aggregateFromLiteLLM(filters, aggregationType);
      }

      // Merge cached and live data
      const mergedData = this.mergeAggregations(cachedData, liveData, aggregationType);

      this.fastify.log.debug(
        {
          cachedRecords: cachedData?.recordCount || 0,
          liveRecords: liveData?.recordCount || 0,
          mergedRecords: mergedData.recordCount,
        },
        'Aggregation complete',
      );

      return mergedData;
    } catch (error) {
      this.fastify.log.error({ error, filters, aggregationType }, 'Failed to aggregate usage data');
      throw ApplicationError.internal('Failed to aggregate usage data', { error });
    }
  }

  // ============================================================================
  // Cache Aggregation
  // ============================================================================

  /**
   * Aggregate data from daily usage cache
   *
   * Reads JSONB columns from cache and performs aggregation by type.
   *
   * @param filters - Admin usage filters
   * @param aggregationType - Type of aggregation
   * @returns Aggregated data from cache
   */
  private async aggregateFromCache(
    filters: AdminUsageFilters,
    aggregationType: AggregationType,
  ): Promise<AggregationResult> {
    const { startDate, endDate, userIds, models, providers, apiKeys } = filters;

    try {
      // Select appropriate JSONB column based on aggregation type
      const jsonbColumn = this.getJSONBColumnForAggregation(aggregationType);

      // Build query
      const query = `
        SELECT
          date,
          ${jsonbColumn} as data,
          raw_data
        FROM daily_usage_cache
        WHERE date >= $1 AND date <= $2
          AND cache_status = 'complete'
        ORDER BY date
      `;

      const result = await this.fastify.pg.query(query, [startDate, endDate]);

      if (result.rows.length === 0) {
        return this.createEmptyAggregation(aggregationType);
      }

      // Process JSONB data from each day
      const aggregations: Map<string, UsageMetrics> = new Map();

      for (const row of result.rows) {
        const dayData = row.data as Record<string, any>;

        for (const [key, metrics] of Object.entries(dayData)) {
          // Apply filters
          if (!this.meetsFilterCriteria(key, metrics, filters)) {
            continue;
          }

          // Aggregate metrics
          const existing = aggregations.get(key);
          if (existing) {
            this.addMetrics(existing, metrics);
          } else {
            aggregations.set(key, this.extractMetrics(metrics));
          }
        }
      }

      return this.formatAggregationResult(aggregations, aggregationType);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to aggregate from cache');
      throw ApplicationError.internal('Failed to aggregate from cache', { error });
    }
  }

  /**
   * Get JSONB column name for aggregation type
   *
   * @param aggregationType - Type of aggregation
   * @returns Column name in daily_usage_cache table
   */
  private getJSONBColumnForAggregation(aggregationType: AggregationType): string {
    const columnMap: Record<AggregationType, string> = {
      user: 'aggregated_by_user',
      model: 'aggregated_by_model',
      provider: 'aggregated_by_provider',
      total: 'raw_data', // Use raw data for total aggregation
    };
    return columnMap[aggregationType];
  }

  /**
   * Process JSONB aggregation data
   *
   * Handles the complex nested structure of JSONB columns:
   * - aggregated_by_user: { "user-id": { totalRequests, tokens: { prompt, completion }, cost } }
   * - aggregated_by_model: { "model-name": { ... } }
   * - aggregated_by_provider: { "provider-name": { ... } }
   *
   * @param jsonbData - JSONB data from cache column
   * @returns Map of key to metrics
   */
  private processJSONBAggregation(jsonbData: Record<string, any>): Map<string, UsageMetrics> {
    const result = new Map<string, UsageMetrics>();

    for (const [key, value] of Object.entries(jsonbData)) {
      result.set(key, this.extractMetrics(value));
    }

    return result;
  }

  /**
   * Extract usage metrics from JSONB value
   *
   * Handles both old and new JSONB structures for backward compatibility.
   *
   * @param value - JSONB value object
   * @returns Normalized usage metrics
   */
  private extractMetrics(value: any): UsageMetrics {
    // New structure (after migration):
    // { totalRequests, tokens: { prompt, completion, total }, cost }
    //
    // Old structure (before migration):
    // { totalRequests, totalTokens, cost }

    const hasTokenBreakdown = value.tokens && typeof value.tokens === 'object';

    return {
      totalRequests: ensureNumber(value.totalRequests, 0),
      totalTokens: hasTokenBreakdown
        ? ensureNumber(value.tokens.total, 0)
        : ensureNumber(value.totalTokens, 0),
      promptTokens: hasTokenBreakdown ? ensureNumber(value.tokens.prompt, 0) : 0,
      completionTokens: hasTokenBreakdown ? ensureNumber(value.tokens.completion, 0) : 0,
      totalCost: ensureNumber(value.cost, 0),
    };
  }

  /**
   * Add metrics to existing aggregate
   *
   * @param target - Target metrics to update
   * @param source - Source metrics to add
   */
  private addMetrics(target: UsageMetrics, source: any): void {
    const sourceMetrics = this.extractMetrics(source);
    target.totalRequests += sourceMetrics.totalRequests;
    target.totalTokens += sourceMetrics.totalTokens;
    target.promptTokens += sourceMetrics.promptTokens;
    target.completionTokens += sourceMetrics.completionTokens;
    target.totalCost += sourceMetrics.totalCost;
  }

  // ============================================================================
  // LiteLLM Aggregation
  // ============================================================================

  /**
   * Aggregate data from LiteLLM API
   *
   * Fetches and processes raw usage data from LiteLLM for dates not in cache.
   *
   * @param filters - Admin usage filters
   * @param aggregationType - Type of aggregation
   * @returns Aggregated data from LiteLLM
   */
  private async aggregateFromLiteLLM(
    filters: AdminUsageFilters,
    aggregationType: AggregationType,
  ): Promise<AggregationResult> {
    try {
      // Fetch raw data from LiteLLM
      const rawData = await this.fetchLiteLLMData(filters);

      if (rawData.length === 0) {
        return this.createEmptyAggregation(aggregationType);
      }

      // Aggregate by type
      const aggregations = this.aggregateLiteLLMData(rawData, aggregationType, filters);

      return this.formatAggregationResult(aggregations, aggregationType);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to aggregate from LiteLLM');
      throw ApplicationError.internal('Failed to aggregate from LiteLLM', { error });
    }
  }

  /**
   * Fetch raw usage data from LiteLLM API
   *
   * @param filters - Admin usage filters
   * @returns Array of raw usage records
   */
  private async fetchLiteLLMData(filters: AdminUsageFilters): Promise<LiteLLMUsageRecord[]> {
    const { startDate, endDate } = filters;

    // Call LiteLLM spend/logs endpoint
    // Note: Actual implementation depends on LiteLLM service integration
    const response = await this.fastify.liteLLM.getUsageLogs({
      startDate,
      endDate,
    });

    return response.data || [];
  }

  /**
   * Aggregate LiteLLM raw data by type
   *
   * @param rawData - Array of raw usage records
   * @param aggregationType - Type of aggregation
   * @param filters - Filters to apply
   * @returns Map of aggregated metrics
   */
  private aggregateLiteLLMData(
    rawData: LiteLLMUsageRecord[],
    aggregationType: AggregationType,
    filters: AdminUsageFilters,
  ): Map<string, UsageMetrics> {
    const aggregations = new Map<string, UsageMetrics>();

    for (const record of rawData) {
      // Get aggregation key
      const key = this.getAggregationKey(record, aggregationType);

      // Apply filters
      if (!this.recordMeetsFilters(record, filters)) {
        continue;
      }

      // Extract or create metrics
      const existing = aggregations.get(key);
      if (existing) {
        existing.totalRequests += 1;
        existing.totalTokens += record.tokens || 0;
        existing.promptTokens += record.prompt_tokens || 0;
        existing.completionTokens += record.completion_tokens || 0;
        existing.totalCost += record.cost || 0;
      } else {
        aggregations.set(key, {
          totalRequests: 1,
          totalTokens: record.tokens || 0,
          promptTokens: record.prompt_tokens || 0,
          completionTokens: record.completion_tokens || 0,
          totalCost: record.cost || 0,
        });
      }
    }

    return aggregations;
  }

  /**
   * Get aggregation key for a record
   *
   * @param record - LiteLLM usage record
   * @param aggregationType - Type of aggregation
   * @returns Key string for aggregation map
   */
  private getAggregationKey(record: LiteLLMUsageRecord, aggregationType: AggregationType): string {
    switch (aggregationType) {
      case 'user':
        return record.user_id || 'unknown';
      case 'model':
        return `${record.model}|${record.provider || 'unknown'}`;
      case 'provider':
        return record.provider || 'unknown';
      case 'total':
        return 'total';
      default:
        return 'unknown';
    }
  }

  // ============================================================================
  // Merge & Filter Logic
  // ============================================================================

  /**
   * Merge cached and live aggregations
   *
   * @param cached - Cached aggregation result
   * @param live - Live aggregation result (nullable)
   * @param aggregationType - Type of aggregation
   * @returns Merged aggregation result
   */
  private mergeAggregations(
    cached: AggregationResult,
    live: AggregationResult | null,
    aggregationType: AggregationType,
  ): AggregationResult {
    if (!live || live.recordCount === 0) {
      return cached;
    }

    if (cached.recordCount === 0) {
      return live;
    }

    // Merge data maps
    const mergedData = new Map(cached.data);

    for (const [key, liveMetrics] of live.data.entries()) {
      const cachedMetrics = mergedData.get(key);
      if (cachedMetrics) {
        // Add live metrics to cached
        cachedMetrics.totalRequests += liveMetrics.totalRequests;
        cachedMetrics.totalTokens += liveMetrics.totalTokens;
        cachedMetrics.promptTokens += liveMetrics.promptTokens;
        cachedMetrics.completionTokens += liveMetrics.completionTokens;
        cachedMetrics.totalCost += liveMetrics.totalCost;
      } else {
        // Add new entry from live data
        mergedData.set(key, { ...liveMetrics });
      }
    }

    return {
      aggregationType,
      data: mergedData,
      recordCount: mergedData.size,
      dataSource: 'mixed',
    };
  }

  /**
   * Check if key/metrics meet filter criteria
   *
   * @param key - Aggregation key
   * @param metrics - Usage metrics
   * @param filters - Filters to apply
   * @returns True if meets criteria
   */
  private meetsFilterCriteria(key: string, metrics: any, filters: AdminUsageFilters): boolean {
    const { userIds, models, providers, apiKeys } = filters;

    // User filter
    if (userIds && userIds.length > 0) {
      // For user aggregation, key is user ID
      // For model/provider, need to check nested user data
      // Simplified: assume key structure matches filter type
      if (!userIds.includes(key)) {
        return false;
      }
    }

    // Model filter
    if (models && models.length > 0) {
      const modelName = key.split('|')[0]; // For "model|provider" keys
      if (!models.includes(modelName)) {
        return false;
      }
    }

    // Provider filter
    if (providers && providers.length > 0) {
      const providerName = key.split('|')[1] || key; // For "model|provider" keys or direct provider
      if (!providers.includes(providerName)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if LiteLLM record meets filters
   *
   * @param record - LiteLLM usage record
   * @param filters - Filters to apply
   * @returns True if meets criteria
   */
  private recordMeetsFilters(record: LiteLLMUsageRecord, filters: AdminUsageFilters): boolean {
    const { userIds, models, providers, apiKeys } = filters;

    if (userIds && userIds.length > 0 && !userIds.includes(record.user_id)) {
      return false;
    }

    if (models && models.length > 0 && !models.includes(record.model)) {
      return false;
    }

    if (providers && providers.length > 0 && !providers.includes(record.provider)) {
      return false;
    }

    if (apiKeys && apiKeys.length > 0 && !apiKeys.includes(record.api_key)) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if live data fetch is needed
   *
   * @param endDate - End date of query
   * @returns True if should fetch from LiteLLM
   */
  private shouldFetchLiveData(endDate: string): boolean {
    const end = parseISO(endDate);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Fetch live data if end date is today or in the future
    return endDate >= todayStr;
  }

  /**
   * Create empty aggregation result
   *
   * @param aggregationType - Type of aggregation
   * @returns Empty aggregation result
   */
  private createEmptyAggregation(aggregationType: AggregationType): AggregationResult {
    return {
      aggregationType,
      data: new Map(),
      recordCount: 0,
      dataSource: 'none',
    };
  }

  /**
   * Format aggregation map as result object
   *
   * @param aggregations - Map of aggregated data
   * @param aggregationType - Type of aggregation
   * @returns Formatted aggregation result
   */
  private formatAggregationResult(
    aggregations: Map<string, UsageMetrics>,
    aggregationType: AggregationType,
  ): AggregationResult {
    // Round all cost values to 4 decimal places
    for (const metrics of aggregations.values()) {
      metrics.totalCost = roundTo(metrics.totalCost, 4);
    }

    return {
      aggregationType,
      data: aggregations,
      recordCount: aggregations.size,
      dataSource: 'cache',
    };
  }

  /**
   * Calculate total metrics across all aggregations
   *
   * @param aggregations - Map of aggregated data
   * @returns Total metrics
   */
  calculateTotals(aggregations: Map<string, UsageMetrics>): UsageMetrics {
    const totals: UsageMetrics = {
      totalRequests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
    };

    for (const metrics of aggregations.values()) {
      totals.totalRequests += metrics.totalRequests;
      totals.totalTokens += metrics.totalTokens;
      totals.promptTokens += metrics.promptTokens;
      totals.completionTokens += metrics.completionTokens;
      totals.totalCost += metrics.totalCost;
    }

    // Round cost
    totals.totalCost = roundTo(totals.totalCost, 4);

    return totals;
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type of aggregation
 */
export type AggregationType = 'user' | 'model' | 'provider' | 'total';

/**
 * Usage metrics
 */
export interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  aggregationType: AggregationType;
  data: Map<string, UsageMetrics>;
  recordCount: number;
  dataSource: 'cache' | 'live' | 'mixed' | 'none';
}

/**
 * LiteLLM usage record (from API)
 */
export interface LiteLLMUsageRecord {
  user_id: string;
  api_key: string;
  model: string;
  provider: string;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  timestamp: string;
}
```

**Create Tests** (abbreviated):

Create `backend/tests/unit/services/admin-usage/admin-usage-aggregation.service.test.ts`:

```typescript
// backend/tests/unit/services/admin-usage/admin-usage-aggregation.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildFastifyApp } from '../../../helpers/test-app';
import { AdminUsageAggregationService } from '../../../../src/services/admin-usage/admin-usage-aggregation.service';

describe('AdminUsageAggregationService', () => {
  let fastify: any;
  let aggregationService: AdminUsageAggregationService;

  beforeEach(async () => {
    fastify = await buildFastifyApp();
    aggregationService = new AdminUsageAggregationService(fastify);

    // Mock database
    fastify.pg.query = vi.fn();
  });

  describe('aggregateUsageData', () => {
    it('should aggregate from cache for past dates', async () => {
      const filters = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      };

      // Mock cache query
      fastify.pg.query.mockResolvedValue({
        rows: [
          {
            date: '2025-01-01',
            data: {
              'user-1': {
                totalRequests: 100,
                tokens: { total: 5000, prompt: 3000, completion: 2000 },
                cost: 1.25,
              },
            },
          },
        ],
      });

      const result = await aggregationService.aggregateUsageData(filters, 'user');

      expect(result.recordCount).toBe(1);
      expect(result.dataSource).toBe('cache');
    });

    it('should merge cache and live data for current date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const filters = {
        startDate: today,
        endDate: today,
      };

      // Mock cache query
      fastify.pg.query.mockResolvedValue({
        rows: [
          {
            date: today,
            data: {
              'user-1': {
                totalRequests: 50,
                tokens: { total: 2500, prompt: 1500, completion: 1000 },
                cost: 0.625,
              },
            },
          },
        ],
      });

      // Mock LiteLLM query
      fastify.liteLLM = {
        getUsageLogs: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: 'user-1',
              model: 'gpt-4',
              provider: 'openai',
              tokens: 1000,
              prompt_tokens: 600,
              completion_tokens: 400,
              cost: 0.25,
            },
          ],
        }),
      };

      const result = await aggregationService.aggregateUsageData(filters, 'user');

      expect(result.recordCount).toBe(1);
      expect(result.dataSource).toBe('mixed');

      const userMetrics = result.data.get('user-1');
      expect(userMetrics?.totalRequests).toBe(51); // 50 + 1
      expect(userMetrics?.totalCost).toBeCloseTo(0.875); // 0.625 + 0.25
    });
  });

  describe('calculateTotals', () => {
    it('should sum all metrics', () => {
      const aggregations = new Map([
        [
          'user-1',
          {
            totalRequests: 100,
            totalTokens: 5000,
            promptTokens: 3000,
            completionTokens: 2000,
            totalCost: 1.25,
          },
        ],
        [
          'user-2',
          {
            totalRequests: 50,
            totalTokens: 2500,
            promptTokens: 1500,
            completionTokens: 1000,
            totalCost: 0.625,
          },
        ],
      ]);

      const totals = aggregationService.calculateTotals(aggregations);

      expect(totals.totalRequests).toBe(150);
      expect(totals.totalTokens).toBe(7500);
      expect(totals.totalCost).toBeCloseTo(1.875);
    });
  });
});
```

---

### Step 1G.2: Update Main Service (30 minutes)

**Files to Modify**:

- `backend/src/services/admin-usage-stats.service.ts`

**Changes**:

```typescript
// Import aggregation service
import { AdminUsageAggregationService } from './admin-usage/admin-usage-aggregation.service';

export class AdminUsageStatsService extends BaseService {
  private aggregationService: AdminUsageAggregationService;
  // ... other services

  constructor(/* ... */) {
    super(fastify);
    // ... existing initialization
    this.aggregationService = new AdminUsageAggregationService(fastify);
  }

  // Delegate aggregation
  async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    // Get aggregated data
    const result = await this.aggregationService.aggregateUsageData(filters, 'user');

    // Enrich with user data
    const enriched = await this.enrichmentService.enrichWithUserData(result.data);

    // Convert to breakdown format
    return enriched.map(/* ... */);
  }

  // Remove extracted methods:
  // - aggregateUsageData()
  // - aggregateFromCache()
  // - aggregateFromLiteLLM()
  // - processJSONBAggregation()
  // - mergeAggregations()
}
```

---

### Step 1G.3: Test & Commit (30 minutes)

**Test**:

```bash
npm --prefix backend test -- admin-usage-aggregation.service.test.ts
npm --prefix backend test
npm --prefix backend run type-check
```

**Commit**:

```bash
git add backend/src/services/admin-usage/
git add backend/tests/unit/services/admin-usage/
git add backend/src/services/admin-usage-stats.service.ts

git commit -m "refactor: extract aggregation service

- Create AdminUsageAggregationService (~800 lines)
  - Complex JSONB aggregation from daily cache
  - Live data fetching from LiteLLM API
  - Intelligent cache/live data merging
  - Support for user/model/provider aggregations
  - Handles old and new JSONB structures
- Update main service to use aggregation service
- Add comprehensive tests
- All existing tests pass

Reduces main service file by ~800 additional lines
Main service now ~500 lines (orchestrator only)
Related to Issue #1: Service file size reduction
Phase 1, Session 1G of refactoring plan

Actual time: X hours (estimated: 2-4 hours)"
```

---

## Deliverables

**Files Created**:

- ✅ `backend/src/services/admin-usage/admin-usage-aggregation.service.ts` (~800 lines)
- ✅ `backend/tests/unit/services/admin-usage/admin-usage-aggregation.service.test.ts`

**Files Modified**:

- ✅ `backend/src/services/admin-usage-stats.service.ts` (reduced to ~500 lines)

**Cumulative Progress** (after Sessions 1E-1G):

- Main service: ~500 lines (orchestrator)
- Extracted services: 5 files, ~2,300 lines total
- Total reduction: ~2,300 lines from main service

---

## Acceptance Criteria

- ✅ Aggregation service < 900 lines
- ✅ Main service < 600 lines
- ✅ All aggregation logic preserved
- ✅ JSONB processing correct
- ✅ Cache/live merge working
- ✅ Filters applied correctly
- ✅ All tests passing

---

## Next Steps

**Next Session** (1H - FINAL):

- Refactor main service as pure orchestrator
- Final cleanup and documentation
- Phase 1 checkpoint validation

**Link**: [Session 1H - Refactor Main Service as Orchestrator](./phase-1-session-1h-refactor-orchestrator.md)

---

_Last Updated: 2025-10-11_
_Session Status: Ready for Execution_

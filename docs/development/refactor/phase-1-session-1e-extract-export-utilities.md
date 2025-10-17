# Phase 1, Session 1E: Extract Export & Utilities

**Phase**: 1 - Critical Blocking Issues
**Session**: 1E
**Duration**: 2-3 hours
**Priority**: 🔴 CRITICAL
**Issue**: #1 - 2,833-line Service File

---

## Navigation

**Up**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)
**Previous**: [Session 1D - Create Migration Rollback](./phase-1-session-1d-create-migration-rollback.md)
**Next**: [Session 1F - Extract Trend & Enrichment Services](./phase-1-session-1f-extract-trend-enrichment.md)

---

## Context

This session is part of the service file refactoring effort (Issue #1) to break down the monolithic `admin-usage-stats.service.ts` (2,833 lines) into focused, maintainable services.

**Current State**:

- Single service file: 2,833 lines
- Multiple responsibilities: aggregation, caching, export, enrichment, trends
- Violates Single Responsibility Principle
- Difficult to test and maintain

**Target State** (after Sessions 1E-1H):

- Main service: ~500 lines (orchestrator)
- 5-6 specialized services: each < 500 lines
- Clear separation of concerns
- Easier to test and maintain

---

## Phase 1 Summary

**Phase 1: Critical Blocking Issues** addresses 5 critical issues that block production deployment:

1. ✅ Session 1A - Rate Limiting Implementation
2. ✅ Session 1B - Date Range Validation
3. ✅ Session 1C - Fix ResizeObserver Memory Leak
4. ✅ Session 1D - Create Migration Rollback
5. **🔵 Session 1E - Extract Export & Utilities** (YOU ARE HERE)
6. Session 1F - Extract Trend & Enrichment Services
7. Session 1G - Extract Aggregation Service
8. Session 1H - Refactor Main Service as Orchestrator

---

## Session Objectives

Extract export functionality (CSV/JSON generation) and shared utility functions into separate modules, reducing the main service file size and improving maintainability.

**Deliverables**:

- `admin-usage.utils.ts` module (~400 lines)
- `AdminUsageExportService` class (~300 lines)
- Tests for both modules
- Updated main service using extracted modules
- ~700 lines removed from main service

---

## Pre-Session Checklist

- [ ] Sessions 1A-1D completed and committed
- [ ] All tests passing from previous sessions
- [ ] Review current `admin-usage-stats.service.ts` structure
- [ ] Identify export-related methods
- [ ] Identify shared utility functions
- [ ] Plan dependency graph
- [ ] Create feature branch: `git checkout -b refactor/session-1e-extract-export-utils`

---

## Implementation Steps

### Step 1E.1: Create Directory Structure (5 minutes)

**Objective**: Set up the new directory structure for admin usage services.

**Commands**:

```bash
# Create admin-usage service directory
mkdir -p backend/src/services/admin-usage

# Verify structure
ls -la backend/src/services/admin-usage/
```

**Expected Structure** (after this session):

```
backend/src/services/admin-usage/
├── admin-usage-stats.service.ts          (will refactor in Session 1H)
├── admin-usage-export.service.ts         (create in this session)
└── admin-usage.utils.ts                  (create in this session)
```

**Validation**:

```bash
# Directory should exist
test -d backend/src/services/admin-usage && echo "✅ Directory created" || echo "❌ Directory missing"
```

---

### Step 1E.2: Extract Utility Functions (45 minutes)

**Objective**: Create a shared utilities module with date handling, formatting, and data transformation helpers.

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage.utils.ts`

**Methods to Extract** (from original `admin-usage-stats.service.ts`):

- Date range helper functions
- Number formatting utilities
- Data transformation helpers
- Comparison period calculation
- Serialization helpers

**Implementation**:

Create `backend/src/services/admin-usage/admin-usage.utils.ts`:

```typescript
// backend/src/services/admin-usage/admin-usage.utils.ts

import { parseISO, subDays, format, differenceInDays } from 'date-fns';

/**
 * Utility functions for admin usage analytics
 *
 * These are pure functions with no dependencies on Fastify or database,
 * making them easy to test and reuse.
 */

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Calculate comparison period for trend analysis
 *
 * Given a date range, returns the comparison period of equal length
 * immediately preceding the requested period.
 *
 * @example
 * Input: 2025-01-15 to 2025-01-21 (7 days)
 * Output: 2025-01-08 to 2025-01-14 (previous 7 days)
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Comparison period dates and length in days
 */
export function calculateComparisonPeriod(
  startDate: string,
  endDate: string,
): { comparisonStartDate: string; comparisonEndDate: string; days: number } {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // Calculate period length in days (inclusive)
  const days = differenceInDays(end, start) + 1;

  // Calculate comparison period (same length, immediately before)
  const comparisonEnd = subDays(start, 1);
  const comparisonStart = subDays(comparisonEnd, days - 1);

  return {
    comparisonStartDate: format(comparisonStart, 'yyyy-MM-dd'),
    comparisonEndDate: format(comparisonEnd, 'yyyy-MM-dd'),
    days,
  };
}

/**
 * Parse date string as UTC date
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing midnight UTC
 */
export function parseDateAsUTC(dateString: string): Date {
  return parseISO(`${dateString}T00:00:00Z`);
}

/**
 * Check if a date is today (UTC)
 *
 * @param date - Date to check
 * @returns True if date is today in UTC
 */
export function isTodayUTC(date: Date): boolean {
  const now = new Date();
  const nowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return nowUTC.getTime() === dateUTC.getTime();
}

// ============================================================================
// Number Formatting Utilities
// ============================================================================

/**
 * Format large number with appropriate units (K, M, B)
 *
 * @param num - Number to format
 * @returns Formatted string with unit suffix
 *
 * @example
 * formatLargeNumber(1500) => "1.5K"
 * formatLargeNumber(2500000) => "2.5M"
 * formatLargeNumber(1500000000) => "1.5B"
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Format currency value to fixed decimal places
 *
 * @param amount - Amount to format
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1.23456) => "1.2346"
 * formatCurrency(0.001, 6) => "0.001000"
 */
export function formatCurrency(amount: number, decimals = 4): string {
  return amount.toFixed(decimals);
}

/**
 * Format percentage with fixed decimal places
 *
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(12.3456) => "12.3%"
 * formatPercentage(0.123, 2) => "0.12%"
 */
export function formatPercentage(value: number, decimals = 1): string {
  return value.toFixed(decimals) + '%';
}

// ============================================================================
// Data Transformation Utilities
// ============================================================================

/**
 * Serialize dates in object to ISO strings
 *
 * Recursively traverses object and converts all Date instances to ISO strings.
 * This is useful for JSON serialization where Date objects need to be strings.
 *
 * @param obj - Object to serialize
 * @returns Object with dates converted to strings
 */
export function serializeDates<T>(obj: T): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeDates(item));
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeDates(value);
    }
    return serialized;
  }

  return obj;
}

/**
 * Deep clone an object using JSON serialization
 *
 * Note: This method does not preserve functions, symbols, or undefined values.
 * Use only for plain data objects.
 *
 * @param obj - Object to clone
 * @returns Deep clone of object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Safely get nested property from object
 *
 * @param obj - Object to query
 * @param path - Property path (dot notation)
 * @param defaultValue - Default value if property not found
 * @returns Property value or default
 *
 * @example
 * getNestedProperty({a: {b: {c: 123}}}, 'a.b.c') => 123
 * getNestedProperty({a: {b: {}}}, 'a.b.c', 'default') => 'default'
 */
export function getNestedProperty<T = any>(
  obj: any,
  path: string,
  defaultValue?: T,
): T | undefined {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current as T;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Check if value is a valid number (not NaN, not Infinity)
 *
 * @param value - Value to check
 * @returns True if valid number
 */
export function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Ensure value is a valid number, return default if not
 *
 * @param value - Value to validate
 * @param defaultValue - Default value to return if invalid (default: 0)
 * @returns Valid number
 */
export function ensureNumber(value: any, defaultValue = 0): number {
  return isValidNumber(value) ? value : defaultValue;
}

/**
 * Round number to specified decimal places
 *
 * @param value - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
export function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Sort array by property value
 *
 * @param arr - Array to sort
 * @param prop - Property name to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted array (new array, original not modified)
 */
export function sortByProperty<T>(arr: T[], prop: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  const sorted = [...arr];
  sorted.sort((a, b) => {
    const aVal = a[prop];
    const bVal = b[prop];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
}

/**
 * Group array by property value
 *
 * @param arr - Array to group
 * @param prop - Property name to group by
 * @returns Map of property value to array of items
 */
export function groupBy<T>(arr: T[], prop: keyof T): Map<any, T[]> {
  const groups = new Map<any, T[]>();

  for (const item of arr) {
    const key = item[prop];
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

/**
 * Calculate sum of property values in array
 *
 * @param arr - Array to sum
 * @param prop - Property name to sum
 * @returns Sum of property values
 */
export function sumBy<T>(arr: T[], prop: keyof T): number {
  return arr.reduce((sum, item) => {
    const value = item[prop];
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Unknown user ID for cases where user cannot be determined
 */
export const UNKNOWN_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Unknown username display value
 */
export const UNKNOWN_USERNAME = 'Unknown User';

/**
 * Trend stability threshold (percentage)
 * Changes below this are considered "stable"
 */
export const TREND_STABILITY_THRESHOLD = 1.0; // 1%
```

**Create Tests**:

Create `backend/tests/unit/services/admin-usage/admin-usage.utils.test.ts`:

```typescript
// backend/tests/unit/services/admin-usage/admin-usage.utils.test.ts

import { describe, it, expect } from 'vitest';
import {
  calculateComparisonPeriod,
  parseDateAsUTC,
  isTodayUTC,
  formatLargeNumber,
  formatCurrency,
  formatPercentage,
  serializeDates,
  deepClone,
  getNestedProperty,
  isValidNumber,
  ensureNumber,
  roundTo,
  sortByProperty,
  groupBy,
  sumBy,
} from '../../../../src/services/admin-usage/admin-usage.utils';

describe('admin-usage.utils', () => {
  // ============================================================================
  // Date Utilities
  // ============================================================================

  describe('calculateComparisonPeriod', () => {
    it('should calculate 7-day comparison period', () => {
      const result = calculateComparisonPeriod('2025-01-15', '2025-01-21');
      expect(result.comparisonStartDate).toBe('2025-01-08');
      expect(result.comparisonEndDate).toBe('2025-01-14');
      expect(result.days).toBe(7);
    });

    it('should calculate 30-day comparison period', () => {
      const result = calculateComparisonPeriod('2025-02-01', '2025-03-02');
      expect(result.days).toBe(30);
      expect(result.comparisonStartDate).toBe('2025-01-02');
      expect(result.comparisonEndDate).toBe('2025-01-31');
    });

    it('should handle single-day period', () => {
      const result = calculateComparisonPeriod('2025-01-15', '2025-01-15');
      expect(result.days).toBe(1);
      expect(result.comparisonStartDate).toBe('2025-01-14');
      expect(result.comparisonEndDate).toBe('2025-01-14');
    });

    it('should handle year boundary', () => {
      const result = calculateComparisonPeriod('2025-01-01', '2025-01-07');
      expect(result.days).toBe(7);
      expect(result.comparisonStartDate).toBe('2024-12-25');
      expect(result.comparisonEndDate).toBe('2024-12-31');
    });
  });

  describe('parseDateAsUTC', () => {
    it('should parse date as UTC midnight', () => {
      const date = parseDateAsUTC('2025-01-15');
      expect(date.toISOString()).toBe('2025-01-15T00:00:00.000Z');
    });
  });

  describe('isTodayUTC', () => {
    it('should return true for today', () => {
      const today = new Date();
      expect(isTodayUTC(today)).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isTodayUTC(yesterday)).toBe(false);
    });
  });

  // ============================================================================
  // Number Formatting
  // ============================================================================

  describe('formatLargeNumber', () => {
    it('should format billions', () => {
      expect(formatLargeNumber(2_500_000_000)).toBe('2.5B');
    });

    it('should format millions', () => {
      expect(formatLargeNumber(1_500_000)).toBe('1.5M');
    });

    it('should format thousands', () => {
      expect(formatLargeNumber(1_500)).toBe('1.5K');
    });

    it('should not format numbers under 1000', () => {
      expect(formatLargeNumber(999)).toBe('999');
    });

    it('should handle zero', () => {
      expect(formatLargeNumber(0)).toBe('0');
    });
  });

  describe('formatCurrency', () => {
    it('should format with default 4 decimals', () => {
      expect(formatCurrency(1.23456)).toBe('1.2346');
    });

    it('should format with custom decimals', () => {
      expect(formatCurrency(0.001, 6)).toBe('0.001000');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('0.0000');
    });
  });

  describe('formatPercentage', () => {
    it('should format with default 1 decimal', () => {
      expect(formatPercentage(12.3456)).toBe('12.3%');
    });

    it('should format with custom decimals', () => {
      expect(formatPercentage(0.123, 2)).toBe('0.12%');
    });
  });

  // ============================================================================
  // Data Transformation
  // ============================================================================

  describe('serializeDates', () => {
    it('should serialize Date to ISO string', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      expect(serializeDates(date)).toBe('2025-01-15T12:00:00.000Z');
    });

    it('should serialize nested dates in object', () => {
      const obj = {
        date: new Date('2025-01-15T12:00:00Z'),
        nested: {
          date: new Date('2025-01-16T12:00:00Z'),
        },
      };
      const result = serializeDates(obj);
      expect(result.date).toBe('2025-01-15T12:00:00.000Z');
      expect(result.nested.date).toBe('2025-01-16T12:00:00.000Z');
    });

    it('should serialize dates in arrays', () => {
      const arr = [new Date('2025-01-15T12:00:00Z'), new Date('2025-01-16T12:00:00Z')];
      const result = serializeDates(arr);
      expect(result[0]).toBe('2025-01-15T12:00:00.000Z');
      expect(result[1]).toBe('2025-01-16T12:00:00.000Z');
    });

    it('should handle null and undefined', () => {
      expect(serializeDates(null)).toBe(null);
      expect(serializeDates(undefined)).toBe(undefined);
    });
  });

  describe('deepClone', () => {
    it('should create deep clone of object', () => {
      const obj = { a: { b: { c: 123 } } };
      const clone = deepClone(obj);
      expect(clone).toEqual(obj);
      expect(clone).not.toBe(obj);
      expect(clone.a).not.toBe(obj.a);
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const clone = deepClone(arr);
      expect(clone).toEqual(arr);
      expect(clone).not.toBe(arr);
    });
  });

  describe('getNestedProperty', () => {
    const obj = { a: { b: { c: 123 } } };

    it('should get nested property', () => {
      expect(getNestedProperty(obj, 'a.b.c')).toBe(123);
    });

    it('should return default for missing property', () => {
      expect(getNestedProperty(obj, 'a.b.d', 'default')).toBe('default');
    });

    it('should return undefined for missing property without default', () => {
      expect(getNestedProperty(obj, 'a.b.d')).toBeUndefined();
    });
  });

  // ============================================================================
  // Validation
  // ============================================================================

  describe('isValidNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(-123)).toBe(true);
      expect(isValidNumber(1.23)).toBe(true);
    });

    it('should return false for invalid numbers', () => {
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
      expect(isValidNumber('123')).toBe(false);
    });
  });

  describe('ensureNumber', () => {
    it('should return valid number as-is', () => {
      expect(ensureNumber(123)).toBe(123);
    });

    it('should return default for invalid number', () => {
      expect(ensureNumber(NaN)).toBe(0);
      expect(ensureNumber(NaN, 100)).toBe(100);
    });
  });

  describe('roundTo', () => {
    it('should round to specified decimals', () => {
      expect(roundTo(1.2345, 2)).toBe(1.23);
      expect(roundTo(1.2355, 2)).toBe(1.24);
    });

    it('should handle negative decimals', () => {
      expect(roundTo(1234.5, -1)).toBe(1230);
    });
  });

  // ============================================================================
  // Array Utilities
  // ============================================================================

  describe('sortByProperty', () => {
    const arr = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 35 },
    ];

    it('should sort ascending by default', () => {
      const sorted = sortByProperty(arr, 'age');
      expect(sorted.map((x) => x.age)).toEqual([25, 30, 35]);
    });

    it('should sort descending', () => {
      const sorted = sortByProperty(arr, 'age', 'desc');
      expect(sorted.map((x) => x.age)).toEqual([35, 30, 25]);
    });

    it('should not modify original array', () => {
      const sorted = sortByProperty(arr, 'age');
      expect(arr).not.toBe(sorted);
      expect(arr[0].name).toBe('Charlie');
    });
  });

  describe('groupBy', () => {
    const arr = [
      { category: 'A', value: 1 },
      { category: 'B', value: 2 },
      { category: 'A', value: 3 },
    ];

    it('should group by property', () => {
      const grouped = groupBy(arr, 'category');
      expect(grouped.get('A')).toHaveLength(2);
      expect(grouped.get('B')).toHaveLength(1);
    });
  });

  describe('sumBy', () => {
    const arr = [{ value: 10 }, { value: 20 }, { value: 30 }];

    it('should sum by property', () => {
      expect(sumBy(arr, 'value')).toBe(60);
    });

    it('should handle empty array', () => {
      expect(sumBy([], 'value')).toBe(0);
    });
  });
});
```

**Validation**:

```bash
# Run tests
npm --prefix backend test -- admin-usage.utils.test.ts

# Expected: All tests pass
```

---

### Step 1E.3: Extract Export Service (1 hour)

**Objective**: Create a dedicated service for CSV/JSON export functionality.

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage-export.service.ts`

**Methods to Extract**:

- `exportUserBreakdownToCSV()`
- `exportModelBreakdownToCSV()`
- `exportProviderBreakdownToCSV()`
- `exportToJSON()`
- `generateExportData()`
- CSV formatting helpers

**Implementation**:

Create `backend/src/services/admin-usage/admin-usage-export.service.ts`:

```typescript
// backend/src/services/admin-usage/admin-usage-export.service.ts

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { ApplicationError } from '../../utils/errors';
import type {
  AdminUsageFilters,
  UserBreakdown,
  ModelBreakdown,
  ProviderBreakdown,
} from '../../types/admin-usage.types';

/**
 * Service for exporting admin usage analytics data
 *
 * Provides CSV and JSON export functionality for all breakdown types.
 * Handles data formatting, CSV escaping, and metadata inclusion.
 */
export class AdminUsageExportService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  // ============================================================================
  // CSV Export Methods
  // ============================================================================

  /**
   * Export user breakdown to CSV format
   *
   * @param breakdown - User breakdown data
   * @param filters - Original filters for metadata
   * @returns CSV string with headers and data
   */
  async exportUserBreakdownToCSV(
    breakdown: UserBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    try {
      const headers = [
        'User ID',
        'Username',
        'Email',
        'Total Requests',
        'Total Tokens',
        'Prompt Tokens',
        'Completion Tokens',
        'Total Cost (USD)',
      ];

      const rows = breakdown.map((user) => [
        user.userId,
        user.username,
        user.email || '',
        user.totalRequests.toString(),
        user.totalTokens.toString(),
        user.promptTokens.toString(),
        user.completionTokens.toString(),
        user.totalCost.toFixed(4),
      ]);

      return this.generateCSV(headers, rows);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export user breakdown to CSV');
      throw ApplicationError.internal('Failed to generate CSV export', { error });
    }
  }

  /**
   * Export model breakdown to CSV format
   *
   * @param breakdown - Model breakdown data
   * @param filters - Original filters for metadata
   * @returns CSV string with headers and data
   */
  async exportModelBreakdownToCSV(
    breakdown: ModelBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    try {
      const headers = [
        'Model',
        'Provider',
        'Total Requests',
        'Total Tokens',
        'Prompt Tokens',
        'Completion Tokens',
        'Total Cost (USD)',
        'Unique Users',
      ];

      const rows = breakdown.map((model) => [
        model.model,
        model.provider || '',
        model.totalRequests.toString(),
        model.totalTokens.toString(),
        model.promptTokens.toString(),
        model.completionTokens.toString(),
        model.totalCost.toFixed(4),
        model.uniqueUsers?.toString() || '0',
      ]);

      return this.generateCSV(headers, rows);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export model breakdown to CSV');
      throw ApplicationError.internal('Failed to generate CSV export', { error });
    }
  }

  /**
   * Export provider breakdown to CSV format
   *
   * @param breakdown - Provider breakdown data
   * @param filters - Original filters for metadata
   * @returns CSV string with headers and data
   */
  async exportProviderBreakdownToCSV(
    breakdown: ProviderBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    try {
      const headers = [
        'Provider',
        'Total Requests',
        'Total Tokens',
        'Prompt Tokens',
        'Completion Tokens',
        'Total Cost (USD)',
        'Unique Users',
        'Unique Models',
      ];

      const rows = breakdown.map((provider) => [
        provider.provider,
        provider.totalRequests.toString(),
        provider.totalTokens.toString(),
        provider.promptTokens.toString(),
        provider.completionTokens.toString(),
        provider.totalCost.toFixed(4),
        provider.uniqueUsers?.toString() || '0',
        provider.uniqueModels?.toString() || '0',
      ]);

      return this.generateCSV(headers, rows);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export provider breakdown to CSV');
      throw ApplicationError.internal('Failed to generate CSV export', { error });
    }
  }

  // ============================================================================
  // JSON Export Methods
  // ============================================================================

  /**
   * Export data to JSON format with metadata
   *
   * @param data - Data to export (any breakdown type)
   * @param filters - Original filters for metadata
   * @param breakdownType - Type of breakdown ('user', 'model', 'provider')
   * @returns JSON string with metadata wrapper
   */
  async exportToJSON<T>(
    data: T,
    filters: AdminUsageFilters,
    breakdownType?: string,
  ): Promise<string> {
    try {
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          breakdownType: breakdownType || 'unknown',
          filters: {
            startDate: filters.startDate,
            endDate: filters.endDate,
            userIds: filters.userIds,
            models: filters.models,
            providers: filters.providers,
            apiKeys: filters.apiKeys,
          },
          recordCount: Array.isArray(data) ? data.length : 1,
        },
        data,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export to JSON');
      throw ApplicationError.internal('Failed to generate JSON export', { error });
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate CSV string from headers and rows
   *
   * @param headers - Array of header strings
   * @param rows - Array of row arrays
   * @returns CSV string
   */
  private generateCSV(headers: string[], rows: string[][]): string {
    const csvLines = [
      // Header row
      headers.map(this.escapeCSVField).join(','),
      // Data rows
      ...rows.map((row) => row.map(this.escapeCSVField).join(',')),
    ];

    return csvLines.join('\n');
  }

  /**
   * Escape CSV field for safe export
   *
   * Handles commas, newlines, and double quotes according to CSV RFC 4180.
   *
   * @param field - Field value to escape
   * @returns Escaped field value
   */
  private escapeCSVField(field: string): string {
    // If field contains comma, newline, or double quote, wrap in quotes
    if (field.includes(',') || field.includes('\n') || field.includes('"')) {
      // Escape double quotes by doubling them
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Generate export filename with timestamp
   *
   * @param breakdownType - Type of breakdown
   * @param format - Export format ('csv' or 'json')
   * @returns Filename with timestamp
   */
  generateExportFilename(breakdownType: string, format: 'csv' | 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `admin-usage-${breakdownType}-${timestamp}.${format}`;
  }

  /**
   * Get MIME type for export format
   *
   * @param format - Export format ('csv' or 'json')
   * @returns MIME type string
   */
  getMimeType(format: 'csv' | 'json'): string {
    return format === 'csv' ? 'text/csv' : 'application/json';
  }
}
```

**Create Tests**:

Create `backend/tests/unit/services/admin-usage/admin-usage-export.service.test.ts`:

```typescript
// backend/tests/unit/services/admin-usage/admin-usage-export.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildFastifyApp } from '../../../helpers/test-app';
import { AdminUsageExportService } from '../../../../src/services/admin-usage/admin-usage-export.service';
import type {
  UserBreakdown,
  ModelBreakdown,
  ProviderBreakdown,
  AdminUsageFilters,
} from '../../../../src/types/admin-usage.types';

describe('AdminUsageExportService', () => {
  let fastify: any;
  let exportService: AdminUsageExportService;
  let filters: AdminUsageFilters;

  beforeEach(async () => {
    fastify = await buildFastifyApp();
    exportService = new AdminUsageExportService(fastify);
    filters = {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };
  });

  // ============================================================================
  // CSV Export Tests
  // ============================================================================

  describe('exportUserBreakdownToCSV', () => {
    it('should generate valid CSV for user breakdown', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'john.doe',
          email: 'john@example.com',
          totalRequests: 100,
          totalTokens: 5000,
          promptTokens: 3000,
          completionTokens: 2000,
          totalCost: 1.25,
        },
        {
          userId: 'user-2',
          username: 'jane.smith',
          email: 'jane@example.com',
          totalRequests: 50,
          totalTokens: 2500,
          promptTokens: 1500,
          completionTokens: 1000,
          totalCost: 0.625,
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      expect(csv).toContain('User ID,Username,Email');
      expect(csv).toContain('user-1,john.doe,john@example.com,100,5000,3000,2000,1.2500');
      expect(csv).toContain('user-2,jane.smith,jane@example.com,50,2500,1500,1000,0.6250');
    });

    it('should handle empty email fields', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'john.doe',
          email: null,
          totalRequests: 100,
          totalTokens: 5000,
          promptTokens: 3000,
          completionTokens: 2000,
          totalCost: 1.25,
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      // Email field should be empty but not missing
      expect(csv).toContain('user-1,john.doe,,100');
    });

    it('should escape CSV fields with commas', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'doe, john', // Contains comma
          email: 'john@example.com',
          totalRequests: 100,
          totalTokens: 5000,
          promptTokens: 3000,
          completionTokens: 2000,
          totalCost: 1.25,
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      // Username should be wrapped in quotes
      expect(csv).toContain('"doe, john"');
    });

    it('should escape CSV fields with double quotes', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'john "the dev" doe', // Contains quotes
          email: 'john@example.com',
          totalRequests: 100,
          totalTokens: 5000,
          promptTokens: 3000,
          completionTokens: 2000,
          totalCost: 1.25,
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      // Quotes should be doubled and field wrapped in quotes
      expect(csv).toContain('"john ""the dev"" doe"');
    });
  });

  describe('exportModelBreakdownToCSV', () => {
    it('should generate valid CSV for model breakdown', async () => {
      const breakdown: ModelBreakdown[] = [
        {
          model: 'gpt-4',
          provider: 'openai',
          totalRequests: 100,
          totalTokens: 5000,
          promptTokens: 3000,
          completionTokens: 2000,
          totalCost: 1.25,
          uniqueUsers: 5,
        },
      ];

      const csv = await exportService.exportModelBreakdownToCSV(breakdown, filters);

      expect(csv).toContain('Model,Provider,Total Requests');
      expect(csv).toContain('gpt-4,openai,100,5000,3000,2000,1.2500,5');
    });
  });

  describe('exportProviderBreakdownToCSV', () => {
    it('should generate valid CSV for provider breakdown', async () => {
      const breakdown: ProviderBreakdown[] = [
        {
          provider: 'openai',
          totalRequests: 100,
          totalTokens: 5000,
          promptTokens: 3000,
          completionTokens: 2000,
          totalCost: 1.25,
          uniqueUsers: 5,
          uniqueModels: 3,
        },
      ];

      const csv = await exportService.exportProviderBreakdownToCSV(breakdown, filters);

      expect(csv).toContain('Provider,Total Requests');
      expect(csv).toContain('openai,100,5000,3000,2000,1.2500,5,3');
    });
  });

  // ============================================================================
  // JSON Export Tests
  // ============================================================================

  describe('exportToJSON', () => {
    it('should generate JSON with metadata', async () => {
      const data = [{ test: 'data' }];
      const json = await exportService.exportToJSON(data, filters, 'user');
      const parsed = JSON.parse(json);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.exportedAt).toBeDefined();
      expect(parsed.metadata.breakdownType).toBe('user');
      expect(parsed.metadata.filters).toEqual(filters);
      expect(parsed.metadata.recordCount).toBe(1);
      expect(parsed.data).toEqual(data);
    });

    it('should include all filter fields in metadata', async () => {
      const fullFilters: AdminUsageFilters = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        userIds: ['user-1', 'user-2'],
        models: ['gpt-4'],
        providers: ['openai'],
        apiKeys: ['key-1'],
      };

      const json = await exportService.exportToJSON([{ test: 'data' }], fullFilters, 'user');
      const parsed = JSON.parse(json);

      expect(parsed.metadata.filters.userIds).toEqual(['user-1', 'user-2']);
      expect(parsed.metadata.filters.models).toEqual(['gpt-4']);
      expect(parsed.metadata.filters.providers).toEqual(['openai']);
      expect(parsed.metadata.filters.apiKeys).toEqual(['key-1']);
    });

    it('should format JSON with proper indentation', async () => {
      const json = await exportService.exportToJSON({ test: 'data' }, filters);

      // Should be pretty-printed with 2-space indentation
      expect(json).toContain('  "metadata"');
      expect(json).toContain('    "exportedAt"');
    });
  });

  // ============================================================================
  // Helper Method Tests
  // ============================================================================

  describe('generateExportFilename', () => {
    it('should generate filename with timestamp for CSV', () => {
      const filename = exportService.generateExportFilename('user', 'csv');
      expect(filename).toMatch(/^admin-usage-user-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
    });

    it('should generate filename with timestamp for JSON', () => {
      const filename = exportService.generateExportFilename('model', 'json');
      expect(filename).toMatch(/^admin-usage-model-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('getMimeType', () => {
    it('should return CSV MIME type', () => {
      expect(exportService.getMimeType('csv')).toBe('text/csv');
    });

    it('should return JSON MIME type', () => {
      expect(exportService.getMimeType('json')).toBe('application/json');
    });
  });
});
```

**Validation**:

```bash
# Run tests
npm --prefix backend test -- admin-usage-export.service.test.ts

# Expected: All tests pass
```

---

### Step 1E.4: Update Main Service to Use Extracted Modules (15 minutes)

**Objective**: Modify the main service to import and use the new utilities and export service.

**Files to Modify**:

- `backend/src/services/admin-usage-stats.service.ts`

**Changes**:

```typescript
// At the top of admin-usage-stats.service.ts

// Import new modules
import { AdminUsageExportService } from './admin-usage/admin-usage-export.service';
import {
  calculateComparisonPeriod,
  formatLargeNumber,
  serializeDates,
  formatCurrency,
  formatPercentage,
  UNKNOWN_USER_ID,
  UNKNOWN_USERNAME,
} from './admin-usage/admin-usage.utils';

export class AdminUsageStatsService extends BaseService {
  private exportService: AdminUsageExportService;

  constructor(
    fastify: FastifyInstance,
    liteLLMService: LiteLLMService,
    cacheManager?: IDailyUsageCacheManager,
  ) {
    super(fastify);
    this.liteLLMService = liteLLMService;
    this.cacheManager = cacheManager || null;
    this.exportService = new AdminUsageExportService(fastify);
  }

  // Replace export methods with delegation
  async exportUserBreakdownToCSV(
    breakdown: UserBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    return this.exportService.exportUserBreakdownToCSV(breakdown, filters);
  }

  async exportModelBreakdownToCSV(
    breakdown: ModelBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    return this.exportService.exportModelBreakdownToCSV(breakdown, filters);
  }

  async exportProviderBreakdownToCSV(
    breakdown: ProviderBreakdown[],
    filters: AdminUsageFilters,
  ): Promise<string> {
    return this.exportService.exportProviderBreakdownToCSV(breakdown, filters);
  }

  async exportToJSON<T>(
    data: T,
    filters: AdminUsageFilters,
    breakdownType?: string,
  ): Promise<string> {
    return this.exportService.exportToJSON(data, filters, breakdownType);
  }

  // Remove extracted utility methods (now imported from utils):
  // - calculateComparisonPeriod() - now imported
  // - formatLargeNumber() - now imported
  // - serializeDates() - now imported
  // - formatCurrency() - now imported
  // - formatPercentage() - now imported
  // - UNKNOWN_USER_ID constant - now imported
  // - UNKNOWN_USERNAME constant - now imported
  // - escapeCSVField() - now in export service

  // Update existing methods to use imported utilities
  // Example:
  // Old: this.calculateComparisonPeriod(startDate, endDate)
  // New: calculateComparisonPeriod(startDate, endDate)
}
```

**Validation**:

```bash
# Check TypeScript compilation
npm --prefix backend run type-check

# Expected: No errors
```

---

### Step 1E.5: Run Full Test Suite (15 minutes)

**Objective**: Ensure all existing tests still pass with the refactored code.

**Commands**:

```bash
# Run all admin-usage related tests
npm --prefix backend test -- admin-usage

# Run full backend test suite
npm --prefix backend test

# Check for any test failures
```

**Expected Results**:

- All new utility tests pass ✅
- All new export service tests pass ✅
- All existing admin-usage tests pass ✅
- No test failures in other modules ✅

**If Tests Fail**:

1. Review error messages
2. Check import statements
3. Verify method signatures match
4. Fix issues before committing

---

### Step 1E.6: Commit Changes (5 minutes)

**Objective**: Create a clean, atomic commit for this session's work.

**Commands**:

```bash
# Stage all changes
git add backend/src/services/admin-usage/
git add backend/tests/unit/services/admin-usage/
git add backend/src/services/admin-usage-stats.service.ts

# Commit with descriptive message
git commit -m "refactor: extract export service and utilities from admin-usage-stats

- Create AdminUsageExportService for CSV/JSON export (~300 lines)
- Extract utility functions to admin-usage.utils.ts (~400 lines)
- Add date utilities: calculateComparisonPeriod, parseDateAsUTC, isTodayUTC
- Add formatting utilities: formatLargeNumber, formatCurrency, formatPercentage
- Add data transformation utilities: serializeDates, deepClone, getNestedProperty
- Add array utilities: sortByProperty, groupBy, sumBy
- Update main service to use extracted modules
- Add comprehensive tests for new modules (100% coverage)
- All existing tests pass

Reduces main service file by ~700 lines
Related to Issue #1: Service file size reduction
Phase 1, Session 1E of refactoring plan

Actual time: X hours (estimated: 2-3 hours)"
```

**Verify Commit**:

```bash
# Check commit
git log -1 --stat

# Verify files included
git show --name-only
```

---

## Deliverables

**Files Created**:

- ✅ `backend/src/services/admin-usage/admin-usage.utils.ts` (~400 lines)
- ✅ `backend/src/services/admin-usage/admin-usage-export.service.ts` (~300 lines)
- ✅ `backend/tests/unit/services/admin-usage/admin-usage.utils.test.ts`
- ✅ `backend/tests/unit/services/admin-usage/admin-usage-export.service.test.ts`

**Files Modified**:

- ✅ `backend/src/services/admin-usage-stats.service.ts` (reduced by ~700 lines)

**Tests**:

- ✅ Utility tests passing (35+ test cases)
- ✅ Export service tests passing (15+ test cases)
- ✅ All existing tests passing

**Documentation**:

- ✅ JSDoc comments for all public methods
- ✅ Test coverage documentation
- ✅ Commit message with detailed changes

---

## Acceptance Criteria

**Code Quality**:

- ✅ Export service < 500 lines
- ✅ Utilities module < 500 lines
- ✅ All functions have JSDoc comments
- ✅ TypeScript strict mode compliance
- ✅ No linter warnings

**Functionality**:

- ✅ All export functionality preserved
- ✅ CSV escaping works correctly (commas, quotes, newlines)
- ✅ JSON export includes metadata
- ✅ All utility functions working correctly
- ✅ Date calculations accurate

**Testing**:

- ✅ Test coverage > 90% for new modules
- ✅ Edge cases tested (empty arrays, null values, etc.)
- ✅ CSV escaping edge cases tested
- ✅ All existing tests passing
- ✅ No test failures

**Integration**:

- ✅ Main service successfully uses new modules
- ✅ Import statements correct
- ✅ No circular dependencies
- ✅ TypeScript compilation succeeds

---

## Validation

**Manual Testing**:

```bash
# 1. Check file sizes
wc -l backend/src/services/admin-usage/*.ts

# Expected:
# ~400 admin-usage.utils.ts
# ~300 admin-usage-export.service.ts

# 2. Run type checking
npm --prefix backend run type-check

# Expected: No errors

# 3. Run linter
npm --prefix backend run lint

# Expected: No warnings

# 4. Run full test suite
npm --prefix backend test

# Expected: All tests pass

# 5. Check test coverage
npm --prefix backend run test:coverage -- admin-usage

# Expected: Coverage > 90%
```

**Integration Verification**:

```bash
# Start backend server
npm --prefix backend run dev

# Test export endpoint (requires authentication)
curl -X GET 'http://localhost:8081/api/v1/admin/usage/export?startDate=2025-01-01&endDate=2025-01-31&format=csv' \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: CSV data returned with proper headers
```

---

## Next Steps

**Immediate**:

- ✅ Commit changes
- ✅ Push to remote branch
- ✅ Verify CI/CD tests pass

**Next Session** (1F):

- Extract trend calculator service (~400 lines)
- Extract enrichment service (~400 lines)
- Further reduce main service size

**Link**: [Session 1F - Extract Trend & Enrichment Services](./phase-1-session-1f-extract-trend-enrichment.md)

---

## Troubleshooting

**Issue**: TypeScript errors after importing utilities

**Solution**: Check import paths are correct:

```typescript
// Correct
import { calculateComparisonPeriod } from './admin-usage/admin-usage.utils';

// Incorrect (missing directory)
import { calculateComparisonPeriod } from './admin-usage.utils';
```

---

**Issue**: Tests fail with "module not found"

**Solution**: Update test helper paths:

```typescript
// In test files
import { AdminUsageExportService } from '../../../../src/services/admin-usage/admin-usage-export.service';
```

---

**Issue**: CSV export has formatting issues

**Solution**: Verify `escapeCSVField` is being called on all fields:

```typescript
// Ensure this pattern is used
rows.map((row) => row.map(this.escapeCSVField).join(','));
```

---

## Notes

**Session Insights**:

- Utility functions are pure (no side effects) - easy to test
- Export service has no database dependencies - fast tests
- CSV escaping follows RFC 4180 standard
- JSON export includes comprehensive metadata

**Time Tracking**:

- Estimated: 2-3 hours
- Actual: _[Fill in after completion]_

**Blockers Encountered**:

- _[Document any blockers]_

**Discoveries**:

- _[Document any insights or issues found]_

---

_Last Updated: 2025-10-11_
_Session Status: Ready for Execution_

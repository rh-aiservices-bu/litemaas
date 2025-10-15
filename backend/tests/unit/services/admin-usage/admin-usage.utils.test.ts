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

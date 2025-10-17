// backend/tests/unit/utils/date-validation.test.ts

import { describe, it, expect } from 'vitest';
import {
  validateDateRangeSize,
  validateDateRangeWithWarning,
  isValidISODate,
  suggestDateRanges,
} from '../../../src/utils/date-validation';

describe('Date Validation Utilities', () => {
  describe('validateDateRangeSize', () => {
    it('should accept valid date range within limit', () => {
      const result = validateDateRangeSize('2025-01-01', '2025-01-31', 90);

      expect(result.valid).toBe(true);
      expect(result.days).toBe(31);
      expect(result.error).toBeUndefined();
    });

    it('should reject date range exceeding limit', () => {
      const result = validateDateRangeSize('2025-01-01', '2025-12-31', 90);

      expect(result.valid).toBe(false);
      expect(result.days).toBe(365);
      expect(result.code).toBe('DATE_RANGE_TOO_LARGE');
      expect(result.error).toContain('Maximum allowed is 90 days');
      expect(result.error).toContain('requested 365 days');
    });

    it('should reject invalid date order', () => {
      const result = validateDateRangeSize('2025-12-31', '2025-01-01', 90);

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_DATE_ORDER');
      expect(result.error).toContain('Start date must be before');
    });

    it('should reject invalid date format', () => {
      const result = validateDateRangeSize('invalid', '2025-01-31', 90);

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_DATE_FORMAT');
    });

    it('should accept range exactly at limit', () => {
      const result = validateDateRangeSize('2025-01-01', '2025-03-31', 90);

      expect(result.valid).toBe(true);
      expect(result.days).toBe(90);
    });

    it('should accept single-day range', () => {
      const result = validateDateRangeSize('2025-01-01', '2025-01-01', 90);

      expect(result.valid).toBe(true);
      expect(result.days).toBe(1);
    });

    it('should handle leap year correctly', () => {
      const result = validateDateRangeSize('2024-02-01', '2024-02-29', 90);

      expect(result.valid).toBe(true);
      expect(result.days).toBe(29);
    });
  });

  describe('validateDateRangeWithWarning', () => {
    it('should not warn for range below warning threshold', () => {
      const result = validateDateRangeWithWarning('2025-01-01', '2025-01-15', 90, 30);

      expect(result.valid).toBe(true);
      expect(result.days).toBe(15);
      expect(result.warning).toBeUndefined();
    });

    it('should warn for range above warning threshold', () => {
      const result = validateDateRangeWithWarning('2025-01-01', '2025-03-01', 90, 30);

      expect(result.valid).toBe(true);
      expect(result.days).toBe(60);
      expect(result.warning).toBe(true);
    });

    it('should still reject range exceeding max', () => {
      const result = validateDateRangeWithWarning('2025-01-01', '2025-12-31', 90, 30);

      expect(result.valid).toBe(false);
      expect(result.days).toBe(365);
      expect(result.code).toBe('DATE_RANGE_TOO_LARGE');
    });
  });

  describe('isValidISODate', () => {
    it('should accept valid ISO date', () => {
      expect(isValidISODate('2025-01-01')).toBe(true);
      expect(isValidISODate('2024-12-31')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidISODate('2025/01/01')).toBe(false);
      expect(isValidISODate('01-01-2025')).toBe(false);
      expect(isValidISODate('2025-1-1')).toBe(false);
      expect(isValidISODate('invalid')).toBe(false);
    });

    it('should reject invalid dates', () => {
      expect(isValidISODate('2025-02-30')).toBe(false); // Feb 30 doesn't exist
      expect(isValidISODate('2025-13-01')).toBe(false); // Month 13 doesn't exist
    });
  });

  describe('suggestDateRanges', () => {
    it('should return single range if within limit', () => {
      const result = suggestDateRanges('2025-01-01', '2025-01-31', 90);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
    });

    it('should split large range into chunks', () => {
      const result = suggestDateRanges('2025-01-01', '2025-12-31', 90);

      expect(result.length).toBeGreaterThan(1);

      // Verify each chunk is <= 90 days
      result.forEach((chunk) => {
        const validation = validateDateRangeSize(chunk.startDate, chunk.endDate, 90);
        expect(validation.valid).toBe(true);
      });

      // Verify chunks are contiguous
      for (let i = 1; i < result.length; i++) {
        const prevEnd = new Date(result[i - 1].endDate);
        const currentStart = new Date(result[i].startDate);
        const daysBetween = Math.abs(
          (currentStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24),
        );
        expect(daysBetween).toBeLessThanOrEqual(1);
      }
    });
  });
});

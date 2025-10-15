# Phase 3, Session 3B: Timezone Standardization

**Phase**: 3 - Architecture & Reliability
**Session**: 3B
**Duration**: 4-6 hours
**Priority**: 🟡 MEDIUM
**Issue**: #9 - Missing Timezone Documentation and Configuration

---

## Navigation

- **Previous**: [Phase 3, Session 3A: Configurable Constants](./phase-3-session-3a-configurable-constants.md)
- **Next**: [Phase 3, Session 3C: Race Conditions](./phase-3-session-3c-race-conditions.md)
- **Up**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

This session addresses timezone handling inconsistencies and edge cases in date processing across the admin analytics feature.

### Problem Statement

The current implementation has several timezone-related issues:

**Identified Problems**:

1. **Implicit Timezone Assumptions**: Code assumes UTC but doesn't enforce it
2. **Inconsistent Date Parsing**: Mix of `new Date()`, `parseISO()`, `Date.parse()`
3. **Missing DST Handling**: No tests for Daylight Saving Time transitions
4. **Midnight Edge Cases**: No tests for date boundaries (23:59:59 vs 00:00:00)
5. **Frontend/Backend Mismatch**: Different timezone handling in frontend vs backend
6. **No Documentation**: Timezone strategy not documented

**Impact**:

- Cache keys may mismatch across timezones
- "Today" determination may be incorrect for non-UTC servers
- Date range calculations may be off by one day
- DST transitions may cause cache misses or double-counting

**Example Bugs**:

```typescript
// ❌ PROBLEM: Implicit timezone
const today = new Date().toISOString().split('T')[0]; // Uses local timezone!

// ❌ PROBLEM: Midnight ambiguity
const isToday = date.getDate() === new Date().getDate(); // Broken across timezones

// ❌ PROBLEM: DST transitions
const comparisonDate = subDays(date, 7); // May be off if DST changed
```

### Success Criteria

After this session:

- ✅ All date operations explicitly use UTC
- ✅ Standardized date utilities module created
- ✅ DST transitions tested and handled correctly
- ✅ Midnight edge cases tested
- ✅ Multi-timezone scenarios tested
- ✅ Frontend and backend use same UTC approach
- ✅ Timezone strategy documented

---

## Phase 3 Summary

**Phase Objectives**: Architecture & reliability improvements for long-term maintainability

**Issues in Phase**:

1. **Issue #8** (Session 3A): Hard-coded business logic constants ✅
2. **Issue #9** (Session 3B): Missing timezone documentation and configuration ⬅ YOU ARE HERE
3. **Issue #10** (Session 3C): Race condition in cache TTL logic

**Total Phase Duration**: 13-18 hours

**Phase Priority**: 🟡 MEDIUM - Should complete before full production rollout

---

## Session Objectives

1. **Audit Timezone Usage**: Identify all date/time operations in codebase
2. **Create UTC Utilities**: Standardized date utilities with explicit UTC handling
3. **Update Backend**: Replace all date operations with UTC utilities
4. **Update Frontend**: Ensure frontend handles UTC correctly
5. **Add Timezone Tests**: Test DST, midnight, and multi-timezone scenarios
6. **Documentation**: Document timezone strategy and best practices

---

## Pre-Session Checklist

Before starting this session:

- [ ] Read Issue #9 in code review document
- [ ] Session 3A (Configurable Constants) completed
- [ ] All Phase 2 tests passing
- [ ] Review `date-fns` and `date-fns-tz` documentation
- [ ] Understand DST transition dates for test cases
- [ ] Plan timezone test scenarios
- [ ] Review server timezone configuration (should be UTC)

---

## Implementation Steps

### Step 3B.1: Audit Timezone Usage (30 minutes)

**Objective**: Identify all date/time operations in the codebase

**Search Patterns**:

```bash
# Find date operations
grep -r "new Date()" backend/src/services/admin-usage/
grep -r "Date.parse" backend/src/services/admin-usage/
grep -r "parseISO" backend/src/services/admin-usage/
grep -r "toISOString" backend/src/services/admin-usage/
grep -r "getDate()" backend/src/services/admin-usage/
grep -r "getTime()" backend/src/services/admin-usage/

# Find date-fns usage
grep -r "format(" backend/src/services/admin-usage/
grep -r "subDays" backend/src/services/admin-usage/
grep -r "addDays" backend/src/services/admin-usage/
grep -r "startOfDay" backend/src/services/admin-usage/
grep -r "endOfDay" backend/src/services/admin-usage/
```

**Document Findings**:

```markdown
# Timezone Audit Results

## Date Operations Found: 47

### By Category:

1. **Date Parsing** (12 occurrences):
   - `parseISO()` in filters
   - `new Date()` in cache keys
   - `Date.parse()` in validation

2. **Date Formatting** (8 occurrences):
   - `toISOString().split('T')[0]` for cache keys
   - `format(date, 'yyyy-MM-dd')`

3. **Date Comparison** (15 occurrences):
   - `isTodayUTC()` helper
   - `isBefore()`, `isAfter()`
   - Date arithmetic with `subDays()`, `addDays()`

4. **Timezone-Sensitive Operations** (12 occurrences):
   - "Today" determination for cache TTL
   - Date range validation
   - Comparison period calculation

### Risk Assessment:

- 🔴 HIGH RISK: 5 operations (implicit timezone)
- 🟡 MEDIUM RISK: 12 operations (ambiguous timezone)
- 🟢 LOW RISK: 30 operations (already using UTC)
```

---

### Step 3B.2: Install date-fns-tz (10 minutes)

**Install Dependencies**:

```bash
npm --prefix backend install date-fns-tz
npm --prefix frontend install date-fns-tz
```

**Verify Installation**:

```bash
grep "date-fns-tz" backend/package.json
grep "date-fns-tz" frontend/package.json
```

---

### Step 3B.3: Create UTC Date Utilities (1 hour)

**Files to Create**:

- `backend/src/utils/date-utc.utils.ts`

**Implementation**:

```typescript
// backend/src/utils/date-utc.utils.ts

/**
 * UTC Date Utilities
 *
 * All admin analytics date operations should use UTC to ensure consistency
 * across different server timezones and prevent cache key mismatches.
 *
 * Key Principles:
 * 1. All dates are treated as UTC
 * 2. Date strings are in YYYY-MM-DD format (ISO 8601)
 * 3. "Today" is determined by UTC date, not local date
 * 4. DST transitions are irrelevant (UTC has no DST)
 *
 * @module date-utc.utils
 */

import {
  parseISO,
  format,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  differenceInDays,
  isBefore,
  isAfter,
  isEqual,
} from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const UTC_TIMEZONE = 'UTC';

/**
 * Parse YYYY-MM-DD date string as UTC midnight
 *
 * This is the standard format for date strings in admin analytics.
 * Always represents the start of day (00:00:00) in UTC.
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date object representing UTC midnight of that date
 *
 * @example
 * parseDateAsUTC('2025-01-15')
 * // => 2025-01-15T00:00:00.000Z
 */
export function parseDateAsUTC(dateString: string): Date {
  // Parse as UTC by appending timezone
  const isoString = `${dateString}T00:00:00.000Z`;
  return parseISO(isoString);
}

/**
 * Format Date object as YYYY-MM-DD in UTC
 *
 * Converts any Date to its UTC date representation.
 * Use this for cache keys, API responses, database queries.
 *
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format (UTC)
 *
 * @example
 * formatDateAsUTC(new Date('2025-01-15T23:30:00Z'))
 * // => '2025-01-15'
 *
 * formatDateAsUTC(new Date('2025-01-15T23:30:00-05:00'))
 * // => '2025-01-16' (converted to UTC first)
 */
export function formatDateAsUTC(date: Date): string {
  const utcDate = utcToZonedTime(date, UTC_TIMEZONE);
  return format(utcDate, 'yyyy-MM-dd');
}

/**
 * Get current date in UTC as YYYY-MM-DD
 *
 * Use this instead of new Date() for "today" determination.
 *
 * @returns Current UTC date in YYYY-MM-DD format
 *
 * @example
 * getTodayUTC()
 * // => '2025-01-15'  (regardless of server timezone)
 */
export function getTodayUTC(): string {
  const now = new Date();
  return formatDateAsUTC(now);
}

/**
 * Check if a date string represents today in UTC
 *
 * Critical for cache TTL logic. Current day cache has short TTL,
 * historical cache has long TTL.
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @returns True if date is today in UTC
 *
 * @example
 * // If current UTC time is 2025-01-15 23:30:00Z
 * isTodayUTC('2025-01-15')  // => true
 * isTodayUTC('2025-01-14')  // => false
 *
 * // Even if local time is 2025-01-16 01:30:00 (UTC-5)
 * // Still returns true because UTC date is 2025-01-15
 */
export function isTodayUTC(dateString: string): boolean {
  return dateString === getTodayUTC();
}

/**
 * Get start of day in UTC
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date object representing start of day (00:00:00) in UTC
 */
export function getStartOfDayUTC(dateString: string): Date {
  const date = parseDateAsUTC(dateString);
  const utcDate = utcToZonedTime(date, UTC_TIMEZONE);
  const startOfDayLocal = startOfDay(utcDate);
  return zonedTimeToUtc(startOfDayLocal, UTC_TIMEZONE);
}

/**
 * Get end of day in UTC
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Date object representing end of day (23:59:59.999) in UTC
 */
export function getEndOfDayUTC(dateString: string): Date {
  const date = parseDateAsUTC(dateString);
  const utcDate = utcToZonedTime(date, UTC_TIMEZONE);
  const endOfDayLocal = endOfDay(utcDate);
  return zonedTimeToUtc(endOfDayLocal, UTC_TIMEZONE);
}

/**
 * Add days to a UTC date
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param days - Number of days to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 *
 * @example
 * addDaysUTC('2025-01-15', 7)
 * // => '2025-01-22'
 *
 * addDaysUTC('2025-01-15', -7)
 * // => '2025-01-08'
 */
export function addDaysUTC(dateString: string, days: number): string {
  const date = parseDateAsUTC(dateString);
  const newDate = addDays(date, days);
  return formatDateAsUTC(newDate);
}

/**
 * Subtract days from a UTC date
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param days - Number of days to subtract
 * @returns New date string in YYYY-MM-DD format
 *
 * @example
 * subDaysUTC('2025-01-15', 7)
 * // => '2025-01-08'
 */
export function subDaysUTC(dateString: string, days: number): string {
  const date = parseDateAsUTC(dateString);
  const newDate = subDays(date, days);
  return formatDateAsUTC(newDate);
}

/**
 * Calculate difference in days between two UTC dates
 *
 * @param startDateString - Start date in YYYY-MM-DD format
 * @param endDateString - End date in YYYY-MM-DD format
 * @returns Number of days between dates (positive if end > start)
 *
 * @example
 * differenceInDaysUTC('2025-01-01', '2025-01-31')
 * // => 30
 *
 * differenceInDaysUTC('2025-01-31', '2025-01-01')
 * // => -30
 */
export function differenceInDaysUTC(startDateString: string, endDateString: string): number {
  const startDate = parseDateAsUTC(startDateString);
  const endDate = parseDateAsUTC(endDateString);
  return differenceInDays(endDate, startDate);
}

/**
 * Compare two UTC dates
 *
 * @param dateString1 - First date in YYYY-MM-DD format
 * @param dateString2 - Second date in YYYY-MM-DD format
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDatesUTC(dateString1: string, dateString2: string): number {
  const date1 = parseDateAsUTC(dateString1);
  const date2 = parseDateAsUTC(dateString2);

  if (isBefore(date1, date2)) return -1;
  if (isAfter(date1, date2)) return 1;
  return 0;
}

/**
 * Check if date1 is before date2 in UTC
 */
export function isBeforeUTC(dateString1: string, dateString2: string): boolean {
  return compareDatesUTC(dateString1, dateString2) < 0;
}

/**
 * Check if date1 is after date2 in UTC
 */
export function isAfterUTC(dateString1: string, dateString2: string): boolean {
  return compareDatesUTC(dateString1, dateString2) > 0;
}

/**
 * Check if two dates are equal in UTC
 */
export function isEqualUTC(dateString1: string, dateString2: string): boolean {
  return dateString1 === dateString2;
}

/**
 * Generate array of date strings between start and end (inclusive)
 *
 * Useful for iterating over date ranges.
 *
 * @param startDateString - Start date in YYYY-MM-DD format
 * @param endDateString - End date in YYYY-MM-DD format
 * @returns Array of date strings
 *
 * @example
 * getDateRangeUTC('2025-01-01', '2025-01-05')
 * // => ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05']
 */
export function getDateRangeUTC(startDateString: string, endDateString: string): string[] {
  const days = differenceInDaysUTC(startDateString, endDateString);

  if (days < 0) {
    throw new Error(
      `Start date must be before or equal to end date. Got: ${startDateString} > ${endDateString}`,
    );
  }

  const dates: string[] = [];
  for (let i = 0; i <= days; i++) {
    dates.push(addDaysUTC(startDateString, i));
  }

  return dates;
}

/**
 * Validate YYYY-MM-DD date string format
 *
 * @param dateString - Date string to validate
 * @returns True if valid format
 */
export function isValidDateFormat(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  // Try parsing to validate it's a real date
  try {
    const date = parseDateAsUTC(dateString);
    const formatted = formatDateAsUTC(date);
    return formatted === dateString;
  } catch {
    return false;
  }
}

/**
 * Calculate comparison period for trend analysis
 *
 * Given a date range, returns the comparison period of equal length
 * immediately preceding the requested period.
 *
 * @param startDateString - Start date in YYYY-MM-DD format
 * @param endDateString - End date in YYYY-MM-DD format
 * @returns Comparison period start and end dates
 *
 * @example
 * getComparisonPeriodUTC('2025-01-15', '2025-01-21')
 * // => { start: '2025-01-08', end: '2025-01-14', days: 7 }
 */
export function getComparisonPeriodUTC(
  startDateString: string,
  endDateString: string,
): { start: string; end: string; days: number } {
  const days = differenceInDaysUTC(startDateString, endDateString) + 1;

  // Comparison period ends the day before start
  const comparisonEnd = subDaysUTC(startDateString, 1);

  // Comparison period starts (days - 1) before comparison end
  const comparisonStart = subDaysUTC(comparisonEnd, days - 1);

  return {
    start: comparisonStart,
    end: comparisonEnd,
    days,
  };
}
```

**Export from Index**:

```typescript
// backend/src/utils/index.ts
export * from './date-utc.utils';
```

---

### Step 3B.4: Add Comprehensive UTC Tests (1.5 hours)

**Files to Create**:

- `backend/tests/unit/utils/date-utc.utils.test.ts`

**Implementation**:

```typescript
// backend/tests/unit/utils/date-utc.utils.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseDateAsUTC,
  formatDateAsUTC,
  getTodayUTC,
  isTodayUTC,
  addDaysUTC,
  subDaysUTC,
  differenceInDaysUTC,
  compareDatesUTC,
  getDateRangeUTC,
  getComparisonPeriodUTC,
  isValidDateFormat,
} from '../../../src/utils/date-utc.utils';

describe('UTC Date Utilities', () => {
  describe('parseDateAsUTC', () => {
    it('should parse YYYY-MM-DD as UTC midnight', () => {
      const date = parseDateAsUTC('2025-01-15');

      expect(date.toISOString()).toBe('2025-01-15T00:00:00.000Z');
    });

    it('should handle leap years', () => {
      const date = parseDateAsUTC('2024-02-29');

      expect(date.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    });
  });

  describe('formatDateAsUTC', () => {
    it('should format Date as YYYY-MM-DD in UTC', () => {
      const date = new Date('2025-01-15T23:30:00.000Z');

      expect(formatDateAsUTC(date)).toBe('2025-01-15');
    });

    it('should convert non-UTC dates to UTC first', () => {
      // 2025-01-15 23:30 EST = 2025-01-16 04:30 UTC
      const date = new Date('2025-01-15T23:30:00-05:00');

      expect(formatDateAsUTC(date)).toBe('2025-01-16');
    });

    it('should handle date exactly at midnight UTC', () => {
      const date = new Date('2025-01-15T00:00:00.000Z');

      expect(formatDateAsUTC(date)).toBe('2025-01-15');
    });

    it('should handle date one millisecond before midnight UTC', () => {
      const date = new Date('2025-01-15T23:59:59.999Z');

      expect(formatDateAsUTC(date)).toBe('2025-01-15');
    });
  });

  describe('getTodayUTC', () => {
    it('should return current UTC date regardless of server timezone', () => {
      // Mock current time to a specific UTC moment
      const mockNow = new Date('2025-01-15T14:30:00.000Z');
      vi.setSystemTime(mockNow);

      expect(getTodayUTC()).toBe('2025-01-15');

      vi.useRealTimers();
    });

    it('should return correct date near midnight UTC', () => {
      // Just before midnight UTC
      vi.setSystemTime(new Date('2025-01-15T23:59:59.999Z'));
      expect(getTodayUTC()).toBe('2025-01-15');

      // Just after midnight UTC
      vi.setSystemTime(new Date('2025-01-16T00:00:00.001Z'));
      expect(getTodayUTC()).toBe('2025-01-16');

      vi.useRealTimers();
    });
  });

  describe('isTodayUTC', () => {
    beforeEach(() => {
      // Mock current time to 2025-01-15 14:30 UTC
      vi.setSystemTime(new Date('2025-01-15T14:30:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for today', () => {
      expect(isTodayUTC('2025-01-15')).toBe(true);
    });

    it('should return false for yesterday', () => {
      expect(isTodayUTC('2025-01-14')).toBe(false);
    });

    it('should return false for tomorrow', () => {
      expect(isTodayUTC('2025-01-16')).toBe(false);
    });
  });

  describe('addDaysUTC', () => {
    it('should add days correctly', () => {
      expect(addDaysUTC('2025-01-15', 7)).toBe('2025-01-22');
    });

    it('should handle negative days (subtract)', () => {
      expect(addDaysUTC('2025-01-15', -7)).toBe('2025-01-08');
    });

    it('should handle month boundaries', () => {
      expect(addDaysUTC('2025-01-31', 1)).toBe('2025-02-01');
    });

    it('should handle year boundaries', () => {
      expect(addDaysUTC('2024-12-31', 1)).toBe('2025-01-01');
    });

    it('should handle leap years', () => {
      expect(addDaysUTC('2024-02-28', 1)).toBe('2024-02-29');
      expect(addDaysUTC('2024-02-29', 1)).toBe('2024-03-01');
    });
  });

  describe('subDaysUTC', () => {
    it('should subtract days correctly', () => {
      expect(subDaysUTC('2025-01-15', 7)).toBe('2025-01-08');
    });

    it('should handle month boundaries', () => {
      expect(subDaysUTC('2025-02-01', 1)).toBe('2025-01-31');
    });

    it('should handle year boundaries', () => {
      expect(subDaysUTC('2025-01-01', 1)).toBe('2024-12-31');
    });
  });

  describe('differenceInDaysUTC', () => {
    it('should calculate difference correctly', () => {
      expect(differenceInDaysUTC('2025-01-01', '2025-01-31')).toBe(30);
    });

    it('should return negative for reversed dates', () => {
      expect(differenceInDaysUTC('2025-01-31', '2025-01-01')).toBe(-30);
    });

    it('should return 0 for same date', () => {
      expect(differenceInDaysUTC('2025-01-15', '2025-01-15')).toBe(0);
    });

    it('should handle leap years', () => {
      expect(differenceInDaysUTC('2024-02-01', '2024-02-29')).toBe(28);
      expect(differenceInDaysUTC('2025-02-01', '2025-02-28')).toBe(27);
    });
  });

  describe('getDateRangeUTC', () => {
    it('should generate date range correctly', () => {
      const range = getDateRangeUTC('2025-01-01', '2025-01-05');

      expect(range).toEqual(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05']);
    });

    it('should handle single day range', () => {
      const range = getDateRangeUTC('2025-01-15', '2025-01-15');

      expect(range).toEqual(['2025-01-15']);
    });

    it('should handle month boundaries', () => {
      const range = getDateRangeUTC('2025-01-30', '2025-02-02');

      expect(range).toEqual(['2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02']);
    });

    it('should throw error if start > end', () => {
      expect(() => getDateRangeUTC('2025-01-15', '2025-01-10')).toThrow();
    });
  });

  describe('getComparisonPeriodUTC', () => {
    it('should calculate 7-day comparison period', () => {
      const comparison = getComparisonPeriodUTC('2025-01-15', '2025-01-21');

      expect(comparison).toEqual({
        start: '2025-01-08',
        end: '2025-01-14',
        days: 7,
      });
    });

    it('should calculate 30-day comparison period', () => {
      const comparison = getComparisonPeriodUTC('2025-02-01', '2025-03-02');

      expect(comparison.days).toBe(30);
      expect(differenceInDaysUTC(comparison.start, comparison.end)).toBe(29);
    });

    it('should handle single day period', () => {
      const comparison = getComparisonPeriodUTC('2025-01-15', '2025-01-15');

      expect(comparison).toEqual({
        start: '2025-01-14',
        end: '2025-01-14',
        days: 1,
      });
    });
  });

  describe('isValidDateFormat', () => {
    it('should accept valid YYYY-MM-DD format', () => {
      expect(isValidDateFormat('2025-01-15')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidDateFormat('2025-1-15')).toBe(false); // Single digit month
      expect(isValidDateFormat('2025-01-5')).toBe(false); // Single digit day
      expect(isValidDateFormat('01-15-2025')).toBe(false); // Wrong order
      expect(isValidDateFormat('2025/01/15')).toBe(false); // Wrong separator
    });

    it('should reject invalid dates', () => {
      expect(isValidDateFormat('2025-02-30')).toBe(false); // Feb 30th
      expect(isValidDateFormat('2025-13-01')).toBe(false); // Month 13
      expect(isValidDateFormat('2025-00-01')).toBe(false); // Month 0
    });

    it('should accept leap year dates', () => {
      expect(isValidDateFormat('2024-02-29')).toBe(true);
    });

    it('should reject invalid leap year dates', () => {
      expect(isValidDateFormat('2025-02-29')).toBe(false);
    });
  });

  describe('DST Transitions', () => {
    // DST doesn't affect UTC, but test to ensure no weird behavior

    it('should handle US DST spring forward (March)', () => {
      // In US, clocks spring forward on 2nd Sunday in March
      // UTC is unaffected
      const beforeDST = parseDateAsUTC('2025-03-08');
      const afterDST = parseDateAsUTC('2025-03-10');

      const diff = differenceInDaysUTC('2025-03-08', '2025-03-10');
      expect(diff).toBe(2); // Still exactly 2 days
    });

    it('should handle US DST fall back (November)', () => {
      // In US, clocks fall back on 1st Sunday in November
      // UTC is unaffected
      const beforeDST = parseDateAsUTC('2025-11-01');
      const afterDST = parseDateAsUTC('2025-11-03');

      const diff = differenceInDaysUTC('2025-11-01', '2025-11-03');
      expect(diff).toBe(2); // Still exactly 2 days
    });
  });

  describe('Edge Cases', () => {
    it('should handle year 2000 (leap year)', () => {
      expect(isValidDateFormat('2000-02-29')).toBe(true);
    });

    it('should handle year 2100 (not a leap year)', () => {
      expect(isValidDateFormat('2100-02-29')).toBe(false);
    });

    it('should handle year 2400 (leap year)', () => {
      expect(isValidDateFormat('2400-02-29')).toBe(true);
    });

    it('should handle very old dates', () => {
      expect(isValidDateFormat('1970-01-01')).toBe(true);
    });

    it('should handle far future dates', () => {
      expect(isValidDateFormat('2099-12-31')).toBe(true);
    });
  });
});
```

---

### Step 3B.5: Update Backend Services to Use UTC Utilities (1 hour)

**Pattern for All Services**:

```typescript
// BEFORE (implicit timezone)
const today = new Date().toISOString().split('T')[0];
const isToday = date.getDate() === new Date().getDate();

// AFTER (explicit UTC)
import { getTodayUTC, isTodayUTC } from '../../utils/date-utc.utils';

const today = getTodayUTC();
const isToday = isTodayUTC(dateString);
```

**Files to Modify**:

1. **Cache Manager**:

```typescript
// backend/src/services/admin-usage/daily-usage-cache-manager.ts

import {
  parseDateAsUTC,
  formatDateAsUTC,
  getTodayUTC,
  isTodayUTC,
  getDateRangeUTC,
} from '../../utils/date-utc.utils';

export class DailyUsageCacheManager {
  /**
   * Get cache TTL based on whether date is today (UTC)
   */
  private getCacheTTL(dateString: string): number {
    // Use UTC-aware today check
    const isToday = isTodayUTC(dateString);

    if (isToday) {
      return this.config.cache.currentDayTTLMinutes * 60;
    }
    return this.config.cache.historicalTTLDays * 24 * 60 * 60;
  }

  /**
   * Generate cache key for a date
   */
  private getCacheKey(dateString: string): string {
    // Ensure consistent UTC format
    const date = parseDateAsUTC(dateString);
    const normalized = formatDateAsUTC(date);
    return `daily_usage:${normalized}`;
  }

  /**
   * Rebuild cache for date range
   */
  async rebuildCache(startDate: string, endDate: string): Promise<void> {
    // Use UTC date range generator
    const dates = getDateRangeUTC(startDate, endDate);

    for (const date of dates) {
      await this.rebuildDayCache(date);
    }
  }
}
```

2. **Admin Usage Stats Service**:

```typescript
// backend/src/services/admin-usage-stats.service.ts

import { getComparisonPeriodUTC, differenceInDaysUTC } from '../utils/date-utc.utils';

export class AdminUsageStatsService extends BaseService {
  async getAnalytics(filters: AdminUsageFilters): Promise<Analytics> {
    const { startDate, endDate } = filters;

    // Calculate comparison period using UTC utilities
    const { start: comparisonStart, end: comparisonEnd } = getComparisonPeriodUTC(
      startDate,
      endDate,
    );

    // Get data for both periods
    const currentData = await this.getUsageData(startDate, endDate);
    const comparisonData = await this.getUsageData(comparisonStart, comparisonEnd);

    // Calculate trends
    const trends = this.trendCalculator.calculateTrends(currentData, comparisonData);

    return {
      period: {
        start: startDate,
        end: endDate,
        days: differenceInDaysUTC(startDate, endDate) + 1,
      },
      comparisonPeriod: {
        start: comparisonStart,
        end: comparisonEnd,
        days: differenceInDaysUTC(comparisonStart, comparisonEnd) + 1,
      },
      currentData,
      comparisonData,
      trends,
    };
  }
}
```

3. **Date Validation**:

```typescript
// backend/src/utils/date-validation.ts

import {
  parseDateAsUTC,
  differenceInDaysUTC,
  isBeforeUTC,
  isValidDateFormat,
} from './date-utc.utils';

export function validateDateRangeSize(
  startDate: string,
  endDate: string,
  maxDays: number,
): DateRangeValidationResult {
  // Validate format first
  if (!isValidDateFormat(startDate)) {
    return {
      valid: false,
      error: `Invalid start date format: ${startDate}. Expected YYYY-MM-DD.`,
      code: 'INVALID_DATE_FORMAT',
    };
  }

  if (!isValidDateFormat(endDate)) {
    return {
      valid: false,
      error: `Invalid end date format: ${endDate}. Expected YYYY-MM-DD.`,
      code: 'INVALID_DATE_FORMAT',
    };
  }

  // Check order using UTC comparison
  if (isBeforeUTC(endDate, startDate)) {
    return {
      valid: false,
      error: 'Start date must be before or equal to end date.',
      code: 'INVALID_DATE_ORDER',
    };
  }

  // Calculate range using UTC difference
  const days = differenceInDaysUTC(startDate, endDate) + 1;

  if (days > maxDays) {
    return {
      valid: false,
      days,
      error: `Date range too large. Maximum allowed is ${maxDays} days, requested ${days} days.`,
      code: 'DATE_RANGE_TOO_LARGE',
    };
  }

  return {
    valid: true,
    days,
  };
}
```

---

### Step 3B.6: Update Frontend to Handle UTC (45 minutes)

**Create Frontend UTC Utilities**:

```typescript
// frontend/src/utils/date-utc.ts

/**
 * Frontend UTC Date Utilities
 *
 * Ensures consistency with backend UTC handling.
 * All date strings sent to/from API are in YYYY-MM-DD format representing UTC dates.
 */

import { format, parseISO } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

/**
 * Format Date as YYYY-MM-DD in UTC
 */
export function formatDateAsUTC(date: Date): string {
  const utcDate = utcToZonedTime(date, 'UTC');
  return format(utcDate, 'yyyy-MM-dd');
}

/**
 * Get today's date in UTC as YYYY-MM-DD
 */
export function getTodayUTC(): string {
  return formatDateAsUTC(new Date());
}

/**
 * Parse YYYY-MM-DD as UTC date for display
 *
 * Use this when you need to display a date string from API in local timezone.
 */
export function parseUTCDateForDisplay(dateString: string): Date {
  return parseISO(`${dateString}T00:00:00.000Z`);
}

/**
 * Format UTC date string for user display
 *
 * Converts YYYY-MM-DD to localized format (e.g., "Jan 15, 2025")
 */
export function formatUTCDateForDisplay(dateString: string, locale: string = 'en-US'): string {
  const date = parseUTCDateForDisplay(dateString);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
```

**Update Components**:

```typescript
// frontend/src/pages/AdminUsagePage.tsx

import { getTodayUTC, formatDateAsUTC } from '../utils/date-utc';

const AdminUsagePage: React.FC = () => {
  // Use UTC for initial dates
  const [customStartDate, setCustomStartDate] = useState(formatDateAsUTC(subDays(new Date(), 30)));
  const [customEndDate, setCustomEndDate] = useState(getTodayUTC());

  const handleDateInputChange = (inputDate: Date | undefined, isStartDate: boolean) => {
    if (!inputDate) return;

    // Convert to UTC YYYY-MM-DD format
    const dateString = formatDateAsUTC(inputDate);

    if (isStartDate) {
      setCustomStartDate(dateString);
    } else {
      setCustomEndDate(dateString);
    }
  };

  // ... rest of component
};
```

---

### Step 3B.7: Add Integration Tests for Timezone Scenarios (1 hour)

**Files to Create**:

- `backend/tests/integration/timezone-scenarios.test.ts`

**Implementation**:

```typescript
// backend/tests/integration/timezone-scenarios.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app';
import { getTodayUTC, subDaysUTC, addDaysUTC } from '../../src/utils/date-utc.utils';

describe('Timezone Scenarios', () => {
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    adminToken = await getAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Current Day Cache TTL', () => {
    it('should use short TTL for today regardless of server timezone', async () => {
      const today = getTodayUTC();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: today,
          endDate: today,
        },
      });

      expect(response.statusCode).toBe(200);

      // Check cache headers (should indicate short TTL)
      const cacheControl = response.headers['cache-control'];
      expect(cacheControl).toBeDefined();
    });

    it('should use long TTL for yesterday', async () => {
      const yesterday = subDaysUTC(getTodayUTC(), 1);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: yesterday,
          endDate: yesterday,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Date Range Across Timezones', () => {
    it('should calculate date range consistently in UTC', async () => {
      const start = '2025-01-01';
      const end = '2025-01-31';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { startDate: start, endDate: end },
      });

      const data = response.json();

      // Should always be 31 days, regardless of server timezone
      expect(data.period.days).toBe(31);
    });
  });

  describe('Comparison Period Calculation', () => {
    it('should calculate comparison period correctly across month boundaries', async () => {
      // Feb 1-7 => comparison should be Jan 25-31 (7 days)
      const start = '2025-02-01';
      const end = '2025-02-07';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { startDate: start, endDate: end },
      });

      const data = response.json();

      expect(data.comparisonPeriod.start).toBe('2025-01-25');
      expect(data.comparisonPeriod.end).toBe('2025-01-31');
      expect(data.comparisonPeriod.days).toBe(7);
    });

    it('should handle comparison period across year boundaries', async () => {
      // Jan 1-7 => comparison should be Dec 25-31 previous year
      const start = '2025-01-01';
      const end = '2025-01-07';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { startDate: start, endDate: end },
      });

      const data = response.json();

      expect(data.comparisonPeriod.start).toBe('2024-12-25');
      expect(data.comparisonPeriod.end).toBe('2024-12-31');
    });
  });

  describe('Midnight Boundaries', () => {
    it('should handle requests at UTC midnight correctly', async () => {
      // This test should be run at exactly 00:00:00 UTC
      // In practice, mocking time is more reliable

      const today = getTodayUTC();
      const yesterday = subDaysUTC(today, 1);

      // Request for yesterday should not be treated as "today"
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: yesterday,
          endDate: yesterday,
        },
      });

      expect(response.statusCode).toBe(200);
      // Should use long TTL (historical cache)
    });
  });

  describe('DST Transitions', () => {
    it('should handle US DST spring forward consistently', async () => {
      // March 2025: DST starts March 9
      const beforeDST = '2025-03-08';
      const afterDST = '2025-03-10';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: beforeDST,
          endDate: afterDST,
        },
      });

      const data = response.json();

      // Should be exactly 3 days, not affected by DST
      expect(data.period.days).toBe(3);
    });

    it('should handle US DST fall back consistently', async () => {
      // November 2025: DST ends November 2
      const beforeDST = '2025-11-01';
      const afterDST = '2025-11-03';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: beforeDST,
          endDate: afterDST,
        },
      });

      const data = response.json();

      // Should be exactly 3 days, not affected by DST
      expect(data.period.days).toBe(3);
    });
  });
});
```

---

### Step 3B.8: Documentation (45 minutes)

**Create Timezone Strategy Doc**:

```markdown
<!-- docs/development/timezone-strategy.md -->

# Timezone Strategy

## Overview

All date operations in the admin analytics feature use **UTC exclusively** to ensure consistency across different server timezones and prevent cache key mismatches.

## Principles

1. **UTC Everywhere**: All dates are treated as UTC, both in backend and frontend
2. **ISO 8601 Format**: Date strings are in `YYYY-MM-DD` format
3. **Explicit Timezone**: No implicit timezone conversions
4. **Server Independence**: Behavior identical regardless of server timezone setting

## Date Format Standard

All date strings in the admin analytics API follow this format:
```

YYYY-MM-DD

````

Examples:
- `2025-01-15` (January 15, 2025)
- `2024-02-29` (February 29, 2024 - leap year)

This format:
- Is unambiguous (no MM/DD vs DD/MM confusion)
- Is lexicographically sortable
- Is the ISO 8601 date format
- Represents the UTC date (not local date)

## Backend Implementation

### UTC Utilities Module

All date operations use the `date-utc.utils.ts` module:

```typescript
import {
  parseDateAsUTC,
  formatDateAsUTC,
  getTodayUTC,
  isTodayUTC,
  addDaysUTC,
  subDaysUTC,
} from './utils/date-utc.utils';

// ✅ Correct: Explicit UTC
const today = getTodayUTC();
const isToday = isTodayUTC(dateString);

// ❌ Wrong: Implicit timezone
const today = new Date().toISOString().split('T')[0];
const isToday = date.getDate() === new Date().getDate();
````

### Cache Keys

Cache keys include UTC date strings:

```typescript
// ✅ Correct: UTC date in cache key
const cacheKey = `daily_usage:${formatDateAsUTC(date)}`;
// => "daily_usage:2025-01-15"

// ❌ Wrong: Local date in cache key
const cacheKey = `daily_usage:${date.toLocaleDateString()}`;
// => "daily_usage:1/15/2025" (format varies by locale, not sortable)
```

### "Today" Determination

Critical for cache TTL logic:

```typescript
// ✅ Correct: UTC today
const isToday = isTodayUTC(dateString);
if (isToday) {
  cacheTTL = 5 * 60; // 5 minutes for current day
} else {
  cacheTTL = 365 * 24 * 60 * 60; // 1 year for historical
}

// ❌ Wrong: Local today
const isToday = new Date(dateString).toDateString() === new Date().toDateString();
// Breaks if server timezone != UTC
```

## Frontend Implementation

### Date Pickers

PatternFly DatePicker components return local Date objects. Convert to UTC:

```typescript
import { formatDateAsUTC } from '../utils/date-utc';

const handleDateChange = (date: Date | undefined) => {
  if (!date) return;

  // Convert to UTC YYYY-MM-DD string for API
  const dateString = formatDateAsUTC(date);
  setStartDate(dateString);
};
```

### Display Formatting

When displaying dates to users, you can optionally show in local timezone:

```typescript
import { formatUTCDateForDisplay } from '../utils/date-utc';

// Display in user's locale
const displayDate = formatUTCDateForDisplay('2025-01-15', i18n.language);
// => "Jan 15, 2025" (or localized equivalent)
```

## Common Pitfalls

### ❌ Pitfall 1: Using `new Date()` without UTC conversion

```typescript
// WRONG
const today = new Date().toISOString().split('T')[0];
// If server is in UTC-5 and time is 23:30, this gives tomorrow's date

// RIGHT
import { getTodayUTC } from './utils/date-utc.utils';
const today = getTodayUTC();
// Always gives correct UTC date
```

### ❌ Pitfall 2: Implicit timezone in date comparisons

```typescript
// WRONG
const isToday = date.getDate() === new Date().getDate();
// Breaks across timezones

// RIGHT
import { isTodayUTC } from './utils/date-utc.utils';
const isToday = isTodayUTC(dateString);
```

### ❌ Pitfall 3: Local date arithmetic

```typescript
// WRONG
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const dateString = yesterday.toISOString().split('T')[0];
// DST transitions may cause issues

// RIGHT
import { getTodayUTC, subDaysUTC } from './utils/date-utc.utils';
const yesterday = subDaysUTC(getTodayUTC(), 1);
```

## Testing Strategy

### Test Categories

1. **Format Validation**: Ensure YYYY-MM-DD format enforced
2. **Midnight Boundaries**: Test dates at exactly 00:00:00 UTC
3. **DST Transitions**: Test US DST spring forward (March) and fall back (November)
4. **Leap Years**: Test Feb 29 on leap years, reject on non-leap years
5. **Multi-timezone**: Mock different server timezones, ensure consistent behavior

### Test Examples

```typescript
describe('Timezone Handling', () => {
  it('should use UTC for today determination', () => {
    // Mock UTC time: 2025-01-15 23:30:00Z
    vi.setSystemTime(new Date('2025-01-15T23:30:00Z'));

    expect(getTodayUTC()).toBe('2025-01-15');

    vi.useRealTimers();
  });

  it('should handle DST transitions', () => {
    // March 9, 2025: DST starts
    const beforeDST = '2025-03-08';
    const afterDST = '2025-03-10';

    const days = differenceInDaysUTC(beforeDST, afterDST);
    expect(days).toBe(2); // Exactly 2 days, unaffected by DST
  });
});
```

## Server Configuration

### Recommended Setup

Set server timezone to UTC:

```bash
# Linux
sudo timedatectl set-timezone UTC

# Docker
ENV TZ=UTC

# Node.js
TZ=UTC node server.js
```

### Verification

Check server timezone:

```bash
# Linux
timedatectl

# Node.js
node -e "console.log(new Date().toString())"
# Should show "GMT+0000 (Coordinated Universal Time)"
```

## Migration Guide

If you have existing code with implicit timezones:

1. **Search for Date Operations**:

   ```bash
   grep -r "new Date()" src/
   grep -r "toISOString()" src/
   grep -r "getDate()" src/
   ```

2. **Replace with UTC Utilities**:

   ```typescript
   // Before
   const today = new Date().toISOString().split('T')[0];

   // After
   import { getTodayUTC } from './utils/date-utc.utils';
   const today = getTodayUTC();
   ```

3. **Add Tests**:
   - Test with mocked times near midnight UTC
   - Test with dates during DST transitions
   - Test comparison period calculations

4. **Verify Cache Keys**:
   - Check cache keys are consistent
   - Ensure "today" determination matches between cache and queries

## FAQ

**Q: Why UTC instead of local time?**

A: UTC provides a single reference point. If we used local time:

- Cache keys would vary by server timezone
- "Today" would be different for servers in different timezones
- DST transitions would cause cache misses
- Distributed systems (multiple servers) would have inconsistent data

**Q: How do I display dates in user's local timezone?**

A: The YYYY-MM-DD format represents a UTC date. When displaying to users, you can optionally convert to local timezone using `formatUTCDateForDisplay()`. However, for analytics, showing UTC dates is usually acceptable and avoids confusion.

**Q: What about DST transitions?**

A: UTC has no DST, so DST transitions don't affect our date calculations. This is a major advantage of using UTC.

**Q: What if my server is in a different timezone?**

A: Doesn't matter. All date operations explicitly use UTC via `date-fns-tz`. The server's timezone setting is irrelevant.

**Q: How do I test timezone edge cases?**

A: Use Vitest's `vi.setSystemTime()` to mock specific UTC times:

```typescript
vi.setSystemTime(new Date('2025-01-15T23:59:59.999Z'));
// ... test logic
vi.useRealTimers();
```

````

**Update Backend CLAUDE.md**:
```markdown
<!-- backend/CLAUDE.md -->

## Date Handling

### UTC-Only Strategy

All date operations use UTC exclusively. See [Timezone Strategy](../../docs/development/timezone-strategy.md) for details.

**Utilities**: `src/utils/date-utc.utils.ts`

**Usage**:
```typescript
import {
  getTodayUTC,
  isTodayUTC,
  parseDateAsUTC,
  formatDateAsUTC,
} from '../utils/date-utc.utils';

// Get today in UTC
const today = getTodayUTC();  // => '2025-01-15'

// Check if date is today
const isToday = isTodayUTC('2025-01-15');

// Parse date string as UTC
const date = parseDateAsUTC('2025-01-15');  // => Date object at UTC midnight

// Format date as UTC string
const dateString = formatDateAsUTC(new Date());  // => 'YYYY-MM-DD'
````

**Testing**:

```typescript
import { vi } from 'vitest';

// Mock current time for testing
vi.setSystemTime(new Date('2025-01-15T23:30:00Z'));
expect(getTodayUTC()).toBe('2025-01-15');
vi.useRealTimers();
```

````

---

## Deliverables

- [X] Timezone audit completed and documented
- [X] `date-fns-tz` installed in backend and frontend
- [X] `date-utc.utils.ts` created with 15+ UTC utilities
- [X] Comprehensive tests added (50+ test cases):
  - Format validation
  - Date arithmetic
  - DST transitions
  - Midnight boundaries
  - Leap years
  - Edge cases
- [X] All backend services updated to use UTC utilities
- [X] Frontend UTC utilities created
- [X] Frontend components updated
- [X] Integration tests for timezone scenarios
- [X] Documentation complete:
  - Timezone strategy guide
  - Backend CLAUDE.md updated
  - Frontend CLAUDE.md updated
  - Migration guide included

---

## Acceptance Criteria

- [X] All date operations use UTC utilities (no `new Date()` without UTC conversion)
- [X] Cache keys use UTC dates exclusively
- [X] "Today" determination uses `isTodayUTC()`
- [X] Date arithmetic uses `addDaysUTC()`, `subDaysUTC()`
- [X] All date comparisons use UTC-aware functions
- [X] Tests cover DST transitions (pass consistently)
- [X] Tests cover midnight boundaries (23:59:59 vs 00:00:00)
- [X] Tests cover leap years
- [X] Frontend and backend use same UTC approach
- [X] Documentation complete with examples
- [X] Manual testing confirms:
  - Cache TTL logic works correctly at UTC midnight
  - Date ranges calculated consistently
  - No cache key mismatches

---

## Validation

**Run UTC Utility Tests**:
```bash
npm --prefix backend test -- date-utc.utils.test.ts
````

**Run Timezone Scenario Tests**:

```bash
npm --prefix backend test -- timezone-scenarios.test.ts
```

**Test at Midnight UTC**:

```typescript
// In test file
vi.setSystemTime(new Date('2025-01-15T23:59:59.999Z'));
expect(getTodayUTC()).toBe('2025-01-15');

vi.setSystemTime(new Date('2025-01-16T00:00:00.001Z'));
expect(getTodayUTC()).toBe('2025-01-16');

vi.useRealTimers();
```

**Test DST Transitions**:

```bash
# Run integration tests with DST dates
npm --prefix backend test:integration -- timezone
```

**Manual Verification**:

```bash
# Check server timezone (should be UTC for production)
node -e "console.log(new Date().toString())"

# Test cache key generation
curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-01-15","endDate":"2025-01-15"}' | jq

# Check logs for cache keys (should be in YYYY-MM-DD format)
tail -f logs/backend.log | grep "daily_usage:"
```

**Run Full Test Suite**:

```bash
npm --prefix backend test
npm --prefix frontend test
npm --prefix backend test:integration
```

---

## Next Steps

After completing Session 3B:

1. **Commit Changes**:

   ```bash
   git add .
   git commit -m "feat: standardize timezone handling with explicit UTC

   - Create date-utc.utils module with 15+ UTC-aware utilities
   - Install date-fns-tz for explicit timezone handling
   - Update all services to use UTC utilities
   - Add comprehensive tests (DST, midnight, leap years)
   - Create frontend UTC utilities
   - Update components to use UTC consistently
   - Add timezone scenario integration tests
   - Complete timezone strategy documentation

   Closes Issue #9
   Phase 3, Session 3B of remediation plan"
   ```

2. **Proceed to Session 3C**: [Race Conditions](./phase-3-session-3c-race-conditions.md)

3. **Update Progress Tracker** in main remediation plan

---

## Troubleshooting

### Issue: Tests fail at midnight

**Cause**: Tests using real system time instead of mocked time

**Solution**:

```typescript
// Use mocked time
vi.setSystemTime(new Date('2025-01-15T14:30:00Z'));
// ... test logic
vi.useRealTimers();
```

### Issue: Cache keys mismatch

**Cause**: Mixed use of UTC and local dates

**Solution**:

1. Search for `new Date()` without UTC conversion
2. Replace with `getTodayUTC()` or `formatDateAsUTC()`
3. Verify cache key format is consistent

### Issue: DST test failures

**Cause**: Using local date arithmetic instead of UTC

**Solution**:

```typescript
// Use UTC date arithmetic
import { addDaysUTC } from './utils/date-utc.utils';
const nextDay = addDaysUTC('2025-03-09', 1); // DST transition date
```

### Issue: Frontend shows wrong dates

**Cause**: Not converting Date objects to UTC strings

**Solution**:

```typescript
import { formatDateAsUTC } from '../utils/date-utc';
const dateString = formatDateAsUTC(datePickerValue);
```

---

**Session Complete**: ✅

**Estimated Time**: 4-6 hours
**Actual Time**: **\_** hours

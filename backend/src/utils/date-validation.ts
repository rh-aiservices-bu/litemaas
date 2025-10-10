// backend/src/utils/date-validation.ts

import { differenceInDays, parseISO, isValid } from 'date-fns';

export interface DateRangeValidationResult {
  valid: boolean;
  days?: number;
  error?: string;
  code?: string;
}

/**
 * Validate date range size
 *
 * Ensures date ranges are:
 * - Valid ISO date format (YYYY-MM-DD)
 * - Start date before end date
 * - Within maximum allowed range
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param maxDays - Maximum allowed days in range
 * @returns Validation result with error details if invalid
 *
 * @example
 * // Valid range
 * validateDateRangeSize('2025-01-01', '2025-01-31', 90)
 * // => { valid: true, days: 31 }
 *
 * @example
 * // Range too large
 * validateDateRangeSize('2025-01-01', '2025-12-31', 90)
 * // => {
 * //   valid: false,
 * //   days: 365,
 * //   error: 'Date range too large. Maximum allowed is 90 days, requested 365 days.',
 * //   code: 'DATE_RANGE_TOO_LARGE'
 * // }
 */
export function validateDateRangeSize(
  startDate: string,
  endDate: string,
  maxDays: number,
): DateRangeValidationResult {
  try {
    // Parse dates
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Check if dates are valid
    if (!isValid(start) || !isValid(end)) {
      return {
        valid: false,
        error: 'Invalid date format. Expected YYYY-MM-DD.',
        code: 'INVALID_DATE_FORMAT',
      };
    }

    // Check if start is before or equal to end
    if (start > end) {
      return {
        valid: false,
        error: 'Start date must be before or equal to end date.',
        code: 'INVALID_DATE_ORDER',
      };
    }

    // Calculate range in days (inclusive)
    const days = differenceInDays(end, start) + 1;

    // Check if range exceeds maximum
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
  } catch (error) {
    return {
      valid: false,
      error: 'Error validating date range.',
      code: 'DATE_VALIDATION_ERROR',
    };
  }
}

/**
 * Validate date range with warning threshold
 *
 * Same as validateDateRangeSize but adds a warning flag when
 * range exceeds a threshold (without blocking the request).
 * Useful for logging/monitoring large ranges.
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @param maxDays - Maximum allowed days (hard limit)
 * @param warningDays - Days threshold for warning (soft limit)
 * @returns Validation result with warning flag
 *
 * @example
 * // Range within warning threshold
 * validateDateRangeWithWarning('2025-01-01', '2025-01-15', 90, 30)
 * // => { valid: true, days: 15, warning: false }
 *
 * @example
 * // Range exceeds warning threshold but within max
 * validateDateRangeWithWarning('2025-01-01', '2025-03-01', 90, 30)
 * // => { valid: true, days: 60, warning: true }
 */
export function validateDateRangeWithWarning(
  startDate: string,
  endDate: string,
  maxDays: number,
  warningDays: number,
): DateRangeValidationResult & { warning?: boolean } {
  const result = validateDateRangeSize(startDate, endDate, maxDays);

  if (result.valid && result.days && result.days > warningDays) {
    return {
      ...result,
      warning: true,
    };
  }

  return result;
}

/**
 * Check if date string is valid ISO format
 *
 * @param dateString - Date string to validate
 * @returns True if valid YYYY-MM-DD format
 */
export function isValidISODate(dateString: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateString)) {
    return false;
  }

  const date = parseISO(dateString);
  return isValid(date);
}

/**
 * Calculate suggested date ranges when request is too large
 *
 * @param startDate - Original start date
 * @param endDate - Original end date
 * @param maxDays - Maximum allowed days
 * @returns Array of suggested date ranges
 *
 * @example
 * // Break 365-day range into 90-day chunks
 * suggestDateRanges('2025-01-01', '2025-12-31', 90)
 * // => [
 * //   { startDate: '2025-01-01', endDate: '2025-03-31' },
 * //   { startDate: '2025-04-01', endDate: '2025-06-29' },
 * //   { startDate: '2025-06-30', endDate: '2025-09-27' },
 * //   { startDate: '2025-09-28', endDate: '2025-12-31' }
 * // ]
 */
export function suggestDateRanges(
  startDate: string,
  endDate: string,
  maxDays: number,
): Array<{ startDate: string; endDate: string }> {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const totalDays = differenceInDays(end, start) + 1;

  if (totalDays <= maxDays) {
    return [{ startDate, endDate }];
  }

  const chunks: Array<{ startDate: string; endDate: string }> = [];
  let currentStart = start;

  while (currentStart < end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + maxDays - 1);

    if (currentEnd > end) {
      chunks.push({
        startDate: currentStart.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      break;
    } else {
      chunks.push({
        startDate: currentStart.toISOString().split('T')[0],
        endDate: currentEnd.toISOString().split('T')[0],
      });
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }
  }

  return chunks;
}

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

/**
 * Get today's date as YYYY-MM-DD string in UTC
 *
 * @returns Today's date string in UTC
 */
export function getTodayUTC(): string {
  const now = new Date();
  return format(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    'yyyy-MM-dd',
  );
}

/**
 * Subtract days from a date string (UTC)
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @param days - Number of days to subtract
 * @returns New date string in YYYY-MM-DD format
 */
export function subDaysUTC(dateString: string, days: number): string {
  const date = parseISO(dateString);
  const newDate = subDays(date, days);
  return format(newDate, 'yyyy-MM-dd');
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

// ============================================================================
// Model/Provider Utilities
// ============================================================================

/**
 * Extract provider name from model name
 *
 * @param modelName - Full model name (e.g., 'openai/gpt-4', 'anthropic/claude-3')
 * @returns Provider name
 *
 * @example
 * extractProviderFromModel('openai/gpt-4') => 'openai'
 * extractProviderFromModel('gpt-4') => 'openai' (inferred)
 * extractProviderFromModel('unknown-model') => 'unknown'
 */
export function extractProviderFromModel(modelName: string): string {
  if (modelName.includes('/')) {
    return modelName.split('/')[0];
  }
  // Try to infer from model name patterns
  if (modelName.startsWith('gpt')) return 'openai';
  if (modelName.startsWith('claude')) return 'anthropic';
  if (modelName.startsWith('gemini')) return 'google';
  return 'unknown';
}

// ============================================================================
// Date Range Utilities
// ============================================================================

/**
 * Check if date is historical (more than 1 day old)
 *
 * @param date - Date to check
 * @returns true if historical
 */
export function isHistoricalDate(date: Date): boolean {
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff > 1;
}

/**
 * Validate date range
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param maxDays - Maximum allowed days in range (default: 365)
 * @throws Error if validation fails
 */
export function validateDateRange(startDate: string, endDate: string, maxDays = 365): void {
  // Simple string comparison works for YYYY-MM-DD format
  if (startDate > endDate) {
    throw new Error('Start date must be before end date');
  }

  // Calculate difference in days
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > maxDays) {
    throw new Error(`Date range cannot exceed ${maxDays} days`);
  }
}

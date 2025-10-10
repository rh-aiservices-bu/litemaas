# Phase 1, Session 1B: Date Range Validation

**Phase**: 1 - Critical Blocking Issues
**Session**: 1B
**Duration**: 2-3 hours
**Priority**: 🔴 CRITICAL
**Issue**: #5 - No Date Range Size Validation (Performance/DoS Risk)

---

## Navigation

- [← Previous: Session 1A](phase-1-session-1a-rate-limiting.md) | [Overview](../admin-analytics-remediation-plan.md) | [Next: Session 1C →](phase-1-session-1c-memory-leak.md)

---

## Refactoring Context

This is Session 1B of Phase 1 in a comprehensive remediation plan addressing 15 identified issues.

**Phase 1 Focus**: Critical blocking issues preventing production deployment

- 5 critical issues total
- 17-31 hours estimated
- Must complete before production

**Related Documentation**:

- [Complete Remediation Plan](../admin-analytics-remediation-plan.md)
- [Code Review Document](../../CODE_REVIEW_ADMIN_ANALYTICS%20copy.md)

---

## Phase Summary

| Phase       | Priority        | Duration | Focus                                                     |
| ----------- | --------------- | -------- | --------------------------------------------------------- |
| **Phase 1** | 🔴 **CRITICAL** | 17-31h   | Critical blocking issues preventing production deployment |
| Phase 2     | 🟡 HIGH         | 6-12h    | High-priority operational safeguards                      |
| Phase 3     | 🟡 MEDIUM       | 13-18h   | Architecture & reliability improvements                   |
| Phase 4     | 🟢 LOW-MEDIUM   | 8-12h    | Code quality & maintainability                            |
| Phase 5     | 🟢 MEDIUM       | 16-24h   | Performance & observability                               |
| Phase 6     | 🟢 LOW          | 40-60h   | Advanced features (optional)                              |

**Total Estimated Effort**: 92-138 hours (11-17 days)

---

## Session Objectives

Add validation to prevent excessively large date ranges that could cause performance issues or service degradation.

**Why This Matters**:

- Date range queries without size limits can cause:
  - Extremely expensive database queries (thousands of days)
  - Memory exhaustion processing large result sets
  - Slow response times affecting all users
  - Potential service outages
  - Excessive LiteLLM API calls and costs

**Real-World Scenarios**:

- Accidental request: `startDate: "2020-01-01", endDate: "2025-12-31"` (6 years = 2,191 days)
- Malicious request: `startDate: "1970-01-01", endDate: "2099-12-31"` (130 years)
- Frontend bug: Invalid date range selection

**Expected Outcomes**:

- 90-day maximum for analytics queries (reasonable for interactive use)
- 365-day maximum for exports (allows full-year reports)
- Client-side validation for better UX
- Server-side enforcement for security
- Clear error messages with helpful suggestions

---

## Pre-Session Checklist

- [ ] Read date range validation section of code review
- [ ] Review `date-fns` usage in project
- [ ] Identify all endpoints accepting date ranges
- [ ] Plan appropriate max ranges (analytics: 90 days, export: 365 days)

**Key Findings from Code Review**:

> "No maximum date range size validation. A malicious or buggy client could request years of data (e.g., 2020-2025), causing expensive database queries and potential service degradation. Recommendation: Add configurable max date range limits (e.g., 90 days for analytics, 365 days for exports)."

**Endpoints Accepting Date Ranges**:

1. `POST /api/v1/admin/usage/analytics`
2. `POST /api/v1/admin/usage/user-breakdown`
3. `POST /api/v1/admin/usage/model-breakdown`
4. `POST /api/v1/admin/usage/provider-breakdown`
5. `GET /api/v1/admin/usage/export`

**Recommended Limits**:

- **Analytics queries**: 90 days (3 months)
  - Covers quarterly analysis
  - Interactive use case
  - Reasonable query complexity
- **Exports**: 365 days (1 year)
  - Annual reports
  - Batch processing
  - Higher limit for bulk operations
- **Warning threshold**: 30 days
  - Log large ranges for monitoring
  - No blocking, just awareness

---

## Implementation Steps

### Step 1B.1: Create Date Validation Utilities

**Duration**: 45 minutes

**Files to Create**:

- `backend/src/utils/date-validation.ts`

**Implementation**:

```typescript
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
```

**Tests to Create**:

```typescript
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
```

---

### Step 1B.2: Add Configuration

**Duration**: 15 minutes

**Files to Modify**:

- `backend/src/config/admin-usage.config.ts`

**Add Configuration Constants**:

```typescript
// backend/src/config/admin-usage.config.ts

/**
 * Admin usage analytics configuration
 */
export const ADMIN_USAGE_LIMITS = {
  /**
   * Maximum date range for analytics queries (in days)
   * Default: 90 days (3 months)
   *
   * Rationale: Balances interactive use cases (quarterly analysis)
   * with query performance and resource usage.
   */
  MAX_DATE_RANGE_DAYS: Number(process.env.MAX_ANALYTICS_DATE_RANGE_DAYS) || 90,

  /**
   * Maximum date range for data exports (in days)
   * Default: 365 days (1 year)
   *
   * Rationale: Allows annual reports while preventing multi-year
   * exports that could cause memory issues.
   */
  MAX_DATE_RANGE_DAYS_EXPORT: Number(process.env.MAX_EXPORT_DATE_RANGE_DAYS) || 365,

  /**
   * Warning threshold for date ranges (in days)
   * Default: 30 days (1 month)
   *
   * Ranges exceeding this threshold will be logged for monitoring,
   * but not blocked.
   */
  WARNING_DATE_RANGE_DAYS: Number(process.env.WARNING_DATE_RANGE_DAYS) || 30,
};
```

**Update `.env.example`**:

```bash
# ============================================================================
# Date Range Validation
# ============================================================================

# Maximum date range for analytics queries (days)
# Queries requesting ranges larger than this will be rejected with 400 error
# Default: 90 days (approximately 3 months)
# Recommendation: 30-180 days based on use case
MAX_ANALYTICS_DATE_RANGE_DAYS=90

# Maximum date range for data exports (days)
# Exports requesting ranges larger than this will be rejected with 400 error
# Default: 365 days (1 year)
# Recommendation: 180-730 days based on use case
MAX_EXPORT_DATE_RANGE_DAYS=365

# Warning threshold for date ranges (days)
# Ranges exceeding this will be logged for monitoring (not blocked)
# Default: 30 days
# Recommendation: 25-50% of MAX_ANALYTICS_DATE_RANGE_DAYS
WARNING_DATE_RANGE_DAYS=30
```

---

### Step 1B.3: Apply Validation to Routes

**Duration**: 1 hour

**Files to Modify**:

- `backend/src/routes/admin-usage.ts`

**Pattern for Analytics Endpoints**:

```typescript
import { validateDateRangeWithWarning } from '../utils/date-validation';
import { ADMIN_USAGE_LIMITS } from '../config/admin-usage.config';
import type { AuthenticatedRequest } from '../types/auth.types';

// Analytics endpoints
fastify.post<{ Body: AdminUsageFilters }>('/analytics', {
  schema: {
    body: {
      type: 'object',
      required: ['startDate', 'endDate'],
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        // ... other filters
      },
    },
    response: {
      200: {
        // ... success schema
      },
      400: {
        description: 'Invalid request - date range validation failed',
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: {
            type: 'object',
            properties: {
              requestedDays: { type: 'number' },
              maxAllowedDays: { type: 'number' },
              suggestion: { type: 'string' },
              suggestedRanges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    const { startDate, endDate } = request.body;

    // Validate date range size
    const validation = validateDateRangeWithWarning(
      startDate,
      endDate,
      ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS,
      ADMIN_USAGE_LIMITS.WARNING_DATE_RANGE_DAYS,
    );

    if (!validation.valid) {
      // Generate suggested ranges
      const suggestedRanges = suggestDateRanges(
        startDate,
        endDate,
        ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS,
      );

      return reply.code(400).send({
        error: validation.error,
        code: validation.code,
        details: {
          requestedDays: validation.days,
          maxAllowedDays: ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS,
          suggestion: `Break your request into ${suggestedRanges.length} smaller date ranges`,
          suggestedRanges: suggestedRanges.slice(0, 4), // First 4 suggestions only
        },
      });
    }

    // Log warning for large ranges
    if (validation.warning) {
      fastify.log.warn(
        {
          userId: (request as AuthenticatedRequest).user?.userId,
          startDate,
          endDate,
          rangeInDays: validation.days,
          endpoint: '/analytics',
        },
        'Large date range requested for analytics',
      );
    }

    // Proceed with existing logic
    const analytics = await adminUsageStatsService.getAnalytics(request.body);
    return reply.send(serializeDates(analytics));
  },
});
```

**Pattern for Export Endpoint** (with higher limit):

```typescript
fastify.get<{ Querystring: AdminUsageFilters }>('/export', {
  schema: {
    querystring: {
      type: 'object',
      required: ['startDate', 'endDate', 'format'],
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        format: { type: 'string', enum: ['csv', 'json'] },
        // ... other filters
      },
    },
    response: {
      200: {
        description: 'Export data (CSV or JSON)',
        // ... schema
      },
      400: {
        // ... same as analytics endpoint
      },
    },
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    const { startDate, endDate, format } = request.query;

    // Use export-specific limit (365 days)
    const validation = validateDateRangeSize(
      startDate,
      endDate,
      ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS_EXPORT,
    );

    if (!validation.valid) {
      const suggestedRanges = suggestDateRanges(
        startDate,
        endDate,
        ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS_EXPORT,
      );

      return reply.code(400).send({
        error: validation.error,
        code: validation.code,
        details: {
          requestedDays: validation.days,
          maxAllowedDays: ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS_EXPORT,
          suggestion: `Maximum export range is ${ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS_EXPORT} days. Consider breaking into ${suggestedRanges.length} exports.`,
          suggestedRanges: suggestedRanges.slice(0, 4),
        },
      });
    }

    // Proceed with export
    const data = await adminUsageStatsService.getExportData(request.query);

    if (format === 'csv') {
      reply.type('text/csv');
      return exportService.toCSV(data);
    } else {
      reply.type('application/json');
      return exportService.toJSON(data);
    }
  },
});
```

**Endpoints to Update**:

- [ ] `POST /api/v1/admin/usage/analytics` - 90-day limit
- [ ] `POST /api/v1/admin/usage/user-breakdown` - 90-day limit
- [ ] `POST /api/v1/admin/usage/model-breakdown` - 90-day limit
- [ ] `POST /api/v1/admin/usage/provider-breakdown` - 90-day limit
- [ ] `GET /api/v1/admin/usage/export` - 365-day limit

---

### Step 1B.4: Frontend Validation

**Duration**: 30 minutes

**Files to Modify**:

- `frontend/src/pages/AdminUsagePage.tsx`

**Add Client-Side Validation**:

```typescript
import { differenceInDays } from 'date-fns';
import { useNotifications } from '../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';

const MAX_DATE_RANGE_DAYS = 90; // Match backend config
const WARNING_THRESHOLD_DAYS = 30;

const AdminUsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  /**
   * Validate and set date range
   * Shows warning/error before making API call
   */
  const handleDateRangeChange = (start: string, end: string) => {
    if (!start || !end) return;

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Check date order
    if (startDate > endDate) {
      addNotification({
        variant: 'danger',
        title: t('adminUsage.errors.invalidDateOrder.title', 'Invalid Date Range'),
        description: t(
          'adminUsage.errors.invalidDateOrder.description',
          'Start date must be before end date.',
        ),
      });
      return;
    }

    // Calculate range
    const days = differenceInDays(endDate, startDate) + 1;

    // Check if exceeds maximum
    if (days > MAX_DATE_RANGE_DAYS) {
      addNotification({
        variant: 'danger',
        title: t('adminUsage.errors.dateRangeTooLarge.title', 'Date Range Too Large'),
        description: t(
          'adminUsage.errors.dateRangeTooLarge.description',
          `Maximum date range is ${MAX_DATE_RANGE_DAYS} days. You selected ${days} days. Please select a smaller range.`,
        ),
      });
      return;
    }

    // Show warning for large ranges
    if (days > WARNING_THRESHOLD_DAYS) {
      addNotification({
        variant: 'warning',
        title: t('adminUsage.warnings.largeRange.title', 'Large Date Range'),
        description: t(
          'adminUsage.warnings.largeRange.description',
          `You've selected ${days} days of data. This may take longer to load.`,
        ),
      });
    }

    // Valid - update state
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  // ... rest of component
};
```

**Add Error Handling in API Service**:

```typescript
// frontend/src/services/admin-usage.service.ts

export class AdminUsageService {
  async getAnalytics(filters: AdminUsageFilters): Promise<Analytics> {
    try {
      const response = await axios.post('/api/v1/admin/usage/analytics', filters);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const { status, data } = error.response;

        if (status === 400 && data.code === 'DATE_RANGE_TOO_LARGE') {
          // Special handling for date range errors
          throw new DateRangeError(
            data.error,
            data.details.requestedDays,
            data.details.maxAllowedDays,
            data.details.suggestedRanges,
          );
        }
      }

      throw error;
    }
  }
}

// Custom error type
export class DateRangeError extends Error {
  constructor(
    message: string,
    public requestedDays: number,
    public maxAllowedDays: number,
    public suggestedRanges: Array<{ startDate: string; endDate: string }>,
  ) {
    super(message);
    this.name = 'DateRangeError';
  }
}
```

---

### Step 1B.5: Add Tests

**Duration**: 30 minutes

**Integration Tests**:

```typescript
// backend/tests/integration/date-range-validation.test.ts

describe('Date Range Validation', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    adminToken = await getAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Analytics endpoints (90-day limit)', () => {
    it('should accept valid date range within limit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-03-31', // 90 days
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject date range exceeding limit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2020-01-01',
          endDate: '2025-12-31', // ~6 years
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.code).toBe('DATE_RANGE_TOO_LARGE');
      expect(body.details.maxAllowedDays).toBe(90);
      expect(body.details.requestedDays).toBeGreaterThan(365);
      expect(body.details.suggestedRanges).toBeDefined();
      expect(body.details.suggestedRanges.length).toBeGreaterThan(0);
    });

    it('should reject invalid date order', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-12-31',
          endDate: '2025-01-01',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('INVALID_DATE_ORDER');
    });

    it('should reject invalid date format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025/01/01', // Wrong format
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('INVALID_DATE_FORMAT');
    });

    it('should accept single-day range', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-01',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Export endpoint (365-day limit)', () => {
    it('should allow larger range for export', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/usage/export',
        headers: { authorization: `Bearer ${adminToken}` },
        query: {
          startDate: '2024-01-01',
          endDate: '2024-12-31', // 365 days
          format: 'csv',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject export range exceeding 365 days', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/usage/export',
        headers: { authorization: `Bearer ${adminToken}` },
        query: {
          startDate: '2020-01-01',
          endDate: '2025-12-31', // ~6 years
          format: 'csv',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details.maxAllowedDays).toBe(365);
    });
  });

  describe('Suggested ranges', () => {
    it('should provide helpful suggestions when range too large', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-12-31', // 365 days, needs to be split into ~4 ranges
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.details.suggestedRanges).toBeDefined();
      expect(body.details.suggestedRanges.length).toBeGreaterThan(0);

      // Verify each suggestion is within limit
      body.details.suggestedRanges.forEach((range: any) => {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        expect(days).toBeLessThanOrEqual(90);
      });
    });
  });
});
```

---

## Session 1B Deliverables

- [ ] Date validation utility module created (`date-validation.ts`)
- [ ] Configuration added for max ranges (`admin-usage.config.ts`)
- [ ] All 5 endpoints validated (4 analytics + 1 export)
- [ ] Frontend client-side validation added
- [ ] Unit tests added and passing (15+ test cases)
- [ ] Integration tests added and passing
- [ ] Documentation updated

---

## Session 1B Acceptance Criteria

### Functional Requirements

- [ ] 90-day limit for analytics queries enforced
- [ ] 365-day limit for exports enforced
- [ ] Configurable via environment variables
- [ ] 400 error response includes:
  - Error message and code
  - Requested vs. allowed days
  - Suggested date range breakdown
- [ ] Warning logged for ranges > 30 days (not blocking)
- [ ] Frontend shows validation error before API call
- [ ] Client-side and server-side validation consistent

### Technical Requirements

- [ ] Integration tests verify validation
- [ ] Unit tests for utility functions
- [ ] All existing tests still pass
- [ ] No TypeScript errors
- [ ] Linter passes

### Documentation

- [ ] Environment variables documented
- [ ] Error response format documented
- [ ] Tuning guidelines provided

---

## Session 1B Validation

### Automated Tests

```bash
# Run date validation unit tests
npm --prefix backend test date-validation.test.ts

# Run integration tests
npm --prefix backend test date-range-validation.test.ts

# Run all tests
npm --prefix backend test
```

**Expected Results**:

- ✅ All unit tests pass (15+ tests)
- ✅ All integration tests pass
- ✅ No test failures
- ✅ No type errors

---

### Manual Testing

**Test 1: Valid Range**

```bash
curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }' \
  -w "\nStatus: %{http_code}\n"
```

**Expected**: `Status: 200`

---

**Test 2: Range Too Large**

```bash
curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2020-01-01",
    "endDate": "2025-12-31"
  }' | jq
```

**Expected**:

```json
{
  "error": "Date range too large. Maximum allowed is 90 days, requested 2191 days.",
  "code": "DATE_RANGE_TOO_LARGE",
  "details": {
    "requestedDays": 2191,
    "maxAllowedDays": 90,
    "suggestion": "Break your request into 25 smaller date ranges",
    "suggestedRanges": [
      { "startDate": "2020-01-01", "endDate": "2020-03-31" },
      { "startDate": "2020-04-01", "endDate": "2020-06-29" },
      ...
    ]
  }
}
```

---

**Test 3: Export Higher Limit**

```bash
# Should succeed (365 days)
curl -X GET "http://localhost:8081/api/v1/admin/usage/export?startDate=2024-01-01&endDate=2024-12-31&format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"
```

**Expected**: `Status: 200`

---

**Test 4: Invalid Date Order**

```bash
curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-12-31",
    "endDate": "2025-01-01"
  }' | jq
```

**Expected**:

```json
{
  "error": "Start date must be before or equal to end date.",
  "code": "INVALID_DATE_ORDER"
}
```

---

## Next Steps

**Next Session**: [Session 1C: Fix ResizeObserver Memory Leak](phase-1-session-1c-memory-leak.md)

**Before Next Session**:

- ✅ Verify all tests pass
- ✅ Test frontend validation
- ✅ Commit changes
- ✅ Deploy to staging (if available)

**Session 1C Preview**:

- Fix ResizeObserver memory leak in chart components
- Add cleanup effects to 4 chart components
- Add automated tests for memory cleanup
- Duration: 1-2 hours

---

## Session Summary Template

**After Completing This Session**:

```markdown
### Session 1B: Date Range Validation - Completed

**Date**: [YYYY-MM-DD]
**Actual Duration**: [X hours]
**Status**: ✅ Complete

**Deliverables**:

- ✅ Date validation utilities created
- ✅ All 5 endpoints protected
- ✅ Frontend validation added
- ✅ Tests added and passing (20+ test cases)

**Metrics**:

- Lines of code added: ~400
- Test coverage: 100% of validation logic
- Max allowed range: 90 days (analytics), 365 days (export)

**Issues Encountered**: [None / List any]

**Next Session**: 1C - Fix ResizeObserver Memory Leak
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Next Review**: After Session 1B completion

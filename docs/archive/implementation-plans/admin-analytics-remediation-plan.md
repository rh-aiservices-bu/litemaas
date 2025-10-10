# Admin Analytics Remediation Plan

**Document Version**: 1.0
**Created**: 2025-10-10
**Status**: Active
**Related**: [Code Review Document](../../CODE_REVIEW_ADMIN_ANALYTICS%20copy.md)

---

## Table of Contents

- [Overview](#overview)
- [Phase 1: Critical Blocking Issues](#phase-1-critical-blocking-issues)
- [Phase 2: High-Priority Operational Safeguards](#phase-2-high-priority-operational-safeguards)
- [Phase 3: Architecture & Reliability](#phase-3-architecture--reliability)
- [Phase 4: Code Quality & Maintainability](#phase-4-code-quality--maintainability)
- [Phase 5: Performance & Observability](#phase-5-performance--observability)
- [Phase 6: Advanced Features](#phase-6-advanced-features-optional)
- [Multi-Session Execution Strategy](#multi-session-execution-strategy)
- [Progress Tracking](#progress-tracking)
- [Timeline & Effort Summary](#timeline--effort-summary)

---

## Overview

### Purpose

This document provides a detailed, phased implementation plan for addressing the issues identified in the comprehensive code review of the Admin Usage Analytics feature. The plan is designed for multi-session execution, with clear priorities, checkpoints, and validation criteria.

### Scope

**Total Issues**: 15 identified issues
**Priority Breakdown**:

- 🔴 Critical (5 issues): 17-31 hours
- 🟡 High (5 issues): 23-32 hours
- 🟢 Medium/Low (5 issues): 52-75 hours

**Total Estimated Effort**: 92-138 hours (11-17 days)

### Approach

The remediation is organized into 6 phases, executed sequentially with validation checkpoints between phases. Each phase can be broken into multiple work sessions, allowing flexible scheduling while maintaining quality and avoiding rework.

**Key Principles**:

1. **Quality First**: Full test coverage maintained at all times
2. **Incremental Progress**: Each session produces a working, tested increment
3. **Clear Checkpoints**: Validation between phases ensures stability
4. **Documentation**: Update docs as we go, not at the end
5. **Rollback Ready**: Each commit is atomic and revertible

---

## Phase 1: Critical Blocking Issues

**Priority**: 🔴 **CRITICAL**
**Duration**: 17-31 hours (2-4 days)
**Blocks**: Production deployment

### Overview

This phase addresses the 5 critical issues that block production deployment. These issues represent security vulnerabilities, data corruption risks, or severe architectural violations.

**Critical Issues**:

1. **Issue #2**: Missing Rate Limiting (DoS risk)
2. **Issue #5**: No Date Range Validation (Performance/DoS risk)
3. **Issue #4**: ResizeObserver Memory Leak (Client memory leak)
4. **Issue #3**: Complex SQL Migration with No Rollback (Data corruption risk)
5. **Issue #1**: 2,833-line Service File (Maintainability/SRP violation)

---

### Session 1A: Rate Limiting Implementation

**Issue**: #2 - Missing Rate Limiting
**Duration**: 4-6 hours
**Session Type**: Medium

#### Objectives

Add rate limiting to all admin analytics endpoints to prevent DoS attacks and abuse of expensive operations.

#### Pre-Session Checklist

- [x] Read rate limiting section of code review
- [x] Review `@fastify/rate-limit` documentation
- [x] Identify all endpoints requiring rate limiting
- [x] Plan rate limit values per endpoint type

#### Implementation Steps

##### Step 1A.1: Install Dependencies (10 minutes)

**Files**:

- `backend/package.json`

**Actions**:

```bash
npm --prefix backend install @fastify/rate-limit
```

**Verify**:

```bash
grep "rate-limit" backend/package.json
```

---

##### Step 1A.2: Create Rate Limit Configuration (30 minutes)

**Files to Create**:

- `backend/src/config/rate-limit.config.ts`

**Implementation**:

```typescript
// backend/src/config/rate-limit.config.ts

/**
 * Rate limit configuration for admin analytics endpoints
 *
 * Different limits are applied based on operation cost:
 * - Analytics queries: Moderate cost (database + LiteLLM API)
 * - Cache rebuild: Very high cost (full data refresh)
 * - Exports: Moderate-high cost (large data generation)
 */

export interface RateLimitConfig {
  max: number;
  timeWindow: string;
  cache?: number;
  skipOnError?: boolean;
  keyGenerator?: (request: any) => string;
}

export const RATE_LIMITS = {
  /**
   * Analytics endpoints (queries, breakdowns)
   * 10 requests per minute per user
   */
  analytics: {
    max: Number(process.env.ADMIN_ANALYTICS_RATE_LIMIT) || 10,
    timeWindow: '1 minute',
    cache: 10000, // Cache up to 10k different users
    keyGenerator: (request: any) => request.user?.userId || request.ip,
  } as RateLimitConfig,

  /**
   * Cache rebuild endpoint
   * 1 request per 5 minutes per user (very restrictive)
   */
  cacheRebuild: {
    max: Number(process.env.ADMIN_CACHE_REBUILD_LIMIT) || 1,
    timeWindow: '5 minutes',
    skipOnError: false,
    keyGenerator: (request: any) => request.user?.userId || request.ip,
  } as RateLimitConfig,

  /**
   * Export endpoints (CSV/JSON generation)
   * 5 requests per minute per user
   */
  export: {
    max: Number(process.env.ADMIN_EXPORT_RATE_LIMIT) || 5,
    timeWindow: '1 minute',
    cache: 10000,
    keyGenerator: (request: any) => request.user?.userId || request.ip,
  } as RateLimitConfig,
};

/**
 * Get rate limit configuration for environment
 */
export function getRateLimitConfig(type: keyof typeof RATE_LIMITS): RateLimitConfig {
  return RATE_LIMITS[type];
}
```

---

##### Step 1A.3: Register Rate Limit Plugin (20 minutes)

**Files to Modify**:

- `backend/src/app.ts` or `backend/src/plugins/rate-limit.ts`

**Implementation**:

```typescript
// backend/src/app.ts or plugins file

import rateLimit from '@fastify/rate-limit';

// Register rate limit plugin globally
await fastify.register(rateLimit, {
  global: false, // Don't apply to all routes by default
  max: 100, // Default fallback (won't be used with route-specific limits)
  timeWindow: '1 minute',
});
```

---

##### Step 1A.4: Apply Rate Limits to Endpoints (1-2 hours)

**Files to Modify**:

- `backend/src/routes/admin-usage.ts`

**Pattern**:

```typescript
import { getRateLimitConfig } from '../config/rate-limit.config';

// Analytics endpoints
fastify.post('/analytics', {
  config: {
    rateLimit: getRateLimitConfig('analytics'),
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    // ... existing handler
  },
});

// Cache rebuild endpoint (very restrictive)
fastify.post('/rebuild-cache', {
  config: {
    rateLimit: getRateLimitConfig('cacheRebuild'),
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    // ... existing handler
  },
});

// Export endpoint
fastify.get('/export', {
  config: {
    rateLimit: getRateLimitConfig('export'),
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    // ... existing handler
  },
});
```

**Endpoints to Update**:

- [x] `POST /api/v1/admin/usage/analytics`
- [x] `POST /api/v1/admin/usage/user-breakdown`
- [x] `POST /api/v1/admin/usage/model-breakdown`
- [x] `POST /api/v1/admin/usage/provider-breakdown`
- [x] `POST /api/v1/admin/usage/refresh-today`
- [x] `POST /api/v1/admin/usage/rebuild-cache`
- [x] `GET /api/v1/admin/usage/export`

---

##### Step 1A.5: Update Environment Variables (15 minutes)

**Files to Modify**:

- `backend/.env.example`
- `docs/deployment/configuration.md`

**Add**:

```bash
# Rate Limiting
ADMIN_ANALYTICS_RATE_LIMIT=10        # Requests per minute for analytics queries
ADMIN_CACHE_REBUILD_LIMIT=1          # Requests per 5 minutes for cache rebuild
ADMIN_EXPORT_RATE_LIMIT=5            # Requests per minute for exports
```

---

##### Step 1A.6: Add Integration Tests (1.5-2 hours)

**Files to Create**:

- `backend/tests/integration/rate-limit.test.ts`

**Test Cases**:

```typescript
describe('Rate Limiting', () => {
  describe('Analytics endpoints', () => {
    it('should allow requests within rate limit', async () => {
      // Make 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/admin/usage/analytics',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: validFilters,
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Make 11 requests (over limit)
      const requests = Array(11)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: validFilters,
          }),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.statusCode === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should include retry-after header in 429 response', async () => {
      // Exceed rate limit
      const requests = Array(15)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: validFilters,
          }),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.find((r) => r.statusCode === 429);

      expect(rateLimited).toBeDefined();
      expect(rateLimited?.headers['retry-after']).toBeDefined();
    });

    it('should reset rate limit after time window', async () => {
      // Exceed limit
      const requests = Array(11)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: validFilters,
          }),
        );
      await Promise.all(requests);

      // Wait for time window to pass
      await new Promise((resolve) => setTimeout(resolve, 61000)); // 61 seconds

      // Should succeed now
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validFilters,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Cache rebuild endpoint', () => {
    it('should have very restrictive rate limit (1 per 5 min)', async () => {
      // First request succeeds
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/rebuild-cache',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response1.statusCode).toBe(200);

      // Second immediate request should be rate limited
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/rebuild-cache',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response2.statusCode).toBe(429);
    });
  });

  describe('Different users', () => {
    it('should track rate limits per user, not globally', async () => {
      const admin1Token = await getAdminToken('admin1');
      const admin2Token = await getAdminToken('admin2');

      // Admin1 makes 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/admin/usage/analytics',
          headers: { authorization: `Bearer ${admin1Token}` },
          payload: validFilters,
        });
      }

      // Admin2 should still be able to make requests
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${admin2Token}` },
        payload: validFilters,
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
```

---

##### Step 1A.7: Update API Documentation (30 minutes)

**Files to Modify**:

- `docs/api/rest-api.md`
- OpenAPI/Swagger schemas in route files

**Add to Documentation**:

````markdown
### Rate Limiting

All admin analytics endpoints are rate-limited to prevent abuse and ensure fair resource allocation.

**Rate Limits**:

| Endpoint Type                                                                                  | Limit       | Time Window |
| ---------------------------------------------------------------------------------------------- | ----------- | ----------- |
| Analytics queries (`/analytics`, `/user-breakdown`, `/model-breakdown`, `/provider-breakdown`) | 10 requests | 1 minute    |
| Cache rebuild (`/rebuild-cache`)                                                               | 1 request   | 5 minutes   |
| Data export (`/export`)                                                                        | 5 requests  | 1 minute    |

**Rate Limit Response**:

When rate limit is exceeded, the API returns:

- **Status**: 429 Too Many Requests
- **Header**: `Retry-After` indicating seconds until next request allowed
- **Body**: Error message with rate limit details

**Example**:

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 45 seconds"
}
```
````

**Configuration**:

Rate limits can be configured via environment variables:

- `ADMIN_ANALYTICS_RATE_LIMIT` (default: 10)
- `ADMIN_CACHE_REBUILD_LIMIT` (default: 1)
- `ADMIN_EXPORT_RATE_LIMIT` (default: 5)

````

---

#### Session 1A Deliverables

- [X] `@fastify/rate-limit` installed
- [X] Rate limit configuration module created
- [X] All 7 admin analytics endpoints protected
- [X] Environment variables documented
- [X] Integration tests added and passing
- [X] API documentation updated

#### Session 1A Acceptance Criteria

- [X] All admin analytics endpoints have rate limiting
- [X] Different limits for different endpoint types
- [X] Rate limit configuration via environment variables
- [X] 429 responses include retry-after header
- [X] Integration tests verify rate limiting works
- [X] All existing tests still pass
- [X] Documentation complete

#### Session 1A Validation

**Commands**:
```bash
# Run tests
npm --prefix backend test rate-limit.test.ts

# Manual test (should see 429 after limit)
for i in {1..15}; do
  curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}' \
    -w "\nStatus: %{http_code}\n"
done
````

**Expected Result**:

- First 10 requests: 200 OK
- Requests 11-15: 429 Too Many Requests with Retry-After header

---

### Session 1B: Date Range Validation

**Issue**: #5 - No Date Range Size Validation
**Duration**: 2-3 hours
**Session Type**: Short

#### Objectives

Add validation to prevent excessively large date ranges that could cause performance issues or service degradation.

#### Pre-Session Checklist

- [ ] Read date range validation section of code review
- [ ] Review `date-fns` usage in project
- [ ] Identify all endpoints accepting date ranges
- [ ] Plan appropriate max ranges (analytics: 90 days, export: 365 days)

#### Implementation Steps

##### Step 1B.1: Create Date Validation Utilities (45 minutes)

**Files to Create**:

- `backend/src/utils/date-validation.ts`

**Implementation**:

```typescript
// backend/src/utils/date-validation.ts

import { differenceInDays, parseISO } from 'date-fns';

export interface DateRangeValidationResult {
  valid: boolean;
  days?: number;
  error?: string;
  code?: string;
}

/**
 * Validate date range size
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param maxDays - Maximum allowed days in range
 * @returns Validation result with error details if invalid
 */
export function validateDateRangeSize(
  startDate: string,
  endDate: string,
  maxDays: number,
): DateRangeValidationResult {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        valid: false,
        error: 'Invalid date format. Expected YYYY-MM-DD.',
        code: 'INVALID_DATE_FORMAT',
      };
    }

    // Check if start is before end
    if (start > end) {
      return {
        valid: false,
        error: 'Start date must be before or equal to end date.',
        code: 'INVALID_DATE_ORDER',
      };
    }

    // Calculate range in days
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
 * @param startDate - Start date
 * @param endDate - End date
 * @param maxDays - Maximum allowed days
 * @param warningDays - Days threshold for warning
 * @returns Validation result with warning flag
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
```

**Tests**:

```typescript
// backend/tests/unit/utils/date-validation.test.ts

describe('validateDateRangeSize', () => {
  it('should accept valid date range within limit', () => {
    const result = validateDateRangeSize('2025-01-01', '2025-01-31', 90);
    expect(result.valid).toBe(true);
    expect(result.days).toBe(31);
  });

  it('should reject date range exceeding limit', () => {
    const result = validateDateRangeSize('2025-01-01', '2025-12-31', 90);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('DATE_RANGE_TOO_LARGE');
    expect(result.days).toBe(365);
  });

  it('should reject invalid date order', () => {
    const result = validateDateRangeSize('2025-12-31', '2025-01-01', 90);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_DATE_ORDER');
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
});
```

---

##### Step 1B.2: Add Configuration (15 minutes)

**Files to Modify**:

- `backend/src/config/admin-usage.config.ts`

**Add**:

```typescript
export const ADMIN_USAGE_LIMITS = {
  MAX_DATE_RANGE_DAYS: Number(process.env.MAX_ANALYTICS_DATE_RANGE_DAYS) || 90,
  MAX_DATE_RANGE_DAYS_EXPORT: Number(process.env.MAX_EXPORT_DATE_RANGE_DAYS) || 365,
  WARNING_DATE_RANGE_DAYS: Number(process.env.WARNING_DATE_RANGE_DAYS) || 30,
};
```

**Environment Variables** (`.env.example`):

```bash
# Date Range Limits
MAX_ANALYTICS_DATE_RANGE_DAYS=90     # Maximum days for analytics queries
MAX_EXPORT_DATE_RANGE_DAYS=365       # Maximum days for data exports
WARNING_DATE_RANGE_DAYS=30           # Log warning for ranges exceeding this
```

---

##### Step 1B.3: Apply Validation to Routes (1 hour)

**Files to Modify**:

- `backend/src/routes/admin-usage.ts`

**Pattern**:

```typescript
import { validateDateRangeWithWarning } from '../utils/date-validation';
import { ADMIN_USAGE_LIMITS } from '../config/admin-usage.config';

// Analytics endpoints
fastify.post<{ Body: AdminUsageFilters }>('/analytics', {
  schema: {
    /* ... */
  },
  preHandler: [
    /* ... */
  ],
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
      return reply.code(400).send({
        error: validation.error,
        code: validation.code,
        details: {
          requestedDays: validation.days,
          maxAllowedDays: ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS,
          suggestion: 'Break your request into smaller date ranges',
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
        },
        'Large date range requested for analytics',
      );
    }

    // Proceed with existing logic
    const analytics = await adminUsageStatsService.getAnalytics(request.body);
    return reply.send(serializeDates(analytics));
  },
});

// Export endpoint (with higher limit)
fastify.get<{ Querystring: AdminUsageFilters }>('/export', {
  schema: {
    /* ... */
  },
  preHandler: [
    /* ... */
  ],
  handler: async (request, reply) => {
    const { startDate, endDate } = request.query;

    // Use export-specific limit (365 days)
    const validation = validateDateRangeSize(
      startDate,
      endDate,
      ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS_EXPORT,
    );

    if (!validation.valid) {
      return reply.code(400).send({
        error: validation.error,
        code: validation.code,
        details: {
          requestedDays: validation.days,
          maxAllowedDays: ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS_EXPORT,
        },
      });
    }

    // Proceed with export
    // ...
  },
});
```

**Endpoints to Update**:

- [ ] `POST /api/v1/admin/usage/analytics`
- [ ] `POST /api/v1/admin/usage/user-breakdown`
- [ ] `POST /api/v1/admin/usage/model-breakdown`
- [ ] `POST /api/v1/admin/usage/provider-breakdown`
- [ ] `GET /api/v1/admin/usage/export`

---

##### Step 1B.4: Frontend Validation (30 minutes)

**Files to Modify**:

- `frontend/src/pages/AdminUsagePage.tsx`

**Add Client-Side Validation**:

```typescript
const MAX_DATE_RANGE_DAYS = 90; // Match backend config

const handleDateRangeChange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (days > MAX_DATE_RANGE_DAYS) {
    addNotification({
      variant: 'warning',
      title: t('adminUsage.warnings.dateRangeTooLarge.title', 'Date range too large'),
      description: t(
        'adminUsage.warnings.dateRangeTooLarge.description',
        `Maximum date range is ${MAX_DATE_RANGE_DAYS} days. Please select a smaller range.`,
      ),
    });
    return;
  }

  setCustomStartDate(start);
  setCustomEndDate(end);
};
```

---

##### Step 1B.5: Add Tests (30 minutes)

**Integration Tests**:

```typescript
describe('Date range validation', () => {
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
    expect(response.json().code).toBe('DATE_RANGE_TOO_LARGE');
    expect(response.json().details.maxAllowedDays).toBe(90);
  });

  it('should allow larger range for export endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/usage/export',
      headers: { authorization: `Bearer ${adminToken}` },
      query: {
        startDate: '2024-01-01',
        endDate: '2024-12-31', // 365 days
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
```

---

#### Session 1B Deliverables

- [ ] Date validation utility module created
- [ ] Configuration added for max ranges
- [ ] All endpoints validated
- [ ] Frontend client-side validation
- [ ] Tests added and passing
- [ ] Documentation updated

#### Session 1B Acceptance Criteria

- [ ] 90-day limit for analytics queries
- [ ] 365-day limit for exports
- [ ] Configurable via environment variables
- [ ] 400 error response includes helpful details
- [ ] Warning logged for ranges > 30 days
- [ ] Frontend shows validation error before API call
- [ ] Integration tests verify validation
- [ ] All existing tests still pass

---

### Session 1C: Fix ResizeObserver Memory Leak

**Issue**: #4 - ResizeObserver Memory Leak
**Duration**: 1-2 hours
**Session Type**: Short

#### Objectives

Add cleanup effect to all chart components using ResizeObserver to prevent memory leaks on component unmount.

#### Pre-Session Checklist

- [ ] Read memory leak section of code review
- [ ] Identify all components using ResizeObserver
- [ ] Review React cleanup patterns
- [ ] Plan memory leak test approach

#### Implementation Steps

##### Step 1C.1: Identify Components (15 minutes)

**Search for ResizeObserver Usage**:

```bash
grep -r "ResizeObserver" frontend/src/components/charts/
```

**Components to Update**:

- [ ] `frontend/src/components/charts/UsageTrends.tsx`
- [ ] `frontend/src/components/charts/ModelUsageTrends.tsx`
- [ ] `frontend/src/components/charts/ModelDistributionChart.tsx`
- [ ] `frontend/src/components/charts/UsageHeatmap.tsx`

---

##### Step 1C.2: Apply Cleanup Pattern (30 minutes)

**Pattern to Apply**:

```typescript
// In each chart component

const [containerWidth, setContainerWidth] = React.useState(600);
const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

// Existing ref callback (keep this)
const containerRef = React.useCallback((element: HTMLDivElement | null) => {
  // Disconnect previous observer
  if (resizeObserverRef.current) {
    resizeObserverRef.current.disconnect();
    resizeObserverRef.current = null;
  }

  if (element) {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    resizeObserverRef.current = observer;
  }
}, []);

// ADD THIS: Cleanup effect as safety net
React.useEffect(() => {
  // Return cleanup function that runs on unmount
  return () => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
  };
}, []); // Empty deps = only run cleanup on unmount

// Add explanatory comment
/**
 * Cleanup ResizeObserver on unmount.
 *
 * While the ref callback should handle cleanup when element is removed,
 * this useEffect ensures cleanup happens in all scenarios:
 * - Component unmounted due to navigation
 * - Component removed by error boundary
 * - Component removed by conditional rendering
 *
 * This defensive approach prevents memory leaks.
 */
```

**Files to Modify** (apply pattern to each):

1. `frontend/src/components/charts/UsageTrends.tsx`
2. `frontend/src/components/charts/ModelUsageTrends.tsx`
3. `frontend/src/components/charts/ModelDistributionChart.tsx`
4. `frontend/src/components/charts/UsageHeatmap.tsx`

---

##### Step 1C.3: Add Automated Tests (30 minutes)

**Test Pattern**:

```typescript
// frontend/src/test/components/charts/UsageTrends.test.tsx

import { render } from '@testing-library/react';
import { vi } from 'vitest';
import UsageTrends from '../../../components/charts/UsageTrends';

describe('UsageTrends - Memory Management', () => {
  it('should clean up ResizeObserver on unmount', () => {
    const disconnectSpy = vi.fn();

    // Mock ResizeObserver
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: disconnectSpy,
      unobserve: vi.fn(),
    }));

    const { unmount } = render(<UsageTrends data={mockData} />);

    // Verify observer was created
    expect(global.ResizeObserver).toHaveBeenCalled();

    // Unmount component
    unmount();

    // Verify disconnect was called
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('should handle multiple mount/unmount cycles without leaking', () => {
    const disconnectSpy = vi.fn();

    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: disconnectSpy,
      unobserve: vi.fn(),
    }));

    // Mount and unmount 5 times
    for (let i = 0; i < 5; i++) {
      const { unmount } = render(<UsageTrends data={mockData} />);
      unmount();
    }

    // Should have disconnected 5 times
    expect(disconnectSpy).toHaveBeenCalledTimes(5);
  });
});
```

**Apply to All Components**:

- [ ] UsageTrends.test.tsx
- [ ] ModelUsageTrends.test.tsx
- [ ] ModelDistributionChart.test.tsx
- [ ] UsageHeatmap.test.tsx

---

##### Step 1C.4: Manual Memory Leak Test (30 minutes)

**Testing Instructions** (document in test plan):

```markdown
### Manual Memory Leak Test

**Objective**: Verify ResizeObserver cleanup prevents memory leaks

**Tools**: Chrome DevTools Memory Profiler

**Steps**:

1. Open application in Chrome
2. Open DevTools → Memory tab
3. Take heap snapshot (Baseline)
4. Navigate to Admin Usage page
5. Take heap snapshot (After Mount)
6. Navigate away and back to Admin Usage 20 times
7. Take heap snapshot (After 20 Cycles)
8. Compare snapshots

**Expected Result**:

- ResizeObserver count should be stable (1-2 instances)
- HTMLDivElement count should not grow indefinitely
- Memory usage should return to near baseline after GC

**Failure Indicators**:

- Growing ResizeObserver count (2, 3, 4... with each cycle)
- Growing HTMLDivElement references from unmounted components
- Memory usage continues to climb
```

---

#### Session 1C Deliverables

- [ ] Cleanup effect added to all 4 chart components
- [ ] Automated tests added for each component
- [ ] Manual memory leak test documented
- [ ] Code comments explain pattern

#### Session 1C Acceptance Criteria

- [ ] All chart components have useEffect cleanup
- [ ] Automated tests verify disconnect() called on unmount
- [ ] Manual memory profiling shows no leak
- [ ] Navigation stress test (20+ cycles) shows stable memory
- [ ] Code comments explain why both patterns needed
- [ ] All existing tests still pass

---

### Session 1D: Create Migration Rollback

**Issue**: #3 - Complex SQL Migration with No Rollback
**Duration**: 2-4 hours
**Session Type**: Medium

#### Objectives

Create safe migration procedures with backup, rollback, and validation capabilities for the complex daily usage cache token breakdowns migration.

#### Pre-Session Checklist

- [ ] Read migration safety section of code review
- [ ] Review existing migration file
- [ ] Prepare test database with production-like data
- [ ] Get DBA availability for review

#### Implementation Steps

##### Step 1D.1: Create Backup Procedure (30 minutes)

**Files to Create**:

- `backend/src/migrations/backup-daily-usage-cache.sql`

**Implementation**:

```sql
-- backup-daily-usage-cache.sql
-- Creates a timestamped backup of daily_usage_cache table
-- Run this BEFORE executing fix-daily-usage-cache-token-breakdowns.sql

-- Create backup table with timestamp
DO $$
DECLARE
  backup_table_name TEXT;
BEGIN
  backup_table_name := 'daily_usage_cache_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MISS');

  EXECUTE format('CREATE TABLE %I AS SELECT * FROM daily_usage_cache', backup_table_name);

  RAISE NOTICE 'Backup created: %', backup_table_name;
  RAISE NOTICE 'Row count: %', (SELECT COUNT(*) FROM daily_usage_cache);
END $$;

-- Verify backup
SELECT COUNT(*) AS backup_row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'daily_usage_cache_backup_%';
```

---

##### Step 1D.2: Enhance Migration with Safety Features (1-1.5 hours)

**Files to Modify**:

- `backend/src/migrations/fix-daily-usage-cache-token-breakdowns.sql`

**Enhancements to Add**:

```sql
-- Enhanced migration with safety features

-- Step 1: Create progress tracking table
CREATE TEMP TABLE IF NOT EXISTS migration_progress (
  processed_date DATE PRIMARY KEY,
  status TEXT NOT NULL,
  error_message TEXT,
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Enhanced function with error handling
CREATE OR REPLACE FUNCTION fix_daily_usage_token_breakdowns_safe()
RETURNS TABLE (
  total_rows INT,
  successful_rows INT,
  failed_rows INT
) AS $$
DECLARE
  cache_row RECORD;
  row_count INT := 0;
  success_count INT := 0;
  error_count INT := 0;
  raw_data JSONB;
  aggregated_by_user JSONB;
  aggregated_by_model JSONB;
  aggregated_by_provider JSONB;
  -- ... other variables from original migration
BEGIN
  -- Process each row with error handling
  FOR cache_row IN
    SELECT date, raw_data, aggregated_by_user, aggregated_by_model, aggregated_by_provider
    FROM daily_usage_cache
    ORDER BY date  -- Process in order for easier debugging
  LOOP
    BEGIN
      row_count := row_count + 1;

      -- Original transformation logic here
      -- (keep existing JSONB manipulation code)

      -- Update the cache row
      UPDATE daily_usage_cache
      SET
        raw_data = raw_data,
        aggregated_by_user = aggregated_by_user,
        aggregated_by_model = aggregated_by_model,
        aggregated_by_provider = aggregated_by_provider
      WHERE date = cache_row.date;

      success_count := success_count + 1;

      -- Log progress
      INSERT INTO migration_progress (processed_date, status)
      VALUES (cache_row.date, 'SUCCESS');

      -- Log every 100 rows
      IF row_count % 100 = 0 THEN
        RAISE NOTICE 'Processed % rows (% successful, % failed)',
          row_count, success_count, error_count;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;

      -- Log error
      INSERT INTO migration_progress (processed_date, status, error_message)
      VALUES (cache_row.date, 'ERROR', SQLERRM);

      RAISE WARNING 'Error processing date %: %', cache_row.date, SQLERRM;

      -- Stop if too many errors
      IF error_count > 10 THEN
        RAISE EXCEPTION 'Too many errors (%), stopping migration', error_count;
      END IF;
    END;
  END LOOP;

  RAISE NOTICE 'Migration complete: % rows processed, % successful, % failed',
    row_count, success_count, error_count;

  -- Return summary
  RETURN QUERY SELECT row_count, success_count, error_count;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Run migration in transaction
BEGIN;

-- Execute migration
SELECT * FROM fix_daily_usage_token_breakdowns_safe();

-- Step 4: Validation queries
DO $$
DECLARE
  null_count INT;
  invalid_count INT;
BEGIN
  -- Check for null values
  SELECT COUNT(*) INTO null_count
  FROM daily_usage_cache
  WHERE aggregated_by_user IS NULL
     OR aggregated_by_model IS NULL
     OR aggregated_by_provider IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Validation failed: % rows with null aggregations', null_count;
  END IF;

  -- Check for invalid JSONB structure
  -- (add structure validation logic here)

  RAISE NOTICE 'Validation passed: All rows have valid data';
END $$;

-- Step 5: Commit if all validations pass
COMMIT;

-- If any errors occurred, transaction will rollback automatically

-- Step 6: Show migration results
SELECT
  status,
  COUNT(*) as count,
  STRING_AGG(processed_date::TEXT, ', ' ORDER BY processed_date) as dates
FROM migration_progress
GROUP BY status
ORDER BY status;
```

---

##### Step 1D.3: Create Rollback Script (45 minutes)

**Files to Create**:

- `backend/src/migrations/rollback-fix-daily-usage-cache-token-breakdowns.sql`

**Implementation**:

```sql
-- rollback-fix-daily-usage-cache-token-breakdowns.sql
-- Restores daily_usage_cache from backup table

-- IMPORTANT: Update backup_table_name with actual backup table created

DO $$
DECLARE
  backup_table_name TEXT;
  backup_count INT;
  current_count INT;
BEGIN
  -- Find most recent backup table
  SELECT table_name INTO backup_table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE 'daily_usage_cache_backup_%'
  ORDER BY table_name DESC
  LIMIT 1;

  IF backup_table_name IS NULL THEN
    RAISE EXCEPTION 'No backup table found. Cannot rollback.';
  END IF;

  RAISE NOTICE 'Rolling back from backup: %', backup_table_name;

  -- Get counts
  EXECUTE format('SELECT COUNT(*) FROM %I', backup_table_name) INTO backup_count;
  SELECT COUNT(*) INTO current_count FROM daily_usage_cache;

  RAISE NOTICE 'Current table rows: %, Backup table rows: %', current_count, backup_count;

  -- Confirm rollback (manual step - user must uncomment)
  -- RAISE EXCEPTION 'ROLLBACK PREVIEW - Uncomment next section to proceed';

  -- Begin rollback transaction
  BEGIN
    -- Truncate current table
    TRUNCATE TABLE daily_usage_cache;

    -- Restore from backup
    EXECUTE format('INSERT INTO daily_usage_cache SELECT * FROM %I', backup_table_name);

    RAISE NOTICE 'Rollback complete. Restored % rows.', backup_count;

    -- Verify restoration
    SELECT COUNT(*) INTO current_count FROM daily_usage_cache;

    IF current_count != backup_count THEN
      RAISE EXCEPTION 'Rollback verification failed: expected % rows, got %',
        backup_count, current_count;
    END IF;

    RAISE NOTICE 'Rollback verified successfully.';
  END;
END $$;

-- Manual verification
SELECT COUNT(*) as total_rows FROM daily_usage_cache;
SELECT date, cached_at FROM daily_usage_cache ORDER BY date LIMIT 10;
```

---

##### Step 1D.4: Create Migration Runbook (1 hour)

**Files to Create**:

- `docs/operations/migration-runbook.md`

**Implementation**:

````markdown
# Migration Runbook: Daily Usage Cache Token Breakdowns

**Migration**: `fix-daily-usage-cache-token-breakdowns.sql`
**Date**: 2025-10-10
**DBA**: [Name]
**Estimated Duration**: 5-15 minutes (depends on data size)

## Pre-Migration Checklist

- [ ] **Schedule maintenance window** (if required)
- [ ] **Notify stakeholders** of planned maintenance
- [ ] **Test migration on staging** with production-like data
- [ ] **Measure execution time** on staging
- [ ] **DBA review** completed
- [ ] **Backup strategy** confirmed
- [ ] **Rollback plan** tested
- [ ] **Database monitoring** ready

## Pre-Migration Steps

### 1. Create Database Backup (5 minutes)

```bash
# Full database backup (recommended)
pg_dump -h localhost -U litemaas -d litemaas > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# Or table-specific backup
psql -h localhost -U litemaas -d litemaas -f backend/src/migrations/backup-daily-usage-cache.sql
```
````

**Verify Backup**:

```sql
-- Check backup table exists and has correct row count
SELECT table_name,
       (SELECT COUNT(*) FROM daily_usage_cache) as original_count
FROM information_schema.tables
WHERE table_name LIKE 'daily_usage_cache_backup_%'
ORDER BY table_name DESC
LIMIT 1;
```

### 2. Record Baseline Metrics (2 minutes)

```sql
-- Record current state
SELECT
  COUNT(*) as total_rows,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  SUM(CASE WHEN aggregated_by_user IS NULL THEN 1 ELSE 0 END) as null_users,
  SUM(CASE WHEN aggregated_by_model IS NULL THEN 1 ELSE 0 END) as null_models
FROM daily_usage_cache;
```

## Migration Execution

### 3. Run Migration (5-15 minutes)

```bash
# Execute migration script
psql -h localhost -U litemaas -d litemaas -f backend/src/migrations/fix-daily-usage-cache-token-breakdowns.sql

# Monitor progress
tail -f /var/log/postgresql/postgresql.log | grep "NOTICE"
```

**Expected Output**:

```
NOTICE:  Processed 100 rows (100 successful, 0 failed)
NOTICE:  Processed 200 rows (200 successful, 0 failed)
...
NOTICE:  Migration complete: 365 rows processed, 365 successful, 0 failed
NOTICE:  Validation passed: All rows have valid data
COMMIT
```

**Warning Signs** (STOP if you see):

- More than 10 errors
- Validation failures
- Unexpected ROLLBACK
- Lock timeout errors

### 4. Verify Migration Success (2 minutes)

```sql
-- Check migration results
SELECT status, COUNT(*)
FROM migration_progress
GROUP BY status;
-- Expected: All rows should have 'SUCCESS' status

-- Verify no null values
SELECT COUNT(*) as null_count
FROM daily_usage_cache
WHERE aggregated_by_user IS NULL
   OR aggregated_by_model IS NULL
   OR aggregated_by_provider IS NULL;
-- Expected: 0

-- Spot check a few rows
SELECT date,
       jsonb_typeof(aggregated_by_user) as user_type,
       jsonb_typeof(aggregated_by_model) as model_type,
       jsonb_typeof(aggregated_by_provider) as provider_type
FROM daily_usage_cache
ORDER BY date
LIMIT 10;
-- Expected: All should be 'object'
```

## Post-Migration Steps

### 5. Application Testing (10 minutes)

- [ ] **Test analytics endpoint**: GET /api/v1/admin/usage/analytics
- [ ] **Test user breakdown**: GET /api/v1/admin/usage/user-breakdown
- [ ] **Test model breakdown**: GET /api/v1/admin/usage/model-breakdown
- [ ] **Verify frontend charts** display correctly
- [ ] **Check error logs** for any issues

### 6. Performance Validation (5 minutes)

```sql
-- Measure query performance
EXPLAIN ANALYZE
SELECT aggregated_by_user
FROM daily_usage_cache
WHERE date BETWEEN '2025-01-01' AND '2025-01-31';
-- Should complete in < 100ms
```

### 7. Cleanup (Optional - after 24 hours)

```sql
-- After confirming migration success, drop backup table
-- WAIT AT LEAST 24 HOURS before running this

DROP TABLE daily_usage_cache_backup_20251010_120000;  -- Use actual backup table name
```

## Rollback Procedure

**If migration fails or produces incorrect results:**

### Immediate Rollback (5 minutes)

```bash
# Execute rollback script
psql -h localhost -U litemaas -d litemaas -f backend/src/migrations/rollback-fix-daily-usage-cache-token-breakdowns.sql
```

**Rollback steps**:

1. Stop application to prevent cache updates
2. Run rollback script
3. Verify row count matches backup
4. Spot check data integrity
5. Restart application
6. Investigate migration failure

### Manual Rollback (if script fails)

```sql
BEGIN;

-- Truncate current table
TRUNCATE TABLE daily_usage_cache;

-- Restore from backup (use actual backup table name)
INSERT INTO daily_usage_cache
SELECT * FROM daily_usage_cache_backup_20251010_120000;

-- Verify
SELECT COUNT(*) FROM daily_usage_cache;

COMMIT;
```

## Troubleshooting

### Issue: Migration times out

**Cause**: Large dataset, complex JSONB operations
**Solution**:

- Increase statement timeout: `SET statement_timeout = '30min';`
- Process in batches if needed
- Run during low-traffic period

### Issue: Too many errors (>10)

**Cause**: Unexpected data format, logic bug
**Solution**:

- Review error messages in `migration_progress` table
- Check sample failed rows
- DO NOT COMMIT - rollback and fix migration script
- Test fix on staging before retry

### Issue: Validation fails

**Cause**: Migration logic bug, incomplete transformation
**Solution**:

- Transaction will auto-rollback
- Review validation error details
- Fix migration script
- Test on staging before retry

## Success Criteria

- [ ] Migration completes without errors
- [ ] All rows in `migration_progress` have 'SUCCESS' status
- [ ] No null values in aggregated columns
- [ ] Application tests pass
- [ ] Performance acceptable
- [ ] No error logs from application
- [ ] Stakeholders notified of completion

## Emergency Contacts

- **DBA**: [Name] - [Contact]
- **DevOps**: [Name] - [Contact]
- **Engineering Lead**: [Name] - [Contact]

## Timeline

| Step                   | Duration | Total Elapsed |
| ---------------------- | -------- | ------------- |
| Pre-migration backup   | 5 min    | 0:05          |
| Baseline metrics       | 2 min    | 0:07          |
| Migration execution    | 5-15 min | 0:12-0:22     |
| Verification           | 2 min    | 0:14-0:24     |
| Application testing    | 10 min   | 0:24-0:34     |
| Performance validation | 5 min    | 0:29-0:39     |

**Total Estimated Time**: 30-40 minutes (including buffer)

````

---

##### Step 1D.5: Test on Staging (30 minutes)

**Actions**:
1. Create production-like dataset in staging
2. Run backup script
3. Run migration script
4. Verify results
5. Test rollback script
6. Document actual execution time

**Documentation**:
- Record execution time
- Note any issues encountered
- Verify backup/rollback works
- Get DBA sign-off

---

#### Session 1D Deliverables

- [ ] Backup procedure script created
- [ ] Migration enhanced with safety features
- [ ] Rollback script created and tested
- [ ] Migration runbook documented
- [ ] Tested on staging with production-like data
- [ ] DBA sign-off obtained

#### Session 1D Acceptance Criteria

- [ ] Backup procedure creates timestamped backup
- [ ] Migration wrapped in transaction
- [ ] Progress logging added
- [ ] Error handling for each row
- [ ] Rollback script tested successfully
- [ ] Post-migration validation queries
- [ ] Tested on production-like data (size and complexity)
- [ ] DBA review completed
- [ ] Runbook complete with troubleshooting guide
- [ ] Emergency contacts documented

---

### Sessions 1E-1H: Service File Refactoring

**Issue**: #1 - 2,833-line Service File
**Duration**: 8-16 hours (split across 4 sessions)
**Session Type**: Long (split into multiple sessions)

#### Overview

This is the most substantial refactoring task, breaking the monolithic `admin-usage-stats.service.ts` (2,833 lines) into 5-6 focused services, each under 500 lines.

#### Refactoring Strategy

**Principles**:
1. **One session per extracted service** - Allows for focused work and testing
2. **Run tests after each extraction** - Ensures no regression
3. **Commit after each session** - Provides rollback points
4. **Extract utilities first** - Reduces dependencies for later extractions

**Order of Extraction** (Session-by-session):
1. Session 1E: Export service + Utilities (~600 lines total)
2. Session 1F: Trend calculator + Enrichment service (~800 lines total)
3. Session 1G: Aggregation service (~800 lines)
4. Session 1H: Refactor main service as orchestrator (~500 lines)

---

### Session 1E: Extract Export & Utilities

**Duration**: 2-3 hours

#### Objectives

Extract export functionality (CSV/JSON generation) and shared utility functions into separate modules.

#### Pre-Session Checklist

- [ ] Read service refactoring section of code review
- [ ] Review current `admin-usage-stats.service.ts` structure
- [ ] Identify export-related methods
- [ ] Identify shared utility functions
- [ ] Plan dependency graph

#### Implementation Steps

##### Step 1E.1: Create Directory Structure (5 minutes)

```bash
mkdir -p backend/src/services/admin-usage
````

**New Structure**:

```
backend/src/services/admin-usage/
├── admin-usage-stats.service.ts          (will refactor in Session 1H)
├── admin-usage-export.service.ts         (create in this session)
└── admin-usage.utils.ts                   (create in this session)
```

---

##### Step 1E.2: Extract Utility Functions (45 minutes)

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage.utils.ts`

**Methods to Extract** (from original service):

- Date range helper functions
- Number formatting utilities
- Data transformation helpers
- Comparison period calculation
- Serialization helpers

**Implementation**:

```typescript
// backend/src/services/admin-usage/admin-usage.utils.ts

import { parseISO, subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Calculate comparison period for trend analysis
 *
 * Given a date range, returns the comparison period of equal length
 * immediately preceding the requested period.
 *
 * @example
 * Input: 2025-01-15 to 2025-01-21 (7 days)
 * Output: 2025-01-08 to 2025-01-14 (previous 7 days)
 */
export function calculateComparisonPeriod(
  startDate: string,
  endDate: string,
): { comparisonStartDate: string; comparisonEndDate: string; days: number } {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  // Calculate period length in days
  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

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
 * Format number with appropriate units (K, M, B)
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
 * Serialize dates in object to ISO strings
 */
export function serializeDates<T>(obj: T): any {
  // ... existing serialization logic
}

// ... other utility functions
```

**Tests**:

```typescript
// backend/tests/unit/services/admin-usage/admin-usage.utils.test.ts

describe('admin-usage.utils', () => {
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
      // ... verify dates
    });
  });

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
  });
});
```

---

##### Step 1E.3: Extract Export Service (1 hour)

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage-export.service.ts`

**Methods to Extract**:

- `exportToCSV()`
- `exportToJSON()`
- `generateExportData()`
- CSV formatting helpers

**Implementation**:

```typescript
// backend/src/services/admin-usage/admin-usage-export.service.ts

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { ApplicationError } from '../../utils/errors';
import type {
  AdminUsageFilters,
  UserBreakdown,
  ModelBreakdown,
} from '../../types/admin-usage.types';

export class AdminUsageExportService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  /**
   * Export user breakdown to CSV format
   *
   * @param breakdown - User breakdown data
   * @param filters - Original filters for metadata
   * @returns CSV string
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

      // Combine headers and rows
      const csv = [
        headers.join(','),
        ...rows.map((row) => row.map(this.escapeCSVField).join(',')),
      ].join('\n');

      return csv;
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to export user breakdown to CSV');
      throw ApplicationError.internal('Failed to generate CSV export', { error });
    }
  }

  /**
   * Export to JSON format
   *
   * @param data - Data to export
   * @param filters - Original filters for metadata
   * @returns JSON string
   */
  async exportToJSON<T>(data: T, filters: AdminUsageFilters): Promise<string> {
    try {
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          filters,
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

  /**
   * Escape CSV field for safe export
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
}
```

**Tests**:

```typescript
// backend/tests/unit/services/admin-usage/admin-usage-export.service.test.ts

describe('AdminUsageExportService', () => {
  let exportService: AdminUsageExportService;

  beforeEach(() => {
    exportService = new AdminUsageExportService(fastify);
  });

  describe('exportUserBreakdownToCSV', () => {
    it('should generate valid CSV', async () => {
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
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      expect(csv).toContain('User ID,Username,Email');
      expect(csv).toContain('user-1,john.doe,john@example.com,100,5000,3000,2000,1.2500');
    });

    it('should escape CSV fields with commas', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'doe, john', // Contains comma
          email: 'john@example.com',
          // ... other fields
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      expect(csv).toContain('"doe, john"'); // Should be wrapped in quotes
    });
  });

  describe('exportToJSON', () => {
    it('should generate JSON with metadata', async () => {
      const data = { test: 'data' };
      const json = await exportService.exportToJSON(data, filters);
      const parsed = JSON.parse(json);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.exportedAt).toBeDefined();
      expect(parsed.metadata.filters).toEqual(filters);
      expect(parsed.data).toEqual(data);
    });
  });
});
```

---

##### Step 1E.4: Update Imports in Main Service (15 minutes)

**Files to Modify**:

- `backend/src/services/admin-usage-stats.service.ts`

**Changes**:

```typescript
// Import new modules
import { AdminUsageExportService } from './admin-usage/admin-usage-export.service';
import {
  calculateComparisonPeriod,
  formatLargeNumber,
  serializeDates,
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

  // Remove extracted utility methods (now imported from utils)
  // - calculateComparisonPeriod() - now imported
  // - formatLargeNumber() - now imported
  // - serializeDates() - now imported
}
```

---

##### Step 1E.5: Run Tests (15 minutes)

**Commands**:

```bash
# Run all admin-usage tests
npm --prefix backend test -- admin-usage

# Run specific new tests
npm --prefix backend test -- admin-usage.utils.test.ts
npm --prefix backend test -- admin-usage-export.service.test.ts

# Run full test suite to ensure no regression
npm --prefix backend test
```

**Expected**:

- All existing tests pass
- New utility tests pass
- New export service tests pass
- No test failures

---

##### Step 1E.6: Commit Changes (5 minutes)

```bash
git add backend/src/services/admin-usage/
git add backend/tests/unit/services/admin-usage/
git commit -m "refactor: extract export service and utilities from admin-usage-stats

- Create AdminUsageExportService for CSV/JSON export (300 lines)
- Extract utility functions to admin-usage.utils.ts (400 lines)
- Update main service to use extracted modules
- Add comprehensive tests for new modules
- All existing tests pass

Related to Issue #1: Service file size reduction
Phase 1, Session 1E of refactoring plan"
```

---

#### Session 1E Deliverables

- [ ] `admin-usage.utils.ts` created (~400 lines)
- [ ] `AdminUsageExportService` created (~300 lines)
- [ ] Tests added for both modules
- [ ] Main service updated to use new modules
- [ ] All tests passing
- [ ] Changes committed

#### Session 1E Acceptance Criteria

- [ ] Export service < 500 lines
- [ ] Utilities module < 500 lines
- [ ] All export functionality preserved
- [ ] All utility functions working
- [ ] Test coverage maintained
- [ ] No test failures
- [ ] Clean commit with descriptive message

---

### Session 1F: Extract Trend & Enrichment Services

**Duration**: 2-4 hours

#### Objectives

Extract trend calculation logic and data enrichment (user/API key mapping) into separate services.

#### Pre-Session Checklist

- [ ] Review Session 1E changes
- [ ] Identify trend calculation methods
- [ ] Identify enrichment methods
- [ ] Plan service interfaces

#### Implementation Steps

##### Step 1F.1: Create Trend Calculator Service (1-1.5 hours)

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage-trend-calculator.ts`

**Methods to Extract**:

- `calculateTrend()`
- `calculateTrendDirection()`
- `aggregateTrendMetrics()`
- `comparePeriods()`

**Implementation** (abbreviated):

```typescript
// backend/src/services/admin-usage/admin-usage-trend-calculator.ts

export class AdminUsageTrendCalculator extends BaseService {
  private readonly TREND_STABILITY_THRESHOLD = 1.0; // 1%

  /**
   * Calculate trend for a metric
   *
   * @param metric - Metric name
   * @param current - Current period value
   * @param previous - Previous period value
   * @returns Trend data with direction and percentage change
   */
  calculateTrend(metric: string, current: number, previous: number): TrendData {
    // Avoid division by zero
    if (previous === 0) {
      return {
        metric,
        current,
        previous,
        percentageChange: current > 0 ? 100 : 0,
        direction: current > 0 ? 'up' : 'stable',
      };
    }

    const percentageChange = ((current - previous) / previous) * 100;

    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(percentageChange) < this.TREND_STABILITY_THRESHOLD) {
      direction = 'stable';
    } else {
      direction = percentageChange > 0 ? 'up' : 'down';
    }

    return {
      metric,
      current,
      previous,
      percentageChange,
      direction,
    };
  }

  // ... other trend calculation methods
}
```

**Tests** (abbreviated):

```typescript
describe('AdminUsageTrendCalculator', () => {
  describe('calculateTrend', () => {
    it('should calculate upward trend', () => {
      const trend = calculator.calculateTrend('requests', 150, 100);
      expect(trend.percentageChange).toBe(50);
      expect(trend.direction).toBe('up');
    });

    it('should calculate downward trend', () => {
      const trend = calculator.calculateTrend('requests', 50, 100);
      expect(trend.percentageChange).toBe(-50);
      expect(trend.direction).toBe('down');
    });

    it('should identify stable trend (< 1% change)', () => {
      const trend = calculator.calculateTrend('requests', 100, 100.5);
      expect(Math.abs(trend.percentageChange)).toBeLessThan(1);
      expect(trend.direction).toBe('stable');
    });
  });
});
```

---

##### Step 1F.2: Create Enrichment Service (1-1.5 hours)

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage-enrichment.service.ts`

**Methods to Extract**:

- `enrichWithUserData()`
- `enrichWithAPIKeyData()`
- `getUserMapping()`
- `getAPIKeyMapping()`
- `createUnknownUser()`

**Implementation** (abbreviated):

```typescript
// backend/src/services/admin-usage/admin-usage-enrichment.service.ts

export class AdminUsageEnrichmentService extends BaseService {
  private readonly UNKNOWN_USER_ID = '00000000-0000-0000-0000-000000000000';
  private readonly UNKNOWN_USERNAME = 'Unknown User';

  /**
   * Enrich usage data with user information
   *
   * @param apiKeyUsage - Map of API key to usage data
   * @returns Map enriched with user data
   */
  async enrichWithUserData(
    apiKeyUsage: Map<string, UsageData>,
  ): Promise<Map<string, EnrichedUsageData>> {
    try {
      // Get API key to user mapping
      const apiKeyMapping = await this.getAPIKeyUserMapping(Array.from(apiKeyUsage.keys()));

      // Get unique user IDs
      const userIds = [...new Set(Object.values(apiKeyMapping).map((m) => m.userId))];

      // Batch fetch user data
      const users = await this.getUsersById(userIds);
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Enrich each entry
      const enriched = new Map<string, EnrichedUsageData>();

      for (const [apiKey, usage] of apiKeyUsage.entries()) {
        const mapping = apiKeyMapping[apiKey];
        const user = mapping ? userMap.get(mapping.userId) : null;

        enriched.set(apiKey, {
          ...usage,
          userId: user?.id || this.UNKNOWN_USER_ID,
          username: user?.username || this.UNKNOWN_USERNAME,
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
   * @param apiKeys - Array of API key hashes
   * @returns Mapping of API key to user ID and alias
   */
  private async getAPIKeyUserMapping(
    apiKeys: string[],
  ): Promise<Record<string, { userId: string; keyAlias: string }>> {
    // Use single query with IN clause (avoid N+1 problem)
    const result = await this.fastify.pg.query(
      'SELECT key_hash, user_id, name FROM api_keys WHERE key_hash = ANY($1)',
      [apiKeys],
    );

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
  }

  // ... other enrichment methods
}
```

**Tests** (abbreviated):

```typescript
describe('AdminUsageEnrichmentService', () => {
  describe('enrichWithUserData', () => {
    it('should enrich usage data with user information', async () => {
      const apiKeyUsage = new Map([['key1', { requests: 100, tokens: 5000, cost: 1.25 }]]);

      const enriched = await enrichmentService.enrichWithUserData(apiKeyUsage);
      const entry = enriched.get('key1');

      expect(entry).toBeDefined();
      expect(entry?.userId).toBeDefined();
      expect(entry?.username).toBeDefined();
      expect(entry?.requests).toBe(100);
    });

    it('should handle unknown users', async () => {
      // API key with no user mapping
      const apiKeyUsage = new Map([['unknown-key', { requests: 10, tokens: 500, cost: 0.1 }]]);

      const enriched = await enrichmentService.enrichWithUserData(apiKeyUsage);
      const entry = enriched.get('unknown-key');

      expect(entry?.userId).toBe('00000000-0000-0000-0000-000000000000');
      expect(entry?.username).toBe('Unknown User');
    });
  });
});
```

---

##### Step 1F.3: Update Main Service (30 minutes)

**Files to Modify**:

- `backend/src/services/admin-usage-stats.service.ts`

**Changes**:

```typescript
import { AdminUsageTrendCalculator } from './admin-usage/admin-usage-trend-calculator';
import { AdminUsageEnrichmentService } from './admin-usage/admin-usage-enrichment.service';

export class AdminUsageStatsService extends BaseService {
  private trendCalculator: AdminUsageTrendCalculator;
  private enrichmentService: AdminUsageEnrichmentService;

  constructor(/* ... */) {
    super(fastify);
    // ... existing initialization
    this.trendCalculator = new AdminUsageTrendCalculator(fastify);
    this.enrichmentService = new AdminUsageEnrichmentService(fastify);
  }

  // Delegate trend calculations
  private calculateTrends(/* ... */): TrendData[] {
    return [
      this.trendCalculator.calculateTrend('requests', current.requests, previous.requests),
      this.trendCalculator.calculateTrend('tokens', current.tokens, previous.tokens),
      // ...
    ];
  }

  // Delegate enrichment
  private async enrichUsageData(/* ... */): Promise<EnrichedUsageData[]> {
    return this.enrichmentService.enrichWithUserData(apiKeyUsage);
  }

  // Remove extracted methods
}
```

---

##### Step 1F.4: Test & Commit (30 minutes)

**Test**:

```bash
npm --prefix backend test -- admin-usage
npm --prefix backend test
```

**Commit**:

```bash
git add .
git commit -m "refactor: extract trend calculator and enrichment services

- Create AdminUsageTrendCalculator for trend analysis (400 lines)
- Create AdminUsageEnrichmentService for user/API key enrichment (400 lines)
- Update main service to use extracted services
- Add comprehensive tests for both services
- All existing tests pass

Related to Issue #1: Service file size reduction
Phase 1, Session 1F of refactoring plan"
```

---

#### Session 1F Deliverables

- [ ] Trend calculator service created (~400 lines)
- [ ] Enrichment service created (~400 lines)
- [ ] Main service updated
- [ ] Tests added
- [ ] All tests passing
- [ ] Changes committed

---

### Session 1G: Extract Aggregation Service

**Duration**: 2-4 hours

#### Objectives

Extract the core aggregation logic (most complex part) into a dedicated service.

#### Implementation Steps

##### Step 1G.1: Create Aggregation Service (2-3 hours)

**Files to Create**:

- `backend/src/services/admin-usage/admin-usage-aggregation.service.ts`

**Methods to Extract**:

- `aggregateByUser()`
- `aggregateByModel()`
- `aggregateByProvider()`
- `aggregateDailyUsage()`
- `calculateTotals()`

**This is the largest extraction - ~800 lines of complex JSONB aggregation logic**

---

##### Step 1G.2: Test & Commit

**Same pattern as previous sessions**

---

### Session 1H: Refactor Main Service as Orchestrator

**Duration**: 2-3 hours

#### Objectives

Refactor the main `AdminUsageStatsService` to act as an orchestrator, delegating to specialized services.

#### Implementation Steps

##### Step 1H.1: Simplify Main Service (1.5-2 hours)

**Result**: Main service should be ~500 lines, primarily orchestrating other services

**Pattern**:

```typescript
export class AdminUsageStatsService extends BaseService {
  private aggregationService: AdminUsageAggregationService;
  private enrichmentService: AdminUsageEnrichmentService;
  private trendCalculator: AdminUsageTrendCalculator;
  private exportService: AdminUsageExportService;

  async getAnalytics(filters: AdminUsageFilters): Promise<Analytics> {
    // 1. Get aggregated data
    const aggregated = await this.aggregationService.aggregateUsage(filters);

    // 2. Enrich with user data
    const enriched = await this.enrichmentService.enrichWithUserData(aggregated);

    // 3. Calculate trends
    const trends = this.trendCalculator.calculateTrends(enriched, comparisonData);

    // 4. Return combined analytics
    return {
      metrics: enriched,
      trends,
      topUsers: this.getTopUsers(enriched, 10),
      topModels: this.getTopModels(enriched, 10),
    };
  }

  // Other methods follow same pattern: orchestrate, don't implement
}
```

---

##### Step 1H.2: Final Validation (30 minutes)

**Verify**:

- [ ] Main service < 500 lines
- [ ] All extracted services < 500 lines
- [ ] All tests pass
- [ ] No functionality regression
- [ ] Performance acceptable

---

##### Step 1H.3: Update Documentation (30 minutes)

**Files to Update**:

- `backend/CLAUDE.md` - Update service architecture section
- `docs/architecture/services.md` - Document new service structure
- `docs/development/pattern-reference.md` - Add service decomposition example

---

##### Step 1H.4: Final Commit (10 minutes)

```bash
git add .
git commit -m "refactor: complete service decomposition - main service as orchestrator

- Refactor AdminUsageStatsService to orchestrator pattern (500 lines)
- Main service now delegates to specialized services
- All services under 500 lines
- Full test coverage maintained
- Documentation updated

Completes Issue #1: Service file size reduction
Original: 2,833 lines
Final: 6 services, each < 500 lines
Phase 1, Session 1H - final session of refactoring"
```

---

### Phase 1 Checkpoint: Critical Issues Resolved

#### Validation Checklist

After completing all Session 1 tasks:

**Code Quality**:

- [ ] All services < 500 lines
- [ ] Full test suite passes (100%)
- [ ] No TypeScript errors
- [ ] Linter passes

**Functionality**:

- [ ] All admin analytics endpoints working
- [ ] Rate limiting active and tested
- [ ] Date range validation working
- [ ] No memory leaks (tested with Chrome DevTools)
- [ ] Migration tested on staging

**Documentation**:

- [ ] Rate limiting documented
- [ ] Date range limits documented
- [ ] Migration runbook complete
- [ ] Service architecture updated

**Deployment Readiness**:

- [ ] Environment variables documented
- [ ] Configuration validated
- [ ] Rollback procedures tested
- [ ] DBA sign-off obtained (migration)

#### Phase 1 Deliverables

- [ ] Rate limiting implemented (Issue #2) ✅
- [ ] Date range validation implemented (Issue #5) ✅
- [ ] Memory leak fixed (Issue #4) ✅
- [ ] Migration safety implemented (Issue #3) ✅
- [ ] Service refactoring complete (Issue #1) ✅

#### Phase 1 Metrics

**Before**:

- Largest file: 2,833 lines
- Rate limiting: None
- Date validation: Basic only
- Memory leaks: Present
- Migration safety: None

**After**:

- Largest file: < 500 lines
- Rate limiting: All endpoints protected
- Date validation: Max 90/365 days
- Memory leaks: Fixed
- Migration safety: Backup, rollback, validation

#### Phase 1 Sign-Off

**Approvals Required**:

- [ ] Tech Lead - Code quality review
- [ ] DBA - Migration runbook review
- [ ] Security - Rate limiting review
- [ ] QA - Functional testing complete

**Ready for Phase 2**: ✅ / ❌

---

## Phase 2: High-Priority Operational Safeguards

**Priority**: 🟡 **HIGH**
**Duration**: 6-12 hours
**Should Complete**: Before full production rollout

### Overview

Phase 2 addresses operational improvements that enhance user experience, system scalability, and code maintainability. These are important for production success but not blocking deployment.

**High-Priority Issues**:

1. **Issue #6**: No Pagination on Breakdown Endpoints
2. **Issue #7**: Inconsistent Error Handling in Frontend

---

### Session 2A-2B: Pagination Implementation

**Issue**: #6 - No Pagination
**Duration**: 6-8 hours (2 sessions: backend + frontend)

#### Session 2A: Backend Pagination (3-4 hours)

**Objectives**:

- Add pagination support to all breakdown endpoints
- Implement sorting
- Add pagination metadata to responses

**Tasks**:

1. Update type definitions with pagination types
2. Update schemas with pagination parameters
3. Modify service methods to support pagination
4. Update route handlers
5. Add tests

**Pattern** (abbreviated):

```typescript
// Types
interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Service method
async getUserBreakdown(
  filters: AdminUsageFilters,
  pagination: PaginationParams
): Promise<PaginatedResponse<UserBreakdown>> {
  // Get all data
  const allUsers = await this.getUserBreakdownInternal(filters);

  // Sort
  const sorted = this.sortUserBreakdown(allUsers, pagination.sortBy, pagination.sortOrder);

  // Paginate
  const offset = (pagination.page - 1) * pagination.limit;
  const paginated = sorted.slice(offset, offset + pagination.limit);

  return {
    data: paginated,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: sorted.length,
      totalPages: Math.ceil(sorted.length / pagination.limit),
      hasNext: offset + pagination.limit < sorted.length,
      hasPrevious: pagination.page > 1,
    },
  };
}
```

---

#### Session 2B: Frontend Pagination (3-4 hours)

**Objectives**:

- Add PatternFly Pagination components
- Update API service calls
- Add pagination state management

**Pattern**:

```typescript
const UserBreakdownTable: React.FC = () => {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const { data } = useQuery(
    ['userBreakdown', filters, page, perPage],
    () => adminUsageService.getUserBreakdown(filters, { page, limit: perPage })
  );

  return (
    <>
      <Table>{/* ... */}</Table>

      <Pagination
        itemCount={data?.pagination.total || 0}
        page={page}
        perPage={perPage}
        onSetPage={(_, newPage) => setPage(newPage)}
        onPerPageSelect={(_, newPerPage) => setPerPage(newPerPage)}
      />
    </>
  );
};
```

---

### Session 2C: Error Handling Standardization

**Issue**: #7 - Inconsistent Error Handling
**Duration**: 4-6 hours

**Objectives**:

- Audit all error handling
- Standardize on `useErrorHandler` hook
- Create error handling guide

**Tasks**:

1. Audit error handling in all components
2. Update to use `useErrorHandler` consistently
3. Update React Query error handling
4. Create error handling guide
5. Add to code review checklist

**Pattern**:

```typescript
// ✅ Correct pattern
const { handleError } = useErrorHandler();

const { data } = useQuery(['key'], apiCall, {
  onError: (error) => handleError(error),
  retry: 1,
});
```

---

### Phase 2 Checkpoint

**Deliverables**:

- [ ] Pagination implemented on all breakdown endpoints
- [ ] Error handling standardized
- [ ] Documentation updated

**Validation**:

- [ ] Tables support pagination
- [ ] Error messages consistent
- [ ] All tests pass

---

## Phase 3: Architecture & Reliability

**Priority**: 🟡 **MEDIUM**
**Duration**: 13-18 hours
**Focus**: Long-term maintainability and reliability

### Overview

Phase 3 addresses architectural improvements and edge case handling that ensure system reliability and future maintainability.

**Issues**:

1. **Issue #8**: Hard-coded Business Logic Constants
2. **Issue #9**: Missing Timezone Documentation and Configuration
3. **Issue #10**: Race Condition in Cache TTL Logic

---

### Session 3A: Configurable Constants (3-4 hours)

**Issue**: #8 - Hard-coded Constants

**Tasks**:

1. Create configuration module
2. Extract all hard-coded constants
3. Add environment variables
4. Expose safe config via API
5. Update frontend to use config

---

### Session 3B: Timezone Standardization (4-6 hours)

**Issue**: #9 - Timezone Handling

**Tasks**:

1. Create UTC date utilities
2. Update all date handling to UTC
3. Add timezone tests (midnight, DST, multi-timezone)
4. Create timezone documentation
5. Update frontend date conversions

**Key Implementation**:

```typescript
// UTC utilities
export const parseDateAsUTC = (dateString: string): Date => {
  return utcToZonedTime(parseISO(`${dateString}T00:00:00Z`), 'UTC');
};

export const isTodayUTC = (date: Date): boolean => {
  const nowUTC = utcToZonedTime(new Date(), 'UTC');
  const dateUTC = utcToZonedTime(date, 'UTC');
  // ... comparison
};
```

---

### Session 3C: Fix Race Conditions (6-8 hours)

**Issue**: #10 - Cache Race Conditions

**Tasks**:

1. Add PostgreSQL advisory locks
2. Add grace period for "complete" determination
3. Make cache writes idempotent
4. Add race condition tests
5. Add monitoring metrics

**Key Implementation**:

```typescript
// Advisory lock pattern
async getCachedDailyData(date: Date) {
  const lockId = this.calculateLockId(date);
  try {
    await this.tryAdvisoryLock(lockId);
    // ... cache logic
  } finally {
    await this.releaseAdvisoryLock(lockId);
  }
}
```

---

### Phase 3 Checkpoint

**Deliverables**:

- [ ] All constants configurable
- [ ] UTC timezone standardization
- [ ] Race conditions fixed

**Validation**:

- [ ] Config API endpoint working
- [ ] Timezone tests passing
- [ ] Concurrent requests handled correctly

---

## Phase 4: Code Quality & Maintainability

**Priority**: 🟢 **LOW-MEDIUM**
**Duration**: 8-12 hours
**Focus**: Professional polish

### Issues

1. **Issue #11**: TypeScript `any` Usage (3-4 hours)
2. **Issue #12**: Missing JSDoc Documentation (2-3 hours)
3. **Issue #13**: Accessibility Improvements (2-3 hours)
4. **Issue #14**: Console Statement Cleanup (1 hour)
5. **Issue #15**: React Query Optimization (1-2 hours)

**Summary**: Polish pass for code quality, documentation, and accessibility.

---

## Phase 5: Performance & Observability

**Priority**: 🟢 **MEDIUM**
**Duration**: 16-24 hours
**Focus**: Operational excellence

### Sessions

**Session 5A**: Database Optimization (4-6 hours)

- Add indexes
- Optimize queries
- Batch operations

**Session 5B**: Performance Testing (6-8 hours)

- Create test suite
- Test with 10K users, 365 days
- Document performance

**Session 5C**: Monitoring & Metrics (6-10 hours)

- Add performance metrics
- Add error tracking
- Create dashboards

---

## Phase 6: Advanced Features (Optional)

**Priority**: 🟢 **LOW**
**Duration**: 40-60 hours
**Focus**: Future enhancements

### Sessions

**Session 6A**: Redis Caching (8-12 hours)
**Session 6B**: Async Export Queue (12-16 hours)
**Session 6C**: Advanced Visualizations (12-16 hours)
**Session 6D**: Scheduled Reports (8-16 hours)

**Note**: These are optional enhancements for future iterations.

---

## Multi-Session Execution Strategy

### Session Planning Guidelines

#### Short Sessions (2-3 hours)

**Best For**:

- Single, focused issues (#2, #4, #5, #14, #15)
- Quick wins with clear scope
- Time-constrained work periods

**Examples**:

- Fix ResizeObserver leak (Session 1C)
- Add date range validation (Session 1B)
- Remove console statements (Session 4D)

---

#### Medium Sessions (4-6 hours)

**Best For**:

- Complex issues requiring design (#6, #7, #8, #9)
- Multiple related changes
- Full work blocks

**Examples**:

- Add rate limiting (Session 1A)
- Backend pagination (Session 2A)
- Timezone standardization (Session 3B)

---

#### Long Sessions (8-16 hours)

**Best For**:

- Major refactoring (#1, #10)
- Can be split into sub-sessions
- Requires sustained focus

**Examples**:

- Service file refactoring (Sessions 1E-1H)
- Performance testing (Session 5B)

**Note**: Long sessions should be broken into logical sub-sessions with commit points.

---

### Progress Tracking

#### After Each Session

**Checklist**:

- [ ] Run relevant tests
- [ ] Commit changes with descriptive message
- [ ] Update issue tracker with progress
- [ ] Update this document with actual vs. estimated time
- [ ] Document any blockers or discoveries
- [ ] Note any dependencies for next session

**Commit Message Format**:

```
<type>: <short summary>

<detailed description>
<bullet points of changes>

Related to Issue #N: <issue title>
Phase X, Session XY of refactoring plan

Actual time: X hours (estimated: Y hours)
```

---

#### Between Phases

**Phase Checkpoint Checklist**:

- [ ] All phase tasks completed
- [ ] Full test suite passes
- [ ] Documentation updated
- [ ] Code reviewed (if team process)
- [ ] Performance validated (if applicable)
- [ ] Deployed to staging (if applicable)
- [ ] Phase sign-off obtained

---

### Rollback Strategy

#### If Issues Arise

**Protocol**:

1. **Stop work** - Don't compound the problem
2. **Assess impact** - What's broken?
3. **Review last commit** - Can we fix forward or must we rollback?
4. **Rollback if needed** - Use `git revert` for shared branches
5. **Document issue** - What went wrong and why?
6. **Update plan** - Adjust approach for next attempt

**Rollback Commands**:

```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert commit on shared branch
git revert <commit-hash>

# Return to last checkpoint
git checkout <phase-checkpoint-tag>
```

---

### Communication & Coordination

#### For Team Environments

**Daily Sync** (5-10 minutes):

- What was completed yesterday?
- What's planned for today?
- Any blockers?

**Weekly Review** (30 minutes):

- Phase progress review
- Adjust timeline if needed
- Discuss discoveries
- Plan next week's sessions

**Ad-hoc Communication**:

- Use issue tracker for discussions
- Tag team members for reviews
- Document decisions in issues
- Update plan document as needed

---

## Progress Tracking

### Session Log Template

**Copy this template for each session:**

```markdown
### Session [Phase][Letter]: [Title]

**Date**: YYYY-MM-DD
**Assignee**: [Name]
**Estimated**: X hours
**Actual**: Y hours

#### Pre-Session

- [ ] Checklist item 1
- [ ] Checklist item 2

#### Work Completed

- [x] Task 1
- [x] Task 2
- [ ] Task 3 (in progress)

#### Blockers Encountered

- Blocker 1: Description and resolution
- Blocker 2: Deferred to next session

#### Discoveries

- Discovery 1: Impact on plan
- Discovery 2: New requirement identified

#### Next Session Dependencies

- Dependency 1: Needed for next session
- Dependency 2: Can proceed in parallel

#### Test Results

- Unit tests: ✅ All passing
- Integration tests: ✅ All passing
- Manual testing: ⚠️ Found issue in X, logged as Issue #Y

#### Commit Hash

- Commit: `abc123def`
- Branch: `refactor/admin-analytics-remediation`
```

---

### Overall Progress Tracker

| Phase   | Status         | Sessions | Estimated | Actual | % Complete |
| ------- | -------------- | -------- | --------- | ------ | ---------- |
| Phase 0 | ✅ Complete    | 1        | 2-3h      | 2.5h   | 100%       |
| Phase 1 | ⬜ Not Started | 8        | 17-31h    | -      | 0%         |
| Phase 2 | ⬜ Not Started | 3        | 6-12h     | -      | 0%         |
| Phase 3 | ⬜ Not Started | 3        | 13-18h    | -      | 0%         |
| Phase 4 | ⬜ Not Started | 5        | 8-12h     | -      | 0%         |
| Phase 5 | ⬜ Not Started | 3        | 16-24h    | -      | 0%         |
| Phase 6 | ⬜ Not Started | 4        | 40-60h    | -      | 0%         |

**Legend**:

- ⬜ Not Started
- 🟦 In Progress
- ✅ Complete
- ⚠️ Blocked

---

## Timeline & Effort Summary

### Critical Path (Minimum for Production)

**Phases Required**: 0, 1, 2

| Phase                           | Duration    | Tasks                                                               |
| ------------------------------- | ----------- | ------------------------------------------------------------------- |
| Phase 0: Preparation            | 2-3 hours   | Environment setup, baseline metrics                                 |
| Phase 1: Critical Blocking      | 17-31 hours | Rate limiting, date validation, memory leak, migration, refactoring |
| Phase 2: Operational Safeguards | 6-12 hours  | Pagination, error handling                                          |

**Total Critical Path**: **25-46 hours (3-6 days)**

---

### Recommended Path (Production + Quality)

**Phases Required**: 0, 1, 2, 3, 4

| Phase                               | Duration    | Tasks                             |
| ----------------------------------- | ----------- | --------------------------------- |
| Phase 0-2                           | 25-46 hours | Critical path                     |
| Phase 3: Architecture & Reliability | 13-18 hours | Timezone, race conditions, config |
| Phase 4: Code Quality               | 8-12 hours  | Type safety, docs, accessibility  |

**Total Recommended**: **48-76 hours (6-10 days)**

---

### Complete Path (All Improvements)

**Phases Required**: 0, 1, 2, 3, 4, 5

| Phase                                | Duration    | Tasks                             |
| ------------------------------------ | ----------- | --------------------------------- |
| Phase 0-4                            | 48-76 hours | Recommended path                  |
| Phase 5: Performance & Observability | 16-24 hours | Database optimization, monitoring |

**Total Complete**: **64-100 hours (8-13 days)**

**Note**: Phase 6 (Advanced Features) is optional and should be planned separately.

---

### Sprint Planning Examples

#### 2-Week Sprint (80 hours, 2 engineers)

**Week 1**:

- Phase 0: Preparation (Both engineers)
- Phase 1, Sessions 1A-1D: Critical fixes (Parallel work)
- Phase 1, Sessions 1E-1F: Service refactoring (One engineer)
- Phase 2, Session 2A: Backend pagination (Other engineer)

**Week 2**:

- Phase 1, Sessions 1G-1H: Complete refactoring
- Phase 2, Sessions 2B-2C: Frontend pagination, error handling
- Phase 3, Sessions 3A-3B: Config, timezone
- Buffer for issues

**Deliverables**: Phases 0, 1, 2 complete, partial Phase 3

---

#### 3-Week Sprint (120 hours, 2 engineers)

**Week 1**: Phase 0, Phase 1 (complete)
**Week 2**: Phase 2, Phase 3 (complete)
**Week 3**: Phase 4, Phase 5 (partial)

**Deliverables**: Production-ready with quality improvements

---

## Key Success Factors

### Quality Gates

**Before Moving to Next Phase**:

1. ✅ All tasks in current phase completed
2. ✅ All tests passing (100%)
3. ✅ No TypeScript errors
4. ✅ Linter passing
5. ✅ Documentation updated
6. ✅ Code reviewed (if team process)
7. ✅ Deployed to staging (if applicable)

**If Any Gate Fails**:

- Do not proceed to next phase
- Fix issues in current phase
- Re-validate all gates
- Update plan if needed

---

### Risk Mitigation

**Common Risks**:

1. **Test Failures After Refactoring**
   - **Mitigation**: Run tests after each small change, commit frequently
   - **Recovery**: Revert to last working commit, fix issues

2. **Performance Regression**
   - **Mitigation**: Benchmark before/after, test with realistic data
   - **Recovery**: Optimize or rollback problematic changes

3. **Scope Creep**
   - **Mitigation**: Stick to plan, log new ideas for later
   - **Recovery**: Prioritize ruthlessly, defer non-critical items

4. **Time Overruns**
   - **Mitigation**: Track actual vs. estimated time, adjust plan
   - **Recovery**: Re-prioritize, consider skipping Phase 6

5. **Breaking Changes in Dependencies**
   - **Mitigation**: Pin dependency versions, test upgrades in isolation
   - **Recovery**: Rollback dependencies, investigate alternatives

---

### Communication Guidelines

**For Each Session**:

- **Start**: Post session plan to team channel
- **During**: Share blockers as they arise
- **End**: Post session summary with commit link

**For Each Phase**:

- **Start**: Review phase objectives with team
- **End**: Demo completed work, get sign-off

**For Blockers**:

- Document in issue tracker
- Tag relevant team members
- Propose solution or request input
- Update plan with resolution

---

## Conclusion

This implementation plan provides a structured, multi-session approach to addressing all issues identified in the comprehensive code review of the Admin Usage Analytics feature.

**Key Takeaways**:

1. **Phased Approach**: 6 phases, ordered by priority, allow flexible execution
2. **Clear Checkpoints**: Validation between phases ensures quality
3. **Rollback Strategy**: Each session is atomic and revertible
4. **Realistic Timeline**: 3-13 days depending on scope
5. **Team Coordination**: Built for multi-person execution

**Next Steps**:

1. Review and approve this plan with team
2. Schedule Phase 0 preparation session
3. Begin Phase 1 critical blocking issues
4. Track progress in issue tracker
5. Adapt plan as needed based on discoveries

**Remember**:

- **Quality over speed** - Take time to do it right
- **Test frequently** - Catch issues early
- **Commit often** - Provide rollback points
- **Document everything** - Help future maintainers
- **Communicate proactively** - Keep team aligned

---

**Document Maintenance**:

This document should be updated as work progresses:

- Mark completed tasks
- Update actual vs. estimated times
- Document discoveries and blockers
- Add lessons learned
- Adjust remaining estimates

**Last Updated**: 2025-10-10
**Next Review**: After Phase 0 completion

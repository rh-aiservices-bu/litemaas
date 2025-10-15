# Phase 1, Session 1A: Rate Limiting Implementation

**Phase**: 1 - Critical Blocking Issues
**Session**: 1A
**Duration**: 4-6 hours
**Priority**: 🔴 CRITICAL
**Issue**: #2 - Missing Rate Limiting (DoS Risk)

---

## Navigation

- [← Overview](../admin-analytics-remediation-plan.md) | [Next: Session 1B →](phase-1-session-1b-date-validation.md)

---

## Refactoring Context

This is Session 1A of Phase 1 in a comprehensive remediation plan addressing 15 identified issues.

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

Add rate limiting to all admin analytics endpoints to prevent DoS attacks and abuse of expensive operations.

**Why This Matters**:

- Admin analytics endpoints perform expensive database queries
- LiteLLM API calls are resource-intensive
- Cache rebuild operations are extremely costly
- Without rate limiting, malicious or buggy clients could:
  - Overwhelm the database with complex queries
  - Exhaust LiteLLM API quotas
  - Degrade service for all users
  - Cause service outages

**Expected Outcomes**:

- All 7 admin analytics endpoints protected with rate limits
- Different limits for different operation costs
- Rate limits configurable via environment variables
- 429 responses with helpful retry-after headers
- Full test coverage

---

## Pre-Session Checklist

- [x] Read rate limiting section of code review
- [x] Review `@fastify/rate-limit` documentation
- [x] Identify all endpoints requiring rate limiting
- [x] Plan rate limit values per endpoint type

**Key Findings from Code Review**:

> "No rate limiting on admin analytics endpoints. These endpoints perform expensive operations (database aggregation, LiteLLM API calls, cache operations) and should be protected against abuse. Recommendation: Implement `@fastify/rate-limit` with different limits per endpoint type."

**Endpoints Requiring Protection**:

1. `POST /api/v1/admin/usage/analytics` - Analytics queries
2. `POST /api/v1/admin/usage/user-breakdown` - User breakdown
3. `POST /api/v1/admin/usage/model-breakdown` - Model breakdown
4. `POST /api/v1/admin/usage/provider-breakdown` - Provider breakdown
5. `POST /api/v1/admin/usage/refresh-today` - Cache refresh
6. `POST /api/v1/admin/usage/rebuild-cache` - Full cache rebuild (most expensive)
7. `GET /api/v1/admin/usage/export` - Data export

**Planned Rate Limits**:

- Analytics queries: 10 requests/minute (moderate cost)
- Cache rebuild: 1 request/5 minutes (very high cost)
- Exports: 5 requests/minute (moderate-high cost)

---

## Implementation Steps

### Step 1A.1: Install Dependencies

**Duration**: 10 minutes

**Files Modified**:

- `backend/package.json`

**Actions**:

```bash
npm --prefix backend install @fastify/rate-limit
```

**Verification**:

```bash
grep "rate-limit" backend/package.json
```

**Expected Output**:

```json
{
  "dependencies": {
    "@fastify/rate-limit": "^9.0.0"
  }
}
```

**Notes**:

- `@fastify/rate-limit` is the official Fastify rate limiting plugin
- Uses in-memory storage by default (suitable for single-instance deployments)
- Supports custom key generators for per-user rate limiting
- Can be configured globally or per-route

---

### Step 1A.2: Create Rate Limit Configuration

**Duration**: 30 minutes

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

**Configuration Details**:

1. **Analytics Endpoints** (10 req/min):
   - Moderate cost operations
   - Database queries + potential LiteLLM calls
   - Allows reasonable interactive usage
   - Prevents abuse while supporting legitimate use

2. **Cache Rebuild** (1 req/5min):
   - Extremely expensive operation
   - Full cache invalidation and rebuild
   - Should be used sparingly
   - Very restrictive to prevent abuse

3. **Export Endpoints** (5 req/min):
   - Generates potentially large CSV/JSON files
   - More restrictive than queries
   - Still allows batch exports

**Key Generator Pattern**:

- Uses `request.user?.userId` when authenticated
- Falls back to `request.ip` for unauthenticated requests
- Ensures rate limiting is per-user, not global
- Prevents one user from blocking others

---

### Step 1A.3: Register Rate Limit Plugin

**Duration**: 20 minutes

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

**Configuration Notes**:

- `global: false` - Rate limiting is NOT applied to all routes automatically
- Each route must explicitly opt-in via route config
- This prevents accidentally rate limiting health checks, auth endpoints, etc.
- Default values are fallbacks only

**Why This Approach**:

- Explicit is better than implicit
- Prevents accidental rate limiting of critical endpoints
- Allows different limits per endpoint based on cost
- More maintainable - clear which endpoints are protected

---

### Step 1A.4: Apply Rate Limits to Endpoints

**Duration**: 1-2 hours

**Files to Modify**:

- `backend/src/routes/admin-usage.ts`

**Pattern for All Endpoints**:

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

#### Analytics Endpoints (10 req/min):

- [x] `POST /api/v1/admin/usage/analytics`
- [x] `POST /api/v1/admin/usage/user-breakdown`
- [x] `POST /api/v1/admin/usage/model-breakdown`
- [x] `POST /api/v1/admin/usage/provider-breakdown`

#### Cache Endpoints:

- [x] `POST /api/v1/admin/usage/refresh-today` - Use analytics limit
- [x] `POST /api/v1/admin/usage/rebuild-cache` - Use cacheRebuild limit (1/5min)

#### Export Endpoints:

- [x] `GET /api/v1/admin/usage/export` - Use export limit (5/min)

**Implementation Example (Complete)**:

```typescript
// Full example for one endpoint
fastify.post<{ Body: AdminUsageFilters }>('/analytics', {
  schema: {
    description: 'Get admin usage analytics with rate limiting',
    tags: ['admin', 'usage'],
    body: {
      type: 'object',
      required: ['startDate', 'endDate'],
      properties: {
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        userId: { type: 'string', format: 'uuid' },
        model: { type: 'string' },
        provider: { type: 'string' },
        apiKeyId: { type: 'string', format: 'uuid' },
      },
    },
    response: {
      200: {
        description: 'Analytics data',
        type: 'object',
        // ... schema
      },
      429: {
        description: 'Rate limit exceeded',
        type: 'object',
        properties: {
          statusCode: { type: 'number' },
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
  config: {
    rateLimit: getRateLimitConfig('analytics'),
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    const analytics = await adminUsageStatsService.getAnalytics(request.body);
    return reply.send(serializeDates(analytics));
  },
});
```

**Key Points**:

- Rate limit config added to route `config` object
- Applied BEFORE authentication (prevents auth bypass attempts)
- 429 response schema documented in OpenAPI
- Existing functionality unchanged

---

### Step 1A.5: Update Environment Variables

**Duration**: 15 minutes

**Files to Modify**:

- `backend/.env.example`
- `docs/deployment/configuration.md`

**Add to `.env.example`**:

```bash
# ============================================================================
# Rate Limiting Configuration
# ============================================================================

# Admin analytics endpoints rate limiting
# Prevents DoS attacks and abuse of expensive operations

# Analytics queries (GET analytics, breakdowns)
# Default: 10 requests per minute per user
ADMIN_ANALYTICS_RATE_LIMIT=10

# Cache rebuild operations
# Default: 1 request per 5 minutes per user (very restrictive)
# This operation is extremely expensive and should be used sparingly
ADMIN_CACHE_REBUILD_LIMIT=1

# Data exports (CSV/JSON generation)
# Default: 5 requests per minute per user
ADMIN_EXPORT_RATE_LIMIT=5
```

**Add to `docs/deployment/configuration.md`**:

```markdown
### Rate Limiting

Admin analytics endpoints are rate-limited to prevent abuse and ensure fair resource allocation.

| Variable                     | Default | Description                                   |
| ---------------------------- | ------- | --------------------------------------------- |
| `ADMIN_ANALYTICS_RATE_LIMIT` | `10`    | Max requests per minute for analytics queries |
| `ADMIN_CACHE_REBUILD_LIMIT`  | `1`     | Max requests per 5 minutes for cache rebuild  |
| `ADMIN_EXPORT_RATE_LIMIT`    | `5`     | Max requests per minute for data exports      |

**Rate Limit Scoping**:

- Limits are applied **per user** (using `userId` from JWT)
- For unauthenticated requests, limits are **per IP address**
- Limits are **independent** - each endpoint type has its own counter

**Tuning Guidelines**:

- **Low-traffic deployments** (< 10 admins): Use defaults
- **Medium-traffic deployments** (10-50 admins): Consider 2x defaults
- **High-traffic deployments** (> 50 admins): Monitor usage and adjust

**Warning**: Setting limits too high reduces DoS protection. Setting too low impacts legitimate usage.
```

---

### Step 1A.6: Add Integration Tests

**Duration**: 1.5-2 hours

**Files to Create**:

- `backend/tests/integration/rate-limit.test.ts`

**Complete Test Suite**:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../helpers/app';
import type { FastifyInstance } from 'fastify';

describe('Rate Limiting - Admin Analytics Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    adminToken = await getAdminToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const validFilters = {
    startDate: '2025-01-01',
    endDate: '2025-01-31',
  };

  describe('Analytics endpoints (10 req/min limit)', () => {
    it('should allow requests within rate limit', async () => {
      // Make 10 requests (at limit)
      const requests = Array(10)
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

      // All should succeed
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Make 15 requests (over limit)
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
      const rateLimited = responses.filter((r) => r.statusCode === 429);

      // At least some should be rate limited
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

      // Should be a number (seconds until retry)
      const retryAfter = parseInt(rateLimited?.headers['retry-after'] as string);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60); // Within 1 minute window
    });

    it('should include rate limit info in response headers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: validFilters,
      });

      // Check for X-RateLimit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
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

      // Wait for time window to pass (61 seconds for 1-minute window)
      await new Promise((resolve) => setTimeout(resolve, 61000));

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

  describe('Cache rebuild endpoint (1 req/5min limit)', () => {
    it('should have very restrictive rate limit', async () => {
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

      // Verify long retry-after (should be close to 5 minutes)
      const retryAfter = parseInt(response2.headers['retry-after'] as string);
      expect(retryAfter).toBeGreaterThan(250); // At least 4+ minutes
      expect(retryAfter).toBeLessThanOrEqual(300); // Max 5 minutes
    });
  });

  describe('Export endpoint (5 req/min limit)', () => {
    it('should allow 5 requests per minute', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'GET',
            url: '/api/v1/admin/usage/export',
            headers: { authorization: `Bearer ${adminToken}` },
            query: validFilters,
          }),
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });
    });

    it('should rate limit on 6th request', async () => {
      const requests = Array(6)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'GET',
            url: '/api/v1/admin/usage/export',
            headers: { authorization: `Bearer ${adminToken}` },
            query: validFilters,
          }),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.statusCode === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Different users', () => {
    it('should track rate limits per user, not globally', async () => {
      const admin1Token = await getAdminToken(app, 'admin1');
      const admin2Token = await getAdminToken(app, 'admin2');

      // Admin1 makes 10 requests (at limit)
      const admin1Requests = Array(10)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: { authorization: `Bearer ${admin1Token}` },
            payload: validFilters,
          }),
        );
      await Promise.all(admin1Requests);

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

  describe('Unauthenticated requests', () => {
    it('should rate limit by IP address when not authenticated', async () => {
      // Make requests without token
      const requests = Array(15)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: {
              'x-forwarded-for': '192.168.1.100', // Simulate IP
            },
            payload: validFilters,
          }),
        );

      const responses = await Promise.all(requests);

      // Should get 401 Unauthorized (auth required)
      // But rate limiting should still apply
      const rateLimited = responses.filter((r) => r.statusCode === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Error responses', () => {
    it('should return structured error for rate limit', async () => {
      // Exceed limit
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

      const body = JSON.parse(rateLimited!.body);
      expect(body.statusCode).toBe(429);
      expect(body.error).toBe('Too Many Requests');
      expect(body.message).toContain('Rate limit exceeded');
    });
  });
});
```

**Test Coverage**:

- ✅ Requests within limit succeed
- ✅ Requests over limit return 429
- ✅ Retry-After header included
- ✅ Rate limit resets after time window
- ✅ Different limits for different endpoints
- ✅ Per-user rate limiting (not global)
- ✅ IP-based limiting for unauthenticated
- ✅ Error response structure

---

### Step 1A.7: Update API Documentation

**Duration**: 30 minutes

**Files to Modify**:

- `docs/api/rest-api.md`
- OpenAPI/Swagger schemas in route files

**Add to `docs/api/rest-api.md`**:

````markdown
### Rate Limiting

All admin analytics endpoints are rate-limited to prevent abuse and ensure fair resource allocation.

#### Rate Limits by Endpoint Type

| Endpoint Type         | Endpoints                                                                                    | Limit       | Time Window |
| --------------------- | -------------------------------------------------------------------------------------------- | ----------- | ----------- |
| **Analytics Queries** | `/analytics`, `/user-breakdown`, `/model-breakdown`, `/provider-breakdown`, `/refresh-today` | 10 requests | 1 minute    |
| **Cache Rebuild**     | `/rebuild-cache`                                                                             | 1 request   | 5 minutes   |
| **Data Export**       | `/export`                                                                                    | 5 requests  | 1 minute    |

#### Rate Limit Behavior

**Scoping**:

- Rate limits are applied **per authenticated user** (by `userId`)
- For unauthenticated requests, limits are **per IP address**
- Each endpoint type has independent counters

**Response Headers**:

All responses include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1672531200
```
````

**When Limit Exceeded**:

When rate limit is exceeded, the API returns:

- **Status**: `429 Too Many Requests`
- **Header**: `Retry-After` indicating seconds until next request allowed
- **Body**: Error message with rate limit details

**Example 429 Response**:

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 45 seconds"
}
```

**Headers**:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1672531245
```

#### Configuration

Rate limits can be configured via environment variables:

| Variable                     | Default | Description                               |
| ---------------------------- | ------- | ----------------------------------------- |
| `ADMIN_ANALYTICS_RATE_LIMIT` | `10`    | Requests per minute for analytics queries |
| `ADMIN_CACHE_REBUILD_LIMIT`  | `1`     | Requests per 5 minutes for cache rebuild  |
| `ADMIN_EXPORT_RATE_LIMIT`    | `5`     | Requests per minute for data exports      |

#### Best Practices

**For API Clients**:

1. **Handle 429 responses gracefully**:

   ```typescript
   if (response.status === 429) {
     const retryAfter = response.headers.get('Retry-After');
     await sleep(parseInt(retryAfter) * 1000);
     return retry();
   }
   ```

2. **Monitor rate limit headers**:

   ```typescript
   const remaining = response.headers.get('X-RateLimit-Remaining');
   if (parseInt(remaining) < 2) {
     console.warn('Approaching rate limit');
   }
   ```

3. **Implement exponential backoff**:
   ```typescript
   const backoff = Math.min(1000 * Math.pow(2, retryCount), 30000);
   ```

**For Administrators**:

- Monitor rate limit hits in application logs
- Adjust limits based on usage patterns
- Consider higher limits for high-traffic deployments
- Use cache rebuild sparingly (very expensive operation)

````

**Add to OpenAPI Schema** (example):

```typescript
// In route schema
response: {
  200: {
    // ... success response
  },
  429: {
    description: 'Rate limit exceeded. Client should retry after the time specified in Retry-After header.',
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 429 },
      error: { type: 'string', example: 'Too Many Requests' },
      message: { type: 'string', example: 'Rate limit exceeded, retry in 45 seconds' },
    },
    headers: {
      'Retry-After': {
        description: 'Seconds until rate limit resets',
        schema: { type: 'integer', example: 45 },
      },
      'X-RateLimit-Limit': {
        description: 'Maximum requests allowed in time window',
        schema: { type: 'integer', example: 10 },
      },
      'X-RateLimit-Remaining': {
        description: 'Requests remaining in current window',
        schema: { type: 'integer', example: 0 },
      },
      'X-RateLimit-Reset': {
        description: 'Unix timestamp when rate limit resets',
        schema: { type: 'integer', example: 1672531245 },
      },
    },
  },
}
````

---

## Session 1A Deliverables

- [x] `@fastify/rate-limit` installed
- [x] Rate limit configuration module created (`rate-limit.config.ts`)
- [x] Rate limit plugin registered in application
- [x] All 7 admin analytics endpoints protected
- [x] Environment variables documented
- [x] Integration tests added and passing
- [x] API documentation updated
- [x] OpenAPI schemas updated

---

## Session 1A Acceptance Criteria

### Functional Requirements

- [x] All admin analytics endpoints have rate limiting
- [x] Different limits for different endpoint types:
  - Analytics: 10 req/min
  - Cache rebuild: 1 req/5min
  - Export: 5 req/min
- [x] Rate limit configuration via environment variables
- [x] Rate limiting applied per-user (not global)
- [x] Fallback to IP-based limiting for unauthenticated

### Technical Requirements

- [x] 429 responses include retry-after header
- [x] Response headers include rate limit info
- [x] Rate limit info in OpenAPI schema
- [x] Integration tests verify rate limiting works
- [x] All existing tests still pass
- [x] No TypeScript errors
- [x] Linter passes

### Documentation

- [x] Rate limits documented in API docs
- [x] Environment variables documented
- [x] Configuration tuning guidelines
- [x] Best practices for API clients

---

## Session 1A Validation

### Automated Tests

```bash
# Run rate limit tests
npm --prefix backend test rate-limit.test.ts

# Run all admin-usage tests
npm --prefix backend test -- admin-usage

# Run full test suite
npm --prefix backend test

# Type check
npm --prefix backend run type-check

# Lint
npm --prefix backend run lint
```

**Expected Results**:

- ✅ All rate limit tests pass
- ✅ All existing tests pass
- ✅ No type errors
- ✅ No lint errors

---

### Manual Testing

**Test 1: Analytics Endpoint Rate Limit**

```bash
# Make 15 requests rapidly
for i in {1..15}; do
  curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}' \
    -w "\nStatus: %{http_code}, Retry-After: %{header_retry_after}\n" \
    -s -o /dev/null
done
```

**Expected Result**:

- First 10 requests: `Status: 200`
- Requests 11-15: `Status: 429` with `Retry-After` header

---

**Test 2: Cache Rebuild Rate Limit**

```bash
# First request should succeed
curl -X POST http://localhost:8081/api/v1/admin/usage/rebuild-cache \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w "\nStatus: %{http_code}\n"

# Second immediate request should fail
curl -X POST http://localhost:8081/api/v1/admin/usage/rebuild-cache \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w "\nStatus: %{http_code}, Retry-After: %{header_retry_after}\n"
```

**Expected Result**:

- First request: `Status: 200`
- Second request: `Status: 429` with `Retry-After: ~300` (5 minutes)

---

**Test 3: Per-User Isolation**

```bash
# Admin 1 exceeds limit
for i in {1..11}; do
  curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
    -H "Authorization: Bearer $ADMIN1_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}' \
    -s -o /dev/null
done

# Admin 2 should still succeed
curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
  -H "Authorization: Bearer $ADMIN2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}' \
  -w "\nStatus: %{http_code}\n"
```

**Expected Result**:

- Admin 2 request: `Status: 200` (not affected by Admin 1's limit)

---

**Test 4: Rate Limit Headers**

```bash
curl -X POST http://localhost:8081/api/v1/admin/usage/analytics \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}' \
  -v 2>&1 | grep -i "x-ratelimit"
```

**Expected Result**:

```
< x-ratelimit-limit: 10
< x-ratelimit-remaining: 9
< x-ratelimit-reset: 1672531200
```

---

### Performance Validation

**Verify Minimal Overhead**:

```bash
# Benchmark without rate limiting (baseline from Phase 0)
# Compare with current performance

# Should see negligible overhead (< 5ms added latency)
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  -p filters.json -T application/json \
  http://localhost:8081/api/v1/admin/usage/analytics
```

**Expected Result**:

- Added latency: < 5ms
- Throughput: Maintained (requests/sec similar to baseline)

---

## Troubleshooting

### Issue: Rate limit not applied

**Symptoms**:

- Can make unlimited requests
- No 429 responses

**Diagnosis**:

```bash
# Check if plugin registered
grep "rateLimit" backend/src/app.ts

# Check route configuration
grep -A 5 "config:" backend/src/routes/admin-usage.ts
```

**Solution**:

- Verify `fastify.register(rateLimit, ...)` called
- Verify route has `config: { rateLimit: ... }`
- Check logs for plugin registration errors

---

### Issue: All users share same rate limit

**Symptoms**:

- Different users hit same rate limit counter
- User A's requests affect User B

**Diagnosis**:

```bash
# Check keyGenerator function
grep "keyGenerator" backend/src/config/rate-limit.config.ts
```

**Solution**:

- Verify `keyGenerator` uses `request.user?.userId`
- Ensure authentication runs before rate limiting
- Check JWT payload includes `userId`

---

### Issue: Rate limit too restrictive

**Symptoms**:

- Legitimate usage blocked
- Users complain about 429 errors

**Solution**:

```bash
# Increase limits via environment variables
ADMIN_ANALYTICS_RATE_LIMIT=20  # Double the default
ADMIN_EXPORT_RATE_LIMIT=10

# Restart application
npm run dev
```

**Monitor**:

- Check application logs for rate limit hits
- Adjust based on actual usage patterns
- Document changes in configuration

---

## Next Steps

**Next Session**: [Session 1B: Date Range Validation](phase-1-session-1b-date-validation.md)

**Before Next Session**:

- ✅ Verify all tests pass
- ✅ Commit changes
- ✅ Deploy to staging (if available)
- ✅ Monitor rate limit metrics

**Session 1B Preview**:

- Add date range size validation
- Prevent excessively large date ranges (> 90 days)
- Protect against performance issues
- Duration: 2-3 hours

---

## Session Summary Template

**After Completing This Session**:

```markdown
### Session 1A: Rate Limiting - Completed

**Date**: [YYYY-MM-DD]
**Actual Duration**: [X hours]
**Status**: ✅ Complete

**Deliverables**:

- ✅ Rate limiting implemented on all 7 endpoints
- ✅ Tests added and passing (15 test cases)
- ✅ Documentation updated
- ✅ Configuration via environment variables

**Metrics**:

- Lines of code added: ~500
- Test coverage: 100% of rate limiting logic
- Performance overhead: < 3ms

**Issues Encountered**: [None / List any]

**Next Session**: 1B - Date Range Validation
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Next Review**: After Session 1A completion

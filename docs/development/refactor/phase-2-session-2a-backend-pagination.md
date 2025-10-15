# Phase 2, Session 2A: Backend Pagination

**Phase**: 2 - High-Priority Operational Safeguards
**Session**: 2A
**Duration**: 3-4 hours
**Priority**: 🟡 HIGH
**Issue**: #6 - No Pagination on Breakdown Endpoints

---

## Navigation

- **Previous**: [Phase 1 Checkpoint](../admin-analytics-remediation-plan.md#phase-1-checkpoint-critical-issues-resolved)
- **Next**: [Phase 2, Session 2B: Frontend Pagination](./phase-2-session-2b-frontend-pagination.md)
- **Parent**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

### Problem Statement

The admin usage analytics breakdown endpoints currently return **all results** without pagination. This creates several critical issues:

1. **Performance**: Large result sets (thousands of users/models) can cause:
   - Slow API response times (multi-second delays)
   - High memory usage on backend
   - Network timeout for clients
   - Browser freezing on large data rendering

2. **User Experience**:
   - Users cannot efficiently navigate large datasets
   - No ability to sort/filter results
   - Poor performance on production-scale data

3. **Scalability**:
   - System cannot handle growth (10K+ users)
   - No way to limit resource consumption
   - Difficult to add features like search/filter

### Current Behavior

**Example**: User breakdown endpoint

```bash
POST /api/v1/admin/usage/user-breakdown
{
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}

# Response: ALL users (potentially thousands)
{
  "breakdown": [
    { "userId": "...", ... },  // User 1
    { "userId": "...", ... },  // User 2
    // ... 5,000+ more users
  ]
}
```

**Issues**:

- Response can be 5+ MB for large datasets
- Frontend receives all data at once
- No way to request specific page
- No sorting options

### Desired Behavior

**After Implementation**:

```bash
POST /api/v1/admin/usage/user-breakdown?page=1&limit=50&sortBy=totalTokens&sortOrder=desc
{
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}

# Response: Paginated with metadata
{
  "data": [
    { "userId": "...", ... },  // Top 50 users by tokens
    // ... 49 more
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 5234,
    "totalPages": 105,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

**Benefits**:

- Consistent response size (~50 records)
- Fast response time (< 100ms)
- Client-side navigation support
- Sorting capabilities

---

## Phase 2 Summary

Phase 2 focuses on **high-priority operational safeguards** that improve user experience and system scalability:

### Sessions

1. **Session 2A (This Session)**: Backend Pagination (3-4h)
   - Add pagination type definitions
   - Update schemas with pagination parameters
   - Modify service methods to support pagination
   - Update route handlers
   - Add comprehensive tests

2. **Session 2B**: Frontend Pagination (3-4h)
   - Add PatternFly Pagination components
   - Update API service calls
   - Add pagination state management
   - Update React Query integration

3. **Session 2C**: Error Handling Standardization (4-6h)
   - Audit all error handling
   - Standardize on `useErrorHandler` hook
   - Create error handling guide
   - Update code review checklist

### Phase 2 Success Criteria

- [ ] All breakdown endpoints support pagination
- [ ] Pagination metadata included in responses
- [ ] Sorting by all key metrics
- [ ] Frontend tables show paginated data
- [ ] Error handling consistent across all components
- [ ] All tests passing

---

## Session Objectives

1. **Add pagination support** to all admin usage breakdown endpoints
2. **Implement sorting** by key metrics (tokens, requests, cost)
3. **Add pagination metadata** to API responses
4. **Maintain backward compatibility** (optional pagination parameters)
5. **Add comprehensive tests** for pagination and sorting

### Endpoints to Update

- `POST /api/v1/admin/usage/user-breakdown`
- `POST /api/v1/admin/usage/model-breakdown`
- `POST /api/v1/admin/usage/provider-breakdown`

### Non-Goals (Out of Scope)

- ❌ Frontend pagination UI (Session 2B)
- ❌ Server-side filtering/search (Future enhancement)
- ❌ Cursor-based pagination (OFFSET/LIMIT is sufficient)
- ❌ Pagination on analytics endpoint (returns aggregated metrics, not lists)

---

## Pre-Session Checklist

Before starting this session, ensure:

- [ ] **Read Issue #6** from code review document
- [ ] **Review current API responses** - Test existing endpoints to understand data structure
- [ ] **Review PatternFly Pagination docs** - Understand what frontend will need
- [ ] **Check existing type definitions** - Review `backend/src/types/admin-usage.types.ts`
- [ ] **Plan default values** - Decide on default page size (recommended: 50)
- [ ] **Review existing service code** - Understand current breakdown logic

### Recommended Reading

- [PatternFly Pagination Component](https://www.patternfly.org/v6/components/pagination)
- [REST API Pagination Best Practices](https://www.moesif.com/blog/technical/api-design/REST-API-Design-Filtering-Sorting-and-Pagination/)
- Existing code: `backend/src/services/admin-usage-stats.service.ts`

---

## Implementation Steps

### Step 2A.1: Create Pagination Type Definitions (30 minutes)

#### Objective

Create reusable, type-safe pagination interfaces for consistent usage across all endpoints.

#### Files to Modify

- `backend/src/types/admin-usage.types.ts`

#### Implementation

```typescript
// backend/src/types/admin-usage.types.ts

/**
 * Pagination parameters for list endpoints
 *
 * @property page - Page number (1-indexed, default: 1)
 * @property limit - Items per page (default: 50, max: 200)
 * @property sortBy - Field to sort by
 * @property sortOrder - Sort direction
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page: number;

  /** Items per page (max: 200) */
  limit: number;

  /** Field to sort by (e.g., 'totalTokens', 'totalRequests') */
  sortBy: string;

  /** Sort direction */
  sortOrder: 'asc' | 'desc';
}

/**
 * Pagination metadata for paginated responses
 *
 * Provides information about the current page, total pages,
 * and navigation capabilities.
 */
export interface PaginationMetadata {
  /** Current page number (1-indexed) */
  page: number;

  /** Items per page */
  limit: number;

  /** Total number of items across all pages */
  total: number;

  /** Total number of pages */
  totalPages: number;

  /** Whether there is a next page */
  hasNext: boolean;

  /** Whether there is a previous page */
  hasPrevious: boolean;
}

/**
 * Generic paginated response wrapper
 *
 * Wraps any data array with pagination metadata.
 *
 * @template T - Type of data items
 */
export interface PaginatedResponse<T> {
  /** Data items for current page */
  data: T[];

  /** Pagination metadata */
  pagination: PaginationMetadata;
}

/**
 * Pagination defaults and limits
 */
export const PAGINATION_DEFAULTS = {
  /** Default page number */
  PAGE: 1,

  /** Default items per page */
  LIMIT: 50,

  /** Maximum items per page (prevent excessive resource usage) */
  MAX_LIMIT: 200,

  /** Default sort order */
  SORT_ORDER: 'desc' as const,
} as const;

/**
 * Valid sort fields for user breakdown
 */
export const USER_BREAKDOWN_SORT_FIELDS = [
  'username',
  'totalRequests',
  'totalTokens',
  'promptTokens',
  'completionTokens',
  'totalCost',
] as const;

export type UserBreakdownSortField = (typeof USER_BREAKDOWN_SORT_FIELDS)[number];

/**
 * Valid sort fields for model breakdown
 */
export const MODEL_BREAKDOWN_SORT_FIELDS = [
  'modelName',
  'totalRequests',
  'totalTokens',
  'promptTokens',
  'completionTokens',
  'totalCost',
] as const;

export type ModelBreakdownSortField = (typeof MODEL_BREAKDOWN_SORT_FIELDS)[number];

/**
 * Valid sort fields for provider breakdown
 */
export const PROVIDER_BREAKDOWN_SORT_FIELDS = [
  'providerName',
  'totalRequests',
  'totalTokens',
  'promptTokens',
  'completionTokens',
  'totalCost',
] as const;

export type ProviderBreakdownSortField = (typeof PROVIDER_BREAKDOWN_SORT_FIELDS)[number];
```

#### Validation

```bash
# Verify types compile
npm --prefix backend run typecheck

# Expected: No errors
```

---

### Step 2A.2: Create Pagination Utility Functions (45 minutes)

#### Objective

Create reusable utility functions for pagination logic to avoid code duplication.

#### Files to Create

- `backend/src/utils/pagination.utils.ts`

#### Implementation

```typescript
// backend/src/utils/pagination.utils.ts

import { ApplicationError } from './errors';
import {
  PaginationParams,
  PaginationMetadata,
  PaginatedResponse,
  PAGINATION_DEFAULTS,
} from '../types/admin-usage.types';

/**
 * Validate and normalize pagination parameters
 *
 * Ensures page/limit are within acceptable ranges and provides defaults.
 *
 * @param params - Raw pagination parameters from request
 * @returns Validated and normalized parameters
 * @throws ApplicationError if parameters are invalid
 */
export function validatePaginationParams(params: Partial<PaginationParams>): PaginationParams {
  const page = params.page ?? PAGINATION_DEFAULTS.PAGE;
  const limit = params.limit ?? PAGINATION_DEFAULTS.LIMIT;
  const sortBy = params.sortBy ?? 'totalTokens'; // Default sort by most impactful metric
  const sortOrder = params.sortOrder ?? PAGINATION_DEFAULTS.SORT_ORDER;

  // Validate page number
  if (page < 1) {
    throw ApplicationError.badRequest('Page number must be >= 1', {
      field: 'page',
      value: page,
    });
  }

  // Validate limit
  if (limit < 1) {
    throw ApplicationError.badRequest('Limit must be >= 1', {
      field: 'limit',
      value: limit,
    });
  }

  if (limit > PAGINATION_DEFAULTS.MAX_LIMIT) {
    throw ApplicationError.badRequest(`Limit must be <= ${PAGINATION_DEFAULTS.MAX_LIMIT}`, {
      field: 'limit',
      value: limit,
      max: PAGINATION_DEFAULTS.MAX_LIMIT,
    });
  }

  // Validate sort order
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw ApplicationError.badRequest('Sort order must be "asc" or "desc"', {
      field: 'sortOrder',
      value: sortOrder,
    });
  }

  return {
    page,
    limit,
    sortBy,
    sortOrder,
  };
}

/**
 * Validate sort field against allowed fields
 *
 * @param sortBy - Field to sort by
 * @param allowedFields - Array of allowed field names
 * @throws ApplicationError if field is not allowed
 */
export function validateSortField(sortBy: string, allowedFields: readonly string[]): void {
  if (!allowedFields.includes(sortBy)) {
    throw ApplicationError.badRequest(`Invalid sort field: ${sortBy}`, {
      field: 'sortBy',
      value: sortBy,
      allowedFields,
    });
  }
}

/**
 * Paginate an array of data
 *
 * Generic function to paginate any array with metadata generation.
 *
 * @template T - Type of data items
 * @param data - Full dataset to paginate
 * @param params - Pagination parameters
 * @returns Paginated response with metadata
 */
export function paginateArray<T>(data: T[], params: PaginationParams): PaginatedResponse<T> {
  const { page, limit } = params;

  // Calculate pagination values
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Slice data for current page
  const pageData = data.slice(offset, offset + limit);

  // Build metadata
  const metadata: PaginationMetadata = {
    page,
    limit,
    total,
    totalPages,
    hasNext: offset + limit < total,
    hasPrevious: page > 1,
  };

  return {
    data: pageData,
    pagination: metadata,
  };
}

/**
 * Generic sort function
 *
 * Sorts array by a specified field in ascending or descending order.
 *
 * @template T - Type of data items
 * @param data - Data to sort
 * @param sortBy - Field name to sort by
 * @param sortOrder - Sort direction
 * @returns Sorted array (new array, does not mutate input)
 */
export function sortArray<T>(data: T[], sortBy: keyof T, sortOrder: 'asc' | 'desc'): T[] {
  const sorted = [...data]; // Create copy to avoid mutation

  sorted.sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    // Handle undefined/null values
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;

    // Compare values
    let comparison = 0;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      // String comparison (case-insensitive)
      comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      // Number comparison
      comparison = aValue - bValue;
    } else {
      // Fallback: convert to string
      comparison = String(aValue).localeCompare(String(bValue));
    }

    // Apply sort order
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Combined sort and paginate helper
 *
 * Convenience function that sorts and paginates in one call.
 *
 * @template T - Type of data items
 * @param data - Data to sort and paginate
 * @param params - Pagination parameters
 * @returns Paginated response with sorted data
 */
export function sortAndPaginate<T>(data: T[], params: PaginationParams): PaginatedResponse<T> {
  // Sort first
  const sorted = sortArray(data, params.sortBy as keyof T, params.sortOrder);

  // Then paginate
  return paginateArray(sorted, params);
}
```

#### Unit Tests

```typescript
// backend/tests/unit/utils/pagination.utils.test.ts

import { describe, it, expect } from 'vitest';
import {
  validatePaginationParams,
  validateSortField,
  paginateArray,
  sortArray,
  sortAndPaginate,
} from '../../../src/utils/pagination.utils';
import { PAGINATION_DEFAULTS } from '../../../src/types/admin-usage.types';

describe('pagination.utils', () => {
  describe('validatePaginationParams', () => {
    it('should apply defaults for missing parameters', () => {
      const result = validatePaginationParams({});

      expect(result.page).toBe(PAGINATION_DEFAULTS.PAGE);
      expect(result.limit).toBe(PAGINATION_DEFAULTS.LIMIT);
      expect(result.sortOrder).toBe(PAGINATION_DEFAULTS.SORT_ORDER);
      expect(result.sortBy).toBe('totalTokens');
    });

    it('should accept valid parameters', () => {
      const result = validatePaginationParams({
        page: 2,
        limit: 100,
        sortBy: 'username',
        sortOrder: 'asc',
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(100);
      expect(result.sortBy).toBe('username');
      expect(result.sortOrder).toBe('asc');
    });

    it('should reject page < 1', () => {
      expect(() => {
        validatePaginationParams({ page: 0 });
      }).toThrow('Page number must be >= 1');
    });

    it('should reject limit < 1', () => {
      expect(() => {
        validatePaginationParams({ limit: 0 });
      }).toThrow('Limit must be >= 1');
    });

    it('should reject limit > MAX_LIMIT', () => {
      expect(() => {
        validatePaginationParams({ limit: 500 });
      }).toThrow(`Limit must be <= ${PAGINATION_DEFAULTS.MAX_LIMIT}`);
    });

    it('should reject invalid sort order', () => {
      expect(() => {
        validatePaginationParams({ sortOrder: 'invalid' as any });
      }).toThrow('Sort order must be "asc" or "desc"');
    });
  });

  describe('validateSortField', () => {
    const allowedFields = ['name', 'age', 'email'];

    it('should accept valid field', () => {
      expect(() => {
        validateSortField('name', allowedFields);
      }).not.toThrow();
    });

    it('should reject invalid field', () => {
      expect(() => {
        validateSortField('invalid', allowedFields);
      }).toThrow('Invalid sort field: invalid');
    });
  });

  describe('paginateArray', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    it('should paginate first page correctly', () => {
      const result = paginateArray(data, {
        page: 1,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(1);
      expect(result.data[9].id).toBe(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it('should paginate middle page correctly', () => {
      const result = paginateArray(data, {
        page: 5,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(41);
      expect(result.data[9].id).toBe(50);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should paginate last page correctly', () => {
      const result = paginateArray(data, {
        page: 10,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(91);
      expect(result.data[9].id).toBe(100);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should handle partial last page', () => {
      const shortData = Array.from({ length: 95 }, (_, i) => ({ id: i + 1 }));
      const result = paginateArray(shortData, {
        page: 10,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(5); // Only 5 items on last page
      expect(result.pagination.totalPages).toBe(10);
    });

    it('should handle empty array', () => {
      const result = paginateArray([], {
        page: 1,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
    });
  });

  describe('sortArray', () => {
    const data = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 35 },
    ];

    it('should sort by string field ascending', () => {
      const result = sortArray(data, 'name', 'asc');

      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Charlie');
    });

    it('should sort by string field descending', () => {
      const result = sortArray(data, 'name', 'desc');

      expect(result[0].name).toBe('Charlie');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Alice');
    });

    it('should sort by number field ascending', () => {
      const result = sortArray(data, 'age', 'asc');

      expect(result[0].age).toBe(25);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(35);
    });

    it('should sort by number field descending', () => {
      const result = sortArray(data, 'age', 'desc');

      expect(result[0].age).toBe(35);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(25);
    });

    it('should not mutate original array', () => {
      const original = [...data];
      sortArray(data, 'name', 'asc');

      expect(data).toEqual(original);
    });
  });

  describe('sortAndPaginate', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      score: Math.random() * 100,
    }));

    it('should sort and paginate in one call', () => {
      const result = sortAndPaginate(data, {
        page: 1,
        limit: 10,
        sortBy: 'score',
        sortOrder: 'desc',
      });

      expect(result.data).toHaveLength(10);
      expect(result.pagination.total).toBe(50);

      // Verify sorting (descending)
      for (let i = 0; i < result.data.length - 1; i++) {
        expect(result.data[i].score).toBeGreaterThanOrEqual(result.data[i + 1].score);
      }
    });
  });
});
```

#### Validation

```bash
# Run tests
npm --prefix backend test pagination.utils.test.ts

# Expected: All tests passing
```

---

### Step 2A.3: Update Service Methods with Pagination (1.5-2 hours)

#### Objective

Modify the admin usage service to support pagination on all breakdown methods.

#### Files to Modify

- `backend/src/services/admin-usage-stats.service.ts` (or refactored equivalent)

#### Implementation

**User Breakdown with Pagination:**

```typescript
// backend/src/services/admin-usage-stats.service.ts

import {
  PaginationParams,
  PaginatedResponse,
  UserBreakdown,
  USER_BREAKDOWN_SORT_FIELDS,
} from '../types/admin-usage.types';
import {
  validatePaginationParams,
  validateSortField,
  sortAndPaginate,
} from '../utils/pagination.utils';

export class AdminUsageStatsService extends BaseService {
  /**
   * Get user breakdown with pagination
   *
   * @param filters - Date range and filter criteria
   * @param paginationParams - Pagination parameters (optional)
   * @returns Paginated user breakdown data
   */
  async getUserBreakdown(
    filters: AdminUsageFilters,
    paginationParams?: Partial<PaginationParams>,
  ): Promise<PaginatedResponse<UserBreakdown>> {
    try {
      // Validate and normalize pagination params
      const pagination = validatePaginationParams(paginationParams || {});

      // Validate sort field
      validateSortField(pagination.sortBy, USER_BREAKDOWN_SORT_FIELDS);

      this.fastify.log.info(
        {
          filters,
          pagination,
        },
        'Getting user breakdown with pagination',
      );

      // Get ALL user breakdown data (existing logic)
      const allUsers = await this.getUserBreakdownInternal(filters);

      this.fastify.log.debug({ totalUsers: allUsers.length }, 'Retrieved all user breakdown data');

      // Sort and paginate
      const result = sortAndPaginate(allUsers, pagination);

      this.fastify.log.info(
        {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          returned: result.data.length,
        },
        'Returning paginated user breakdown',
      );

      return result;
    } catch (error) {
      this.fastify.log.error({ error, filters, paginationParams }, 'Failed to get user breakdown');
      throw ApplicationError.internal('Failed to get user breakdown', { error });
    }
  }

  /**
   * Internal method: Get all user breakdown data (no pagination)
   *
   * This is the existing logic, extracted to a separate method
   * so pagination can be applied on top.
   *
   * @param filters - Date range and filter criteria
   * @returns All user breakdown records
   */
  private async getUserBreakdownInternal(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    // Existing logic from getUserBreakdown()
    // This method should return ALL results without pagination

    // Example (simplified):
    const aggregatedData = await this.getAggregatedUsageData(filters);
    const enrichedData = await this.enrichmentService.enrichWithUserData(aggregatedData);

    // Convert to UserBreakdown array
    const breakdown: UserBreakdown[] = Object.entries(enrichedData).map(([userId, data]) => ({
      userId: data.userId,
      username: data.username,
      email: data.email,
      totalRequests: data.totalRequests,
      totalTokens: data.totalTokens,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalCost: data.totalCost,
    }));

    return breakdown;
  }
}
```

**Model Breakdown with Pagination:**

```typescript
/**
 * Get model breakdown with pagination
 *
 * @param filters - Date range and filter criteria
 * @param paginationParams - Pagination parameters (optional)
 * @returns Paginated model breakdown data
 */
async getModelBreakdown(
  filters: AdminUsageFilters,
  paginationParams?: Partial<PaginationParams>
): Promise<PaginatedResponse<ModelBreakdown>> {
  try {
    const pagination = validatePaginationParams(paginationParams || {});
    validateSortField(pagination.sortBy, MODEL_BREAKDOWN_SORT_FIELDS);

    this.fastify.log.info({ filters, pagination }, 'Getting model breakdown');

    // Get all model data
    const allModels = await this.getModelBreakdownInternal(filters);

    // Sort and paginate
    const result = sortAndPaginate(allModels, pagination);

    this.fastify.log.info(
      {
        page: result.pagination.page,
        total: result.pagination.total,
        returned: result.data.length,
      },
      'Returning paginated model breakdown'
    );

    return result;
  } catch (error) {
    this.fastify.log.error({ error, filters }, 'Failed to get model breakdown');
    throw ApplicationError.internal('Failed to get model breakdown', { error });
  }
}

private async getModelBreakdownInternal(
  filters: AdminUsageFilters
): Promise<ModelBreakdown[]> {
  // Existing model breakdown logic
  // Returns all models without pagination
  // ...
}
```

**Provider Breakdown with Pagination:**

```typescript
/**
 * Get provider breakdown with pagination
 *
 * @param filters - Date range and filter criteria
 * @param paginationParams - Pagination parameters (optional)
 * @returns Paginated provider breakdown data
 */
async getProviderBreakdown(
  filters: AdminUsageFilters,
  paginationParams?: Partial<PaginationParams>
): Promise<PaginatedResponse<ProviderBreakdown>> {
  try {
    const pagination = validatePaginationParams(paginationParams || {});
    validateSortField(pagination.sortBy, PROVIDER_BREAKDOWN_SORT_FIELDS);

    this.fastify.log.info({ filters, pagination }, 'Getting provider breakdown');

    // Get all provider data
    const allProviders = await this.getProviderBreakdownInternal(filters);

    // Sort and paginate
    const result = sortAndPaginate(allProviders, pagination);

    this.fastify.log.info(
      {
        page: result.pagination.page,
        total: result.pagination.total,
        returned: result.data.length,
      },
      'Returning paginated provider breakdown'
    );

    return result;
  } catch (error) {
    this.fastify.log.error(
      { error, filters },
      'Failed to get provider breakdown'
    );
    throw ApplicationError.internal('Failed to get provider breakdown', { error });
  }
}

private async getProviderBreakdownInternal(
  filters: AdminUsageFilters
): Promise<ProviderBreakdown[]> {
  // Existing provider breakdown logic
  // Returns all providers without pagination
  // ...
}
```

#### Validation

```bash
# Run service tests
npm --prefix backend test admin-usage-stats.service.test.ts

# Expected: Existing tests may need updates for new pagination parameter
```

---

### Step 2A.4: Update Route Handlers with Query Parameters (1 hour)

#### Objective

Update route handlers to accept pagination query parameters and pass them to service methods.

#### Files to Modify

- `backend/src/routes/admin-usage.ts`

#### Implementation

```typescript
// backend/src/routes/admin-usage.ts

import { FastifyInstance, FastifyRequest } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { AdminUsageFilters } from '../types/admin-usage.types';

// Schema for pagination query parameters
const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  sortBy: Type.Optional(Type.String({ default: 'totalTokens' })),
  sortOrder: Type.Optional(
    Type.Union([Type.Literal('asc'), Type.Literal('desc')], { default: 'desc' }),
  ),
});

type PaginationQuery = Static<typeof PaginationQuerySchema>;

export default async function adminUsageRoutes(fastify: FastifyInstance) {
  const adminUsageService = fastify.diContainer.resolve('adminUsageStatsService');

  /**
   * POST /api/v1/admin/usage/user-breakdown
   *
   * Get user breakdown with pagination
   */
  fastify.post<{
    Body: AdminUsageFilters;
    Querystring: PaginationQuery;
  }>(
    '/user-breakdown',
    {
      schema: {
        description: 'Get paginated user breakdown for admin analytics',
        tags: ['Admin', 'Usage'],
        body: AdminUsageFiltersSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: Type.Object({
            data: Type.Array(UserBreakdownSchema),
            pagination: Type.Object({
              page: Type.Integer(),
              limit: Type.Integer(),
              total: Type.Integer(),
              totalPages: Type.Integer(),
              hasNext: Type.Boolean(),
              hasPrevious: Type.Boolean(),
            }),
          }),
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    },
    async (request, reply) => {
      const filters = request.body;
      const pagination = request.query;

      const result = await adminUsageService.getUserBreakdown(filters, pagination);

      return reply.send(result);
    },
  );

  /**
   * POST /api/v1/admin/usage/model-breakdown
   *
   * Get model breakdown with pagination
   */
  fastify.post<{
    Body: AdminUsageFilters;
    Querystring: PaginationQuery;
  }>(
    '/model-breakdown',
    {
      schema: {
        description: 'Get paginated model breakdown for admin analytics',
        tags: ['Admin', 'Usage'],
        body: AdminUsageFiltersSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: Type.Object({
            data: Type.Array(ModelBreakdownSchema),
            pagination: Type.Object({
              page: Type.Integer(),
              limit: Type.Integer(),
              total: Type.Integer(),
              totalPages: Type.Integer(),
              hasNext: Type.Boolean(),
              hasPrevious: Type.Boolean(),
            }),
          }),
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    },
    async (request, reply) => {
      const filters = request.body;
      const pagination = request.query;

      const result = await adminUsageService.getModelBreakdown(filters, pagination);

      return reply.send(result);
    },
  );

  /**
   * POST /api/v1/admin/usage/provider-breakdown
   *
   * Get provider breakdown with pagination
   */
  fastify.post<{
    Body: AdminUsageFilters;
    Querystring: PaginationQuery;
  }>(
    '/provider-breakdown',
    {
      schema: {
        description: 'Get paginated provider breakdown for admin analytics',
        tags: ['Admin', 'Usage'],
        body: AdminUsageFiltersSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: Type.Object({
            data: Type.Array(ProviderBreakdownSchema),
            pagination: Type.Object({
              page: Type.Integer(),
              limit: Type.Integer(),
              total: Type.Integer(),
              totalPages: Type.Integer(),
              hasNext: Type.Boolean(),
              hasPrevious: Type.Boolean(),
            }),
          }),
        },
      },
      preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    },
    async (request, reply) => {
      const filters = request.body;
      const pagination = request.query;

      const result = await adminUsageService.getProviderBreakdown(filters, pagination);

      return reply.send(result);
    },
  );
}
```

#### Validation

```bash
# Test endpoint manually
curl -X POST http://localhost:8081/api/v1/admin/usage/user-breakdown?page=1&limit=10&sortBy=totalTokens&sortOrder=desc \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}'

# Expected: 200 response with pagination metadata
```

---

### Step 2A.5: Add Integration Tests (1 hour)

#### Objective

Add comprehensive integration tests for pagination and sorting functionality.

#### Files to Create

- `backend/tests/integration/admin-usage-pagination.test.ts`

#### Implementation

```typescript
// backend/tests/integration/admin-usage-pagination.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../helpers/app';
import { createTestUser, createTestAdminUser } from '../helpers/users';
import { FastifyInstance } from 'fastify';

describe('Admin Usage Pagination', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await build();
    const admin = await createTestAdminUser(app);
    adminToken = admin.token;

    // Create test data: 150 users with usage
    for (let i = 1; i <= 150; i++) {
      await createTestUser(app, {
        username: `user-${i}`,
        usage: {
          totalRequests: i * 10,
          totalTokens: i * 1000,
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Breakdown Pagination', () => {
    it('should return first page with default limit (50)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data).toHaveLength(50);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 150,
        totalPages: 3,
        hasNext: true,
        hasPrevious: false,
      });
    });

    it('should return specified page', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?page=2&limit=50',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data).toHaveLength(50);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.hasNext).toBe(true);
      expect(body.pagination.hasPrevious).toBe(true);
    });

    it('should return last page with correct count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?page=3&limit=50',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data).toHaveLength(50); // Last 50 users
      expect(body.pagination.page).toBe(3);
      expect(body.pagination.hasNext).toBe(false);
      expect(body.pagination.hasPrevious).toBe(true);
    });

    it('should respect custom limit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?limit=25',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data).toHaveLength(25);
      expect(body.pagination.limit).toBe(25);
      expect(body.pagination.totalPages).toBe(6); // 150 / 25 = 6
    });

    it('should reject limit > 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?limit=500',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('Limit must be <= 200');
    });

    it('should reject page < 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?page=0',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('Page number must be >= 1');
    });
  });

  describe('Sorting', () => {
    it('should sort by totalTokens descending (default)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // First user should have highest tokens
      expect(body.data[0].username).toBe('user-150');
      expect(body.data[0].totalTokens).toBe(150000);

      // Verify descending order
      for (let i = 0; i < body.data.length - 1; i++) {
        expect(body.data[i].totalTokens).toBeGreaterThanOrEqual(body.data[i + 1].totalTokens);
      }
    });

    it('should sort by username ascending', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?sortBy=username&sortOrder=asc&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // First user should be alphabetically first
      expect(body.data[0].username).toBe('user-1');

      // Verify ascending order
      for (let i = 0; i < body.data.length - 1; i++) {
        expect(body.data[i].username.localeCompare(body.data[i + 1].username)).toBeLessThanOrEqual(
          0,
        );
      }
    });

    it('should sort by totalRequests descending', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?sortBy=totalRequests&sortOrder=desc&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data[0].totalRequests).toBe(1500); // user-150 has 150 * 10 = 1500

      // Verify descending order
      for (let i = 0; i < body.data.length - 1; i++) {
        expect(body.data[i].totalRequests).toBeGreaterThanOrEqual(body.data[i + 1].totalRequests);
      }
    });

    it('should reject invalid sort field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?sortBy=invalidField',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('Invalid sort field');
    });

    it('should reject invalid sort order', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown?sortOrder=invalid',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('Sort order must be "asc" or "desc"');
    });
  });

  describe('Model Breakdown Pagination', () => {
    it('should paginate model breakdown', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/model-breakdown?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
    });
  });

  describe('Provider Breakdown Pagination', () => {
    it('should paginate provider breakdown', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/provider-breakdown?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
    });
  });

  describe('Empty Results', () => {
    it('should handle empty results gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/user-breakdown',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2099-01-01', // Future date with no data
          endDate: '2099-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data).toHaveLength(0);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      });
    });
  });
});
```

#### Validation

```bash
# Run integration tests
npm --prefix backend test admin-usage-pagination.test.ts

# Expected: All tests passing
```

---

### Step 2A.6: Update API Documentation (30 minutes)

#### Objective

Document the new pagination parameters and response format in the API documentation.

#### Files to Modify

- `docs/api/rest-api.md`
- OpenAPI/Swagger auto-generated docs (via schemas in routes)

#### Implementation

**Add to REST API Documentation:**

````markdown
## Admin Usage Breakdown Endpoints

All breakdown endpoints now support pagination, sorting, and filtering.

### Common Query Parameters

All breakdown endpoints accept the following query parameters:

| Parameter   | Type    | Default       | Description                                        |
| ----------- | ------- | ------------- | -------------------------------------------------- |
| `page`      | integer | 1             | Page number (1-indexed)                            |
| `limit`     | integer | 50            | Items per page (max: 200)                          |
| `sortBy`    | string  | `totalTokens` | Field to sort by (see allowed fields per endpoint) |
| `sortOrder` | string  | `desc`        | Sort direction: `asc` or `desc`                    |

### Common Response Format

All paginated endpoints return:

```json
{
  "data": [...],  // Array of breakdown items
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5,
    "hasNext": true,
    "hasPrevious": false
  }
}
```
````

---

### POST /api/v1/admin/usage/user-breakdown

Get paginated breakdown of usage by user.

**Authentication**: Required (admin or adminReadonly)

**Request Body**:

```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "models": ["gpt-4", "claude-3"], // Optional
  "providers": ["openai"], // Optional
  "apiKeys": ["key1", "key2"] // Optional
}
```

**Query Parameters**:

- All common pagination parameters (see above)
- **Allowed `sortBy` values**:
  - `username` - Sort by username (alphabetical)
  - `totalRequests` - Sort by total request count
  - `totalTokens` - Sort by total token count (default)
  - `promptTokens` - Sort by prompt tokens
  - `completionTokens` - Sort by completion tokens
  - `totalCost` - Sort by total cost

**Example Request**:

```bash
POST /api/v1/admin/usage/user-breakdown?page=1&limit=50&sortBy=totalTokens&sortOrder=desc
```

**Example Response**:

```json
{
  "data": [
    {
      "userId": "uuid",
      "username": "john.doe",
      "email": "john@example.com",
      "totalRequests": 1250,
      "totalTokens": 45000,
      "promptTokens": 30000,
      "completionTokens": 15000,
      "totalCost": 12.5
    }
    // ... 49 more users
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

### POST /api/v1/admin/usage/model-breakdown

Get paginated breakdown of usage by model.

**Allowed `sortBy` values**:

- `modelName` - Sort by model name (alphabetical)
- `totalRequests` - Sort by total request count
- `totalTokens` - Sort by total token count (default)
- `promptTokens` - Sort by prompt tokens
- `completionTokens` - Sort by completion tokens
- `totalCost` - Sort by total cost

**Other parameters**: Same as user breakdown endpoint

---

### POST /api/v1/admin/usage/provider-breakdown

Get paginated breakdown of usage by provider.

**Allowed `sortBy` values**:

- `providerName` - Sort by provider name (alphabetical)
- `totalRequests` - Sort by total request count
- `totalTokens` - Sort by total token count (default)
- `promptTokens` - Sort by prompt tokens
- `completionTokens` - Sort by completion tokens
- `totalCost` - Sort by total cost

**Other parameters**: Same as user breakdown endpoint

---

### Error Responses

**400 Bad Request** - Invalid pagination parameters:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Page number must be >= 1",
  "details": {
    "field": "page",
    "value": 0
  }
}
```

**400 Bad Request** - Invalid sort field:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid sort field: invalidField",
  "details": {
    "field": "sortBy",
    "value": "invalidField",
    "allowedFields": ["username", "totalRequests", "totalTokens", ...]
  }
}
```

---

### Best Practices

1. **Use appropriate page sizes**:
   - Small tables: `limit=25`
   - Medium tables: `limit=50` (default)
   - Large tables: `limit=100`
   - Never exceed: `limit=200`

2. **Always sort by a meaningful field**:
   - Default (`totalTokens`) shows highest-impact users/models
   - Sort by `username`/`modelName` for alphabetical navigation

3. **Handle pagination metadata**:
   - Use `hasNext`/`hasPrevious` to enable/disable navigation buttons
   - Use `totalPages` to show page count
   - Use `total` to show "Showing X-Y of Z results"

4. **Performance considerations**:
   - Smaller page sizes = faster response times
   - Sorting is in-memory (fast for < 10K records)
   - Results are cached per date range

````

#### Validation

```bash
# Verify OpenAPI docs updated
curl http://localhost:8081/docs

# Expected: Pagination parameters visible in Swagger UI
````

---

## Deliverables

After completing this session, you should have:

- [ ] **Type definitions** for pagination (`PaginationParams`, `PaginatedResponse`, etc.)
- [ ] **Pagination utilities** for validation, sorting, and pagination
- [ ] **Service methods updated** to support pagination on all breakdown endpoints
- [ ] **Route handlers updated** with query parameter schemas
- [ ] **Integration tests** for pagination and sorting
- [ ] **API documentation** updated with pagination details

### Files Created

- `backend/src/utils/pagination.utils.ts` (~300 lines)
- `backend/tests/unit/utils/pagination.utils.test.ts` (~200 lines)
- `backend/tests/integration/admin-usage-pagination.test.ts` (~300 lines)

### Files Modified

- `backend/src/types/admin-usage.types.ts` (~100 lines added)
- `backend/src/services/admin-usage-stats.service.ts` (~150 lines modified)
- `backend/src/routes/admin-usage.ts` (~100 lines modified)
- `docs/api/rest-api.md` (~150 lines added)

### Metrics

- **Lines of Code Added**: ~1,300
- **Test Coverage**: 95%+ for pagination utilities
- **API Response Size**: Reduced from 5+ MB to < 100 KB (typical)
- **Response Time**: < 100ms for paginated queries

---

## Acceptance Criteria

Verify all criteria before marking session complete:

- [ ] **Type Safety**: All pagination types defined and exported
- [ ] **Validation**: Invalid page/limit/sortBy/sortOrder parameters rejected with 400
- [ ] **Default Values**: Missing parameters use sensible defaults (page=1, limit=50, sortOrder=desc)
- [ ] **Sorting**: All allowed sort fields work correctly (asc and desc)
- [ ] **Metadata**: Pagination metadata accurate (total, totalPages, hasNext, hasPrevious)
- [ ] **Backward Compatibility**: Endpoints work with and without pagination parameters
- [ ] **Unit Tests**: All pagination utility tests passing
- [ ] **Integration Tests**: All pagination endpoint tests passing
- [ ] **No Regression**: All existing tests still passing
- [ ] **Documentation**: API docs updated and accurate
- [ ] **TypeScript**: No TypeScript errors (`npm run typecheck`)
- [ ] **Linter**: No linting errors (`npm run lint`)

### Quality Gates

**Before committing**:

```bash
# All tests must pass
npm --prefix backend test

# No TypeScript errors
npm --prefix backend run typecheck

# No linting errors
npm --prefix backend run lint

# Manual smoke test
curl -X POST "http://localhost:8081/api/v1/admin/usage/user-breakdown?page=1&limit=10&sortBy=totalTokens&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}'
```

---

## Validation

### Unit Test Validation

```bash
# Run pagination utility tests
npm --prefix backend test pagination.utils.test.ts

# Expected output:
# ✓ pagination.utils (10 tests)
#   ✓ validatePaginationParams (6 tests)
#   ✓ validateSortField (2 tests)
#   ✓ paginateArray (5 tests)
#   ✓ sortArray (5 tests)
#   ✓ sortAndPaginate (1 test)
#
# Test Files  1 passed (1)
# Tests  19 passed (19)
```

### Integration Test Validation

```bash
# Run pagination integration tests
npm --prefix backend test admin-usage-pagination.test.ts

# Expected output:
# ✓ Admin Usage Pagination (15+ tests)
#   ✓ User Breakdown Pagination (7 tests)
#   ✓ Sorting (5 tests)
#   ✓ Model Breakdown Pagination (1 test)
#   ✓ Provider Breakdown Pagination (1 test)
#   ✓ Empty Results (1 test)
#
# Test Files  1 passed (1)
# Tests  15 passed (15)
```

### Manual Testing Checklist

**Test each endpoint with various parameters:**

1. **Default pagination** (no parameters):

   ```bash
   curl -X POST http://localhost:8081/api/v1/admin/usage/user-breakdown \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}'
   ```
   - ✅ Returns 50 items (or less if total < 50)
   - ✅ Pagination metadata present and accurate
   - ✅ Sorted by `totalTokens` descending

2. **Custom page and limit**:

   ```bash
   curl -X POST "http://localhost:8081/api/v1/admin/usage/user-breakdown?page=2&limit=25" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}'
   ```
   - ✅ Returns items 26-50
   - ✅ `page=2`, `limit=25` in metadata
   - ✅ `hasPrevious=true`

3. **Sorting variations**:

   ```bash
   # Sort by username ascending
   curl -X POST "http://localhost:8081/api/v1/admin/usage/user-breakdown?sortBy=username&sortOrder=asc" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}'
   ```
   - ✅ Results sorted alphabetically by username
   - ✅ First user has lowest alphabetical username

4. **Error cases**:
   ```bash
   # Invalid page
   curl -X POST "http://localhost:8081/api/v1/admin/usage/user-breakdown?page=0" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"startDate":"2025-01-01","endDate":"2025-01-31"}'
   ```
   - ✅ Returns 400 Bad Request
   - ✅ Error message: "Page number must be >= 1"

### Performance Validation

**Test with realistic data volume:**

```bash
# Create test script to measure response time
cat > test-pagination-performance.sh << 'EOF'
#!/bin/bash

TOKEN="your-admin-token"

echo "Testing pagination performance..."

for limit in 10 50 100 200; do
  echo "Limit: $limit"
  time curl -X POST "http://localhost:8081/api/v1/admin/usage/user-breakdown?limit=$limit" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"startDate":"2025-01-01","endDate":"2025-12-31"}' \
    -s -o /dev/null -w "Response time: %{time_total}s\n"
  echo ""
done
EOF

chmod +x test-pagination-performance.sh
./test-pagination-performance.sh
```

**Expected Results**:

- `limit=10`: < 50ms
- `limit=50`: < 100ms
- `limit=100`: < 150ms
- `limit=200`: < 200ms

---

## Next Steps

After completing and validating this session:

1. **Commit changes**:

   ```bash
   git add .
   git commit -m "feat: add pagination support to admin usage breakdown endpoints

   - Add pagination type definitions and utilities
   - Update service methods to support pagination and sorting
   - Update route handlers with query parameter schemas
   - Add comprehensive integration and unit tests
   - Update API documentation

   Implements Issue #6: No Pagination on Breakdown Endpoints
   Phase 2, Session 2A of remediation plan"
   ```

2. **Proceed to Session 2B**: Frontend Pagination
   - Add PatternFly Pagination components
   - Update React Query hooks to use pagination parameters
   - Add pagination state management
   - Update UI to show pagination controls

3. **Update Progress Tracker**:
   - Mark Session 2A as complete
   - Record actual time vs. estimate
   - Note any discoveries or blockers

---

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot read property 'length' of undefined"

- **Cause**: Service method not returning array
- **Solution**: Ensure `getUserBreakdownInternal()` returns `UserBreakdown[]`, not `undefined`

**Issue**: Sorting not working correctly

- **Cause**: Sort field name mismatch
- **Solution**: Verify `sortBy` matches actual field names in data (case-sensitive)

**Issue**: TypeScript error "Property 'sortBy' does not exist on type"

- **Cause**: Missing type annotation
- **Solution**: Ensure `sortBy` is typed as `keyof T` in `sortArray()`

**Issue**: Performance degradation with large datasets

- **Cause**: In-memory sorting of large arrays
- **Solution**: For > 10K records, consider database-level pagination (future enhancement)

**Issue**: Pagination metadata incorrect

- **Cause**: Offset calculation bug
- **Solution**: Verify offset = `(page - 1) * limit` (not `page * limit`)

---

## Session Summary Template

**Copy after completion:**

```markdown
### Session 2A: Backend Pagination

**Date**: YYYY-MM-DD
**Duration**: X hours (estimated: 3-4 hours)
**Status**: ✅ Complete

#### Completed

- [x] Created pagination type definitions
- [x] Created pagination utility functions
- [x] Updated service methods with pagination
- [x] Updated route handlers with query parameters
- [x] Added integration tests
- [x] Updated API documentation

#### Metrics

- Files created: 3
- Files modified: 4
- Lines added: ~1,300
- Tests added: 34
- Test coverage: 96%

#### Discoveries

- [List any unexpected findings or learnings]

#### Next Session

- Session 2B: Frontend Pagination (3-4 hours)
```

---

**End of Session 2A Documentation**

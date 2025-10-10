# Phase 2, Session 2B: Frontend Pagination

**Phase**: 2 - High-Priority Operational Safeguards
**Session**: 2B
**Duration**: 3-4 hours
**Priority**: 🟡 HIGH
**Issue**: #6 - No Pagination on Breakdown Endpoints (Frontend Component)

---

## Navigation

- **Previous**: [Phase 2, Session 2A: Backend Pagination](./phase-2-session-2a-backend-pagination.md)
- **Next**: [Phase 2, Session 2C: Error Handling Standardization](./phase-2-session-2c-error-handling.md)
- **Parent**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

### Problem Statement

With backend pagination now implemented (Session 2A), the frontend must be updated to:

1. **Request paginated data** from the backend
2. **Display pagination controls** using PatternFly 6 components
3. **Manage pagination state** (page, limit, sort)
4. **Update React Query hooks** to include pagination parameters

### Current Behavior

**Before**:

- Frontend requests all data at once
- No pagination controls in UI
- Large tables render thousands of rows
- Browser can freeze on large datasets

**Example Current Code**:

```typescript
// Current implementation (no pagination)
const { data: userBreakdown } = useQuery(
  ['userBreakdown', filters],
  () => adminUsageService.getUserBreakdown(filters)
);

// Renders ALL users in table
<Table>
  {userBreakdown?.map(user => <Tr key={user.userId}>...</Tr>)}
</Table>
```

**Issues**:

- Renders 1,000+ rows at once
- No way to navigate results
- No sorting controls
- Poor performance

### Desired Behavior

**After Implementation**:

```typescript
// New implementation with pagination
const [page, setPage] = useState(1);
const [perPage, setPerPage] = useState(50);
const [sortBy, setSortBy] = useState('totalTokens');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

const { data: response } = useQuery(
  ['userBreakdown', filters, page, perPage, sortBy, sortOrder],
  () => adminUsageService.getUserBreakdown(filters, { page, limit: perPage, sortBy, sortOrder })
);

// Renders only current page (50 users)
<Table>
  {response?.data.map(user => <Tr key={user.userId}>...</Tr>)}
</Table>

<Pagination
  itemCount={response?.pagination.total || 0}
  page={page}
  perPage={perPage}
  onSetPage={(_, newPage) => setPage(newPage)}
  onPerPageSelect={(_, newPerPage) => setPerPage(newPerPage)}
/>
```

**Benefits**:

- Fast rendering (only 50 rows)
- User-friendly navigation
- Sorting capabilities
- Responsive UI

---

## Session Objectives

1. **Update API service** to include pagination parameters
2. **Add PatternFly Pagination components** to breakdown tables
3. **Implement pagination state management** (page, limit, sort)
4. **Update React Query hooks** to cache by pagination parameters
5. **Add sorting controls** to table headers
6. **Ensure i18n support** for pagination labels

### Components to Update

- `frontend/src/pages/AdminUsagePage.tsx` - Main page with breakdown tabs
- `frontend/src/components/admin/UserBreakdownTable.tsx` - User breakdown table
- `frontend/src/components/admin/ModelBreakdownTable.tsx` - Model breakdown table
- `frontend/src/components/admin/ProviderBreakdownTable.tsx` - Provider breakdown table
- `frontend/src/services/admin-usage.service.ts` - API service

### Non-Goals (Out of Scope)

- ❌ Server-side filtering/search (Future enhancement)
- ❌ Advanced table features (column resizing, etc.)
- ❌ Export pagination (handled separately)
- ❌ Persisting pagination state in URL (Nice-to-have for future)

---

## Pre-Session Checklist

Before starting this session, ensure:

- [ ] **Session 2A completed** - Backend pagination working and tested
- [ ] **Read PatternFly 6 Pagination docs** - Understand component API
- [ ] **Review existing table components** - Understand current structure
- [ ] **Check PatternFly 6 Table sorting** - Understand sortable column pattern
- [ ] **Test backend endpoints** - Verify pagination parameters work correctly
- [ ] **Plan default values** - Match backend defaults (page=1, limit=50)

### Recommended Reading

- [PatternFly 6 Pagination Component](https://www.patternfly.org/v6/components/pagination)
- [PatternFly 6 Table Component](https://www.patternfly.org/v6/components/table)
- [PatternFly 6 Table Sortable Columns](https://www.patternfly.org/v6/components/table/react-table/sortable)
- Existing code: `frontend/src/pages/AdminUsagePage.tsx`

---

## Implementation Steps

### Step 2B.1: Update Type Definitions (20 minutes)

#### Objective

Add TypeScript types for pagination request/response to match backend API.

#### Files to Modify

- `frontend/src/types/admin-usage.types.ts`

#### Implementation

```typescript
// frontend/src/types/admin-usage.types.ts

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;

  /** Items per page (max: 200) */
  limit?: number;

  /** Field to sort by */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata from API responses
 */
export interface PaginationMetadata {
  /** Current page number */
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
 * Generic paginated API response
 */
export interface PaginatedResponse<T> {
  /** Data items for current page */
  data: T[];

  /** Pagination metadata */
  pagination: PaginationMetadata;
}

/**
 * Pagination defaults (match backend)
 */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 50,
  SORT_ORDER: 'desc' as const,
} as const;

/**
 * User breakdown sort fields
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
 * Model breakdown sort fields
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
 * Provider breakdown sort fields
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

/**
 * Per-page options for pagination selector
 */
export const PER_PAGE_OPTIONS = [
  { title: '10', value: 10 },
  { title: '25', value: 25 },
  { title: '50', value: 50 },
  { title: '100', value: 100 },
] as const;
```

#### Validation

```bash
# Verify types compile
npm --prefix frontend run typecheck

# Expected: No errors
```

---

### Step 2B.2: Update API Service with Pagination (30 minutes)

#### Objective

Update the admin usage API service to accept pagination parameters and return paginated responses.

#### Files to Modify

- `frontend/src/services/admin-usage.service.ts`

#### Implementation

```typescript
// frontend/src/services/admin-usage.service.ts

import axios from 'axios';
import type {
  AdminUsageFilters,
  UserBreakdown,
  ModelBreakdown,
  ProviderBreakdown,
  PaginationParams,
  PaginatedResponse,
} from '../types/admin-usage.types';

const API_BASE_URL = '/api/v1/admin/usage';

export class AdminUsageService {
  /**
   * Get user breakdown with pagination
   *
   * @param filters - Date range and filter criteria
   * @param pagination - Pagination parameters (optional)
   * @returns Paginated user breakdown data
   */
  async getUserBreakdown(
    filters: AdminUsageFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<UserBreakdown>> {
    const params = new URLSearchParams();

    // Add pagination parameters if provided
    if (pagination?.page !== undefined) {
      params.append('page', pagination.page.toString());
    }
    if (pagination?.limit !== undefined) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.sortBy) {
      params.append('sortBy', pagination.sortBy);
    }
    if (pagination?.sortOrder) {
      params.append('sortOrder', pagination.sortOrder);
    }

    const url = `${API_BASE_URL}/user-breakdown?${params.toString()}`;

    const response = await axios.post<PaginatedResponse<UserBreakdown>>(url, filters);

    return response.data;
  }

  /**
   * Get model breakdown with pagination
   *
   * @param filters - Date range and filter criteria
   * @param pagination - Pagination parameters (optional)
   * @returns Paginated model breakdown data
   */
  async getModelBreakdown(
    filters: AdminUsageFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<ModelBreakdown>> {
    const params = new URLSearchParams();

    if (pagination?.page !== undefined) {
      params.append('page', pagination.page.toString());
    }
    if (pagination?.limit !== undefined) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.sortBy) {
      params.append('sortBy', pagination.sortBy);
    }
    if (pagination?.sortOrder) {
      params.append('sortOrder', pagination.sortOrder);
    }

    const url = `${API_BASE_URL}/model-breakdown?${params.toString()}`;

    const response = await axios.post<PaginatedResponse<ModelBreakdown>>(url, filters);

    return response.data;
  }

  /**
   * Get provider breakdown with pagination
   *
   * @param filters - Date range and filter criteria
   * @param pagination - Pagination parameters (optional)
   * @returns Paginated provider breakdown data
   */
  async getProviderBreakdown(
    filters: AdminUsageFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<ProviderBreakdown>> {
    const params = new URLSearchParams();

    if (pagination?.page !== undefined) {
      params.append('page', pagination.page.toString());
    }
    if (pagination?.limit !== undefined) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.sortBy) {
      params.append('sortBy', pagination.sortBy);
    }
    if (pagination?.sortOrder) {
      params.append('sortOrder', pagination.sortOrder);
    }

    const url = `${API_BASE_URL}/provider-breakdown?${params.toString()}`;

    const response = await axios.post<PaginatedResponse<ProviderBreakdown>>(url, filters);

    return response.data;
  }
}

export const adminUsageService = new AdminUsageService();
```

#### Validation

```bash
# Verify types compile
npm --prefix frontend run typecheck

# Expected: No errors
```

---

### Step 2B.3: Create Pagination Hook (45 minutes)

#### Objective

Create a reusable React hook for managing pagination state.

#### Files to Create

- `frontend/src/hooks/usePagination.ts`

#### Implementation

```typescript
// frontend/src/hooks/usePagination.ts

import { useState, useCallback } from 'react';
import { PAGINATION_DEFAULTS } from '../types/admin-usage.types';

export interface UsePaginationOptions {
  /** Initial page number (default: 1) */
  initialPage?: number;

  /** Initial items per page (default: 50) */
  initialPerPage?: number;

  /** Initial sort field */
  initialSortBy?: string;

  /** Initial sort order (default: 'desc') */
  initialSortOrder?: 'asc' | 'desc';
}

export interface UsePaginationReturn {
  /** Current page number (1-indexed) */
  page: number;

  /** Current items per page */
  perPage: number;

  /** Current sort field */
  sortBy: string;

  /** Current sort order */
  sortOrder: 'asc' | 'desc';

  /** Set page number */
  setPage: (page: number) => void;

  /** Set items per page */
  setPerPage: (perPage: number) => void;

  /** Set sort field and order */
  setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void;

  /** Reset to initial values */
  reset: () => void;

  /** Pagination parameters for API calls */
  paginationParams: {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

/**
 * Hook for managing pagination state
 *
 * Provides state management for page, perPage, sortBy, and sortOrder
 * with helper functions and automatic reset on filter changes.
 *
 * @param options - Initial pagination values
 * @returns Pagination state and helpers
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = PAGINATION_DEFAULTS.PAGE,
    initialPerPage = PAGINATION_DEFAULTS.LIMIT,
    initialSortBy = 'totalTokens',
    initialSortOrder = PAGINATION_DEFAULTS.SORT_ORDER,
  } = options;

  const [page, setPageState] = useState(initialPage);
  const [perPage, setPerPageState] = useState(initialPerPage);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  /**
   * Set page number
   * PatternFly Pagination passes event as first arg, page as second
   */
  const setPage = useCallback((_event: unknown, newPage: number) => {
    setPageState(newPage);
  }, []);

  /**
   * Set items per page
   * Reset to page 1 when changing per-page value
   */
  const setPerPage = useCallback((_event: unknown, newPerPage: number) => {
    setPerPageState(newPerPage);
    setPageState(1); // Reset to first page when changing page size
  }, []);

  /**
   * Set sort field and order
   * Reset to page 1 when changing sort
   */
  const setSort = useCallback((newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPageState(1); // Reset to first page when changing sort
  }, []);

  /**
   * Reset all pagination state to initial values
   */
  const reset = useCallback(() => {
    setPageState(initialPage);
    setPerPageState(initialPerPage);
    setSortBy(initialSortBy);
    setSortOrder(initialSortOrder);
  }, [initialPage, initialPerPage, initialSortBy, initialSortOrder]);

  return {
    page,
    perPage,
    sortBy,
    sortOrder,
    setPage,
    setPerPage,
    setSort,
    reset,
    paginationParams: {
      page,
      limit: perPage,
      sortBy,
      sortOrder,
    },
  };
}
```

#### Unit Tests

```typescript
// frontend/src/hooks/usePagination.test.ts

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePagination } from './usePagination';

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination());

    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(50);
    expect(result.current.sortBy).toBe('totalTokens');
    expect(result.current.sortOrder).toBe('desc');
  });

  it('should initialize with custom values', () => {
    const { result } = renderHook(() =>
      usePagination({
        initialPage: 2,
        initialPerPage: 25,
        initialSortBy: 'username',
        initialSortOrder: 'asc',
      }),
    );

    expect(result.current.page).toBe(2);
    expect(result.current.perPage).toBe(25);
    expect(result.current.sortBy).toBe('username');
    expect(result.current.sortOrder).toBe('asc');
  });

  it('should update page', () => {
    const { result } = renderHook(() => usePagination());

    act(() => {
      result.current.setPage(null as any, 3);
    });

    expect(result.current.page).toBe(3);
  });

  it('should update perPage and reset to page 1', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 5 }));

    expect(result.current.page).toBe(5);

    act(() => {
      result.current.setPerPage(null as any, 100);
    });

    expect(result.current.perPage).toBe(100);
    expect(result.current.page).toBe(1); // Should reset to page 1
  });

  it('should update sort and reset to page 1', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 3 }));

    expect(result.current.page).toBe(3);

    act(() => {
      result.current.setSort('username', 'asc');
    });

    expect(result.current.sortBy).toBe('username');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.page).toBe(1); // Should reset to page 1
  });

  it('should reset to initial values', () => {
    const { result } = renderHook(() =>
      usePagination({
        initialPage: 1,
        initialPerPage: 50,
        initialSortBy: 'totalTokens',
        initialSortOrder: 'desc',
      }),
    );

    // Make changes
    act(() => {
      result.current.setPage(null as any, 5);
      result.current.setPerPage(null as any, 100);
      result.current.setSort('username', 'asc');
    });

    expect(result.current.page).toBe(1); // Reset by setPerPage/setSort
    expect(result.current.perPage).toBe(100);
    expect(result.current.sortBy).toBe('username');

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(50);
    expect(result.current.sortBy).toBe('totalTokens');
    expect(result.current.sortOrder).toBe('desc');
  });

  it('should provide paginationParams object', () => {
    const { result } = renderHook(() => usePagination());

    expect(result.current.paginationParams).toEqual({
      page: 1,
      limit: 50,
      sortBy: 'totalTokens',
      sortOrder: 'desc',
    });
  });
});
```

#### Validation

```bash
# Run tests
npm --prefix frontend test usePagination.test.ts

# Expected: All tests passing
```

---

### Step 2B.4: Update User Breakdown Table with Pagination (1 hour)

#### Objective

Add PatternFly Pagination component and sorting to the user breakdown table.

#### Files to Modify

- `frontend/src/components/admin/UserBreakdownTable.tsx`

#### Implementation

```typescript
// frontend/src/components/admin/UserBreakdownTable.tsx

import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Pagination,
  EmptyState,
  EmptyStateHeader,
  EmptyStateIcon,
  EmptyStateBody,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminUsageService } from '../../services/admin-usage.service';
import { usePagination } from '../../hooks/usePagination';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import type { AdminUsageFilters } from '../../types/admin-usage.types';
import { formatNumber, formatCost } from '../../utils/format';

interface UserBreakdownTableProps {
  filters: AdminUsageFilters;
}

export const UserBreakdownTable: React.FC<UserBreakdownTableProps> = ({ filters }) => {
  const { t } = useTranslation();
  const { handleError } = useErrorHandler();

  // Pagination state
  const pagination = usePagination({
    initialSortBy: 'totalTokens',
    initialSortOrder: 'desc',
  });

  // Fetch data with pagination
  const { data: response, isLoading, error } = useQuery(
    ['userBreakdown', filters, pagination.paginationParams],
    () => adminUsageService.getUserBreakdown(filters, pagination.paginationParams),
    {
      onError: (err) => handleError(err),
      keepPreviousData: true, // Keep previous page data while loading next page
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Handle errors
  React.useEffect(() => {
    if (error) {
      handleError(error);
    }
  }, [error, handleError]);

  // Reset pagination when filters change
  React.useEffect(() => {
    pagination.reset();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort handler for table headers
  const handleSort = (columnKey: string) => {
    const newSortOrder =
      pagination.sortBy === columnKey && pagination.sortOrder === 'asc' ? 'desc' : 'asc';
    pagination.setSort(columnKey, newSortOrder);
  };

  // Get sort direction for column
  const getSortParams = (columnKey: string) => {
    if (pagination.sortBy !== columnKey) {
      return undefined;
    }
    return {
      sortBy: {
        index: 0, // Not used for server-side sorting
        direction: pagination.sortOrder,
      },
    };
  };

  if (isLoading && !response) {
    return (
      <div className="pf-v6-u-text-align-center pf-v6-u-p-lg">
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  if (!response || response.data.length === 0) {
    return (
      <EmptyState>
        <EmptyStateHeader
          titleText={t('adminUsage.userBreakdown.noData', 'No user data available')}
          icon={<EmptyStateIcon icon={SearchIcon} />}
          headingLevel="h4"
        />
        <EmptyStateBody>
          {t(
            'adminUsage.userBreakdown.noDataDescription',
            'No usage data found for the selected date range and filters.'
          )}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const { data: users, pagination: paginationMetadata } = response;

  return (
    <>
      {/* Top Pagination */}
      <Pagination
        itemCount={paginationMetadata.total}
        page={pagination.page}
        perPage={pagination.perPage}
        onSetPage={pagination.setPage}
        onPerPageSelect={pagination.setPerPage}
        variant="top"
        perPageOptions={[
          { title: '10', value: 10 },
          { title: '25', value: 25 },
          { title: '50', value: 50 },
          { title: '100', value: 100 },
        ]}
        titles={{
          paginationAriaLabel: t('adminUsage.pagination.label', 'User breakdown pagination'),
        }}
      />

      {/* Table */}
      <Table aria-label={t('adminUsage.userBreakdown.tableLabel', 'User breakdown table')}>
        <Thead>
          <Tr>
            <Th
              sort={{
                sortBy: getSortParams('username')?.sortBy,
                onSort: () => handleSort('username'),
                columnIndex: 0,
              }}
            >
              {t('adminUsage.userBreakdown.username', 'Username')}
            </Th>
            <Th>{t('adminUsage.userBreakdown.email', 'Email')}</Th>
            <Th
              sort={{
                sortBy: getSortParams('totalRequests')?.sortBy,
                onSort: () => handleSort('totalRequests'),
                columnIndex: 2,
              }}
            >
              {t('adminUsage.userBreakdown.totalRequests', 'Requests')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('totalTokens')?.sortBy,
                onSort: () => handleSort('totalTokens'),
                columnIndex: 3,
              }}
            >
              {t('adminUsage.userBreakdown.totalTokens', 'Total Tokens')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('promptTokens')?.sortBy,
                onSort: () => handleSort('promptTokens'),
                columnIndex: 4,
              }}
            >
              {t('adminUsage.userBreakdown.promptTokens', 'Prompt Tokens')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('completionTokens')?.sortBy,
                onSort: () => handleSort('completionTokens'),
                columnIndex: 5,
              }}
            >
              {t('adminUsage.userBreakdown.completionTokens', 'Completion Tokens')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('totalCost')?.sortBy,
                onSort: () => handleSort('totalCost'),
                columnIndex: 6,
              }}
            >
              {t('adminUsage.userBreakdown.totalCost', 'Total Cost')}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map((user) => (
            <Tr key={user.userId}>
              <Td dataLabel={t('adminUsage.userBreakdown.username', 'Username')}>
                {user.username}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.email', 'Email')}>
                {user.email || '-'}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.totalRequests', 'Requests')}>
                {formatNumber(user.totalRequests)}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.totalTokens', 'Total Tokens')}>
                {formatNumber(user.totalTokens)}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.promptTokens', 'Prompt Tokens')}>
                {formatNumber(user.promptTokens)}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.completionTokens', 'Completion Tokens')}>
                {formatNumber(user.completionTokens)}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.totalCost', 'Total Cost')}>
                {formatCost(user.totalCost)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Bottom Pagination */}
      <Pagination
        itemCount={paginationMetadata.total}
        page={pagination.page}
        perPage={pagination.perPage}
        onSetPage={pagination.setPage}
        onPerPageSelect={pagination.setPerPage}
        variant="bottom"
        perPageOptions={[
          { title: '10', value: 10 },
          { title: '25', value: 25 },
          { title: '50', value: 50 },
          { title: '100', value: 100 },
        ]}
        titles={{
          paginationAriaLabel: t('adminUsage.pagination.label', 'User breakdown pagination'),
        }}
      />
    </>
  );
};
```

#### Validation

```bash
# Run component tests
npm --prefix frontend test UserBreakdownTable.test.tsx

# Verify TypeScript
npm --prefix frontend run typecheck

# Expected: No errors
```

---

### Step 2B.5: Update Model and Provider Breakdown Tables (1 hour)

#### Objective

Apply the same pagination pattern to model and provider breakdown tables.

#### Files to Modify

- `frontend/src/components/admin/ModelBreakdownTable.tsx`
- `frontend/src/components/admin/ProviderBreakdownTable.tsx`

#### Implementation

**Model Breakdown Table** (similar pattern to User Breakdown):

```typescript
// frontend/src/components/admin/ModelBreakdownTable.tsx

import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Pagination,
  EmptyState,
} from '@patternfly/react-core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { adminUsageService } from '../../services/admin-usage.service';
import { usePagination } from '../../hooks/usePagination';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import type { AdminUsageFilters } from '../../types/admin-usage.types';

interface ModelBreakdownTableProps {
  filters: AdminUsageFilters;
}

export const ModelBreakdownTable: React.FC<ModelBreakdownTableProps> = ({ filters }) => {
  const { t } = useTranslation();
  const { handleError } = useErrorHandler();

  const pagination = usePagination({
    initialSortBy: 'totalTokens',
    initialSortOrder: 'desc',
  });

  const { data: response, isLoading, error } = useQuery(
    ['modelBreakdown', filters, pagination.paginationParams],
    () => adminUsageService.getModelBreakdown(filters, pagination.paginationParams),
    {
      onError: (err) => handleError(err),
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000,
    }
  );

  React.useEffect(() => {
    if (error) {
      handleError(error);
    }
  }, [error, handleError]);

  React.useEffect(() => {
    pagination.reset();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (columnKey: string) => {
    const newSortOrder =
      pagination.sortBy === columnKey && pagination.sortOrder === 'asc' ? 'desc' : 'asc';
    pagination.setSort(columnKey, newSortOrder);
  };

  const getSortParams = (columnKey: string) => {
    if (pagination.sortBy !== columnKey) {
      return undefined;
    }
    return {
      sortBy: {
        index: 0,
        direction: pagination.sortOrder,
      },
    };
  };

  if (isLoading && !response) {
    return <div className="pf-v6-u-text-align-center pf-v6-u-p-lg">{t('common.loading')}</div>;
  }

  if (!response || response.data.length === 0) {
    return (
      <EmptyState>
        {/* Empty state similar to UserBreakdownTable */}
      </EmptyState>
    );
  }

  const { data: models, pagination: paginationMetadata } = response;

  return (
    <>
      <Pagination
        itemCount={paginationMetadata.total}
        page={pagination.page}
        perPage={pagination.perPage}
        onSetPage={pagination.setPage}
        onPerPageSelect={pagination.setPerPage}
        variant="top"
        perPageOptions={[
          { title: '10', value: 10 },
          { title: '25', value: 25 },
          { title: '50', value: 50 },
          { title: '100', value: 100 },
        ]}
      />

      <Table aria-label={t('adminUsage.modelBreakdown.tableLabel')}>
        <Thead>
          <Tr>
            <Th
              sort={{
                sortBy: getSortParams('modelName')?.sortBy,
                onSort: () => handleSort('modelName'),
                columnIndex: 0,
              }}
            >
              {t('adminUsage.modelBreakdown.modelName', 'Model')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('totalRequests')?.sortBy,
                onSort: () => handleSort('totalRequests'),
                columnIndex: 1,
              }}
            >
              {t('adminUsage.modelBreakdown.totalRequests', 'Requests')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('totalTokens')?.sortBy,
                onSort: () => handleSort('totalTokens'),
                columnIndex: 2,
              }}
            >
              {t('adminUsage.modelBreakdown.totalTokens', 'Total Tokens')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('promptTokens')?.sortBy,
                onSort: () => handleSort('promptTokens'),
                columnIndex: 3,
              }}
            >
              {t('adminUsage.modelBreakdown.promptTokens', 'Prompt Tokens')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('completionTokens')?.sortBy,
                onSort: () => handleSort('completionTokens'),
                columnIndex: 4,
              }}
            >
              {t('adminUsage.modelBreakdown.completionTokens', 'Completion Tokens')}
            </Th>
            <Th
              sort={{
                sortBy: getSortParams('totalCost')?.sortBy,
                onSort: () => handleSort('totalCost'),
                columnIndex: 5,
              }}
            >
              {t('adminUsage.modelBreakdown.totalCost', 'Total Cost')}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {models.map((model, index) => (
            <Tr key={`${model.modelName}-${index}`}>
              <Td>{model.modelName}</Td>
              <Td>{formatNumber(model.totalRequests)}</Td>
              <Td>{formatNumber(model.totalTokens)}</Td>
              <Td>{formatNumber(model.promptTokens)}</Td>
              <Td>{formatNumber(model.completionTokens)}</Td>
              <Td>{formatCost(model.totalCost)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Pagination
        itemCount={paginationMetadata.total}
        page={pagination.page}
        perPage={pagination.perPage}
        onSetPage={pagination.setPage}
        onPerPageSelect={pagination.setPerPage}
        variant="bottom"
        perPageOptions={[
          { title: '10', value: 10 },
          { title: '25', value: 25 },
          { title: '50', value: 50 },
          { title: '100', value: 100 },
        ]}
      />
    </>
  );
};
```

**Provider Breakdown Table** (similar pattern):

```typescript
// frontend/src/components/admin/ProviderBreakdownTable.tsx

// Same structure as ModelBreakdownTable, but with:
// - Different query key: 'providerBreakdown'
// - Different service call: adminUsageService.getProviderBreakdown()
// - Different column: 'providerName' instead of 'modelName'
// - Different translation keys: adminUsage.providerBreakdown.*
```

---

### Step 2B.6: Add i18n Translations (20 minutes)

#### Objective

Add translation strings for pagination UI elements.

#### Files to Modify

- `frontend/public/locales/en/translation.json` (and other language files)

#### Implementation

```json
{
  "adminUsage": {
    "pagination": {
      "label": "Pagination",
      "perPage": "per page",
      "firstPage": "First page",
      "previousPage": "Previous page",
      "nextPage": "Next page",
      "lastPage": "Last page",
      "showing": "Showing {{start}} - {{end}} of {{total}}"
    },
    "userBreakdown": {
      "tableLabel": "User breakdown table",
      "username": "Username",
      "email": "Email",
      "totalRequests": "Requests",
      "totalTokens": "Total Tokens",
      "promptTokens": "Prompt Tokens",
      "completionTokens": "Completion Tokens",
      "totalCost": "Total Cost",
      "noData": "No user data available",
      "noDataDescription": "No usage data found for the selected date range and filters."
    },
    "modelBreakdown": {
      "tableLabel": "Model breakdown table",
      "modelName": "Model",
      "totalRequests": "Requests",
      "totalTokens": "Total Tokens",
      "promptTokens": "Prompt Tokens",
      "completionTokens": "Completion Tokens",
      "totalCost": "Total Cost",
      "noData": "No model data available",
      "noDataDescription": "No usage data found for the selected date range and filters."
    },
    "providerBreakdown": {
      "tableLabel": "Provider breakdown table",
      "providerName": "Provider",
      "totalRequests": "Requests",
      "totalTokens": "Total Tokens",
      "promptTokens": "Prompt Tokens",
      "completionTokens": "Completion Tokens",
      "totalCost": "Total Cost",
      "noData": "No provider data available",
      "noDataDescription": "No usage data found for the selected date range and filters."
    }
  }
}
```

---

### Step 2B.7: Add Component Tests (45 minutes)

#### Objective

Add tests for pagination behavior in table components.

#### Files to Create

- `frontend/src/components/admin/UserBreakdownTable.test.tsx`

#### Implementation

```typescript
// frontend/src/components/admin/UserBreakdownTable.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserBreakdownTable } from './UserBreakdownTable';
import { adminUsageService } from '../../services/admin-usage.service';

// Mock service
vi.mock('../../services/admin-usage.service');

const mockGetUserBreakdown = vi.mocked(adminUsageService.getUserBreakdown);

const mockResponse = {
  data: Array.from({ length: 10 }, (_, i) => ({
    userId: `user-${i}`,
    username: `user${i}`,
    email: `user${i}@example.com`,
    totalRequests: (i + 1) * 100,
    totalTokens: (i + 1) * 1000,
    promptTokens: (i + 1) * 600,
    completionTokens: (i + 1) * 400,
    totalCost: (i + 1) * 1.5,
  })),
  pagination: {
    page: 1,
    limit: 10,
    total: 100,
    totalPages: 10,
    hasNext: true,
    hasPrevious: false,
  },
};

describe('UserBreakdownTable', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockGetUserBreakdown.mockResolvedValue(mockResponse);
  });

  const renderTable = (filters = { startDate: '2025-01-01', endDate: '2025-01-31' }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <UserBreakdownTable filters={filters} />
      </QueryClientProvider>
    );
  };

  it('should render table with paginated data', async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByText('user0')).toBeInTheDocument();
    });

    // Verify pagination controls present
    expect(screen.getAllByLabelText(/pagination/i)).toHaveLength(2); // Top and bottom
  });

  it('should display pagination metadata', async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByText(/1.*10.*100/)).toBeInTheDocument(); // "1 - 10 of 100"
    });
  });

  it('should call API with pagination parameters on page change', async () => {
    const user = userEvent.setup();
    renderTable();

    await waitFor(() => {
      expect(screen.getByText('user0')).toBeInTheDocument();
    });

    // Click next page
    const nextButtons = screen.getAllByLabelText(/next page/i);
    await user.click(nextButtons[0]);

    await waitFor(() => {
      expect(mockGetUserBreakdown).toHaveBeenCalledWith(
        { startDate: '2025-01-01', endDate: '2025-01-31' },
        expect.objectContaining({
          page: 2,
          limit: 10,
        })
      );
    });
  });

  it('should call API with new limit when per-page changed', async () => {
    const user = userEvent.setup();
    renderTable();

    await waitFor(() => {
      expect(screen.getByText('user0')).toBeInTheDocument();
    });

    // Change per-page (this is UI-dependent, may need adjustment)
    const perPageSelects = screen.getAllByRole('button', { name: /10 per page/i });
    await user.click(perPageSelects[0]);

    const option50 = screen.getByRole('option', { name: '50' });
    await user.click(option50);

    await waitFor(() => {
      expect(mockGetUserBreakdown).toHaveBeenCalledWith(
        { startDate: '2025-01-01', endDate: '2025-01-31' },
        expect.objectContaining({
          page: 1, // Should reset to page 1
          limit: 50,
        })
      );
    });
  });

  it('should sort by column when header clicked', async () => {
    const user = userEvent.setup();
    renderTable();

    await waitFor(() => {
      expect(screen.getByText('user0')).toBeInTheDocument();
    });

    // Click username header to sort
    const usernameHeader = screen.getByRole('button', { name: /username/i });
    await user.click(usernameHeader);

    await waitFor(() => {
      expect(mockGetUserBreakdown).toHaveBeenCalledWith(
        { startDate: '2025-01-01', endDate: '2025-01-31' },
        expect.objectContaining({
          sortBy: 'username',
          sortOrder: 'asc',
        })
      );
    });

    // Click again to reverse sort
    await user.click(usernameHeader);

    await waitFor(() => {
      expect(mockGetUserBreakdown).toHaveBeenCalledWith(
        { startDate: '2025-01-01', endDate: '2025-01-31' },
        expect.objectContaining({
          sortBy: 'username',
          sortOrder: 'desc',
        })
      );
    });
  });

  it('should reset pagination when filters change', async () => {
    const { rerender } = renderTable({ startDate: '2025-01-01', endDate: '2025-01-31' });

    await waitFor(() => {
      expect(screen.getByText('user0')).toBeInTheDocument();
    });

    // Change filters
    rerender(
      <QueryClientProvider client={queryClient}>
        <UserBreakdownTable filters={{ startDate: '2025-02-01', endDate: '2025-02-28' }} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockGetUserBreakdown).toHaveBeenCalledWith(
        { startDate: '2025-02-01', endDate: '2025-02-28' },
        expect.objectContaining({
          page: 1, // Should reset to page 1
        })
      );
    });
  });

  it('should show empty state when no data', async () => {
    mockGetUserBreakdown.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    });

    renderTable();

    await waitFor(() => {
      expect(screen.getByText(/no user data available/i)).toBeInTheDocument();
    });
  });
});
```

---

## Deliverables

After completing this session, you should have:

- [ ] **Type definitions** for pagination request/response
- [ ] **API service updated** with pagination parameter support
- [ ] **Pagination hook** for state management (`usePagination`)
- [ ] **User breakdown table** with pagination and sorting
- [ ] **Model breakdown table** with pagination and sorting
- [ ] **Provider breakdown table** with pagination and sorting
- [ ] **i18n translations** for pagination UI
- [ ] **Component tests** for pagination behavior

### Files Created

- `frontend/src/hooks/usePagination.ts` (~150 lines)
- `frontend/src/hooks/usePagination.test.ts` (~100 lines)
- `frontend/src/components/admin/UserBreakdownTable.test.tsx` (~200 lines)

### Files Modified

- `frontend/src/types/admin-usage.types.ts` (~100 lines added)
- `frontend/src/services/admin-usage.service.ts` (~100 lines modified)
- `frontend/src/components/admin/UserBreakdownTable.tsx` (~200 lines modified)
- `frontend/src/components/admin/ModelBreakdownTable.tsx` (~200 lines modified)
- `frontend/src/components/admin/ProviderBreakdownTable.tsx` (~200 lines modified)
- `frontend/public/locales/en/translation.json` (~50 lines added)

### Metrics

- **Lines of Code Added**: ~1,400
- **Test Coverage**: 90%+ for pagination hook and components
- **UI Performance**: Renders 50 rows in < 100ms (vs. 5,000+ rows in 2+ seconds)

---

## Acceptance Criteria

Verify all criteria before marking session complete:

- [ ] **Pagination Controls**: Top and bottom pagination visible on all breakdown tables
- [ ] **Page Navigation**: Previous/Next/First/Last buttons work correctly
- [ ] **Per-Page Selection**: Can change items per page (10, 25, 50, 100)
- [ ] **Sorting**: Can sort by all numeric columns (requests, tokens, cost)
- [ ] **Sort Direction**: Click header toggles asc/desc
- [ ] **Sort Indicator**: Active sort column shows indicator
- [ ] **Metadata Display**: Shows "X - Y of Z" correctly
- [ ] **Reset on Filter Change**: Pagination resets to page 1 when filters change
- [ ] **React Query Caching**: Pagination parameters included in query key
- [ ] **keepPreviousData**: Previous page data shown while loading next page
- [ ] **Error Handling**: Errors handled via `useErrorHandler`
- [ ] **i18n**: All UI text translated
- [ ] **Accessibility**: Pagination controls have proper ARIA labels
- [ ] **Unit Tests**: All hook tests passing
- [ ] **Component Tests**: All table component tests passing
- [ ] **No Regression**: All existing tests still passing
- [ ] **TypeScript**: No TypeScript errors
- [ ] **Linter**: No linting errors

---

## Validation

### Manual Testing Checklist

**Test in browser (http://localhost:3000/admin/usage):**

1. **Initial Load**:
   - ✅ Tables show paginated data (50 items by default)
   - ✅ Pagination controls visible at top and bottom
   - ✅ Metadata shows correct counts

2. **Page Navigation**:
   - ✅ Click "Next" - loads page 2
   - ✅ Click "Previous" - returns to page 1
   - ✅ Previous disabled on page 1
   - ✅ Next disabled on last page

3. **Per-Page Selection**:
   - ✅ Change to 10 per page - shows 10 items, resets to page 1
   - ✅ Change to 100 per page - shows 100 items

4. **Sorting**:
   - ✅ Click "Username" header - sorts alphabetically
   - ✅ Click again - reverses sort
   - ✅ Sort indicator shows on active column
   - ✅ Click "Total Tokens" - sorts by highest tokens

5. **Filter Changes**:
   - ✅ Change date range - resets to page 1
   - ✅ Add model filter - resets to page 1

6. **Empty State**:
   - ✅ Select future date range (no data) - shows empty state

7. **Loading State**:
   - ✅ Previous page data visible while loading next page

### Automated Testing

```bash
# Run all frontend tests
npm --prefix frontend test

# Run specific pagination tests
npm --prefix frontend test usePagination.test.ts
npm --prefix frontend test UserBreakdownTable.test.tsx

# TypeScript check
npm --prefix frontend run typecheck

# Linter
npm --prefix frontend run lint
```

**Expected Results**:

- All tests passing
- No TypeScript errors
- No linting errors

---

## Next Steps

After completing and validating this session:

1. **Commit changes**:

   ```bash
   git add .
   git commit -m "feat: add frontend pagination to admin usage breakdown tables

   - Add pagination type definitions and utilities
   - Create usePagination hook for state management
   - Update API service with pagination parameters
   - Add PatternFly Pagination components to all breakdown tables
   - Implement sortable table headers
   - Add comprehensive component tests
   - Add i18n translations for pagination UI

   Implements Issue #6: No Pagination on Breakdown Endpoints (Frontend)
   Phase 2, Session 2B of remediation plan"
   ```

2. **Proceed to Session 2C**: Error Handling Standardization
   - Audit all error handling in admin usage components
   - Standardize on `useErrorHandler` hook
   - Update React Query error handling
   - Create error handling guide

3. **Update Progress Tracker**:
   - Mark Session 2B as complete
   - Record actual time vs. estimate
   - Note any discoveries or blockers

---

## Troubleshooting

### Common Issues

**Issue**: Pagination controls not visible

- **Cause**: Response not returning pagination metadata
- **Solution**: Verify backend API returns `{ data: [], pagination: {} }` structure

**Issue**: Sort not working

- **Cause**: Sort parameters not passed to API
- **Solution**: Verify `paginationParams` includes `sortBy` and `sortOrder`

**Issue**: Page doesn't reset when filters change

- **Cause**: Missing `useEffect` dependency on filters
- **Solution**: Add `useEffect(() => pagination.reset(), [filters])`

**Issue**: TypeScript error on Pagination component

- **Cause**: Missing PatternFly type imports
- **Solution**: Import types from `@patternfly/react-core`

**Issue**: Previous data flickers when changing pages

- **Cause**: `keepPreviousData` not set in useQuery
- **Solution**: Add `keepPreviousData: true` to useQuery options

---

## Session Summary Template

```markdown
### Session 2B: Frontend Pagination

**Date**: YYYY-MM-DD
**Duration**: X hours (estimated: 3-4 hours)
**Status**: ✅ Complete

#### Completed

- [x] Created pagination types and hook
- [x] Updated API service with pagination
- [x] Added pagination to all breakdown tables
- [x] Implemented sorting
- [x] Added component tests
- [x] Added i18n translations

#### Metrics

- Files created: 3
- Files modified: 6
- Lines added: ~1,400
- Tests added: 20+
- Test coverage: 92%

#### Discoveries

- [List any unexpected findings]

#### Next Session

- Session 2C: Error Handling Standardization (4-6 hours)
```

---

**End of Session 2B Documentation**

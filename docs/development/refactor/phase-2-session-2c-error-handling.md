# Phase 2, Session 2C: Error Handling Standardization

**Phase**: 2 - High-Priority Operational Safeguards
**Session**: 2C
**Duration**: 4-6 hours
**Priority**: 🟡 HIGH
**Issue**: #7 - Inconsistent Error Handling in Frontend

---

## Navigation

- **Previous**: [Phase 2, Session 2B: Frontend Pagination](./phase-2-session-2b-frontend-pagination.md)
- **Next**: [Phase 2 Checkpoint](#phase-2-checkpoint)
- **Parent**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

### Problem Statement

The admin usage analytics feature has **inconsistent error handling** across components:

1. **Multiple error handling patterns**:
   - Some components use `try/catch` with manual error state
   - Some components use React Query's `onError`
   - Some components use `useErrorHandler` hook
   - Some components have no error handling at all

2. **Inconsistent user experience**:
   - Error messages vary in format and detail
   - Some errors show toast notifications
   - Some errors show inline alerts
   - Some errors are silently logged to console

3. **Maintenance burden**:
   - Hard to update error handling logic globally
   - Difficult to add features like error tracking/reporting
   - Code duplication across components

### Current Behavior

**Example Inconsistencies**:

```typescript
// Component A: Manual error state (❌ Inconsistent)
const [error, setError] = useState<Error | null>(null);
const { data } = useQuery(['key'], fetcher, {
  onError: (err) => {
    setError(err);
    console.error(err);
  }
});

// Component B: React Query error only (❌ Inconsistent)
const { data, error } = useQuery(['key'], fetcher);
if (error) {
  return <div>Error: {error.message}</div>;
}

// Component C: useErrorHandler hook (✅ Correct)
const { handleError } = useErrorHandler();
const { data } = useQuery(['key'], fetcher, {
  onError: (err) => handleError(err)
});
```

**Issues**:

- Component A: Manual state management, console logging instead of user feedback
- Component B: No user notification, poor UX
- Component C: Correct pattern with centralized error handling

### Desired Behavior

**After Implementation**:

**All components should follow the same pattern:**

```typescript
// Standardized error handling pattern
import { useErrorHandler } from '../../hooks/useErrorHandler';

const MyComponent: React.FC = () => {
  const { handleError } = useErrorHandler();

  const { data, error, isLoading } = useQuery(
    ['queryKey'],
    () => apiService.fetchData(),
    {
      onError: (err) => handleError(err),
      retry: 1, // Consistent retry policy
      staleTime: 5 * 60 * 1000, // Consistent cache policy
    }
  );

  // Optional: Handle error in useEffect for side effects
  React.useEffect(() => {
    if (error) {
      handleError(error);
    }
  }, [error, handleError]);

  // Component renders normally - errors handled by hook
  return <div>{data?.content}</div>;
};
```

**Benefits**:

- Single source of truth for error handling
- Consistent user notifications
- Easy to add error tracking (Sentry, etc.)
- Less code duplication
- Better testability

---

## Session Objectives

1. **Audit all error handling** in admin usage components
2. **Standardize on `useErrorHandler` hook** for all error scenarios
3. **Update React Query configuration** with consistent error handling
4. **Create error handling guide** for developers
5. **Add to code review checklist** to prevent future inconsistencies

### Components to Audit and Update

**Admin Usage Components**:

- `frontend/src/pages/AdminUsagePage.tsx`
- `frontend/src/components/admin/UserBreakdownTable.tsx`
- `frontend/src/components/admin/ModelBreakdownTable.tsx`
- `frontend/src/components/admin/ProviderBreakdownTable.tsx`
- `frontend/src/components/charts/UsageTrends.tsx`
- `frontend/src/components/charts/ModelUsageTrends.tsx`
- `frontend/src/components/charts/ModelDistributionChart.tsx`
- `frontend/src/components/charts/UsageHeatmap.tsx`

**API Service**:

- `frontend/src/services/admin-usage.service.ts`

### Non-Goals (Out of Scope)

- ❌ Error tracking integration (Sentry, etc.) - Future enhancement
- ❌ Custom error pages - Use existing error boundaries
- ❌ Backend error handling - Separate concern
- ❌ Network retry logic beyond React Query defaults

---

## Pre-Session Checklist

Before starting this session, ensure:

- [ ] **Review `useErrorHandler` hook** - Understand current implementation
- [ ] **Review React Query docs** - Understand error handling options
- [ ] **List all admin usage components** - Create audit spreadsheet
- [ ] **Review notification system** - Understand how errors are displayed to users
- [ ] **Check error boundaries** - Verify error boundary coverage
- [ ] **Review existing error patterns** - Identify all variations in use

### Recommended Reading

- [React Query Error Handling](https://tanstack.com/query/latest/docs/react/guides/query-functions#handling-and-throwing-errors)
- [Error Boundaries in React](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- Existing code: `frontend/src/hooks/useErrorHandler.ts`
- Existing code: `frontend/src/contexts/NotificationContext.tsx`

---

## Implementation Steps

### Step 2C.1: Audit Current Error Handling (1 hour)

#### Objective

Create comprehensive audit of all error handling patterns in admin usage feature.

#### Process

**Create Audit Spreadsheet**:

```markdown
| Component               | Current Pattern                                    | Issues                 | Action Required                |
| ----------------------- | -------------------------------------------------- | ---------------------- | ------------------------------ |
| AdminUsagePage.tsx      | useErrorHandler in some queries, missing in others | Inconsistent coverage  | Add handleError to all queries |
| UserBreakdownTable.tsx  | React Query error only, no user notification       | No user feedback       | Add useErrorHandler            |
| ModelBreakdownTable.tsx | Manual try/catch with console.error                | No user notification   | Replace with useErrorHandler   |
| UsageTrends.tsx         | No error handling                                  | Errors not caught      | Add useErrorHandler            |
| admin-usage.service.ts  | Throws errors, no transformation                   | Generic error messages | Add error transformation       |
```

#### Actions

1. **Search for error handling patterns**:

   ```bash
   # Find all try/catch blocks
   grep -r "try {" frontend/src/pages/AdminUsage*
   grep -r "try {" frontend/src/components/admin/
   grep -r "try {" frontend/src/components/charts/

   # Find all useQuery error handling
   grep -r "onError" frontend/src/pages/AdminUsage*
   grep -r "onError" frontend/src/components/admin/
   grep -r "onError" frontend/src/components/charts/

   # Find console.error usage (should be removed)
   grep -r "console.error" frontend/src/pages/AdminUsage*
   grep -r "console.error" frontend/src/components/admin/
   grep -r "console.error" frontend/src/components/charts/
   ```

2. **Document findings**:
   - Create `docs/development/error-handling-audit.md`
   - List all components with error handling
   - Categorize by pattern (manual, useQuery only, useErrorHandler, none)
   - Prioritize components by risk (user-facing vs. charts)

3. **Identify edge cases**:
   - Components with multiple error sources (API + local)
   - Components with error recovery logic
   - Components with custom error messages

#### Deliverable

Create audit document with findings and remediation plan.

---

### Step 2C.2: Review and Enhance useErrorHandler Hook (1 hour)

#### Objective

Ensure `useErrorHandler` hook is robust and handles all error scenarios.

#### Files to Review/Modify

- `frontend/src/hooks/useErrorHandler.ts`

#### Current Implementation Review

**Check for**:

- [ ] Error type detection (AxiosError, Error, string)
- [ ] User-friendly error message extraction
- [ ] Notification integration (toast/alert)
- [ ] Error logging (console.error for debugging)
- [ ] Error context (component name, user action)

#### Enhanced Implementation

```typescript
// frontend/src/hooks/useErrorHandler.ts

import { useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { useTranslation } from 'react-i18next';
import axios, { AxiosError } from 'axios';

export interface ErrorHandlerOptions {
  /** Custom error title */
  title?: string;

  /** Custom error message (overrides extracted message) */
  message?: string;

  /** Whether to show notification (default: true) */
  showNotification?: boolean;

  /** Whether to log to console (default: true in development) */
  logToConsole?: boolean;

  /** Component context for logging */
  componentName?: string;
}

/**
 * Hook for standardized error handling
 *
 * Provides consistent error handling across the application:
 * - Extracts user-friendly messages from various error types
 * - Shows toast notifications to users
 * - Logs errors to console in development
 * - Supports custom error messages and titles
 *
 * @returns Error handler function
 */
export function useErrorHandler() {
  const { addNotification } = useNotification();
  const { t } = useTranslation();

  /**
   * Handle an error with consistent UX and logging
   *
   * @param error - Error to handle (Error, AxiosError, or string)
   * @param options - Error handling options
   */
  const handleError = useCallback(
    (error: unknown, options: ErrorHandlerOptions = {}) => {
      const {
        title = t('errors.generic.title', 'An error occurred'),
        message: customMessage,
        showNotification = true,
        logToConsole = import.meta.env.DEV,
        componentName,
      } = options;

      // Extract error message
      let errorMessage = customMessage || t('errors.generic.message', 'Please try again later.');

      if (!customMessage) {
        if (axios.isAxiosError(error)) {
          // Handle Axios errors (API errors)
          const axiosError = error as AxiosError<{ message?: string; error?: string }>;

          if (axiosError.response) {
            // Server responded with error status
            const status = axiosError.response.status;
            const data = axiosError.response.data;

            // Extract error message from response
            errorMessage = data?.message || data?.error || t(`errors.http.${status}`, errorMessage);

            // Handle specific status codes
            if (status === 401) {
              errorMessage = t(
                'errors.unauthorized',
                'You are not authorized to perform this action.',
              );
            } else if (status === 403) {
              errorMessage = t('errors.forbidden', 'Access denied. You do not have permission.');
            } else if (status === 404) {
              errorMessage = t('errors.notFound', 'The requested resource was not found.');
            } else if (status === 429) {
              errorMessage = t('errors.rateLimited', 'Too many requests. Please try again later.');
            } else if (status >= 500) {
              errorMessage = t('errors.serverError', 'Server error. Please try again later.');
            }
          } else if (axiosError.request) {
            // Request made but no response (network error)
            errorMessage = t('errors.network', 'Network error. Please check your connection.');
          } else {
            // Error setting up request
            errorMessage = axiosError.message || errorMessage;
          }
        } else if (error instanceof Error) {
          // Handle standard Error objects
          errorMessage = error.message || errorMessage;
        } else if (typeof error === 'string') {
          // Handle string errors
          errorMessage = error;
        }
      }

      // Log to console in development
      if (logToConsole) {
        const logContext = componentName ? `[${componentName}]` : '';
        console.error(`${logContext} Error:`, error);
        if (axios.isAxiosError(error)) {
          console.error('Response:', error.response?.data);
          console.error('Status:', error.response?.status);
        }
      }

      // Show notification to user
      if (showNotification) {
        addNotification({
          variant: 'danger',
          title,
          description: errorMessage,
        });
      }

      // Return error details for component-specific handling
      return {
        title,
        message: errorMessage,
        originalError: error,
      };
    },
    [addNotification, t],
  );

  return { handleError };
}
```

#### Unit Tests

```typescript
// frontend/src/hooks/useErrorHandler.test.ts

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useErrorHandler } from './useErrorHandler';
import axios, { AxiosError } from 'axios';

// Mock dependencies
vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

describe('useErrorHandler', () => {
  let addNotification: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addNotification = vi.fn();
    vi.mocked(useNotification).mockReturnValue({ addNotification });
  });

  it('should handle AxiosError with response', () => {
    const { result } = renderHook(() => useErrorHandler());

    const axiosError: AxiosError = {
      response: {
        status: 400,
        data: { message: 'Invalid request' },
      },
    } as AxiosError;

    result.current.handleError(axiosError);

    expect(addNotification).toHaveBeenCalledWith({
      variant: 'danger',
      title: 'An error occurred',
      description: 'Invalid request',
    });
  });

  it('should handle 401 Unauthorized', () => {
    const { result } = renderHook(() => useErrorHandler());

    const axiosError: AxiosError = {
      response: {
        status: 401,
        data: {},
      },
    } as AxiosError;

    result.current.handleError(axiosError);

    expect(addNotification).toHaveBeenCalledWith({
      variant: 'danger',
      title: 'An error occurred',
      description: 'You are not authorized to perform this action.',
    });
  });

  it('should handle network errors', () => {
    const { result } = renderHook(() => useErrorHandler());

    const axiosError: AxiosError = {
      request: {},
      response: undefined,
    } as AxiosError;

    result.current.handleError(axiosError);

    expect(addNotification).toHaveBeenCalledWith({
      variant: 'danger',
      title: 'An error occurred',
      description: 'Network error. Please check your connection.',
    });
  });

  it('should handle Error objects', () => {
    const { result } = renderHook(() => useErrorHandler());

    const error = new Error('Something went wrong');

    result.current.handleError(error);

    expect(addNotification).toHaveBeenCalledWith({
      variant: 'danger',
      title: 'An error occurred',
      description: 'Something went wrong',
    });
  });

  it('should handle string errors', () => {
    const { result } = renderHook(() => useErrorHandler());

    result.current.handleError('Custom error message');

    expect(addNotification).toHaveBeenCalledWith({
      variant: 'danger',
      title: 'An error occurred',
      description: 'Custom error message',
    });
  });

  it('should support custom title and message', () => {
    const { result } = renderHook(() => useErrorHandler());

    result.current.handleError(new Error('Original'), {
      title: 'Custom Title',
      message: 'Custom Message',
    });

    expect(addNotification).toHaveBeenCalledWith({
      variant: 'danger',
      title: 'Custom Title',
      description: 'Custom Message',
    });
  });

  it('should support disabling notification', () => {
    const { result } = renderHook(() => useErrorHandler());

    result.current.handleError(new Error('Test'), {
      showNotification: false,
    });

    expect(addNotification).not.toHaveBeenCalled();
  });
});
```

#### Validation

```bash
# Run tests
npm --prefix frontend test useErrorHandler.test.ts

# Expected: All tests passing
```

---

### Step 2C.3: Standardize Error Handling in Components (2-3 hours)

#### Objective

Update all admin usage components to use `useErrorHandler` consistently.

#### Pattern to Apply

**Standard Pattern for React Query:**

```typescript
import { useErrorHandler } from '../../hooks/useErrorHandler';

const MyComponent: React.FC = () => {
  const { handleError } = useErrorHandler();

  // ✅ Correct: useErrorHandler in onError callback
  const { data, error, isLoading } = useQuery(
    ['queryKey', filters],
    () => apiService.fetchData(filters),
    {
      onError: (err) => handleError(err, {
        title: t('errors.fetchData.title', 'Failed to load data'),
        componentName: 'MyComponent',
      }),
      retry: 1, // Retry once on failure
      staleTime: 5 * 60 * 1000, // 5 minute cache
    }
  );

  // ✅ Correct: Optional useEffect for side effects on error
  React.useEffect(() => {
    if (error) {
      handleError(error);
    }
  }, [error, handleError]);

  // ❌ Remove: Manual error state
  // const [error, setError] = useState<Error | null>(null);

  // ❌ Remove: console.error
  // console.error(error);

  return <div>...</div>;
};
```

#### Components to Update

**1. UserBreakdownTable.tsx**:

```typescript
// Before
const { data: userBreakdown, error } = useQuery(
  ['userBreakdown', filters],
  () => adminUsageService.getUserBreakdown(filters)
);

if (error) {
  console.error('Failed to load user breakdown:', error);
  return <div>Error loading data</div>;
}

// After
const { handleError } = useErrorHandler();

const { data: response, error, isLoading } = useQuery(
  ['userBreakdown', filters, pagination.paginationParams],
  () => adminUsageService.getUserBreakdown(filters, pagination.paginationParams),
  {
    onError: (err) => handleError(err, {
      title: t('errors.userBreakdown.title', 'Failed to load user breakdown'),
      componentName: 'UserBreakdownTable',
    }),
    retry: 1,
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  }
);

React.useEffect(() => {
  if (error) {
    handleError(error);
  }
}, [error, handleError]);

// No error UI needed - handled by hook
```

**2. AdminUsagePage.tsx** (Analytics query):

```typescript
// Before
const { data: analytics } = useQuery(
  ['analytics', filters],
  () => adminUsageService.getAnalytics(filters),
  {
    onError: (error) => {
      console.error('Analytics error:', error);
      // No user notification
    },
  },
);

// After
const { handleError } = useErrorHandler();

const { data: analytics, error: analyticsError } = useQuery(
  ['analytics', filters],
  () => adminUsageService.getAnalytics(filters),
  {
    onError: (err) =>
      handleError(err, {
        title: t('errors.analytics.title', 'Failed to load analytics'),
        componentName: 'AdminUsagePage',
      }),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  },
);

React.useEffect(() => {
  if (analyticsError) {
    handleError(analyticsError);
  }
}, [analyticsError, handleError]);
```

**3. UsageTrends.tsx** (Chart component):

```typescript
// Before (no error handling)
const UsageTrends: React.FC<UsageTrendsProps> = ({ data }) => {
  // Component assumes data is valid
  return <div>{/* Chart rendering */}</div>;
};

// After
const UsageTrends: React.FC<UsageTrendsProps> = ({ data }) => {
  const { handleError } = useErrorHandler();

  // Validate data prop
  React.useEffect(() => {
    if (!data) {
      handleError(
        new Error('Missing required data prop'),
        {
          title: t('errors.chart.title', 'Chart data error'),
          componentName: 'UsageTrends',
          showNotification: false, // Don't spam user with chart errors
          logToConsole: true,
        }
      );
    }
  }, [data, handleError]);

  if (!data) {
    return (
      <EmptyState>
        <EmptyStateHeader
          titleText={t('charts.noData', 'No data available')}
          headingLevel="h4"
        />
      </EmptyState>
    );
  }

  return <div>{/* Chart rendering */}</div>;
};
```

**Update Checklist**:

- [ ] `AdminUsagePage.tsx` - Analytics query
- [ ] `AdminUsagePage.tsx` - Breakdown queries
- [ ] `UserBreakdownTable.tsx` - User breakdown query
- [ ] `ModelBreakdownTable.tsx` - Model breakdown query
- [ ] `ProviderBreakdownTable.tsx` - Provider breakdown query
- [ ] `UsageTrends.tsx` - Data validation
- [ ] `ModelUsageTrends.tsx` - Data validation
- [ ] `ModelDistributionChart.tsx` - Data validation
- [ ] `UsageHeatmap.tsx` - Data validation

---

### Step 2C.4: Update React Query Global Configuration (30 minutes)

#### Objective

Set default error handling configuration for all React Query queries.

#### Files to Modify

- `frontend/src/App.tsx` or `frontend/src/main.tsx` (wherever QueryClient is configured)

#### Implementation

```typescript
// frontend/src/App.tsx (or main.tsx)

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useErrorHandler } from './hooks/useErrorHandler';

/**
 * React Query configuration with standardized error handling
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Error handling
      retry: 1, // Retry failed queries once
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

      // Caching
      staleTime: 5 * 60 * 1000, // 5 minutes - data is "fresh" for this duration
      cacheTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache

      // Refetching
      refetchOnWindowFocus: false, // Don't auto-refetch on window focus (can be annoying)
      refetchOnReconnect: true, // Refetch when network reconnects

      // Error handling (global default)
      // Note: Components should still use useErrorHandler for custom messages
      onError: (error) => {
        // This is a fallback if component doesn't handle error
        console.error('Unhandled query error:', error);
      },
    },
    mutations: {
      // Mutations are more critical - retry less aggressively
      retry: 0, // Don't retry mutations (they may have side effects)

      // Error handling
      onError: (error) => {
        console.error('Unhandled mutation error:', error);
      },
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* App content */}
    </QueryClientProvider>
  );
}
```

#### Add React Query DevTools (Optional, Development Only)

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* App content */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

---

### Step 2C.5: Create Error Handling Guide (1 hour)

#### Objective

Document standardized error handling patterns for developers.

#### Files to Create

- `docs/development/error-handling-guide.md`

#### Implementation

````markdown
# Error Handling Guide

**Last Updated**: 2025-10-11

---

## Overview

This guide defines the **standardized error handling patterns** for the LiteMaaS frontend application.

**Key Principles**:

1. **Consistency** - All errors handled the same way
2. **User-Friendly** - Clear, actionable error messages
3. **Developer-Friendly** - Easy to debug in development
4. **Centralized** - Single source of truth (`useErrorHandler` hook)

---

## The useErrorHandler Hook

### Purpose

The `useErrorHandler` hook provides a **centralized, consistent way to handle errors** across the application.

**Features**:

- Extracts user-friendly messages from various error types (AxiosError, Error, string)
- Shows toast notifications to users
- Logs errors to console in development
- Supports custom error messages and titles
- Handles HTTP status codes (401, 403, 404, 429, 5xx)

### Basic Usage

```typescript
import { useErrorHandler } from '../../hooks/useErrorHandler';

const MyComponent: React.FC = () => {
  const { handleError } = useErrorHandler();

  const { data } = useQuery(
    ['queryKey'],
    apiCall,
    {
      onError: (err) => handleError(err),
    }
  );

  // Component renders normally
  return <div>{data?.content}</div>;
};
```
````

### Advanced Usage

**Custom error messages**:

```typescript
handleError(error, {
  title: t('errors.customTitle', 'Custom Error Title'),
  message: t('errors.customMessage', 'Custom error message'),
  componentName: 'MyComponent',
});
```

**Disable notification** (for non-critical errors):

```typescript
handleError(error, {
  showNotification: false,
  logToConsole: true, // Still log for debugging
});
```

---

## React Query Error Handling

### Standard Pattern

**✅ Correct**:

```typescript
const { handleError } = useErrorHandler();

const { data, error, isLoading } = useQuery(
  ['queryKey', filters],
  () => apiService.fetchData(filters),
  {
    // Handle error in onError callback
    onError: (err) =>
      handleError(err, {
        title: t('errors.fetchData.title', 'Failed to load data'),
        componentName: 'MyComponent',
      }),

    // Standard retry configuration
    retry: 1,

    // Keep previous data while loading (better UX)
    keepPreviousData: true,

    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  },
);

// Optional: Handle error in useEffect for side effects
React.useEffect(() => {
  if (error) {
    handleError(error);
  }
}, [error, handleError]);
```

**❌ Incorrect** (Don't do this):

```typescript
// ❌ Manual error state
const [error, setError] = useState<Error | null>(null);

// ❌ console.error instead of user notification
const { data, error } = useQuery(['key'], apiCall);
if (error) {
  console.error(error);
}

// ❌ Inline error message (not centralized)
return error ? <div>Error: {error.message}</div> : <div>{data}</div>;
```

---

## Error Message Guidelines

### Writing User-Friendly Error Messages

**DO**:

- ✅ Be specific: "Failed to load user breakdown" not "An error occurred"
- ✅ Be actionable: "Please try again" or "Please contact support"
- ✅ Be concise: 1-2 sentences maximum
- ✅ Use i18n: `t('errors.key', 'Fallback message')`

**DON'T**:

- ❌ Technical jargon: "500 Internal Server Error"
- ❌ Stack traces: "at Object.exports.default (admin-usage.service.ts:42)"
- ❌ Blame users: "You entered invalid data"
- ❌ Vague messages: "Something went wrong"

### HTTP Status Code Messages

| Status | User Message                                   |
| ------ | ---------------------------------------------- |
| 400    | "Invalid request. Please check your input."    |
| 401    | "You are not authorized. Please log in again." |
| 403    | "Access denied. You do not have permission."   |
| 404    | "The requested resource was not found."        |
| 429    | "Too many requests. Please try again later."   |
| 500    | "Server error. Please try again later."        |

---

## Testing Error Handling

### Unit Tests

**Test that errors are handled**:

```typescript
it('should handle errors with useErrorHandler', async () => {
  const handleError = vi.fn();
  vi.mocked(useErrorHandler).mockReturnValue({ handleError });

  const error = new Error('Test error');
  mockApiCall.mockRejectedValue(error);

  renderComponent();

  await waitFor(() => {
    expect(handleError).toHaveBeenCalledWith(error, expect.any(Object));
  });
});
```

### Manual Testing

**Test error scenarios**:

1. **Network error**: Disconnect network, trigger action
   - Expected: "Network error. Please check your connection."

2. **401 Unauthorized**: Use invalid token
   - Expected: "You are not authorized. Please log in again."

3. **429 Rate Limited**: Trigger rate limit
   - Expected: "Too many requests. Please try again later."

4. **500 Server Error**: Mock 500 response
   - Expected: "Server error. Please try again later."

---

## Migration Checklist

When updating a component to use standardized error handling:

- [ ] Import `useErrorHandler` hook
- [ ] Add `handleError` to React Query `onError`
- [ ] Remove manual error state (`useState<Error>`)
- [ ] Remove `console.error` calls
- [ ] Remove inline error UI (let hook handle notifications)
- [ ] Add custom error title/message if needed
- [ ] Add component name for debugging
- [ ] Test error scenarios
- [ ] Update component tests

---

## Code Review Checklist

When reviewing PRs, check for:

- [ ] All React Query queries use `onError: (err) => handleError(err)`
- [ ] No manual error state management
- [ ] No `console.error` for user-facing errors
- [ ] Error messages are user-friendly and i18n-ized
- [ ] Component name provided for debugging
- [ ] Error handling tested

---

## Common Patterns

### Pattern 1: Data Fetching with Error Handling

```typescript
const { handleError } = useErrorHandler();

const { data, isLoading } = useQuery(['users'], () => userService.getUsers(), {
  onError: (err) =>
    handleError(err, {
      title: t('errors.users.title', 'Failed to load users'),
    }),
});
```

### Pattern 2: Mutation with Error Handling

```typescript
const { handleError } = useErrorHandler();

const mutation = useMutation((data) => userService.createUser(data), {
  onError: (err) =>
    handleError(err, {
      title: t('errors.createUser.title', 'Failed to create user'),
    }),
  onSuccess: () => {
    addNotification({
      variant: 'success',
      title: t('success.createUser.title', 'User created'),
    });
  },
});
```

### Pattern 3: Multiple Error Sources

```typescript
const { handleError } = useErrorHandler();

const query1 = useQuery(['data1'], api.getData1, {
  onError: (err) => handleError(err, { title: 'Failed to load data 1' }),
});

const query2 = useQuery(['data2'], api.getData2, {
  onError: (err) => handleError(err, { title: 'Failed to load data 2' }),
});

// Both errors will be handled independently
```

---

## FAQ

**Q: Should I use `useErrorHandler` for all errors?**
A: Yes, for all user-facing errors. For internal/debugging errors that don't affect UX, you can use `console.warn` or `console.debug`.

**Q: What if I need custom error handling logic?**
A: Use the options parameter:

```typescript
handleError(error, {
  showNotification: false, // Disable notification
  logToConsole: true, // Still log for debugging
});
// Then add your custom logic
```

**Q: Should I show error UI in my component?**
A: Generally no - the hook handles user notification via toast. Only show inline error UI for critical features where toast isn't sufficient.

**Q: How do I test components with useErrorHandler?**
A: Mock the hook:

```typescript
vi.mock('../../hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({ handleError: vi.fn() }),
}));
```

---

## References

- **Hook Implementation**: `frontend/src/hooks/useErrorHandler.ts`
- **Notification Context**: `frontend/src/contexts/NotificationContext.tsx`
- **React Query Docs**: [Error Handling](https://tanstack.com/query/latest/docs/react/guides/query-functions#handling-and-throwing-errors)

````

---

### Step 2C.6: Update Code Review Checklist (15 minutes)

#### Objective

Add error handling checks to code review process.

#### Files to Modify

- `docs/development/code-review-checklist.md` (create if doesn't exist)

#### Implementation

```markdown
# Code Review Checklist

## Error Handling

**For all components**:

- [ ] All React Query queries use `onError: (err) => handleError(err)`
- [ ] `useErrorHandler` hook imported and used
- [ ] No manual error state management (`useState<Error>`)
- [ ] No `console.error` for user-facing errors (use `handleError` instead)
- [ ] Error messages are user-friendly and translated (i18n)
- [ ] Component name provided in `handleError` options for debugging
- [ ] Custom error titles for different error scenarios
- [ ] Error handling covered by tests

**Anti-patterns to reject**:

- ❌ `try/catch` with `console.error` instead of `handleError`
- ❌ React Query without `onError` callback
- ❌ Inline error UI instead of notifications
- ❌ Generic error messages ("An error occurred")
- ❌ Untranslated error messages
- ❌ Missing error handling tests

**Example**:

```typescript
// ✅ Approve
const { handleError } = useErrorHandler();
const { data } = useQuery(
  ['users'],
  fetchUsers,
  {
    onError: (err) => handleError(err, {
      title: t('errors.users.title', 'Failed to load users'),
      componentName: 'UserList',
    }),
  }
);

// ❌ Request changes
const { data, error } = useQuery(['users'], fetchUsers);
if (error) {
  console.error(error);
  return <div>Error: {error.message}</div>;
}
````

````

---

## Deliverables

After completing this session, you should have:

- [ ] **Error handling audit** documenting current state
- [ ] **Enhanced `useErrorHandler` hook** with comprehensive error handling
- [ ] **All components updated** to use standardized error handling
- [ ] **React Query global config** with default error handling
- [ ] **Error handling guide** for developers
- [ ] **Code review checklist** updated with error handling checks

### Files Created

- `docs/development/error-handling-audit.md` (~50 lines)
- `docs/development/error-handling-guide.md` (~400 lines)
- `docs/development/code-review-checklist.md` (~100 lines)

### Files Modified

- `frontend/src/hooks/useErrorHandler.ts` (~100 lines enhanced)
- `frontend/src/hooks/useErrorHandler.test.ts` (~200 lines)
- `frontend/src/pages/AdminUsagePage.tsx` (~50 lines modified)
- `frontend/src/components/admin/UserBreakdownTable.tsx` (~30 lines modified)
- `frontend/src/components/admin/ModelBreakdownTable.tsx` (~30 lines modified)
- `frontend/src/components/admin/ProviderBreakdownTable.tsx` (~30 lines modified)
- `frontend/src/components/charts/UsageTrends.tsx` (~20 lines modified)
- `frontend/src/components/charts/ModelUsageTrends.tsx` (~20 lines modified)
- `frontend/src/components/charts/ModelDistributionChart.tsx` (~20 lines modified)
- `frontend/src/components/charts/UsageHeatmap.tsx` (~20 lines modified)
- `frontend/src/App.tsx` or `frontend/src/main.tsx` (~30 lines modified)

### Metrics

- **Components Updated**: 10+
- **console.error Removed**: All instances
- **Error Handling Coverage**: 100% of React Query queries
- **User Notification Coverage**: 100% of user-facing errors

---

## Acceptance Criteria

Verify all criteria before marking session complete:

- [ ] **useErrorHandler Hook**: Handles all error types (AxiosError, Error, string)
- [ ] **HTTP Status Codes**: 401, 403, 404, 429, 5xx handled with appropriate messages
- [ ] **Network Errors**: Network failures handled with user-friendly message
- [ ] **React Query Integration**: All queries use `onError: handleError`
- [ ] **No console.error**: All instances replaced with `handleError`
- [ ] **No Manual Error State**: All `useState<Error>` removed
- [ ] **User Notifications**: All errors show toast notifications
- [ ] **i18n Support**: All error messages translated
- [ ] **Component Names**: All `handleError` calls include component name for debugging
- [ ] **Custom Messages**: Different error scenarios have appropriate titles/messages
- [ ] **Tests Updated**: Error handling covered by tests
- [ ] **Documentation**: Error handling guide complete
- [ ] **Code Review Checklist**: Updated with error handling checks

---

## Validation

### Manual Testing

**Test error scenarios in browser:**

1. **Network Error**:
   - Disconnect network
   - Try to load admin usage page
   - ✅ Should show: "Network error. Please check your connection."

2. **401 Unauthorized**:
   - Use invalid/expired token
   - Try to access admin page
   - ✅ Should show: "You are not authorized. Please log in again."

3. **404 Not Found**:
   - Mock API to return 404
   - Try to fetch data
   - ✅ Should show: "The requested resource was not found."

4. **429 Rate Limited**:
   - Trigger rate limit (make 11+ requests in 1 minute)
   - ✅ Should show: "Too many requests. Please try again later."

5. **500 Server Error**:
   - Mock API to return 500
   - Try to fetch data
   - ✅ Should show: "Server error. Please try again later."

6. **Multiple Errors**:
   - Trigger multiple errors in quick succession
   - ✅ All errors should show as separate notifications

### Automated Testing

```bash
# Run all tests
npm --prefix frontend test

# Run specific error handling tests
npm --prefix frontend test useErrorHandler.test.ts

# TypeScript check
npm --prefix frontend run typecheck

# Linter
npm --prefix frontend run lint
````

**Expected Results**:

- All tests passing
- No TypeScript errors
- No linting errors
- No console.error usage in production code

### Code Review

**Search for anti-patterns**:

```bash
# Should return NO results (except test files)
grep -r "console.error" frontend/src --exclude="*.test.ts*"

# Should return NO results (except test files)
grep -r "useState<Error" frontend/src --exclude="*.test.ts*"
```

---

## Phase 2 Checkpoint

### Phase 2 Summary

Phase 2 focused on **high-priority operational safeguards**:

**Completed Sessions**:

1. ✅ **Session 2A**: Backend Pagination (3-4h)
   - Added pagination type definitions
   - Created pagination utilities
   - Updated service methods with pagination
   - Updated route handlers
   - Added integration tests

2. ✅ **Session 2B**: Frontend Pagination (3-4h)
   - Created `usePagination` hook
   - Updated API service
   - Added PatternFly Pagination to all tables
   - Implemented sortable columns
   - Added component tests

3. ✅ **Session 2C**: Error Handling Standardization (4-6h)
   - Audited all error handling
   - Enhanced `useErrorHandler` hook
   - Standardized all components
   - Created error handling guide
   - Updated code review checklist

### Phase 2 Deliverables

- [ ] **Pagination** on all breakdown endpoints (backend + frontend)
- [ ] **Sorting** by all key metrics
- [ ] **Consistent error handling** across all components
- [ ] **Documentation** for pagination and error handling
- [ ] **Code review checklist** updated

### Phase 2 Validation

**Functional**:

- [ ] All breakdown tables show paginated data
- [ ] Pagination controls work correctly (prev/next/first/last)
- [ ] Per-page selection works (10, 25, 50, 100)
- [ ] Sorting works on all columns
- [ ] All errors show user-friendly notifications
- [ ] No console.error in production code

**Technical**:

- [ ] All tests passing (backend + frontend)
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] API response size reduced (< 100 KB vs. 5+ MB)
- [ ] Error handling coverage: 100%

**Documentation**:

- [ ] Pagination API documented
- [ ] Error handling guide created
- [ ] Code review checklist updated

### Phase 2 Metrics

**Before**:

- API response size: 5+ MB (all users)
- Frontend renders: 5,000+ rows at once
- Error handling: 3+ different patterns
- console.error usage: 15+ instances

**After**:

- API response size: < 100 KB (50 users per page)
- Frontend renders: 50 rows at once
- Error handling: 1 standardized pattern
- console.error usage: 0 instances

### Next Phase

**Phase 3: Architecture & Reliability** (13-18 hours):

- Session 3A: Configurable Constants (3-4h)
- Session 3B: Timezone Standardization (4-6h)
- Session 3C: Fix Race Conditions (6-8h)

**Ready to proceed?** ✅ / ❌

---

## Next Steps

After completing and validating this session:

1. **Commit changes**:

   ```bash
   git add .
   git commit -m "feat: standardize error handling across admin usage feature

   - Audit all error handling patterns
   - Enhance useErrorHandler hook with comprehensive error handling
   - Update all components to use standardized error handling
   - Configure React Query with default error handling
   - Create error handling guide for developers
   - Update code review checklist
   - Remove all console.error usage
   - Add comprehensive tests

   Implements Issue #7: Inconsistent Error Handling in Frontend
   Phase 2, Session 2C of remediation plan
   Completes Phase 2: High-Priority Operational Safeguards"
   ```

2. **Complete Phase 2 Checkpoint**:
   - Validate all Phase 2 deliverables
   - Run full test suite
   - Perform manual smoke tests
   - Get team sign-off

3. **Proceed to Phase 3** (if approved):
   - Session 3A: Configurable Constants
   - Session 3B: Timezone Standardization
   - Session 3C: Fix Race Conditions

4. **Update Progress Tracker**:
   - Mark Phase 2 as complete
   - Record total time for phase
   - Note any discoveries or deferred items

---

## Troubleshooting

### Common Issues

**Issue**: Errors not showing notifications

- **Cause**: `useErrorHandler` not called or notification disabled
- **Solution**: Verify `handleError(err)` is called and `showNotification` not set to `false`

**Issue**: Multiple notifications for same error

- **Cause**: Both `onError` and `useEffect` calling `handleError`
- **Solution**: Choose one pattern - prefer `onError` only

**Issue**: TypeScript error on AxiosError type

- **Cause**: Missing axios types
- **Solution**: `npm install --save-dev @types/axios`

**Issue**: Tests failing after adding error handling

- **Cause**: Mock not updated
- **Solution**: Mock `useErrorHandler`:
  ```typescript
  vi.mock('../../hooks/useErrorHandler', () => ({
    useErrorHandler: () => ({ handleError: vi.fn() }),
  }));
  ```

---

## Session Summary Template

```markdown
### Session 2C: Error Handling Standardization

**Date**: YYYY-MM-DD
**Duration**: X hours (estimated: 4-6 hours)
**Status**: ✅ Complete

#### Completed

- [x] Audited all error handling patterns
- [x] Enhanced useErrorHandler hook
- [x] Updated all components to use standardized error handling
- [x] Configured React Query defaults
- [x] Created error handling guide
- [x] Updated code review checklist
- [x] Removed all console.error usage

#### Metrics

- Components updated: 10+
- console.error removed: 15+ instances
- Error handling coverage: 100%
- Tests added: 20+

#### Discoveries

- [List any unexpected findings]

#### Phase 2 Complete

- All sessions complete
- Ready for Phase 2 checkpoint
```

---

**End of Session 2C Documentation**
**End of Phase 2 Documentation**

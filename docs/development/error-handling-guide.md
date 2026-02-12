# Error Handling Guide

**Last Updated**: 2025-10-12
**Status**: Official Standard

---

## Overview

This guide defines the **standardized error handling patterns** for the LiteMaaS frontend application.

**Key Principles**:

1. **Consistency** - All errors handled the same way across the application
2. **User-Friendly** - Clear, actionable error messages for end users
3. **Developer-Friendly** - Easy to debug in development with comprehensive logging
4. **Centralized** - Single source of truth (`useErrorHandler` hook)
5. **i18n Support** - All error messages properly internationalized

---

## Table of Contents

1. [The useErrorHandler Hook](#the-useerrorhandler-hook)
2. [React Query Error Handling](#react-query-error-handling)
3. [Error Message Guidelines](#error-message-guidelines)
4. [Common Patterns](#common-patterns)
5. [Testing Error Handling](#testing-error-handling)
6. [Migration Checklist](#migration-checklist)
7. [FAQ](#faq)

---

## The useErrorHandler Hook

### Purpose

The `useErrorHandler` hook provides a **centralized, consistent way to handle errors** across the application.

**Location**: `frontend/src/hooks/useErrorHandler.ts`

**Features**:

- ✅ Extracts user-friendly messages from various error types (AxiosError, Error, string)
- ✅ Shows toast notifications to users via NotificationContext
- ✅ Logs errors to console in development mode
- ✅ Supports custom error messages and titles
- ✅ Handles HTTP status codes (401, 403, 404, 429, 5xx) with appropriate messages
- ✅ Retry logic with exponential backoff
- ✅ Specialized handlers for different error types
- ✅ i18n integration for all messages

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

  // Component renders normally - errors are handled by the hook
  return <div>{data?.content}</div>;
};
```

### Advanced Usage

#### Custom Error Messages

```typescript
handleError(error, {
  fallbackMessageKey: 'errors.customError',
  // i18n key for fallback message
});

// With context for debugging
handleError(error, {
  fallbackMessageKey: 'adminUsage.errors.fetchMetrics',
  context: {
    component: 'AdminUsagePage',
    action: 'fetchMetrics',
  },
});
```

#### Disable Notification (for non-critical errors)

```typescript
handleError(error, {
  showNotification: false, // Don't show toast
  logError: true, // Still log for debugging
});
```

#### With Retry Logic

```typescript
handleError(error, {
  enableRetry: true,
  onRetry: async () => {
    // Retry logic here
    await refetchData();
  },
  maxRetries: 3,
});
```

### Specialized Handlers

#### Validation Errors

```typescript
const { handleValidationError } = useErrorHandler();

// Automatically uses 'info' variant and validation message keys
handleValidationError(error);
```

#### Network Errors

```typescript
const { handleNetworkError } = useErrorHandler();

// Automatically uses 'warning' variant and enables retry
handleNetworkError(error, {
  onRetry: () => refetchData(),
});
```

#### Authentication Errors

```typescript
const { handleAuthError } = useErrorHandler();

// Automatically uses 'danger' variant and auth-specific messages
handleAuthError(error);
```

#### Async Operation Wrapper

```typescript
const { withErrorHandler } = useErrorHandler();

// Wrap async functions with automatic error handling
const fetchData = withErrorHandler(
  async () => {
    const result = await apiService.getData();
    return result;
  },
  {
    fallbackMessageKey: 'errors.fetchData',
  },
);

// Use it
await fetchData(); // Errors are automatically handled
```

---

## React Query Error Handling

### Global Configuration

React Query is configured with global error handling defaults in `frontend/src/routes/index.tsx`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2, // Retry failed queries twice
      retryDelay: (
        attemptIndex, // Exponential backoff
      ) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false, // Don't disrupt user
      refetchOnReconnect: true, // Refetch on reconnect
      onError: (error) => {
        // Fallback handler
        if (import.meta.env.DEV) {
          console.error('Unhandled query error:', error);
        }
      },
    },
    mutations: {
      retry: 0, // Don't retry mutations (side effects)
      onError: (error) => {
        if (import.meta.env.DEV) {
          console.error('Unhandled mutation error:', error);
        }
      },
    },
  },
});
```

### Standard Pattern for Queries

**✅ CORRECT** - Use `onError` callback with `handleError`:

```typescript
const { handleError } = useErrorHandler();

const { data, isLoading } = useQuery(['queryKey', filters], () => apiService.fetchData(filters), {
  // Handle error in onError callback
  onError: (err) =>
    handleError(err, {
      fallbackMessageKey: 'errors.fetchData',
    }),

  // Standard query configuration
  keepPreviousData: true, // Better UX during pagination
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Component renders normally - no need for error state
```

**❌ WRONG** - Don't use both `onError` and `useEffect`:

```typescript
// ❌ DON'T DO THIS - Redundant error handling
const { data, error } = useQuery(['key'], apiCall, {
  onError: (err) => handleError(err), // ✅ Good
});

React.useEffect(() => {
  if (error) {
    handleError(error); // ❌ Redundant - error already handled
  }
}, [error, handleError]);
```

**❌ WRONG** - Don't use manual error state:

```typescript
// ❌ DON'T DO THIS - Manual error management
const [error, setError] = useState<Error | null>(null);

const { data } = useQuery(['key'], apiCall, {
  onError: (err) => {
    setError(err);         // ❌ Manual state
    console.error(err);    // ❌ Console instead of notification
  },
});

if (error) {
  return <div>Error: {error.message}</div>;  // ❌ Inline error UI
}
```

### Standard Pattern for Mutations

```typescript
const { handleError } = useErrorHandler();
const { addNotification } = useNotifications();

const mutation = useMutation((data) => userService.createUser(data), {
  onError: (err) =>
    handleError(err, {
      fallbackMessageKey: 'errors.createUser',
    }),
  onSuccess: () => {
    addNotification({
      variant: 'success',
      title: t('success.createUser'),
      description: t('success.userCreated'),
    });
  },
});
```

### Pattern with Try/Catch (Async Handlers)

For async operations in event handlers, use try/catch with `handleError`:

```typescript
const { handleError } = useErrorHandler();
const { addNotification } = useNotifications();

const handleRefresh = async () => {
  try {
    setIsRefreshing(true);
    await apiService.refreshData();
    await refetchQueries();

    addNotification({
      variant: 'success',
      title: t('success.refreshed'),
    });
  } catch (error) {
    handleError(error, {
      fallbackMessageKey: 'errors.refresh',
    });
  } finally {
    setIsRefreshing(false);
  }
};
```

---

## Error Message Guidelines

### Writing User-Friendly Error Messages

**DO**:

- ✅ **Be specific**: "Failed to load user breakdown" not "An error occurred"
- ✅ **Be actionable**: "Please try again" or "Please contact support if this persists"
- ✅ **Be concise**: 1-2 sentences maximum
- ✅ **Use i18n**: Always use `t('errors.key', 'Fallback message')`
- ✅ **Provide context**: Include what failed (e.g., "Failed to load usage metrics")

**DON'T**:

- ❌ **Technical jargon**: "500 Internal Server Error" or "AxiosError: Request failed"
- ❌ **Stack traces**: Never show stack traces to users
- ❌ **Blame users**: "You entered invalid data" → Use "Please check your input"
- ❌ **Vague messages**: "Something went wrong" → Be specific about what failed

### HTTP Status Code Messages

The `useErrorHandler` hook automatically handles common HTTP status codes:

| Status  | User Message (i18n key)                                                | Variant |
| ------- | ---------------------------------------------------------------------- | ------- |
| 400     | `errors.badRequest` - "Invalid request. Please check your input."      | danger  |
| 401     | `errors.unauthorized` - "You are not authorized. Please log in again." | danger  |
| 403     | `errors.forbidden` - "Access denied. You do not have permission."      | danger  |
| 404     | `errors.notFound` - "The requested resource was not found."            | danger  |
| 429     | `errors.rateLimited` - "Too many requests. Please try again later."    | warning |
| 500+    | `errors.serverError` - "Server error. Please try again later."         | danger  |
| Network | `errors.network` - "Network error. Please check your connection."      | warning |

### i18n Keys Convention

Error message keys should follow this pattern:

```
errors.<context>.<specific>
```

**Examples**:

- `errors.general` - Generic fallback
- `errors.network.general` - Network errors
- `errors.auth.unauthorized` - Authentication errors
- `errors.validation.general` - Validation errors
- `adminUsage.errors.fetchMetrics` - Feature-specific errors
- `adminUsage.errors.refresh` - Action-specific errors

**Translation Files** (`frontend/src/i18n/locales/*/translation.json`):

```json
{
  "errors": {
    "general": "An error occurred. Please try again.",
    "network": {
      "general": "Network error. Please check your connection and try again."
    },
    "auth": {
      "unauthorized": "You are not authorized to perform this action.",
      "sessionExpired": "Your session has expired. Please log in again."
    }
  },
  "adminUsage": {
    "errors": {
      "fetchMetrics": "Failed to load usage metrics. Please try again.",
      "refresh": "Failed to refresh data. Please try again."
    }
  }
}
```

---

## Common Patterns

### Pattern 1: Data Fetching with Error Handling

```typescript
import { useQuery } from 'react-query';
import { useErrorHandler } from '../../hooks/useErrorHandler';

const MyComponent: React.FC = () => {
  const { handleError } = useErrorHandler();

  const { data, isLoading } = useQuery(
    ['users'],
    () => userService.getUsers(),
    {
      onError: (err) => handleError(err, {
        fallbackMessageKey: 'errors.users.fetch',
      }),
      staleTime: 5 * 60 * 1000,
    }
  );

  if (isLoading) return <Spinner />;

  return <UserList users={data} />;
};
```

### Pattern 2: Mutation with Error Handling

```typescript
import { useMutation } from 'react-query';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { useNotifications } from '../../contexts/NotificationContext';

const MyComponent: React.FC = () => {
  const { handleError } = useErrorHandler();
  const { addNotification } = useNotifications();

  const createMutation = useMutation(
    (data) => userService.createUser(data),
    {
      onError: (err) => handleError(err, {
        fallbackMessageKey: 'errors.users.create',
      }),
      onSuccess: () => {
        addNotification({
          variant: 'success',
          title: t('success.users.created'),
        });
      },
    }
  );

  const handleSubmit = (formData) => {
    createMutation.mutate(formData);
  };

  return <UserForm onSubmit={handleSubmit} />;
};
```

### Pattern 3: Paginated Data with Error Handling

```typescript
import { useQuery } from 'react-query';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { usePagination } from '../../hooks/usePagination';

const MyTable: React.FC = () => {
  const { handleError } = useErrorHandler();
  const pagination = usePagination();

  const { data, isLoading } = useQuery(
    ['users', pagination.paginationParams],
    () => userService.getUsers(pagination.paginationParams),
    {
      onError: (err) => handleError(err, {
        fallbackMessageKey: 'errors.users.fetch',
      }),
      keepPreviousData: true,  // Keep previous page while loading
      staleTime: 5 * 60 * 1000,
    }
  );

  return (
    <>
      <Table data={data?.items} />
      <Pagination {...pagination} total={data?.total} />
    </>
  );
};
```

### Pattern 4: Multiple Error Sources

```typescript
const MyComponent: React.FC = () => {
  const { handleError } = useErrorHandler();

  // Multiple queries with independent error handling
  const query1 = useQuery(['data1'], api.getData1, {
    onError: (err) =>
      handleError(err, {
        fallbackMessageKey: 'errors.data1',
      }),
  });

  const query2 = useQuery(['data2'], api.getData2, {
    onError: (err) =>
      handleError(err, {
        fallbackMessageKey: 'errors.data2',
      }),
  });

  // Both errors will be handled independently
  // Users will see separate notifications for each error
};
```

### Pattern 5: Async Event Handler with Error Handling

```typescript
const MyComponent: React.FC = () => {
  const { handleError } = useErrorHandler();
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async () => {
    try {
      setIsLoading(true);
      const result = await apiService.performAction();

      addNotification({
        variant: 'success',
        title: t('success.actionCompleted'),
      });
    } catch (error) {
      handleError(error, {
        fallbackMessageKey: 'errors.actionFailed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleAction} isLoading={isLoading}>
      {t('actions.performAction')}
    </Button>
  );
};
```

---

## Testing Error Handling

### Unit Tests

**Mock the hook**:

```typescript
import { vi } from 'vitest';
import { useErrorHandler } from '../../hooks/useErrorHandler';

// Mock the hook
vi.mock('../../hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: vi.fn(),
  }),
}));

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

**Test error scenarios**:

```typescript
it('should display error notification on fetch failure', async () => {
  const mockHandleError = vi.fn();
  vi.mocked(useErrorHandler).mockReturnValue({
    handleError: mockHandleError,
  });

  // Simulate API error
  mockApiService.getUsers.mockRejectedValue(
    new Error('Network error')
  );

  render(<UserList />);

  await waitFor(() => {
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        fallbackMessageKey: 'errors.users.fetch',
      })
    );
  });
});
```

### Manual Testing Scenarios

Test these error scenarios in the browser:

1. **Network Error**:
   - Disconnect network
   - Try to load data
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
   - Trigger rate limit (make many requests quickly)
   - ✅ Should show: "Too many requests. Please try again later."

5. **500 Server Error**:
   - Mock API to return 500
   - Try to fetch data
   - ✅ Should show: "Server error. Please try again later."

6. **Multiple Errors**:
   - Trigger multiple errors in quick succession
   - ✅ All errors should show as separate notifications

---

## Migration Checklist

When updating a component to use standardized error handling:

- [ ] Import `useErrorHandler` hook
- [ ] Add `handleError` to React Query `onError` callbacks
- [ ] Remove manual error state (`useState<Error>`)
- [ ] Remove `console.error` calls (use `handleError` instead)
- [ ] Remove inline error UI (let notifications handle it, unless critical feature)
- [ ] Remove redundant `useEffect` error handlers (if using `onError`)
- [ ] Add custom error title/message with appropriate i18n keys
- [ ] Add context information for debugging (component name, action)
- [ ] Test error scenarios (network, 401, 404, 500)
- [ ] Update component tests to mock `useErrorHandler`

---

## Code Review Checklist

When reviewing PRs, check for:

### Error Handling

- [ ] All React Query queries use `onError: (err) => handleError(err)`
- [ ] `useErrorHandler` hook imported and used correctly
- [ ] No manual error state management (`useState<Error>`)
- [ ] No `console.error` for user-facing errors (use `handleError` instead)
- [ ] Error messages are user-friendly and i18n-ized
- [ ] Appropriate i18n keys provided (`fallbackMessageKey`)
- [ ] Context provided for debugging when helpful
- [ ] Custom error titles for different error scenarios
- [ ] No redundant error handling (both `onError` and `useEffect`)

### Anti-patterns to Reject

- ❌ `try/catch` with `console.error` instead of `handleError`
- ❌ React Query without `onError` callback
- ❌ Both `onError` callback AND `useEffect` handling same error
- ❌ Inline error UI instead of notifications (unless critical feature)
- ❌ Generic error messages ("An error occurred")
- ❌ Untranslated error messages (hardcoded strings)
- ❌ Missing error handling tests

### Example Review Comments

**✅ APPROVE**:

```typescript
const { handleError } = useErrorHandler();

const { data } = useQuery(['users'], fetchUsers, {
  onError: (err) =>
    handleError(err, {
      fallbackMessageKey: 'errors.users.fetch',
    }),
});
```

**❌ REQUEST CHANGES**:

```typescript
// Missing useErrorHandler
const { data, error } = useQuery(['users'], fetchUsers);

if (error) {
  console.error(error);  // ❌ Should use handleError
  return <div>Error: {error.message}</div>;  // ❌ Inline error UI
}
```

**Comment**: "Please use `useErrorHandler` hook for consistent error handling. See [Error Handling Guide](./error-handling-guide.md)."

---

## FAQ

### Q: Should I use `useErrorHandler` for all errors?

**A**: Yes, for all user-facing errors. For internal/debugging errors that don't affect UX, you can use `console.warn` or `console.debug`.

### Q: What if I need custom error handling logic?

**A**: Use the options parameter to customize behavior:

```typescript
handleError(error, {
  showNotification: false, // Disable notification
  logError: true,          // Still log for debugging
  context: { ... },        // Add context
});

// Then add your custom logic
if (isSpecialError(error)) {
  // Custom handling here
}
```

### Q: Should I show error UI in my component?

**A**: Generally no - the hook handles user notification via toast. Only show inline error UI for critical features where toast notifications aren't sufficient (e.g., login form, payment form).

### Q: How do I test components with useErrorHandler?

**A**: Mock the hook in your tests:

```typescript
vi.mock('../../hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({ handleError: vi.fn() }),
}));
```

### Q: Should I use both `onError` and `useEffect`?

**A**: No - this is redundant and will cause duplicate notifications. Use `onError` only for React Query errors.

### Q: What about errors in chart components?

**A**: Chart components receive data as props and don't fetch directly. Parent components handle errors. Charts only need validation for missing props, which can log to console in development.

### Q: How do I handle validation errors differently?

**A**: Use the specialized handler:

```typescript
const { handleValidationError } = useErrorHandler();

handleValidationError(error); // Uses 'info' variant and validation keys
```

### Q: Can I retry failed operations?

**A**: Yes, use the retry options:

```typescript
handleError(error, {
  enableRetry: true,
  onRetry: () => refetchData(),
  maxRetries: 3,
});
```

### Q: What if I need to handle errors in multiple languages?

**A**: All error messages use i18n. Add translations to locale files:

```json
// frontend/src/i18n/locales/en/translation.json
{
  "errors": {
    "myFeature": {
      "fetchFailed": "Failed to load data"
    }
  }
}

// frontend/src/i18n/locales/es/translation.json
{
  "errors": {
    "myFeature": {
      "fetchFailed": "Error al cargar datos"
    }
  }
}
```

---

## References

- **Hook Implementation**: `frontend/src/hooks/useErrorHandler.ts`
- **Error Utilities**: `frontend/src/utils/error.utils.ts`
- **Notification Context**: `frontend/src/contexts/NotificationContext.tsx`
- **React Query Config**: `frontend/src/routes/index.tsx`
- **React Query Docs**: [Error Handling](https://tanstack.com/query/latest/docs/react/guides/query-functions#handling-and-throwing-errors)
- **PatternFly Notifications**: [Alert Component](https://www.patternfly.org/components/alert)

---

**End of Error Handling Guide**

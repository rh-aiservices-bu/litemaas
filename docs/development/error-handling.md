# Error Handling Best Practices Guide

This guide provides comprehensive documentation on implementing error handling in LiteMaaS. It covers both backend and frontend patterns, best practices, and practical examples.

## Overview

LiteMaaS implements a two-tier error handling system:

1. **Backend**: Structured `ApplicationError` class with standardized error responses
2. **Frontend**: `useErrorHandler` hook with automatic notification display and retry mechanisms

## Backend Error Handling

### ApplicationError Class

The `ApplicationError` class provides structured error handling with consistent formatting:

```typescript
import { ApplicationError } from '../utils/errors';

// Factory methods for common error types
ApplicationError.validation('Invalid email format', 'email', email, 'Please provide a valid email');
ApplicationError.notFound('User', userId, 'Check the user ID and try again');
ApplicationError.alreadyExists('User', 'email', email, 'Use a different email address');
ApplicationError.unauthorized('Authentication required');
ApplicationError.forbidden('Admin access required', 'admin');
ApplicationError.rateLimited(100, '1 minute', 60);
ApplicationError.externalService('LiteLLM', '502', 'Service unavailable', true);
```

### Available Factory Methods

| Factory Method         | HTTP Status | Use Case                                 |
| ---------------------- | ----------- | ---------------------------------------- |
| `validation()`         | 400         | Input validation errors                  |
| `unauthorized()`       | 401         | Authentication required                  |
| `forbidden()`          | 403         | Access denied / insufficient permissions |
| `notFound()`           | 404         | Resource not found                       |
| `alreadyExists()`      | 409         | Resource already exists                  |
| `rateLimited()`        | 429         | Rate limit exceeded                      |
| `internal()`           | 500         | Internal server errors                   |
| `externalService()`    | 502         | External service errors                  |
| `serviceUnavailable()` | 503         | Service temporarily down                 |
| `timeout()`            | 504         | Operation timeout                        |
| `database()`           | 500         | Database operation failed                |
| `litellmError()`       | 502         | LiteLLM service specific errors          |

### BaseService Error Methods

All services should extend `BaseService` for consistent error handling:

```typescript
export class UserService extends BaseService {
  async createUser(userData: CreateUserRequest) {
    // Validate input
    this.validateRequiredFields(userData, ['email', 'name']);
    this.validateEmail(userData.email);

    try {
      // Check for existing user
      const existingUser = await this.findUserByEmail(userData.email);
      if (existingUser) {
        throw this.createAlreadyExistsError('User', 'email', userData.email);
      }

      // Create user
      return await this.executeQuery('INSERT INTO users...', [userData]);
    } catch (error) {
      // Re-throw ApplicationError instances
      if (error instanceof ApplicationError) throw error;

      // Map database errors
      throw this.mapDatabaseError(error, 'user creation');
    }
  }
}
```

### Built-in Error Creation Methods

```typescript
// Resource not found
this.createNotFoundError('User', userId, 'Check the user ID and try again');

// Resource already exists
this.createAlreadyExistsError('User', 'email', email, 'Use a different email');

// Validation errors
this.createValidationError('Invalid format', 'field', value, 'Suggestion');

// Multiple validation errors
this.createMultipleValidationErrors('Validation failed', [
  { field: 'email', message: 'Invalid format', code: 'INVALID_FORMAT' },
  { field: 'name', message: 'Required', code: 'REQUIRED' },
]);

// Authorization errors
this.createUnauthorizedError('Login required');
this.createForbiddenError('Admin access required', 'admin');
```

### Built-in Validation Methods

```typescript
// Validate required fields
this.validateRequiredFields(data, ['email', 'name', 'password']);

// Format validations (throw ValidationError if invalid)
this.validateUUID(userId, 'userId');
this.validateEmail(email, 'email');
this.validateModelId(modelId, 'modelId');
this.validateModelIdArray(modelIds, 'modelIds');
```

### Database Error Handling

Use database wrapper methods for automatic error mapping:

```typescript
// Single query with error mapping
const result = await this.executeQuery('SELECT * FROM users WHERE id = $1', [userId], 'fetch user');

// Single row query (throws NotFoundError if no results)
const user = await this.executeQueryOne(
  'SELECT * FROM users WHERE id = $1',
  [userId],
  'fetch user',
);

// Transaction with automatic rollback on errors
const result = await this.executeTransaction(async (client) => {
  await client.query('INSERT INTO users...');
  await client.query('INSERT INTO user_roles...');
  return user;
}, 'create user with roles');
```

### PostgreSQL Error Mapping

The system automatically maps PostgreSQL errors to appropriate ApplicationError types:

- **23505** (Unique violation) → `AlreadyExistsError`
- **23503** (Foreign key violation) → `NotFoundError` (referenced resource)
- **23502** (Not null violation) → `ValidationError`
- **23514** (Check constraint violation) → `ValidationError`
- **08xxx** (Connection errors) → `ServiceUnavailableError`
- **57014** (Query timeout) → `TimeoutError`

### Route Error Handling

Routes should let the global error handler process ApplicationError instances:

```typescript
// ❌ Old pattern - manual error response
fastify.get('/users/:id', async (request, reply) => {
  try {
    const user = await userService.getById(request.params.id);
    return user;
  } catch (error) {
    fastify.log.error(error);
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get user' },
    });
  }
});

// ✅ New pattern - throw ApplicationError, let global handler process
fastify.get('/users/:id', async (request) => {
  // ApplicationError instances are automatically handled by global error handler
  return await userService.getById(request.params.id);
});
```

### Error Response Format

All ApplicationError instances produce standardized responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "statusCode": 400,
    "details": {
      "field": "email",
      "value": "invalid-email",
      "suggestion": "Please provide a valid email address",
      "constraint": "email_format"
    },
    "requestId": "req_123",
    "correlationId": "corr_456",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "retry": {
      "retryable": false,
      "retryAfter": null,
      "maxRetries": null,
      "backoffType": "exponential",
      "jitter": true
    }
  }
}
```

## Frontend Error Handling

### useErrorHandler Hook

The `useErrorHandler` hook provides comprehensive client-side error handling:

```typescript
import { useErrorHandler } from '../hooks/useErrorHandler';

function Component() {
  const {
    handleError,
    handleValidationError,
    handleNetworkError,
    handleAuthError,
    withErrorHandler,
  } = useErrorHandler();

  // Basic error handling
  const handleAction = async () => {
    try {
      await apiService.performAction();
      showSuccessMessage();
    } catch (error) {
      handleError(error);
    }
  };

  // Specialized error handling
  const handleFormSubmit = async (data: FormData) => {
    try {
      await apiService.submitForm(data);
    } catch (error) {
      // Shows validation-specific notifications
      handleValidationError(error, {
        context: { form: 'user-registration' },
      });
    }
  };

  // Network error with retry
  const handleNetworkOperation = async () => {
    try {
      await apiService.fetchData();
    } catch (error) {
      // Automatically enables retry for network errors
      handleNetworkError(error, {
        onRetry: () => apiService.fetchData(),
        maxRetries: 3,
        context: { operation: 'fetch-data' },
      });
    }
  };
}
```

### Error Handler Options

```typescript
interface ErrorHandlerOptions {
  showNotification?: boolean; // Show toast notification (default: true)
  logError?: boolean; // Log error to console (default: dev mode)
  onError?: (error: unknown, extracted: ExtractedError) => void; // Custom handler
  fallbackMessageKey?: string; // i18n key for fallback message
  enableRetry?: boolean; // Enable retry functionality
  onRetry?: () => Promise<void>; // Retry callback function
  maxRetries?: number; // Maximum retry attempts
  notificationVariant?: 'danger' | 'warning' | 'info'; // Toast variant
  context?: Record<string, any>; // Additional context for logging
}
```

### Higher-Order Error Handler

Wrap async functions for automatic error handling:

```typescript
const Component = () => {
  const { withErrorHandler } = useErrorHandler();

  // Automatically handles errors from async operations
  const handleClick = withErrorHandler(
    async () => {
      await apiService.performAction();
      showSuccessMessage();
    },
    {
      enableRetry: true,
      onRetry: () => apiService.performAction(),
      context: { component: 'Component', action: 'performAction' }
    }
  );

  return <Button onClick={handleClick}>Perform Action</Button>;
};
```

### Advanced Error Handling Patterns

#### Retry with Exponential Backoff

```typescript
const { handleError } = useErrorHandler();

const retryWithBackoff = async (fn: () => Promise<any>, retries = 3) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, 4 - retries) * 1000));
      return retryWithBackoff(fn, retries - 1);
    }

    handleError(error, {
      fallbackMessageKey: 'errors.operationFailed',
      context: { maxRetriesExceeded: true },
    });
  }
};
```

#### Form Validation with Field-Specific Errors

```typescript
const { handleValidationError } = useErrorHandler();

const handleFormError = (error: any) => {
  handleValidationError(error, {
    onError: (_, extracted) => {
      // Handle field-specific validation errors
      if (extracted.validation) {
        extracted.validation.forEach((fieldError) => {
          setFieldError(fieldError.field, fieldError.message);
        });
      }
    },
  });
};
```

#### Silent Error Handling for Background Operations

```typescript
const { handleError } = useErrorHandler();

// Handle error without showing notification (for background operations)
const backgroundOperation = async () => {
  try {
    await syncData();
  } catch (error) {
    handleError(error, {
      showNotification: false,
      onError: (error, extracted) => {
        // Log to analytics or error reporting service
        analytics.reportError(extracted);
      },
    });
  }
};
```

### Error Boundaries

#### Global Error Boundary

```typescript
// App-level error boundary for unhandled React errors
<ErrorBoundary
  fallback={<ErrorPage />}
  onError={(error, errorInfo) => {
    console.error('Unhandled React error:', error, errorInfo);
    // Send to monitoring service
  }}
>
  <App />
</ErrorBoundary>
```

#### Component Error Boundary

```typescript
// Component-level error isolation
<ComponentErrorBoundary componentName="UserProfile">
  <UserProfileComponent />
</ComponentErrorBoundary>

// Custom error boundary implementation
const ComponentErrorBoundary: React.FC<{
  children: React.ReactNode;
  componentName: string;
}> = ({ children, componentName }) => {
  return (
    <ErrorBoundary
      fallback={
        <Alert variant="warning" title={`Error in ${componentName}`}>
          This component encountered an error and has been disabled.
          <Button variant="link" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </Alert>
      }
      onError={(error) => {
        console.error(`Error in ${componentName}:`, error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

### React Query Integration

```typescript
// Global error handling for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }

        // Retry up to 3 times for server errors
        return failureCount < 3;
      },
      onError: (error: any) => {
        // Don't show notifications for background refetches
        if (!error.isBackground) {
          useErrorHandler().handleError(error);
        }
      },
    },
    mutations: {
      onError: (error: any) => {
        // Always show errors for user actions
        useErrorHandler().handleError(error, {
          enableRetry: error.retryable || false,
        });
      },
    },
  },
});
```

### Component Error Handling Pattern

```typescript
const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    handleError,
    handleValidationError,
    handleNetworkError,
    withErrorHandler
  } = useErrorHandler();

  // Query with error handling
  const {
    data: users,
    isLoading,
    error: queryError,
    refetch
  } = useQuery(['users'], userService.getAll, {
    onError: (error) => {
      handleNetworkError(error, {
        onRetry: () => refetch(),
        maxRetries: 3,
        context: { page: 'user-management', operation: 'fetch-users' }
      });
    }
  });

  // Mutation with validation error handling
  const createUserMutation = useMutation(userService.create, {
    onError: (error) => {
      handleValidationError(error, {
        context: { form: 'create-user' }
      });
    },
    onSuccess: () => {
      addNotification({
        title: t('users.created'),
        variant: 'success'
      });
    }
  });

  // Loading state
  if (isLoading) {
    return (
      <PageSection>
        <Spinner size="xl" />
      </PageSection>
    );
  }

  // Error state with fallback UI
  if (queryError) {
    return (
      <PageSection>
        <EmptyState variant="error">
          <EmptyStateIcon icon={ExclamationTriangleIcon} />
          <Title headingLevel="h4" size="lg">
            {t('errors.failedToLoadUsers')}
          </Title>
          <EmptyStateBody>
            {t('errors.failedToLoadUsersDescription')}
          </EmptyStateBody>
          <Button onClick={() => refetch()}>
            {t('common.tryAgain')}
          </Button>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <ComponentErrorBoundary componentName="UserManagementPage">
      <PageSection>
        {/* Component content */}
      </PageSection>
    </ComponentErrorBoundary>
  );
};
```

## Best Practices

### Backend

1. **Always use ApplicationError**: Never throw generic `Error` instances in services
2. **Use factory methods**: Prefer `ApplicationError.notFound()` over manual construction
3. **Provide helpful suggestions**: Include actionable guidance in error details
4. **Map database errors**: Use `this.mapDatabaseError()` for database operations
5. **Validate early**: Check inputs before expensive operations
6. **Log contextually**: Include relevant context in error logs
7. **Handle retryable errors**: Mark errors as retryable when appropriate
8. **Use BaseService methods**: Leverage built-in error creation and validation methods

### Frontend

1. **Use specific error handlers**: Choose `handleValidationError`, `handleNetworkError`, or `handleAuthError` over generic `handleError`
2. **Provide retry mechanisms**: Enable retry for transient errors (network, service unavailable)
3. **Include helpful context**: Add relevant context for debugging
4. **Test error states**: Ensure error boundaries and handlers work correctly
5. **Accessibility**: Error messages must be announced to screen readers
6. **Graceful degradation**: Show fallback UI instead of white screens
7. **Use error boundaries**: Isolate errors to prevent app crashes

### General

1. **Consistent error format**: Use standardized error responses across all layers
2. **User-friendly messages**: Provide contextual, actionable error messages
3. **Internationalization**: Support all 9 languages for error messages
4. **Development support**: Enhanced error logging in development mode
5. **Monitor errors**: Log errors with sufficient context for debugging
6. **Test error paths**: Write tests for error scenarios
7. **Document errors**: Document expected error responses in API documentation

## Common Anti-Patterns to Avoid

### Backend

```typescript
// ❌ Don't use generic Error
throw new Error('User not found');

// ✅ Use ApplicationError
throw ApplicationError.notFound('User', userId);

// ❌ Don't manually construct error responses
return reply.status(400).send({ error: 'Invalid input' });

// ✅ Throw ApplicationError and let global handler process
throw ApplicationError.validation('Invalid input', field, value);

// ❌ Don't ignore error context
throw ApplicationError.database('Query failed');

// ✅ Include context for debugging
throw this.mapDatabaseError(error, 'user creation');
```

### Frontend

```typescript
// ❌ Don't ignore errors silently
apiService.performAction().catch(() => {});

// ✅ Handle errors appropriately
apiService.performAction().catch(handleError);

// ❌ Don't show generic error messages
alert('An error occurred');

// ✅ Use error handler with context
handleError(error, {
  context: { action: 'create-user' },
  fallbackMessageKey: 'users.createError'
});

// ❌ Don't let components crash the entire app
<UserProfile userId={userId} />

// ✅ Use error boundaries for isolation
<ComponentErrorBoundary componentName="UserProfile">
  <UserProfile userId={userId} />
</ComponentErrorBoundary>
```

## Testing Error Handling

### Backend Testing

```typescript
describe('UserService', () => {
  it('should throw ApplicationError for invalid email', async () => {
    const userService = new UserService(fastify);

    await expect(userService.createUser({ email: 'invalid-email', name: 'Test' })).rejects.toThrow(
      ApplicationError,
    );

    const error = await userService
      .createUser({ email: 'invalid-email', name: 'Test' })
      .catch((err) => err);

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details.field).toBe('email');
  });
});
```

### Frontend Testing

```typescript
describe('useErrorHandler', () => {
  it('should display error notification', async () => {
    const { result } = renderHook(() => useErrorHandler());
    const error = new Error('Test error');

    act(() => {
      result.current.handleError(error);
    });

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should enable retry for network errors', async () => {
    const mockRetry = jest.fn();
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleNetworkError(new Error('Network error'), {
        onRetry: mockRetry,
        maxRetries: 3,
      });
    });

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    expect(mockRetry).toHaveBeenCalled();
  });
});
```

## Monitoring and Debugging

### Error Logging

```typescript
// Backend: Use contextual logging
fastify.log.error(
  {
    error: error.message,
    code: error.code,
    userId: request.user?.userId,
    url: request.url,
    method: request.method,
    requestId: request.id,
    correlationId: error.correlationId,
  },
  'Application error occurred',
);

// Frontend: Enhanced development logging
if (process.env.NODE_ENV === 'development') {
  console.group('🚨 Error Handler');
  console.error('Original error:', error);
  console.table(extractedErrorDetails);
  console.log('Additional context:', context);
  console.groupEnd();
}
```

### Error Metrics

Track error patterns for monitoring:

- Error frequency by type/code
- User impact (which users see which errors)
- Recovery success rate (retry attempts)
- Component/service error rates
- Response time impact from errors

### Debugging Tools

- Request correlation IDs for tracing errors across services
- Structured logging with consistent fields
- Error context preservation through stack traces
- Development-mode error overlays and enhanced logging

## Migration Guide

### From Legacy Error Handling

1. **Replace generic Error throws** with ApplicationError factory methods
2. **Remove manual error response construction** in routes
3. **Add error boundaries** to React components
4. **Implement useErrorHandler** in frontend components
5. **Update error message translations** for all supported languages
6. **Add error handling tests** for new patterns

### Gradual Migration Strategy

1. Start with new features using new error handling patterns
2. Update critical paths and user-facing features
3. Convert existing services one at a time
4. Update tests to use new error expectations
5. Monitor error logs during transition
6. Remove deprecated patterns after full migration

This guide provides the foundation for consistent, user-friendly error handling across the entire LiteMaaS application. Following these patterns ensures a better developer experience and improved user satisfaction.

# LiteMaaS Error Handling Architecture

## Executive Summary

This document outlines a comprehensive error handling architecture for LiteMaaS that ensures all backend error messages are properly formatted, transmitted, and displayed in the frontend with appropriate fallbacks and user-friendly messaging.

## Current State Analysis

### Backend Error Handling

#### Strengths

- Centralized error creation helpers via Fastify decorators
- Consistent error response structure with error codes
- Request ID tracking for debugging
- Automatic database error mapping

#### Weaknesses

- Mixed error creation patterns (some use `new Error()`, others use helpers)
- Generic route-level error wrapping loses context
- Inconsistent error details across services
- Limited error classification

### Frontend Error Handling

#### Strengths

- Dual notification system (drawer + toast)
- React Query integration for some components
- Error boundaries for crash recovery
- i18n support for error messages

#### Weaknesses

- No centralized error extraction utility
- Duplicated error handling logic across components
- Inconsistent error display patterns
- Backend error details often lost

## Proposed Architecture

### 1. Enhanced Backend Error Response Format

```typescript
interface ErrorResponse {
  error: {
    // Core fields (always present)
    code: string; // Machine-readable error code
    message: string; // Human-readable message
    statusCode: number; // HTTP status code

    // Context fields (optional but recommended)
    details?: {
      field?: string; // Specific field that caused error
      value?: any; // The invalid value (sanitized)
      constraint?: string; // Validation constraint that failed
      suggestion?: string; // How to fix the error
      helpUrl?: string; // Link to documentation
      validation?: Array<{
        // Multiple validation errors
        field: string;
        message: string;
        code: string;
      }>;
      metadata?: Record<string, any>; // Additional context
    };

    // Tracing fields
    requestId: string; // Unique request identifier
    correlationId?: string; // For distributed tracing
    timestamp: string; // ISO 8601 timestamp

    // Recovery fields (for transient errors)
    retry?: {
      retryable: boolean; // Can this be retried?
      retryAfter?: number; // Seconds to wait before retry
      maxRetries?: number; // Maximum retry attempts
    };
  };
}
```

### 2. Backend Error Classification System

```typescript
// Expanded error codes for better classification
export enum ErrorCode {
  // Authentication & Authorization (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  VALUE_OUT_OF_RANGE = 'VALUE_OUT_OF_RANGE',

  // Resource Management (4xx)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // Quota & Limits (4xx)
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMITED = 'RATE_LIMITED',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',

  // External Services (5xx)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  LITELLM_ERROR = 'LITELLM_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // System Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}
```

### 3. Backend Implementation

#### ApplicationError Class

```typescript
// backend/src/utils/errors.ts
export class ApplicationError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly retryable: boolean;

  constructor(config: ErrorConfig) {
    super(config.message);
    this.name = 'ApplicationError';
    this.code = config.code;
    this.statusCode = config.statusCode;
    this.details = config.details;
    this.retryable = config.retryable ?? false;
  }

  // Factory methods for common errors
  static validation(message: string, field?: string, suggestion?: string): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      message,
      details: { field, suggestion },
    });
  }

  static notFound(resource: string, id?: string): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      message: `${resource} not found`,
      details: {
        resource,
        id,
        suggestion: `Verify the ${resource} ID and try again`,
      },
    });
  }

  static alreadyExists(resource: string, field?: string, value?: any): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.ALREADY_EXISTS,
      statusCode: 409,
      message: `${resource} already exists`,
      details: {
        resource,
        field,
        value,
        suggestion: `Use a different ${field || 'value'} or update the existing ${resource}`,
      },
    });
  }

  toJSON(): ErrorResponse['error'] {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      requestId: '', // Will be filled by error handler
      timestamp: new Date().toISOString(),
      retry: this.retryable ? { retryable: true } : undefined,
    };
  }
}
```

#### Enhanced Error Handler Middleware

```typescript
// backend/src/middleware/error-handler.ts
export async function errorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler(async (error: any, request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = request.headers['x-correlation-id'] as string;

    // Handle ApplicationError instances
    if (error instanceof ApplicationError) {
      const errorResponse: ErrorResponse = {
        error: {
          ...error.toJSON(),
          requestId: request.id,
          correlationId,
        },
      };

      fastify.log.error({
        ...errorResponse,
        stack: error.stack,
        url: request.url,
        method: request.method,
        userId: request.user?.id,
      });

      return reply.status(error.statusCode).send(errorResponse);
    }

    // Handle validation errors from schemas
    if (error.validation) {
      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Request validation failed',
          statusCode: 400,
          details: {
            validation: error.validation.map((v) => ({
              field: v.instancePath.replace('/', ''),
              message: v.message || 'Invalid value',
              code: v.keyword,
            })),
          },
          requestId: request.id,
          correlationId,
          timestamp: new Date().toISOString(),
        },
      };

      return reply.status(400).send(errorResponse);
    }

    // Handle database errors
    if (error.code && error.code.startsWith('23')) {
      const errorResponse = mapDatabaseError(error, request.id, correlationId);
      return reply.status(errorResponse.error.statusCode).send(errorResponse);
    }

    // Handle unknown errors
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message:
          process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
        statusCode: 500,
        details:
          process.env.NODE_ENV !== 'production'
            ? {
                stack: error.stack,
                metadata: { originalError: error.toString() },
              }
            : undefined,
        requestId: request.id,
        correlationId,
        timestamp: new Date().toISOString(),
      },
    };

    fastify.log.error({
      ...errorResponse,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    return reply.status(500).send(errorResponse);
  });
}
```

### 4. Frontend Error Handling Utility

#### Universal Error Extraction Function

```typescript
// frontend/src/utils/error.utils.ts
import { AxiosError } from 'axios';

export interface ExtractedError {
  message: string;
  code?: string;
  statusCode?: number;
  field?: string;
  details?: Record<string, any>;
  validation?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  suggestion?: string;
  helpUrl?: string;
  requestId?: string;
  retryable?: boolean;
  retryAfter?: number;
}

export function extractErrorDetails(error: unknown): ExtractedError {
  // Handle null/undefined
  if (!error) {
    return {
      message: 'An unknown error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }

  // Handle Axios errors
  if (isAxiosError(error)) {
    const response = error.response;

    // Network error (no response)
    if (!response) {
      return {
        message: error.message || 'Network error - please check your connection',
        code: 'NETWORK_ERROR',
        retryable: true,
      };
    }

    // Extract backend error response
    const data = response.data;

    // Standard error format
    if (data?.error) {
      return {
        message: data.error.message || 'An error occurred',
        code: data.error.code,
        statusCode: data.error.statusCode || response.status,
        field: data.error.details?.field,
        details: data.error.details,
        validation: data.error.details?.validation,
        suggestion: data.error.details?.suggestion,
        helpUrl: data.error.details?.helpUrl,
        requestId: data.error.requestId,
        retryable: data.error.retry?.retryable,
        retryAfter: data.error.retry?.retryAfter,
      };
    }

    // Legacy format (backward compatibility)
    if (data?.message) {
      return {
        message: data.message,
        statusCode: response.status,
        details: data,
      };
    }

    // Fallback to status text
    return {
      message: response.statusText || `Error ${response.status}`,
      statusCode: response.status,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code || 'ERROR',
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'STRING_ERROR',
    };
  }

  // Handle objects with message property
  if (typeof error === 'object' && 'message' in error) {
    return {
      message: String(error.message),
      code: (error as any).code,
      details: error as any,
    };
  }

  // Ultimate fallback
  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    details: { originalError: String(error) },
  };
}

function isAxiosError(error: any): error is AxiosError {
  return error?.isAxiosError === true;
}

// Helper to get user-friendly message with fallback
export function getUserErrorMessage(
  error: unknown,
  fallbackKey: string,
  t: (key: string, options?: any) => string,
): string {
  const extracted = extractErrorDetails(error);

  // Try to use suggestion if available
  if (extracted.suggestion) {
    return extracted.suggestion;
  }

  // Try to translate error code
  const translationKey = `errors.${extracted.code}`;
  const translated = t(translationKey, { defaultValue: '' });

  if (translated) {
    return translated;
  }

  // Use extracted message or fallback
  return extracted.message || t(fallbackKey);
}
```

#### React Hook for Error Handling

```typescript
// frontend/src/hooks/useErrorHandler.ts
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../contexts/NotificationContext';
import { extractErrorDetails, getUserErrorMessage } from '../utils/error.utils';

export interface ErrorHandlerOptions {
  fallbackMessage?: string;
  showNotification?: boolean;
  logError?: boolean;
  onError?: (error: ExtractedError) => void;
}

export function useErrorHandler() {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  const handleError = useCallback(
    (error: unknown, options: ErrorHandlerOptions = {}) => {
      const {
        fallbackMessage = 'common.error.generic',
        showNotification = true,
        logError = true,
        onError,
      } = options;

      const extracted = extractErrorDetails(error);

      // Log error in development
      if (logError && process.env.NODE_ENV === 'development') {
        console.error('Error handled:', {
          ...extracted,
          originalError: error,
        });
      }

      // Show notification
      if (showNotification) {
        const message = getUserErrorMessage(error, fallbackMessage, t);

        addNotification({
          variant: 'danger',
          title: t('common.error'),
          description: message,
          action: extracted.retryable
            ? {
                label: t('common.retry'),
                onClick: () => {
                  // Trigger retry logic
                },
              }
            : undefined,
          metadata: {
            requestId: extracted.requestId,
            errorCode: extracted.code,
          },
        });
      }

      // Call custom handler
      if (onError) {
        onError(extracted);
      }

      return extracted;
    },
    [t, addNotification],
  );

  return { handleError };
}
```

#### Error Display Components

```typescript
// frontend/src/components/errors/ErrorAlert.tsx
import React from 'react';
import {
  Alert,
  AlertActionCloseButton,
  ExpandableSection,
  CodeBlock,
  CodeBlockCode,
  Button,
  Stack,
  StackItem
} from '@patternfly/react-core';
import { ExtractedError } from '../../utils/error.utils';

interface ErrorAlertProps {
  error: ExtractedError;
  onClose?: () => void;
  onRetry?: () => void;
  showDetails?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onClose,
  onRetry,
  showDetails = process.env.NODE_ENV === 'development'
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <Alert
      variant="danger"
      title={error.message}
      actionClose={onClose ? <AlertActionCloseButton onClose={onClose} /> : undefined}
      actionLinks={
        <Stack hasGutter>
          {error.suggestion && (
            <StackItem>
              <Alert variant="info" isInline title="Suggestion">
                {error.suggestion}
              </Alert>
            </StackItem>
          )}
          {error.helpUrl && (
            <StackItem>
              <Button variant="link" component="a" href={error.helpUrl} target="_blank">
                View Documentation
              </Button>
            </StackItem>
          )}
          {onRetry && error.retryable && (
            <StackItem>
              <Button variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            </StackItem>
          )}
        </Stack>
      }
    >
      {showDetails && error.details && (
        <ExpandableSection
          toggleText={isExpanded ? 'Hide details' : 'Show details'}
          onToggle={setIsExpanded}
          isExpanded={isExpanded}
        >
          <CodeBlock>
            <CodeBlockCode>
              {JSON.stringify(error.details, null, 2)}
            </CodeBlockCode>
          </CodeBlock>
          {error.requestId && (
            <p>Request ID: <code>{error.requestId}</code></p>
          )}
        </ExpandableSection>
      )}
    </Alert>
  );
};
```

```typescript
// frontend/src/components/errors/FieldErrors.tsx
import React from 'react';
import { FormHelperText, HelperText, HelperTextItem } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

interface FieldErrorsProps {
  errors: Array<{
    field: string;
    message: string;
  }>;
  field: string;
}

export const FieldErrors: React.FC<FieldErrorsProps> = ({ errors, field }) => {
  const fieldErrors = errors.filter(e => e.field === field);

  if (fieldErrors.length === 0) {
    return null;
  }

  return (
    <FormHelperText>
      <HelperText>
        {fieldErrors.map((error, index) => (
          <HelperTextItem
            key={index}
            isDynamic
            variant="error"
            icon={<ExclamationCircleIcon />}
          >
            {error.message}
          </HelperTextItem>
        ))}
      </HelperText>
    </FormHelperText>
  );
};
```

### 5. Integration with i18n

```json
// frontend/src/i18n/locales/en/errors.json
{
  "errors": {
    "UNAUTHORIZED": "You are not authorized to perform this action",
    "FORBIDDEN": "Access denied",
    "NOT_FOUND": "The requested resource was not found",
    "VALIDATION_ERROR": "Please check your input and try again",
    "ALREADY_EXISTS": "This resource already exists",
    "QUOTA_EXCEEDED": "You have exceeded your quota limit",
    "RATE_LIMITED": "Too many requests. Please try again later",
    "NETWORK_ERROR": "Network connection error. Please check your internet connection",
    "INTERNAL_ERROR": "An unexpected error occurred. Please try again later",
    "retry": "Retry",
    "showDetails": "Show details",
    "hideDetails": "Hide details",
    "requestId": "Request ID",
    "suggestion": "Suggestion"
  }
}
```

## Implementation Plan

### Phase 1: Backend Foundation (Week 1)

1. Create error types and ApplicationError class
2. Update error handler middleware
3. Add correlation ID support
4. Create error message constants

### Phase 2: Backend Service Layer (Week 1)

1. Update BaseService with error handling methods
2. Refactor all services to use ApplicationError
3. Add field-level validation to DTOs
4. Update route handlers to preserve error context

### Phase 3: Frontend Foundation (Week 2)

1. Create error extraction utility
2. Build useErrorHandler hook
3. Create error display components
4. Add error translations

### Phase 4: Frontend Integration (Week 2)

1. Update API client with error interceptor
2. Refactor all pages to use useErrorHandler
3. Replace inline error handling
4. Add retry logic for transient errors

### Phase 5: Testing & Documentation (Week 3)

1. Unit tests for error utilities
2. Integration tests for error flow
3. Update API documentation
4. Create developer guide

## Migration Strategy

### Backward Compatibility

- Support both old and new error formats during transition
- Gradual migration of services and components
- Feature flag for enabling new error handling

### Rollout Plan

1. Deploy backend changes (backward compatible)
2. Update frontend utilities
3. Migrate critical user paths first
4. Complete migration of all components
5. Remove legacy error handling code

## Testing Strategy

### Unit Tests

- Error extraction utility with various error formats
- ApplicationError class and factories
- Error handler middleware scenarios
- React hook error handling

### Integration Tests

- End-to-end error flow from backend to UI
- Validation error display
- Retry logic for transient errors
- i18n message display

### Manual Testing Checklist

- [ ] Validation errors show field-specific messages
- [ ] Network errors show retry option
- [ ] Rate limit errors show wait time
- [ ] Not found errors show helpful suggestions
- [ ] Error details expandable in development
- [ ] Request IDs visible for support
- [ ] Translations work for all error types

## Monitoring & Observability

### Error Tracking

- Log all errors with correlation IDs
- Track error rates by code
- Monitor retry success rates
- Alert on error spikes

### Metrics to Track

- Error response time
- Error rate by endpoint
- Retry attempts and success rate
- User error interactions (expand details, retry clicks)

## Success Criteria

1. **Developer Experience**
   - Single source of truth for error handling
   - Consistent error creation patterns
   - Rich debugging context

2. **User Experience**
   - Clear, actionable error messages
   - Appropriate suggestions for recovery
   - Consistent error display across app

3. **System Reliability**
   - Automatic retry for transient failures
   - Graceful degradation
   - Proper error propagation

## Appendix

### Error Code Reference

| Code             | HTTP Status | Description                       | User Message                                      |
| ---------------- | ----------- | --------------------------------- | ------------------------------------------------- |
| UNAUTHORIZED     | 401         | Missing or invalid authentication | Please log in to continue                         |
| FORBIDDEN        | 403         | Insufficient permissions          | You don't have permission to access this resource |
| NOT_FOUND        | 404         | Resource not found                | The requested item could not be found             |
| VALIDATION_ERROR | 400         | Input validation failed           | Please check your input and try again             |
| ALREADY_EXISTS   | 409         | Resource already exists           | This item already exists                          |
| QUOTA_EXCEEDED   | 403         | Usage quota exceeded              | You have exceeded your usage limit                |
| RATE_LIMITED     | 429         | Too many requests                 | Please wait before trying again                   |
| INTERNAL_ERROR   | 500         | Unexpected server error           | Something went wrong. Please try again            |

### Example Error Responses

#### Validation Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid subscription request",
    "statusCode": 400,
    "details": {
      "validation": [
        {
          "field": "modelId",
          "message": "Model ID is required",
          "code": "required"
        },
        {
          "field": "quotaRequests",
          "message": "Quota must be positive",
          "code": "minimum"
        }
      ],
      "suggestion": "Please provide a valid model ID and positive quota values"
    },
    "requestId": "req_abc123",
    "timestamp": "2024-01-14T10:30:00Z"
  }
}
```

#### Already Exists Error

```json
{
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "Subscription already exists for model gpt-4",
    "statusCode": 409,
    "details": {
      "resource": "subscription",
      "field": "modelId",
      "value": "gpt-4",
      "suggestion": "Use the existing subscription or cancel it first"
    },
    "requestId": "req_xyz789",
    "timestamp": "2024-01-14T10:31:00Z"
  }
}
```

#### Rate Limit Error

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "API rate limit exceeded",
    "statusCode": 429,
    "details": {
      "limit": 100,
      "window": "1m",
      "suggestion": "Please wait 30 seconds before retrying"
    },
    "retry": {
      "retryable": true,
      "retryAfter": 30
    },
    "requestId": "req_def456",
    "timestamp": "2024-01-14T10:32:00Z"
  }
}
```

## Conclusion

This comprehensive error handling architecture addresses all current issues while providing a robust foundation for future enhancements. The implementation ensures that error details are never lost between backend and frontend, provides clear guidance to users, and maintains excellent developer experience through consistent patterns and rich debugging context.

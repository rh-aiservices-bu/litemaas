import { AxiosError } from 'axios';

/**
 * Extracted error information with standardized properties
 * Based on LiteMaaS Error Handling Architecture
 */
export interface ExtractedError {
  /** Human-readable error message */
  message: string;
  /** Machine-readable error code */
  code?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Specific field that caused the error */
  field?: string;
  /** Additional error details */
  details?: Record<string, any>;
  /** Validation errors for form fields */
  validation?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** Suggested action to fix the error */
  suggestion?: string;
  /** Link to relevant documentation */
  helpUrl?: string;
  /** Unique request identifier for debugging */
  requestId?: string;
  /** Whether this error can be retried */
  retryable?: boolean;
  /** Seconds to wait before retrying */
  retryAfter?: number;
}

/**
 * Type-safe interfaces for backend error responses
 */
interface ErrorResponseData {
  message: string;
  code?: string;
  statusCode?: number;
  details?: {
    field?: string;
    validation?: Array<{ field: string; message: string; code: string }>;
    suggestion?: string;
    helpUrl?: string;
    limit?: number | string;
    timeWindow?: string;
    remaining?: number;
    [key: string]: any;
  };
  requestId?: string;
  retry?: {
    retryable?: boolean;
    retryAfter?: number;
  };
}

interface StandardErrorResponse {
  error: ErrorResponseData;
}

interface LegacyErrorResponse {
  message: string;
  code?: string;
  statusCode?: number;
  [key: string]: any;
}

interface ValidationErrorResponse {
  errors: Array<{ field: string; message: string; code?: string }>;
  message?: string;
}

interface RateLimitError {
  code: string;
  message?: string;
  details?: {
    suggestion?: string;
    remaining?: number;
    [key: string]: any;
  };
  requestId?: string;
}

/**
 * Type guard functions for error response formats
 */
function isStandardErrorResponse(data: any): data is StandardErrorResponse {
  return (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    data.error &&
    typeof data.error === 'object'
  );
}

function isLegacyErrorResponse(data: any): data is LegacyErrorResponse {
  return data && typeof data === 'object' && 'message' in data && typeof data.message === 'string';
}

function isValidationErrorResponse(data: any): data is ValidationErrorResponse {
  return data && typeof data === 'object' && 'errors' in data && Array.isArray(data.errors);
}

function isRateLimitError(data: unknown): data is RateLimitError {
  return (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    (data as any).code === 'RATE_LIMITED'
  );
}

function isErrorWithCode(error: unknown): error is Error & { code?: string } {
  return error instanceof Error;
}

function isObjectWithMessage(obj: unknown): obj is {
  message: unknown;
  code?: unknown;
  type?: unknown;
  statusCode?: unknown;
  status?: unknown;
  field?: unknown;
  [key: string]: unknown;
} {
  return typeof obj === 'object' && obj !== null && 'message' in obj;
}

/**
 * Comprehensive error extraction function that handles all error types
 * Supports the new backend ErrorResponse format and legacy formats
 *
 * @param error - Any error object to extract details from
 * @returns Standardized error information
 */
export function extractErrorDetails(error: unknown): ExtractedError {
  // Handle null/undefined
  if (!error) {
    return {
      message: 'An unknown error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }

  // Handle Axios errors (network requests)
  if (isAxiosError(error)) {
    const response = error.response;

    // Network error (no response received)
    if (!response) {
      return {
        message: error.message || 'Network error - please check your connection',
        code: 'NETWORK_ERROR',
        retryable: true,
      };
    }

    // Extract backend error response
    const data = response.data;

    // Standard ErrorResponse format (new architecture)
    if (isStandardErrorResponse(data)) {
      const errorData = data.error;
      return {
        message: errorData.message || 'An error occurred',
        code: errorData.code,
        statusCode: errorData.statusCode || response.status,
        field: errorData.details?.field,
        details: errorData.details,
        validation: errorData.details?.validation,
        suggestion: errorData.details?.suggestion,
        helpUrl: errorData.details?.helpUrl,
        requestId: errorData.requestId,
        retryable: errorData.retry?.retryable,
        retryAfter: errorData.retry?.retryAfter,
      };
    }

    // Direct rate limit error format (flat structure from @fastify/rate-limit)
    if (isRateLimitError(data) && response.status === 429) {
      return {
        message: data.message || 'Too many requests',
        code: data.code,
        statusCode: response.status,
        details: data.details,
        suggestion: data.details?.suggestion,
        requestId: data.requestId,
        retryable: true,
        retryAfter: data.details?.remaining ? Math.ceil(data.details.remaining / 1000) : 60,
      };
    }

    // Legacy format (backward compatibility)
    if (isLegacyErrorResponse(data)) {
      return {
        message: data.message,
        code: data.code,
        statusCode: response.status,
        details: data,
      };
    }

    // Handle validation errors in legacy format
    if (isValidationErrorResponse(data)) {
      return {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: response.status,
        validation: data.errors.map((err) => ({
          field: err.field || 'unknown',
          message: err.message || 'Invalid value',
          code: err.code || 'validation',
        })),
      };
    }

    // Fallback to HTTP status information
    return {
      message: response.statusText || `HTTP Error ${response.status}`,
      code: `HTTP_${response.status}`,
      statusCode: response.status,
    };
  }

  // Handle standard Error objects
  if (isErrorWithCode(error)) {
    return {
      message: error.message,
      code: error.code || 'ERROR',
      details: {
        name: error.name,
        stack: error.stack,
      },
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
  if (isObjectWithMessage(error)) {
    return {
      message: String(error.message),
      code:
        typeof error.code === 'string'
          ? error.code
          : typeof error.type === 'string'
            ? error.type
            : 'OBJECT_ERROR',
      statusCode:
        typeof error.statusCode === 'number'
          ? error.statusCode
          : typeof error.status === 'number'
            ? error.status
            : undefined,
      field: typeof error.field === 'string' ? error.field : undefined,
      details: error,
    };
  }

  // Ultimate fallback for any other type
  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    details: {
      originalError: String(error),
      typeof: typeof error,
    },
  };
}

/**
 * Type guard to check if an error is an Axios error
 *
 * @param error - Error to check
 * @returns True if the error is an AxiosError
 */
export function isAxiosError(error: any): error is AxiosError {
  return error?.isAxiosError === true;
}

/**
 * Get a user-friendly error message with i18n support and fallbacks
 *
 * @param error - The error to extract message from
 * @param fallbackKey - i18n key for fallback message
 * @param t - Translation function from react-i18next
 * @returns Localized user-friendly error message
 */
export function getUserErrorMessage(
  error: unknown,
  fallbackKey: string,
  t: (key: string, options?: any) => string,
): string {
  const extracted = extractErrorDetails(error);

  // Try to use suggestion if available (highest priority)
  if (extracted.suggestion) {
    return extracted.suggestion;
  }

  // Try to translate specific error code
  if (extracted.code) {
    const translationKey = `errors.${extracted.code}`;
    const translated = t(translationKey, { defaultValue: '' });

    if (translated) {
      return translated;
    }
  }

  // Try to translate field-specific validation errors
  if (extracted.validation && extracted.validation.length > 0) {
    const fieldErrors = extracted.validation.map((v) => {
      const fieldKey = `errors.validation.${v.code}`;
      const fieldTranslated = t(fieldKey, {
        field: v.field,
        defaultValue: v.message,
      });
      return fieldTranslated;
    });

    return fieldErrors.join('; ');
  }

  // Use extracted message if it's meaningful
  if (
    extracted.message &&
    extracted.message !== 'An unknown error occurred' &&
    extracted.message !== 'An unexpected error occurred'
  ) {
    return extracted.message;
  }

  // Fall back to translated fallback message
  return t(fallbackKey);
}

/**
 * Helper to format validation errors for form display
 *
 * @param error - Error to extract validation from
 * @returns Array of field errors suitable for form display
 */
export function getValidationErrors(error: unknown): Array<{
  field: string;
  message: string;
  code: string;
}> {
  const extracted = extractErrorDetails(error);
  return extracted.validation || [];
}

/**
 * Check if an error indicates a network connectivity issue
 *
 * @param error - Error to check
 * @returns True if this appears to be a network error
 */
export function isNetworkError(error: unknown): boolean {
  const extracted = extractErrorDetails(error);
  return (
    extracted.code === 'NETWORK_ERROR' ||
    extracted.retryable === true ||
    (isAxiosError(error) && !error.response)
  );
}

/**
 * Check if an error can be retried automatically
 *
 * @param error - Error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const extracted = extractErrorDetails(error);

  // Explicitly marked as retryable
  if (extracted.retryable === true) {
    return true;
  }

  // Network errors are typically retryable
  if (isNetworkError(error)) {
    return true;
  }

  // 5xx server errors are often retryable
  if (extracted.statusCode && extracted.statusCode >= 500) {
    return true;
  }

  // Rate limiting is retryable
  if (extracted.statusCode === 429 || extracted.code === 'RATE_LIMITED') {
    return true;
  }

  return false;
}

/**
 * Get retry delay in milliseconds for retryable errors
 *
 * @param error - Error to get retry delay from
 * @param defaultDelay - Default delay if not specified in error
 * @returns Delay in milliseconds
 */
export function getRetryDelay(error: unknown, defaultDelay: number = 1000): number {
  const extracted = extractErrorDetails(error);

  if (extracted.retryAfter) {
    // Convert seconds to milliseconds
    return extracted.retryAfter * 1000;
  }

  // Use exponential backoff for rate limiting
  if (extracted.statusCode === 429) {
    return Math.min(defaultDelay * 2, 30000); // Cap at 30 seconds
  }

  return defaultDelay;
}

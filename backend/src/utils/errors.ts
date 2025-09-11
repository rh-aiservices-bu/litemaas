/**
 * Comprehensive error handling utilities for LiteMaaS
 * Based on the error handling architecture specification
 */

import { ErrorConfig, ErrorDetails, ErrorResponse, RetryInfo } from '../types/error.types';

/**
 * Expanded error codes for better classification and handling
 */
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

/**
 * Enhanced ApplicationError class with comprehensive error handling capabilities
 */
export class ApplicationError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly maxRetries?: number;
  public readonly correlationId?: string;

  constructor(config: ErrorConfig) {
    // Check for compatibility mode via environment variable
    const useCompatMode = process.env.ERROR_COMPATIBILITY_MODE === 'true';

    super(useCompatMode && config.legacyMessage ? config.legacyMessage : config.message);

    this.name = 'ApplicationError';
    this.code = config.code as ErrorCode;
    this.statusCode = config.statusCode;
    this.details = config.details;
    this.retryable = config.retryable ?? false;
    this.retryAfter = config.retryAfter;
    this.maxRetries = config.maxRetries;

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApplicationError);
    }
  }

  /**
   * Factory method for validation errors
   */
  static validation(
    message: string,
    field?: string,
    value?: any,
    suggestion?: string,
    constraint?: string,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      message,
      details: {
        field,
        value,
        suggestion,
        constraint,
      },
    });
  }

  /**
   * Factory method for multiple validation errors
   */
  static validationMultiple(
    message: string,
    validationErrors: Array<{
      field: string;
      message: string;
      code: string;
    }>,
    suggestion?: string,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      message,
      details: {
        validation: validationErrors,
        suggestion,
      },
    });
  }

  /**
   * Factory method for not found errors
   */
  static notFound(resource: string, id?: string, suggestion?: string): ApplicationError {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;

    return new ApplicationError({
      code: ErrorCode.NOT_FOUND,
      statusCode: 404,
      message,
      legacyMessage: `${resource} not found`, // Backward compatible format
      details: {
        resource,
        id,
        suggestion:
          suggestion || `Verify the ${resource} ${id ? 'ID' : 'identifier'} and try again`,
      },
    });
  }

  /**
   * Factory method for already exists errors
   */
  static alreadyExists(
    resource: string,
    field?: string,
    value?: any,
    suggestion?: string,
  ): ApplicationError {
    const message =
      field && value
        ? `${resource} with ${field} '${value}' already exists`
        : `${resource} already exists`;

    return new ApplicationError({
      code: ErrorCode.ALREADY_EXISTS,
      statusCode: 409,
      message,
      details: {
        resource,
        field,
        value,
        suggestion:
          suggestion || `Use a different ${field || 'value'} or update the existing ${resource}`,
      },
    });
  }

  /**
   * Factory method for unauthorized errors
   */
  static unauthorized(
    message: string = 'Authentication required',
    suggestion?: string,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.UNAUTHORIZED,
      statusCode: 401,
      message,
      details: {
        suggestion: suggestion || 'Please log in to access this resource',
      },
    });
  }

  /**
   * Factory method for forbidden errors
   */
  static forbidden(
    message: string = 'Access denied',
    requiredPermission?: string,
    suggestion?: string,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.FORBIDDEN,
      statusCode: 403,
      message,
      details: {
        metadata: { requiredPermission },
        suggestion: suggestion || 'You do not have permission to access this resource',
      },
    });
  }

  /**
   * Factory method for rate limiting errors
   */
  static rateLimited(
    limit: number,
    window: string,
    retryAfter: number,
    remaining: number = 0,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.RATE_LIMITED,
      statusCode: 429,
      message: 'API rate limit exceeded',
      details: {
        rateLimitValue: limit,
        window,
        remaining,
        suggestion: `Please wait ${retryAfter} seconds before retrying`,
      },
      retryable: true,
      retryAfter,
      maxRetries: 3,
    });
  }

  /**
   * Factory method for quota exceeded errors
   */
  static quotaExceeded(
    currentUsage: number,
    limit: number,
    period: string,
    overage?: number,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.QUOTA_EXCEEDED,
      statusCode: 403,
      message: 'Usage quota exceeded',
      details: {
        currentUsage,
        usageLimit: limit,
        period,
        overage,
        suggestion: 'Upgrade your plan or wait for the next billing period',
      },
    });
  }

  /**
   * Factory method for budget exceeded errors
   */
  static budgetExceeded(currentSpend: number, budget: number, period: string): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.BUDGET_EXCEEDED,
      statusCode: 403,
      message: 'Budget limit exceeded',
      details: {
        currentUsage: currentSpend,
        usageLimit: budget,
        period,
        suggestion: 'Increase your budget or reduce usage',
      },
    });
  }

  /**
   * Factory method for external service errors
   */
  static externalService(
    service: string,
    upstreamCode?: string,
    upstreamMessage?: string,
    retryable: boolean = true,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.EXTERNAL_SERVICE_ERROR,
      statusCode: 502,
      message: `External service error from ${service}`,
      details: {
        service,
        upstreamCode,
        upstreamMessage,
        suggestion: retryable
          ? 'This is a temporary issue. Please try again in a moment'
          : 'Please contact support if this problem persists',
      },
      retryable,
      retryAfter: retryable ? 30 : undefined,
      maxRetries: retryable ? 3 : 0,
    });
  }

  /**
   * Factory method for LiteLLM specific errors
   */
  static litellmError(
    message: string,
    upstreamCode?: string,
    upstreamMessage?: string,
    retryable: boolean = true,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.LITELLM_ERROR,
      statusCode: 502,
      message,
      details: {
        service: 'litellm',
        upstreamCode,
        upstreamMessage,
        suggestion: retryable
          ? 'LiteLLM service is temporarily unavailable. Please try again'
          : 'LiteLLM service error. Please contact support',
      },
      retryable,
      retryAfter: retryable ? 30 : undefined,
      maxRetries: retryable ? 3 : 0,
    });
  }

  /**
   * Factory method for database errors
   */
  static database(
    message: string,
    constraint?: string,
    table?: string,
    column?: string,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.DATABASE_ERROR,
      statusCode: 500,
      message,
      details: {
        constraintName: constraint,
        table,
        column,
        suggestion: 'Database operation failed. Please try again or contact support',
      },
      retryable: false,
    });
  }

  /**
   * Factory method for timeout errors
   */
  static timeout(
    operation: string,
    timeoutMs: number,
    retryable: boolean = true,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.TIMEOUT,
      statusCode: 504,
      message: `Operation timeout: ${operation}`,
      details: {
        metadata: { operation, timeoutMs },
        suggestion: 'The operation took too long to complete. Please try again',
      },
      retryable,
      retryAfter: retryable ? 10 : undefined,
      maxRetries: retryable ? 2 : 0,
    });
  }

  /**
   * Factory method for internal server errors
   */
  static internal(
    message: string = 'An unexpected error occurred',
    metadata?: Record<string, any>,
  ): ApplicationError {
    return new ApplicationError({
      code: ErrorCode.INTERNAL_ERROR,
      statusCode: 500,
      message,
      details: {
        metadata,
        suggestion: 'Please try again or contact support if the problem persists',
      },
      retryable: false,
    });
  }

  /**
   * Factory method for service unavailable errors
   */
  static serviceUnavailable(service?: string, retryAfter: number = 60): ApplicationError {
    const message = service
      ? `${service} service is temporarily unavailable`
      : 'Service temporarily unavailable';

    return new ApplicationError({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      statusCode: 503,
      message,
      details: {
        service,
        suggestion: `Service is temporarily down. Please try again in ${retryAfter} seconds`,
      },
      retryable: true,
      retryAfter,
      maxRetries: 3,
    });
  }

  /**
   * Convert error to JSON format for API response
   */
  toJSON(): ErrorResponse['error'] {
    const retry: RetryInfo | undefined = this.retryable
      ? {
          retryable: true,
          retryAfter: this.retryAfter,
          maxRetries: this.maxRetries,
          backoffType: 'exponential',
          jitter: true,
        }
      : undefined;

    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      requestId: '', // Will be filled by error handler middleware
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      retry,
    };
  }

  /**
   * Create ApplicationError from unknown error
   */
  static fromUnknown(error: unknown, context?: string): ApplicationError {
    if (error instanceof ApplicationError) {
      return error;
    }

    if (error instanceof Error) {
      return ApplicationError.internal(context ? `${context}: ${error.message}` : error.message, {
        originalError: error.constructor.name,
        stack: error.stack,
      });
    }

    if (typeof error === 'string') {
      return ApplicationError.internal(context ? `${context}: ${error}` : error);
    }

    return ApplicationError.internal(
      context ? `${context}: Unknown error occurred` : 'Unknown error occurred',
      {
        originalError: String(error),
      },
    );
  }

  /**
   * Check if error is retryable based on its properties
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Get suggested retry delay in milliseconds
   */
  getRetryDelay(attempt: number = 1): number {
    if (!this.retryable || !this.retryAfter) {
      return 0;
    }

    // Exponential backoff with jitter
    const baseDelay = this.retryAfter * 1000; // Convert to ms
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter

    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Check if error should be retried based on attempt count
   */
  shouldRetry(attempt: number): boolean {
    return this.retryable && (!this.maxRetries || attempt <= this.maxRetries);
  }
}

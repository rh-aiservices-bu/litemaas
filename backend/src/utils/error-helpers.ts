/**
 * Error helper utilities for LiteMaaS
 * Provides additional utilities for database error mapping, HTTP status handling,
 * message sanitization, correlation IDs, and retry logic
 */

import { randomBytes, randomUUID } from 'crypto';
import { DatabaseErrorMapping, ErrorDetails } from '../types/error.types';
import { ApplicationError, ErrorCode } from './errors';

/**
 * PostgreSQL error codes and their mappings
 */
const POSTGRESQL_ERROR_MAPPINGS: Record<string, DatabaseErrorMapping> = {
  // Unique constraint violations
  '23505': {
    code: '23505',
    errorCode: ErrorCode.ALREADY_EXISTS,
    statusCode: 409,
    messageTemplate: 'Resource already exists: {constraint}',
    getSuggestion: (error: any) => {
      const detail = error.detail || '';
      if (detail.includes('email')) {
        return 'An account with this email address already exists. Please use a different email or try logging in.';
      }
      if (detail.includes('username')) {
        return 'This username is already taken. Please choose a different username.';
      }
      if (detail.includes('api_key')) {
        return 'An API key with this name already exists. Please use a different name.';
      }
      return 'This value already exists in the system. Please use a different value.';
    },
  },

  // Foreign key constraint violations
  '23503': {
    code: '23503',
    errorCode: ErrorCode.VALIDATION_ERROR,
    statusCode: 400,
    messageTemplate: 'Referenced resource not found: {constraint}',
    getSuggestion: (error: any) => {
      const detail = error.detail || '';
      if (detail.includes('user_id')) {
        return 'The specified user does not exist. Please verify the user ID.';
      }
      if (detail.includes('team_id')) {
        return 'The specified team does not exist. Please verify the team ID.';
      }
      if (detail.includes('model_id')) {
        return 'The specified model does not exist. Please verify the model ID.';
      }
      return 'One or more referenced resources do not exist. Please verify all related IDs.';
    },
  },

  // Check constraint violations
  '23514': {
    code: '23514',
    errorCode: ErrorCode.VALIDATION_ERROR,
    statusCode: 400,
    messageTemplate: 'Data validation failed: {constraint}',
    getSuggestion: (error: any) => {
      const constraint = error.constraint_name || '';
      if (constraint.includes('positive')) {
        return 'Value must be positive (greater than zero).';
      }
      if (constraint.includes('budget') || constraint.includes('limit')) {
        return 'Budget or limit values must be within acceptable range.';
      }
      if (constraint.includes('email')) {
        return 'Please provide a valid email address format.';
      }
      return 'Please ensure all values meet the required constraints.';
    },
  },

  // Not null constraint violations
  '23502': {
    code: '23502',
    errorCode: ErrorCode.VALIDATION_ERROR,
    statusCode: 400,
    messageTemplate: 'Required field missing: {column}',
    getSuggestion: (error: any) => {
      const column = error.column || 'unknown field';
      return `The field '${column}' is required and cannot be empty.`;
    },
  },

  // Connection errors
  '08006': {
    code: '08006',
    errorCode: ErrorCode.DATABASE_ERROR,
    statusCode: 503,
    messageTemplate: 'Database connection failed',
    getSuggestion: () => 'Database is temporarily unavailable. Please try again in a moment.',
  },

  // Connection timeout
  '08001': {
    code: '08001',
    errorCode: ErrorCode.TIMEOUT,
    statusCode: 504,
    messageTemplate: 'Database connection timeout',
    getSuggestion: () => 'Database operation timed out. Please try again.',
  },

  // Transaction rollback
  '40001': {
    code: '40001',
    errorCode: ErrorCode.CONFLICT,
    statusCode: 409,
    messageTemplate: 'Transaction conflict occurred',
    getSuggestion: () => 'A conflict occurred while processing your request. Please try again.',
  },
};

/**
 * Map PostgreSQL database errors to ApplicationError instances
 */
export function mapDatabaseError(error: any): ApplicationError {
  const pgCode = error.code || error.sqlState || '';
  const mapping = POSTGRESQL_ERROR_MAPPINGS[pgCode];

  if (mapping) {
    const message = mapping.messageTemplate.replace(
      /{(\w+)}/g,
      (match, key) => error[key] || error.constraint_name || match,
    );

    const suggestion = mapping.getSuggestion ? mapping.getSuggestion(error) : undefined;

    const details: ErrorDetails = {
      constraintName: error.constraint_name || error.constraint,
      table: error.table_name || error.table,
      column: error.column_name || error.column,
      suggestion,
      metadata: {
        pgCode,
        detail: error.detail,
        hint: error.hint,
        where: error.where,
      },
    };

    return new ApplicationError({
      code: mapping.errorCode,
      statusCode: mapping.statusCode,
      message,
      details,
      retryable: pgCode === '40001' || pgCode.startsWith('08'), // Retry transaction conflicts and connection issues
    });
  }

  // Unknown database error
  return ApplicationError.database(
    error.message || 'Database operation failed',
    error.constraint_name,
    error.table_name,
    error.column_name,
  );
}

/**
 * HTTP status code to ErrorCode mapping
 */
const STATUS_CODE_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_ERROR,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  429: ErrorCode.RATE_LIMITED,
  500: ErrorCode.INTERNAL_ERROR,
  502: ErrorCode.EXTERNAL_SERVICE_ERROR,
  503: ErrorCode.SERVICE_UNAVAILABLE,
  504: ErrorCode.TIMEOUT,
};

/**
 * ErrorCode to HTTP status code mapping
 */
const ERROR_CODE_TO_STATUS_CODE: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.VALUE_OUT_OF_RANGE]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RESOURCE_LOCKED]: 423,
  [ErrorCode.QUOTA_EXCEEDED]: 403,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.BUDGET_EXCEEDED]: 403,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.LITELLM_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.TIMEOUT]: 504,
};

/**
 * Get appropriate HTTP status code from error code
 */
export function getStatusCodeFromErrorCode(errorCode: ErrorCode): number {
  return ERROR_CODE_TO_STATUS_CODE[errorCode] || 500;
}

/**
 * Get error code from HTTP status code
 */
export function getErrorCodeFromStatusCode(statusCode: number): ErrorCode {
  return STATUS_CODE_TO_ERROR_CODE[statusCode] || ErrorCode.INTERNAL_ERROR;
}

/**
 * Determine if a status code indicates a client error (4xx)
 */
export function isClientError(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500;
}

/**
 * Determine if a status code indicates a server error (5xx)
 */
export function isServerError(statusCode: number): boolean {
  return statusCode >= 500;
}

/**
 * Determine if an error code represents a retryable error
 */
export function isRetryableErrorCode(errorCode: ErrorCode): boolean {
  const retryableErrors = [
    ErrorCode.EXTERNAL_SERVICE_ERROR,
    ErrorCode.LITELLM_ERROR,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.TIMEOUT,
    ErrorCode.RATE_LIMITED,
    ErrorCode.DATABASE_ERROR, // Only connection-related DB errors should be retryable
  ];
  return retryableErrors.includes(errorCode);
}

/**
 * Sensitive field patterns to sanitize from error messages
 */
const SENSITIVE_PATTERNS = [
  /password/gi,
  /secret/gi,
  /token/gi,
  /key/gi,
  /auth/gi,
  /credential/gi,
  /session/gi,
  /cookie/gi,
  /bearer/gi,
  /authorization/gi,
];

/**
 * Sanitize error messages for production use
 */
export function sanitizeErrorMessage(message: string, isProduction: boolean = true): string {
  if (!isProduction) {
    return message;
  }

  // Remove sensitive information from error messages
  let sanitized = message;

  // Replace sensitive field mentions and their quoted values
  SENSITIVE_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  // Remove quoted values that appear after sensitive field names
  sanitized = sanitized.replace(/\b[REDACTED]\s+["']([^"']+)["']/gi, '[REDACTED] "[REDACTED]"');

  // Remove quoted values that look sensitive
  sanitized = sanitized.replace(
    /["']([^"']*(?:secret|key|token|password)[^"']*)["']/gi,
    '"[REDACTED]"',
  );
  sanitized = sanitized.replace(/["']([A-Za-z0-9+/]{20,}={0,2})["']/g, '"[REDACTED]"'); // Base64-like values
  sanitized = sanitized.replace(/["']([A-Fa-f0-9]{32,})["']/g, '"[REDACTED]"'); // Hex values
  sanitized = sanitized.replace(/["'](sk-[A-Za-z0-9]{40,})["']/g, '"[REDACTED]"'); // API keys

  // Remove any quoted alphanumeric values after sensitive keywords
  sanitized = sanitized.replace(
    /\b[REDACTED]\s+["']([A-Za-z0-9]+)["']/g,
    '[REDACTED] "[REDACTED]"',
  );

  // Remove SQL error details that might leak schema information
  sanitized = sanitized.replace(/\btable\s+["']?(\w+)["']?/gi, 'table [REDACTED]');
  sanitized = sanitized.replace(/\bcolumn\s+["']?(\w+)["']?/gi, 'column [REDACTED]');
  sanitized = sanitized.replace(/\bconstraint\s+["']?(\w+)["']?/gi, 'constraint [REDACTED]');

  return sanitized;
}

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Generate a shorter request ID (for performance)
 */
export function generateRequestId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Extract correlation ID from headers or generate new one
 */
export function extractOrGenerateCorrelationId(headers: Record<string, any>): string {
  const existing =
    headers['x-correlation-id'] || headers['X-Correlation-Id'] || headers['correlation-id'];

  return typeof existing === 'string' && existing.length > 0 ? existing : generateCorrelationId();
}

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterPercent: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterPercent: 10,
};

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(attempt: number, config: Partial<RetryConfig> = {}): number {
  const { baseDelayMs, maxDelayMs, backoffMultiplier, jitterPercent } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  // Exponential backoff
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter to avoid thundering herd
  const jitterRange = cappedDelay * (jitterPercent / 100);
  const jitter = (Math.random() * 2 - 1) * jitterRange; // Random between -jitterRange and +jitterRange

  return Math.max(0, Math.floor(cappedDelay + jitter));
}

/**
 * Calculate next retry time as ISO string
 */
export function calculateRetryTime(attempt: number, config: Partial<RetryConfig> = {}): string {
  const delayMs = calculateRetryDelay(attempt, config);
  const retryTime = new Date(Date.now() + delayMs);
  return retryTime.toISOString();
}

/**
 * Determine if an error should be retried
 */
export function shouldRetryError(
  error: ApplicationError | Error,
  attempt: number,
  maxAttempts: number = DEFAULT_RETRY_CONFIG.maxAttempts,
): boolean {
  // Don't retry if we've exceeded max attempts
  if (attempt >= maxAttempts) {
    return false;
  }

  // If it's an ApplicationError, use its retry logic
  if (error instanceof ApplicationError) {
    return error.isRetryable() && error.shouldRetry(attempt);
  }

  // For other errors, check if they look retryable
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'timeout',
    'connection',
    'network',
    'unavailable',
    'temporary',
    'rate limit',
    'too many requests',
    'service overloaded',
    'try again',
  ];

  const isRetryable = retryablePatterns.some((pattern) => message.includes(pattern));

  // Additional check: don't retry validation or client errors
  const nonRetryablePatterns = [
    'validation',
    'invalid',
    'bad request',
    'unauthorized',
    'forbidden',
    'not found',
  ];

  const isNonRetryable = nonRetryablePatterns.some((pattern) => message.includes(pattern));

  return isRetryable && !isNonRetryable;
}

/**
 * Create a retry wrapper function
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  shouldRetry?: (error: Error, attempt: number) => boolean,
): Promise<T> {
  const { maxAttempts } = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Check if we should retry this error
      const shouldRetryThis = shouldRetry
        ? shouldRetry(lastError, attempt)
        : shouldRetryError(lastError, attempt, maxAttempts);

      if (!shouldRetryThis) {
        break;
      }

      // Wait before next attempt
      const delayMs = calculateRetryDelay(attempt, config);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError!;
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringWindowMs: number;
  minimumRequests: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 0.5, // 50% failure rate
  recoveryTimeoutMs: 60000, // 1 minute
  monitoringWindowMs: 60000, // 1 minute window
  minimumRequests: 10,
};

/**
 * Simple circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: number = 0;
  private requests: number = 0;
  private nextRetryTime: number = 0;

  constructor(private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextRetryTime) {
        throw ApplicationError.serviceUnavailable(
          'Circuit breaker is open',
          Math.ceil((this.nextRetryTime - Date.now()) / 1000),
        );
      }
      // Try to recover
      this.state = CircuitBreakerState.HALF_OPEN;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failures = 0;
    this.requests++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.requests++;

    const failureRate = this.failures / this.requests;

    if (
      this.requests >= this.config.minimumRequests &&
      failureRate >= this.config.failureThreshold
    ) {
      this.state = CircuitBreakerState.OPEN;
      this.nextRetryTime = Date.now() + this.config.recoveryTimeoutMs;
    }
  }

  /**
   * Get current circuit breaker status
   */
  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      requests: this.requests,
      failureRate: this.requests > 0 ? this.failures / this.requests : 0,
      nextRetryTime: this.nextRetryTime > 0 ? new Date(this.nextRetryTime).toISOString() : null,
    };
  }

  /**
   * Reset circuit breaker statistics
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.requests = 0;
    this.nextRetryTime = 0;
  }
}

/**
 * Create application error from HTTP response
 */
export function createErrorFromHttpResponse(
  response: { status: number; statusText?: string; data?: any },
  service?: string,
): ApplicationError {
  const statusCode = response.status;
  const errorCode = getErrorCodeFromStatusCode(statusCode);

  const message = response.statusText || `HTTP ${statusCode} error`;
  let upstreamMessage: string | undefined;
  let upstreamCode: string | undefined;

  // Extract error details from response data
  if (response.data) {
    if (typeof response.data === 'string') {
      upstreamMessage = response.data;
    } else if (response.data.error) {
      upstreamMessage = response.data.error.message || response.data.error;
      upstreamCode = response.data.error.code;
    } else if (response.data.message) {
      upstreamMessage = response.data.message;
    }
  }

  const details: ErrorDetails = {
    service,
    upstreamCode,
    upstreamMessage,
    suggestion: isServerError(statusCode)
      ? 'This is a server-side issue. Please try again later.'
      : 'Please check your request and try again.',
  };

  return new ApplicationError({
    code: errorCode,
    statusCode,
    message,
    details,
    retryable: isServerError(statusCode) || statusCode === 429,
    retryAfter: statusCode === 429 ? 30 : statusCode >= 500 ? 60 : undefined,
  });
}

/**
 * Enhanced sanitization function to remove sensitive information from error details
 * Specifically removes database constraint names, table names, and stack traces in production
 */
export function sanitizeErrorDetails(
  details: any,
  isProduction: boolean = process.env.NODE_ENV === 'production',
): any {
  if (!isProduction) {
    return details;
  }

  // Remove sensitive fields in production
  const sanitized = { ...details };
  delete sanitized.constraint;
  delete sanitized.table;
  delete sanitized.column;
  delete sanitized.stack;
  delete sanitized.databaseCode;

  // Sanitize metadata
  if (sanitized.metadata) {
    const cleanMetadata: any = {};
    Object.keys(sanitized.metadata).forEach((key) => {
      // Remove sensitive metadata fields
      if (
        key === 'query' ||
        key === 'params' ||
        key === 'constraint_name' ||
        key === 'table_name'
      ) {
        // Skip these sensitive fields entirely
        return;
      }
      cleanMetadata[key] = sanitized.metadata[key];
    });
    sanitized.metadata = cleanMetadata;
  }

  return sanitized;
}

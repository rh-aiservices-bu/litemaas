/**
 * Comprehensive error handling types for LiteMaaS
 * Based on the error handling architecture specification
 */

/**
 * Enhanced error response format with comprehensive context
 */
export interface ErrorResponse {
  error: {
    // Core fields (always present)
    code: string; // Machine-readable error code
    message: string; // Human-readable message
    statusCode: number; // HTTP status code

    // Context fields (optional but recommended)
    details?: ErrorDetails;

    // Tracing fields
    requestId: string; // Unique request identifier
    correlationId?: string; // For distributed tracing
    timestamp: string; // ISO 8601 timestamp

    // Recovery fields (for transient errors)
    retry?: RetryInfo;
  };
}

/**
 * Detailed error context information
 */
export interface ErrorDetails {
  field?: string; // Specific field that caused error
  value?: any; // The invalid value (sanitized)
  constraint?: string; // Validation constraint that failed
  suggestion?: string; // How to fix the error
  helpUrl?: string; // Link to documentation
  resource?: string; // Resource type (e.g., 'user', 'subscription')
  id?: string; // Resource ID if applicable

  // Multiple validation errors
  validation?: Array<{
    field: string;
    message: string;
    code: string;
  }>;

  // Additional context metadata
  metadata?: Record<string, any>;

  // Database-specific error details
  constraintName?: string; // Database constraint name
  table?: string; // Database table name
  column?: string; // Database column name

  // External service error details
  service?: string; // External service name (e.g., 'litellm', 'openshift')
  upstreamCode?: string; // Original error code from external service
  upstreamMessage?: string; // Original error message from external service

  // Rate limiting details
  rateLimitValue?: number; // Rate limit value
  window?: string; // Rate limit window (e.g., '1m', '1h')
  remaining?: number; // Remaining requests in window
  resetTime?: string; // When the rate limit resets

  // Budget/quota details
  currentUsage?: number; // Current usage amount
  usageLimit?: number; // Usage limit
  period?: string; // Billing/quota period
  overage?: number; // Amount over limit
}

/**
 * Configuration for creating ApplicationError instances
 */
export interface ErrorConfig {
  code: string;
  statusCode: number;
  message: string;
  legacyMessage?: string; // Backward compatible message for existing tests
  details?: ErrorDetails;
  retryable?: boolean;
  retryAfter?: number;
  maxRetries?: number;
}

/**
 * Retry information for transient errors
 */
export interface RetryInfo {
  retryable: boolean; // Can this be retried?
  retryAfter?: number; // Seconds to wait before retry
  maxRetries?: number; // Maximum retry attempts
  backoffType?: 'linear' | 'exponential' | 'fixed'; // Backoff strategy
  jitter?: boolean; // Add random jitter to backoff
}

/**
 * Validation error structure (compatible with Fastify/AJV)
 */
export interface ValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

/**
 * Custom error interface that extends Error with additional properties
 */
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  validation?: ValidationError[];
  details?: ErrorDetails;
  retryable?: boolean;
  retryAfter?: number;
  maxRetries?: number;
  correlationId?: string;
}

/**
 * Database error mapping information
 */
export interface DatabaseErrorMapping {
  code: string; // Database error code (e.g., '23505')
  errorCode: string; // Application error code
  statusCode: number; // HTTP status code
  messageTemplate: string; // Template for error message
  getSuggestion?: (error: any) => string; // Function to generate suggestion
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  enableStackTrace: boolean;
  enableSanitization: boolean;
  enableCorrelationId: boolean;
  enableRetryHeaders: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maskSensitiveFields: string[];
  customErrorMappings: Record<string, DatabaseErrorMapping>;
}

/**
 * Error context for logging and debugging
 */
export interface ErrorContext {
  requestId: string;
  correlationId?: string;
  userId?: string;
  userRoles?: string[];
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  timestamp: string;
  duration?: number;
  additionalContext?: Record<string, any>;
}

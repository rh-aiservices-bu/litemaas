/**
 * Unit tests for error helper utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mapDatabaseError,
  getStatusCodeFromErrorCode,
  getErrorCodeFromStatusCode,
  isClientError,
  isServerError,
  isRetryableErrorCode,
  sanitizeErrorMessage,
  sanitizeErrorDetails,
  generateCorrelationId,
  generateRequestId,
  extractOrGenerateCorrelationId,
  calculateRetryDelay,
  calculateRetryTime,
  shouldRetryError,
  withRetry,
  CircuitBreaker,
  CircuitBreakerState,
  createErrorFromHttpResponse,
  DEFAULT_RETRY_CONFIG,
} from '../../../src/utils/error-helpers';
import { ApplicationError, ErrorCode } from '../../../src/utils/errors';

describe('Error Helpers', () => {
  describe('mapDatabaseError', () => {
    it('should map unique constraint violation (23505)', () => {
      const dbError = {
        code: '23505',
        detail: 'Key (email)=(test@example.com) already exists.',
        constraint_name: 'users_email_unique',
        table_name: 'users',
      };

      const error = mapDatabaseError(dbError);

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.code).toBe(ErrorCode.ALREADY_EXISTS);
      expect(error.statusCode).toBe(409);
      expect(error.details?.constraintName).toBe('users_email_unique');
      expect(error.details?.table).toBe('users');
      expect(error.details?.suggestion).toContain('email');
    });

    it('should map foreign key constraint violation (23503)', () => {
      const dbError = {
        code: '23503',
        detail: 'Key (user_id)=(123) is not present in table "users".',
        constraint_name: 'fk_user_id',
        table_name: 'subscriptions',
      };

      const error = mapDatabaseError(dbError);

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.details?.suggestion).toContain('user');
    });

    it('should map not null constraint violation (23502)', () => {
      const dbError = {
        code: '23502',
        column: 'name',
        table_name: 'users',
      };

      const error = mapDatabaseError(dbError);

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.details?.suggestion).toContain('name');
    });

    it('should map connection timeout (08001)', () => {
      const dbError = {
        code: '08001',
        message: 'Connection timeout',
      };

      const error = mapDatabaseError(dbError);

      expect(error.code).toBe(ErrorCode.TIMEOUT);
      expect(error.statusCode).toBe(504);
      expect(error.retryable).toBe(true);
    });

    it('should handle unknown database errors', () => {
      const dbError = {
        code: '99999',
        message: 'Unknown database error',
      };

      const error = mapDatabaseError(dbError);

      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.statusCode).toBe(500);
    });
  });

  describe('HTTP status code mapping', () => {
    it('should map error codes to status codes', () => {
      expect(getStatusCodeFromErrorCode(ErrorCode.UNAUTHORIZED)).toBe(401);
      expect(getStatusCodeFromErrorCode(ErrorCode.FORBIDDEN)).toBe(403);
      expect(getStatusCodeFromErrorCode(ErrorCode.NOT_FOUND)).toBe(404);
      expect(getStatusCodeFromErrorCode(ErrorCode.VALIDATION_ERROR)).toBe(400);
      expect(getStatusCodeFromErrorCode(ErrorCode.INTERNAL_ERROR)).toBe(500);
    });

    it('should map status codes to error codes', () => {
      expect(getErrorCodeFromStatusCode(401)).toBe(ErrorCode.UNAUTHORIZED);
      expect(getErrorCodeFromStatusCode(403)).toBe(ErrorCode.FORBIDDEN);
      expect(getErrorCodeFromStatusCode(404)).toBe(ErrorCode.NOT_FOUND);
      expect(getErrorCodeFromStatusCode(400)).toBe(ErrorCode.VALIDATION_ERROR);
      expect(getErrorCodeFromStatusCode(500)).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('should identify client and server errors', () => {
      expect(isClientError(400)).toBe(true);
      expect(isClientError(404)).toBe(true);
      expect(isClientError(500)).toBe(false);

      expect(isServerError(500)).toBe(true);
      expect(isServerError(502)).toBe(true);
      expect(isServerError(400)).toBe(false);
    });

    it('should identify retryable error codes', () => {
      expect(isRetryableErrorCode(ErrorCode.EXTERNAL_SERVICE_ERROR)).toBe(true);
      expect(isRetryableErrorCode(ErrorCode.TIMEOUT)).toBe(true);
      expect(isRetryableErrorCode(ErrorCode.RATE_LIMITED)).toBe(true);
      expect(isRetryableErrorCode(ErrorCode.VALIDATION_ERROR)).toBe(false);
      expect(isRetryableErrorCode(ErrorCode.UNAUTHORIZED)).toBe(false);
    });
  });

  describe('Message sanitization', () => {
    it('should sanitize sensitive information in production', () => {
      const message =
        'Authentication failed for password "secret123" and api key "sk-1234567890abcdef1234567890abcdef12345678"';
      const sanitized = sanitizeErrorMessage(message, true);

      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('sk-1234567890abcdef1234567890abcdef12345678');
      // Verify that sensitive field names are replaced
      expect(sanitized).not.toContain('password');
      expect(sanitized).not.toContain('key');
    });

    it('should not sanitize in development', () => {
      const message = 'Authentication failed for password "secret123"';
      const sanitized = sanitizeErrorMessage(message, false);

      expect(sanitized).toBe(message);
      expect(sanitized).toContain('secret123');
    });

    it('should sanitize SQL details in production', () => {
      const message = 'Foreign key violation on table "users" column "email"';
      const sanitized = sanitizeErrorMessage(message, true);

      expect(sanitized).toContain('table [REDACTED]');
      expect(sanitized).toContain('column [REDACTED]');
    });

    it('should sanitize error details by removing database-specific fields', () => {
      const details = {
        value: 'sk-1234567890abcdef1234567890abcdef12345678',
        constraint: 'users_email_unique',
        table: 'users',
        column: 'email',
        stack: 'Error stack trace...',
        databaseCode: '23505',
        metadata: {
          password: 'secret',
          apiKey: 'Bearer token123',
          normalField: 'normal value',
          query: 'SELECT * FROM users WHERE password = "secret123"',
          params: ['sensitive-param'],
          constraint_name: 'users_email_unique',
          table_name: 'users',
          keepThisField: 'keep this',
        },
      };

      const sanitized = sanitizeErrorDetails(details, true);

      // Database-specific fields should be removed in production
      expect(sanitized.constraint).toBeUndefined();
      expect(sanitized.table).toBeUndefined();
      expect(sanitized.column).toBeUndefined();
      expect(sanitized.stack).toBeUndefined();
      expect(sanitized.databaseCode).toBeUndefined();

      // Regular values are not sanitized (this is handled by sanitizeErrorMessage)
      expect(sanitized.value).toBe('sk-1234567890abcdef1234567890abcdef12345678');

      // Sensitive metadata fields should be removed
      expect(sanitized.metadata?.query).toBeUndefined();
      expect(sanitized.metadata?.params).toBeUndefined();
      expect(sanitized.metadata?.constraint_name).toBeUndefined();
      expect(sanitized.metadata?.table_name).toBeUndefined();

      // Other metadata fields should be preserved (sanitization happens at message level)
      expect(sanitized.metadata?.password).toBe('secret');
      expect(sanitized.metadata?.apiKey).toBe('Bearer token123');
      expect(sanitized.metadata?.normalField).toBe('normal value');
      expect(sanitized.metadata?.keepThisField).toBe('keep this');
    });

    it('should not sanitize error details in development mode', () => {
      const details = {
        value: 'sk-1234567890abcdef1234567890abcdef12345678',
        constraint: 'users_email_unique',
        table: 'users',
        column: 'email',
        stack: 'Error stack trace...',
        databaseCode: '23505',
        metadata: {
          password: 'secret',
          query: 'SELECT * FROM users',
          constraint_name: 'users_email_unique',
        },
      };

      const sanitized = sanitizeErrorDetails(details, false);

      // In development mode, all fields should be preserved
      expect(sanitized).toEqual(details);
      expect(sanitized.constraint).toBe('users_email_unique');
      expect(sanitized.table).toBe('users');
      expect(sanitized.column).toBe('email');
      expect(sanitized.stack).toBe('Error stack trace...');
      expect(sanitized.metadata?.password).toBe('secret');
      expect(sanitized.metadata?.query).toBe('SELECT * FROM users');
    });

    it('should properly sanitize sensitive values in error messages', () => {
      // Test that shows how sensitive data sanitization actually works via sanitizeErrorMessage
      const messageWithSensitiveData =
        'Authentication failed for api key "sk-1234567890abcdef1234567890abcdef12345678" and password "secret123"';
      const sanitized = sanitizeErrorMessage(messageWithSensitiveData, true);

      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('sk-1234567890abcdef1234567890abcdef12345678');
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('api key');
      expect(sanitized).not.toContain('password');
    });
  });

  describe('Correlation ID utilities', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate shorter request IDs', () => {
      const id = generateRequestId();

      expect(id).toBeDefined();
      expect(id.length).toBe(16); // 8 bytes as hex = 16 characters
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should extract existing correlation ID from headers', () => {
      const headers = {
        'x-correlation-id': 'existing-id-123',
      };

      const id = extractOrGenerateCorrelationId(headers);
      expect(id).toBe('existing-id-123');
    });

    it('should generate new correlation ID if not in headers', () => {
      const headers = {};

      const id = extractOrGenerateCorrelationId(headers);
      expect(id).toBeDefined();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('Retry logic', () => {
    it('should calculate exponential backoff delay', () => {
      const delay1 = calculateRetryDelay(1);
      const delay2 = calculateRetryDelay(2);
      const delay3 = calculateRetryDelay(3);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay3).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelayMs);
    });

    it('should calculate retry time as ISO string', () => {
      const retryTime = calculateRetryTime(1);
      const date = new Date(retryTime);

      expect(date.getTime()).toBeGreaterThan(Date.now());
      expect(retryTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should determine if ApplicationError should be retried', () => {
      const retryableError = ApplicationError.timeout('Operation timeout', 5000);
      const nonRetryableError = ApplicationError.validation('Invalid input');

      expect(shouldRetryError(retryableError, 1)).toBe(true);
      expect(shouldRetryError(retryableError, 5)).toBe(false); // Exceeds default max attempts
      expect(shouldRetryError(nonRetryableError, 1)).toBe(false);
    });

    it('should determine if regular Error should be retried based on message', () => {
      const timeoutError = new Error('Connection timeout occurred');
      const validationError = new Error('Invalid email format');

      expect(shouldRetryError(timeoutError, 1)).toBe(true);
      expect(shouldRetryError(validationError, 1)).toBe(false);
    });

    it('should retry operations with exponential backoff', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('timeout');
        }
        return 'success';
      });

      const result = await withRetry(operation, { maxAttempts: 3, baseDelayMs: 10 });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('timeout occurred'));

      await expect(withRetry(operation, { maxAttempts: 2, baseDelayMs: 10 })).rejects.toThrow(
        'timeout occurred',
      );
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 0.5,
        recoveryTimeoutMs: 1000,
        monitoringWindowMs: 5000,
        minimumRequests: 2,
      });
    });

    it('should start in CLOSED state', () => {
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failures).toBe(0);
      expect(status.requests).toBe(0);
    });

    it('should open circuit after failure threshold is reached', async () => {
      const operation = vi.fn();

      // First request succeeds
      operation.mockResolvedValueOnce('success');
      await circuitBreaker.execute(operation);

      // Next requests fail
      operation.mockRejectedValueOnce(new Error('failure 1'));
      operation.mockRejectedValueOnce(new Error('failure 2'));

      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        expect((error as Error).message).toBe('failure 1');
      }

      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        // At this point circuit should be open, so we get circuit breaker error
        expect((error as Error).message).toContain('Circuit breaker is open');
      }

      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.OPEN);
      // Circuit breaker should be open after 2 failures out of 4 total requests (1 success + 1 failure + 2 attempts)
      expect(status.failureRate).toBe(0.5); // 2 failures out of 4 requests
    });

    it('should reject requests when circuit is OPEN', async () => {
      // Force circuit to open by simulating failures
      circuitBreaker['state'] = CircuitBreakerState.OPEN;
      circuitBreaker['nextRetryTime'] = Date.now() + 5000;

      const operation = vi.fn().mockResolvedValue('success');

      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is open');
      expect(operation).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Force circuit to open with past retry time
      circuitBreaker['state'] = CircuitBreakerState.OPEN;
      circuitBreaker['nextRetryTime'] = Date.now() - 1000; // In the past

      const operation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(circuitBreaker.getStatus().state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reset statistics', () => {
      circuitBreaker['failures'] = 5;
      circuitBreaker['requests'] = 10;
      circuitBreaker['state'] = CircuitBreakerState.OPEN;

      circuitBreaker.reset();

      const status = circuitBreaker.getStatus();
      expect(status.state).toBe(CircuitBreakerState.CLOSED);
      expect(status.failures).toBe(0);
      expect(status.requests).toBe(0);
    });
  });

  describe('createErrorFromHttpResponse', () => {
    it('should create error from HTTP 404 response', () => {
      const response = {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'User not found' },
      };

      const error = createErrorFromHttpResponse(response, 'user-service');

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.details?.service).toBe('user-service');
      expect(error.details?.upstreamMessage).toBe('User not found');
    });

    it('should handle server errors as retryable', () => {
      const response = {
        status: 500,
        statusText: 'Internal Server Error',
      };

      const error = createErrorFromHttpResponse(response);

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(60);
    });

    it('should handle rate limiting with retry after', () => {
      const response = {
        status: 429,
        statusText: 'Too Many Requests',
      };

      const error = createErrorFromHttpResponse(response);

      expect(error.code).toBe(ErrorCode.RATE_LIMITED);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(30);
    });

    it('should extract error details from complex response data', () => {
      const response = {
        status: 400,
        data: {
          error: {
            message: 'Validation failed',
            code: 'INVALID_EMAIL',
          },
        },
      };

      const error = createErrorFromHttpResponse(response);

      expect(error.details?.upstreamMessage).toBe('Validation failed');
      expect(error.details?.upstreamCode).toBe('INVALID_EMAIL');
    });
  });
});

/**
 * Example usage of error helper utilities
 * This file demonstrates how to use the various error helpers in real scenarios
 */

import {
  mapDatabaseError,
  sanitizeErrorMessage,
  sanitizeErrorDetails,
  generateCorrelationId,
  extractOrGenerateCorrelationId,
  withRetry,
  CircuitBreaker,
  createErrorFromHttpResponse,
  shouldRetryError,
} from '../utils/error-helpers';
import { ApplicationError } from '../utils/errors';

// Example 1: Database error handling
export function handleDatabaseError(pgError: any): ApplicationError {
  // Map PostgreSQL errors to standardized ApplicationErrors
  const error = mapDatabaseError(pgError);

  // Log the error with sanitized details
  const sanitizedMessage = sanitizeErrorMessage(error.message);
  console.error('Database error occurred:', sanitizedMessage);

  return error;
}

// Example 2: HTTP service integration with error handling
class ExternalService {
  private circuitBreaker = new CircuitBreaker({
    failureThreshold: 0.5,
    recoveryTimeoutMs: 60000,
    monitoringWindowMs: 60000,
    minimumRequests: 5,
  });

  async callExternalAPI(url: string, data: any, correlationId?: string): Promise<any> {
    const requestId = correlationId || generateCorrelationId();

    return this.circuitBreaker.execute(async () => {
      return withRetry(
        async () => {
          try {
            // Simulated HTTP call
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Correlation-ID': requestId,
              },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              const errorResponse = {
                status: response.status,
                statusText: response.statusText,
                data: await response.json().catch(() => ({})),
              };

              throw createErrorFromHttpResponse(errorResponse, 'external-api');
            }

            return response.json();
          } catch (error) {
            if (error instanceof ApplicationError) {
              throw error;
            }

            // Convert unknown errors to ApplicationError
            throw ApplicationError.fromUnknown(error, 'External API call failed');
          }
        },
        {
          maxAttempts: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
        },
      );
    });
  }
}

// Example 3: Request middleware for correlation ID handling
export function correlationIdMiddleware(req: any, res: any, next: any): void {
  // Extract or generate correlation ID
  const correlationId = extractOrGenerateCorrelationId(req.headers);

  // Add to request context
  req.correlationId = correlationId;

  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

// Example 4: Service method with comprehensive error handling
export class UserService {
  async createUser(userData: any, correlationId?: string): Promise<any> {
    try {
      // Simulate database operation
      const user = await this.database.create(userData);
      return user;
    } catch (error: any) {
      // Handle database errors
      if (error.code && error.code.startsWith('23')) {
        const dbError = mapDatabaseError(error);

        // Add correlation ID to error context
        if (correlationId) {
          (dbError as any).correlationId = correlationId;
        }

        throw dbError;
      }

      // Handle other errors
      throw ApplicationError.fromUnknown(error, 'User creation failed');
    }
  }

  private database = {
    async create(userData: any) {
      // Simulate unique constraint violation
      if (userData.email === 'duplicate@example.com') {
        const error = new Error('Duplicate key value violates unique constraint');
        (error as any).code = '23505';
        (error as any).detail = 'Key (email)=(duplicate@example.com) already exists.';
        (error as any).constraint_name = 'users_email_unique';
        throw error;
      }

      return { id: 1, ...userData };
    },
  };
}

// Example 5: Error logging with sanitization
export function logError(error: ApplicationError, context: any = {}): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Sanitize error message and details
  const sanitizedMessage = sanitizeErrorMessage(error.message, isProduction);
  const sanitizedDetails = error.details
    ? sanitizeErrorDetails(error.details, isProduction)
    : undefined;

  const logData = {
    error: {
      code: error.code,
      message: sanitizedMessage,
      statusCode: error.statusCode,
      details: sanitizedDetails,
      stack: isProduction ? undefined : error.stack,
    },
    context,
    timestamp: new Date().toISOString(),
    correlationId: (error as any).correlationId,
  };

  console.error('Application error:', JSON.stringify(logData, null, 2));
}

// Example 6: Retry logic for batch operations
export class BatchProcessor {
  async processBatch(items: any[], processor: (item: any) => Promise<any>): Promise<any[]> {
    const results = [];

    for (const item of items) {
      try {
        const result = await withRetry(
          () => processor(item),
          {
            maxAttempts: 3,
            baseDelayMs: 500,
            backoffMultiplier: 2,
            jitterPercent: 10,
          },
          (error, attempt) => {
            // Custom retry logic
            if (error instanceof ApplicationError) {
              return error.isRetryable() && attempt < 3;
            }

            return shouldRetryError(error, attempt, 3);
          },
        );

        results.push(result);
      } catch (error) {
        // Log error but continue processing other items
        if (error instanceof ApplicationError) {
          logError(error, { item });
        } else {
          const appError = ApplicationError.fromUnknown(error, 'Batch item processing failed');
          logError(appError, { item });
        }

        // Add null result to maintain array indices
        results.push(null);
      }
    }

    return results;
  }
}

// Example 7: Circuit breaker status monitoring
export function getCircuitBreakerStatus(circuitBreaker: CircuitBreaker): any {
  const status = circuitBreaker.getStatus();

  return {
    ...status,
    healthStatus: status.state === 'CLOSED' ? 'healthy' : 'degraded',
    recommendation:
      status.state === 'OPEN'
        ? 'Service is temporarily unavailable due to repeated failures'
        : status.failureRate > 0.3
          ? 'Service is experiencing elevated error rates'
          : 'Service is operating normally',
  };
}

// Usage examples:
export async function demonstrateUsage(): Promise<void> {
  const correlationId = generateCorrelationId();
  const userService = new UserService();
  const externalService = new ExternalService();

  try {
    // Example with unique constraint violation
    await userService.createUser(
      {
        email: 'duplicate@example.com',
        name: 'Test User',
      },
      correlationId,
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      logError(error, { operation: 'createUser' });
    }
  }

  try {
    // Example with external service call
    await externalService.callExternalAPI(
      'https://api.example.com/data',
      {
        message: 'Hello, world!',
      },
      correlationId,
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      logError(error, { operation: 'callExternalAPI' });
    }
  }

  // Example with batch processing
  const batchProcessor = new BatchProcessor();
  const items = [1, 2, 3, 4, 5];

  const results = await batchProcessor.processBatch(items, async (item) => {
    // Simulate some processing that might fail
    if (item === 3) {
      throw new Error('Processing failed for item 3');
    }
    return item * 2;
  });

  console.log('Batch processing results:', results);
}

// Note: This file contains example code for demonstration purposes
// Classes are not exported to avoid conflicts with actual service implementations

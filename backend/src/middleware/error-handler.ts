import { FastifyPluginAsync, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ErrorResponse, ValidationError } from '../types/error.types';
import { ErrorCode, ApplicationError } from '../utils/errors';
import { mapDatabaseError, sanitizeErrorDetails } from '../utils/error-helpers';

/**
 * Validate correlation ID format (UUID v4)
 */
function validateCorrelationId(id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? id : undefined;
}

/**
 * Enhanced error handler middleware that supports both legacy and new error formats
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  // Set error handler
  fastify.setErrorHandler(
    async (
      error: FastifyError | ApplicationError,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const requestId = request.id;
      const correlationId = validateCorrelationId(request.headers['x-correlation-id']);

      // Handle ApplicationError instances
      if (error instanceof ApplicationError) {
        const isProduction = process.env.NODE_ENV === 'production';
        const sanitizedError = {
          ...error.toJSON(),
          details: sanitizeErrorDetails(error.details, isProduction),
        };

        const errorResponse: ErrorResponse = {
          error: {
            ...sanitizedError,
            requestId,
            correlationId,
          },
        };

        fastify.log.error(
          {
            ...errorResponse,
            stack: error.stack,
            url: request.url,
            method: request.method,
            userId: (request as any).user?.id,
          },
          'ApplicationError occurred',
        );

        return reply.status(error.statusCode).send(errorResponse);
      }

      // Handle Fastify validation errors
      if (error.validation) {
        const validationErrors = error.validation.map((v: ValidationError) => ({
          field: v.instancePath.replace('/', '') || 'unknown',
          message: v.message || 'Invalid value',
          code: v.keyword || 'validation',
        }));

        const errorResponse: ErrorResponse = {
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Request validation failed',
            statusCode: 400,
            details: {
              validation: validationErrors,
              suggestion: 'Please check your input and try again',
            },
            requestId,
            correlationId,
            timestamp: new Date().toISOString(),
          },
        };

        fastify.log.error(
          {
            ...errorResponse,
            url: request.url,
            method: request.method,
          },
          'Validation error occurred',
        );

        return reply.status(400).send(errorResponse);
      }

      // Handle database constraint errors
      if (error.code && error.code.startsWith('23')) {
        const appError = mapDatabaseError(error);
        const errorResponse: ErrorResponse = {
          error: {
            ...appError.toJSON(),
            requestId,
            correlationId,
          },
        };

        fastify.log.error(
          {
            ...errorResponse,
            stack: error.stack,
            url: request.url,
            method: request.method,
          },
          'Database error occurred',
        );

        return reply.status(appError.statusCode).send(errorResponse);
      }

      // Handle JWT errors
      if (error.message && error.message.toLowerCase().includes('jwt')) {
        const errorResponse: ErrorResponse = {
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid authentication token',
            statusCode: 401,
            details: {
              suggestion: 'Please log in again to refresh your authentication token',
            },
            requestId,
            correlationId,
            timestamp: new Date().toISOString(),
          },
        };

        fastify.log.error(
          {
            ...errorResponse,
            url: request.url,
            method: request.method,
          },
          'JWT error occurred',
        );

        return reply.status(401).send(errorResponse);
      }

      // Handle rate limit errors specifically
      if ((error as any).code === 'RATE_LIMITED' || error.statusCode === 429) {
        const errorResponse: ErrorResponse = {
          error: {
            code: ErrorCode.RATE_LIMITED,
            message: error.message || 'Too many requests',
            statusCode: 429,
            details: {
              ...(error as any).details,
              suggestion: (error as any).details?.suggestion || 'Please wait before trying again',
            },
            requestId,
            correlationId,
            timestamp: new Date().toISOString(),
            retry: {
              retryable: true,
              retryAfter: Math.ceil(((error as any).details?.remaining || 60000) / 1000),
            },
          },
        };

        fastify.log.error(
          {
            ...errorResponse,
            url: request.url,
            method: request.method,
          },
          'Rate limit exceeded',
        );

        return reply.status(429).send(errorResponse);
      }

      // Handle errors with statusCode (custom Fastify errors)
      if (error.statusCode) {
        const errorCode = mapStatusCodeToErrorCode(error.statusCode);

        const errorResponse: ErrorResponse = {
          error: {
            code: errorCode,
            message: error.message || getDefaultMessageForStatus(error.statusCode),
            statusCode: error.statusCode,
            requestId,
            correlationId,
            timestamp: new Date().toISOString(),
          },
        };

        fastify.log.error(
          {
            ...errorResponse,
            stack: error.stack,
            url: request.url,
            method: request.method,
          },
          'Custom error occurred',
        );

        return reply.status(error.statusCode).send(errorResponse);
      }

      // Handle unknown errors (500)
      const isDevelopment = process.env.NODE_ENV !== 'production';

      const errorResponse: ErrorResponse = {
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: isDevelopment ? error.message : 'An unexpected error occurred',
          statusCode: 500,
          details: isDevelopment
            ? {
                metadata: {
                  originalError:
                    error instanceof Error
                      ? error.message || error.toString()
                      : JSON.stringify(error), // This will properly show object contents
                  stack: error.stack,
                },
              }
            : {
                suggestion: 'Please try again or contact support if the problem persists',
              },
          requestId,
          correlationId,
          timestamp: new Date().toISOString(),
        },
      };

      fastify.log.error(
        {
          ...errorResponse,
          stack: error.stack,
          url: request.url,
          method: request.method,
        },
        'Unknown error occurred',
      );

      return reply.status(500).send(errorResponse);
    },
  );

  // Not found handler
  fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
        details: {
          suggestion: 'Please check the URL and try again',
        },
        requestId: request.id,
        correlationId: request.headers['x-correlation-id'] as string,
        timestamp: new Date().toISOString(),
      },
    };

    fastify.log.warn(
      {
        ...errorResponse,
        url: request.url,
        method: request.method,
      },
      'Route not found',
    );

    reply.status(404).send(errorResponse);
  });

  // Helper decorators for backward compatibility (these will create ApplicationError instances)
  fastify.decorate('createError', (statusCode: number, message: string, details?: any) => {
    const errorCode = mapStatusCodeToErrorCode(statusCode);
    return new ApplicationError({
      code: errorCode,
      statusCode,
      message,
      details,
    });
  });

  fastify.decorate('createValidationError', (message: string, field?: string) => {
    return ApplicationError.validation(
      message,
      field,
      undefined,
      'Please check your input and try again',
    );
  });

  fastify.decorate('createNotFoundError', (resource: string) => {
    return ApplicationError.notFound(resource);
  });

  fastify.decorate('createAuthError', (message: string = 'Unauthorized') => {
    return ApplicationError.unauthorized(message);
  });

  fastify.decorate('createForbiddenError', (message: string = 'Forbidden') => {
    return ApplicationError.forbidden(message);
  });
};

/**
 * Map HTTP status codes to error codes
 */
function mapStatusCodeToErrorCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ErrorCode.VALIDATION_ERROR;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 502:
      return ErrorCode.EXTERNAL_SERVICE_ERROR;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    case 504:
      return ErrorCode.TIMEOUT;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Get default error message for status code
 */
function getDefaultMessageForStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 409:
      return 'Conflict';
    case 429:
      return 'Too many requests';
    case 502:
      return 'Bad gateway';
    case 503:
      return 'Service unavailable';
    case 504:
      return 'Gateway timeout';
    default:
      return 'Internal server error';
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    createError: (statusCode: number, message: string, details?: any) => ApplicationError;
    createValidationError: (message: string, field?: string) => ApplicationError;
    createNotFoundError: (resource: string) => ApplicationError;
    createAuthError: (message?: string) => ApplicationError;
    createForbiddenError: (message?: string) => ApplicationError;
  }
}

export default fastifyPlugin(errorHandlerPlugin);

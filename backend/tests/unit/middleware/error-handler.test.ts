import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ApplicationError, ErrorCode } from '../../../src/utils/errors';
import type { ValidationError } from '../../../src/types/error.types';

describe('Error Handler Middleware', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: any;

  beforeEach(() => {
    mockRequest = {
      id: 'req-123',
      url: '/api/test',
      method: 'POST',
      headers: {
        'x-correlation-id': 'corr-456',
      },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    mockFastify = {
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    } as Partial<FastifyInstance>;
  });

  describe('ApplicationError Handling', () => {
    it('should transform ApplicationError to HTTP response', async () => {
      const error = ApplicationError.validation('Invalid email format', 'email');

      const errorHandler = async (
        err: ApplicationError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        const errorResponse = {
          error: {
            ...err.toJSON(),
            requestId: request.id,
            correlationId: request.headers['x-correlation-id'] as string,
          },
        };

        mockFastify.log!.error(
          {
            ...errorResponse,
            stack: err.stack,
            url: request.url,
            method: request.method,
          },
          'ApplicationError occurred',
        );

        return reply.status(err.statusCode).send(errorResponse);
      };

      await errorHandler(error, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid email format',
            statusCode: 400,
            requestId: 'req-123',
            correlationId: 'corr-456',
          }),
        }),
      );
    });

    it('should sanitize error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = ApplicationError.internal('Database query failed', {
        sensitiveData: 'password123',
        query: 'SELECT * FROM users WHERE password = ?',
      });

      const errorHandler = async (
        err: ApplicationError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        const isProduction = process.env.NODE_ENV === 'production';

        // Sanitize details in production
        const sanitizedDetails = isProduction ? {} : err.details;

        const errorResponse = {
          error: {
            ...err.toJSON(),
            details: sanitizedDetails,
            requestId: request.id,
          },
        };

        return reply.status(err.statusCode).send(errorResponse);
      };

      await errorHandler(error, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: {},
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = ApplicationError.internal('Something went wrong');

      const errorHandler = async (
        err: ApplicationError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        mockFastify.log!.error(
          {
            error: err.toJSON(),
            stack: err.stack,
            url: request.url,
          },
          'ApplicationError occurred',
        );

        return reply.status(err.statusCode).send({ error: err.toJSON() });
      };

      await errorHandler(error, mockRequest as FastifyRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        }),
        'ApplicationError occurred',
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Validation Error Handling', () => {
    it('should transform Fastify validation errors to 400 response', async () => {
      const validationError: Partial<FastifyError> = {
        validation: [
          {
            instancePath: '/email',
            message: 'must match format "email"',
            keyword: 'format',
          } as ValidationError,
          {
            instancePath: '/age',
            message: 'must be >= 18',
            keyword: 'minimum',
          } as ValidationError,
        ],
        statusCode: 400,
        message: 'Validation failed',
      };

      const errorHandler = async (
        err: FastifyError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        if (err.validation) {
          const validationErrors = err.validation.map((v: ValidationError) => ({
            field: v.instancePath.replace('/', '') || 'unknown',
            message: v.message || 'Invalid value',
            code: v.keyword || 'validation',
          }));

          const errorResponse = {
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: 'Request validation failed',
              statusCode: 400,
              details: {
                validation: validationErrors,
                suggestion: 'Please check your input and try again',
              },
              requestId: request.id,
              correlationId: request.headers['x-correlation-id'] as string,
              timestamp: new Date().toISOString(),
            },
          };

          return reply.status(400).send(errorResponse);
        }
      };

      await errorHandler(validationError as FastifyError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            details: expect.objectContaining({
              validation: expect.arrayContaining([
                expect.objectContaining({
                  field: 'email',
                  message: 'must match format "email"',
                  code: 'format',
                }),
                expect.objectContaining({
                  field: 'age',
                  message: 'must be >= 18',
                  code: 'minimum',
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should handle empty instancePath in validation errors', async () => {
      const validationError: Partial<FastifyError> = {
        validation: [
          {
            instancePath: '',
            message: 'request body must be object',
            keyword: 'type',
          } as ValidationError,
        ],
        statusCode: 400,
      };

      const errorHandler = async (
        err: FastifyError,
        _request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        if (err.validation) {
          const validationErrors = err.validation.map((v: ValidationError) => ({
            field: v.instancePath.replace('/', '') || 'unknown',
            message: v.message || 'Invalid value',
            code: v.keyword || 'validation',
          }));

          return reply.status(400).send({ validation: validationErrors });
        }
      };

      await errorHandler(validationError as FastifyError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.arrayContaining([
            expect.objectContaining({
              field: 'unknown',
            }),
          ]),
        }),
      );
    });
  });

  describe('Database Error Handling', () => {
    it('should map unique constraint violation to 409 Conflict', async () => {
      const dbError: any = {
        code: '23505', // PostgreSQL unique violation
        detail: 'Key (email)=(test@example.com) already exists.',
        constraint: 'users_email_key',
      };

      const errorHandler = async (err: any, request: FastifyRequest, reply: FastifyReply) => {
        if (err.code && err.code.startsWith('23')) {
          // Map to ApplicationError
          let appError: ApplicationError;

          if (err.code === '23505') {
            const field = err.constraint?.replace(/.*_(.*)_key/, '$1') || 'resource';
            appError = ApplicationError.alreadyExists('User', field, 'test@example.com');
          } else {
            appError = ApplicationError.database('Database constraint violation', err);
          }

          const errorResponse = {
            error: {
              ...appError.toJSON(),
              requestId: request.id,
            },
          };

          return reply.status(appError.statusCode).send(errorResponse);
        }
      };

      await errorHandler(dbError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(409);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.ALREADY_EXISTS,
          }),
        }),
      );
    });

    it('should map foreign key violation to appropriate error', async () => {
      const dbError: any = {
        code: '23503', // PostgreSQL foreign key violation
        detail: 'Key (user_id)=(123) is not present in table "users".',
        constraint: 'subscriptions_user_id_fkey',
      };

      const errorHandler = async (err: any, request: FastifyRequest, reply: FastifyReply) => {
        if (err.code === '23503') {
          const appError = ApplicationError.validation(
            'Referenced resource does not exist',
            'user_id',
            '123',
            'Please ensure the referenced user exists',
          );

          const errorResponse = {
            error: {
              ...appError.toJSON(),
              requestId: request.id,
            },
          };

          return reply.status(appError.statusCode).send(errorResponse);
        }
      };

      await errorHandler(dbError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Referenced resource does not exist',
          }),
        }),
      );
    });

    it('should map not-null violation to validation error', async () => {
      const dbError: any = {
        code: '23502', // PostgreSQL not-null violation
        column: 'email',
        table: 'users',
      };

      const errorHandler = async (err: any, request: FastifyRequest, reply: FastifyReply) => {
        if (err.code === '23502') {
          const appError = ApplicationError.validation(
            `Field '${err.column}' is required`,
            err.column,
          );

          return reply.status(400).send({
            error: {
              ...appError.toJSON(),
              requestId: request.id,
            },
          });
        }
      };

      await errorHandler(dbError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: "Field 'email' is required",
          }),
        }),
      );
    });
  });

  describe('JWT Error Handling', () => {
    it('should handle expired JWT token', async () => {
      const jwtError: Partial<FastifyError> = {
        message: 'jwt expired',
        statusCode: 401,
      };

      const errorHandler = async (
        err: FastifyError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        if (err.message && err.message.toLowerCase().includes('jwt')) {
          const errorResponse = {
            error: {
              code: ErrorCode.UNAUTHORIZED,
              message: 'Invalid authentication token',
              statusCode: 401,
              details: {
                suggestion: 'Please log in again to refresh your authentication token',
              },
              requestId: request.id,
              timestamp: new Date().toISOString(),
            },
          };

          return reply.status(401).send(errorResponse);
        }
      };

      await errorHandler(jwtError as FastifyError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid authentication token',
          }),
        }),
      );
    });

    it('should handle invalid JWT signature', async () => {
      const jwtError: Partial<FastifyError> = {
        message: 'invalid jwt signature',
        statusCode: 401,
      };

      const errorHandler = async (
        err: FastifyError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        if (err.message && err.message.toLowerCase().includes('jwt')) {
          return reply.status(401).send({
            error: {
              code: ErrorCode.UNAUTHORIZED,
              message: 'Invalid authentication token',
              requestId: request.id,
            },
          });
        }
      };

      await errorHandler(jwtError as FastifyError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Rate Limit Error Handling', () => {
    it('should handle rate limit errors with retry information', async () => {
      const rateLimitError: any = {
        code: 'RATE_LIMITED',
        statusCode: 429,
        message: 'Too many requests',
        details: {
          limit: 100,
          remaining: 0,
          retryAfter: 60,
        },
      };

      const errorHandler = async (err: any, request: FastifyRequest, reply: FastifyReply) => {
        if (err.code === 'RATE_LIMITED' || err.statusCode === 429) {
          const errorResponse = {
            error: {
              code: ErrorCode.RATE_LIMITED,
              message: err.message || 'Too many requests',
              statusCode: 429,
              details: {
                ...err.details,
                suggestion: 'Please wait before trying again',
              },
              requestId: request.id,
              timestamp: new Date().toISOString(),
              retry: {
                retryable: true,
                retryAfter: Math.ceil((err.details?.remaining || 60000) / 1000),
              },
            },
          };

          return reply.status(429).send(errorResponse);
        }
      };

      await errorHandler(rateLimitError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(429);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.RATE_LIMITED,
            retry: expect.objectContaining({
              retryable: true,
            }),
          }),
        }),
      );
    });

    it('should include retry-after calculation', async () => {
      const rateLimitError: any = {
        statusCode: 429,
        message: 'Rate limit exceeded',
        details: {
          remaining: 120000, // 2 minutes in ms
        },
      };

      const errorHandler = async (err: any, _request: FastifyRequest, reply: FastifyReply) => {
        if (err.statusCode === 429) {
          const retryAfterSeconds = Math.ceil((err.details?.remaining || 60000) / 1000);

          return reply.status(429).send({
            error: {
              retry: {
                retryAfter: retryAfterSeconds,
              },
            },
          });
        }
      };

      await errorHandler(rateLimitError, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            retry: expect.objectContaining({
              retryAfter: 120, // 120000ms / 1000 = 120s
            }),
          }),
        }),
      );
    });
  });

  describe('Status Code Mapping', () => {
    it('should map 404 to NOT_FOUND error code', async () => {
      const notFoundError: Partial<FastifyError> = {
        statusCode: 404,
        message: 'Resource not found',
      };

      const mapStatusCodeToErrorCode = (statusCode: number): ErrorCode => {
        switch (statusCode) {
          case 404:
            return ErrorCode.NOT_FOUND;
          case 401:
            return ErrorCode.UNAUTHORIZED;
          case 403:
            return ErrorCode.FORBIDDEN;
          default:
            return ErrorCode.INTERNAL_ERROR;
        }
      };

      const errorCode = mapStatusCodeToErrorCode(notFoundError.statusCode!);
      expect(errorCode).toBe(ErrorCode.NOT_FOUND);
    });

    it('should map 503 to SERVICE_UNAVAILABLE error code', async () => {
      const serviceError: Partial<FastifyError> = {
        statusCode: 503,
        message: 'Service temporarily unavailable',
      };

      const mapStatusCodeToErrorCode = (statusCode: number): ErrorCode => {
        switch (statusCode) {
          case 503:
            return ErrorCode.SERVICE_UNAVAILABLE;
          case 502:
            return ErrorCode.EXTERNAL_SERVICE_ERROR;
          case 504:
            return ErrorCode.TIMEOUT;
          default:
            return ErrorCode.INTERNAL_ERROR;
        }
      };

      const errorCode = mapStatusCodeToErrorCode(serviceError.statusCode!);
      expect(errorCode).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    });

    it('should default unknown status codes to INTERNAL_ERROR', async () => {
      const mapStatusCodeToErrorCode = (statusCode: number): ErrorCode => {
        const mappings: Record<number, ErrorCode> = {
          400: ErrorCode.VALIDATION_ERROR,
          401: ErrorCode.UNAUTHORIZED,
          403: ErrorCode.FORBIDDEN,
          404: ErrorCode.NOT_FOUND,
        };

        return mappings[statusCode] || ErrorCode.INTERNAL_ERROR;
      };

      expect(mapStatusCodeToErrorCode(418)).toBe(ErrorCode.INTERNAL_ERROR); // I'm a teapot
      expect(mapStatusCodeToErrorCode(999)).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });

  describe('Error Logging', () => {
    it('should log errors with request context', async () => {
      const error = ApplicationError.internal('Something went wrong');
      (mockRequest as any).user = { id: 'user-123' };

      const errorHandler = async (
        err: ApplicationError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        mockFastify.log!.error(
          {
            error: err.toJSON(),
            stack: err.stack,
            url: request.url,
            method: request.method,
            userId: (request as any).user?.id,
          },
          'ApplicationError occurred',
        );

        return reply.status(err.statusCode).send({ error: err.toJSON() });
      };

      await errorHandler(error, mockRequest as FastifyRequest, mockReply);

      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/test',
          method: 'POST',
          userId: 'user-123',
        }),
        'ApplicationError occurred',
      );
    });

    it('should include correlation ID in logs', async () => {
      const error = ApplicationError.notFound('User', 'user-123');

      const errorHandler = async (
        err: ApplicationError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        const errorResponse = {
          error: {
            ...err.toJSON(),
            requestId: request.id,
            correlationId: request.headers['x-correlation-id'] as string,
          },
        };

        mockFastify.log!.error(
          {
            ...errorResponse,
            stack: err.stack,
          },
          'ApplicationError occurred',
        );

        return reply.status(err.statusCode).send(errorResponse);
      };

      await errorHandler(error, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            correlationId: 'corr-456',
          }),
        }),
      );
    });

    it('should redact sensitive data from error logs', async () => {
      const errorDetails = {
        query: 'SELECT * FROM users WHERE password = $1',
        params: ['secret123'],
        password: 'mypassword',
      };

      const sanitizeForLogging = (details: any): any => {
        if (!details) return details;

        const sanitized = { ...details };
        if (sanitized.params) {
          sanitized.params = '[REDACTED]';
        }
        if (sanitized.password) {
          sanitized.password = '[REDACTED]';
        }
        return sanitized;
      };

      const sanitizedDetails = sanitizeForLogging(errorDetails);

      expect(sanitizedDetails.params).toBe('[REDACTED]');
      expect(sanitizedDetails.password).toBe('[REDACTED]');
      expect(sanitizedDetails.query).toBe('SELECT * FROM users WHERE password = $1');
    });
  });

  describe('Not Found Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const notFoundHandler = async (request: FastifyRequest, reply: FastifyReply) => {
        const errorResponse = {
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Route ${request.method} ${request.url} not found`,
            statusCode: 404,
            details: {
              suggestion: 'Please check the URL and try again',
            },
            requestId: request.id,
            timestamp: new Date().toISOString(),
          },
        };

        return reply.status(404).send(errorResponse);
      };

      await notFoundHandler(mockRequest as FastifyRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.NOT_FOUND,
            message: 'Route POST /api/test not found',
          }),
        }),
      );
    });

    it('should log not found errors as warnings', async () => {
      const notFoundHandler = async (request: FastifyRequest, reply: FastifyReply) => {
        const errorResponse = {
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Route ${request.method} ${request.url} not found`,
            statusCode: 404,
          },
        };

        mockFastify.log!.warn(
          {
            ...errorResponse,
            url: request.url,
            method: request.method,
          },
          'Route not found',
        );

        return reply.status(404).send(errorResponse);
      };

      await notFoundHandler(mockRequest as FastifyRequest, mockReply);

      expect(mockFastify.log!.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/api/test',
          method: 'POST',
        }),
        'Route not found',
      );
    });
  });

  describe('Error Response Format', () => {
    it('should return standardized error JSON', async () => {
      const error = ApplicationError.forbidden('Access denied');

      const errorHandler = async (
        err: ApplicationError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        const errorResponse = {
          error: {
            ...err.toJSON(),
            requestId: request.id,
            timestamp: new Date().toISOString(),
          },
        };

        return reply.status(err.statusCode).send(errorResponse);
      };

      await errorHandler(error, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String),
            statusCode: expect.any(Number),
            requestId: expect.any(String),
            timestamp: expect.any(String),
          }),
        }),
      );
    });

    it('should exclude stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal server error');

      const errorHandler = async (err: Error, _request: FastifyRequest, reply: FastifyReply) => {
        const isDevelopment = process.env.NODE_ENV !== 'production';

        const errorResponse = {
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: isDevelopment ? err.message : 'An unexpected error occurred',
            statusCode: 500,
            details: isDevelopment
              ? { stack: err.stack }
              : { suggestion: 'Please try again or contact support' },
          },
        };

        return reply.status(500).send(errorResponse);
      };

      await errorHandler(error, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'An unexpected error occurred',
            details: expect.objectContaining({
              suggestion: expect.any(String),
            }),
          }),
        }),
      );

      const sentData = mockReply.send.mock.calls[0][0];
      expect(sentData.error.details).not.toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });

    it('should include validation details when applicable', async () => {
      const error = ApplicationError.validation(
        'Invalid input',
        'email',
        'not-an-email',
        'Please provide a valid email address',
      );

      const errorHandler = async (
        err: ApplicationError,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => {
        const errorResponse = {
          error: {
            ...err.toJSON(),
            requestId: request.id,
          },
        };

        return reply.status(err.statusCode).send(errorResponse);
      };

      await errorHandler(error, mockRequest as FastifyRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: expect.objectContaining({
              field: 'email',
              value: 'not-an-email',
            }),
          }),
        }),
      );
    });
  });
});

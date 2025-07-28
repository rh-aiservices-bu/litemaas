import { FastifyPluginAsync, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { ErrorCode, ErrorResponse } from '../types';

interface ValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

interface ErrorDetails {
  validation?: ValidationError[];
  [key: string]: unknown;
}

interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  validation?: ValidationError[];
  details?: ErrorDetails;
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  // Set error handler
  fastify.setErrorHandler(
    async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id;

      // Log the error
      fastify.log.error(
        {
          error: {
            message: error.message,
            stack: error.stack,
            statusCode: error.statusCode,
            code: error.code,
            validation: error.validation,
          },
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers,
            id: requestId,
          },
        },
        'Request error occurred',
      );

      // Determine error type and response
      let statusCode = 500;
      let errorCode = ErrorCode.INTERNAL_ERROR;
      let message = 'Internal server error';
      let details: ErrorDetails | undefined = undefined;

      // Handle Fastify validation errors
      if (error.validation) {
        statusCode = 400;
        errorCode = ErrorCode.VALIDATION_ERROR;
        message = 'Request validation failed';
        details = {
          validation: error.validation,
        };
      }
      // Handle custom errors
      else if (error.statusCode) {
        statusCode = error.statusCode;

        switch (statusCode) {
          case 400:
            errorCode = ErrorCode.VALIDATION_ERROR;
            message = error.message || 'Bad request';
            break;
          case 401:
            errorCode = ErrorCode.UNAUTHORIZED;
            message = error.message || 'Unauthorized';
            break;
          case 403:
            errorCode = ErrorCode.FORBIDDEN;
            message = error.message || 'Forbidden';
            break;
          case 404:
            errorCode = ErrorCode.NOT_FOUND;
            message = error.message || 'Not found';
            break;
          case 409:
            errorCode = ErrorCode.VALIDATION_ERROR;
            message = error.message || 'Conflict';
            break;
          case 429:
            errorCode = ErrorCode.RATE_LIMITED;
            message = error.message || 'Too many requests';
            break;
          default:
            errorCode = ErrorCode.INTERNAL_ERROR;
            message = 'Internal server error';
        }
      }
      // Handle database errors
      else if (error.code && error.code.startsWith('23')) {
        statusCode = 409;
        errorCode = ErrorCode.VALIDATION_ERROR;

        if (error.code === '23505') {
          message = 'Resource already exists';
          details = { constraint: 'unique_violation' };
        } else if (error.code === '23503') {
          message = 'Referenced resource not found';
          details = { constraint: 'foreign_key_violation' };
        } else {
          message = 'Database constraint violation';
        }
      }
      // Handle JWT errors
      else if (error.message && error.message.includes('jwt')) {
        statusCode = 401;
        errorCode = ErrorCode.UNAUTHORIZED;
        message = 'Invalid authentication token';
      }

      // Don't expose internal errors in production
      if (statusCode === 500 && process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
        details = undefined;
      }

      const errorResponse: ErrorResponse = {
        error: {
          code: errorCode,
          message,
          ...(details && { details }),
        },
        requestId,
      };

      reply.status(statusCode).send(errorResponse);
    },
  );

  // Not found handler
  fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
      },
      requestId: request.id,
    };

    reply.status(404).send(errorResponse);
  });

  // Helper to create custom errors
  fastify.decorate('createError', (statusCode: number, message: string, details?: ErrorDetails) => {
    const error = new Error(message) as CustomError;
    error.statusCode = statusCode;
    error.code = `HTTP_${statusCode}`;
    if (details) {
      error.details = details;
    }
    return error;
  });

  // Helper to create validation error
  fastify.decorate('createValidationError', (message: string, field?: string) => {
    const error = new Error(message) as CustomError;
    error.statusCode = 400;
    error.code = ErrorCode.VALIDATION_ERROR;
    if (field) {
      error.validation = [
        {
          instancePath: `/${field}`,
          schemaPath: `#/properties/${field}`,
          keyword: 'custom',
          params: {},
          message,
        },
      ];
    }
    return error;
  });

  // Helper to create not found error
  fastify.decorate('createNotFoundError', (resource: string) => {
    const error = new Error(`${resource} not found`) as CustomError;
    error.statusCode = 404;
    error.code = ErrorCode.NOT_FOUND;
    return error;
  });

  // Helper to create authorization error
  fastify.decorate('createAuthError', (message: string = 'Unauthorized') => {
    const error = new Error(message) as CustomError;
    error.statusCode = 401;
    error.code = ErrorCode.UNAUTHORIZED;
    return error;
  });

  // Helper to create forbidden error
  fastify.decorate('createForbiddenError', (message: string = 'Forbidden') => {
    const error = new Error(message) as CustomError;
    error.statusCode = 403;
    error.code = ErrorCode.FORBIDDEN;
    return error;
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    createError: (statusCode: number, message: string, details?: ErrorDetails) => Error;
    createValidationError: (message: string, field?: string) => Error;
    createNotFoundError: (resource: string) => Error;
    createAuthError: (message?: string) => Error;
    createForbiddenError: (message?: string) => Error;
  }
}

export default fastifyPlugin(errorHandlerPlugin);

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

// Type for logging context - can contain any serializable values
type LoggingContext = Record<string, unknown>;

// Interface for error objects with optional statusCode
interface LoggingError extends Error {
  statusCode?: number;
}

const loggingPlugin: FastifyPluginAsync = async (fastify) => {
  // Request logging
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        headers: request.headers,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      },
      'Incoming request',
    );
  });

  // Response logging
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed',
    );
  });

  // Error logging
  fastify.addHook(
    'onError',
    async (request: FastifyRequest, _reply: FastifyReply, error: LoggingError) => {
      request.log.error(
        {
          method: request.method,
          url: request.url,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  statusCode: error.statusCode,
                  name: error.name,
                }
              : error, // Log the full error object if it's not an Error instance
        },
        'Request error',
      );
    },
  );

  // Custom logger methods
  fastify.decorate('logError', (message: string, error: LoggingError, context?: LoggingContext) => {
    fastify.log.error({
      message,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        statusCode: error.statusCode,
      },
      ...context,
    });
  });

  fastify.decorate('logInfo', (message: string, context?: LoggingContext) => {
    fastify.log.info({
      message,
      ...context,
    });
  });

  fastify.decorate('logWarn', (message: string, context?: LoggingContext) => {
    fastify.log.warn({
      message,
      ...context,
    });
  });

  fastify.decorate('logDebug', (message: string, context?: LoggingContext) => {
    fastify.log.debug({
      message,
      ...context,
    });
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    logError: (message: string, error: LoggingError, context?: LoggingContext) => void;
    logInfo: (message: string, context?: LoggingContext) => void;
    logWarn: (message: string, context?: LoggingContext) => void;
    logDebug: (message: string, context?: LoggingContext) => void;
  }
}

export default fastifyPlugin(loggingPlugin);

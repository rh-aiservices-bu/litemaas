import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

const loggingPlugin: FastifyPluginAsync = async (fastify) => {
  // Request logging
  fastify.addHook('onRequest', async (request, reply) => {
    request.log.info({
      method: request.method,
      url: request.url,
      headers: request.headers,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    }, 'Incoming request');
  });

  // Response logging
  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, 'Request completed');
  });

  // Error logging
  fastify.addHook('onError', async (request, reply, error) => {
    request.log.error({
      method: request.method,
      url: request.url,
      error: {
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode,
      },
    }, 'Request error');
  });

  // Custom logger methods
  fastify.decorate('logError', (message: string, error: Error, context?: Record<string, any>) => {
    fastify.log.error({
      message,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    });
  });

  fastify.decorate('logInfo', (message: string, context?: Record<string, any>) => {
    fastify.log.info({
      message,
      ...context,
    });
  });

  fastify.decorate('logWarn', (message: string, context?: Record<string, any>) => {
    fastify.log.warn({
      message,
      ...context,
    });
  });

  fastify.decorate('logDebug', (message: string, context?: Record<string, any>) => {
    fastify.log.debug({
      message,
      ...context,
    });
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    logError: (message: string, error: Error, context?: Record<string, any>) => void;
    logInfo: (message: string, context?: Record<string, any>) => void;
    logWarn: (message: string, context?: Record<string, any>) => void;
    logDebug: (message: string, context?: Record<string, any>) => void;
  }
}

export default fastifyPlugin(loggingPlugin);
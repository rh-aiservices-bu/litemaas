import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import('@fastify/rate-limit'), {
    max: parseInt(fastify.config.RATE_LIMIT_MAX),
    timeWindow: fastify.config.RATE_LIMIT_TIME_WINDOW,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise IP
      const user = (request as any).user;
      return user ? `user:${user.userId}` : request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Limit: ${context.max} per ${context.timeWindow}`,
          details: {
            limit: context.max,
            timeWindow: context.timeWindow,
            remaining: context.ttl,
          },
        },
        requestId: request.id,
      };
    },
    skipOnError: false,
    skipSuccessfulRequests: false,
  });

  // Custom rate limiting for API keys
  fastify.decorate('apiKeyRateLimit', async (request: any, reply: any) => {
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      return;
    }

    // TODO: Implement API key specific rate limiting
    // This would check subscription limits and quotas
    const keyPrefix = `api-key:${apiKey}`;
    
    // For now, just log the API key usage
    fastify.log.info({ apiKey: apiKey.substring(0, 8) + '...' }, 'API key request');
  });

  // Rate limit configuration for different endpoints
  fastify.decorate('createRateLimit', (options: {
    max: number;
    timeWindow: string;
    skipSuccessfulRequests?: boolean;
  }) => {
    return {
      config: {
        rateLimit: {
          max: options.max,
          timeWindow: options.timeWindow,
          skipSuccessfulRequests: options.skipSuccessfulRequests || false,
        },
      },
    };
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    apiKeyRateLimit: (request: any, reply: any) => Promise<void>;
    createRateLimit: (options: {
      max: number;
      timeWindow: string;
      skipSuccessfulRequests?: boolean;
    }) => any;
  }
}

export default fastifyPlugin(rateLimitPlugin);
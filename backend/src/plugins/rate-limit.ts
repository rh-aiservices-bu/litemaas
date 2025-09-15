import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { AuthenticatedRequest } from '../types/auth.types.js';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  const rateLimitMax = parseInt(fastify.config.RATE_LIMIT_MAX);
  const rateLimitTimeWindow = fastify.config.RATE_LIMIT_TIME_WINDOW;

  await fastify.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: rateLimitTimeWindow,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    keyGenerator: (request: FastifyRequest) => {
      // Use user ID if authenticated, otherwise IP
      const user = (request as AuthenticatedRequest).user;
      return user ? `user:${user.userId}` : request.ip;
    },
    errorResponseBuilder: (
      request: FastifyRequest,
      context: { ban: boolean; after: string; max: number; ttl: number },
    ) => {
      // Create a flat error response structure that @fastify/rate-limit can send directly
      // @fastify/rate-limit will automatically set this to 429 status
      return {
        code: 'RATE_LIMITED',
        message: `Too many requests. Limit: ${context.max} per ${rateLimitTimeWindow}`,
        statusCode: 429,
        details: {
          limit: context.max,
          timeWindow: rateLimitTimeWindow,
          remaining: context.ttl,
          suggestion: `Please wait ${Math.ceil(context.ttl / 1000)} seconds before trying again`,
        },
        requestId: request.id,
        timestamp: new Date().toISOString(),
      };
    },
    skipOnError: false,
  });

  // Custom rate limiting for API keys
  fastify.decorate('apiKeyRateLimit', async (request: FastifyRequest, _reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      return;
    }

    // TODO: Implement API key specific rate limiting
    // This would check subscription limits and quotas
    const keyString = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    //const _keyPrefix = `api-key:${keyString}`;

    // For now, just log the API key usage
    fastify.log.info({ apiKey: keyString.substring(0, 8) + '...' }, 'API key request');
  });

  // Rate limit configuration for different endpoints
  fastify.decorate(
    'createRateLimit',
    (options: { max: number; timeWindow: string; skipSuccessfulRequests?: boolean }) => {
      return {
        config: {
          rateLimit: {
            max: options.max,
            timeWindow: options.timeWindow,
            skipSuccessfulRequests: options.skipSuccessfulRequests || false,
          },
        },
      };
    },
  );
};

declare module 'fastify' {
  interface FastifyInstance {
    apiKeyRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    createRateLimit: (options: {
      max: number;
      timeWindow: string;
      skipSuccessfulRequests?: boolean;
    }) => {
      config: {
        rateLimit: {
          max: number;
          timeWindow: string;
          skipSuccessfulRequests: boolean;
        };
      };
    };
  }
}

export default fastifyPlugin(rateLimitPlugin);

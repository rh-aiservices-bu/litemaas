import Fastify, { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
// Load type extensions
import './types';

import {
  envPlugin,
  loggingPlugin,
  databasePlugin,
  redisPlugin,
  authPlugin,
  swaggerPlugin,
  rateLimitPlugin,
  subscriptionHooksPlugin,
} from './plugins';
import oauthPlugin from './plugins/oauth';
import sessionPlugin from './plugins/session';
import rbacPlugin from './plugins/rbac';
import errorHandlerPlugin from './middleware/error-handler';
import authHooksPlugin from './middleware/auth-hooks';
import routes from './routes';
import authRoutes from './routes/auth';
import {
  initAdminAnalyticsConfig,
  getAdminAnalyticsConfig,
  type AdminAnalyticsConfig,
} from './config/admin-analytics.config.js';

export const createApp = async (opts: { logger?: boolean } = {}): Promise<FastifyInstance> => {
  const fastify = Fastify({
    logger:
      opts.logger !== false
        ? {
            level: process.env.LOG_LEVEL || 'info',
            transport:
              process.env.NODE_ENV === 'development'
                ? {
                    target: 'pino-pretty',
                    options: {
                      colorize: true,
                    },
                  }
                : undefined,
          }
        : false,
    genReqId: (req) => {
      const requestId = req.headers['x-request-id'];
      return Array.isArray(requestId)
        ? requestId[0]
        : requestId || Math.random().toString(36).substring(2, 15);
    },
    trustProxy: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register core plugins
  await fastify.register(envPlugin);

  // Initialize admin analytics configuration early in startup
  try {
    const config = initAdminAnalyticsConfig();
    fastify.log.info({ config }, 'Admin analytics configuration loaded');
  } catch (error) {
    fastify.log.fatal({ error }, 'Failed to load admin analytics configuration');
    throw error;
  }

  // Decorate fastify instance with config getter
  fastify.decorate('getAdminAnalyticsConfig', getAdminAnalyticsConfig);

  await fastify.register(import('@fastify/sensible'));
  await fastify.register(import('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });
  await fastify.register(import('@fastify/cors'), {
    origin: fastify.config.CORS_ORIGIN,
    credentials: true,
  });

  // Register custom plugins
  await fastify.register(loggingPlugin);
  await fastify.register(errorHandlerPlugin);
  await fastify.register(databasePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);
  await fastify.register(oauthPlugin);
  await fastify.register(sessionPlugin);
  await fastify.register(rbacPlugin);
  await fastify.register(authHooksPlugin);
  await fastify.register(subscriptionHooksPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(swaggerPlugin);

  // Register routes
  // OAuth flow routes (login, callback, logout) at /api/auth - unversioned for OAuth provider compatibility
  await fastify.register(authRoutes, { prefix: '/api/auth' });

  // All versioned API routes under /api/v1 (including user profile endpoints)
  await fastify.register(routes, { prefix: '/api/v1' });

  return fastify;
};

// Type augmentation for FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    getAdminAnalyticsConfig: () => AdminAnalyticsConfig;
  }
}

export default createApp;

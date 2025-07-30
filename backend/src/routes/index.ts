import { FastifyPluginAsync } from 'fastify';

import authRoutes from './auth';
import usersRoutes from './users';
import modelsRoutes from './models';
import subscriptionsRoutes from './subscriptions';
import apiKeysRoutes from './api-keys';
import usageRoutes from './usage';
import healthRoutes from './health';
import configRoutes from './config';

const routes: FastifyPluginAsync = async (fastify) => {
  // Register all route handlers
  // Note: auth routes are registered separately at /api/auth in app.ts
  await fastify.register(usersRoutes, { prefix: '/users' });
  await fastify.register(modelsRoutes, { prefix: '/models' });
  await fastify.register(subscriptionsRoutes, { prefix: '/subscriptions' });
  await fastify.register(apiKeysRoutes, { prefix: '/api-keys' });
  await fastify.register(usageRoutes, { prefix: '/usage' });
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(configRoutes, { prefix: '/config' });

  // Root endpoint
  fastify.get('/', {
    schema: {
      tags: ['General'],
      description: 'API root endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            docs: { type: 'string' },
          },
        },
      },
    },
    handler: async (_request, _reply) => {
      return {
        name: 'LiteMaaS API',
        version: '1.0.0',
        description: 'LiteLLM Model as a Service API',
        docs: '/docs',
      };
    },
  });
};

export default routes;

import { FastifyPluginAsync } from 'fastify';
import { litellmConfig } from '../config/litellm.js';

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  // Get public configuration
  fastify.get('/', {
    schema: {
      tags: ['Configuration'],
      description: 'Get public configuration settings',
      response: {
        200: {
          type: 'object',
          properties: {
            litellmApiUrl: { type: 'string' },
            authMode: {
              type: 'string',
              enum: ['oauth', 'mock'],
              description: 'Authentication mode - oauth for production, mock for development',
            },
          },
        },
      },
    },
    handler: async (_request, _reply) => {
      const isMockEnabled =
        process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development';

      return {
        litellmApiUrl: litellmConfig.apiUrl,
        authMode: isMockEnabled ? 'mock' : 'oauth',
      };
    },
  });
};

export default configRoutes;

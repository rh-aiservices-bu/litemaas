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
          },
        },
      },
    },
    handler: async (_request, _reply) => {
      return {
        litellmApiUrl: litellmConfig.apiUrl,
      };
    },
  });
};

export default configRoutes;

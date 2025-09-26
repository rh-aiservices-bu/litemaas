import { FastifyPluginAsync } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { litellmConfig } from '../config/litellm.js';
import { ConfigResponseSchema, type ConfigResponse } from '../schemas/config';

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  // Read version from root package.json once at startup
  let appVersion = '0.0.0';
  try {
    const packageJsonPath = join(__dirname, '../../..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    appVersion = packageJson.version || '0.0.0';
  } catch (error) {
    fastify.log.warn(error, 'Failed to read version from package.json, using default');
  }

  // Get public configuration
  fastify.get<{
    Reply: ConfigResponse;
  }>('/', {
    schema: {
      tags: ['Configuration'],
      summary: 'Get public configuration',
      description:
        'Get public configuration values including app version, cache TTL, environment, and auth mode. No authentication required.',
      response: {
        200: ConfigResponseSchema,
      },
    },
    handler: async (_request, _reply) => {
      const isMockEnabled =
        process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development';

      const config: ConfigResponse = {
        version: appVersion,
        usageCacheTtlMinutes: Number(fastify.config.USAGE_CACHE_TTL_MINUTES),
        environment: fastify.config.NODE_ENV === 'production' ? 'production' : 'development',
      };

      fastify.log.debug({ config }, 'Returning public configuration');

      return {
        ...config,
        // Legacy fields for backwards compatibility
        litellmApiUrl: litellmConfig.apiUrl,
        authMode: isMockEnabled ? 'mock' : 'oauth',
      };
    },
  });
};

export default configRoutes;

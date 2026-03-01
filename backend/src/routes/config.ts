// backend/src/routes/config.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getPublicConfig } from '../config/admin-analytics.config.js';
import { litellmConfig } from '../config/litellm.js';
import { ConfigResponseSchema, type ConfigResponse } from '../schemas/config';
import { SettingsService } from '../services/settings.service';
import { ApiKeyQuotaDefaultsSchema } from '../schemas/settings';

/**
 * Configuration Routes
 *
 * Exposes safe subset of configuration to frontend
 */
export default async function configRoutes(fastify: FastifyInstance) {
  const settingsService = new SettingsService(fastify);

  // Read version from root package.json once at startup
  let appVersion = '0.0.0';
  try {
    const packageJsonPath = join(__dirname, '../../..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    appVersion = packageJson.version || '0.0.0';
  } catch (error) {
    fastify.log.warn(error, 'Failed to read version from package.json, using default');
  }

  /**
   * GET /api/v1/config
   *
   * Get public configuration
   * No authentication required - this is public configuration
   */
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

  /**
   * GET /api/v1/config/admin-analytics
   *
   * Get public admin analytics configuration
   * No authentication required - this is public configuration
   */
  fastify.get(
    '/admin-analytics',
    {
      schema: {
        description: 'Get public admin analytics configuration',
        tags: ['configuration'],
        response: {
          200: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  defaultPageSize: { type: 'number' },
                  maxPageSize: { type: 'number' },
                  minPageSize: { type: 'number' },
                },
              },
              topLimits: {
                type: 'object',
                properties: {
                  users: { type: 'number' },
                  models: { type: 'number' },
                  providers: { type: 'number' },
                },
              },
              dateRangeLimits: {
                type: 'object',
                properties: {
                  maxAnalyticsDays: { type: 'number' },
                  maxExportDays: { type: 'number' },
                },
              },
              warnings: {
                type: 'object',
                properties: {
                  largeDateRangeDays: { type: 'number' },
                },
              },
              trends: {
                type: 'object',
                properties: {
                  calculationPrecision: { type: 'number' },
                },
              },
              export: {
                type: 'object',
                properties: {
                  maxRows: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const config = fastify.getAdminAnalyticsConfig();
      const publicConfig = getPublicConfig(config);

      return reply.send(publicConfig);
    },
  );

  /**
   * GET /api/v1/config/api-key-defaults
   *
   * Get API key quota defaults and maximums
   * No authentication required - this is public configuration
   */
  fastify.get(
    '/api-key-defaults',
    {
      schema: {
        description: 'Get API key quota defaults and maximums for user key creation',
        tags: ['configuration'],
        response: {
          200: ApiKeyQuotaDefaultsSchema,
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const defaults = await settingsService.getApiKeyDefaults();
      return reply.send(defaults);
    },
  );
}

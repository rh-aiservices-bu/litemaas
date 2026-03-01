import { FastifyPluginAsync } from 'fastify';
import { AuthenticatedRequest } from '../types';
import { SettingsService } from '../services/settings.service';
import { ApiKeyQuotaDefaultsSchema, type ApiKeyQuotaDefaultsInput } from '../schemas/settings';

const adminSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  const settingsService = new SettingsService(fastify);

  // GET /admin/settings/api-key-defaults
  fastify.get('/api-key-defaults', {
    schema: {
      tags: ['Admin Settings'],
      summary: 'Get API key quota defaults and maximums',
      description: 'Get admin-configured default and maximum values for user-created API keys.',
      security: [{ bearerAuth: [] }],
      response: {
        200: ApiKeyQuotaDefaultsSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:users')],
    handler: async (request, _reply) => {
      const authRequest = request as AuthenticatedRequest;

      try {
        const defaults = await settingsService.getApiKeyDefaults();

        fastify.log.debug(
          { adminUser: authRequest.user?.userId },
          'Admin retrieved API key defaults',
        );

        return defaults;
      } catch (error) {
        fastify.log.error(
          { error, adminUser: authRequest.user?.userId },
          'Failed to get API key defaults',
        );
        throw fastify.createError(500, 'Failed to retrieve API key defaults');
      }
    },
  });

  // PUT /admin/settings/api-key-defaults
  fastify.put<{
    Body: ApiKeyQuotaDefaultsInput;
  }>('/api-key-defaults', {
    schema: {
      tags: ['Admin Settings'],
      summary: 'Update API key quota defaults and maximums',
      description: 'Set default and maximum values for user-created API keys. Admin role required.',
      security: [{ bearerAuth: [] }],
      body: ApiKeyQuotaDefaultsSchema,
      response: {
        200: ApiKeyQuotaDefaultsSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:users')],
    handler: async (request, _reply) => {
      const authRequest = request as AuthenticatedRequest;
      const settings = request.body;

      try {
        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            adminUsername: authRequest.user?.username,
            settings,
            action: 'update_api_key_defaults',
          },
          'Admin updating API key defaults',
        );

        const updated = await settingsService.updateApiKeyDefaults(
          authRequest.user.userId,
          settings,
        );

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            settings: updated,
          },
          'API key defaults updated successfully',
        );

        return updated;
      } catch (error) {
        fastify.log.error(
          { error, adminUser: authRequest.user?.userId, settings },
          'Failed to update API key defaults',
        );

        if (error instanceof Error && (error as any).statusCode === 400) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to update API key defaults');
      }
    },
  });
};

export default adminSettingsRoutes;

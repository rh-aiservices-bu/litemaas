import { FastifyPluginAsync } from 'fastify';
import { AuthenticatedRequest } from '../types';
import { SettingsService } from '../services/settings.service';
import {
  ApiKeyQuotaDefaultsSchema,
  type ApiKeyQuotaDefaultsInput,
  UserDefaultsSchema,
  UserDefaultsResponseSchema,
  type UserDefaultsInput,
} from '../schemas/settings';
import {
  CurrencySettingsSchema,
  type CurrencySettingsInput,
  SupportedCurrenciesResponseSchema,
} from '../schemas/currency';
import { SUPPORTED_CURRENCIES } from '../types/currency.types';

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
  // GET /admin/settings/user-defaults
  fastify.get('/user-defaults', {
    schema: {
      tags: ['Admin Settings'],
      summary: 'Get new user defaults',
      description:
        'Get admin-configured default values applied when users first log in, plus env var fallbacks.',
      security: [{ bearerAuth: [] }],
      response: {
        200: UserDefaultsResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:users')],
    handler: async (request, _reply) => {
      const authRequest = request as AuthenticatedRequest;

      try {
        const defaults = await settingsService.getUserDefaults();
        const envDefaults = settingsService.getEnvUserDefaults();

        fastify.log.debug({ adminUser: authRequest.user?.userId }, 'Admin retrieved user defaults');

        return { ...defaults, envDefaults };
      } catch (error) {
        fastify.log.error(
          { error, adminUser: authRequest.user?.userId },
          'Failed to get user defaults',
        );
        throw fastify.createError(500, 'Failed to retrieve user defaults');
      }
    },
  });

  // PUT /admin/settings/user-defaults
  fastify.put<{
    Body: UserDefaultsInput;
  }>('/user-defaults', {
    schema: {
      tags: ['Admin Settings'],
      summary: 'Update new user defaults',
      description: 'Set default values applied when users first log in. Admin role required.',
      security: [{ bearerAuth: [] }],
      body: UserDefaultsSchema,
      response: {
        200: UserDefaultsSchema,
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
            action: 'update_user_defaults',
          },
          'Admin updating user defaults',
        );

        const updated = await settingsService.updateUserDefaults(authRequest.user.userId, settings);

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            settings: updated,
          },
          'User defaults updated successfully',
        );

        return updated;
      } catch (error) {
        fastify.log.error(
          { error, adminUser: authRequest.user?.userId, settings },
          'Failed to update user defaults',
        );

        if (error instanceof Error && (error as any).statusCode === 400) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to update user defaults');
      }
    },
  });
  // GET /admin/settings/currency
  fastify.get('/currency', {
    schema: {
      tags: ['Admin Settings'],
      summary: 'Get currency settings',
      description: 'Get the configured currency for monetary value display.',
      security: [{ bearerAuth: [] }],
      response: {
        200: CurrencySettingsSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:users')],
    handler: async (request, _reply) => {
      const authRequest = request as AuthenticatedRequest;

      try {
        const currency = await settingsService.getCurrencySettings();

        fastify.log.debug(
          { adminUser: authRequest.user?.userId },
          'Admin retrieved currency settings',
        );

        return currency;
      } catch (error) {
        fastify.log.error(
          { error, adminUser: authRequest.user?.userId },
          'Failed to get currency settings',
        );
        throw fastify.createError(500, 'Failed to retrieve currency settings');
      }
    },
  });

  // GET /admin/settings/currency/supported
  fastify.get('/currency/supported', {
    schema: {
      tags: ['Admin Settings'],
      summary: 'Get supported currencies',
      description: 'Get list of all supported currencies.',
      security: [{ bearerAuth: [] }],
      response: {
        200: SupportedCurrenciesResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:users')],
    handler: async (request, _reply) => {
      const authRequest = request as AuthenticatedRequest;

      fastify.log.debug(
        { adminUser: authRequest.user?.userId },
        'Admin retrieved supported currencies',
      );

      return SUPPORTED_CURRENCIES;
    },
  });

  // PUT /admin/settings/currency
  fastify.put<{
    Body: CurrencySettingsInput;
  }>('/currency', {
    schema: {
      tags: ['Admin Settings'],
      summary: 'Update currency settings',
      description:
        'Update the configured currency for monetary value display. Admin role required.',
      security: [{ bearerAuth: [] }],
      body: CurrencySettingsSchema,
      response: {
        200: CurrencySettingsSchema,
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
            action: 'update_currency_settings',
          },
          'Admin updating currency settings',
        );

        const updated = await settingsService.updateCurrencySettings(
          authRequest.user.userId,
          settings,
        );

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            settings: updated,
          },
          'Currency settings updated successfully',
        );

        return updated;
      } catch (error) {
        fastify.log.error(
          { error, adminUser: authRequest.user?.userId, settings },
          'Failed to update currency settings',
        );

        if (error instanceof Error && (error as any).statusCode === 400) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to update currency settings');
      }
    },
  });
};

export default adminSettingsRoutes;

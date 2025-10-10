import { FastifyPluginAsync } from 'fastify';
import { AdminService } from '../services/admin.service';
import { AuthenticatedRequest } from '../types';
import {
  BulkUpdateUserLimitsSchema,
  BulkUpdateUserLimitsResponseSchema,
  SystemStatsResponseSchema,
  AdminErrorResponseSchema,
  type BulkUpdateUserLimitsRequest,
} from '../schemas/admin';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const adminService = new AdminService(fastify);

  // Bulk update user limits endpoint
  fastify.post('/users/bulk-update-limits', {
    schema: {
      tags: ['Admin'],
      summary: 'Bulk update user limits',
      description:
        'Update max_budget, tpm_limit, and rpm_limit for all active users. Admin role required.',
      security: [{ bearerAuth: [] }],
      body: BulkUpdateUserLimitsSchema,
      response: {
        200: BulkUpdateUserLimitsResponseSchema,
        400: AdminErrorResponseSchema,
        401: AdminErrorResponseSchema,
        403: AdminErrorResponseSchema,
        500: AdminErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:users')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const updates = request.body as BulkUpdateUserLimitsRequest;

      try {
        // Validate that at least one update is provided
        if (!updates.maxBudget && !updates.tpmLimit && !updates.rpmLimit) {
          return reply.code(400).send({
            error: 'At least one limit value must be provided',
            code: 'INVALID_INPUT',
          });
        }

        // Log the admin action for audit trail
        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            adminUsername: authRequest.user?.username,
            updates,
            action: 'bulk_update_user_limits',
          },
          'Admin initiated bulk user limits update',
        );

        const result = await adminService.bulkUpdateUserLimits(updates);

        // Log the results
        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            totalUsers: result.totalUsers,
            successCount: result.successCount,
            failedCount: result.failedCount,
            errorCount: result.errors.length,
          },
          'Bulk user limits update completed',
        );

        return result;
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            updates,
          },
          'Failed to execute bulk user limits update',
        );

        if (error instanceof Error) {
          if (error.message.includes('At least one limit value must be provided')) {
            return reply.code(400).send({
              error: error.message,
              code: 'INVALID_INPUT',
            });
          }
        }

        return reply.code(500).send({
          error: 'Internal server error while updating user limits',
          code: 'BULK_UPDATE_FAILED',
        });
      }
    },
  });

  // Get list of users (for filters)
  fastify.get('/users', {
    schema: {
      tags: ['Admin'],
      summary: 'Get list of users',
      description:
        'Get list of all users with basic information for filtering purposes. Admin or adminReadonly role required.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  username: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
            total: { type: 'number' },
          },
        },
        401: AdminErrorResponseSchema,
        403: AdminErrorResponseSchema,
        500: AdminErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        // Fetch all users with basic information
        const users = await fastify.dbUtils.queryMany(
          `SELECT id, username, email
           FROM users
           ORDER BY username ASC`,
        );

        const formattedUsers = users.map((user) => ({
          userId: String(user.id),
          username: String(user.username),
          email: String(user.email),
        }));

        fastify.log.debug(
          {
            adminUser: authRequest.user?.userId,
            userCount: formattedUsers.length,
          },
          'Admin requested user list',
        );

        return {
          users: formattedUsers,
          total: formattedUsers.length,
        };
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
          },
          'Failed to get user list',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving user list',
          code: 'USER_LIST_FAILED',
        });
      }
    },
  });

  // Get list of API keys for selected users (for filters)
  fastify.get('/api-keys', {
    schema: {
      tags: ['Admin'],
      summary: 'Get list of API keys for selected users',
      description:
        'Get API keys for specified users for filtering purposes. Returns empty if no userIds provided. Admin or adminReadonly role required.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          userIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            description: 'Array of user IDs to filter API keys by (required)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            apiKeys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  keyAlias: { type: 'string' },
                  userId: { type: 'string' },
                  username: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
            total: { type: 'number' },
          },
        },
        401: AdminErrorResponseSchema,
        403: AdminErrorResponseSchema,
        500: AdminErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { userIds } = request.query as { userIds?: string[] };

      try {
        // Return empty if no users specified (required filter)
        if (!userIds || userIds.length === 0) {
          fastify.log.debug(
            {
              adminUser: authRequest.user?.userId,
            },
            'Admin requested API keys without userIds filter - returning empty',
          );

          return {
            apiKeys: [],
            total: 0,
          };
        }

        // Fetch API keys for specified users
        const apiKeys = await fastify.dbUtils.queryMany(
          `SELECT
            ak.id,
            ak.name,
            ak.litellm_key_alias as "keyAlias",
            ak.user_id as "userId",
            u.username,
            u.email
          FROM api_keys ak
          JOIN users u ON ak.user_id = u.id
          WHERE ak.user_id = ANY($1)
          ORDER BY u.username, ak.name`,
          [userIds],
        );

        const formattedApiKeys = apiKeys.map((key) => ({
          id: String(key.id),
          name: String(key.name),
          keyAlias: String(key.keyAlias),
          userId: String(key.userId),
          username: String(key.username),
          email: String(key.email),
        }));

        fastify.log.debug(
          {
            adminUser: authRequest.user?.userId,
            userCount: userIds.length,
            apiKeyCount: formattedApiKeys.length,
          },
          'Admin requested API keys for selected users',
        );

        return {
          apiKeys: formattedApiKeys,
          total: formattedApiKeys.length,
        };
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            userIds,
          },
          'Failed to get API keys list',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving API keys',
          code: 'API_KEYS_LIST_FAILED',
        });
      }
    },
  });

  // Get system statistics endpoint
  fastify.get('/system/stats', {
    schema: {
      tags: ['Admin'],
      summary: 'Get system statistics',
      description:
        'Get overall system statistics including user counts, API key counts, and model counts. Admin role required.',
      security: [{ bearerAuth: [] }],
      response: {
        200: SystemStatsResponseSchema,
        401: AdminErrorResponseSchema,
        403: AdminErrorResponseSchema,
        500: AdminErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:system')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      try {
        const stats = await adminService.getSystemStats();

        fastify.log.debug(
          {
            adminUser: authRequest.user?.userId,
            stats,
          },
          'Admin requested system statistics',
        );

        return stats;
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
          },
          'Failed to get system statistics',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving system statistics',
          code: 'STATS_RETRIEVAL_FAILED',
        });
      }
    },
  });
};

export default adminRoutes;

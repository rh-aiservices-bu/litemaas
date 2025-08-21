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

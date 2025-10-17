import { FastifyPluginAsync } from 'fastify';
import { SubscriptionService } from '../services/subscription.service';
import { AuthenticatedRequest } from '../types';
import {
  SubscriptionApprovalQuerySchema,
  ApproveSubscriptionsSchema,
  DenySubscriptionsSchema,
  RevertSubscriptionSchema,
  SubscriptionIdParamSchema,
  SubscriptionRequestsResponseSchema,
  SubscriptionApprovalStatsSchema,
  BulkOperationResultSchema,
  SubscriptionWithDetailsSchema,
} from '../schemas/admin-subscriptions';
import { ErrorResponseSchema } from '../schemas/common';
import { ApplicationError } from '../utils/errors';

const adminSubscriptionsRoutes: FastifyPluginAsync = async (fastify) => {
  const subscriptionService = new SubscriptionService(fastify);

  // Get subscription requests (with filters)
  fastify.get('/', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Get subscription approval requests',
      description:
        'Retrieve subscription requests with optional filtering by status, model, user, and date range',
      security: [{ bearerAuth: [] }],
      querystring: SubscriptionApprovalQuerySchema,
      response: {
        200: SubscriptionRequestsResponseSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:read')],
    handler: async (request, _reply) => {
      try {
        const {
          statuses,
          modelIds,
          userIds,
          dateFrom,
          dateTo,
          page = 1,
          limit = 20,
        } = request.query as any;

        // Parse string arrays from query params
        const filters = {
          statuses: statuses ? (Array.isArray(statuses) ? statuses : [statuses]) : undefined,
          modelIds: modelIds ? (Array.isArray(modelIds) ? modelIds : [modelIds]) : undefined,
          userIds: userIds ? (Array.isArray(userIds) ? userIds : [userIds]) : undefined,
          dateFrom: dateFrom ? new Date(dateFrom) : undefined,
          dateTo: dateTo ? new Date(dateTo) : undefined,
        };

        const result = await subscriptionService.getSubscriptionApprovalRequests(filters, {
          page,
          limit,
        });

        return result;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get subscription requests');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get subscription requests: ${errorMessage}`);
      }
    },
  });

  // Get approval statistics
  fastify.get('/stats', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Get subscription approval statistics',
      description: 'Retrieve statistics about pending, approved, and denied subscriptions',
      security: [{ bearerAuth: [] }],
      response: {
        200: SubscriptionApprovalStatsSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:read')],
    handler: async (_request, _reply) => {
      try {
        const stats = await subscriptionService.getSubscriptionApprovalStats();
        return stats;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get subscription statistics');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get subscription statistics: ${errorMessage}`);
      }
    },
  });

  // Bulk approve
  fastify.post('/approve', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Approve subscriptions (bulk)',
      description: 'Approve one or more pending subscriptions with optional comment',
      security: [{ bearerAuth: [] }],
      body: ApproveSubscriptionsSchema,
      response: {
        200: BulkOperationResultSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:write')],
    handler: async (request, _reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const { subscriptionIds, reason } = request.body as any;

        const result = await subscriptionService.approveSubscriptions(
          subscriptionIds,
          authRequest.user.userId,
          reason,
        );

        return result;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to approve subscriptions');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to approve subscriptions: ${errorMessage}`);
      }
    },
  });

  // Bulk deny
  fastify.post('/deny', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Deny subscriptions (bulk)',
      description: 'Deny one or more subscriptions with required reason',
      security: [{ bearerAuth: [] }],
      body: DenySubscriptionsSchema,
      response: {
        200: BulkOperationResultSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:write')],
    handler: async (request, _reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const { subscriptionIds, reason } = request.body as any;

        const result = await subscriptionService.denySubscriptions(
          subscriptionIds,
          authRequest.user.userId,
          reason,
        );

        return result;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to deny subscriptions');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to deny subscriptions: ${errorMessage}`);
      }
    },
  });

  // Revert subscription status
  fastify.post('/:id/revert', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Revert subscription status decision',
      description: 'Change subscription status directly (admin override)',
      security: [{ bearerAuth: [] }],
      params: SubscriptionIdParamSchema,
      body: RevertSubscriptionSchema,
      response: {
        200: SubscriptionWithDetailsSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:write')],
    handler: async (request, _reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const { id } = request.params as any;
        const { newStatus, reason } = request.body as any;

        const result = await subscriptionService.revertSubscription(
          id,
          newStatus,
          authRequest.user.userId,
          reason,
        );

        return result;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to revert subscription status');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to revert subscription status: ${errorMessage}`);
      }
    },
  });

  // Delete subscription permanently
  fastify.delete<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/:id', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Delete subscription permanently',
      description:
        'Permanently delete a subscription and clean up associated API keys. This action cannot be undone.',
      security: [{ bearerAuth: [] }],
      params: SubscriptionIdParamSchema,
      body: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Optional reason for deletion (saved in audit log)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:delete')],
    handler: async (request, _reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const { id } = request.params;
        const { reason } = (request.body as any) || {};

        const result = await subscriptionService.deleteSubscription(
          id,
          authRequest.user.userId,
          reason,
        );

        return result;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete subscription');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to delete subscription: ${errorMessage}`);
      }
    },
  });
};

export default adminSubscriptionsRoutes;

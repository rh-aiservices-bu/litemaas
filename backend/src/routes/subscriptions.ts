import { FastifyPluginAsync, FastifyError } from 'fastify';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionDetails,
  SubscriptionListParams,
  PaginatedResponse,
  AuthenticatedRequest,
} from '../types';
import { SubscriptionService } from '../services/subscription.service';

const subscriptionsRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize subscription service
  const subscriptionService = new SubscriptionService(fastify);

  // List user subscriptions
  fastify.get<{
    Querystring: SubscriptionListParams;
    Reply: PaginatedResponse<SubscriptionDetails>;
  }>('/', {
    schema: {
      tags: ['Subscriptions'],
      description: 'List user subscriptions',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: ['active', 'suspended', 'cancelled', 'expired'] },
          modelId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  modelId: { type: 'string' },
                  modelName: { type: 'string' },
                  provider: { type: 'string' },
                  status: { type: 'string' },
                  quotaRequests: { type: 'number' },
                  quotaTokens: { type: 'number' },
                  usedRequests: { type: 'number' },
                  usedTokens: { type: 'number' },
                  remainingRequests: { type: 'number' },
                  remainingTokens: { type: 'number' },
                  utilizationPercent: {
                    type: 'object',
                    properties: {
                      requests: { type: 'number' },
                      tokens: { type: 'number' },
                    },
                  },
                  pricing: {
                    type: 'object',
                    properties: {
                      inputCostPerToken: { type: 'number' },
                      outputCostPerToken: { type: 'number' },
                    },
                  },
                  resetAt: { type: 'string', format: 'date-time' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  metadata: { type: 'object' },
                  modelDescription: { type: 'string' },
                  modelContextLength: { type: 'number' },
                  modelSupportsVision: { type: 'boolean' },
                  modelSupportsFunctionCalling: { type: 'boolean' },
                  modelSupportsParallelFunctionCalling: { type: 'boolean' },
                  modelSupportsToolChoice: { type: 'boolean' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { page = 1, limit = 20, status, modelId } = request.query;

      try {
        const result = await subscriptionService.getUserSubscriptions(user.userId, {
          status,
          modelId,
          page,
          limit,
        });
        const totalPages = Math.ceil(result.total / limit);
        return {
          data: result.data as SubscriptionDetails[],
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to list subscriptions');
        throw fastify.createError(500, 'Failed to list subscriptions');
      }
    },
  });

  // Get subscription by ID
  fastify.get<{
    Params: { id: string };
    Reply: SubscriptionDetails;
  }>('/:id', {
    schema: {
      tags: ['Subscriptions'],
      description: 'Get subscription by ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            modelId: { type: 'string' },
            modelName: { type: 'string' },
            provider: { type: 'string' },
            status: { type: 'string' },
            quotaRequests: { type: 'number' },
            quotaTokens: { type: 'number' },
            usedRequests: { type: 'number' },
            usedTokens: { type: 'number' },
            remainingRequests: { type: 'number' },
            remainingTokens: { type: 'number' },
            utilizationPercent: {
              type: 'object',
              properties: {
                requests: { type: 'number' },
                tokens: { type: 'number' },
              },
            },
            resetAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            metadata: { type: 'object' },
            modelDescription: { type: 'string' },
            modelContextLength: { type: 'number' },
            modelSupportsVision: { type: 'boolean' },
            modelSupportsFunctionCalling: { type: 'boolean' },
            modelSupportsParallelFunctionCalling: { type: 'boolean' },
            modelSupportsToolChoice: { type: 'boolean' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        const subscription = await subscriptionService.getSubscription(id, user.userId);

        if (!subscription) {
          throw fastify.createNotFoundError('Subscription');
        }

        return subscription as SubscriptionDetails;
      } catch (error) {
        fastify.log.error(error, 'Failed to get subscription');

        if ((error as FastifyError).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to get subscription');
      }
    },
  });

  // Create subscription
  fastify.post<{
    Body: CreateSubscriptionDto;
    Reply: SubscriptionDetails;
  }>('/', {
    schema: {
      tags: ['Subscriptions'],
      description: 'Create new subscription',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          modelId: { type: 'string' },
          quotaRequests: { type: 'number', minimum: 1, default: 10000 },
          quotaTokens: { type: 'number', minimum: 1, default: 1000000 },
          expiresAt: { type: 'string', format: 'date-time' },
          metadata: { type: 'object' },
        },
        required: ['modelId'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            modelId: { type: 'string' },
            modelName: { type: 'string' },
            provider: { type: 'string' },
            status: { type: 'string' },
            quotaRequests: { type: 'number' },
            quotaTokens: { type: 'number' },
            usedRequests: { type: 'number' },
            usedTokens: { type: 'number' },
            remainingRequests: { type: 'number' },
            remainingTokens: { type: 'number' },
            utilizationPercent: {
              type: 'object',
              properties: {
                requests: { type: 'number' },
                tokens: { type: 'number' },
              },
            },
            resetAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            metadata: { type: 'object' },
            modelDescription: { type: 'string' },
            modelContextLength: { type: 'number' },
            modelSupportsVision: { type: 'boolean' },
            modelSupportsFunctionCalling: { type: 'boolean' },
            modelSupportsParallelFunctionCalling: { type: 'boolean' },
            modelSupportsToolChoice: { type: 'boolean' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { modelId, quotaRequests, quotaTokens, expiresAt, metadata } = request.body;

      try {
        // Validate subscription data
        const validation = await subscriptionService.validateSubscription({
          modelId,
          quotaRequests,
          quotaTokens,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          metadata,
        });

        if (!validation.isValid) {
          throw fastify.createValidationError(validation.errors.join(', '));
        }

        // Create subscription
        const subscription = await subscriptionService.createSubscription(user.userId, {
          modelId,
          quotaRequests,
          quotaTokens,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          metadata,
        });

        reply.status(201);
        return subscription as SubscriptionDetails;
      } catch (error) {
        fastify.log.error(error, 'Failed to create subscription');

        if ((error as FastifyError).statusCode) {
          throw error;
        }

        // Handle unique constraint violations
        if (
          (error as Error & { code?: string }).code === '23505' ||
          (error as Error).message?.includes('unique constraint')
        ) {
          throw fastify.createError(409, 'A subscription for this model already exists');
        }

        throw fastify.createError(500, 'Failed to create subscription');
      }
    },
  });

  // Update subscription
  fastify.patch<{
    Params: { id: string };
    Body: UpdateSubscriptionDto;
    Reply: SubscriptionDetails;
  }>('/:id', {
    schema: {
      tags: ['Subscriptions'],
      description: 'Update subscription',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'suspended', 'cancelled'] },
          quotaRequests: { type: 'number', minimum: 1 },
          quotaTokens: { type: 'number', minimum: 1 },
          expiresAt: { type: 'string', format: 'date-time' },
          metadata: { type: 'object' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            modelId: { type: 'string' },
            modelName: { type: 'string' },
            provider: { type: 'string' },
            status: { type: 'string' },
            quotaRequests: { type: 'number' },
            quotaTokens: { type: 'number' },
            usedRequests: { type: 'number' },
            usedTokens: { type: 'number' },
            remainingRequests: { type: 'number' },
            remainingTokens: { type: 'number' },
            utilizationPercent: {
              type: 'object',
              properties: {
                requests: { type: 'number' },
                tokens: { type: 'number' },
              },
            },
            resetAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            metadata: { type: 'object' },
            modelDescription: { type: 'string' },
            modelContextLength: { type: 'number' },
            modelSupportsVision: { type: 'boolean' },
            modelSupportsFunctionCalling: { type: 'boolean' },
            modelSupportsParallelFunctionCalling: { type: 'boolean' },
            modelSupportsToolChoice: { type: 'boolean' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;
      const { status, quotaRequests, quotaTokens, expiresAt, metadata } = request.body;

      try {
        const subscription = await subscriptionService.updateSubscription(id, user.userId, {
          status,
          quotaRequests,
          quotaTokens,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          metadata,
        });

        return subscription as SubscriptionDetails;
      } catch (error) {
        fastify.log.error(error, 'Failed to update subscription');

        if ((error as FastifyError).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to update subscription');
      }
    },
  });

  // Cancel subscription
  fastify.post<{
    Params: { id: string };
    Reply: SubscriptionDetails;
  }>('/:id/cancel', {
    schema: {
      tags: ['Subscriptions'],
      description: 'Cancel subscription',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        const subscription = await subscriptionService.cancelSubscription(id, user.userId);
        return subscription as SubscriptionDetails;
      } catch (error) {
        fastify.log.error(error, 'Failed to cancel subscription');

        if ((error as FastifyError).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to cancel subscription');
      }
    },
  });

  // Get subscription quota
  fastify.get<{
    Params: { id: string };
    Reply: {
      requests: {
        limit: number;
        used: number;
        remaining: number;
        resetAt?: string;
      };
      tokens: {
        limit: number;
        used: number;
        remaining: number;
        resetAt?: string;
      };
    };
  }>('/:id/quota', {
    schema: {
      tags: ['Subscriptions'],
      description: 'Get subscription quota information',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            requests: {
              type: 'object',
              properties: {
                limit: { type: 'number' },
                used: { type: 'number' },
                remaining: { type: 'number' },
                resetAt: { type: 'string', format: 'date-time' },
              },
            },
            tokens: {
              type: 'object',
              properties: {
                limit: { type: 'number' },
                used: { type: 'number' },
                remaining: { type: 'number' },
                resetAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        const quota = await subscriptionService.getSubscriptionQuota(id, user.userId);

        return {
          requests: {
            limit: quota.requests.limit,
            used: quota.requests.used,
            remaining: quota.requests.remaining,
            resetAt: quota.requests.resetAt?.toISOString(),
          },
          tokens: {
            limit: quota.tokens.limit,
            used: quota.tokens.used,
            remaining: quota.tokens.remaining,
            resetAt: quota.tokens.resetAt?.toISOString(),
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get subscription quota');

        if ((error as FastifyError).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to get subscription quota');
      }
    },
  });

  // Get subscription statistics
  fastify.get('/stats', {
    schema: {
      tags: ['Subscriptions'],
      description: 'Get user subscription statistics',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            byStatus: {
              type: 'object',
              additionalProperties: { type: 'number' },
            },
            byProvider: {
              type: 'object',
              additionalProperties: { type: 'number' },
            },
            totalQuotaUsage: {
              type: 'object',
              properties: {
                requests: {
                  type: 'object',
                  properties: {
                    used: { type: 'number' },
                    limit: { type: 'number' },
                  },
                },
                tokens: {
                  type: 'object',
                  properties: {
                    used: { type: 'number' },
                    limit: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        const stats = await subscriptionService.getSubscriptionStats(user.userId);
        return stats;
      } catch (error) {
        fastify.log.error(error, 'Failed to get subscription statistics');
        throw fastify.createError(500, 'Failed to get subscription statistics');
      }
    },
  });

  // Admin endpoints

  // List all subscriptions (admin only)
  fastify.get('/admin/all', {
    schema: {
      tags: ['Subscriptions'],
      description: 'List all subscriptions (admin only)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string' },
          userId: { type: 'string' },
          modelId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            pagination: { type: 'object' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('subscriptions:read')],
    handler: async (_request, _reply) => {
      // This would be implemented for admin use
      throw fastify.createError(501, 'Admin endpoint not implemented yet');
    },
  });

  // Reset quotas (admin only)
  fastify.post('/admin/reset-quotas', {
    schema: {
      tags: ['Subscriptions'],
      description: 'Reset all quotas (admin only)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            resetCount: { type: 'number' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('subscriptions:write')],
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { userId } = request.body as { userId?: string };

      try {
        const resetCount = await subscriptionService.resetQuotas(userId);

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
           VALUES ($1, $2, $3, $4)`,
          [
            user.userId,
            'QUOTAS_RESET',
            'SUBSCRIPTION',
            JSON.stringify({ targetUserId: userId, resetCount }),
          ],
        );

        return {
          message: 'Quotas reset successfully',
          resetCount,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to reset quotas');
        throw fastify.createError(500, 'Failed to reset quotas');
      }
    },
  });
};

export default subscriptionsRoutes;

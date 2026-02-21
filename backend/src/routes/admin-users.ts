import { FastifyPluginAsync } from 'fastify';
import { AuthenticatedRequest, QueryParameter } from '../types';
import { ApiKeyService } from '../services/api-key.service';
import { LiteLLMService } from '../services/litellm.service';
import {
  UserIdParamSchema,
  UserApiKeyIdParamSchema,
  AdminUserDetailsSchema,
  UpdateUserBudgetLimitsSchema,
  UserApiKeysResponseSchema,
  CreateApiKeyForUserSchema,
  CreatedApiKeySchema,
  UpdateApiKeyModelsSchema,
  UserSubscriptionsResponseSchema,
  UserBudgetUpdatedSchema,
  AdminUserApiKeysQuerySchema,
  AdminUserSubscriptionsQuerySchema,
} from '../schemas/admin-users';
import { ErrorResponseSchema } from '../schemas/common';
import { ApplicationError } from '../utils/errors';

interface AdminUserApiKeysQuery {
  page?: number;
  limit?: number;
  isActive?: boolean;
}

interface AdminUserSubscriptionsQuery {
  page?: number;
  limit?: number;
  status?: string;
}

interface AutoSubscriptionResult {
  created: Array<{ modelId: string; subscriptionId: string }>;
  activated: Array<{ modelId: string; subscriptionId: string; previousStatus: string }>;
  alreadyActive: string[];
}

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  const liteLLMService = new LiteLLMService(fastify);
  const apiKeyService = new ApiKeyService(fastify, liteLLMService);

  /**
   * Ensures the user has active subscriptions for all specified models.
   * Auto-creates or reactivates subscriptions as needed (admin override).
   */
  async function ensureActiveSubscriptions(
    userId: string,
    modelIds: string[],
    adminUserId: string,
  ): Promise<AutoSubscriptionResult> {
    const result: AutoSubscriptionResult = {
      created: [],
      activated: [],
      alreadyActive: [],
    };

    // Validate all model IDs exist in the models table
    const existingModels = await fastify.dbUtils.queryMany(
      `SELECT id FROM models WHERE id = ANY($1::text[])`,
      [`{${modelIds.join(',')}}`],
    );
    const existingModelIds = new Set(existingModels.map((m) => String(m.id)));
    const invalidModelIds = modelIds.filter((id) => !existingModelIds.has(id));

    if (invalidModelIds.length > 0) {
      throw fastify.createError(
        400,
        `The following model IDs do not exist: ${invalidModelIds.join(', ')}`,
      );
    }

    // Get existing subscriptions for user/model combinations
    const existingSubs = await fastify.dbUtils.queryMany<{
      id: string;
      model_id: string;
      status: string;
    }>(
      `SELECT id, model_id, status FROM subscriptions
       WHERE user_id = $1 AND model_id = ANY($2::text[])`,
      [userId, `{${modelIds.join(',')}}`],
    );
    const subsByModel = new Map(existingSubs.map((s) => [s.model_id, s]));

    for (const modelId of modelIds) {
      const existing = subsByModel.get(modelId);

      if (!existing) {
        // No subscription — create new one with active status
        const newSub = await fastify.dbUtils.queryOne<{ id: string }>(
          `INSERT INTO subscriptions (user_id, model_id, status, status_reason, status_changed_by, status_changed_at, created_at, updated_at)
           VALUES ($1, $2, 'active', 'Auto-created by admin during API key assignment', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [userId, modelId, adminUserId],
        );

        if (newSub) {
          // Record in status history
          await fastify.dbUtils.query(
            `INSERT INTO subscription_status_history (subscription_id, old_status, new_status, reason, changed_by, changed_at)
             VALUES ($1, NULL, 'active', 'Auto-created by admin during API key assignment', $2, CURRENT_TIMESTAMP)`,
            [newSub.id, adminUserId],
          );

          // Audit log
          await fastify.dbUtils.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              adminUserId,
              'ADMIN_AUTO_CREATE_SUBSCRIPTION',
              'SUBSCRIPTION',
              newSub.id,
              JSON.stringify({ targetUserId: userId, modelId }),
            ],
          );

          result.created.push({ modelId, subscriptionId: String(newSub.id) });
        }
      } else if (String(existing.status) !== 'active') {
        // Subscription exists but not active — reactivate
        const previousStatus = String(existing.status);
        await fastify.dbUtils.query(
          `UPDATE subscriptions
           SET status = 'active', status_reason = 'Reactivated by admin during API key assignment',
               status_changed_by = $1, status_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [adminUserId, existing.id],
        );

        // Record in status history
        await fastify.dbUtils.query(
          `INSERT INTO subscription_status_history (subscription_id, old_status, new_status, reason, changed_by, changed_at)
           VALUES ($1, $2, 'active', 'Reactivated by admin during API key assignment', $3, CURRENT_TIMESTAMP)`,
          [existing.id, previousStatus, adminUserId],
        );

        // Audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            adminUserId,
            'ADMIN_AUTO_ACTIVATE_SUBSCRIPTION',
            'SUBSCRIPTION',
            existing.id,
            JSON.stringify({ targetUserId: userId, modelId, previousStatus }),
          ],
        );

        result.activated.push({
          modelId,
          subscriptionId: String(existing.id),
          previousStatus,
        });
      } else {
        // Already active — no-op
        result.alreadyActive.push(modelId);
      }
    }

    if (result.created.length > 0 || result.activated.length > 0) {
      fastify.log.info(
        {
          adminUserId,
          targetUserId: userId,
          created: result.created.length,
          activated: result.activated.length,
          alreadyActive: result.alreadyActive.length,
        },
        'Auto-ensured active subscriptions for admin API key operation',
      );
    }

    return result;
  }

  // GET /:id - Get detailed user information
  fastify.get('/:id', {
    schema: {
      tags: ['Admin - Users'],
      summary: 'Get detailed user information',
      description:
        'Retrieve detailed user information including budget, limits, subscription and API key counts',
      security: [{ bearerAuth: [] }],
      params: UserIdParamSchema,
      response: {
        200: AdminUserDetailsSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:read')],
    handler: async (request, _reply) => {
      try {
        const { id } = request.params as { id: string };

        // Get user with budget info
        const user = await fastify.dbUtils.queryOne(
          `SELECT id, username, email, full_name, roles, is_active,
                  max_budget, tpm_limit, rpm_limit, sync_status,
                  last_login_at, created_at
           FROM users WHERE id = $1`,
          [id],
        );

        if (!user) {
          throw fastify.createNotFoundError('User');
        }

        // Get subscription counts
        const subStats = await fastify.dbUtils.queryOne(
          `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'active') as active
           FROM subscriptions WHERE user_id = $1`,
          [id],
        );

        // Get API key counts
        const keyStats = await fastify.dbUtils.queryOne(
          `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE is_active = true) as active
           FROM api_keys WHERE user_id = $1`,
          [id],
        );

        // Get current spend from LiteLLM if available
        // For now, we'll use local data - in production this would query LiteLLM
        const currentSpend = user.current_spend || 0;

        return {
          id: String(user.id),
          username: String(user.username),
          email: String(user.email),
          fullName: user.full_name ? String(user.full_name) : undefined,
          roles: user.roles as string[],
          isActive: Boolean(user.is_active),
          maxBudget: user.max_budget !== null ? Number(user.max_budget) : undefined,
          currentSpend: currentSpend !== null ? Number(currentSpend) : undefined,
          tpmLimit: user.tpm_limit !== null ? Number(user.tpm_limit) : undefined,
          rpmLimit: user.rpm_limit !== null ? Number(user.rpm_limit) : undefined,
          syncStatus: user.sync_status ? String(user.sync_status) : undefined,
          lastLoginAt: user.last_login_at ? String(user.last_login_at) : undefined,
          createdAt: String(user.created_at),
          subscriptionsCount: parseInt(String(subStats?.total || 0)),
          activeSubscriptionsCount: parseInt(String(subStats?.active || 0)),
          apiKeysCount: parseInt(String(keyStats?.total || 0)),
          activeApiKeysCount: parseInt(String(keyStats?.active || 0)),
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get user details');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get user details: ${errorMessage}`);
      }
    },
  });

  // PATCH /:id/budget-limits - Update user budget and limits
  fastify.patch('/:id/budget-limits', {
    schema: {
      tags: ['Admin - Users'],
      summary: 'Update user budget and rate limits',
      description: 'Update maxBudget, tpmLimit, and rpmLimit for a user',
      security: [{ bearerAuth: [] }],
      params: UserIdParamSchema,
      body: UpdateUserBudgetLimitsSchema,
      response: {
        200: UserBudgetUpdatedSchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:write')],
    handler: async (request, _reply) => {
      try {
        const { id } = request.params as { id: string };
        const { maxBudget, tpmLimit, rpmLimit } = request.body as {
          maxBudget?: number;
          tpmLimit?: number;
          rpmLimit?: number;
        };
        const currentUser = (request as AuthenticatedRequest).user;

        // Check if user exists
        const existingUser = await fastify.dbUtils.queryOne('SELECT id FROM users WHERE id = $1', [
          id,
        ]);

        if (!existingUser) {
          throw fastify.createNotFoundError('User');
        }

        // Update budget and limits
        const updatedUser = await fastify.dbUtils.queryOne(
          `UPDATE users SET
           max_budget = COALESCE($1, max_budget),
           tpm_limit = COALESCE($2, tpm_limit),
           rpm_limit = COALESCE($3, rpm_limit),
           updated_at = NOW()
           WHERE id = $4
           RETURNING id, max_budget, tpm_limit, rpm_limit, updated_at`,
          [
            maxBudget !== undefined ? maxBudget : null,
            tpmLimit !== undefined ? tpmLimit : null,
            rpmLimit !== undefined ? rpmLimit : null,
            id,
          ],
        );

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            currentUser.userId,
            'USER_BUDGET_UPDATE',
            'USER',
            id,
            JSON.stringify({ changes: { maxBudget, tpmLimit, rpmLimit } }),
          ],
        );

        fastify.log.info(
          { adminUserId: currentUser.userId, targetUserId: id, maxBudget, tpmLimit, rpmLimit },
          'User budget and limits updated',
        );

        return {
          id: String(updatedUser?.id),
          maxBudget: updatedUser?.max_budget !== null ? Number(updatedUser?.max_budget) : undefined,
          tpmLimit: updatedUser?.tpm_limit !== null ? Number(updatedUser?.tpm_limit) : undefined,
          rpmLimit: updatedUser?.rpm_limit !== null ? Number(updatedUser?.rpm_limit) : undefined,
          updatedAt: String(updatedUser?.updated_at),
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update user budget');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to update user budget: ${errorMessage}`);
      }
    },
  });

  // GET /:id/api-keys - Get user's API keys
  fastify.get('/:id/api-keys', {
    schema: {
      tags: ['Admin - Users'],
      summary: "Get user's API keys",
      description: 'Retrieve all API keys for a specific user with optional filtering',
      security: [{ bearerAuth: [] }],
      params: UserIdParamSchema,
      querystring: AdminUserApiKeysQuerySchema,
      response: {
        200: UserApiKeysResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:read')],
    handler: async (request, _reply) => {
      try {
        const { id } = request.params as { id: string };
        const { page = 1, limit = 20, isActive } = request.query as AdminUserApiKeysQuery;

        // Check if user exists
        const user = await fastify.dbUtils.queryOne('SELECT id FROM users WHERE id = $1', [id]);

        if (!user) {
          throw fastify.createNotFoundError('User');
        }

        // Get API keys using the service
        const result = await apiKeyService.getUserApiKeys(id, { page, limit, isActive });

        return {
          data: result.data.map((key) => ({
            id: key.id,
            name: key.name,
            keyPrefix: key.keyPrefix,
            models: key.models || [],
            modelDetails: key.modelDetails,
            isActive: key.isActive,
            maxBudget: key.maxBudget,
            currentSpend: key.currentSpend,
            lastUsedAt: key.lastUsedAt ? String(key.lastUsedAt) : undefined,
            createdAt: String(key.createdAt),
            expiresAt: key.expiresAt ? String(key.expiresAt) : undefined,
            revokedAt: key.revokedAt ? String(key.revokedAt) : undefined,
          })),
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get user API keys');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get user API keys: ${errorMessage}`);
      }
    },
  });

  // POST /:id/api-keys - Create API key for user
  fastify.post('/:id/api-keys', {
    schema: {
      tags: ['Admin - Users'],
      summary: 'Create API key for user',
      description: 'Create a new API key for a specific user (admin action)',
      security: [{ bearerAuth: [] }],
      params: UserIdParamSchema,
      body: CreateApiKeyForUserSchema,
      response: {
        201: CreatedApiKeySchema,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:write')],
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as {
          name: string;
          modelIds: string[];
          expiresAt?: string;
          maxBudget?: number;
          tpmLimit?: number;
          rpmLimit?: number;
          budgetDuration?: string;
          softBudget?: number;
        };
        const currentUser = (request as AuthenticatedRequest).user;

        // Check if user exists
        const user = await fastify.dbUtils.queryOne(
          'SELECT id, username FROM users WHERE id = $1',
          [id],
        );

        if (!user) {
          throw fastify.createNotFoundError('User');
        }

        // Auto-create/activate subscriptions for requested models
        const subscriptionResult = await ensureActiveSubscriptions(
          id,
          body.modelIds,
          currentUser.userId,
        );

        // Create API key using the service
        const createdKey = await apiKeyService.createApiKey(id, {
          name: body.name,
          modelIds: body.modelIds,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
          maxBudget: body.maxBudget,
          tpmLimit: body.tpmLimit,
          rpmLimit: body.rpmLimit,
          budgetDuration: body.budgetDuration,
          softBudget: body.softBudget,
        });

        // Additional audit log for admin action
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            currentUser.userId,
            'ADMIN_CREATE_API_KEY',
            'API_KEY',
            createdKey.id,
            JSON.stringify({
              targetUserId: id,
              targetUsername: user.username,
              keyName: body.name,
              models: body.modelIds,
              autoCreatedSubscriptions: subscriptionResult,
            }),
          ],
        );

        fastify.log.info(
          {
            adminUserId: currentUser.userId,
            targetUserId: id,
            apiKeyId: createdKey.id,
          },
          'Admin created API key for user',
        );

        reply.code(201);
        return {
          id: createdKey.id,
          name: createdKey.name,
          key: createdKey.key,
          keyPrefix: createdKey.keyPrefix,
          models: createdKey.models || [],
          isActive: createdKey.isActive,
          createdAt: String(createdKey.createdAt),
          expiresAt: createdKey.expiresAt ? String(createdKey.expiresAt) : undefined,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create API key for user');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to create API key: ${errorMessage}`);
      }
    },
  });

  // DELETE /:id/api-keys/:keyId - Revoke user's API key
  fastify.delete('/:id/api-keys/:keyId', {
    schema: {
      tags: ['Admin - Users'],
      summary: "Revoke user's API key",
      description: 'Revoke (deactivate) an API key for a specific user',
      security: [{ bearerAuth: [] }],
      params: UserApiKeyIdParamSchema,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:write')],
    handler: async (request, _reply) => {
      try {
        const { id, keyId } = request.params as { id: string; keyId: string };
        const { reason } = (request.body as { reason?: string }) || {};
        const currentUser = (request as AuthenticatedRequest).user;

        // Verify the API key belongs to this user
        const apiKey = await fastify.dbUtils.queryOne(
          'SELECT id, name, user_id FROM api_keys WHERE id = $1 AND user_id = $2',
          [keyId, id],
        );

        if (!apiKey) {
          throw fastify.createNotFoundError('API Key');
        }

        // Delete/revoke the API key using the service
        await apiKeyService.deleteApiKey(keyId, id);

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            currentUser.userId,
            'ADMIN_REVOKE_API_KEY',
            'API_KEY',
            keyId,
            JSON.stringify({
              targetUserId: id,
              keyName: apiKey.name,
              reason: reason || 'Revoked by admin',
            }),
          ],
        );

        fastify.log.info(
          { adminUserId: currentUser.userId, targetUserId: id, apiKeyId: keyId, reason },
          'Admin revoked API key',
        );

        return { success: true };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to revoke API key');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to revoke API key: ${errorMessage}`);
      }
    },
  });

  // PATCH /:id/api-keys/:keyId - Update API key models
  fastify.patch('/:id/api-keys/:keyId', {
    schema: {
      tags: ['Admin - Users'],
      summary: 'Update API key models',
      description: 'Update the models associated with an API key',
      security: [{ bearerAuth: [] }],
      params: UserApiKeyIdParamSchema,
      body: UpdateApiKeyModelsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            models: { type: 'array', items: { type: 'string' } },
            updatedAt: { type: 'string' },
          },
        },
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:write')],
    handler: async (request, _reply) => {
      try {
        const { id, keyId } = request.params as { id: string; keyId: string };
        const { modelIds, name } = request.body as { modelIds?: string[]; name?: string };
        const currentUser = (request as AuthenticatedRequest).user;

        // Verify the API key belongs to this user
        const apiKey = await fastify.dbUtils.queryOne(
          'SELECT id, name, user_id FROM api_keys WHERE id = $1 AND user_id = $2',
          [keyId, id],
        );

        if (!apiKey) {
          throw fastify.createNotFoundError('API Key');
        }

        // Auto-create/activate subscriptions for requested models
        let subscriptionResult: AutoSubscriptionResult | undefined;
        if (modelIds && modelIds.length > 0) {
          subscriptionResult = await ensureActiveSubscriptions(id, modelIds, currentUser.userId);
        }

        // Update using the service
        const updatedKey = await apiKeyService.updateApiKey(keyId, id, { modelIds, name });

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            currentUser.userId,
            'ADMIN_UPDATE_API_KEY',
            'API_KEY',
            keyId,
            JSON.stringify({
              targetUserId: id,
              changes: { modelIds, name },
              ...(subscriptionResult && { autoCreatedSubscriptions: subscriptionResult }),
            }),
          ],
        );

        fastify.log.info(
          { adminUserId: currentUser.userId, targetUserId: id, apiKeyId: keyId, modelIds, name },
          'Admin updated API key',
        );

        return {
          id: updatedKey.id,
          name: updatedKey.name,
          models: updatedKey.models || [],
          updatedAt: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update API key');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to update API key: ${errorMessage}`);
      }
    },
  });

  // GET /:id/subscriptions - Get user's subscriptions
  fastify.get('/:id/subscriptions', {
    schema: {
      tags: ['Admin - Users'],
      summary: "Get user's subscriptions",
      description: 'Retrieve all subscriptions for a specific user',
      security: [{ bearerAuth: [] }],
      params: UserIdParamSchema,
      querystring: AdminUserSubscriptionsQuerySchema,
      response: {
        200: UserSubscriptionsResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:read')],
    handler: async (request, _reply) => {
      try {
        const { id } = request.params as { id: string };
        const { page = 1, limit = 20, status } = request.query as AdminUserSubscriptionsQuery;
        const offset = (page - 1) * limit;

        // Check if user exists
        const user = await fastify.dbUtils.queryOne('SELECT id FROM users WHERE id = $1', [id]);

        if (!user) {
          throw fastify.createNotFoundError('User');
        }

        // Build query
        let query = `
          SELECT s.id, s.model_id, s.status, s.status_reason, s.created_at, s.status_changed_at,
                 m.name as model_name, m.provider
          FROM subscriptions s
          JOIN models m ON s.model_id = m.id
          WHERE s.user_id = $1
        `;
        const params: QueryParameter[] = [id];

        if (status) {
          query += ` AND s.status = $${params.length + 1}`;
          params.push(status);
        }

        query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        // Get count
        let countQuery = 'SELECT COUNT(*) FROM subscriptions WHERE user_id = $1';
        const countParams: QueryParameter[] = [id];

        if (status) {
          countQuery += ` AND status = $2`;
          countParams.push(status);
        }

        const [subscriptions, countResult] = await Promise.all([
          fastify.dbUtils.queryMany(query, params),
          fastify.dbUtils.queryOne(countQuery, countParams),
        ]);

        const total = parseInt(String(countResult?.count || 0));

        return {
          data: subscriptions.map((sub) => ({
            id: String(sub.id),
            modelId: String(sub.model_id),
            modelName: String(sub.model_name),
            provider: sub.provider ? String(sub.provider) : undefined,
            status: String(sub.status),
            statusReason: sub.status_reason ? String(sub.status_reason) : undefined,
            createdAt: String(sub.created_at),
            statusChangedAt: sub.status_changed_at ? String(sub.status_changed_at) : undefined,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get user subscriptions');

        if (error instanceof ApplicationError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to get user subscriptions: ${errorMessage}`);
      }
    },
  });
};

export default adminUsersRoutes;

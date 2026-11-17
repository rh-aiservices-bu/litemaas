import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { AuthenticatedRequest } from '../types';
import { ApiKeyService } from '../services/api-key.service';
import { LiteLLMService } from '../services/litellm.service';
import { ApplicationError } from '../utils/errors';

/**
 * Admin API Management routes — system-wide API key listing and bulk revocation.
 *
 * Permissions:
 * - List/stats:   `api_keys:read`   (admin + adminReadonly)
 * - Revoke/cleanup: `users:write`   (admin only — matches admin-users.ts key routes)
 */

const AdminApiKeyRowSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  keyPrefix: Type.Optional(Type.String()),
  status: Type.Union([
    Type.Literal('active'),
    Type.Literal('revoked'),
    Type.Literal('expired'),
    Type.Literal('archived'),
  ]),
  isActive: Type.Boolean(),
  userId: Type.String(),
  username: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  models: Type.Array(Type.String()),
  maxBudget: Type.Optional(Type.Number()),
  currentSpend: Type.Optional(Type.Number()),
  lastUsedAt: Type.Optional(Type.String()),
  expiresAt: Type.Optional(Type.String()),
  createdAt: Type.String(),
  revokedAt: Type.Optional(Type.String()),
  archivedAt: Type.Optional(Type.String()),
});

const AdminApiKeysListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  status: Type.Optional(
    Type.Union([
      Type.Literal('active'),
      Type.Literal('revoked'),
      Type.Literal('expired'),
      Type.Literal('archived'),
      Type.Literal('all'),
    ]),
  ),
  userId: Type.Optional(Type.String()),
  search: Type.Optional(Type.String({ maxLength: 200 })),
  sortBy: Type.Optional(
    Type.Union([
      Type.Literal('createdAt'),
      Type.Literal('name'),
      Type.Literal('lastUsedAt'),
      Type.Literal('username'),
      Type.Literal('currentSpend'),
    ]),
  ),
  sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});

const AdminApiKeysListResponseSchema = Type.Object({
  data: Type.Array(AdminApiKeyRowSchema),
  pagination: Type.Object({
    page: Type.Number(),
    limit: Type.Number(),
    total: Type.Number(),
    totalPages: Type.Number(),
  }),
  stats: Type.Object({
    total: Type.Number(),
    active: Type.Number(),
    revoked: Type.Number(),
    expired: Type.Number(),
    archived: Type.Number(),
  }),
});

const BulkRevokeRequestSchema = Type.Object({
  keyIds: Type.Array(Type.String(), { minItems: 1, maxItems: 500 }),
  reason: Type.Optional(Type.String({ maxLength: 500 })),
});

const BulkRevokeResultSchema = Type.Object({
  revoked: Type.Number(),
  failed: Type.Number(),
  results: Type.Array(
    Type.Object({
      keyId: Type.String(),
      success: Type.Boolean(),
      error: Type.Optional(Type.String()),
    }),
  ),
});

const CleanupResponseSchema = Type.Object({
  message: Type.String(),
  cleanedCount: Type.Number(),
});

type ListParams = Static<typeof AdminApiKeysListQuerySchema>;
type BulkRevokeRequest = Static<typeof BulkRevokeRequestSchema>;

const adminApiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  const liteLLMService = new LiteLLMService(fastify);
  const apiKeyService = new ApiKeyService(fastify, liteLLMService);

  // GET /admin/api-keys/all — system-wide key list with stats
  // (NOT /admin/api-keys — that path is the analytics filter endpoint in admin.ts)
  fastify.get<{
    Querystring: ListParams;
    Reply: Static<typeof AdminApiKeysListResponseSchema>;
  }>('/all', {
    schema: {
      tags: ['Admin - API Keys'],
      summary: 'List all API keys (system-wide)',
      description:
        'List API keys across all users with status filtering, search, sorting, and pagination. Includes status counts for the whole system. Requires api_keys:read permission (admin, adminReadonly).',
      security: [{ bearerAuth: [] }],
      querystring: AdminApiKeysListQuerySchema,
      response: {
        200: AdminApiKeysListResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('api_keys:read')],
    handler: async (request, _reply) => {
      const {
        page = 1,
        limit = 20,
        status = 'active',
        userId,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = request.query as ListParams;

      try {
        const result = await apiKeyService.listAllApiKeysAdmin({
          page,
          limit,
          status,
          userId,
          search,
          sortBy,
          sortOrder,
        });

        return result;
      } catch (error) {
        fastify.log.error(error, 'Failed to list all API keys (admin)');

        if (error instanceof ApplicationError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to list API keys: ${errorMessage}`);
      }
    },
  });

  // POST /admin/api-keys/bulk-revoke — soft revoke many keys at once
  fastify.post<{
    Body: BulkRevokeRequest;
    Reply: Static<typeof BulkRevokeResultSchema>;
  }>('/bulk-revoke', {
    schema: {
      tags: ['Admin - API Keys'],
      summary: 'Bulk revoke API keys',
      description:
        'Soft revoke (deactivate + delete from LiteLLM) multiple API keys in one call. Skips keys that are already inactive. Creates one audit log entry per revoked key. Requires users:write permission (admin only).',
      security: [{ bearerAuth: [] }],
      body: BulkRevokeRequestSchema,
      response: {
        200: BulkRevokeResultSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:write')],
    handler: async (request, _reply) => {
      const currentUser = (request as AuthenticatedRequest).user;
      const { keyIds, reason } = request.body as BulkRevokeRequest;

      try {
        const result = await apiKeyService.bulkRevokeKeysAdmin(
          keyIds,
          currentUser.userId,
          reason || 'Bulk revoked by admin',
        );

        fastify.log.info(
          {
            adminUserId: currentUser.userId,
            requested: keyIds.length,
            revoked: result.revoked,
            failed: result.failed,
          },
          'Admin bulk revoked API keys',
        );

        return result;
      } catch (error) {
        fastify.log.error(error, 'Failed to bulk revoke API keys');

        if (error instanceof ApplicationError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to bulk revoke API keys: ${errorMessage}`);
      }
    },
  });

  // POST /admin/api-keys/cleanup-expired — deactivate all expired keys
  fastify.post('/cleanup-expired', {
    schema: {
      tags: ['Admin - API Keys'],
      summary: 'Cleanup expired API keys',
      description:
        'Deactivate every active key whose expires_at has passed. Deletes each from LiteLLM. Returns the number of keys cleaned. Requires users:write permission (admin only).',
      security: [{ bearerAuth: [] }],
      response: {
        200: CleanupResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:write')],
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        const cleanedCount = await apiKeyService.cleanupExpiredKeys();

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, 'API_KEYS_CLEANUP', 'API_KEY', JSON.stringify({ cleanedCount })],
        );

        return {
          message: 'Expired API keys cleaned up successfully',
          cleanedCount,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to cleanup expired API keys');
        // Re-throw ApplicationError instances as-is
        if (error instanceof ApplicationError) {
          throw error;
        }
        // For other errors, include original message
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to cleanup expired API keys: ${errorMessage}`);
      }
    },
  });
};

export default adminApiKeysRoutes;

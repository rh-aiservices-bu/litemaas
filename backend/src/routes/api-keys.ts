import { FastifyPluginAsync } from 'fastify';
import {
  CreateApiKeyDto,
  CreateApiKeyResponse,
  RotateApiKeyResponse,
  ApiKeyDetails,
  ApiKeyListParams,
  PaginatedResponse,
  AuthenticatedRequest,
} from '../types';
import {
  CreateApiKeyRequestSchema,
  ApiKeyResponseSchema,
  SingleApiKeyResponseSchema,
} from '../schemas/api-keys';
import { ApiKeyService } from '../services/api-key.service';
import { LiteLLMService } from '../services/litellm.service';

// Error type for proper error handling
interface ErrorWithStatusCode extends Error {
  statusCode?: number;
  code?: string;
}

const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize services
  const liteLLMService = new LiteLLMService(fastify);
  const apiKeyService = new ApiKeyService(fastify, liteLLMService);

  // List API keys
  fastify.get<{
    Querystring: ApiKeyListParams;
    Reply: PaginatedResponse<ApiKeyDetails>;
  }>('/', {
    schema: {
      tags: ['API Keys'],
      description: 'List user API keys with multi-model support',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          subscriptionId: { type: 'string', description: 'Legacy: Filter by subscription ID' },
          modelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'New: Filter by model IDs',
          },
          isActive: { type: 'boolean' },
        },
      },
      response: {
        200: ApiKeyResponseSchema,
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { page = 1, limit = 20, subscriptionId, modelIds, isActive } = request.query;

      try {
        const result = await apiKeyService.getUserApiKeys(user.userId, {
          subscriptionId,
          modelIds,
          isActive,
          page,
          limit,
        });

        const totalPages = Math.ceil(result.total / limit);

        return {
          data: result.data.map((apiKey) => ({
            id: apiKey.id,
            name: apiKey.name,
            prefix: apiKey.keyPrefix, // Map keyPrefix to prefix for API response
            models: apiKey.models,
            subscriptionId: apiKey.subscriptionDetails?.[0]?.subscriptionId,
            lastUsedAt: apiKey.lastUsedAt,
            createdAt: apiKey.createdAt,
            // Include additional fields from EnhancedApiKey
            keyPrefix: apiKey.keyPrefix,
            modelDetails: apiKey.modelDetails,
            subscriptionDetails: apiKey.subscriptionDetails,
            expiresAt: apiKey.expiresAt,
            isActive: apiKey.isActive,
            revokedAt: apiKey.revokedAt,
            liteLLMKeyId: apiKey.liteLLMKeyId,
            lastSyncAt: apiKey.lastSyncAt,
            syncStatus: apiKey.syncStatus,
            syncError: apiKey.syncError,
            maxBudget: apiKey.maxBudget,
            currentSpend: apiKey.currentSpend,
            tpmLimit: apiKey.tpmLimit,
            rpmLimit: apiKey.rpmLimit,
            metadata: apiKey.metadata,
          })),
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to list API keys');
        throw fastify.createError(500, 'Failed to list API keys');
      }
    },
  });

  // Get API key by ID
  fastify.get<{
    Params: { id: string };
    Reply: ApiKeyDetails;
  }>('/:id', {
    schema: {
      tags: ['API Keys'],
      description: 'Get API key by ID with multi-model support',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: SingleApiKeyResponseSchema,
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        const apiKey = await apiKeyService.getApiKey(id, user.userId);

        if (!apiKey) {
          throw fastify.createNotFoundError('API key');
        }

        return {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.keyPrefix, // Map keyPrefix to prefix for API response
          models: apiKey.models,
          subscriptionId: apiKey.subscriptionDetails?.[0]?.subscriptionId,
          lastUsedAt: apiKey.lastUsedAt,
          createdAt: apiKey.createdAt,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get API key');

        if ((error as ErrorWithStatusCode).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to get API key');
      }
    },
  });

  // Generate new API key
  fastify.post<{
    Body: CreateApiKeyDto;
    Reply: CreateApiKeyResponse;
  }>('/', {
    schema: {
      tags: ['API Keys'],
      description: 'Generate new API key with multi-model support',
      security: [{ bearerAuth: [] }],
      body: CreateApiKeyRequestSchema,
      response: {
        201: SingleApiKeyResponseSchema,
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const body = request.body;

      // Check if this is the new format or legacy format
      const isLegacyFormat = 'subscriptionId' in body && !('modelIds' in body);

      if (isLegacyFormat) {
        // Add deprecation warning header
        reply.header(
          'X-API-Deprecation-Warning',
          'subscriptionId parameter is deprecated. Use modelIds array instead.',
        );
        reply.header(
          'X-API-Migration-Guide',
          'See /docs/api/migration-guide for details on upgrading to multi-model API keys.',
        );
      }

      try {
        const apiKey = await apiKeyService.createApiKey(user.userId, body);

        reply.status(201);
        return {
          id: apiKey.id,
          name: apiKey.name,
          key: apiKey.key, // Only returned on creation
          keyPrefix: apiKey.keyPrefix, // Consistent field name with frontend expectations
          models: apiKey.models || [],
          modelDetails: apiKey.modelDetails,
          subscriptionId: apiKey.subscriptionId, // For backward compatibility
          createdAt: apiKey.createdAt,
          expiresAt: apiKey.expiresAt,
          isActive: apiKey.isActive,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to create API key');

        if ((error as ErrorWithStatusCode).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to create API key');
      }
    },
  });

  // Rotate API key
  fastify.post<{
    Params: { id: string };
    Reply: RotateApiKeyResponse;
  }>('/:id/rotate', {
    schema: {
      tags: ['API Keys'],
      description: 'Rotate API key',
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
            key: { type: 'string' },
            keyPrefix: { type: 'string' },
            rotatedAt: { type: 'string', format: 'date-time' },
            oldPrefix: { type: 'string' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        // Get old prefix for response
        const oldApiKey = await apiKeyService.getApiKey(id, user.userId);
        if (!oldApiKey) {
          throw fastify.createNotFoundError('API key');
        }

        const rotatedApiKey = await apiKeyService.rotateApiKey(id, user.userId);

        return {
          id: rotatedApiKey.id,
          key: rotatedApiKey.key, // New key
          keyPrefix: rotatedApiKey.keyPrefix,
          rotatedAt: new Date(),
          oldPrefix: oldApiKey.keyPrefix,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to rotate API key');

        if ((error as ErrorWithStatusCode).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to rotate API key');
      }
    },
  });

  // Delete API key
  fastify.delete<{
    Params: { id: string };
    Reply: { message: string; deletedAt: string };
  }>('/:id', {
    schema: {
      tags: ['API Keys'],
      description: 'Delete API key',
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
            message: { type: 'string' },
            deletedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        await apiKeyService.deleteApiKey(id, user.userId);

        return {
          message: 'API key deleted successfully',
          deletedAt: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to delete API key');

        if ((error as ErrorWithStatusCode).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to delete API key');
      }
    },
  });

  // Update API key
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      modelIds?: string[];
      metadata?: {
        description?: string;
        permissions?: string[];
        rateLimit?: number;
      };
    };
    Reply: ApiKeyDetails;
  }>('/:id', {
    schema: {
      tags: ['API Keys'],
      description: 'Update API key name, description, and models',
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
          name: { type: 'string' },
          modelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of model IDs this API key can access',
          },
          metadata: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              permissions: {
                type: 'array',
                items: { type: 'string' },
              },
              rateLimit: { type: 'number' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            prefix: { type: 'string' },
            models: {
              type: 'array',
              items: { type: 'string' },
            },
            subscriptionId: { type: 'string' },
            lastUsedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;
      const body = request.body;

      try {
        const updatedApiKey = await apiKeyService.updateApiKey(id, user.userId, body);

        return {
          id: updatedApiKey.id,
          name: updatedApiKey.name,
          prefix: updatedApiKey.keyPrefix,
          models: updatedApiKey.models || [],
          modelDetails: updatedApiKey.modelDetails,
          subscriptionId: updatedApiKey.subscriptionDetails?.[0]?.subscriptionId,
          lastUsedAt: updatedApiKey.lastUsedAt,
          createdAt: updatedApiKey.createdAt,
          keyPrefix: updatedApiKey.keyPrefix,
          expiresAt: updatedApiKey.expiresAt,
          isActive: updatedApiKey.isActive,
          revokedAt: updatedApiKey.revokedAt,
          liteLLMKeyId: updatedApiKey.liteLLMKeyId,
          lastSyncAt: updatedApiKey.lastSyncAt,
          syncStatus: updatedApiKey.syncStatus,
          syncError: updatedApiKey.syncError,
          maxBudget: updatedApiKey.maxBudget,
          currentSpend: updatedApiKey.currentSpend,
          tpmLimit: updatedApiKey.tpmLimit,
          rpmLimit: updatedApiKey.rpmLimit,
          metadata: updatedApiKey.metadata,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to update API key');

        if ((error as ErrorWithStatusCode).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to update API key');
      }
    },
  });

  // Get API key usage statistics
  fastify.get<{
    Params: { id: string };
    Reply: {
      totalRequests: number;
      requestsThisMonth: number;
      lastUsedAt?: string;
      createdAt: string;
    };
  }>('/:id/usage', {
    schema: {
      tags: ['API Keys'],
      description: 'Get API key usage statistics',
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
            totalRequests: { type: 'number' },
            requestsThisMonth: { type: 'number' },
            lastUsedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        const usage = await apiKeyService.getApiKeyUsage(id, user.userId);

        return {
          totalRequests: usage.totalRequests,
          requestsThisMonth: usage.requestsThisMonth,
          lastUsedAt: usage.lastUsedAt?.toISOString(),
          createdAt: usage.createdAt.toISOString(),
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get API key usage');

        if ((error as ErrorWithStatusCode).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to get API key usage');
      }
    },
  });

  // Get API key statistics
  fastify.get('/stats', {
    schema: {
      tags: ['API Keys'],
      description: 'Get user API key statistics',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            active: { type: 'number' },
            expired: { type: 'number' },
            revoked: { type: 'number' },
            bySubscription: {
              type: 'object',
              additionalProperties: { type: 'number' },
              description: 'Legacy: Count by subscription (for backward compatibility)',
            },
            byModel: {
              type: 'object',
              additionalProperties: { type: 'number' },
              description: 'New: Count by model',
            },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        const stats = await apiKeyService.getApiKeyStats(user.userId);
        return stats;
      } catch (error) {
        fastify.log.error(error, 'Failed to get API key statistics');
        throw fastify.createError(500, 'Failed to get API key statistics');
      }
    },
  });

  // Validate API key (internal endpoint for testing)
  fastify.post('/validate', {
    schema: {
      tags: ['API Keys'],
      description: 'Validate API key (internal)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          key: { type: 'string' },
        },
        required: ['key'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            isValid: { type: 'boolean' },
            subscriptionId: {
              type: 'string',
              description: 'Legacy field for backward compatibility',
            },
            models: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of model IDs this API key can access',
            },
            userId: { type: 'string' },
            keyId: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:api_keys')],
    handler: async (request, _reply) => {
      const { key } = request.body as { key: string };

      try {
        const validation = await apiKeyService.validateApiKey(key);
        return validation;
      } catch (error) {
        fastify.log.error(error, 'Failed to validate API key');
        throw fastify.createError(500, 'Failed to validate API key');
      }
    },
  });

  // Admin endpoints

  // List all API keys (admin only)
  fastify.get('/admin/all', {
    schema: {
      tags: ['API Keys'],
      description: 'List all API keys (admin only)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          userId: { type: 'string' },
          subscriptionId: { type: 'string' },
          isActive: { type: 'boolean' },
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
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:api_keys')],
    handler: async (_request, _reply) => {
      // This would be implemented for admin use
      throw fastify.createError(501, 'Admin endpoint not implemented yet');
    },
  });

  // Cleanup expired keys (admin only)
  fastify.post('/admin/cleanup-expired', {
    schema: {
      tags: ['API Keys'],
      description: 'Cleanup expired API keys (admin only)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            cleanedCount: { type: 'number' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:api_keys')],
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
        throw fastify.createError(500, 'Failed to cleanup expired API keys');
      }
    },
  });

  // Secure API key retrieval endpoint - Phase 2 implementation
  fastify.post<{
    Params: { id: string };
    Reply: { key: string; keyType: string; retrievedAt: string };
  }>('/:id/reveal', {
    schema: {
      tags: ['API Keys'],
      description: 'Securely retrieve full API key value (requires recent authentication)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'API key ID to retrieve',
          },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'The full LiteLLM API key value',
            },
            keyType: {
              type: 'string',
              enum: ['litellm'],
              description: 'Type of API key returned',
            },
            retrievedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the key was retrieved',
            },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
        429: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
      },
    },
    preHandler: [
      fastify.authenticateWithDevBypass,
      fastify.requireRecentAuth,
      fastify.keyOperationRateLimit,
    ],
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        // Enhanced audit metadata with request details
        const retrievalTimestamp = new Date();

        // Retrieve the full key securely
        const fullKey = await apiKeyService.retrieveFullKey(id, user.userId);

        // Update audit log with additional request context
        try {
          await fastify.dbUtils.query(
            `UPDATE audit_logs 
             SET metadata = metadata || $1
             WHERE id = (
               SELECT id FROM audit_logs
               WHERE user_id = $2 
                 AND action = 'API_KEY_RETRIEVE_FULL' 
                 AND resource_id = $3
                 AND created_at > NOW() - INTERVAL '1 minute'
               ORDER BY created_at DESC 
               LIMIT 1
             )`,
            [
              JSON.stringify({
                userAgent: request.headers['user-agent'],
                ipAddress: request.ip,
                endpoint: request.url,
                method: request.method,
              }),
              user.userId,
              id,
            ],
          );
        } catch (auditUpdateError) {
          fastify.log.warn(auditUpdateError, 'Failed to update audit log with request context');
        }

        // Security headers
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        reply.header('Pragma', 'no-cache');

        fastify.log.info(
          {
            userId: user.userId,
            keyId: id,
            userAgent: request.headers['user-agent'],
            ipAddress: request.ip,
          },
          'API key successfully retrieved via secure endpoint',
        );

        return {
          key: fullKey,
          keyType: 'litellm',
          retrievedAt: retrievalTimestamp.toISOString(),
        };
      } catch (error) {
        // Enhanced error logging with security context
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : String(error),
            statusCode: (error as ErrorWithStatusCode).statusCode,
            userId: user.userId,
            keyId: id,
            userAgent: request.headers['user-agent'],
            ipAddress: request.ip,
          },
          'Failed to retrieve API key via secure endpoint',
        );

        // Create security audit log for failed attempts
        try {
          await fastify.dbUtils.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              user.userId,
              'API_KEY_RETRIEVE_FAILED',
              'API_KEY',
              id,
              request.ip,
              request.headers['user-agent'] ?? null,
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                statusCode: (error as ErrorWithStatusCode).statusCode,
                timestamp: new Date().toISOString(),
                endpoint: request.url,
              }),
            ],
          );
        } catch (auditError) {
          fastify.log.error(
            auditError,
            'Failed to create security audit log for failed key retrieval',
          );
        }

        if ((error as ErrorWithStatusCode).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to retrieve API key');
      }
    },
  });
};

export default apiKeysRoutes;

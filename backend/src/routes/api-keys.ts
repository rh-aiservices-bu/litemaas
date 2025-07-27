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
import { ApiKeyService } from '../services/api-key.service';
import { LiteLLMService } from '../services/litellm.service';

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
      description: 'List user API keys',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          subscriptionId: { type: 'string' },
          isActive: { type: 'boolean' },
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
                  subscriptionId: { type: 'string' },
                  userId: { type: 'string' },
                  name: { type: 'string' },
                  keyPrefix: { type: 'string' },
                  lastUsedAt: { type: 'string', format: 'date-time' },
                  expiresAt: { type: 'string', format: 'date-time' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string', format: 'date-time' },
                  revokedAt: { type: 'string', format: 'date-time' },
                  metadata: { type: 'object' },
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
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { page = 1, limit = 20, subscriptionId, isActive } = request.query;

      try {
        const result = await apiKeyService.getUserApiKeys(user.userId, {
          subscriptionId,
          isActive,
          page,
          limit,
        });

        const totalPages = Math.ceil(result.total / limit);

        return {
          data: result.data,
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
      description: 'Get API key by ID',
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
            subscriptionId: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string' },
            keyPrefix: { type: 'string' },
            lastUsedAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            revokedAt: { type: 'string', format: 'date-time' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id } = request.params;

      try {
        const apiKey = await apiKeyService.getApiKey(id, user.userId);
        
        if (!apiKey) {
          throw fastify.createNotFoundError('API key');
        }

        return apiKey;
      } catch (error) {
        fastify.log.error(error, 'Failed to get API key');
        
        if (error.statusCode) {
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
      description: 'Generate new API key',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' },
          name: { type: 'string', maxLength: 255 },
          expiresAt: { type: 'string', format: 'date-time' },
          metadata: { type: 'object' },
        },
        required: ['subscriptionId'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            subscriptionId: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string' },
            key: { type: 'string' },
            keyPrefix: { type: 'string' },
            isActive: { type: 'boolean' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { subscriptionId, name, expiresAt, metadata } = request.body;

      try {
        const apiKey = await apiKeyService.createApiKey(user.userId, {
          subscriptionId,
          name,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          metadata,
        });

        reply.status(201);
        return {
          id: apiKey.id,
          subscriptionId: apiKey.subscriptionId,
          userId: apiKey.userId,
          name: apiKey.name,
          key: apiKey.key, // Only returned on creation
          keyPrefix: apiKey.keyPrefix,
          isActive: apiKey.isActive,
          expiresAt: apiKey.expiresAt?.toISOString(),
          createdAt: apiKey.createdAt.toISOString(),
          metadata: apiKey.metadata,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to create API key');
        
        if (error.statusCode) {
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
    handler: async (request, reply) => {
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
          rotatedAt: new Date().toISOString(),
          oldPrefix: oldApiKey.keyPrefix,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to rotate API key');
        
        if (error.statusCode) {
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
    handler: async (request, reply) => {
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
        
        if (error.statusCode) {
          throw error;
        }
        
        throw fastify.createError(500, 'Failed to delete API key');
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
    handler: async (request, reply) => {
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
        
        if (error.statusCode) {
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
            },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, reply) => {
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
            subscriptionId: { type: 'string' },
            userId: { type: 'string' },
            keyId: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:api_keys')],
    handler: async (request, reply) => {
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
    handler: async (request, reply) => {
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
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        const cleanedCount = await apiKeyService.cleanupExpiredKeys();
        
        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
           VALUES ($1, $2, $3, $4)`,
          [
            user.userId,
            'API_KEYS_CLEANUP',
            'API_KEY',
            { cleanedCount },
          ]
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
};

export default apiKeysRoutes;
import { FastifyPluginAsync } from 'fastify';
import { Static } from '@sinclair/typebox';
import { AuthenticatedRequest, PaginatedResponse, QueryParameter } from '../types';
import { UserProfileSchema, IdParamSchema } from '../schemas';

interface UserHistoryQuery {
  page?: number;
  limit?: number;
  action?: string;
}

interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

interface FastifyError extends Error {
  statusCode?: number;
}

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // Update user profile
  fastify.patch<{
    Reply: Static<typeof UserProfileSchema>;
    Body: {
      fullName?: string;
    };
  }>('/me', {
    schema: {
      tags: ['Users'],
      description: 'Update current user profile',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          fullName: { type: 'string', maxLength: 255 },
        },
      },
      response: {
        200: UserProfileSchema,
      },
    },
    preHandler: fastify.authenticate,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { fullName } = request.body;

      try {
        // Update user profile
        const updatedUser = await fastify.dbUtils.queryOne(
          `UPDATE users SET 
           full_name = COALESCE($1, full_name),
           updated_at = NOW()
           WHERE id = $2
           RETURNING id, username, email, full_name, roles, created_at`,
          [fullName ?? null, user.userId],
        );

        if (!updatedUser) {
          throw fastify.createNotFoundError('User');
        }

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.userId,
            'PROFILE_UPDATE',
            'USER',
            user.userId,
            JSON.stringify({ changes: { fullName } }),
          ],
        );

        return {
          id: String(updatedUser.id),
          username: String(updatedUser.username),
          email: String(updatedUser.email),
          fullName: updatedUser.full_name as string | undefined,
          roles: updatedUser.roles as string[],
          createdAt: String(updatedUser.created_at),
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to update user profile');

        if ((error as FastifyError).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to update user profile');
      }
    },
  });

  // Get user activity
  fastify.get('/me/activity', {
    schema: {
      tags: ['Users'],
      description: 'Get current user activity',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          action: { type: 'string' },
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
                  action: { type: 'string' },
                  resourceType: { type: 'string' },
                  resourceId: { type: 'string' },
                  ipAddress: { type: 'string' },
                  userAgent: { type: 'string' },
                  metadata: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' },
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
    preHandler: fastify.authenticate,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { page = 1, limit = 20, action } = request.query as UserHistoryQuery;

      try {
        const offset = (page - 1) * limit;

        // Build query
        let query = `
          SELECT id, action, resource_type, resource_id, ip_address, user_agent, metadata, created_at
          FROM audit_logs
          WHERE user_id = $1
        `;
        const params: QueryParameter[] = [user.userId];

        if (action) {
          query += ` AND action = $${params.length + 1}`;
          params.push(action);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        // Get count
        let countQuery = 'SELECT COUNT(*) FROM audit_logs WHERE user_id = $1';
        const countParams = [user.userId];

        if (action) {
          countQuery += ' AND action = $2';
          countParams.push(action);
        }

        const [activities, countResult] = await Promise.all([
          fastify.dbUtils.queryMany(query, params),
          fastify.dbUtils.queryOne(countQuery, countParams),
        ]);

        const total = parseInt(String(countResult?.count || '0'));
        const totalPages = Math.ceil(total / limit);

        return {
          data: activities.map((activity) => ({
            id: activity.id,
            action: activity.action,
            resourceType: activity.resource_type,
            resourceId: activity.resource_id,
            ipAddress: activity.ip_address,
            userAgent: activity.user_agent,
            metadata: activity.metadata,
            createdAt: activity.created_at,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get user activity');
        throw fastify.createError(500, 'Failed to get user activity');
      }
    },
  });

  // Get user statistics
  fastify.get('/me/stats', {
    schema: {
      tags: ['Users'],
      description: 'Get current user statistics',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            subscriptions: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                active: { type: 'number' },
                suspended: { type: 'number' },
              },
            },
            apiKeys: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                active: { type: 'number' },
              },
            },
            usage: {
              type: 'object',
              properties: {
                totalRequests: { type: 'number' },
                totalTokens: { type: 'number' },
                currentMonthRequests: { type: 'number' },
                currentMonthTokens: { type: 'number' },
              },
            },
            lastLogin: { type: 'string', format: 'date-time' },
            memberSince: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    preHandler: fastify.authenticate,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        // Get subscription stats
        const subscriptionStats = await fastify.dbUtils.queryOne(
          `SELECT 
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'active') as active,
             COUNT(*) FILTER (WHERE status = 'suspended') as suspended
           FROM subscriptions 
           WHERE user_id = $1`,
          [user.userId],
        );

        // Get API key stats
        const apiKeyStats = await fastify.dbUtils.queryOne(
          `SELECT 
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE is_active = true) as active
           FROM api_keys ak
           JOIN subscriptions s ON ak.subscription_id = s.id
           WHERE s.user_id = $1`,
          [user.userId],
        );

        // Get usage stats
        const usageStats = await fastify.dbUtils.queryOne(
          `SELECT 
             COUNT(*) as total_requests,
             COALESCE(SUM(total_tokens), 0) as total_tokens,
             COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) as current_month_requests,
             COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0) as current_month_tokens
           FROM usage_logs ul
           JOIN subscriptions s ON ul.subscription_id = s.id
           WHERE s.user_id = $1`,
          [user.userId],
        );

        // Get user info
        const userInfo = await fastify.dbUtils.queryOne(
          'SELECT last_login_at, created_at FROM users WHERE id = $1',
          [user.userId],
        );

        return {
          subscriptions: {
            total: parseInt(String(subscriptionStats?.total || '0')) || 0,
            active: parseInt(String(subscriptionStats?.active || '0')) || 0,
            suspended: parseInt(String(subscriptionStats?.suspended || '0')) || 0,
          },
          apiKeys: {
            total: parseInt(String(apiKeyStats?.total || '0')) || 0,
            active: parseInt(String(apiKeyStats?.active || '0')) || 0,
          },
          usage: {
            totalRequests: parseInt(String(usageStats?.total_requests || '0')) || 0,
            totalTokens: parseInt(String(usageStats?.total_tokens || '0')) || 0,
            currentMonthRequests: parseInt(String(usageStats?.current_month_requests || '0')) || 0,
            currentMonthTokens: parseInt(String(usageStats?.current_month_tokens || '0')) || 0,
          },
          lastLogin: userInfo?.last_login_at,
          memberSince: userInfo?.created_at,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get user statistics');
        throw fastify.createError(500, 'Failed to get user statistics');
      }
    },
  });

  // Admin endpoints for user management
  interface UserListItem {
    id: string;
    username: string;
    email: string;
    fullName?: string;
    roles: string[];
    isActive: boolean;
    lastLoginAt?: string;
    createdAt: string;
  }

  fastify.get<{
    Reply: PaginatedResponse<UserListItem>;
  }>('/', {
    schema: {
      tags: ['Users'],
      description: 'List all users (admin only)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          role: { type: 'string' },
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
                  username: { type: 'string' },
                  email: { type: 'string' },
                  fullName: { type: 'string' },
                  roles: { type: 'array', items: { type: 'string' } },
                  isActive: { type: 'boolean' },
                  lastLoginAt: { type: 'string', format: 'date-time' },
                  createdAt: { type: 'string', format: 'date-time' },
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
    preHandler: [fastify.authenticate, fastify.requirePermission('users:read')],
    handler: async (request, _reply) => {
      const { page = 1, limit = 20, search, role, isActive } = request.query as UserListQuery;

      try {
        const offset = (page - 1) * limit;

        // Build query
        let query = `
          SELECT id, username, email, full_name, roles, is_active, last_login_at, created_at
          FROM users
          WHERE 1=1
        `;
        const params: QueryParameter[] = [];

        if (search) {
          query += ` AND (username ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1} OR full_name ILIKE $${params.length + 1})`;
          params.push(`%${search}%`);
        }

        if (role) {
          query += ` AND $${params.length + 1} = ANY(roles)`;
          params.push(role);
        }

        if (typeof isActive === 'boolean') {
          query += ` AND is_active = $${params.length + 1}`;
          params.push(isActive);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        // Get count
        let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
        const countParams: QueryParameter[] = [];

        if (search) {
          countQuery += ` AND (username ILIKE $${countParams.length + 1} OR email ILIKE $${countParams.length + 1} OR full_name ILIKE $${countParams.length + 1})`;
          countParams.push(`%${search}%`);
        }

        if (role) {
          countQuery += ` AND $${countParams.length + 1} = ANY(roles)`;
          countParams.push(role);
        }

        if (typeof isActive === 'boolean') {
          countQuery += ` AND is_active = $${countParams.length + 1}`;
          countParams.push(isActive);
        }

        const [users, countResult] = await Promise.all([
          fastify.dbUtils.queryMany(query, params),
          fastify.dbUtils.queryOne(countQuery, countParams),
        ]);

        const total = parseInt(String(countResult?.count || '0'));
        const totalPages = Math.ceil(total / limit);

        return {
          data: users.map((user) => ({
            id: String(user.id),
            username: String(user.username),
            email: String(user.email),
            fullName: user.full_name ? String(user.full_name) : undefined,
            roles: user.roles as string[],
            isActive: Boolean(user.is_active),
            lastLoginAt: user.last_login_at ? String(user.last_login_at) : undefined,
            createdAt: String(user.created_at),
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to list users');
        throw fastify.createError(500, 'Failed to list users');
      }
    },
  });

  // Update user (admin only)
  fastify.patch<{
    Params: Static<typeof IdParamSchema>;
    Body: {
      roles?: string[];
    };
  }>('/:id', {
    schema: {
      tags: ['Users'],
      description: 'Update user (admin only)',
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      body: {
        type: 'object',
        properties: {
          roles: { type: 'array', items: { type: 'string' } },
        },
      },
      response: {
        200: UserProfileSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('users:write')],
    handler: async (request, _reply) => {
      const { id } = request.params;
      const { roles } = request.body;
      const currentUser = (request as AuthenticatedRequest).user;

      try {
        const updatedUser = await fastify.dbUtils.queryOne(
          `UPDATE users SET 
           roles = COALESCE($1, roles),
           updated_at = NOW()
           WHERE id = $2
           RETURNING id, username, email, full_name, roles, created_at`,
          [roles ? `{${roles.join(',')}}` : null, id],
        );

        if (!updatedUser) {
          throw fastify.createNotFoundError('User');
        }

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [currentUser.userId, 'USER_UPDATE', 'USER', id, JSON.stringify({ changes: { roles } })],
        );

        return {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          fullName: updatedUser.full_name,
          roles: updatedUser.roles,
          createdAt: updatedUser.created_at,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to update user');

        if ((error as FastifyError).statusCode) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to update user');
      }
    },
  });
};

export default usersRoutes;

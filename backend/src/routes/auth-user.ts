import { FastifyPluginAsync } from 'fastify';
import { Static } from '@sinclair/typebox';
import { AuthenticatedRequest } from '../types';
import { UserInfoSchema, UserProfileSchema } from '../schemas';

/**
 * Authenticated user operations routes
 * These are the user-related endpoints that require authentication
 * and are part of the versioned API
 */
const authUserRoutes: FastifyPluginAsync = async (fastify) => {
  // Get current user (me endpoint)
  fastify.get<{
    Reply: Static<typeof UserInfoSchema>;
  }>('/me', {
    schema: {
      tags: ['User'],
      description: 'Get current authenticated user',
      security: [{ bearerAuth: [] }],
      response: {
        200: UserInfoSchema,
      },
    },
    preHandler: fastify.authenticate,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        // Get user details from database
        const userDetails = await fastify.dbUtils.queryOne(
          'SELECT id, username, email, full_name, roles, created_at FROM users WHERE id = $1',
          [user.userId],
        );

        if (!userDetails) {
          throw fastify.createNotFoundError('User');
        }

        // Return user data in the format expected by frontend
        return {
          id: String(userDetails.id),
          username: String(userDetails.username),
          email: String(userDetails.email),
          name: String(userDetails.full_name || userDetails.username), // Frontend expects 'name'
          roles: userDetails.roles as string[],
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get user profile');

        if (error && typeof error === 'object' && 'statusCode' in error) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to get user profile');
      }
    },
  });

  // Get user profile (detailed version)
  fastify.get<{
    Reply: Static<typeof UserProfileSchema>;
  }>('/profile', {
    schema: {
      tags: ['User'],
      description: 'Get current user profile with full details',
      security: [{ bearerAuth: [] }],
      response: {
        200: UserProfileSchema,
      },
    },
    preHandler: fastify.authenticate,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        // Get user details from database
        const userDetails = await fastify.dbUtils.queryOne(
          'SELECT id, username, email, full_name, roles, created_at FROM users WHERE id = $1',
          [user.userId],
        );

        if (!userDetails) {
          throw fastify.createNotFoundError('User');
        }

        return {
          id: String(userDetails.id),
          username: String(userDetails.username),
          email: String(userDetails.email),
          fullName: userDetails.full_name as string | undefined,
          roles: userDetails.roles as string[],
          createdAt: String(userDetails.created_at),
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get user profile');

        if (error && typeof error === 'object' && 'statusCode' in error) {
          throw error;
        }

        throw fastify.createError(500, 'Failed to get user profile');
      }
    },
  });
};

export default authUserRoutes;

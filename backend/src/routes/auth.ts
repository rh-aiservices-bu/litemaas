import { FastifyPluginAsync } from 'fastify';
import { Static } from '@sinclair/typebox';
import { AuthCallbackParams, LoginResponse, TokenResponse, AuthenticatedRequest } from '../types';
import { 
  LoginResponseSchema, 
  AuthCallbackQuerySchema, 
  TokenResponseSchema, 
  UserProfileSchema 
} from '../schemas';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // OAuth login initiation
  fastify.post<{
    Reply: Static<typeof LoginResponseSchema>;
  }>('/login', {
    schema: {
      tags: ['Authentication'],
      description: 'Initiate OAuth login flow',
      response: {
        200: LoginResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const state = fastify.oauthHelpers.generateAndStoreState();
        const authUrl = fastify.oauth.generateAuthUrl(state);

        return { authUrl };
      } catch (error) {
        fastify.log.error(error, 'Failed to generate auth URL');
        throw fastify.createError(500, 'Failed to initiate authentication');
      }
    },
  });

  // Development token endpoint - get JWT for frontend
  fastify.post('/dev-token', {
    schema: {
      tags: ['Authentication'],
      description: 'Get development JWT token for frontend (development only)',
      hide: process.env.NODE_ENV === 'production',
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', default: 'developer' },
          roles: { type: 'array', items: { type: 'string' }, default: ['admin', 'user'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            token_type: { type: 'string' },
            expires_in: { type: 'number' },
            user: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      // Only allow in development or with explicit dev token environment variable
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_TOKENS) {
        throw fastify.createError(404, 'Endpoint not available');
      }

      const { username = 'developer', roles = ['admin', 'user'] } = request.body as any;

      const user = {
        userId: 'dev-user-1',
        username,
        email: `${username}@litemaas.local`,
        name: 'Development User',
        roles,
      };

      try {
        const tokenPair = await fastify.generateTokenPair(user);
        
        return {
          access_token: tokenPair.accessToken,
          token_type: 'Bearer',
          expires_in: 86400, // 24 hours
          user: {
            userId: user.userId,
            username: user.username,
            email: user.email,
            roles: user.roles,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to generate development token');
        throw fastify.createError(500, 'Failed to generate token');
      }
    },
  });

  // Mock login for development
  fastify.get('/mock-login', {
    schema: {
      tags: ['Authentication'],
      description: 'Mock login for development (hidden in production)',
      hide: process.env.NODE_ENV === 'production',
      querystring: {
        type: 'object',
        properties: {
          state: { type: 'string' },
          user: { type: 'string', description: 'User index (0-2)' },
        },
        required: ['state'],
      },
    },
    handler: async (request, reply) => {
      if (process.env.NODE_ENV === 'production') {
        throw fastify.createNotFoundError('Endpoint');
      }

      const { state, user = '0' } = request.query as { state: string; user?: string };
      
      // Redirect to callback with mock authorization code
      const callbackUrl = new URL('/api/auth/callback', 'http://localhost:8080');
      callbackUrl.searchParams.set('code', user);
      callbackUrl.searchParams.set('state', state);
      
      reply.redirect(callbackUrl.toString());
    },
  });

  // OAuth callback
  fastify.get<{
    Querystring: Static<typeof AuthCallbackQuerySchema>;
  }>('/callback', {
    schema: {
      tags: ['Authentication'],
      description: 'OAuth callback endpoint',
      querystring: AuthCallbackQuerySchema,
      response: {
        200: TokenResponseSchema,
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { code, state } = request.query;

      try {
        // Validate state parameter
        if (!fastify.oauthHelpers.validateState(state)) {
          throw fastify.createError(400, 'Invalid or expired state parameter');
        }

        // Exchange authorization code for access token
        const tokenResponse = await fastify.oauth.exchangeCodeForToken(code, state);
        
        // Get user information
        const userInfo = await fastify.oauth.getUserInfo(tokenResponse.access_token);
        
        // Process user (create or update in database)
        const user = await fastify.oauth.processOAuthUser(userInfo);

        // Generate JWT token
        const token = fastify.generateToken({
          userId: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
        });

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.id,
            'LOGIN',
            request.ip,
            request.headers['user-agent'],
            { oauth_provider: 'openshift', method: 'oauth' },
          ]
        );

        fastify.log.info({ userId: user.id, username: user.username }, 'User logged in');

        // In production, consider redirecting to frontend with token
        if (process.env.NODE_ENV === 'development') {
          return {
            token,
            expiresIn: 24 * 60 * 60, // 24 hours in seconds
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              roles: user.roles,
            },
          };
        } else {
          // Redirect to frontend with token in URL fragment (SPA)
          const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
          frontendUrl.hash = `token=${token}&expires_in=${24 * 60 * 60}`;
          reply.redirect(frontendUrl.toString());
        }
      } catch (error) {
        fastify.log.error(error, 'OAuth callback error');
        
        if (error.statusCode) {
          throw error;
        }
        
        throw fastify.createError(400, 'Authentication failed');
      }
    },
  });

  // Get mock users (development only)
  fastify.get('/mock-users', {
    schema: {
      tags: ['Authentication'],
      description: 'List mock users for development',
      hide: process.env.NODE_ENV === 'production',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              username: { type: 'string' },
              email: { type: 'string' },
              fullName: { type: 'string' },
              roles: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      if (process.env.NODE_ENV === 'production') {
        throw fastify.createNotFoundError('Endpoint');
      }

      return fastify.oauth.getMockUsers();
    },
  });

  // Logout
  fastify.post('/logout', {
    schema: {
      tags: ['Authentication'],
      description: 'Logout user',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: fastify.authenticate,
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, ip_address, user_agent)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, 'LOGOUT', request.ip, request.headers['user-agent']]
        );

        fastify.log.info({ userId: user.userId, username: user.username }, 'User logged out');

        return { message: 'Logged out successfully' };
      } catch (error) {
        fastify.log.error(error, 'Logout error');
        throw fastify.createError(500, 'Logout failed');
      }
    },
  });

  // Get user profile
  fastify.get<{
    Reply: Static<typeof UserProfileSchema>;
  }>('/profile', {
    schema: {
      tags: ['Authentication'],
      description: 'Get current user profile',
      security: [{ bearerAuth: [] }],
      response: {
        200: UserProfileSchema,
      },
    },
    preHandler: fastify.authenticate,
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        // Get user details from database
        const userDetails = await fastify.dbUtils.queryOne(
          'SELECT id, username, email, full_name, roles, created_at FROM users WHERE id = $1',
          [user.userId]
        );

        if (!userDetails) {
          throw fastify.createNotFoundError('User');
        }

        return {
          id: userDetails.id,
          username: userDetails.username,
          email: userDetails.email,
          fullName: userDetails.full_name,
          roles: userDetails.roles,
          createdAt: userDetails.created_at,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get user profile');
        
        if (error.statusCode) {
          throw error;
        }
        
        throw fastify.createError(500, 'Failed to get user profile');
      }
    },
  });

  // Token validation endpoint
  fastify.post('/validate', {
    schema: {
      tags: ['Authentication'],
      description: 'Validate JWT token',
      body: {
        type: 'object',
        properties: {
          token: { type: 'string' },
        },
        required: ['token'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { token } = request.body as { token: string };

      try {
        const payload = await fastify.verifyToken(token);
        
        return {
          valid: true,
          user: {
            userId: payload.userId,
            username: payload.username,
            email: payload.email,
            roles: payload.roles,
          },
        };
      } catch (error) {
        return reply.status(401).send({
          valid: false,
          error: 'Invalid token',
        });
      }
    },
  });
};

export default authRoutes;
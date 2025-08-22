import { FastifyPluginAsync } from 'fastify';
import { Static } from '@sinclair/typebox';
import { AuthenticatedRequest } from '../types';
import { LoginResponseSchema, AuthCallbackQuerySchema, TokenResponseSchema } from '../schemas';

interface DevTokenRequestBody {
  username?: string;
  roles?: string[];
}

/**
 * OAuth authentication flow routes
 * These endpoints handle the OAuth flow and must remain at /api/auth
 * for compatibility with OAuth provider configuration
 *
 * Endpoints:
 * - POST /login - Initiate OAuth flow
 * - GET /callback - OAuth callback
 * - POST /logout - Logout user
 * - POST /validate - Validate JWT token
 * - GET /mock-login - Development only
 * - POST /dev-token - Development only
 * - GET /mock-users - Development only
 */
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
    handler: async (request, _reply) => {
      try {
        // Determine the callback URL that will be used
        const origin =
          request.headers.origin ||
          (request.headers.host ? `${request.protocol}://${request.headers.host}` : null);
        const callbackUrl = origin
          ? `${origin}/api/auth/callback`
          : fastify.config.OAUTH_CALLBACK_URL;

        // Store the callback URL with the state
        const state = fastify.oauthHelpers.generateAndStoreState(callbackUrl);
        const authUrl = fastify.oauth.generateAuthUrl(state, request);

        fastify.log.debug({ callbackUrl, state }, 'Generated auth URL with stored callback');

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
    handler: async (request, _reply) => {
      // Only allow in development or with explicit dev token environment variable
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_TOKENS) {
        throw fastify.createError(404, 'Endpoint not available');
      }

      const { username = 'developer', roles = ['admin', 'user'] } =
        request.body as DevTokenRequestBody;

      const user = {
        id: '550e8400-e29b-41d4-a716-446655440001', // Use the seeded frontend user ID
        username,
        email: `${username}@litemaas.local`,
        name: 'Development User',
        roles,
      };

      try {
        const accessToken = fastify.generateToken({
          userId: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
        });

        return {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 86400, // 24 hours
          user: {
            userId: user.id,
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
      // Use the origin from the request to support different environments
      const origin = request.headers.origin || `http://${request.headers.host}`;
      const callbackUrl = new URL('/api/auth/callback', origin);
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
        const tokenResponse = await fastify.oauth.exchangeCodeForToken(code, state, request);

        // Get user information
        const userInfo = await fastify.oauth.getUserInfo(tokenResponse.access_token);

        // Process user (create or update in database)
        const user = await fastify.oauth.processOAuthUser(userInfo);

        // Clear the state now that authentication is successful
        fastify.oauthHelpers.clearState(state);

        // Generate JWT token (even for mock mode)
        let token: string;

        // Check if this is a mock token (development mode)
        if (tokenResponse.access_token && tokenResponse.access_token.startsWith('mock_token_')) {
          fastify.log.debug(
            { userId: user.id, mockToken: tokenResponse.access_token },
            'Generating JWT for mock authentication',
          );

          // Generate proper JWT token for mock authentication
          token = fastify.generateToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles,
          });
        } else {
          // Generate JWT token for real OAuth flow
          token = fastify.generateToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles,
          });
        }

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            user.id,
            'LOGIN',
            'AUTH', // resource_type for authentication events
            request.ip,
            request.headers['user-agent'] ?? null,
            JSON.stringify({ oauth_provider: 'openshift', method: 'oauth' }),
          ],
        );

        fastify.log.info({ userId: user.id, username: user.username }, 'User logged in');

        // Redirect to frontend callback page with token in URL fragment (SPA)
        // Using relative redirect to work in any deployment environment
        const callbackPath = `/auth/callback#token=${token}&expires_in=${24 * 60 * 60}`;

        return reply.redirect(callbackPath);
      } catch (error) {
        fastify.log.error(error, 'OAuth callback error');

        if (error && typeof error === 'object' && 'statusCode' in error) {
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
    handler: async (_request, _reply) => {
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
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;

      try {
        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.userId, 'LOGOUT', 'AUTH', request.ip, request.headers['user-agent'] ?? null],
        );

        fastify.log.info({ userId: user.userId, username: user.username }, 'User logged out');

        return { message: 'Logged out successfully' };
      } catch (error) {
        fastify.log.error(error, 'Logout error');
        throw fastify.createError(500, 'Logout failed');
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

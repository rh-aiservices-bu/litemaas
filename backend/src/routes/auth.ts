import { FastifyPluginAsync } from 'fastify';
import { Static } from '@sinclair/typebox';
import { AuthenticatedRequest } from '../types';
import { LoginResponseSchema, AuthCallbackQuerySchema, TokenResponseSchema } from '../schemas';
import { ApplicationError } from '../utils/errors';

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
        // Always use the configured callback URL to ensure the redirect_uri matches
        // between the authorization request and the token exchange (OAuth2 spec requirement).
        const callbackUrl = fastify.config.OAUTH_CALLBACK_URL;

        // Single state: store callback URL first, then generate auth URL so the same state
        // is used in the redirect and the code_verifier we store matches the code_challenge in that URL.
        const state = fastify.oauthHelpers.generateAndStoreState(callbackUrl);
        const authResult = await fastify.oauth.generateAuthUrl(state);

        // Store the code verifier and nonce for this state (must match the auth URL we return)
        if (authResult.codeVerifier) {
          fastify.oauthHelpers.storeCodeVerifier(state, authResult.codeVerifier);
        }
        if (authResult.nonce) {
          fastify.oauthHelpers.storeNonce(state, authResult.nonce);
        }

        // Store the frontend origin so we can redirect back after OIDC callback.
        // In dev, frontend (:3000) and backend (:8081) are on different origins.
        // In prod behind a reverse proxy, they share the same origin.
        const frontendOrigin = request.headers.origin || request.headers.referer;
        if (frontendOrigin) {
          try {
            const origin = new URL(frontendOrigin).origin;
            fastify.oauthHelpers.storeFrontendOrigin(state, origin);
          } catch {
            // Invalid URL, skip — will use relative redirect
          }
        }

        fastify.log.debug(
          { callbackUrl, state, hasPKCE: !!authResult.codeVerifier, hasNonce: !!authResult.nonce },
          'Generated auth URL with stored callback',
        );

        return { authUrl: authResult.url };
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

      // Try to find a real user in the database by username or email
      const dbUser = await fastify.dbUtils.queryOne(
        `SELECT id, username, email, full_name, roles FROM users
         WHERE username = $1 OR email = $1
         LIMIT 1`,
        [username],
      );

      const user = dbUser
        ? {
            id: dbUser.id as string,
            username: (dbUser.username as string) || username,
            email: (dbUser.email as string) || `${username}@litemaas.local`,
            name: (dbUser.full_name as string) || username,
            roles: roles, // Use the requested roles (allows testing admin vs user)
          }
        : {
            id: '550e8400-e29b-41d4-a716-446655440001', // Fallback to seeded frontend user ID
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
        // Re-throw ApplicationError instances as-is
        if (error instanceof ApplicationError) {
          throw error;
        }
        // For other errors, include original message
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw fastify.createError(500, `Failed to generate token: ${errorMessage}`);
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

        // Retrieve code verifier for PKCE (OIDC only)
        const codeVerifier = fastify.oauthHelpers.getStoredCodeVerifier(state);
        const storedNonce = fastify.oauthHelpers.getStoredNonce(state);

        // Exchange authorization code for access token
        const tokenResponse = await fastify.oauth.exchangeCodeForToken(code, state, codeVerifier);

        // Validate ID token nonce and audience (OIDC only)
        fastify.oauth.validateIdToken(tokenResponse, storedNonce);

        // Get user information
        const userInfo = await fastify.oauth.getUserInfo(tokenResponse.access_token);

        // Process user (create or update in database)
        const user = await fastify.oauth.processOAuthUser(userInfo);

        // Read frontend origin before clearing state (for post-auth redirect)
        const storedFrontendOrigin = fastify.oauthHelpers.getStoredFrontendOrigin(state);

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
            JSON.stringify({ oauth_provider: fastify.oauth.getAuthProvider(), method: 'oauth' }),
          ],
        );

        fastify.log.info({ userId: user.id, username: user.username }, 'User logged in');

        // Redirect to frontend callback page with token in URL fragment (SPA)
        // Use stored frontend origin for cross-origin dev setups (e.g., frontend :3000, backend :8081).
        // Falls back to relative redirect for same-origin deployments (production behind reverse proxy).
        const callbackPath = `/auth/callback#token=${token}&expires_in=${24 * 60 * 60}`;
        const redirectUrl = storedFrontendOrigin ? `${storedFrontendOrigin}${callbackPath}` : callbackPath;

        return reply.redirect(redirectUrl);
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
            logoutUrl: { type: 'string', nullable: true },
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

        // Get OIDC logout URL if available
        const logoutUrl = await fastify.oauth.getLogoutUrl();

        return { message: 'Logged out successfully', logoutUrl };
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

// Admin auth info endpoint - registered separately at /api/v1/admin/auth/info
export const adminAuthInfoRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/info', {
    schema: {
      tags: ['Admin', 'Authentication'],
      description: 'Get authentication provider information (admin only)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            issuer: { type: 'string' },
            groupsClaim: { type: 'string' },
            discoveryStatus: { type: 'string', enum: ['healthy', 'not_applicable', 'unknown'] },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (_request, _reply) => {
      const provider = fastify.oauth.getAuthProvider();
      const issuer = fastify.config.OAUTH_ISSUER;
      const groupsClaim = fastify.config.OIDC_GROUPS_CLAIM;
      const discoveryStatus = await fastify.oauth.getDiscoveryStatus();

      // Extract domain only from issuer
      let issuerDomain = issuer;
      try {
        const url = new URL(issuer);
        issuerDomain = url.hostname;
      } catch {
        // If URL parsing fails, use as-is
      }

      return {
        provider,
        issuer: issuerDomain,
        groupsClaim,
        discoveryStatus,
      };
    },
  });
};

export default authRoutes;

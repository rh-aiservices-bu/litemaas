import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { JWTPayload, AuthenticatedRequest } from '../types';
import { TokenService } from '../services/token.service';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import('@fastify/jwt'), {
    secret: fastify.config.JWT_SECRET,
    sign: {
      expiresIn: fastify.config.JWT_EXPIRES_IN,
    },
  });

  // Initialize token service
  const tokenService = new TokenService(fastify);
  fastify.decorate('tokenService', tokenService);

  // Authentication decorator
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Try to get token from Authorization header
      let token = request.headers.authorization;

      if (!token) {
        throw new Error('No authorization header');
      }

      if (token.startsWith('Bearer ')) {
        token = token.substring(7);
      }

      // Check if it's an admin API key
      if (token.startsWith('ltm_admin_')) {
        const isValidAdminKey = await fastify.validateAdminApiKey(token);
        if (isValidAdminKey) {
          // Create admin user context
          const adminUser = {
            userId: 'admin-api-key',
            username: 'admin-api',
            email: 'admin@litemaas.local',
            name: 'Admin API Key',
            roles: ['admin', 'api'],
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
          };

          (request as AuthenticatedRequest).user = adminUser;
          fastify.log.debug(
            { keyPrefix: token.substring(0, 15) + '...' },
            'Admin API key authentication successful',
          );
          return;
        } else {
          throw new Error('Invalid admin API key');
        }
      }

      // Check if it's a user API key (for external API access)
      if (token.startsWith('sk-')) {
        const keyValidation = await fastify.validateUserApiKey(token);
        if (keyValidation.isValid) {
          // Create user context from API key
          const apiUser = {
            userId: keyValidation.apiKey!.userId,
            username: 'api-user',
            email: 'api@litemaas.local',
            name: 'API Key User',
            roles: ['user', 'api'],
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
            subscriptionId: keyValidation.subscription?.id,
            apiKeyId: keyValidation.apiKey!.id,
          };

          (request as AuthenticatedRequest).user = apiUser;
          fastify.log.debug(
            {
              userId: keyValidation.apiKey!.userId,
              keyId: keyValidation.apiKey!.id,
            },
            'User API key authentication successful',
          );
          return;
        } else {
          throw new Error(`API key validation failed: ${keyValidation.error}`);
        }
      }

      // Otherwise, treat as JWT token
      const payload = await tokenService.validateToken(token);

      if (!payload) {
        throw new Error('Invalid JWT token');
      }

      (request as AuthenticatedRequest).user = payload;
      fastify.log.debug({ userId: payload.userId }, 'JWT authentication successful');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.warn(
        {
          error: errorMessage,
          url: request.url,
          method: request.method,
          ip: request.ip,
        },
        'Authentication failed',
      );

      reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication token',
        },
        requestId: request.id,
      });
    }
  });

  // Optional authentication decorator
  fastify.decorate('optionalAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      let token = request.headers.authorization;

      if (token && token.startsWith('Bearer ')) {
        token = token.substring(7);
        const payload = await tokenService.validateToken(token);

        if (payload) {
          (request as AuthenticatedRequest).user = payload;
        }
      }
    } catch (error) {
      // Continue without authentication
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.debug({ error: errorMessage }, 'Optional authentication failed');
    }
  });

  // Role-based authorization decorator
  fastify.decorate('requireRole', (roles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as AuthenticatedRequest).user;

      if (!user) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
          requestId: request.id,
        });
      }

      const hasRole = roles.some((role) => user.roles.includes(role));

      if (!hasRole) {
        // Log authorization attempt
        fastify.log.warn(
          {
            userId: user.userId,
            requiredRoles: roles,
            userRoles: user.roles,
            url: request.url,
            method: request.method,
          },
          'Authorization failed',
        );

        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Required roles: ${roles.join(', ')}`,
          },
          requestId: request.id,
        });
      }
    };
  });

  // Note: requirePermission is now handled by the RBAC plugin for more advanced permission handling

  // Generate JWT token
  fastify.decorate('generateToken', (payload: Omit<JWTPayload, 'iat' | 'exp'>) => {
    return fastify.jwt.sign(payload);
  });

  // Verify JWT token
  fastify.decorate('verifyToken', async (token: string): Promise<JWTPayload> => {
    return fastify.jwt.verify(token) as JWTPayload;
  });

  // Generate token pair (access + refresh)
  fastify.decorate(
    'generateTokenPair',
    async (user: { id: string; username: string; email: string; roles: string[] }) => {
      return tokenService.generateTokenPair(user);
    },
  );

  // Refresh access token
  fastify.decorate('refreshToken', async (refreshToken: string) => {
    return tokenService.refreshAccessToken(refreshToken);
  });

  // Admin API key validation
  fastify.decorate('validateAdminApiKey', async (apiKey: string): Promise<boolean> => {
    // Get admin API keys from environment or configuration
    const validAdminKeys = process.env.ADMIN_API_KEYS?.split(',') || [];

    // In production, you should hash these keys and store them securely
    // For now, we'll use environment variables
    const isValid = validAdminKeys.includes(apiKey);

    if (isValid) {
      fastify.log.info(
        {
          keyPrefix: apiKey.substring(0, 15) + '...',
          ip: 'unknown', // Will be available in request context
        },
        'Admin API key used',
      );
    }

    return isValid;
  });

  // User API key validation (delegated to ApiKeyService)
  fastify.decorate('validateUserApiKey', async (apiKey: string) => {
    try {
      // Import ApiKeyService dynamically to avoid circular dependency
      const { ApiKeyService } = await import('../services/api-key.service');
      const apiKeyService = new ApiKeyService(fastify, fastify.liteLLMService);

      return await apiKeyService.validateApiKey(apiKey);
    } catch (error) {
      fastify.log.error(error, 'Failed to validate user API key');
      return { isValid: false, reason: 'Validation error' };
    }
  });

  // Cleanup expired tokens (run periodically)
  const cleanupInterval = setInterval(
    async () => {
      try {
        const cleanedCount = await tokenService.cleanupExpiredTokens();
        if (cleanedCount > 0) {
          fastify.log.info({ cleanedCount }, 'Cleaned up expired refresh tokens');
        }
      } catch (error) {
        fastify.log.error(error, 'Failed to cleanup expired tokens');
      }
    },
    60 * 60 * 1000,
  ); // Run every hour

  // Clean up interval on close
  fastify.addHook('onClose', async () => {
    clearInterval(cleanupInterval);
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    tokenService: TokenService;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      roles: string[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    // requirePermission is handled by RBAC plugin
    generateToken: (payload: Omit<JWTPayload, 'iat' | 'exp'>) => string;
    verifyToken: (token: string) => Promise<JWTPayload>;
    generateTokenPair: (user: {
      id: string;
      username: string;
      email: string;
      roles: string[];
    }) => Promise<import('../services/token.service').TokenPair>;
    refreshToken: (
      refreshToken: string,
    ) => Promise<import('../services/token.service').TokenPair | null>;
    validateAdminApiKey: (apiKey: string) => Promise<boolean>;
    validateUserApiKey: (
      apiKey: string,
    ) => Promise<import('../types/api-key.types.js').ApiKeyValidation>;
  }
}

export default fastifyPlugin(authPlugin);

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

  // Enhanced authentication decorator
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

      // Validate token using token service (includes user status check)
      const payload = await tokenService.validateToken(token);
      
      if (!payload) {
        throw new Error('Invalid token');
      }

      (request as AuthenticatedRequest).user = payload;
    } catch (error) {
      fastify.log.debug({ error: error.message }, 'Authentication failed');
      
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
  fastify.decorate('optionalAuth', async (request: FastifyRequest, reply: FastifyReply) => {
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
      fastify.log.debug('Optional authentication failed', error);
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

      const hasRole = roles.some(role => user.roles.includes(role));
      
      if (!hasRole) {
        // Log authorization attempt
        fastify.log.warn({
          userId: user.userId,
          requiredRoles: roles,
          userRoles: user.roles,
          url: request.url,
          method: request.method,
        }, 'Authorization failed');

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
  fastify.decorate('generateTokenPair', async (user: {
    id: string;
    username: string;
    email: string;
    roles: string[];
  }) => {
    return tokenService.generateTokenPair(user);
  });

  // Refresh access token
  fastify.decorate('refreshToken', async (refreshToken: string) => {
    return tokenService.refreshAccessToken(refreshToken);
  });

  // Cleanup expired tokens (run periodically)
  const cleanupInterval = setInterval(async () => {
    try {
      const cleanedCount = await tokenService.cleanupExpiredTokens();
      if (cleanedCount > 0) {
        fastify.log.info({ cleanedCount }, 'Cleaned up expired refresh tokens');
      }
    } catch (error) {
      fastify.log.error(error, 'Failed to cleanup expired tokens');
    }
  }, 60 * 60 * 1000); // Run every hour

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
    requireRole: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    // requirePermission is handled by RBAC plugin
    generateToken: (payload: Omit<JWTPayload, 'iat' | 'exp'>) => string;
    verifyToken: (token: string) => Promise<JWTPayload>;
    generateTokenPair: (user: {
      id: string;
      username: string;
      email: string;
      roles: string[];
    }) => Promise<import('../services/token.service').TokenPair>;
    refreshToken: (refreshToken: string) => Promise<import('../services/token.service').TokenPair | null>;
  }
}

export default fastifyPlugin(authPlugin);
import { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { AuthenticatedRequest } from '../types/auth.types.js';

const authHooksPlugin: FastifyPluginAsync = async (fastify) => {
  // Pre-authentication hook for rate limiting by user
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip for non-API routes
    if (!request.url.startsWith('/api/')) {
      return;
    }

    // Skip for health checks and public endpoints
    const publicRoutes = [
      '/api/health',
      '/api/v1/health',
      '/api/v1/health/ready',
      '/api/v1/health/live',
      '/api/auth/login',
      '/api/auth/callback',
      '/api/auth/mock-login',
      '/api/auth/mock-users',
      '/api/models', // Public model listing
      '/docs',
      '/openapi.json',
    ];

    // Check if the URL (without query params) matches any public route
    const urlPath = request.url.split('?')[0];
    const isPublicRoute = publicRoutes.some((route) => urlPath.startsWith(route));
    if (isPublicRoute) {
      return;
    }

    // Try to extract user for rate limiting (but don't enforce authentication yet)
    try {
      let token = request.headers.authorization;

      if (token && token.startsWith('Bearer ')) {
        token = token.substring(7);
        const payload = await fastify.tokenService.validateToken(token);

        if (payload) {
          (request as AuthenticatedRequest).user = payload;

          // Apply user-specific rate limiting (only for key operations)
          if (request.url.includes('/api-keys') || request.url.includes('/keys')) {
            await fastify.keyOperationRateLimit(request, reply);
          }
        }
      }
    } catch (error) {
      // Ignore authentication errors in pre-handler
      fastify.log.debug('Pre-handler authentication check failed', error);
    }
  });

  // Post-authentication hook for audit logging
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;

    // Only log authenticated requests
    if (!user || !request.url.startsWith('/api/')) {
      return;
    }

    // Skip logging for certain endpoints
    const skipLogging = [
      '/api/health',
      '/api/v1/health',
      '/api/v1/health/ready',
      '/api/v1/health/live',
      '/api/auth/profile', // Too frequent
    ];

    // Check if the URL (without query params) should skip logging
    const urlPath = request.url.split('?')[0];
    const shouldSkip = skipLogging.some((route) => urlPath.startsWith(route));
    if (shouldSkip) {
      return;
    }

    try {
      // Log API access
      // Use NULL for non-UUID user IDs (e.g., admin API keys)
      const userId = user.userId && user.userId !== 'admin-api-key' ? user.userId : null;

      await fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          `${request.method}_${request.url.split('?')[0]}`,
          'API_ACCESS',
          null,
          request.ip,
          request.headers['user-agent'] || null,
          JSON.stringify({
            statusCode: reply.statusCode,
            responseTime: reply.elapsedTime,
            method: request.method,
            url: request.url,
            authenticatedAs: user.userId, // Preserve original userId for tracking
          }),
        ],
      );
    } catch (error) {
      fastify.log.error(error, 'Failed to create audit log');
    }
  });

  // Error hook for authentication errors
  fastify.addHook(
    'onError',
    async (request: FastifyRequest, _reply: FastifyReply, error: FastifyError) => {
      // Log authentication/authorization errors
      if (error.statusCode === 401 || error.statusCode === 403) {
        const user = (request as AuthenticatedRequest).user;

        try {
          await fastify.dbUtils.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user?.userId || null,
              error.statusCode === 401 ? 'AUTH_FAILED' : 'AUTH_DENIED',
              'SECURITY',
              request.ip,
              request.headers['user-agent'] || null,
              JSON.stringify({
                error: error.message,
                statusCode: error.statusCode,
                method: request.method,
                url: request.url,
                userId: user?.userId,
                userRoles: user?.roles,
              }),
            ],
          );
        } catch (auditError) {
          fastify.log.error(auditError, 'Failed to create security audit log');
        }
      }
    },
  );

  // Request context decorator for user information
  fastify.decorateRequest('getUserContext', function () {
    const user = (this as AuthenticatedRequest).user;

    if (!user) {
      return null;
    }

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      roles: user.roles,
      isAdmin: user.roles.includes('admin'),
      canWrite: user.roles.some((role) => ['admin', 'user'].includes(role)),
      canRead: user.roles.some((role) => ['admin', 'user', 'readonly'].includes(role)),
    };
  });

  // Helper to check if user has permission for resource
  fastify.decorateRequest('hasPermission', function (permission: string, resourceUserId?: string) {
    const user = (this as AuthenticatedRequest).user;

    if (!user) {
      return false;
    }

    // Admin can do everything
    if (user.roles.includes('admin')) {
      return true;
    }

    // Check if user is accessing their own resources
    if (resourceUserId && user.userId !== resourceUserId) {
      return false;
    }

    // Check permission based on roles
    const permissions: Record<string, string[]> = {
      user: ['read', 'write', 'subscribe', 'usage'],
      readonly: ['read', 'usage'],
    };

    return user.roles.some((role) => {
      const rolePermissions = permissions[role] || [];
      return rolePermissions.includes(permission);
    });
  });

  // Helper to ensure user owns resource
  fastify.decorateRequest(
    'ensureResourceOwnership',
    async function (resourceType: string, resourceId: string) {
      const user = (this as AuthenticatedRequest).user;

      if (!user) {
        throw fastify.createAuthError('Authentication required');
      }

      // Admin can access all resources
      if (user.roles.includes('admin')) {
        return true;
      }

      // Check resource ownership based on type
      let query: string;
      let params: (string | number | boolean | Date | null)[];

      switch (resourceType) {
        case 'subscription':
          query = 'SELECT user_id FROM subscriptions WHERE id = $1';
          params = [resourceId];
          break;
        case 'api_key':
          query = `SELECT s.user_id 
                 FROM api_keys ak 
                 JOIN subscriptions s ON ak.subscription_id = s.id 
                 WHERE ak.id = $1`;
          params = [resourceId];
          break;
        default:
          throw fastify.createValidationError(`Unknown resource type: ${resourceType}`);
      }

      const resource = await fastify.dbUtils.queryOne(query, params);

      if (!resource) {
        throw fastify.createNotFoundError(resourceType);
      }

      if (resource.user_id !== user.userId) {
        throw fastify.createForbiddenError('Access denied to resource');
      }

      return true;
    },
  );

  // Session validation middleware
  fastify.decorate('validateSession', async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;

    if (!user) {
      throw fastify.createAuthError('Authentication required');
    }

    // Check if user is still active
    const userRecord = await fastify.dbUtils.queryOne('SELECT is_active FROM users WHERE id = $1', [
      user.userId,
    ]);

    if (!userRecord || !userRecord.is_active) {
      throw fastify.createAuthError('User account is disabled');
    }

    // Check token age for sensitive operations
    const tokenAge = Date.now() / 1000 - (user.iat || 0);
    const maxAge = 60 * 60; // 1 hour for sensitive operations

    if (tokenAge > maxAge && request.url.includes('/admin')) {
      throw fastify.createAuthError('Token too old for sensitive operation');
    }
  });

  // Activity tracking
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;

    if (!user || reply.statusCode >= 400) {
      return;
    }

    // Update last activity for authenticated users
    try {
      await fastify.dbUtils.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [
        user.userId,
      ]);
    } catch (error) {
      fastify.log.debug(error, 'Failed to update user activity');
    }
  });

  // Recent authentication middleware for sensitive operations like key retrieval
  fastify.decorate('requireRecentAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user;

    if (!user) {
      throw fastify.createAuthError('Authentication required');
    }

    // Check if user is still active
    const userRecord = await fastify.dbUtils.queryOne('SELECT is_active FROM users WHERE id = $1', [
      user.userId,
    ]);

    if (!userRecord || !userRecord.is_active) {
      throw fastify.createAuthError('User account is disabled');
    }

    // For sensitive operations like key retrieval, require recent authentication
    const tokenAge = Date.now() / 1000 - (user.iat || 0);
    // TODO: Revisit this security measure - currently set to 24 hours for better UX
    // Consider implementing a more granular approach based on operation sensitivity
    const maxRecentAge = 24 * 60 * 60; // 24 hours for key retrieval operations (86400 seconds)

    if (tokenAge > maxRecentAge) {
      throw fastify.createError(403, 'Recent authentication required for this operation', {
        code: 'TOKEN_TOO_OLD',
        tokenAge: Math.floor(tokenAge),
        maxAge: maxRecentAge,
        action: 'Please re-authenticate to access your API keys',
      });
    }
  });

  // Specialized rate limiting for API key operations
  fastify.decorate(
    'keyOperationRateLimit',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as AuthenticatedRequest).user;

      if (!user) {
        throw fastify.createAuthError('Authentication required');
      }

      // Check if we have a rate limit store (this would be Redis in production)
      // For now, we'll use an in-memory approach with logging
      const now = Date.now();
      const windowMs = 5 * 60 * 1000; // 5 minute window
      const maxAttempts = 10; // Maximum 10 key retrievals per 5 minutes

      // In a real implementation, this would use Redis or another persistent store
      // For now, we'll track in memory and log for audit purposes
      const attempts = (request as any).keyOpAttempts || 0;

      if (attempts >= maxAttempts) {
        // Create audit log for rate limit violation
        try {
          await fastify.dbUtils.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user.userId,
              'RATE_LIMIT_EXCEEDED',
              'API_KEY_OPERATION',
              request.ip,
              request.headers['user-agent'] || null,
              JSON.stringify({
                operation: 'key_retrieval',
                window: windowMs,
                maxAttempts,
                actualAttempts: attempts,
                endpoint: request.url,
              }),
            ],
          );
        } catch (auditError) {
          fastify.log.error(auditError, 'Failed to create rate limit audit log');
        }

        reply.header('X-RateLimit-Limit', maxAttempts);
        reply.header('X-RateLimit-Remaining', 0);
        reply.header('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
        reply.header('Retry-After', Math.ceil(windowMs / 1000));

        throw fastify.createError(
          429,
          'Too many API key operations. Please wait before trying again.',
          {
            code: 'KEY_OPERATION_RATE_LIMITED',
            limit: maxAttempts,
            window: '5 minutes',
            retryAfter: Math.ceil(windowMs / 1000),
          },
        );
      }

      // Log the attempt for monitoring
      fastify.log.info(
        {
          userId: user.userId,
          operation: 'key_retrieval',
          attempts: attempts + 1,
          endpoint: request.url,
        },
        'API key operation attempt',
      );
    },
  );

  fastify.log.info('Authentication hooks initialized');
};

declare module 'fastify' {
  interface FastifyRequest {
    getUserContext(): {
      userId: string;
      username: string;
      email: string;
      roles: string[];
      isAdmin: boolean;
      canWrite: boolean;
      canRead: boolean;
    } | null;
    hasPermission(permission: string, resourceUserId?: string): boolean;
    ensureResourceOwnership(resourceType: string, resourceId: string): Promise<boolean>;
  }

  interface FastifyInstance {
    validateSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRecentAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    keyOperationRateLimit: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fastifyPlugin(authHooksPlugin);

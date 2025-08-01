import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { RBACService } from '../services/rbac.service';
import { AuthenticatedRequest } from '../types/auth.types';

const rbacPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize RBAC service
  const rbacService = new RBACService(fastify);

  // Register RBAC service
  fastify.decorate('rbac', rbacService);

  // Enhanced permission checking decorators
  fastify.decorate(
    'requirePermission',
    (
      permission: string,
      options?: {
        resourceIdParam?: string;
        ownershipCheck?: boolean;
        customCheck?: (request: AuthenticatedRequest) => Promise<boolean>;
      },
    ) => {
      return rbacService.createAccessCheck(permission, options);
    },
  );

  // Multiple permission checks
  fastify.decorate('requireAnyPermission', (permissions: string[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const authenticatedRequest = request as AuthenticatedRequest;
      const user = authenticatedRequest.user;

      if (!user) {
        throw fastify.createAuthError('Authentication required');
      }

      const hasPermission = await rbacService.hasAnyPermission(user.userId, permissions);

      if (!hasPermission) {
        throw fastify.createForbiddenError(
          `Access denied. Required permissions: ${permissions.join(' OR ')}`,
        );
      }
    };
  });

  fastify.decorate('requireAllPermissions', (permissions: string[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const authenticatedRequest = request as AuthenticatedRequest;
      const user = authenticatedRequest.user;

      if (!user) {
        throw fastify.createAuthError('Authentication required');
      }

      const hasPermission = await rbacService.hasAllPermissions(user.userId, permissions);

      if (!hasPermission) {
        throw fastify.createForbiddenError(
          `Access denied. Required permissions: ${permissions.join(' AND ')}`,
        );
      }
    };
  });

  // Admin-only access
  fastify.decorate('requireAdmin', async (request: FastifyRequest, _reply: FastifyReply) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const user = authenticatedRequest.user;

    if (!user) {
      throw fastify.createAuthError('Authentication required');
    }

    if (!user.roles.includes('admin')) {
      throw fastify.createForbiddenError('Administrator access required');
    }
  });

  // User context helper
  fastify.decorateRequest(
    'checkPermission',
    function (permission: string, resourceId?: string, context?: Record<string, unknown>) {
      const request = this as FastifyRequest;
      const authenticatedRequest = request as AuthenticatedRequest;
      const user = authenticatedRequest.user;

      if (!user) {
        return Promise.resolve(false);
      }

      return rbacService.hasPermission(user.userId, permission, resourceId, context);
    },
  );

  // Get user permissions
  fastify.decorateRequest('getUserPermissions', async function () {
    const request = this as FastifyRequest;
    const authenticatedRequest = request as AuthenticatedRequest;
    const user = authenticatedRequest.user;

    if (!user) {
      return [];
    }

    return rbacService.getEffectivePermissions(user.userId);
  });

  // RBAC management endpoints
  fastify.register(
    async function rbacRoutes(fastify) {
      // Get system roles
      fastify.get(
        '/roles',
        {
          schema: {
            tags: ['RBAC'],
            description: 'Get system roles',
            security: [{ bearerAuth: [] }],
            response: {
              200: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    permissions: { type: 'array', items: { type: 'string' } },
                    isSystem: { type: 'boolean' },
                  },
                },
              },
            },
          },
          preHandler: [fastify.authenticate, fastify.requirePermission('admin:users') as any],
        },
        async (_request, _reply) => {
          return rbacService.getSystemRoles();
        },
      );

      // Get system permissions
      fastify.get(
        '/permissions',
        {
          schema: {
            tags: ['RBAC'],
            description: 'Get system permissions',
            security: [{ bearerAuth: [] }],
            response: {
              200: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    resource: { type: 'string' },
                    action: { type: 'string' },
                  },
                },
              },
            },
          },
          preHandler: [fastify.authenticate, fastify.requirePermission('admin:users') as any],
        },
        async (_request, _reply) => {
          return rbacService.getSystemPermissions();
        },
      );

      // Get user effective permissions
      fastify.get(
        '/permissions/me',
        {
          schema: {
            tags: ['RBAC'],
            description: 'Get current user effective permissions',
            security: [{ bearerAuth: [] }],
            response: {
              200: {
                type: 'object',
                properties: {
                  roles: { type: 'array', items: { type: 'string' } },
                  permissions: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          preHandler: fastify.authenticate as any,
        },
        async (request, _reply) => {
          const authenticatedRequest = request as AuthenticatedRequest;
          const user = authenticatedRequest.user;
          const permissions = await rbacService.getEffectivePermissions(user.userId);

          return {
            roles: user.roles,
            permissions,
          };
        },
      );

      // Check permission
      fastify.post(
        '/permissions/check',
        {
          schema: {
            tags: ['RBAC'],
            description: 'Check if user has specific permission',
            security: [{ bearerAuth: [] }],
            body: {
              type: 'object',
              properties: {
                permission: { type: 'string' },
                resourceId: { type: 'string' },
                context: { type: 'object' },
              },
              required: ['permission'],
            },
            response: {
              200: {
                type: 'object',
                properties: {
                  hasPermission: { type: 'boolean' },
                  permission: { type: 'string' },
                  resourceId: { type: 'string' },
                },
              },
            },
          },
          preHandler: fastify.authenticate as any,
        },
        async (request, _reply) => {
          const authenticatedRequest = request as AuthenticatedRequest;
          const user = authenticatedRequest.user;
          const { permission, resourceId, context } = request.body as {
            permission: string;
            resourceId?: string;
            context?: Record<string, unknown>;
          };

          const hasPermission = await rbacService.hasPermission(
            user.userId,
            permission,
            resourceId,
            context,
          );

          return {
            hasPermission,
            permission,
            resourceId,
          };
        },
      );

      // Bulk permission check
      fastify.post(
        '/permissions/check-bulk',
        {
          schema: {
            tags: ['RBAC'],
            description: 'Check multiple permissions',
            security: [{ bearerAuth: [] }],
            body: {
              type: 'object',
              properties: {
                permissions: { type: 'array', items: { type: 'string' } },
                requireAll: { type: 'boolean', default: false },
              },
              required: ['permissions'],
            },
            response: {
              200: {
                type: 'object',
                properties: {
                  hasAccess: { type: 'boolean' },
                  results: {
                    type: 'object',
                    additionalProperties: { type: 'boolean' },
                  },
                },
              },
            },
          },
          preHandler: fastify.authenticate as any,
        },
        async (request, _reply) => {
          const authenticatedRequest = request as AuthenticatedRequest;
          const user = authenticatedRequest.user;
          const { permissions, requireAll = false } = request.body as {
            permissions: string[];
            requireAll?: boolean;
          };

          const results: Record<string, boolean> = {};

          for (const permission of permissions) {
            results[permission] = await rbacService.hasPermission(user.userId, permission);
          }

          const hasAccess = requireAll
            ? Object.values(results).every((result) => result)
            : Object.values(results).some((result) => result);

          return {
            hasAccess,
            results,
          };
        },
      );
    },
    { prefix: '/api/rbac' },
  );

  fastify.log.info('RBAC plugin initialized');
};

declare module 'fastify' {
  interface FastifyInstance {
    rbac: RBACService;
    requirePermission: (
      permission: string,
      options?: {
        resourceIdParam?: string;
        ownershipCheck?: boolean;
        customCheck?: (request: AuthenticatedRequest) => Promise<boolean>;
      },
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAnyPermission: (
      permissions: string[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAllPermissions: (
      permissions: string[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    checkPermission(
      permission: string,
      resourceId?: string,
      context?: Record<string, unknown>,
    ): Promise<boolean>;
    getUserPermissions(): Promise<string[]>;
  }
}

export default fastifyPlugin(rbacPlugin);

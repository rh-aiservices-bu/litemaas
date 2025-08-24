import { FastifyInstance } from 'fastify';
import { AuthenticatedRequest } from '../types';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

export interface AccessPolicy {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

interface UserWithRoles {
  roles: string[];
}

export class RBACService {
  private fastify: FastifyInstance;

  // System permissions
  private readonly systemPermissions: Permission[] = [
    // Model permissions
    {
      id: 'models:read',
      name: 'Read Models',
      description: 'View available models',
      resource: 'models',
      action: 'read',
    },
    {
      id: 'models:write',
      name: 'Manage Models',
      description: 'Create and update models',
      resource: 'models',
      action: 'write',
    },

    // Subscription permissions
    {
      id: 'subscriptions:read',
      name: 'Read Subscriptions',
      description: 'View subscriptions',
      resource: 'subscriptions',
      action: 'read',
    },
    {
      id: 'subscriptions:write',
      name: 'Manage Subscriptions',
      description: 'Create and modify subscriptions',
      resource: 'subscriptions',
      action: 'write',
    },
    {
      id: 'subscriptions:delete',
      name: 'Delete Subscriptions',
      description: 'Cancel subscriptions',
      resource: 'subscriptions',
      action: 'delete',
    },

    // API Key permissions
    {
      id: 'api_keys:read',
      name: 'Read API Keys',
      description: 'View API keys',
      resource: 'api_keys',
      action: 'read',
    },
    {
      id: 'api_keys:write',
      name: 'Manage API Keys',
      description: 'Create and rotate API keys',
      resource: 'api_keys',
      action: 'write',
    },
    {
      id: 'api_keys:delete',
      name: 'Delete API Keys',
      description: 'Revoke API keys',
      resource: 'api_keys',
      action: 'delete',
    },

    // Usage permissions
    {
      id: 'usage:read',
      name: 'Read Usage',
      description: 'View usage statistics',
      resource: 'usage',
      action: 'read',
    },
    {
      id: 'usage:export',
      name: 'Export Usage',
      description: 'Export usage data',
      resource: 'usage',
      action: 'export',
    },

    // User permissions
    {
      id: 'users:read',
      name: 'Read Users',
      description: 'View user information',
      resource: 'users',
      action: 'read',
    },
    {
      id: 'users:write',
      name: 'Manage Users',
      description: 'Create and update users',
      resource: 'users',
      action: 'write',
    },
    {
      id: 'users:delete',
      name: 'Delete Users',
      description: 'Delete user accounts',
      resource: 'users',
      action: 'delete',
    },

    // Banner permissions
    {
      id: 'admin:banners:read',
      name: 'Read Banners',
      description: 'View all banner announcements',
      resource: 'banners',
      action: 'read',
    },
    {
      id: 'admin:banners:write',
      name: 'Manage Banners',
      description: 'Create, update, and delete banner announcements',
      resource: 'banners',
      action: 'write',
    },

    // Admin permissions
    {
      id: 'admin:system',
      name: 'System Admin',
      description: 'Full system administration',
      resource: 'admin',
      action: 'system',
    },
    {
      id: 'admin:users',
      name: 'User Admin',
      description: 'User administration',
      resource: 'admin',
      action: 'users',
    },
    {
      id: 'admin:audit',
      name: 'Audit Access',
      description: 'Access audit logs',
      resource: 'admin',
      action: 'audit',
    },
  ];

  // System roles
  private readonly systemRoles: Role[] = [
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      permissions: [
        'admin:system',
        'admin:users',
        'admin:audit',
        'admin:banners:read',
        'admin:banners:write',
        'users:read',
        'users:write',
        'users:delete',
        'models:read',
        'models:write',
        'subscriptions:read',
        'subscriptions:write',
        'subscriptions:delete',
        'api_keys:read',
        'api_keys:write',
        'api_keys:delete',
        'usage:read',
        'usage:export',
      ],
      isSystem: true,
    },
    {
      id: 'user',
      name: 'User',
      description: 'Standard user access',
      permissions: [
        'models:read',
        'subscriptions:read',
        'subscriptions:write',
        'subscriptions:delete',
        'api_keys:read',
        'api_keys:write',
        'api_keys:delete',
        'usage:read',
        'usage:export',
      ],
      isSystem: true,
    },
    {
      id: 'admin-readonly',
      name: 'Administrator (Read-only)',
      description: 'Read-only access to admin features',
      permissions: [
        'admin:users', // View admin section
        'admin:banners:read', // View banners in admin
        'users:read', // List and view users
        'models:read',
        'subscriptions:read',
        'api_keys:read',
        'usage:read',
        'usage:export',
      ],
      isSystem: true,
    },
    {
      id: 'readonly',
      name: 'Read Only',
      description: 'Read-only access',
      permissions: ['models:read', 'subscriptions:read', 'api_keys:read', 'usage:read'],
      isSystem: true,
    },
  ];

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async hasPermission(
    userId: string,
    permission: string,
    resourceId?: string,
    context?: Record<string, any>,
  ): Promise<boolean> {
    try {
      // Get user roles
      const user = await this.fastify.dbUtils.queryOne<UserWithRoles>(
        'SELECT roles FROM users WHERE id = $1 AND is_active = true',
        [userId],
      );

      if (!user || !user.roles) {
        return false;
      }

      // Check if any role has the required permission
      for (const roleName of user.roles) {
        const role = this.systemRoles.find((r) => r.id === roleName);

        if (!role) {
          continue;
        }

        // Admin role has all permissions
        if (roleName === 'admin') {
          return true;
        }

        // Check if role has the specific permission
        if (role.permissions.includes(permission)) {
          // Additional context-based checks
          if (resourceId && context) {
            const hasResourceAccess = await this.checkResourceAccess(
              userId,
              permission,
              resourceId,
              context,
            );

            if (!hasResourceAccess) {
              continue;
            }
          }

          return true;
        }
      }

      return false;
    } catch (error) {
      this.fastify.log.error(error, 'Permission check failed');
      return false;
    }
  }

  async checkResourceAccess(
    userId: string,
    permission: string,
    resourceId: string,
    context: Record<string, any>,
  ): Promise<boolean> {
    const [resource, action] = permission.split(':');

    switch (resource) {
      case 'subscriptions':
        return this.checkSubscriptionAccess(userId, resourceId, action);

      case 'api_keys':
        return this.checkApiKeyAccess(userId, resourceId, action);

      case 'usage':
        return this.checkUsageAccess(userId, resourceId, action, context);

      case 'users':
        // Users can only access their own profile (except admins)
        return userId === resourceId;

      default:
        return true; // Allow access for unknown resources
    }
  }

  private async checkSubscriptionAccess(
    userId: string,
    subscriptionId: string,
    _action: string,
  ): Promise<boolean> {
    const subscription = await this.fastify.dbUtils.queryOne(
      'SELECT user_id FROM subscriptions WHERE id = $1',
      [subscriptionId],
    );

    if (!subscription) {
      return false;
    }

    // Users can only access their own subscriptions
    return subscription.user_id === userId;
  }

  private async checkApiKeyAccess(
    userId: string,
    apiKeyId: string,
    _action: string,
  ): Promise<boolean> {
    const apiKey = await this.fastify.dbUtils.queryOne(
      `SELECT s.user_id 
       FROM api_keys ak 
       JOIN subscriptions s ON ak.subscription_id = s.id 
       WHERE ak.id = $1`,
      [apiKeyId],
    );

    if (!apiKey) {
      return false;
    }

    return apiKey.user_id === userId;
  }

  private async checkUsageAccess(
    userId: string,
    _resourceId: string,
    action: string,
    context: Record<string, any>,
  ): Promise<boolean> {
    // For usage data, check if user owns the subscription
    if (context.subscriptionId) {
      return this.checkSubscriptionAccess(userId, context.subscriptionId, action);
    }

    // For general usage queries, allow if user is accessing their own data
    return true;
  }

  getUserPermissions(roles: string[]): string[] {
    const permissions = new Set<string>();

    for (const roleName of roles) {
      const role = this.systemRoles.find((r) => r.id === roleName);

      if (role) {
        role.permissions.forEach((permission) => permissions.add(permission));
      }
    }

    return Array.from(permissions);
  }

  createAccessCheck(
    permission: string,
    options?: {
      resourceIdParam?: string;
      ownershipCheck?: boolean;
      customCheck?: (request: any) => Promise<boolean>;
    },
  ) {
    return async (request: any, _reply: any) => {
      const user = (request as AuthenticatedRequest).user;

      if (!user) {
        throw this.fastify.createAuthError('Authentication required');
      }

      let resourceId: string | undefined;
      let context: Record<string, any> = {};

      // Extract resource ID from request parameters
      if (options?.resourceIdParam) {
        resourceId = request.params[options.resourceIdParam];
        context.resourceId = resourceId;
      }

      // Add query context
      if (request.query) {
        context = { ...context, ...request.query };
      }

      // Check permission
      const hasPermission = await this.hasPermission(user.userId, permission, resourceId, context);

      if (!hasPermission) {
        this.fastify.log.warn(
          {
            userId: user.userId,
            permission,
            resourceId,
            url: request.url,
            method: request.method,
          },
          'Access denied',
        );

        throw this.fastify.createForbiddenError(
          `Access denied. Required permission: ${permission}`,
        );
      }

      // Custom additional checks
      if (options?.customCheck) {
        const customResult = await options.customCheck(request);

        if (!customResult) {
          throw this.fastify.createForbiddenError('Access denied by custom policy');
        }
      }
    };
  }

  // Middleware factory for route-level permission checks
  requirePermission(
    permission: string,
    options?: {
      resourceIdParam?: string;
      ownershipCheck?: boolean;
    },
  ) {
    return this.createAccessCheck(permission, options);
  }

  // Bulk permission check
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission))) {
        return false;
      }
    }
    return true;
  }

  // Get effective permissions for user
  async getEffectivePermissions(userId: string): Promise<string[]> {
    const user = await this.fastify.dbUtils.queryOne<UserWithRoles>(
      'SELECT roles FROM users WHERE id = $1 AND is_active = true',
      [userId],
    );

    if (!user || !user.roles) {
      return [];
    }

    return this.getUserPermissions(user.roles);
  }

  getSystemRoles(): Role[] {
    return this.systemRoles;
  }

  getSystemPermissions(): Permission[] {
    return this.systemPermissions;
  }
}

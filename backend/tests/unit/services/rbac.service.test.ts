import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RBACService } from '../../../src/services/rbac.service';
import type { FastifyInstance } from 'fastify';
import { mockUser } from '../../setup';

describe('RBACService', () => {
  let service: RBACService;
  let mockFastify: Partial<FastifyInstance>;

  const mockUserWithRoles = (roles: string[]) => ({
    id: mockUser.id,
    roles: roles,
  });

  beforeEach(() => {
    mockFastify = {
      dbUtils: {
        queryOne: vi.fn(),
        queryMany: vi.fn(),
        query: vi.fn(),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      createAuthError: vi.fn((message) => new Error(message)),
      createForbiddenError: vi.fn((message) => new Error(message)),
    } as Partial<FastifyInstance>;

    service = new RBACService(mockFastify as FastifyInstance);
  });

  describe('System Roles', () => {
    it('should include all required system roles', () => {
      const roles = service.getSystemRoles();
      const roleIds = roles.map((r) => r.id);

      expect(roleIds).toContain('admin');
      expect(roleIds).toContain('admin-readonly');
      expect(roleIds).toContain('user');
      expect(roleIds).toContain('readonly');
    });

    it('should have correct admin-readonly role configuration', () => {
      const roles = service.getSystemRoles();
      const adminReadonlyRole = roles.find((r) => r.id === 'admin-readonly');

      expect(adminReadonlyRole).toBeDefined();
      expect(adminReadonlyRole!.name).toBe('Administrator (Read-only)');
      expect(adminReadonlyRole!.description).toBe('Read-only access to admin features');
      expect(adminReadonlyRole!.isSystem).toBe(true);
      expect(adminReadonlyRole!.permissions).toEqual([
        'admin:users',
        'admin:banners:read',
        'users:read',
        'models:read',
        'subscriptions:read',
        'api_keys:read',
        'usage:read',
        'usage:export',
      ]);
    });

    it('should not include write permissions in admin-readonly role', () => {
      const roles = service.getSystemRoles();
      const adminReadonlyRole = roles.find((r) => r.id === 'admin-readonly');

      const writePermissions = [
        'users:write',
        'users:delete',
        'models:write',
        'subscriptions:write',
        'subscriptions:delete',
        'api_keys:write',
        'api_keys:delete',
        'admin:system',
        'admin:audit',
      ];

      writePermissions.forEach((permission) => {
        expect(adminReadonlyRole!.permissions).not.toContain(permission);
      });
    });
  });

  describe('hasPermission', () => {
    describe('admin-readonly role permissions', () => {
      beforeEach(() => {
        mockFastify.dbUtils!.queryOne = vi
          .fn()
          .mockResolvedValue(mockUserWithRoles(['admin-readonly']));
      });

      it('should allow admin:users permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'admin:users');
        expect(result).toBe(true);
      });

      it('should allow users:read permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'users:read');
        expect(result).toBe(true);
      });

      it('should allow models:read permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'models:read');
        expect(result).toBe(true);
      });

      it('should allow subscriptions:read permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'subscriptions:read');
        expect(result).toBe(true);
      });

      it('should allow api_keys:read permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'api_keys:read');
        expect(result).toBe(true);
      });

      it('should allow usage:read permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'usage:read');
        expect(result).toBe(true);
      });

      it('should allow usage:export permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'usage:export');
        expect(result).toBe(true);
      });

      it('should deny users:write permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'users:write');
        expect(result).toBe(false);
      });

      it('should deny users:delete permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'users:delete');
        expect(result).toBe(false);
      });

      it('should deny models:write permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'models:write');
        expect(result).toBe(false);
      });

      it('should deny subscriptions:write permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'subscriptions:write');
        expect(result).toBe(false);
      });

      it('should deny subscriptions:delete permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'subscriptions:delete');
        expect(result).toBe(false);
      });

      it('should deny api_keys:write permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'api_keys:write');
        expect(result).toBe(false);
      });

      it('should deny api_keys:delete permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'api_keys:delete');
        expect(result).toBe(false);
      });

      it('should deny admin:system permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'admin:system');
        expect(result).toBe(false);
      });

      it('should deny admin:audit permission', async () => {
        const result = await service.hasPermission(mockUser.id, 'admin:audit');
        expect(result).toBe(false);
      });
    });

    describe('admin role permissions (comparison)', () => {
      beforeEach(() => {
        mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue(mockUserWithRoles(['admin']));
      });

      it('should allow all permissions for admin role', async () => {
        const result = await service.hasPermission(mockUser.id, 'users:delete');
        expect(result).toBe(true);
      });

      it('should allow admin:system for admin role', async () => {
        const result = await service.hasPermission(mockUser.id, 'admin:system');
        expect(result).toBe(true);
      });
    });

    describe('user role permissions (comparison)', () => {
      beforeEach(() => {
        mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue(mockUserWithRoles(['user']));
      });

      it('should deny admin:users for regular user', async () => {
        const result = await service.hasPermission(mockUser.id, 'admin:users');
        expect(result).toBe(false);
      });

      it('should deny users:read for regular user', async () => {
        const result = await service.hasPermission(mockUser.id, 'users:read');
        expect(result).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should return false when user not found', async () => {
        mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue(null);

        const result = await service.hasPermission(mockUser.id, 'admin:users');
        expect(result).toBe(false);
      });

      it('should return false when user has no roles', async () => {
        mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue({ id: mockUser.id, roles: null });

        const result = await service.hasPermission(mockUser.id, 'admin:users');
        expect(result).toBe(false);
      });

      it('should handle database errors gracefully', async () => {
        mockFastify.dbUtils!.queryOne = vi.fn().mockRejectedValue(new Error('DB Error'));

        const result = await service.hasPermission(mockUser.id, 'admin:users');
        expect(result).toBe(false);
        expect(mockFastify.log!.error).toHaveBeenCalled();
      });
    });
  });

  describe('getUserPermissions', () => {
    it('should return correct permissions for admin-readonly role', () => {
      const permissions = service.getUserPermissions(['admin-readonly']);

      expect(permissions).toContain('admin:users');
      expect(permissions).toContain('users:read');
      expect(permissions).toContain('models:read');
      expect(permissions).toContain('subscriptions:read');
      expect(permissions).toContain('api_keys:read');
      expect(permissions).toContain('usage:read');
      expect(permissions).toContain('usage:export');

      expect(permissions).not.toContain('users:write');
      expect(permissions).not.toContain('users:delete');
      expect(permissions).not.toContain('admin:system');
    });

    it('should combine permissions from multiple roles', () => {
      const permissions = service.getUserPermissions(['admin-readonly', 'user']);

      // Should have admin-readonly permissions
      expect(permissions).toContain('admin:users');
      expect(permissions).toContain('users:read');

      // Should have user permissions
      expect(permissions).toContain('subscriptions:write');
      expect(permissions).toContain('api_keys:write');

      // Should not have duplicates
      const uniquePermissions = [...new Set(permissions)];
      expect(permissions.length).toBe(uniquePermissions.length);
    });

    it('should return empty array for invalid roles', () => {
      const permissions = service.getUserPermissions(['invalid-role']);
      expect(permissions).toEqual([]);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should return effective permissions for user with admin-readonly role', async () => {
      mockFastify.dbUtils!.queryOne = vi
        .fn()
        .mockResolvedValue(mockUserWithRoles(['admin-readonly']));

      const permissions = await service.getEffectivePermissions(mockUser.id);

      expect(permissions).toContain('admin:users');
      expect(permissions).toContain('users:read');
      expect(permissions).not.toContain('users:write');
    });

    it('should return empty array for user with no roles', async () => {
      mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue({ id: mockUser.id, roles: null });

      const permissions = await service.getEffectivePermissions(mockUser.id);
      expect(permissions).toEqual([]);
    });

    it('should return empty array for non-existent user', async () => {
      mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue(null);

      const permissions = await service.getEffectivePermissions(mockUser.id);
      expect(permissions).toEqual([]);
    });
  });

  describe('hasAnyPermission', () => {
    beforeEach(() => {
      mockFastify.dbUtils!.queryOne = vi
        .fn()
        .mockResolvedValue(mockUserWithRoles(['admin-readonly']));
    });

    it('should return true when user has at least one of the requested permissions', async () => {
      const result = await service.hasAnyPermission(mockUser.id, [
        'users:write', // admin-readonly doesn't have this
        'admin:users', // admin-readonly has this
        'admin:system', // admin-readonly doesn't have this
      ]);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the requested permissions', async () => {
      const result = await service.hasAnyPermission(mockUser.id, [
        'users:write',
        'users:delete',
        'admin:system',
      ]);

      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    beforeEach(() => {
      mockFastify.dbUtils!.queryOne = vi
        .fn()
        .mockResolvedValue(mockUserWithRoles(['admin-readonly']));
    });

    it('should return true when user has all requested permissions', async () => {
      const result = await service.hasAllPermissions(mockUser.id, [
        'admin:users',
        'users:read',
        'usage:read',
      ]);

      expect(result).toBe(true);
    });

    it('should return false when user is missing any of the requested permissions', async () => {
      const result = await service.hasAllPermissions(mockUser.id, [
        'admin:users', // has this
        'users:write', // doesn't have this
      ]);

      expect(result).toBe(false);
    });
  });

  describe('createAccessCheck', () => {
    it('should create middleware that allows access for admin-readonly with correct permissions', async () => {
      mockFastify.dbUtils!.queryOne = vi
        .fn()
        .mockResolvedValue(mockUserWithRoles(['admin-readonly']));

      const middleware = service.createAccessCheck('admin:users');
      const mockRequest = { user: { userId: mockUser.id } };
      const mockReply = {};

      await expect(middleware(mockRequest, mockReply)).resolves.toBeUndefined();
    });

    it('should create middleware that denies access for admin-readonly without correct permissions', async () => {
      mockFastify.dbUtils!.queryOne = vi
        .fn()
        .mockResolvedValue(mockUserWithRoles(['admin-readonly']));

      const middleware = service.createAccessCheck('users:write');
      const mockRequest = { user: { userId: mockUser.id } };
      const mockReply = {};

      await expect(middleware(mockRequest, mockReply)).rejects.toThrow(
        'Access denied. Required permission: users:write',
      );
    });

    it('should create middleware that denies access for unauthenticated requests', async () => {
      const middleware = service.createAccessCheck('admin:users');
      const mockRequest = {}; // No user
      const mockReply = {};

      await expect(middleware(mockRequest, mockReply)).rejects.toThrow('Authentication required');
    });
  });

  describe('Integration with existing permission system', () => {
    it('should maintain backward compatibility with existing roles', () => {
      const roles = service.getSystemRoles();

      // Ensure all existing roles are still present
      expect(roles.find((r) => r.id === 'admin')).toBeDefined();
      expect(roles.find((r) => r.id === 'user')).toBeDefined();
      expect(roles.find((r) => r.id === 'readonly')).toBeDefined();

      // Ensure existing role permissions are unchanged
      const adminRole = roles.find((r) => r.id === 'admin');
      expect(adminRole!.permissions).toContain('admin:system');

      const userRole = roles.find((r) => r.id === 'user');
      expect(userRole!.permissions).toContain('subscriptions:write');

      const readonlyRole = roles.find((r) => r.id === 'readonly');
      expect(readonlyRole!.permissions).not.toContain('admin:users');
    });

    it('should properly differentiate admin-readonly from regular readonly role', () => {
      const roles = service.getSystemRoles();
      const adminReadonly = roles.find((r) => r.id === 'admin-readonly');
      const readonly = roles.find((r) => r.id === 'readonly');

      // admin-readonly should have admin access
      expect(adminReadonly!.permissions).toContain('admin:users');
      expect(adminReadonly!.permissions).toContain('users:read');

      // readonly should not have admin access
      expect(readonly!.permissions).not.toContain('admin:users');
      expect(readonly!.permissions).not.toContain('users:read');

      // Both should have read permissions for resources
      expect(adminReadonly!.permissions).toContain('models:read');
      expect(readonly!.permissions).toContain('models:read');
    });
  });
});

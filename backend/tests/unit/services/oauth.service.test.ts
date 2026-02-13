import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthService } from '../../../src/services/oauth.service.js';
import { FastifyInstance } from 'fastify';

// Mock Fastify instance
const createMockFastify = (configOverrides: Record<string, unknown> = {}) =>
  ({
    dbUtils: {
      queryOne: vi.fn(),
      query: vi.fn(),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    config: { ...configOverrides },
  }) as unknown as FastifyInstance;

describe('OAuthService', () => {
  let service: OAuthService;
  let mockFastify: FastifyInstance;
  let mockLiteLLMService: any;
  let mockDefaultTeamService: any;

  beforeEach(() => {
    mockFastify = createMockFastify();
    mockLiteLLMService = {
      createUser: vi.fn(),
    };
    mockDefaultTeamService = {
      ensureUserMembership: vi.fn(),
    };

    service = new OAuthService(mockFastify, mockLiteLLMService, mockDefaultTeamService);
  });

  describe('mapGroupsToRoles', () => {
    it('should map litemaas-admins to admin and user roles', () => {
      // Access private method for testing
      const result = (service as any).mapGroupsToRoles(['litemaas-admins']);
      expect(result).toEqual(['user', 'admin']);
    });

    it('should map litemaas-readonly to admin-readonly and user roles', () => {
      const result = (service as any).mapGroupsToRoles(['litemaas-readonly']);
      expect(result).toEqual(['user', 'admin-readonly']);
    });

    it('should map litemaas-users to user role only', () => {
      const result = (service as any).mapGroupsToRoles(['litemaas-users']);
      expect(result).toEqual(['user']);
    });

    it('should handle multiple groups correctly', () => {
      const result = (service as any).mapGroupsToRoles(['litemaas-admins', 'litemaas-readonly']);
      expect(result).toContain('user');
      expect(result).toContain('admin');
      expect(result).toContain('admin-readonly');
      expect(result).toHaveLength(3);
    });

    it('should return user role for unknown groups', () => {
      const result = (service as any).mapGroupsToRoles(['unknown-group']);
      expect(result).toEqual(['user']);
    });

    it('should return user role for empty groups array', () => {
      const result = (service as any).mapGroupsToRoles([]);
      expect(result).toEqual(['user']);
    });

    it('should always include user role as base', () => {
      const testCases = [
        ['litemaas-admins'],
        ['litemaas-readonly'],
        ['developers'],
        ['viewers'],
        ['unknown-group'],
        [],
      ];

      testCases.forEach((groups) => {
        const result = (service as any).mapGroupsToRoles(groups);
        expect(result).toContain('user');
      });
    });
  });

  describe('mergeRoles', () => {
    it('should preserve existing application-set roles', () => {
      const existingRoles = ['admin', 'customRole'];
      const openShiftRoles = ['user'];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('admin');
      expect(result).toContain('customRole');
      expect(result).toContain('user');
    });

    it('should add new OpenShift roles to existing roles', () => {
      const existingRoles = ['user'];
      const openShiftRoles = ['admin-readonly', 'user'];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('user');
      expect(result).toContain('admin-readonly');
      expect(result).toHaveLength(2);
    });

    it('should handle empty existing roles', () => {
      const existingRoles: string[] = [];
      const openShiftRoles = ['admin-readonly', 'user'];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('user');
      expect(result).toContain('admin-readonly');
    });

    it('should handle empty OpenShift roles', () => {
      const existingRoles = ['admin', 'customRole'];
      const openShiftRoles: string[] = [];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('user'); // Always ensure user role
      expect(result).toContain('admin');
      expect(result).toContain('customRole');
    });

    it('should deduplicate roles', () => {
      const existingRoles = ['user', 'admin'];
      const openShiftRoles = ['user', 'admin-readonly'];

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result.filter((role) => role === 'user')).toHaveLength(1);
      expect(result).toContain('admin');
      expect(result).toContain('admin-readonly');
    });

    it('should always ensure user role is present', () => {
      const testCases = [
        [['admin'], ['admin-readonly']],
        [['customRole'], ['anotherCustomRole']],
        [[], []],
        [['admin'], []],
        [[], ['admin-readonly']],
      ];

      testCases.forEach(([existingRoles, openShiftRoles]) => {
        const result = (service as any).mergeRoles(existingRoles, openShiftRoles);
        expect(result).toContain('user');
      });
    });

    it('should handle application-set admin role with OpenShift user group', () => {
      // Scenario: User was manually made admin but OpenShift only has them in litemaas-users
      const existingRoles = ['admin', 'user'];
      const openShiftRoles = ['user']; // Only user from litemaas-users group

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('admin'); // Should preserve admin role
      expect(result).toContain('user');
      expect(result).toHaveLength(2);
    });

    it('should handle user promoted in OpenShift but not yet in application', () => {
      // Scenario: User added to litemaas-admins group, should get admin role
      const existingRoles = ['user'];
      const openShiftRoles = ['admin', 'user']; // From litemaas-admins group

      const result = (service as any).mergeRoles(existingRoles, openShiftRoles);

      expect(result).toContain('admin'); // Should get admin role
      expect(result).toContain('user');
      expect(result).toHaveLength(2);
    });
  });

  describe('getInitialAdminRoles', () => {
    it('should return empty array when INITIAL_ADMIN_USERS is not set', () => {
      const result = (service as any).getInitialAdminRoles('someuser');
      expect(result).toEqual([]);
    });

    it('should return admin and user roles when username matches', () => {
      const customFastify = createMockFastify({ INITIAL_ADMIN_USERS: 'admin@example.com' });
      const customService = new OAuthService(
        customFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const result = (customService as any).getInitialAdminRoles('admin@example.com');
      expect(result).toEqual(['admin', 'user']);
    });

    it('should handle comma-separated list of usernames', () => {
      const customFastify = createMockFastify({ INITIAL_ADMIN_USERS: 'user1,user2,user3' });
      const customService = new OAuthService(
        customFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      expect((customService as any).getInitialAdminRoles('user2')).toEqual(['admin', 'user']);
    });

    it('should trim whitespace from usernames', () => {
      const customFastify = createMockFastify({ INITIAL_ADMIN_USERS: ' user1 , user2 , user3 ' });
      const customService = new OAuthService(
        customFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      expect((customService as any).getInitialAdminRoles('user2')).toEqual(['admin', 'user']);
    });

    it('should return empty array for non-matching username', () => {
      const customFastify = createMockFastify({ INITIAL_ADMIN_USERS: 'admin@example.com' });
      const customService = new OAuthService(
        customFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const result = (customService as any).getInitialAdminRoles('other@example.com');
      expect(result).toEqual([]);
    });

    it('should handle empty string value', () => {
      const customFastify = createMockFastify({ INITIAL_ADMIN_USERS: '' });
      const customService = new OAuthService(
        customFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      const result = (customService as any).getInitialAdminRoles('someuser');
      expect(result).toEqual([]);
    });

    it('should log info when username matches', () => {
      const customFastify = createMockFastify({ INITIAL_ADMIN_USERS: 'admin@example.com' });
      const customService = new OAuthService(
        customFastify,
        mockLiteLLMService,
        mockDefaultTeamService,
      );

      (customService as any).getInitialAdminRoles('admin@example.com');
      expect(customFastify.log.info).toHaveBeenCalledWith(
        { username: 'admin@example.com' },
        'User matched INITIAL_ADMIN_USERS — granting admin role',
      );
    });
  });

  describe('processOAuthUser', () => {
    const mockUserInfo = {
      sub: 'oauth-user-123',
      preferred_username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      email_verified: true,
      groups: ['litemaas-users'],
    };

    const mockUserDbRow = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      roles: ['user'],
      is_active: true,
    };

    it('should query database for existing user', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null) // Check for existing user
        .mockResolvedValueOnce(mockUserDbRow); // INSERT RETURNING
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      await service.processOAuthUser(mockUserInfo);

      expect(mockFastify.dbUtils.queryOne).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
        mockUserInfo.sub,
        'openshift',
      ]);
    });

    it('should create new user with INSERT RETURNING', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null) // Check for existing user
        .mockResolvedValueOnce(mockUserDbRow); // INSERT RETURNING
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      const result = await service.processOAuthUser(mockUserInfo);

      expect(result).toMatchObject({
        id: mockUserDbRow.id,
        username: mockUserDbRow.username,
        email: mockUserDbRow.email,
      });
      expect(mockFastify.dbUtils.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.anything(),
      );
    });

    it('should update existing user with roles merge', async () => {
      const existingUser = { ...mockUserDbRow, roles: ['user', 'custom-role'] };
      mockFastify.dbUtils.queryOne = vi.fn().mockResolvedValue(existingUser);
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      const result = await service.processOAuthUser(mockUserInfo);

      expect(result.roles).toContain('user');
      expect(result.roles).toContain('custom-role'); // Preserved from existing
      expect(mockFastify.dbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.anything(),
      );
    });

    it('should handle LiteLLM sync errors gracefully', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUserDbRow);
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);
      mockLiteLLMService.createUser = vi.fn().mockRejectedValue(new Error('LiteLLM error'));

      // Should not throw despite LiteLLM error
      const result = await service.processOAuthUser(mockUserInfo);

      expect(result).toBeDefined();
      expect(mockFastify.log.warn).toHaveBeenCalled();
    });

    it('should log info on successful user creation', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUserDbRow);
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      await service.processOAuthUser(mockUserInfo);

      expect(mockFastify.log.info).toHaveBeenCalled();
    });

    it('should log info on successful user update', async () => {
      mockFastify.dbUtils.queryOne = vi.fn().mockResolvedValue(mockUserDbRow);
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      await service.processOAuthUser(mockUserInfo);

      expect(mockFastify.log.info).toHaveBeenCalled();
    });

    it('should map admin groups correctly', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockUserDbRow, roles: ['user', 'admin'] });
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      const adminUserInfo = { ...mockUserInfo, groups: ['litemaas-admins'] };
      const result = await service.processOAuthUser(adminUserInfo);

      expect(result.roles).toContain('admin');
      expect(result.roles).toContain('user');
    });

    it('should map readonly groups correctly', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockUserDbRow, roles: ['user', 'admin-readonly'] });
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      const readonlyUserInfo = { ...mockUserInfo, groups: ['litemaas-readonly'] };
      const result = await service.processOAuthUser(readonlyUserInfo);

      expect(result.roles).toContain('admin-readonly');
      expect(result.roles).toContain('user');
    });

    it('should default to user role for unknown groups', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUserDbRow);
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      const unknownGroupUserInfo = { ...mockUserInfo, groups: ['unknown-group'] };
      const result = await service.processOAuthUser(unknownGroupUserInfo);

      expect(result.roles).toEqual(['user']);
    });

    it('should handle empty groups array', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUserDbRow);
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      const noGroupsUserInfo = { ...mockUserInfo, groups: [] };
      const result = await service.processOAuthUser(noGroupsUserInfo);

      expect(result.roles).toEqual(['user']);
    });

    it('should throw error if user creation fails', async () => {
      mockFastify.dbUtils.queryOne = vi
        .fn()
        .mockResolvedValueOnce(null) // Check for existing user
        .mockResolvedValueOnce(null); // INSERT RETURNING returns null
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      await expect(service.processOAuthUser(mockUserInfo)).rejects.toThrow(/User.*not found/i);
    });

    it('should handle database errors gracefully', async () => {
      mockFastify.dbUtils.queryOne = vi.fn().mockRejectedValue(new Error('DB error'));

      await expect(service.processOAuthUser(mockUserInfo)).rejects.toThrow('DB error');
    });

    it('should preserve application-set admin role even with basic OpenShift groups', async () => {
      const adminUser = { ...mockUserDbRow, roles: ['user', 'admin'] };
      mockFastify.dbUtils.queryOne = vi.fn().mockResolvedValue(adminUser);
      mockFastify.dbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockLiteLLMService.getUserInfo = vi.fn().mockResolvedValue(null);

      // User only in basic litemaas-users group
      const basicUserInfo = { ...mockUserInfo, groups: ['litemaas-users'] };
      const result = await service.processOAuthUser(basicUserInfo);

      // Admin role should be preserved
      expect(result.roles).toContain('admin');
      expect(result.roles).toContain('user');
    });
  });
});

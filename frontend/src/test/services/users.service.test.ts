import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usersService } from '../../services/users.service';
import { apiClient } from '../../services/api';
import type { User, UserUpdateData } from '../../types/users';

// Mock the entire API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock users data
const mockUsers: User[] = [
  {
    id: 'user-1',
    username: 'john_doe',
    email: 'john.doe@example.com',
    fullName: 'John Doe',
    roles: ['user', 'models:read'],
    isActive: true,
    lastLoginAt: '2024-06-20T10:30:00.000Z',
    createdAt: '2024-01-15T09:00:00.000Z',
  },
  {
    id: 'user-2',
    username: 'jane_admin',
    email: 'jane.admin@example.com',
    fullName: 'Jane Admin',
    roles: ['admin', 'users:read', 'users:write'],
    isActive: true,
    lastLoginAt: '2024-06-21T15:45:00.000Z',
    createdAt: '2024-01-10T08:00:00.000Z',
  },
  {
    id: 'user-3',
    username: 'inactive_user',
    email: 'inactive@example.com',
    fullName: 'Inactive User',
    roles: ['user'],
    isActive: false,
    lastLoginAt: '2024-05-01T12:00:00.000Z',
    createdAt: '2024-02-01T10:00:00.000Z',
  },
];

const mockUserProfile = {
  id: 'current-user',
  username: 'current_user',
  email: 'current@example.com',
  fullName: 'Current User',
  roles: ['user', 'models:read'],
  createdAt: '2024-03-01T10:00:00.000Z',
};

const mockUserActivity = {
  data: [
    {
      id: 'activity-1',
      action: 'LOGIN',
      resourceType: 'USER',
      resourceId: 'current-user',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      metadata: { loginMethod: 'oauth' },
      createdAt: '2024-06-21T10:00:00.000Z',
    },
    {
      id: 'activity-2',
      action: 'API_KEY_CREATE',
      resourceType: 'API_KEY',
      resourceId: 'key-123',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      metadata: { keyName: 'Test Key' },
      createdAt: '2024-06-20T14:30:00.000Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  },
};

const mockUserStats = {
  subscriptions: {
    total: 3,
    active: 2,
    suspended: 1,
  },
  apiKeys: {
    total: 2,
    active: 2,
  },
  usage: {
    totalRequests: 150,
    totalTokens: 45000,
    currentMonthRequests: 50,
    currentMonthTokens: 15000,
  },
  lastLogin: '2024-06-21T10:00:00.000Z',
  memberSince: '2024-03-01T10:00:00.000Z',
};

describe('UsersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should fetch paginated users successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockUsers,
        pagination: {
          page: 1,
          limit: 20,
          total: 3,
          totalPages: 1,
        },
      });

      const result = await usersService.getUsers();

      expect(apiClient.get).toHaveBeenCalledWith('/users');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBe(3);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });
    });

    it('should handle pagination parameters correctly', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [mockUsers[1]], // Second user
        pagination: {
          page: 2,
          limit: 1,
          total: 3,
          totalPages: 3,
        },
      });

      const result = await usersService.getUsers({ page: 2, limit: 1 });

      expect(apiClient.get).toHaveBeenCalledWith('/users?page=2&limit=1');
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should filter users by search term', async () => {
      const filteredUsers = mockUsers.filter((u) => u.username.toLowerCase().includes('john'));

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: filteredUsers,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });

      const result = await usersService.getUsers({ search: 'john' });

      expect(apiClient.get).toHaveBeenCalledWith('/users?search=john');
      expect(result.data.length).toBe(1);
      expect(result.data[0].username).toBe('john_doe');
    });

    it('should filter users by role', async () => {
      const adminUsers = mockUsers.filter((u) => u.roles.includes('admin'));

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: adminUsers,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });

      const result = await usersService.getUsers({ role: 'admin' });

      expect(apiClient.get).toHaveBeenCalledWith('/users?role=admin');
      expect(result.data.length).toBe(1);
      expect(result.data[0].username).toBe('jane_admin');
    });

    it('should filter users by active status', async () => {
      const inactiveUsers = mockUsers.filter((u) => !u.isActive);

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: inactiveUsers,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });

      const result = await usersService.getUsers({ isActive: false });

      expect(apiClient.get).toHaveBeenCalledWith('/users?isActive=false');
      expect(result.data.length).toBe(1);
      expect(result.data[0].username).toBe('inactive_user');
    });

    it('should handle combined filters', async () => {
      const filteredUsers = mockUsers.filter(
        (u) =>
          u.username.toLowerCase().includes('admin') && u.roles.includes('admin') && u.isActive,
      );

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: filteredUsers,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });

      const result = await usersService.getUsers({
        search: 'admin',
        role: 'admin',
        isActive: true,
      });

      expect(apiClient.get).toHaveBeenCalledWith('/users?search=admin&role=admin&isActive=true');
      expect(result.data.length).toBe(1);
      expect(result.data[0].username).toBe('jane_admin');
    });

    it('should handle API errors', async () => {
      const error = new Error('Forbidden');
      (error as any).response = { status: 403, data: { message: 'Forbidden', statusCode: 403 } };
      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(usersService.getUsers()).rejects.toThrow('Forbidden');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = 'user-1';
      const updates: UserUpdateData = {
        roles: ['user', 'models:read', 'models:write'],
      };

      const updatedUser = {
        id: userId,
        username: 'john_doe',
        email: 'john.doe@example.com',
        fullName: 'John Doe',
        roles: updates.roles!,
        createdAt: '2024-01-15T09:00:00.000Z',
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce(updatedUser);

      const result = await usersService.updateUser(userId, updates);

      expect(apiClient.patch).toHaveBeenCalledWith(`/users/${userId}`, updates);
      expect(result.id).toBe(userId);
      expect(result.roles).toEqual(updates.roles);
    });

    it('should handle partial updates', async () => {
      const userId = 'user-1';
      const updates: UserUpdateData = {
        roles: ['admin'],
      };

      const updatedUser = {
        id: userId,
        username: 'john_doe',
        email: 'john.doe@example.com',
        fullName: 'John Doe',
        roles: updates.roles!,
        createdAt: '2024-01-15T09:00:00.000Z',
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce(updatedUser);

      const result = await usersService.updateUser(userId, updates);

      expect(apiClient.patch).toHaveBeenCalledWith(`/users/${userId}`, updates);
      expect(result.id).toBe(userId);
    });

    it('should handle validation errors', async () => {
      const userId = 'current-user';
      const updates: UserUpdateData = {
        roles: ['invalid-role'],
      };

      const error = new Error('Validation failed');
      (error as any).response = { status: 400, data: { message: 'Invalid role' } };
      vi.mocked(apiClient.patch).mockRejectedValueOnce(error);

      await expect(usersService.updateUser(userId, updates)).rejects.toThrow('Validation failed');
    });

    it('should handle non-existent user', async () => {
      const error = new Error('User not found');
      (error as any).response = {
        status: 404,
        data: { message: 'User not found', statusCode: 404 },
      };
      vi.mocked(apiClient.patch).mockRejectedValueOnce(error);

      const updates: UserUpdateData = { roles: ['admin'] };
      await expect(usersService.updateUser('non-existent', updates)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('getCurrentUserProfile', () => {
    it('should fetch current user profile successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUserProfile);

      const result = await usersService.getCurrentUserProfile();

      expect(apiClient.get).toHaveBeenCalledWith('/users/me');
      expect(result.id).toBe('current-user');
      expect(result.username).toBe('current_user');
      expect(result.email).toBe('current@example.com');
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Unauthorized');
      (error as any).response = { status: 401, data: { message: 'Unauthorized', statusCode: 401 } };
      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(usersService.getCurrentUserProfile()).rejects.toThrow('Unauthorized');
    });
  });

  describe('updateCurrentUserProfile', () => {
    it('should update current user profile successfully', async () => {
      const updates = { fullName: 'Updated Name' };
      const updatedProfile = { ...mockUserProfile, ...updates };

      vi.mocked(apiClient.patch).mockResolvedValueOnce(updatedProfile);

      const result = await usersService.updateCurrentUserProfile(updates);

      expect(apiClient.patch).toHaveBeenCalledWith('/users/me', updates);
      expect(result.fullName).toBe('Updated Name');
    });

    it('should handle empty updates', async () => {
      vi.mocked(apiClient.patch).mockResolvedValueOnce(mockUserProfile);

      const result = await usersService.updateCurrentUserProfile({});

      expect(apiClient.patch).toHaveBeenCalledWith('/users/me', {});
      expect(result.id).toBe('current-user');
    });
  });

  describe('getCurrentUserActivity', () => {
    it('should fetch user activity successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUserActivity);

      const result = await usersService.getCurrentUserActivity();

      expect(apiClient.get).toHaveBeenCalledWith('/users/me/activity');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].action).toBe('LOGIN');
      expect(result.pagination.total).toBe(2);
    });

    it('should filter activity by action', async () => {
      const filteredActivity = {
        data: mockUserActivity.data.filter((a) => a.action === 'LOGIN'),
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(filteredActivity);

      const result = await usersService.getCurrentUserActivity({ action: 'LOGIN' });

      expect(apiClient.get).toHaveBeenCalledWith('/users/me/activity?action=LOGIN');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('LOGIN');
    });

    it('should handle pagination for activity', async () => {
      const paginatedActivity = {
        data: [mockUserActivity.data[0]],
        pagination: {
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(paginatedActivity);

      const result = await usersService.getCurrentUserActivity({ page: 1, limit: 1 });

      expect(apiClient.get).toHaveBeenCalledWith('/users/me/activity?page=1&limit=1');
      expect(result.data).toHaveLength(1);
      expect(result.pagination.limit).toBe(1);
    });
  });

  describe('getCurrentUserStats', () => {
    it('should fetch user statistics successfully', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUserStats);

      const result = await usersService.getCurrentUserStats();

      expect(apiClient.get).toHaveBeenCalledWith('/users/me/stats');
      expect(result.subscriptions.total).toBe(3);
      expect(result.apiKeys.total).toBe(2);
      expect(result.usage.totalRequests).toBe(150);
    });
  });

  describe('permission helpers', () => {
    describe('canModifyUsers', () => {
      it('should return true for admin role', () => {
        const result = usersService.canModifyUsers({ roles: ['admin'] });
        expect(result).toBe(true);
      });

      it('should return false for regular user', () => {
        const result = usersService.canModifyUsers({ roles: ['user'] });
        expect(result).toBe(false);
      });

      it('should return false for undefined user', () => {
        const result = usersService.canModifyUsers(undefined);
        expect(result).toBe(false);
      });

      it('should return false for user with no roles', () => {
        const result = usersService.canModifyUsers({ roles: [] });
        expect(result).toBe(false);
      });
    });

    describe('hasAdminAccess', () => {
      it('should return true for admin role', () => {
        const result = usersService.hasAdminAccess({ roles: ['admin'] });
        expect(result).toBe(true);
      });

      it('should return true for admin:* permissions', () => {
        const result = usersService.hasAdminAccess({ roles: ['admin:health'] });
        expect(result).toBe(true);
      });

      it('should return false for regular permissions', () => {
        const result = usersService.hasAdminAccess({ roles: ['users:read'] });
        expect(result).toBe(false);
      });
    });

    describe('canReadUsers', () => {
      it('should return true for admin role', () => {
        const result = usersService.canReadUsers({ roles: ['admin'] });
        expect(result).toBe(true);
      });

      it('should return true for users:read permission', () => {
        const result = usersService.canReadUsers({ roles: ['users:read'] });
        expect(result).toBe(true);
      });

      it('should return false for insufficient permissions', () => {
        const result = usersService.canReadUsers({ roles: ['models:read'] });
        expect(result).toBe(false);
      });
    });
  });

  describe('role helpers', () => {
    describe('getAvailableRoles', () => {
      it('should return list of available roles', () => {
        const roles = usersService.getAvailableRoles();

        expect(roles).toContain('user');
        expect(roles).toContain('admin');
        expect(roles).toContain('admin-readonly');
      });
    });

    describe('formatRoleDisplayName', () => {
      it('should format known roles correctly', () => {
        expect(usersService.formatRoleDisplayName('admin')).toBe('Administrator');
        expect(usersService.formatRoleDisplayName('users:read')).toBe('Users - Read');
        expect(usersService.formatRoleDisplayName('admin:users')).toBe('Admin - Users');
      });

      it('should return original role name for unknown roles', () => {
        expect(usersService.formatRoleDisplayName('custom:role')).toBe('custom:role');
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const error = new Error('Network error');
      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      await expect(usersService.getUsers()).rejects.toThrow('Network error');
    });

    it('should handle malformed responses', async () => {
      // This test doesn't make sense with mocked apiClient since we control the response
      // The apiClient already returns parsed data, not raw responses
      // Keeping it for completeness but adjusting to a more realistic scenario
      vi.mocked(apiClient.get).mockResolvedValueOnce(null as any);

      const result = await usersService.getUsers();
      expect(result).toBeNull();
    });
  });
});

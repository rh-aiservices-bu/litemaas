import { describe, it, expect, beforeEach, vi } from 'vitest';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { usersService } from '../../services/users.service';
import type { User, UserUpdateData } from '../../types/users';

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

// Setup MSW handlers for user endpoints
beforeEach(() => {
  server.use(
    // List users endpoint
    http.get('/api/v1/users', ({ request }) => {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const search = url.searchParams.get('search');
      const role = url.searchParams.get('role');
      const isActive = url.searchParams.get('isActive');

      let filteredUsers = [...mockUsers];

      // Apply search filter
      if (search) {
        filteredUsers = filteredUsers.filter(
          (user) =>
            user.username.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase()) ||
            user.fullName?.toLowerCase().includes(search.toLowerCase()),
        );
      }

      // Apply role filter
      if (role) {
        filteredUsers = filteredUsers.filter((user) => user.roles.includes(role));
      }

      // Apply active status filter
      if (isActive !== null && isActive !== undefined) {
        const activeFilter = isActive === 'true';
        filteredUsers = filteredUsers.filter((user) => user.isActive === activeFilter);
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      return HttpResponse.json({
        data: paginatedUsers,
        pagination: {
          page,
          limit,
          total: filteredUsers.length,
          totalPages: Math.ceil(filteredUsers.length / limit),
        },
      });
    }),

    // Update user endpoint
    http.patch('/api/v1/users/:userId', async ({ params, request }) => {
      const { userId } = params;
      const updates = (await request.json()) as UserUpdateData;

      const user = mockUsers.find((u) => u.id === userId);
      if (!user) {
        return HttpResponse.json({ message: 'User not found', statusCode: 404 }, { status: 404 });
      }

      // Note: isActive validation removed since status cannot be modified

      const updatedUser = { ...user, ...updates };
      return HttpResponse.json({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        roles: updatedUser.roles,
        createdAt: updatedUser.createdAt,
      });
    }),

    // Get current user profile
    http.get('/api/v1/users/me', () => {
      return HttpResponse.json(mockUserProfile);
    }),

    // Update current user profile
    http.patch('/api/v1/users/me', async ({ request }) => {
      const updates = (await request.json()) as { fullName?: string };
      const updatedProfile = { ...mockUserProfile, ...updates };
      return HttpResponse.json(updatedProfile);
    }),

    // Get current user activity
    http.get('/api/v1/users/me/activity', ({ request }) => {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const action = url.searchParams.get('action');

      let activities = mockUserActivity.data;

      // Apply action filter
      if (action) {
        activities = activities.filter((activity) => activity.action === action);
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedActivities = activities.slice(startIndex, endIndex);

      return HttpResponse.json({
        data: paginatedActivities,
        pagination: {
          page,
          limit,
          total: activities.length,
          totalPages: Math.ceil(activities.length / limit),
        },
      });
    }),

    // Get current user stats
    http.get('/api/v1/users/me/stats', () => {
      return HttpResponse.json(mockUserStats);
    }),
  );
});

describe('UsersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage properly
    const localStorageMock = {
      getItem: vi.fn().mockImplementation((key) => {
        if (key === 'access_token') return 'mock-token';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorageMock);
  });

  describe('getUsers', () => {
    it('should fetch paginated users successfully', async () => {
      const result = await usersService.getUsers();

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
      const result = await usersService.getUsers({ page: 2, limit: 1 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should filter users by search term', async () => {
      const result = await usersService.getUsers({ search: 'john' });

      expect(result.data.length).toBe(1);
      expect(result.data[0].username).toBe('john_doe');
    });

    it('should filter users by role', async () => {
      const result = await usersService.getUsers({ role: 'admin' });

      expect(result.data.length).toBe(1);
      expect(result.data[0].username).toBe('jane_admin');
    });

    it('should filter users by active status', async () => {
      const result = await usersService.getUsers({ isActive: false });

      expect(result.data.length).toBe(1);
      expect(result.data[0].username).toBe('inactive_user');
    });

    it('should handle combined filters', async () => {
      const result = await usersService.getUsers({
        search: 'admin',
        role: 'admin',
        isActive: true,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].username).toBe('jane_admin');
    });

    it('should handle API errors', async () => {
      server.use(
        http.get('/api/v1/users', () => {
          return HttpResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 });
        }),
      );

      await expect(usersService.getUsers()).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const userId = 'user-1';
      const updates: UserUpdateData = {
        roles: ['user', 'models:read', 'models:write'],
      };

      const result = await usersService.updateUser(userId, updates);

      expect(result.id).toBe(userId);
      expect(result.roles).toEqual(updates.roles);
    });

    it('should handle partial updates', async () => {
      const userId = 'user-1';
      const updates: UserUpdateData = {
        roles: ['admin'],
      };

      const result = await usersService.updateUser(userId, updates);
      expect(result.id).toBe(userId);
    });

    it('should handle validation errors', async () => {
      const userId = 'current-user';
      const updates: UserUpdateData = {
        roles: ['invalid-role'],
      };

      await expect(usersService.updateUser(userId, updates)).rejects.toThrow();
    });

    it('should handle non-existent user', async () => {
      server.use(
        http.patch('/api/v1/users/:userId', () => {
          return HttpResponse.json({ message: 'User not found', statusCode: 404 }, { status: 404 });
        }),
      );

      const updates: UserUpdateData = { roles: ['admin'] };
      await expect(usersService.updateUser('non-existent', updates)).rejects.toThrow();
    });
  });

  describe('getCurrentUserProfile', () => {
    it('should fetch current user profile successfully', async () => {
      const result = await usersService.getCurrentUserProfile();

      expect(result.id).toBe('current-user');
      expect(result.username).toBe('current_user');
      expect(result.email).toBe('current@example.com');
    });

    it('should handle authentication errors', async () => {
      server.use(
        http.get('/api/v1/users/me', () => {
          return HttpResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 });
        }),
      );

      await expect(usersService.getCurrentUserProfile()).rejects.toThrow();
    });
  });

  describe('updateCurrentUserProfile', () => {
    it('should update current user profile successfully', async () => {
      const updates = { fullName: 'Updated Name' };

      const result = await usersService.updateCurrentUserProfile(updates);

      expect(result.fullName).toBe('Updated Name');
    });

    it('should handle empty updates', async () => {
      const result = await usersService.updateCurrentUserProfile({});

      expect(result.id).toBe('current-user');
    });
  });

  describe('getCurrentUserActivity', () => {
    it('should fetch user activity successfully', async () => {
      const result = await usersService.getCurrentUserActivity();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].action).toBe('LOGIN');
      expect(result.pagination.total).toBe(2);
    });

    it('should filter activity by action', async () => {
      const result = await usersService.getCurrentUserActivity({ action: 'LOGIN' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('LOGIN');
    });

    it('should handle pagination for activity', async () => {
      const result = await usersService.getCurrentUserActivity({ page: 1, limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.limit).toBe(1);
    });
  });

  describe('getCurrentUserStats', () => {
    it('should fetch user statistics successfully', async () => {
      const result = await usersService.getCurrentUserStats();

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

      it('should return true for users:write permission', () => {
        const result = usersService.canModifyUsers({ roles: ['users:write'] });
        expect(result).toBe(true);
      });

      it('should return true for admin:* permissions', () => {
        const result = usersService.canModifyUsers({ roles: ['admin:users'] });
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
        expect(roles).toContain('users:read');
        expect(roles).toContain('users:write');
        expect(roles).toContain('admin:users');
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
      server.use(
        http.get('/api/v1/users', () => {
          return HttpResponse.error();
        }),
      );

      await expect(usersService.getUsers()).rejects.toThrow();
    });

    it('should handle malformed responses', async () => {
      server.use(
        http.get('/api/v1/users', () => {
          return HttpResponse.text('Invalid JSON');
        }),
      );

      await expect(usersService.getUsers()).rejects.toThrow();
    });
  });
});

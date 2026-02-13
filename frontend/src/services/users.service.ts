import { apiClient } from './api';
import {
  User,
  UserListParams,
  UserUpdateData,
  PaginatedResponse,
  UserActivity,
  UserStats,
  UserProfile,
  AdminUserDetails,
  UserBudgetLimitsUpdate,
  UserBudgetUpdated,
  UserApiKey,
  CreateApiKeyForUserRequest,
  CreatedApiKeyResponse,
  UserSubscription,
} from '../types/users';

export class UsersService {
  /**
   * Get paginated list of users (admin only)
   * Requires 'users:read' permission
   */
  async getUsers(params: UserListParams = {}): Promise<PaginatedResponse<User>> {
    const searchParams = new URLSearchParams();

    if (params.page) {
      searchParams.append('page', params.page.toString());
    }
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params.search) {
      searchParams.append('search', params.search);
    }
    if (params.role) {
      searchParams.append('role', params.role);
    }
    if (typeof params.isActive === 'boolean') {
      searchParams.append('isActive', params.isActive.toString());
    }

    const queryString = searchParams.toString();
    const url = queryString ? `/users?${queryString}` : '/users';

    return apiClient.get<PaginatedResponse<User>>(url);
  }

  /**
   * Update a user's roles and active status (admin only)
   * Requires 'users:write' permission
   */
  async updateUser(userId: string, updateData: UserUpdateData): Promise<UserProfile> {
    return apiClient.patch<UserProfile>(`/users/${userId}`, updateData);
  }

  /**
   * Get current user's profile
   */
  async getCurrentUserProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/users/me');
  }

  /**
   * Update current user's profile
   */
  async updateCurrentUserProfile(updateData: { fullName?: string }): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('/users/me', updateData);
  }

  /**
   * Get current user's activity history
   */
  async getCurrentUserActivity(
    params: {
      page?: number;
      limit?: number;
      action?: string;
    } = {},
  ): Promise<PaginatedResponse<UserActivity>> {
    const searchParams = new URLSearchParams();

    if (params.page) {
      searchParams.append('page', params.page.toString());
    }
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params.action) {
      searchParams.append('action', params.action);
    }

    const queryString = searchParams.toString();
    const url = queryString ? `/users/me/activity?${queryString}` : '/users/me/activity';

    return apiClient.get<PaginatedResponse<UserActivity>>(url);
  }

  /**
   * Get current user's statistics
   */
  async getCurrentUserStats(): Promise<UserStats> {
    return apiClient.get<UserStats>('/users/me/stats');
  }

  /**
   * Check if the current user can modify users (admin permissions)
   * This is a client-side helper to determine UI visibility
   * Note: admin-readonly can read users but cannot modify them
   */
  canModifyUsers(currentUser?: { roles: string[] }): boolean {
    if (!currentUser?.roles) {
      return false;
    }

    // Only full admins can modify users, not admin-readonly
    return currentUser.roles.includes('admin') || currentUser.roles.includes('users:write');
  }

  /**
   * Check if the current user has admin access
   * This is a client-side helper to determine UI visibility
   */
  hasAdminAccess(currentUser?: { roles: string[] }): boolean {
    if (!currentUser?.roles) {
      return false;
    }

    return (
      currentUser.roles.includes('admin') ||
      currentUser.roles.some((role) => role.startsWith('admin:'))
    );
  }

  /**
   * Check if the current user can read users list
   * This is a client-side helper to determine UI visibility
   */
  canReadUsers(currentUser?: { roles: string[] }): boolean {
    if (!currentUser?.roles) {
      return false;
    }

    return (
      currentUser.roles.includes('admin') ||
      currentUser.roles.includes('admin-readonly') ||
      currentUser.roles.includes('users:read') ||
      currentUser.roles.some((role) => role.startsWith('admin:'))
    );
  }

  /**
   * Get available user roles for admin selection
   * This is a helper method to provide consistent role options
   */
  getAvailableRoles(): string[] {
    return ['user', 'admin', 'admin-readonly'];
  }

  /**
   * Format role display name for UI
   */
  formatRoleDisplayName(role: string): string {
    const roleDisplayNames: Record<string, string> = {
      user: 'User',
      admin: 'Administrator',
      'admin-readonly': 'Administrator (Read-only)',
      'users:read': 'Users - Read',
      'users:write': 'Users - Write',
      'models:read': 'Models - Read',
      'models:write': 'Models - Write',
      'subscriptions:read': 'Subscriptions - Read',
      'subscriptions:write': 'Subscriptions - Write',
      'usage:read': 'Usage - Read',
      'usage:write': 'Usage - Write',
      'admin:usage': 'Admin - Usage',
      'admin:users': 'Admin - Users',
      'admin:api_keys': 'Admin - API Keys',
      'admin:health': 'Admin - Health',
    };

    return roleDisplayNames[role] || role;
  }

  // ============================================
  // Admin User Management Methods
  // ============================================

  /**
   * Get detailed user information (admin only)
   * Includes budget, limits, and counts
   */
  async getAdminUserDetails(userId: string): Promise<AdminUserDetails> {
    return apiClient.get<AdminUserDetails>(`/admin/users/${userId}`);
  }

  /**
   * Update user budget and rate limits (admin only)
   */
  async updateUserBudgetLimits(
    userId: string,
    data: UserBudgetLimitsUpdate,
  ): Promise<UserBudgetUpdated> {
    return apiClient.patch<UserBudgetUpdated>(`/admin/users/${userId}/budget-limits`, data);
  }

  /**
   * Get user's API keys (admin only)
   */
  async getUserApiKeys(
    userId: string,
    params: { page?: number; limit?: number; isActive?: boolean } = {},
  ): Promise<PaginatedResponse<UserApiKey>> {
    const searchParams = new URLSearchParams();

    if (params.page) {
      searchParams.append('page', params.page.toString());
    }
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    if (typeof params.isActive === 'boolean') {
      searchParams.append('isActive', params.isActive.toString());
    }

    const queryString = searchParams.toString();
    const url = queryString
      ? `/admin/users/${userId}/api-keys?${queryString}`
      : `/admin/users/${userId}/api-keys`;

    return apiClient.get<PaginatedResponse<UserApiKey>>(url);
  }

  /**
   * Create API key for user (admin only)
   */
  async createApiKeyForUser(
    userId: string,
    data: CreateApiKeyForUserRequest,
  ): Promise<CreatedApiKeyResponse> {
    return apiClient.post<CreatedApiKeyResponse>(`/admin/users/${userId}/api-keys`, data);
  }

  /**
   * Revoke user's API key (admin only)
   */
  async revokeUserApiKey(userId: string, keyId: string, reason?: string): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}/api-keys/${keyId}`, {
      data: reason ? { reason } : undefined,
    });
  }

  /**
   * Update user's API key models (admin only)
   */
  async updateUserApiKeyModels(
    userId: string,
    keyId: string,
    data: { modelIds?: string[]; name?: string },
  ): Promise<{ id: string; name: string; models: string[]; updatedAt: string }> {
    return apiClient.patch<{ id: string; name: string; models: string[]; updatedAt: string }>(
      `/admin/users/${userId}/api-keys/${keyId}`,
      data,
    );
  }

  /**
   * Get user's subscriptions (admin only)
   */
  async getUserSubscriptions(
    userId: string,
    params: { page?: number; limit?: number; status?: string } = {},
  ): Promise<PaginatedResponse<UserSubscription>> {
    const searchParams = new URLSearchParams();

    if (params.page) {
      searchParams.append('page', params.page.toString());
    }
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params.status) {
      searchParams.append('status', params.status);
    }

    const queryString = searchParams.toString();
    const url = queryString
      ? `/admin/users/${userId}/subscriptions?${queryString}`
      : `/admin/users/${userId}/subscriptions`;

    return apiClient.get<PaginatedResponse<UserSubscription>>(url);
  }
}

// Export singleton instance
export const usersService = new UsersService();

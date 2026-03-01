import { apiClient } from './api';
import type { ApiKeyQuotaDefaults } from '../types/users';

export interface BulkUpdateUserLimitsRequest {
  maxBudget?: number;
  tpmLimit?: number;
  rpmLimit?: number;
}

export interface BulkUpdateUserLimitsResponse {
  totalUsers: number;
  successCount: number;
  failedCount: number;
  errors: Array<{
    userId: string;
    username: string;
    error: string;
  }>;
  processedAt: string;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalApiKeys: number;
  activeApiKeys: number;
  totalModels: number;
  availableModels: number;
}

class AdminService {
  /**
   * Bulk update user limits for all active users
   */
  async bulkUpdateUserLimits(
    data: BulkUpdateUserLimitsRequest,
  ): Promise<BulkUpdateUserLimitsResponse> {
    return await apiClient.post<BulkUpdateUserLimitsResponse>(
      '/admin/users/bulk-update-limits',
      data,
    );
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<SystemStats> {
    return await apiClient.get<SystemStats>('/admin/system/stats');
  }

  /**
   * Get API key quota defaults and maximums
   */
  async getApiKeyDefaults(): Promise<ApiKeyQuotaDefaults> {
    return await apiClient.get<ApiKeyQuotaDefaults>('/admin/settings/api-key-defaults');
  }

  /**
   * Update API key quota defaults and maximums
   */
  async updateApiKeyDefaults(data: ApiKeyQuotaDefaults): Promise<ApiKeyQuotaDefaults> {
    return await apiClient.put<ApiKeyQuotaDefaults>('/admin/settings/api-key-defaults', data);
  }
}

export const adminService = new AdminService();

import { apiClient } from './api';

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
}

export const adminService = new AdminService();

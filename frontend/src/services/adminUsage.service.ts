import { apiClient } from './api';

/**
 * Daily usage summary for trend charts
 */
export interface DailyUsageSummary {
  date: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Model summary with full details
 */
export interface ModelSummary {
  modelId: string;
  modelName: string;
  provider: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Model usage data for a specific day
 */
export interface DailyModelMetrics {
  modelId: string;
  modelName: string;
  provider: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Daily model usage summary for stacked trend charts
 */
export interface DailyModelUsage {
  date: string;
  models: DailyModelMetrics[];
}

/**
 * Analytics data response from admin usage analytics endpoint
 */
export interface Analytics {
  period: {
    startDate: string;
    endDate: string;
  };
  totalUsers: number;
  activeUsers: number;
  totalRequests: number;
  totalTokens: {
    total: number;
    prompt: number;
    completion: number;
  };
  totalCost: {
    total: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  };
  successRate: number;
  averageLatency: number;
  topMetrics: {
    topUser: {
      userId: string;
      username: string;
      requests: number;
      cost: number;
    };
    topModel: {
      modelId: string;
      modelName: string;
      requests: number;
      cost: number;
    };
  };
  trends: {
    requestsTrend: TrendData;
    costTrend: TrendData;
    usersTrend: TrendData;
  };
  dailyUsage?: DailyUsageSummary[];
  dailyModelUsage?: DailyModelUsage[];
  topModels?: ModelSummary[];
  topUsers?: UserSummary[];
}

/**
 * User summary for top users
 */
export interface UserSummary {
  userId: string;
  username: string;
  email: string;
  role: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Trend data for metrics over time
 */
export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  percentageChange: number;
  direction: 'up' | 'down' | 'stable';
}

/**
 * User breakdown entry
 */
export interface UserBreakdown {
  userId: string;
  username: string;
  email: string;
  role: string;
  metrics: {
    requests: number;
    tokens: {
      total: number;
      input: number;
      output: number;
    };
    cost: number;
    lastActive: string;
  };
}

/**
 * Model breakdown entry
 */
export interface ModelBreakdown {
  modelId: string;
  modelName: string;
  provider: string;
  metrics: {
    requests: number;
    tokens: {
      total: number;
      input: number;
      output: number;
    };
    cost: number;
    users: number;
    successRate: number;
  };
}

/**
 * Provider breakdown entry
 */
export interface ProviderBreakdown {
  provider: string;
  metrics: {
    requests: number;
    tokens: {
      total: number;
      input: number;
      output: number;
    };
    cost: number;
    models: number;
    successRate: number;
  };
}

/**
 * Admin usage filters for date range and dimensions
 */
export interface AdminUsageFilters {
  startDate: string;
  endDate: string;
  userIds?: string[];
  modelIds?: string[];
  providerIds?: string[];
  apiKeyIds?: string[];
}

/**
 * Admin usage service for fetching global usage analytics
 */
class AdminUsageService {
  /**
   * Get analytics data overview
   * @param filters Date range and dimension filters
   * @returns Analytics data
   */
  async getAnalytics(filters: AdminUsageFilters): Promise<Analytics> {
    return apiClient.post<Analytics>('/admin/usage/analytics', filters);
  }

  /**
   * Get user breakdown data
   * @param filters Date range and dimension filters
   * @returns Array of user breakdown entries
   */
  async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    const params = new URLSearchParams();
    params.append('startDate', filters.startDate);
    params.append('endDate', filters.endDate);

    if (filters.modelIds?.length) {
      filters.modelIds.forEach((id) => params.append('modelIds[]', id));
    }
    if (filters.providerIds?.length) {
      filters.providerIds.forEach((id) => params.append('providerIds[]', id));
    }

    const response = await apiClient.get<{ users: UserBreakdown[]; total: number }>(
      `/admin/usage/by-user?${params.toString()}`,
    );
    return response.users;
  }

  /**
   * Get model breakdown data
   * @param filters Date range and dimension filters
   * @returns Array of model breakdown entries
   */
  async getModelBreakdown(filters: AdminUsageFilters): Promise<ModelBreakdown[]> {
    const params = new URLSearchParams();
    params.append('startDate', filters.startDate);
    params.append('endDate', filters.endDate);

    if (filters.userIds?.length) {
      filters.userIds.forEach((id) => params.append('userIds[]', id));
    }
    if (filters.providerIds?.length) {
      filters.providerIds.forEach((id) => params.append('providerIds[]', id));
    }

    const response = await apiClient.get<{ models: ModelBreakdown[]; total: number }>(
      `/admin/usage/by-model?${params.toString()}`,
    );
    return response.models;
  }

  /**
   * Get provider breakdown data
   * @param filters Date range and dimension filters
   * @returns Array of provider breakdown entries
   */
  async getProviderBreakdown(filters: AdminUsageFilters): Promise<ProviderBreakdown[]> {
    const params = new URLSearchParams();
    params.append('startDate', filters.startDate);
    params.append('endDate', filters.endDate);

    if (filters.userIds?.length) {
      filters.userIds.forEach((id) => params.append('userIds[]', id));
    }
    if (filters.modelIds?.length) {
      filters.modelIds.forEach((id) => params.append('modelIds[]', id));
    }

    const response = await apiClient.get<{ providers: ProviderBreakdown[]; total: number }>(
      `/admin/usage/by-provider?${params.toString()}`,
    );
    return response.providers;
  }

  /**
   * Export usage data to CSV or JSON
   * @param filters Date range and dimension filters
   * @param format Export format (csv or json)
   * @returns Blob containing exported data
   */
  async exportUsageData(filters: AdminUsageFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const params = new URLSearchParams({ format });
    params.append('startDate', filters.startDate);
    params.append('endDate', filters.endDate);

    if (filters.userIds?.length) {
      filters.userIds.forEach((id) => params.append('userIds[]', id));
    }
    if (filters.modelIds?.length) {
      filters.modelIds.forEach((id) => params.append('modelIds[]', id));
    }
    if (filters.providerIds?.length) {
      filters.providerIds.forEach((id) => params.append('providerIds[]', id));
    }

    const response = await fetch(`/api/v1/admin/usage/export?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export usage data');
    }

    return response.blob();
  }

  /**
   * Refresh today's usage data from LiteLLM
   * @returns Promise that resolves when refresh completes
   */
  async refreshTodayData(): Promise<void> {
    return apiClient.post<void>('/admin/usage/refresh-today', {});
  }
}

export const adminUsageService = new AdminUsageService();

/**
 * Transform backend Analytics to match MetricsOverview component expectations
 *
 * Backend provides dates as YYYY-MM-DD strings in local timezone (not UTC).
 * Keep them as strings to avoid timezone conversion issues.
 * Backend now provides dailyUsage and topModels arrays directly.
 *
 * @param apiData - Analytics from backend API
 * @returns Transformed data matching component interface
 */
export function transformAnalyticsForComponent(apiData: Analytics): any {
  return {
    ...apiData,
    // Keep period dates as strings - they're already in YYYY-MM-DD format
    period: apiData.period,
    // Backend now provides dailyUsage, topModels, and topUsers directly
    dailyUsage: apiData.dailyUsage || [],
    topModels: apiData.topModels || [],
    topUsers: apiData.topUsers || [],
  };
}

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
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;

  /** Items per page (max: 200) */
  limit?: number;

  /** Field to sort by */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata from API responses
 */
export interface PaginationMetadata {
  /** Current page number */
  page: number;

  /** Items per page */
  limit: number;

  /** Total number of items across all pages */
  total: number;

  /** Total number of pages */
  totalPages: number;

  /** Whether there is a next page */
  hasNext: boolean;

  /** Whether there is a previous page */
  hasPrevious: boolean;
}

/**
 * Generic paginated API response
 */
export interface PaginatedResponse<T> {
  /** Data items for current page */
  data: T[];

  /** Pagination metadata */
  pagination: PaginationMetadata;
}

/**
 * Pagination defaults (match backend)
 */
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 50,
  SORT_ORDER: 'desc' as const,
} as const;

/**
 * Per-page options for pagination selector
 */
export const PER_PAGE_OPTIONS = [
  { title: '10', value: 10 },
  { title: '25', value: 25 },
  { title: '50', value: 50 },
  { title: '100', value: 100 },
] as const;

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
   * Get user breakdown data with pagination
   * @param filters Date range and dimension filters
   * @param pagination Pagination parameters (optional)
   * @returns Paginated user breakdown data
   */
  async getUserBreakdown(
    filters: AdminUsageFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<UserBreakdown>> {
    const params = new URLSearchParams();

    // Add pagination parameters if provided
    if (pagination?.page !== undefined) {
      params.append('page', pagination.page.toString());
    }
    if (pagination?.limit !== undefined) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.sortBy) {
      params.append('sortBy', pagination.sortBy);
    }
    if (pagination?.sortOrder) {
      params.append('sortOrder', pagination.sortOrder);
    }

    const url = `/admin/usage/by-user${params.toString() ? `?${params.toString()}` : ''}`;

    return apiClient.post<PaginatedResponse<UserBreakdown>>(url, filters);
  }

  /**
   * Get model breakdown data with pagination
   * @param filters Date range and dimension filters
   * @param pagination Pagination parameters (optional)
   * @returns Paginated model breakdown data
   */
  async getModelBreakdown(
    filters: AdminUsageFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<ModelBreakdown>> {
    const params = new URLSearchParams();

    if (pagination?.page !== undefined) {
      params.append('page', pagination.page.toString());
    }
    if (pagination?.limit !== undefined) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.sortBy) {
      params.append('sortBy', pagination.sortBy);
    }
    if (pagination?.sortOrder) {
      params.append('sortOrder', pagination.sortOrder);
    }

    const url = `/admin/usage/by-model${params.toString() ? `?${params.toString()}` : ''}`;

    return apiClient.post<PaginatedResponse<ModelBreakdown>>(url, filters);
  }

  /**
   * Get provider breakdown data with pagination
   * @param filters Date range and dimension filters
   * @param pagination Pagination parameters (optional)
   * @returns Paginated provider breakdown data
   */
  async getProviderBreakdown(
    filters: AdminUsageFilters,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<ProviderBreakdown>> {
    const params = new URLSearchParams();

    if (pagination?.page !== undefined) {
      params.append('page', pagination.page.toString());
    }
    if (pagination?.limit !== undefined) {
      params.append('limit', pagination.limit.toString());
    }
    if (pagination?.sortBy) {
      params.append('sortBy', pagination.sortBy);
    }
    if (pagination?.sortOrder) {
      params.append('sortOrder', pagination.sortOrder);
    }

    const url = `/admin/usage/by-provider${params.toString() ? `?${params.toString()}` : ''}`;

    return apiClient.post<PaginatedResponse<ProviderBreakdown>>(url, filters);
  }

  /**
   * Export usage data to CSV or JSON
   * @param filters Date range and dimension filters
   * @param format Export format (csv or json)
   * @returns Blob containing exported data
   */
  async exportUsageData(filters: AdminUsageFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const response = await fetch('/api/v1/admin/usage/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({
        ...filters,
        format,
      }),
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

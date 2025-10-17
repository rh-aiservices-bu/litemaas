import { apiClient } from './api';
import type { Analytics } from './adminUsage.service';

export interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  successRate: number;
  activeModels: number;
  topModels: {
    name: string;
    requests: number;
    tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    cost: number;
  }[];
  dailyUsage: {
    date: string;
    requests: number;
    tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    cost: number;
  }[];
  hourlyUsage: {
    hour: string;
    requests: number;
  }[];
  errorBreakdown: {
    type: string;
    count: number;
    percentage: number;
  }[];
}

export interface UsageFilters {
  startDate?: string;
  endDate?: string;
  modelId?: string;
  apiKeyId?: string;
}

/**
 * User usage filters for analytics (no userIds, user is automatically scoped)
 */
export interface UserUsageFilters {
  startDate: string;
  endDate: string;
  modelIds?: string[];
  providerIds?: string[];
  apiKeyIds?: string[];
}

class UsageService {
  /**
   * Get comprehensive usage analytics for the current user
   * Uses the same analytics engine as admin endpoint, automatically scoped to current user
   * @param filters Date range and optional dimension filters
   * @returns Analytics data with trends, breakdowns, and detailed metrics
   */
  async getAnalytics(filters: UserUsageFilters): Promise<Analytics> {
    return apiClient.post<Analytics>('/usage/analytics', filters);
  }

  /**
   * Get usage metrics (legacy endpoint - consider using getAnalytics instead)
   * @deprecated Use getAnalytics for comprehensive analytics
   */
  async getUsageMetrics(filters?: UsageFilters): Promise<UsageMetrics> {
    const params = new URLSearchParams();

    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.modelId) params.append('modelId', filters.modelId);
    if (filters?.apiKeyId) params.append('apiKeyId', filters.apiKeyId);

    return apiClient.get<UsageMetrics>(`/usage/metrics?${params}`);
  }

  /**
   * Export usage data using analytics data
   * @param filters User usage filters (optional - defaults to last 30 days)
   * @param format Export format (csv or json)
   * @returns Blob containing exported data
   */
  async exportUsageData(filters?: UserUsageFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const params = new URLSearchParams({ format });

    // Use provided filters or default to last 30 days
    const endDate = filters?.endDate || new Date().toISOString().split('T')[0];
    const startDate =
      filters?.startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    params.append('startDate', startDate);
    params.append('endDate', endDate);

    if (filters?.modelIds?.length) {
      filters.modelIds.forEach((id) => params.append('modelIds[]', id));
    }
    if (filters?.providerIds?.length) {
      filters.providerIds.forEach((id) => params.append('providerIds[]', id));
    }
    if (filters?.apiKeyIds?.length) {
      filters.apiKeyIds.forEach((id) => params.append('apiKeyIds[]', id));
    }

    const response = await fetch(`/api/v1/usage/export?${params}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export usage data');
    }

    return response.blob();
  }
}

export const usageService = new UsageService();

/**
 * Transform backend Analytics to match MetricsOverview component expectations
 * Same transformation as admin usage service for consistency
 *
 * @param apiData - Analytics from backend API
 * @returns Transformed data matching component interface
 */
export function transformAnalyticsForComponent(apiData: Analytics): any {
  return {
    ...apiData,
    // Keep period dates as strings - they're already in YYYY-MM-DD format
    period: apiData.period,
    // Backend provides dailyUsage, topModels, and topUsers directly
    dailyUsage: apiData.dailyUsage || [],
    topModels: apiData.topModels || [],
    topUsers: apiData.topUsers || [],
  };
}

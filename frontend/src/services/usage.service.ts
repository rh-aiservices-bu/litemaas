import { apiClient } from './api';
import type { Analytics } from './adminUsage.service';
import type { UserBudgetInfo } from '../types/users';

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
   * Get current user's budget consumption info
   * @returns Budget info with spend, limits, and reset date
   */
  async getBudgetInfo(): Promise<UserBudgetInfo> {
    return apiClient.get<UserBudgetInfo>('/usage/budget');
  }

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
   * Export usage data using analytics data
   * @param filters User usage filters (optional - defaults to last 30 days)
   * @param format Export format (csv or json)
   * @returns Blob containing exported data
   */
  async exportUsageData(filters?: UserUsageFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const endDate = filters?.endDate || new Date().toISOString().split('T')[0];
    const startDate =
      filters?.startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await fetch('/api/v1/usage/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({
        startDate,
        endDate,
        format,
        modelIds: filters?.modelIds,
        providerIds: filters?.providerIds,
        apiKeyIds: filters?.apiKeyIds,
      }),
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

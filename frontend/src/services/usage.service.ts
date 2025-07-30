import { apiClient } from './api';

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
    cost: number;
  }[];
  dailyUsage: {
    date: string;
    requests: number;
    tokens: number;
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

class UsageService {
  async getUsageMetrics(filters?: UsageFilters): Promise<UsageMetrics> {
    const params = new URLSearchParams();

    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.modelId) params.append('modelId', filters.modelId);
    if (filters?.apiKeyId) params.append('apiKeyId', filters.apiKeyId);

    return apiClient.get<UsageMetrics>(`/usage/metrics?${params}`);
  }

  async exportUsageData(filters?: UsageFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const params = new URLSearchParams({ format });

    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.modelId) params.append('modelId', filters.modelId);
    if (filters?.apiKeyId) params.append('apiKeyId', filters.apiKeyId);

    const response = await fetch(`/api/usage/export?${params}`, {
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

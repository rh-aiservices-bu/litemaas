// frontend/src/services/config.service.ts

import { apiClient } from './api';

/**
 * Admin analytics public configuration from backend
 */
export interface AdminAnalyticsPublicConfig {
  pagination: {
    defaultPageSize: number;
    maxPageSize: number;
    minPageSize: number;
  };
  topLimits: {
    users: number;
    models: number;
    providers: number;
  };
  dateRangeLimits: {
    maxAnalyticsDays: number;
    maxExportDays: number;
  };
  warnings: {
    largeDateRangeDays: number;
  };
  trends: {
    calculationPrecision: number;
  };
  export: {
    maxRows: number;
  };
}

/**
 * Backend configuration response
 */
export interface BackendConfig {
  version: string;
  usageCacheTtlMinutes: number;
  environment: 'development' | 'production';
  // Admin analytics configuration
  adminAnalytics: AdminAnalyticsPublicConfig;
  // Legacy fields for backwards compatibility
  litellmApiUrl?: string;
  authMode?: 'oauth' | 'mock';
}

class ConfigService {
  /**
   * Fetch public configuration from backend
   * No authentication required
   */
  async getConfig(): Promise<BackendConfig> {
    // Fetch both configs in parallel for efficiency
    const [baseConfig, adminAnalyticsConfig] = await Promise.all([
      apiClient.get<Omit<BackendConfig, 'adminAnalytics'>>('/config'),
      this.getAdminAnalyticsConfig(),
    ]);

    return {
      ...baseConfig,
      adminAnalytics: adminAnalyticsConfig,
    };
  }

  /**
   * Fetch admin analytics configuration from backend
   */
  async getAdminAnalyticsConfig(): Promise<AdminAnalyticsPublicConfig> {
    return apiClient.get<AdminAnalyticsPublicConfig>('/config/admin-analytics');
  }
}

export const configService = new ConfigService();

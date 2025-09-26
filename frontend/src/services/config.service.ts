import { apiClient } from './api';

/**
 * Backend configuration response
 */
export interface BackendConfig {
  version: string;
  usageCacheTtlMinutes: number;
  environment: 'development' | 'production';
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
    return apiClient.get<BackendConfig>('/config');
  }
}

export const configService = new ConfigService();

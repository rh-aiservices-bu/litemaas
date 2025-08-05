import { apiClient } from './api';

export interface ConfigResponse {
  litellmApiUrl: string;
  authMode: 'oauth' | 'mock';
}

export class ConfigService {
  async getConfig(): Promise<ConfigResponse> {
    return apiClient.get<ConfigResponse>('/config');
  }
}

export const configService = new ConfigService();

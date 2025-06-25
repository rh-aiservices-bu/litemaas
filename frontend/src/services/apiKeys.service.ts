import { apiClient } from './api';

export interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  fullKey?: string;
  status: 'active' | 'revoked' | 'expired';
  permissions: string[];
  usageCount: number;
  rateLimit: number;
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  description?: string;
}

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  permissions: string[];
  rateLimit: number;
  expiresAt?: string;
}

export interface ApiKeysResponse {
  data: ApiKey[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiKeysService {
  async getApiKeys(page = 1, limit = 20): Promise<ApiKeysResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    return apiClient.get<ApiKeysResponse>(`/api-keys?${params}`);
  }

  async getApiKey(keyId: string): Promise<ApiKey> {
    return apiClient.get<ApiKey>(`/api-keys/${keyId}`);
  }

  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKey> {
    return apiClient.post<ApiKey>('/api-keys', request);
  }

  async revokeApiKey(keyId: string): Promise<void> {
    return apiClient.delete(`/api-keys/${keyId}`);
  }

  async updateApiKey(keyId: string, updates: Partial<CreateApiKeyRequest>): Promise<ApiKey> {
    return apiClient.patch<ApiKey>(`/api-keys/${keyId}`, updates);
  }
}

export const apiKeysService = new ApiKeysService();
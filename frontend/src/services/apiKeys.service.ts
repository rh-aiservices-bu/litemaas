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

// Backend response interface
interface BackendApiKeyDetails {
  id: string;
  subscriptionId: string;
  userId: string;
  name?: string;
  keyPrefix: string;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  revokedAt?: string;
  metadata?: {
    permissions?: string[];
    environment?: string;
    revokedReason?: string;
  };
}

interface BackendApiKeysResponse {
  data: BackendApiKeyDetails[];
  total: number;
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
  private mapBackendToFrontend(backend: BackendApiKeyDetails): ApiKey {
    let status: 'active' | 'revoked' | 'expired' = 'active';
    
    if (backend.revokedAt) {
      status = 'revoked';
    } else if (backend.expiresAt && new Date(backend.expiresAt) < new Date()) {
      status = 'expired';
    } else if (!backend.isActive) {
      status = 'revoked';
    }

    return {
      id: backend.id,
      name: backend.name || 'Unnamed Key',
      keyPreview: backend.keyPrefix + '...',
      status,
      permissions: backend.metadata?.permissions || ['read'],
      usageCount: Math.floor(Math.random() * 1000), // Mock usage count
      rateLimit: 1000, // Default rate limit
      createdAt: backend.createdAt,
      lastUsed: backend.lastUsedAt,
      expiresAt: backend.expiresAt,
      description: backend.metadata?.environment ? `${backend.metadata.environment} environment` : undefined,
    };
  }

  async getApiKeys(page = 1, limit = 20): Promise<ApiKeysResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await apiClient.get<BackendApiKeysResponse>(`/api-keys?${params}`);
    
    return {
      data: response.data.map(key => this.mapBackendToFrontend(key)),
      pagination: {
        page,
        limit,
        total: response.total,
        totalPages: Math.ceil(response.total / limit),
      },
    };
  }

  async getApiKey(keyId: string): Promise<ApiKey> {
    const response = await apiClient.get<BackendApiKeyDetails>(`/api-keys/${keyId}`);
    return this.mapBackendToFrontend(response);
  }

  async createApiKey(request: CreateApiKeyRequest): Promise<ApiKey> {
    const response = await apiClient.post<BackendApiKeyDetails>('/api-keys', request);
    const mappedKey = this.mapBackendToFrontend(response);
    
    // If this is a new key creation response, it might have the full key
    if ((response as any).key) {
      mappedKey.fullKey = (response as any).key;
    }
    
    return mappedKey;
  }

  async revokeApiKey(keyId: string): Promise<void> {
    return apiClient.delete(`/api-keys/${keyId}`);
  }

  async updateApiKey(keyId: string, updates: Partial<CreateApiKeyRequest>): Promise<ApiKey> {
    const response = await apiClient.patch<BackendApiKeyDetails>(`/api-keys/${keyId}`, updates);
    return this.mapBackendToFrontend(response);
  }
}

export const apiKeysService = new ApiKeysService();
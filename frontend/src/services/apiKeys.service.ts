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
  // Multi-model support
  models?: string[];
  modelDetails?: {
    id: string;
    name: string;
    provider: string;
    contextLength?: number;
  }[];
}

// Backend response interface
interface BackendApiKeyDetails {
  id: string;
  subscriptionId?: string; // Now optional for backward compatibility
  userId: string;
  name?: string;
  prefix: string; // Updated from keyPrefix to match backend response
  models?: string[]; // New field for multi-model support
  modelDetails?: {
    id: string;
    name: string;
    provider: string;
    contextLength?: number;
  }[]; // New field for model details
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
  // Multi-model support - use modelIds for new keys
  modelIds?: string[];
  // Legacy support - deprecated
  subscriptionId?: string;
  name?: string;
  expiresAt?: string;
  metadata?: {
    description?: string;
    permissions?: string[];
    rateLimit?: number;
  };
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

    // Generate a demo full key based on the prefix for demo purposes
    const generateDemoFullKey = (prefix: string): string => {
      // Generate a realistic-looking API key for demo
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let suffix = '';
      for (let i = 0; i < 45; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `${prefix}_${suffix}`;
    };

    return {
      id: backend.id,
      name: backend.name || 'Unnamed Key',
      keyPreview: backend.prefix + '...',
      fullKey: generateDemoFullKey(backend.prefix), // Always generate full key for demo
      status,
      permissions: backend.metadata?.permissions || ['read'],
      usageCount: Math.floor(Math.random() * 1000), // Mock usage count
      rateLimit: 1000, // Default rate limit
      createdAt: backend.createdAt,
      lastUsed: backend.lastUsedAt,
      expiresAt: backend.expiresAt,
      description: backend.metadata?.environment ? `${backend.metadata.environment} environment` : undefined,
      models: backend.models,
      modelDetails: backend.modelDetails,
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

  async deleteApiKey(keyId: string): Promise<void> {
    return apiClient.delete(`/api-keys/${keyId}`);
  }

  async updateApiKey(keyId: string, updates: Partial<CreateApiKeyRequest>): Promise<ApiKey> {
    const response = await apiClient.patch<BackendApiKeyDetails>(`/api-keys/${keyId}`, updates);
    return this.mapBackendToFrontend(response);
  }
}

export const apiKeysService = new ApiKeysService();
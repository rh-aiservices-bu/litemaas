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
  keyPrefix: string; // Backend returns keyPrefix, not prefix
  liteLLMKey?: string; // Full LiteLLM key from backend (for newly created keys)
  liteLLMKeyId?: string; // LiteLLM key ID for internal use
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

    // Use the actual LiteLLM key if available, otherwise show a placeholder
    const fullKey = backend.liteLLMKey || backend.liteLLMKeyId;
    const keyPreview = backend.keyPrefix ? `${backend.keyPrefix}...` : 'sk-****...';

    return {
      id: backend.id,
      name: backend.name || 'Unnamed Key',
      keyPreview,
      fullKey: fullKey || undefined, // Use actual key or undefined if not available
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
    
    // The backend should provide liteLLMKey or key field for newly created keys
    // mapBackendToFrontend already handles this, but we can override if needed
    if ((response as any).liteLLMKey || (response as any).key) {
      mappedKey.fullKey = (response as any).liteLLMKey || (response as any).key;
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

  /**
   * Securely retrieve the full API key value
   * This method calls the secure endpoint that requires recent authentication
   */
  async retrieveFullKey(keyId: string): Promise<{
    key: string;
    keyType: string;
    retrievedAt: string;
  }> {
    try {
      const response = await apiClient.post<{
        key: string;
        keyType: string;
        retrievedAt: string;
      }>(`/api-keys/${keyId}/reveal`);
      
      return response;
    } catch (error: any) {
      // Handle specific error cases for better UX
      if (error.status === 403 && error.response?.error?.code === 'TOKEN_TOO_OLD') {
        throw new Error('Recent authentication required. Please refresh the page and try again.');
      } else if (error.status === 429 && error.response?.error?.code === 'KEY_OPERATION_RATE_LIMITED') {
        const details = error.response.error.details;
        throw new Error(`Too many key retrieval attempts. Please wait ${details?.retryAfter || 300} seconds before trying again.`);
      } else if (error.status === 404) {
        throw new Error('API key not found or no LiteLLM key associated.');
      } else if (error.status === 403 && error.message?.includes('inactive')) {
        throw new Error('This API key is inactive and cannot be retrieved.');
      } else if (error.status === 403 && error.message?.includes('expired')) {
        throw new Error('This API key has expired and cannot be retrieved.');
      }
      
      // Generic error fallback
      throw new Error('Failed to retrieve API key. Please try again or contact support.');
    }
  }
}

export const apiKeysService = new ApiKeysService();
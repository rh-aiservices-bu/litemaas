export interface ApiKey {
  id: string;
  subscriptionId: string;
  name?: string;
  keyHash: string;
  keyPrefix: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  revokedAt?: Date;
}

export interface ApiKeyDetails {
  id: string;
  name?: string;
  prefix: string;
  subscriptionId: string;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface CreateApiKeyDto {
  subscriptionId: string;
  name?: string;
  expiresAt?: Date;
}

export interface CreateApiKeyResponse {
  id: string;
  name?: string;
  key: string;
  subscriptionId: string;
  createdAt: Date;
}

export interface RotateApiKeyResponse {
  id: string;
  key: string;
  rotatedAt: Date;
}

export interface ApiKeyListParams {
  page?: number;
  limit?: number;
  subscriptionId?: string;
  isActive?: boolean;
}

export interface ApiKeyValidation {
  isValid: boolean;
  apiKey?: ApiKey;
  subscription?: {
    id: string;
    userId: string;
    modelId: string;
    status: string;
    remainingRequests: number;
    remainingTokens: number;
  };
  error?: string;
}
import { ApiKeyMetadata } from './common.types.js';

/**
 * API key permissions interface
 */
export interface ApiKeyPermissions {
  allowChatCompletions?: boolean;
  allowEmbeddings?: boolean;
  allowCompletions?: boolean;
}

/**
 * New interface for multi-model API key creation
 */
export interface CreateApiKeyRequest {
  modelIds: string[]; // Array of model IDs
  name?: string;
  expiresAt?: Date;
  maxBudget?: number;
  budgetDuration?: string;
  tpmLimit?: number;
  rpmLimit?: number;
  teamId?: string;
  tags?: string[];
  permissions?: ApiKeyPermissions;
  softBudget?: number;
  guardrails?: string[];
  metadata?: ApiKeyMetadata;
}

/**
 * Legacy interface for backward compatibility
 */
export interface LegacyCreateApiKeyRequest extends Omit<CreateApiKeyRequest, 'modelIds'> {
  subscriptionId: string;
}

/**
 * Interface for updating API key properties
 */
export interface UpdateApiKeyRequest {
  name?: string;
  modelIds?: string[];
  metadata?: {
    description?: string;
    permissions?: string[];
    rateLimit?: number;
  };
}

export interface ApiKey {
  id: string;
  userId: string;
  models: string[]; // Array of model IDs instead of single subscription
  name: string;
  keyHash: string;
  keyPrefix: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  // LiteLLM integration fields
  liteLLMKeyId?: string;
  lastSyncAt?: Date;
  syncStatus?: 'pending' | 'synced' | 'error';
  syncError?: string;
  // Budget and limits
  maxBudget?: number;
  currentSpend?: number;
  tpmLimit?: number;
  rpmLimit?: number;
  // Metadata
  metadata?: ApiKeyMetadata;
}

export interface ApiKeyDetails {
  id: string;
  name?: string;
  prefix: string;
  models: string[]; // Updated to support multi-model
  subscriptionId?: string; // Kept for backward compatibility
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
  models: string[]; // Updated to support multi-model
  subscriptionId?: string; // Kept for backward compatibility
  createdAt: Date;
}

export interface RotateApiKeyResponse {
  id: string;
  key: string;
  rotatedAt: Date;
}

/**
 * LiteLLM-specific API key types
 */
export interface LiteLLMKeyGenerationRequest {
  key_alias?: string;
  duration?: string; // "30d", "1h", etc.
  models?: string[];
  max_budget?: number;
  user_id?: string;
  team_id?: string;
  metadata?: ApiKeyMetadata;
  tpm_limit?: number; // tokens per minute
  rpm_limit?: number; // requests per minute
  budget_duration?: string; // "monthly", "daily", etc.
  permissions?: {
    allow_chat_completions?: boolean;
    allow_embeddings?: boolean;
    allow_completions?: boolean;
    [key: string]: any;
  };
  guardrails?: string[];
  blocked?: boolean;
  tags?: string[];
  allowed_routes?: string[];
  soft_budget?: number;
}

export interface LiteLLMKeyGenerationResponse {
  key: string;
  key_name?: string;
  expires?: string;
  token_id?: string;
  user_id?: string;
  team_id?: string;
  max_budget?: number;
  current_spend?: number;
  created_by?: string;
  created_at?: string;
  // Includes all fields from the request
  [key: string]: any;
}

export interface LiteLLMKeyInfo {
  key_name?: string;
  spend: number;
  max_budget?: number;
  models?: string[];
  tpm_limit?: number;
  rpm_limit?: number;
  user_id?: string;
  team_id?: string;
  expires?: string;
  budget_reset_at?: string;
  soft_budget?: number;
  blocked?: boolean;
  tags?: string[];
  metadata?: ApiKeyMetadata;
}

/**
 * LiteLLM v1.81.0+ wraps /key/info response in { key, info } structure
 */
export interface LiteLLMKeyInfoResponse {
  key: string;
  info: LiteLLMKeyInfo;
}

/**
 * Enhanced API key interface that includes model and subscription details
 */
export interface EnhancedApiKey extends ApiKey {
  budgetDuration?: string;
  softBudget?: number;
  budgetResetAt?: Date;
  budgetUtilization?: number; // calculated: currentSpend / maxBudget * 100
  modelDetails?: Array<{
    id: string;
    name: string;
    provider: string;
    contextLength?: number;
  }>;
  subscriptionDetails?: Array<{
    subscriptionId: string;
    modelId: string;
    status: string;
    quotaRequests: number;
    usedRequests: number;
  }>;
  // PHASE 1 FIX: Add actual LiteLLM key fields
  liteLLMKey?: string; // Masked key for list views, full key for individual retrieval
  liteLLMKeyId?: string; // Full LiteLLM key ID for internal use
}

/**
 * Enhanced create API key request with LiteLLM support
 */
export interface EnhancedCreateApiKeyDto extends CreateApiKeyDto {
  // LiteLLM-specific options
  maxBudget?: number;
  budgetDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tpmLimit?: number;
  rpmLimit?: number;
  allowedModels?: string[];
  teamId?: string;
  tags?: string[];
  permissions?: {
    allowChatCompletions?: boolean;
    allowEmbeddings?: boolean;
    allowCompletions?: boolean;
  };
  softBudget?: number;
  guardrails?: string[];
}

export interface ApiKeySpendInfo {
  keyId: string;
  currentSpend: number;
  maxBudget?: number;
  budgetUtilization: number; // percentage
  remainingBudget?: number;
  spendResetAt?: Date;
  lastUpdatedAt: Date;
}

export interface ApiKeyUsageMetrics {
  keyId: string;
  requestCount: number;
  tokenCount: number;
  errorCount: number;
  lastRequestAt?: Date;
  averageResponseTime?: number;
  topModels: Array<{
    model: string;
    requestCount: number;
    tokenCount: number;
  }>;
}

export interface ApiKeyListParams {
  page?: number;
  limit?: number;
  subscriptionId?: string; // Kept for backward compatibility
  modelIds?: string[]; // New multi-model filtering
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
  }; // Kept for backward compatibility
  subscriptions?: Array<{
    id: string;
    userId: string;
    modelId: string;
    status: string;
    remainingRequests: number;
    remainingTokens: number;
  }>; // New multi-model validation
  error?: string;
}

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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
}

/**
 * Enhanced API key interface that includes LiteLLM integration
 */
export interface EnhancedApiKey extends ApiKey {
  // LiteLLM integration fields
  liteLLMKeyId?: string;
  liteLLMInfo?: {
    key_name?: string;
    max_budget?: number;
    current_spend?: number;
    tpm_limit?: number;
    rpm_limit?: number;
    team_id?: string;
    budget_duration?: string;
    soft_budget?: number;
    blocked?: boolean;
    tags?: string[];
    models?: string[];
    spend_reset_at?: Date;
  };
  
  // Sync metadata
  lastSyncAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'error';
  syncError?: string;
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
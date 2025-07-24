export enum SubscriptionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export interface Subscription {
  id: string;
  userId: string;
  modelId: string;
  status: SubscriptionStatus;
  quotaRequests: number;
  quotaTokens: number;
  usedRequests: number;
  usedTokens: number;
  resetAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionQuota {
  requests: number;
  tokens: number;
}

export interface SubscriptionUsage {
  requests: number;
  tokens: number;
}

export interface CreateSubscriptionDto {
  modelId: string;
  quota: SubscriptionQuota;
  expiresAt?: Date;
}

export interface UpdateSubscriptionDto {
  quota?: Partial<SubscriptionQuota>;
  status?: SubscriptionStatus;
  expiresAt?: Date;
}

export interface SubscriptionDetails extends Subscription {
  user?: {
    username: string;
    email: string;
  };
  model?: {
    name: string;
    provider: string;
  };
  remainingRequests: number;
  remainingTokens: number;
}

export interface SubscriptionWithApiKey extends SubscriptionDetails {
  apiKey: {
    id: string;
    key: string;
    createdAt: Date;
  };
}

/**
 * Enhanced subscription types for LiteLLM integration
 */
export interface EnhancedSubscription extends Subscription {
  // LiteLLM integration fields
  liteLLMInfo?: {
    keyId?: string;
    teamId?: string;
    maxBudget?: number;
    currentSpend?: number;
    budgetDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    tpmLimit?: number;
    rpmLimit?: number;
    allowedModels?: string[];
    spendResetAt?: Date;
    budgetUtilization?: number;
  };
  
  // Enhanced quota and usage tracking
  budgetInfo?: {
    maxBudget?: number;
    currentSpend?: number;
    remainingBudget?: number;
    budgetUtilization?: number;
    spendResetAt?: Date;
  };
  
  rateLimits?: {
    tpmLimit?: number;
    rpmLimit?: number;
    currentTpm?: number;
    currentRpm?: number;
  };
  
  // Team association
  teamId?: string;
  teamInfo?: {
    id: string;
    name: string;
    role: 'admin' | 'member' | 'viewer';
  };
  
  // Sync metadata
  lastSyncAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'error';
  syncError?: string;
}

export interface EnhancedCreateSubscriptionDto extends CreateSubscriptionDto {
  // LiteLLM-specific options
  maxBudget?: number;
  budgetDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tpmLimit?: number;
  rpmLimit?: number;
  allowedModels?: string[];
  teamId?: string;
  softBudget?: number;
  
  // API key generation options
  generateApiKey?: boolean;
  apiKeyAlias?: string;
  apiKeyTags?: string[];
  apiKeyPermissions?: {
    allowChatCompletions?: boolean;
    allowEmbeddings?: boolean;
    allowCompletions?: boolean;
  };
}

export interface EnhancedUpdateSubscriptionDto extends UpdateSubscriptionDto {
  // LiteLLM budget and limit updates
  maxBudget?: number;
  budgetDuration?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  tpmLimit?: number;
  rpmLimit?: number;
  allowedModels?: string[];
  teamId?: string;
  softBudget?: number;
}

export interface SubscriptionBudgetInfo {
  subscriptionId: string;
  maxBudget?: number;
  currentSpend: number;
  budgetUtilization: number; // percentage
  remainingBudget?: number;
  budgetDuration?: string;
  spendResetAt?: Date;
  softBudget?: number;
  alertTriggered?: boolean;
  lastUpdatedAt: Date;
}

export interface SubscriptionUsageAnalytics {
  subscriptionId: string;
  period: {
    start: Date;
    end: Date;
    type: 'day' | 'week' | 'month' | 'year';
  };
  usage: {
    requestCount: number;
    tokenCount: number;
    totalSpend: number;
    averageRequestCost: number;
    averageTokenCost: number;
  };
  models: Array<{
    modelId: string;
    modelName: string;
    requestCount: number;
    tokenCount: number;
    spend: number;
  }>;
  rateLimitEvents?: {
    tpmViolations: number;
    rpmViolations: number;
  };
}

export interface SubscriptionSyncRequest {
  subscriptionId: string;
  forceSync?: boolean;
  syncBudget?: boolean;
  syncUsage?: boolean;
  syncRateLimits?: boolean;
}

export interface SubscriptionSyncResponse {
  subscriptionId: string;
  syncedAt: Date;
  success: boolean;
  error?: string;
  changes?: {
    budgetUpdated?: boolean;
    usageUpdated?: boolean;
    rateLimitsUpdated?: boolean;
    keyUpdated?: boolean;
  };
}

export interface SubscriptionTeamTransfer {
  subscriptionId: string;
  fromTeamId?: string;
  toTeamId: string;
  transferredBy: string;
  reason?: string;
}

export interface BulkSubscriptionOperation {
  subscriptionIds: string[];
  operation: 'suspend' | 'activate' | 'update_budget' | 'update_limits' | 'transfer_team';
  params?: {
    maxBudget?: number;
    tpmLimit?: number;
    rpmLimit?: number;
    teamId?: string;
    reason?: string;
  };
  executedBy: string;
}

export interface BulkSubscriptionResult {
  totalCount: number;
  successCount: number;
  errorCount: number;
  results: Array<{
    subscriptionId: string;
    success: boolean;
    error?: string;
  }>;
  executedAt: Date;
}

export interface SubscriptionListParams {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus;
  modelId?: string;
}
export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

export interface UserUpdateData {
  roles?: string[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface UserActivity {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface UserStats {
  subscriptions: {
    total: number;
    active: number;
    suspended: number;
  };
  apiKeys: {
    total: number;
    active: number;
  };
  usage: {
    totalRequests: number;
    totalTokens: number;
    currentMonthRequests: number;
    currentMonthTokens: number;
  };
  lastLogin?: string;
  memberSince: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  roles: string[];
  createdAt: string;
}

// Admin User Details - Extended user info with budget and counts
export interface AdminUserDetails {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  roles: string[];
  isActive: boolean;
  maxBudget?: number;
  currentSpend?: number;
  tpmLimit?: number;
  rpmLimit?: number;
  syncStatus?: string;
  lastLoginAt?: string;
  createdAt: string;
  subscriptionsCount: number;
  activeSubscriptionsCount: number;
  apiKeysCount: number;
  activeApiKeysCount: number;
}

// Budget and limits update request
export interface UserBudgetLimitsUpdate {
  maxBudget?: number;
  tpmLimit?: number;
  rpmLimit?: number;
}

// Budget update response
export interface UserBudgetUpdated {
  id: string;
  maxBudget?: number;
  tpmLimit?: number;
  rpmLimit?: number;
  updatedAt: string;
}

// User's API key for display
export interface UserApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  models: string[];
  modelDetails?: {
    id: string;
    name: string;
    provider?: string;
  }[];
  isActive: boolean;
  maxBudget?: number;
  currentSpend?: number;
  tpmLimit?: number;
  rpmLimit?: number;
  budgetDuration?: string;
  softBudget?: number;
  budgetUtilization?: number;
  maxParallelRequests?: number;
  modelMaxBudget?: Record<string, { budgetLimit: number; timePeriod: string }>;
  modelRpmLimit?: Record<string, number>;
  modelTpmLimit?: Record<string, number>;
  lastUsedAt?: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

// Create API key for user request
export interface CreateApiKeyForUserRequest {
  name: string;
  modelIds: string[];
  expiresAt?: string;
  maxBudget?: number;
  tpmLimit?: number;
  rpmLimit?: number;
  maxParallelRequests?: number;
  budgetDuration?: string;
  softBudget?: number;
  modelMaxBudget?: Record<string, { budgetLimit: number; timePeriod: string }>;
  modelRpmLimit?: Record<string, number>;
  modelTpmLimit?: Record<string, number>;
}

// Created API key response (includes full key shown once)
export interface CreatedApiKeyResponse {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  models: string[];
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

// User's subscription for display
export interface UserSubscription {
  id: string;
  modelId: string;
  modelName: string;
  provider?: string;
  status: string;
  statusReason?: string;
  createdAt: string;
  statusChangedAt?: string;
}

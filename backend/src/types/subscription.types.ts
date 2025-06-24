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

export interface SubscriptionListParams {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus;
  modelId?: string;
}
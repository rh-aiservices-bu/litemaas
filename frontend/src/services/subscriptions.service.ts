import { apiClient } from './api';

export interface Subscription {
  id: string;
  modelId: string;
  modelName: string;
  provider: string;
  status: 'active' | 'suspended' | 'expired' | 'pending';
  plan: 'starter' | 'professional' | 'enterprise';
  usageLimit: number;
  usageUsed: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  costPerMonth: number;
  features: string[];
  createdAt: string;
  expiresAt?: string;
}

// Backend response interface
interface BackendSubscriptionDetails {
  id: string;
  userId: string;
  modelId: string;
  modelName?: string;
  provider?: string;
  status: 'pending' | 'active' | 'suspended' | 'cancelled' | 'expired';
  quotaRequests: number;
  quotaTokens: number;
  usedRequests: number;
  usedTokens: number;
  remainingRequests: number;
  remainingTokens: number;
  utilizationPercent: {
    requests: number;
    tokens: number;
  };
  resetAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    plan?: string;
    billingCycle?: string;
    features?: string[];
  };
}

interface BackendSubscriptionsResponse {
  data: BackendSubscriptionDetails[];
  total: number;
}

export interface CreateSubscriptionRequest {
  modelId: string;
  plan: 'starter' | 'professional' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
}

export interface UpdateSubscriptionRequest {
  plan?: 'starter' | 'professional' | 'enterprise';
  billingCycle?: 'monthly' | 'yearly';
}

export interface SubscriptionsResponse {
  data: Subscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class SubscriptionsService {
  private mapBackendToFrontend(backend: BackendSubscriptionDetails): Subscription {
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1, 1); // First day of next month
    
    return {
      id: backend.id,
      modelId: backend.modelId,
      modelName: backend.modelName || backend.modelId,
      provider: backend.provider || 'unknown',
      status: backend.status === 'cancelled' ? 'expired' : backend.status,
      plan: (backend.metadata?.plan as 'starter' | 'professional' | 'enterprise') || 'starter',
      usageLimit: backend.quotaRequests,
      usageUsed: backend.usedRequests,
      billingCycle: (backend.metadata?.billingCycle as 'monthly' | 'yearly') || 'monthly',
      nextBillingDate: backend.resetAt || resetDate.toISOString(),
      costPerMonth: this.calculateCostPerMonth(backend.metadata?.plan || 'starter'),
      features: backend.metadata?.features || [],
      createdAt: backend.createdAt,
      expiresAt: backend.expiresAt,
    };
  }

  private calculateCostPerMonth(plan: string): number {
    const costs = {
      starter: 29,
      professional: 99,
      enterprise: 299
    };
    return costs[plan as keyof typeof costs] || 29;
  }

  async getSubscriptions(page = 1, limit = 20): Promise<SubscriptionsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await apiClient.get<BackendSubscriptionsResponse>(`/subscriptions?${params}`);
    
    return {
      data: response.data.map(sub => this.mapBackendToFrontend(sub)),
      pagination: {
        page,
        limit,
        total: response.total,
        totalPages: Math.ceil(response.total / limit),
      },
    };
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.get<BackendSubscriptionDetails>(`/subscriptions/${subscriptionId}`);
    return this.mapBackendToFrontend(response);
  }

  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    const response = await apiClient.post<BackendSubscriptionDetails>('/subscriptions', request);
    return this.mapBackendToFrontend(response);
  }

  async updateSubscription(subscriptionId: string, request: UpdateSubscriptionRequest): Promise<Subscription> {
    const response = await apiClient.patch<BackendSubscriptionDetails>(`/subscriptions/${subscriptionId}`, request);
    return this.mapBackendToFrontend(response);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    return apiClient.delete(`/subscriptions/${subscriptionId}`);
  }

  async suspendSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.post<BackendSubscriptionDetails>(`/subscriptions/${subscriptionId}/suspend`);
    return this.mapBackendToFrontend(response);
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.post<BackendSubscriptionDetails>(`/subscriptions/${subscriptionId}/resume`);
    return this.mapBackendToFrontend(response);
  }
}

export const subscriptionsService = new SubscriptionsService();
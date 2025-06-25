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
  async getSubscriptions(page = 1, limit = 20): Promise<SubscriptionsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    return apiClient.get<SubscriptionsResponse>(`/subscriptions?${params}`);
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    return apiClient.get<Subscription>(`/subscriptions/${subscriptionId}`);
  }

  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    return apiClient.post<Subscription>('/subscriptions', request);
  }

  async updateSubscription(subscriptionId: string, request: UpdateSubscriptionRequest): Promise<Subscription> {
    return apiClient.patch<Subscription>(`/subscriptions/${subscriptionId}`, request);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    return apiClient.delete(`/subscriptions/${subscriptionId}`);
  }

  async suspendSubscription(subscriptionId: string): Promise<Subscription> {
    return apiClient.post<Subscription>(`/subscriptions/${subscriptionId}/suspend`);
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    return apiClient.post<Subscription>(`/subscriptions/${subscriptionId}/resume`);
  }
}

export const subscriptionsService = new SubscriptionsService();
import { apiClient } from './api';

export interface Subscription {
  id: string;
  modelId: string;
  modelName: string;
  provider: string;
  status: 'active' | 'suspended' | 'expired'; // Remove 'pending'

  // Real usage and pricing from LiteLLM
  quotaRequests: number;
  quotaTokens: number;
  usedRequests: number;
  usedTokens: number;

  // Model pricing (per token)
  pricing: {
    inputCostPerToken: number;
    outputCostPerToken: number;
    currency: string;
  };

  // Legacy fields for compatibility
  usageLimit: number;
  usageUsed: number;
  features: string[];
  createdAt: string;
  expiresAt?: string;

  // Model details for UI display
  modelDescription?: string;
  modelContextLength?: number;
  supportsVision?: boolean;
  supportsFunctionCalling?: boolean;
  supportsParallelFunctionCalling?: boolean;
  supportsToolChoice?: boolean;
}

// Backend response interface
interface BackendSubscriptionDetails {
  id: string;
  userId: string;
  modelId: string;
  modelName?: string;
  provider?: string;
  status: 'active' | 'suspended' | 'cancelled' | 'expired'; // Remove 'pending'
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

  // LiteLLM pricing info
  pricing?: {
    inputCostPerToken: number;
    outputCostPerToken: number;
    currency: string;
  };

  metadata?: {
    features?: string[];
  };

  // Model details for UI display
  modelDescription?: string;
  modelContextLength?: number;
  modelSupportsVision?: boolean;
  modelSupportsFunctionCalling?: boolean;
  modelSupportsParallelFunctionCalling?: boolean;
  modelSupportsToolChoice?: boolean;
}

interface BackendSubscriptionsResponse {
  data: BackendSubscriptionDetails[];
  total: number;
}

export interface CreateSubscriptionRequest {
  modelId: string;
  quotaRequests?: number;
  quotaTokens?: number;
  expiresAt?: string;
}

export interface UpdateSubscriptionRequest {
  quotaRequests?: number;
  quotaTokens?: number;
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
    return {
      id: backend.id,
      modelId: backend.modelId,
      modelName: backend.modelName || backend.modelId,
      provider: backend.provider || 'unknown',
      status: backend.status === 'cancelled' ? 'expired' : (backend.status as any),

      // Map quotas and usage
      quotaRequests: backend.quotaRequests || 0,
      quotaTokens: backend.quotaTokens || 0,
      usedRequests: backend.usedRequests || 0,
      usedTokens: backend.usedTokens || 0,

      // Map pricing if available
      pricing: backend.pricing
        ? {
            inputCostPerToken: backend.pricing.inputCostPerToken,
            outputCostPerToken: backend.pricing.outputCostPerToken,
            currency: backend.pricing.currency || 'USD',
          }
        : {
            inputCostPerToken: 0,
            outputCostPerToken: 0,
            currency: 'USD',
          },

      // Legacy fields for compatibility
      usageLimit: backend.quotaTokens || 0,
      usageUsed: backend.usedTokens || 0,
      features: backend.metadata?.features || [],
      createdAt: backend.createdAt,
      expiresAt: backend.expiresAt,

      // Model details for UI display
      modelDescription: backend.modelDescription,
      modelContextLength: backend.modelContextLength,
      supportsVision: backend.modelSupportsVision,
      supportsFunctionCalling: backend.modelSupportsFunctionCalling,
      supportsParallelFunctionCalling: backend.modelSupportsParallelFunctionCalling,
      supportsToolChoice: backend.modelSupportsToolChoice,
    };
  }

  async getSubscriptions(page = 1, limit = 20): Promise<SubscriptionsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    const response = await apiClient.get<BackendSubscriptionsResponse>(`/subscriptions?${params}`);
    return {
      data: response.data.map((sub) => this.mapBackendToFrontend(sub)),
      pagination: {
        page,
        limit,
        total: response.total,
        totalPages: Math.ceil(response.total / limit),
      },
    };
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.get<BackendSubscriptionDetails>(
      `/subscriptions/${subscriptionId}`,
    );
    return this.mapBackendToFrontend(response);
  }

  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    const response = await apiClient.post<BackendSubscriptionDetails>('/subscriptions', request);

    // Expect active status immediately
    if (response.status !== 'active') {
      throw new Error('Subscription creation failed - expected active status');
    }

    return this.mapBackendToFrontend(response);
  }

  async updateSubscription(
    subscriptionId: string,
    request: UpdateSubscriptionRequest,
  ): Promise<Subscription> {
    const response = await apiClient.patch<BackendSubscriptionDetails>(
      `/subscriptions/${subscriptionId}`,
      request,
    );
    return this.mapBackendToFrontend(response);
  }

  async cancelSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.post<BackendSubscriptionDetails>(
      `/subscriptions/${subscriptionId}/cancel`,
    );
    return this.mapBackendToFrontend(response);
  }

  async suspendSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.post<BackendSubscriptionDetails>(
      `/subscriptions/${subscriptionId}/suspend`,
    );
    return this.mapBackendToFrontend(response);
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.post<BackendSubscriptionDetails>(
      `/subscriptions/${subscriptionId}/resume`,
    );
    return this.mapBackendToFrontend(response);
  }
}

export const subscriptionsService = new SubscriptionsService();

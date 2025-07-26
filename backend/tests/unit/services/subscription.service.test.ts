import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '../../../src/services/subscription.service';
import type { FastifyInstance } from 'fastify';
import { mockUser } from '../../setup';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockFastify: Partial<FastifyInstance>;

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    modelId: 'gpt-4',
    modelName: 'GPT-4',
    provider: 'OpenAI',
    status: 'active',
    quotaRequests: 10000,
    quotaTokens: 1000000,
    usedRequests: 500,
    usedTokens: 50000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: null,
  };

  const mockModel = {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    contextLength: 8192,
    pricing: {
      inputCostPerToken: 0.00003,
      outputCostPerToken: 0.00006,
    },
  };

  beforeEach(() => {
    mockFastify = {
      dbUtils: {
        queryOne: vi.fn(),
        queryMany: vi.fn(),
        query: vi.fn(),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      createNotFoundError: vi.fn((resource) => new Error(`${resource} not found`)),
      createValidationError: vi.fn((message) => new Error(message)),
    } as any;

    service = new SubscriptionService(mockFastify as FastifyInstance);
  });

  describe('createSubscription', () => {
    it('should create a new subscription with default quotas', async () => {
      const mockQueryOne = vi.fn()
        .mockResolvedValueOnce(mockModel) // Model exists check
        .mockResolvedValueOnce(null) // No existing subscription
        .mockResolvedValueOnce(mockSubscription); // Created subscription
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const subscriptionData = {
        userId: mockUser.id,
        modelId: 'gpt-4',
      };

      const result = await service.createSubscription(subscriptionData);

      expect(result).toBeDefined();
      expect(result.modelId).toBe(subscriptionData.modelId);
      expect(result.status).toBe('active');
      expect(result.quotaRequests).toBe(10000); // Default quota
      expect(result.quotaTokens).toBe(1000000); // Default quota
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subscriptions'),
        expect.arrayContaining([
          subscriptionData.userId,
          subscriptionData.modelId,
          'active', // Default status
          10000, // Default quota_requests
          1000000, // Default quota_tokens
        ])
      );
    });

    it('should prevent duplicate active subscriptions for same model', async () => {
      const mockQueryOne = vi.fn()
        .mockResolvedValueOnce(mockModel) // Model exists
        .mockResolvedValueOnce(mockSubscription); // Existing subscription found
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const subscriptionData = {
        userId: mockUser.id,
        modelId: 'gpt-4',
      };

      await expect(service.createSubscription(subscriptionData)).rejects.toThrow(
        'Active subscription already exists for this model'
      );
    });

    it('should validate model exists', async () => {
      const mockQueryOne = vi.fn().mockResolvedValueOnce(null); // Model not found
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const subscriptionData = {
        userId: mockUser.id,
        modelId: 'invalid-model',
      };

      await expect(service.createSubscription(subscriptionData)).rejects.toThrow(
        'Model not found'
      );
    });

    it('should allow custom quotas when provided', async () => {
      const mockQueryOne = vi.fn()
        .mockResolvedValueOnce(mockModel) // Model exists
        .mockResolvedValueOnce(null) // No existing subscription
        .mockResolvedValueOnce({ ...mockSubscription, quotaRequests: 50000, quotaTokens: 5000000 });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const subscriptionData = {
        userId: mockUser.id,
        modelId: 'gpt-4',
        quotaRequests: 50000,
        quotaTokens: 5000000,
      };

      const result = await service.createSubscription(subscriptionData);

      expect(result.quotaRequests).toBe(50000);
      expect(result.quotaTokens).toBe(5000000);
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return all subscriptions for a user with pricing information', async () => {
      const mockSubscriptions = [
        { ...mockSubscription, id: 'sub-1', modelId: 'gpt-4' },
        { ...mockSubscription, id: 'sub-2', modelId: 'claude-3-opus' },
      ];
      const mockQueryMany = vi.fn().mockResolvedValue(mockSubscriptions);
      mockFastify.dbUtils!.queryMany = mockQueryMany;

      const result = await service.getUserSubscriptions(mockUser.id);

      expect(result).toHaveLength(2);
      expect(result[0].modelId).toBe('gpt-4');
      expect(result[1].modelId).toBe('claude-3-opus');
      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('JOIN models m ON s.model_id = m.id'),
        [mockUser.id]
      );
    });

    it('should filter by status when provided', async () => {
      const mockQueryMany = vi.fn().mockResolvedValue([mockSubscription]);
      mockFastify.dbUtils!.queryMany = mockQueryMany;

      await service.getUserSubscriptions(mockUser.id, 'active');

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('AND s.status = $2'),
        [mockUser.id, 'active']
      );
    });

    it('should include pricing information in results', async () => {
      const subscriptionWithPricing = {
        ...mockSubscription,
        inputCostPerToken: 0.00003,
        outputCostPerToken: 0.00006,
      };
      const mockQueryMany = vi.fn().mockResolvedValue([subscriptionWithPricing]);
      mockFastify.dbUtils!.queryMany = mockQueryMany;

      const result = await service.getUserSubscriptions(mockUser.id);

      expect(result[0]).toHaveProperty('inputCostPerToken', 0.00003);
      expect(result[0]).toHaveProperty('outputCostPerToken', 0.00006);
    });
  });

  describe('updateSubscriptionQuotas', () => {
    it('should update subscription quotas', async () => {
      const mockQueryOne = vi.fn()
        .mockResolvedValueOnce(mockSubscription) // Subscription exists
        .mockResolvedValueOnce({ ...mockSubscription, quotaRequests: 20000, quotaTokens: 2000000 });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.updateSubscriptionQuotas(mockSubscription.id, mockUser.id, {
        quotaRequests: 20000,
        quotaTokens: 2000000,
      });

      expect(result.quotaRequests).toBe(20000);
      expect(result.quotaTokens).toBe(2000000);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET'),
        expect.arrayContaining([20000, 2000000, mockSubscription.id, mockUser.id])
      );
    });

    it('should return null for non-existent subscription', async () => {
      const mockQueryOne = vi.fn().mockResolvedValueOnce(null);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.updateSubscriptionQuotas('non-existent', mockUser.id, {
        quotaRequests: 20000,
      });

      expect(result).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      const mockQueryOne = vi.fn()
        .mockResolvedValueOnce(mockSubscription) // Subscription exists
        .mockResolvedValueOnce({ ...mockSubscription, status: 'cancelled' });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.cancelSubscription(mockSubscription.id, mockUser.id);

      expect(result).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET status = $1'),
        ['cancelled', mockSubscription.id, mockUser.id]
      );
    });

    it('should return false for non-existent subscription', async () => {
      const mockQueryOne = vi.fn().mockResolvedValueOnce(null);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.cancelSubscription('non-existent', mockUser.id);

      expect(result).toBe(false);
    });
  });

  describe('checkQuotaLimits', () => {
    it('should return true when usage is within limits', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue({ 
        ...mockSubscription, 
        usedRequests: 5000, 
        quotaRequests: 10000,
        usedTokens: 500000,
        quotaTokens: 1000000,
      });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.checkQuotaLimits(mockSubscription.id);

      expect(result.withinRequestLimit).toBe(true);
      expect(result.withinTokenLimit).toBe(true);
      expect(result.requestUtilization).toBe(50);
      expect(result.tokenUtilization).toBe(50);
    });

    it('should return false when request quota is exceeded', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue({ 
        ...mockSubscription, 
        usedRequests: 15000, 
        quotaRequests: 10000,
        usedTokens: 500000,
        quotaTokens: 1000000,
      });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.checkQuotaLimits(mockSubscription.id);

      expect(result.withinRequestLimit).toBe(false);
      expect(result.withinTokenLimit).toBe(true);
      expect(result.requestUtilization).toBe(150);
    });

    it('should return false when token quota is exceeded', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue({ 
        ...mockSubscription, 
        usedRequests: 5000, 
        quotaRequests: 10000,
        usedTokens: 1500000,
        quotaTokens: 1000000,
      });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.checkQuotaLimits(mockSubscription.id);

      expect(result.withinRequestLimit).toBe(true);
      expect(result.withinTokenLimit).toBe(false);
      expect(result.tokenUtilization).toBe(150);
    });

    it('should handle subscription not found', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue(null);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      await expect(service.checkQuotaLimits('non-existent')).rejects.toThrow(
        'Subscription not found'
      );
    });
  });

  describe('incrementUsage', () => {
    it('should increment request and token usage for a subscription', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.dbUtils!.query = mockQuery;

      await service.incrementUsage(mockSubscription.id, {
        requests: 1,
        inputTokens: 100,
        outputTokens: 50,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET used_requests = used_requests + $1, used_tokens = used_tokens + $2'),
        [1, 150, mockSubscription.id] // 100 + 50 = 150 total tokens
      );
    });

    it('should handle token-only usage increments', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.dbUtils!.query = mockQuery;

      await service.incrementUsage(mockSubscription.id, {
        inputTokens: 200,
        outputTokens: 100,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET used_tokens = used_tokens + $1'),
        [300, mockSubscription.id] // 200 + 100 = 300 total tokens
      );
    });

    it('should handle request-only usage increments', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.dbUtils!.query = mockQuery;

      await service.incrementUsage(mockSubscription.id, {
        requests: 5,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET used_requests = used_requests + $1'),
        [5, mockSubscription.id]
      );
    });
  });

  describe('getSubscriptionPricing', () => {
    it('should calculate pricing based on usage', async () => {
      const subscriptionWithUsage = {
        ...mockSubscription,
        usedRequests: 1000,
        usedTokens: 100000,
        inputCostPerToken: 0.00003,
        outputCostPerToken: 0.00006,
      };
      const mockQueryOne = vi.fn().mockResolvedValue(subscriptionWithUsage);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.getSubscriptionPricing(mockSubscription.id, mockUser.id);

      expect(result).toBeDefined();
      expect(result.subscriptionId).toBe(mockSubscription.id);
      expect(result.usedRequests).toBe(1000);
      expect(result.usedTokens).toBe(100000);
      expect(result.inputCostPerToken).toBe(0.00003);
      expect(result.outputCostPerToken).toBe(0.00006);
    });

    it('should return null for non-existent subscription', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue(null);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.getSubscriptionPricing('non-existent', mockUser.id);

      expect(result).toBeNull();
    });
  });
});

  describe('createSubscription', () => {
    it('should create a new subscription', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [mockSubscription],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const subscriptionData = {
        userId: mockUser.id,
        modelId: 'gpt-4',
        plan: 'professional',
        billingCycle: 'monthly',
      };

      const result = await service.createSubscription(subscriptionData);

      expect(result).toBeDefined();
      expect(result.modelId).toBe(subscriptionData.modelId);
      expect(result.plan).toBe(subscriptionData.plan);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subscriptions'),
        expect.arrayContaining([
          subscriptionData.userId,
          subscriptionData.modelId,
          subscriptionData.plan,
          subscriptionData.billingCycle,
        ])
      );
    });

    it('should prevent duplicate active subscriptions for same model', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [mockSubscription],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const subscriptionData = {
        userId: mockUser.id,
        modelId: 'gpt-4',
        plan: 'starter',
        billingCycle: 'monthly',
      };

      await expect(service.createSubscription(subscriptionData)).rejects.toThrow(
        'Active subscription already exists for this model'
      );
    });

    it('should validate plan exists', async () => {
      const subscriptionData = {
        userId: mockUser.id,
        modelId: 'gpt-4',
        plan: 'invalid-plan',
        billingCycle: 'monthly',
      };

      await expect(service.createSubscription(subscriptionData)).rejects.toThrow(
        'Invalid subscription plan'
      );
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return all subscriptions for a user', async () => {
      const mockSubscriptions = [
        { ...mockSubscription, id: 'sub-1', modelId: 'gpt-4' },
        { ...mockSubscription, id: 'sub-2', modelId: 'claude-3-opus' },
      ];
      const mockQuery = vi.fn().mockResolvedValue({
        rows: mockSubscriptions,
        rowCount: 2,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.getUserSubscriptions(mockUser.id);

      expect(result).toHaveLength(2);
      expect(result[0].modelId).toBe('gpt-4');
      expect(result[1].modelId).toBe('claude-3-opus');
    });

    it('should filter by status when provided', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [mockSubscription],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      await service.getUserSubscriptions(mockUser.id, 'active');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        [mockUser.id, 'active']
      );
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription plan', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ ...mockSubscription, plan: 'enterprise' }],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.updateSubscription(mockSubscription.id, mockUser.id, {
        plan: 'enterprise',
      });

      expect(result.plan).toBe('enterprise');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET plan = $1'),
        ['enterprise', mockSubscription.id, mockUser.id]
      );
    });

    it('should return null for non-existent subscription', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.updateSubscription('non-existent', mockUser.id, {
        plan: 'enterprise',
      });

      expect(result).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ ...mockSubscription, status: 'cancelled' }],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.cancelSubscription(mockSubscription.id, mockUser.id);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET status = $1'),
        ['cancelled', mockSubscription.id, mockUser.id]
      );
    });

    it('should return false for non-existent subscription', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.cancelSubscription('non-existent', mockUser.id);

      expect(result).toBe(false);
    });
  });

  describe('checkUsageLimit', () => {
    it('should return true when usage is within limit', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ ...mockSubscription, usageUsed: 50000, usageLimit: 100000 }],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.checkUsageLimit(mockSubscription.id);

      expect(result.withinLimit).toBe(true);
      expect(result.usagePercentage).toBe(50);
    });

    it('should return false when usage exceeds limit', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ ...mockSubscription, usageUsed: 150000, usageLimit: 100000 }],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.checkUsageLimit(mockSubscription.id);

      expect(result.withinLimit).toBe(false);
      expect(result.usagePercentage).toBe(150);
    });

    it('should handle subscription not found', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      });
      mockFastify.db!.query = mockQuery;

      await expect(service.checkUsageLimit('non-existent')).rejects.toThrow(
        'Subscription not found'
      );
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage for a subscription', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ ...mockSubscription, usageUsed: 5001 }],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      await service.incrementUsage(mockSubscription.id, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET usage_used = usage_used + $1'),
        [1, mockSubscription.id]
      );
    });

    it('should suspend subscription when limit exceeded', async () => {
      const mockQuery = vi.fn()
        .mockResolvedValueOnce({
          rows: [{ ...mockSubscription, usageUsed: 100001, usageLimit: 100000 }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ ...mockSubscription, status: 'suspended' }],
          rowCount: 1,
        });
      mockFastify.db!.query = mockQuery;

      await service.incrementUsage(mockSubscription.id, 2);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET status = $1'),
        ['suspended', mockSubscription.id]
      );
    });
  });
});
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
    plan: 'professional',
    usageLimit: 100000,
    usageUsed: 5000,
    billingCycle: 'monthly',
    nextBillingDate: '2024-07-24',
    costPerMonth: 50,
    features: ['API Access', 'Priority Support'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockFastify = {
      db: {
        query: vi.fn(),
        pool: {
          connect: vi.fn(),
        },
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    } as any;

    service = new SubscriptionService(mockFastify as FastifyInstance);
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
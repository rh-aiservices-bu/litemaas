import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '../../../src/services/subscription.service';
import { LiteLLMService } from '../../../src/services/litellm.service';
import type { FastifyInstance } from 'fastify';
import { mockUser } from '../../setup';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockFastify: Partial<FastifyInstance>;
  let mockLiteLLMService: Partial<LiteLLMService>;

  const mockSubscription = {
    id: 'sub-123',
    user_id: 'user-123',
    model_id: 'gpt-4',
    model_name: 'GPT-4',
    provider: 'openai',
    status: 'active',
    quota_requests: 10000,
    quota_tokens: 1000000,
    used_requests: 500,
    used_tokens: 50000,
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: null,
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
    // Create mock PostgreSQL client
    const mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockFastify = {
      pg: {
        connect: vi.fn().mockResolvedValue(mockClient),
      },
      dbUtils: {
        queryOne: vi.fn(),
        queryMany: vi.fn(),
        query: vi.fn(),
        withTransaction: vi.fn(),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      createNotFoundError: vi.fn((resource) => new Error(`${resource} not found`)),
      createValidationError: vi.fn((message) => new Error(message)),
      createError: vi.fn((code, message) => new Error(message)),
    } as Partial<FastifyInstance>;

    mockLiteLLMService = {
      getModelById: vi.fn().mockResolvedValue(mockModel),
      getMetrics: vi.fn().mockReturnValue({ config: { enableMocking: false } }),
      createUser: vi.fn().mockResolvedValue(undefined),
      getUserInfo: vi.fn().mockResolvedValue({ user_id: mockUser.id }),
    } as Partial<LiteLLMService>;

    service = new SubscriptionService(
      mockFastify as FastifyInstance,
      mockLiteLLMService as LiteLLMService,
    );
  });

  describe('createSubscription', () => {
    it('should create a new subscription with default quotas', async () => {
      // Mock the service to use mock data
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const subscriptionData = {
        modelId: 'gpt-4',
      };

      const result = await service.createEnhancedSubscription(mockUser.id, subscriptionData);

      expect(result).toBeDefined();
      expect(result.modelId).toBe(subscriptionData.modelId);
      expect(result.status).toBe('active');
      expect(result.quotaRequests).toBe(10000); // Default quota
      expect(result.quotaTokens).toBe(1000000); // Default quota
    });

    it('should prevent duplicate active subscriptions for same model', async () => {
      // Mock the service to NOT use mock data so it goes through database logic
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      const mockQueryOne = vi.fn().mockResolvedValueOnce(mockSubscription); // Existing subscription found
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const subscriptionData = {
        modelId: 'gpt-4',
      };

      // Updated to match new ApplicationError format: "Subscription with modelId 'gpt-4' already exists"
      await expect(
        service.createEnhancedSubscription(mockUser.id, subscriptionData),
      ).rejects.toThrow("Subscription with modelId 'gpt-4' already exists");
    });

    it('should validate model exists', async () => {
      // Mock the service to NOT use mock data so it goes through database logic
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Mock LiteLLM service to return null for invalid model
      mockLiteLLMService.getModelById = vi.fn().mockResolvedValue(null);

      const subscriptionData = {
        modelId: 'invalid-model',
      };

      // Updated to match new ApplicationError format: "Model with ID 'invalid-model' not found"
      await expect(
        service.createEnhancedSubscription(mockUser.id, subscriptionData),
      ).rejects.toThrow("Model with ID 'invalid-model' not found");
    });

    it('should allow custom quotas when provided', async () => {
      // Mock the service to use mock data
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const subscriptionData = {
        modelId: 'gpt-4',
        quotaRequests: 50000,
        quotaTokens: 5000000,
      };

      const result = await service.createEnhancedSubscription(mockUser.id, subscriptionData);

      expect(result.quotaRequests).toBe(50000);
      expect(result.quotaTokens).toBe(5000000);
    });

    it('should reactivate an inactive subscription instead of creating new one', async () => {
      // Mock the service to NOT use mock data so it goes through database logic
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Create a mock inactive subscription
      const inactiveSubscription = {
        ...mockSubscription,
        status: 'inactive',
        id: 'sub-inactive-123',
        quota_requests: 5000, // Old quota values
        quota_tokens: 500000,
        used_requests: 0,
        used_tokens: 0,
      };

      // Mock database calls - need to handle the multiple calls from createEnhancedSubscription
      const mockQueryOne = vi
        .fn()
        .mockResolvedValueOnce(inactiveSubscription) // First call: check existing subscription in createSubscription
        .mockResolvedValueOnce({
          // Second call: updated subscription from createSubscription
          ...inactiveSubscription,
          status: 'active',
          quota_requests: 15000, // New quota values
          quota_tokens: 1500000,
          updated_at: new Date(),
        })
        .mockResolvedValueOnce({
          // Third call: final subscription update in createEnhancedSubscription
          ...inactiveSubscription,
          status: 'active',
          quota_requests: 15000,
          quota_tokens: 1500000,
          used_requests: 0,
          used_tokens: 0,
          updated_at: new Date(),
        });

      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });

      mockFastify.dbUtils!.queryOne = mockQueryOne;
      mockFastify.dbUtils!.query = mockQuery;

      // Mock calculateNextResetDate method
      vi.spyOn(service, 'calculateNextResetDate' as any).mockReturnValue(new Date());

      // Mock LiteLLM sync utilities
      const mockEnsureUserExists = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../../../src/utils/litellm-sync.utils', () => ({
        LiteLLMSyncUtils: {
          ensureUserExistsInLiteLLM: mockEnsureUserExists,
        },
      }));

      const subscriptionData = {
        modelId: 'gpt-4',
        quotaRequests: 15000,
        quotaTokens: 1500000,
      };

      const result = await service.createEnhancedSubscription(mockUser.id, subscriptionData);

      // Verify the subscription was reactivated, not created
      expect(result).toBeDefined();
      expect(result.status).toBe('active');
      expect(result.quotaRequests).toBe(15000);
      expect(result.quotaTokens).toBe(1500000);
    });

    it('should prevent creating new subscription when active one exists', async () => {
      // Mock the service to NOT use mock data so it goes through database logic
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Mock an active subscription exists
      const activeSubscription = { ...mockSubscription, status: 'active' };
      const mockQueryOne = vi.fn().mockResolvedValueOnce(activeSubscription);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const subscriptionData = {
        modelId: 'gpt-4',
      };

      // Updated to match new ApplicationError format: "Subscription with modelId 'gpt-4' already exists"
      await expect(
        service.createEnhancedSubscription(mockUser.id, subscriptionData),
      ).rejects.toThrow("Subscription with modelId 'gpt-4' already exists");
    });

    it('should prevent creating new subscription when suspended one exists', async () => {
      // Mock the service to NOT use mock data so it goes through database logic
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Mock a suspended subscription exists
      const suspendedSubscription = { ...mockSubscription, status: 'suspended' };
      const mockQueryOne = vi.fn().mockResolvedValueOnce(suspendedSubscription);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const subscriptionData = {
        modelId: 'gpt-4',
      };

      // Updated to match new ApplicationError format: "Subscription with modelId 'gpt-4' already exists"
      await expect(
        service.createEnhancedSubscription(mockUser.id, subscriptionData),
      ).rejects.toThrow("Subscription with modelId 'gpt-4' already exists");
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return all subscriptions for a user with pricing information', async () => {
      // Force the service to use mock data instead of database mocks
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getUserSubscriptions(mockUser.id);

      // Service is using mock data and returns only active subscriptions by default
      // Mock data: 2 active (gpt-4o, claude-3-5-sonnet), 1 suspended (llama), 1 inactive (gpt-3.5)
      // Default behavior excludes inactive, so should return 2 active + 1 suspended = 3
      expect(result.data).toHaveLength(3); // 2 active + 1 suspended (excludes 1 inactive)
      expect(result.total).toBe(3);
      expect(result.data[0].modelId).toBe('gpt-4o');
      expect(result.data[1].modelId).toBe('claude-3-5-sonnet-20241022');
      expect(result.data[2].modelId).toBe('llama-3.1-8b-instant'); // The suspended one
    });

    it('should filter by status when provided', async () => {
      // Force the service to use mock data instead of database mocks
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getUserSubscriptions(mockUser.id, { status: 'active' });

      // Service is using mock data and filtering by status='active'
      // Mock data has 2 subscriptions with status='active' (gpt-4o, claude-3-5-sonnet)
      expect(result.data).toHaveLength(2); // 2 active mock subscriptions
      expect(result.total).toBe(2);
      expect(result.data[0].modelId).toBe('gpt-4o');
      expect(result.data[1].modelId).toBe('claude-3-5-sonnet-20241022');
    });

    it('should include pricing information in results', async () => {
      // Force the service to use mock data instead of database mocks
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getUserSubscriptions(mockUser.id);

      // Service is using mock data, pricing comes from metadata
      // The first mock subscription (gpt-4o) has pricing: inputCostPer1kTokens: 0.01, outputCostPer1kTokens: 0.03
      expect(result.data[0].metadata).toHaveProperty('inputCostPer1kTokens', 0.01);
      expect(result.data[0].metadata).toHaveProperty('outputCostPer1kTokens', 0.03);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription', async () => {
      const mockQueryOne = vi
        .fn()
        .mockResolvedValueOnce(mockSubscription) // Subscription exists
        .mockResolvedValueOnce({
          ...mockSubscription,
          quota_requests: 20000,
          quota_tokens: 2000000,
        });
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.dbUtils!.queryOne = mockQueryOne;
      mockFastify.dbUtils!.query = mockQuery;

      const result = await service.updateSubscription(mockSubscription.id, mockUser.id, {
        quotaRequests: 20000,
        quotaTokens: 2000000,
      });

      expect(result.quotaRequests).toBe(20000);
      expect(result.quotaTokens).toBe(2000000);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET'),
        expect.arrayContaining([20000, 2000000, mockSubscription.id, mockUser.id]),
      );
    });

    it('should throw error for non-existent subscription', async () => {
      const mockQueryOne = vi.fn().mockResolvedValueOnce(null);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      await expect(
        service.updateSubscription('non-existent', mockUser.id, {
          quotaRequests: 20000,
        }),
      ).rejects.toThrow("Subscription with ID 'non-existent' not found");
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      const mockClient = await (mockFastify.pg! as any).connect();

      // Mock queries for the new implementation
      mockClient.query
        .mockResolvedValueOnce('BEGIN') // Transaction start
        .mockResolvedValueOnce({ rows: [mockSubscription] }) // Get subscription
        .mockResolvedValueOnce(undefined) // Update subscription to inactive
        .mockResolvedValueOnce({ rows: [] }) // Get affected API keys (none)
        .mockResolvedValueOnce(undefined) // Insert audit log
        .mockResolvedValueOnce('COMMIT'); // Transaction commit

      const result = await service.cancelSubscription(mockSubscription.id, mockUser.id);

      expect(result.status).toBe('inactive');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        `SELECT s.*, m.name as model_name, m.provider 
         FROM subscriptions s
         LEFT JOIN models m ON s.model_id = m.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [mockSubscription.id, mockUser.id],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        `UPDATE subscriptions 
         SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [mockSubscription.id],
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error for non-existent subscription', async () => {
      const mockClient = await (mockFastify.pg! as any).connect();

      mockClient.query
        .mockResolvedValueOnce('BEGIN') // Transaction start
        .mockResolvedValueOnce({ rows: [] }); // No subscription found

      await expect(service.cancelSubscription('non-existent', mockUser.id)).rejects.toThrow(
        "Subscription with ID 'non-existent' not found",
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle API key cascading on subscription cancellation', async () => {
      const mockClient = await (mockFastify.pg! as any).connect();
      const mockApiKey = {
        id: 'api-key-123',
        lite_llm_key_value: 'llm-key-123',
        name: 'Test Key',
        all_models: ['gpt-4', 'gpt-3.5'],
      };

      // Mock LiteLLM service methods
      mockLiteLLMService.updateKey = vi.fn().mockResolvedValue(undefined);
      mockLiteLLMService.deleteKey = vi.fn().mockResolvedValue(undefined);

      mockClient.query
        .mockResolvedValueOnce('BEGIN') // Transaction start
        .mockResolvedValueOnce({ rows: [mockSubscription] }) // Get subscription
        .mockResolvedValueOnce(undefined) // Update subscription to inactive
        .mockResolvedValueOnce({ rows: [mockApiKey] }) // Get affected API keys
        .mockResolvedValueOnce(undefined) // Delete model from api_key_models
        .mockResolvedValueOnce({ rows: [{ model_id: 'gpt-3.5' }] }) // Remaining models
        .mockResolvedValueOnce(undefined) // Insert audit log
        .mockResolvedValueOnce('COMMIT'); // Transaction commit

      const result = await service.cancelSubscription(mockSubscription.id, mockUser.id);

      expect(result.status).toBe('inactive');
      expect(mockLiteLLMService.updateKey).toHaveBeenCalledWith('llm-key-123', {
        models: ['gpt-3.5'],
      });
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should deactivate API key when no models remain after cancellation', async () => {
      const mockClient = await (mockFastify.pg! as any).connect();
      const mockApiKey = {
        id: 'api-key-123',
        lite_llm_key_value: 'llm-key-123',
        name: 'Test Key',
        all_models: ['gpt-4'], // Only has the cancelled model
      };

      // Mock LiteLLM service methods
      mockLiteLLMService.deleteKey = vi.fn().mockResolvedValue(undefined);

      mockClient.query
        .mockResolvedValueOnce('BEGIN') // Transaction start
        .mockResolvedValueOnce({ rows: [mockSubscription] }) // Get subscription
        .mockResolvedValueOnce(undefined) // Update subscription to inactive
        .mockResolvedValueOnce({ rows: [mockApiKey] }) // Get affected API keys
        .mockResolvedValueOnce(undefined) // Delete model from api_key_models
        .mockResolvedValueOnce({ rows: [] }) // No remaining models
        .mockResolvedValueOnce(undefined) // Deactivate API key
        .mockResolvedValueOnce(undefined) // Insert audit log
        .mockResolvedValueOnce('COMMIT'); // Transaction commit

      const result = await service.cancelSubscription(mockSubscription.id, mockUser.id);

      expect(result.status).toBe('inactive');
      expect(mockLiteLLMService.deleteKey).toHaveBeenCalledWith('llm-key-123');
      // Check that the API key was deactivated (7th call based on test output)
      const calls = mockClient.query.mock.calls;
      const deactivateKeyCall = calls.find(
        (call) => call[0].includes('UPDATE api_keys') && call[0].includes('is_active = false'),
      );
      expect(deactivateKeyCall).toBeTruthy();
      expect(deactivateKeyCall[1]).toEqual(['api-key-123']);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('checkQuotaAvailability', () => {
    it('should return true when usage is within limits', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue({
        ...mockSubscription,
        used_requests: 5000,
        quota_requests: 10000,
        used_tokens: 500000,
        quota_tokens: 1000000,
        status: 'active',
      });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.checkQuotaAvailability(mockSubscription.id, 100000);

      expect(result.canProceed).toBe(true);
    });

    it('should return false when request quota is exceeded', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue({
        ...mockSubscription,
        used_requests: 10000,
        quota_requests: 10000,
        used_tokens: 500000,
        quota_tokens: 1000000,
        status: 'active',
      });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.checkQuotaAvailability(mockSubscription.id, 100000);

      expect(result.canProceed).toBe(false);
      expect(result.reason).toBe('Request quota exceeded');
    });

    it('should return false when token quota would be exceeded', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue({
        ...mockSubscription,
        used_requests: 5000,
        quota_requests: 10000,
        used_tokens: 900000,
        quota_tokens: 1000000,
        status: 'active',
      });
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.checkQuotaAvailability(mockSubscription.id, 200000);

      expect(result.canProceed).toBe(false);
      expect(result.reason).toBe('Token quota would be exceeded');
    });

    it('should handle subscription not found', async () => {
      const mockQueryOne = vi.fn().mockResolvedValue(null);
      mockFastify.dbUtils!.queryOne = mockQueryOne;

      const result = await service.checkQuotaAvailability('non-existent', 1000);

      expect(result.canProceed).toBe(false);
      expect(result.reason).toBe('Subscription not found');
    });
  });

  describe('getSubscription', () => {
    it('should retrieve subscription by ID', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue(mockSubscription);

      const result = await service.getSubscription('sub-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('sub-123');
    });

    it('should return null for non-existent subscription', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue(null);

      const result = await service.getSubscription('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('resetQuotas', () => {
    it('should reset quotas for all subscriptions', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 5 });

      const result = await service.resetQuotas();

      expect(result).toBe(5);
      expect(mockFastify.dbUtils!.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions'),
        expect.anything(),
      );
    });

    it('should reset quotas for specific user', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 2 });

      const result = await service.resetQuotas('user-123');

      expect(result).toBe(2);
    });
  });
});

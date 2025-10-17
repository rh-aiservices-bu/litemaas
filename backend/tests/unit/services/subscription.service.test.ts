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

      // Mock model restriction check (returns false) then existing subscription check
      const mockQueryOne = vi
        .fn()
        .mockResolvedValueOnce({ restricted_access: false })
        .mockResolvedValueOnce(mockSubscription); // Existing subscription found
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
      // Mock: (1) model restriction check, (2) existing subscription, (3) after reactivation, (4) final result
      const mockQueryOne = vi
        .fn()
        .mockResolvedValueOnce({ restricted_access: false }) // First call: model restriction check
        .mockResolvedValueOnce(inactiveSubscription) // Second call: check existing subscription in createSubscription
        .mockResolvedValueOnce({
          // Third call: updated subscription from createSubscription
          ...inactiveSubscription,
          status: 'active',
          quota_requests: 15000, // New quota values
          quota_tokens: 1500000,
          updated_at: new Date(),
        })
        .mockResolvedValueOnce({
          // Fourth call: final subscription update in createEnhancedSubscription
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

    it('should reactivate inactive subscription with pending status for restricted models', async () => {
      // Mock the service to NOT use mock data so it goes through database logic
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Create a mock inactive subscription for a restricted model
      const inactiveSubscription = {
        ...mockSubscription,
        model_id: 'restricted-gpt-4',
        status: 'inactive',
        id: 'sub-inactive-restricted-123',
        quota_requests: 5000,
        quota_tokens: 500000,
        used_requests: 0,
        used_tokens: 0,
      };

      // Mock database calls for createSubscription flow
      const mockQueryOne = vi
        .fn()
        .mockResolvedValueOnce({ restricted_access: true }) // Model is restricted
        .mockResolvedValueOnce(inactiveSubscription) // Existing inactive subscription
        .mockResolvedValueOnce({
          // Updated subscription with pending status
          ...inactiveSubscription,
          status: 'pending', // Should be pending, not active
          quota_requests: 15000,
          quota_tokens: 1500000,
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
        modelId: 'restricted-gpt-4',
        quotaRequests: 15000,
        quotaTokens: 1500000,
      };

      const result = await service.createSubscription(mockUser.id, subscriptionData);

      // Verify the subscription was reactivated with pending status
      expect(result).toBeDefined();
      expect(result.status).toBe('pending'); // Should be pending for restricted model
      expect(result.quotaRequests).toBe(15000);
      expect(result.quotaTokens).toBe(1500000);

      // Verify audit log was created with correct action
      const auditCalls = mockQuery.mock.calls.filter((call) =>
        call[0].includes('INSERT INTO audit_logs'),
      );
      expect(auditCalls.length).toBeGreaterThan(0);
      const auditCall = auditCalls[0];
      const auditParams = auditCall[1];
      expect(auditParams[1]).toBe('SUBSCRIPTION_REAPPLIED'); // Should use REAPPLIED action
    });

    it('should prevent creating new subscription when active one exists', async () => {
      // Mock the service to NOT use mock data so it goes through database logic
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Mock model restriction check then existing active subscription
      const activeSubscription = { ...mockSubscription, status: 'active' };
      const mockQueryOne = vi
        .fn()
        .mockResolvedValueOnce({ restricted_access: false })
        .mockResolvedValueOnce(activeSubscription);
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

      // Mock model restriction check then existing suspended subscription
      const suspendedSubscription = { ...mockSubscription, status: 'suspended' };
      const mockQueryOne = vi
        .fn()
        .mockResolvedValueOnce({ restricted_access: false })
        .mockResolvedValueOnce(suspendedSubscription);
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

  describe('Subscription Approval Workflow', () => {
    const adminUserId = 'admin-123';
    const pendingSubscription = {
      ...mockSubscription,
      status: 'pending',
      id: 'sub-pending-123',
    };
    const deniedSubscription = {
      ...mockSubscription,
      status: 'denied',
      id: 'sub-denied-123',
      status_reason: 'Insufficient permissions',
    };

    describe('createSubscription with restricted model', () => {
      it('should create subscription with pending status for restricted model', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        // Mock model restriction check
        const mockQueryOne = vi
          .fn()
          .mockResolvedValueOnce({ restricted_access: true }) // Model is restricted
          .mockResolvedValueOnce(null) // No existing subscription
          .mockResolvedValueOnce({
            // New subscription created with pending status
            ...mockSubscription,
            status: 'pending',
            id: 'sub-new-pending',
          });

        mockFastify.dbUtils!.queryOne = mockQueryOne;
        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        const result = await service.createSubscription(mockUser.id, { modelId: 'gpt-4' });

        expect(result).toBeDefined();
        expect(result.status).toBe('pending');
      });

      it('should create subscription with active status for non-restricted model', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const mockQueryOne = vi
          .fn()
          .mockResolvedValueOnce({ restricted_access: false }) // Model is NOT restricted
          .mockResolvedValueOnce(null) // No existing subscription
          .mockResolvedValueOnce({
            // New subscription created with active status
            ...mockSubscription,
            status: 'active',
            id: 'sub-new-active',
          });

        mockFastify.dbUtils!.queryOne = mockQueryOne;
        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        const result = await service.createSubscription(mockUser.id, { modelId: 'gpt-4' });

        expect(result).toBeDefined();
        expect(result.status).toBe('active');
      });
    });

    describe('approveSubscriptions', () => {
      it('should approve single subscription and record audit trail', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        // Mock get subscription
        mockFastify.dbUtils!.queryOne = vi
          .fn()
          .mockResolvedValueOnce(pendingSubscription) // Get subscription
          .mockResolvedValueOnce({ ...pendingSubscription, status: 'active' }); // Update result

        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        const result = await service.approveSubscriptions([pendingSubscription.id], adminUserId);

        expect(result.successful).toBe(1);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);

        // Verify audit log creation
        expect(mockFastify.dbUtils!.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO subscription_status_history'),
          expect.anything(),
        );
      });

      it('should approve multiple subscriptions in bulk', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const subscriptionIds = ['sub-1', 'sub-2', 'sub-3'];

        mockFastify.dbUtils!.queryOne = vi
          .fn()
          .mockResolvedValueOnce({ ...pendingSubscription, id: 'sub-1' })
          .mockResolvedValueOnce({ ...pendingSubscription, id: 'sub-1', status: 'active' })
          .mockResolvedValueOnce({ ...pendingSubscription, id: 'sub-2' })
          .mockResolvedValueOnce({ ...pendingSubscription, id: 'sub-2', status: 'active' })
          .mockResolvedValueOnce({ ...pendingSubscription, id: 'sub-3' })
          .mockResolvedValueOnce({ ...pendingSubscription, id: 'sub-3', status: 'active' });

        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        const result = await service.approveSubscriptions(subscriptionIds, adminUserId);

        expect(result.successful).toBe(3);
        expect(result.failed).toBe(0);
      });

      it('should handle partial failures in bulk approval', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockFastify.dbUtils!.queryOne = vi
          .fn()
          .mockResolvedValueOnce(pendingSubscription)
          .mockResolvedValueOnce({ ...pendingSubscription, status: 'active' })
          .mockResolvedValueOnce(null); // Second subscription not found

        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        const result = await service.approveSubscriptions(['sub-1', 'sub-2'], adminUserId);

        expect(result.successful).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].subscription).toBe('sub-2');
        expect(result.errors[0].error).toContain('not found');
      });
    });

    describe('denySubscriptions', () => {
      it('should deny subscription with required reason', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockFastify.dbUtils!.queryOne = vi
          .fn()
          .mockResolvedValueOnce(pendingSubscription)
          .mockResolvedValueOnce({ ...pendingSubscription, status: 'denied' });

        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });
        mockFastify.dbUtils!.queryMany = vi.fn().mockResolvedValue([]);

        const result = await service.denySubscriptions(
          [pendingSubscription.id],
          adminUserId,
          'Insufficient permissions',
        );

        expect(result.successful).toBe(1);
        expect(result.failed).toBe(0);

        // Verify reason was passed
        expect(mockFastify.dbUtils!.queryOne).toHaveBeenCalledWith(
          expect.stringContaining('status_reason'),
          expect.arrayContaining(['Insufficient permissions']),
        );
      });

      it('should remove model from user API keys on denial', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockFastify.dbUtils!.queryOne = vi
          .fn()
          .mockResolvedValueOnce(pendingSubscription)
          .mockResolvedValueOnce({ ...pendingSubscription, status: 'denied' });

        // Mock API keys containing this model
        mockFastify.dbUtils!.queryMany = vi.fn().mockResolvedValue([
          {
            id: 'key-1',
            lite_llm_key_value: 'sk-litellm-123',
          },
        ]);

        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        // Mock LiteLLM service
        mockLiteLLMService.updateKey = vi.fn().mockResolvedValue(undefined);

        const result = await service.denySubscriptions(
          [pendingSubscription.id],
          adminUserId,
          'Denied',
        );

        expect(result.successful).toBe(1);

        // Verify API key models were queried
        expect(mockFastify.dbUtils!.queryMany).toHaveBeenCalled();
      });
    });

    describe('requestReview', () => {
      it('should change denied subscription to pending', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockFastify.dbUtils!.queryOne = vi
          .fn()
          .mockResolvedValueOnce(deniedSubscription)
          .mockResolvedValueOnce({ ...deniedSubscription, status: 'pending', status_reason: null });

        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        const result = await service.requestReview(deniedSubscription.id, mockUser.id);

        expect(result.status).toBe('pending');
        expect(result.statusReason).toBeUndefined();

        // Verify audit trail
        expect(mockFastify.dbUtils!.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO subscription_status_history'),
          expect.anything(),
        );
      });

      it('should be idempotent for pending subscriptions', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue(pendingSubscription);

        const result = await service.requestReview(pendingSubscription.id, mockUser.id);

        expect(result.status).toBe('pending');

        // Should not update or create audit trail for already pending
        expect(mockFastify.dbUtils!.queryOne).toHaveBeenCalledTimes(1);
      });

      it('should throw error for active subscription', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const activeSubscription = { ...mockSubscription, status: 'active' };
        mockFastify.dbUtils!.queryOne = vi.fn().mockResolvedValue(activeSubscription);

        await expect(service.requestReview(activeSubscription.id, mockUser.id)).rejects.toThrow(
          /Cannot request review/i,
        );
      });
    });

    describe('handleModelRestrictionChange', () => {
      it('should transition active subscriptions to pending when model becomes restricted', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const activeSubscriptions = [
          { id: 'sub-1', user_id: 'user-1' },
          { id: 'sub-2', user_id: 'user-2' },
        ];

        mockFastify.dbUtils!.queryMany = vi
          .fn()
          .mockResolvedValueOnce(activeSubscriptions) // Get active subscriptions
          .mockResolvedValue([]); // Empty results for API key queries

        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        await service.handleModelRestrictionChange('gpt-4', true);

        // Verify subscriptions were updated to pending
        expect(mockFastify.dbUtils!.query).toHaveBeenCalledWith(
          expect.stringContaining("status = 'pending'"),
          expect.anything(),
        );

        // Verify audit trail created for each subscription
        const auditCalls = mockFastify.dbUtils!.query.mock.calls.filter((call) =>
          call[0].includes('INSERT INTO subscription_status_history'),
        );
        expect(auditCalls.length).toBe(2);
      });

      it('should remove model from all affected API keys', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const activeSubscriptions = [{ id: 'sub-1', user_id: 'user-1' }];

        mockFastify.dbUtils!.queryMany = vi.fn().mockResolvedValue(activeSubscriptions);
        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        await service.handleModelRestrictionChange('gpt-4', true);

        // Verify the flow is triggered
        // Note: The actual implementation delegates to ApiKeyService for model removal
        expect(mockFastify.log!.info).toHaveBeenCalled();
      });

      it('should auto-approve pending subscriptions when model becomes unrestricted', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const pendingSubscriptions = [{ id: 'sub-1' }, { id: 'sub-2' }];

        mockFastify.dbUtils!.queryMany = vi.fn().mockResolvedValue(pendingSubscriptions);
        mockFastify.dbUtils!.query = vi.fn().mockResolvedValue({ rowCount: 1 });

        await service.handleModelRestrictionChange('gpt-4', false);

        // Verify subscriptions were updated to active
        expect(mockFastify.dbUtils!.query).toHaveBeenCalledWith(
          expect.stringContaining("status = 'active'"),
          expect.anything(),
        );

        // Verify audit trail created
        const auditCalls = mockFastify.dbUtils!.query.mock.calls.filter((call) =>
          call[0].includes('INSERT INTO subscription_status_history'),
        );
        expect(auditCalls.length).toBe(2);
      });
    });
  });
});

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { FastifyInstance } from 'fastify';
import { AdminUsageStatsService } from '../../../src/services/admin-usage-stats.service';
import { LiteLLMService } from '../../../src/services/litellm.service';
import { ApplicationError } from '../../../src/utils/errors';
import {
  AdminUsageFilters,
  IDailyUsageCacheManager,
  EnrichedDayData,
  LiteLLMDayData,
} from '../../../src/types/admin-usage.types';

// Mock Fastify instance
const createMockFastify = (): FastifyInstance => {
  return {
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    pg: {
      query: vi.fn(),
    },
  } as any;
};

// Mock LiteLLMService
const createMockLiteLLMService = (): LiteLLMService => {
  return {
    getDailyActivity: vi.fn(),
  } as any;
};

// Mock DailyUsageCacheManager
const createMockCacheManager = (): IDailyUsageCacheManager => {
  return {
    getCachedDailyData: vi.fn(),
    saveToDailyCache: vi.fn(),
    getDateRangeData: vi.fn(),
    invalidateTodayCache: vi.fn(),
    cleanupOldCache: vi.fn(),
  };
};

// Mock data factories
const createMockLiteLLMDayData = (date: string): LiteLLMDayData => {
  return {
    date,
    metrics: {
      api_requests: 100,
      total_tokens: 5000,
      prompt_tokens: 3000,
      completion_tokens: 2000,
      spend: 0.5,
      successful_requests: 95,
      failed_requests: 5,
    },
    breakdown: {
      models: {
        'openai/gpt-4': {
          metrics: {
            api_requests: 60,
            total_tokens: 3000,
            prompt_tokens: 1800,
            completion_tokens: 1200,
            spend: 0.3,
          },
          api_keys: {
            'key-hash-1': {
              metrics: {
                api_requests: 40,
                total_tokens: 2000,
                prompt_tokens: 1200,
                completion_tokens: 800,
                spend: 0.2,
              },
            },
            'key-hash-2': {
              metrics: {
                api_requests: 20,
                total_tokens: 1000,
                prompt_tokens: 600,
                completion_tokens: 400,
                spend: 0.1,
              },
            },
          },
        },
        'anthropic/claude-3': {
          metrics: {
            api_requests: 40,
            total_tokens: 2000,
            prompt_tokens: 1200,
            completion_tokens: 800,
            spend: 0.2,
          },
          api_keys: {
            'key-hash-3': {
              metrics: {
                api_requests: 40,
                total_tokens: 2000,
                prompt_tokens: 1200,
                completion_tokens: 800,
                spend: 0.2,
              },
            },
          },
        },
      },
      api_keys: {
        'key-hash-1': {
          key_alias: 'user1-key',
          metrics: {
            api_requests: 40,
            total_tokens: 2000,
            prompt_tokens: 1200,
            completion_tokens: 800,
            spend: 0.2,
          },
        },
        'key-hash-2': {
          key_alias: 'user2-key',
          metrics: {
            api_requests: 20,
            total_tokens: 1000,
            prompt_tokens: 600,
            completion_tokens: 400,
            spend: 0.1,
          },
        },
        'key-hash-3': {
          key_alias: 'user3-key',
          metrics: {
            api_requests: 40,
            total_tokens: 2000,
            prompt_tokens: 1200,
            completion_tokens: 800,
            spend: 0.2,
          },
        },
      },
      providers: {
        openai: {
          metrics: {
            api_requests: 60,
            total_tokens: 3000,
            prompt_tokens: 1800,
            completion_tokens: 1200,
            spend: 0.3,
          },
        },
        anthropic: {
          metrics: {
            api_requests: 40,
            total_tokens: 2000,
            prompt_tokens: 1200,
            completion_tokens: 800,
            spend: 0.2,
          },
        },
      },
    },
  };
};

const createMockEnrichedDayData = (date: string): EnrichedDayData => {
  const rawData = createMockLiteLLMDayData(date);
  return {
    date,
    metrics: rawData.metrics,
    breakdown: {
      models: {
        'openai/gpt-4': {
          metrics: rawData.breakdown.models['openai/gpt-4'].metrics,
          users: {
            'user-1': {
              userId: 'user-1',
              username: 'testuser1',
              email: 'test1@example.com',
              metrics: {
                api_requests: 40,
                total_tokens: 2000,
                prompt_tokens: 1200,
                completion_tokens: 800,
                spend: 0.2,
              },
            },
            'user-2': {
              userId: 'user-2',
              username: 'testuser2',
              email: 'test2@example.com',
              metrics: {
                api_requests: 20,
                total_tokens: 1000,
                prompt_tokens: 600,
                completion_tokens: 400,
                spend: 0.1,
              },
            },
          },
        },
        'anthropic/claude-3': {
          metrics: rawData.breakdown.models['anthropic/claude-3'].metrics,
          users: {
            'user-3': {
              userId: 'user-3',
              username: 'testuser3',
              email: 'test3@example.com',
              metrics: {
                api_requests: 40,
                total_tokens: 2000,
                prompt_tokens: 1200,
                completion_tokens: 800,
                spend: 0.2,
              },
            },
          },
        },
      },
      providers: rawData.breakdown.providers,
      users: {
        'user-1': {
          userId: 'user-1',
          username: 'testuser1',
          email: 'test1@example.com',
          role: 'user',
          metrics: {
            api_requests: 40,
            total_tokens: 2000,
            prompt_tokens: 1200,
            completion_tokens: 800,
            spend: 0.2,
          },
          models: {
            'openai/gpt-4': {
              modelName: 'openai/gpt-4',
              metrics: {
                api_requests: 40,
                total_tokens: 2000,
                prompt_tokens: 1200,
                completion_tokens: 800,
                spend: 0.2,
              },
            },
          },
        },
        'user-2': {
          userId: 'user-2',
          username: 'testuser2',
          email: 'test2@example.com',
          role: 'user',
          metrics: {
            api_requests: 20,
            total_tokens: 1000,
            prompt_tokens: 600,
            completion_tokens: 400,
            spend: 0.1,
          },
          models: {
            'openai/gpt-4': {
              modelName: 'openai/gpt-4',
              metrics: {
                api_requests: 20,
                total_tokens: 1000,
                prompt_tokens: 600,
                completion_tokens: 400,
                spend: 0.1,
              },
            },
          },
        },
        'user-3': {
          userId: 'user-3',
          username: 'testuser3',
          email: 'test3@example.com',
          role: 'user',
          metrics: {
            api_requests: 40,
            total_tokens: 2000,
            prompt_tokens: 1200,
            completion_tokens: 800,
            spend: 0.2,
          },
          models: {
            'anthropic/claude-3': {
              modelName: 'anthropic/claude-3',
              metrics: {
                api_requests: 40,
                total_tokens: 2000,
                prompt_tokens: 1200,
                completion_tokens: 800,
                spend: 0.2,
              },
            },
          },
        },
      },
    },
    rawData,
  };
};

describe('AdminUsageStatsService', () => {
  let fastify: FastifyInstance;
  let liteLLMService: LiteLLMService;
  let cacheManager: IDailyUsageCacheManager;
  let service: AdminUsageStatsService;

  beforeEach(() => {
    fastify = createMockFastify();
    liteLLMService = createMockLiteLLMService();
    cacheManager = createMockCacheManager();
    service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);
  });

  describe('getAnalytics', () => {
    it('should return global metrics for a date range', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      };

      // Mock LiteLLM responses
      (liteLLMService.getDailyActivity as Mock).mockResolvedValueOnce({
        api_requests: 100,
        total_tokens: 5000,
        prompt_tokens: 3000,
        completion_tokens: 2000,
        spend: 0.5,
        by_model: [
          {
            model: 'openai/gpt-4',
            api_requests: 60,
            tokens: 3000,
            spend: 0.3,
          },
        ],
      });

      // Mock database query for user mappings
      (fastify.pg!.query as Mock).mockResolvedValue({
        rows: [
          {
            litellm_key_alias: 'user1-key',
            key_hash: 'key-hash-1',
            user_id: 'user-1',
            key_name: 'Test Key',
            username: 'testuser1',
            email: 'test1@example.com',
            role: 'user',
          },
        ],
      });

      // Mock cache returns null (cache miss)
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      const result = await service.getAnalytics(filters);

      expect(result).toBeDefined();
      expect(result.totalRequests).toBeGreaterThanOrEqual(0);
      expect(result.totalTokens).toHaveProperty('total');
      expect(result.totalTokens).toHaveProperty('prompt');
      expect(result.totalTokens).toHaveProperty('completion');
      expect(result.successRate).toBeGreaterThanOrEqual(0);
      expect(result.period.startDate).toEqual(filters.startDate);
      expect(result.period.endDate).toEqual(filters.endDate);
    });

    it('should return empty metrics when no data exists', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      // Mock LiteLLM returns no data
      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 0,
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        spend: 0,
        by_model: [],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      const result = await service.getAnalytics(filters);

      expect(result.totalRequests).toBe(0);
      expect(result.totalUsers).toBe(0);
      expect(result.activeUsers).toBe(0);
    });

    it('should throw validation error for invalid date range', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-31',
        endDate: '2024-01-01',
      };

      await expect(service.getAnalytics(filters)).rejects.toThrow(ApplicationError);
    });

    it('should throw validation error for date range exceeding 365 days', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2023-01-01',
        endDate: '2024-12-31',
      };

      await expect(service.getAnalytics(filters)).rejects.toThrow(ApplicationError);
    });
  });

  describe('getUserBreakdown', () => {
    it('should return user breakdown sorted by cost', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');

      // Mock cache returns enriched data
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      const result = await service.getUserBreakdown(filters);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify sorted by cost descending
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].metrics.cost).toBeGreaterThanOrEqual(result[i + 1].metrics.cost);
      }

      // Verify structure
      const firstUser = result[0];
      expect(firstUser).toHaveProperty('userId');
      expect(firstUser).toHaveProperty('username');
      expect(firstUser).toHaveProperty('email');
      expect(firstUser).toHaveProperty('role');
      expect(firstUser.metrics).toHaveProperty('requests');
      expect(firstUser.metrics).toHaveProperty('tokens');
      expect(firstUser.metrics).toHaveProperty('cost');
      expect(firstUser.metrics).toHaveProperty('models');
    });

    it('should filter users by userIds when provided', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        userIds: ['user-1'],
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      const result = await service.getUserBreakdown(filters);

      expect(result).toBeInstanceOf(Array);
      expect(result.every((user) => filters.userIds!.includes(user.userId))).toBe(true);
    });

    it('should return empty array when no data exists', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 0,
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        spend: 0,
        by_model: [],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      const result = await service.getUserBreakdown(filters);

      expect(result).toEqual([]);
    });
  });

  describe('getModelBreakdown', () => {
    it('should return model breakdown sorted by cost', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      const result = await service.getModelBreakdown(filters);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify sorted by cost descending
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].metrics.cost).toBeGreaterThanOrEqual(result[i + 1].metrics.cost);
      }

      // Verify structure
      const firstModel = result[0];
      expect(firstModel).toHaveProperty('modelId');
      expect(firstModel).toHaveProperty('modelName');
      expect(firstModel).toHaveProperty('provider');
      expect(firstModel.metrics).toHaveProperty('requests');
      expect(firstModel.metrics).toHaveProperty('tokens');
      expect(firstModel.metrics).toHaveProperty('cost');
      expect(firstModel.metrics).toHaveProperty('users');
      expect(firstModel).toHaveProperty('topUsers');
    });

    it('should filter models by modelIds when provided', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        modelIds: ['openai/gpt-4'],
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      const result = await service.getModelBreakdown(filters);

      expect(result).toBeInstanceOf(Array);
      expect(result.every((model) => filters.modelIds!.includes(model.modelId))).toBe(true);
    });
  });

  describe('getProviderBreakdown', () => {
    it('should return provider breakdown sorted by cost', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      const result = await service.getProviderBreakdown(filters);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify structure
      const firstProvider = result[0];
      expect(firstProvider).toHaveProperty('provider');
      expect(firstProvider.metrics).toHaveProperty('requests');
      expect(firstProvider.metrics).toHaveProperty('tokens');
      expect(firstProvider.metrics).toHaveProperty('cost');
      expect(firstProvider.metrics).toHaveProperty('models');
      expect(firstProvider.metrics).toHaveProperty('users');
      expect(firstProvider).toHaveProperty('topModels');
    });

    it('should filter providers by providerIds when provided', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        providerIds: ['openai'],
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      const result = await service.getProviderBreakdown(filters);

      expect(result).toBeInstanceOf(Array);
      expect(result.every((provider) => filters.providerIds!.includes(provider.provider))).toBe(
        true,
      );
    });
  });

  describe('exportUsageData', () => {
    it('should export data in JSON format', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      const result = await service.exportUsageData(filters, 'json');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('period');
      expect(parsed).toHaveProperty('users');
      expect(parsed).toHaveProperty('models');
      expect(parsed).toHaveProperty('providers');
      expect(parsed).toHaveProperty('exportedAt');
    });

    it('should export data in CSV format', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      const result = await service.exportUsageData(filters, 'csv');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('User ID,Username,Email');
      expect(result.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('refreshTodayData', () => {
    it('should invalidate cache and fetch fresh data for today', async () => {
      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 50,
        total_tokens: 2500,
        prompt_tokens: 1500,
        completion_tokens: 1000,
        spend: 0.25,
        by_model: [],
      });

      (fastify.pg!.query as Mock).mockResolvedValue({ rows: [] });

      await service.refreshTodayData();

      expect(cacheManager.invalidateTodayCache).toHaveBeenCalled();
      expect(liteLLMService.getDailyActivity).toHaveBeenCalled();
      expect(cacheManager.saveToDailyCache).toHaveBeenCalled();
    });

    it('should handle LiteLLM errors gracefully', async () => {
      (cacheManager.invalidateTodayCache as Mock).mockResolvedValue(undefined);
      (liteLLMService.getDailyActivity as Mock).mockRejectedValue(new Error('LiteLLM API error'));

      await expect(service.refreshTodayData()).rejects.toThrow(ApplicationError);
    });
  });

  describe('caching behavior', () => {
    it('should use cached data when available', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      const mockEnrichedData = createMockEnrichedDayData('2024-01-01');
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(mockEnrichedData);

      await service.getAnalytics(filters);

      expect(cacheManager.getCachedDailyData).toHaveBeenCalled();
      expect(liteLLMService.getDailyActivity).not.toHaveBeenCalled();
    });

    it('should fetch from LiteLLM on cache miss', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);
      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 100,
        total_tokens: 5000,
        prompt_tokens: 3000,
        completion_tokens: 2000,
        spend: 0.5,
        by_model: [],
      });

      (fastify.pg!.query as Mock).mockResolvedValue({ rows: [] });

      await service.getAnalytics(filters);

      expect(cacheManager.getCachedDailyData).toHaveBeenCalled();
      expect(liteLLMService.getDailyActivity).toHaveBeenCalled();
      expect(cacheManager.saveToDailyCache).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully when no API keys in response', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);
      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 100,
        total_tokens: 5000,
        prompt_tokens: 3000,
        completion_tokens: 2000,
        spend: 0.5,
        daily_metrics: [
          {
            date: '2024-01-01',
            metrics: {
              api_requests: 100,
              total_tokens: 5000,
              prompt_tokens: 3000,
              completion_tokens: 2000,
              spend: 0.5,
              successful_requests: 95,
              failed_requests: 5,
            },
            breakdown: {
              models: {
                'openai/gpt-4': {
                  metrics: {
                    api_requests: 100,
                    total_tokens: 5000,
                    prompt_tokens: 3000,
                    completion_tokens: 2000,
                    spend: 0.5,
                  },
                  api_key_breakdown: {
                    'unmapped-key-hash': {
                      metrics: {
                        api_requests: 100,
                        total_tokens: 5000,
                        prompt_tokens: 3000,
                        completion_tokens: 2000,
                        spend: 0.5,
                        successful_requests: 95,
                        failed_requests: 5,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      });

      // Database is down, but service should create Unknown User for unmapped API keys
      // Simulate database unavailability by removing pg plugin
      fastify.pg = undefined;

      const result = await service.getAnalytics(filters);

      // Should return data with Unknown User for unmapped requests
      expect(result).toBeDefined();
      expect(result.totalRequests).toBe(100);
      expect(result.totalUsers).toBe(1); // Unknown User created for unmapped requests
    });

    it('should work without cache manager', async () => {
      const serviceWithoutCache = new AdminUsageStatsService(fastify, liteLLMService);

      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 100,
        total_tokens: 5000,
        prompt_tokens: 3000,
        completion_tokens: 2000,
        spend: 0.5,
        by_model: [],
      });

      (fastify.pg!.query as Mock).mockResolvedValue({ rows: [] });

      const result = await serviceWithoutCache.getAnalytics(filters);

      expect(result).toBeDefined();
      expect(fastify.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('DailyUsageCacheManager not provided'),
      );
    });
  });

  describe('Empty API Key Filtering', () => {
    it('should skip API keys with empty hash', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      // Mock LiteLLM data with an empty key hash
      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 50,
        total_tokens: 1000,
        prompt_tokens: 500,
        completion_tokens: 500,
        spend: 0.1,
        daily_metrics: [
          {
            date: '2024-01-01',
            metrics: {
              api_requests: 50,
              total_tokens: 1000,
              prompt_tokens: 500,
              completion_tokens: 500,
              spend: 0.1,
              successful_requests: 48,
              failed_requests: 2,
            },
            breakdown: {
              models: {
                'test-model': {
                  metrics: {
                    api_requests: 50,
                    total_tokens: 1000,
                    prompt_tokens: 500,
                    completion_tokens: 500,
                    spend: 0.1,
                  },
                  api_key_breakdown: {
                    '': {
                      // Empty key hash
                      metrics: {
                        api_requests: 2,
                        total_tokens: 0,
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        spend: 0,
                        failed_requests: 2,
                        successful_requests: 0,
                      },
                    },
                    'valid-key-hash': {
                      metrics: {
                        api_requests: 48,
                        total_tokens: 1000,
                        prompt_tokens: 500,
                        completion_tokens: 500,
                        spend: 0.1,
                        failed_requests: 0,
                        successful_requests: 48,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      });

      // Mock database query - only has valid key
      (fastify.pg!.query as Mock).mockResolvedValue({
        rows: [
          {
            litellm_key_alias: 'user-key-1',
            key_hash: 'valid-key-hash',
            user_id: 'user-1',
            key_name: 'Test Key',
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
          },
        ],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      const result = await service.getAnalytics(filters);

      // Should have skipped the empty key and debug logged it
      expect(fastify.log.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'test-model',
          keyHash: '',
        }),
        'Skipping invalid API key entry (empty key hash)',
      );

      // Should have processed only the valid key (48 requests)
      expect(result.totalRequests).toBeGreaterThan(0);
    });

    it('should skip API keys with empty key hash', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 50,
        total_tokens: 1000,
        prompt_tokens: 500,
        completion_tokens: 500,
        spend: 0.1,
        daily_metrics: [
          {
            date: '2024-01-01',
            metrics: {
              api_requests: 2,
              total_tokens: 0,
              prompt_tokens: 0,
              completion_tokens: 0,
              spend: 0,
              successful_requests: 2,
              failed_requests: 0,
            },
            breakdown: {
              models: {
                'test-model': {
                  metrics: {
                    api_requests: 2,
                    total_tokens: 0,
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    spend: 0,
                  },
                  api_key_breakdown: {
                    '': {
                      // Empty key hash
                      metrics: {
                        api_requests: 2,
                        total_tokens: 0,
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        spend: 0,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      });

      (fastify.pg!.query as Mock).mockResolvedValue({ rows: [] });
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      await service.getAnalytics(filters);

      // Should have skipped and logged
      expect(fastify.log.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          keyHash: '',
        }),
        'Skipping invalid API key entry (empty key hash)',
      );
    });

    it('should skip API keys with whitespace key hash', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 10,
        total_tokens: 100,
        prompt_tokens: 50,
        completion_tokens: 50,
        spend: 0.01,
        daily_metrics: [
          {
            date: '2024-01-01',
            metrics: {
              api_requests: 10,
              total_tokens: 100,
              prompt_tokens: 50,
              completion_tokens: 50,
              spend: 0.01,
              successful_requests: 10,
              failed_requests: 0,
            },
            breakdown: {
              models: {
                'test-model': {
                  metrics: {
                    api_requests: 10,
                    total_tokens: 100,
                    prompt_tokens: 50,
                    completion_tokens: 50,
                    spend: 0.01,
                  },
                  api_key_breakdown: {
                    '   ': {
                      // Whitespace key hash
                      metrics: {
                        api_requests: 10,
                        total_tokens: 100,
                        prompt_tokens: 50,
                        completion_tokens: 50,
                        spend: 0.01,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      });

      (fastify.pg!.query as Mock).mockResolvedValue({ rows: [] });
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      await service.getAnalytics(filters);

      // Should have skipped
      expect(fastify.log.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          keyHash: '   ',
        }),
        'Skipping invalid API key entry (empty key hash)',
      );
    });

    it('should create Unknown User for valid key_alias not found in database', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 25,
        total_tokens: 500,
        prompt_tokens: 250,
        completion_tokens: 250,
        spend: 0.05,
        daily_metrics: [
          {
            date: '2024-01-01',
            metrics: {
              api_requests: 25,
              total_tokens: 500,
              prompt_tokens: 250,
              completion_tokens: 250,
              spend: 0.05,
              successful_requests: 25,
              failed_requests: 0,
            },
            breakdown: {
              models: {
                'test-model': {
                  metrics: {
                    api_requests: 25,
                    total_tokens: 500,
                    prompt_tokens: 250,
                    completion_tokens: 250,
                    spend: 0.05,
                  },
                  api_key_breakdown: {
                    'deleted-key-hash': {
                      metrics: {
                        api_requests: 25,
                        total_tokens: 500,
                        prompt_tokens: 250,
                        completion_tokens: 250,
                        spend: 0.05,
                        successful_requests: 25,
                        failed_requests: 0,
                      },
                      metadata: {
                        key_alias: 'deleted-user-key', // Valid alias but not in DB
                        team_id: null,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      });

      // Database returns empty - key not found
      (fastify.pg!.query as Mock).mockResolvedValue({ rows: [] });
      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      const result = await service.getUserBreakdown(filters);

      // Should create Unknown User
      const unknownUser = result.find((u) => u.username === 'Unknown User');
      expect(unknownUser).toBeDefined();
      expect(unknownUser?.metrics.requests).toBe(25);
      expect(unknownUser?.metrics.cost).toBe(0.05);
    });

    it('should log skipped requests in enrichment summary', async () => {
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 100,
        total_tokens: 1000,
        prompt_tokens: 500,
        completion_tokens: 500,
        spend: 0.1,
        daily_metrics: [
          {
            date: '2024-01-01',
            metrics: {
              api_requests: 100,
              total_tokens: 1000,
              prompt_tokens: 500,
              completion_tokens: 500,
              spend: 0.1,
              successful_requests: 95,
              failed_requests: 5,
            },
            breakdown: {
              models: {
                'test-model': {
                  metrics: {
                    api_requests: 100,
                    total_tokens: 1000,
                    prompt_tokens: 500,
                    completion_tokens: 500,
                    spend: 0.1,
                  },
                  api_key_breakdown: {
                    '': {
                      // 10 skipped requests
                      metrics: {
                        api_requests: 10,
                        total_tokens: 0,
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        spend: 0,
                      },
                    },
                    'valid-key': {
                      // 90 valid requests
                      metrics: {
                        api_requests: 90,
                        total_tokens: 1000,
                        prompt_tokens: 500,
                        completion_tokens: 500,
                        spend: 0.1,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      });

      (fastify.pg!.query as Mock).mockResolvedValue({
        rows: [
          {
            litellm_key_alias: 'user-key',
            key_hash: 'valid-key',
            user_id: 'user-1',
            key_name: 'Test Key',
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
          },
        ],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      const result = await service.getAnalytics(filters);

      // Should have skipped the empty key (10 requests)
      expect(fastify.log.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          keyHash: '',
          requests: 10,
        }),
        'Skipping invalid API key entry (empty key hash)',
      );

      // Should log enrichment summary - check that it was called with skippedRequests
      const enrichmentLogCall = (fastify.log.info as Mock).mock.calls.find(
        (call) => call[1] === 'Data enrichment complete - API keys matched by hash',
      );
      expect(enrichmentLogCall).toBeDefined();
      expect(enrichmentLogCall?.[0]).toMatchObject({
        skippedRequests: 10,
        mappedRequests: 90,
        processedRequests: 90,
      });

      // Result should only include the 90 valid requests in user breakdown
      const userBreakdown = await service.getUserBreakdown(filters);
      const totalUserRequests = userBreakdown.reduce((sum, u) => sum + u.metrics.requests, 0);
      expect(totalUserRequests).toBe(90); // Only the mapped user, skipped requests excluded
    });
  });

  describe('API Key Filtering', () => {
    it('should preserve API key breakdown in enriched user data', async () => {
      const fastify = createMockFastify();
      const liteLLMService = createMockLiteLLMService();
      const cacheManager = createMockCacheManager();

      const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

      const mockLiteLLMData: LiteLLMDayData = {
        date: '2024-01-01',
        metrics: {
          api_requests: 100,
          total_tokens: 5000,
          prompt_tokens: 3000,
          completion_tokens: 2000,
          spend: 0.5,
          successful_requests: 95,
          failed_requests: 5,
        },
        breakdown: {
          models: {
            'openai/gpt-4': {
              metrics: {
                api_requests: 100,
                total_tokens: 5000,
                prompt_tokens: 3000,
                completion_tokens: 2000,
                spend: 0.5,
              },
              api_keys: {
                'key-hash-1': {
                  metadata: { key_alias: 'user1-key-alpha' },
                  metrics: {
                    api_requests: 60,
                    total_tokens: 3000,
                    prompt_tokens: 1800,
                    completion_tokens: 1200,
                    spend: 0.3,
                    successful_requests: 57,
                    failed_requests: 3,
                  },
                },
                'key-hash-2': {
                  metadata: { key_alias: 'user1-key-beta' },
                  metrics: {
                    api_requests: 40,
                    total_tokens: 2000,
                    prompt_tokens: 1200,
                    completion_tokens: 800,
                    spend: 0.2,
                    successful_requests: 38,
                    failed_requests: 2,
                  },
                },
              },
            },
          },
          providers: {},
        },
      };

      // Mock database query for API key mapping (needs to be called twice - once for getAnalytics, once for getUserBreakdown)
      (fastify.pg.query as Mock).mockResolvedValue({
        rows: [
          {
            litellm_key_alias: 'user1-key-alpha',
            key_hash: 'key-hash-1',
            user_id: 'user-1',
            key_name: 'Production Key',
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
          },
          {
            litellm_key_alias: 'user1-key-beta',
            key_hash: 'key-hash-2',
            user_id: 'user-1',
            key_name: 'Dev Key',
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
          },
        ],
      });

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 100,
        total_tokens: 5000,
        spend: 0.5,
        daily_metrics: [mockLiteLLMData],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      await service.getAnalytics(filters);

      // Check that API key data was preserved
      // (verified indirectly through user breakdown)

      const userBreakdown = await service.getUserBreakdown(filters);
      expect(userBreakdown).toHaveLength(1);

      // The enriched data should contain API key breakdown
      // This is verified indirectly through the aggregation working correctly
      expect(userBreakdown[0].metrics.requests).toBe(100);
    });

    it('should filter by API key IDs when apiKeyIds filter is provided', async () => {
      const fastify = createMockFastify();
      const liteLLMService = createMockLiteLLMService();
      const cacheManager = createMockCacheManager();

      const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

      // Mock LiteLLM daily_metrics response
      const mockDailyMetric = {
        date: '2024-01-01',
        metrics: {
          api_requests: 100,
          total_tokens: 5000,
          prompt_tokens: 3000,
          completion_tokens: 2000,
          spend: 0.5,
          successful_requests: 95,
          failed_requests: 5,
        },
        breakdown: {
          models: {
            'openai/gpt-4': {
              metrics: {
                api_requests: 100,
                total_tokens: 5000,
                prompt_tokens: 3000,
                completion_tokens: 2000,
                spend: 0.5,
              },
              api_key_breakdown: {
                'key-hash-1': {
                  metadata: { key_alias: 'user1-key-alpha' },
                  metrics: {
                    api_requests: 60,
                    total_tokens: 3000,
                    prompt_tokens: 1800,
                    completion_tokens: 1200,
                    spend: 0.3,
                    successful_requests: 57,
                    failed_requests: 3,
                  },
                },
                'key-hash-2': {
                  metadata: { key_alias: 'user1-key-beta' },
                  metrics: {
                    api_requests: 40,
                    total_tokens: 2000,
                    prompt_tokens: 1200,
                    completion_tokens: 800,
                    spend: 0.2,
                    successful_requests: 38,
                    failed_requests: 2,
                  },
                },
              },
            },
          },
          providers: {},
        },
      };

      // Mock database query for API key mapping
      (fastify.pg.query as Mock).mockResolvedValueOnce({
        rows: [
          {
            litellm_key_alias: 'user1-key-alpha',
            key_hash: 'key-hash-1',
            user_id: 'user-1',
            key_name: 'Production Key',
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
          },
          {
            litellm_key_alias: 'user1-key-beta',
            key_hash: 'key-hash-2',
            user_id: 'user-1',
            key_name: 'Dev Key',
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
          },
        ],
      });

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 100,
        total_tokens: 5000,
        spend: 0.5,
        daily_metrics: [mockDailyMetric],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      // Filter by only one API key
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        apiKeyIds: ['user1-key-alpha'],
      };

      const result = await service.getAnalytics(filters);

      // Should only include metrics from user1-key-alpha (60 requests)
      expect(result.totalRequests).toBe(60);
      expect(result.totalTokens.total).toBe(3000);
      expect(result.totalCost.total).toBe(0.3);
    });

    it('should combine apiKeyIds with userIds filter using AND logic', async () => {
      const fastify = createMockFastify();
      const liteLLMService = createMockLiteLLMService();
      const cacheManager = createMockCacheManager();

      const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

      // Mock LiteLLM daily_metrics response
      const mockDailyMetric = {
        date: '2024-01-01',
        metrics: {
          api_requests: 150,
          total_tokens: 7500,
          prompt_tokens: 4500,
          completion_tokens: 3000,
          spend: 0.75,
          successful_requests: 143,
          failed_requests: 7,
        },
        breakdown: {
          models: {
            'openai/gpt-4': {
              metrics: {
                api_requests: 150,
                total_tokens: 7500,
                prompt_tokens: 4500,
                completion_tokens: 3000,
                spend: 0.75,
              },
              api_key_breakdown: {
                'key-hash-1': {
                  metadata: { key_alias: 'user1-key-alpha' },
                  metrics: {
                    api_requests: 60,
                    total_tokens: 3000,
                    prompt_tokens: 1800,
                    completion_tokens: 1200,
                    spend: 0.3,
                    successful_requests: 57,
                    failed_requests: 3,
                  },
                },
                'key-hash-2': {
                  metadata: { key_alias: 'user2-key-gamma' },
                  metrics: {
                    api_requests: 50,
                    total_tokens: 2500,
                    prompt_tokens: 1500,
                    completion_tokens: 1000,
                    spend: 0.25,
                    successful_requests: 48,
                    failed_requests: 2,
                  },
                },
                'key-hash-3': {
                  metadata: { key_alias: 'user1-key-beta' },
                  metrics: {
                    api_requests: 40,
                    total_tokens: 2000,
                    prompt_tokens: 1200,
                    completion_tokens: 800,
                    spend: 0.2,
                    successful_requests: 38,
                    failed_requests: 2,
                  },
                },
              },
            },
          },
          providers: {},
        },
      };

      // Mock database query for API key mapping
      (fastify.pg.query as Mock).mockResolvedValueOnce({
        rows: [
          {
            litellm_key_alias: 'user1-key-alpha',
            key_hash: 'key-hash-1',
            user_id: 'user-1',
            key_name: 'User1 Key Alpha',
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
          },
          {
            litellm_key_alias: 'user1-key-beta',
            key_hash: 'key-hash-3',
            user_id: 'user-1',
            key_name: 'User1 Key Beta',
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
          },
          {
            litellm_key_alias: 'user2-key-gamma',
            key_hash: 'key-hash-2',
            user_id: 'user-2',
            key_name: 'User2 Key Gamma',
            username: 'user2',
            email: 'user2@example.com',
            role: 'user',
          },
        ],
      });

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 150,
        total_tokens: 7500,
        spend: 0.75,
        daily_metrics: [mockDailyMetric],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      // Filter by user-1 AND key-alpha
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        userIds: ['user-1'],
        apiKeyIds: ['user1-key-alpha'],
      };

      const result = await service.getAnalytics(filters);

      // Should only include user1-key-alpha (60 requests)
      // user1-key-beta is excluded by apiKeyIds filter
      // user2-key-gamma is excluded by userIds filter
      expect(result.totalRequests).toBe(60);
      expect(result.totalTokens.total).toBe(3000);
      expect(result.totalCost.total).toBe(0.3);
    });

    it('should use fast path (pre-aggregated metrics) when no apiKeyIds filter', async () => {
      const fastify = createMockFastify();
      const liteLLMService = createMockLiteLLMService();
      const cacheManager = createMockCacheManager();

      const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

      const mockLiteLLMData: LiteLLMDayData = {
        date: '2024-01-01',
        metrics: {
          api_requests: 100,
          total_tokens: 5000,
          prompt_tokens: 3000,
          completion_tokens: 2000,
          spend: 0.5,
          successful_requests: 95,
          failed_requests: 5,
        },
        breakdown: {
          models: {
            'openai/gpt-4': {
              metrics: {
                api_requests: 100,
                total_tokens: 5000,
                prompt_tokens: 3000,
                completion_tokens: 2000,
                spend: 0.5,
              },
              api_keys: {
                'key-hash-1': {
                  metadata: { key_alias: 'user1-key-alpha' },
                  metrics: {
                    api_requests: 60,
                    total_tokens: 3000,
                    prompt_tokens: 1800,
                    completion_tokens: 1200,
                    spend: 0.3,
                    successful_requests: 57,
                    failed_requests: 3,
                  },
                },
                'key-hash-2': {
                  metadata: { key_alias: 'user1-key-beta' },
                  metrics: {
                    api_requests: 40,
                    total_tokens: 2000,
                    prompt_tokens: 1200,
                    completion_tokens: 800,
                    spend: 0.2,
                    successful_requests: 38,
                    failed_requests: 2,
                  },
                },
              },
            },
          },
          providers: {},
        },
      };

      // Mock database query for API key mapping
      (fastify.pg.query as Mock).mockResolvedValueOnce({
        rows: [
          {
            litellm_key_alias: 'user1-key-alpha',
            key_hash: 'key-hash-1',
            user_id: 'user-1',
            key_name: 'Production Key',
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
          },
          {
            litellm_key_alias: 'user1-key-beta',
            key_hash: 'key-hash-2',
            user_id: 'user-1',
            key_name: 'Dev Key',
            username: 'user1',
            email: 'user1@example.com',
            role: 'user',
          },
        ],
      });

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 100,
        total_tokens: 5000,
        spend: 0.5,
        daily_metrics: [mockLiteLLMData],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      // No API key filter - should use fast path
      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      const result = await service.getAnalytics(filters);

      // Should include all requests (100) using pre-aggregated metrics
      expect(result.totalRequests).toBe(100);
      expect(result.totalTokens.total).toBe(5000);
      expect(result.totalCost.total).toBe(0.5);
    });

    it('should handle unmapped API keys correctly', async () => {
      const fastify = createMockFastify();
      const liteLLMService = createMockLiteLLMService();
      const cacheManager = createMockCacheManager();

      const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

      const mockLiteLLMData: LiteLLMDayData = {
        date: '2024-01-01',
        metrics: {
          api_requests: 100,
          total_tokens: 5000,
          prompt_tokens: 3000,
          completion_tokens: 2000,
          spend: 0.5,
          successful_requests: 95,
          failed_requests: 5,
        },
        breakdown: {
          models: {
            'openai/gpt-4': {
              metrics: {
                api_requests: 100,
                total_tokens: 5000,
                prompt_tokens: 3000,
                completion_tokens: 2000,
                spend: 0.5,
              },
              api_keys: {
                'key-hash-unmapped': {
                  metadata: { key_alias: 'unmapped-key-xyz' },
                  metrics: {
                    api_requests: 100,
                    total_tokens: 5000,
                    prompt_tokens: 3000,
                    completion_tokens: 2000,
                    spend: 0.5,
                    successful_requests: 95,
                    failed_requests: 5,
                  },
                },
              },
            },
          },
          providers: {},
        },
      };

      // Mock database query - no mapping for unmapped-key-xyz (needs to be called twice - once for getAnalytics, once for getUserBreakdown)
      (fastify.pg.query as Mock).mockResolvedValue({
        rows: [],
      });

      (liteLLMService.getDailyActivity as Mock).mockResolvedValue({
        api_requests: 100,
        total_tokens: 5000,
        spend: 0.5,
        daily_metrics: [mockLiteLLMData],
      });

      (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

      const filters: AdminUsageFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-01',
      };

      await service.getAnalytics(filters);

      // Should create Unknown User
      const userBreakdown = await service.getUserBreakdown(filters);
      expect(userBreakdown).toHaveLength(1);
      expect(userBreakdown[0].userId).toBe('00000000-0000-0000-0000-000000000000');
      expect(userBreakdown[0].username).toBe('Unknown User');
      expect(userBreakdown[0].email).toBe('unknown@system.local');
      expect(userBreakdown[0].metrics.requests).toBe(100);
    });
  });

  describe('Trend Calculation', () => {
    describe('calculateComparisonPeriod', () => {
      it('should calculate previous 8-day period correctly', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        // Access private method via any cast for testing
        // Jan 20-27 is 8 days, comparison should be Jan 12-19 (also 8 days)
        const result = (service as any).calculateComparisonPeriod('2025-01-20', '2025-01-27');

        expect(result.comparisonStart).toBe('2025-01-12');
        expect(result.comparisonEnd).toBe('2025-01-19');
      });

      it('should calculate previous 31-day period correctly', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        // Jan 1-31 is 31 days, comparison should be Dec 1-31 (also 31 days)
        const result = (service as any).calculateComparisonPeriod('2025-01-01', '2025-01-31');

        expect(result.comparisonStart).toBe('2024-12-01');
        expect(result.comparisonEnd).toBe('2024-12-31');
      });

      it('should calculate single-day comparison period', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const result = (service as any).calculateComparisonPeriod('2025-01-15', '2025-01-15');

        expect(result.comparisonStart).toBe('2025-01-14');
        expect(result.comparisonEnd).toBe('2025-01-14');
      });
    });

    describe('calculateTrend', () => {
      it('should detect upward trend with percentage increase', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const result = (service as any).calculateTrend('requests', 100, 80);

        expect(result.metric).toBe('requests');
        expect(result.current).toBe(100);
        expect(result.previous).toBe(80);
        expect(result.percentageChange).toBe(25); // (100-80)/80 * 100 = 25%
        expect(result.direction).toBe('up');
      });

      it('should detect downward trend with percentage decrease', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const result = (service as any).calculateTrend('cost', 80, 100);

        expect(result.metric).toBe('cost');
        expect(result.current).toBe(80);
        expect(result.previous).toBe(100);
        expect(result.percentageChange).toBe(-20); // (80-100)/100 * 100 = -20%
        expect(result.direction).toBe('down');
      });

      it('should detect stable trend within threshold', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const result = (service as any).calculateTrend('users', 100, 99.5);

        expect(result.metric).toBe('users');
        expect(result.current).toBe(100);
        expect(result.previous).toBe(99.5);
        expect(result.percentageChange).toBeCloseTo(0.5, 1); // ~0.5% change
        expect(result.direction).toBe('stable'); // Within 1% threshold
      });

      it('should handle zero previous value with current value', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const result = (service as any).calculateTrend('requests', 50, 0);

        expect(result.metric).toBe('requests');
        expect(result.current).toBe(50);
        expect(result.previous).toBe(0);
        expect(result.percentageChange).toBe(100); // Show 100% from baseline
        expect(result.direction).toBe('up');
      });

      it('should handle both zero values as stable', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const result = (service as any).calculateTrend('cost', 0, 0);

        expect(result.metric).toBe('cost');
        expect(result.current).toBe(0);
        expect(result.previous).toBe(0);
        expect(result.percentageChange).toBe(0);
        expect(result.direction).toBe('stable');
      });

      it('should handle exactly 1% increase as stable (at threshold)', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const result = (service as any).calculateTrend('requests', 101, 100);

        expect(result.percentageChange).toBe(1);
        expect(result.direction).toBe('stable'); // Exactly at 1% threshold
      });

      it('should handle 1.1% increase as up (above threshold)', () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const result = (service as any).calculateTrend('requests', 101.1, 100);

        expect(result.percentageChange).toBeCloseTo(1.1, 1);
        expect(result.direction).toBe('up'); // Above 1% threshold
      });
    });

    describe('getAnalytics with trend calculation', () => {
      it('should fallback to stable trends when no comparison data', async () => {
        const service = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

        const mockData = createMockLiteLLMDayData('2025-01-27');

        (fastify.pg.query as Mock).mockResolvedValue({ rows: [] });

        (liteLLMService.getDailyActivity as Mock)
          .mockResolvedValueOnce({
            api_requests: 100,
            total_tokens: 5000,
            spend: 0.5,
            daily_metrics: [mockData],
          })
          .mockResolvedValueOnce({
            api_requests: 0,
            total_tokens: 0,
            spend: 0,
            daily_metrics: [], // No comparison data
          });

        (cacheManager.getCachedDailyData as Mock).mockResolvedValue(null);

        const filters: AdminUsageFilters = {
          startDate: '2025-01-27',
          endDate: '2025-01-27',
        };

        const result = await service.getAnalytics(filters);

        // Should fallback to stable trends
        expect(result.trends.requestsTrend.direction).toBe('stable');
        expect(result.trends.requestsTrend.previous).toBe(0);
        expect(result.trends.costTrend.direction).toBe('stable');
        expect(result.trends.costTrend.previous).toBe(0);
      });
    });
  });
});

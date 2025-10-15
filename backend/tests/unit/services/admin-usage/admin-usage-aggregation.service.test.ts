// backend/tests/unit/services/admin-usage/admin-usage-aggregation.service.test.ts

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { createTestApp } from '../../../helpers/test-app';
import { initTestConfig } from '../../../helpers/test-config';
import { AdminUsageAggregationService } from '../../../../src/services/admin-usage/admin-usage-aggregation.service';
import { extractProviderFromModel } from '../../../../src/services/admin-usage/admin-usage.utils';
import type { EnrichedDayData, AdminUsageFilters } from '../../../../src/types/admin-usage.types';

describe('AdminUsageAggregationService', () => {
  let fastify: any;
  let aggregationService: AdminUsageAggregationService;
  let configCleanup: () => void;

  // Initialize admin analytics configuration before all tests
  beforeAll(() => {
    const { cleanup } = initTestConfig();
    configCleanup = cleanup;
  });

  // Cleanup configuration after all tests
  afterAll(() => {
    if (configCleanup) {
      configCleanup();
    }
  });

  beforeEach(async () => {
    fastify = await createTestApp();
    aggregationService = new AdminUsageAggregationService(fastify);
  });

  // Helper function to create sample enriched day data
  const createSampleDayData = (): EnrichedDayData => ({
    date: '2025-01-15',
    metrics: {
      api_requests: 150,
      total_tokens: 7500,
      prompt_tokens: 4500,
      completion_tokens: 3000,
      spend: 1.875,
      successful_requests: 145,
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
            spend: 1.25,
            successful_requests: 98,
            failed_requests: 2,
          },
          users: {
            'user-1': {
              userId: 'user-1',
              username: 'john.doe',
              email: 'john@example.com',
              metrics: {
                api_requests: 60,
                total_tokens: 3000,
                prompt_tokens: 1800,
                completion_tokens: 1200,
                spend: 0.75,
                successful_requests: 59,
                failed_requests: 1,
              },
            },
            'user-2': {
              userId: 'user-2',
              username: 'jane.smith',
              email: 'jane@example.com',
              metrics: {
                api_requests: 40,
                total_tokens: 2000,
                prompt_tokens: 1200,
                completion_tokens: 800,
                spend: 0.5,
                successful_requests: 39,
                failed_requests: 1,
              },
            },
          },
        },
        'anthropic/claude-3': {
          metrics: {
            api_requests: 50,
            total_tokens: 2500,
            prompt_tokens: 1500,
            completion_tokens: 1000,
            spend: 0.625,
            successful_requests: 47,
            failed_requests: 3,
          },
          users: {
            'user-1': {
              userId: 'user-1',
              username: 'john.doe',
              email: 'john@example.com',
              metrics: {
                api_requests: 50,
                total_tokens: 2500,
                prompt_tokens: 1500,
                completion_tokens: 1000,
                spend: 0.625,
                successful_requests: 47,
                failed_requests: 3,
              },
            },
          },
        },
      },
      providers: {
        openai: {
          metrics: {
            api_requests: 100,
            total_tokens: 5000,
            prompt_tokens: 3000,
            completion_tokens: 2000,
            spend: 1.25,
          },
        },
        anthropic: {
          metrics: {
            api_requests: 50,
            total_tokens: 2500,
            prompt_tokens: 1500,
            completion_tokens: 1000,
            spend: 0.625,
          },
        },
      },
      users: {
        'user-1': {
          userId: 'user-1',
          username: 'john.doe',
          email: 'john@example.com',
          role: 'user',
          metrics: {
            api_requests: 110,
            total_tokens: 5500,
            prompt_tokens: 3300,
            completion_tokens: 2200,
            spend: 1.375,
            successful_requests: 106,
            failed_requests: 4,
          },
          models: {
            'openai/gpt-4': {
              modelName: 'openai/gpt-4',
              metrics: {
                api_requests: 60,
                total_tokens: 3000,
                prompt_tokens: 1800,
                completion_tokens: 1200,
                spend: 0.75,
                successful_requests: 59,
                failed_requests: 1,
              },
              api_keys: {
                'key-1': {
                  keyAlias: 'key-1',
                  metrics: {
                    api_requests: 40,
                    total_tokens: 2000,
                    prompt_tokens: 1200,
                    completion_tokens: 800,
                    spend: 0.5,
                    successful_requests: 39,
                    failed_requests: 1,
                  },
                },
                'key-2': {
                  keyAlias: 'key-2',
                  metrics: {
                    api_requests: 20,
                    total_tokens: 1000,
                    prompt_tokens: 600,
                    completion_tokens: 400,
                    spend: 0.25,
                    successful_requests: 20,
                    failed_requests: 0,
                  },
                },
              },
            },
            'anthropic/claude-3': {
              modelName: 'anthropic/claude-3',
              metrics: {
                api_requests: 50,
                total_tokens: 2500,
                prompt_tokens: 1500,
                completion_tokens: 1000,
                spend: 0.625,
                successful_requests: 47,
                failed_requests: 3,
              },
              api_keys: {
                'key-1': {
                  keyAlias: 'key-1',
                  metrics: {
                    api_requests: 50,
                    total_tokens: 2500,
                    prompt_tokens: 1500,
                    completion_tokens: 1000,
                    spend: 0.625,
                    successful_requests: 47,
                    failed_requests: 3,
                  },
                },
              },
            },
          },
        },
        'user-2': {
          userId: 'user-2',
          username: 'jane.smith',
          email: 'jane@example.com',
          role: 'user',
          metrics: {
            api_requests: 40,
            total_tokens: 2000,
            prompt_tokens: 1200,
            completion_tokens: 800,
            spend: 0.5,
            successful_requests: 39,
            failed_requests: 1,
          },
          models: {
            'openai/gpt-4': {
              modelName: 'openai/gpt-4',
              metrics: {
                api_requests: 40,
                total_tokens: 2000,
                prompt_tokens: 1200,
                completion_tokens: 800,
                spend: 0.5,
                successful_requests: 39,
                failed_requests: 1,
              },
              api_keys: {
                'key-3': {
                  keyAlias: 'key-3',
                  metrics: {
                    api_requests: 40,
                    total_tokens: 2000,
                    prompt_tokens: 1200,
                    completion_tokens: 800,
                    spend: 0.5,
                    successful_requests: 39,
                    failed_requests: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // ============================================================================
  // aggregateDailyData Tests
  // ============================================================================

  describe('aggregateDailyData', () => {
    it('should aggregate daily data with no filters', () => {
      const dailyData = [createSampleDayData()];
      const filters: AdminUsageFilters = {
        startDate: '2025-01-15',
        endDate: '2025-01-15',
      };

      const result = aggregationService.aggregateDailyData(dailyData, filters);

      expect(result.period.startDate).toBe('2025-01-15');
      expect(result.period.endDate).toBe('2025-01-15');
      expect(result.totalMetrics.api_requests).toBe(150);
      expect(result.totalMetrics.total_tokens).toBe(7500);
      expect(result.totalMetrics.spend).toBe(1.875);
      expect(result.totalMetrics.successful_requests).toBe(145);
      expect(result.totalMetrics.failed_requests).toBe(5);
      expect(result.totalMetrics.success_rate).toBeCloseTo(96.67, 2);

      // Check user breakdown
      expect(Object.keys(result.byUser)).toHaveLength(2);
      expect(result.byUser['user-1'].metrics.api_requests).toBe(110);
      expect(result.byUser['user-2'].metrics.api_requests).toBe(40);

      // Check model breakdown
      expect(Object.keys(result.byModel)).toHaveLength(2);
      expect(result.byModel['openai/gpt-4'].metrics.api_requests).toBe(100);
      expect(result.byModel['anthropic/claude-3'].metrics.api_requests).toBe(50);

      // Check provider breakdown
      expect(Object.keys(result.byProvider)).toHaveLength(2);
      expect(result.byProvider.openai.metrics.api_requests).toBe(100);
      expect(result.byProvider.anthropic.metrics.api_requests).toBe(50);
    });

    it('should filter by user IDs', () => {
      const dailyData = [createSampleDayData()];
      const filters: AdminUsageFilters = {
        startDate: '2025-01-15',
        endDate: '2025-01-15',
        userIds: ['user-1'],
      };

      const result = aggregationService.aggregateDailyData(dailyData, filters);

      // Only user-1's metrics should be included
      expect(Object.keys(result.byUser)).toHaveLength(1);
      expect(result.byUser['user-1']).toBeDefined();
      expect(result.byUser['user-2']).toBeUndefined();

      // Total metrics should only reflect user-1
      expect(result.totalMetrics.api_requests).toBe(110);
      expect(result.totalMetrics.total_tokens).toBe(5500);
      expect(result.totalMetrics.spend).toBe(1.375);
    });

    it('should filter by model IDs', () => {
      const dailyData = [createSampleDayData()];
      const filters: AdminUsageFilters = {
        startDate: '2025-01-15',
        endDate: '2025-01-15',
        modelIds: ['openai/gpt-4'],
      };

      const result = aggregationService.aggregateDailyData(dailyData, filters);

      // Only gpt-4 model should be included in user breakdowns
      expect(result.byUser['user-1'].models['openai/gpt-4']).toBeDefined();
      expect(result.byUser['user-1'].models['anthropic/claude-3']).toBeUndefined();

      // Total metrics should only reflect gpt-4
      expect(result.totalMetrics.api_requests).toBe(100);
      expect(result.totalMetrics.total_tokens).toBe(5000);
      expect(result.totalMetrics.spend).toBe(1.25);
    });

    it('should filter by API key IDs', () => {
      const dailyData = [createSampleDayData()];
      const filters: AdminUsageFilters = {
        startDate: '2025-01-15',
        endDate: '2025-01-15',
        apiKeyIds: ['key-1'],
      };

      const result = aggregationService.aggregateDailyData(dailyData, filters);

      // Only key-1's metrics should be included
      // user-1 used key-1 for: gpt-4 (40 requests) + claude-3 (50 requests) = 90 requests
      expect(result.byUser['user-1'].metrics.api_requests).toBe(90);

      // user-2 didn't use key-1, so should not appear
      expect(result.byUser['user-2']).toBeUndefined();

      // Total should be 90 requests (key-1 only)
      expect(result.totalMetrics.api_requests).toBe(90);
    });

    it('should handle combined filters (user + model)', () => {
      const dailyData = [createSampleDayData()];
      const filters: AdminUsageFilters = {
        startDate: '2025-01-15',
        endDate: '2025-01-15',
        userIds: ['user-1'],
        modelIds: ['openai/gpt-4'],
      };

      const result = aggregationService.aggregateDailyData(dailyData, filters);

      // Only user-1 with gpt-4
      expect(Object.keys(result.byUser)).toHaveLength(1);
      expect(result.byUser['user-1'].models['openai/gpt-4']).toBeDefined();
      expect(result.byUser['user-1'].models['anthropic/claude-3']).toBeUndefined();

      // Total should be user-1's gpt-4 usage only
      expect(result.totalMetrics.api_requests).toBe(60);
      expect(result.totalMetrics.total_tokens).toBe(3000);
      expect(result.totalMetrics.spend).toBe(0.75);
    });

    it('should handle combined filters (user + API key)', () => {
      const dailyData = [createSampleDayData()];
      const filters: AdminUsageFilters = {
        startDate: '2025-01-15',
        endDate: '2025-01-15',
        userIds: ['user-1'],
        apiKeyIds: ['key-2'],
      };

      const result = aggregationService.aggregateDailyData(dailyData, filters);

      // Only user-1 with key-2 (gpt-4: 20 requests)
      expect(result.byUser['user-1'].metrics.api_requests).toBe(20);
      expect(result.totalMetrics.api_requests).toBe(20);
      expect(result.totalMetrics.total_tokens).toBe(1000);
    });

    it('should aggregate multiple days', () => {
      const day1 = createSampleDayData();
      const day2 = { ...createSampleDayData(), date: '2025-01-16' };

      const dailyData = [day1, day2];
      const filters: AdminUsageFilters = {
        startDate: '2025-01-15',
        endDate: '2025-01-16',
      };

      const result = aggregationService.aggregateDailyData(dailyData, filters);

      expect(result.period.startDate).toBe('2025-01-15');
      expect(result.period.endDate).toBe('2025-01-16');

      // Metrics should be doubled (2 identical days)
      expect(result.totalMetrics.api_requests).toBe(300);
      expect(result.totalMetrics.total_tokens).toBe(15000);
      expect(result.totalMetrics.spend).toBe(3.75);
    });
  });

  // ============================================================================
  // aggregateByUser Tests
  // ============================================================================

  describe('aggregateByUser', () => {
    it('should generate user breakdown', () => {
      const dailyData = [createSampleDayData()];

      const result = aggregationService.aggregateByUser(dailyData);

      expect(result).toHaveLength(2);

      const user1 = result.find((u) => u.userId === 'user-1');
      expect(user1).toBeDefined();
      expect(user1!.username).toBe('john.doe');
      expect(user1!.email).toBe('john@example.com');
      expect(user1!.metrics.requests).toBe(110);
      expect(user1!.metrics.tokens.total).toBe(5500);
      expect(user1!.metrics.cost).toBe(1.375);
      expect(user1!.metrics.models).toHaveLength(2);

      const user2 = result.find((u) => u.userId === 'user-2');
      expect(user2).toBeDefined();
      expect(user2!.username).toBe('jane.smith');
      expect(user2!.metrics.requests).toBe(40);
      expect(user2!.metrics.models).toHaveLength(1);
    });

    it('should include model details for each user', () => {
      const dailyData = [createSampleDayData()];

      const result = aggregationService.aggregateByUser(dailyData);

      const user1 = result.find((u) => u.userId === 'user-1');
      const gpt4Model = user1!.metrics.models.find((m) => m.modelName === 'openai/gpt-4');

      expect(gpt4Model).toBeDefined();
      expect(gpt4Model!.provider).toBe('openai');
      expect(gpt4Model!.requests).toBe(60);
      expect(gpt4Model!.tokens.total).toBe(3000);
      expect(gpt4Model!.cost).toBe(0.75);
    });
  });

  // ============================================================================
  // aggregateByModel Tests
  // ============================================================================

  describe('aggregateByModel', () => {
    it('should generate model breakdown', () => {
      const dailyData = [createSampleDayData()];

      const result = aggregationService.aggregateByModel(dailyData);

      expect(result).toHaveLength(2);

      const gpt4 = result.find((m) => m.modelName === 'openai/gpt-4');
      expect(gpt4).toBeDefined();
      expect(gpt4!.provider).toBe('openai');
      expect(gpt4!.metrics.requests).toBe(100);
      expect(gpt4!.metrics.tokens.total).toBe(5000);
      expect(gpt4!.metrics.cost).toBe(1.25);
      expect(gpt4!.metrics.users).toBe(2);
      expect(gpt4!.metrics.successRate).toBeCloseTo(98, 0);

      const claude = result.find((m) => m.modelName === 'anthropic/claude-3');
      expect(claude).toBeDefined();
      expect(claude!.provider).toBe('anthropic');
      expect(claude!.metrics.users).toBe(1);
    });

    it('should include top users for each model', () => {
      const dailyData = [createSampleDayData()];

      const result = aggregationService.aggregateByModel(dailyData);

      const gpt4 = result.find((m) => m.modelName === 'openai/gpt-4');
      expect(gpt4!.topUsers).toHaveLength(2);

      // Top users should be sorted by cost (descending)
      expect(gpt4!.topUsers[0].userId).toBe('user-1'); // 0.75 cost
      expect(gpt4!.topUsers[1].userId).toBe('user-2'); // 0.5 cost
    });
  });

  // ============================================================================
  // aggregateByProvider Tests
  // ============================================================================

  describe('aggregateByProvider', () => {
    it('should generate provider breakdown', () => {
      const dailyData = [createSampleDayData()];

      const result = aggregationService.aggregateByProvider(dailyData);

      expect(result).toHaveLength(2);

      const openai = result.find((p) => p.provider === 'openai');
      expect(openai).toBeDefined();
      expect(openai!.metrics.requests).toBe(100);
      expect(openai!.metrics.tokens.total).toBe(5000);
      expect(openai!.metrics.cost).toBe(1.25);
      expect(openai!.metrics.models).toBe(1);
      expect(openai!.metrics.users).toBe(2);

      const anthropic = result.find((p) => p.provider === 'anthropic');
      expect(anthropic).toBeDefined();
      expect(anthropic!.metrics.models).toBe(1);
      expect(anthropic!.metrics.users).toBe(1);
    });

    it('should include top models for each provider', () => {
      const dailyData = [createSampleDayData()];

      const result = aggregationService.aggregateByProvider(dailyData);

      const openai = result.find((p) => p.provider === 'openai');
      expect(openai!.topModels).toHaveLength(1);
      expect(openai!.topModels[0].modelName).toBe('openai/gpt-4');
      expect(openai!.topModels[0].cost).toBe(1.25);
    });
  });

  // ============================================================================
  // extractProviderFromModel Tests
  // ============================================================================

  describe('extractProviderFromModel', () => {
    it('should extract provider from slash-separated model names', () => {
      expect(extractProviderFromModel('openai/gpt-4')).toBe('openai');
      expect(extractProviderFromModel('anthropic/claude-3')).toBe('anthropic');
      expect(extractProviderFromModel('google/gemini-pro')).toBe('google');
    });

    it('should infer provider from model name patterns', () => {
      expect(extractProviderFromModel('gpt-4')).toBe('openai');
      expect(extractProviderFromModel('gpt-3.5-turbo')).toBe('openai');
      expect(extractProviderFromModel('claude-3-opus')).toBe('anthropic');
      expect(extractProviderFromModel('gemini-pro')).toBe('google');
    });

    it('should return unknown for unrecognized patterns', () => {
      expect(extractProviderFromModel('my-custom-model')).toBe('unknown');
      expect(extractProviderFromModel('llama-2')).toBe('unknown');
    });
  });
});

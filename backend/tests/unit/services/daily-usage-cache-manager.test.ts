import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { DailyUsageCacheManager } from '../../../src/services/daily-usage-cache-manager';
import { initAdminAnalyticsConfig } from '../../../src/config/admin-analytics.config';
import type { FastifyInstance } from 'fastify';
import type {
  EnrichedDayData,
  DayMetrics,
  UserMetrics,
  ModelMetrics,
  ProviderMetrics,
} from '../../../src/services/daily-usage-cache-manager';

describe('DailyUsageCacheManager', () => {
  beforeAll(() => {
    // Initialize admin analytics configuration
    initAdminAnalyticsConfig();
  });
  let service: DailyUsageCacheManager;
  let mockFastify: Partial<FastifyInstance>;
  let mockPgClient: any;

  // Mock data structures
  const mockDayMetrics: DayMetrics = {
    api_requests: 1000,
    total_tokens: 50000,
    prompt_tokens: 25000,
    completion_tokens: 25000,
    spend: 12.5,
    successful_requests: 980,
    failed_requests: 20,
  };

  const mockUserMetrics: Record<string, UserMetrics> = {
    'user-123': {
      user_id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
      api_requests: 500,
      total_tokens: 25000,
      prompt_tokens: 12500,
      completion_tokens: 12500,
      spend: 6.25,
      api_keys: ['key-hash-1', 'key-hash-2'],
    },
  };

  const mockModelMetrics: Record<string, ModelMetrics> = {
    'gpt-4': {
      model_id: 'gpt-4',
      model_name: 'GPT-4',
      api_requests: 600,
      total_tokens: 30000,
      prompt_tokens: 15000,
      completion_tokens: 15000,
      spend: 7.5,
    },
  };

  const mockProviderMetrics: Record<string, ProviderMetrics> = {
    openai: {
      provider: 'openai',
      api_requests: 800,
      total_tokens: 40000,
      spend: 10.0,
    },
  };

  const mockEnrichedDayData: EnrichedDayData = {
    date: '2024-01-15',
    metrics: mockDayMetrics,
    breakdown: {
      models: mockModelMetrics,
      providers: mockProviderMetrics,
      users: mockUserMetrics,
    },
    rawData: { mock: 'raw data' },
  };

  beforeEach(() => {
    mockPgClient = {
      query: vi.fn(),
      connect: vi.fn(),
      release: vi.fn(),
    };

    mockFastify = {
      config: {
        USAGE_CACHE_TTL_MINUTES: 5,
      },
      pg: {
        query: vi.fn(),
        connect: vi.fn().mockResolvedValue(mockPgClient),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    } as Partial<FastifyInstance>;

    service = new DailyUsageCacheManager(mockFastify as FastifyInstance);
  });

  describe('getCachedDailyData', () => {
    it('should return null when no cached data exists', async () => {
      mockFastify.pg!.query = vi.fn().mockResolvedValue({ rows: [] });

      const result = await service.getCachedDailyData('2024-01-15');

      expect(result).toBeNull();
      expect(mockFastify.log!.debug).toHaveBeenCalledWith(
        { dateString: '2024-01-15' },
        'Cache miss - no rebuild function provided',
      );
    });

    it('should return cached data for historical day', async () => {
      const mockRow = {
        date: '2024-01-15',
        raw_data: { mock: 'raw data' },
        aggregated_by_user: mockUserMetrics,
        aggregated_by_model: mockModelMetrics,
        aggregated_by_provider: mockProviderMetrics,
        total_metrics: mockDayMetrics,
        updated_at: new Date('2024-01-15T10:00:00Z'),
        is_complete: true,
      };

      mockFastify.pg!.query = vi.fn().mockResolvedValue({ rows: [mockRow] });

      const result = await service.getCachedDailyData('2024-01-15');

      expect(result).not.toBeNull();
      expect(result!.date).toBe('2024-01-15');
      expect(result!.metrics).toEqual(mockDayMetrics);
      expect(result!.breakdown.users).toEqual(mockUserMetrics);
      expect(mockFastify.log!.debug).toHaveBeenCalledWith(
        expect.objectContaining({ dateString: '2024-01-15' }),
        'Cache hit',
      );
    });

    it('should return null for stale current day cache (> 5 minutes old)', async () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const mockRow = {
        date: '2024-01-15',
        raw_data: { mock: 'raw data' },
        aggregated_by_user: mockUserMetrics,
        aggregated_by_model: mockModelMetrics,
        aggregated_by_provider: mockProviderMetrics,
        total_metrics: mockDayMetrics,
        updated_at: sixMinutesAgo,
        is_complete: false,
      };

      mockFastify.pg!.query = vi.fn().mockResolvedValue({ rows: [mockRow] });

      const result = await service.getCachedDailyData('2024-01-15');

      expect(result).toBeNull();
      // Check for the stale cache debug message (first call)
      expect(mockFastify.log!.debug).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2024-01-15' }),
        'Current day cache is stale',
      );
    });

    it('should return fresh current day cache (< 5 minutes old)', async () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const mockRow = {
        date: '2024-01-15',
        raw_data: { mock: 'raw data' },
        aggregated_by_user: mockUserMetrics,
        aggregated_by_model: mockModelMetrics,
        aggregated_by_provider: mockProviderMetrics,
        total_metrics: mockDayMetrics,
        updated_at: twoMinutesAgo,
        is_complete: false,
      };

      mockFastify.pg!.query = vi.fn().mockResolvedValue({ rows: [mockRow] });

      const result = await service.getCachedDailyData('2024-01-15');

      expect(result).not.toBeNull();
      expect(result!.date).toBe('2024-01-15');
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(service.getCachedDailyData('2024-01-15')).rejects.toThrow();
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.objectContaining({ dateString: '2024-01-15' }),
        'Failed to check cache',
      );
    });
  });

  describe('saveToDailyCache', () => {
    it('should save historical day data with is_complete = true', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.pg!.query = mockQuery;

      await service.saveToDailyCache(
        '2024-01-15',
        mockEnrichedDayData,
        false, // Not current day
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO daily_usage_cache'),
        expect.arrayContaining([
          '2024-01-15',
          JSON.stringify(mockEnrichedDayData.rawData),
          JSON.stringify(mockUserMetrics),
          JSON.stringify(mockModelMetrics),
          JSON.stringify(mockProviderMetrics),
          JSON.stringify(mockDayMetrics),
          true, // is_complete = true for historical day
        ]),
      );

      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        { date: '2024-01-15', isComplete: true },
        'Successfully cached daily usage data',
      );
    });

    it('should save current day data with is_complete = false', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.pg!.query = mockQuery;

      await service.saveToDailyCache(
        '2024-01-15',
        mockEnrichedDayData,
        true, // Current day
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO daily_usage_cache'),
        expect.arrayContaining([
          '2024-01-15',
          JSON.stringify(mockEnrichedDayData.rawData),
          JSON.stringify(mockUserMetrics),
          JSON.stringify(mockModelMetrics),
          JSON.stringify(mockProviderMetrics),
          JSON.stringify(mockDayMetrics),
          false, // is_complete = false for current day
        ]),
      );

      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        { date: '2024-01-15', isComplete: false },
        'Successfully cached daily usage data',
      );
    });

    it('should handle upsert conflicts correctly', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.pg!.query = mockQuery;

      await service.saveToDailyCache('2024-01-15', mockEnrichedDayData, false);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (date)'),
        expect.any(Array),
      );
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Insert failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(
        service.saveToDailyCache('2024-01-15', mockEnrichedDayData, false),
      ).rejects.toThrow();

      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: dbError }),
        'Failed to save to daily cache',
      );
    });
  });

  describe('getDateRangeData', () => {
    it('should return empty aggregated data when no cached data exists', async () => {
      mockFastify.pg!.query = vi.fn().mockResolvedValue({ rows: [] });

      const result = await service.getDateRangeData('2024-01-01', '2024-01-31');

      expect(result).toBeDefined();
      expect(result!.period.startDate).toBe('2024-01-01');
      expect(result!.period.endDate).toBe('2024-01-31');
      expect(result!.totalMetrics.api_requests).toBe(0);
    });

    it('should aggregate data from multiple days correctly', async () => {
      const mockRows = [
        {
          date: '2024-01-01',
          aggregated_by_user: mockUserMetrics,
          aggregated_by_model: mockModelMetrics,
          aggregated_by_provider: mockProviderMetrics,
          total_metrics: mockDayMetrics,
          raw_data: { day: 1 },
        },
        {
          date: '2024-01-02',
          aggregated_by_user: mockUserMetrics,
          aggregated_by_model: mockModelMetrics,
          aggregated_by_provider: mockProviderMetrics,
          total_metrics: mockDayMetrics,
          raw_data: { day: 2 },
        },
      ];

      mockFastify.pg!.query = vi.fn().mockResolvedValue({ rows: mockRows });

      const result = await service.getDateRangeData('2024-01-01', '2024-01-02');

      expect(result).toBeDefined();
      expect(result!.totalMetrics.api_requests).toBe(2000); // 1000 * 2
      expect(result!.totalMetrics.total_tokens).toBe(100000); // 50000 * 2
      expect(result!.totalMetrics.spend).toBe(25.0); // 12.5 * 2
    });

    it('should validate date range parameters', async () => {
      // Test invalid start date
      await expect(service.getDateRangeData('invalid', '2024-01-31')).rejects.toThrow();

      // Test invalid end date
      await expect(service.getDateRangeData('2024-01-01', 'invalid')).rejects.toThrow();

      // Test start date after end date
      await expect(service.getDateRangeData('2024-01-31', '2024-01-01')).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Query failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(service.getDateRangeData('2024-01-01', '2024-01-31')).rejects.toThrow();

      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: dbError }),
        'Failed to get date range data',
      );
    });
  });

  describe('invalidateTodayCache', () => {
    it('should invalidate current day cache successfully', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.pg!.query = mockQuery;

      await service.invalidateTodayCache();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE daily_usage_cache'),
        expect.any(Array),
      );

      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        expect.objectContaining({ date: expect.any(String) }),
        'Invalidated current day cache',
      );
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Update failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(service.invalidateTodayCache()).rejects.toThrow();
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: dbError }),
        'Failed to invalidate today cache',
      );
    });
  });

  describe('cleanupOldCache', () => {
    it('should delete old cache entries successfully', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 10 });
      mockFastify.pg!.query = mockQuery;

      const deletedCount = await service.cleanupOldCache(365);

      expect(deletedCount).toBe(10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM daily_usage_cache'),
        expect.any(Array),
      );

      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        expect.objectContaining({ deletedCount: 10 }),
        'Cleaned up old cache data',
      );
    });

    it('should use default retention period of 365 days', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 5 });
      mockFastify.pg!.query = mockQuery;

      await service.cleanupOldCache();

      expect(mockQuery).toHaveBeenCalled();
    });

    it('should validate retention days parameter', async () => {
      await expect(service.cleanupOldCache(0)).rejects.toThrow();
      await expect(service.cleanupOldCache(-10)).rejects.toThrow();
    });

    it('should handle case when no rows are deleted', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 0 });
      mockFastify.pg!.query = mockQuery;

      const deletedCount = await service.cleanupOldCache(365);

      expect(deletedCount).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Delete failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(service.cleanupOldCache(365)).rejects.toThrow();
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: dbError }),
        'Failed to cleanup old cache',
      );
    });
  });

  describe('aggregation logic', () => {
    it('should correctly aggregate user metrics across multiple days', async () => {
      const day1Users = {
        'user-1': {
          user_id: 'user-1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'user',
          api_requests: 100,
          total_tokens: 5000,
          prompt_tokens: 2500,
          completion_tokens: 2500,
          spend: 1.25,
          api_keys: ['key-1'],
        },
      };

      const day2Users = {
        'user-1': {
          user_id: 'user-1',
          username: 'user1',
          email: 'user1@test.com',
          role: 'user',
          api_requests: 150,
          total_tokens: 7500,
          prompt_tokens: 3750,
          completion_tokens: 3750,
          spend: 1.88,
          api_keys: ['key-2'],
        },
      };

      const mockRows = [
        {
          date: '2024-01-01',
          aggregated_by_user: day1Users,
          aggregated_by_model: {},
          aggregated_by_provider: {},
          total_metrics: mockDayMetrics,
          raw_data: {},
        },
        {
          date: '2024-01-02',
          aggregated_by_user: day2Users,
          aggregated_by_model: {},
          aggregated_by_provider: {},
          total_metrics: mockDayMetrics,
          raw_data: {},
        },
      ];

      mockFastify.pg!.query = vi.fn().mockResolvedValue({ rows: mockRows });

      const result = await service.getDateRangeData('2024-01-01', '2024-01-02');

      expect(result).toBeDefined();
      expect(result!.byUser['user-1'].api_requests).toBe(250); // 100 + 150
      expect(result!.byUser['user-1'].total_tokens).toBe(12500); // 5000 + 7500
      // api_keys field may not be present in all aggregation implementations
    });

    it('should correctly aggregate model metrics across multiple days', async () => {
      const day1Models = {
        'gpt-4': {
          model_id: 'gpt-4',
          model_name: 'GPT-4',
          api_requests: 100,
          total_tokens: 5000,
          prompt_tokens: 2500,
          completion_tokens: 2500,
          spend: 1.25,
        },
      };

      const day2Models = {
        'gpt-4': {
          model_id: 'gpt-4',
          model_name: 'GPT-4',
          api_requests: 150,
          total_tokens: 7500,
          prompt_tokens: 3750,
          completion_tokens: 3750,
          spend: 1.88,
        },
      };

      const mockRows = [
        {
          date: '2024-01-01',
          aggregated_by_user: {},
          aggregated_by_model: day1Models,
          aggregated_by_provider: {},
          total_metrics: mockDayMetrics,
          raw_data: {},
        },
        {
          date: '2024-01-02',
          aggregated_by_user: {},
          aggregated_by_model: day2Models,
          aggregated_by_provider: {},
          total_metrics: mockDayMetrics,
          raw_data: {},
        },
      ];

      mockFastify.pg!.query = vi.fn().mockResolvedValue({ rows: mockRows });

      const result = await service.getDateRangeData('2024-01-01', '2024-01-02');

      expect(result).toBeDefined();
      expect(result!.byModel['gpt-4'].api_requests).toBe(250);
      expect(result!.byModel['gpt-4'].total_tokens).toBe(12500);
      expect(result!.byModel['gpt-4'].spend).toBeCloseTo(3.13, 2);
    });
  });
});

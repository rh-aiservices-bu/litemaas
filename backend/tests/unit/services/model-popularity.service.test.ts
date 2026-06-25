import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelPopularityService } from '../../../src/services/model-popularity.service';
import type { FastifyInstance } from 'fastify';

function modelEntry(apiRequests: number) {
  return {
    metrics: {
      api_requests: apiRequests,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      spend: 0,
      successful_requests: 0,
      failed_requests: 0,
    },
    users: {},
  };
}

function modelRows(...ids: string[]) {
  return { rows: ids.map((id) => ({ id })) };
}

function cacheRows(
  ...entries: Array<Record<string, ReturnType<typeof modelEntry>> | null>
) {
  return {
    rows: entries.map((e) => ({ aggregated_by_model: e })),
  };
}

describe('ModelPopularityService', () => {
  let service: ModelPopularityService;
  let mockFastify: any;

  beforeEach(() => {
    mockFastify = {
      pg: {
        query: vi.fn(),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    service = new ModelPopularityService(mockFastify as FastifyInstance);
  });

  describe('getPopularityRatings', () => {
    it('should return empty map when no usage data exists', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-a'))
        .mockResolvedValueOnce(cacheRows());

      const result = await service.getPopularityRatings();

      expect(result).toEqual({});
    });

    it('should return empty map when all models have zero requests', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-a', 'model-b'))
        .mockResolvedValueOnce(
          cacheRows({
            'model-a': modelEntry(0),
            'model-b': modelEntry(0),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result).toEqual({});
    });

    it('should give 5 stars to the only model with usage', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-a'))
        .mockResolvedValueOnce(
          cacheRows({
            'model-a': modelEntry(100),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result).toEqual({ 'model-a': 5 });
    });

    it('should give 3 stars to all models with equal usage', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-a', 'model-b', 'model-c'))
        .mockResolvedValueOnce(
          cacheRows({
            'model-a': modelEntry(500),
            'model-b': modelEntry(500),
            'model-c': modelEntry(500),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result).toEqual({ 'model-a': 3, 'model-b': 3, 'model-c': 3 });
    });

    it('should apply logarithmic scaling for large disparity', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-low', 'model-high'))
        .mockResolvedValueOnce(
          cacheRows({
            'model-low': modelEntry(1),
            'model-high': modelEntry(1000000),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result['model-low']).toBe(1);
      expect(result['model-high']).toBe(5);
    });

    it('should produce a spread of ratings with varied usage', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(
          modelRows('model-a', 'model-b', 'model-c', 'model-d', 'model-e'),
        )
        .mockResolvedValueOnce(
          cacheRows({
            'model-a': modelEntry(10),
            'model-b': modelEntry(100),
            'model-c': modelEntry(1000),
            'model-d': modelEntry(10000),
            'model-e': modelEntry(100000),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result['model-a']).toBe(1);
      expect(result['model-e']).toBe(5);
      for (const rating of Object.values(result)) {
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(5);
      }
    });

    it('should aggregate requests across multiple days', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-a', 'model-b'))
        .mockResolvedValueOnce(
          cacheRows(
            {
              'model-a': modelEntry(50),
              'model-b': modelEntry(100),
            },
            {
              'model-a': modelEntry(50),
              'model-b': modelEntry(100),
            },
          ),
        );

      const result = await service.getPopularityRatings();

      expect(result['model-b']).toBeGreaterThanOrEqual(result['model-a']);
    });

    it('should exclude zero-usage models from ratings', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-used', 'model-unused'))
        .mockResolvedValueOnce(
          cacheRows({
            'model-used': modelEntry(500),
            'model-unused': modelEntry(0),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result['model-used']).toBe(5);
      expect(result['model-unused']).toBeUndefined();
    });

    it('should handle null aggregated_by_model gracefully', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-a'))
        .mockResolvedValueOnce(cacheRows(null));

      const result = await service.getPopularityRatings();

      expect(result).toEqual({});
    });

    it('should use cached data on subsequent calls', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-a'))
        .mockResolvedValueOnce(
          cacheRows({
            'model-a': modelEntry(100),
          }),
        );

      const result1 = await service.getPopularityRatings();
      const result2 = await service.getPopularityRatings();

      expect(result1).toEqual(result2);
      expect(mockFastify.pg.query).toHaveBeenCalledTimes(2);
    });

    it('should refresh cache after invalidation', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('model-a'))
        .mockResolvedValueOnce(
          cacheRows({
            'model-a': modelEntry(100),
          }),
        )
        .mockResolvedValueOnce(modelRows('model-a'))
        .mockResolvedValueOnce(
          cacheRows({
            'model-a': modelEntry(100),
          }),
        );

      await service.getPopularityRatings();
      service.invalidateCache();
      await service.getPopularityRatings();

      expect(mockFastify.pg.query).toHaveBeenCalledTimes(4);
    });

    it('should produce ratings between 1 and 5 inclusive', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('a', 'b', 'c', 'd', 'e', 'f', 'g'))
        .mockResolvedValueOnce(
          cacheRows({
            a: modelEntry(1),
            b: modelEntry(5),
            c: modelEntry(25),
            d: modelEntry(125),
            e: modelEntry(625),
            f: modelEntry(3125),
            g: modelEntry(15625),
          }),
        );

      const result = await service.getPopularityRatings();

      for (const [, rating] of Object.entries(result)) {
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(5);
        expect(Number.isInteger(rating)).toBe(true);
      }
    });

    it('should resolve cache keys with provider prefix to model IDs', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('Qwen3.6-35B-A3B', 'DeepSeek-R1'))
        .mockResolvedValueOnce(
          cacheRows({
            'openai/Qwen3.6-35B-A3B': modelEntry(100),
            'openai/deepseek-r1': modelEntry(50),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result['Qwen3.6-35B-A3B']).toBeDefined();
      expect(result['DeepSeek-R1']).toBeDefined();
      expect(result['openai/Qwen3.6-35B-A3B']).toBeUndefined();
    });

    it('should aggregate counts across prefixed and unprefixed keys for same model', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('MyModel'))
        .mockResolvedValueOnce(
          cacheRows({
            MyModel: modelEntry(100),
            'openai/MyModel': modelEntry(50),
            'openai/mymodel': modelEntry(25),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result['MyModel']).toBe(5);
      expect(Object.keys(result)).toHaveLength(1);
    });

    it('should skip cache keys that do not match any known model', async () => {
      mockFastify.pg.query
        .mockResolvedValueOnce(modelRows('RealModel'))
        .mockResolvedValueOnce(
          cacheRows({
            RealModel: modelEntry(100),
            'openai/none': modelEntry(50),
            'openai/your-model-name': modelEntry(30),
          }),
        );

      const result = await service.getPopularityRatings();

      expect(result['RealModel']).toBe(5);
      expect(Object.keys(result)).toHaveLength(1);
    });
  });
});

// backend/tests/unit/services/admin-usage/admin-usage-enrichment.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminUsageEnrichmentService } from '../../../../src/services/admin-usage/admin-usage-enrichment.service.js';
import type { FastifyInstance } from 'fastify';

describe('AdminUsageEnrichmentService', () => {
  let enrichmentService: AdminUsageEnrichmentService;
  let mockFastify: Partial<FastifyInstance>;

  beforeEach(() => {
    mockFastify = {
      log: {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
      } as any,
      pg: {
        query: vi.fn(),
      } as any,
    };
    enrichmentService = new AdminUsageEnrichmentService(mockFastify as FastifyInstance);
  });

  describe('enrichWithUserData', () => {
    it('should enrich usage data with user information', async () => {
      const apiKeyUsage = new Map([
        [
          'key1',
          {
            totalRequests: 100,
            totalTokens: 5000,
            promptTokens: 3000,
            completionTokens: 2000,
            totalCost: 1.25,
          },
        ],
      ]);

      // Mock API key mapping query
      (mockFastify.pg!.query as any).mockResolvedValueOnce({
        rows: [
          {
            key_hash: 'key1',
            user_id: 'user-1',
            name: 'My API Key',
          },
        ],
      });

      // Mock user query
      (mockFastify.pg!.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            username: 'john.doe',
            email: 'john@example.com',
            role: 'user',
          },
        ],
      });

      const enriched = await enrichmentService.enrichWithUserData(apiKeyUsage);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].userId).toBe('user-1');
      expect(enriched[0].username).toBe('john.doe');
      expect(enriched[0].email).toBe('john@example.com');
      expect(enriched[0].apiKeyAlias).toBe('My API Key');
      expect(enriched[0].totalRequests).toBe(100);
    });

    it('should handle unknown users gracefully', async () => {
      const apiKeyUsage = new Map([
        [
          'unknown-key',
          {
            totalRequests: 10,
            totalTokens: 500,
            promptTokens: 300,
            completionTokens: 200,
            totalCost: 0.125,
          },
        ],
      ]);

      // Mock empty API key mapping (key not found)
      (mockFastify.pg!.query as any).mockResolvedValueOnce({ rows: [] });

      // Mock empty user query
      (mockFastify.pg!.query as any).mockResolvedValueOnce({ rows: [] });

      const enriched = await enrichmentService.enrichWithUserData(apiKeyUsage);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].userId).toBe('00000000-0000-0000-0000-000000000000');
      expect(enriched[0].username).toBe('Unknown User');
      expect(enriched[0].apiKeyAlias).toBe('Unknown Key');
    });

    it('should use single query for multiple API keys (avoid N+1)', async () => {
      const apiKeyUsage = new Map([
        [
          'key1',
          {
            totalRequests: 100,
            totalTokens: 5000,
            promptTokens: 3000,
            completionTokens: 2000,
            totalCost: 1.25,
          },
        ],
        [
          'key2',
          {
            totalRequests: 50,
            totalTokens: 2500,
            promptTokens: 1500,
            completionTokens: 1000,
            totalCost: 0.625,
          },
        ],
        [
          'key3',
          {
            totalRequests: 25,
            totalTokens: 1250,
            promptTokens: 750,
            completionTokens: 500,
            totalCost: 0.3125,
          },
        ],
      ]);

      // Mock API key mapping (all in single query)
      (mockFastify.pg!.query as any).mockResolvedValueOnce({
        rows: [
          { key_hash: 'key1', user_id: 'user-1', name: 'Key 1' },
          { key_hash: 'key2', user_id: 'user-1', name: 'Key 2' },
          { key_hash: 'key3', user_id: 'user-2', name: 'Key 3' },
        ],
      });

      // Mock user query (all in single query)
      (mockFastify.pg!.query as any).mockResolvedValueOnce({
        rows: [
          { id: 'user-1', username: 'john.doe', email: 'john@example.com', role: 'user' },
          { id: 'user-2', username: 'jane.smith', email: 'jane@example.com', role: 'admin' },
        ],
      });

      await enrichmentService.enrichWithUserData(apiKeyUsage);

      // Should have called pg.query exactly twice (not 6 times for N+1)
      expect(mockFastify.pg!.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('aggregateByUser', () => {
    it('should combine usage from multiple API keys for same user', () => {
      const enrichedData = [
        {
          apiKeyHash: 'key1',
          apiKeyAlias: 'Key 1',
          userId: 'user-1',
          username: 'john.doe',
          email: 'john@example.com',
          role: 'user',
          totalRequests: 100,
          totalTokens: 5000,
          promptTokens: 3000,
          completionTokens: 2000,
          totalCost: 1.25,
        },
        {
          apiKeyHash: 'key2',
          apiKeyAlias: 'Key 2',
          userId: 'user-1',
          username: 'john.doe',
          email: 'john@example.com',
          role: 'user',
          totalRequests: 50,
          totalTokens: 2500,
          promptTokens: 1500,
          completionTokens: 1000,
          totalCost: 0.625,
        },
      ];

      const aggregated = enrichmentService.aggregateByUser(enrichedData);

      expect(aggregated.size).toBe(1);
      const userAggregate = aggregated.get('user-1');
      expect(userAggregate?.totalRequests).toBe(150);
      expect(userAggregate?.totalTokens).toBe(7500);
      expect(userAggregate?.totalCost).toBe(1.875);
      expect(userAggregate?.apiKeyCount).toBe(2);
    });
  });
});

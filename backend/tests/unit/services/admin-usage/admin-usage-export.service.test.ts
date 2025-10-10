// backend/tests/unit/services/admin-usage/admin-usage-export.service.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../../helpers/test-app';
import { AdminUsageExportService } from '../../../../src/services/admin-usage/admin-usage-export.service';
import type {
  UserBreakdown,
  ModelBreakdown,
  ProviderBreakdown,
  AdminUsageFilters,
} from '../../../../src/types/admin-usage.types';

describe('AdminUsageExportService', () => {
  let fastify: any;
  let exportService: AdminUsageExportService;
  let filters: AdminUsageFilters;

  beforeEach(async () => {
    fastify = await createTestApp();
    exportService = new AdminUsageExportService(fastify);
    filters = {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };
  });

  // ============================================================================
  // CSV Export Tests
  // ============================================================================

  describe('exportUserBreakdownToCSV', () => {
    it('should generate valid CSV for user breakdown', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'john.doe',
          email: 'john@example.com',
          role: 'user',
          metrics: {
            requests: 100,
            tokens: { total: 5000, prompt: 3000, completion: 2000 },
            cost: 1.25,
            models: [],
            apiKeys: [],
            lastActive: null,
          },
        },
        {
          userId: 'user-2',
          username: 'jane.smith',
          email: 'jane@example.com',
          role: 'user',
          metrics: {
            requests: 50,
            tokens: { total: 2500, prompt: 1500, completion: 1000 },
            cost: 0.625,
            models: [],
            apiKeys: [],
            lastActive: null,
          },
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      expect(csv).toContain('User ID,Username,Email');
      expect(csv).toContain('user-1,john.doe,john@example.com,100,5000,3000,2000,1.2500');
      expect(csv).toContain('user-2,jane.smith,jane@example.com,50,2500,1500,1000,0.6250');
    });

    it('should handle empty email fields', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'john.doe',
          email: null as any,
          role: 'user',
          metrics: {
            requests: 100,
            tokens: { total: 5000, prompt: 3000, completion: 2000 },
            cost: 1.25,
            models: [],
            apiKeys: [],
            lastActive: null,
          },
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      // Email field should be empty but not missing
      expect(csv).toContain('user-1,john.doe,,100');
    });

    it('should escape CSV fields with commas', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'doe, john', // Contains comma
          email: 'john@example.com',
          role: 'user',
          metrics: {
            requests: 100,
            tokens: { total: 5000, prompt: 3000, completion: 2000 },
            cost: 1.25,
            models: [],
            apiKeys: [],
            lastActive: null,
          },
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      // Username should be wrapped in quotes
      expect(csv).toContain('"doe, john"');
    });

    it('should escape CSV fields with double quotes', async () => {
      const breakdown: UserBreakdown[] = [
        {
          userId: 'user-1',
          username: 'john "the dev" doe', // Contains quotes
          email: 'john@example.com',
          role: 'user',
          metrics: {
            requests: 100,
            tokens: { total: 5000, prompt: 3000, completion: 2000 },
            cost: 1.25,
            models: [],
            apiKeys: [],
            lastActive: null,
          },
        },
      ];

      const csv = await exportService.exportUserBreakdownToCSV(breakdown, filters);

      // Quotes should be doubled and field wrapped in quotes
      expect(csv).toContain('"john ""the dev"" doe"');
    });
  });

  describe('exportModelBreakdownToCSV', () => {
    it('should generate valid CSV for model breakdown', async () => {
      const breakdown: ModelBreakdown[] = [
        {
          modelId: 'gpt-4',
          modelName: 'gpt-4',
          provider: 'openai',
          metrics: {
            requests: 100,
            tokens: { total: 5000, prompt: 3000, completion: 2000 },
            cost: 1.25,
            users: 5,
            successRate: 100,
          },
          pricing: {
            promptCostPerToken: 0.00001,
            completionCostPerToken: 0.00002,
            currency: 'USD',
          },
          topUsers: [],
        },
      ];

      const csv = await exportService.exportModelBreakdownToCSV(breakdown, filters);

      expect(csv).toContain('Model,Provider,Total Requests');
      expect(csv).toContain('gpt-4,openai,100,5000,3000,2000,1.2500,5');
    });
  });

  describe('exportProviderBreakdownToCSV', () => {
    it('should generate valid CSV for provider breakdown', async () => {
      const breakdown: ProviderBreakdown[] = [
        {
          provider: 'openai',
          metrics: {
            requests: 100,
            tokens: { total: 5000, prompt: 3000, completion: 2000 },
            cost: 1.25,
            models: 3,
            users: 5,
            successRate: 100,
            averageLatency: 0,
          },
          topModels: [],
        },
      ];

      const csv = await exportService.exportProviderBreakdownToCSV(breakdown, filters);

      expect(csv).toContain('Provider,Total Requests');
      expect(csv).toContain('openai,100,5000,3000,2000,1.2500,5,3');
    });
  });

  // ============================================================================
  // JSON Export Tests
  // ============================================================================

  describe('exportToJSON', () => {
    it('should generate JSON with metadata', async () => {
      const data = [{ test: 'data' }];
      const json = await exportService.exportToJSON(data, filters, 'user');
      const parsed = JSON.parse(json);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.exportedAt).toBeDefined();
      expect(parsed.metadata.breakdownType).toBe('user');
      expect(parsed.metadata.filters).toEqual(filters);
      expect(parsed.metadata.recordCount).toBe(1);
      expect(parsed.data).toEqual(data);
    });

    it('should include all filter fields in metadata', async () => {
      const fullFilters: AdminUsageFilters = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        userIds: ['user-1', 'user-2'],
        modelIds: ['gpt-4'],
        providerIds: ['openai'],
        apiKeyIds: ['key-1'],
      };

      const json = await exportService.exportToJSON([{ test: 'data' }], fullFilters, 'user');
      const parsed = JSON.parse(json);

      expect(parsed.metadata.filters.userIds).toEqual(['user-1', 'user-2']);
      expect(parsed.metadata.filters.modelIds).toEqual(['gpt-4']);
      expect(parsed.metadata.filters.providerIds).toEqual(['openai']);
      expect(parsed.metadata.filters.apiKeyIds).toEqual(['key-1']);
    });

    it('should format JSON with proper indentation', async () => {
      const json = await exportService.exportToJSON({ test: 'data' }, filters);

      // Should be pretty-printed with 2-space indentation
      expect(json).toContain('  "metadata"');
      expect(json).toContain('    "exportedAt"');
    });
  });

  // ============================================================================
  // Helper Method Tests
  // ============================================================================

  describe('generateExportFilename', () => {
    it('should generate filename with timestamp for CSV', () => {
      const filename = exportService.generateExportFilename('user', 'csv');
      expect(filename).toMatch(/^admin-usage-user-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
    });

    it('should generate filename with timestamp for JSON', () => {
      const filename = exportService.generateExportFilename('model', 'json');
      expect(filename).toMatch(/^admin-usage-model-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('getMimeType', () => {
    it('should return CSV MIME type', () => {
      expect(exportService.getMimeType('csv')).toBe('text/csv');
    });

    it('should return JSON MIME type', () => {
      expect(exportService.getMimeType('json')).toBe('application/json');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { usageService, type UsageFilters } from '../../services/usage.service';

// Mock fetch for export functionality since it's not using apiClient
const mockFetch = vi.fn();

describe('UsageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage properly
    const localStorageMock = {
      getItem: vi.fn().mockImplementation((key) => {
        if (key === 'access_token') return 'mock-token';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorageMock);

    // Set up global fetch mock
    global.fetch = mockFetch;
  });

  describe('getUsageMetrics', () => {
    it('should fetch usage metrics without filters', async () => {
      const result = await usageService.getUsageMetrics();

      expect(result).toHaveProperty('totalRequests', 125430);
      expect(result).toHaveProperty('totalTokens', 8950000);
      expect(result).toHaveProperty('totalCost', 1247.5);
      expect(result).toHaveProperty('averageResponseTime', 1.2);
      expect(result).toHaveProperty('successRate', 99.2);
      expect(result).toHaveProperty('activeModels', 8);
      expect(result).toHaveProperty('topModels');
      expect(result).toHaveProperty('dailyUsage');
      expect(result).toHaveProperty('hourlyUsage');
      expect(result).toHaveProperty('errorBreakdown');
    });

    it('should fetch usage metrics with all filters', async () => {
      const filters: UsageFilters = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        modelId: 'gpt-4',
        apiKeyId: 'key-1',
      };

      const result = await usageService.getUsageMetrics(filters);

      // Mock returns different data for specific filters
      expect(result.totalRequests).toBe(25000); // Filtered for key-1
      expect(result.totalTokens).toBe(2000000);
      expect(result.totalCost).toBe(400.0);
    });

    it('should fetch usage metrics with startDate and endDate filters', async () => {
      const filters: UsageFilters = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      };

      const result = await usageService.getUsageMetrics(filters);
      expect(result).toHaveProperty('totalRequests');
      expect(result).toHaveProperty('totalTokens');
    });

    it('should fetch usage metrics with modelId filter', async () => {
      const filters: UsageFilters = {
        modelId: 'gpt-4',
      };

      const result = await usageService.getUsageMetrics(filters);

      // Mock returns specific data for gpt-4
      expect(result.totalRequests).toBe(50000);
      expect(result.totalTokens).toBe(4000000);
      expect(result.totalCost).toBe(800.0);
    });

    it('should fetch usage metrics with apiKeyId filter', async () => {
      const filters: UsageFilters = {
        apiKeyId: 'key-1',
      };

      const result = await usageService.getUsageMetrics(filters);

      // Mock returns specific data for key-1
      expect(result.totalRequests).toBe(25000);
      expect(result.totalTokens).toBe(2000000);
      expect(result.totalCost).toBe(400.0);
    });

    it('should handle empty filters object', async () => {
      const filters: UsageFilters = {};

      const result = await usageService.getUsageMetrics(filters);
      expect(result).toHaveProperty('totalRequests');
      expect(result).toHaveProperty('totalTokens');
    });

    it('should construct URL parameters correctly', async () => {
      const filters: UsageFilters = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        modelId: 'gpt-4',
        apiKeyId: 'key-1',
      };

      // Mock the handler to capture the request URL
      let requestUrl: string = '';
      server.use(
        http.get('/api/v1/usage/metrics', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            totalRequests: 100,
            totalTokens: 1000,
            totalCost: 10.0,
            averageResponseTime: 1.0,
            successRate: 95.0,
            activeModels: 1,
            topModels: [],
            dailyUsage: [],
            hourlyUsage: [],
            errorBreakdown: [],
          });
        }),
      );

      await usageService.getUsageMetrics(filters);

      const url = new URL(requestUrl);
      expect(url.searchParams.get('startDate')).toBe('2024-06-01');
      expect(url.searchParams.get('endDate')).toBe('2024-06-30');
      expect(url.searchParams.get('modelId')).toBe('gpt-4');
      expect(url.searchParams.get('apiKeyId')).toBe('key-1');
    });

    it('should handle API errors', async () => {
      server.use(
        http.get('/api/v1/usage/metrics', () => {
          return HttpResponse.json(
            { message: 'Internal server error', statusCode: 500 },
            { status: 500 },
          );
        }),
      );

      await expect(usageService.getUsageMetrics()).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      server.use(
        http.get('/api/v1/usage/metrics', () => {
          return HttpResponse.error();
        }),
      );

      await expect(usageService.getUsageMetrics()).rejects.toThrow();
    });

    it('should validate response structure', async () => {
      const result = await usageService.getUsageMetrics();

      expect(result.topModels).toBeInstanceOf(Array);
      expect(result.dailyUsage).toBeInstanceOf(Array);
      expect(result.hourlyUsage).toBeInstanceOf(Array);
      expect(result.errorBreakdown).toBeInstanceOf(Array);

      // Validate topModels structure
      if (result.topModels.length > 0) {
        const topModel = result.topModels[0];
        expect(topModel).toHaveProperty('name');
        expect(topModel).toHaveProperty('requests');
        expect(topModel).toHaveProperty('tokens');
        expect(topModel).toHaveProperty('cost');
      }

      // Validate dailyUsage structure
      if (result.dailyUsage.length > 0) {
        const dailyUsage = result.dailyUsage[0];
        expect(dailyUsage).toHaveProperty('date');
        expect(dailyUsage).toHaveProperty('requests');
        expect(dailyUsage).toHaveProperty('tokens');
        expect(dailyUsage).toHaveProperty('cost');
      }

      // Validate hourlyUsage structure
      if (result.hourlyUsage.length > 0) {
        const hourlyUsage = result.hourlyUsage[0];
        expect(hourlyUsage).toHaveProperty('hour');
        expect(hourlyUsage).toHaveProperty('requests');
      }

      // Validate errorBreakdown structure
      if (result.errorBreakdown.length > 0) {
        const errorBreakdown = result.errorBreakdown[0];
        expect(errorBreakdown).toHaveProperty('type');
        expect(errorBreakdown).toHaveProperty('count');
        expect(errorBreakdown).toHaveProperty('percentage');
      }
    });
  });

  describe('exportUsageData', () => {
    beforeEach(() => {
      mockFetch.mockClear();
      // Reset MSW handlers since fetch bypasses them
    });

    it('should export usage data as CSV by default', async () => {
      const csvBlob = new Blob(['Date,Requests,Tokens,Cost\n2024-06-01,5000,400000,50.0'], {
        type: 'text/csv',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      const result = await usageService.exportUsageData();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/usage/export?format=csv', {
        headers: {
          Authorization: 'Bearer mock-token',
        },
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export usage data as JSON when specified', async () => {
      const jsonBlob = new Blob([JSON.stringify([{ date: '2024-06-01', requests: 5000 }])], {
        type: 'application/json',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(jsonBlob),
      });

      const result = await usageService.exportUsageData(undefined, 'json');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/usage/export?format=json',
        expect.any(Object),
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export usage data with filters', async () => {
      const csvBlob = new Blob(['filtered data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      const filters: UsageFilters = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        modelId: 'gpt-4',
        apiKeyId: 'key-1',
      };

      const result = await usageService.exportUsageData(filters, 'csv');

      const expectedUrl =
        '/api/v1/usage/export?format=csv&startDate=2024-06-01&endDate=2024-06-30&modelId=gpt-4&apiKeyId=key-1';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, {
        headers: {
          Authorization: 'Bearer mock-token',
        },
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('should construct URL parameters correctly with partial filters', async () => {
      const csvBlob = new Blob(['partial filtered data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      const filters: UsageFilters = {
        startDate: '2024-06-01',
        modelId: 'gpt-4',
      };

      await usageService.exportUsageData(filters);

      const expectedUrl = '/api/v1/usage/export?format=csv&startDate=2024-06-01&modelId=gpt-4';
      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });

    it('should handle empty filters object', async () => {
      const csvBlob = new Blob(['all data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      const filters: UsageFilters = {};

      await usageService.exportUsageData(filters);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/usage/export?format=csv', expect.any(Object));
    });

    it('should handle authentication from localStorage', async () => {
      // Update the localStorage mock for this specific test
      const localStorageMock = {
        getItem: vi.fn().mockImplementation((key) => {
          if (key === 'access_token') return 'specific-token-123';
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      vi.stubGlobal('localStorage', localStorageMock);

      const csvBlob = new Blob(['authenticated data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      await usageService.exportUsageData();

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        headers: {
          Authorization: 'Bearer specific-token-123',
        },
      });
    });

    it('should handle missing authentication token', async () => {
      // Update the localStorage mock to return null
      const localStorageMock = {
        getItem: vi.fn().mockImplementation(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      vi.stubGlobal('localStorage', localStorageMock);

      const csvBlob = new Blob(['unauthenticated data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      await usageService.exportUsageData();

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        headers: {
          Authorization: 'Bearer null',
        },
      });
    });

    it('should handle API errors during export', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(usageService.exportUsageData()).rejects.toThrow('Failed to export usage data');
    });

    it('should handle network errors during export', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(usageService.exportUsageData()).rejects.toThrow('Network error');
    });

    it('should handle different HTTP error status codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(usageService.exportUsageData()).rejects.toThrow('Failed to export usage data');
    });

    it('should handle blob conversion errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.reject(new Error('Blob conversion failed')),
      });

      await expect(usageService.exportUsageData()).rejects.toThrow('Blob conversion failed');
    });

    it('should validate format parameter', async () => {
      const csvBlob = new Blob(['csv data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      await usageService.exportUsageData(undefined, 'csv');
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/usage/export?format=csv', expect.any(Object));

      mockFetch.mockClear();
      const jsonBlob = new Blob(['json data'], { type: 'application/json' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(jsonBlob),
      });

      await usageService.exportUsageData(undefined, 'json');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/usage/export?format=json',
        expect.any(Object),
      );
    });
  });

  describe('service instance', () => {
    it('should be a singleton instance', () => {
      expect(usageService).toBeDefined();
      expect(typeof usageService.getUsageMetrics).toBe('function');
      expect(typeof usageService.exportUsageData).toBe('function');
    });

    it('should maintain method context', async () => {
      const { getUsageMetrics } = usageService;

      const result = await getUsageMetrics();
      expect(result).toHaveProperty('totalRequests');
    });
  });

  describe('URL parameter handling', () => {
    it('should handle undefined filter values correctly', async () => {
      const filters: UsageFilters = {
        startDate: '2024-06-01',
        endDate: undefined,
        modelId: undefined,
        apiKeyId: 'key-1',
      };

      let requestUrl: string = '';
      server.use(
        http.get('/api/v1/usage/metrics', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            totalRequests: 100,
            totalTokens: 1000,
            totalCost: 10.0,
            averageResponseTime: 1.0,
            successRate: 95.0,
            activeModels: 1,
            topModels: [],
            dailyUsage: [],
            hourlyUsage: [],
            errorBreakdown: [],
          });
        }),
      );

      await usageService.getUsageMetrics(filters);

      const url = new URL(requestUrl);
      expect(url.searchParams.get('startDate')).toBe('2024-06-01');
      expect(url.searchParams.get('endDate')).toBeNull();
      expect(url.searchParams.get('modelId')).toBeNull();
      expect(url.searchParams.get('apiKeyId')).toBe('key-1');
    });

    it('should handle empty string filter values', async () => {
      const filters: UsageFilters = {
        startDate: '',
        endDate: '2024-06-30',
        modelId: '',
        apiKeyId: 'key-1',
      };

      let requestUrl: string = '';
      server.use(
        http.get('/api/v1/usage/metrics', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            totalRequests: 100,
            totalTokens: 1000,
            totalCost: 10.0,
            averageResponseTime: 1.0,
            successRate: 95.0,
            activeModels: 1,
            topModels: [],
            dailyUsage: [],
            hourlyUsage: [],
            errorBreakdown: [],
          });
        }),
      );

      await usageService.getUsageMetrics(filters);

      const url = new URL(requestUrl);
      // Empty strings are not added as parameters (correct behavior)
      expect(url.searchParams.get('startDate')).toBeNull();
      expect(url.searchParams.get('endDate')).toBe('2024-06-30');
      expect(url.searchParams.get('modelId')).toBeNull();
      expect(url.searchParams.get('apiKeyId')).toBe('key-1');
    });
  });
});

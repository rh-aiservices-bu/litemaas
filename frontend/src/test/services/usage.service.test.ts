import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type UserUsageFilters, usageService } from '../../services/usage.service';

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
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/usage/export');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-token',
      });
      const body = JSON.parse(options.body);
      expect(body.format).toBe('csv');
      expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(body.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/usage/export');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body).format).toBe('json');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should export usage data with filters', async () => {
      const csvBlob = new Blob(['filtered data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      const filters: UserUsageFilters = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        modelIds: ['gpt-4'],
        apiKeyIds: ['key-1'],
      };

      const result = await usageService.exportUsageData(filters, 'csv');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/usage/export');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        format: 'csv',
        modelIds: ['gpt-4'],
        apiKeyIds: ['key-1'],
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('should send modelIds in JSON body', async () => {
      const csvBlob = new Blob(['partial filtered data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      const filters: UserUsageFilters = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        modelIds: ['gpt-4'],
      };

      await usageService.exportUsageData(filters);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/usage/export');
      const body = JSON.parse(options.body);
      expect(body.modelIds).toEqual(['gpt-4']);
    });

    it('should use default date range when no filters provided', async () => {
      const csvBlob = new Blob(['all data'], { type: 'text/csv' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(csvBlob),
      });

      await usageService.exportUsageData();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      // Should use default date range (last 30 days)
      expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(body.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer specific-token-123');
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

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer null');
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
      const [csvUrl, csvOptions] = mockFetch.mock.calls[0];
      expect(csvUrl).toBe('/api/v1/usage/export');
      expect(JSON.parse(csvOptions.body).format).toBe('csv');

      mockFetch.mockClear();
      const jsonBlob = new Blob(['json data'], { type: 'application/json' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(jsonBlob),
      });

      await usageService.exportUsageData(undefined, 'json');
      const [jsonUrl, jsonOptions] = mockFetch.mock.calls[0];
      expect(jsonUrl).toBe('/api/v1/usage/export');
      expect(JSON.parse(jsonOptions.body).format).toBe('json');
    });
  });

  describe('service instance', () => {
    it('should be a singleton instance', () => {
      expect(usageService).toBeDefined();
      expect(typeof usageService.exportUsageData).toBe('function');
      expect(typeof usageService.getAnalytics).toBe('function');
      expect(typeof usageService.getBudgetInfo).toBe('function');
    });
  });
});

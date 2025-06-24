import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiteLLMService } from '../../../src/services/litellm.service';
import type { FastifyInstance } from 'fastify';
import { mockModels, mockCompletion } from '../../setup';

// Mock fetch for HTTP requests
global.fetch = vi.fn();

describe('LiteLLMService', () => {
  let service: LiteLLMService;
  let mockFastify: Partial<FastifyInstance>;

  beforeEach(() => {
    mockFastify = {
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      config: {
        LITELLM_BASE_URL: 'http://localhost:4000',
        LITELLM_API_KEY: 'test-key',
      },
    } as any;

    service = new LiteLLMService(mockFastify as FastifyInstance);
    vi.clearAllMocks();
  });

  describe('getModels', () => {
    it('should fetch and return available models', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockModels }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await service.getModels();

      expect(result).toEqual(mockModels);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/models',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should cache models for subsequent requests', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockModels }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      // First call
      await service.getModels();
      // Second call
      await service.getModels();

      // Should only make one HTTP request due to caching
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(service.getModels()).rejects.toThrow('Failed to fetch models: 500 Internal Server Error');
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await expect(service.getModels()).rejects.toThrow('Network error');
    });

    it('should filter out unavailable models when requested', async () => {
      const modelsWithUnavailable = [
        ...mockModels,
        { ...mockModels[0], id: 'unavailable-model', availability: 'unavailable' },
      ];
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: modelsWithUnavailable }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await service.getModels({ includeUnavailable: false });

      expect(result).toHaveLength(2); // Only available models
      expect(result.find(m => m.id === 'unavailable-model')).toBeUndefined();
    });
  });

  describe('getModel', () => {
    it('should fetch a specific model by ID', async () => {
      const targetModel = mockModels[0];
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(targetModel),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await service.getModel(targetModel.id);

      expect(result).toEqual(targetModel);
      expect(fetch).toHaveBeenCalledWith(
        `http://localhost:4000/v1/models/${targetModel.id}`,
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should return null for non-existent model', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await service.getModel('non-existent-model');

      expect(result).toBeNull();
    });
  });

  describe('createCompletion', () => {
    it('should create a completion request', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockCompletion),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const requestData = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 100,
        temperature: 0.7,
      };

      const result = await service.createCompletion(requestData);

      expect(result).toEqual(mockCompletion);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        })
      );
    });

    it('should handle completion errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue({
          error: { message: 'Invalid model specified' }
        }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const requestData = {
        model: 'invalid-model',
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await expect(service.createCompletion(requestData)).rejects.toThrow('Invalid model specified');
    });

    it('should validate required fields', async () => {
      const invalidRequestData = {
        // Missing model field
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await expect(service.createCompletion(invalidRequestData as any)).rejects.toThrow('Model is required');
    });

    it('should validate message format', async () => {
      const invalidRequestData = {
        model: 'gpt-4',
        messages: [{ content: 'Hello!' }], // Missing role
      };

      await expect(service.createCompletion(invalidRequestData as any)).rejects.toThrow('Invalid message format');
    });
  });

  describe('healthCheck', () => {
    it('should check LiteLLM service health', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'healthy' }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.status).toBe('healthy');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4000/health',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-key',
          },
        })
      );
    });

    it('should handle unhealthy service', async () => {
      const mockResponse = {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('503');
    });

    it('should handle connection errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'));

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('getUsage', () => {
    it('should fetch usage statistics', async () => {
      const mockUsageData = {
        total_requests: 1000,
        total_tokens: 50000,
        total_cost: 25.50,
        models: [
          { model: 'gpt-4', requests: 600, tokens: 30000, cost: 18.00 },
          { model: 'gpt-3.5-turbo', requests: 400, tokens: 20000, cost: 7.50 },
        ],
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockUsageData),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await service.getUsage({ 
        start_date: '2024-06-01', 
        end_date: '2024-06-30' 
      });

      expect(result).toEqual(mockUsageData);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4000/v1/usage?start_date=2024-06-01&end_date=2024-06-30',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should handle missing date parameters', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await service.getUsage();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`start_date=${today}&end_date=${today}`),
        expect.any(Object)
      );
    });
  });

  describe('retryLogic', () => {
    it('should retry failed requests up to 3 times', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ data: mockModels }),
        } as any);

      const result = await service.getModels();

      expect(result).toEqual(mockModels);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(service.getModels()).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx errors', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ data: mockModels }),
        } as any);

      const result = await service.getModels();

      expect(result).toEqual(mockModels);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
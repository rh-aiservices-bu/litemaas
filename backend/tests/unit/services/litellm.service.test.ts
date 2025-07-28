import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiteLLMService } from '../../../src/services/litellm.service';
import type { FastifyInstance } from 'fastify';
import { mockModels, mockCompletion } from '../../setup';

// Mock fetch for HTTP requests
global.fetch = vi.fn();

// Test-specific interfaces
interface MockFastifyInstance extends Partial<FastifyInstance> {
  log: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  config: {
    LITELLM_BASE_URL: string;
    LITELLM_API_KEY: string;
  };
}

interface MockResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: ReturnType<typeof vi.fn>;
}

interface InvalidCompletionRequest {
  model?: string;
  messages?: Array<{ role?: string; content?: string }>;
}

describe('LiteLLMService', () => {
  let service: LiteLLMService;
  let mockFastify: MockFastifyInstance;

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
    };

    service = new LiteLLMService(mockFastify as FastifyInstance);
    vi.clearAllMocks();
  });

  describe('getModels', () => {
    it('should fetch and return available models', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockModels }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getModels();

      expect(result).toEqual(mockModels);
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/models', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle error response', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(service.getModels()).rejects.toThrow();
    });
  });

  describe('createCompletion', () => {
    it('should create completion successfully', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockCompletion),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const requestData = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      const result = await service.createCompletion(requestData);

      expect(result).toEqual(mockCompletion);
    });

    it('should handle completion error', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const requestData = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await expect(service.createCompletion(requestData)).rejects.toThrow();
    });

    it('should validate required fields', async () => {
      const invalidRequestData: InvalidCompletionRequest = {
        // Missing model field
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await expect(
        service.createCompletion(
          invalidRequestData as Parameters<typeof service.createCompletion>[0],
        ),
      ).rejects.toThrow('Model is required');
    });

    it('should validate message format', async () => {
      const invalidRequestData: InvalidCompletionRequest = {
        model: 'gpt-4',
        messages: [{ content: 'Hello!' }], // Missing role
      };

      await expect(
        service.createCompletion(
          invalidRequestData as Parameters<typeof service.createCompletion>[0],
        ),
      ).rejects.toThrow('Invalid message format');
    });
  });

  describe('healthCheck', () => {
    it('should check LiteLLM service health', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'healthy' }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.healthCheck();

      expect(result).toEqual({ status: 'healthy' });
    });

    it('should handle health check failure', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(service.healthCheck()).rejects.toThrow();
    });
  });

  describe('listModels', () => {
    it('should list all available models', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockModels }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.listModels();

      expect(result).toEqual(mockModels);
    });

    it('should handle list models error', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(service.listModels()).rejects.toThrow();
    });
  });

  describe('getModelInfo', () => {
    it('should get model information', async () => {
      const mockModelInfo = { id: 'gpt-4', object: 'model', owned_by: 'openai' };
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockModelInfo),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getModelInfo('gpt-4');

      expect(result).toEqual(mockModelInfo);
    });
  });

  describe('retry mechanism', () => {
    it('should retry on network errors', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ data: mockModels }),
        } as Response);

      const result = await service.getModels();

      expect(result).toEqual(mockModels);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx errors', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(service.getModels()).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx errors', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ data: mockModels }),
        } as Response);

      const result = await service.getModels();

      expect(result).toEqual(mockModels);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiteLLMService } from '../../../src/services/litellm.service';
import type { FastifyInstance } from 'fastify';
import type { LiteLLMModel, LiteLLMHealth } from '../../../src/types/model.types';

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
}

interface MockResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: ReturnType<typeof vi.fn>;
}

describe('LiteLLMService', () => {
  let service: LiteLLMService;
  let mockFastify: MockFastifyInstance;

  const mockModels: LiteLLMModel[] = [
    {
      model_name: 'gpt-4o',
      litellm_params: {
        input_cost_per_token: 0.01,
        output_cost_per_token: 0.03,
        custom_llm_provider: 'openai',
        model: 'openai/gpt-4o',
      },
      model_info: {
        id: 'gpt-4o-id',
        db_model: true,
        max_tokens: 128000,
        input_cost_per_token: 0.01,
        output_cost_per_token: 0.03,
      },
    },
  ];

  beforeEach(() => {
    mockFastify = {
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    };

    service = new LiteLLMService(mockFastify as FastifyInstance, {
      baseUrl: 'http://localhost:4000',
      apiKey: 'sk-1104',
      enableMocking: false,
    });
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
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/model/info', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-litellm-api-key': 'sk-1104',
        },
        body: undefined,
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle error response', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({ error: { message: 'Server error' } }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(service.getModels()).rejects.toThrow('LiteLLM API error: 500 - Server error');
    });

    it('should return cached models when available', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockModels }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      // First call should fetch from API
      await service.getModels();
      // Second call should use cache
      await service.getModels();

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHealth', () => {
    it('should check LiteLLM service health', async () => {
      const mockHealth: LiteLLMHealth = {
        status: 'healthy',
        db: 'connected',
        redis: 'connected',
        litellm_version: '1.81.0',
      };

      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockHealth),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getHealth();

      expect(result).toEqual(mockHealth);
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/health/liveness', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-litellm-api-key': 'sk-1104',
        },
        body: undefined,
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle health check failure', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: vi.fn().mockResolvedValue({ error: { message: 'Service unavailable' } }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        db: 'unknown',
      });
    });

    it('should return cached health when available', async () => {
      const mockHealth: LiteLLMHealth = {
        status: 'healthy',
        db: 'connected',
      };

      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockHealth),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      // First call should fetch from API
      await service.getHealth();
      // Second call should use cache
      await service.getHealth();

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getModelById', () => {
    it('should find model by ID', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockModels }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getModelById('gpt-4o');

      expect(result).toEqual(mockModels[0]);
    });

    it('should return null for non-existent model', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockModels }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getModelById('non-existent-model');

      expect(result).toBeNull();
    });
  });

  describe('validateApiKey', () => {
    it('should validate API key successfully', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ key: 'sk-test', info: { key_name: 'test-key', spend: 0 } }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.validateApiKey('sk-litellm-test123');

      expect(result).toBe(true);
    });

    it('should return false for invalid API key', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ error: { message: 'Invalid key' } }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.validateApiKey('invalid-key');

      expect(result).toBe(false);
    });
  });

  describe('getKeyInfo', () => {
    it('should unwrap nested v1.81.0 response format', async () => {
      const keyInfo = {
        key_name: 'test-key',
        spend: 25.5,
        max_budget: 100,
        models: ['gpt-4o'],
        tpm_limit: 1000,
        rpm_limit: 60,
        user_id: 'user-123',
      };
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ key: 'sk-test123', info: keyInfo }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getKeyInfo('sk-test123');

      expect(result).toEqual(keyInfo);
      expect(result.spend).toBe(25.5);
      expect(result.max_budget).toBe(100);
    });

    it('should handle flat response format for backward compatibility', async () => {
      const keyInfo = {
        key_name: 'test-key',
        spend: 10.0,
        max_budget: 50,
        models: ['gpt-4o'],
        tpm_limit: 500,
        rpm_limit: 30,
        user_id: 'user-456',
      };
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(keyInfo),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getKeyInfo('sk-flat-key');

      expect(result).toEqual(keyInfo);
      expect(result.spend).toBe(10.0);
    });

    it('should throw on API error', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ error: { message: 'Invalid key' } }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(service.getKeyInfo('sk-invalid')).rejects.toThrow();
    });
  });

  describe('getKeyAlias', () => {
    it('should unwrap nested v1.81.0 response format', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          key: 'sk-test123',
          info: {
            key_alias: 'my-alias',
            key_name: 'test-key',
            spend: 10,
            expires: null,
            models: ['gpt-4o'],
          },
        }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getKeyAlias('sk-test123');

      expect(result).toEqual({ key: 'sk-test123', key_alias: 'my-alias' });
    });

    it('should handle flat response format for backward compatibility', async () => {
      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          key_alias: 'flat-alias',
          key_name: 'test-key',
          spend: 5,
          models: ['gpt-4o'],
        }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getKeyAlias('sk-flat-key');

      expect(result).toEqual({ key: 'sk-flat-key', key_alias: 'flat-alias' });
    });

    it('should throw on API error', async () => {
      const mockResponse: MockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ error: { message: 'Invalid key' } }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(service.getKeyAlias('sk-invalid')).rejects.toThrow();
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
        json: vi.fn().mockResolvedValue({ error: { message: 'Bad request' } }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      await expect(service.getModels()).rejects.toThrow('LiteLLM API error: 400 - Bad request');
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('user management', () => {
    it('should create user successfully', async () => {
      const mockUserResponse = {
        user_id: 'user-123',
        user_email: 'test@example.com',
        user_role: 'internal_user',
        teams: ['default-team'],
        max_budget: 100,
        spend: 0,
        created_at: new Date().toISOString(),
      };

      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockUserResponse),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.createUser({
        user_id: 'user-123',
        user_email: 'test@example.com',
      });

      expect(result).toEqual(mockUserResponse);
    });

    it('should get user info successfully', async () => {
      const mockUserResponse = {
        user_id: 'user-123',
        user_alias: 'Test User',
        teams: ['default-team'],
        max_budget: 100,
        spend: 25,
      };

      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockUserResponse),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getUserInfo('user-123');

      expect(result).toEqual(mockUserResponse);
    });

    it('should return null for non-existent user', async () => {
      const mockUserResponse = {
        user_id: 'user-123',
        teams: [], // Empty teams array indicates user doesn't exist
      };

      const mockResponse: MockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockUserResponse),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const result = await service.getUserInfo('user-123');

      expect(result).toBeNull();
    });
  });
});

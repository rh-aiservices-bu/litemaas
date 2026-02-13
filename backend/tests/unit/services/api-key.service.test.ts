import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyService } from '../../../src/services/api-key.service.js';
import { LiteLLMService } from '../../../src/services/litellm.service.js';
import type { FastifyInstance } from 'fastify';
import type {
  CreateApiKeyRequest,
  LegacyCreateApiKeyRequest,
  UpdateApiKeyRequest,
} from '../../../src/types/api-key.types.js';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockFastify: Partial<FastifyInstance>;
  let mockLiteLLMService: Partial<LiteLLMService>;
  let mockDbUtils: any;
  let mockPgClient: any;

  const mockLiteLLMKeyResponse = {
    key: 'sk-litellm-abc123def456',
    key_name: 'test-key-alias',
    expires: null,
  };

  const mockApiKeyDbRow = {
    id: 'key-123',
    user_id: 'user-123',
    name: 'Test API Key',
    key_hash: 'hashed-key-value',
    key_prefix: 'sk-abc1',
    last_used_at: null,
    expires_at: null,
    is_active: true,
    created_at: new Date(),
    lite_llm_key_value: 'sk-litellm-abc123def456',
    litellm_key_alias: 'test-key-alias',
    max_budget: 100,
    current_spend: 0,
    tpm_limit: 10000,
    rpm_limit: 100,
    last_sync_at: new Date(),
    sync_status: 'synced',
    metadata: {},
    models: ['gpt-4o'],
    model_details: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        context_length: 128000,
      },
    ],
  };

  const mockSubscription = {
    id: 'sub-123',
    user_id: 'user-123',
    model_id: 'gpt-4o',
    status: 'active',
  };

  beforeEach(() => {
    mockDbUtils = {
      query: vi.fn(),
      queryOne: vi.fn(),
      queryMany: vi.fn(),
    };

    mockPgClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockFastify = {
      dbUtils: {
        ...mockDbUtils,
        withTransaction: vi.fn().mockImplementation(async (callback) => {
          return callback(mockPgClient);
        }),
      },
      pg: {
        connect: vi.fn().mockResolvedValue(mockPgClient),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
      createNotFoundError: vi.fn().mockImplementation((message) => new Error(message)),
    } as Partial<FastifyInstance>;

    mockLiteLLMService = {
      generateApiKey: vi.fn(),
      getKeyInfo: vi.fn(),
      updateKey: vi.fn(),
      deleteKey: vi.fn(),
      ensureUserExists: vi.fn(),
    };

    service = new ApiKeyService(
      mockFastify as FastifyInstance,
      mockLiteLLMService as LiteLLMService,
    );
  });

  describe('createApiKey - Modern Multi-Model', () => {
    const createRequest: CreateApiKeyRequest = {
      modelIds: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
      name: 'Test Key',
      maxBudget: 100,
      tpmLimit: 10000,
      rpmLimit: 100,
    };

    it('should return mock API key when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.createApiKey('user-123', createRequest);

      expect(result).toBeDefined();
      expect(result.key).toBeTruthy();
      expect(result.models).toEqual(['gpt-4o', 'claude-3-5-sonnet-20241022']);
      expect(result.name).toBe('Test Key');
    });

    it('should validate at least one model is selected', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      const invalidRequest: CreateApiKeyRequest = {
        modelIds: [],
        name: 'Test Key',
      };

      await expect(service.createApiKey('user-123', invalidRequest)).rejects.toThrow(
        /At least one model must be selected/i,
      );
    });

    it('should validate user has active subscriptions for models', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryMany.mockResolvedValue([]); // No valid subscriptions

      // Mock LiteLLM sync utils
      vi.mock('../../../src/utils/litellm-sync.utils.js', () => ({
        LiteLLMSyncUtils: {
          ensureUserExistsInLiteLLM: vi.fn().mockResolvedValue(undefined),
          ensureTeamExistsInLiteLLM: vi.fn().mockResolvedValue(undefined),
        },
      }));

      await expect(service.createApiKey('user-123', createRequest)).rejects.toThrow(
        /do not have active subscriptions/i,
      );
    });

    it('should enforce maximum API keys per user limit', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Mock active subscriptions for both models
      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' },
        { model_id: 'claude-3-5-sonnet-20241022', model_name: 'Claude 3.5', provider: 'anthropic' },
      ]);

      mockDbUtils.queryOne.mockResolvedValue({ count: 10 }); // Already at limit

      await expect(service.createApiKey('user-123', createRequest)).rejects.toThrow(
        /Maximum.*active API keys/i,
      );
    });

    it('should generate unique key prefix for display', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.createApiKey('user-123', createRequest);

      expect(result.keyPrefix).toBeTruthy();
      expect(result.keyPrefix).toMatch(/^sk-/);
    });

    it('should create API key with multiple models', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      const validModels = [
        { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' },
        { model_id: 'claude-3-5-sonnet-20241022', model_name: 'Claude 3.5', provider: 'anthropic' },
      ];

      mockDbUtils.queryMany.mockResolvedValue(validModels);
      mockDbUtils.queryOne.mockResolvedValue({ count: 0 }); // No existing keys

      vi.mocked(mockLiteLLMService.generateApiKey!).mockResolvedValue(mockLiteLLMKeyResponse);

      mockPgClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockApiKeyDbRow] }) // INSERT api_keys
        .mockResolvedValueOnce(undefined) // INSERT api_key_models (model 1)
        .mockResolvedValueOnce(undefined) // INSERT api_key_models (model 2)
        .mockResolvedValueOnce(undefined) // INSERT audit_logs
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.createApiKey('user-123', createRequest);

      expect(result).toBeDefined();
      expect(result.models).toEqual(['gpt-4o', 'claude-3-5-sonnet-20241022']);
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_key_models'),
        expect.anything(),
      );
    });

    it('should create audit log on key creation', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' },
      ]);
      mockDbUtils.queryOne.mockResolvedValue({ count: 0 });

      vi.mocked(mockLiteLLMService.generateApiKey!).mockResolvedValue(mockLiteLLMKeyResponse);

      mockPgClient.query.mockResolvedValue(undefined);
      mockPgClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockPgClient.query.mockResolvedValueOnce({ rows: [mockApiKeyDbRow] }); // INSERT

      await service.createApiKey('user-123', { modelIds: ['gpt-4o'] });

      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          'API_KEY_CREATE',
          'API_KEY',
          expect.any(String),
          expect.any(String),
        ]),
      );
    });

    it('should rollback on LiteLLM creation failure', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' },
      ]);
      mockDbUtils.queryOne.mockResolvedValue({ count: 0 });

      vi.mocked(mockLiteLLMService.generateApiKey!).mockRejectedValue(
        new Error('LiteLLM API error'),
      );

      await expect(service.createApiKey('user-123', { modelIds: ['gpt-4o'] })).rejects.toThrow(
        'LiteLLM API error',
      );
    });

    it('should cleanup LiteLLM key on database error', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' },
      ]);
      mockDbUtils.queryOne.mockResolvedValue({ count: 0 });

      vi.mocked(mockLiteLLMService.generateApiKey!).mockResolvedValue(mockLiteLLMKeyResponse);
      vi.mocked(mockLiteLLMService.deleteKey!).mockResolvedValue(undefined);

      mockPgClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(service.createApiKey('user-123', { modelIds: ['gpt-4o'] })).rejects.toThrow(
        'Database error',
      );

      expect(mockPgClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockLiteLLMService.deleteKey).toHaveBeenCalledWith(mockLiteLLMKeyResponse.key);
    });
  });

  describe('createApiKey - Legacy Subscription Mode', () => {
    const legacyRequest: LegacyCreateApiKeyRequest = {
      subscriptionId: 'sub-123',
      name: 'Legacy Key',
    };

    it('should support legacy subscriptionId parameter', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockDbUtils.queryOne
        .mockResolvedValueOnce(mockSubscription) // Get subscription
        .mockResolvedValueOnce({ count: 0 }); // Key count check

      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' },
      ]);

      vi.mocked(mockLiteLLMService.generateApiKey!).mockResolvedValue(mockLiteLLMKeyResponse);

      mockPgClient.query.mockResolvedValue(undefined);
      mockPgClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockPgClient.query.mockResolvedValueOnce({ rows: [mockApiKeyDbRow] }); // INSERT

      const result = await service.createApiKey('user-123', legacyRequest);

      expect(result.subscriptionId).toBe('sub-123');
      expect(mockFastify.log!.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('deprecated subscriptionId'),
        }),
      );
    });

    it('should throw error for non-existent subscription', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null); // Subscription not found

      await expect(service.createApiKey('user-123', legacyRequest)).rejects.toThrow(
        /Subscription.*not found/i,
      );
    });

    it('should throw error for inactive subscription', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue({
        ...mockSubscription,
        status: 'cancelled',
      });

      await expect(service.createApiKey('user-123', legacyRequest)).rejects.toThrow(
        /Cannot create API key for cancelled subscription/i,
      );
    });

    it('should convert subscription to model ID', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockDbUtils.queryOne
        .mockResolvedValueOnce(mockSubscription)
        .mockResolvedValueOnce({ count: 0 });

      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' },
      ]);

      vi.mocked(mockLiteLLMService.generateApiKey!).mockResolvedValue(mockLiteLLMKeyResponse);

      mockPgClient.query.mockResolvedValue(undefined);
      mockPgClient.query.mockResolvedValueOnce(undefined);
      mockPgClient.query.mockResolvedValueOnce({ rows: [mockApiKeyDbRow] });

      await service.createApiKey('user-123', legacyRequest);

      expect(mockLiteLLMService.generateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          models: ['gpt-4o'],
        }),
      );
    });
  });

  describe('getApiKey', () => {
    it('should return mock API key when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getApiKey('key-mock-1', 'user-mock-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('key-mock-1');
    });

    it('should return null for non-existent mock key', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getApiKey('non-existent', 'user-123');

      expect(result).toBeNull();
    });

    it('should retrieve API key by ID', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(mockApiKeyDbRow);
      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      ]);

      const result = await service.getApiKey('key-123', 'user-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('key-123');
      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
        'key-123',
        'user-123',
      ]);
    });

    it('should include model details', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(mockApiKeyDbRow);
      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', context_length: 128000 },
      ]);

      const result = await service.getApiKey('key-123', 'user-123');

      expect(result?.modelDetails).toBeDefined();
      expect(result?.modelDetails).toHaveLength(1);
      expect(result?.modelDetails?.[0].id).toBe('gpt-4o');
    });

    it('should return null when key not found', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      const result = await service.getApiKey('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('getUserApiKeys', () => {
    it('should return mock keys when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getUserApiKeys('user-mock-1');

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryMany.mockResolvedValue([mockApiKeyDbRow]);
      mockDbUtils.queryOne.mockResolvedValue({ count: 10 });

      const result = await service.getUserApiKeys('user-123', { page: 2, limit: 5 });

      expect(result.data).toBeDefined();
      expect(result.total).toBe(10);
    });

    it('should filter by active status', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryMany.mockResolvedValue([mockApiKeyDbRow]);
      mockDbUtils.queryOne.mockResolvedValue({ count: 1 });

      await service.getUserApiKeys('user-123', { isActive: true });

      expect(mockDbUtils.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        expect.anything(),
      );
    });
  });

  describe('validateApiKey', () => {
    const validTestKey = 'sk-' + 'a'.repeat(64); // 67 chars total

    it('should validate active API key', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const keyHash = require('crypto').createHash('sha256').update(validTestKey).digest('hex');
      mockDbUtils.queryOne.mockResolvedValue({
        ...mockApiKeyDbRow,
        key_hash: keyHash,
        is_active: true,
        expires_at: null,
      });

      const result = await service.validateApiKey(validTestKey);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.apiKey?.id).toBe('key-123');
    });

    it('should reject expired API key', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const keyHash = require('crypto').createHash('sha256').update(validTestKey).digest('hex');
      mockDbUtils.queryOne.mockResolvedValue({
        ...mockApiKeyDbRow,
        key_hash: keyHash,
        expires_at: new Date(Date.now() - 1000), // Expired
      });

      const result = await service.validateApiKey(validTestKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/expired/i);
    });

    it('should reject inactive API key', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Inactive keys won't be returned by the query (WHERE is_active = true)
      mockDbUtils.queryOne.mockResolvedValue(null);

      const result = await service.validateApiKey(validTestKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('should reject non-existent API key', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      const result = await service.validateApiKey(validTestKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('should update last used timestamp', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const keyHash = require('crypto').createHash('sha256').update(validTestKey).digest('hex');
      mockDbUtils.queryOne.mockResolvedValue({
        ...mockApiKeyDbRow,
        key_hash: keyHash,
        is_active: true,
      });

      await service.validateApiKey(validTestKey);

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys SET last_used_at'),
        expect.anything(),
      );
    });
  });

  describe('updateApiKey', () => {
    const updateRequest: UpdateApiKeyRequest = {
      name: 'Updated Key Name',
      isActive: true,
    };

    it('should update API key properties', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockDbUtils.queryOne
        .mockResolvedValueOnce(mockApiKeyDbRow) // Get existing key
        .mockResolvedValueOnce({ ...mockApiKeyDbRow, name: 'Updated Key Name' }); // Update result

      mockDbUtils.queryMany.mockResolvedValue([
        { model_id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      ]);

      const result = await service.updateApiKey('key-123', 'user-123', updateRequest);

      expect(result.name).toBe('Updated Key Name');
      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys'),
        expect.anything(),
      );
    });

    it('should throw error for non-existent key', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      await expect(service.updateApiKey('non-existent', 'user-123', updateRequest)).rejects.toThrow(
        /not found/i,
      );
    });

    it('should prevent updates to inactive keys', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getApiKey').mockResolvedValue({
        ...mockApiKeyDbRow,
        keyHash: 'hashed',
        keyPrefix: 'sk-abc1',
        userId: 'user-123',
        models: ['gpt-4o'],
        isActive: false,
        createdAt: new Date(),
        syncStatus: 'synced',
      } as any);

      await expect(service.updateApiKey('key-123', 'user-123', updateRequest)).rejects.toThrow(
        /inactive/i,
      );
    });

    it('should create audit log on update', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockDbUtils.queryOne
        .mockResolvedValueOnce(mockApiKeyDbRow)
        .mockResolvedValueOnce({ ...mockApiKeyDbRow, name: 'Updated' });

      mockDbUtils.queryMany.mockResolvedValue([]);

      await service.updateApiKey('key-123', 'user-123', updateRequest);

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          'API_KEY_UPDATE',
          'API_KEY',
          'key-123',
          expect.any(String),
        ]),
      );
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getApiKey').mockResolvedValue({
        ...mockApiKeyDbRow,
        keyHash: 'hashed',
        keyPrefix: 'sk-abc1',
        userId: 'user-123',
        models: ['gpt-4o'],
        isActive: true,
        createdAt: new Date(),
        liteLLMKeyId: 'sk-litellm-abc123def456',
        syncStatus: 'synced',
      } as any);

      mockDbUtils.query.mockResolvedValue(undefined);
      vi.mocked(mockLiteLLMService.deleteKey!).mockResolvedValue(undefined);

      await service.deleteApiKey('key-123', 'user-123');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM api_keys'),
        ['key-123'],
      );
    });

    it('should delete key from LiteLLM', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getApiKey').mockResolvedValue({
        ...mockApiKeyDbRow,
        keyHash: 'hashed',
        keyPrefix: 'sk-abc1',
        userId: 'user-123',
        models: ['gpt-4o'],
        isActive: true,
        createdAt: new Date(),
        liteLLMKeyId: 'sk-litellm-abc123def456',
        syncStatus: 'synced',
      } as any);

      mockDbUtils.query.mockResolvedValue(undefined);
      vi.mocked(mockLiteLLMService.deleteKey!).mockResolvedValue(undefined);

      await service.deleteApiKey('key-123', 'user-123');

      expect(mockLiteLLMService.deleteKey).toHaveBeenCalledWith('sk-litellm-abc123def456');
    });

    it('should continue on LiteLLM deletion failure', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getApiKey').mockResolvedValue({
        ...mockApiKeyDbRow,
        keyHash: 'hashed',
        keyPrefix: 'sk-abc1',
        userId: 'user-123',
        models: ['gpt-4o'],
        isActive: true,
        createdAt: new Date(),
        liteLLMKeyId: 'sk-litellm-abc123def456',
        syncStatus: 'synced',
      } as any);

      mockDbUtils.query.mockResolvedValue(undefined);
      vi.mocked(mockLiteLLMService.deleteKey!).mockRejectedValue(new Error('LiteLLM error'));

      // Should not throw
      await service.deleteApiKey('key-123', 'user-123');

      expect(mockFastify.log!.warn).toHaveBeenCalled();
    });
  });

  describe('rotateApiKey', () => {
    it('should generate new key and update database', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getApiKey').mockResolvedValue({
        ...mockApiKeyDbRow,
        keyHash: 'hashed',
        keyPrefix: 'sk-abc1',
        userId: 'user-123',
        models: ['gpt-4o'],
        isActive: true,
        createdAt: new Date(),
        liteLLMKeyId: 'sk-litellm-abc123def456',
        syncStatus: 'synced',
      } as any);

      mockPgClient.query.mockResolvedValue(undefined);

      vi.mocked(mockLiteLLMService.deleteKey!).mockResolvedValue(undefined);
      vi.mocked(mockLiteLLMService.generateApiKey!).mockResolvedValue({
        key: 'sk-litellm-new-key-789',
        key_name: 'rotated-key',
        expires: null,
      });

      const result = await service.rotateApiKey('key-123', 'user-123');

      expect(result).toBeDefined();
      expect(result.key).toBeDefined();
      expect(mockLiteLLMService.generateApiKey).toHaveBeenCalled();
    });

    it('should preserve key metadata on rotation', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getApiKey').mockResolvedValue({
        ...mockApiKeyDbRow,
        keyHash: 'hashed',
        keyPrefix: 'sk-abc1',
        userId: 'user-123',
        models: ['gpt-4o'],
        isActive: true,
        createdAt: new Date(),
        liteLLMKeyId: 'sk-litellm-abc123def456',
        syncStatus: 'synced',
        maxBudget: 500,
        tpmLimit: 20000,
        metadata: { team: 'engineering' },
      } as any);

      mockPgClient.query.mockResolvedValue(undefined);

      vi.mocked(mockLiteLLMService.deleteKey!).mockResolvedValue(undefined);
      vi.mocked(mockLiteLLMService.generateApiKey!).mockResolvedValue({
        key: 'sk-litellm-new-key',
        key_name: 'rotated',
        expires: null,
      });

      await service.rotateApiKey('key-123', 'user-123');

      expect(mockLiteLLMService.generateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          max_budget: 500,
          tpm_limit: 20000,
        }),
      );
    });
  });

  describe('getApiKeyStats', () => {
    it('should return statistics for user API keys', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockDbUtils.query
        .mockResolvedValueOnce({
          rows: [
            {
              total: 10,
              active: 8,
              expired: 1,
              revoked: 1,
            },
          ],
        }) // Status counts
        .mockResolvedValueOnce({
          rows: [
            { subscription_id: 'sub-1', count: 5 },
            { subscription_id: 'sub-2', count: 5 },
          ],
        }) // By subscription
        .mockResolvedValueOnce({
          rows: [
            { model_id: 'gpt-4o', count: 8 },
            { model_id: 'claude-3-5-sonnet-20241022', count: 2 },
          ],
        }); // By model

      const result = await service.getApiKeyStats('user-123');

      expect(result.total).toBe(10);
      expect(result.active).toBe(8);
      expect(result.expired).toBe(1);
      expect(result.revoked).toBe(1);
      expect(result.bySubscription).toBeDefined();
      expect(result.byModel).toBeDefined();
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should mark expired keys as inactive', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockPgClient.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'key-1',
              lite_llm_key_value: 'sk-litellm-1',
              user_id: 'user-1',
              name: 'Key 1',
              key_prefix: 'sk-ab',
            },
            {
              id: 'key-2',
              lite_llm_key_value: 'sk-litellm-2',
              user_id: 'user-1',
              name: 'Key 2',
              key_prefix: 'sk-cd',
            },
          ],
        }) // SELECT expired keys
        .mockResolvedValueOnce(undefined); // UPDATE to mark inactive

      const result = await service.cleanupExpiredKeys();

      expect(result).toBe(2);
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys'),
        expect.anything(),
      );
    });

    it('should return 0 when no keys to clean up', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      mockPgClient.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.cleanupExpiredKeys();

      expect(result).toBe(0);
    });
  });

  describe('Helper Methods', () => {
    it('should generate cryptographically secure API key', () => {
      const key = service['generateApiKey']();

      expect(key.key).toBeTruthy();
      expect(key.key).toMatch(/^sk-/);
      expect(key.keyPrefix).toBeTruthy();
      expect(key.keyHash).toBeTruthy();
    });

    it('should hash API key consistently', () => {
      const testKey = 'sk-test-key-123';

      const hash1 = service['hashApiKey'](testKey);
      const hash2 = service['hashApiKey'](testKey);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });

    it('should extract key prefix correctly', () => {
      const key = 'sk-abcdef1234567890';

      const prefix = service['extractKeyPrefix'](key);

      // Prefix = 'sk-' (3 chars) + PREFIX_LENGTH (4 chars) = 7 chars total
      expect(prefix).toBe('sk-abcd');
      expect(prefix).toHaveLength(7);
    });

    it('should validate key format', () => {
      // Valid key: 'sk-' + 64 hex chars = 67 total chars
      const validKey = 'sk-' + 'a'.repeat(64);
      expect(service['isValidKeyFormat'](validKey)).toBe(true);

      expect(service['isValidKeyFormat']('sk-abc123def456')).toBe(false); // Too short
      expect(service['isValidKeyFormat']('invalid-key')).toBe(false);
      expect(service['isValidKeyFormat']('')).toBe(false);
      expect(service['isValidKeyFormat']('sk-')).toBe(false);
    });

    it('should generate unique key alias', () => {
      const alias1 = service['generateUniqueKeyAlias']('test-key');
      const alias2 = service['generateUniqueKeyAlias']('test-key');

      expect(alias1).toBeTruthy();
      expect(alias2).toBeTruthy();
      expect(alias1).not.toBe(alias2); // Should be unique
    });

    it('should calculate duration correctly', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const duration = service['calculateDuration'](futureDate);

      expect(duration).toMatch(/^\d+d$/); // Should be in days format
    });
  });

  describe('Subscription Status Validation', () => {
    describe('createApiKey with subscription validation', () => {
      it('should allow creating key with active subscription models', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockDbUtils.queryMany.mockResolvedValueOnce([
          { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai', status: 'active' },
        ]);
        mockDbUtils.queryOne.mockResolvedValue({ count: 0 });

        vi.mocked(mockLiteLLMService.generateApiKey!).mockResolvedValue(mockLiteLLMKeyResponse);

        mockPgClient.query.mockResolvedValue(undefined);
        mockPgClient.query.mockResolvedValueOnce(undefined); // BEGIN
        mockPgClient.query.mockResolvedValueOnce({ rows: [mockApiKeyDbRow] }); // INSERT

        const result = await service.createApiKey('user-123', {
          modelIds: ['gpt-4o'],
          name: 'Test Key',
        });

        expect(result).toBeDefined();
        expect(result.models).toContain('gpt-4o');
      });

      it('should reject creating key with pending subscription models', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        // Mock subscription check returns pending subscription
        mockDbUtils.queryMany.mockResolvedValue([]);

        await expect(
          service.createApiKey('user-123', {
            modelIds: ['claude-3-5-sonnet'],
            name: 'Test Key',
          }),
        ).rejects.toThrow(/do not have active subscriptions/i);
      });

      it('should reject creating key with denied subscription models', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockDbUtils.queryMany.mockResolvedValue([]);

        await expect(
          service.createApiKey('user-123', {
            modelIds: ['llama-3'],
            name: 'Test Key',
          }),
        ).rejects.toThrow(/do not have active subscriptions/i);
      });

      it('should reject creating key with mix of active and non-active subscriptions', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        // Only one model has active subscription
        mockDbUtils.queryMany.mockResolvedValue([
          { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai', status: 'active' },
        ]);

        await expect(
          service.createApiKey('user-123', {
            modelIds: ['gpt-4o', 'pending-model'],
            name: 'Test Key',
          }),
        ).rejects.toThrow(/do not have active subscriptions/i);
      });
    });

    describe('updateApiKey with subscription validation', () => {
      it('should allow updating with active subscription models', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        // Call sequence:
        // 1. getApiKey (initial) -> queryOne for API key, queryMany for models
        // 2. validateModelsHaveActiveSubscriptions -> queryMany for subscriptions
        // 3. update -> queryOne to update
        // 4. getApiKey (final) -> queryOne for API key, queryMany for models
        mockDbUtils.queryOne
          .mockResolvedValueOnce(mockApiKeyDbRow) // getApiKey (initial)
          .mockResolvedValueOnce({ ...mockApiKeyDbRow, name: 'Updated' }) // update
          .mockResolvedValueOnce({ ...mockApiKeyDbRow, name: 'Updated' }); // getApiKey (final)

        mockDbUtils.queryMany
          .mockResolvedValueOnce([{ model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' }]) // getApiKey (initial) - get associated models
          .mockResolvedValueOnce([{ model_id: 'gpt-4o', status: 'active' }]) // validateModelsHaveActiveSubscriptions
          .mockResolvedValueOnce([
            { model_id: 'gpt-4o', model_name: 'GPT-4o', provider: 'openai' },
          ]); // getApiKey (final) - get associated models

        mockDbUtils.query = vi.fn().mockResolvedValue({ rowCount: 1 }); // audit log

        vi.mocked(mockLiteLLMService.updateKey!).mockResolvedValue(undefined);

        const result = await service.updateApiKey('key-123', 'user-123', {
          modelIds: ['gpt-4o'],
        });

        expect(result).toBeDefined();
      });

      it('should reject updating with pending subscription models', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockDbUtils.queryOne.mockResolvedValue(mockApiKeyDbRow);
        mockDbUtils.queryMany.mockResolvedValue([]); // No active subscriptions

        await expect(
          service.updateApiKey('key-123', 'user-123', {
            modelIds: ['pending-model'],
          }),
        ).rejects.toThrow(/cannot add models without active subscriptions/i);
      });

      it('should reject updating with denied subscription models', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        mockDbUtils.queryOne.mockResolvedValue(mockApiKeyDbRow);
        mockDbUtils.queryMany.mockResolvedValue([]);

        await expect(
          service.updateApiKey('key-123', 'user-123', {
            modelIds: ['denied-model'],
          }),
        ).rejects.toThrow(/cannot add models without active subscriptions/i);
      });
    });

    describe('removeModelFromUserApiKeys', () => {
      it('should remove model from all user API keys', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const apiKeys = [
          {
            id: 'key-1',
            lite_llm_key_value: 'sk-litellm-1',
          },
          {
            id: 'key-2',
            lite_llm_key_value: 'sk-litellm-2',
          },
        ];

        mockDbUtils.queryMany
          .mockResolvedValueOnce(apiKeys) // Get API keys with this model
          .mockResolvedValue([{ model_id: 'other-model' }]); // Remaining models

        mockDbUtils.query.mockResolvedValue({ rowCount: 1 });
        vi.mocked(mockLiteLLMService.updateKey!).mockResolvedValue(undefined);

        await service.removeModelFromUserApiKeys('user-123', 'gpt-4o');

        // Verify LiteLLM was updated for both keys
        expect(mockLiteLLMService.updateKey).toHaveBeenCalledTimes(2);

        // Verify database was updated
        expect(mockDbUtils.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM api_key_models'),
          expect.anything(),
        );
      });

      it('should update LiteLLM first, then database (security priority)', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const apiKeys = [
          {
            id: 'key-1',
            lite_llm_key_value: 'sk-litellm-1',
          },
        ];

        const callOrder: string[] = [];

        mockDbUtils.queryMany
          .mockResolvedValueOnce(apiKeys)
          .mockResolvedValue([{ model_id: 'other-model' }]);

        mockDbUtils.query.mockImplementation(async () => {
          callOrder.push('database');
          return { rowCount: 1 };
        });

        vi.mocked(mockLiteLLMService.updateKey!).mockImplementation(async () => {
          callOrder.push('litellm');
        });

        await service.removeModelFromUserApiKeys('user-123', 'gpt-4o');

        // Verify LiteLLM was called before database
        expect(callOrder[0]).toBe('litellm');
        expect(callOrder[1]).toBe('database');
      });

      it('should not update database if LiteLLM update fails', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const apiKeys = [
          {
            id: 'key-1',
            lite_llm_key_value: 'sk-litellm-1',
          },
        ];

        mockDbUtils.queryMany
          .mockResolvedValueOnce(apiKeys)
          .mockResolvedValue([{ model_id: 'other-model' }]);

        mockDbUtils.query.mockResolvedValue({ rowCount: 1 });
        vi.mocked(mockLiteLLMService.updateKey!).mockRejectedValue(new Error('LiteLLM error'));

        await service.removeModelFromUserApiKeys('user-123', 'gpt-4o');

        // Database update should not have been called
        expect(mockDbUtils.query).not.toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM api_key_models'),
          expect.anything(),
        );
      });

      it('should handle multiple API keys with partial LiteLLM failures', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

        const apiKeys = [
          { id: 'key-1', lite_llm_key_value: 'sk-litellm-1' },
          { id: 'key-2', lite_llm_key_value: 'sk-litellm-2' },
        ];

        mockDbUtils.queryMany
          .mockResolvedValueOnce(apiKeys)
          .mockResolvedValue([{ model_id: 'other-model' }]);

        mockDbUtils.query.mockResolvedValue({ rowCount: 1 });

        // First key succeeds, second fails
        vi.mocked(mockLiteLLMService.updateKey!)
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('LiteLLM error'));

        await service.removeModelFromUserApiKeys('user-123', 'gpt-4o');

        // Only first key should be updated in database
        expect(mockDbUtils.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM api_key_models'),
          expect.arrayContaining([['key-1'], 'gpt-4o']),
        );
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyService } from '../../../src/services/api-key.service';
import type { FastifyInstance } from 'fastify';
import { mockApiKey, mockUser } from '../../setup';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockFastify: Partial<FastifyInstance>;

  beforeEach(() => {
    mockFastify = {
      db: {
        query: vi.fn(),
        pool: {
          connect: vi.fn(),
        },
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    } as unknown as FastifyInstance;

    service = new ApiKeyService(mockFastify as FastifyInstance);
  });

  describe('generateApiKey', () => {
    it('should generate a new API key with valid parameters', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ ...mockApiKey, id: 'new-key-id' }],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const keyData = {
        name: 'Test API Key',
        userId: mockUser.id,
        permissions: ['models:read', 'completions:create'],
        rateLimit: 1000,
        description: 'Test key description',
      };

      const result = await service.generateApiKey(keyData);

      expect(result).toBeDefined();
      expect(result.name).toBe(keyData.name);
      expect(result.permissions).toEqual(keyData.permissions);
      expect(result.rateLimit).toBe(keyData.rateLimit);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_keys'),
        expect.arrayContaining([
          keyData.name,
          keyData.userId,
          expect.any(String), // hashed key
          expect.any(String), // key preview
          expect.any(String), // permissions JSON
          keyData.rateLimit,
          keyData.description,
        ]),
      );
    });

    it('should generate a unique API key each time', async () => {
      const mockQuery = vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ ...mockApiKey, id: 'key-1', keyPreview: 'sk-...abc123' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ ...mockApiKey, id: 'key-2', keyPreview: 'sk-...def456' }],
          rowCount: 1,
        });
      mockFastify.db!.query = mockQuery;

      const keyData = {
        name: 'Test Key',
        userId: mockUser.id,
        permissions: ['models:read'],
        rateLimit: 500,
      };

      const key1 = await service.generateApiKey(keyData);
      const key2 = await service.generateApiKey(keyData);

      expect(key1.keyPreview).not.toBe(key2.keyPreview);
      expect(key1.id).not.toBe(key2.id);
    });

    it('should throw error for invalid permissions', async () => {
      const keyData = {
        name: 'Test Key',
        userId: mockUser.id,
        permissions: ['invalid:permission'],
        rateLimit: 1000,
      };

      await expect(service.generateApiKey(keyData)).rejects.toThrow('Invalid permissions');
    });
  });

  describe('validateApiKey', () => {
    it('should validate a correct API key', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            ...mockApiKey,
            status: 'active',
            userId: mockUser.id,
          },
        ],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.validateApiKey('sk-test-key-123');

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(mockUser.id);
      expect(result.permissions).toEqual(mockApiKey.permissions);
    });

    it('should reject an invalid API key', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.validateApiKey('sk-invalid-key');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Key not found');
    });

    it('should reject a revoked API key', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            ...mockApiKey,
            status: 'revoked',
          },
        ],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.validateApiKey('sk-revoked-key');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Key is revoked');
    });

    it('should reject an expired API key', async () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [
          {
            ...mockApiKey,
            status: 'active',
            expiresAt: expiredDate,
          },
        ],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.validateApiKey('sk-expired-key');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Key has expired');
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an existing API key', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ ...mockApiKey, status: 'revoked' }],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.revokeApiKey(mockApiKey.id, mockUser.id);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys SET status = $1'),
        ['revoked', mockApiKey.id, mockUser.id],
      );
    });

    it('should return false for non-existent API key', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 0,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.revokeApiKey('non-existent-id', mockUser.id);

      expect(result).toBe(false);
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage count for a valid key', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ ...mockApiKey, usageCount: mockApiKey.usageCount + 1 }],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      await service.incrementUsage(mockApiKey.id);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys SET usage_count = usage_count + 1'),
        [mockApiKey.id],
      );
    });

    it('should update last used timestamp', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [mockApiKey],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      await service.incrementUsage(mockApiKey.id);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('last_used_at = NOW()'), [
        mockApiKey.id,
      ]);
    });
  });

  describe('getUserApiKeys', () => {
    it('should return all API keys for a user', async () => {
      const mockKeys = [
        { ...mockApiKey, id: 'key-1', name: 'Key 1' },
        { ...mockApiKey, id: 'key-2', name: 'Key 2' },
      ];
      const mockQuery = vi.fn().mockResolvedValue({
        rows: mockKeys,
        rowCount: 2,
      });
      mockFastify.db!.query = mockQuery;

      const result = await service.getUserApiKeys(mockUser.id);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Key 1');
      expect(result[1].name).toBe('Key 2');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM api_keys WHERE user_id = $1'),
        [mockUser.id],
      );
    });

    it('should filter by status when provided', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [mockApiKey],
        rowCount: 1,
      });
      mockFastify.db!.query = mockQuery;

      await service.getUserApiKeys(mockUser.id, 'active');

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('AND status = $2'), [
        mockUser.id,
        'active',
      ]);
    });
  });
});

describe('retrieveFullKey', () => {
  it('should retrieve full API key for valid request', async () => {
    const mockApiKeyData = {
      id: 'test-key-id',
      user_id: 'user-123',
      name: 'Test Key',
      lite_llm_key_value: 'sk-litellm-abc123def456ghi789',
      is_active: true,
      expires_at: null,
      created_at: new Date().toISOString(),
      last_used_at: null,
    };

    const mockQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [mockApiKeyData],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'audit-log-id' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'test-key-id' }],
        rowCount: 1,
      });

    mockFastify.dbUtils = {
      queryOne: vi.fn().mockResolvedValue(mockApiKeyData),
      query: mockQuery,
    };

    mockFastify.createNotFoundError = vi.fn().mockReturnValue(new Error('Not found'));
    mockFastify.createError = vi.fn().mockReturnValue(new Error('Error'));

    const result = await service.retrieveFullKey('test-key-id', 'user-123');

    expect(result).toBe('sk-litellm-abc123def456ghi789');

    // Verify audit log was created
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.arrayContaining([
        'user-123',
        'API_KEY_RETRIEVE_FULL',
        'API_KEY',
        'test-key-id',
        expect.objectContaining({
          timestamp: expect.any(String),
          keyId: 'test-key-id',
          keyName: 'Test Key',
          retrievalMethod: 'secure_endpoint',
          securityLevel: 'enhanced',
        }),
      ]),
    );

    // Verify retrieval tracking was updated
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE api_keys'), [
      'test-key-id',
    ]);
  });

  it('should throw error for non-existent API key', async () => {
    mockFastify.dbUtils = {
      queryOne: vi.fn().mockResolvedValue(null),
      query: vi.fn(),
    };

    mockFastify.createNotFoundError = vi.fn().mockReturnValue(new Error('API key not found'));

    await expect(service.retrieveFullKey('non-existent-id', 'user-123')).rejects.toThrow(
      'API key not found',
    );

    expect(mockFastify.createNotFoundError).toHaveBeenCalledWith('API key not found');
  });

  it('should throw error for inactive API key', async () => {
    const inactiveApiKey = {
      id: 'test-key-id',
      user_id: 'user-123',
      name: 'Inactive Key',
      lite_llm_key_value: 'sk-litellm-xyz789',
      is_active: false,
      expires_at: null,
    };

    mockFastify.dbUtils = {
      queryOne: vi.fn().mockResolvedValue(inactiveApiKey),
      query: vi.fn(),
    };

    mockFastify.createError = vi.fn().mockReturnValue(new Error('API key is inactive'));

    await expect(service.retrieveFullKey('test-key-id', 'user-123')).rejects.toThrow(
      'API key is inactive',
    );

    expect(mockFastify.createError).toHaveBeenCalledWith(403, 'API key is inactive');
  });

  it('should throw error for expired API key', async () => {
    const expiredApiKey = {
      id: 'test-key-id',
      user_id: 'user-123',
      name: 'Expired Key',
      lite_llm_key_value: 'sk-litellm-expired123',
      is_active: true,
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    };

    mockFastify.dbUtils = {
      queryOne: vi.fn().mockResolvedValue(expiredApiKey),
      query: vi.fn(),
    };

    mockFastify.createError = vi.fn().mockReturnValue(new Error('API key has expired'));

    await expect(service.retrieveFullKey('test-key-id', 'user-123')).rejects.toThrow(
      'API key has expired',
    );

    expect(mockFastify.createError).toHaveBeenCalledWith(403, 'API key has expired');
  });

  it('should throw error when no LiteLLM key is associated', async () => {
    const apiKeyWithoutLiteLLM = {
      id: 'test-key-id',
      user_id: 'user-123',
      name: 'Key Without LiteLLM',
      lite_llm_key_value: null,
      is_active: true,
      expires_at: null,
    };

    mockFastify.dbUtils = {
      queryOne: vi.fn().mockResolvedValue(apiKeyWithoutLiteLLM),
      query: vi.fn(),
    };

    mockFastify.createError = vi.fn().mockReturnValue(new Error('No LiteLLM key associated'));

    await expect(service.retrieveFullKey('test-key-id', 'user-123')).rejects.toThrow(
      'No LiteLLM key associated',
    );

    expect(mockFastify.createError).toHaveBeenCalledWith(
      404,
      'No LiteLLM key associated with this API key',
    );
  });

  it('should handle mock data correctly', async () => {
    // Mock the shouldUseMockData method to return true
    vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

    const result = await service.retrieveFullKey('mock-key-1', 'user-123');

    expect(result).toBe('sk-lm-mock-key-1-abcdef123456');
  });

  it('should handle mock data not found', async () => {
    vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

    mockFastify.createNotFoundError = vi.fn().mockReturnValue(new Error('API key not found'));

    await expect(service.retrieveFullKey('non-existent-mock-key', 'user-123')).rejects.toThrow(
      'API key not found',
    );
  });

  it('should log security information on successful retrieval', async () => {
    const mockApiKeyData = {
      id: 'test-key-id',
      user_id: 'user-123',
      name: 'Security Test Key',
      lite_llm_key_value: 'sk-litellm-security123',
      is_active: true,
      expires_at: null,
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    };

    mockFastify.dbUtils = {
      queryOne: vi.fn().mockResolvedValue(mockApiKeyData),
      query: vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 }),
    };

    const mockLogInfo = vi.fn();
    mockFastify.log = {
      info: mockLogInfo,
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    await service.retrieveFullKey('test-key-id', 'user-123');

    expect(mockLogInfo).toHaveBeenCalledWith(
      {
        userId: 'user-123',
        keyId: 'test-key-id',
        keyName: 'Security Test Key',
        lastUsed: mockApiKeyData.last_used_at,
      },
      'API key full value retrieved securely',
    );
  });

  it('should handle database errors gracefully', async () => {
    const dbError = new Error('Database connection failed');

    mockFastify.dbUtils = {
      queryOne: vi.fn().mockRejectedValue(dbError),
      query: vi.fn(),
    };

    const mockLogError = vi.fn();
    mockFastify.log = {
      info: vi.fn(),
      error: mockLogError,
      warn: vi.fn(),
      debug: vi.fn(),
    };

    await expect(service.retrieveFullKey('test-key-id', 'user-123')).rejects.toThrow(
      'Database connection failed',
    );

    expect(mockLogError).toHaveBeenCalledWith(
      {
        error: 'Database connection failed',
        userId: 'user-123',
        keyId: 'test-key-id',
      },
      'Failed to retrieve full API key',
    );
  });
});

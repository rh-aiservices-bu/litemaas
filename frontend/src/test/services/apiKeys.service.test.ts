import { describe, it, expect, beforeEach, vi } from 'vitest';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { apiKeysService, type CreateApiKeyRequest } from '../../services/apiKeys.service';

describe('ApiKeysService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    localStorage.clear();
  });

  describe('getApiKeys', () => {
    it('should fetch paginated API keys successfully', async () => {
      const result = await apiKeysService.getApiKeys(1, 10);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 3, // Based on mock data
        totalPages: 1,
      });
    });

    it('should handle pagination parameters correctly', async () => {
      const result = await apiKeysService.getApiKeys(2, 1);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.totalPages).toBe(3); // Math.ceil(3/1)
    });

    it('should use default pagination when no parameters provided', async () => {
      const result = await apiKeysService.getApiKeys();

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should map backend response to frontend format correctly', async () => {
      const result = await apiKeysService.getApiKeys();
      const firstKey = result.data[0];

      expect(firstKey).toHaveProperty('id');
      expect(firstKey).toHaveProperty('name');
      expect(firstKey).toHaveProperty('keyPreview');
      expect(firstKey).toHaveProperty('status');
      expect(firstKey).toHaveProperty('permissions');
      expect(firstKey).toHaveProperty('usageCount');
      expect(firstKey).toHaveProperty('rateLimit');
      expect(firstKey).toHaveProperty('createdAt');
      expect(firstKey).toHaveProperty('models');
      expect(firstKey).toHaveProperty('modelDetails');

      // Find the active key instead of assuming first key is active
      const activeKey = result.data.find((key) => key.status === 'active');
      expect(activeKey).toBeDefined();
      expect(activeKey!.keyPreview).toContain('sk-test123');
      expect(activeKey!.permissions).toEqual(['models:read', 'completions:create']);
    });

    it('should handle expired key status correctly', async () => {
      const result = await apiKeysService.getApiKeys();
      const expiredKey = result.data.find((key) => key.id === 'key-2');

      expect(expiredKey?.status).toBe('expired');
    });

    it('should handle revoked key status correctly', async () => {
      const result = await apiKeysService.getApiKeys();
      const revokedKey = result.data.find((key) => key.id === 'key-3');

      expect(revokedKey?.status).toBe('revoked');
    });

    it('should handle API error responses', async () => {
      server.use(
        http.get('/api/v1/api-keys', () => {
          return HttpResponse.json(
            { message: 'Internal server error', statusCode: 500 },
            { status: 500 },
          );
        }),
      );

      await expect(apiKeysService.getApiKeys()).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      server.use(
        http.get('/api/v1/api-keys', () => {
          return HttpResponse.error();
        }),
      );

      await expect(apiKeysService.getApiKeys()).rejects.toThrow();
    });
  });

  describe('getApiKey', () => {
    it('should fetch single API key successfully', async () => {
      const keyId = 'key-1';
      const result = await apiKeysService.getApiKey(keyId);

      expect(result).toHaveProperty('id', keyId);
      expect(result).toHaveProperty('name', 'Test API Key');
      expect(result.status).toBe('active'); // key-1 should be active
    });

    it('should handle non-existent API key', async () => {
      await expect(apiKeysService.getApiKey('non-existent')).rejects.toThrow();
    });

    it('should map single key response correctly', async () => {
      const result = await apiKeysService.getApiKey('key-1');

      expect(result.fullKey).toBe('sk-test123456789abcdef');
      expect(result.keyPreview).toBe('sk-test123...');
      expect(result.description).toBe('Test API key for development');
    });
  });

  describe('createApiKey', () => {
    it('should create API key successfully', async () => {
      const request: CreateApiKeyRequest = {
        modelIds: ['gpt-4'],
        name: 'New Test Key',
        metadata: {
          description: 'A new test key',
          permissions: ['models:read'],
          rateLimit: 1000,
        },
      };

      const result = await apiKeysService.createApiKey(request);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('New Test Key');
      expect(result.status).toBe('active');
      expect(result.fullKey).toBe('sk-new123456789abcdef');
    });

    it('should handle creation with minimal data', async () => {
      const request: CreateApiKeyRequest = {
        modelIds: ['gpt-3.5-turbo'],
      };

      const result = await apiKeysService.createApiKey(request);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('New API Key'); // Default name
      expect(result.models).toEqual(['gpt-3.5-turbo']);
    });

    it('should handle creation with legacy subscriptionId', async () => {
      const request: CreateApiKeyRequest = {
        subscriptionId: 'sub-legacy',
        name: 'Legacy Key',
      };

      const result = await apiKeysService.createApiKey(request);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Legacy Key');
    });

    it('should handle creation with expiration date', async () => {
      const expirationDate = '2025-12-31T23:59:59.000Z';
      const request: CreateApiKeyRequest = {
        modelIds: ['gpt-4'],
        name: 'Expiring Key',
        expiresAt: expirationDate,
      };

      const result = await apiKeysService.createApiKey(request);

      expect(result.expiresAt).toBe(expirationDate);
    });

    it('should handle validation errors during creation', async () => {
      const request: CreateApiKeyRequest = {
        name: 'invalid-key', // This triggers error in mock
      };

      await expect(apiKeysService.createApiKey(request)).rejects.toThrow();
    });

    it('should handle server errors during creation', async () => {
      server.use(
        http.post('/api/v1/api-keys', () => {
          return HttpResponse.json({ message: 'Server error', statusCode: 500 }, { status: 500 });
        }),
      );

      const request: CreateApiKeyRequest = {
        name: 'Test Key',
      };

      await expect(apiKeysService.createApiKey(request)).rejects.toThrow();
    });

    it('should handle alternative response format with key field', async () => {
      server.use(
        http.post('/api/v1/api-keys', () => {
          return HttpResponse.json({
            id: 'alt-key-1',
            name: 'Alternative Key',
            keyPrefix: 'sk-alt',
            key: 'sk-alternative-key-123', // Alternative key format
            isActive: true,
            createdAt: new Date().toISOString(),
          });
        }),
      );

      const request: CreateApiKeyRequest = {
        name: 'Alternative Key',
      };

      const result = await apiKeysService.createApiKey(request);
      expect(result.fullKey).toBe('sk-alternative-key-123');
    });
  });

  describe('updateApiKey', () => {
    it('should update API key successfully', async () => {
      const keyId = 'key-1';
      const updates: Partial<CreateApiKeyRequest> = {
        name: 'Updated Key Name',
        metadata: {
          description: 'Updated description',
        },
      };

      const result = await apiKeysService.updateApiKey(keyId, updates);

      expect(result.id).toBe(keyId);
      expect(result.name).toBe('Updated Key Name');
    });

    it('should handle partial updates', async () => {
      const keyId = 'key-1';
      const updates: Partial<CreateApiKeyRequest> = {
        metadata: {
          rateLimit: 2000,
        },
      };

      const result = await apiKeysService.updateApiKey(keyId, updates);
      expect(result.id).toBe(keyId);
    });

    it('should handle update errors', async () => {
      const keyId = 'key-1';
      const updates = {
        name: 'error-update', // Triggers error in mock
      };

      await expect(apiKeysService.updateApiKey(keyId, updates)).rejects.toThrow();
    });

    it('should handle non-existent key update', async () => {
      const keyId = 'non-existent';
      const updates = { name: 'New Name' };

      await expect(apiKeysService.updateApiKey(keyId, updates)).rejects.toThrow();
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key successfully', async () => {
      const keyId = 'key-1';

      const result = await apiKeysService.deleteApiKey(keyId);
      expect(result).toBe(''); // Actually returns empty string from axios
    });

    it('should handle non-existent key deletion', async () => {
      const keyId = 'non-existent';

      await expect(apiKeysService.deleteApiKey(keyId)).rejects.toThrow();
    });

    it('should handle deletion errors', async () => {
      const keyId = 'error-delete';

      await expect(apiKeysService.deleteApiKey(keyId)).rejects.toThrow();
    });

    it('should handle server errors during deletion', async () => {
      server.use(
        http.delete('/api/v1/api-keys/:keyId', () => {
          return HttpResponse.json({ message: 'Server error', statusCode: 500 }, { status: 500 });
        }),
      );

      await expect(apiKeysService.deleteApiKey('any-key')).rejects.toThrow();
    });
  });

  describe('retrieveFullKey', () => {
    it('should retrieve full key successfully', async () => {
      const keyId = 'key-1';
      const result = await apiKeysService.retrieveFullKey(keyId);

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('keyType', 'LiteLLM');
      expect(result).toHaveProperty('retrievedAt');
      expect(result.key).toBe('sk-test123456789abcdef');
    });

    it('should handle non-existent key', async () => {
      const keyId = 'non-existent';
      await expect(apiKeysService.retrieveFullKey(keyId)).rejects.toThrow('API key not found');
    });

    it('should handle inactive key', async () => {
      const keyId = 'key-3'; // Revoked key
      await expect(apiKeysService.retrieveFullKey(keyId)).rejects.toThrow(
        'Cannot reveal inactive API key',
      );
    });

    it('should handle token too old error', async () => {
      const keyId = 'token-too-old';
      await expect(apiKeysService.retrieveFullKey(keyId)).rejects.toThrow(
        'Recent authentication required for this operation',
      );
    });

    it('should handle rate limiting error', async () => {
      const keyId = 'rate-limited';
      await expect(apiKeysService.retrieveFullKey(keyId)).rejects.toThrow(
        'Too many key retrieval attempts. Please wait 300 seconds',
      );
    });

    it('should handle 403 errors with custom messages', async () => {
      server.use(
        http.post('/api/v1/api-keys/:keyId/reveal', () => {
          return HttpResponse.json(
            { message: 'Custom access denied message', statusCode: 403 },
            { status: 403 },
          );
        }),
      );

      await expect(apiKeysService.retrieveFullKey('any-key')).rejects.toThrow(
        'Custom access denied message',
      );
    });

    it('should handle different error response formats', async () => {
      server.use(
        http.post('/api/v1/api-keys/:keyId/reveal', () => {
          return HttpResponse.json(
            { error: { message: 'Nested error message' }, statusCode: 500 },
            { status: 500 },
          );
        }),
      );

      await expect(apiKeysService.retrieveFullKey('any-key')).rejects.toThrow(
        'Nested error message',
      );
    });

    it('should handle error response with error field as string', async () => {
      server.use(
        http.post('/api/v1/api-keys/:keyId/reveal', () => {
          return HttpResponse.json(
            { error: 'Direct error string', statusCode: 400 },
            { status: 400 },
          );
        }),
      );

      await expect(apiKeysService.retrieveFullKey('any-key')).rejects.toThrow(
        'Direct error string',
      );
    });

    it('should handle generic errors without specific messages', async () => {
      server.use(
        http.post('/api/v1/api-keys/:keyId/reveal', () => {
          return HttpResponse.json({}, { status: 500 });
        }),
      );

      await expect(apiKeysService.retrieveFullKey('any-key')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      server.use(
        http.post('/api/v1/api-keys/:keyId/reveal', () => {
          return HttpResponse.error();
        }),
      );

      await expect(apiKeysService.retrieveFullKey('any-key')).rejects.toThrow();
    });

    it('should log error details for debugging', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.post('/api/v1/api-keys/:keyId/reveal', () => {
          return HttpResponse.json({ message: 'Debug error', statusCode: 500 }, { status: 500 });
        }),
      );

      await expect(apiKeysService.retrieveFullKey('debug-key')).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('API Key retrieval error:', expect.any(Object));

      consoleSpy.mockRestore();
    });
  });

  describe('mapBackendToFrontend', () => {
    it('should handle missing name gracefully', async () => {
      server.use(
        http.get('/api/v1/api-keys/no-name', () => {
          return HttpResponse.json({
            id: 'no-name',
            keyPrefix: 'sk-noname',
            isActive: true,
            createdAt: '2024-06-01T00:00:00.000Z',
          });
        }),
      );

      const result = await apiKeysService.getApiKey('no-name');
      expect(result.name).toBe('Unnamed Key');
    });

    it('should handle missing keyPrefix gracefully', async () => {
      server.use(
        http.get('/api/v1/api-keys/no-prefix', () => {
          return HttpResponse.json({
            id: 'no-prefix',
            name: 'No Prefix Key',
            isActive: true,
            createdAt: '2024-06-01T00:00:00.000Z',
          });
        }),
      );

      const result = await apiKeysService.getApiKey('no-prefix');
      expect(result.keyPreview).toBe('sk-****...');
    });

    it('should handle missing metadata gracefully', async () => {
      server.use(
        http.get('/api/v1/api-keys/no-metadata', () => {
          return HttpResponse.json({
            id: 'no-metadata',
            name: 'No Metadata Key',
            keyPrefix: 'sk-nometa',
            isActive: true,
            createdAt: '2024-06-01T00:00:00.000Z',
          });
        }),
      );

      const result = await apiKeysService.getApiKey('no-metadata');
      expect(result.permissions).toEqual(['read']);
      expect(result.description).toBeUndefined();
    });

    it('should handle both active and isActive status correctly', async () => {
      server.use(
        http.get('/api/v1/api-keys/inactive', () => {
          return HttpResponse.json({
            id: 'inactive',
            name: 'Inactive Key',
            keyPrefix: 'sk-inactive',
            isActive: false,
            createdAt: '2024-06-01T00:00:00.000Z',
          });
        }),
      );

      const result = await apiKeysService.getApiKey('inactive');
      expect(result.status).toBe('revoked');
    });

    it('should prioritize revokedAt over expiration', async () => {
      server.use(
        http.get('/api/v1/api-keys/revoked-and-expired', () => {
          return HttpResponse.json({
            id: 'revoked-and-expired',
            name: 'Revoked and Expired Key',
            keyPrefix: 'sk-revexp',
            isActive: true,
            expiresAt: '2020-01-01T00:00:00.000Z', // Expired
            revokedAt: '2024-01-01T00:00:00.000Z', // Revoked
            createdAt: '2024-06-01T00:00:00.000Z',
          });
        }),
      );

      const result = await apiKeysService.getApiKey('revoked-and-expired');
      expect(result.status).toBe('revoked'); // Should be revoked, not expired
    });
  });
});

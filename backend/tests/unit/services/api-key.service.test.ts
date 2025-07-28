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

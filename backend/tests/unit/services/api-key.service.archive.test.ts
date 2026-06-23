import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiKeyService } from '../../../src/services/api-key.service.js';
import { LiteLLMService } from '../../../src/services/litellm.service.js';
import type { FastifyInstance } from 'fastify';

describe('ApiKeyService - Archive', () => {
  let service: ApiKeyService;
  let mockFastify: Partial<FastifyInstance>;
  let mockLiteLLMService: Partial<LiteLLMService>;
  let mockDbUtils: any;
  let mockPgClient: any;

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

  describe('archiveApiKey', () => {
    it('should archive an active key and return the archived_at timestamp', async () => {
      const archivedAt = new Date('2026-06-23T12:00:00Z');
      mockDbUtils.queryOne
        .mockResolvedValueOnce({
          id: 'key-1',
          archived_at: null,
          lite_llm_key_value: 'sk-litellm-abc',
          is_active: true,
        })
        .mockResolvedValueOnce({ archived_at: archivedAt });
      mockDbUtils.query.mockResolvedValue({ rowCount: 1 });
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      const result = await service.archiveApiKey('key-1', 'user-1');

      expect(result.archivedAt).toEqual(archivedAt);
      expect(mockLiteLLMService.deleteKey).toHaveBeenCalledWith('sk-litellm-abc');
      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['user-1', 'API_KEY_ARCHIVED', 'API_KEY', 'key-1']),
      );
    });

    it('should throw not found for non-existent key', async () => {
      mockDbUtils.queryOne.mockResolvedValueOnce(null);

      await expect(service.archiveApiKey('key-999', 'user-1')).rejects.toThrow();
    });

    it('should throw validation error if key is already archived', async () => {
      mockDbUtils.queryOne.mockResolvedValueOnce({
        id: 'key-1',
        archived_at: new Date(),
        lite_llm_key_value: null,
        is_active: false,
      });

      await expect(service.archiveApiKey('key-1', 'user-1')).rejects.toThrow();
    });

    it('should succeed even if LiteLLM deletion fails', async () => {
      const archivedAt = new Date('2026-06-23T12:00:00Z');
      mockDbUtils.queryOne
        .mockResolvedValueOnce({
          id: 'key-1',
          archived_at: null,
          lite_llm_key_value: 'sk-litellm-abc',
          is_active: true,
        })
        .mockResolvedValueOnce({ archived_at: archivedAt });
      mockDbUtils.query.mockResolvedValue({ rowCount: 1 });
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      (mockLiteLLMService.deleteKey as any).mockRejectedValueOnce(new Error('LiteLLM down'));

      const result = await service.archiveApiKey('key-1', 'user-1');

      expect(result.archivedAt).toEqual(archivedAt);
      expect((mockFastify.log as any).warn).toHaveBeenCalled();
    });

    it('should skip LiteLLM deletion for inactive keys', async () => {
      const archivedAt = new Date('2026-06-23T12:00:00Z');
      mockDbUtils.queryOne
        .mockResolvedValueOnce({
          id: 'key-1',
          archived_at: null,
          lite_llm_key_value: 'sk-litellm-abc',
          is_active: false,
        })
        .mockResolvedValueOnce({ archived_at: archivedAt });
      mockDbUtils.query.mockResolvedValue({ rowCount: 1 });

      await service.archiveApiKey('key-1', 'user-1');

      expect(mockLiteLLMService.deleteKey).not.toHaveBeenCalled();
    });

    it('should bypass ownership check when adminUserId is provided', async () => {
      const archivedAt = new Date('2026-06-23T12:00:00Z');
      mockDbUtils.queryOne
        .mockResolvedValueOnce({
          id: 'key-1',
          archived_at: null,
          lite_llm_key_value: null,
          is_active: false,
        })
        .mockResolvedValueOnce({ archived_at: archivedAt });
      mockDbUtils.query.mockResolvedValue({ rowCount: 1 });

      await service.archiveApiKey('key-1', 'user-1', 'admin-1');

      // First queryOne should NOT include user_id filter
      const selectCall = mockDbUtils.queryOne.mock.calls[0];
      expect(selectCall[0]).not.toContain('user_id');
      expect(selectCall[1]).toEqual(['key-1']);

      // Audit log should reference admin
      const auditCall = mockDbUtils.query.mock.calls[0];
      expect(auditCall[1][0]).toBe('admin-1');
      expect(auditCall[1][4]).toContain('admin-1');
    });
  });

  describe('unarchiveApiKey', () => {
    it('should unarchive an archived key', async () => {
      mockDbUtils.queryOne.mockResolvedValueOnce({
        id: 'key-1',
        archived_at: new Date(),
      });
      mockDbUtils.query.mockResolvedValue({ rowCount: 1 });

      await service.unarchiveApiKey('key-1', 'user-1');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('archived_at = NULL'),
        ['key-1'],
      );
      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['user-1', 'API_KEY_UNARCHIVED', 'API_KEY', 'key-1']),
      );
    });

    it('should throw not found for non-existent key', async () => {
      mockDbUtils.queryOne.mockResolvedValueOnce(null);

      await expect(service.unarchiveApiKey('key-999', 'user-1')).rejects.toThrow();
    });

    it('should throw validation error if key is not archived', async () => {
      mockDbUtils.queryOne.mockResolvedValueOnce({
        id: 'key-1',
        archived_at: null,
      });

      await expect(service.unarchiveApiKey('key-1', 'user-1')).rejects.toThrow();
    });

    it('should bypass ownership check when adminUserId is provided', async () => {
      mockDbUtils.queryOne.mockResolvedValueOnce({
        id: 'key-1',
        archived_at: new Date(),
      });
      mockDbUtils.query.mockResolvedValue({ rowCount: 1 });

      await service.unarchiveApiKey('key-1', 'user-1', 'admin-1');

      const selectCall = mockDbUtils.queryOne.mock.calls[0];
      expect(selectCall[0]).not.toContain('user_id');
      expect(selectCall[1]).toEqual(['key-1']);
    });
  });

  describe('removeModelFromUserApiKeys - auto-archive', () => {
    it('should archive keys with zero remaining models in a transaction', async () => {
      mockDbUtils.queryMany.mockResolvedValueOnce([
        { id: 'key-1', lite_llm_key_value: 'sk-litellm-1' },
      ]);
      // Remaining models query (inside the loop) - no remaining models
      mockDbUtils.queryMany.mockResolvedValueOnce([]);
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      mockPgClient.query.mockResolvedValue({ rowCount: 1 });

      await service.removeModelFromUserApiKeys('user-1', 'model-1');

      // Should use withTransaction for the DELETE + archive UPDATE
      expect(mockFastify.dbUtils!.withTransaction).toHaveBeenCalled();

      // DELETE from api_key_models
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM api_key_models'),
        expect.any(Array),
      );
      // Archive UPDATE
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('archived_at = CURRENT_TIMESTAMP'),
        expect.any(Array),
      );
    });

    it('should not archive keys that still have other models', async () => {
      mockDbUtils.queryMany.mockResolvedValueOnce([
        { id: 'key-1', lite_llm_key_value: 'sk-litellm-1' },
      ]);
      // Remaining models - key still has another model
      mockDbUtils.queryMany.mockResolvedValueOnce([{ model_id: 'model-2' }]);
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      mockPgClient.query.mockResolvedValue({ rowCount: 1 });

      await service.removeModelFromUserApiKeys('user-1', 'model-1');

      // Transaction should still run (DELETE happens, but archive UPDATE won't match any rows)
      expect(mockFastify.dbUtils!.withTransaction).toHaveBeenCalled();
    });
  });

  describe('getUserApiKeys - archive filtering', () => {
    it('should exclude archived keys by default', async () => {
      mockDbUtils.queryMany.mockResolvedValueOnce([]);
      mockDbUtils.queryOne.mockResolvedValueOnce({ count: '0' });
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      await service.getUserApiKeys('user-1', {});

      const queryCall = mockDbUtils.queryMany.mock.calls[0][0];
      expect(queryCall).toContain('archived_at IS NULL');
    });

    it('should include archived keys when includeArchived is true', async () => {
      mockDbUtils.queryMany.mockResolvedValueOnce([]);
      mockDbUtils.queryOne.mockResolvedValueOnce({ count: '0' });
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      await service.getUserApiKeys('user-1', { includeArchived: true });

      const queryCall = mockDbUtils.queryMany.mock.calls[0][0];
      expect(queryCall).not.toContain('archived_at IS NULL');
    });
  });
});

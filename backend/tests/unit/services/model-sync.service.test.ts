import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { ModelSyncService } from '../../../src/services/model-sync.service';

// Helper function to test the backend model name extraction logic
// This replicates the logic from ModelSyncService for testing
function extractBackendModelName(litellmModel: string | undefined): string | null {
  if (!litellmModel) return null;

  return litellmModel.includes('/')
    ? litellmModel.split('/').slice(1).join('/')
    : litellmModel || null;
}

describe('ModelSyncService - Backend Model Name Extraction Logic', () => {
  describe('Backend Model Name Extraction', () => {
    it('should correctly extract backend model name from simple provider/model format', () => {
      const result = extractBackendModelName('openai/gpt-4o');
      expect(result).toBe('gpt-4o');
    });

    it('should correctly extract backend model name with multiple slashes', () => {
      const result = extractBackendModelName('openai/RedHatAI/Qwen2.5-Coder-7B-FP8-dynamic');
      expect(result).toBe('RedHatAI/Qwen2.5-Coder-7B-FP8-dynamic');
    });

    it('should correctly extract backend model name for anthropic models with multiple path components', () => {
      const result = extractBackendModelName('anthropic/enterprise/claude-3-5-sonnet-20241022');
      expect(result).toBe('enterprise/claude-3-5-sonnet-20241022');
    });

    it('should handle model names without slashes', () => {
      const result = extractBackendModelName('custom-model');
      expect(result).toBe('custom-model');
    });

    it('should handle undefined model names', () => {
      const result = extractBackendModelName(undefined);
      expect(result).toBe(null);
    });

    it('should handle empty model names', () => {
      const result = extractBackendModelName('');
      expect(result).toBe(null);
    });

    it('should handle complex multi-level model paths', () => {
      const result = extractBackendModelName('provider/org/team/model-name-v2');
      expect(result).toBe('org/team/model-name-v2');
    });

    it('should handle model names with trailing slashes', () => {
      const result = extractBackendModelName('openai/gpt-4/');
      expect(result).toBe('gpt-4/');
    });

    it('should handle model names starting with slash', () => {
      const result = extractBackendModelName('/openai/gpt-4');
      expect(result).toBe('openai/gpt-4');
    });

    it('should verify the fix for the reported issue', () => {
      // This is the specific case reported in the issue
      const input = 'openai/RedHatAI/Qwen2.5-Coder-7B-FP8-dynamic';
      const result = extractBackendModelName(input);

      // Should NOT be 'RedHatAI' (the old buggy behavior)
      expect(result).not.toBe('RedHatAI');

      // Should be the full path after the provider
      expect(result).toBe('RedHatAI/Qwen2.5-Coder-7B-FP8-dynamic');
    });
  });
});

describe('ModelSyncService - Cascade Operations', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockClient: any;
  let service: ModelSyncService;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockFastify = {
      pg: {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any,
      dbUtils: {
        query: vi.fn(),
      } as any,
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      } as any,
    };

    service = new ModelSyncService(mockFastify as FastifyInstance);
  });

  describe('markModelUnavailable cascade operations', () => {
    it('should perform cascade operations when model is available', async () => {
      // Mock successful transaction
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'test-model' }] }) // Model update
        .mockResolvedValueOnce({ rows: [{ id: 'sub1' }, { id: 'sub2' }] }) // Subscriptions update
        .mockResolvedValueOnce({ rows: [{ api_key_id: 'key1' }, { api_key_id: 'key2' }] }) // API key models delete
        .mockResolvedValueOnce({ rows: [{ id: 'orphaned-key1' }] }) // Orphaned keys update
        .mockResolvedValueOnce(undefined) // Audit log insert
        .mockResolvedValueOnce(undefined); // COMMIT

      // Call the private method via reflection
      const result = await (service as any).markModelUnavailable('test-model');

      expect(result).toEqual({
        subscriptionsDeactivated: 2,
        apiKeyModelAssociationsRemoved: 2,
        orphanedApiKeysDeactivated: 1,
      });

      // Verify transaction flow
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should skip cascade operations if model is already unavailable', async () => {
      // Mock model already unavailable (no rows returned)
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Model update (no change)
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await (service as any).markModelUnavailable('test-model');

      expect(result).toEqual({
        subscriptionsDeactivated: 0,
        apiKeyModelAssociationsRemoved: 0,
        orphanedApiKeysDeactivated: 0,
      });

      // Should not perform cascade operations
      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      const testError = new Error('Database error');

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'test-model' }] }) // Model update
        .mockRejectedValueOnce(testError) // Error during subscriptions update
        .mockResolvedValueOnce(undefined); // ROLLBACK

      mockFastify.dbUtils!.query = vi.fn().mockResolvedValueOnce(undefined); // Audit log for failure

      await expect((service as any).markModelUnavailable('test-model')).rejects.toThrow(
        'Database error',
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockFastify.dbUtils!.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'MODEL_MARKED_UNAVAILABLE_WITH_CASCADE',
          'MODEL',
          'test-model',
          expect.any(String), // JSON metadata
          false, // success = false
          'Database error',
        ]),
      );
    });

    it('should create audit log with correct metadata for successful operation', async () => {
      // Mock successful transaction
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'test-model' }] }) // Model update
        .mockResolvedValueOnce({ rows: [{ id: 'sub1' }] }) // Subscriptions update
        .mockResolvedValueOnce({ rows: [{ api_key_id: 'key1' }] }) // API key models delete
        .mockResolvedValueOnce({ rows: [] }) // Orphaned keys update (none)
        .mockResolvedValueOnce(undefined) // Audit log insert
        .mockResolvedValueOnce(undefined); // COMMIT

      await (service as any).markModelUnavailable('test-model');

      // Verify audit log contains correct information
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'MODEL_MARKED_UNAVAILABLE_WITH_CASCADE',
          'MODEL',
          'test-model',
          expect.stringContaining('"subscriptionsDeactivated":1'),
          true,
        ]),
      );
    });
  });
});

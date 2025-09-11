import { describe, it, expect } from 'vitest';

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

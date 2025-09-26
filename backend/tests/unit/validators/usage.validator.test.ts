/**
 * Comprehensive unit tests for usage validator functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateDateRange,
  sanitizeApiKeyId,
  verifyApiKeyOwnership,
  validateUsageMetricsQuery,
  validateUsageSummaryQuery,
  validateUsageExportQuery,
} from '../../../src/validators/usage.validator.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../../src/types';

describe('Usage Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current date to 2024-06-15
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validateDateRange', () => {
    it('should return default 30-day range when no dates provided', () => {
      const result = validateDateRange();

      expect(result.isValid).toBe(true);
      expect(result.parsedStartDate).toBeDefined();
      expect(result.parsedEndDate).toBeDefined();

      const daysDiff = Math.ceil(
        (result.parsedEndDate!.getTime() - result.parsedStartDate!.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(30);
    });

    it('should validate valid date range', () => {
      const result = validateDateRange('2024-06-01', '2024-06-10');

      expect(result.isValid).toBe(true);
      expect(result.parsedStartDate).toBeDefined();
      expect(result.parsedEndDate).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid start date format', () => {
      const result = validateDateRange('invalid-date', '2024-06-10');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid start date format');
    });

    it('should reject invalid end date format', () => {
      const result = validateDateRange('2024-06-01', 'not-a-date');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid end date format');
    });

    it('should reject start date in the future', () => {
      const result = validateDateRange('2024-06-20', '2024-06-25');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Start date cannot be in the future');
    });

    it('should reject end date in the future', () => {
      const result = validateDateRange('2024-06-01', '2024-06-20');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('End date cannot be in the future');
    });

    it('should reject start date after end date', () => {
      const result = validateDateRange('2024-06-10', '2024-06-01');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Start date must be before end date');
    });

    it('should reject dates before minimum date (2024-01-01)', () => {
      const result = validateDateRange('2023-12-01', '2024-01-15');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be before 2024-01-01');
    });

    it('should reject date range exceeding 90 days', () => {
      const result = validateDateRange('2024-01-01', '2024-04-15');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Date range cannot exceed 90 days');
    });

    it('should accept date range at exactly 90 days', () => {
      const result = validateDateRange('2024-03-01', '2024-05-30');

      expect(result.isValid).toBe(true);
    });

    it('should create 7-day forward range when only start date provided', () => {
      const result = validateDateRange('2024-06-01');

      expect(result.isValid).toBe(true);
      expect(result.parsedStartDate).toBeDefined();
      expect(result.parsedEndDate).toBeDefined();

      const daysDiff = Math.ceil(
        (result.parsedEndDate!.getTime() - result.parsedStartDate!.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(7);
    });

    it('should create 7-day backward range when only end date provided', () => {
      const result = validateDateRange(undefined, '2024-06-10');

      expect(result.isValid).toBe(true);
      expect(result.parsedStartDate).toBeDefined();
      expect(result.parsedEndDate).toBeDefined();

      const daysDiff = Math.ceil(
        (result.parsedEndDate!.getTime() - result.parsedStartDate!.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBe(7);
    });

    it('should cap end date to today when start date + 7 days exceeds current date', () => {
      const result = validateDateRange('2024-06-10');

      expect(result.isValid).toBe(true);
      // End date should be capped to today (2024-06-15), not 2024-06-17
      const endDate = result.parsedEndDate!;
      expect(endDate.getDate()).toBeLessThanOrEqual(15);
    });
  });

  describe('sanitizeApiKeyId', () => {
    it('should return undefined for undefined input', () => {
      const result = sanitizeApiKeyId(undefined);
      expect(result).toBeUndefined();
    });

    it('should return valid UUID unchanged', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const result = sanitizeApiKeyId(validUUID);
      expect(result).toBe(validUUID);
    });

    it('should convert uppercase UUID to lowercase', () => {
      const uppercaseUUID = '123E4567-E89B-12D3-A456-426614174000';
      const result = sanitizeApiKeyId(uppercaseUUID);
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should remove special characters', () => {
      const dirtyUUID = '123e4567-e89b-12d3-a456-426614174000!@#';
      const result = sanitizeApiKeyId(dirtyUUID);
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return undefined for invalid UUID format', () => {
      const invalidUUID = 'not-a-uuid';
      const result = sanitizeApiKeyId(invalidUUID);
      expect(result).toBeUndefined();
    });

    it('should return undefined for malformed UUID with wrong segment lengths', () => {
      const malformedUUID = '123-456-789';
      const result = sanitizeApiKeyId(malformedUUID);
      expect(result).toBeUndefined();
    });

    it('should accept UUID with mixed case and sanitize correctly', () => {
      const mixedCaseUUID = 'AbC123e4-5678-12d3-A456-426614174000';
      const result = sanitizeApiKeyId(mixedCaseUUID);
      expect(result).toBe('abc123e4-5678-12d3-a456-426614174000');
    });
  });

  describe('verifyApiKeyOwnership', () => {
    it('should return true when API key belongs to user', async () => {
      const mockFastify = {
        dbUtils: {
          queryOne: vi.fn().mockResolvedValue({ id: 'key-123' }),
        },
        log: {
          error: vi.fn(),
        },
      };

      const result = await verifyApiKeyOwnership(mockFastify as any, 'user-123', 'key-123');

      expect(result).toBe(true);
      expect(mockFastify.dbUtils.queryOne).toHaveBeenCalledWith(
        'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
        ['key-123', 'user-123'],
      );
    });

    it('should return false when API key does not belong to user', async () => {
      const mockFastify = {
        dbUtils: {
          queryOne: vi.fn().mockResolvedValue(null),
        },
        log: {
          error: vi.fn(),
        },
      };

      const result = await verifyApiKeyOwnership(mockFastify as any, 'user-123', 'key-456');

      expect(result).toBe(false);
    });

    it('should return false and log error on database error', async () => {
      const mockError = new Error('Database connection failed');
      const mockFastify = {
        dbUtils: {
          queryOne: vi.fn().mockRejectedValue(mockError),
        },
        log: {
          error: vi.fn(),
        },
      };

      const result = await verifyApiKeyOwnership(mockFastify as any, 'user-123', 'key-123');

      expect(result).toBe(false);
      expect(mockFastify.log.error).toHaveBeenCalledWith(
        mockError,
        'Failed to verify API key ownership',
      );
    });
  });

  describe('validateUsageMetricsQuery', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        createError: vi.fn((code: number, message: string) => new Error(message)),
        dbUtils: {
          queryOne: vi.fn(),
        },
        log: {
          error: vi.fn(),
        },
      };

      mockRequest = {
        query: {},
        server: mockServer,
      } as Partial<FastifyRequest & AuthenticatedRequest>;

      (mockRequest as AuthenticatedRequest).user = {
        userId: 'user-123',
        username: 'testuser',
        roles: ['user'],
      };

      mockReply = {};
    });

    it('should validate query with valid date range', async () => {
      mockRequest.query = {
        startDate: '2024-06-01',
        endDate: '2024-06-10',
      };

      await expect(
        validateUsageMetricsQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();

      expect(mockRequest.query).toHaveProperty('startDate');
      expect(mockRequest.query).toHaveProperty('endDate');
    });

    it('should throw error for invalid date range', async () => {
      mockRequest.query = {
        startDate: '2024-06-10',
        endDate: '2024-06-01',
      };

      await expect(
        validateUsageMetricsQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should sanitize and verify API key ownership', async () => {
      const validApiKey = '123e4567-e89b-12d3-a456-426614174000';
      mockRequest.query = {
        apiKeyId: validApiKey,
      };

      mockServer.dbUtils.queryOne.mockResolvedValue({ id: validApiKey });

      await expect(
        validateUsageMetricsQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();

      expect(mockServer.dbUtils.queryOne).toHaveBeenCalledWith(
        'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
        [validApiKey, 'user-123'],
      );
    });

    it('should throw error for invalid API key format', async () => {
      mockRequest.query = {
        apiKeyId: 'invalid-key',
      };

      await expect(
        validateUsageMetricsQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid API key ID format');
    });

    it('should throw error when API key does not belong to user', async () => {
      const validApiKey = '123e4567-e89b-12d3-a456-426614174000';
      mockRequest.query = {
        apiKeyId: validApiKey,
      };

      mockServer.dbUtils.queryOne.mockResolvedValue(null);

      await expect(
        validateUsageMetricsQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('API key not found or access denied');
    });

    it('should sanitize model ID parameter', async () => {
      mockRequest.query = {
        modelId: '  gpt-4  ',
      };

      await expect(
        validateUsageMetricsQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();

      expect((mockRequest.query as any).modelId).toBe('gpt-4');
    });

    it('should throw error for invalid model ID (too long)', async () => {
      mockRequest.query = {
        modelId: 'a'.repeat(256),
      };

      await expect(
        validateUsageMetricsQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid model ID');
    });

    it('should throw error for empty model ID', async () => {
      mockRequest.query = {
        modelId: '   ',
      };

      await expect(
        validateUsageMetricsQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid model ID');
    });
  });

  describe('validateUsageSummaryQuery', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        createError: vi.fn((code: number, message: string) => new Error(message)),
      };

      mockRequest = {
        query: {},
        server: mockServer,
      } as Partial<FastifyRequest>;

      mockReply = {};
    });

    it('should require start and end dates', async () => {
      mockRequest.query = {};

      await expect(
        validateUsageSummaryQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Start date and end date are required');
    });

    it('should validate query with valid dates and granularity', async () => {
      mockRequest.query = {
        startDate: '2024-06-01',
        endDate: '2024-06-10',
        granularity: 'day',
      };

      await expect(
        validateUsageSummaryQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();
    });

    it('should accept valid granularity values', async () => {
      const validGranularities = ['hour', 'day', 'week', 'month'];

      for (const granularity of validGranularities) {
        mockRequest.query = {
          startDate: '2024-06-01',
          endDate: '2024-06-10',
          granularity,
        };

        await expect(
          validateUsageSummaryQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).resolves.not.toThrow();
      }
    });

    it('should reject invalid granularity value', async () => {
      mockRequest.query = {
        startDate: '2024-06-01',
        endDate: '2024-06-10',
        granularity: 'invalid',
      };

      await expect(
        validateUsageSummaryQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid granularity value');
    });

    it('should sanitize model ID', async () => {
      mockRequest.query = {
        startDate: '2024-06-01',
        endDate: '2024-06-10',
        modelId: '  gpt-4  ',
      };

      await expect(
        validateUsageSummaryQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();

      expect((mockRequest.query as any).modelId).toBe('gpt-4');
    });

    it('should sanitize subscription ID', async () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      mockRequest.query = {
        startDate: '2024-06-01',
        endDate: '2024-06-10',
        subscriptionId: validUUID,
      };

      await expect(
        validateUsageSummaryQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();
    });

    it('should throw error for invalid subscription ID format', async () => {
      mockRequest.query = {
        startDate: '2024-06-01',
        endDate: '2024-06-10',
        subscriptionId: 'invalid-uuid',
      };

      await expect(
        validateUsageSummaryQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid subscription ID format');
    });
  });

  describe('validateUsageExportQuery', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        createError: vi.fn((code: number, message: string) => new Error(message)),
        dbUtils: {
          queryOne: vi.fn(),
        },
        log: {
          error: vi.fn(),
        },
      };

      mockRequest = {
        query: {},
        server: mockServer,
      } as Partial<FastifyRequest & AuthenticatedRequest>;

      (mockRequest as AuthenticatedRequest).user = {
        userId: 'user-123',
        username: 'testuser',
        roles: ['user'],
      };

      mockReply = {};
    });

    it('should validate query with optional dates', async () => {
      mockRequest.query = {};

      await expect(
        validateUsageExportQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();
    });

    it('should accept valid export format values', async () => {
      const validFormats = ['csv', 'json'];

      for (const format of validFormats) {
        mockRequest.query = { format };

        await expect(
          validateUsageExportQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
        ).resolves.not.toThrow();
      }
    });

    it('should reject invalid export format', async () => {
      mockRequest.query = {
        format: 'xml',
      };

      await expect(
        validateUsageExportQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid export format. Must be csv or json');
    });

    it('should validate and verify API key ownership', async () => {
      const validApiKey = '123e4567-e89b-12d3-a456-426614174000';
      mockRequest.query = {
        apiKeyId: validApiKey,
      };

      mockServer.dbUtils.queryOne.mockResolvedValue({ id: validApiKey });

      await expect(
        validateUsageExportQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();

      expect(mockServer.dbUtils.queryOne).toHaveBeenCalledWith(
        'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
        [validApiKey, 'user-123'],
      );
    });

    it('should throw error for invalid API key format in export', async () => {
      mockRequest.query = {
        apiKeyId: 'not-a-uuid',
      };

      await expect(
        validateUsageExportQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid API key ID format');
    });

    it('should sanitize model ID and subscription ID', async () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      mockRequest.query = {
        modelId: '  gpt-4  ',
        subscriptionId: validUUID,
      };

      await expect(
        validateUsageExportQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).resolves.not.toThrow();

      expect((mockRequest.query as any).modelId).toBe('gpt-4');
      expect((mockRequest.query as any).subscriptionId).toBe(validUUID);
    });

    it('should throw error for invalid subscription ID in export', async () => {
      mockRequest.query = {
        subscriptionId: 'invalid-format',
      };

      await expect(
        validateUsageExportQuery(mockRequest as FastifyRequest, mockReply as FastifyReply),
      ).rejects.toThrow('Invalid subscription ID format');
    });
  });
});

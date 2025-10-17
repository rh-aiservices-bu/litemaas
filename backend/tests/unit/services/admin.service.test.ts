import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminService } from '../../../src/services/admin.service.js';
import type { FastifyInstance } from 'fastify';
import type { BulkUpdateUserLimitsRequest } from '../../../src/services/admin.service.js';

describe('AdminService', () => {
  let service: AdminService;
  let mockFastify: Partial<FastifyInstance>;
  let mockPgClient: any;

  const mockUsers = [
    {
      id: 'user-1',
      username: 'user1',
      email: 'user1@example.com',
      max_budget: 1000,
      tpm_limit: 10000,
      rpm_limit: 100,
    },
    {
      id: 'user-2',
      username: 'user2',
      email: 'user2@example.com',
      max_budget: 500,
      tpm_limit: 5000,
      rpm_limit: 50,
    },
    {
      id: 'user-3',
      username: 'user3',
      email: 'user3@example.com',
      max_budget: 2000,
      tpm_limit: 20000,
      rpm_limit: 200,
    },
  ];

  beforeEach(() => {
    mockPgClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockFastify = {
      pg: {
        connect: vi.fn().mockResolvedValue(mockPgClient),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as Partial<FastifyInstance>;

    // Mock environment variables for LiteLLMService
    process.env.LITELLM_API_URL = 'http://localhost:8000';
    process.env.LITELLM_API_KEY = 'test-key';
    process.env.LITELLM_ENABLE_MOCKING = 'false';

    service = new AdminService(mockFastify as FastifyInstance);
  });

  describe('bulkUpdateUserLimits', () => {
    describe('Validation', () => {
      it('should throw validation error when no limits provided', async () => {
        const emptyUpdates: BulkUpdateUserLimitsRequest = {};

        await expect(service.bulkUpdateUserLimits(emptyUpdates)).rejects.toThrow(
          /At least one limit value must be provided/i,
        );
      });

      it('should accept maxBudget only', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result).toBeDefined();
        expect(result.totalUsers).toBeGreaterThan(0);
      });

      it('should accept tpmLimit only', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

        const updates: BulkUpdateUserLimitsRequest = {
          tpmLimit: 50000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result).toBeDefined();
      });

      it('should accept rpmLimit only', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

        const updates: BulkUpdateUserLimitsRequest = {
          rpmLimit: 500,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result).toBeDefined();
      });

      it('should accept combination of limits', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
          tpmLimit: 50000,
          rpmLimit: 500,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result).toBeDefined();
      });
    });

    describe('Mock Mode', () => {
      it('should return mock response when mock data enabled', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result).toBeDefined();
        expect(result.totalUsers).toBe(25);
        expect(result.successCount).toBe(23);
        expect(result.failedCount).toBe(2);
        expect(result.errors).toHaveLength(2);
        expect(result.processedAt).toBeDefined();
      });
    });

    describe('Database Operations', () => {
      it('should query all active users', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: mockUsers }) // SELECT users
          .mockResolvedValueOnce(undefined) // UPDATE user 1
          .mockResolvedValueOnce(undefined) // UPDATE user 2
          .mockResolvedValueOnce(undefined) // UPDATE user 3
          .mockResolvedValueOnce(undefined); // COMMIT

        // Mock LiteLLM service updateUser
        const mockLiteLLMService = service['litellmService'];
        vi.spyOn(mockLiteLLMService, 'updateUser').mockResolvedValue(undefined);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(mockPgClient.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT id, username, email'),
        );
        expect(result.totalUsers).toBe(3);
      });

      it('should update database records with provided values', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockUsers[0]] }) // SELECT users
          .mockResolvedValueOnce(undefined) // UPDATE
          .mockResolvedValueOnce(undefined); // COMMIT

        const mockLiteLLMService = service['litellmService'];
        vi.spyOn(mockLiteLLMService, 'updateUser').mockResolvedValue(undefined);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
          tpmLimit: 50000,
        };

        await service.bulkUpdateUserLimits(updates);

        expect(mockPgClient.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          expect.arrayContaining(['user-1', 5000, 50000, undefined]),
        );
      });

      it('should use COALESCE to preserve null values', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: [mockUsers[0]] })
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined);

        const mockLiteLLMService = service['litellmService'];
        vi.spyOn(mockLiteLLMService, 'updateUser').mockResolvedValue(undefined);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000, // Only update maxBudget
        };

        await service.bulkUpdateUserLimits(updates);

        expect(mockPgClient.query).toHaveBeenCalledWith(
          expect.stringContaining('COALESCE'),
          expect.anything(),
        );
      });

      it('should handle empty user list', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SELECT users (empty)
          .mockResolvedValueOnce(undefined); // ROLLBACK

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result.totalUsers).toBe(0);
        expect(result.successCount).toBe(0);
        expect(mockPgClient.query).toHaveBeenCalledWith('ROLLBACK');
      });

      it('should commit transaction on success', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockUsers[0]] })
          .mockResolvedValueOnce(undefined) // UPDATE
          .mockResolvedValueOnce(undefined); // COMMIT

        const mockLiteLLMService = service['litellmService'];
        vi.spyOn(mockLiteLLMService, 'updateUser').mockResolvedValue(undefined);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        await service.bulkUpdateUserLimits(updates);

        expect(mockPgClient.query).toHaveBeenCalledWith('COMMIT');
      });

      it('should rollback transaction on error', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        const dbError = new Error('Database error');

        mockPgClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(dbError); // SELECT fails

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        await expect(service.bulkUpdateUserLimits(updates)).rejects.toThrow('Database error');
        expect(mockPgClient.query).toHaveBeenCalledWith('ROLLBACK');
      });

      it('should always release client', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: [mockUsers[0]] })
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined);

        const mockLiteLLMService = service['litellmService'];
        vi.spyOn(mockLiteLLMService, 'updateUser').mockResolvedValue(undefined);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        await service.bulkUpdateUserLimits(updates);

        expect(mockPgClient.release).toHaveBeenCalled();
      });
    });

    describe('LiteLLM Integration', () => {
      it('should update LiteLLM for each user', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: mockUsers })
          .mockResolvedValue(undefined); // All subsequent queries

        const mockLiteLLMService = service['litellmService'];
        const updateUserSpy = vi
          .spyOn(mockLiteLLMService, 'updateUser')
          .mockResolvedValue(undefined);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        await service.bulkUpdateUserLimits(updates);

        expect(updateUserSpy).toHaveBeenCalledTimes(3);
        expect(updateUserSpy).toHaveBeenCalledWith('user-1', { max_budget: 5000 });
        expect(updateUserSpy).toHaveBeenCalledWith('user-2', { max_budget: 5000 });
        expect(updateUserSpy).toHaveBeenCalledWith('user-3', { max_budget: 5000 });
      });

      it('should include all provided limits in LiteLLM update', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: [mockUsers[0]] })
          .mockResolvedValue(undefined);

        const mockLiteLLMService = service['litellmService'];
        const updateUserSpy = vi
          .spyOn(mockLiteLLMService, 'updateUser')
          .mockResolvedValue(undefined);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
          tpmLimit: 50000,
          rpmLimit: 500,
        };

        await service.bulkUpdateUserLimits(updates);

        expect(updateUserSpy).toHaveBeenCalledWith('user-1', {
          max_budget: 5000,
          tpm_limit: 50000,
          rpm_limit: 500,
        });
      });

      it('should handle LiteLLM API failures gracefully', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: [mockUsers[0]] })
          .mockResolvedValue(undefined);

        const mockLiteLLMService = service['litellmService'];
        vi.spyOn(mockLiteLLMService, 'updateUser').mockRejectedValue(
          new Error('LiteLLM API timeout'),
        );

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result.successCount).toBe(0);
        expect(result.failedCount).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain('LiteLLM update failed');
      });

      it('should track partial failures correctly', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce({ rows: mockUsers })
          .mockResolvedValue(undefined);

        const mockLiteLLMService = service['litellmService'];
        const updateUserSpy = vi.spyOn(mockLiteLLMService, 'updateUser');
        updateUserSpy
          .mockResolvedValueOnce(undefined) // user-1 succeeds
          .mockRejectedValueOnce(new Error('API error')) // user-2 fails
          .mockResolvedValueOnce(undefined); // user-3 succeeds

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result.totalUsers).toBe(3);
        expect(result.successCount).toBe(2);
        expect(result.failedCount).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].userId).toBe('user-2');
      });
    });

    describe('Error Handling', () => {
      it('should track database update failures', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockUsers[0]] }) // SELECT
          .mockRejectedValueOnce(new Error('Database constraint violation')) // UPDATE fails
          .mockResolvedValueOnce(undefined); // COMMIT

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result.failedCount).toBe(1);
        expect(result.errors[0].error).toContain('Database update failed');
      });

      it('should continue processing after individual failures', async () => {
        vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
        mockPgClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: mockUsers }) // SELECT
          .mockRejectedValueOnce(new Error('DB error')) // user-1 fails
          .mockResolvedValueOnce(undefined) // user-2 succeeds
          .mockResolvedValueOnce(undefined) // user-3 succeeds
          .mockResolvedValueOnce(undefined); // COMMIT

        const mockLiteLLMService = service['litellmService'];
        vi.spyOn(mockLiteLLMService, 'updateUser').mockResolvedValue(undefined);

        const updates: BulkUpdateUserLimitsRequest = {
          maxBudget: 5000,
        };

        const result = await service.bulkUpdateUserLimits(updates);

        expect(result.totalUsers).toBe(3);
        expect(result.successCount).toBe(2); // user-2 and user-3 succeeded
        expect(result.failedCount).toBe(1); // user-1 failed
      });
    });
  });

  describe('getSystemStats', () => {
    it('should return mock stats when mock data enabled', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getSystemStats();

      expect(result).toBeDefined();
      expect(result.totalUsers).toBe(150);
      expect(result.activeUsers).toBe(142);
      expect(result.totalApiKeys).toBe(78);
      expect(result.activeApiKeys).toBe(65);
      expect(result.totalModels).toBe(25);
      expect(result.availableModels).toBe(23);
    });

    it('should query database for system statistics', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockPgClient.query.mockResolvedValue({
        rows: [
          {
            total_users: 100,
            active_users: 95,
            total_api_keys: 50,
            active_api_keys: 45,
            total_models: 20,
            available_models: 18,
          },
        ],
      });

      const result = await service.getSystemStats();

      expect(mockPgClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(result.totalUsers).toBe(100);
      expect(result.activeUsers).toBe(95);
      expect(result.totalApiKeys).toBe(50);
      expect(result.activeApiKeys).toBe(45);
      expect(result.totalModels).toBe(20);
      expect(result.availableModels).toBe(18);
    });

    it('should count users correctly', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockPgClient.query.mockResolvedValue({
        rows: [
          {
            total_users: '250',
            active_users: '240',
            total_api_keys: '0',
            active_api_keys: '0',
            total_models: '0',
            available_models: '0',
          },
        ],
      });

      const result = await service.getSystemStats();

      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) FROM users'),
      );
      expect(result.totalUsers).toBe(250);
      expect(result.activeUsers).toBe(240);
    });

    it('should count API keys correctly', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockPgClient.query.mockResolvedValue({
        rows: [
          {
            total_users: '0',
            active_users: '0',
            total_api_keys: '120',
            active_api_keys: '100',
            total_models: '0',
            available_models: '0',
          },
        ],
      });

      const result = await service.getSystemStats();

      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) FROM api_keys'),
      );
      expect(result.totalApiKeys).toBe(120);
      expect(result.activeApiKeys).toBe(100);
    });

    it('should count models correctly', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockPgClient.query.mockResolvedValue({
        rows: [
          {
            total_users: '0',
            active_users: '0',
            total_api_keys: '0',
            active_api_keys: '0',
            total_models: '30',
            available_models: '28',
          },
        ],
      });

      const result = await service.getSystemStats();

      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) FROM models'),
      );
      expect(result.totalModels).toBe(30);
      expect(result.availableModels).toBe(28);
    });

    it('should always release client', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockPgClient.query.mockResolvedValue({
        rows: [
          {
            total_users: 0,
            active_users: 0,
            total_api_keys: 0,
            active_api_keys: 0,
            total_models: 0,
            available_models: 0,
          },
        ],
      });

      await service.getSystemStats();

      expect(mockPgClient.release).toHaveBeenCalled();
    });
  });
});

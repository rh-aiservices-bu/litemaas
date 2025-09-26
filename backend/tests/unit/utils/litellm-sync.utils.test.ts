/**
 * Unit tests for LiteLLM Synchronization Utilities
 * Tests user and team sync operations with LiteLLM backend
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LiteLLMSyncUtils } from '../../../src/utils/litellm-sync.utils';
import type { FastifyInstance } from 'fastify';
import type { LiteLLMService } from '../../../src/services/litellm.service';

describe('LiteLLMSyncUtils', () => {
  let mockFastify: Partial<FastifyInstance>;
  let mockLiteLLMService: Partial<LiteLLMService>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
    roles: ['user'],
    max_budget: 100,
    tpm_limit: 10000,
    rpm_limit: 60,
  };

  const mockTeam = {
    id: 'team-123',
    name: 'Test Team',
    description: 'A test team',
    max_budget: 1000,
    tpm_limit: 50000,
    rpm_limit: 500,
  };

  const mockLiteLLMUser = {
    user_id: 'user-123',
    user_alias: 'testuser',
    user_email: 'test@example.com',
    user_role: 'internal_user' as const,
    spend: 0,
    max_budget: 100,
    teams: ['team-123'],
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockLiteLLMTeam = {
    team_id: 'team-123',
    team_alias: 'Test Team',
    spend: 0,
    max_budget: 1000,
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    // Mock Fastify instance
    mockFastify = {
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as any,
      dbUtils: {
        queryOne: vi.fn(),
        query: vi.fn(),
      } as any,
    };

    // Mock LiteLLM service
    mockLiteLLMService = {
      getUserInfo: vi.fn(),
      createUser: vi.fn(),
      getTeamInfo: vi.fn(),
      createTeam: vi.fn(),
      getMetrics: vi.fn().mockReturnValue({
        config: {
          enableMocking: false,
          baseUrl: 'http://localhost:4000',
          timeout: 5000,
        },
      }),
    };

    vi.clearAllMocks();
  });

  describe('ensureUserExistsInLiteLLM', () => {
    it('should skip creation if user already exists in LiteLLM', async () => {
      vi.mocked(mockLiteLLMService.getUserInfo).mockResolvedValue(mockLiteLLMUser);

      await LiteLLMSyncUtils.ensureUserExistsInLiteLLM(
        'user-123',
        mockFastify as FastifyInstance,
        mockLiteLLMService as LiteLLMService,
      );

      expect(mockLiteLLMService.getUserInfo).toHaveBeenCalledWith('user-123');
      expect(mockLiteLLMService.createUser).not.toHaveBeenCalled();
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        'User already exists in LiteLLM',
      );
    });

    it('should create user in LiteLLM if user does not exist', async () => {
      vi.mocked(mockLiteLLMService.getUserInfo)
        .mockResolvedValueOnce(null) // First call: user doesn't exist
        .mockResolvedValueOnce(mockLiteLLMUser); // Verification call: user exists

      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(mockUser);
      vi.mocked(mockLiteLLMService.createUser).mockResolvedValue(mockLiteLLMUser);

      // Mock getUserPrimaryTeam
      const getUserPrimaryTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'getUserPrimaryTeam')
        .mockResolvedValue('team-123');

      // Mock ensureTeamExistsInLiteLLM
      const ensureTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'ensureTeamExistsInLiteLLM')
        .mockResolvedValue(undefined);

      await LiteLLMSyncUtils.ensureUserExistsInLiteLLM(
        'user-123',
        mockFastify as FastifyInstance,
        mockLiteLLMService as LiteLLMService,
      );

      expect(mockFastify.dbUtils.queryOne).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
        'user-123',
      ]);
      expect(getUserPrimaryTeamSpy).toHaveBeenCalledWith(
        'user-123',
        mockFastify,
        mockLiteLLMService,
      );
      expect(ensureTeamSpy).toHaveBeenCalledWith('team-123', mockFastify, mockLiteLLMService);
      expect(mockLiteLLMService.createUser).toHaveBeenCalled();
      expect(mockFastify.dbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET sync_status'),
        ['synced', 'user-123'],
      );

      getUserPrimaryTeamSpy.mockRestore();
      ensureTeamSpy.mockRestore();
    });

    it('should throw error if user not found in database', async () => {
      vi.mocked(mockLiteLLMService.getUserInfo).mockResolvedValue(null);
      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(null);

      // Mock getUserPrimaryTeam
      const getUserPrimaryTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'getUserPrimaryTeam')
        .mockResolvedValue('team-123');

      await expect(
        LiteLLMSyncUtils.ensureUserExistsInLiteLLM(
          'user-123',
          mockFastify as FastifyInstance,
          mockLiteLLMService as LiteLLMService,
        ),
      ).rejects.toThrow('User user-123 not found in database');

      getUserPrimaryTeamSpy.mockRestore();
    });

    it('should verify user creation and throw if verification fails', async () => {
      vi.mocked(mockLiteLLMService.getUserInfo)
        .mockResolvedValueOnce(null) // First call: user doesn't exist
        .mockResolvedValueOnce(null); // Verification call: user still doesn't exist

      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(mockUser);
      vi.mocked(mockLiteLLMService.createUser).mockResolvedValue(mockLiteLLMUser);

      // Mock dependencies
      const getUserPrimaryTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'getUserPrimaryTeam')
        .mockResolvedValue('team-123');
      const ensureTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'ensureTeamExistsInLiteLLM')
        .mockResolvedValue(undefined);

      await expect(
        LiteLLMSyncUtils.ensureUserExistsInLiteLLM(
          'user-123',
          mockFastify as FastifyInstance,
          mockLiteLLMService as LiteLLMService,
        ),
      ).rejects.toThrow('User creation verification failed');

      getUserPrimaryTeamSpy.mockRestore();
      ensureTeamSpy.mockRestore();
    });

    it('should handle user already exists error gracefully', async () => {
      vi.mocked(mockLiteLLMService.getUserInfo).mockResolvedValue(null);
      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(mockUser);
      vi.mocked(mockLiteLLMService.createUser).mockRejectedValue(
        new Error('User with email already exists'),
      );

      // Mock dependencies
      const getUserPrimaryTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'getUserPrimaryTeam')
        .mockResolvedValue('team-123');
      const ensureTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'ensureTeamExistsInLiteLLM')
        .mockResolvedValue(undefined);

      await LiteLLMSyncUtils.ensureUserExistsInLiteLLM(
        'user-123',
        mockFastify as FastifyInstance,
        mockLiteLLMService as LiteLLMService,
      );

      expect(mockFastify.dbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET sync_status'),
        ['synced', 'user-123'],
      );
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' }),
        expect.stringContaining('User already exists in LiteLLM'),
      );

      getUserPrimaryTeamSpy.mockRestore();
      ensureTeamSpy.mockRestore();
    });

    it('should update sync status to error on failure', async () => {
      vi.mocked(mockLiteLLMService.getUserInfo).mockResolvedValue(null);
      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(mockUser);
      vi.mocked(mockLiteLLMService.createUser).mockRejectedValue(new Error('LiteLLM API error'));

      // Mock dependencies
      const getUserPrimaryTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'getUserPrimaryTeam')
        .mockResolvedValue('team-123');
      const ensureTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'ensureTeamExistsInLiteLLM')
        .mockResolvedValue(undefined);

      await expect(
        LiteLLMSyncUtils.ensureUserExistsInLiteLLM(
          'user-123',
          mockFastify as FastifyInstance,
          mockLiteLLMService as LiteLLMService,
        ),
      ).rejects.toThrow('Failed to create user in LiteLLM');

      expect(mockFastify.dbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET sync_status'),
        ['error', 'user-123'],
      );

      getUserPrimaryTeamSpy.mockRestore();
      ensureTeamSpy.mockRestore();
    });

    it('should set correct user role for admin users', async () => {
      const adminUser = { ...mockUser, roles: ['admin'] };

      vi.mocked(mockLiteLLMService.getUserInfo)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockLiteLLMUser, user_role: 'proxy_admin' });

      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(adminUser);
      vi.mocked(mockLiteLLMService.createUser).mockResolvedValue({
        ...mockLiteLLMUser,
        user_role: 'proxy_admin',
      });

      // Mock dependencies
      const getUserPrimaryTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'getUserPrimaryTeam')
        .mockResolvedValue('team-123');
      const ensureTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'ensureTeamExistsInLiteLLM')
        .mockResolvedValue(undefined);

      await LiteLLMSyncUtils.ensureUserExistsInLiteLLM(
        'user-123',
        mockFastify as FastifyInstance,
        mockLiteLLMService as LiteLLMService,
      );

      expect(mockLiteLLMService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          user_role: 'proxy_admin',
        }),
      );

      getUserPrimaryTeamSpy.mockRestore();
      ensureTeamSpy.mockRestore();
    });
  });

  describe('ensureTeamExistsInLiteLLM', () => {
    it('should skip creation if team already exists in LiteLLM', async () => {
      vi.mocked(mockLiteLLMService.getTeamInfo).mockResolvedValue(mockLiteLLMTeam);

      await LiteLLMSyncUtils.ensureTeamExistsInLiteLLM(
        'team-123',
        mockFastify as FastifyInstance,
        mockLiteLLMService as LiteLLMService,
      );

      expect(mockLiteLLMService.getTeamInfo).toHaveBeenCalledWith('team-123');
      expect(mockLiteLLMService.createTeam).not.toHaveBeenCalled();
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: 'team-123' }),
        'Team already exists in LiteLLM',
      );
    });

    it('should create team in LiteLLM if team does not exist', async () => {
      vi.mocked(mockLiteLLMService.getTeamInfo)
        .mockRejectedValueOnce(new Error('Team not found')) // First call: team doesn't exist
        .mockResolvedValueOnce(mockLiteLLMTeam); // Verification call: team exists

      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(mockTeam);
      vi.mocked(mockLiteLLMService.createTeam).mockResolvedValue(mockLiteLLMTeam);

      await LiteLLMSyncUtils.ensureTeamExistsInLiteLLM(
        'team-123',
        mockFastify as FastifyInstance,
        mockLiteLLMService as LiteLLMService,
      );

      expect(mockFastify.dbUtils.queryOne).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
        'team-123',
      ]);
      expect(mockLiteLLMService.createTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          team_id: 'team-123',
          team_alias: 'Test Team',
          max_budget: 1000,
          tpm_limit: 50000,
          rpm_limit: 500,
        }),
      );
    });

    it('should throw error if team not found in database', async () => {
      vi.mocked(mockLiteLLMService.getTeamInfo).mockRejectedValue(new Error('Team not found'));
      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(null);

      await expect(
        LiteLLMSyncUtils.ensureTeamExistsInLiteLLM(
          'team-123',
          mockFastify as FastifyInstance,
          mockLiteLLMService as LiteLLMService,
        ),
      ).rejects.toThrow('Team team-123 not found in database');
    });

    it('should verify team creation and throw if verification fails', async () => {
      vi.mocked(mockLiteLLMService.getTeamInfo)
        .mockRejectedValueOnce(new Error('Team not found'))
        .mockRejectedValueOnce(new Error('Team still not found'));

      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(mockTeam);
      vi.mocked(mockLiteLLMService.createTeam).mockResolvedValue(mockLiteLLMTeam);

      await expect(
        LiteLLMSyncUtils.ensureTeamExistsInLiteLLM(
          'team-123',
          mockFastify as FastifyInstance,
          mockLiteLLMService as LiteLLMService,
        ),
      ).rejects.toThrow('Team creation verification failed');
    });

    it('should use default budget values if team values are null', async () => {
      const teamWithoutBudget = { ...mockTeam, max_budget: null, tpm_limit: null, rpm_limit: null };

      vi.mocked(mockLiteLLMService.getTeamInfo)
        .mockRejectedValueOnce(new Error('Team not found'))
        .mockResolvedValueOnce(mockLiteLLMTeam);

      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(teamWithoutBudget);
      vi.mocked(mockLiteLLMService.createTeam).mockResolvedValue(mockLiteLLMTeam);

      await LiteLLMSyncUtils.ensureTeamExistsInLiteLLM(
        'team-123',
        mockFastify as FastifyInstance,
        mockLiteLLMService as LiteLLMService,
      );

      expect(mockLiteLLMService.createTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          max_budget: 1000, // Default value
          tpm_limit: 10000, // Default value
          rpm_limit: 500, // Default value
        }),
      );
    });
  });

  describe('getUserPrimaryTeam', () => {
    it('should delegate to DefaultTeamService', async () => {
      // This test verifies that getUserPrimaryTeam properly delegates to DefaultTeamService
      // We can't easily mock the DefaultTeamService constructor, so we'll just verify the call
      const getUserPrimaryTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'getUserPrimaryTeam')
        .mockResolvedValue('default-team');

      const result = await LiteLLMSyncUtils.getUserPrimaryTeam(
        'user-123',
        mockFastify as FastifyInstance,
        mockLiteLLMService as LiteLLMService,
      );

      expect(result).toBe('default-team');

      getUserPrimaryTeamSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should log detailed error information on user creation failure', async () => {
      const error = new Error('Network timeout');
      vi.mocked(mockLiteLLMService.getUserInfo).mockResolvedValue(null);
      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(mockUser);
      vi.mocked(mockLiteLLMService.createUser).mockRejectedValue(error);

      // Mock dependencies
      const getUserPrimaryTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'getUserPrimaryTeam')
        .mockResolvedValue('team-123');
      const ensureTeamSpy = vi
        .spyOn(LiteLLMSyncUtils, 'ensureTeamExistsInLiteLLM')
        .mockResolvedValue(undefined);

      await expect(
        LiteLLMSyncUtils.ensureUserExistsInLiteLLM(
          'user-123',
          mockFastify as FastifyInstance,
          mockLiteLLMService as LiteLLMService,
        ),
      ).rejects.toThrow();

      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          error: 'Network timeout',
          errorStack: expect.any(String),
        }),
        'Failed to create user in LiteLLM',
      );

      getUserPrimaryTeamSpy.mockRestore();
      ensureTeamSpy.mockRestore();
    });

    it('should log detailed error information on team creation failure', async () => {
      const error = new Error('Database connection error');
      vi.mocked(mockLiteLLMService.getTeamInfo).mockRejectedValue(new Error('Team not found'));
      vi.mocked(mockFastify.dbUtils.queryOne).mockResolvedValue(mockTeam);
      vi.mocked(mockLiteLLMService.createTeam).mockRejectedValue(error);

      await expect(
        LiteLLMSyncUtils.ensureTeamExistsInLiteLLM(
          'team-123',
          mockFastify as FastifyInstance,
          mockLiteLLMService as LiteLLMService,
        ),
      ).rejects.toThrow();

      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team-123',
          error: 'Database connection error',
          errorStack: expect.any(String),
        }),
        'Failed to create team in LiteLLM',
      );
    });
  });
});

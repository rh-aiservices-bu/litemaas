import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamService } from '../../../src/services/team.service.js';
import { LiteLLMService } from '../../../src/services/litellm.service.js';
import type { FastifyInstance } from 'fastify';
import type {
  CreateTeamDto,
  UpdateTeamDto,
  CreateUserTeamAssignmentDto,
  TeamListParams,
  TeamWithMembers,
} from '../../../src/types/user.types.js';

describe('TeamService', () => {
  let service: TeamService;
  let mockFastify: Partial<FastifyInstance>;
  let mockLiteLLMService: Partial<LiteLLMService>;
  let mockDbUtils: any;

  const mockTeamDbRow = {
    id: 'team-123',
    name: 'Test Team',
    alias: 'test-team',
    description: 'A test team',
    litellm_team_id: 'litellm-team-123',
    max_budget: 1000,
    current_spend: 250,
    budget_duration: 'monthly',
    tpm_limit: 10000,
    rpm_limit: 100,
    allowed_models: JSON.stringify(['gpt-4o', 'claude-3-5-sonnet-20241022']),
    metadata: JSON.stringify({ department: 'Engineering' }),
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'admin-123',
    member_count: 2,
  };

  const mockTeamMemberDbRow = {
    id: 'member-123',
    team_id: 'team-123',
    user_id: 'user-123',
    role: 'admin',
    joined_at: new Date(),
    added_by: 'admin-123',
    username: 'testuser',
    email: 'test@example.com',
    full_name: 'Test User',
  };

  const mockCreateTeamDto: CreateTeamDto = {
    name: 'New Team',
    alias: 'new-team',
    description: 'A new team',
    maxBudget: 1000,
    budgetDuration: 'monthly',
    tpmLimit: 10000,
    rpmLimit: 100,
    allowedModels: ['gpt-4o'],
    metadata: { department: 'Engineering' },
    adminIds: [],
  };

  beforeEach(() => {
    mockDbUtils = {
      query: vi.fn(),
      queryOne: vi.fn(),
      queryMany: vi.fn(),
      withTransaction: vi.fn(),
    };

    mockLiteLLMService = {
      createTeam: vi.fn(),
      getTeamInfo: vi.fn(),
    };

    mockFastify = {
      dbUtils: mockDbUtils,
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as Partial<FastifyInstance>;

    service = new TeamService(mockFastify as FastifyInstance, mockLiteLLMService as LiteLLMService);
  });

  describe('createTeam', () => {
    it('should return mock team when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.createTeam('user-123', mockCreateTeamDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockCreateTeamDto.name);
      expect(result.alias).toBe(mockCreateTeamDto.alias);
      expect(result.maxBudget).toBe(mockCreateTeamDto.maxBudget);
      expect(result.createdBy).toBe('user-123');
      expect(result.members).toHaveLength(1);
      expect(result.members[0].userId).toBe('user-123');
      expect(result.members[0].role).toBe('admin');
    });

    it('should create team with valid data', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce(null) // Check team name uniqueness
        .mockResolvedValueOnce(mockTeamDbRow); // Create team

      vi.mocked(mockLiteLLMService.createTeam!).mockResolvedValue({
        team_id: 'litellm-team-123',
        team_alias: 'new-team',
        admins: ['user-123'],
      });

      vi.spyOn(service, 'addTeamMember').mockResolvedValue({
        id: 'member-123',
        teamId: 'team-123',
        userId: 'user-123',
        role: 'admin',
        joinedAt: new Date(),
        addedBy: 'user-123',
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          fullName: 'Test User',
        },
      });

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        name: 'New Team',
        alias: 'new-team',
        description: 'A new team',
        liteLLMTeamId: 'litellm-team-123',
        maxBudget: 1000,
        currentSpend: 0,
        budgetDuration: 'monthly',
        tpmLimit: 10000,
        rpmLimit: 100,
        allowedModels: ['gpt-4o'],
        metadata: { department: 'Engineering' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
        members: [],
        memberCount: 1,
      });

      const result = await service.createTeam('user-123', mockCreateTeamDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Team');
      expect(mockLiteLLMService.createTeam).toHaveBeenCalledWith(
        expect.objectContaining({
          team_alias: 'new-team',
          max_budget: 1000,
          models: ['gpt-4o'],
          admins: ['user-123'],
        }),
      );
      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM teams WHERE name'),
        ['New Team'],
      );
    });

    it('should throw error for duplicate team name', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue({ id: 'existing-team' });

      await expect(service.createTeam('user-123', mockCreateTeamDto)).rejects.toThrow(
        /already exists/i,
      );
    });

    it('should set default values for optional fields', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const minimalDto: CreateTeamDto = {
        name: 'Minimal Team',
        alias: 'minimal',
      };

      mockDbUtils.queryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockTeamDbRow, name: 'Minimal Team' });

      vi.mocked(mockLiteLLMService.createTeam!).mockResolvedValue({
        team_id: 'litellm-team-123',
        team_alias: 'minimal',
        admins: ['user-123'],
      });

      vi.spyOn(service, 'addTeamMember').mockResolvedValue({} as any);
      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        name: 'Minimal Team',
        alias: 'minimal',
        liteLLMTeamId: 'litellm-team-123',
        currentSpend: 0,
        budgetDuration: 'monthly',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
        members: [],
        memberCount: 1,
        metadata: {},
      });

      const result = await service.createTeam('user-123', minimalDto);

      expect(result.budgetDuration).toBe('monthly'); // default value
      expect(result.metadata).toEqual({});
    });

    it('should add additional admins to team', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dtoWithAdmins: CreateTeamDto = {
        ...mockCreateTeamDto,
        adminIds: ['admin-1', 'admin-2'],
      };

      mockDbUtils.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce(mockTeamDbRow);

      vi.mocked(mockLiteLLMService.createTeam!).mockResolvedValue({
        team_id: 'litellm-team-123',
        team_alias: 'new-team',
        admins: ['user-123', 'admin-1', 'admin-2'],
      });

      const addTeamMemberSpy = vi.spyOn(service, 'addTeamMember').mockResolvedValue({} as any);
      vi.spyOn(service, 'getTeam').mockResolvedValue({} as any);

      await service.createTeam('user-123', dtoWithAdmins);

      // Should be called 3 times: creator + 2 additional admins
      expect(addTeamMemberSpy).toHaveBeenCalledTimes(3);
    });

    it('should create audit log on team creation', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce(mockTeamDbRow);

      vi.mocked(mockLiteLLMService.createTeam!).mockResolvedValue({
        team_id: 'litellm-team-123',
        team_alias: 'new-team',
        admins: ['user-123'],
      });

      vi.spyOn(service, 'addTeamMember').mockResolvedValue({} as any);
      vi.spyOn(service, 'getTeam').mockResolvedValue({} as any);

      await service.createTeam('user-123', mockCreateTeamDto);

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          'TEAM_CREATE',
          'TEAM',
          expect.any(String),
          expect.any(String),
        ]),
      );
    });

    it('should handle LiteLLM API errors gracefully', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce(null);

      vi.mocked(mockLiteLLMService.createTeam!).mockRejectedValue(
        new Error('LiteLLM API unavailable'),
      );

      await expect(service.createTeam('user-123', mockCreateTeamDto)).rejects.toThrow(
        'LiteLLM API unavailable',
      );
    });
  });

  describe('getTeam', () => {
    it('should return mock team when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getTeam('team-prod');

      expect(result).toBeDefined();
      expect(result?.id).toBe('team-prod');
      expect(result?.name).toBe('Production Team');
    });

    it('should return null for non-existent mock team', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getTeam('non-existent');

      expect(result).toBeNull();
    });

    it('should retrieve team by ID with members', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(mockTeamDbRow);
      mockDbUtils.queryMany.mockResolvedValue([mockTeamMemberDbRow]);

      const result = await service.getTeam('team-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('team-123');
      expect(result?.name).toBe('Test Team');
      expect(result?.members).toHaveLength(1);
      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(expect.stringContaining('SELECT t.*'), [
        'team-123',
      ]);
    });

    it('should filter by userId when provided', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(mockTeamDbRow);
      mockDbUtils.queryMany.mockResolvedValue([mockTeamMemberDbRow]);

      await service.getTeam('team-123', 'user-123');

      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(expect.stringContaining('EXISTS'), [
        'team-123',
        'user-123',
      ]);
    });

    it('should return null when team not found', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      const result = await service.getTeam('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dbError = new Error('Database connection failed');
      mockDbUtils.queryOne.mockRejectedValue(dbError);

      await expect(service.getTeam('team-123')).rejects.toThrow('Database connection failed');
      expect(mockFastify.log!.error).toHaveBeenCalled();
    });
  });

  describe('getUserTeams', () => {
    it('should return mock teams when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getUserTeams('user-1');

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);
      const params: TeamListParams = { page: 1, limit: 1 };

      const result = await service.getUserTeams('user-1', params);

      expect(result.data).toHaveLength(1);
    });

    it('should filter by search term', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);
      const params: TeamListParams = { search: 'Production' };

      const result = await service.getUserTeams('user-1', params);

      expect(result.data.every((team) => team.name.includes('Production'))).toBe(true);
    });

    it('should filter by isActive status', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);
      const params: TeamListParams = { isActive: true };

      const result = await service.getUserTeams('user-1', params);

      expect(result.data.every((team) => team.isActive === true)).toBe(true);
    });

    it('should filter by createdBy', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);
      const params: TeamListParams = { createdBy: 'admin-user-1' };

      const result = await service.getUserTeams('user-1', params);

      expect(result.data.every((team) => team.createdBy === 'admin-user-1')).toBe(true);
    });

    it('should query database with pagination', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryMany.mockResolvedValue([mockTeamDbRow]);
      mockDbUtils.queryOne.mockResolvedValue({ count: 10 });

      const params: TeamListParams = { page: 2, limit: 5 };

      await service.getUserTeams('user-123', params);

      expect(mockDbUtils.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([5, 5]), // limit, offset
      );
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dbError = new Error('Database query failed');
      mockDbUtils.queryMany.mockRejectedValue(dbError);

      await expect(service.getUserTeams('user-123')).rejects.toThrow('Database query failed');
      expect(mockFastify.log!.error).toHaveBeenCalled();
    });
  });

  describe('updateTeam', () => {
    const updateDto: UpdateTeamDto = {
      name: 'Updated Team',
      maxBudget: 2000,
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
    };

    it('should verify user has admin access', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null); // No member found

      await expect(service.updateTeam('team-123', 'user-123', updateDto)).rejects.toThrow(
        /Insufficient permissions/i,
      );
    });

    it('should update team properties', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' }) // checkTeamAccess
        .mockResolvedValueOnce(null) // Check name uniqueness
        .mockResolvedValueOnce({ ...mockTeamDbRow, name: 'Updated Team' }); // Update result

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        ...({} as TeamWithMembers),
        id: 'team-123',
        name: 'Updated Team',
        maxBudget: 2000,
      });

      const result = await service.updateTeam('team-123', 'user-123', updateDto);

      expect(result.name).toBe('Updated Team');
      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE teams SET'),
        expect.arrayContaining(['Updated Team', 2000, expect.any(String), 'team-123']),
      );
    });

    it('should prevent duplicate team names', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ id: 'other-team' }); // Existing team with same name

      await expect(service.updateTeam('team-123', 'user-123', updateDto)).rejects.toThrow(
        /already exists/i,
      );
    });

    it('should handle empty update (no fields changed)', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce({ role: 'admin' });

      vi.spyOn(service, 'getTeam').mockResolvedValue({} as TeamWithMembers);

      const result = await service.updateTeam('team-123', 'user-123', {});

      expect(result).toBeDefined();
      expect(mockDbUtils.queryOne).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE teams SET'),
        expect.anything(),
      );
    });

    it('should create audit log on update', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockTeamDbRow);

      vi.spyOn(service, 'getTeam').mockResolvedValue({} as TeamWithMembers);

      await service.updateTeam('team-123', 'user-123', updateDto);

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['user-123', 'TEAM_UPDATE', 'TEAM', 'team-123', expect.any(String)]),
      );
    });
  });

  describe('addTeamMember', () => {
    const assignment: CreateUserTeamAssignmentDto = {
      userId: 'new-user',
      teamId: 'team-123',
      role: 'member',
    };

    it('should verify admin has access', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null); // No member found

      await expect(service.addTeamMember('team-123', assignment, 'admin-123')).rejects.toThrow(
        /Insufficient permissions/i,
      );
    });

    it('should add member to team', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      const newMemberDbRow = {
        ...mockTeamMemberDbRow,
        user_id: 'new-user',
        role: 'member',
      };

      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' }) // checkTeamAccess
        .mockResolvedValueOnce(null) // Check existing member
        .mockResolvedValueOnce({
          id: 'new-user',
          username: 'newuser',
          email: 'new@example.com',
          full_name: 'New User',
        }) // User exists
        .mockResolvedValueOnce(newMemberDbRow); // Insert result

      const result = await service.addTeamMember('team-123', assignment, 'admin-123');

      expect(result).toBeDefined();
      expect(result.userId).toBe('new-user');
      expect(result.role).toBe('member');
      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO team_members'),
        expect.arrayContaining(['team-123', 'new-user', 'member', 'admin-123']),
      );
    });

    it('should prevent duplicate member assignments', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ id: 'existing-member' });

      await expect(service.addTeamMember('team-123', assignment, 'admin-123')).rejects.toThrow(
        /already exists/i,
      );
    });

    it('should throw error for non-existent user', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce(null) // No existing member
        .mockResolvedValueOnce(null); // User doesn't exist

      await expect(service.addTeamMember('team-123', assignment, 'admin-123')).rejects.toThrow(
        /User.*not found/i,
      );
    });

    it('should create audit log on member addition', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'new-user', username: 'newuser' })
        .mockResolvedValueOnce(mockTeamMemberDbRow);

      await service.addTeamMember('team-123', assignment, 'admin-123');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'admin-123',
          'TEAM_MEMBER_ADD',
          'TEAM',
          'team-123',
          expect.any(String),
        ]),
      );
    });
  });

  describe('removeTeamMember', () => {
    it('should verify admin has access', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      await expect(service.removeTeamMember('team-123', 'user-123', 'admin-123')).rejects.toThrow(
        /Insufficient permissions/i,
      );
    });

    it('should remove member from team', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' }) // checkTeamAccess
        .mockResolvedValueOnce({ ...mockTeamMemberDbRow, role: 'member' }); // Member exists

      await service.removeTeamMember('team-123', 'user-123', 'admin-123');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM team_members'),
        ['team-123', 'user-123'],
      );
    });

    it('should throw error for non-existent member', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce({ role: 'admin' }).mockResolvedValueOnce(null); // Member doesn't exist

      await expect(service.removeTeamMember('team-123', 'user-123', 'admin-123')).rejects.toThrow(
        /not found/i,
      );
    });

    it('should prevent removing the last admin', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ ...mockTeamMemberDbRow, role: 'admin' }) // Member is admin
        .mockResolvedValueOnce({ count: 1 }); // Only 1 admin

      await expect(service.removeTeamMember('team-123', 'user-123', 'admin-123')).rejects.toThrow(
        /Cannot remove the last admin/i,
      );
    });

    it('should create audit log on member removal', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ ...mockTeamMemberDbRow, role: 'member' });

      await service.removeTeamMember('team-123', 'user-123', 'admin-123');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'admin-123',
          'TEAM_MEMBER_REMOVE',
          'TEAM',
          'team-123',
          expect.any(String),
        ]),
      );
    });
  });

  describe('updateTeamMemberRole', () => {
    it('should verify admin has access', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      await expect(
        service.updateTeamMemberRole('team-123', 'user-123', 'member', 'admin-123'),
      ).rejects.toThrow(/Insufficient permissions/i);
    });

    it('should update member role', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' }) // checkTeamAccess
        .mockResolvedValueOnce({
          // Current member info
          ...mockTeamMemberDbRow,
          role: 'viewer',
        })
        .mockResolvedValueOnce({ ...mockTeamMemberDbRow, role: 'member' }); // Update result

      const result = await service.updateTeamMemberRole(
        'team-123',
        'user-123',
        'member',
        'admin-123',
      );

      expect(result.role).toBe('member');
      expect(mockDbUtils.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE team_members SET role'),
        ['member', 'team-123', 'user-123'],
      );
    });

    it('should throw error for non-existent member', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce({ role: 'admin' }).mockResolvedValueOnce(null); // Member doesn't exist

      await expect(
        service.updateTeamMemberRole('team-123', 'user-123', 'member', 'admin-123'),
      ).rejects.toThrow(/not found/i);
    });

    it('should prevent removing admin role from last admin', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ ...mockTeamMemberDbRow, role: 'admin' }) // Current role is admin
        .mockResolvedValueOnce({ count: 1 }); // Only 1 admin

      await expect(
        service.updateTeamMemberRole('team-123', 'user-123', 'member', 'admin-123'),
      ).rejects.toThrow(/Cannot remove admin role from the last admin/i);
    });

    it('should create audit log on role update', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ ...mockTeamMemberDbRow, role: 'viewer' })
        .mockResolvedValueOnce({ ...mockTeamMemberDbRow, role: 'member' });

      await service.updateTeamMemberRole('team-123', 'user-123', 'member', 'admin-123');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'admin-123',
          'TEAM_MEMBER_ROLE_UPDATE',
          'TEAM',
          'team-123',
          expect.any(String),
        ]),
      );
    });
  });

  describe('getTeamBudgetInfo', () => {
    it('should verify user has access', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      await expect(service.getTeamBudgetInfo('team-123', 'user-123')).rejects.toThrow(
        /Insufficient permissions/i,
      );
    });

    it('should calculate budget utilization', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce({ role: 'member' }); // checkTeamAccess

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        maxBudget: 1000,
        currentSpend: 250,
        budgetDuration: 'monthly',
        memberCount: 2,
        updatedAt: new Date(),
      } as TeamWithMembers);

      const result = await service.getTeamBudgetInfo('team-123', 'user-123');

      expect(result.budgetUtilization).toBe(25); // 250/1000 * 100
      expect(result.remainingBudget).toBe(750);
      expect(result.currentSpend).toBe(250);
    });

    it('should handle unlimited budget (null max_budget)', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce({ role: 'member' });

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        maxBudget: undefined,
        currentSpend: 250,
        budgetDuration: 'monthly',
        memberCount: 2,
        updatedAt: new Date(),
      } as TeamWithMembers);

      const result = await service.getTeamBudgetInfo('team-123', 'user-123');

      expect(result.budgetUtilization).toBe(0);
      expect(result.remainingBudget).toBeUndefined();
    });

    it('should try to get real-time data from LiteLLM', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce({ role: 'member' });

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        liteLLMTeamId: 'litellm-team-123',
        maxBudget: 1000,
        currentSpend: 250,
        budgetDuration: 'monthly',
        memberCount: 2,
        updatedAt: new Date(),
      } as TeamWithMembers);

      vi.mocked(mockLiteLLMService.getTeamInfo!).mockResolvedValue({
        team_id: 'litellm-team-123',
        spend: 300,
        max_budget: 1200,
      });

      const result = await service.getTeamBudgetInfo('team-123', 'user-123');

      expect(result.currentSpend).toBe(300); // Real-time from LiteLLM
      expect(result.maxBudget).toBe(1200);
      expect(mockLiteLLMService.getTeamInfo).toHaveBeenCalledWith('litellm-team-123');
    });
  });

  describe('syncTeamWithLiteLLM', () => {
    it('should return error response when user lacks admin access', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      const result = await service.syncTeamWithLiteLLM('team-123', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Insufficient permissions/i);
    });

    it('should sync budget changes from LiteLLM', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' }) // checkTeamAccess
        .mockResolvedValueOnce(mockTeamDbRow); // Update result

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        liteLLMTeamId: 'litellm-team-123',
        maxBudget: 1000,
        currentSpend: 250,
      } as TeamWithMembers);

      vi.mocked(mockLiteLLMService.getTeamInfo!).mockResolvedValue({
        team_id: 'litellm-team-123',
        spend: 300,
        max_budget: 1200,
      });

      const result = await service.syncTeamWithLiteLLM('team-123', 'user-123');

      expect(result.success).toBe(true);
      expect(result.changes?.budgetUpdated).toBe(true);
      expect(result.changes?.usageUpdated).toBe(true);
    });

    it('should return error response for team without LiteLLM integration', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce({ role: 'admin' });

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        liteLLMTeamId: undefined,
      } as TeamWithMembers);

      const result = await service.syncTeamWithLiteLLM('team-123', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not integrated with LiteLLM/i);
    });

    it('should return error response on LiteLLM API failure', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValueOnce({ role: 'admin' });

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        liteLLMTeamId: 'litellm-team-123',
      } as TeamWithMembers);

      vi.mocked(mockLiteLLMService.getTeamInfo!).mockRejectedValue(
        new Error('LiteLLM API unavailable'),
      );

      const result = await service.syncTeamWithLiteLLM('team-123', 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('LiteLLM API unavailable');
    });
  });

  describe('deleteTeam', () => {
    it('should verify user has admin access', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne.mockResolvedValue(null);

      await expect(service.deleteTeam('team-123', 'user-123')).rejects.toThrow(
        /Insufficient permissions/i,
      );
    });

    it('should soft delete team (mark as inactive)', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' }) // checkTeamAccess
        .mockResolvedValueOnce({ count: 0 }); // No active subscriptions

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        name: 'Test Team',
        liteLLMTeamId: 'litellm-team-123',
      } as TeamWithMembers);

      await service.deleteTeam('team-123', 'user-123');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE teams SET is_active = false'),
        ['team-123'],
      );
    });

    it('should prevent deleting team with active subscriptions', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ count: 5 }); // Has active subscriptions

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        name: 'Test Team',
      } as TeamWithMembers);

      await expect(service.deleteTeam('team-123', 'user-123')).rejects.toThrow(
        /Cannot delete team with active subscriptions/i,
      );
    });

    it('should create audit log on deletion', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      mockDbUtils.queryOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ count: 0 });

      vi.spyOn(service, 'getTeam').mockResolvedValue({
        id: 'team-123',
        name: 'Test Team',
        liteLLMTeamId: 'litellm-team-123',
      } as TeamWithMembers);

      await service.deleteTeam('team-123', 'user-123');

      expect(mockDbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['user-123', 'TEAM_DELETE', 'TEAM', 'team-123', expect.any(String)]),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dbError = new Error('Connection timeout');
      mockDbUtils.queryOne.mockRejectedValue(dbError);

      await expect(service.getTeam('team-123')).rejects.toThrow('Connection timeout');
      expect(mockFastify.log!.error).toHaveBeenCalledWith(dbError, 'Failed to get team');
    });

    it('should log errors with context', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dbError = new Error('Query failed');
      mockDbUtils.queryMany.mockRejectedValue(dbError);

      await expect(service.getUserTeams('user-123')).rejects.toThrow();
      expect(mockFastify.log!.error).toHaveBeenCalledWith(dbError, 'Failed to get user teams');
    });
  });
});

import { FastifyInstance } from 'fastify';
import { LiteLLMService } from './litellm.service.js';
import {
  Team,
  TeamMember,
  CreateTeamDto,
  UpdateTeamDto,
  TeamWithMembers,
  UserTeamAssignment,
  CreateUserTeamAssignmentDto,
  TeamListParams,
  TeamMemberListParams,
  LiteLLMTeamRequest,
  LiteLLMTeamResponse,
  EnhancedUser,
  UserBudgetInfo,
} from '../types/user.types.js';

export interface TeamBudgetInfo {
  teamId: string;
  maxBudget?: number;
  currentSpend: number;
  budgetUtilization: number; // percentage
  remainingBudget?: number;
  budgetDuration?: string;
  spendResetAt?: Date;
  memberCount: number;
  lastUpdatedAt: Date;
}

export interface TeamUsageStats {
  teamId: string;
  period: {
    start: Date;
    end: Date;
    type: 'day' | 'week' | 'month' | 'year';
  };
  totalUsage: {
    requestCount: number;
    tokenCount: number;
    totalSpend: number;
    averageRequestCost: number;
    averageTokenCost: number;
  };
  memberUsage: Array<{
    userId: string;
    username: string;
    requestCount: number;
    tokenCount: number;
    spend: number;
  }>;
  modelUsage: Array<{
    modelId: string;
    modelName: string;
    requestCount: number;
    tokenCount: number;
    spend: number;
  }>;
}

export interface TeamSyncRequest {
  teamId: string;
  forceSync?: boolean;
  syncBudget?: boolean;
  syncMembers?: boolean;
  syncUsage?: boolean;
}

export interface TeamSyncResponse {
  teamId: string;
  syncedAt: Date;
  success: boolean;
  error?: string;
  changes?: {
    budgetUpdated?: boolean;
    membersUpdated?: boolean;
    usageUpdated?: boolean;
  };
}

export class TeamService {
  private fastify: FastifyInstance;
  private liteLLMService: LiteLLMService;

  // Mock data for development/fallback
  private readonly MOCK_TEAMS: TeamWithMembers[] = [
    {
      id: 'team-prod',
      name: 'Production Team',
      alias: 'prod-team',
      description: 'Team managing production workloads',
      liteLLMTeamId: 'litellm-team-prod-001',
      maxBudget: 1000,
      currentSpend: 345.75,
      budgetDuration: 'monthly',
      tpmLimit: 50000,
      rpmLimit: 500,
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
      metadata: {
        department: 'Engineering',
        priority: 'high',
        environment: 'production'
      },
      isActive: true,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      createdBy: 'admin-user-1',
      members: [
        {
          id: 'member-1',
          teamId: 'team-prod',
          userId: 'user-1',
          role: 'admin',
          joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          addedBy: 'admin-user-1',
          user: {
            id: 'user-1',
            username: 'john.doe',
            email: 'john.doe@company.com',
            fullName: 'John Doe'
          }
        },
        {
          id: 'member-2',
          teamId: 'team-prod',
          userId: 'user-2',
          role: 'member',
          joinedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          addedBy: 'user-1',
          user: {
            id: 'user-2',
            username: 'jane.smith',
            email: 'jane.smith@company.com',
            fullName: 'Jane Smith'
          }
        }
      ],
      memberCount: 2,
    },
    {
      id: 'team-dev',
      name: 'Development Team',
      alias: 'dev-team',
      description: 'Team for development and testing',
      liteLLMTeamId: 'litellm-team-dev-001',
      maxBudget: 500,
      currentSpend: 125.30,
      budgetDuration: 'monthly',
      tpmLimit: 20000,
      rpmLimit: 200,
      allowedModels: ['gpt-4o-mini', 'claude-3-5-sonnet-20241022'],
      metadata: {
        department: 'Engineering',
        priority: 'medium',
        environment: 'development'
      },
      isActive: true,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdBy: 'admin-user-1',
      members: [
        {
          id: 'member-3',
          teamId: 'team-dev',
          userId: 'user-3',
          role: 'admin',
          joinedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          addedBy: 'admin-user-1',
          user: {
            id: 'user-3',
            username: 'alice.wilson',
            email: 'alice.wilson@company.com',
            fullName: 'Alice Wilson'
          }
        },
        {
          id: 'member-4',
          teamId: 'team-dev',
          userId: 'user-4',
          role: 'member',
          joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          addedBy: 'user-3',
          user: {
            id: 'user-4',
            username: 'bob.johnson',
            email: 'bob.johnson@company.com',
            fullName: 'Bob Johnson'
          }
        },
        {
          id: 'member-5',
          teamId: 'team-dev',
          userId: 'user-5',
          role: 'viewer',
          joinedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          addedBy: 'user-3',
          user: {
            id: 'user-5',
            username: 'charlie.brown',
            email: 'charlie.brown@company.com',
            fullName: 'Charlie Brown'
          }
        }
      ],
      memberCount: 3,
    }
  ];

  constructor(fastify: FastifyInstance, liteLLMService?: LiteLLMService) {
    this.fastify = fastify;
    this.liteLLMService = liteLLMService || new LiteLLMService(fastify);
  }

  private shouldUseMockData(): boolean {
    const isDev = process.env.NODE_ENV === 'development';
    const dbUnavailable = this.isDatabaseUnavailable();
    
    this.fastify.log.debug({ 
      isDev, 
      dbUnavailable, 
      nodeEnv: process.env.NODE_ENV,
      hasPg: !!this.fastify.pg 
    }, 'Team Service: Checking if should use mock data');
    
    return isDev || dbUnavailable;
  }

  private isDatabaseUnavailable(): boolean {
    try {
      if (!this.fastify.pg) {
        this.fastify.log.debug('Team Service: PostgreSQL plugin not available');
        return true;
      }
      
      if (this.fastify.isDatabaseMockMode && this.fastify.isDatabaseMockMode()) {
        this.fastify.log.debug('Team Service: Database mock mode enabled');
        return true;
      }
      
      return false;
    } catch (error) {
      this.fastify.log.debug({ error }, 'Team Service: Error checking database availability');
      return true;
    }
  }

  private createMockResponse<T>(data: T): Promise<T> {
    const delay = Math.random() * 200 + 100; // 100-300ms
    return new Promise(resolve => setTimeout(() => resolve(data), delay));
  }

  async createTeam(
    userId: string,
    request: CreateTeamDto
  ): Promise<TeamWithMembers> {
    const { 
      name, 
      alias, 
      description, 
      maxBudget, 
      budgetDuration = 'monthly', 
      tpmLimit, 
      rpmLimit, 
      allowedModels, 
      metadata = {},
      adminIds = []
    } = request;

    try {
      if (this.shouldUseMockData()) {
        // Mock implementation
        const mockTeam: TeamWithMembers = {
          id: `team-${Date.now()}`,
          name,
          alias,
          description,
          liteLLMTeamId: `litellm-team-${Date.now()}`,
          maxBudget,
          currentSpend: 0,
          budgetDuration,
          tpmLimit,
          rpmLimit,
          allowedModels,
          metadata,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
          members: [
            {
              id: `member-${Date.now()}`,
              teamId: `team-${Date.now()}`,
              userId,
              role: 'admin',
              joinedAt: new Date(),
              addedBy: userId,
              user: {
                id: userId,
                username: 'mock-user',
                email: 'mock@example.com',
                fullName: 'Mock User'
              }
            }
          ],
          memberCount: 1,
        };

        return this.createMockResponse(mockTeam);
      }

      // Check if team name is unique
      const existingTeam = await this.fastify.dbUtils.queryOne(
        `SELECT id FROM teams WHERE name = $1 AND is_active = true`,
        [name]
      );

      if (existingTeam) {
        throw this.fastify.createValidationError(`Team with name '${name}' already exists`);
      }

      // Create team in LiteLLM first
      const liteLLMRequest: LiteLLMTeamRequest = {
        team_alias: alias || name,
        max_budget: maxBudget,
        models: allowedModels,
        tpm_limit: tpmLimit,
        rpm_limit: rpmLimit,
        budget_duration: budgetDuration,
        metadata: {
          litemaas_team_name: name,
          created_by: userId,
          ...metadata,
        },
        admins: [userId, ...adminIds],
      };

      const liteLLMResponse = await this.liteLLMService.createTeam(liteLLMRequest);

      // Create team locally
      const team = await this.fastify.dbUtils.queryOne(
        `INSERT INTO teams (
          name, alias, description, litellm_team_id, max_budget, 
          current_spend, budget_duration, tpm_limit, rpm_limit, 
          allowed_models, metadata, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          name,
          alias,
          description,
          liteLLMResponse.team_id,
          maxBudget,
          0, // initial spend
          budgetDuration,
          tpmLimit,
          rpmLimit,
          allowedModels ? JSON.stringify(allowedModels) : null,
          metadata,
          true,
          userId,
        ]
      );

      // Add creator as admin
      await this.addTeamMember(team.id, {
        userId,
        teamId: team.id,
        role: 'admin',
      }, userId);

      // Add additional admins
      for (const adminId of adminIds) {
        if (adminId !== userId) {
          await this.addTeamMember(team.id, {
            userId: adminId,
            teamId: team.id,
            role: 'admin',
          }, userId);
        }
      }

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'TEAM_CREATE',
          'TEAM',
          team.id,
          { name, maxBudget, liteLLMTeamId: liteLLMResponse.team_id },
        ]
      );

      this.fastify.log.info({
        userId,
        teamId: team.id,
        name,
        liteLLMTeamId: liteLLMResponse.team_id,
      }, 'Team created with LiteLLM integration');

      return this.getTeam(team.id, userId);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create team');
      throw error;
    }
  }

  async getTeam(teamId: string, userId?: string): Promise<TeamWithMembers | null> {
    if (this.shouldUseMockData()) {
      const mockTeam = this.MOCK_TEAMS.find(t => t.id === teamId);
      return mockTeam ? this.createMockResponse(mockTeam) : null;
    }

    try {
      let query = `
        SELECT t.*, 
               COUNT(tm.id) as member_count
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        WHERE t.id = $1 AND t.is_active = true
      `;
      const params = [teamId];

      if (userId) {
        query += ` AND EXISTS (
          SELECT 1 FROM team_members tm2 
          WHERE tm2.team_id = t.id AND tm2.user_id = $2
        )`;
        params.push(userId);
      }

      query += ` GROUP BY t.id`;

      const team = await this.fastify.dbUtils.queryOne(query, params);

      if (!team) {
        return null;
      }

      // Get team members
      const members = await this.fastify.dbUtils.queryMany(`
        SELECT tm.*, u.username, u.email, u.full_name
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = $1
        ORDER BY tm.joined_at ASC
      `, [teamId]);

      return this.mapToTeamWithMembers(team, members);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get team');
      throw error;
    }
  }

  async getUserTeams(
    userId: string,
    params: TeamListParams = {}
  ): Promise<{ data: TeamWithMembers[]; total: number }> {
    const { page = 1, limit = 20, search, isActive, createdBy } = params;
    const offset = (page - 1) * limit;

    if (this.shouldUseMockData()) {
      this.fastify.log.debug('Using mock team data');
      
      let filteredTeams = [...this.MOCK_TEAMS];
      
      if (search) {
        filteredTeams = filteredTeams.filter(team => 
          team.name.toLowerCase().includes(search.toLowerCase()) ||
          (team.alias && team.alias.toLowerCase().includes(search.toLowerCase()))
        );
      }
      
      if (typeof isActive === 'boolean') {
        filteredTeams = filteredTeams.filter(team => team.isActive === isActive);
      }
      
      if (createdBy) {
        filteredTeams = filteredTeams.filter(team => team.createdBy === createdBy);
      }
      
      const total = filteredTeams.length;
      const paginatedData = filteredTeams.slice(offset, offset + limit);
      
      return this.createMockResponse({
        data: paginatedData,
        total
      });
    }

    try {
      let query = `
        SELECT t.*, COUNT(tm2.id) as member_count
        FROM teams t
        LEFT JOIN team_members tm2 ON t.id = tm2.team_id
        WHERE EXISTS (
          SELECT 1 FROM team_members tm 
          WHERE tm.team_id = t.id AND tm.user_id = $1
        )
      `;
      const queryParams: any[] = [userId];
      let paramIndex = 2;

      if (search) {
        query += ` AND (t.name ILIKE $${paramIndex} OR t.alias ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (typeof isActive === 'boolean') {
        query += ` AND t.is_active = $${paramIndex}`;
        queryParams.push(isActive);
        paramIndex++;
      }

      if (createdBy) {
        query += ` AND t.created_by = $${paramIndex}`;
        queryParams.push(createdBy);
        paramIndex++;
      }

      query += ` GROUP BY t.id ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, offset);

      // Count query
      let countQuery = `
        SELECT COUNT(DISTINCT t.id)
        FROM teams t
        WHERE EXISTS (
          SELECT 1 FROM team_members tm 
          WHERE tm.team_id = t.id AND tm.user_id = $1
        )
      `;
      const countParams = [userId];
      let countParamIndex = 2;

      if (search) {
        countQuery += ` AND (t.name ILIKE $${countParamIndex} OR t.alias ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      if (typeof isActive === 'boolean') {
        countQuery += ` AND t.is_active = $${countParamIndex}`;
        countParams.push(isActive);
        countParamIndex++;
      }

      if (createdBy) {
        countQuery += ` AND t.created_by = $${countParamIndex}`;
        countParams.push(createdBy);
        countParamIndex++;
      }

      const [teams, countResult] = await Promise.all([
        this.fastify.dbUtils.queryMany(query, queryParams),
        this.fastify.dbUtils.queryOne(countQuery, countParams),
      ]);

      const teamsWithMembers = await Promise.all(
        teams.map(async (team) => {
          const members = await this.fastify.dbUtils.queryMany(`
            SELECT tm.*, u.username, u.email, u.full_name
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = $1
            ORDER BY tm.joined_at ASC
          `, [team.id]);

          return this.mapToTeamWithMembers(team, members);
        })
      );

      return {
        data: teamsWithMembers,
        total: parseInt(countResult.count),
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user teams');
      throw error;
    }
  }

  async updateTeam(
    teamId: string,
    userId: string,
    updates: UpdateTeamDto
  ): Promise<TeamWithMembers> {
    try {
      // Verify user has admin access
      const hasAccess = await this.checkTeamAccess(teamId, userId, 'admin');
      if (!hasAccess) {
        throw this.fastify.createForbiddenError('Insufficient permissions to update team');
      }

      const {
        name,
        alias,
        description,
        maxBudget,
        budgetDuration,
        tpmLimit,
        rpmLimit,
        allowedModels,
        metadata,
        isActive
      } = updates;

      // Build update query
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        // Check name uniqueness
        const existingTeam = await this.fastify.dbUtils.queryOne(
          `SELECT id FROM teams WHERE name = $1 AND id != $2 AND is_active = true`,
          [name, teamId]
        );
        if (existingTeam) {
          throw this.fastify.createValidationError(`Team with name '${name}' already exists`);
        }
        updateFields.push(`name = $${paramIndex++}`);
        params.push(name);
      }

      if (alias !== undefined) {
        updateFields.push(`alias = $${paramIndex++}`);
        params.push(alias);
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        params.push(description);
      }

      if (maxBudget !== undefined) {
        updateFields.push(`max_budget = $${paramIndex++}`);
        params.push(maxBudget);
      }

      if (budgetDuration !== undefined) {
        updateFields.push(`budget_duration = $${paramIndex++}`);
        params.push(budgetDuration);
      }

      if (tpmLimit !== undefined) {
        updateFields.push(`tpm_limit = $${paramIndex++}`);
        params.push(tpmLimit);
      }

      if (rpmLimit !== undefined) {
        updateFields.push(`rpm_limit = $${paramIndex++}`);
        params.push(rpmLimit);
      }

      if (allowedModels !== undefined) {
        updateFields.push(`allowed_models = $${paramIndex++}`);
        params.push(JSON.stringify(allowedModels));
      }

      if (metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        params.push(metadata);
      }

      if (isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        params.push(isActive);
      }

      if (updateFields.length === 0) {
        return await this.getTeam(teamId, userId);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(teamId);

      const updatedTeam = await this.fastify.dbUtils.queryOne(
        `UPDATE teams SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        params
      );

      // Update in LiteLLM if integrated
      if (updatedTeam.litellm_team_id && !this.shouldUseMockData()) {
        try {
          // Note: LiteLLM doesn't have a direct team update endpoint in the current API
          // This would be implemented when the API supports it
          this.fastify.log.debug({
            teamId,
            liteLLMTeamId: updatedTeam.litellm_team_id,
          }, 'Team update - LiteLLM sync would be implemented here');
        } catch (error) {
          this.fastify.log.warn(error, 'Failed to sync team update with LiteLLM');
        }
      }

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'TEAM_UPDATE',
          'TEAM',
          teamId,
          updates,
        ]
      );

      this.fastify.log.info({
        userId,
        teamId,
        updates,
      }, 'Team updated');

      return await this.getTeam(teamId, userId);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update team');
      throw error;
    }
  }

  async addTeamMember(
    teamId: string,
    assignment: CreateUserTeamAssignmentDto,
    adminUserId: string
  ): Promise<TeamMember> {
    try {
      // Verify admin has access
      const hasAccess = await this.checkTeamAccess(teamId, adminUserId, 'admin');
      if (!hasAccess) {
        throw this.fastify.createForbiddenError('Insufficient permissions to add team members');
      }

      const { userId, role } = assignment;

      // Check if user is already a member
      const existingMember = await this.fastify.dbUtils.queryOne(
        `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      if (existingMember) {
        throw this.fastify.createValidationError('User is already a member of this team');
      }

      // Verify user exists
      const user = await this.fastify.dbUtils.queryOne(
        `SELECT id, username, email, full_name FROM users WHERE id = $1 AND is_active = true`,
        [userId]
      );

      if (!user) {
        throw this.fastify.createNotFoundError('User');
      }

      // Add member
      const member = await this.fastify.dbUtils.queryOne(
        `INSERT INTO team_members (team_id, user_id, role, added_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [teamId, userId, role, adminUserId]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUserId,
          'TEAM_MEMBER_ADD',
          'TEAM',
          teamId,
          { addedUserId: userId, role },
        ]
      );

      this.fastify.log.info({
        adminUserId,
        teamId,
        addedUserId: userId,
        role,
      }, 'Team member added');

      return {
        id: member.id,
        teamId: member.team_id,
        userId: member.user_id,
        role: member.role,
        joinedAt: new Date(member.joined_at),
        addedBy: member.added_by,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
        },
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to add team member');
      throw error;
    }
  }

  async removeTeamMember(
    teamId: string,
    userId: string,
    adminUserId: string
  ): Promise<void> {
    try {
      // Verify admin has access
      const hasAccess = await this.checkTeamAccess(teamId, adminUserId, 'admin');
      if (!hasAccess) {
        throw this.fastify.createForbiddenError('Insufficient permissions to remove team members');
      }

      // Check if member exists
      const member = await this.fastify.dbUtils.queryOne(
        `SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      if (!member) {
        throw this.fastify.createNotFoundError('Team member');
      }

      // Prevent removing the last admin
      if (member.role === 'admin') {
        const adminCount = await this.fastify.dbUtils.queryOne(
          `SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND role = 'admin'`,
          [teamId]
        );

        if (parseInt(adminCount.count) <= 1) {
          throw this.fastify.createValidationError('Cannot remove the last admin from the team');
        }
      }

      // Remove member
      await this.fastify.dbUtils.query(
        `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUserId,
          'TEAM_MEMBER_REMOVE',
          'TEAM',
          teamId,
          { removedUserId: userId, previousRole: member.role },
        ]
      );

      this.fastify.log.info({
        adminUserId,
        teamId,
        removedUserId: userId,
      }, 'Team member removed');
    } catch (error) {
      this.fastify.log.error(error, 'Failed to remove team member');
      throw error;
    }
  }

  async updateTeamMemberRole(
    teamId: string,
    userId: string,
    newRole: 'admin' | 'member' | 'viewer',
    adminUserId: string
  ): Promise<TeamMember> {
    try {
      // Verify admin has access
      const hasAccess = await this.checkTeamAccess(teamId, adminUserId, 'admin');
      if (!hasAccess) {
        throw this.fastify.createForbiddenError('Insufficient permissions to update member roles');
      }

      // Get current member info
      const member = await this.fastify.dbUtils.queryOne(
        `SELECT tm.*, u.username, u.email, u.full_name
         FROM team_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.team_id = $1 AND tm.user_id = $2`,
        [teamId, userId]
      );

      if (!member) {
        throw this.fastify.createNotFoundError('Team member');
      }

      // If changing from admin, ensure not the last admin
      if (member.role === 'admin' && newRole !== 'admin') {
        const adminCount = await this.fastify.dbUtils.queryOne(
          `SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND role = 'admin'`,
          [teamId]
        );

        if (parseInt(adminCount.count) <= 1) {
          throw this.fastify.createValidationError('Cannot remove admin role from the last admin');
        }
      }

      // Update role
      const updatedMember = await this.fastify.dbUtils.queryOne(
        `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3
         RETURNING *`,
        [newRole, teamId, userId]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUserId,
          'TEAM_MEMBER_ROLE_UPDATE',
          'TEAM',
          teamId,
          { targetUserId: userId, previousRole: member.role, newRole },
        ]
      );

      this.fastify.log.info({
        adminUserId,
        teamId,
        targetUserId: userId,
        previousRole: member.role,
        newRole,
      }, 'Team member role updated');

      return {
        id: updatedMember.id,
        teamId: updatedMember.team_id,
        userId: updatedMember.user_id,
        role: updatedMember.role,
        joinedAt: new Date(updatedMember.joined_at),
        addedBy: updatedMember.added_by,
        user: {
          id: member.id,
          username: member.username,
          email: member.email,
          fullName: member.full_name,
        },
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update team member role');
      throw error;
    }
  }

  async getTeamBudgetInfo(teamId: string, userId: string): Promise<TeamBudgetInfo> {
    try {
      // Verify user has access
      const hasAccess = await this.checkTeamAccess(teamId, userId);
      if (!hasAccess) {
        throw this.fastify.createForbiddenError('Insufficient permissions to view team budget');
      }

      const team = await this.getTeam(teamId, userId);
      if (!team) {
        throw this.fastify.createNotFoundError('Team');
      }

      // Try to get real-time data from LiteLLM if available
      let currentSpend = team.currentSpend || 0;
      let maxBudget = team.maxBudget;

      if (team.liteLLMTeamId && !this.shouldUseMockData()) {
        try {
          const liteLLMInfo = await this.liteLLMService.getTeamInfo(team.liteLLMTeamId);
          currentSpend = liteLLMInfo.spend || 0;
          maxBudget = liteLLMInfo.max_budget;
        } catch (error) {
          this.fastify.log.warn(error, 'Failed to get real-time budget info from LiteLLM');
        }
      }

      const budgetUtilization = maxBudget ? (currentSpend / maxBudget) * 100 : 0;
      const remainingBudget = maxBudget ? maxBudget - currentSpend : undefined;

      return {
        teamId,
        maxBudget,
        currentSpend,
        budgetUtilization,
        remainingBudget,
        budgetDuration: team.budgetDuration,
        spendResetAt: undefined, // Would need to be calculated based on budget duration
        memberCount: team.memberCount,
        lastUpdatedAt: team.updatedAt,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get team budget info');
      throw error;
    }
  }

  async syncTeamWithLiteLLM(
    teamId: string,
    userId: string,
    request: TeamSyncRequest = {}
  ): Promise<TeamSyncResponse> {
    const { forceSync = false, syncBudget = true, syncMembers = true, syncUsage = true } = request;

    try {
      // Verify user has admin access
      const hasAccess = await this.checkTeamAccess(teamId, userId, 'admin');
      if (!hasAccess) {
        throw this.fastify.createForbiddenError('Insufficient permissions to sync team');
      }

      const team = await this.getTeam(teamId, userId);
      if (!team) {
        throw this.fastify.createNotFoundError('Team');
      }

      if (!team.liteLLMTeamId) {
        throw this.fastify.createValidationError('Team is not integrated with LiteLLM');
      }

      const changes: TeamSyncResponse['changes'] = {};

      // Get current info from LiteLLM
      const liteLLMInfo = await this.liteLLMService.getTeamInfo(team.liteLLMTeamId);

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (syncBudget && (forceSync || liteLLMInfo.max_budget !== team.maxBudget)) {
        updateFields.push(`max_budget = $${paramIndex++}`);
        params.push(liteLLMInfo.max_budget);
        changes.budgetUpdated = true;
      }

      if (syncUsage && (forceSync || liteLLMInfo.spend !== team.currentSpend)) {
        updateFields.push(`current_spend = $${paramIndex++}`);
        params.push(liteLLMInfo.spend);
        changes.usageUpdated = true;
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(teamId);

        await this.fastify.dbUtils.queryOne(
          `UPDATE teams 
           SET ${updateFields.join(', ')}
           WHERE id = $${paramIndex}
           RETURNING *`,
          params
        );
      }

      this.fastify.log.info({
        teamId,
        userId,
        changes,
      }, 'Team synced with LiteLLM');

      return {
        teamId,
        syncedAt: new Date(),
        success: true,
        changes,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to sync team with LiteLLM');
      
      return {
        teamId,
        syncedAt: new Date(),
        success: false,
        error: error.message,
      };
    }
  }

  async deleteTeam(teamId: string, userId: string): Promise<void> {
    try {
      // Verify user has admin access
      const hasAccess = await this.checkTeamAccess(teamId, userId, 'admin');
      if (!hasAccess) {
        throw this.fastify.createForbiddenError('Insufficient permissions to delete team');
      }

      const team = await this.getTeam(teamId, userId);
      if (!team) {
        throw this.fastify.createNotFoundError('Team');
      }

      // Check if team has active subscriptions or resources
      const activeSubscriptions = await this.fastify.dbUtils.queryOne(
        `SELECT COUNT(*) FROM subscriptions WHERE team_id = $1 AND status = 'active'`,
        [teamId]
      );

      if (parseInt(activeSubscriptions.count) > 0) {
        throw this.fastify.createValidationError(
          'Cannot delete team with active subscriptions. Please cancel or transfer them first.'
        );
      }

      // Soft delete (mark as inactive)
      await this.fastify.dbUtils.query(
        `UPDATE teams SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [teamId]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'TEAM_DELETE',
          'TEAM',
          teamId,
          { teamName: team.name, liteLLMTeamId: team.liteLLMTeamId },
        ]
      );

      this.fastify.log.info({
        userId,
        teamId,
        teamName: team.name,
      }, 'Team deleted (soft delete)');
    } catch (error) {
      this.fastify.log.error(error, 'Failed to delete team');
      throw error;
    }
  }

  // Helper methods

  private async checkTeamAccess(
    teamId: string, 
    userId: string, 
    requiredRole: 'admin' | 'member' | 'viewer' = 'viewer'
  ): Promise<boolean> {
    try {
      const member = await this.fastify.dbUtils.queryOne(
        `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      if (!member) {
        return false;
      }

      const roleHierarchy = { viewer: 0, member: 1, admin: 2 };
      return roleHierarchy[member.role] >= roleHierarchy[requiredRole];
    } catch (error) {
      this.fastify.log.error(error, 'Failed to check team access');
      return false;
    }
  }

  private mapToTeamWithMembers(team: any, members: any[]): TeamWithMembers {
    return {
      id: team.id,
      name: team.name,
      alias: team.alias,
      description: team.description,
      liteLLMTeamId: team.litellm_team_id,
      maxBudget: team.max_budget,
      currentSpend: team.current_spend || 0,
      budgetDuration: team.budget_duration,
      tpmLimit: team.tpm_limit,
      rpmLimit: team.rpm_limit,
      allowedModels: team.allowed_models ? JSON.parse(team.allowed_models) : undefined,
      metadata: team.metadata || {},
      isActive: team.is_active,
      createdAt: new Date(team.created_at),
      updatedAt: new Date(team.updated_at),
      createdBy: team.created_by,
      members: members.map(member => ({
        id: member.id,
        teamId: member.team_id,
        userId: member.user_id,
        role: member.role,
        joinedAt: new Date(member.joined_at),
        addedBy: member.added_by,
        user: {
          id: member.user_id,
          username: member.username,
          email: member.email,
          fullName: member.full_name,
        },
      })),
      memberCount: parseInt(team.member_count) || members.length,
    };
  }
}
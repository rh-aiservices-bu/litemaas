import { FastifyInstance } from 'fastify';
import { LiteLLMService } from './litellm.service';

export class DefaultTeamService {
  static readonly DEFAULT_TEAM_ID = 'a0000000-0000-4000-8000-000000000001';
  static readonly DEFAULT_TEAM_NAME = 'Default Team';
  static readonly DEFAULT_TEAM_DESCRIPTION = 'Default team for all users until team management is implemented';

  private fastify: FastifyInstance;
  private liteLLMService: LiteLLMService;

  constructor(fastify: FastifyInstance, liteLLMService?: LiteLLMService) {
    this.fastify = fastify;
    this.liteLLMService = liteLLMService || new LiteLLMService(fastify);
  }

  /**
   * Ensures the default team exists in both database and LiteLLM
   */
  async ensureDefaultTeamExists(): Promise<void> {
    try {
      // Check if default team exists in database
      const existingTeam = await this.fastify.dbUtils.queryOne(
        'SELECT id FROM teams WHERE id = $1',
        [DefaultTeamService.DEFAULT_TEAM_ID],
      );

      if (!existingTeam) {
        // Create default team in database
        await this.fastify.dbUtils.query(
          `INSERT INTO teams (
            id, name, alias, description, max_budget, current_spend, budget_duration,
            tpm_limit, rpm_limit, allowed_models, metadata, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
          [
            DefaultTeamService.DEFAULT_TEAM_ID,
            DefaultTeamService.DEFAULT_TEAM_NAME,
            'default-team',
            DefaultTeamService.DEFAULT_TEAM_DESCRIPTION,
            10000.00, // max_budget
            0, // current_spend
            'monthly', // budget_duration
            50000, // tpm_limit
            1000, // rpm_limit
            [], // allowed_models - empty array enables all models
            JSON.stringify({ auto_created: true, default_team: true, created_by: 'system' }), // metadata
            true, // is_active
          ],
        );

        this.fastify.log.info(
          { teamId: DefaultTeamService.DEFAULT_TEAM_ID },
          'Created default team in database',
        );
      }

      // Ensure default team exists in LiteLLM
      await this.ensureDefaultTeamInLiteLLM();
    } catch (error) {
      this.fastify.log.error(
        {
          teamId: DefaultTeamService.DEFAULT_TEAM_ID,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to ensure default team exists',
      );
      throw error;
    }
  }

  /**
   * Ensures the default team exists in LiteLLM
   */
  private async ensureDefaultTeamInLiteLLM(): Promise<void> {
    try {
      // Check if team exists in LiteLLM
      await this.liteLLMService.getTeamInfo(DefaultTeamService.DEFAULT_TEAM_ID);
      this.fastify.log.debug(
        { teamId: DefaultTeamService.DEFAULT_TEAM_ID },
        'Default team already exists in LiteLLM',
      );
    } catch (error) {
      // Team doesn't exist in LiteLLM, create it
      this.fastify.log.info(
        { teamId: DefaultTeamService.DEFAULT_TEAM_ID },
        'Creating default team in LiteLLM',
      );

      await this.liteLLMService.createTeam({
        team_id: DefaultTeamService.DEFAULT_TEAM_ID,
        team_alias: DefaultTeamService.DEFAULT_TEAM_NAME,
        max_budget: 10000,
        tpm_limit: 50000,
        rpm_limit: 1000,
        models: [], // Empty array enables all models
        admins: [], // No specific admins initially
      });

      this.fastify.log.info(
        { teamId: DefaultTeamService.DEFAULT_TEAM_ID },
        'Successfully created default team in LiteLLM',
      );
    }
  }

  /**
   * Assigns a user to the default team in the database
   */
  async assignUserToDefaultTeam(userId: string): Promise<void> {
    try {
      // Check if user is already a member of the default team
      const existingMembership = await this.fastify.dbUtils.queryOne(
        'SELECT id FROM team_members WHERE user_id = $1 AND team_id = $2',
        [userId, DefaultTeamService.DEFAULT_TEAM_ID],
      );

      if (!existingMembership) {
        // Add user to default team
        await this.fastify.dbUtils.query(
          'INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (team_id, user_id) DO NOTHING',
          [DefaultTeamService.DEFAULT_TEAM_ID, userId, 'member'],
        );

        this.fastify.log.info(
          { userId, teamId: DefaultTeamService.DEFAULT_TEAM_ID },
          'Successfully assigned user to default team',
        );
      } else {
        this.fastify.log.debug(
          { userId, teamId: DefaultTeamService.DEFAULT_TEAM_ID },
          'User already assigned to default team',
        );
      }
    } catch (error) {
      this.fastify.log.error(
        {
          userId,
          teamId: DefaultTeamService.DEFAULT_TEAM_ID,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to assign user to default team',
      );
      throw error;
    }
  }

  /**
   * Gets a user's primary team, falling back to default team
   */
  async getUserPrimaryTeam(userId: string): Promise<string> {
    try {
      const teamMembership = await this.fastify.dbUtils.queryOne(
        `SELECT t.id as team_id, t.name as team_name
         FROM team_members tm
         JOIN teams t ON tm.team_id = t.id
         WHERE tm.user_id = $1 AND t.is_active = true
         ORDER BY tm.joined_at ASC
         LIMIT 1`,
        [userId],
      );

      if (teamMembership) {
        this.fastify.log.debug(
          { userId, teamId: teamMembership.team_id, teamName: teamMembership.team_name },
          'Found user primary team',
        );
        return String(teamMembership.team_id);
      }

      // No team membership found, assign to default team and return it
      this.fastify.log.info(
        { userId, defaultTeamId: DefaultTeamService.DEFAULT_TEAM_ID },
        'No team membership found, assigning user to default team',
      );

      await this.assignUserToDefaultTeam(userId);
      return DefaultTeamService.DEFAULT_TEAM_ID;
    } catch (error) {
      this.fastify.log.warn(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error getting user primary team, falling back to default team',
      );
      return DefaultTeamService.DEFAULT_TEAM_ID;
    }
  }

  /**
   * Ensures all users without team membership are assigned to default team
   */
  async migrateOrphanedUsersToDefaultTeam(): Promise<number> {
    try {
      // Ensure default team exists first
      await this.ensureDefaultTeamExists();

      // Find users without team membership
      const orphanedUsers = await this.fastify.dbUtils.query(
        `SELECT u.id
         FROM users u
         WHERE u.id NOT IN (
           SELECT DISTINCT user_id 
           FROM team_members 
           WHERE team_id = $1
         )`,
        [DefaultTeamService.DEFAULT_TEAM_ID],
      );

      if (orphanedUsers.rows.length === 0) {
        this.fastify.log.info('No orphaned users found - all users already assigned to default team');
        return 0;
      }

      // Assign all orphaned users to default team
      const userIds = orphanedUsers.rows.map((row) => row.id);
      const values = userIds
        .map((_, index) => `($1, $${index + 2}, 'member', NOW())`)
        .join(', ');

      await this.fastify.dbUtils.query(
        `INSERT INTO team_members (team_id, user_id, role, joined_at)
         VALUES ${values}
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [DefaultTeamService.DEFAULT_TEAM_ID, ...userIds],
      );

      this.fastify.log.info(
        {
          assignedCount: orphanedUsers.rows.length,
          teamId: DefaultTeamService.DEFAULT_TEAM_ID,
        },
        'Successfully migrated orphaned users to default team',
      );

      return orphanedUsers.rows.length;
    } catch (error) {
      this.fastify.log.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to migrate orphaned users to default team',
      );
      throw error;
    }
  }

  /**
   * Gets default team statistics
   */
  async getDefaultTeamStats(): Promise<{
    teamId: string;
    memberCount: number;
    activeUsers: number;
    totalSpend: number;
    budgetUtilization: number;
  }> {
    try {
      const stats = await this.fastify.dbUtils.queryOne(
        `SELECT 
           COUNT(tm.user_id) as member_count,
           COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_users,
           COALESCE(t.current_spend, 0) as total_spend,
           COALESCE(t.max_budget, 0) as max_budget
         FROM teams t
         LEFT JOIN team_members tm ON t.id = tm.team_id
         LEFT JOIN users u ON tm.user_id = u.id
         WHERE t.id = $1
         GROUP BY t.id, t.current_spend, t.max_budget`,
        [DefaultTeamService.DEFAULT_TEAM_ID],
      );

      const totalSpend = Number(stats?.total_spend || 0);
      const maxBudget = Number(stats?.max_budget || 1);
      const budgetUtilization = (totalSpend / maxBudget) * 100;

      return {
        teamId: DefaultTeamService.DEFAULT_TEAM_ID,
        memberCount: Number(stats?.member_count || 0),
        activeUsers: Number(stats?.active_users || 0),
        totalSpend,
        budgetUtilization,
      };
    } catch (error) {
      this.fastify.log.error(
        {
          teamId: DefaultTeamService.DEFAULT_TEAM_ID,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get default team statistics',
      );
      throw error;
    }
  }
}
import { FastifyInstance } from 'fastify';
import { LiteLLMService } from '../services/litellm.service.js';
import { DefaultTeamService } from '../services/default-team.service.js';
import { LiteLLMUserRequest } from '../types/user.types.js';

/**
 * Utilities for LiteLLM synchronization operations.
 * These utilities are shared between services that need to ensure users and teams exist in LiteLLM.
 */
export class LiteLLMSyncUtils {
  /**
   * Ensures user exists in LiteLLM backend, creating them if necessary
   * @param userId - The user ID to ensure exists
   * @param fastify - Fastify instance for database access
   * @param liteLLMService - LiteLLM service instance
   */
  static async ensureUserExistsInLiteLLM(
    userId: string,
    fastify: FastifyInstance,
    liteLLMService: LiteLLMService,
  ): Promise<void> {
    try {
      // Log LiteLLM service configuration for debugging
      const liteLLMMetrics = liteLLMService.getMetrics();
      fastify.log.debug(
        {
          userId,
          liteLLMConfig: {
            enableMocking: liteLLMMetrics.config.enableMocking,
            baseUrl: liteLLMMetrics.config.baseUrl,
            timeout: liteLLMMetrics.config.timeout,
          },
        },
        'Checking if user exists in LiteLLM',
      );

      // First check if user exists in LiteLLM (now returns null for non-existent users)
      const existingUser = await liteLLMService.getUserInfo(userId);
      if (existingUser) {
        fastify.log.info(
          {
            userId,
            existingUser: {
              user_id: existingUser.user_id,
              user_alias: existingUser.user_alias,
              spend: existingUser.spend,
              max_budget: existingUser.max_budget,
              teams: existingUser.teams,
            },
          },
          'User already exists in LiteLLM',
        );
        return; // User exists, nothing to do
      }

      // User doesn't exist in LiteLLM, create them
      fastify.log.info(
        {
          userId,
          isMocking: liteLLMService.getMetrics().config.enableMocking,
        },
        'User not found in LiteLLM, attempting to create',
      );

      // Get user information from database
      const user = await fastify.dbUtils.queryOne(
        'SELECT id, username, email, full_name, roles, max_budget, tpm_limit, rpm_limit FROM users WHERE id = $1',
        [userId],
      );

      if (!user) {
        throw new Error(`User ${userId} not found in database`);
      }

      // Get user's team (fallback to default team)
      const userTeam = await LiteLLMSyncUtils.getUserPrimaryTeam(userId, fastify, liteLLMService);

      // Ensure the team exists in LiteLLM before creating user
      await LiteLLMSyncUtils.ensureTeamExistsInLiteLLM(userTeam, fastify, liteLLMService);

      const createUserRequest: LiteLLMUserRequest = {
        user_id: String(user.id),
        user_email: user.email as string,
        user_alias: user.username as string,
        user_role: (user.roles as string[])?.includes('admin')
          ? 'proxy_admin'
          : ('internal_user' as 'proxy_admin' | 'internal_user' | 'internal_user_viewer'),
        max_budget: Number(user.max_budget) || Number(process.env.DEFAULT_USER_MAX_BUDGET) || 100,
        tpm_limit: Number(user.tpm_limit) || Number(process.env.DEFAULT_USER_TPM_LIMIT) || 10000,
        rpm_limit: Number(user.rpm_limit) || Number(process.env.DEFAULT_USER_RPM_LIMIT) || 60,
        auto_create_key: false,
        teams: [userTeam], // CRITICAL: Always assign user to a team
      };

      fastify.log.info(
        {
          userId,
          createUserRequest,
          isMocking: liteLLMService.getMetrics().config.enableMocking,
        },
        'Sending user creation request to LiteLLM',
      );

      // Create user in LiteLLM
      const createdUser = await liteLLMService.createUser(createUserRequest);

      fastify.log.info(
        {
          userId,
          createdUser: {
            user_id: createdUser.user_id,
            user_alias: createdUser.user_alias,
            max_budget: createdUser.max_budget,
            spend: createdUser.spend,
            created_at: createdUser.created_at,
          },
          isMocking: liteLLMService.getMetrics().config.enableMocking,
        },
        'LiteLLM user creation response received',
      );

      // Verify user was actually created by attempting to fetch it
      const verificationUser = await liteLLMService.getUserInfo(userId);
      if (!verificationUser) {
        fastify.log.error(
          {
            userId,
            isMocking: liteLLMService.getMetrics().config.enableMocking,
          },
          'CRITICAL: User creation appeared to succeed but verification failed',
        );
        throw new Error('User creation verification failed: user not found after creation');
      }

      fastify.log.info(
        {
          userId,
          verificationUser: {
            user_id: verificationUser.user_id,
            user_alias: verificationUser.user_alias,
            teams: verificationUser.teams,
          },
        },
        'Verified user exists in LiteLLM after creation',
      );

      // Update user sync status in database
      await fastify.dbUtils.query(
        'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
        ['synced', userId],
      );

      fastify.log.info({ userId }, 'Successfully created and verified user in LiteLLM');
    } catch (error) {
      // Check if error is due to user already existing (by email)
      if (error instanceof Error && error.message && error.message.includes('already exists')) {
        fastify.log.info(
          { userId, error: error.message },
          'User already exists in LiteLLM (by email) - continuing with operation',
        );
        // Don't throw - user exists, which is what we wanted
        // Update sync status to success since user exists
        await fastify.dbUtils.query(
          'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
          ['synced', userId],
        );
        return;
      }

      // Update user sync status to error for other errors
      await fastify.dbUtils.query(
        'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
        ['error', userId],
      );

      fastify.log.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          isMocking: liteLLMService.getMetrics().config.enableMocking,
        },
        'Failed to create user in LiteLLM',
      );

      throw new Error(
        `Failed to create user in LiteLLM: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Ensures team exists in LiteLLM backend, creating it if necessary
   * @param teamId - The team ID to ensure exists
   * @param fastify - Fastify instance for database access
   * @param liteLLMService - LiteLLM service instance
   */
  static async ensureTeamExistsInLiteLLM(
    teamId: string,
    fastify: FastifyInstance,
    liteLLMService: LiteLLMService,
  ): Promise<void> {
    try {
      // First check if team exists in LiteLLM
      const existingTeam = await liteLLMService.getTeamInfo(teamId);
      fastify.log.info(
        {
          teamId,
          existingTeam: {
            team_id: existingTeam.team_id,
            team_alias: existingTeam.team_alias,
            spend: existingTeam.spend,
            max_budget: existingTeam.max_budget,
          },
        },
        'Team already exists in LiteLLM',
      );
    } catch (error) {
      // Team doesn't exist in LiteLLM, get team from database and create it
      fastify.log.info(
        {
          teamId,
          error: error instanceof Error ? error.message : 'Unknown error',
          isMocking: liteLLMService.getMetrics().config.enableMocking,
        },
        'Team not found in LiteLLM, attempting to create',
      );

      try {
        // Get team information from database
        const team = await fastify.dbUtils.queryOne(
          'SELECT id, name, description, max_budget, tpm_limit, rpm_limit FROM teams WHERE id = $1',
          [teamId],
        );

        if (!team) {
          throw new Error(`Team ${teamId} not found in database`);
        }

        const createTeamRequest = {
          team_id: String(team.id),
          team_alias: team.name as string,
          max_budget: Number(team.max_budget) || 1000, // Use team's budget or default
          tpm_limit: Number(team.tpm_limit) || 10000, // Use team's limit or default
          rpm_limit: Number(team.rpm_limit) || 500, // Use team's limit or default
          admins: [], // Will be populated from team members
          models: [], // Empty array enables all models
        };

        fastify.log.info(
          {
            teamId,
            createTeamRequest,
            isMocking: liteLLMService.getMetrics().config.enableMocking,
          },
          'Sending team creation request to LiteLLM',
        );

        // Create team in LiteLLM
        const createdTeam = await liteLLMService.createTeam(createTeamRequest);

        fastify.log.info(
          {
            teamId,
            createdTeam: {
              team_id: createdTeam.team_id,
              team_alias: createdTeam.team_alias,
              max_budget: createdTeam.max_budget,
              spend: createdTeam.spend,
              created_at: createdTeam.created_at,
            },
            isMocking: liteLLMService.getMetrics().config.enableMocking,
          },
          'LiteLLM team creation response received',
        );

        // Verify team was actually created by attempting to fetch it
        try {
          const verificationTeam = await liteLLMService.getTeamInfo(teamId);
          fastify.log.info(
            {
              teamId,
              verificationTeam: {
                team_id: verificationTeam.team_id,
                team_alias: verificationTeam.team_alias,
              },
            },
            'Verified team exists in LiteLLM after creation',
          );
        } catch (verifyError) {
          fastify.log.error(
            {
              teamId,
              verifyError: verifyError instanceof Error ? verifyError.message : 'Unknown error',
              isMocking: liteLLMService.getMetrics().config.enableMocking,
            },
            'CRITICAL: Team creation appeared to succeed but team cannot be retrieved from LiteLLM',
          );
          throw new Error(
            `Team creation verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
          );
        }

        fastify.log.info({ teamId }, 'Successfully created and verified team in LiteLLM');
      } catch (createError) {
        fastify.log.error(
          {
            teamId,
            error: createError instanceof Error ? createError.message : 'Unknown error',
            errorStack: createError instanceof Error ? createError.stack : undefined,
            isMocking: liteLLMService.getMetrics().config.enableMocking,
          },
          'Failed to create team in LiteLLM',
        );

        throw new Error(
          `Failed to create team in LiteLLM: ${createError instanceof Error ? createError.message : 'Unknown error'}`,
        );
      }
    }
  }

  /**
   * Gets user's primary team, defaults to 'default-team' if none found
   * @param userId - The user ID to get primary team for
   * @param fastify - Fastify instance for database access
   * @param liteLLMService - LiteLLM service instance
   * @returns Promise resolving to the team ID
   */
  static async getUserPrimaryTeam(
    userId: string,
    fastify: FastifyInstance,
    liteLLMService: LiteLLMService,
  ): Promise<string> {
    const defaultTeamService = new DefaultTeamService(fastify, liteLLMService);
    return await defaultTeamService.getUserPrimaryTeam(userId);
  }
}

import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';
import { LiteLLMService } from './litellm.service';
import type { LiteLLMUserRequest } from '../types/user.types';

export interface BulkUpdateUserLimitsRequest {
  maxBudget?: number;
  tpmLimit?: number;
  rpmLimit?: number;
}

export interface BulkUpdateUserLimitsResponse {
  totalUsers: number;
  successCount: number;
  failedCount: number;
  errors: Array<{
    userId: string;
    username: string;
    error: string;
  }>;
  processedAt: string;
}

interface UserRecord {
  id: string;
  username: string;
  email: string;
  max_budget: number;
  tpm_limit: number;
  rpm_limit: number;
}

export class AdminService extends BaseService {
  private litellmService: LiteLLMService;

  constructor(fastify: FastifyInstance) {
    super(fastify);
    this.litellmService = new LiteLLMService(fastify, {
      baseUrl: process.env.LITELLM_API_URL!,
      apiKey: process.env.LITELLM_API_KEY!,
      enableMocking: process.env.LITELLM_ENABLE_MOCKING === 'true',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    });
  }

  /**
   * Bulk update user limits for all active users
   * Updates both LiteMaaS database and LiteLLM
   */
  async bulkUpdateUserLimits(
    updates: BulkUpdateUserLimitsRequest,
  ): Promise<BulkUpdateUserLimitsResponse> {
    this.fastify.log.info({ updates }, 'Starting bulk user limits update');

    // Validate that at least one update is provided
    if (!updates.maxBudget && !updates.tpmLimit && !updates.rpmLimit) {
      throw new Error('At least one limit value must be provided');
    }

    if (this.shouldUseMockData()) {
      return this.createMockBulkUpdateResponse(updates);
    }

    const client = await this.fastify.pg.connect();
    const results: BulkUpdateUserLimitsResponse = {
      totalUsers: 0,
      successCount: 0,
      failedCount: 0,
      errors: [],
      processedAt: new Date().toISOString(),
    };

    try {
      // Start transaction for database updates
      await client.query('BEGIN');

      // Get all active users
      const userQuery = `
        SELECT id, username, email, max_budget, tpm_limit, rpm_limit 
        FROM users 
        WHERE is_active = true 
        ORDER BY username
      `;

      const userResult = await client.query<UserRecord>(userQuery);
      const users = userResult.rows;
      results.totalUsers = users.length;

      this.fastify.log.info({ userCount: users.length }, 'Found active users to update');

      if (users.length === 0) {
        await client.query('ROLLBACK');
        return results;
      }

      // Update database records
      const updateQuery = `
        UPDATE users 
        SET max_budget = COALESCE($2, max_budget),
            tpm_limit = COALESCE($3, tpm_limit),
            rpm_limit = COALESCE($4, rpm_limit),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      for (const user of users) {
        try {
          // Update database
          await client.query(updateQuery, [
            user.id,
            updates.maxBudget,
            updates.tpmLimit,
            updates.rpmLimit,
          ]);

          // Prepare LiteLLM update payload
          const litellmUpdates: Partial<LiteLLMUserRequest> = {};
          if (updates.maxBudget !== undefined) litellmUpdates.max_budget = updates.maxBudget;
          if (updates.tpmLimit !== undefined) litellmUpdates.tpm_limit = updates.tpmLimit;
          if (updates.rpmLimit !== undefined) litellmUpdates.rpm_limit = updates.rpmLimit;

          // Update LiteLLM (outside transaction since it's external API)
          try {
            await this.litellmService.updateUser(user.id, litellmUpdates);
            results.successCount++;

            this.fastify.log.debug(
              {
                userId: user.id,
                username: user.username,
                updates: litellmUpdates,
              },
              'Successfully updated user',
            );
          } catch (litellmError) {
            // LiteLLM failed but database update succeeded
            results.failedCount++;
            results.errors.push({
              userId: user.id,
              username: user.username,
              error: `LiteLLM update failed: ${(litellmError as Error).message}`,
            });

            this.fastify.log.warn(
              {
                userId: user.id,
                username: user.username,
                error: litellmError,
              },
              'LiteLLM update failed but database updated',
            );
          }
        } catch (dbError) {
          // Database update failed
          results.failedCount++;
          results.errors.push({
            userId: user.id,
            username: user.username,
            error: `Database update failed: ${(dbError as Error).message}`,
          });

          this.fastify.log.error(
            {
              userId: user.id,
              username: user.username,
              error: dbError,
            },
            'Database update failed',
          );
        }
      }

      // Commit database transaction
      await client.query('COMMIT');

      this.fastify.log.info(
        {
          totalUsers: results.totalUsers,
          successCount: results.successCount,
          failedCount: results.failedCount,
          errorCount: results.errors.length,
        },
        'Bulk user limits update completed',
      );

      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      this.fastify.log.error({ error }, 'Failed to execute bulk user limits update');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create mock response for development/testing
   */
  private createMockBulkUpdateResponse(
    updates: BulkUpdateUserLimitsRequest,
  ): Promise<BulkUpdateUserLimitsResponse> {
    const mockResponse: BulkUpdateUserLimitsResponse = {
      totalUsers: 25,
      successCount: 23,
      failedCount: 2,
      errors: [
        {
          userId: 'mock-user-1',
          username: 'test.user1',
          error: 'LiteLLM update failed: Connection timeout',
        },
        {
          userId: 'mock-user-2',
          username: 'test.user2',
          error: 'Database update failed: Invalid data format',
        },
      ],
      processedAt: new Date().toISOString(),
    };

    this.fastify.log.info({ updates, mockResponse }, 'Returning mock bulk update response');
    return this.createMockResponse(mockResponse);
  }

  /**
   * Get system statistics for admin dashboard
   */
  async getSystemStats() {
    if (this.shouldUseMockData()) {
      return this.createMockResponse({
        totalUsers: 150,
        activeUsers: 142,
        totalApiKeys: 78,
        activeApiKeys: 65,
        totalModels: 25,
        availableModels: 23,
      });
    }

    const client = await this.fastify.pg.connect();
    try {
      const statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
          (SELECT COUNT(*) FROM api_keys) as total_api_keys,
          (SELECT COUNT(*) FROM api_keys WHERE is_active = true) as active_api_keys,
          (SELECT COUNT(*) FROM models) as total_models,
          (SELECT COUNT(*) FROM models WHERE availability = 'available') as available_models
      `;

      const result = await client.query(statsQuery);
      const stats = result.rows[0];

      return {
        totalUsers: parseInt(stats.total_users),
        activeUsers: parseInt(stats.active_users),
        totalApiKeys: parseInt(stats.total_api_keys),
        activeApiKeys: parseInt(stats.active_api_keys),
        totalModels: parseInt(stats.total_models),
        availableModels: parseInt(stats.available_models),
      };
    } finally {
      client.release();
    }
  }
}

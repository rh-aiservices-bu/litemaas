// backend/src/services/admin-usage/admin-usage-enrichment.service.ts

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service';
import { ApplicationError } from '../../utils/errors';
import { UNKNOWN_USER_ID, UNKNOWN_USERNAME } from './admin-usage.utils';

/**
 * Service for enriching usage data with user and API key information
 *
 * Provides efficient data enrichment using batch queries to avoid N+1 problems.
 * Handles missing data gracefully with unknown user/key placeholders.
 */
export class AdminUsageEnrichmentService extends BaseService {
  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  // ============================================================================
  // User Enrichment
  // ============================================================================

  /**
   * Enrich usage data with user information
   *
   * Takes usage data keyed by API key and enriches with user details.
   * Uses batch queries to efficiently fetch user data.
   *
   * @param apiKeyUsage - Map of API key hash to usage data
   * @returns Map enriched with user data (userId, username, email, role)
   */
  async enrichWithUserData(apiKeyUsage: Map<string, UsageData>): Promise<EnrichedUsageData[]> {
    try {
      // Get API key to user mapping (batch query)
      const apiKeys = Array.from(apiKeyUsage.keys());
      const apiKeyMapping = await this.getAPIKeyUserMapping(apiKeys);

      // Get unique user IDs
      const userIds = [
        ...new Set(
          Object.values(apiKeyMapping)
            .map((m) => m.userId)
            .filter((id) => id !== null),
        ),
      ];

      // Batch fetch user data
      const users = await this.getUsersById(userIds);
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Enrich each entry
      const enriched: EnrichedUsageData[] = [];

      for (const [apiKey, usage] of apiKeyUsage.entries()) {
        const mapping = apiKeyMapping[apiKey];
        const user = mapping ? userMap.get(mapping.userId) : null;

        enriched.push({
          ...usage,
          apiKeyHash: apiKey,
          apiKeyAlias: mapping?.keyAlias || 'Unknown Key',
          userId: user?.id || UNKNOWN_USER_ID,
          username: user?.username || UNKNOWN_USERNAME,
          email: user?.email || null,
          role: user?.role || 'user',
        });
      }

      return enriched;
    } catch (error) {
      this.fastify.log.error({ error }, 'Failed to enrich with user data');
      throw ApplicationError.internal('Failed to enrich usage data', { error });
    }
  }

  /**
   * Batch fetch API key to user mapping
   *
   * Uses single query with IN clause to avoid N+1 problem.
   *
   * @param apiKeys - Array of API key hashes
   * @returns Mapping of API key to user ID and alias
   */
  private async getAPIKeyUserMapping(
    apiKeys: string[],
  ): Promise<Record<string, { userId: string; keyAlias: string }>> {
    if (apiKeys.length === 0) {
      return {};
    }

    try {
      // Single query for all API keys
      const result = await this.fastify.pg.query(
        `SELECT key_hash, user_id, name
         FROM api_keys
         WHERE key_hash = ANY($1)
           AND deleted_at IS NULL`,
        [apiKeys],
      );

      // Build mapping
      return result.rows.reduce(
        (acc, row) => {
          acc[row.key_hash] = {
            userId: row.user_id,
            keyAlias: row.name || 'Unnamed Key',
          };
          return acc;
        },
        {} as Record<string, { userId: string; keyAlias: string }>,
      );
    } catch (error) {
      this.fastify.log.error(
        { error, apiKeyCount: apiKeys.length },
        'Failed to fetch API key mapping',
      );
      throw ApplicationError.internal('Failed to fetch API key mapping', { error });
    }
  }

  /**
   * Batch fetch users by IDs
   *
   * Uses single query with IN clause to avoid N+1 problem.
   *
   * @param userIds - Array of user IDs
   * @returns Array of user objects
   */
  private async getUsersById(userIds: string[]): Promise<UserData[]> {
    if (userIds.length === 0) {
      return [];
    }

    try {
      // Single query for all users
      const result = await this.fastify.pg.query(
        `SELECT id, username, email, role
         FROM users
         WHERE id = ANY($1)
           AND deleted_at IS NULL`,
        [userIds],
      );

      return result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
      }));
    } catch (error) {
      this.fastify.log.error({ error, userIdCount: userIds.length }, 'Failed to fetch users');
      throw ApplicationError.internal('Failed to fetch users', { error });
    }
  }

  // ============================================================================
  // Aggregation by User
  // ============================================================================

  /**
   * Aggregate enriched usage data by user
   *
   * Combines usage from multiple API keys belonging to same user.
   *
   * @param enrichedData - Array of enriched usage data
   * @returns Map of user ID to aggregated usage
   */
  aggregateByUser(enrichedData: EnrichedUsageData[]): Map<string, UserUsageAggregate> {
    const userAggregates = new Map<string, UserUsageAggregate>();

    for (const data of enrichedData) {
      const userId = data.userId;
      const existing = userAggregates.get(userId);

      if (existing) {
        // Add to existing aggregate
        existing.totalRequests += data.totalRequests;
        existing.totalTokens += data.totalTokens;
        existing.promptTokens += data.promptTokens;
        existing.completionTokens += data.completionTokens;
        existing.totalCost += data.totalCost;
        existing.apiKeyCount += 1;
      } else {
        // Create new aggregate
        userAggregates.set(userId, {
          userId: data.userId,
          username: data.username,
          email: data.email,
          role: data.role,
          totalRequests: data.totalRequests,
          totalTokens: data.totalTokens,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalCost: data.totalCost,
          apiKeyCount: 1,
        });
      }
    }

    return userAggregates;
  }

  /**
   * Aggregate enriched usage data by model
   *
   * Groups usage by model name across all users.
   *
   * @param enrichedData - Array of enriched usage data (with model info)
   * @returns Map of model name to aggregated usage
   */
  aggregateByModel(enrichedData: EnrichedUsageDataWithModel[]): Map<string, ModelUsageAggregate> {
    const modelAggregates = new Map<string, ModelUsageAggregate>();

    for (const data of enrichedData) {
      const modelKey = `${data.model}|${data.provider || 'unknown'}`;
      const existing = modelAggregates.get(modelKey);

      if (existing) {
        existing.totalRequests += data.totalRequests;
        existing.totalTokens += data.totalTokens;
        existing.promptTokens += data.promptTokens;
        existing.completionTokens += data.completionTokens;
        existing.totalCost += data.totalCost;
        existing.uniqueUsers.add(data.userId);
      } else {
        modelAggregates.set(modelKey, {
          model: data.model,
          provider: data.provider,
          totalRequests: data.totalRequests,
          totalTokens: data.totalTokens,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalCost: data.totalCost,
          uniqueUsers: new Set([data.userId]),
        });
      }
    }

    return modelAggregates;
  }

  // ============================================================================
  // Validation & Helpers
  // ============================================================================

  /**
   * Check if user data is complete
   *
   * @param userData - User data to check
   * @returns True if all required fields present
   */
  isCompleteUserData(userData: Partial<UserData>): boolean {
    return !!(userData.id && userData.username);
  }

  /**
   * Create unknown user placeholder
   *
   * @returns Unknown user data object
   */
  createUnknownUser(): UserData {
    return {
      id: UNKNOWN_USER_ID,
      username: UNKNOWN_USERNAME,
      email: null,
      role: 'user',
    };
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Basic usage data (not yet enriched)
 */
export interface UsageData {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

/**
 * Enriched usage data with user info
 */
export interface EnrichedUsageData extends UsageData {
  apiKeyHash: string;
  apiKeyAlias: string;
  userId: string;
  username: string;
  email: string | null;
  role: string;
}

/**
 * Enriched usage data with model info
 */
export interface EnrichedUsageDataWithModel extends EnrichedUsageData {
  model: string;
  provider: string | null;
}

/**
 * User data from database
 */
export interface UserData {
  id: string;
  username: string;
  email: string | null;
  role: string;
}

/**
 * Aggregated usage by user
 */
export interface UserUsageAggregate {
  userId: string;
  username: string;
  email: string | null;
  role: string;
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  apiKeyCount: number;
}

/**
 * Aggregated usage by model
 */
export interface ModelUsageAggregate {
  model: string;
  provider: string | null;
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  uniqueUsers: Set<string>;
}

import { FastifyInstance } from 'fastify';
import { BaseService } from '../base.service.js';
import { parseISO, format, eachDayOfInterval, isToday } from 'date-fns';
import {
  AdminUsageFilters,
  EnrichedDayData,
  AggregatedUsageData,
  UserBreakdown,
  ModelBreakdown,
  ProviderBreakdown,
  UserSummary,
  ModelSummary,
  ApiKeySummary,
  DailyUsageSummary,
  DailyModelUsage,
  DailyModelMetrics,
  CostBreakdown,
  LiteLLMDayData,
  ApiKeyUserMapping,
  IDailyUsageCacheManager,
} from '../../types/admin-usage.types.js';
import {
  UNKNOWN_USER_ID,
  UNKNOWN_USERNAME,
  extractProviderFromModel,
  isHistoricalDate,
} from './admin-usage.utils.js';
import { LiteLLMService } from '../litellm.service.js';
import { ApplicationError } from '../../utils/errors.js';

/**
 * Service for aggregating enriched usage data
 *
 * Handles complex aggregation logic with multi-dimensional filtering:
 * - User filtering
 * - Model filtering
 * - API key filtering (most complex - requires drilling into nested api_keys breakdown)
 *
 * Key responsibilities:
 * - Aggregate enriched daily data with filter support
 * - Generate user/model/provider breakdowns
 * - Calculate total metrics respecting filters
 * - Handle API key filtering through user->model->api_key hierarchy
 * - Data pipeline (fetch → enrich → cache → aggregate)
 */
export class AdminUsageAggregationService extends BaseService {
  private liteLLMService: LiteLLMService;
  private cacheManager: IDailyUsageCacheManager | null = null;

  // Constants for unknown/unmapped entities
  private readonly UNKNOWN_EMAIL = 'unknown@system.local';
  private readonly UNKNOWN_ROLE = 'user';

  constructor(
    fastify: FastifyInstance,
    liteLLMService: LiteLLMService,
    cacheManager?: IDailyUsageCacheManager,
  ) {
    super(fastify);
    this.liteLLMService = liteLLMService;
    if (cacheManager) {
      this.cacheManager = cacheManager;
    }
  }

  // ============================================================================
  // Main Aggregation Methods
  // ============================================================================

  /**
   * Aggregate daily data with filters
   *
   * This is the core aggregation method that processes enriched daily data
   * and applies filters. The complexity comes from the API key filter which
   * requires drilling into the user->model->api_key nested structure.
   *
   * @param dailyData - Array of enriched daily data
   * @param filters - Filters to apply (userIds, modelIds, apiKeyIds)
   * @returns Aggregated usage data with breakdowns
   */
  aggregateDailyData(
    dailyData: EnrichedDayData[],
    filters: AdminUsageFilters,
  ): AggregatedUsageData {
    const aggregated: AggregatedUsageData = {
      period: {
        startDate: dailyData[0].date,
        endDate: dailyData[dailyData.length - 1].date,
      },
      totalMetrics: {
        api_requests: 0,
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        spend: 0,
        successful_requests: 0,
        failed_requests: 0,
        success_rate: 0,
      },
      byUser: {},
      byModel: {},
      byProvider: {},
    };

    // Aggregate metrics across all days
    dailyData.forEach((day) => {
      // NOTE: Don't aggregate totalMetrics from day.metrics here - it would bypass filters
      // Instead, we'll calculate totalMetrics from filtered breakdowns after the loop

      // Aggregate by user
      Object.entries(day.breakdown.users || {}).forEach(([userId, userData]) => {
        // Skip users not in filter (if filter is specified)
        if (filters.userIds && filters.userIds.length > 0 && !filters.userIds.includes(userId)) {
          return; // Skip this user
        }

        if (!aggregated.byUser[userId]) {
          aggregated.byUser[userId] = {
            userId: userData.userId,
            username: userData.username,
            email: userData.email,
            role: userData.role,
            metrics: {
              api_requests: 0,
              total_tokens: 0,
              prompt_tokens: 0,
              completion_tokens: 0,
              spend: 0,
              successful_requests: 0,
              failed_requests: 0,
            },
            models: {},
          };
        }

        // Aggregate user's models first to calculate filtered totals
        Object.entries(userData.models || {}).forEach(([modelName, modelData]) => {
          // Skip models not in filter (if filter is specified)
          if (
            filters.modelIds &&
            filters.modelIds.length > 0 &&
            !filters.modelIds.includes(modelName)
          ) {
            return; // Skip this model
          }

          if (!aggregated.byUser[userId].models[modelName]) {
            aggregated.byUser[userId].models[modelName] = {
              modelName,
              metrics: {
                api_requests: 0,
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                spend: 0,
                successful_requests: 0,
                failed_requests: 0,
              },
            };
          }

          // Conditional aggregation based on API key filter
          const modelAgg = aggregated.byUser[userId].models[modelName].metrics;
          const userAgg = aggregated.byUser[userId].metrics;

          if (filters.apiKeyIds && filters.apiKeyIds.length > 0) {
            // API key filter active - iterate through api_keys and sum only matching keys
            const apiKeysInModel = Object.keys(modelData.api_keys || {});
            this.fastify.log.debug(
              {
                userId,
                modelName,
                filterApiKeyIds: filters.apiKeyIds,
                modelApiKeys: apiKeysInModel,
                hasApiKeysField: !!modelData.api_keys,
              },
              'API key filtering: checking model data',
            );

            Object.entries(modelData.api_keys || {}).forEach(([keyAlias, keyData]) => {
              // Filter by API key alias
              if (!filters.apiKeyIds!.includes(keyAlias)) {
                this.fastify.log.debug(
                  {
                    keyAlias,
                    filterApiKeyIds: filters.apiKeyIds,
                    match: false,
                  },
                  'API key filtering: key not in filter, skipping',
                );
                return; // Skip this API key's metrics
              }

              this.fastify.log.debug(
                {
                  keyAlias,
                  requests: keyData.metrics.api_requests,
                },
                'API key filtering: key matched, including metrics',
              );

              // Aggregate only the filtered API key's metrics to model totals
              modelAgg.api_requests += keyData.metrics.api_requests;
              modelAgg.total_tokens += keyData.metrics.total_tokens;
              modelAgg.prompt_tokens += keyData.metrics.prompt_tokens ?? 0;
              modelAgg.completion_tokens += keyData.metrics.completion_tokens ?? 0;
              modelAgg.spend += keyData.metrics.spend;
              modelAgg.successful_requests += keyData.metrics.successful_requests || 0;
              modelAgg.failed_requests += keyData.metrics.failed_requests || 0;

              // Aggregate to user's total metrics
              userAgg.api_requests += keyData.metrics.api_requests;
              userAgg.total_tokens += keyData.metrics.total_tokens;
              userAgg.prompt_tokens += keyData.metrics.prompt_tokens ?? 0;
              userAgg.completion_tokens += keyData.metrics.completion_tokens ?? 0;
              userAgg.spend += keyData.metrics.spend;
              userAgg.successful_requests += keyData.metrics.successful_requests || 0;
              userAgg.failed_requests += keyData.metrics.failed_requests || 0;
            });
          } else {
            // No API key filter - use pre-aggregated metrics (fast path)
            modelAgg.api_requests += modelData.metrics.api_requests;
            modelAgg.total_tokens += modelData.metrics.total_tokens;
            modelAgg.prompt_tokens += modelData.metrics.prompt_tokens ?? 0;
            modelAgg.completion_tokens += modelData.metrics.completion_tokens ?? 0;
            modelAgg.spend += modelData.metrics.spend;
            modelAgg.successful_requests += modelData.metrics.successful_requests || 0;
            modelAgg.failed_requests += modelData.metrics.failed_requests || 0;

            // Aggregate to user's total metrics (only filtered models)
            userAgg.api_requests += modelData.metrics.api_requests;
            userAgg.total_tokens += modelData.metrics.total_tokens;
            userAgg.prompt_tokens += modelData.metrics.prompt_tokens ?? 0;
            userAgg.completion_tokens += modelData.metrics.completion_tokens ?? 0;
            userAgg.spend += modelData.metrics.spend;
            userAgg.successful_requests += modelData.metrics.successful_requests || 0;
            userAgg.failed_requests += modelData.metrics.failed_requests || 0;
          }
        });
      });

      // Aggregate by model
      Object.entries(day.breakdown.models || {}).forEach(([modelName, modelData]) => {
        // Skip models not in filter (if filter is specified)
        if (
          filters.modelIds &&
          filters.modelIds.length > 0 &&
          !filters.modelIds.includes(modelName)
        ) {
          return; // Skip this model
        }

        if (!aggregated.byModel[modelName]) {
          aggregated.byModel[modelName] = {
            modelName,
            metrics: {
              api_requests: 0,
              total_tokens: 0,
              prompt_tokens: 0,
              completion_tokens: 0,
              spend: 0,
              successful_requests: 0,
              failed_requests: 0,
            },
            users: {},
          };
        }

        const modelAgg = aggregated.byModel[modelName].metrics;

        // Check if we need to filter by API key or user
        if (
          (filters.apiKeyIds && filters.apiKeyIds.length > 0) ||
          (filters.userIds && filters.userIds.length > 0)
        ) {
          // Aggregate from users who match filters
          Object.entries(day.breakdown.users || {}).forEach(([userId, userData]) => {
            // Skip if user filter active and user not in filter
            if (
              filters.userIds &&
              filters.userIds.length > 0 &&
              !filters.userIds.includes(userId)
            ) {
              return;
            }

            const userModelData = userData.models?.[modelName];
            if (!userModelData) return;

            if (filters.apiKeyIds && filters.apiKeyIds.length > 0) {
              // Aggregate from API key breakdown
              Object.entries(userModelData.api_keys || {}).forEach(
                ([keyAlias, keyData]: [string, any]) => {
                  if (filters.apiKeyIds!.includes(keyAlias)) {
                    modelAgg.api_requests += keyData.metrics.api_requests ?? 0;
                    modelAgg.total_tokens += keyData.metrics.total_tokens ?? 0;
                    modelAgg.prompt_tokens += keyData.metrics.prompt_tokens ?? 0;
                    modelAgg.completion_tokens += keyData.metrics.completion_tokens ?? 0;
                    modelAgg.spend += keyData.metrics.spend ?? 0;
                    modelAgg.successful_requests += keyData.metrics.successful_requests ?? 0;
                    modelAgg.failed_requests += keyData.metrics.failed_requests ?? 0;
                  }
                },
              );
            } else {
              // User filter only, use user's model metrics
              modelAgg.api_requests += userModelData.metrics.api_requests ?? 0;
              modelAgg.total_tokens += userModelData.metrics.total_tokens ?? 0;
              modelAgg.prompt_tokens += userModelData.metrics.prompt_tokens ?? 0;
              modelAgg.completion_tokens += userModelData.metrics.completion_tokens ?? 0;
              modelAgg.spend += userModelData.metrics.spend ?? 0;
              modelAgg.successful_requests += userModelData.metrics.successful_requests ?? 0;
              modelAgg.failed_requests += userModelData.metrics.failed_requests ?? 0;
            }
          });
        } else {
          // No filters, use modelData.metrics (fast path)
          modelAgg.api_requests += modelData.metrics.api_requests;
          modelAgg.total_tokens += modelData.metrics.total_tokens;
          modelAgg.prompt_tokens += modelData.metrics.prompt_tokens ?? 0;
          modelAgg.completion_tokens += modelData.metrics.completion_tokens ?? 0;
          modelAgg.spend += modelData.metrics.spend;
          modelAgg.successful_requests += modelData.metrics.successful_requests;
          modelAgg.failed_requests += modelData.metrics.failed_requests;
        }

        // Aggregate model's users (respecting filters)
        Object.entries(modelData.users || {}).forEach(([userId, userData]) => {
          // Skip if user filter active and user not in filter
          if (filters.userIds && filters.userIds.length > 0 && !filters.userIds.includes(userId)) {
            return;
          }

          if (!aggregated.byModel[modelName].users[userId]) {
            aggregated.byModel[modelName].users[userId] = {
              userId: userData.userId,
              username: userData.username,
              email: userData.email,
              metrics: {
                api_requests: 0,
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                spend: 0,
              },
            };
          }

          const userAgg = aggregated.byModel[modelName].users[userId].metrics;

          // Check if API key filter is active
          if (filters.apiKeyIds && filters.apiKeyIds.length > 0) {
            // Aggregate from API key breakdown
            const userModelData = day.breakdown.users?.[userId]?.models?.[modelName];
            Object.entries(userModelData?.api_keys || {}).forEach(
              ([keyAlias, keyData]: [string, any]) => {
                if (filters.apiKeyIds!.includes(keyAlias)) {
                  userAgg.api_requests += keyData.metrics.api_requests ?? 0;
                  userAgg.total_tokens += keyData.metrics.total_tokens ?? 0;
                  userAgg.prompt_tokens += keyData.metrics.prompt_tokens ?? 0;
                  userAgg.completion_tokens += keyData.metrics.completion_tokens ?? 0;
                  userAgg.spend += keyData.metrics.spend ?? 0;
                }
              },
            );
          } else {
            // No API key filter, use userData metrics
            userAgg.api_requests += userData.metrics.api_requests;
            userAgg.total_tokens += userData.metrics.total_tokens;
            userAgg.prompt_tokens += userData.metrics.prompt_tokens ?? 0;
            userAgg.completion_tokens += userData.metrics.completion_tokens ?? 0;
            userAgg.spend += userData.metrics.spend;
          }
        });
      });

      // Aggregate by provider
      Object.entries(day.breakdown.providers || {}).forEach(([providerName, providerData]) => {
        if (!aggregated.byProvider[providerName]) {
          aggregated.byProvider[providerName] = {
            provider: providerName,
            metrics: {
              api_requests: 0,
              total_tokens: 0,
              prompt_tokens: 0,
              completion_tokens: 0,
              spend: 0,
            },
          };
        }

        const providerAgg = aggregated.byProvider[providerName].metrics;
        providerAgg.api_requests += providerData.metrics.api_requests;
        providerAgg.total_tokens += providerData.metrics.total_tokens;
        providerAgg.prompt_tokens += providerData.metrics.prompt_tokens ?? 0;
        providerAgg.completion_tokens += providerData.metrics.completion_tokens ?? 0;
        providerAgg.spend += providerData.metrics.spend;
      });
    });

    // Calculate totalMetrics from filtered breakdowns
    // This ensures totalMetrics respects the filters applied above
    const hasUserFilter = filters.userIds && filters.userIds.length > 0;
    const hasModelFilter = filters.modelIds && filters.modelIds.length > 0;
    const hasApiKeyFilter = filters.apiKeyIds && filters.apiKeyIds.length > 0;

    // When API key filter is active, we MUST sum from user breakdown
    // because that's where the API key filtering logic is applied
    if (hasApiKeyFilter || hasUserFilter || hasModelFilter) {
      // Any filter that affects user data: sum from filtered users
      // This handles: apiKeyIds alone, userIds alone, modelIds alone, or combinations
      Object.values(aggregated.byUser).forEach((userData: any) => {
        // When we have apiKeyIds or modelIds filters, sum from user's models (more granular)
        // When we only have userIds filter, we can sum from user's total metrics
        if (hasApiKeyFilter || hasModelFilter) {
          // Each user's models breakdown only includes filtered models/API keys
          Object.values(userData.models || {}).forEach((modelData: any) => {
            aggregated.totalMetrics.api_requests += modelData.metrics.api_requests || 0;
            aggregated.totalMetrics.total_tokens += modelData.metrics.total_tokens || 0;
            aggregated.totalMetrics.prompt_tokens += modelData.metrics.prompt_tokens || 0;
            aggregated.totalMetrics.completion_tokens += modelData.metrics.completion_tokens || 0;
            aggregated.totalMetrics.spend += modelData.metrics.spend || 0;
            aggregated.totalMetrics.successful_requests +=
              modelData.metrics.successful_requests || 0;
            aggregated.totalMetrics.failed_requests += modelData.metrics.failed_requests || 0;
          });
        } else {
          // Only user filter: sum from user's total metrics (already aggregated)
          aggregated.totalMetrics.api_requests += userData.metrics.api_requests || 0;
          aggregated.totalMetrics.total_tokens += userData.metrics.total_tokens || 0;
          aggregated.totalMetrics.prompt_tokens += userData.metrics.prompt_tokens || 0;
          aggregated.totalMetrics.completion_tokens += userData.metrics.completion_tokens || 0;
          aggregated.totalMetrics.spend += userData.metrics.spend || 0;
          aggregated.totalMetrics.successful_requests += userData.metrics.successful_requests || 0;
          aggregated.totalMetrics.failed_requests += userData.metrics.failed_requests || 0;
        }
      });
    } else {
      // No filters: sum from all models (most reliable and has success/fail data)
      Object.values(aggregated.byModel).forEach((modelData: any) => {
        aggregated.totalMetrics.api_requests += modelData.metrics.api_requests || 0;
        aggregated.totalMetrics.total_tokens += modelData.metrics.total_tokens || 0;
        aggregated.totalMetrics.prompt_tokens += modelData.metrics.prompt_tokens || 0;
        aggregated.totalMetrics.completion_tokens += modelData.metrics.completion_tokens || 0;
        aggregated.totalMetrics.spend += modelData.metrics.spend || 0;
        aggregated.totalMetrics.successful_requests += modelData.metrics.successful_requests || 0;
        aggregated.totalMetrics.failed_requests += modelData.metrics.failed_requests || 0;
      });
    }

    // Clean up: Remove users with 0 requests (can happen with API key filtering)
    Object.keys(aggregated.byUser).forEach((userId) => {
      if (aggregated.byUser[userId].metrics.api_requests === 0) {
        delete aggregated.byUser[userId];
      }
    });

    // Clean up: Remove models with 0 requests (can happen with user/API key filtering)
    Object.keys(aggregated.byModel).forEach((modelName) => {
      if (aggregated.byModel[modelName].metrics.api_requests === 0) {
        delete aggregated.byModel[modelName];
      }
    });

    // Calculate success rate
    if (aggregated.totalMetrics.api_requests > 0) {
      aggregated.totalMetrics.success_rate =
        (aggregated.totalMetrics.successful_requests / aggregated.totalMetrics.api_requests) * 100;
    }

    return aggregated;
  }

  // ============================================================================
  // Breakdown Methods
  // ============================================================================

  /**
   * Aggregate data by user
   *
   * Converts aggregated data into user breakdown format with model details.
   *
   * @param dailyData - Array of enriched daily data
   * @returns Array of user breakdowns
   */
  aggregateByUser(dailyData: EnrichedDayData[]): UserBreakdown[] {
    // Pass empty filters - no filtering for breakdown methods
    const emptyFilters: AdminUsageFilters = {
      startDate: dailyData[0]?.date || '',
      endDate: dailyData[dailyData.length - 1]?.date || '',
    };
    const aggregated = this.aggregateDailyData(dailyData, emptyFilters);

    return Object.values(aggregated.byUser).map((userData: any) => {
      // Find last active date
      let lastActive: Date | null = null;
      for (const day of [...dailyData].reverse()) {
        if (day.breakdown.users[userData.userId]) {
          // day.date is always a string in YYYY-MM-DD format
          const parsed = parseISO(day.date);
          if (!isNaN(parsed.getTime())) {
            lastActive = parsed;
          }
          break;
        }
      }

      return {
        userId: userData.userId,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        metrics: {
          requests: userData.metrics.api_requests,
          tokens: {
            total: userData.metrics.total_tokens || 0,
            prompt: userData.metrics.prompt_tokens || 0,
            completion: userData.metrics.completion_tokens || 0,
          },
          cost: userData.metrics.spend,
          models: Object.values(userData.models || {}).map((modelData: any) => ({
            modelId: modelData.modelName,
            modelName: modelData.modelName,
            provider: extractProviderFromModel(modelData.modelName),
            requests: modelData.metrics.api_requests,
            tokens: {
              total: modelData.metrics.total_tokens || 0,
              prompt: modelData.metrics.prompt_tokens || 0,
              completion: modelData.metrics.completion_tokens || 0,
            },
            cost: modelData.metrics.spend,
            successRate: 100, // TODO: Track success rate in Phase 2
            averageLatency: 0, // TODO: Track latency in Phase 2
          })),
          apiKeys: [], // TODO: Track API key usage in Phase 2
          lastActive,
        },
      };
    });
  }

  /**
   * Aggregate data by model
   *
   * Converts aggregated data into model breakdown format with top users.
   *
   * @param dailyData - Array of enriched daily data
   * @returns Array of model breakdowns
   */
  aggregateByModel(dailyData: EnrichedDayData[]): ModelBreakdown[] {
    // Pass empty filters - no filtering for breakdown methods
    const emptyFilters: AdminUsageFilters = {
      startDate: dailyData[0]?.date || '',
      endDate: dailyData[dailyData.length - 1]?.date || '',
    };
    const aggregated = this.aggregateDailyData(dailyData, emptyFilters);

    return Object.values(aggregated.byModel).map((modelData: any) => {
      const uniqueUsers = Object.keys(modelData.users || {}).length;

      // Get top users for this model
      const topUsers: UserSummary[] = Object.values(modelData.users || {})
        .map((userData: any) => ({
          userId: userData.userId,
          username: userData.username,
          email: userData.email,
          role: userData.role || 'user',
          requests: userData.metrics.api_requests,
          tokens: userData.metrics.total_tokens,
          prompt_tokens: userData.metrics.prompt_tokens || 0,
          completion_tokens: userData.metrics.completion_tokens || 0,
          cost: userData.metrics.spend,
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

      // Calculate actual success rate from tracked metrics
      const totalRequests =
        modelData.metrics.successful_requests + modelData.metrics.failed_requests;
      const successRate =
        totalRequests > 0 ? (modelData.metrics.successful_requests / totalRequests) * 100 : 0;

      return {
        modelId: modelData.modelName,
        modelName: modelData.modelName,
        provider: extractProviderFromModel(modelData.modelName),
        metrics: {
          requests: modelData.metrics.api_requests,
          tokens: {
            total: modelData.metrics.total_tokens,
            prompt: modelData.metrics.prompt_tokens,
            completion: modelData.metrics.completion_tokens,
          },
          cost: modelData.metrics.spend,
          users: uniqueUsers,
          successRate,
        },
        pricing: {
          promptCostPerToken: 0, // TODO: Get from model info
          completionCostPerToken: 0,
          currency: 'USD',
        },
        topUsers,
      };
    });
  }

  /**
   * Aggregate data by provider
   *
   * Converts aggregated data into provider breakdown format with top models.
   *
   * @param dailyData - Array of enriched daily data
   * @returns Array of provider breakdowns
   */
  aggregateByProvider(dailyData: EnrichedDayData[]): ProviderBreakdown[] {
    // Pass empty filters - no filtering for breakdown methods
    const emptyFilters: AdminUsageFilters = {
      startDate: dailyData[0]?.date || '',
      endDate: dailyData[dailyData.length - 1]?.date || '',
    };
    const aggregated = this.aggregateDailyData(dailyData, emptyFilters);

    return Object.values(aggregated.byProvider).map((providerData: any) => {
      // Count unique models and users for this provider
      const modelsForProvider = Object.keys(aggregated.byModel).filter(
        (modelName) => extractProviderFromModel(modelName) === providerData.provider,
      );

      const usersForProvider = new Set<string>();
      modelsForProvider.forEach((modelName) => {
        Object.keys(aggregated.byModel[modelName].users || {}).forEach((userId) =>
          usersForProvider.add(userId),
        );
      });

      // Get top models for this provider
      const topModels: ModelSummary[] = modelsForProvider
        .map((modelName) => {
          const modelData = aggregated.byModel[modelName];
          return {
            modelId: modelName,
            modelName,
            provider: providerData.provider,
            requests: modelData.metrics.api_requests,
            tokens: modelData.metrics.total_tokens,
            prompt_tokens: modelData.metrics.prompt_tokens || 0,
            completion_tokens: modelData.metrics.completion_tokens || 0,
            cost: modelData.metrics.spend,
          };
        })
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

      return {
        provider: providerData.provider,
        metrics: {
          requests: providerData.metrics.api_requests,
          tokens: {
            total: providerData.metrics.total_tokens,
            prompt: providerData.metrics.prompt_tokens,
            completion: providerData.metrics.completion_tokens,
          },
          cost: providerData.metrics.spend,
          models: modelsForProvider.length,
          users: usersForProvider.size,
          successRate: 100, // TODO: Track success rate in Phase 2
          averageLatency: 0, // TODO: Track latency in Phase 2
        },
        topModels,
      };
    });
  }

  // ============================================================================
  // Data Transformation Methods (Top-X Finders, Cost Breakdown)
  // ============================================================================

  /**
   * Find top user by cost
   *
   * @param byUser - User aggregation data
   * @param filters - Optional filters for user selection
   * @returns Top user summary or null
   */
  findTopUser(byUser: Record<string, any>, filters?: AdminUsageFilters): UserSummary | null {
    const users = Object.values(byUser);
    if (users.length === 0) return null;

    // Always filter out Unknown User from top user selection
    const filteredUsers = users.filter((user: any) => user.userId !== UNKNOWN_USER_ID);

    if (filteredUsers.length === 0) return null;

    const topUser = filteredUsers.reduce((max: any, user: any) =>
      user.metrics.spend > max.metrics.spend ? user : max,
    );

    // Validate that topUser has all required fields
    if (!topUser || !topUser.userId || !topUser.username || !topUser.email || !topUser.role) {
      this.fastify.log.warn(
        { topUser, filters },
        'findTopUser: Invalid user data structure, missing required fields',
      );
      return null;
    }

    // Validate metrics exist and are numbers
    if (
      typeof topUser.metrics?.api_requests !== 'number' ||
      typeof topUser.metrics?.total_tokens !== 'number' ||
      typeof topUser.metrics?.spend !== 'number'
    ) {
      this.fastify.log.warn(
        { topUser, filters },
        'findTopUser: Invalid metrics data, expected numbers',
      );
      return null;
    }

    return {
      userId: topUser.userId,
      username: topUser.username,
      email: topUser.email,
      role: topUser.role,
      requests: topUser.metrics.api_requests,
      tokens: topUser.metrics.total_tokens,
      prompt_tokens: topUser.metrics.prompt_tokens || 0,
      completion_tokens: topUser.metrics.completion_tokens || 0,
      cost: topUser.metrics.spend,
    };
  }

  /**
   * Find top N users by cost
   *
   * @param byUser - User aggregation data
   * @param limit - Number of top users to return
   * @param filters - Optional filters for user selection
   * @returns Array of top user summaries
   */
  findTopUsers(
    byUser: Record<string, any>,
    limit: number = 5,
    filters?: AdminUsageFilters,
  ): UserSummary[] {
    const users = Object.values(byUser);
    if (users.length === 0) return [];

    // Filter out Unknown User when user filtering is active
    const filteredUsers = users.filter((user: any) => {
      if (filters?.userIds && filters.userIds.length > 0) {
        return user.userId !== UNKNOWN_USER_ID;
      }
      return true;
    });

    return filteredUsers
      .map((user: any) => ({
        userId: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
        requests: user.metrics.api_requests,
        tokens: user.metrics.total_tokens,
        prompt_tokens: user.metrics.prompt_tokens || 0,
        completion_tokens: user.metrics.completion_tokens || 0,
        cost: user.metrics.spend,
      }))
      .filter((user) => user.requests > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }

  /**
   * Find top model by cost
   *
   * @param byModel - Model aggregation data
   * @returns Top model summary or null
   */
  findTopModel(byModel: Record<string, any>): ModelSummary | null {
    const models = Object.values(byModel);
    if (models.length === 0) return null;

    const topModel = models.reduce((max: any, model: any) =>
      model.metrics.spend > max.metrics.spend ? model : max,
    );

    return {
      modelId: topModel.modelName,
      modelName: topModel.modelName,
      provider: extractProviderFromModel(topModel.modelName),
      requests: topModel.metrics.api_requests,
      tokens: topModel.metrics.total_tokens,
      prompt_tokens: topModel.metrics.prompt_tokens || 0,
      completion_tokens: topModel.metrics.completion_tokens || 0,
      cost: topModel.metrics.spend,
    };
  }

  /**
   * Find top N models by cost
   *
   * @param byModel - Model aggregation data
   * @param limit - Number of top models to return (default: 10)
   * @returns Array of top model summaries
   */
  findTopModels(byModel: Record<string, any>, limit: number = 10): ModelSummary[] {
    const models = Object.values(byModel);
    if (models.length === 0) return [];

    return models
      .map((model: any) => ({
        modelId: model.modelName,
        modelName: model.modelName,
        provider: extractProviderFromModel(model.modelName),
        requests: model.metrics.api_requests,
        tokens: model.metrics.total_tokens,
        prompt_tokens: model.metrics.prompt_tokens || 0,
        completion_tokens: model.metrics.completion_tokens || 0,
        cost: model.metrics.spend,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }

  /**
   * Find top API key by cost
   *
   * @param _dailyData - Daily data array (unused, reserved for future implementation)
   * @returns Top API key summary or null
   */
  findTopApiKey(_dailyData: EnrichedDayData[]): ApiKeySummary | null {
    // TODO: Implement API key tracking in Phase 2
    return null;
  }

  /**
   * Get available filter options based on actual usage data in the date range
   *
   * This method returns models and users that actually have usage data in the specified
   * date range, including retired models and inactive users that may not appear in the
   * current /models or /admin/users endpoints.
   *
   * @param startDate - Start date (YYYY-MM-DD format)
   * @param endDate - End date (YYYY-MM-DD format)
   * @returns Filter options with models and users that have usage data
   */
  async getFilterOptions(
    startDate: string,
    endDate: string,
  ): Promise<{
    models: Array<{ id: string; name: string; provider: string }>;
    users: Array<{ userId: string; username: string; email: string }>;
  }> {
    this.fastify.log.info({ startDate, endDate }, 'Getting filter options from usage data');

    // Collect data for date range
    const dailyData = await this.collectDateRangeData(startDate, endDate);

    if (dailyData.length === 0) {
      this.fastify.log.warn({ startDate, endDate }, 'No usage data found for date range');
      return { models: [], users: [] };
    }

    // Extract unique models and users from the daily data
    const modelsMap = new Map<string, { id: string; name: string; provider: string }>();
    const usersMap = new Map<string, { userId: string; username: string; email: string }>();

    for (const dayData of dailyData) {
      // Extract models from breakdown
      if (dayData.breakdown?.models) {
        for (const [modelName, modelData] of Object.entries(dayData.breakdown.models)) {
          if (!modelsMap.has(modelName)) {
            modelsMap.set(modelName, {
              id: modelName,
              name: modelName,
              provider: extractProviderFromModel(modelName),
            });
          }

          // Extract users from model's user breakdown
          if (modelData.users) {
            for (const [userId, userData] of Object.entries(modelData.users)) {
              if (!usersMap.has(userId) && userData.username) {
                usersMap.set(userId, {
                  userId: userData.userId,
                  username: userData.username,
                  email: userData.email || '',
                });
              }
            }
          }
        }
      }

      // Also extract users from top-level user breakdown if available
      if (dayData.breakdown?.users) {
        for (const [userId, userData] of Object.entries(dayData.breakdown.users)) {
          if (!usersMap.has(userId) && (userData as any).username) {
            usersMap.set(userId, {
              userId: (userData as any).userId,
              username: (userData as any).username,
              email: (userData as any).email || '',
            });
          }
        }
      }
    }

    // Convert maps to sorted arrays
    const models = Array.from(modelsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const users = Array.from(usersMap.values()).sort((a, b) =>
      a.username.localeCompare(b.username),
    );

    this.fastify.log.info(
      {
        modelsCount: models.length,
        usersCount: users.length,
        dateRange: { startDate, endDate },
      },
      'Filter options extracted from usage data',
    );

    return { models, users };
  }

  /**
   * Calculate cost breakdown by provider, model, and user
   *
   * @param aggregated - Aggregated usage data
   * @returns Cost breakdown
   */
  calculateCostBreakdown(aggregated: AggregatedUsageData): CostBreakdown {
    const byProvider: Record<string, number> = {};
    Object.entries(aggregated.byProvider).forEach(([provider, data]: [string, any]) => {
      byProvider[provider] = data.metrics.spend;
    });

    const byModel: Record<string, number> = {};
    Object.entries(aggregated.byModel).forEach(([model, data]: [string, any]) => {
      byModel[model] = data.metrics.spend;
    });

    const byUser: Record<string, number> = {};
    Object.entries(aggregated.byUser).forEach(([userId, data]: [string, any]) => {
      byUser[userId] = data.metrics.spend;
    });

    return {
      total: aggregated.totalMetrics.spend,
      byProvider,
      byModel,
      byUser,
    };
  }

  /**
   * Calculate totals from aggregated data
   *
   * Converts aggregated metrics to UsageMetrics format for trend calculation
   * and includes calculated fields like success rate, active users, etc.
   */
  calculateTotals(aggregated: AggregatedUsageData): {
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
    successRate: number;
    uniqueUsers: number;
    activeUsers: number;
  } {
    const totalRequests = aggregated.totalMetrics.api_requests;

    return {
      totalRequests,
      totalTokens: aggregated.totalMetrics.total_tokens,
      promptTokens: aggregated.totalMetrics.prompt_tokens,
      completionTokens: aggregated.totalMetrics.completion_tokens,
      totalCost: aggregated.totalMetrics.spend,
      successRate:
        totalRequests > 0 ? (aggregated.totalMetrics.successful_requests / totalRequests) * 100 : 0,
      uniqueUsers: Object.keys(aggregated.byUser).length,
      activeUsers: Object.values(aggregated.byUser).filter(
        (user: any) => user.metrics.api_requests > 0,
      ).length,
    };
  }

  /**
   * Extract metrics for trend calculation
   *
   * Converts aggregated data to UsageMetrics format expected by TrendCalculator
   */
  extractMetrics(aggregated: AggregatedUsageData) {
    return {
      totalRequests: aggregated.totalMetrics.api_requests,
      totalTokens: aggregated.totalMetrics.total_tokens,
      promptTokens: aggregated.totalMetrics.prompt_tokens,
      completionTokens: aggregated.totalMetrics.completion_tokens,
      totalCost: aggregated.totalMetrics.spend,
    };
  }

  // ============================================================================
  // Chart Data Generation Methods
  // ============================================================================

  /**
   * Generate daily usage summary for trend charts
   *
   * @param dailyData - Daily data array
   * @param filters - Admin usage filters
   * @returns Array of daily usage summaries
   */
  generateDailyUsageSummary(
    dailyData: EnrichedDayData[],
    filters: AdminUsageFilters,
  ): DailyUsageSummary[] {
    // Handle empty array
    if (!dailyData || dailyData.length === 0) {
      this.fastify.log.warn('generateDailyUsageSummary: No daily data provided');
      return [];
    }

    const summary = dailyData
      .map((dayData) => {
        // Ensure metrics exist
        if (!dayData.metrics) {
          this.fastify.log.warn({ date: dayData.date }, 'Day data missing metrics, skipping');
          return null;
        }

        // Apply filters to calculate filtered metrics for this day
        let requests = 0;
        let tokens = 0;
        let prompt_tokens = 0;
        let completion_tokens = 0;
        let cost = 0;

        // If filters are specified, aggregate only matching users/models
        if (
          (filters.userIds && filters.userIds.length > 0) ||
          (filters.modelIds && filters.modelIds.length > 0)
        ) {
          // Aggregate by user if user filter specified
          if (filters.userIds && filters.userIds.length > 0) {
            Object.entries(dayData.breakdown.users || {}).forEach(([userId, userData]) => {
              if (filters.userIds!.includes(userId)) {
                // Check if API key filter is also active
                if (filters.apiKeyIds && filters.apiKeyIds.length > 0) {
                  // Aggregate from api_keys breakdown in user's models
                  Object.entries(userData.models || {}).forEach(
                    ([modelName, modelData]: [string, any]) => {
                      // Apply model filter if specified
                      if (
                        !filters.modelIds ||
                        filters.modelIds.length === 0 ||
                        filters.modelIds.includes(modelName)
                      ) {
                        Object.entries(modelData.api_keys || {}).forEach(
                          ([keyAlias, keyData]: [string, any]) => {
                            if (filters.apiKeyIds!.includes(keyAlias)) {
                              requests += keyData.metrics.api_requests ?? 0;
                              tokens += keyData.metrics.total_tokens ?? 0;
                              prompt_tokens += keyData.metrics.prompt_tokens ?? 0;
                              completion_tokens += keyData.metrics.completion_tokens ?? 0;
                              cost += keyData.metrics.spend ?? 0;
                            }
                          },
                        );
                      }
                    },
                  );
                } else {
                  // No API key filter - check if model filter is active
                  if (filters.modelIds && filters.modelIds.length > 0) {
                    // Model filter active - aggregate only filtered models
                    Object.entries(userData.models || {}).forEach(
                      ([modelName, modelData]: [string, any]) => {
                        if (filters.modelIds!.includes(modelName)) {
                          requests += modelData.metrics?.api_requests ?? 0;
                          tokens += modelData.metrics?.total_tokens ?? 0;
                          prompt_tokens += modelData.metrics?.prompt_tokens ?? 0;
                          completion_tokens += modelData.metrics?.completion_tokens ?? 0;
                          cost += modelData.metrics?.spend ?? 0;
                        }
                      },
                    );
                  } else {
                    // No model filter - use user totals
                    requests += userData.metrics.api_requests ?? 0;
                    tokens += userData.metrics.total_tokens ?? 0;
                    prompt_tokens += userData.metrics.prompt_tokens ?? 0;
                    completion_tokens += userData.metrics.completion_tokens ?? 0;
                    cost += userData.metrics.spend ?? 0;
                  }
                }
              }
            });
          }
          // Aggregate by model if model filter specified and no user filter
          else if (filters.modelIds && filters.modelIds.length > 0) {
            Object.entries(dayData.breakdown.models || {}).forEach(([modelName, modelData]) => {
              if (filters.modelIds!.includes(modelName)) {
                requests += modelData.metrics.api_requests ?? 0;
                tokens += modelData.metrics.total_tokens ?? 0;
                prompt_tokens += modelData.metrics.prompt_tokens ?? 0;
                completion_tokens += modelData.metrics.completion_tokens ?? 0;
                cost += modelData.metrics.spend ?? 0;
              }
            });
          }
        } else {
          // No filters - sum from enriched breakdown (not raw metrics)
          // Raw metrics include orphaned requests without valid API keys in database
          // We must use breakdown to match what aggregateDailyData returns
          Object.entries(dayData.breakdown.models || {}).forEach(([_modelName, modelData]) => {
            requests += modelData.metrics.api_requests ?? 0;
            tokens += modelData.metrics.total_tokens ?? 0;
            prompt_tokens += modelData.metrics.prompt_tokens ?? 0;
            completion_tokens += modelData.metrics.completion_tokens ?? 0;
            cost += modelData.metrics.spend ?? 0;
          });
        }

        return {
          date: dayData.date, // Already a string in YYYY-MM-DD format
          requests,
          tokens,
          prompt_tokens,
          completion_tokens,
          cost,
        };
      })
      .filter((day): day is DailyUsageSummary => day !== null && day.requests > 0) // Type guard
      .sort((a, b) => a.date.localeCompare(b.date)); // Both are strings

    this.fastify.log.debug(
      {
        inputDays: dailyData.length,
        outputDays: summary.length,
        firstDate: summary[0]?.date,
        lastDate: summary[summary.length - 1]?.date,
      },
      'Generated daily usage summary',
    );

    return summary;
  }

  /**
   * Generate daily model usage summary for stacked trend charts
   * Extracts model-specific metrics from each day's data
   * @param dailyData Array of enriched daily usage data
   * @param filters - Admin usage filters
   * @returns Array of daily model usage summaries
   */
  generateDailyModelUsageSummary(
    dailyData: EnrichedDayData[],
    filters: AdminUsageFilters,
  ): DailyModelUsage[] {
    // Handle empty array
    if (!dailyData || dailyData.length === 0) {
      this.fastify.log.warn('generateDailyModelUsageSummary: No daily data provided');
      return [];
    }

    const summary = dailyData
      .map((dayData) => {
        // Ensure breakdown and models exist
        if (!dayData.breakdown?.models) {
          this.fastify.log.warn(
            { date: dayData.date },
            'Day data missing model breakdown, skipping',
          );
          return null;
        }

        // Extract model metrics for this day
        const models: DailyModelMetrics[] = Object.entries(dayData.breakdown.models)
          .filter(([modelName]) => {
            // Apply model filter if specified
            if (filters.modelIds && filters.modelIds.length > 0) {
              return filters.modelIds.includes(modelName);
            }
            return true;
          })
          .map(([modelName, modelData]: [string, any]) => {
            // Extract provider from model name (format: "provider/model")
            const provider = modelName.includes('/') ? modelName.split('/')[0] : 'unknown';

            // If user filter is specified, aggregate metrics only from filtered users
            let requests = 0;
            let tokens = 0;
            let prompt_tokens = 0;
            let completion_tokens = 0;
            let cost = 0;

            if (filters.userIds && filters.userIds.length > 0) {
              // Aggregate metrics from filtered users only
              Object.entries(modelData.users || {}).forEach(([userId, userData]: [string, any]) => {
                if (filters.userIds!.includes(userId)) {
                  // Check if API key filter is also active
                  if (filters.apiKeyIds && filters.apiKeyIds.length > 0) {
                    // Need to get api_keys from the user's model in dayData.breakdown.users
                    const userModelData = dayData.breakdown.users?.[userId]?.models?.[modelName];
                    Object.entries(userModelData?.api_keys || {}).forEach(
                      ([keyAlias, keyData]: [string, any]) => {
                        if (filters.apiKeyIds!.includes(keyAlias)) {
                          requests += keyData.metrics?.api_requests ?? 0;
                          tokens += keyData.metrics?.total_tokens ?? 0;
                          prompt_tokens += keyData.metrics?.prompt_tokens ?? 0;
                          completion_tokens += keyData.metrics?.completion_tokens ?? 0;
                          cost += keyData.metrics?.spend ?? 0;
                        }
                      },
                    );
                  } else {
                    // No API key filter: use user metrics
                    requests += userData.metrics?.api_requests ?? 0;
                    tokens += userData.metrics?.total_tokens ?? 0;
                    prompt_tokens += userData.metrics?.prompt_tokens ?? 0;
                    completion_tokens += userData.metrics?.completion_tokens ?? 0;
                    cost += userData.metrics?.spend ?? 0;
                  }
                }
              });
            } else {
              // No user filter, use total model metrics
              requests = modelData.metrics?.api_requests ?? 0;
              tokens = modelData.metrics?.total_tokens ?? 0;
              prompt_tokens = modelData.metrics?.prompt_tokens ?? 0;
              completion_tokens = modelData.metrics?.completion_tokens ?? 0;
              cost = modelData.metrics?.spend ?? 0;
            }

            return {
              modelId: modelName,
              modelName: modelName,
              provider: provider,
              requests,
              tokens,
              prompt_tokens,
              completion_tokens,
              cost,
            };
          })
          .filter((model) => model.requests > 0) // Only include models with activity
          .sort((a, b) => b.requests - a.requests); // Sort by requests descending

        // Skip days with no model activity
        if (models.length === 0) {
          return null;
        }

        return {
          date: dayData.date, // Already a string in YYYY-MM-DD format
          models: models,
        };
      })
      .filter((day): day is DailyModelUsage => day !== null)
      .sort((a, b) => a.date.localeCompare(b.date)); // Both are strings

    this.fastify.log.debug(
      {
        inputDays: dailyData.length,
        outputDays: summary.length,
        totalModels: summary.reduce((sum, day) => sum + day.models.length, 0),
        sampleDay: summary[0]
          ? {
              date: summary[0].date,
              modelCount: summary[0].models.length,
              topModel: summary[0].models[0]?.modelName,
            }
          : null,
      },
      'Generated daily model usage summary',
    );

    return summary;
  }

  // ============================================================================
  // Data Pipeline Methods (Fetch → Enrich → Cache → Collect)
  // ============================================================================

  /**
   * Collect data for a date range day-by-day with caching
   *
   * @param startDate - Range start date (YYYY-MM-DD)
   * @param endDate - Range end date (YYYY-MM-DD)
   * @returns Array of enriched daily data
   */
  async collectDateRangeData(startDate: string, endDate: string): Promise<EnrichedDayData[]> {
    // Generate array of date strings (YYYY-MM-DD format) from start to end
    // This avoids timezone issues with Date object conversions
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = eachDayOfInterval({ start, end });

    // Convert Date objects to YYYY-MM-DD strings
    const dateStrings = days.map((day) => format(day, 'yyyy-MM-dd'));

    this.fastify.log.info(
      {
        startDate,
        endDate,
        totalDays: dateStrings.length,
      },
      'Collecting usage data for date range',
    );

    const dailyData: EnrichedDayData[] = [];

    for (const dateString of dateStrings) {
      try {
        const enrichedDay = await this.getCachedOrFetch(dateString);
        if (enrichedDay) {
          dailyData.push(enrichedDay);
        }
      } catch (error) {
        this.fastify.log.error(
          { error, date: dateString },
          'Failed to fetch data for day - continuing with other days',
        );
        // Continue with other days even if one fails
      }
    }

    this.fastify.log.info(
      { daysCollected: dailyData.length, totalDays: dateStrings.length },
      'Date range data collection complete',
    );

    return dailyData;
  }

  /**
   * Refresh data for a single day (typically today) with strict error handling
   *
   * Unlike collectDateRangeData, this method throws errors if the fetch fails,
   * making it suitable for explicit refresh operations where failure should be reported.
   *
   * @param dateString - The date to refresh (YYYY-MM-DD)
   * @returns Enriched day data
   * @throws ApplicationError if fetch or enrichment fails
   */
  async refreshSingleDay(dateString: string): Promise<EnrichedDayData> {
    this.fastify.log.info({ date: dateString }, 'Refreshing single day data');

    // Fetch from LiteLLM (will throw on error)
    const liteLLMData = await this.fetchDailyDataFromLiteLLM(dateString);

    if (!liteLLMData) {
      throw this.createNotFoundError(
        'usage data',
        dateString,
        'Ensure the date has usage activity',
      );
    }

    // Enrich with user mappings (will throw on error)
    const enrichedData = await this.enrichWithUserMapping(liteLLMData);

    // Cache if manager available
    if (this.cacheManager) {
      const date = parseISO(dateString);
      await this.cacheManager.saveToDailyCache(dateString, enrichedData, isToday(date));
    }

    this.fastify.log.info({ date: dateString }, 'Single day data refreshed successfully');
    return enrichedData;
  }

  /**
   * Get cached data or fetch from LiteLLM
   *
   * @param dateString - The date to get (YYYY-MM-DD)
   * @returns Enriched day data or null
   */
  private async getCachedOrFetch(dateString: string): Promise<EnrichedDayData | null> {
    // Work with string dates to avoid timezone conversion issues

    // Check cache first if available
    if (this.cacheManager) {
      const cached = await this.cacheManager.getCachedDailyData(dateString);
      // Use cached data for historical dates (older than 1 day)
      const date = parseISO(dateString);
      if (cached && isHistoricalDate(date)) {
        this.fastify.log.debug({ date: dateString }, 'Using cached data for historical day');
        return cached;
      }
      // For today's date, cache manager will check freshness (5 minute TTL)
      if (cached && isToday(date)) {
        this.fastify.log.debug({ date: dateString }, 'Using cached data for today (if fresh)');
        return cached;
      }
    }

    // Fetch from LiteLLM
    this.fastify.log.debug({ date: dateString }, 'Fetching fresh data from LiteLLM');
    const liteLLMData = await this.fetchDailyDataFromLiteLLM(dateString);

    if (!liteLLMData) {
      return null;
    }

    // Enrich with user mappings
    const enrichedData = await this.enrichWithUserMapping(liteLLMData);

    // Cache if manager available
    if (this.cacheManager) {
      const date = parseISO(dateString);
      await this.cacheManager.saveToDailyCache(dateString, enrichedData, isToday(date));
    }

    return enrichedData;
  }

  /**
   * Fetch daily data from LiteLLM for a specific date
   *
   * @param dateString - The date to fetch (YYYY-MM-DD)
   * @returns Raw LiteLLM day data or null if no data
   */
  private async fetchDailyDataFromLiteLLM(dateString: string): Promise<LiteLLMDayData | null> {
    this.fastify.log.debug({ date: dateString }, 'Fetching daily data from LiteLLM');

    try {
      // Call LiteLLM /user/daily/activity endpoint without api_key filter
      // This aggregates across ALL users
      const response = await this.liteLLMService.getDailyActivity(
        undefined, // No api_key filter = all users
        dateString,
        dateString,
      );

      // Get the raw daily result for this specific date (should be only one)
      const dailyResult = response.daily_metrics?.[0];

      // Transform response to our LiteLLMDayData format
      const dayData: LiteLLMDayData = {
        date: dateString,
        metrics: {
          api_requests: response.api_requests || 0,
          total_tokens: response.total_tokens || 0,
          prompt_tokens: response.prompt_tokens || 0,
          completion_tokens: response.completion_tokens || 0,
          spend: response.spend || 0,
          successful_requests: 0, // Will be calculated from api_key breakdown in enrichWithUserMapping
          failed_requests: 0, // Will be calculated from api_key breakdown in enrichWithUserMapping
        },
        breakdown: {
          models: {},
          api_keys: {},
          providers: {},
        },
      };

      // Extract model breakdown with api_key_breakdown from daily result
      if (dailyResult?.breakdown?.models) {
        Object.entries(dailyResult.breakdown.models).forEach(
          ([modelName, modelData]: [string, any]) => {
            dayData.breakdown.models[modelName] = {
              metrics: {
                api_requests: modelData.metrics?.api_requests || 0,
                total_tokens: modelData.metrics?.total_tokens || 0,
                prompt_tokens: modelData.metrics?.prompt_tokens || 0,
                completion_tokens: modelData.metrics?.completion_tokens || 0,
                spend: modelData.metrics?.spend || 0,
              },
              api_keys: modelData.api_key_breakdown || {},
            };
          },
        );
      }

      this.fastify.log.debug(
        {
          date: dateString,
          requests: dayData.metrics.api_requests,
          tokens: dayData.metrics.total_tokens,
          spend: dayData.metrics.spend,
          modelCount: Object.keys(dayData.breakdown.models).length,
        },
        'Daily data fetched successfully',
      );

      return dayData.metrics.api_requests > 0 ? dayData : null;
    } catch (error) {
      this.fastify.log.error({ error, date: dateString }, 'Failed to fetch daily data');
      throw ApplicationError.fromUnknown(error, `fetching data for ${dateString}`);
    }
  }

  /**
   * Enrich LiteLLM data with user information from database
   *
   * Maps API keys to users via database query
   *
   * @param dayData - Raw LiteLLM day data
   * @returns Enriched day data with user mappings
   */
  private async enrichWithUserMapping(dayData: LiteLLMDayData): Promise<EnrichedDayData> {
    this.fastify.log.debug({ date: dayData.date }, 'Enriching data with user mappings');

    try {
      // Query all active API keys with their pre-computed key_hash
      // This approach is resilient to API key renaming since we match by the stable
      // hash of the actual LiteLLM key value (stored in key_hash), not the mutable alias
      let apiKeyMappings: ApiKeyUserMapping[] = [];

      if (!this.isDatabaseUnavailable()) {
        const query = `
          SELECT
            ak.litellm_key_alias,
            ak.key_hash,
            ak.user_id,
            ak.name as key_name,
            u.username,
            u.email,
            u.roles[1] as role
          FROM api_keys ak
          JOIN users u ON ak.user_id = u.id
          WHERE ak.is_active = true
        `;

        const result = await this.executeQuery<{ rows: any[] }>(
          query,
          [],
          'fetching API key user mappings',
        );

        // Use pre-computed key_hash from database to match against LiteLLM usage data
        apiKeyMappings = result.rows.map((row) => ({
          tokenHash: row.key_hash,
          userId: row.user_id,
          username: row.username,
          email: row.email,
          role: row.role || 'user',
          keyAlias: row.litellm_key_alias,
          keyName: row.key_name,
        }));

        this.fastify.log.debug(
          {
            totalActiveKeys: result.rows.length,
            mappedCount: apiKeyMappings.length,
          },
          'API key mappings retrieved using pre-computed key_hash',
        );
      }

      // Create lookup map using database key_hash (SHA256 of LiteLLM key value)
      const keyHashToUser = new Map(apiKeyMappings.map((mapping) => [mapping.tokenHash, mapping]));

      // Build enriched data structure
      const enrichedData: EnrichedDayData = {
        date: dayData.date,
        metrics: dayData.metrics,
        breakdown: {
          models: {},
          providers: dayData.breakdown.providers || {},
          users: {},
        },
        rawData: dayData,
      };

      // Track requests that were successfully mapped
      let mappedRequests = 0;
      let skippedRequests = 0; // Track requests with empty/invalid API keys
      const unmappedModelMetrics: Record<
        string,
        {
          api_requests: number;
          total_tokens: number;
          prompt_tokens: number;
          completion_tokens: number;
          spend: number;
          successful_requests: number;
          failed_requests: number;
        }
      > = {};

      // Process model breakdown and map to users
      Object.entries(dayData.breakdown.models || {}).forEach(([modelName, modelData]) => {
        enrichedData.breakdown.models[modelName] = {
          metrics: {
            ...modelData.metrics,
            successful_requests: 0,
            failed_requests: 0,
          },
          users: {},
        };

        let modelMappedRequests = 0;
        let modelSkippedRequests = 0; // Track skipped requests per model

        // Map API keys in this model to users using key hash (stable identifier)
        Object.entries(modelData.api_keys || {}).forEach(([keyHash, keyData]: [string, any]) => {
          // Skip entries with empty/invalid API keys (failed requests, health checks, etc.)
          const isEmptyKeyHash = !keyHash || (typeof keyHash === 'string' && keyHash.trim() === '');

          if (isEmptyKeyHash) {
            const skippedCount = keyData.metrics?.api_requests || 0;
            modelSkippedRequests += skippedCount;
            skippedRequests += skippedCount;
            this.fastify.log.debug(
              {
                modelName,
                keyHash,
                requests: skippedCount,
                failedRequests: keyData.metrics?.failed_requests || 0,
              },
              'Skipping invalid API key entry (empty key hash)',
            );
            return; // Skip this entry
          }

          // Match by key hash (stable identifier from LiteLLM)
          const userMapping = keyHashToUser.get(keyHash);

          if (userMapping) {
            const userId = userMapping.userId;
            modelMappedRequests += keyData.metrics.api_requests || 0;
            mappedRequests += keyData.metrics.api_requests || 0;

            // Add to model's user breakdown
            if (!enrichedData.breakdown.models[modelName].users[userId]) {
              enrichedData.breakdown.models[modelName].users[userId] = {
                userId: userMapping.userId,
                username: userMapping.username,
                email: userMapping.email,
                metrics: {
                  api_requests: 0,
                  total_tokens: 0,
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  spend: 0,
                  successful_requests: 0,
                  failed_requests: 0,
                },
              };
            }

            // Aggregate metrics
            const userMetrics = enrichedData.breakdown.models[modelName].users[userId].metrics;
            userMetrics.api_requests += keyData.metrics.api_requests;
            userMetrics.total_tokens += keyData.metrics.total_tokens;
            userMetrics.prompt_tokens +=
              keyData.metrics.prompt_tokens || keyData.metrics.prompt_tokens || 0;
            userMetrics.completion_tokens +=
              keyData.metrics.completion_tokens || keyData.metrics.completion_tokens || 0;
            userMetrics.spend += keyData.metrics.spend;
            userMetrics.successful_requests += keyData.metrics.successful_requests || 0;
            userMetrics.failed_requests += keyData.metrics.failed_requests || 0;

            // Aggregate to model metrics
            const modelMetrics = enrichedData.breakdown.models[modelName].metrics;
            modelMetrics.prompt_tokens +=
              keyData.metrics.prompt_tokens || keyData.metrics.prompt_tokens || 0;
            modelMetrics.completion_tokens +=
              keyData.metrics.completion_tokens || keyData.metrics.completion_tokens || 0;
            modelMetrics.successful_requests += keyData.metrics.successful_requests || 0;
            modelMetrics.failed_requests += keyData.metrics.failed_requests || 0;

            // Add to global user breakdown
            if (!enrichedData.breakdown.users[userId]) {
              enrichedData.breakdown.users[userId] = {
                userId: userMapping.userId,
                username: userMapping.username,
                email: userMapping.email,
                role: userMapping.role,
                metrics: {
                  api_requests: 0,
                  total_tokens: 0,
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  spend: 0,
                  successful_requests: 0,
                  failed_requests: 0,
                },
                models: {},
              };
            }

            // Aggregate to user's total metrics
            const userTotalMetrics = enrichedData.breakdown.users[userId].metrics;
            userTotalMetrics.api_requests += keyData.metrics.api_requests;
            userTotalMetrics.total_tokens += keyData.metrics.total_tokens;
            userTotalMetrics.prompt_tokens +=
              keyData.metrics.prompt_tokens || keyData.metrics.prompt_tokens || 0;
            userTotalMetrics.completion_tokens +=
              keyData.metrics.completion_tokens || keyData.metrics.completion_tokens || 0;
            userTotalMetrics.spend += keyData.metrics.spend;
            userTotalMetrics.successful_requests += keyData.metrics.successful_requests || 0;
            userTotalMetrics.failed_requests += keyData.metrics.failed_requests || 0;

            // Add to user's model breakdown
            if (!enrichedData.breakdown.users[userId].models[modelName]) {
              enrichedData.breakdown.users[userId].models[modelName] = {
                modelName,
                metrics: {
                  api_requests: 0,
                  total_tokens: 0,
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  spend: 0,
                  successful_requests: 0,
                  failed_requests: 0,
                },
                api_keys: {}, // Initialize API key breakdown
              };
            }

            const userModelMetrics = enrichedData.breakdown.users[userId].models[modelName].metrics;
            userModelMetrics.api_requests += keyData.metrics.api_requests;
            userModelMetrics.total_tokens += keyData.metrics.total_tokens;
            userModelMetrics.prompt_tokens +=
              keyData.metrics.prompt_tokens || keyData.metrics.prompt_tokens || 0;
            userModelMetrics.completion_tokens +=
              keyData.metrics.completion_tokens || keyData.metrics.completion_tokens || 0;
            userModelMetrics.spend += keyData.metrics.spend;
            userModelMetrics.successful_requests += keyData.metrics.successful_requests || 0;
            userModelMetrics.failed_requests += keyData.metrics.failed_requests || 0;

            // Preserve API key breakdown for filtering
            // Use keyAlias from database mapping for display/filtering purposes
            enrichedData.breakdown.users[userId].models[modelName].api_keys![userMapping.keyAlias] =
              {
                keyAlias: userMapping.keyAlias,
                keyName: userMapping.keyName, // Display name from database
                metrics: {
                  api_requests: keyData.metrics.api_requests,
                  total_tokens: keyData.metrics.total_tokens,
                  prompt_tokens: keyData.metrics.prompt_tokens || 0,
                  completion_tokens: keyData.metrics.completion_tokens || 0,
                  spend: keyData.metrics.spend,
                  successful_requests: keyData.metrics.successful_requests || 0,
                  failed_requests: keyData.metrics.failed_requests || 0,
                },
              };
          } else {
            // Unmapped request - track by model for Unknown User
            if (!unmappedModelMetrics[modelName]) {
              unmappedModelMetrics[modelName] = {
                api_requests: 0,
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                spend: 0,
                successful_requests: 0,
                failed_requests: 0,
              };
            }
            unmappedModelMetrics[modelName].api_requests += keyData.metrics.api_requests || 0;
            unmappedModelMetrics[modelName].total_tokens += keyData.metrics.total_tokens || 0;
            unmappedModelMetrics[modelName].prompt_tokens +=
              keyData.metrics.prompt_tokens || keyData.metrics.prompt_tokens || 0;
            unmappedModelMetrics[modelName].completion_tokens +=
              keyData.metrics.completion_tokens || keyData.metrics.completion_tokens || 0;
            unmappedModelMetrics[modelName].spend += keyData.metrics.spend || 0;
            unmappedModelMetrics[modelName].successful_requests +=
              keyData.metrics.successful_requests || 0;
            unmappedModelMetrics[modelName].failed_requests += keyData.metrics.failed_requests || 0;

            // Store unmapped API key details for later addition to __unmapped__ user
            // This will be added after we create the __unmapped__ user entry
            if (!enrichedData.breakdown.users[UNKNOWN_USER_ID]) {
              enrichedData.breakdown.users[UNKNOWN_USER_ID] = {
                userId: UNKNOWN_USER_ID,
                username: UNKNOWN_USERNAME,
                email: this.UNKNOWN_EMAIL,
                role: this.UNKNOWN_ROLE,
                metrics: {
                  api_requests: 0,
                  total_tokens: 0,
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  spend: 0,
                  successful_requests: 0,
                  failed_requests: 0,
                },
                models: {},
              };
            }

            // Ensure model exists in unmapped user
            if (!enrichedData.breakdown.users[UNKNOWN_USER_ID].models[modelName]) {
              enrichedData.breakdown.users[UNKNOWN_USER_ID].models[modelName] = {
                modelName,
                metrics: {
                  api_requests: 0,
                  total_tokens: 0,
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  spend: 0,
                  successful_requests: 0,
                  failed_requests: 0,
                },
                api_keys: {},
              };
            }

            // Add this unmapped API key to the breakdown
            // Use keyHash as identifier for unmapped keys (no database mapping available)
            enrichedData.breakdown.users[UNKNOWN_USER_ID].models[modelName].api_keys![keyHash] = {
              keyAlias: keyHash,
              keyName: 'Unknown Key',
              metrics: {
                api_requests: keyData.metrics.api_requests,
                total_tokens: keyData.metrics.total_tokens,
                prompt_tokens: keyData.metrics.prompt_tokens || 0,
                completion_tokens: keyData.metrics.completion_tokens || 0,
                spend: keyData.metrics.spend,
                successful_requests: keyData.metrics.successful_requests || 0,
                failed_requests: keyData.metrics.failed_requests || 0,
              },
            };

            // Update unmapped user's model totals
            const unmappedUserModelMetrics =
              enrichedData.breakdown.users[UNKNOWN_USER_ID].models[modelName].metrics;
            unmappedUserModelMetrics.api_requests += keyData.metrics.api_requests;
            unmappedUserModelMetrics.total_tokens += keyData.metrics.total_tokens;
            unmappedUserModelMetrics.prompt_tokens += keyData.metrics.prompt_tokens || 0;
            unmappedUserModelMetrics.completion_tokens += keyData.metrics.completion_tokens || 0;
            unmappedUserModelMetrics.spend += keyData.metrics.spend;
            unmappedUserModelMetrics.successful_requests +=
              keyData.metrics.successful_requests || 0;
            unmappedUserModelMetrics.failed_requests += keyData.metrics.failed_requests || 0;

            // Update unmapped user's total metrics
            const unmappedUserMetrics = enrichedData.breakdown.users[UNKNOWN_USER_ID].metrics;
            unmappedUserMetrics.api_requests += keyData.metrics.api_requests;
            unmappedUserMetrics.total_tokens += keyData.metrics.total_tokens;
            unmappedUserMetrics.prompt_tokens += keyData.metrics.prompt_tokens || 0;
            unmappedUserMetrics.completion_tokens += keyData.metrics.completion_tokens || 0;
            unmappedUserMetrics.spend += keyData.metrics.spend;
            unmappedUserMetrics.successful_requests += keyData.metrics.successful_requests || 0;
            unmappedUserMetrics.failed_requests += keyData.metrics.failed_requests || 0;
          }
        });

        // Calculate unmapped requests for this model (excluding skipped ones)
        const modelUnmappedRequests =
          (modelData.metrics?.api_requests || 0) - modelMappedRequests - modelSkippedRequests;

        if (modelUnmappedRequests > 0) {
          // Ensure we have an entry for unmapped metrics
          if (!unmappedModelMetrics[modelName]) {
            unmappedModelMetrics[modelName] = {
              api_requests: modelUnmappedRequests,
              total_tokens: 0,
              prompt_tokens: 0,
              completion_tokens: 0,
              spend: 0,
              successful_requests: 0,
              failed_requests: 0,
            };
          }
        }

        // Adjust model metrics to exclude skipped requests
        if (modelSkippedRequests > 0) {
          enrichedData.breakdown.models[modelName].metrics.api_requests -= modelSkippedRequests;
          this.fastify.log.debug(
            {
              modelName,
              originalRequests: modelData.metrics?.api_requests || 0,
              skippedRequests: modelSkippedRequests,
              adjustedRequests: enrichedData.breakdown.models[modelName].metrics.api_requests,
            },
            'Model metrics adjusted to exclude skipped requests',
          );
        }
      });

      // Recalculate global metrics from aggregated model data
      // This replaces the placeholder values from fetchDailyDataFromLiteLLM with actual success/failure counts
      enrichedData.metrics.successful_requests = 0;
      enrichedData.metrics.failed_requests = 0;
      Object.values(enrichedData.breakdown.models).forEach((modelData) => {
        enrichedData.metrics.successful_requests += modelData.metrics.successful_requests;
        enrichedData.metrics.failed_requests += modelData.metrics.failed_requests;
      });

      this.fastify.log.debug(
        {
          date: dayData.date,
          successfulRequests: enrichedData.metrics.successful_requests,
          failedRequests: enrichedData.metrics.failed_requests,
          totalRequests: enrichedData.metrics.api_requests,
        },
        'Global success/failure metrics recalculated from model data',
      );

      // Calculate total unmapped requests (excluding skipped ones)
      const totalUnmappedRequests =
        (dayData.metrics?.api_requests || 0) - mappedRequests - skippedRequests;

      // If there are unmapped requests, create "Unknown User" entry
      if (totalUnmappedRequests > 0 || Object.keys(unmappedModelMetrics).length > 0) {
        const unmappedTotalMetrics = Object.values(unmappedModelMetrics).reduce(
          (acc, metrics) => ({
            api_requests: acc.api_requests + metrics.api_requests,
            total_tokens: acc.total_tokens + metrics.total_tokens,
            prompt_tokens: acc.prompt_tokens + metrics.prompt_tokens,
            completion_tokens: acc.completion_tokens + metrics.completion_tokens,
            spend: acc.spend + metrics.spend,
            successful_requests: acc.successful_requests + (metrics.successful_requests || 0),
            failed_requests: acc.failed_requests + (metrics.failed_requests || 0),
          }),
          {
            api_requests: 0,
            total_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            spend: 0,
            successful_requests: 0,
            failed_requests: 0,
          },
        );

        // Create Unknown User entry
        enrichedData.breakdown.users[UNKNOWN_USER_ID] = {
          userId: UNKNOWN_USER_ID,
          username: UNKNOWN_USERNAME,
          email: this.UNKNOWN_EMAIL,
          role: this.UNKNOWN_ROLE,
          metrics: unmappedTotalMetrics,
          models: {},
        };

        // Add unmapped metrics to each model's Unknown User
        Object.entries(unmappedModelMetrics).forEach(([modelName, metrics]) => {
          if (metrics.api_requests > 0) {
            // Ensure model entry exists in enrichedData (might not if it had no mapped users)
            if (!enrichedData.breakdown.models[modelName]) {
              const rawMetrics = dayData.breakdown.models[modelName]?.metrics;
              enrichedData.breakdown.models[modelName] = {
                metrics: {
                  api_requests: rawMetrics?.api_requests || 0,
                  total_tokens: rawMetrics?.total_tokens || 0,
                  prompt_tokens: rawMetrics?.prompt_tokens || 0,
                  completion_tokens: rawMetrics?.completion_tokens || 0,
                  spend: rawMetrics?.spend || 0,
                  successful_requests: 0,
                  failed_requests: 0,
                },
                users: {},
              };
            }

            // Add to model's user breakdown
            enrichedData.breakdown.models[modelName].users[UNKNOWN_USER_ID] = {
              userId: UNKNOWN_USER_ID,
              username: UNKNOWN_USERNAME,
              email: this.UNKNOWN_EMAIL,
              metrics,
            };

            // Add to Unknown User's model breakdown
            enrichedData.breakdown.users[UNKNOWN_USER_ID].models[modelName] = {
              modelName,
              metrics,
              api_keys: {}, // Initialize for unmapped keys
            };
          }
        });
      }

      // Adjust global metrics to exclude skipped requests
      if (skippedRequests > 0) {
        const originalRequests = enrichedData.metrics.api_requests;
        const originalSuccessful = enrichedData.metrics.successful_requests;

        enrichedData.metrics.api_requests -= skippedRequests;
        enrichedData.metrics.successful_requests -= skippedRequests;

        this.fastify.log.info(
          {
            date: dayData.date,
            originalRequests,
            originalSuccessful,
            skippedRequests,
            adjustedRequests: enrichedData.metrics.api_requests,
            adjustedSuccessful: enrichedData.metrics.successful_requests,
          },
          'Global metrics adjusted to exclude skipped requests',
        );
      }

      // Filter out models that have 0 requests after adjustment (only skipped requests)
      const modelsToRemove: string[] = [];
      Object.entries(enrichedData.breakdown.models).forEach(([modelName, modelData]) => {
        if (modelData.metrics.api_requests === 0) {
          modelsToRemove.push(modelName);
        }
      });

      if (modelsToRemove.length > 0) {
        modelsToRemove.forEach((modelName) => {
          delete enrichedData.breakdown.models[modelName];

          // Also remove from users' model breakdown if present
          Object.values(enrichedData.breakdown.users).forEach((user) => {
            if (user.models[modelName]) {
              delete user.models[modelName];
            }
          });
        });

        this.fastify.log.info(
          {
            date: dayData.date,
            modelsRemoved: modelsToRemove,
            removedCount: modelsToRemove.length,
          },
          'Models with only skipped requests removed from breakdown',
        );
      }

      // Filter out users that have 0 requests after adjustment
      const usersToRemove: string[] = [];
      Object.entries(enrichedData.breakdown.users).forEach(([userId, userData]) => {
        if (userData.metrics.api_requests === 0) {
          usersToRemove.push(userId);
        }
      });

      if (usersToRemove.length > 0) {
        usersToRemove.forEach((userId) => {
          delete enrichedData.breakdown.users[userId];

          // Also remove from models' user breakdown if present
          Object.values(enrichedData.breakdown.models).forEach((model) => {
            if (model.users[userId]) {
              delete model.users[userId];
            }
          });
        });

        this.fastify.log.info(
          {
            date: dayData.date,
            usersRemoved: usersToRemove,
            removedCount: usersToRemove.length,
          },
          'Users with 0 requests removed from breakdown',
        );
      }

      this.fastify.log.info(
        {
          date: dayData.date,
          totalRequests: enrichedData.metrics.api_requests, // Now using adjusted metrics
          mappedRequests,
          unmappedRequests: totalUnmappedRequests,
          skippedRequests,
          processedRequests: mappedRequests + totalUnmappedRequests,
          userCount: Object.keys(enrichedData.breakdown.users).length,
          modelCount: Object.keys(enrichedData.breakdown.models).length,
          hasUnknownUser: enrichedData.breakdown.users[UNKNOWN_USER_ID] !== undefined,
        },
        'Data enrichment complete - API keys matched by hash',
      );

      return enrichedData;
    } catch (error) {
      this.fastify.log.error({ error, date: dayData.date }, 'Failed to enrich data');
      throw ApplicationError.fromUnknown(error, 'enriching data with user mappings');
    }
  }
}

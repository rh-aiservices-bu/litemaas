import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service.js';
import { LiteLLMService } from './litellm.service.js';
import { ApplicationError } from '../utils/errors.js';
import { format, eachDayOfInterval, isToday, parseISO } from 'date-fns';
import {
  AdminUsageFilters,
  Analytics,
  UserBreakdown,
  ModelBreakdown,
  ProviderBreakdown,
  LiteLLMDayData,
  EnrichedDayData,
  AggregatedUsageData,
  ApiKeyUserMapping,
  TokenBreakdown,
  UserSummary,
  ModelSummary,
  ApiKeySummary,
  IDailyUsageCacheManager,
  TrendData,
  CostBreakdown,
  DailyUsageSummary,
  DailyModelUsage,
  DailyModelMetrics,
} from '../types/admin-usage.types.js';

/**
 * AdminUsageStatsService
 *
 * Provides comprehensive admin usage analytics with day-by-day incremental caching.
 *
 * Key features:
 * - Day-by-day data fetching from LiteLLM with intelligent caching
 * - API key → user mapping enrichment
 * - Multi-dimensional aggregation (user, model, provider)
 * - Historical data permanent caching, current day refresh every 5 minutes
 * - CSV/JSON export capabilities
 *
 * Architecture:
 * - Extends BaseService for error handling and database access
 * - Uses LiteLLMService for fetching usage data from LiteLLM API
 * - Uses DailyUsageCacheManager for database caching layer
 * - Follows ApplicationError factory pattern for all errors
 */
export class AdminUsageStatsService extends BaseService {
  private liteLLMService: LiteLLMService;
  private cacheManager: IDailyUsageCacheManager | null = null;

  // Constants for unknown/unmapped entities
  private readonly UNKNOWN_USER_ID = '00000000-0000-0000-0000-000000000000';
  private readonly UNKNOWN_USERNAME = 'Unknown User';
  private readonly UNKNOWN_EMAIL = 'unknown@system.local';
  private readonly UNKNOWN_ROLE = 'user';

  // Trend calculation threshold - percentage change within this range is considered "stable"
  private readonly TREND_STABILITY_THRESHOLD = 1.0; // 1%

  constructor(
    fastify: FastifyInstance,
    liteLLMService: LiteLLMService,
    cacheManager?: IDailyUsageCacheManager,
  ) {
    super(fastify);
    this.liteLLMService = liteLLMService;
    if (cacheManager) {
      this.cacheManager = cacheManager;
    } else {
      this.fastify.log.warn(
        'AdminUsageStatsService: DailyUsageCacheManager not provided - caching will be disabled',
      );
    }
  }

  // ==========================================
  // Public MVP Methods
  // ==========================================

  /**
   * Get analytics data aggregated across all users
   *
   * @param filters - Date range and optional dimension filters
   * @returns Analytics data with trends and top performers
   */
  async getAnalytics(filters: AdminUsageFilters): Promise<Analytics> {
    this.fastify.log.info({ filters }, 'AdminUsageStatsService: Getting analytics data');

    try {
      // Validate date range
      this.validateDateRange(filters.startDate, filters.endDate);

      // Collect data for date range
      const dailyData = await this.collectDateRangeData(filters.startDate, filters.endDate);

      if (dailyData.length === 0) {
        this.fastify.log.warn({ filters }, 'No data found for date range');
        return this.createEmptyAnalytics(filters.startDate, filters.endDate);
      }

      // Aggregate daily data
      const aggregated = this.aggregateDailyData(dailyData, filters);

      // Calculate global metrics
      const totalRequests = aggregated.totalMetrics.api_requests;
      const totalTokens: TokenBreakdown = {
        total: aggregated.totalMetrics.total_tokens,
        prompt: aggregated.totalMetrics.prompt_tokens,
        completion: aggregated.totalMetrics.completion_tokens,
      };
      const successRate =
        totalRequests > 0 ? (aggregated.totalMetrics.successful_requests / totalRequests) * 100 : 0;

      // Count unique users
      const uniqueUsers = Object.keys(aggregated.byUser).length;
      const activeUsers = Object.values(aggregated.byUser).filter(
        (user: any) => user.metrics.api_requests > 0,
      ).length;

      // Find top performers
      const topUser = this.findTopUser(aggregated.byUser, filters);
      const topModel = this.findTopModel(aggregated.byModel);
      const topApiKey = this.findTopApiKey(dailyData);

      // Log top user details for debugging
      this.fastify.log.info(
        {
          topUserFromAggregated: topUser,
          aggregatedByUserSample: Object.values(aggregated.byUser).slice(0, 2),
        },
        'Top user calculated from aggregated data',
      );

      // Calculate cost breakdown
      const costBreakdown = this.calculateCostBreakdown(aggregated);

      // Calculate trends by comparing with previous period
      let trends;
      try {
        // Calculate comparison period dates
        const { comparisonStart, comparisonEnd } = this.calculateComparisonPeriod(
          filters.startDate,
          filters.endDate,
        );

        this.fastify.log.info(
          {
            currentPeriod: { start: filters.startDate, end: filters.endDate },
            comparisonPeriod: { start: comparisonStart, end: comparisonEnd },
          },
          'Fetching comparison period data for trend calculation',
        );

        // Fetch comparison period data
        const comparisonDailyData = await this.collectDateRangeData(comparisonStart, comparisonEnd);

        if (comparisonDailyData.length > 0) {
          // Aggregate comparison period data
          const comparisonAggregated = this.aggregateDailyData(comparisonDailyData, filters);

          // Calculate previous period metrics
          const previousRequests = comparisonAggregated.totalMetrics.api_requests;
          const previousCost = comparisonAggregated.totalMetrics.spend;
          const previousActiveUsers = Object.values(comparisonAggregated.byUser).filter(
            (user: any) => user.metrics.api_requests > 0,
          ).length;
          const previousTotalTokens = comparisonAggregated.totalMetrics.total_tokens;
          const previousPromptTokens = comparisonAggregated.totalMetrics.prompt_tokens;
          const previousCompletionTokens = comparisonAggregated.totalMetrics.completion_tokens;

          // Calculate trends using comparison data
          trends = {
            requestsTrend: this.calculateTrend('requests', totalRequests, previousRequests),
            costTrend: this.calculateTrend('cost', aggregated.totalMetrics.spend, previousCost),
            usersTrend: this.calculateTrend('users', activeUsers, previousActiveUsers),
            totalTokensTrend: this.calculateTrend(
              'totalTokens',
              totalTokens.total,
              previousTotalTokens,
            ),
            promptTokensTrend: this.calculateTrend(
              'promptTokens',
              totalTokens.prompt,
              previousPromptTokens,
            ),
            completionTokensTrend: this.calculateTrend(
              'completionTokens',
              totalTokens.completion,
              previousCompletionTokens,
            ),
          };

          this.fastify.log.info(
            {
              current: {
                requests: totalRequests,
                cost: aggregated.totalMetrics.spend,
                users: activeUsers,
                totalTokens: totalTokens.total,
                promptTokens: totalTokens.prompt,
                completionTokens: totalTokens.completion,
              },
              previous: {
                requests: previousRequests,
                cost: previousCost,
                users: previousActiveUsers,
                totalTokens: previousTotalTokens,
                promptTokens: previousPromptTokens,
                completionTokens: previousCompletionTokens,
              },
              trends: {
                requests: trends.requestsTrend.direction,
                cost: trends.costTrend.direction,
                users: trends.usersTrend.direction,
                totalTokens: trends.totalTokensTrend.direction,
                promptTokens: trends.promptTokensTrend.direction,
                completionTokens: trends.completionTokensTrend.direction,
              },
            },
            'Trends calculated successfully with comparison data',
          );
        } else {
          // No comparison data available, use empty trends
          this.fastify.log.warn(
            { comparisonPeriod: { start: comparisonStart, end: comparisonEnd } },
            'No comparison data available for trend calculation, using stable trends',
          );
          trends = {
            requestsTrend: this.createEmptyTrend('requests', totalRequests),
            costTrend: this.createEmptyTrend('cost', aggregated.totalMetrics.spend),
            usersTrend: this.createEmptyTrend('users', activeUsers),
            totalTokensTrend: this.createEmptyTrend('totalTokens', totalTokens.total),
            promptTokensTrend: this.createEmptyTrend('promptTokens', totalTokens.prompt),
            completionTokensTrend: this.createEmptyTrend(
              'completionTokens',
              totalTokens.completion,
            ),
          };
        }
      } catch (error) {
        // Fallback to empty trends on error
        this.fastify.log.warn(
          { error },
          'Failed to calculate trends with comparison data, using stable trends',
        );
        trends = {
          requestsTrend: this.createEmptyTrend('requests', totalRequests),
          costTrend: this.createEmptyTrend('cost', aggregated.totalMetrics.spend),
          usersTrend: this.createEmptyTrend('users', activeUsers),
          totalTokensTrend: this.createEmptyTrend('totalTokens', totalTokens.total),
          promptTokensTrend: this.createEmptyTrend('promptTokens', totalTokens.prompt),
          completionTokensTrend: this.createEmptyTrend('completionTokens', totalTokens.completion),
        };
      }

      // Generate daily usage summary for charts
      const dailyUsage = this.generateDailyUsageSummary(dailyData, filters);

      this.fastify.log.info(
        {
          dailyDataCount: dailyData.length,
          dailyUsageCount: dailyUsage.length,
          sampleDailyData: dailyData.slice(0, 2).map((d) => ({
            date: d.date,
            requests: d.metrics?.api_requests,
            hasMetrics: !!d.metrics,
          })),
          sampleDailyUsage: dailyUsage.slice(0, 2),
        },
        'Daily usage summary generated for charts',
      );

      // Get top models for distribution charts
      const topModels = this.findTopModels(aggregated.byModel, 10);

      // Log top models details for debugging
      this.fastify.log.info(
        {
          topModelsCount: topModels.length,
          topModelsRequests: topModels.map((m) => ({ name: m.modelName, requests: m.requests })),
          topModelsTotalRequests: topModels.reduce((sum, m) => sum + m.requests, 0),
          aggregatedByModelSample: Object.values(aggregated.byModel)
            .slice(0, 3)
            .map((m: any) => ({
              name: m.modelName,
              requests: m.metrics.api_requests,
            })),
        },
        'Top models calculated from aggregated data',
      );

      // Get top users for Top Consumers table
      const topUsers = this.findTopUsers(aggregated.byUser, 5, filters);

      // Log top users details for debugging
      this.fastify.log.info(
        {
          topUsersCount: topUsers.length,
          topUsersCost: topUsers.map((u) => ({ username: u.username, cost: u.cost })),
        },
        'Top users calculated from aggregated data',
      );

      // Generate daily model usage summary for stacked trend charts
      const dailyModelUsage = this.generateDailyModelUsageSummary(dailyData, filters);

      this.fastify.log.info(
        {
          dailyDataCount: dailyData.length,
          dailyModelUsageCount: dailyModelUsage.length,
          sampleDailyModelUsage: dailyModelUsage.slice(0, 2).map((d) => ({
            date: d.date,
            modelCount: d.models.length,
            topModel: d.models[0]?.modelName,
          })),
        },
        'Daily model usage summary generated for stacked charts',
      );

      const analytics: Analytics = {
        period: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        totalUsers: uniqueUsers,
        activeUsers,
        totalRequests,
        totalTokens,
        totalCost: costBreakdown,
        successRate,
        averageLatency: 0, // TODO: Add latency tracking in Phase 2
        topMetrics: {
          topUser,
          topModel,
          topApiKey,
        },
        trends,
        dailyUsage,
        dailyModelUsage,
        topModels,
        topUsers,
      };

      this.fastify.log.info(
        {
          totalRequests,
          topUserRequests: topUser?.requests,
          topModelsTotal: topModels.reduce((sum, m) => sum + m.requests, 0),
          totalUsers: uniqueUsers,
          activeUsers,
          successRate,
        },
        'AdminUsageStatsService: Analytics data calculated successfully',
      );

      return analytics;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get analytics data');
      throw ApplicationError.fromUnknown(error, 'getting analytics data');
    }
  }

  /**
   * Get per-user usage breakdown
   *
   * @param filters - Date range and optional filters
   * @returns Array of user breakdowns sorted by cost descending
   */
  async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    this.fastify.log.info({ filters }, 'AdminUsageStatsService: Getting user breakdown');

    try {
      // Validate date range
      this.validateDateRange(filters.startDate, filters.endDate);

      // Collect data for date range
      const dailyData = await this.collectDateRangeData(filters.startDate, filters.endDate);

      if (dailyData.length === 0) {
        return [];
      }

      // Aggregate by user
      const userBreakdowns = this.aggregateByUser(dailyData);

      // Apply user filter if provided
      let filteredBreakdowns = userBreakdowns;
      if (filters.userIds && filters.userIds.length > 0) {
        filteredBreakdowns = userBreakdowns.filter((user) =>
          filters.userIds!.includes(user.userId),
        );
      }

      // Sort by cost descending
      filteredBreakdowns.sort((a, b) => b.metrics.cost - a.metrics.cost);

      this.fastify.log.info(
        { userCount: filteredBreakdowns.length },
        'AdminUsageStatsService: User breakdown calculated successfully',
      );

      return filteredBreakdowns;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user breakdown');
      throw ApplicationError.fromUnknown(error, 'getting user breakdown');
    }
  }

  /**
   * Get per-model usage breakdown
   *
   * @param filters - Date range and optional filters
   * @returns Array of model breakdowns sorted by cost descending
   */
  async getModelBreakdown(filters: AdminUsageFilters): Promise<ModelBreakdown[]> {
    this.fastify.log.info({ filters }, 'AdminUsageStatsService: Getting model breakdown');

    try {
      // Validate date range
      this.validateDateRange(filters.startDate, filters.endDate);

      // Collect data for date range
      const dailyData = await this.collectDateRangeData(filters.startDate, filters.endDate);

      if (dailyData.length === 0) {
        return [];
      }

      // Aggregate by model
      const modelBreakdowns = this.aggregateByModel(dailyData);

      // Apply model filter if provided
      let filteredBreakdowns = modelBreakdowns;
      if (filters.modelIds && filters.modelIds.length > 0) {
        filteredBreakdowns = modelBreakdowns.filter((model) =>
          filters.modelIds!.includes(model.modelId),
        );
      }

      // Sort by cost descending
      filteredBreakdowns.sort((a, b) => b.metrics.cost - a.metrics.cost);

      this.fastify.log.info(
        { modelCount: filteredBreakdowns.length },
        'AdminUsageStatsService: Model breakdown calculated successfully',
      );

      return filteredBreakdowns;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get model breakdown');
      throw ApplicationError.fromUnknown(error, 'getting model breakdown');
    }
  }

  /**
   * Get per-provider usage breakdown
   *
   * @param filters - Date range and optional filters
   * @returns Array of provider breakdowns sorted by cost descending
   */
  async getProviderBreakdown(filters: AdminUsageFilters): Promise<ProviderBreakdown[]> {
    this.fastify.log.info({ filters }, 'AdminUsageStatsService: Getting provider breakdown');

    try {
      // Validate date range
      this.validateDateRange(filters.startDate, filters.endDate);

      // Collect data for date range
      const dailyData = await this.collectDateRangeData(filters.startDate, filters.endDate);

      if (dailyData.length === 0) {
        return [];
      }

      // Aggregate by provider
      const providerBreakdowns = this.aggregateByProvider(dailyData);

      // Apply provider filter if provided
      let filteredBreakdowns = providerBreakdowns;
      if (filters.providerIds && filters.providerIds.length > 0) {
        filteredBreakdowns = providerBreakdowns.filter((provider) =>
          filters.providerIds!.includes(provider.provider),
        );
      }

      // Sort by cost descending
      filteredBreakdowns.sort((a, b) => b.metrics.cost - a.metrics.cost);

      this.fastify.log.info(
        { providerCount: filteredBreakdowns.length },
        'AdminUsageStatsService: Provider breakdown calculated successfully',
      );

      return filteredBreakdowns;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get provider breakdown');
      throw ApplicationError.fromUnknown(error, 'getting provider breakdown');
    }
  }

  /**
   * Export usage data in CSV or JSON format
   *
   * @param filters - Date range and optional filters
   * @param format - Export format ('csv' or 'json')
   * @returns Formatted export string
   */
  async exportUsageData(filters: AdminUsageFilters, format: 'csv' | 'json'): Promise<string> {
    this.fastify.log.info({ filters, format }, 'AdminUsageStatsService: Exporting usage data');

    try {
      // Get all breakdowns
      const [users, models, providers] = await Promise.all([
        this.getUserBreakdown(filters),
        this.getModelBreakdown(filters),
        this.getProviderBreakdown(filters),
      ]);

      if (format === 'json') {
        return JSON.stringify(
          {
            period: {
              startDate: filters.startDate,
              endDate: filters.endDate,
            },
            users,
            models,
            providers,
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        );
      } else {
        // CSV format - export user breakdown
        const csvLines: string[] = [];

        // Header
        csvLines.push(
          'User ID,Username,Email,Role,Requests,Total Tokens,Input Tokens,Output Tokens,Cost (USD)',
        );

        // Data rows
        users.forEach((user) => {
          csvLines.push(
            [
              user.userId,
              user.username,
              user.email,
              user.role,
              user.metrics.requests,
              user.metrics.tokens.total,
              user.metrics.tokens.prompt,
              user.metrics.tokens.completion,
              user.metrics.cost.toFixed(4),
            ].join(','),
          );
        });

        return csvLines.join('\n');
      }
    } catch (error) {
      this.fastify.log.error(error, 'Failed to export usage data');
      throw ApplicationError.fromUnknown(error, 'exporting usage data');
    }
  }

  /**
   * Force refresh current day's data
   *
   * Invalidates today's cache and fetches fresh data from LiteLLM
   */
  async refreshTodayData(): Promise<void> {
    this.fastify.log.info("AdminUsageStatsService: Refreshing today's data");

    try {
      const today = new Date();
      const formattedToday = format(today, 'yyyy-MM-dd');

      // Invalidate cache if available
      if (this.cacheManager) {
        await this.cacheManager.invalidateTodayCache();
        this.fastify.log.info("Today's cache invalidated");
      }

      // Fetch fresh data
      const liteLLMData = await this.fetchDailyDataFromLiteLLM(formattedToday);

      if (liteLLMData) {
        // Enrich with user mapping
        const enrichedData = await this.enrichWithUserMapping(liteLLMData);

        // Cache with current day flag
        if (this.cacheManager) {
          await this.cacheManager.saveToDailyCache(formattedToday, enrichedData, true);
        }

        this.fastify.log.info("Today's data refreshed successfully");
      } else {
        this.fastify.log.warn('No data available for today');
      }
    } catch (error) {
      this.fastify.log.error(error, "Failed to refresh today's data");
      throw ApplicationError.fromUnknown(error, "refreshing today's data");
    }
  }

  /**
   * Get available filter options based on actual usage data in the date range
   *
   * This endpoint returns models and users that actually have usage data in the specified
   * date range, including retired models and inactive users that may not appear in the
   * current /models or /admin/users endpoints.
   *
   * @param filters - Date range filters
   * @returns Filter options with models and users that have usage data
   *
   * @example
   * ```typescript
   * const options = await service.getFilterOptions({
   *   startDate: '2024-01-01',
   *   endDate: '2024-01-31'
   * });
   * console.log(`Found ${options.models.length} models with usage data`);
   * ```
   */
  async getFilterOptions(filters: { startDate: string; endDate: string }): Promise<{
    models: Array<{ id: string; name: string; provider: string }>;
    users: Array<{ userId: string; username: string; email: string }>;
  }> {
    this.fastify.log.info(
      { filters },
      'AdminUsageStatsService: Getting filter options from usage data',
    );

    try {
      // Validate date range
      this.validateDateRange(filters.startDate, filters.endDate);

      // Collect data for date range
      const dailyData = await this.collectDateRangeData(filters.startDate, filters.endDate);

      if (dailyData.length === 0) {
        this.fastify.log.warn({ filters }, 'No usage data found for date range');
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
                provider: this.extractProviderFromModel(modelName),
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
          dateRange: filters,
        },
        'AdminUsageStatsService: Filter options extracted from usage data',
      );

      return { models, users };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get filter options from usage data');
      throw ApplicationError.fromUnknown(error, 'getting filter options from usage data');
    }
  }

  /**
   * Rebuild aggregated cache columns from raw_data
   *
   * This method is useful when cache entries have stale aggregated data
   * but correct raw_data (e.g., synthetic test data or data cached with old code).
   *
   * @param startDate - Start date (YYYY-MM-DD format, optional)
   * @param endDate - End date (YYYY-MM-DD format, optional)
   * @returns Number of cache entries rebuilt
   */
  async rebuildCacheFromRaw(startDate?: string, endDate?: string): Promise<number> {
    this.fastify.log.info({ startDate, endDate }, 'Rebuilding cache from raw_data');

    try {
      // Build query to fetch cache entries
      let query = `SELECT date, raw_data FROM daily_usage_cache`;
      const params: any[] = [];

      if (startDate && endDate) {
        query += ` WHERE date >= $1 AND date <= $2`;
        params.push(startDate, endDate);
      } else if (startDate) {
        query += ` WHERE date >= $1`;
        params.push(startDate);
      } else if (endDate) {
        query += ` WHERE date <= $1`;
        params.push(endDate);
      }

      query += ` ORDER BY date ASC`;

      const result = await this.executeQuery<{ rows: any[] }>(
        query,
        params,
        'fetching cache entries for rebuild',
      );

      this.fastify.log.info(
        { count: result.rows.length },
        'Cache entries fetched, starting rebuild',
      );

      let rebuiltCount = 0;

      for (const row of result.rows) {
        const dateString = format(new Date(row.date), 'yyyy-MM-dd');
        const rawData = row.raw_data;

        this.fastify.log.debug({ date: dateString }, 'Rebuilding cache entry');

        try {
          // Parse raw_data back to LiteLLMDayData
          const liteLLMData: LiteLLMDayData = {
            date: rawData.date || dateString,
            metrics: rawData.metrics || {
              api_requests: 0,
              total_tokens: 0,
              prompt_tokens: 0,
              completion_tokens: 0,
              spend: 0,
              successful_requests: 0,
              failed_requests: 0,
            },
            breakdown: rawData.breakdown || {
              models: {},
              api_keys: {},
              providers: {},
            },
          };

          // Run through enrichment to rebuild aggregated data
          const enrichedData = await this.enrichWithUserMapping(liteLLMData);

          // Update aggregated columns in database
          await this.executeQuery(
            `UPDATE daily_usage_cache
             SET aggregated_by_user = $1,
                 aggregated_by_model = $2,
                 aggregated_by_provider = $3,
                 total_metrics = $4,
                 updated_at = NOW()
             WHERE date = $5`,
            [
              JSON.stringify(enrichedData.breakdown.users),
              JSON.stringify(enrichedData.breakdown.models),
              JSON.stringify(enrichedData.breakdown.providers),
              JSON.stringify(enrichedData.metrics),
              dateString,
            ],
            'updating aggregated cache columns',
          );

          rebuiltCount++;
          this.fastify.log.debug({ date: dateString }, 'Cache entry rebuilt successfully');
        } catch (error) {
          this.fastify.log.error(
            { error, date: dateString },
            'Failed to rebuild cache entry - continuing with others',
          );
          // Continue with other entries even if one fails
        }
      }

      this.fastify.log.info(
        { rebuiltCount, totalEntries: result.rows.length },
        'Cache rebuild complete',
      );

      return rebuiltCount;
    } catch (error) {
      this.fastify.log.error({ error }, 'Failed to rebuild cache from raw_data');
      throw ApplicationError.fromUnknown(error, 'rebuilding cache from raw_data');
    }
  }

  // ==========================================
  // Private Data Collection Methods
  // ==========================================

  /**
   * Fetch daily data from LiteLLM for a specific date
   *
   * @param date - The date to fetch
   * @returns Raw LiteLLM day data or null if no data
   */
  private async fetchDailyDataFromLiteLLM(dateString: string): Promise<LiteLLMDayData | null> {
    // Use string date directly - no timezone conversion needed

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
            if (!enrichedData.breakdown.users[this.UNKNOWN_USER_ID]) {
              enrichedData.breakdown.users[this.UNKNOWN_USER_ID] = {
                userId: this.UNKNOWN_USER_ID,
                username: this.UNKNOWN_USERNAME,
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
            if (!enrichedData.breakdown.users[this.UNKNOWN_USER_ID].models[modelName]) {
              enrichedData.breakdown.users[this.UNKNOWN_USER_ID].models[modelName] = {
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
            enrichedData.breakdown.users[this.UNKNOWN_USER_ID].models[modelName].api_keys![
              keyHash
            ] = {
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
              enrichedData.breakdown.users[this.UNKNOWN_USER_ID].models[modelName].metrics;
            unmappedUserModelMetrics.api_requests += keyData.metrics.api_requests;
            unmappedUserModelMetrics.total_tokens += keyData.metrics.total_tokens;
            unmappedUserModelMetrics.prompt_tokens += keyData.metrics.prompt_tokens || 0;
            unmappedUserModelMetrics.completion_tokens += keyData.metrics.completion_tokens || 0;
            unmappedUserModelMetrics.spend += keyData.metrics.spend;
            unmappedUserModelMetrics.successful_requests +=
              keyData.metrics.successful_requests || 0;
            unmappedUserModelMetrics.failed_requests += keyData.metrics.failed_requests || 0;

            // Update unmapped user's total metrics
            const unmappedUserMetrics = enrichedData.breakdown.users[this.UNKNOWN_USER_ID].metrics;
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
        enrichedData.breakdown.users[this.UNKNOWN_USER_ID] = {
          userId: this.UNKNOWN_USER_ID,
          username: this.UNKNOWN_USERNAME,
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
            enrichedData.breakdown.models[modelName].users[this.UNKNOWN_USER_ID] = {
              userId: this.UNKNOWN_USER_ID,
              username: this.UNKNOWN_USERNAME,
              email: this.UNKNOWN_EMAIL,
              metrics,
            };

            // Add to Unknown User's model breakdown
            enrichedData.breakdown.users[this.UNKNOWN_USER_ID].models[modelName] = {
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
          hasUnknownUser: enrichedData.breakdown.users[this.UNKNOWN_USER_ID] !== undefined,
        },
        'Data enrichment complete - API keys matched by hash',
      );

      return enrichedData;
    } catch (error) {
      this.fastify.log.error({ error, date: dayData.date }, 'Failed to enrich data');
      throw ApplicationError.fromUnknown(error, 'enriching data with user mappings');
    }
  }

  /**
   * Collect data for a date range day-by-day with caching
   *
   * @param startDate - Range start date
   * @param endDate - Range end date
   * @returns Array of enriched daily data
   */
  private async collectDateRangeData(
    startDate: string,
    endDate: string,
  ): Promise<EnrichedDayData[]> {
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
   * Get cached data or fetch from LiteLLM
   *
   * @param date - The date to get
   * @returns Enriched day data or null
   */
  private async getCachedOrFetch(dateString: string): Promise<EnrichedDayData | null> {
    // Work with string dates to avoid timezone conversion issues

    // Check cache first if available
    if (this.cacheManager) {
      const cached = await this.cacheManager.getCachedDailyData(dateString);
      // Use cached data for historical dates (older than 1 day)
      const date = parseISO(dateString);
      if (cached && this.isHistoricalDate(date)) {
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
   * Check if date is historical (more than 1 day old)
   *
   * @param date - Date to check
   * @returns true if historical
   */
  private isHistoricalDate(date: Date): boolean {
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff > 1;
  }

  // ==========================================
  // Private Aggregation Methods
  // ==========================================

  /**
   * Aggregate daily data across all days
   *
   * @param dailyData - Array of enriched daily data
   * @returns Aggregated usage data
   */
  private aggregateDailyData(
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

    // Calculate success rate
    if (aggregated.totalMetrics.api_requests > 0) {
      aggregated.totalMetrics.success_rate =
        (aggregated.totalMetrics.successful_requests / aggregated.totalMetrics.api_requests) * 100;
    }

    return aggregated;
  }

  /**
   * Aggregate by user
   *
   * @param dailyData - Array of enriched daily data
   * @returns Array of user breakdowns
   */
  private aggregateByUser(dailyData: EnrichedDayData[]): UserBreakdown[] {
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
            provider: this.extractProviderFromModel(modelData.modelName),
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
   * Aggregate by model
   *
   * @param dailyData - Array of enriched daily data
   * @returns Array of model breakdowns
   */
  private aggregateByModel(dailyData: EnrichedDayData[]): ModelBreakdown[] {
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
        provider: this.extractProviderFromModel(modelData.modelName),
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
   * Aggregate by provider
   *
   * @param dailyData - Array of enriched daily data
   * @returns Array of provider breakdowns
   */
  private aggregateByProvider(dailyData: EnrichedDayData[]): ProviderBreakdown[] {
    // Pass empty filters - no filtering for breakdown methods
    const emptyFilters: AdminUsageFilters = {
      startDate: dailyData[0]?.date || '',
      endDate: dailyData[dailyData.length - 1]?.date || '',
    };
    const aggregated = this.aggregateDailyData(dailyData, emptyFilters);

    return Object.values(aggregated.byProvider).map((providerData: any) => {
      // Count unique models and users for this provider
      const modelsForProvider = Object.keys(aggregated.byModel).filter(
        (modelName) => this.extractProviderFromModel(modelName) === providerData.provider,
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

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Extract provider name from model name
   *
   * @param modelName - Full model name (e.g., 'openai/gpt-4', 'anthropic/claude-3')
   * @returns Provider name
   */
  private extractProviderFromModel(modelName: string): string {
    if (modelName.includes('/')) {
      return modelName.split('/')[0];
    }
    // Try to infer from model name patterns
    if (modelName.startsWith('gpt')) return 'openai';
    if (modelName.startsWith('claude')) return 'anthropic';
    if (modelName.startsWith('gemini')) return 'google';
    return 'unknown';
  }

  /**
   * Validate date range
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @throws ApplicationError if invalid
   */
  private validateDateRange(startDate: string, endDate: string): void {
    // Simple string comparison works for YYYY-MM-DD format
    if (startDate > endDate) {
      throw this.createValidationError(
        'Start date must be before end date',
        'dateRange',
        { startDate, endDate },
        'Ensure the start date is earlier than the end date',
      );
    }

    // Limit to 365 days max - parse strings to calculate difference
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      throw this.createValidationError(
        'Date range cannot exceed 365 days',
        'dateRange',
        { daysDiff },
        'Select a shorter date range (maximum 365 days)',
      );
    }
  }

  /**
   * Find top user by cost
   *
   * @param byUser - User aggregation data
   * @returns Top user summary or null
   */
  private findTopUser(
    byUser: Record<string, any>,
    filters?: AdminUsageFilters,
  ): UserSummary | null {
    const users = Object.values(byUser);
    if (users.length === 0) return null;

    // Always filter out Unknown User from top user selection
    // Unknown User is a system placeholder for unmapped LiteLLM data and should not be featured
    const filteredUsers = users.filter((user: any) => user.userId !== this.UNKNOWN_USER_ID);

    if (filteredUsers.length === 0) return null;

    const topUser = filteredUsers.reduce((max: any, user: any) =>
      user.metrics.spend > max.metrics.spend ? user : max,
    );

    // Validate that topUser has all required fields with correct types
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
   */
  private findTopUsers(
    byUser: Record<string, any>,
    limit: number = 5,
    filters?: AdminUsageFilters,
  ): UserSummary[] {
    const users = Object.values(byUser);
    if (users.length === 0) return [];

    // Filter out Unknown User when user filtering is active
    const filteredUsers = users.filter((user: any) => {
      if (filters?.userIds && filters.userIds.length > 0) {
        return user.userId !== this.UNKNOWN_USER_ID;
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
      .filter((user) => user.requests > 0) // Only include users with requests
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }

  /**
   * Find top model by cost
   *
   * @param byModel - Model aggregation data
   * @returns Top model summary or null
   */
  private findTopModel(byModel: Record<string, any>): ModelSummary | null {
    const models = Object.values(byModel);
    if (models.length === 0) return null;

    const topModel = models.reduce((max: any, model: any) =>
      model.metrics.spend > max.metrics.spend ? model : max,
    );

    return {
      modelId: topModel.modelName,
      modelName: topModel.modelName,
      provider: this.extractProviderFromModel(topModel.modelName),
      requests: topModel.metrics.api_requests,
      tokens: topModel.metrics.total_tokens,
      prompt_tokens: topModel.metrics.prompt_tokens || 0,
      completion_tokens: topModel.metrics.completion_tokens || 0,
      cost: topModel.metrics.spend,
    };
  }

  /**
   * Find top API key by cost
   *
   * @param _dailyData - Daily data array (unused, reserved for future implementation)
   * @returns Top API key summary or null
   */
  private findTopApiKey(_dailyData: EnrichedDayData[]): ApiKeySummary | null {
    // TODO: Implement API key tracking in Phase 2
    return null;
  }

  /**
   * Find top N models by cost
   *
   * @param byModel - Model aggregation data
   * @param limit - Number of top models to return (default: 10)
   * @returns Array of top model summaries
   */
  private findTopModels(byModel: Record<string, any>, limit: number = 10): ModelSummary[] {
    const models = Object.values(byModel);
    if (models.length === 0) return [];

    return models
      .map((model: any) => ({
        modelId: model.modelName,
        modelName: model.modelName,
        provider: this.extractProviderFromModel(model.modelName),
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
   * Generate daily usage summary for trend charts
   *
   * @param dailyData - Daily data array
   * @returns Array of daily usage summaries
   */
  private generateDailyUsageSummary(
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
          // No filters, use total metrics
          requests = dayData.metrics.api_requests ?? 0;
          tokens = dayData.metrics.total_tokens ?? 0;
          prompt_tokens = dayData.metrics.prompt_tokens ?? 0;
          completion_tokens = dayData.metrics.completion_tokens ?? 0;
          cost = dayData.metrics.spend ?? 0;
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
   * @returns Array of daily model usage summaries
   */
  private generateDailyModelUsageSummary(
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

  /**
   * Calculate cost breakdown
   *
   * @param aggregated - Aggregated usage data
   * @returns Cost breakdown
   */
  private calculateCostBreakdown(aggregated: AggregatedUsageData): CostBreakdown {
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
   * Create empty analytics data for when no data exists
   *
   * @param startDate - Period start
   * @param endDate - Period end
   * @returns Empty analytics data
   */
  private createEmptyAnalytics(startDate: string, endDate: string): Analytics {
    return {
      period: { startDate, endDate },
      totalUsers: 0,
      activeUsers: 0,
      totalRequests: 0,
      totalTokens: { total: 0, prompt: 0, completion: 0 },
      totalCost: {
        total: 0,
        byProvider: {},
        byModel: {},
        byUser: {},
      },
      successRate: 0,
      averageLatency: 0,
      topMetrics: {
        topUser: null,
        topModel: null,
        topApiKey: null,
      },
      trends: {
        requestsTrend: this.createEmptyTrend('requests', 0),
        costTrend: this.createEmptyTrend('cost', 0),
        usersTrend: this.createEmptyTrend('users', 0),
        totalTokensTrend: this.createEmptyTrend('totalTokens', 0),
        promptTokensTrend: this.createEmptyTrend('promptTokens', 0),
        completionTokensTrend: this.createEmptyTrend('completionTokens', 0),
      },
      dailyUsage: [],
      topModels: [],
    };
  }

  /**
   * Calculate comparison period (previous period of equal length)
   *
   * @param startDate - Current period start date (YYYY-MM-DD)
   * @param endDate - Current period end date (YYYY-MM-DD)
   * @returns Comparison period dates
   */
  private calculateComparisonPeriod(
    startDate: string,
    endDate: string,
  ): { comparisonStart: string; comparisonEnd: string } {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    // Calculate the number of days in the current period (inclusive)
    // For example: Jan 20 to Jan 27 = 8 days (27-20+1)
    const periodLengthMs = end.getTime() - start.getTime();
    const periodLengthDays = Math.round(periodLengthMs / (1000 * 60 * 60 * 24)) + 1;

    // Calculate comparison period by shifting backward by the same length
    const comparisonEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000); // Day before start
    const comparisonStart = new Date(
      comparisonEnd.getTime() - (periodLengthDays - 1) * 24 * 60 * 60 * 1000,
    );

    return {
      comparisonStart: format(comparisonStart, 'yyyy-MM-dd'),
      comparisonEnd: format(comparisonEnd, 'yyyy-MM-dd'),
    };
  }

  /**
   * Calculate trend data by comparing current and previous period metrics
   *
   * @param metric - Metric name (e.g., 'requests', 'cost', 'users')
   * @param current - Current period value
   * @param previous - Comparison period value
   * @returns Trend data with direction and percentage change
   */
  private calculateTrend(metric: string, current: number, previous: number): TrendData {
    // Handle edge case: both zero
    if (current === 0 && previous === 0) {
      return {
        metric,
        current,
        previous,
        percentageChange: 0,
        direction: 'stable',
      };
    }

    // Handle edge case: previous is zero (avoid division by zero)
    if (previous === 0) {
      return {
        metric,
        current,
        previous,
        percentageChange: current > 0 ? 100 : 0, // Show 100% increase from zero baseline
        direction: current > 0 ? 'up' : 'stable',
      };
    }

    // Calculate percentage change
    const percentageChange = ((current - previous) / previous) * 100;

    // Determine direction based on stability threshold
    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(percentageChange) <= this.TREND_STABILITY_THRESHOLD) {
      direction = 'stable';
    } else if (percentageChange > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }

    return {
      metric,
      current,
      previous,
      percentageChange,
      direction,
    };
  }

  /**
   * Create empty trend data (fallback when comparison data unavailable)
   *
   * @param metric - Metric name
   * @param current - Current value
   * @returns Empty trend
   */
  private createEmptyTrend(metric: string, current: number): TrendData {
    return {
      metric,
      current,
      previous: 0,
      percentageChange: 0,
      direction: 'stable',
    };
  }
}

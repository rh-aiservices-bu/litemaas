import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service.js';
import { LiteLLMService } from './litellm.service.js';
import { ApplicationError } from '../utils/errors.js';
import { format } from 'date-fns';
import {
  AdminUsageFilters,
  Analytics,
  UserBreakdown,
  ModelBreakdown,
  ProviderBreakdown,
  IDailyUsageCacheManager,
  PaginationParams,
  PaginatedResponse,
  USER_BREAKDOWN_SORT_FIELDS,
  MODEL_BREAKDOWN_SORT_FIELDS,
  PROVIDER_BREAKDOWN_SORT_FIELDS,
} from '../types/admin-usage.types.js';
import {
  validatePaginationParams,
  validateSortField,
  sortAndPaginate,
} from '../utils/pagination.utils.js';
import { AdminUsageExportService } from './admin-usage/admin-usage-export.service.js';
import { AdminUsageTrendCalculator } from './admin-usage/admin-usage-trend-calculator.js';
import { AdminUsageAggregationService } from './admin-usage/admin-usage-aggregation.service.js';
import {
  calculateComparisonPeriod,
  validateDateRange as validateDateRangeUtil,
} from './admin-usage/admin-usage.utils.js';

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
  private exportService: AdminUsageExportService;
  private trendCalculator: AdminUsageTrendCalculator;
  private aggregationService: AdminUsageAggregationService;

  constructor(
    fastify: FastifyInstance,
    liteLLMService: LiteLLMService,
    cacheManager?: IDailyUsageCacheManager,
  ) {
    super(fastify);
    this.liteLLMService = liteLLMService;
    this.exportService = new AdminUsageExportService(fastify);
    this.trendCalculator = new AdminUsageTrendCalculator(fastify);
    // Pass liteLLMService and cacheManager to aggregationService for data pipeline
    this.aggregationService = new AdminUsageAggregationService(
      fastify,
      liteLLMService,
      cacheManager,
    );
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
    try {
      // Validate date range
      this.validateDateRange(filters.startDate, filters.endDate);

      // 1. Collect and aggregate current period data
      const dailyData = await this.aggregationService.collectDateRangeData(
        filters.startDate,
        filters.endDate,
      );

      if (dailyData.length === 0) {
        this.fastify.log.warn({ filters }, 'No data found for date range');
        return this.createEmptyAnalytics(filters.startDate, filters.endDate);
      }

      const currentAggregated = this.aggregationService.aggregateDailyData(dailyData, filters);
      const currentTotals = this.aggregationService.calculateTotals(currentAggregated);

      // 2. Calculate comparison period and aggregate comparison data
      const trends = await this.calculateTrendsWithComparison(filters, currentTotals);

      // 3. Generate chart data
      const dailyUsage = this.aggregationService.generateDailyUsageSummary(dailyData, filters);
      const dailyModelUsage = this.aggregationService.generateDailyModelUsageSummary(
        dailyData,
        filters,
      );

      // 4. Get top performers
      const topUser = this.aggregationService.findTopUser(currentAggregated.byUser, filters);
      const topModel = this.aggregationService.findTopModel(currentAggregated.byModel);
      const topApiKey = this.aggregationService.findTopApiKey(dailyData);
      const topModels = this.aggregationService.findTopModels(currentAggregated.byModel, 10);
      const topUsers = this.aggregationService.findTopUsers(currentAggregated.byUser, 5, filters);

      // 5. Calculate cost breakdown
      const costBreakdown = this.aggregationService.calculateCostBreakdown(currentAggregated);

      // 6. Build and return analytics response
      const analytics: Analytics = {
        period: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        totalUsers: currentTotals.uniqueUsers,
        activeUsers: currentTotals.activeUsers,
        totalRequests: currentTotals.totalRequests,
        totalTokens: {
          total: currentTotals.totalTokens,
          prompt: currentTotals.promptTokens,
          completion: currentTotals.completionTokens,
        },
        totalCost: costBreakdown,
        successRate: currentTotals.successRate,
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

      this.fastify.log.debug(
        {
          totalRequests: currentTotals.totalRequests,
          activeUsers: currentTotals.activeUsers,
        },
        'Analytics data calculated',
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
  /**
   * Get user breakdown with pagination
   *
   * @param filters - Date range and filter criteria
   * @param paginationParams - Pagination parameters (optional)
   * @returns Paginated user breakdown data
   */
  async getUserBreakdown(
    filters: AdminUsageFilters,
    paginationParams?: Partial<PaginationParams>,
  ): Promise<PaginatedResponse<UserBreakdown>> {
    try {
      // Validate and normalize pagination params
      const pagination = validatePaginationParams(paginationParams || {});

      // Validate sort field
      validateSortField(pagination.sortBy, USER_BREAKDOWN_SORT_FIELDS);

      this.fastify.log.info(
        {
          filters,
          pagination,
        },
        'Getting user breakdown with pagination',
      );

      // Get ALL user breakdown data (existing logic)
      const allUsers = await this.getUserBreakdownInternal(filters);

      this.fastify.log.debug({ totalUsers: allUsers.length }, 'Retrieved all user breakdown data');

      // Flatten data for sorting by mapping nested metrics to top-level fields
      const flattenedUsers = allUsers.map((user) => ({
        ...user,
        totalRequests: user.metrics.requests,
        totalTokens: user.metrics.tokens.total,
        promptTokens: user.metrics.tokens.prompt,
        completionTokens: user.metrics.tokens.completion,
        totalCost: user.metrics.cost,
      }));

      // Sort and paginate the flattened data
      const paginatedResult = sortAndPaginate(flattenedUsers, pagination);

      // Remove the temporary flattened fields from the result
      const cleanedData = paginatedResult.data.map(
        ({
          totalRequests: _tr,
          totalTokens: _tt,
          promptTokens: _pt,
          completionTokens: _ct,
          totalCost: _tc,
          ...user
        }) => user as UserBreakdown,
      );

      this.fastify.log.info(
        {
          page: paginatedResult.pagination.page,
          limit: paginatedResult.pagination.limit,
          total: paginatedResult.pagination.total,
          returned: cleanedData.length,
        },
        'Returning paginated user breakdown',
      );

      return {
        data: cleanedData,
        pagination: paginatedResult.pagination,
      };
    } catch (error) {
      this.fastify.log.error({ error, filters, paginationParams }, 'Failed to get user breakdown');
      throw ApplicationError.fromUnknown(error, 'getting user breakdown');
    }
  }

  /**
   * Internal method: Get all user breakdown data (no pagination)
   *
   * This is the existing logic, extracted to a separate method
   * so pagination can be applied on top.
   *
   * @param filters - Date range and filter criteria
   * @returns All user breakdown records
   */
  private async getUserBreakdownInternal(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    this.validateDateRange(filters.startDate, filters.endDate);

    const dailyData = await this.aggregationService.collectDateRangeData(
      filters.startDate,
      filters.endDate,
    );

    if (dailyData.length === 0) {
      return [];
    }

    const userBreakdowns = this.aggregationService.aggregateByUser(dailyData);

    // Apply user filter if provided
    let filteredBreakdowns = userBreakdowns;
    if (filters.userIds && filters.userIds.length > 0) {
      filteredBreakdowns = userBreakdowns.filter((user) => filters.userIds!.includes(user.userId));
    }

    return filteredBreakdowns;
  }

  /**
   * Get per-model usage breakdown
   *
   * @param filters - Date range and optional filters
   * @returns Array of model breakdowns sorted by cost descending
   */
  /**
   * Get model breakdown with pagination
   *
   * @param filters - Date range and filter criteria
   * @param paginationParams - Pagination parameters (optional)
   * @returns Paginated model breakdown data
   */
  async getModelBreakdown(
    filters: AdminUsageFilters,
    paginationParams?: Partial<PaginationParams>,
  ): Promise<PaginatedResponse<ModelBreakdown>> {
    try {
      const pagination = validatePaginationParams(paginationParams || {});
      validateSortField(pagination.sortBy, MODEL_BREAKDOWN_SORT_FIELDS);

      this.fastify.log.info({ filters, pagination }, 'Getting model breakdown');

      // Get all model data
      const allModels = await this.getModelBreakdownInternal(filters);

      // Flatten data for sorting
      const flattenedModels = allModels.map((model) => ({
        ...model,
        totalRequests: model.metrics.requests,
        totalTokens: model.metrics.tokens.total,
        promptTokens: model.metrics.tokens.prompt,
        completionTokens: model.metrics.tokens.completion,
        totalCost: model.metrics.cost,
      }));

      // Sort and paginate
      const paginatedResult = sortAndPaginate(flattenedModels, pagination);

      // Remove temporary flattened fields
      const cleanedData = paginatedResult.data.map(
        ({
          totalRequests: _tr,
          totalTokens: _tt,
          promptTokens: _pt,
          completionTokens: _ct,
          totalCost: _tc,
          ...model
        }) => model as ModelBreakdown,
      );

      this.fastify.log.info(
        {
          page: paginatedResult.pagination.page,
          total: paginatedResult.pagination.total,
          returned: cleanedData.length,
        },
        'Returning paginated model breakdown',
      );

      return {
        data: cleanedData,
        pagination: paginatedResult.pagination,
      };
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to get model breakdown');
      throw ApplicationError.fromUnknown(error, 'getting model breakdown');
    }
  }

  private async getModelBreakdownInternal(filters: AdminUsageFilters): Promise<ModelBreakdown[]> {
    this.validateDateRange(filters.startDate, filters.endDate);

    const dailyData = await this.aggregationService.collectDateRangeData(
      filters.startDate,
      filters.endDate,
    );

    if (dailyData.length === 0) {
      return [];
    }

    const modelBreakdowns = this.aggregationService.aggregateByModel(dailyData);

    // Apply model filter if provided
    let filteredBreakdowns = modelBreakdowns;
    if (filters.modelIds && filters.modelIds.length > 0) {
      filteredBreakdowns = modelBreakdowns.filter((model) =>
        filters.modelIds!.includes(model.modelId),
      );
    }

    return filteredBreakdowns;
  }

  /**
   * Get per-provider usage breakdown
   *
   * @param filters - Date range and optional filters
   * @returns Array of provider breakdowns sorted by cost descending
   */
  /**
   * Get provider breakdown with pagination
   *
   * @param filters - Date range and filter criteria
   * @param paginationParams - Pagination parameters (optional)
   * @returns Paginated provider breakdown data
   */
  async getProviderBreakdown(
    filters: AdminUsageFilters,
    paginationParams?: Partial<PaginationParams>,
  ): Promise<PaginatedResponse<ProviderBreakdown>> {
    try {
      const pagination = validatePaginationParams(paginationParams || {});
      validateSortField(pagination.sortBy, PROVIDER_BREAKDOWN_SORT_FIELDS);

      this.fastify.log.info({ filters, pagination }, 'Getting provider breakdown');

      // Get all provider data
      const allProviders = await this.getProviderBreakdownInternal(filters);

      // Flatten data for sorting
      const flattenedProviders = allProviders.map((provider) => ({
        ...provider,
        providerName: provider.provider,
        totalRequests: provider.metrics.requests,
        totalTokens: provider.metrics.tokens.total,
        promptTokens: provider.metrics.tokens.prompt,
        completionTokens: provider.metrics.tokens.completion,
        totalCost: provider.metrics.cost,
      }));

      // Sort and paginate
      const paginatedResult = sortAndPaginate(flattenedProviders, pagination);

      // Remove temporary flattened fields
      const cleanedData = paginatedResult.data.map(
        ({
          providerName: _pn,
          totalRequests: _tr,
          totalTokens: _tt,
          promptTokens: _pt,
          completionTokens: _ct,
          totalCost: _tc,
          ...provider
        }) => provider as ProviderBreakdown,
      );

      this.fastify.log.info(
        {
          page: paginatedResult.pagination.page,
          total: paginatedResult.pagination.total,
          returned: cleanedData.length,
        },
        'Returning paginated provider breakdown',
      );

      return {
        data: cleanedData,
        pagination: paginatedResult.pagination,
      };
    } catch (error) {
      this.fastify.log.error({ error, filters }, 'Failed to get provider breakdown');
      throw ApplicationError.fromUnknown(error, 'getting provider breakdown');
    }
  }

  private async getProviderBreakdownInternal(
    filters: AdminUsageFilters,
  ): Promise<ProviderBreakdown[]> {
    this.validateDateRange(filters.startDate, filters.endDate);

    const dailyData = await this.aggregationService.collectDateRangeData(
      filters.startDate,
      filters.endDate,
    );

    if (dailyData.length === 0) {
      return [];
    }

    const providerBreakdowns = this.aggregationService.aggregateByProvider(dailyData);

    // Apply provider filter if provided
    let filteredBreakdowns = providerBreakdowns;
    if (filters.providerIds && filters.providerIds.length > 0) {
      filteredBreakdowns = providerBreakdowns.filter((provider) =>
        filters.providerIds!.includes(provider.provider),
      );
    }

    return filteredBreakdowns;
  }

  /**
   * Export usage data in CSV or JSON format
   *
   * @param filters - Date range and optional filters
   * @param format - Export format ('csv' or 'json')
   * @returns Formatted export string
   */
  async exportUsageData(filters: AdminUsageFilters, format: 'csv' | 'json'): Promise<string> {
    try {
      // For export, get ALL users without pagination
      const users = await this.getUserBreakdownInternal(filters);

      if (format === 'json') {
        return this.exportService.exportToJSON(users, filters, 'user');
      } else {
        return this.exportService.exportUserBreakdownToCSV(users, filters);
      }
    } catch (error) {
      this.fastify.log.error(error, 'Failed to export usage data');
      throw ApplicationError.fromUnknown(error, 'exporting usage data');
    }
  }

  /**
   * Force refresh current day's data
   *
   * Invalidates both LiteLLM service cache and database cache, then fetches fresh data from LiteLLM.
   * This ensures that "Refresh Today" truly gets the latest data, bypassing all cache layers.
   */
  async refreshTodayData(): Promise<void> {
    try {
      const today = new Date();
      const formattedToday = format(today, 'yyyy-MM-dd');

      // CRITICAL: Clear LiteLLM service in-memory cache FIRST
      // Without this, getDailyActivity() would return stale cached data
      // even when the database cache is invalidated
      this.liteLLMService.clearActivityCache();

      // Then invalidate database cache
      if (this.cacheManager) {
        await this.cacheManager.invalidateTodayCache();
      }

      // Now fetch fresh data from LiteLLM (cache is clear, so it will hit the API)
      await this.aggregationService.refreshSingleDay(formattedToday);

      this.fastify.log.info({ date: formattedToday }, "Successfully refreshed today's usage data");
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
   */
  async getFilterOptions(filters: { startDate: string; endDate: string }): Promise<{
    models: Array<{ id: string; name: string; provider: string }>;
    users: Array<{ userId: string; username: string; email: string }>;
  }> {
    try {
      this.validateDateRange(filters.startDate, filters.endDate);

      return await this.aggregationService.getFilterOptions(filters.startDate, filters.endDate);
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
    // TODO: Re-implement using aggregation service public API
    // This method needs refactoring to use the aggregation service's
    // enrichment capabilities which are now private.
    // For now, recommend using refreshTodayData() for current day refresh
    // or waiting for Phase 1H+ to properly expose enrichment API
    this.fastify.log.warn(
      { startDate, endDate },
      'rebuildCacheFromRaw is temporarily disabled - needs refactoring for new service architecture',
    );
    throw ApplicationError.internal(
      'Cache rebuild from raw data is temporarily unavailable during service refactoring',
      {
        feature: 'rebuildCacheFromRaw',
        status: 'pending_refactor',
        alternative: 'Use refreshTodayData endpoint for current day refresh',
      },
    );
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Validate date range
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @throws ApplicationError if invalid
   */
  private validateDateRange(startDate: string, endDate: string): void {
    try {
      validateDateRangeUtil(startDate, endDate, 365);
    } catch (error) {
      throw this.createValidationError(
        error instanceof Error ? error.message : 'Invalid date range',
        'dateRange',
        { startDate, endDate },
        'Ensure the date range is valid and does not exceed 365 days',
      );
    }
  }

  /**
   * Calculate trends by comparing with previous period
   *
   * @param filters - Admin usage filters
   * @param currentTotals - Current period calculated totals
   * @returns Trends object with all trend data
   */
  private async calculateTrendsWithComparison(
    filters: AdminUsageFilters,
    currentTotals: ReturnType<AdminUsageAggregationService['calculateTotals']>,
  ) {
    try {
      // Calculate comparison period and fetch data
      const { comparisonStartDate, comparisonEndDate } = calculateComparisonPeriod(
        filters.startDate,
        filters.endDate,
      );

      const comparisonDailyData = await this.aggregationService.collectDateRangeData(
        comparisonStartDate,
        comparisonEndDate,
      );

      // Return empty trends if no comparison data available
      if (comparisonDailyData.length === 0) {
        this.fastify.log.debug('No comparison data available, using stable trends');
        return this.trendCalculator.createEmptyTrendsForMetrics(currentTotals);
      }

      // Aggregate and calculate trends
      const comparisonAggregated = this.aggregationService.aggregateDailyData(
        comparisonDailyData,
        filters,
      );
      const comparisonTotals = this.aggregationService.calculateTotals(comparisonAggregated);

      return this.trendCalculator.calculateAllStandardTrends(currentTotals, comparisonTotals);
    } catch (error) {
      this.fastify.log.warn({ error }, 'Failed to calculate trends, using stable trends');
      return this.trendCalculator.createEmptyTrendsForMetrics(currentTotals);
    }
  }

  /**
   * Create empty analytics data for when no data exists
   *
   * @param startDate - Period start
   * @param endDate - Period end
   * @returns Empty analytics data
   */
  private createEmptyAnalytics(startDate: string, endDate: string): Analytics {
    const emptyTotals = {
      totalRequests: 0,
      totalCost: 0,
      activeUsers: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
    };

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
      trends: this.trendCalculator.createEmptyTrendsForMetrics(emptyTotals),
      dailyUsage: [],
      topModels: [],
      topUsers: [],
      dailyModelUsage: [],
    };
  }
}

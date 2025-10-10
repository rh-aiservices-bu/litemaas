import { FastifyPluginAsync } from 'fastify';
import { AuthenticatedRequest } from '../types';
import {
  AdminUsageFiltersSchema,
  ExportQuerySchema,
  AnalyticsResponseSchema,
  UserBreakdownResponseSchema,
  ModelBreakdownResponseSchema,
  ProviderBreakdownResponseSchema,
  RefreshTodayResponseSchema,
  RebuildCacheRequestSchema,
  RebuildCacheResponseSchema,
  FilterOptionsQuerySchema,
  FilterOptionsResponseSchema,
  AdminUsageErrorResponseSchema,
  type ExportQuery,
} from '../schemas/admin-usage';
import type { AdminUsageFilters } from '../types/admin-usage.types';

import { AdminUsageStatsService } from '../services/admin-usage-stats.service';
import { DailyUsageCacheManager } from '../services/daily-usage-cache-manager';
import { LiteLLMService } from '../services/litellm.service';

const adminUsageRoutes: FastifyPluginAsync = async (fastify) => {
  const liteLLMService = new LiteLLMService(fastify);
  const cacheManager = new DailyUsageCacheManager(fastify);
  const adminUsageStatsService = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

  /**
   * Helper function to convert Date objects to ISO strings in response
   * Fastify schemas expect date-time as strings, but service returns Date objects
   */
  const serializeDates = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(serializeDates);
    if (typeof obj === 'object') {
      const serialized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = serializeDates(value);
      }
      return serialized;
    }
    return obj;
  };

  /**
   * POST /api/v1/admin/usage/analytics
   * Get global usage metrics across all users
   *
   * This endpoint provides comprehensive analytics of system-wide usage including:
   * - Total and active user counts
   * - Request and token metrics
   * - Cost breakdowns by provider, model, and user
   * - Success rates and performance metrics
   * - Trend analysis
   *
   * @requires admin or adminReadonly role
   * @param startDate - ISO 8601 date string (YYYY-MM-DD)
   * @param endDate - ISO 8601 date string (YYYY-MM-DD)
   * @param userIds - Optional array of user UUIDs to filter by
   * @param modelIds - Optional array of model IDs to filter by
   * @param providerIds - Optional array of provider IDs to filter by
   */
  fastify.post<{
    Body: AdminUsageFilters;
  }>('/analytics', {
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get global usage metrics',
      description:
        'Get comprehensive global usage metrics across all users. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      body: AdminUsageFiltersSchema,
      response: {
        200: AnalyticsResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const queryFilters = request.body;
      let filters: AdminUsageFilters | undefined;

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = queryFilters.startDate;
        const endDate = queryFilters.endDate;

        // Simple string comparison is valid for YYYY-MM-DD format
        if (startDate > endDate) {
          return reply.code(400).send({
            error: 'Start date must be before or equal to end date',
            code: 'INVALID_DATE_RANGE',
          });
        }

        // Create filters object with string dates
        filters = {
          startDate,
          endDate,
          userIds: queryFilters.userIds,
          modelIds: queryFilters.modelIds,
          providerIds: queryFilters.providerIds,
          apiKeyIds: queryFilters.apiKeyIds,
        };

        // Log admin action for audit trail
        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            adminUsername: authRequest.user?.username,
            filters: queryFilters,
            apiKeyIds: queryFilters.apiKeyIds,
            apiKeyIdsLength: queryFilters.apiKeyIds?.length || 0,
            action: 'get_global_metrics',
          },
          'Admin requested global usage metrics',
        );

        const result = await adminUsageStatsService.getAnalytics(filters);
        const serializedResult = serializeDates(result);
        return reply.code(200).send(serializedResult);
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            filters: filters || queryFilters,
          },
          'Failed to get global usage metrics',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving global metrics',
          code: 'GLOBAL_METRICS_FAILED',
        });
      }
    },
  });

  /**
   * GET /api/v1/admin/usage/by-user
   * Get usage breakdown by user
   *
   * This endpoint provides detailed usage metrics for each user including:
   * - Request counts and token usage
   * - Cost per user
   * - Models used by each user
   * - Last activity timestamp
   *
   * @requires admin or adminReadonly role
   */
  fastify.get<{
    Querystring: AdminUsageFilters;
  }>('/by-user', {
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get usage breakdown by user',
      description:
        'Get detailed usage metrics broken down by user. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      querystring: AdminUsageFiltersSchema,
      response: {
        200: UserBreakdownResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const queryFilters = request.query;
      let filters: AdminUsageFilters | undefined;

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = queryFilters.startDate;
        const endDate = queryFilters.endDate;

        // Simple string comparison is valid for YYYY-MM-DD format
        if (startDate > endDate) {
          return reply.code(400).send({
            error: 'Start date must be before or equal to end date',
            code: 'INVALID_DATE_RANGE',
          });
        }

        // Create filters object with string dates
        filters = {
          startDate,
          endDate,
          userIds: queryFilters.userIds,
          modelIds: queryFilters.modelIds,
          providerIds: queryFilters.providerIds,
        };

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            filters: queryFilters,
            action: 'get_user_breakdown',
          },
          'Admin requested user breakdown',
        );

        const result = await adminUsageStatsService.getUserBreakdown(filters);
        const serializedResult = serializeDates(result);

        // Debug logging
        fastify.log.info(
          {
            resultSample: serializedResult.slice(0, 1),
            resultCount: serializedResult.length,
          },
          'User breakdown result before serialization',
        );

        return reply.code(200).send({
          users: serializedResult,
          total: serializedResult.length,
        });
      } catch (error) {
        fastify.log.error(
          {
            error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
            adminUser: authRequest.user?.userId,
            filters: filters || queryFilters,
          },
          'Failed to get user breakdown',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving user breakdown',
          code: 'USER_BREAKDOWN_FAILED',
        });
      }
    },
  });

  /**
   * GET /api/v1/admin/usage/by-model
   * Get usage breakdown by model
   *
   * This endpoint provides detailed usage metrics for each model including:
   * - Request counts and token usage per model
   * - Cost per model
   * - Number of unique users per model
   * - Success rates and average latency per model
   *
   * @requires admin or adminReadonly role
   */
  fastify.get<{
    Querystring: AdminUsageFilters;
  }>('/by-model', {
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get usage breakdown by model',
      description:
        'Get detailed usage metrics broken down by model. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      querystring: AdminUsageFiltersSchema,
      response: {
        200: ModelBreakdownResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const queryFilters = request.query;
      let filters: AdminUsageFilters | undefined;

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = queryFilters.startDate;
        const endDate = queryFilters.endDate;

        // Simple string comparison is valid for YYYY-MM-DD format
        if (startDate > endDate) {
          return reply.code(400).send({
            error: 'Start date must be before or equal to end date',
            code: 'INVALID_DATE_RANGE',
          });
        }

        // Create filters object with string dates
        filters = {
          startDate,
          endDate,
          userIds: queryFilters.userIds,
          modelIds: queryFilters.modelIds,
          providerIds: queryFilters.providerIds,
        };

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            filters: queryFilters,
            action: 'get_model_breakdown',
          },
          'Admin requested model breakdown',
        );

        const result = await adminUsageStatsService.getModelBreakdown(filters);
        const serializedResult = serializeDates(result);
        return reply.code(200).send({
          models: serializedResult,
          total: serializedResult.length,
        });
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            filters: filters || queryFilters,
          },
          'Failed to get model breakdown',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving model breakdown',
          code: 'MODEL_BREAKDOWN_FAILED',
        });
      }
    },
  });

  /**
   * GET /api/v1/admin/usage/by-provider
   * Get usage breakdown by provider
   *
   * This endpoint provides detailed usage metrics for each provider (OpenAI, Azure, etc.) including:
   * - Request counts and token usage per provider
   * - Cost per provider
   * - Number of models and users per provider
   * - Success rates and average latency per provider
   *
   * @requires admin or adminReadonly role
   */
  fastify.get<{
    Querystring: AdminUsageFilters;
  }>('/by-provider', {
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get usage breakdown by provider',
      description:
        'Get detailed usage metrics broken down by provider (OpenAI, Azure, etc.). Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      querystring: AdminUsageFiltersSchema,
      response: {
        200: ProviderBreakdownResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const queryFilters = request.query;
      let filters: AdminUsageFilters | undefined;

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = queryFilters.startDate;
        const endDate = queryFilters.endDate;

        // Simple string comparison is valid for YYYY-MM-DD format
        if (startDate > endDate) {
          return reply.code(400).send({
            error: 'Start date must be before or equal to end date',
            code: 'INVALID_DATE_RANGE',
          });
        }

        // Create filters object with string dates
        filters = {
          startDate,
          endDate,
          userIds: queryFilters.userIds,
          modelIds: queryFilters.modelIds,
          providerIds: queryFilters.providerIds,
        };

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            filters: queryFilters,
            action: 'get_provider_breakdown',
          },
          'Admin requested provider breakdown',
        );

        const result = await adminUsageStatsService.getProviderBreakdown(filters);
        const serializedResult = serializeDates(result);
        return reply.code(200).send({
          providers: serializedResult,
          total: serializedResult.length,
        });
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            filters: filters || queryFilters,
          },
          'Failed to get provider breakdown',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving provider breakdown',
          code: 'PROVIDER_BREAKDOWN_FAILED',
        });
      }
    },
  });

  /**
   * GET /api/v1/admin/usage/export
   * Export usage data
   *
   * This endpoint exports comprehensive usage data in CSV or JSON format.
   * The export includes all available metrics for the specified date range and filters.
   *
   * @requires admin or adminReadonly role
   * @param format - Export format (csv or json), defaults to csv
   */
  fastify.get<{
    Querystring: ExportQuery;
  }>('/export', {
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Export usage data',
      description:
        'Export comprehensive usage data in CSV or JSON format. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      querystring: ExportQuerySchema,
      response: {
        200: {
          type: 'string',
          description: 'File download (CSV or JSON)',
        },
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const query = request.query;
      const format = query.format || 'csv';

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = query.startDate;
        const endDate = query.endDate;

        // Simple string comparison is valid for YYYY-MM-DD format
        if (startDate > endDate) {
          return reply.code(400).send({
            error: 'Start date must be before or equal to end date',
            code: 'INVALID_DATE_RANGE',
          });
        }

        // Create filters object with string dates for the service
        const filters: AdminUsageFilters = {
          startDate,
          endDate,
          userIds: query.userIds,
          modelIds: query.modelIds,
          providerIds: query.providerIds,
        };

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            format,
            dateRange: { start: query.startDate, end: query.endDate },
            action: 'export_usage_data',
          },
          'Admin requested usage data export',
        );

        const exportData = await adminUsageStatsService.exportUsageData(filters, format);

        // Set appropriate headers for file download
        const filename = `admin-usage-export-${query.startDate}-to-${query.endDate}.${format}`;
        reply.header('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);

        return reply.code(200).send(exportData);
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            query,
          },
          'Failed to export usage data',
        );

        return reply.code(500).send({
          error: 'Internal server error while exporting usage data',
          code: 'EXPORT_FAILED',
        });
      }
    },
  });

  /**
   * POST /api/v1/admin/usage/refresh-today
   * Refresh current day's usage data
   *
   * This endpoint forces a refresh of today's usage data from LiteLLM.
   * Historical data (> 1 day old) is cached permanently and not refreshed.
   * Current day data is cached with a short TTL (5 minutes) and can be manually refreshed.
   *
   * @requires admin role (not adminReadonly - this is a write operation)
   */
  fastify.post('/refresh-today', {
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Refresh current day usage data',
      description:
        "Force refresh of today's usage data from LiteLLM. Requires admin role (write operation).",
      security: [{ bearerAuth: [] }],
      response: {
        200: RefreshTodayResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;

      try {
        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            adminUsername: authRequest.user?.username,
            action: 'refresh_today_data',
          },
          'Admin requested refresh of current day usage data',
        );

        await adminUsageStatsService.refreshTodayData();

        return reply.code(200).send({
          message: 'Current day usage data refreshed successfully',
          refreshedAt: new Date().toISOString(),
          status: 'success',
        });
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
          },
          'Failed to refresh today usage data',
        );

        return reply.code(500).send({
          error: 'Internal server error while refreshing current day data',
          code: 'REFRESH_FAILED',
        });
      }
    },
  });

  /**
   * GET /api/v1/admin/usage/filter-options
   * Get available filter options based on actual usage data
   *
   * This endpoint returns models and users that actually have usage data in the specified
   * date range. This includes retired models and inactive users that may not appear in
   * the /models or /admin/users endpoints but have historical usage data.
   *
   * Use this for analytics filter dropdowns to show only relevant options.
   *
   * @requires admin or adminReadonly role
   * @param startDate - ISO 8601 date string (YYYY-MM-DD)
   * @param endDate - ISO 8601 date string (YYYY-MM-DD)
   */
  fastify.get<{
    Querystring: { startDate: string; endDate: string };
  }>('/filter-options', {
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get filter options from usage data',
      description:
        'Get models and users that have usage data in the specified date range. Includes retired/inactive entities with historical data. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      querystring: FilterOptionsQuerySchema,
      response: {
        200: FilterOptionsResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { startDate, endDate } = request.query;

      try {
        // Validate date range
        if (startDate > endDate) {
          return reply.code(400).send({
            error: 'Start date must be before or equal to end date',
            code: 'INVALID_DATE_RANGE',
          });
        }

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            adminUsername: authRequest.user?.username,
            dateRange: { startDate, endDate },
            action: 'get_filter_options',
          },
          'Admin requested filter options from usage data',
        );

        const result = await adminUsageStatsService.getFilterOptions({
          startDate,
          endDate,
        });

        return reply.code(200).send(result);
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            query: { startDate, endDate },
          },
          'Failed to get filter options from usage data',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving filter options',
          code: 'FILTER_OPTIONS_FAILED',
        });
      }
    },
  });

  /**
   * POST /api/v1/admin/usage/rebuild-cache
   * Rebuild aggregated cache columns from raw_data
   *
   * This endpoint rebuilds the aggregated columns (aggregated_by_user, aggregated_by_model, etc.)
   * from the existing raw_data in daily_usage_cache. Useful when cache has stale aggregated data
   * but correct raw_data (e.g., synthetic test data or data cached with old code).
   *
   * @param startDate - Optional start date (YYYY-MM-DD) to limit rebuild scope
   * @param endDate - Optional end date (YYYY-MM-DD) to limit rebuild scope
   * @requires admin role (not adminReadonly - this is a write operation)
   */
  fastify.post<{
    Body: { startDate?: string; endDate?: string };
  }>('/rebuild-cache', {
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Rebuild cache from raw data',
      description:
        'Rebuild aggregated cache columns from raw_data. Useful for fixing stale aggregated data. Requires admin role (write operation).',
      security: [{ bearerAuth: [] }],
      body: RebuildCacheRequestSchema,
      response: {
        200: RebuildCacheResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { startDate, endDate } = request.body;

      try {
        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            adminUsername: authRequest.user?.username,
            action: 'rebuild_cache',
            startDate,
            endDate,
          },
          'Admin requested cache rebuild from raw_data',
        );

        const rebuiltCount = await adminUsageStatsService.rebuildCacheFromRaw(startDate, endDate);

        return reply.code(200).send({
          message: `Successfully rebuilt ${rebuiltCount} cache entries from raw_data`,
          rebuiltCount,
          totalEntries: rebuiltCount, // Same as rebuiltCount since we only query entries in range
          status: 'success',
        });
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            startDate,
            endDate,
          },
          'Failed to rebuild cache from raw_data',
        );

        return reply.code(500).send({
          error: 'Internal server error while rebuilding cache',
          code: 'REBUILD_FAILED',
        });
      }
    },
  });
};

export default adminUsageRoutes;

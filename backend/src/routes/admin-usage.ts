import { FastifyPluginAsync } from 'fastify';
import { AuthenticatedRequest } from '../types';
import {
  AdminUsageFiltersSchema,
  PaginationQuerySchema,
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
import { getRateLimitConfig } from '../config/rate-limit.config';
import {
  validateDateRangeWithWarning,
  validateDateRangeSize,
  suggestDateRanges,
} from '../utils/date-validation';

import { AdminUsageStatsService } from '../services/admin-usage-stats.service';
import { DailyUsageCacheManager } from '../services/daily-usage-cache-manager';
import { LiteLLMService } from '../services/litellm.service';

const adminUsageRoutes: FastifyPluginAsync = async (fastify) => {
  const liteLLMService = new LiteLLMService(fastify);
  const cacheManager = new DailyUsageCacheManager(fastify);
  const adminUsageStatsService = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

  // Get admin analytics configuration
  const config = fastify.getAdminAnalyticsConfig();

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
    config: {
      rateLimit: getRateLimitConfig('analytics'),
    },
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
        429: AdminUsageErrorResponseSchema,
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

        // Validate date range size
        const validation = validateDateRangeWithWarning(
          startDate,
          endDate,
          config.dateRangeLimits.maxAnalyticsDays,
          config.warnings.largeDateRangeDays,
        );

        if (!validation.valid) {
          // Generate suggested ranges
          const suggestedRanges = suggestDateRanges(
            startDate,
            endDate,
            config.dateRangeLimits.maxAnalyticsDays,
          );

          return reply.code(400).send({
            error: validation.error,
            code: validation.code,
            details: {
              requestedDays: validation.days,
              maxAllowedDays: config.dateRangeLimits.maxAnalyticsDays,
              suggestion: `Break your request into ${suggestedRanges.length} smaller date ranges`,
              suggestedRanges: suggestedRanges.slice(0, 4), // First 4 suggestions only
            },
          });
        }

        // Log warning for large ranges
        if (validation.warning) {
          fastify.log.warn(
            {
              userId: authRequest.user?.userId,
              startDate,
              endDate,
              rangeInDays: validation.days,
              endpoint: '/analytics',
            },
            'Large date range requested for analytics',
          );
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
   * POST /api/v1/admin/usage/by-user
   * Get usage breakdown by user with pagination
   *
   * This endpoint provides detailed usage metrics for each user including:
   * - Request counts and token usage
   * - Cost per user
   * - Models used by each user
   * - Last activity timestamp
   *
   * Supports pagination and sorting via query parameters.
   * Filter arrays sent in request body to avoid URL length limits.
   *
   * @requires admin or adminReadonly role
   */
  fastify.post<{
    Body: AdminUsageFilters;
    Querystring: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };
  }>('/by-user', {
    config: {
      rateLimit: getRateLimitConfig('analytics'),
    },
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get paginated usage breakdown by user',
      description:
        'Get detailed usage metrics broken down by user with pagination and sorting support. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      body: AdminUsageFiltersSchema,
      querystring: PaginationQuerySchema,
      response: {
        200: UserBreakdownResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        429: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const bodyFilters = request.body;
      const paginationQuery = request.query;
      let filters: AdminUsageFilters | undefined;

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = bodyFilters.startDate;
        const endDate = bodyFilters.endDate;

        // Validate date range size
        const validation = validateDateRangeWithWarning(
          startDate,
          endDate,
          config.dateRangeLimits.maxAnalyticsDays,
          config.warnings.largeDateRangeDays,
        );

        if (!validation.valid) {
          const suggestedRanges = suggestDateRanges(
            startDate,
            endDate,
            config.dateRangeLimits.maxAnalyticsDays,
          );

          return reply.code(400).send({
            error: validation.error,
            code: validation.code,
            details: {
              requestedDays: validation.days,
              maxAllowedDays: config.dateRangeLimits.maxAnalyticsDays,
              suggestion: `Break your request into ${suggestedRanges.length} smaller date ranges`,
              suggestedRanges: suggestedRanges.slice(0, 4),
            },
          });
        }

        // Log warning for large ranges
        if (validation.warning) {
          fastify.log.warn(
            {
              userId: authRequest.user?.userId,
              startDate,
              endDate,
              rangeInDays: validation.days,
              endpoint: '/by-user',
            },
            'Large date range requested for user breakdown',
          );
        }

        // Create filters object with string dates
        filters = {
          startDate,
          endDate,
          userIds: bodyFilters.userIds,
          modelIds: bodyFilters.modelIds,
          providerIds: bodyFilters.providerIds,
          apiKeyIds: bodyFilters.apiKeyIds,
        };

        // Extract pagination parameters from query
        const paginationParams = {
          page: paginationQuery.page,
          limit: paginationQuery.limit,
          sortBy: paginationQuery.sortBy,
          sortOrder: paginationQuery.sortOrder,
        };

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            filters: bodyFilters,
            pagination: paginationParams,
            action: 'get_user_breakdown',
          },
          'Admin requested user breakdown with pagination',
        );

        const result = await adminUsageStatsService.getUserBreakdown(filters, paginationParams);
        const serializedResult = serializeDates(result);

        return reply.code(200).send(serializedResult);
      } catch (error) {
        fastify.log.error(
          {
            error,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
            adminUser: authRequest.user?.userId,
            filters: filters || bodyFilters,
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
   * POST /api/v1/admin/usage/by-model
   * Get usage breakdown by model with pagination
   *
   * This endpoint provides detailed usage metrics for each model including:
   * - Request counts and token usage per model
   * - Cost per model
   * - Number of unique users per model
   * - Success rates and average latency per model
   *
   * Supports pagination and sorting via query parameters.
   * Filter arrays sent in request body to avoid URL length limits.
   *
   * @requires admin or adminReadonly role
   */
  fastify.post<{
    Body: AdminUsageFilters;
    Querystring: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };
  }>('/by-model', {
    config: {
      rateLimit: getRateLimitConfig('analytics'),
    },
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get paginated usage breakdown by model',
      description:
        'Get detailed usage metrics broken down by model with pagination and sorting support. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      body: AdminUsageFiltersSchema,
      querystring: PaginationQuerySchema,
      response: {
        200: ModelBreakdownResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        429: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const bodyFilters = request.body;
      const paginationQuery = request.query;
      let filters: AdminUsageFilters | undefined;

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = bodyFilters.startDate;
        const endDate = bodyFilters.endDate;

        // Validate date range size
        const validation = validateDateRangeWithWarning(
          startDate,
          endDate,
          config.dateRangeLimits.maxAnalyticsDays,
          config.warnings.largeDateRangeDays,
        );

        if (!validation.valid) {
          const suggestedRanges = suggestDateRanges(
            startDate,
            endDate,
            config.dateRangeLimits.maxAnalyticsDays,
          );

          return reply.code(400).send({
            error: validation.error,
            code: validation.code,
            details: {
              requestedDays: validation.days,
              maxAllowedDays: config.dateRangeLimits.maxAnalyticsDays,
              suggestion: `Break your request into ${suggestedRanges.length} smaller date ranges`,
              suggestedRanges: suggestedRanges.slice(0, 4),
            },
          });
        }

        // Log warning for large ranges
        if (validation.warning) {
          fastify.log.warn(
            {
              userId: authRequest.user?.userId,
              startDate,
              endDate,
              rangeInDays: validation.days,
              endpoint: '/by-model',
            },
            'Large date range requested for model breakdown',
          );
        }

        // Create filters object with string dates
        filters = {
          startDate,
          endDate,
          userIds: bodyFilters.userIds,
          modelIds: bodyFilters.modelIds,
          providerIds: bodyFilters.providerIds,
          apiKeyIds: bodyFilters.apiKeyIds,
        };

        // Extract pagination parameters from query
        const paginationParams = {
          page: paginationQuery.page,
          limit: paginationQuery.limit,
          sortBy: paginationQuery.sortBy,
          sortOrder: paginationQuery.sortOrder,
        };

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            filters: bodyFilters,
            pagination: paginationParams,
            action: 'get_model_breakdown',
          },
          'Admin requested model breakdown with pagination',
        );

        const result = await adminUsageStatsService.getModelBreakdown(filters, paginationParams);
        const serializedResult = serializeDates(result);
        return reply.code(200).send(serializedResult);
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            filters: filters || bodyFilters,
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
   * POST /api/v1/admin/usage/by-provider
   * Get usage breakdown by provider with pagination
   *
   * This endpoint provides detailed usage metrics for each provider (OpenAI, Azure, etc.) including:
   * - Request counts and token usage per provider
   * - Cost per provider
   * - Number of models and users per provider
   * - Success rates and average latency per provider
   *
   * Supports pagination and sorting via query parameters.
   * Filter arrays sent in request body to avoid URL length limits.
   *
   * @requires admin or adminReadonly role
   */
  fastify.post<{
    Body: AdminUsageFilters;
    Querystring: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };
  }>('/by-provider', {
    config: {
      rateLimit: getRateLimitConfig('analytics'),
    },
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get paginated usage breakdown by provider',
      description:
        'Get detailed usage metrics broken down by provider (OpenAI, Azure, etc.) with pagination and sorting support. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      body: AdminUsageFiltersSchema,
      querystring: PaginationQuerySchema,
      response: {
        200: ProviderBreakdownResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        429: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const bodyFilters = request.body;
      const paginationQuery = request.query;
      let filters: AdminUsageFilters | undefined;

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = bodyFilters.startDate;
        const endDate = bodyFilters.endDate;

        // Validate date range size
        const validation = validateDateRangeWithWarning(
          startDate,
          endDate,
          config.dateRangeLimits.maxAnalyticsDays,
          config.warnings.largeDateRangeDays,
        );

        if (!validation.valid) {
          const suggestedRanges = suggestDateRanges(
            startDate,
            endDate,
            config.dateRangeLimits.maxAnalyticsDays,
          );

          return reply.code(400).send({
            error: validation.error,
            code: validation.code,
            details: {
              requestedDays: validation.days,
              maxAllowedDays: config.dateRangeLimits.maxAnalyticsDays,
              suggestion: `Break your request into ${suggestedRanges.length} smaller date ranges`,
              suggestedRanges: suggestedRanges.slice(0, 4),
            },
          });
        }

        // Log warning for large ranges
        if (validation.warning) {
          fastify.log.warn(
            {
              userId: authRequest.user?.userId,
              startDate,
              endDate,
              rangeInDays: validation.days,
              endpoint: '/by-provider',
            },
            'Large date range requested for provider breakdown',
          );
        }

        // Create filters object with string dates
        filters = {
          startDate,
          endDate,
          userIds: bodyFilters.userIds,
          modelIds: bodyFilters.modelIds,
          providerIds: bodyFilters.providerIds,
          apiKeyIds: bodyFilters.apiKeyIds,
        };

        // Extract pagination parameters from query
        const paginationParams = {
          page: paginationQuery.page,
          limit: paginationQuery.limit,
          sortBy: paginationQuery.sortBy,
          sortOrder: paginationQuery.sortOrder,
        };

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            filters: bodyFilters,
            pagination: paginationParams,
            action: 'get_provider_breakdown',
          },
          'Admin requested provider breakdown with pagination',
        );

        const result = await adminUsageStatsService.getProviderBreakdown(filters, paginationParams);
        const serializedResult = serializeDates(result);
        return reply.code(200).send(serializedResult);
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            filters: filters || bodyFilters,
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
   * POST /api/v1/admin/usage/export
   * Export usage data
   *
   * This endpoint exports comprehensive usage data in CSV or JSON format.
   * The export includes all available metrics for the specified date range and filters.
   * Filter arrays sent in request body to avoid URL length limits.
   *
   * @requires admin or adminReadonly role
   * @param format - Export format (csv or json), defaults to csv
   */
  fastify.post<{
    Body: ExportQuery;
  }>('/export', {
    config: {
      rateLimit: getRateLimitConfig('export'),
    },
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Export usage data',
      description:
        'Export comprehensive usage data in CSV or JSON format. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      body: ExportQuerySchema,
      response: {
        200: {
          type: 'string',
          description: 'File download (CSV or JSON)',
        },
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        429: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const exportRequest = request.body;
      const format = exportRequest.format || 'csv';

      try {
        // Use date strings directly (no timezone conversion)
        // Dates are in YYYY-MM-DD format and match LiteLLM's local timezone expectations
        const startDate = exportRequest.startDate;
        const endDate = exportRequest.endDate;

        // Use export-specific limit (365 days)
        const validation = validateDateRangeSize(
          startDate,
          endDate,
          config.dateRangeLimits.maxExportDays,
        );

        if (!validation.valid) {
          const suggestedRanges = suggestDateRanges(
            startDate,
            endDate,
            config.dateRangeLimits.maxExportDays,
          );

          return reply.code(400).send({
            error: validation.error,
            code: validation.code,
            details: {
              requestedDays: validation.days,
              maxAllowedDays: config.dateRangeLimits.maxExportDays,
              suggestion: `Maximum export range is ${config.dateRangeLimits.maxExportDays} days. Consider breaking into ${suggestedRanges.length} exports.`,
              suggestedRanges: suggestedRanges.slice(0, 4),
            },
          });
        }

        // Create filters object with string dates for the service
        const filters: AdminUsageFilters = {
          startDate,
          endDate,
          userIds: exportRequest.userIds,
          modelIds: exportRequest.modelIds,
          providerIds: exportRequest.providerIds,
          apiKeyIds: exportRequest.apiKeyIds,
        };

        fastify.log.info(
          {
            adminUser: authRequest.user?.userId,
            format,
            dateRange: { start: exportRequest.startDate, end: exportRequest.endDate },
            rangeInDays: validation.days,
            action: 'export_usage_data',
          },
          'Admin requested usage data export',
        );

        const exportData = await adminUsageStatsService.exportUsageData(filters, format);

        // Set appropriate headers for file download
        const filename = `admin-usage-export-${exportRequest.startDate}-to-${exportRequest.endDate}.${format}`;
        reply.header('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);

        return reply.code(200).send(exportData);
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
            exportRequest,
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
    config: {
      rateLimit: getRateLimitConfig('analytics'),
    },
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
        429: AdminUsageErrorResponseSchema,
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
    config: {
      rateLimit: getRateLimitConfig('analytics'),
    },
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
        429: AdminUsageErrorResponseSchema,
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
    config: {
      rateLimit: getRateLimitConfig('cacheRebuild'),
    },
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
        429: AdminUsageErrorResponseSchema,
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

  /**
   * GET /api/v1/admin/usage/cache/metrics
   * Get cache performance metrics
   *
   * This endpoint returns current cache performance metrics including:
   * - Cache hit/miss counts
   * - Cache rebuilds
   * - Lock acquisition success/failure counts
   * - Grace period applications
   * - Calculated hit rate and lock contention rate
   *
   * Useful for monitoring cache performance and detecting issues.
   *
   * @requires admin or adminReadonly role
   */
  fastify.get('/cache/metrics', {
    config: {
      rateLimit: getRateLimitConfig('analytics'),
    },
    schema: {
      tags: ['Admin Usage Analytics'],
      summary: 'Get cache performance metrics',
      description:
        'Get cache performance metrics including hit rate, lock contention, and rebuild statistics. Requires admin or adminReadonly role.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            cacheHits: { type: 'number', description: 'Number of cache hits' },
            cacheMisses: { type: 'number', description: 'Number of cache misses' },
            cacheRebuilds: { type: 'number', description: 'Number of cache rebuilds performed' },
            lockAcquisitionSuccesses: {
              type: 'number',
              description: 'Number of successful lock acquisitions',
            },
            lockAcquisitionFailures: {
              type: 'number',
              description: 'Number of failed lock acquisitions (lock contention)',
            },
            gracePeriodApplications: {
              type: 'number',
              description: 'Number of times grace period logic was applied',
            },
            cacheHitRate: {
              type: 'number',
              description: 'Cache hit rate (hits / total requests)',
            },
            lockContentionRate: {
              type: 'number',
              description: 'Lock contention rate (failures / total attempts)',
            },
          },
        },
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        429: AdminUsageErrorResponseSchema,
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
            action: 'get_cache_metrics',
          },
          'Admin requested cache performance metrics',
        );

        const metrics = cacheManager.getMetrics();

        return reply.code(200).send(metrics);
      } catch (error) {
        fastify.log.error(
          {
            error,
            adminUser: authRequest.user?.userId,
          },
          'Failed to get cache metrics',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving cache metrics',
          code: 'CACHE_METRICS_FAILED',
        });
      }
    },
  });
};

export default adminUsageRoutes;

import { FastifyPluginAsync } from 'fastify';
import { AuthenticatedRequest } from '../types';
import { AdminUsageStatsService } from '../services/admin-usage-stats.service';
import { DailyUsageCacheManager } from '../services/daily-usage-cache-manager';
import { LiteLLMService } from '../services/litellm.service';
import { SettingsService } from '../services/settings.service';
import { AnalyticsResponseSchema, AdminUsageErrorResponseSchema } from '../schemas/admin-usage';
import { Type } from '@sinclair/typebox';
import type { AdminUsageFilters } from '../types/admin-usage.types';
import { validateDateRangeSize, suggestDateRanges } from '../utils/date-validation';

const usageRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize admin services for user analytics endpoint
  const liteLLMService = new LiteLLMService(fastify);
  const cacheManager = new DailyUsageCacheManager(fastify);
  const adminUsageStatsService = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);
  const settingsService = new SettingsService(fastify);

  // Get admin analytics configuration
  const config = fastify.getAdminAnalyticsConfig();

  // Get current user's budget info
  fastify.get('/budget', {
    schema: {
      tags: ['Usage'],
      description: 'Get current user budget consumption',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            maxBudget: { type: 'number', nullable: true },
            currentSpend: { type: 'number' },
            budgetDuration: { type: 'string', nullable: true },
            budgetResetAt: { type: 'string', nullable: true },
          },
        },
      },
    },
    preHandler: [fastify.authenticate],
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;

      // Get user budget info from DB
      const dbUser = await fastify.dbUtils.queryOne(
        `SELECT max_budget, budget_duration FROM users WHERE id = $1`,
        [user.userId],
      );

      // Get current spend and reset date from LiteLLM
      let currentSpend = 0;
      let budgetResetAt: string | undefined;
      try {
        const liteLLMUser = await liteLLMService.getUserInfoFull(user.userId);
        if (liteLLMUser?.user_info) {
          currentSpend = liteLLMUser.user_info.spend ?? 0;
          budgetResetAt = liteLLMUser.user_info.budget_reset_at ?? undefined;
        }
      } catch (err) {
        fastify.log.warn(
          { userId: user.userId, error: err instanceof Error ? err.message : err },
          'Failed to fetch user spend from LiteLLM for budget endpoint',
        );
      }

      return {
        maxBudget: dbUser?.max_budget != null ? Number(dbUser.max_budget) : undefined,
        currentSpend,
        budgetDuration: dbUser?.budget_duration ?? undefined,
        budgetResetAt,
      };
    },
  });

  /**
   * POST /api/v1/usage/analytics
   * Get comprehensive usage analytics for the current user
   *
   * This endpoint provides the same analytics depth as the admin endpoint,
   * but automatically scoped to the authenticated user's data.
   */
  const UserAnalyticsFiltersSchema = Type.Object({
    startDate: Type.String({
      format: 'date',
      description: 'Start date for filtering (ISO 8601 format: YYYY-MM-DD)',
    }),
    endDate: Type.String({
      format: 'date',
      description: 'End date for filtering (ISO 8601 format: YYYY-MM-DD)',
    }),
    modelIds: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Optional array of model IDs to filter by',
      }),
    ),
    providerIds: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Optional array of provider IDs to filter by',
      }),
    ),
    apiKeyIds: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Optional array of API key aliases (litellm_key_alias) to filter by',
      }),
    ),
  });

  fastify.post<{
    Body: {
      startDate: string;
      endDate: string;
      modelIds?: string[];
      providerIds?: string[];
      apiKeyIds?: string[];
    };
  }>('/analytics', {
    schema: {
      tags: ['Usage'],
      summary: 'Get comprehensive usage analytics',
      description:
        'Get comprehensive usage analytics for the authenticated user. Returns the same detailed metrics as admin endpoint, scoped to current user.',
      security: [{ bearerAuth: [] }],
      body: UserAnalyticsFiltersSchema,
      response: {
        200: AnalyticsResponseSchema,
        400: AdminUsageErrorResponseSchema,
        401: AdminUsageErrorResponseSchema,
        403: AdminUsageErrorResponseSchema,
        500: AdminUsageErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const userId = authRequest.user?.userId;
      const queryFilters = request.body;

      if (!userId) {
        return reply.code(401).send({
          error: 'User ID not found in authentication context',
          code: 'UNAUTHORIZED',
        });
      }

      let filters: AdminUsageFilters | undefined;

      try {
        // Use date strings directly (no timezone conversion)
        const startDate = queryFilters.startDate;
        const endDate = queryFilters.endDate;

        // Simple string comparison is valid for YYYY-MM-DD format
        if (startDate > endDate) {
          return reply.code(400).send({
            error: 'Start date must be before or equal to end date',
            code: 'INVALID_DATE_RANGE',
          });
        }

        // Validate that provided API key IDs belong to the user
        if (queryFilters.apiKeyIds && queryFilters.apiKeyIds.length > 0) {
          // Query user's API keys from database
          const userApiKeysResult = await fastify.dbUtils.query<{ litellm_key_alias: string }>(
            `SELECT litellm_key_alias FROM api_keys WHERE user_id = $1 AND is_active = true`,
            [userId],
          );

          const userApiKeyAliases = new Set(
            userApiKeysResult.rows.map((row) => row.litellm_key_alias),
          );

          // Check if all provided API key IDs belong to the user
          const invalidApiKeys = queryFilters.apiKeyIds.filter(
            (keyId) => !userApiKeyAliases.has(keyId),
          );

          if (invalidApiKeys.length > 0) {
            fastify.log.warn(
              {
                userId,
                requestedApiKeys: queryFilters.apiKeyIds,
                invalidApiKeys,
              },
              'User attempted to query API keys they do not own',
            );

            return reply.code(403).send({
              error: 'Access denied: Some API keys do not belong to you',
              code: 'FORBIDDEN_API_KEYS',
              details: { invalidApiKeys },
            });
          }
        }

        // Create filters object with automatic user scoping
        filters = {
          startDate,
          endDate,
          userIds: [userId], // Automatically scope to current user
          modelIds: queryFilters.modelIds,
          providerIds: queryFilters.providerIds,
          apiKeyIds: queryFilters.apiKeyIds,
        };

        fastify.log.info(
          {
            userId,
            username: authRequest.user?.username,
            filters: queryFilters,
            action: 'get_user_analytics',
          },
          'User requested usage analytics',
        );

        // Use the same analytics service as admin endpoint
        const result = await adminUsageStatsService.getAnalytics(filters);

        // Serialize dates for response
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

        const serializedResult = serializeDates(result);
        return reply.code(200).send(serializedResult);
      } catch (error) {
        fastify.log.error(
          {
            error,
            userId,
            filters: filters || queryFilters,
          },
          'Failed to get user usage analytics',
        );

        return reply.code(500).send({
          error: 'Internal server error while retrieving usage analytics',
          code: 'USER_ANALYTICS_FAILED',
        });
      }
    },
  });

  // Get user usage dashboard
  fastify.get('/dashboard', {
    schema: {
      tags: ['Usage'],
      description: 'Get user usage dashboard data',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          timeRange: { type: 'string', enum: ['day', 'week', 'month'], default: 'month' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            summary: {
              type: 'object',
              properties: {
                currentPeriod: { type: 'object' },
                previousPeriod: { type: 'object' },
                percentChange: { type: 'object' },
                quotaUtilization: { type: 'object' },
              },
            },
            topStats: {
              type: 'object',
              properties: {
                topModels: { type: 'array' },
                recentActivity: { type: 'array' },
              },
            },
          },
        },
      },
    },
    preHandler: fastify.authenticate,
    handler: async (_request, _reply) => {
      // TODO: This endpoint should fetch from LiteLLM API
      // For now, returning empty data since local logging is not implemented
      return {
        summary: {
          currentPeriod: {
            totalRequests: 0,
            totalTokens: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalCost: 0,
            averageLatency: 0,
            errorRate: 0,
            successRate: 0,
          },
          previousPeriod: {
            totalRequests: 0,
            totalTokens: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalCost: 0,
            averageLatency: 0,
            errorRate: 0,
            successRate: 0,
          },
          percentChange: {
            requests: 0,
            tokens: 0,
          },
          quotaUtilization: {
            requests: 0,
            tokens: 0,
          },
        },
        topStats: {
          topModels: [],
          recentActivity: [],
        },
      };
    },
  });

  // Get top statistics
  fastify.get('/top', {
    schema: {
      tags: ['Usage'],
      description: 'Get top usage statistics',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          timeRange: { type: 'string', enum: ['day', 'week', 'month'], default: 'month' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            topModels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  modelId: { type: 'string' },
                  modelName: { type: 'string' },
                  totalRequests: { type: 'number' },
                  totalTokens: { type: 'number' },
                },
              },
            },
            recentActivity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  modelId: { type: 'string' },
                  requestTokens: { type: 'number' },
                  responseTokens: { type: 'number' },
                  statusCode: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: fastify.authenticate,
    handler: async (_request, _reply) => {
      // TODO: This endpoint should fetch from LiteLLM API
      // For now, returning empty data since local logging is not implemented
      return {
        topModels: [],
        recentActivity: [],
      };
    },
  });

  /**
   * POST /api/v1/usage/export
   * Export user's usage data
   *
   * Uses the same analytics pipeline as admin export, automatically scoped
   * to the authenticated user. Supports the same filter model as POST /analytics.
   */
  const UserExportSchema = Type.Object({
    startDate: Type.String({
      format: 'date',
      description: 'Start date for export (ISO 8601 format: YYYY-MM-DD)',
    }),
    endDate: Type.String({
      format: 'date',
      description: 'End date for export (ISO 8601 format: YYYY-MM-DD)',
    }),
    format: Type.Optional(
      Type.Union([Type.Literal('csv'), Type.Literal('json')], {
        default: 'csv',
        description: 'Export format (csv or json)',
      }),
    ),
    modelIds: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Optional array of model IDs to filter by',
      }),
    ),
    providerIds: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Optional array of provider IDs to filter by',
      }),
    ),
    apiKeyIds: Type.Optional(
      Type.Array(Type.String(), {
        description: 'Optional array of API key aliases (litellm_key_alias) to filter by',
      }),
    ),
  });

  fastify.post<{
    Body: {
      startDate: string;
      endDate: string;
      format?: 'csv' | 'json';
      modelIds?: string[];
      providerIds?: string[];
      apiKeyIds?: string[];
    };
  }>('/export', {
    schema: {
      tags: ['Usage'],
      summary: 'Export usage data',
      description:
        'Export usage data for the authenticated user in CSV or JSON format. Uses the same analytics pipeline as the admin export, scoped to the current user.',
      security: [{ bearerAuth: [] }],
      body: UserExportSchema,
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
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const userId = authRequest.user?.userId;
      const exportRequest = request.body;
      const format = exportRequest.format || 'csv';

      if (!userId) {
        return reply.code(401).send({
          error: 'User ID not found in authentication context',
          code: 'UNAUTHORIZED',
        });
      }

      try {
        const startDate = exportRequest.startDate;
        const endDate = exportRequest.endDate;

        // Validate date order
        if (startDate > endDate) {
          return reply.code(400).send({
            error: 'Start date must be before or equal to end date',
            code: 'INVALID_DATE_RANGE',
          });
        }

        // Validate date range size (max 365 days, same as admin export)
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

        // Validate API key ownership (same pattern as POST /analytics)
        if (exportRequest.apiKeyIds && exportRequest.apiKeyIds.length > 0) {
          const userApiKeysResult = await fastify.dbUtils.query<{ litellm_key_alias: string }>(
            `SELECT litellm_key_alias FROM api_keys WHERE user_id = $1 AND is_active = true`,
            [userId],
          );

          const userApiKeyAliases = new Set(
            userApiKeysResult.rows.map((row) => row.litellm_key_alias),
          );

          const invalidApiKeys = exportRequest.apiKeyIds.filter(
            (keyId) => !userApiKeyAliases.has(keyId),
          );

          if (invalidApiKeys.length > 0) {
            fastify.log.warn(
              {
                userId,
                requestedApiKeys: exportRequest.apiKeyIds,
                invalidApiKeys,
              },
              'User attempted to export with API keys they do not own',
            );

            return reply.code(403).send({
              error: 'Access denied: Some API keys do not belong to you',
              code: 'FORBIDDEN_API_KEYS',
              details: { invalidApiKeys },
            });
          }
        }

        // Build filters with automatic user scoping
        const filters: AdminUsageFilters = {
          startDate,
          endDate,
          userIds: [userId],
          modelIds: exportRequest.modelIds,
          providerIds: exportRequest.providerIds,
          apiKeyIds: exportRequest.apiKeyIds,
        };

        fastify.log.info(
          {
            userId,
            username: authRequest.user?.username,
            format,
            dateRange: { start: startDate, end: endDate },
            action: 'export_usage_data',
          },
          'User requested usage data export',
        );

        const currencySettings = await settingsService.getCurrencySettings();
        const exportData = await adminUsageStatsService.exportDailyUsageData(
          filters,
          format,
          currencySettings.code,
        );

        const filename = `usage-export-${startDate}-to-${endDate}.${format}`;
        reply.header('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);

        return reply.code(200).send(exportData);
      } catch (error) {
        fastify.log.error(
          {
            error,
            userId,
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

  // Cleanup old usage data (admin only)
  fastify.post('/admin/cleanup', {
    schema: {
      tags: ['Usage'],
      description: 'Cleanup old usage data (admin only)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          retentionDays: { type: 'number', minimum: 1, maximum: 365, default: 90 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            deletedCount: { type: 'number' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { retentionDays = 90 } = request.body as { retentionDays?: number };

      try {
        // TODO: No local usage logs to clean up since we use LiteLLM API
        const deletedCount = 0;

        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
           VALUES ($1, $2, $3, $4)`,
          [
            user.userId,
            'USAGE_DATA_CLEANUP',
            'USAGE_LOG',
            JSON.stringify({ retentionDays, deletedCount }),
          ],
        );

        return {
          message: 'Old usage data cleaned up successfully',
          deletedCount,
        };
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to cleanup old usage data');
        throw fastify.createError(500, 'Failed to cleanup old usage data');
      }
    },
  });
};

export default usageRoutes;

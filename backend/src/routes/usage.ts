import { FastifyPluginAsync } from 'fastify';
import {
  UsageStatistics,
  UsageTimeSeries,
  UsageSummaryParams,
  UsageTimeSeriesParams,
  UsageExportParams,
  AuthenticatedRequest,
} from '../types';
import { UsageStatsService } from '../services/usage-stats.service';
import { AdminUsageStatsService } from '../services/admin-usage-stats.service';
import { DailyUsageCacheManager } from '../services/daily-usage-cache-manager';
import { LiteLLMService } from '../services/litellm.service';
import {
  validateUsageMetricsQuery,
  validateUsageSummaryQuery,
  validateUsageExportQuery,
} from '../validators/usage.validator';
import { AnalyticsResponseSchema, AdminUsageErrorResponseSchema } from '../schemas/admin-usage';
import { Type } from '@sinclair/typebox';
import type { AdminUsageFilters } from '../types/admin-usage.types';

const usageRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize usage stats service
  const usageStatsService = new UsageStatsService(fastify);

  // Initialize admin services for user analytics endpoint
  const liteLLMService = new LiteLLMService(fastify);
  const cacheManager = new DailyUsageCacheManager(fastify);
  const adminUsageStatsService = new AdminUsageStatsService(fastify, liteLLMService, cacheManager);

  // Get usage metrics (for frontend)
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      modelId?: string;
      apiKeyId?: string;
    };
    Reply: {
      totalRequests: number;
      totalTokens: number;
      totalCost: number;
      averageResponseTime: number;
      successRate: number;
      activeModels: number;
      topModels: Array<{
        name: string;
        requests: number;
        tokens: number;
        cost: number;
      }>;
      dailyUsage: Array<{
        date: string;
        requests: number;
        tokens: number;
        cost: number;
      }>;
    };
  }>('/metrics', {
    schema: {
      tags: ['Usage'],
      description: 'Get usage metrics for frontend',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          modelId: { type: 'string' },
          apiKeyId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: [fastify.authenticateWithDevBypass, validateUsageMetricsQuery],
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { startDate, endDate, modelId, apiKeyId } = request.query;

      fastify.log.info(
        {
          userId: user.userId,
          apiKeyId,
          startDate,
          endDate,
        },
        'Usage metrics request received',
      );

      try {
        // Get both model breakdown and time series data
        const [statsWithModels, statsWithTime] = await Promise.all([
          usageStatsService.getUsageStats({
            userId: user.userId,
            modelId,
            apiKeyId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            aggregateBy: 'model',
          }),
          usageStatsService.getUsageStats({
            userId: user.userId,
            modelId,
            apiKeyId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            aggregateBy: 'time',
            granularity: 'day',
          }),
        ]);

        // Combine the results
        const stats = {
          ...statsWithModels,
          timeSeriesData: statsWithTime.timeSeriesData,
        };

        // Transform backend response to frontend format using real LiteLLM data
        const response = {
          totalRequests: stats.totalMetrics.totalRequests,
          totalTokens: stats.totalMetrics.totalTokens,
          totalCost: stats.totalMetrics.totalCost || 0, // Use actual cost from LiteLLM
          averageResponseTime: stats.totalMetrics.averageLatency,
          successRate: stats.totalMetrics.successRate,
          activeModels: stats.modelBreakdown?.length || 0,
          topModels:
            stats.modelBreakdown?.map((model) => ({
              name: model.modelName || model.modelId,
              requests: model.totalRequests,
              tokens: model.totalTokens,
              cost: model.totalCost || 0, // Use actual model cost
            })) || [],
          dailyUsage:
            stats.timeSeriesData?.map((period) => ({
              date: period.period,
              requests: period.totalRequests,
              tokens: period.totalTokens,
              cost: period.totalCost || 0, // Use actual daily cost
            })) || [],
        };

        fastify.log.info(
          {
            totalRequests: response.totalRequests,
            totalTokens: response.totalTokens,
            modelCount: response.topModels.length,
            dailyUsageCount: response.dailyUsage.length,
            timeSeriesDataCount: stats.timeSeriesData?.length || 0,
          },
          'Returning usage metrics response',
        );

        return response;
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to get usage metrics');
        throw fastify.createError(500, 'Failed to get usage metrics');
      }
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

  // Get usage summary
  fastify.get<{
    Querystring: UsageSummaryParams;
    Reply: UsageStatistics;
  }>('/summary', {
    schema: {
      tags: ['Usage'],
      description: 'Get usage summary',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          modelId: { type: 'string' },
          subscriptionId: { type: 'string' },
          granularity: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
        },
        required: ['startDate', 'endDate'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            period: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' },
              },
            },
            totals: {
              type: 'object',
              properties: {
                requests: { type: 'number' },
                tokens: { type: 'number' },
                promptTokens: { type: 'number' },
                completionTokens: { type: 'number' },
                averageLatency: { type: 'number' },
                errorRate: { type: 'number' },
                successRate: { type: 'number' },
              },
            },
            byModel: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  modelId: { type: 'string' },
                  modelName: { type: 'string' },
                  provider: { type: 'string' },
                  totalRequests: { type: 'number' },
                  totalTokens: { type: 'number' },
                  totalPromptTokens: { type: 'number' },
                  totalCompletionTokens: { type: 'number' },
                  averageLatency: { type: 'number' },
                  errorRate: { type: 'number' },
                  successRate: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [fastify.authenticateWithDevBypass, validateUsageSummaryQuery],
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { startDate, endDate, modelId, subscriptionId, granularity } = request.query;

      try {
        const stats = await usageStatsService.getUsageStats({
          userId: user.userId,
          modelId,
          subscriptionId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          granularity,
          aggregateBy: 'model',
        });

        return {
          period: {
            start: new Date(startDate),
            end: new Date(endDate),
          },
          totals: {
            requests: stats.totalMetrics.totalRequests,
            tokens: stats.totalMetrics.totalTokens,
            cost: stats.totalMetrics.totalCost || 0,
            promptTokens: stats.totalMetrics.totalPromptTokens,
            completionTokens: stats.totalMetrics.totalCompletionTokens,
            averageLatency: stats.totalMetrics.averageLatency,
            errorRate: stats.totalMetrics.errorRate,
            successRate: stats.totalMetrics.successRate,
          },
          byModel: (stats.modelBreakdown || []).map((model) => ({
            modelId: model.modelId,
            modelName: model.modelName || model.modelId,
            requests: model.totalRequests,
            tokens: model.totalTokens,
            cost: model.totalCost || 0,
          })),
        };
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to get usage summary');
        throw fastify.createError(500, 'Failed to get usage summary');
      }
    },
  });

  // Get usage time series
  fastify.get<{
    Querystring: UsageTimeSeriesParams;
    Reply: UsageTimeSeries;
  }>('/timeseries', {
    schema: {
      tags: ['Usage'],
      description: 'Get usage time series',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          interval: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
          modelId: { type: 'string' },
          subscriptionId: { type: 'string' },
        },
        required: ['startDate', 'endDate'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            interval: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string' },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                  totalRequests: { type: 'number' },
                  totalTokens: { type: 'number' },
                  totalPromptTokens: { type: 'number' },
                  totalCompletionTokens: { type: 'number' },
                  averageLatency: { type: 'number' },
                  errorRate: { type: 'number' },
                  successRate: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { startDate, endDate, interval = 'day', modelId, subscriptionId } = request.query;

      try {
        const stats = await usageStatsService.getUsageStats({
          userId: user.userId,
          modelId,
          subscriptionId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          granularity: interval,
          aggregateBy: 'time',
        });

        return {
          interval,
          data: (stats.timeSeriesData || []).map((period) => ({
            timestamp: period.startTime,
            requests: period.totalRequests,
            tokens: period.totalTokens,
            cost: period.totalCost || 0,
            period: period.period,
            startTime: period.startTime,
            endTime: period.endTime,
            totalRequests: period.totalRequests,
            totalTokens: period.totalTokens,
            totalPromptTokens: period.totalPromptTokens,
            totalCompletionTokens: period.totalCompletionTokens,
            averageLatency: period.averageLatency,
            errorRate: period.errorRate,
            successRate: period.successRate,
          })),
        };
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to get usage time series');
        throw fastify.createError(500, 'Failed to get usage time series');
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
    preHandler: fastify.authenticateWithDevBypass,
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
    preHandler: fastify.authenticateWithDevBypass,
    handler: async (_request, _reply) => {
      // TODO: This endpoint should fetch from LiteLLM API
      // For now, returning empty data since local logging is not implemented
      return {
        topModels: [],
        recentActivity: [],
      };
    },
  });

  // Export usage data
  fastify.get<{
    Querystring: UsageExportParams & { apiKeyId?: string };
  }>('/export', {
    schema: {
      tags: ['Usage'],
      description: 'Export usage data',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          format: { type: 'string', enum: ['csv', 'json'], default: 'csv' },
          modelId: { type: 'string' },
          subscriptionId: { type: 'string' },
          apiKeyId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'string',
          description: 'File download',
        },
      },
    },
    preHandler: [fastify.authenticateWithDevBypass, validateUsageExportQuery],
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const {
        startDate,
        endDate,
        format = 'csv',
        modelId,
        subscriptionId,
        apiKeyId,
      } = request.query;

      try {
        // Get usage data
        const stats = await usageStatsService.getUsageStats({
          userId: user.userId,
          modelId,
          subscriptionId,
          apiKeyId,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          granularity: 'day',
          aggregateBy: 'time',
        });

        const filename = `usage-export-${startDate}-${endDate}.${format}`;

        reply.header('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        reply.header('Content-Disposition', `attachment; filename=${filename}`);

        if (format === 'csv') {
          // Generate CSV
          const csvHeader =
            'Date,Requests,Total Tokens,Prompt Tokens,Completion Tokens,Avg Latency (ms),Error Rate (%),Success Rate (%)';
          const csvRows = (stats.timeSeriesData || []).map((row) =>
            [
              row.startTime.toISOString().split('T')[0],
              row.totalRequests,
              row.totalTokens,
              row.totalPromptTokens,
              row.totalCompletionTokens,
              row.averageLatency,
              row.errorRate,
              row.successRate,
            ].join(','),
          );

          return [csvHeader, ...csvRows].join('\n');
        } else {
          // Generate JSON
          return JSON.stringify(
            {
              exportDate: new Date().toISOString(),
              period: {
                start: startDate,
                end: endDate,
              },
              summary: stats.totalMetrics,
              timeSeries: stats.timeSeriesData,
              modelBreakdown: stats.modelBreakdown,
            },
            null,
            2,
          );
        }
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to export usage data');
        throw fastify.createError(500, 'Failed to export usage data');
      }
    },
  });

  // Admin endpoints

  // Get global usage statistics (admin only)
  fastify.get('/admin/global', {
    schema: {
      tags: ['Usage'],
      description: 'Get global usage statistics (admin only)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          granularity: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
          aggregateBy: { type: 'string', enum: ['model', 'user', 'time'], default: 'model' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalMetrics: { type: 'object' },
            timeSeriesData: { type: 'array' },
            modelBreakdown: { type: 'array' },
            topStats: { type: 'object' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
    handler: async (request, _reply) => {
      const { startDate, endDate, granularity, aggregateBy } = request.query as {
        startDate?: string;
        endDate?: string;
        granularity?: 'hour' | 'day' | 'week' | 'month';
        aggregateBy?: 'model' | 'user' | 'time';
      };

      try {
        const stats = await usageStatsService.getUsageStats({
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          granularity,
          aggregateBy,
        });

        return {
          totalMetrics: stats.totalMetrics,
          timeSeriesData: stats.timeSeriesData,
          modelBreakdown: stats.modelBreakdown,
          topStats: {
            topModels: [],
            topUsers: [],
            recentActivity: [],
          },
        };
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to get global usage statistics');
        throw fastify.createError(500, 'Failed to get global usage statistics');
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

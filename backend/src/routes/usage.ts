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
import {
  validateUsageMetricsQuery,
  validateUsageSummaryQuery,
  validateUsageExportQuery,
} from '../validators/usage.validator';

const usageRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize usage stats service
  const usageStatsService = new UsageStatsService(fastify);

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
                inputTokens: { type: 'number' },
                outputTokens: { type: 'number' },
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
                  totalInputTokens: { type: 'number' },
                  totalOutputTokens: { type: 'number' },
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
            inputTokens: stats.totalMetrics.totalInputTokens,
            outputTokens: stats.totalMetrics.totalOutputTokens,
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
                  totalInputTokens: { type: 'number' },
                  totalOutputTokens: { type: 'number' },
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
            totalInputTokens: period.totalInputTokens,
            totalOutputTokens: period.totalOutputTokens,
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
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { timeRange = 'month' } = request.query as { timeRange?: 'day' | 'week' | 'month' };

      try {
        const [summary, topStats] = await Promise.all([
          usageStatsService.getUserUsageSummary(user.userId, timeRange),
          usageStatsService.getTopStats({ userId: user.userId, timeRange }),
        ]);

        return {
          summary,
          topStats: {
            topModels: topStats.topModels,
            recentActivity: topStats.recentActivity,
          },
        };
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to get usage dashboard');
        throw fastify.createError(500, 'Failed to get usage dashboard');
      }
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
    handler: async (request, _reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { timeRange = 'month', limit = 10 } = request.query as {
        timeRange?: 'day' | 'week' | 'month';
        limit?: number;
      };

      try {
        const topStats = await usageStatsService.getTopStats({
          userId: user.userId,
          timeRange,
          limit,
        });

        return {
          topModels: topStats.topModels,
          recentActivity: topStats.recentActivity,
        };
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to get top statistics');
        throw fastify.createError(500, 'Failed to get top statistics');
      }
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
            'Date,Requests,Total Tokens,Input Tokens,Output Tokens,Avg Latency (ms),Error Rate (%),Success Rate (%)';
          const csvRows = (stats.timeSeriesData || []).map((row) =>
            [
              row.startTime.toISOString().split('T')[0],
              row.totalRequests,
              row.totalTokens,
              row.totalInputTokens,
              row.totalOutputTokens,
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

  // Real-time usage tracking endpoint (for API key usage)
  fastify.post('/track', {
    schema: {
      tags: ['Usage'],
      description: 'Track real-time usage (internal)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' },
          modelId: { type: 'string' },
          requestTokens: { type: 'number', minimum: 0 },
          responseTokens: { type: 'number', minimum: 0 },
          latencyMs: { type: 'number', minimum: 0 },
          statusCode: { type: 'number' },
        },
        required: ['subscriptionId', 'modelId', 'requestTokens', 'responseTokens', 'statusCode'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            tracked: { type: 'boolean' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('usage:write')],
    handler: async (request, _reply) => {
      const {
        subscriptionId,
        modelId,
        requestTokens,
        responseTokens,
        latencyMs = 0,
        statusCode,
      } = request.body as {
        subscriptionId: string;
        modelId: string;
        requestTokens: number;
        responseTokens: number;
        latencyMs?: number;
        statusCode: number;
      };

      try {
        await usageStatsService.recordUsage({
          subscriptionId,
          modelId,
          requestTokens,
          responseTokens,
          latencyMs,
          statusCode,
          timestamp: new Date(),
        });

        return {
          message: 'Usage tracked successfully',
          tracked: true,
        };
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to track usage');
        throw fastify.createError(500, 'Failed to track usage');
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
        const [stats, topStats] = await Promise.all([
          usageStatsService.getUsageStats({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            granularity,
            aggregateBy,
          }),
          usageStatsService.getTopStats({ timeRange: 'month' }),
        ]);

        return {
          totalMetrics: stats.totalMetrics,
          timeSeriesData: stats.timeSeriesData,
          modelBreakdown: stats.modelBreakdown,
          topStats,
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
        const deletedCount = await usageStatsService.cleanupOldData(retentionDays);

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

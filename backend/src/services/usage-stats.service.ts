import { FastifyInstance } from 'fastify';
import { QueryParameter } from '../types/common.types.js';
import { LiteLLMService } from './litellm.service.js';
import { BaseService } from './base.service.js';

export interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  successRate: number;
}

export interface TimePeriodMetrics extends UsageMetrics {
  period: string;
  startTime: Date;
  endTime: Date;
}

export interface ModelUsageStats extends UsageMetrics {
  modelId: string;
  modelName?: string;
  provider?: string;
}

export interface UsageStatsQuery {
  userId?: string;
  subscriptionId?: string;
  modelId?: string;
  apiKeyId?: string;
  startDate?: Date;
  endDate?: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  aggregateBy?: 'model' | 'subscription' | 'user' | 'time';
}

export interface UsageStatsResponse {
  totalMetrics: UsageMetrics;
  timeSeriesData?: TimePeriodMetrics[];
  modelBreakdown?: ModelUsageStats[];
  subscriptionBreakdown?: any[];
  userBreakdown?: any[];
}

export interface RealTimeUsageUpdate {
  subscriptionId: string;
  modelId: string;
  requestTokens: number;
  responseTokens: number;
  latencyMs: number;
  statusCode: number;
  timestamp: Date;
}

export interface TopStats {
  topModels: Array<{
    modelId: string;
    modelName?: string;
    totalRequests: number;
    totalTokens: number;
  }>;
  topUsers: Array<{
    userId: string;
    username?: string;
    totalRequests: number;
    totalTokens: number;
  }>;
  recentActivity: Array<{
    timestamp: Date;
    modelId: string;
    userId: string;
    requestTokens: number;
    responseTokens: number;
    statusCode: number;
  }>;
}

export class UsageStatsService extends BaseService {
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  // Mock data for development/fallback
  private readonly MOCK_USAGE_METRICS: UsageStatsResponse = {
    totalMetrics: {
      totalRequests: 125847,
      totalTokens: 8456321,
      totalInputTokens: 3245678,
      totalOutputTokens: 5210643,
      totalCost: 127.36,
      averageLatency: 1.2,
      errorRate: 2.3,
      successRate: 97.7,
    },
    timeSeriesData: [
      {
        period: '2024-12-20',
        startTime: new Date('2024-12-20T00:00:00Z'),
        endTime: new Date('2024-12-20T23:59:59Z'),
        totalRequests: 4567,
        totalTokens: 312456,
        totalInputTokens: 145623,
        totalOutputTokens: 166833,
        totalCost: 31.25,
        averageLatency: 1.1,
        errorRate: 1.8,
        successRate: 98.2,
      },
      {
        period: '2024-12-21',
        startTime: new Date('2024-12-21T00:00:00Z'),
        endTime: new Date('2024-12-21T23:59:59Z'),
        totalRequests: 5234,
        totalTokens: 387234,
        totalInputTokens: 178456,
        totalOutputTokens: 208778,
        totalCost: 38.72,
        averageLatency: 1.3,
        errorRate: 2.1,
        successRate: 97.9,
      },
      {
        period: '2024-12-22',
        startTime: new Date('2024-12-22T00:00:00Z'),
        endTime: new Date('2024-12-22T23:59:59Z'),
        totalRequests: 6789,
        totalTokens: 498765,
        totalInputTokens: 234567,
        totalOutputTokens: 264198,
        totalCost: 49.88,
        averageLatency: 1.0,
        errorRate: 3.2,
        successRate: 96.8,
      },
    ],
    modelBreakdown: [
      {
        modelId: 'gpt-4o',
        modelName: 'GPT-4o',
        provider: 'openai',
        totalRequests: 78456,
        totalTokens: 5234567,
        totalInputTokens: 2123456,
        totalOutputTokens: 3111111,
        totalCost: 78.52,
        averageLatency: 1.1,
        errorRate: 1.8,
        successRate: 98.2,
      },
      {
        modelId: 'claude-3-5-sonnet-20241022',
        modelName: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        totalRequests: 34567,
        totalTokens: 2456789,
        totalInputTokens: 987654,
        totalOutputTokens: 1469135,
        totalCost: 36.85,
        averageLatency: 1.4,
        errorRate: 2.1,
        successRate: 97.9,
      },
      {
        modelId: 'llama-3.1-8b-instant',
        modelName: 'Llama 3.1 8B Instant',
        provider: 'groq',
        totalRequests: 12824,
        totalTokens: 764965,
        totalInputTokens: 134568,
        totalOutputTokens: 630397,
        totalCost: 11.47,
        averageLatency: 0.8,
        errorRate: 4.5,
        successRate: 95.5,
      },
    ],
  };

  constructor(fastify: FastifyInstance) {
    super(fastify);
  }

  async getUsageStats(query: UsageStatsQuery): Promise<UsageStatsResponse> {
    const cacheKey = this.generateCacheKey('usage_stats', query);

    // Check cache first
    const cached = this.getFromCache<UsageStatsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const {
        userId,
        subscriptionId,
        modelId,
        apiKeyId,
        startDate,
        endDate,
        granularity = 'day',
        aggregateBy = 'time',
      } = query;

      // If apiKeyId is provided, fetch data from LiteLLM
      if (apiKeyId) {
        this.fastify.log.info({ apiKeyId, userId }, 'Fetching usage data from LiteLLM for API key');
        const liteLLMService = new LiteLLMService(this.fastify);

        try {
          // Get the API key to find the key alias and the user_id (which is same as LiteLLM user_id)
          const apiKeyResult = await this.fastify.dbUtils.queryOne(
            `SELECT ak.name, u.id as user_id 
             FROM api_keys ak 
             JOIN users u ON ak.user_id = u.id 
             WHERE ak.id = $1`,
            [apiKeyId],
          );

          if (!apiKeyResult || !apiKeyResult.name) {
            this.fastify.log.warn({ apiKeyId }, 'API key not found or has no name/alias');
            // Fall through to local database query
          } else {
            const keyAlias = apiKeyResult.name as string;
            const liteLLMUserId = apiKeyResult.user_id as string; // Use user.id directly as LiteLLM user_id

            // Get the actual LiteLLM key for this API key ID
            const liteLLMKeyResult = await this.fastify.dbUtils.queryOne(
              `SELECT lite_llm_key_value FROM api_keys WHERE id = $1`,
              [apiKeyId],
            );

            if (!liteLLMKeyResult || !liteLLMKeyResult.lite_llm_key_value) {
              this.fastify.log.warn({ apiKeyId }, 'Could not find LiteLLM key value for API key');
              // Fall through to local database query
            } else {
              const liteLLMKey = liteLLMKeyResult.lite_llm_key_value as string;

              // Get the internal LiteLLM token for this API key
              const apiKeyToken = await liteLLMService.getApiKeyToken(liteLLMUserId, liteLLMKey);

              if (!apiKeyToken) {
                this.fastify.log.warn(
                  {
                    apiKeyId,
                    userId: liteLLMUserId,
                    keyValue: liteLLMKey.substring(0, 10) + '...',
                  },
                  'Could not find internal token for API key',
                );
                // Fall through to local database query
              } else {
                // Format dates for LiteLLM API
                const formattedStartDate = startDate
                  ? startDate.toISOString().split('T')[0]
                  : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                const formattedEndDate = endDate
                  ? endDate.toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0];

                this.fastify.log.info(
                  { formattedStartDate, formattedEndDate, keyAlias, hasToken: !!apiKeyToken },
                  'Calling LiteLLM getDailyActivity with internal token',
                );

                const liteLLMData = await liteLLMService.getDailyActivity(
                  apiKeyToken,
                  formattedStartDate,
                  formattedEndDate,
                );

                this.fastify.log.info({ liteLLMData }, 'Received data from LiteLLM');

                // Transform LiteLLM data to our format
                const totalMetrics: UsageMetrics = {
                  totalRequests: liteLLMData.api_requests,
                  totalTokens: liteLLMData.total_tokens,
                  totalInputTokens: liteLLMData.prompt_tokens,
                  totalOutputTokens: liteLLMData.completion_tokens,
                  totalCost: liteLLMData.spend || 0, // Use actual spend from LiteLLM
                  averageLatency: 1200, // Default as LiteLLM doesn't provide this
                  errorRate: 0, // Default as LiteLLM doesn't provide this
                  successRate: 100, // Default as LiteLLM doesn't provide this
                };

                // Transform model breakdown
                const modelBreakdown: ModelUsageStats[] = liteLLMData.by_model.map((model) => ({
                  modelId: model.model,
                  modelName: model.model,
                  provider: this.getProviderFromModel(model.model),
                  totalRequests: model.api_requests,
                  totalTokens: model.tokens,
                  totalInputTokens: Math.floor(model.tokens * 0.6), // Estimate
                  totalOutputTokens: Math.floor(model.tokens * 0.4), // Estimate
                  totalCost: model.spend || 0, // Use actual spend from LiteLLM
                  averageLatency: 1200,
                  errorRate: 0,
                  successRate: 100,
                }));

                // Use daily metrics from LiteLLM if available
                let timeSeriesData: TimePeriodMetrics[] = [];
                if (liteLLMData.daily_metrics && liteLLMData.daily_metrics.length > 0) {
                  timeSeriesData = liteLLMData.daily_metrics.map((day) => ({
                    period: day.date,
                    startTime: new Date(day.date),
                    endTime: new Date(new Date(day.date).getTime() + 24 * 60 * 60 * 1000),
                    totalRequests: day.requests,
                    totalTokens: day.tokens,
                    totalInputTokens: Math.floor(day.tokens * 0.6),
                    totalOutputTokens: Math.floor(day.tokens * 0.4),
                    totalCost: day.spend || 0, // Use actual spend from LiteLLM
                    averageLatency: 1200,
                    errorRate: 0,
                    successRate: 100,
                  }));
                } else {
                  // Fallback: Create time series data (basic daily breakdown)
                  const days = Math.ceil(
                    (new Date(formattedEndDate).getTime() -
                      new Date(formattedStartDate).getTime()) /
                      (1000 * 60 * 60 * 24),
                  );
                  const dailyRequests = Math.floor(liteLLMData.api_requests / days);
                  const dailyTokens = Math.floor(liteLLMData.total_tokens / days);

                  for (let i = 0; i < days; i++) {
                    const date = new Date(formattedStartDate);
                    date.setDate(date.getDate() + i);

                    timeSeriesData.push({
                      period: date.toISOString().split('T')[0],
                      startTime: date,
                      endTime: new Date(date.getTime() + 24 * 60 * 60 * 1000),
                      totalRequests: dailyRequests,
                      totalTokens: dailyTokens,
                      totalInputTokens: Math.floor(dailyTokens * 0.6),
                      totalOutputTokens: Math.floor(dailyTokens * 0.4),
                      totalCost: Math.floor(((liteLLMData.spend || 0) / days) * 100) / 100, // Estimate daily cost
                      averageLatency: 1200,
                      errorRate: 0,
                      successRate: 100,
                    });
                  }
                }

                const result: UsageStatsResponse = {
                  totalMetrics,
                  timeSeriesData: aggregateBy === 'time' ? timeSeriesData : undefined,
                  modelBreakdown: aggregateBy === 'model' ? modelBreakdown : undefined,
                };

                // Cache the result
                this.setCache(cacheKey, result);
                return result;
              }
            }
          }
        } catch (liteLLMError) {
          this.fastify.log.warn(
            liteLLMError,
            'Failed to fetch usage from LiteLLM, falling back to local database',
          );
          // Fall through to local database query
        }
      }

      // Build base WHERE clause
      const whereConditions: string[] = ['1=1'];
      const params: QueryParameter[] = [];

      if (userId) {
        whereConditions.push('s.user_id = $' + (params.length + 1));
        params.push(userId);
      }

      if (subscriptionId) {
        whereConditions.push('ul.subscription_id = $' + (params.length + 1));
        params.push(subscriptionId);
      }

      if (modelId) {
        whereConditions.push('ul.model_id = $' + (params.length + 1));
        params.push(modelId);
      }

      if (apiKeyId) {
        whereConditions.push('ul.api_key_id = $' + (params.length + 1));
        params.push(apiKeyId);
      }

      if (startDate) {
        whereConditions.push('ul.created_at >= $' + (params.length + 1));
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push('ul.created_at <= $' + (params.length + 1));
        params.push(endDate);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total metrics
      const totalMetrics = await this.getTotalMetrics(whereClause, params);

      // Get time series data if requested
      let timeSeriesData: TimePeriodMetrics[] | undefined;
      if (aggregateBy === 'time') {
        timeSeriesData = await this.getTimeSeriesData(whereClause, params, granularity);
      }

      // Get model breakdown if requested
      let modelBreakdown: ModelUsageStats[] | undefined;
      if (aggregateBy === 'model') {
        modelBreakdown = await this.getModelBreakdown(whereClause, params);
      }

      const result: UsageStatsResponse = {
        totalMetrics,
        timeSeriesData,
        modelBreakdown,
      };

      // Cache the result
      this.setCache(cacheKey, result);

      return result;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get usage statistics');

      // If database is unavailable, fall back to mock data
      if (this.shouldUseMockData()) {
        this.fastify.log.debug(
          { query },
          'Falling back to mock usage stats data (database unavailable)',
        );

        // Filter and modify mock data based on query parameters
        const response = JSON.parse(JSON.stringify(this.MOCK_USAGE_METRICS));

        // Apply filters to model breakdown if specific modelId is requested
        if (query.modelId) {
          response.modelBreakdown =
            response.modelBreakdown?.filter(
              (model: ModelUsageStats) => model.modelId === query.modelId,
            ) || [];
        }

        // Apply date range filtering to time series data if specified
        if (query.startDate || query.endDate) {
          response.timeSeriesData =
            response.timeSeriesData?.filter((period: TimePeriodMetrics) => {
              const periodDate = new Date(period.period);
              if (query.startDate && periodDate < query.startDate) return false;
              if (query.endDate && periodDate > query.endDate) return false;
              return true;
            }) || [];
        }

        this.setCache(cacheKey, response);
        return this.createMockResponse(response);
      }

      throw error;
    }
  }

  async recordUsage(usage: RealTimeUsageUpdate): Promise<void> {
    try {
      // Insert into usage_logs (which will trigger the update_usage_summary function)
      await this.fastify.dbUtils.query(
        `INSERT INTO usage_logs (
          subscription_id, model_id, request_tokens, response_tokens,
          latency_ms, status_code, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          usage.subscriptionId,
          usage.modelId,
          usage.requestTokens,
          usage.responseTokens,
          usage.latencyMs,
          usage.statusCode,
          JSON.stringify({}),
          usage.timestamp,
        ],
      );

      // Invalidate relevant caches
      this.invalidateCache(usage.subscriptionId);

      this.fastify.log.debug(
        {
          subscriptionId: usage.subscriptionId,
          modelId: usage.modelId,
          totalTokens: usage.requestTokens + usage.responseTokens,
        },
        'Usage recorded',
      );
    } catch (error) {
      this.fastify.log.error(error, 'Failed to record usage');
      throw error;
    }
  }

  async getTopStats(
    options: {
      userId?: string;
      limit?: number;
      timeRange?: 'day' | 'week' | 'month';
    } = {},
  ): Promise<TopStats> {
    const { userId, limit = 10, timeRange = 'month' } = options;
    const cacheKey = `top_stats:${JSON.stringify({ userId, limit, timeRange })}`;

    const cached = this.getFromCache<TopStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const timeCondition = this.getTimeCondition(timeRange);
      const userCondition = userId ? ` AND s.user_id = $1` : '';
      const params = userId ? [userId] : [];

      // Top models
      const topModelsQuery = `
        SELECT 
          ul.model_id,
          m.name as model_name,
          COUNT(*) as total_requests,
          SUM(ul.total_tokens) as total_tokens
        FROM usage_logs ul
        LEFT JOIN models m ON ul.model_id = m.id
        JOIN subscriptions s ON ul.subscription_id = s.id
        WHERE ${timeCondition}${userCondition}
        GROUP BY ul.model_id, m.name
        ORDER BY total_requests DESC
        LIMIT ${limit}
      `;

      // Top users (only for admin/global view)
      const topUsersQuery = userId
        ? null
        : `
        SELECT 
          s.user_id,
          u.username,
          COUNT(*) as total_requests,
          SUM(ul.total_tokens) as total_tokens
        FROM usage_logs ul
        JOIN subscriptions s ON ul.subscription_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE ${timeCondition}
        GROUP BY s.user_id, u.username
        ORDER BY total_requests DESC
        LIMIT ${limit}
      `;

      // Recent activity
      const recentActivityQuery = `
        SELECT 
          ul.created_at as timestamp,
          ul.model_id,
          s.user_id,
          ul.request_tokens,
          ul.response_tokens,
          ul.status_code
        FROM usage_logs ul
        JOIN subscriptions s ON ul.subscription_id = s.id
        WHERE ${timeCondition}${userCondition}
        ORDER BY ul.created_at DESC
        LIMIT ${limit}
      `;

      const [topModels, topUsers, recentActivity] = await Promise.all([
        this.fastify.dbUtils.queryMany(topModelsQuery, params),
        topUsersQuery ? this.fastify.dbUtils.queryMany(topUsersQuery, []) : [],
        this.fastify.dbUtils.queryMany(recentActivityQuery, params),
      ]);

      const result: TopStats = {
        topModels: topModels.map((row) => ({
          modelId: String(row.model_id),
          modelName: row.model_name as string,
          totalRequests: parseInt(String(row.total_requests)),
          totalTokens: parseInt(String(row.total_tokens)) || 0,
        })),
        topUsers: (topUsers || []).map((row) => ({
          userId: String(row.user_id),
          username: row.username as string,
          totalRequests: parseInt(String(row.total_requests)),
          totalTokens: parseInt(String(row.total_tokens)) || 0,
        })),
        recentActivity: recentActivity.map((row) => ({
          timestamp: new Date(row.timestamp as string),
          modelId: String(row.model_id),
          userId: String(row.user_id),
          requestTokens: Number(row.request_tokens),
          responseTokens: Number(row.response_tokens),
          statusCode: Number(row.status_code),
        })),
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get top statistics');
      throw error;
    }
  }

  async getUserUsageSummary(
    userId: string,
    timeRange: 'day' | 'week' | 'month' = 'month',
  ): Promise<{
    currentPeriod: UsageMetrics;
    previousPeriod: UsageMetrics;
    percentChange: {
      requests: number;
      tokens: number;
    };
    quotaUtilization: {
      requests: number;
      tokens: number;
    };
  }> {
    try {
      const timeCondition = this.getTimeCondition(timeRange);
      const previousTimeCondition = this.getPreviousTimeCondition(timeRange);

      // Current period metrics
      const currentMetrics = await this.getTotalMetrics(`${timeCondition} AND s.user_id = $1`, [
        userId,
      ]);

      // Previous period metrics
      const previousMetrics = await this.getTotalMetrics(
        `${previousTimeCondition} AND s.user_id = $1`,
        [userId],
      );

      // Calculate percentage changes
      const requestsChange =
        previousMetrics.totalRequests > 0
          ? ((currentMetrics.totalRequests - previousMetrics.totalRequests) /
              previousMetrics.totalRequests) *
            100
          : 0;

      const tokensChange =
        previousMetrics.totalTokens > 0
          ? ((currentMetrics.totalTokens - previousMetrics.totalTokens) /
              previousMetrics.totalTokens) *
            100
          : 0;

      // Get quota utilization
      const quotaStats = await this.fastify.dbUtils.queryOne(
        `
        SELECT 
          SUM(quota_requests) as total_quota_requests,
          SUM(quota_tokens) as total_quota_tokens,
          SUM(used_requests) as total_used_requests,
          SUM(used_tokens) as total_used_tokens
        FROM subscriptions
        WHERE user_id = $1 AND status = 'active'
      `,
        [userId],
      );

      const quotaUtilization = {
        requests:
          quotaStats && Number(quotaStats.total_quota_requests) > 0
            ? (Number(quotaStats.total_used_requests) / Number(quotaStats.total_quota_requests)) *
              100
            : 0,
        tokens:
          quotaStats && Number(quotaStats.total_quota_tokens) > 0
            ? (Number(quotaStats.total_used_tokens) / Number(quotaStats.total_quota_tokens)) * 100
            : 0,
      };

      return {
        currentPeriod: currentMetrics,
        previousPeriod: previousMetrics,
        percentChange: {
          requests: Math.round(requestsChange * 100) / 100,
          tokens: Math.round(tokensChange * 100) / 100,
        },
        quotaUtilization,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user usage summary');
      throw error;
    }
  }

  async cleanupOldData(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.fastify.dbUtils.query(
        'DELETE FROM usage_logs WHERE created_at < $1',
        [cutoffDate],
      );

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        this.fastify.log.info(
          {
            deletedCount,
            retentionDays,
            cutoffDate,
          },
          'Cleaned up old usage data',
        );
      }

      return deletedCount;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to cleanup old usage data');
      return 0;
    }
  }

  private async getTotalMetrics(
    whereClause: string,
    params: QueryParameter[],
  ): Promise<UsageMetrics> {
    const query = `
      SELECT 
        COUNT(*) as total_requests,
        COALESCE(SUM(ul.total_tokens), 0) as total_tokens,
        COALESCE(SUM(ul.request_tokens), 0) as total_input_tokens,
        COALESCE(SUM(ul.response_tokens), 0) as total_output_tokens,
        COALESCE(AVG(ul.latency_ms), 0) as average_latency,
        COALESCE(SUM(CASE WHEN ul.status_code >= 400 THEN 1 ELSE 0 END), 0) as error_count
      FROM usage_logs ul
      JOIN subscriptions s ON ul.subscription_id = s.id
      WHERE ${whereClause}
    `;

    const result = await this.fastify.dbUtils.queryOne(
      query,
      params.filter((p): p is Exclude<QueryParameter, undefined> => p !== undefined),
    );

    if (!result) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        errorRate: 0,
        successRate: 0,
      };
    }

    const totalRequests = parseInt(String(result.total_requests)) || 0;
    const errorCount = parseInt(String(result.error_count)) || 0;

    return {
      totalRequests,
      totalTokens: parseInt(String(result.total_tokens)) || 0,
      totalInputTokens: parseInt(String(result.total_input_tokens)) || 0,
      totalOutputTokens: parseInt(String(result.total_output_tokens)) || 0,
      totalCost: 0, // Database doesn't have cost data, will be calculated from LiteLLM
      averageLatency: Math.round(parseFloat(String(result.average_latency)) || 0),
      errorRate: totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100 * 100) / 100 : 0,
      successRate:
        totalRequests > 0
          ? Math.round(((totalRequests - errorCount) / totalRequests) * 100 * 100) / 100
          : 0,
    };
  }

  private async getTimeSeriesData(
    whereClause: string,
    params: QueryParameter[],
    granularity: 'hour' | 'day' | 'week' | 'month',
  ): Promise<TimePeriodMetrics[]> {
    const truncFunction = {
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month',
    }[granularity];

    const query = `
      SELECT 
        date_trunc('${truncFunction}', ul.created_at) as period,
        COUNT(*) as total_requests,
        COALESCE(SUM(ul.total_tokens), 0) as total_tokens,
        COALESCE(SUM(ul.request_tokens), 0) as total_input_tokens,
        COALESCE(SUM(ul.response_tokens), 0) as total_output_tokens,
        COALESCE(AVG(ul.latency_ms), 0) as average_latency,
        COALESCE(SUM(CASE WHEN ul.status_code >= 400 THEN 1 ELSE 0 END), 0) as error_count
      FROM usage_logs ul
      JOIN subscriptions s ON ul.subscription_id = s.id
      WHERE ${whereClause}
      GROUP BY period
      ORDER BY period
    `;

    const results = await this.fastify.dbUtils.queryMany(
      query,
      params.filter((p): p is Exclude<QueryParameter, undefined> => p !== undefined),
    );

    return results.map((row) => {
      const totalRequests = parseInt(String(row.total_requests)) || 0;
      const errorCount = parseInt(String(row.error_count)) || 0;
      const periodStart = new Date(String(row.period));
      const periodEnd = new Date(periodStart);

      // Calculate period end based on granularity
      switch (granularity) {
        case 'hour':
          periodEnd.setHours(periodEnd.getHours() + 1);
          break;
        case 'day':
          periodEnd.setDate(periodEnd.getDate() + 1);
          break;
        case 'week':
          periodEnd.setDate(periodEnd.getDate() + 7);
          break;
        case 'month':
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
      }

      return {
        period: String(row.period),
        startTime: periodStart,
        endTime: periodEnd,
        totalRequests,
        totalTokens: parseInt(String(row.total_tokens)) || 0,
        totalInputTokens: parseInt(String(row.total_input_tokens)) || 0,
        totalOutputTokens: parseInt(String(row.total_output_tokens)) || 0,
        totalCost: 0, // Database doesn't have cost data, will be calculated from LiteLLM
        averageLatency: Math.round(parseFloat(String(row.average_latency)) || 0),
        errorRate:
          totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100 * 100) / 100 : 0,
        successRate:
          totalRequests > 0
            ? Math.round(((totalRequests - errorCount) / totalRequests) * 100 * 100) / 100
            : 0,
      };
    });
  }

  private async getModelBreakdown(
    whereClause: string,
    params: QueryParameter[],
  ): Promise<ModelUsageStats[]> {
    const query = `
      SELECT 
        ul.model_id,
        m.name as model_name,
        m.provider,
        COUNT(*) as total_requests,
        COALESCE(SUM(ul.total_tokens), 0) as total_tokens,
        COALESCE(SUM(ul.request_tokens), 0) as total_input_tokens,
        COALESCE(SUM(ul.response_tokens), 0) as total_output_tokens,
        COALESCE(AVG(ul.latency_ms), 0) as average_latency,
        COALESCE(SUM(CASE WHEN ul.status_code >= 400 THEN 1 ELSE 0 END), 0) as error_count
      FROM usage_logs ul
      LEFT JOIN models m ON ul.model_id = m.id
      JOIN subscriptions s ON ul.subscription_id = s.id
      WHERE ${whereClause}
      GROUP BY ul.model_id, m.name, m.provider
      ORDER BY total_requests DESC
    `;

    const results = await this.fastify.dbUtils.queryMany(
      query,
      params.filter((p): p is Exclude<QueryParameter, undefined> => p !== undefined),
    );

    return results.map((row) => {
      const totalRequests = parseInt(String(row.total_requests)) || 0;
      const errorCount = parseInt(String(row.error_count)) || 0;

      return {
        modelId: String(row.model_id),
        modelName: row.model_name as string,
        provider: row.provider as string,
        totalRequests,
        totalTokens: parseInt(String(row.total_tokens)) || 0,
        totalInputTokens: parseInt(String(row.total_input_tokens)) || 0,
        totalOutputTokens: parseInt(String(row.total_output_tokens)) || 0,
        totalCost: 0, // Database doesn't have cost data, will be calculated from LiteLLM
        averageLatency: Math.round(parseFloat(String(row.average_latency)) || 0),
        errorRate:
          totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100 * 100) / 100 : 0,
        successRate:
          totalRequests > 0
            ? Math.round(((totalRequests - errorCount) / totalRequests) * 100 * 100) / 100
            : 0,
      };
    });
  }

  private getTimeCondition(timeRange: 'day' | 'week' | 'month'): string {
    switch (timeRange) {
      case 'day':
        return 'ul.created_at >= CURRENT_DATE';
      case 'week':
        return "ul.created_at >= date_trunc('week', CURRENT_DATE)";
      case 'month':
        return "ul.created_at >= date_trunc('month', CURRENT_DATE)";
      default:
        return "ul.created_at >= date_trunc('month', CURRENT_DATE)";
    }
  }

  private getPreviousTimeCondition(timeRange: 'day' | 'week' | 'month'): string {
    switch (timeRange) {
      case 'day':
        return "ul.created_at >= CURRENT_DATE - INTERVAL '1 day' AND ul.created_at < CURRENT_DATE";
      case 'week':
        return "ul.created_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '1 week' AND ul.created_at < date_trunc('week', CURRENT_DATE)";
      case 'month':
        return "ul.created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' AND ul.created_at < date_trunc('month', CURRENT_DATE)";
      default:
        return "ul.created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' AND ul.created_at < date_trunc('month', CURRENT_DATE)";
    }
  }

  private generateCacheKey(prefix: string, params: UsageStatsQuery): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateCache(subscriptionId?: string): void {
    if (subscriptionId) {
      // Invalidate caches that might contain this subscription's data
      for (const [key] of this.cache) {
        if (key.includes(subscriptionId)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get provider name from model name
   */
  private getProviderFromModel(modelName: string): string {
    if (modelName.includes('gpt') || modelName.includes('openai')) {
      return 'openai';
    }
    if (modelName.includes('claude') || modelName.includes('anthropic')) {
      return 'anthropic';
    }
    if (modelName.includes('llama') || modelName.includes('groq')) {
      return 'groq';
    }
    if (modelName.includes('gemini') || modelName.includes('google')) {
      return 'google';
    }
    if (modelName.includes('mistral')) {
      return 'mistral';
    }
    return 'unknown';
  }
}

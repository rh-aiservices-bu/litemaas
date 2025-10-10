import { FastifyInstance } from 'fastify';
import { QueryParameter } from '../types/common.types.js';
import { LiteLLMService } from './litellm.service.js';
import { BaseService } from './base.service.js';

export interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
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

export class UsageStatsService extends BaseService {
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  // Mock data for development/fallback
  private readonly MOCK_USAGE_METRICS: UsageStatsResponse = {
    totalMetrics: {
      totalRequests: 125847,
      totalTokens: 8456321,
      totalPromptTokens: 3245678,
      totalCompletionTokens: 5210643,
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
        totalPromptTokens: 145623,
        totalCompletionTokens: 166833,
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
        totalPromptTokens: 178456,
        totalCompletionTokens: 208778,
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
        totalPromptTokens: 234567,
        totalCompletionTokens: 264198,
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
        totalPromptTokens: 2123456,
        totalCompletionTokens: 3111111,
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
        totalPromptTokens: 987654,
        totalCompletionTokens: 1469135,
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
        totalPromptTokens: 134568,
        totalCompletionTokens: 630397,
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
        granularity: _granularity = 'day',
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
                  totalPromptTokens: liteLLMData.prompt_tokens,
                  totalCompletionTokens: liteLLMData.completion_tokens,
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
                  totalPromptTokens: Math.floor(model.tokens * 0.6), // Estimate
                  totalCompletionTokens: Math.floor(model.tokens * 0.4), // Estimate
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
                    totalPromptTokens: Math.floor(day.tokens * 0.6),
                    totalCompletionTokens: Math.floor(day.tokens * 0.4),
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
                      totalPromptTokens: Math.floor(dailyTokens * 0.6),
                      totalCompletionTokens: Math.floor(dailyTokens * 0.4),
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

      // TODO: Fetch from LiteLLM API instead of local tables
      // For now, returning empty data since local logging is not implemented
      const totalMetrics: UsageMetrics = {
        totalRequests: 0,
        totalTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        errorRate: 0,
        successRate: 0,
      };

      const timeSeriesData: TimePeriodMetrics[] | undefined =
        aggregateBy === 'time' ? [] : undefined;
      const modelBreakdown: ModelUsageStats[] | undefined =
        aggregateBy === 'model' ? [] : undefined;

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

  // Cache invalidation method - reserved for future use
  // private invalidateCache(subscriptionId?: string): void {
  //   if (subscriptionId) {
  //     // Invalidate caches that might contain this subscription's data
  //     for (const [key] of this.cache) {
  //       if (key.includes(subscriptionId)) {
  //         this.cache.delete(key);
  //       }
  //     }
  //   } else {
  //     // Clear all cache
  //     this.cache.clear();
  //   }
  // }

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

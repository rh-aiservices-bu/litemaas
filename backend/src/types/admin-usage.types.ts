/**
 * Admin Usage Analytics Types
 * Types for comprehensive admin usage statistics and breakdowns
 */

/**
 * Date range filter for usage queries
 */
export interface DateRange {
  startDate: string; // YYYY-MM-DD format in local timezone
  endDate: string; // YYYY-MM-DD format in local timezone
}

/**
 * Filters for admin usage queries
 */
export interface AdminUsageFilters {
  startDate: string; // YYYY-MM-DD format in local timezone
  endDate: string; // YYYY-MM-DD format in local timezone
  userIds?: string[];
  modelIds?: string[];
  providerIds?: string[];
  apiKeyIds?: string[]; // API key aliases (litellm_key_alias) for filtering
}

/**
 * Token breakdown with prompt/completion/total
 */
export interface TokenBreakdown {
  total: number;
  prompt: number;
  completion: number;
}

/**
 * Cost breakdown by various dimensions
 */
export interface CostBreakdown {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byUser: Record<string, number>;
  byDay?: Array<{
    date: string;
    cost: number;
  }>;
  projectedMonthly?: number;
}

/**
 * Trend data for metrics over time
 */
export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  percentageChange: number;
  direction: 'up' | 'down' | 'stable';
}

/**
 * User summary for top users
 */
export interface UserSummary {
  userId: string;
  username: string;
  email: string;
  role: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Model summary for top models
 */
export interface ModelSummary {
  modelId: string;
  modelName: string;
  provider: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * API key summary for top keys
 */
export interface ApiKeySummary {
  keyId: string;
  keyAlias: string;
  userId: string;
  username: string;
  requests: number;
  tokens: number;
  cost: number;
}

/**
 * Daily usage summary for trend charts
 */
export interface DailyUsageSummary {
  date: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Model usage data for a specific day
 */
export interface DailyModelMetrics {
  modelId: string;
  modelName: string;
  provider: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Daily model usage summary for stacked trend charts
 */
export interface DailyModelUsage {
  date: string;
  models: DailyModelMetrics[];
}

/**
 * Analytics data aggregated across all users
 */
export interface Analytics {
  period: DateRange;
  totalUsers: number;
  activeUsers: number;
  totalRequests: number;
  totalTokens: TokenBreakdown;
  totalCost: CostBreakdown;
  successRate: number;
  averageLatency: number;
  topMetrics: {
    topUser: UserSummary | null;
    topModel: ModelSummary | null;
    topApiKey: ApiKeySummary | null;
  };
  trends: {
    requestsTrend: TrendData;
    costTrend: TrendData;
    usersTrend: TrendData;
    totalTokensTrend: TrendData;
    promptTokensTrend: TrendData;
    completionTokensTrend: TrendData;
  };
  dailyUsage?: DailyUsageSummary[];
  dailyModelUsage?: DailyModelUsage[];
  topModels?: ModelSummary[];
  topUsers?: UserSummary[];
}

/**
 * Model usage details
 */
export interface ModelUsage {
  modelId: string;
  modelName: string;
  provider: string;
  requests: number;
  tokens: TokenBreakdown;
  cost: number;
  successRate: number;
  averageLatency: number;
}

/**
 * API key usage details
 */
export interface ApiKeyUsage {
  keyId: string;
  keyAlias: string;
  requests: number;
  tokens: TokenBreakdown;
  cost: number;
  lastUsed: Date;
}

/**
 * Per-user usage breakdown
 */
export interface UserBreakdown {
  userId: string;
  username: string;
  email: string;
  role: string;
  metrics: {
    requests: number;
    tokens: TokenBreakdown;
    cost: number;
    models: ModelUsage[];
    apiKeys: ApiKeyUsage[];
    lastActive: Date | null;
  };
}

/**
 * Model pricing information
 */
export interface ModelPricing {
  promptCostPerToken: number;
  completionCostPerToken: number;
  currency: string;
}

/**
 * Per-model usage breakdown
 */
export interface ModelBreakdown {
  modelId: string;
  modelName: string;
  provider: string;
  metrics: {
    requests: number;
    tokens: TokenBreakdown;
    cost: number;
    users: number;
    successRate: number;
  };
  pricing: ModelPricing;
  topUsers: UserSummary[];
}

/**
 * Per-provider usage breakdown
 */
export interface ProviderBreakdown {
  provider: string;
  metrics: {
    requests: number;
    tokens: TokenBreakdown;
    cost: number;
    models: number;
    users: number;
    successRate: number;
    averageLatency: number;
  };
  topModels: ModelSummary[];
}

/**
 * Raw LiteLLM daily activity response structure
 */
export interface LiteLLMDayData {
  date: string;
  metrics: {
    api_requests: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    spend: number;
    successful_requests: number;
    failed_requests: number;
  };
  breakdown: {
    models: Record<
      string,
      {
        metrics: {
          api_requests: number;
          total_tokens: number;
          prompt_tokens: number;
          completion_tokens: number;
          spend: number;
        };
        api_keys: Record<
          string,
          {
            metadata?: {
              key_alias?: string;
            };
            metrics: {
              api_requests: number;
              total_tokens: number;
              prompt_tokens: number;
              completion_tokens: number;
              spend: number;
              successful_requests?: number;
              failed_requests?: number;
            };
          }
        >;
      }
    >;
    api_keys: Record<
      string,
      {
        key_alias?: string;
        metrics: {
          api_requests: number;
          total_tokens: number;
          prompt_tokens: number;
          completion_tokens: number;
          spend: number;
        };
      }
    >;
    providers: Record<
      string,
      {
        metrics: {
          api_requests: number;
          total_tokens: number;
          prompt_tokens: number;
          completion_tokens: number;
          spend: number;
        };
      }
    >;
  };
}

/**
 * User mapping from API key
 */
export interface ApiKeyUserMapping {
  tokenHash: string;
  userId: string;
  username: string;
  email: string;
  role: string;
  keyAlias: string;
  keyName: string; // Display name from database
}

/**
 * Note: This EnrichedDayData structure differs from the cache manager's version.
 * The cache manager returns a simpler structure which admin-usage-stats transforms
 * into this more detailed format for analysis purposes.
 */
export interface EnrichedDayData {
  date: string;
  metrics: {
    api_requests: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    spend: number;
    successful_requests: number;
    failed_requests: number;
  };
  breakdown: {
    models: Record<
      string,
      {
        metrics: {
          api_requests: number;
          total_tokens: number;
          prompt_tokens: number;
          completion_tokens: number;
          spend: number;
          successful_requests: number;
          failed_requests: number;
        };
        users: Record<
          string,
          {
            userId: string;
            username: string;
            email: string;
            metrics: {
              api_requests: number;
              total_tokens: number;
              prompt_tokens: number;
              completion_tokens: number;
              spend: number;
              successful_requests: number;
              failed_requests: number;
            };
          }
        >;
      }
    >;
    providers: Record<
      string,
      {
        metrics: {
          api_requests: number;
          total_tokens: number;
          prompt_tokens: number;
          completion_tokens: number;
          spend: number;
        };
      }
    >;
    users: Record<
      string,
      {
        userId: string;
        username: string;
        email: string;
        role: string;
        metrics: {
          api_requests: number;
          total_tokens: number;
          prompt_tokens: number;
          completion_tokens: number;
          spend: number;
          successful_requests: number;
          failed_requests: number;
        };
        models: Record<
          string,
          {
            modelName: string;
            metrics: {
              api_requests: number;
              total_tokens: number;
              prompt_tokens: number;
              completion_tokens: number;
              spend: number;
              successful_requests: number;
              failed_requests: number;
            };
            api_keys?: Record<
              string,
              {
                keyAlias: string;
                keyName: string;
                metrics: {
                  api_requests: number;
                  total_tokens: number;
                  prompt_tokens: number;
                  completion_tokens: number;
                  spend: number;
                  successful_requests: number;
                  failed_requests: number;
                };
              }
            >;
          }
        >;
      }
    >;
  };
  rawData: any; // Original LiteLLM response
}

/**
 * Aggregated usage data across multiple days
 */
export interface AggregatedUsageData {
  period: DateRange;
  totalMetrics: {
    api_requests: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    spend: number;
    successful_requests: number;
    failed_requests: number;
    success_rate: number;
  };
  byUser: Record<string, any>;
  byModel: Record<string, any>;
  byProvider: Record<string, any>;
}

/**
 * Interface for DailyUsageCacheManager (to be implemented by Agent 1)
 * This defines the contract that AdminUsageStatsService expects
 */
export interface IDailyUsageCacheManager {
  /**
   * Get cached daily data from database
   * @param date The date to retrieve (YYYY-MM-DD string in local timezone)
   * @returns Cached data or null if not found or stale
   */
  getCachedDailyData(date: string): Promise<EnrichedDayData | null>;

  /**
   * Save daily data to cache
   * @param date The date being cached (YYYY-MM-DD string in local timezone)
   * @param data The enriched usage data
   * @param isCurrentDay Whether this is today's data (gets shorter TTL)
   */
  saveToDailyCache(date: string, data: EnrichedDayData, isCurrentDay: boolean): Promise<void>;

  /**
   * Get aggregated data for a date range
   * @param startDate Range start date (YYYY-MM-DD string in local timezone)
   * @param endDate Range end date (YYYY-MM-DD string in local timezone)
   * @returns Aggregated data from cache
   */
  getDateRangeData(startDate: string, endDate: string): Promise<AggregatedUsageData | null>;

  /**
   * Invalidate current day cache to force refresh
   */
  invalidateTodayCache(): Promise<void>;

  /**
   * Clean up old cache data
   * @param retentionDays Number of days to retain
   * @returns Number of records deleted
   */
  cleanupOldCache(retentionDays?: number): Promise<number>;
}

/**
 * Pagination parameters for list endpoints
 *
 * @property page - Page number (1-indexed, default: 1)
 * @property limit - Items per page (default: 50, max: 200)
 * @property sortBy - Field to sort by
 * @property sortOrder - Sort direction
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page: number;

  /** Items per page (max: 200) */
  limit: number;

  /** Field to sort by (e.g., 'totalTokens', 'totalRequests') */
  sortBy: string;

  /** Sort direction */
  sortOrder: 'asc' | 'desc';
}

/**
 * Pagination metadata for paginated responses
 *
 * Provides information about the current page, total pages,
 * and navigation capabilities.
 */
export interface PaginationMetadata {
  /** Current page number (1-indexed) */
  page: number;

  /** Items per page */
  limit: number;

  /** Total number of items across all pages */
  total: number;

  /** Total number of pages */
  totalPages: number;

  /** Whether there is a next page */
  hasNext: boolean;

  /** Whether there is a previous page */
  hasPrevious: boolean;
}

/**
 * Generic paginated response wrapper
 *
 * Wraps any data array with pagination metadata.
 *
 * @template T - Type of data items
 */
export interface PaginatedResponse<T> {
  /** Data items for current page */
  data: T[];

  /** Pagination metadata */
  pagination: PaginationMetadata;
}

/**
 * Pagination defaults and limits
 */
export const PAGINATION_DEFAULTS = {
  /** Default page number */
  PAGE: 1,

  /** Default items per page */
  LIMIT: 50,

  /** Maximum items per page (prevent excessive resource usage) */
  MAX_LIMIT: 200,

  /** Default sort order */
  SORT_ORDER: 'desc' as const,
} as const;

/**
 * Valid sort fields for user breakdown
 */
export const USER_BREAKDOWN_SORT_FIELDS = [
  'username',
  'totalRequests',
  'totalTokens',
  'promptTokens',
  'completionTokens',
  'totalCost',
] as const;

export type UserBreakdownSortField = (typeof USER_BREAKDOWN_SORT_FIELDS)[number];

/**
 * Valid sort fields for model breakdown
 */
export const MODEL_BREAKDOWN_SORT_FIELDS = [
  'modelName',
  'totalRequests',
  'totalTokens',
  'promptTokens',
  'completionTokens',
  'totalCost',
] as const;

export type ModelBreakdownSortField = (typeof MODEL_BREAKDOWN_SORT_FIELDS)[number];

/**
 * Valid sort fields for provider breakdown
 */
export const PROVIDER_BREAKDOWN_SORT_FIELDS = [
  'providerName',
  'totalRequests',
  'totalTokens',
  'promptTokens',
  'completionTokens',
  'totalCost',
] as const;

export type ProviderBreakdownSortField = (typeof PROVIDER_BREAKDOWN_SORT_FIELDS)[number];

import { Type, Static } from '@sinclair/typebox';

// Query parameter schemas for admin usage endpoints

// Pagination query schema for breakdown endpoints
export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(
    Type.Integer({
      minimum: 1,
      default: 1,
      description: 'Page number (1-indexed)',
    }),
  ),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 200,
      default: 50,
      description: 'Items per page (max: 200)',
    }),
  ),
  sortBy: Type.Optional(
    Type.String({
      default: 'totalTokens',
      description: 'Field to sort by',
    }),
  ),
  sortOrder: Type.Optional(
    Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
      default: 'desc',
      description: 'Sort direction',
    }),
  ),
});

// Pagination metadata schema for paginated responses
export const PaginationMetadataSchema = Type.Object({
  page: Type.Integer({ description: 'Current page number (1-indexed)' }),
  limit: Type.Integer({ description: 'Items per page' }),
  total: Type.Integer({ description: 'Total number of items across all pages' }),
  totalPages: Type.Integer({ description: 'Total number of pages' }),
  hasNext: Type.Boolean({ description: 'Whether there is a next page' }),
  hasPrevious: Type.Boolean({ description: 'Whether there is a previous page' }),
});

export const AdminUsageFiltersSchema = Type.Object({
  startDate: Type.String({
    format: 'date',
    description: 'Start date for filtering (ISO 8601 format: YYYY-MM-DD)',
  }),
  endDate: Type.String({
    format: 'date',
    description: 'End date for filtering (ISO 8601 format: YYYY-MM-DD)',
  }),
  userIds: Type.Optional(
    Type.Array(Type.String({ format: 'uuid' }), {
      description: 'Optional array of user IDs to filter by',
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

// Combined schema for breakdown endpoints with pagination
export const AdminUsageFiltersWithPaginationSchema = Type.Intersect([
  AdminUsageFiltersSchema,
  PaginationQuerySchema,
]);

export const ExportQuerySchema = Type.Object({
  startDate: Type.String({
    format: 'date',
    description: 'Start date for export',
  }),
  endDate: Type.String({
    format: 'date',
    description: 'End date for export',
  }),
  format: Type.Optional(
    Type.Union([Type.Literal('csv'), Type.Literal('json')], {
      default: 'csv',
      description: 'Export format (csv or json)',
    }),
  ),
  userIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  modelIds: Type.Optional(Type.Array(Type.String())),
  providerIds: Type.Optional(Type.Array(Type.String())),
  apiKeyIds: Type.Optional(Type.Array(Type.String())),
});

// Response schemas

export const TokenBreakdownSchema = Type.Object({
  total: Type.Number({ description: 'Total tokens' }),
  prompt: Type.Number({ description: 'Prompt tokens' }),
  completion: Type.Number({ description: 'Completion tokens' }),
});

export const CostBreakdownSchema = Type.Object({
  total: Type.Number({ description: 'Total cost in dollars' }),
  byProvider: Type.Record(Type.String(), Type.Number(), {
    description: 'Cost breakdown by provider',
  }),
  byModel: Type.Record(Type.String(), Type.Number(), {
    description: 'Cost breakdown by model',
  }),
  byUser: Type.Optional(
    Type.Record(Type.String(), Type.Number(), {
      description: 'Cost breakdown by user',
    }),
  ),
});

export const TrendDataSchema = Type.Object({
  metric: Type.String({ description: 'Metric name (e.g., requests, cost, users)' }),
  current: Type.Number({ description: 'Current period value' }),
  previous: Type.Number({ description: 'Previous period value' }),
  percentageChange: Type.Number({ description: 'Percentage change from previous to current' }),
  direction: Type.Union([Type.Literal('up'), Type.Literal('down'), Type.Literal('stable')], {
    description: 'Trend direction',
  }),
});

const UserSummarySchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  username: Type.String(),
  email: Type.String(),
  role: Type.String(),
  requests: Type.Number(),
  tokens: Type.Number(),
  prompt_tokens: Type.Number(),
  completion_tokens: Type.Number(),
  cost: Type.Number(),
});

const ModelSummarySchema = Type.Object({
  modelId: Type.String(),
  modelName: Type.String(),
  provider: Type.String(),
  requests: Type.Number(),
  tokens: Type.Number(),
  prompt_tokens: Type.Number(),
  completion_tokens: Type.Number(),
  cost: Type.Number(),
});

const ApiKeySummarySchema = Type.Object({
  keyId: Type.String(),
  keyAlias: Type.String(),
  userId: Type.String({ format: 'uuid' }),
  username: Type.String(),
  requests: Type.Number(),
  tokens: Type.Number(),
  cost: Type.Number(),
});

const DailyUsageSummarySchema = Type.Object({
  date: Type.String({ description: 'Date in YYYY-MM-DD format' }),
  requests: Type.Integer({ minimum: 0 }),
  tokens: Type.Integer({ minimum: 0 }),
  prompt_tokens: Type.Integer({ minimum: 0 }),
  completion_tokens: Type.Integer({ minimum: 0 }),
  cost: Type.Number({ minimum: 0 }),
});

const DailyModelMetricsSchema = Type.Object({
  modelId: Type.String({ description: 'Model identifier' }),
  modelName: Type.String({ description: 'Model name' }),
  provider: Type.String({ description: 'Provider name' }),
  requests: Type.Integer({
    minimum: 0,
    description: 'Number of requests for this model on this day',
  }),
  tokens: Type.Integer({ minimum: 0, description: 'Total tokens for this model on this day' }),
  prompt_tokens: Type.Integer({
    minimum: 0,
    description: 'Prompt tokens for this model on this day',
  }),
  completion_tokens: Type.Integer({
    minimum: 0,
    description: 'Completion tokens for this model on this day',
  }),
  cost: Type.Number({ minimum: 0, description: 'Total cost for this model on this day' }),
});

const DailyModelUsageSchema = Type.Object({
  date: Type.String({ description: 'Date in YYYY-MM-DD format' }),
  models: Type.Array(DailyModelMetricsSchema, {
    description: 'Model-specific metrics for this day',
  }),
});

export const AnalyticsResponseSchema = Type.Object({
  period: Type.Object({
    startDate: Type.String({ format: 'date-time' }),
    endDate: Type.String({ format: 'date-time' }),
  }),
  totalUsers: Type.Integer({ minimum: 0, description: 'Total number of users' }),
  activeUsers: Type.Integer({ minimum: 0, description: 'Number of active users' }),
  totalRequests: Type.Integer({ minimum: 0, description: 'Total API requests' }),
  totalTokens: TokenBreakdownSchema,
  totalCost: CostBreakdownSchema,
  successRate: Type.Number({ minimum: 0, maximum: 100, description: 'Success rate percentage' }),
  averageLatency: Type.Number({ minimum: 0, description: 'Average latency in milliseconds' }),
  topMetrics: Type.Object({
    topUser: Type.Union([UserSummarySchema, Type.Null()]),
    topModel: Type.Union([ModelSummarySchema, Type.Null()]),
    topApiKey: Type.Union([ApiKeySummarySchema, Type.Null()]),
  }),
  trends: Type.Object({
    requestsTrend: TrendDataSchema,
    costTrend: TrendDataSchema,
    usersTrend: TrendDataSchema,
    totalTokensTrend: TrendDataSchema,
    promptTokensTrend: TrendDataSchema,
    completionTokensTrend: TrendDataSchema,
  }),
  dailyUsage: Type.Optional(
    Type.Array(DailyUsageSummarySchema, {
      description: 'Daily usage summary for trend charts',
    }),
  ),
  dailyModelUsage: Type.Optional(
    Type.Array(DailyModelUsageSchema, {
      description: 'Daily model usage summary for stacked trend charts',
    }),
  ),
  topModels: Type.Optional(
    Type.Array(ModelSummarySchema, {
      description: 'Top models by usage',
    }),
  ),
  topUsers: Type.Optional(
    Type.Array(UserSummarySchema, {
      description: 'Top users by usage',
    }),
  ),
});

const ModelUsageSchema = Type.Object({
  modelId: Type.String(),
  modelName: Type.String(),
  provider: Type.String(),
  requests: Type.Number(),
  tokens: TokenBreakdownSchema,
  cost: Type.Number(),
  successRate: Type.Number(),
});

const ApiKeyUsageSchema = Type.Object({
  keyId: Type.String(),
  keyAlias: Type.String(),
  requests: Type.Number(),
  tokens: TokenBreakdownSchema,
  cost: Type.Number(),
  lastUsed: Type.String({ format: 'date-time' }),
});

export const UserBreakdownItemSchema = Type.Object({
  userId: Type.String({ format: 'uuid' }),
  username: Type.String(),
  email: Type.String(),
  role: Type.String(),
  metrics: Type.Object({
    requests: Type.Integer({ minimum: 0 }),
    tokens: TokenBreakdownSchema,
    cost: Type.Number({ minimum: 0 }),
    models: Type.Array(ModelUsageSchema),
    apiKeys: Type.Array(ApiKeyUsageSchema),
    lastActive: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  }),
});

// Paginated response schema for user breakdown
export const PaginatedUserBreakdownResponseSchema = Type.Object({
  data: Type.Array(UserBreakdownItemSchema, {
    description: 'User breakdown data for current page',
  }),
  pagination: PaginationMetadataSchema,
});

// Legacy non-paginated response (deprecated - use paginated version)
export const UserBreakdownResponseSchema = PaginatedUserBreakdownResponseSchema;

export const ModelBreakdownItemSchema = Type.Object({
  modelId: Type.String(),
  modelName: Type.String(),
  provider: Type.String(),
  metrics: Type.Object({
    requests: Type.Integer({ minimum: 0 }),
    tokens: TokenBreakdownSchema,
    cost: Type.Number({ minimum: 0 }),
    users: Type.Integer({ minimum: 0, description: 'Number of unique users' }),
    successRate: Type.Number({ minimum: 0, maximum: 100 }),
  }),
});

// Paginated response schema for model breakdown
export const PaginatedModelBreakdownResponseSchema = Type.Object({
  data: Type.Array(ModelBreakdownItemSchema, {
    description: 'Model breakdown data for current page',
  }),
  pagination: PaginationMetadataSchema,
});

// Legacy non-paginated response (deprecated - use paginated version)
export const ModelBreakdownResponseSchema = PaginatedModelBreakdownResponseSchema;

export const ProviderBreakdownItemSchema = Type.Object({
  provider: Type.String(),
  metrics: Type.Object({
    requests: Type.Integer({ minimum: 0 }),
    tokens: TokenBreakdownSchema,
    cost: Type.Number({ minimum: 0 }),
    models: Type.Integer({ minimum: 0, description: 'Number of models' }),
    users: Type.Integer({ minimum: 0, description: 'Number of unique users' }),
    successRate: Type.Number({ minimum: 0, maximum: 100 }),
  }),
});

// Paginated response schema for provider breakdown
export const PaginatedProviderBreakdownResponseSchema = Type.Object({
  data: Type.Array(ProviderBreakdownItemSchema, {
    description: 'Provider breakdown data for current page',
  }),
  pagination: PaginationMetadataSchema,
});

// Legacy non-paginated response (deprecated - use paginated version)
export const ProviderBreakdownResponseSchema = PaginatedProviderBreakdownResponseSchema;

export const RefreshTodayResponseSchema = Type.Object({
  message: Type.String(),
  refreshedAt: Type.String({ format: 'date-time' }),
  status: Type.String(),
});

export const RebuildCacheRequestSchema = Type.Object({
  startDate: Type.Optional(
    Type.String({
      format: 'date',
      description: 'Start date for rebuilding cache (ISO 8601 format: YYYY-MM-DD, optional)',
    }),
  ),
  endDate: Type.Optional(
    Type.String({
      format: 'date',
      description: 'End date for rebuilding cache (ISO 8601 format: YYYY-MM-DD, optional)',
    }),
  ),
});

export const RebuildCacheResponseSchema = Type.Object({
  message: Type.String(),
  rebuiltCount: Type.Number(),
  totalEntries: Type.Number(),
  status: Type.String(),
});

export const FilterOptionsQuerySchema = Type.Object({
  startDate: Type.String({
    format: 'date',
    description: 'Start date for filtering (ISO 8601 format: YYYY-MM-DD)',
  }),
  endDate: Type.String({
    format: 'date',
    description: 'End date for filtering (ISO 8601 format: YYYY-MM-DD)',
  }),
});

export const FilterOptionsResponseSchema = Type.Object({
  models: Type.Array(
    Type.Object({
      id: Type.String({ description: 'Model identifier' }),
      name: Type.String({ description: 'Model name' }),
      provider: Type.String({ description: 'Provider name (e.g., openai, anthropic)' }),
    }),
    { description: 'Models with usage data in the specified date range' },
  ),
  users: Type.Array(
    Type.Object({
      userId: Type.String({ format: 'uuid', description: 'User unique identifier' }),
      username: Type.String({ description: 'Username' }),
      email: Type.String({ description: 'User email address' }),
    }),
    { description: 'Users with usage data in the specified date range' },
  ),
});

export const AdminUsageErrorResponseSchema = Type.Object({
  error: Type.String({ description: 'Error message' }),
  code: Type.Optional(Type.String({ description: 'Error code' })),
  details: Type.Optional(Type.Object({}, { additionalProperties: true })),
});

// Type exports
export type AdminUsageFilters = Static<typeof AdminUsageFiltersSchema>;
export type ExportQuery = Static<typeof ExportQuerySchema>;
export type AnalyticsResponse = Static<typeof AnalyticsResponseSchema>;
export type UserBreakdownResponse = Static<typeof UserBreakdownResponseSchema>;
export type ModelBreakdownResponse = Static<typeof ModelBreakdownResponseSchema>;
export type ProviderBreakdownResponse = Static<typeof ProviderBreakdownResponseSchema>;
export type RefreshTodayResponse = Static<typeof RefreshTodayResponseSchema>;
export type AdminUsageErrorResponse = Static<typeof AdminUsageErrorResponseSchema>;
export type FilterOptionsQuery = Static<typeof FilterOptionsQuerySchema>;
export type FilterOptionsResponse = Static<typeof FilterOptionsResponseSchema>;

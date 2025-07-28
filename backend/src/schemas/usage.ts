import { Type } from '@sinclair/typebox';
import { TimestampSchema, DateQuerySchema } from './common';

export const TimeIntervalEnum = Type.Union([
  Type.Literal('hour'),
  Type.Literal('day'),
  Type.Literal('week'),
  Type.Literal('month'),
]);

export const UsageLogSchema = Type.Object({
  id: Type.String(),
  subscriptionId: Type.String(),
  apiKeyId: Type.Optional(Type.String()),
  modelId: Type.String(),
  requestTokens: Type.Integer({ minimum: 0 }),
  responseTokens: Type.Integer({ minimum: 0 }),
  totalTokens: Type.Integer({ minimum: 0 }),
  latencyMs: Type.Optional(Type.Integer({ minimum: 0 })),
  statusCode: Type.Integer(),
  errorMessage: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  createdAt: TimestampSchema,
});

export const CreateUsageLogSchema = Type.Object({
  subscriptionId: Type.String(),
  apiKeyId: Type.Optional(Type.String()),
  modelId: Type.String(),
  requestTokens: Type.Integer({ minimum: 0 }),
  responseTokens: Type.Integer({ minimum: 0 }),
  latencyMs: Type.Optional(Type.Integer({ minimum: 0 })),
  statusCode: Type.Integer(),
  errorMessage: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

export const UsageSummarySchema = Type.Object({
  id: Type.String(),
  subscriptionId: Type.String(),
  modelId: Type.String(),
  periodType: Type.Union([Type.Literal('hour'), Type.Literal('day'), Type.Literal('month')]),
  periodStart: TimestampSchema,
  requestCount: Type.Integer({ minimum: 0 }),
  totalTokens: Type.Integer({ minimum: 0 }),
  errorCount: Type.Integer({ minimum: 0 }),
  avgLatencyMs: Type.Optional(Type.Integer({ minimum: 0 })),
  createdAt: TimestampSchema,
});

export const UsageStatisticsSchema = Type.Object({
  period: Type.Object({
    start: TimestampSchema,
    end: TimestampSchema,
  }),
  totals: Type.Object({
    requests: Type.Integer({ minimum: 0 }),
    tokens: Type.Integer({ minimum: 0 }),
    cost: Type.Number({ minimum: 0 }),
  }),
  byModel: Type.Array(
    Type.Object({
      modelId: Type.String(),
      modelName: Type.String(),
      requests: Type.Integer({ minimum: 0 }),
      tokens: Type.Integer({ minimum: 0 }),
      cost: Type.Number({ minimum: 0 }),
    }),
  ),
});

export const UsageTimeSeriesPointSchema = Type.Object({
  timestamp: TimestampSchema,
  requests: Type.Integer({ minimum: 0 }),
  tokens: Type.Integer({ minimum: 0 }),
  cost: Type.Number({ minimum: 0 }),
});

export const UsageTimeSeriesSchema = Type.Object({
  interval: TimeIntervalEnum,
  data: Type.Array(UsageTimeSeriesPointSchema),
});

export const UsageSummaryQuerySchema = Type.Composite([
  DateQuerySchema,
  Type.Object({
    modelId: Type.Optional(Type.String()),
  }),
]);

export const UsageTimeSeriesQuerySchema = Type.Composite([
  DateQuerySchema,
  Type.Object({
    interval: Type.Optional(Type.Union([TimeIntervalEnum, Type.String({ default: 'day' })])),
    modelId: Type.Optional(Type.String()),
  }),
]);

export const UsageExportQuerySchema = Type.Composite([
  DateQuerySchema,
  Type.Object({
    format: Type.Optional(
      Type.Union([Type.Literal('csv'), Type.Literal('json')], { default: 'csv' }),
    ),
    modelId: Type.Optional(Type.String()),
  }),
]);

export const UsageMetricsSchema = Type.Object({
  totalRequests: Type.Integer({ minimum: 0 }),
  totalTokens: Type.Integer({ minimum: 0 }),
  totalCost: Type.Number({ minimum: 0 }),
  avgLatency: Type.Number({ minimum: 0 }),
  errorRate: Type.Number({ minimum: 0, maximum: 1 }),
  topModels: Type.Array(
    Type.Object({
      modelId: Type.String(),
      modelName: Type.String(),
      usage: Type.Integer({ minimum: 0 }),
      percentage: Type.Number({ minimum: 0, maximum: 100 }),
    }),
  ),
});

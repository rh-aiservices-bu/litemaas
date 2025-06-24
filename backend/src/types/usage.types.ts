import { TimeInterval, TimePeriod } from './common.types';

export interface UsageLog {
  id: string;
  subscriptionId: string;
  apiKeyId?: string;
  modelId: string;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  latencyMs?: number;
  statusCode: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CreateUsageLogDto {
  subscriptionId: string;
  apiKeyId?: string;
  modelId: string;
  requestTokens: number;
  responseTokens: number;
  latencyMs?: number;
  statusCode: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface UsageSummary {
  id: string;
  subscriptionId: string;
  modelId: string;
  periodType: 'hour' | 'day' | 'month';
  periodStart: Date;
  requestCount: number;
  totalTokens: number;
  errorCount: number;
  avgLatencyMs?: number;
  createdAt: Date;
}

export interface UsageStatistics {
  period: TimePeriod;
  totals: {
    requests: number;
    tokens: number;
    cost: number;
  };
  byModel: Array<{
    modelId: string;
    modelName: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

export interface UsageTimeSeriesPoint {
  timestamp: Date;
  requests: number;
  tokens: number;
  cost: number;
}

export interface UsageTimeSeries {
  interval: TimeInterval;
  data: UsageTimeSeriesPoint[];
}

export interface UsageSummaryParams {
  startDate: Date;
  endDate: Date;
  modelId?: string;
}

export interface UsageTimeSeriesParams {
  startDate: Date;
  endDate: Date;
  interval: TimeInterval;
  modelId?: string;
}

export interface UsageExportParams {
  startDate: Date;
  endDate: Date;
  format: 'csv' | 'json';
  modelId?: string;
}

export interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  errorRate: number;
  topModels: Array<{
    modelId: string;
    modelName: string;
    usage: number;
    percentage: number;
  }>;
}
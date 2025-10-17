// backend/src/config/admin-analytics.config.ts

/**
 * Admin Analytics Configuration Module
 *
 * Centralizes all business logic constants for admin analytics feature.
 * Values can be configured via environment variables with sensible defaults.
 *
 * Configuration is validated on application startup.
 */

import { z } from 'zod';

/**
 * Configuration schema with validation
 */
const AdminAnalyticsConfigSchema = z.object({
  // Cache Configuration
  cache: z.object({
    currentDayTTLMinutes: z.number().min(1).max(60).default(5),
    historicalTTLDays: z.number().min(1).max(3650).default(365),
    rebuildBatchSize: z.number().min(10).max(1000).default(100),
    sizeWarningMB: z.number().min(1).default(100),
    gracePeriodMinutes: z.number().min(1).max(60).default(5),
  }),

  // Trend Analysis
  trends: z.object({
    stabilityThreshold: z.number().min(0).max(10).default(1.0),
    calculationPrecision: z.number().int().min(0).max(4).default(2),
  }),

  // Pagination
  pagination: z.object({
    defaultPageSize: z.number().int().min(10).max(500).default(50),
    maxPageSize: z.number().int().min(10).max(1000).default(500),
    minPageSize: z.number().int().min(1).max(50).default(10),
  }),

  // Top N Limits
  topLimits: z.object({
    users: z.number().int().min(1).max(100).default(10),
    models: z.number().int().min(1).max(100).default(10),
    providers: z.number().int().min(1).max(50).default(5),
  }),

  // Export Limits
  export: z.object({
    maxRows: z.number().int().min(100).max(100000).default(10000),
    maxFileSizeMB: z.number().min(1).max(500).default(50),
  }),

  // Warning Thresholds
  warnings: z.object({
    largeDateRangeDays: z.number().int().min(1).max(365).default(30),
  }),

  // Date Range Limits (from Phase 1)
  dateRangeLimits: z.object({
    maxAnalyticsDays: z.number().int().min(1).max(365).default(90),
    maxExportDays: z.number().int().min(1).max(3650).default(365),
  }),
});

/**
 * Type definition for admin analytics configuration
 */
export type AdminAnalyticsConfig = z.infer<typeof AdminAnalyticsConfigSchema>;

/**
 * Load configuration from environment variables with validation
 *
 * @returns Validated configuration object
 * @throws Error if configuration is invalid
 */
export function loadAdminAnalyticsConfig(): AdminAnalyticsConfig {
  const config = {
    cache: {
      currentDayTTLMinutes: parseEnvInt('ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES', 5),
      historicalTTLDays: parseEnvInt('ADMIN_ANALYTICS_CACHE_HISTORICAL_TTL_DAYS', 365),
      rebuildBatchSize: parseEnvInt('ADMIN_ANALYTICS_CACHE_REBUILD_BATCH_SIZE', 100),
      sizeWarningMB: parseEnvInt('ADMIN_ANALYTICS_CACHE_SIZE_WARNING_MB', 100),
      gracePeriodMinutes: parseEnvInt('ADMIN_ANALYTICS_CACHE_GRACE_PERIOD_MINUTES', 5),
    },
    trends: {
      stabilityThreshold: parseEnvFloat('ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD', 1.0),
      calculationPrecision: parseEnvInt('ADMIN_ANALYTICS_TREND_PRECISION', 2),
    },
    pagination: {
      defaultPageSize: parseEnvInt('ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE', 50),
      maxPageSize: parseEnvInt('ADMIN_ANALYTICS_MAX_PAGE_SIZE', 500),
      minPageSize: parseEnvInt('ADMIN_ANALYTICS_MIN_PAGE_SIZE', 10),
    },
    topLimits: {
      users: parseEnvInt('ADMIN_ANALYTICS_TOP_USERS_LIMIT', 10),
      models: parseEnvInt('ADMIN_ANALYTICS_TOP_MODELS_LIMIT', 10),
      providers: parseEnvInt('ADMIN_ANALYTICS_TOP_PROVIDERS_LIMIT', 5),
    },
    export: {
      maxRows: parseEnvInt('ADMIN_ANALYTICS_MAX_EXPORT_ROWS', 10000),
      maxFileSizeMB: parseEnvInt('ADMIN_ANALYTICS_MAX_EXPORT_FILE_SIZE_MB', 50),
    },
    warnings: {
      largeDateRangeDays: parseEnvInt('ADMIN_ANALYTICS_LARGE_DATE_RANGE_WARNING_DAYS', 30),
    },
    dateRangeLimits: {
      maxAnalyticsDays: parseEnvInt('ADMIN_ANALYTICS_MAX_ANALYTICS_DAYS', 90),
      maxExportDays: parseEnvInt('ADMIN_ANALYTICS_MAX_EXPORT_DAYS', 365),
    },
  };

  // Validate configuration
  try {
    return AdminAnalyticsConfigSchema.parse(config);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((i: z.ZodIssue) => `${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid admin analytics configuration:\n${issues}`);
    }
    throw error;
  }
}

/**
 * Parse integer from environment variable with default
 */
function parseEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer, got: ${value}`);
  }
  return parsed;
}

/**
 * Parse float from environment variable with default
 */
function parseEnvFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  return parsed;
}

/**
 * Get subset of configuration safe to expose to frontend
 *
 * Only includes values needed for UI behavior, excludes internal/security-sensitive values
 */
export function getPublicConfig(config: AdminAnalyticsConfig) {
  return {
    pagination: config.pagination,
    topLimits: config.topLimits,
    dateRangeLimits: config.dateRangeLimits,
    warnings: config.warnings,
    trends: {
      // Only expose precision, not threshold (internal logic)
      calculationPrecision: config.trends.calculationPrecision,
    },
    export: {
      maxRows: config.export.maxRows,
      // Don't expose maxFileSizeMB (internal limit)
    },
  };
}

/**
 * Singleton instance of configuration
 * Loaded once at application startup
 */
let configInstance: AdminAnalyticsConfig | null = null;

/**
 * Get admin analytics configuration
 *
 * @returns Configuration object
 * @throws Error if configuration not initialized
 */
export function getAdminAnalyticsConfig(): AdminAnalyticsConfig {
  if (!configInstance) {
    throw new Error(
      'Admin analytics configuration not initialized. Call initAdminAnalyticsConfig() first.',
    );
  }
  return configInstance;
}

/**
 * Initialize admin analytics configuration
 * Should be called once at application startup
 *
 * @returns Initialized configuration
 */
export function initAdminAnalyticsConfig(): AdminAnalyticsConfig {
  configInstance = loadAdminAnalyticsConfig();
  return configInstance;
}

/**
 * Reset configuration (for testing only)
 * @internal
 */
export function resetAdminAnalyticsConfig(): void {
  configInstance = null;
}

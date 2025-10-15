# Phase 3, Session 3A: Configurable Constants

**Phase**: 3 - Architecture & Reliability
**Session**: 3A
**Duration**: 3-4 hours
**Priority**: 🟡 MEDIUM
**Issue**: #8 - Hard-coded Business Logic Constants

---

## Navigation

- **Previous**: [Phase 2 Checkpoint](./phase-2-checkpoint.md)
- **Next**: [Phase 3, Session 3B: Timezone Standardization](./phase-3-session-3b-timezone-standardization.md)
- **Up**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

This session is part of Phase 3, which focuses on architecture and reliability improvements. While not blocking production deployment, these improvements ensure long-term maintainability and operational flexibility.

### Problem Statement

The current implementation contains numerous hard-coded business logic constants throughout the codebase:

**Hard-coded Values Identified**:

- Cache TTL values (5 minutes for current day, permanent for historical)
- Trend stability threshold (1%)
- Top N limits (10 users, 10 models)
- Pagination defaults (50 items per page)
- Export limits (max rows, max file size)
- Warning thresholds (large date ranges)

**Issues with Current Approach**:

1. **Inflexible**: Requires code changes and redeployment to adjust business rules
2. **Inconsistent**: Same values duplicated in backend and frontend
3. **No Visibility**: Operations team cannot see current configuration
4. **Testing Difficulty**: Hard to test different scenarios without code changes
5. **Environment Differences**: Cannot vary config between dev/staging/prod

### Success Criteria

After this session:

- ✅ All business logic constants extracted to configuration module
- ✅ Configuration exposed via environment variables
- ✅ Safe subset of config exposed via API endpoint
- ✅ Frontend consumes config from API (dynamic, not build-time)
- ✅ All tests updated to use configurable values
- ✅ Documentation complete for all configuration options

---

## Phase 3 Summary

**Phase Objectives**: Architecture & reliability improvements for long-term maintainability

**Issues in Phase**:

1. **Issue #8** (Session 3A): Hard-coded business logic constants
2. **Issue #9** (Session 3B): Missing timezone documentation and configuration
3. **Issue #10** (Session 3C): Race condition in cache TTL logic

**Total Phase Duration**: 13-18 hours

**Phase Priority**: 🟡 MEDIUM - Should complete before full production rollout

---

## Session Objectives

1. **Extract Constants**: Identify and extract all hard-coded business logic constants
2. **Create Configuration Module**: Centralize configuration with type safety
3. **Environment Variables**: Add env vars for all configurable values
4. **API Endpoint**: Expose safe configuration to frontend
5. **Frontend Integration**: Update frontend to consume dynamic configuration
6. **Testing**: Update tests to use configuration module
7. **Documentation**: Document all configuration options

---

## Pre-Session Checklist

Before starting this session:

- [ ] Read Issue #8 in code review document
- [ ] Review Phase 2 completion status
- [ ] Ensure all Phase 2 tests passing
- [ ] Identify all hard-coded constants in codebase
- [ ] Plan which constants should be configurable
- [ ] Determine which config values are safe to expose to frontend
- [ ] Review environment variable naming conventions

---

## Implementation Steps

### Step 3A.1: Audit Hard-coded Constants (30 minutes)

**Objective**: Identify all hard-coded business logic constants that should be configurable

**Search Pattern**:

```bash
# Find numeric constants (may need manual review)
grep -r "const.*=.*[0-9]" backend/src/services/admin-usage/
grep -r "const.*=.*[0-9]" frontend/src/pages/AdminUsagePage.tsx
grep -r "const.*=.*[0-9]" frontend/src/components/admin/

# Find magic numbers in code
grep -r "if.*>.*[0-9]" backend/src/services/admin-usage/
grep -r "Math\." backend/src/services/admin-usage/ | grep "[0-9]"
```

**Constants to Extract** (organize by category):

**Cache Configuration**:

```typescript
// Current hard-coded locations:
// - backend/src/services/admin-usage/daily-usage-cache-manager.ts
const CURRENT_DAY_CACHE_TTL_MINUTES = 5;
const HISTORICAL_CACHE_TTL_DAYS = 365; // Effectively permanent
const CACHE_REBUILD_BATCH_SIZE = 100;
```

**Trend Analysis**:

```typescript
// - backend/src/services/admin-usage/admin-usage-trend-calculator.ts
const TREND_STABILITY_THRESHOLD = 1.0; // 1% change = stable
const TREND_CALCULATION_PRECISION = 2; // Decimal places
```

**Pagination**:

```typescript
// - backend/src/routes/admin-usage.ts
// - frontend/src/pages/AdminUsagePage.tsx
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;
const MIN_PAGE_SIZE = 10;
```

**Top N Limits**:

```typescript
// - backend/src/services/admin-usage-stats.service.ts
const TOP_USERS_LIMIT = 10;
const TOP_MODELS_LIMIT = 10;
const TOP_PROVIDERS_LIMIT = 5;
```

**Export Limits**:

```typescript
// - backend/src/services/admin-usage/admin-usage-export.service.ts
const MAX_EXPORT_ROWS = 10000;
const MAX_EXPORT_FILE_SIZE_MB = 50;
```

**Warning Thresholds**:

```typescript
// - backend/src/routes/admin-usage.ts
const LARGE_DATE_RANGE_WARNING_DAYS = 30;
const CACHE_SIZE_WARNING_MB = 100;
```

**Document Findings**:

```markdown
# Configuration Audit Results

## Total Constants Identified: 15

### By Category:

- Cache Configuration: 3
- Trend Analysis: 2
- Pagination: 3
- Top N Limits: 3
- Export Limits: 2
- Warning Thresholds: 2

### Environment Configurability:

- Should be configurable: 15
- Should be exposed to frontend: 8 (pagination, limits, thresholds)
- Should remain backend-only: 7 (cache internals, security-sensitive)
```

---

### Step 3A.2: Create Configuration Module (1 hour)

**Files to Create**:

- `backend/src/config/admin-analytics.config.ts`

**Implementation**:

```typescript
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
      maxAnalyticsDays: parseEnvInt('MAX_ANALYTICS_DATE_RANGE_DAYS', 90),
      maxExportDays: parseEnvInt('MAX_EXPORT_DATE_RANGE_DAYS', 365),
    },
  };

  // Validate configuration
  try {
    return AdminAnalyticsConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
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
```

**Validation**:

```bash
# Test configuration loading
node -e "const { initAdminAnalyticsConfig } = require('./backend/src/config/admin-analytics.config'); console.log(JSON.stringify(initAdminAnalyticsConfig(), null, 2))"
```

---

### Step 3A.3: Update Environment Variables (15 minutes)

**Files to Modify**:

- `backend/.env.example`
- `docs/deployment/configuration.md`

**Add to `.env.example`**:

```bash
#############################################
# Admin Analytics Configuration
#############################################

# Cache Configuration
ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES=5          # TTL for current day cache (minutes)
ADMIN_ANALYTICS_CACHE_HISTORICAL_TTL_DAYS=365            # TTL for historical cache (days, effectively permanent)
ADMIN_ANALYTICS_CACHE_REBUILD_BATCH_SIZE=100             # Batch size for cache rebuilds
ADMIN_ANALYTICS_CACHE_SIZE_WARNING_MB=100                # Log warning if cache exceeds this size (MB)

# Trend Analysis
ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD=1.0            # Percentage change threshold for "stable" trend (%)
ADMIN_ANALYTICS_TREND_PRECISION=2                        # Decimal places for trend calculations

# Pagination
ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE=50                     # Default items per page
ADMIN_ANALYTICS_MAX_PAGE_SIZE=500                        # Maximum items per page
ADMIN_ANALYTICS_MIN_PAGE_SIZE=10                         # Minimum items per page

# Top N Limits
ADMIN_ANALYTICS_TOP_USERS_LIMIT=10                       # Number of top users to show
ADMIN_ANALYTICS_TOP_MODELS_LIMIT=10                      # Number of top models to show
ADMIN_ANALYTICS_TOP_PROVIDERS_LIMIT=5                    # Number of top providers to show

# Export Limits
ADMIN_ANALYTICS_MAX_EXPORT_ROWS=10000                    # Maximum rows in export
ADMIN_ANALYTICS_MAX_EXPORT_FILE_SIZE_MB=50               # Maximum export file size (MB)

# Warning Thresholds
ADMIN_ANALYTICS_LARGE_DATE_RANGE_WARNING_DAYS=30         # Log warning for date ranges exceeding this (days)

# Date Range Limits (from Phase 1)
MAX_ANALYTICS_DATE_RANGE_DAYS=90                         # Maximum date range for analytics queries (days)
MAX_EXPORT_DATE_RANGE_DAYS=365                           # Maximum date range for exports (days)
```

**Update Documentation**:

```markdown
<!-- docs/deployment/configuration.md -->

### Admin Analytics Configuration

Admin analytics behavior can be customized via environment variables.

#### Cache Configuration

| Variable                                        | Default | Description                                                                             |
| ----------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES` | `5`     | Cache TTL for current day data (minutes). Lower values = fresher data, higher API load. |
| `ADMIN_ANALYTICS_CACHE_HISTORICAL_TTL_DAYS`     | `365`   | Cache TTL for historical data (days). Historical data is immutable.                     |
| `ADMIN_ANALYTICS_CACHE_REBUILD_BATCH_SIZE`      | `100`   | Number of days to process per batch during cache rebuild.                               |
| `ADMIN_ANALYTICS_CACHE_SIZE_WARNING_MB`         | `100`   | Log warning if cache size exceeds this value (MB).                                      |

#### Trend Analysis

| Variable                                    | Default | Description                                                                         |
| ------------------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD` | `1.0`   | Percentage change threshold for "stable" trend. Changes < 1% are considered stable. |
| `ADMIN_ANALYTICS_TREND_PRECISION`           | `2`     | Decimal places for trend percentage calculations.                                   |

#### Pagination

| Variable                            | Default | Description                       |
| ----------------------------------- | ------- | --------------------------------- |
| `ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE` | `50`    | Default number of items per page. |
| `ADMIN_ANALYTICS_MAX_PAGE_SIZE`     | `500`   | Maximum allowed items per page.   |
| `ADMIN_ANALYTICS_MIN_PAGE_SIZE`     | `10`    | Minimum allowed items per page.   |

... (continue for all variables)
```

---

### Step 3A.4: Initialize Configuration in Application (20 minutes)

**Files to Modify**:

- `backend/src/app.ts`

**Implementation**:

```typescript
// backend/src/app.ts

import { initAdminAnalyticsConfig, getAdminAnalyticsConfig } from './config/admin-analytics.config';

export async function buildApp(opts = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    ...opts,
  });

  // Initialize admin analytics configuration early in startup
  try {
    const config = initAdminAnalyticsConfig();
    fastify.log.info({ config }, 'Admin analytics configuration loaded');
  } catch (error) {
    fastify.log.fatal({ error }, 'Failed to load admin analytics configuration');
    throw error;
  }

  // Decorate fastify instance with config getter
  fastify.decorate('getAdminAnalyticsConfig', getAdminAnalyticsConfig);

  // ... rest of application setup
}

// Type augmentation for FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    getAdminAnalyticsConfig: () => AdminAnalyticsConfig;
  }
}
```

---

### Step 3A.5: Create API Endpoint for Configuration (30 minutes)

**Files to Create**:

- `backend/src/routes/config.ts`

**Implementation**:

```typescript
// backend/src/routes/config.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPublicConfig } from '../config/admin-analytics.config';

/**
 * Configuration Routes
 *
 * Exposes safe subset of configuration to frontend
 */
export default async function configRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/config/admin-analytics
   *
   * Get public admin analytics configuration
   * No authentication required - this is public configuration
   */
  fastify.get(
    '/admin-analytics',
    {
      schema: {
        description: 'Get public admin analytics configuration',
        tags: ['configuration'],
        response: {
          200: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  defaultPageSize: { type: 'number' },
                  maxPageSize: { type: 'number' },
                  minPageSize: { type: 'number' },
                },
              },
              topLimits: {
                type: 'object',
                properties: {
                  users: { type: 'number' },
                  models: { type: 'number' },
                  providers: { type: 'number' },
                },
              },
              dateRangeLimits: {
                type: 'object',
                properties: {
                  maxAnalyticsDays: { type: 'number' },
                  maxExportDays: { type: 'number' },
                },
              },
              warnings: {
                type: 'object',
                properties: {
                  largeDateRangeDays: { type: 'number' },
                },
              },
              trends: {
                type: 'object',
                properties: {
                  calculationPrecision: { type: 'number' },
                },
              },
              export: {
                type: 'object',
                properties: {
                  maxRows: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = fastify.getAdminAnalyticsConfig();
      const publicConfig = getPublicConfig(config);

      return reply.send(publicConfig);
    },
  );
}
```

**Register Route**:

```typescript
// backend/src/app.ts

import configRoutes from './routes/config';

// Register routes
await fastify.register(configRoutes, { prefix: '/api/v1/config' });
```

---

### Step 3A.6: Update Services to Use Configuration (45 minutes)

**Pattern for All Services**:

```typescript
// backend/src/services/admin-usage/[service].ts

import { getAdminAnalyticsConfig } from '../../config/admin-analytics.config';

export class SomeAdminUsageService extends BaseService {
  private config = getAdminAnalyticsConfig();

  someMethod() {
    // Replace hard-coded constant
    // Before: const limit = 10;
    // After:
    const limit = this.config.topLimits.users;

    // Use configuration value
    return this.getTopUsers(limit);
  }
}
```

**Files to Modify** (apply pattern to each):

1. **Cache Manager**:

```typescript
// backend/src/services/admin-usage/daily-usage-cache-manager.ts

private getCacheTTL(date: Date): number {
  const isToday = this.isTodayUTC(date);
  if (isToday) {
    return this.config.cache.currentDayTTLMinutes * 60; // Convert to seconds
  }
  return this.config.cache.historicalTTLDays * 24 * 60 * 60; // Convert to seconds
}

private async rebuildCache(startDate: Date, endDate: Date): Promise<void> {
  const batchSize = this.config.cache.rebuildBatchSize;
  // ... use batchSize for processing
}
```

2. **Trend Calculator**:

```typescript
// backend/src/services/admin-usage/admin-usage-trend-calculator.ts

calculateTrend(metric: string, current: number, previous: number): TrendData {
  const threshold = this.config.trends.stabilityThreshold;
  const precision = this.config.trends.calculationPrecision;

  const percentageChange = ((current - previous) / previous) * 100;
  const roundedChange = Number(percentageChange.toFixed(precision));

  let direction: 'up' | 'down' | 'stable';
  if (Math.abs(roundedChange) < threshold) {
    direction = 'stable';
  } else {
    direction = roundedChange > 0 ? 'up' : 'down';
  }

  return {
    metric,
    current,
    previous,
    percentageChange: roundedChange,
    direction,
  };
}
```

3. **Main Service**:

```typescript
// backend/src/services/admin-usage-stats.service.ts

async getTopUsers(breakdown: UserBreakdown[]): Promise<UserBreakdown[]> {
  const limit = this.config.topLimits.users;
  return breakdown
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, limit);
}

async getTopModels(breakdown: ModelBreakdown[]): Promise<ModelBreakdown[]> {
  const limit = this.config.topLimits.models;
  return breakdown
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, limit);
}
```

4. **Export Service**:

```typescript
// backend/src/services/admin-usage/admin-usage-export.service.ts

async exportUserBreakdownToCSV(
  breakdown: UserBreakdown[],
  filters: AdminUsageFilters
): Promise<string> {
  const maxRows = this.config.export.maxRows;

  if (breakdown.length > maxRows) {
    throw ApplicationError.badRequest(
      `Export too large. Maximum ${maxRows} rows allowed. Got ${breakdown.length} rows.`,
      { code: 'EXPORT_TOO_LARGE', maxRows, actualRows: breakdown.length }
    );
  }

  // ... generate CSV
}
```

5. **Routes** (date validation):

```typescript
// backend/src/routes/admin-usage.ts

fastify.post('/analytics', {
  handler: async (request, reply) => {
    const { startDate, endDate } = request.body;
    const config = fastify.getAdminAnalyticsConfig();

    // Use configurable warning threshold
    if (validation.days && validation.days > config.warnings.largeDateRangeDays) {
      fastify.log.warn(
        {
          userId: (request as AuthenticatedRequest).user?.userId,
          startDate,
          endDate,
          rangeInDays: validation.days,
          warningThreshold: config.warnings.largeDateRangeDays,
        },
        'Large date range requested for analytics',
      );
    }

    // ... rest of handler
  },
});
```

---

### Step 3A.7: Frontend Integration (45 minutes)

**Create Configuration Service**:

```typescript
// frontend/src/services/config.service.ts

import axios from 'axios';

/**
 * Admin analytics public configuration from backend
 */
export interface AdminAnalyticsPublicConfig {
  pagination: {
    defaultPageSize: number;
    maxPageSize: number;
    minPageSize: number;
  };
  topLimits: {
    users: number;
    models: number;
    providers: number;
  };
  dateRangeLimits: {
    maxAnalyticsDays: number;
    maxExportDays: number;
  };
  warnings: {
    largeDateRangeDays: number;
  };
  trends: {
    calculationPrecision: number;
  };
  export: {
    maxRows: number;
  };
}

/**
 * Fetch admin analytics configuration from backend
 */
export async function fetchAdminAnalyticsConfig(): Promise<AdminAnalyticsPublicConfig> {
  const response = await axios.get<AdminAnalyticsPublicConfig>('/api/v1/config/admin-analytics');
  return response.data;
}
```

**Create Config Context**:

```typescript
// frontend/src/contexts/ConfigContext.tsx

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminAnalyticsConfig, AdminAnalyticsPublicConfig } from '../services/config.service';

interface ConfigContextValue {
  adminAnalytics: AdminAnalyticsPublicConfig | undefined;
  isLoading: boolean;
  error: Error | null;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['config', 'adminAnalytics'],
    queryFn: fetchAdminAnalyticsConfig,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 3,
  });

  return (
    <ConfigContext.Provider
      value={{
        adminAnalytics: data,
        isLoading,
        error: error as Error | null,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextValue => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};

/**
 * Hook for accessing admin analytics configuration with defaults
 */
export const useAdminAnalyticsConfig = (): AdminAnalyticsPublicConfig => {
  const { adminAnalytics } = useConfig();

  // Provide sensible defaults if config not yet loaded
  // This prevents UI from breaking during initial load
  return adminAnalytics ?? {
    pagination: {
      defaultPageSize: 50,
      maxPageSize: 500,
      minPageSize: 10,
    },
    topLimits: {
      users: 10,
      models: 10,
      providers: 5,
    },
    dateRangeLimits: {
      maxAnalyticsDays: 90,
      maxExportDays: 365,
    },
    warnings: {
      largeDateRangeDays: 30,
    },
    trends: {
      calculationPrecision: 2,
    },
    export: {
      maxRows: 10000,
    },
  };
};
```

**Wrap Application with Provider**:

```typescript
// frontend/src/App.tsx

import { ConfigProvider } from './contexts/ConfigContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <ConfigProvider>
            {/* Rest of app */}
          </ConfigProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Use Configuration in Components**:

```typescript
// frontend/src/pages/AdminUsagePage.tsx

import { useAdminAnalyticsConfig } from '../contexts/ConfigContext';

const AdminUsagePage: React.FC = () => {
  const config = useAdminAnalyticsConfig();

  // Use dynamic configuration instead of hard-coded values
  const [perPage, setPerPage] = useState(config.pagination.defaultPageSize);

  const handleDateRangeChange = (start: string, end: string) => {
    const days = calculateDays(start, end);

    // Use dynamic max from config
    if (days > config.dateRangeLimits.maxAnalyticsDays) {
      addNotification({
        variant: 'warning',
        title: t('adminUsage.warnings.dateRangeTooLarge.title'),
        description: t(
          'adminUsage.warnings.dateRangeTooLarge.description',
          `Maximum date range is ${config.dateRangeLimits.maxAnalyticsDays} days.`,
        ),
      });
      return;
    }

    // ... rest of logic
  };

  // ... rest of component
};
```

---

### Step 3A.8: Update Tests (30 minutes)

**Create Test Configuration Helper**:

```typescript
// backend/tests/helpers/test-config.ts

import {
  resetAdminAnalyticsConfig,
  initAdminAnalyticsConfig,
} from '../../src/config/admin-analytics.config';

/**
 * Initialize test configuration with custom values
 */
export function initTestConfig(overrides: Record<string, string> = {}) {
  // Reset existing config
  resetAdminAnalyticsConfig();

  // Set environment variables
  const originalEnv = { ...process.env };

  Object.entries(overrides).forEach(([key, value]) => {
    process.env[key] = value;
  });

  // Initialize with test values
  const config = initAdminAnalyticsConfig();

  // Return cleanup function
  return {
    config,
    cleanup: () => {
      process.env = originalEnv;
      resetAdminAnalyticsConfig();
    },
  };
}
```

**Update Service Tests**:

```typescript
// backend/tests/unit/services/admin-usage/admin-usage-trend-calculator.test.ts

import { initTestConfig } from '../../../helpers/test-config';

describe('AdminUsageTrendCalculator', () => {
  describe('calculateTrend', () => {
    it('should use configurable stability threshold', () => {
      // Set custom threshold
      const { config, cleanup } = initTestConfig({
        ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD: '2.0', // 2% threshold
      });

      const calculator = new AdminUsageTrendCalculator(fastify);

      // 1.5% change should be stable with 2% threshold
      const trend = calculator.calculateTrend('requests', 101.5, 100);
      expect(trend.direction).toBe('stable');

      cleanup();
    });

    it('should use configurable precision', () => {
      const { config, cleanup } = initTestConfig({
        ADMIN_ANALYTICS_TREND_PRECISION: '4', // 4 decimal places
      });

      const calculator = new AdminUsageTrendCalculator(fastify);

      const trend = calculator.calculateTrend('requests', 100.12345, 100);
      expect(trend.percentageChange.toString()).toMatch(/\.\d{4}$/); // Has 4 decimals

      cleanup();
    });
  });
});
```

**Update Integration Tests**:

```typescript
// backend/tests/integration/admin-usage.test.ts

describe('Admin Usage API', () => {
  describe('GET /api/v1/config/admin-analytics', () => {
    it('should return public configuration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config/admin-analytics',
      });

      expect(response.statusCode).toBe(200);
      const config = response.json();

      expect(config).toHaveProperty('pagination');
      expect(config).toHaveProperty('topLimits');
      expect(config).toHaveProperty('dateRangeLimits');

      // Should not expose internal config
      expect(config).not.toHaveProperty('cache');
    });
  });
});
```

**Update Frontend Tests**:

```typescript
// frontend/src/test/contexts/ConfigContext.test.tsx

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminAnalyticsConfig } from '../../contexts/ConfigContext';
import * as configService from '../../services/config.service';

describe('ConfigContext', () => {
  it('should provide configuration from API', async () => {
    const mockConfig = {
      pagination: { defaultPageSize: 100, maxPageSize: 1000, minPageSize: 20 },
      topLimits: { users: 20, models: 15, providers: 10 },
      // ... rest of mock
    };

    vi.spyOn(configService, 'fetchAdminAnalyticsConfig').mockResolvedValue(mockConfig);

    const { result } = renderHook(() => useAdminAnalyticsConfig(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={new QueryClient()}>
          <ConfigProvider>{children}</ConfigProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(result.current.pagination.defaultPageSize).toBe(100);
    });
  });

  it('should provide defaults if config not loaded', () => {
    const { result } = renderHook(() => useAdminAnalyticsConfig(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={new QueryClient()}>
          <ConfigProvider>{children}</ConfigProvider>
        </QueryClientProvider>
      ),
    });

    // Should have defaults immediately
    expect(result.current.pagination.defaultPageSize).toBe(50);
  });
});
```

---

### Step 3A.9: Documentation (30 minutes)

**Update Backend CLAUDE.md**:

````markdown
<!-- backend/CLAUDE.md -->

## Configuration

### Admin Analytics Configuration

All business logic constants are externalized to configuration with environment variable overrides.

**Location**: `src/config/admin-analytics.config.ts`

**Categories**:

- Cache behavior (TTL, batch sizes)
- Trend analysis (thresholds, precision)
- Pagination (limits, defaults)
- Top N limits (users, models, providers)
- Export limits (rows, file size)
- Warning thresholds

**Usage in Services**:

```typescript
import { getAdminAnalyticsConfig } from '../config/admin-analytics.config';

class MyService extends BaseService {
  private config = getAdminAnalyticsConfig();

  myMethod() {
    const limit = this.config.topLimits.users;
    // Use limit...
  }
}
```
````

**Public API**:

- `GET /api/v1/config/admin-analytics` - Safe subset exposed to frontend
- No authentication required (public configuration)

**Testing**:

```typescript
import { initTestConfig } from './tests/helpers/test-config';

const { config, cleanup } = initTestConfig({
  ADMIN_ANALYTICS_TOP_USERS_LIMIT: '20',
});
// ... test
cleanup();
```

````

**Update Frontend CLAUDE.md**:
```markdown
<!-- frontend/CLAUDE.md -->

## Configuration

### Dynamic Configuration from Backend

Configuration values are fetched dynamically from backend API, not hard-coded at build time.

**Context**: `ConfigContext` provides configuration to all components

**Usage**:
```typescript
import { useAdminAnalyticsConfig } from '../contexts/ConfigContext';

function MyComponent() {
  const config = useAdminAnalyticsConfig();

  const limit = config.topLimits.users;
  const maxDays = config.dateRangeLimits.maxAnalyticsDays;

  // Use configuration...
}
````

**Benefits**:

- Configuration changes without rebuilding frontend
- Consistent values between backend and frontend
- Environment-specific configuration (dev/staging/prod)

**Defaults**:

- Hook provides sensible defaults if API not yet loaded
- Prevents UI from breaking during initial load

````

**Create Configuration Guide**:
```markdown
<!-- docs/deployment/admin-analytics-configuration-guide.md -->

# Admin Analytics Configuration Guide

This guide explains all configuration options for the Admin Usage Analytics feature.

## Overview

Admin analytics behavior can be customized via environment variables. All variables have sensible defaults and are validated at application startup.

## Configuration Categories

### Cache Configuration

Controls cache behavior for usage data.

**ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES** (default: `5`)
- Cache TTL for current day data in minutes
- Lower values = fresher data, higher LiteLLM API load
- Recommended: 5-15 minutes
- Example: `ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES=10`

**ADMIN_ANALYTICS_CACHE_HISTORICAL_TTL_DAYS** (default: `365`)
- Cache TTL for historical data in days
- Historical data is immutable, can be cached long-term
- Recommended: 365 days (effectively permanent)
- Example: `ADMIN_ANALYTICS_CACHE_HISTORICAL_TTL_DAYS=365`

**ADMIN_ANALYTICS_CACHE_REBUILD_BATCH_SIZE** (default: `100`)
- Number of days to process per batch during cache rebuild
- Higher values = faster rebuild, more memory
- Lower values = slower rebuild, less memory
- Recommended: 50-200 days
- Example: `ADMIN_ANALYTICS_CACHE_REBUILD_BATCH_SIZE=100`

### Trend Analysis

Controls trend calculation behavior.

**ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD** (default: `1.0`)
- Percentage change threshold for "stable" trend
- Changes below this are considered stable
- Recommended: 0.5-2.0%
- Example: `ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD=1.5`

**ADMIN_ANALYTICS_TREND_PRECISION** (default: `2`)
- Decimal places for trend percentage calculations
- Recommended: 1-4
- Example: `ADMIN_ANALYTICS_TREND_PRECISION=2`

### Pagination

Controls pagination behavior in breakdown endpoints.

**ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE** (default: `50`)
- Default number of items per page
- Frontend uses this as initial page size
- Recommended: 25-100
- Example: `ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE=50`

**ADMIN_ANALYTICS_MAX_PAGE_SIZE** (default: `500`)
- Maximum allowed items per page
- Prevents excessively large responses
- Recommended: 100-1000
- Example: `ADMIN_ANALYTICS_MAX_PAGE_SIZE=500`

**ADMIN_ANALYTICS_MIN_PAGE_SIZE** (default: `10`)
- Minimum allowed items per page
- Recommended: 5-25
- Example: `ADMIN_ANALYTICS_MIN_PAGE_SIZE=10`

### Top N Limits

Controls how many top items to return in analytics.

**ADMIN_ANALYTICS_TOP_USERS_LIMIT** (default: `10`)
- Number of top users to show
- Recommended: 5-50
- Example: `ADMIN_ANALYTICS_TOP_USERS_LIMIT=10`

**ADMIN_ANALYTICS_TOP_MODELS_LIMIT** (default: `10`)
- Number of top models to show
- Recommended: 5-50
- Example: `ADMIN_ANALYTICS_TOP_MODELS_LIMIT=10`

**ADMIN_ANALYTICS_TOP_PROVIDERS_LIMIT** (default: `5`)
- Number of top providers to show
- Recommended: 3-20
- Example: `ADMIN_ANALYTICS_TOP_PROVIDERS_LIMIT=5`

### Export Limits

Controls data export restrictions.

**ADMIN_ANALYTICS_MAX_EXPORT_ROWS** (default: `10000`)
- Maximum number of rows in export
- Prevents memory exhaustion
- Recommended: 1000-100000
- Example: `ADMIN_ANALYTICS_MAX_EXPORT_ROWS=10000`

**ADMIN_ANALYTICS_MAX_EXPORT_FILE_SIZE_MB** (default: `50`)
- Maximum export file size in megabytes
- Internal limit only (not exposed to frontend)
- Recommended: 10-500 MB
- Example: `ADMIN_ANALYTICS_MAX_EXPORT_FILE_SIZE_MB=50`

### Warning Thresholds

Controls when warnings are logged.

**ADMIN_ANALYTICS_LARGE_DATE_RANGE_WARNING_DAYS** (default: `30`)
- Log warning for date ranges exceeding this value
- Helps identify potentially expensive queries
- Recommended: 14-90 days
- Example: `ADMIN_ANALYTICS_LARGE_DATE_RANGE_WARNING_DAYS=30`

## Configuration Validation

All configuration is validated at application startup using Zod schemas. Invalid values will prevent application from starting with clear error messages.

## Exposing Configuration to Frontend

A safe subset of configuration is exposed via API endpoint:

```bash
curl http://localhost:8081/api/v1/config/admin-analytics
````

This endpoint:

- Requires no authentication (public configuration)
- Returns only UI-relevant values
- Excludes internal/security-sensitive values

## Example Configuration

Production example with adjusted values:

```bash
# Fresher current day data (check every 3 minutes)
ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES=3

# Smaller batches for memory-constrained environments
ADMIN_ANALYTICS_CACHE_REBUILD_BATCH_SIZE=50

# Stricter trend threshold (only > 2% is "trending")
ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD=2.0

# Larger page size for power users
ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE=100

# More top users visible
ADMIN_ANALYTICS_TOP_USERS_LIMIT=20

# Smaller export limit for free tier
ADMIN_ANALYTICS_MAX_EXPORT_ROWS=5000
```

````

---

## Deliverables

- [X] Configuration audit completed and documented
- [X] `admin-analytics.config.ts` module created with Zod validation
- [X] All 15+ environment variables added to `.env.example`
- [X] Configuration initialized in application startup
- [X] API endpoint `/api/v1/config/admin-analytics` created
- [X] Frontend `ConfigContext` created and integrated
- [X] All services updated to use configuration
- [X] Frontend components updated to use dynamic config
- [X] Test helpers created for configuration testing
- [X] All tests updated and passing
- [X] Documentation complete:
  - Backend CLAUDE.md updated
  - Frontend CLAUDE.md updated
  - Configuration guide created
  - Deployment docs updated

---

## Acceptance Criteria

- [X] All hard-coded constants extracted to configuration
- [X] Configuration validated at startup (invalid config = app won't start)
- [X] Environment variables documented with defaults and recommendations
- [X] API endpoint exposes safe subset (no internal/security values)
- [X] Frontend uses dynamic configuration (not build-time constants)
- [X] All services use `getAdminAnalyticsConfig()`
- [X] All frontend components use `useAdminAnalyticsConfig()`
- [X] Tests use `initTestConfig()` helper for custom configurations
- [X] All existing tests pass with default configuration
- [X] Manual testing confirms:
  - Changing env var changes behavior
  - Frontend reflects backend config
  - Invalid config values prevent startup

---

## Validation

**Test Configuration Loading**:
```bash
# Test with default values
npm --prefix backend test -- admin-analytics.config.test.ts

# Test with custom values
ADMIN_ANALYTICS_TOP_USERS_LIMIT=20 npm --prefix backend test -- admin-analytics.config.test.ts
````

**Test API Endpoint**:

```bash
# Start backend
npm --prefix backend run dev

# Fetch configuration
curl http://localhost:8081/api/v1/config/admin-analytics | jq

# Verify response structure
```

**Test Frontend Integration**:

```bash
# Start both backend and frontend
npm run dev:logged

# Open browser console
# Run: JSON.stringify(window.__LITEMAAS_CONFIG__, null, 2)
# Should see configuration from API
```

**Test Configuration Override**:

```bash
# Stop servers
# Edit .env with custom values
ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE=100
ADMIN_ANALYTICS_TOP_USERS_LIMIT=20

# Restart servers
npm run dev:logged

# Verify new values reflected in:
# - Backend logs (startup message)
# - API response
# - Frontend behavior (page size = 100)
```

**Test Invalid Configuration**:

```bash
# Set invalid value
ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD=-5  # Negative not allowed

# Try to start backend
npm --prefix backend run dev

# Should see validation error and app should not start
```

**Run Full Test Suite**:

```bash
# Backend tests
npm --prefix backend test

# Frontend tests
npm --prefix frontend test

# Integration tests
npm --prefix backend test:integration

# All tests should pass
```

---

## Next Steps

After completing Session 3A:

1. **Commit Changes**:

   ```bash
   git add .
   git commit -m "feat: extract hard-coded constants to configuration module

   - Create admin-analytics.config.ts with Zod validation
   - Add 15+ environment variables for all business logic constants
   - Create GET /api/v1/config/admin-analytics endpoint
   - Add ConfigContext for frontend dynamic configuration
   - Update all services to use getAdminAnalyticsConfig()
   - Update all frontend components to use useAdminAnalyticsConfig()
   - Add test helpers for configuration testing
   - Complete documentation

   Closes Issue #8
   Phase 3, Session 3A of remediation plan"
   ```

2. **Proceed to Session 3B**: [Timezone Standardization](./phase-3-session-3b-timezone-standardization.md)

3. **Update Progress Tracker** in main remediation plan

---

## Troubleshooting

### Issue: Configuration validation fails at startup

**Cause**: Invalid environment variable value

**Solution**:

1. Check startup logs for validation error details
2. Review environment variable value
3. Consult configuration guide for valid ranges
4. Fix value or remove variable to use default

### Issue: Frontend shows default values, not backend config

**Cause**: ConfigProvider not wrapping app, or API request failing

**Solution**:

1. Check browser console for API errors
2. Verify ConfigProvider wraps all components
3. Check network tab for /api/v1/config/admin-analytics request
4. Verify backend is running and endpoint registered

### Issue: Tests fail after configuration changes

**Cause**: Tests using hard-coded values

**Solution**:

1. Update tests to use `initTestConfig()` helper
2. Verify tests clean up configuration after each test
3. Check for race conditions in configuration initialization

---

**Session Complete**: ✅

**Estimated Time**: 3-4 hours
**Actual Time**: **\_** hours

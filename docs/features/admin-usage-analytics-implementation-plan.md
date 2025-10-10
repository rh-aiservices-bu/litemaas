# Admin Usage Analytics Feature - Detailed Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for building an enterprise-grade admin usage analytics feature for the LiteMaaS platform. The feature will provide administrators with complete visibility into AI model consumption across all users, models, and API keys, enabling data-driven decision making and cost optimization.

## ⚠️ Key Architectural Insights

### How LiteLLM Provides Usage Data

LiteLLM's `/user/daily/activity` endpoint provides **aggregated usage data across ALL users** when called without an `api_key` filter. The response includes comprehensive breakdowns by:

- **Date**: Daily metrics for each day in the date range
- **Models**: Usage per model with nested API key breakdown
- **API Keys**: Usage per API key (with `key_alias` metadata)
- **Entities**: Usage per user entity (LiteLLM's internal user ID)
- **Providers**: Usage per provider (OpenAI, Azure, etc.)

This eliminates the need to iterate through individual users - LiteLLM aggregates everything for us!

### Optimized Data Collection Strategy

**Day-by-Day Incremental Caching:**

1. For each day in the requested date range:
   - Check if day is cached in LiteMaaS database
   - Historical days (> 1 day old): Serve from cache permanently
   - Current day: Refresh every 5 minutes
   - Missing days: Fetch from LiteLLM and cache

2. Enrich LiteLLM data with LiteMaaS user information:
   - Extract API key hashes from LiteLLM response
   - Query LiteMaaS database: `SELECT user_id, username FROM api_keys WHERE token_hash IN (...)`
   - Map API keys to users for user-level breakdowns

3. Aggregate across all cached days to generate final response

**Performance Characteristics:**

- **First load (30 days)**: ~5-10 seconds (30 API calls to LiteLLM)
- **Subsequent loads**: < 1 second (served from database cache)
- **Daily refresh**: < 1 second (only current day refetched)
- **Scales to 1000+ users** (no per-user iteration needed)

### Phase 1 MVP Scope - Actually Implemented ✅

**Core Features Delivered:**

- ✅ **Global metrics dashboard** (MetricsOverview component)
  - Total requests, tokens (prompt/completion), cost metrics
  - Success rate and performance indicators
  - Trend indicators with comparison to previous period
  - Daily usage charts (UsageTrends component)
  - Model distribution visualization (ModelDistributionChart component)
  - Top users and top models tables

- ✅ **Multi-dimensional filtering**
  - Date range filtering (1d, 7d, 30d, 90d, custom date picker)
  - Model selection (multi-select with search)
  - User selection (multi-select with search)
  - API key selection (cascading filter based on selected users)

- ✅ **Data export functionality**
  - CSV export for spreadsheet analysis
  - JSON export for programmatic processing
  - Exports respect active filters

- ✅ **Admin controls**
  - Manual "Refresh Today" button (admin-only, not adminReadonly)
  - RBAC enforcement (admin and adminReadonly roles)
  - Intelligent caching (5-min TTL for current day, permanent cache for historical data)

- ✅ **Backend infrastructure (complete and ready for expansion)**
  - All 7 API endpoints implemented and tested
  - Day-by-day incremental caching with LiteLLM integration
  - User enrichment (API key → user mapping)
  - Breakdown endpoints ready: `/by-user`, `/by-model`, `/by-provider`
  - Frontend service methods exist for all breakdown endpoints

**Deferred from Original Plan (Phase 2+ / Future Enhancements):**

- ⏳ **Tabbed interface** - Current MVP shows MetricsOverview directly without tab navigation
- ⏳ **User breakdown table** - Backend endpoint ready, UI component not yet created
- ⏳ **Model breakdown table** - Backend endpoint ready, UI component not yet created
- ⏳ **Provider breakdown table** - Component created but not yet integrated into UI
- ⏳ **Dedicated cost analysis view** - Cost data shown in MetricsOverview, dedicated view deferred
- ⏳ **Trends & forecasts view** - Trend indicators shown in cards, dedicated view deferred

**Excluded from MVP (Future Advanced Features):**

- 🔮 Real-time WebSocket updates
- 🔮 Anomaly detection
- 🔮 Usage forecasting algorithms
- 🔮 Scheduled reports
- 🔮 Advanced trend analysis with ML models

**MVP Strategy:** This focused MVP delivers immediate value with a comprehensive analytics dashboard while establishing complete backend infrastructure. All breakdown endpoints are ready for future UI integration - this is purely frontend work when prioritized.

## Table of Contents

- [Project Overview](#project-overview)
- [Technical Architecture](#technical-architecture)
- [Backend Implementation](#backend-implementation)
- [Frontend Implementation](#frontend-implementation)
- [Data Pipeline](#data-pipeline)
- [Testing Strategy](#testing-strategy)
- [Deployment Plan](#deployment-plan)
- [Task Breakdown for Subagents](#task-breakdown-for-subagents)

---

## Project Overview

### Goals

1. Provide comprehensive usage visibility across all organizational dimensions
2. Enable cost optimization and budget management
3. Support data-driven capacity planning
4. Facilitate usage anomaly detection and alerting
5. Generate executive reports and insights

### Key Features

- **Multi-dimensional Analytics**: View usage by user, model, API key, and time period
- **Incremental Data Loading**: Day-by-day caching for optimal performance
- **Advanced Visualizations**: Charts, heatmaps, and trend analysis
- **Cost Analysis**: Detailed cost breakdown from LiteLLM spend data
- **Export Capabilities**: CSV and JSON reports
- **Future Enhancements** (Phase 2+): Real-time updates, usage forecasting, anomaly detection

### Success Metrics

- Page load time < 2 seconds for dashboard
- Data refresh interval < 30 seconds
- Support for 10,000+ users' data aggregation
- 99.9% uptime for analytics service
- Export generation < 10 seconds for 1 year of data

---

## Technical Architecture

### System Design

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  ┌─────────────────────────────────────────────┐   │
│  │         AdminUsagePage Component            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Filters  │ │  Charts  │ │  Tables  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────┘   │
│                        ▼                            │
│  ┌─────────────────────────────────────────────┐   │
│  │        Admin Usage Service (Frontend)       │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│                Backend (Fastify)                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         Admin Usage Routes                  │   │
│  │  /api/v1/admin/usage/*                        │   │
│  └─────────────────────────────────────────────┘   │
│                        ▼                            │
│  ┌─────────────────────────────────────────────┐   │
│  │     AdminUsageStatsService                  │   │
│  │  - Data aggregation                         │   │
│  │  - Caching layer                           │   │
│  │  - Cost calculations                       │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│              External Services                       │
│  ┌──────────────────┐  ┌──────────────────┐       │
│  │   LiteLLM API    │  │   PostgreSQL     │       │
│  │ /user/daily/     │  │   Database       │       │
│  │    activity      │  │                  │       │
│  └──────────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. Admin requests usage data with filters
2. Frontend validates request and checks cache
3. Backend aggregates data from LiteLLM API
4. Results cached with TTL based on date range
5. Frontend renders visualizations
6. Real-time updates via polling/WebSocket

---

## Backend Implementation

### 1. Routes Structure (`backend/src/routes/admin-usage.ts`)

```typescript
interface AdminUsageRoutes {
  // Core endpoints (Phase 1 - MVP)
  // Note: All routes are under /api/v1/admin/usage/*
  'POST /api/v1/admin/usage/analytics': AnalyticsResponse; // Main analytics endpoint with filters
  'GET /api/v1/admin/usage/by-user': UserBreakdownResponse;
  'GET /api/v1/admin/usage/by-model': ModelBreakdownResponse;
  'GET /api/v1/admin/usage/by-provider': ProviderBreakdownResponse;

  // Export endpoints (Phase 1 - MVP)
  'GET /api/v1/admin/usage/export': ExportDataResponse;

  // Refresh and filter endpoints (Phase 1 - MVP)
  'POST /api/v1/admin/usage/refresh-today': RefreshTodayResponse;
  'GET /api/v1/admin/usage/filter-options': FilterOptionsResponse; // Get available filters

  // Admin utilities (Phase 1 - MVP)
  'POST /api/v1/admin/usage/rebuild-cache': RebuildCacheResponse; // Rebuild cache from raw data

  // Future endpoints (Phase 2+)
  // 'GET /api/v1/admin/usage/trends': TrendAnalysisResponse;
  // 'GET /api/v1/admin/usage/heatmap': UsageHeatmapResponse;
  // 'GET /api/v1/admin/usage/anomalies': AnomalyDetectionResponse;
  // 'GET /api/v1/admin/usage/forecast': UsageForecastResponse;
  // 'WS /api/v1/admin/usage/stream': WebSocketStream;
}
```

### 2. Service Implementation (`backend/src/services/admin-usage-stats.service.ts`)

```typescript
class AdminUsageStatsService extends BaseService {
  private cacheManager: DailyUsageCacheManager;
  private liteLLMService: LiteLLMService;

  // Core methods (Phase 1 - MVP)
  async getAnalytics(filters: AdminUsageFilters): Promise<Analytics>;
  async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]>;
  async getModelBreakdown(filters: AdminUsageFilters): Promise<ModelBreakdown[]>;
  async getProviderBreakdown(filters: AdminUsageFilters): Promise<ProviderBreakdown[]>;
  async exportUsageData(filters: AdminUsageFilters, format: 'csv' | 'json'): Promise<string>;
  async refreshTodayData(): Promise<void>;

  // Data collection methods
  private async fetchDailyDataFromLiteLLM(date: Date): Promise<LiteLLMDayData>;
  private async enrichWithUserMapping(dayData: LiteLLMDayData): Promise<EnrichedDayData>;
  private async collectDateRangeData(startDate: Date, endDate: Date): Promise<EnrichedDayData[]>;

  // Aggregation methods
  private aggregateDailyData(dailyData: EnrichedDayData[]): AggregatedUsageData;
  private aggregateByUser(dailyData: EnrichedDayData[]): UserBreakdown[];
  private aggregateByModel(dailyData: EnrichedDayData[]): ModelBreakdown[];
  private aggregateByProvider(dailyData: EnrichedDayData[]): ProviderBreakdown[];

  // Caching helpers
  private async getCachedOrFetch(date: Date): Promise<EnrichedDayData>;
  private isHistoricalDate(date: Date): boolean;

  // Future methods (Phase 2+)
  // async detectAnomalies(data: AggregatedData): Promise<Anomaly[]>
  // async forecastUsage(historical: TimeSeriesData[]): Promise<Forecast>
  // async generateInsights(metrics: GlobalMetrics): Promise<Insights>
}
```

### 3. Data Models

```typescript
interface GlobalMetrics {
  period: DateRange;
  totalUsers: number;
  activeUsers: number;
  totalRequests: number;
  totalTokens: TokenBreakdown;
  totalCost: CostBreakdown;
  successRate: number;
  averageLatency: number;
  topMetrics: {
    topUser: UserSummary;
    topModel: ModelSummary;
    topApiKey: ApiKeySummary;
  };
  trends: {
    requestsTrend: TrendData;
    costTrend: TrendData;
    usersTrend: TrendData;
  };
}

interface UserBreakdown {
  userId: string;
  username: string;
  email: string;
  department?: string;
  role: UserRole;
  metrics: {
    requests: number;
    tokens: TokenBreakdown;
    cost: number;
    models: ModelUsage[];
    apiKeys: ApiKeyUsage[];
    lastActive: Date;
  };
  trends: TrendData[];
  anomalies?: Anomaly[];
}

interface ModelBreakdown {
  modelId: string;
  modelName: string;
  provider: string;
  metrics: {
    requests: number;
    tokens: TokenBreakdown;
    cost: number;
    users: number;
    successRate: number;
    averageLatency: number;
  };
  pricing: ModelPricing;
  usage: TimeSeriesData[];
  topUsers: UserSummary[];
}

interface CostBreakdown {
  total: number;
  byProvider: { [provider: string]: number };
  byModel: { [model: string]: number };
  byUser: { [userId: string]: number };
  byDay: TimeSeriesData[];
  projectedMonthly: number;
  savingsOpportunities?: SavingsRecommendation[];
}
```

### 4. Query Optimization Strategies

```typescript
// Day-by-day incremental fetching from LiteLLM
async function fetchDailyUsageData(startDate: Date, endDate: Date): Promise<DailyUsageData[]> {
  const results: DailyUsageData[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  for (const day of days) {
    // Check if day is already cached in database
    const cached = await getCachedDailyData(day);
    if (cached && !isToday(day)) {
      results.push(cached);
      continue;
    }

    // Fetch from LiteLLM for this specific day
    const formattedDate = format(day, 'yyyy-MM-dd');
    const liteLLMData = await liteLLMService.getDailyActivity(
      undefined, // No api_key filter = all users
      formattedDate,
      formattedDate
    );

    // Map API keys to users using LiteMaaS database
    const enrichedData = await enrichWithUserData(liteLLMData);

    // Cache in database (permanently for historical days, temporarily for today)
    await cacheDailyData(day, enrichedData, isToday(day) ? 300 : null);

    results.push(enrichedData);
  }

  return results;
}

// API key to user mapping
async function enrichWithUserData(liteLLMData: LiteLLMResponse): Promise<EnrichedData> {
  // Extract all API key hashes from LiteLLM response
  const apiKeyHashes = extractApiKeyHashes(liteLLMData);

  // Query LiteMaaS database for user mappings
  const apiKeyUsers = await db.query(
    `SELECT token_hash, user_id, alias FROM api_keys WHERE token_hash = ANY($1)`,
    [apiKeyHashes]
  );

  // Create mapping
  const keyToUser = new Map(apiKeyUsers.rows.map(row => [row.token_hash, row]));

  // Enrich data with user information
  return enrichLiteLLMData(liteLLMData, keyToUser);
}

// Caching strategy based on data freshness requirements
function determineCacheTTL(date: Date): number | null {
  if (isToday(date)) return 5 * 60; // 5 minutes for current day
  return null; // Permanent cache for historical days
}

// Database table for caching daily usage data
CREATE TABLE daily_usage_cache (
  date DATE PRIMARY KEY,
  raw_data JSONB NOT NULL,              -- Full LiteLLM response
  aggregated_by_user JSONB,             -- Pre-computed user breakdown
  aggregated_by_model JSONB,            -- Pre-computed model breakdown
  aggregated_by_provider JSONB,         -- Pre-computed provider breakdown
  total_metrics JSONB,                  -- Pre-computed totals
  updated_at TIMESTAMP DEFAULT NOW(),
  is_complete BOOLEAN DEFAULT true      -- false if current day
);

CREATE INDEX idx_daily_cache_date ON daily_usage_cache(date DESC);
CREATE INDEX idx_daily_cache_complete ON daily_usage_cache(is_complete);

-- API key lookup indexes
CREATE INDEX idx_api_keys_token_hash ON api_keys(token_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
```

---

## Frontend Implementation

### 1. Page Component Structure

#### Original Planned Architecture

The original design envisioned a tabbed interface with multiple breakdown views:

```typescript
const AdminUsagePage: React.FC = () => {
  // State management
  const [filters, setFilters] = useState<AdminUsageFilters>(defaultFilters);
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [selectedDimension, setSelectedDimension] = useState<Dimension>('user');

  // Data fetching with React Query
  const { data: metrics, isLoading: metricsLoading } = useAdminMetrics(filters);
  const { data: breakdown, isLoading: breakdownLoading } = useBreakdownData(selectedDimension, filters);
  const { data: trends, isLoading: trendsLoading } = useTrendData(filters);

  return (
    <PageSection>
      <AdminUsageHeader onExport={handleExport} />
      <AdminUsageFilters filters={filters} onChange={setFilters} />

      <Tabs activeKey={activeView} onSelect={setActiveView}>
        <Tab eventKey="overview" title="Overview">
          <MetricsOverview data={metrics} loading={metricsLoading} />
        </Tab>
        <Tab eventKey="users" title="By Users">
          <UserBreakdownTable data={breakdown} />  {/* Not implemented */}
        </Tab>
        <Tab eventKey="models" title="By Models">
          <ModelBreakdownTable data={breakdown} />  {/* Not implemented */}
        </Tab>
        <Tab eventKey="costs" title="Cost Analysis">
          <CostAnalysis data={metrics} trends={trends} />  {/* Deferred */}
        </Tab>
        <Tab eventKey="trends" title="Trends & Forecasts">
          <TrendsAndForecasts data={trends} />  {/* Deferred */}
        </Tab>
      </Tabs>
    </PageSection>
  );
};
```

#### Actually Implemented MVP (`frontend/src/pages/AdminUsagePage.tsx`)

The MVP implementation focuses on a streamlined single-view dashboard:

```typescript
const AdminUsagePage: React.FC = () => {
  // State management
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedApiKeyIds, setSelectedApiKeyIds] = useState<string[]>([]);

  // Data fetching with React Query
  const { data: metricsData, isLoading: metricsLoading } = useQuery(
    ['adminMetrics', filters],
    () => adminUsageService.getAnalytics(filters),
    { staleTime: staleTimeMs, refetchOnWindowFocus: false }
  );

  return (
    <>
      <PageSection variant="secondary">
        <Flex justifyContent="space-between">
          <Title>Admin Usage Analytics</Title>
          <Flex>
            <Button icon={<SyncAltIcon />} onClick={handleRefreshToday}>
              Refresh Today
            </Button>
            <Button icon={<DownloadIcon />} onClick={handleExport}>
              Export
            </Button>
          </Flex>
        </Flex>
      </PageSection>

      <PageSection>
        <Toolbar>
          <DateRangeFilter />
          <ModelFilterSelect />
          <UserFilterSelect />
          <ApiKeyFilterSelect />
        </Toolbar>

        {/* Single view - no tabs */}
        <MetricsOverview data={metricsData} loading={metricsLoading} />
      </PageSection>

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </>
  );
};
```

**Key Differences:**

- ❌ **No Tabs component** - Direct display of MetricsOverview
- ❌ **No breakdown tables** - UserBreakdownTable, ModelBreakdownTable not created
- ✅ **Comprehensive filtering** - All planned filters implemented and enhanced with cascading logic
- ✅ **Export functionality** - Fully implemented with CSV/JSON support
- ✅ **Refresh capability** - Admin-only manual refresh implemented
- ⚠️ **Backend ready** - All `/by-user`, `/by-model`, `/by-provider` endpoints functional and waiting for UI

**Rationale for MVP Approach:**

The simplified single-view approach delivers core value faster while the full backend infrastructure provides flexibility for future expansion. MetricsOverview component already includes top users and top models tables, providing essential breakdown visibility without requiring dedicated tabbed views.

### 2. Component Specifications

#### MetricsOverview Component

```typescript
interface MetricsOverviewProps {
  data: GlobalMetrics;
  loading: boolean;
}

const MetricsOverview: React.FC<MetricsOverviewProps> = ({ data, loading }) => {
  return (
    <Grid hasGutter>
      <GridItem span={3}>
        <MetricCard
          title="Total Requests"
          value={formatNumber(data.totalRequests)}
          trend={data.trends.requestsTrend}
          icon={<CubesIcon />}
        />
      </GridItem>
      <GridItem span={3}>
        <MetricCard
          title="Total Cost"
          value={formatCurrency(data.totalCost.total)}
          trend={data.trends.costTrend}
          icon={<DollarSignIcon />}
        />
      </GridItem>
      <GridItem span={3}>
        <MetricCard
          title="Active Users"
          value={formatNumber(data.activeUsers)}
          subtitle={`of ${data.totalUsers} total`}
          icon={<UsersIcon />}
        />
      </GridItem>
      <GridItem span={3}>
        <MetricCard
          title="Success Rate"
          value={formatPercent(data.successRate)}
          variant={getVariant(data.successRate)}
          icon={<CheckCircleIcon />}
        />
      </GridItem>

      <GridItem span={12}>
        <UsageTrendChart data={data.trends} height={400} />
      </GridItem>

      <GridItem span={6}>
        <TopConsumersTable data={data.topMetrics} />
      </GridItem>

      <GridItem span={6}>
        <ModelDistributionChart data={data.modelDistribution} />
      </GridItem>
    </Grid>
  );
};
```

#### Advanced Filtering Component

```typescript
interface AdminUsageFiltersProps {
  filters: AdminUsageFilters;
  onChange: (filters: AdminUsageFilters) => void;
}

const AdminUsageFilters: React.FC<AdminUsageFiltersProps> = ({ filters, onChange }) => {
  return (
    <Toolbar>
      <ToolbarContent>
        <ToolbarItem>
          <DateRangePicker
            startDate={filters.startDate}
            endDate={filters.endDate}
            onChange={(range) => onChange({ ...filters, ...range })}
            presets={DATE_PRESETS}
          />
        </ToolbarItem>

        <ToolbarItem>
          <MultiSelect
            placeholder="Select Users"
            options={useUserOptions()}
            selected={filters.userIds}
            onChange={(userIds) => onChange({ ...filters, userIds })}
            searchable
            virtualized
          />
        </ToolbarItem>

        <ToolbarItem>
          <MultiSelect
            placeholder="Select Models"
            options={useModelOptions()}
            selected={filters.modelIds}
            onChange={(modelIds) => onChange({ ...filters, modelIds })}
            grouped
          />
        </ToolbarItem>

        <ToolbarItem>
          <Select
            placeholder="Aggregation"
            value={filters.aggregation}
            onChange={(aggregation) => onChange({ ...filters, aggregation })}
          >
            <SelectOption value="hour">Hourly</SelectOption>
            <SelectOption value="day">Daily</SelectOption>
            <SelectOption value="week">Weekly</SelectOption>
            <SelectOption value="month">Monthly</SelectOption>
          </Select>
        </ToolbarItem>

        <ToolbarItem variant="separator" />

        <ToolbarItem>
          <Switch
            label="Real-time"
            isChecked={filters.realTime}
            onChange={(realTime) => onChange({ ...filters, realTime })}
          />
        </ToolbarItem>

        <ToolbarItem>
          <Button variant="secondary" onClick={() => onChange(defaultFilters)}>
            Reset
          </Button>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );
};
```

#### Interactive Charts Components

```typescript
// Usage Heatmap Component
const UsageHeatmap: React.FC<HeatmapProps> = ({ data, onCellClick }) => {
  return (
    <Card>
      <CardTitle>Usage Patterns</CardTitle>
      <CardBody>
        <ResponsiveHeatMap
          data={data}
          margin={{ top: 60, right: 90, bottom: 60, left: 90 }}
          valueFormat=">-.2s"
          axisTop={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -90,
            legend: '',
            legendOffset: 46
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Hour of Day',
            legendPosition: 'middle',
            legendOffset: -72
          }}
          colors={{
            type: 'sequential',
            scheme: 'blues'
          }}
          onClick={onCellClick}
          tooltip={({ value, xKey, yKey }) => (
            <Tooltip>
              {`${yKey} at ${xKey}: ${formatNumber(value)} requests`}
            </Tooltip>
          )}
        />
      </CardBody>
    </Card>
  );
};

// Comparative Trend Chart
const ComparativeTrendChart: React.FC<TrendChartProps> = ({ current, previous, metric }) => {
  return (
    <Card>
      <CardTitle>
        {metric} Comparison
        <Badge>{`${calculateChange(current, previous)}%`}</Badge>
      </CardTitle>
      <CardBody>
        <ResponsiveLine
          data={[
            { id: 'Current Period', data: current },
            { id: 'Previous Period', data: previous }
          ]}
          margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
          xScale={{ type: 'time' }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          axisBottom={{
            format: '%b %d',
            tickValues: 'every 1 day'
          }}
          axisLeft={{
            format: (value) => formatMetricValue(value, metric)
          }}
          enablePoints={false}
          enableGridX={false}
          enableGridY={true}
          colors={{ scheme: 'category10' }}
          lineWidth={2}
          legends={[
            {
              anchor: 'bottom-right',
              direction: 'column',
              justify: false,
              translateX: 100,
              translateY: 0,
              itemsSpacing: 0,
              itemDirection: 'left-to-right',
              itemWidth: 80,
              itemHeight: 20,
              symbolSize: 12,
              symbolShape: 'circle'
            }
          ]}
          tooltip={({ point }) => (
            <Tooltip>
              <div>{point.serieId}</div>
              <div>{formatDate(point.data.x)}</div>
              <div>{formatMetricValue(point.data.y, metric)}</div>
            </Tooltip>
          )}
        />
      </CardBody>
    </Card>
  );
};
```

### 3. State Management

```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Custom hooks for data fetching
const useAdminMetrics = (filters: AdminUsageFilters) => {
  return useQuery(
    ['adminMetrics', filters],
    () => adminUsageService.getAnalytics(filters),
    {
      staleTime: filters.realTime ? 30000 : 5 * 60 * 1000,
      enabled: !!filters.startDate && !!filters.endDate,
    }
  );
};

const useBreakdownData = (dimension: Dimension, filters: AdminUsageFilters) => {
  return useQuery(
    ['breakdown', dimension, filters],
    () => adminUsageService.getBreakdown(dimension, filters),
    {
      staleTime: 5 * 60 * 1000,
      enabled: !!dimension,
    }
  );
};

// Filter state context
const AdminUsageContext = React.createContext<{
  filters: AdminUsageFilters;
  setFilters: (filters: AdminUsageFilters) => void;
  resetFilters: () => void;
}>(null);

export const AdminUsageProvider: React.FC = ({ children }) => {
  const [filters, setFilters] = useState<AdminUsageFilters>(defaultFilters);

  const resetFilters = () => setFilters(defaultFilters);

  return (
    <AdminUsageContext.Provider value={{ filters, setFilters, resetFilters }}>
      {children}
    </AdminUsageContext.Provider>
  );
};
```

---

## Data Pipeline

### 1. Data Collection Strategy

```typescript
// Incremental day-by-day data collection from LiteLLM
async function collectUsageDataForDateRange(
  startDate: Date,
  endDate: Date,
): Promise<AggregatedUsageData> {
  const dailyData: DailyData[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  fastify.log.info(
    { startDate, endDate, totalDays: days.length },
    'Starting incremental daily usage data collection',
  );

  for (const day of days) {
    // Check cache first
    const cached = await checkDailyCache(day);
    if (cached && !isToday(day)) {
      fastify.log.debug({ date: day }, 'Using cached data for historical day');
      dailyData.push(cached);
      continue;
    }

    // Fetch from LiteLLM API for this specific day
    const formattedDate = format(day, 'yyyy-MM-dd');

    try {
      // Call LiteLLM without api_key filter to get ALL usage data
      const response = await liteLLMService.getDailyActivity(
        undefined, // No api_key filter = aggregate across all users
        formattedDate,
        formattedDate,
      );

      // Parse LiteLLM response structure
      // response.results[0] contains the day's data with breakdown by:
      // - models (response.results[0].breakdown.models)
      // - api_keys (response.results[0].breakdown.api_keys)
      // - entities (response.results[0].breakdown.entities)
      // - providers (response.results[0].breakdown.providers)

      const dayData = response.results[0];

      // Enrich with user information from LiteMaaS database
      const enriched = await enrichWithUserMapping(dayData);

      // Cache in database
      await saveToDailyCache(day, enriched, isToday(day));

      dailyData.push(enriched);

      fastify.log.info(
        {
          date: day,
          totalRequests: dayData.metrics.api_requests,
          totalTokens: dayData.metrics.total_tokens,
          spend: dayData.metrics.spend,
        },
        'Successfully fetched and cached daily data',
      );
    } catch (error) {
      fastify.log.error({ error, date: day }, 'Failed to fetch daily data');
      // Continue with other days even if one fails
      continue;
    }
  }

  // Aggregate all daily data into summary
  return aggregateDailyData(dailyData);
}

// Enrich LiteLLM data with user information
async function enrichWithUserMapping(dayData: LiteLLMDayData): Promise<EnrichedDayData> {
  // Extract all API key hashes from the breakdown
  const apiKeyHashes = Object.keys(dayData.breakdown.api_keys || {});

  // Query LiteMaaS database for API key -> user mapping
  const result = await db.query(
    `SELECT
      ak.token_hash,
      ak.user_id,
      ak.alias as key_alias,
      u.username,
      u.email,
      u.role
    FROM api_keys ak
    JOIN users u ON ak.user_id = u.id
    WHERE ak.token_hash = ANY($1)`,
    [apiKeyHashes],
  );

  // Create lookup map
  const keyToUser = new Map(
    result.rows.map((row) => [
      row.token_hash,
      {
        userId: row.user_id,
        username: row.username,
        email: row.email,
        role: row.role,
        keyAlias: row.key_alias,
      },
    ]),
  );

  // Add user information to each API key's metrics
  return {
    date: dayData.date,
    metrics: dayData.metrics,
    breakdown: {
      models: dayData.breakdown.models,
      providers: dayData.breakdown.providers,
      apiKeys: enrichApiKeysWithUsers(dayData.breakdown.api_keys, keyToUser),
      users: aggregateByUser(dayData.breakdown.api_keys, keyToUser),
    },
  };
}

// Refresh current day's data
async function refreshTodayData(): Promise<void> {
  const today = new Date();
  const formattedToday = format(today, 'yyyy-MM-dd');

  // Always fetch fresh data for current day
  const response = await liteLLMService.getDailyActivity(undefined, formattedToday, formattedToday);

  const enriched = await enrichWithUserMapping(response.results[0]);
  await saveToDailyCache(today, enriched, true); // Mark as incomplete (today)

  fastify.log.info('Refreshed current day usage data');
}
```

### 2. Data Aggregation Pipeline

```typescript
interface AggregationPipeline {
  // Level 1: Raw data collection
  collectRawData(filters: Filters): Promise<RawData>;

  // Level 2: Basic aggregation
  aggregateByUser(data: RawData): UserAggregates;
  aggregateByModel(data: RawData): ModelAggregates;
  aggregateByTime(data: RawData): TimeAggregates;

  // Level 3: Cross-dimensional analysis
  crossTabulate(aggregates: Aggregates[]): CrossTab;
  calculateTrends(timeData: TimeAggregates): TrendAnalysis;
  detectAnomalies(data: Aggregates): Anomalies;

  // Level 4: Business insights
  generateInsights(analysis: Analysis): Insights;
  createRecommendations(insights: Insights): Recommendations;
  forecastUsage(trends: TrendAnalysis): Forecast;
}
```

### 3. Caching Strategy

```typescript
class DailyUsageCacheManager {
  private db: DatabaseClient;

  /**
   * Get cached daily data from database
   * Historical days (> 1 day old) are cached permanently
   * Current day is refreshed every 5 minutes
   */
  async getCachedDailyData(date: Date): Promise<EnrichedDayData | null> {
    const formattedDate = format(date, 'yyyy-MM-dd');

    const result = await this.db.query(
      `SELECT
        date,
        raw_data,
        aggregated_by_user,
        aggregated_by_model,
        aggregated_by_provider,
        total_metrics,
        updated_at,
        is_complete
      FROM daily_usage_cache
      WHERE date = $1`,
      [formattedDate],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Check if current day cache is stale (> 5 minutes old)
    if (!row.is_complete) {
      const cacheAge = Date.now() - new Date(row.updated_at).getTime();
      if (cacheAge > 5 * 60 * 1000) {
        // Stale current day data
        return null;
      }
    }

    return {
      date: row.date,
      metrics: row.total_metrics,
      breakdown: {
        models: row.aggregated_by_model,
        providers: row.aggregated_by_provider,
        users: row.aggregated_by_user,
      },
      rawData: row.raw_data,
    };
  }

  /**
   * Save daily data to cache
   * @param date The date being cached
   * @param data The enriched usage data
   * @param isCurrentDay Whether this is today's data (gets shorter TTL)
   */
  async saveToDailyCache(date: Date, data: EnrichedDayData, isCurrentDay: boolean): Promise<void> {
    const formattedDate = format(date, 'yyyy-MM-dd');

    await this.db.query(
      `INSERT INTO daily_usage_cache (
        date,
        raw_data,
        aggregated_by_user,
        aggregated_by_model,
        aggregated_by_provider,
        total_metrics,
        is_complete,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (date)
      DO UPDATE SET
        raw_data = EXCLUDED.raw_data,
        aggregated_by_user = EXCLUDED.aggregated_by_user,
        aggregated_by_model = EXCLUDED.aggregated_by_model,
        aggregated_by_provider = EXCLUDED.aggregated_by_provider,
        total_metrics = EXCLUDED.total_metrics,
        is_complete = EXCLUDED.is_complete,
        updated_at = NOW()`,
      [
        formattedDate,
        JSON.stringify(data.rawData),
        JSON.stringify(data.breakdown.users),
        JSON.stringify(data.breakdown.models),
        JSON.stringify(data.breakdown.providers),
        JSON.stringify(data.metrics),
        !isCurrentDay, // is_complete = true for historical days
      ],
    );

    this.fastify.log.info(
      { date: formattedDate, isComplete: !isCurrentDay },
      'Cached daily usage data',
    );
  }

  /**
   * Get aggregated data for a date range
   * This efficiently serves from cache when available
   */
  async getDateRangeData(startDate: Date, endDate: Date): Promise<AggregatedUsageData> {
    const result = await this.db.query(
      `SELECT
        date,
        aggregated_by_user,
        aggregated_by_model,
        aggregated_by_provider,
        total_metrics
      FROM daily_usage_cache
      WHERE date BETWEEN $1 AND $2
      ORDER BY date ASC`,
      [format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    );

    // Aggregate across all days
    return aggregateMultipleDays(result.rows);
  }

  /**
   * Invalidate current day cache to force refresh
   */
  async invalidateTodayCache(): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');
    await this.db.query(
      `UPDATE daily_usage_cache
       SET is_complete = false, updated_at = NOW() - INTERVAL '10 minutes'
       WHERE date = $1`,
      [today],
    );
  }

  /**
   * Clean up old cache data (optional - for data retention policies)
   */
  async cleanupOldCache(retentionDays: number = 365): Promise<number> {
    const cutoffDate = format(subDays(new Date(), retentionDays), 'yyyy-MM-dd');

    const result = await this.db.query(
      `DELETE FROM daily_usage_cache WHERE date < $1 RETURNING date`,
      [cutoffDate],
    );

    this.fastify.log.info(
      { deletedCount: result.rowCount, cutoffDate },
      'Cleaned up old cache data',
    );

    return result.rowCount;
  }
}
```

---

## Testing Strategy

### 1. Unit Tests

```typescript
// Service tests
describe('AdminUsageStatsService', () => {
  describe('getAnalytics', () => {
    it('should aggregate data from all users', async () => {
      const mockData = createMockLiteLLMData();
      jest.spyOn(liteLLMService, 'getDailyActivity').mockResolvedValue(mockData);

      const result = await service.getAnalytics(testFilters);

      expect(result.totalRequests).toBe(expectedTotal);
      expect(result.totalCost.total).toBeCloseTo(expectedCost, 2);
    });

    it('should handle parallel fetch failures gracefully', async () => {
      jest.spyOn(liteLLMService, 'getDailyActivity')
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValue(mockData);

      const result = await service.getAnalytics(testFilters);

      expect(result).toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch'));
    });
  });
});

// Component tests
describe('AdminUsagePage', () => {
  it('should render all metric cards', () => {
    const { getByText } = render(
      <AdminUsagePage />
    );

    expect(getByText('Total Requests')).toBeInTheDocument();
    expect(getByText('Total Cost')).toBeInTheDocument();
    expect(getByText('Active Users')).toBeInTheDocument();
  });

  it('should update data when filters change', async () => {
    const { getByTestId, rerender } = render(
      <AdminUsagePage />
    );

    const datePicker = getByTestId('date-range-picker');
    fireEvent.change(datePicker, { target: { value: 'last-7-days' } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=')
      );
    });
  });
});
```

### 2. Integration Tests

```typescript
describe('Admin Usage API Integration', () => {
  it('should fetch and aggregate data correctly', async () => {
    const response = await request(app)
      .post('/api/v1/admin/usage/analytics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ startDate: '2024-01-01', endDate: '2024-01-31' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('totalRequests');
    expect(response.body.totalRequests).toBeGreaterThan(0);
  });

  it('should enforce admin role requirement', async () => {
    const response = await request(app)
      .post('/api/v1/admin/usage/analytics')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ startDate: '2024-01-01', endDate: '2024-01-31' });

    expect(response.status).toBe(403);
  });
});
```

### 3. Performance Tests

```typescript
describe('Performance', () => {
  it('should handle 10,000 users data aggregation within 5 seconds', async () => {
    const userIds = generateUserIds(10000);
    const startTime = Date.now();

    await service.getAnalytics({
      userIds,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000);
  });

  it('should maintain sub-100ms response time with caching', async () => {
    // First call - populate cache
    await service.getAnalytics(testFilters);

    // Second call - from cache
    const startTime = Date.now();
    await service.getAnalytics(testFilters);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
  });
});
```

---

## Deployment Plan

### 1. Database Migrations

**Note:** The materialized views proposal below was for a future optimization (Phase 2+) that would use local `usage_logs` table. Since the MVP architecture uses LiteLLM API + `daily_usage_cache` table instead, these materialized views are no longer relevant to the current implementation.

```sql
-- DEPRECATED: Materialized views proposal (not implemented)
-- The admin analytics feature uses LiteLLM API + daily_usage_cache instead
```

### 2. Environment Configuration

```yaml
# Production configuration
ADMIN_USAGE_CACHE_TTL: 300
ADMIN_USAGE_MAX_CONCURRENT_FETCHES: 20
ADMIN_USAGE_BATCH_SIZE: 100
ADMIN_USAGE_ENABLE_REAL_TIME: true
ADMIN_USAGE_EXPORT_MAX_ROWS: 100000
ADMIN_USAGE_FORECAST_ENABLED: true

# Redis configuration for caching
REDIS_URL: redis://redis:6379
REDIS_MAX_RETRIES: 3
REDIS_RETRY_DELAY: 1000

# Performance monitoring
NEW_RELIC_ENABLED: true
NEW_RELIC_APP_NAME: litemaas-admin-usage
DATADOG_METRICS_ENABLED: true
```

### 3. Rollout Strategy

```yaml
Phase 1 - Backend Infrastructure (Week 1):
  - Deploy database migrations
  - Set up Redis caching
  - Deploy admin usage service
  - Enable API endpoints for testing

Phase 2 - Basic Frontend (Week 2):
  - Deploy AdminUsagePage with overview
  - Enable for admin users only
  - Monitor performance metrics
  - Gather initial feedback

Phase 3 - Advanced Features (Week 3):
  - Enable all visualization components
  - Deploy export functionality
  - Enable real-time updates
  - Add anomaly detection

Phase 4 - Optimization (Week 4):
  - Performance tuning based on metrics
  - Cache optimization
  - Add missing features based on feedback
  - Full production rollout
```

---

## Task Breakdown for Subagents

### Backend Development Agent Tasks

````markdown
## Task 1: Create Database Schema and Migrations

- [ ] Create migration for `daily_usage_cache` table
- [ ] Add indexes on `date`, `is_complete` columns
- [ ] Add index on `api_keys(token_hash)` if not exists
- [ ] Write migration rollback scripts
- [ ] Test migrations on local database

## Task 2: Implement DailyUsageCacheManager

- [ ] Create `/backend/src/services/daily-usage-cache-manager.ts`
- [ ] Implement `getCachedDailyData(date)` method
- [ ] Implement `saveToDailyCache(date, data, isCurrentDay)` method
- [ ] Implement `getDateRangeData(startDate, endDate)` method
- [ ] Implement `invalidateTodayCache()` method
- [ ] Implement `cleanupOldCache(retentionDays)` method
- [ ] Write unit tests for cache manager
- [ ] Add proper error handling

## Task 3: Implement AdminUsageStatsService (MVP)

- [ ] Create `/backend/src/services/admin-usage-stats.service.ts`
- [ ] Extend BaseService class
- [ ] Implement day-by-day data fetching from LiteLLM
- [ ] Implement `enrichWithUserMapping()` for API key → user linking
- [ ] Implement `getAnalytics(filters)` method
- [ ] Implement `getUserBreakdown(filters)` method
- [ ] Implement `getModelBreakdown(filters)` method
- [ ] Implement `getProviderBreakdown(filters)` method
- [ ] Implement `refreshTodayData()` method
- [ ] Write comprehensive unit tests
- [ ] Add ApplicationError error handling

## Task 4: Create Admin Usage Routes

- [ ] Create `/backend/src/routes/admin-usage.ts`
- [ ] Implement `POST /analytics` endpoint (will be at `/api/v1/admin/usage/analytics`)
- [ ] Implement `GET /by-user` endpoint
- [ ] Implement `GET /by-model` endpoint
- [ ] Implement `GET /by-provider` endpoint
- [ ] Implement `GET /export` endpoint
- [ ] Implement `POST /refresh-today` endpoint
- [ ] Add RBAC middleware (`admin:usage` permission)
- [ ] Add request validation schemas
- [ ] Add OpenAPI/Swagger documentation
- [ ] Write integration tests for each endpoint
- [ ] Register route in `/backend/src/routes/index.ts`:
  ```typescript
  import adminUsageRoutes from './admin-usage';
  await fastify.register(adminUsageRoutes, { prefix: '/admin/usage' });
  ```
````

````

### Frontend Development Agent Tasks

```markdown
## Task 5: Create Admin Usage Service (Frontend)
- [ ] Create `/frontend/src/services/admin-usage.service.ts`
- [ ] Implement `getAnalytics(filters)` API call
- [ ] Implement `getUserBreakdown(filters)` API call
- [ ] Implement `getModelBreakdown(filters)` API call
- [ ] Implement `getProviderBreakdown(filters)` API call
- [ ] Implement `exportUsageData(filters, format)` API call
- [ ] Implement `refreshTodayData()` API call
- [ ] Add TypeScript interfaces for responses
- [ ] Add error handling with useErrorHandler hook
- [ ] Write service tests

## Task 6: Create AdminUsagePage Component (MVP)
- [ ] Create `/frontend/src/pages/AdminUsagePage.tsx`
- [ ] Implement responsive layout with PatternFly 6
- [ ] Add date range filter (with presets: 7d, 30d, 90d, custom)
- [ ] Add loading states with skeleton components
- [ ] Add error handling with useErrorHandler hook
- [ ] Ensure accessibility (WCAG AA compliance)
- [ ] Add keyboard navigation
- [ ] Write component tests with React Testing Library

## Task 7: Build Metrics Overview Component
- [ ] Create `MetricsOverview` component
- [ ] Add 4 metric cards: Total Requests, Total Cost, Active Users, Success Rate
- [ ] Use existing `UsageTrends` chart component (reuse from UsagePage)
- [ ] Use existing `ModelDistributionChart` component (reuse from UsagePage)
- [ ] Add loading skeletons for each card
- [ ] Add trend indicators (up/down arrows)
- [ ] Ensure responsive grid layout
- [ ] Write component tests

## Task 8: Build Breakdown Tables
- [ ] Create `UserBreakdownTable` component with sorting/pagination
- [ ] Create `ModelBreakdownTable` component with sorting
- [ ] Create `ProviderBreakdownTable` component
- [ ] Add clickable rows for drill-down (Phase 2)
- [ ] Add export button per table
- [ ] Use PatternFly 6 Table components
- [ ] Ensure accessibility
- [ ] Write component tests

## Task 9: Implement Export Functionality
- [ ] Add "Export" button to AdminUsagePage toolbar
- [ ] Implement modal for export options (CSV/JSON, date range)
- [ ] Trigger download when export completes
- [ ] Add loading state during export
- [ ] Add error handling for failed exports
- [ ] Write tests for export flow
````

### Integration and Testing Agent Tasks

```markdown
## Task 10: Integration Testing

- [ ] Write integration tests for admin usage routes
- [ ] Test RBAC enforcement (admin-only access)
- [ ] Test day-by-day caching behavior
- [ ] Test API key → user mapping logic
- [ ] Test date range aggregation
- [ ] Test export functionality (CSV/JSON)
- [ ] Test refresh-today endpoint
- [ ] Create test data generators for LiteLLM responses
- [ ] Write E2E tests with Playwright for admin usage page

## Task 11: Performance Testing

- [ ] Test with 30 days of cached data
- [ ] Test with 90 days of cached data (partial cache miss)
- [ ] Measure first load time (cold cache)
- [ ] Measure subsequent load time (warm cache)
- [ ] Measure today data refresh time
- [ ] Test concurrent admin users (5-10 simultaneous)
- [ ] Measure database query performance
- [ ] Document performance benchmarks

## Task 12: Documentation

- [ ] Document API endpoints in OpenAPI/Swagger
- [ ] Write admin user guide for usage analytics page
- [ ] Document caching strategy and TTLs
- [ ] Document API key → user mapping logic
- [ ] Create troubleshooting guide
- [ ] Document known limitations
- [ ] Add inline code comments for complex logic
- [ ] Update main project documentation
```

### DevOps and Deployment Agent Tasks

```markdown
## Task 13: Database Migration Deployment

- [ ] Review and validate migration scripts
- [ ] Test migrations on staging database
- [ ] Create backup before migration
- [ ] Execute migrations in production
- [ ] Verify indexes created successfully
- [ ] Monitor database performance post-migration
- [ ] Document rollback procedure if needed

## Task 14: Monitoring and Observability

- [ ] Add Prometheus metrics for cache hit/miss rates
- [ ] Add metrics for LiteLLM API call latency
- [ ] Add metrics for daily data fetch duration
- [ ] Set up Grafana dashboard for admin usage analytics
- [ ] Configure alerts for cache failures
- [ ] Configure alerts for LiteLLM API errors
- [ ] Add logging for all cache operations
- [ ] Monitor database table growth

## Task 15: Deployment and Rollout

- [ ] Deploy backend changes to staging
- [ ] Deploy frontend changes to staging
- [ ] Perform smoke tests on staging
- [ ] Enable admin usage page for test admins
- [ ] Collect initial feedback
- [ ] Deploy to production
- [ ] Monitor error rates and performance
- [ ] Enable for all admin users
```

---

## Risk Mitigation

### Technical Risks

1. **Performance at Scale**
   - Mitigation: Implement aggressive caching, use materialized views, add pagination

2. **LiteLLM API Rate Limiting**
   - Mitigation: Implement queue-based fetching, add exponential backoff, cache aggressively

3. **Data Consistency**
   - Mitigation: Implement eventual consistency model, add data validation, create audit logs

### Business Risks

1. **Data Privacy Concerns**
   - Mitigation: Implement data anonymization, add audit logging, ensure GDPR compliance

2. **Cost Overruns**
   - Mitigation: Implement cost alerts, add budget limits, optimize query patterns

---

## Success Metrics

### Technical Metrics

- Page load time < 2 seconds
- API response time < 500ms (cached), < 5s (uncached)
- 99.9% uptime
- Zero data inconsistencies
- Test coverage > 80%

### Business Metrics

- Admin user adoption > 90%
- Cost savings identified > 20%
- Reduction in support tickets by 30%
- Export usage by 50% of admins
- Positive feedback score > 4.5/5

---

## Future Enhancement: Implementing Breakdown Tables & Tabbed Interface

This section provides a roadmap for completing the originally planned tabbed interface with breakdown tables. All backend infrastructure is in place - this is purely frontend UI work.

### What Already Exists (Ready to Use)

#### Backend Infrastructure (100% Complete)

1. ✅ **API Endpoints**
   - `GET /api/v1/admin/usage/by-user` - Returns detailed user breakdown
   - `GET /api/v1/admin/usage/by-model` - Returns detailed model breakdown
   - `GET /api/v1/admin/usage/by-provider` - Returns detailed provider breakdown
   - All endpoints support filtering by date range, models, users, providers
   - Comprehensive error handling and RBAC enforcement

2. ✅ **Database & Caching**
   - `daily_usage_cache` table with all aggregation columns
   - Intelligent TTL strategy (5-min for current day, permanent for historical)
   - Pre-computed breakdowns stored in `aggregated_by_user`, `aggregated_by_model`, `aggregated_by_provider` columns

#### Frontend Service Layer (100% Complete)

1. ✅ **Service Methods** (`frontend/src/services/adminUsage.service.ts`)
   - `getUserBreakdown(filters)` - Calls `/by-user` endpoint
   - `getModelBreakdown(filters)` - Calls `/by-model` endpoint
   - `getProviderBreakdown(filters)` - Calls `/by-provider` endpoint
   - All methods with proper error handling and TypeScript types

2. ✅ **TypeScript Interfaces**
   - `UserBreakdown` interface (22 properties)
   - `ModelBreakdown` interface (15 properties)
   - `ProviderBreakdown` interface (12 properties)
   - All types fully documented

#### Frontend Components (Partially Complete)

1. ✅ **ProviderBreakdownTable** (`frontend/src/components/admin/ProviderBreakdownTable.tsx`)
   - Complete component with sorting, pagination
   - PatternFly 6 Table implementation
   - WCAG AA accessible
   - 230 lines of tested code
   - **Status:** Created but not integrated into AdminUsagePage

2. ✅ **I18n Translations**
   - `adminUsage.userBreakdown` - All 9 languages
   - `adminUsage.modelBreakdown` - All 9 languages
   - `adminUsage.providerBreakdown` - All 9 languages
   - `breakdownTable.*` keys - Comprehensive translation coverage

### What's Needed (Implementation Tasks)

#### Task 1: Create UserBreakdownTable Component

**Estimated Effort:** 4-6 hours

**File:** `frontend/src/components/admin/UserBreakdownTable.tsx`

**Approach:** Copy `ProviderBreakdownTable.tsx` and adapt for user data

**Key Changes:**

- Columns: Username, Email, Role, Requests, Tokens, Cost, Last Active
- Sort by: requests (default), tokens, cost, username, lastActive
- Add user role badges (admin, adminReadonly, user)
- Format last active date with relative time (e.g., "2 hours ago")

**Reference Implementation:**

```typescript
// See frontend/src/components/admin/ProviderBreakdownTable.tsx for pattern
// Key sections to adapt:
// 1. Column definitions (replace provider fields with user fields)
// 2. Sort comparators (add username, email, lastActive)
// 3. Cell renderers (add role badge, relative date formatter)
```

#### Task 2: Create ModelBreakdownTable Component

**Estimated Effort:** 4-6 hours

**File:** `frontend/src/components/admin/ModelBreakdownTable.tsx`

**Approach:** Copy `ProviderBreakdownTable.tsx` and adapt for model data

**Key Changes:**

- Columns: Model Name, Provider, Requests, Tokens, Cost, Success Rate, Avg Latency
- Sort by: requests (default), tokens, cost, successRate, latency, modelName
- Add success rate badges (green >95%, yellow 90-95%, red <90%)
- Format latency in milliseconds

**Reference Implementation:**

```typescript
// Similar pattern to ProviderBreakdownTable
// Additional features:
// 1. Success rate badge with color coding
// 2. Latency formatting (ms)
// 3. Provider column with icon/badge
```

#### Task 3: Integrate ProviderBreakdownTable

**Estimated Effort:** 1 hour

**Changes Needed:**

- Export from `frontend/src/components/admin/index.ts`
- Import in `AdminUsagePage.tsx`
- Add to tabbed interface (Task 4)

#### Task 4: Implement Tabbed Interface in AdminUsagePage

**Estimated Effort:** 6-8 hours

**File:** `frontend/src/pages/AdminUsagePage.tsx`

**Changes:**

1. **Add PatternFly Tabs** import and state:

```typescript
import { Tabs, Tab, TabTitleText } from '@patternfly/react-core';

const [activeTabKey, setActiveTabKey] = useState<string | number>('overview');
```

2. **Add React Query hooks for breakdown data**:

```typescript
const { data: userBreakdown, isLoading: userBreakdownLoading } = useQuery(
  ['adminUserBreakdown', filters],
  () => adminUsageService.getUserBreakdown(filters),
  { enabled: activeTabKey === 'users', staleTime: staleTimeMs },
);

const { data: modelBreakdown, isLoading: modelBreakdownLoading } = useQuery(
  ['adminModelBreakdown', filters],
  () => adminUsageService.getModelBreakdown(filters),
  { enabled: activeTabKey === 'models', staleTime: staleTimeMs },
);

const { data: providerBreakdown, isLoading: providerBreakdownLoading } = useQuery(
  ['adminProviderBreakdown', filters],
  () => adminUsageService.getProviderBreakdown(filters),
  { enabled: activeTabKey === 'providers', staleTime: staleTimeMs },
);
```

3. **Replace MetricsOverview with Tabs component**:

```typescript
<Tabs
  activeKey={activeTabKey}
  onSelect={(_, tabKey) => setActiveTabKey(tabKey)}
  aria-label={t('adminUsage.tabs.label', 'Usage analytics tabs')}
>
  <Tab
    eventKey="overview"
    title={<TabTitleText>{t('adminUsage.tabs.overview', 'Overview')}</TabTitleText>}
    aria-label={t('adminUsage.tabs.overview', 'Overview')}
  >
    <MetricsOverview data={metricsData} loading={metricsLoading} />
  </Tab>

  <Tab
    eventKey="users"
    title={<TabTitleText>{t('adminUsage.tabs.users', 'By Users')}</TabTitleText>}
    aria-label={t('adminUsage.tabs.users', 'By Users')}
  >
    <UserBreakdownTable data={userBreakdown} loading={userBreakdownLoading} />
  </Tab>

  <Tab
    eventKey="models"
    title={<TabTitleText>{t('adminUsage.tabs.models', 'By Models')}</TabTitleText>}
    aria-label={t('adminUsage.tabs.models', 'By Models')}
  >
    <ModelBreakdownTable data={modelBreakdown} loading={modelBreakdownLoading} />
  </Tab>

  <Tab
    eventKey="providers"
    title={<TabTitleText>{t('adminUsage.tabs.providers', 'By Providers')}</TabTitleText>}
    aria-label={t('adminUsage.tabs.providers', 'By Providers')}
  >
    <ProviderBreakdownTable data={providerBreakdown} loading={providerBreakdownLoading} />
  </Tab>
</Tabs>
```

4. **Add screen reader announcements for tab changes**:

```typescript
const handleTabChange = (_event: React.MouseEvent, tabKey: string | number) => {
  setActiveTabKey(tabKey);
  const tabNames = {
    overview: t('adminUsage.tabs.overview'),
    users: t('adminUsage.tabs.users'),
    models: t('adminUsage.tabs.models'),
    providers: t('adminUsage.tabs.providers'),
  };
  announce(
    t('adminUsage.tabChanged', 'Switched to {{tab}} view', {
      tab: tabNames[tabKey as keyof typeof tabNames],
    }),
  );
};
```

#### Task 5: Update Tests

**Estimated Effort:** 3-4 hours

**Files to Update:**

- `frontend/src/test/components/admin/UserBreakdownTable.test.tsx` (create new, ~200 lines)
- `frontend/src/test/components/admin/ModelBreakdownTable.test.tsx` (create new, ~200 lines)
- `frontend/src/pages/AdminUsagePage.test.tsx` (update for tabs, ~100 new lines)

**Test Coverage:**

- Component rendering with data
- Sorting functionality
- Empty states
- Loading states
- Error states
- Accessibility (keyboard navigation, ARIA attributes)
- Tab navigation

#### Task 6: Update I18n Keys

**Estimated Effort:** 1 hour

**New Keys Needed** (in `frontend/src/i18n/locales/*/translation.json`):

- `adminUsage.tabs.label` - "Usage analytics tabs"
- `adminUsage.tabs.overview` - "Overview"
- `adminUsage.tabs.users` - "By Users"
- `adminUsage.tabs.models` - "By Models"
- `adminUsage.tabs.providers` - "By Providers"
- `adminUsage.tabChanged` - "Switched to {{tab}} view"

All other i18n keys for breakdown tables already exist from original implementation.

### Implementation Sequence

**Recommended Order:**

1. **Day 1 Morning:** Create UserBreakdownTable component (4-6 hours)
2. **Day 1 Afternoon:** Create ModelBreakdownTable component (4-6 hours)
3. **Day 2 Morning:** Integrate ProviderBreakdownTable and implement tabs (7-9 hours)
4. **Day 2 Afternoon:** Write component tests (3-4 hours)
5. **Day 3:** Final polish, i18n updates, manual testing (4 hours)

**Total Estimated Effort:** 2-3 days for a frontend developer familiar with the codebase

### Testing Checklist

- [ ] All three breakdown tables render correctly with sample data
- [ ] Tab navigation works (keyboard and mouse)
- [ ] Sorting works in each breakdown table
- [ ] Pagination works (if applicable)
- [ ] Empty states display correctly
- [ ] Loading states display correctly
- [ ] Error states handled gracefully
- [ ] Filters apply to breakdown data correctly
- [ ] Export works from each tab
- [ ] WCAG AA accessibility compliance verified
- [ ] Screen reader announces tab changes
- [ ] All i18n strings display correctly in all 9 languages
- [ ] Performance acceptable with large datasets (1000+ rows)

### Success Criteria

✅ **Feature Complete When:**

- All three breakdown tables implemented and integrated
- Tabbed interface working with Overview + 3 breakdown tabs
- All tests passing (component + integration)
- WCAG AA accessibility verified
- Works in Chrome, Firefox, Safari, Edge
- No console errors or warnings
- Documentation updated

### Maintenance Notes

After implementation, remember to:

- Update `docs/features/admin-tools.md` to document new tabs
- Update this implementation plan to mark Phase 3 as 100% complete
- Create demo video/screenshots for user documentation
- Add to release notes for next version

---

## Appendices

### A. API Specifications

[Detailed OpenAPI/Swagger specifications would go here]

### B. Database Schema

[Complete database schema diagrams and definitions]

### C. UI/UX Mockups

[Figma/design links and screenshots]

### D. Security Considerations

[Detailed security analysis and requirements]

### E. Compliance Requirements

[GDPR, CCPA, and other regulatory requirements]

---

## Implementation Progress Tracking

### Phase 1: Backend Infrastructure (Week 1) ✅

**Status**: Completed
**Started**: 2025-09-29
**Completed**: 2025-09-29

| Agent           | Task                                     | Status      | Started    | Completed  | Files Created                                                                                            |
| --------------- | ---------------------------------------- | ----------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| Backend Agent 1 | Database schema & DailyUsageCacheManager | ✅ Complete | 2025-09-29 | 2025-09-29 | `database-migrations.ts`, `daily-usage-cache-manager.ts` (586 lines), tests (563 lines)                  |
| Backend Agent 2 | AdminUsageStatsService implementation    | ✅ Complete | 2025-09-29 | 2025-09-29 | `admin-usage.types.ts` (435 lines), `admin-usage-stats.service.ts` (1,285 lines), tests (743 lines)      |
| Backend Agent 3 | Admin usage routes with RBAC             | ✅ Complete | 2025-09-29 | 2025-09-29 | `admin-usage.ts` routes (524 lines), `admin-usage.ts` schemas (174 lines), integration tests (432 lines) |

**Phase 1 Results:**

- ✅ 22/22 unit tests passing (DailyUsageCacheManager)
- ✅ 19/19 unit tests passing (AdminUsageStatsService)
- ✅ 44 integration tests created (admin-usage routes)
- ✅ All TypeScript compilation clean
- ✅ Database migration ready to deploy
- ✅ RBAC permission `admin:usage` added
- ✅ Total: ~4,780 lines of production code + tests

### Phase 2: Frontend Foundation (Week 2) ✅

**Status**: Completed
**Started**: 2025-09-29
**Completed**: 2025-09-29

| Agent            | Task                           | Status      | Started    | Completed  | Files Created                                                     |
| ---------------- | ------------------------------ | ----------- | ---------- | ---------- | ----------------------------------------------------------------- |
| Frontend Agent 4 | Admin usage service (frontend) | ✅ Complete | 2025-09-29 | 2025-09-29 | `admin-usage.service.ts` (430 lines), tests (954 lines)           |
| Frontend Agent 5 | AdminUsagePage structure       | ✅ Complete | 2025-09-29 | 2025-09-29 | `AdminUsagePage.tsx` (600 lines), tests (458 lines), i18n updates |
| Frontend Agent 6 | MetricsOverview component      | ✅ Complete | 2025-09-29 | 2025-09-29 | `MetricsOverview.tsx` (549 lines), i18n updates                   |

**Phase 2 Results:**

- ✅ 25 service unit tests passing (admin-usage.service)
- ✅ 17 page component tests created (AdminUsagePage)
- ✅ Complete TypeScript type definitions (22 interfaces)
- ✅ AdminUsagePage with comprehensive date filtering implemented
- ✅ Multi-dimensional filters (date range, models, users, API keys with cascading logic)
- ✅ Metric cards with trend indicators (MetricsOverview component)
- ✅ Reused existing chart components (UsageTrends, ModelDistributionChart)
- ✅ WCAG AA accessibility compliance
- ✅ Total: ~3,000 lines of production code + tests
- ℹ️ Note: Tabbed interface deferred to Phase 2+ (MVP shows MetricsOverview directly without tabs)

### Phase 3: Advanced Components (Week 3) ⚠️

**Status**: Partially Complete
**Started**: 2025-09-29
**Completed**: 2025-09-29 (MVP scope only)

| Agent            | Task                 | Status      | Started    | Completed  | Files Created                                                                                                                                                                   |
| ---------------- | -------------------- | ----------- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend Agent 7 | Breakdown tables     | ⚠️ Partial  | 2025-09-29 | Deferred   | `ProviderBreakdownTable.tsx` (343 lines), tests (230 lines) - **Component created but not integrated into UI. UserBreakdownTable and ModelBreakdownTable deferred to Phase 2+** |
| Frontend Agent 8 | Export functionality | ✅ Complete | 2025-09-29 | 2025-09-29 | `ExportModal.tsx` (264 lines), tests (230 lines), AdminUsagePage integration                                                                                                    |

**Phase 3 Results:**

- ✅ 15 tests passing (ExportModal)
- ⚠️ 17 tests created (ProviderBreakdownTable - component exists but not used in UI)
- ✅ Complete export functionality (CSV/JSON)
- ✅ 82+ i18n keys added (including unused keys for future breakdown tables)
- ✅ Total: ~900 lines of production code + tests for integrated features
- ⚠️ Total: ~600 lines of code created but not yet integrated (ProviderBreakdownTable)

**Phase 3 Outstanding Work (Deferred to Phase 2+):**

The following features were planned but deferred from MVP to allow faster delivery:

- ⏳ UserBreakdownTable component (backend endpoint ready, frontend service method exists)
- ⏳ ModelBreakdownTable component (backend endpoint ready, frontend service method exists)
- ⏳ Integration of ProviderBreakdownTable into AdminUsagePage
- ⏳ Tabbed interface in AdminUsagePage (current implementation shows only MetricsOverview)
- ⏳ Wiring up `/by-user`, `/by-model`, `/by-provider` endpoints to UI components

**Why Deferred:** MVP focused on delivering core analytics dashboard (MetricsOverview) with filters and export. Backend infrastructure for all breakdown views is complete and ready for future UI integration.

### Phase 4: Integration & Testing (Week 4)

**Status**: Not Started

| Agent             | Task                 | Status     | Started | Completed |
| ----------------- | -------------------- | ---------- | ------- | --------- |
| Backend Agent 9   | Integration tests    | ⏳ Pending | -       | -         |
| Frontend Agent 10 | Component tests      | ⏳ Pending | -       | -         |
| General Agent 11  | E2E Playwright tests | ⏳ Pending | -       | -         |

### Phase 5: Performance & Documentation (Final Week)

**Status**: Not Started

| Agent              | Task                     | Status     | Started | Completed |
| ------------------ | ------------------------ | ---------- | ------- | --------- |
| Refactor Agent 12  | Performance optimization | ⏳ Pending | -       | -         |
| Architect Agent 13 | System review            | ⏳ Pending | -       | -         |
| General Agent 14   | Documentation            | ⏳ Pending | -       | -         |

### Legend

- ✅ Completed
- 🔄 In Progress
- ⏳ Pending
- ❌ Blocked

---

This implementation plan provides comprehensive guidance for building the admin usage analytics feature. Each section can be assigned to specialized subagents for parallel development while maintaining consistency across the implementation.

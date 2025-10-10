# Phase 4: Code Quality & Maintainability

**Phase**: 4 - Code Quality & Maintainability
**Duration**: 8-12 hours
**Priority**: 🟢 LOW-MEDIUM
**Issues**: #11 - TypeScript any Usage, #12 - Missing JSDoc, #13 - Accessibility, #14 - Console Cleanup, #15 - React Query Optimization

---

## Navigation

- **Previous Phase**: [Phase 3: Architecture & Reliability](./phase-3-architecture-reliability.md)
- **Next Phase**: [Phase 5: Performance & Observability](./phase-5-session-5a-database-optimization.md)
- **Parent Document**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

### Phase Overview

Phase 4 focuses on professional polish and code quality improvements that enhance maintainability, developer experience, and accessibility. These improvements are not blocking for production but are important for long-term code health and team productivity.

This phase addresses five distinct issues:

1. **TypeScript type safety** - Replace `any` with proper types
2. **Documentation** - Add JSDoc comments to complex functions
3. **Accessibility** - Improve screen reader support and keyboard navigation
4. **Debug cleanup** - Remove console statements
5. **Query optimization** - Improve React Query patterns

### Prerequisites

Before starting Phase 4, ensure:

- ✅ Phase 1 (Critical Blocking Issues) completed
- ✅ Phase 2 (Operational Safeguards) completed
- ✅ Phase 3 (Architecture & Reliability) completed
- ✅ All tests passing
- ✅ Code deployed to staging for validation

### Related Documentation

- [Pattern Reference](../pattern-reference.md) - Established code patterns
- [Backend CLAUDE.md](../../backend/CLAUDE.md) - Backend architecture
- [Frontend CLAUDE.md](../../frontend/CLAUDE.md) - Frontend architecture
- [Chart Components Guide](../chart-components-guide.md) - Chart patterns

---

## Phase 4 Summary

**Total Duration**: 8-12 hours
**Issues Addressed**: 5 code quality issues
**Impact**: Medium - Improves maintainability and developer experience
**Breaking Changes**: None

**Success Metrics**:

- Zero `any` types in admin analytics code
- All public functions documented with JSDoc
- All interactive elements keyboard accessible
- Zero console statements in production code
- React Query patterns optimized

---

## Phase 4 Objectives

### Primary Goals

1. **Type Safety**: Eliminate all `any` usage with proper TypeScript types
2. **Documentation**: Add comprehensive JSDoc to complex functions
3. **Accessibility**: Ensure WCAG 2.1 AA compliance
4. **Code Cleanliness**: Remove all debug console statements
5. **Performance**: Optimize React Query configurations

### Deliverables

- [ ] TypeScript strict mode enabled for admin analytics files
- [ ] JSDoc added to all public service methods
- [ ] ARIA labels and keyboard navigation working
- [ ] Console statement audit complete
- [ ] React Query staleTime and cacheTime optimized

### Non-Goals

- Refactoring existing logic (already done in Phase 1)
- Adding new features
- Changing API contracts
- Performance optimization (covered in Phase 5)

---

## Implementation Steps

### Issue #11: TypeScript any Usage

**Duration**: 3-4 hours
**Priority**: Medium
**Impact**: Improves type safety and IDE support

#### Context

The current codebase uses `any` in several locations, weakening TypeScript's type checking and reducing IDE autocomplete effectiveness. This task replaces all `any` with proper types.

#### Pre-Work Checklist

- [ ] Search for all `any` usage in admin analytics code
- [ ] Review TypeScript utility types documentation
- [ ] Plan generic type signatures for complex functions
- [ ] Prepare type definitions for external library inputs

#### Step 11.1: Audit any Usage (30 minutes)

**Search for all `any` types**:

```bash
# Backend any usage
grep -rn ":\s*any" backend/src/services/admin-usage/
grep -rn "as any" backend/src/services/admin-usage/

# Frontend any usage
grep -rn ":\s*any" frontend/src/pages/AdminUsagePage.tsx
grep -rn ":\s*any" frontend/src/components/charts/
grep -rn "as any" frontend/src/components/charts/
```

**Document findings**:

```markdown
### any Usage Audit Results

**Backend** (backend/src/services/admin-usage/):

- admin-usage-stats.service.ts:
  - Line 245: `private processRawData(data: any): ProcessedData`
  - Line 512: `private enrichData(row: any): EnrichedRow`
  - Line 789: `const result = JSON.parse(jsonData) as any;`

- admin-usage-enrichment.service.ts:
  - Line 123: `keyGenerator: (request: any) => string`
  - Line 267: `private mapAPIKeyData(data: any[]): Map<string, APIKeyInfo>`

**Frontend** (frontend/src/):

- pages/AdminUsagePage.tsx:
  - Line 89: `const handleFilterChange = (key: string, value: any) => {`
  - Line 234: `const chartData: any = transformData(rawData);`

- components/charts/UsageTrends.tsx:
  - Line 45: `private containerRef = React.useCallback((element: any) => {`
  - Line 123: `const tooltip: any = { ... };`

**Total**: 9 instances to fix
```

---

#### Step 11.2: Create Missing Type Definitions (1 hour)

**Files to Create/Modify**:

- `backend/src/types/admin-usage.types.ts`
- `frontend/src/types/admin-usage.types.ts`

**Backend Type Additions**:

```typescript
// backend/src/types/admin-usage.types.ts

/**
 * Raw usage data from LiteLLM API before processing
 */
export interface RawUsageData {
  api_key: string;
  model: string;
  user: string | null;
  request_id: string;
  startTime: string;
  endTime: string;
  response_cost: number | null;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  metadata?: Record<string, unknown>;
}

/**
 * Processed usage data after transformation
 */
export interface ProcessedUsageData {
  apiKey: string;
  model: string;
  userId: string | null;
  requestId: string;
  startTime: Date;
  endTime: Date;
  cost: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  metadata: Record<string, unknown>;
}

/**
 * Enriched row with user and API key information
 */
export interface EnrichedUsageRow extends ProcessedUsageData {
  username: string;
  email: string | null;
  role: UserRole;
  apiKeyAlias: string;
}

/**
 * API key information from database
 */
export interface APIKeyInfo {
  keyHash: string;
  userId: string;
  keyAlias: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Request with user context for rate limiting
 */
export interface AuthenticatedRequest {
  user?: {
    userId: string;
    username: string;
    role: UserRole;
  };
  ip: string;
  headers: Record<string, string>;
}

/**
 * Generic key generator function for rate limiting
 */
export type RateLimitKeyGenerator = (request: AuthenticatedRequest) => string;
```

**Frontend Type Additions**:

```typescript
// frontend/src/types/admin-usage.types.ts

/**
 * Chart data for usage trends
 */
export interface UsageTrendChartData {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

/**
 * Chart tooltip configuration
 */
export interface ChartTooltipConfig {
  enabled: boolean;
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
  cursor?: boolean;
}

/**
 * Generic filter change handler
 */
export type FilterChangeHandler<T = string | number | boolean> = (key: string, value: T) => void;

/**
 * Ref callback for container elements
 */
export type ContainerRefCallback = (element: HTMLDivElement | null) => void;
```

---

#### Step 11.3: Replace any with Proper Types (1.5 hours)

**Backend Replacements**:

```typescript
// ❌ Before
private processRawData(data: any): ProcessedData {
  return {
    apiKey: data.api_key,
    model: data.model,
    // ...
  };
}

// ✅ After
private processRawData(data: RawUsageData): ProcessedUsageData {
  return {
    apiKey: data.api_key,
    model: data.model,
    userId: data.user,
    requestId: data.request_id,
    startTime: parseISO(data.startTime),
    endTime: parseISO(data.endTime),
    cost: data.response_cost ?? 0,
    totalTokens: data.total_tokens,
    promptTokens: data.prompt_tokens,
    completionTokens: data.completion_tokens,
    metadata: data.metadata ?? {},
  };
}

// ❌ Before
private enrichData(row: any): EnrichedRow {
  return { ...row, username: 'unknown' };
}

// ✅ After
private enrichData(row: ProcessedUsageData): EnrichedUsageRow {
  return {
    ...row,
    username: 'Unknown User',
    email: null,
    role: 'user',
    apiKeyAlias: 'Unknown Key',
  };
}

// ❌ Before
keyGenerator: (request: any) => request.user?.userId || request.ip

// ✅ After
keyGenerator: (request: AuthenticatedRequest): string =>
  request.user?.userId || request.ip
```

**Frontend Replacements**:

```typescript
// ❌ Before
const handleFilterChange = (key: string, value: any) => {
  setFilters(prev => ({ ...prev, [key]: value }));
};

// ✅ After
const handleFilterChange: FilterChangeHandler = (key, value) => {
  setFilters(prev => ({ ...prev, [key]: value }));
};

// ❌ Before
const chartData: any = transformData(rawData);

// ✅ After
const chartData: UsageTrendChartData[] = transformData(rawData);

// ❌ Before
private containerRef = React.useCallback((element: any) => {
  if (element) {
    // ...
  }
}, []);

// ✅ After
private containerRef: ContainerRefCallback = React.useCallback((element) => {
  if (element) {
    // ...
  }
}, []);

// ❌ Before
const tooltip: any = {
  enabled: true,
  formatter: (value: any) => value.toString(),
};

// ✅ After
const tooltip: ChartTooltipConfig = {
  enabled: true,
  formatter: (value: number, name: string) => `${name}: ${value}`,
};
```

---

#### Step 11.4: Enable Strict Mode (30 minutes)

**Files to Modify**:

- `backend/tsconfig.json`
- `frontend/tsconfig.json`

**Add strict type checking for admin analytics**:

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  },
  "include": ["src/services/admin-usage/**/*", "src/routes/admin-usage.ts"]
}
```

**Fix any strict mode errors**:

```bash
# Compile and check for errors
npm --prefix backend run build

# Fix any errors that appear
# Common issues:
# - Null checks needed: use `value ?? defaultValue`
# - Optional chaining: use `object?.property`
# - Type assertions: replace with proper type guards
```

---

#### Step 11.5: Add Tests (30 minutes)

**Create type safety tests**:

```typescript
// backend/tests/unit/types/admin-usage-types.test.ts

import type {
  RawUsageData,
  ProcessedUsageData,
  EnrichedUsageRow,
} from '../../../src/types/admin-usage.types';

describe('Admin Usage Type Safety', () => {
  describe('RawUsageData', () => {
    it('should accept valid raw data structure', () => {
      const rawData: RawUsageData = {
        api_key: 'key123',
        model: 'gpt-4',
        user: 'user-id',
        request_id: 'req-123',
        startTime: '2025-01-15T10:00:00Z',
        endTime: '2025-01-15T10:00:05Z',
        response_cost: 0.05,
        total_tokens: 1000,
        prompt_tokens: 800,
        completion_tokens: 200,
      };

      expect(rawData.api_key).toBe('key123');
    });

    it('should allow null user', () => {
      const rawData: RawUsageData = {
        api_key: 'key123',
        model: 'gpt-4',
        user: null, // Should be allowed
        request_id: 'req-123',
        startTime: '2025-01-15T10:00:00Z',
        endTime: '2025-01-15T10:00:05Z',
        response_cost: null, // Should be allowed
        total_tokens: 1000,
        prompt_tokens: 800,
        completion_tokens: 200,
      };

      expect(rawData.user).toBeNull();
    });
  });

  describe('ProcessedUsageData', () => {
    it('should have Date objects for timestamps', () => {
      const processed: ProcessedUsageData = {
        apiKey: 'key123',
        model: 'gpt-4',
        userId: 'user-id',
        requestId: 'req-123',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T10:00:05Z'),
        cost: 0.05,
        totalTokens: 1000,
        promptTokens: 800,
        completionTokens: 200,
        metadata: {},
      };

      expect(processed.startTime).toBeInstanceOf(Date);
    });
  });
});
```

---

#### Issue #11 Deliverables

- [ ] All `any` types replaced with proper types
- [ ] New type definitions added to type files
- [ ] Strict mode enabled for admin analytics
- [ ] Type safety tests added
- [ ] No TypeScript errors in build

#### Issue #11 Acceptance Criteria

- [ ] Zero `any` usage in admin analytics code (search returns 0 results)
- [ ] `npm run build` completes without TypeScript errors
- [ ] IDE autocomplete works for all admin analytics types
- [ ] Type safety tests pass
- [ ] No regression in functionality

---

### Issue #12: Missing JSDoc Documentation

**Duration**: 2-3 hours
**Priority**: Medium
**Impact**: Improves code understanding and IDE tooltips

#### Context

Complex service methods lack documentation, making them harder to understand and maintain. This task adds comprehensive JSDoc comments to all public methods.

#### Pre-Work Checklist

- [ ] Review JSDoc standards and best practices
- [ ] Identify all public methods without documentation
- [ ] Review complex logic requiring explanation
- [ ] Prepare JSDoc templates for common patterns

#### Step 12.1: Identify Undocumented Methods (20 minutes)

**Create audit script**:

```bash
#!/bin/bash
# audit-jsdoc.sh

echo "=== Methods without JSDoc ==="

# Find public methods without JSDoc comment immediately above
find backend/src/services/admin-usage -name "*.ts" -exec grep -B1 "^\s*public\|^\s*async" {} \; | \
  grep -v "^\s*/\*\*" | \
  grep -v "^\s*\*" | \
  grep "public\|async"

echo "=== Exported functions without JSDoc ==="

find backend/src/services/admin-usage -name "*.ts" -exec grep -B1 "^export\s\+function\|^export\s\+async\s\+function" {} \; | \
  grep -v "^\s*/\*\*" | \
  grep "export function"
```

---

#### Step 12.2: Create JSDoc Templates (30 minutes)

**Standard templates for common patterns**:

````typescript
/**
 * Service method template
 *
 * Brief description of what the method does.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ApplicationError} When specific error condition occurs
 *
 * @example
 * ```typescript
 * const result = await service.methodName(param);
 * ```
 */

/**
 * Complex calculation template
 *
 * Brief description of calculation purpose.
 *
 * Algorithm:
 * 1. Step 1 description
 * 2. Step 2 description
 * 3. Step 3 description
 *
 * @param input - Input data structure
 * @returns Calculated result
 *
 * @remarks
 * Additional context about edge cases or performance considerations.
 */

/**
 * Data transformation template
 *
 * Transforms data from format A to format B.
 *
 * @param source - Source data in format A
 * @returns Transformed data in format B
 *
 * @see {@link RelatedType} for output structure
 * @internal This method is used internally and not exposed via API
 */
````

---

#### Step 12.3: Document Service Methods (1-1.5 hours)

**Example: AdminUsageAggregationService**:

````typescript
/**
 * Service for aggregating usage data by different dimensions
 *
 * This service handles complex JSONB aggregations from the daily usage cache,
 * grouping usage metrics by user, model, or provider. All aggregations
 * respect date range filters and handle missing data gracefully.
 *
 * @remarks
 * Aggregation logic uses PostgreSQL JSONB functions for efficiency.
 * Large date ranges (>30 days) may take several seconds to process.
 */
export class AdminUsageAggregationService extends BaseService {
  /**
   * Aggregate usage data by user
   *
   * Groups all usage metrics by user ID and enriches with user information.
   * Returns sorted results with top users by total cost.
   *
   * @param filters - Date range and optional filters
   * @returns Array of user breakdown data, sorted by total cost descending
   * @throws {ApplicationError} If date range is invalid or database query fails
   *
   * @example
   * ```typescript
   * const breakdown = await aggregationService.aggregateByUser({
   *   startDate: '2025-01-01',
   *   endDate: '2025-01-31',
   * });
   * ```
   */
  async aggregateByUser(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    // Implementation
  }

  /**
   * Calculate comparison period for trend analysis
   *
   * Given a date range, calculates the equivalent previous period.
   * Used for showing percentage changes in analytics.
   *
   * Algorithm:
   * 1. Calculate length of requested period in days
   * 2. Find end of comparison period (day before start of requested)
   * 3. Calculate start of comparison period (same length backward)
   *
   * @param startDate - Start date of requested period (YYYY-MM-DD)
   * @param endDate - End date of requested period (YYYY-MM-DD)
   * @returns Comparison period dates and length in days
   *
   * @example
   * ```typescript
   * const comparison = calculateComparisonPeriod('2025-01-15', '2025-01-21');
   * // Returns: { comparisonStartDate: '2025-01-08', comparisonEndDate: '2025-01-14', days: 7 }
   * ```
   */
  private calculateComparisonPeriod(startDate: string, endDate: string): ComparisonPeriod {
    // Implementation
  }

  /**
   * Enrich aggregated data with user information
   *
   * Performs batch lookup of user data and merges with aggregated usage metrics.
   * Handles missing users by creating placeholder entries.
   *
   * @param aggregated - Aggregated usage data by API key
   * @returns Enriched data with user information
   * @throws {ApplicationError} If database lookup fails
   *
   * @remarks
   * Uses batch queries to avoid N+1 problem.
   * Missing users are shown as "Unknown User" with placeholder ID.
   *
   * @internal
   */
  private async enrichWithUserData(
    aggregated: Map<string, UsageData>,
  ): Promise<EnrichedUsageData[]> {
    // Implementation
  }
}
````

**Example: Frontend Components**:

````typescript
/**
 * Usage trends chart component
 *
 * Displays time-series chart of usage metrics (requests, tokens, cost)
 * with responsive container sizing and interactive tooltips.
 *
 * Features:
 * - Automatic container width detection via ResizeObserver
 * - Color-coded metrics matching PatternFly theme
 * - Accessible data table for screen readers
 *
 * @param props - Component props
 * @returns Rendered chart component
 *
 * @example
 * ```tsx
 * <UsageTrends
 *   data={trendsData}
 *   height={300}
 *   showLegend={true}
 * />
 * ```
 */
export const UsageTrends: React.FC<UsageTrendsProps> = ({
  data,
  height = 300,
  showLegend = true,
}) => {
  // Implementation
};

/**
 * Custom hook for managing filter state
 *
 * Provides filter state management with URL persistence
 * and validation logic.
 *
 * @param initialFilters - Initial filter values
 * @returns Filter state and update handlers
 *
 * @example
 * ```tsx
 * const { filters, updateFilter, resetFilters } = useFilters({
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31',
 * });
 * ```
 */
export function useFilters(initialFilters: AdminUsageFilters) {
  // Implementation
}
````

---

#### Step 12.4: Add Algorithm Documentation (30 minutes)

**For complex calculations, add detailed algorithm docs**:

````typescript
/**
 * Calculate trend metrics with percentage changes
 *
 * Compares current period metrics against comparison period to calculate
 * trends. Uses stability threshold to avoid noise from small changes.
 *
 * Algorithm:
 * 1. Calculate percentage change: ((current - previous) / previous) * 100
 * 2. Apply stability threshold (1%):
 *    - If |change| < 1%, mark as "stable"
 *    - Otherwise, mark as "up" or "down"
 * 3. Handle edge cases:
 *    - previous = 0: Return 100% if current > 0, else 0%
 *    - current = 0, previous > 0: Return -100%
 * 4. Aggregate all metrics into trend object
 *
 * @param current - Current period metrics
 * @param previous - Comparison period metrics
 * @returns Trend data with percentage changes and directions
 *
 * @remarks
 * The 1% stability threshold prevents showing trends for insignificant changes.
 * This threshold is configurable via `TREND_STABILITY_THRESHOLD` constant.
 *
 * @example
 * ```typescript
 * const trend = calculateTrend(
 *   { requests: 150, tokens: 75000, cost: 1.50 },
 *   { requests: 100, tokens: 50000, cost: 1.00 }
 * );
 * // Returns: { requests: { change: 50%, direction: 'up' }, ... }
 * ```
 */
private calculateTrend(
  current: MetricsSummary,
  previous: MetricsSummary
): TrendData {
  // Implementation
}
````

---

#### Step 12.5: Validate Documentation (20 minutes)

**Generate and review documentation**:

```bash
# Generate TypeDoc documentation
npm --prefix backend run docs:generate

# Review generated docs
open backend/docs/index.html

# Check for warnings
# - Missing @param tags
# - Missing @returns tags
# - Broken @see links
```

**Fix any documentation warnings**:

```typescript
// ❌ Warning: Missing @returns
/**
 * Get user by ID
 * @param userId - User ID
 */
async getUserById(userId: string) {
  // ...
}

// ✅ Fixed
/**
 * Get user by ID
 * @param userId - User ID
 * @returns User object or null if not found
 */
async getUserById(userId: string): Promise<User | null> {
  // ...
}
```

---

#### Issue #12 Deliverables

- [ ] All public methods documented with JSDoc
- [ ] Complex algorithms have detailed documentation
- [ ] JSDoc templates created for future use
- [ ] TypeDoc builds without warnings
- [ ] IDE tooltips show helpful documentation

#### Issue #12 Acceptance Criteria

- [ ] Every public method has JSDoc comment
- [ ] All @param and @returns tags present
- [ ] Complex logic includes algorithm documentation
- [ ] Examples provided for non-obvious methods
- [ ] TypeDoc generates clean documentation

---

### Issue #13: Accessibility Improvements

**Duration**: 2-3 hours
**Priority**: Medium
**Impact**: Ensures WCAG 2.1 AA compliance

#### Context

Current charts and tables lack proper ARIA labels and keyboard navigation, making them difficult to use with screen readers and keyboard-only navigation.

#### Pre-Work Checklist

- [ ] Review WCAG 2.1 AA requirements
- [ ] Test with screen reader (NVDA or VoiceOver)
- [ ] Review PatternFly accessibility guidelines
- [ ] Install axe DevTools browser extension

#### Step 13.1: Audit Accessibility (30 minutes)

**Run automated accessibility audit**:

```bash
# Install axe-core for testing
npm --prefix frontend install --save-dev @axe-core/react axe-playwright

# Run axe DevTools in browser
# 1. Open admin usage page
# 2. Open DevTools → axe DevTools tab
# 3. Scan all page
# 4. Review violations

# Common issues to look for:
# - Missing aria-labels
# - Low contrast colors
# - Missing keyboard navigation
# - Unlabeled form controls
# - Missing focus indicators
```

**Manual testing checklist**:

```markdown
### Keyboard Navigation Test

- [ ] Tab through all interactive elements in logical order
- [ ] Enter/Space activates buttons and links
- [ ] Arrow keys navigate within tables
- [ ] Escape closes modals and dropdowns
- [ ] No keyboard traps
- [ ] Focus indicators visible on all elements

### Screen Reader Test (NVDA/VoiceOver)

- [ ] All charts have descriptive labels
- [ ] Table headers properly announced
- [ ] Filter controls have labels
- [ ] Loading states announced
- [ ] Error messages announced
- [ ] Chart data accessible via table alternative
```

---

#### Step 13.2: Add ARIA Labels to Charts (45 minutes)

**Update chart components with accessibility**:

```typescript
// ❌ Before: No accessibility
export const UsageTrends: React.FC<UsageTrendsProps> = ({ data }) => {
  return (
    <div>
      <LineChart data={data} />
    </div>
  );
};

// ✅ After: Full accessibility
export const UsageTrends: React.FC<UsageTrendsProps> = ({ data }) => {
  const { t } = useTranslation();

  return (
    <div>
      {/* Chart with ARIA label */}
      <div
        role="img"
        aria-label={t(
          'adminUsage.charts.usageTrends.ariaLabel',
          'Usage trends chart showing requests, tokens, and cost over time'
        )}
      >
        <LineChart data={data} />
      </div>

      {/* Accessible data table alternative */}
      <ScreenReaderOnly>
        <table>
          <caption>
            {t(
              'adminUsage.charts.usageTrends.tableCaption',
              'Usage trends data table'
            )}
          </caption>
          <thead>
            <tr>
              <th>{t('adminUsage.charts.date', 'Date')}</th>
              <th>{t('adminUsage.charts.requests', 'Requests')}</th>
              <th>{t('adminUsage.charts.tokens', 'Tokens')}</th>
              <th>{t('adminUsage.charts.cost', 'Cost')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                <td>{row.date}</td>
                <td>{row.requests}</td>
                <td>{row.tokens}</td>
                <td>${row.cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScreenReaderOnly>
    </div>
  );
};

// ScreenReaderOnly utility component
const ScreenReaderOnly = styled.div`
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
`;
```

---

#### Step 13.3: Improve Keyboard Navigation (45 minutes)

**Add keyboard event handlers**:

```typescript
// Filter controls with keyboard support
export const FilterControls: React.FC<FilterControlsProps> = ({
  onFilterChange,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="pf-v6-c-toolbar">
      {/* Text input - already keyboard accessible */}
      <TextInput
        type="text"
        aria-label="Search users"
        placeholder="Search..."
      />

      {/* Custom dropdown with keyboard support */}
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onKeyDown={(e) => handleKeyDown(e, () => setIsOpen(!isOpen))}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption}
      </div>

      {/* Date picker with proper labels */}
      <DatePicker
        aria-label="Start date"
        value={startDate}
        onChange={handleStartDateChange}
      />

      {/* Apply button with explicit focus */}
      <Button
        variant="primary"
        onClick={handleApplyFilters}
        aria-label="Apply filters"
      >
        Apply
      </Button>
    </div>
  );
};
```

**Add focus management for modals**:

```typescript
export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const firstFocusRef = React.useRef<HTMLButtonElement>(null);

  // Focus first element when modal opens
  React.useEffect(() => {
    if (isOpen && firstFocusRef.current) {
      firstFocusRef.current.focus();
    }
  }, [isOpen]);

  // Trap focus within modal
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }

    // Tab key focus trapping logic here
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      aria-labelledby="export-modal-title"
    >
      <ModalHeader>
        <h2 id="export-modal-title">Export Data</h2>
      </ModalHeader>
      <ModalBody>
        <Button ref={firstFocusRef} variant="primary">
          Export CSV
        </Button>
      </ModalBody>
    </Modal>
  );
};
```

---

#### Step 13.4: Add Loading State Announcements (30 minutes)

**Announce loading states to screen readers**:

```typescript
export const AdminUsagePage: React.FC = () => {
  const { isLoading, data } = useQuery(['analytics'], fetchAnalytics);

  return (
    <div>
      {/* Screen reader announcement for loading */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isLoading && 'Loading analytics data...'}
        {!isLoading && data && 'Analytics data loaded'}
      </div>

      {/* Visual loading spinner */}
      {isLoading ? (
        <Spinner aria-hidden="true" />
      ) : (
        <div>
          <UsageTrends data={data.trends} />
        </div>
      )}
    </div>
  );
};
```

---

#### Step 13.5: Validate Accessibility (30 minutes)

**Automated testing**:

```typescript
// frontend/tests/accessibility/admin-usage.a11y.test.tsx

import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import AdminUsagePage from '../../src/pages/AdminUsagePage';

expect.extend(toHaveNoViolations);

describe('Admin Usage Accessibility', () => {
  it('should have no axe violations', async () => {
    const { container } = render(<AdminUsagePage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have accessible chart labels', () => {
    const { getByLabelText } = render(<UsageTrends data={mockData} />);
    expect(
      getByLabelText(/usage trends chart/i)
    ).toBeInTheDocument();
  });

  it('should have keyboard-accessible controls', () => {
    const { getByRole } = render(<FilterControls />);
    const applyButton = getByRole('button', { name: /apply/i });
    expect(applyButton).toHaveAttribute('tabIndex', '0');
  });
});
```

**Manual validation**:

```markdown
### Final Accessibility Checklist

- [ ] All charts have ARIA labels
- [ ] All charts have data table alternatives
- [ ] All interactive elements keyboard accessible
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Loading states announced
- [ ] Error states announced
- [ ] Axe DevTools shows 0 violations
- [ ] Manual screen reader test successful
```

---

#### Issue #13 Deliverables

- [ ] ARIA labels added to all charts
- [ ] Data table alternatives for charts
- [ ] Keyboard navigation working
- [ ] Focus management in modals
- [ ] Loading state announcements
- [ ] Accessibility tests passing

#### Issue #13 Acceptance Criteria

- [ ] Zero axe violations
- [ ] All interactive elements keyboard accessible
- [ ] Screen reader can access all information
- [ ] Focus indicators visible
- [ ] WCAG 2.1 AA compliant

---

### Issue #14: Console Statement Cleanup

**Duration**: 1 hour
**Priority**: Low
**Impact**: Removes debug code from production

#### Context

Debug console statements should be removed from production code to avoid exposing sensitive data and reduce console noise.

#### Pre-Work Checklist

- [ ] Search for all console usage
- [ ] Identify legitimate vs. debug statements
- [ ] Plan logging strategy for production

#### Step 14.1: Audit Console Usage (15 minutes)

```bash
# Find all console statements
grep -rn "console\." backend/src/services/admin-usage/
grep -rn "console\." frontend/src/pages/AdminUsagePage.tsx
grep -rn "console\." frontend/src/components/charts/

# Common patterns to find:
# - console.log()
# - console.debug()
# - console.warn() (some may be legitimate)
# - console.error() (replace with proper logging)
```

**Document findings**:

```markdown
### Console Statement Audit

**Backend**:

- admin-usage-stats.service.ts:
  - Line 145: `console.log('Fetching data for', startDate);` - DEBUG
  - Line 267: `console.error('Failed to fetch', error);` - Replace with logger

**Frontend**:

- AdminUsagePage.tsx:
  - Line 89: `console.log('Filters changed', newFilters);` - DEBUG
  - Line 234: `console.debug('Rendering chart', chartData);` - DEBUG
  - Line 456: `console.error('API call failed', error);` - Replace with error handler

**Total**: 5 statements to remove or replace
```

---

#### Step 14.2: Replace with Proper Logging (30 minutes)

**Backend: Use Fastify logger**:

```typescript
// ❌ Before
console.log('Fetching usage data for date range:', startDate, endDate);
console.error('Failed to fetch usage data:', error);

// ✅ After
this.fastify.log.debug({ startDate, endDate }, 'Fetching usage data for date range');
this.fastify.log.error({ error, startDate, endDate }, 'Failed to fetch usage data');
```

**Frontend: Remove or use proper error handling**:

```typescript
// ❌ Before
const handleFilterChange = (filters: Filters) => {
  console.log('Filters changed:', filters);
  setFilters(filters);
};

// ✅ After
const handleFilterChange = (filters: Filters) => {
  // No logging needed for normal operation
  setFilters(filters);
};

// ❌ Before
const { data } = useQuery(['analytics'], fetchAnalytics, {
  onError: (error) => {
    console.error('Failed to fetch analytics:', error);
  },
});

// ✅ After
const { handleError } = useErrorHandler();

const { data } = useQuery(['analytics'], fetchAnalytics, {
  onError: (error) => {
    handleError(error, {
      title: 'Failed to load analytics',
      description: 'Unable to fetch analytics data. Please try again.',
    });
  },
});
```

---

#### Step 14.3: Add ESLint Rule (10 minutes)

**Prevent future console statements**:

```json
// frontend/.eslintrc.json
{
  "rules": {
    "no-console": [
      "error",
      {
        "allow": ["warn", "error"]
      }
    ]
  }
}

// backend/.eslintrc.json
{
  "rules": {
    "no-console": "error"
  }
}
```

**Add pre-commit hook**:

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

---

#### Step 14.4: Verify Cleanup (5 minutes)

```bash
# Verify no console statements remain
grep -rn "console\." backend/src/services/admin-usage/
grep -rn "console\." frontend/src/pages/AdminUsagePage.tsx
grep -rn "console\." frontend/src/components/charts/

# Should return 0 results (or only legitimate warnings)

# Run linter
npm --prefix backend run lint
npm --prefix frontend run lint

# Should pass without console-related errors
```

---

#### Issue #14 Deliverables

- [ ] All debug console statements removed
- [ ] Console.error replaced with proper logging
- [ ] ESLint rules added
- [ ] Pre-commit hooks configured

#### Issue #14 Acceptance Criteria

- [ ] Zero console.log/debug statements
- [ ] ESLint passes without console warnings
- [ ] Proper logging used for errors
- [ ] Pre-commit hooks prevent new console statements

---

### Issue #15: React Query Optimization

**Duration**: 1-2 hours
**Priority**: Low
**Impact**: Improves cache efficiency and reduces API calls

#### Context

React Query configurations can be optimized to reduce unnecessary API calls while maintaining data freshness. Current implementation uses default settings which may not be optimal for admin analytics.

#### Pre-Work Checklist

- [ ] Review current React Query configurations
- [ ] Understand data staleness requirements
- [ ] Plan cache invalidation strategy
- [ ] Review React Query best practices

#### Step 15.1: Audit Current Configuration (20 minutes)

**Review existing React Query usage**:

```typescript
// Current configuration (typically in useQuery calls)
const { data } = useQuery(['analytics', filters], () => fetchAnalytics(filters));
// Uses defaults: staleTime=0, cacheTime=5min
```

**Document cache requirements**:

```markdown
### Cache Strategy by Query Type

**Analytics Summary** (`/analytics`):

- Current cache behavior: 5min
- Expected data staleness: Updates daily
- Recommended: staleTime=1hour, cacheTime=24hours

**User Breakdown** (`/user-breakdown`):

- Current cache behavior: 5min
- Expected data staleness: Updates daily
- Recommended: staleTime=30min, cacheTime=12hours

**Model Breakdown** (`/model-breakdown`):

- Current cache behavior: 5min
- Expected data staleness: Updates daily
- Recommended: staleTime=30min, cacheTime=12hours

**Real-time Cache Refresh** (`/refresh-today`):

- Current cache behavior: 5min
- Expected data staleness: Immediate
- Recommended: staleTime=0, cacheTime=1min
```

---

#### Step 15.2: Configure Global Defaults (15 minutes)

**Update QueryClient configuration**:

```typescript
// frontend/src/App.tsx or query client setup

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus for admin analytics
      refetchOnWindowFocus: false,

      // Retry failed requests once
      retry: 1,

      // Consider data fresh for 10 minutes by default
      staleTime: 10 * 60 * 1000, // 10 minutes

      // Keep unused data in cache for 30 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes

      // Show stale data while refetching in background
      refetchOnMount: 'always',
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* App content */}
    </QueryClientProvider>
  );
}
```

---

#### Step 15.3: Optimize Individual Queries (30-45 minutes)

**Add query-specific configurations**:

```typescript
// Admin analytics page queries

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfig } from '../contexts/ConfigContext';

export const useAnalyticsQuery = (filters: AdminUsageFilters) => {
  const { config } = useConfig();

  // Get cache TTL from backend config (from Phase 3)
  const cacheTime = config.cacheTTL?.currentDay || 5 * 60 * 1000;

  return useQuery(['analytics', filters], () => adminUsageService.getAnalytics(filters), {
    // Analytics data is updated daily, can be stale for 1 hour
    staleTime: 60 * 60 * 1000, // 1 hour

    // Keep in cache for 24 hours
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours

    // Enable background refetching
    refetchOnMount: 'always',

    // Retry once on failure
    retry: 1,
    retryDelay: 1000,
  });
};

export const useUserBreakdownQuery = (filters: AdminUsageFilters) => {
  return useQuery(['user-breakdown', filters], () => adminUsageService.getUserBreakdown(filters), {
    // User data changes less frequently
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 12 * 60 * 60 * 1000, // 12 hours
  });
};

export const useRefreshTodayMutation = () => {
  const queryClient = useQueryClient();

  return useMutation(() => adminUsageService.refreshToday(), {
    // Invalidate all analytics queries after refresh
    onSuccess: () => {
      queryClient.invalidateQueries(['analytics']);
      queryClient.invalidateQueries(['user-breakdown']);
      queryClient.invalidateQueries(['model-breakdown']);
      queryClient.invalidateQueries(['provider-breakdown']);
    },

    // Show notification on success
    onSettled: (data, error) => {
      if (error) {
        addNotification({
          variant: 'danger',
          title: 'Refresh failed',
          description: "Unable to refresh today's data",
        });
      } else {
        addNotification({
          variant: 'success',
          title: 'Data refreshed',
          description: "Today's usage data has been updated",
        });
      }
    },
  });
};
```

---

#### Step 15.4: Add Prefetching for Common Patterns (20 minutes)

**Prefetch related queries**:

```typescript
export const AdminUsagePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { filters } = useFilters();

  // Prefetch breakdown data when analytics loads
  const { data: analytics } = useAnalyticsQuery(filters);

  React.useEffect(() => {
    if (analytics) {
      // Prefetch user breakdown (likely to be viewed next)
      queryClient.prefetchQuery(
        ['user-breakdown', filters],
        () => adminUsageService.getUserBreakdown(filters),
        {
          staleTime: 30 * 60 * 1000,
        }
      );

      // Prefetch model breakdown
      queryClient.prefetchQuery(
        ['model-breakdown', filters],
        () => adminUsageService.getModelBreakdown(filters),
        {
          staleTime: 30 * 60 * 1000,
        }
      );
    }
  }, [analytics, filters, queryClient]);

  return (
    // Page content
  );
};
```

---

#### Step 15.5: Add Cache Debugging (15 minutes)

**Enable React Query DevTools in development**:

```typescript
// frontend/src/App.tsx

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* App content */}

      {/* Show devtools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
```

**Add cache logging for debugging**:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ... other options

      // Log cache events in development
      onSuccess: (data, query) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Query success:', query.queryKey, data);
        }
      },
      onError: (error, query) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Query error:', query.queryKey, error);
        }
      },
    },
  },
});
```

---

#### Issue #15 Deliverables

- [ ] Global query defaults optimized
- [ ] Query-specific configurations added
- [ ] Prefetching implemented
- [ ] React Query DevTools enabled in development
- [ ] Cache invalidation strategy documented

#### Issue #15 Acceptance Criteria

- [ ] Analytics queries use 1-hour staleTime
- [ ] Breakdown queries use 30-minute staleTime
- [ ] Prefetching works for common navigation patterns
- [ ] Cache invalidation triggers after mutations
- [ ] DevTools show expected cache behavior
- [ ] Reduced API calls observed in network tab

---

## Phase 4 Deliverables

### Code Changes

- [ ] All `any` types replaced with proper types (Issue #11)
- [ ] JSDoc added to all public methods (Issue #12)
- [ ] ARIA labels and keyboard navigation added (Issue #13)
- [ ] Console statements removed (Issue #14)
- [ ] React Query configurations optimized (Issue #15)

### Testing

- [ ] Type safety tests pass
- [ ] Accessibility tests pass
- [ ] ESLint passes with no console warnings
- [ ] React Query cache behavior validated
- [ ] All existing tests still pass

### Documentation

- [ ] JSDoc documentation generated
- [ ] Accessibility testing guide created
- [ ] React Query cache strategy documented
- [ ] ESLint rules documented

---

## Acceptance Criteria

### Code Quality

- [ ] Zero `any` types in admin analytics code
- [ ] All public functions have JSDoc comments
- [ ] Zero console statements (except legitimate warnings)
- [ ] ESLint passes with stricter rules
- [ ] TypeScript strict mode enabled

### Accessibility

- [ ] Zero axe violations
- [ ] All charts have ARIA labels
- [ ] Keyboard navigation works throughout
- [ ] Screen reader can access all data
- [ ] Focus management in modals

### Performance

- [ ] React Query reduces unnecessary API calls
- [ ] Cache hit rate improved (visible in DevTools)
- [ ] Prefetching improves perceived performance
- [ ] Background refetching works correctly

---

## Validation

### Automated Tests

```bash
# Type safety
npm --prefix backend run build
npm --prefix frontend run build

# Linting
npm --prefix backend run lint
npm --prefix frontend run lint

# Accessibility tests
npm --prefix frontend test -- a11y

# All tests
npm --prefix backend test
npm --prefix frontend test
```

### Manual Testing

**Type Safety Validation**:

- [ ] IDE autocomplete works for all admin analytics types
- [ ] No TypeScript errors in build output
- [ ] Hover tooltips show correct types

**Documentation Validation**:

- [ ] Generate TypeDoc: `npm run docs:generate`
- [ ] Review generated docs for completeness
- [ ] IDE shows JSDoc on hover

**Accessibility Validation**:

- [ ] Tab through entire page - logical order
- [ ] Use screen reader (NVDA/VoiceOver) - all content accessible
- [ ] Run axe DevTools - 0 violations
- [ ] Keyboard-only navigation - all features accessible

**Console Cleanup Validation**:

- [ ] Open browser console
- [ ] Navigate through admin analytics
- [ ] No debug console output (except legitimate warnings)

**React Query Validation**:

- [ ] Open React Query DevTools
- [ ] Observe cache behavior
- [ ] Verify stale times match configuration
- [ ] Check network tab - reduced API calls

---

## Next Steps

After completing Phase 4:

1. **Phase Checkpoint**: Run full validation suite
2. **Code Review**: Get team review of changes
3. **Deploy to Staging**: Validate in staging environment
4. **Phase Sign-Off**: Get approval to proceed

**Next Phase**: [Phase 5: Performance & Observability](./phase-5-session-5a-database-optimization.md)

---

## Phase 4 Checkpoint

### Validation Checklist

**Code Quality**:

- [ ] All 5 issues addressed
- [ ] All tests passing (100%)
- [ ] No TypeScript errors
- [ ] Linter passes with strict rules
- [ ] No regression in functionality

**Documentation**:

- [ ] JSDoc complete
- [ ] TypeDoc builds successfully
- [ ] Accessibility guide created
- [ ] React Query strategy documented

**Accessibility**:

- [ ] Axe violations: 0
- [ ] Keyboard navigation: ✅
- [ ] Screen reader test: ✅
- [ ] WCAG 2.1 AA: ✅

**Performance**:

- [ ] React Query optimized
- [ ] Cache hit rate improved
- [ ] API calls reduced

### Phase 4 Metrics

**Before**:

- `any` types: 9 instances
- JSDoc coverage: ~30%
- Axe violations: 12
- Console statements: 5
- React Query defaults: Suboptimal

**After**:

- `any` types: 0 instances
- JSDoc coverage: 100%
- Axe violations: 0
- Console statements: 0
- React Query: Optimized configurations

### Phase 4 Sign-Off

**Approvals Required**:

- [ ] Tech Lead - Code quality review
- [ ] QA - Accessibility testing complete
- [ ] Documentation - JSDoc review

**Ready for Phase 5**: ✅ / ❌

**Notes**:

- Phase 4 completion date: \***\*\_\_\*\***
- Actual time: **\_\_\_** hours (estimated: 8-12 hours)
- Issues encountered: \***\*\_\_\*\***
- Lessons learned: \***\*\_\_\*\***

---

**Document Version**: 1.0
**Last Updated**: 2025-10-11
**Status**: Ready for execution

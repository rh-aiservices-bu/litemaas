# Weekly Usage Heatmap Feature Specification

## Overview

A new heatmap visualization component for the Admin Usage Analytics page that displays usage patterns across days of the week, allowing administrators to identify daily patterns and trends over time.

## User Story

**As an** administrator
**I want to** see usage patterns by day-of-week in a heatmap format
**So that** I can identify weekly patterns, peak usage days, and anomalies at a glance

## Location & Layout

### Page Structure

The Admin Usage Page will be reorganized to accommodate the new heatmap:

- **Row 1**: 4 metric cards (Total Requests, Total Tokens, Prompt Tokens, Completion Tokens) - _unchanged_
- **Row 2**: Usage Trends (left, 6 cols) + Model Usage Trends (right, 6 cols) - _unchanged_
- **Row 3**: **Weekly Usage Patterns (left, 6 cols)** + Model Distribution (right, 6 cols) - _NEW_
- **Row 4**: Top Users table (full width, 12 cols) - _moved from Row 3_

### Card Layout

```
┌─────────────────────────────────────────────────────────┐
│ Weekly Usage Patterns          [Requests ▼] [Table] [⤢] │
├─────────────────────────────────────────────────────────┤
│ Usage heatmap over selected week(s)                     │
│                                                          │
│       Mon   Tue   Wed   Thu   Fri   Sat   Sun          │
│ Jan 15-21  ███   ███   ██░   ███   ██░   ░░░   ░░░     │
│ Jan 22-28  ███   ███   ███   ██░   ███   ░░░   ░░░     │
│ Jan 29-Feb4 ██░  ███   ███   ███   ███   █░░   ░░░     │
│ Feb 5-11   ███   ███   ██░   ███   ██░   ░░░   ░░░     │
│                                                          │
│ Legend: [■■■ 10K+] [■■░ 1K-10K] [■░░ 100-1K] [░░░ 0-100]│
│         [   ] Zero usage  [///] No data                 │
└─────────────────────────────────────────────────────────┘
```

## Design Specifications

### Visual Design

#### Cell Layout

- **Shape**: Rectangular (wider than tall, approximately 2:1 aspect ratio)
- **Sizing**: Responsive - scales with card width
  - Calculation: `cellWidth = (containerWidth - rowLabelWidth - padding) / 7`
  - Min width: 30px
  - Max width: 80px
  - Height: ~50-60% of width
- **Borders**: 1px solid light grey (`var(--pf-t--global--border--color--default)`)
- **Spacing**: Borders touch (no gaps between cells)

#### Headers

- **Column Headers**: Day abbreviations (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
  - Font size: PatternFly standard heading size
  - Alignment: Centered above each column
  - Use i18n for day names (locale-aware)

- **Row Headers**: Week date ranges in first column
  - Format: "MMM DD-DD" (e.g., "Jan 15-21")
  - For partial weeks: show actual range (e.g., "Jan 15-17" if only 3 days)
  - For week spanning months: "Jan 29-Feb 4"
  - Font size: Slightly smaller than column headers
  - Alignment: Right-aligned with padding

### Week Display Logic

#### Number of Weeks

- Display **ALL** weeks within the selected date range
- 1-day range: 1 partial week
- 7-day range: 1-2 weeks (depending on start day)
- 30-day range: 4-5 weeks
- 90-day range: 12-13 weeks (requires vertical scrolling)

#### Partial Weeks

- **Display partial weeks** with empty cells for days outside the date range
- Example: If range starts on Wednesday:
  - Monday cell: Grey with diagonal hatching (no data)
  - Tuesday cell: Grey with diagonal hatching (no data)
  - Wednesday-Sunday: Colored based on usage data
- Week labels reflect actual date range, not full week

#### Week Definition

- Use **ISO week definition** (Monday = start of week)
- Weeks start on Monday, end on Sunday

### Color Scheme

#### Logarithmic Scale

Use logarithmic scale for value distribution to handle wide ranges:

```typescript
// Algorithm for 6-level logarithmic scale
const nonZeroValues = values.filter((v) => v > 0);
const minValue = Math.max(1, Math.min(...nonZeroValues));
const maxValue = Math.max(...values);
const logMin = Math.log10(minValue);
const logMax = Math.log10(maxValue);
const logStep = (logMax - logMin) / (levels - 1);

// Generate thresholds: 10^(logMin + i*logStep)
const thresholds = Array.from({ length: levels }, (_, i) => Math.pow(10, logMin + i * logStep));
```

#### Color Levels

Generate 5-7 discrete color levels based on metric:

- Use base metric color from `chartAccessibility.ts`
- Apply varying opacity/intensity for each level
- Colors must meet WCAG 2.1 AA contrast requirements (4.5:1)

**Base Colors by Metric:**

- `requests`: Blue (`ACCESSIBLE_COLORS.primary.blue`)
- `tokens`: Green (`ACCESSIBLE_COLORS.primary.green`)
- `prompt_tokens`: Dark Blue (`ACCESSIBLE_COLORS.primary.darkBlue`)
- `completion_tokens`: Purple (`ACCESSIBLE_COLORS.primary.purple`)
- `cost`: Orange (`ACCESSIBLE_COLORS.primary.orange`)

#### Special Cases

Three distinct visual states:

1. **Non-zero values**: Colored by logarithmic scale
   - Apply appropriate color level based on value
   - Darker = higher value

2. **Zero values**: White background
   - `background-color: var(--pf-t--global--background--color--100)`
   - Clear indication of zero usage (not "no data")

3. **No data** (date outside selected range): Light grey with diagonal hatching
   - `background-color: var(--pf-t--global--background--color--200)`
   - SVG diagonal line pattern overlay
   - Clearly distinguishes from zero values

### Interactive Elements

#### Metric Selector

- **Component**: PatternFly Select with MenuToggle
- **Position**: Card header, right side (before table toggle and expand buttons)
- **Options**:
  - Requests
  - Total Tokens
  - Prompt Tokens
  - Completion Tokens
  - Total Cost
- **Behavior**: Reloads heatmap with selected metric
- **State**: Independent from Usage Trends metric selector

#### Tooltips

Display on hover with following information:

- **Full date**: "Monday, January 15, 2025"
- **Day name**: Already in date above
- **Formatted value**: "1,234 requests" (with locale-specific number formatting)
- **Percentage of week**: "15% of week total"

**Tooltip Implementation:**

- Use custom SVG tooltip (similar to UsageTrends)
- Dark background: `#151515`
- White text with padding
- Smart positioning to avoid overflow

**Special Cases:**

- Zero value: "Monday, January 15, 2025 / 0 requests / 0% of week"
- No data: "Monday, January 15, 2025 / No data (outside selected range)"

#### Click Behavior

- **No click action** - cells are not interactive beyond hover tooltips
- Focus remains on hover/tooltip interaction only

#### Expand Button

- **Icon**: ExpandIcon from PatternFly
- **Position**: Card header, far right
- **Behavior**: Opens full-screen modal with larger heatmap
- **Modal size**: Height 600-800px, responsive width
- **Modal content**: Same heatmap component with larger cells

### Legend

#### Position & Layout

Located below the heatmap, divided into two sections:

1. **Color Scale Legend** (top)
2. **Special Cases Legend** (bottom)

#### Color Scale Legend

- **Style**: Discrete color blocks (not gradient)
- **Layout**: Horizontal row of colored boxes with value ranges
- **Number of blocks**: Match logarithmic scale levels (5-7 blocks)
- **Block appearance**:
  - Width: 40-60px
  - Height: 20px
  - Border: 1px solid grey
  - Label below: Value range (e.g., "0-100", "100-1K", "1K-10K")

**Example for Requests:**

```
[■■■■■] [■■■■░] [■■■░░] [■■░░░] [■░░░░] [░░░░░]
10K+    1K-10K  500-1K  100-500  10-100   1-10
```

**Value Formatting:**

- Use compact notation for large numbers (K, M, B)
- For cost: Include currency symbol ($)
- For tokens: Use locale-specific number formatting

#### Special Cases Legend

Row of indicators below color scale:

```
[   ] Zero usage    [///] No data
```

- **Zero usage**: White box with border
- **No data**: Grey box with diagonal hatching pattern
- Labels use i18n translations

### Accessibility

#### Table View Toggle

Primary accessibility feature: **Table view toggle button**

- **Component**: MenuToggle with plain variant
- **Icon**: TableIcon (when showing chart) / ChartIcon (when showing table)
- **Position**: Card header, between metric selector and expand button
- **Behavior**: Toggles between heatmap SVG and HTML table
- **State**: Persisted to localStorage (key: `adminUsageHeatmapView`)

**Table View Structure:**

```html
<table role="table" aria-label="Weekly usage patterns table">
  <thead>
    <tr>
      <th>Week</th>
      <th>Monday</th>
      <th>Tuesday</th>
      <th>Wednesday</th>
      <th>Thursday</th>
      <th>Friday</th>
      <th>Saturday</th>
      <th>Sunday</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Jan 15-21</th>
      <td>1,234 requests</td>
      <td>1,456 requests</td>
      <!-- ... -->
    </tr>
  </tbody>
</table>
```

**Benefits:**

- Native screen reader support
- Keyboard navigation (Tab through cells)
- Easy to copy/paste data
- Sortable columns (future enhancement)
- Export-friendly format

#### ARIA Labels & Roles

For heatmap SVG view:

```typescript
// Container
<div role="grid" aria-label="Weekly usage patterns heatmap">

// Each cell
<rect
  role="gridcell"
  aria-label="Monday, January 15, 2025, 1,234 requests, 15% of week"
  tabindex="0"
/>
```

#### Keyboard Navigation

- **Tab**: Move through cells sequentially
- **Shift+Tab**: Move backwards
- **Enter/Space**: Show tooltip (visual users see on hover)
- **Escape**: Close tooltip if open

#### Screen Reader Support

- Use `AccessibleChart` wrapper component (existing pattern)
- Provide chart summary: "Heatmap showing N weeks of usage data from DATE to DATE"
- Announce metric changes: "Now showing total tokens"
- Announce view changes: "Switched to table view" / "Switched to chart view"

#### Color Accessibility

- All color levels must pass WCAG 2.1 AA contrast ratio (4.5:1)
- Colors chosen to be distinguishable for colorblind users
- Supplemented by value labels in tooltips and table view
- Legend provides clear value ranges

## Data Requirements

### Input Data

Uses existing `DailyUsageSummary` from admin analytics API:

```typescript
interface DailyUsageSummary {
  date: string; // "YYYY-MM-DD"
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}
```

### Data Transformation

New transformer function: `transformDailyUsageToHeatmapData()`

**Input:** Array of `DailyUsageSummary`
**Output:** Array of `HeatmapWeekData`

```typescript
interface HeatmapWeekData {
  weekNumber: number; // ISO week number
  weekLabel: string; // "Jan 15-21"
  weekStart: string; // "2025-01-15" (Monday)
  weekEnd: string; // "2025-01-21" (Sunday)
  weekTotal: number; // Sum for selected metric
  days: HeatmapDayData[]; // 7 elements (Mon-Sun)
}

interface HeatmapDayData {
  date: string; // "2025-01-15"
  dayOfWeek: number; // 0=Mon, 6=Sun
  dayName: string; // "Monday" (i18n)
  value: number | null; // null if no data
  isInRange: boolean; // false if outside selected date range
  percentOfWeek: number; // 0-100
  formattedValue: string; // "1,234 requests"
}
```

### Logarithmic Scale Calculation

New utility: `generateLogarithmicColorScale()`

```typescript
interface LogarithmicColorScale {
  levels: number; // 5-7
  thresholds: number[]; // [1, 10, 100, 1000, 10000, ...]
  colors: string[]; // ["#color1", "#color2", ...]
  ranges: Array<{
    // For legend
    min: number;
    max: number;
    color: string;
    label: string; // "1-10", "10-100", "100-1K"
  }>;
  getColorForValue: (value: number) => string;
  getLevelForValue: (value: number) => number; // 0 to levels-1
}
```

**Algorithm:**

1. Filter out zero and null values
2. Calculate min/max of non-zero values
3. Generate logarithmic thresholds
4. Map to color intensities
5. Create level lookup function

## Technical Implementation

### New Files

#### 1. `frontend/src/components/charts/UsageHeatmap.tsx`

Main heatmap component.

**Key features:**

- SVG-based rendering
- Responsive cell sizing
- Custom tooltips
- Diagonal hatching pattern for no-data cells
- Metric selector integration
- Table view toggle
- Full keyboard navigation

**Dependencies:**

- React, useState, useMemo, useCallback
- PatternFly components (Card, MenuToggle, Select)
- i18next (useTranslation)
- Custom utilities (chartColorScale, chartDataTransformers)

#### 2. `frontend/src/components/charts/HeatmapLegend.tsx`

Legend component showing color scale and special cases.

**Props:**

```typescript
interface HeatmapLegendProps {
  colorScale: LogarithmicColorScale;
  metricType: MetricType;
  compact?: boolean; // For modal vs. card view
}
```

#### 3. `frontend/src/utils/chartColorScale.ts`

Logarithmic color scale generation utility.

**Exports:**

- `generateLogarithmicColorScale()`
- `formatValueForLegend()` (compact number formatting)
- `getColorLevels()` (generate intensity variations)

#### 4. `frontend/src/test/components/charts/UsageHeatmap.test.tsx`

Comprehensive test suite.

**Test coverage:**

- Data transformation accuracy
- Color scale generation
- Partial week handling
- Zero vs. no-data distinction
- Tooltip content
- Table view rendering
- Accessibility (axe-core)
- Keyboard navigation
- Responsive behavior

### Modified Files

#### 1. `frontend/src/components/admin/MetricsOverview.tsx`

Add heatmap card in Row 3.

**Changes:**

- Add state: `selectedHeatmapMetric`, `isHeatmapSelectOpen`, `isHeatmapExpanded`
- Add new GridItem for heatmap (lg={6}, after UsageTrends)
- Move Top Users GridItem to new row
- Add full-screen modal for heatmap

**State management:**

```typescript
const [selectedHeatmapMetric, setSelectedHeatmapMetric] = useState<MetricType>('requests');
const [isHeatmapSelectOpen, setIsHeatmapSelectOpen] = useState(false);
const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false);
```

#### 2. `frontend/src/utils/chartDataTransformers.ts`

Add heatmap data transformer.

**New function:**

```typescript
export const transformDailyUsageToHeatmapData = (
  dailyUsage: DailyUsageSummary[],
  startDate: string,
  endDate: string,
  metricType: MetricType
): HeatmapWeekData[]
```

#### 3. `frontend/src/i18n/locales/*/translation.json`

Add translations for all 9 languages.

**New keys:**

```json
{
  "adminUsage": {
    "weeklyUsagePatterns": "Weekly Usage Patterns",
    "usageHeatmapSubtitle": "Usage heatmap over selected week(s)",
    "heatmap": {
      "legend": {
        "colorScale": "Usage intensity",
        "zeroUsage": "Zero usage",
        "noData": "No data"
      },
      "tooltip": {
        "percentOfWeek": "{{percent}}% of week total",
        "noDataOutsideRange": "No data (outside selected range)"
      },
      "table": {
        "viewAsTable": "View as table",
        "viewAsChart": "View as chart",
        "week": "Week"
      },
      "accessibility": {
        "heatmapDescription": "Heatmap showing {{metric}} by day of week across {{weeks}} weeks",
        "cellLabel": "{{dayName}}, {{date}}, {{value}}, {{percent}} of week"
      }
    }
  }
}
```

#### 4. `frontend/src/components/charts/index.ts`

Export new components.

```typescript
export { default as UsageHeatmap } from './UsageHeatmap';
export { default as HeatmapLegend } from './HeatmapLegend';
```

## User Workflows

### Primary Use Case: Identify Weekly Patterns

1. User opens Admin Usage Analytics page
2. Selects date range (e.g., "Last 30 days")
3. Scrolls to "Weekly Usage Patterns" card
4. Reviews heatmap to identify patterns:
   - High usage on weekdays (darker colors)
   - Low usage on weekends (lighter/white)
5. Hovers over specific cells to see exact values
6. Changes metric selector to compare different metrics
7. Clicks expand button for detailed full-screen view

### Secondary Use Case: Accessibility

1. User with screen reader navigates to heatmap
2. Clicks "View as table" toggle
3. Uses table navigation (Tab, arrow keys) to explore data
4. Screen reader announces: "Row 1 of 5, Week January 15-21, Column 2 of 8, Monday, 1,234 requests"
5. Exports table data for external analysis

### Secondary Use Case: Anomaly Detection

1. User selects 90-day date range
2. Scrolls through 13 weeks of heatmap
3. Identifies unusual pattern (e.g., high usage on a Saturday)
4. Hovers over cell to confirm: "Saturday, March 15, 2025, 8,543 requests, 18% of week"
5. Investigates further by filtering to specific models/users

## Performance Considerations

### Optimization Strategies

1. **Memoization**: Use `useMemo` for expensive calculations
   - Color scale generation
   - Week grouping
   - Percentage calculations

2. **Virtual Scrolling** (future enhancement): For >20 weeks
   - Only render visible weeks
   - Render buffer of 2-3 weeks above/below viewport

3. **SVG Optimization**:
   - Use `<rect>` for cells (not complex paths)
   - Single `<defs>` for diagonal hatching pattern (reused)
   - Minimize event listeners (use event delegation)

4. **Responsive Updates**:
   - Debounce resize events (ResizeObserver)
   - Throttle tooltip position updates

### Performance Targets

- **Initial render**: < 100ms for 4 weeks
- **Metric change**: < 50ms (cached data)
- **Resize**: < 30ms (debounced)
- **90-day render**: < 200ms (13 weeks)

## Testing Strategy

### Unit Tests

- Data transformer accuracy
- Logarithmic scale generation
- Week boundary calculations
- Percentage calculations
- Value formatting

### Component Tests

- Renders all weeks correctly
- Displays correct cell colors
- Shows accurate tooltips
- Handles zero vs. no-data
- Metric selector works
- Table toggle works
- Expand modal works

### Integration Tests

- Works with all date ranges
- Updates when filters change
- Persists table view preference
- Exports data correctly

### Accessibility Tests

- Passes axe-core validation
- Keyboard navigation works
- Screen reader announces correctly
- Color contrast passes WCAG AA
- Table view provides full information

### Visual Regression Tests

- Heatmap renders consistently
- Colors match design tokens
- Layout is responsive
- Modal appears correctly
- Legend displays properly

## Future Enhancements

### Phase 2 Features (not in initial implementation)

1. **Click-to-Filter**: Click cell to filter date range to that specific day
2. **Comparative View**: Show two metrics side-by-side with split cells
3. **Hour-of-Day Heatmap**: Drill down to hourly patterns for a single day
4. **Custom Week Start**: Allow users to choose Sunday vs. Monday start
5. **Annotations**: Add notes/markers for specific days (holidays, incidents)
6. **Export Enhanced**: Export as image (PNG/SVG) or detailed CSV
7. **Virtual Scrolling**: For very large date ranges (180+ days)
8. **Trend Indicators**: Small arrows showing week-over-week changes
9. **Color Scheme Selector**: Allow users to choose color palette
10. **Threshold Alerts**: Highlight cells that exceed/fall below thresholds

## Success Metrics

### Quantitative Metrics

- Component renders within performance targets
- Zero accessibility violations (axe-core)
- 100% translation coverage (9 languages)
- All unit tests pass (>95% coverage)

### Qualitative Metrics

- Users can identify weekly patterns quickly
- Accessible to screen reader users
- Visual design matches PatternFly 6 standards
- Integrates seamlessly with existing page

## Open Questions & Decisions

### Resolved

✅ Placement: Row 3, left side
✅ Week display: Show all weeks with scrolling
✅ Partial weeks: Show with empty cells
✅ Color scale: Logarithmic (5-7 levels)
✅ Cell shape: Rectangular (wider than tall)
✅ Borders: 1px light grey
✅ Cell size: Responsive
✅ Week labels: Date ranges (e.g., "Jan 15-21")
✅ Tooltip: Date + Value + Percentage
✅ Click: No action
✅ No-data: Grey with diagonal hatching
✅ Zero: White
✅ Legend: Discrete blocks below heatmap
✅ Accessibility: Table view toggle
✅ Title: "Weekly Usage Patterns"

### Future Decisions

- Virtual scrolling threshold (how many weeks?)
- Export formats (CSV, PNG, SVG?)
- Color scheme customization?
- Click-to-filter interaction?

## Implementation Timeline

### Phase 1: Core Implementation (Current Scope)

**Estimated: 12-18 hours (1.5-2 days)**

1. **Data Layer** (2-3 hours)
   - chartColorScale.ts utility
   - transformDailyUsageToHeatmapData() function
   - Unit tests

2. **Component Development** (4-5 hours)
   - UsageHeatmap.tsx base implementation
   - HeatmapLegend.tsx
   - SVG rendering with responsive cells
   - Tooltip implementation

3. **Accessibility** (2-3 hours)
   - Table view implementation
   - ARIA labels and roles
   - Keyboard navigation
   - AccessibleChart wrapper integration

4. **Integration** (1-2 hours)
   - MetricsOverview.tsx changes
   - Metric selector
   - Expand modal
   - Layout adjustments

5. **Internationalization** (1-2 hours)
   - Translation keys for all 9 languages
   - Date/number formatting
   - Testing all locales

6. **Testing** (2-3 hours)
   - Unit tests
   - Component tests
   - Accessibility tests
   - Visual regression tests

### Phase 2: Enhancements (Future)

- Click-to-filter interaction
- Export functionality
- Virtual scrolling for large ranges
- Additional visualization options

## References

- AdminUsagePage: `frontend/src/pages/AdminUsagePage.tsx:354`
- MetricsOverview: `frontend/src/components/admin/MetricsOverview.tsx`
- UsageTrends (pattern reference): `frontend/src/components/charts/UsageTrends.tsx`
- Chart utilities: `frontend/src/utils/chartDataTransformers.ts`
- Chart accessibility: `frontend/src/utils/chartAccessibility.ts`
- PatternFly 6 Guide: `docs/development/pf6-guide/`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-07
**Status**: Ready for Implementation

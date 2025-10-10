# Chart Components Development Guide

> **Complete reference for developing accessible, consistent chart components in LiteMaaS**

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Shared Utilities API](#shared-utilities-api)
3. [Creating a New Chart Component](#creating-a-new-chart-component)
4. [Accessibility Requirements](#accessibility-requirements)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

## Architecture Overview

LiteMaaS chart components follow a standardized architecture using shared utilities to ensure consistency across all visualizations.

### Utility Files

- **`utils/chartFormatters.ts`** - Formatting functions for axes and values
- **`utils/chartConstants.ts`** - Styling constants (padding, colors, sizes)
- **`utils/chartAccessibility.ts`** - WCAG 2.1 AA compliant accessibility helpers

### Design Principles

1. **DRY (Don't Repeat Yourself)** - Shared utilities eliminate code duplication
2. **Consistency** - All charts use the same formatting, spacing, and styling
3. **Accessibility First** - WCAG 2.1 AA compliance built-in
4. **Responsive** - Charts adapt to container size using ResizeObserver
5. **Theme Support** - Works in both light and dark PatternFly themes

## Shared Utilities API

### chartFormatters.ts

#### `formatYTickByMetric(value: number, metricType: 'requests' | 'tokens' | 'cost'): string`

Formats Y-axis tick values based on metric type with appropriate units and abbreviations.

**Examples:**

```typescript
formatYTickByMetric(1500, 'requests'); // "2K"
formatYTickByMetric(1500000, 'tokens'); // "1.5M"
formatYTickByMetric(1234, 'cost'); // "$1.2K"
formatYTickByMetric(50, 'cost'); // "$50"
```

**Usage:**

```typescript
<ChartAxis
  dependentAxis
  tickFormat={(value) => formatYTickByMetric(value, metricType)}
/>
```

#### `formatXTickWithSkipping(value: number, labels: string[]): string`

Formats X-axis tick labels with automatic skipping for readability.

- Shows all labels when ≤ 30 data points
- Shows every other label when > 30 data points

**Usage:**

```typescript
const dateLabels = chartData.map((d) => d.date);

<ChartAxis
  tickFormat={(value) => formatXTickWithSkipping(value, dateLabels)}
/>
```

#### `calculateLeftPaddingByMetric(metricType: 'requests' | 'tokens' | 'cost'): number`

Calculates left padding to ensure Y-axis labels are fully visible.

**Returns:**

- `50` for cost ($ symbol needs more space)
- `55` for tokens (large numbers with M/K suffixes)
- `45` for requests (default)

**Usage:**

```typescript
const leftPadding = calculateLeftPaddingByMetric(metricType);

<Chart
  padding={{
    left: leftPadding,
    right: 10,
    top: 10,
    bottom: 30,
  }}
/>
```

### chartConstants.ts

#### `CHART_PADDING`

Standard padding values for consistent chart spacing.

```typescript
{
  top: 10,
  right: 10,
  bottomBase: 30,           // Base bottom padding
  bottomWithLegend: 75,     // Bottom padding when legend is present
}
```

#### `TOOLTIP_STYLES`

Shared tooltip styling configuration.

```typescript
{
  background: '#151515',
  border: '#3c3f42',
  borderWidth: 1,
  borderRadius: 4,
  padding: 12,
  pointerSize: 8,
  edgeMargin: 10,
  shadowBlur: 3,
  shadowOffset: 2,
  shadowOpacity: 0.3,
  textColor: '#ffffff',
  titleFontSize: 12,
  entryFontSize: 11,
}
```

#### `GRID_STYLES`

Grid line styling for Y-axis.

```typescript
{
  stroke: 'lightgray',
  strokeDasharray: '3,3',
}
```

#### `CHART_ANIMATION`

Standard animation configuration.

```typescript
{
  duration: 1000,
  onLoadDuration: 1,
}
```

#### `AXIS_STYLES`

Axis label styling.

```typescript
{
  tickLabelFontSize: 10,
  xAxisAngle: -30,
  xAxisAnchor: 'end' as const,
}
```

### chartAccessibility.ts

#### `generateChartAriaDescription(chartType: string, dataCount: number, metricType?: string): string`

Generates comprehensive ARIA descriptions for screen readers.

**Example:**

```typescript
generateChartAriaDescription('line', 30, 'requests');
// Returns: "line chart with 30 data points showing requests data. Use Tab to navigate controls, T to toggle table view, E to export data"
```

**Usage:**

```typescript
<Chart
  ariaDesc={generateChartAriaDescription('stacked area', chartData.length, metricType)}
/>
```

## Creating a New Chart Component

### Step 1: Component Setup

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Chart, ChartAxis, createContainer } from '@patternfly/react-charts/victory';
import { VictoryTooltip } from 'victory';
import { Skeleton } from '@patternfly/react-core';
import AccessibleChart, { AccessibleChartData } from './AccessibleChart';
import { generateChartAriaDescription } from '../../utils/chartAccessibility';
import {
  formatYTickByMetric,
  formatXTickWithSkipping,
  calculateLeftPaddingByMetric,
} from '../../utils/chartFormatters';
import { CHART_PADDING, GRID_STYLES, AXIS_STYLES } from '../../utils/chartConstants';

export interface MyChartProps {
  data: MyDataType[];
  loading?: boolean;
  height?: number;
  metricType: 'requests' | 'tokens' | 'cost';
  title?: string;
  description?: string;
}

const MyChart: React.FC<MyChartProps> = ({
  data = [],
  loading = false,
  height = 400,
  metricType,
  title,
  description,
}) => {
  const { t } = useTranslation();
  const [containerWidth, setContainerWidth] = React.useState(600);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  // ... implementation
};

export default MyChart;
```

### Step 2: Responsive Container with ResizeObserver

```typescript
// Measure container width for responsive chart sizing
const containerRef = React.useCallback((element: HTMLDivElement | null) => {
  // Disconnect previous observer
  if (resizeObserverRef.current) {
    resizeObserverRef.current.disconnect();
    resizeObserverRef.current = null;
  }

  // Setup new observer if element exists
  if (element) {
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserverRef.current.observe(element);
  }
}, []);
```

### Step 3: Loading and Empty States

```typescript
if (loading) {
  return <Skeleton height={`${height}px`} width="100%" />;
}

if (!data || data.length === 0) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--pf-t--global--text--color--subtle)',
      }}
      role="status"
      aria-live="polite"
    >
      {t('charts.noDataAvailable', 'No data available')}
    </div>
  );
}
```

### Step 4: Use Shared Formatters and Constants

```typescript
// Calculate left padding based on metric type
const leftPadding = calculateLeftPaddingByMetric(metricType);

// Format data for chart
const chartData = data.map((d, index) => ({
  x: index,
  y: d.value || 0,
}));

const dateLabels = data.map((d) => d.date);
```

### Step 5: Implement Custom Tooltip with Unique Filter ID

**CRITICAL**: Use a unique filter ID to prevent conflicts when multiple charts appear on the same page.

```typescript
const CustomFlyout = (props: any) => {
  const { datum, x, y } = props;
  if (!datum) return null;

  const xValue = Math.round(datum.x);
  const dateLabel = dateLabels[xValue] || '';
  const value = datum.y || 0;
  const formattedValue = formatYTickByMetric(value, metricType);

  return (
    <g>
      {/* IMPORTANT: Use unique filter ID */}
      <defs>
        <filter id="tooltip-shadow-myChart" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Tooltip background */}
      <rect
        x={tooltipX}
        y={tooltipY}
        width={180}
        height={50}
        rx="4"
        ry="4"
        fill="#151515"
        stroke="#3c3f42"
        strokeWidth="1"
        filter="url(#tooltip-shadow-myChart)"
      />

      {/* Tooltip text */}
      <text x={tooltipX + 12} y={tooltipY + 26} fill="#ffffff" fontSize="12" fontWeight="bold">
        {dateLabel}: {formattedValue}
      </text>
    </g>
  );
};
```

### Step 6: Accessibility Data Transformation

```typescript
// Transform data for accessibility
const accessibleData: AccessibleChartData[] = chartData.map((point, index) => ({
  label: dateLabels[index] || `Day ${index + 1}`,
  value: point.y || 0,
  additionalInfo: {
    rawValue: point.y || 0,
    value: formatYTickByMetric(point.y || 0, metricType),
    date: dateLabels[index] || '',
  },
}));

const formatAccessibleValue = (value: number | string) => {
  if (typeof value === 'string') return value;
  return formatYTickByMetric(value, metricType);
};
```

### Step 7: Render Chart with Shared Styles

```typescript
const CursorVoronoiContainer = createContainer('cursor', 'voronoi');

return (
  <AccessibleChart
    data={accessibleData}
    title={title || t('charts.myChart')}
    description={description || t('charts.myChartDescription')}
    summary={chartSummary}
    chartType="line"
    formatValue={formatAccessibleValue}
    exportFilename={`my-chart-${metricType}`}
    additionalHeaders={[t('date'), t('value')]}
  >
    <div
      ref={containerRef}
      style={{ width: '100%', height }}
      role="img"
      tabIndex={0}
    >
      <Chart
        height={height}
        width={containerWidth}
        padding={{
          bottom: CHART_PADDING.bottomBase,
          left: leftPadding,
          right: CHART_PADDING.right,
          top: CHART_PADDING.top,
        }}
        ariaDesc={generateChartAriaDescription('line', chartData.length, metricType)}
        containerComponent={
          <CursorVoronoiContainer
            cursorDimension="x"
            labels={() => ' '}
            labelComponent={<VictoryTooltip flyoutComponent={<CustomFlyout />} />}
            mouseFollowTooltips
            voronoiDimension="x"
            voronoiPadding={50}
          />
        }
      >
        <ChartAxis
          tickFormat={(value) => formatXTickWithSkipping(value, dateLabels)}
          style={{
            tickLabels: {
              fontSize: AXIS_STYLES.tickLabelFontSize,
              angle: AXIS_STYLES.xAxisAngle,
              textAnchor: AXIS_STYLES.xAxisAnchor,
            },
          }}
        />
        <ChartAxis
          dependentAxis
          showGrid
          tickFormat={(value) => formatYTickByMetric(value, metricType)}
          style={{
            tickLabels: { fontSize: AXIS_STYLES.tickLabelFontSize },
            grid: { stroke: GRID_STYLES.stroke, strokeDasharray: GRID_STYLES.strokeDasharray },
          }}
        />
        {/* Add your chart components (ChartLine, ChartArea, etc.) */}
      </Chart>
    </div>
  </AccessibleChart>
);
```

## Accessibility Requirements

### WCAG 2.1 AA Compliance Checklist

- ✅ Use `AccessibleChart` wrapper component
- ✅ Provide `ariaDesc` with `generateChartAriaDescription()`
- ✅ Include accessible data transformation for table view
- ✅ Support keyboard navigation (Tab, T for table, E for export)
- ✅ Ensure color contrast meets 4.5:1 ratio (use `chartAccessibility` color schemes)
- ✅ Add `role="img"` and `tabIndex={0}` to chart container
- ✅ Provide screen reader announcements for chart focus
- ✅ Include accessible legend with `AccessibleLegend` component

### Screen Reader Announcement Pattern

```typescript
onFocus={(event) => {
  const announcement = t('charts.chartFocused', {
    chartType: t('charts.lineChart'),
    dataPoints: chartData.length,
  });

  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-10000px';
  liveRegion.textContent = announcement;
  document.body.appendChild(liveRegion);
  setTimeout(() => document.body.removeChild(liveRegion), 1000);
}}
```

## Best Practices

### 1. SVG Filter ID Naming Convention

Always use unique filter IDs following the pattern `tooltip-shadow-{chartName}`:

```typescript
// ✅ CORRECT - Unique IDs
<filter id="tooltip-shadow-usage" ... />      // UsageTrends.tsx
<filter id="tooltip-shadow-model" ... />      // ModelUsageTrends.tsx
<filter id="tooltip-shadow-myChart" ... />    // MyChart.tsx

// ❌ WRONG - Generic ID causes conflicts
<filter id="tooltip-shadow" ... />
```

### 2. Never Hardcode Formatting Logic

```typescript
// ❌ WRONG - Duplicating logic
const formatYTick = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
};

// ✅ CORRECT - Use shared utility
import { formatYTickByMetric } from '../../utils/chartFormatters';
tickFormat={(value) => formatYTickByMetric(value, metricType)}
```

### 3. Use Constants for Styling

```typescript
// ❌ WRONG - Hardcoded values
padding={{ left: 50, right: 10, top: 10, bottom: 30 }}
style={{ grid: { stroke: 'lightgray', strokeDasharray: '3,3' } }}

// ✅ CORRECT - Use constants
import { CHART_PADDING, GRID_STYLES } from '../../utils/chartConstants';
const leftPadding = calculateLeftPaddingByMetric(metricType);

padding={{
  left: leftPadding,
  right: CHART_PADDING.right,
  top: CHART_PADDING.top,
  bottom: CHART_PADDING.bottomBase,
}}
style={{
  grid: { stroke: GRID_STYLES.stroke, strokeDasharray: GRID_STYLES.strokeDasharray },
}}
```

### 4. Export Filenames

Use descriptive, metric-specific filenames for data exports:

```typescript
exportFilename={`chart-name-${metricType}`}
// Examples: "usage-trends-requests", "model-usage-cost"
```

### 5. Chart Key for Remounting

Generate unique keys from data to force chart remount on data changes:

```typescript
const chartKey = `chart-${metricType}-${data.length}-${data[0]?.value || 0}-${data[data.length - 1]?.value || 0}`;

<Chart key={chartKey} ... />
```

## Troubleshooting

### Problem: Tooltip not appearing or conflicting with other charts

**Solution**: Ensure unique SVG filter ID

```typescript
// Change from:
<filter id="tooltip-shadow" ... />
filter="url(#tooltip-shadow)"

// To:
<filter id="tooltip-shadow-myChart" ... />
filter="url(#tooltip-shadow-myChart)"
```

### Problem: Y-axis labels cut off

**Solution**: Use proper left padding calculation

```typescript
const leftPadding = calculateLeftPaddingByMetric(metricType);
```

### Problem: Too many X-axis labels overlapping

**Solution**: Use automatic label skipping

```typescript
tickFormat={(value) => formatXTickWithSkipping(value, dateLabels)}
```

### Problem: Inconsistent formatting across charts

**Solution**: Always use shared formatters

```typescript
import { formatYTickByMetric } from '../../utils/chartFormatters';
// Use in all formatting contexts: axes, tooltips, accessibility data
```

### Problem: Chart not responsive

**Solution**: Implement ResizeObserver pattern

```typescript
const containerRef = React.useCallback((element: HTMLDivElement | null) => {
  if (resizeObserverRef.current) {
    resizeObserverRef.current.disconnect();
    resizeObserverRef.current = null;
  }
  if (element) {
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserverRef.current.observe(element);
  }
}, []);
```

### Problem: Grid lines not visible

**Solution**: Use GRID_STYLES constant

```typescript
import { GRID_STYLES } from '../../utils/chartConstants';

style={{
  grid: { stroke: GRID_STYLES.stroke, strokeDasharray: GRID_STYLES.strokeDasharray },
}}
```

## Reference Examples

See existing implementations for complete examples:

- **Line Chart**: `frontend/src/components/charts/UsageTrends.tsx`
- **Stacked Area Chart**: `frontend/src/components/charts/ModelUsageTrends.tsx`

Both components demonstrate:

- Proper use of shared utilities
- Accessibility implementation
- Responsive behavior
- Custom tooltip with smart positioning
- Theme support (light/dark)

---

**Questions or Issues?**

- Check the [Pattern Reference Guide](./pattern-reference.md) for quick reference
- Review [Frontend CLAUDE.md](../../frontend/CLAUDE.md) for component development guidelines
- Examine existing chart components for working examples

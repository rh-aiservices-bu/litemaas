import React from 'react';
import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLine,
  ChartScatter,
  createContainer,
} from '@patternfly/react-charts/victory';
import { VictoryTooltip } from 'victory';
import { Skeleton } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { LineChartDataPoint } from '../../utils/chartDataTransformers';
import AccessibleChart, { AccessibleChartData } from './AccessibleChart';
import AccessibleLegend, { LegendItem } from './AccessibleLegend';
import {
  getMetricColor,
  getMetricStrokePattern,
  generateChartAriaDescription,
} from '../../utils/chartAccessibility';
import {
  formatYTickByMetric,
  formatXTickWithSkipping,
  calculateLeftPaddingByMetric,
} from '../../utils/chartFormatters';
import { GRID_STYLES, AXIS_STYLES } from '../../utils/chartConstants';

export interface UsageTrendsProps {
  data: LineChartDataPoint[];
  loading?: boolean;
  height?: number;
  metricType?: 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens';
  title?: string;
  description?: string;
}

const UsageTrends: React.FC<UsageTrendsProps> = ({
  data = [],
  loading = false,
  height = 250,
  metricType = 'requests',
  title,
  description,
}) => {
  const { t } = useTranslation();
  const [containerWidth, setContainerWidth] = React.useState(600);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  // Measure container width for responsive chart sizing using ref callback
  // This pattern ensures ResizeObserver reconnects when element remounts (e.g., after view toggle)
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

  if (loading) {
    return <Skeleton height={`${height}px`} width="100%" />;
  }

  if (!data || data.length === 0) {
    // Enhanced no-data message with better context and accessibility
    const metricDisplayName = t(`pages.usage.metrics.${metricType}`).toLowerCase();
    const noDataMessage = (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '2rem',
        }}
        role="status"
        aria-live="polite"
        aria-labelledby="no-data-title"
        aria-describedby="no-data-description"
      >
        <div
          id="no-data-title"
          style={{
            fontSize: 'var(--pf-t--global--font--size--body--lg)',
            marginBottom: '1rem',
            color: 'var(--pf-t--global--text--color--subtle)',
          }}
        >
          {t('pages.usage.charts.noDataAvailable')}
        </div>
        <div
          id="no-data-description"
          style={{
            fontSize: 'var(--pf-t--global--font--size--body--sm)',
            color: 'var(--pf-t--global--text--color--subtle)',
          }}
        >
          {t('pages.usage.charts.noDataExplanation', {
            metricType: metricDisplayName,
          })}
        </div>
        <div
          style={{
            fontSize: 'var(--pf-t--global--font--size--sm)',
            color: 'var(--pf-t--global--text--color--subtle)',
            marginTop: '0.75rem',
            maxWidth: '400px',
          }}
        >
          {t('pages.usage.charts.noDataSuggestions', {
            metricType: metricDisplayName,
          })}
        </div>
        {/* Screen reader specific announcement */}
        <div className="pf-v6-screen-reader">
          {t('pages.usage.charts.noDataScreenReader', {
            chartType: t('common.lineChart'),
            metricType: metricDisplayName,
            timeframe: title?.toLowerCase().includes('7')
              ? t('pages.usage.dateRanges.last7Days')
              : title?.toLowerCase().includes('30')
                ? t('pages.usage.dateRanges.last30Days')
                : title?.toLowerCase().includes('90')
                  ? t('pages.usage.dateRanges.last90Days')
                  : t('pages.usage.filters.custom'),
          })}
        </div>
      </div>
    );

    return (
      <AccessibleChart
        data={[]}
        title={title || t('pages.usage.charts.usageTrends')}
        description={t('pages.usage.charts.noDataDescription', { metricType: metricDisplayName })}
        summary={t('pages.usage.charts.noDataSummary', {
          chartType: t('common.lineChart'),
          metricType: metricDisplayName,
        })}
        chartType="line"
        allowExport={false}
        showViewToggle={false}
        ariaDescribedBy="no-data-description"
      >
        {noDataMessage}
      </AccessibleChart>
    );
  }

  // Ensure data has numeric x values
  const chartData = data.map((d, index) => ({
    x: index,
    y: d.y || 0,
  }));

  // Extract date labels from the data
  const extractDateFromLabel = (label?: string) => {
    if (!label) return '';
    // Labels are in format "MMM DD: X requests/tokens/cost"
    const match = label.match(/^([^:]+):/);
    return match ? match[1] : '';
  };

  // Create x-axis labels from data
  const xAxisLabels = data.map((d) => extractDateFromLabel(d.label));

  // Calculate Y domain
  const yValues = chartData.map((d) => d.y);
  const maxY = Math.max(...yValues, 1);

  // Transform data for accessibility
  const accessibleData: AccessibleChartData[] = data.map((point, index) => ({
    label: extractDateFromLabel(point.label) || `${t('common.day')} ${index + 1}`,
    value: point.y || 0,
    additionalInfo: {
      rawValue: point.y || 0,
      value: formatYTickByMetric(point.y || 0, metricType),
      date: extractDateFromLabel(point.label) || '',
    },
  }));

  // Format value function for accessibility
  const formatAccessibleValue = (value: number | string) => {
    if (typeof value === 'string') return value;
    return formatYTickByMetric(value, metricType);
  };

  // Generate chart description
  const chartDescription =
    description ||
    t('pages.usage.charts.lineChartDescription', {
      metricType: t(`pages.usage.metrics.${metricType}`),
    });

  // Generate comprehensive summary
  // yValues is already declared above
  const minValue = Math.min(...yValues);
  const maxValue = Math.max(...yValues);
  const avgValue = yValues.reduce((sum, val) => sum + val, 0) / yValues.length;
  const trend = yValues[yValues.length - 1] > yValues[0] ? 'increasing' : 'decreasing';

  const chartSummary = t('pages.usage.charts.usageTrendsSummary', {
    totalPoints: data.length,
    minValue: formatYTickByMetric(minValue, metricType),
    maxValue: formatYTickByMetric(maxValue, metricType),
    avgValue: formatYTickByMetric(Math.round(avgValue), metricType),
    trend: t(`pages.usage.charts.trend.${trend}`),
  });

  // Generate unique key from data to force chart remount on data change
  const chartKey = `chart-${metricType}-${data.length}-${data[0]?.y || 0}-${data[data.length - 1]?.y || 0}`;

  // Calculate left padding based on metric type for Y-axis labels visibility
  const leftPadding = calculateLeftPaddingByMetric(metricType);

  // Calculate integer tick values for requests metric to avoid decimal subdivisions
  const yTickValues =
    metricType === 'requests'
      ? (() => {
          const maxVal = Math.ceil(maxY);
          // Generate reasonable number of ticks (max 10)
          if (maxVal <= 10) {
            return Array.from({ length: maxVal + 1 }, (_, i) => i);
          } else {
            const step = Math.ceil(maxVal / 8);
            const ticks: number[] = [];
            for (let i = 0; i <= maxVal; i += step) {
              ticks.push(i);
            }
            if (ticks[ticks.length - 1] !== maxVal) {
              ticks.push(maxVal);
            }
            return ticks;
          }
        })()
      : undefined;

  // Create cursor and voronoi container for interactive tooltips
  // Note: Container order is important - "cursor" renders first, "voronoi" (tooltip) renders on top
  const CursorVoronoiContainer = createContainer('cursor', 'voronoi');

  // Custom flyout component for tooltip with formatted values
  // Uses native SVG elements for proper rendering with dark background
  // Implements smart positioning to avoid overflow at chart edges
  const CustomFlyout = (props: any) => {
    const { datum, x, y } = props;
    if (!datum) return null;

    const xValue = Math.round(datum.x);
    const dateLabel = xAxisLabels[xValue] || '';
    const value = datum.y || 0;
    const formattedValue = formatYTickByMetric(value, metricType);
    const unit = metricType === 'requests' ? ' requests' : metricType === 'tokens' ? ' tokens' : '';

    // Calculate tooltip dimensions
    const padding = 12;
    const titleHeight = 20;
    const tooltipWidth = 180;
    const tooltipHeight = titleHeight + padding * 2;
    const pointerSize = 8;
    const edgeMargin = 10; // Minimum distance from chart edges

    // Calculate chart boundaries (accounting for padding)
    const chartTop = 10; // padding.top
    const chartBottom = height - 30; // padding.bottom
    const chartLeft = leftPadding;
    const chartRight = containerWidth - 10; // padding.right

    // Smart vertical positioning: above or below cursor
    let tooltipY: number;
    let pointerDirection: 'up' | 'down';
    const spaceAbove = y - chartTop;
    const spaceBelow = chartBottom - y;
    const requiredSpace = tooltipHeight + pointerSize + edgeMargin;

    if (spaceAbove >= requiredSpace || spaceAbove > spaceBelow) {
      // Position above cursor (default/preferred)
      tooltipY = y - tooltipHeight - pointerSize - edgeMargin;
      pointerDirection = 'down'; // Pointer points down to cursor
    } else {
      // Position below cursor (not enough space above)
      tooltipY = y + pointerSize + edgeMargin;
      pointerDirection = 'up'; // Pointer points up to cursor
    }

    // Smart horizontal positioning: center, left-align, or right-align
    let tooltipX = x - tooltipWidth / 2; // Default: centered on cursor
    let pointerX = x; // Pointer always points to cursor x position

    // Check left edge overflow
    if (tooltipX < chartLeft + edgeMargin) {
      tooltipX = chartLeft + edgeMargin;
    }
    // Check right edge overflow
    else if (tooltipX + tooltipWidth > chartRight - edgeMargin) {
      tooltipX = chartRight - edgeMargin - tooltipWidth;
    }

    // Ensure pointer X stays within tooltip bounds (with some margin for aesthetics)
    const pointerMinX = tooltipX + pointerSize + 4;
    const pointerMaxX = tooltipX + tooltipWidth - pointerSize - 4;
    if (pointerX < pointerMinX) pointerX = pointerMinX;
    if (pointerX > pointerMaxX) pointerX = pointerMaxX;

    return (
      <g>
        {/* Drop shadow filter */}
        <defs>
          <filter id="tooltip-shadow-usage" x="-50%" y="-50%" width="200%" height="200%">
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

        {/* Tooltip background with rounded corners */}
        <rect
          x={tooltipX}
          y={tooltipY}
          width={tooltipWidth}
          height={tooltipHeight}
          rx="4"
          ry="4"
          fill="#151515"
          stroke="#3c3f42"
          strokeWidth="1"
          filter="url(#tooltip-shadow-usage)"
        />

        {/* Callout pointer (triangle) - orientation depends on position */}
        {pointerDirection === 'down' ? (
          // Pointer pointing down (tooltip above cursor)
          <path
            d={`M ${pointerX - pointerSize},${tooltipY + tooltipHeight} L ${pointerX},${tooltipY + tooltipHeight + pointerSize} L ${pointerX + pointerSize},${tooltipY + tooltipHeight} Z`}
            fill="#151515"
            stroke="#3c3f42"
            strokeWidth="1"
          />
        ) : (
          // Pointer pointing up (tooltip below cursor)
          <path
            d={`M ${pointerX - pointerSize},${tooltipY} L ${pointerX},${tooltipY - pointerSize} L ${pointerX + pointerSize},${tooltipY} Z`}
            fill="#151515"
            stroke="#3c3f42"
            strokeWidth="1"
          />
        )}

        {/* Title (date and value) */}
        <text
          x={tooltipX + padding}
          y={tooltipY + padding + 14}
          fill="#ffffff"
          fontSize="12"
          fontWeight="bold"
        >
          {dateLabel}: {formattedValue}
          {unit}
        </text>
      </g>
    );
  };

  return (
    <AccessibleChart
      data={accessibleData}
      title={title || t('pages.usage.charts.usageTrends')}
      description={chartDescription}
      summary={chartSummary}
      chartType="line"
      formatValue={formatAccessibleValue}
      exportFilename={`usage-trends-${metricType}`}
      additionalHeaders={[t('pages.usage.tableHeaders.date'), t('common.value')]}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height }}
        role="img"
        tabIndex={0}
        onFocus={(_event) => {
          // Announce chart focus for screen readers
          const announcement = t('pages.usage.charts.chartFocused', {
            chartType: t('common.lineChart'),
            dataPoints: data.length,
          });
          // Create temporary live region for announcement
          const liveRegion = document.createElement('div');
          liveRegion.setAttribute('aria-live', 'polite');
          liveRegion.setAttribute('aria-atomic', 'true');
          liveRegion.style.position = 'absolute';
          liveRegion.style.left = '-10000px';
          liveRegion.textContent = announcement;
          document.body.appendChild(liveRegion);
          setTimeout(() => document.body.removeChild(liveRegion), 1000);
        }}
      >
        <Chart
          key={chartKey}
          height={height}
          padding={{ bottom: 30, left: leftPadding, right: 10, top: 10 }}
          domain={{
            y: yTickValues ? [0, Math.max(...yTickValues)] : [0, maxY * 1.1],
            x: data.length === 1 ? [-0.5, 0.5] : [0, data.length - 1],
          }}
          ariaDesc={generateChartAriaDescription('line', data.length, metricType)}
          width={containerWidth}
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
          animate={{
            duration: 1000,
            onLoad: { duration: 1 },
          }}
        >
          <ChartAxis
            tickFormat={(value) => formatXTickWithSkipping(value, xAxisLabels)}
            tickValues={data.length === 1 ? [0] : undefined}
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
            tickValues={yTickValues}
            tickFormat={(value) =>
              formatYTickByMetric(metricType === 'requests' ? Math.round(value) : value, metricType)
            }
            style={{
              tickLabels: { fontSize: AXIS_STYLES.tickLabelFontSize },
              grid: { stroke: GRID_STYLES.stroke, strokeDasharray: GRID_STYLES.strokeDasharray },
            }}
          />
          <ChartGroup>
            <ChartLine
              data={chartData}
              style={{
                data: {
                  stroke: getMetricColor(metricType),
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  strokeDasharray: getMetricStrokePattern(metricType),
                  fill: 'none', // Ensure line is not filled
                },
                parent: {
                  border: '1px solid transparent',
                },
              }}
            />
            <ChartScatter
              data={chartData}
              symbol="diamond"
              style={{
                data: {
                  stroke: getMetricColor(metricType),
                  strokeWidth: 3,
                  fill: getMetricColor(metricType),
                },
                parent: {
                  border: '1px solid transparent',
                },
              }}
            />
          </ChartGroup>
        </Chart>

        {/* Accessible legend showing line pattern and color */}
        <div className="pf-v6-screen-reader">
          <AccessibleLegend
            items={[
              {
                name: t(`pages.usage.metrics.${metricType}`),
                color: getMetricColor(metricType),
                pattern: getMetricStrokePattern(metricType),
                description: t('pages.usage.charts.legendDescription', {
                  metricType: t(`pages.usage.metrics.${metricType}`).toLowerCase(),
                }),
                value: data.length > 0 ? `${data.length} ${t('common.dataPoints')}` : undefined,
              } as LegendItem,
            ]}
            title={t('ui.accessibility.chartLegend')}
            orientation="horizontal"
            showPatternIndicator={true}
          />
        </div>
      </div>
    </AccessibleChart>
  );
};

export default UsageTrends;

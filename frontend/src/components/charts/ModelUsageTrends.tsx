import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chart,
  ChartAxis,
  ChartStack,
  ChartThemeColor,
  ChartArea,
  ChartGroup,
  ChartScatter,
  createContainer,
  getCustomTheme,
} from '@patternfly/react-charts/victory';
import { VictoryTooltip } from 'victory';
import { Skeleton } from '@patternfly/react-core';
import { DailyModelUsage } from '../../services/adminUsage.service';
import { transformDailyModelUsageToStackedChart } from '../../utils/chartDataTransformers';
import AccessibleChart, { AccessibleChartData } from './AccessibleChart';
import AccessibleLegend, { LegendItem } from './AccessibleLegend';
import { generateChartAriaDescription } from '../../utils/chartAccessibility';
import {
  formatYTickByMetric,
  formatXTickWithSkipping,
  calculateLeftPaddingByMetric,
} from '../../utils/chartFormatters';
import { CHART_PADDING, GRID_STYLES, AXIS_STYLES } from '../../utils/chartConstants';

export interface ModelUsageTrendsProps {
  data: DailyModelUsage[];
  loading?: boolean;
  height?: number;
  metricType: 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens';
  title?: string;
  description?: string;
}

/**
 * ModelUsageTrends Component
 * Displays model usage trends over time as a multi-colored stacked chart
 */
const ModelUsageTrends: React.FC<ModelUsageTrendsProps> = React.memo(
  ({ data = [], loading = false, height = 400, metricType, title, description }) => {
    const { t } = useTranslation();
    const [legendExtraHeight, setLegendExtraHeight] = React.useState(0);
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
      return (
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
        >
          <div
            style={{
              fontSize: 'var(--pf-t--global--font--size--body--lg)',
              marginBottom: '1rem',
              color: 'var(--pf-t--global--text--color--subtle)',
            }}
          >
            {t('adminUsage.charts.noDataAvailable', 'No data available')}
          </div>
          <div
            style={{
              fontSize: 'var(--pf-t--global--font--size--body--sm)',
              color: 'var(--pf-t--global--text--color--subtle)',
            }}
          >
            {t(
              'adminUsage.charts.noModelDataExplanation',
              'No model usage data available for the selected time period.',
            )}
          </div>
        </div>
      );
    }

    // Transform data for the selected metric
    const { chartData, modelNames } = transformDailyModelUsageToStackedChart(data, metricType);

    // Extract date labels for x-axis (similar to UsageTrends)
    const dateLabels = chartData.map((d) => d.date);

    if (chartData.length === 0 || modelNames.length === 0) {
      return (
        <div
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pf-t--global--text--color--subtle)',
          }}
        >
          {t('adminUsage.charts.noModelData', 'No model data available')}
        </div>
      );
    }

    // Create legend data with childName for tooltip matching
    const legendData = modelNames.map((name) => ({ childName: name, name }));

    // Get color scale from multiUnordered theme for consistent color assignment
    const theme = getCustomTheme(ChartThemeColor.multiUnordered, {});
    const colorScale = theme.group?.colorScale || theme.line?.colorScale || [];

    // Pre-compute bar chart data for better performance (avoid inline .map() in JSX)
    // Assign explicit colors to each model based on their index in the sorted array
    const barChartData = modelNames.map((modelName, modelIndex) => {
      const seriesData = chartData.map((d, dataIndex) => {
        const value = Number(d[modelName]) || 0;
        return {
          x: dataIndex,
          y: value || 0,
          name: modelName,
        };
      });

      // Check if this series has at least one non-zero value
      const hasData = seriesData.some((point) => point.y > 0);

      return {
        modelName,
        color: colorScale[modelIndex % colorScale.length],
        data: seriesData,
        hasData, // Flag to indicate if this series should be rendered
      };
    });

    // Generate unique key from data to force chart remount on data change
    const chartKey = `model-chart-${metricType}-${chartData.length}-${modelNames.length}-${chartData[0]?.[modelNames[0]] || 0}`;

    // Calculate bottom padding: base (75px) + legend extra height from wrapping
    const bottomPadding = CHART_PADDING.bottomWithLegend + legendExtraHeight;

    // Calculate left padding based on metric type for Y-axis labels visibility
    const leftPadding = calculateLeftPaddingByMetric(metricType);

    // Transform data for accessibility - create data points per date with model breakdown
    // Store raw values for export and formatted values for display
    const accessibleData: AccessibleChartData[] = chartData.map((point) => {
      const totalValue = modelNames.reduce((sum, model) => sum + (Number(point[model]) || 0), 0);
      const modelBreakdown = modelNames
        .map((model) => `${model}: ${formatYTickByMetric(Number(point[model]) || 0, metricType)}`)
        .join(', ');

      // Build additionalInfo with both raw and formatted values
      const additionalInfo: { [key: string]: string | number } = {
        date: point.date,
        value: formatYTickByMetric(totalValue, metricType), // Formatted for display
        valueRaw: totalValue, // Raw for export (matches ${key}Raw pattern)
        modelbreakdown: modelBreakdown, // Formatted for display
      };

      // Add raw values for each model (for CSV export)
      modelNames.forEach((modelName) => {
        const modelKey = modelName.toLowerCase().replace(/\s+/g, '');
        const rawValue = Number(point[modelName]) || 0;
        additionalInfo[`${modelKey}Raw`] = rawValue;
        additionalInfo[`${modelKey}`] = formatYTickByMetric(rawValue, metricType); // Formatted version
      });

      return {
        label: point.date,
        value: totalValue,
        additionalInfo,
      };
    });

    // Format value function for accessibility
    const formatAccessibleValue = (value: number | string) => {
      if (typeof value === 'string') return value;
      return formatYTickByMetric(value, metricType);
    };

    // Generate chart description
    const chartDescription =
      description ||
      t('adminUsage.charts.modelUsageTrendsDescription', 'Model usage breakdown over time');

    // Generate comprehensive summary
    const totalValues = chartData.map((d) =>
      modelNames.reduce((sum, model) => sum + (Number(d[model]) || 0), 0),
    );
    const minValue = Math.min(...totalValues);
    const maxValueTotal = Math.max(...totalValues);
    const avgValue = totalValues.reduce((sum, val) => sum + val, 0) / totalValues.length;

    const chartSummary = t('adminUsage.charts.modelUsageSummary', {
      defaultValue:
        'Stacked chart with {{dataPoints}} data points showing {{modelCount}} models. Total values range from {{minValue}} to {{maxValue}}, with an average of {{avgValue}}.',
      dataPoints: chartData.length,
      modelCount: modelNames.length,
      minValue: formatYTickByMetric(minValue, metricType),
      maxValue: formatYTickByMetric(maxValueTotal, metricType),
      avgValue: formatYTickByMetric(Math.round(avgValue), metricType),
    });

    // Calculate integer tick values for requests metric to avoid decimal subdivisions
    const yTickValues =
      metricType === 'requests'
        ? (() => {
            const maxVal = Math.ceil(maxValueTotal);
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

    // Custom flyout component for tooltip that only shows models with non-zero values
    // Uses native SVG elements for proper rendering with dark background
    // Implements smart positioning to avoid overflow at chart edges
    const CustomFlyout = (props: any) => {
      const { datum, x, y } = props;
      if (!datum) return null;

      const xValue = Math.round(datum.x);
      const dateLabel = dateLabels[xValue] || '';

      // Filter to only show models with non-zero values at this x-coordinate
      const modelsWithData = barChartData
        .map((series) => {
          const dataPoint = series.data[xValue];
          if (!dataPoint || dataPoint.y === 0) return null;
          return {
            name: series.modelName,
            value: dataPoint.y,
            color: series.color,
          };
        })
        .filter((item): item is { name: string; value: number; color: string } => item !== null);

      if (modelsWithData.length === 0) return null;

      // Calculate total value for all models at this date
      const totalValue = modelsWithData.reduce((sum, model) => sum + model.value, 0);
      const formattedTotal = formatYTickByMetric(totalValue, metricType);
      const unit =
        metricType === 'requests' ? ' requests' : metricType === 'tokens' ? ' tokens' : '';

      // Calculate tooltip dimensions
      const padding = 12;
      const titleHeight = 20;
      const lineHeight = 18;
      const colorBoxSize = 10;
      const colorBoxGap = 8;
      const maxNameWidth = 200;
      const tooltipWidth = maxNameWidth + colorBoxSize + colorBoxGap + padding * 2;
      const tooltipHeight = titleHeight + modelsWithData.length * lineHeight + padding * 2;
      const pointerSize = 8;
      const edgeMargin = 10; // Minimum distance from chart edges

      // Calculate chart boundaries (accounting for padding)
      const chartTop = 10; // padding.top
      const chartBottom = height - bottomPadding;
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
            <filter id="tooltip-shadow-model" x="-50%" y="-50%" width="200%" height="200%">
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
            filter="url(#tooltip-shadow-model)"
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

          {/* Title (date and total) */}
          <text
            x={tooltipX + padding}
            y={tooltipY + padding + 14}
            fill="#ffffff"
            fontSize="12"
            fontWeight="bold"
          >
            {dateLabel}: {formattedTotal}
            {unit}
          </text>

          {/* Model entries */}
          {modelsWithData.map((model, index) => {
            const entryY = tooltipY + padding + titleHeight + index * lineHeight;
            return (
              <g key={model.name}>
                {/* Color indicator box */}
                <rect
                  x={tooltipX + padding}
                  y={entryY}
                  width={colorBoxSize}
                  height={colorBoxSize}
                  fill={model.color}
                  rx="2"
                  ry="2"
                />
                {/* Model name and value */}
                <text
                  x={tooltipX + padding + colorBoxSize + colorBoxGap}
                  y={entryY + 9}
                  fill="#ffffff"
                  fontSize="11"
                >
                  {model.name.length > 25 ? model.name.substring(0, 25) + '...' : model.name}:{' '}
                  {formatYTickByMetric(model.value, metricType)}
                </text>
              </g>
            );
          })}
        </g>
      );
    };

    return (
      <AccessibleChart
        data={accessibleData}
        title={title || t('adminUsage.charts.modelUsageTrends', 'Model Usage Trends')}
        description={chartDescription}
        summary={chartSummary}
        chartType="bar"
        formatValue={formatAccessibleValue}
        exportFilename={`model-usage-trends-${metricType}`}
        additionalHeaders={[
          t('pages.usage.tableHeaders.date'),
          t('common.value'),
          // Include individual model columns for CSV export
          ...modelNames,
        ]}
      >
        <div
          ref={containerRef}
          style={{ width: '100%', height }}
          role="img"
          tabIndex={0}
          onFocus={(_event) => {
            // Announce chart focus for screen readers
            const announcement = t('adminUsage.charts.chartFocused', {
              defaultValue: '{{chartType}} chart focused with {{dataPoints}} data points',
              chartType: t('adminUsage.charts.stackedBar', 'Stacked bar'),
              dataPoints: chartData.length,
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
            ariaDesc={generateChartAriaDescription('stacked area', chartData.length, metricType)}
            colorScale={colorScale}
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
            domain={{
              x: chartData.length === 1 ? [-0.5, 0.5] : [0, chartData.length - 1],
            }}
            domainPadding={{ x: [20, 20] }}
            height={height}
            legendData={legendData}
            legendPosition="bottom-left"
            legendAllowWrap={(extraHeight) => setLegendExtraHeight(extraHeight)}
            padding={{
              bottom: bottomPadding, // Dynamic padding: base + legend wrap height
              left: leftPadding, // Dynamic padding for Y-axis label visibility
              right: 10,
              top: 10,
            }}
            themeColor={ChartThemeColor.multiUnordered}
            width={containerWidth}
          >
            <ChartAxis
              tickFormat={(value) => formatXTickWithSkipping(value, dateLabels)}
              tickValues={chartData.length === 1 ? [0] : undefined}
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
                formatYTickByMetric(
                  metricType === 'requests' ? Math.round(value) : value,
                  metricType,
                )
              }
              style={{
                tickLabels: { fontSize: AXIS_STYLES.tickLabelFontSize },
                grid: { stroke: GRID_STYLES.stroke, strokeDasharray: GRID_STYLES.strokeDasharray },
              }}
            />
            {chartData.length === 1 ? (
              // Single day: use scatter points for each model
              <ChartGroup>
                {barChartData
                  .filter(({ data }) => data[0]?.y > 0) // Only show models with data
                  .map(({ modelName, data, color }) => (
                    <ChartScatter
                      key={modelName}
                      data={data}
                      name={modelName}
                      symbol="diamond"
                      size={7}
                      style={{
                        data: {
                          fill: color,
                          stroke: color,
                          strokeWidth: 2,
                        },
                      }}
                    />
                  ))}
              </ChartGroup>
            ) : (
              // Multiple days: use stacked area chart
              <ChartStack>
                {barChartData.map(({ modelName, data, color }) => (
                  <ChartArea
                    key={modelName}
                    data={data}
                    name={modelName}
                    labelComponent={<></>}
                    interpolation="monotoneX"
                    animate={{ duration: 1000, onLoad: { duration: 1 } }}
                    style={{
                      data: {
                        fill: color,
                        stroke: color,
                      },
                    }}
                  />
                ))}
              </ChartStack>
            )}
          </Chart>

          {/* Accessible legend showing model breakdown */}
          <div className="pf-v6-screen-reader">
            <AccessibleLegend
              items={modelNames.map(
                (modelName, modelIndex) =>
                  ({
                    name: modelName,
                    color: colorScale[modelIndex % colorScale.length],
                    description: t('adminUsage.charts.modelLegendDescription', {
                      defaultValue: 'Model {{modelName}} shown in the stacked chart',
                      modelName,
                    }),
                    value: `${chartData.length} ${t('common.dataPoints')}`,
                  }) as LegendItem,
              )}
              title={t('ui.accessibility.chartLegend')}
              orientation="horizontal"
            />
          </div>
        </div>
      </AccessibleChart>
    );
  },
);

ModelUsageTrends.displayName = 'ModelUsageTrends';

export default ModelUsageTrends;

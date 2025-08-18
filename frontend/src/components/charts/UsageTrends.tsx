import React from 'react';
import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLine,
  ChartScatter,
} from '@patternfly/react-charts/victory';
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

export interface UsageTrendsProps {
  data: LineChartDataPoint[];
  loading?: boolean;
  height?: number;
  metricType?: 'requests' | 'tokens' | 'cost';
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
            fontSize: '1.2rem',
            marginBottom: '1rem',
            color: 'var(--pf-v6-global--Color--200)',
          }}
        >
          {t('pages.usage.charts.noDataAvailable')}
        </div>
        <div
          id="no-data-description"
          style={{ fontSize: '0.9rem', color: 'var(--pf-v6-global--Color--300)' }}
        >
          {t('pages.usage.charts.noDataExplanation', {
            metricType: metricDisplayName,
          })}
        </div>
        <div
          style={{
            fontSize: '0.85rem',
            color: 'var(--pf-v6-global--Color--400)',
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

  // Format Y axis values
  const formatYTick = (value: number) => {
    switch (metricType) {
      case 'cost':
        return `$${value.toFixed(0)}`;
      case 'tokens':
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toString();
      default:
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toString();
    }
  };

  // Format X axis labels
  const formatXTick = (value: number) => {
    const label = xAxisLabels[Math.round(value)];
    if (!label) return '';

    // Show every nth label based on data length
    const dataLength = xAxisLabels.length;
    if (dataLength <= 7) return label;
    if (dataLength <= 14) {
      return Math.round(value) % 2 === 0 ? label : '';
    }
    return Math.round(value) % 3 === 0 ? label : '';
  };

  // Transform data for accessibility
  const accessibleData: AccessibleChartData[] = data.map((point, index) => ({
    label: extractDateFromLabel(point.label) || `${t('common.day')} ${index + 1}`,
    value: point.y || 0,
    additionalInfo: {
      rawValue: point.y || 0,
      formattedValue: formatYTick(point.y || 0),
      fullLabel: point.label || '',
    },
  }));

  // Format value function for accessibility
  const formatAccessibleValue = (value: number | string) => {
    if (typeof value === 'string') return value;
    return formatYTick(value);
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
    minValue: formatYTick(minValue),
    maxValue: formatYTick(maxValue),
    avgValue: formatYTick(Math.round(avgValue)),
    trend: t(`pages.usage.charts.trend.${trend}`),
  });

  return (
    <AccessibleChart
      data={accessibleData}
      title={title || t('pages.usage.charts.usageTrends')}
      description={chartDescription}
      summary={chartSummary}
      chartType="line"
      formatValue={formatAccessibleValue}
      exportFilename={`usage-trends-${metricType}`}
      additionalHeaders={[
        t('pages.usage.tableHeaders.date'),
        t('pages.usage.tableHeaders.formattedValue'),
      ]}
    >
      <div
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
          height={height}
          padding={{ bottom: 30, left: 10, right: 10, top: 10 }}
          domain={{ y: [0, maxY * 1.1], x: [0, data.length - 1] }}
          ariaDesc={generateChartAriaDescription('line', data.length, metricType)}
          ariaTitle={title || t('pages.usage.charts.usageTrends')}
        >
          <ChartAxis
            tickFormat={formatXTick}
            style={{
              tickLabels: { fontSize: 10, angle: -30, textAnchor: 'end' },
            }}
          />
          <ChartAxis
            dependentAxis
            showGrid
            tickFormat={formatYTick}
            style={{
              tickLabels: { fontSize: 10 },
              grid: { stroke: 'lightgray', strokeDasharray: '3,3' },
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
              animate={{
                duration: 1000,
                onLoad: { duration: 1 },
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

import React from 'react';
import {
  Chart,
  ChartArea,
  ChartAxis,
  ChartGroup,
  ChartLine,
  ChartThemeColor,
  ChartTooltip,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import {
  Skeleton,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Title,
  Bullseye,
  Content,
  ContentVariants,
} from '@patternfly/react-core';
import { ChartLineIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

import { LineChartDataPoint } from '../../utils/chartDataTransformers';
import { sanitizeChartDataArray, formatCurrency } from '../../utils/security.utils';
import { ComponentErrorBoundary } from '../ComponentErrorBoundary';

// Supported metric types for the line chart
export type MetricType = 'requests' | 'tokens' | 'cost';

export interface UsageLineChartProps {
  /** Chart data points array */
  data: LineChartDataPoint[];
  /** Type of metric being displayed */
  metricType: MetricType;
  /** Loading state indicator */
  loading?: boolean;
  /** Chart height in pixels */
  height?: number;
  /** Chart width in pixels or 'auto' for responsive */
  width?: number | 'auto';
  /** Optional title for the chart */
  title?: string;
  /** Whether to show the chart area fill */
  showArea?: boolean;
  /** Custom color theme */
  themeColor?: typeof ChartThemeColor[keyof typeof ChartThemeColor];
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * UsageLineChart - Interactive line chart component for usage metrics
 * Built with PatternFly React Charts (Victory-based)
 * Displays trends over time with proper formatting and accessibility
 */
const UsageLineChart: React.FC<UsageLineChartProps> = ({
  data = [],
  metricType,
  loading = false,
  height = 300,
  width = 'auto',
  title,
  showArea = false,
  themeColor = ChartThemeColor.blue,
  ariaLabel,
}) => {
  const { t } = useTranslation();

  // Format value based on metric type
  const formatValue = (value: number): string => {
    switch (metricType) {
      case 'cost':
        return formatCurrency(value);
      case 'tokens':
        return value >= 1000000
          ? `${(value / 1000000).toFixed(1)}M`
          : value >= 1000
            ? `${(value / 1000).toFixed(1)}K`
            : value.toString();
      case 'requests':
      default:
        return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString();
    }
  };

  // Get metric unit for display
  const getMetricUnit = (): string => {
    switch (metricType) {
      case 'cost':
        return t('pages.usage.metrics.currency');
      case 'tokens':
        return t('pages.usage.metrics.tokens');
      case 'requests':
      default:
        return t('pages.usage.metrics.requests');
    }
  };

  // Get default aria label
  const getAriaLabel = (): string => {
    return (
      ariaLabel ||
      t('pages.usage.charts.lineChartAriaLabel', {
        metric: getMetricUnit(),
      })
    );
  };

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ height, width: width === 'auto' ? '100%' : width }}>
        <Skeleton height="20px" width="60%" style={{ marginBottom: '16px' }} />
        <Skeleton height={`${height - 40}px`} width="100%" />
      </div>
    );
  }

  // Sanitize and validate data
  const validatedData = sanitizeChartDataArray(data);

  // Empty state when no data
  if (validatedData.length === 0) {
    return (
      <div style={{ height, width: width === 'auto' ? '100%' : width }}>
        <Bullseye>
          <EmptyState variant={EmptyStateVariant.sm}>
            <ChartLineIcon />
            <Title headingLevel="h4" size="md">
              {t('pages.usage.charts.noDataTitle')}
            </Title>
            <EmptyStateBody>
              <Content component={ContentVariants.small}>
                {t('pages.usage.charts.noDataDescription')}
              </Content>
            </EmptyStateBody>
          </EmptyState>
        </Bullseye>
      </div>
    );
  }

  // Calculate domain for better chart scaling
  const yValues = validatedData.map((d) => d.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yPadding = (maxY - minY) * 0.1; // 10% padding

  const domainY: [number, number] = [
    Math.max(0, minY - yPadding), // Don't go below 0 for metrics
    maxY + yPadding,
  ];


  return (
    <ComponentErrorBoundary>
      <div style={{ height, width: width === 'auto' ? '100%' : width }}>
        {title && (
          <Title headingLevel="h4" size="md" style={{ marginBottom: '16px' }}>
            {title}
          </Title>
        )}

        <Chart
          ariaTitle={getAriaLabel()}
          containerComponent={
            <ChartVoronoiContainer
              labels={({ datum }) => `${datum.label || `${datum.x}: ${datum.y}`}`}
              labelComponent={<ChartTooltip />}
              voronoiDimension="x"
            />
          }
          domain={{ y: domainY }}
          height={height}
          width={width === 'auto' ? undefined : width}
          themeColor={themeColor}
          padding={{ left: 60, top: 20, right: 40, bottom: 40 }}
        >
          <ChartAxis
            dependentAxis
            tickFormat={(value) => formatValue(value)}
            style={{
              tickLabels: { fontSize: 12, fill: 'var(--pf-v6-global--Color--200)' },
              grid: { stroke: 'var(--pf-v6-global--BorderColor--100)' },
            }}
          />
          <ChartAxis
            style={{
              tickLabels: { fontSize: 12, fill: 'var(--pf-v6-global--Color--200)' },
              axis: { stroke: 'var(--pf-v6-global--BorderColor--200)' },
            }}
          />

          {showArea ? (
            <ChartGroup>
              <ChartArea
                data={validatedData}
                style={{
                  data: {
                    fillOpacity: 0.2,
                    stroke: 'var(--pf-v6-global--primary--color--100)',
                    strokeWidth: 2,
                  },
                }}
              />
              <ChartLine
                data={validatedData}
                style={{
                  data: {
                    stroke: 'var(--pf-v6-global--primary--color--100)',
                    strokeWidth: 2,
                  },
                }}
              />
            </ChartGroup>
          ) : (
            <ChartLine
              data={validatedData}
              style={{
                data: {
                  stroke: 'var(--pf-v6-global--primary--color--100)',
                  strokeWidth: 2,
                },
              }}
            />
          )}
        </Chart>
      </div>
    </ComponentErrorBoundary>
  );
};

export default UsageLineChart;

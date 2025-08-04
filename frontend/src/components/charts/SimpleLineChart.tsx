import React from 'react';
import {
  Chart,
  ChartAxis,
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
import { formatCurrency } from '../../utils/security.utils';

export type MetricType = 'requests' | 'tokens' | 'cost';

export interface SimpleLineChartProps {
  data: LineChartDataPoint[];
  metricType?: MetricType;
  loading?: boolean;
  height?: number;
  width?: number | 'auto';
  title?: string;
  themeColor?: any;
}

/**
 * SimpleLineChart - A simplified line chart component that avoids Victory bugs
 */
const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data = [],
  metricType = 'requests',
  loading = false,
  height = 300,
  width = 'auto',
  title,
  themeColor = ChartThemeColor.blue,
}) => {
  const { t } = useTranslation();

  // Format value based on metric type
  const formatValue = (value: number): string => {
    if (!value && value !== 0) return '0';
    
    switch (metricType) {
      case 'cost':
        return formatCurrency(value);
      case 'tokens':
        return value >= 1000000
          ? `${(value / 1000000).toFixed(1)}M`
          : value >= 1000
            ? `${(value / 1000).toFixed(1)}K`
            : value.toString();
      default:
        return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString();
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <Skeleton height="20px" width="60%" style={{ marginBottom: '16px' }} />
        <Skeleton height={`${height - 40}px`} width="100%" />
      </div>
    );
  }

  // Empty state when no data
  if (!data || data.length === 0) {
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

  // Ensure data is valid
  const validData = data.filter((d) => 
    d && 
    typeof d.x !== 'undefined' && 
    typeof d.y !== 'undefined' &&
    !isNaN(d.y)
  );

  if (validData.length === 0) {
    return (
      <div style={{ height, width: width === 'auto' ? '100%' : width }}>
        <Bullseye>
          <EmptyState variant={EmptyStateVariant.sm}>
            <ChartLineIcon />
            <Title headingLevel="h4" size="md">
              Invalid Data
            </Title>
            <EmptyStateBody>
              <Content component={ContentVariants.small}>
                The data provided is invalid or empty
              </Content>
            </EmptyStateBody>
          </EmptyState>
        </Bullseye>
      </div>
    );
  }

  // Calculate domain
  const yValues = validData.map((d) => d.y);
  const maxY = Math.max(...yValues, 1); // Ensure at least 1 to avoid division by zero
  const minY = Math.min(...yValues, 0);
  const yPadding = (maxY - minY) * 0.1 || 1;

  return (
    <div style={{ height, width: width === 'auto' ? '100%' : width }}>
      {title && (
        <Title headingLevel="h4" size="md" style={{ marginBottom: '16px' }}>
          {title}
        </Title>
      )}

      <Chart
        ariaTitle={`${metricType} usage chart`}
        containerComponent={
          <ChartVoronoiContainer
            labels={({ datum }) => {
              if (datum && datum.label) return datum.label;
              if (datum && typeof datum.y !== 'undefined') {
                return formatValue(datum.y);
              }
              return '';
            }}
            labelComponent={<ChartTooltip />}
          />
        }
        domain={{ 
          x: [0, Math.max(validData.length - 1, 1)],
          y: [Math.max(0, minY - yPadding), maxY + yPadding] 
        }}
        height={height}
        width={width === 'auto' ? undefined : width}
        themeColor={themeColor}
        padding={{ left: 70, top: 20, right: 20, bottom: 50 }}
      >
        <ChartAxis
          dependentAxis
          tickFormat={(t) => formatValue(t)}
          style={{
            tickLabels: { fontSize: 12 },
            grid: { stroke: '#e0e0e0', strokeWidth: 0.5 },
          }}
        />
        <ChartAxis
          fixLabelOverlap={true}
          style={{
            tickLabels: { fontSize: 10, angle: -45 },
          }}
        />
        <ChartLine
          data={validData}
          interpolation="monotoneX"
          style={{
            data: { 
              stroke: '#0066cc',
              strokeWidth: 2,
            },
          }}
        />
      </Chart>
    </div>
  );
};

export default SimpleLineChart;
import React from 'react';
import {
  Chart,
  ChartAxis,
  ChartLine,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import {
  Skeleton,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Title,
  Bullseye,
} from '@patternfly/react-core';
import { ChartLineIcon } from '@patternfly/react-icons';

export interface SafeLineChartProps {
  data: Array<{ x: number; y: number }>;
  loading?: boolean;
  height?: number;
  width?: number;
  metricType?: 'requests' | 'tokens' | 'cost';
}

const SafeLineChart: React.FC<SafeLineChartProps> = ({
  data = [],
  loading = false,
  height = 250,
  width = 600,
  metricType = 'requests',
}) => {
  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <Skeleton height={`${height}px`} width="100%" />
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div style={{ height, width: '100%' }}>
        <Bullseye>
          <EmptyState variant={EmptyStateVariant.sm}>
            <ChartLineIcon />
            <Title headingLevel="h4" size="md">
              No data available
            </Title>
            <EmptyStateBody>
              Select a date range with available data
            </EmptyStateBody>
          </EmptyState>
        </Bullseye>
      </div>
    );
  }

  // Ensure data is properly formatted - Victory needs numeric x and y
  const safeData = data.map((point, index) => ({
    x: typeof point.x === 'number' ? point.x : index,
    y: typeof point.y === 'number' ? point.y : 0,
  }));

  // Calculate Y axis domain
  const yValues = safeData.map(d => d.y);
  const maxY = Math.max(...yValues, 1);

  // Format Y axis labels based on metric type
  const formatYTick = (value: number) => {
    switch (metricType) {
      case 'cost':
        return `$${value.toFixed(0)}`;
      case 'tokens':
        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
        return value.toString();
      default:
        return value.toString();
    }
  };

  try {
    return (
      <div style={{ height, width: '100%' }}>
        <Chart
          height={height}
          width={width}
          padding={{ bottom: 50, left: 80, right: 50, top: 20 }}
          containerComponent={
            <ChartVoronoiContainer
              labels={({ datum }) => `Value: ${datum.y}`}
              constrainToVisibleArea
            />
          }
        >
          <ChartAxis />
          <ChartAxis 
            dependentAxis 
            showGrid
            tickFormat={formatYTick}
            domain={[0, maxY * 1.1]}
          />
          <ChartLine
            data={safeData}
            style={{
              data: { stroke: '#06c', strokeWidth: 2 }
            }}
          />
        </Chart>
      </div>
    );
  } catch (error) {
    console.error('Chart rendering error:', error);
    return (
      <div style={{ height, width: '100%' }}>
        <Bullseye>
          <EmptyState variant={EmptyStateVariant.sm}>
            <Title headingLevel="h4" size="md">
              Chart Error
            </Title>
            <EmptyStateBody>
              Unable to render chart. Please try refreshing the page.
            </EmptyStateBody>
          </EmptyState>
        </Bullseye>
      </div>
    );
  }
};

export default SafeLineChart;
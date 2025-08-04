import React from 'react';
import { Chart, ChartAxis, ChartGroup, ChartLine, ChartVoronoiContainer } from '@patternfly/react-charts/victory';
import {
  Skeleton,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Title,
  Bullseye,
} from '@patternfly/react-core';
import { ChartLineIcon } from '@patternfly/react-icons';

export interface BasicLineChartProps {
  data: Array<{ x: string | number; y: number; name?: string }>;
  loading?: boolean;
  height?: number;
  width?: number;
  metricType?: 'requests' | 'tokens' | 'cost';
}

const BasicLineChart: React.FC<BasicLineChartProps> = ({
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

  // Format label based on metric type
  const formatLabel = (datum: any) => {
    const value = datum.y || 0;
    switch (metricType) {
      case 'cost':
        return `$${value.toFixed(2)}`;
      case 'tokens':
        return `${value.toLocaleString()} tokens`;
      default:
        return `${value} requests`;
    }
  };

  // Calculate Y axis domain
  const yValues = data.map(d => d.y);
  const maxY = Math.max(...yValues, 10);
  const minY = 0;

  return (
    <div style={{ height, width: '100%' }}>
      <Chart
        ariaDesc={`Usage ${metricType} over time`}
        ariaTitle="Usage trend chart"
        containerComponent={
          <ChartVoronoiContainer 
            labels={({ datum }) => formatLabel(datum)} 
            constrainToVisibleArea 
          />
        }
        height={height}
        maxDomain={{ y: maxY * 1.1 }}
        minDomain={{ y: minY }}
        padding={{
          bottom: 50,
          left: 70,
          right: 50,
          top: 20
        }}
        width={width}
      >
        <ChartAxis />
        <ChartAxis dependentAxis showGrid />
        <ChartGroup>
          <ChartLine 
            data={data}
            style={{
              data: { stroke: '#06c', strokeWidth: 2 }
            }}
          />
        </ChartGroup>
      </Chart>
    </div>
  );
};

export default BasicLineChart;
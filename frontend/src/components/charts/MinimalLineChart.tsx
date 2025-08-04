import React from 'react';
import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLine,
  ChartVoronoiContainer,
} from '@patternfly/react-charts/victory';
import { Skeleton } from '@patternfly/react-core';
import { LineChartDataPoint } from '../../utils/chartDataTransformers';

export interface MinimalLineChartProps {
  data: LineChartDataPoint[];
  loading?: boolean;
  height?: number;
  metricType?: 'requests' | 'tokens' | 'cost';
  dateLabels?: string[];
}

const MinimalLineChart: React.FC<MinimalLineChartProps> = ({
  data = [],
  loading = false,
  height = 250,
  metricType = 'requests',
}) => {
  if (loading) {
    return <Skeleton height={`${height}px`} width="100%" />;
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ height, textAlign: 'center', paddingTop: '100px' }}>No data available</div>
    );
  }

  // Ensure data has numeric x values and extract labels
  const chartData = data.map((d, index) => ({
    x: typeof d.x === 'number' ? d.x : index,
    y: d.y || 0,
    label: d.label,
  }));

  // Extract date labels from the data
  const extractDateFromLabel = (label?: string) => {
    if (!label) return '';
    // Labels are in format "MMM DD: X requests/tokens/cost"
    const match = label.match(/^([^:]+):/);
    return match ? match[1] : '';
  };

  // Create x-axis labels from data
  const xAxisLabels = data.map(d => extractDateFromLabel(d.label));

  // Calculate Y domain
  const yValues = chartData.map((d) => d.y);
  const maxY = Math.max(...yValues, 1);
  const minY = Math.min(...yValues, 0);

  // Format tooltip label based on metric type
  const formatTooltip = ({ datum }: any) => {
    if (!datum || !datum.label) return '';
    return datum.label;
  };

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

  // Format X axis labels - show fewer labels to avoid crowding
  const formatXTick = (value: number) => {
    const label = xAxisLabels[value];
    if (!label) return '';
    
    // Show every nth label based on data length
    const dataLength = xAxisLabels.length;
    if (dataLength <= 7) return label; // Show all if 7 or fewer
    if (dataLength <= 14) {
      // Show every other label for 8-14 days
      return value % 2 === 0 ? label : '';
    }
    // For more than 14 days, show every 3rd label
    return value % 3 === 0 ? label : '';
  };

  return (
    <Chart
      ariaDesc={`Usage ${metricType} over time`}
      ariaTitle="Usage trend chart"
      containerComponent={<ChartVoronoiContainer labels={formatTooltip} constrainToVisibleArea />}
      height={height}
      maxDomain={{ y: maxY * 1.1 }}
      minDomain={{ y: minY }}
      padding={{ bottom: 60, left: 80, right: 50, top: 20 }}
    >
      <ChartAxis 
        tickFormat={formatXTick}
        style={{
          tickLabels: { fontSize: 10 },
        }}
      />
      <ChartAxis 
        dependentAxis 
        showGrid
        tickFormat={formatYTick}
        style={{
          tickLabels: { fontSize: 10 },
        }}
      />
      <ChartGroup>
        <ChartLine 
          data={chartData}
          style={{
            data: { stroke: '#06c', strokeWidth: 2 },
          }}
        />
      </ChartGroup>
    </Chart>
  );
};

export default MinimalLineChart;

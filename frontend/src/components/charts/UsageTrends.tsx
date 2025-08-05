import React from 'react';
import { Chart, ChartAxis, ChartGroup, ChartLine } from '@patternfly/react-charts/victory';
import { Skeleton } from '@patternfly/react-core';
import { LineChartDataPoint } from '../../utils/chartDataTransformers';

export interface WorkingLineChartProps {
  data: LineChartDataPoint[];
  loading?: boolean;
  height?: number;
  metricType?: 'requests' | 'tokens' | 'cost';
}

const WorkingLineChart: React.FC<WorkingLineChartProps> = ({
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

  return (
    <div style={{ width: '100%', height }}>
      <Chart
        height={height}
        padding={{ bottom: 30, left: 10, right: 10, top: 10 }}
        domain={{ y: [0, maxY * 1.1], x: [0, data.length - 1] }}
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
            grid: { stroke: 'lightgray' },
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
    </div>
  );
};

export default WorkingLineChart;

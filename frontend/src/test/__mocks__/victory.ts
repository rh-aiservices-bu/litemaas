/**
 * Mock implementations for Victory.js charting library
 * Provides testable component stubs that preserve prop passing
 */
import React from 'react';

// Mock Victory components with prop preservation
export const VictoryChart = ({ children, ...props }: any) =>
  React.createElement('div', {
    'data-testid': 'victory-chart',
    'data-props': JSON.stringify(props),
    role: 'img',
    'aria-label': props.ariaTitle || 'Chart',
    'aria-describedby': props.ariaDesc ? 'chart-description' : undefined,
    children: [
      props.ariaDesc &&
        React.createElement('div', {
          key: 'description',
          id: 'chart-description',
          style: { display: 'none' },
          children: props.ariaDesc,
        }),
      children,
    ].filter(Boolean),
  });

export const VictoryLine = (props: any) =>
  React.createElement('div', {
    'data-testid': 'victory-line',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const VictoryBar = (props: any) =>
  React.createElement('div', {
    'data-testid': 'victory-bar',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const VictoryPie = (props: any) =>
  React.createElement('div', {
    'data-testid': 'victory-pie',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const VictoryDonut = (props: any) =>
  React.createElement('div', {
    'data-testid': 'victory-donut',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const VictoryAxis = (props: any) =>
  React.createElement('div', {
    'data-testid': 'victory-axis',
    'data-props': JSON.stringify(props),
    'data-dependent': props.dependentAxis ? 'true' : 'false',
  });

export const VictoryArea = (props: any) =>
  React.createElement('div', {
    'data-testid': 'victory-area',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const VictoryGroup = ({ children, ...props }: any) =>
  React.createElement('div', {
    'data-testid': 'victory-group',
    'data-props': JSON.stringify(props),
    children,
  });

export const VictoryLegend = (props: any) =>
  React.createElement('div', {
    'data-testid': 'victory-legend',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const VictoryScatter = (props: any) =>
  React.createElement('div', {
    'data-testid': 'victory-scatter',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const VictoryContainer = ({ children, ...props }: any) =>
  React.createElement('div', {
    'data-testid': 'victory-container',
    'data-props': JSON.stringify(props),
    children,
  });

export const VictoryTheme = {
  material: { name: 'material' },
  grayscale: { name: 'grayscale' },
};

// Export default Victory object
export default {
  VictoryChart,
  VictoryLine,
  VictoryBar,
  VictoryPie,
  VictoryDonut,
  VictoryAxis,
  VictoryArea,
  VictoryGroup,
  VictoryLegend,
  VictoryScatter,
  VictoryContainer,
  VictoryTheme,
};

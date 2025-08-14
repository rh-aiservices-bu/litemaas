/**
 * Mock implementations for PatternFly React Charts
 * Provides testable component stubs that preserve prop passing for PatternFly chart wrappers
 */
import React from 'react';

// PatternFly chart components are wrappers around Victory components
export const Chart = ({ children, ...props }: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart',
    'data-props': JSON.stringify(props),
    role: 'img',
    'aria-label': props.ariaTitle || 'Chart',
    'aria-describedby': props.ariaDesc ? 'pf-chart-description' : undefined,
    style: { height: props.height, width: props.width },
    children: [
      props.ariaDesc &&
        React.createElement('div', {
          key: 'description',
          id: 'pf-chart-description',
          style: { display: 'none' },
          children: props.ariaDesc,
        }),
      children,
    ].filter(Boolean),
  });

export const ChartAxis = (props: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-axis',
    'data-props': JSON.stringify(props),
    'data-dependent': props.dependentAxis ? 'true' : 'false',
    'data-tick-format': props.tickFormat?.toString() || 'none',
  });

export const ChartLine = (props: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-line',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
    'data-color': props.style?.data?.stroke || 'default',
  });

export const ChartDonut = (props: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-donut',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
    'data-title': props.title || '',
    'data-subtitle': props.subTitle || '',
    style: {
      height: props.height,
      width: props.width,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    children: [
      React.createElement('div', {
        key: 'title',
        'data-testid': 'donut-title',
        children: props.title,
      }),
      props.subTitle &&
        React.createElement('div', {
          key: 'subtitle',
          'data-testid': 'donut-subtitle',
          children: props.subTitle,
        }),
      props.legendData &&
        React.createElement('div', {
          key: 'legend',
          'data-testid': 'donut-legend',
          'data-legend': JSON.stringify(props.legendData),
        }),
    ].filter(Boolean),
  });

export const ChartBar = (props: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-bar',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const ChartPie = (props: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-pie',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const ChartArea = (props: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-area',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const ChartGroup = ({ children, ...props }: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-group',
    'data-props': JSON.stringify(props),
    children,
  });

export const ChartLegend = (props: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-legend',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

export const ChartScatter = (props: any) =>
  React.createElement('div', {
    'data-testid': 'patternfly-chart-scatter',
    'data-props': JSON.stringify(props),
    'data-data': JSON.stringify(props.data || []),
  });

// Theme enums
export const ChartThemeColor = {
  blue: 'blue',
  green: 'green',
  orange: 'orange',
  purple: 'purple',
  multiOrdered: 'multiOrdered',
  multiUnordered: 'multiUnordered',
};

export const ChartThemeVariant = {
  light: 'light',
  dark: 'dark',
};

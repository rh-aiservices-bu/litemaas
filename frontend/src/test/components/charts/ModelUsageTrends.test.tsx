import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModelUsageTrends from '../../../components/charts/ModelUsageTrends';
import { DailyModelUsage } from '../../../services/adminUsage.service';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const translations: Record<string, string> = {
        'adminUsage.charts.noDataAvailable': 'No data available',
        'adminUsage.charts.noModelDataExplanation':
          'No model usage data available for the selected time period.',
        'adminUsage.charts.noModelData': 'No model data available',
        'adminUsage.charts.modelUsageTrends': 'Model Usage Trends',
        'adminUsage.charts.modelUsageTrendsDescription': 'Model usage breakdown over time',
        'adminUsage.charts.modelUsageSummary':
          'Stacked chart with {{dataPoints}} data points showing {{modelCount}} models. Total values range from {{minValue}} to {{maxValue}}, with an average of {{avgValue}}.',
        'adminUsage.charts.chartFocused':
          '{{chartType}} chart focused with {{dataPoints}} data points',
        'adminUsage.charts.stackedBar': 'Stacked bar',
        'adminUsage.charts.modelLegendDescription':
          'Model {{modelName}} shown in the stacked chart',
        'pages.usage.tableHeaders.date': 'Date',
        'pages.usage.metrics.requests': 'requests',
        'pages.usage.metrics.tokens': 'tokens',
        'pages.usage.metrics.cost': 'cost',
        'common.value': 'Value',
        'common.dataPoints': 'data points',
        'ui.accessibility.chartLegend': 'Chart Legend',
      };

      let result = translations[key] || key;
      if (options) {
        Object.keys(options).forEach((optionKey) => {
          result = result.replace(`{{${optionKey}}}`, options[optionKey]);
        });
      }
      return result;
    },
  }),
}));

// Helper to safely stringify props
const safeStringifyProps = (props: any) => {
  const safe: any = {};
  for (const key in props) {
    const value = props[key];
    if (
      value !== undefined &&
      value !== null &&
      typeof value !== 'function' &&
      !key.startsWith('_') &&
      typeof value !== 'symbol' &&
      !(value && typeof value === 'object' && value.$$typeof)
    ) {
      if (typeof value === 'object') {
        try {
          safe[key] = JSON.parse(JSON.stringify(value));
        } catch {
          // Skip if can't stringify
        }
      } else {
        safe[key] = value;
      }
    }
  }
  return JSON.stringify(safe);
};

// Mock PatternFly Charts
vi.mock('@patternfly/react-charts/victory', () => ({
  Chart: ({ children, ...props }: any) => (
    <div
      data-testid="patternfly-chart"
      data-height={props.height}
      data-width={props.width}
      data-props={safeStringifyProps(props)}
      style={{ height: props.height, width: props.width }}
    >
      {children}
    </div>
  ),
  ChartAxis: (props: any) => (
    <div
      data-testid="patternfly-chart-axis"
      data-dependent={props.dependentAxis ? 'true' : 'false'}
      data-props={safeStringifyProps(props)}
    />
  ),
  ChartStack: ({ children, ...props }: any) => (
    <div data-testid="patternfly-chart-stack" data-props={safeStringifyProps(props)}>
      {children}
    </div>
  ),
  ChartArea: (props: any) => (
    <div
      data-testid="patternfly-chart-area"
      data-data={JSON.stringify(props.data || [])}
      data-name={props.name}
      data-props={safeStringifyProps(props)}
    />
  ),
  ChartGroup: ({ children, ...props }: any) => (
    <div data-testid="patternfly-chart-group" data-props={safeStringifyProps(props)}>
      {children}
    </div>
  ),
  ChartScatter: (props: any) => (
    <div
      data-testid="patternfly-chart-scatter"
      data-data={JSON.stringify(props.data || [])}
      data-name={props.name}
      data-props={safeStringifyProps(props)}
    />
  ),
  ChartThemeColor: {
    multiUnordered: 'multiUnordered',
  },
  createContainer: (...types: string[]) => {
    return ({ children, ...props }: any) => (
      <div
        data-testid={`victory-container-${types.join('-')}`}
        data-container-types={types.join(',')}
        data-props={safeStringifyProps(props)}
      >
        {children}
      </div>
    );
  },
  getCustomTheme: () => ({
    group: { colorScale: ['#0066cc', '#0f9d58', '#d93025', '#f4b400', '#ab47bc'] },
    line: { colorScale: ['#0066cc', '#0f9d58', '#d93025', '#f4b400', '#ab47bc'] },
  }),
}));

// Mock PatternFly Core
vi.mock('@patternfly/react-core', () => ({
  Skeleton: ({ height, width }: any) => (
    <div data-testid="skeleton" data-height={height} data-width={width} style={{ height, width }} />
  ),
}));

// Mock AccessibleChart
vi.mock('../../../components/charts/AccessibleChart', () => ({
  __esModule: true,
  default: ({ children, data, title, description, summary }: any) => (
    <div
      data-testid="accessible-chart"
      data-title={title}
      data-description={description}
      data-summary={summary}
      data-data-length={data?.length || 0}
    >
      {children}
    </div>
  ),
}));

// Mock AccessibleLegend
vi.mock('../../../components/charts/AccessibleLegend', () => ({
  __esModule: true,
  default: ({ items, title }: any) => (
    <div data-testid="accessible-legend" data-title={title} data-items={JSON.stringify(items)} />
  ),
}));

// Mock chart utilities
vi.mock('../../../utils/chartAccessibility', () => ({
  generateChartAriaDescription: (chartType: string, dataCount: number, metricType?: string) =>
    `${chartType} chart with ${dataCount} data points${metricType ? ` showing ${metricType} data` : ''}`,
}));

// Test data
const mockDailyModelUsage: DailyModelUsage[] = [
  {
    date: '2025-01-01',
    models: [
      {
        modelId: 'gpt-4',
        modelName: 'GPT-4',
        provider: 'openai',
        requests: 100,
        tokens: 50000,
        prompt_tokens: 30000,
        completion_tokens: 20000,
        cost: 5.5,
      },
      {
        modelId: 'gpt-3.5-turbo',
        modelName: 'GPT-3.5 Turbo',
        provider: 'openai',
        requests: 200,
        tokens: 75000,
        prompt_tokens: 45000,
        completion_tokens: 30000,
        cost: 2.25,
      },
    ],
  },
  {
    date: '2025-01-02',
    models: [
      {
        modelId: 'gpt-4',
        modelName: 'GPT-4',
        provider: 'openai',
        requests: 150,
        tokens: 75000,
        prompt_tokens: 45000,
        completion_tokens: 30000,
        cost: 8.25,
      },
      {
        modelId: 'gpt-3.5-turbo',
        modelName: 'GPT-3.5 Turbo',
        provider: 'openai',
        requests: 250,
        tokens: 100000,
        prompt_tokens: 60000,
        completion_tokens: 40000,
        cost: 3.0,
      },
    ],
  },
];

describe('ModelUsageTrends', () => {
  it('shows loading skeleton when loading is true', () => {
    render(<ModelUsageTrends data={[]} loading={true} metricType="requests" />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.getAttribute('data-height')).toBe('400px');
    expect(skeleton.getAttribute('data-width')).toBe('100%');
  });

  it('renders empty state when no data provided', () => {
    render(<ModelUsageTrends data={[]} metricType="requests" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(
      screen.getByText('No model usage data available for the selected time period.'),
    ).toBeInTheDocument();
  });

  it('renders chart with model data correctly', () => {
    render(<ModelUsageTrends data={mockDailyModelUsage} metricType="requests" />);

    expect(screen.getByTestId('patternfly-chart')).toBeInTheDocument();
    expect(screen.getByTestId('patternfly-chart-stack')).toBeInTheDocument();
  });

  it('applies custom title and description', () => {
    const customTitle = 'Custom Model Trends';
    const customDescription = 'Custom description';

    render(
      <ModelUsageTrends
        data={mockDailyModelUsage}
        title={customTitle}
        description={customDescription}
        metricType="requests"
      />,
    );

    const accessibleChart = screen.getByTestId('accessible-chart');
    expect(accessibleChart.getAttribute('data-title')).toBe(customTitle);
    expect(accessibleChart.getAttribute('data-description')).toBe(customDescription);
  });

  it('renders accessible legend with model information', () => {
    render(<ModelUsageTrends data={mockDailyModelUsage} metricType="requests" />);

    const legend = screen.getByTestId('accessible-legend');
    expect(legend).toBeInTheDocument();

    const legendItems = JSON.parse(legend.getAttribute('data-items') || '[]');
    expect(legendItems.length).toBeGreaterThan(0);
  });

  describe('Memory Management - ResizeObserver Cleanup', () => {
    let disconnectSpy: ReturnType<typeof vi.fn>;
    let observeSpy: ReturnType<typeof vi.fn>;
    let unobserveSpy: ReturnType<typeof vi.fn>;
    let OriginalResizeObserver: typeof ResizeObserver;

    beforeEach(() => {
      disconnectSpy = vi.fn();
      observeSpy = vi.fn();
      unobserveSpy = vi.fn();

      // Save original ResizeObserver
      OriginalResizeObserver = global.ResizeObserver;

      // Mock ResizeObserver
      global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: observeSpy,
        disconnect: disconnectSpy,
        unobserve: unobserveSpy,
      })) as any;
    });

    afterEach(() => {
      // Restore original ResizeObserver
      global.ResizeObserver = OriginalResizeObserver;
      vi.clearAllMocks();
    });

    it('should create ResizeObserver on mount', () => {
      render(<ModelUsageTrends data={mockDailyModelUsage} metricType="requests" />);

      // Verify observer was created and element was observed
      expect(global.ResizeObserver).toHaveBeenCalledTimes(1);
      expect(observeSpy).toHaveBeenCalledTimes(1);
    });

    it('should clean up ResizeObserver on unmount', () => {
      const { unmount } = render(
        <ModelUsageTrends data={mockDailyModelUsage} metricType="requests" />,
      );

      // Verify observer was created
      expect(global.ResizeObserver).toHaveBeenCalled();

      // Clear the spy to ensure disconnect is from unmount
      disconnectSpy.mockClear();

      // Unmount component
      unmount();

      // Verify disconnect was called on unmount
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should handle multiple mount/unmount cycles without leaking', () => {
      // Track total disconnect calls across all cycles
      let totalDisconnects = 0;
      disconnectSpy.mockImplementation(() => {
        totalDisconnects++;
      });

      // Mount and unmount 10 times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <ModelUsageTrends data={mockDailyModelUsage} metricType="requests" />,
        );
        unmount();
      }

      // Should have created 10 observers
      expect(global.ResizeObserver).toHaveBeenCalledTimes(10);

      // Should have disconnected at least 10 times (once per unmount)
      expect(totalDisconnects).toBeGreaterThanOrEqual(10);
    });

    it('should disconnect old observer when ref changes', () => {
      const { rerender, unmount } = render(
        <ModelUsageTrends data={mockDailyModelUsage} metricType="requests" />,
      );

      // Initial mount
      expect(observeSpy).toHaveBeenCalledTimes(1);

      // Force re-render (in real app, this could be prop change)
      rerender(<ModelUsageTrends data={mockDailyModelUsage} metricType="requests" />);

      // Unmount
      unmount();

      // Verify cleanup happened
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should not throw errors if unmounted before observer created', () => {
      // This should not throw
      const { unmount } = render(<ModelUsageTrends data={[]} metricType="requests" />);
      unmount();

      // No assertions needed - test passes if no error thrown
    });
  });
});

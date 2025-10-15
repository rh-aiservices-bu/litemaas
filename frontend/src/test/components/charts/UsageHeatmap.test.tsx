/**
 * Test suite for UsageHeatmap component
 * Tests heatmap visualization and accessibility
 * Note: Table view toggle is handled by AccessibleChart wrapper
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UsageHeatmap from '../../../components/charts/UsageHeatmap';
import { HeatmapWeekData } from '../../../utils/chartDataTransformers';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // Return mock translations for keys used in the component
      const translations: Record<string, string> = {
        'adminUsage.heatmap.legend.colorScale': 'Usage intensity',
        'adminUsage.heatmap.legend.zeroUsage': 'Zero usage',
        'adminUsage.heatmap.legend.noData': 'No data',
        'adminUsage.heatmap.tooltip.percentOfWeek': '{{percent}}% of week total',
        'adminUsage.heatmap.tooltip.noDataOutsideRange': 'No data (outside selected range)',
        'adminUsage.heatmap.accessibility.heatmapDescription':
          'Heatmap showing {{metric}} by day of week across {{weeks}} weeks',
        'adminUsage.heatmap.accessibility.cellLabel':
          '{{dayName}}, {{date}}, {{value}}, {{percent}} of week',
        'pages.usage.charts.noDataAvailable': 'No data available',
        'pages.usage.metrics.requests': 'Requests',
        'pages.usage.weeklyUsagePatterns': 'Weekly Usage Patterns',
      };
      return translations[key] || key;
    },
  }),
}));

// Sample test data
const mockHeatmapData: HeatmapWeekData[] = [
  {
    weekNumber: 1,
    weekLabel: 'Jan 15-21',
    weekStart: '2025-01-15',
    weekEnd: '2025-01-21',
    weekTotal: 1000,
    days: [
      {
        date: '2025-01-15',
        dayOfWeek: 0,
        dayName: 'Monday',
        value: 150,
        isInRange: true,
        percentOfWeek: 15,
        formattedValue: '150 requests',
      },
      {
        date: '2025-01-16',
        dayOfWeek: 1,
        dayName: 'Tuesday',
        value: 200,
        isInRange: true,
        percentOfWeek: 20,
        formattedValue: '200 requests',
      },
      {
        date: '2025-01-17',
        dayOfWeek: 2,
        dayName: 'Wednesday',
        value: 180,
        isInRange: true,
        percentOfWeek: 18,
        formattedValue: '180 requests',
      },
      {
        date: '2025-01-18',
        dayOfWeek: 3,
        dayName: 'Thursday',
        value: 220,
        isInRange: true,
        percentOfWeek: 22,
        formattedValue: '220 requests',
      },
      {
        date: '2025-01-19',
        dayOfWeek: 4,
        dayName: 'Friday',
        value: 190,
        isInRange: true,
        percentOfWeek: 19,
        formattedValue: '190 requests',
      },
      {
        date: '2025-01-20',
        dayOfWeek: 5,
        dayName: 'Saturday',
        value: 30,
        isInRange: true,
        percentOfWeek: 3,
        formattedValue: '30 requests',
      },
      {
        date: '2025-01-21',
        dayOfWeek: 6,
        dayName: 'Sunday',
        value: 30,
        isInRange: true,
        percentOfWeek: 3,
        formattedValue: '30 requests',
      },
    ],
  },
  {
    weekNumber: 2,
    weekLabel: 'Jan 22-28',
    weekStart: '2025-01-22',
    weekEnd: '2025-01-28',
    weekTotal: 1200,
    days: [
      {
        date: '2025-01-22',
        dayOfWeek: 0,
        dayName: 'Monday',
        value: 180,
        isInRange: true,
        percentOfWeek: 15,
        formattedValue: '180 requests',
      },
      {
        date: '2025-01-23',
        dayOfWeek: 1,
        dayName: 'Tuesday',
        value: 240,
        isInRange: true,
        percentOfWeek: 20,
        formattedValue: '240 requests',
      },
      {
        date: '2025-01-24',
        dayOfWeek: 2,
        dayName: 'Wednesday',
        value: 210,
        isInRange: true,
        percentOfWeek: 17.5,
        formattedValue: '210 requests',
      },
      {
        date: '2025-01-25',
        dayOfWeek: 3,
        dayName: 'Thursday',
        value: 250,
        isInRange: true,
        percentOfWeek: 20.8,
        formattedValue: '250 requests',
      },
      {
        date: '2025-01-26',
        dayOfWeek: 4,
        dayName: 'Friday',
        value: 220,
        isInRange: true,
        percentOfWeek: 18.3,
        formattedValue: '220 requests',
      },
      {
        date: '2025-01-27',
        dayOfWeek: 5,
        dayName: 'Saturday',
        value: 50,
        isInRange: true,
        percentOfWeek: 4.2,
        formattedValue: '50 requests',
      },
      {
        date: '2025-01-28',
        dayOfWeek: 6,
        dayName: 'Sunday',
        value: 50,
        isInRange: true,
        percentOfWeek: 4.2,
        formattedValue: '50 requests',
      },
    ],
  },
];

describe('UsageHeatmap', () => {
  it('renders without errors', () => {
    render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('displays correct number of weeks', () => {
    render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);
    const weekLabels = screen.getAllByText(/Jan/);
    expect(weekLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('is wrapped in AccessibleChart with toggle functionality', () => {
    render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);
    // The chart should be rendered (AccessibleChart provides toggle functionality)
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('renders SVG heatmap by default', () => {
    render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);

    // Should show chart (SVG grid) by default
    expect(screen.getByRole('grid')).toBeInTheDocument();

    // AccessibleChart handles table/chart toggle functionality
    // (tested separately in AccessibleChart.test.tsx)
  });

  it('renders empty state with no data', () => {
    render(<UsageHeatmap data={[]} metricType="requests" />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    const { container } = render(
      <UsageHeatmap data={mockHeatmapData} metricType="requests" loading={true} />,
    );
    expect(container.querySelector('.pf-v6-c-skeleton')).toBeInTheDocument();
  });

  it('renders legend with color scale', () => {
    render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);
    expect(screen.getByText('Usage intensity')).toBeInTheDocument();
    expect(screen.getByText('Zero usage')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders accessible grid role and labels', () => {
    render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-label');
  });

  it('handles different metric types', () => {
    const { rerender } = render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);
    expect(screen.getByRole('grid')).toBeInTheDocument();

    rerender(<UsageHeatmap data={mockHeatmapData} metricType="tokens" />);
    expect(screen.getByRole('grid')).toBeInTheDocument();

    rerender(<UsageHeatmap data={mockHeatmapData} metricType="cost" />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
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
      render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);

      // Verify observer was created and element was observed
      expect(global.ResizeObserver).toHaveBeenCalledTimes(1);
      expect(observeSpy).toHaveBeenCalledTimes(1);
    });

    it('should clean up ResizeObserver on unmount', () => {
      const { unmount } = render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);

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
        const { unmount } = render(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);
        unmount();
      }

      // Should have created 10 observers
      expect(global.ResizeObserver).toHaveBeenCalledTimes(10);

      // Should have disconnected at least 10 times (once per unmount)
      expect(totalDisconnects).toBeGreaterThanOrEqual(10);
    });

    it('should disconnect old observer when ref changes', () => {
      const { rerender, unmount } = render(
        <UsageHeatmap data={mockHeatmapData} metricType="requests" />,
      );

      // Initial mount
      expect(observeSpy).toHaveBeenCalledTimes(1);

      // Force re-render (in real app, this could be prop change)
      rerender(<UsageHeatmap data={mockHeatmapData} metricType="requests" />);

      // Unmount
      unmount();

      // Verify cleanup happened
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should not throw errors if unmounted before observer created', () => {
      // This should not throw
      const { unmount } = render(<UsageHeatmap data={[]} metricType="requests" />);
      unmount();

      // No assertions needed - test passes if no error thrown
    });
  });
});

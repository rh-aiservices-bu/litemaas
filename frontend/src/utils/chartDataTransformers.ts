// Chart data transformation utilities for usage analytics
// Transforms API data structures into chart-ready formats

import { UsageMetrics } from '../services/usage.service';

// TypeScript interfaces for chart data structures
export interface LineChartDataPoint {
  name: string;
  x: string | number;
  y: number;
  label?: string;
}

export interface DonutChartDataPoint {
  x: string;
  y: number;
  label?: string;
  percentage: number;
}

export interface ModelBreakdownData {
  name: string;
  requests: number;
  tokens: number;
  cost: number;
  percentage: number;
}

export interface DailyUsageChartData {
  requests: LineChartDataPoint[];
  tokens: LineChartDataPoint[];
  cost: LineChartDataPoint[];
}

/**
 * Transforms daily usage array to chart-ready format
 * Converts API data into Victory.js compatible format with proper date sorting
 */
export const transformDailyUsageToChartData = (
  dailyUsage: UsageMetrics['dailyUsage'] = [],
): DailyUsageChartData => {
  // Sort by date to ensure chronological order
  const sortedData = [...dailyUsage].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  // Handle missing data points gracefully
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const requests: LineChartDataPoint[] = sortedData.map((item, index) => ({
    name: 'requests',
    x: index,
    y: item.requests || 0,
    label: `${formatDate(item.date)}: ${item.requests || 0} requests`,
  }));

  const tokens: LineChartDataPoint[] = sortedData.map((item, index) => ({
    name: 'tokens',
    x: index,
    y: item.tokens || 0,
    label: `${formatDate(item.date)}: ${(item.tokens || 0).toLocaleString()} tokens`,
  }));

  const cost: LineChartDataPoint[] = sortedData.map((item, index) => ({
    name: 'cost',
    x: index,
    y: item.cost || 0,
    label: `${formatDate(item.date)}: $${(item.cost || 0).toFixed(2)}`,
  }));
  return { requests, tokens, cost };
};

/**
 * Transforms model data to donut chart format
 * Calculates percentages and formats for donut chart display
 */
export const transformModelBreakdownToChartData = (
  topModels: UsageMetrics['topModels'] = [],
  totalRequests: number = 0,
): {
  chartData: DonutChartDataPoint[];
  modelBreakdown: ModelBreakdownData[];
} => {
  // Handle edge case where total is 0
  if (totalRequests === 0 || topModels.length === 0) {
    return {
      chartData: [],
      modelBreakdown: [],
    };
  }

  // Calculate percentages for model distribution
  const modelBreakdown: ModelBreakdownData[] = topModels.map((model) => {
    const percentage = totalRequests > 0 ? (model.requests / totalRequests) * 100 : 0;
    return {
      name: model.name || 'Unknown Model',
      requests: model.requests || 0,
      tokens: model.tokens || 0,
      cost: model.cost || 0,
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
    };
  });

  // Create chart data with proper formatting
  const chartData: DonutChartDataPoint[] = modelBreakdown.map((model) => ({
    x: model.name,
    y: model.requests,
    label: `${model.name}: ${model.percentage}%`,
    percentage: model.percentage,
  }));

  return { chartData, modelBreakdown };
};

/**
 * Transforms hourly usage data for time-based analysis
 * Formats hour labels and handles missing data points
 */
export const transformHourlyUsageToChartData = (
  hourlyUsage: UsageMetrics['hourlyUsage'] = [],
): LineChartDataPoint[] => {
  // Sort by hour to ensure chronological order
  const sortedData = [...hourlyUsage].sort((a, b) => {
    // Parse hour format (e.g., "14:00" or "2 PM")
    const hourA = parseInt(a.hour.split(':')[0]) || 0;
    const hourB = parseInt(b.hour.split(':')[0]) || 0;
    return hourA - hourB;
  });

  const formatHour = (hourString: string): string => {
    try {
      // Handle different hour formats
      if (hourString.includes(':')) {
        const hour = parseInt(hourString.split(':')[0]);
        return hour === 0
          ? '12 AM'
          : hour < 12
            ? `${hour} AM`
            : hour === 12
              ? '12 PM'
              : `${hour - 12} PM`;
      }
      return hourString;
    } catch {
      return hourString;
    }
  };

  return sortedData.map((item, index) => ({
    name: 'hourly-requests',
    x: index,
    y: item.requests || 0,
    label: `${formatHour(item.hour)}: ${item.requests || 0} requests`,
  }));
};

/**
 * Transforms error breakdown data for error analysis charts
 * Formats error types and ensures valid percentages
 */
export const transformErrorBreakdownToChartData = (
  errorBreakdown: UsageMetrics['errorBreakdown'] = [],
): DonutChartDataPoint[] => {
  // Handle missing data gracefully
  if (errorBreakdown.length === 0) {
    return [];
  }

  return errorBreakdown.map((error) => ({
    x: error.type || 'Unknown Error',
    y: error.count || 0,
    label: `${error.type}: ${error.percentage || 0}%`,
    percentage: error.percentage || 0,
  }));
};

/**
 * Utility function to format large numbers with K/M suffixes
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

/**
 * Utility function to format currency values consistently
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

/**
 * Utility function to format date ranges for chart titles
 */
export const formatDateRange = (startDate?: string, endDate?: string): string => {
  if (!startDate || !endDate) {
    return '';
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const formatOptions: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
    };

    // Add year if dates span different years
    if (start.getFullYear() !== end.getFullYear()) {
      formatOptions.year = 'numeric';
    }

    return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
  } catch {
    return `${startDate} - ${endDate}`;
  }
};

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
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  percentage: number;
}

export interface DailyUsageChartData {
  requests: LineChartDataPoint[];
  tokens: LineChartDataPoint[];
  prompt_tokens: LineChartDataPoint[];
  completion_tokens: LineChartDataPoint[];
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
  // Parse YYYY-MM-DD as local date, not UTC to avoid timezone shifts
  const formatDate = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
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

  const prompt_tokens: LineChartDataPoint[] = sortedData.map((item, index) => ({
    name: 'prompt_tokens',
    x: index,
    y: item.prompt_tokens || 0,
    label: `${formatDate(item.date)}: ${(item.prompt_tokens || 0).toLocaleString()} prompt tokens`,
  }));

  const completion_tokens: LineChartDataPoint[] = sortedData.map((item, index) => ({
    name: 'completion_tokens',
    x: index,
    y: item.completion_tokens || 0,
    label: `${formatDate(item.date)}: ${(item.completion_tokens || 0).toLocaleString()} completion tokens`,
  }));

  return { requests, tokens, prompt_tokens, completion_tokens, cost };
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

  // Calculate percentages for model distribution and filter out models with 0 requests
  const modelBreakdown: ModelBreakdownData[] = topModels
    .filter((model) => model.requests > 0) // Only include models with requests
    .map((model) => {
      const percentage = totalRequests > 0 ? (model.requests / totalRequests) * 100 : 0;
      return {
        name: model.name || 'Unknown Model',
        requests: model.requests || 0,
        tokens: model.tokens || 0,
        prompt_tokens: model.prompt_tokens || 0,
        completion_tokens: model.completion_tokens || 0,
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

/**
 * Transforms daily model usage data to stacked chart format
 * Prepares data for Victory.js stacked bar/area chart with multiple models
 */
export const transformDailyModelUsageToStackedChart = (
  dailyModelUsage: Array<{
    date: string;
    models: Array<{
      modelId: string;
      modelName: string;
      provider: string;
      requests: number;
      tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
      cost: number;
    }>;
  }> = [],
  metricType: 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens' = 'requests',
): {
  chartData: Array<{
    date: string;
    [modelName: string]: string | number;
  }>;
  modelNames: string[];
} => {
  // Handle empty data
  if (!dailyModelUsage || dailyModelUsage.length === 0) {
    return { chartData: [], modelNames: [] };
  }

  // Collect all unique model names across all days
  const modelNamesSet = new Set<string>();
  dailyModelUsage.forEach((day) => {
    day.models.forEach((model) => {
      modelNamesSet.add(model.modelName);
    });
  });

  const modelNames = Array.from(modelNamesSet).sort();

  // Sort data by date to ensure chronological order on x-axis
  const sortedData = [...dailyModelUsage].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Transform data for stacked chart
  const chartData = sortedData.map((day) => {
    const dataPoint: { date: string; [modelName: string]: string | number } = {
      date: formatDate(day.date),
    };

    // Initialize all models with 0
    modelNames.forEach((modelName) => {
      dataPoint[modelName] = 0;
    });

    // Fill in actual values for models present on this day
    day.models.forEach((model) => {
      const value =
        metricType === 'requests'
          ? model.requests
          : metricType === 'tokens'
            ? model.tokens
            : metricType === 'prompt_tokens'
              ? model.prompt_tokens
              : metricType === 'completion_tokens'
                ? model.completion_tokens
                : model.cost;
      dataPoint[model.modelName] = value || 0;
    });

    return dataPoint;
  });

  return { chartData, modelNames };
};

/**
 * Helper to format date string for chart display
 * Parse YYYY-MM-DD as local date, not UTC to avoid timezone shifts
 */
function formatDate(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Heatmap data structures for weekly usage visualization
 */
export interface HeatmapWeekData {
  weekNumber: number; // ISO week number
  weekLabel: string; // "Jan 15-21"
  weekStart: string; // "2025-01-15" (Monday)
  weekEnd: string; // "2025-01-21" (Sunday)
  weekTotal: number; // Sum for selected metric
  days: HeatmapDayData[]; // 7 elements (Mon-Sun)
}

export interface HeatmapDayData {
  date: string; // "2025-01-15"
  dayOfWeek: number; // 0=Mon, 6=Sun
  dayName: string; // "Monday"
  value: number | null; // null if no data
  isInRange: boolean; // false if outside selected date range
  percentOfWeek: number; // 0-100
  formattedValue: string; // "1,234 requests"
}

interface DailyUsageSummary {
  date: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Get ISO week number for a date (Monday = start of week)
 */
function getISOWeek(date: Date): number {
  const tempDate = new Date(date.valueOf());
  const dayNum = (date.getDay() + 6) % 7; // Convert to ISO (Monday = 0)
  tempDate.setDate(tempDate.getDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(tempDate.getFullYear(), 0, 4);
  const diff = tempDate.getTime() - firstThursday.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * Get Monday of the ISO week for a given date
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Format date range label for week (e.g., "Jan 15-21", "Jan 29-Feb 4")
 */
function formatWeekLabel(startDate: Date, endDate: Date): string {
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  } else {
    return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
  }
}

/**
 * Get day name from day of week number (0=Monday, 6=Sunday)
 */
function getDayName(dayOfWeek: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayOfWeek] || 'Unknown';
}

/**
 * Format value for heatmap display based on metric type
 */
function formatHeatmapValue(
  value: number | null,
  metricType: 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens',
): string {
  if (value === null || value === undefined) {
    return 'No data';
  }

  switch (metricType) {
    case 'cost':
      return `$${value.toFixed(2)}`;
    case 'requests':
      return `${value.toLocaleString()} requests`;
    case 'tokens':
      return `${value.toLocaleString()} tokens`;
    case 'prompt_tokens':
      return `${value.toLocaleString()} prompt tokens`;
    case 'completion_tokens':
      return `${value.toLocaleString()} completion tokens`;
    default:
      return value.toLocaleString();
  }
}

/**
 * Format Date object to YYYY-MM-DD string in local timezone
 * Avoids UTC conversion issues that can shift dates
 */
function formatDateToLocalString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Transform daily usage data to heatmap format grouped by ISO weeks
 * Handles partial weeks and out-of-range dates
 *
 * @param dailyUsage - Array of daily usage summaries
 * @param startDate - Start of date range (YYYY-MM-DD)
 * @param endDate - End of date range (YYYY-MM-DD)
 * @param metricType - Metric to display
 * @returns Array of week data with 7 days each
 */
export const transformDailyUsageToHeatmapData = (
  dailyUsage: DailyUsageSummary[] = [],
  startDate: string,
  endDate: string,
  metricType: 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens' = 'requests',
): HeatmapWeekData[] => {
  if (!dailyUsage || dailyUsage.length === 0) {
    return [];
  }

  // Parse date range
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const rangeStart = new Date(startYear, startMonth - 1, startDay);
  const rangeEnd = new Date(endYear, endMonth - 1, endDay);

  // Create a map of date -> value for quick lookup
  // If there are duplicate dates, sum them instead of overwriting
  const dataMap = new Map<string, number>();
  dailyUsage.forEach((item) => {
    const value = item[metricType] || 0;
    const existing = dataMap.get(item.date) || 0;
    dataMap.set(item.date, existing + value);
  });

  // Find all weeks that span the date range
  const weeks = new Map<number, HeatmapWeekData>();

  // Get the Monday of the week containing the start date
  const currentMonday = getMonday(rangeStart);

  // Iterate through weeks until we pass the end date
  while (currentMonday <= rangeEnd) {
    const weekNumber = getISOWeek(currentMonday);
    const weekStart = new Date(currentMonday);
    const weekEnd = new Date(currentMonday);
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

    const days: HeatmapDayData[] = [];
    let weekTotal = 0;

    // Generate 7 days for this week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDay = new Date(currentMonday);
      currentDay.setDate(currentDay.getDate() + dayOffset);

      const dateString = formatDateToLocalString(currentDay);
      const isInRange = currentDay >= rangeStart && currentDay <= rangeEnd;
      const value = isInRange && dataMap.has(dateString) ? dataMap.get(dateString)! : null;

      if (value !== null) {
        weekTotal += value;
      }

      days.push({
        date: dateString,
        dayOfWeek: dayOffset,
        dayName: getDayName(dayOffset),
        value,
        isInRange,
        percentOfWeek: 0, // Will be calculated after week total is known
        formattedValue: formatHeatmapValue(value, metricType),
      });
    }

    // Calculate percentages now that we know the week total
    days.forEach((day) => {
      if (day.value !== null && weekTotal > 0) {
        day.percentOfWeek = Math.round((day.value / weekTotal) * 1000) / 10; // Round to 1 decimal
      }
    });

    // Only include weeks that have at least one day in range
    const hasInRangeDays = days.some((day) => day.isInRange);
    if (hasInRangeDays) {
      // Use full week span (Monday-Sunday) for label, not just in-range portion
      // This makes it easier to match the first column date with the week label
      weeks.set(weekNumber, {
        weekNumber,
        weekLabel: formatWeekLabel(weekStart, weekEnd),
        weekStart: formatDateToLocalString(weekStart),
        weekEnd: formatDateToLocalString(weekEnd),
        weekTotal,
        days,
      });
    }

    // Move to next Monday
    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  // Convert to array and sort by week number
  return Array.from(weeks.values()).sort((a, b) => {
    // Compare week start dates for proper chronological order
    return a.weekStart.localeCompare(b.weekStart);
  });
};

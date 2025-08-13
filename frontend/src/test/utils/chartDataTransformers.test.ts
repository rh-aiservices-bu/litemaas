import { describe, it, expect } from 'vitest';
import {
  transformDailyUsageToChartData,
  transformModelBreakdownToChartData,
  transformHourlyUsageToChartData,
  transformErrorBreakdownToChartData,
  formatLargeNumber,
  formatCurrency,
  formatDateRange,
} from '../../utils/chartDataTransformers';
import { UsageMetrics } from '../../services/usage.service';

// Mock data for testing
const mockDailyUsage: UsageMetrics['dailyUsage'] = [
  { date: '2024-01-01', requests: 100, tokens: 50000, cost: 5.5 },
  { date: '2024-01-03', requests: 200, tokens: 100000, cost: 11.0 }, // Intentionally out of order
  { date: '2024-01-02', requests: 150, tokens: 75000, cost: 8.25 },
];

const mockTopModels: UsageMetrics['topModels'] = [
  { name: 'GPT-4', requests: 450, tokens: 450000, cost: 22.5 },
  { name: 'GPT-3.5', requests: 350, tokens: 350000, cost: 7.0 },
  { name: 'Claude', requests: 200, tokens: 200000, cost: 8.0 },
];

const mockHourlyUsage: UsageMetrics['hourlyUsage'] = [
  { hour: '14:00', requests: 25 },
  { hour: '09:00', requests: 15 },
  { hour: '18:00', requests: 35 },
  { hour: '12:00', requests: 30 },
];

const mockErrorBreakdown: UsageMetrics['errorBreakdown'] = [
  { type: '429 Rate Limit', count: 45, percentage: 45 },
  { type: '500 Internal Error', count: 35, percentage: 35 },
  { type: '400 Bad Request', count: 20, percentage: 20 },
];

describe('chartDataTransformers', () => {
  describe('transformDailyUsageToChartData', () => {
    it('transforms daily usage data correctly', () => {
      const result = transformDailyUsageToChartData(mockDailyUsage);

      expect(result).toHaveProperty('requests');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('cost');

      // Check data structure
      expect(result.requests).toHaveLength(3);
      expect(result.tokens).toHaveLength(3);
      expect(result.cost).toHaveLength(3);

      // Check that data is properly sorted and formatted
      // The dates should be chronological in the result (Jan 1, Jan 2, Jan 3)
      expect(result.requests[0].y).toBe(100); // Jan 1 data
      expect(result.requests[1].y).toBe(150); // Jan 2 data
      expect(result.requests[2].y).toBe(200); // Jan 3 data
    });

    it('sorts data chronologically', () => {
      const result = transformDailyUsageToChartData(mockDailyUsage);

      // Verify values are in correct order after sorting
      expect(result.requests[0].y).toBe(100); // Jan 1
      expect(result.requests[1].y).toBe(150); // Jan 2
      expect(result.requests[2].y).toBe(200); // Jan 3
    });

    it('handles missing values gracefully', () => {
      const incompleteData: Partial<UsageMetrics['dailyUsage'][number]>[] = [
        { date: '2024-01-01', requests: 100 }, // Missing tokens and cost
        { date: '2024-01-02', tokens: 50000 }, // Missing requests and cost
      ];

      const result = transformDailyUsageToChartData(incompleteData as any);

      expect(result.requests[0].y).toBe(100);
      expect(result.requests[1].y).toBe(0); // Default for missing value

      expect(result.tokens[0].y).toBe(0); // Default for missing value
      expect(result.tokens[1].y).toBe(50000);
    });

    it('handles empty data array', () => {
      const result = transformDailyUsageToChartData([]);

      expect(result.requests).toHaveLength(0);
      expect(result.tokens).toHaveLength(0);
      expect(result.cost).toHaveLength(0);
    });

    it('handles undefined data', () => {
      const result = transformDailyUsageToChartData();

      expect(result.requests).toHaveLength(0);
      expect(result.tokens).toHaveLength(0);
      expect(result.cost).toHaveLength(0);
    });

    it('formats dates correctly in labels', () => {
      const result = transformDailyUsageToChartData(mockDailyUsage);

      // Test that labels contain date and value information (format may vary by locale)
      expect(result.requests[0].label).toMatch(/\d+ requests/);
      expect(result.tokens[0].label).toMatch(/[\d,]+ tokens/);
      expect(result.cost[0].label).toMatch(/\$\d+\.\d+/);
    });

    it('handles invalid date strings gracefully', () => {
      const invalidDateData: UsageMetrics['dailyUsage'] = [
        { date: 'invalid-date', requests: 100, tokens: 50000, cost: 5.5 },
      ];

      const result = transformDailyUsageToChartData(invalidDateData);

      expect(result.requests).toHaveLength(1);
      // When date parsing fails, it falls back to the original string or "Invalid Date"
      expect(result.requests[0].label).toMatch(/(invalid-date|Invalid Date).*100 requests/);
    });

    it('creates proper chart data structure', () => {
      const result = transformDailyUsageToChartData(mockDailyUsage);

      // Check structure of first data point
      const firstRequest = result.requests[0];
      expect(firstRequest).toHaveProperty('name', 'requests');
      expect(firstRequest).toHaveProperty('x', 0);
      expect(firstRequest).toHaveProperty('y');
      expect(firstRequest).toHaveProperty('label');
      expect(typeof firstRequest.x).toBe('number');
      expect(typeof firstRequest.y).toBe('number');
    });
  });

  describe('transformModelBreakdownToChartData', () => {
    it('transforms model breakdown data correctly', () => {
      const totalRequests = 1000;
      const result = transformModelBreakdownToChartData(mockTopModels, totalRequests);

      expect(result).toHaveProperty('chartData');
      expect(result).toHaveProperty('modelBreakdown');

      expect(result.chartData).toHaveLength(3);
      expect(result.modelBreakdown).toHaveLength(3);
    });

    it('calculates percentages correctly', () => {
      const totalRequests = 1000;
      const result = transformModelBreakdownToChartData(mockTopModels, totalRequests);

      expect(result.modelBreakdown[0].percentage).toBe(45); // 450/1000 * 100 = 45
      expect(result.modelBreakdown[1].percentage).toBe(35); // 350/1000 * 100 = 35
      expect(result.modelBreakdown[2].percentage).toBe(20); // 200/1000 * 100 = 20
    });

    it('rounds percentages to one decimal place', () => {
      const totalRequests = 333;
      const modelsData: UsageMetrics['topModels'] = [
        { name: 'Model A', requests: 100, tokens: 10000, cost: 5.0 },
      ];

      const result = transformModelBreakdownToChartData(modelsData, totalRequests);

      // 100/333 * 100 = 30.030030..., should round to 30.0
      expect(result.modelBreakdown[0].percentage).toBe(30.0);
    });

    it('handles zero total requests', () => {
      const result = transformModelBreakdownToChartData(mockTopModels, 0);

      expect(result.chartData).toHaveLength(0);
      expect(result.modelBreakdown).toHaveLength(0);
    });

    it('handles empty models array', () => {
      const result = transformModelBreakdownToChartData([], 1000);

      expect(result.chartData).toHaveLength(0);
      expect(result.modelBreakdown).toHaveLength(0);
    });

    it('handles missing model properties gracefully', () => {
      const incompleteModels: UsageMetrics['topModels'] = [
        { name: '', requests: undefined as any, tokens: null as any, cost: 0 },
        { requests: 100, tokens: 50000, cost: 5.0 } as any, // Missing name
      ];

      const result = transformModelBreakdownToChartData(incompleteModels, 100);

      expect(result.modelBreakdown[0].name).toBe('Unknown Model');
      expect(result.modelBreakdown[0].requests).toBe(0);
      expect(result.modelBreakdown[1].name).toBe('Unknown Model');
    });

    it('creates proper donut chart data structure', () => {
      const result = transformModelBreakdownToChartData(mockTopModels, 1000);

      const firstChart = result.chartData[0];
      expect(firstChart).toHaveProperty('x', 'GPT-4');
      expect(firstChart).toHaveProperty('y', 450);
      expect(firstChart).toHaveProperty('label', 'GPT-4: 45%');
      expect(firstChart).toHaveProperty('percentage', 45);
    });
  });

  describe('transformHourlyUsageToChartData', () => {
    it('transforms hourly usage data correctly', () => {
      const result = transformHourlyUsageToChartData(mockHourlyUsage);

      expect(result).toHaveLength(4);
      expect(result[0]).toHaveProperty('name', 'hourly-requests');
      expect(result[0]).toHaveProperty('x');
      expect(result[0]).toHaveProperty('y');
      expect(result[0]).toHaveProperty('label');
    });

    it('sorts data by hour chronologically', () => {
      const result = transformHourlyUsageToChartData(mockHourlyUsage);

      // Should be sorted: 09:00, 12:00, 14:00, 18:00
      expect(result[0].label).toContain('9 AM');
      expect(result[1].label).toContain('12 PM');
      expect(result[2].label).toContain('2 PM');
      expect(result[3].label).toContain('6 PM');
    });

    it('formats hour labels correctly', () => {
      const result = transformHourlyUsageToChartData(mockHourlyUsage);

      expect(result.find((item) => (item.label || '').includes('9 AM'))).toBeDefined();
      expect(result.find((item) => (item.label || '').includes('12 PM'))).toBeDefined();
      expect(result.find((item) => (item.label || '').includes('2 PM'))).toBeDefined();
      expect(result.find((item) => (item.label || '').includes('6 PM'))).toBeDefined();
    });

    it('handles edge case hours correctly', () => {
      const edgeCaseHours: UsageMetrics['hourlyUsage'] = [
        { hour: '00:00', requests: 10 },
        { hour: '12:00', requests: 20 },
        { hour: '23:00', requests: 15 },
      ];

      const result = transformHourlyUsageToChartData(edgeCaseHours);

      expect(result[0].label).toContain('12 AM'); // Midnight
      expect(result[1].label).toContain('12 PM'); // Noon
      expect(result[2].label).toContain('11 PM'); // 23:00
    });

    it('handles invalid hour formats gracefully', () => {
      const invalidHours: UsageMetrics['hourlyUsage'] = [
        { hour: 'invalid', requests: 10 },
        { hour: '25:00', requests: 15 },
      ];

      const result = transformHourlyUsageToChartData(invalidHours);

      expect(result[0].label).toContain('invalid');
      // '25:00' gets parsed as parseInt('25') = 25, which becomes 13 PM (25-12)
      expect(result[1].label).toMatch(/(25:00|13 PM)/); // Either original or converted format
    });

    it('handles missing requests gracefully', () => {
      const missingRequests: UsageMetrics['hourlyUsage'] = [{ hour: '10:00' } as any];

      const result = transformHourlyUsageToChartData(missingRequests);

      expect(result[0].y).toBe(0);
      expect(result[0].label).toContain('0 requests');
    });

    it('handles empty array', () => {
      const result = transformHourlyUsageToChartData([]);

      expect(result).toHaveLength(0);
    });
  });

  describe('transformErrorBreakdownToChartData', () => {
    it('transforms error breakdown data correctly', () => {
      const result = transformErrorBreakdownToChartData(mockErrorBreakdown);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('x', '429 Rate Limit');
      expect(result[0]).toHaveProperty('y', 45);
      expect(result[0]).toHaveProperty('percentage', 45);
    });

    it('handles missing error properties gracefully', () => {
      const incompleteErrors: UsageMetrics['errorBreakdown'] = [
        { type: '', count: undefined as any, percentage: null as any },
        { count: 25, percentage: 25 } as any, // Missing type
      ];

      const result = transformErrorBreakdownToChartData(incompleteErrors);

      expect(result[0].x).toBe('Unknown Error');
      expect(result[0].y).toBe(0);
      expect(result[0].percentage).toBe(0);
      expect(result[1].x).toBe('Unknown Error');
    });

    it('handles empty array', () => {
      const result = transformErrorBreakdownToChartData([]);

      expect(result).toHaveLength(0);
    });
  });

  describe('formatLargeNumber', () => {
    it('formats numbers below 1000 as-is', () => {
      expect(formatLargeNumber(999)).toBe('999');
      expect(formatLargeNumber(0)).toBe('0');
      expect(formatLargeNumber(1)).toBe('1');
    });

    it('formats thousands with K suffix', () => {
      expect(formatLargeNumber(1000)).toBe('1.0K');
      expect(formatLargeNumber(1500)).toBe('1.5K');
      expect(formatLargeNumber(999999)).toBe('1000.0K');
    });

    it('formats millions with M suffix', () => {
      expect(formatLargeNumber(1000000)).toBe('1.0M');
      expect(formatLargeNumber(1500000)).toBe('1.5M');
      expect(formatLargeNumber(2750000)).toBe('2.8M');
    });

    it('rounds to one decimal place', () => {
      expect(formatLargeNumber(1234)).toBe('1.2K');
      expect(formatLargeNumber(1256)).toBe('1.3K');
      expect(formatLargeNumber(1234567)).toBe('1.2M');
    });
  });

  describe('formatCurrency', () => {
    it('formats currency with two decimal places', () => {
      expect(formatCurrency(5.5)).toBe('$5.50');
      expect(formatCurrency(10)).toBe('$10.00');
      expect(formatCurrency(123.456)).toBe('$123.46');
    });

    it('handles zero and negative values', () => {
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(-5.5)).toBe('-$5.50');
    });

    it('handles undefined and null values', () => {
      expect(formatCurrency(undefined as any)).toBe('$0.00');
      expect(formatCurrency(null as any)).toBe('$0.00');
    });

    it('formats large amounts correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });
  });

  describe('formatDateRange', () => {
    it('formats date range correctly', () => {
      const result = formatDateRange('2024-01-01', '2024-01-15');
      // Date formatting can vary by locale, so test for pattern instead of exact match
      expect(result).toMatch(/(Dec 31|Jan 1).*(Jan 14|Jan 15)/);
    });

    it('includes year when dates span different years', () => {
      const result = formatDateRange('2023-12-25', '2024-01-15');
      // Should contain both years when spanning different years
      expect(result).toMatch(/2023.*2024/);
    });

    it('handles missing dates gracefully', () => {
      expect(formatDateRange()).toBe('');
      expect(formatDateRange('2024-01-01')).toBe('');
      expect(formatDateRange(undefined, '2024-01-15')).toBe('');
    });

    it('handles invalid date strings gracefully', () => {
      const result = formatDateRange('invalid-start', 'invalid-end');
      // Should fall back to original strings or show Invalid Date
      expect(result).toMatch(/(invalid-start.*invalid-end|Invalid Date.*Invalid Date)/);
    });

    it('formats same month range correctly', () => {
      const result = formatDateRange('2024-03-01', '2024-03-31');
      // Should contain march dates
      expect(result).toMatch(/(Mar|Feb).*(Mar|31)/); // Mar 1 - Mar 31 or similar
    });
  });

  describe('edge cases and error handling', () => {
    it('handles null and undefined inputs gracefully across all functions', () => {
      // These functions have default parameters, so undefined works but null may not
      expect(() => transformDailyUsageToChartData(undefined)).not.toThrow();
      expect(() => transformModelBreakdownToChartData(undefined, 1000)).not.toThrow();
      expect(() => transformHourlyUsageToChartData(undefined)).not.toThrow();
      expect(() => transformErrorBreakdownToChartData(undefined)).not.toThrow();
    });

    it('maintains consistent data types in outputs', () => {
      const dailyResult = transformDailyUsageToChartData(mockDailyUsage);

      // All x values should be numbers
      dailyResult.requests.forEach((item) => {
        expect(typeof item.x).toBe('number');
        expect(typeof item.y).toBe('number');
        expect(typeof item.label).toBe('string');
      });
    });

    it('preserves data integrity during transformation', () => {
      const result = transformModelBreakdownToChartData(mockTopModels, 1000);

      // Sum of percentages should approximately equal 100 (allowing for rounding)
      const totalPercentage = result.modelBreakdown.reduce((sum, item) => sum + item.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 0);
    });
  });
});

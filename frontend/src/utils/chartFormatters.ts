/**
 * Chart formatting utilities
 * Shared formatting functions for chart components to ensure consistency
 */

/**
 * Format Y-axis tick values based on metric type
 * @param value - The numeric value to format
 * @param metricType - Type of metric (requests, tokens, cost, prompt_tokens, completion_tokens)
 * @returns Formatted string for display
 */
export const formatYTickByMetric = (
  value: number,
  metricType: 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens',
): string => {
  switch (metricType) {
    case 'cost':
      return `$${value >= 1000 ? (value / 1000).toFixed(1) + 'K' : value.toFixed(0)}`;
    case 'tokens':
    case 'prompt_tokens':
    case 'completion_tokens':
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toString();
    default:
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toString();
  }
};

/**
 * Format X-axis tick labels with automatic skipping for readability
 * Shows all labels when ≤ 30 data points, every other label when > 30
 * @param value - The numeric index value
 * @param labels - Array of label strings
 * @returns Formatted label or empty string if should be skipped
 */
export const formatXTickWithSkipping = (value: number, labels: string[]): string => {
  const label = labels[Math.round(value)];
  if (!label) return '';

  // Show all labels when ≤ 30 data points, every other label when > 30
  const dataLength = labels.length;
  if (dataLength > 30 && Math.round(value) % 2 !== 0) {
    return ''; // Hide odd-indexed labels
  }
  return label;
};

/**
 * Calculate left padding for chart based on metric type
 * Ensures Y-axis labels are fully visible
 * @param metricType - Type of metric (requests, tokens, cost, prompt_tokens, completion_tokens)
 * @returns Left padding in pixels
 */
export const calculateLeftPaddingByMetric = (
  metricType: 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens',
): number => {
  switch (metricType) {
    case 'cost':
      return 50; // Extra space for $ symbol
    case 'tokens':
    case 'prompt_tokens':
    case 'completion_tokens':
      return 55; // Extra space for larger numbers (M, K suffixes)
    default:
      return 45; // Standard padding for requests
  }
};

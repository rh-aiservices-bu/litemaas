/**
 * Logarithmic color scale utility for heatmap visualizations
 * Generates discrete color levels with proper intensity variations
 */

import { getMetricColor } from './chartAccessibility';

export interface LogarithmicColorScale {
  levels: number; // 5-7 discrete levels
  thresholds: number[]; // Value thresholds for each level
  colors: string[]; // Color for each level
  ranges: Array<{
    min: number;
    max: number;
    color: string;
    label: string; // Formatted range label (e.g., "1-10", "10-100", "100-1K")
  }>;
  getColorForValue: (value: number) => string;
  getLevelForValue: (value: number) => number; // 0 to levels-1
}

type MetricType = 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens';

/**
 * Format large numbers with compact notation (K, M, B)
 * Used for legend labels
 */
export const formatValueForLegend = (value: number, metricType?: MetricType): string => {
  // For cost, include currency symbol
  if (metricType === 'cost') {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
  }

  // For other metrics, use standard compact notation
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  // For small values, show as integer
  return Math.round(value).toString();
};

/**
 * Generate color variations with different intensities
 * Takes a base color and creates lighter/darker variants
 */
const generateColorIntensities = (baseColor: string, levels: number): string[] => {
  // Parse hex color
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const colors: string[] = [];

  // Generate colors from lightest to darkest
  for (let i = 0; i < levels; i++) {
    // Factor ranges from 0.3 (lightest) to 1.0 (full intensity)
    const factor = 0.3 + (0.7 * i) / (levels - 1);

    // Apply factor to RGB values
    const newR = Math.round(255 - (255 - r) * factor);
    const newG = Math.round(255 - (255 - g) * factor);
    const newB = Math.round(255 - (255 - b) * factor);

    // Convert back to hex
    const newHex = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    colors.push(newHex);
  }

  return colors;
};

/**
 * Generate a logarithmic color scale for heatmap visualization
 * Handles edge cases: all zeros, single value, small ranges
 *
 * @param values - Array of numeric values to analyze
 * @param metricType - Type of metric for base color selection
 * @param levels - Number of discrete color levels (default: 6)
 * @returns LogarithmicColorScale object with thresholds, colors, and helper functions
 */
export const generateLogarithmicColorScale = (
  values: number[],
  metricType: MetricType = 'requests',
  levels: number = 6,
): LogarithmicColorScale => {
  // Filter out null, undefined, and zero values for scale calculation
  const nonZeroValues = values.filter((v) => v != null && v > 0);

  // Edge case: No non-zero values
  if (nonZeroValues.length === 0) {
    const baseColor = getMetricColor(metricType);
    const colors = generateColorIntensities(baseColor, levels);

    return {
      levels,
      thresholds: Array.from({ length: levels }, (_, i) => i + 1),
      colors,
      ranges: [
        {
          min: 0,
          max: 1,
          color: colors[0],
          label: '0',
        },
      ],
      getColorForValue: () => colors[0],
      getLevelForValue: () => 0,
    };
  }

  // Get min and max of non-zero values
  const minValue = Math.min(...nonZeroValues);
  const maxValue = Math.max(...nonZeroValues);

  // Edge case: All values are the same
  if (minValue === maxValue) {
    const baseColor = getMetricColor(metricType);
    const colors = generateColorIntensities(baseColor, levels);
    const midLevel = Math.floor(levels / 2);

    return {
      levels,
      thresholds: [minValue],
      colors,
      ranges: [
        {
          min: minValue,
          max: minValue,
          color: colors[midLevel],
          label: formatValueForLegend(minValue, metricType),
        },
      ],
      getColorForValue: (value: number) => (value === minValue ? colors[midLevel] : colors[0]),
      getLevelForValue: (value: number) => (value === minValue ? midLevel : 0),
    };
  }

  // Edge case: Small range (less than 10x difference)
  const ratio = maxValue / minValue;
  if (ratio < 10) {
    // Use linear scale for small ranges
    const baseColor = getMetricColor(metricType);
    const colors = generateColorIntensities(baseColor, levels);
    const step = (maxValue - minValue) / levels;

    const thresholds = Array.from({ length: levels }, (_, i) => minValue + i * step);

    const ranges = thresholds.map((threshold, i) => ({
      min: threshold,
      max: i < levels - 1 ? thresholds[i + 1] : maxValue,
      color: colors[i],
      label:
        i < levels - 1
          ? `${formatValueForLegend(threshold, metricType)}-${formatValueForLegend(thresholds[i + 1], metricType)}`
          : `${formatValueForLegend(threshold, metricType)}+`,
    }));

    return {
      levels,
      thresholds,
      colors,
      ranges,
      getColorForValue: (value: number) => {
        if (value <= 0) return colors[0];
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (value >= thresholds[i]) return colors[i];
        }
        return colors[0];
      },
      getLevelForValue: (value: number) => {
        if (value <= 0) return 0;
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (value >= thresholds[i]) return i;
        }
        return 0;
      },
    };
  }

  // Standard case: Use logarithmic scale
  const logMin = Math.log10(Math.max(1, minValue));
  const logMax = Math.log10(maxValue);
  const logStep = (logMax - logMin) / (levels - 1);

  // Generate logarithmic thresholds
  const thresholds = Array.from({ length: levels }, (_, i) => Math.pow(10, logMin + i * logStep));

  // Generate color intensities
  const baseColor = getMetricColor(metricType);
  const colors = generateColorIntensities(baseColor, levels);

  // Generate ranges for legend
  const ranges = thresholds.map((threshold, i) => ({
    min: threshold,
    max: i < levels - 1 ? thresholds[i + 1] : maxValue * 1.1,
    color: colors[i],
    label:
      i < levels - 1
        ? `${formatValueForLegend(threshold, metricType)}-${formatValueForLegend(thresholds[i + 1], metricType)}`
        : `${formatValueForLegend(threshold, metricType)}+`,
  }));

  // Helper function to get color for a value
  const getColorForValue = (value: number): string => {
    if (value <= 0) return colors[0];

    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (value >= thresholds[i]) {
        return colors[i];
      }
    }
    return colors[0];
  };

  // Helper function to get level index for a value
  const getLevelForValue = (value: number): number => {
    if (value <= 0) return 0;

    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (value >= thresholds[i]) {
        return i;
      }
    }
    return 0;
  };

  return {
    levels,
    thresholds,
    colors,
    ranges,
    getColorForValue,
    getLevelForValue,
  };
};

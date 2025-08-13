import { describe, it, expect } from 'vitest';
import {
  ACCESSIBLE_COLORS,
  STROKE_PATTERNS,
  getChartPattern,
  getMetricColor,
  getMetricStrokePattern,
  generateAccessibleColorScheme,
  generateAccessibleStrokePatterns,
  hasGoodContrast,
  generateAccessibleLegend,
  generateChartAriaDescription,
  COLOR_BLIND_FRIENDLY,
} from '../../utils/chartAccessibility';

describe('chartAccessibility', () => {
  describe('ACCESSIBLE_COLORS', () => {
    it('defines primary colors correctly', () => {
      expect(ACCESSIBLE_COLORS.primary).toMatchObject({
        blue: '#0066cc',
        darkBlue: '#004494',
        green: '#0f9d58',
        orange: '#d93025',
        purple: '#9c27b0',
      });
    });

    it('defines secondary colors correctly', () => {
      expect(ACCESSIBLE_COLORS.secondary).toMatchObject({
        lightBlue: '#4285f4',
        lightGreen: '#34a853',
        lightOrange: '#ea4335',
        lightPurple: '#ab47bc',
      });
    });

    it('defines neutral colors correctly', () => {
      expect(ACCESSIBLE_COLORS.neutral).toMatchObject({
        dark: '#202124',
        medium: '#5f6368',
        light: '#9aa0a6',
      });
    });
  });

  describe('STROKE_PATTERNS', () => {
    it('defines stroke patterns correctly', () => {
      expect(STROKE_PATTERNS).toMatchObject({
        solid: undefined,
        dashed: '8,4',
        dotted: '2,3',
        dashdot: '8,4,2,4',
        longdash: '12,6',
        shortdash: '4,2',
      });
    });
  });

  describe('getChartPattern', () => {
    it('returns colors for color type', () => {
      const color0 = getChartPattern(0, 'color');
      const color1 = getChartPattern(1, 'color');

      expect(color0).toBe('#0066cc'); // First primary color (blue)
      expect(color1).toBe('#004494'); // Second primary color (darkBlue)
    });

    it('returns stroke patterns for stroke type', () => {
      const pattern0 = getChartPattern(0, 'stroke');
      const pattern1 = getChartPattern(1, 'stroke');

      expect(pattern0).toBeUndefined(); // First pattern (solid)
      expect(pattern1).toBe('8,4'); // Second pattern (dashed)
    });

    it('cycles through patterns when index exceeds available patterns', () => {
      const primaryColorCount = Object.keys(ACCESSIBLE_COLORS.primary).length;
      const colorBeyondLimit = getChartPattern(primaryColorCount, 'color');
      const colorFirst = getChartPattern(0, 'color');

      expect(colorBeyondLimit).toBe(colorFirst); // Should cycle back to first
    });

    it('handles large indices correctly', () => {
      const color100 = getChartPattern(100, 'color');
      const pattern100 = getChartPattern(100, 'stroke');

      expect(color100).toBeDefined();
      expect(typeof color100).toBe('string');
      // pattern100 can be string or undefined
      expect([undefined, 'string'].includes(typeof pattern100)).toBe(true);
    });
  });

  describe('getMetricColor', () => {
    it('returns correct colors for each metric type', () => {
      expect(getMetricColor('requests')).toBe(ACCESSIBLE_COLORS.primary.blue);
      expect(getMetricColor('tokens')).toBe(ACCESSIBLE_COLORS.primary.green);
      expect(getMetricColor('cost')).toBe(ACCESSIBLE_COLORS.primary.orange);
    });

    it('returns default color for unknown metric type', () => {
      expect(getMetricColor('unknown' as any)).toBe(ACCESSIBLE_COLORS.primary.blue);
    });
  });

  describe('getMetricStrokePattern', () => {
    it('returns correct stroke patterns for each metric type', () => {
      expect(getMetricStrokePattern('requests')).toBe(STROKE_PATTERNS.solid);
      expect(getMetricStrokePattern('tokens')).toBe(STROKE_PATTERNS.dashed);
      expect(getMetricStrokePattern('cost')).toBe(STROKE_PATTERNS.dotted);
    });

    it('returns default pattern for unknown metric type', () => {
      expect(getMetricStrokePattern('unknown' as any)).toBe(STROKE_PATTERNS.solid);
    });
  });

  describe('generateAccessibleColorScheme', () => {
    it('generates color scheme for requested count', () => {
      const colors3 = generateAccessibleColorScheme(3);
      expect(colors3).toHaveLength(3);
      expect(colors3).toEqual([
        ACCESSIBLE_COLORS.primary.blue,
        ACCESSIBLE_COLORS.primary.darkBlue,
        ACCESSIBLE_COLORS.primary.green,
      ]);
    });

    it('cycles colors when count exceeds available colors', () => {
      const primaryColorCount = Object.keys(ACCESSIBLE_COLORS.primary).length;
      const colors = generateAccessibleColorScheme(primaryColorCount + 2);

      expect(colors).toHaveLength(primaryColorCount + 2);
      // First few colors should be unique
      expect(colors[0]).toBe(ACCESSIBLE_COLORS.primary.blue);
      // Should cycle back to first colors
      expect(colors[primaryColorCount]).toBe(colors[0]);
      expect(colors[primaryColorCount + 1]).toBe(colors[1]);
    });

    it('handles zero count', () => {
      const colors = generateAccessibleColorScheme(0);
      expect(colors).toHaveLength(0);
    });

    it('handles large counts efficiently', () => {
      const colors = generateAccessibleColorScheme(100);
      expect(colors).toHaveLength(100);
      // Should not throw and should cycle properly
      expect(colors[0]).toBe(colors[Object.keys(ACCESSIBLE_COLORS.primary).length]);
    });
  });

  describe('generateAccessibleStrokePatterns', () => {
    it('generates stroke patterns for requested count', () => {
      const patterns3 = generateAccessibleStrokePatterns(3);
      expect(patterns3).toHaveLength(3);
      expect(patterns3).toEqual([
        STROKE_PATTERNS.solid,
        STROKE_PATTERNS.dashed,
        STROKE_PATTERNS.dotted,
      ]);
    });

    it('cycles patterns when count exceeds available patterns', () => {
      const patternCount = Object.keys(STROKE_PATTERNS).length;
      const patterns = generateAccessibleStrokePatterns(patternCount + 2);

      expect(patterns).toHaveLength(patternCount + 2);
      expect(patterns[patternCount]).toBe(patterns[0]);
      expect(patterns[patternCount + 1]).toBe(patterns[1]);
    });

    it('handles zero count', () => {
      const patterns = generateAccessibleStrokePatterns(0);
      expect(patterns).toHaveLength(0);
    });

    it('includes undefined values for solid patterns', () => {
      const patterns = generateAccessibleStrokePatterns(1);
      expect(patterns[0]).toBeUndefined(); // First pattern is solid (undefined)
    });
  });

  describe('hasGoodContrast', () => {
    it('returns true for predefined accessible colors', () => {
      expect(hasGoodContrast(ACCESSIBLE_COLORS.primary.blue)).toBe(true);
      expect(hasGoodContrast(ACCESSIBLE_COLORS.primary.green)).toBe(true);
      expect(hasGoodContrast(ACCESSIBLE_COLORS.primary.orange)).toBe(true);
    });

    it('returns false for non-predefined colors', () => {
      expect(hasGoodContrast('#ffffff')).toBe(false);
      expect(hasGoodContrast('#random')).toBe(false);
    });

    it('handles background color parameter (simplified implementation)', () => {
      // Current implementation ignores background, but should still work
      expect(hasGoodContrast(ACCESSIBLE_COLORS.primary.blue, '#000000')).toBe(true);
    });
  });

  describe('generateAccessibleLegend', () => {
    it('generates legend items with default pattern', () => {
      const labels = ['Series 1', 'Series 2', 'Series 3'];
      const legend = generateAccessibleLegend(labels);

      expect(legend).toHaveLength(3);
      expect(legend[0]).toMatchObject({
        name: 'Series 1',
        color: ACCESSIBLE_COLORS.primary.blue,
        pattern: undefined,
        description: undefined,
      });
      expect(legend[1]).toMatchObject({
        name: 'Series 2',
        color: ACCESSIBLE_COLORS.primary.darkBlue,
        pattern: STROKE_PATTERNS.dashed,
        description: undefined,
      });
    });

    it('includes descriptions when provided', () => {
      const labels = ['Series 1', 'Series 2'];
      const descriptions = ['First series', 'Second series'];
      const legend = generateAccessibleLegend(labels, descriptions);

      expect(legend[0].description).toBe('First series');
      expect(legend[1].description).toBe('Second series');
    });

    it('handles mismatched labels and descriptions', () => {
      const labels = ['Series 1', 'Series 2', 'Series 3'];
      const descriptions = ['First series']; // Fewer descriptions than labels
      const legend = generateAccessibleLegend(labels, descriptions);

      expect(legend[0].description).toBe('First series');
      expect(legend[1].description).toBeUndefined();
      expect(legend[2].description).toBeUndefined();
    });

    it('handles empty labels array', () => {
      const legend = generateAccessibleLegend([]);
      expect(legend).toHaveLength(0);
    });

    it('generates unique patterns for each item', () => {
      const labels = ['A', 'B', 'C', 'D', 'E'];
      const legend = generateAccessibleLegend(labels);

      // First item should be solid (undefined pattern)
      expect(legend[0].pattern).toBeUndefined();
      // Subsequent items should have different patterns
      expect(legend[1].pattern).toBe(STROKE_PATTERNS.dashed);
      expect(legend[2].pattern).toBe(STROKE_PATTERNS.dotted);
    });
  });

  describe('generateChartAriaDescription', () => {
    it('generates basic chart description', () => {
      const description = generateChartAriaDescription('line', 5);
      expect(description).toContain('line chart');
      expect(description).toContain('5 data points');
      expect(description).toContain('Use Tab to navigate');
    });

    it('includes metric type when provided', () => {
      const description = generateChartAriaDescription('bar', 10, 'requests');
      expect(description).toContain('bar chart');
      expect(description).toContain('10 data points');
      expect(description).toContain('showing requests data');
    });

    it('includes keyboard instructions', () => {
      const description = generateChartAriaDescription('pie', 3);
      expect(description).toContain('Use Tab to navigate controls');
      expect(description).toContain('T to toggle table view');
      expect(description).toContain('E to export data');
    });

    it('handles zero data points', () => {
      const description = generateChartAriaDescription('donut', 0);
      expect(description).toContain('0 data points');
    });

    it('handles large data point counts', () => {
      const description = generateChartAriaDescription('area', 1000, 'tokens');
      expect(description).toContain('1000 data points');
      expect(description).toContain('showing tokens data');
    });
  });

  describe('COLOR_BLIND_FRIENDLY', () => {
    it('defines Okabe-Ito color palette', () => {
      expect(COLOR_BLIND_FRIENDLY.colors).toHaveLength(8);
      expect(COLOR_BLIND_FRIENDLY.colors[0]).toBe('#E69F00'); // Orange
      expect(COLOR_BLIND_FRIENDLY.colors[1]).toBe('#56B4E9'); // Sky Blue
      expect(COLOR_BLIND_FRIENDLY.colors[2]).toBe('#009E73'); // Bluish Green
    });

    it('defines high contrast palette', () => {
      expect(COLOR_BLIND_FRIENDLY.highContrast).toHaveLength(8);
      expect(COLOR_BLIND_FRIENDLY.highContrast[0]).toBe('#000000'); // Black
      expect(COLOR_BLIND_FRIENDLY.highContrast[1]).toBe('#FFFFFF'); // White
    });

    it('maintains color blind friendly principles', () => {
      // The Okabe-Ito palette should not contain problematic color combinations
      const colors = COLOR_BLIND_FRIENDLY.colors;
      expect(colors).not.toContain('#ff0000'); // Pure red
      expect(colors).not.toContain('#00ff00'); // Pure green

      // Should contain distinguishable colors
      expect(colors).toContain('#E69F00'); // Orange (distinguishable)
      expect(colors).toContain('#0072B2'); // Blue (distinguishable)
    });
  });

  describe('integration and edge cases', () => {
    it('maintains consistency between color and pattern generation', () => {
      const count = 5;
      const colors = generateAccessibleColorScheme(count);
      const patterns = generateAccessibleStrokePatterns(count);

      expect(colors).toHaveLength(count);
      expect(patterns).toHaveLength(count);

      // Colors and patterns should cycle independently
      expect(colors[0]).toBe(ACCESSIBLE_COLORS.primary.blue);
      expect(patterns[0]).toBeUndefined(); // solid
    });

    it('handles string inputs safely', () => {
      expect(() => hasGoodContrast('not-a-color')).not.toThrow();
      expect(() => generateChartAriaDescription('custom-chart', 5)).not.toThrow();
    });

    it('provides fallbacks for invalid inputs', () => {
      expect(getMetricColor('invalid' as any)).toBe(ACCESSIBLE_COLORS.primary.blue);
      expect(getMetricStrokePattern('invalid' as any)).toBeUndefined();
    });

    it('generates accessible legend with complete pattern cycling', () => {
      const manyLabels = Array.from({ length: 15 }, (_, i) => `Label ${i + 1}`);
      const legend = generateAccessibleLegend(manyLabels);

      expect(legend).toHaveLength(15);

      // Should cycle through both colors and patterns
      const colorCount = Object.keys(ACCESSIBLE_COLORS.primary).length;
      const patternCount = Object.keys(STROKE_PATTERNS).length;

      expect(legend[colorCount].color).toBe(legend[0].color);
      expect(legend[patternCount].pattern).toBe(legend[0].pattern);
    });

    it('maintains type safety across all functions', () => {
      // Test that all functions return expected types
      const colors = generateAccessibleColorScheme(3);
      colors.forEach((color) => expect(typeof color).toBe('string'));

      const patterns = generateAccessibleStrokePatterns(3);
      patterns.forEach((pattern) => {
        expect(['string', 'undefined'].includes(typeof pattern)).toBe(true);
      });

      const legend = generateAccessibleLegend(['Test']);
      expect(Array.isArray(legend)).toBe(true);
      expect(legend[0]).toHaveProperty('name');
      expect(legend[0]).toHaveProperty('color');
    });
  });
});

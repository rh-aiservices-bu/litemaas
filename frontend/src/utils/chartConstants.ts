/**
 * Chart constants
 * Shared constants for chart components to ensure consistency
 */

/**
 * Standard chart padding configuration
 */
export const CHART_PADDING = {
  top: 10,
  right: 10,
  bottomBase: 30, // Base bottom padding (before legend adjustments)
  bottomWithLegend: 75, // Bottom padding when legend is present
} as const;

/**
 * Tooltip styling configuration
 * Shared across all chart components for consistent appearance
 */
export const TOOLTIP_STYLES = {
  background: '#151515',
  border: '#3c3f42',
  borderWidth: 1,
  borderRadius: 4,
  padding: 12,
  pointerSize: 8,
  edgeMargin: 10, // Minimum distance from chart edges
  shadowBlur: 3,
  shadowOffset: 2,
  shadowOpacity: 0.3,
  textColor: '#ffffff',
  titleFontSize: 12,
  entryFontSize: 11,
} as const;

/**
 * Grid styling configuration
 */
export const GRID_STYLES = {
  stroke: 'lightgray',
  strokeDasharray: '3,3',
} as const;

/**
 * Chart animation configuration
 */
export const CHART_ANIMATION = {
  duration: 1000,
  onLoadDuration: 1,
} as const;

/**
 * Axis styling configuration
 */
export const AXIS_STYLES = {
  tickLabelFontSize: 10,
  xAxisAngle: -30,
  xAxisAnchor: 'end' as const,
} as const;

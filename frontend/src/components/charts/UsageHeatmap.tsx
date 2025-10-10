/**
 * UsageHeatmap component - Weekly usage pattern visualization
 * Table-based heatmap with tooltips, colors, and keyboard navigation
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton, Tooltip } from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td, Caption } from '@patternfly/react-table';
import { HeatmapWeekData } from '../../utils/chartDataTransformers';
import { generateLogarithmicColorScale, LogarithmicColorScale } from '../../utils/chartColorScale';
import HeatmapLegend from './HeatmapLegend';
import AccessibleChart from './AccessibleChart';

type MetricType = 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens';

export interface UsageHeatmapProps {
  data: HeatmapWeekData[];
  loading?: boolean;
  metricType?: MetricType;
  height?: number;
  colorScale?: LogarithmicColorScale;
}

/**
 * Parse YYYY-MM-DD string as local date (not UTC)
 * Avoids timezone shift issues when displaying dates
 */
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const UsageHeatmap: React.FC<UsageHeatmapProps> = ({
  data = [],
  loading = false,
  metricType = 'requests',
  height = 300,
}) => {
  const { t } = useTranslation();
  const [containerWidth, setContainerWidth] = React.useState(800);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  // Measure container width for responsive table sizing using ref callback
  const containerRef = React.useCallback((element: HTMLDivElement | null) => {
    // Disconnect previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    // Setup new observer if element exists
    if (element) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserverRef.current.observe(element);
    }
  }, []);

  // Cleanup effect: Ensures cleanup on unmount (defense-in-depth)
  // This handles edge cases like navigation, error boundaries, and conditional rendering
  React.useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, []);

  // Calculate column widths based on container
  const weekColumnWidth = 120; // Fixed width for date ranges like "Sep 29-Oct 5" (increased to prevent truncation)
  // Account for borders: 8 columns × 2px (left + right borders, but they collapse)
  // In practice, with border-collapse, we need about 8-10px total for all borders
  const borderAdjustment = 10;
  const remainingWidth = Math.max(0, containerWidth - weekColumnWidth - borderAdjustment);
  const dayColumnWidth = remainingWidth > 0 ? Math.floor(remainingWidth / 7) : 80; // Fallback to 80px minimum

  // Generate color scale from data
  const colorScale = useMemo(() => {
    const allValues = data.flatMap((week) => week.days.map((day) => day.value || 0));
    return generateLogarithmicColorScale(allValues, metricType, 6);
  }, [data, metricType]);

  // Day abbreviations (i18n)
  const dayAbbreviations = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Get cell color based on value and state
  const getCellColor = (value: number | null, isInRange: boolean): string => {
    if (!isInRange) {
      return 'var(--pf-t--global--background--color--200)'; // Grey for out-of-range
    }
    if (value === null || value === 0) {
      return 'var(--pf-t--global--background--color--100)'; // White for zero
    }
    return colorScale.getColorForValue(value);
  };

  // Get cell styles including out-of-range pattern
  const getCellStyle = (
    value: number | null,
    isInRange: boolean,
    columnWidth: number,
  ): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      backgroundColor: getCellColor(value, isInRange),
      border: '1px solid var(--pf-t--global--border--color--default)',
      minWidth: `${columnWidth}px`,
      maxWidth: `${columnWidth}px`,
      height: '48px',
      textAlign: 'center',
      verticalAlign: 'middle',
      position: 'relative',
      padding: '0',
    };

    // Add diagonal pattern for out-of-range cells
    if (!isInRange) {
      return {
        ...baseStyle,
        backgroundColor: 'var(--pf-t--global--background--color--200)', // Light grey base
        backgroundImage: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 5px,
          var(--pf-t--global--border--color--200) 5px,
          var(--pf-t--global--border--color--200) 6px
        )`,
      };
    }

    return baseStyle;
  };

  // Generate tooltip content
  const getTooltipContent = (
    dayName: string,
    date: string,
    formattedValue: string,
    percentOfWeek: number,
    isInRange: boolean,
    value: number | null,
  ): React.ReactNode => {
    if (!isInRange) {
      return (
        <div>
          <div>
            {dayName},{' '}
            {parseLocalDate(date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <div>{t('adminUsage.heatmap.tooltip.noDataOutsideRange')}</div>
        </div>
      );
    }

    const fullDate = parseLocalDate(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Show "Zero usage" for cells with no activity
    if (value === null || value === 0) {
      return (
        <div>
          <div>{fullDate}</div>
          <div>{t('adminUsage.heatmap.tooltip.zeroUsage', 'Zero usage')}</div>
        </div>
      );
    }

    // Show value and percentage for cells with activity
    const percentText = t('adminUsage.heatmap.tooltip.percentOfWeek', {
      percent: percentOfWeek.toFixed(1),
    });

    return (
      <div>
        <div>{fullDate}</div>
        <div>{formattedValue}</div>
        <div>{percentText}</div>
      </div>
    );
  };

  // Compute the key that AccessibleChart will use to look up values
  // The header is translated, then lowercased with spaces removed
  const metricHeader = t(`pages.usage.metrics.${metricType}`);
  const metricKey = metricHeader.toLowerCase().replace(/\s+/g, '');

  // Transform data for AccessibleChart
  const accessibleData = useMemo(() => {
    return data.flatMap((week) =>
      week.days.map((day) => {
        // Check if this is Monday (first day of week) for bold styling
        const isMonday = day.dayName.startsWith('Mon');

        return {
          label: `${day.dayName}, ${day.date}`,
          value: day.value || 0,
          labelStyle: isMonday ? { fontWeight: 'bold' } : undefined,
          additionalInfo: {
            [metricKey]: day.formattedValue,
            [`${metricKey}Raw`]: day.value || 0,
          },
        };
      }),
    );
  }, [data, metricKey]);

  // Loading state
  if (loading) {
    return <Skeleton height={`${height}px`} width="100%" />;
  }

  // No data state
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--pf-t--global--text--color--subtle)',
        }}
        role="status"
        aria-live="polite"
      >
        {t('pages.usage.charts.noDataAvailable')}
      </div>
    );
  }

  // Table-based Heatmap view
  return (
    <AccessibleChart
      data={accessibleData}
      title={t('pages.usage.weeklyUsagePatterns')}
      description={t('adminUsage.heatmap.accessibility.heatmapDescription', {
        metric: t(`pages.usage.metrics.${metricType}`),
        weeks: data.length,
      })}
      chartType="area"
      labelHeader={t('pages.usage.tableHeaders.date')}
      additionalHeaders={[t(`pages.usage.metrics.${metricType}`)]}
    >
      <div ref={containerRef} style={{ width: '100%' }}>
        <Table
          variant="compact"
          aria-label={t('adminUsage.heatmap.accessibility.heatmapDescription', {
            metric: t(`pages.usage.metrics.${metricType}`),
            weeks: data.length,
          })}
          style={{ width: '100%', tableLayout: 'fixed', minWidth: 'min-content' }}
        >
          <Caption className="pf-v6-screen-reader">
            {t('adminUsage.heatmap.accessibility.heatmapDescription', {
              metric: t(`pages.usage.metrics.${metricType}`),
              weeks: data.length,
            })}
          </Caption>

          {/* Column headers (days of week) */}
          <Thead>
            <Tr>
              <Th
                style={{
                  width: `${weekColumnWidth}px`,
                  minWidth: `${weekColumnWidth}px`,
                  maxWidth: `${weekColumnWidth}px`,
                  textAlign: 'left',
                  fontSize: 'var(--pf-t--global--font--size--sm)',
                  fontWeight: 'var(--pf-t--global--font--weight--bold)',
                }}
              >
                {t('adminUsage.heatmap.weekLabel', 'Week')}
              </Th>
              {dayAbbreviations.map((day) => (
                <Th
                  key={day}
                  style={{
                    minWidth: `${dayColumnWidth}px`,
                    maxWidth: `${dayColumnWidth}px`,
                    textAlign: 'center',
                    fontSize: 'var(--pf-t--global--font--size--sm)',
                    fontWeight: 'var(--pf-t--global--font--weight--bold)',
                  }}
                >
                  {day}
                </Th>
              ))}
            </Tr>
          </Thead>

          {/* Heatmap rows */}
          <Tbody>
            {data.map((week) => (
              <Tr key={week.weekNumber}>
                {/* Row label (week date range) */}
                <Th
                  scope="row"
                  style={{
                    width: `${weekColumnWidth}px`,
                    minWidth: `${weekColumnWidth}px`,
                    maxWidth: `${weekColumnWidth}px`,
                    fontSize: 'var(--pf-t--global--font--size--sm)',
                    color: 'var(--pf-t--global--text--color--subtle)',
                    fontWeight: 'normal',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {week.weekLabel}
                </Th>

                {/* Day cells */}
                {week.days.map((day) => (
                  <Td
                    key={day.date}
                    style={getCellStyle(day.value, day.isInRange, dayColumnWidth)}
                    aria-label={t('adminUsage.heatmap.accessibility.cellLabel', {
                      dayName: day.dayName,
                      date: day.date,
                      value: day.formattedValue,
                      percent: day.percentOfWeek.toFixed(1),
                    })}
                  >
                    <Tooltip
                      content={getTooltipContent(
                        day.dayName,
                        day.date,
                        day.formattedValue,
                        day.percentOfWeek,
                        day.isInRange,
                        day.value,
                      )}
                      position="top"
                    >
                      <span
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                          backgroundColor: 'transparent',
                        }}
                        tabIndex={0}
                      >
                        {/* Empty span for tooltip trigger */}
                      </span>
                    </Tooltip>
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>

        <HeatmapLegend colorScale={colorScale} metricType={metricType} />
      </div>
    </AccessibleChart>
  );
};

export default UsageHeatmap;

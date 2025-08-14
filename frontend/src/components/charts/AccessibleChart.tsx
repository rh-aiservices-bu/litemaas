import React, { useState, useId, useRef, useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { Caption, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { DownloadIcon, TableIcon, ChartLineIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

export interface AccessibleChartData {
  label: string;
  value: number | string;
  additionalInfo?: { [key: string]: string | number };
  color?: string;
}

export interface AccessibleChartProps {
  /** Chart component to render */
  children: React.ReactNode;
  /** Data for the table alternative */
  data: AccessibleChartData[];
  /** Chart title for accessibility */
  title: string;
  /** Brief description of what the chart shows */
  description: string;
  /** Detailed summary of the chart data */
  summary?: string;
  /** Chart type for better accessibility descriptions */
  chartType: 'line' | 'bar' | 'pie' | 'donut' | 'area';
  /** Whether to show the view toggle (chart/table) */
  showViewToggle?: boolean;
  /** Whether to allow data export */
  allowExport?: boolean;
  /** Export filename (without extension) */
  exportFilename?: string;
  /** Additional table headers for complex data */
  additionalHeaders?: string[];
  /** Custom data formatting function */
  formatValue?: (value: number | string, type?: string) => string;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string;
  /** Custom aria-describedby for additional context */
  ariaDescribedBy?: string;
}

const AccessibleChart: React.FC<AccessibleChartProps> = ({
  children,
  data = [],
  title,
  description,
  summary,
  chartType,
  showViewToggle = true,
  allowExport = true,
  exportFilename = 'chart-data',
  additionalHeaders = [],
  formatValue = (value) => value.toString(),
  error,
  ariaDescribedBy,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const chartId = useId();
  const descriptionId = useId();
  const summaryId = useId();
  const tableId = useId();
  const chartRef = useRef<HTMLDivElement>(null);

  // Generate comprehensive description for screen readers
  const getChartDescription = () => {
    if (!data.length) return t('ui.accessibility.noDataAvailable');

    const totalItems = data.length;
    const hasNumericData = data.some((item) => typeof item.value === 'number');

    let autoSummary = '';
    if (hasNumericData && chartType === 'line') {
      const numericData = data.filter((item) => typeof item.value === 'number') as Array<{
        label: string;
        value: number;
      }>;
      const values = numericData.map((item) => item.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

      autoSummary = t('ui.accessibility.lineChartSummary', {
        totalPoints: totalItems,
        minValue: formatValue(min),
        maxValue: formatValue(max),
        avgValue: formatValue(Math.round(avg)),
      });
    } else if (hasNumericData && (chartType === 'pie' || chartType === 'donut')) {
      const numericData = data.filter((item) => typeof item.value === 'number') as Array<{
        label: string;
        value: number;
      }>;
      const total = numericData.reduce((sum, item) => sum + item.value, 0);
      const topItem = numericData.reduce(
        (max, item) => (item.value > max.value ? item : max),
        numericData[0],
      );
      const percentage = ((topItem.value / total) * 100).toFixed(1);

      autoSummary = t('ui.accessibility.pieChartSummary', {
        totalCategories: totalItems,
        topCategory: topItem.label,
        topPercentage: percentage,
      });
    }

    return [description, summary, autoSummary].filter(Boolean).join('. ');
  };

  // Handle keyboard navigation for chart interaction
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!chartRef.current?.contains(event.target as Node)) return;

      // Toggle view with 't' key
      if (event.key === 't' || event.key === 'T') {
        event.preventDefault();
        setViewMode((current) => (current === 'chart' ? 'table' : 'chart'));

        // Announce the change
        const announcement =
          viewMode === 'chart'
            ? t('ui.accessibility.switchedToTable')
            : t('ui.accessibility.switchedToChart');

        // Create live region announcement
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.position = 'absolute';
        liveRegion.style.left = '-10000px';
        liveRegion.textContent = announcement;
        document.body.appendChild(liveRegion);

        setTimeout(() => document.body.removeChild(liveRegion), 1000);
      }

      // Export data with 'e' key
      if ((event.key === 'e' || event.key === 'E') && allowExport) {
        event.preventDefault();
        exportData();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [viewMode, allowExport, t]);

  // Export data as CSV
  const exportData = () => {
    if (!data.length) return;

    const headers = ['Label', 'Value', ...additionalHeaders];
    const csvContent = [
      headers.join(','),
      ...data.map((item) => {
        const row = [item.label, formatValue(item.value)];

        // Add additional info if present
        if (item.additionalInfo && additionalHeaders.length > 0) {
          additionalHeaders.forEach((header) => {
            const key = header.toLowerCase().replace(/\s+/g, '');
            row.push(item.additionalInfo?.[key]?.toString() || '');
          });
        }

        return row.map((cell) => `"${cell}"`).join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${exportFilename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    // Announce export completion
    const announcement = t('ui.accessibility.dataExported', {
      filename: `${exportFilename}.csv`,
    });
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.textContent = announcement;
    document.body.appendChild(liveRegion);
    setTimeout(() => document.body.removeChild(liveRegion), 1000);
  };

  if (error) {
    return (
      <Card>
        <CardBody>
          <div role="alert" aria-live="polite">
            <Content component={ContentVariants.h4}>{t('common.error')}</Content>
            <p>{error}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div ref={chartRef}>
      {/* Chart Controls */}
      <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} className="pf-v6-u-mb-md">
        <FlexItem>
          {description && (
            <Content component={ContentVariants.small} className="pf-v6-u-color-200">
              {description}
            </Content>
          )}
        </FlexItem>

        <FlexItem>
          <Flex spaceItems={{ default: 'spaceItemsSm' }}>
            {showViewToggle && (
              <FlexItem>
                <ToggleGroup aria-label={t('ui.accessibility.viewModeToggle')}>
                  <ToggleGroupItem
                    icon={<ChartLineIcon />}
                    text={t('common.chart')}
                    isSelected={viewMode === 'chart'}
                    onChange={() => setViewMode('chart')}
                    aria-label={t('ui.accessibility.showChartView')}
                  />
                  <ToggleGroupItem
                    icon={<TableIcon />}
                    text={t('common.table')}
                    isSelected={viewMode === 'table'}
                    onChange={() => setViewMode('table')}
                    aria-label={t('ui.accessibility.showTableView')}
                  />
                </ToggleGroup>
              </FlexItem>
            )}

            {allowExport && (
              <FlexItem>
                <Button
                  variant="secondary"
                  icon={<DownloadIcon />}
                  onClick={exportData}
                  isDisabled={!data.length}
                  aria-label={t('ui.accessibility.exportChartData')}
                >
                  {t('common.export')}
                </Button>
              </FlexItem>
            )}
          </Flex>
        </FlexItem>
      </Flex>

      {/* Hidden descriptions for screen readers */}
      <span className="pf-v6-screen-reader">
        <div id={descriptionId}>{getChartDescription()}</div>
        {summary && <div id={summaryId}>{summary}</div>}
        <div>{t('ui.accessibility.chartKeyboardInstructions')}</div>
      </span>

      {viewMode === 'chart' ? (
        <div
          role="img"
          aria-labelledby={chartId}
          aria-describedby={`${descriptionId} ${summaryId} ${ariaDescribedBy || ''}`.trim()}
          tabIndex={0}
          onFocus={() => {
            // Announce chart focus for screen readers
            const announcement = t('ui.accessibility.chartFocused', {
              title,
              dataPoints: data.length,
            });

            // Create live region announcement
            const liveRegion = document.createElement('div');
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.style.position = 'absolute';
            liveRegion.style.left = '-10000px';
            liveRegion.textContent = announcement;
            document.body.appendChild(liveRegion);

            setTimeout(() => document.body.removeChild(liveRegion), 1000);
          }}
          onKeyDown={(event) => {
            // Allow keyboard users to interact with chart
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              // Focus on the first interactive element or toggle button
              const toggleButton = document.querySelector(
                '[aria-label*="Show chart view"]',
              ) as HTMLElement;
              if (toggleButton) {
                toggleButton.focus();
              }
            }
          }}
        >
          <span className="pf-v6-screen-reader">
            <h4 id={chartId}>{title}</h4>
          </span>
          {children}
        </div>
      ) : (
        <div>
          <Content component={ContentVariants.h4} className="pf-v6-u-mb-sm">
            {t('ui.accessibility.dataTableAlternative')}
          </Content>
          <Table
            aria-labelledby={tableId}
            aria-describedby={`${descriptionId} ${summaryId}`.trim()}
            variant="compact"
            role="table"
          >
            <Caption className="pf-v6-screen-reader">
              {t('ui.accessibility.tableCaption', { title })}.
              {t('ui.accessibility.tableNavigationInstructions')}
            </Caption>
            <Thead>
              <Tr>
                <Th>{t('common.label')}</Th>
                <Th>{t('common.value')}</Th>
                {additionalHeaders.map((header, index) => (
                  <Th key={index}>{header}</Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {data.map((item, index) => (
                <Tr key={index}>
                  <Td>{item.label}</Td>
                  <Td>{formatValue(item.value)}</Td>
                  {additionalHeaders.map((header, headerIndex) => {
                    const key = header.toLowerCase().replace(/\s+/g, '');
                    const value = item.additionalInfo?.[key];
                    return (
                      <Td key={headerIndex}>
                        {value ? formatValue(value) : t('common.notAvailable')}
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      {/* Summary statistics for screen readers */}
      {data.length > 0 && (
        <span className="pf-v6-screen-reader">
          <div aria-live="polite" aria-atomic="true">
            {t('ui.accessibility.chartContainsDataPoints', { count: data.length })}
          </div>
        </span>
      )}
    </div>
  );
};

export default AccessibleChart;

import React from 'react';
import { ChartDonut, ChartThemeColor, getCustomTheme } from '@patternfly/react-charts/victory';
import { useTranslation } from 'react-i18next';
import { DonutChartDataPoint, ModelBreakdownData } from '../../utils/chartDataTransformers';
import AccessibleChart, { AccessibleChartData } from './AccessibleChart';

export interface ModelDistributionChartProps {
  data: DonutChartDataPoint[];
  modelBreakdown: ModelBreakdownData[];
  size?: number;
  width?: number | 'auto';
  showLegend?: boolean;
  showBreakdown?: boolean;
  ariaLabel?: string;
}

const ModelDistributionChart: React.FC<ModelDistributionChartProps> = ({
  data = [],
  modelBreakdown = [],
  size = 300,
  width = 'auto',
  showLegend = true,
  showBreakdown = true,
  ariaLabel = 'Model usage distribution',
}) => {
  const { t } = useTranslation();
  const [containerWidth, setContainerWidth] = React.useState(600);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  // Measure container width for responsive chart sizing using ref callback
  // This pattern ensures ResizeObserver reconnects when element remounts (e.g., after view toggle)
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

  // Empty state
  if (!data || data.length === 0) {
    return (
      <AccessibleChart
        data={[]}
        labelHeader={t('pages.usage.tableHeaders.model')}
        title={ariaLabel || t('pages.usage.charts.modelUsageDistribution')}
        description={t('pages.usage.charts.noDataDescription')}
        chartType="donut"
        allowExport={false}
        showViewToggle={false}
      >
        <div
          style={{
            padding: '20px',
            minHeight: `${size}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed #d2d2d2',
            borderRadius: '4px',
            backgroundColor: '#f5f5f5',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: 'var(--pf-t--global--font--size--sm)',
                color: 'var(--pf-t--global--text--color--subtle)',
                marginBottom: '8px',
              }}
            >
              {t('pages.usage.charts.noDataTitle')}
            </p>
            <p
              style={{
                fontSize: 'var(--pf-t--global--font--size--xs)',
                color: 'var(--pf-t--global--text--color--subtle)',
                margin: 0,
              }}
            >
              {t('pages.usage.charts.noDataDescription')}
            </p>
          </div>
        </div>
      </AccessibleChart>
    );
  }

  // Calculate total requests
  const totalRequests = data.reduce((sum, item) => sum + item.y, 0);

  // Get color scale from multiOrdered theme for consistent color assignment
  const theme = getCustomTheme(ChartThemeColor.multiOrdered, {});
  const colorScale = theme.pie?.colorScale || [];

  // Calculate chart width
  const chartWidth = width === 'auto' ? containerWidth : width;
  const chartHeight = size;

  // Transform data for accessibility with raw values for export
  const accessibleData: AccessibleChartData[] = data.map((item) => {
    const model = modelBreakdown.find((m) => m.name === item.x);

    return {
      label: item.x,
      value: item.y, // Raw value (requests count) for proper sorting and export
      additionalInfo: {
        // Raw values for CSV export
        requests: item.y,
        percentage: item.percentage,
        tokens: model?.tokens || 0,
        prompttokens: model?.prompt_tokens || 0,
        completiontokens: model?.completion_tokens || 0,
        cost: model?.cost || 0,
        // Formatted values for display
        requestsFormatted: item.y.toLocaleString(),
        percentageFormatted: item.percentage.toFixed(1) + '%',
        tokensFormatted: model?.tokens
          ? model.tokens >= 1000000
            ? `${(model.tokens / 1000000).toFixed(1)}M`
            : model.tokens >= 1000
              ? `${(model.tokens / 1000).toFixed(1)}K`
              : model.tokens.toString()
          : '0',
        prompttokensFormatted: model?.prompt_tokens
          ? model.prompt_tokens >= 1000000
            ? `${(model.prompt_tokens / 1000000).toFixed(1)}M`
            : model.prompt_tokens >= 1000
              ? `${(model.prompt_tokens / 1000).toFixed(1)}K`
              : model.prompt_tokens.toString()
          : '0',
        completiontokensFormatted: model?.completion_tokens
          ? model.completion_tokens >= 1000000
            ? `${(model.completion_tokens / 1000000).toFixed(1)}M`
            : model.completion_tokens >= 1000
              ? `${(model.completion_tokens / 1000).toFixed(1)}K`
              : model.completion_tokens.toString()
          : '0',
        costFormatted: model?.cost ? `$${model.cost.toFixed(2)}` : '$0.00',
      },
    };
  });

  // Alias for consistency (no longer need separate enrichment step)
  const enrichedData = accessibleData;

  // Generate chart description and summary
  const chartDescription = t('pages.usage.charts.donutChartDescription');
  const topModel = data.reduce(
    (max, item) => (item.percentage > max.percentage ? item : max),
    data[0],
  );
  const chartSummary = t('pages.usage.charts.modelDistributionSummary', {
    totalModels: data.length,
    topModel: topModel.x,
    topPercentage: topModel.percentage.toFixed(1),
    totalRequests: totalRequests.toLocaleString(),
  });

  return (
    <AccessibleChart
      data={enrichedData}
      title={ariaLabel || t('pages.usage.charts.modelUsageDistribution')}
      description={chartDescription}
      summary={chartSummary}
      chartType="donut"
      exportFilename="model-distribution"
      labelHeader={t('pages.usage.tableHeaders.model')}
      additionalHeaders={[
        t('pages.usage.tableHeaders.requests'),
        t('pages.usage.tableHeaders.tokens'),
        t('pages.usage.tableHeaders.promptTokens'),
        t('pages.usage.tableHeaders.completionTokens'),
        t('pages.usage.tableHeaders.cost'),
      ]}
      formatValue={(value) => value.toString()}
    >
      <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Donut Chart */}
        <div style={{ height: `${chartHeight}px`, width: `${chartWidth}px` }}>
          <ChartDonut
            ariaDesc={chartDescription}
            ariaTitle={ariaLabel || t('pages.usage.charts.modelUsageDistribution')}
            constrainToVisibleArea
            data={data}
            labels={({ datum }) => `${datum.x}: ${datum.percentage.toFixed(1)}%`}
            name="modelDistribution"
            padding={{
              bottom: 10,
              left: 10,
              right: 10,
              top: 10,
            }}
            subTitle={t('pages.usage.metrics.totalRequests')}
            title={totalRequests.toString()}
            themeColor={ChartThemeColor.multiOrdered}
            width={chartWidth}
            height={chartHeight}
          />
        </div>

        {/* Custom Legend - Horizontal layout with wrapping */}
        {showLegend && data.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              marginTop: '1rem',
              width: '100%',
            }}
          >
            {data.map((item, index) => (
              <div
                key={item.x}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: colorScale[index % colorScale.length],
                    borderRadius: '2px',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <span
                  style={{
                    fontSize: 'var(--pf-t--global--font--size--sm)',
                    color: 'var(--pf-t--global--text--color--regular)',
                  }}
                >
                  {item.x}: {item.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Model Breakdown Table - Now handled by AccessibleChart in table view */}
        {showBreakdown && modelBreakdown.length > 0 && (
          <div style={{ flex: 1, minWidth: '300px' }}>
            <table
              style={{ width: '100%', borderCollapse: 'collapse' }}
              role="table"
              aria-label={t('pages.usage.charts.modelBreakdownTable')}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <th
                    style={{
                      padding: '8px',
                      textAlign: 'left',
                      fontSize: 'var(--pf-t--global--font--size--xs)',
                    }}
                    scope="col"
                  >
                    {t('pages.usage.tableHeaders.model')}
                  </th>
                  <th
                    style={{
                      padding: '8px',
                      textAlign: 'right',
                      fontSize: 'var(--pf-t--global--font--size--xs)',
                    }}
                    scope="col"
                  >
                    {t('pages.usage.tableHeaders.requests')}
                  </th>
                  <th
                    style={{
                      padding: '8px',
                      textAlign: 'right',
                      fontSize: 'var(--pf-t--global--font--size--xs)',
                    }}
                    scope="col"
                  >
                    {t('pages.usage.tableHeaders.tokens')}
                  </th>
                  <th
                    style={{
                      padding: '8px',
                      textAlign: 'right',
                      fontSize: 'var(--pf-t--global--font--size--xs)',
                    }}
                    scope="col"
                  >
                    {t('pages.usage.tableHeaders.cost')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {modelBreakdown.map((model, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th
                      scope="row"
                      style={{
                        padding: '8px',
                        fontSize: 'var(--pf-t--global--font--size--xs)',
                        fontWeight: 'normal',
                      }}
                    >
                      {model.name}
                    </th>
                    <td
                      style={{
                        padding: '8px',
                        textAlign: 'right',
                        fontSize: 'var(--pf-t--global--font--size--xs)',
                      }}
                    >
                      {model.requests.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        textAlign: 'right',
                        fontSize: 'var(--pf-t--global--font--size--xs)',
                      }}
                    >
                      {model.tokens >= 1000000
                        ? `${(model.tokens / 1000000).toFixed(1)}M`
                        : model.tokens >= 1000
                          ? `${(model.tokens / 1000).toFixed(1)}K`
                          : model.tokens.toString()}
                    </td>
                    <td
                      style={{
                        padding: '8px',
                        textAlign: 'right',
                        fontSize: 'var(--pf-t--global--font--size--xs)',
                      }}
                    >
                      ${model.cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AccessibleChart>
  );
};

export default ModelDistributionChart;

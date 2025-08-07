import React from 'react';
import { ChartDonut, ChartThemeColor } from '@patternfly/react-charts/victory';
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

  // Empty state
  if (!data || data.length === 0) {
    return (
      <AccessibleChart
        data={[]}
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
            <p style={{ fontSize: '14px', color: '#6a6e73', marginBottom: '8px' }}>
              {t('pages.usage.charts.noDataTitle')}
            </p>
            <p style={{ fontSize: '12px', color: '#8b8d8f', margin: 0 }}>
              {t('pages.usage.charts.noDataDescription')}
            </p>
          </div>
        </div>
      </AccessibleChart>
    );
  }

  // Calculate total requests
  const totalRequests = data.reduce((sum, item) => sum + item.y, 0);

  // Prepare legend data
  const legendData = data.map((item) => ({
    name: `${item.x}: ${item.percentage.toFixed(1)}%`,
  }));

  // Calculate chart width
  const chartWidth = width === 'auto' ? 450 : width;
  const chartHeight = size;

  // Transform data for accessibility
  const accessibleData: AccessibleChartData[] = data.map((item) => ({
    label: item.x,
    value: item.percentage.toFixed(1) + '%',
    additionalInfo: {
      requests: item.y.toString(),
      percentage: item.percentage.toFixed(1) + '%',
      rawValue: item.y.toString(),
    },
  }));

  // Find corresponding model breakdown data for additional info
  const enrichedData: AccessibleChartData[] = accessibleData.map((item) => {
    const model = modelBreakdown.find((m) => m.name === item.label);
    if (model) {
      return {
        ...item,
        additionalInfo: {
          ...item.additionalInfo,
          tokens:
            model.tokens >= 1000000
              ? `${(model.tokens / 1000000).toFixed(1)}M`
              : model.tokens >= 1000
                ? `${(model.tokens / 1000).toFixed(1)}K`
                : model.tokens.toString(),
          cost: `$${model.cost.toFixed(2)}`,
        },
      };
    }
    return item;
  });

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
      additionalHeaders={[
        t('pages.usage.tableHeaders.requests'),
        t('pages.usage.tableHeaders.tokens'),
        t('pages.usage.tableHeaders.cost'),
      ]}
      formatValue={(value) => value.toString()}
    >
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Donut Chart */}
        <div style={{ height: `${chartHeight}px`, width: `${chartWidth}px` }}>
          <ChartDonut
            ariaDesc={chartDescription}
            ariaTitle={ariaLabel || t('pages.usage.charts.modelUsageDistribution')}
            constrainToVisibleArea
            data={data}
            labels={({ datum }) => `${datum.x}: ${datum.percentage.toFixed(1)}%`}
            legendData={showLegend ? legendData : undefined}
            legendOrientation="vertical"
            legendPosition="right"
            name="modelDistribution"
            padding={{
              bottom: 20,
              left: 20,
              right: showLegend ? 180 : 20,
              top: 20,
            }}
            subTitle={t('pages.usage.metrics.totalRequests')}
            title={totalRequests.toString()}
            themeColor={ChartThemeColor.multiOrdered}
            width={chartWidth}
            height={chartHeight}
            animate={{
              duration: 1000,
              onLoad: { duration: 500 },
            }}
          />
        </div>

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
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px' }} scope="col">
                    {t('pages.usage.tableHeaders.model')}
                  </th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px' }} scope="col">
                    {t('pages.usage.tableHeaders.requests')}
                  </th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px' }} scope="col">
                    {t('pages.usage.tableHeaders.tokens')}
                  </th>
                  <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px' }} scope="col">
                    {t('pages.usage.tableHeaders.cost')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {modelBreakdown.map((model, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th
                      scope="row"
                      style={{ padding: '8px', fontSize: '11px', fontWeight: 'normal' }}
                    >
                      {model.name}
                    </th>
                    <td style={{ padding: '8px', textAlign: 'right', fontSize: '11px' }}>
                      {model.requests.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontSize: '11px' }}>
                      {model.tokens >= 1000000
                        ? `${(model.tokens / 1000000).toFixed(1)}M`
                        : model.tokens >= 1000
                          ? `${(model.tokens / 1000).toFixed(1)}K`
                          : model.tokens.toString()}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontSize: '11px' }}>
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

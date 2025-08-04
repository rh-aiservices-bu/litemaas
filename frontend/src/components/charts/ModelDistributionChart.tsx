import React from 'react';
import { ChartDonut, ChartThemeColor } from '@patternfly/react-charts/victory';
import { Skeleton } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { DonutChartDataPoint, ModelBreakdownData } from '../../utils/chartDataTransformers';

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
      <div style={{ 
        padding: '20px', 
        minHeight: `${size}px`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px dashed #d2d2d2',
        borderRadius: '4px',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#6a6e73', marginBottom: '8px' }}>
            {t('pages.usage.charts.noDataTitle')}
          </p>
          <p style={{ fontSize: '12px', color: '#8b8d8f', margin: 0 }}>
            {t('pages.usage.charts.noDataDescription')}
          </p>
        </div>
      </div>
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

  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Donut Chart */}
      <div style={{ height: `${chartHeight}px`, width: `${chartWidth}px` }}>
        <ChartDonut
          ariaDesc={ariaLabel}
          ariaTitle="Model distribution chart"
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
        />
      </div>

      {/* Model Breakdown Table */}
      {showBreakdown && modelBreakdown.length > 0 && (
        <div style={{ flex: 1, minWidth: '300px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px' }}>{t('pages.usage.tableHeaders.model')}</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px' }}>{t('pages.usage.tableHeaders.requests')}</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px' }}>{t('pages.usage.tableHeaders.tokens')}</th>
                <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px' }}>{t('pages.usage.tableHeaders.cost')}</th>
              </tr>
            </thead>
            <tbody>
              {modelBreakdown.map((model, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px', fontSize: '11px' }}>{model.name}</td>
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
  );
};

export default ModelDistributionChart;

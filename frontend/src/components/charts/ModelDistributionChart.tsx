import React from 'react';
import {
  Chart,
  ChartDonut,
  ChartThemeColor,
  ChartTooltip,
} from '@patternfly/react-charts/victory';
import {
  Skeleton,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Title,
  Bullseye,
  Content,
  ContentVariants,
  Grid,
  GridItem,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { CubeIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

import { DonutChartDataPoint, ModelBreakdownData } from '../../utils/chartDataTransformers';
import { sanitizeChartDataArray, sanitizeModelName } from '../../utils/security.utils';
import { ComponentErrorBoundary } from '../ComponentErrorBoundary';

export interface ModelDistributionChartProps {
  /** Chart data points array */
  data: DonutChartDataPoint[];
  /** Optional detailed model breakdown data */
  modelBreakdown?: ModelBreakdownData[];
  /** Loading state indicator */
  loading?: boolean;
  /** Chart size (diameter) in pixels */
  size?: number;
  /** Chart width in pixels or 'auto' for responsive */
  width?: number | 'auto';
  /** Optional title for the chart */
  title?: string;
  /** Whether to show the interactive legend */
  showLegend?: boolean;
  /** Custom color theme */
  themeColor?: typeof ChartThemeColor[keyof typeof ChartThemeColor];
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** Whether to show detailed breakdown table */
  showBreakdown?: boolean;
}

/**
 * ModelDistributionChart - Interactive donut chart for model usage distribution
 * Built with PatternFly React Charts (Victory-based)
 * Shows percentage breakdown of model usage with interactive legend
 */
const ModelDistributionChart: React.FC<ModelDistributionChartProps> = ({
  data = [],
  modelBreakdown = [],
  loading = false,
  size = 300,
  width = 'auto',
  title,
  showLegend = true,
  themeColor = ChartThemeColor.blue,
  ariaLabel,
  showBreakdown = false,
}) => {
  const { t } = useTranslation();

  // Default colors for different models (PatternFly color palette)
  const defaultColors = [
    'var(--pf-v6-global--primary--color--100)',
    'var(--pf-v6-global--success--color--100)',
    'var(--pf-v6-global--warning--color--100)',
    'var(--pf-v6-global--danger--color--100)',
    'var(--pf-v6-global--info--color--100)',
    'var(--pf-v6-global--palette--purple--300)',
    'var(--pf-v6-global--palette--cyan--300)',
    'var(--pf-v6-global--palette--orange--300)',
  ];

  // Get default aria label
  const getAriaLabel = (): string => {
    return ariaLabel || t('pages.usage.charts.modelDistributionAriaLabel');
  };

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ width: width === 'auto' ? '100%' : width }}>
        {title && <Skeleton height="20px" width="60%" style={{ marginBottom: '16px' }} />}
        <Grid hasGutter>
          <GridItem span={showLegend ? 8 : 12}>
            <Skeleton height={`${size}px`} width={`${size}px`} style={{ borderRadius: '50%' }} />
          </GridItem>
          {showLegend && (
            <GridItem span={4}>
              <Skeleton height="16px" width="80%" style={{ marginBottom: '8px' }} />
              <Skeleton height="16px" width="70%" style={{ marginBottom: '8px' }} />
              <Skeleton height="16px" width="90%" style={{ marginBottom: '8px' }} />
              <Skeleton height="16px" width="60%" />
            </GridItem>
          )}
        </Grid>
      </div>
    );
  }

  // Sanitize and validate data
  const validatedData = sanitizeChartDataArray(data);

  // Empty state when no data
  if (validatedData.length === 0) {
    return (
      <div style={{ width: width === 'auto' ? '100%' : width, minHeight: size }}>
        <Bullseye>
          <EmptyState variant={EmptyStateVariant.sm}>
            <CubeIcon />
            <Title headingLevel="h4" size="md">
              {t('pages.usage.charts.noModelsTitle')}
            </Title>
            <EmptyStateBody>
              <Content component={ContentVariants.small}>
                {t('pages.usage.charts.noModelsDescription')}
              </Content>
            </EmptyStateBody>
          </EmptyState>
        </Bullseye>
      </div>
    );
  }

  // Prepare legend data
  const legendData = data.map((item, index) => ({
    name: `${sanitizeModelName(item.x as string)}: ${item.percentage?.toFixed(1) || '0.0'}%`,
    symbol: {
      fill: defaultColors[index % defaultColors.length],
      type: 'square' as const,
    },
  }));


  return (
    <ComponentErrorBoundary>
      <div style={{ width: width === 'auto' ? '100%' : width }}>
        {title && (
          <Title headingLevel="h4" size="md" style={{ marginBottom: '16px' }}>
            {title}
          </Title>
        )}

        <Grid hasGutter>
          <GridItem span={showLegend ? 8 : 12}>
            <Chart
              ariaTitle={getAriaLabel()}
              height={size}
              width={size}
              themeColor={themeColor}
              padding={{ left: 20, top: 20, right: 20, bottom: 20 }}
            >
              <ChartDonut
                data={validatedData}
                innerRadius={size * 0.25}
                padAngle={2}
                colorScale={defaultColors}
                labelComponent={<ChartTooltip renderInPortal={false} />}
                animate={{
                  duration: 1000,
                  onLoad: { duration: 500 },
                }}
              />
            </Chart>
          </GridItem>

          {showLegend && legendData.length > 0 && (
            <GridItem span={4}>
              <Flex direction={{ default: 'column' }} style={{ marginTop: '20px' }}>
                <FlexItem>
                  <Title headingLevel="h5" size="md" style={{ marginBottom: '12px' }}>
                    {t('pages.usage.charts.modelBreakdown')}
                  </Title>
                </FlexItem>
                {legendData.map((item, index) => (
                  <FlexItem key={index} style={{ marginBottom: '8px' }}>
                    <Flex alignItems={{ default: 'alignItemsCenter' }}>
                      <FlexItem style={{ marginRight: '8px' }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            backgroundColor: defaultColors[index % defaultColors.length],
                            borderRadius: '2px',
                          }}
                        />
                      </FlexItem>
                      <FlexItem>
                        <Content component={ContentVariants.small}>{item.name}</Content>
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                ))}
              </Flex>
            </GridItem>
          )}
        </Grid>

        {/* Optional detailed breakdown table */}
        {showBreakdown && modelBreakdown.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <Title headingLevel="h5" size="md" style={{ marginBottom: '12px' }}>
              {t('pages.usage.charts.detailedBreakdown')}
            </Title>
            <div
              style={{
                border: '1px solid var(--pf-v6-global--BorderColor--100)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--pf-v6-global--BackgroundColor--200)',
                  padding: '12px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  borderBottom: '1px solid var(--pf-v6-global--BorderColor--100)',
                }}
              >
                <Grid hasGutter>
                  <GridItem span={4}>{t('pages.usage.tableHeaders.model')}</GridItem>
                  <GridItem span={2}>{t('pages.usage.tableHeaders.requests')}</GridItem>
                  <GridItem span={2}>{t('pages.usage.tableHeaders.tokens')}</GridItem>
                  <GridItem span={2}>{t('pages.usage.tableHeaders.cost')}</GridItem>
                  <GridItem span={2}>{t('pages.usage.tableHeaders.percentage')}</GridItem>
                </Grid>
              </div>
              {modelBreakdown.map((model, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    borderBottom:
                      index < modelBreakdown.length - 1
                        ? '1px solid var(--pf-v6-global--BorderColor--100)'
                        : 'none',
                    backgroundColor:
                      index % 2 === 0 ? 'var(--pf-v6-global--BackgroundColor--100)' : 'transparent',
                  }}
                >
                  <Grid hasGutter>
                    <GridItem span={4}>
                      <Flex alignItems={{ default: 'alignItemsCenter' }}>
                        <FlexItem style={{ marginRight: '8px' }}>
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              backgroundColor: defaultColors[index % defaultColors.length],
                              borderRadius: '50%',
                            }}
                          />
                        </FlexItem>
                        <FlexItem>
                          <strong>{sanitizeModelName(model.name)}</strong>
                        </FlexItem>
                      </Flex>
                    </GridItem>
                    <GridItem span={2}>{model.requests.toLocaleString()}</GridItem>
                    <GridItem span={2}>{model.tokens.toLocaleString()}</GridItem>
                    <GridItem span={2}>${model.cost.toFixed(2)}</GridItem>
                    <GridItem span={2}>
                      <strong>{model.percentage.toFixed(1)}%</strong>
                    </GridItem>
                  </Grid>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ComponentErrorBoundary>
  );
};

export default ModelDistributionChart;

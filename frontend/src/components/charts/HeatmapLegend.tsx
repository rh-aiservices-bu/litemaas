/**
 * HeatmapLegend component - Color scale and special cases legend for heatmap
 * Displays discrete color blocks with value ranges and special state indicators
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, FlexItem } from '@patternfly/react-core';
import { LogarithmicColorScale } from '../../utils/chartColorScale';

type MetricType = 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens';

interface HeatmapLegendProps {
  colorScale: LogarithmicColorScale;
  metricType: MetricType;
  compact?: boolean; // For modal vs. card view
}

const HeatmapLegend: React.FC<HeatmapLegendProps> = ({
  colorScale,
  metricType,
  compact = false,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="pf-v6-u-mt-md"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pf-t--global--spacer--sm)',
      }}
    >
      {/* Color Scale Legend */}
      <div>
        <div
          style={{
            fontSize: compact
              ? 'var(--pf-t--global--font--size--xs)'
              : 'var(--pf-t--global--font--size--sm)',
            fontWeight: 'var(--pf-t--global--font--weight--bold)',
            marginBottom: 'var(--pf-t--global--spacer--xs)',
            color: 'var(--pf-t--global--text--color--regular)',
          }}
        >
          {t('adminUsage.heatmap.legend.colorScale')}
        </div>
        <Flex
          spaceItems={{ default: 'spaceItemsSm' }}
          alignItems={{ default: 'alignItemsCenter' }}
          flexWrap={{ default: 'wrap' }}
        >
          {colorScale.ranges.map((range, index) => (
            <FlexItem key={index}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--pf-t--global--spacer--xs)',
                }}
              >
                {/* Color block */}
                <div
                  style={{
                    width: compact ? '40px' : '50px',
                    height: compact ? '16px' : '20px',
                    backgroundColor: range.color,
                    border: '1px solid var(--pf-t--global--border--color--default)',
                    borderRadius: 'var(--pf-t--global--border--radius--sm)',
                  }}
                  aria-label={`${range.label} ${metricType}`}
                  role="img"
                />
                {/* Range label */}
                <div
                  style={{
                    fontSize: compact
                      ? 'var(--pf-t--global--font--size--xs)'
                      : 'var(--pf-t--global--font--size--sm)',
                    color: 'var(--pf-t--global--text--color--subtle)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {range.label}
                </div>
              </div>
            </FlexItem>
          ))}
        </Flex>
      </div>

      {/* Special Cases Legend */}
      <div>
        <Flex
          spaceItems={{ default: 'spaceItemsSm' }}
          alignItems={{ default: 'alignItemsCenter' }}
          flexWrap={{ default: 'wrap' }}
        >
          {/* Zero usage indicator */}
          <FlexItem>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--pf-t--global--spacer--xs)',
              }}
            >
              <div
                style={{
                  width: compact ? '20px' : '24px',
                  height: compact ? '16px' : '20px',
                  backgroundColor: 'var(--pf-t--global--background--color--100)',
                  border: '1px solid var(--pf-t--global--border--color--default)',
                  borderRadius: 'var(--pf-t--global--border--radius--sm)',
                }}
                aria-label={t('adminUsage.heatmap.legend.zeroUsageAriaLabel')}
                role="img"
              />
              <span
                style={{
                  fontSize: compact
                    ? 'var(--pf-t--global--font--size--xs)'
                    : 'var(--pf-t--global--font--size--sm)',
                  color: 'var(--pf-t--global--text--color--subtle)',
                }}
              >
                {t('adminUsage.heatmap.legend.zeroUsage')}
              </span>
            </div>
          </FlexItem>

          {/* No data indicator */}
          <FlexItem>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--pf-t--global--spacer--xs)',
              }}
            >
              <div
                style={{
                  width: compact ? '20px' : '24px',
                  height: compact ? '16px' : '20px',
                  backgroundColor: 'var(--pf-t--global--background--color--200)',
                  backgroundImage: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 5px,
                    var(--pf-t--global--border--color--200) 5px,
                    var(--pf-t--global--border--color--200) 6px
                  )`,
                  border: '1px solid var(--pf-t--global--border--color--default)',
                  borderRadius: 'var(--pf-t--global--border--radius--sm)',
                }}
                aria-label={t('adminUsage.heatmap.legend.noDataAriaLabel')}
                role="img"
              />
              <span
                style={{
                  fontSize: compact
                    ? 'var(--pf-t--global--font--size--xs)'
                    : 'var(--pf-t--global--font--size--sm)',
                  color: 'var(--pf-t--global--text--color--subtle)',
                }}
              >
                {t('adminUsage.heatmap.legend.noData')}
              </span>
            </div>
          </FlexItem>
        </Flex>
      </div>
    </div>
  );
};

export default HeatmapLegend;

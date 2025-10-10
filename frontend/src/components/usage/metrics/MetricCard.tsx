import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  Title,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Skeleton,
} from '@patternfly/react-core';
import { ArrowUpIcon, ArrowDownIcon } from '@patternfly/react-icons';

/**
 * Trend data for metrics over time
 */
export interface TrendData {
  metric: string;
  current: number;
  previous: number;
  percentageChange: number;
  direction: 'up' | 'down' | 'stable';
}

/**
 * Props for the MetricCard component
 */
export interface MetricCardProps {
  /** Card title */
  title: string;
  /** Metric value (formatted) */
  value: string | number;
  /** Icon element */
  icon: React.ReactNode;
  /** Optional subtitle text */
  subtitle?: string;
  /** Optional trend data */
  trend?: TrendData;
  /** Visual variant */
  variant?: 'default' | 'success' | 'warning' | 'danger';
  /** Card size - compact reduces spacing and font sizes */
  size?: 'default' | 'compact';
  /** Loading state */
  loading?: boolean;
  /** Accessibility label */
  ariaLabel?: string;
}

/**
 * MetricCard Component
 *
 * Displays a single metric with icon, value, and optional trend indicator.
 * Used in both admin and user usage pages to show key metrics.
 *
 * @component
 * @example
 * ```tsx
 * <MetricCard
 *   title="Total Requests"
 *   value={formatNumber(1234)}
 *   icon={<CubeIcon />}
 *   trend={{
 *     metric: 'requests',
 *     current: 1234,
 *     previous: 1000,
 *     percentageChange: 23.4,
 *     direction: 'up'
 *   }}
 *   variant="default"
 * />
 * ```
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  trend,
  variant = 'default',
  size = 'default',
  loading = false,
  ariaLabel,
}) => {
  const { t } = useTranslation();
  const isCompact = size === 'compact';

  const getVariantColor = () => {
    switch (variant) {
      case 'success':
        return 'var(--pf-t--global--color--status--success--default)';
      case 'warning':
        return 'var(--pf-t--global--color--status--warning--default)';
      case 'danger':
        return 'var(--pf-t--global--color--status--danger--default)';
      default:
        return 'var(--pf-t--global--color--brand--default)';
    }
  };

  const getTrendColor = (direction: 'up' | 'down' | 'stable') => {
    if (direction === 'stable') return 'var(--pf-t--global--text--color--subtle)';
    return direction === 'up'
      ? 'var(--pf-t--global--color--status--success--default)'
      : 'var(--pf-t--global--color--status--danger--default)';
  };

  if (loading) {
    return (
      <Card isFullHeight>
        <CardBody>
          <Skeleton height="100px" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card isFullHeight role="article" aria-label={ariaLabel || `${title}: ${value}`}>
      <CardBody style={{ padding: isCompact ? '12px 16px' : '16px' }}>
        <Flex
          direction={{ default: 'column' }}
          spaceItems={{ default: isCompact ? 'spaceItemsNone' : 'spaceItemsXs' }}
        >
          <FlexItem>
            <Flex
              justifyContent={{ default: 'justifyContentSpaceBetween' }}
              alignItems={{ default: 'alignItemsCenter' }}
            >
              <FlexItem>
                <Content
                  component={ContentVariants.small}
                  style={{ color: 'var(--pf-t--global--text--color--subtle)', fontWeight: 500 }}
                >
                  {title}
                </Content>
              </FlexItem>
              <FlexItem>
                <div
                  style={{
                    color: getVariantColor(),
                    fontSize: isCompact ? '1.25rem' : '1.5rem',
                  }}
                  aria-hidden="true"
                >
                  {icon}
                </div>
              </FlexItem>
            </Flex>
          </FlexItem>

          <FlexItem style={{ textAlign: 'center' }}>
            <Title headingLevel="h3" size={isCompact ? 'xl' : '2xl'}>
              {value}
            </Title>
          </FlexItem>

          {(subtitle || trend) && (
            <FlexItem>
              <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsXs' }}>
                {subtitle && (
                  <FlexItem>
                    <Content
                      component={ContentVariants.small}
                      style={{
                        color: 'var(--pf-t--global--text--color--subtle)',
                        fontSize: isCompact ? '0.75rem' : undefined,
                      }}
                    >
                      {subtitle}
                    </Content>
                  </FlexItem>
                )}
                {trend && (
                  <FlexItem>
                    <Flex
                      alignItems={{ default: 'alignItemsCenter' }}
                      spaceItems={{ default: 'spaceItemsXs' }}
                    >
                      <FlexItem>
                        <div
                          style={{
                            color: getTrendColor(trend.direction),
                            fontSize: isCompact ? '0.75rem' : '0.875rem',
                          }}
                          aria-label={t('adminUsage.metrics.trendLabel', {
                            direction: trend.direction,
                            change: Math.abs(trend.percentageChange).toFixed(1),
                          })}
                        >
                          {trend.direction === 'up' && <ArrowUpIcon />}
                          {trend.direction === 'down' && <ArrowDownIcon />}
                          {trend.direction !== 'stable' && (
                            <span style={{ marginLeft: '0.25rem' }}>
                              {Math.abs(trend.percentageChange).toFixed(1)}%
                            </span>
                          )}
                          {trend.direction === 'stable' && (
                            <span>{t('adminUsage.metrics.noChange')}</span>
                          )}
                        </div>
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                )}
              </Flex>
            </FlexItem>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
};

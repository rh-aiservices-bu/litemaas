import React from 'react';
import {
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  Tooltip,
  Card,
  CardBody,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

export interface LegendItem {
  name: string;
  color: string;
  pattern?: string;
  description?: string;
  value?: string | number;
}

export interface AccessibleLegendProps {
  items: LegendItem[];
  title?: string;
  orientation?: 'horizontal' | 'vertical';
  showPatternIndicator?: boolean;
  className?: string;
}

const PatternIndicator: React.FC<{
  color: string;
  pattern?: string;
  label: string;
  description?: string;
}> = ({ color, pattern, label, description }) => {
  const { t } = useTranslation();

  const svgElement = (
    <svg
      width="40"
      height="20"
      viewBox="0 0 40 20"
      role="img"
      aria-label={t('ui.accessibility.legendPattern', {
        name: label,
        color: color.replace('#', ''),
        pattern: pattern
          ? t('ui.accessibility.patterns.' + (pattern.includes(',') ? 'dashed' : 'solid'))
          : t('ui.accessibility.patterns.solid'),
      })}
    >
      <line
        x1="0"
        y1="10"
        x2="40"
        y2="10"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={pattern}
        strokeLinecap="round"
      />
      {/* Add small circles at endpoints to make pattern more visible */}
      <circle cx="3" cy="10" r="2" fill={color} />
      <circle cx="37" cy="10" r="2" fill={color} />
    </svg>
  );

  if (description) {
    return <Tooltip content={description}>{svgElement}</Tooltip>;
  }

  return svgElement;
};

const AccessibleLegend: React.FC<AccessibleLegendProps> = ({
  items,
  title,
  orientation = 'horizontal',
  showPatternIndicator = true,
  className,
}) => {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <Card className={`pf-v6-u-p-sm ${className || ''}`} isCompact>
      <CardBody>
        {title && (
          <Content component={ContentVariants.h4} className="pf-v6-u-mb-sm" id="legend-title">
            {title}
          </Content>
        )}

        <Flex
          direction={{
            default: orientation === 'vertical' ? 'column' : 'row',
          }}
          spaceItems={{
            default: orientation === 'vertical' ? 'spaceItemsSm' : 'spaceItemsMd',
          }}
          flexWrap={{ default: 'wrap' }}
          role="list"
          aria-labelledby={title ? 'legend-title' : undefined}
          aria-label={!title ? t('ui.accessibility.chartLegend') : undefined}
        >
          {items.map((item, index) => (
            <FlexItem key={index} role="listitem">
              <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsXs' }}
              >
                {showPatternIndicator && (
                  <FlexItem>
                    <PatternIndicator
                      color={item.color}
                      pattern={item.pattern}
                      label={item.name}
                      description={item.description}
                    />
                  </FlexItem>
                )}

                <FlexItem>
                  <Content component={ContentVariants.small}>
                    <strong>{item.name}</strong>
                    {item.value !== undefined && (
                      <span className="pf-v6-u-ml-xs pf-v6-u-color-200">({item.value})</span>
                    )}
                  </Content>

                  {item.description && (
                    <Content component={ContentVariants.small} className="pf-v6-u-color-200">
                      {item.description}
                    </Content>
                  )}
                </FlexItem>
              </Flex>
            </FlexItem>
          ))}
        </Flex>

        {/* Screen reader summary */}
        <div className="pf-v6-screen-reader">
          {t('ui.accessibility.legendSummary', {
            count: items.length,
            items: items.map((item) => item.name).join(', '),
          })}
        </div>
      </CardBody>
    </Card>
  );
};

export default AccessibleLegend;

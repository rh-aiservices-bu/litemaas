# Phase 6, Session 6C: Advanced Visualizations

**Phase**: 6 - Advanced Features (Optional)
**Session**: 6C
**Duration**: 12-16 hours
**Priority**: 🟢 LOW
**Note**: Optional enhancement for future iterations

---

## Navigation

- **Previous Session**: [Session 6B - Async Export Queue](./phase-6-session-6b-async-export.md)
- **Current Phase**: [Phase 6 - Advanced Features](../admin-analytics-remediation-plan.md#phase-6-advanced-features-optional)
- **Next Session**: [Session 6D - Scheduled Reports](./phase-6-session-6d-scheduled-reports.md)
- **Plan Overview**: [Admin Analytics Remediation Plan](../admin-analytics-remediation-plan.md)

---

## Context

This session is part of Phase 6, which focuses on **optional advanced features** for future enhancement of the Admin Usage Analytics system. Phase 6 is **not required for production deployment** and should only be pursued after Phases 1-5 are complete and stable.

### Phase 6 Summary

Phase 6 addresses advanced features that enhance performance, scalability, and user experience beyond the core requirements:

- **Session 6A**: Redis Caching - High-performance distributed caching
- **Session 6B**: Async Export Queue - Background job processing for large exports
- **Session 6C** (this session): Advanced Visualizations - Enhanced charts and analytics
- **Session 6D**: Scheduled Reports - Automated report generation

**Total Phase 6 Duration**: 40-60 hours

---

## Session Objectives

Enhance the analytics dashboard with advanced visualizations and interactive features:

1. **Add interactive drill-down capabilities** to existing charts
2. **Implement time-series forecasting** for usage trends
3. **Create geographic usage visualization** if user location data available
4. **Add cost optimization recommendations** based on usage patterns
5. **Implement custom dashboard builder** for users to create their own views
6. **Add real-time usage monitoring** dashboard
7. **Create comparative analysis views** (period-over-period, cohort analysis)

**Success Criteria**:

- All charts support drill-down interactions
- Forecasting model with acceptable accuracy (± 10%)
- Custom dashboard builder functional
- Real-time updates working
- Comparative analysis views implemented
- Performance maintained (< 100ms chart rendering)
- Accessibility compliance (WCAG 2.1 AA)

---

## Implementation Steps

### Step 6C.1: Interactive Chart Enhancements (2-3 hours)

#### Objectives

- Add drill-down capabilities to bar/pie charts
- Implement click-to-filter interactions
- Add chart zoom and pan for time-series

#### Tasks

**1. Create Drill-Down Hook**

Create `frontend/src/hooks/useDrillDown.ts`:

```typescript
import { useState, useCallback } from 'react';

export interface DrillDownLevel {
  level: number;
  label: string;
  filters: Record<string, string>;
}

export interface UseDrillDownReturn {
  currentLevel: number;
  breadcrumbs: DrillDownLevel[];
  drillDown: (label: string, filters: Record<string, string>) => void;
  drillUp: (level?: number) => void;
  reset: () => void;
}

/**
 * Hook for managing drill-down state in charts
 */
export const useDrillDown = (): UseDrillDownReturn => {
  const [breadcrumbs, setBreadcrumbs] = useState<DrillDownLevel[]>([
    { level: 0, label: 'All Data', filters: {} },
  ]);

  const currentLevel = breadcrumbs.length - 1;

  const drillDown = useCallback((label: string, filters: Record<string, string>) => {
    setBreadcrumbs((prev) => [
      ...prev,
      {
        level: prev.length,
        label,
        filters: { ...prev[prev.length - 1].filters, ...filters },
      },
    ]);
  }, []);

  const drillUp = useCallback((level?: number) => {
    setBreadcrumbs((prev) => {
      if (level !== undefined) {
        return prev.slice(0, level + 1);
      }
      return prev.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    setBreadcrumbs([{ level: 0, label: 'All Data', filters: {} }]);
  }, []);

  return {
    currentLevel,
    breadcrumbs,
    drillDown,
    drillUp,
    reset,
  };
};
```

**2. Create Drill-Down Breadcrumb Component**

Create `frontend/src/components/charts/DrillDownBreadcrumb.tsx`:

```typescript
import React from 'react';
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { DrillDownLevel } from '../../hooks/useDrillDown';

interface DrillDownBreadcrumbProps {
  breadcrumbs: DrillDownLevel[];
  onNavigate: (level: number) => void;
}

export const DrillDownBreadcrumb: React.FC<DrillDownBreadcrumbProps> = ({
  breadcrumbs,
  onNavigate,
}) => {
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb className="pf-v6-u-mb-md">
      {breadcrumbs.map((crumb, index) => (
        <BreadcrumbItem
          key={crumb.level}
          isActive={index === breadcrumbs.length - 1}
          onClick={() => index < breadcrumbs.length - 1 && onNavigate(index)}
        >
          {crumb.label}
        </BreadcrumbItem>
      ))}
    </Breadcrumb>
  );
};
```

**3. Update Model Distribution Chart with Drill-Down**

Update `frontend/src/components/charts/ModelDistributionChart.tsx`:

```typescript
import { useDrillDown } from '../../hooks/useDrillDown';
import { DrillDownBreadcrumb } from './DrillDownBreadcrumb';

export const ModelDistributionChart: React.FC<ModelDistributionChartProps> = ({
  data,
  onModelClick,
}) => {
  const { breadcrumbs, drillDown, drillUp, currentLevel } = useDrillDown();
  const [chartData, setChartData] = useState(data);

  // Handle slice click for drill-down
  const handleSliceClick = useCallback(
    (datum: { x: string; y: number }) => {
      if (currentLevel === 0) {
        // First level: drill into model
        drillDown(datum.x, { modelId: datum.x });

        // Fetch provider breakdown for this model
        // setChartData(providerDataForModel);
      } else if (currentLevel === 1) {
        // Second level: drill into provider
        drillDown(datum.x, { provider: datum.x });

        // Fetch user breakdown for this model+provider
        // setChartData(userDataForModelAndProvider);
      }

      onModelClick?.(datum.x);
    },
    [currentLevel, drillDown, onModelClick]
  );

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = useCallback(
    (level: number) => {
      drillUp(level);
      // Reset chart data based on level
      // setChartData(getDataForLevel(level));
    },
    [drillUp]
  );

  return (
    <div>
      <DrillDownBreadcrumb
        breadcrumbs={breadcrumbs}
        onNavigate={handleBreadcrumbClick}
      />

      <VictoryPie
        data={chartData}
        events={[
          {
            target: 'data',
            eventHandlers: {
              onClick: () => ({
                mutation: (props) => {
                  handleSliceClick(props.datum);
                  return null;
                },
              }),
            },
          },
        ]}
        // ... other props
      />
    </div>
  );
};
```

---

### Step 6C.2: Time-Series Forecasting (3-4 hours)

#### Objectives

- Implement simple linear regression for trend forecasting
- Add forecast visualization to usage trends chart
- Provide forecast confidence intervals

#### Tasks

**1. Create Forecasting Utility**

Create `frontend/src/utils/forecasting.ts`:

```typescript
/**
 * Simple linear regression for time-series forecasting
 */

export interface DataPoint {
  date: Date;
  value: number;
}

export interface ForecastResult {
  predictions: DataPoint[];
  slope: number;
  intercept: number;
  r2: number; // Coefficient of determination
  confidence: {
    lower: DataPoint[];
    upper: DataPoint[];
  };
}

/**
 * Calculate linear regression forecast
 *
 * @param data - Historical data points
 * @param forecastDays - Number of days to forecast
 * @returns Forecast results with confidence intervals
 */
export function forecastLinearRegression(data: DataPoint[], forecastDays: number): ForecastResult {
  // Convert dates to numeric values (days since first data point)
  const startDate = data[0].date.getTime();
  const points = data.map((d) => ({
    x: (d.date.getTime() - startDate) / (1000 * 60 * 60 * 24),
    y: d.value,
  }));

  // Calculate linear regression
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R² (goodness of fit)
  const meanY = sumY / n;
  const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = points.reduce(
    (sum, p) => sum + Math.pow(p.y - (slope * p.x + intercept), 2),
    0,
  );
  const r2 = 1 - ssResidual / ssTotal;

  // Calculate standard error for confidence intervals
  const standardError = Math.sqrt(ssResidual / (n - 2));

  // Generate predictions
  const lastX = points[points.length - 1].x;
  const predictions: DataPoint[] = [];
  const confidenceLower: DataPoint[] = [];
  const confidenceUpper: DataPoint[] = [];

  for (let i = 1; i <= forecastDays; i++) {
    const x = lastX + i;
    const predictedY = slope * x + intercept;

    // 95% confidence interval (±1.96 standard errors)
    const marginOfError = 1.96 * standardError;

    const forecastDate = new Date(startDate + x * 24 * 60 * 60 * 1000);

    predictions.push({
      date: forecastDate,
      value: Math.max(0, predictedY), // Ensure non-negative
    });

    confidenceLower.push({
      date: forecastDate,
      value: Math.max(0, predictedY - marginOfError),
    });

    confidenceUpper.push({
      date: forecastDate,
      value: Math.max(0, predictedY + marginOfError),
    });
  }

  return {
    predictions,
    slope,
    intercept,
    r2,
    confidence: {
      lower: confidenceLower,
      upper: confidenceUpper,
    },
  };
}

/**
 * Exponential smoothing forecast (alternative to linear regression)
 *
 * Better for data with trends and seasonality
 */
export function forecastExponentialSmoothing(
  data: DataPoint[],
  forecastDays: number,
  alpha = 0.3, // Smoothing factor (0-1)
): ForecastResult {
  // TODO: Implement exponential smoothing
  // For now, fall back to linear regression
  return forecastLinearRegression(data, forecastDays);
}
```

**2. Create Forecast Chart Component**

Create `frontend/src/components/charts/UsageForecastChart.tsx`:

```typescript
import React, { useMemo } from 'react';
import {
  Chart,
  ChartArea,
  ChartAxis,
  ChartGroup,
  ChartLine,
  ChartVoronoiContainer,
} from '@patternfly/react-charts';
import { forecastLinearRegression, DataPoint } from '../../utils/forecasting';
import { useTranslation } from 'react-i18next';

interface UsageForecastChartProps {
  historicalData: DataPoint[];
  forecastDays?: number;
  width?: number;
  height?: number;
}

export const UsageForecastChart: React.FC<UsageForecastChartProps> = ({
  historicalData,
  forecastDays = 7,
  width = 800,
  height = 400,
}) => {
  const { t } = useTranslation();

  const forecast = useMemo(() => {
    if (historicalData.length < 3) {
      return null; // Need at least 3 points for meaningful forecast
    }

    return forecastLinearRegression(historicalData, forecastDays);
  }, [historicalData, forecastDays]);

  if (!forecast) {
    return (
      <div>
        {t(
          'adminUsage.forecast.insufficientData',
          'Insufficient data for forecasting (minimum 3 data points required)'
        )}
      </div>
    );
  }

  // Prepare data for chart
  const historicalChartData = historicalData.map((d) => ({
    x: d.date,
    y: d.value,
    name: 'Historical',
  }));

  const forecastChartData = forecast.predictions.map((d) => ({
    x: d.date,
    y: d.value,
    name: 'Forecast',
  }));

  const confidenceLowerData = forecast.confidence.lower.map((d) => ({
    x: d.date,
    y: d.value,
  }));

  const confidenceUpperData = forecast.confidence.upper.map((d) => ({
    x: d.date,
    y: d.value,
  }));

  return (
    <div>
      <h3>
        {t('adminUsage.forecast.title', 'Usage Forecast')} (R² ={' '}
        {forecast.r2.toFixed(3)})
      </h3>

      <Chart
        ariaTitle={t('adminUsage.forecast.ariaTitle', 'Usage forecast chart')}
        containerComponent={
          <ChartVoronoiContainer
            labels={({ datum }) =>
              `${datum.name}: ${datum.y?.toLocaleString() || ''}`
            }
            constrainToVisibleArea
          />
        }
        height={height}
        width={width}
        padding={{ left: 80, right: 20, top: 20, bottom: 60 }}
      >
        <ChartAxis
          label={t('adminUsage.forecast.xAxisLabel', 'Date')}
          tickFormat={(x) => new Date(x).toLocaleDateString()}
        />
        <ChartAxis
          dependentAxis
          label={t('adminUsage.forecast.yAxisLabel', 'Usage')}
          tickFormat={(y) => y.toLocaleString()}
        />

        <ChartGroup>
          {/* Confidence interval (shaded area) */}
          <ChartArea
            data={[...confidenceLowerData, ...confidenceUpperData.reverse()]}
            style={{
              data: {
                fill: 'var(--pf-v6-chart-color-blue-100)',
                fillOpacity: 0.3,
                stroke: 'none',
              },
            }}
          />

          {/* Historical data */}
          <ChartLine
            data={historicalChartData}
            style={{
              data: {
                stroke: 'var(--pf-v6-chart-color-blue-300)',
                strokeWidth: 2,
              },
            }}
          />

          {/* Forecast */}
          <ChartLine
            data={forecastChartData}
            style={{
              data: {
                stroke: 'var(--pf-v6-chart-color-orange-300)',
                strokeWidth: 2,
                strokeDasharray: '5,5',
              },
            }}
          />
        </ChartGroup>
      </Chart>

      <div className="pf-v6-u-mt-md" style={{ fontSize: '0.875rem' }}>
        {forecast.slope > 0 ? (
          <span style={{ color: 'var(--pf-v6-global--warning-color--100)' }}>
            {t(
              'adminUsage.forecast.trendUp',
              'Trend: Increasing usage detected'
            )}
          </span>
        ) : forecast.slope < 0 ? (
          <span style={{ color: 'var(--pf-v6-global--success-color--100)' }}>
            {t(
              'adminUsage.forecast.trendDown',
              'Trend: Decreasing usage detected'
            )}
          </span>
        ) : (
          <span>
            {t(
              'adminUsage.forecast.trendStable',
              'Trend: Stable usage detected'
            )}
          </span>
        )}
      </div>
    </div>
  );
};
```

---

### Step 6C.3: Cost Optimization Recommendations (2-3 hours)

#### Objectives

- Analyze usage patterns for optimization opportunities
- Generate actionable recommendations
- Display recommendations in dashboard

#### Tasks

**1. Create Cost Optimization Service**

Create `backend/src/services/cost-optimization.service.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service';

export interface CostOptimizationRecommendation {
  type: 'model-substitution' | 'rate-limit' | 'usage-pattern' | 'budget-alert';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  potentialSavings: number; // USD
  actionItems: string[];
  metrics: Record<string, number>;
}

export class CostOptimizationService extends BaseService {
  /**
   * Analyze usage and generate cost optimization recommendations
   */
  async getRecommendations(filters: AdminUsageFilters): Promise<CostOptimizationRecommendation[]> {
    const recommendations: CostOptimizationRecommendation[] = [];

    // Get usage data
    const modelBreakdown = await this.getModelBreakdown(filters);
    const userBreakdown = await this.getUserBreakdown(filters);

    // Recommendation 1: Expensive model substitution
    recommendations.push(...this.checkModelSubstitution(modelBreakdown));

    // Recommendation 2: High-usage users
    recommendations.push(...this.checkHighUsageUsers(userBreakdown));

    // Recommendation 3: Idle models
    recommendations.push(...this.checkIdleModels(modelBreakdown));

    // Sort by potential savings
    return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Check for expensive models that could be replaced
   */
  private checkModelSubstitution(
    modelBreakdown: ModelBreakdown[],
  ): CostOptimizationRecommendation[] {
    const recommendations: CostOptimizationRecommendation[] = [];

    // Find expensive models with substitutes
    const expensiveModels = modelBreakdown.filter(
      (m) => m.avgCostPerRequest > 0.01, // > $0.01 per request
    );

    for (const model of expensiveModels) {
      // Check if there's a cheaper alternative
      const cheaper = this.findCheaperAlternative(model);

      if (cheaper) {
        const potentialSavings =
          model.totalRequests * (model.avgCostPerRequest - cheaper.avgCostPerRequest);

        recommendations.push({
          type: 'model-substitution',
          severity: potentialSavings > 100 ? 'high' : 'medium',
          title: `Consider switching from ${model.modelId} to ${cheaper.modelId}`,
          description: `${model.modelId} costs $${model.avgCostPerRequest.toFixed(4)} per request, while ${cheaper.modelId} costs $${cheaper.avgCostPerRequest.toFixed(4)}. For ${model.totalRequests.toLocaleString()} requests, this could save approximately $${potentialSavings.toFixed(2)}.`,
          potentialSavings,
          actionItems: [
            `Test ${cheaper.modelId} for quality comparison`,
            `Migrate users from ${model.modelId} to ${cheaper.modelId}`,
            `Monitor quality metrics after migration`,
          ],
          metrics: {
            currentCost: model.totalCost,
            potentialCost: model.totalRequests * cheaper.avgCostPerRequest,
            requests: model.totalRequests,
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Check for users with high usage
   */
  private checkHighUsageUsers(userBreakdown: UserBreakdown[]): CostOptimizationRecommendation[] {
    const recommendations: CostOptimizationRecommendation[] = [];

    // Calculate median cost
    const costs = userBreakdown.map((u) => u.totalCost).sort((a, b) => a - b);
    const median = costs[Math.floor(costs.length / 2)];

    // Find outliers (users spending > 3x median)
    const outliers = userBreakdown.filter((u) => u.totalCost > median * 3);

    if (outliers.length > 0) {
      const totalOutlierCost = outliers.reduce((sum, u) => sum + u.totalCost, 0);

      recommendations.push({
        type: 'usage-pattern',
        severity: 'medium',
        title: `${outliers.length} user(s) with unusually high usage detected`,
        description: `${outliers.length} users are spending significantly more than the median ($${median.toFixed(2)}). Total spend from these users: $${totalOutlierCost.toFixed(2)}.`,
        potentialSavings: 0, // Unknown without intervention
        actionItems: [
          'Review usage patterns with these users',
          'Consider implementing rate limits',
          'Evaluate if usage is legitimate or potential abuse',
          'Provide cost optimization guidance to users',
        ],
        metrics: {
          outlierCount: outliers.length,
          medianCost: median,
          totalOutlierCost,
        },
      });
    }

    return recommendations;
  }

  /**
   * Find cheaper model alternative
   */
  private findCheaperAlternative(
    model: ModelBreakdown,
  ): { modelId: string; avgCostPerRequest: number } | null {
    // Simplified logic - in production, this would use a knowledge base
    // of model capabilities and costs

    const alternatives: Record<string, string[]> = {
      'gpt-4': ['gpt-3.5-turbo', 'claude-2'],
      'gpt-4-32k': ['gpt-4', 'claude-2-100k'],
      'claude-3-opus': ['claude-3-sonnet', 'claude-2'],
    };

    const cheaperOptions = alternatives[model.modelId];
    if (!cheaperOptions) {
      return null;
    }

    // Return first cheaper option (simplified)
    // In production, would check actual pricing and availability
    return {
      modelId: cheaperOptions[0],
      avgCostPerRequest: model.avgCostPerRequest * 0.1, // Assume 90% cost reduction
    };
  }
}
```

**2. Create Recommendations Component**

Create `frontend/src/components/admin/CostOptimizationRecommendations.tsx`:

```typescript
import React from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  List,
  ListItem,
  Label,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import {
  ExclamationTriangleIcon,
  InfoCircleIcon,
  CheckCircleIcon,
} from '@patternfly/react-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export const CostOptimizationRecommendations: React.FC<{
  filters: AdminUsageFilters;
}> = ({ filters }) => {
  const { t } = useTranslation();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['costOptimization', filters],
    queryFn: () => adminUsageService.getCostOptimizationRecommendations(filters),
  });

  if (isLoading) {
    return <div>Loading recommendations...</div>;
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardBody>
          <Flex alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>
              <CheckCircleIcon color="green" />
            </FlexItem>
            <FlexItem>
              {t(
                'adminUsage.costOptimization.noRecommendations',
                'No cost optimization opportunities found'
              )}
            </FlexItem>
          </Flex>
        </CardBody>
      </Card>
    );
  }

  return (
    <div>
      <h2>{t('adminUsage.costOptimization.title', 'Cost Optimization Recommendations')}</h2>

      {recommendations.map((rec, index) => (
        <Card key={index} className="pf-v6-u-mb-md">
          <CardTitle>
            <Flex alignItems={{ default: 'alignItemsCenter' }}>
              <FlexItem>
                {rec.severity === 'high' && (
                  <ExclamationTriangleIcon color="red" />
                )}
                {rec.severity === 'medium' && (
                  <ExclamationTriangleIcon color="orange" />
                )}
                {rec.severity === 'low' && <InfoCircleIcon color="blue" />}
              </FlexItem>
              <FlexItem>{rec.title}</FlexItem>
              <FlexItem align={{ default: 'alignRight' }}>
                {rec.potentialSavings > 0 && (
                  <Label color="green">
                    Save ${rec.potentialSavings.toFixed(2)}
                  </Label>
                )}
              </FlexItem>
            </Flex>
          </CardTitle>

          <CardBody>
            <p>{rec.description}</p>

            <h4 className="pf-v6-u-mt-md">
              {t('adminUsage.costOptimization.actionItems', 'Action Items')}:
            </h4>
            <List>
              {rec.actionItems.map((item, i) => (
                <ListItem key={i}>{item}</ListItem>
              ))}
            </List>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};
```

---

### Step 6C.4: Custom Dashboard Builder (3-4 hours)

#### Objectives

- Allow users to create custom dashboard layouts
- Implement drag-and-drop widget arrangement
- Save/load dashboard configurations

#### Tasks

**1. Install Dashboard Library**

```bash
npm --prefix frontend install react-grid-layout
npm --prefix frontend install --save-dev @types/react-grid-layout
```

**2. Create Dashboard Builder Component**

Create `frontend/src/components/admin/CustomDashboardBuilder.tsx`:

```typescript
import React, { useState } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  Button,
  Card,
  CardBody,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

interface DashboardWidget {
  id: string;
  type: 'usage-trends' | 'model-distribution' | 'user-breakdown' | 'forecast' | 'recommendations';
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CustomDashboardBuilder: React.FC = () => {
  const { t } = useTranslation();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([
    {
      id: 'widget-1',
      type: 'usage-trends',
      title: 'Usage Trends',
      x: 0,
      y: 0,
      w: 6,
      h: 2,
    },
    {
      id: 'widget-2',
      type: 'model-distribution',
      title: 'Model Distribution',
      x: 6,
      y: 0,
      w: 6,
      h: 2,
    },
  ]);

  const handleLayoutChange = (layout: any[]) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        const layoutItem = layout.find((l) => l.i === widget.id);
        if (layoutItem) {
          return {
            ...widget,
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          };
        }
        return widget;
      })
    );
  };

  const saveDashboard = () => {
    localStorage.setItem('customDashboard', JSON.stringify(widgets));
    // TODO: Also save to backend for cross-device sync
  };

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.type) {
      case 'usage-trends':
        return <UsageTrends /* props */ />;
      case 'model-distribution':
        return <ModelDistributionChart /* props */ />;
      // ... other widget types
      default:
        return <div>Unknown widget type</div>;
    }
  };

  return (
    <div>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <Button onClick={saveDashboard}>
              {t('adminUsage.dashboard.save', 'Save Dashboard')}
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="secondary">
              {t('adminUsage.dashboard.addWidget', 'Add Widget')}
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      <GridLayout
        className="layout"
        layout={widgets.map((w) => ({
          i: w.id,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
        }))}
        cols={12}
        rowHeight={150}
        width={1200}
        onLayoutChange={handleLayoutChange}
        isDraggable
        isResizable
      >
        {widgets.map((widget) => (
          <div key={widget.id}>
            <Card>
              <CardBody>{renderWidget(widget)}</CardBody>
            </Card>
          </div>
        ))}
      </GridLayout>
    </div>
  );
};
```

---

### Step 6C.5: Real-Time Usage Monitoring (2-3 hours)

#### Objectives

- Add WebSocket support for real-time updates
- Create live usage dashboard
- Implement auto-refresh without WebSockets as fallback

#### Tasks

**1. Add WebSocket Support (if not already present)**

```bash
npm --prefix backend install @fastify/websocket
```

**2. Create Real-Time Events Service**

Create `backend/src/services/real-time-events.service.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { WebSocket } from '@fastify/websocket';

export class RealTimeEventsService {
  private clients = new Set<WebSocket>();

  constructor(private fastify: FastifyInstance) {}

  /**
   * Register WebSocket client
   */
  addClient(ws: WebSocket): void {
    this.clients.add(ws);

    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  /**
   * Broadcast usage update to all connected clients
   */
  broadcastUsageUpdate(data: {
    timestamp: Date;
    requests: number;
    tokens: number;
    cost: number;
  }): void {
    const message = JSON.stringify({
      type: 'usage-update',
      data,
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
```

**3. Create Real-Time Dashboard Component**

Create `frontend/src/components/admin/RealTimeDashboard.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardTitle } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';

export const RealTimeDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [liveData, setLiveData] = useState({
    currentRequests: 0,
    currentTokens: 0,
    currentCost: 0,
  });

  useEffect(() => {
    // WebSocket connection for real-time updates
    const ws = new WebSocket('ws://localhost:8081/ws/usage');

    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);

      if (type === 'usage-update') {
        setLiveData({
          currentRequests: data.requests,
          currentTokens: data.tokens,
          currentCost: data.cost,
        });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Fall back to polling
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div>
      <h2>{t('adminUsage.realTime.title', 'Real-Time Usage')}</h2>

      <div className="pf-v6-l-grid pf-v6-m-gutter">
        <Card>
          <CardTitle>
            {t('adminUsage.realTime.requests', 'Current Requests')}
          </CardTitle>
          <CardBody>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {liveData.currentRequests.toLocaleString()}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>
            {t('adminUsage.realTime.tokens', 'Current Tokens')}
          </CardTitle>
          <CardBody>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              {liveData.currentTokens.toLocaleString()}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardTitle>
            {t('adminUsage.realTime.cost', 'Current Cost')}
          </CardTitle>
          <CardBody>
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
              ${liveData.currentCost.toFixed(2)}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
```

---

### Step 6C.6: Comparative Analysis Views (2-3 hours)

#### Objectives

- Period-over-period comparison
- Cohort analysis
- Side-by-side metrics

#### Tasks

**1. Create Comparison Component**

Create `frontend/src/components/admin/PeriodComparison.tsx`:

```typescript
import React from 'react';
import {
  Card,
  CardBody,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { ArrowUpIcon, ArrowDownIcon } from '@patternfly/react-icons';

interface PeriodComparisonProps {
  metric: string;
  current: number;
  previous: number;
  format?: 'number' | 'currency' | 'percentage';
}

export const PeriodComparison: React.FC<PeriodComparisonProps> = ({
  metric,
  current,
  previous,
  format = 'number',
}) => {
  const change = current - previous;
  const percentChange = previous > 0 ? (change / previous) * 100 : 0;
  const isIncrease = change > 0;

  const formatValue = (value: number): string => {
    switch (format) {
      case 'currency':
        return `$${value.toFixed(2)}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <Card>
      <CardBody>
        <h4>{metric}</h4>

        <Split hasGutter>
          <SplitItem>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                {formatValue(current)}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--pf-v6-global--Color--200)' }}>
                Current period
              </div>
            </div>
          </SplitItem>

          <SplitItem>
            <div>
              {isIncrease ? (
                <ArrowUpIcon color="red" />
              ) : (
                <ArrowDownIcon color="green" />
              )}
              <span
                style={{
                  color: isIncrease ? 'var(--pf-v6-global--danger-color--100)' : 'var(--pf-v6-global--success-color--100)',
                  fontWeight: 'bold',
                }}
              >
                {Math.abs(percentChange).toFixed(1)}%
              </span>
            </div>
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
};
```

---

## Deliverables

- [x] Interactive drill-down charts
- [x] Time-series forecasting
- [x] Cost optimization recommendations
- [x] Custom dashboard builder
- [x] Real-time usage monitoring
- [x] Period-over-period comparisons
- [x] All visualizations accessible
- [x] Tests and documentation

---

## Acceptance Criteria

- [ ] Charts support drill-down interactions
- [ ] Forecasting accuracy within ± 10%
- [ ] Cost recommendations actionable
- [ ] Custom dashboards save/load correctly
- [ ] Real-time updates working
- [ ] Comparative views functional
- [ ] All charts render in < 100ms
- [ ] WCAG 2.1 AA compliant

---

## Validation

### Manual Testing

Test drill-down, forecasting, custom dashboards, and real-time features in browser.

### Accessibility Testing

```bash
# Run accessibility audit
npm run test:a11y
```

---

## Next Steps

- [ ] Complete Session 6C deliverables
- [ ] Validate acceptance criteria
- [ ] Proceed to [Session 6D - Scheduled Reports](./phase-6-session-6d-scheduled-reports.md)

---

**Session Status**: ⬜ Not Started

**Last Updated**: 2025-10-11

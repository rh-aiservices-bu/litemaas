import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Grid,
  GridItem,
  Card,
  CardBody,
  CardTitle,
  Title,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Skeleton,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import {
  CubeIcon,
  DollarSignIcon,
  UsersIcon,
  CheckCircleIcon,
  ExpandIcon,
  HashtagIcon,
  ImportIcon,
  ExportIcon,
} from '@patternfly/react-icons';
import { UsageTrends, ModelDistributionChart, ModelUsageTrends, UsageHeatmap } from '../charts';
import {
  transformDailyUsageToChartData,
  transformModelBreakdownToChartData,
  transformDailyUsageToHeatmapData,
} from '../../utils/chartDataTransformers';
import { formatNumber, formatCurrency } from '../../utils/formatters';
import { MetricCard, type TrendData } from '../usage/metrics';
import { TopUsersTable, type UserSummary } from './TopUsersTable';
import FullScreenChartModal from '../common/FullScreenChartModal';

/**
 * Token breakdown with prompt/completion/total
 */
interface TokenBreakdown {
  total: number;
  prompt: number;
  completion: number;
}

/**
 * Cost breakdown by various dimensions
 */
interface CostBreakdown {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byUser: Record<string, number>;
}

/**
 * Model summary for top models
 */
interface ModelSummary {
  modelId: string;
  modelName: string;
  provider: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Date range filter
 */
interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Global metrics aggregated across all users
 */
export interface GlobalMetrics {
  period: DateRange;
  totalUsers: number;
  activeUsers: number;
  totalRequests: number;
  totalTokens: TokenBreakdown;
  totalCost: CostBreakdown;
  successRate: number;
  averageLatency: number;
  topMetrics: {
    topUser: UserSummary | null;
    topModel: ModelSummary | null;
    topApiKey: any | null;
  };
  trends: {
    requestsTrend: TrendData;
    costTrend: TrendData;
    usersTrend: TrendData;
    totalTokensTrend: TrendData;
    promptTokensTrend: TrendData;
    completionTokensTrend: TrendData;
  };
  dailyUsage?: Array<{
    date: string;
    requests: number;
    tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    cost: number;
  }>;
  topModels?: ModelSummary[];
  topUsers?: UserSummary[];
  dailyModelUsage?: any[];
}

export interface MetricsOverviewProps {
  data: GlobalMetrics;
  loading: boolean;
}

/**
 * MetricsOverview Component
 * Main dashboard component that displays admin usage analytics overview
 */
const MetricsOverview: React.FC<MetricsOverviewProps> = ({ data, loading }) => {
  const { t } = useTranslation();
  const [selectedMetric, setSelectedMetric] = useState<
    'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens'
  >('requests');
  const [isMetricSelectOpen, setIsMetricSelectOpen] = useState(false);
  const [selectedModelMetric, setSelectedModelMetric] = useState<
    'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens'
  >('requests');
  const [isModelMetricSelectOpen, setIsModelMetricSelectOpen] = useState(false);
  const [isUsageTrendsExpanded, setIsUsageTrendsExpanded] = useState(false);
  const [isModelUsageTrendsExpanded, setIsModelUsageTrendsExpanded] = useState(false);
  const [isTopUsersExpanded, setIsTopUsersExpanded] = useState(false);
  const [isModelDistributionExpanded, setIsModelDistributionExpanded] = useState(false);
  const [selectedHeatmapMetric, setSelectedHeatmapMetric] = useState<
    'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens'
  >('requests');
  const [isHeatmapSelectOpen, setIsHeatmapSelectOpen] = useState(false);
  const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false);

  const getSuccessRateVariant = (rate: number): 'default' | 'success' | 'warning' | 'danger' => {
    if (rate >= 95) return 'success';
    if (rate >= 85) return 'warning';
    return 'danger';
  };

  // Helper function to get metric label based on metric type
  const getMetricLabel = (
    metric: 'requests' | 'tokens' | 'cost' | 'prompt_tokens' | 'completion_tokens',
  ): string => {
    switch (metric) {
      case 'requests':
        return t('adminUsage.totalRequests');
      case 'tokens':
        return t('pages.usage.metrics.totalTokens');
      case 'prompt_tokens':
        return t('adminUsage.promptTokens');
      case 'completion_tokens':
        return t('adminUsage.completionTokens');
      case 'cost':
        return t('adminUsage.totalCost');
    }
  };

  // Get top users from data
  const topUsers: UserSummary[] = data?.topUsers || [];

  // Prepare chart data
  const chartData = data?.dailyUsage
    ? transformDailyUsageToChartData(data.dailyUsage)
    : { requests: [], tokens: [], prompt_tokens: [], completion_tokens: [], cost: [] };

  const modelChartData = data?.topModels
    ? transformModelBreakdownToChartData(
        data.topModels.map((m) => ({
          name: m.modelName,
          requests: m.requests,
          tokens: m.tokens,
          prompt_tokens: m.prompt_tokens,
          completion_tokens: m.completion_tokens,
          cost: m.cost,
        })),
        data.totalRequests,
      )
    : { chartData: [], modelBreakdown: [] };

  // Stabilize dailyModelUsage data reference to prevent unnecessary re-renders
  const dailyModelUsageData = useMemo(() => data?.dailyModelUsage || [], [data?.dailyModelUsage]);

  // Prepare heatmap data
  const heatmapData = useMemo(() => {
    if (!data?.dailyUsage || !data?.period) {
      return [];
    }
    const startDate =
      data.period.startDate instanceof Date
        ? data.period.startDate.toISOString().split('T')[0]
        : data.period.startDate;
    const endDate =
      data.period.endDate instanceof Date
        ? data.period.endDate.toISOString().split('T')[0]
        : data.period.endDate;

    return transformDailyUsageToHeatmapData(
      data.dailyUsage,
      startDate,
      endDate,
      selectedHeatmapMetric,
    );
  }, [data?.dailyUsage, data?.period, selectedHeatmapMetric]);

  return (
    <Grid hasGutter>
      {/* Row 1 - Volume Metrics (4 cards) */}
      <GridItem lg={3} md={6} sm={12}>
        <MetricCard
          size="compact"
          title={t('adminUsage.totalRequests')}
          value={loading ? '' : formatNumber(data?.totalRequests || 0)}
          icon={<CubeIcon />}
          trend={!loading && data?.trends?.requestsTrend ? data.trends.requestsTrend : undefined}
          loading={loading}
          ariaLabel={t('adminUsage.metrics.totalRequestsAriaLabel', {
            count: data?.totalRequests || 0,
          })}
        />
      </GridItem>

      <GridItem lg={3} md={6} sm={12}>
        <MetricCard
          size="compact"
          title={t('pages.usage.metrics.totalTokens')}
          value={loading ? '' : formatNumber(data?.totalTokens?.total || 0)}
          icon={<HashtagIcon />}
          trend={
            !loading && data?.trends?.totalTokensTrend ? data.trends.totalTokensTrend : undefined
          }
          loading={loading}
          ariaLabel={t('adminUsage.metrics.totalTokensAriaLabel', {
            count: data?.totalTokens?.total || 0,
          })}
        />
      </GridItem>

      <GridItem lg={3} md={6} sm={12}>
        <MetricCard
          size="compact"
          title={t('adminUsage.promptTokens')}
          value={loading ? '' : formatNumber(data?.totalTokens?.prompt || 0)}
          icon={<ImportIcon />}
          trend={
            !loading && data?.trends?.promptTokensTrend ? data.trends.promptTokensTrend : undefined
          }
          loading={loading}
          ariaLabel={t('adminUsage.metrics.promptTokensAriaLabel', {
            count: data?.totalTokens?.prompt || 0,
          })}
        />
      </GridItem>

      <GridItem lg={3} md={6} sm={12}>
        <MetricCard
          size="compact"
          title={t('adminUsage.completionTokens')}
          value={loading ? '' : formatNumber(data?.totalTokens?.completion || 0)}
          icon={<ExportIcon />}
          trend={
            !loading && data?.trends?.completionTokensTrend
              ? data.trends.completionTokensTrend
              : undefined
          }
          loading={loading}
          ariaLabel={t('adminUsage.metrics.completionTokensAriaLabel', {
            count: data?.totalTokens?.completion || 0,
          })}
        />
      </GridItem>

      {/* Row 2 - Quality/Financial Metrics (3 cards) */}
      <GridItem lg={4} md={6} sm={12}>
        <MetricCard
          size="compact"
          title={t('adminUsage.totalCost')}
          value={loading ? '' : formatCurrency(data?.totalCost?.total || 0)}
          icon={<DollarSignIcon />}
          trend={!loading && data?.trends?.costTrend ? data.trends.costTrend : undefined}
          loading={loading}
          ariaLabel={t('adminUsage.metrics.totalCostAriaLabel', {
            amount: data?.totalCost?.total || 0,
          })}
        />
      </GridItem>

      <GridItem lg={4} md={6} sm={12}>
        <MetricCard
          size="compact"
          title={t('adminUsage.activeUsers')}
          value={loading ? '' : formatNumber(data?.activeUsers || 0)}
          icon={<UsersIcon />}
          subtitle={
            !loading && data
              ? t('adminUsage.metrics.ofTotalUsers', { total: formatNumber(data.totalUsers) })
              : undefined
          }
          loading={loading}
          ariaLabel={t('adminUsage.metrics.activeUsersAriaLabel', {
            active: data?.activeUsers || 0,
            total: data?.totalUsers || 0,
          })}
        />
      </GridItem>

      <GridItem lg={4} md={6} sm={12}>
        <MetricCard
          size="compact"
          title={t('adminUsage.successRate')}
          value={loading ? '' : `${(data?.successRate || 0).toFixed(1)}%`}
          icon={<CheckCircleIcon />}
          variant={!loading && data ? getSuccessRateVariant(data.successRate) : 'default'}
          loading={loading}
          ariaLabel={t('adminUsage.metrics.successRateAriaLabel', {
            percentage: data?.successRate || 0,
          })}
        />
      </GridItem>

      {/* Second Row - 2 Metric Cards */}
      <GridItem lg={6} md={12} sm={12}>
        <Card isFullHeight>
          <CardTitle>
            <Flex
              justifyContent={{ default: 'justifyContentSpaceBetween' }}
              alignItems={{ default: 'alignItemsCenter' }}
            >
              <FlexItem>
                <Title headingLevel="h3" size="lg">
                  {t('adminUsage.charts.usageTrends')}
                </Title>
              </FlexItem>
              <FlexItem>
                <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>
                    <Select
                      id="metric-select"
                      isOpen={isMetricSelectOpen}
                      selected={selectedMetric}
                      onSelect={(_event, value) => {
                        setSelectedMetric(
                          value as
                            | 'requests'
                            | 'tokens'
                            | 'cost'
                            | 'prompt_tokens'
                            | 'completion_tokens',
                        );
                        setIsMetricSelectOpen(false);
                      }}
                      onOpenChange={setIsMetricSelectOpen}
                      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                        <MenuToggle
                          ref={toggleRef}
                          onClick={() => setIsMetricSelectOpen(!isMetricSelectOpen)}
                          variant="plainText"
                        >
                          {selectedMetric === 'requests'
                            ? t('adminUsage.totalRequests')
                            : selectedMetric === 'tokens'
                              ? t('pages.usage.metrics.totalTokens')
                              : selectedMetric === 'prompt_tokens'
                                ? t('adminUsage.promptTokens')
                                : selectedMetric === 'completion_tokens'
                                  ? t('adminUsage.completionTokens')
                                  : t('adminUsage.totalCost')}
                        </MenuToggle>
                      )}
                    >
                      <SelectList>
                        <SelectOption value="requests">
                          {t('adminUsage.totalRequests')}
                        </SelectOption>
                        <SelectOption value="tokens">
                          {t('pages.usage.metrics.totalTokens')}
                        </SelectOption>
                        <SelectOption value="prompt_tokens">
                          {t('adminUsage.promptTokens')}
                        </SelectOption>
                        <SelectOption value="completion_tokens">
                          {t('adminUsage.completionTokens')}
                        </SelectOption>
                        <SelectOption value="cost">{t('adminUsage.totalCost')}</SelectOption>
                      </SelectList>
                    </Select>
                  </FlexItem>
                  <FlexItem>
                    <MenuToggle
                      variant="plain"
                      onClick={() => setIsUsageTrendsExpanded(true)}
                      aria-label={t('common.expandToFullScreen', 'Expand to full screen')}
                      icon={<ExpandIcon />}
                    />
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </CardTitle>
          <CardBody>
            {loading ? (
              <Skeleton height="400px" />
            ) : (
              <UsageTrends
                data={chartData[selectedMetric]}
                loading={false}
                height={400}
                metricType={selectedMetric}
                title={t('adminUsage.charts.usageTrends')}
                description={t('adminUsage.charts.usageTrendsDescription')}
              />
            )}
          </CardBody>
        </Card>

        {/* Full Screen Modal for Usage Trends */}
        <FullScreenChartModal
          isOpen={isUsageTrendsExpanded}
          onClose={() => setIsUsageTrendsExpanded(false)}
          title={`${t('adminUsage.charts.usageTrends')} - ${getMetricLabel(selectedMetric)}`}
        >
          <UsageTrends
            data={chartData[selectedMetric]}
            loading={false}
            height={600}
            metricType={selectedMetric}
            title={t('adminUsage.charts.usageTrends')}
            description={t('adminUsage.charts.usageTrendsDescription')}
          />
        </FullScreenChartModal>
      </GridItem>

      <GridItem lg={6} md={12} sm={12}>
        <Card isFullHeight>
          <CardTitle>
            <Flex
              justifyContent={{ default: 'justifyContentSpaceBetween' }}
              alignItems={{ default: 'alignItemsCenter' }}
            >
              <FlexItem>
                <Title headingLevel="h3" size="lg">
                  {t('adminUsage.charts.modelUsageTrends', 'Model Usage Trends')}
                </Title>
              </FlexItem>
              <FlexItem>
                <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>
                    <Select
                      id="model-metric-select"
                      isOpen={isModelMetricSelectOpen}
                      selected={selectedModelMetric}
                      onSelect={(_event, value) => {
                        setSelectedModelMetric(
                          value as
                            | 'requests'
                            | 'tokens'
                            | 'cost'
                            | 'prompt_tokens'
                            | 'completion_tokens',
                        );
                        setIsModelMetricSelectOpen(false);
                      }}
                      onOpenChange={setIsModelMetricSelectOpen}
                      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                        <MenuToggle
                          ref={toggleRef}
                          onClick={() => setIsModelMetricSelectOpen(!isModelMetricSelectOpen)}
                          variant="plainText"
                        >
                          {selectedModelMetric === 'requests'
                            ? t('adminUsage.totalRequests')
                            : selectedModelMetric === 'tokens'
                              ? t('pages.usage.metrics.totalTokens')
                              : selectedModelMetric === 'prompt_tokens'
                                ? t('adminUsage.promptTokens')
                                : selectedModelMetric === 'completion_tokens'
                                  ? t('adminUsage.completionTokens')
                                  : t('adminUsage.totalCost')}
                        </MenuToggle>
                      )}
                    >
                      <SelectList>
                        <SelectOption value="requests">
                          {t('adminUsage.totalRequests')}
                        </SelectOption>
                        <SelectOption value="tokens">
                          {t('pages.usage.metrics.totalTokens')}
                        </SelectOption>
                        <SelectOption value="prompt_tokens">
                          {t('adminUsage.promptTokens')}
                        </SelectOption>
                        <SelectOption value="completion_tokens">
                          {t('adminUsage.completionTokens')}
                        </SelectOption>
                        <SelectOption value="cost">{t('adminUsage.totalCost')}</SelectOption>
                      </SelectList>
                    </Select>
                  </FlexItem>
                  <FlexItem>
                    <MenuToggle
                      variant="plain"
                      onClick={() => setIsModelUsageTrendsExpanded(true)}
                      aria-label={t('common.expandToFullScreen', 'Expand to full screen')}
                      icon={<ExpandIcon />}
                    />
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </CardTitle>
          <CardBody>
            {loading ? (
              <Skeleton height="400px" />
            ) : (
              <ModelUsageTrends
                data={dailyModelUsageData}
                loading={false}
                height={400}
                metricType={selectedModelMetric}
                title={t('adminUsage.charts.modelUsageTrends', 'Model Usage Trends')}
                description={t(
                  'adminUsage.charts.modelUsageTrendsDescription',
                  'Model usage breakdown over time',
                )}
              />
            )}
          </CardBody>
        </Card>

        {/* Full Screen Modal for Model Usage Trends */}
        <FullScreenChartModal
          isOpen={isModelUsageTrendsExpanded}
          onClose={() => setIsModelUsageTrendsExpanded(false)}
          title={`${t('adminUsage.charts.modelUsageTrends', 'Model Usage Trends')} - ${getMetricLabel(selectedModelMetric)}`}
        >
          <ModelUsageTrends
            data={dailyModelUsageData}
            loading={false}
            height={600}
            metricType={selectedModelMetric}
            title={t('adminUsage.charts.modelUsageTrends', 'Model Usage Trends')}
            description={t(
              'adminUsage.charts.modelUsageTrendsDescription',
              'Model usage breakdown over time',
            )}
          />
        </FullScreenChartModal>
      </GridItem>

      {/* Row 3 - Weekly Usage Patterns and Model Distribution */}
      <GridItem lg={6} md={12} sm={12}>
        <Card isFullHeight>
          <CardTitle>
            <Flex
              justifyContent={{ default: 'justifyContentSpaceBetween' }}
              alignItems={{ default: 'alignItemsCenter' }}
            >
              <FlexItem>
                <div>
                  <Title headingLevel="h3" size="lg">
                    {t('adminUsage.weeklyUsagePatterns')}
                  </Title>
                  <Content
                    component={ContentVariants.small}
                    style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
                  >
                    {t('adminUsage.usageHeatmapSubtitle')}
                  </Content>
                </div>
              </FlexItem>
              <FlexItem>
                <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>
                    <Select
                      id="heatmap-metric-select"
                      isOpen={isHeatmapSelectOpen}
                      selected={selectedHeatmapMetric}
                      onSelect={(_event, value) => {
                        setSelectedHeatmapMetric(
                          value as
                            | 'requests'
                            | 'tokens'
                            | 'cost'
                            | 'prompt_tokens'
                            | 'completion_tokens',
                        );
                        setIsHeatmapSelectOpen(false);
                      }}
                      onOpenChange={setIsHeatmapSelectOpen}
                      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                        <MenuToggle
                          ref={toggleRef}
                          onClick={() => setIsHeatmapSelectOpen(!isHeatmapSelectOpen)}
                          variant="plainText"
                        >
                          {selectedHeatmapMetric === 'requests'
                            ? t('adminUsage.totalRequests')
                            : selectedHeatmapMetric === 'tokens'
                              ? t('pages.usage.metrics.totalTokens')
                              : selectedHeatmapMetric === 'prompt_tokens'
                                ? t('adminUsage.promptTokens')
                                : selectedHeatmapMetric === 'completion_tokens'
                                  ? t('adminUsage.completionTokens')
                                  : t('adminUsage.totalCost')}
                        </MenuToggle>
                      )}
                    >
                      <SelectList>
                        <SelectOption value="requests">
                          {t('adminUsage.totalRequests')}
                        </SelectOption>
                        <SelectOption value="tokens">
                          {t('pages.usage.metrics.totalTokens')}
                        </SelectOption>
                        <SelectOption value="prompt_tokens">
                          {t('adminUsage.promptTokens')}
                        </SelectOption>
                        <SelectOption value="completion_tokens">
                          {t('adminUsage.completionTokens')}
                        </SelectOption>
                        <SelectOption value="cost">{t('adminUsage.totalCost')}</SelectOption>
                      </SelectList>
                    </Select>
                  </FlexItem>
                  <FlexItem>
                    <MenuToggle
                      variant="plain"
                      onClick={() => setIsHeatmapExpanded(true)}
                      aria-label={t('common.expandToFullScreen', 'Expand to full screen')}
                      icon={<ExpandIcon />}
                    />
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </CardTitle>
          <CardBody>
            <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
              {loading ? (
                <Skeleton height="350px" />
              ) : (
                <UsageHeatmap
                  data={heatmapData}
                  loading={false}
                  height={350}
                  metricType={selectedHeatmapMetric}
                />
              )}
            </div>
          </CardBody>
        </Card>

        {/* Full Screen Modal for Heatmap */}
        <FullScreenChartModal
          isOpen={isHeatmapExpanded}
          onClose={() => setIsHeatmapExpanded(false)}
          title={`${t('adminUsage.weeklyUsagePatterns')} - ${getMetricLabel(selectedHeatmapMetric)}`}
        >
          <UsageHeatmap
            data={heatmapData}
            loading={false}
            height={600}
            metricType={selectedHeatmapMetric}
          />
        </FullScreenChartModal>
      </GridItem>

      <GridItem lg={6} md={12} sm={12}>
        <Card isFullHeight>
          <CardTitle>
            <Flex
              justifyContent={{ default: 'justifyContentSpaceBetween' }}
              alignItems={{ default: 'alignItemsCenter' }}
            >
              <FlexItem>
                <Title headingLevel="h3" size="lg">
                  {t('pages.usage.charts.modelUsageDistribution')}
                </Title>
              </FlexItem>
              <FlexItem>
                <MenuToggle
                  variant="plain"
                  onClick={() => setIsModelDistributionExpanded(true)}
                  aria-label={t('common.expandToFullScreen', 'Expand to full screen')}
                  icon={<ExpandIcon />}
                />
              </FlexItem>
            </Flex>
          </CardTitle>
          <CardBody>
            {loading ? (
              <Skeleton height="300px" />
            ) : modelChartData.chartData.length > 0 ? (
              <ModelDistributionChart
                data={modelChartData.chartData}
                modelBreakdown={modelChartData.modelBreakdown}
                size={300}
                width="auto"
                showLegend={true}
                showBreakdown={false}
                ariaLabel={t('adminUsage.charts.modelDistributionAriaLabel')}
              />
            ) : (
              <Content
                component={ContentVariants.small}
                style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
              >
                {t('adminUsage.charts.noDataAvailable')}
              </Content>
            )}
          </CardBody>
        </Card>

        {/* Full Screen Modal for Model Distribution */}
        <FullScreenChartModal
          isOpen={isModelDistributionExpanded}
          onClose={() => setIsModelDistributionExpanded(false)}
          title={t('pages.usage.charts.modelUsageDistribution')}
        >
          {modelChartData.chartData.length > 0 ? (
            <ModelDistributionChart
              data={modelChartData.chartData}
              modelBreakdown={modelChartData.modelBreakdown}
              size={500}
              width="auto"
              showLegend={true}
              showBreakdown={true}
              ariaLabel={t('adminUsage.charts.modelDistributionAriaLabel')}
            />
          ) : (
            <Content
              component={ContentVariants.small}
              style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
            >
              {t('adminUsage.charts.noDataAvailable')}
            </Content>
          )}
        </FullScreenChartModal>
      </GridItem>

      {/* Row 4 - Top Users Table */}
      <GridItem lg={6} md={12} sm={12}>
        <TopUsersTable
          topUsers={topUsers}
          loading={loading}
          onExpand={() => setIsTopUsersExpanded(true)}
        />

        {/* Full Screen Modal for Top Users */}
        <FullScreenChartModal
          isOpen={isTopUsersExpanded}
          onClose={() => setIsTopUsersExpanded(false)}
          title={t('adminUsage.charts.topUsers')}
        >
          <TopUsersTable topUsers={topUsers} loading={loading} />
        </FullScreenChartModal>
      </GridItem>
    </Grid>
  );
};

export default MetricsOverview;

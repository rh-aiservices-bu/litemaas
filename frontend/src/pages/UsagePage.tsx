import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  CardTitle,
  Grid,
  GridItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Button,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  Progress,
  ProgressMeasureLocation,
  Bullseye,
} from '@patternfly/react-core';
import {
  ChartLineIcon,
  DownloadIcon,
  FilterIcon,
  CalendarAltIcon,
  TrendUpIcon,
  TrendDownIcon,
  UsersIcon,
  CubeIcon,
  ClockIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useNotifications } from '../contexts/NotificationContext';
import { usageService, UsageMetrics, UsageFilters } from '../services/usage.service';

// Mock chart component since PatternFly charts require additional setup
const MockLineChart = ({ title }: { data: any[]; title: string }) => (
  <div
    style={{
      height: '200px',
      border: '1px solid var(--pf-v6-global--border--color)',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--pf-v6-global--background--color)',
    }}
  >
    <Content component={ContentVariants.p} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
      📊 {title} Chart
    </Content>
  </div>
);

const MockDonutChart = ({ title }: { data: any[]; title: string }) => (
  <div
    style={{
      height: '200px',
      border: '1px solid var(--pf-v6-global--border--color)',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--pf-v6-global--background--color)',
    }}
  >
    <Content component={ContentVariants.p} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
      🍩 {title} Chart
    </Content>
  </div>
);

const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('7d');
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [_startDate] = useState('');
  const [_endDate] = useState('');
  const [viewType, setViewType] = useState('overview');
  const [isViewTypeOpen, setIsViewTypeOpen] = useState(false);

  // Load usage metrics from API
  const loadUsageMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Convert dateRange to actual dates
      const filters: UsageFilters = {};
      const now = new Date();
      const days = parseInt(dateRange.replace('d', ''));

      if (!isNaN(days)) {
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - days);
        filters.startDate = startDate.toISOString().split('T')[0];
        filters.endDate = now.toISOString().split('T')[0];
      }

      const usageMetrics = await usageService.getUsageMetrics(filters);
      setMetrics(usageMetrics);
    } catch (err) {
      console.error('Failed to load usage metrics:', err);
      setError(t('pages.usage.notifications.loadFailed'));
      addNotification({
        title: t('pages.usage.notifications.loadError'),
        description: t('pages.usage.notifications.loadErrorDesc'),
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsageMetrics();
  }, [dateRange]);

  const handleExportData = async () => {
    try {
      addNotification({
        title: t('pages.usage.notifications.exportStarted'),
        description: t('pages.usage.notifications.exportStartedDesc'),
        variant: 'info',
      });

      // Convert dateRange to actual dates for export
      const filters: UsageFilters = {};
      const now = new Date();
      const days = parseInt(dateRange.replace('d', ''));

      if (!isNaN(days)) {
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - days);
        filters.startDate = startDate.toISOString().split('T')[0];
        filters.endDate = now.toISOString().split('T')[0];
      }

      const blob = await usageService.exportUsageData(filters, 'csv');

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `usage-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      addNotification({
        title: t('pages.usage.notifications.exportComplete'),
        description: t('pages.usage.notifications.exportCompleteDesc'),
        variant: 'success',
      });
    } catch (err) {
      console.error('Failed to export usage data:', err);
      addNotification({
        title: t('pages.usage.notifications.exportFailed'),
        description: t('pages.usage.notifications.exportFailedDesc'),
        variant: 'danger',
      });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getChangeIndicator = (current: number, previous: number, isPositive = true) => {
    const change = ((current - previous) / previous) * 100;
    const icon = change > 0 ? <TrendUpIcon /> : <TrendDownIcon />;
    const color =
      (change > 0 && isPositive) || (change < 0 && !isPositive)
        ? 'var(--pf-v6-global--success--color--100)'
        : 'var(--pf-v6-global--danger--color--100)';

    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
        <FlexItem style={{ color }}>{icon}</FlexItem>
        <FlexItem style={{ color }}>
          <Content component={ContentVariants.small}>{Math.abs(change).toFixed(1)}%</Content>
        </FlexItem>
      </Flex>
    );
  };

  if (loading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.usage.title')}
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                {t('pages.usage.loadingTitle')}
              </Title>
              <EmptyStateBody>{t('pages.usage.loadingDescription')}</EmptyStateBody>
            </EmptyState>
          </Bullseye>
        </PageSection>
      </>
    );
  }

  if (!metrics) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.usage.title')}
          </Title>
        </PageSection>
        <PageSection>
          <EmptyState variant={EmptyStateVariant.lg}>
            <ChartLineIcon />
            <Title headingLevel="h2" size="lg">
              {t('pages.usage.noDataTitle')}
            </Title>
            <EmptyStateBody>{t('pages.usage.noDataDescription')}</EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary">{t('pages.usage.viewApiDocs')}</Button>
            </EmptyStateActions>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <PageSection variant="secondary">
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              {t('pages.usage.title')}
            </Title>
            <Content component={ContentVariants.p}>{t('pages.usage.subtitle')}</Content>
          </FlexItem>
          <FlexItem>
            <Button variant="secondary" icon={<DownloadIcon />} onClick={handleExportData}>
              {t('pages.usage.exportData')}
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <Select
                id="date-range-select"
                isOpen={isDateRangeOpen}
                selected={dateRange}
                onSelect={(_event, value) => {
                  setDateRange(value as string);
                  setIsDateRangeOpen(false);
                }}
                onOpenChange={setIsDateRangeOpen}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setIsDateRangeOpen(!isDateRangeOpen)}>
                    <CalendarAltIcon />{' '}
                    {dateRange === '7d'
                      ? t('pages.usage.dateRanges.last7Days')
                      : dateRange === '30d'
                        ? t('pages.usage.dateRanges.last30Days')
                        : dateRange === '90d'
                          ? t('pages.usage.dateRanges.last90Days')
                          : t('pages.usage.filters.custom')}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  <SelectOption value="7d">{t('pages.usage.dateRanges.last7Days')}</SelectOption>
                  <SelectOption value="30d">{t('pages.usage.dateRanges.last30Days')}</SelectOption>
                  <SelectOption value="90d">{t('pages.usage.dateRanges.last90Days')}</SelectOption>
                  <SelectOption value="custom">
                    {t('pages.usage.dateRanges.customRange')}
                  </SelectOption>
                </SelectList>
              </Select>
            </ToolbarItem>

            <ToolbarItem>
              <Select
                id="view-type-select"
                isOpen={isViewTypeOpen}
                selected={viewType}
                onSelect={(_event, value) => {
                  setViewType(value as string);
                  setIsViewTypeOpen(false);
                }}
                onOpenChange={setIsViewTypeOpen}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setIsViewTypeOpen(!isViewTypeOpen)}>
                    <FilterIcon />{' '}
                    {viewType === 'overview'
                      ? t('pages.usage.filters.overview')
                      : viewType === 'models'
                        ? t('pages.usage.filters.byModels')
                        : viewType === 'time'
                          ? t('pages.usage.filters.timeAnalysis')
                          : t('pages.usage.filters.errors')}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  <SelectOption value="overview">{t('pages.usage.filters.overview')}</SelectOption>
                  <SelectOption value="models">{t('pages.usage.filters.byModels')}</SelectOption>
                  <SelectOption value="time">{t('pages.usage.filters.timeAnalysis')}</SelectOption>
                  <SelectOption value="errors">
                    {t('pages.usage.filters.errorAnalysis')}
                  </SelectOption>
                </SelectList>
              </Select>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {/* Key Metrics Overview */}
        <Grid hasGutter style={{ marginBottom: '2rem' }}>
          <GridItem lg={3} md={6} sm={12}>
            <Card>
              <CardBody>
                <Flex
                  justifyContent={{ default: 'justifyContentSpaceBetween' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <Flex direction={{ default: 'column' }}>
                      <FlexItem>
                        <Content
                          component={ContentVariants.small}
                          style={{ color: 'var(--pf-v6-global--Color--200)' }}
                        >
                          {t('pages.usage.metrics.totalRequests')}
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="xl">
                          {formatNumber(metrics.totalRequests)}
                        </Title>
                      </FlexItem>
                      <FlexItem>{getChangeIndicator(metrics.totalRequests, 108200, true)}</FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <CubeIcon
                      style={{
                        color: 'var(--pf-v6-global--primary--color--100)',
                        fontSize: '1.5rem',
                      }}
                    />
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={3} md={6} sm={12}>
            <Card>
              <CardBody>
                <Flex
                  justifyContent={{ default: 'justifyContentSpaceBetween' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <Flex direction={{ default: 'column' }}>
                      <FlexItem>
                        <Content
                          component={ContentVariants.small}
                          style={{ color: 'var(--pf-v6-global--Color--200)' }}
                        >
                          {t('pages.usage.metrics.totalTokens')}
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="xl">
                          {formatNumber(metrics.totalTokens)}
                        </Title>
                      </FlexItem>
                      <FlexItem>{getChangeIndicator(metrics.totalTokens, 7800000, true)}</FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <UsersIcon
                      style={{
                        color: 'var(--pf-v6-global--success--color--100)',
                        fontSize: '1.5rem',
                      }}
                    />
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={3} md={6} sm={12}>
            <Card>
              <CardBody>
                <Flex
                  justifyContent={{ default: 'justifyContentSpaceBetween' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <Flex direction={{ default: 'column' }}>
                      <FlexItem>
                        <Content
                          component={ContentVariants.small}
                          style={{ color: 'var(--pf-v6-global--Color--200)' }}
                        >
                          {t('pages.usage.metrics.totalCost')}
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="xl">
                          {formatCurrency(metrics.totalCost)}
                        </Title>
                      </FlexItem>
                      <FlexItem>{getChangeIndicator(metrics.totalCost, 1150.2, false)}</FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <ChartLineIcon
                      style={{
                        color: 'var(--pf-v6-global--warning--color--100)',
                        fontSize: '1.5rem',
                      }}
                    />
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem lg={3} md={6} sm={12}>
            <Card>
              <CardBody>
                <Flex
                  justifyContent={{ default: 'justifyContentSpaceBetween' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <Flex direction={{ default: 'column' }}>
                      <FlexItem>
                        <Content
                          component={ContentVariants.small}
                          style={{ color: 'var(--pf-v6-global--Color--200)' }}
                        >
                          {t('pages.usage.metrics.avgResponseTime')}
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="xl">
                          {metrics.averageResponseTime}s
                        </Title>
                      </FlexItem>
                      <FlexItem>{getChangeIndicator(1.2, 1.45, false)}</FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <ClockIcon
                      style={{ color: 'var(--pf-v6-global--info--color--100)', fontSize: '1.5rem' }}
                    />
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {viewType === 'overview' && (
          <>
            {/* Usage Trends */}
            <Grid hasGutter style={{ marginBottom: '2rem' }}>
              <GridItem lg={8}>
                <Card>
                  <CardTitle>
                    <Title headingLevel="h3" size="lg">
                      {t('pages.usage.charts.usageTrends')}
                    </Title>
                  </CardTitle>
                  <CardBody>
                    <MockLineChart
                      data={metrics.dailyUsage}
                      title={t('pages.usage.charts.dailyUsage')}
                    />
                  </CardBody>
                </Card>
              </GridItem>

              <GridItem lg={4}>
                <Card>
                  <CardTitle>
                    <Title headingLevel="h3" size="lg">
                      {t('pages.usage.metrics.successRate')}
                    </Title>
                  </CardTitle>
                  <CardBody>
                    <Flex
                      direction={{ default: 'column' }}
                      alignItems={{ default: 'alignItemsCenter' }}
                    >
                      <FlexItem>
                        <Title
                          headingLevel="h2"
                          size="3xl"
                          style={{ color: 'var(--pf-v6-global--success--color--100)' }}
                        >
                          {metrics.successRate}%
                        </Title>
                      </FlexItem>
                      <FlexItem>
                        <Progress
                          value={metrics.successRate}
                          variant="success"
                          measureLocation={ProgressMeasureLocation.none}
                          style={{ width: '200px' }}
                        />
                      </FlexItem>
                      <FlexItem>
                        <Content
                          component={ContentVariants.small}
                          style={{ color: 'var(--pf-v6-global--Color--200)' }}
                        >
                          {((metrics.totalRequests * metrics.successRate) / 100).toFixed(0)}{' '}
                          {t('pages.usage.metrics.successfulRequests')}
                        </Content>
                      </FlexItem>
                    </Flex>
                  </CardBody>
                </Card>
              </GridItem>
            </Grid>

            {/* Top Models */}
            <Card>
              <CardTitle>
                <Title headingLevel="h3" size="lg">
                  {t('pages.usage.charts.topModelsByUsage')}
                </Title>
              </CardTitle>
              <CardBody>
                <Table aria-label={t('pages.usage.tables.topModels')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th>{t('pages.usage.tableHeaders.model')}</Th>
                      <Th>{t('pages.usage.tableHeaders.requests')}</Th>
                      <Th>{t('pages.usage.tableHeaders.tokens')}</Th>
                      <Th>{t('pages.usage.tableHeaders.cost')}</Th>
                      <Th>{t('pages.usage.tableHeaders.usagePercent')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {metrics.topModels.map((model, index) => {
                      const usagePercentage = (model.requests / metrics.totalRequests) * 100;
                      return (
                        <Tr key={index}>
                          <Td>
                            <strong>{model.name}</strong>
                          </Td>
                          <Td>{formatNumber(model.requests)}</Td>
                          <Td>{formatNumber(model.tokens)}</Td>
                          <Td>{formatCurrency(model.cost)}</Td>
                          <Td>
                            <Flex
                              alignItems={{ default: 'alignItemsCenter' }}
                              spaceItems={{ default: 'spaceItemsSm' }}
                            >
                              <FlexItem style={{ minWidth: '60px' }}>
                                <Progress
                                  value={usagePercentage}
                                  measureLocation={ProgressMeasureLocation.none}
                                  variant={
                                    usagePercentage > 30
                                      ? 'success'
                                      : usagePercentage > 15
                                        ? 'warning'
                                        : undefined
                                  }
                                />
                              </FlexItem>
                              <FlexItem>
                                <Content component={ContentVariants.small}>
                                  {usagePercentage.toFixed(1)}%
                                </Content>
                              </FlexItem>
                            </Flex>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </>
        )}

        {viewType === 'models' && (
          <Card>
            <CardTitle>
              <Title headingLevel="h3" size="lg">
                {t('pages.usage.charts.usageByModel')}
              </Title>
            </CardTitle>
            <CardBody>
              <MockDonutChart
                data={metrics.topModels}
                title={t('pages.usage.charts.modelUsageDistribution')}
              />
            </CardBody>
          </Card>
        )}

        {viewType === 'time' && (
          <Card>
            <CardTitle>
              <Title headingLevel="h3" size="lg">
                {t('pages.usage.charts.hourlyUsagePattern')}
              </Title>
            </CardTitle>
            <CardBody>
              <MockLineChart
                data={metrics.hourlyUsage}
                title={t('pages.usage.charts.hourlyRequests')}
              />
            </CardBody>
          </Card>
        )}

        {viewType === 'errors' && (
          <Grid hasGutter>
            <GridItem lg={6}>
              <Card>
                <CardTitle>
                  <Title headingLevel="h3" size="lg">
                    {t('pages.usage.charts.errorBreakdown')}
                  </Title>
                </CardTitle>
                <CardBody>
                  <MockDonutChart
                    data={metrics.errorBreakdown}
                    title={t('pages.usage.charts.errorTypes')}
                  />
                </CardBody>
              </Card>
            </GridItem>

            <GridItem lg={6}>
              <Card>
                <CardTitle>
                  <Title headingLevel="h3" size="lg">
                    {t('pages.usage.charts.errorDetails')}
                  </Title>
                </CardTitle>
                <CardBody>
                  <Table aria-label={t('pages.usage.tables.errorBreakdown')} variant="compact">
                    <Thead>
                      <Tr>
                        <Th>{t('pages.usage.tableHeaders.errorType')}</Th>
                        <Th>{t('pages.usage.tableHeaders.count')}</Th>
                        <Th>{t('pages.usage.tableHeaders.percentage')}</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {metrics.errorBreakdown.map((error, index) => (
                        <Tr key={index}>
                          <Td>
                            <strong>{error.type}</strong>
                          </Td>
                          <Td>{error.count}</Td>
                          <Td>
                            <Flex
                              alignItems={{ default: 'alignItemsCenter' }}
                              spaceItems={{ default: 'spaceItemsSm' }}
                            >
                              <FlexItem style={{ minWidth: '60px' }}>
                                <Progress
                                  value={error.percentage}
                                  measureLocation={ProgressMeasureLocation.none}
                                  variant="warning"
                                />
                              </FlexItem>
                              <FlexItem>
                                <Content component={ContentVariants.small}>
                                  {error.percentage}%
                                </Content>
                              </FlexItem>
                            </Flex>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        )}
      </PageSection>
    </>
  );
};

export default UsagePage;

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
  DatePicker,
  FormGroup,
} from '@patternfly/react-core';
import {
  ChartLineIcon,
  DownloadIcon,
  FilterIcon,
  CalendarAltIcon,
  UsersIcon,
  CubeIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useNotifications } from '../contexts/NotificationContext';
import { usageService, UsageMetrics, UsageFilters } from '../services/usage.service';
import { apiKeysService, ApiKey } from '../services/apiKeys.service';
import { WorkingLineChart, ModelDistributionChart } from '../components/charts';
import {
  transformDailyUsageToChartData,
  transformModelBreakdownToChartData,
} from '../utils/chartDataTransformers';
import { maskApiKey } from '../utils/security.utils';

const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('7d');
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDatePickers, setShowCustomDatePickers] = useState(false);
  const [viewType, setViewType] = useState('overview');
  const [isViewTypeOpen, setIsViewTypeOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'requests' | 'tokens' | 'cost'>('requests');
  const [isMetricSelectOpen, setIsMetricSelectOpen] = useState(false);

  // API Key states
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);

  // Load API keys
  const loadApiKeys = async () => {
    try {
      setLoadingApiKeys(true);
      const response = await apiKeysService.getApiKeys();
      setApiKeys(response.data);

      // Auto-select first API key if available
      if (response.data.length > 0 && !selectedApiKey) {
        setSelectedApiKey(response.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
      addNotification({
        title: t('pages.usage.notifications.apiKeysLoadError'),
        description: t('pages.usage.notifications.apiKeysLoadErrorDesc'),
        variant: 'danger',
      });
    } finally {
      setLoadingApiKeys(false);
    }
  };

  // Load usage metrics from API
  const loadUsageMetrics = async () => {
    // Don't load metrics if no API key is selected
    if (!selectedApiKey) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Convert dateRange to actual dates
      const filters: UsageFilters = {
        apiKeyId: selectedApiKey, // Filter by selected API key
      };

      if (dateRange === 'custom') {
        // Use custom date range from date pickers
        if (customStartDate && customEndDate) {
          filters.startDate = customStartDate;
          filters.endDate = customEndDate;
        } else {
          // Don't make API call if custom dates are not set
          setMetrics(null);
          setLoading(false);
          return;
        }
      } else {
        // Use predefined date ranges
        const now = new Date();
        const days = parseInt(dateRange.replace('d', ''));

        if (!isNaN(days)) {
          const startDate = new Date(now);
          startDate.setDate(startDate.getDate() - days);
          filters.startDate = startDate.toISOString().split('T')[0];
          filters.endDate = now.toISOString().split('T')[0];
        }
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

  // Load API keys on component mount
  useEffect(() => {
    loadApiKeys();
  }, []);

  // Reload metrics when API key, date range, or custom dates change
  useEffect(() => {
    if (selectedApiKey) {
      // For custom date range, only load metrics when both dates are selected
      if (dateRange === 'custom') {
        if (customStartDate && customEndDate) {
          loadUsageMetrics();
        }
      } else {
        // For predefined ranges, load immediately
        loadUsageMetrics();
      }
    }
  }, [selectedApiKey, dateRange, customStartDate, customEndDate]);

  const handleExportData = async () => {
    try {
      addNotification({
        title: t('pages.usage.notifications.exportStarted'),
        description: t('pages.usage.notifications.exportStartedDesc'),
        variant: 'info',
      });

      // Convert dateRange to actual dates for export
      const filters: UsageFilters = {
        apiKeyId: selectedApiKey, // Include selected API key in export
      };

      if (dateRange === 'custom') {
        // Use custom date range from date pickers
        if (customStartDate && customEndDate) {
          filters.startDate = customStartDate;
          filters.endDate = customEndDate;
        } else {
          // Show error if custom dates are not set
          addNotification({
            title: t('pages.usage.notifications.exportFailed'),
            description: t('pages.usage.notifications.customDatesRequired'),
            variant: 'danger',
          });
          return;
        }
      } else {
        // Use predefined date ranges
        const now = new Date();
        const days = parseInt(dateRange.replace('d', ''));

        if (!isNaN(days)) {
          const startDate = new Date(now);
          startDate.setDate(startDate.getDate() - days);
          filters.startDate = startDate.toISOString().split('T')[0];
          filters.endDate = now.toISOString().split('T')[0];
        }
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

  if (!selectedApiKey && !loadingApiKeys) {
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
              {apiKeys.length === 0
                ? t('pages.usage.noApiKeysTitle')
                : t('pages.usage.selectApiKeyTitle')}
            </Title>
            <EmptyStateBody>
              {apiKeys.length === 0
                ? t('pages.usage.noApiKeysDescription')
                : t('pages.usage.selectApiKeyDescription')}
            </EmptyStateBody>
            <EmptyStateActions>
              {apiKeys.length === 0 ? (
                <Button variant="primary" component="a" href="/api-keys">
                  {t('pages.usage.createApiKey')}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setIsApiKeyOpen(true)}>
                  {t('pages.usage.selectApiKey')}
                </Button>
              )}
            </EmptyStateActions>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  // Don't show "No usage data available" when we're waiting for custom date selection
  if (!metrics && !(dateRange === 'custom' && showCustomDatePickers)) {
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
                id="api-key-select"
                isOpen={isApiKeyOpen}
                selected={selectedApiKey}
                onSelect={(_event, value) => {
                  setSelectedApiKey(value as string);
                  setIsApiKeyOpen(false);
                }}
                onOpenChange={setIsApiKeyOpen}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsApiKeyOpen(!isApiKeyOpen)}
                    isDisabled={loadingApiKeys || apiKeys.length === 0}
                  >
                    {loadingApiKeys
                      ? t('pages.usage.loadingApiKeys')
                      : apiKeys.length === 0
                        ? t('pages.usage.noApiKeys')
                        : selectedApiKey
                          ? `${apiKeys.find((key) => key.id === selectedApiKey)?.name || 'Unknown'} (${maskApiKey(apiKeys.find((key) => key.id === selectedApiKey)?.keyPreview || '')})`
                          : t('pages.usage.selectApiKey')}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {apiKeys.map((apiKey) => (
                    <SelectOption key={apiKey.id} value={apiKey.id}>
                      {apiKey.name} ({maskApiKey(apiKey.keyPreview || '')})
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </ToolbarItem>

            <ToolbarItem>
              <Select
                id="date-range-select"
                isOpen={isDateRangeOpen}
                selected={dateRange}
                onSelect={(_event, value) => {
                  const selectedValue = value as string;
                  setDateRange(selectedValue);
                  setIsDateRangeOpen(false);

                  if (selectedValue === 'custom') {
                    setShowCustomDatePickers(true);
                  } else {
                    setShowCustomDatePickers(false);
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }
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

            {showCustomDatePickers && (
              <>
                <ToolbarItem>
                  <FormGroup fieldId="custom-start-date">
                    <DatePicker
                      id="custom-start-date"
                      value={customStartDate}
                      onChange={(_event, value) => setCustomStartDate(value)}
                      placeholder={t('pages.usage.filters.selectStartDate')}
                      aria-label={t('pages.usage.filters.startDate')}
                    />
                  </FormGroup>
                </ToolbarItem>
                <ToolbarItem>
                  <FormGroup fieldId="custom-end-date">
                    <DatePicker
                      id="custom-end-date"
                      value={customEndDate}
                      onChange={(_event, value) => setCustomEndDate(value)}
                      placeholder={t('pages.usage.filters.selectEndDate')}
                      aria-label={t('pages.usage.filters.endDate')}
                    />
                  </FormGroup>
                </ToolbarItem>
              </>
            )}

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
                        : t('pages.usage.filters.overview')}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  <SelectOption value="overview">{t('pages.usage.filters.overview')}</SelectOption>
                  <SelectOption value="models">{t('pages.usage.filters.byModels')}</SelectOption>
                </SelectList>
              </Select>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {/* Show placeholder when in custom mode but no dates selected */}
        {dateRange === 'custom' && showCustomDatePickers && !metrics && (
          <Card style={{ marginBottom: '2rem' }}>
            <CardBody>
              <EmptyState variant={EmptyStateVariant.sm}>
                <CalendarAltIcon />
                <Title headingLevel="h3" size="md">
                  {t('pages.usage.customDatePlaceholderTitle')}
                </Title>
                <EmptyStateBody>{t('pages.usage.customDatePlaceholderDescription')}</EmptyStateBody>
              </EmptyState>
            </CardBody>
          </Card>
        )}

        {/* Key Metrics Overview - only show when we have metrics */}
        {metrics && (
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
          </Grid>
        )}

        {/* Chart sections - only show when we have metrics */}
        {metrics && viewType === 'overview' && (
          <>
            {/* Usage Trends */}
            <Grid hasGutter style={{ marginBottom: '2rem' }}>
              <GridItem lg={8}>
                <Card>
                  <CardTitle>
                    <Flex
                      justifyContent={{ default: 'justifyContentSpaceBetween' }}
                      alignItems={{ default: 'alignItemsCenter' }}
                    >
                      <FlexItem>
                        <Title headingLevel="h3" size="lg">
                          {t('pages.usage.charts.usageTrends')}
                        </Title>
                      </FlexItem>
                      <FlexItem>
                        <Select
                          id="metric-select"
                          isOpen={isMetricSelectOpen}
                          selected={selectedMetric}
                          onSelect={(_event, value) => {
                            setSelectedMetric(value as 'requests' | 'tokens' | 'cost');
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
                                ? t('pages.usage.metrics.totalRequests')
                                : selectedMetric === 'tokens'
                                  ? t('pages.usage.metrics.totalTokens')
                                  : t('pages.usage.metrics.totalCost')}
                            </MenuToggle>
                          )}
                        >
                          <SelectList>
                            <SelectOption value="requests">
                              {t('pages.usage.metrics.totalRequests')}
                            </SelectOption>
                            <SelectOption value="tokens">
                              {t('pages.usage.metrics.totalTokens')}
                            </SelectOption>
                            <SelectOption value="cost">
                              {t('pages.usage.metrics.totalCost')}
                            </SelectOption>
                          </SelectList>
                        </Select>
                      </FlexItem>
                    </Flex>
                  </CardTitle>
                  <CardBody>
                    <WorkingLineChart
                      data={transformDailyUsageToChartData(metrics.dailyUsage)[selectedMetric]}
                      metricType={selectedMetric}
                      height={250}
                      loading={false}
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
                          aria-label="successRate"
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
                                  aria-label="usagePercentage"
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

        {metrics && viewType === 'models' && (
          <Card>
            <CardTitle>
              <Title headingLevel="h3" size="lg">
                {t('pages.usage.charts.usageByModel')}
              </Title>
            </CardTitle>
            <CardBody>
              {(() => {
                const transformedData = transformModelBreakdownToChartData(
                  metrics.topModels,
                  metrics.totalRequests,
                );
                return (
                  <ModelDistributionChart
                    data={transformedData.chartData}
                    modelBreakdown={transformedData.modelBreakdown}
                    size={300}
                    width="auto"
                    showLegend={true}
                    showBreakdown={true}
                    ariaLabel={t('pages.usage.charts.modelUsageDistribution')}
                  />
                );
              })()}
            </CardBody>
          </Card>
        )}
      </PageSection>
    </>
  );
};

export default UsagePage;

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
import { Table, Thead, Tbody, Tr, Th, Td, Caption } from '@patternfly/react-table';
import { useNotifications } from '../contexts/NotificationContext';
import { usageService, UsageMetrics, UsageFilters } from '../services/usage.service';
import { apiKeysService, ApiKey } from '../services/apiKeys.service';
import { UsageTrends, ModelDistributionChart } from '../components/charts';
import {
  transformDailyUsageToChartData,
  transformModelBreakdownToChartData,
} from '../utils/chartDataTransformers';
import { maskApiKey } from '../utils/security.utils';
import {
  ScreenReaderAnnouncement,
  useScreenReaderAnnouncement,
} from '../components/ScreenReaderAnnouncement';

const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const { announcement, announce } = useScreenReaderAnnouncement();

  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(false);
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

      // Announce metrics update to screen readers
      announce(
        t('pages.usage.metricsUpdated', {
          requests: formatNumber(usageMetrics.totalRequests),
          tokens: formatNumber(usageMetrics.totalTokens),
          cost: formatCurrency(usageMetrics.totalCost),
        }),
        'polite',
      );
    } catch (err) {
      console.error('Failed to load usage metrics:', err);
      setError(t('pages.usage.notifications.loadFailed'));
      // Announce error to screen readers with assertive priority
      announce(t('pages.usage.notifications.loadFailed'), 'assertive');
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
        <ScreenReaderAnnouncement
          message={t('pages.usage.loadingDescription')}
          priority="polite"
          announcementKey={loading ? 1 : 0}
        />
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.usage.title')}
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" aria-busy="true" />
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
          <EmptyState
            variant={EmptyStateVariant.lg}
            role="region"
            aria-labelledby="no-api-keys-title"
            aria-describedby="no-api-keys-description"
          >
            <ChartLineIcon aria-hidden="true" />
            <Title headingLevel="h2" size="lg" id="no-api-keys-title">
              {apiKeys.length === 0
                ? t('pages.usage.noApiKeysTitle')
                : t('pages.usage.selectApiKeyTitle')}
            </Title>
            <EmptyStateBody id="no-api-keys-description">
              {apiKeys.length === 0
                ? t('pages.usage.noApiKeysDescription')
                : t('pages.usage.selectApiKeyDescription')}
              <div className="pf-v6-screen-reader" aria-live="polite">
                {apiKeys.length === 0
                  ? t('pages.usage.noApiKeysScreenReader')
                  : t('pages.usage.selectApiKeyScreenReader')}
              </div>
            </EmptyStateBody>
            <EmptyStateActions>
              {apiKeys.length === 0 ? (
                <Button
                  variant="primary"
                  component="a"
                  href="/api-keys"
                  aria-describedby="no-api-keys-description"
                >
                  {t('pages.usage.createApiKey')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setIsApiKeyOpen(true)}
                  aria-describedby="no-api-keys-description"
                >
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
          <EmptyState
            variant={EmptyStateVariant.lg}
            role="region"
            aria-labelledby="no-data-title"
            aria-describedby="no-data-description"
          >
            <ChartLineIcon aria-hidden="true" />
            <Title headingLevel="h2" size="lg" id="no-data-title">
              {t('pages.usage.noDataTitle')}
            </Title>
            <EmptyStateBody id="no-data-description">
              {t('pages.usage.noDataDescription')}
              <div className="pf-v6-screen-reader" aria-live="polite">
                {t('pages.usage.noDataScreenReader')}
              </div>
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" aria-describedby="no-data-description">
                {t('pages.usage.viewApiDocs')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <ScreenReaderAnnouncement
        message={announcement.message}
        priority={announcement.priority}
        announcementKey={announcement.key}
      />
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
            <Button
              variant="secondary"
              icon={<DownloadIcon />}
              onClick={handleExportData}
              aria-label={t('pages.usage.exportUsageData')}
            >
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
              <EmptyState
                variant={EmptyStateVariant.sm}
                role="status"
                aria-labelledby="custom-date-title"
                aria-describedby="custom-date-description"
              >
                <CalendarAltIcon aria-hidden="true" />
                <Title headingLevel="h3" size="md" id="custom-date-title">
                  {t('pages.usage.customDatePlaceholderTitle')}
                </Title>
                <EmptyStateBody id="custom-date-description">
                  {t('pages.usage.customDatePlaceholderDescription')}
                  <div className="pf-v6-screen-reader" aria-live="polite">
                    {t('pages.usage.customDatePlaceholderScreenReader')}
                  </div>
                </EmptyStateBody>
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
                    <div
                      role="region"
                      aria-labelledby="usage-trends-heading"
                      aria-describedby="usage-trends-description"
                    >
                      <div id="usage-trends-heading" className="pf-v6-screen-reader">
                        {t('pages.usage.charts.usageTrends')} -{' '}
                        {t('pages.usage.charts.lineChartAriaLabel', {
                          metric:
                            selectedMetric === 'requests'
                              ? t('pages.usage.metrics.totalRequests')
                              : selectedMetric === 'tokens'
                                ? t('pages.usage.metrics.totalTokens')
                                : t('pages.usage.metrics.totalCost'),
                        })}
                      </div>
                      <div id="usage-trends-description" className="pf-v6-screen-reader">
                        {t('pages.usage.charts.usageTrendsDescription', {
                          metricType:
                            selectedMetric === 'requests'
                              ? t('pages.usage.metrics.totalRequests')
                              : selectedMetric === 'tokens'
                                ? t('pages.usage.metrics.totalTokens')
                                : t('pages.usage.metrics.totalCost'),
                        })}
                      </div>
                      <UsageTrends
                        data={transformDailyUsageToChartData(metrics.dailyUsage)[selectedMetric]}
                        metricType={selectedMetric}
                        height={250}
                        loading={false}
                        title={t('pages.usage.charts.usageTrends')}
                        description={t('pages.usage.charts.usageTrendsDescription', {
                          metricType:
                            selectedMetric === 'requests'
                              ? t('pages.usage.metrics.totalRequests')
                              : selectedMetric === 'tokens'
                                ? t('pages.usage.metrics.totalTokens')
                                : t('pages.usage.metrics.totalCost'),
                        })}
                      />
                    </div>
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
                          aria-label={t('pages.usage.progressLabels.successRateProgress', {
                            percentage: metrics.successRate,
                            successfulRequests: (
                              (metrics.totalRequests * metrics.successRate) /
                              100
                            ).toFixed(0),
                            totalRequests: metrics.totalRequests,
                          })}
                          title={t('pages.usage.progressLabels.successRateTitle', {
                            percentage: metrics.successRate,
                          })}
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
                  <Caption className="pf-v6-screen-reader">
                    {t('pages.usage.tables.topModelsCaption', {
                      count: metrics.topModels.length,
                      totalRequests: formatNumber(metrics.totalRequests),
                      dateRange:
                        dateRange === 'custom'
                          ? `${customStartDate} to ${customEndDate}`
                          : dateRange === '7d'
                            ? t('pages.usage.dateRanges.last7Days')
                            : dateRange === '30d'
                              ? t('pages.usage.dateRanges.last30Days')
                              : t('pages.usage.dateRanges.last90Days'),
                    })}
                  </Caption>
                  <Thead>
                    <Tr>
                      <Th scope="col">{t('pages.usage.tableHeaders.model')}</Th>
                      <Th scope="col" modifier="nowrap">
                        {t('pages.usage.tableHeaders.requests')}
                      </Th>
                      <Th scope="col" modifier="nowrap">
                        {t('pages.usage.tableHeaders.tokens')}
                      </Th>
                      <Th scope="col" modifier="nowrap">
                        {t('pages.usage.tableHeaders.cost')}
                      </Th>
                      <Th scope="col" modifier="nowrap">
                        {t('pages.usage.tableHeaders.usagePercent')}
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {metrics.topModels.map((model, index) => {
                      const usagePercentage = (model.requests / metrics.totalRequests) * 100;
                      return (
                        <Tr key={index}>
                          <Th scope="row">
                            <strong>{model.name}</strong>
                          </Th>
                          <Td>
                            <span
                              aria-label={t('pages.usage.ariaLabels.requestsCount', {
                                count: model.requests,
                                formatted: formatNumber(model.requests),
                              })}
                            >
                              {formatNumber(model.requests)}
                            </span>
                          </Td>
                          <Td>
                            <span
                              aria-label={t('pages.usage.ariaLabels.tokensCount', {
                                count: model.tokens,
                                formatted: formatNumber(model.tokens),
                              })}
                            >
                              {formatNumber(model.tokens)}
                            </span>
                          </Td>
                          <Td>
                            <span
                              aria-label={t('pages.usage.ariaLabels.costAmount', {
                                amount: model.cost,
                                formatted: formatCurrency(model.cost),
                              })}
                            >
                              {formatCurrency(model.cost)}
                            </span>
                          </Td>
                          <Td>
                            <Flex
                              alignItems={{ default: 'alignItemsCenter' }}
                              spaceItems={{ default: 'spaceItemsSm' }}
                            >
                              <FlexItem style={{ minWidth: '60px' }}>
                                <Progress
                                  value={usagePercentage}
                                  measureLocation={ProgressMeasureLocation.none}
                                  aria-label={t('pages.usage.progressLabels.modelUsageProgress', {
                                    model: model.name,
                                    percentage: usagePercentage.toFixed(1),
                                    requests: formatNumber(model.requests),
                                    totalRequests: formatNumber(metrics.totalRequests),
                                  })}
                                  title={t('pages.usage.progressLabels.modelUsageTitle', {
                                    model: model.name,
                                    percentage: usagePercentage.toFixed(1),
                                  })}
                                />
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
              <div
                role="region"
                aria-labelledby="model-distribution-heading"
                aria-describedby="model-distribution-description"
              >
                <div id="model-distribution-heading" className="pf-v6-screen-reader">
                  {t('pages.usage.charts.usageByModel')} -{' '}
                  {t('pages.usage.charts.modelDistributionAriaLabel')}
                </div>
                <div id="model-distribution-description" className="pf-v6-screen-reader">
                  {t('pages.usage.charts.donutChartDescription')}.{' '}
                  {t('pages.usage.charts.modelDistributionSummary', {
                    totalModels: metrics.topModels.length,
                    topModel: metrics.topModels[0]?.name || t('common.notAvailable'),
                    topPercentage: metrics.topModels[0]
                      ? ((metrics.topModels[0].requests / metrics.totalRequests) * 100).toFixed(1)
                      : '0',
                    totalRequests: formatNumber(metrics.totalRequests),
                  })}
                </div>
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
              </div>
            </CardBody>
          </Card>
        )}
      </PageSection>
    </>
  );
};

export default UsagePage;

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
  DatePicker,
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
  ClockIcon
} from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useNotifications } from '../contexts/NotificationContext';
import { usageService, UsageMetrics, UsageFilters } from '../services/usage.service';

// Mock chart component since PatternFly charts require additional setup
const MockLineChart = ({ data, title }: { data: any[], title: string }) => (
  <div style={{ 
    height: '200px', 
    border: '1px solid var(--pf-v6-global--border--color)', 
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--pf-v6-global--background--color)'
  }}>
    <Content component={ContentVariants.p} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
      📊 {title} Chart
    </Content>
  </div>
);

const MockDonutChart = ({ data, title }: { data: any[], title: string }) => (
  <div style={{ 
    height: '200px', 
    border: '1px solid var(--pf-v6-global--border--color)', 
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--pf-v6-global--background--color)'
  }}>
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
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('7d');
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
      setError('Failed to load usage metrics. Please try again.');
      addNotification({
        title: 'Error',
        description: 'Failed to load usage metrics from the server.',
        variant: 'danger'
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
        title: 'Export Started',
        description: 'Your usage data export is being prepared and will be downloaded shortly.',
        variant: 'info'
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
        title: 'Export Complete',
        description: 'Usage data has been exported successfully.',
        variant: 'success'
      });
    } catch (err) {
      console.error('Failed to export usage data:', err);
      addNotification({
        title: 'Export Failed',
        description: 'Failed to export usage data. Please try again.',
        variant: 'danger'
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
      currency: 'USD'
    }).format(amount);
  };

  const getChangeIndicator = (current: number, previous: number, isPositive = true) => {
    const change = ((current - previous) / previous) * 100;
    const icon = change > 0 ? <TrendUpIcon /> : <TrendDownIcon />;
    const color = (change > 0 && isPositive) || (change < 0 && !isPositive) 
      ? 'var(--pf-v6-global--success--color--100)' 
      : 'var(--pf-v6-global--danger--color--100)';
    
    return (
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
        <FlexItem style={{ color }}>{icon}</FlexItem>
        <FlexItem style={{ color }}>
          <Content component={ContentVariants.small}>
            {Math.abs(change).toFixed(1)}%
          </Content>
        </FlexItem>
      </Flex>
    );
  };

  if (loading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            Usage Dashboard
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                Loading Usage Data...
              </Title>
              <EmptyStateBody>
                Analyzing your API usage patterns and metrics
              </EmptyStateBody>
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
            Usage Dashboard
          </Title>
        </PageSection>
        <PageSection>
          <EmptyState variant={EmptyStateVariant.lg}>
            <ChartLineIcon />
            <Title headingLevel="h2" size="lg">
              No usage data available
            </Title>
            <EmptyStateBody>
              Start making API requests to see your usage statistics here.
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary">
                View API Documentation
              </Button>
            </EmptyStateActions>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <PageSection variant="secondary">
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              Usage Dashboard
            </Title>
            <Content component={ContentVariants.p}>
              Monitor your API usage, costs, and performance metrics
            </Content>
          </FlexItem>
          <FlexItem>
            <Button variant="secondary" icon={<DownloadIcon />} onClick={handleExportData}>
              Export Data
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
                    <CalendarAltIcon /> {dateRange === '7d' ? 'Last 7 days' : 
                                          dateRange === '30d' ? 'Last 30 days' :
                                          dateRange === '90d' ? 'Last 90 days' : 'Custom'}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  <SelectOption value="7d">Last 7 days</SelectOption>
                  <SelectOption value="30d">Last 30 days</SelectOption>
                  <SelectOption value="90d">Last 90 days</SelectOption>
                  <SelectOption value="custom">Custom range</SelectOption>
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
                    <FilterIcon /> {viewType === 'overview' ? 'Overview' :
                                    viewType === 'models' ? 'By Models' :
                                    viewType === 'time' ? 'Time Analysis' : 'Errors'}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  <SelectOption value="overview">Overview</SelectOption>
                  <SelectOption value="models">By Models</SelectOption>
                  <SelectOption value="time">Time Analysis</SelectOption>
                  <SelectOption value="errors">Error Analysis</SelectOption>
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
                <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Flex direction={{ default: 'column' }}>
                      <FlexItem>
                        <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                          Total Requests
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="xl">
                          {formatNumber(metrics.totalRequests)}
                        </Title>
                      </FlexItem>
                      <FlexItem>
                        {getChangeIndicator(metrics.totalRequests, 108200, true)}
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <CubeIcon size="lg" style={{ color: 'var(--pf-v6-global--primary--color--100)' }} />
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem lg={3} md={6} sm={12}>
            <Card>
              <CardBody>
                <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Flex direction={{ default: 'column' }}>
                      <FlexItem>
                        <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                          Total Tokens
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="xl">
                          {formatNumber(metrics.totalTokens)}
                        </Title>
                      </FlexItem>
                      <FlexItem>
                        {getChangeIndicator(metrics.totalTokens, 7800000, true)}
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <UsersIcon size="lg" style={{ color: 'var(--pf-v6-global--success--color--100)' }} />
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem lg={3} md={6} sm={12}>
            <Card>
              <CardBody>
                <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Flex direction={{ default: 'column' }}>
                      <FlexItem>
                        <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                          Total Cost
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="xl">
                          {formatCurrency(metrics.totalCost)}
                        </Title>
                      </FlexItem>
                      <FlexItem>
                        {getChangeIndicator(metrics.totalCost, 1150.20, false)}
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <ChartLineIcon size="lg" style={{ color: 'var(--pf-v6-global--warning--color--100)' }} />
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
          
          <GridItem lg={3} md={6} sm={12}>
            <Card>
              <CardBody>
                <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Flex direction={{ default: 'column' }}>
                      <FlexItem>
                        <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                          Avg Response Time
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="xl">
                          {metrics.averageResponseTime}s
                        </Title>
                      </FlexItem>
                      <FlexItem>
                        {getChangeIndicator(1.2, 1.45, false)}
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <ClockIcon size="lg" style={{ color: 'var(--pf-v6-global--info--color--100)' }} />
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
                    <Title headingLevel="h3" size="lg">Usage Trends</Title>
                  </CardTitle>
                  <CardBody>
                    <MockLineChart data={metrics.dailyUsage} title="Daily Usage" />
                  </CardBody>
                </Card>
              </GridItem>
              
              <GridItem lg={4}>
                <Card>
                  <CardTitle>
                    <Title headingLevel="h3" size="lg">Success Rate</Title>
                  </CardTitle>
                  <CardBody>
                    <Flex direction={{ default: 'column' }} alignItems={{ default: 'alignItemsCenter' }}>
                      <FlexItem>
                        <Title headingLevel="h2" size="3xl" style={{ color: 'var(--pf-v6-global--success--color--100)' }}>
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
                        <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                          {(metrics.totalRequests * metrics.successRate / 100).toFixed(0)} successful requests
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
                <Title headingLevel="h3" size="lg">Top Models by Usage</Title>
              </CardTitle>
              <CardBody>
                <Table aria-label="Top models table" variant="compact">
                  <Thead>
                    <Tr>
                      <Th>Model</Th>
                      <Th>Requests</Th>
                      <Th>Tokens</Th>
                      <Th>Cost</Th>
                      <Th>Usage %</Th>
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
                            <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                              <FlexItem style={{ minWidth: '60px' }}>
                                <Progress
                                  value={usagePercentage}
                                  measureLocation={ProgressMeasureLocation.none}
                                  variant={usagePercentage > 30 ? 'success' : usagePercentage > 15 ? 'warning' : undefined}
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
              <Title headingLevel="h3" size="lg">Usage by Model</Title>
            </CardTitle>
            <CardBody>
              <MockDonutChart data={metrics.topModels} title="Model Usage Distribution" />
            </CardBody>
          </Card>
        )}

        {viewType === 'time' && (
          <Card>
            <CardTitle>
              <Title headingLevel="h3" size="lg">Hourly Usage Pattern</Title>
            </CardTitle>
            <CardBody>
              <MockLineChart data={metrics.hourlyUsage} title="Hourly Requests" />
            </CardBody>
          </Card>
        )}

        {viewType === 'errors' && (
          <Grid hasGutter>
            <GridItem lg={6}>
              <Card>
                <CardTitle>
                  <Title headingLevel="h3" size="lg">Error Breakdown</Title>
                </CardTitle>
                <CardBody>
                  <MockDonutChart data={metrics.errorBreakdown} title="Error Types" />
                </CardBody>
              </Card>
            </GridItem>
            
            <GridItem lg={6}>
              <Card>
                <CardTitle>
                  <Title headingLevel="h3" size="lg">Error Details</Title>
                </CardTitle>
                <CardBody>
                  <Table aria-label="Error breakdown table" variant="compact">
                    <Thead>
                      <Tr>
                        <Th>Error Type</Th>
                        <Th>Count</Th>
                        <Th>Percentage</Th>
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
                            <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
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

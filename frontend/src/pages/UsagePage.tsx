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

interface UsageMetrics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  successRate: number;
  activeModels: number;
  topModels: Array<{
    name: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  dailyUsage: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  hourlyUsage: Array<{
    hour: string;
    requests: number;
  }>;
  errorBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewType, setViewType] = useState('overview');
  const [isViewTypeOpen, setIsViewTypeOpen] = useState(false);

  // Mock data - replace with actual API call
  useEffect(() => {
    const mockMetrics: UsageMetrics = {
      totalRequests: 125430,
      totalTokens: 8950000,
      totalCost: 1247.50,
      averageResponseTime: 1.2,
      successRate: 99.2,
      activeModels: 8,
      topModels: [
        { name: 'GPT-4', requests: 45200, tokens: 3200000, cost: 485.20 },
        { name: 'Claude 3 Opus', requests: 38100, tokens: 2800000, cost: 320.15 },
        { name: 'GPT-3.5 Turbo', requests: 25600, tokens: 1850000, cost: 185.40 },
        { name: 'Llama 2 70B', requests: 12300, tokens: 890000, cost: 125.30 },
        { name: 'DALL-E 3', requests: 4230, tokens: 210000, cost: 131.45 }
      ],
      dailyUsage: [
        { date: '2024-06-17', requests: 15200, tokens: 1100000, cost: 145.60 },
        { date: '2024-06-18', requests: 18500, tokens: 1320000, cost: 175.20 },
        { date: '2024-06-19', requests: 17800, tokens: 1280000, cost: 168.40 },
        { date: '2024-06-20', requests: 19200, tokens: 1400000, cost: 185.80 },
        { date: '2024-06-21', requests: 16900, tokens: 1220000, cost: 162.30 },
        { date: '2024-06-22', requests: 20100, tokens: 1450000, cost: 192.70 },
        { date: '2024-06-23', requests: 17730, tokens: 1180000, cost: 157.50 }
      ],
      hourlyUsage: [
        { hour: '00:00', requests: 450 },
        { hour: '01:00', requests: 320 },
        { hour: '02:00', requests: 280 },
        { hour: '03:00', requests: 220 },
        { hour: '04:00', requests: 190 },
        { hour: '05:00', requests: 240 },
        { hour: '06:00', requests: 380 },
        { hour: '07:00', requests: 520 },
        { hour: '08:00', requests: 680 },
        { hour: '09:00', requests: 890 },
        { hour: '10:00', requests: 1200 },
        { hour: '11:00', requests: 1350 },
        { hour: '12:00', requests: 1280 },
        { hour: '13:00', requests: 1420 },
        { hour: '14:00', requests: 1380 },
        { hour: '15:00', requests: 1250 },
        { hour: '16:00', requests: 1100 },
        { hour: '17:00', requests: 980 },
        { hour: '18:00', requests: 720 },
        { hour: '19:00', requests: 580 },
        { hour: '20:00', requests: 420 },
        { hour: '21:00', requests: 380 },
        { hour: '22:00', requests: 340 },
        { hour: '23:00', requests: 290 }
      ],
      errorBreakdown: [
        { type: 'Rate Limited', count: 45, percentage: 45 },
        { type: 'Invalid Request', count: 32, percentage: 32 },
        { type: 'Server Error', count: 18, percentage: 18 },
        { type: 'Timeout', count: 5, percentage: 5 }
      ]
    };

    setTimeout(() => {
      setMetrics(mockMetrics);
      setLoading(false);
    }, 1500);
  }, [dateRange]);

  const handleExportData = () => {
    addNotification({
      title: 'Export Started',
      description: 'Your usage data export is being prepared and will be downloaded shortly.',
      variant: 'info'
    });
    
    // Simulate export
    setTimeout(() => {
      addNotification({
        title: 'Export Complete',
        description: 'Usage data has been exported successfully.',
        variant: 'success'
      });
    }, 2000);
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

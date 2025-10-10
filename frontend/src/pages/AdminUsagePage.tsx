import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import { format, differenceInDays } from 'date-fns';
import {
  PageSection,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Button,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Alert,
  AlertVariant,
} from '@patternfly/react-core';
import { DownloadIcon, SyncAltIcon } from '@patternfly/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useConfig, useAdminAnalyticsConfig } from '../contexts/ConfigContext';
import { useErrorHandler } from '../hooks/useErrorHandler';
import {
  adminUsageService,
  transformAnalyticsForComponent,
  type AdminUsageFilters,
} from '../services/adminUsage.service';
import { MetricsOverview } from '../components/admin';
import {
  ScreenReaderAnnouncement,
  useScreenReaderAnnouncement,
} from '../components/ScreenReaderAnnouncement';
import {
  ExportModal,
  DateRangeFilter,
  ModelFilterSelect,
  type DatePreset,
} from '../components/usage';
import { UserFilterSelect } from '../components/admin/UserFilterSelect';
import { ApiKeyFilterSelect } from '../components/admin/ApiKeyFilterSelect';

/**
 * Main admin usage analytics page component
 * Provides global usage visibility across all users and models
 */
const AdminUsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const { config: backendConfig } = useConfig();
  const analyticsConfig = useAdminAnalyticsConfig();
  const { handleError } = useErrorHandler();
  const { announcement, announce } = useScreenReaderAnnouncement();

  // State management
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [isDatePresetOpen, setIsDatePresetOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedApiKeyIds, setSelectedApiKeyIds] = useState<string[]>([]);
  const [apiKeyFilterAnnouncement, setApiKeyFilterAnnouncement] = useState<string>('');

  // Calculate date range based on preset
  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    const now = new Date();
    let startDate: Date;

    switch (datePreset) {
      case '1d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 0); // Today only (1 day inclusive)
        break;
      case '7d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // 7 days inclusive
        break;
      case '30d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29); // 30 days inclusive
        break;
      case '90d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 89); // 90 days inclusive
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            startDate: customStartDate,
            endDate: customEndDate,
          };
        }
        // Fallback to last 7 days if custom dates not set
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // 7 days inclusive
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // 7 days inclusive
    }

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(now, 'yyyy-MM-dd'),
    };
  }, [datePreset, customStartDate, customEndDate]);

  const filters: AdminUsageFilters = {
    ...getDateRange(),
    ...(selectedModelIds.length > 0 && { modelIds: selectedModelIds }),
    ...(selectedUserIds.length > 0 && { userIds: selectedUserIds }),
    ...(selectedApiKeyIds.length > 0 && { apiKeyIds: selectedApiKeyIds }),
  };

  // Data fetching with React Query
  // Use dynamic staleTime from backend config (defaults to 5 minutes if config not loaded)
  const staleTimeMs = backendConfig?.usageCacheTtlMinutes
    ? backendConfig.usageCacheTtlMinutes * 60 * 1000
    : 5 * 60 * 1000;

  const {
    data: metricsData,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery(['adminMetrics', filters], () => adminUsageService.getAnalytics(filters), {
    staleTime: staleTimeMs, // Dynamic TTL from backend config
    refetchOnWindowFocus: false,
    enabled: !!filters.startDate && !!filters.endDate,
    onError: (error) => {
      handleError(error, {
        fallbackMessageKey: 'adminUsage.errors.fetchMetrics',
      });
    },
    select: (data) => transformAnalyticsForComponent(data),
  });

  // Permission check
  const canViewAdminUsage =
    currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('admin-readonly');
  const canRefreshData = currentUser?.roles?.includes('admin') ?? false; // Only full admins can refresh

  if (!canViewAdminUsage) {
    return (
      <PageSection>
        <Alert
          variant={AlertVariant.danger}
          title={t('adminUsage.accessDenied', 'Access Denied')}
          aria-live="polite"
        >
          {t(
            'adminUsage.requiresAdmin',
            'You do not have permission to view admin usage analytics.',
          )}
        </Alert>
      </PageSection>
    );
  }

  // Handlers
  const handleExport = () => {
    setIsExportModalOpen(true);
  };

  const handleRefreshToday = async () => {
    try {
      setIsRefreshing(true);
      announce(t('adminUsage.refreshing', "Refreshing today's data..."));
      await adminUsageService.refreshTodayData();

      // Refetch metrics data
      await refetchMetrics();

      addNotification({
        title: t('adminUsage.refreshSuccess', 'Refresh successful'),
        description: t('adminUsage.todayDataRefreshed', "Today's usage data has been refreshed."),
        variant: 'success',
      });
      announce(t('adminUsage.todayDataRefreshed', "Today's usage data has been refreshed."));
    } catch (error) {
      handleError(error, {
        fallbackMessageKey: 'adminUsage.errors.refresh',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleModelFilterChange = (modelIds: string[]) => {
    setSelectedModelIds(modelIds);
    announce(
      t('adminUsage.modelFilterChanged', 'Filtering by {{count}} model(s)', {
        count: modelIds.length,
      }),
    );
  };

  const handleUserFilterChange = (userIds: string[]) => {
    setSelectedUserIds(userIds);
    announce(
      t('adminUsage.userFilterChanged', 'Filtering by {{count}} user(s)', {
        count: userIds.length,
      }),
    );

    // Cascading filter logic for API keys
    if (userIds.length === 0) {
      // No users selected - clear all API key selections
      if (selectedApiKeyIds.length > 0) {
        setSelectedApiKeyIds([]);
        const message = t(
          'adminUsage.apiKeysCleared',
          'API key filter disabled - select users first',
        );
        setApiKeyFilterAnnouncement(message);
        // Clear announcement after 5 seconds
        setTimeout(() => setApiKeyFilterAnnouncement(''), 5000);
      }
    } else {
      // Users selected - filter out API keys not belonging to selected users
      // This will be handled by the ApiKeyFilterSelect component via its React Query refetch
      // We only need to clear invalid selections if any exist
      if (selectedApiKeyIds.length > 0) {
        // Note: We can't determine which API keys belong to which users without the full data
        // The ApiKeyFilterSelect component will handle this via its React Query refetch
        // For now, we'll announce that the filter may need adjustment
        const message = t(
          'adminUsage.apiKeysFilterAdjusted',
          'API key filter may have changed - please review selections',
        );
        setApiKeyFilterAnnouncement(message);
        setTimeout(() => setApiKeyFilterAnnouncement(''), 5000);
      } else {
        // Announce that API key filter is now available
        const message = t('adminUsage.apiKeysFilterAvailable', 'API key filter is now available');
        setApiKeyFilterAnnouncement(message);
        setTimeout(() => setApiKeyFilterAnnouncement(''), 5000);
      }
    }
  };

  /**
   * Validate and set custom date range
   * Shows warning/error before making API call
   */
  const handleCustomStartDateChange = (start: string) => {
    // If we don't have an end date yet, just set the start date
    if (!customEndDate) {
      setCustomStartDate(start);
      return;
    }

    const startDate = new Date(start);
    const endDate = new Date(customEndDate);

    // Check date order
    if (startDate > endDate) {
      addNotification({
        variant: 'danger',
        title: t('adminUsage.errors.invalidDateOrder.title', 'Invalid Date Range'),
        description: t(
          'adminUsage.errors.invalidDateOrder.description',
          'Start date must be before end date.',
        ),
      });
      return;
    }

    // Calculate range
    const days = differenceInDays(endDate, startDate) + 1;

    // Check if exceeds maximum
    if (days > analyticsConfig.dateRangeLimits.maxAnalyticsDays) {
      addNotification({
        variant: 'danger',
        title: t('adminUsage.errors.dateRangeTooLarge.title', 'Date Range Too Large'),
        description: t(
          'adminUsage.errors.dateRangeTooLarge.description',
          `Maximum date range is ${analyticsConfig.dateRangeLimits.maxAnalyticsDays} days. You selected ${days} days. Please select a smaller range.`,
        ),
      });
      return;
    }

    // Show warning for large ranges
    if (days > analyticsConfig.warnings.largeDateRangeDays) {
      addNotification({
        variant: 'warning',
        title: t('adminUsage.warnings.largeRange.title', 'Large Date Range'),
        description: t(
          'adminUsage.warnings.largeRange.description',
          `You've selected ${days} days of data. This may take longer to load.`,
        ),
      });
    }

    // Valid - update state
    setCustomStartDate(start);
  };

  const handleCustomEndDateChange = (end: string) => {
    // If we don't have a start date yet, just set the end date
    if (!customStartDate) {
      setCustomEndDate(end);
      return;
    }

    const startDate = new Date(customStartDate);
    const endDate = new Date(end);

    // Check date order
    if (startDate > endDate) {
      addNotification({
        variant: 'danger',
        title: t('adminUsage.errors.invalidDateOrder.title', 'Invalid Date Range'),
        description: t(
          'adminUsage.errors.invalidDateOrder.description',
          'Start date must be before end date.',
        ),
      });
      return;
    }

    // Calculate range
    const days = differenceInDays(endDate, startDate) + 1;

    // Check if exceeds maximum
    if (days > analyticsConfig.dateRangeLimits.maxAnalyticsDays) {
      addNotification({
        variant: 'danger',
        title: t('adminUsage.errors.dateRangeTooLarge.title', 'Date Range Too Large'),
        description: t(
          'adminUsage.errors.dateRangeTooLarge.description',
          `Maximum date range is ${analyticsConfig.dateRangeLimits.maxAnalyticsDays} days. You selected ${days} days. Please select a smaller range.`,
        ),
      });
      return;
    }

    // Show warning for large ranges
    if (days > analyticsConfig.warnings.largeDateRangeDays) {
      addNotification({
        variant: 'warning',
        title: t('adminUsage.warnings.largeRange.title', 'Large Date Range'),
        description: t(
          'adminUsage.warnings.largeRange.description',
          `You've selected ${days} days of data. This may take longer to load.`,
        ),
      });
    }

    // Valid - update state
    setCustomEndDate(end);
  };

  return (
    <>
      <PageSection variant="secondary">
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              {t('adminUsage.title', 'Admin Usage Analytics')}
            </Title>
            <Content component={ContentVariants.small}>
              {t(
                'adminUsage.subtitle',
                'View and analyze usage across all users, models, and providers',
              )}
            </Content>
          </FlexItem>
          <FlexItem>
            <Flex spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Button
                  variant="secondary"
                  icon={<SyncAltIcon />}
                  onClick={handleRefreshToday}
                  isLoading={isRefreshing}
                  isDisabled={isRefreshing || !canRefreshData}
                  aria-label={t('adminUsage.refreshToday', "Refresh today's data")}
                >
                  {t('adminUsage.refreshToday', 'Refresh Today')}
                </Button>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="primary"
                  icon={<DownloadIcon />}
                  onClick={handleExport}
                  aria-label={t('adminUsage.export', 'Export usage data')}
                >
                  {t('adminUsage.export', 'Export')}
                </Button>
              </FlexItem>
            </Flex>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        <Toolbar id="admin-usage-toolbar">
          <ToolbarContent>
            <DateRangeFilter
              datePreset={datePreset}
              onPresetChange={(preset) => {
                setDatePreset(preset);
                announce(
                  t('adminUsage.dateRangeChanged', 'Date range changed to {{preset}}', { preset }),
                );
              }}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onStartDateChange={handleCustomStartDateChange}
              onEndDateChange={handleCustomEndDateChange}
              isOpen={isDatePresetOpen}
              onOpenChange={setIsDatePresetOpen}
            />

            <ToolbarItem>
              <ModelFilterSelect
                selected={selectedModelIds}
                onSelect={handleModelFilterChange}
                dateRange={{ startDate: filters.startDate, endDate: filters.endDate }}
              />
            </ToolbarItem>

            <ToolbarItem>
              <UserFilterSelect
                selected={selectedUserIds}
                onSelect={handleUserFilterChange}
                dateRange={{ startDate: filters.startDate, endDate: filters.endDate }}
              />
            </ToolbarItem>

            <ToolbarItem>
              <ApiKeyFilterSelect
                selected={selectedApiKeyIds}
                onSelect={setSelectedApiKeyIds}
                selectedUserIds={selectedUserIds}
                isDisabled={selectedUserIds.length === 0}
              />
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {/* ARIA live region for API key filter announcements */}
        {apiKeyFilterAnnouncement && (
          <div role="status" aria-live="polite" className="pf-v6-screen-reader">
            {apiKeyFilterAnnouncement}
          </div>
        )}

        <MetricsOverview data={metricsData} loading={metricsLoading} />
      </PageSection>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        filters={filters}
      />

      {announcement.message && (
        <ScreenReaderAnnouncement
          message={announcement.message}
          priority={announcement.priority}
          announcementKey={announcement.key}
        />
      )}
    </>
  );
};

export default AdminUsagePage;

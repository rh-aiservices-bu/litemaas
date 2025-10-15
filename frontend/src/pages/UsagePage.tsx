import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
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
} from '@patternfly/react-core';
import { DownloadIcon } from '@patternfly/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { useErrorHandler } from '../hooks/useErrorHandler';
import {
  usageService,
  transformAnalyticsForComponent,
  type UserUsageFilters,
} from '../services/usage.service';
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
import { ApiKeyFilterSelect } from '../components/admin/ApiKeyFilterSelect';

/**
 * User usage analytics page component
 * Provides comprehensive usage visibility for the current user across all their API keys and models
 */
const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { handleError } = useErrorHandler();
  const { announcement, announce } = useScreenReaderAnnouncement();

  // State management
  const [datePreset, setDatePreset] = useState<DatePreset>('7d');
  const [isDatePresetOpen, setIsDatePresetOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedApiKeyIds, setSelectedApiKeyIds] = useState<string[]>([]);

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

  const filters: UserUsageFilters = {
    ...getDateRange(),
    ...(selectedModelIds.length > 0 && { modelIds: selectedModelIds }),
    ...(selectedApiKeyIds.length > 0 && { apiKeyIds: selectedApiKeyIds }),
  };

  // Data fetching with React Query
  const { data: metricsData, isLoading: metricsLoading } = useQuery(
    ['userMetrics', filters],
    () => usageService.getAnalytics(filters),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      enabled: !!filters.startDate && !!filters.endDate,
      onError: (error) => {
        handleError(error, {
          fallbackMessageKey: 'usage.errors.fetchMetrics',
        });
      },
      select: (data) => transformAnalyticsForComponent(data),
    },
  );

  // Handlers
  const handleExport = () => {
    setIsExportModalOpen(true);
  };

  const handleModelFilterChange = (modelIds: string[]) => {
    setSelectedModelIds(modelIds);
    announce(
      t('usage.modelFilterChanged', 'Filtering by {{count}} model(s)', {
        count: modelIds.length,
      }),
    );
  };

  const handleApiKeyFilterChange = (apiKeyIds: string[]) => {
    setSelectedApiKeyIds(apiKeyIds);
    announce(
      t('usage.apiKeyFilterChanged', 'Filtering by {{count}} API key(s)', {
        count: apiKeyIds.length,
      }),
    );
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
              {t('pages.usage.title', 'Usage Analytics')}
            </Title>
            <Content component={ContentVariants.small}>
              {t(
                'pages.usage.subtitle',
                'View and analyze your usage across all API keys and models',
              )}
            </Content>
          </FlexItem>
          <FlexItem>
            <Button
              variant="primary"
              icon={<DownloadIcon />}
              onClick={handleExport}
              aria-label={t('pages.usage.export', 'Export usage data')}
            >
              {t('pages.usage.export', 'Export')}
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        <Toolbar id="usage-toolbar">
          <ToolbarContent>
            <DateRangeFilter
              datePreset={datePreset}
              onPresetChange={(preset) => {
                setDatePreset(preset);
                announce(
                  t('usage.dateRangeChanged', 'Date range changed to {{preset}}', { preset }),
                );
              }}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onStartDateChange={setCustomStartDate}
              onEndDateChange={setCustomEndDate}
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
              <ApiKeyFilterSelect
                selected={selectedApiKeyIds}
                onSelect={handleApiKeyFilterChange}
                selectedUserIds={currentUser?.id ? [currentUser.id] : []}
                isDisabled={false}
              />
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        <MetricsOverview data={metricsData} loading={metricsLoading} />
      </PageSection>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        filters={filters}
        isUserExport={true}
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

export default UsagePage;

import React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, ThProps } from '@patternfly/react-table';
import {
  Pagination,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Title,
  Label,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import { useQuery } from 'react-query';
import { useTranslation } from 'react-i18next';
import { adminUsageService } from '../../services/adminUsage.service';
import { usePagination } from '../../hooks/usePagination';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import type { AdminUsageFilters } from '../../services/adminUsage.service';
import { formatNumber, formatCurrency, formatPercentage } from '../../utils/formatters';
import { PER_PAGE_OPTIONS } from '../../services/adminUsage.service';

interface ProviderBreakdownTableProps {
  filters: AdminUsageFilters;
}

export const ProviderBreakdownTable: React.FC<ProviderBreakdownTableProps> = ({ filters }) => {
  const { t } = useTranslation();
  const { handleError } = useErrorHandler();

  // Pagination state
  const pagination = usePagination({
    initialSortBy: 'metrics.tokens.total',
    initialSortOrder: 'desc',
  });

  // Fetch data with pagination
  const { data: response, isLoading } = useQuery(
    ['providerBreakdown', filters, pagination.paginationParams],
    () =>
      adminUsageService.getProviderBreakdown(filters, {
        page: pagination.page,
        limit: pagination.perPage,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
      }),
    {
      onError: (err) => handleError(err),
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000,
    },
  );

  // Reset pagination when filters change
  React.useEffect(() => {
    pagination.reset();
  }, [filters]); // pagination.reset is stable

  // Sort handler for table headers
  const handleSort = (columnKey: string) => {
    const newSortOrder =
      pagination.sortBy === columnKey && pagination.sortOrder === 'asc' ? 'desc' : 'asc';
    pagination.setSort(columnKey, newSortOrder);
  };

  // Get sort direction for column
  const getSortParams = (columnKey: string): ThProps['sort'] => {
    return {
      sortBy:
        pagination.sortBy === columnKey
          ? {
              index: 0,
              direction: pagination.sortOrder,
            }
          : {},
      onSort: () => handleSort(columnKey),
      columnIndex: 0,
    };
  };

  /**
   * Get success rate badge with color coding
   * @param successRate - Success rate percentage (0-100)
   * @returns Label element with appropriate color
   */
  const getSuccessRateBadge = (successRate: number) => {
    let color: 'green' | 'orange' | 'red' = 'green';
    let ariaLabel = t('admin.usage.tables.providers.successRate.high');

    if (successRate < 90) {
      color = 'red';
      ariaLabel = t('admin.usage.tables.providers.successRate.low');
    } else if (successRate < 95) {
      color = 'orange';
      ariaLabel = t('admin.usage.tables.providers.successRate.medium');
    }

    return (
      <Label color={color} aria-label={ariaLabel}>
        {formatPercentage(successRate)}
      </Label>
    );
  };

  if (isLoading && !response) {
    return <div className="pf-v6-u-text-align-center pf-v6-u-p-lg">{t('common.loading')}</div>;
  }

  if (!response || response.data.length === 0) {
    return (
      <EmptyState variant={EmptyStateVariant.sm}>
        <SearchIcon />
        <Title headingLevel="h4" size="lg">
          {t('adminUsage.providerBreakdown.noData', 'No provider data available')}
        </Title>
        <EmptyStateBody>
          {t(
            'adminUsage.providerBreakdown.noDataDescription',
            'No usage data found for the selected date range and filters.',
          )}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const { data: providers, pagination: paginationMetadata } = response;

  return (
    <>
      <Pagination
        itemCount={paginationMetadata.total}
        page={pagination.page}
        perPage={pagination.perPage}
        onSetPage={pagination.setPage}
        onPerPageSelect={pagination.setPerPage}
        variant="top"
        perPageOptions={PER_PAGE_OPTIONS.map((opt) => opt)}
        titles={{
          paginationAriaLabel: t('adminUsage.pagination.label', 'Provider breakdown pagination'),
        }}
      />

      <Table aria-label={t('adminUsage.providerBreakdown.tableLabel', 'Provider breakdown table')}>
        <Thead>
          <Tr>
            <Th sort={getSortParams('provider')}>
              {t('adminUsage.providerBreakdown.providerName', 'Provider')}
            </Th>
            <Th sort={getSortParams('metrics.requests')}>
              {t('adminUsage.providerBreakdown.totalRequests', 'Requests')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.total')}>
              {t('adminUsage.providerBreakdown.totalTokens', 'Total Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.input')}>
              {t('adminUsage.providerBreakdown.promptTokens', 'Prompt Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.output')}>
              {t('adminUsage.providerBreakdown.completionTokens', 'Completion Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.cost')}>
              {t('adminUsage.providerBreakdown.totalCost', 'Total Cost')}
            </Th>
            <Th sort={getSortParams('metrics.successRate')}>
              {t('adminUsage.providerBreakdown.successRate', 'Success Rate')}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {providers.map((provider) => (
            <Tr key={provider.provider}>
              <Td dataLabel={t('adminUsage.providerBreakdown.providerName', 'Provider')}>
                <strong>{provider.provider}</strong>
              </Td>
              <Td dataLabel={t('adminUsage.providerBreakdown.totalRequests', 'Requests')}>
                {formatNumber(provider.metrics.requests)}
              </Td>
              <Td dataLabel={t('adminUsage.providerBreakdown.totalTokens', 'Total Tokens')}>
                {formatNumber(provider.metrics.tokens.total)}
              </Td>
              <Td dataLabel={t('adminUsage.providerBreakdown.promptTokens', 'Prompt Tokens')}>
                {formatNumber(provider.metrics.tokens.input)}
              </Td>
              <Td
                dataLabel={t('adminUsage.providerBreakdown.completionTokens', 'Completion Tokens')}
              >
                {formatNumber(provider.metrics.tokens.output)}
              </Td>
              <Td dataLabel={t('adminUsage.providerBreakdown.totalCost', 'Total Cost')}>
                {formatCurrency(provider.metrics.cost)}
              </Td>
              <Td dataLabel={t('adminUsage.providerBreakdown.successRate', 'Success Rate')}>
                {getSuccessRateBadge(provider.metrics.successRate)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Pagination
        itemCount={paginationMetadata.total}
        page={pagination.page}
        perPage={pagination.perPage}
        onSetPage={pagination.setPage}
        onPerPageSelect={pagination.setPerPage}
        variant="bottom"
        perPageOptions={PER_PAGE_OPTIONS.map((opt) => opt)}
        titles={{
          paginationAriaLabel: t('adminUsage.pagination.label', 'Provider breakdown pagination'),
        }}
      />
    </>
  );
};

export default ProviderBreakdownTable;

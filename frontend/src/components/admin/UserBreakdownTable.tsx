import React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, ThProps } from '@patternfly/react-table';
import {
  Pagination,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import { useQuery } from 'react-query';
import { useTranslation } from 'react-i18next';
import { adminUsageService } from '../../services/adminUsage.service';
import { usePagination } from '../../hooks/usePagination';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import type { AdminUsageFilters } from '../../services/adminUsage.service';
import { formatNumber, formatCurrency } from '../../utils/formatters';
import { PER_PAGE_OPTIONS } from '../../services/adminUsage.service';

interface UserBreakdownTableProps {
  filters: AdminUsageFilters;
}

export const UserBreakdownTable: React.FC<UserBreakdownTableProps> = ({ filters }) => {
  const { t } = useTranslation();
  const { handleError } = useErrorHandler();

  // Pagination state
  const pagination = usePagination({
    initialSortBy: 'totalTokens',
    initialSortOrder: 'desc',
  });

  // Fetch data with pagination
  const { data: response, isLoading } = useQuery(
    ['userBreakdown', filters, pagination.paginationParams],
    () =>
      adminUsageService.getUserBreakdown(filters, {
        page: pagination.page,
        limit: pagination.perPage,
        sortBy: `metrics.tokens.total`, // Map to backend field structure
        sortOrder: pagination.sortOrder,
      }),
    {
      onError: (err) => handleError(err),
      keepPreviousData: true, // Keep previous page data while loading next page
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // Reset pagination when filters change
  React.useEffect(() => {
    pagination.reset();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (isLoading && !response) {
    return (
      <div className="pf-v6-u-text-align-center pf-v6-u-p-lg">
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  if (!response || response.data.length === 0) {
    return (
      <EmptyState variant={EmptyStateVariant.sm}>
        <SearchIcon />
        <Title headingLevel="h4" size="lg">
          {t('adminUsage.userBreakdown.noData', 'No user data available')}
        </Title>
        <EmptyStateBody>
          {t(
            'adminUsage.userBreakdown.noDataDescription',
            'No usage data found for the selected date range and filters.',
          )}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const { data: users, pagination: paginationMetadata } = response;

  return (
    <>
      {/* Top Pagination */}
      <Pagination
        itemCount={paginationMetadata.total}
        page={pagination.page}
        perPage={pagination.perPage}
        onSetPage={pagination.setPage}
        onPerPageSelect={pagination.setPerPage}
        variant="top"
        perPageOptions={PER_PAGE_OPTIONS.map((opt) => opt)}
        titles={{
          paginationAriaLabel: t('adminUsage.pagination.label', 'User breakdown pagination'),
        }}
      />

      {/* Table */}
      <Table aria-label={t('adminUsage.userBreakdown.tableLabel', 'User breakdown table')}>
        <Thead>
          <Tr>
            <Th sort={getSortParams('username')}>
              {t('adminUsage.userBreakdown.username', 'Username')}
            </Th>
            <Th>{t('adminUsage.userBreakdown.email', 'Email')}</Th>
            <Th sort={getSortParams('metrics.requests')}>
              {t('adminUsage.userBreakdown.totalRequests', 'Requests')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.total')}>
              {t('adminUsage.userBreakdown.totalTokens', 'Total Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.input')}>
              {t('adminUsage.userBreakdown.promptTokens', 'Prompt Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.output')}>
              {t('adminUsage.userBreakdown.completionTokens', 'Completion Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.cost')}>
              {t('adminUsage.userBreakdown.totalCost', 'Total Cost')}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {users.map((user) => (
            <Tr key={user.userId}>
              <Td dataLabel={t('adminUsage.userBreakdown.username', 'Username')}>
                {user.username}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.email', 'Email')}>{user.email || '-'}</Td>
              <Td dataLabel={t('adminUsage.userBreakdown.totalRequests', 'Requests')}>
                {formatNumber(user.metrics.requests)}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.totalTokens', 'Total Tokens')}>
                {formatNumber(user.metrics.tokens.total)}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.promptTokens', 'Prompt Tokens')}>
                {formatNumber(user.metrics.tokens.input)}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.completionTokens', 'Completion Tokens')}>
                {formatNumber(user.metrics.tokens.output)}
              </Td>
              <Td dataLabel={t('adminUsage.userBreakdown.totalCost', 'Total Cost')}>
                {formatCurrency(user.metrics.cost)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Bottom Pagination */}
      <Pagination
        itemCount={paginationMetadata.total}
        page={pagination.page}
        perPage={pagination.perPage}
        onSetPage={pagination.setPage}
        onPerPageSelect={pagination.setPerPage}
        variant="bottom"
        perPageOptions={PER_PAGE_OPTIONS.map((opt) => opt)}
        titles={{
          paginationAriaLabel: t('adminUsage.pagination.label', 'User breakdown pagination'),
        }}
      />
    </>
  );
};

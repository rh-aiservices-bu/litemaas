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

interface ModelBreakdownTableProps {
  filters: AdminUsageFilters;
}

export const ModelBreakdownTable: React.FC<ModelBreakdownTableProps> = ({ filters }) => {
  const { t } = useTranslation();
  const { handleError } = useErrorHandler();

  // Pagination state
  const pagination = usePagination({
    initialSortBy: 'metrics.tokens.total',
    initialSortOrder: 'desc',
  });

  // Fetch data with pagination
  const { data: response, isLoading } = useQuery(
    ['modelBreakdown', filters, pagination.paginationParams],
    () =>
      adminUsageService.getModelBreakdown(filters, {
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
    return <div className="pf-v6-u-text-align-center pf-v6-u-p-lg">{t('common.loading')}</div>;
  }

  if (!response || response.data.length === 0) {
    return (
      <EmptyState variant={EmptyStateVariant.sm}>
        <SearchIcon />
        <Title headingLevel="h4" size="lg">
          {t('adminUsage.modelBreakdown.noData', 'No model data available')}
        </Title>
        <EmptyStateBody>
          {t(
            'adminUsage.modelBreakdown.noDataDescription',
            'No usage data found for the selected date range and filters.',
          )}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const { data: models, pagination: paginationMetadata } = response;

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
          paginationAriaLabel: t('adminUsage.pagination.label', 'Model breakdown pagination'),
        }}
      />

      <Table aria-label={t('adminUsage.modelBreakdown.tableLabel', 'Model breakdown table')}>
        <Thead>
          <Tr>
            <Th sort={getSortParams('modelName')}>
              {t('adminUsage.modelBreakdown.modelName', 'Model')}
            </Th>
            <Th sort={getSortParams('metrics.requests')}>
              {t('adminUsage.modelBreakdown.totalRequests', 'Requests')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.total')}>
              {t('adminUsage.modelBreakdown.totalTokens', 'Total Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.input')}>
              {t('adminUsage.modelBreakdown.promptTokens', 'Prompt Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.tokens.output')}>
              {t('adminUsage.modelBreakdown.completionTokens', 'Completion Tokens')}
            </Th>
            <Th sort={getSortParams('metrics.cost')}>
              {t('adminUsage.modelBreakdown.totalCost', 'Total Cost')}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {models.map((model, index) => (
            <Tr key={`${model.modelId}-${index}`}>
              <Td dataLabel={t('adminUsage.modelBreakdown.modelName', 'Model')}>
                {model.modelName}
              </Td>
              <Td dataLabel={t('adminUsage.modelBreakdown.totalRequests', 'Requests')}>
                {formatNumber(model.metrics.requests)}
              </Td>
              <Td dataLabel={t('adminUsage.modelBreakdown.totalTokens', 'Total Tokens')}>
                {formatNumber(model.metrics.tokens.total)}
              </Td>
              <Td dataLabel={t('adminUsage.modelBreakdown.promptTokens', 'Prompt Tokens')}>
                {formatNumber(model.metrics.tokens.input)}
              </Td>
              <Td dataLabel={t('adminUsage.modelBreakdown.completionTokens', 'Completion Tokens')}>
                {formatNumber(model.metrics.tokens.output)}
              </Td>
              <Td dataLabel={t('adminUsage.modelBreakdown.totalCost', 'Total Cost')}>
                {formatCurrency(model.metrics.cost)}
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
          paginationAriaLabel: t('adminUsage.pagination.label', 'Model breakdown pagination'),
        }}
      />
    </>
  );
};

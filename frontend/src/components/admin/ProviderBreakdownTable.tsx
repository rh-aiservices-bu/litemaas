import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Thead, Tbody, Tr, Th, Td, ThProps } from '@patternfly/react-table';
import {
  Pagination,
  PaginationVariant,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Title,
  Skeleton,
  Badge,
} from '@patternfly/react-core';
import { CloudIcon } from '@patternfly/react-icons';
import type { ProviderBreakdown } from '../../services/adminUsage.service';
import { formatNumber, formatCurrency, formatPercentage } from '../../utils/formatters';

/**
 * Props for ProviderBreakdownTable component
 */
interface ProviderBreakdownTableProps {
  /** Provider breakdown data to display */
  data: ProviderBreakdown[];
  /** Whether data is currently loading */
  loading: boolean;
}

/**
 * Sortable column identifiers
 */
type SortableColumn = 'provider' | 'requests' | 'tokens' | 'cost' | 'models' | 'successRate';

/**
 * ProviderBreakdownTable Component
 *
 * Displays a sortable, paginated table of provider usage breakdowns with:
 * - Provider name
 * - Usage metrics (requests, tokens, cost)
 * - Resource counts (models, users)
 * - Performance metrics (success rate)
 * - Client-side sorting and pagination
 * - Number formatting with abbreviations (1K, 1M)
 * - Currency formatting
 * - Percentage formatting
 * - Color-coded success rates (green >95%, yellow 90-95%, red <90%)
 * - Empty state and loading skeleton
 * - WCAG AA accessibility compliance
 */
const ProviderBreakdownTable: React.FC<ProviderBreakdownTableProps> = ({ data, loading }) => {
  const { t } = useTranslation();

  // Sorting state
  const [activeSortIndex, setActiveSortIndex] = useState<number>(1); // Default: requests column
  const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  /**
   * Get success rate badge with color coding
   * @param successRate - Success rate percentage (0-100)
   * @returns Badge element with appropriate color
   */
  const getSuccessRateBadge = (successRate: number) => {
    let color: 'green' | 'gold' | 'red' = 'green';
    let ariaLabel = t('admin.usage.tables.providers.successRate.high');

    if (successRate < 90) {
      color = 'red';
      ariaLabel = t('admin.usage.tables.providers.successRate.low');
    } else if (successRate < 95) {
      color = 'gold';
      ariaLabel = t('admin.usage.tables.providers.successRate.medium');
    }

    return (
      <Badge color={color} aria-label={ariaLabel}>
        {formatPercentage(successRate)}
      </Badge>
    );
  };

  /**
   * Get sort function for a column
   */
  const getSortFunction = (_column: SortableColumn) => {
    return (a: ProviderBreakdown, b: ProviderBreakdown): number => {
      let aValue: string | number;
      let bValue: string | number;

      switch (_column) {
        case 'provider':
          aValue = a.provider.toLowerCase();
          bValue = b.provider.toLowerCase();
          break;
        case 'requests':
          aValue = a.metrics.requests;
          bValue = b.metrics.requests;
          break;
        case 'tokens':
          aValue = a.metrics.tokens.total;
          bValue = b.metrics.tokens.total;
          break;
        case 'cost':
          aValue = a.metrics.cost;
          bValue = b.metrics.cost;
          break;
        case 'models':
          aValue = a.metrics.models;
          bValue = b.metrics.models;
          break;
        case 'successRate':
          aValue = a.metrics.successRate;
          bValue = b.metrics.successRate;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return activeSortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return activeSortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    };
  };

  /**
   * Handle column header click for sorting
   */
  const handleSort = (columnIndex: number, _column: SortableColumn) => {
    if (activeSortIndex === columnIndex) {
      // Toggle direction if same column
      setActiveSortDirection(activeSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with default descending direction
      setActiveSortIndex(columnIndex);
      setActiveSortDirection('desc');
    }
  };

  /**
   * Get sort params for table header
   */
  const getSortParams = (columnIndex: number, column: SortableColumn): ThProps['sort'] => ({
    sortBy: {
      index: activeSortIndex,
      direction: activeSortDirection,
    },
    onSort: () => handleSort(columnIndex, column),
    columnIndex,
  });

  // Sort and paginate data
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const columnMap: SortableColumn[] = [
      'provider',
      'requests',
      'tokens',
      'cost',
      'models',
      'successRate',
    ];
    const sortColumn = columnMap[activeSortIndex] || 'requests';

    return [...data].sort(getSortFunction(sortColumn));
  }, [data, activeSortIndex, activeSortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    return sortedData.slice(startIndex, startIndex + perPage);
  }, [sortedData, page, perPage]);

  // Loading skeleton
  if (loading) {
    return (
      <div>
        <Table aria-label={t('admin.usage.tables.providers.ariaLabel')} variant="compact">
          <Thead>
            <Tr>
              <Th>{t('admin.usage.tables.providers.columns.provider')}</Th>
              <Th>{t('admin.usage.tables.providers.columns.requests')}</Th>
              <Th>{t('admin.usage.tables.providers.columns.tokens')}</Th>
              <Th>{t('admin.usage.tables.providers.columns.cost')}</Th>
              <Th>{t('admin.usage.tables.providers.columns.models')}</Th>
              <Th>{t('admin.usage.tables.providers.columns.successRate')}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {Array.from({ length: 5 }).map((_, index) => (
              <Tr key={index}>
                <Td>
                  <Skeleton width="60%" />
                </Td>
                <Td>
                  <Skeleton width="40%" />
                </Td>
                <Td>
                  <Skeleton width="50%" />
                </Td>
                <Td>
                  <Skeleton width="45%" />
                </Td>
                <Td>
                  <Skeleton width="35%" />
                </Td>
                <Td>
                  <Skeleton width="40%" />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <EmptyState variant={EmptyStateVariant.sm}>
        <CloudIcon />
        <Title headingLevel="h3" size="lg">
          {t('admin.usage.tables.providers.empty.title')}
        </Title>
        <EmptyStateBody>{t('admin.usage.tables.providers.empty.description')}</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div>
      <Table aria-label={t('admin.usage.tables.providers.ariaLabel')} variant="compact">
        <caption className="pf-v6-screen-reader">
          {t('admin.usage.tables.providers.caption', { count: data.length })}
        </caption>
        <Thead>
          <Tr>
            <Th sort={getSortParams(0, 'provider')} width={20}>
              {t('admin.usage.tables.providers.columns.provider')}
            </Th>
            <Th sort={getSortParams(1, 'requests')} width={15}>
              {t('admin.usage.tables.providers.columns.requests')}
            </Th>
            <Th sort={getSortParams(2, 'tokens')} width={15}>
              {t('admin.usage.tables.providers.columns.tokens')}
            </Th>
            <Th sort={getSortParams(3, 'cost')} width={15}>
              {t('admin.usage.tables.providers.columns.cost')}
            </Th>
            <Th sort={getSortParams(4, 'models')} width={15}>
              {t('admin.usage.tables.providers.columns.models')}
            </Th>
            <Th sort={getSortParams(5, 'successRate')} width={20}>
              {t('admin.usage.tables.providers.columns.successRate')}
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {paginatedData.map((provider) => (
            <Tr key={provider.provider}>
              <Td dataLabel={t('admin.usage.tables.providers.columns.provider')}>
                <strong>{provider.provider}</strong>
              </Td>
              <Td dataLabel={t('admin.usage.tables.providers.columns.requests')}>
                {formatNumber(provider.metrics.requests)}
              </Td>
              <Td dataLabel={t('admin.usage.tables.providers.columns.tokens')}>
                {formatNumber(provider.metrics.tokens.total)}
              </Td>
              <Td dataLabel={t('admin.usage.tables.providers.columns.cost')}>
                {formatCurrency(provider.metrics.cost)}
              </Td>
              <Td dataLabel={t('admin.usage.tables.providers.columns.models')}>
                {formatNumber(provider.metrics.models)}
              </Td>
              <Td dataLabel={t('admin.usage.tables.providers.columns.successRate')}>
                {getSuccessRateBadge(provider.metrics.successRate)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Pagination */}
      {data.length > perPage && (
        <Pagination
          itemCount={data.length}
          perPage={perPage}
          page={page}
          onSetPage={(_event, newPage) => setPage(newPage)}
          onPerPageSelect={(_event, newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
          perPageOptions={[
            { title: '10', value: 10 },
            { title: '25', value: 25 },
            { title: '50', value: 50 },
            { title: '100', value: 100 },
          ]}
          variant={PaginationVariant.bottom}
          aria-label={t('admin.usage.tables.providers.pagination.ariaLabel')}
          style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}
        />
      )}
    </div>
  );
};

export default ProviderBreakdownTable;

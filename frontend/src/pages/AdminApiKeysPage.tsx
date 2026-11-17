import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarGroup,
  SearchInput,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
  Button,
  ButtonVariant,
  Label,
  Pagination,
  PaginationVariant,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateVariant,
  Spinner,
  Flex,
  FlexItem,
  Progress,
  ProgressVariant,
  ProgressMeasureLocation,
  Modal,
  ModalVariant,
  ModalFooter,
  ModalHeader,
  ModalBody,
  Bullseye,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td, ThProps } from '@patternfly/react-table';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  ExclamationCircleIcon,
  TimesCircleIcon,
  ArchiveIcon,
  SyncAltIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import {
  adminApiKeysService,
  AdminApiKeyRow,
  AdminKeyStatus,
} from '../services/adminApiKeys.service';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { useErrorHandler } from '../hooks/useErrorHandler';

const STATUS_VARIANTS: Record<AdminKeyStatus, 'green' | 'orange' | 'red' | 'grey'> = {
  active: 'green',
  revoked: 'orange',
  expired: 'red',
  archived: 'grey',
};

const PAGE_SIZES = [10, 20, 50, 100];

const AdminApiKeysPage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();

  // Filters
  const [searchValue, setSearchValue] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminKeyStatus | 'all' | ''>('active');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirm dialog
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);

  const isAdmin =
    currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('adminReadonly');

  const statusParam = statusFilter === '' ? 'active' : statusFilter;

  const queryParams = useMemo(
    () => ({
      page,
      limit: perPage,
      status: statusParam,
      ...(appliedSearch && { search: appliedSearch }),
      sortBy: sortBy as 'createdAt' | 'name' | 'lastUsedAt' | 'username' | 'currentSpend',
      sortOrder,
    }),
    [page, perPage, statusParam, appliedSearch, sortBy, sortOrder],
  );

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useQuery(['admin-api-keys', queryParams], () => adminApiKeysService.listAllKeys(queryParams), {
    enabled: !!isAdmin,
    keepPreviousData: true,
    onError: (err) => handleError(err, { fallbackMessageKey: 'errors.general' }),
  });

  const bulkRevokeMutation = useMutation(
    (keyIds: string[]) => adminApiKeysService.bulkRevoke(keyIds, 'Bulk revoked via API Management'),
    {
      onSuccess: (result) => {
        queryClient.invalidateQueries('admin-api-keys');
        setSelectedIds(new Set());
        setIsRevokeModalOpen(false);
        const msg =
          result.failed === 0
            ? t('adminApiKeys.revoke.success', { count: result.revoked })
            : t('adminApiKeys.revoke.partial', {
                revoked: result.revoked,
                failed: result.failed,
              });
        handleError(new Error(msg), {
          fallbackMessageKey: 'errors.general',
          notificationVariant: result.failed === 0 ? ('success' as never) : 'danger',
        });
      },
      onError: (err) => {
        handleError(err, { fallbackMessageKey: 'errors.general' });
      },
    },
  );

  const cleanupMutation = useMutation(() => adminApiKeysService.cleanupExpired(), {
    onSuccess: (result) => {
      queryClient.invalidateQueries('admin-api-keys');
      setIsCleanupModalOpen(false);
      handleError(new Error(t('adminApiKeys.cleanup.success', { count: result.cleanedCount })), {
        fallbackMessageKey: 'errors.general',
        notificationVariant: 'success' as never,
      });
    },
    onError: (err) => {
      handleError(err, { fallbackMessageKey: 'errors.general' });
    },
  });

  const rows = response?.data ?? [];
  const stats = response?.stats;
  const pagination = response?.pagination;

  const pageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const selectedCount = selectedIds.size;

  const handleToggleSelectAll = (isSelected: boolean) => {
    const next = new Set(selectedIds);
    if (isSelected) {
      rows.forEach((r) => {
        if (r.status === 'active') next.add(r.id);
      });
    } else {
      rows.forEach((r) => next.delete(r.id));
    }
    setSelectedIds(next);
  };

  const handleToggleRow = (keyId: string, isSelected: boolean) => {
    const next = new Set(selectedIds);
    if (isSelected) next.add(keyId);
    else next.delete(keyId);
    setSelectedIds(next);
  };

  const handleSearch = (value: string) => {
    setAppliedSearch(value);
    setPage(1);
  };

  const handleStatusChange = (selection: string) => {
    setStatusFilter((selection || 'active') as AdminKeyStatus | 'all' | '');
    setIsStatusOpen(false);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleSetPage = (_evt: unknown, newPage: number) => setPage(newPage);
  const handlePerPageSelect = (_evt: unknown, newSize: number) => {
    setPerPage(newSize);
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortParams = (column: string): ThProps['sort'] => ({
    sortBy:
      sortBy === column
        ? { index: 0, direction: sortOrder as 'asc' | 'desc' }
        : {},
    onSort: () => handleSort(column),
    columnIndex: 0,
  });

  const renderStatusBadge = (status: AdminKeyStatus) => {
    const icons = {
      active: <CheckCircleIcon />,
      revoked: <TimesCircleIcon />,
      expired: <ExclamationCircleIcon />,
      archived: <ArchiveIcon />,
    };
    return (
      <Label color={STATUS_VARIANTS[status]} icon={icons[status]}>
        {t(`adminApiKeys.status.${status}`)}
      </Label>
    );
  };

  const renderBudgetCell = (key: AdminApiKeyRow) => {
    if (key.maxBudget == null && key.currentSpend == null) {
      return <span className="pf-v6-u-text-color-200">—</span>;
    }
    const spend = key.currentSpend ?? 0;
    const budget = key.maxBudget ?? 0;
    const pct = budget > 0 ? Math.min(100, (spend / budget) * 100) : 0;
    return (
      <div style={{ maxWidth: 120 }}>
        <div>
          {formatCurrency(spend)} / {budget > 0 ? formatCurrency(budget) : '∞'}
        </div>
        {budget > 0 && (
          <Progress
            value={pct}
            variant={pct > 90 ? ProgressVariant.danger : pct > 75 ? ProgressVariant.warning : undefined}
            aria-label={t('adminApiKeys.table.budgetProgress')}
            measureLocation={ProgressMeasureLocation.none}
          />
        )}
      </div>
    );
  };

  const statusOptions: Array<AdminKeyStatus | 'all'> = [
    'active',
    'revoked',
    'expired',
    'archived',
    'all',
  ];

  const statusLabel = (s: AdminKeyStatus | 'all' | '') =>
    s === '' || s === 'active'
      ? t('adminApiKeys.status.active')
      : t(`adminApiKeys.status.${s}`);

  if (!isAdmin) {
    return (
      <PageSection>
        <EmptyState variant={EmptyStateVariant.lg}>
          <ExclamationTriangleIcon />
          <Title headingLevel="h2" size="lg">
            {t('adminApiKeys.accessDenied')}
          </Title>
          <EmptyStateBody>{t('adminApiKeys.accessDeniedDescription')}</EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  return (
    <PageSection>
      {/* Header + stats cards */}
      <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsFlexEnd' }}>
        <FlexItem>
          <Title headingLevel="h1" size="lg">
            {t('adminApiKeys.title')}
          </Title>
        </FlexItem>
        <FlexItem>
          <Button
            variant={ButtonVariant.secondary}
            icon={<TrashIcon />}
            onClick={() => setIsCleanupModalOpen(true)}
            isDisabled={cleanupMutation.isLoading}
          >
            {t('adminApiKeys.cleanup.button')}
          </Button>
        </FlexItem>
      </Flex>

      {stats && (
        <Flex spaceItems={{ default: 'spaceItemsMd' }} className="pf-v6-u-mt-md pf-v6-u-mb-md">
          {(
            [
              ['total', stats.total, 'grey'],
              ['active', stats.active, 'green'],
              ['revoked', stats.revoked, 'orange'],
              ['expired', stats.expired, 'red'],
              ['archived', stats.archived, 'grey'],
            ] as const
          ).map(([id, value, color]) => (
            <FlexItem key={id}>
              <Card isCompact style={{ minWidth: 120 }}>
                <CardBody>
                  <span className="pf-v6-u-text-color-200">
                    {t(`adminApiKeys.status.${id === 'total' ? 'all' : id}`)}
                  </span>
                  <Title headingLevel="h3" size="xl">
                    <Label color={color}>{value}</Label>
                  </Title>
                </CardBody>
              </Card>
            </FlexItem>
          ))}
        </Flex>
      )}

      {/* Toolbar */}
      <Toolbar
        id="admin-api-keys-toolbar"
        clearAllFilters={() => {
          setSearchValue('');
          setAppliedSearch('');
          setStatusFilter('active');
          setPage(1);
        }}
      >
        <ToolbarContent>
          <ToolbarItem>
            <SearchInput
              placeholder={t('adminApiKeys.filters.searchPlaceholder')}
              value={searchValue}
              onChange={(_, v) => setSearchValue(v)}
              onSearch={() => handleSearch(searchValue)}
              onClear={() => handleSearch('')}
              aria-label={t('adminApiKeys.filters.searchAria')}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Select
              role="listbox"
              id="status-filter"
              isOpen={isStatusOpen}
              onOpenChange={setIsStatusOpen}
              aria-label={t('adminApiKeys.filters.statusAria')}
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setIsStatusOpen(!isStatusOpen)}
                  isExpanded={isStatusOpen}
                >
                  {statusLabel(statusFilter === '' ? 'active' : statusFilter)}
                </MenuToggle>
              )}
              onSelect={(_, selection) => handleStatusChange(selection as string)}
              selected={statusFilter}
            >
              <SelectList>
                {statusOptions.map((s) => (
                  <SelectOption key={s} value={s}>
                    {statusLabel(s)}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ToolbarItem>
          {selectedCount > 0 && (
            <ToolbarGroup>
              <ToolbarItem>
                <Button
                  variant={ButtonVariant.danger}
                  icon={<TrashIcon />}
                  onClick={() => setIsRevokeModalOpen(true)}
                  isLoading={bulkRevokeMutation.isLoading}
                >
                  {t('adminApiKeys.revoke.button', { count: selectedCount })}
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <Button variant={ButtonVariant.link} onClick={() => setSelectedIds(new Set())}>
                  {t('adminApiKeys.revoke.clearSelection')}
                </Button>
              </ToolbarItem>
            </ToolbarGroup>
          )}
          <ToolbarItem align={{ default: 'alignEnd' }}>
            <Button variant={ButtonVariant.plain} icon={<SyncAltIcon />} onClick={() => refetch()} aria-label={t('adminApiKeys.refresh')} />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {/* Table */}
      <Card>
        <CardBody>
          {isLoading && !response ? (
            <Bullseye>
              <Spinner size="xl" aria-label={t('common.loading')} />
            </Bullseye>
          ) : error ? (
            <EmptyState variant={EmptyStateVariant.lg}>
              <ExclamationTriangleIcon />
              <Title headingLevel="h2" size="lg">
                {t('adminApiKeys.error.load')}
              </Title>
              <EmptyStateBody>{t('adminApiKeys.error.loadDescription')}</EmptyStateBody>
              <EmptyStateActions>
                <Button variant="primary" onClick={() => refetch()}>
                  {t('users.error.tryAgain')}
                </Button>
              </EmptyStateActions>
            </EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState variant={EmptyStateVariant.lg}>
              <KeyIcon />
              <Title headingLevel="h2" size="lg">
                {t('adminApiKeys.empty.title')}
              </Title>
              <EmptyStateBody>{t('adminApiKeys.empty.description')}</EmptyStateBody>
            </EmptyState>
          ) : (
            <>
              <Table aria-label={t('adminApiKeys.table.ariaLabel')} variant="compact">
                <Thead>
                  <Tr>
                    <Th
                      select={{
                        onSelect: (_e: unknown, isSelected: boolean) => handleToggleSelectAll(isSelected),
                        isSelected: pageSelected,
                        isHeaderSelectDisabled: !rows.some((r) => r.status === 'active'),
                      }}
                      screenReaderText={t('adminApiKeys.table.select')}
                    />
                    <Th sort={getSortParams('name')}>{t('adminApiKeys.table.name')}</Th>
                    <Th sort={getSortParams('username')}>{t('adminApiKeys.table.owner')}</Th>
                    <Th width={15}>{t('adminApiKeys.table.status')}</Th>
                    <Th width={10}>{t('adminApiKeys.table.models')}</Th>
                    <Th width={15}>{t('adminApiKeys.table.budget')}</Th>
                    <Th sort={getSortParams('lastUsedAt')}>{t('adminApiKeys.table.lastUsed')}</Th>
                    <Th sort={getSortParams('createdAt')}>{t('adminApiKeys.table.created')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((key) => (
                    <Tr key={key.id}>
                      <Td
                        select={{
                          rowIndex: rows.indexOf(key),
                          onSelect: (_e: unknown, isSelected: boolean) => handleToggleRow(key.id, isSelected),
                          isSelected: selectedIds.has(key.id),
                          isDisabled: key.status !== 'active',
                        }}
                      />
                      <Td dataLabel={t('adminApiKeys.table.name')}>
                        <div>{key.name}</div>
                        {key.keyPrefix && (
                          <span className="pf-v6-u-text-color-200">
                            {key.keyPrefix}...
                          </span>
                        )}
                      </Td>
                      <Td dataLabel={t('adminApiKeys.table.owner')}>
                        <div>{key.username || '—'}</div>
                        {key.email && (
                          <span className="pf-v6-u-text-color-200">
                            {key.email}
                          </span>
                        )}
                      </Td>
                      <Td dataLabel={t('adminApiKeys.table.status')}>
                        {renderStatusBadge(key.status)}
                      </Td>
                      <Td dataLabel={t('adminApiKeys.table.models')}>
                        {key.models.length === 0 ? (
                          <span className="pf-v6-u-text-color-200">—</span>
                        ) : key.models.length <= 2 ? (
                          key.models.join(', ')
                        ) : (
                          t('adminApiKeys.table.modelsCount', { count: key.models.length })
                        )}
                      </Td>
                      <Td dataLabel={t('adminApiKeys.table.budget')}>{renderBudgetCell(key)}</Td>
                      <Td dataLabel={t('adminApiKeys.table.lastUsed')}>
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleDateString()
                          : t('adminApiKeys.table.never')}
                      </Td>
                      <Td dataLabel={t('adminApiKeys.table.created')}>
                        {new Date(key.createdAt).toLocaleDateString()}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              {pagination && (
                <Pagination
                  itemCount={pagination.total}
                  page={pagination.page}
                  perPage={pagination.limit}
                  onSetPage={handleSetPage}
                  onPerPageSelect={handlePerPageSelect}
                  perPageOptions={PAGE_SIZES.map((s) => ({ title: String(s), value: s }))}
                  variant={PaginationVariant.bottom}
                  titles={{
                    items: t('adminApiKeys.pagination.items'),
                    ofWord: t('adminApiKeys.pagination.of'),
                  }}
                />
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Bulk revoke confirmation */}
      <Modal
        variant={ModalVariant.small}
        isOpen={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
      >
        <ModalHeader title={t('adminApiKeys.revoke.confirmTitle', { count: selectedCount })} />
        <ModalBody>
          <p>{t('adminApiKeys.revoke.confirmBody')}</p>
          <p className="pf-v6-u-text-color-200" style={{ fontSize: '0.875rem' }}>
            {t('adminApiKeys.revoke.confirmNote')}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant={ButtonVariant.danger}
            isLoading={bulkRevokeMutation.isLoading}
            onClick={() => bulkRevokeMutation.mutate(Array.from(selectedIds))}
          >
            {t('adminApiKeys.revoke.confirmAction')}
          </Button>
          <Button variant={ButtonVariant.link} onClick={() => setIsRevokeModalOpen(false)}>
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Cleanup expired confirmation */}
      <Modal
        variant={ModalVariant.small}
        isOpen={isCleanupModalOpen}
        onClose={() => setIsCleanupModalOpen(false)}
      >
        <ModalHeader title={t('adminApiKeys.cleanup.confirmTitle')} />
        <ModalBody>
          <p>{t('adminApiKeys.cleanup.confirmBody')}</p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant={ButtonVariant.warning}
            isLoading={cleanupMutation.isLoading}
            onClick={() => cleanupMutation.mutate()}
          >
            {t('adminApiKeys.cleanup.confirmAction')}
          </Button>
          <Button variant={ButtonVariant.link} onClick={() => setIsCleanupModalOpen(false)}>
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </PageSection>
  );
};

export default AdminApiKeysPage;

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Content,
  ContentVariants,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Label,
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Pagination,
  TextInput,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  Switch,
  Tooltip,
  type MenuToggleElement,
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td, ExpandableRowContent } from '@patternfly/react-table';
import { CheckCircleIcon, TimesCircleIcon, SearchIcon } from '@patternfly/react-icons';
import { useQuery } from 'react-query';
import { auditService, type AuditLogFilters } from '../services/audit.service';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { getActionLabel, getCategoryLabel } from '../constants/auditCategories';

const AuditPage: React.FC = () => {
  const { t } = useTranslation();
  const { handleError } = useErrorHandler();

  // Filter state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [isActionFilterOpen, setIsActionFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [showApiAccess, setShowApiAccess] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Compute excludeResourceTypes based on toggle
  const excludeResourceTypes = showApiAccess ? undefined : 'API_ACCESS';

  // Build filters
  const filters: AuditLogFilters = {
    page,
    limit: perPage,
    ...(actionFilter && { action: actionFilter }),
    ...(categoryFilter && { resourceType: categoryFilter }),
    ...(searchText && { search: searchText }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(excludeResourceTypes && { excludeResourceTypes }),
  };

  // Fetch audit logs
  const { data, isLoading } = useQuery(
    ['auditLogs', filters],
    () => auditService.getAuditLogs(filters),
    {
      onError: handleError,
      keepPreviousData: true,
    },
  );

  // Fetch action types for filter dropdown (filtered by category and exclusion)
  const { data: actionsData } = useQuery(
    ['auditActions', excludeResourceTypes, categoryFilter],
    () => auditService.getAuditActions(excludeResourceTypes, categoryFilter || undefined),
    {
      onError: handleError,
    },
  );

  // Fetch categories
  const { data: categoriesData } = useQuery(
    ['auditCategories'],
    () => auditService.getAuditCategories(),
    {
      onError: handleError,
    },
  );

  const logs = data?.data || [];
  const totalCount = data?.pagination?.total || 0;
  const actionTypes = actionsData?.actions || [];
  const categories = categoriesData?.categories || [];

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      setPage(1);
    }
  }, []);

  const handleCategorySelect = useCallback(
    (_event: React.MouseEvent | undefined, value: string | number | undefined) => {
      const category = value as string;
      setCategoryFilter(category);
      setIsCategoryFilterOpen(false);
      setActionFilter(''); // Reset action filter when category changes
      setPage(1);
      // Auto-enable API access toggle when selecting API_ACCESS category
      if (category === 'API_ACCESS' && !showApiAccess) {
        setShowApiAccess(true);
      }
    },
    [showApiAccess],
  );

  const handleApiAccessToggle = useCallback(
    (_event: React.FormEvent, checked: boolean) => {
      setShowApiAccess(checked);
      setPage(1);
      // If turning off and currently filtering by API_ACCESS, clear category
      if (!checked && categoryFilter === 'API_ACCESS') {
        setCategoryFilter('');
        setActionFilter('');
      }
    },
    [categoryFilter],
  );

  if (isLoading && !data) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.audit.title', 'Audit Logs')}
          </Title>
        </PageSection>
        <PageSection>
          <EmptyState variant={EmptyStateVariant.lg}>
            <Spinner size="xl" />
            <Title headingLevel="h2" size="lg">
              {t('pages.audit.loading', 'Loading audit logs...')}
            </Title>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          {t('pages.audit.title', 'Audit Logs')}
        </Title>
        <Content component={ContentVariants.p}>
          {t('pages.audit.description', 'View system audit trail of all administrative actions.')}
        </Content>
      </PageSection>

      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <Select
                id="category-filter"
                isOpen={isCategoryFilterOpen}
                selected={categoryFilter}
                onSelect={handleCategorySelect}
                onOpenChange={(isOpen) => setIsCategoryFilterOpen(isOpen)}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsCategoryFilterOpen(!isCategoryFilterOpen)}
                    isExpanded={isCategoryFilterOpen}
                  >
                    {categoryFilter
                      ? getCategoryLabel(categoryFilter, t)
                      : t('pages.audit.allCategories', 'All categories')}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  <SelectOption value="">
                    {t('pages.audit.allCategories', 'All categories')}
                  </SelectOption>
                  {categories
                    .filter((cat) => showApiAccess || cat !== 'API_ACCESS')
                    .sort((a, b) => getCategoryLabel(a, t).localeCompare(getCategoryLabel(b, t)))
                    .map((category) => (
                      <SelectOption key={category} value={category}>
                        {getCategoryLabel(category, t)}
                      </SelectOption>
                    ))}
                </SelectList>
              </Select>
            </ToolbarItem>

            <ToolbarItem>
              <Select
                id="action-filter"
                isOpen={isActionFilterOpen}
                selected={actionFilter}
                onSelect={(_event, value) => {
                  setActionFilter(value as string);
                  setIsActionFilterOpen(false);
                  setPage(1);
                }}
                onOpenChange={(isOpen) => setIsActionFilterOpen(isOpen)}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsActionFilterOpen(!isActionFilterOpen)}
                    isExpanded={isActionFilterOpen}
                  >
                    {actionFilter
                      ? getActionLabel(actionFilter, t)
                      : t('pages.audit.allActions', 'All actions')}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  <SelectOption value="">{t('pages.audit.allActions', 'All actions')}</SelectOption>
                  {actionTypes.map((action) => (
                    <SelectOption key={action} value={action}>
                      {getActionLabel(action, t)}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </ToolbarItem>

            <ToolbarItem style={{ alignSelf: 'center' }}>
              <Switch
                id="show-api-access"
                label={t('pages.audit.showApiAccess', 'Show API requests')}
                isChecked={showApiAccess}
                onChange={handleApiAccessToggle}
              />
            </ToolbarItem>

            <ToolbarItem>
              <TextInput
                type="search"
                aria-label={t('pages.audit.searchPlaceholder', 'Search audit logs')}
                placeholder={t('pages.audit.searchPlaceholder', 'Search audit logs')}
                value={searchText}
                onChange={(_event, value) => setSearchText(value)}
                onKeyDown={handleSearchKeyDown}
                customIcon={<SearchIcon />}
              />
            </ToolbarItem>

            <ToolbarItem>
              <TextInput
                type="date"
                aria-label={t('pages.audit.startDate', 'Start date')}
                value={startDate}
                onChange={(_event, value) => {
                  setStartDate(value);
                  setPage(1);
                }}
              />
            </ToolbarItem>

            <ToolbarItem>
              <TextInput
                type="date"
                aria-label={t('pages.audit.endDate', 'End date')}
                value={endDate}
                onChange={(_event, value) => {
                  setEndDate(value);
                  setPage(1);
                }}
              />
            </ToolbarItem>

            <ToolbarItem variant="pagination">
              <Pagination
                itemCount={totalCount}
                perPage={perPage}
                page={page}
                onSetPage={(_event, pageNumber) => setPage(pageNumber)}
                onPerPageSelect={(_event, perPageValue) => {
                  setPerPage(perPageValue);
                  setPage(1);
                }}
                isCompact
              />
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {logs.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <Title headingLevel="h2" size="lg">
              {t('pages.audit.noLogsTitle', 'No audit logs found')}
            </Title>
            <EmptyStateBody>
              {t('pages.audit.noLogsDescription', 'No audit logs match the current filters.')}
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label={t('pages.audit.title', 'Audit Logs')}>
            <Thead>
              <Tr>
                <Th screenReaderText="Row expansion" />
                <Th>{t('pages.audit.table.timestamp', 'Timestamp')}</Th>
                <Th>{t('pages.audit.table.user', 'User')}</Th>
                <Th>{t('pages.audit.table.action', 'Action')}</Th>
                <Th>{t('pages.audit.table.resourceType', 'Category')}</Th>
                <Th>{t('pages.audit.table.resourceId', 'Resource ID')}</Th>
                <Th>{t('pages.audit.table.status', 'Status')}</Th>
              </Tr>
            </Thead>
            {logs.map((log, rowIndex) => {
              const isExpanded = expandedRows.has(log.id);
              const hasDetails = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <Tbody key={log.id} isExpanded={isExpanded}>
                  <Tr>
                    <Td
                      expand={
                        hasDetails
                          ? {
                              rowIndex,
                              isExpanded,
                              onToggle: () => toggleExpand(log.id),
                            }
                          : undefined
                      }
                    />
                    <Td dataLabel={t('pages.audit.table.timestamp', 'Timestamp')}>
                      {new Date(log.createdAt).toLocaleString()}
                    </Td>
                    <Td dataLabel={t('pages.audit.table.user', 'User')}>{log.username || '-'}</Td>
                    <Td dataLabel={t('pages.audit.table.action', 'Action')}>
                      <Tooltip content={log.action}>
                        <Label color="blue">{getActionLabel(log.action, t)}</Label>
                      </Tooltip>
                    </Td>
                    <Td dataLabel={t('pages.audit.table.resourceType', 'Category')}>
                      {getCategoryLabel(log.resourceType, t)}
                    </Td>
                    <Td dataLabel={t('pages.audit.table.resourceId', 'Resource ID')}>
                      {log.resourceId || '-'}
                    </Td>
                    <Td dataLabel={t('pages.audit.table.status', 'Status')}>
                      {log.success ? (
                        <CheckCircleIcon color="var(--pf-t--global--color--status--success--default)" />
                      ) : (
                        <TimesCircleIcon color="var(--pf-t--global--color--status--danger--default)" />
                      )}
                    </Td>
                  </Tr>
                  {hasDetails && (
                    <Tr isExpanded={isExpanded}>
                      <Td colSpan={7}>
                        <ExpandableRowContent>
                          <Title headingLevel="h4" size="md">
                            {t('pages.audit.details', 'Details')}
                          </Title>
                          {log.errorMessage && (
                            <Content component={ContentVariants.p}>
                              <strong>{t('pages.audit.error', 'Error')}:</strong> {log.errorMessage}
                            </Content>
                          )}
                          <pre
                            style={{
                              background:
                                'var(--pf-t--global--background--color--secondary--default)',
                              padding: '1rem',
                              borderRadius: '4px',
                              overflow: 'auto',
                              maxHeight: '300px',
                            }}
                          >
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </ExpandableRowContent>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              );
            })}
          </Table>
        )}

        {logs.length > 0 && (
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              itemCount={totalCount}
              perPage={perPage}
              page={page}
              onSetPage={(_event, pageNumber) => setPage(pageNumber)}
              onPerPageSelect={(_event, perPageValue) => {
                setPerPage(perPageValue);
                setPage(1);
              }}
            />
          </div>
        )}
      </PageSection>
    </>
  );
};

export default AuditPage;

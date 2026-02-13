import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import {
  PageSection,
  Title,
  Button,
  Label,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  Bullseye,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
  Pagination,
  PaginationVariant,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarGroup,
  Divider,
} from '@patternfly/react-core';
import {
  UsersIcon,
  FilterIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TimesCircleIcon,
  UserIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td, ActionsColumn } from '@patternfly/react-table';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usersService } from '../services/users.service';
import { User, UserListParams } from '../types/users';
import { UserEditModal } from '../components';

const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [perPage, setPerPage] = useState(parseInt(searchParams.get('limit') || '10', 10));

  // Modal focus management ref
  const editModalTriggerRef = useRef<HTMLElement | null>(null);

  // Check permissions
  const canReadUsers = usersService.canReadUsers(currentUser || undefined);
  const canModifyUsers = usersService.canModifyUsers(currentUser || undefined);

  // Build query parameters
  const queryParams: UserListParams = {
    page,
    limit: perPage,
    ...(searchValue && { search: searchValue }),
    ...(roleFilter && { role: roleFilter }),
    ...(statusFilter === 'active' && { isActive: true }),
    ...(statusFilter === 'inactive' && { isActive: false }),
  };

  // Fetch users data with React Query
  const {
    data: usersResponse,
    isLoading,
    error,
    refetch,
  } = useQuery(['users', queryParams], () => usersService.getUsers(queryParams), {
    enabled: canReadUsers,
    keepPreviousData: true,
    onError: (err: any) => {
      console.error('Failed to load users:', err);
      const errorMessage = err?.response?.data?.message || err?.message || t('users.error.load');
      addNotification({
        title: t('users.error.load'),
        description: errorMessage,
        variant: 'danger',
      });
    },
  });

  // Update URL parameters when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (page > 1) newParams.set('page', page.toString());
    if (perPage !== 10) newParams.set('limit', perPage.toString());
    if (searchValue) newParams.set('search', searchValue);
    if (roleFilter) newParams.set('role', roleFilter);
    if (statusFilter) newParams.set('status', statusFilter);

    setSearchParams(newParams);
  }, [page, perPage, searchValue, roleFilter, statusFilter, setSearchParams]);

  // Helper functions
  const getStatusBadge = (isActive: boolean) => {
    return (
      <Label color={isActive ? 'green' : 'grey'}>
        {isActive ? <CheckCircleIcon /> : <TimesCircleIcon />}{' '}
        {isActive ? t('status.active') : t('status.inactive')}
      </Label>
    );
  };

  const formatRoles = (roles: string[]) => {
    if (!roles || roles.length === 0) {
      return <Label color="grey">{t('role.user')}</Label>;
    }

    return (
      <Flex spaceItems={{ default: 'spaceItemsXs' }} flexWrap={{ default: 'wrap' }}>
        {roles.slice(0, 3).map((role) => (
          <FlexItem key={role}>
            <Label color={role === 'admin' ? 'red' : 'blue'}>
              {usersService.formatRoleDisplayName(role)}
            </Label>
          </FlexItem>
        ))}
        {roles.length > 3 && (
          <FlexItem>
            <Label color="teal">{t('users.table.moreRoles', { count: roles.length - 3 })}</Label>
          </FlexItem>
        )}
      </Flex>
    );
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setPage(1); // Reset to first page when searching
  };

  const handleRoleFilterChange = (selection: string) => {
    setRoleFilter(selection === roleFilter ? '' : selection);
    setPage(1); // Reset to first page when filtering
    setIsRoleFilterOpen(false);
  };

  const handleStatusFilterChange = (selection: string) => {
    setStatusFilter(selection === statusFilter ? '' : selection);
    setPage(1); // Reset to first page when filtering
    setIsStatusFilterOpen(false);
  };

  const handleManageUser = (user: User, triggerElement?: HTMLElement) => {
    setSelectedUser(user);
    if (triggerElement) {
      editModalTriggerRef.current = triggerElement;
    }
    setIsEditModalOpen(true);
  };

  const clearAllFilters = () => {
    setSearchValue('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = searchValue || roleFilter || statusFilter;

  // Permission check
  if (!canReadUsers) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('nav.admin.users')}
          </Title>
        </PageSection>
        <PageSection>
          <EmptyState variant={EmptyStateVariant.lg} role="alert">
            <ExclamationTriangleIcon />
            <Title headingLevel="h2" size="lg">
              {t('users.permissions.accessDenied')}
            </Title>
            <EmptyStateBody>{t('users.permissions.noPermission')}</EmptyStateBody>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('nav.admin.users')}
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                {t('users.loading.title')}
              </Title>
              <EmptyStateBody>{t('users.loading.description')}</EmptyStateBody>
            </EmptyState>
          </Bullseye>
        </PageSection>
      </>
    );
  }

  const users = usersResponse?.data || [];
  const pagination = usersResponse?.pagination;

  return (
    <>
      <PageSection variant="secondary">
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              {t('nav.admin.users')}
            </Title>
            <Content component={ContentVariants.p}>{t('users.pageDescription')}</Content>
          </FlexItem>
          <FlexItem>
            {pagination && (
              <Content component={ContentVariants.small}>
                {t('ui.pagination.showing')} {(page - 1) * perPage + 1} -{' '}
                {Math.min(page * perPage, pagination.total)} {t('users.pagination.of')}{' '}
                {pagination.total} {t('users.pagination.users')}
              </Content>
            )}
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        {error ? (
          <EmptyState variant={EmptyStateVariant.lg} role="alert">
            <ExclamationTriangleIcon />
            <Title headingLevel="h2" size="lg">
              {t('users.error.loadTitle')}
            </Title>
            <EmptyStateBody>
              {error instanceof Error ? error.message : t('users.error.loadDescription')}
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => refetch()}>
                {t('users.error.tryAgain')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <div>
            {/* Toolbar with search and filters */}
            <Toolbar id="users-toolbar" clearAllFilters={clearAllFilters}>
              <ToolbarContent>
                <ToolbarItem>
                  <SearchInput
                    placeholder={t('users.search.placeholder')}
                    value={searchValue}
                    onChange={(_, value) => setSearchValue(value)}
                    onClear={() => handleSearch('')}
                    aria-label={t('users.search.ariaLabel')}
                  />
                </ToolbarItem>
                <ToolbarItem>
                  <Select
                    role="listbox"
                    id="role-filter"
                    isOpen={isRoleFilterOpen}
                    onOpenChange={setIsRoleFilterOpen}
                    aria-label={t('users.filters.roleAriaLabel')}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsRoleFilterOpen(!isRoleFilterOpen)}
                        isExpanded={isRoleFilterOpen}
                        icon={<FilterIcon />}
                      >
                        {roleFilter
                          ? usersService.formatRoleDisplayName(roleFilter)
                          : t('users.filters.allRoles')}
                      </MenuToggle>
                    )}
                    onSelect={(_, selection) => handleRoleFilterChange(selection as string)}
                    selected={roleFilter}
                  >
                    <SelectList>
                      <SelectOption value="">{t('users.filters.allRoles')}</SelectOption>
                      <Divider />
                      {usersService.getAvailableRoles().map((role) => (
                        <SelectOption key={role} value={role}>
                          {usersService.formatRoleDisplayName(role)}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                </ToolbarItem>
                <ToolbarItem>
                  <Select
                    role="listbox"
                    id="status-filter"
                    isOpen={isStatusFilterOpen}
                    onOpenChange={setIsStatusFilterOpen}
                    aria-label={t('users.filters.statusAriaLabel')}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                        isExpanded={isStatusFilterOpen}
                        icon={<FilterIcon />}
                      >
                        {statusFilter === 'active'
                          ? t('status.active')
                          : statusFilter === 'inactive'
                            ? t('status.inactive')
                            : t('users.filters.allStatus')}
                      </MenuToggle>
                    )}
                    onSelect={(_, selection) => handleStatusFilterChange(selection as string)}
                    selected={statusFilter}
                  >
                    <SelectList>
                      <SelectOption value="">{t('users.filters.allStatus')}</SelectOption>
                      <Divider />
                      <SelectOption value="active">{t('status.active')}</SelectOption>
                      <SelectOption value="inactive">{t('status.inactive')}</SelectOption>
                    </SelectList>
                  </Select>
                </ToolbarItem>
                {hasActiveFilters && (
                  <ToolbarGroup>
                    <ToolbarItem>
                      <Button variant="link" onClick={clearAllFilters}>
                        {t('users.filters.clearAll')}
                      </Button>
                    </ToolbarItem>
                  </ToolbarGroup>
                )}
              </ToolbarContent>
            </Toolbar>

            {users.length === 0 ? (
              <EmptyState variant={EmptyStateVariant.lg}>
                <UsersIcon />
                <Title headingLevel="h2" size="lg">
                  {hasActiveFilters ? t('users.filters.noMatches') : t('users.empty.title')}
                </Title>
                <EmptyStateBody>
                  {hasActiveFilters
                    ? t('users.filters.adjustFilters')
                    : t('users.empty.description')}
                </EmptyStateBody>
                {hasActiveFilters && (
                  <EmptyStateActions>
                    <Button variant="primary" onClick={clearAllFilters}>
                      {t('users.filters.clearAll')}
                    </Button>
                  </EmptyStateActions>
                )}
              </EmptyState>
            ) : (
              <>
                <Table aria-label={t('users.table.ariaLabel')} variant="compact">
                  <caption className="pf-v6-screen-reader">
                    {t('users.table.caption', { count: users.length })}
                  </caption>
                  <Thead>
                    <Tr>
                      <Th width={20}>{t('users.table.username')}</Th>
                      <Th width={25}>{t('users.table.email')}</Th>
                      <Th width={20}>{t('users.table.fullName')}</Th>
                      <Th width={25}>{t('users.table.roles')}</Th>
                      <Th width={10}>{t('users.table.status')}</Th>
                      <Th screenReaderText={t('users.table.actions')}></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {users.map((user) => {
                      const actions = [
                        {
                          title: t('users.actions.manage'),
                          onClick: (event: React.MouseEvent) =>
                            handleManageUser(user, event.currentTarget as HTMLElement),
                        },
                      ];

                      return (
                        <Tr key={user.id} isClickable onRowClick={() => handleManageUser(user)}>
                          <Th scope="row">
                            <Flex
                              alignItems={{ default: 'alignItemsCenter' }}
                              spaceItems={{ default: 'spaceItemsSm' }}
                            >
                              <FlexItem>
                                <UserIcon />
                              </FlexItem>
                              <FlexItem>
                                <strong>{user.username}</strong>
                              </FlexItem>
                            </Flex>
                          </Th>
                          <Td>{user.email}</Td>
                          <Td>
                            {user.fullName || (
                              <Content
                                component={ContentVariants.small}
                                style={{
                                  fontStyle: 'italic',
                                  color: 'var(--pf-t--global--text--color--subtle)',
                                }}
                              >
                                {t('users.table.notProvided')}
                              </Content>
                            )}
                          </Td>
                          <Td>{formatRoles(user.roles)}</Td>
                          <Td>{getStatusBadge(user.isActive)}</Td>
                          <Td isActionCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <ActionsColumn items={actions} />
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <Pagination
                    itemCount={pagination.total}
                    perPage={perPage}
                    page={page}
                    onSetPage={(_, newPage) => setPage(newPage)}
                    onPerPageSelect={(_, newPerPage) => {
                      setPerPage(newPerPage);
                      setPage(1);
                    }}
                    widgetId="users-pagination-bottom"
                    variant={PaginationVariant.bottom}
                    isCompact
                  />
                )}
              </>
            )}
          </div>
        )}
      </PageSection>

      {/* User Management Modal */}
      {selectedUser && isEditModalOpen && (
        <UserEditModal
          user={selectedUser}
          canEdit={canModifyUsers}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedUser(null);
            setTimeout(() => {
              editModalTriggerRef.current?.focus();
            }, 100);
          }}
          onSave={() => {
            setIsEditModalOpen(false);
            setSelectedUser(null);
            refetch(); // Refresh the users list
            setTimeout(() => {
              editModalTriggerRef.current?.focus();
            }, 100);
          }}
        />
      )}
    </>
  );
};

export default UsersPage;

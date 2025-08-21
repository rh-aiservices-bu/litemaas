import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import {
  PageSection,
  Title,
  Button,
  Badge,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  Alert,
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
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
} from '@patternfly/react-core';
import {
  UsersIcon,
  FilterIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TimesCircleIcon,
  UserIcon,
  EditIcon,
  EyeIcon,
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
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [perPage, setPerPage] = useState(parseInt(searchParams.get('limit') || '10', 10));

  // Modal focus management refs
  const viewModalTriggerRef = useRef<HTMLElement | null>(null);
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

  // Focus management for view modal
  useEffect(() => {
    if (isViewModalOpen) {
      setTimeout(() => {
        const closeButton = document.querySelector(
          '[data-modal="view"] button[variant="link"]',
        ) as HTMLButtonElement;
        closeButton?.focus();
      }, 100);

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          const modal = document.querySelector(
            '[data-modal="view"][aria-modal="true"]',
          ) as HTMLElement;
          if (!modal) return;

          const focusableElements = modal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
          );
          const firstFocusable = focusableElements[0] as HTMLElement;
          const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (event.shiftKey && document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable?.focus();
          } else if (!event.shiftKey && document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isViewModalOpen]);

  // Helper functions
  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge color={isActive ? 'green' : 'grey'}>
        {isActive ? <CheckCircleIcon /> : <TimesCircleIcon />}{' '}
        {isActive ? t('status.active') : t('status.inactive')}
      </Badge>
    );
  };

  const formatRoles = (roles: string[]) => {
    if (!roles || roles.length === 0) {
      return <Badge color="grey">{t('role.user')}</Badge>;
    }

    return (
      <Flex spaceItems={{ default: 'spaceItemsXs' }} flexWrap={{ default: 'wrap' }}>
        {roles.slice(0, 3).map((role) => (
          <FlexItem key={role}>
            <Badge color={role === 'admin' ? 'red' : 'blue'}>
              {usersService.formatRoleDisplayName(role)}
            </Badge>
          </FlexItem>
        ))}
        {roles.length > 3 && (
          <FlexItem>
            <Badge color="cyan">{t('users.table.moreRoles', { count: roles.length - 3 })}</Badge>
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

  const handleViewUser = (user: User, triggerElement?: HTMLElement) => {
    setSelectedUser(user);
    if (triggerElement) {
      viewModalTriggerRef.current = triggerElement;
    }
    setIsViewModalOpen(true);
  };

  const handleEditUser = (user: User, triggerElement?: HTMLElement) => {
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
                      <Th></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {users.map((user) => {
                      const actions = [
                        {
                          title: t('users.actions.view'),
                          icon: <EyeIcon />,
                          onClick: (event: React.MouseEvent) =>
                            handleViewUser(user, event.currentTarget as HTMLElement),
                        },
                      ];

                      if (canModifyUsers) {
                        actions.push({
                          title: t('users.actions.edit'),
                          icon: <EditIcon />,
                          onClick: (event) =>
                            handleEditUser(user, event.currentTarget as HTMLElement),
                        });
                      }

                      return (
                        <Tr key={user.id}>
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
                                  color: 'var(--pf-v6-global--Color--200)',
                                }}
                              >
                                {t('users.table.notProvided')}
                              </Content>
                            )}
                          </Td>
                          <Td>{formatRoles(user.roles)}</Td>
                          <Td>{getStatusBadge(user.isActive)}</Td>
                          <Td>
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

      {/* User Details Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={selectedUser?.username || t('users.modal.defaultTitle')}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setTimeout(() => {
            viewModalTriggerRef.current?.focus();
          }, 100);
        }}
        aria-modal="true"
        data-modal="view"
        onEscapePress={() => {
          setIsViewModalOpen(false);
          setTimeout(() => {
            viewModalTriggerRef.current?.focus();
          }, 100);
        }}
      >
        <ModalHeader>
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            spaceItems={{ default: 'spaceItemsMd' }}
          >
            <FlexItem>
              <UserIcon />
            </FlexItem>
            <FlexItem>
              <Title headingLevel="h2" size="xl">
                {selectedUser?.username}
              </Title>
            </FlexItem>
            <FlexItem>{selectedUser && getStatusBadge(selectedUser.isActive)}</FlexItem>
          </Flex>
        </ModalHeader>
        <ModalBody>
          {selectedUser && (
            <>
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('users.form.username')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <strong>{selectedUser.username}</strong>
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('users.form.email')}</DescriptionListTerm>
                  <DescriptionListDescription>{selectedUser.email}</DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('users.form.fullName')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedUser.fullName || t('users.table.notProvided')}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('users.form.roles')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {formatRoles(selectedUser.roles)}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('users.form.status')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {getStatusBadge(selectedUser.isActive)}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('users.form.lastLogin')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedUser.lastLoginAt
                      ? new Date(selectedUser.lastLoginAt).toLocaleString()
                      : t('users.never')}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('users.form.createdAt')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {new Date(selectedUser.createdAt).toLocaleString()}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>

              {!selectedUser.isActive && (
                <Alert
                  variant="warning"
                  title={t('users.alerts.inactive.title')}
                  style={{ marginTop: '1rem' }}
                >
                  {t('users.alerts.inactive.description')}
                </Alert>
              )}

              {selectedUser.roles.includes('admin') && (
                <Alert
                  variant="info"
                  title={t('users.alerts.admin.title')}
                  style={{ marginTop: '1rem' }}
                >
                  {t('users.alerts.admin.description')}
                </Alert>
              )}
            </>
          )}

          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
            }}
          >
            {canModifyUsers && selectedUser && (
              <Button
                variant="primary"
                onClick={() => handleEditUser(selectedUser)}
                icon={<EditIcon />}
              >
                {t('users.actions.edit')}
              </Button>
            )}
            <Button
              variant="link"
              onClick={() => {
                setIsViewModalOpen(false);
                setTimeout(() => {
                  viewModalTriggerRef.current?.focus();
                }, 100);
              }}
            >
              {t('users.modal.close')}
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* User Edit Modal */}
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

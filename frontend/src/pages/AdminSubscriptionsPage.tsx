import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Content,
  ContentVariants,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Button,
  Checkbox,
  Label,
  Flex,
  FlexItem,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  Spinner,
  Alert,
  FormGroup,
  TextArea,
  Pagination,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  type MenuToggleElement,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  TimesCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td, ActionsColumn } from '@patternfly/react-table';
import { useAdminSubscriptions } from '../hooks/useAdminSubscriptions';
import { useNotifications } from '../contexts/NotificationContext';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { adminSubscriptionsService } from '../services/adminSubscriptions.service';
import { StatusFilterSelect } from '../components/admin/StatusFilterSelect';
import { UserFilterSelect } from '../components/admin/UserFilterSelect';
import { ModelFilterSelect } from '../components/usage/filters/ModelFilterSelect';
import { DateRangeFilter, type DatePreset } from '../components/usage/filters/DateRangeFilter';
import type { SubscriptionStatus, AdminSubscriptionRequest } from '../types/admin';

const AdminSubscriptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const { handleError } = useErrorHandler();

  // State
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus[]>(['pending']);
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('any');
  const [isDatePresetOpen, setIsDatePresetOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isDenyModalOpen, setIsDenyModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [isRevertStatusSelectOpen, setIsRevertStatusSelectOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<AdminSubscriptionRequest | null>(
    null,
  );
  const [revertStatus, setRevertStatus] = useState<'active' | 'denied' | 'pending'>('pending');
  const [revertReason, setRevertReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkResults, setBulkResults] = useState<{
    successful: number;
    failed: number;
    errors: Array<{ subscription: string; error: string }>;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [hasAutoFallback, setHasAutoFallback] = useState(false);

  // Calculate date range based on preset - memoize the result to prevent infinite refetch loop
  const dateRange = useMemo((): { dateFrom?: Date; dateTo?: Date } => {
    if (datePreset === 'any') {
      return {}; // No date filtering
    }

    const now = new Date();
    let startDate: Date;

    switch (datePreset) {
      case '1d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 0); // Today only
        break;
      case '7d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // Last 7 days
        break;
      case '30d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29); // Last 30 days
        break;
      case '90d':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 89); // Last 90 days
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            dateFrom: new Date(customStartDate),
            dateTo: new Date(customEndDate),
          };
        }
        return {}; // No filtering if custom dates not set
      default:
        return {};
    }

    return {
      dateFrom: startDate,
      dateTo: now,
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Fetch subscriptions
  const { data, isLoading, refetch } = useAdminSubscriptions({
    statuses: statusFilter.length > 0 ? statusFilter : undefined,
    modelIds: modelFilter.length > 0 ? modelFilter : undefined,
    userIds: userFilter.length > 0 ? userFilter : undefined,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
    page,
    limit: perPage,
  });

  const subscriptions = data?.data || [];
  const totalCount = data?.pagination?.total || 0;

  // Filter restricted subscriptions (only these need checkboxes and actions)
  const restrictedSubscriptions = subscriptions.filter((sub) => sub.model.restrictedAccess);

  // Auto-fallback: if no pending subscriptions on initial load, show all subscriptions
  useEffect(() => {
    if (
      !isLoading &&
      subscriptions.length === 0 &&
      statusFilter.length === 1 &&
      statusFilter[0] === 'pending' &&
      !hasAutoFallback
    ) {
      setStatusFilter([]);
      setPage(1);
      setHasAutoFallback(true);
    }
  }, [isLoading, subscriptions.length, statusFilter, hasAutoFallback]);

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select restricted subscriptions
      setSelectedSubscriptions(new Set(restrictedSubscriptions.map((sub) => sub.id)));
    } else {
      setSelectedSubscriptions(new Set());
    }
  };

  // Handle individual selection
  const handleSelect = (subscriptionId: string, checked: boolean) => {
    const newSelection = new Set(selectedSubscriptions);
    if (checked) {
      newSelection.add(subscriptionId);
    } else {
      newSelection.delete(subscriptionId);
    }
    setSelectedSubscriptions(newSelection);
  };

  // Get status badge
  const getStatusBadge = (status: SubscriptionStatus) => {
    const variants: Record<SubscriptionStatus, 'green' | 'orange' | 'red' | 'blue'> = {
      active: 'green',
      pending: 'blue',
      denied: 'red',
      suspended: 'orange',
      expired: 'red',
      cancelled: 'red',
      inactive: 'orange',
    };

    const icons: Record<SubscriptionStatus, React.ReactNode> = {
      active: <CheckCircleIcon />,
      pending: <ClockIcon />,
      denied: <TimesCircleIcon />,
      suspended: <ExclamationTriangleIcon />,
      expired: <TimesCircleIcon />,
      cancelled: <TimesCircleIcon />,
      inactive: <ExclamationTriangleIcon />,
    };

    return (
      <Label color={variants[status]}>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
          <FlexItem>{icons[status]}</FlexItem>
          <FlexItem>{t(`pages.subscriptions.status.${status}`)}</FlexItem>
        </Flex>
      </Label>
    );
  };

  // Handle bulk approve
  const handleBulkApprove = async () => {
    try {
      setIsProcessing(true);
      const subscriptionIds = Array.from(selectedSubscriptions);

      const response = await adminSubscriptionsService.bulkApprove({
        subscriptionIds,
        reason: bulkReason || undefined,
      });

      setBulkResults({
        successful: response.successful,
        failed: response.failed,
        errors: response.errors || [],
      });

      setIsApproveModalOpen(false);
      setIsResultModalOpen(true);
      setBulkReason('');
      setSelectedSubscriptions(new Set());

      addNotification({
        title: t('pages.adminSubscriptions.approveSuccess', { count: response.successful }),
        variant: 'success',
      });

      await refetch();
    } catch (error) {
      handleError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle bulk deny
  const handleBulkDeny = async () => {
    if (!bulkReason.trim()) {
      addNotification({
        title: t('pages.adminSubscriptions.reasonRequired'),
        variant: 'warning',
      });
      return;
    }

    try {
      setIsProcessing(true);
      const subscriptionIds = Array.from(selectedSubscriptions);

      const response = await adminSubscriptionsService.bulkDeny({
        subscriptionIds,
        reason: bulkReason,
      });

      setBulkResults({
        successful: response.successful,
        failed: response.failed,
        errors: response.errors || [],
      });

      setIsDenyModalOpen(false);
      setIsResultModalOpen(true);
      setBulkReason('');
      setSelectedSubscriptions(new Set());

      addNotification({
        title: t('pages.adminSubscriptions.denySuccess', { count: response.successful }),
        variant: 'success',
      });

      await refetch();
    } catch (error) {
      handleError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle revert subscription status
  const handleRevert = async () => {
    if (!selectedSubscription) return;

    try {
      setIsProcessing(true);

      await adminSubscriptionsService.revertSubscription(selectedSubscription.id, {
        newStatus: revertStatus,
        reason: revertReason || undefined,
      });

      setIsRevertModalOpen(false);
      setIsRevertStatusSelectOpen(false);
      setRevertReason('');
      setSelectedSubscription(null);

      addNotification({
        title: t('pages.adminSubscriptions.revertSuccess'),
        variant: 'success',
      });

      await refetch();
    } catch (error) {
      handleError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle delete subscription
  const handleDelete = async () => {
    if (!selectedSubscription) return;

    try {
      setIsProcessing(true);

      await adminSubscriptionsService.deleteSubscription(
        selectedSubscription.id,
        deleteReason || undefined,
      );

      setIsDeleteModalOpen(false);
      setDeleteReason('');
      setSelectedSubscription(null);

      addNotification({
        title: t('pages.adminSubscriptions.deleteSuccess'),
        variant: 'success',
      });

      await refetch();
    } catch (error) {
      handleError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.adminSubscriptions.title')}
          </Title>
        </PageSection>
        <PageSection>
          <EmptyState variant={EmptyStateVariant.lg}>
            <Spinner size="xl" />
            <Title headingLevel="h2" size="lg">
              {t('pages.subscriptions.loadingTitle')}
            </Title>
            <EmptyStateBody>{t('pages.subscriptions.loadingDescription')}</EmptyStateBody>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  // Calculate selection state based on restricted subscriptions only
  const allSelected =
    restrictedSubscriptions.length > 0 &&
    selectedSubscriptions.size === restrictedSubscriptions.length;
  const someSelected =
    selectedSubscriptions.size > 0 && selectedSubscriptions.size < restrictedSubscriptions.length;

  return (
    <>
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          {t('pages.adminSubscriptions.title')}
        </Title>
      </PageSection>

      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <StatusFilterSelect selected={statusFilter} onSelect={setStatusFilter} />
            </ToolbarItem>

            <ToolbarItem>
              <ModelFilterSelect
                selected={modelFilter}
                onSelect={(modelIds) => {
                  setModelFilter(modelIds);
                  setPage(1); // Reset to first page when filter changes
                }}
              />
            </ToolbarItem>

            <ToolbarItem>
              <UserFilterSelect
                selected={userFilter}
                onSelect={(userIds) => {
                  setUserFilter(userIds);
                  setPage(1); // Reset to first page when filter changes
                }}
              />
            </ToolbarItem>

            <DateRangeFilter
              datePreset={datePreset}
              onPresetChange={(preset) => {
                setDatePreset(preset);
                setPage(1); // Reset to first page when filter changes
              }}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onStartDateChange={setCustomStartDate}
              onEndDateChange={setCustomEndDate}
              isOpen={isDatePresetOpen}
              onOpenChange={setIsDatePresetOpen}
              includeAnyDateOption={true}
            />

            <ToolbarItem variant="separator" />

            <ToolbarItem>
              <Button
                variant="primary"
                onClick={() => setIsApproveModalOpen(true)}
                isDisabled={selectedSubscriptions.size === 0}
              >
                {t('pages.adminSubscriptions.bulkApprove')}
              </Button>
            </ToolbarItem>

            <ToolbarItem>
              <Button
                variant="danger"
                onClick={() => setIsDenyModalOpen(true)}
                isDisabled={selectedSubscriptions.size === 0}
              >
                {t('pages.adminSubscriptions.bulkDeny')}
              </Button>
            </ToolbarItem>

            <ToolbarItem>
              <Button variant="link" onClick={() => refetch()}>
                {t('pages.adminSubscriptions.refresh')}
              </Button>
            </ToolbarItem>

            <ToolbarItem variant="pagination">
              <Pagination
                itemCount={totalCount}
                perPage={perPage}
                page={page}
                onSetPage={(_event, pageNumber) => setPage(pageNumber)}
                onPerPageSelect={(_event, perPageValue) => {
                  setPerPage(perPageValue);
                  setPage(1); // Reset to first page when changing items per page
                }}
                isCompact
              />
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {subscriptions.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <Title headingLevel="h2" size="lg">
              {t('pages.subscriptions.noSubscriptionsTitle')}
            </Title>
            <EmptyStateBody>{t('pages.subscriptions.noSubscriptionsDescription')}</EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label={t('pages.adminSubscriptions.title')}>
            <Thead>
              <Tr>
                <Th screenReaderText={t('pages.adminSubscriptions.table.selectColumn')}>
                  {restrictedSubscriptions.length > 0 ? (
                    <Checkbox
                      id="select-all"
                      isChecked={someSelected ? null : allSelected}
                      onChange={(_event, checked) => handleSelectAll(checked)}
                      aria-label={t('pages.adminSubscriptions.filters.selectAll')}
                    />
                  ) : null}
                </Th>
                <Th>{t('pages.adminSubscriptions.table.user')}</Th>
                <Th>{t('pages.adminSubscriptions.table.model')}</Th>
                <Th>{t('pages.adminSubscriptions.table.status')}</Th>
                <Th>{t('pages.adminSubscriptions.table.reason')}</Th>
                <Th>{t('pages.adminSubscriptions.table.requestedDate')}</Th>
                <Th>{t('pages.adminSubscriptions.table.statusChangedDate')}</Th>
                <Th>{t('pages.adminSubscriptions.table.actions')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {subscriptions.map((subscription) => (
                <Tr key={subscription.id}>
                  <Td>
                    {subscription.model.restrictedAccess ? (
                      <Checkbox
                        id={`select-${subscription.id}`}
                        isChecked={selectedSubscriptions.has(subscription.id)}
                        onChange={(_event, checked) => handleSelect(subscription.id, checked)}
                        aria-label={t('pages.adminSubscriptions.filters.selectAll')}
                      />
                    ) : null}
                  </Td>
                  <Td>
                    <div>
                      <div>{subscription.user.username}</div>
                      <Content component={ContentVariants.small}>{subscription.user.email}</Content>
                    </div>
                  </Td>
                  <Td>
                    <div>
                      <div>{subscription.model.name}</div>
                      <Content component={ContentVariants.small}>
                        {subscription.model.provider}
                      </Content>
                    </div>
                  </Td>
                  <Td>{getStatusBadge(subscription.status)}</Td>
                  <Td>{subscription.statusReason || '-'}</Td>
                  <Td>{new Date(subscription.createdAt).toLocaleDateString()}</Td>
                  <Td>
                    {subscription.statusChangedAt
                      ? new Date(subscription.statusChangedAt).toLocaleDateString()
                      : '-'}
                  </Td>
                  <Td isActionCell>
                    <ActionsColumn
                      items={[
                        // Only show approve/deny/revert for restricted models
                        ...(subscription.model.restrictedAccess
                          ? [
                              {
                                title: t('pages.adminSubscriptions.actions.approve'),
                                onClick: () => {
                                  setSelectedSubscription(subscription);
                                  setIsApproveModalOpen(true);
                                },
                              },
                              {
                                title: t('pages.adminSubscriptions.actions.deny'),
                                onClick: () => {
                                  setSelectedSubscription(subscription);
                                  setIsDenyModalOpen(true);
                                },
                              },
                              {
                                title: t('pages.adminSubscriptions.actions.revert'),
                                onClick: () => {
                                  setSelectedSubscription(subscription);
                                  setRevertStatus(
                                    subscription.status === 'active'
                                      ? 'denied'
                                      : subscription.status === 'denied'
                                        ? 'active'
                                        : 'pending',
                                  );
                                  setIsRevertModalOpen(true);
                                },
                              },
                            ]
                          : []),
                        // Always show delete for all subscriptions
                        {
                          title: t('pages.adminSubscriptions.actions.delete'),
                          onClick: () => {
                            setSelectedSubscription(subscription);
                            setIsDeleteModalOpen(true);
                          },
                        },
                      ]}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        {subscriptions.length > 0 && (
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

      {/* Approve Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={t('pages.adminSubscriptions.approvalModalTitle')}
        isOpen={isApproveModalOpen}
        onClose={() => {
          setIsApproveModalOpen(false);
          setBulkReason('');
          setSelectedSubscription(null);
        }}
      >
        <ModalHeader />
        <ModalBody>
          <p>
            {selectedSubscription
              ? t('pages.adminSubscriptions.confirmApprovalSingle', {
                  user: selectedSubscription.user.username,
                  model: selectedSubscription.model.name,
                })
              : t('pages.adminSubscriptions.confirmApproval', {
                  count: selectedSubscriptions.size,
                })}
          </p>
          <FormGroup label={t('pages.adminSubscriptions.reasonLabel')} fieldId="approve-reason">
            <TextArea
              id="approve-reason"
              value={bulkReason}
              onChange={(_event, value) => setBulkReason(value)}
              placeholder={t('pages.adminSubscriptions.reasonPlaceholder')}
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={async () => {
              if (selectedSubscription) {
                // Single subscription approve
                try {
                  setIsProcessing(true);
                  await adminSubscriptionsService.bulkApprove({
                    subscriptionIds: [selectedSubscription.id],
                    reason: bulkReason || undefined,
                  });
                  setIsApproveModalOpen(false);
                  setBulkReason('');
                  setSelectedSubscription(null);
                  addNotification({
                    title: t('pages.adminSubscriptions.approveSuccess', { count: 1 }),
                    variant: 'success',
                  });
                  await refetch();
                } catch (error) {
                  handleError(error);
                } finally {
                  setIsProcessing(false);
                }
              } else {
                // Bulk approve
                await handleBulkApprove();
              }
            }}
            isLoading={isProcessing}
          >
            {t('pages.adminSubscriptions.confirmApproval')}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setIsApproveModalOpen(false);
              setBulkReason('');
              setSelectedSubscription(null);
            }}
          >
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Deny Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={t('pages.adminSubscriptions.denialModalTitle')}
        isOpen={isDenyModalOpen}
        onClose={() => {
          setIsDenyModalOpen(false);
          setBulkReason('');
          setSelectedSubscription(null);
        }}
      >
        <ModalHeader />
        <ModalBody>
          <Alert variant="warning" title={t('pages.adminSubscriptions.confirmDenial')} isInline>
            <p>
              {selectedSubscription
                ? t('pages.adminSubscriptions.confirmDenialSingle', {
                    user: selectedSubscription.user.username,
                    model: selectedSubscription.model.name,
                  })
                : t('pages.adminSubscriptions.confirmDenialBulk', {
                    count: selectedSubscriptions.size,
                  })}
            </p>
          </Alert>
          <FormGroup
            label={t('pages.adminSubscriptions.reasonLabel')}
            fieldId="deny-reason"
            isRequired
          >
            <TextArea
              id="deny-reason"
              value={bulkReason}
              onChange={(_event, value) => setBulkReason(value)}
              placeholder={t('pages.adminSubscriptions.reasonPlaceholder')}
              isRequired
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={async () => {
              if (!bulkReason.trim()) {
                addNotification({
                  title: t('pages.adminSubscriptions.reasonRequired'),
                  variant: 'warning',
                });
                return;
              }

              if (selectedSubscription) {
                // Single subscription deny
                try {
                  setIsProcessing(true);
                  await adminSubscriptionsService.bulkDeny({
                    subscriptionIds: [selectedSubscription.id],
                    reason: bulkReason,
                  });
                  setIsDenyModalOpen(false);
                  setBulkReason('');
                  setSelectedSubscription(null);
                  addNotification({
                    title: t('pages.adminSubscriptions.denySuccess', { count: 1 }),
                    variant: 'success',
                  });
                  await refetch();
                } catch (error) {
                  handleError(error);
                } finally {
                  setIsProcessing(false);
                }
              } else {
                // Bulk deny
                await handleBulkDeny();
              }
            }}
            isLoading={isProcessing}
          >
            {t('pages.adminSubscriptions.confirmDenial')}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setIsDenyModalOpen(false);
              setBulkReason('');
              setSelectedSubscription(null);
            }}
          >
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Results Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={t('pages.adminSubscriptions.resultModalTitle')}
        isOpen={isResultModalOpen}
        onClose={() => {
          setIsResultModalOpen(false);
          setBulkResults(null);
        }}
      >
        <ModalHeader />
        <ModalBody>
          {bulkResults && (
            <>
              <Alert
                variant={bulkResults.failed === 0 ? 'success' : 'warning'}
                title={
                  bulkResults.failed === 0
                    ? t('pages.adminSubscriptions.resultsTable.success')
                    : t('pages.adminSubscriptions.resultModalTitle')
                }
                isInline
              >
                <p>
                  {t('pages.adminSubscriptions.resultsTable.success')}: {bulkResults.successful}
                </p>
                <p>
                  {t('pages.adminSubscriptions.resultsTable.failed')}: {bulkResults.failed}
                </p>
              </Alert>

              {bulkResults.errors.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <Title headingLevel="h3" size="md">
                    {t('pages.adminSubscriptions.resultsTable.error')}
                  </Title>
                  <ul>
                    {bulkResults.errors.map((error, index) => (
                      <li key={index}>
                        {error.subscription}: {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={() => {
              setIsResultModalOpen(false);
              setBulkResults(null);
            }}
          >
            {t('common.close')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Revert Status Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={t('pages.adminSubscriptions.revertModalTitle')}
        isOpen={isRevertModalOpen}
        onClose={() => {
          setIsRevertModalOpen(false);
          setIsRevertStatusSelectOpen(false);
          setRevertReason('');
          setSelectedSubscription(null);
        }}
      >
        <ModalHeader />
        <ModalBody>
          {selectedSubscription && (
            <>
              <p>
                {t('pages.adminSubscriptions.revertDescription', {
                  user: selectedSubscription.user.username,
                  model: selectedSubscription.model.name,
                  currentStatus: t(`pages.subscriptions.status.${selectedSubscription.status}`),
                })}
              </p>

              <FormGroup
                label={t('pages.adminSubscriptions.newStatus')}
                fieldId="revert-status"
                isRequired
              >
                <Select
                  id="revert-status"
                  isOpen={isRevertStatusSelectOpen}
                  selected={revertStatus}
                  onSelect={(_event, value) => {
                    setRevertStatus(value as 'active' | 'denied' | 'pending');
                    setIsRevertStatusSelectOpen(false);
                  }}
                  onOpenChange={(isOpen) => {
                    !isOpen && setIsRevertStatusSelectOpen(false);
                  }}
                  popperProps={{
                    appendTo: () => document.body,
                  }}
                  toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                    <MenuToggle
                      ref={toggleRef}
                      onClick={() => setIsRevertStatusSelectOpen(!isRevertStatusSelectOpen)}
                      isExpanded={isRevertStatusSelectOpen}
                    >
                      {t(`pages.subscriptions.status.${revertStatus}`)}
                    </MenuToggle>
                  )}
                >
                  <SelectList>
                    <SelectOption value="active">
                      {t('pages.subscriptions.status.active')}
                    </SelectOption>
                    <SelectOption value="denied">
                      {t('pages.subscriptions.status.denied')}
                    </SelectOption>
                    <SelectOption value="pending">
                      {t('pages.subscriptions.status.pending')}
                    </SelectOption>
                  </SelectList>
                </Select>
              </FormGroup>

              <FormGroup label={t('pages.adminSubscriptions.reasonLabel')} fieldId="revert-reason">
                <TextArea
                  id="revert-reason"
                  value={revertReason}
                  onChange={(_event, value) => setRevertReason(value)}
                  placeholder={t('pages.adminSubscriptions.reasonPlaceholder')}
                />
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleRevert} isLoading={isProcessing}>
            {t('pages.adminSubscriptions.confirmRevert')}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setIsRevertModalOpen(false);
              setIsRevertStatusSelectOpen(false);
              setRevertReason('');
              setSelectedSubscription(null);
            }}
          >
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Subscription Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={t('pages.adminSubscriptions.deleteModalTitle')}
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteReason('');
          setSelectedSubscription(null);
        }}
      >
        <ModalHeader />
        <ModalBody>
          {selectedSubscription && (
            <>
              <Alert variant="danger" title={t('pages.adminSubscriptions.deleteWarning')} isInline>
                <p>
                  {t('pages.adminSubscriptions.confirmDeleteSingle', {
                    user: selectedSubscription.user.username,
                    model: selectedSubscription.model.name,
                  })}
                </p>
              </Alert>

              <FormGroup
                label={t('pages.adminSubscriptions.reasonLabel')}
                fieldId="delete-reason"
                style={{ marginTop: '1rem' }}
              >
                <TextArea
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(_event, value) => setDeleteReason(value)}
                  placeholder={t('pages.adminSubscriptions.deleteReasonPlaceholder')}
                />
              </FormGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={isProcessing}>
            {t('pages.adminSubscriptions.confirmDelete')}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setDeleteReason('');
              setSelectedSubscription(null);
            }}
          >
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default AdminSubscriptionsPage;

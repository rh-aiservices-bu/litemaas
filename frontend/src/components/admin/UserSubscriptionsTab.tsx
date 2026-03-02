import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Button,
  Label,
  Skeleton,
  Alert,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  Modal,
  ModalVariant,
  ModalBody,
  ModalHeader,
  FormGroup,
  HelperText,
  HelperTextItem,
  TextInput,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td, ActionsColumn } from '@patternfly/react-table';
import { CubesIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { usersService } from '../../services/users.service';
import { modelsService } from '../../services/models.service';
import { adminSubscriptionsService } from '../../services/adminSubscriptions.service';
import { useNotifications } from '../../contexts/NotificationContext';
import { UserSubscription } from '../../types/users';

interface UserSubscriptionsTabProps {
  userId: string;
  canEdit?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
}

const UserSubscriptionsTab: React.FC<UserSubscriptionsTabProps> = ({ userId, canEdit = false }) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // Add subscription modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Remove confirmation modal state
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [subToRemove, setSubToRemove] = useState<UserSubscription | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  // Fetch subscriptions
  const {
    data: subscriptionsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-user-subscriptions', userId],
    queryFn: () => usersService.getUserSubscriptions(userId),
  });

  // Add subscription mutation
  const addMutation = useMutation(
    (modelIds: string[]) => usersService.createUserSubscriptions(userId, modelIds),
    {
      onSuccess: (result) => {
        queryClient.invalidateQueries(['admin-user-subscriptions', userId]);
        const totalAdded = result.created.length + result.activated.length;
        addNotification({
          title: t('users.subscriptions.addSuccess', 'Subscriptions Added'),
          description: t(
            'users.subscriptions.addSuccessDesc',
            '{{count}} subscription(s) added successfully.',
            { count: totalAdded },
          ),
          variant: 'success',
        });
        setAddModalOpen(false);
        setSelectedModelIds([]);
      },
      onError: (err: Error) => {
        addNotification({
          title: t('users.subscriptions.addError', 'Add Failed'),
          description: err.message,
          variant: 'danger',
        });
      },
    },
  );

  // Remove subscription mutation
  const removeMutation = useMutation(
    (subscriptionId: string) =>
      adminSubscriptionsService.deleteSubscription(subscriptionId, removeReason || undefined),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-user-subscriptions', userId]);
        addNotification({
          title: t('users.subscriptions.removeSuccess', 'Subscription Removed'),
          description: t(
            'users.subscriptions.removeSuccessDesc',
            'The subscription has been removed successfully.',
          ),
          variant: 'success',
        });
        setRemoveModalOpen(false);
        setSubToRemove(null);
        setRemoveReason('');
      },
      onError: (err: Error) => {
        addNotification({
          title: t('users.subscriptions.removeError', 'Remove Failed'),
          description: err.message,
          variant: 'danger',
        });
      },
    },
  );

  const loadAvailableModels = async () => {
    try {
      setLoadingModels(true);
      const response = await modelsService.getModels(1, 100);
      const subscribedModelIds = new Set(
        (subscriptionsResponse?.data || []).map((sub) => sub.modelId),
      );
      setAvailableModels(
        response.models
          .filter((m) => !subscribedModelIds.has(m.id))
          .map((m) => ({ id: m.id, name: m.name })),
      );
    } catch {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedModelIds([]);
    loadAvailableModels();
    setAddModalOpen(true);
  };

  const handleModelToggle = (modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
    );
  };

  const handleAddSubmit = () => {
    if (selectedModelIds.length === 0) return;
    addMutation.mutate(selectedModelIds);
  };

  const handleRemoveClick = (sub: UserSubscription) => {
    setSubToRemove(sub);
    setRemoveReason('');
    setRemoveModalOpen(true);
  };

  const handleConfirmRemove = () => {
    if (subToRemove) {
      removeMutation.mutate(subToRemove.id);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string): 'green' | 'orange' | 'red' | 'grey' => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'green';
      case 'pending':
        return 'orange';
      case 'denied':
      case 'revoked':
      case 'suspended':
        return 'red';
      default:
        return 'grey';
    }
  };

  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      active: t('status.active', 'Active'),
      pending: t('status.pending', 'Pending'),
      denied: t('status.denied', 'Denied'),
      revoked: t('status.revoked', 'Revoked'),
      suspended: t('status.suspended', 'Suspended'),
    };
    return statusLabels[status.toLowerCase()] || status;
  };

  if (isLoading) {
    return (
      <div style={{ padding: '1rem' }}>
        <Skeleton height="200px" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" title={t('common.error', 'Error')} isInline>
        {t('users.subscriptions.loadError', 'Failed to load subscriptions')}
      </Alert>
    );
  }

  const subscriptions = subscriptionsResponse?.data || [];

  return (
    <div style={{ paddingTop: '1rem' }}>
      {/* Add subscription button */}
      {canEdit && (
        <div style={{ marginBottom: '1rem' }}>
          <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleOpenAddModal}>
            {t('users.subscriptions.addSubscription', 'Add Subscription')}
          </Button>
        </div>
      )}

      {subscriptions.length === 0 ? (
        <EmptyState variant={EmptyStateVariant.sm}>
          <CubesIcon
            style={{
              fontSize: 'var(--pf-t--global--font--size--3xl)',
              color: 'var(--pf-t--global--color--nonstatus--gray--default)',
            }}
          />
          <Title headingLevel="h4" size="lg">
            {t('users.subscriptions.noSubscriptions', 'No Subscriptions')}
          </Title>
          <EmptyStateBody>
            {t('users.subscriptions.noSubscriptionsDesc', 'This user has no subscriptions.')}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label={t('users.subscriptions.tableLabel', 'User Subscriptions')}>
          <Thead>
            <Tr>
              <Th>{t('users.subscriptions.model', 'Model')}</Th>
              <Th>{t('users.subscriptions.provider', 'Provider')}</Th>
              <Th>{t('users.subscriptions.status', 'Status')}</Th>
              <Th>{t('users.subscriptions.createdAt', 'Created')}</Th>
              {canEdit && <Th screenReaderText={t('common.actions', 'Actions')} />}
            </Tr>
          </Thead>
          <Tbody>
            {subscriptions.map((sub) => (
              <Tr key={sub.id}>
                <Td dataLabel={t('users.subscriptions.model', 'Model')}>
                  <strong>{sub.modelName}</strong>
                </Td>
                <Td dataLabel={t('users.subscriptions.provider', 'Provider')}>
                  {sub.provider || '-'}
                </Td>
                <Td dataLabel={t('users.subscriptions.status', 'Status')}>
                  <Label color={getStatusColor(sub.status)}>{getStatusLabel(sub.status)}</Label>
                  {sub.statusReason && (
                    <div
                      style={{
                        marginTop: '0.25rem',
                        fontSize: 'var(--pf-t--global--font--size--sm)',
                        color: 'var(--pf-t--global--text--color--subtle)',
                      }}
                    >
                      {sub.statusReason}
                    </div>
                  )}
                </Td>
                <Td dataLabel={t('users.subscriptions.createdAt', 'Created')}>
                  {formatDate(sub.createdAt)}
                </Td>
                {canEdit && (
                  <Td isActionCell>
                    <ActionsColumn
                      items={[
                        {
                          title: t('users.subscriptions.remove', 'Remove'),
                          onClick: () => handleRemoveClick(sub),
                        },
                      ]}
                    />
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Add Subscription Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      >
        <ModalHeader title={t('users.subscriptions.addSubscription', 'Add Subscription')} />
        <ModalBody>
          <FormGroup
            label={t('users.subscriptions.selectModels', 'Select Models')}
            isRequired
            fieldId="add-subscription-models"
          >
            {loadingModels ? (
              <Skeleton height="40px" />
            ) : availableModels.length === 0 ? (
              <Alert
                variant="info"
                isInline
                isPlain
                title={t(
                  'users.subscriptions.noModels',
                  'No additional models available to subscribe.',
                )}
              />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {availableModels.map((model) => (
                  <Label
                    key={model.id}
                    color={selectedModelIds.includes(model.id) ? 'blue' : 'grey'}
                    onClick={() => handleModelToggle(model.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {model.name}
                  </Label>
                ))}
              </div>
            )}
            <HelperText>
              <HelperTextItem>
                {t(
                  'users.subscriptions.modelsHelp',
                  'Select one or more models to subscribe this user to.',
                )}
              </HelperTextItem>
            </HelperText>
          </FormGroup>

          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              variant="primary"
              onClick={handleAddSubmit}
              isLoading={addMutation.isLoading}
              isDisabled={addMutation.isLoading || selectedModelIds.length === 0}
            >
              {t('users.subscriptions.addSubscription', 'Add Subscription')}
            </Button>
            <Button
              variant="link"
              onClick={() => setAddModalOpen(false)}
              isDisabled={addMutation.isLoading}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        isOpen={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
      >
        <ModalHeader title={t('users.subscriptions.removeConfirmTitle', 'Remove Subscription')} />
        <ModalBody>
          <p>
            {t(
              'users.subscriptions.removeConfirmDesc',
              'Are you sure you want to remove this subscription? Associated API keys may lose access to this model.',
            )}
          </p>
          {subToRemove && (
            <p style={{ marginTop: '0.5rem' }}>
              <strong>{subToRemove.modelName}</strong>
            </p>
          )}
          <FormGroup
            label={t('users.subscriptions.removeReason', 'Reason (optional)')}
            fieldId="remove-reason"
            style={{ marginTop: '1rem' }}
          >
            <TextInput
              id="remove-reason"
              value={removeReason}
              onChange={(_event, value) => setRemoveReason(value)}
              placeholder={t(
                'users.subscriptions.removeReasonPlaceholder',
                'Enter reason for removal...',
              )}
              isDisabled={removeMutation.isLoading}
            />
          </FormGroup>
          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              variant="danger"
              onClick={handleConfirmRemove}
              isLoading={removeMutation.isLoading}
              isDisabled={removeMutation.isLoading}
            >
              {t('users.subscriptions.remove', 'Remove')}
            </Button>
            <Button
              variant="link"
              onClick={() => setRemoveModalOpen(false)}
              isDisabled={removeMutation.isLoading}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
};

export default UserSubscriptionsTab;

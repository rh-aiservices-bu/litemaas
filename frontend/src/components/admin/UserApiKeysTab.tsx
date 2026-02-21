import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  Content,
  ContentVariants,
  Form,
  FormGroup,
  TextInput,
  NumberInput,
  FormSelect,
  FormSelectOption,
  ClipboardCopy,
  HelperText,
  HelperTextItem,
  Progress,
  ProgressMeasureLocation,
  ProgressVariant,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td, ActionsColumn } from '@patternfly/react-table';
import { KeyIcon, ExternalLinkAltIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { usersService } from '../../services/users.service';
import { modelsService } from '../../services/models.service';
import { useNotifications } from '../../contexts/NotificationContext';
import { UserApiKey, CreateApiKeyForUserRequest, CreatedApiKeyResponse } from '../../types/users';

interface UserApiKeysTabProps {
  userId: string;
  canEdit: boolean;
}

interface ModelOption {
  id: string;
  name: string;
}

const UserApiKeysTab: React.FC<UserApiKeysTabProps> = ({ userId, canEdit }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // Revoke confirmation modal state
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<UserApiKey | null>(null);

  // Create API key modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [newKeyExpiration, setNewKeyExpiration] = useState('never');
  const [newKeyMaxBudget, setNewKeyMaxBudget] = useState<number | undefined>(undefined);
  const [newKeyTpmLimit, setNewKeyTpmLimit] = useState<number | undefined>(undefined);
  const [newKeyRpmLimit, setNewKeyRpmLimit] = useState<number | undefined>(undefined);
  const [newKeyBudgetDuration, setNewKeyBudgetDuration] = useState('monthly');
  const [newKeySoftBudget, setNewKeySoftBudget] = useState<number | undefined>(undefined);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<CreatedApiKeyResponse | null>(null);

  // Fetch API keys
  const {
    data: apiKeysResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-user-api-keys', userId],
    queryFn: () => usersService.getUserApiKeys(userId),
  });

  // Revoke mutation
  const revokeMutation = useMutation(
    (keyId: string) => usersService.revokeUserApiKey(userId, keyId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-user-api-keys', userId]);
        addNotification({
          title: t('users.apiKeys.revokeSuccess', 'API Key Revoked'),
          description: t(
            'users.apiKeys.revokeSuccessDesc',
            'The API key has been revoked successfully.',
          ),
          variant: 'success',
        });
        setRevokeModalOpen(false);
        setKeyToRevoke(null);
      },
      onError: (err: Error) => {
        addNotification({
          title: t('users.apiKeys.revokeError', 'Revoke Failed'),
          description: err.message,
          variant: 'danger',
        });
      },
    },
  );

  // Create mutation
  const createMutation = useMutation(
    (data: CreateApiKeyForUserRequest) => usersService.createApiKeyForUser(userId, data),
    {
      onSuccess: (createdKey: CreatedApiKeyResponse) => {
        queryClient.invalidateQueries(['admin-user-api-keys', userId]);
        setGeneratedKey(createdKey);
        setCreateModalOpen(false);
        addNotification({
          title: t('users.apiKeys.createSuccess', 'API Key Created'),
          description: t(
            'users.apiKeys.createSuccessDesc',
            'The API key has been created successfully.',
          ),
          variant: 'success',
        });
      },
      onError: (err: Error) => {
        addNotification({
          title: t('users.apiKeys.createError', 'Create Failed'),
          description: err.message,
          variant: 'danger',
        });
      },
    },
  );

  const handleViewUsage = (apiKeyId: string) => {
    navigate(`/admin/usage?apiKeyIds=${apiKeyId}`);
  };

  const handleRevokeClick = (key: UserApiKey) => {
    setKeyToRevoke(key);
    setRevokeModalOpen(true);
  };

  const handleConfirmRevoke = () => {
    if (keyToRevoke) {
      revokeMutation.mutate(keyToRevoke.id);
    }
  };

  const loadAvailableModels = async () => {
    try {
      setLoadingModels(true);
      const response = await modelsService.getModels(1, 100);
      setAvailableModels(
        response.models.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })),
      );
    } catch {
      // Models load failure is non-critical
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleOpenCreateModal = () => {
    setNewKeyName('');
    setSelectedModelIds([]);
    setNewKeyExpiration('never');
    setNewKeyMaxBudget(undefined);
    setNewKeyTpmLimit(undefined);
    setNewKeyRpmLimit(undefined);
    setNewKeyBudgetDuration('monthly');
    setNewKeySoftBudget(undefined);
    setGeneratedKey(null);
    loadAvailableModels();
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = () => {
    if (!newKeyName.trim() || selectedModelIds.length === 0) {
      return;
    }

    let expiresAt: string | undefined;
    if (newKeyExpiration !== 'never') {
      const days = parseInt(newKeyExpiration, 10);
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    createMutation.mutate({
      name: newKeyName.trim(),
      modelIds: selectedModelIds,
      expiresAt,
      maxBudget: newKeyMaxBudget,
      tpmLimit: newKeyTpmLimit,
      rpmLimit: newKeyRpmLimit,
      budgetDuration: newKeyMaxBudget ? newKeyBudgetDuration : undefined,
      softBudget: newKeySoftBudget,
    });
  };

  const handleModelToggle = (modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId],
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (key: UserApiKey): 'green' | 'red' | 'grey' => {
    if (key.revokedAt) return 'red';
    if (!key.isActive) return 'grey';
    return 'green';
  };

  const getStatusLabel = (key: UserApiKey): string => {
    if (key.revokedAt) return t('status.revoked', 'Revoked');
    if (!key.isActive) return t('status.inactive', 'Inactive');
    return t('status.active', 'Active');
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
        {t('users.apiKeys.loadError', 'Failed to load API keys')}
      </Alert>
    );
  }

  const apiKeys = apiKeysResponse?.data || [];

  return (
    <div style={{ paddingTop: '1rem' }}>
      {/* Create button */}
      {canEdit && (
        <div style={{ marginBottom: '1rem' }}>
          <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleOpenCreateModal}>
            {t('users.apiKeys.createNew', 'Create API Key')}
          </Button>
        </div>
      )}

      {apiKeys.length === 0 ? (
        <EmptyState variant={EmptyStateVariant.sm}>
          <KeyIcon
            style={{
              fontSize: 'var(--pf-t--global--font--size--3xl)',
              color: 'var(--pf-t--global--color--nonstatus--gray--default)',
            }}
          />
          <Title headingLevel="h4" size="lg">
            {t('users.apiKeys.noKeys', 'No API Keys')}
          </Title>
          <EmptyStateBody>
            {t('users.apiKeys.noKeysDesc', 'This user has no API keys.')}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label={t('users.apiKeys.tableLabel', 'User API Keys')}>
          <Thead>
            <Tr>
              <Th>{t('users.apiKeys.name', 'Name')}</Th>
              <Th>{t('users.apiKeys.status', 'Status')}</Th>
              <Th>{t('users.apiKeys.models', 'Models')}</Th>
              <Th>{t('users.apiKeys.budget', 'Budget')}</Th>
              <Th>{t('users.apiKeys.rateLimits', 'Rate Limits')}</Th>
              <Th>{t('users.apiKeys.lastUsed', 'Last Used')}</Th>
              <Th screenReaderText={t('common.actions', 'Actions')} />
            </Tr>
          </Thead>
          <Tbody>
            {apiKeys.map((key) => (
              <Tr key={key.id}>
                <Td dataLabel={t('users.apiKeys.name', 'Name')}>
                  <div>
                    <strong>{key.name}</strong>
                    <Content
                      component={ContentVariants.small}
                      style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
                    >
                      {key.keyPrefix}...
                    </Content>
                  </div>
                </Td>
                <Td dataLabel={t('users.apiKeys.status', 'Status')}>
                  <Label color={getStatusColor(key)}>{getStatusLabel(key)}</Label>
                </Td>
                <Td dataLabel={t('users.apiKeys.models', 'Models')}>
                  {key.modelDetails && key.modelDetails.length > 0 ? (
                    <div>
                      {key.modelDetails.slice(0, 2).map((model) => (
                        <Label
                          key={model.id}
                          isCompact
                          style={{ marginRight: '0.25rem', marginBottom: '0.25rem' }}
                        >
                          {model.name}
                        </Label>
                      ))}
                      {key.modelDetails.length > 2 && (
                        <Label isCompact color="grey">
                          +{key.modelDetails.length - 2}
                        </Label>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>-</span>
                  )}
                </Td>
                <Td dataLabel={t('users.apiKeys.budget', 'Budget')}>
                  {key.maxBudget ? (
                    <div>
                      <Content component={ContentVariants.small}>
                        ${(key.currentSpend || 0).toFixed(2)} / ${key.maxBudget.toFixed(2)}
                      </Content>
                      {key.budgetUtilization !== undefined && key.budgetUtilization !== null && (
                        <Progress
                          value={key.budgetUtilization}
                          measureLocation={ProgressMeasureLocation.none}
                          variant={
                            key.budgetUtilization > 90
                              ? ProgressVariant.danger
                              : key.budgetUtilization > 75
                                ? ProgressVariant.warning
                                : undefined
                          }
                          style={{ maxWidth: '120px' }}
                        />
                      )}
                      {key.budgetDuration && (
                        <Label isCompact color="blue" style={{ marginTop: '0.25rem' }}>
                          {key.budgetDuration}
                        </Label>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>-</span>
                  )}
                </Td>
                <Td dataLabel={t('users.apiKeys.rateLimits', 'Rate Limits')}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {key.tpmLimit ? (
                      <Label isCompact>{t('users.apiKeys.tpm', 'TPM')}: {key.tpmLimit.toLocaleString()}</Label>
                    ) : null}
                    {key.rpmLimit ? (
                      <Label isCompact>{t('users.apiKeys.rpm', 'RPM')}: {key.rpmLimit}</Label>
                    ) : null}
                    {!key.tpmLimit && !key.rpmLimit && (
                      <span style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>-</span>
                    )}
                  </div>
                </Td>
                <Td dataLabel={t('users.apiKeys.lastUsed', 'Last Used')}>
                  {formatDate(key.lastUsedAt)}
                </Td>
                <Td isActionCell>
                  <ActionsColumn
                    items={[
                      {
                        title: (
                          <>
                            {t('users.apiKeys.viewUsage', 'View Usage')} <ExternalLinkAltIcon />
                          </>
                        ),
                        onClick: () => handleViewUsage(key.id),
                      },
                      ...(canEdit && key.isActive && !key.revokedAt
                        ? [
                            {
                              title: t('users.apiKeys.revoke', 'Revoke'),
                              onClick: () => handleRevokeClick(key),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Revoke Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title={t('users.apiKeys.revokeConfirmTitle', 'Revoke API Key')}
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
      >
        <ModalBody>
          <p>
            {t(
              'users.apiKeys.revokeConfirmDesc',
              'Are you sure you want to revoke this API key? This action cannot be undone.',
            )}
          </p>
          {keyToRevoke && (
            <p style={{ marginTop: '0.5rem' }}>
              <strong>{keyToRevoke.name}</strong> ({keyToRevoke.keyPrefix}...)
            </p>
          )}
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
              onClick={handleConfirmRevoke}
              isLoading={revokeMutation.isLoading}
              isDisabled={revokeMutation.isLoading}
            >
              {t('users.apiKeys.revoke', 'Revoke')}
            </Button>
            <Button
              variant="link"
              onClick={() => setRevokeModalOpen(false)}
              isDisabled={revokeMutation.isLoading}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Create API Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={t('users.apiKeys.createNew', 'Create API Key')}
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      >
        <ModalBody>
          <Form>
            <FormGroup
              label={t('users.apiKeys.form.name', 'Key Name')}
              isRequired
              fieldId="create-key-name"
            >
              <TextInput
                id="create-key-name"
                value={newKeyName}
                onChange={(_event, value) => setNewKeyName(value)}
                placeholder={t(
                  'users.apiKeys.form.namePlaceholder',
                  'Enter a name for this API key',
                )}
                isRequired
                maxLength={255}
                isDisabled={createMutation.isLoading}
              />
            </FormGroup>

            <FormGroup
              label={t('users.apiKeys.form.models', 'Models')}
              isRequired
              fieldId="create-key-models"
            >
              {loadingModels ? (
                <Skeleton height="40px" />
              ) : availableModels.length === 0 ? (
                <Alert
                  variant="warning"
                  isInline
                  isPlain
                  title={t('users.apiKeys.form.noModels', 'No models available')}
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
                    'users.apiKeys.form.modelsHelp',
                    'Select one or more models for this API key.',
                  )}
                </HelperTextItem>
              </HelperText>
            </FormGroup>

            <FormGroup
              label={t('users.apiKeys.form.expiration', 'Expiration')}
              fieldId="create-key-expiration"
            >
              <FormSelect
                id="create-key-expiration"
                value={newKeyExpiration}
                onChange={(_event, value) => setNewKeyExpiration(value)}
                isDisabled={createMutation.isLoading}
              >
                <FormSelectOption
                  value="never"
                  label={t('users.apiKeys.form.expirationNever', 'Never')}
                />
                <FormSelectOption
                  value="30"
                  label={t('users.apiKeys.form.expiration30', '30 days')}
                />
                <FormSelectOption
                  value="60"
                  label={t('users.apiKeys.form.expiration60', '60 days')}
                />
                <FormSelectOption
                  value="90"
                  label={t('users.apiKeys.form.expiration90', '90 days')}
                />
              </FormSelect>
            </FormGroup>

            <FormGroup
              label={t('users.apiKeys.form.maxBudget', 'Max Budget (USD)')}
              fieldId="create-key-budget"
            >
              <NumberInput
                id="create-key-budget"
                value={newKeyMaxBudget ?? 0}
                min={0}
                onMinus={() => setNewKeyMaxBudget((prev) => Math.max(0, (prev || 0) - 10))}
                onPlus={() => setNewKeyMaxBudget((prev) => (prev || 0) + 10)}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement;
                  const value = parseFloat(target.value);
                  setNewKeyMaxBudget(isNaN(value) ? undefined : value);
                }}
                isDisabled={createMutation.isLoading}
                aria-label={t('users.apiKeys.form.maxBudget', 'Max Budget (USD)')}
                widthChars={10}
              />
            </FormGroup>

            <FormGroup
              label={t('users.apiKeys.form.budgetDuration', 'Budget Duration')}
              fieldId="create-key-budget-duration"
            >
              <FormSelect
                id="create-key-budget-duration"
                value={newKeyBudgetDuration}
                onChange={(_event, value) => setNewKeyBudgetDuration(value)}
                isDisabled={createMutation.isLoading}
              >
                <FormSelectOption value="daily" label={t('common.daily', 'Daily')} />
                <FormSelectOption value="weekly" label={t('common.weekly', 'Weekly')} />
                <FormSelectOption value="monthly" label={t('common.monthly', 'Monthly')} />
                <FormSelectOption value="yearly" label={t('common.yearly', 'Yearly')} />
              </FormSelect>
              <HelperText>
                <HelperTextItem>
                  {t('users.apiKeys.form.budgetDurationHelp', 'How often the budget resets.')}
                </HelperTextItem>
              </HelperText>
            </FormGroup>

            <FormGroup
              label={t('users.apiKeys.form.tpmLimit', 'Tokens per Minute (TPM)')}
              fieldId="create-key-tpm"
            >
              <NumberInput
                id="create-key-tpm"
                value={newKeyTpmLimit ?? 0}
                min={0}
                onMinus={() => setNewKeyTpmLimit((prev) => Math.max(0, (prev || 0) - 1000))}
                onPlus={() => setNewKeyTpmLimit((prev) => (prev || 0) + 1000)}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement;
                  const value = parseInt(target.value);
                  setNewKeyTpmLimit(isNaN(value) ? undefined : value);
                }}
                isDisabled={createMutation.isLoading}
                aria-label={t('users.apiKeys.form.tpmLimit', 'Tokens per Minute (TPM)')}
                widthChars={10}
              />
              <HelperText>
                <HelperTextItem>
                  {t('users.apiKeys.form.tpmLimitHelp', 'Leave at 0 for no limit. Superseded by user-level limit.')}
                </HelperTextItem>
              </HelperText>
            </FormGroup>

            <FormGroup
              label={t('users.apiKeys.form.rpmLimit', 'Requests per Minute (RPM)')}
              fieldId="create-key-rpm"
            >
              <NumberInput
                id="create-key-rpm"
                value={newKeyRpmLimit ?? 0}
                min={0}
                onMinus={() => setNewKeyRpmLimit((prev) => Math.max(0, (prev || 0) - 10))}
                onPlus={() => setNewKeyRpmLimit((prev) => (prev || 0) + 10)}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement;
                  const value = parseInt(target.value);
                  setNewKeyRpmLimit(isNaN(value) ? undefined : value);
                }}
                isDisabled={createMutation.isLoading}
                aria-label={t('users.apiKeys.form.rpmLimit', 'Requests per Minute (RPM)')}
                widthChars={10}
              />
              <HelperText>
                <HelperTextItem>
                  {t('users.apiKeys.form.rpmLimitHelp', 'Leave at 0 for no limit. Superseded by user-level limit.')}
                </HelperTextItem>
              </HelperText>
            </FormGroup>

            <FormGroup
              label={t('users.apiKeys.form.softBudget', 'Soft Budget Warning (USD)')}
              fieldId="create-key-soft-budget"
            >
              <NumberInput
                id="create-key-soft-budget"
                value={newKeySoftBudget ?? 0}
                min={0}
                onMinus={() => setNewKeySoftBudget((prev) => Math.max(0, (prev || 0) - 5))}
                onPlus={() => setNewKeySoftBudget((prev) => (prev || 0) + 5)}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement;
                  const value = parseFloat(target.value);
                  setNewKeySoftBudget(isNaN(value) ? undefined : value);
                }}
                isDisabled={createMutation.isLoading}
                aria-label={t('users.apiKeys.form.softBudget', 'Soft Budget Warning (USD)')}
                widthChars={10}
              />
              <HelperText>
                <HelperTextItem>
                  {t('users.apiKeys.form.softBudgetHelp', 'Alert threshold before hitting max budget. Leave at 0 for none.')}
                </HelperTextItem>
              </HelperText>
            </FormGroup>
          </Form>

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
              onClick={handleCreateSubmit}
              isLoading={createMutation.isLoading}
              isDisabled={
                createMutation.isLoading || !newKeyName.trim() || selectedModelIds.length === 0
              }
            >
              {t('users.apiKeys.form.create', 'Create')}
            </Button>
            <Button
              variant="link"
              onClick={() => setCreateModalOpen(false)}
              isDisabled={createMutation.isLoading}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Generated Key Display Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={t('users.apiKeys.keyGenerated', 'API Key Generated')}
        isOpen={!!generatedKey}
        onClose={() => setGeneratedKey(null)}
      >
        <ModalBody>
          <Alert
            variant="warning"
            isInline
            title={t('users.apiKeys.keyWarning', 'Save this key now')}
            style={{ marginBottom: '1rem' }}
          >
            {t(
              'users.apiKeys.keyWarningDesc',
              'This is the only time the full API key will be shown. Copy it now and store it securely.',
            )}
          </Alert>
          {generatedKey && (
            <>
              <FormGroup
                label={t('users.apiKeys.form.name', 'Key Name')}
                fieldId="generated-key-name"
              >
                <Content>{generatedKey.name}</Content>
              </FormGroup>
              <FormGroup
                label={t('users.apiKeys.form.apiKey', 'API Key')}
                fieldId="generated-key-value"
              >
                <ClipboardCopy
                  isReadOnly
                  hoverTip={t('common.copy', 'Copy')}
                  clickTip={t('common.copied', 'Copied')}
                >
                  {generatedKey.key}
                </ClipboardCopy>
              </FormGroup>
            </>
          )}
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={() => setGeneratedKey(null)}>
              {t('common.done', 'Done')}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
};

export default UserApiKeysTab;

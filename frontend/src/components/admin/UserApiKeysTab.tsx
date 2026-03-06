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
  ModalFooter,
  ModalHeader,
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
  ExpandableSection,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td, ActionsColumn } from '@patternfly/react-table';
import { KeyIcon, ExternalLinkAltIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { usersService } from '../../services/users.service';
import { modelsService } from '../../services/models.service';
import { useNotifications } from '../../contexts/NotificationContext';
import { useCurrency } from '../../contexts/ConfigContext';
import {
  UserApiKey,
  CreateApiKeyForUserRequest,
  CreatedApiKeyResponse,
  UpdateApiKeyForUserRequest,
} from '../../types/users';

interface UserApiKeysTabProps {
  userId: string;
  canEdit: boolean;
}

interface ModelOption {
  id: string;
  name: string;
}

interface ModelLimits {
  budget?: number;
  timePeriod?: string;
  rpm?: number;
  tpm?: number;
}

const UserApiKeysTab: React.FC<UserApiKeysTabProps> = ({ userId, canEdit }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const { formatCurrency, currencyCode } = useCurrency();

  // Revoke confirmation modal state
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<UserApiKey | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<UserApiKey | null>(null);

  // Reset spend confirmation modal state (shown within edit modal)
  const [resetSpendModalOpen, setResetSpendModalOpen] = useState(false);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [keyToEdit, setKeyToEdit] = useState<UserApiKey | null>(null);

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
  const [newKeyMaxParallelRequests, setNewKeyMaxParallelRequests] = useState<number | undefined>(
    undefined,
  );
  const [newKeyModelLimits, setNewKeyModelLimits] = useState<Record<string, ModelLimits>>({});
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<CreatedApiKeyResponse | null>(null);

  // Edit form state (reuses same field names with edit prefix to avoid conflicts)
  const [editSelectedModelIds, setEditSelectedModelIds] = useState<string[]>([]);
  const [editMaxBudget, setEditMaxBudget] = useState<number | undefined>(undefined);
  const [editTpmLimit, setEditTpmLimit] = useState<number | undefined>(undefined);
  const [editRpmLimit, setEditRpmLimit] = useState<number | undefined>(undefined);
  const [editBudgetDuration, setEditBudgetDuration] = useState('monthly');
  const [editSoftBudget, setEditSoftBudget] = useState<number | undefined>(undefined);
  const [editMaxParallelRequests, setEditMaxParallelRequests] = useState<number | undefined>(
    undefined,
  );
  const [editModelLimits, setEditModelLimits] = useState<Record<string, ModelLimits>>({});

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
            'The API key has been deactivated successfully.',
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

  // Delete mutation
  const deleteMutation = useMutation(
    (keyId: string) => usersService.deleteUserApiKey(userId, keyId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-user-api-keys', userId]);
        addNotification({
          title: t('users.apiKeys.deleteSuccess', 'API Key Deleted'),
          description: t(
            'users.apiKeys.deleteSuccessDesc',
            'The API key has been permanently deleted.',
          ),
          variant: 'success',
        });
        setDeleteModalOpen(false);
        setKeyToDelete(null);
      },
      onError: (err: Error) => {
        addNotification({
          title: t('users.apiKeys.deleteError', 'Delete Failed'),
          description: err.message,
          variant: 'danger',
        });
      },
    },
  );

  // Reset spend mutation
  const resetSpendMutation = useMutation(
    (keyId: string) => usersService.resetApiKeySpend(userId, keyId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-user-api-keys', userId]);
        addNotification({
          title: t('users.apiKeys.resetSpendSuccess', 'Spend Reset'),
          description: t(
            'users.apiKeys.resetSpendSuccessDesc',
            `The API key spend has been reset to ${formatCurrency(0)}.`,
          ),
          variant: 'success',
        });
        setResetSpendModalOpen(false);
        // Update keyToEdit in-place so the progress bar reflects the reset
        if (keyToEdit) {
          setKeyToEdit({ ...keyToEdit, currentSpend: 0 });
        }
      },
      onError: (err: Error) => {
        addNotification({
          title: t('users.apiKeys.resetSpendError', 'Reset Spend Failed'),
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

  // Update mutation
  const updateMutation = useMutation(
    (data: UpdateApiKeyForUserRequest & { keyId: string }) => {
      const { keyId, ...updateData } = data;
      return usersService.updateUserApiKey(userId, keyId, updateData);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-user-api-keys', userId]);
        addNotification({
          title: t('users.apiKeys.editSuccess', 'API Key Updated'),
          description: t(
            'users.apiKeys.editSuccessDesc',
            'The API key has been updated successfully.',
          ),
          variant: 'success',
        });
        setEditModalOpen(false);
        setKeyToEdit(null);
      },
      onError: (err: Error) => {
        addNotification({
          title: t('users.apiKeys.editError', 'Update Failed'),
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

  const handleDeleteClick = (key: UserApiKey) => {
    setKeyToDelete(key);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (keyToDelete) {
      deleteMutation.mutate(keyToDelete.id);
    }
  };

  const handleConfirmResetSpend = () => {
    if (keyToEdit) {
      resetSpendMutation.mutate(keyToEdit.id);
    }
  };

  const handleEditClick = (key: UserApiKey) => {
    setKeyToEdit(key);
    // Pre-fill edit form with existing key data
    setEditSelectedModelIds(key.models || []);
    setEditMaxBudget(key.maxBudget ?? undefined);
    setEditTpmLimit(key.tpmLimit ?? undefined);
    setEditRpmLimit(key.rpmLimit ?? undefined);
    setEditBudgetDuration(key.budgetDuration || 'monthly');
    setEditSoftBudget(key.softBudget ?? undefined);
    setEditMaxParallelRequests(key.maxParallelRequests ?? undefined);

    // Pre-fill per-model limits
    const modelLimits: Record<string, ModelLimits> = {};
    if (key.modelMaxBudget) {
      for (const [modelId, config] of Object.entries(key.modelMaxBudget)) {
        modelLimits[modelId] = {
          ...modelLimits[modelId],
          budget: config.budgetLimit,
          timePeriod: config.timePeriod,
        };
      }
    }
    if (key.modelRpmLimit) {
      for (const [modelId, rpm] of Object.entries(key.modelRpmLimit)) {
        modelLimits[modelId] = { ...modelLimits[modelId], rpm };
      }
    }
    if (key.modelTpmLimit) {
      for (const [modelId, tpm] of Object.entries(key.modelTpmLimit)) {
        modelLimits[modelId] = { ...modelLimits[modelId], tpm };
      }
    }
    setEditModelLimits(modelLimits);

    loadAvailableModels();
    setEditModalOpen(true);
  };

  const handleEditSubmit = () => {
    if (!keyToEdit || editSelectedModelIds.length === 0) return;

    // Validate per-model limits against key-level limits
    for (const [modelId, limits] of Object.entries(editModelLimits)) {
      if (!editSelectedModelIds.includes(modelId)) continue;
      const modelName = availableModels.find((m) => m.id === modelId)?.name || modelId;
      if (
        limits.budget != null &&
        limits.budget > 0 &&
        editMaxBudget != null &&
        limits.budget > editMaxBudget
      ) {
        addNotification({
          title: t('users.apiKeys.form.validationError', 'Validation Error'),
          description: t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('users.apiKeys.form.modelBudget', {
              defaultValue: 'Budget ({{currencyCode}})',
              currencyCode,
            }),
            max: editMaxBudget,
          }),
          variant: 'danger',
        });
        return;
      }
      if (
        limits.rpm != null &&
        limits.rpm > 0 &&
        editRpmLimit != null &&
        limits.rpm > editRpmLimit
      ) {
        addNotification({
          title: t('users.apiKeys.form.validationError', 'Validation Error'),
          description: t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('users.apiKeys.form.rpmLimit', 'RPM'),
            max: editRpmLimit,
          }),
          variant: 'danger',
        });
        return;
      }
      if (
        limits.tpm != null &&
        limits.tpm > 0 &&
        editTpmLimit != null &&
        limits.tpm > editTpmLimit
      ) {
        addNotification({
          title: t('users.apiKeys.form.validationError', 'Validation Error'),
          description: t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('users.apiKeys.form.tpmLimit', 'TPM'),
            max: editTpmLimit,
          }),
          variant: 'danger',
        });
        return;
      }
    }

    // Build per-model limits
    const modelMaxBudget: Record<string, { budgetLimit: number; timePeriod: string }> = {};
    const modelRpmLimit: Record<string, number> = {};
    const modelTpmLimit: Record<string, number> = {};

    for (const [modelId, limits] of Object.entries(editModelLimits)) {
      if (!editSelectedModelIds.includes(modelId)) continue;
      if (limits.budget && limits.budget > 0) {
        modelMaxBudget[modelId] = {
          budgetLimit: limits.budget,
          timePeriod: limits.timePeriod || 'monthly',
        };
      }
      if (limits.rpm && limits.rpm > 0) {
        modelRpmLimit[modelId] = limits.rpm;
      }
      if (limits.tpm && limits.tpm > 0) {
        modelTpmLimit[modelId] = limits.tpm;
      }
    }

    // Only include per-model properties when non-empty to avoid wiping DB values
    const perModelPayload: Record<string, unknown> = {};
    if (Object.keys(modelMaxBudget).length > 0) perModelPayload.modelMaxBudget = modelMaxBudget;
    if (Object.keys(modelRpmLimit).length > 0) perModelPayload.modelRpmLimit = modelRpmLimit;
    if (Object.keys(modelTpmLimit).length > 0) perModelPayload.modelTpmLimit = modelTpmLimit;

    updateMutation.mutate({
      keyId: keyToEdit.id,
      modelIds: editSelectedModelIds,
      maxBudget: editMaxBudget ?? null,
      tpmLimit: editTpmLimit ?? null,
      rpmLimit: editRpmLimit ?? null,
      budgetDuration: editMaxBudget ? editBudgetDuration : null,
      softBudget: editSoftBudget ?? null,
      maxParallelRequests: editMaxParallelRequests ?? null,
      ...perModelPayload,
    });
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
    setNewKeyMaxParallelRequests(undefined);
    setNewKeyBudgetDuration('monthly');
    setNewKeySoftBudget(undefined);
    setNewKeyModelLimits({});
    setGeneratedKey(null);
    loadAvailableModels();
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = () => {
    if (!newKeyName.trim() || selectedModelIds.length === 0) {
      return;
    }

    // Validate per-model limits against key-level limits
    for (const [modelId, limits] of Object.entries(newKeyModelLimits)) {
      if (!selectedModelIds.includes(modelId)) continue;
      const modelName = availableModels.find((m) => m.id === modelId)?.name || modelId;
      if (
        limits.budget != null &&
        limits.budget > 0 &&
        newKeyMaxBudget != null &&
        limits.budget > newKeyMaxBudget
      ) {
        addNotification({
          title: t('users.apiKeys.form.validationError', 'Validation Error'),
          description: t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('users.apiKeys.form.modelBudget', {
              defaultValue: 'Budget ({{currencyCode}})',
              currencyCode,
            }),
            max: newKeyMaxBudget,
          }),
          variant: 'danger',
        });
        return;
      }
      if (
        limits.rpm != null &&
        limits.rpm > 0 &&
        newKeyRpmLimit != null &&
        limits.rpm > newKeyRpmLimit
      ) {
        addNotification({
          title: t('users.apiKeys.form.validationError', 'Validation Error'),
          description: t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('users.apiKeys.form.rpmLimit', 'RPM'),
            max: newKeyRpmLimit,
          }),
          variant: 'danger',
        });
        return;
      }
      if (
        limits.tpm != null &&
        limits.tpm > 0 &&
        newKeyTpmLimit != null &&
        limits.tpm > newKeyTpmLimit
      ) {
        addNotification({
          title: t('users.apiKeys.form.validationError', 'Validation Error'),
          description: t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('users.apiKeys.form.tpmLimit', 'TPM'),
            max: newKeyTpmLimit,
          }),
          variant: 'danger',
        });
        return;
      }
    }

    let expiresAt: string | undefined;
    if (newKeyExpiration !== 'never') {
      const days = parseInt(newKeyExpiration, 10);
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    // Build per-model limits from state (only include non-zero values)
    const modelMaxBudget: Record<string, { budgetLimit: number; timePeriod: string }> = {};
    const modelRpmLimit: Record<string, number> = {};
    const modelTpmLimit: Record<string, number> = {};

    for (const [modelId, limits] of Object.entries(newKeyModelLimits)) {
      if (!selectedModelIds.includes(modelId)) continue;
      if (limits.budget && limits.budget > 0) {
        modelMaxBudget[modelId] = {
          budgetLimit: limits.budget,
          timePeriod: limits.timePeriod || 'monthly',
        };
      }
      if (limits.rpm && limits.rpm > 0) {
        modelRpmLimit[modelId] = limits.rpm;
      }
      if (limits.tpm && limits.tpm > 0) {
        modelTpmLimit[modelId] = limits.tpm;
      }
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
      maxParallelRequests: newKeyMaxParallelRequests,
      modelMaxBudget: Object.keys(modelMaxBudget).length > 0 ? modelMaxBudget : undefined,
      modelRpmLimit: Object.keys(modelRpmLimit).length > 0 ? modelRpmLimit : undefined,
      modelTpmLimit: Object.keys(modelTpmLimit).length > 0 ? modelTpmLimit : undefined,
    });
  };

  const handleModelToggle = (modelId: string) => {
    setSelectedModelIds((prev) => {
      if (prev.includes(modelId)) {
        // Clean up per-model limits when deselecting
        setNewKeyModelLimits((prevLimits) => {
          const updated = { ...prevLimits };
          delete updated[modelId];
          return updated;
        });
        return prev.filter((id) => id !== modelId);
      }
      return [...prev, modelId];
    });
  };

  const handleEditModelToggle = (modelId: string) => {
    setEditSelectedModelIds((prev) => {
      if (prev.includes(modelId)) {
        setEditModelLimits((prevLimits) => {
          const updated = { ...prevLimits };
          delete updated[modelId];
          return updated;
        });
        return prev.filter((id) => id !== modelId);
      }
      return [...prev, modelId];
    });
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

  // Shared form fields renderer for both create and edit modals
  const renderQuotaFields = (
    prefix: string,
    isLoading: boolean,
    maxBudget: number | undefined,
    setMaxBudget: (v: number | undefined) => void,
    budgetDuration: string,
    setBudgetDuration: (v: string) => void,
    tpmLimit: number | undefined,
    setTpmLimit: (v: number | undefined) => void,
    rpmLimit: number | undefined,
    setRpmLimit: (v: number | undefined) => void,
    softBudget: number | undefined,
    setSoftBudget: (v: number | undefined) => void,
    maxParallelRequests: number | undefined,
    setMaxParallelRequests: (v: number | undefined) => void,
    modelIds: string[],
    modelLimits: Record<string, ModelLimits>,
    setModelLimits: (
      v:
        | Record<string, ModelLimits>
        | ((prev: Record<string, ModelLimits>) => Record<string, ModelLimits>),
    ) => void,
    showSoftBudget = true,
  ) => (
    <>
      <FormGroup
        label={t('users.apiKeys.form.maxBudget', {
          defaultValue: 'Max Budget ({{currencyCode}})',
          currencyCode,
        })}
        fieldId={`${prefix}-key-budget`}
      >
        <NumberInput
          id={`${prefix}-key-budget`}
          value={maxBudget ?? 0}
          min={0}
          onMinus={() => setMaxBudget(Math.max(0, (maxBudget || 0) - 10))}
          onPlus={() => setMaxBudget((maxBudget || 0) + 10)}
          onChange={(event) => {
            const target = event.target as HTMLInputElement;
            const value = parseFloat(target.value);
            setMaxBudget(isNaN(value) ? undefined : value);
          }}
          isDisabled={isLoading}
          aria-label={t('users.apiKeys.form.maxBudget', {
            defaultValue: 'Max Budget ({{currencyCode}})',
            currencyCode,
          })}
          widthChars={10}
        />
      </FormGroup>

      {maxBudget !== undefined && maxBudget > 0 && (
        <FormGroup
          label={t('users.apiKeys.form.budgetDuration', 'Budget Duration')}
          fieldId={`${prefix}-key-budget-duration`}
        >
          <FormSelect
            id={`${prefix}-key-budget-duration`}
            value={budgetDuration}
            onChange={(_event, value) => setBudgetDuration(value)}
            isDisabled={isLoading}
          >
            <FormSelectOption value="daily" label={t('common.daily', 'Daily')} />
            <FormSelectOption value="weekly" label={t('common.weekly', 'Weekly')} />
            <FormSelectOption value="monthly" label={t('common.monthly', 'Monthly')} />
            <FormSelectOption value="yearly" label={t('common.yearly', 'Yearly')} />
            <FormSelectOption value="1h" label={t('common.hourly', '1 Hour')} />
            <FormSelectOption value="30d" label={t('common.thirtyDays', '30 Days')} />
            <FormSelectOption value="1mo" label={t('common.oneMonth', '1 Month (calendar)')} />
          </FormSelect>
          <HelperText>
            <HelperTextItem>
              {t('users.apiKeys.form.budgetDurationHelp', 'How often the budget resets.')}
            </HelperTextItem>
          </HelperText>
        </FormGroup>
      )}

      <FormGroup
        label={t('users.apiKeys.form.tpmLimit', 'Tokens per Minute (TPM)')}
        fieldId={`${prefix}-key-tpm`}
      >
        <TextInput
          id={`${prefix}-key-tpm`}
          type="number"
          min="0"
          value={tpmLimit ?? ''}
          onChange={(_event, value) => {
            const parsed = parseInt(value, 10);
            setTpmLimit(value === '' || isNaN(parsed) || parsed < 0 ? undefined : parsed);
          }}
          isDisabled={isLoading}
          aria-label={t('users.apiKeys.form.tpmLimit', 'Tokens per Minute (TPM)')}
        />
        <HelperText>
          <HelperTextItem>
            {t(
              'users.apiKeys.form.tpmLimitHelp',
              'Leave empty for no limit. Superseded by user-level limit.',
            )}
          </HelperTextItem>
        </HelperText>
      </FormGroup>

      <FormGroup
        label={t('users.apiKeys.form.rpmLimit', 'Requests per Minute (RPM)')}
        fieldId={`${prefix}-key-rpm`}
      >
        <TextInput
          id={`${prefix}-key-rpm`}
          type="number"
          min="0"
          value={rpmLimit ?? ''}
          onChange={(_event, value) => {
            const parsed = parseInt(value, 10);
            setRpmLimit(value === '' || isNaN(parsed) || parsed < 0 ? undefined : parsed);
          }}
          isDisabled={isLoading}
          aria-label={t('users.apiKeys.form.rpmLimit', 'Requests per Minute (RPM)')}
        />
        <HelperText>
          <HelperTextItem>
            {t(
              'users.apiKeys.form.rpmLimitHelp',
              'Leave empty for no limit. Superseded by user-level limit.',
            )}
          </HelperTextItem>
        </HelperText>
      </FormGroup>

      {showSoftBudget && maxBudget !== undefined && maxBudget > 0 && (
        <FormGroup
          label={t('users.apiKeys.form.softBudget', {
            defaultValue: 'Soft Budget Warning ({{currencyCode}})',
            currencyCode,
          })}
          fieldId={`${prefix}-key-soft-budget`}
        >
          <NumberInput
            id={`${prefix}-key-soft-budget`}
            value={softBudget ?? 0}
            min={0}
            onMinus={() => setSoftBudget(Math.max(0, (softBudget || 0) - 5))}
            onPlus={() => setSoftBudget((softBudget || 0) + 5)}
            onChange={(event) => {
              const target = event.target as HTMLInputElement;
              const value = parseFloat(target.value);
              setSoftBudget(isNaN(value) ? undefined : value);
            }}
            isDisabled={isLoading}
            aria-label={t('users.apiKeys.form.softBudget', {
              defaultValue: 'Soft Budget Warning ({{currencyCode}})',
              currencyCode,
            })}
            widthChars={10}
          />
          <HelperText>
            <HelperTextItem>
              {t(
                'users.apiKeys.form.softBudgetHelp',
                'Alert threshold before hitting max budget. Leave at 0 for none.',
              )}
            </HelperTextItem>
          </HelperText>
        </FormGroup>
      )}

      <FormGroup
        label={t('users.apiKeys.form.maxParallelRequests', 'Max Parallel Requests')}
        fieldId={`${prefix}-key-max-parallel`}
      >
        <NumberInput
          id={`${prefix}-key-max-parallel`}
          value={maxParallelRequests ?? 0}
          min={0}
          onMinus={() => setMaxParallelRequests(Math.max(0, (maxParallelRequests || 0) - 1))}
          onPlus={() => setMaxParallelRequests((maxParallelRequests || 0) + 1)}
          onChange={(event) => {
            const target = event.target as HTMLInputElement;
            const value = parseInt(target.value);
            setMaxParallelRequests(isNaN(value) || value === 0 ? undefined : value);
          }}
          isDisabled={isLoading}
          aria-label={t('users.apiKeys.form.maxParallelRequests', 'Max Parallel Requests')}
          widthChars={10}
        />
        <HelperText>
          <HelperTextItem>
            {t(
              'users.apiKeys.form.maxParallelRequestsHelp',
              'Maximum concurrent in-flight requests. Leave at 0 for no limit.',
            )}
          </HelperTextItem>
        </HelperText>
      </FormGroup>

      {modelIds.length > 0 && (
        <ExpandableSection
          toggleText={t('users.apiKeys.form.perModelLimits', 'Per-Model Limits')}
          isIndented
        >
          <HelperText style={{ marginBottom: '0.75rem' }}>
            <HelperTextItem>
              {t(
                'users.apiKeys.form.perModelLimitsHelp',
                'Set per-model budget and rate limits. These apply independently of global key limits.',
              )}
            </HelperTextItem>
          </HelperText>
          {modelIds.map((modelId) => {
            const modelName = availableModels.find((m) => m.id === modelId)?.name || modelId;
            const limits = modelLimits[modelId] || {};
            const updateModelLimit = (field: string, value: number | string | undefined) => {
              setModelLimits((prev: Record<string, ModelLimits>) => ({
                ...prev,
                [modelId]: { ...prev[modelId], [field]: value },
              }));
            };
            return (
              <div
                key={modelId}
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  border: '1px solid var(--pf-t--global--border--color--default)',
                  borderRadius: 'var(--pf-t--global--border--radius--small)',
                }}
              >
                <Content
                  component={ContentVariants.small}
                  style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}
                >
                  {modelName}
                </Content>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {/* Per-model budget hidden: requires LiteLLM Enterprise license */}
                  <FormGroup
                    label={t('users.apiKeys.form.modelRpm', 'RPM')}
                    fieldId={`${prefix}-model-rpm-${modelId}`}
                  >
                    <TextInput
                      id={`${prefix}-model-rpm-${modelId}`}
                      type="number"
                      min="0"
                      value={limits.rpm ?? ''}
                      onChange={(_event, value) => {
                        const parsed = parseInt(value, 10);
                        updateModelLimit(
                          'rpm',
                          value === '' || isNaN(parsed) || parsed < 0 ? undefined : parsed,
                        );
                      }}
                      isDisabled={isLoading}
                      aria-label={`${modelName} RPM`}
                    />
                  </FormGroup>
                  <FormGroup
                    label={t('users.apiKeys.form.modelTpm', 'TPM')}
                    fieldId={`${prefix}-model-tpm-${modelId}`}
                  >
                    <TextInput
                      id={`${prefix}-model-tpm-${modelId}`}
                      type="number"
                      min="0"
                      value={limits.tpm ?? ''}
                      onChange={(_event, value) => {
                        const parsed = parseInt(value, 10);
                        updateModelLimit(
                          'tpm',
                          value === '' || isNaN(parsed) || parsed < 0 ? undefined : parsed,
                        );
                      }}
                      isDisabled={isLoading}
                      aria-label={`${modelName} TPM`}
                    />
                  </FormGroup>
                </div>
              </div>
            );
          })}
        </ExpandableSection>
      )}
    </>
  );

  // Shared model selector renderer
  const renderModelSelector = (
    prefix: string,
    _isLoading: boolean,
    selectedIds: string[],
    setSelectedIds: (ids: string[]) => void,
    onToggle: (modelId: string) => void,
    clearModelLimits: () => void,
  ) => (
    <FormGroup
      label={t('users.apiKeys.form.models', 'Models')}
      isRequired
      fieldId={`${prefix}-key-models`}
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
          <Label
            color="purple"
            onClick={() => {
              if (selectedIds.length === availableModels.length) {
                setSelectedIds([]);
                clearModelLimits();
              } else {
                setSelectedIds(availableModels.map((m) => m.id));
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {selectedIds.length === availableModels.length
              ? t('users.apiKeys.form.deselectAll', 'Deselect All')
              : t('users.apiKeys.form.selectAll', 'Select All')}
          </Label>
          {availableModels.map((model) => (
            <Label
              key={model.id}
              color={selectedIds.includes(model.id) ? 'blue' : 'grey'}
              onClick={() => onToggle(model.id)}
              style={{ cursor: 'pointer' }}
            >
              {model.name}
            </Label>
          ))}
        </div>
      )}
      <HelperText>
        <HelperTextItem>
          {t('users.apiKeys.form.modelsHelp', 'Select one or more models for this API key.')}
        </HelperTextItem>
      </HelperText>
    </FormGroup>
  );

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
                        {formatCurrency(key.currentSpend || 0)} / {formatCurrency(key.maxBudget)}
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
                      <Label isCompact>
                        {t('users.apiKeys.tpm', 'TPM')}: {key.tpmLimit.toLocaleString()}
                      </Label>
                    ) : null}
                    {key.rpmLimit ? (
                      <Label isCompact>
                        {t('users.apiKeys.rpm', 'RPM')}: {key.rpmLimit}
                      </Label>
                    ) : null}
                    {key.maxParallelRequests ? (
                      <Label isCompact>
                        {t('users.apiKeys.parallel', 'Parallel')}: {key.maxParallelRequests}
                      </Label>
                    ) : null}
                    {!key.tpmLimit && !key.rpmLimit && !key.maxParallelRequests && (
                      <span style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>-</span>
                    )}
                    {(key.modelRpmLimit || key.modelTpmLimit || key.modelMaxBudget) && (
                      <Label isCompact color="blue">
                        {t('users.apiKeys.perModel', 'Per-model')}
                      </Label>
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
                              title: t('users.apiKeys.edit', 'Edit'),
                              onClick: () => handleEditClick(key),
                            },
                            {
                              title: t('users.apiKeys.revoke', 'Revoke'),
                              onClick: () => handleRevokeClick(key),
                            },
                          ]
                        : []),
                      ...(canEdit
                        ? [
                            {
                              isSeparator: true as const,
                            },
                            {
                              title: t('users.apiKeys.delete', 'Delete'),
                              onClick: () => handleDeleteClick(key),
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
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
      >
        <ModalHeader title={t('users.apiKeys.revokeConfirmTitle', 'Revoke API Key')} />
        <ModalBody>
          <p>
            {t(
              'users.apiKeys.revokeConfirmDesc',
              'Are you sure you want to revoke this API key? The key will be deactivated and can no longer be used.',
            )}
          </p>
          {keyToRevoke && (
            <p style={{ marginTop: '0.5rem' }}>
              <strong>{keyToRevoke.name}</strong> ({keyToRevoke.keyPrefix}...)
            </p>
          )}
        </ModalBody>
        <ModalFooter>
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
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      >
        <ModalHeader title={t('users.apiKeys.deleteConfirmTitle', 'Delete API Key')} />
        <ModalBody>
          <Alert
            variant="danger"
            isInline
            title={t('users.apiKeys.deleteWarning', 'This action is permanent')}
            style={{ marginBottom: '1rem' }}
          >
            {t(
              'users.apiKeys.deleteWarningDesc',
              'This API key will be permanently removed from the system. This action cannot be undone.',
            )}
          </Alert>
          {keyToDelete && (
            <p>
              <strong>{keyToDelete.name}</strong> ({keyToDelete.keyPrefix}...)
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            isLoading={deleteMutation.isLoading}
            isDisabled={deleteMutation.isLoading}
          >
            {t('users.apiKeys.deleteConfirm', 'Delete Permanently')}
          </Button>
          <Button
            variant="link"
            onClick={() => setDeleteModalOpen(false)}
            isDisabled={deleteMutation.isLoading}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit API Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
      >
        <ModalHeader title={t('users.apiKeys.editTitle', 'Edit API Key')} />
        <ModalBody>
          <Form>
            {/* Name shown as read-only */}
            <FormGroup label={t('users.apiKeys.form.name', 'Key Name')} fieldId="edit-key-name">
              <Content>{keyToEdit?.name}</Content>
            </FormGroup>

            {renderModelSelector(
              'edit',
              updateMutation.isLoading,
              editSelectedModelIds,
              setEditSelectedModelIds,
              handleEditModelToggle,
              () => setEditModelLimits({}),
            )}

            {/* Current Spend with Progress Bar and Reset Button */}
            {keyToEdit && (
              <FormGroup
                label={t('users.apiKeys.currentSpend', 'Current Spend')}
                fieldId="edit-current-spend"
              >
                <Split hasGutter style={{ alignItems: 'center' }}>
                  <SplitItem isFilled>
                    <Progress
                      value={
                        keyToEdit.currentSpend != null && keyToEdit.maxBudget
                          ? Math.min((keyToEdit.currentSpend / keyToEdit.maxBudget) * 100, 100)
                          : 0
                      }
                      measureLocation={ProgressMeasureLocation.outside}
                      aria-label={t('users.budget.budgetUtilization', 'Budget utilization')}
                      variant={
                        keyToEdit.currentSpend != null && keyToEdit.maxBudget
                          ? (keyToEdit.currentSpend / keyToEdit.maxBudget) * 100 > 95
                            ? ProgressVariant.danger
                            : (keyToEdit.currentSpend / keyToEdit.maxBudget) * 100 > 80
                              ? ProgressVariant.warning
                              : undefined
                          : undefined
                      }
                    />
                  </SplitItem>
                  {canEdit && (keyToEdit.currentSpend ?? 0) > 0 && (
                    <SplitItem>
                      <Button
                        variant="secondary"
                        isDanger
                        onClick={() => setResetSpendModalOpen(true)}
                        isDisabled={resetSpendMutation.isLoading}
                      >
                        {t('users.apiKeys.resetSpend', 'Reset Spend')}
                      </Button>
                    </SplitItem>
                  )}
                </Split>
                <HelperText>
                  <HelperTextItem>
                    {formatCurrency(keyToEdit.currentSpend || 0)} /{' '}
                    {keyToEdit.maxBudget != null
                      ? formatCurrency(keyToEdit.maxBudget)
                      : t('users.budget.unlimited', 'Unlimited')}
                  </HelperTextItem>
                </HelperText>
              </FormGroup>
            )}

            {renderQuotaFields(
              'edit',
              updateMutation.isLoading,
              editMaxBudget,
              setEditMaxBudget,
              editBudgetDuration,
              setEditBudgetDuration,
              editTpmLimit,
              setEditTpmLimit,
              editRpmLimit,
              setEditRpmLimit,
              editSoftBudget,
              setEditSoftBudget,
              editMaxParallelRequests,
              setEditMaxParallelRequests,
              editSelectedModelIds,
              editModelLimits,
              setEditModelLimits,
              false,
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleEditSubmit}
            isLoading={updateMutation.isLoading}
            isDisabled={updateMutation.isLoading || editSelectedModelIds.length === 0}
          >
            {t('users.apiKeys.form.saveChanges', 'Save Changes')}
          </Button>
          <Button
            variant="link"
            onClick={() => setEditModalOpen(false)}
            isDisabled={updateMutation.isLoading}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reset Spend Confirmation Modal (triggered from Edit modal) */}
      <Modal
        variant={ModalVariant.small}
        isOpen={resetSpendModalOpen}
        onClose={() => setResetSpendModalOpen(false)}
      >
        <ModalHeader title={t('users.apiKeys.resetSpendConfirmTitle', 'Reset API Key Spend')} />
        <ModalBody>
          <p>
            {t(
              'users.apiKeys.resetSpendConfirmBody',
              `Are you sure you want to reset the current spend for this API key to ${formatCurrency(0)}? This action cannot be undone.`,
            )}
          </p>
          {keyToEdit && (
            <p style={{ marginTop: '0.5rem' }}>
              <strong>{keyToEdit.name}</strong> ({keyToEdit.keyPrefix}...)
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={handleConfirmResetSpend}
            isLoading={resetSpendMutation.isLoading}
            isDisabled={resetSpendMutation.isLoading}
          >
            {t('users.apiKeys.resetSpend', 'Reset Spend')}
          </Button>
          <Button
            variant="link"
            onClick={() => setResetSpendModalOpen(false)}
            isDisabled={resetSpendMutation.isLoading}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Create API Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      >
        <ModalHeader title={t('users.apiKeys.createNew', 'Create API Key')} />
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

            {renderModelSelector(
              'create',
              createMutation.isLoading,
              selectedModelIds,
              setSelectedModelIds,
              handleModelToggle,
              () => setNewKeyModelLimits({}),
            )}

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

            {renderQuotaFields(
              'create',
              createMutation.isLoading,
              newKeyMaxBudget,
              setNewKeyMaxBudget,
              newKeyBudgetDuration,
              setNewKeyBudgetDuration,
              newKeyTpmLimit,
              setNewKeyTpmLimit,
              newKeyRpmLimit,
              setNewKeyRpmLimit,
              newKeySoftBudget,
              setNewKeySoftBudget,
              newKeyMaxParallelRequests,
              setNewKeyMaxParallelRequests,
              selectedModelIds,
              newKeyModelLimits,
              setNewKeyModelLimits,
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
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
        </ModalFooter>
      </Modal>

      {/* Generated Key Display Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={!!generatedKey}
        onClose={() => setGeneratedKey(null)}
      >
        <ModalHeader title={t('users.apiKeys.keyGenerated', 'API Key Generated')} />
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
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => setGeneratedKey(null)}>
            {t('common.done', 'Done')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default UserApiKeysTab;

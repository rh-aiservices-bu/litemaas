import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  Button,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  TextInput,
  CodeBlock,
  CodeBlockCode,
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  Alert,
  ClipboardCopy,
  ClipboardCopyVariant,
  Bullseye,
  Tooltip,
  Skeleton,
  Label,
  LabelGroup,
  Divider,
  HelperText,
  HelperTextItem,
  FormSelect,
  FormSelectOption,
  ExpandableSection,
  Split,
  SplitItem,
  Progress,
  ProgressMeasureLocation,
  ProgressVariant,
  DatePicker,
} from '@patternfly/react-core';
import {
  KeyIcon,
  PlusCircleIcon,
  CopyIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PencilAltIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useNotifications } from '../contexts/NotificationContext';
import { useCurrency } from '../contexts/ConfigContext';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { apiKeysService, ApiKey, CreateApiKeyRequest } from '../services/apiKeys.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { modelsService, Model } from '../services/models.service';
import { configService } from '../services/config.service';
import type { ApiKeyQuotaDefaults } from '../types/users';
import { extractErrorDetails } from '../utils/error.utils';
import { formatDate } from '../utils/formatters';

interface ModelLimits {
  budget?: number;
  timePeriod?: string;
  rpm?: number;
  tpm?: number;
}

const ApiKeysPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const { handleError } = useErrorHandler();
  const { formatCurrency, currencyCode } = useCurrency();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState('1000');
  const [newKeyExpiration, setNewKeyExpiration] = useState('never');
  const [newKeyCustomExpiration, setNewKeyCustomExpiration] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [generatedKey, setGeneratedKey] = useState<ApiKey | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedModelForExample, setSelectedModelForExample] = useState<string>('');

  // Edit modal state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [updatingKey, setUpdatingKey] = useState(false);
  const [isResetSpendModalOpen, setIsResetSpendModalOpen] = useState(false);
  const [resettingSpend, setResettingSpend] = useState(false);

  // Modal focus management refs
  const createModalTriggerRef = useRef<HTMLElement | null>(null);
  const createModalPrimaryButtonRef = useRef<HTMLButtonElement>(null);
  const viewModalTriggerRef = useRef<HTMLElement | null>(null);
  const generatedModalPrimaryButtonRef = useRef<HTMLButtonElement>(null);
  const deleteModalTriggerRef = useRef<HTMLElement | null>(null);
  const deleteModalCancelButtonRef = useRef<HTMLButtonElement>(null);

  // ✅ Multi-model support state
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // Quota fields for create modal
  const [newKeyMaxBudget, setNewKeyMaxBudget] = useState<number | undefined>(undefined);
  const [newKeyTpmLimit, setNewKeyTpmLimit] = useState<number | undefined>(undefined);
  const [newKeyRpmLimit, setNewKeyRpmLimit] = useState<number | undefined>(undefined);
  const [newKeyBudgetDuration, setNewKeyBudgetDuration] = useState<string>('');
  const [quotaDefaults, setQuotaDefaults] = useState<ApiKeyQuotaDefaults | null>(null);
  const [newKeyModelLimits, setNewKeyModelLimits] = useState<Record<string, ModelLimits>>({});

  // Configuration state
  const [litellmApiUrl, setLitellmApiUrl] = useState<string>('https://api.litemaas.com');

  // Load API keys from backend
  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiKeysService.getApiKeys();
      setApiKeys(response.data);
    } catch (err: any) {
      console.error('Failed to load API keys:', err);
      // Use centralized error handler which will display proper rate limit messages
      handleError(err);
      setError(t('pages.apiKeys.notifications.loadErrorDesc'));
    } finally {
      setLoading(false);
    }
  };

  // Load configuration
  const loadConfig = async () => {
    try {
      const config = await configService.getConfig();
      setLitellmApiUrl(config.litellmApiUrl ?? 'https://api.litemaas.com');
    } catch (err) {
      console.error('Failed to load configuration:', err);
      // Keep default value if config load fails
    }
  };

  // Load models from user subscriptions for multi-select
  const loadModels = async () => {
    try {
      setLoadingModels(true);
      // Get user's active subscriptions to determine available models
      const subscriptionsResponse = await subscriptionsService.getSubscriptions(1, 100);
      const activeSubscriptions = subscriptionsResponse.data.filter(
        (sub) => sub.status === 'active',
      );

      // Extract unique models from subscriptions
      const uniqueModelIds = [...new Set(activeSubscriptions.map((sub) => sub.modelId))];

      // Fetch detailed model information for each subscribed model
      const modelPromises = uniqueModelIds.map((modelId) =>
        modelsService.getModel(modelId).catch((err) => {
          console.warn(`Failed to load model ${modelId}:`, err);
          return null;
        }),
      );

      const modelResults = await Promise.all(modelPromises);
      const validModels = modelResults.filter((model) => model !== null) as Model[];

      setModels(validModels);
    } catch (err: any) {
      console.error('Failed to load subscribed models:', err);
      // Use centralized error handler which will display proper rate limit messages
      handleError(err);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
    loadModels(); // ✅ Load models on component mount
    loadConfig(); // Load configuration including LiteLLM API URL
    // Load quota defaults for create key modal
    configService
      .getApiKeyDefaults()
      .then(setQuotaDefaults)
      .catch(() => {});
  }, []);

  // Reload models when page gains focus (e.g., after subscribing to new models)
  useEffect(() => {
    const handleFocus = () => {
      loadModels();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Sync selectedApiKey with updated apiKeys state to reflect key visibility changes in modal
  useEffect(() => {
    if (selectedApiKey && apiKeys.length > 0) {
      const updatedSelectedKey = apiKeys.find((key) => key.id === selectedApiKey.id);
      if (updatedSelectedKey && updatedSelectedKey !== selectedApiKey) {
        setSelectedApiKey(updatedSelectedKey);
      }
    }
  }, [apiKeys, selectedApiKey]);

  // Initialize selected model for code example when View Key modal opens
  useEffect(() => {
    if (isViewModalOpen && selectedApiKey?.models && selectedApiKey.models.length > 0) {
      setSelectedModelForExample(selectedApiKey.models[0]);
    } else if (!isViewModalOpen) {
      // Reset when modal closes
      setSelectedModelForExample('');
    }
  }, [isViewModalOpen, selectedApiKey]);

  // Focus management for create modal
  useEffect(() => {
    if (!isCreateModalOpen) {
      return;
    }
    if (isCreateModalOpen) {
      setTimeout(() => {
        // Focus on the name input as the first interactive element
        const nameInput = document.getElementById('key-name') as HTMLInputElement;
        nameInput?.focus();
      }, 100);

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          const modal = document.querySelector(
            '[data-modal="create"][aria-modal="true"]',
          ) as HTMLElement;
          if (!modal) return;

          const focusableElements = modal.querySelectorAll(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"]):not([disabled])',
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
  }, [isCreateModalOpen]);

  // Focus management for view modal
  useEffect(() => {
    if (isViewModalOpen) {
      setTimeout(() => {
        // Focus on the close button as the primary action
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

  // Focus management for generated key modal
  useEffect(() => {
    if (showGeneratedKey) {
      setTimeout(() => {
        generatedModalPrimaryButtonRef.current?.focus();
      }, 100);

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          const modal = document.querySelector(
            '[data-modal="generated"][aria-modal="true"]',
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
  }, [showGeneratedKey]);

  // Focus management for delete modal
  useEffect(() => {
    if (isDeleteModalOpen) {
      setTimeout(() => {
        // Focus on the Cancel button (safer default)
        deleteModalCancelButtonRef.current?.focus();
      }, 100);

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          const modal = document.querySelector(
            '[data-modal="delete"][aria-modal="true"]',
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
  }, [isDeleteModalOpen]);

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'green',
      revoked: 'orange',
      expired: 'red',
    } as const;

    const icons = {
      active: <CheckCircleIcon />,
      revoked: <ExclamationTriangleIcon />,
      expired: <ExclamationTriangleIcon />,
    };

    return (
      <Label color={variants[status as keyof typeof variants]}>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
          <FlexItem>{icons[status as keyof typeof icons]}</FlexItem>
          <FlexItem>{status.charAt(0).toUpperCase() + status.slice(1)}</FlexItem>
        </Flex>
      </Label>
    );
  };

  const handleCreateApiKey = (triggerElement?: HTMLElement) => {
    // Reset edit mode
    setIsEditMode(false);
    setEditingKey(null);

    setNewKeyName('');
    setNewKeyDescription('');
    setNewKeyPermissions([]);
    setNewKeyRateLimit('1000');
    // Pre-fill expiration from admin-configured defaults
    if (quotaDefaults?.defaults?.expirationDays != null) {
      setNewKeyExpiration(String(quotaDefaults.defaults.expirationDays));
    } else if (quotaDefaults?.maximums?.expirationDays != null) {
      // Maximum is set but no default — pick the smallest available preset
      setNewKeyExpiration('30');
    } else {
      setNewKeyExpiration('never');
    }
    setNewKeyCustomExpiration('');
    setSelectedModelIds([]); // ✅ Reset model selection
    setNewKeyModelLimits({}); // Reset per-model limits
    setFormErrors({}); // Clear any previous validation errors
    // Pre-fill quota fields with admin-configured defaults
    setNewKeyMaxBudget(quotaDefaults?.defaults?.maxBudget ?? undefined);
    setNewKeyTpmLimit(quotaDefaults?.defaults?.tpmLimit ?? undefined);
    setNewKeyRpmLimit(quotaDefaults?.defaults?.rpmLimit ?? undefined);
    setNewKeyBudgetDuration(quotaDefaults?.defaults?.budgetDuration ?? '');
    // Store reference to the trigger element for focus restoration
    if (triggerElement) {
      createModalTriggerRef.current = triggerElement;
    }

    // ✅ Refresh models list to ensure newly subscribed models appear
    loadModels();

    setIsCreateModalOpen(true);
  };

  const handleSaveApiKey = async () => {
    const errors: { [key: string]: string } = {};

    if (!newKeyName.trim()) {
      errors.name = t('pages.apiKeys.notifications.nameRequired');
    }

    // ✅ Validate model selection
    if (selectedModelIds.length === 0) {
      errors.models = t('pages.apiKeys.notifications.modelsRequired');
    }

    // Validate quota fields against admin-set maximums
    if (quotaDefaults?.maximums) {
      const max = quotaDefaults.maximums;
      if (max.maxBudget != null && newKeyMaxBudget != null && newKeyMaxBudget > max.maxBudget) {
        errors.maxBudget = t('pages.apiKeys.quotas.exceedsMaximum', {
          field: t('pages.apiKeys.quotas.maxBudget', { currencyCode }),
          max: max.maxBudget,
        });
      }
      if (max.tpmLimit != null && newKeyTpmLimit != null && newKeyTpmLimit > max.tpmLimit) {
        errors.tpmLimit = t('pages.apiKeys.quotas.exceedsMaximum', {
          field: t('pages.apiKeys.quotas.tpmLimit'),
          max: max.tpmLimit,
        });
      }
      if (max.rpmLimit != null && newKeyRpmLimit != null && newKeyRpmLimit > max.rpmLimit) {
        errors.rpmLimit = t('pages.apiKeys.quotas.exceedsMaximum', {
          field: t('pages.apiKeys.quotas.rpmLimit'),
          max: max.rpmLimit,
        });
      }
      // Validate expiration against maximum
      if (max.expirationDays != null) {
        if (newKeyExpiration === 'never') {
          errors.expiration = t('pages.apiKeys.forms.expirationRequired', {
            max: max.expirationDays,
          });
        } else if (newKeyExpiration === 'custom') {
          if (!newKeyCustomExpiration) {
            errors.expiration = t('pages.apiKeys.forms.expirationCustomRequired');
          } else {
            const maxDate = new Date(Date.now() + max.expirationDays * 24 * 60 * 60 * 1000);
            if (new Date(newKeyCustomExpiration) > maxDate) {
              errors.expiration = t('pages.apiKeys.forms.expirationExceedsMax', {
                max: max.expirationDays,
              });
            }
          }
        }
      }
    }

    // Validate per-model limits against key-level limits and admin maximums
    for (const [modelId, limits] of Object.entries(newKeyModelLimits)) {
      if (!selectedModelIds.includes(modelId)) continue;
      const modelName = models.find((m) => m.id === modelId)?.name || modelId;
      if (limits.budget != null && limits.budget > 0) {
        if (newKeyMaxBudget != null && limits.budget > newKeyMaxBudget) {
          errors[`model-budget-${modelId}`] = t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('pages.apiKeys.quotas.maxBudget', { currencyCode }),
            max: newKeyMaxBudget,
          });
        } else if (
          quotaDefaults?.maximums?.maxBudget != null &&
          limits.budget > quotaDefaults.maximums.maxBudget
        ) {
          errors[`model-budget-${modelId}`] = t('pages.apiKeys.quotas.modelExceedsMaximum', {
            model: modelName,
            field: t('pages.apiKeys.quotas.maxBudget', { currencyCode }),
            max: quotaDefaults.maximums.maxBudget,
          });
        }
      }
      if (limits.rpm != null && limits.rpm > 0) {
        if (newKeyRpmLimit != null && limits.rpm > newKeyRpmLimit) {
          errors[`model-rpm-${modelId}`] = t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('pages.apiKeys.quotas.rpmLimit'),
            max: newKeyRpmLimit,
          });
        } else if (
          quotaDefaults?.maximums?.rpmLimit != null &&
          limits.rpm > quotaDefaults.maximums.rpmLimit
        ) {
          errors[`model-rpm-${modelId}`] = t('pages.apiKeys.quotas.modelExceedsMaximum', {
            model: modelName,
            field: t('pages.apiKeys.quotas.rpmLimit'),
            max: quotaDefaults.maximums.rpmLimit,
          });
        }
      }
      if (limits.tpm != null && limits.tpm > 0) {
        if (newKeyTpmLimit != null && limits.tpm > newKeyTpmLimit) {
          errors[`model-tpm-${modelId}`] = t('pages.apiKeys.quotas.modelExceedsKeyLimit', {
            model: modelName,
            field: t('pages.apiKeys.quotas.tpmLimit'),
            max: newKeyTpmLimit,
          });
        } else if (
          quotaDefaults?.maximums?.tpmLimit != null &&
          limits.tpm > quotaDefaults.maximums.tpmLimit
        ) {
          errors[`model-tpm-${modelId}`] = t('pages.apiKeys.quotas.modelExceedsMaximum', {
            model: modelName,
            field: t('pages.apiKeys.quotas.tpmLimit'),
            max: quotaDefaults.maximums.tpmLimit,
          });
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      addNotification({
        title: t('pages.apiKeys.notifications.validationError'),
        description: t('pages.apiKeys.notifications.pleaseFixFormErrors'),
        variant: 'danger',
      });
      return;
    }

    setCreatingKey(true);
    setUpdatingKey(true);

    // Build per-model limits from state (only include non-zero values for selected models)
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

    // Only include per-model properties when non-empty to avoid wiping DB values
    const perModelPayload: Record<string, unknown> = {};
    if (Object.keys(modelMaxBudget).length > 0) perModelPayload.modelMaxBudget = modelMaxBudget;
    if (Object.keys(modelRpmLimit).length > 0) perModelPayload.modelRpmLimit = modelRpmLimit;
    if (Object.keys(modelTpmLimit).length > 0) perModelPayload.modelTpmLimit = modelTpmLimit;

    try {
      if (isEditMode && editingKey) {
        // Update existing API key
        const updateRequest = {
          name: newKeyName,
          modelIds: selectedModelIds,
          expiresAt:
            newKeyExpiration === 'never'
              ? null
              : newKeyExpiration === 'custom'
                ? new Date(newKeyCustomExpiration).toISOString()
                : new Date(
                    Date.now() + parseInt(newKeyExpiration) * 24 * 60 * 60 * 1000,
                  ).toISOString(),
          maxBudget: newKeyMaxBudget ?? undefined,
          budgetDuration: newKeyBudgetDuration || undefined,
          tpmLimit: newKeyTpmLimit ?? undefined,
          rpmLimit: newKeyRpmLimit ?? undefined,
          ...perModelPayload,
          metadata: {
            description: newKeyDescription || undefined,
            permissions: newKeyPermissions,
            rateLimit: parseInt(newKeyRateLimit),
          },
        };

        await apiKeysService.updateApiKey(editingKey.id, updateRequest);

        // Refresh the API keys list
        await loadApiKeys();

        // Reset edit mode
        setIsEditMode(false);
        setEditingKey(null);
        setIsCreateModalOpen(false);

        addNotification({
          title: t('pages.apiKeys.notifications.updateSuccess'),
          description: t('pages.apiKeys.messages.keyUpdatedSuccess', { name: newKeyName }),
          variant: 'success',
        });
      } else {
        // Create new API key
        const request: CreateApiKeyRequest = {
          modelIds: selectedModelIds, // ✅ Use modelIds for multi-model support
          name: newKeyName,
          expiresAt:
            newKeyExpiration === 'never'
              ? undefined
              : newKeyExpiration === 'custom'
                ? new Date(newKeyCustomExpiration).toISOString()
                : new Date(
                    Date.now() + parseInt(newKeyExpiration) * 24 * 60 * 60 * 1000,
                  ).toISOString(),
          // Quota fields
          maxBudget: newKeyMaxBudget,
          budgetDuration: newKeyBudgetDuration || undefined,
          tpmLimit: newKeyTpmLimit,
          rpmLimit: newKeyRpmLimit,
          // Per-model limits
          ...perModelPayload,
          // ✅ Put additional fields in metadata as backend expects
          metadata: {
            description: newKeyDescription || undefined,
            permissions: newKeyPermissions,
            rateLimit: parseInt(newKeyRateLimit),
          },
        };

        const newKey = await apiKeysService.createApiKey(request);

        // Refresh the API keys list
        await loadApiKeys();

        setGeneratedKey(newKey);
        setShowGeneratedKey(true);
        setIsCreateModalOpen(false);

        addNotification({
          title: t('pages.apiKeys.notifications.createSuccess'),
          description: t('pages.apiKeys.messages.keyCreatedSuccess', { name: newKeyName }),
          variant: 'success',
        });
      }
    } catch (err: any) {
      console.error(isEditMode ? 'Failed to update API key:' : 'Failed to create API key:', err);
      const fallbackMessage = isEditMode
        ? t('pages.apiKeys.notifications.updateErrorDesc')
        : t('pages.apiKeys.notifications.createErrorDesc');

      addNotification({
        title: isEditMode
          ? t('pages.apiKeys.notifications.updateError')
          : t('pages.apiKeys.notifications.createError'),
        description: extractErrorDetails(err).message || fallbackMessage,
        variant: 'danger',
      });
    } finally {
      setCreatingKey(false);
      setUpdatingKey(false);
    }
  };

  const handleViewKey = (apiKey: ApiKey, triggerElement?: HTMLElement) => {
    setSelectedApiKey(apiKey);
    // Store reference to the trigger element for focus restoration
    viewModalTriggerRef.current = triggerElement || null;
    setIsViewModalOpen(true);
  };

  const handleEditKey = (apiKey: ApiKey, triggerElement?: HTMLElement) => {
    // Set edit mode and populate form with existing data
    setIsEditMode(true);
    setEditingKey(apiKey);
    setNewKeyName(apiKey.name);
    setNewKeyDescription(apiKey.description || '');
    setSelectedModelIds(apiKey.models || []);
    setNewKeyPermissions([]); // Reset permissions for edit
    setNewKeyRateLimit('1000'); // Reset rate limit for edit
    // Pre-fill expiration from existing key
    if (apiKey.expiresAt) {
      setNewKeyExpiration('custom');
      setNewKeyCustomExpiration(new Date(apiKey.expiresAt).toISOString().split('T')[0]);
    } else {
      setNewKeyExpiration('never');
      setNewKeyCustomExpiration('');
    }
    // Pre-fill quota fields from existing key
    setNewKeyMaxBudget(apiKey.maxBudget ?? undefined);
    setNewKeyBudgetDuration(apiKey.budgetDuration ?? '');
    setNewKeyTpmLimit(apiKey.tpmLimit ?? undefined);
    setNewKeyRpmLimit(apiKey.rpmLimit ?? undefined);
    // Pre-fill per-model limits from existing key
    const modelLimits: Record<string, ModelLimits> = {};
    if (apiKey.modelMaxBudget) {
      for (const [modelId, config] of Object.entries(apiKey.modelMaxBudget)) {
        modelLimits[modelId] = {
          ...modelLimits[modelId],
          budget: config.budgetLimit,
          timePeriod: config.timePeriod,
        };
      }
    }
    if (apiKey.modelRpmLimit) {
      for (const [modelId, rpm] of Object.entries(apiKey.modelRpmLimit)) {
        modelLimits[modelId] = { ...modelLimits[modelId], rpm };
      }
    }
    if (apiKey.modelTpmLimit) {
      for (const [modelId, tpm] of Object.entries(apiKey.modelTpmLimit)) {
        modelLimits[modelId] = { ...modelLimits[modelId], tpm };
      }
    }
    setNewKeyModelLimits(modelLimits);
    setFormErrors({}); // Clear any previous validation errors

    // Store reference to the trigger element for focus restoration
    if (triggerElement) {
      createModalTriggerRef.current = triggerElement;
    }

    // ✅ Refresh models list to ensure newly subscribed models appear
    loadModels();

    setIsCreateModalOpen(true);
  };

  const handleDeleteKey = (apiKey: ApiKey, triggerElement?: HTMLElement) => {
    setKeyToDelete(apiKey);
    // Store reference to the trigger element for focus restoration
    if (triggerElement) {
      deleteModalTriggerRef.current = triggerElement;
    }
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteKey = async () => {
    if (!keyToDelete) return;

    try {
      await apiKeysService.deleteApiKey(keyToDelete.id);

      // Refresh the API keys list
      await loadApiKeys();

      addNotification({
        title: t('pages.apiKeys.notifications.deleteSuccess'),
        description: t('pages.apiKeys.messages.keyDeleted', { name: keyToDelete.name }),
        variant: 'success',
      });
    } catch (err: any) {
      console.error('Failed to delete API key:', err);

      addNotification({
        title: t('pages.apiKeys.notifications.deleteError'),
        description:
          extractErrorDetails(err).message || t('pages.apiKeys.notifications.deleteErrorDesc'),
        variant: 'danger',
      });
    } finally {
      setIsDeleteModalOpen(false);
      setKeyToDelete(null);
    }
  };

  const confirmResetSpend = async () => {
    if (!editingKey) return;

    try {
      setResettingSpend(true);
      await apiKeysService.resetApiKeySpend(editingKey.id);

      // Refresh the API keys list
      await loadApiKeys();

      // Update editingKey in-place so the progress bar reflects the reset
      setEditingKey({ ...editingKey, currentSpend: 0 });

      addNotification({
        title: t('users.apiKeys.resetSpendSuccess', 'Spend Reset'),
        description: t(
          'users.apiKeys.resetSpendSuccessDesc',
          'The API key spend has been reset to 0.',
        ),
        variant: 'success',
      });
    } catch (err: any) {
      addNotification({
        title: t('users.apiKeys.resetSpendError', 'Reset Spend Failed'),
        description: extractErrorDetails(err).message || 'Failed to reset API key spend',
        variant: 'danger',
      });
    } finally {
      setResettingSpend(false);
      setIsResetSpendModalOpen(false);
    }
  };

  const toggleKeyVisibility = async (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);

    if (newVisibleKeys.has(keyId)) {
      // Hide the key
      newVisibleKeys.delete(keyId);
      setVisibleKeys(newVisibleKeys);
    } else {
      // Show the key - use secure retrieval
      try {
        const keyData = await apiKeysService.retrieveFullKey(keyId);

        // Update the API key in our local state with the retrieved key
        setApiKeys((prev) =>
          prev.map((key) =>
            key.id === keyId ? { ...key, fullKey: keyData.key, keyType: keyData.keyType } : key,
          ),
        );

        // Show the key
        newVisibleKeys.add(keyId);
        setVisibleKeys(newVisibleKeys);

        addNotification({
          title: t('pages.apiKeys.notifications.retrieveSuccess'),
          description: t('pages.apiKeys.messages.retrievalMessage', {
            date: new Date(keyData.retrievedAt).toLocaleString(),
          }),
          variant: 'success',
        });
      } catch (error) {
        addNotification({
          title: t('pages.apiKeys.notifications.retrieveError'),
          description:
            extractErrorDetails(error).message ||
            t('pages.apiKeys.notifications.retrieveErrorDesc'),
          variant: 'danger',
        });
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addNotification({
      title: t('pages.apiKeys.copied'),
      description: t('pages.apiKeys.messages.copyToClipboard', { label }),
      variant: 'info',
    });
  };

  /* const permissionOptions = [
    { value: 'models:read', label: 'Read Models' },
    { value: 'models:write', label: 'Write Models' },
    { value: 'completions:create', label: 'Create Completions' },
    { value: 'usage:read', label: 'Read Usage' },
    { value: 'analytics:read', label: 'Read Analytics' },
    { value: 'admin:all', label: 'Admin Access' }
  ]; */

  if (loading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.apiKeys.title')}
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                {t('pages.apiKeys.messages.loadingTitle')}
              </Title>
              <EmptyStateBody>{t('pages.apiKeys.messages.loadingDescription')}</EmptyStateBody>
            </EmptyState>
          </Bullseye>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <PageSection variant="secondary">
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              {t('pages.apiKeys.title')}
            </Title>
            <Content component={ContentVariants.p}>
              {t('pages.apiKeys.messages.managementDescription')}
            </Content>
          </FlexItem>
          <FlexItem>
            <Button
              variant="primary"
              icon={<PlusCircleIcon />}
              onClick={(event) => handleCreateApiKey(event.currentTarget)}
            >
              {t('pages.apiKeys.createKey')}
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        {error ? (
          <EmptyState
            variant={EmptyStateVariant.lg}
            role="alert"
            aria-labelledby="error-loading-title"
            aria-describedby="error-loading-description"
          >
            <KeyIcon aria-hidden="true" />
            <Title headingLevel="h2" size="lg" id="error-loading-title">
              {t('pages.apiKeys.messages.errorLoadingTitle')}
            </Title>
            <EmptyStateBody id="error-loading-description">
              {error}
              <div className="pf-v6-screen-reader" aria-live="assertive">
                {t('pages.apiKeys.messages.errorScreenReader', { error })}
              </div>
            </EmptyStateBody>
            <EmptyStateActions>
              <Button
                variant="primary"
                onClick={loadApiKeys}
                aria-describedby="error-loading-description"
              >
                {t('ui.actions.tryAgain')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : apiKeys.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg} role="region" aria-labelledby="no-keys-title">
            <KeyIcon aria-hidden="true" />
            <Title headingLevel="h2" size="lg" id="no-keys-title">
              {t('pages.apiKeys.messages.noKeysTitle')}
            </Title>
            <EmptyStateBody>
              {t('pages.apiKeys.messages.noKeysDescription')}
              <div className="pf-v6-screen-reader" aria-live="polite">
                {t('pages.apiKeys.messages.noKeysScreenReader')}
              </div>
            </EmptyStateBody>
            <EmptyStateActions>
              <Button
                variant="primary"
                icon={<PlusCircleIcon aria-hidden="true" />}
                onClick={(event) => handleCreateApiKey(event.currentTarget)}
                aria-describedby="no-keys-title"
              >
                {t('pages.apiKeys.createKey')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <Card>
            <CardBody>
              <Table aria-label={t('pages.apiKeys.tableHeaders.apiKeysTable')} variant="compact">
                <caption className="pf-v6-screen-reader">
                  {t('pages.apiKeys.tableHeaders.apiKeysTableCaption', {
                    count: apiKeys.length,
                    description: t('pages.apiKeys.tableHeaders.apiKeysTableStructure'),
                  })}
                </caption>
                <Thead>
                  <Tr>
                    <Th scope="col" style={{ width: '15%' }}>
                      {t('pages.apiKeys.forms.name')}
                    </Th>
                    <Th scope="col" style={{ width: '35%' }}>
                      {t('pages.apiKeys.forms.apiKey')}
                    </Th>
                    <Th scope="col" style={{ width: '15%' }}>
                      {t('pages.apiKeys.forms.models')}
                    </Th>
                    <Th scope="col" style={{ width: '35%' }}>
                      {t('pages.apiKeys.labels.actions')}
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {apiKeys.map((apiKey) => (
                    <Tr key={apiKey.id} isClickable onRowClick={() => handleViewKey(apiKey)}>
                      <Th scope="row">
                        <Flex direction={{ default: 'column' }}>
                          <FlexItem>
                            <strong>{apiKey.name}</strong>
                          </FlexItem>
                          {apiKey.description && (
                            <FlexItem>
                              <Content
                                component={ContentVariants.small}
                                style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
                              >
                                {apiKey.description}
                              </Content>
                            </FlexItem>
                          )}
                        </Flex>
                      </Th>
                      <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Flex
                          alignItems={{ default: 'alignItemsCenter' }}
                          spaceItems={{ default: 'spaceItemsSm' }}
                        >
                          <FlexItem>
                            <code
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 'var(--pf-t--global--font--size--sm)',
                              }}
                              id={`key-${apiKey.id}-description`}
                              aria-label={
                                visibleKeys.has(apiKey.id) && apiKey.fullKey
                                  ? t('pages.apiKeys.fullKeyVisible', { keyName: apiKey.name })
                                  : t('pages.apiKeys.keyPreviewOnly', { keyName: apiKey.name })
                              }
                            >
                              {visibleKeys.has(apiKey.id) && apiKey.fullKey
                                ? `${apiKey.fullKey}`
                                : apiKey.keyPreview || '************'}
                            </code>
                          </FlexItem>
                          <FlexItem>
                            <Tooltip
                              content={
                                visibleKeys.has(apiKey.id)
                                  ? t('pages.apiKeys.hideKey')
                                  : t('pages.apiKeys.showKey')
                              }
                            >
                              <Button
                                variant="plain"
                                size="sm"
                                onClick={() => toggleKeyVisibility(apiKey.id)}
                                icon={visibleKeys.has(apiKey.id) ? <EyeSlashIcon /> : <EyeIcon />}
                                aria-label={
                                  visibleKeys.has(apiKey.id)
                                    ? t('pages.apiKeys.hideKeyAriaLabel', { keyName: apiKey.name })
                                    : t('pages.apiKeys.showKeyAriaLabel', { keyName: apiKey.name })
                                }
                                aria-expanded={visibleKeys.has(apiKey.id)}
                                aria-describedby={`key-${apiKey.id}-description`}
                              />
                            </Tooltip>
                          </FlexItem>
                          <FlexItem hidden={!visibleKeys.has(apiKey.id)}>
                            <Tooltip content={t('pages.apiKeys.copyToClipboard')}>
                              <Button
                                variant="plain"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(
                                    apiKey.fullKey || '',
                                    t('pages.apiKeys.forms.apiKey'),
                                  )
                                }
                                icon={<CopyIcon />}
                                aria-label={t('pages.apiKeys.copyKeyAriaLabel', {
                                  keyName: apiKey.name,
                                })}
                              />
                            </Tooltip>
                          </FlexItem>
                        </Flex>
                      </Td>
                      <Td>
                        <LabelGroup>
                          {apiKey.models && apiKey.models.length > 0 ? (
                            apiKey.models.slice(0, 2).map((modelId) => {
                              const modelDetail = apiKey.modelDetails?.find(
                                (m) => m.id === modelId,
                              );
                              return (
                                <Label key={modelId} isCompact>
                                  {modelDetail ? modelDetail.name : modelId}
                                </Label>
                              );
                            })
                          ) : (
                            <Content
                              component={ContentVariants.small}
                              style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
                            >
                              {t('pages.apiKeys.noModelsAssigned')}
                            </Content>
                          )}
                          {apiKey.models && apiKey.models.length > 2 && (
                            <Label isCompact>
                              {t('pages.apiKeys.messages.plusMore', {
                                count: apiKey.models.length - 2,
                              })}
                            </Label>
                          )}
                        </LabelGroup>
                      </Td>
                      {/* 
                      <Td>
                        <Content component={ContentVariants.small}>
                          {apiKey.lastUsed
                            ? formatDate(apiKey.lastUsed)
                            : t('pages.apiKeys.never')}
                        </Content>
                      </Td>
                       */}
                      <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(event) => handleViewKey(apiKey, event.currentTarget)}
                              aria-label={t('pages.apiKeys.viewKeyAriaLabel', {
                                keyName: apiKey.name,
                              })}
                            >
                              {t('pages.apiKeys.viewKey')}
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(event) => handleEditKey(apiKey, event.currentTarget)}
                              isDisabled={apiKey.status !== 'active'}
                              icon={<PencilAltIcon />}
                              aria-label={t('pages.apiKeys.editKeyAriaLabel', {
                                keyName: apiKey.name,
                              })}
                            >
                              {t('pages.apiKeys.editKey')}
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={(event) => handleDeleteKey(apiKey, event.currentTarget)}
                              isDisabled={apiKey.status !== 'active'}
                              icon={<TrashIcon />}
                              aria-label={t('pages.apiKeys.deleteKeyAriaLabel', {
                                keyName: apiKey.name,
                              })}
                            >
                              {t('pages.apiKeys.deleteKey')}
                            </Button>
                          </FlexItem>
                        </Flex>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        )}
      </PageSection>

      {/* Create API Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditMode(false);
          setEditingKey(null);
          // Restore focus to the trigger element
          setTimeout(() => {
            createModalTriggerRef.current?.focus();
          }, 100);
        }}
        aria-modal="true"
        data-modal="create"
        onEscapePress={() => {
          setIsCreateModalOpen(false);
          setIsEditMode(false);
          setEditingKey(null);
          // Restore focus to the trigger element
          setTimeout(() => {
            createModalTriggerRef.current?.focus();
          }, 100);
        }}
      >
        <ModalHeader
          title={
            isEditMode ? t('pages.apiKeys.modals.editTitle') : t('pages.apiKeys.modals.createTitle')
          }
        />
        <ModalBody>
          <Form>
            <FormGroup label={t('pages.apiKeys.forms.name')} isRequired fieldId="key-name">
              <TextInput
                isRequired
                type="text"
                id="key-name"
                name="key-name"
                value={newKeyName}
                onChange={(_event, value) => {
                  setNewKeyName(value);
                  if (formErrors.name && value.trim()) {
                    const newErrors = { ...formErrors };
                    delete newErrors.name;
                    setFormErrors(newErrors);
                  }
                }}
                placeholder={t('pages.apiKeys.placeholders.keyName')}
                aria-required="true"
                aria-invalid={formErrors.name ? 'true' : 'false'}
                aria-describedby={formErrors.name ? 'key-name-error' : undefined}
                validated={formErrors.name ? 'error' : 'default'}
              />
              {formErrors.name && (
                <HelperText id="key-name-error">
                  <HelperTextItem variant="error">{formErrors.name}</HelperTextItem>
                </HelperText>
              )}
            </FormGroup>

            <FormGroup label={t('pages.apiKeys.forms.description')} fieldId="key-description">
              <TextInput
                type="text"
                id="key-description"
                name="key-description"
                value={newKeyDescription}
                onChange={(_event, value) => setNewKeyDescription(value)}
                placeholder={t('pages.apiKeys.placeholders.keyDescription')}
                aria-describedby="key-description-helper"
              />
            </FormGroup>

            {/* ✅ Multi-model selection */}
            <FormGroup label={t('pages.apiKeys.forms.models')} isRequired fieldId="key-models">
              {loadingModels ? (
                <Skeleton height="40px" />
              ) : models.length === 0 ? (
                <Alert
                  variant="warning"
                  isInline
                  isPlain
                  title={t('pages.apiKeys.messages.noSubscribedModels')}
                />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <Label
                    color="purple"
                    onClick={() => {
                      if (selectedModelIds.length === models.length) {
                        setSelectedModelIds([]);
                        setNewKeyModelLimits({});
                      } else {
                        setSelectedModelIds(models.map((m) => m.id));
                      }
                      // Clear validation error if selecting all
                      if (formErrors.models) {
                        const newErrors = { ...formErrors };
                        delete newErrors.models;
                        setFormErrors(newErrors);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {selectedModelIds.length === models.length
                      ? t('pages.apiKeys.deselectAll', 'Deselect All')
                      : t('pages.apiKeys.selectAll', 'Select All')}
                  </Label>
                  {models.map((model) => (
                    <Label
                      key={model.id}
                      color={selectedModelIds.includes(model.id) ? 'blue' : 'grey'}
                      onClick={() => {
                        const isDeselecting = selectedModelIds.includes(model.id);
                        const newSelection = isDeselecting
                          ? selectedModelIds.filter((id) => id !== model.id)
                          : [...selectedModelIds, model.id];
                        setSelectedModelIds(newSelection);
                        // Clean up per-model limits when deselecting
                        if (isDeselecting) {
                          setNewKeyModelLimits((prev) => {
                            const updated = { ...prev };
                            delete updated[model.id];
                            return updated;
                          });
                        }
                        if (formErrors.models && newSelection.length > 0) {
                          const newErrors = { ...formErrors };
                          delete newErrors.models;
                          setFormErrors(newErrors);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {model.name}
                    </Label>
                  ))}
                </div>
              )}
              {formErrors.models && (
                <HelperText id="key-models-error">
                  <HelperTextItem variant="error">{formErrors.models}</HelperTextItem>
                </HelperText>
              )}
              <HelperText>
                <HelperTextItem>
                  {t(
                    'pages.apiKeys.forms.modelsHelperText',
                    'Select one or more models for this API key.',
                  )}
                </HelperTextItem>
              </HelperText>
            </FormGroup>

            {/* Expiration */}
            <FormGroup label={t('pages.apiKeys.forms.expiration')} fieldId="key-expiration">
              <FormSelect
                id="key-expiration"
                value={newKeyExpiration}
                onChange={(_event, value) => {
                  setNewKeyExpiration(value);
                  if (value !== 'custom') setNewKeyCustomExpiration('');
                  if (formErrors.expiration) {
                    const newErrors = { ...formErrors };
                    delete newErrors.expiration;
                    setFormErrors(newErrors);
                  }
                }}
                isDisabled={creatingKey}
                validated={formErrors.expiration ? 'error' : 'default'}
              >
                {quotaDefaults?.maximums?.expirationDays == null && (
                  <FormSelectOption
                    value="never"
                    label={t('pages.apiKeys.forms.expirationNever')}
                  />
                )}
                {(quotaDefaults?.maximums?.expirationDays == null ||
                  30 <= quotaDefaults.maximums.expirationDays) && (
                  <FormSelectOption value="30" label={t('pages.apiKeys.forms.expiration30')} />
                )}
                {(quotaDefaults?.maximums?.expirationDays == null ||
                  60 <= quotaDefaults.maximums.expirationDays) && (
                  <FormSelectOption value="60" label={t('pages.apiKeys.forms.expiration60')} />
                )}
                {(quotaDefaults?.maximums?.expirationDays == null ||
                  90 <= quotaDefaults.maximums.expirationDays) && (
                  <FormSelectOption value="90" label={t('pages.apiKeys.forms.expiration90')} />
                )}
                {(quotaDefaults?.maximums?.expirationDays == null ||
                  180 <= quotaDefaults.maximums.expirationDays) && (
                  <FormSelectOption value="180" label={t('pages.apiKeys.forms.expiration180')} />
                )}
                {(quotaDefaults?.maximums?.expirationDays == null ||
                  365 <= quotaDefaults.maximums.expirationDays) && (
                  <FormSelectOption value="365" label={t('pages.apiKeys.forms.expiration365')} />
                )}
                <FormSelectOption
                  value="custom"
                  label={t('pages.apiKeys.forms.expirationCustom')}
                />
              </FormSelect>
              {newKeyExpiration === 'custom' && (
                <DatePicker
                  value={newKeyCustomExpiration}
                  onChange={(_event, value) => {
                    setNewKeyCustomExpiration(value);
                    if (formErrors.expiration) {
                      const newErrors = { ...formErrors };
                      delete newErrors.expiration;
                      setFormErrors(newErrors);
                    }
                  }}
                  aria-label={t('pages.apiKeys.forms.expiration')}
                  style={{ marginTop: '0.5rem' }}
                  validators={[
                    (date: Date) => {
                      if (date < new Date()) return 'Date must be in the future';
                      if (quotaDefaults?.maximums?.expirationDays != null) {
                        const maxDate = new Date(
                          Date.now() + quotaDefaults.maximums.expirationDays * 24 * 60 * 60 * 1000,
                        );
                        if (date > maxDate) {
                          return t('pages.apiKeys.forms.expirationExceedsMax', {
                            max: quotaDefaults.maximums.expirationDays,
                          });
                        }
                      }
                      return '';
                    },
                  ]}
                />
              )}
              {formErrors.expiration && (
                <HelperText id="key-expiration-error">
                  <HelperTextItem variant="error">{formErrors.expiration}</HelperTextItem>
                </HelperText>
              )}
              {quotaDefaults?.maximums?.expirationDays != null && (
                <HelperText>
                  <HelperTextItem>
                    {t('pages.apiKeys.forms.expirationMaxHelper', {
                      max: quotaDefaults.maximums.expirationDays,
                    })}
                  </HelperTextItem>
                </HelperText>
              )}
            </FormGroup>

            {/* Quota fields - shown in both create and edit modes */}
            <Divider style={{ margin: '0.25rem 0 0.125rem' }} />
            <Title headingLevel="h4" size="md" style={{ marginBottom: '0.125rem' }}>
              {t('pages.apiKeys.quotas.title')}
            </Title>
            <Content component={ContentVariants.small} style={{ marginBottom: '0.125rem' }}>
              {t('pages.apiKeys.quotas.description')}
            </Content>

            {/* Current Spend with Progress Bar and Reset Button - edit mode only, when budget is set */}
            {isEditMode &&
              editingKey &&
              editingKey.maxBudget != null &&
              editingKey.maxBudget > 0 && (
                <FormGroup
                  label={t('users.apiKeys.currentSpend', 'Current Spend')}
                  fieldId="key-current-spend"
                >
                  <Split hasGutter style={{ alignItems: 'center' }}>
                    <SplitItem isFilled>
                      <Progress
                        value={
                          editingKey.currentSpend != null
                            ? Math.min((editingKey.currentSpend / editingKey.maxBudget) * 100, 100)
                            : 0
                        }
                        measureLocation={ProgressMeasureLocation.outside}
                        aria-label={t('users.budget.budgetUtilization', 'Budget utilization')}
                        variant={
                          editingKey.currentSpend != null
                            ? (editingKey.currentSpend / editingKey.maxBudget) * 100 > 95
                              ? ProgressVariant.danger
                              : (editingKey.currentSpend / editingKey.maxBudget) * 100 > 80
                                ? ProgressVariant.warning
                                : undefined
                            : undefined
                        }
                      />
                    </SplitItem>
                    {(editingKey.currentSpend ?? 0) > 0 && (
                      <SplitItem>
                        <Button
                          variant="secondary"
                          isDanger
                          onClick={() => setIsResetSpendModalOpen(true)}
                          isDisabled={resettingSpend}
                        >
                          {t('users.apiKeys.resetSpend', 'Reset Spend')}
                        </Button>
                      </SplitItem>
                    )}
                  </Split>
                  <HelperText>
                    <HelperTextItem>
                      {formatCurrency(editingKey.currentSpend || 0)} /{' '}
                      {formatCurrency(editingKey.maxBudget)}
                    </HelperTextItem>
                  </HelperText>
                </FormGroup>
              )}

            <FormGroup
              label={t('pages.apiKeys.quotas.maxBudget', { currencyCode })}
              fieldId="key-max-budget"
            >
              <TextInput
                id="key-max-budget"
                type="number"
                min="0"
                step="1"
                value={newKeyMaxBudget ?? ''}
                onChange={(_event, value) =>
                  setNewKeyMaxBudget(value ? parseFloat(value) : undefined)
                }
                placeholder={t('pages.apiKeys.quotas.optionalPlaceholder')}
                validated={formErrors.maxBudget ? 'error' : 'default'}
              />
              <HelperText>
                <HelperTextItem variant={formErrors.maxBudget ? 'error' : 'default'}>
                  {formErrors.maxBudget ??
                    (quotaDefaults?.maximums?.maxBudget != null
                      ? t('pages.apiKeys.quotas.maxAllowed', {
                          max: quotaDefaults.maximums.maxBudget,
                        })
                      : t('pages.apiKeys.quotas.maxBudgetHelper', { currencyCode }))}
                </HelperTextItem>
              </HelperText>
            </FormGroup>

            {newKeyMaxBudget != null && newKeyMaxBudget > 0 && (
              <FormGroup
                label={t('pages.apiKeys.quotas.budgetDuration')}
                fieldId="key-budget-duration"
              >
                <FormSelect
                  id="key-budget-duration"
                  value={newKeyBudgetDuration}
                  onChange={(_event, value) => setNewKeyBudgetDuration(value)}
                >
                  <FormSelectOption value="" label={t('pages.apiKeys.quotas.noDuration')} />
                  <FormSelectOption value="daily" label={t('pages.apiKeys.quotas.daily')} />
                  <FormSelectOption value="weekly" label={t('pages.apiKeys.quotas.weekly')} />
                  <FormSelectOption value="monthly" label={t('pages.apiKeys.quotas.monthly')} />
                  <FormSelectOption value="yearly" label={t('pages.apiKeys.quotas.yearly')} />
                </FormSelect>
                <HelperText>
                  <HelperTextItem>{t('pages.apiKeys.quotas.budgetDurationHelper')}</HelperTextItem>
                </HelperText>
              </FormGroup>
            )}

            <FormGroup label={t('pages.apiKeys.quotas.tpmLimit')} fieldId="key-tpm-limit">
              <TextInput
                id="key-tpm-limit"
                type="number"
                min="0"
                step="1000"
                value={newKeyTpmLimit ?? ''}
                onChange={(_event, value) => setNewKeyTpmLimit(value ? parseInt(value) : undefined)}
                placeholder={t('pages.apiKeys.quotas.optionalPlaceholder')}
                validated={formErrors.tpmLimit ? 'error' : 'default'}
              />
              <HelperText>
                <HelperTextItem variant={formErrors.tpmLimit ? 'error' : 'default'}>
                  {formErrors.tpmLimit ??
                    (quotaDefaults?.maximums?.tpmLimit != null
                      ? t('pages.apiKeys.quotas.maxAllowed', {
                          max: quotaDefaults.maximums.tpmLimit,
                        })
                      : t('pages.apiKeys.quotas.tpmLimitHelper'))}
                </HelperTextItem>
              </HelperText>
            </FormGroup>

            <FormGroup label={t('pages.apiKeys.quotas.rpmLimit')} fieldId="key-rpm-limit">
              <TextInput
                id="key-rpm-limit"
                type="number"
                min="0"
                step="10"
                value={newKeyRpmLimit ?? ''}
                onChange={(_event, value) => setNewKeyRpmLimit(value ? parseInt(value) : undefined)}
                placeholder={t('pages.apiKeys.quotas.optionalPlaceholder')}
                validated={formErrors.rpmLimit ? 'error' : 'default'}
              />
              <HelperText>
                <HelperTextItem variant={formErrors.rpmLimit ? 'error' : 'default'}>
                  {formErrors.rpmLimit ??
                    (quotaDefaults?.maximums?.rpmLimit != null
                      ? t('pages.apiKeys.quotas.maxAllowed', {
                          max: quotaDefaults.maximums.rpmLimit,
                        })
                      : t('pages.apiKeys.quotas.rpmLimitHelper'))}
                </HelperTextItem>
              </HelperText>
            </FormGroup>

            {/* Per-model limits */}
            {selectedModelIds.length > 0 && (
              <ExpandableSection
                toggleText={t('pages.apiKeys.quotas.perModelLimits', 'Per-Model Limits')}
                isIndented
              >
                <HelperText style={{ marginBottom: '0.75rem' }}>
                  <HelperTextItem>
                    {t(
                      'pages.apiKeys.quotas.perModelLimitsHelp',
                      'Set per-model budget and rate limits. These apply independently of global key limits.',
                    )}
                  </HelperTextItem>
                </HelperText>
                {selectedModelIds.map((modelId) => {
                  const modelName = models.find((m) => m.id === modelId)?.name || modelId;
                  const limits = newKeyModelLimits[modelId] || {};
                  const updateModelLimit = (field: string, value: number | string | undefined) => {
                    setNewKeyModelLimits((prev) => ({
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
                      <div
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}
                      >
                        {/* Per-model budget hidden: requires LiteLLM Enterprise license */}
                        <FormGroup
                          label={t('pages.apiKeys.quotas.modelRpm', 'RPM')}
                          fieldId={`model-rpm-${modelId}`}
                        >
                          <TextInput
                            id={`model-rpm-${modelId}`}
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
                            isDisabled={creatingKey || updatingKey}
                            aria-label={`${modelName} RPM`}
                            validated={formErrors[`model-rpm-${modelId}`] ? 'error' : 'default'}
                          />
                          {formErrors[`model-rpm-${modelId}`] && (
                            <HelperText>
                              <HelperTextItem variant="error">
                                {formErrors[`model-rpm-${modelId}`]}
                              </HelperTextItem>
                            </HelperText>
                          )}
                        </FormGroup>
                        <FormGroup
                          label={t('pages.apiKeys.quotas.modelTpm', 'TPM')}
                          fieldId={`model-tpm-${modelId}`}
                        >
                          <TextInput
                            id={`model-tpm-${modelId}`}
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
                            isDisabled={creatingKey || updatingKey}
                            aria-label={`${modelName} TPM`}
                            validated={formErrors[`model-tpm-${modelId}`] ? 'error' : 'default'}
                          />
                          {formErrors[`model-tpm-${modelId}`] && (
                            <HelperText>
                              <HelperTextItem variant="error">
                                {formErrors[`model-tpm-${modelId}`]}
                              </HelperTextItem>
                            </HelperText>
                          )}
                        </FormGroup>
                      </div>
                    </div>
                  );
                })}
              </ExpandableSection>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            ref={createModalPrimaryButtonRef}
            variant="primary"
            onClick={handleSaveApiKey}
            isLoading={creatingKey || updatingKey}
          >
            {isEditMode
              ? updatingKey
                ? t('pages.apiKeys.updating')
                : t('pages.apiKeys.updateKey')
              : creatingKey
                ? t('pages.apiKeys.creating')
                : t('pages.apiKeys.createKey')}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setIsCreateModalOpen(false);
              setIsEditMode(false);
              setEditingKey(null);
              // Restore focus to the trigger element
              setTimeout(() => {
                createModalTriggerRef.current?.focus();
              }, 100);
            }}
          >
            {t('pages.apiKeys.labels.cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* View API Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          // Restore focus to the trigger element
          setTimeout(() => {
            viewModalTriggerRef.current?.focus();
          }, 100);
        }}
        aria-modal="true"
        data-modal="view"
        onEscapePress={() => {
          setIsViewModalOpen(false);
          // Restore focus to the trigger element
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
              <Title headingLevel="h2" size="xl">
                {selectedApiKey?.name}
              </Title>
            </FlexItem>
            <FlexItem>{selectedApiKey && getStatusBadge(selectedApiKey.status)}</FlexItem>
          </Flex>
        </ModalHeader>
        <ModalBody>
          {selectedApiKey && (
            <>
              <FormGroup label={t('pages.apiKeys.forms.apiKey')} fieldId="view-key">
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  <FlexItem flex={{ default: 'flex_1' }}>
                    <code
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 'var(--pf-t--global--font--size--sm)',
                        padding: '0.5rem',
                        backgroundColor: 'var(--pf-t--global--background--color--200)',
                        border: '1px solid var(--pf-t--global--border--color--default)',
                        borderRadius: '3px',
                        display: 'block',
                        wordBreak: 'break-all',
                      }}
                    >
                      {visibleKeys.has(selectedApiKey.id) && selectedApiKey.fullKey
                        ? `${selectedApiKey.fullKey}`
                        : selectedApiKey.keyPreview || '************'}
                    </code>
                  </FlexItem>
                  <FlexItem>
                    <Tooltip
                      content={
                        visibleKeys.has(selectedApiKey.id)
                          ? t('pages.apiKeys.hideKey')
                          : t('pages.apiKeys.showKey')
                      }
                    >
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() => toggleKeyVisibility(selectedApiKey.id)}
                        icon={visibleKeys.has(selectedApiKey.id) ? <EyeSlashIcon /> : <EyeIcon />}
                      />
                    </Tooltip>
                  </FlexItem>
                  <FlexItem hidden={!visibleKeys.has(selectedApiKey.id)}>
                    <Tooltip content={t('pages.apiKeys.copyToClipboard')}>
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            selectedApiKey.fullKey || '',
                            t('pages.apiKeys.forms.apiKey'),
                          )
                        }
                        icon={<CopyIcon />}
                      />
                    </Tooltip>
                  </FlexItem>
                </Flex>
              </FormGroup>

              {!visibleKeys.has(selectedApiKey.id) && (
                <Alert
                  variant="info"
                  title={t('pages.apiKeys.modals.secureRetrieval')}
                  style={{ marginTop: '1rem' }}
                >
                  {t('pages.apiKeys.messages.secureRetrievalMessage')}
                </Alert>
              )}

              <div style={{ marginTop: '1rem' }}>
                <Table aria-label={t('pages.apiKeys.tableHeaders.keyDetails')} variant="compact">
                  <caption className="pf-v6-screen-reader">
                    {t('pages.apiKeys.tableHeaders.keyDetailsCaption', {
                      keyName: selectedApiKey.name,
                    })}
                  </caption>
                  <Tbody>
                    <Tr>
                      <Th scope="row">
                        <strong>{t('pages.apiKeys.forms.models')}</strong>
                      </Th>
                      <Td>
                        {selectedApiKey.models && selectedApiKey.models.length > 0 ? (
                          <LabelGroup numLabels={selectedApiKey.models.length}>
                            {selectedApiKey.models.map((modelId) => {
                              const modelDetail = selectedApiKey.modelDetails?.find(
                                (m) => m.id === modelId,
                              );
                              const isSelected = modelId === selectedModelForExample;
                              return (
                                <Label
                                  key={modelId}
                                  isCompact
                                  color={isSelected ? 'blue' : undefined}
                                  onClick={() => setSelectedModelForExample(modelId)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedModelForExample(modelId);
                                    }
                                  }}
                                  style={{ cursor: 'pointer' }}
                                  role="button"
                                  tabIndex={0}
                                  aria-pressed={isSelected}
                                  aria-label={`${modelDetail ? modelDetail.name : modelId}${isSelected ? ' (selected for code example)' : ' (click to use in code example)'}`}
                                >
                                  {modelDetail ? `${modelDetail.name}` : modelId}
                                </Label>
                              );
                            })}
                          </LabelGroup>
                        ) : (
                          t('pages.apiKeys.noModelsAssigned')
                        )}
                      </Td>
                    </Tr>
                    <Tr>
                      <Td colSpan={2} style={{ padding: 0 }}>
                        <Split hasGutter>
                          <SplitItem isFilled>
                            <Table aria-label="Key details left" variant="compact" borders={false}>
                              <Tbody>
                                <Tr>
                                  <Th scope="row">
                                    <strong>{t('pages.apiKeys.labels.apiUrl')}</strong>
                                  </Th>
                                  <Td>{litellmApiUrl}/{(() => {
                                    const detail = selectedApiKey.modelDetails?.find((m) => m.id === selectedModelForExample);
                                    const fromList = models.find((m) => m.id === selectedModelForExample);
                                    return (detail?.supportsConvert || fromList?.supportsConvert) ? 'docling/v1' : 'v1';
                                  })()}</Td>
                                </Tr>
                                <Tr>
                                  <Th scope="row">
                                    <strong>{t('pages.apiKeys.labels.created')}</strong>
                                  </Th>
                                  <Td>{formatDate(selectedApiKey.createdAt)}</Td>
                                </Tr>
                                <Tr>
                                  <Th scope="row">
                                    <strong>{t('pages.apiKeys.labels.totalRequests')}</strong>
                                  </Th>
                                  <Td>{selectedApiKey.usageCount.toLocaleString()}</Td>
                                </Tr>
                              </Tbody>
                            </Table>
                          </SplitItem>
                          <SplitItem isFilled>
                            <Table aria-label="Key limits" variant="compact" borders={false}>
                              <Tbody>
                                <Tr>
                                  <Th scope="row">
                                    <strong>{t('users.apiKeys.budget', 'Budget')}</strong>
                                  </Th>
                                  <Td>
                                    {selectedApiKey.maxBudget != null
                                      ? `${formatCurrency(selectedApiKey.currentSpend ?? 0)} / ${formatCurrency(selectedApiKey.maxBudget)}`
                                      : '-'}
                                  </Td>
                                </Tr>
                                <Tr>
                                  <Th scope="row">
                                    <strong>{t('users.apiKeys.tpmLimit', 'TPM Limit')}</strong>
                                  </Th>
                                  <Td>
                                    {selectedApiKey.tpmLimit != null
                                      ? selectedApiKey.tpmLimit.toLocaleString()
                                      : '-'}
                                  </Td>
                                </Tr>
                                <Tr>
                                  <Th scope="row">
                                    <strong>{t('users.apiKeys.rpmLimit', 'RPM Limit')}</strong>
                                  </Th>
                                  <Td>
                                    {selectedApiKey.rpmLimit != null
                                      ? selectedApiKey.rpmLimit.toLocaleString()
                                      : '-'}
                                  </Td>
                                </Tr>
                              </Tbody>
                            </Table>
                          </SplitItem>
                        </Split>
                      </Td>
                    </Tr>

                    {selectedApiKey.expiresAt && (
                      <Tr>
                        <Th scope="row">
                          <strong>{t('pages.apiKeys.labels.expires')}</strong>
                        </Th>
                        <Td>{formatDate(selectedApiKey.expiresAt)}</Td>
                      </Tr>
                    )}
                    {selectedApiKey.description && (
                      <Tr>
                        <Th scope="row">
                          <strong>{t('pages.apiKeys.labels.description')}</strong>
                        </Th>
                        <Td>{selectedApiKey.description}</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>
                  {t('pages.apiKeys.labels.usageExample')}
                </Content>
                <CodeBlock>
                  <CodeBlockCode>
                    {(() => {
                      const bearerToken = visibleKeys.has(selectedApiKey.id) && selectedApiKey.fullKey ? selectedApiKey.fullKey : '<click-show-key-to-reveal>';
                      const modelName = selectedModelForExample || 'gpt-4';
                      // Check model type from both API key modelDetails and loaded models array
                      const selectedModelDetail = selectedApiKey.modelDetails?.find((m) => m.id === selectedModelForExample);
                      const selectedModelFromList = models.find((m) => m.id === selectedModelForExample);
                      const isEmbeddingsModel = selectedModelDetail?.supportsEmbeddings || selectedModelFromList?.supportsEmbeddings;
                      const isConvertModel = selectedModelDetail?.supportsConvert || selectedModelFromList?.supportsConvert;

                      if (isEmbeddingsModel) {
                        return `# ${t('pages.apiKeys.codeExample.commentEmbeddings')}
curl -X POST ${litellmApiUrl}/v1/embeddings \\
  -H "accept: application/json" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -d '{
    "encoding_format": "float",
    "input": "${t('pages.apiKeys.codeExample.embeddingsInput')}",
    "model": "${modelName}"
  }'`;
                      }

                      if (isConvertModel) {
                        return `# ${t('pages.apiKeys.codeExample.commentConvert')}
curl -X POST ${litellmApiUrl}/docling/v1/convert/source \\
  -H "accept: application/json" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -d '{
    "model": "${modelName}",
    "sources": [{"kind": "http", "url": "${t('pages.apiKeys.codeExample.convertUrl')}"}],
    "options": {
      "image_export_mode": "placeholder"
    }
  }'`;
                      }

                      return `# ${t('pages.apiKeys.codeExample.commentChat')}
curl -X POST ${litellmApiUrl}/v1/chat/completions \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [
      {"role": "${t('pages.apiKeys.codeExample.role')}", "content": "${t('pages.apiKeys.codeExample.content')}"}
    ]
  }'`;
                    })()}
                  </CodeBlockCode>
                </CodeBlock>
              </div>

              {selectedApiKey.status === 'revoked' && (
                <Alert
                  variant="warning"
                  title={t('pages.apiKeys.modals.keyRevoked')}
                  style={{ marginTop: '1rem' }}
                >
                  {t('pages.apiKeys.messages.keyRevokedMessage')}
                </Alert>
              )}

              {selectedApiKey.status === 'expired' && (
                <Alert
                  variant="danger"
                  title={t('pages.apiKeys.modals.keyExpired')}
                  style={{ marginTop: '1rem' }}
                >
                  {t('pages.apiKeys.messages.keyExpiredMessage', {
                    date: selectedApiKey.expiresAt && formatDate(selectedApiKey.expiresAt),
                  })}
                </Alert>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="link"
            onClick={() => {
              setIsViewModalOpen(false);
              // Restore focus to the trigger element
              setTimeout(() => {
                viewModalTriggerRef.current?.focus();
              }, 100);
            }}
          >
            {t('pages.apiKeys.labels.close')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Generated Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        isOpen={showGeneratedKey}
        onClose={() => {
          setShowGeneratedKey(false);
          // Focus returns to the create modal trigger after key generation
          setTimeout(() => {
            createModalTriggerRef.current?.focus();
          }, 100);
        }}
        aria-modal="true"
        data-modal="generated"
        onEscapePress={() => {
          setShowGeneratedKey(false);
          // Focus returns to the create modal trigger after key generation
          setTimeout(() => {
            createModalTriggerRef.current?.focus();
          }, 100);
        }}
      >
        <ModalHeader title={t('pages.apiKeys.modals.createdTitle')} />
        <ModalBody>
          {generatedKey && (
            <>
              <Alert
                variant="success"
                title={t('pages.apiKeys.modals.success')}
                style={{ marginBottom: '1rem' }}
              >
                {t('pages.apiKeys.messages.keyCreatedMessage')}
              </Alert>

              <FormGroup label={t('pages.apiKeys.forms.yourNewApiKey')} fieldId="generated-key">
                <ClipboardCopy
                  hoverTip={t('pages.apiKeys.clipboard.copy')}
                  clickTip={t('pages.apiKeys.clipboard.copied')}
                  variant={ClipboardCopyVariant.expansion}
                  isReadOnly
                >
                  {generatedKey.fullKey || ''}
                </ClipboardCopy>
              </FormGroup>

              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>
                  {t('pages.apiKeys.labels.keyDetails')}
                </Content>
                <Table
                  aria-label={t('pages.apiKeys.tableHeaders.generatedKeyDetails')}
                  variant="compact"
                >
                  <caption className="pf-v6-screen-reader">
                    {t('pages.apiKeys.tableHeaders.generatedKeyDetailsCaption', {
                      keyName: generatedKey.name,
                    })}
                  </caption>
                  <Tbody>
                    <Tr>
                      <Th scope="row">
                        <strong>{t('pages.apiKeys.forms.name')}</strong>
                      </Th>
                      <Td>{generatedKey.name}</Td>
                    </Tr>
                    <Tr>
                      <Th scope="row">
                        <strong>{t('pages.apiKeys.forms.models')}</strong>
                      </Th>
                      <Td>
                        {generatedKey.models && generatedKey.models.length > 0 ? (
                          <LabelGroup>
                            {generatedKey.models.map((modelId) => {
                              const modelDetail = generatedKey.modelDetails?.find(
                                (m) => m.id === modelId,
                              );
                              return (
                                <Label key={modelId} isCompact>
                                  {modelDetail ? modelDetail.name : modelId}
                                </Label>
                              );
                            })}
                          </LabelGroup>
                        ) : (
                          t('pages.apiKeys.noModelsAssigned')
                        )}
                      </Td>
                    </Tr>
                    {/*                     
                    <Tr>
                      <Td>
                        <strong>{t('pages.apiKeys.labels.rateLimit')}</strong>
                      </Td>
                      <Td>
                        {generatedKey.rateLimit.toLocaleString()}{' '}
                        {t('pages.apiKeys.messages.requestsPerMinute')}
                      </Td>
                    </Tr>
                     */}
                    {generatedKey.expiresAt && (
                      <Tr>
                        <Th scope="row">
                          <strong>{t('pages.apiKeys.labels.expires')}</strong>
                        </Th>
                        <Td>{formatDate(generatedKey.expiresAt)}</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            ref={generatedModalPrimaryButtonRef}
            variant="primary"
            onClick={() => {
              setShowGeneratedKey(false);
              // Focus returns to the create modal trigger after key generation
              setTimeout(() => {
                createModalTriggerRef.current?.focus();
              }, 100);
            }}
          >
            {t('pages.apiKeys.labels.close')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          // Restore focus to the trigger element
          setTimeout(() => {
            deleteModalTriggerRef.current?.focus();
          }, 100);
        }}
        aria-modal="true"
        data-modal="delete"
        onEscapePress={() => {
          setIsDeleteModalOpen(false);
          // Restore focus to the trigger element
          setTimeout(() => {
            deleteModalTriggerRef.current?.focus();
          }, 100);
        }}
      >
        <ModalHeader title={t('pages.apiKeys.modals.deleteTitle')} />
        <ModalBody>
          {keyToDelete && (
            <>
              <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsMd' }}
                style={{ marginBottom: '1rem' }}
              >
                <FlexItem>
                  <ExclamationTriangleIcon color="var(--pf-t--global--color--status--danger--default)" />
                </FlexItem>
                <FlexItem>
                  <Content component={ContentVariants.p}>
                    {t('pages.apiKeys.messages.deleteConfirmation', { name: keyToDelete.name })}
                  </Content>
                </FlexItem>
              </Flex>

              <Alert
                variant="danger"
                title={t('pages.apiKeys.modals.warning')}
                style={{ marginBottom: '1rem' }}
              >
                {t('pages.apiKeys.messages.deleteWarning')}
              </Alert>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={confirmDeleteKey}>
            {t('pages.apiKeys.deleteKey')}
          </Button>
          <Button
            ref={deleteModalCancelButtonRef}
            variant="link"
            onClick={() => {
              setIsDeleteModalOpen(false);
              // Restore focus to the trigger element
              setTimeout(() => {
                deleteModalTriggerRef.current?.focus();
              }, 100);
            }}
          >
            {t('pages.apiKeys.labels.cancel')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reset Spend Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        isOpen={isResetSpendModalOpen}
        onClose={() => setIsResetSpendModalOpen(false)}
      >
        <ModalHeader title={t('users.apiKeys.resetSpendConfirmTitle', 'Reset API Key Spend')} />
        <ModalBody>
          <p>
            {t(
              'users.apiKeys.resetSpendConfirmBody',
              'Are you sure you want to reset the current spend for this API key to 0? This action cannot be undone.',
            )}
          </p>
          {editingKey && (
            <p style={{ marginTop: '0.5rem' }}>
              <strong>{editingKey.name}</strong>
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={confirmResetSpend}
            isLoading={resettingSpend}
            isDisabled={resettingSpend}
          >
            {t('users.apiKeys.resetSpend', 'Reset Spend')}
          </Button>
          <Button
            variant="link"
            onClick={() => setIsResetSpendModalOpen(false)}
            isDisabled={resettingSpend}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default ApiKeysPage;

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Card,
  CardBody,
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
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
  Label,
  LabelGroup,
  Divider,
  HelperText,
  HelperTextItem,
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
import { apiKeysService, ApiKey, CreateApiKeyRequest } from '../services/apiKeys.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { modelsService, Model } from '../services/models.service';
import { configService } from '../services/config.service';

const ApiKeysPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

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
  const [creatingKey, setCreatingKey] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [generatedKey, setGeneratedKey] = useState<ApiKey | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Edit modal state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [updatingKey, setUpdatingKey] = useState(false);

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
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);

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
      let errorMessage = t('pages.apiKeys.notifications.loadErrorDesc');

      // Extract error message from Axios error response
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage =
          typeof err.response.data.error === 'string'
            ? err.response.data.error
            : err.response.data.error.message || errorMessage;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      addNotification({
        title: t('pages.apiKeys.notifications.loadError'),
        description: errorMessage,
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load configuration
  const loadConfig = async () => {
    try {
      const config = await configService.getConfig();
      setLitellmApiUrl(config.litellmApiUrl);
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
      let errorMessage = t('pages.apiKeys.notifications.loadModelErrorDesc');

      // Extract error message from Axios error response
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage =
          typeof err.response.data.error === 'string'
            ? err.response.data.error
            : err.response.data.error.message || errorMessage;
      } else if (err.message) {
        errorMessage = err.message;
      }

      addNotification({
        title: t('pages.apiKeys.notifications.loadModelError'),
        description: errorMessage,
        variant: 'danger',
      });
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
    loadModels(); // ✅ Load models on component mount
    loadConfig(); // Load configuration including LiteLLM API URL
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
      active: 'success',
      revoked: 'warning',
      expired: 'danger',
    } as const;

    const icons = {
      active: <CheckCircleIcon />,
      revoked: <ExclamationTriangleIcon />,
      expired: <ExclamationTriangleIcon />,
    };

    return (
      <Badge color={variants[status as keyof typeof variants]}>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
          <FlexItem>{icons[status as keyof typeof icons]}</FlexItem>
          <FlexItem>{status.charAt(0).toUpperCase() + status.slice(1)}</FlexItem>
        </Flex>
      </Badge>
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
    setNewKeyExpiration('never');
    setSelectedModelIds([]); // ✅ Reset model selection
    setFormErrors({}); // Clear any previous validation errors
    // Store reference to the trigger element for focus restoration
    if (triggerElement) {
      createModalTriggerRef.current = triggerElement;
    }
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

    try {
      if (isEditMode && editingKey) {
        // Update existing API key
        const updateRequest = {
          name: newKeyName,
          modelIds: selectedModelIds,
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
            newKeyExpiration !== 'never'
              ? new Date(
                  Date.now() + parseInt(newKeyExpiration) * 24 * 60 * 60 * 1000,
                ).toISOString()
              : undefined,
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
      let errorMessage = isEditMode
        ? t('pages.apiKeys.notifications.updateErrorDesc')
        : t('pages.apiKeys.notifications.createErrorDesc');

      // Extract error message from Axios error response
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage =
          typeof err.response.data.error === 'string'
            ? err.response.data.error
            : err.response.data.error.message || errorMessage;
      } else if (err.message) {
        errorMessage = err.message;
      }

      addNotification({
        title: isEditMode
          ? t('pages.apiKeys.notifications.updateError')
          : t('pages.apiKeys.notifications.createError'),
        description: errorMessage,
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
    if (triggerElement) {
      viewModalTriggerRef.current = triggerElement;
    }
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
    setNewKeyExpiration('never'); // Reset expiration for edit
    setFormErrors({}); // Clear any previous validation errors

    // Store reference to the trigger element for focus restoration
    if (triggerElement) {
      createModalTriggerRef.current = triggerElement;
    }
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
      let errorMessage = t('pages.apiKeys.notifications.deleteErrorDesc');

      // Extract error message from Axios error response
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage =
          typeof err.response.data.error === 'string'
            ? err.response.data.error
            : err.response.data.error.message || errorMessage;
      } else if (err.message) {
        errorMessage = err.message;
      }

      addNotification({
        title: t('pages.apiKeys.notifications.deleteError'),
        description: errorMessage,
        variant: 'danger',
      });
    } finally {
      setIsDeleteModalOpen(false);
      setKeyToDelete(null);
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
            error instanceof Error
              ? error.message
              : t('pages.apiKeys.notifications.retrieveErrorDesc'),
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
                    <Tr key={apiKey.id}>
                      <Th scope="row">
                        <Flex direction={{ default: 'column' }}>
                          <FlexItem>
                            <strong>{apiKey.name}</strong>
                          </FlexItem>
                          {apiKey.description && (
                            <FlexItem>
                              <Content
                                component={ContentVariants.small}
                                style={{ color: 'var(--pf-v6-global--Color--200)' }}
                              >
                                {apiKey.description}
                              </Content>
                            </FlexItem>
                          )}
                        </Flex>
                      </Th>
                      <Td>
                        <Flex
                          alignItems={{ default: 'alignItemsCenter' }}
                          spaceItems={{ default: 'spaceItemsSm' }}
                        >
                          <FlexItem>
                            <code
                              style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
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
                              style={{ color: 'var(--pf-v6-global--Color--200)' }}
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
                            ? new Date(apiKey.lastUsed).toLocaleDateString()
                            : t('pages.apiKeys.never')}
                        </Content>
                      </Td>
                       */}
                      <Td>
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
        title={
          isEditMode ? t('pages.apiKeys.modals.editTitle') : t('pages.apiKeys.modals.createTitle')
        }
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
              <Select
                role="listbox"
                id="key-models"
                isOpen={isModelSelectOpen}
                onOpenChange={setIsModelSelectOpen}
                aria-label={t('pages.apiKeys.forms.modelsAriaLabel')}
                aria-required="true"
                aria-invalid={formErrors.models ? 'true' : 'false'}
                aria-describedby={formErrors.models ? 'key-models-error' : undefined}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                    isExpanded={isModelSelectOpen}
                    aria-expanded={isModelSelectOpen}
                    aria-haspopup="listbox"
                    aria-invalid={formErrors.models ? 'true' : 'false'}
                    aria-describedby={formErrors.models ? 'key-models-error' : undefined}
                  >
                    {selectedModelIds.length === 0
                      ? t('pages.apiKeys.selectModels')
                      : t('pages.apiKeys.modelsSelected', { count: selectedModelIds.length })}
                    {selectedModelIds.length > 0 && <Badge isRead>{selectedModelIds.length}</Badge>}
                  </MenuToggle>
                )}
                onSelect={(_event, selection) => {
                  const selectionString = selection as string;
                  if (selectedModelIds.includes(selectionString)) {
                    setSelectedModelIds(selectedModelIds.filter((id) => id !== selectionString));
                  } else {
                    setSelectedModelIds([...selectedModelIds, selectionString]);
                  }
                  // Clear validation error when user makes a selection
                  if (formErrors.models) {
                    const newErrors = { ...formErrors };
                    delete newErrors.models;
                    setFormErrors(newErrors);
                  }
                }}
                selected={selectedModelIds}
              >
                <SelectList>
                  {loadingModels ? (
                    <SelectOption isDisabled>
                      {t('pages.apiKeys.messages.loadingModels')}
                    </SelectOption>
                  ) : models.length === 0 ? (
                    <SelectOption isDisabled>
                      {t('pages.apiKeys.messages.noSubscribedModels')}
                    </SelectOption>
                  ) : (
                    <>
                      <SelectOption
                        key="select-all"
                        value="select-all"
                        hasCheckbox
                        isSelected={selectedModelIds.length === models.length}
                        onClick={() => {
                          if (selectedModelIds.length === models.length) {
                            setSelectedModelIds([]);
                          } else {
                            setSelectedModelIds(models.map((m) => m.id));
                          }
                        }}
                        aria-label={t('pages.apiKeys.selectAllModelsAriaLabel')}
                      >
                        <strong>{t('pages.apiKeys.selectAll')}</strong>
                      </SelectOption>
                      <Divider />
                      {models.map((model) => (
                        <SelectOption
                          key={model.id}
                          value={model.id}
                          hasCheckbox
                          isSelected={selectedModelIds.includes(model.id)}
                          aria-label={t('pages.apiKeys.selectModelAriaLabel', { name: model.name })}
                        >
                          {model.name}
                        </SelectOption>
                      ))}
                    </>
                  )}
                </SelectList>
              </Select>
              {formErrors.models && (
                <HelperText id="key-models-error">
                  <HelperTextItem variant="error">{formErrors.models}</HelperTextItem>
                </HelperText>
              )}
              {models.length === 0 && !loadingModels && (
                <HelperText id="key-models-no-subscriptions">
                  <HelperTextItem variant="error">
                    {t('pages.apiKeys.messages.noSubscribedModelsError')}
                  </HelperTextItem>
                </HelperText>
              )}
            </FormGroup>
            {selectedModelIds.length > 0 && (
              <LabelGroup>
                {selectedModelIds.map((modelId) => {
                  const model = models.find((m) => m.id === modelId);
                  return model ? (
                    <Label
                      key={modelId}
                      onClose={() =>
                        setSelectedModelIds(selectedModelIds.filter((id) => id !== modelId))
                      }
                      isCompact
                    >
                      {model.name}
                    </Label>
                  ) : null;
                })}
              </LabelGroup>
            )}

            {/* TODO: Not selectable by user. Needed?
            <FormGroup label={t('pages.apiKeys.labels.rateLimitLabel')} fieldId="key-rate-limit">
              <FormSelect
                value={newKeyRateLimit}
                onChange={(_event, value) => setNewKeyRateLimit(value)}
                id="key-rate-limit"
              >
                <FormSelectOption value="100" label={t('pages.apiKeys.rateLimits.basic')} />
                <FormSelectOption value="500" label={t('pages.apiKeys.rateLimits.standard')} />
                <FormSelectOption value="1000" label={t('pages.apiKeys.rateLimits.premium')} />
                <FormSelectOption value="5000" label={t('pages.apiKeys.rateLimits.enterprise')} />
              </FormSelect>
            </FormGroup>

            <FormGroup label={t('pages.apiKeys.forms.expiration')} fieldId="key-expiration">
              <FormSelect
                value={newKeyExpiration}
                onChange={(_event, value) => setNewKeyExpiration(value)}
                id="key-expiration"
              >
                <FormSelectOption value="never" label={t('pages.apiKeys.neverExpires')} />
                <FormSelectOption value="30" label={t('pages.apiKeys.timeRanges.thirtyDays')} />
                <FormSelectOption value="90" label={t('pages.apiKeys.timeRanges.ninetyDays')} />
                <FormSelectOption value="365" label={t('pages.apiKeys.timeRanges.oneYear')} />
              </FormSelect>
            </FormGroup> */}
          </Form>

          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
            }}
          >
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
          </div>
        </ModalBody>
      </Modal>

      {/* View API Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={selectedApiKey?.name || ''}
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
                        fontSize: '0.875rem',
                        padding: '0.5rem',
                        backgroundColor: 'var(--pf-v6-global--BackgroundColor--200)',
                        border: '1px solid var(--pf-v6-global--BorderColor--100)',
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
                          <LabelGroup>
                            {selectedApiKey.models.map((modelId) => {
                              const modelDetail = selectedApiKey.modelDetails?.find(
                                (m) => m.id === modelId,
                              );
                              return (
                                <Label key={modelId} isCompact>
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
                      <Th scope="row">
                        <strong>API URL</strong>
                      </Th>
                      <Td>{litellmApiUrl}/v1</Td>
                    </Tr>
                    <Tr>
                      <Th scope="row">
                        <strong>{t('pages.apiKeys.labels.created')}</strong>
                      </Th>
                      <Td>{new Date(selectedApiKey.createdAt).toLocaleDateString()}</Td>
                    </Tr>
                    <Tr>
                      <Th scope="row">
                        <strong>{t('pages.apiKeys.labels.totalRequests')}</strong>
                      </Th>
                      <Td>{selectedApiKey.usageCount.toLocaleString()}</Td>
                    </Tr>

                    {selectedApiKey.expiresAt && (
                      <Tr>
                        <Th scope="row">
                          <strong>{t('pages.apiKeys.labels.expires')}</strong>
                        </Th>
                        <Td>{new Date(selectedApiKey.expiresAt).toLocaleDateString()}</Td>
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
                    {`# Using your secure LiteLLM API key
curl -X POST ${litellmApiUrl}/v1/chat/completions \
  -H "Authorization: Bearer ${visibleKeys.has(selectedApiKey.id) && selectedApiKey.fullKey ? selectedApiKey.fullKey : '<click-show-key-to-reveal>'}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "${selectedApiKey.models && selectedApiKey.models.length > 0 ? selectedApiKey.models[0] : 'gpt-4'}",
    "messages": [
      {"role": "${t('pages.apiKeys.codeExample.role')}", "content": "${t('pages.apiKeys.codeExample.content')}"}
    ]
  }'`}
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
                    date:
                      selectedApiKey.expiresAt &&
                      new Date(selectedApiKey.expiresAt).toLocaleDateString(),
                  })}
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
          </div>
        </ModalBody>
      </Modal>

      {/* Generated Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={t('pages.apiKeys.modals.createdTitle')}
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
                        <Td>{new Date(generatedKey.expiresAt).toLocaleDateString()}</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </div>
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
          </div>
        </ModalBody>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title={t('pages.apiKeys.modals.deleteTitle')}
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
        <ModalBody>
          {keyToDelete && (
            <>
              <Flex
                alignItems={{ default: 'alignItemsCenter' }}
                spaceItems={{ default: 'spaceItemsMd' }}
                style={{ marginBottom: '1rem' }}
              >
                <FlexItem>
                  <ExclamationTriangleIcon color="var(--pf-v6-global--danger--color--100)" />
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

          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
            }}
          >
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
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ApiKeysPage;

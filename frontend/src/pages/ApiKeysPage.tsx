import React, { useState, useEffect } from 'react';
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
  FormSelect,
  FormSelectOption,
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
  const [generatedKey, setGeneratedKey] = useState<ApiKey | null>(null);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const handleCreateApiKey = () => {
    setNewKeyName('');
    setNewKeyDescription('');
    setNewKeyPermissions([]);
    setNewKeyRateLimit('1000');
    setNewKeyExpiration('never');
    setSelectedModelIds([]); // ✅ Reset model selection
    setIsCreateModalOpen(true);
  };

  const handleSaveApiKey = async () => {
    if (!newKeyName.trim()) {
      addNotification({
        title: t('pages.apiKeys.notifications.validationError'),
        description: t('pages.apiKeys.notifications.nameRequired'),
        variant: 'danger',
      });
      return;
    }

    // ✅ Validate model selection
    if (selectedModelIds.length === 0) {
      addNotification({
        title: t('pages.apiKeys.notifications.validationError'),
        description: t('pages.apiKeys.notifications.modelsRequired'),
        variant: 'danger',
      });
      return;
    }

    setCreatingKey(true);

    try {
      const request: CreateApiKeyRequest = {
        modelIds: selectedModelIds, // ✅ Use modelIds for multi-model support
        name: newKeyName,
        expiresAt:
          newKeyExpiration !== 'never'
            ? new Date(Date.now() + parseInt(newKeyExpiration) * 24 * 60 * 60 * 1000).toISOString()
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
    } catch (err: any) {
      console.error('Failed to create API key:', err);
      let errorMessage = t('pages.apiKeys.notifications.createErrorDesc');

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
        title: t('pages.apiKeys.notifications.createError'),
        description: errorMessage,
        variant: 'danger',
      });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleViewKey = (apiKey: ApiKey) => {
    setSelectedApiKey(apiKey);
    setIsViewModalOpen(true);
  };

  const handleDeleteKey = (apiKey: ApiKey) => {
    setKeyToDelete(apiKey);
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
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateApiKey}>
              {t('pages.apiKeys.createKey')}
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        {error ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <KeyIcon />
            <Title headingLevel="h2" size="lg">
              {t('pages.apiKeys.messages.errorLoadingTitle')}
            </Title>
            <EmptyStateBody>{error}</EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" onClick={loadApiKeys}>
                {t('ui.actions.tryAgain')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : apiKeys.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <KeyIcon />
            <Title headingLevel="h2" size="lg">
              {t('pages.apiKeys.messages.noKeysTitle')}
            </Title>
            <EmptyStateBody>{t('pages.apiKeys.messages.noKeysDescription')}</EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateApiKey}>
                {t('pages.apiKeys.createKey')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <Card>
            <CardBody>
              <Table aria-label={t('pages.apiKeys.tableHeaders.apiKeysTable')} variant="compact">
                <Thead>
                  <Tr>
                    <Th>{t('pages.apiKeys.forms.name')}</Th>
                    <Th>{t('pages.apiKeys.forms.apiKey')}</Th>
                    <Th>{t('pages.apiKeys.forms.models')}</Th>
                    <Th>{t('pages.apiKeys.labels.lastUsed')}</Th>
                    <Th>{t('pages.apiKeys.labels.actions')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {apiKeys.map((apiKey) => (
                    <Tr key={apiKey.id}>
                      <Td>
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
                      </Td>
                      <Td>
                        <Flex
                          alignItems={{ default: 'alignItemsCenter' }}
                          spaceItems={{ default: 'spaceItemsSm' }}
                        >
                          <FlexItem>
                            <code style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
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
                              />
                            </Tooltip>
                          </FlexItem>
                          <FlexItem>
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
                      <Td>
                        <Content component={ContentVariants.small}>
                          {apiKey.lastUsed
                            ? new Date(apiKey.lastUsed).toLocaleDateString()
                            : t('pages.apiKeys.never')}
                        </Content>
                      </Td>
                      <Td>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleViewKey(apiKey)}
                            >
                              {t('pages.apiKeys.viewKey')}
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteKey(apiKey)}
                              isDisabled={apiKey.status !== 'active'}
                              icon={<TrashIcon />}
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
        title={t('pages.apiKeys.modals.createTitle')}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      >
        <ModalBody>
          <Form>
            <FormGroup label={t('pages.apiKeys.forms.name')} isRequired fieldId="key-name">
              <TextInput
                isRequired
                type="text"
                id="key-name"
                value={newKeyName}
                onChange={(_event, value) => setNewKeyName(value)}
                placeholder={t('pages.apiKeys.placeholders.keyName')}
              />
            </FormGroup>

            <FormGroup label={t('pages.apiKeys.forms.description')} fieldId="key-description">
              <TextInput
                type="text"
                id="key-description"
                value={newKeyDescription}
                onChange={(_event, value) => setNewKeyDescription(value)}
                placeholder={t('pages.apiKeys.placeholders.keyDescription')}
              />
            </FormGroup>

            {/* ✅ Multi-model selection */}
            <FormGroup label={t('pages.apiKeys.forms.models')} isRequired fieldId="key-models">
              <Select
                role="menu"
                id="key-models"
                isOpen={isModelSelectOpen}
                onOpenChange={setIsModelSelectOpen}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                    isExpanded={isModelSelectOpen}
                  >
                    {t('pages.apiKeys.selectModels')}
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
                        >
                          {model.name}
                        </SelectOption>
                      ))}
                    </>
                  )}
                </SelectList>
              </Select>
              {models.length === 0 && !loadingModels && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--pf-v6-global--danger-color--100)',
                  }}
                >
                  {t('pages.apiKeys.messages.noSubscribedModelsError')}
                </div>
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
            </FormGroup>
          </Form>

          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="primary" onClick={handleSaveApiKey} isLoading={creatingKey}>
              {creatingKey ? t('pages.apiKeys.creating') : t('pages.apiKeys.createKey')}
            </Button>
            <Button variant="link" onClick={() => setIsCreateModalOpen(false)}>
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
        onClose={() => setIsViewModalOpen(false)}
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
                  <FlexItem>
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
                  <Tbody>
                    <Tr>
                      <Td>
                        <strong>{t('pages.apiKeys.forms.models')}</strong>
                      </Td>
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
                      <Td>
                        <strong>API URL</strong>
                      </Td>
                      <Td>{litellmApiUrl}/v1</Td>
                    </Tr>
                    <Tr>
                      <Td>
                        <strong>{t('pages.apiKeys.labels.created')}</strong>
                      </Td>
                      <Td>{new Date(selectedApiKey.createdAt).toLocaleDateString()}</Td>
                    </Tr>
                    <Tr>
                      <Td>
                        <strong>{t('pages.apiKeys.labels.totalRequests')}</strong>
                      </Td>
                      <Td>{selectedApiKey.usageCount.toLocaleString()}</Td>
                    </Tr>

                    {selectedApiKey.expiresAt && (
                      <Tr>
                        <Td>
                          <strong>{t('pages.apiKeys.labels.expires')}</strong>
                        </Td>
                        <Td>{new Date(selectedApiKey.expiresAt).toLocaleDateString()}</Td>
                      </Tr>
                    )}
                    {selectedApiKey.description && (
                      <Tr>
                        <Td>
                          <strong>{t('pages.apiKeys.labels.description')}</strong>
                        </Td>
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
            <Button variant="link" onClick={() => setIsViewModalOpen(false)}>
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
        onClose={() => setShowGeneratedKey(false)}
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
                  <Tbody>
                    <Tr>
                      <Td>
                        <strong>{t('pages.apiKeys.forms.name')}</strong>
                      </Td>
                      <Td>{generatedKey.name}</Td>
                    </Tr>
                    <Tr>
                      <Td>
                        <strong>{t('pages.apiKeys.forms.models')}</strong>
                      </Td>
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
                    <Tr>
                      <Td>
                        <strong>{t('pages.apiKeys.labels.rateLimit')}</strong>
                      </Td>
                      <Td>
                        {generatedKey.rateLimit.toLocaleString()}{' '}
                        {t('pages.apiKeys.messages.requestsPerMinute')}
                      </Td>
                    </Tr>
                    {generatedKey.expiresAt && (
                      <Tr>
                        <Td>
                          <strong>{t('pages.apiKeys.labels.expires')}</strong>
                        </Td>
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
            <Button variant="primary" onClick={() => setShowGeneratedKey(false)}>
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
        onClose={() => setIsDeleteModalOpen(false)}
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
            <Button variant="link" onClick={() => setIsDeleteModalOpen(false)}>
              {t('pages.apiKeys.labels.cancel')}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ApiKeysPage;

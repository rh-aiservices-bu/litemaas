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
  Label,
  LabelGroup,
} from '@patternfly/react-core';
import { 
  KeyIcon, 
  PlusCircleIcon,
  CopyIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useNotifications } from '../contexts/NotificationContext';
import { apiKeysService, ApiKey, CreateApiKeyRequest } from '../services/apiKeys.service';
import { subscriptionsService, Subscription } from '../services/subscriptions.service';
import { modelsService, Model } from '../services/models.service';
import { configService, ConfigResponse } from '../services/config.service';

const ApiKeysPage: React.FC = () => {
  const { } = useTranslation();
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
    } catch (err) {
      console.error('Failed to load API keys:', err);
      setError('Failed to load API keys. Please try again.');
      addNotification({
        title: 'Error',
        description: 'Failed to load API keys from the server.',
        variant: 'danger'
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
      const activeSubscriptions = subscriptionsResponse.data.filter(sub => sub.status === 'active');
      
      // Extract unique models from subscriptions
      const uniqueModelIds = [...new Set(activeSubscriptions.map(sub => sub.modelId))];
      
      // Fetch detailed model information for each subscribed model
      const modelPromises = uniqueModelIds.map(modelId => 
        modelsService.getModel(modelId).catch(err => {
          console.warn(`Failed to load model ${modelId}:`, err);
          return null;
        })
      );
      
      const modelResults = await Promise.all(modelPromises);
      const validModels = modelResults.filter(model => model !== null) as Model[];
      
      setModels(validModels);
    } catch (err) {
      console.error('Failed to load subscribed models:', err);
      addNotification({
        title: 'Error',
        description: 'Failed to load your subscribed models.',
        variant: 'danger'
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

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'success',
      revoked: 'warning', 
      expired: 'danger'
    } as const;

    const icons = {
      active: <CheckCircleIcon />,
      revoked: <ExclamationTriangleIcon />,
      expired: <ExclamationTriangleIcon />
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
        title: 'Validation Error',
        description: 'API key name is required',
        variant: 'danger'
      });
      return;
    }

    // ✅ Validate model selection
    if (selectedModelIds.length === 0) {
      addNotification({
        title: 'Validation Error',
        description: 'Please select at least one model from your active subscriptions',
        variant: 'danger'
      });
      return;
    }

    setCreatingKey(true);
    
    try {
      const request: CreateApiKeyRequest = {
        modelIds: selectedModelIds, // ✅ Use modelIds for multi-model support
        name: newKeyName,
        expiresAt: newKeyExpiration !== 'never' 
          ? new Date(Date.now() + parseInt(newKeyExpiration) * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
        // ✅ Put additional fields in metadata as backend expects
        metadata: {
          description: newKeyDescription || undefined,
          permissions: newKeyPermissions,
          rateLimit: parseInt(newKeyRateLimit)
        }
      };

      const newKey = await apiKeysService.createApiKey(request);
      
      // Refresh the API keys list
      await loadApiKeys();
      
      setGeneratedKey(newKey);
      setShowGeneratedKey(true);
      setIsCreateModalOpen(false);
      
      addNotification({
        title: 'API Key Created',
        description: `${newKeyName} has been created successfully`,
        variant: 'success'
      });
    } catch (err) {
      console.error('Failed to create API key:', err);
      addNotification({
        title: 'Error',
        description: 'Failed to create API key. Please try again.',
        variant: 'danger'
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
        title: 'API Key Deleted',
        description: `${keyToDelete.name} has been deleted`,
        variant: 'success'
      });
    } catch (err) {
      console.error('Failed to delete API key:', err);
      addNotification({
        title: 'Error',
        description: 'Failed to delete API key. Please try again.',
        variant: 'danger'
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
        setApiKeys(prev => prev.map(key => 
          key.id === keyId 
            ? { ...key, fullKey: keyData.key, keyType: keyData.keyType }
            : key
        ));
        
        // Show the key
        newVisibleKeys.add(keyId);
        setVisibleKeys(newVisibleKeys);
        
        addNotification({
          title: 'API Key Retrieved',
          description: `Your LiteLLM API key has been retrieved securely. Retrieved at: ${new Date(keyData.retrievedAt).toLocaleString()}`,
          variant: 'success'
        });
      } catch (error) {
        addNotification({
          title: 'Error Retrieving API Key',
          description: error instanceof Error ? error.message : 'Failed to retrieve API key',
          variant: 'danger'
        });
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addNotification({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
      variant: 'info'
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
            API Keys
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                Loading API Keys...
              </Title>
              <EmptyStateBody>
                Retrieving your API key information
              </EmptyStateBody>
            </EmptyState>
          </Bullseye>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <PageSection variant="secondary">
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              API Keys
            </Title>
            <Content component={ContentVariants.p}>
              Manage API keys for accessing LiteMaaS services
            </Content>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateApiKey}>
              Create API Key
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>
      
      <PageSection>
        {error ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <KeyIcon />
            <Title headingLevel="h2" size="lg">
              Error loading API keys
            </Title>
            <EmptyStateBody>
              {error}
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" onClick={loadApiKeys}>
                Retry
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : apiKeys.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <KeyIcon />
            <Title headingLevel="h2" size="lg">
              No API keys found
            </Title>
            <EmptyStateBody>
              Create your first API key to start using LiteMaaS services.
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateApiKey}>
                Create API Key
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <Card>
            <CardBody>
              <Table aria-label="API Keys Table" variant="compact">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Key</Th>
                    <Th>Models</Th>
                    <Th>Status</Th>
                    <Th>Last Used</Th>
                    <Th>Actions</Th>
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
                              <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                                {apiKey.description}
                              </Content>
                            </FlexItem>
                          )}
                        </Flex>
                      </Td>
                      <Td>
                        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <code style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                              {visibleKeys.has(apiKey.id) && apiKey.fullKey 
                                ? `${apiKey.fullKey} (LiteLLM)`
                                : apiKey.keyPreview || '************'}
                            </code>
                          </FlexItem>
                          <FlexItem>
                            <Tooltip content={visibleKeys.has(apiKey.id) ? 'Hide key' : 'Show key'}>
                              <Button
                                variant="plain"
                                size="sm"
                                onClick={() => toggleKeyVisibility(apiKey.id)}
                                icon={visibleKeys.has(apiKey.id) ? <EyeSlashIcon /> : <EyeIcon />}
                              />
                            </Tooltip>
                          </FlexItem>
                          <FlexItem>
                            <Tooltip content="Copy to clipboard">
                              <Button
                                variant="plain"
                                size="sm"
                                onClick={() => copyToClipboard(apiKey.fullKey || '', 'API key')}
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
                              const modelDetail = apiKey.modelDetails?.find(m => m.id === modelId);
                              return (
                                <Label key={modelId} isCompact>
                                  {modelDetail ? modelDetail.name : modelId}
                                </Label>
                              );
                            })
                          ) : (
                            <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                              No models
                            </Content>
                          )}
                          {apiKey.models && apiKey.models.length > 2 && (
                            <Label isCompact>
                              +{apiKey.models.length - 2} more
                            </Label>
                          )}
                        </LabelGroup>
                      </Td>
                      <Td>
                        {getStatusBadge(apiKey.status)}
                      </Td>
                      <Td>
                        <Content component={ContentVariants.small}>
                          {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleDateString() : 'Never'}
                        </Content>
                      </Td>
                      <Td>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Button variant="secondary" size="sm" onClick={() => handleViewKey(apiKey)}>
                              View
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
                              Delete
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
        title="Create API Key"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      >
        <ModalBody>
          <Form>
            <FormGroup label="Name" isRequired fieldId="key-name">
              <TextInput
                isRequired
                type="text"
                id="key-name"
                value={newKeyName}
                onChange={(_event, value) => setNewKeyName(value)}
                placeholder="e.g., Production API Key"
              />
            </FormGroup>
            
            <FormGroup label="Description" fieldId="key-description">
              <TextInput
                type="text"
                id="key-description"
                value={newKeyDescription}
                onChange={(_event, value) => setNewKeyDescription(value)}
                placeholder="Optional description of this key's purpose"
              />
            </FormGroup>
            
            {/* ✅ Multi-model selection */}
            <FormGroup label="Models" isRequired fieldId="key-models">
              <Select
                id="key-models"
                isOpen={isModelSelectOpen}
                onToggle={(_event, isOpen) => setIsModelSelectOpen(isOpen)}
                onSelect={(_event, selection) => {
                  const selectionString = selection as string;
                  if (selectedModelIds.includes(selectionString)) {
                    setSelectedModelIds(selectedModelIds.filter(id => id !== selectionString));
                  } else {
                    setSelectedModelIds([...selectedModelIds, selectionString]);
                  }
                }}
                selections={selectedModelIds}
                isCheckboxSelectionBadgeHidden
                toggle={(toggleRef) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                    isExpanded={isModelSelectOpen}
                    isFullWidth
                  >
                    {selectedModelIds.length === 0 ? 'Select models...' : `${selectedModelIds.length} model(s) selected`}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {loadingModels ? (
                    <SelectOption isDisabled>Loading your subscribed models...</SelectOption>
                  ) : models.length === 0 ? (
                    <SelectOption isDisabled>No subscribed models available</SelectOption>
                  ) : (
                    models.map((model) => (
                      <SelectOption
                        key={model.id}
                        value={model.id}
                        hasCheckbox
                        isSelected={selectedModelIds.includes(model.id)}
                      >
                        {model.name} ({model.provider})
                      </SelectOption>
                    ))
                  )}
                </SelectList>
              </Select>
              {models.length === 0 && !loadingModels && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--pf-v6-global--danger-color--100)' }}>
                  No subscribed models found. You need an active subscription to a model before creating an API key.
                </div>
              )}
              {selectedModelIds.length > 0 && (
                <LabelGroup categoryName="Selected models" style={{ marginTop: '0.5rem' }}>
                  {selectedModelIds.map(modelId => {
                    const model = models.find(m => m.id === modelId);
                    return model ? (
                      <Label
                        key={modelId}
                        onClose={() => setSelectedModelIds(selectedModelIds.filter(id => id !== modelId))}
                        isCompact
                      >
                        {model.name}
                      </Label>
                    ) : null;
                  })}
                </LabelGroup>
              )}
            </FormGroup>
            
            <FormGroup label="Rate Limit (requests per minute)" fieldId="key-rate-limit">
              <FormSelect
                value={newKeyRateLimit}
                onChange={(_event, value) => setNewKeyRateLimit(value)}
                id="key-rate-limit"
              >
                <FormSelectOption value="100" label="100 req/min (Basic)" />
                <FormSelectOption value="500" label="500 req/min (Standard)" />
                <FormSelectOption value="1000" label="1,000 req/min (Premium)" />
                <FormSelectOption value="5000" label="5,000 req/min (Enterprise)" />
              </FormSelect>
            </FormGroup>
            
            <FormGroup label="Expiration" fieldId="key-expiration">
              <FormSelect
                value={newKeyExpiration}
                onChange={(_event, value) => setNewKeyExpiration(value)}
                id="key-expiration"
              >
                <FormSelectOption value="never" label="Never expires" />
                <FormSelectOption value="30" label="30 days" />
                <FormSelectOption value="90" label="90 days" />
                <FormSelectOption value="365" label="1 year" />
              </FormSelect>
            </FormGroup>
          </Form>
          
<div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={handleSaveApiKey}
              isLoading={creatingKey}
            >
              {creatingKey ? 'Creating...' : 'Create API Key'}
            </Button>
            <Button variant="link" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
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
          <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
            <FlexItem>
              <Title headingLevel="h2" size="xl">{selectedApiKey?.name}</Title>
            </FlexItem>
            <FlexItem>
              {selectedApiKey && getStatusBadge(selectedApiKey.status)}
            </FlexItem>
          </Flex>
          <Content component={ContentVariants.p} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
            API Key Details
          </Content>
        </ModalHeader>
        <ModalBody>
          {selectedApiKey && (
            <>
              <FormGroup label="API Key" fieldId="view-key">
                <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem flex={{ default: 'flex_1' }}>
                    <code style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.875rem', 
                      padding: '0.5rem', 
                      backgroundColor: 'var(--pf-v6-global--BackgroundColor--200)',
                      border: '1px solid var(--pf-v6-global--BorderColor--100)',
                      borderRadius: '3px',
                      display: 'block',
                      wordBreak: 'break-all'
                    }}>
                      {visibleKeys.has(selectedApiKey.id) && selectedApiKey.fullKey 
                        ? `${selectedApiKey.fullKey} (LiteLLM)`
                        : selectedApiKey.keyPreview || '************'}
                    </code>
                  </FlexItem>
                  <FlexItem>
                    <Tooltip content={visibleKeys.has(selectedApiKey.id) ? 'Hide key' : 'Show key'}>
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() => toggleKeyVisibility(selectedApiKey.id)}
                        icon={visibleKeys.has(selectedApiKey.id) ? <EyeSlashIcon /> : <EyeIcon />}
                      />
                    </Tooltip>
                  </FlexItem>
                  <FlexItem>
                    <Tooltip content="Copy to clipboard">
                      <Button
                        variant="plain"
                        size="sm"
                        onClick={() => copyToClipboard(selectedApiKey.fullKey || '', 'API key')}
                        icon={<CopyIcon />}
                      />
                    </Tooltip>
                  </FlexItem>
                </Flex>
              </FormGroup>
              
              {!visibleKeys.has(selectedApiKey.id) && (
                <Alert variant="info" title="Secure Key Retrieval" style={{ marginTop: '1rem' }}>
                  Click the eye icon above to securely retrieve your full LiteLLM API key. For security reasons, 
                  this requires recent authentication and is rate-limited. All key retrievals are logged for audit purposes.
                </Alert>
              )}
              
              <div style={{ marginTop: '1rem' }}>
                <Table aria-label="Key details" variant="compact">
                  <Tbody>
                    <Tr>
                      <Td><strong>Models</strong></Td>
                      <Td>
                        {selectedApiKey.models && selectedApiKey.models.length > 0 ? (
                          <LabelGroup>
                            {selectedApiKey.models.map((modelId) => {
                              const modelDetail = selectedApiKey.modelDetails?.find(m => m.id === modelId);
                              return (
                                <Label key={modelId} isCompact>
                                  {modelDetail ? `${modelDetail.name} (${modelDetail.provider})` : modelId}
                                </Label>
                              );
                            })}
                          </LabelGroup>
                        ) : (
                          'No models assigned'
                        )}
                      </Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Created</strong></Td>
                      <Td>{new Date(selectedApiKey.createdAt).toLocaleDateString()}</Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Last Used</strong></Td>
                      <Td>{selectedApiKey.lastUsed ? new Date(selectedApiKey.lastUsed).toLocaleDateString() : 'Never'}</Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Total Requests</strong></Td>
                      <Td>{selectedApiKey.usageCount.toLocaleString()}</Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Rate Limit</strong></Td>
                      <Td>{selectedApiKey.rateLimit.toLocaleString()} requests/minute</Td>
                    </Tr>
                    {selectedApiKey.expiresAt && (
                      <Tr>
                        <Td><strong>Expires</strong></Td>
                        <Td>{new Date(selectedApiKey.expiresAt).toLocaleDateString()}</Td>
                      </Tr>
                    )}
                    {selectedApiKey.description && (
                      <Tr>
                        <Td><strong>Description</strong></Td>
                        <Td>{selectedApiKey.description}</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </div>
              
              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>Usage Example</Content>
                <CodeBlock>
                  <CodeBlockCode>
{`# Using your secure LiteLLM API key
curl -X POST ${litellmApiUrl}/v1/chat/completions \
  -H "Authorization: Bearer ${selectedApiKey.fullKey || '<click-show-key-to-reveal>'}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "${selectedApiKey.models && selectedApiKey.models.length > 0 ? selectedApiKey.models[0] : 'gpt-4'}",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }'`}
                  </CodeBlockCode>
                </CodeBlock>
              </div>
              
              {selectedApiKey.status === 'revoked' && (
                <Alert variant="warning" title="Key Revoked" style={{ marginTop: '1rem' }}>
                  This API key has been revoked and can no longer be used.
                </Alert>
              )}
              
              {selectedApiKey.status === 'expired' && (
                <Alert variant="danger" title="Key Expired" style={{ marginTop: '1rem' }}>
                  This API key has expired on {selectedApiKey.expiresAt && new Date(selectedApiKey.expiresAt).toLocaleDateString()}.
                </Alert>
              )}
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button variant="link" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Generated Key Modal */}
      <Modal
        variant={ModalVariant.medium}
        title="API Key Created Successfully"
        isOpen={showGeneratedKey}
        onClose={() => setShowGeneratedKey(false)}
      >
        <ModalBody>
          {generatedKey && (
            <>
              <Alert variant="success" title="Success!" style={{ marginBottom: '1rem' }}>
                Your API key has been created successfully.
              </Alert>
              
<FormGroup label="Your new API key" fieldId="generated-key">
                <ClipboardCopy
                  hoverTip="Copy"
                  clickTip="Copied"
                  variant={ClipboardCopyVariant.expansion}
                  isReadOnly
                >
                  {generatedKey.fullKey}
                </ClipboardCopy>
              </FormGroup>
              
              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>Key Details</Content>
                <Table aria-label="Generated key details" variant="compact">
                  <Tbody>
                    <Tr>
                      <Td><strong>Name</strong></Td>
                      <Td>{generatedKey.name}</Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Models</strong></Td>
                      <Td>
                        {generatedKey.models && generatedKey.models.length > 0 ? (
                          <LabelGroup>
                            {generatedKey.models.map((modelId) => {
                              const modelDetail = generatedKey.modelDetails?.find(m => m.id === modelId);
                              return (
                                <Label key={modelId} isCompact>
                                  {modelDetail ? modelDetail.name : modelId}
                                </Label>
                              );
                            })}
                          </LabelGroup>
                        ) : (
                          'No models assigned'
                        )}
                      </Td>
                    </Tr>
                    <Tr>
                      <Td><strong>Rate Limit</strong></Td>
                      <Td>{generatedKey.rateLimit.toLocaleString()} requests/minute</Td>
                    </Tr>
                    {generatedKey.expiresAt && (
                      <Tr>
                        <Td><strong>Expires</strong></Td>
                        <Td>{new Date(generatedKey.expiresAt).toLocaleDateString()}</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </div>
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={() => setShowGeneratedKey(false)}>
              Close
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete API Key"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <ModalBody>
          {keyToDelete && (
            <>
              <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }} style={{ marginBottom: '1rem' }}>
                <FlexItem>
                  <ExclamationTriangleIcon color="var(--pf-v6-global--danger--color--100)" />
                </FlexItem>
                <FlexItem>
                  <Content component={ContentVariants.p}>
                    Are you sure you want to delete the API key <strong>{keyToDelete.name}</strong>?
                  </Content>
                </FlexItem>
              </Flex>
              
              <Alert variant="danger" title="Warning" style={{ marginBottom: '1rem' }}>
                This action cannot be undone. The API key will be permanently removed and applications using this key will lose access immediately.
              </Alert>
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button variant="danger" onClick={confirmDeleteKey}>
              Delete Key
            </Button>
            <Button variant="link" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ApiKeysPage;

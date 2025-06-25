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

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  fullKey?: string;
  status: 'active' | 'revoked' | 'expired';
  permissions: string[];
  usageCount: number;
  rateLimit: number;
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  description?: string;
}

const ApiKeysPage: React.FC = () => {
  const { } = useTranslation();
  const { addNotification } = useNotifications();
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Mock data - replace with actual API call
  useEffect(() => {
    const mockApiKeys: ApiKey[] = [
      {
        id: 'key-1',
        name: 'Production API Key',
        keyPreview: 'sk-...7x2K',
        fullKey: 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yzA7x2K',
        status: 'active',
        permissions: ['models:read', 'completions:create', 'usage:read'],
        usageCount: 15420,
        rateLimit: 5000,
        createdAt: '2024-06-01',
        lastUsed: '2024-06-23',
        description: 'Main production key for the web application'
      },
      {
        id: 'key-2',
        name: 'Development Key',
        keyPreview: 'sk-...9mN4',
        fullKey: 'sk-proj-dev789xyz012abc345def678ghi901jkl234mno567pqr890st9mN4',
        status: 'active',
        permissions: ['models:read', 'completions:create'],
        usageCount: 2341,
        rateLimit: 1000,
        createdAt: '2024-06-15',
        lastUsed: '2024-06-22',
        description: 'Development and testing purposes'
      },
      {
        id: 'key-3',
        name: 'Analytics Key',
        keyPreview: 'sk-...8pQ5',
        fullKey: 'sk-proj-analytics456def789ghi012jkl345mno678pqr901stu234vw8pQ5',
        status: 'revoked',
        permissions: ['usage:read', 'analytics:read'],
        usageCount: 892,
        rateLimit: 500,
        createdAt: '2024-05-20',
        lastUsed: '2024-06-10',
        description: 'Read-only access for analytics dashboard'
      },
      {
        id: 'key-4',
        name: 'Temporary Key',
        keyPreview: 'sk-...2rT8',
        fullKey: 'sk-proj-temp123abc456def789ghi012jkl345mno678pqr901stuv2rT8',
        status: 'expired',
        permissions: ['models:read'],
        usageCount: 45,
        rateLimit: 100,
        createdAt: '2024-06-01',
        lastUsed: '2024-06-07',
        expiresAt: '2024-06-07',
        description: 'Short-term key for third-party integration'
      }
    ];

    setTimeout(() => {
      setApiKeys(mockApiKeys);
      setLoading(false);
    }, 1000);
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

    setCreatingKey(true);
    
    // Simulate API call
    setTimeout(() => {
      const newKey: ApiKey = {
        id: `key-${Date.now()}`,
        name: newKeyName,
        keyPreview: `sk-...${Math.random().toString(36).slice(-4)}`,
        fullKey: `sk-proj-${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(-4)}`,
        status: 'active',
        permissions: newKeyPermissions,
        usageCount: 0,
        rateLimit: parseInt(newKeyRateLimit),
        createdAt: new Date().toISOString().split('T')[0],
        description: newKeyDescription || undefined,
        expiresAt: newKeyExpiration !== 'never' ? new Date(Date.now() + parseInt(newKeyExpiration) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined
      };
      
      setApiKeys([newKey, ...apiKeys]);
      setGeneratedKey(newKey);
      setShowGeneratedKey(true);
      setCreatingKey(false);
      setIsCreateModalOpen(false);
      
      addNotification({
        title: 'API Key Created',
        description: `${newKeyName} has been created successfully`,
        variant: 'success'
      });
    }, 2000);
  };

  const handleViewKey = (apiKey: ApiKey) => {
    setSelectedApiKey(apiKey);
    setIsViewModalOpen(true);
  };

  const handleRevokeKey = (apiKey: ApiKey) => {
    setKeyToDelete(apiKey);
    setIsDeleteModalOpen(true);
  };

  const confirmRevokeKey = () => {
    if (!keyToDelete) return;
    
    const updatedKeys = apiKeys.map(key => 
      key.id === keyToDelete.id ? { ...key, status: 'revoked' as const } : key
    );
    
    setApiKeys(updatedKeys);
    setIsDeleteModalOpen(false);
    setKeyToDelete(null);
    
    addNotification({
      title: 'API Key Revoked',
      description: `${keyToDelete.name} has been revoked`,
      variant: 'warning'
    });
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId);
    } else {
      newVisibleKeys.add(keyId);
    }
    setVisibleKeys(newVisibleKeys);
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
        {apiKeys.length === 0 ? (
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
                    <Th>Status</Th>
                    <Th>Usage</Th>
                    <Th>Rate Limit</Th>
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
                              {visibleKeys.has(apiKey.id) ? apiKey.fullKey : apiKey.keyPreview}
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
                        {getStatusBadge(apiKey.status)}
                      </Td>
                      <Td>
                        <Content component={ContentVariants.small}>
                          {apiKey.usageCount.toLocaleString()} requests
                        </Content>
                      </Td>
                      <Td>
                        <Content component={ContentVariants.small}>
                          {apiKey.rateLimit.toLocaleString()}/min
                        </Content>
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
                              onClick={() => handleRevokeKey(apiKey)}
                              isDisabled={apiKey.status !== 'active'}
                              icon={<TrashIcon />}
                            >
                              Revoke
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
          
          <Alert variant="info" title="Security Notice" style={{ marginTop: '1rem' }}>
            Make sure to copy your API key after creation. You won't be able to see it again for security reasons.
          </Alert>
          
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
                <ClipboardCopy
                  hoverTip="Copy"
                  clickTip="Copied"
                  variant={ClipboardCopyVariant.expansion}
                  isReadOnly
                >
                  {selectedApiKey.fullKey}
                </ClipboardCopy>
              </FormGroup>
              
              <div style={{ marginTop: '1rem' }}>
                <Content component={ContentVariants.h3}>Key Information</Content>
                <Table aria-label="Key details" variant="compact">
                  <Tbody>
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
{`curl -X POST https://api.litemaas.com/v1/completions \
  -H "Authorization: Bearer ${selectedApiKey.fullKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
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
              
              <Alert variant="warning" title="Important!" style={{ marginBottom: '1rem' }}>
                Copy your API key now. You won't be able to see it again for security reasons.
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
              I've Copied the Key
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Revoke API Key"
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <ModalBody>
          {keyToDelete && (
            <>
              <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }} style={{ marginBottom: '1rem' }}>
                <FlexItem>
                  <ExclamationTriangleIcon color="var(--pf-v6-global--warning--color--100)" />
                </FlexItem>
                <FlexItem>
                  <Content component={ContentVariants.p}>
                    Are you sure you want to revoke the API key <strong>{keyToDelete.name}</strong>?
                  </Content>
                </FlexItem>
              </Flex>
              
              <Alert variant="warning" title="Warning" style={{ marginBottom: '1rem' }}>
                This action cannot be undone. Applications using this key will lose access immediately.
              </Alert>
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button variant="danger" onClick={confirmRevokeKey}>
              Revoke Key
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

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  PageSection,
  Title,
  Button,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  Alert,
  Bullseye,
  Form,
  FormGroup,
  TextInput,
  NumberInput,
  Checkbox,
  ActionGroup,
} from '@patternfly/react-core';
import {
  CubesIcon,
  PlusCircleIcon,
  EditIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td, ActionsColumn } from '@patternfly/react-table';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { adminModelsService } from '../services/adminModels.service';
import { modelsService } from '../services/models.service';
import type {
  AdminModelFormData,
  AdminModelFormErrors,
  LiteLLMModelDisplay,
  AdminModelError,
} from '../types/admin';

const AdminModelsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // State management
  const [selectedModel, setSelectedModel] = useState<LiteLLMModelDisplay | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AdminModelFormData>({
    model_name: '',
    api_base: '',
    input_cost_per_token: 0,
    output_cost_per_token: 0,
    tpm: 1000,
    rpm: 100,
    max_tokens: 4000,
    supports_vision: false,
  });
  const [formErrors, setFormErrors] = useState<AdminModelFormErrors>({});

  // Modal focus management refs
  const createModalTriggerRef = useRef<HTMLElement | null>(null);
  const editModalTriggerRef = useRef<HTMLElement | null>(null);
  const deleteModalTriggerRef = useRef<HTMLElement | null>(null);

  // Check permissions
  const canModifyModels = currentUser?.roles?.includes('admin') || false;
  const canReadModels = currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('adminReadonly') || false;

  // Fetch models data
  const {
    data: modelsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery(['admin-models'], () => modelsService.getModels(), {
    enabled: canReadModels,
    onError: (err: any) => {
      console.error('Failed to load models:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to load models';
      addNotification({
        title: 'Error Loading Models',
        description: errorMessage,
        variant: 'danger',
      });
    },
  });

  // Create model mutation
  const createModelMutation = useMutation(adminModelsService.createModel, {
    onSuccess: (response) => {
      addNotification({
        title: 'Model Created',
        description: response.message,
        variant: 'success',
      });
      queryClient.invalidateQueries(['admin-models']);
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: AdminModelError) => {
      addNotification({
        title: 'Create Model Failed',
        description: error.message,
        variant: 'danger',
      });
    },
  });

  // Update model mutation
  const updateModelMutation = useMutation(
    ({ id, data }: { id: string; data: AdminModelFormData }) =>
      adminModelsService.updateModel(id, data),
    {
      onSuccess: (response) => {
        addNotification({
          title: 'Model Updated',
          description: response.message,
          variant: 'success',
        });
        queryClient.invalidateQueries(['admin-models']);
        setIsEditModalOpen(false);
        resetForm();
      },
      onError: (error: AdminModelError) => {
        addNotification({
          title: 'Update Model Failed',
          description: error.message,
          variant: 'danger',
        });
      },
    }
  );

  // Delete model mutation
  const deleteModelMutation = useMutation(adminModelsService.deleteModel, {
    onSuccess: (response) => {
      addNotification({
        title: 'Model Deleted',
        description: response.message,
        variant: 'success',
      });
      queryClient.invalidateQueries(['admin-models']);
      setIsDeleteModalOpen(false);
      setSelectedModel(null);
    },
    onError: (error: AdminModelError) => {
      addNotification({
        title: 'Delete Model Failed',
        description: error.message,
        variant: 'danger',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      model_name: '',
      api_base: '',
      input_cost_per_token: 0,
      output_cost_per_token: 0,
      tpm: 1000,
      rpm: 100,
      max_tokens: 4000,
      supports_vision: false,
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: AdminModelFormErrors = {};

    if (!formData.model_name.trim()) {
      errors.model_name = 'Model name is required';
    }

    if (!formData.api_base.trim()) {
      errors.api_base = 'API base URL is required';
    } else {
      try {
        new URL(formData.api_base);
      } catch {
        errors.api_base = 'Please enter a valid URL';
      }
    }

    if (formData.input_cost_per_token < 0) {
      errors.input_cost_per_token = 'Input cost must be non-negative';
    }

    if (formData.output_cost_per_token < 0) {
      errors.output_cost_per_token = 'Output cost must be non-negative';
    }

    if (formData.tpm < 1) {
      errors.tpm = 'TPM must be at least 1';
    }

    if (formData.rpm < 1) {
      errors.rpm = 'RPM must be at least 1';
    }

    if (formData.max_tokens < 1) {
      errors.max_tokens = 'Max tokens must be at least 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateModel = () => {
    setSelectedModel(null);
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEditModel = (model: LiteLLMModelDisplay) => {
    setSelectedModel(model);
    setFormData({
      model_name: model.model_name,
      api_base: model.api_base || '',
      input_cost_per_token: model.input_cost_per_token || 0,
      output_cost_per_token: model.output_cost_per_token || 0,
      tpm: model.tpm || 1000,
      rpm: model.rpm || 100,
      max_tokens: model.max_tokens || 4000,
      supports_vision: model.supports_vision || false,
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleDeleteModel = (model: LiteLLMModelDisplay) => {
    setSelectedModel(model);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    if (isCreateModalOpen) {
      createModelMutation.mutate(formData);
    } else if (isEditModalOpen && selectedModel) {
      updateModelMutation.mutate({ id: selectedModel.id, data: formData });
    }
  };

  const handleConfirmDelete = () => {
    if (selectedModel) {
      deleteModelMutation.mutate(selectedModel.id);
    }
  };

  // Render permission check
  if (!canReadModels) {
    return (
      <PageSection>
        <EmptyState variant={EmptyStateVariant.lg}>
          <EmptyStateBody>
            You don't have permission to view model management.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <PageSection>
        <Bullseye>
          <Spinner size="lg" aria-label="Loading models" />
        </Bullseye>
      </PageSection>
    );
  }

  // Error state
  if (error) {
    return (
      <PageSection>
        <Alert variant="danger" title="Error loading models">
          {error instanceof Error ? error.message : 'An unknown error occurred'}
        </Alert>
      </PageSection>
    );
  }

  const models = modelsResponse?.data || [];

  return (
    <PageSection>
      {/* Page Header */}
      <div className="pf-v6-u-pb-lg">
        <div className="pf-v6-u-display-flex pf-v6-u-justify-content-space-between pf-v6-u-align-items-center">
          <div>
            <Title headingLevel="h1" size="2xl">
              <CubesIcon className="pf-v6-u-mr-sm" />
              Model Management
            </Title>
            <p className="pf-v6-u-color-200 pf-v6-u-mt-sm">
              Create, edit, and manage AI models in LiteLLM
            </p>
          </div>
          {canModifyModels && (
            <Button
              variant="primary"
              icon={<PlusCircleIcon />}
              onClick={handleCreateModel}
            >
              Create Model
            </Button>
          )}
        </div>
      </div>

      {/* Models Table */}
      {models.length === 0 ? (
        <EmptyState variant={EmptyStateVariant.lg}>
          <CubesIcon className="pf-v6-u-mb-lg" />
          <EmptyStateBody>
            No models found. {canModifyModels && 'Create your first model to get started.'}
          </EmptyStateBody>
          {canModifyModels && (
            <EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateModel}>
                Create Model
              </Button>
            </EmptyStateActions>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Models table">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Provider</Th>
              <Th>API Base</Th>
              <Th>TPM</Th>
              <Th>RPM</Th>
              <Th>Input Cost</Th>
              <Th>Output Cost</Th>
              <Th>Max Tokens</Th>
              <Th>Vision Support</Th>
              {canModifyModels && <Th>Actions</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {models.map((model) => (
              <Tr key={model.id}>
                <Td>{model.name}</Td>
                <Td>{model.provider}</Td>
                <Td>{model.api_base || 'N/A'}</Td>
                <Td>{model.tpm?.toLocaleString() || 'N/A'}</Td>
                <Td>{model.rpm?.toLocaleString() || 'N/A'}</Td>
                <Td>{model.input_cost_per_token || 'N/A'}</Td>
                <Td>{model.output_cost_per_token || 'N/A'}</Td>
                <Td>{model.max_tokens?.toLocaleString() || 'N/A'}</Td>
                <Td>{model.supports_vision ? 'Yes' : 'No'}</Td>
                {canModifyModels && (
                  <Td>
                    <ActionsColumn
                      items={[
                        {
                          title: 'Edit',
                          icon: <EditIcon />,
                          onClick: () => handleEditModel(model),
                        },
                        {
                          title: 'Delete',
                          icon: <TrashIcon />,
                          onClick: () => handleDeleteModel(model),
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

      {/* Create/Edit Model Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={isCreateModalOpen ? 'Create Model' : 'Edit Model'}
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          resetForm();
        }}
      >
        <ModalHeader />
        <ModalBody>
          <Form>
            <FormGroup
              label="Model Name"
              isRequired
              fieldId="model-name"
              helperTextInvalid={formErrors.model_name}
              validated={formErrors.model_name ? 'error' : 'default'}
            >
              <TextInput
                id="model-name"
                value={formData.model_name}
                onChange={(_event, value) => setFormData({ ...formData, model_name: value })}
                validated={formErrors.model_name ? 'error' : 'default'}
              />
            </FormGroup>

            <FormGroup
              label="API Base URL"
              isRequired
              fieldId="api-base"
              helperTextInvalid={formErrors.api_base}
              validated={formErrors.api_base ? 'error' : 'default'}
            >
              <TextInput
                id="api-base"
                value={formData.api_base}
                onChange={(_event, value) => setFormData({ ...formData, api_base: value })}
                validated={formErrors.api_base ? 'error' : 'default'}
                placeholder="https://api.example.com/v1"
              />
            </FormGroup>

            <FormGroup
              label="Input Cost per Token"
              fieldId="input-cost"
              helperTextInvalid={formErrors.input_cost_per_token}
              validated={formErrors.input_cost_per_token ? 'error' : 'default'}
            >
              <NumberInput
                id="input-cost"
                value={formData.input_cost_per_token}
                onChange={(event) => {
                  const value = parseFloat((event.target as HTMLInputElement).value) || 0;
                  setFormData({ ...formData, input_cost_per_token: value });
                }}
                min={0}
                step={0.000001}
              />
            </FormGroup>

            <FormGroup
              label="Output Cost per Token"
              fieldId="output-cost"
              helperTextInvalid={formErrors.output_cost_per_token}
              validated={formErrors.output_cost_per_token ? 'error' : 'default'}
            >
              <NumberInput
                id="output-cost"
                value={formData.output_cost_per_token}
                onChange={(event) => {
                  const value = parseFloat((event.target as HTMLInputElement).value) || 0;
                  setFormData({ ...formData, output_cost_per_token: value });
                }}
                min={0}
                step={0.000001}
              />
            </FormGroup>

            <FormGroup
              label="TPM (Tokens per Minute)"
              fieldId="tpm"
              helperTextInvalid={formErrors.tpm}
              validated={formErrors.tpm ? 'error' : 'default'}
            >
              <NumberInput
                id="tpm"
                value={formData.tpm}
                onChange={(event) => {
                  const value = parseInt((event.target as HTMLInputElement).value) || 1;
                  setFormData({ ...formData, tpm: value });
                }}
                min={1}
              />
            </FormGroup>

            <FormGroup
              label="RPM (Requests per Minute)"
              fieldId="rpm"
              helperTextInvalid={formErrors.rpm}
              validated={formErrors.rpm ? 'error' : 'default'}
            >
              <NumberInput
                id="rpm"
                value={formData.rpm}
                onChange={(event) => {
                  const value = parseInt((event.target as HTMLInputElement).value) || 1;
                  setFormData({ ...formData, rpm: value });
                }}
                min={1}
              />
            </FormGroup>

            <FormGroup
              label="Max Tokens"
              fieldId="max-tokens"
              helperTextInvalid={formErrors.max_tokens}
              validated={formErrors.max_tokens ? 'error' : 'default'}
            >
              <NumberInput
                id="max-tokens"
                value={formData.max_tokens}
                onChange={(event) => {
                  const value = parseInt((event.target as HTMLInputElement).value) || 1;
                  setFormData({ ...formData, max_tokens: value });
                }}
                min={1}
              />
            </FormGroup>

            <FormGroup label="Features" fieldId="supports-vision">
              <Checkbox
                id="supports-vision"
                label="Supports Vision"
                isChecked={formData.supports_vision}
                onChange={(_event, checked) =>
                  setFormData({ ...formData, supports_vision: checked })
                }
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <ActionGroup>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={createModelMutation.isLoading || updateModelMutation.isLoading}
            >
              {isCreateModalOpen ? 'Create' : 'Update'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </ActionGroup>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Delete Model"
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedModel(null);
        }}
      >
        <ModalHeader />
        <ModalBody>
          {selectedModel && (
            <div>
              <p>Are you sure you want to delete the model <strong>{selectedModel.model_name}</strong>?</p>
              <p className="pf-v6-u-color-200 pf-v6-u-mt-sm">
                This action cannot be undone and will remove the model from LiteLLM.
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            isLoading={deleteModelMutation.isLoading}
          >
            Delete
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setSelectedModel(null);
            }}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </PageSection>
  );
};

export default AdminModelsPage;
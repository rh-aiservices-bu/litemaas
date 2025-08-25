import {
  Alert,
  Bullseye,
  Button,
  Checkbox,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateVariant,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  NumberInput,
  PageSection,
  Spinner,
  Stack,
  TextInput,
  Title,
} from '@patternfly/react-core';
import {
  CubesIcon,
  EditIcon,
  ExclamationTriangleIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { adminModelsService } from '../services/adminModels.service';
import { Model, modelsService } from '../services/models.service';
import type { AdminModelError, AdminModelFormData, AdminModelFormErrors } from '../types/admin';
import { getModelFlairs } from '../utils/flairColors';

const AdminModelsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // State management
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AdminModelFormData>({
    model_name: '',
    backend_model_name: '',
    description: '',
    api_base: '',
    api_key: '',
    input_cost_per_token: 0,
    output_cost_per_token: 0,
    tpm: 1000,
    rpm: 100,
    max_tokens: 4000,
    supports_vision: false,
    supports_function_calling: false,
    supports_parallel_function_calling: false,
    supports_tool_choice: false,
  });
  const [formErrors, setFormErrors] = useState<AdminModelFormErrors>({});

  // Display state for cost inputs (per million tokens for better UX)
  const [displayInputCost, setDisplayInputCost] = useState<number>(0);
  const [displayOutputCost, setDisplayOutputCost] = useState<number>(0);

  // Expandable rows state for API Base column
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Check permissions
  const canModifyModels = currentUser?.roles?.includes('admin') || false;
  const canReadModels =
    currentUser?.roles?.includes('admin') || currentUser?.roles?.includes('adminReadonly') || false;

  // Fetch models data
  const {
    data: modelsResponse,
    isLoading,
    error,
  } = useQuery(['admin-models'], () => modelsService.getModels(), {
    enabled: canReadModels,
    onError: (err: any) => {
      console.error(t('models.admin.failedToLoadModels') + ': ', err);
      const errorMessage =
        err?.response?.data?.message || err?.message || t('models.admin.failedToLoadModels');
      addNotification({
        title: t('models.admin.errorLoadingModels'),
        description: errorMessage,
        variant: 'danger',
      });
    },
  });

  // Create model mutation
  const createModelMutation = useMutation(
    (modelData: AdminModelFormData) => adminModelsService.createModel(modelData),
    {
      onSuccess: async (response) => {
        addNotification({
          title: t('models.admin.modelCreated'),
          description: response?.message || t('models.admin.modelCreatedSuccessfully'),
          variant: 'success',
        });

        // Sync models with LiteLLM to ensure consistency
        try {
          await modelsService.refreshModels();
        } catch (syncError) {
          console.warn('Model sync after creation failed:', syncError);
        }

        // Force refetch of models data to show updated list
        await queryClient.refetchQueries(['admin-models']);
        setIsCreateModalOpen(false);
        resetForm();
      },
      onError: (error: AdminModelError) => {
        addNotification({
          title: t('models.admin.createModelFailed'),
          description: error.message,
          variant: 'danger',
        });
      },
    },
  );

  // Update model mutation
  const updateModelMutation = useMutation(
    ({ id, data }: { id: string; data: AdminModelFormData }) =>
      adminModelsService.updateModel(id, data),
    {
      onSuccess: async (response) => {
        addNotification({
          title: t('models.admin.modelUpdated'),
          description: response?.message || t('models.admin.modelUpdatedSuccessfully'),
          variant: 'success',
        });

        // Sync models with LiteLLM to ensure consistency
        try {
          await modelsService.refreshModels();
        } catch (syncError) {
          console.warn('Model sync after update failed:', syncError);
        }

        // Force refetch of models data to show updated list
        await queryClient.refetchQueries(['admin-models']);
        setIsEditModalOpen(false);
        resetForm();
      },
      onError: (error: AdminModelError) => {
        addNotification({
          title: t('models.admin.updateModelFailed'),
          description: error.message,
          variant: 'danger',
        });
      },
    },
  );

  // Delete model mutation
  const deleteModelMutation = useMutation(
    (modelId: string) => adminModelsService.deleteModel(modelId),
    {
      onSuccess: async (response) => {
        addNotification({
          title: t('models.admin.modelDeleted'),
          description: response?.message || t('models.admin.modelDeletedSuccessfully'),
          variant: 'success',
        });

        // Sync models with LiteLLM to ensure consistency
        try {
          await modelsService.refreshModels();
        } catch (syncError) {
          console.warn('Model sync after deletion failed:', syncError);
        }

        // Force refetch of models data to show updated list
        await queryClient.refetchQueries(['admin-models']);
        setIsDeleteModalOpen(false);
        setSelectedModel(null);
      },
      onError: (error: AdminModelError) => {
        addNotification({
          title: t('models.admin.deleteModelFailed'),
          description: error.message,
          variant: 'danger',
        });
      },
    },
  );

  const resetForm = () => {
    setFormData({
      model_name: '',
      backend_model_name: '',
      description: '',
      api_base: '',
      api_key: '',
      input_cost_per_token: 0,
      output_cost_per_token: 0,
      tpm: 1000000,
      rpm: 100000,
      max_tokens: 5000,
      supports_vision: false,
      supports_function_calling: false,
      supports_parallel_function_calling: false,
      supports_tool_choice: false,
    });
    setDisplayInputCost(0);
    setDisplayOutputCost(0);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: AdminModelFormErrors = {};

    if (!formData.model_name.trim()) {
      errors.model_name = t('models.admin.modelNameIsRequired');
    } else if (
      formData.model_name !== formData.model_name.trim() ||
      formData.model_name.includes(' ')
    ) {
      errors.model_name = t('models.admin.modelNameCannotContainSpaces');
    }

    if (!formData.backend_model_name.trim()) {
      errors.backend_model_name = t('models.admin.backendModelNameIsRequired');
    }

    if (!formData.api_base.trim()) {
      errors.api_base = t('models.admin.apiBaseUrlIsRequired');
    } else {
      try {
        new URL(formData.api_base);
      } catch {
        errors.api_base = t('models.admin.pleaseEnterAValidUrl');
      }
    }

    if (displayInputCost < 0) {
      errors.input_cost_per_token = t('models.admin.inputCostCannotBeNegative');
    }

    if (displayOutputCost < 0) {
      errors.output_cost_per_token = t('models.admin.outputCostCannotBeNegative');
    }

    if (formData.tpm < 1) {
      errors.tpm = t('models.admin.tpmMustBeAtLeast_1');
    }

    if (formData.rpm < 1) {
      errors.rpm = t('models.admin.rpmMustBeAtLeast_1');
    }

    if (formData.max_tokens < 1) {
      errors.max_tokens = t('models.admin.maxTokensMustBeAtLeast_1');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateModel = () => {
    setSelectedModel(null);
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEditModel = (model: any) => {
    setSelectedModel(model);

    // Convert per-token costs to per-million for display
    const inputCostPerMillion = (model.inputCostPerToken || 0) * 1000000;
    const outputCostPerMillion = (model.outputCostPerToken || 0) * 1000000;

    setFormData({
      model_name: model.name,
      backend_model_name: model.backendModelName || '', // Use empty string if not set
      description: model.description || '',
      api_base: model.apiBase || '',
      api_key: '', // Never populate from existing model for security
      input_cost_per_token: model.inputCostPerToken || 0,
      output_cost_per_token: model.outputCostPerToken || 0,
      tpm: model.tpm || 1000,
      rpm: model.rpm || 100,
      max_tokens: model.maxTokens || 4000,
      supports_vision: model.supportsVision || false,
      supports_function_calling: model.supportsFunctionCalling || false,
      supports_parallel_function_calling: model.supportsParallelFunctionCalling || false,
      supports_tool_choice: model.supportsToolChoice || false,
    });

    // Set display values for cost inputs
    setDisplayInputCost(inputCostPerMillion);
    setDisplayOutputCost(outputCostPerMillion);

    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleDeleteModel = (model: any) => {
    setSelectedModel(model);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    // Prepare payload, only include api_key if it's provided
    const payload: Partial<AdminModelFormData> = { ...formData };
    if (!payload.api_key?.trim()) {
      // Remove empty api_key to avoid sending it to backend
      delete payload.api_key;
    }

    if (isCreateModalOpen) {
      createModelMutation.mutate(payload as AdminModelFormData);
    } else if (isEditModalOpen && selectedModel) {
      updateModelMutation.mutate({ id: selectedModel.id, data: payload as AdminModelFormData });
    }
  };

  const handleConfirmDelete = () => {
    if (selectedModel) {
      deleteModelMutation.mutate(selectedModel.id);
    }
  };

  const toggleRowExpansion = (modelId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(modelId)) {
      newExpanded.delete(modelId);
    } else {
      newExpanded.add(modelId);
    }
    setExpandedRows(newExpanded);
  };

  // Permission check
  if (!canReadModels) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('nav.admin.models')}
          </Title>
        </PageSection>
        <PageSection>
          <EmptyState variant={EmptyStateVariant.lg} role="alert">
            <ExclamationTriangleIcon />
            <Title headingLevel="h2" size="lg">
              {t('models.permissions.accessDenied')}
            </Title>
            <EmptyStateBody>{t('models.permissions.noPermission')}</EmptyStateBody>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('nav.admin.models')}
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                {t('models.loading.title')}
              </Title>
              <EmptyStateBody>{t('models.loading.description')}</EmptyStateBody>
            </EmptyState>
          </Bullseye>
        </PageSection>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <PageSection>
        <Alert variant="danger" title={t('models.admin.errorLoadingModels')}>
          {error instanceof Error ? error.message : t('common.anUnknownErrorOccurred')}
        </Alert>
      </PageSection>
    );
  }

  const models = modelsResponse?.models || [];

  return (
    <>
      <PageSection variant="secondary">
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          <FlexItem>
            <Title headingLevel="h1" size="2xl">
              {t('models.admin.title')}
            </Title>
            <Content component={ContentVariants.p}>
              {t('models.admin.messages.managementDescription')}
            </Content>
          </FlexItem>
          {canModifyModels && (
            <FlexItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateModel}>
                {t('models.admin.createModel')}
              </Button>
            </FlexItem>
          )}
        </Flex>
      </PageSection>
      <PageSection>
        {/* Models Table */}
        {models.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <CubesIcon className="pf-v6-u-mb-lg" />
            <EmptyStateBody>
              {t('models.admin.noModelsFound')}{' '}
              {canModifyModels && t('models.admin.createYourFirstModelToGetStarted')}
            </EmptyStateBody>
            {canModifyModels && (
              <EmptyStateActions>
                <Button variant="primary" icon={<PlusCircleIcon />} onClick={handleCreateModel}>
                  {t('models.admin.createModel')}
                </Button>
              </EmptyStateActions>
            )}
          </EmptyState>
        ) : (
          <Table aria-label={t('models.admin.modelsTable')} variant="compact" isStickyHeader>
            <Thead>
              <Tr>
                <Th width={20} modifier="truncate">
                  {t('models.admin.table.name')}
                </Th>
                <Th width={25} modifier="truncate">
                  {t('models.admin.table.apiBase')}
                </Th>
                <Th>{t('models.admin.table.tpm')}</Th>
                <Th>{t('models.admin.table.rpm')}</Th>
                <Th>
                  <div>
                    {t('models.admin.table.inputCost')}
                    <br />
                    <small style={{ fontSize: '0.875rem', fontWeight: 'normal' }}>
                      {t('models.admin.table.1mTokens')}
                    </small>
                  </div>
                </Th>
                <Th>
                  <div>
                    {t('models.admin.table.outputCost')}
                    <br />
                    <small style={{ fontSize: '0.875rem', fontWeight: 'normal' }}>
                      {t('models.admin.table.1mTokens')}
                    </small>
                  </div>
                </Th>
                <Th width={10}>{t('models.admin.table.maxTokens')}</Th>
                <Th>{t('common.features')}</Th>
                {canModifyModels && <Th>{t('models.admin.table.actions')}</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {models.map((model) => (
                <Tr key={model.id}>
                  <Td>{model.name}</Td>
                  <Td>
                    {model.apiBase ? (
                      expandedRows.has(model.id) ? (
                        <div>
                          {model.apiBase}
                          <br />
                          <Button
                            variant="link"
                            isInline
                            onClick={() => toggleRowExpansion(model.id)}
                          >
                            {t('models.admin.table.showLess')}
                          </Button>
                        </div>
                      ) : (
                        <div>
                          {model.apiBase.length > 40 ? (
                            <>
                              {model.apiBase.substring(0, 40)}...
                              <br />
                              <Button
                                variant="link"
                                isInline
                                onClick={() => toggleRowExpansion(model.id)}
                              >
                                {t('models.admin.table.showMore')}
                              </Button>
                            </>
                          ) : (
                            model.apiBase
                          )}
                        </div>
                      )
                    ) : (
                      <>{t('models.admin.table.nA')}</>
                    )}
                  </Td>
                  <Td>{model.tpm?.toLocaleString() || t('models.admin.table.nA')}</Td>
                  <Td>{model.rpm?.toLocaleString() || t('models.admin.table.nA')}</Td>
                  <Td>
                    {model.inputCostPerToken
                      ? `$${(model.inputCostPerToken * 1000000).toFixed(2)}`
                      : t('models.admin.table.nA')}
                  </Td>
                  <Td>
                    {model.outputCostPerToken
                      ? `$${(model.outputCostPerToken * 1000000).toFixed(2)}`
                      : t('models.admin.table.nA')}
                  </Td>
                  <Td>{model.maxTokens?.toLocaleString() || t('models.admin.table.nA')}</Td>
                  <Td>
                    <Flex spaceItems={{ default: 'spaceItemsXs' }} flexWrap={{ default: 'wrap' }}>
                      {getModelFlairs(model).map(({ key, label, color }) => (
                        <FlexItem key={key}>
                          <Label color={color}>{label}</Label>
                        </FlexItem>
                      ))}

                      {getModelFlairs(model).length === 0 && (
                        <FlexItem>
                          <Label color="grey">{t('common.none')}</Label>
                        </FlexItem>
                      )}
                    </Flex>
                  </Td>
                  {canModifyModels && (
                    <Td>
                      <ActionsColumn
                        items={[
                          {
                            title: t('models.admin.table.edit'),
                            icon: <EditIcon />,
                            onClick: () => handleEditModel(model),
                          },
                          {
                            title: t('models.admin.table.delete'),
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
          title={isCreateModalOpen ? t('models.admin.createModel') : t('models.admin.editModel')}
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
              <Grid hasGutter>
                <GridItem span={12}>
                  <FormGroup label={t('models.admin.modelName')} isRequired fieldId="model-name">
                    <TextInput
                      id="model-name"
                      value={formData.model_name}
                      onChange={(_event, value) => setFormData({ ...formData, model_name: value })}
                      validated={formErrors.model_name ? 'error' : 'default'}
                    />
                    {formErrors.model_name && (
                      <HelperText>
                        <HelperTextItem variant="error">{formErrors.model_name}</HelperTextItem>
                      </HelperText>
                    )}
                  </FormGroup>
                </GridItem>
                <GridItem span={12}>
                  <FormGroup label={t('models.admin.modelDescription')} fieldId="description">
                    <TextInput
                      id="description"
                      value={formData.description}
                      onChange={(_event, value) => setFormData({ ...formData, description: value })}
                      validated={formErrors.description ? 'error' : 'default'}
                      placeholder={t('models.admin.enterADescriptionForThisModel')}
                    />
                  </FormGroup>
                </GridItem>
                <GridItem span={12}>
                  <FormGroup label={t('models.admin.apiBaseUrl')} isRequired fieldId="api-base">
                    <TextInput
                      id="api-base"
                      value={formData.api_base}
                      onChange={(_event, value) => setFormData({ ...formData, api_base: value })}
                      validated={formErrors.api_base ? 'error' : 'default'}
                      placeholder={t('models.admin.httpsApiExampleComV1')}
                    />
                    {formErrors.api_base && (
                      <HelperText>
                        <HelperTextItem variant="error">{formErrors.api_base}</HelperTextItem>
                      </HelperText>
                    )}
                  </FormGroup>
                </GridItem>
                <GridItem span={12}>
                  <FormGroup
                    label={t('models.admin.backendModelName')}
                    isRequired
                    fieldId="backend-model-name"
                  >
                    <TextInput
                      id="backend-model-name"
                      value={formData.backend_model_name}
                      onChange={(_event, value) =>
                        setFormData({ ...formData, backend_model_name: value })
                      }
                      validated={formErrors.backend_model_name ? 'error' : 'default'}
                      placeholder={t('models.admin.enterBackendModelName')}
                    />
                    {formErrors.backend_model_name && (
                      <HelperText>
                        <HelperTextItem variant="error">
                          {formErrors.backend_model_name}
                        </HelperTextItem>
                      </HelperText>
                    )}
                  </FormGroup>
                </GridItem>
                <GridItem span={12}>
                  <FormGroup label={t('models.admin.apiKeyOptional')} fieldId="api-key">
                    <TextInput
                      id="api-key"
                      type="password"
                      value={formData.api_key}
                      onChange={(_event, value) => setFormData({ ...formData, api_key: value })}
                      validated={formErrors.api_key ? 'error' : 'default'}
                      placeholder={t('models.admin.enterApiKeyForThisEndpointOptional')}
                    />
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup
                    label={t('models.admin.inputCostPerMillionTokens')}
                    fieldId="input-cost"
                  >
                    <NumberInput
                      id="input-cost"
                      value={displayInputCost}
                      onChange={(event) => {
                        const value = parseFloat((event.target as HTMLInputElement).value) || 0;
                        setDisplayInputCost(value);
                        setFormData({ ...formData, input_cost_per_token: value / 1000000 });
                      }}
                      onPlus={() => {
                        const newValue = Math.round((displayInputCost + 0.01) * 10000) / 10000;
                        setDisplayInputCost(newValue);
                        setFormData({ ...formData, input_cost_per_token: newValue / 1000000 });
                      }}
                      onMinus={() => {
                        const newValue =
                          Math.round(Math.max(0, displayInputCost - 0.01) * 10000) / 10000;
                        setDisplayInputCost(newValue);
                        setFormData({ ...formData, input_cost_per_token: newValue / 1000000 });
                      }}
                      min={0}
                      step={0.01}
                      validated={formErrors.input_cost_per_token ? 'error' : 'default'}
                    />
                    {formErrors.input_cost_per_token && (
                      <HelperText>
                        <HelperTextItem variant="error">
                          {formErrors.input_cost_per_token}
                        </HelperTextItem>
                      </HelperText>
                    )}
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup
                    label={t('models.admin.outputCostPerMillionTokens')}
                    fieldId="output-cost"
                  >
                    <NumberInput
                      id="output-cost"
                      value={displayOutputCost}
                      onChange={(event) => {
                        const value = parseFloat((event.target as HTMLInputElement).value) || 0;
                        setDisplayOutputCost(value);
                        setFormData({ ...formData, output_cost_per_token: value / 1000000 });
                      }}
                      onPlus={() => {
                        const newValue = Math.round((displayOutputCost + 0.01) * 10000) / 10000;
                        setDisplayOutputCost(newValue);
                        setFormData({ ...formData, output_cost_per_token: newValue / 1000000 });
                      }}
                      onMinus={() => {
                        const newValue =
                          Math.round(Math.max(0, displayOutputCost - 0.01) * 10000) / 10000;
                        setDisplayOutputCost(newValue);
                        setFormData({ ...formData, output_cost_per_token: newValue / 1000000 });
                      }}
                      min={0}
                      step={0.01}
                      validated={formErrors.output_cost_per_token ? 'error' : 'default'}
                    />
                    {formErrors.output_cost_per_token && (
                      <HelperText>
                        <HelperTextItem variant="error">
                          {formErrors.output_cost_per_token}
                        </HelperTextItem>
                      </HelperText>
                    )}
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup label={t('models.admin.tpmTokensPerMinute')} fieldId="tpm">
                    <NumberInput
                      id="tpm"
                      value={formData.tpm}
                      onChange={(event) => {
                        const value = parseInt((event.target as HTMLInputElement).value) || 1;
                        setFormData({ ...formData, tpm: value });
                      }}
                      onPlus={() => {
                        setFormData({ ...formData, tpm: formData.tpm + 1 });
                      }}
                      onMinus={() => {
                        setFormData({ ...formData, tpm: Math.max(1, formData.tpm - 1) });
                      }}
                      min={1}
                      validated={formErrors.tpm ? 'error' : 'default'}
                    />
                    {formErrors.tpm && (
                      <HelperText>
                        <HelperTextItem variant="error">{formErrors.tpm}</HelperTextItem>
                      </HelperText>
                    )}
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup label={t('models.admin.rpmRequestsPerMinute')} fieldId="rpm">
                    <NumberInput
                      id="rpm"
                      value={formData.rpm}
                      onChange={(event) => {
                        const value = parseInt((event.target as HTMLInputElement).value) || 1;
                        setFormData({ ...formData, rpm: value });
                      }}
                      onPlus={() => {
                        setFormData({ ...formData, rpm: formData.rpm + 1 });
                      }}
                      onMinus={() => {
                        setFormData({ ...formData, rpm: Math.max(1, formData.rpm - 1) });
                      }}
                      min={1}
                      validated={formErrors.rpm ? 'error' : 'default'}
                    />
                    {formErrors.rpm && (
                      <HelperText>
                        <HelperTextItem variant="error">{formErrors.rpm}</HelperTextItem>
                      </HelperText>
                    )}
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup label={t('models.admin.maxTokens')} fieldId="max-tokens">
                    <NumberInput
                      id="max-tokens"
                      value={formData.max_tokens}
                      onChange={(event) => {
                        const value = parseInt((event.target as HTMLInputElement).value) || 1;
                        setFormData({ ...formData, max_tokens: value });
                      }}
                      onPlus={() => {
                        setFormData({ ...formData, max_tokens: formData.max_tokens + 1 });
                      }}
                      onMinus={() => {
                        setFormData({
                          ...formData,
                          max_tokens: Math.max(1, formData.max_tokens - 1),
                        });
                      }}
                      min={1}
                      validated={formErrors.max_tokens ? 'error' : 'default'}
                    />
                    {formErrors.max_tokens && (
                      <HelperText>
                        <HelperTextItem variant="error">{formErrors.max_tokens}</HelperTextItem>
                      </HelperText>
                    )}
                  </FormGroup>
                </GridItem>
                <GridItem span={12}>
                  <FormGroup label={t('common.features')} fieldId="features">
                    <Stack hasGutter>
                      <Checkbox
                        id="supports-vision"
                        label={t('models.admin.supportsVision')}
                        isChecked={formData.supports_vision}
                        onChange={(_event, checked) =>
                          setFormData({ ...formData, supports_vision: checked })
                        }
                      />
                      <Checkbox
                        id="supports-function-calling"
                        label={t('models.admin.supportsFunctionCalling')}
                        isChecked={formData.supports_function_calling}
                        onChange={(_event, checked) =>
                          setFormData({ ...formData, supports_function_calling: checked })
                        }
                      />
                      <Checkbox
                        id="supports-parallel-function-calling"
                        label={t('models.admin.supportsParallelFunctionCalling')}
                        isChecked={formData.supports_parallel_function_calling}
                        onChange={(_event, checked) =>
                          setFormData({ ...formData, supports_parallel_function_calling: checked })
                        }
                      />
                      <Checkbox
                        id="supports-tool-choice"
                        label={t('models.admin.supportsToolChoice')}
                        isChecked={formData.supports_tool_choice}
                        onChange={(_event, checked) =>
                          setFormData({ ...formData, supports_tool_choice: checked })
                        }
                      />
                    </Stack>
                  </FormGroup>
                </GridItem>
              </Grid>
            </Form>
          </ModalBody>
          <ModalFooter>
            <div
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="primary"
                onClick={handleSubmit}
                isLoading={createModelMutation.isLoading || updateModelMutation.isLoading}
              >
                {isCreateModalOpen ? t('common.create') : t('common.update')}
              </Button>
              <Button
                variant="link"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                  resetForm();
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </ModalFooter>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          variant={ModalVariant.small}
          title={t('models.admin.deleteModel')}
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
                <p>
                  {t('models.admin.areYouSureYouWantToDeleteTheModel')}{' '}
                  <strong>{selectedModel.name}</strong>?
                </p>
                <p className="pf-v6-u-color-200 pf-v6-u-mt-sm">
                  {t('models.admin.thisActionCannotBeUndoneAndWillRemoveTheModelFromLitellm')}
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <div
              style={{
                marginTop: '1.5rem',
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                isLoading={deleteModelMutation.isLoading}
              >
                {t('common.delete')}
              </Button>
              <Button
                variant="link"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedModel(null);
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      </PageSection>
    </>
  );
};

export default AdminModelsPage;

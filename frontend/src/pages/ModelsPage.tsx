import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from 'react-query';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  CardTitle,
  CardFooter,
  Grid,
  GridItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  MenuToggleElement,
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
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Pagination,
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  Label,
  Stack,
} from '@patternfly/react-core';
import { 
  CatalogIcon, 
  FilterIcon, 
  InfoCircleIcon 
} from '@patternfly/react-icons';
import { useNotifications } from '../contexts/NotificationContext';
import { modelsService, Model } from '../services/models.service';
import { subscriptionsService } from '../services/subscriptions.service';

const ModelsPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [isProviderSelectOpen, setIsProviderSelectOpen] = useState(false);
  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load models from API
  const loadModels = async (resetPage = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const currentPage = resetPage ? 1 : page;
      const response = await modelsService.getModels(
        currentPage,
        perPage,
        searchValue || undefined,
        selectedProvider !== 'all' ? selectedProvider : undefined,
        selectedCategory !== 'all' ? selectedCategory : undefined
      );
      
      setModels(response.models);
      setTotal(response.pagination.total);
      
      if (resetPage) {
        setPage(1);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
      setError('Failed to load models. Please try again.');
      addNotification({
        title: 'Error',
        description: 'Failed to load models from the server.',
        variant: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadModels();
  }, []);

  // Reload when filters or pagination change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadModels(true); // Reset to page 1 when filters change
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchValue, selectedCategory, selectedProvider]);

  // Reload when page or perPage changes
  useEffect(() => {
    if (page > 1 || perPage !== 12) { // Only reload if not initial state
      loadModels();
    }
  }, [page, perPage]);

  // Get unique categories and providers from current models for filters
  const categories = ['all', ...Array.from(new Set(models.map(m => m.category)))];
  const providers = ['all', ...Array.from(new Set(models.map(m => m.provider)))];

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
    setIsModalOpen(true);
  };

  const handleSubscribe = async () => {
    try {
      setIsSubscribing(true);
      
      // Create subscription - expect immediate activation
      await subscriptionsService.createSubscription({
        modelId: selectedModel!.id,
        // Use default quotas or let user specify
        quotaRequests: 10000,
        quotaTokens: 1000000,
      });
      
      addNotification({
        variant: 'success',
        title: 'Successfully subscribed!',
        description: `You now have access to ${selectedModel!.name}. You can generate API keys from the Subscriptions page.`,
      });
      
      setIsModalOpen(false);
      
      // Refresh subscriptions to show new one
      queryClient.invalidateQueries('subscriptions');
      
    } catch (error: any) {
      let errorMessage = 'Failed to subscribe to model';
      
      if (error.message?.includes('already subscribed') || error.status === 409) {
        errorMessage = 'You are already subscribed to this model';
      }
      
      addNotification({
        variant: 'danger',
        title: 'Subscription failed',
        description: errorMessage,
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  const getAvailabilityBadge = (availability: string) => {
    const variants = {
      available: 'success',
      limited: 'warning',
      unavailable: 'danger'
    } as const;

    return (
      <Badge color={variants[availability as keyof typeof variants]}>
        {availability.charAt(0).toUpperCase() + availability.slice(1)}
      </Badge>
    );
  };

  // Models are already paginated by the API
  const paginatedModels = models;

  if (loading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.models.title')}
          </Title>
        </PageSection>
        <PageSection>
          <EmptyState variant={EmptyStateVariant.lg}>
            <Spinner size="xl" />
            <Title headingLevel="h2" size="lg">
              Loading Models...
            </Title>
            <EmptyStateBody>
              Discovering available AI models from all providers
            </EmptyStateBody>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          {t('pages.models.title')}
        </Title>
        <Content component={ContentVariants.p}>
          Discover and subscribe to AI models from various providers
        </Content>
      </PageSection>
      
      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput
                placeholder="Search models..."
                value={searchValue}
                onChange={(_event, value) => setSearchValue(value)}
                onClear={() => setSearchValue('')}
                style={{ minWidth: '300px' }}
              />
            </ToolbarItem>
            
            <ToolbarItem>
              <Select
                id="provider-select"
                isOpen={isProviderSelectOpen}
                selected={selectedProvider}
                onSelect={(_event, value) => {
                  setSelectedProvider(value as string);
                  setIsProviderSelectOpen(false);
                }}
                onOpenChange={setIsProviderSelectOpen}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setIsProviderSelectOpen(!isProviderSelectOpen)}>
                    <FilterIcon /> {selectedProvider === 'all' ? 'All Providers' : selectedProvider}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {providers.map(provider => (
                    <SelectOption key={provider} value={provider}>
                      {provider === 'all' ? 'All Providers' : provider}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </ToolbarItem>
            
            <ToolbarItem>
              <Select
                id="category-select"
                isOpen={isCategorySelectOpen}
                selected={selectedCategory}
                onSelect={(_event, value) => {
                  setSelectedCategory(value as string);
                  setIsCategorySelectOpen(false);
                }}
                onOpenChange={setIsCategorySelectOpen}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle ref={toggleRef} onClick={() => setIsCategorySelectOpen(!isCategorySelectOpen)}>
                    <FilterIcon /> {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {categories.map(category => (
                    <SelectOption key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </ToolbarItem>
            
            <ToolbarItem variant="pagination">
              <Pagination
                itemCount={total}
                perPage={perPage}
                page={page}
                onSetPage={(_event, pageNumber) => setPage(pageNumber)}
                onPerPageSelect={(_event, perPageValue) => {
                  setPerPage(perPageValue);
                  setPage(1);
                }}
                isCompact
              />
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {error ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <CatalogIcon />
            <Title headingLevel="h2" size="lg">
              Error loading models
            </Title>
            <EmptyStateBody>
              {error}
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => loadModels(true)}>
                Retry
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : models.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <CatalogIcon />
            <Title headingLevel="h2" size="lg">
              No models found
            </Title>
            <EmptyStateBody>
              Try adjusting your search criteria or filters to find models.
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="link" onClick={() => {
                setSearchValue('');
                setSelectedCategory('all');
                setSelectedProvider('all');
              }}>
                Clear all filters
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <>
            <Grid hasGutter>
              {paginatedModels.map((model) => (
                <GridItem key={model.id} lg={4} md={6} sm={12}>
                  <Card 
                    isSelectable
                    isSelected={false}
                    onClick={() => handleModelSelect(model)}
                    style={{ height: '100%', cursor: 'pointer' }}
                  >
                    <CardTitle>
                      <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
                        <FlexItem>
                          <Title headingLevel="h3" size="lg">{model.name}</Title>
                        </FlexItem>
                        <FlexItem>
                          {getAvailabilityBadge(model.availability)}
                        </FlexItem>
                      </Flex>
                      <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                        by {model.provider}
                      </Content>
                    </CardTitle>
                    <CardBody>
                      <Content component={ContentVariants.p} style={{ marginBottom: '1rem' }}>
                        {model.description}
                      </Content>
                      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                        <FlexItem>
                          <Label color="blue">{model.category}</Label>
                        </FlexItem>
                        <FlexItem>
                          <Content component={ContentVariants.small}>
                            Context: {model.contextLength ? model.contextLength.toLocaleString() : 'N/A'} tokens
                          </Content>
                        </FlexItem>
                        <FlexItem>
                          <Content component={ContentVariants.small}>
                            {model.pricing ? 
                              `Input: $${model.pricing.input}/1K • Output: $${model.pricing.output}/1K` : 
                              'Pricing: N/A'
                            }
                          </Content>
                        </FlexItem>
                      </Flex>
                    </CardBody>
                    <CardFooter>
                      <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'wrap' }}>
                        {model.features.slice(0, 3).map((feature, index) => (
                          <FlexItem key={index}>
                            <Label color="grey">{feature}</Label>
                          </FlexItem>
                        ))}
                        {model.features.length > 3 && (
                          <FlexItem>
                            <Label color="grey">+{model.features.length - 3} more</Label>
                          </FlexItem>
                        )}
                      </Flex>
                    </CardFooter>
                  </Card>
                </GridItem>
              ))}
            </Grid>
            
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
              <Pagination
                itemCount={total}
                perPage={perPage}
                page={page}
                onSetPage={(_event, pageNumber) => setPage(pageNumber)}
                onPerPageSelect={(_event, perPageValue) => {
                  setPerPage(perPageValue);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </PageSection>

      {/* Model Details Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={selectedModel?.name || ''}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      >
        <ModalHeader>
          <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
            <FlexItem>
              <Title headingLevel="h2" size="xl">{selectedModel?.name}</Title>
            </FlexItem>
            <FlexItem>
              {selectedModel && getAvailabilityBadge(selectedModel.availability)}
            </FlexItem>
          </Flex>
          <Content component={ContentVariants.p} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
            Provided by {selectedModel?.provider} • Version {selectedModel?.version}
          </Content>
        </ModalHeader>
        <ModalBody>
          {selectedModel && (
            <>
              <Content component={ContentVariants.p} style={{ marginBottom: '1.5rem' }}>
                {selectedModel.description}
              </Content>
              
              <Stack hasGutter style={{ marginBottom: '1.5rem' }}>
                <Content><strong>Provider:</strong> {selectedModel.provider}</Content>
                
                {/* Show real pricing from LiteLLM */}
                {selectedModel.pricing && (
                  <Stack hasGutter>
                    <Content><strong>Pricing:</strong></Content>
                    <Content>Input: ${selectedModel.pricing.input}/1K tokens</Content>
                    <Content>Output: ${selectedModel.pricing.output}/1K tokens</Content>
                  </Stack>
                )}
                
                <Content>
                  By subscribing, you'll get access to this model and can generate API keys to use it.
                </Content>
              </Stack>
              
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Category</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Label color="blue">{selectedModel.category}</Label>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Context Length</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedModel.contextLength ? selectedModel.contextLength.toLocaleString() : 'N/A'} tokens
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Pricing</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedModel.pricing ? (
                      <Stack hasGutter>
                        <Content>Input: ${selectedModel.pricing.input}/1K tokens</Content>
                        <Content>Output: ${selectedModel.pricing.output}/1K tokens</Content>
                      </Stack>
                    ) : (
                      <Content>Pricing information unavailable</Content>
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Features</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'wrap' }}>
                      {selectedModel.features.map((feature, index) => (
                        <FlexItem key={index}>
                          <Label color="grey">{feature}</Label>
                        </FlexItem>
                      ))}
                    </Flex>
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
              
              {selectedModel.availability === 'unavailable' && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--pf-v6-global--danger--color--100)', borderRadius: '4px' }}>
                  <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                    <FlexItem>
                      <InfoCircleIcon color="var(--pf-v6-global--danger--color--200)" />
                    </FlexItem>
                    <FlexItem>
                      <Content>This model is currently unavailable for new subscriptions.</Content>
                    </FlexItem>
                  </Flex>
                </div>
              )}
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button 
              variant="primary" 
              onClick={handleSubscribe}
              isLoading={isSubscribing}
              isDisabled={isSubscribing || selectedModel?.availability === 'unavailable'}
            >
              {isSubscribing ? 'Creating subscription...' : 'Subscribe'}
            </Button>
            <Button variant="link" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ModelsPage;

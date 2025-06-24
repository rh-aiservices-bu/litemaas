import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
} from '@patternfly/react-core';
import { 
  CatalogIcon, 
  FilterIcon, 
  InfoCircleIcon 
} from '@patternfly/react-icons';
import { useNotifications } from '../contexts/NotificationContext';

interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: string;
  contextLength: number;
  pricing: {
    input: number;
    output: number;
  };
  features: string[];
  availability: 'available' | 'limited' | 'unavailable';
  version: string;
}

const ModelsPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [isProviderSelectOpen, setIsProviderSelectOpen] = useState(false);
  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  // Mock data - replace with actual API call
  useEffect(() => {
    const mockModels: Model[] = [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'OpenAI',
        description: 'Advanced language model with superior reasoning capabilities',
        category: 'Language Model',
        contextLength: 8192,
        pricing: { input: 0.03, output: 0.06 },
        features: ['Code Generation', 'Creative Writing', 'Analysis'],
        availability: 'available',
        version: '1.0'
      },
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'Anthropic',
        description: 'Most capable model with exceptional reasoning and creativity',
        category: 'Language Model',
        contextLength: 200000,
        pricing: { input: 0.015, output: 0.075 },
        features: ['Long Context', 'Code Generation', 'Analysis'],
        availability: 'available',
        version: '3.0'
      },
      {
        id: 'llama-2-70b',
        name: 'Llama 2 70B',
        provider: 'Meta',
        description: 'Open source large language model with strong performance',
        category: 'Language Model',
        contextLength: 4096,
        pricing: { input: 0.007, output: 0.007 },
        features: ['Open Source', 'Code Generation', 'Chat'],
        availability: 'available',
        version: '2.0'
      },
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        provider: 'OpenAI',
        description: 'Advanced image generation model with improved quality',
        category: 'Image Generation',
        contextLength: 1024,
        pricing: { input: 0.04, output: 0.08 },
        features: ['High Quality', 'Prompt Following', 'Style Control'],
        availability: 'limited',
        version: '3.0'
      },
      {
        id: 'stable-diffusion-xl',
        name: 'Stable Diffusion XL',
        provider: 'Stability AI',
        description: 'Open source image generation with excellent results',
        category: 'Image Generation',
        contextLength: 512,
        pricing: { input: 0.002, output: 0.002 },
        features: ['Open Source', 'Fast Generation', 'Style Control'],
        availability: 'available',
        version: '1.0'
      },
      {
        id: 'whisper-large',
        name: 'Whisper Large',
        provider: 'OpenAI',
        description: 'Speech recognition model with multilingual support',
        category: 'Audio',
        contextLength: 30000,
        pricing: { input: 0.006, output: 0.006 },
        features: ['Multilingual', 'High Accuracy', 'Real-time'],
        availability: 'available',
        version: '3.0'
      }
    ];

    setTimeout(() => {
      setModels(mockModels);
      setFilteredModels(mockModels);
      setLoading(false);
    }, 1500);
  }, []);

  useEffect(() => {
    let filtered = models;

    if (searchValue) {
      filtered = filtered.filter(model => 
        model.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        model.description.toLowerCase().includes(searchValue.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(model => model.category === selectedCategory);
    }

    if (selectedProvider !== 'all') {
      filtered = filtered.filter(model => model.provider === selectedProvider);
    }

    setFilteredModels(filtered);
    setPage(1);
  }, [searchValue, selectedCategory, selectedProvider, models]);

  const categories = ['all', ...Array.from(new Set(models.map(m => m.category)))];
  const providers = ['all', ...Array.from(new Set(models.map(m => m.provider)))];

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
    setIsModalOpen(true);
  };

  const handleSubscribe = (model: Model) => {
    addNotification({
      title: 'Subscription Request',
      description: `Subscription request for ${model.name} has been submitted.`,
      variant: 'info'
    });
    setIsModalOpen(false);
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

  const paginatedModels = filteredModels.slice(
    (page - 1) * perPage,
    page * perPage
  );

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
                itemCount={filteredModels.length}
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

        {filteredModels.length === 0 ? (
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
                            Context: {model.contextLength.toLocaleString()} tokens
                          </Content>
                        </FlexItem>
                        <FlexItem>
                          <Content component={ContentVariants.small}>
                            Input: ${model.pricing.input}/1K • Output: ${model.pricing.output}/1K
                          </Content>
                        </FlexItem>
                      </Flex>
                    </CardBody>
                    <CardFooter>
                      <Flex spaceItems={{ default: 'spaceItemsSm' }} wrap={{ default: 'wrap' }}>
                        {model.features.slice(0, 3).map((feature, index) => (
                          <FlexItem key={index}>
                            <Label color="grey">{feature}</Label>
                          </FlexItem>
                        ))}
                        {model.features.length > 3 && (
                          <FlexItem>
                            <Label color="outline">+{model.features.length - 3} more</Label>
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
                itemCount={filteredModels.length}
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
                    {selectedModel.contextLength.toLocaleString()} tokens
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Pricing</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Content component={ContentVariants.p}>
                      Input: ${selectedModel.pricing.input}/1K tokens
                    </Content>
                    <Content component={ContentVariants.p}>
                      Output: ${selectedModel.pricing.output}/1K tokens
                    </Content>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Features</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }} wrap={{ default: 'wrap' }}>
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
              onClick={() => selectedModel && handleSubscribe(selectedModel)}
              isDisabled={selectedModel?.availability === 'unavailable'}
            >
              Subscribe to Model
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

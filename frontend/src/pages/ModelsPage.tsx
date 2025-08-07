import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from 'react-query';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  CardTitle,
  CardFooter,
  CardHeader,
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
  InfoCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TimesCircleIcon
} from '@patternfly/react-icons';
import { useNotifications } from '../contexts/NotificationContext';
import { modelsService, Model } from '../services/models.service';
import { subscriptionsService } from '../services/subscriptions.service';
import {
  ScreenReaderAnnouncement,
  useScreenReaderAnnouncement,
} from '../components/ScreenReaderAnnouncement';

const ModelsPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const { announcement, announce } = useScreenReaderAnnouncement();

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
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const modalPrimaryButtonRef = useRef<HTMLButtonElement>(null);

  // Set initial focus and focus trap for modal
  useEffect(() => {
    if (isModalOpen) {
      // Set initial focus to the primary button
      setTimeout(() => {
        modalPrimaryButtonRef.current?.focus();
      }, 100);

      // Focus trap implementation
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Tab') {
          const modal = document.querySelector('[aria-modal="true"]') as HTMLElement;
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
    return () => {}; // Return empty cleanup function when modal is not open
  }, [isModalOpen]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load models from API
  const loadModels = async (resetPage = false): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const currentPage = resetPage ? 1 : page;

      // Convert category to capability filter for backend
      let capability = undefined;

      // Only Multimodal category maps directly to a capability
      if (selectedCategory === 'Multimodal') {
        capability = 'vision';
      }

      const response = await modelsService.getModels(
        currentPage,
        perPage,
        searchValue || undefined,
        selectedProvider !== 'all' ? selectedProvider : undefined,
        capability,
      );

      // For categories that don't map to capabilities, filter client-side
      // This is a temporary solution - ideally the backend should support category filtering
      let filteredModels = response.models;

      if (selectedCategory !== 'all' && selectedCategory !== 'Multimodal') {
        filteredModels = response.models.filter((model) => {
          if (selectedCategory === 'Language Model') {
            // Language Model includes all models except pure image/audio generation
            // (includes multimodal since they also have language capabilities)
            return model.category === 'Language Model' || model.category === 'Multimodal';
          }
          return model.category === selectedCategory;
        });
      }

      setModels(filteredModels);

      // Adjust total count for client-side filtered results
      if (selectedCategory !== 'all' && selectedCategory !== 'Multimodal') {
        // This is approximate - we can't know the real total without fetching all pages
        setTotal(filteredModels.length);
      } else {
        setTotal(response.pagination.total);
      }

      if (resetPage) {
        setPage(1);
      }

      // Announce search/filter results to screen readers
      if (searchValue || selectedCategory !== 'all' || selectedProvider !== 'all') {
        const totalModels =
          selectedCategory !== 'all' && selectedCategory !== 'Multimodal'
            ? filteredModels.length
            : response.pagination.total;
        announce(t('pages.models.searchResults', { count: totalModels }), 'polite');
      }
    } catch (err) {
      console.error('Failed to load models:', err);
      setError(t('pages.models.notifications.loadFailed'));
      // Announce error to screen readers with assertive priority
      announce(t('pages.models.notifications.loadFailed'), 'assertive');
      addNotification({
        title: t('pages.models.notifications.loadError'),
        description: t('pages.models.notifications.loadErrorDesc'),
        variant: 'danger',
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
    if (page > 1 || perPage !== 12) {
      // Only reload if not initial state
      loadModels();
    }
  }, [page, perPage]);

  // Define all available categories (static list)
  const categories = ['all', 'Language Model', 'Multimodal', 'Image Generation', 'Audio'];

  // Get unique providers from current models for filters
  const providers = ['all', ...Array.from(new Set(models.map((m) => m.provider)))];

  const handleModelSelect = (model: Model, triggerElement?: HTMLElement) => {
    setSelectedModel(model);
    setIsModalOpen(true);
    // Store reference to the trigger element for focus restoration
    if (triggerElement) {
      modalTriggerRef.current = triggerElement;
    }
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
        title: t('pages.models.notifications.subscribeSuccess'),
        description: t('pages.models.notifications.subscribeSuccessDesc', {
          modelName: selectedModel!.name,
        }),
      });

      setIsModalOpen(false);

      // Refresh subscriptions to show new one
      queryClient.invalidateQueries('subscriptions');
    } catch (error: any) {
      let errorMessage = t('pages.models.notifications.failedToSubscribe');

      if (error.message?.includes('already subscribed') || error.status === 409) {
        errorMessage = t('pages.models.notifications.alreadySubscribed');
      }

      addNotification({
        variant: 'danger',
        title: t('pages.models.notifications.subscribeFailed'),
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
      unavailable: 'danger',
    } as const;

    const icons = {
      available: <CheckCircleIcon />,
      limited: <ExclamationTriangleIcon />,
      unavailable: <TimesCircleIcon />,
    };

    const statusLabels = {
      available: t('pages.models.availability.available', 'Available'),
      limited: t('pages.models.availability.limited', 'Limited availability'),
      unavailable: t('pages.models.availability.unavailable', 'Unavailable'),
    };

    return (
      <Badge 
        color={variants[availability as keyof typeof variants]}
        aria-label={`Model availability: ${statusLabels[availability as keyof typeof statusLabels] || availability}`}
      >
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
          <FlexItem>{icons[availability as keyof typeof icons]}</FlexItem>
          <FlexItem>{statusLabels[availability as keyof typeof statusLabels] || availability.charAt(0).toUpperCase() + availability.slice(1)}</FlexItem>
        </Flex>
      </Badge>
    );
  };

  // Models are already paginated by the API
  const paginatedModels = models;

  if (loading) {
    return (
      <>
        <ScreenReaderAnnouncement
          message={t('pages.models.loadingDescription')}
          priority="polite"
          announcementKey={loading ? 1 : 0}
        />
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.models.title')}
          </Title>
        </PageSection>
        <PageSection>
          <EmptyState variant={EmptyStateVariant.lg}>
            <Spinner size="xl" aria-busy="true" />
            <Title headingLevel="h2" size="lg">
              {t('pages.models.loadingTitle')}
            </Title>
            <EmptyStateBody>{t('pages.models.loadingDescription')}</EmptyStateBody>
          </EmptyState>
        </PageSection>
      </>
    );
  }

  return (
    <>
      <ScreenReaderAnnouncement
        message={announcement.message}
        priority={announcement.priority}
        announcementKey={announcement.key}
      />
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          {t('pages.models.title')}
        </Title>
        <Content component={ContentVariants.p}>{t('pages.models.subtitle')}</Content>
      </PageSection>

      <PageSection>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput
                placeholder={t('pages.models.searchPlaceholder')}
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
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsProviderSelectOpen(!isProviderSelectOpen)}
                  >
                    <FilterIcon />{' '}
                    {selectedProvider === 'all'
                      ? t('pages.models.filters.allProviders')
                      : selectedProvider}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {providers.map((provider) => (
                    <SelectOption key={provider} value={provider}>
                      {provider === 'all' ? t('pages.models.filters.allProviders') : provider}
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
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsCategorySelectOpen(!isCategorySelectOpen)}
                  >
                    <FilterIcon />{' '}
                    {selectedCategory === 'all'
                      ? t('pages.models.filters.allCategories')
                      : selectedCategory}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {categories.map((category) => (
                    <SelectOption key={category} value={category}>
                      {category === 'all' ? t('pages.models.filters.allCategories') : category}
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
              {t('pages.models.notifications.loadError')}
            </Title>
            <EmptyStateBody>{error}</EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => loadModels(true)}>
                {t('ui.actions.tryAgain')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : models.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <CatalogIcon />
            <Title headingLevel="h2" size="lg">
              {t('pages.models.noModels')}
            </Title>
            <EmptyStateBody>{t('pages.models.emptyStateMessage')}</EmptyStateBody>
            <EmptyStateActions>
              <Button
                variant="link"
                onClick={() => {
                  setSearchValue('');
                  setSelectedCategory('all');
                  setSelectedProvider('all');
                }}
              >
                {t('pages.models.clearAllFilters')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <>
            <Grid hasGutter>
              {paginatedModels.map((model) => (
                <GridItem key={model.id} lg={4} md={6} sm={12}>
                  <Card isClickable style={{ height: '100%' }}>
                    <CardHeader
                      selectableActions={{
                        onClickAction: (event) => handleModelSelect(model, event?.currentTarget as HTMLElement),
                        selectableActionAriaLabelledby: `clickable-model-${model.id}`,
                      }}
                    >
                      <CardTitle id={`clickable-model-${model.id}`}>
                        <Flex
                          justifyContent={{ default: 'justifyContentSpaceBetween' }}
                          alignItems={{ default: 'alignItemsCenter' }}
                        >
                          <FlexItem>
                            <Title headingLevel="h3" size="lg">
                              {model.name}
                            </Title>
                          </FlexItem>
                          <FlexItem>{getAvailabilityBadge(model.availability)}</FlexItem>
                        </Flex>
                        {/* TODO: implement model description
                         <Content
                          component={ContentVariants.small}
                          style={{ color: 'var(--pf-v6-global--Color--200)' }}
                        >
                          by {model.provider}
                        </Content> 
                        */}
                      </CardTitle>
                    </CardHeader>
                    <CardBody>
                      {/*
                      <Content component={ContentVariants.p} style={{ marginBottom: '1rem' }}>
                        {model.description}
                      </Content> */}
                      <Flex
                        direction={{ default: 'column' }}
                        spaceItems={{ default: 'spaceItemsSm' }}
                      >
                        <FlexItem>
                          <Label color="blue">{model.category}</Label>
                        </FlexItem>
                        <FlexItem>
                          <Content component={ContentVariants.small}>
                            {t('pages.models.contextLabel')}{' '}
                            {model.contextLength ? model.contextLength.toLocaleString() : 'N/A'}{' '}
                            tokens
                          </Content>
                        </FlexItem>
                        <FlexItem>
                          <Content component={ContentVariants.small}>
                            {model.pricing
                              ? `Input: $${model.pricing.input * 1000000}/1M ${t('pages.usage.metrics.tokens')} • Output: $${model.pricing.output * 1000000}/1M ${t('pages.usage.metrics.tokens')}`
                              : t('pages.models.pricingLabel')}
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
                            <Label color="grey">
                              {t('pages.models.moreFeatures', { count: model.features.length - 3 })}
                            </Label>
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
        onClose={() => {
          setIsModalOpen(false);
          // Restore focus to the trigger element
          setTimeout(() => {
            modalTriggerRef.current?.focus();
          }, 100);
        }}
        aria-modal="true"
        onEscapePress={() => {
          setIsModalOpen(false);
          // Restore focus to the trigger element
          setTimeout(() => {
            modalTriggerRef.current?.focus();
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
                {selectedModel?.name}
              </Title>
            </FlexItem>
            <FlexItem>{selectedModel && getAvailabilityBadge(selectedModel.availability)}</FlexItem>
          </Flex>
          {/* TODO: Model Description
          <Content
            component={ContentVariants.p}
            style={{ color: 'var(--pf-v6-global--Color--200)' }}
          >
            Provided by {selectedModel?.provider} • Version {selectedModel?.version}
          </Content>
          */}
        </ModalHeader>
        <ModalBody>
          {selectedModel && (
            <>
              {/*               
              <Content component={ContentVariants.p} style={{ marginBottom: '1.5rem' }}>
                {selectedModel.description}
              </Content>
               */}

              <Stack hasGutter style={{ marginBottom: '1.5rem' }}>
                {/* TODO: Fix provider source                 
                <Content>
                  <strong>Provider:</strong> {selectedModel.provider}
                </Content>
                */}

                <Content>
                  By subscribing, you'll get access to this model and can generate API keys to use
                  it.
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
                    {selectedModel.contextLength
                      ? selectedModel.contextLength.toLocaleString()
                      : 'N/A'}{' '}
                    tokens
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>Pricing</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedModel.pricing ? (
                      <Stack hasGutter>
                        <Content>
                          Input: ${selectedModel.pricing.input * 1000000}/1M{' '}
                          {t('pages.usage.metrics.tokens')}
                        </Content>
                        <Content>
                          Output: ${selectedModel.pricing.output * 1000000}/1M{' '}
                          {t('pages.usage.metrics.tokens')}
                        </Content>
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
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: 'var(--pf-v6-global--danger--color--100)',
                    borderRadius: '4px',
                  }}
                >
                  <Flex
                    alignItems={{ default: 'alignItemsCenter' }}
                    spaceItems={{ default: 'spaceItemsSm' }}
                  >
                    <FlexItem>
                      <InfoCircleIcon color="var(--pf-v6-global--danger--color--200)" />
                    </FlexItem>
                    <FlexItem>
                      <Content>{t('pages.models.modelUnavailable')}</Content>
                    </FlexItem>
                  </Flex>
                </div>
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
              ref={modalPrimaryButtonRef}
              variant="primary"
              onClick={handleSubscribe}
              isLoading={isSubscribing}
              isDisabled={isSubscribing || selectedModel?.availability === 'unavailable'}
              aria-label={selectedModel?.name ? t('pages.models.subscribeToModel', { modelName: selectedModel.name }) : undefined}
            >
              {isSubscribing ? t('pages.models.subscribing') : t('pages.models.subscribe')}
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setIsModalOpen(false);
                // Restore focus to the trigger element
                setTimeout(() => {
                  modalTriggerRef.current?.focus();
                }, 100);
              }}
            >
              {t('pages.models.close')}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ModelsPage;

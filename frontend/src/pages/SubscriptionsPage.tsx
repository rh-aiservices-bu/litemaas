import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  Alert,
  Bullseye,
  Stack,
  Label,
} from '@patternfly/react-core';
import {
  CubesIcon,
  PlusCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TimesCircleIcon,
} from '@patternfly/react-icons';
import { useNotifications } from '../contexts/NotificationContext';
import { subscriptionsService, Subscription } from '../services/subscriptions.service';
import { getModelFlairs } from '../utils/flairColors';

const SubscriptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const modalPrimaryButtonRef = useRef<HTMLButtonElement>(null);

  // Set initial focus and focus trap for modal
  useEffect(() => {
    if (isDetailsModalOpen) {
      // Set initial focus to the primary button (Cancel Subscription)
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
  }, [isDetailsModalOpen]);

  // Load subscriptions from API
  const loadSubscriptions = async () => {
    try {
      setLoading(true);

      const response = await subscriptionsService.getSubscriptions();
      setSubscriptions(response.data);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      addNotification({
        title: t('pages.subscriptions.notifications.loadError'),
        description: t('pages.subscriptions.notifications.loadErrorDesc'),
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'success',
      suspended: 'warning',
      expired: 'danger',
      pending: 'info',
    } as const;

    const icons = {
      active: <CheckCircleIcon />,
      suspended: <ExclamationTriangleIcon />,
      expired: <TimesCircleIcon />,
      pending: <Spinner size="sm" />,
    };

    const statusLabels = {
      active: t('pages.subscriptions.status.active'),
      suspended: t('pages.subscriptions.status.suspended'),
      expired: t('pages.subscriptions.status.expired'),
      pending: t('pages.subscriptions.status.pending'),
    };

    return (
      <Badge
        color={variants[status as keyof typeof variants]}
        aria-label={`${t('pages.subscriptions.ariaLabels.status')}: ${statusLabels[status as keyof typeof statusLabels] || status}`}
      >
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
          <FlexItem>{icons[status as keyof typeof icons]}</FlexItem>
          <FlexItem>
            {statusLabels[status as keyof typeof statusLabels] ||
              status.charAt(0).toUpperCase() + status.slice(1)}
          </FlexItem>
        </Flex>
      </Badge>
    );
  };

  const getPricingInfo = (subscription: Subscription) => {
    if (!subscription.pricing) {
      return (
        <Content component={ContentVariants.small}>
          {t('pages.subscriptions.pricingUnavailable')}
        </Content>
      );
    }

    // Convert from per-token to per-million-tokens for display
    const inputCostPerMillion = subscription.pricing.inputCostPerToken * 1000000;
    const outputCostPerMillion = subscription.pricing.outputCostPerToken * 1000000;

    return (
      <Stack hasGutter>
        <Content component={ContentVariants.small}>
          {t('pages.subscriptions.pricingLabels.input')}: ${inputCostPerMillion.toFixed(2)}/1M{' '}
          {t('pages.usage.metrics.tokens')} {t('pages.models.pricing.separator')}{' '}
          {t('pages.subscriptions.pricingLabels.output')}: ${outputCostPerMillion.toFixed(2)}/1M{' '}
          {t('pages.usage.metrics.tokens')}
        </Content>
      </Stack>
    );
  };
  /* 
    const getUsagePercentage = (used: number, limit: number) => {
      return Math.round((used / limit) * 100);
    };
  
    const getUsageVariant = (percentage: number) => {
      if (percentage >= 90) return 'danger';
      if (percentage >= 75) return 'warning';
      return 'success';
    };
   */
  const handleSubscriptionDetails = (subscription: Subscription, triggerElement?: HTMLElement) => {
    setSelectedSubscription(subscription);
    setIsDetailsModalOpen(true);
    // Store reference to the trigger element for focus restoration
    if (triggerElement) {
      modalTriggerRef.current = triggerElement;
    }
  };

  const handleCancelSubscription = async (subscription: Subscription) => {
    try {
      setIsCancelling(true);

      // Call the backend API to cancel the subscription
      await subscriptionsService.cancelSubscription(subscription.id);

      // If successful, show success notification and reload subscriptions
      addNotification({
        title: t('pages.subscriptions.notifications.cancelSuccess'),
        description: t('pages.subscriptions.cancelledMessage', {
          modelName: subscription.modelName,
        }),
        variant: 'success',
      });

      // Close the modal and reload subscriptions to reflect changes
      setIsDetailsModalOpen(false);
      await loadSubscriptions();
    } catch (error: any) {
      // Handle API key validation error specifically
      if (error.statusCode === 400 || error.status === 400) {
        addNotification({
          title: t('pages.subscriptions.notifications.cannotCancel'),
          description: error.message || t('pages.subscriptions.notifications.cannotCancelDesc'),
          variant: 'warning',
        });
      } else {
        // Handle other errors
        console.error('Failed to cancel subscription:', error);
        addNotification({
          title: t('pages.subscriptions.notifications.cancelError'),
          description: error.message || t('pages.subscriptions.notifications.cancelErrorDesc'),
          variant: 'danger',
        });
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            {t('pages.subscriptions.title')}
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                {t('pages.subscriptions.loadingTitle')}
              </Title>
              <EmptyStateBody>{t('pages.subscriptions.loadingDescription')}</EmptyStateBody>
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
              {t('pages.subscriptions.pageTitle')}
            </Title>
            <Content component={ContentVariants.p}>{t('pages.subscriptions.pageSubtitle')}</Content>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => navigate('/models')}>
              {t('pages.subscriptions.newSubscription')}
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection>
        {subscriptions.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <CubesIcon />
            <Title headingLevel="h2" size="lg">
              {t('pages.subscriptions.noSubscriptionsTitle')}
            </Title>
            <EmptyStateBody>{t('pages.subscriptions.noSubscriptionsDescription')}</EmptyStateBody>
            <EmptyStateActions>
              <Button
                variant="primary"
                icon={<PlusCircleIcon />}
                onClick={() => navigate('/models')}
              >
                {t('ui.actions.browse')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <>
            <Grid hasGutter>
              {subscriptions.map((subscription) => {
                return (
                  <GridItem key={subscription.id} lg={6} xl={4}>
                    <Card style={{ height: '100%' }}>
                      <CardTitle>
                        <Flex
                          justifyContent={{ default: 'justifyContentSpaceBetween' }}
                          alignItems={{ default: 'alignItemsCenter' }}
                        >
                          <FlexItem>
                            <Title headingLevel="h3" size="lg">
                              {subscription.modelName}
                            </Title>
                          </FlexItem>
                          <FlexItem>{getStatusBadge(subscription.status)}</FlexItem>
                        </Flex>
                      </CardTitle>
                      <CardBody>
                        <Flex
                          direction={{ default: 'column' }}
                          spaceItems={{ default: 'spaceItemsSm' }}
                        >
                          <FlexItem>
                            <Content component={ContentVariants.small}>
                              {t('pages.models.contextLabel')}{' '}
                              {subscription.modelContextLength
                                ? subscription.modelContextLength.toLocaleString()
                                : 'N/A'}{' '}
                              {t('pages.models.units.tokens')}
                            </Content>
                          </FlexItem>
                          <FlexItem>{getPricingInfo(subscription)}</FlexItem>
                          <FlexItem>
                            <Flex
                              spaceItems={{ default: 'spaceItemsSm' }}
                              flexWrap={{ default: 'wrap' }}
                            >
                              {getModelFlairs(subscription).map(({ key, label, color }) => (
                                <FlexItem key={key}>
                                  <Label color={color}>{label}</Label>
                                </FlexItem>
                              ))}
                            </Flex>
                          </FlexItem>
                          {/* TODO: Implement token usage
                          <FlexItem>
                            <Progress
                              value={getUsagePercentage(
                                subscription.usedTokens,
                                subscription.quotaTokens,
                              )}
                              title={`${t('pages.subscriptions.tokenUsageThisMonth')}: ${subscription.usedTokens.toLocaleString()} / ${subscription.quotaTokens.toLocaleString()} tokens`}
                              variant={getUsageVariant(
                                getUsagePercentage(
                                  subscription.usedTokens,
                                  subscription.quotaTokens,
                                ),
                              )}
                              measureLocation={ProgressMeasureLocation.outside}
                              aria-label={`Token usage progress: ${subscription.usedTokens.toLocaleString()} of ${subscription.quotaTokens.toLocaleString()} tokens used (${getUsagePercentage(subscription.usedTokens, subscription.quotaTokens)}%)`}
                            />
                            <span className="pf-v6-screen-reader">
                              Usage level:{' '}
                              {getUsagePercentage(
                                subscription.usedTokens,
                                subscription.quotaTokens,
                              ) >= 90
                                ? 'Critical - over 90% used'
                                : getUsagePercentage(
                                      subscription.usedTokens,
                                      subscription.quotaTokens,
                                    ) >= 75
                                  ? 'High - over 75% used'
                                  : 'Normal - under 75% used'}
                            </span>
                          </FlexItem> */}
                          {/* TODO: Implement quotas
                          <FlexItem>
                            <Content component={ContentVariants.small}>
                              {t('pages.subscriptions.quotaFormat', {
                                requests: subscription.quotaRequests.toLocaleString(),
                                tokens: subscription.quotaTokens.toLocaleString(),
                              })}
                            </Content>
                          </FlexItem> */}
                        </Flex>
                      </CardBody>
                      <CardFooter>
                        <Flex
                          direction={{ default: 'column' }}
                          spaceItems={{ default: 'spaceItemsSm' }}
                        >
                          <FlexItem>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={(event) =>
                                handleSubscriptionDetails(subscription, event.currentTarget)
                              }
                              aria-label={t('pages.subscriptions.viewDetailsForModel', {
                                modelName: subscription.modelName,
                              })}
                            >
                              {t('pages.subscriptions.viewDetails')}
                            </Button>
                          </FlexItem>
                        </Flex>
                      </CardFooter>
                    </Card>
                  </GridItem>
                );
              })}
            </Grid>
          </>
        )}
      </PageSection>

      {/* Subscription Details Modal */}
      <Modal
        variant={ModalVariant.medium}
        title={selectedSubscription?.modelName || ''}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          // Restore focus to the trigger element
          setTimeout(() => {
            modalTriggerRef.current?.focus();
          }, 100);
        }}
        aria-modal="true"
        onEscapePress={() => {
          setIsDetailsModalOpen(false);
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
                {selectedSubscription?.modelName}
              </Title>
            </FlexItem>
            {/*             <FlexItem>
              {selectedSubscription && getStatusBadge(selectedSubscription.status)}
            </FlexItem> */}
          </Flex>
          <>
            {selectedSubscription && selectedSubscription.modelDescription && (
              <Content component={ContentVariants.p}>
                {selectedSubscription.modelDescription}
              </Content>
            )}
          </>
        </ModalHeader>
        <ModalBody>
          {selectedSubscription && (
            <>
              <Content
                component={ContentVariants.h4}
                style={{ color: 'var(--pf-v6-global--Color--200)', marginBottom: '1rem' }}
              >
                {t('pages.subscriptions.detailsTitle')}
              </Content>

              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.statusLabel')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {getStatusBadge(selectedSubscription.status)}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.created')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {new Date(selectedSubscription.createdAt).toLocaleDateString()}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.pricing')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedSubscription.pricing
                      ? `${t('pages.models.pricing.input')}: $${(selectedSubscription.pricing.inputCostPerToken * 1000000).toFixed(2)}/1M ${t('pages.usage.metrics.tokens')} ${t('pages.models.pricing.separator')} ${t('pages.models.pricing.output')}: $${(selectedSubscription.pricing.outputCostPerToken * 1000000).toFixed(2)}/1M ${t('pages.usage.metrics.tokens')}`
                      : t('pages.models.pricingLabel')}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.models.modal.contextLength')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedSubscription.modelContextLength
                      ? selectedSubscription.modelContextLength.toLocaleString()
                      : 'N/A'}{' '}
                    {t('pages.models.modal.tokens')}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.models.modal.features')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'wrap' }}>
                      {getModelFlairs(selectedSubscription).map(({ key, label, color }) => (
                        <FlexItem key={key}>
                          <Label color={color}>{label}</Label>
                        </FlexItem>
                      ))}
                    </Flex>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                {/* TODO Implement quotas and token counts
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.requestQuota')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedSubscription.quotaRequests.toLocaleString()}{' '}
                    {t('pages.subscriptions.perMonth')}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.tokenQuota')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedSubscription.quotaTokens.toLocaleString()}{' '}
                    {t('pages.subscriptions.perMonth')}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.requestsUsed')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Flex
                      direction={{ default: 'column' }}
                      spaceItems={{ default: 'spaceItemsXs' }}
                    >
                      <FlexItem>
                        {selectedSubscription.usedRequests.toLocaleString()} /{' '}
                        {selectedSubscription.quotaRequests.toLocaleString()}{' '}
                        {t('pages.subscriptions.requests')}
                      </FlexItem>
                      <FlexItem>
                        <Progress
                          value={getUsagePercentage(
                            selectedSubscription.usedRequests,
                            selectedSubscription.quotaRequests,
                          )}
                          variant={getUsageVariant(
                            getUsagePercentage(
                              selectedSubscription.usedRequests,
                              selectedSubscription.quotaRequests,
                            ),
                          )}
                          measureLocation={ProgressMeasureLocation.outside}
                          aria-label={`Request usage progress: ${selectedSubscription.usedRequests.toLocaleString()} of ${selectedSubscription.quotaRequests.toLocaleString()} requests used (${getUsagePercentage(selectedSubscription.usedRequests, selectedSubscription.quotaRequests)}%)`}
                        />
                        <span className="pf-v6-screen-reader">
                          Usage level:{' '}
                          {getUsagePercentage(
                            selectedSubscription.usedRequests,
                            selectedSubscription.quotaRequests,
                          ) >= 90
                            ? 'Critical - over 90% used'
                            : getUsagePercentage(
                              selectedSubscription.usedRequests,
                              selectedSubscription.quotaRequests,
                            ) >= 75
                              ? 'High - over 75% used'
                              : 'Normal - under 75% used'}
                        </span>
                      </FlexItem>
                    </Flex>
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.tokensUsed')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Flex
                      direction={{ default: 'column' }}
                      spaceItems={{ default: 'spaceItemsXs' }}
                    >
                      <FlexItem>
                        {selectedSubscription.usedTokens.toLocaleString()} /{' '}
                        {selectedSubscription.quotaTokens.toLocaleString()}{' '}
                        {t('pages.subscriptions.tokens')}
                      </FlexItem>
                      <FlexItem>
                        <Progress
                          value={getUsagePercentage(
                            selectedSubscription.usedTokens,
                            selectedSubscription.quotaTokens,
                          )}
                          variant={getUsageVariant(
                            getUsagePercentage(
                              selectedSubscription.usedTokens,
                              selectedSubscription.quotaTokens,
                            ),
                          )}
                          measureLocation={ProgressMeasureLocation.outside}
                          aria-label={`Token usage progress: ${selectedSubscription.usedTokens.toLocaleString()} of ${selectedSubscription.quotaTokens.toLocaleString()} tokens used (${getUsagePercentage(selectedSubscription.usedTokens, selectedSubscription.quotaTokens)}%)`}
                        />
                        <span className="pf-v6-screen-reader">
                          Usage level:{' '}
                          {getUsagePercentage(
                            selectedSubscription.usedTokens,
                            selectedSubscription.quotaTokens,
                          ) >= 90
                            ? 'Critical - over 90% used'
                            : getUsagePercentage(
                              selectedSubscription.usedTokens,
                              selectedSubscription.quotaTokens,
                            ) >= 75
                              ? 'High - over 75% used'
                              : 'Normal - under 75% used'}
                        </span>
                      </FlexItem>
                    </Flex>
                  </DescriptionListDescription>
                </DescriptionListGroup>
 */}

                {/*
                 <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.features')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'wrap' }}>
                      {selectedSubscription.features.map((feature, index) => (
                        <FlexItem key={index}>
                          <Label color="blue">{feature}</Label>
                        </FlexItem>
                      ))}
                    </Flex>
                  </DescriptionListDescription>
                </DescriptionListGroup> 
                */}
              </DescriptionList>

              {selectedSubscription.status === 'suspended' && (
                <Alert
                  variant="warning"
                  title={t('pages.subscriptions.alerts.suspended')}
                  style={{ marginTop: '1rem' }}
                >
                  {t('pages.subscriptions.suspendedMessage')}
                </Alert>
              )}

              {selectedSubscription.status === 'expired' && (
                <Alert
                  variant="danger"
                  title={t('pages.subscriptions.alerts.expired')}
                  style={{ marginTop: '1rem' }}
                >
                  {t('pages.subscriptions.expiredMessage', {
                    date:
                      selectedSubscription.expiresAt &&
                      new Date(selectedSubscription.expiresAt).toLocaleDateString(),
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
              ref={modalPrimaryButtonRef}
              variant="danger"
              onClick={() => selectedSubscription && handleCancelSubscription(selectedSubscription)}
              isDisabled={selectedSubscription?.status === 'expired' || isCancelling}
              isLoading={isCancelling}
              aria-label={
                selectedSubscription?.modelName
                  ? t('pages.subscriptions.cancelSubscriptionForModel', {
                      modelName: selectedSubscription.modelName,
                    })
                  : undefined
              }
            >
              {isCancelling
                ? t('pages.subscriptions.cancelling')
                : t('pages.subscriptions.cancelSubscription')}
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setIsDetailsModalOpen(false);
                // Restore focus to the trigger element
                setTimeout(() => {
                  modalTriggerRef.current?.focus();
                }, 100);
              }}
            >
              {t('pages.subscriptions.close')}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default SubscriptionsPage;

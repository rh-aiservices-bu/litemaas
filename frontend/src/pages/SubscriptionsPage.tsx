import React, { useState, useEffect } from 'react';
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
  Progress,
  ProgressMeasureLocation,
  Spinner,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  Label,
  Alert,
  Bullseye,
  Stack,
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

const SubscriptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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

    return (
      <Badge color={variants[status as keyof typeof variants]}>
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsXs' }}>
          <FlexItem>{icons[status as keyof typeof icons]}</FlexItem>
          <FlexItem>{status.charAt(0).toUpperCase() + status.slice(1)}</FlexItem>
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

    return (
      <Stack hasGutter>
        <Content component={ContentVariants.small}>
          {t('pages.subscriptions.inputPricing', {
            cost: subscription.pricing.inputCostPer1kTokens.toFixed(4),
          })}
        </Content>
        <Content component={ContentVariants.small}>
          {t('pages.subscriptions.outputPricing', {
            cost: subscription.pricing.outputCostPer1kTokens.toFixed(4),
          })}
        </Content>
      </Stack>
    );
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100);
  };

  const getUsageVariant = (percentage: number) => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 75) return 'warning';
    return 'success';
  };

  const handleSubscriptionDetails = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setIsDetailsModalOpen(true);
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
                        {/* 
                        <Content
                          component={ContentVariants.small}
                          style={{ color: 'var(--pf-v6-global--Color--200)' }}
                        >
                          {t('pages.subscriptions.byProvider', { provider: subscription.provider })}
                        </Content>
                         */}
                      </CardTitle>
                      <CardBody>
                        <Flex
                          direction={{ default: 'column' }}
                          spaceItems={{ default: 'spaceItemsSm' }}
                        >
                          <FlexItem>{getPricingInfo(subscription)}</FlexItem>

                          <FlexItem>
                            <Content component={ContentVariants.small}>
                              {t('pages.subscriptions.tokenUsageThisMonth')}
                            </Content>
                            <Progress
                              value={getUsagePercentage(
                                subscription.usedTokens,
                                subscription.quotaTokens,
                              )}
                              title={`${subscription.usedTokens.toLocaleString()} / ${subscription.quotaTokens.toLocaleString()} tokens`}
                              variant={getUsageVariant(
                                getUsagePercentage(
                                  subscription.usedTokens,
                                  subscription.quotaTokens,
                                ),
                              )}
                              measureLocation={ProgressMeasureLocation.outside}
                            />
                          </FlexItem>

                          <FlexItem>
                            <Content component={ContentVariants.small}>
                              {t('pages.subscriptions.quotaFormat', {
                                requests: subscription.quotaRequests.toLocaleString(),
                                tokens: subscription.quotaTokens.toLocaleString(),
                              })}
                            </Content>
                          </FlexItem>
                        </Flex>
                      </CardBody>
                      <CardFooter>
                        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSubscriptionDetails(subscription)}
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
        onClose={() => setIsDetailsModalOpen(false)}
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
            <FlexItem>
              {selectedSubscription && getStatusBadge(selectedSubscription.status)}
            </FlexItem>
          </Flex>
          <Content
            component={ContentVariants.p}
            style={{ color: 'var(--pf-v6-global--Color--200)' }}
          >
            {t('pages.subscriptions.detailsTitle')}
          </Content>
        </ModalHeader>
        <ModalBody>
          {selectedSubscription && (
            <>
              <DescriptionList isHorizontal>
                {/*                 
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.provider')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedSubscription.provider}
                  </DescriptionListDescription>
                </DescriptionListGroup>
 */}
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.pricing')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {getPricingInfo(selectedSubscription)}
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.status')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {getStatusBadge(selectedSubscription.status)}
                  </DescriptionListDescription>
                </DescriptionListGroup>

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
                        />
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
                        />
                      </FlexItem>
                    </Flex>
                  </DescriptionListDescription>
                </DescriptionListGroup>

                <DescriptionListGroup>
                  <DescriptionListTerm>{t('pages.subscriptions.created')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {new Date(selectedSubscription.createdAt).toLocaleDateString()}
                  </DescriptionListDescription>
                </DescriptionListGroup>

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
              variant="danger"
              onClick={() => selectedSubscription && handleCancelSubscription(selectedSubscription)}
              isDisabled={selectedSubscription?.status === 'expired' || isCancelling}
              isLoading={isCancelling}
            >
              {isCancelling
                ? t('pages.subscriptions.cancelling')
                : t('pages.subscriptions.cancelSubscription')}
            </Button>
            <Button variant="link" onClick={() => setIsDetailsModalOpen(false)}>
              {t('pages.subscriptions.close')}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default SubscriptionsPage;

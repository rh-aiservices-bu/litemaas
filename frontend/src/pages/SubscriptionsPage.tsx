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
  Toolbar,
  ToolbarContent,
  ToolbarItem,
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
  FormSelect,
  FormSelectOption,
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
  AlertGroup,
  Bullseye,
} from '@patternfly/react-core';
import { 
  CubesIcon, 
  PlusCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TimesCircleIcon,
  CogIcon
} from '@patternfly/react-icons';
import { useNotifications } from '../contexts/NotificationContext';
import { subscriptionsService, Subscription } from '../services/subscriptions.service';


const SubscriptionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [processingModification, setProcessingModification] = useState(false);

  // Load subscriptions from API
  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await subscriptionsService.getSubscriptions();
      setSubscriptions(response.data);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setError('Failed to load subscriptions. Please try again.');
      addNotification({
        title: 'Error',
        description: 'Failed to load subscriptions from the server.',
        variant: 'danger'
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
      pending: 'info'
    } as const;

    const icons = {
      active: <CheckCircleIcon />,
      suspended: <ExclamationTriangleIcon />,
      expired: <TimesCircleIcon />,
      pending: <Spinner size="sm" />
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

  const getPlanBadge = (plan: string | undefined) => {
    if (!plan) {
      return <Label color="grey">Unknown</Label>;
    }
    
    const colors = {
      starter: 'blue',
      professional: 'green',
      enterprise: 'purple'
    } as const;

    return <Label color={colors[plan as keyof typeof colors]}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</Label>;
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

  const handleModifySubscription = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setNewPlan(subscription.plan);
    setIsModifyModalOpen(true);
  };

  const handleSaveModification = async () => {
    if (!selectedSubscription || newPlan === selectedSubscription.plan) {
      setIsModifyModalOpen(false);
      return;
    }

    setProcessingModification(true);
    
    // Simulate API call
    setTimeout(() => {
      const updatedSubscriptions = subscriptions.map(sub => 
        sub.id === selectedSubscription.id 
          ? { ...sub, plan: newPlan as any }
          : sub
      );
      setSubscriptions(updatedSubscriptions);
      
      addNotification({
        title: 'Subscription Updated',
        description: `${selectedSubscription.modelName} subscription has been updated to ${newPlan} plan.`,
        variant: 'success'
      });
      
      setProcessingModification(false);
      setIsModifyModalOpen(false);
    }, 2000);
  };

  const handleCancelSubscription = (subscription: Subscription) => {
    addNotification({
      title: 'Subscription Cancelled',
      description: `${subscription.modelName} subscription has been cancelled and will expire on ${subscription.nextBillingDate}.`,
      variant: 'warning'
    });
  };

  if (loading) {
    return (
      <>
        <PageSection variant="secondary">
          <Title headingLevel="h1" size="2xl">
            My Subscriptions
          </Title>
        </PageSection>
        <PageSection>
          <Bullseye>
            <EmptyState variant={EmptyStateVariant.lg}>
              <Spinner size="xl" />
              <Title headingLevel="h2" size="lg">
                Loading Subscriptions...
              </Title>
              <EmptyStateBody>
                Retrieving your subscription information
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
              My Subscriptions
            </Title>
            <Content component={ContentVariants.p}>
              Manage your AI model subscriptions and usage
            </Content>
          </FlexItem>
          <FlexItem>
            <Button 
              variant="primary" 
              icon={<PlusCircleIcon />}
              onClick={() => navigate('/models')}
            >
              New Subscription
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>
      
      <PageSection>
        {subscriptions.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <CubesIcon />
            <Title headingLevel="h2" size="lg">
              No subscriptions found
            </Title>
            <EmptyStateBody>
              You don't have any active subscriptions. Start by subscribing to an AI model.
            </EmptyStateBody>
            <EmptyStateActions>
              <Button 
                variant="primary" 
                icon={<PlusCircleIcon />}
                onClick={() => navigate('/models')}
              >
                Browse Models
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (
          <>
            <Grid hasGutter>
              {subscriptions.map((subscription) => {
                const usagePercentage = getUsagePercentage(subscription.usageUsed, subscription.usageLimit);
                
                return (
                  <GridItem key={subscription.id} lg={6} xl={4}>
                    <Card style={{ height: '100%' }}>
                      <CardTitle>
                        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
                          <FlexItem>
                            <Title headingLevel="h3" size="lg">{subscription.modelName}</Title>
                          </FlexItem>
                          <FlexItem>
                            {getStatusBadge(subscription.status)}
                          </FlexItem>
                        </Flex>
                        <Content component={ContentVariants.small} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
                          by {subscription.provider}
                        </Content>
                      </CardTitle>
                      <CardBody>
                        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
                              <FlexItem>{getPlanBadge(subscription.plan)}</FlexItem>
                              <FlexItem>
                                <strong>
                                  ${subscription.costPerMonth}/{subscription.billingCycle === 'monthly' ? 'mo' : 'yr'}
                                </strong>
                              </FlexItem>
                            </Flex>
                          </FlexItem>
                          
                          <FlexItem>
                            <Content component={ContentVariants.small}>Usage this month</Content>
                            <Progress
                              value={usagePercentage}
                              title={`${subscription.usageUsed.toLocaleString()} / ${subscription.usageLimit.toLocaleString()} tokens`}
                              variant={getUsageVariant(usagePercentage)}
                              measureLocation={ProgressMeasureLocation.outside}
                            />
                          </FlexItem>
                          
                          <FlexItem>
                            <Content component={ContentVariants.small}>
                              Next billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}
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
                              View Details
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => handleModifySubscription(subscription)}
                              isDisabled={subscription.status === 'expired'}
                              icon={<CogIcon />}
                            >
                              Modify
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
          <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsMd' }}>
            <FlexItem>
              <Title headingLevel="h2" size="xl">{selectedSubscription?.modelName}</Title>
            </FlexItem>
            <FlexItem>
              {selectedSubscription && getStatusBadge(selectedSubscription.status)}
            </FlexItem>
          </Flex>
          <Content component={ContentVariants.p} style={{ color: 'var(--pf-v6-global--Color--200)' }}>
            Subscription Details
          </Content>
        </ModalHeader>
        <ModalBody>
          {selectedSubscription && (
            <>
              <DescriptionList isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Provider</DescriptionListTerm>
                  <DescriptionListDescription>{selectedSubscription.provider}</DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Plan</DescriptionListTerm>
                  <DescriptionListDescription>
                    {getPlanBadge(selectedSubscription.plan)}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Status</DescriptionListTerm>
                  <DescriptionListDescription>
                    {getStatusBadge(selectedSubscription.status)}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Monthly Cost</DescriptionListTerm>
                  <DescriptionListDescription>
                    ${selectedSubscription.costPerMonth} ({selectedSubscription.billingCycle})
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Usage Limit</DescriptionListTerm>
                  <DescriptionListDescription>
                    {selectedSubscription.usageLimit.toLocaleString()} tokens per month
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Usage This Month</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsXs' }}>
                      <FlexItem>
                        {selectedSubscription.usageUsed.toLocaleString()} / {selectedSubscription.usageLimit.toLocaleString()} tokens
                      </FlexItem>
                      <FlexItem>
                        <Progress
                          value={getUsagePercentage(selectedSubscription.usageUsed, selectedSubscription.usageLimit)}
                          variant={getUsageVariant(getUsagePercentage(selectedSubscription.usageUsed, selectedSubscription.usageLimit))}
                          measureLocation={ProgressMeasureLocation.outside}
                        />
                      </FlexItem>
                    </Flex>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Next Billing Date</DescriptionListTerm>
                  <DescriptionListDescription>
                    {new Date(selectedSubscription.nextBillingDate).toLocaleDateString()}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Created</DescriptionListTerm>
                  <DescriptionListDescription>
                    {new Date(selectedSubscription.createdAt).toLocaleDateString()}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                
                <DescriptionListGroup>
                  <DescriptionListTerm>Features</DescriptionListTerm>
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
                <Alert variant="warning" title="Subscription Suspended" style={{ marginTop: '1rem' }}>
                  Your subscription has been suspended due to usage limit exceeded. Upgrade your plan or wait for the next billing cycle.
                </Alert>
              )}
              
              {selectedSubscription.status === 'expired' && (
                <Alert variant="danger" title="Subscription Expired" style={{ marginTop: '1rem' }}>
                  Your subscription expired on {selectedSubscription.expiresAt && new Date(selectedSubscription.expiresAt).toLocaleDateString()}. Renew to continue using this model.
                </Alert>
              )}
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button
              variant="danger"
              onClick={() => selectedSubscription && handleCancelSubscription(selectedSubscription)}
              isDisabled={selectedSubscription?.status === 'expired'}
            >
              Cancel Subscription
            </Button>
            <Button variant="link" onClick={() => setIsDetailsModalOpen(false)}>
              Close
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Modify Subscription Modal */}
      <Modal
        variant={ModalVariant.small}
        title="Modify Subscription"
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
      >
        <ModalBody>
          {selectedSubscription && (
            <>
              <Content component={ContentVariants.p} style={{ marginBottom: '1rem' }}>
                Modify your subscription plan for <strong>{selectedSubscription.modelName}</strong>
              </Content>
              
              <Form>
                <FormGroup label="Select Plan" fieldId="plan-select">
                  <FormSelect
                    value={newPlan}
                    onChange={(_event, value) => setNewPlan(value)}
                    id="plan-select"
                  >
                    <FormSelectOption value="starter" label="Starter - $20/month" />
                    <FormSelectOption value="professional" label="Professional - $50/month" />
                    <FormSelectOption value="enterprise" label="Enterprise - $100/month" />
                  </FormSelect>
                </FormGroup>
              </Form>
              
              {newPlan !== selectedSubscription.plan && (
                <Alert variant="info" title="Plan Change" style={{ marginTop: '1rem' }}>
                  Your plan will be updated immediately and you'll be charged the prorated amount.
                </Alert>
              )}
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={handleSaveModification}
              isLoading={processingModification}
              isDisabled={newPlan === selectedSubscription?.plan}
            >
              {processingModification ? 'Updating...' : 'Save Changes'}
            </Button>
            <Button variant="link" onClick={() => setIsModifyModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default SubscriptionsPage;

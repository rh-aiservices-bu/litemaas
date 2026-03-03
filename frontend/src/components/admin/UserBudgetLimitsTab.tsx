import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Form,
  FormGroup,
  TextInput,
  FormSelect,
  FormSelectOption,
  Progress,
  ProgressMeasureLocation,
  Button,
  Spinner,
  Alert,
  Content,
  ContentVariants,
  HelperText,
  HelperTextItem,
  Skeleton,
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { usersService } from '../../services/users.service';
import { useNotifications } from '../../contexts/NotificationContext';
import { AdminUserDetails, UserBudgetLimitsUpdate } from '../../types/users';

interface UserBudgetLimitsTabProps {
  userId: string;
  canEdit: boolean;
}

const UserBudgetLimitsTab: React.FC<UserBudgetLimitsTabProps> = ({ userId, canEdit }) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // Fetch user details
  const {
    data: userDetails,
    isLoading,
    error,
  } = useQuery<AdminUserDetails>({
    queryKey: ['admin-user-details', userId],
    queryFn: () => usersService.getAdminUserDetails(userId),
  });

  // Form state
  const [maxBudget, setMaxBudget] = useState<number | undefined>(undefined);
  const [tpmLimit, setTpmLimit] = useState<number | undefined>(undefined);
  const [rpmLimit, setRpmLimit] = useState<number | undefined>(undefined);
  const [budgetDuration, setBudgetDuration] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Initialize form values when data loads
  useEffect(() => {
    if (userDetails) {
      setMaxBudget(userDetails.maxBudget);
      setTpmLimit(userDetails.tpmLimit);
      setRpmLimit(userDetails.rpmLimit);
      setBudgetDuration(userDetails.budgetDuration || '');
    }
  }, [userDetails]);

  // Track changes
  useEffect(() => {
    if (userDetails) {
      const changed =
        maxBudget !== userDetails.maxBudget ||
        tpmLimit !== userDetails.tpmLimit ||
        rpmLimit !== userDetails.rpmLimit ||
        budgetDuration !== (userDetails.budgetDuration || '');
      setHasChanges(changed);
    }
  }, [maxBudget, tpmLimit, rpmLimit, budgetDuration, userDetails]);

  // Mutation for updating budget/limits
  const updateMutation = useMutation({
    mutationFn: (data: UserBudgetLimitsUpdate) => usersService.updateUserBudgetLimits(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-details', userId] });
      addNotification({
        title: t('users.budget.updateSuccess', 'Budget Updated'),
        description: t(
          'users.budget.updateSuccessDesc',
          'User budget and limits have been updated successfully.',
        ),
        variant: 'success',
      });
      setHasChanges(false);
    },
    onError: (err: Error) => {
      addNotification({
        title: t('users.budget.updateError', 'Update Failed'),
        description: err.message,
        variant: 'danger',
      });
    },
  });

  // Mutation for resetting spend
  const resetSpendMutation = useMutation({
    mutationFn: () => usersService.resetUserSpend(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-details', userId] });
      addNotification({
        title: t('users.budget.resetSpendSuccess', 'Spend Reset'),
        description: t('users.budget.resetSpendSuccessDesc', 'User spend has been reset to $0.00.'),
        variant: 'success',
      });
      setIsResetModalOpen(false);
    },
    onError: (err: Error) => {
      addNotification({
        title: t('users.budget.resetSpendError', 'Reset Failed'),
        description: err.message,
        variant: 'danger',
      });
      setIsResetModalOpen(false);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      maxBudget: maxBudget ?? null,
      tpmLimit: tpmLimit ?? null,
      rpmLimit: rpmLimit ?? null,
      budgetDuration: budgetDuration || null,
    });
  };

  // Calculate budget utilization
  const budgetUtilization =
    userDetails?.currentSpend !== undefined && userDetails?.maxBudget
      ? Math.min((userDetails.currentSpend / userDetails.maxBudget) * 100, 100)
      : 0;

  const budgetDurationOptions = [
    {
      value: '',
      label: t('users.budget.budgetDurationNone', 'None (no auto-reset)'),
    },
    { value: 'daily', label: t('users.budget.budgetDurationDaily', 'Daily') },
    { value: 'weekly', label: t('users.budget.budgetDurationWeekly', 'Weekly') },
    { value: 'monthly', label: t('users.budget.budgetDurationMonthly', 'Monthly') },
    { value: 'yearly', label: t('users.budget.budgetDurationYearly', 'Yearly') },
  ];

  if (isLoading) {
    return (
      <div style={{ padding: '1rem' }}>
        <Skeleton height="200px" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" title={t('common.error', 'Error')} isInline>
        {t('users.budget.loadError', 'Failed to load budget information')}
      </Alert>
    );
  }

  return (
    <>
      <Form style={{ paddingTop: '1rem' }}>
        {/* Current Spend with Progress Bar and Reset Button */}
        <FormGroup
          label={t('users.budget.currentSpend', 'Current Spend')}
          fieldId="current-spend"
        >
          <Split hasGutter>
            <SplitItem isFilled>
              <Progress
                value={budgetUtilization}
                measureLocation={ProgressMeasureLocation.outside}
                aria-label={t('users.budget.budgetUtilization', 'Budget utilization')}
                variant={
                  budgetUtilization > 80
                    ? budgetUtilization > 95
                      ? 'danger'
                      : 'warning'
                    : undefined
                }
              />
              <HelperText>
                <HelperTextItem>
                  ${userDetails?.currentSpend?.toFixed(2) || '0.00'} / $
                  {userDetails?.maxBudget?.toFixed(2) || t('users.budget.unlimited', 'Unlimited')}
                </HelperTextItem>
              </HelperText>
            </SplitItem>
            {canEdit && (userDetails?.currentSpend ?? 0) > 0 && (
              <SplitItem>
                <Button
                  variant="secondary"
                  isDanger
                  onClick={() => setIsResetModalOpen(true)}
                  isDisabled={resetSpendMutation.isLoading}
                >
                  {t('users.budget.resetSpend', 'Reset Spend')}
                </Button>
              </SplitItem>
            )}
          </Split>
        </FormGroup>

        {/* Max Budget Input */}
        <FormGroup label={t('users.budget.maxBudget', 'Max Budget')} fieldId="max-budget">
          <TextInput
            id="max-budget"
            type="number"
            value={maxBudget ?? ''}
            onChange={(_event, value) => {
              const parsed = parseFloat(value);
              setMaxBudget(value === '' || isNaN(parsed) ? undefined : parsed);
            }}
            isDisabled={!canEdit || updateMutation.isLoading}
            aria-label={t('users.budget.maxBudget', 'Max Budget')}
          />
          <HelperText>
            <HelperTextItem>
              {t(
                'users.budget.maxBudgetHelp',
                'Maximum spending limit in USD. Leave empty for no limit.',
              )}
            </HelperTextItem>
          </HelperText>
        </FormGroup>

        {/* Budget Duration Dropdown */}
        <FormGroup
          label={t('users.budget.budgetDuration', 'Budget Duration')}
          fieldId="budget-duration"
        >
          <FormSelect
            id="budget-duration"
            value={budgetDuration}
            onChange={(_event, value) => setBudgetDuration(value)}
            isDisabled={!canEdit || updateMutation.isLoading}
            aria-label={t('users.budget.budgetDuration', 'Budget Duration')}
          >
            {budgetDurationOptions.map((option) => (
              <FormSelectOption key={option.value} value={option.value} label={option.label} />
            ))}
          </FormSelect>
          <HelperText>
            <HelperTextItem>
              {t(
                'users.budget.budgetDurationHelp',
                'How often the budget automatically resets.',
              )}
            </HelperTextItem>
          </HelperText>
          {userDetails?.budgetResetAt && budgetDuration && (
            <HelperText>
              <HelperTextItem>
                {t('users.budget.budgetResetAt', 'Next reset: {{date}}', {
                  date: new Date(userDetails.budgetResetAt).toLocaleString(),
                })}
              </HelperTextItem>
            </HelperText>
          )}
        </FormGroup>

        {/* TPM Limit */}
        <FormGroup label={t('users.budget.tpmLimit', 'TPM Limit')} fieldId="tpm-limit">
          <TextInput
            id="tpm-limit"
            type="number"
            value={tpmLimit ?? ''}
            onChange={(_event, value) => {
              const parsed = parseInt(value, 10);
              setTpmLimit(value === '' || isNaN(parsed) ? undefined : parsed);
            }}
            isDisabled={!canEdit || updateMutation.isLoading}
            aria-label={t('users.budget.tpmLimit', 'TPM Limit')}
          />
          <HelperText>
            <HelperTextItem>
              {t('users.budget.tpmLimitHelp', 'Tokens per minute. Leave empty for no limit.')}
            </HelperTextItem>
          </HelperText>
        </FormGroup>

        {/* RPM Limit */}
        <FormGroup label={t('users.budget.rpmLimit', 'RPM Limit')} fieldId="rpm-limit">
          <TextInput
            id="rpm-limit"
            type="number"
            value={rpmLimit ?? ''}
            onChange={(_event, value) => {
              const parsed = parseInt(value, 10);
              setRpmLimit(value === '' || isNaN(parsed) ? undefined : parsed);
            }}
            isDisabled={!canEdit || updateMutation.isLoading}
            aria-label={t('users.budget.rpmLimit', 'RPM Limit')}
          />
          <HelperText>
            <HelperTextItem>
              {t('users.budget.rpmLimitHelp', 'Requests per minute. Leave empty for no limit.')}
            </HelperTextItem>
          </HelperText>
        </FormGroup>

        {/* Save Button */}
        {canEdit && (
          <div style={{ marginTop: '1rem' }}>
            <Button
              variant="primary"
              onClick={handleSave}
              isDisabled={!hasChanges || updateMutation.isLoading}
              isLoading={updateMutation.isLoading}
            >
              {updateMutation.isLoading ? (
                <>
                  <Spinner size="sm" aria-hidden="true" /> {t('ui.actions.saving', 'Saving...')}
                </>
              ) : (
                t('ui.actions.save', 'Save')
              )}
            </Button>
          </div>
        )}

        {!canEdit && (
          <Content
            component={ContentVariants.small}
            style={{ marginTop: '1rem', fontStyle: 'italic' }}
          >
            {t('users.budget.readOnlyNote', 'You have read-only access to these settings.')}
          </Content>
        )}
      </Form>

      {/* Reset Spend Confirmation Modal */}
      <Modal
        variant="small"
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        aria-labelledby="reset-spend-modal-title"
      >
        <ModalHeader
          title={t('users.budget.resetSpendConfirmTitle', 'Reset User Spend')}
          labelId="reset-spend-modal-title"
        />
        <ModalBody>
          {t(
            'users.budget.resetSpendConfirmBody',
            'Are you sure you want to reset the current spend for {{username}} to $0.00? This action cannot be undone.',
            { username: userDetails?.username },
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="danger"
            onClick={() => resetSpendMutation.mutate()}
            isDisabled={resetSpendMutation.isLoading}
            isLoading={resetSpendMutation.isLoading}
          >
            {t('users.budget.resetSpend', 'Reset Spend')}
          </Button>
          <Button
            variant="link"
            onClick={() => setIsResetModalOpen(false)}
            isDisabled={resetSpendMutation.isLoading}
          >
            {t('ui.actions.cancel', 'Cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default UserBudgetLimitsTab;

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Form,
  FormGroup,
  NumberInput,
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
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form values when data loads
  useEffect(() => {
    if (userDetails) {
      setMaxBudget(userDetails.maxBudget);
      setTpmLimit(userDetails.tpmLimit);
      setRpmLimit(userDetails.rpmLimit);
    }
  }, [userDetails]);

  // Track changes
  useEffect(() => {
    if (userDetails) {
      const changed =
        maxBudget !== userDetails.maxBudget ||
        tpmLimit !== userDetails.tpmLimit ||
        rpmLimit !== userDetails.rpmLimit;
      setHasChanges(changed);
    }
  }, [maxBudget, tpmLimit, rpmLimit, userDetails]);

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

  const handleSave = () => {
    updateMutation.mutate({
      maxBudget,
      tpmLimit,
      rpmLimit,
    });
  };

  // Calculate budget utilization
  const budgetUtilization =
    userDetails?.currentSpend !== undefined && userDetails?.maxBudget
      ? Math.min((userDetails.currentSpend / userDetails.maxBudget) * 100, 100)
      : 0;

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
    <Form style={{ paddingTop: '1rem' }}>
      {/* Current Spend with Progress Bar */}
      <FormGroup label={t('users.budget.currentSpend', 'Current Spend')} fieldId="current-spend">
        <Progress
          value={budgetUtilization}
          measureLocation={ProgressMeasureLocation.outside}
          aria-label={t('users.budget.budgetUtilization', 'Budget utilization')}
          variant={
            budgetUtilization > 80 ? (budgetUtilization > 95 ? 'danger' : 'warning') : undefined
          }
        />
        <HelperText>
          <HelperTextItem>
            ${userDetails?.currentSpend?.toFixed(2) || '0.00'} / $
            {userDetails?.maxBudget?.toFixed(2) || t('users.budget.unlimited', 'Unlimited')}
          </HelperTextItem>
        </HelperText>
      </FormGroup>

      {/* Max Budget Input */}
      <FormGroup label={t('users.budget.maxBudget', 'Max Budget')} fieldId="max-budget">
        <NumberInput
          id="max-budget"
          value={maxBudget ?? 0}
          min={0}
          onMinus={() => setMaxBudget((prev) => Math.max(0, (prev || 0) - 10))}
          onPlus={() => setMaxBudget((prev) => (prev || 0) + 10)}
          onChange={(event) => {
            const target = event.target as HTMLInputElement;
            const value = parseFloat(target.value);
            setMaxBudget(isNaN(value) ? undefined : value);
          }}
          isDisabled={!canEdit || updateMutation.isLoading}
          aria-label={t('users.budget.maxBudget', 'Max Budget')}
          widthChars={10}
        />
        <HelperText>
          <HelperTextItem>
            {t(
              'users.budget.maxBudgetHelp',
              'Maximum spending limit in USD. Set to 0 for unlimited.',
            )}
          </HelperTextItem>
        </HelperText>
      </FormGroup>

      {/* TPM Limit */}
      <FormGroup label={t('users.budget.tpmLimit', 'TPM Limit')} fieldId="tpm-limit">
        <NumberInput
          id="tpm-limit"
          value={tpmLimit ?? 0}
          min={0}
          onMinus={() => setTpmLimit((prev) => Math.max(0, (prev || 0) - 1000))}
          onPlus={() => setTpmLimit((prev) => (prev || 0) + 1000)}
          onChange={(event) => {
            const target = event.target as HTMLInputElement;
            const value = parseInt(target.value, 10);
            setTpmLimit(isNaN(value) ? undefined : value);
          }}
          isDisabled={!canEdit || updateMutation.isLoading}
          aria-label={t('users.budget.tpmLimit', 'TPM Limit')}
          widthChars={12}
        />
        <HelperText>
          <HelperTextItem>
            {t('users.budget.tpmLimitHelp', 'Tokens per minute. Set to 0 for unlimited.')}
          </HelperTextItem>
        </HelperText>
      </FormGroup>

      {/* RPM Limit */}
      <FormGroup label={t('users.budget.rpmLimit', 'RPM Limit')} fieldId="rpm-limit">
        <NumberInput
          id="rpm-limit"
          value={rpmLimit ?? 0}
          min={0}
          onMinus={() => setRpmLimit((prev) => Math.max(0, (prev || 0) - 10))}
          onPlus={() => setRpmLimit((prev) => (prev || 0) + 10)}
          onChange={(event) => {
            const target = event.target as HTMLInputElement;
            const value = parseInt(target.value, 10);
            setRpmLimit(isNaN(value) ? undefined : value);
          }}
          isDisabled={!canEdit || updateMutation.isLoading}
          aria-label={t('users.budget.rpmLimit', 'RPM Limit')}
          widthChars={10}
        />
        <HelperText>
          <HelperTextItem>
            {t('users.budget.rpmLimitHelp', 'Requests per minute. Set to 0 for unlimited.')}
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
  );
};

export default UserBudgetLimitsTab;

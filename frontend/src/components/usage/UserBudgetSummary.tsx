import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import {
  Card,
  CardBody,
  CardTitle,
  Progress,
  ProgressMeasureLocation,
  Skeleton,
  Alert,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  Icon,
} from '@patternfly/react-core';
import { WalletIcon } from '@patternfly/react-icons';
import { usageService } from '../../services/usage.service';
import { usersService } from '../../services/users.service';
import type { UserBudgetInfo } from '../../types/users';

interface UserBudgetSummaryProps {
  userId: string;
  isAdminView?: boolean;
  username?: string;
}

const budgetDurationKeyMap: Record<string, string> = {
  daily: 'users.budget.budgetDurationDaily',
  weekly: 'users.budget.budgetDurationWeekly',
  monthly: 'users.budget.budgetDurationMonthly',
  yearly: 'users.budget.budgetDurationYearly',
};

const budgetDurationFallback: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export const UserBudgetSummary: React.FC<UserBudgetSummaryProps> = ({
  userId,
  isAdminView = false,
  username,
}) => {
  const { t } = useTranslation();

  // User view: fetch from /usage/budget
  const userBudgetQuery = useQuery<UserBudgetInfo>(
    ['user-budget-info'],
    () => usageService.getBudgetInfo(),
    {
      enabled: !isAdminView,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  // Admin view: reuse existing admin-user-details query
  const adminDetailsQuery = useQuery(
    ['admin-user-details', userId],
    () => usersService.getAdminUserDetails(userId),
    {
      enabled: isAdminView && !!userId,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const isLoading = isAdminView ? adminDetailsQuery.isLoading : userBudgetQuery.isLoading;
  const error = isAdminView ? adminDetailsQuery.error : userBudgetQuery.error;

  // Normalize data from both sources
  const budgetData: UserBudgetInfo | undefined = isAdminView
    ? adminDetailsQuery.data
      ? {
          maxBudget: adminDetailsQuery.data.maxBudget,
          currentSpend: adminDetailsQuery.data.currentSpend ?? 0,
          budgetDuration: adminDetailsQuery.data.budgetDuration,
          budgetResetAt: adminDetailsQuery.data.budgetResetAt,
        }
      : undefined
    : userBudgetQuery.data;

  const displayName = isAdminView ? username || adminDetailsQuery.data?.username : undefined;

  if (isLoading) {
    return (
      <Card isCompact style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
        <CardBody>
          <Skeleton height="60px" />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert
        variant="warning"
        title={t('users.budget.loadError', 'Failed to load budget information')}
        isInline
        isPlain
        style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}
      />
    );
  }

  if (!budgetData) {
    return null;
  }

  const { maxBudget, currentSpend, budgetDuration, budgetResetAt } = budgetData;

  const budgetUtilization = maxBudget ? Math.min((currentSpend / maxBudget) * 100, 100) : 0;

  const progressVariant =
    budgetUtilization > 95 ? 'danger' : budgetUtilization > 80 ? 'warning' : undefined;

  const periodLabel =
    budgetDuration && budgetDurationKeyMap[budgetDuration]
      ? t(budgetDurationKeyMap[budgetDuration], budgetDurationFallback[budgetDuration])
      : budgetDuration || undefined;

  const spendText = `$${currentSpend.toFixed(2)} / ${maxBudget != null ? `$${maxBudget.toFixed(2)}` : t('users.budget.unlimited', 'Unlimited')}`;

  const cardTitle = displayName
    ? t('usage.budgetSummary.titleForUser', 'Budget (User) — {{username}}', { username: displayName })
    : t('usage.budgetSummary.title', 'Budget (User)');

  return (
    <Card isCompact style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
      <CardTitle>
        <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
          <FlexItem>
            <Icon size="md">
              <WalletIcon />
            </Icon>
          </FlexItem>
          <FlexItem>{cardTitle}</FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        <Flex direction={{ default: 'column' }} gap={{ default: 'gapSm' }}>
          {maxBudget != null && (
            <FlexItem>
              <Progress
                value={budgetUtilization}
                measureLocation={ProgressMeasureLocation.outside}
                aria-label={t('users.budget.budgetUtilization', 'Budget utilization')}
                variant={progressVariant}
              />
            </FlexItem>
          )}
          <FlexItem>
            <Flex gap={{ default: 'gapLg' }}>
              <FlexItem>
                <Content component={ContentVariants.small}>{spendText}</Content>
              </FlexItem>
              {periodLabel && (
                <FlexItem>
                  <Content component={ContentVariants.small}>
                    {t('usage.budgetSummary.period', 'Period: {{period}}', { period: periodLabel })}
                  </Content>
                </FlexItem>
              )}
              {budgetResetAt && budgetDuration && (
                <FlexItem>
                  <Content component={ContentVariants.small}>
                    {t('users.budget.budgetResetAt', 'Next reset: {{date}}', {
                      date: new Date(budgetResetAt).toLocaleString(),
                    })}
                  </Content>
                </FlexItem>
              )}
            </Flex>
          </FlexItem>
        </Flex>
      </CardBody>
    </Card>
  );
};

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import {
  Label,
  Skeleton,
  Alert,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { CubesIcon } from '@patternfly/react-icons';
import { usersService } from '../../services/users.service';

interface UserSubscriptionsTabProps {
  userId: string;
}

const UserSubscriptionsTab: React.FC<UserSubscriptionsTabProps> = ({ userId }) => {
  const { t } = useTranslation();

  // Fetch subscriptions
  const {
    data: subscriptionsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-user-subscriptions', userId],
    queryFn: () => usersService.getUserSubscriptions(userId),
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string): 'green' | 'orange' | 'red' | 'grey' => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'green';
      case 'pending':
        return 'orange';
      case 'denied':
      case 'revoked':
      case 'suspended':
        return 'red';
      default:
        return 'grey';
    }
  };

  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      active: t('status.active', 'Active'),
      pending: t('status.pending', 'Pending'),
      denied: t('status.denied', 'Denied'),
      revoked: t('status.revoked', 'Revoked'),
      suspended: t('status.suspended', 'Suspended'),
    };
    return statusLabels[status.toLowerCase()] || status;
  };

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
        {t('users.subscriptions.loadError', 'Failed to load subscriptions')}
      </Alert>
    );
  }

  const subscriptions = subscriptionsResponse?.data || [];

  if (subscriptions.length === 0) {
    return (
      <EmptyState variant={EmptyStateVariant.sm}>
        <CubesIcon
          style={{
            fontSize: 'var(--pf-t--global--font--size--3xl)',
            color: 'var(--pf-t--global--color--nonstatus--gray--default)',
          }}
        />
        <Title headingLevel="h4" size="lg">
          {t('users.subscriptions.noSubscriptions', 'No Subscriptions')}
        </Title>
        <EmptyStateBody>
          {t('users.subscriptions.noSubscriptionsDesc', 'This user has no subscriptions.')}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div style={{ paddingTop: '1rem' }}>
      <Table aria-label={t('users.subscriptions.tableLabel', 'User Subscriptions')}>
        <Thead>
          <Tr>
            <Th>{t('users.subscriptions.model', 'Model')}</Th>
            <Th>{t('users.subscriptions.provider', 'Provider')}</Th>
            <Th>{t('users.subscriptions.status', 'Status')}</Th>
            <Th>{t('users.subscriptions.createdAt', 'Created')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {subscriptions.map((sub) => (
            <Tr key={sub.id}>
              <Td dataLabel={t('users.subscriptions.model', 'Model')}>
                <strong>{sub.modelName}</strong>
              </Td>
              <Td dataLabel={t('users.subscriptions.provider', 'Provider')}>
                {sub.provider || '-'}
              </Td>
              <Td dataLabel={t('users.subscriptions.status', 'Status')}>
                <Label color={getStatusColor(sub.status)}>{getStatusLabel(sub.status)}</Label>
                {sub.statusReason && (
                  <div
                    style={{
                      marginTop: '0.25rem',
                      fontSize: 'var(--pf-t--global--font--size--sm)',
                      color: 'var(--pf-t--global--text--color--subtle)',
                    }}
                  >
                    {sub.statusReason}
                  </div>
                )}
              </Td>
              <Td dataLabel={t('users.subscriptions.createdAt', 'Created')}>
                {formatDate(sub.createdAt)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
};

export default UserSubscriptionsTab;

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardTitle,
  CardBody,
  Title,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Skeleton,
  Button,
} from '@patternfly/react-core';
import { DownloadIcon, ExpandIcon } from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { MenuToggle } from '@patternfly/react-core';
import { format } from 'date-fns';
import { formatNumber, formatCurrency } from '../../utils/formatters';
import { useNotifications } from '../../contexts/NotificationContext';

/**
 * User summary for top users
 */
export interface UserSummary {
  userId: string;
  username: string;
  email: string;
  requests: number;
  tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
}

/**
 * Props for the TopUsersTable component
 */
export interface TopUsersTableProps {
  /** Top users data */
  topUsers: UserSummary[];
  /** Loading state */
  loading?: boolean;
  /** Callback when expand button is clicked */
  onExpand?: () => void;
}

/**
 * TopUsersTable Component
 *
 * Displays top users by requests/cost with export functionality.
 * Admin-only component showing top users across the platform.
 *
 * @component
 * @example
 * ```tsx
 * <TopUsersTable
 *   topUsers={topUsers}
 *   loading={false}
 * />
 * ```
 */
export const TopUsersTable: React.FC<TopUsersTableProps> = ({
  topUsers,
  loading = false,
  onExpand,
}) => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  /**
   * Export top users data as CSV
   */
  const handleExport = () => {
    try {
      // CSV header
      const headers = [
        t('adminUsage.topUsers.csvHeaders.username'),
        t('adminUsage.topUsers.csvHeaders.email'),
        t('adminUsage.topUsers.csvHeaders.requests'),
        t('adminUsage.topUsers.csvHeaders.tokens'),
        t('adminUsage.topUsers.csvHeaders.inputTokens'),
        t('adminUsage.topUsers.csvHeaders.outputTokens'),
        t('adminUsage.topUsers.csvHeaders.costUsd'),
      ];

      // CSV rows - use actual values not formatted ones
      const rows = topUsers
        .slice(0, 5)
        .map((user) => [
          `"${user.username}"`,
          `"${user.email}"`,
          user.requests.toString(),
          user.tokens.toString(),
          user.prompt_tokens.toString(),
          user.completion_tokens.toString(),
          user.cost.toFixed(2),
        ]);

      // Combine headers and rows
      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `top-users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.setAttribute(
        'aria-label',
        t('adminUsage.topUsers.exportAriaLabel', 'Download top users CSV file'),
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success notification
      addNotification({
        title: t('adminUsage.topUsers.exportSuccess', 'Export successful'),
        description: t(
          'adminUsage.topUsers.exportSuccessDescription',
          'Top users data has been downloaded successfully.',
        ),
        variant: 'success',
      });
    } catch (error) {
      addNotification({
        title: t('adminUsage.errors.export', 'Export failed'),
        description: t('adminUsage.errors.exportDescription', 'Failed to export top users data.'),
        variant: 'danger',
      });
    }
  };

  if (loading) {
    return (
      <Card isFullHeight>
        <CardTitle>
          <Title headingLevel="h3" size="lg">
            {t('adminUsage.charts.topUsers')}
          </Title>
        </CardTitle>
        <CardBody>
          <Skeleton height="200px" />
        </CardBody>
      </Card>
    );
  }

  if (!topUsers || topUsers.length === 0) {
    return (
      <Card isFullHeight>
        <CardTitle>
          <Title headingLevel="h3" size="lg">
            {t('adminUsage.charts.topUsers')}
          </Title>
        </CardTitle>
        <CardBody>
          <Content
            component={ContentVariants.small}
            style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
          >
            {t('adminUsage.charts.noDataAvailable')}
          </Content>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card isFullHeight>
      <CardTitle>
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          <FlexItem>
            <Title headingLevel="h3" size="lg">
              {t('adminUsage.charts.topUsers')}
            </Title>
          </FlexItem>
          <FlexItem>
            <Flex spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Button
                  variant="secondary"
                  icon={<DownloadIcon />}
                  onClick={handleExport}
                  aria-label={t('adminUsage.topUsers.export', 'Export top users')}
                >
                  {t('adminUsage.topUsers.export', 'Export')}
                </Button>
              </FlexItem>
              {onExpand && (
                <FlexItem>
                  <MenuToggle
                    variant="plain"
                    onClick={onExpand}
                    aria-label={t('common.expandToFullScreen', 'Expand to full screen')}
                    icon={<ExpandIcon />}
                  />
                </FlexItem>
              )}
            </Flex>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Table
            aria-label={t('adminUsage.tables.topUsers')}
            variant="compact"
            style={{ minWidth: 'min-content' }}
          >
            <Thead>
              <Tr>
                <Th style={{ whiteSpace: 'normal', padding: '8px', textAlign: 'left' }}>
                  {t('adminUsage.tableHeaders.user')}
                </Th>
                <Th style={{ whiteSpace: 'normal', padding: '8px', textAlign: 'center' }}>
                  {t('adminUsage.tableHeaders.requests')}
                </Th>
                <Th style={{ whiteSpace: 'normal', padding: '8px', textAlign: 'center' }}>
                  {t('adminUsage.tableHeaders.tokens')}
                </Th>
                <Th style={{ whiteSpace: 'normal', padding: '8px', textAlign: 'center' }}>
                  {t('adminUsage.tableHeaders.promptTokens')}
                </Th>
                <Th style={{ whiteSpace: 'normal', padding: '8px', textAlign: 'center' }}>
                  {t('adminUsage.tableHeaders.completionTokens')}
                </Th>
                <Th style={{ whiteSpace: 'normal', padding: '8px', textAlign: 'center' }}>
                  {t('adminUsage.tableHeaders.cost')}
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {topUsers.slice(0, 5).map((user, index) => (
                <Tr key={user.userId || index}>
                  <Th scope="row" style={{ padding: '8px', textAlign: 'left' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{user.username}</div>
                      <div
                        style={{
                          fontSize: 'var(--pf-t--global--font--size--sm)',
                          color: 'var(--pf-t--global--text--color--subtle)',
                        }}
                      >
                        {user.email}
                      </div>
                    </div>
                  </Th>
                  <Td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatNumber(user.requests)}
                  </Td>
                  <Td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatNumber(user.tokens)}
                  </Td>
                  <Td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatNumber(user.prompt_tokens)}
                  </Td>
                  <Td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatNumber(user.completion_tokens)}
                  </Td>
                  <Td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatCurrency(user.cost)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </CardBody>
    </Card>
  );
};

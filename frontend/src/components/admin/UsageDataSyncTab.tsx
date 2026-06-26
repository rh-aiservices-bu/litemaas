import React, { useState } from 'react';
import { useQueryClient } from 'react-query';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardTitle,
  Button,
  Alert,
  Flex,
  FlexItem,
  FormGroup,
  DatePicker,
  Spinner,
  Content,
  ContentVariants,
  Tooltip,
} from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { adminUsageService } from '../../services/adminUsage.service';
import { extractErrorDetails } from '../../utils/error.utils';

interface UsageDataSyncTabProps {
  canManage: boolean;
}

const UsageDataSyncTab: React.FC<UsageDataSyncTabProps> = ({ canManage }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    daysProcessed?: number;
    daysTotal?: number;
  } | null>(null);

  const isValid = startDate && endDate && startDate <= endDate;

  const handleResync = async () => {
    if (!isValid || !canManage) return;

    setIsSyncing(true);
    setResult(null);

    try {
      const response = await adminUsageService.resyncDateRange(startDate, endDate);
      setResult({
        success: true,
        message: t('pages.tools.usageSync.notifications.success', {
          processed: response.daysProcessed,
          total: response.daysTotal,
        }),
        daysProcessed: response.daysProcessed,
        daysTotal: response.daysTotal,
      });
      addNotification({
        variant: 'success',
        title: t('pages.tools.usageSync.notifications.successTitle'),
        description: t('pages.tools.usageSync.notifications.success', {
          processed: response.daysProcessed,
          total: response.daysTotal,
        }),
      });
      queryClient.invalidateQueries(['adminMetrics']);
    } catch (error) {
      const errorDetails = extractErrorDetails(error);
      setResult({
        success: false,
        message: errorDetails.message,
      });
      addNotification({
        variant: 'danger',
        title: t('pages.tools.usageSync.notifications.errorTitle'),
        description: errorDetails.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartDateChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    setStartDate(value);
    setResult(null);
  };

  const handleEndDateChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    setEndDate(value);
    setResult(null);
  };

  const resyncButton = (
    <Button
      variant="primary"
      icon={isSyncing ? <Spinner size="md" /> : <SyncAltIcon />}
      onClick={handleResync}
      isDisabled={!canManage || !isValid || isSyncing}
      isLoading={isSyncing}
    >
      {isSyncing ? t('pages.tools.usageSync.syncing') : t('pages.tools.usageSync.resyncButton')}
    </Button>
  );

  return (
    <Card>
      <CardTitle>{t('pages.tools.usageSync.title')}</CardTitle>
      <CardBody>
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsMd' }}>
          <FlexItem>
            <Content component={ContentVariants.p}>
              {t('pages.tools.usageSync.description')}
            </Content>
          </FlexItem>

          {result && (
            <FlexItem>
              <Alert
                variant={result.success ? 'success' : 'danger'}
                title={
                  result.success
                    ? t('pages.tools.usageSync.notifications.successTitle')
                    : t('pages.tools.usageSync.notifications.errorTitle')
                }
                isInline
              >
                {result.message}
              </Alert>
            </FlexItem>
          )}

          <FlexItem>
            <Flex
              spaceItems={{ default: 'spaceItemsMd' }}
              alignItems={{ default: 'alignItemsFlexEnd' }}
            >
              <FlexItem>
                <FormGroup label={t('pages.tools.usageSync.startDate')} fieldId="resync-start-date">
                  <DatePicker
                    value={startDate}
                    onChange={handleStartDateChange}
                    aria-label={t('pages.tools.usageSync.startDate')}
                    isDisabled={isSyncing}
                    appendTo={document.body}
                  />
                </FormGroup>
              </FlexItem>
              <FlexItem>
                <FormGroup label={t('pages.tools.usageSync.endDate')} fieldId="resync-end-date">
                  <DatePicker
                    value={endDate}
                    onChange={handleEndDateChange}
                    aria-label={t('pages.tools.usageSync.endDate')}
                    isDisabled={isSyncing}
                    appendTo={document.body}
                  />
                </FormGroup>
              </FlexItem>
              <FlexItem>
                {canManage ? (
                  resyncButton
                ) : (
                  <Tooltip content={t('pages.tools.usageSync.adminRequired')}>
                    {resyncButton}
                  </Tooltip>
                )}
              </FlexItem>
            </Flex>
          </FlexItem>

          {startDate && endDate && startDate > endDate && (
            <FlexItem>
              <Alert
                variant="warning"
                title={t('pages.tools.usageSync.invalidRange')}
                isInline
                isPlain
              />
            </FlexItem>
          )}
        </Flex>
      </CardBody>
    </Card>
  );
};

export default UsageDataSyncTab;

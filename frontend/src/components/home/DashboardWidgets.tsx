import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import {
  Card,
  CardBody,
  CardTitle,
  Grid,
  GridItem,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  Button,
  Tooltip,
  Icon,
} from '@patternfly/react-core';
import { LinkIcon, CopyIcon, HashtagIcon, ImportIcon, ExportIcon } from '@patternfly/react-icons';
import { subDays, format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { usageService } from '../../services/usage.service';
import { UserBudgetSummary } from '../usage/UserBudgetSummary';
import { MetricCard } from '../usage/metrics';
import { formatNumber } from '../../utils/formatters';

const DashboardWidgets: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { config } = useConfig();
  const { addNotification } = useNotifications();

  const baseUrl = config?.litellmApiUrl || 'https://api.litemaas.com';
  const endpointUrl = baseUrl.replace(/\/+$/, '') + '/v1';

  const today = new Date();
  const sevenDaysAgo = subDays(today, 6);
  const filters = {
    startDate: format(sevenDaysAgo, 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  };

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery(
    ['home-token-consumption', filters.startDate, filters.endDate],
    () => usageService.getAnalytics(filters),
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const totalTokens = analyticsData?.totalTokens?.total ?? 0;
  const promptTokens = analyticsData?.totalTokens?.prompt ?? 0;
  const completionTokens = analyticsData?.totalTokens?.completion ?? 0;

  const totalTokensTrend = analyticsData?.trends?.totalTokensTrend;
  const promptTokensTrend = analyticsData?.trends?.promptTokensTrend;
  const completionTokensTrend = analyticsData?.trends?.completionTokensTrend;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(endpointUrl);
    addNotification({
      title: t('pages.home.dashboard.endpointCopied'),
      description: t('pages.home.dashboard.endpointCopiedDescription'),
      variant: 'info',
    });
  };

  return (
    <Grid hasGutter>
      {/* Row 1: Budget + Endpoint URL */}
      <GridItem lg={6} md={6} sm={12}>
        {user && <UserBudgetSummary userId={user.id} showNoBudgetMessage isFullHeight />}
      </GridItem>
      <GridItem lg={6} md={6} sm={12}>
        <Card isCompact isFullHeight style={{ marginBottom: 'var(--pf-t--global--spacer--md)' }}>
          <CardTitle>
            <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
              <FlexItem>
                <Icon size="md">
                  <LinkIcon />
                </Icon>
              </FlexItem>
              <FlexItem>{t('pages.home.dashboard.endpointTitle')}</FlexItem>
            </Flex>
          </CardTitle>
          <CardBody>
            <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
              <FlexItem grow={{ default: 'grow' }}>
                <Content
                  component={ContentVariants.p}
                  style={{
                    fontFamily: 'var(--pf-t--global--font--family--mono)',
                    fontSize: 'var(--pf-t--global--font--size--sm)',
                    wordBreak: 'break-all',
                  }}
                >
                  {endpointUrl}
                </Content>
              </FlexItem>
              <FlexItem>
                <Tooltip content={t('pages.home.dashboard.copyEndpoint')}>
                  <Button
                    variant="plain"
                    size="sm"
                    onClick={copyToClipboard}
                    aria-label={t('pages.home.dashboard.copyEndpoint')}
                    icon={<CopyIcon />}
                  />
                </Tooltip>
              </FlexItem>
            </Flex>
            <Content
              component={ContentVariants.small}
              style={{
                color: 'var(--pf-t--global--text--color--subtle)',
                marginTop: 'var(--pf-t--global--spacer--xs)',
              }}
            >
              {t('pages.home.dashboard.endpointDescription')}
            </Content>
          </CardBody>
        </Card>
      </GridItem>

      {/* Row 2: Token Consumption (3 MetricCards) */}
      <GridItem lg={4} md={4} sm={12}>
        <MetricCard
          title={t('pages.home.dashboard.totalTokens')}
          value={formatNumber(totalTokens)}
          icon={<HashtagIcon />}
          subtitle={t('pages.home.dashboard.tokenSubtitle')}
          trend={totalTokensTrend}
          size="compact"
          loading={analyticsLoading}
          ariaLabel={t('pages.home.dashboard.totalTokensAriaLabel', { count: totalTokens })}
        />
      </GridItem>
      <GridItem lg={4} md={4} sm={12}>
        <MetricCard
          title={t('pages.home.dashboard.promptTokens')}
          value={formatNumber(promptTokens)}
          icon={<ImportIcon />}
          subtitle={t('pages.home.dashboard.tokenSubtitle')}
          trend={promptTokensTrend}
          size="compact"
          loading={analyticsLoading}
          ariaLabel={t('pages.home.dashboard.promptTokensAriaLabel', { count: promptTokens })}
        />
      </GridItem>
      <GridItem lg={4} md={4} sm={12}>
        <MetricCard
          title={t('pages.home.dashboard.completionTokens')}
          value={formatNumber(completionTokens)}
          icon={<ExportIcon />}
          subtitle={t('pages.home.dashboard.tokenSubtitle')}
          trend={completionTokensTrend}
          size="compact"
          loading={analyticsLoading}
          ariaLabel={t('pages.home.dashboard.completionTokensAriaLabel', {
            count: completionTokens,
          })}
        />
      </GridItem>
    </Grid>
  );
};

export default DashboardWidgets;

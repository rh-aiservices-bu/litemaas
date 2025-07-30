import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  Grid,
  GridItem,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  Button,
} from '@patternfly/react-core';
import { CatalogIcon, KeyIcon, ChartLineIcon, CubesIcon } from '@patternfly/react-icons';
import { useNotifications } from '../contexts/NotificationContext';

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  const handleDemoNotification = () => {
    addNotification({
      title: t('pages.home.demoNotification.title'),
      description: t('pages.home.demoNotification.description'),
      variant: 'success',
      actions: [
        {
          label: t('pages.home.demoNotification.viewTutorial'),
          onClick: () => console.log('Tutorial clicked'),
        },
      ],
    });
  };

  return (
    <>
      <PageSection variant="secondary">
        <Content>
          <Title headingLevel="h1" size="2xl">
            {t('pages.home.title')}
          </Title>
          <Content component={ContentVariants.p}>{t('pages.home.subtitle')}</Content>
          <Button variant="primary" onClick={handleDemoNotification} style={{ marginTop: '1rem' }}>
            {t('pages.home.demoNotificationButton')}
          </Button>
        </Content>
      </PageSection>
      <PageSection>
        <Grid hasGutter>
          <GridItem span={12} md={6} lg={3}>
            <Card isCompact>
              <CardBody>
                <Flex
                  direction={{ default: 'column' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <CatalogIcon style={{ fontSize: '2rem' }} />
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h3" size="md">
                      {t('nav.models')}
                    </Title>
                  </FlexItem>
                  <FlexItem>
                    <Content>{t('pages.home.cards.modelsDescription')}</Content>
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
          <GridItem span={12} md={6} lg={3}>
            <Card isCompact>
              <CardBody>
                <Flex
                  direction={{ default: 'column' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <CubesIcon style={{ fontSize: '2rem' }} />
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h3" size="md">
                      {t('nav.subscriptions')}
                    </Title>
                  </FlexItem>
                  <FlexItem>
                    <Content>{t('pages.home.cards.subscriptionsDescription')}</Content>
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
          <GridItem span={12} md={6} lg={3}>
            <Card isCompact>
              <CardBody>
                <Flex
                  direction={{ default: 'column' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <KeyIcon style={{ fontSize: '2rem' }} />
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h3" size="md">
                      {t('nav.apiKeys')}
                    </Title>
                  </FlexItem>
                  <FlexItem>
                    <Content>{t('pages.home.cards.apiKeysDescription')}</Content>
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
          <GridItem span={12} md={6} lg={3}>
            <Card isCompact>
              <CardBody>
                <Flex
                  direction={{ default: 'column' }}
                  alignItems={{ default: 'alignItemsCenter' }}
                >
                  <FlexItem>
                    <ChartLineIcon style={{ fontSize: '2rem' }} />
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h3" size="md">
                      {t('nav.usage')}
                    </Title>
                  </FlexItem>
                  <FlexItem>
                    <Content>{t('pages.home.cards.usageDescription')}</Content>
                  </FlexItem>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>
    </>
  );
};

export default HomePage;

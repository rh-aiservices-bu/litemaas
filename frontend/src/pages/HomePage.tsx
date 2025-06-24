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
      title: 'Welcome to LiteMaaS!',
      description: 'This is a demo notification to showcase the notification system.',
      variant: 'success',
      actions: [
        {
          label: 'View Tutorial',
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
            Demo Notification
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
                    <Content>Browse available AI models</Content>
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
                    <Content>Manage your model subscriptions</Content>
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
                    <Content>Generate and manage API keys</Content>
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
                    <Content>Monitor your API usage</Content>
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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
} from '@patternfly/react-core';
import { CatalogIcon, KeyIcon, ChartLineIcon, CubesIcon } from '@patternfly/react-icons';

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const cardStyle = {
    border: '1px solid #8a8d90',
    cursor: 'pointer',
  };

  return (
    <>
      <PageSection variant="secondary">
        <Content>
          <Title headingLevel="h1" size="2xl">
            {t('pages.home.title')}
          </Title>
          <Content component={ContentVariants.p}>{t('pages.home.subtitle')}</Content>
        </Content>
      </PageSection>
      <PageSection>
        <Grid hasGutter>
          <GridItem span={12} md={6} lg={3}>
            <Card isCompact isClickable onClick={() => navigate('/models')} style={cardStyle}>
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
            <Card isCompact isClickable onClick={() => navigate('/subscriptions')} style={cardStyle}>
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
            <Card isCompact isClickable onClick={() => navigate('/api-keys')} style={cardStyle}>
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
            <Card isCompact isClickable onClick={() => navigate('/usage')} style={cardStyle}>
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

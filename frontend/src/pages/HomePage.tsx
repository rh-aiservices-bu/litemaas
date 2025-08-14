import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageSection,
  Title,
  Card,
  CardBody,
  Flex,
  FlexItem,
  Content,
  ContentVariants,
  CardHeader,
} from '@patternfly/react-core';
import {
  CatalogIcon,
  KeyIcon,
  ChartLineIcon,
  CubesIcon,
  CommentsIcon,
} from '@patternfly/react-icons';

const HomePage: React.FC = () => {
  const { t } = useTranslation();

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
        <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsLg' }}>
          {/* First Row - 3 cards */}
          <FlexItem>
            <Flex
              justifyContent={{ default: 'justifyContentCenter' }}
              spaceItems={{ default: 'spaceItemsMd' }}
            >
              <FlexItem style={{ maxWidth: '300px', minWidth: '250px' }}>
                <Card isCompact isClickable style={{ height: '100%' }}>
                  <CardHeader
                    selectableActions={{
                      to: '/models',
                      selectableActionAriaLabel: t('pages.home.cards.modelsAriaLabel'),
                    }}
                  ></CardHeader>
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
              </FlexItem>
              <FlexItem style={{ maxWidth: '300px', minWidth: '250px' }}>
                <Card isCompact isClickable style={{ height: '100%' }}>
                  <CardHeader
                    selectableActions={{
                      to: '/subscriptions',
                      selectableActionAriaLabel: t('pages.home.cards.subscriptionsAriaLabel'),
                    }}
                  ></CardHeader>
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
              </FlexItem>
              <FlexItem style={{ maxWidth: '300px', minWidth: '250px' }}>
                <Card isCompact isClickable style={{ height: '100%' }}>
                  <CardHeader
                    selectableActions={{
                      to: '/api-keys',
                      selectableActionAriaLabel: t('pages.home.cards.apiKeysAriaLabel'),
                    }}
                  ></CardHeader>
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
              </FlexItem>
            </Flex>
          </FlexItem>

          {/* Second Row - 2 cards centered */}
          <FlexItem>
            <Flex
              justifyContent={{ default: 'justifyContentCenter' }}
              spaceItems={{ default: 'spaceItemsMd' }}
            >
              <FlexItem style={{ maxWidth: '300px', minWidth: '250px' }}>
                <Card isCompact isClickable style={{ height: '100%' }}>
                  <CardHeader
                    selectableActions={{
                      to: '/chatbot',
                      selectableActionAriaLabel: t('pages.home.cards.chatbotAriaLabel'),
                    }}
                  ></CardHeader>
                  <CardBody>
                    <Flex
                      direction={{ default: 'column' }}
                      alignItems={{ default: 'alignItemsCenter' }}
                    >
                      <FlexItem>
                        <CommentsIcon style={{ fontSize: '2rem' }} />
                      </FlexItem>
                      <FlexItem>
                        <Title headingLevel="h3" size="md">
                          {t('nav.chatbot')}
                        </Title>
                      </FlexItem>
                      <FlexItem>
                        <Content>{t('pages.home.cards.chatbotDescription')}</Content>
                      </FlexItem>
                    </Flex>
                  </CardBody>
                </Card>
              </FlexItem>
              <FlexItem style={{ maxWidth: '300px', minWidth: '250px' }}>
                <Card isCompact isClickable style={{ height: '100%' }}>
                  <CardHeader
                    selectableActions={{
                      to: '/usage',
                      selectableActionAriaLabel: t('pages.home.cards.usageAriaLabel'),
                    }}
                  ></CardHeader>
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
              </FlexItem>
            </Flex>
          </FlexItem>
        </Flex>
      </PageSection>
    </>
  );
};

export default HomePage;

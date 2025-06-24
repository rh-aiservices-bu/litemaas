import React from 'react';
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
  return (
    <>
      <PageSection variant="secondary">
        <Content>
          <Title headingLevel="h1" size="2xl">
            Welcome to LiteMaaS
          </Title>
          <Content component={ContentVariants.p}>
            Your Model as a Service platform for accessing and managing AI models.
          </Content>
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
                      Models
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
                      Subscriptions
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
                      API Keys
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
                      Usage
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

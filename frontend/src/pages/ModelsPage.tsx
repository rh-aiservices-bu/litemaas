import React from 'react';
import {
  PageSection,
  Title,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  Button,
  EmptyStateVariant,
} from '@patternfly/react-core';
import { CatalogIcon } from '@patternfly/react-icons';

const ModelsPage: React.FC = () => {
  return (
    <>
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          Available Models
        </Title>
      </PageSection>
      <PageSection>
        <EmptyState variant={EmptyStateVariant.full}>
          <CatalogIcon style={{ fontSize: '4rem' }} />
          <Title headingLevel="h2" size="lg">
            No models available yet
          </Title>
          <EmptyStateBody>
            Model discovery and subscription functionality coming soon. Check back later for
            available AI models.
          </EmptyStateBody>
          <EmptyStateActions>
            <Button variant="primary" isDisabled>
              Browse Models
            </Button>
          </EmptyStateActions>
        </EmptyState>
      </PageSection>
    </>
  );
};

export default ModelsPage;

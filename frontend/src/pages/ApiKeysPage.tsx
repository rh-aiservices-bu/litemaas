import React from 'react';
import { PageSection, Title } from '@patternfly/react-core';

const ApiKeysPage: React.FC = () => {
  return (
    <PageSection>
      <Title headingLevel="h1">API Keys</Title>
      <p>Manage your API keys for accessing models.</p>
    </PageSection>
  );
};

export default ApiKeysPage;

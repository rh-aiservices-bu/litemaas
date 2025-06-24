import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <>
      <PageSection variant="secondary">
        <Title headingLevel="h1" size="2xl">
          {t('pages.models.title')}
        </Title>
      </PageSection>
      <PageSection>
        <EmptyState variant={EmptyStateVariant.full}>
          <CatalogIcon style={{ fontSize: '4rem' }} />
          <Title headingLevel="h2" size="lg">
            {t('pages.models.noModels')}
          </Title>
          <EmptyStateBody>{t('pages.models.description')}</EmptyStateBody>
          <EmptyStateActions>
            <Button variant="primary" isDisabled>
              {t('ui.actions.browse')} Models
            </Button>
          </EmptyStateActions>
        </EmptyState>
      </PageSection>
    </>
  );
};

export default ModelsPage;

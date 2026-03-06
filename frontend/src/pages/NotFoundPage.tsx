import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Button,
  EmptyState,
  EmptyStateVariant,
  EmptyStateBody,
  EmptyStateActions,
  PageSection,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageSection isFilled>
      <EmptyState
        variant={EmptyStateVariant.lg}
        icon={SearchIcon}
        titleText={t('pages.notFound.title')}
      >
        <EmptyStateBody>{t('pages.notFound.description')}</EmptyStateBody>
        <EmptyStateActions>
          <Button variant="primary" component={(props) => <Link {...props} to="/home" />}>
            {t('pages.notFound.goHome')}
          </Button>
        </EmptyStateActions>
      </EmptyState>
    </PageSection>
  );
};

export default NotFoundPage;

import React from 'react';
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from './ErrorBoundary';

interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export const ComponentErrorBoundary: React.FC<ComponentErrorBoundaryProps> = ({ children }) => {
  const { t } = useTranslation();
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = () => setError(null);

  if (error) {
    return (
      <Alert
        variant="danger"
        title={t('ui.errors.componentError')}
        actionClose={<AlertActionCloseButton onClose={resetError} />}
      >
        {error.message}
      </Alert>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <Alert variant="warning" title={t('ui.errors.componentLoadingError')}>
          {t('ui.errors.componentLoadingErrorDesc')}
        </Alert>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

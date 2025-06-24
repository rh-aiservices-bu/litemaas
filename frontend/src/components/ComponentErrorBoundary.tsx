import React from 'react';
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';
import { ErrorBoundary } from './ErrorBoundary';

interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export const ComponentErrorBoundary: React.FC<ComponentErrorBoundaryProps> = ({ children }) => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = () => setError(null);

  if (error) {
    return (
      <Alert
        variant="danger"
        title="Component Error"
        actionClose={<AlertActionCloseButton onClose={resetError} />}
      >
        {error.message}
      </Alert>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <Alert variant="warning" title="Component Loading Error">
          Failed to load this component. Please try refreshing the page.
        </Alert>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

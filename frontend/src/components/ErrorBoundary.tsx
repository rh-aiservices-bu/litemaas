import { Component, ErrorInfo, ReactNode } from 'react';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateVariant,
  Button,
  PageSection,
  Title,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <PageSection>
          <EmptyState variant={EmptyStateVariant.full}>
            <ExclamationCircleIcon
              style={{
                fontSize: 'var(--pf-t--global--font--size--4xl)',
                color: 'var(--pf-t--global--color--status--danger--default)',
              }}
            />
            <Title headingLevel="h2" size="lg">
              Something went wrong
            </Title>
            <EmptyStateBody>
              We're sorry, but something unexpected happened. Please try refreshing the page or
              contact support if the problem persists.
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details style={{ marginTop: '20px', textAlign: 'left' }}>
                  <summary>Error details</summary>
                  <pre
                    style={{
                      fontSize: 'var(--pf-t--global--font--size--xs)',
                      overflow: 'auto',
                    }}
                  >
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </EmptyStateBody>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
              <Button variant="link" onClick={this.handleReset}>
                Try Again
              </Button>
            </EmptyStateActions>
          </EmptyState>
        </PageSection>
      );
    }

    return this.props.children;
  }
}

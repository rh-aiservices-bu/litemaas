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
import { withTranslation, WithTranslation } from 'react-i18next';

interface Props extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryComponent extends Component<Props, State> {
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
    const { t } = this.props;

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
              {t('ui.errors.somethingWentWrong')}
            </Title>
            <EmptyStateBody>
              {t('ui.errors.somethingWentWrongDesc')}
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
                {t('common.refreshPage')}
              </Button>
              <Button variant="link" onClick={this.handleReset}>
                {t('common.tryAgain')}
              </Button>
            </EmptyStateActions>
          </EmptyState>
        </PageSection>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary: React.ComponentType<Omit<Props, keyof WithTranslation>> =
  withTranslation()(ErrorBoundaryComponent);

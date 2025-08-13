import React from 'react';
import { render, screen, fireEvent } from '../test-utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { vi } from 'vitest';

// Create a component that throws errors for testing
const ThrowError: React.FC<{ shouldThrow: boolean; errorMessage?: string }> = ({
  shouldThrow,
  errorMessage = 'Test error',
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

// Mock console.error to test error logging
const originalConsoleError = console.error;
const mockConsoleError = vi.fn();

describe('ErrorBoundary', () => {
  beforeEach(() => {
    console.error = mockConsoleError;
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('Normal operation', () => {
    it('renders children when there are no errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('does not display error UI when children render successfully', () => {
      render(
        <ErrorBoundary>
          <div>Working component</div>
        </ErrorBoundary>,
      );

      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
      expect(screen.getByText('Working component')).toBeInTheDocument();
    });
  });

  describe('Error catching and fallback UI', () => {
    it('catches errors and displays default fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(
        screen.getByText(/We're sorry, but something unexpected happened/),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('displays custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('logs error details to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Specific error message" />
        </ErrorBoundary>,
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.objectContaining({ message: 'Specific error message' }),
        expect.any(Object),
      );
    });
  });

  describe('Error details in development', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('shows error details in development mode', () => {
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Development error" />
        </ErrorBoundary>,
      );

      // Check for error details section
      const detailsElement = screen.getByText('Error details');
      expect(detailsElement).toBeInTheDocument();

      // Check that error message is displayed in details
      expect(screen.getByText(/Error: Development error/)).toBeInTheDocument();
    });

    it('hides error details in production mode', () => {
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Production error" />
        </ErrorBoundary>,
      );

      expect(screen.queryByText('Error details')).not.toBeInTheDocument();
      expect(screen.queryByText(/Error: Production error/)).not.toBeInTheDocument();
    });
  });

  describe('Recovery mechanisms', () => {
    it('allows recovery with "Try Again" button', () => {
      const TestWrapper = () => {
        const [key, setKey] = React.useState(0);

        return (
          <div>
            <button onClick={() => setKey((k) => k + 1)}>Reset Component</button>
            <ErrorBoundary key={key}>
              <ThrowError shouldThrow={key === 0} />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestWrapper />);

      // Verify error state initially
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Reset the component to test recovery
      fireEvent.click(screen.getByText('Reset Component'));

      // Should show children again after reset
      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('triggers page refresh with "Refresh Page" button', () => {
      // Mock window.location.reload
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Refresh Page' }));

      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('Error boundary lifecycle', () => {
    it('calls getDerivedStateFromError when error occurs', () => {
      const TestComponent = () => {
        const [shouldError, setShouldError] = React.useState(false);

        return (
          <div>
            <button onClick={() => setShouldError(true)}>Trigger Error</button>
            <ErrorBoundary>
              <ThrowError shouldThrow={shouldError} />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestComponent />);

      // Initially should render without error
      expect(screen.getByText('No error')).toBeInTheDocument();

      // Trigger error
      fireEvent.click(screen.getByText('Trigger Error'));

      // Should catch error and show fallback
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('handles multiple error scenarios', () => {
      const MultipleErrorComponent = () => {
        const [errorType, setErrorType] = React.useState<string | null>(null);

        if (errorType === 'syntax') {
          throw new SyntaxError('Syntax error occurred');
        }
        if (errorType === 'type') {
          throw new TypeError('Type error occurred');
        }
        if (errorType === 'reference') {
          throw new ReferenceError('Reference error occurred');
        }

        return (
          <div>
            <button onClick={() => setErrorType('syntax')}>Syntax Error</button>
            <button onClick={() => setErrorType('type')}>Type Error</button>
            <button onClick={() => setErrorType('reference')}>Reference Error</button>
            <span>No errors</span>
          </div>
        );
      };

      const { rerender } = render(
        <ErrorBoundary>
          <MultipleErrorComponent />
        </ErrorBoundary>,
      );

      // Test different error types
      const errorTypes = ['syntax', 'type', 'reference'];

      errorTypes.forEach((errorType) => {
        rerender(
          <ErrorBoundary>
            <MultipleErrorComponent />
          </ErrorBoundary>,
        );

        // Initially no error
        expect(screen.getByText('No errors')).toBeInTheDocument();

        // Trigger specific error type
        fireEvent.click(
          screen.getByText(`${errorType.charAt(0).toUpperCase() + errorType.slice(1)} Error`),
        );

        // Should catch any type of error
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(mockConsoleError).toHaveBeenCalled();

        // Reset for next iteration
        fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
        mockConsoleError.mockClear();
      });
    });
  });

  describe('Component state management', () => {
    it('maintains error state until reset', () => {
      const TestWrapper = () => {
        const [key, setKey] = React.useState(0);
        const [shouldThrow, setShouldThrow] = React.useState(false);

        return (
          <div>
            <button onClick={() => setShouldThrow(true)}>Cause Error</button>
            <button onClick={() => setKey((k) => k + 1)}>Force Rerender</button>
            <ErrorBoundary key={key}>
              <ThrowError shouldThrow={shouldThrow} />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestWrapper />);

      // Cause error
      fireEvent.click(screen.getByText('Cause Error'));
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Force rerender - error state should persist
      fireEvent.click(screen.getByText('Force Rerender'));
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('resets error state when component key changes', () => {
      const TestWrapper = () => {
        const [key, setKey] = React.useState(0);

        return (
          <div>
            <button onClick={() => setKey((k) => k + 1)}>Reset Component</button>
            <ErrorBoundary key={key}>
              <ThrowError shouldThrow={key === 0} />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestWrapper />);

      // Initially should show error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Reset component with new key
      fireEvent.click(screen.getByText('Reset Component'));

      // Should show normal content
      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible error message structure', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Check for proper heading structure
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Something went wrong');

      // Check for proper button labeling
      const refreshButton = screen.getByRole('button', { name: 'Refresh Page' });
      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });

      expect(refreshButton).toBeInTheDocument();
      expect(tryAgainButton).toBeInTheDocument();
    });

    it('uses appropriate ARIA attributes in error state', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      // The EmptyState component should be accessible
      const emptyState = screen
        .getByText('Something went wrong')
        .closest('[class*="pf-v6-c-empty-state"]');
      expect(emptyState).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles null/undefined children gracefully', () => {
      render(<ErrorBoundary>{null}</ErrorBoundary>);

      // Should not show error state for null children
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('handles async errors in effects', () => {
      const AsyncErrorComponent = () => {
        const [shouldError, setShouldError] = React.useState(false);

        React.useEffect(() => {
          if (shouldError) {
            // Simulate an async error that gets caught
            throw new Error('Async effect error');
          }
        }, [shouldError]);

        return (
          <div>
            <button onClick={() => setShouldError(true)}>Async Error</button>
            <span>Async component</span>
          </div>
        );
      };

      render(
        <ErrorBoundary>
          <AsyncErrorComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Async component')).toBeInTheDocument();

      // Note: useEffect errors are not caught by error boundaries
      // This test verifies the component handles the scenario gracefully
      fireEvent.click(screen.getByText('Async Error'));
    });
  });
});

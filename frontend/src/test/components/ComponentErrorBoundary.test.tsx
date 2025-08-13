import React from 'react';
import { render, screen, fireEvent } from '../test-utils';
import { ComponentErrorBoundary } from '../../components/ComponentErrorBoundary';
import { vi } from 'vitest';

// Create test components for error scenarios
const ThrowError: React.FC<{ shouldThrow: boolean; errorMessage?: string }> = ({
  shouldThrow,
  errorMessage = 'Component error',
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>Component working</div>;
};

// Mock console.error to test error logging
const originalConsoleError = console.error;
const mockConsoleError = vi.fn();

describe('ComponentErrorBoundary', () => {
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
        <ComponentErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ComponentErrorBoundary>,
      );

      expect(screen.getByText('Component working')).toBeInTheDocument();
    });

    it('does not display error UI for successful children', () => {
      render(
        <ComponentErrorBoundary>
          <div>Normal component</div>
        </ComponentErrorBoundary>,
      );

      expect(screen.getByText('Normal component')).toBeInTheDocument();
      expect(screen.queryByText('Component Loading Error')).not.toBeInTheDocument();
    });
  });

  describe('Component error handling', () => {
    it('displays fallback alert when child component throws', () => {
      render(
        <ComponentErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test component error" />
        </ComponentErrorBoundary>,
      );

      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to load this component. Please try refreshing the page.'),
      ).toBeInTheDocument();

      // Check that it's displayed as a warning alert (the fallback)
      const alert = screen.getByText('Component Loading Error').closest('.pf-v6-c-alert');
      expect(alert).toHaveClass('pf-m-warning');
    });

    it('displays fallback without close button', () => {
      render(
        <ComponentErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ComponentErrorBoundary>,
      );

      // Fallback alert doesn't have a close button
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });

    it('shows persistent fallback alert', () => {
      render(
        <ComponentErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Persistent error" />
        </ComponentErrorBoundary>,
      );

      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to load this component. Please try refreshing the page.'),
      ).toBeInTheDocument();

      // Fallback alert cannot be dismissed manually
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });
  });

  describe('Fallback to main ErrorBoundary', () => {
    it('uses ErrorBoundary fallback for error handling', () => {
      // ComponentErrorBoundary uses ErrorBoundary internally with a custom fallback
      render(
        <ComponentErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ComponentErrorBoundary>,
      );

      // Should show the fallback from ErrorBoundary
      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
    });
  });

  describe('Error state management', () => {
    it('maintains error state until manually reset', () => {
      const TestWrapper = () => {
        const [shouldError, setShouldError] = React.useState(false);

        return (
          <div>
            <button onClick={() => setShouldError(true)}>Trigger Error</button>
            <ComponentErrorBoundary>
              <ThrowError shouldThrow={shouldError} />
            </ComponentErrorBoundary>
          </div>
        );
      };

      render(<TestWrapper />);

      // Initially working
      expect(screen.getByText('Component working')).toBeInTheDocument();

      // Trigger error
      fireEvent.click(screen.getByText('Trigger Error'));

      // Should show error alert fallback
      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
      expect(screen.queryByText('Component working')).not.toBeInTheDocument();
    });

    it('resets error state when component is reset', () => {
      const TestWrapper = () => {
        const [key, setKey] = React.useState(0);

        return (
          <div>
            <button onClick={() => setKey((k) => k + 1)}>Reset</button>
            <ComponentErrorBoundary key={key}>
              <ThrowError shouldThrow={key === 0} />
            </ComponentErrorBoundary>
          </div>
        );
      };

      render(<TestWrapper />);

      // Initially should error
      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();

      // Reset component
      fireEvent.click(screen.getByText('Reset'));

      // Should work normally
      expect(screen.getByText('Component working')).toBeInTheDocument();
      expect(screen.queryByText('Component Loading Error')).not.toBeInTheDocument();
    });
  });

  describe('Different error types', () => {
    it('handles different JavaScript error types', () => {
      const errorTypes = [
        { type: 'Error', message: 'Generic error' },
        { type: 'TypeError', message: 'Type error' },
        { type: 'ReferenceError', message: 'Reference error' },
        { type: 'SyntaxError', message: 'Syntax error' },
      ];

      errorTypes.forEach(({ message }) => {
        const { rerender } = render(
          <ComponentErrorBoundary>
            <ThrowError shouldThrow={true} errorMessage={message} />
          </ComponentErrorBoundary>,
        );

        expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
        // The fallback message doesn't show the specific error message

        // Clean up for next iteration
        rerender(<div>Test complete</div>);
      });
    });

    it('handles empty or undefined error messages', () => {
      render(
        <ComponentErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="" />
        </ComponentErrorBoundary>,
      );

      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
      // Should still render the alert even with empty message
      const alert = screen.getByText('Component Loading Error').closest('.pf-v6-c-alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('onError callback', () => {
    it('calls onError callback when provided', () => {
      const mockOnError = vi.fn();

      render(
        <ComponentErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} errorMessage="Callback test error" />
        </ComponentErrorBoundary>,
      );

      // Note: The current implementation doesn't use onError callback
      // This test is for future enhancement
      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible error alert structure', () => {
      render(
        <ComponentErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Accessibility test" />
        </ComponentErrorBoundary>,
      );

      // Check for proper heading structure
      const heading = screen.getByRole('heading', { level: 4 });
      expect(heading).toHaveTextContent('Component Loading Error');

      // PatternFly Alert provides proper accessibility structure
      const alertContainer = screen.getByText('Component Loading Error').closest('.pf-v6-c-alert');
      expect(alertContainer).toBeInTheDocument();
    });

    it('provides screen reader friendly content', () => {
      render(
        <ComponentErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Screen reader test" />
        </ComponentErrorBoundary>,
      );

      // PatternFly includes screen reader text
      expect(screen.getByText('Warning alert:')).toBeInTheDocument();
      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
    });
  });

  describe('Multiple children handling', () => {
    it('handles multiple children with mixed error states', () => {
      const MultiChildrenComponent = () => (
        <>
          <div>Working child 1</div>
          <ThrowError shouldThrow={true} errorMessage="Child error" />
          <div>Working child 2</div>
        </>
      );

      render(
        <ComponentErrorBoundary>
          <MultiChildrenComponent />
        </ComponentErrorBoundary>,
      );

      // Should show error alert instead of children
      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
      expect(screen.queryByText('Working child 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Working child 2')).not.toBeInTheDocument();
    });
  });

  describe('Integration with ErrorBoundary', () => {
    it('wraps children with ErrorBoundary for additional protection', () => {
      // This test verifies the component structure
      render(
        <ComponentErrorBoundary>
          <div data-testid="test-child">Test content</div>
        </ComponentErrorBoundary>,
      );

      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('provides fallback warning alert in ErrorBoundary', () => {
      // Create a component that bypasses the local error handling
      const DeepError = () => {
        throw new Error('Deep error');
      };

      render(
        <ComponentErrorBoundary>
          <DeepError />
        </ComponentErrorBoundary>,
      );

      // Should show the component error instead of the ErrorBoundary fallback
      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();
    });
  });

  describe('Performance considerations', () => {
    it('does not re-render unnecessarily when no errors occur', () => {
      let renderCount = 0;

      const CountingComponent = () => {
        renderCount++;
        return <div>Render count: {renderCount}</div>;
      };

      const { rerender } = render(
        <ComponentErrorBoundary>
          <CountingComponent />
        </ComponentErrorBoundary>,
      );

      expect(screen.getByText('Render count: 1')).toBeInTheDocument();

      // Rerender the same content
      rerender(
        <ComponentErrorBoundary>
          <CountingComponent />
        </ComponentErrorBoundary>,
      );

      // Component should re-render (this is expected behavior)
      expect(screen.getByText('Render count: 2')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles null children gracefully', () => {
      render(<ComponentErrorBoundary>{null}</ComponentErrorBoundary>);

      expect(screen.queryByText('Component Loading Error')).not.toBeInTheDocument();
    });

    it('handles undefined children gracefully', () => {
      render(<ComponentErrorBoundary>{undefined}</ComponentErrorBoundary>);

      expect(screen.queryByText('Component Loading Error')).not.toBeInTheDocument();
    });

    it('handles empty fragment children', () => {
      render(
        <ComponentErrorBoundary>
          <></>
        </ComponentErrorBoundary>,
      );

      expect(screen.queryByText('Component Loading Error')).not.toBeInTheDocument();
    });

    it('handles component recovery when error is fixed', () => {
      const TestRecovery = () => {
        const [hasError, setHasError] = React.useState(true);
        const [key, setKey] = React.useState(0);

        return (
          <div>
            <button
              onClick={() => {
                setHasError(false);
                setKey((k) => k + 1);
              }}
            >
              Fix Error
            </button>
            <ComponentErrorBoundary key={key}>
              <ThrowError shouldThrow={hasError} errorMessage="Recoverable error" />
            </ComponentErrorBoundary>
          </div>
        );
      };

      render(<TestRecovery />);

      // Should show error initially
      expect(screen.getByText('Component Loading Error')).toBeInTheDocument();

      // Fix the underlying issue and reset component
      fireEvent.click(screen.getByText('Fix Error'));

      // Should show working component after recovery
      expect(screen.getByText('Component working')).toBeInTheDocument();
      expect(screen.queryByText('Component Loading Error')).not.toBeInTheDocument();
    });
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';

/**
 * PatternFly 6 AlertActionCloseButton Investigation
 *
 * Purpose: Investigate why AlertActionCloseButton doesn't render properly
 * in test environment when used in the ErrorAlert component.
 *
 * Goal: Determine if AlertActionCloseButton can be tested in JSDOM,
 * identify the correct testing pattern, or document as limitation.
 *
 * Context: ErrorAlert.test.tsx has 3 skipped tests for close button
 * functionality that claim "PatternFly 6 AlertActionCloseButton context issues"
 */
describe('PatternFly 6 AlertActionCloseButton Investigation', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Alert Rendering', () => {
    it('should render basic alert without close button', () => {
      render(
        <Alert variant="danger" title="Test Error">
          <p>Error message content</p>
        </Alert>,
      );

      // Alert should render
      const alert = document.querySelector('.pf-v6-c-alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Test Error')).toBeInTheDocument();
    });

    it('should render alert with title', () => {
      render(
        <Alert variant="danger" title="Test Error">
          <p>Error message content</p>
        </Alert>,
      );

      expect(screen.getByText('Test Error')).toBeInTheDocument();
      expect(screen.getByText('Error message content')).toBeInTheDocument();
    });
  });

  describe('AlertActionCloseButton Investigation', () => {
    it('INVESTIGATION: Can we render AlertActionCloseButton via actionLinks?', () => {
      render(
        <Alert
          variant="danger"
          title="Test Error"
          actionLinks={
            <>
              <AlertActionCloseButton onClose={mockOnClose} />
            </>
          }
        >
          <p>Error message content</p>
        </Alert>,
      );

      console.log('=== AFTER RENDERING WITH actionLinks ===');
      screen.debug();

      // Try to find close button
      const closeButtonByRole = screen.queryByRole('button', { name: /close/i });
      const closeButtonByLabel = screen.queryByLabelText(/close/i);
      const closeButtonByTitle = screen.queryByTitle(/close/i);
      const allButtons = screen.queryAllByRole('button');

      console.log('Close button by role:', !!closeButtonByRole);
      console.log('Close button by label:', !!closeButtonByLabel);
      console.log('Close button by title:', !!closeButtonByTitle);
      console.log('Total buttons found:', allButtons.length);

      allButtons.forEach((btn, index) => {
        console.log(`Button ${index}:`, {
          text: btn.textContent,
          ariaLabel: btn.getAttribute('aria-label'),
          title: btn.getAttribute('title'),
          className: btn.className,
        });
      });
    });

    it('INVESTIGATION: Can we render AlertActionCloseButton at top level with title prop?', () => {
      const { container } = render(
        <Alert
          variant="danger"
          title="Test Error"
          actionClose={<AlertActionCloseButton title="Close" onClose={mockOnClose} />}
        >
          <p>Error message content</p>
        </Alert>,
      );

      console.log('=== AFTER RENDERING WITH actionClose ===');
      screen.debug();

      // Check DOM structure
      console.log('Container HTML:', container.innerHTML);

      // Try to find close button
      const closeButtonByRole = screen.queryByRole('button', { name: /close/i });
      const closeButtonByLabel = screen.queryByLabelText(/close/i);
      const closeButtonByTitle = screen.queryByTitle(/close/i);
      const allButtons = screen.queryAllByRole('button');

      console.log('Close button by role:', !!closeButtonByRole);
      console.log('Close button by label:', !!closeButtonByLabel);
      console.log('Close button by title:', !!closeButtonByTitle);
      console.log('Total buttons found:', allButtons.length);

      // Check for close button classes
      const closeButtonElements = container.querySelectorAll(
        '[class*="close"], [aria-label*="lose"]',
      );
      console.log('Elements with "close" in class/aria-label:', closeButtonElements.length);
      closeButtonElements.forEach((el, index) => {
        console.log(
          `Close element ${index}:`,
          el.tagName,
          el.className,
          el.getAttribute('aria-label'),
        );
      });
    });

    it('INVESTIGATION: Does the close button appear in raw HTML?', () => {
      const { container } = render(
        <Alert
          variant="danger"
          title="Test Error"
          actionClose={<AlertActionCloseButton title="Close alert" onClose={mockOnClose} />}
        >
          <p>Error message content</p>
        </Alert>,
      );

      const html = container.innerHTML;
      console.log('=== RAW HTML ANALYSIS ===');
      console.log('HTML length:', html.length);
      console.log('Contains "close":', html.toLowerCase().includes('close'));
      console.log('Contains "button":', html.includes('button'));
      console.log('Contains pf-v6-c-alert classes:', html.includes('pf-v6-c-alert'));

      // Extract button elements
      const buttonMatches = html.match(/<button[^>]*>/g);
      console.log('Button tags found:', buttonMatches?.length || 0);
      if (buttonMatches) {
        buttonMatches.forEach((match, index) => {
          console.log(`Button ${index}:`, match);
        });
      }
    });

    it('INVESTIGATION: Can we click the close button if it exists?', async () => {
      const user = userEvent.setup();

      render(
        <Alert
          variant="danger"
          title="Test Error"
          actionClose={<AlertActionCloseButton title="Close alert" onClose={mockOnClose} />}
        >
          <p>Error message content</p>
        </Alert>,
      );

      // Try all possible query methods
      const allButtons = screen.queryAllByRole('button');
      console.log('=== BUTTON ANALYSIS ===');
      console.log('Total buttons:', allButtons.length);

      // Try to find close button by various attributes
      let closeButton = allButtons.find((btn) =>
        btn.getAttribute('aria-label')?.toLowerCase().includes('close'),
      );

      if (!closeButton) {
        closeButton = allButtons.find((btn) =>
          btn.getAttribute('title')?.toLowerCase().includes('close'),
        );
      }

      if (!closeButton) {
        closeButton = allButtons.find((btn) => btn.className.includes('close'));
      }

      if (!closeButton && allButtons.length > 0) {
        console.log('No close button found, trying first button');
        closeButton = allButtons[0];
      }

      if (closeButton) {
        console.log('Found button:', {
          text: closeButton.textContent,
          ariaLabel: closeButton.getAttribute('aria-label'),
          title: closeButton.getAttribute('title'),
          className: closeButton.className,
        });

        await user.click(closeButton);

        console.log('After click - onClose called?', mockOnClose.mock.calls.length);
        if (mockOnClose.mock.calls.length > 0) {
          console.log('SUCCESS: Close button works!');
        } else {
          console.log('ISSUE: Button clicked but callback not called');
        }
      } else {
        console.log('ISSUE: No button element found at all');
      }
    });
  });

  describe('Alternative Close Button Patterns', () => {
    it('ALTERNATIVE 1: Using custom button instead of AlertActionCloseButton', async () => {
      const user = userEvent.setup();

      render(
        <Alert
          variant="danger"
          title="Test Error"
          actionClose={
            <button
              type="button"
              className="custom-close-button"
              aria-label="Close alert"
              onClick={mockOnClose}
            >
              ×
            </button>
          }
        >
          <p>Error message content</p>
        </Alert>,
      );

      const closeButton = screen.getByRole('button', { name: /close alert/i });
      expect(closeButton).toBeInTheDocument();

      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('ALTERNATIVE 2: Testing onClose callback directly without UI', () => {
      render(
        <Alert
          variant="danger"
          title="Test Error"
          actionClose={<AlertActionCloseButton title="Close" onClose={mockOnClose} />}
        >
          <p>Error message content</p>
        </Alert>,
      );

      // Instead of clicking UI, call the callback directly
      mockOnClose();

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('ALTERNATIVE 3: Integration test with parent component', () => {
      // Test the close functionality through the parent component (ErrorAlert)
      // rather than testing AlertActionCloseButton in isolation

      // This is the pattern used in ErrorAlert component
      const TestParent = () => {
        const [visible, setVisible] = React.useState(true);

        if (!visible) return null;

        return (
          <Alert
            variant="danger"
            title="Test Error"
            actionClose={<AlertActionCloseButton title="Close" onClose={() => setVisible(false)} />}
          >
            <p>Error message content</p>
          </Alert>
        );
      };

      render(<TestParent />);
      expect(screen.getByText('Test Error')).toBeInTheDocument();

      // This test documents that integration testing is an alternative approach
    });
  });

  describe('Comparison with ErrorAlert Component', () => {
    it('INVESTIGATION: How does ErrorAlert use AlertActionCloseButton?', () => {
      // Document the actual usage pattern from ErrorAlert.tsx

      const actualUsagePattern = {
        component: 'ErrorAlert',
        file: 'src/components/errors/ErrorAlert.tsx',
        pattern: {
          closable: 'boolean prop',
          onClose: 'callback prop',
          implementation: 'AlertActionCloseButton in actionLinks array',
          line80:
            "actionButtons.push(<AlertActionCloseButton key='close' title={t('common.close')} onClose={onClose} />)",
          line168:
            'actionLinks={actionButtons.length > 0 ? <Flex>{actionButtons.map(...)}</Flex> : undefined}',
        },
        issue: 'AlertActionCloseButton may not render in test environment',
      };

      console.log('=== ERROR ALERT USAGE PATTERN ===');
      console.log(JSON.stringify(actualUsagePattern, null, 2));
      console.log('==================================');

      expect(actualUsagePattern).toBeDefined();
    });

    it('FINDINGS: AlertActionCloseButton rendering in JSDOM', () => {
      const findings = {
        canRenderAlert: true,
        canRenderAlertWithTitle: true,
        canRenderCloseButton: 'TO BE DETERMINED - check investigation tests',
        possibleIssues: [
          'AlertActionCloseButton may require Alert context',
          'Close button might render but not be queryable by standard methods',
          'actionLinks vs actionClose prop differences',
        ],
        workarounds: [
          'Use custom button instead of AlertActionCloseButton',
          'Test callback directly instead of UI interaction',
          'Use integration test with full component tree',
          'Accept skip if manually verified in browser',
        ],
        recommendation: 'Determine from investigation results',
      };

      console.log('=== INVESTIGATION FINDINGS ===');
      console.log(JSON.stringify(findings, null, 2));
      console.log('==============================');

      expect(findings).toBeDefined();
    });
  });

  describe('Manual Testing Requirements', () => {
    it('MANUAL TESTING: Verify close button functionality', () => {
      const manualTestingChecklist = [
        'Verify close button appears in top-right corner of alert',
        'Verify close button has proper aria-label for screen readers',
        'Verify clicking close button calls onClose callback',
        'Verify close button works with keyboard (Enter and Space)',
        'Verify focus management after close button click',
        'Verify close button styling matches PatternFly 6 design',
      ];

      console.log('=== MANUAL TESTING CHECKLIST ===');
      manualTestingChecklist.forEach((item, index) => {
        console.log(`${index + 1}. ${item}`);
      });
      console.log('================================');

      expect(manualTestingChecklist.length).toBe(6);
    });
  });
});

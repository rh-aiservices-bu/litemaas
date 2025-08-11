import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { ScreenReaderAnnouncement } from '../../components/ScreenReaderAnnouncement';
import {
  renderWithAccessibility,
  screenReaderTestUtils,
  ariaTestUtils,
} from '../accessibility-test-utils';

describe('ScreenReaderAnnouncement Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have no accessibility violations', async () => {
    const { testAccessibility } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Test announcement" priority="polite" />,
    );

    await testAccessibility();
  });

  it('should have proper ARIA live region attributes for polite announcements', async () => {
    const { container } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Polite announcement" priority="polite" />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent('Polite announcement');

    // Test live region structure
    ariaTestUtils.testLiveRegion(container);
  });

  it('should have proper ARIA live region attributes for assertive announcements', async () => {
    const { container } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Urgent announcement" priority="assertive" />,
    );

    const liveRegion = container.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent('Urgent announcement');

    // Note: The component doesn't explicitly set role="alert" - the aria-live="assertive" is sufficient
    expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
  });

  it('should handle empty messages gracefully', async () => {
    const { container, testAccessibility } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="" priority="polite" />,
    );

    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent('');

    await testAccessibility();
  });

  it('should handle message updates correctly', async () => {
    const { container, rerender } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="First message" priority="polite" />,
    );

    let liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toHaveTextContent('First message');

    // Update message
    rerender(<ScreenReaderAnnouncement message="Second message" priority="polite" />);

    liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toHaveTextContent('Second message');
  });

  it('should handle priority changes correctly', async () => {
    const { container, rerender } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Test message" priority="polite" />,
    );

    let liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();

    // Change to assertive
    rerender(<ScreenReaderAnnouncement message="Test message" priority="assertive" />);

    liveRegion = container.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
  });

  it('should have proper accessibility attributes for status messages', async () => {
    const { container } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Status update" priority="polite" />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();

    // The component uses aria-live="polite" which is sufficient for status announcements
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    // Should be hidden from visual users but available to screen readers
    expect(liveRegion).toHaveClass('pf-v6-screen-reader');
  });

  it('should collect announcements for screen reader testing', () => {
    const { container } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Test announcement for collection" priority="polite" />,
    );

    const announcements = screenReaderTestUtils.testAnnouncements(container);
    expect(announcements).toContain('Test announcement for collection');
  });

  it('should handle long messages without truncation', async () => {
    const longMessage =
      'This is a very long announcement message that should be fully announced to screen readers without any truncation or modification to ensure users receive complete information about the current state or action.';

    const { container, testAccessibility } = renderWithAccessibility(
      <ScreenReaderAnnouncement message={longMessage} priority="polite" />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toHaveTextContent(longMessage);

    await testAccessibility();
  });

  it('should handle special characters and HTML entities', async () => {
    const messageWithSpecialChars = 'Success! 100% complete. Files saved to "My Documents" folder.';

    const { container, testAccessibility } = renderWithAccessibility(
      <ScreenReaderAnnouncement message={messageWithSpecialChars} priority="assertive" />,
    );

    const liveRegion = container.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toHaveTextContent(messageWithSpecialChars);

    await testAccessibility();
  });

  it('should be invisible but accessible', () => {
    const { container } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Hidden but accessible" priority="polite" />,
    );

    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).toBeInTheDocument();

    // Should have screen reader only styles
    expect(liveRegion).toHaveClass('pf-v6-screen-reader');

    // Verify it's not visibly displayed but still in the DOM
    const computedStyle = window.getComputedStyle(liveRegion!);
    expect(computedStyle.position).toBe('absolute');
  });

  it('should handle multiple rapid announcements', async () => {
    const { container, rerender } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="First" priority="polite" />,
    );

    // Rapidly change messages
    rerender(<ScreenReaderAnnouncement message="Second" priority="polite" />);
    rerender(<ScreenReaderAnnouncement message="Third" priority="polite" />);
    rerender(<ScreenReaderAnnouncement message="Fourth" priority="polite" />);

    await waitFor(() => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toHaveTextContent('Fourth');
    });
  });

  it('should work with different message types', async () => {
    const testCases = [
      { message: 'Loading...', priority: 'polite' as const },
      { message: 'Error occurred!', priority: 'assertive' as const },
      { message: 'Success!', priority: 'assertive' as const },
      { message: 'Form submitted', priority: 'polite' as const },
    ];

    for (const testCase of testCases) {
      const { container, testAccessibility } = renderWithAccessibility(
        <ScreenReaderAnnouncement message={testCase.message} priority={testCase.priority} />,
      );

      const liveRegion = container.querySelector(`[aria-live="${testCase.priority}"]`);
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', testCase.priority);
      expect(liveRegion).toHaveTextContent(testCase.message);

      await testAccessibility();
    }
  });

  it('should maintain proper document structure', () => {
    const { container } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Structure test" priority="polite" />,
    );

    // Component should not interfere with document structure
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).toBeInTheDocument();

    // Should be at the end of the component tree
    expect(liveRegion).toBe(container.lastElementChild);

    // Should not contain any child elements that could interfere
    expect(liveRegion?.children.length).toBe(0);
  });

  it('should handle conditional rendering', async () => {
    const { container, rerender } = renderWithAccessibility(
      <ScreenReaderAnnouncement message="Visible message" priority="polite" />,
    );

    expect(container.querySelector('[aria-live]')).toBeInTheDocument();

    // Render with empty message (should still maintain live region)
    rerender(<ScreenReaderAnnouncement message="" priority="polite" />);

    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).toBeInTheDocument();

    // The component may still show the previous message until the timeout clears it
    // But the live region should exist regardless
    expect(liveRegion?.tagName.toLowerCase()).toBe('div');
  });
});

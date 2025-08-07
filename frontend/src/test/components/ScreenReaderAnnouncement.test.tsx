import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  ScreenReaderAnnouncement,
  useScreenReaderAnnouncement,
} from '../../components/ScreenReaderAnnouncement';
import React from 'react';

// Test component to test the hook
const TestComponent: React.FC = () => {
  const { announcement, announce } = useScreenReaderAnnouncement();

  return (
    <>
      <ScreenReaderAnnouncement
        message={announcement.message}
        priority={announcement.priority}
        announcementKey={announcement.key}
      />
      <button onClick={() => announce('Test message', 'polite')}>Announce Test</button>
      <button onClick={() => announce('Error message', 'assertive')}>Announce Error</button>
    </>
  );
};

describe('ScreenReaderAnnouncement', () => {
  it('renders with correct ARIA attributes', () => {
    render(<ScreenReaderAnnouncement message="Test message" />);

    const liveRegion = screen.getByText('Test message');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('supports assertive priority', () => {
    render(<ScreenReaderAnnouncement message="Error message" priority="assertive" />);

    const liveRegion = screen.getByText('Error message');
    expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
  });

  it('is visually hidden', () => {
    render(<ScreenReaderAnnouncement message="Test message" />);

    const liveRegion = screen.getByText('Test message');
    const styles = getComputedStyle(liveRegion);
    expect(styles.position).toBe('absolute');
    expect(styles.left).toBe('-10000px');
  });

  it('clears message after delay', async () => {
    render(
      <ScreenReaderAnnouncement message="Test message" clearDelay={100} />,
    );

    expect(screen.getByText('Test message')).toBeInTheDocument();

    // Wait for the message to clear
    await waitFor(
      () => {
        expect(screen.queryByText('Test message')).not.toBeInTheDocument();
      },
      { timeout: 200 },
    );
  });

  it('updates message when announcementKey changes', () => {
    const { rerender } = render(
      <ScreenReaderAnnouncement message="First message" announcementKey={1} />,
    );

    expect(screen.getByText('First message')).toBeInTheDocument();

    rerender(<ScreenReaderAnnouncement message="Second message" announcementKey={2} />);

    expect(screen.getByText('Second message')).toBeInTheDocument();
  });
});

describe('useScreenReaderAnnouncement hook', () => {
  it('provides announce function that updates announcement state', async () => {
    render(<TestComponent />);

    const announceButton = screen.getByText('Announce Test');
    announceButton.click();

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  it('supports different priorities', async () => {
    render(<TestComponent />);

    const errorButton = screen.getByText('Announce Error');
    errorButton.click();

    await waitFor(() => {
      const liveRegion = screen.getByText('Error message');
      expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
    });
  });
});

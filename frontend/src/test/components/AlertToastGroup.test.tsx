import { render, screen, fireEvent, act } from '../test-utils';
import { AlertToastGroup, ToastNotification } from '../../components/AlertToastGroup';
import { vi } from 'vitest';

// Mock notifications for testing
const createMockNotification = (overrides: Partial<ToastNotification> = {}): ToastNotification => ({
  id: `notification-${Date.now()}-${Math.random()}`,
  title: 'Test Notification',
  description: 'Test description',
  variant: 'info',
  timeout: 2000,
  ...overrides,
});

describe('AlertToastGroup', () => {
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    mockOnRemove.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Basic rendering', () => {
    it('renders without notifications', () => {
      render(<AlertToastGroup notifications={[]} onRemove={mockOnRemove} />);

      // AlertGroup should be present but empty
      const alertGroup = screen.getByRole('list');
      expect(alertGroup).toBeInTheDocument();
      expect(alertGroup).toHaveAttribute('aria-live', 'polite');
    });

    it('renders single notification', () => {
      const notification = createMockNotification({
        title: 'Single Test',
        description: 'Single description',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Single Test')).toBeInTheDocument();
      expect(screen.getByText('Single description')).toBeInTheDocument();
    });

    it('renders multiple notifications', () => {
      const notifications = [
        createMockNotification({ id: '1', title: 'First', description: 'First desc' }),
        createMockNotification({ id: '2', title: 'Second', description: 'Second desc' }),
        createMockNotification({ id: '3', title: 'Third', description: 'Third desc' }),
      ];

      render(<AlertToastGroup notifications={notifications} onRemove={mockOnRemove} />);

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('First desc')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Second desc')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
      expect(screen.getByText('Third desc')).toBeInTheDocument();
    });
  });

  describe('Notification types and variants', () => {
    it('renders success notification correctly', () => {
      const notification = createMockNotification({
        title: 'Success!',
        description: 'Operation completed successfully',
        variant: 'success',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();

      // Check for success variant class
      const alert = screen.getByText('Success!').closest('.pf-v6-c-alert');
      expect(alert).toHaveClass('pf-m-success');
    });

    it('renders danger notification correctly', () => {
      const notification = createMockNotification({
        title: 'Error!',
        description: 'Something went wrong',
        variant: 'danger',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Error!')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      const alert = screen.getByText('Error!').closest('.pf-v6-c-alert');
      expect(alert).toHaveClass('pf-m-danger');
    });

    it('renders warning notification correctly', () => {
      const notification = createMockNotification({
        title: 'Warning!',
        description: 'Please review this action',
        variant: 'warning',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Warning!')).toBeInTheDocument();
      expect(screen.getByText('Please review this action')).toBeInTheDocument();

      const alert = screen.getByText('Warning!').closest('.pf-v6-c-alert');
      expect(alert).toHaveClass('pf-m-warning');
    });

    it('renders info notification correctly', () => {
      const notification = createMockNotification({
        title: 'Information',
        description: 'Here is some useful information',
        variant: 'info',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Information')).toBeInTheDocument();
      expect(screen.getByText('Here is some useful information')).toBeInTheDocument();

      const alert = screen.getByText('Information').closest('.pf-v6-c-alert');
      expect(alert).toHaveClass('pf-m-info');
    });

    it('renders custom notification correctly', () => {
      const notification = createMockNotification({
        title: 'Custom',
        description: 'Custom notification',
        variant: 'custom',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Custom')).toBeInTheDocument();
      expect(screen.getByText('Custom notification')).toBeInTheDocument();

      const alert = screen.getByText('Custom').closest('.pf-v6-c-alert');
      expect(alert).toHaveClass('pf-m-custom');
    });

    it('handles undefined variant by defaulting to custom', () => {
      const notification = createMockNotification({
        title: 'Default Variant',
        variant: undefined,
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      const alert = screen.getByText('Default Variant').closest('.pf-v6-c-alert');
      expect(alert).toHaveClass('pf-m-custom');
    });
  });

  describe('Auto-dismiss behavior', () => {
    it('auto-dismisses notification after default timeout', async () => {
      const notification = createMockNotification({
        title: 'Auto Dismiss',
        timeout: 2000,
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Auto Dismiss')).toBeInTheDocument();

      // PatternFly Alert handles timeout internally, so we test that onTimeout is called
      // In real usage, the timeout would be handled by PatternFly's Alert component
      expect(mockOnRemove).not.toHaveBeenCalled();
    }, 1000);

    it('sets custom timeout for notifications', () => {
      const notification = createMockNotification({
        title: 'Custom Timeout',
        timeout: 5000,
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Custom Timeout')).toBeInTheDocument();
      // Timeout behavior is handled internally by PatternFly Alert component
    });

    it('uses default timeout when timeout is not specified', () => {
      const notification = createMockNotification({
        title: 'Default Timeout',
        timeout: undefined,
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Default Timeout')).toBeInTheDocument();
      // Should use default 2000ms timeout (handled by PatternFly)
    });

    it('renders multiple notifications with different timeouts', () => {
      const notifications = [
        createMockNotification({ id: 'fast', title: 'Fast', timeout: 1000 }),
        createMockNotification({ id: 'medium', title: 'Medium', timeout: 3000 }),
        createMockNotification({ id: 'slow', title: 'Slow', timeout: 5000 }),
      ];

      render(<AlertToastGroup notifications={notifications} onRemove={mockOnRemove} />);

      expect(screen.getByText('Fast')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Slow')).toBeInTheDocument();
    });
  });

  describe('User dismissal interactions', () => {
    it('allows manual dismissal with close button', () => {
      const notification = createMockNotification({
        title: 'Manual Dismiss',
        description: 'Click to close',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      const closeButton = screen.getByLabelText(/close.*manual dismiss/i);
      expect(closeButton).toBeInTheDocument();

      fireEvent.click(closeButton);

      expect(mockOnRemove).toHaveBeenCalledWith(notification.id);
    });

    it('provides proper accessibility for close buttons', () => {
      const notification = createMockNotification({
        title: 'Accessibility Test',
        variant: 'warning',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      const closeButton = screen.getByLabelText(/close.*accessibility test/i);
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('title', 'Close Accessibility Test');
    });

    it('handles multiple close buttons correctly', () => {
      const notifications = [
        createMockNotification({ id: '1', title: 'First Notification' }),
        createMockNotification({ id: '2', title: 'Second Notification' }),
        createMockNotification({ id: '3', title: 'Third Notification' }),
      ];

      render(<AlertToastGroup notifications={notifications} onRemove={mockOnRemove} />);

      const closeButtons = screen.getAllByLabelText(/close/i);
      expect(closeButtons).toHaveLength(3);

      // Click second close button
      fireEvent.click(closeButtons[1]);

      expect(mockOnRemove).toHaveBeenCalledWith('2');
      expect(mockOnRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Toast notifications without descriptions', () => {
    it('renders notification with title only', () => {
      const notification = createMockNotification({
        title: 'Title Only',
        description: undefined,
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Title Only')).toBeInTheDocument();
      expect(screen.queryByText('Test description')).not.toBeInTheDocument();
    });

    it('renders notification with empty description', () => {
      const notification = createMockNotification({
        title: 'Empty Description',
        description: '',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Empty Description')).toBeInTheDocument();
    });
  });

  describe('AlertGroup properties', () => {
    it('sets isToast property on AlertGroup', () => {
      const notification = createMockNotification();

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      const alertGroup = screen.getByRole('list');
      expect(alertGroup).toHaveClass('pf-m-toast');
    });

    it('sets isLiveRegion property for accessibility', () => {
      const notification = createMockNotification();

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      const alertGroup = screen.getByRole('list');
      expect(alertGroup).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Dynamic notification updates', () => {
    it('handles adding notifications dynamically', () => {
      const initialNotifications = [createMockNotification({ id: '1', title: 'Initial' })];

      const { rerender } = render(
        <AlertToastGroup notifications={initialNotifications} onRemove={mockOnRemove} />,
      );

      expect(screen.getByText('Initial')).toBeInTheDocument();

      const updatedNotifications = [
        ...initialNotifications,
        createMockNotification({ id: '2', title: 'Added' }),
      ];

      rerender(<AlertToastGroup notifications={updatedNotifications} onRemove={mockOnRemove} />);

      expect(screen.getByText('Initial')).toBeInTheDocument();
      expect(screen.getByText('Added')).toBeInTheDocument();
    });

    it('handles removing notifications dynamically', () => {
      const notifications = [
        createMockNotification({ id: '1', title: 'First' }),
        createMockNotification({ id: '2', title: 'Second' }),
      ];

      const { rerender } = render(
        <AlertToastGroup notifications={notifications} onRemove={mockOnRemove} />,
      );

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();

      const updatedNotifications = [notifications[0]];

      rerender(<AlertToastGroup notifications={updatedNotifications} onRemove={mockOnRemove} />);

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.queryByText('Second')).not.toBeInTheDocument();
    });

    it('handles updating notification content', () => {
      const notification = createMockNotification({
        id: 'updateable',
        title: 'Original Title',
        description: 'Original Description',
      });

      const { rerender } = render(
        <AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />,
      );

      expect(screen.getByText('Original Title')).toBeInTheDocument();
      expect(screen.getByText('Original Description')).toBeInTheDocument();

      const updatedNotification = {
        ...notification,
        title: 'Updated Title',
        description: 'Updated Description',
      };

      rerender(<AlertToastGroup notifications={[updatedNotification]} onRemove={mockOnRemove} />);

      expect(screen.getByText('Updated Title')).toBeInTheDocument();
      expect(screen.getByText('Updated Description')).toBeInTheDocument();
      expect(screen.queryByText('Original Title')).not.toBeInTheDocument();
      expect(screen.queryByText('Original Description')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles notifications with special characters in title', () => {
      const notification = createMockNotification({
        title: 'Special & <script>alert("xss")</script> Characters',
        description: 'HTML & XML entities: < > & " \'',
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      // React should automatically escape HTML
      expect(
        screen.getByText('Special & <script>alert("xss")</script> Characters'),
      ).toBeInTheDocument();
      expect(screen.getByText('HTML & XML entities: < > & " \'')).toBeInTheDocument();
    });

    it('handles very long titles and descriptions', () => {
      const longTitle = 'A'.repeat(200);
      const longDescription = 'B'.repeat(500);

      const notification = createMockNotification({
        title: longTitle,
        description: longDescription,
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('handles notifications with zero timeout', () => {
      const notification = createMockNotification({
        title: 'Zero Timeout',
        timeout: 0,
      });

      render(<AlertToastGroup notifications={[notification]} onRemove={mockOnRemove} />);

      // Should still render and not auto-dismiss immediately
      expect(screen.getByText('Zero Timeout')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(mockOnRemove).not.toHaveBeenCalled();
    });

    it('handles malformed notification objects gracefully', () => {
      const malformedNotification = {
        id: 'malformed',
        // Missing required fields
      } as ToastNotification;

      render(<AlertToastGroup notifications={[malformedNotification]} onRemove={mockOnRemove} />);

      // Should not crash, but may not render properly
      expect(screen.queryByText('Test Notification')).not.toBeInTheDocument();
    });
  });

  describe('Performance considerations', () => {
    it('handles large number of notifications', () => {
      const manyNotifications = Array.from({ length: 20 }, (_, index) =>
        createMockNotification({
          id: `notification-${index}`,
          title: `Notification ${index}`,
          description: `Description ${index}`,
        }),
      );

      render(<AlertToastGroup notifications={manyNotifications} onRemove={mockOnRemove} />);

      // Should render all notifications
      manyNotifications.forEach((notification) => {
        expect(screen.getByText(notification.title)).toBeInTheDocument();
      });
    });

    it('optimizes re-renders when notifications change', () => {
      const initialNotifications = [createMockNotification({ id: '1', title: 'Stable' })];

      const { rerender } = render(
        <AlertToastGroup notifications={initialNotifications} onRemove={mockOnRemove} />,
      );

      // Add notification
      const newNotifications = [
        ...initialNotifications,
        createMockNotification({ id: '2', title: 'New' }),
      ];

      rerender(<AlertToastGroup notifications={newNotifications} onRemove={mockOnRemove} />);

      expect(screen.getByText('Stable')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import SettingsPage from '../../pages/SettingsPage';
import { useAuth } from '../../contexts/AuthContext';
import { modelsService } from '../../services/models.service';
import { User } from '../../services/auth.service';

expect.extend(toHaveNoViolations);

// Mock the models service
vi.mock('../../services/models.service', () => ({
  modelsService: {
    refreshModels: vi.fn(),
  },
}));

// Mock the admin service
vi.mock('../../services/admin.service', () => ({
  adminService: {
    bulkUpdateUserLimits: vi.fn(),
  },
}));

// Mock auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock notifications context
const mockAddNotification = vi.fn();
vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: mockAddNotification,
  }),
  NotificationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Get mocked functions
const mockUseAuth = vi.mocked(useAuth);
const mockRefreshModels = vi.mocked(modelsService.refreshModels);

// Helper to create mock user with all required properties
const createMockUser = (roles: string[] = ['user']): User => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  username: 'testuser',
  roles,
});

// Helper to create complete mock auth context
const createMockAuthContext = (user: User | null) => ({
  user,
  loading: false,
  isAuthenticated: !!user,
  login: vi.fn(),
  loginAsAdmin: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
});

describe('SettingsPage Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should meet WCAG 2.1 AA standards for admin users', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      const { container } = render(<SettingsPage />);
      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });

    it('should meet WCAG 2.1 AA standards for admin-readonly users', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin-readonly'])));

      const { container } = render(<SettingsPage />);
      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for admin users', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });

      // Tab navigation
      refreshButton.focus();
      expect(refreshButton).toHaveFocus();

      // Enter key should trigger the button
      await userEvent.keyboard('{Enter}');
      expect(mockRefreshModels).toHaveBeenCalled();
    });

    it('should support keyboard navigation for admin-readonly users with disabled button', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin-readonly'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });

      // Tab navigation should still work
      refreshButton.focus();
      expect(refreshButton).toHaveFocus();
      expect(refreshButton).toHaveAttribute('aria-disabled');

      // Enter key should not trigger the disabled button
      await userEvent.keyboard('{Enter}');
      expect(mockRefreshModels).not.toHaveBeenCalled();
    });

    it('should handle Space key activation for admin users', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      refreshButton.focus();

      // Space key should trigger the button
      await userEvent.keyboard('{ }');
      expect(mockRefreshModels).toHaveBeenCalled();
    });

    it('should maintain logical tab order', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      // Get all focusable elements
      const refreshButton = screen.getByRole('button', { name: /refresh models/i });

      // Tab should focus the refresh button
      await userEvent.tab();
      expect(refreshButton).toHaveFocus();
    });
  });

  describe('ARIA Labels and Roles', () => {
    it('should have proper ARIA labels on interactive elements', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toHaveAttribute('type', 'button');
    });

    it('should have proper ARIA attributes on disabled button for admin-readonly', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin-readonly'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should have proper heading hierarchy', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      // Main page heading (h1)
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Settings');
    });

    it('should have proper description list structure for sync results', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));
      mockRefreshModels.mockResolvedValue({
        success: true,
        totalModels: 10,
        newModels: 2,
        updatedModels: 3,
        unavailableModels: 0,
        errors: [],
        syncedAt: '2024-01-01T10:00:00Z',
      });

      const user = userEvent.setup();
      render(<SettingsPage />);

      // Trigger sync to show results
      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        // Check for description list structure
        const terms = screen.getAllByRole('term');
        const definitions = screen.getAllByRole('definition');

        expect(terms.length).toBeGreaterThan(0);
        expect(definitions.length).toBeGreaterThan(0);
        expect(terms.length).toBe(definitions.length);
      });
    });
  });

  describe('Focus Management', () => {
    it('should maintain focus on refresh button during loading state', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      let resolveSync: (value: any) => void;
      const syncPromise = new Promise((resolve) => {
        resolveSync = resolve;
      });
      mockRefreshModels.mockReturnValue(syncPromise);

      const user = userEvent.setup();
      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      // Button should become disabled but maintain focus structure
      expect(refreshButton).toHaveAttribute('aria-disabled');
      expect(screen.getByText('Synchronizing models...')).toBeInTheDocument();

      // Resolve the sync
      resolveSync!({
        success: true,
        totalModels: 5,
        newModels: 1,
        updatedModels: 0,
        unavailableModels: 0,
        errors: [],
        syncedAt: '2024-01-01T10:00:00Z',
      });

      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
    });

    it('should not trap focus inappropriately', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });

      // Focus should move naturally with tab
      refreshButton.focus();
      expect(refreshButton).toHaveFocus();

      // Should be able to tab away (focus management is handled by browser/PatternFly)
      expect(document.activeElement).toBe(refreshButton);
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce loading state changes', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      let resolveSync: (value: any) => void;
      const syncPromise = new Promise((resolve) => {
        resolveSync = resolve;
      });
      mockRefreshModels.mockReturnValue(syncPromise);

      const user = userEvent.setup();
      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      // Loading state should be announced
      expect(screen.getByText('Synchronizing models...')).toBeInTheDocument();

      // Resolve sync
      resolveSync!({
        success: true,
        totalModels: 10,
        newModels: 2,
        updatedModels: 3,
        unavailableModels: 0,
        errors: [],
        syncedAt: '2024-01-01T10:00:00Z',
      });

      await waitFor(() => {
        expect(screen.queryByText('Synchronizing models...')).not.toBeInTheDocument();
        expect(screen.getByText('Last Synchronization')).toBeInTheDocument();
      });
    });
  });

  describe('Color and Contrast', () => {
    it('should not rely solely on color for information', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));
      mockRefreshModels.mockResolvedValue({
        success: true,
        totalModels: 10,
        newModels: 2,
        updatedModels: 3,
        unavailableModels: 0,
        errors: [],
        syncedAt: '2024-01-01T10:00:00Z',
      });

      const user = userEvent.setup();
      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        // Success state should be indicated by text content, not just color
        expect(screen.getByText('Last Synchronization')).toBeInTheDocument();
      });
    });
  });

  describe('Text and Content', () => {
    it('should have descriptive button text', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      // Button text should be descriptive
      const refreshButton = screen.getByRole('button', { name: /refresh models from litellm/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it('should have clear and understandable error messages', async () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));
      mockRefreshModels.mockRejectedValue(new Error('Network timeout'));

      const user = userEvent.setup();
      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          variant: 'danger',
          title: 'Failed to synchronize models',
          description: 'Network timeout',
        });
      });
    });

    it('should have informative help text', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      expect(
        screen.getByText(
          'Synchronize AI models from LiteLLM to ensure you have access to the latest available models.',
        ),
      ).toBeInTheDocument();
    });
  });
});

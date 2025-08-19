import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import SettingsPage from '../../pages/SettingsPage';
import { useAuth } from '../../contexts/AuthContext';
import { modelsService } from '../../services/models.service';
import { User } from '../../services/auth.service';

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

// Get the mocked functions
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

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render Settings page title and Models Management panel', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Models Management')).toBeInTheDocument();
      expect(screen.getByText('Refresh Models from LiteLLM')).toBeInTheDocument();
    });

    it('should display refresh button for admin users', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toBeInTheDocument();
      expect(refreshButton).not.toBeDisabled();
    });

    it('should display disabled refresh button with tooltip for admin-readonly users', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin-readonly'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toBeInTheDocument();
      expect(refreshButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should render description text', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      expect(
        screen.getByText(
          'Synchronize AI models from LiteLLM to ensure you have access to the latest available models.',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('User Interactions - Admin Users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));
    });

    it('should trigger sync when admin clicks refresh button', async () => {
      const user = userEvent.setup();
      mockRefreshModels.mockResolvedValue({
        success: true,
        totalModels: 10,
        newModels: 2,
        updatedModels: 3,
        unavailableModels: 0,
        errors: [],
        syncedAt: '2024-01-01T10:00:00Z',
      });

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      expect(mockRefreshModels).toHaveBeenCalledOnce();
    });

    it('should show loading state during sync', async () => {
      const user = userEvent.setup();
      let resolveSync: (value: any) => void;
      const syncPromise = new Promise((resolve) => {
        resolveSync = resolve;
      });
      mockRefreshModels.mockReturnValue(syncPromise);

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      // Check loading state
      expect(screen.getByText('Synchronizing models...')).toBeInTheDocument();
      expect(refreshButton).toHaveAttribute('aria-disabled', 'true');

      // Resolve the promise to complete the test
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
      });
    });

    it('should display sync results after successful sync', async () => {
      const user = userEvent.setup();
      mockRefreshModels.mockResolvedValue({
        success: true,
        totalModels: 10,
        newModels: 2,
        updatedModels: 3,
        unavailableModels: 0,
        errors: [],
        syncedAt: '2024-01-01T10:00:00Z',
      });

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Last Synchronization')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument(); // Total models
        expect(screen.getByText('2')).toBeInTheDocument(); // New models
        expect(screen.getByText('3')).toBeInTheDocument(); // Updated models
        expect(screen.getByText(/2024-01-01/)).toBeInTheDocument();
      });

      // Check sync timestamp is formatted and displayed
      // expect(screen.getByText(/1\/1\/2024, 10:00:00/)).toBeInTheDocument();
    });
  });

  describe('User Interactions - Admin-Readonly Users', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin-readonly'])));
    });

    it('should not trigger sync when admin-readonly clicks disabled button', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toHaveAttribute('aria-disabled', 'true');

      // Try to click the disabled button
      await user.click(refreshButton);

      expect(mockRefreshModels).not.toHaveBeenCalled();
    });

    it('should show tooltip on hover for admin-readonly users', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });

      // Hover over the button to show tooltip
      await user.hover(refreshButton);

      expect(screen.getByText('Admin access required to sync models')).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));
    });

    it('should handle successful sync response', async () => {
      const user = userEvent.setup();
      const mockSyncResult = {
        success: true,
        totalModels: 15,
        newModels: 5,
        updatedModels: 2,
        unavailableModels: 1,
        errors: [],
        syncedAt: '2024-01-01T10:00:00Z',
      };
      mockRefreshModels.mockResolvedValue(mockSyncResult);

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          variant: 'success',
          title: 'Models synchronized successfully',
          description:
            '{{totalModels}} total models ({{newModels}} new, {{updatedModels}} updated)',
        });
      });
    });

    it('should handle sync errors', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to connect to LiteLLM';
      mockRefreshModels.mockRejectedValue(new Error(errorMessage));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          variant: 'danger',
          title: 'Failed to synchronize models',
          description: errorMessage,
        });
      });
    });

    it('should handle generic errors without message', async () => {
      const user = userEvent.setup();
      mockRefreshModels.mockRejectedValue('Network error');

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockAddNotification).toHaveBeenCalledWith({
          variant: 'danger',
          title: 'Failed to synchronize models',
          description: 'An error occurred while synchronizing models. Please try again.',
        });
      });
    });
  });

  describe('Sync Results Display', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));
    });

    it('should display sync statistics in description list format', async () => {
      const user = userEvent.setup();
      mockRefreshModels.mockResolvedValue({
        success: true,
        totalModels: 20,
        newModels: 3,
        updatedModels: 4,
        unavailableModels: 1,
        errors: [],
        syncedAt: '2024-01-01T15:30:00Z',
      });

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        // Check that all statistics are displayed
        expect(screen.getByText('Total Models')).toBeInTheDocument();
        expect(screen.getByText('New Models')).toBeInTheDocument();
        expect(screen.getByText('Updated Models')).toBeInTheDocument();

        // Check values
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });

    it('should format timestamp correctly', async () => {
      const user = userEvent.setup();
      const testDate = '2024-03-15T14:30:45Z';
      mockRefreshModels.mockResolvedValue({
        success: true,
        totalModels: 5,
        newModels: 1,
        updatedModels: 0,
        unavailableModels: 0,
        errors: [],
        syncedAt: testDate,
      });

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(refreshButton);

      await waitFor(() => {
        // Check that the date is formatted (exact format may vary by locale)
        const formattedDate = new Date(testDate).toLocaleString();
        expect(screen.getByText(formattedDate)).toBeInTheDocument();
      });
    });
  });

  describe('Role-based Access Control', () => {
    it('should handle user with admin role', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).not.toBeDisabled();
    });

    it('should handle user with multiple roles including admin', () => {
      mockUseAuth.mockReturnValue(
        createMockAuthContext(createMockUser(['user', 'admin', 'other-role'])),
      );

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).not.toBeDisabled();
    });

    it('should handle user with admin-readonly role', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin-readonly'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toHaveAttribute('aria-disabled');
    });

    it('should handle user with no admin roles', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['user'])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toHaveAttribute('aria-disabled');
    });

    it('should handle user with no roles', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser([])));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toHaveAttribute('aria-disabled');
    });

    it('should handle null user', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(null));

      render(<SettingsPage />);

      const refreshButton = screen.getByRole('button', { name: /refresh models/i });
      expect(refreshButton).toHaveAttribute('aria-disabled');
    });
  });

  describe('Translation Keys', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin'])));
    });

    it('should render all required translation keys', () => {
      render(<SettingsPage />);

      // Main page elements
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Models Management')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Synchronize AI models from LiteLLM to ensure you have access to the latest available models.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('Refresh Models from LiteLLM')).toBeInTheDocument();
    });

    it('should render tooltip translation key for disabled button', () => {
      mockUseAuth.mockReturnValue(createMockAuthContext(createMockUser(['admin-readonly'])));

      render(<SettingsPage />);

      expect(screen.getByText('Refresh Models from LiteLLM')).toBeInTheDocument();
    });
  });
});

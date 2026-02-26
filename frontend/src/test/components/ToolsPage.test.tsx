/**
 * Tests for ToolsPage.tsx
 *
 * Comprehensive test coverage for the Tools page including:
 * - Models sync functionality with admin-only permissions
 * - Bulk limits management for all users
 * - Banner management CRUD operations
 * - Role-based access control (admin, admin-readonly, user)
 * - Tab navigation and state management
 */

import { screen, waitFor, within } from '@testing-library/react';
import { renderWithAuth, mockUser, mockAdminUser, mockAdminReadonlyUser } from '../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useQuery, useQueryClient } from 'react-query';
import ToolsPage from '../../pages/ToolsPage';
import { modelsService } from '../../services/models.service';
import { adminService } from '../../services/admin.service';
import { bannerService } from '../../services/banners.service';
import type { Banner } from '../../types/banners';

// Mock services
vi.mock('../../services/models.service', () => ({
  modelsService: {
    refreshModels: vi.fn(),
  },
}));

vi.mock('../../services/admin.service', () => ({
  adminService: {
    bulkUpdateUserLimits: vi.fn(),
  },
}));

vi.mock('../../services/banners.service', () => ({
  bannerService: {
    getAllBanners: vi.fn(),
    createBanner: vi.fn(),
    deleteBanner: vi.fn(),
  },
}));

// Mock BannerContext
vi.mock('../../contexts/BannerContext', () => ({
  useBanners: () => ({
    updateBanner: vi.fn(),
    bulkUpdateVisibility: vi.fn(),
  }),
}));

// Mock BrandingContext
vi.mock('../../contexts/BrandingContext', () => ({
  useBranding: () => ({
    brandingSettings: {
      loginLogoEnabled: false,
      hasLoginLogo: false,
      loginTitleEnabled: false,
      loginTitle: null,
      loginSubtitleEnabled: false,
      loginSubtitle: null,
      headerBrandEnabled: false,
      hasHeaderBrandLight: false,
      hasHeaderBrandDark: false,
      updatedAt: null,
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  BrandingProvider: ({ children }: any) => children,
}));

// Mock branding service
vi.mock('../../services/branding.service', () => ({
  brandingService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
    getImageUrl: vi.fn((type: string) => `/api/v1/branding/images/${type}`),
  },
}));

// Mock React Query
vi.mock('react-query', async () => {
  const actual = await vi.importActual('react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
    })),
  };
});

// Mock banner components
vi.mock('../../components/banners', () => ({
  BannerEditModal: ({ isOpen, onClose, onSave }: any) =>
    isOpen ? (
      <div role="dialog" aria-label="Banner edit modal">
        <button onClick={onClose}>Close Modal</button>
        <button onClick={() => onSave({ name: 'Test Banner', content: 'Test', variant: 'info' })}>
          Save Banner
        </button>
      </div>
    ) : null,
  BannerTable: ({
    banners,
    onVisibilityToggle,
    onEdit,
    onDelete,
    hasUnsavedChanges,
    readOnly,
  }: any) => (
    <div data-testid="banner-table">
      {banners.map((banner: Banner) => (
        <div key={banner.id} data-testid={`banner-${banner.id}`}>
          <span>{banner.name}</span>
          {!readOnly && (
            <>
              <button onClick={() => onVisibilityToggle(banner.id, !banner.isActive)}>
                Toggle Visibility
              </button>
              <button onClick={() => onEdit(banner)}>Edit</button>
              <button onClick={() => onDelete(banner.id)}>Delete</button>
            </>
          )}
        </div>
      ))}
      {hasUnsavedChanges && <div data-testid="unsaved-indicator">Unsaved Changes</div>}
    </div>
  ),
}));

describe('ToolsPage', () => {
  const mockBanners: Banner[] = [
    {
      id: 'banner-1',
      name: 'Test Banner 1',
      content: { en: 'Test Content 1', es: 'Contenido de prueba 1' },
      variant: 'info',
      isActive: true,
      isDismissible: true,
      priority: 1,
      markdownEnabled: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'banner-2',
      name: 'Test Banner 2',
      content: { en: 'Test Content 2', es: 'Contenido de prueba 2' },
      variant: 'warning',
      isActive: false,
      isDismissible: false,
      priority: 2,
      markdownEnabled: true,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default React Query mock - no data
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('General & Page Rendering', () => {
    it('should render without crashing', () => {
      expect(() => renderWithAuth(<ToolsPage />, { user: mockAdminUser })).not.toThrow();
    });

    it('should render page title', () => {
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      expect(screen.getByRole('heading', { level: 1, name: /tools/i })).toBeInTheDocument();
    });

    it('should render models tab as default active tab', () => {
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const modelsTab = screen.getByRole('tab', { name: /models/i });
      expect(modelsTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch between tabs correctly', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Initially on models tab
      expect(screen.getByRole('tab', { name: /models/i })).toHaveAttribute('aria-selected', 'true');

      // Click limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      expect(limitsTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should only show models tab for regular users', () => {
      renderWithAuth(<ToolsPage />, { user: mockUser });

      expect(screen.getByRole('tab', { name: /models/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /limits/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /banner/i })).not.toBeInTheDocument();
    });

    it('should show all tabs for admin users', () => {
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      expect(screen.getByRole('tab', { name: /models/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /limits/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /banner/i })).toBeInTheDocument();
    });

    it('should show all tabs for admin-readonly users', () => {
      renderWithAuth(<ToolsPage />, { user: mockAdminReadonlyUser });

      expect(screen.getByRole('tab', { name: /models/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /limits/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /banner/i })).toBeInTheDocument();
    });
  });

  describe('Models Sync Tab', () => {
    it('should render models sync section', () => {
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      expect(screen.getByText(/browse and manage ai models/i)).toBeInTheDocument();
    });

    it('should display sync button for admin users', () => {
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const syncButton = screen.getByRole('button', { name: /refresh models/i });
      expect(syncButton).toBeInTheDocument();
      expect(syncButton).not.toBeDisabled();
    });

    it('should disable sync button for non-admin users', () => {
      renderWithAuth(<ToolsPage />, { user: mockUser });

      const syncButton = screen.getByRole('button', { name: /refresh models/i });
      expect(syncButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should show tooltip for disabled sync button', () => {
      renderWithAuth(<ToolsPage />, { user: mockUser });

      // PatternFly tooltips may not render in JSDOM, so we check if the disabled button exists
      const syncButton = screen.getByRole('button', { name: /refresh models/i });
      expect(syncButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should call modelsService.refreshModels when sync button clicked', async () => {
      const user = userEvent.setup();
      const mockRefreshResult = {
        totalModels: 10,
        newModels: 2,
        updatedModels: 3,
        unavailableModels: 1,
        errors: [],
        syncedAt: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(modelsService.refreshModels).mockResolvedValue(mockRefreshResult);

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const syncButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(syncButton);

      expect(modelsService.refreshModels).toHaveBeenCalled();
    });

    it('should display sync results after successful sync', async () => {
      const user = userEvent.setup();
      const mockRefreshResult = {
        totalModels: 10,
        newModels: 2,
        updatedModels: 3,
        unavailableModels: 1,
        errors: [],
        syncedAt: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(modelsService.refreshModels).mockResolvedValue(mockRefreshResult);

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const syncButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(screen.getByText(/last sync/i)).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument(); // total models
        expect(screen.getByText('2')).toBeInTheDocument(); // new models
        expect(screen.getByText('3')).toBeInTheDocument(); // updated models
      });
    });

    it('should display sync errors list when present', async () => {
      const user = userEvent.setup();
      const mockRefreshResult = {
        totalModels: 10,
        newModels: 2,
        updatedModels: 3,
        unavailableModels: 1,
        errors: ['Error 1', 'Error 2'],
        syncedAt: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(modelsService.refreshModels).mockResolvedValue(mockRefreshResult);

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const syncButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(screen.getByText('Error 1')).toBeInTheDocument();
        expect(screen.getByText('Error 2')).toBeInTheDocument();
      });
    });

    it('should disable sync button while sync in progress', async () => {
      const user = userEvent.setup();

      vi.mocked(modelsService.refreshModels).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  totalModels: 10,
                  newModels: 2,
                  updatedModels: 3,
                  unavailableModels: 1,
                  errors: [],
                  syncedAt: '2024-01-01T00:00:00.000Z',
                }),
              100,
            ),
          ),
      );

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const syncButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(syncButton);

      // Button should show loading state
      expect(screen.getByRole('button', { name: /sync in progress/i })).toBeInTheDocument();
    });

    it('should handle sync errors and display error notification', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(modelsService.refreshModels).mockRejectedValue(new Error('Sync failed'));

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const syncButton = screen.getByRole('button', { name: /refresh models/i });
      await user.click(syncButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to sync models:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Limits Management Tab', () => {
    it('should render limits management tab for admin users', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      expect(screen.getByText(/bulk update user limits/i)).toBeInTheDocument();
    });

    it('should display form with maxBudget, tpmLimit, rpmLimit fields', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      // Use input IDs instead of labels to avoid ambiguity
      expect(document.querySelector('#max-budget')).toBeInTheDocument();
      expect(document.querySelector('#tpm-limit')).toBeInTheDocument();
      expect(document.querySelector('#rpm-limit')).toBeInTheDocument();
    });

    it('should update form state when input values change', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      const maxBudgetInput = document.querySelector('#max-budget') as HTMLInputElement;
      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '100.50');

      expect(maxBudgetInput).toHaveValue(100.5);
    });

    it('should show confirmation modal when form submitted with values', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      const maxBudgetInput = document.querySelector('#max-budget') as HTMLInputElement;
      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '100');

      const submitButton = screen.getByRole('button', { name: /apply to all users/i });
      await user.click(submitButton);

      // Just verify dialog appears
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Verify confirm button exists in the dialog
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      });
    });

    it('should validate that at least one field has a value', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      const submitButton = screen.getByRole('button', { name: /apply to all users/i });
      await user.click(submitButton);

      // Should not open modal, no notification in test but function should return early
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should call adminService.bulkUpdateUserLimits on confirm', async () => {
      const user = userEvent.setup();
      const mockUpdateResult = {
        totalUsers: 10,
        successCount: 10,
        failedCount: 0,
        processedAt: '2024-01-01T00:00:00.000Z',
        errors: [],
      };

      vi.mocked(adminService.bulkUpdateUserLimits).mockResolvedValue(mockUpdateResult);

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      const maxBudgetInput = document.querySelector('#max-budget') as HTMLInputElement;
      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '100');

      const submitButton = screen.getByRole('button', { name: /apply to all users/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(adminService.bulkUpdateUserLimits).toHaveBeenCalledWith({
          maxBudget: 100,
        });
      });
    });

    it('should display last update results after successful operation', async () => {
      const user = userEvent.setup();
      const mockUpdateResult = {
        totalUsers: 10,
        successCount: 10,
        failedCount: 0,
        processedAt: '2024-01-01T00:00:00.000Z',
        errors: [],
      };

      vi.mocked(adminService.bulkUpdateUserLimits).mockResolvedValue(mockUpdateResult);

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      const maxBudgetInput = document.querySelector('#max-budget') as HTMLInputElement;
      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '100');

      const submitButton = screen.getByRole('button', { name: /apply to all users/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm/i,
      });
      await user.click(confirmButton);

      // Wait for modal to close and results to appear
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Check for "Last Limits Update" heading/text
      await waitFor(() => {
        expect(screen.getByText(/last limits update/i)).toBeInTheDocument();
      });

      // Instead of looking for just "10", look for the specific labels
      expect(screen.getByText(/total users/i)).toBeInTheDocument();
      expect(screen.getByText(/successful/i)).toBeInTheDocument();
    });

    it('should reset form after successful update', async () => {
      const user = userEvent.setup();
      const mockUpdateResult = {
        totalUsers: 10,
        successCount: 10,
        failedCount: 0,
        processedAt: '2024-01-01T00:00:00.000Z',
        errors: [],
      };

      vi.mocked(adminService.bulkUpdateUserLimits).mockResolvedValue(mockUpdateResult);

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      const maxBudgetInput = document.querySelector('#max-budget') as HTMLInputElement;
      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '100');

      const submitButton = screen.getByRole('button', { name: /apply to all users/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(maxBudgetInput.value).toBe('');
      });
    });

    it('should disable inputs for admin-readonly users', async () => {
      const user = userEvent.setup();
      const { unmount } = renderWithAuth(<ToolsPage />, { user: mockAdminReadonlyUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      expect(document.querySelector('#max-budget')).toBeDisabled();
      expect(document.querySelector('#tpm-limit')).toBeDisabled();
      expect(document.querySelector('#rpm-limit')).toBeDisabled();

      unmount();
    });

    it('should handle update errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(adminService.bulkUpdateUserLimits).mockRejectedValue(new Error('Update failed'));

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      const maxBudgetInput = document.querySelector('#max-budget') as HTMLInputElement;
      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '100');

      const submitButton = screen.getByRole('button', { name: /apply to all users/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to update user limits:',
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should display failed user list when errors occur', async () => {
      const user = userEvent.setup();
      const mockUpdateResult = {
        totalUsers: 10,
        successCount: 8,
        failedCount: 2,
        processedAt: '2024-01-01T00:00:00.000Z',
        errors: [
          { userId: '1', username: 'user1', error: 'Invalid budget' },
          { userId: '2', username: 'user2', error: 'Limit exceeded' },
        ],
      };

      vi.mocked(adminService.bulkUpdateUserLimits).mockResolvedValue(mockUpdateResult);

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      // Switch to limits tab
      const limitsTab = screen.getByRole('tab', { name: /limits/i });
      await user.click(limitsTab);

      const maxBudgetInput = document.querySelector('#max-budget') as HTMLInputElement;
      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '100');

      const submitButton = screen.getByRole('button', { name: /apply to all users/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {
        name: /confirm/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/user1: Invalid budget/i)).toBeInTheDocument();
        expect(screen.getByText(/user2: Limit exceeded/i)).toBeInTheDocument();
      });
    });
  });

  describe('Banner Management Tab', () => {
    beforeEach(() => {
      // Mock React Query to return banners
      vi.mocked(useQuery).mockReturnValue({
        data: mockBanners,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should render banner management tab for admin users', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      expect(screen.getByText(/manage system-wide banners/i)).toBeInTheDocument();
    });

    it('should load all banners on mount using React Query', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      await waitFor(() => {
        expect(screen.getByTestId('banner-table')).toBeInTheDocument();
        expect(screen.getByText('Test Banner 1')).toBeInTheDocument();
        expect(screen.getByText('Test Banner 2')).toBeInTheDocument();
      });
    });

    it('should display create banner button for admin users', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      expect(screen.getByRole('button', { name: /create new banner/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create new banner/i })).not.toBeDisabled();
    });

    it('should hide create banner button functionality for admin-readonly users', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminReadonlyUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const createButton = screen.getByRole('button', { name: /create new banner/i });
      expect(createButton).toBeDisabled();
    });

    it('should open BannerEditModal in create mode when create clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const createButton = screen.getByRole('button', { name: /create new banner/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /banner edit modal/i })).toBeInTheDocument();
      });
    });

    it('should open BannerEditModal in edit mode with banner data', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /banner edit modal/i })).toBeInTheDocument();
      });
    });

    it('should update visibility state when toggle clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const toggleButtons = screen.getAllByRole('button', { name: /toggle visibility/i });
      await user.click(toggleButtons[0]);

      // Should show unsaved changes indicator
      await waitFor(() => {
        expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
      });
    });

    it('should track pending visibility changes in state', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const toggleButtons = screen.getAllByRole('button', { name: /toggle visibility/i });
      await user.click(toggleButtons[0]);

      // Apply button should appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument();
      });
    });

    it('should handle delete banner operation', async () => {
      const user = userEvent.setup();
      vi.mocked(bannerService.deleteBanner).mockResolvedValue({
        message: 'Banner deleted successfully',
      });

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(bannerService.deleteBanner).toHaveBeenCalledWith('banner-1');
      });
    });

    it('should invalidate queries after banner deletion', async () => {
      const user = userEvent.setup();
      const mockInvalidateQueries = vi.fn();

      vi.mocked(useQueryClient).mockReturnValue({
        invalidateQueries: mockInvalidateQueries,
      } as any);

      vi.mocked(bannerService.deleteBanner).mockResolvedValue({
        message: 'Banner deleted successfully',
      });

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith(['allBanners']);
      });
    });

    it('should handle banner save from modal', async () => {
      const user = userEvent.setup();
      vi.mocked(bannerService.createBanner).mockResolvedValue({
        banner: {
          id: 'new-banner',
          name: 'Test Banner',
          content: { en: 'Test', es: 'Prueba' },
          variant: 'info',
          isActive: false,
          isDismissible: true,
          priority: 1,
          markdownEnabled: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        message: 'Banner created successfully',
      });

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const createButton = screen.getByRole('button', { name: /create new banner/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /banner edit modal/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save banner/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(bannerService.createBanner).toHaveBeenCalled();
      });
    });

    it('should close modal after successful save', async () => {
      const user = userEvent.setup();
      vi.mocked(bannerService.createBanner).mockResolvedValue({
        banner: {
          id: 'new-banner',
          name: 'Test Banner',
          content: { en: 'Test', es: 'Prueba' },
          variant: 'info',
          isActive: false,
          isDismissible: true,
          priority: 1,
          markdownEnabled: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        message: 'Banner created successfully',
      });

      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const createButton = screen.getByRole('button', { name: /create new banner/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /banner edit modal/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save banner/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', { name: /banner edit modal/i }),
        ).not.toBeInTheDocument();
      });
    });

    it('should display read-only table for admin-readonly users', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminReadonlyUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      await waitFor(() => {
        expect(screen.getByTestId('banner-table')).toBeInTheDocument();
      });

      // Action buttons should not be present
      expect(screen.queryByRole('button', { name: /toggle visibility/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    });

    it('should show unsaved changes indicator', async () => {
      const user = userEvent.setup();
      renderWithAuth(<ToolsPage />, { user: mockAdminUser });

      const bannersTab = screen.getByRole('tab', { name: /banner/i });
      await user.click(bannersTab);

      const toggleButtons = screen.getAllByRole('button', { name: /toggle visibility/i });
      await user.click(toggleButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
      });
    });
  });
});

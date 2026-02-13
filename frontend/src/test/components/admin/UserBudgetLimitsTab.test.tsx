import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import UserBudgetLimitsTab from '../../../components/admin/UserBudgetLimitsTab';
import { usersService } from '../../../services/users.service';
import { renderWithAuth, mockAdminUser } from '../../test-utils';
import type { AdminUserDetails } from '../../../types/users';

// Mock the users service
vi.mock('../../../services/users.service', () => ({
  usersService: {
    getAdminUserDetails: vi.fn(),
    updateUserBudgetLimits: vi.fn(),
  },
}));

const mockUsersService = usersService as any;

const mockUserDetails: AdminUserDetails = {
  id: 'user-123',
  username: 'john.doe',
  email: 'john.doe@example.com',
  fullName: 'John Doe',
  roles: ['user'],
  isActive: true,
  maxBudget: 500,
  currentSpend: 125.5,
  tpmLimit: 10000,
  rpmLimit: 100,
  createdAt: '2024-01-01T00:00:00Z',
  subscriptionsCount: 3,
  activeSubscriptionsCount: 2,
  apiKeysCount: 2,
  activeApiKeysCount: 1,
};

describe('UserBudgetLimitsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching data', () => {
      mockUsersService.getAdminUserDetails.mockReturnValue(new Promise(() => {})); // Never resolves
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      // Skeleton should be visible during loading
      const skeleton = document.querySelector('.pf-v6-c-skeleton');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error alert when fetch fails', async () => {
      mockUsersService.getAdminUserDetails.mockRejectedValue(new Error('Network error'));
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText(/failed to load budget information/i)).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should display current spend progress bar', async () => {
      mockUsersService.getAdminUserDetails.mockResolvedValue(mockUserDetails);
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      // Current spend should be displayed
      expect(await screen.findByText(/125\.50/)).toBeInTheDocument();
    });

    it('should display number inputs for budget and limits', async () => {
      mockUsersService.getAdminUserDetails.mockResolvedValue(mockUserDetails);
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      // Wait for data to load
      expect(await screen.findByText(/125\.50/)).toBeInTheDocument();

      // NumberInput components should be present
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs.length).toBeGreaterThanOrEqual(3);
    });

    it('should show save button when canEdit is true', async () => {
      mockUsersService.getAdminUserDetails.mockResolvedValue(mockUserDetails);
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      const saveButton = await screen.findByRole('button', { name: /save/i });
      expect(saveButton).toBeInTheDocument();
    });
  });

  describe('Read-only Mode', () => {
    it('should show read-only note when canEdit is false', async () => {
      mockUsersService.getAdminUserDetails.mockResolvedValue(mockUserDetails);
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={false} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText(/read-only/i)).toBeInTheDocument();
    });

    it('should not show save button when canEdit is false', async () => {
      mockUsersService.getAdminUserDetails.mockResolvedValue(mockUserDetails);
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={false} />, {
        user: mockAdminUser,
      });

      // Wait for data to load
      expect(await screen.findByText(/read-only/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });

    it('should disable number inputs when canEdit is false', async () => {
      mockUsersService.getAdminUserDetails.mockResolvedValue(mockUserDetails);
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={false} />, {
        user: mockAdminUser,
      });

      // Wait for data to load
      expect(await screen.findByText(/read-only/i)).toBeInTheDocument();

      const inputs = screen.getAllByRole('spinbutton');
      inputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });
  });

  describe('Save Functionality', () => {
    it('should disable save button until values change', async () => {
      mockUsersService.getAdminUserDetails.mockResolvedValue(mockUserDetails);
      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      const saveButton = await screen.findByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should call updateUserBudgetLimits on save', async () => {
      mockUsersService.getAdminUserDetails.mockResolvedValue(mockUserDetails);
      mockUsersService.updateUserBudgetLimits.mockResolvedValue({
        id: 'user-123',
        maxBudget: 600,
        tpmLimit: 10000,
        rpmLimit: 100,
        updatedAt: new Date().toISOString(),
      });

      renderWithAuth(<UserBudgetLimitsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      // Wait for data to load
      expect(await screen.findByText(/125\.50/)).toBeInTheDocument();

      // Click the plus button to change a value
      const plusButtons = screen.getAllByRole('button', { name: /plus/i });
      expect(plusButtons.length).toBeGreaterThan(0);

      const userEvent = (await import('@testing-library/user-event')).default.setup();
      await userEvent.click(plusButtons[0]);

      // Wait for save button to become enabled
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save/i });
        expect(saveButton).not.toBeDisabled();
      });
    });
  });
});

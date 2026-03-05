import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import UserSubscriptionsTab from '../../../components/admin/UserSubscriptionsTab';
import { usersService } from '../../../services/users.service';
import { modelsService } from '../../../services/models.service';
import { adminSubscriptionsService } from '../../../services/adminSubscriptions.service';
import { renderWithAuth, mockAdminUser } from '../../test-utils';

// Mock the services
vi.mock('../../../services/users.service', () => ({
  usersService: {
    getUserSubscriptions: vi.fn(),
    createUserSubscriptions: vi.fn(),
  },
}));

vi.mock('../../../services/models.service', () => ({
  modelsService: {
    getModels: vi.fn(),
  },
}));

vi.mock('../../../services/adminSubscriptions.service', () => ({
  adminSubscriptionsService: {
    deleteSubscription: vi.fn(),
  },
}));

const mockUsersService = usersService as any;
const mockModelsService = modelsService as any;
const mockAdminSubscriptionsService = adminSubscriptionsService as any;

const mockSubscriptionsResponse = {
  data: [
    {
      id: 'sub-1',
      modelId: 'model-1',
      modelName: 'GPT-4',
      provider: 'OpenAI',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'sub-2',
      modelId: 'model-2',
      modelName: 'Claude 3',
      provider: 'Anthropic',
      status: 'pending',
      statusReason: 'Waiting for approval',
      createdAt: '2024-02-01T00:00:00Z',
    },
    {
      id: 'sub-3',
      modelId: 'model-3',
      modelName: 'Llama 2',
      provider: 'Meta',
      status: 'denied',
      statusReason: 'Budget exceeded',
      createdAt: '2024-03-01T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
};

const mockModelsResponse = {
  models: [
    { id: 'model-1', name: 'GPT-4' },
    { id: 'model-2', name: 'Claude 3' },
    { id: 'model-3', name: 'Llama 2' },
    { id: 'model-4', name: 'Gemini Pro' },
    { id: 'model-5', name: 'Mistral Large' },
  ],
  pagination: { page: 1, limit: 100, total: 5, totalPages: 1 },
};

describe('UserSubscriptionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching data', () => {
      mockUsersService.getUserSubscriptions.mockReturnValue(new Promise(() => {}));
      renderWithAuth(<UserSubscriptionsTab userId="user-123" />, { user: mockAdminUser });

      const skeleton = document.querySelector('.pf-v6-c-skeleton');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error alert when fetch fails', async () => {
      mockUsersService.getUserSubscriptions.mockRejectedValue(new Error('Network error'));
      renderWithAuth(<UserSubscriptionsTab userId="user-123" />, { user: mockAdminUser });

      expect(await screen.findByText(/failed to load subscriptions/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no subscriptions exist', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      renderWithAuth(<UserSubscriptionsTab userId="user-123" />, { user: mockAdminUser });

      expect(await screen.findByText('No Subscriptions')).toBeInTheDocument();
    });
  });

  describe('Table Rendering', () => {
    it('should display subscriptions in a table', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue(mockSubscriptionsResponse);
      renderWithAuth(<UserSubscriptionsTab userId="user-123" />, { user: mockAdminUser });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();
      expect(screen.getByText('Claude 3')).toBeInTheDocument();
      expect(screen.getByText('Llama 2')).toBeInTheDocument();
    });

    it('should display provider information', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue(mockSubscriptionsResponse);
      renderWithAuth(<UserSubscriptionsTab userId="user-123" />, { user: mockAdminUser });

      expect(await screen.findByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByText('Meta')).toBeInTheDocument();
    });

    it('should display status badges with correct colors', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue(mockSubscriptionsResponse);
      renderWithAuth(<UserSubscriptionsTab userId="user-123" />, { user: mockAdminUser });

      // Wait for data to load
      expect(await screen.findByText('GPT-4')).toBeInTheDocument();

      // Status labels inside Label components - use exact text match
      const activeLabel = screen.getByText('Active');
      expect(activeLabel).toBeInTheDocument();
      expect(activeLabel.closest('.pf-v6-c-label')).toHaveClass('pf-m-green');

      const pendingLabel = screen.getByText('Pending');
      expect(pendingLabel).toBeInTheDocument();
      expect(pendingLabel.closest('.pf-v6-c-label')).toHaveClass('pf-m-orange');

      const deniedLabel = screen.getByText('Denied');
      expect(deniedLabel).toBeInTheDocument();
      expect(deniedLabel.closest('.pf-v6-c-label')).toHaveClass('pf-m-red');
    });

    it('should display status reason when available', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue(mockSubscriptionsResponse);
      renderWithAuth(<UserSubscriptionsTab userId="user-123" />, { user: mockAdminUser });

      expect(await screen.findByText('Waiting for approval')).toBeInTheDocument();
      expect(screen.getByText('Budget exceeded')).toBeInTheDocument();
    });
  });

  describe('Add Subscription', () => {
    it('should show "Add Subscription" button when canEdit is true', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue(mockSubscriptionsResponse);
      renderWithAuth(<UserSubscriptionsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();
      expect(screen.getByText('Add Subscription')).toBeInTheDocument();
    });

    it('should not show "Add Subscription" button when canEdit is false', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue(mockSubscriptionsResponse);
      renderWithAuth(<UserSubscriptionsTab userId="user-123" canEdit={false} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();
      expect(screen.queryByText('Add Subscription')).not.toBeInTheDocument();
    });

    it('should open modal with available models when clicking Add Subscription', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue(mockSubscriptionsResponse);
      mockModelsService.getModels.mockResolvedValue(mockModelsResponse);

      renderWithAuth(<UserSubscriptionsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByText('Add Subscription'));

      // Modal should show models not already subscribed
      await waitFor(() => {
        expect(screen.getByText('Gemini Pro')).toBeInTheDocument();
        expect(screen.getByText('Mistral Large')).toBeInTheDocument();
      });
    });

    it('should call createUserSubscriptions on submit', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue(mockSubscriptionsResponse);
      mockModelsService.getModels.mockResolvedValue(mockModelsResponse);
      mockUsersService.createUserSubscriptions.mockResolvedValue({
        created: [{ modelId: 'model-4', subscriptionId: 'new-sub-1' }],
        activated: [],
        alreadyActive: [],
      });

      renderWithAuth(<UserSubscriptionsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByText('Add Subscription'));

      // Wait for models to load and click one
      await waitFor(() => {
        expect(screen.getByText('Gemini Pro')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Gemini Pro'));

      // Find the submit button inside the modal (not the toolbar button)
      const modalDialog = screen.getByRole('dialog');
      const submitButton = modalDialog.querySelector('button.pf-m-primary');
      expect(submitButton).toBeInTheDocument();
      await user.click(submitButton!);

      await waitFor(() => {
        expect(mockUsersService.createUserSubscriptions).toHaveBeenCalledWith('user-123', [
          'model-4',
        ]);
      });
    });
  });

  describe('Remove Subscription', () => {
    it('should show remove action when canEdit is true', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue({
        data: [mockSubscriptionsResponse.data[0]],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      renderWithAuth(<UserSubscriptionsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();

      // Should have actions column
      const actionsToggle = document.querySelector('.pf-v6-c-menu-toggle');
      expect(actionsToggle).toBeInTheDocument();
    });

    it('should not show actions column when canEdit is false', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue({
        data: [mockSubscriptionsResponse.data[0]],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      renderWithAuth(<UserSubscriptionsTab userId="user-123" canEdit={false} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();

      // Should NOT have actions column
      const actionsToggle = document.querySelector('.pf-v6-c-menu-toggle');
      expect(actionsToggle).not.toBeInTheDocument();
    });

    it('should call deleteSubscription when confirming removal', async () => {
      mockUsersService.getUserSubscriptions.mockResolvedValue({
        data: [mockSubscriptionsResponse.data[0]],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      mockAdminSubscriptionsService.deleteSubscription.mockResolvedValue({ success: true });

      renderWithAuth(<UserSubscriptionsTab userId="user-123" canEdit={true} />, {
        user: mockAdminUser,
      });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();

      const user = userEvent.setup();

      // Open kebab menu
      const actionsToggle = document.querySelector('.pf-v6-c-menu-toggle') as HTMLElement;
      await user.click(actionsToggle);

      // Click Remove
      const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
      await user.click(removeItem);

      // Confirmation modal should appear with warning text
      expect(
        await screen.findByText(/are you sure you want to remove this subscription/i),
      ).toBeInTheDocument();

      // Confirm removal - find the danger button in the modal
      const modalDialog = screen.getAllByRole('dialog').pop()!;
      const confirmButton = modalDialog.querySelector('button.pf-m-danger') as HTMLElement;
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockAdminSubscriptionsService.deleteSubscription).toHaveBeenCalledWith(
          'sub-1',
          undefined,
        );
      });
    });
  });
});

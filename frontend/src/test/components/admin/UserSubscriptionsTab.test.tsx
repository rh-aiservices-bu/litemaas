import { screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import UserSubscriptionsTab from '../../../components/admin/UserSubscriptionsTab';
import { usersService } from '../../../services/users.service';
import { renderWithAuth, mockAdminUser } from '../../test-utils';

// Mock the users service
vi.mock('../../../services/users.service', () => ({
  usersService: {
    getUserSubscriptions: vi.fn(),
  },
}));

const mockUsersService = usersService as any;

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
});

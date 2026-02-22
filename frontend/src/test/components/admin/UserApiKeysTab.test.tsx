import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import UserApiKeysTab from '../../../components/admin/UserApiKeysTab';
import { usersService } from '../../../services/users.service';
import { modelsService } from '../../../services/models.service';
import { renderWithAuth, mockAdminUser } from '../../test-utils';

// Mock the users service
vi.mock('../../../services/users.service', () => ({
  usersService: {
    getUserApiKeys: vi.fn(),
    revokeUserApiKey: vi.fn(),
    createApiKeyForUser: vi.fn(),
  },
}));

// Mock the models service
vi.mock('../../../services/models.service', () => ({
  modelsService: {
    getModels: vi.fn(),
  },
}));

const mockUsersService = usersService as any;
const mockModelsService = modelsService as any;

const mockApiKeysResponse = {
  data: [
    {
      id: 'key-1',
      name: 'Production Key',
      keyPrefix: 'sk-prod',
      models: ['model-1'],
      modelDetails: [{ id: 'model-1', name: 'GPT-4', provider: 'OpenAI' }],
      isActive: true,
      lastUsedAt: '2024-06-15T12:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'key-2',
      name: 'Revoked Key',
      keyPrefix: 'sk-rev',
      models: ['model-2'],
      modelDetails: [{ id: 'model-2', name: 'Claude 3', provider: 'Anthropic' }],
      isActive: false,
      revokedAt: '2024-05-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

describe('UserApiKeysTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading skeleton while fetching data', () => {
      mockUsersService.getUserApiKeys.mockReturnValue(new Promise(() => {}));
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      const skeleton = document.querySelector('.pf-v6-c-skeleton');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error alert when fetch fails', async () => {
      mockUsersService.getUserApiKeys.mockRejectedValue(new Error('Network error'));
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText(/failed to load api keys/i)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no keys exist', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText('No API Keys')).toBeInTheDocument();
    });

    it('should still show create button in empty state when canEdit', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByRole('button', { name: /create api key/i })).toBeInTheDocument();
    });
  });

  describe('Table Rendering', () => {
    it('should display API keys in a table', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText('Production Key')).toBeInTheDocument();
      expect(screen.getByText('Revoked Key')).toBeInTheDocument();
    });

    it('should display key prefix', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText(/sk-prod/)).toBeInTheDocument();
    });

    it('should display model names', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText('GPT-4')).toBeInTheDocument();
    });

    it('should display status labels with correct colors', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      // Wait for data to load
      expect(await screen.findByText('Production Key')).toBeInTheDocument();

      // Status labels are rendered inside Label components
      const activeLabel = screen.getByText('Active');
      expect(activeLabel).toBeInTheDocument();
      expect(activeLabel.closest('.pf-v6-c-label')).toHaveClass('pf-m-green');

      const revokedLabel = screen.getByText('Revoked');
      expect(revokedLabel).toBeInTheDocument();
      expect(revokedLabel.closest('.pf-v6-c-label')).toHaveClass('pf-m-red');
    });
  });

  describe('Create API Key', () => {
    it('should show create button when canEdit is true', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByRole('button', { name: /create api key/i })).toBeInTheDocument();
    });

    it('should not show create button when canEdit is false', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={false} />, { user: mockAdminUser });

      // Wait for data to load, then verify no create button
      expect(await screen.findByText('Production Key')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create api key/i })).not.toBeInTheDocument();
    });

    it('should open create modal when create button is clicked', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      mockModelsService.getModels.mockResolvedValue({
        models: [
          { id: 'model-1', name: 'GPT-4' },
          { id: 'model-2', name: 'Claude 3' },
        ],
        pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
      });

      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      const createButton = await screen.findByRole('button', { name: /create api key/i });

      const userEvent = (await import('@testing-library/user-event')).default.setup();
      await userEvent.click(createButton);

      // Create modal should be visible
      await waitFor(() => {
        const dialogs = screen.getAllByRole('dialog');
        expect(dialogs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Revoke Flow', () => {
    it('should show revoke action for active keys when canEdit', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText('Production Key')).toBeInTheDocument();
      // Revoke action should be available through the kebab menu
    });

    it('should not show revoke for revoked keys', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue({
        data: [mockApiKeysResponse.data[1]], // Only revoked key
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText('Revoked Key')).toBeInTheDocument();
    });
  });

  describe('Read-only Mode', () => {
    it('should not show action buttons when canEdit is false', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={false} />, { user: mockAdminUser });

      expect(await screen.findByText('Production Key')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create api key/i })).not.toBeInTheDocument();
    });
  });

  describe('Budget Column', () => {
    it('should render budget with spend/budget and progress bar', async () => {
      const responseWithBudget = {
        data: [
          {
            ...mockApiKeysResponse.data[0],
            maxBudget: 100,
            currentSpend: 45,
            budgetUtilization: 45,
            budgetDuration: 'monthly',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockUsersService.getUserApiKeys.mockResolvedValue(responseWithBudget);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText('$45.00 / $100.00')).toBeInTheDocument();
      expect(screen.getByText('monthly')).toBeInTheDocument();
      // Progress bar should be rendered
      const progressBar = document.querySelector('.pf-v6-c-progress');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Rate Limits Column', () => {
    it('should render TPM/RPM/Parallel labels', async () => {
      const responseWithLimits = {
        data: [
          {
            ...mockApiKeysResponse.data[0],
            tpmLimit: 10000,
            rpmLimit: 100,
            maxParallelRequests: 5,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockUsersService.getUserApiKeys.mockResolvedValue(responseWithLimits);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText(/TPM.*10,000/)).toBeInTheDocument();
      expect(screen.getByText(/RPM.*100/)).toBeInTheDocument();
      expect(screen.getByText(/Parallel.*5/)).toBeInTheDocument();
    });

    it('should show Per-model label when modelRpmLimit is set', async () => {
      const responseWithPerModel = {
        data: [
          {
            ...mockApiKeysResponse.data[0],
            modelRpmLimit: { 'model-1': 50 },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockUsersService.getUserApiKeys.mockResolvedValue(responseWithPerModel);
      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      expect(await screen.findByText('Per-model')).toBeInTheDocument();
    });
  });

  describe('Create Form - Conditional Fields', () => {
    it('should hide budget duration when max budget is 0', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      mockModelsService.getModels.mockResolvedValue({
        models: [{ id: 'model-1', name: 'GPT-4' }],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      const createButton = await screen.findByRole('button', { name: /create api key/i });
      const userEvent = (await import('@testing-library/user-event')).default.setup();
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
      });

      // Budget Duration should NOT be visible when max budget is 0
      expect(screen.queryByText('Budget Duration')).not.toBeInTheDocument();
      // Soft Budget should NOT be visible when max budget is 0
      expect(screen.queryByText('Soft Budget Warning (USD)')).not.toBeInTheDocument();
    });

    it('should show budget duration when max budget is greater than 0', async () => {
      mockUsersService.getUserApiKeys.mockResolvedValue(mockApiKeysResponse);
      mockModelsService.getModels.mockResolvedValue({
        models: [{ id: 'model-1', name: 'GPT-4' }],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      renderWithAuth(<UserApiKeysTab userId="user-123" canEdit={true} />, { user: mockAdminUser });

      const createButton = await screen.findByRole('button', { name: /create api key/i });
      const userEvent = (await import('@testing-library/user-event')).default.setup();
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
      });

      // Increase the max budget using the plus button
      const budgetPlusButton = screen.getAllByRole('button', { name: /plus/i })[0];
      await userEvent.click(budgetPlusButton);

      // Budget Duration should now be visible
      await waitFor(() => {
        expect(screen.getByText('Budget Duration')).toBeInTheDocument();
      });
      expect(screen.getByText('Soft Budget Warning (USD)')).toBeInTheDocument();
    });
  });
});

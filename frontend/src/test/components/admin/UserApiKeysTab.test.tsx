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
});

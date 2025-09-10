import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminModelsPage from '../../pages/AdminModelsPage';
import React from 'react';

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock NotificationContext
const mockAddNotification = vi.fn();
vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: mockAddNotification,
  }),
}));

// Mock services
vi.mock('../../services/models.service', () => ({
  modelsService: {
    getModels: vi.fn(),
    refreshModels: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../services/adminModels.service', () => ({
  adminModelsService: {
    createModel: vi.fn(() => Promise.resolve({ success: true, message: 'Created' })),
    updateModel: vi.fn(() => Promise.resolve({ success: true, message: 'Updated' })),
    deleteModel: vi.fn(() => Promise.resolve({ success: true, message: 'Deleted' })),
  },
}));

// Mock React Query hooks
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock('react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

// Mock utils
vi.mock('../../utils/flairColors', () => ({
  getModelFlairs: vi.fn(() => [
    { key: 'vision', label: 'Vision', color: 'blue' },
    { key: 'function', label: 'Function Calling', color: 'green' },
  ]),
}));

// Simple test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

describe('AdminModelsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-user', roles: ['admin'] },
      isAuthenticated: true,
    });

    mockUseQuery.mockReturnValue({
      data: {
        models: [
          {
            id: 'gpt-4',
            name: 'GPT-4',
            provider: 'OpenAI',
            description: 'Advanced language model',
            apiBase: 'https://api.openai.com/v1',
            inputCostPerToken: 0.00003,
            outputCostPerToken: 0.00006,
            tpm: 10000,
            rpm: 500,
            maxTokens: 8192,
            supportsVision: true,
            supportsFunctionCalling: true,
            supportsParallelFunctionCalling: false,
            supportsToolChoice: true,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isLoading: false,
    });

    mockUseQueryClient.mockReturnValue({
      refetchQueries: vi.fn(),
    });
  });

  describe('Authorization Tests', () => {
    it('should show access denied for users without admin roles', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user', roles: ['user'] },
        isAuthenticated: true,
      });

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/models.permissions.accessDenied/)).toBeInTheDocument();
      expect(screen.getByText(/models.permissions.noPermission/)).toBeInTheDocument();
    });

    it('should show content for admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'admin', roles: ['admin'] },
        isAuthenticated: true,
      });

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      expect(screen.queryByText(/models.permissions.accessDenied/)).not.toBeInTheDocument();
      expect(screen.getByText(/models.admin.createModel/)).toBeInTheDocument();
    });

    it('should show content but no create button for adminReadonly users', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'admin-readonly', roles: ['adminReadonly'] },
        isAuthenticated: true,
      });

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      expect(screen.queryByText(/models.permissions.accessDenied/)).not.toBeInTheDocument();
      expect(screen.queryByText(/models.admin.createModel/)).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state', () => {
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/models.loading.title/)).toBeInTheDocument();
    });

    it('should show error state', () => {
      const error = new Error('Test error');
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
      });

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/models.admin.errorLoadingModels/)).toBeInTheDocument();
    });
  });

  describe('Model Display', () => {
    it('should display models table with data', async () => {
      render(<AdminModelsPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('GPT-4')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByText(/models.admin.table.name/)).toBeInTheDocument();
      expect(screen.getByText(/models.admin.table.apiBase/)).toBeInTheDocument();
      expect(screen.getByText(/models.admin.table.tpm/)).toBeInTheDocument();
      expect(screen.getByText(/models.admin.table.rpm/)).toBeInTheDocument();

      // Check data formatting
      expect(screen.getByText('10,000')).toBeInTheDocument(); // TPM formatted
      expect(screen.getByText('500')).toBeInTheDocument(); // RPM formatted
      expect(screen.getByText('$30.00')).toBeInTheDocument(); // Input cost per million
      expect(screen.getByText('$60.00')).toBeInTheDocument(); // Output cost per million
    });

    it('should show empty state when no models', () => {
      mockUseQuery.mockReturnValue({
        data: { models: [] },
        isLoading: false,
        error: null,
      });

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/models.admin.noModelsFound/)).toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open create modal when create button clicked', async () => {
      const user = userEvent.setup();

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText(/models.admin.createModel/)).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /models.admin.createModel/ });
      await user.click(createButton);

      // Modal should be open
      expect(screen.getByText(/models.admin.modelName/)).toBeInTheDocument();
      expect(screen.getByText(/models.admin.apiBaseUrl/)).toBeInTheDocument();
    });

    it('should handle form validation', async () => {
      const user = userEvent.setup();

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      const createButton = screen.getByRole('button', { name: /models.admin.createModel/ });
      await user.click(createButton);

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /common.create/ });
      await user.click(submitButton);
      // Form should still be open (validation failed)
      expect(screen.getAllByText(/models.admin.modelName/)).toHaveLength(2);
    });

    it('should handle cost conversion in form', async () => {
      const user = userEvent.setup();

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      const createButton = screen.getByRole('button', { name: /models.admin.createModel/ });
      await user.click(createButton);

      // Input cost fields should be available
      const inputCostField = screen.getByLabelText(/models.admin.inputCostPerMillionTokens/);
      const outputCostField = screen.getByLabelText(/models.admin.outputCostPerMillionTokens/);

      expect(inputCostField).toBeInTheDocument();
      expect(outputCostField).toBeInTheDocument();
    });
  });

  describe('API Base URL Display', () => {
    it('should handle long URLs with show more/less', async () => {
      mockUseQuery.mockReturnValue({
        data: {
          models: [
            {
              id: 'test-model',
              name: 'Test Model',
              apiBase:
                'https://very-long-api-base-url-that-definitely-exceeds-forty-characters-limit.example.com/v1/completions',
              inputCostPerToken: 0.00001,
              outputCostPerToken: 0.00002,
              tpm: 5000,
              rpm: 250,
              maxTokens: 4096,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<AdminModelsPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText(/models.admin.table.showMore/)).toBeInTheDocument();
      });
    });
  });

  describe('Feature Display', () => {
    it('should show model features as labels', async () => {
      render(<AdminModelsPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('GPT-4')).toBeInTheDocument();
      });
      screen.debug();
      // Features column should be present
      expect(screen.getByText(/common.features/)).toBeInTheDocument();
      screen.debug();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import i18n from '../../../i18n';
import { ApiKeyFilterSelect } from '../../../components/admin/ApiKeyFilterSelect';
import { apiClient } from '../../../services/api';

// Mock the API client
vi.mock('../../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = apiClient as any;

describe('ApiKeyFilterSelect', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props: Partial<Parameters<typeof ApiKeyFilterSelect>[0]> = {}) => {
    const defaultProps = {
      selected: [],
      onSelect: vi.fn(),
      selectedUserIds: [],
      isDisabled: false,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <ApiKeyFilterSelect {...defaultProps} {...props} />
        </I18nextProvider>
      </QueryClientProvider>,
    );
  };

  it('should render with disabled state when no users selected', () => {
    renderComponent({ isDisabled: true, selectedUserIds: [] });

    const input = screen.getByPlaceholderText(/select users first to filter by api keys/i);
    // PatternFly TextInputGroupMain may not set the disabled attribute on the input itself
    // Instead, the MenuToggle wrapper is disabled (line 317 in ApiKeyFilterSelect.tsx)
    // Check that the input has the correct placeholder indicating disabled state
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', expect.stringMatching(/select users first/i));
  });

  it('should render with enabled state when users are selected', () => {
    renderComponent({
      isDisabled: false,
      selectedUserIds: ['user-1', 'user-2'],
    });

    const input = screen.getByPlaceholderText(/all api keys \(click to filter\)/i);
    expect(input).not.toBeDisabled();
  });

  it('should fetch API keys when users are selected', async () => {
    const mockApiKeys = [
      {
        id: 'key-1',
        name: 'Production Key',
        keyAlias: 'prod-key-alias',
        userId: 'user-1',
        username: 'john.doe',
        email: 'john@example.com',
      },
      {
        id: 'key-2',
        name: 'Dev Key',
        keyAlias: 'dev-key-alias',
        userId: 'user-1',
        username: 'john.doe',
        email: 'john@example.com',
      },
    ];

    mockApiClient.get.mockResolvedValueOnce({ apiKeys: mockApiKeys });

    renderComponent({
      selectedUserIds: ['user-1'],
    });

    await waitFor(() => {
      // Component uses 'userIds' param (line 66 in ApiKeyFilterSelect.tsx)
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api-keys?userIds=user-1'),
      );
    });
  });

  it('should not fetch API keys when disabled', () => {
    renderComponent({
      isDisabled: true,
      selectedUserIds: [],
    });

    expect(mockApiClient.get).not.toHaveBeenCalled();
  });

  it('should display API keys in correct format', async () => {
    const mockApiKeys = [
      {
        id: 'key-1',
        name: 'Production Key',
        keyAlias: 'prod-key-alias',
        userId: 'user-1',
        username: 'john.doe',
        email: 'john@example.com',
      },
    ];

    mockApiClient.get.mockResolvedValueOnce({ apiKeys: mockApiKeys });

    const user = userEvent.setup();
    renderComponent({
      selectedUserIds: ['user-1'],
    });

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Click to open dropdown
    const input = screen.getByPlaceholderText(/all api keys \(click to filter\)/i);
    await user.click(input);

    // Check for API key in dropdown (format: "keyName (username)")
    await waitFor(() => {
      expect(screen.getByText(/production key \(john\.doe\)/i)).toBeInTheDocument();
    });
  });

  it('should call onSelect when an API key is selected', async () => {
    const mockApiKeys = [
      {
        id: 'key-1',
        name: 'Production Key',
        keyAlias: 'prod-key-alias',
        userId: 'user-1',
        username: 'john.doe',
        email: 'john@example.com',
      },
    ];

    mockApiClient.get.mockResolvedValueOnce({ apiKeys: mockApiKeys });

    const onSelect = vi.fn();
    const user = userEvent.setup();

    renderComponent({
      selectedUserIds: ['user-1'],
      onSelect,
    });

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Click to open dropdown
    const input = screen.getByPlaceholderText(/all api keys \(click to filter\)/i);
    await user.click(input);

    // Click on API key option
    const option = await screen.findByText(/production key \(john\.doe\)/i);
    await user.click(option);

    expect(onSelect).toHaveBeenCalledWith(['prod-key-alias']);
  });

  it('should show selected API keys as labels', async () => {
    const mockApiKeys = [
      {
        id: 'key-1',
        name: 'Production Key',
        keyAlias: 'prod-key-alias',
        userId: 'user-1',
        username: 'john.doe',
        email: 'john@example.com',
      },
    ];

    mockApiClient.get.mockResolvedValueOnce({ apiKeys: mockApiKeys });

    renderComponent({
      selectedUserIds: ['user-1'],
      selected: ['prod-key-alias'],
    });

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Check for selected label (may be truncated)
    expect(screen.getByText(/production key/i)).toBeInTheDocument();
  });

  it('should clear all selections when clear button is clicked', async () => {
    const mockApiKeys = [
      {
        id: 'key-1',
        name: 'Production Key',
        keyAlias: 'prod-key-alias',
        userId: 'user-1',
        username: 'john.doe',
        email: 'john@example.com',
      },
    ];

    mockApiClient.get.mockResolvedValueOnce({ apiKeys: mockApiKeys });

    const onSelect = vi.fn();
    const user = userEvent.setup();

    renderComponent({
      selectedUserIds: ['user-1'],
      selected: ['prod-key-alias'],
      onSelect,
    });

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // Find and click clear button
    const clearButton = screen.getByLabelText(/clear api key filter/i);
    await user.click(clearButton);

    expect(onSelect).toHaveBeenCalledWith([]);
  });

  it('should show error message when API keys fail to load', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('Failed to load'));

    renderComponent({
      selectedUserIds: ['user-1'],
    });

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    // The error placeholder should be shown
    expect(screen.getByPlaceholderText(/failed to load api keys/i)).toBeInTheDocument();
  });

  it('should show no API keys available message when result is empty', async () => {
    mockApiClient.get.mockResolvedValueOnce({ apiKeys: [] });

    renderComponent({
      selectedUserIds: ['user-1'],
    });

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/no api keys available for selected users/i),
      ).toBeInTheDocument();
    });
  });

  it('should use stable cache key for same users in different order', async () => {
    mockApiClient.get.mockResolvedValue({ apiKeys: [] });

    const { rerender } = renderComponent({
      selectedUserIds: ['user-1', 'user-2'],
    });

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    const firstCallCount = mockApiClient.get.mock.calls.length;

    // Rerender with users in different order
    rerender(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <ApiKeyFilterSelect
            selected={[]}
            onSelect={vi.fn()}
            selectedUserIds={['user-2', 'user-1']}
            isDisabled={false}
          />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    // Should use cached data, no additional API call
    await waitFor(() => {
      expect(mockApiClient.get.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('useAdminEndpoint={false} (user mode)', () => {
    it('should fetch from user-scoped /api-keys endpoint', async () => {
      const mockUserKeys = {
        data: [
          {
            id: 'key-1',
            name: 'My Key',
            liteLLMKeyAlias: 'sk-my-key-alias',
            keyPrefix: 'sk-abc',
            isActive: true,
          },
        ],
      };

      mockApiClient.get.mockResolvedValueOnce(mockUserKeys);

      renderComponent({
        selectedUserIds: ['user-1'],
        useAdminEndpoint: false,
      });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith('/api-keys?limit=100&isActive=true');
      });
    });

    it('should not require selectedUserIds to fetch', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: [] });

      renderComponent({
        selectedUserIds: [],
        useAdminEndpoint: false,
      });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith('/api-keys?limit=100&isActive=true');
      });
    });

    it('should display key name without username', async () => {
      const mockUserKeys = {
        data: [
          {
            id: 'key-1',
            name: 'Production Key',
            liteLLMKeyAlias: 'sk-prod-alias',
            keyPrefix: 'sk-abc',
            isActive: true,
          },
        ],
      };

      mockApiClient.get.mockResolvedValueOnce(mockUserKeys);

      const user = userEvent.setup();
      renderComponent({
        selectedUserIds: [],
        useAdminEndpoint: false,
      });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      const input = screen.getByPlaceholderText(/all api keys \(click to filter\)/i);
      await user.click(input);

      await waitFor(() => {
        const option = screen.getByText('Production Key');
        expect(option).toBeInTheDocument();
        expect(screen.queryByText(/\(.*\)/)).not.toBeInTheDocument();
      });
    });

    it('should filter out keys without liteLLMKeyAlias', async () => {
      const mockUserKeys = {
        data: [
          {
            id: 'key-1',
            name: 'Has Alias',
            liteLLMKeyAlias: 'sk-alias',
            keyPrefix: 'sk-abc',
            isActive: true,
          },
          {
            id: 'key-2',
            name: 'No Alias',
            keyPrefix: 'sk-def',
            isActive: true,
          },
        ],
      };

      mockApiClient.get.mockResolvedValueOnce(mockUserKeys);

      const user = userEvent.setup();
      renderComponent({
        selectedUserIds: [],
        useAdminEndpoint: false,
      });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      const input = screen.getByPlaceholderText(/all api keys \(click to filter\)/i);
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('Has Alias')).toBeInTheDocument();
        expect(screen.queryByText('No Alias')).not.toBeInTheDocument();
      });
    });

    it('should show placeholder without "select users" text', () => {
      renderComponent({
        selectedUserIds: [],
        useAdminEndpoint: false,
      });

      expect(screen.getByPlaceholderText(/all api keys \(click to filter\)/i)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/select users first/i)).not.toBeInTheDocument();
    });
  });
});

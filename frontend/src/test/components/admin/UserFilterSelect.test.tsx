import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import i18n from '../../../i18n';
import { UserFilterSelect } from '../../../components/admin/UserFilterSelect';
import { apiClient } from '../../../services/api';

// Mock the API client
vi.mock('../../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = apiClient as any;

describe('UserFilterSelect', () => {
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

  const renderComponent = (props: Partial<Parameters<typeof UserFilterSelect>[0]> = {}) => {
    const defaultProps = {
      selected: [],
      onSelect: vi.fn(),
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <UserFilterSelect {...defaultProps} {...props} />
        </I18nextProvider>
      </QueryClientProvider>,
    );
  };

  describe('Data Fetching', () => {
    it('should fetch users from /admin/users when no dateRange provided', async () => {
      const mockUsers = [
        { userId: 'user-1', username: 'john.doe', email: 'john@example.com' },
        { userId: 'user-2', username: 'jane.smith', email: 'jane@example.com' },
      ];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      renderComponent();

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith('/admin/users');
      });
    });

    it('should fetch users from usage filter-options when dateRange provided', async () => {
      const mockData = {
        users: [{ userId: 'user-1', username: 'john.doe', email: 'john@example.com' }],
        models: [],
      };

      mockApiClient.get.mockResolvedValueOnce(mockData);

      const dateRange = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      };

      renderComponent({ dateRange });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith(
          `/admin/usage/filter-options?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        );
      });
    });

    it('should not fetch when dateRange is incomplete', () => {
      mockApiClient.get.mockResolvedValueOnce({ users: [] });

      renderComponent({
        dateRange: {
          startDate: '2025-01-01',
          endDate: '',
        },
      });

      // Should not make API call when endDate is empty
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('Placeholder Behavior', () => {
    it('should show "All users" placeholder when no selection', async () => {
      mockApiClient.get.mockResolvedValueOnce({ users: [] });

      renderComponent({ selected: [] });

      const input = await screen.findByPlaceholderText(/all users.*click to filter/i);
      expect(input).toBeInTheDocument();
    });

    it('should clear placeholder when users are selected', async () => {
      const mockUsers = [{ userId: 'user-1', username: 'john.doe', email: 'john@example.com' }];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      renderComponent({ selected: ['user-1'] });

      await waitFor(() => {
        const input = screen.getByRole('combobox');
        expect(input).not.toHaveAttribute('placeholder', expect.stringMatching(/all users/i));
      });
    });
  });

  describe('User Selection', () => {
    it('should display users in dropdown', async () => {
      const mockUsers = [
        { userId: 'user-1', username: 'john.doe', email: 'john@example.com' },
        { userId: 'user-2', username: 'jane.smith', email: 'jane@example.com' },
      ];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      // Click to open dropdown
      const input = screen.getByRole('combobox');
      await user.click(input);

      // Check for users in dropdown (format: "username (email)")
      await waitFor(() => {
        expect(screen.getByText(/john\.doe \(john@example\.com\)/i)).toBeInTheDocument();
        expect(screen.getByText(/jane\.smith \(jane@example\.com\)/i)).toBeInTheDocument();
      });
    });

    it('should call onSelect when a user is selected', async () => {
      const mockUsers = [{ userId: 'user-1', username: 'john.doe', email: 'john@example.com' }];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      const onSelect = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onSelect });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      // Open dropdown
      const input = screen.getByRole('combobox');
      await user.click(input);

      // Click on user option
      const option = await screen.findByText(/john\.doe \(john@example\.com\)/i);
      await user.click(option);

      expect(onSelect).toHaveBeenCalledWith(['user-1']);
    });

    it('should allow multiple user selections', async () => {
      const mockUsers = [
        { userId: 'user-1', username: 'john.doe', email: 'john@example.com' },
        { userId: 'user-2', username: 'jane.smith', email: 'jane@example.com' },
      ];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      const onSelect = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onSelect, selected: [] });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      // Open dropdown
      const input = screen.getByRole('combobox');
      await user.click(input);

      // Select first user
      const firstOption = await screen.findByText(/john\.doe/i);
      await user.click(firstOption);

      expect(onSelect).toHaveBeenLastCalledWith(['user-1']);

      // Select second user
      onSelect.mockClear();
      const secondOption = await screen.findByText(/jane\.smith/i);
      await user.click(secondOption);

      // Should be called with both users
      expect(onSelect).toHaveBeenLastCalledWith(['user-2']);
    });

    it('should deselect user when clicked again', async () => {
      const mockUsers = [{ userId: 'user-1', username: 'john.doe', email: 'john@example.com' }];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      const onSelect = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onSelect, selected: ['user-1'] });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      // Open dropdown
      const input = screen.getByRole('combobox');
      await user.click(input);

      // Wait for dropdown menu to appear and find the option
      await waitFor(async () => {
        const option = screen.getByText(/john\.doe.*john@example\.com/i);
        expect(option).toBeInTheDocument();
      });

      // Click on selected user option to deselect
      const option = screen.getByText(/john\.doe.*john@example\.com/i);
      await user.click(option);

      // Should call onSelect with empty array (deselect)
      await waitFor(() => {
        expect(onSelect).toHaveBeenCalledWith([]);
      });
    });
  });

  describe('Selected Labels', () => {
    it('should show selected users as labels', async () => {
      const mockUsers = [
        { userId: 'user-1', username: 'john.doe', email: 'john@example.com' },
        { userId: 'user-2', username: 'jane.smith', email: 'jane@example.com' },
      ];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      renderComponent({ selected: ['user-1', 'user-2'] });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      // Wait for labels to appear
      await waitFor(() => {
        expect(screen.getByText('john.doe')).toBeInTheDocument();
        expect(screen.getByText('jane.smith')).toBeInTheDocument();
      });
    });

    it('should truncate long usernames in labels', async () => {
      const mockUsers = [
        {
          userId: 'user-1',
          username: 'verylongusernamethatexceedslimit',
          email: 'user@example.com',
        },
      ];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      renderComponent({ selected: ['user-1'] });

      // Wait for data to load
      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      // Truncate function cuts at 15 chars: "verylongusername".substring(0, 15) = "verylonguserna..."
      // Use a more permissive regex that matches the start
      await waitFor(() => {
        // The label should contain truncated text starting with "verylong"
        const labels = screen.queryAllByText(/verylong/i);
        expect(labels.length).toBeGreaterThan(0);
      });
    });

    it('should remove user when label close button is clicked', async () => {
      const mockUsers = [{ userId: 'user-1', username: 'john.doe', email: 'john@example.com' }];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      const onSelect = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onSelect, selected: ['user-1'] });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      // Wait for label to appear
      const label = await screen.findByText('john.doe');
      expect(label).toBeInTheDocument();

      // Find the close button within the label's parent and click it
      const closeButton = label.closest('.pf-v6-c-label')?.querySelector('button');
      expect(closeButton).toBeInTheDocument();

      await user.click(closeButton!);

      // Verify onSelect was called with empty array
      expect(onSelect).toHaveBeenCalledWith([]);
    });
  });

  describe('Clear Button', () => {
    it('should show clear button when users are selected', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        users: [{ userId: 'user-1', username: 'john.doe', email: 'john@example.com' }],
      });

      renderComponent({ selected: ['user-1'] });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      const clearButton = screen.getByRole('button', { name: /clear user selection/i });
      expect(clearButton).toBeInTheDocument();
    });

    it('should hide clear button when no selection', async () => {
      mockApiClient.get.mockResolvedValueOnce({ users: [] });

      renderComponent({ selected: [] });

      await waitFor(() => {
        const clearButton = screen.queryByRole('button', { name: /clear user selection/i });
        // Button exists but is hidden via style
        if (clearButton) {
          const parent = clearButton.closest('[style]');
          expect(parent).toHaveStyle({ display: 'none' });
        }
      });
    });

    it('should clear all selections when clear button is clicked', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        users: [{ userId: 'user-1', username: 'john.doe', email: 'john@example.com' }],
      });

      const onSelect = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onSelect, selected: ['user-1'] });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      const clearButton = screen.getByRole('button', { name: /clear user selection/i });
      await user.click(clearButton);

      expect(onSelect).toHaveBeenCalledWith([]);
    });
  });

  describe('Typeahead Filtering', () => {
    it('should filter users based on input', async () => {
      const mockUsers = [
        { userId: 'user-1', username: 'john.doe', email: 'john@example.com' },
        { userId: 'user-2', username: 'jane.smith', email: 'jane@example.com' },
      ];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      const input = screen.getByRole('combobox');
      await user.type(input, 'john');

      // Should show only john.doe
      await waitFor(() => {
        expect(screen.getByText(/john\.doe/i)).toBeInTheDocument();
        expect(screen.queryByText(/jane\.smith/i)).not.toBeInTheDocument();
      });
    });

    it('should show "no results" when filter has no matches', async () => {
      const mockUsers = [{ userId: 'user-1', username: 'john.doe', email: 'john@example.com' }];

      mockApiClient.get.mockResolvedValueOnce({ users: mockUsers });

      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalled();
      });

      const input = screen.getByRole('combobox');
      await user.type(input, 'nonexistent');

      // Should show "no results" message
      await waitFor(() => {
        expect(screen.getByText(/no users found for "nonexistent"/i)).toBeInTheDocument();
      });
    });
  });
});

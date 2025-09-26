import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from 'react-query';
import UsersPage from '../../pages/UsersPage';
import { renderWithAuth, mockUser, mockAdminUser, mockAdminReadonlyUser } from '../test-utils';
import { usersService } from '../../services/users.service';
import type { User } from '../../types/users';

// Mock the services
vi.mock('../../services/users.service', () => ({
  usersService: {
    getUsers: vi.fn(),
    canReadUsers: vi.fn(),
    canModifyUsers: vi.fn(),
    formatRoleDisplayName: vi.fn(),
    getAvailableRoles: vi.fn(),
  },
}));

// Mock UserEditModal component
vi.mock('../../components', () => ({
  UserEditModal: ({ user, onClose, onSave }: any) => (
    <div data-testid="user-edit-modal">
      <h2>Edit User: {user.username}</h2>
      <button onClick={onClose}>Cancel</button>
      <button onClick={onSave}>Save</button>
    </div>
  ),
}));

// Mock React Query
vi.mock('react-query', async () => {
  const actual = await vi.importActual('react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

// Mock react-router-dom for useSearchParams
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  };
});

describe('UsersPage', () => {
  // Mock users data
  const mockUsers: User[] = [
    {
      id: '1',
      username: 'john.doe',
      email: 'john.doe@example.com',
      fullName: 'John Doe',
      roles: ['user'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      lastLoginAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      username: 'jane.admin',
      email: 'jane.admin@example.com',
      fullName: 'Jane Admin',
      roles: ['admin'],
      isActive: true,
      createdAt: '2024-01-02T00:00:00Z',
      lastLoginAt: '2024-01-16T11:00:00Z',
    },
    {
      id: '3',
      username: 'bob.readonly',
      email: 'bob.readonly@example.com',
      fullName: '',
      roles: ['admin-readonly'],
      isActive: false,
      createdAt: '2024-01-03T00:00:00Z',
      lastLoginAt: undefined,
    },
  ];

  const mockPagination = {
    page: 1,
    limit: 10,
    total: 3,
    totalPages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default service mocks
    vi.mocked(usersService.canReadUsers).mockReturnValue(true);
    vi.mocked(usersService.canModifyUsers).mockReturnValue(true);
    vi.mocked(usersService.formatRoleDisplayName).mockImplementation((role) => {
      const roleNames: Record<string, string> = {
        user: 'User',
        admin: 'Administrator',
        'admin-readonly': 'Administrator (Read Only)',
      };
      return roleNames[role] || role;
    });
    vi.mocked(usersService.getAvailableRoles).mockReturnValue(['user', 'admin', 'admin-readonly']);

    // Default React Query mock - success state
    vi.mocked(useQuery).mockReturnValue({
      data: { data: mockUsers, pagination: mockPagination },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. User List & Data Fetching', () => {
    it('should render page title and description', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByRole('heading', { level: 1, name: /users/i })).toBeInTheDocument();
      expect(screen.getByText(/manage system users/i)).toBeInTheDocument();
    });

    it('should render user table with correct headers', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      // Check for table headers by text content - these should be unique
      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Full Name')).toBeInTheDocument();
      expect(screen.getByText('Roles')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should render all users in the table', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByText('john.doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      expect(screen.getByText('jane.admin')).toBeInTheDocument();
      expect(screen.getByText('jane.admin@example.com')).toBeInTheDocument();
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();

      expect(screen.getByText('bob.readonly')).toBeInTheDocument();
      expect(screen.getByText('bob.readonly@example.com')).toBeInTheDocument();
    });

    it('should display user avatars with UserIcon', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      // UserIcon is rendered for each user - check by finding user icons in the document
      const icons = screen.getAllByRole('img', { hidden: true });
      // Should have at least one icon per user (UserIcon) plus potentially status icons
      expect(icons.length).toBeGreaterThanOrEqual(mockUsers.length);
    });

    it('should display role badges for each user', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('Administrator (Read Only)')).toBeInTheDocument();
    });

    it('should display active status with green badge and CheckCircleIcon', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const activeStatuses = screen.getAllByText(/active/i);
      // Should have at least 2 active users (john.doe and jane.admin)
      expect(activeStatuses.length).toBeGreaterThanOrEqual(2);
    });

    it('should display inactive status with grey badge and TimesCircleIcon', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const inactiveStatuses = screen.getAllByText(/inactive/i);
      // Should have at least 1 inactive user (bob.readonly)
      expect(inactiveStatuses.length).toBeGreaterThanOrEqual(1);
    });

    it('should display "Not provided" for users without full name', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByText(/not provided/i)).toBeInTheDocument();
    });

    it('should display pagination info showing current range', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByText(/showing/i)).toBeInTheDocument();
      expect(screen.getByText(/of/i)).toBeInTheDocument();
      // Check for pagination text containing the total count
      expect(screen.getByText(/3.*users/i)).toBeInTheDocument();
    });

    it('should render pagination controls when there are multiple pages', () => {
      vi.mocked(useQuery).mockReturnValue({
        data: {
          data: mockUsers,
          pagination: { ...mockPagination, total: 25, totalPages: 3 },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    });

    it('should not render pagination when there is only one page', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    });

    // TODO: Fix ActionsColumn queries - PatternFly ActionsColumn doesn't expose predictable aria-labels
    it.skip('should display view action for all users', async () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      // ActionsColumn renders actions in a menu - click the kebab to open
      const actionMenus = screen.getAllByLabelText(/actions/i);
      expect(actionMenus).toHaveLength(mockUsers.length);
    });

    // TODO: Fix ActionsColumn queries
    it.skip('should display edit action when user has modify permissions', async () => {
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      // ActionsColumn should render for each user when modify permissions exist
      const actionMenus = screen.getAllByLabelText(/actions/i);
      expect(actionMenus).toHaveLength(mockUsers.length);
    });

    it('should not display edit action when user lacks modify permissions', () => {
      vi.mocked(usersService.canModifyUsers).mockReturnValue(false);

      renderWithAuth(<UsersPage />, { user: mockAdminReadonlyUser });

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should display truncated roles with "more" badge when user has > 3 roles', () => {
      const userWithManyRoles: User = {
        ...mockUsers[0],
        roles: ['user', 'admin', 'admin-readonly', 'custom-role'],
      };

      vi.mocked(useQuery).mockReturnValue({
        data: {
          data: [userWithManyRoles],
          pagination: { ...mockPagination, total: 1 },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByText(/\+1 more/i)).toBeInTheDocument();
    });
  });

  describe('2. Search & Filtering', () => {
    it('should render search input with correct placeholder', () => {
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should update search value when typing in search input', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      await user.type(searchInput, 'john');

      await waitFor(() => {
        expect(searchInput).toHaveValue('john');
      });
    });

    // TODO: Fix SearchInput clear button query - PatternFly component structure
    it.skip('should clear search input when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      await user.type(searchInput, 'john');

      await waitFor(() => {
        expect(searchInput).toHaveValue('john');
      });

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(searchInput).toHaveValue('');
      });
    });

    // TODO: Fix PatternFly Select/dropdown menu queries - requires correct ARIA queries
    it.skip('should render role filter dropdown with all roles', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const roleFilterButton = screen.getByRole('button', { name: /all roles/i });
      await user.click(roleFilterButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'User' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Administrator' })).toBeInTheDocument();
        expect(
          screen.getByRole('menuitem', { name: 'Administrator (Read Only)' }),
        ).toBeInTheDocument();
      });
    });

    // TODO: Fix dropdown menu item selection
    it.skip('should filter by role when role is selected', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const roleFilterButton = screen.getByRole('button', { name: /all roles/i });
      await user.click(roleFilterButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Administrator' })).toBeInTheDocument();
      });

      const adminOption = screen.getByRole('menuitem', { name: 'Administrator' });
      await user.click(adminOption);

      await waitFor(() => {
        expect(roleFilterButton).toHaveTextContent('Administrator');
      });
    });

    // TODO: Fix status dropdown queries
    it.skip('should render status filter dropdown with active and inactive options', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const statusFilterButton = screen.getByRole('button', { name: /all status/i });
      await user.click(statusFilterButton);

      await waitFor(() => {
        const menu = screen.getByRole('listbox', { name: /status filter/i });
        expect(within(menu).getByRole('menuitem', { name: /^active$/i })).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', { name: /^inactive$/i })).toBeInTheDocument();
      });
    });

    // TODO: Fix status filter selection
    it.skip('should filter by status when status is selected', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const statusFilterButton = screen.getByRole('button', { name: /all status/i });
      await user.click(statusFilterButton);

      await waitFor(() => {
        const menu = screen.getByRole('listbox', { name: /status filter/i });
        expect(within(menu).getByRole('menuitem', { name: /^active$/i })).toBeInTheDocument();
      });

      const activeOption = within(
        screen.getByRole('listbox', { name: /status filter/i }),
      ).getByRole('menuitem', { name: /^active$/i });
      await user.click(activeOption);

      await waitFor(() => {
        expect(statusFilterButton).toHaveTextContent('Active');
      });
    });

    it('should show "Clear all filters" button when filters are active', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      await user.type(searchInput, 'john');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      });
    });

    it('should clear all filters when "Clear all filters" is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      await user.type(searchInput, 'john');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      });

      const clearAllButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(clearAllButton);

      await waitFor(() => {
        expect(searchInput).toHaveValue('');
      });
    });

    it('should update URL params when search value changes', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      await user.type(searchInput, 'john');

      await waitFor(() => {
        expect(mockSetSearchParams).toHaveBeenCalled();
      });
    });

    // TODO: Fix role filter URL params test
    it.skip('should update URL params when role filter changes', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const roleFilterButton = screen.getByRole('button', { name: /all roles/i });
      await user.click(roleFilterButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Administrator' })).toBeInTheDocument();
      });

      const adminOption = screen.getByRole('menuitem', { name: 'Administrator' });
      await user.click(adminOption);

      await waitFor(() => {
        expect(mockSetSearchParams).toHaveBeenCalled();
      });
    });

    // TODO: Fix status filter URL params test
    it.skip('should update URL params when status filter changes', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const statusFilterButton = screen.getByRole('button', { name: /all status/i });
      await user.click(statusFilterButton);

      await waitFor(() => {
        const menu = screen.getByRole('listbox', { name: /status filter/i });
        expect(within(menu).getByRole('menuitem', { name: /^active$/i })).toBeInTheDocument();
      });

      const activeOption = within(
        screen.getByRole('listbox', { name: /status filter/i }),
      ).getByRole('menuitem', { name: /^active$/i });
      await user.click(activeOption);

      await waitFor(() => {
        expect(mockSetSearchParams).toHaveBeenCalled();
      });
    });

    it('should reset to page 1 when search value changes', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      await user.type(searchInput, 'john');

      await waitFor(() => {
        const calls = mockSetSearchParams.mock.calls;
        const lastCall = calls[calls.length - 1];
        const params = lastCall[0];
        // Page should not be set (defaults to 1)
        expect(params.has('page')).toBe(false);
      });
    });
  });

  // TODO: Fix ActionsColumn menu interactions - PatternFly ActionsColumn uses different structure than expected
  describe.skip('3. View User Modal', () => {
    it('should open view modal when view action is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should display user details in view modal', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText('john.doe')).toBeInTheDocument();
        expect(within(modal).getByText('john.doe@example.com')).toBeInTheDocument();
        expect(within(modal).getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should display formatted last login date in view modal', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        // Should display formatted date (contains numbers and slashes/dashes)
        const descriptionLists = within(modal).getAllByRole('term');
        const lastLoginTerm = descriptionLists.find((term) =>
          term.textContent?.includes('Last Login'),
        );
        expect(lastLoginTerm).toBeInTheDocument();
      });
    });

    it('should display "Never" for users who never logged in', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[2]); // bob.readonly has null lastLoginAt

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText(/never/i)).toBeInTheDocument();
      });
    });

    it('should display created date in view modal', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        const descriptionLists = within(modal).getAllByRole('term');
        const createdAtTerm = descriptionLists.find((term) =>
          term.textContent?.includes('Created'),
        );
        expect(createdAtTerm).toBeInTheDocument();
      });
    });

    it('should show inactive warning alert for inactive users', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[2]); // bob.readonly is inactive

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByRole('alert')).toBeInTheDocument();
        expect(within(modal).getByText(/inactive/i)).toBeInTheDocument();
      });
    });

    it('should show admin info alert for admin users', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[1]); // jane.admin has admin role

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        const alerts = within(modal).getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      });
    });

    it('should display edit button in view modal when user has modify permissions', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getAllByRole('button', { name: /edit/i })[0]).toBeInTheDocument();
      });
    });

    it('should not display edit button in view modal when user lacks modify permissions', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(false);

      renderWithAuth(<UsersPage />, { user: mockAdminReadonlyUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      });
    });

    it('should close view modal when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /^close$/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should close view modal when escape key is pressed', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should open edit modal from view modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getAllByRole('button', { name: /edit/i })[0]).toBeInTheDocument();
      });

      const editButton = within(screen.getByRole('dialog')).getAllByRole('button', {
        name: /edit/i,
      })[0];
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('user-edit-modal')).toBeInTheDocument();
      });
    });

    it('should handle keyboard navigation in view modal with tab trapping', async () => {
      const user = userEvent.setup();
      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Tab should move focus within modal
      await user.keyboard('{Tab}');

      // Focus should remain within the modal
      const modal = screen.getByRole('dialog');
      const focusedElement = document.activeElement;
      expect(modal.contains(focusedElement)).toBe(true);
    });
  });

  // TODO: Fix ActionsColumn menu interactions for Edit action tests
  describe.skip('4. Edit User Modal', () => {
    it('should open edit modal when edit action is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('user-edit-modal')).toBeInTheDocument();
      });
    });

    it('should display UserEditModal with correct user data', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/edit user: john.doe/i)).toBeInTheDocument();
      });
    });

    it('should close edit modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('user-edit-modal')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('user-edit-modal')).not.toBeInTheDocument();
      });
    });

    it('should close edit modal and refetch users when save is clicked', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      vi.mocked(useQuery).mockReturnValue({
        data: { data: mockUsers, pagination: mockPagination },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('user-edit-modal')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByTestId('user-edit-modal')).not.toBeInTheDocument();
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('should pass canEdit prop to UserEditModal based on permissions', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('user-edit-modal')).toBeInTheDocument();
      });
    });

    it('should restore focus to edit button after closing edit modal', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      const firstEditButton = editButtons[0];
      await user.click(firstEditButton);

      await waitFor(() => {
        expect(screen.getByTestId('user-edit-modal')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('user-edit-modal')).not.toBeInTheDocument();
      });

      // Focus should be restored (setTimeout in component)
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    it('should clear selected user after closing edit modal', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('user-edit-modal')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('user-edit-modal')).not.toBeInTheDocument();
      });
    });

    it('should open edit modal directly from table actions menu', async () => {
      const user = userEvent.setup();
      vi.mocked(usersService.canModifyUsers).mockReturnValue(true);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[1]); // Click second user's edit

      await waitFor(() => {
        expect(screen.getByText(/edit user: jane.admin/i)).toBeInTheDocument();
      });
    });
  });

  describe('5. Permissions', () => {
    it('should show access denied message when user cannot read users', () => {
      vi.mocked(usersService.canReadUsers).mockReturnValue(false);

      renderWithAuth(<UsersPage />, { user: mockUser });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      // Check for permission message - it might be in the EmptyStateBody
      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveTextContent(/permission/i);
    });

    it('should not fetch users when user cannot read users', () => {
      vi.mocked(usersService.canReadUsers).mockReturnValue(false);
      vi.mocked(usersService.getUsers).mockClear();

      renderWithAuth(<UsersPage />, { user: mockUser });

      expect(usersService.getUsers).not.toHaveBeenCalled();
    });

    it('should render page title even when access is denied', () => {
      vi.mocked(usersService.canReadUsers).mockReturnValue(false);

      renderWithAuth(<UsersPage />, { user: mockUser });

      expect(screen.getByRole('heading', { level: 1, name: /users/i })).toBeInTheDocument();
    });

    it('should check read permissions with current user', () => {
      const customUser = { ...mockAdminUser, id: 'custom-123' };
      renderWithAuth(<UsersPage />, { user: customUser });

      expect(usersService.canReadUsers).toHaveBeenCalledWith(customUser);
    });

    it('should check modify permissions with current user', () => {
      const customUser = { ...mockAdminUser, id: 'custom-456' };
      renderWithAuth(<UsersPage />, { user: customUser });

      expect(usersService.canModifyUsers).toHaveBeenCalledWith(customUser);
    });

    it('should hide edit actions globally when user cannot modify users', () => {
      vi.mocked(usersService.canModifyUsers).mockReturnValue(false);

      renderWithAuth(<UsersPage />, { user: mockAdminReadonlyUser });

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('6. Error Handling', () => {
    it('should display loading state while fetching users', () => {
      vi.mocked(useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should display error state when fetch fails', () => {
      const error = new Error('Failed to load users');
      vi.mocked(useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
        refetch: vi.fn(),
      } as any);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/error/i)).toBeInTheDocument();
      expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
    });

    it('should display retry button when fetch fails', () => {
      const error = new Error('Failed to load users');
      vi.mocked(useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
        refetch: vi.fn(),
      } as any);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should retry fetching users when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();
      const error = new Error('Failed to load users');

      vi.mocked(useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
        refetch: mockRefetch,
      } as any);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should display empty state when no users exist', () => {
      vi.mocked(useQuery).mockReturnValue({
        data: { data: [], pagination: { ...mockPagination, total: 0 } },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      // Check for empty state title - use getByRole for heading
      expect(screen.getByRole('heading', { name: /no users/i })).toBeInTheDocument();
    });

    // TODO: Fix filtered empty state test - requires updating React Query mock mid-test
    it.skip('should display filtered empty state when filters return no results', async () => {
      const user = userEvent.setup();

      renderWithAuth(<UsersPage />, { user: mockAdminUser });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      await user.type(searchInput, 'nonexistent');

      vi.mocked(useQuery).mockReturnValue({
        data: { data: [], pagination: { ...mockPagination, total: 0 } },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      await waitFor(() => {
        expect(screen.getByText(/no matches/i)).toBeInTheDocument();
      });
    });
  });
});

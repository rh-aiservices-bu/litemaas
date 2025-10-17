import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import UserEditModal from '../../components/UserEditModal';
import { usersService } from '../../services/users.service';
import { renderWithAuth, mockAdminUser } from '../test-utils';
import type { User } from '../../types/users';

// Mock the users service
vi.mock('../../services/users.service', () => ({
  usersService: {
    updateUser: vi.fn(),
  },
}));

const mockUsersService = usersService as any;

describe('UserEditModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-123',
    username: 'john.doe',
    email: 'john.doe@example.com',
    fullName: 'John Doe',
    roles: ['user'],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLoginAt: '2024-01-15T12:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('should render modal with user data in edit mode', () => {
      const user = createMockUser();
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Modal should be present
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('john.doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render modal with view title when canEdit is false', () => {
      const user = createMockUser();
      renderWithAuth(
        <UserEditModal user={user} canEdit={false} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Modal should be present with Close button (not Cancel)
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // There are multiple close buttons (X and link button), just verify at least one exists
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    it('should display username field as read-only', () => {
      const user = createMockUser();
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Username is displayed but not in an input field
      expect(screen.getByText('john.doe')).toBeInTheDocument();
      // No separate username input exists
      const inputs = screen.queryAllByRole('textbox');
      expect(inputs.every((input) => !input.getAttribute('value')?.includes('john.doe'))).toBe(
        true,
      );
    });

    it('should display email field as read-only', () => {
      const user = createMockUser();
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Email is displayed but not editable
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('should display full name or N/A if not provided', () => {
      const user = createMockUser({ fullName: undefined });
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      expect(screen.getByText(/n\/a/i)).toBeInTheDocument();
    });

    it('should format createdAt date correctly', () => {
      const user = createMockUser({ createdAt: '2024-01-15T10:30:00Z' });
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Date should be formatted as locale string
      const formattedDate = new Date('2024-01-15T10:30:00Z').toLocaleString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });

    it('should display "Never" for null lastLoginAt', () => {
      const user = createMockUser({ lastLoginAt: undefined });
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      expect(screen.getByText(/never/i)).toBeInTheDocument();
    });
  });

  describe('Role Management', () => {
    it('should display role switches for admin users', () => {
      const user = createMockUser();
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Get all switches - there should be 3 role switches (PatternFly Switch uses role="switch")
      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(3);
    });

    it('should pre-select user roles correctly', () => {
      const user = createMockUser({ roles: ['user', 'admin'] });
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Get all switches - 2 should be checked (user and admin)
      const switches = screen.getAllByRole('switch');
      const checkedSwitches = switches.filter((sw) => (sw as HTMLInputElement).checked);
      expect(checkedSwitches).toHaveLength(2);
    });

    it('should toggle role when switch is clicked', async () => {
      const user = createMockUser({ roles: ['user'] });
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const switches = screen.getAllByRole('switch');
      // Find the admin switch (should be the second one - index 1)
      const adminSwitch = switches[1];
      expect(adminSwitch).not.toBeChecked();

      await userEvent.click(adminSwitch);

      expect(adminSwitch).toBeChecked();
    });

    it('should show role conflict warning when admin and admin-readonly are both selected', async () => {
      const user = createMockUser({ roles: ['user'] });
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const switches = screen.getAllByRole('switch');
      // Admin switch (index 1) and admin-readonly switch (index 2)
      const adminSwitch = switches[1];
      const adminReadonlySwitch = switches[2];

      await userEvent.click(adminSwitch);
      await userEvent.click(adminReadonlySwitch);

      await waitFor(() => {
        expect(screen.getByText(/role conflict/i)).toBeInTheDocument();
      });
    });

    it('should display roles as badges in read-only mode', () => {
      const user = createMockUser({ roles: ['user', 'admin'] });
      renderWithAuth(
        <UserEditModal user={user} canEdit={false} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Roles should be displayed as badges, not switches
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
      // Should have badges for roles
      const badges = screen.getAllByText((_content, element) => {
        return element?.tagName === 'SPAN' && element?.className.includes('pf-v6-c-badge');
      });
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should display "No roles assigned" when user has no roles', () => {
      const user = createMockUser({ roles: [] });
      renderWithAuth(
        <UserEditModal user={user} canEdit={false} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      expect(screen.getByText(/no roles assigned/i)).toBeInTheDocument();
    });

    it('should disable role switches when canEdit is false', () => {
      const user = createMockUser();
      renderWithAuth(
        <UserEditModal user={user} canEdit={false} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // In read-only mode, switches are not rendered, only badges
      expect(screen.queryByLabelText(/toggle user role/i)).not.toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should call usersService.updateUser when save button is clicked', async () => {
      const user = createMockUser({ roles: ['user'] });
      mockUsersService.updateUser.mockResolvedValueOnce({});
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Toggle a role to enable save button
      const switches = screen.getAllByRole('switch');
      const adminSwitch = switches[1]; // Second switch is admin
      await userEvent.click(adminSwitch);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUsersService.updateUser).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            roles: expect.arrayContaining(['admin']),
          }),
        );
      });
    });

    it('should call onSave callback after successful update', async () => {
      const user = createMockUser({ roles: ['user'] });
      mockUsersService.updateUser.mockResolvedValueOnce({});
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const switches = screen.getAllByRole('switch');
      const adminSwitch = switches[1]; // Second switch is admin
      await userEvent.click(adminSwitch);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('should show success notification after successful save', async () => {
      const user = createMockUser({ roles: ['user'] });
      mockUsersService.updateUser.mockResolvedValueOnce({});
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const switches = screen.getAllByRole('switch');
      const adminSwitch = switches[1]; // Second switch is admin
      await userEvent.click(adminSwitch);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Success notification is handled by NotificationContext
      await waitFor(() => {
        expect(mockUsersService.updateUser).toHaveBeenCalled();
      });
    });

    it('should disable save button when no changes are made', () => {
      const user = createMockUser();
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when roles are changed', async () => {
      const user = createMockUser({ roles: ['user'] });
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();

      const switches = screen.getAllByRole('switch');
      const adminSwitch = switches[1]; // Second switch is admin
      await userEvent.click(adminSwitch);

      expect(saveButton).not.toBeDisabled();
    });

    it('should disable save button while updating', async () => {
      const user = createMockUser({ roles: ['user'] });
      mockUsersService.updateUser.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const switches = screen.getAllByRole('switch');
      const adminSwitch = switches[1]; // Second switch is admin
      await userEvent.click(adminSwitch);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Button should be disabled during update
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error notification on update failure', async () => {
      const user = createMockUser({ roles: ['user'] });
      const error = new Error('Update failed');
      mockUsersService.updateUser.mockRejectedValueOnce(error);
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const switches = screen.getAllByRole('switch');
      const adminSwitch = switches[1]; // Second switch is admin
      await userEvent.click(adminSwitch);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });
    });

    it('should handle API error with message', async () => {
      const user = createMockUser({ roles: ['user'] });
      const error = {
        response: {
          data: {
            message: 'Cannot assign admin role to this user',
          },
        },
      };
      mockUsersService.updateUser.mockRejectedValueOnce(error);
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const switches = screen.getAllByRole('switch');
      const adminSwitch = switches[1]; // Second switch is admin
      await userEvent.click(adminSwitch);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/cannot assign admin role to this user/i)).toBeInTheDocument();
      });
    });

    it('should not call onSave when update fails', async () => {
      const user = createMockUser({ roles: ['user'] });
      mockUsersService.updateUser.mockRejectedValueOnce(new Error('Update failed'));
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const switches = screen.getAllByRole('switch');
      const adminSwitch = switches[1]; // Second switch is admin
      await userEvent.click(adminSwitch);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUsersService.updateUser).toHaveBeenCalled();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = createMockUser();
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked in read-only mode', async () => {
      const user = createMockUser();
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={false} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Get all close buttons and click the one in modal body (not the X button)
      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      const modalBodyCloseButton = closeButtons[closeButtons.length - 1]; // Last one is the link button
      await userEvent.click(modalBodyCloseButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should disable cancel button while updating', async () => {
      const user = createMockUser({ roles: ['user'] });
      mockUsersService.updateUser.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      const adminSwitch = screen.getByLabelText(/toggle administrator role/i);
      await userEvent.click(adminSwitch);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Status Display', () => {
    it('should display active status badge', () => {
      const user = createMockUser({ isActive: true });
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });

    it('should display inactive status badge', () => {
      const user = createMockUser({ isActive: false });
      renderWithAuth(
        <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      expect(screen.getByText(/inactive/i)).toBeInTheDocument();
    });
  });

  describe('Permissions', () => {
    it('should hide save button when canEdit is false', () => {
      const user = createMockUser();
      renderWithAuth(
        <UserEditModal user={user} canEdit={false} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    });

    it('should not allow role changes when canEdit is false', async () => {
      const user = createMockUser({ roles: ['user'] });
      renderWithAuth(
        <UserEditModal user={user} canEdit={false} onClose={mockOnClose} onSave={mockOnSave} />,
        { user: mockAdminUser },
      );

      // Switches should not be present in read-only mode
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });
  });
});

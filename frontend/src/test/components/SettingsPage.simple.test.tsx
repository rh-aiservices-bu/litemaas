import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettingsPage from '../../pages/SettingsPage';
import { User } from '../../services/auth.service';

// Mock the dependencies
vi.mock('../../services/models.service', () => ({
  modelsService: {
    refreshModels: vi.fn(),
  },
}));

vi.mock('../../services/admin.service', () => ({
  adminService: {
    bulkUpdateUserLimits: vi.fn(),
  },
}));

// Helper to create mock user
const createMockUser = (roles: string[] = ['user']): User => ({
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  username: 'testuser',
  roles,
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: createMockUser(['admin']),
    loading: false,
    isAuthenticated: true,
    login: vi.fn(),
    loginAsAdmin: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  })),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: vi.fn(() => ({
    addNotification: vi.fn(),
  })),
}));

describe('SettingsPage - Simple Test', () => {
  it('should render without crashing', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});

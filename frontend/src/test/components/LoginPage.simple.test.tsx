import React from 'react';
import { render, screen, waitFor, act } from '../test-utils';
import { vi } from 'vitest';
import LoginPage from '../../pages/LoginPage';

// Mock the config service directly
vi.mock('../../services/config.service', () => ({
  configService: {
    getConfig: vi.fn().mockResolvedValue({
      authMode: 'oauth',
      litellmApiUrl: 'http://localhost:4000',
    }),
  },
}));

// Mock the auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isAuthenticated: false,
    login: vi.fn(),
    loginAsAdmin: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock assets
vi.mock('../../assets', () => ({
  LogoTitle: 'mocked-logo-title.svg',
}));

describe('LoginPage Simple Test', () => {
  it('should render LoginPage content', async () => {
    console.log('Rendering LoginPage...');

    await act(async () => {
      render(<LoginPage />);
    });

    console.log('Debug what rendered:');
    screen.debug();

    // Try to find the login button
    await waitFor(
      () => {
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Check other elements
    expect(screen.getByText('Welcome to LiteMaaS')).toBeInTheDocument();
    expect(screen.getByText('Model-as-a-Service Platform')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument();
  });
});

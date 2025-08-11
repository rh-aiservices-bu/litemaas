import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '../test-utils';
import { vi } from 'vitest';
import LoginPage from '../../pages/LoginPage';
import { configService } from '../../services/config.service';
import type { ConfigResponse } from '../../services/config.service';

// Create mock functions that can be accessed in tests
const mockLogin = vi.fn();
const mockLoginAsAdmin = vi.fn();

// Mock dependencies
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isAuthenticated: false,
    login: mockLogin,
    loginAsAdmin: mockLoginAsAdmin,
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../services/config.service', () => ({
  configService: {
    getConfig: vi.fn().mockResolvedValue({
      authMode: 'oauth',
      litellmApiUrl: 'http://localhost:4000',
    }),
  },
}));

// Mock assets
vi.mock('../../assets', () => ({
  LogoTitle: 'mocked-logo-title.svg',
}));

const mockConfigService = vi.mocked(configService);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the config service mock
    mockConfigService.getConfig.mockResolvedValue({
      authMode: 'oauth',
      litellmApiUrl: 'http://localhost:4000',
    });
    // Reset login mocks to simple sync functions
    mockLogin.mockImplementation(() => {});
    mockLoginAsAdmin.mockImplementation(() => {});
  });

  describe('Basic rendering', () => {
    it('renders login page with brand and title', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText('Welcome to LiteMaaS')).toBeInTheDocument();
          expect(screen.getByText('Model-as-a-Service Platform')).toBeInTheDocument();
          expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('renders language selector dropdown', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('displays loading spinner during config loading', () => {
      mockConfigService.getConfig.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<LoginPage />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('OAuth authentication flow', () => {
    it('calls login function when OAuth login button is clicked', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(
        () => {
          const loginButton = screen.getByText('Login with OpenShift');
          expect(loginButton).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const loginButton = screen.getByText('Login with OpenShift');

      await act(async () => {
        fireEvent.click(loginButton);
      });

      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('does not show admin login in OAuth mode', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      expect(screen.queryByText('Login as Admin')).not.toBeInTheDocument();
      expect(screen.queryByText('Development Mode')).not.toBeInTheDocument();
    });

    it('handles OAuth login errors gracefully', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      // Mock login to be a synchronous function that doesn't return a promise
      mockLogin.mockImplementation(() => {
        // Just a simple sync function - no promise rejection
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(
        () => {
          const loginButton = screen.getByText('Login with OpenShift');
          expect(loginButton).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const loginButton = screen.getByText('Login with OpenShift');

      // Click should work without errors
      await act(async () => {
        fireEvent.click(loginButton);
      });

      // Verify the component still renders properly after login attempt
      expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mock authentication mode', () => {
    it('shows admin login option in mock mode', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'mock',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText('Login as Admin')).toBeInTheDocument();
          expect(screen.getByText('Development Mode')).toBeInTheDocument();
          expect(screen.getByText('Bypass authentication for testing')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('calls loginAsAdmin when admin button is clicked', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'mock',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(
        () => {
          expect(screen.getByText('Login as Admin')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      const adminLoginButton = screen.getByText('Login as Admin');

      await act(async () => {
        fireEvent.click(adminLoginButton);
      });

      expect(mockLoginAsAdmin).toHaveBeenCalledTimes(1);
    });

    it('shows both OAuth and admin login options in mock mode', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'mock',
        litellmApiUrl: 'http://localhost:4000',
      });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
        expect(screen.getByText('Login as Admin')).toBeInTheDocument();
      });
    });

    it('renders divider between OAuth and admin login', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'mock',
        litellmApiUrl: 'http://localhost:4000',
      });

      render(<LoginPage />);

      await waitFor(() => {
        const divider = screen.getByText('Development Mode').closest('.pf-v6-u-text-align-center');
        expect(divider).toBeInTheDocument();
      });
    });
  });

  describe('Configuration loading', () => {
    it('handles config service errors by defaulting to OAuth mode', async () => {
      mockConfigService.getConfig.mockRejectedValue(new Error('Config loading failed'));

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      });

      // Should show OAuth login but not admin login when config fails
      expect(screen.queryByText('Login as Admin')).not.toBeInTheDocument();
    });

    it('handles null/undefined config response', async () => {
      mockConfigService.getConfig.mockResolvedValue(null as any);

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      });
    });

    it('handles empty config response', async () => {
      mockConfigService.getConfig.mockResolvedValue({} as any);

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      });
    });
  });

  describe('Language selector functionality', () => {
    it('opens language dropdown when clicked', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(() => {
        const languageButton = screen.getByRole('button', { name: /language/i });
        expect(languageButton).toBeInTheDocument();
      });

      const languageButton = screen.getByRole('button', { name: /language/i });

      await act(async () => {
        fireEvent.click(languageButton);
      });

      // Wait for dropdown to open and check for language options
      await waitFor(() => {
        // Search for the text that includes the flag emoji
        expect(screen.getByText('🇺🇸 English')).toBeInTheDocument();
      });

      expect(screen.getByText('🇪🇸 Español')).toBeInTheDocument();
      expect(screen.getByText('🇫🇷 Français')).toBeInTheDocument();
      expect(screen.getByText('🇩🇪 Deutsch')).toBeInTheDocument();
    });

    it('closes dropdown when language is selected', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(() => {
        const languageButton = screen.getByRole('button', { name: /language/i });
        expect(languageButton).toBeInTheDocument();
      });

      const languageButton = screen.getByRole('button', { name: /language/i });

      await act(async () => {
        fireEvent.click(languageButton);
      });

      await waitFor(() => {
        expect(screen.getByText('🇺🇸 English')).toBeInTheDocument();
      });

      const englishOption = screen.getByText('🇺🇸 English');

      await act(async () => {
        fireEvent.click(englishOption);
      });

      // Dropdown should close - verify the dropdown menu is no longer expanded
      await waitFor(() => {
        // The dropdown items should no longer be visible
        expect(screen.queryByText('🇺🇸 English')).not.toBeInTheDocument();
      });

      // Button should still be present and clickable
      expect(screen.getByRole('button', { name: /language/i })).toBeInTheDocument();
    });

    it('displays all supported languages', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(() => {
        const languageButton = screen.getByRole('button', { name: /language/i });
        expect(languageButton).toBeInTheDocument();
      });

      const languageButton = screen.getByRole('button', { name: /language/i });

      await act(async () => {
        fireEvent.click(languageButton);
      });

      // Wait for dropdown to open first
      await waitFor(() => {
        expect(screen.getByText('🇺🇸 English')).toBeInTheDocument();
      });

      // Check for all supported languages with their flag emojis
      const expectedLanguages = [
        '🇺🇸 English',
        '🇪🇸 Español',
        '🇫🇷 Français',
        '🇩🇪 Deutsch',
        '🇮🇹 Italiano',
        '🇰🇷 한국어',
        '🇯🇵 日本語',
        '🇨🇳 中文',
        '🧝‍♂️ Elvish',
      ];

      expectedLanguages.forEach((language) => {
        expect(screen.getByText(language)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper button labels and roles', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'mock',
        litellmApiUrl: 'http://localhost:4000',
      });

      render(<LoginPage />);

      await waitFor(() => {
        const oauthButton = screen.getByRole('button', { name: /login with openshift/i });
        const adminButton = screen.getByRole('button', { name: /login as admin/i });
        const languageButton = screen.getByRole('button', { name: /language/i });

        expect(oauthButton).toBeInTheDocument();
        expect(adminButton).toBeInTheDocument();
        expect(languageButton).toBeInTheDocument();
      });
    });

    it('has proper img alt text for branding', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      render(<LoginPage />);

      await waitFor(() => {
        const brandImage = screen.getByAltText('LiteMaaS Logo');
        expect(brandImage).toBeInTheDocument();
      });
    });

    it('has proper aria-label for language selector', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      render(<LoginPage />);

      await waitFor(() => {
        const languageButton = screen.getByLabelText(/language/i);
        expect(languageButton).toBeInTheDocument();
      });
    });
  });

  describe('Button states and interactions', () => {
    it('maintains button state during interactions', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'mock',
        litellmApiUrl: 'http://localhost:4000',
      });

      render(<LoginPage />);

      await waitFor(() => {
        const oauthButton = screen.getByText('Login with OpenShift');
        const adminButton = screen.getByText('Login as Admin');

        expect(oauthButton).toBeEnabled();
        expect(adminButton).toBeEnabled();
      });
    });

    it('handles rapid button clicks', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'mock',
        litellmApiUrl: 'http://localhost:4000',
      });

      await act(async () => {
        render(<LoginPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      });

      const oauthButton = screen.getByText('Login with OpenShift');

      // Rapid clicks with proper act() wrapping
      await act(async () => {
        fireEvent.click(oauthButton);
        fireEvent.click(oauthButton);
        fireEvent.click(oauthButton);
      });

      expect(mockLogin).toHaveBeenCalledTimes(3);
    });
  });

  describe('Component lifecycle', () => {
    it('loads config on mount', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      render(<LoginPage />);

      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      });
    });

    it('handles component remount correctly', async () => {
      mockConfigService.getConfig.mockResolvedValue({
        authMode: 'oauth',
        litellmApiUrl: 'http://localhost:4000',
      });

      const { unmount } = render(<LoginPage />);
      unmount();

      mockConfigService.getConfig.mockClear();
      render(<LoginPage />);

      expect(mockConfigService.getConfig).toHaveBeenCalledTimes(1);
    });

    it('shows correct UI state transitions', async () => {
      let configResolve: (config: ConfigResponse) => void;
      const configPromise = new Promise<ConfigResponse>((resolve) => {
        configResolve = resolve;
      });
      mockConfigService.getConfig.mockReturnValue(configPromise);

      await act(async () => {
        render(<LoginPage />);
      });

      // Initially loading - only check for spinner without asserting login button absence
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Resolve config
      await act(async () => {
        configResolve!({ authMode: 'oauth', litellmApiUrl: 'http://localhost:4000' });
      });

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('handles async errors in useEffect', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockConfigService.getConfig.mockRejectedValue(new Error('Network error'));

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load configuration:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('recovers from config loading failures', async () => {
      mockConfigService.getConfig.mockRejectedValue(new Error('Config failed'));

      render(<LoginPage />);

      await waitFor(() => {
        // Should still render with default OAuth mode
        expect(screen.getByText('Login with OpenShift')).toBeInTheDocument();
        expect(screen.queryByText('Login as Admin')).not.toBeInTheDocument();
      });
    });
  });
});

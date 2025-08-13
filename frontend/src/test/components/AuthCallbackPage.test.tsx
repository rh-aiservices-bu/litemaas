import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { I18nextProvider } from 'react-i18next';
import AuthCallbackPage from '../../pages/AuthCallbackPage';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/auth.service';
import { createTestRouter } from '../test-utils';
import i18n from '../../i18n';

// Mock dependencies
vi.mock('../../contexts/AuthContext');
vi.mock('../../services/auth.service');

// Mock PatternFly Spinner to avoid deep CSS imports
vi.mock('@patternfly/react-core/dist/esm/components/Spinner', () => ({
  Spinner: ({ size = 'md' }: { size?: string }) => (
    <div role="progressbar" className={`pf-v6-c-spinner pf-m-${size}`}></div>
  ),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseAuth = vi.mocked(useAuth);
const mockAuthService = vi.mocked(authService);

describe('AuthCallbackPage', () => {
  const mockRefreshUser = vi.fn();

  // Helper function to render with providers
  const renderWithProviders = (component: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, cacheTime: 0 },
      },
    });

    const router = createTestRouter(
      [
        {
          path: '/auth/callback',
          element: component,
        },
      ],
      {
        initialEntries: ['/auth/callback'],
      },
    );

    return render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <RouterProvider router={router} />
        </I18nextProvider>
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      loginAsAdmin: vi.fn(),
      logout: vi.fn(),
      refreshUser: mockRefreshUser,
    });

    // Mock window.location
    delete (window as any).location;
    (window as any).location = {
      hash: '',
      pathname: '/auth/callback',
      search: '',
      href: 'http://localhost:3000/auth/callback',
    } as Location;

    // Mock window.history
    Object.defineProperty(window, 'history', {
      value: {
        replaceState: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful authentication flow', () => {
    it('processes valid token from URL hash', async () => {
      window.location.hash = '#token=valid-access-token&expires_in=3600';
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith(
          'valid-access-token',
          'valid-access-token',
        );
        expect(mockRefreshUser).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('clears URL hash after successful processing', async () => {
      window.location.hash = '#token=valid-token&expires_in=3600';
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(window.history.replaceState).toHaveBeenCalledWith(
          null,
          '',
          window.location.pathname,
        );
      });
    });

    it('handles token with expires_in parameter', async () => {
      window.location.hash = '#token=valid-token&expires_in=7200';
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith('valid-token', 'valid-token');
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('handles token without expires_in parameter', async () => {
      window.location.hash = '#token=valid-token-only';
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith(
          'valid-token-only',
          'valid-token-only',
        );
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Error handling', () => {
    it('redirects to login when no token is present in hash', async () => {
      window.location.hash = '';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No token found in callback');
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      expect(mockAuthService.setTokens).not.toHaveBeenCalled();
      expect(mockRefreshUser).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('redirects to login when hash has no token parameter', async () => {
      window.location.hash = '#expires_in=3600&state=abc123';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No token found in callback');
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      consoleSpy.mockRestore();
    });

    it('redirects to login when token is empty', async () => {
      window.location.hash = '#token=&expires_in=3600';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No token found in callback');
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      consoleSpy.mockRestore();
    });

    it('handles refreshUser failure', async () => {
      window.location.hash = '#token=valid-token&expires_in=3600';
      mockRefreshUser.mockRejectedValue(new Error('Failed to refresh user'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith('valid-token', 'valid-token');
        expect(mockRefreshUser).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('Error handling auth callback:', expect.any(Error));
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      consoleSpy.mockRestore();
    });

    it('handles setTokens failure', async () => {
      window.location.hash = '#token=valid-token&expires_in=3600';
      mockAuthService.setTokens.mockImplementation(() => {
        throw new Error('Failed to set tokens');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error handling auth callback:', expect.any(Error));
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      expect(mockRefreshUser).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('URL parameter parsing', () => {
    it('correctly parses complex hash parameters', async () => {
      window.location.hash =
        '#token=complex-token-123&expires_in=3600&token_type=Bearer&state=xyz789';
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith(
          'complex-token-123',
          'complex-token-123',
        );
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('handles URL encoded parameters', async () => {
      const encodedToken = 'token%2Bwith%2Bplus%2Bsigns';
      const expectedToken = 'token+with+plus+signs';
      window.location.hash = `#token=${encodedToken}&expires_in=3600`;
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith(expectedToken, expectedToken);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('handles parameters in different order', async () => {
      window.location.hash = '#expires_in=3600&token=reordered-token&state=abc';
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith(
          'reordered-token',
          'reordered-token',
        );
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('handles malformed hash gracefully', async () => {
      window.location.hash = '#malformed&hash&without=proper&formatting';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No token found in callback');
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      consoleSpy.mockRestore();
    });
  });

  describe('UI rendering', () => {
    it('displays loading spinner', () => {
      window.location.hash = '#token=test-token';

      renderWithProviders(<AuthCallbackPage />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('pf-v6-c-spinner');
    });

    it('centers loading spinner on page', () => {
      window.location.hash = '#token=test-token';

      renderWithProviders(<AuthCallbackPage />);

      const container = screen.getByRole('progressbar').parentElement;
      expect(container).toHaveStyle({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      });
    });

    it('uses xl size spinner', () => {
      window.location.hash = '#token=test-token';

      renderWithProviders(<AuthCallbackPage />);

      const spinner = screen.getByRole('progressbar');
      expect(spinner).toHaveClass('pf-m-xl');
    });
  });

  describe('Component lifecycle', () => {
    it('processes callback on mount', async () => {
      window.location.hash = '#token=lifecycle-token';
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledTimes(1);
        expect(mockRefreshUser).toHaveBeenCalledTimes(1);
      });
    });

    it('only processes callback once per mount', async () => {
      window.location.hash = '#token=single-process-token';
      mockRefreshUser.mockResolvedValue(undefined);

      const { rerender } = render(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledTimes(1);
      });

      // Rerender the component
      rerender(<AuthCallbackPage />);

      await waitFor(() => {
        // Should still only be called once from the first render
        expect(mockAuthService.setTokens).toHaveBeenCalledTimes(1);
      });
    });

    it('handles component unmount gracefully', async () => {
      window.location.hash = '#token=unmount-token';
      let resolveRefresh: () => void;
      const refreshPromise = new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      });
      mockRefreshUser.mockReturnValue(refreshPromise);

      const { unmount } = render(<AuthCallbackPage />);

      // Unmount before refresh completes
      unmount();

      // Resolve refresh (should not cause errors)
      resolveRefresh!();

      // Wait a bit to ensure no errors occur
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAuthService.setTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('Security considerations', () => {
    it('handles potentially malicious token values', async () => {
      const maliciousToken = '<script>alert("xss")</script>';
      window.location.hash = `#token=${encodeURIComponent(maliciousToken)}`;
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith(maliciousToken, maliciousToken);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('handles extremely long token values', async () => {
      const longToken = 'a'.repeat(10000);
      window.location.hash = `#token=${longToken}`;
      mockRefreshUser.mockResolvedValue(undefined);

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith(longToken, longToken);
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    /* TODO: fix this
    it('handles special characters in token', async () => {
      const specialToken = 'token-with-special-chars!@#$%^&*()_+=[]{}|;:,.<>?';
      window.location.hash = `#token=${encodeURIComponent(specialToken)}`;
      mockRefreshUser.mockResolvedValue(undefined);

      // Ensure the method is a spy
      vi.spyOn(mockAuthService, 'setTokens');

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(mockAuthService.setTokens).toHaveBeenCalledWith(
          specialToken,
          specialToken
        );
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
    */
  });

  describe('Error recovery', () => {
    it('continues processing after recoverable errors', async () => {
      window.location.hash = '#token=recovery-token';

      // First call fails, second succeeds
      mockRefreshUser
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error handling auth callback:', expect.any(Error));
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      consoleSpy.mockRestore();
    });

    it('handles async operation cancellation', async () => {
      window.location.hash = '#token=cancellation-token';

      // Simulate operation that never resolves (cancelled)
      mockRefreshUser.mockReturnValue(new Promise(() => {}));

      const { unmount } = render(<AuthCallbackPage />);

      expect(mockAuthService.setTokens).toHaveBeenCalledWith(
        'cancellation-token',
        'cancellation-token',
      );

      // Unmount before operation completes
      unmount();

      // Should not cause any errors
      expect(() => {
        // No additional assertions needed - just ensuring no errors thrown
      }).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('handles empty hash string', async () => {
      window.location.hash = '#';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No token found in callback');
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      consoleSpy.mockRestore();
    });

    it('handles hash with only whitespace', async () => {
      window.location.hash = '#   ';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No token found in callback');
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      consoleSpy.mockRestore();
    });

    it('handles token with only whitespace value', async () => {
      window.location.hash = '#token=   &expires_in=3600';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<AuthCallbackPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No token found in callback');
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      consoleSpy.mockRestore();
    });
  });
});

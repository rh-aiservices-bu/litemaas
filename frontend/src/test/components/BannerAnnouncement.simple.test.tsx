import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test-utils';
import BannerAnnouncement from '../../components/BannerAnnouncement';
import { BannerProvider } from '../../contexts/BannerContext';
import { QueryClient, QueryClientProvider } from 'react-query';
import React from 'react';

// Mock AuthContext to provide authenticated user
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock NotificationContext
vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: vi.fn(),
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the banner service
vi.mock('../../services/banners.service', () => ({
  bannerService: {
    getActiveBanners: vi.fn().mockResolvedValue([
      {
        id: 'banner-123',
        isActive: true,
        priority: 0,
        content: { en: 'Test banner message' },
        variant: 'info',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'admin-123',
        updatedBy: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    dismissBanner: vi.fn().mockResolvedValue({ message: 'Banner dismissed successfully' }),
  },
}));

// Create test-specific QueryClient
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const BannerTestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BannerProvider>{children}</BannerProvider>
    </QueryClientProvider>
  );
};

describe('BannerAnnouncement Simple Integration', () => {
  const mockUser = {
    id: 'test-user-123',
    username: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
  };

  const mockAddNotification = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock AuthContext to return authenticated user
    const { useAuth } = await import('../../contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      loginAsAdmin: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    // Mock NotificationContext
    const { useNotifications } = await import('../../contexts/NotificationContext');
    vi.mocked(useNotifications).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      toastNotifications: [],
      addNotification: mockAddNotification,
      removeNotification: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      clearAll: vi.fn(),
      removeToastNotification: vi.fn(),
    });
  });

  it('should render and integrate with BannerProvider', async () => {
    render(
      <BannerTestWrapper>
        <BannerAnnouncement />
      </BannerTestWrapper>,
    );

    // Wait for banner to load and render
    await waitFor(async () => {
      const banner = await screen.findByText('Test banner message');
      expect(banner).toBeInTheDocument();
    });

    // Should have the banner element
    const bannerElement = screen.getByTestId('banner-announcement');
    expect(bannerElement).toBeInTheDocument();
    expect(bannerElement).toHaveClass('pf-v6-c-banner');
  });

  it('should show dismiss button for dismissible banners', async () => {
    render(
      <BannerTestWrapper>
        <BannerAnnouncement />
      </BannerTestWrapper>,
    );

    // Wait for banner to load first
    await waitFor(async () => {
      const banner = await screen.findByText('Test banner message');
      expect(banner).toBeInTheDocument();
    });

    // Should have dismiss button
    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissButton).toBeInTheDocument();
  });

  it('should handle empty banner list gracefully', async () => {
    // Mock empty banner list for this test
    const { bannerService } = await import('../../services/banners.service');
    vi.mocked(bannerService.getActiveBanners).mockResolvedValueOnce([]);

    render(
      <BannerTestWrapper>
        <BannerAnnouncement />
      </BannerTestWrapper>,
    );

    // Wait a bit for any async operations to complete
    await waitFor(() => {
      // Should not render any banner when list is empty
      const banner = screen.queryByTestId('banner-announcement');
      expect(banner).not.toBeInTheDocument();
    });

    // Ensure the test message is not present
    expect(screen.queryByText('Test banner message')).not.toBeInTheDocument();
  });
});

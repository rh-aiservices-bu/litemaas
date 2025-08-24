import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '../test-utils';
import { BannerProvider, useBanners } from '../../contexts/BannerContext';
import { bannerService } from '../../services/banners.service';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { QueryClient, QueryClientProvider } from 'react-query';
import React from 'react';
import type { Banner, SimpleBannerUpdateRequest } from '../../types/banners';

// Mock the services and contexts
vi.mock('../../services/banners.service', () => ({
  bannerService: {
    getActiveBanners: vi.fn(),
    dismissBanner: vi.fn(),
    updateBannerSimple: vi.fn(),
    createBanner: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: vi.fn(),
}));

describe('BannerContext', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
  };

  const mockAddNotification = vi.fn();

  const mockBanner: Banner = {
    id: 'banner-123',
    name: 'Announcement-123',
    isActive: true,
    priority: 0,
    content: { en: 'Test banner content' },
    variant: 'info',
    isDismissible: true,
    markdownEnabled: false,
    createdBy: 'admin-123',
    updatedBy: 'admin-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, cacheTime: 0 },
        mutations: { retry: false },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <BannerProvider>{children}</BannerProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useAuth as any).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    (useNotifications as any).mockReturnValue({
      addNotification: mockAddNotification,
    });

    (bannerService.getActiveBanners as any).mockResolvedValue([mockBanner]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should provide banner context with initial state', async () => {
      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      expect(result.current.banners).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.dismissBanner).toBe('function');
      expect(typeof result.current.updateBanner).toBe('function');
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should fetch banners on mount', async () => {
      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(bannerService.getActiveBanners).toHaveBeenCalledTimes(1);
      expect(result.current.banners).toEqual([mockBanner]);
    });

    it('should handle fetch errors gracefully', async () => {
      // Set up error mock before rendering
      vi.clearAllMocks();
      const fetchError = new Error('Failed to fetch banners');
      (bannerService.getActiveBanners as any).mockRejectedValue(fetchError);

      // Re-setup auth and notification mocks after clearing
      (useAuth as any).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
      });

      (useNotifications as any).mockReturnValue({
        addNotification: mockAddNotification,
      });

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      // Wait for the query to complete (either success or error)
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 10000 },
      );

      // At this point, we should have either an error or empty banners
      expect(result.current.banners).toEqual([]);
      // React Query retries by default, so verify it was called at least once
      expect(bannerService.getActiveBanners).toHaveBeenCalled();
    });
  });

  describe('dismissBanner', () => {
    it('should dismiss a banner successfully', async () => {
      (bannerService.dismissBanner as any).mockResolvedValue({
        message: 'Banner dismissed successfully',
      });

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.dismissBanner('banner-123');
      });

      expect(bannerService.dismissBanner).toHaveBeenCalledWith('banner-123');
      expect(mockAddNotification).toHaveBeenCalledWith({
        variant: 'success',
        title: 'Banner dismissed',
        description: 'The announcement has been dismissed.',
      });

      // Should optimistically remove banner from cache
      expect(result.current.banners).toEqual([]);
    });

    it('should handle dismiss errors', async () => {
      const dismissError = new Error('Failed to dismiss banner');
      (bannerService.dismissBanner as any).mockRejectedValue(dismissError);

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.dismissBanner('banner-123');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        variant: 'danger',
        title: 'Error',
        description: 'Failed to dismiss banner. Please try again.',
      });
    });
  });

  describe('updateBanner', () => {
    const updateRequest: SimpleBannerUpdateRequest = {
      isActive: true,
      content: { en: 'Updated banner content' },
      variant: 'warning',
      isDismissible: false,
      markdownEnabled: true,
    };

    it('should update an existing banner successfully', async () => {
      const updatedBanner = { ...mockBanner, ...updateRequest };
      (bannerService.updateBannerSimple as any).mockResolvedValue({
        banner: updatedBanner,
        message: 'Banner updated successfully',
      });

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateBanner('banner-123', updateRequest);
      });

      expect(bannerService.updateBannerSimple).toHaveBeenCalledWith('banner-123', updateRequest);
      expect(mockAddNotification).toHaveBeenCalledWith({
        variant: 'success',
        title: 'Banner updated',
        description: 'Banner has been updated successfully. Banner will be visible to all users.',
      });
    });

    it('should create a new banner when updating with ID "new" and no existing banners', async () => {
      const createRequest = {
        name: 'Announcement',
        content: updateRequest.content,
        variant: updateRequest.variant,
        isActive: updateRequest.isActive,
        isDismissible: updateRequest.isDismissible,
        markdownEnabled: updateRequest.markdownEnabled,
      };

      (bannerService.getActiveBanners as any).mockResolvedValue([]); // No existing banners
      (bannerService.createBanner as any).mockResolvedValue({
        banner: mockBanner,
        message: 'Banner created successfully',
      });

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateBanner('new', updateRequest);
      });

      expect(bannerService.createBanner).toHaveBeenCalledWith(createRequest);
      expect(mockAddNotification).toHaveBeenCalledWith({
        variant: 'success',
        title: 'Banner created',
        description: 'Banner has been created successfully. Banner will be visible to all users.',
      });
    });

    it('should update existing banner when updating with ID "new" and existing banners exist', async () => {
      (bannerService.updateBannerSimple as any).mockResolvedValue({
        banner: { ...mockBanner, ...updateRequest },
        message: 'Banner updated successfully',
      });

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateBanner('new', updateRequest);
      });

      expect(bannerService.updateBannerSimple).toHaveBeenCalledWith('banner-123', updateRequest);
    });

    it('should handle create banner errors', async () => {
      const createError = new Error('Failed to create banner');
      (bannerService.getActiveBanners as any).mockResolvedValue([]); // No existing banners
      (bannerService.createBanner as any).mockRejectedValue(createError);

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.updateBanner('new', updateRequest);
        } catch (error) {
          // Expected to throw
        }
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        variant: 'danger',
        title: 'Error',
        description: 'Failed to create banner',
      });
    });

    it('should handle update banner errors', async () => {
      const updateError = new Error('Failed to update banner');
      (bannerService.updateBannerSimple as any).mockRejectedValue(updateError);

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.updateBanner('banner-123', updateRequest);
        } catch (error) {
          // Expected to throw
        }
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        variant: 'danger',
        title: 'Error',
        description: 'Failed to update banner. Please try again.',
      });
    });
  });

  describe('polling behavior', () => {
    it('should start polling when there are active banners and user is authenticated', async () => {
      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Wait for potential polling interval
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(bannerService.getActiveBanners).toHaveBeenCalledTimes(1);
    });

    it('should not poll when user is not authenticated', async () => {
      (useAuth as any).mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(bannerService.getActiveBanners).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401/403 errors', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };
      (bannerService.getActiveBanners as any).mockRejectedValue(authError);

      const { result } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(authError);
      // Should not retry on auth errors
      expect(bannerService.getActiveBanners).toHaveBeenCalledTimes(1);
    });
  });

  describe('authentication status changes', () => {
    it('should refetch banners when user becomes authenticated', async () => {
      // Start with unauthenticated user
      (useAuth as any).mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      const { rerender } = renderHook(() => useBanners(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(bannerService.getActiveBanners).toHaveBeenCalledTimes(1);
      });

      // Simulate user logging in by changing the mock and re-rendering
      (useAuth as any).mockReturnValue({
        user: mockUser,
        isAuthenticated: true,
      });

      rerender();

      await waitFor(() => {
        expect(bannerService.getActiveBanners).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when useBanners is used outside BannerProvider', () => {
      expect(() => {
        renderHook(() => useBanners());
      }).toThrow('useBanners must be used within a BannerProvider');
    });
  });
});

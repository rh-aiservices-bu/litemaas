import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { bannerService } from '../services/banners.service';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import type {
  Banner,
  SimpleBannerUpdateRequest,
  BulkVisibilityUpdateRequest,
} from '../types/banners';

interface BannerContextType {
  banners: Banner[];
  isLoading: boolean;
  error: Error | null;
  dismissBanner: (bannerId: string) => Promise<void>;
  updateBanner: (bannerId: string, updates: SimpleBannerUpdateRequest) => Promise<void>;
  deleteBanner: (bannerId: string) => Promise<void>;
  bulkUpdateVisibility: (updates: BulkVisibilityUpdateRequest) => Promise<void>;
  refetch: () => void;
}

const BannerContext = createContext<BannerContextType | undefined>(undefined);

export const useBanners = () => {
  const context = useContext(BannerContext);
  if (!context) {
    throw new Error('useBanners must be used within a BannerProvider');
  }
  return context;
};

interface BannerProviderProps {
  children: ReactNode;
}

export const BannerProvider: React.FC<BannerProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // Fetch active banners with smart polling
  const {
    data: banners = [],
    isLoading,
    error,
    refetch,
  } = useQuery(['banners', user?.id], () => bannerService.getActiveBanners(), {
    staleTime: 0, // Always consider data stale
    // Remove cacheTime: 0 to allow proper caching and invalidation
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: 'always', // Always refetch when component mounts, bypassing cache
    retry: (failureCount, error) => {
      // Don't retry on 401/403 errors
      const status = (error as any)?.response?.status;
      if (status === 401 || status === 403) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Dismiss banner mutation
  const dismissMutation = useMutation((bannerId: string) => bannerService.dismissBanner(bannerId), {
    onSuccess: (_, bannerId) => {
      // Optimistically remove the banner from the cache
      queryClient.setQueryData(['banners', user?.id], (oldBanners: Banner[] | undefined) => {
        return oldBanners?.filter((banner) => banner.id !== bannerId) || [];
      });

      addNotification({
        variant: 'success',
        title: 'Banner dismissed',
        description: 'The announcement has been dismissed.',
      });
    },
    onError: (error) => {
      console.error('Failed to dismiss banner:', error);
      addNotification({
        variant: 'danger',
        title: 'Error',
        description: 'Failed to dismiss banner. Please try again.',
      });
    },
  });

  // Update banner mutation (for admin users)
  const updateMutation = useMutation(
    ({ bannerId, updates }: { bannerId: string; updates: SimpleBannerUpdateRequest }) =>
      bannerService.updateBannerSimple(bannerId, updates),
    {
      onMutate: async (variables) => {
        // Cancel any outgoing refetches to avoid overwriting our optimistic update
        await queryClient.cancelQueries(['banners', user?.id]);

        // Snapshot the previous value for rollback on error
        const previousBanners = queryClient.getQueryData<Banner[]>(['banners', user?.id]);

        // Optimistically update the cache immediately for instant UI feedback
        queryClient.setQueryData(['banners', user?.id], (oldData: Banner[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((banner) =>
            banner.id === variables.bannerId ? { ...banner, ...variables.updates } : banner,
          );
        });

        // Return context with snapshot for potential rollback
        return { previousBanners };
      },
      onSuccess: (_response, _variables) => {
        // Invalidate banner queries since dismissals are cleared on backend
        // This ensures fresh data is fetched and banner becomes visible to all users
        queryClient.invalidateQueries({ queryKey: ['banners'] });

        addNotification({
          variant: 'success',
          title: 'Banner updated',
          description: 'Banner has been updated successfully. Banner will be visible to all users.',
        });
      },
      onError: (error, _variables, context) => {
        // Rollback to previous state on error
        if (context?.previousBanners) {
          queryClient.setQueryData(['banners', user?.id], context.previousBanners);
        }

        console.error('Failed to update banner:', error);
        addNotification({
          variant: 'danger',
          title: 'Error',
          description: 'Failed to update banner. Please try again.',
        });
      },
    },
  );

  // Delete banner mutation (for admin users)
  const deleteMutation = useMutation((bannerId: string) => bannerService.deleteBanner(bannerId), {
    onMutate: async (bannerId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries(['banners', user?.id]);
      await queryClient.cancelQueries(['allBanners']);

      // Snapshot the previous value for rollback
      const previousBanners = queryClient.getQueryData<Banner[]>(['banners', user?.id]);
      const previousAllBanners = queryClient.getQueryData<Banner[]>(['allBanners']);

      // Optimistically remove the banner from cache
      queryClient.setQueryData(['banners', user?.id], (oldData: Banner[] | undefined) => {
        return oldData?.filter((banner) => banner.id !== bannerId) || [];
      });
      queryClient.setQueryData(['allBanners'], (oldData: Banner[] | undefined) => {
        return oldData?.filter((banner) => banner.id !== bannerId) || [];
      });

      return { previousBanners, previousAllBanners };
    },
    onSuccess: () => {
      addNotification({
        variant: 'success',
        title: 'Banner deleted',
        description: 'Banner has been deleted successfully.',
      });
    },
    onError: (error, _bannerId, context) => {
      // Rollback to previous state on error
      if (context?.previousBanners) {
        queryClient.setQueryData(['banners', user?.id], context.previousBanners);
      }
      if (context?.previousAllBanners) {
        queryClient.setQueryData(['allBanners'], context.previousAllBanners);
      }

      console.error('Failed to delete banner:', error);
      addNotification({
        variant: 'danger',
        title: 'Error',
        description: 'Failed to delete banner. Please try again.',
      });
    },
  });

  // Bulk visibility update mutation (for admin users)
  const bulkVisibilityMutation = useMutation(
    (updates: BulkVisibilityUpdateRequest) => bannerService.bulkUpdateVisibility(updates),
    {
      onMutate: async (updates) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries(['banners', user?.id]);
        await queryClient.cancelQueries(['allBanners']);

        // Snapshot the previous values for rollback
        const previousBanners = queryClient.getQueryData<Banner[]>(['banners', user?.id]);
        const previousAllBanners = queryClient.getQueryData<Banner[]>(['allBanners']);

        // Optimistically update visibility states
        const updateBannersList = (oldData: Banner[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((banner) => ({
            ...banner,
            isActive: updates[banner.id] !== undefined ? updates[banner.id] : banner.isActive,
          }));
        };

        queryClient.setQueryData(['banners', user?.id], updateBannersList);
        queryClient.setQueryData(['allBanners'], updateBannersList);

        return { previousBanners, previousAllBanners };
      },
      onSuccess: async () => {
        // Invalidate queries to ensure fresh data
        await queryClient.invalidateQueries({ queryKey: ['banners'] });
        await queryClient.invalidateQueries({ queryKey: ['allBanners'] });

        // Explicitly refetch the active banners
        await refetch();

        addNotification({
          variant: 'success',
          title: 'Changes applied',
          description: 'Banner visibility changes have been applied successfully.',
        });
      },
      onError: (error, _updates, context) => {
        // Rollback to previous state on error
        if (context?.previousBanners) {
          queryClient.setQueryData(['banners', user?.id], context.previousBanners);
        }
        if (context?.previousAllBanners) {
          queryClient.setQueryData(['allBanners'], context.previousAllBanners);
        }

        console.error('Failed to apply visibility changes:', error);
        addNotification({
          variant: 'danger',
          title: 'Error',
          description: 'Failed to apply visibility changes. Please try again.',
        });
      },
    },
  );

  // Wrapper functions for easier usage
  const dismissBannerWrapper = async (bannerId: string): Promise<void> => {
    await dismissMutation.mutateAsync(bannerId);
  };

  const updateBannerWrapper = async (
    bannerId: string,
    updates: SimpleBannerUpdateRequest,
  ): Promise<void> => {
    // Handle the special case of creating a new banner
    if (bannerId === 'new') {
      // Check if there's an existing banner to update
      const existingBanner = banners[0];
      if (existingBanner) {
        // Update the existing banner
        await updateMutation.mutateAsync({
          bannerId: existingBanner.id,
          updates,
        });
        return;
      } else {
        // Create a new banner using the create endpoint
        try {
          const createData = {
            name: updates.name || 'Announcement',
            content: updates.content,
            variant: updates.variant,
            isActive: updates.isActive,
            isDismissible: updates.isDismissible,
            markdownEnabled: updates.markdownEnabled,
          };
          const response = await bannerService.createBanner(createData);

          // Immediately add the new banner to cache for instant feedback
          if (response.banner) {
            queryClient.setQueryData(['banners', user?.id], (oldData: Banner[] | undefined) => {
              return [...(oldData || []), response.banner];
            });
          }

          // Then invalidate to ensure consistency across other queries
          queryClient.invalidateQueries({ queryKey: ['banners'] });
          queryClient.invalidateQueries({ queryKey: ['allBanners'] });

          addNotification({
            variant: 'success',
            title: 'Banner created',
            description:
              'Banner has been created successfully. Banner will be visible to all users.',
          });

          return;
        } catch (error) {
          console.error('Failed to create banner:', error);
          addNotification({
            variant: 'danger',
            title: 'Error',
            description:
              error instanceof Error ? error.message : 'Failed to create banner. Please try again.',
          });
          throw error; // Re-throw to maintain the async function behavior
        }
      }
    }

    await updateMutation.mutateAsync({ bannerId, updates });
  };

  const deleteBannerWrapper = async (bannerId: string): Promise<void> => {
    await deleteMutation.mutateAsync(bannerId);
  };

  const bulkUpdateVisibilityWrapper = async (
    updates: BulkVisibilityUpdateRequest,
  ): Promise<void> => {
    await bulkVisibilityMutation.mutateAsync(updates);
  };

  // Refetch banners when authentication status changes
  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const contextValue: BannerContextType = {
    banners,
    isLoading,
    error: error as Error | null,
    dismissBanner: dismissBannerWrapper,
    updateBanner: updateBannerWrapper,
    deleteBanner: deleteBannerWrapper,
    bulkUpdateVisibility: bulkUpdateVisibilityWrapper,
    refetch,
  };

  return <BannerContext.Provider value={contextValue}>{children}</BannerContext.Provider>;
};

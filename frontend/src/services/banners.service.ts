import { apiClient } from './api';
import type {
  Banner,
  CreateBannerRequest,
  UpdateBannerRequest,
  SimpleBannerUpdateRequest,
  BannerApiResponse,
  BannerDeleteResponse,
  BannerDismissResponse,
  BulkVisibilityUpdateRequest,
} from '../types/banners';

export const bannerService = {
  /**
   * Get active banners for the current user (public endpoint)
   */
  getActiveBanners: async (): Promise<Banner[]> => {
    const response = await apiClient.get<Banner[]>('/banners', {
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    return response;
  },

  /**
   * Dismiss a banner for the current user
   */
  dismissBanner: async (bannerId: string): Promise<BannerDismissResponse> => {
    const response = await apiClient.post<BannerDismissResponse>(`/banners/${bannerId}/dismiss`);
    return response;
  },

  /**
   * Get all banners (admin only)
   */
  getAllBanners: async (): Promise<Banner[]> => {
    const response = await apiClient.get<Banner[]>('/banners/admin');
    return response;
  },

  /**
   * Get specific banner by ID (admin only)
   */
  getBannerById: async (bannerId: string): Promise<Banner> => {
    const response = await apiClient.get<Banner>(`/banners/admin/${bannerId}`);
    return response;
  },

  /**
   * Create a new banner (admin only)
   */
  createBanner: async (data: CreateBannerRequest): Promise<BannerApiResponse> => {
    const response = await apiClient.post<BannerApiResponse>('/banners/admin', data);
    return response;
  },

  /**
   * Update a banner with simplified schema (admin only) - for Tools page
   */
  updateBannerSimple: async (
    bannerId: string,
    data: SimpleBannerUpdateRequest,
  ): Promise<BannerApiResponse> => {
    const response = await apiClient.put<BannerApiResponse>(`/banners/admin/${bannerId}`, data);
    return response;
  },

  /**
   * Update a banner with full schema (admin only)
   */
  updateBanner: async (bannerId: string, data: UpdateBannerRequest): Promise<BannerApiResponse> => {
    const response = await apiClient.patch<BannerApiResponse>(`/banners/admin/${bannerId}`, data);
    return response;
  },

  /**
   * Delete a banner (admin only)
   */
  deleteBanner: async (bannerId: string): Promise<BannerDeleteResponse> => {
    const response = await apiClient.delete<BannerDeleteResponse>(`/banners/admin/${bannerId}`);
    return response;
  },

  /**
   * Bulk update banner visibility states (admin only)
   */
  bulkUpdateVisibility: async (
    updates: BulkVisibilityUpdateRequest,
  ): Promise<{ message: string }> => {
    const response = await apiClient.patch<{ message: string }>(
      '/banners/admin/bulk-visibility',
      updates,
    );
    return response;
  },

  /**
   * Get banner audit logs (admin only)
   */
  getBannerAuditLogs: async (bannerId: string): Promise<any[]> => {
    const response = await apiClient.get<{ auditLogs: any[]; total: number }>(
      `/banners/admin/${bannerId}/audit`,
    );
    return response.auditLogs;
  },
};

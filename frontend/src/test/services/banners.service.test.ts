import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bannerService } from '../../services/banners.service';
import { apiClient } from '../../services/api';
import type {
  Banner,
  CreateBannerRequest,
  UpdateBannerRequest,
  SimpleBannerUpdateRequest,
  BannerApiResponse,
  BannerDeleteResponse,
  BannerDismissResponse,
} from '../../types/banners';

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('bannerService', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveBanners', () => {
    it('should fetch active banners successfully', async () => {
      const mockBanners = [mockBanner];
      (apiClient.get as any).mockResolvedValue(mockBanners);

      const result = await bannerService.getActiveBanners();

      expect(apiClient.get).toHaveBeenCalledWith('/banners', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      expect(result).toEqual(mockBanners);
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Failed to fetch banners');
      (apiClient.get as any).mockRejectedValue(apiError);

      await expect(bannerService.getActiveBanners()).rejects.toThrow('Failed to fetch banners');
      expect(apiClient.get).toHaveBeenCalledWith('/banners', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
    });
  });

  describe('dismissBanner', () => {
    it('should dismiss a banner successfully', async () => {
      const mockResponse: BannerDismissResponse = {
        message: 'Banner dismissed successfully',
      };
      (apiClient.post as any).mockResolvedValue(mockResponse);

      const result = await bannerService.dismissBanner('banner-123');

      expect(apiClient.post).toHaveBeenCalledWith('/banners/banner-123/dismiss');
      expect(result).toEqual(mockResponse);
    });

    it('should handle dismiss errors', async () => {
      const apiError = new Error('Failed to dismiss banner');
      (apiClient.post as any).mockRejectedValue(apiError);

      await expect(bannerService.dismissBanner('banner-123')).rejects.toThrow(
        'Failed to dismiss banner',
      );
      expect(apiClient.post).toHaveBeenCalledWith('/banners/banner-123/dismiss');
    });
  });

  describe('getAllBanners', () => {
    it('should fetch all banners for admin successfully', async () => {
      const mockBanners = [mockBanner];
      (apiClient.get as any).mockResolvedValue(mockBanners);

      const result = await bannerService.getAllBanners();

      expect(apiClient.get).toHaveBeenCalledWith('/banners/admin');
      expect(result).toEqual(mockBanners);
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Unauthorized');
      (apiClient.get as any).mockRejectedValue(apiError);

      await expect(bannerService.getAllBanners()).rejects.toThrow('Unauthorized');
      expect(apiClient.get).toHaveBeenCalledWith('/banners/admin');
    });
  });

  describe('getBannerById', () => {
    it('should fetch a specific banner successfully', async () => {
      (apiClient.get as any).mockResolvedValue(mockBanner);

      const result = await bannerService.getBannerById('banner-123');

      expect(apiClient.get).toHaveBeenCalledWith('/banners/admin/banner-123');
      expect(result).toEqual(mockBanner);
    });

    it('should handle not found errors', async () => {
      const notFoundError = new Error('Banner not found');
      (apiClient.get as any).mockRejectedValue(notFoundError);

      await expect(bannerService.getBannerById('non-existent')).rejects.toThrow('Banner not found');
      expect(apiClient.get).toHaveBeenCalledWith('/banners/admin/non-existent');
    });
  });

  describe('createBanner', () => {
    const createRequest: CreateBannerRequest = {
      name: 'Announcement-123',
      content: { en: 'New banner content' },
      variant: 'info',
      isDismissible: true,
      markdownEnabled: false,
    };

    it('should create a banner successfully', async () => {
      const mockResponse: BannerApiResponse = {
        banner: mockBanner,
        message: 'Banner created successfully',
      };
      (apiClient.post as any).mockResolvedValue(mockResponse);

      const result = await bannerService.createBanner(createRequest);

      expect(apiClient.post).toHaveBeenCalledWith('/banners/admin', createRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid content');
      (apiClient.post as any).mockRejectedValue(validationError);

      await expect(bannerService.createBanner(createRequest)).rejects.toThrow('Invalid content');
      expect(apiClient.post).toHaveBeenCalledWith('/banners/admin', createRequest);
    });
  });

  describe('updateBannerSimple', () => {
    const updateRequest: SimpleBannerUpdateRequest = {
      isActive: true,
      content: { en: 'Updated banner content' },
      variant: 'warning',
      isDismissible: false,
      markdownEnabled: true,
    };

    it('should update a banner with simple schema successfully', async () => {
      const mockResponse: BannerApiResponse = {
        banner: { ...mockBanner, ...updateRequest },
        message: 'Banner updated successfully',
      };
      (apiClient.put as any).mockResolvedValue(mockResponse);

      const result = await bannerService.updateBannerSimple('banner-123', updateRequest);

      expect(apiClient.put).toHaveBeenCalledWith('/banners/admin/banner-123', updateRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should handle update errors', async () => {
      const updateError = new Error('Failed to update banner');
      (apiClient.put as any).mockRejectedValue(updateError);

      await expect(bannerService.updateBannerSimple('banner-123', updateRequest)).rejects.toThrow(
        'Failed to update banner',
      );
      expect(apiClient.put).toHaveBeenCalledWith('/banners/admin/banner-123', updateRequest);
    });
  });

  describe('updateBanner', () => {
    const updateRequest: UpdateBannerRequest = {
      isActive: false,
      content: { en: 'Updated banner content', es: 'Contenido actualizado' },
      variant: 'danger',
      isDismissible: true,
      dismissDurationHours: 24,
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-12-31T00:00:00.000Z',
      targetRoles: ['admin'],
      targetUserIds: ['user-123'],
      linkUrl: 'https://example.com',
      linkText: { en: 'Learn more' },
      markdownEnabled: true,
    };

    it('should update a banner with full schema successfully', async () => {
      const mockResponse: BannerApiResponse = {
        banner: { ...mockBanner, ...updateRequest },
        message: 'Banner updated successfully',
      };
      (apiClient.patch as any).mockResolvedValue(mockResponse);

      const result = await bannerService.updateBanner('banner-123', updateRequest);

      expect(apiClient.patch).toHaveBeenCalledWith('/banners/admin/banner-123', updateRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should handle patch update errors', async () => {
      const updateError = new Error('Failed to update banner');
      (apiClient.patch as any).mockRejectedValue(updateError);

      await expect(bannerService.updateBanner('banner-123', updateRequest)).rejects.toThrow(
        'Failed to update banner',
      );
      expect(apiClient.patch).toHaveBeenCalledWith('/banners/admin/banner-123', updateRequest);
    });
  });

  describe('deleteBanner', () => {
    it('should delete a banner successfully', async () => {
      const mockResponse: BannerDeleteResponse = {
        message: 'Banner deleted successfully',
      };
      (apiClient.delete as any).mockResolvedValue(mockResponse);

      const result = await bannerService.deleteBanner('banner-123');

      expect(apiClient.delete).toHaveBeenCalledWith('/banners/admin/banner-123');
      expect(result).toEqual(mockResponse);
    });

    it('should handle delete errors', async () => {
      const deleteError = new Error('Failed to delete banner');
      (apiClient.delete as any).mockRejectedValue(deleteError);

      await expect(bannerService.deleteBanner('banner-123')).rejects.toThrow(
        'Failed to delete banner',
      );
      expect(apiClient.delete).toHaveBeenCalledWith('/banners/admin/banner-123');
    });
  });

  describe('getBannerAuditLogs', () => {
    it('should fetch audit logs successfully', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-123',
          bannerId: 'banner-123',
          action: 'create',
          changedBy: 'admin-123',
          previousState: null,
          newState: { content: { en: 'Test' } },
          changedAt: new Date(),
        },
      ];
      const mockResponse = {
        auditLogs: mockAuditLogs,
        total: 1,
      };
      (apiClient.get as any).mockResolvedValue(mockResponse);

      const result = await bannerService.getBannerAuditLogs('banner-123');

      expect(apiClient.get).toHaveBeenCalledWith('/banners/admin/banner-123/audit');
      expect(result).toEqual(mockAuditLogs);
    });

    it('should handle audit log fetch errors', async () => {
      const auditError = new Error('Failed to fetch audit logs');
      (apiClient.get as any).mockRejectedValue(auditError);

      await expect(bannerService.getBannerAuditLogs('banner-123')).rejects.toThrow(
        'Failed to fetch audit logs',
      );
      expect(apiClient.get).toHaveBeenCalledWith('/banners/admin/banner-123/audit');
    });
  });

  describe('error handling', () => {
    it('should propagate network errors', async () => {
      const networkError = new Error('Network error');
      (apiClient.get as any).mockRejectedValue(networkError);

      await expect(bannerService.getActiveBanners()).rejects.toThrow('Network error');
    });

    it('should propagate HTTP errors with status codes', async () => {
      const httpError = new Error('Not Found');
      (httpError as any).response = { status: 404 };
      (apiClient.get as any).mockRejectedValue(httpError);

      await expect(bannerService.getBannerById('non-existent')).rejects.toThrow('Not Found');
    });

    it('should propagate validation errors', async () => {
      const validationError = new Error('Validation failed');
      (validationError as any).response = { status: 400 };
      (apiClient.post as any).mockRejectedValue(validationError);

      const invalidRequest = {
        content: {}, // Missing required English content
        name: 'Announcement-123',
        variant: 'info' as const,
      };

      await expect(bannerService.createBanner(invalidRequest)).rejects.toThrow('Validation failed');
    });

    it('should propagate authorization errors', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };
      (apiClient.get as any).mockRejectedValue(authError);

      await expect(bannerService.getAllBanners()).rejects.toThrow('Unauthorized');
    });

    it('should propagate forbidden errors', async () => {
      const forbiddenError = new Error('Forbidden');
      (forbiddenError as any).response = { status: 403 };
      (apiClient.post as any).mockRejectedValue(forbiddenError);

      await expect(
        bannerService.createBanner({
          content: { en: 'Test' },
          name: 'Announcement-123',
          variant: 'info',
        }),
      ).rejects.toThrow('Forbidden');
    });
  });
});

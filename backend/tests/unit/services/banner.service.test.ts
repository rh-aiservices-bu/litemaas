import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BannerService } from '../../../src/services/banner.service';
import type { FastifyInstance } from 'fastify';
import { mockUser } from '../../setup';
import type {
  CreateBannerRequest,
  UpdateBannerRequest,
  BannerDbRow,
} from '../../../src/types/banner.types';

describe('BannerService', () => {
  let service: BannerService;
  let mockFastify: Partial<FastifyInstance>;
  let mockPgClient: any;

  const mockBannerDbRow: BannerDbRow = {
    id: 'banner-123',
    is_active: true,
    priority: 0,
    content: { en: 'Test banner content' },
    variant: 'info',
    is_dismissible: true,
    dismiss_duration_hours: null,
    start_date: null,
    end_date: null,
    target_roles: null,
    target_user_ids: null,
    link_url: null,
    link_text: null,
    markdown_enabled: false,
    created_by: 'admin-123',
    updated_by: 'admin-123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockCreateBannerRequest: CreateBannerRequest = {
    content: { en: 'New banner content' },
    variant: 'info',
    isDismissible: true,
    markdownEnabled: false,
  };

  beforeEach(() => {
    mockPgClient = {
      query: vi.fn(),
      connect: vi.fn(),
      release: vi.fn(),
    };

    mockFastify = {
      pg: {
        query: vi.fn(),
        connect: vi.fn().mockResolvedValue(mockPgClient),
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      createNotFoundError: vi.fn((resource) => new Error(`${resource} not found`)),
      createValidationError: vi.fn((message) => new Error(message)),
      createError: vi.fn((code, message) => new Error(message)),
    } as Partial<FastifyInstance>;

    service = new BannerService(mockFastify as FastifyInstance);
  });

  describe('getActiveBanners', () => {
    it('should return mock data when using mock mode', async () => {
      // Mock the service to use mock data
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getActiveBanners('user-123', ['user']);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('content');
      expect(result[0]).toHaveProperty('variant');
    });

    it('should query database and return filtered banners when not using mock data', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [mockBannerDbRow] });
      mockFastify.pg!.query = mockQuery;

      const result = await service.getActiveBanners('user-123', ['user']);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT b.*'), [
        ['user'],
        'user-123',
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('banner-123');
      expect(result[0].content).toEqual({ en: 'Test banner content' });
    });

    it('should handle database query with no user roles', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [mockBannerDbRow] });
      mockFastify.pg!.query = mockQuery;

      const result = await service.getActiveBanners('user-123');

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT b.*'), [
        [],
        'user-123',
      ]);
      expect(result).toHaveLength(1);
    });

    it('should handle database query with no user ID', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [mockBannerDbRow] });
      mockFastify.pg!.query = mockQuery;

      const result = await service.getActiveBanners(undefined, ['user']);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT b.*'), [
        ['user'],
        null,
      ]);
      expect(result).toHaveLength(1);
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dbError = new Error('Database connection failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(service.getActiveBanners('user-123', ['user'])).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        { error: dbError, userId: 'user-123', userRoles: ['user'] },
        'Failed to get active banners',
      );
    });
  });

  describe('getBannerById', () => {
    it('should return mock banner when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getBannerById('mock-banner-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('mock-banner-1');
    });

    it('should return null for non-existent mock banner', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getBannerById('non-existent');

      expect(result).toBeNull();
    });

    it('should query database and return banner when not using mock data', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [mockBannerDbRow] });
      mockFastify.pg!.query = mockQuery;

      const result = await service.getBannerById('banner-123');

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM banner_announcements WHERE id = $1', [
        'banner-123',
      ]);
      expect(result).toBeDefined();
      expect(result?.id).toBe('banner-123');
    });

    it('should return null when banner not found in database', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      mockFastify.pg!.query = mockQuery;

      const result = await service.getBannerById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dbError = new Error('Database connection failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(service.getBannerById('banner-123')).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        { error: dbError, bannerId: 'banner-123' },
        'Failed to get banner by ID',
      );
    });
  });

  describe('createBanner', () => {
    it('should return mock banner when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.createBanner(mockCreateBannerRequest, 'admin-123');

      expect(result).toBeDefined();
      expect(result.content).toEqual(mockCreateBannerRequest.content);
      expect(result.variant).toBe(mockCreateBannerRequest.variant);
      expect(result.isDismissible).toBe(mockCreateBannerRequest.isDismissible);
      expect(result.createdBy).toBe('admin-123');
      expect(result.updatedBy).toBe('admin-123');
    });

    it('should create banner in database when not using mock data', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      // Mock transaction flow
      mockPgClient.query = vi
        .fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBannerDbRow] }) // INSERT
        .mockResolvedValueOnce(undefined) // Audit log INSERT
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.createBanner(mockCreateBannerRequest, 'admin-123');

      expect(mockPgClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO banner_announcements'),
        expect.arrayContaining([
          JSON.stringify(mockCreateBannerRequest.content),
          'info',
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          null,
          false,
          'admin-123',
        ]),
      );
      expect(mockPgClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockPgClient.release).toHaveBeenCalled();

      expect(result.id).toBe('banner-123');
      expect(result.content).toEqual({ en: 'Test banner content' });
    });

    it('should rollback transaction on database error', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);

      const dbError = new Error('Database insert failed');
      mockPgClient.query = vi
        .fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(dbError); // INSERT fails

      await expect(service.createBanner(mockCreateBannerRequest, 'admin-123')).rejects.toThrow(
        'Database insert failed',
      );

      expect(mockPgClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockPgClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockPgClient.release).toHaveBeenCalled();
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        { error: dbError, adminUserId: 'admin-123' },
        'Failed to create banner',
      );
    });
  });

  describe('updateBanner', () => {
    const updateRequest: UpdateBannerRequest = {
      isActive: true,
      content: { en: 'Updated banner content' },
      variant: 'warning',
    };

    it('should return updated mock banner when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.updateBanner('mock-banner-1', updateRequest, 'admin-123');

      expect(result).toBeDefined();
      expect(result.content).toEqual(updateRequest.content);
      expect(result.variant).toBe(updateRequest.variant);
      expect(result.updatedBy).toBe('admin-123');
    });

    it('should throw error for non-existent mock banner', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      await expect(
        service.updateBanner('non-existent', updateRequest, 'admin-123'),
      ).rejects.toThrow('Banner not found');
    });

    it('should update banner in database when not using mock data', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getBannerById').mockResolvedValue({
        id: 'banner-123',
        isActive: false,
        priority: 0,
        content: { en: 'Original content' },
        variant: 'info',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'admin-123',
        updatedBy: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updatedRow = { ...mockBannerDbRow, is_active: true, variant: 'warning' };
      mockPgClient.query = vi
        .fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined) // Deactivate other banners UPDATE
        .mockResolvedValueOnce({ rows: [updatedRow] }) // Main UPDATE
        .mockResolvedValueOnce({ rowCount: 2 }) // DELETE dismissals
        .mockResolvedValueOnce(undefined) // Audit log INSERT
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.updateBanner('banner-123', updateRequest, 'admin-123');

      expect(mockPgClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockPgClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE banner_announcements'),
        expect.arrayContaining([
          true,
          JSON.stringify(updateRequest.content),
          'warning',
          'admin-123',
          'banner-123',
        ]),
      );
      expect(mockPgClient.query).toHaveBeenCalledWith('COMMIT');

      expect(result.id).toBe('banner-123');
      expect(result.isActive).toBe(true);
      expect(result.variant).toBe('warning');
    });

    it('should throw error when banner not found', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getBannerById').mockResolvedValue(null);

      await expect(
        service.updateBanner('non-existent', updateRequest, 'admin-123'),
      ).rejects.toThrow('Banner not found');
    });

    it('should throw error when no fields to update', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getBannerById').mockResolvedValue({
        id: 'banner-123',
        isActive: true,
        priority: 0,
        content: { en: 'Test content' },
        variant: 'info',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'admin-123',
        updatedBy: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.updateBanner('banner-123', {}, 'admin-123')).rejects.toThrow(
        'No fields to update',
      );
    });

    it('should rollback transaction on database error', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getBannerById').mockResolvedValue({
        id: 'banner-123',
        isActive: false,
        priority: 0,
        content: { en: 'Original content' },
        variant: 'info',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'admin-123',
        updatedBy: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const dbError = new Error('Database update failed');
      mockPgClient.query = vi
        .fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(dbError); // UPDATE fails

      await expect(service.updateBanner('banner-123', updateRequest, 'admin-123')).rejects.toThrow(
        'Database update failed',
      );

      expect(mockPgClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockPgClient.release).toHaveBeenCalled();
    });
  });

  describe('dismissBanner', () => {
    it('should return mock response when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      await expect(service.dismissBanner('banner-123', 'user-123')).resolves.toBeUndefined();
    });

    it('should insert dismissal record in database when not using mock data', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
      mockFastify.pg!.query = mockQuery;

      await service.dismissBanner('banner-123', 'user-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_banner_dismissals'),
        ['user-123', 'banner-123'],
      );
      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        { bannerId: 'banner-123', userId: 'user-123' },
        'Banner dismissed successfully',
      );
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dbError = new Error('Database insert failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(service.dismissBanner('banner-123', 'user-123')).rejects.toThrow(
        'Database insert failed',
      );
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        { error: dbError, bannerId: 'banner-123', userId: 'user-123' },
        'Failed to dismiss banner',
      );
    });
  });

  describe('deleteBanner', () => {
    it('should return mock response when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      await expect(service.deleteBanner('banner-123', 'admin-123')).resolves.toBeUndefined();
    });

    it('should delete banner from database when not using mock data', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getBannerById').mockResolvedValue({
        id: 'banner-123',
        isActive: true,
        priority: 0,
        content: { en: 'Test content' },
        variant: 'info',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'admin-123',
        updatedBy: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPgClient.query = vi
        .fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined) // Audit log INSERT
        .mockResolvedValueOnce({ rowCount: 1 }) // DELETE
        .mockResolvedValueOnce(undefined); // COMMIT

      await service.deleteBanner('banner-123', 'admin-123');

      expect(mockPgClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockPgClient.query).toHaveBeenCalledWith(
        'DELETE FROM banner_announcements WHERE id = $1',
        ['banner-123'],
      );
      expect(mockPgClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockFastify.log!.info).toHaveBeenCalledWith(
        { bannerId: 'banner-123', adminUserId: 'admin-123' },
        'Banner deleted successfully',
      );
    });

    it('should throw error when banner not found', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getBannerById').mockResolvedValue(null);

      await expect(service.deleteBanner('non-existent', 'admin-123')).rejects.toThrow(
        'Banner not found',
      );
    });

    it('should throw error when delete affects no rows', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getBannerById').mockResolvedValue({
        id: 'banner-123',
        isActive: true,
        priority: 0,
        content: { en: 'Test content' },
        variant: 'info',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'admin-123',
        updatedBy: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPgClient.query = vi
        .fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined) // Audit log INSERT
        .mockResolvedValueOnce({ rowCount: 0 }); // DELETE (no rows affected)

      await expect(service.deleteBanner('banner-123', 'admin-123')).rejects.toThrow(
        'Banner not found',
      );

      expect(mockPgClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback transaction on database error', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      vi.spyOn(service, 'getBannerById').mockResolvedValue({
        id: 'banner-123',
        isActive: true,
        priority: 0,
        content: { en: 'Test content' },
        variant: 'info',
        isDismissible: true,
        markdownEnabled: false,
        createdBy: 'admin-123',
        updatedBy: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const dbError = new Error('Database delete failed');
      mockPgClient.query = vi
        .fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(undefined) // Audit log INSERT
        .mockRejectedValueOnce(dbError); // DELETE fails

      await expect(service.deleteBanner('banner-123', 'admin-123')).rejects.toThrow(
        'Database delete failed',
      );

      expect(mockPgClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockPgClient.release).toHaveBeenCalled();
    });
  });

  describe('getBannerAuditLogs', () => {
    const mockAuditLogRow = {
      id: 'audit-123',
      banner_id: 'banner-123',
      action: 'create',
      changed_by: 'admin-123',
      previous_state: null,
      new_state: { content: { en: 'Test' } },
      changed_at: new Date(),
    };

    it('should return empty array when using mock mode', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(true);

      const result = await service.getBannerAuditLogs('banner-123');

      expect(result).toEqual([]);
    });

    it('should query database and return audit logs when not using mock data', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [mockAuditLogRow] });
      mockFastify.pg!.query = mockQuery;

      const result = await service.getBannerAuditLogs('banner-123');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM banner_audit_log WHERE banner_id = $1 ORDER BY changed_at DESC LIMIT 100',
        ['banner-123'],
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('audit-123');
      expect(result[0].bannerId).toBe('banner-123');
      expect(result[0].action).toBe('create');
    });

    it('should query all audit logs when no banner ID provided', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [mockAuditLogRow] });
      mockFastify.pg!.query = mockQuery;

      const result = await service.getBannerAuditLogs();

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM banner_audit_log ORDER BY changed_at DESC LIMIT 100',
        [],
      );
      expect(result).toHaveLength(1);
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(service, 'shouldUseMockData').mockReturnValue(false);
      const dbError = new Error('Database query failed');
      mockFastify.pg!.query = vi.fn().mockRejectedValue(dbError);

      await expect(service.getBannerAuditLogs('banner-123')).rejects.toThrow(
        'Database query failed',
      );
      expect(mockFastify.log!.error).toHaveBeenCalledWith(
        { error: dbError, bannerId: 'banner-123' },
        'Failed to get banner audit logs',
      );
    });
  });
});

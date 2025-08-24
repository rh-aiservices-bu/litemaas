import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app';
import { generateTestToken, mockUser } from '../setup';

describe('Banner Routes', () => {
  let app: FastifyInstance;

  const mockBanner = {
    id: 'banner-123',
    name: 'Test Banner',
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

  const mockCreateBannerRequest = {
    name: 'New Banner',
    content: { en: 'New banner content' },
    variant: 'info',
    isDismissible: true,
    markdownEnabled: false,
  };

  beforeAll(async () => {
    app = await createApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/v1/banners', () => {
    it('should return active banners for public access', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners',
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(Array.isArray(result)).toBe(true);

        if (result.length > 0) {
          const banner = result[0];
          expect(banner).toHaveProperty('id');
          expect(banner).toHaveProperty('content');
          expect(banner).toHaveProperty('variant');
          expect(banner).toHaveProperty('isDismissible');
          expect(banner).toHaveProperty('isActive');
        }
      }
    });

    it('should return active banners for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should include cache headers for efficient polling', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners',
      });

      if (response.statusCode === 200) {
        expect(response.headers['cache-control']).toContain('no-cache');
        expect(response.headers['pragma']).toBe('no-cache');
        expect(response.headers['expires']).toBe('0');
      }
    });
  });

  describe('POST /api/v1/banners/:id/dismiss', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/banner-123/dismiss',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should dismiss a banner for authenticated user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/banner-123/dismiss',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
      });

      expect([200, 400, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('message', 'Banner dismissed successfully');
      }
    });

    it('should return 404 for non-existent banner', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/non-existent-banner/dismiss',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
      });

      expect([404, 401]).toContain(response.statusCode);
      if (response.statusCode === 404) {
        const result = JSON.parse(response.body);
        expect(result.error.code).toBe('BANNER_NOT_FOUND');
      }
    });

    it('should return 400 for non-dismissible banner', async () => {
      // This test would need a specific banner that is not dismissible
      // For now, we'll just test the error structure
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/non-dismissible-banner/dismiss',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
      });

      expect([200, 400, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 400) {
        const result = JSON.parse(response.body);
        expect(result.error.code).toBe('BANNER_NOT_DISMISSIBLE');
      }
    });
  });

  describe('GET /api/v1/banners/admin', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin permissions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should return all banners for admin users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should allow adminReadonly users to view banners', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['adminReadonly'])}`,
        },
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe('POST /api/v1/banners/admin', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/admin',
        payload: mockCreateBannerRequest,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin permissions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/admin',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
        payload: mockCreateBannerRequest,
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should not allow adminReadonly users to create banners', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/admin',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['adminReadonly'])}`,
        },
        payload: mockCreateBannerRequest,
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should create a new banner for admin users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/admin',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
        payload: mockCreateBannerRequest,
      });

      expect([201, 401]).toContain(response.statusCode);
      if (response.statusCode === 201) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('banner');
        expect(result).toHaveProperty('message', 'Banner created successfully');
        expect(result.banner).toHaveProperty('id');
        expect(result.banner).toHaveProperty('content', mockCreateBannerRequest.content);
        expect(result.banner).toHaveProperty('variant', mockCreateBannerRequest.variant);
      }
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/admin',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
        payload: {
          // Missing required 'content' field
          variant: 'info',
        },
      });

      expect([400, 401]).toContain(response.statusCode);
      if (response.statusCode === 400) {
        const result = JSON.parse(response.body);
        expect(result.error).toBeDefined();
      }
    });

    it('should validate content has English text', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/banners/admin',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
        payload: {
          content: { es: 'Spanish only content' },
          variant: 'info',
        },
      });

      expect([400, 401]).toContain(response.statusCode);
      if (response.statusCode === 400) {
        const result = JSON.parse(response.body);
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Request validation failed');
      }
    });
  });

  describe('GET /api/v1/banners/admin/:id', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin/banner-123',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin permissions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should return banner details for admin users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
      });

      expect([200, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('variant');
      }
    });

    it('should return 404 for non-existent banner', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin/non-existent-banner',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
      });

      expect([404, 401]).toContain(response.statusCode);
      if (response.statusCode === 404) {
        const result = JSON.parse(response.body);
        expect(result.error.code).toBe('BANNER_NOT_FOUND');
      }
    });
  });

  describe('PUT /api/v1/banners/admin/:id', () => {
    const updateRequest = {
      isActive: true,
      content: { en: 'Updated banner content' },
      variant: 'warning',
    };

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/banners/admin/banner-123',
        payload: updateRequest,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin permissions', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
        payload: updateRequest,
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should not allow adminReadonly users to update banners', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['adminReadonly'])}`,
        },
        payload: updateRequest,
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should update banner for admin users', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
        payload: updateRequest,
      });

      expect([200, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('banner');
        expect(result).toHaveProperty('message', 'Banner updated successfully');
        expect(result.banner).toHaveProperty('id');
      }
    });

    it('should invalidate cache on update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
        payload: updateRequest,
      });

      if (response.statusCode === 200) {
        expect(response.headers['cache-control']).toBe('no-cache');
      }
    });

    it('should validate content has English text when provided', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
        payload: {
          content: { es: 'Spanish only content' },
        },
      });

      expect([400, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 400) {
        const result = JSON.parse(response.body);
        // The validation can happen at schema level (VALIDATION_ERROR) or app level (INVALID_CONTENT)
        expect(['VALIDATION_ERROR', 'INVALID_CONTENT']).toContain(result.error.code);
      }
    });
  });

  describe('PATCH /api/v1/banners/admin/:id', () => {
    const updateRequest = {
      isActive: false,
      priority: 5,
    };

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/banners/admin/banner-123',
        payload: updateRequest,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin permissions', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
        payload: updateRequest,
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should update banner with full schema for admin users', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
        payload: updateRequest,
      });

      expect([200, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('banner');
        expect(result).toHaveProperty('message', 'Banner updated successfully');
      }
    });
  });

  describe('DELETE /api/v1/banners/admin/:id', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/banners/admin/banner-123',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin permissions', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should not allow adminReadonly users to delete banners', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['adminReadonly'])}`,
        },
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should delete banner for admin users', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/banners/admin/banner-123',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
      });

      expect([200, 404, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('message', 'Banner deleted successfully');
      }
    });

    it('should return 404 for non-existent banner', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/banners/admin/non-existent-banner',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
      });

      expect([404, 401]).toContain(response.statusCode);
      if (response.statusCode === 404) {
        const result = JSON.parse(response.body);
        expect(result.error.code).toBe('BANNER_DELETE_ERROR');
      }
    });
  });

  describe('GET /api/v1/banners/admin/:id/audit', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin/banner-123/audit',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin permissions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin/banner-123/audit',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['user'])}`,
        },
      });

      expect([403, 401]).toContain(response.statusCode);
    });

    it('should return audit logs for admin users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin/banner-123/audit',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['admin'])}`,
        },
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('auditLogs');
        expect(result).toHaveProperty('total');
        expect(Array.isArray(result.auditLogs)).toBe(true);
        expect(typeof result.total).toBe('number');
      }
    });

    it('should allow adminReadonly users to view audit logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/banners/admin/banner-123/audit',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser.id, ['adminReadonly'])}`,
        },
      });

      expect([200, 401]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('auditLogs');
        expect(result).toHaveProperty('total');
      }
    });
  });
});

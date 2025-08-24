import { FastifyPluginAsync } from 'fastify';
import { BannerService } from '../services/banner.service';
import { AuthenticatedRequest } from '../types';
import {
  BannerSchema,
  CreateBannerSchema,
  UpdateBannerSchema,
  SimpleBannerUpdateSchema,
  BannerIdParamSchema,
  BannerCreatedResponseSchema,
  BannerUpdatedResponseSchema,
  BannerDeletedResponseSchema,
  BannerDismissedResponseSchema,
  BannerAuditLogListResponseSchema,
  BulkVisibilityUpdateSchema,
  BulkVisibilityUpdateResponseSchema,
  ErrorResponseSchema,
} from '../schemas';

const bannerRoutes: FastifyPluginAsync = async (fastify) => {
  const bannerService = new BannerService(fastify);

  // Public endpoint - Get active banners for current user
  fastify.get('/', {
    schema: {
      tags: ['Banners'],
      summary: 'Get active banners',
      description: 'Returns active banners visible to the current user (public endpoint)',
      response: {
        200: {
          type: 'array',
          items: BannerSchema,
        },
        500: ErrorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const user = authRequest.user; // May be undefined for public access

        const banners = await bannerService.getActiveBanners(user?.userId, user?.roles);

        // Set cache headers for immediate updates
        reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        reply.header('Pragma', 'no-cache');
        reply.header('Expires', '0');

        return banners;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get active banners');
        return reply.code(500).send({
          error: {
            code: 'BANNER_FETCH_ERROR',
            message: 'Failed to retrieve banners',
          },
          requestId: request.id,
        });
      }
    },
  });

  // User endpoint - Dismiss a banner
  fastify.post('/:id/dismiss', {
    schema: {
      tags: ['Banners'],
      summary: 'Dismiss a banner',
      description: 'Dismiss a banner for the current user',
      security: [{ bearerAuth: [] }],
      params: BannerIdParamSchema,
      response: {
        200: BannerDismissedResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const { id: bannerId } = request.params as { id: string };
        const userId = authRequest.user?.userId;

        if (!userId) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'User ID not found in request',
            },
            requestId: request.id,
          });
        }

        // Check if banner exists and is dismissible
        const banner = await bannerService.getBannerById(bannerId);
        if (!banner) {
          return reply.code(404).send({
            error: {
              code: 'BANNER_NOT_FOUND',
              message: 'Banner not found',
            },
            requestId: request.id,
          });
        }

        if (!banner.isDismissible) {
          return reply.code(400).send({
            error: {
              code: 'BANNER_NOT_DISMISSIBLE',
              message: 'This banner cannot be dismissed',
            },
            requestId: request.id,
          });
        }

        await bannerService.dismissBanner(bannerId, userId);

        return {
          message: 'Banner dismissed successfully',
        };
      } catch (error) {
        fastify.log.error({ error, bannerId: request.params }, 'Failed to dismiss banner');
        return reply.code(500).send({
          error: {
            code: 'BANNER_DISMISS_ERROR',
            message: 'Failed to dismiss banner',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Get all banners
  fastify.get('/admin', {
    schema: {
      tags: ['Admin', 'Banners'],
      summary: 'Get all banners (admin)',
      description: 'Get all banners including inactive ones (admin/adminReadonly only)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'array',
          items: BannerSchema,
        },
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:read')],
    handler: async (request, reply) => {
      try {
        // Get all banners regardless of active status for admin management
        const banners = await bannerService.getAllBanners();

        return banners;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get all banners');
        return reply.code(500).send({
          error: {
            code: 'BANNER_FETCH_ERROR',
            message: 'Failed to retrieve banners',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Create banner
  fastify.post('/admin', {
    schema: {
      tags: ['Admin', 'Banners'],
      summary: 'Create a new banner',
      description: 'Create a new banner announcement (admin only)',
      security: [{ bearerAuth: [] }],
      body: CreateBannerSchema,
      response: {
        201: BannerCreatedResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:write')],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const bannerData = request.body as any;
        const adminUserId = authRequest.user?.userId;

        if (!adminUserId) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Admin user ID not found in request',
            },
            requestId: request.id,
          });
        }

        // Validate content has at least English
        if (!bannerData.content?.en) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_CONTENT',
              message: 'Banner content must include English (en) text',
            },
            requestId: request.id,
          });
        }

        const banner = await bannerService.createBanner(bannerData, adminUserId);

        // Log admin action
        fastify.log.info(
          {
            adminUser: adminUserId,
            bannerId: banner.id,
            action: 'banner_created',
          },
          'Banner created by admin',
        );

        return reply.code(201).send({
          banner,
          message: 'Banner created successfully',
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create banner');
        return reply.code(500).send({
          error: {
            code: 'BANNER_CREATE_ERROR',
            message: 'Failed to create banner',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Get specific banner
  fastify.get('/admin/:id', {
    schema: {
      tags: ['Admin', 'Banners'],
      summary: 'Get banner by ID',
      description: 'Get a specific banner by ID (admin/adminReadonly only)',
      security: [{ bearerAuth: [] }],
      params: BannerIdParamSchema,
      response: {
        200: BannerSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:read')],
    handler: async (request, reply) => {
      try {
        const { id: bannerId } = request.params as { id: string };

        const banner = await bannerService.getBannerById(bannerId);

        if (!banner) {
          return reply.code(404).send({
            error: {
              code: 'BANNER_NOT_FOUND',
              message: 'Banner not found',
            },
            requestId: request.id,
          });
        }

        return banner;
      } catch (error) {
        fastify.log.error({ error, bannerId: request.params }, 'Failed to get banner');
        return reply.code(500).send({
          error: {
            code: 'BANNER_FETCH_ERROR',
            message: 'Failed to retrieve banner',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Update banner (simplified for Tools page)
  fastify.put('/admin/:id', {
    schema: {
      tags: ['Admin', 'Banners'],
      summary: 'Update banner (simplified)',
      description: 'Update a banner with simplified schema for Tools page (admin only)',
      security: [{ bearerAuth: [] }],
      params: BannerIdParamSchema,
      body: SimpleBannerUpdateSchema,
      response: {
        200: BannerUpdatedResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:write')],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const { id: bannerId } = request.params as { id: string };
        const updates = request.body as any;
        const adminUserId = authRequest.user?.userId;

        if (!adminUserId) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Admin user ID not found in request',
            },
            requestId: request.id,
          });
        }

        // Validate content has at least English if provided
        if (updates.content && !updates.content.en) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_CONTENT',
              message: 'Banner content must include English (en) text',
            },
            requestId: request.id,
          });
        }

        const banner = await bannerService.updateBanner(bannerId, updates, adminUserId);

        // Log admin action
        fastify.log.info(
          {
            adminUser: adminUserId,
            bannerId,
            action: 'banner_updated',
            isActive: updates.isActive,
          },
          'Banner updated by admin',
        );

        // Invalidate cache for all users
        reply.header('Cache-Control', 'no-cache');

        return {
          banner,
          message: 'Banner updated successfully',
        };
      } catch (error) {
        fastify.log.error({ error, bannerId: request.params }, 'Failed to update banner');
        return reply.code(500).send({
          error: {
            code: 'BANNER_UPDATE_ERROR',
            message: 'Failed to update banner',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Full update banner
  fastify.patch('/admin/:id', {
    schema: {
      tags: ['Admin', 'Banners'],
      summary: 'Update banner (full)',
      description: 'Update a banner with full schema (admin only)',
      security: [{ bearerAuth: [] }],
      params: BannerIdParamSchema,
      body: UpdateBannerSchema,
      response: {
        200: BannerUpdatedResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:write')],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const { id: bannerId } = request.params as { id: string };
        const updates = request.body as any;
        const adminUserId = authRequest.user?.userId;

        if (!adminUserId) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Admin user ID not found in request',
            },
            requestId: request.id,
          });
        }

        const banner = await bannerService.updateBanner(bannerId, updates, adminUserId);

        // Log admin action
        fastify.log.info(
          {
            adminUser: adminUserId,
            bannerId,
            action: 'banner_updated_full',
            changes: Object.keys(updates),
          },
          'Banner updated (full) by admin',
        );

        return {
          banner,
          message: 'Banner updated successfully',
        };
      } catch (error) {
        fastify.log.error({ error, bannerId: request.params }, 'Failed to update banner');
        return reply.code(500).send({
          error: {
            code: 'BANNER_UPDATE_ERROR',
            message: 'Failed to update banner',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Bulk update banner visibility
  fastify.patch('/admin/bulk-visibility', {
    schema: {
      tags: ['Admin', 'Banners'],
      summary: 'Bulk update banner visibility',
      description: 'Update visibility states for multiple banners (admin only)',
      security: [{ bearerAuth: [] }],
      body: BulkVisibilityUpdateSchema,
      response: {
        200: BulkVisibilityUpdateResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:write')],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const adminUserId = authRequest.user?.userId;
        const visibilityUpdates = request.body as Record<string, boolean>;

        if (!adminUserId) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'User ID not found in request',
            },
            requestId: request.id,
          });
        }

        // Validate at least one update
        if (Object.keys(visibilityUpdates).length === 0) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_REQUEST',
              message: 'No visibility updates provided',
            },
            requestId: request.id,
          });
        }

        await bannerService.bulkUpdateVisibility(visibilityUpdates, adminUserId);

        // Log admin action
        fastify.log.info(
          {
            adminUser: adminUserId,
            updates: visibilityUpdates,
            action: 'banner_bulk_visibility_update',
          },
          'Banner visibility bulk update by admin',
        );

        return { message: 'Banner visibility updates applied successfully' };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to apply bulk visibility updates');
        return reply.code(500).send({
          error: {
            code: 'BULK_UPDATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to apply visibility updates',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Delete banner
  fastify.delete('/admin/:id', {
    schema: {
      tags: ['Admin', 'Banners'],
      summary: 'Delete banner',
      description: 'Delete a banner (admin only)',
      security: [{ bearerAuth: [] }],
      params: BannerIdParamSchema,
      response: {
        200: BannerDeletedResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:write')],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const { id: bannerId } = request.params as { id: string };
        const adminUserId = authRequest.user?.userId;

        if (!adminUserId) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Admin user ID not found in request',
            },
            requestId: request.id,
          });
        }

        await bannerService.deleteBanner(bannerId, adminUserId);

        // Log admin action
        fastify.log.info(
          {
            adminUser: adminUserId,
            bannerId,
            action: 'banner_deleted',
          },
          'Banner deleted by admin',
        );

        return {
          message: 'Banner deleted successfully',
        };
      } catch (error) {
        fastify.log.error({ error, bannerId: request.params }, 'Failed to delete banner');
        return reply.code(500).send({
          error: {
            code: 'BANNER_DELETE_ERROR',
            message: 'Failed to delete banner',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Get banner audit logs
  fastify.get('/admin/:id/audit', {
    schema: {
      tags: ['Admin', 'Banners'],
      summary: 'Get banner audit logs',
      description: 'Get audit logs for a specific banner (admin/adminReadonly only)',
      security: [{ bearerAuth: [] }],
      params: BannerIdParamSchema,
      response: {
        200: BannerAuditLogListResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:read')],
    handler: async (request, reply) => {
      try {
        const { id: bannerId } = request.params as { id: string };

        const auditLogs = await bannerService.getBannerAuditLogs(bannerId);

        return {
          auditLogs,
          total: auditLogs.length,
        };
      } catch (error) {
        fastify.log.error({ error, bannerId: request.params }, 'Failed to get banner audit logs');
        return reply.code(500).send({
          error: {
            code: 'AUDIT_FETCH_ERROR',
            message: 'Failed to retrieve audit logs',
          },
          requestId: request.id,
        });
      }
    },
  });
};

export default bannerRoutes;

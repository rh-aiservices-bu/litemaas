import { FastifyPluginAsync } from 'fastify';
import { BrandingService } from '../services/branding.service';
import { AuthenticatedRequest } from '../types';
import {
  BrandingSettingsSchema,
  UpdateBrandingSettingsSchema,
  UploadBrandingImageSchema,
  BrandingImageParamsSchema,
  BrandingErrorResponseSchema,
} from '../schemas';

const brandingRoutes: FastifyPluginAsync = async (fastify) => {
  const brandingService = new BrandingService(fastify);

  // Public endpoint - Get branding settings metadata (no image data)
  fastify.get('/', {
    schema: {
      tags: ['Branding'],
      summary: 'Get branding settings',
      description: 'Returns branding settings metadata (public endpoint, no image data)',
      response: {
        200: BrandingSettingsSchema,
        500: BrandingErrorResponseSchema,
      },
    },
    handler: async (_request, reply) => {
      try {
        const settings = await brandingService.getSettings();
        return settings;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get branding settings');
        return reply.code(500).send({
          error: {
            code: 'BRANDING_FETCH_ERROR',
            message: 'Failed to retrieve branding settings',
          },
          requestId: _request.id,
        });
      }
    },
  });

  // Admin endpoint - Update branding settings (toggles and text)
  fastify.patch('/', {
    schema: {
      tags: ['Admin', 'Branding'],
      summary: 'Update branding settings',
      description: 'Update branding toggles and text fields (admin only)',
      security: [{ bearerAuth: [] }],
      body: UpdateBrandingSettingsSchema,
      response: {
        200: BrandingSettingsSchema,
        401: BrandingErrorResponseSchema,
        403: BrandingErrorResponseSchema,
        500: BrandingErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:write')],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
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

        const data = request.body as any;
        const settings = await brandingService.updateSettings(data, adminUserId);

        fastify.log.info(
          { adminUser: adminUserId, action: 'branding_settings_updated' },
          'Branding settings updated by admin',
        );

        return settings;
      } catch (error) {
        fastify.log.error({ error }, 'Failed to update branding settings');
        return reply.code(500).send({
          error: {
            code: 'BRANDING_UPDATE_ERROR',
            message: 'Failed to update branding settings',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Upload branding image
  fastify.put('/images/:type', {
    schema: {
      tags: ['Admin', 'Branding'],
      summary: 'Upload branding image',
      description: 'Upload a branding image (admin only). Max 2 MB, formats: jpg, jpeg, png, svg, gif, webp',
      security: [{ bearerAuth: [] }],
      params: BrandingImageParamsSchema,
      body: UploadBrandingImageSchema,
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        400: BrandingErrorResponseSchema,
        401: BrandingErrorResponseSchema,
        403: BrandingErrorResponseSchema,
        500: BrandingErrorResponseSchema,
      },
    },
    bodyLimit: 4 * 1024 * 1024, // 4 MB to account for base64 overhead
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:write')],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const adminUserId = authRequest.user?.userId;
        const { type } = request.params as { type: string };

        if (!adminUserId) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Admin user ID not found in request',
            },
            requestId: request.id,
          });
        }

        const { data, mimeType } = request.body as { data: string; mimeType: string };
        await brandingService.uploadImage(type as any, data, mimeType, adminUserId);

        fastify.log.info(
          { adminUser: adminUserId, imageType: type, action: 'branding_image_uploaded' },
          'Branding image uploaded by admin',
        );

        return { message: `Image ${type} uploaded successfully` };
      } catch (error: any) {
        if (error?.statusCode === 400 || error?.code === 'VALIDATION_ERROR') {
          return reply.code(400).send({
            error: {
              code: 'BRANDING_VALIDATION_ERROR',
              message: error.message || 'Invalid image data',
            },
            requestId: request.id,
          });
        }
        fastify.log.error({ error }, 'Failed to upload branding image');
        return reply.code(500).send({
          error: {
            code: 'BRANDING_UPLOAD_ERROR',
            message: 'Failed to upload branding image',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Admin endpoint - Delete branding image
  fastify.delete('/images/:type', {
    schema: {
      tags: ['Admin', 'Branding'],
      summary: 'Delete branding image',
      description: 'Remove a branding image (admin only)',
      security: [{ bearerAuth: [] }],
      params: BrandingImageParamsSchema,
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        401: BrandingErrorResponseSchema,
        403: BrandingErrorResponseSchema,
        500: BrandingErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:banners:write')],
    handler: async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        const adminUserId = authRequest.user?.userId;
        const { type } = request.params as { type: string };

        if (!adminUserId) {
          return reply.code(401).send({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Admin user ID not found in request',
            },
            requestId: request.id,
          });
        }

        await brandingService.deleteImage(type as any, adminUserId);

        fastify.log.info(
          { adminUser: adminUserId, imageType: type, action: 'branding_image_deleted' },
          'Branding image deleted by admin',
        );

        return { message: `Image ${type} deleted successfully` };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to delete branding image');
        return reply.code(500).send({
          error: {
            code: 'BRANDING_DELETE_ERROR',
            message: 'Failed to delete branding image',
          },
          requestId: request.id,
        });
      }
    },
  });

  // Public endpoint - Serve branding image as binary
  fastify.get('/images/:type', {
    schema: {
      tags: ['Branding'],
      summary: 'Get branding image',
      description: 'Returns the branding image as binary data with proper Content-Type',
      params: BrandingImageParamsSchema,
    },
    handler: async (request, reply) => {
      try {
        const { type } = request.params as { type: string };
        const image = await brandingService.getImage(type as any);

        if (!image) {
          return reply.code(404).send({
            error: {
              code: 'IMAGE_NOT_FOUND',
              message: `No ${type} image has been uploaded`,
            },
            requestId: request.id,
          });
        }

        reply.header('Content-Type', image.mimeType);
        reply.header('Cache-Control', 'public, max-age=3600');
        return reply.send(image.data);
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get branding image');
        return reply.code(500).send({
          error: {
            code: 'BRANDING_IMAGE_ERROR',
            message: 'Failed to retrieve branding image',
          },
          requestId: request.id,
        });
      }
    },
  });
};

export default brandingRoutes;

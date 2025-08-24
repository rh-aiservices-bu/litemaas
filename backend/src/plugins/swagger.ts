import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import swagger from '@fastify/swagger';
import { AuthenticatedRequest } from '../types/auth.types';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'LiteMaaS API',
        description: 'LiteLLM Model as a Service API',
        version: '1.0.0',
        contact: {
          name: 'LiteMaaS Team',
          email: 'ai-bu-cai@redhat.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      host: process.env.NODE_ENV === 'production' ? 'api.litemaas.com' : 'localhost:8081',
      schemes: process.env.NODE_ENV === 'production' ? ['https'] : ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'JWT token for authentication (Bearer token)',
        },
      },
      tags: [
        { name: 'Authentication', description: 'User authentication and authorization' },
        { name: 'Models', description: 'Model discovery and information' },
        { name: 'Subscriptions', description: 'Model subscription management' },
        { name: 'API Keys', description: 'API key management' },
        { name: 'Usage', description: 'Usage statistics and analytics' },
        { name: 'Health', description: 'Health checks and monitoring' },
        { name: 'Banners', description: 'Banner announcements and management' },
        { name: 'Admin', description: 'Administrative operations' },
        { name: 'General', description: 'General API endpoints' },
      ],
    },
    transform: ({ schema, url }) => {
      // Transform schemas for better documentation
      if (schema.tags && schema.tags.includes('Authentication')) {
        schema.security = schema.security || [];
      }
      return { schema, url };
    },
  });

  await fastify.register(import('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      displayOperationId: false,
      displayRequestDuration: true,
      filter: true,
      showExtensions: false,
      showCommonExtensions: false,
      tryItOutEnabled: true,
    },
    uiHooks: {
      onRequest: async (request, reply) => {
        // In production, require strict authentication (no frontend bypass)
        if (process.env.NODE_ENV === 'production') {
          try {
            // Use strict authentication - only allow admin API keys or JWT tokens
            await fastify.authenticate(request, reply);

            fastify.log.warn(
              {
                ip: request.ip,
                userAgent: request.headers['user-agent'],
                url: request.url,
                userId: (request as AuthenticatedRequest).user?.userId,
              },
              'Swagger documentation accessed in production mode',
            );
          } catch (error) {
            fastify.log.warn(
              {
                ip: request.ip,
                userAgent: request.headers['user-agent'],
                url: request.url,
                error: (error as Error).message,
              },
              'Unauthorized access attempt to Swagger documentation in production',
            );

            return reply.status(401).send({
              error: {
                code: 'UNAUTHORIZED',
                message:
                  'Authentication required to access API documentation in production mode. Use admin API key or JWT token.',
              },
              requestId: request.id,
            });
          }
          return;
        }

        // In development, log access and allow browser access
        fastify.log.warn(
          {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            url: request.url,
          },
          'Swagger documentation accessed in development mode',
        );
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Add OpenAPI JSON endpoint (protected)
  fastify.get('/openapi.json', {
    schema: {
      hide: true,
    },
    preHandler: fastify.authenticateWithDevBypass,
    handler: (_request, reply) => {
      reply.send(fastify.swagger());
    },
  });
};

export default fastifyPlugin(swaggerPlugin);

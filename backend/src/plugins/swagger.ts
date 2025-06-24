import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'LiteMaaS API',
        description: 'LiteLLM Model as a Service API',
        version: '1.0.0',
        contact: {
          name: 'LiteMaaS Team',
          email: 'support@litemaas.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      host: process.env.NODE_ENV === 'production' ? 'api.litemaas.com' : 'localhost:8080',
      schemes: process.env.NODE_ENV === 'production' ? ['https'] : ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication',
        },
      },
      tags: [
        { name: 'Authentication', description: 'User authentication and authorization' },
        { name: 'Models', description: 'Model discovery and information' },
        { name: 'Subscriptions', description: 'Model subscription management' },
        { name: 'API Keys', description: 'API key management' },
        { name: 'Usage', description: 'Usage statistics and analytics' },
        { name: 'Health', description: 'Health checks and monitoring' },
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
      onRequest: (request, reply, next) => {
        // Add custom headers or validation
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Add OpenAPI JSON endpoint
  fastify.get('/openapi.json', {
    schema: {
      hide: true,
    },
    handler: (request, reply) => {
      reply.send(fastify.swagger());
    },
  });
};

export default fastifyPlugin(swaggerPlugin);
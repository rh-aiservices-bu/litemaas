import { FastifyPluginAsync } from 'fastify';
import { LiteLLMService } from '../services/litellm.service';

interface LiteLLMMetrics {
  cacheSize: number;
  circuitBreakerStatus: {
    isOpen: boolean;
    failureCount: number;
    lastFailureTime: number;
  };
  config: {
    enableMocking: boolean;
    baseUrl: string;
    timeout: number;
  };
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    litellm: 'healthy' | 'unhealthy';
    auth: 'healthy' | 'unhealthy';
  };
  details?: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    environment: string;
    litellmMetrics?: LiteLLMMetrics;
  };
}

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize LiteLLM service
  const liteLLMService = new LiteLLMService(fastify);

  // Helper function to check database health
  const checkDatabaseHealth = async (): Promise<'healthy' | 'unhealthy'> => {
    try {
      await fastify.dbUtils.queryOne('SELECT 1 as test');
      return 'healthy';
    } catch (error) {
      fastify.log.error(error, 'Database health check failed');
      return 'unhealthy';
    }
  };

  // Helper function to check LiteLLM health
  const checkLiteLLMHealth = async (): Promise<'healthy' | 'unhealthy'> => {
    try {
      const health = await liteLLMService.getHealth();
      return health.status === 'healthy' ? 'healthy' : 'unhealthy';
    } catch (error) {
      fastify.log.error(error, 'LiteLLM health check failed');
      return 'unhealthy';
    }
  };

  // Helper function to check auth system health
  const checkAuthHealth = async (): Promise<'healthy' | 'unhealthy'> => {
    try {
      // Check if authentication services are available
      // This is a basic check - in production you might want to verify OAuth endpoints
      if (fastify.rbac && fastify.oauth && fastify.sessionService) {
        return 'healthy';
      }
      return 'unhealthy';
    } catch (error) {
      fastify.log.error(error, 'Auth health check failed');
      return 'unhealthy';
    }
  };

  // Health check
  fastify.get<{
    Reply: HealthStatus;
  }>('/', {
    schema: {
      tags: ['Health'],
      description: 'Health check endpoint',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string' },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'string', enum: ['healthy', 'unhealthy'] },
                litellm: { type: 'string', enum: ['healthy', 'unhealthy'] },
                auth: { type: 'string', enum: ['healthy', 'unhealthy'] },
              },
            },
            details: {
              type: 'object',
              properties: {
                uptime: { type: 'number' },
                memoryUsage: { type: 'object' },
                environment: { type: 'string' },
                litellmMetrics: { type: 'object' },
              },
            },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      const startTime = Date.now();

      // Perform health checks in parallel
      const [databaseStatus, litellmStatus, authStatus] = await Promise.allSettled([
        checkDatabaseHealth(),
        checkLiteLLMHealth(),
        checkAuthHealth(),
      ]);

      const checks = {
        database: databaseStatus.status === 'fulfilled' ? databaseStatus.value : 'unhealthy',
        litellm: litellmStatus.status === 'fulfilled' ? litellmStatus.value : 'unhealthy',
        auth: authStatus.status === 'fulfilled' ? authStatus.value : 'unhealthy',
      };

      const allHealthy = Object.values(checks).every((status) => status === 'healthy');
      const checkDuration = Date.now() - startTime;

      // Get additional metrics
      let litellmMetrics: LiteLLMMetrics | undefined = undefined;
      try {
        litellmMetrics = liteLLMService.getMetrics();
      } catch (error) {
        fastify.log.warn(error, 'Failed to get LiteLLM metrics');
      }

      const response: HealthStatus = {
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        checks,
        details: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development',
          litellmMetrics,
        },
      };

      // Set appropriate HTTP status
      if (!allHealthy) {
        reply.status(503);
      }

      fastify.log.debug(
        {
          healthStatus: response.status,
          checks,
          checkDuration,
        },
        'Health check completed',
      );

      return response;
    },
  });

  // Readiness probe
  fastify.get('/ready', {
    schema: {
      tags: ['Health'],
      description: 'Readiness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      try {
        // Check if essential services are ready
        const [dbReady, authReady] = await Promise.allSettled([
          checkDatabaseHealth(),
          checkAuthHealth(),
        ]);

        const isReady =
          dbReady.status === 'fulfilled' &&
          dbReady.value === 'healthy' &&
          authReady.status === 'fulfilled' &&
          authReady.value === 'healthy';

        if (!isReady) {
          reply.status(503);
        }

        return { ready: isReady };
      } catch (error) {
        fastify.log.error(error, 'Readiness check failed');
        reply.status(503);
        return { ready: false };
      }
    },
  });

  // Liveness probe
  fastify.get('/live', {
    schema: {
      tags: ['Health'],
      description: 'Liveness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            alive: { type: 'boolean' },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      // Simple liveness check - just verify the process is running
      // and basic Node.js functions work
      try {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();

        // Basic sanity checks
        const isAlive = memUsage.heapUsed > 0 && uptime > 0 && Date.now() > 0;

        if (!isAlive) {
          reply.status(503);
        }

        return { alive: isAlive };
      } catch (error) {
        fastify.log.error(error, 'Liveness check failed');
        reply.status(503);
        return { alive: false };
      }
    },
  });

  // Prometheus metrics
  fastify.get('/metrics', {
    schema: {
      tags: ['Health'],
      description: 'Prometheus metrics',
      response: {
        200: {
          type: 'string',
          description: 'Prometheus format metrics',
        },
      },
    },
    handler: async (_request, reply) => {
      try {
        reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');

        const memUsage = process.memoryUsage();
        const uptime = process.uptime();
        const timestamp = Date.now();

        let litellmMetrics: LiteLLMMetrics | null = null;
        try {
          litellmMetrics = liteLLMService.getMetrics();
        } catch (error) {
          fastify.log.warn(error, 'Failed to get LiteLLM metrics for Prometheus');
        }

        // Basic application metrics in Prometheus format
        const metrics = [
          '# HELP litemaas_uptime_seconds Application uptime in seconds',
          '# TYPE litemaas_uptime_seconds gauge',
          `litemaas_uptime_seconds ${uptime}`,
          '',
          '# HELP litemaas_memory_usage_bytes Memory usage in bytes',
          '# TYPE litemaas_memory_usage_bytes gauge',
          `litemaas_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}`,
          `litemaas_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}`,
          `litemaas_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
          `litemaas_memory_usage_bytes{type="external"} ${memUsage.external}`,
          '',
          '# HELP litemaas_build_info Build information',
          '# TYPE litemaas_build_info gauge',
          `litemaas_build_info{version="${process.env.npm_package_version || '1.0.0'}",node_version="${process.version}",environment="${process.env.NODE_ENV || 'development'}"} 1`,
          '',
          '# HELP litemaas_litellm_cache_size LiteLLM cache size',
          '# TYPE litemaas_litellm_cache_size gauge',
          `litemaas_litellm_cache_size ${litellmMetrics?.cacheSize || 0}`,
          '',
          '# HELP litemaas_litellm_circuit_breaker_status LiteLLM circuit breaker status',
          '# TYPE litemaas_litellm_circuit_breaker_status gauge',
          `litemaas_litellm_circuit_breaker_status{status="open"} ${litellmMetrics?.circuitBreakerStatus?.isOpen ? 1 : 0}`,
          `litemaas_litellm_circuit_breaker_failures_total ${litellmMetrics?.circuitBreakerStatus?.failureCount || 0}`,
          '',
          '# HELP litemaas_timestamp_seconds Current timestamp',
          '# TYPE litemaas_timestamp_seconds gauge',
          `litemaas_timestamp_seconds ${Math.floor(timestamp / 1000)}`,
          '',
        ];

        return metrics.join('\n');
      } catch (error) {
        fastify.log.error(error, 'Failed to generate metrics');
        reply.status(500);
        return '# Error generating metrics\n';
      }
    },
  });

  // Admin endpoint to get detailed service status
  fastify.get('/status', {
    schema: {
      tags: ['Health'],
      description: 'Detailed service status (admin only)',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            services: {
              type: 'object',
              properties: {
                database: { type: 'object' },
                litellm: { type: 'object' },
                auth: { type: 'object' },
              },
            },
            metrics: { type: 'object' },
            configuration: { type: 'object' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:health')],
    handler: async (_request, _reply) => {
      try {
        // Get detailed status for each service
        const services = {
          database: {
            status: await checkDatabaseHealth(),
            lastCheck: new Date().toISOString(),
          },
          litellm: {
            status: await checkLiteLLMHealth(),
            lastCheck: new Date().toISOString(),
            metrics: liteLLMService.getMetrics(),
          },
          auth: {
            status: await checkAuthHealth(),
            lastCheck: new Date().toISOString(),
            services: {
              rbac: !!fastify.rbac,
              oauth: !!fastify.oauth,
              session: !!fastify.sessionService,
            },
          },
        };

        const metrics = {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          pid: process.pid,
        };

        const configuration = {
          litellm: {
            baseUrl: liteLLMService.getMetrics().config.baseUrl,
            enableMocking: liteLLMService.getMetrics().config.enableMocking,
            timeout: liteLLMService.getMetrics().config.timeout,
          },
          environment: process.env.NODE_ENV || 'development',
          logLevel: process.env.LOG_LEVEL || 'info',
        };

        return {
          services,
          metrics,
          configuration,
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to get detailed status');
        throw fastify.createError(500, 'Failed to get detailed status');
      }
    },
  });
};

export default healthRoutes;

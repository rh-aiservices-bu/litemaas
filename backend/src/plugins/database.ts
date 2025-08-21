import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { DatabaseRow, QueryParameter, QueryResult, DatabaseClient } from '../types/common.types.js';
import { LiteLLMIntegrationService } from '../services/litellm-integration.service';

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  let mockMode = false;

  try {
    await fastify.register(import('@fastify/postgres'), {
      connectionString: fastify.config.DATABASE_URL,
      ssl: fastify.config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: parseInt(fastify.config.DB_MAX_CONNECTIONS || '10'),
      idleTimeoutMillis: parseInt(fastify.config.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(fastify.config.DB_CONNECTION_TIMEOUT || '2000'),
    });

    // Test database connection and run migrations
    fastify.addHook('onReady', async () => {
      try {
        const client = await fastify.pg.connect();
        const result = await client.query('SELECT NOW() as current_time');
        fastify.log.info(
          { dbTime: result.rows[0].current_time },
          'Database connection established',
        );
        client.release();

        // Run database migrations
        try {
          const { applyMigrations } = await import('../lib/database-migrations');
          await applyMigrations(fastify.dbUtils);
          fastify.log.info('Database migrations applied successfully');
        } catch (migrationError) {
          fastify.log.error(migrationError as Error, 'Failed to apply database migrations');
          // Don't fail the startup, but log the error
        }

        // Sync models on startup
        try {
          const { ModelSyncService } = await import('../services/model-sync.service');
          const modelSyncService = new ModelSyncService(fastify);
          const syncResult = await modelSyncService.syncModels({
            forceUpdate: false,
            markUnavailable: true,
          });

          fastify.log.info({
            msg: 'Initial model sync completed',
            ...syncResult,
          });
        } catch (syncError) {
          fastify.log.error({ error: syncError }, 'Failed to sync models on startup');
          // Don't fail startup - continue with cached models
        }

        // Initialize LiteLLM integration service for auto-sync
        const litellmIntegrationService = new LiteLLMIntegrationService(fastify);

        // Start auto-sync if enabled
        const autoSyncEnabled = process.env.LITELLM_AUTO_SYNC === 'true';
        if (autoSyncEnabled) {
          fastify.log.info('Starting automatic model synchronization service');
          litellmIntegrationService.startAutoSync();

          // Register cleanup on server shutdown
          fastify.addHook('onClose', async () => {
            fastify.log.info('Stopping automatic model synchronization service');
            litellmIntegrationService.stopAutoSync();
          });
        }
      } catch (error) {
        fastify.log.warn(
          error as Error,
          'PostgreSQL not available, using mock data for development',
        );
        mockMode = true;
      }
    });
  } catch (error) {
    fastify.log.warn(
      error as Error,
      'Failed to register PostgreSQL plugin, using mock data for development',
    );
    mockMode = true;
  }

  // Health check function
  fastify.decorate('checkDatabaseHealth', async () => {
    if (mockMode) {
      return { status: 'mock', message: 'Using mock data for development' };
    }

    try {
      const client = await fastify.pg.connect();
      await client.query('SELECT 1');
      client.release();
      return { status: 'healthy' };
    } catch (error) {
      fastify.log.error(error as Error, 'Database health check failed');
      return { status: 'unhealthy', error: (error as Error).message };
    }
  });

  // Mock mode checker for services
  fastify.decorate('isDatabaseMockMode', () => {
    return mockMode;
  });

  // Mock data for development
  const mockUsers = [
    {
      id: 'mock-user-1',
      username: 'dev-user',
      email: 'dev@example.com',
      roles: ['user'],
      is_active: true,
    },
    {
      id: 'mock-admin-1',
      username: 'admin',
      email: 'admin@example.com',
      roles: ['admin'],
      is_active: true,
    },
  ];

  // Database utilities
  const dbUtils = {
    async withTransaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
      if (mockMode) {
        fastify.log.debug('Mock transaction executed');
        // In mock mode, just execute the callback with a mock client
        const mockClient: DatabaseClient = {
          query: async <TRow = DatabaseRow>(text: string, params?: QueryParameter[]) => {
            fastify.log.debug({ query: text, params }, 'Mock transaction query executed');
            return {
              rows: [],
              rowCount: 0,
              command: 'SELECT',
              oid: 0,
              fields: [],
            } as QueryResult<TRow>;
          },
          release: () => {
            fastify.log.debug('Mock client released');
          },
        };
        return await callback(mockClient);
      }

      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client as DatabaseClient);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          fastify.log.error(rollbackError as Error, 'Failed to rollback transaction');
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async query<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<QueryResult<T>> {
      if (mockMode) {
        fastify.log.debug({ query: text, params }, 'Mock query executed');

        // Handle common queries with mock data
        if (text.includes('SELECT roles FROM users')) {
          const userId = params?.[0];
          const user = mockUsers.find((u) => u.id === userId);
          return {
            rows: (user ? [{ roles: user.roles }] : []) as unknown as T[],
            rowCount: user ? 1 : 0,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as QueryResult<T>;
        }

        if (text.includes('SELECT') && text.includes('users')) {
          return {
            rows: mockUsers as unknown as T[],
            rowCount: mockUsers.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as QueryResult<T>;
        }

        return {
          rows: [],
          rowCount: 0,
          command: 'SELECT',
          oid: 0,
          fields: [],
        } as QueryResult<T>;
      }

      const client = await fastify.pg.connect();
      try {
        const result = await client.query(text, params);
        return result as QueryResult<T>;
      } finally {
        client.release();
      }
    },

    async queryOne<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<T | null> {
      const result = await dbUtils.query<T>(text, params);
      return result.rows[0] || null;
    },

    async queryMany<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<T[]> {
      const result = await dbUtils.query<T>(text, params);
      return result.rows;
    },
  };

  fastify.decorate('dbUtils', dbUtils);
};

declare module 'fastify' {
  interface FastifyInstance {
    checkDatabaseHealth: () => Promise<{ status: string; error?: string }>;
    isDatabaseMockMode: () => boolean;
    dbUtils: {
      withTransaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>;
      query<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<QueryResult<T>>;
      queryOne<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<T | null>;
      queryMany<T = DatabaseRow>(text: string, params?: QueryParameter[]): Promise<T[]>;
    };
  }
}

export default fastifyPlugin(databasePlugin);

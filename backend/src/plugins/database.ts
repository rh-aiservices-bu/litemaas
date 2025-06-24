import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import('@fastify/postgres'), {
    connectionString: fastify.config.DATABASE_URL,
    ssl: fastify.config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: parseInt(fastify.config.DB_MAX_CONNECTIONS),
    idleTimeoutMillis: parseInt(fastify.config.DB_IDLE_TIMEOUT),
    connectionTimeoutMillis: parseInt(fastify.config.DB_CONNECTION_TIMEOUT),
  });

  // Test database connection
  fastify.addHook('onReady', async () => {
    try {
      const client = await fastify.pg.connect();
      const result = await client.query('SELECT NOW() as current_time');
      fastify.log.info(
        { dbTime: result.rows[0].current_time },
        'Database connection established'
      );
      client.release();
    } catch (error) {
      fastify.log.error(error, 'Failed to connect to database');
      throw error;
    }
  });

  // Health check function
  fastify.decorate('checkDatabaseHealth', async () => {
    try {
      const client = await fastify.pg.connect();
      await client.query('SELECT 1');
      client.release();
      return { status: 'healthy' };
    } catch (error) {
      fastify.log.error(error, 'Database health check failed');
      return { status: 'unhealthy', error: error.message };
    }
  });

  // Database utilities
  fastify.decorate('dbUtils', {
    async withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async query(text: string, params?: any[]) {
      const client = await fastify.pg.connect();
      try {
        const result = await client.query(text, params);
        return result;
      } finally {
        client.release();
      }
    },

    async queryOne(text: string, params?: any[]) {
      const result = await this.query(text, params);
      return result.rows[0] || null;
    },

    async queryMany(text: string, params?: any[]) {
      const result = await this.query(text, params);
      return result.rows;
    },
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    checkDatabaseHealth: () => Promise<{ status: string; error?: string }>;
    dbUtils: {
      withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
      query(text: string, params?: any[]): Promise<any>;
      queryOne(text: string, params?: any[]): Promise<any>;
      queryMany(text: string, params?: any[]): Promise<any[]>;
    };
  }
}

export default fastifyPlugin(databasePlugin);
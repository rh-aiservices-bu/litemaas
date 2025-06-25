import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  let isPostgresAvailable = false;
  let mockMode = false;

  try {
    await fastify.register(import('@fastify/postgres'), {
      connectionString: fastify.config.DATABASE_URL,
      ssl: fastify.config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: parseInt(fastify.config.DB_MAX_CONNECTIONS || '10'),
      idleTimeoutMillis: parseInt(fastify.config.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(fastify.config.DB_CONNECTION_TIMEOUT || '2000'),
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
        isPostgresAvailable = true;
      } catch (error) {
        fastify.log.warn(error, 'PostgreSQL not available, using mock data for development');
        mockMode = true;
        isPostgresAvailable = false;
      }
    });
  } catch (error) {
    fastify.log.warn(error, 'Failed to register PostgreSQL plugin, using mock data for development');
    mockMode = true;
    isPostgresAvailable = false;
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
      fastify.log.error(error, 'Database health check failed');
      return { status: 'unhealthy', error: error.message };
    }
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
  fastify.decorate('dbUtils', {
    async withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
      if (mockMode) {
        // Simulate transaction in mock mode
        const mockClient = { query: () => Promise.resolve({ rows: [] }) };
        return callback(mockClient);
      }

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
      if (mockMode) {
        fastify.log.debug({ query: text, params }, 'Mock query executed');
        
        // Handle common queries with mock data
        if (text.includes('SELECT roles FROM users')) {
          const userId = params?.[0];
          const user = mockUsers.find(u => u.id === userId);
          return { rows: user ? [{ roles: user.roles }] : [] };
        }
        
        if (text.includes('SELECT') && text.includes('users')) {
          return { rows: mockUsers };
        }
        
        return { rows: [] };
      }

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
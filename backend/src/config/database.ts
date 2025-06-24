import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

export interface DatabaseConfig {
  connectionString: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

const databaseConfig: FastifyPluginAsync = async (fastify) => {
  const config: DatabaseConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/litemaas',
    ssl: process.env.NODE_ENV === 'production',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  };

  fastify.decorate('dbConfig', config);
};

export default fastifyPlugin(databaseConfig);
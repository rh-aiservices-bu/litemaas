export interface ServerConfig {
  host: string;
  port: number;
  logLevel: string;
  nodeEnv: string;
  corsOrigin: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  rateLimitMax: number;
  rateLimitTimeWindow: string;
}

export const serverConfig: ServerConfig = {
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '8080'),
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  rateLimitTimeWindow: process.env.RATE_LIMIT_TIME_WINDOW || '1m',
};
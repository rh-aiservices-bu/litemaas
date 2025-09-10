import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { Type } from '@sinclair/typebox';

const envSchema = Type.Object({
  // Server
  NODE_ENV: Type.String({ default: 'development' }),
  HOST: Type.String({ default: '0.0.0.0' }),
  PORT: Type.String({ default: '8081' }),
  LOG_LEVEL: Type.String({ default: 'info' }),

  // CORS
  CORS_ORIGIN: Type.String({ default: 'http://localhost:3000' }),

  // Database
  DATABASE_URL: Type.String(),
  DB_MAX_CONNECTIONS: Type.String({ default: '20' }),
  DB_IDLE_TIMEOUT: Type.String({ default: '30000' }),
  DB_CONNECTION_TIMEOUT: Type.String({ default: '5000' }),

  // JWT
  JWT_SECRET: Type.String(),
  JWT_EXPIRES_IN: Type.String({ default: '24h' }),

  // OAuth
  OAUTH_CLIENT_ID: Type.String(),
  OAUTH_CLIENT_SECRET: Type.String(),
  OAUTH_ISSUER: Type.String(),
  OAUTH_CALLBACK_URL: Type.String({ default: 'http://localhost:8081/api/auth/callback' }),

  // LiteLLM
  LITELLM_API_URL: Type.String({ default: 'http://localhost:4000' }),
  LITELLM_API_KEY: Type.Optional(Type.String()),
  LITELLM_TIMEOUT: Type.String({ default: '30000' }),
  LITELLM_RETRIES: Type.String({ default: '3' }),
  LITELLM_RETRY_DELAY: Type.String({ default: '1000' }),

  // Rate Limiting
  RATE_LIMIT_MAX: Type.String({ default: '100' }),
  RATE_LIMIT_TIME_WINDOW: Type.String({ default: '1m' }),

  // Default User Values
  DEFAULT_USER_MAX_BUDGET: Type.String({ default: '100' }),
  DEFAULT_USER_TPM_LIMIT: Type.String({ default: '100000' }),
  DEFAULT_USER_RPM_LIMIT: Type.String({ default: '120' }),
});

const envPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(import('@fastify/env'), {
    schema: envSchema,
    dotenv: true,
    data: process.env,
  });
};

export default fastifyPlugin(envPlugin);

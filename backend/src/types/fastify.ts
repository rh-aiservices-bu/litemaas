// Type declarations for Fastify config and extensions
declare module 'fastify' {
  interface FastifyInstance {
    config: {
      // Server
      NODE_ENV: string;
      HOST: string;
      PORT: string;
      LOG_LEVEL: string;

      // CORS
      CORS_ORIGIN: string;

      // Database
      DATABASE_URL: string;
      DB_MAX_CONNECTIONS: string;
      DB_IDLE_TIMEOUT: string;
      DB_CONNECTION_TIMEOUT: string;

      // JWT
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;

      // OAuth
      OAUTH_CLIENT_ID: string;
      OAUTH_CLIENT_SECRET: string;
      OAUTH_ISSUER: string;
      OAUTH_CALLBACK_URL: string;

      // LiteLLM
      LITELLM_API_URL: string;
      LITELLM_API_KEY?: string;
      LITELLM_TIMEOUT: string;
      LITELLM_RETRIES: string;
      LITELLM_RETRY_DELAY: string;

      // Rate Limiting
      RATE_LIMIT_MAX: string;
      RATE_LIMIT_TIME_WINDOW: string;

      // Default User Values
      DEFAULT_USER_MAX_BUDGET: string;
      DEFAULT_USER_TPM_LIMIT: string;
      DEFAULT_USER_RPM_LIMIT: string;
    };

    // Remove custom logger interface to avoid conflict with Fastify's built-in logger

    // Database utilities - remove to avoid conflict with database plugin
    // dbUtils is provided by the database plugin

    // Error creation - remove to avoid conflict with error handler plugin
    // createError is provided by the error handler plugin

    // LiteLLM Service
    liteLLMService: import('../services/litellm.service').LiteLLMService;
  }
}

// Export empty object to make this a module
export {};

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
    };

    // Logger interface
    log: {
      info: (obj?: Record<string, unknown> | string, msg?: string) => void;
      error: (obj?: Record<string, unknown> | string, msg?: string) => void;
      warn: (obj?: Record<string, unknown> | string, msg?: string) => void;
      debug: (obj?: Record<string, unknown> | string, msg?: string) => void;
      trace: (obj?: Record<string, unknown> | string, msg?: string) => void;
      fatal: (obj?: Record<string, unknown> | string, msg?: string) => void;
    };

    // Database utilities
    dbUtils: {
      query: (
        text: string,
        params?: (string | number | boolean | Date | null)[],
      ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
      queryOne: (
        text: string,
        params?: (string | number | boolean | Date | null)[],
      ) => Promise<Record<string, unknown> | null>;
      queryMany: (
        text: string,
        params?: (string | number | boolean | Date | null)[],
      ) => Promise<Record<string, unknown>[]>;
      withTransaction: <T>(callback: (client: Record<string, unknown>) => Promise<T>) => Promise<T>;
    };

    // Error creation
    createError: (statusCode: number, message: string) => Error;

    // LiteLLM Service
    liteLLMService: import('../services/litellm.service').LiteLLMService;
  }
}

// Export empty object to make this a module
export {};

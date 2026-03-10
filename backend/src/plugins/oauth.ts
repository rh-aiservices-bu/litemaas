import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { OAuthService } from '../services/oauth.service';

const oauthPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize OAuth service
  const oauthService = new OAuthService(fastify);

  // Register OAuth service
  fastify.decorate('oauth', oauthService);

  // Session store for OAuth state (in production, use Redis)
  if (process.env.NODE_ENV === 'production') {
    fastify.log.warn(
      'Using in-memory session store for OAuth state. This is not suitable for multi-pod deployments. Consider using Redis for session storage.',
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    fastify.config.CORS_ORIGIN &&
    fastify.config.CORS_ORIGIN.includes('localhost')
  ) {
    fastify.log.warn(
      { corsOrigin: fastify.config.CORS_ORIGIN },
      'CORS_ORIGIN contains "localhost" in production. This should be explicitly configured for your deployment domain.',
    );
  }

  const sessionStore = new Map<
    string,
    {
      state: string;
      timestamp: number;
      callbackUrl?: string;
      codeVerifier?: string;
      nonce?: string;
      frontendOrigin?: string;
    }
  >();

  // Clean up expired sessions every 5 minutes
  setInterval(
    () => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      for (const [key, session] of Array.from(sessionStore.entries())) {
        if (now - session.timestamp > fiveMinutes) {
          sessionStore.delete(key);
        }
      }
    },
    5 * 60 * 1000,
  );

  // OAuth helper methods
  fastify.decorate('oauthHelpers', {
    generateAndStoreState: (callbackUrl?: string, codeVerifier?: string): string => {
      const state = oauthService.generateState();
      sessionStore.set(state, { state, timestamp: Date.now(), callbackUrl, codeVerifier });
      return state;
    },

    storeNonce: (state: string, nonce: string): void => {
      const session = sessionStore.get(state);
      if (session) {
        session.nonce = nonce;
      }
    },

    storeCodeVerifier: (state: string, codeVerifier: string): void => {
      const session = sessionStore.get(state);
      if (session) {
        session.codeVerifier = codeVerifier;
      }
    },

    getStoredNonce: (state: string): string | undefined => {
      const session = sessionStore.get(state);
      return session?.nonce;
    },

    validateState: (state: string): boolean => {
      const session = sessionStore.get(state);
      if (!session) {
        return false;
      }

      // Don't delete yet - we need to retrieve the callback URL and code verifier
      // The state will be deleted after successful token exchange

      // Check if state is not expired (5 minutes)
      const fiveMinutes = 5 * 60 * 1000;
      return Date.now() - session.timestamp <= fiveMinutes;
    },

    getStoredCallbackUrl: (state: string): string | undefined => {
      const session = sessionStore.get(state);
      return session?.callbackUrl;
    },

    storeFrontendOrigin: (state: string, origin: string): void => {
      const session = sessionStore.get(state);
      if (session) {
        session.frontendOrigin = origin;
      }
    },

    getStoredFrontendOrigin: (state: string): string | undefined => {
      const session = sessionStore.get(state);
      return session?.frontendOrigin;
    },

    getStoredCodeVerifier: (state: string): string | undefined => {
      const session = sessionStore.get(state);
      return session?.codeVerifier;
    },

    clearState: (state: string): void => {
      sessionStore.delete(state);
    },

    clearExpiredStates: (): void => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      for (const [key, session] of Array.from(sessionStore.entries())) {
        if (now - session.timestamp > fiveMinutes) {
          sessionStore.delete(key);
        }
      }
    },
  });

  const authProvider = fastify.config.AUTH_PROVIDER || 'openshift';

  // Add OAuth configuration to fastify instance
  fastify.decorate('oauthConfig', {
    clientId: fastify.config.OAUTH_CLIENT_ID,
    issuer: fastify.config.OAUTH_ISSUER,
    callbackUrl: fastify.config.OAUTH_CALLBACK_URL,
    authProvider,
    isMockEnabled:
      process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development',
  });

  fastify.log.info(
    {
      oauthEnabled: true,
      authProvider: fastify.oauthConfig.authProvider,
      mockMode: fastify.oauthConfig.isMockEnabled,
      issuer: fastify.oauthConfig.issuer,
    },
    'OAuth plugin initialized',
  );

  // Pre-fetch OIDC discovery document on startup (non-blocking)
  if (authProvider === 'oidc' && !fastify.oauthConfig.isMockEnabled) {
    fastify.log.info('Pre-fetching OIDC discovery document');
    oauthService.getOIDCDiscoveryDocument().catch((error) => {
      fastify.log.warn(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to pre-fetch OIDC discovery document on startup — will retry on first auth request',
      );
    });
  }
};

declare module 'fastify' {
  interface FastifyInstance {
    oauth: OAuthService;
    oauthConfig: {
      clientId: string;
      issuer: string;
      callbackUrl: string;
      authProvider: string;
      isMockEnabled: boolean;
    };
    oauthHelpers: {
      generateAndStoreState(callbackUrl?: string, codeVerifier?: string): string;
      validateState(state: string): boolean;
      getStoredCallbackUrl(state: string): string | undefined;
      getStoredCodeVerifier(state: string): string | undefined;
      storeNonce(state: string, nonce: string): void;
      storeCodeVerifier(state: string, codeVerifier: string): void;
      getStoredNonce(state: string): string | undefined;
      storeFrontendOrigin(state: string, origin: string): void;
      getStoredFrontendOrigin(state: string): string | undefined;
      clearState(state: string): void;
      clearExpiredStates(): void;
    };
  }
}

export default fastifyPlugin(oauthPlugin);

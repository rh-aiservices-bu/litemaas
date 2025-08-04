import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { OAuthService } from '../services/oauth.service';

const oauthPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize OAuth service
  const oauthService = new OAuthService(fastify);

  // Register OAuth service
  fastify.decorate('oauth', oauthService);

  // Session store for OAuth state (in production, use Redis)
  const sessionStore = new Map<
    string,
    { state: string; timestamp: number; callbackUrl?: string }
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
    generateAndStoreState: (callbackUrl?: string): string => {
      const state = oauthService.generateState();
      sessionStore.set(state, { state, timestamp: Date.now(), callbackUrl });
      return state;
    },

    validateState: (state: string): boolean => {
      const session = sessionStore.get(state);
      if (!session) {
        return false;
      }

      // Don't delete yet - we need to retrieve the callback URL in getStoredCallbackUrl
      // The state will be deleted after successful token exchange

      // Check if state is not expired (5 minutes)
      const fiveMinutes = 5 * 60 * 1000;
      return Date.now() - session.timestamp <= fiveMinutes;
    },

    getStoredCallbackUrl: (state: string): string | undefined => {
      const session = sessionStore.get(state);
      return session?.callbackUrl;
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

  // Add OAuth configuration to fastify instance
  fastify.decorate('oauthConfig', {
    clientId: fastify.config.OAUTH_CLIENT_ID,
    issuer: fastify.config.OAUTH_ISSUER,
    callbackUrl: fastify.config.OAUTH_CALLBACK_URL,
    isMockEnabled:
      process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development',
  });

  fastify.log.info(
    {
      oauthEnabled: true,
      mockMode: fastify.oauthConfig.isMockEnabled,
      issuer: fastify.oauthConfig.issuer,
    },
    'OAuth plugin initialized',
  );
};

declare module 'fastify' {
  interface FastifyInstance {
    oauth: OAuthService;
    oauthConfig: {
      clientId: string;
      issuer: string;
      callbackUrl: string;
      isMockEnabled: boolean;
    };
    oauthHelpers: {
      generateAndStoreState(callbackUrl?: string): string;
      validateState(state: string): boolean;
      getStoredCallbackUrl(state: string): string | undefined;
      clearState(state: string): void;
      clearExpiredStates(): void;
    };
  }
}

export default fastifyPlugin(oauthPlugin);

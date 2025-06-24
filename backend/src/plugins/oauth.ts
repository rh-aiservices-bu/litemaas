import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { OAuthService } from '../services/oauth.service';

const oauthPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize OAuth service
  const oauthService = new OAuthService(fastify);
  
  // Register OAuth service
  fastify.decorate('oauth', oauthService);

  // Session store for OAuth state (in production, use Redis)
  const sessionStore = new Map<string, { state: string; timestamp: number }>();

  // Clean up expired sessions every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    for (const [key, session] of sessionStore.entries()) {
      if (now - session.timestamp > fiveMinutes) {
        sessionStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // OAuth helper methods
  fastify.decorate('oauthHelpers', {
    generateAndStoreState: (): string => {
      const state = oauthService.generateState();
      sessionStore.set(state, { state, timestamp: Date.now() });
      return state;
    },

    validateState: (state: string): boolean => {
      const session = sessionStore.get(state);
      if (!session) {
        return false;
      }
      
      // Remove used state
      sessionStore.delete(state);
      
      // Check if state is not expired (5 minutes)
      const fiveMinutes = 5 * 60 * 1000;
      return Date.now() - session.timestamp <= fiveMinutes;
    },

    clearExpiredStates: (): void => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      for (const [key, session] of sessionStore.entries()) {
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
    isMockEnabled: process.env.OAUTH_MOCK_ENABLED === 'true' || process.env.NODE_ENV === 'development',
  });

  fastify.log.info({
    oauthEnabled: true,
    mockMode: fastify.oauthConfig.isMockEnabled,
    issuer: fastify.oauthConfig.issuer,
  }, 'OAuth plugin initialized');
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
      generateAndStoreState(): string;
      validateState(state: string): boolean;
      clearExpiredStates(): void;
    };
  }
}

export default fastifyPlugin(oauthPlugin);
import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { SessionService } from '../services/session.service';

const sessionPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize session service
  const sessionService = new SessionService(fastify);
  
  // Register session service
  fastify.decorate('sessionService', sessionService);

  // Session management endpoints
  fastify.register(async function sessionRoutes(fastify) {
    // Get user sessions
    fastify.get('/sessions', {
      schema: {
        tags: ['Sessions'],
        description: 'Get user active sessions',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sessionId: { type: 'string' },
                ipAddress: { type: 'string' },
                userAgent: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                lastActivityAt: { type: 'string', format: 'date-time' },
                isCurrent: { type: 'boolean' },
              },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
      handler: async (request, reply) => {
        const user = (request as any).user;
        const sessions = await sessionService.getUserSessions(user.userId);
        return sessions;
      },
    });

    // Refresh session
    fastify.post('/refresh', {
      schema: {
        tags: ['Sessions'],
        description: 'Refresh access token',
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['refreshToken'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'number' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
      handler: async (request, reply) => {
        const { refreshToken, sessionId } = request.body as {
          refreshToken: string;
          sessionId?: string;
        };

        try {
          let result;

          if (sessionId) {
            // Session-based refresh
            result = await sessionService.refreshSession(sessionId, refreshToken);
          } else {
            // Token-based refresh (fallback)
            result = await fastify.refreshToken(refreshToken);
          }

          if (!result) {
            throw fastify.createAuthError('Invalid refresh token');
          }

          return result;
        } catch (error) {
          fastify.log.error(error, 'Token refresh failed');
          throw fastify.createAuthError('Token refresh failed');
        }
      },
    });

    // Invalidate session
    fastify.delete('/sessions/:sessionId', {
      schema: {
        tags: ['Sessions'],
        description: 'Invalidate specific session',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
          },
          required: ['sessionId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
      handler: async (request, reply) => {
        const { sessionId } = request.params as { sessionId: string };
        const user = (request as any).user;

        // Verify session belongs to user
        const session = await sessionService.validateSession(sessionId);
        
        if (!session || session.userId !== user.userId) {
          throw fastify.createNotFoundError('Session');
        }

        await sessionService.invalidateSession(sessionId);
        
        return { message: 'Session invalidated successfully' };
      },
    });

    // Invalidate all sessions (except current)
    fastify.delete('/sessions', {
      schema: {
        tags: ['Sessions'],
        description: 'Invalidate all user sessions except current',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              invalidatedSessions: { type: 'number' },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
      handler: async (request, reply) => {
        const user = (request as any).user;
        const currentSession = await sessionService.getSessionFromRequest(request);
        
        const count = await sessionService.invalidateAllUserSessions(
          user.userId,
          currentSession?.id
        );
        
        return { 
          message: 'Sessions invalidated successfully',
          invalidatedSessions: count,
        };
      },
    });
  }, { prefix: '/api/auth' });

  // Session middleware for tracking
  fastify.decorate('trackSession', async (request: any, reply: any) => {
    const user = request.user;
    
    if (!user) {
      return;
    }

    // Update session activity
    const session = await sessionService.getSessionFromRequest(request);
    
    if (session) {
      // Session is automatically updated in validateSession
      request.session = session;
    }
  });

  // Helper to create session on login
  fastify.decorate('createUserSession', async (
    user: {
      id: string;
      username: string;
      email: string;
      roles: string[];
    },
    ipAddress: string,
    userAgent: string
  ) => {
    return sessionService.createSession(user, ipAddress, userAgent);
  });

  fastify.log.info('Session management plugin initialized');
};

declare module 'fastify' {
  interface FastifyInstance {
    sessionService: SessionService;
    trackSession: (request: any, reply: any) => Promise<void>;
    createUserSession: (
      user: {
        id: string;
        username: string;
        email: string;
        roles: string[];
      },
      ipAddress: string,
      userAgent: string
    ) => Promise<{
      sessionId: string;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>;
  }

  interface FastifyRequest {
    session?: import('../services/session.service').UserSession;
  }
}

export default fastifyPlugin(sessionPlugin);
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createApp } from '../../src/app';

export interface TestAppOptions {
  strictAuth?: boolean;
  logger?: boolean;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<FastifyInstance> {
  const { strictAuth = false, logger = false } = options;

  // Set environment variables for test mode
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendOrigins = process.env.ALLOWED_FRONTEND_ORIGINS;

  if (strictAuth) {
    // Disable dev bypass for strict authentication testing
    process.env.NODE_ENV = 'test-strict';
    process.env.ALLOWED_FRONTEND_ORIGINS = '';
  } else {
    process.env.NODE_ENV = 'test';
  }

  try {
    const app = await createApp({ logger });

    if (strictAuth) {
      // Override the authenticateWithDevBypass function to force strict auth
      const originalAuthenticate = app.authenticate;
      (app as any).authenticateWithDevBypass = async (request: FastifyRequest, reply: FastifyReply) => {
        // Force strict authentication - no dev bypass
        return originalAuthenticate(request, reply);
      };
    }

    await app.ready();
    return app;
  } finally {
    // Restore original environment variables
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    if (originalFrontendOrigins !== undefined) {
      process.env.ALLOWED_FRONTEND_ORIGINS = originalFrontendOrigins;
    } else {
      delete process.env.ALLOWED_FRONTEND_ORIGINS;
    }
  }
}
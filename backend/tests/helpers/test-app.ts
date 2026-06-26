import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';

export interface TestAppOptions {
  logger?: boolean;
}

export async function createTestApp(options: TestAppOptions = {}): Promise<FastifyInstance> {
  const { logger = false } = options;

  const app = await createApp({ logger });
  await app.ready();
  return app;
}

import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import Redis from 'ioredis';

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redisHost = fastify.config.REDIS_HOST;
  const redisPort = parseInt(fastify.config.REDIS_PORT || '6379');

  if (!redisHost) {
    fastify.log.info('REDIS_HOST not set — Redis cache flush disabled');
    fastify.decorate('redis', null);
    fastify.decorate('flushLiteLLMCache', async () => {
      fastify.log.debug('flushLiteLLMCache called but Redis is not configured — skipping');
    });
    return;
  }

  let client: Redis | null = null;

  try {
    client = new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    await client.connect();
    fastify.log.info({ redisHost, redisPort }, 'Redis connection established');
  } catch (error) {
    fastify.log.warn(
      { error, redisHost, redisPort },
      'Failed to connect to Redis — cache flush will be unavailable',
    );
    client = null;
  }

  fastify.decorate('redis', client);

  fastify.decorate('flushLiteLLMCache', async () => {
    if (!client) {
      fastify.log.debug('flushLiteLLMCache called but Redis client is unavailable — skipping');
      return;
    }
    try {
      await client.flushall();
      fastify.log.info('LiteLLM Redis cache flushed after model operation');
    } catch (error) {
      fastify.log.warn({ error }, 'Failed to flush LiteLLM Redis cache — non-fatal');
    }
  });

  fastify.addHook('onClose', async () => {
    if (client) {
      fastify.log.info('Closing Redis connection');
      await client.quit();
    }
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis | null;
    flushLiteLLMCache: () => Promise<void>;
  }
}

export default fastifyPlugin(redisPlugin);

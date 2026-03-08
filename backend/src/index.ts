import createApp from './app';

let fastifyInstance: any;

const gracefulShutdown = async (signal: string) => {
  if (fastifyInstance) {
    fastifyInstance.log.info(`Received ${signal}, shutting down gracefully`);
    try {
      await fastifyInstance.close();
      process.exit(0);
    } catch (err) {
      fastifyInstance.log.error(err, 'Error during graceful shutdown');
      process.exit(1);
    }
  } else {
    console.log(`Received ${signal}, shutting down gracefully`);
    process.exit(0);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

const start = async () => {
  try {
    const fastify = await createApp();
    fastifyInstance = fastify;

    // Start server
    const host = fastify.config.HOST;
    const port = parseInt(fastify.config.PORT);

    await fastify.listen({ host, port });
    fastify.log.info(`Server listening on ${host}:${port}`);
    fastify.log.info(`API documentation available at http://${host}:${port}/docs`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();

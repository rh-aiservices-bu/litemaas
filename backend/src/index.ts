import createApp from './app';

const start = async () => {
  try {
    const fastify = await createApp();

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

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully`);
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

start();

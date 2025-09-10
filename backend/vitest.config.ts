import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Limit concurrency to prevent database deadlocks
    maxConcurrency: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
      },
    },
    // Increase timeout for slower single-threaded execution
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['default'],
      exclude: ['node_modules/', 'dist/', 'coverage/', '**/*.d.ts', '**/*.config.ts', 'src/types/'],
    },
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-for-vitest-testing',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/litemaas_test',
      OAUTH_CLIENT_ID: 'test-client-id',
      OAUTH_CLIENT_SECRET: 'test-client-secret',
      OAUTH_ISSUER: 'http://localhost:8081',
    },
  },
});

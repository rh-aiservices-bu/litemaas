import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
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
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.ts',
        'src/examples',
        'src/lib/database-migrations.ts',
        'src/scripts',
        'src/types/',
      ],
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

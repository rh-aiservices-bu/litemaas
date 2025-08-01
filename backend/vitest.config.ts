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
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', 'coverage/', '**/*.d.ts', '**/*.config.ts', 'src/types/'],
    },
  },
});

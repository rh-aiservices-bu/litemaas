import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Cache configuration moved to root level
  cacheDir: 'node_modules/.vitest',
  ssr: {
    noExternal: ['@patternfly/react-icons'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],

    // Enhanced environment configuration for better async and AbortSignal support
    env: {
      NODE_ENV: 'test',
      VITE_APP_NAME: 'LiteMaaS Test',
      VITE_MOCK_AUTH: 'true',
    },

    // Performance and stability settings with better async operation handling
    testTimeout: 15000, // 15 seconds for individual tests (increased for async operations)
    hookTimeout: 10000, // 10 seconds for hooks
    teardownTimeout: 5000, // 5 seconds for cleanup

    // Improved error reporting
    reporters: ['default'],
    outputFile: {
      junit: './coverage/junit-report.xml',
    },

    // Better test isolation and stability
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4, // Limit concurrent tests for stability
        minThreads: 1,
      },
    },

    // Retry flaky tests
    retry: 1,

    server: {
      deps: {
        // Use server.deps.inline instead of deps.inline
        inline: [
          // Inline problematic dependencies for better stability
          '@testing-library/react',
          '@testing-library/user-event',
          'react-query',
          // Handle PatternFly icons ESM module resolution issues
          '@patternfly/react-icons',
        ],
      },
    },
    deps: {
      moduleDirectories: ['node_modules', './src/test/__mocks__'],
      // Use optimizer instead of inline at this level
      optimizer: {
        web: {
          include: ['@testing-library/react', '@testing-library/user-event', 'react-query'],
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['default'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.ts',
        'src/types/',
        'src/vite-env.d.ts',
        'src/test/',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    // Optimize memory usage
    logHeapUsage: true,

    // Add module name mapper for asset handling
    alias: {
      // Handle image imports
      '\\.(jpg|jpeg|png|gif|webp|avif)$': path.resolve(__dirname, 'src/test/__mocks__/assets.ts'),
      // Handle SVG imports
      '\\.svg$': path.resolve(__dirname, 'src/test/__mocks__/assets.ts'),
      // Handle style imports
      '\\.(css|scss|sass|less)$': path.resolve(__dirname, 'src/test/__mocks__/assets.ts'),
      // PatternFly ESM CSS deep imports (avoid unknown .css extension errors)
      '@patternfly/react-styles/css/(.*)': path.resolve(__dirname, 'src/test/__mocks__/assets.ts'),
      // Handle font imports
      '\\.(woff|woff2|eot|ttf|otf)$': path.resolve(__dirname, 'src/test/__mocks__/assets.ts'),
      // Handle other binary assets
      '\\.(pdf|zip|mp3|mp4|webm)$': path.resolve(__dirname, 'src/test/__mocks__/assets.ts'),
      // Handle React DOM client imports
      'react-dom/client': path.resolve(__dirname, 'src/test/__mocks__/react-dom/client.ts'),
    },

    // Watch mode optimization
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.git/**',
      '**/.vscode/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.json'],
    alias: {
      '@': '/src',
      // Ensure deep CSS imports from PatternFly map to asset mock too
      '@patternfly/react-styles/css/(.*)': path.resolve(__dirname, 'src/test/__mocks__/assets.ts'),
    },
  },
});

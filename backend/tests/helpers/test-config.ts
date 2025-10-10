// backend/tests/helpers/test-config.ts

import {
  resetAdminAnalyticsConfig,
  initAdminAnalyticsConfig,
} from '../../src/config/admin-analytics.config.js';

/**
 * Initialize test configuration with custom values
 *
 * @param overrides - Environment variable overrides for testing
 * @returns Configuration object and cleanup function
 */
export function initTestConfig(overrides: Record<string, string> = {}) {
  // Reset existing config
  resetAdminAnalyticsConfig();

  // Set environment variables
  const originalEnv = { ...process.env };

  Object.entries(overrides).forEach(([key, value]) => {
    process.env[key] = value;
  });

  // Initialize with test values
  const config = initAdminAnalyticsConfig();

  // Return cleanup function
  return {
    config,
    cleanup: () => {
      process.env = originalEnv;
      resetAdminAnalyticsConfig();
    },
  };
}

/**
 * Reset configuration to defaults for testing
 */
export function resetTestConfig() {
  resetAdminAnalyticsConfig();
  // Re-initialize with defaults
  return initAdminAnalyticsConfig();
}

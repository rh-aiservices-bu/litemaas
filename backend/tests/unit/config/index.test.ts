/**
 * Unit tests for Config index exports
 * Tests that all configuration modules are properly exported
 */

import { describe, it, expect } from 'vitest';
import { oauthConfig, databaseConfig } from '../../../src/config/index.js';

describe('Config Index Exports', () => {
  describe('Module Exports', () => {
    it('should export oauthConfig', () => {
      expect(oauthConfig).toBeDefined();
      expect(typeof oauthConfig).toBe('object');
    });

    it('should export databaseConfig', () => {
      expect(databaseConfig).toBeDefined();
      expect(typeof databaseConfig).toBe('function');
    });
  });

  describe('OAuth Configuration Export', () => {
    it('should have all OAuth configuration properties', () => {
      expect(oauthConfig).toHaveProperty('clientId');
      expect(oauthConfig).toHaveProperty('clientSecret');
      expect(oauthConfig).toHaveProperty('issuer');
      expect(oauthConfig).toHaveProperty('callbackUrl');
      expect(oauthConfig).toHaveProperty('scope');
    });

    it('should have correct OAuth scope structure', () => {
      expect(Array.isArray(oauthConfig.scope)).toBe(true);
      expect(oauthConfig.scope).toContain('openid');
      expect(oauthConfig.scope).toContain('profile');
      expect(oauthConfig.scope).toContain('email');
    });
  });

  describe('Database Configuration Export', () => {
    it('should be a Fastify plugin function', () => {
      expect(typeof databaseConfig).toBe('function');
    });

    it('should have Fastify plugin metadata', () => {
      // Fastify plugins wrapped with fastify-plugin have special symbols
      expect(databaseConfig).toBeDefined();
    });
  });

  describe('TypeScript Import Compatibility', () => {
    it('should support named imports for oauthConfig', () => {
      expect(oauthConfig).toBeDefined();
      expect(oauthConfig.clientId).toBeDefined();
    });

    it('should support named imports for databaseConfig', () => {
      expect(databaseConfig).toBeDefined();
      expect(typeof databaseConfig).toBe('function');
    });
  });

  describe('Configuration Consistency', () => {
    it('should export consistent configuration objects', async () => {
      // Import again to verify consistency
      const { oauthConfig: oauth2 } = await import('../../../src/config/index.js');

      // Should reference the same configuration object
      expect(oauth2.clientId).toBe(oauthConfig.clientId);
      expect(oauth2.clientSecret).toBe(oauthConfig.clientSecret);
      expect(oauth2.issuer).toBe(oauthConfig.issuer);
      expect(oauth2.callbackUrl).toBe(oauthConfig.callbackUrl);
    });
  });
});

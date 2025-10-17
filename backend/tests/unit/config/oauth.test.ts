/**
 * Unit tests for OAuth configuration
 * Tests environment variable loading and OAuth configuration setup
 */

import { describe, it, expect } from 'vitest';
import { oauthConfig } from '../../../src/config/oauth.js';

describe('OAuth Configuration', () => {
  describe('Configuration Structure', () => {
    it('should export oauthConfig object', () => {
      expect(oauthConfig).toBeDefined();
      expect(typeof oauthConfig).toBe('object');
    });

    it('should have clientId property', () => {
      expect(oauthConfig).toHaveProperty('clientId');
      expect(typeof oauthConfig.clientId).toBe('string');
    });

    it('should have clientSecret property', () => {
      expect(oauthConfig).toHaveProperty('clientSecret');
      expect(typeof oauthConfig.clientSecret).toBe('string');
    });

    it('should have issuer property', () => {
      expect(oauthConfig).toHaveProperty('issuer');
      expect(typeof oauthConfig.issuer).toBe('string');
    });

    it('should have callbackUrl property', () => {
      expect(oauthConfig).toHaveProperty('callbackUrl');
      expect(typeof oauthConfig.callbackUrl).toBe('string');
    });

    it('should have scope property as array', () => {
      expect(oauthConfig).toHaveProperty('scope');
      expect(Array.isArray(oauthConfig.scope)).toBe(true);
    });
  });

  describe('OAuth Scope Configuration', () => {
    it('should include openid scope', () => {
      expect(oauthConfig.scope).toContain('openid');
    });

    it('should include profile scope', () => {
      expect(oauthConfig.scope).toContain('profile');
    });

    it('should include email scope', () => {
      expect(oauthConfig.scope).toContain('email');
    });

    it('should have exactly 3 scopes', () => {
      expect(oauthConfig.scope).toHaveLength(3);
    });
  });

  describe('Callback URL Configuration', () => {
    it('should have a valid callback URL format', () => {
      // Should be either localhost or a full HTTPS URL
      const isLocalhostOrHttps =
        oauthConfig.callbackUrl.startsWith('http://localhost') ||
        oauthConfig.callbackUrl.startsWith('https://');

      expect(isLocalhostOrHttps).toBe(true);
    });

    it('should include callback path', () => {
      expect(oauthConfig.callbackUrl).toContain('/api/auth/callback');
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should have all string properties except scope', () => {
      expect(typeof oauthConfig.clientId).toBe('string');
      expect(typeof oauthConfig.clientSecret).toBe('string');
      expect(typeof oauthConfig.issuer).toBe('string');
      expect(typeof oauthConfig.callbackUrl).toBe('string');
    });

    it('should have scope as array of strings', () => {
      expect(Array.isArray(oauthConfig.scope)).toBe(true);
      expect(oauthConfig.scope.every((s) => typeof s === 'string')).toBe(true);
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all required OAuth configuration properties', () => {
      const requiredProps = ['clientId', 'clientSecret', 'issuer', 'callbackUrl', 'scope'];

      requiredProps.forEach((prop) => {
        expect(oauthConfig).toHaveProperty(prop);
      });
    });

    it('should not have unexpected properties', () => {
      const expectedKeys = ['clientId', 'clientSecret', 'issuer', 'callbackUrl', 'scope'];
      const actualKeys = Object.keys(oauthConfig);

      actualKeys.forEach((key) => {
        expect(expectedKeys).toContain(key);
      });
    });
  });
});

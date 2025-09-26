/**
 * Integration tests for Config Routes
 * Tests public configuration endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app';

describe('Config Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OAUTH_MOCK_ENABLED = 'true'; // Enable mock OAuth for testing
    process.env.ALLOWED_FRONTEND_ORIGINS = ''; // Disable frontend bypass

    app = await createApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/v1/config', () => {
    it('should return public configuration without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('usageCacheTtlMinutes');
      expect(result).toHaveProperty('environment');
    });

    it('should include version information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(typeof result.version).toBe('string');
      expect(result.version).toMatch(/^\d+\.\d+\.\d+/); // Semantic version format
    });

    it('should include cache TTL configuration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(typeof result.usageCacheTtlMinutes).toBe('number');
      expect(result.usageCacheTtlMinutes).toBeGreaterThan(0);
    });

    it('should include environment information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(['development', 'production']).toContain(result.environment);
    });

    it('should include auth mode', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('authMode');
      expect(['oauth', 'mock']).toContain(result.authMode);
    });

    it('should include LiteLLM API URL', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('litellmApiUrl');
      expect(typeof result.litellmApiUrl).toBe('string');
    });

    it('should not expose sensitive configuration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const bodyStr = response.body;

      // Should not contain sensitive values
      expect(bodyStr).not.toContain('JWT_SECRET');
      expect(bodyStr).not.toContain('DATABASE_URL');
      expect(bodyStr).not.toContain('OAUTH_CLIENT_SECRET');
      expect(bodyStr).not.toContain('password');
      expect(bodyStr).not.toContain('secret');
    });

    it('should return consistent configuration', async () => {
      const response1 = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const result1 = JSON.parse(response1.body);
      const result2 = JSON.parse(response2.body);

      // Configuration should be consistent across requests
      expect(result1.version).toBe(result2.version);
      expect(result1.environment).toBe(result2.environment);
      expect(result1.usageCacheTtlMinutes).toBe(result2.usageCacheTtlMinutes);
    });

    it('should set auth mode to mock in development', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);

      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        expect(result.authMode).toBe('mock');
      }
    });

    it('should respond quickly', async () => {
      const startTime = Date.now();

      await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      const duration = Date.now() - startTime;
      // Config endpoint should respond very quickly (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Configuration Privacy', () => {
    it('should only expose public configuration values', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);

      // Should only have expected public fields
      const allowedFields = [
        'version',
        'usageCacheTtlMinutes',
        'environment',
        'authMode',
        'litellmApiUrl',
      ];

      // Check that all fields in response are allowed
      Object.keys(result).forEach((key) => {
        expect(allowedFields).toContain(key);
      });
    });

    it('should not expose internal URLs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      expect(response.statusCode).toBe(200);
      const bodyStr = response.body;

      // LiteLLM URL is public, but internal URLs should not be exposed
      expect(bodyStr).not.toContain('localhost:5432');
      expect(bodyStr).not.toContain('redis://');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config',
      });

      // Should always succeed as config is static
      expect(response.statusCode).toBe(200);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/config?invalid=param',
      });

      // Should ignore invalid query params
      expect(response.statusCode).toBe(200);
    });
  });
});

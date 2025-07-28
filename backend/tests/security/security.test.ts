import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';

describe('Security Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = global.testApp;
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authentication', async () => {
      const endpoints = [
        '/api/v1/models',
        '/api/v1/subscriptions',
        '/api/v1/api-keys',
        '/api/v1/usage',
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: 'GET',
          url: endpoint,
        });

        expect(response.statusCode).toBe(401);
        expect(response.json().message).toContain('authorization');
      }
    });

    it('should reject requests with invalid tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with expired tokens', async () => {
      const expiredToken = generateExpiredToken();
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should prevent access to other users resources', async () => {
      const user1Token = generateTestToken({ id: 'user-1' });
      const user2Token = generateTestToken({ id: 'user-2' });

      // Create a resource with user1
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: { authorization: `Bearer ${user1Token}` },
        payload: {
          name: 'Test Key',
          permissions: ['models:read'],
          rateLimit: 1000,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const apiKey = createResponse.json();

      // Try to access with user2
      const accessResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${apiKey.id}`,
        headers: { authorization: `Bearer ${user2Token}` },
      });

      expect(accessResponse.statusCode).toBe(404); // Should not find resource
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should validate request body schemas', async () => {
      const token = generateTestToken({ id: 'test-user' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          // Missing required 'name' field
          permissions: ['models:read'],
          rateLimit: 'invalid-number', // Invalid type
        },
      });

      expect(response.statusCode).toBe(400);
      const error = response.json();
      expect(error.message).toContain('validation');
    });

    it('should sanitize SQL injection attempts', async () => {
      const token = generateTestToken({ id: 'test-user' });

      const maliciousPayload = {
        name: "Test'; DROP TABLE api_keys; --",
        permissions: ['models:read'],
        rateLimit: 1000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: { authorization: `Bearer ${token}` },
        payload: maliciousPayload,
      });

      // Should either reject or sanitize the input
      if (response.statusCode === 201) {
        const result = response.json();
        expect(result.name).not.toContain('DROP TABLE');
      } else {
        expect(response.statusCode).toBe(400);
      }
    });

    it('should prevent XSS in user inputs', async () => {
      const token = generateTestToken({ id: 'test-user' });

      const xssPayload = {
        name: '<script>alert("XSS")</script>',
        description: '<img src=x onerror=alert("XSS")>',
        permissions: ['models:read'],
        rateLimit: 1000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: { authorization: `Bearer ${token}` },
        payload: xssPayload,
      });

      if (response.statusCode === 201) {
        const result = response.json();
        expect(result.name).not.toContain('<script>');
        expect(result.description).not.toContain('<img');
      }
    });

    it('should validate file upload limits', async () => {
      const token = generateTestToken({ id: 'test-user' });
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: largePayload },
      });

      expect(response.statusCode).toBe(413); // Payload too large
    });

    it('should validate subscription payload schemas', async () => {
      const token = generateTestToken({ id: 'test-user' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          // Missing required 'modelId' field
          quotaRequests: 'invalid-number', // Invalid type
          quotaTokens: -1000, // Invalid negative value
        },
      });

      expect(response.statusCode).toBe(400);
      const error = response.json();
      expect(error.message).toContain('validation');
    });

    it('should sanitize subscription inputs', async () => {
      const token = generateTestToken({ id: 'test-user' });

      const maliciousPayload = {
        modelId: "<script>alert('XSS')</script>",
        quotaRequests: 10000,
        quotaTokens: 1000000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: { authorization: `Bearer ${token}` },
        payload: maliciousPayload,
      });

      // Should either reject malicious input or sanitize it
      if (response.statusCode === 201) {
        const result = response.json();
        expect(result.modelId).not.toContain('<script>');
      } else {
        expect(response.statusCode).toBe(400);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per user', async () => {
      const token = generateTestToken({ id: 'test-user' });

      // Make multiple rapid requests
      const promises = Array.from({ length: 15 }, () =>
        app.inject({
          method: 'GET',
          url: '/api/v1/models',
          headers: { authorization: `Bearer ${token}` },
        }),
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should enforce global rate limits', async () => {
      const tokens = Array.from({ length: 5 }, (_, i) => generateTestToken({ id: `user-${i}` }));

      // Make many concurrent requests from different users
      const promises = tokens.flatMap((token) =>
        Array.from({ length: 10 }, () =>
          app.inject({
            method: 'GET',
            url: '/api/v1/models',
            headers: { authorization: `Bearer ${token}` },
          }),
        ),
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should include CORS headers correctly', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/models',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('API Key Security', () => {
    it('should hash API keys in storage', async () => {
      const token = generateTestToken({ id: 'test-user' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Test Key',
          permissions: ['models:read'],
          rateLimit: 1000,
        },
      });

      expect(response.statusCode).toBe(201);
      const result = response.json();

      // The response should not contain the full key
      expect(result.keyPreview).toMatch(/^sk-\.\.\..+$/);
      expect(result).not.toHaveProperty('fullKey');
    });

    it('should validate API key permissions', async () => {
      const token = generateTestToken({ id: 'test-user' });

      // Create API key with limited permissions
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Limited Key',
          permissions: ['models:read'], // Only read models
          rateLimit: 1000,
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const apiKey = createResponse.json();

      // Try to use the key for unauthorized action
      const unauthorizedResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: { authorization: `Bearer ${apiKey.fullKey}` },
        payload: {
          modelId: 'gpt-4',
          quotaRequests: 10000,
          quotaTokens: 1000000,
        },
      });

      expect(unauthorizedResponse.statusCode).toBe(403); // Forbidden
    });
  });

  describe('Data Exposure', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/nonexistent',
      });

      const error = response.json();
      expect(error.message).not.toContain('database');
      expect(error.message).not.toContain('password');
      expect(error.message).not.toContain('secret');
    });

    it('should not expose internal stack traces in production', async () => {
      // Simulate an internal error
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/completions',
        headers: { authorization: `Bearer ${generateTestToken({ id: 'test-user' })}` },
        payload: {
          /* invalid payload to trigger error */
        },
      });

      const error = response.json();
      expect(error).not.toHaveProperty('stack');
      expect(error.message).not.toContain('/src/');
    });
  });

  // Helper functions
  interface TestUser {
    id: string;
    username?: string;
    email?: string;
    roles?: string[];
  }

  function generateTestToken(user: TestUser): string {
    // Create a mock JWT token for testing
    // In a real implementation, this would use the same JWT signing key as the app
    const payload = {
      userId: user.id,
      username: user.username || `user-${user.id}`,
      email: user.email || `${user.id}@test.com`,
      roles: user.roles || ['user'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    // For testing purposes, return a predictable token format
    // The test setup should recognize this pattern
    return `test-token-${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }

  function generateExpiredToken(): string {
    // Create a mock JWT token that's already expired
    const payload = {
      userId: 'expired-user',
      username: 'expired-user',
      email: 'expired@test.com',
      roles: ['user'],
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
    };

    // Return an expired token format
    return `expired-token-${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }
});

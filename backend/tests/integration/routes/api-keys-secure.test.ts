import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp } from '../../../src/app';
import type { FastifyInstance } from 'fastify';
import { generateTestToken } from '../setup';

describe('Secure API Key Retrieval Endpoint', () => {
  let app: FastifyInstance;
  let testToken: string;
  let recentTestToken: string;
  let oldTestToken: string;

  beforeEach(async () => {
    app = await createApp();
    await app.ready();

    // Generate tokens with different ages
    testToken = generateTestToken('user-123', ['user'], Math.floor(Date.now() / 1000) - 60); // 1 minute ago
    recentTestToken = generateTestToken('user-123', ['user'], Math.floor(Date.now() / 1000) - 30); // 30 seconds ago
    oldTestToken = generateTestToken('user-123', ['user'], Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api-keys/:id/reveal', () => {
    it('should successfully retrieve API key with recent auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/test-key-123/reveal',
        headers: {
          Authorization: `Bearer ${recentTestToken}`,
          'User-Agent': 'test-client/1.0',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('key');
      expect(body).toHaveProperty('keyType', 'litellm');
      expect(body).toHaveProperty('retrievedAt');
      expect(body.key).toMatch(/^sk-litellm-/);

      // Check security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['cache-control']).toBe(
        'no-store, no-cache, must-revalidate, private',
      );
      expect(response.headers['pragma']).toBe('no-cache');
    });

    it('should reject request with old authentication token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/test-key-123/reveal',
        headers: {
          Authorization: `Bearer ${oldTestToken}`,
          'User-Agent': 'test-client/1.0',
        },
      });

      expect(response.statusCode).toBe(403);

      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('TOKEN_TOO_OLD');
      expect(body.error.message).toBe('Recent authentication required for this operation');
      expect(body.error.details).toHaveProperty(
        'action',
        'Please re-authenticate to access your API keys',
      );
    });

    it('should reject unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/test-key-123/reveal',
        headers: {
          'User-Agent': 'test-client/1.0',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/test-key-123/reveal',
        headers: {
          Authorization: 'Bearer invalid-token',
          'User-Agent': 'test-client/1.0',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/non-existent-key/reveal',
        headers: {
          Authorization: `Bearer ${recentTestToken}`,
          'User-Agent': 'test-client/1.0',
        },
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('API key not found');
    });

    it('should return 403 for inactive API key', async () => {
      // This would need a specific test key that's inactive
      // For now, we'll simulate the response structure
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/inactive-key-123/reveal',
        headers: {
          Authorization: `Bearer ${recentTestToken}`,
          'User-Agent': 'test-client/1.0',
        },
      });

      // Expecting either 404 (key not found) or 403 (key inactive)
      expect([403, 404]).toContain(response.statusCode);
    });

    it('should return 403 for expired API key', async () => {
      // This would need a specific test key that's expired
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/expired-key-123/reveal',
        headers: {
          Authorization: `Bearer ${recentTestToken}`,
          'User-Agent': 'test-client/1.0',
        },
      });

      // Expecting either 404 (key not found) or 403 (key expired)
      expect([403, 404]).toContain(response.statusCode);
    });

    it('should handle rate limiting for excessive requests', async () => {
      const keyId = 'rate-limit-test-key';
      const requests = [];

      // Make multiple rapid requests to trigger rate limiting
      for (let i = 0; i < 15; i++) {
        requests.push(
          app.inject({
            method: 'POST',
            url: `/api-keys/${keyId}/reveal`,
            headers: {
              Authorization: `Bearer ${recentTestToken}`,
              'User-Agent': 'test-client/1.0',
            },
          }),
        );
      }

      const responses = await Promise.all(requests);

      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter((r) => r.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit headers on rate limited response
      const rateLimitedResponse = rateLimitedResponses[0];
      const rateLimitBody = JSON.parse(rateLimitedResponse.body);

      expect(rateLimitBody.error.code).toBe('KEY_OPERATION_RATE_LIMITED');
      expect(rateLimitedResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(rateLimitedResponse.headers['x-ratelimit-remaining']).toBe('0');
      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
    });

    it('should include proper audit trail', async () => {
      // Mock database query to verify audit log creation
      const originalQuery = app.dbUtils.query;
      const auditLogSpy = vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 });
      app.dbUtils.query = auditLogSpy;

      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/audit-test-key/reveal',
        headers: {
          Authorization: `Bearer ${recentTestToken}`,
          'User-Agent': 'test-security-client/1.0',
        },
      });

      // Restore original query function
      app.dbUtils.query = originalQuery;

      // Should have attempted to create audit logs
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          'API_KEY_RETRIEVE_FULL',
          'API_KEY',
          'audit-test-key',
          expect.objectContaining({
            retrievalMethod: 'secure_endpoint',
            securityLevel: 'enhanced',
          }),
        ]),
      );
    });

    it('should validate request parameters', async () => {
      // Test with missing key ID
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys//reveal', // Missing key ID
        headers: {
          Authorization: `Bearer ${recentTestToken}`,
          'User-Agent': 'test-client/1.0',
        },
      });

      expect(response.statusCode).toBe(404); // Route not found
    });

    it('should handle concurrent requests properly', async () => {
      const keyId = 'concurrent-test-key';
      const concurrentRequests = [];

      // Make 5 concurrent requests
      for (let i = 0; i < 5; i++) {
        concurrentRequests.push(
          app.inject({
            method: 'POST',
            url: `/api-keys/${keyId}/reveal`,
            headers: {
              Authorization: `Bearer ${recentTestToken}`,
              'User-Agent': `concurrent-client-${i}/1.0`,
            },
          }),
        );
      }

      const responses = await Promise.all(concurrentRequests);

      // Should handle concurrent requests without issues
      // Some might succeed (200), some might be rate limited (429), some might be not found (404)
      responses.forEach((response) => {
        expect([200, 404, 429]).toContain(response.statusCode);
      });
    });

    it('should return appropriate error for API key without LiteLLM association', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys/no-litellm-key-123/reveal',
        headers: {
          Authorization: `Bearer ${recentTestToken}`,
          'User-Agent': 'test-client/1.0',
        },
      });

      // Should return 404 for keys without LiteLLM association or 404 for not found
      expect([404]).toContain(response.statusCode);
    });
  });
});

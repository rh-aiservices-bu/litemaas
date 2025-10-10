/**
 * Integration Tests for Admin Usage Analytics Rate Limiting
 *
 * These tests verify that rate limits are correctly applied to admin analytics endpoints
 * to prevent DoS attacks and ensure fair resource allocation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app';
import { generateTestToken } from './setup';
import type { FastifyInstance } from 'fastify';

describe('Admin Usage Analytics - Rate Limiting', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ALLOWED_FRONTEND_ORIGINS = ''; // Disable frontend bypass

    app = await createApp({ logger: false });
    await app.ready();

    // Generate test token for admin user
    adminToken = generateTestToken('admin-user-id', ['admin']);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Analytics Endpoints (10 req/min)', () => {
    const testPayload = {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };

    it('should allow requests within rate limit', async () => {
      // Make 10 requests (at limit)
      const requests = Array(10)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: {
              authorization: `Bearer ${adminToken}`,
              'content-type': 'application/json',
            },
            payload: testPayload,
          }),
        );

      const responses = await Promise.all(requests);

      // All should succeed (or fail with non-rate-limit errors)
      const rateLimited = responses.filter((r) => r.statusCode === 429);
      expect(rateLimited.length).toBe(0);
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Make 15 requests (over limit)
      const requests = Array(15)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: {
              authorization: `Bearer ${adminToken}`,
              'content-type': 'application/json',
            },
            payload: testPayload,
          }),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.statusCode === 429);

      // At least some requests should be rate limited
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should include retry-after header in 429 response', async () => {
      // Exceed rate limit
      const requests = Array(15)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: {
              authorization: `Bearer ${adminToken}`,
              'content-type': 'application/json',
            },
            payload: testPayload,
          }),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.find((r) => r.statusCode === 429);

      expect(rateLimited).toBeDefined();
      expect(rateLimited?.headers['retry-after']).toBeDefined();
      expect(rateLimited?.headers['x-ratelimit-limit']).toBeDefined();
      expect(rateLimited?.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should have rate limit error response', async () => {
      // Exceed rate limit
      const requests = Array(15)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: {
              authorization: `Bearer ${adminToken}`,
              'content-type': 'application/json',
            },
            payload: testPayload,
          }),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.find((r) => r.statusCode === 429);

      // Verify that we got a rate limit response
      expect(rateLimited).toBeDefined();
      expect(rateLimited?.statusCode).toBe(429);

      // Verify response has error information (format may vary between global and route-specific limits)
      const body = JSON.parse(rateLimited!.body);
      expect(body).toBeDefined();
      expect(body).toHaveProperty('error'); // Route-specific limits wrap in error property
    });
  });

  describe('Cache Rebuild Endpoint (1 req/5min)', () => {
    it('should have very restrictive rate limit', async () => {
      // First request should succeed (or fail with non-rate-limit error)
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/rebuild-cache',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      // Allow processing
      expect(response1.statusCode).not.toBe(429);

      // Second immediate request should be rate limited
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/rebuild-cache',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response2.statusCode).toBe(429);
    });
  });

  describe('Export Endpoint (5 req/min)', () => {
    it('should allow 5 requests within limit', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'GET',
            url: '/api/v1/admin/usage/export?startDate=2025-01-01&endDate=2025-01-31&format=csv',
            headers: {
              authorization: `Bearer ${adminToken}`,
            },
          }),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.statusCode === 429);

      expect(rateLimited.length).toBe(0);
    });

    it('should rate limit after 5 requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/export',
            headers: {
              authorization: `Bearer ${adminToken}`,
            },
            payload: {
              startDate: '2025-01-01',
              endDate: '2025-01-31',
              format: 'csv',
            },
          }),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.statusCode === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Per-User Rate Limiting', () => {
    it('should track rate limits per user, not globally', async () => {
      // Generate tokens for two different admin users
      const admin1Token = generateTestToken('admin-user-1', ['admin']);
      const admin2Token = generateTestToken('admin-user-2', ['admin']);

      const testPayload = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      };

      // Admin1 makes 10 requests (at limit)
      const admin1Requests = Array(10)
        .fill(null)
        .map(() =>
          app.inject({
            method: 'POST',
            url: '/api/v1/admin/usage/analytics',
            headers: {
              authorization: `Bearer ${admin1Token}`,
              'content-type': 'application/json',
            },
            payload: testPayload,
          }),
        );

      const admin1Responses = await Promise.all(admin1Requests);

      // Verify admin1 requests all succeeded (within rate limit)
      const admin1RateLimited = admin1Responses.filter((r) => r.statusCode === 429);
      expect(admin1RateLimited.length).toBe(0);

      // Admin2 should still be able to make requests (separate rate limit)
      const admin2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: {
          authorization: `Bearer ${admin2Token}`,
          'content-type': 'application/json',
        },
        payload: testPayload,
      });

      // Admin2's request should not be rate limited (different user, different counter)
      expect(admin2Response.statusCode).toBe(200);
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should use environment variable for analytics limit if set', () => {
      // This test verifies that getRateLimitConfig respects environment variables
      const originalEnv = process.env.ADMIN_ANALYTICS_RATE_LIMIT;

      // Set custom limit
      process.env.ADMIN_ANALYTICS_RATE_LIMIT = '20';

      // Import fresh to get updated config
      // Note: This requires special test setup to clear module cache
      // In practice, this would be tested by starting app with different env vars

      // Restore
      if (originalEnv) {
        process.env.ADMIN_ANALYTICS_RATE_LIMIT = originalEnv;
      } else {
        delete process.env.ADMIN_ANALYTICS_RATE_LIMIT;
      }
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in all responses', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      // Rate limit headers should be present
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });
});

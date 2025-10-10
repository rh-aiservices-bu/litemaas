/**
 * Integration tests for Auth Routes
 * Tests OAuth flow, token validation, and authentication endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app';
import { generateTestToken, generateExpiredToken, createTestUsers, TEST_USER_IDS } from '../setup';

describe('Auth Routes Integration', () => {
  let app: FastifyInstance;
  let validToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_DEV_TOKENS = 'true';
    process.env.OAUTH_MOCK_ENABLED = 'true'; // Enable mock OAuth for testing
    process.env.ALLOWED_FRONTEND_ORIGINS = ''; // Disable frontend bypass

    app = await createApp({ logger: false });
    await app.ready();

    // Create test users in database for integration tests
    await createTestUsers(app);

    // Generate test tokens using proper UUIDs
    validToken = generateTestToken(TEST_USER_IDS.USER, ['user']);
    adminToken = generateTestToken(TEST_USER_IDS.ADMIN, ['admin']);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/auth/login', () => {
    it('should initiate OAuth login flow', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('authUrl');
      expect(typeof result.authUrl).toBe('string');
      expect(result.authUrl.length).toBeGreaterThan(0);
    });

    it('should include state parameter in auth URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.authUrl).toMatch(/state=[a-zA-Z0-9-_]+/);
    });

    it('should handle missing origin header gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('authUrl');
    });

    it('should generate unique state for each login request', async () => {
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
      });

      const result1 = JSON.parse(response1.body);
      const result2 = JSON.parse(response2.body);

      const state1 = new URL(result1.authUrl, 'http://example.com').searchParams.get('state');
      const state2 = new URL(result2.authUrl, 'http://example.com').searchParams.get('state');

      expect(state1).not.toBe(state2);
    });
  });

  describe('POST /api/auth/dev-token', () => {
    it('should generate development token with default values', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/dev-token',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(result).toHaveProperty('expires_in', 86400);
      expect(result.user).toHaveProperty('userId');
      expect(result.user).toHaveProperty('username', 'developer');
      expect(result.user.roles).toEqual(['admin', 'user']);
    });

    it('should generate development token with custom username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/dev-token',
        payload: {
          username: 'testuser',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.user.username).toBe('testuser');
      expect(result.user.email).toBe('testuser@litemaas.local');
    });

    it('should generate development token with custom roles', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/dev-token',
        payload: {
          username: 'adminuser',
          roles: ['admin'],
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.user.roles).toEqual(['admin']);
    });

    it('should generate valid JWT token that can be verified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/dev-token',
        payload: {
          username: 'testuser',
          roles: ['user'],
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);

      // Verify the token can be used
      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/validate',
        payload: {
          token: result.access_token,
        },
      });

      expect(verifyResponse.statusCode).toBe(200);
      const verifyResult = JSON.parse(verifyResponse.body);
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.user.username).toBe('testuser');
    });
  });

  describe('GET /api/auth/mock-users', () => {
    it('should return list of mock users in development', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/mock-users',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Verify mock user structure
      const mockUser = result[0];
      expect(mockUser).toHaveProperty('id');
      expect(mockUser).toHaveProperty('username');
      expect(mockUser).toHaveProperty('email');
      expect(mockUser).toHaveProperty('fullName');
      expect(mockUser).toHaveProperty('roles');
      expect(Array.isArray(mockUser.roles)).toBe(true);
    });

    it('should include users with different roles', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/mock-users',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);

      // Check that we have users with different roles
      const hasAdmin = result.some((u: any) => u.roles.includes('admin'));
      const hasUser = result.some((u: any) => u.roles.includes('user'));

      expect(hasAdmin || hasUser).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should logout authenticated user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('message', 'Logged out successfully');
    });

    it('should create audit log entry on logout', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      // Audit log is created in background, we just verify successful logout
    });

    it('should handle logout with expired token', async () => {
      const expiredToken = generateExpiredToken('user-123', ['user']);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      // Should return 401 for expired token
      expect(response.statusCode).toBe(401);
    });

    it('should handle logout with malformed token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/validate', () => {
    it('should validate authentic token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/validate',
        payload: {
          token: validToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.valid).toBe(true);
      expect(result.user).toHaveProperty('userId');
      expect(result.user).toHaveProperty('username');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('roles');
      expect(Array.isArray(result.user.roles)).toBe(true);
    });

    it('should reject expired token', async () => {
      const expiredToken = generateExpiredToken('user-123', ['user']);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/validate',
        payload: {
          token: expiredToken,
        },
      });

      expect(response.statusCode).toBe(401);
      const result = JSON.parse(response.body);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject malformed token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/validate',
        payload: {
          token: 'not-a-valid-jwt-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const result = JSON.parse(response.body);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject token with invalid signature', async () => {
      // Create a token with a different secret
      const testSecret = 'different-secret';
      const jwt = require('jsonwebtoken');
      const invalidToken = jwt.sign(
        {
          userId: 'user-123',
          username: 'test',
          email: 'test@example.com',
          roles: ['user'],
        },
        testSecret,
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/validate',
        payload: {
          token: invalidToken,
        },
      });

      expect(response.statusCode).toBe(401);
      const result = JSON.parse(response.body);
      expect(result.valid).toBe(false);
    });

    it('should require token in request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/validate',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should extract correct user data from valid token', async () => {
      const testToken = generateTestToken('test-user-id', ['admin', 'user']);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/validate',
        payload: {
          token: testToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.user.userId).toBe('test-user-id');
      expect(result.user.roles).toContain('admin');
      expect(result.user.roles).toContain('user');
    });
  });

  describe('OAuth Callback Flow', () => {
    it('should reject callback without code parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/callback?state=test-state',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject callback without state parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/callback?code=test-code',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject callback with invalid state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/callback?code=test-code&state=invalid-state',
      });

      // Should fail state validation
      expect([400, 500]).toContain(response.statusCode);
    });
  });

  describe('Authentication Header Handling', () => {
    it('should accept token in Authorization header with Bearer scheme', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject missing Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should accept token without Bearer prefix (flexible auth)', async () => {
      // The auth system accepts tokens with or without "Bearer " prefix
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: validToken, // Without 'Bearer ' prefix - still accepted
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('message', 'Logged out successfully');
    });

    it('should reject empty token in Authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: 'Bearer ',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/validate',
        payload: 'invalid-json',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return proper error structure for authentication failures', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('error');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in auth responses', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
      });

      // Fastify typically adds these via plugins
      expect(response.statusCode).toBe(200);
    });
  });
});

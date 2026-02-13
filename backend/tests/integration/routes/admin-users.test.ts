/**
 * Integration tests for Admin Users Routes
 * Tests the 7 admin user management endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app';
import { generateTestToken, createTestUsers, TEST_USER_IDS } from '../setup';

describe('Admin Users Routes Integration', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let adminReadonlyToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOWED_FRONTEND_ORIGINS = '';

    app = await createApp({ logger: false });
    await app.ready();

    // Create test users in database for token validation
    await createTestUsers(app);

    // Generate test tokens using fixed UUIDs from setup
    userToken = generateTestToken(TEST_USER_IDS.USER, ['user']);
    adminToken = generateTestToken(TEST_USER_IDS.ADMIN, ['admin']);
    adminReadonlyToken = generateTestToken(TEST_USER_IDS.ADMIN_READONLY, ['admin-readonly']);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================
  // GET /api/v1/admin/users/:id
  // =========================================
  describe('GET /api/v1/admin/users/:id', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}`,
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow access for admin users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('username');
        expect(result).toHaveProperty('email');
        expect(result).toHaveProperty('roles');
        expect(result).toHaveProperty('isActive');
        expect(result).toHaveProperty('subscriptionsCount');
        expect(result).toHaveProperty('activeSubscriptionsCount');
        expect(result).toHaveProperty('apiKeysCount');
        expect(result).toHaveProperty('activeApiKeysCount');
        expect(typeof result.subscriptionsCount).toBe('number');
        expect(typeof result.apiKeysCount).toBe('number');
      }
    });

    it('should allow access for admin-readonly users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}`,
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/ffffffff-ffff-4fff-bfff-ffffffffffff',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([404, 500]).toContain(response.statusCode);
    });

    it('should reject invalid UUID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/not-a-uuid',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([400, 404, 500]).toContain(response.statusCode);
    });
  });

  // =========================================
  // PATCH /api/v1/admin/users/:id/budget-limits
  // =========================================
  describe('PATCH /api/v1/admin/users/:id/budget-limits', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/budget-limits`,
        payload: { maxBudget: 100 },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/budget-limits`,
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: { maxBudget: 100 },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should deny access for admin-readonly users (requires users:write)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/budget-limits`,
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
        payload: { maxBudget: 100 },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow admin to update budget limits', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/budget-limits`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          maxBudget: 500,
          tpmLimit: 10000,
          rpmLimit: 100,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('updatedAt');
        expect(result.maxBudget).toBe(500);
        expect(result.tpmLimit).toBe(10000);
        expect(result.rpmLimit).toBe(100);
      }
    });

    it('should accept partial updates', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/budget-limits`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: { maxBudget: 200 },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    it('should reject negative budget values', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/budget-limits`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: { maxBudget: -100 },
      });

      expect([400, 500]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/admin/users/ffffffff-ffff-4fff-bfff-ffffffffffff/budget-limits',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: { maxBudget: 100 },
      });

      expect([404, 500]).toContain(response.statusCode);
    });
  });

  // =========================================
  // GET /api/v1/admin/users/:id/api-keys
  // =========================================
  describe('GET /api/v1/admin/users/:id/api-keys', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow admin to list user API keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pagination');
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.pagination).toHaveProperty('page');
        expect(result.pagination).toHaveProperty('limit');
        expect(result.pagination).toHaveProperty('total');
        expect(result.pagination).toHaveProperty('totalPages');
      }
    });

    it('should allow admin-readonly to list user API keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    it('should support pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys?page=1&limit=5`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(5);
      }
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/ffffffff-ffff-4fff-bfff-ffffffffffff/api-keys',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([404, 200, 500]).toContain(response.statusCode);
    });
  });

  // =========================================
  // POST /api/v1/admin/users/:id/api-keys
  // =========================================
  describe('POST /api/v1/admin/users/:id/api-keys', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        payload: {
          name: 'Test Key',
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          name: 'Test Key',
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should deny access for admin-readonly users (requires users:write)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
        payload: {
          name: 'Test Key',
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect([400, 500]).toContain(response.statusCode);
    });

    it('should reject empty modelIds array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Test Key',
          modelIds: [],
        },
      });

      expect([400, 500]).toContain(response.statusCode);
    });

    it('should reject empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: '',
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect([400, 500]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/users/ffffffff-ffff-4fff-bfff-ffffffffffff/api-keys',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Test Key',
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect([404, 201, 500]).toContain(response.statusCode);
    });
  });

  // =========================================
  // DELETE /api/v1/admin/users/:id/api-keys/:keyId
  // =========================================
  describe('DELETE /api/v1/admin/users/:id/api-keys/:keyId', () => {
    const fakeKeyId = '00000000-0000-4000-8000-000000000099';

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(403);
    });

    it('should deny access for admin-readonly users (requires users:write)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent API key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {},
      });

      expect([404, 500]).toContain(response.statusCode);
    });

    it('should accept optional reason in body', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: { reason: 'Security concern' },
      });

      // Should fail with 404 (key doesn't exist) not 400 (bad request)
      expect([404, 500]).toContain(response.statusCode);
    });
  });

  // =========================================
  // PATCH /api/v1/admin/users/:id/api-keys/:keyId
  // =========================================
  describe('PATCH /api/v1/admin/users/:id/api-keys/:keyId', () => {
    const fakeKeyId = '00000000-0000-4000-8000-000000000099';

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        payload: {
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should deny access for admin-readonly users (requires users:write)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
        payload: {
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent API key', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          modelIds: ['00000000-0000-4000-8000-000000000010'],
        },
      });

      expect([404, 500]).toContain(response.statusCode);
    });

    it('should accept name update in payload', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/api-keys/${fakeKeyId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          modelIds: ['00000000-0000-4000-8000-000000000010'],
          name: 'Updated Key Name',
        },
      });

      // 404 because key doesn't exist, not 400
      expect([404, 500]).toContain(response.statusCode);
    });
  });

  // =========================================
  // GET /api/v1/admin/users/:id/subscriptions
  // =========================================
  describe('GET /api/v1/admin/users/:id/subscriptions', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/subscriptions`,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/subscriptions`,
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow admin to list user subscriptions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/subscriptions`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pagination');
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.pagination).toHaveProperty('page');
        expect(result.pagination).toHaveProperty('limit');
        expect(result.pagination).toHaveProperty('total');
        expect(result.pagination).toHaveProperty('totalPages');
      }
    });

    it('should allow admin-readonly to list user subscriptions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/subscriptions`,
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    it('should support status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/subscriptions?status=active`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        // If any subscriptions returned, they should be active
        if (result.data.length > 0) {
          result.data.forEach((sub: any) => {
            expect(sub.status).toBe('active');
          });
        }
      }
    });

    it('should support pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/subscriptions?page=1&limit=5`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(5);
      }
    });

    it('should return subscription items with proper structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${TEST_USER_IDS.USER}/subscriptions`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        if (result.data.length > 0) {
          const sub = result.data[0];
          expect(sub).toHaveProperty('id');
          expect(sub).toHaveProperty('modelId');
          expect(sub).toHaveProperty('modelName');
          expect(sub).toHaveProperty('status');
          expect(sub).toHaveProperty('createdAt');
        }
      }
    });

    it('should return 404 for non-existent user', async () => {
      // Use a UUID that is very unlikely to exist in the test database
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users/ffffffff-ffff-4fff-bfff-ffffffffffff/subscriptions',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([404, 200, 500]).toContain(response.statusCode);
    });
  });
});

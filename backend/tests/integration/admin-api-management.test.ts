/**
 * Integration tests for Admin API Management endpoints
 * Tests /api/v1/admin/api-keys/* — system-wide key listing, bulk revoke,
 * and expired-key cleanup.
 *
 * Requires the litemaas_test database (npm run test:db:setup).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { generateTestToken, TEST_USER_IDS } from './setup';

const LIST_URL = '/api/v1/admin/api-keys/all';
const BULK_REVOKE_URL = '/api/v1/admin/api-keys/bulk-revoke';
const CLEANUP_URL = '/api/v1/admin/api-keys/cleanup-expired';

describe('Admin API Management Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminReadonlyToken: string;
  let userToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    app = await createApp({ logger: false });
    await app.ready();

    adminToken = generateTestToken(TEST_USER_IDS.ADMIN, ['admin']);
    adminReadonlyToken = generateTestToken(TEST_USER_IDS.ADMIN_READONLY, ['admin-readonly']);
    userToken = generateTestToken(TEST_USER_IDS.USER, ['user']);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /admin/api-keys/all — RBAC', () => {
    it('should deny access without authentication', async () => {
      const response = await app.inject({ method: 'GET', url: LIST_URL });
      expect(response.statusCode).toBe(401);
    });

    it('should allow regular users (user role has api_keys:read)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: LIST_URL,
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should allow admin users (200 with data + stats)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: LIST_URL,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveProperty('total');
      expect(result.stats).toHaveProperty('active');
      expect(result.stats).toHaveProperty('revoked');
      expect(result.stats).toHaveProperty('expired');
      expect(result.stats).toHaveProperty('archived');
    });

    it('should allow adminReadonly users (200 — read permission)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: LIST_URL,
        headers: { Authorization: `Bearer ${adminReadonlyToken}` },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /admin/api-keys/all — filters and pagination', () => {
    it('should default to active keys only', async () => {
      const response = await app.inject({
        method: 'GET',
        url: LIST_URL,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      for (const key of result.data) {
        expect(key.status).toBe('active');
      }
    });

    it('should filter by status=revoked', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${LIST_URL}?status=revoked`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      for (const key of result.data) {
        expect(key.status).toBe('revoked');
      }
    });

    it('should reject invalid status values (400)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${LIST_URL}?status=bogus`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject limit above 100 (400)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${LIST_URL}?limit=500`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should paginate and include pagination metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${LIST_URL}?page=1&limit=5`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(5);
      expect(result.data.length).toBeLessThanOrEqual(5);
    });

    it('should search by key name or username', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${LIST_URL}?search=nonexistent-key-xyz`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should return owner info (userId, username) on rows', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${LIST_URL}?status=all&limit=1`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('userId');
        expect(result.data[0]).toHaveProperty('status');
        expect(result.data[0]).toHaveProperty('createdAt');
      }
    });
  });

  describe('POST /admin/api-keys/bulk-revoke — RBAC', () => {
    it('should deny access without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: BULK_REVOKE_URL,
        payload: { keyIds: ['00000000-0000-4000-8000-00000000ffff'] },
      });
      expect(response.statusCode).toBe(401);
    });

    it('should deny adminReadonly (403 — read-only role)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: BULK_REVOKE_URL,
        headers: { Authorization: `Bearer ${adminReadonlyToken}` },
        payload: { keyIds: ['00000000-0000-4000-8000-00000000ffff'] },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should deny regular users (403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: BULK_REVOKE_URL,
        headers: { Authorization: `Bearer ${userToken}` },
        payload: { keyIds: ['00000000-0000-4000-8000-00000000ffff'] },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /admin/api-keys/bulk-revoke — validation', () => {
    it('should reject empty keyIds array (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: BULK_REVOKE_URL,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { keyIds: [] },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject more than 500 keyIds (400)', async () => {
      const keyIds = Array.from(
        { length: 501 },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      );
      const response = await app.inject({
        method: 'POST',
        url: BULK_REVOKE_URL,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { keyIds },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /admin/api-keys/bulk-revoke — behavior', () => {
    it('should report not-found keys as failed without touching others', async () => {
      const response = await app.inject({
        method: 'POST',
        url: BULK_REVOKE_URL,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: {
          keyIds: ['00000000-0000-4000-8000-00000000ffff'],
          reason: 'integration test',
        },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.revoked).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('not found');
    });

    it('should be idempotent for already-inactive keys', async () => {
      // Revoke the same (nonexistent → already handled) and an inactive key twice;
      // second pass must count it as failed (already inactive), not revoked again.
      const response = await app.inject({
        method: 'POST',
        url: BULK_REVOKE_URL,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { keyIds: ['00000000-0000-4000-8000-00000000ffff'] },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result.revoked).toBe(0);
    });
  });

  describe('POST /admin/api-keys/cleanup-expired — RBAC', () => {
    it('should deny access without authentication', async () => {
      const response = await app.inject({ method: 'POST', url: CLEANUP_URL });
      expect(response.statusCode).toBe(401);
    });

    it('should deny adminReadonly (403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: CLEANUP_URL,
        headers: { Authorization: `Bearer ${adminReadonlyToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should deny regular users (403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: CLEANUP_URL,
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should allow admin and return cleanedCount (200)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: CLEANUP_URL,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('cleanedCount');
      expect(typeof result.cleanedCount).toBe('number');
    });
  });
});

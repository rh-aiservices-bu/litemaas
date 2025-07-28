import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mockUser, mockApiKey } from '../../setup';

describe('API Keys Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = global.testApp;
  });

  describe('POST /api/v1/api-keys', () => {
    it('should create a new API key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          name: 'Test API Key',
          permissions: ['models:read', 'completions:create'],
          rateLimit: 1000,
          description: 'Test key for integration testing',
        },
      });

      expect(response.statusCode).toBe(201);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name', 'Test API Key');
      expect(result).toHaveProperty('keyPreview');
      expect(result).toHaveProperty('permissions');
      expect(result.permissions).toContain('models:read');
      expect(result.permissions).toContain('completions:create');
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          // Missing required 'name' field
          permissions: ['models:read'],
          rateLimit: 1000,
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.message).toContain('name');
    });

    it('should validate permissions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          name: 'Test Key',
          permissions: ['invalid:permission'],
          rateLimit: 1000,
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.message).toContain('permissions');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/api-keys',
        payload: {
          name: 'Test Key',
          permissions: ['models:read'],
          rateLimit: 1000,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/api-keys', () => {
    it('should return user API keys', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/api-keys',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/api-keys?status=active',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/api-keys',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/api-keys/:id', () => {
    it('should return API key details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${mockApiKey.id}`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('id', mockApiKey.id);
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('permissions');
    });

    it('should return 404 for non-existent key', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/api-keys/non-existent-id',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not allow access to other users keys', async () => {
      const otherUser = { ...mockUser, id: 'other-user-id' };
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/api-keys/${mockApiKey.id}`,
        headers: {
          authorization: `Bearer ${generateTestToken(otherUser)}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/api-keys/:id', () => {
    it('should revoke an API key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/api-keys/${mockApiKey.id}`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for non-existent key', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/api-keys/non-existent-id',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/api-keys/${mockApiKey.id}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/api-keys/:id', () => {
    it('should update API key properties', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/api-keys/${mockApiKey.id}`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          name: 'Updated API Key Name',
          rateLimit: 2000,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.name).toBe('Updated API Key Name');
      expect(result.rateLimit).toBe(2000);
    });

    it('should validate update data', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/api-keys/${mockApiKey.id}`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          rateLimit: 'invalid-rate-limit',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

// Helper function to generate test JWT tokens
function generateTestToken(user: any): string {
  // In a real implementation, this would generate a proper JWT
  // For testing, we can return a mock token that the test setup recognizes
  return `test-token-${user.id}`;
}

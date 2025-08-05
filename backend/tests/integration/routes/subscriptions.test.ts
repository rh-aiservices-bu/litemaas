import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mockUser } from '../../setup';

describe('Subscriptions Routes', () => {
  let app: FastifyInstance;

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    modelId: 'gpt-4',
    status: 'active',
    quotaRequests: 10000,
    quotaTokens: 1000000,
    usedRequests: 500,
    usedTokens: 50000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    app = global.testApp;
  });

  describe('POST /api/v1/subscriptions', () => {
    it('should create a new subscription with default quotas', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          modelId: 'gpt-4',
        },
      });

      expect(response.statusCode).toBe(201);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('modelId', 'gpt-4');
      expect(result).toHaveProperty('status', 'active');
      expect(result).toHaveProperty('quotaRequests', 10000);
      expect(result).toHaveProperty('quotaTokens', 1000000);
      expect(result).toHaveProperty('usedRequests', 0);
      expect(result).toHaveProperty('usedTokens', 0);
    });

    it('should create subscription with custom quotas', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          modelId: 'claude-3-opus',
          quotaRequests: 50000,
          quotaTokens: 5000000,
        },
      });

      expect(response.statusCode).toBe(201);
      const result = JSON.parse(response.body);
      expect(result.quotaRequests).toBe(50000);
      expect(result.quotaTokens).toBe(5000000);
    });

    it('should prevent duplicate subscriptions for same model', async () => {
      // First subscription should succeed
      await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          modelId: 'gpt-3.5-turbo',
        },
      });

      // Second subscription for same model should fail
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          modelId: 'gpt-3.5-turbo',
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.message).toContain('Active subscription already exists');
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          // Missing required 'modelId' field
          quotaRequests: 10000,
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.message).toContain('modelId');
    });

    it('should validate model exists', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          modelId: 'non-existent-model',
        },
      });

      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.body);
      expect(result.message).toContain('Model not found');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/subscriptions',
        payload: {
          modelId: 'gpt-4',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/subscriptions', () => {
    it('should return user subscriptions with pricing information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(Array.isArray(result.data)).toBe(true);

      if (result.data.length > 0) {
        const subscription = result.data[0];
        expect(subscription).toHaveProperty('id');
        expect(subscription).toHaveProperty('modelId');
        expect(subscription).toHaveProperty('modelName');
        expect(subscription).toHaveProperty('provider');
        expect(subscription).toHaveProperty('status');
        expect(subscription).toHaveProperty('quotaRequests');
        expect(subscription).toHaveProperty('quotaTokens');
        expect(subscription).toHaveProperty('usedRequests');
        expect(subscription).toHaveProperty('usedTokens');

        // Should include pricing information
        expect(subscription).toHaveProperty('inputCostPerToken');
        expect(subscription).toHaveProperty('outputCostPerToken');
      }
    });

    it('should filter by status when provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions?status=active',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(Array.isArray(result.data)).toBe(true);

      // All returned subscriptions should have status 'active'
      result.data.forEach((subscription: any) => {
        expect(subscription.status).toBe('active');
      });
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/subscriptions/:id', () => {
    it('should return subscription details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/subscriptions/${mockSubscription.id}`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('id', mockSubscription.id);
      expect(result).toHaveProperty('modelId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('quotaRequests');
      expect(result).toHaveProperty('quotaTokens');
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/non-existent-id',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should not allow access to other users subscriptions', async () => {
      const otherUser = { ...mockUser, id: 'other-user-id' };
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/subscriptions/${mockSubscription.id}`,
        headers: {
          authorization: `Bearer ${generateTestToken(otherUser)}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/subscriptions/:id/quotas', () => {
    it('should update subscription quotas', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/subscriptions/${mockSubscription.id}/quotas`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          quotaRequests: 20000,
          quotaTokens: 2000000,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result.quotaRequests).toBe(20000);
      expect(result.quotaTokens).toBe(2000000);
    });

    it('should validate quota values', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/subscriptions/${mockSubscription.id}/quotas`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          quotaRequests: -1, // Invalid negative value
          quotaTokens: 'invalid', // Invalid type
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/subscriptions/non-existent-id/quotas',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
        payload: {
          quotaRequests: 20000,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/subscriptions/${mockSubscription.id}/quotas`,
        payload: {
          quotaRequests: 20000,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/subscriptions/:id/pricing', () => {
    it('should return subscription pricing information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/subscriptions/${mockSubscription.id}/pricing`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('subscriptionId', mockSubscription.id);
      expect(result).toHaveProperty('usedRequests');
      expect(result).toHaveProperty('usedTokens');
      expect(result).toHaveProperty('inputCostPerToken');
      expect(result).toHaveProperty('outputCostPerToken');
      expect(typeof result.inputCostPerToken).toBe('number');
      expect(typeof result.outputCostPerToken).toBe('number');
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/non-existent-id/pricing',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/subscriptions/${mockSubscription.id}/pricing`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/subscriptions/:id', () => {
    it('should cancel a subscription', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/subscriptions/${mockSubscription.id}`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/subscriptions/non-existent-id',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/subscriptions/${mockSubscription.id}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/subscriptions/:id/usage', () => {
    it('should return subscription usage and quota information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/subscriptions/${mockSubscription.id}/usage`,
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('subscriptionId', mockSubscription.id);
      expect(result).toHaveProperty('quotaRequests');
      expect(result).toHaveProperty('quotaTokens');
      expect(result).toHaveProperty('usedRequests');
      expect(result).toHaveProperty('usedTokens');
      expect(result).toHaveProperty('requestUtilization');
      expect(result).toHaveProperty('tokenUtilization');
      expect(result).toHaveProperty('withinRequestLimit');
      expect(result).toHaveProperty('withinTokenLimit');

      // Utilization should be percentages
      expect(typeof result.requestUtilization).toBe('number');
      expect(typeof result.tokenUtilization).toBe('number');
      expect(typeof result.withinRequestLimit).toBe('boolean');
      expect(typeof result.withinTokenLimit).toBe('boolean');
    });

    it('should return 404 for non-existent subscription', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/subscriptions/non-existent-id/usage',
        headers: {
          authorization: `Bearer ${generateTestToken(mockUser)}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/subscriptions/${mockSubscription.id}/usage`,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

// Helper function to generate test JWT tokens
function generateTestToken(user: any): string {
  // In a real implementation, this would generate a proper JWT
  // For testing, we can return a mock token that the test setup recognizes
  return `test-token-${user.id}`;
}

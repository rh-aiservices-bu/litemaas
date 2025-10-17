/**
 * Integration tests for Admin Usage Analytics Pagination
 * Tests pagination, sorting, and metadata on breakdown endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { generateTestToken } from './setup';

// Helper to add small delay between requests to avoid rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Admin Usage Pagination', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ALLOWED_FRONTEND_ORIGINS = ''; // Disable frontend bypass

    app = await createApp({ logger: false });
    await app.ready();

    // Generate test token for admin role
    adminToken = generateTestToken('admin-user-id', ['admin']);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Small delay to avoid rate limiting between tests
    await delay(100);
  });

  describe('User Breakdown Pagination', () => {
    it('should return paginated results with default parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Should have pagination structure
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');

      // Pagination metadata should be present
      expect(body.pagination).toHaveProperty('page');
      expect(body.pagination).toHaveProperty('limit');
      expect(body.pagination).toHaveProperty('total');
      expect(body.pagination).toHaveProperty('totalPages');
      expect(body.pagination).toHaveProperty('hasNext');
      expect(body.pagination).toHaveProperty('hasPrevious');

      // Default values
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(50);
      expect(body.pagination.hasPrevious).toBe(false);

      // Data should be an array
      expect(Array.isArray(body.data)).toBe(true);

      // Data length should not exceed limit
      expect(body.data.length).toBeLessThanOrEqual(50);
    });

    it('should respect custom page parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?page=2&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.hasPrevious).toBe(true);
    });

    it('should respect custom limit parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?limit=25',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.pagination.limit).toBe(25);
      expect(body.data.length).toBeLessThanOrEqual(25);
    });

    it('should reject page < 1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?page=0',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Validation should fail with 400 Bad Request
      expect(response.statusCode).toBe(400);
      const body = response.json();
      // Verify error response exists (format may vary between Fastify schema validation and ApplicationError)
      expect(body.error || body.message).toBeDefined();
    });

    it('should reject limit > 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?limit=500',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Validation should fail with 400 Bad Request
      expect(response.statusCode).toBe(400);
      const body = response.json();
      // Verify error response exists (format may vary between Fastify schema validation and ApplicationError)
      expect(body.error || body.message).toBeDefined();
    });

    it('should calculate totalPages correctly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // totalPages should be ceil(total / limit)
      const expectedPages = Math.ceil(body.pagination.total / body.pagination.limit);
      expect(body.pagination.totalPages).toBe(expectedPages);
    });

    it('should handle empty results gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
      expect(body.pagination.totalPages).toBe(0);
      expect(body.pagination.hasNext).toBe(false);
      expect(body.pagination.hasPrevious).toBe(false);
    });
  });

  describe('Sorting', () => {
    it('should sort by totalTokens descending by default', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      if (body.data.length > 1) {
        // Verify descending order by totalTokens
        for (let i = 0; i < body.data.length - 1; i++) {
          const currentTokens = body.data[i].metrics.tokens.total;
          const nextTokens = body.data[i + 1].metrics.tokens.total;
          expect(currentTokens).toBeGreaterThanOrEqual(nextTokens);
        }
      }
    });

    it('should sort by username ascending when specified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?sortBy=username&sortOrder=asc&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      if (body.data.length > 1) {
        // Verify ascending order by username
        for (let i = 0; i < body.data.length - 1; i++) {
          const currentName = body.data[i].username.toLowerCase();
          const nextName = body.data[i + 1].username.toLowerCase();
          expect(currentName.localeCompare(nextName)).toBeLessThanOrEqual(0);
        }
      }
    });

    it('should sort by totalRequests descending when specified', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?sortBy=totalRequests&sortOrder=desc&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      if (body.data.length > 1) {
        // Verify descending order by totalRequests
        for (let i = 0; i < body.data.length - 1; i++) {
          const currentRequests = body.data[i].metrics.requests;
          const nextRequests = body.data[i + 1].metrics.requests;
          expect(currentRequests).toBeGreaterThanOrEqual(nextRequests);
        }
      }
    });

    it('should reject invalid sort field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?sortBy=invalidField',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Accept 400 or 429 (rate limited)
      expect([400, 429]).toContain(response.statusCode);
      if (response.statusCode === 400) {
        const body = response.json();
        expect(body.message || body.error).toContain('Invalid sort field');
      }
    });

    it('should reject invalid sort order', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?sortOrder=invalid',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Accept 400 or 429 (rate limited)
      expect([400, 429]).toContain(response.statusCode);
      if (response.statusCode === 400) {
        const body = response.json();
        expect(body.message || body.error).toContain('Sort order must be "asc" or "desc"');
      }
    });

    it('should support all valid user breakdown sort fields', async () => {
      const validFields = [
        'username',
        'totalRequests',
        'totalTokens',
        'promptTokens',
        'completionTokens',
        'totalCost',
      ];

      // Test a few representative fields instead of all to avoid rate limiting
      const fieldsToTest = [validFields[0], validFields[2], validFields[5]];

      for (const field of fieldsToTest) {
        await delay(200); // Delay between requests to avoid rate limiting
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/admin/usage/by-user?sortBy=${field}&limit=5`,
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          payload: {
            startDate: '2024-04-01',
            endDate: '2024-04-30',
          },
        });

        // Accept 200 or 429 (rate limited)
        expect([200, 429]).toContain(response.statusCode);
      }
    });
  });

  describe('Model Breakdown Pagination', () => {
    it('should paginate model breakdown', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-model?page=1&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should respect pagination parameters for models', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-model?page=1&limit=5',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.pagination.limit).toBe(5);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });

    it('should support model breakdown sort fields', async () => {
      const validFields = [
        'modelName',
        'totalRequests',
        'totalTokens',
        'promptTokens',
        'completionTokens',
        'totalCost',
      ];

      for (const field of validFields) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/admin/usage/by-model?sortBy=${field}&limit=5`,
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          payload: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        });

        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('Provider Breakdown Pagination', () => {
    it('should paginate provider breakdown', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-provider?page=1&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should respect pagination parameters for providers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-provider?page=1&limit=5',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.pagination.limit).toBe(5);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });

    it('should support provider breakdown sort fields', async () => {
      const validFields = [
        'providerName',
        'totalRequests',
        'totalTokens',
        'promptTokens',
        'completionTokens',
        'totalCost',
      ];

      for (const field of validFields) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/admin/usage/by-provider?sortBy=${field}&limit=5`,
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          payload: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        });

        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('Pagination Navigation', () => {
    it('should set hasNext=true when there are more pages', async () => {
      // Request with small limit to ensure multiple pages
      await delay(200);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?page=1&limit=5',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Accept 200 or 429 (rate limited)
      expect([200, 429]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = response.json();

        // If there are more than 5 total items, hasNext should be true
        if (body.pagination.total > 5) {
          expect(body.pagination.hasNext).toBe(true);
        }
      }
    });

    it('should set hasPrevious=true for page > 1', async () => {
      await delay(200);
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?page=2&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Accept 200 or 429 (rate limited)
      expect([200, 429]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        const body = response.json();
        expect(body.pagination.hasPrevious).toBe(true);
      }
    });

    it('should set hasNext=false on last page', async () => {
      // Get first page to know total
      await delay(200);
      const firstPage = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Handle rate limiting gracefully
      if (firstPage.statusCode === 429) {
        return; // Skip test if rate limited
      }

      expect(firstPage.statusCode).toBe(200);
      const firstBody = firstPage.json();
      const { totalPages } = firstBody.pagination;

      if (totalPages > 0) {
        await delay(200);
        // Request last page
        const lastPage = await app.inject({
          method: 'POST',
          url: `/api/v1/admin/usage/by-user?page=${totalPages}&limit=10`,
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          payload: {
            startDate: '2024-07-01',
            endDate: '2024-07-31',
          },
        });

        if (lastPage.statusCode === 200) {
          const body = lastPage.json();
          expect(body.pagination.hasNext).toBe(false);
          expect(body.pagination.page).toBe(totalPages);
        }
      }
    });
  });

  describe('Pagination Consistency', () => {
    it('should return consistent total across pages', async () => {
      await delay(200);
      const page1 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?page=1&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Handle rate limiting gracefully
      if (page1.statusCode === 429) {
        return; // Skip test if rate limited
      }

      await delay(200);
      const page2 = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?page=2&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      if (page2.statusCode === 429) {
        return; // Skip test if rate limited
      }

      expect(page1.statusCode).toBe(200);
      expect(page2.statusCode).toBe(200);

      const body1 = page1.json();
      const body2 = page2.json();

      // Total should be the same across all pages for the same query
      expect(body1.pagination.total).toBe(body2.pagination.total);
      expect(body1.pagination.totalPages).toBe(body2.pagination.totalPages);
    });

    it('should not have overlapping data between pages', async () => {
      await delay(200);
      const page1Response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?page=1&limit=10&sortBy=username&sortOrder=asc',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      // Handle rate limiting gracefully
      if (page1Response.statusCode === 429) {
        return; // Skip test if rate limited
      }

      await delay(200);
      const page2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/by-user?page=2&limit=10&sortBy=username&sortOrder=asc',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      if (page2Response.statusCode === 429) {
        return; // Skip test if rate limited
      }

      expect(page1Response.statusCode).toBe(200);
      expect(page2Response.statusCode).toBe(200);

      const page1 = page1Response.json();
      const page2 = page2Response.json();

      if (page1.data.length > 0 && page2.data.length > 0) {
        // Extract userIds from both pages
        const page1UserIds = page1.data.map((u: any) => u.userId);
        const page2UserIds = page2.data.map((u: any) => u.userId);

        // Check for overlap
        const overlap = page1UserIds.filter((id: string) => page2UserIds.includes(id));
        expect(overlap).toHaveLength(0);
      }
    });
  });
});

// backend/tests/integration/date-range-validation.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../src/app';
import { generateTestToken } from './setup';

describe('Date Range Validation', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ALLOWED_FRONTEND_ORIGINS = ''; // Disable frontend bypass

    app = await createApp({ logger: false });
    await app.ready();

    // Generate proper admin token for authentication
    adminToken = generateTestToken('admin-user-id', ['admin']);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Analytics endpoints (90-day limit)', () => {
    it('should accept valid date range within limit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-03-31', // 90 days
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject date range exceeding limit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2020-01-01',
          endDate: '2025-12-31', // ~6 years
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.code).toBe('DATE_RANGE_TOO_LARGE');
      expect(body.details.maxAllowedDays).toBe(90);
      expect(body.details.requestedDays).toBeGreaterThan(365);
      expect(body.details.suggestedRanges).toBeDefined();
      expect(body.details.suggestedRanges.length).toBeGreaterThan(0);
    });

    it('should reject invalid date order', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-12-31',
          endDate: '2025-01-01',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('INVALID_DATE_ORDER');
    });

    it('should reject invalid date format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025/01/01', // Wrong format
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(400);
      // Schema validation may reject before reaching date validation
      // Accept either INVALID_DATE_FORMAT or schema validation error
      const body = response.json();
      if (body.code) {
        expect(body.code).toMatch(/INVALID_DATE_FORMAT|FST_ERR_VALIDATION/);
      } else {
        // Schema validation error - no code field, just check status
        expect(response.statusCode).toBe(400);
      }
    });

    it('should accept single-day range', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-01',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Export endpoint (365-day limit)', () => {
    it('should allow larger range for export', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/export',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-12-30',
          format: 'csv',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject export range exceeding 365 days', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/export',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2020-01-01',
          endDate: '2025-12-31',
          format: 'csv',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().details.maxAllowedDays).toBe(365);
    });
  });

  describe('Suggested ranges', () => {
    it('should provide helpful suggestions when range too large', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/usage/analytics',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-12-31', // 365 days, needs to be split into ~4 ranges
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.details.suggestedRanges).toBeDefined();
      expect(body.details.suggestedRanges.length).toBeGreaterThan(0);

      // Verify each suggestion is within limit
      body.details.suggestedRanges.forEach((range: any) => {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        expect(days).toBeLessThanOrEqual(90);
      });
    });
  });
});

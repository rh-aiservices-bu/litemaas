/**
 * Integration tests for Usage Routes
 * Tests usage metrics and analytics endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app';
import { generateTestToken, createTestUsers, TEST_USER_IDS } from '../setup';

describe('Usage Routes Integration', () => {
  let app: FastifyInstance;
  let userToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    app = await createApp({ logger: false });
    await app.ready();

    await createTestUsers(app);

    userToken = generateTestToken(TEST_USER_IDS.USER, ['user']);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/v1/usage/analytics', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should retrieve analytics for authenticated user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('totalRequests');
      expect(result).toHaveProperty('totalTokens');
      expect(result).toHaveProperty('totalCost');
    });

    it('should support model IDs filtering', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          modelIds: ['gpt-4', 'claude-3'],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should support provider IDs filtering', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          providerIds: ['openai', 'anthropic'],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject API key IDs not belonging to user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          apiKeyIds: ['key-123'],
        },
      });

      expect(response.statusCode).toBe(403);
      const result = JSON.parse(response.body);
      expect(result.code).toBe('FORBIDDEN_API_KEYS');
    });

    it('should require startDate and endDate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate date format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: 'invalid-date',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/usage/export', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/export',
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require startDate and endDate', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/export',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject reversed date range', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/export',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-31',
          endDate: '2025-01-01',
        },
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.body);
      expect(result.code).toBe('INVALID_DATE_RANGE');
    });

    it('should reject API keys not belonging to user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/export',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          apiKeyIds: ['nonexistent-key-alias'],
        },
      });

      expect(response.statusCode).toBe(403);
      const result = JSON.parse(response.body);
      expect(result.code).toBe('FORBIDDEN_API_KEYS');
      expect(result.details.invalidApiKeys).toContain('nonexistent-key-alias');
    });

    it('should return CSV with per-day rows when export succeeds', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/export',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          format: 'csv',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('usage-export-');
      expect(response.headers['content-disposition']).toContain('.csv');

      const csv = response.body;
      const lines = csv.split('\n');
      const header = lines[0];

      expect(header).toContain('Date');
      expect(header).toContain('Prompt Tokens');
      expect(header).toContain('Completion Tokens');
      expect(header).not.toContain('User ID');
      expect(header).not.toContain('Username');
      expect(header).not.toContain('Email');

      for (const line of lines.slice(1)) {
        if (!line.trim()) continue;
        const fields = line.split(',');
        const totalTokens = parseInt(fields[2]);
        const promptTokens = parseInt(fields[3]);
        const completionTokens = parseInt(fields[4]);
        expect(totalTokens).toBe(promptTokens + completionTokens);
      }
    });

    it('should return JSON with daily breakdown type when format is json', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/export',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-07',
          format: 'json',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('.json');

      const parsed = JSON.parse(response.body);
      expect(parsed.metadata.breakdownType).toBe('daily');
      expect(Array.isArray(parsed.data)).toBe(true);

      for (const day of parsed.data) {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('tokens');
        expect(day).toHaveProperty('prompt_tokens');
        expect(day).toHaveProperty('completion_tokens');
        expect(day.tokens).toBe(day.prompt_tokens + day.completion_tokens);
      }
    });

    it('should support optional filter arrays', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/export',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          modelIds: ['gpt-4'],
          providerIds: ['openai'],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should not accept GET method', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/usage/export',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Data Privacy', () => {
    it('should only return data for authenticated user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.body);
      expect(result).toHaveProperty('totalRequests');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'content-type': 'application/json',
        },
        payload: 'invalid-json',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/usage/analytics',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {
          startDate: '2025-01-01',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

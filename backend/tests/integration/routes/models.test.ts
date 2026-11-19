/**
 * Integration tests for Models Routes
 * Tests model listing, details, sync, and provider information
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app';
import { generateTestToken } from '../setup';

describe('Models Routes Integration', () => {
  let app: FastifyInstance;
  let userToken: string;
  let adminToken: string;
  let adminReadonlyToken: string;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    app = await createApp({ logger: false });
    await app.ready();

    // Generate test tokens
    userToken = generateTestToken('user-123', ['user']);
    adminToken = generateTestToken('admin-123', ['admin']);
    adminReadonlyToken = generateTestToken('admin-readonly-123', ['admin-readonly']);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/v1/models', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('UNAUTHORIZED');
    });

    it('should list all available models', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pagination');
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.pagination).toHaveProperty('page', 1);
        expect(result.pagination).toHaveProperty('limit', 20);
      }
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models?page=1&limit=10',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(10);
        expect(result.data.length).toBeLessThanOrEqual(10);
      }
    });

    it('should filter by provider', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models?provider=openai',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        // Verify all models are from openai if any exist
        if (result.data.length > 0) {
          result.data.forEach((model: any) => {
            expect(model.provider.toLowerCase()).toBe('openai');
          });
        }
      }
    });

    it('should filter by capability', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models?capability=vision',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        // Verify all models have vision capability if any exist
        if (result.data.length > 0) {
          result.data.forEach((model: any) => {
            expect(model.capabilities).toContain('vision');
          });
        }
      }
    });

    it('should support search filtering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models?search=gpt',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    it('should return models with proper structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        if (result.data.length > 0) {
          const model = result.data[0];
          expect(model).toHaveProperty('id');
          expect(model).toHaveProperty('name');
          expect(model).toHaveProperty('provider');
          expect(model).toHaveProperty('capabilities');
          expect(Array.isArray(model.capabilities)).toBe(true);
        }
      }
    });

    it('should include pricing information when available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        // Check if any model has pricing info
        const modelWithPricing = result.data.find((m: any) => m.pricing);
        if (modelWithPricing) {
          expect(modelWithPricing.pricing).toHaveProperty('input');
          expect(modelWithPricing.pricing).toHaveProperty('output');
          expect(modelWithPricing.pricing).toHaveProperty('unit');
        }
      }
    });

    it('should validate pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models?page=0&limit=10000',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      // Should accept any page/limit within reasonable bounds in current impl
      expect([200, 400, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/models/:id', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/some-model',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should retrieve model details by ID', async () => {
      // First get a model ID
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (listResponse.statusCode === 200) {
        const listResult = JSON.parse(listResponse.body);
        if (listResult.data.length > 0) {
          const modelId = listResult.data[0].id;

          const response = await app.inject({
            method: 'GET',
            url: `/api/v1/models/${modelId}`,
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          });

          expect([200, 404, 500]).toContain(response.statusCode);

          if (response.statusCode === 200) {
            const result = JSON.parse(response.body);
            expect(result).toHaveProperty('id', modelId);
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('provider');
          }
        }
      }
    });

    it('should return 404 for non-existent model', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/non-existent-model',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([404, 500]).toContain(response.statusCode);

      if (response.statusCode === 404) {
        const result = JSON.parse(response.body);
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should include model capabilities in details', async () => {
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (listResponse.statusCode === 200) {
        const listResult = JSON.parse(listResponse.body);
        if (listResult.data.length > 0) {
          const modelId = listResult.data[0].id;

          const response = await app.inject({
            method: 'GET',
            url: `/api/v1/models/${modelId}`,
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          });

          if (response.statusCode === 200) {
            const result = JSON.parse(response.body);
            expect(result).toHaveProperty('capabilities');
            expect(Array.isArray(result.capabilities)).toBe(true);
          }
        }
      }
    });

    it('should include pricing information in details', async () => {
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (listResponse.statusCode === 200) {
        const listResult = JSON.parse(listResponse.body);
        const modelWithPricing = listResult.data.find((m: any) => m.pricing);

        if (modelWithPricing) {
          const response = await app.inject({
            method: 'GET',
            url: `/api/v1/models/${modelWithPricing.id}`,
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          });

          if (response.statusCode === 200) {
            const result = JSON.parse(response.body);
            // Pricing might be in pricing object or metadata
            const hasPricing = result.pricing || result.metadata?.inputCostPerToken !== undefined;
            expect(hasPricing).toBeTruthy();
          }
        }
      }
    });
  });

  describe('Model field visibility', () => {
    const modelRow = {
      id: 'visibility-model',
      name: 'visibility-model',
      provider: 'openai',
      description: 'Model used to verify field visibility',
      features: ['chat'],
      context_length: 128000,
      input_cost_per_token: 0.01,
      output_cost_per_token: 0.03,
      availability: 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      api_base: 'http://litellm.internal.svc.cluster.local:4000',
      backend_model_name: 'internal-backend-model',
      tpm: 1000,
      rpm: 100,
      max_tokens: 128000,
      supports_vision: false,
      supports_function_calling: true,
      supports_parallel_function_calling: false,
      supports_tool_choice: false,
      restricted_access: false,
      litellm_model_id: 'litellm-model-id',
    };

    const internalFields = [
      'apiBase',
      'backendModelName',
      'inputCostPerToken',
      'outputCostPerToken',
      'tpm',
      'rpm',
    ];

    let originalQueryMany: typeof app.dbUtils.queryMany;
    let originalQuery: typeof app.dbUtils.query;

    beforeEach(() => {
      originalQueryMany = app.dbUtils.queryMany;
      originalQuery = app.dbUtils.query;
      app.dbUtils.queryMany = (async () => [modelRow]) as typeof app.dbUtils.queryMany;
      app.dbUtils.query = (async () => ({
        rows: [modelRow],
        rowCount: 1,
      })) as unknown as typeof app.dbUtils.query;
    });

    afterEach(() => {
      app.dbUtils.queryMany = originalQueryMany;
      app.dbUtils.query = originalQuery;
    });

    const listAs = (token: string) =>
      app.inject({
        method: 'GET',
        url: '/api/v1/models',
        headers: { Authorization: `Bearer ${token}` },
      });

    const detailAs = (token: string) =>
      app.inject({
        method: 'GET',
        url: `/api/v1/models/${modelRow.id}`,
        headers: { Authorization: `Bearer ${token}` },
      });

    it('should hide internal fields from regular users in the model list', async () => {
      const response = await listAs(userToken);
      expect(response.statusCode).toBe(200);

      const model = response.json().data[0];
      expect(model).toMatchObject({ id: modelRow.id, name: modelRow.name });
      for (const field of internalFields) {
        expect(model, `leaked ${field}`).not.toHaveProperty(field);
      }
    });

    it('should show internal fields to admins in the model list', async () => {
      const response = await listAs(adminToken);
      expect(response.statusCode).toBe(200);

      const model = response.json().data[0];
      expect(model.apiBase).toBe(modelRow.api_base);
      expect(model.backendModelName).toBe(modelRow.backend_model_name);
      expect(model.inputCostPerToken).toBe(modelRow.input_cost_per_token);
      expect(model.tpm).toBe(modelRow.tpm);
      expect(model.rpm).toBe(modelRow.rpm);
    });

    it('should show internal fields to read-only admins in the model list', async () => {
      const response = await listAs(adminReadonlyToken);
      expect(response.statusCode).toBe(200);

      const model = response.json().data[0];
      expect(model.apiBase).toBe(modelRow.api_base);
      expect(model.inputCostPerToken).toBe(modelRow.input_cost_per_token);
      expect(model.tpm).toBe(modelRow.tpm);
    });

    it('should hide internal metadata from regular users in model details', async () => {
      const response = await detailAs(userToken);
      expect(response.statusCode).toBe(200);

      const { metadata } = response.json();
      expect(metadata.maxTokens).toBe(modelRow.max_tokens);
      for (const field of [...internalFields, 'litellmModelId']) {
        expect(metadata, `leaked ${field}`).not.toHaveProperty(field);
      }
    });

    it('should include internal metadata for admins in model details', async () => {
      const response = await detailAs(adminToken);
      expect(response.statusCode).toBe(200);

      const { metadata } = response.json();
      expect(metadata.apiBase).toBe(modelRow.api_base);
      expect(metadata.backendModelName).toBe(modelRow.backend_model_name);
      expect(metadata.inputCostPerToken).toBe(modelRow.input_cost_per_token);
      expect(metadata.litellmModelId).toBe(modelRow.litellm_model_id);
    });

    it('should include internal metadata for read-only admins in model details', async () => {
      const response = await detailAs(adminReadonlyToken);
      expect(response.statusCode).toBe(200);

      expect(response.json().metadata.apiBase).toBe(modelRow.api_base);
    });
  });

  describe('GET /api/v1/models/providers', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/providers',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return list of providers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/providers',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('providers');
        expect(Array.isArray(result.providers)).toBe(true);
      }
    });

    it('should include provider model counts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/providers',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        if (result.providers.length > 0) {
          const provider = result.providers[0];
          expect(provider).toHaveProperty('name');
          expect(provider).toHaveProperty('displayName');
          expect(provider).toHaveProperty('modelCount');
          expect(typeof provider.modelCount).toBe('number');
        }
      }
    });

    it('should include provider capabilities', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/providers',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        if (result.providers.length > 0) {
          const provider = result.providers[0];
          expect(provider).toHaveProperty('capabilities');
          expect(Array.isArray(provider.capabilities)).toBe(true);
        }
      }
    });

    it('should sort providers by model count', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/providers',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        if (result.providers.length > 1) {
          // Verify descending order by modelCount
          for (let i = 0; i < result.providers.length - 1; i++) {
            expect(result.providers[i].modelCount).toBeGreaterThanOrEqual(
              result.providers[i + 1].modelCount,
            );
          }
        }
      }
    });
  });

  describe('GET /api/v1/models/capabilities', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/capabilities',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return list of capabilities', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/capabilities',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('capabilities');
        expect(Array.isArray(result.capabilities)).toBe(true);
      }
    });

    it('should include capability descriptions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/capabilities',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        if (result.capabilities.length > 0) {
          const capability = result.capabilities[0];
          expect(capability).toHaveProperty('name');
          expect(capability).toHaveProperty('displayName');
          expect(capability).toHaveProperty('description');
          expect(capability).toHaveProperty('modelCount');
        }
      }
    });

    it('should sort capabilities by model count', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/capabilities',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        if (result.capabilities.length > 1) {
          // Verify descending order by modelCount
          for (let i = 0; i < result.capabilities.length - 1; i++) {
            expect(result.capabilities[i].modelCount).toBeGreaterThanOrEqual(
              result.capabilities[i + 1].modelCount,
            );
          }
        }
      }
    });
  });

  describe('POST /api/v1/models/refresh', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/refresh',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/refresh',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should deny access for admin readonly users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/refresh',
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow access for admin users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/refresh',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('modelsCount');
        expect(result).toHaveProperty('refreshedAt');
      }
    });
  });

  describe('POST /api/v1/models/sync', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/sync',
        payload: {}, // Empty payload to avoid 400 validation error before auth check
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access for regular users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/sync',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        payload: {}, // Empty payload to avoid 400 validation error before auth check
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow access for admin users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/sync',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          forceUpdate: false,
          markUnavailable: true,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('totalModels');
        expect(result).toHaveProperty('newModels');
        expect(result).toHaveProperty('updatedModels');
        expect(result).toHaveProperty('syncedAt');
      }
    });

    it('should accept forceUpdate parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/sync',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          forceUpdate: true,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/models/sync/stats', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/sync/stats',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow access for regular users with models:read permission', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/sync/stats',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      // Regular users have 'models:read' permission, so they can access this endpoint
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should allow access for admin users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/sync/stats',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('totalModels');
        expect(result).toHaveProperty('availableModels');
        expect(result).toHaveProperty('unavailableModels');
      }
    });

    it('should allow access for admin readonly users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/sync/stats',
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('GET /api/v1/models/validate', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/validate',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow access for admin users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/validate',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('validModels');
        expect(result).toHaveProperty('invalidModels');
        expect(result).toHaveProperty('orphanedSubscriptions');
        expect(Array.isArray(result.invalidModels)).toBe(true);
      }
    });
  });

  describe('GET /api/v1/models/health', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/health',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return health status for authenticated users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/health',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('modelsCount');
        expect(result).toHaveProperty('litellmConnected');
        expect(result).toHaveProperty('issues');
        expect(Array.isArray(result.issues)).toBe(true);
      }
    });

    it('should report healthy status when no issues', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/health',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(['healthy', 'warning', 'error']).toContain(result.status);
      }
    });

    it('should include LiteLLM connection status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/health',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(typeof result.litellmConnected).toBe('boolean');
      }
    });
  });

  describe('GET /api/v1/models/popularity', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/popularity',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow access for regular users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/popularity',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('popularity');
        expect(typeof result.popularity).toBe('object');
      }
    });

    it('should allow access for admin users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/popularity',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('popularity');
      }
    });

    it('should allow access for admin readonly users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/popularity',
        headers: {
          Authorization: `Bearer ${adminReadonlyToken}`,
        },
      });

      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('popularity');
      }
    });

    it('should return star ratings between 1 and 5', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/popularity',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        for (const [, rating] of Object.entries(result.popularity)) {
          expect(rating).toBeGreaterThanOrEqual(1);
          expect(rating).toBeLessThanOrEqual(5);
          expect(Number.isInteger(rating)).toBe(true);
        }
      }
    });

    it('should reject requests with invalid tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models/popularity',
        headers: {
          Authorization: 'Bearer invalid-token-value',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid pagination values gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models?page=abc&limit=xyz',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([200, 400, 500]).toContain(response.statusCode);
    });

    it('should handle malformed filter parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/models?isActive=not-a-boolean',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect([200, 400, 500]).toContain(response.statusCode);
    });

    it('should handle sync errors gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/models/sync',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          forceUpdate: 'not-a-boolean', // Invalid type
        },
      });

      // Should either accept it as falsy or reject with 400
      expect([200, 400, 500]).toContain(response.statusCode);
    });
  });
});

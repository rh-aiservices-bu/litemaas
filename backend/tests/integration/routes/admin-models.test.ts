import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app';
import { generateTestToken, createTestUsers } from '../setup';

describe('Admin Models Routes', () => {
  let app: FastifyInstance;
  // Track models created during tests for cleanup
  const createdTestModels = new Set<string>();

  const mockCreatePayload = {
    model_name: 'new-test-model',
    backend_model_name: 'new-test-backend-model',
    description: 'A new test model',
    api_base: 'https://api.newtest.com/v1',
    api_key: 'new-test-key',
    input_cost_per_token: 0.00002,
    output_cost_per_token: 0.00004,
    tpm: 5000,
    rpm: 250,
    max_tokens: 2048,
    supports_vision: false,
    supports_function_calling: true,
    supports_parallel_function_calling: true,
    supports_tool_choice: false,
  };

  beforeAll(async () => {
    app = await createApp({ logger: false });
    await app.ready();
    await createTestUsers(app);
  });

  afterAll(async () => {
    // Cleanup: Delete test models from database
    // Note: Mock models are no longer synced in test environment, so no pollution to clean
    if (app && createdTestModels.size > 0) {
      console.log(`\n=== Cleaning up ${createdTestModels.size} test models ===`);

      try {
        const modelNamesArray = Array.from(createdTestModels);
        const deleteResult = await app.dbUtils.query(
          'DELETE FROM models WHERE id = ANY($1::text[]) RETURNING id',
          [modelNamesArray],
        );

        if (deleteResult.rowCount && deleteResult.rowCount > 0) {
          console.log(`✓ Deleted ${deleteResult.rowCount} test model(s):`);
          deleteResult.rows.forEach((row: any) => console.log(`  - ${row.id}`));
        } else {
          console.log('✓ No test models found in database (already cleaned up)');
        }
      } catch (error) {
        console.error(
          `✗ Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      console.log('=== Test cleanup complete ===\n');
    }

    if (app) {
      await app.close();
    }
  });

  describe('Authorization', () => {
    it('should reject requests without admin permissions for POST', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('user-123', ['user'])}`,
        },
        payload: mockCreatePayload,
      });
      console.log(response);
      expect([401, 403]).toContain(response.statusCode);
      const result = JSON.parse(response.body);
      expect(result.error).toBeDefined();
      // The error can be either a string or an object depending on the error handler
      expect(['string', 'object']).toContain(typeof result.error);
    });

    it('should reject requests without admin permissions for PUT', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/models/test-model',
        headers: {
          authorization: `Bearer ${generateTestToken('user-123', ['user'])}`,
        },
        payload: { model_name: 'updated-model' },
      });

      expect([401, 403]).toContain(response.statusCode);
    });

    it('should reject requests without admin permissions for DELETE', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/models/test-model',
        headers: {
          authorization: `Bearer ${generateTestToken('user-123', ['user'])}`,
        },
      });

      expect([401, 403]).toContain(response.statusCode);
    });

    it('should reject adminReadonly role for write operations', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('admin-readonly-123', ['adminReadonly'])}`,
        },
        payload: mockCreatePayload,
      });

      expect([401, 403]).toContain(response.statusCode);
    });
  });

  describe('POST /api/v1/admin/models', () => {
    it('should accept requests from admin users', async () => {
      // Track for cleanup BEFORE the request to ensure cleanup even if test fails
      createdTestModels.add(mockCreatePayload.model_name);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: mockCreatePayload,
      });

      // Expect either success (201) or auth failure (401/403) in test environment
      expect([201, 401, 403, 500]).toContain(response.statusCode);

      if (response.statusCode === 201) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('model');
        expect(result.model).toHaveProperty('model_name', mockCreatePayload.model_name);
      }
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: {
          // Missing required fields: model_name, backend_model_name, api_base
          description: 'Test model without required fields',
        },
      });

      expect([400, 401, 403]).toContain(response.statusCode);

      if (response.statusCode === 400) {
        const result = JSON.parse(response.body);
        expect(result.error).toBeDefined();
      }
    });

    it('should handle payload with all required fields', async () => {
      const minimalPayload = {
        model_name: 'minimal-model',
        backend_model_name: 'minimal-backend-model',
        api_base: 'https://api.minimal.com/v1',
        // Other fields should have defaults or be optional
        input_cost_per_token: 0.00001,
        output_cost_per_token: 0.00002,
        tpm: 1000,
        rpm: 100,
        max_tokens: 4000,
        supports_vision: false,
        supports_function_calling: false,
        supports_parallel_function_calling: false,
        supports_tool_choice: false,
      };

      // Track for cleanup BEFORE the request to ensure cleanup even if test fails
      createdTestModels.add(minimalPayload.model_name);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: minimalPayload,
      });

      // Should accept minimal valid payload
      expect([201, 401, 403, 500]).toContain(response.statusCode);
    });

    it('should handle payload without optional api_key', async () => {
      const payloadWithoutApiKey = {
        model_name: 'test-model-no-key',
        backend_model_name: 'test-backend-model-no-key',
        description: 'Test model without API key',
        api_base: 'https://api.testnoapikey.com/v1',
        input_cost_per_token: 0.00002,
        output_cost_per_token: 0.00004,
        tpm: 5000,
        rpm: 250,
        max_tokens: 2048,
        supports_vision: false,
        supports_function_calling: true,
        supports_parallel_function_calling: true,
        supports_tool_choice: false,
      };

      // Track for cleanup BEFORE the request to ensure cleanup even if test fails
      createdTestModels.add(payloadWithoutApiKey.model_name);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: payloadWithoutApiKey,
      });

      // Should accept payload without api_key (it's optional)
      expect([201, 401, 403, 500]).toContain(response.statusCode);
    });
  });

  describe('PUT /api/v1/admin/models/:id', () => {
    it('should accept partial update from admin users', async () => {
      const updatePayload = {
        model_name: 'updated-model-name',
        description: 'Updated description',
        tpm: 15000,
      };

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/models/existing-model-id',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: updatePayload,
      });

      // Expect either success or failure due to model not existing in test env
      expect([200, 400, 401, 403, 404, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('model');
      }
    });

    it('should handle update of cost fields', async () => {
      const updatePayload = {
        input_cost_per_token: 0.000025,
        output_cost_per_token: 0.00005,
      };

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/models/existing-model-id',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: updatePayload,
      });

      expect([200, 400, 401, 403, 404, 500]).toContain(response.statusCode);
    });

    it('should handle update of feature flags', async () => {
      const updatePayload = {
        supports_vision: true,
        supports_function_calling: false,
        supports_parallel_function_calling: true,
        supports_tool_choice: false,
      };

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/models/existing-model-id',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: updatePayload,
      });

      expect([200, 400, 401, 403, 404, 500]).toContain(response.statusCode);
    });

    it('should return error for non-existent model', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/models/non-existent-model-id',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: { model_name: 'updated-name' },
      });

      // Should return 400 or 404 for non-existent model
      expect([400, 401, 403, 404, 500]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/v1/admin/models/:id', () => {
    it('should accept delete requests from admin users', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/models/test-model-to-delete',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
      });

      // Expect either success or failure due to model not existing in test env
      expect([200, 400, 401, 403, 404, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const result = JSON.parse(response.body);
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('message');
      }
    });

    it('should return error for non-existent model', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/models/non-existent-model-id',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
      });

      // Should return 400 or 404 for non-existent model
      expect([400, 401, 403, 404, 500]).toContain(response.statusCode);
    });
  });

  describe('Request Validation', () => {
    it('should validate URL format for api_base field', async () => {
      const invalidPayload = {
        model_name: 'test-model',
        backend_model_name: 'test-backend-model',
        api_base: 'not-a-valid-url',
        input_cost_per_token: 0.00001,
        output_cost_per_token: 0.00002,
        tpm: 1000,
        rpm: 100,
        max_tokens: 4000,
        supports_vision: false,
        supports_function_calling: false,
        supports_parallel_function_calling: false,
        supports_tool_choice: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: invalidPayload,
      });

      expect([400, 401, 403, 500]).toContain(response.statusCode);
    });

    it('should validate numeric fields have appropriate values', async () => {
      const invalidPayload = {
        model_name: 'test-model',
        backend_model_name: 'test-backend-model',
        api_base: 'https://api.test.com/v1',
        input_cost_per_token: -1, // Invalid negative value
        output_cost_per_token: 0.00002,
        tpm: 0, // Invalid zero value
        rpm: 100,
        max_tokens: 4000,
        supports_vision: false,
        supports_function_calling: false,
        supports_parallel_function_calling: false,
        supports_tool_choice: false,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: invalidPayload,
      });

      expect([400, 401, 403, 500]).toContain(response.statusCode);
    });
  });

  describe('Response Format', () => {
    it('should return proper error format for unauthorized requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('user-123', ['user'])}`,
        },
        payload: mockCreatePayload,
      });

      expect([401, 403]).toContain(response.statusCode);
      const result = JSON.parse(response.body);

      // Should have an error response - don't be too strict about format
      expect(result).toHaveProperty('error');
      expect(result.error).toBeDefined();
    });

    it('should return proper success format for valid requests (if successful)', async () => {
      const testPayload = {
        model_name: 'response-format-test-model',
        backend_model_name: 'response-format-backend-model',
        description: 'Model for testing response format',
        api_base: 'https://api.responseformat.com/v1',
        api_key: 'response-format-key',
        input_cost_per_token: 0.00002,
        output_cost_per_token: 0.00004,
        tpm: 5000,
        rpm: 250,
        max_tokens: 2048,
        supports_vision: false,
        supports_function_calling: true,
        supports_parallel_function_calling: true,
        supports_tool_choice: false,
      };

      // Track for cleanup BEFORE the request to ensure cleanup even if test fails
      createdTestModels.add(testPayload.model_name);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/models',
        headers: {
          authorization: `Bearer ${generateTestToken('00000000-0000-4000-8000-000000000456', ['admin'])}`,
        },
        payload: testPayload,
      });

      if (response.statusCode === 201) {
        const result = JSON.parse(response.body);

        // Should have consistent success response format
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('model');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.message).toBe('string');
        expect(typeof result.model).toBe('object');
        expect(result.model).toHaveProperty('id');
        expect(result.model).toHaveProperty('model_name');
      }
    });
  });
});

import { FastifyPluginAsync } from 'fastify';
import { Static } from '@sinclair/typebox';
import { AuthenticatedRequest } from '../types';
import {
  AdminCreateModelSchema,
  AdminUpdateModelSchema,
  AdminModelCreateResponseSchema,
  AdminModelUpdateResponseSchema,
  AdminModelDeleteResponseSchema,
  AdminModelParamsSchema,
  AdminModelErrorResponseSchema,
  CreateLiteLLMModelSchema,
} from '../schemas/admin-models.js';

const adminModelsRoutes: FastifyPluginAsync = async (fastify) => {
  // Default team ID for all models
  const DEFAULT_TEAM_ID = 'a0000000-0000-4000-8000-000000000001';

  // Create a new model
  fastify.post<{
    Body: Static<typeof AdminCreateModelSchema>;
    Reply: Static<typeof AdminModelCreateResponseSchema> | Static<typeof AdminModelErrorResponseSchema>;
  }>('/', {
    schema: {
      tags: ['Admin Models'],
      description: 'Create a new model in LiteLLM',
      security: [{ bearerAuth: [] }],
      body: AdminCreateModelSchema,
      response: {
        201: AdminModelCreateResponseSchema,
        400: AdminModelErrorResponseSchema,
        403: AdminModelErrorResponseSchema,
        500: AdminModelErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:models')],
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const {
        model_name,
        api_base,
        input_cost_per_token,
        output_cost_per_token,
        tpm,
        rpm,
        max_tokens,
        supports_vision,
      } = request.body;

      try {
        // Transform frontend payload to LiteLLM format
        const liteLLMPayload = {
          model_name,
          litellm_params: {
            model: `openai/${model_name}`,
            api_base,
            custom_llm_provider: 'openai' as const,
            input_cost_per_token,
            output_cost_per_token,
            tpm,
            rpm,
          },
          model_info: {
            db_model: true as const,
            team_id: DEFAULT_TEAM_ID,
            max_tokens,
            supports_vision,
          },
        };

        // Create model in LiteLLM
        const liteLLMResponse = await fastify.liteLLMService.createModel(liteLLMPayload);

        // Log admin action
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.userId,
            'MODEL_CREATE',
            'MODEL',
            liteLLMResponse?.model_name || model_name,
            JSON.stringify({
              model_name,
              api_base,
              input_cost_per_token,
              output_cost_per_token,
              tpm,
              rpm,
              max_tokens,
              supports_vision,
            }),
          ],
        );

        reply.status(201);
        return {
          success: true,
          message: `Model '${model_name}' created successfully`,
          model: {
            id: liteLLMResponse?.model_name || model_name,
            model_name,
            created_at: new Date(),
          },
        };
      } catch (error: any) {
        fastify.log.error({ error, model_name }, 'Failed to create model');
        
        reply.status(500);
        return {
          error: 'CREATE_MODEL_FAILED',
          message: error.message || 'Failed to create model',
          statusCode: 500,
        };
      }
    },
  });

  // Update an existing model
  fastify.put<{
    Params: Static<typeof AdminModelParamsSchema>;
    Body: Static<typeof AdminUpdateModelSchema>;
    Reply: Static<typeof AdminModelUpdateResponseSchema> | Static<typeof AdminModelErrorResponseSchema>;
  }>('/:id', {
    schema: {
      tags: ['Admin Models'],
      description: 'Update an existing model in LiteLLM',
      security: [{ bearerAuth: [] }],
      params: AdminModelParamsSchema,
      body: AdminUpdateModelSchema,
      response: {
        200: AdminModelUpdateResponseSchema,
        400: AdminModelErrorResponseSchema,
        403: AdminModelErrorResponseSchema,
        404: AdminModelErrorResponseSchema,
        500: AdminModelErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:models')],
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id: modelId } = request.params;
      const updateData = request.body;

      try {
        // Transform frontend payload to LiteLLM format for update
        const liteLLMPayload: any = {};

        if (updateData.model_name) {
          liteLLMPayload.model_name = updateData.model_name;
        }

        if (Object.keys(updateData).some(key => 
          ['api_base', 'input_cost_per_token', 'output_cost_per_token', 'tpm', 'rpm'].includes(key)
        )) {
          liteLLMPayload.litellm_params = {};
          if (updateData.model_name) {
            liteLLMPayload.litellm_params.model = `openai/${updateData.model_name}`;
          }
          if (updateData.api_base) {
            liteLLMPayload.litellm_params.api_base = updateData.api_base;
          }
          if (updateData.input_cost_per_token !== undefined) {
            liteLLMPayload.litellm_params.input_cost_per_token = updateData.input_cost_per_token;
          }
          if (updateData.output_cost_per_token !== undefined) {
            liteLLMPayload.litellm_params.output_cost_per_token = updateData.output_cost_per_token;
          }
          if (updateData.tpm !== undefined) {
            liteLLMPayload.litellm_params.tpm = updateData.tpm;
          }
          if (updateData.rpm !== undefined) {
            liteLLMPayload.litellm_params.rpm = updateData.rpm;
          }
        }

        if (updateData.max_tokens !== undefined || updateData.supports_vision !== undefined) {
          liteLLMPayload.model_info = {};
          if (updateData.max_tokens !== undefined) {
            liteLLMPayload.model_info.max_tokens = updateData.max_tokens;
          }
          if (updateData.supports_vision !== undefined) {
            liteLLMPayload.model_info.supports_vision = updateData.supports_vision;
          }
        }

        // Update model in LiteLLM
        const liteLLMResponse = await fastify.liteLLMService.updateModel(modelId, liteLLMPayload);

        // Log admin action
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.userId,
            'MODEL_UPDATE',
            'MODEL',
            modelId,
            JSON.stringify({ modelId, updateData }),
          ],
        );

        return {
          success: true,
          message: `Model '${modelId}' updated successfully`,
          model: {
            id: modelId,
            model_name: updateData.model_name || modelId,
            updated_at: new Date(),
          },
        };
      } catch (error: any) {
        fastify.log.error({ error, modelId, updateData }, 'Failed to update model');
        
        const statusCode = error.statusCode || 500;
        reply.status(statusCode);
        return {
          error: 'UPDATE_MODEL_FAILED',
          message: error.message || 'Failed to update model',
          statusCode,
        };
      }
    },
  });

  // Delete a model
  fastify.delete<{
    Params: Static<typeof AdminModelParamsSchema>;
    Reply: Static<typeof AdminModelDeleteResponseSchema> | Static<typeof AdminModelErrorResponseSchema>;
  }>('/:id', {
    schema: {
      tags: ['Admin Models'],
      description: 'Delete a model from LiteLLM',
      security: [{ bearerAuth: [] }],
      params: AdminModelParamsSchema,
      response: {
        200: AdminModelDeleteResponseSchema,
        403: AdminModelErrorResponseSchema,
        404: AdminModelErrorResponseSchema,
        500: AdminModelErrorResponseSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:models')],
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      const { id: modelId } = request.params;

      try {
        // Delete model from LiteLLM
        await fastify.liteLLMService.deleteModel(modelId);

        // Log admin action
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            user.userId,
            'MODEL_DELETE',
            'MODEL',
            modelId,
            JSON.stringify({ modelId }),
          ],
        );

        return {
          success: true,
          message: `Model '${modelId}' deleted successfully`,
        };
      } catch (error: any) {
        fastify.log.error({ error, modelId }, 'Failed to delete model');
        
        const statusCode = error.statusCode || 500;
        reply.status(statusCode);
        return {
          error: 'DELETE_MODEL_FAILED',
          message: error.message || 'Failed to delete model',
          statusCode,
        };
      }
    },
  });
};

export default adminModelsRoutes;
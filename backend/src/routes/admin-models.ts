import { FastifyPluginAsync } from 'fastify';
import { Static } from '@sinclair/typebox';
import { AuthenticatedRequest } from '../types';
import { LiteLLMService } from '../services/litellm.service';
import { ModelSyncService } from '../services/model-sync.service';
import {
  AdminCreateModelSchema,
  AdminUpdateModelSchema,
  AdminModelCreateResponseSchema,
  AdminModelUpdateResponseSchema,
  AdminModelDeleteResponseSchema,
  AdminModelParamsSchema,
  AdminModelErrorResponseSchema,
} from '../schemas/admin-models.js';

interface ModelRow {
  litellm_model_id: string;
}

const adminModelsRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize services
  const liteLLMService = new LiteLLMService(fastify);
  const modelSyncService = new ModelSyncService(fastify);

  // Create a new model
  fastify.post<{
    Body: Static<typeof AdminCreateModelSchema>;
    Reply:
      | Static<typeof AdminModelCreateResponseSchema>
      | Static<typeof AdminModelErrorResponseSchema>;
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
        backend_model_name,
        description,
        api_base,
        api_key,
        input_cost_per_token,
        output_cost_per_token,
        tpm,
        rpm,
        max_tokens,
        supports_vision,
        supports_function_calling,
        supports_parallel_function_calling,
        supports_tool_choice,
      } = request.body;

      try {
        // Transform frontend payload to LiteLLM format
        const liteLLMPayload = {
          model_name,
          litellm_params: {
            model: `openai/${backend_model_name}`,
            api_base,
            custom_llm_provider: 'openai' as const,
            input_cost_per_token,
            output_cost_per_token,
            tpm,
            rpm,
            ...(api_key && { api_key }), // Only include api_key if provided
          },
          model_info: {
            db_model: true as const,
            max_tokens,
            supports_vision,
            supports_function_calling,
            supports_parallel_function_calling,
            supports_tool_choice,
          },
        };

        // Create model in LiteLLM
        const liteLLMResponse = await liteLLMService.createModel(liteLLMPayload);

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
              description,
              api_base,
              input_cost_per_token,
              output_cost_per_token,
              tpm,
              rpm,
              max_tokens,
              supports_vision,
              supports_function_calling,
              supports_parallel_function_calling,
              supports_tool_choice,
            }),
          ],
        );

        // Synchronize models after creation
        try {
          await modelSyncService.syncModels({ forceUpdate: true });

          // Update the description if provided by the user
          if (description) {
            await fastify.dbUtils.query('UPDATE models SET description = $1 WHERE id = $2', [
              description,
              model_name,
            ]);
          }

          fastify.log.info('Model synchronization completed after model creation');
        } catch (syncError) {
          fastify.log.warn({ syncError }, 'Model synchronization failed after model creation');
        }

        reply.status(201);
        return {
          success: true,
          message: `Model '${model_name}' created successfully`,
          model: {
            id: liteLLMResponse?.model_name || model_name,
            model_name,
            created_at: new Date().toISOString(),
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
    Reply:
      | Static<typeof AdminModelUpdateResponseSchema>
      | Static<typeof AdminModelErrorResponseSchema>;
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

        if (
          Object.keys(updateData).some((key) =>
            [
              'backend_model_name',
              'api_base',
              'api_key',
              'input_cost_per_token',
              'output_cost_per_token',
              'tpm',
              'rpm',
            ].includes(key),
          )
        ) {
          liteLLMPayload.litellm_params = {};
          if (updateData.backend_model_name) {
            liteLLMPayload.litellm_params.model = `openai/${updateData.backend_model_name}`;
          } else if (updateData.model_name) {
            // Fallback to model_name for backward compatibility
            liteLLMPayload.litellm_params.model = `openai/${updateData.model_name}`;
          }
          if (updateData.api_base) {
            liteLLMPayload.litellm_params.api_base = updateData.api_base;
          }
          if (updateData.api_key) {
            liteLLMPayload.litellm_params.api_key = updateData.api_key;
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

        if (
          updateData.max_tokens !== undefined ||
          updateData.supports_vision !== undefined ||
          updateData.supports_function_calling !== undefined ||
          updateData.supports_parallel_function_calling !== undefined ||
          updateData.supports_tool_choice !== undefined
        ) {
          liteLLMPayload.model_info = {};
          if (updateData.max_tokens !== undefined) {
            liteLLMPayload.model_info.max_tokens = updateData.max_tokens;
          }
          if (updateData.supports_vision !== undefined) {
            liteLLMPayload.model_info.supports_vision = updateData.supports_vision;
          }
          if (updateData.supports_function_calling !== undefined) {
            liteLLMPayload.model_info.supports_function_calling =
              updateData.supports_function_calling;
          }
          if (updateData.supports_parallel_function_calling !== undefined) {
            liteLLMPayload.model_info.supports_parallel_function_calling =
              updateData.supports_parallel_function_calling;
          }
          if (updateData.supports_tool_choice !== undefined) {
            liteLLMPayload.model_info.supports_tool_choice = updateData.supports_tool_choice;
          }
        }

        // Get the LiteLLM model ID from the database
        const modelRecord = await fastify.dbUtils.queryOne<ModelRow>(
          `SELECT litellm_model_id FROM models WHERE id = $1`,
          [modelId],
        );

        if (!modelRecord || !modelRecord.litellm_model_id) {
          reply.status(400);
          return {
            error: 'INVALID_MODEL',
            message: `Model '${modelId}' not found or missing LiteLLM model ID`,
            statusCode: 400,
          };
        }

        // Update model in LiteLLM using the correct LiteLLM model ID
        await liteLLMService.updateModel(modelRecord.litellm_model_id, liteLLMPayload);

        // Log admin action
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.userId, 'MODEL_UPDATE', 'MODEL', modelId, JSON.stringify({ modelId, updateData })],
        );

        // Synchronize models after update
        try {
          await modelSyncService.syncModels({ forceUpdate: true });

          // Update the description if provided by the user
          if (updateData.description !== undefined) {
            await fastify.dbUtils.query('UPDATE models SET description = $1 WHERE id = $2', [
              updateData.description,
              modelId,
            ]);
          }

          // Update the backend_model_name if provided by the user
          if (updateData.backend_model_name !== undefined) {
            await fastify.dbUtils.query('UPDATE models SET backend_model_name = $1 WHERE id = $2', [
              updateData.backend_model_name,
              modelId,
            ]);
          }

          fastify.log.info('Model synchronization completed after model update');
        } catch (syncError) {
          fastify.log.warn({ syncError }, 'Model synchronization failed after model update');
        }

        return {
          success: true,
          message: `Model '${modelId}' updated successfully`,
          model: {
            id: modelId,
            model_name: updateData.model_name || modelId,
            updated_at: new Date().toISOString(),
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
    Reply:
      | Static<typeof AdminModelDeleteResponseSchema>
      | Static<typeof AdminModelErrorResponseSchema>;
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
        // Get the LiteLLM model ID from the database
        const modelRecord = await fastify.dbUtils.queryOne<ModelRow>(
          `SELECT litellm_model_id FROM models WHERE id = $1`,
          [modelId],
        );

        if (!modelRecord || !modelRecord.litellm_model_id) {
          reply.status(400);
          return {
            error: 'INVALID_MODEL',
            message: `Model '${modelId}' not found or missing LiteLLM model ID`,
            statusCode: 400,
          };
        }

        // Delete model from LiteLLM using the correct LiteLLM model ID
        await liteLLMService.deleteModel(modelRecord.litellm_model_id);

        // Log admin action
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.userId, 'MODEL_DELETE', 'MODEL', modelId, JSON.stringify({ modelId })],
        );

        // Synchronize models after deletion
        try {
          await modelSyncService.syncModels({ forceUpdate: true });
          fastify.log.info('Model synchronization completed after model deletion');
        } catch (syncError) {
          fastify.log.warn({ syncError }, 'Model synchronization failed after model deletion');
        }

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

import { FastifyPluginAsync } from 'fastify';
import { ModelListParams, PaginatedResponse, Model, ModelDetails, AuthenticatedRequest } from '../types';
import { LiteLLMModel } from '../types/model.types';
import { LiteLLMService } from '../services/litellm.service';

const modelsRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize LiteLLM service
  const liteLLMService = new LiteLLMService(fastify);
  
  // Helper function to convert LiteLLM model to our Model format
  const convertLiteLLMModel = (model: LiteLLMModel): Model => {
    const capabilities: string[] = [];
    
    if (model.model_info.supports_function_calling) capabilities.push('function_calling');
    if (model.model_info.supports_parallel_function_calling) capabilities.push('parallel_function_calling');
    if (model.model_info.supports_vision) capabilities.push('vision');
    capabilities.push('chat'); // Assume all models support chat
    
    // Extract provider from litellm_params or model name
    const getProvider = () => {
      if (model.litellm_params.custom_llm_provider) {
        return model.litellm_params.custom_llm_provider;
      }
      if (model.litellm_params.model?.includes('/')) {
        return model.litellm_params.model.split('/')[0];
      }
      return 'unknown';
    };
    
    const provider = getProvider();
    
    const result: Model = {
      id: model.model_name,
      name: model.model_name,
      provider,
      description: `${model.model_name} model`,
      capabilities,
      isActive: model.model_info.direct_access ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Only set contextLength if it's actually provided
    if (model.model_info.max_tokens) {
      result.contextLength = model.model_info.max_tokens;
    }

    // Only set pricing if cost information is available
    const inputCost = model.model_info.input_cost_per_token ?? model.litellm_params.input_cost_per_token;
    const outputCost = model.model_info.output_cost_per_token ?? model.litellm_params.output_cost_per_token;
    
    if (inputCost !== undefined || outputCost !== undefined) {
      result.pricing = {
        input: inputCost || 0,
        output: outputCost || 0,
        unit: 'per_1k_tokens' as const
      };
    }

    return result;
  };
  
  const convertToModelDetails = (model: LiteLLMModel): ModelDetails => {
    const baseModel = convertLiteLLMModel(model);
    return {
      ...baseModel,
      metadata: {
        modelInfoId: model.model_info.id,
        litellmProvider: model.litellm_params.custom_llm_provider,
        apiBase: model.litellm_params.api_base,
        modelPath: model.litellm_params.model,
        maxTokens: model.model_info.max_tokens,
        supportsFunctionCalling: model.model_info.supports_function_calling,
        supportsParallelFunctionCalling: model.model_info.supports_parallel_function_calling,
        supportsVision: model.model_info.supports_vision,
        supportsAssistantApi: model.model_info.supports_assistant_api,
        accessGroups: model.model_info.access_groups,
        accessViaTeamIds: model.model_info.access_via_team_ids,
      },
    };
  };
  // List models
  fastify.get<{
    Querystring: ModelListParams;
    Reply: PaginatedResponse<Model>;
  }>('/', {
    schema: {
      tags: ['Models'],
      description: 'List available models',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          provider: { type: 'string' },
          capability: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  provider: { type: 'string' },
                  description: { type: 'string' },
                  capabilities: { type: 'array', items: { type: 'string' } },
                  contextLength: { type: 'number' },
                  pricing: {
                    type: 'object',
                    properties: {
                      input: { type: 'number' },
                      output: { type: 'number' },
                      unit: { type: 'string' },
                    },
                  },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { page = 1, limit = 20, search, provider, capability, isActive } = request.query;
      
      try {
        // Get models from LiteLLM
        const liteLLMModels = await liteLLMService.getModels();
        
        // Convert to our model format
        let models = liteLLMModels.map(convertLiteLLMModel);
        
        // Apply filters
        if (search) {
          const searchLower = search.toLowerCase();
          models = models.filter(model => 
            model.name.toLowerCase().includes(searchLower) ||
            model.provider.toLowerCase().includes(searchLower) ||
            model.description?.toLowerCase().includes(searchLower)
          );
        }
        
        if (provider) {
          models = models.filter(model => model.provider.toLowerCase() === provider.toLowerCase());
        }
        
        if (capability) {
          models = models.filter(model => model.capabilities.includes(capability));
        }
        
        // Note: isActive filter would require additional data about model availability
        // For now, we assume all models from LiteLLM are active
        
        // Apply pagination
        const total = models.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const paginatedModels = models.slice(offset, offset + limit);
        
        fastify.log.info({
          total,
          page,
          limit,
          filters: { search, provider, capability, isActive },
        }, 'Models retrieved successfully');
        
        return {
          data: paginatedModels,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to retrieve models');
        throw fastify.createError(500, 'Failed to retrieve models');
      }
    },
  });

  // Get model details
  fastify.get<{
    Params: { id: string };
    Reply: ModelDetails;
  }>('/:id', {
    schema: {
      tags: ['Models'],
      description: 'Get model details',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            provider: { type: 'string' },
            description: { type: 'string' },
            capabilities: { type: 'array', items: { type: 'string' } },
            contextLength: { type: 'number' },
            pricing: {
              type: 'object',
              properties: {
                input: { type: 'number' },
                output: { type: 'number' },
                unit: { type: 'string' },
              },
            },
            metadata: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      
      try {
        const model = await liteLLMService.getModelById(id);
        
        if (!model) {
          throw fastify.createNotFoundError('Model');
        }
        
        const modelDetails = convertToModelDetails(model);
        
        fastify.log.info({ modelId: id }, 'Model details retrieved successfully');
        
        return modelDetails;
      } catch (error) {
        fastify.log.error(error, 'Failed to retrieve model details');
        
        if (error && typeof error === 'object' && 'statusCode' in error) {
          throw error;
        }
        
        throw fastify.createError(500, 'Failed to retrieve model details');
      }
    },
  });

  // Refresh models cache (admin only)
  fastify.post('/refresh', {
    schema: {
      tags: ['Models'],
      description: 'Refresh models cache from LiteLLM',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            modelsCount: { type: 'number' },
            refreshedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('models:write')],
    handler: async (request, reply) => {
      const user = (request as AuthenticatedRequest).user;
      
      try {
        // Clear cache and fetch fresh models
        await liteLLMService.clearCache('models');
        const models = await liteLLMService.getModels({ refresh: true });
        
        // Create audit log
        await fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
           VALUES ($1, $2, $3, $4)`,
          [
            user.userId,
            'MODELS_REFRESH',
            'MODEL',
            { modelsCount: models.length },
          ]
        );
        
        fastify.log.info({
          userId: user.userId,
          modelsCount: models.length,
        }, 'Models cache refreshed');
        
        return {
          message: 'Models cache refreshed successfully',
          modelsCount: models.length,
          refreshedAt: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error(error, 'Failed to refresh models cache');
        throw fastify.createError(500, 'Failed to refresh models cache');
      }
    },
  });

  // Get models by provider
  fastify.get('/providers', {
    schema: {
      tags: ['Models'],
      description: 'Get available model providers',
      response: {
        200: {
          type: 'object',
          properties: {
            providers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  modelCount: { type: 'number' },
                  capabilities: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const liteLLMModels = await liteLLMService.getModels();
        const models = liteLLMModels.map(convertLiteLLMModel);
        
        // Group models by provider
        const providerMap = new Map<string, {
          name: string;
          modelCount: number;
          capabilities: Set<string>;
        }>();
        
        models.forEach(model => {
          const provider = model.provider;
          if (!providerMap.has(provider)) {
            providerMap.set(provider, {
              name: provider,
              modelCount: 0,
              capabilities: new Set(),
            });
          }
          
          const providerData = providerMap.get(provider)!;
          providerData.modelCount++;
          model.capabilities.forEach(cap => providerData.capabilities.add(cap));
        });
        
        const providers = Array.from(providerMap.values()).map(provider => {
          const displayNameMap: Record<string, string> = {
            openai: 'OpenAI',
            anthropic: 'Anthropic',
            google: 'Google',
            vertex_ai: 'Google Vertex AI',
            groq: 'Groq',
            meta: 'Meta',
            unknown: 'Unknown',
          };
          
          return {
            name: provider.name,
            displayName: displayNameMap[provider.name] || provider.name,
            modelCount: provider.modelCount,
            capabilities: Array.from(provider.capabilities),
          };
        }).sort((a, b) => b.modelCount - a.modelCount);
        
        return { providers };
      } catch (error) {
        fastify.log.error(error, 'Failed to retrieve providers');
        throw fastify.createError(500, 'Failed to retrieve providers');
      }
    },
  });

  // Get model capabilities
  fastify.get('/capabilities', {
    schema: {
      tags: ['Models'],
      description: 'Get available model capabilities',
      response: {
        200: {
          type: 'object',
          properties: {
            capabilities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  description: { type: 'string' },
                  modelCount: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const liteLLMModels = await liteLLMService.getModels();
        const models = liteLLMModels.map(convertLiteLLMModel);
        
        const capabilityMap = new Map<string, number>();
        
        models.forEach(model => {
          model.capabilities.forEach(capability => {
            capabilityMap.set(capability, (capabilityMap.get(capability) || 0) + 1);
          });
        });
        
        const capabilityDescriptions: Record<string, string> = {
          chat: 'Conversational AI capabilities',
          function_calling: 'Ability to call external functions',
          parallel_function_calling: 'Ability to call multiple functions simultaneously',
          vision: 'Image and visual content understanding',
        };
        
        const capabilityDisplayNames: Record<string, string> = {
          chat: 'Chat',
          function_calling: 'Function Calling',
          parallel_function_calling: 'Parallel Function Calling',
          vision: 'Vision',
        };
        
        const capabilities = Array.from(capabilityMap.entries()).map(([name, count]) => ({
          name,
          displayName: capabilityDisplayNames[name] || name,
          description: capabilityDescriptions[name] || `${name} capability`,
          modelCount: count,
        })).sort((a, b) => b.modelCount - a.modelCount);
        
        return { capabilities };
      } catch (error) {
        fastify.log.error(error, 'Failed to retrieve capabilities');
        throw fastify.createError(500, 'Failed to retrieve capabilities');
      }
    },
  });
};

export default modelsRoutes;
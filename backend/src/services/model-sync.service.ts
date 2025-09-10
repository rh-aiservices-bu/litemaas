import { FastifyInstance } from 'fastify';
import { LiteLLMService } from './litellm.service';

export interface ModelSyncResult {
  success: boolean;
  totalModels: number;
  newModels: number;
  updatedModels: number;
  unavailableModels: number;
  errors: string[];
  syncedAt: string;
}

export interface ModelSyncOptions {
  forceUpdate?: boolean;
  markUnavailable?: boolean;
}

export class ModelSyncService {
  private fastify: FastifyInstance;
  private litellmService: LiteLLMService;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.litellmService = new LiteLLMService(fastify);
  }

  /**
   * Synchronize models from LiteLLM to the database
   */
  async syncModels(options: ModelSyncOptions = {}): Promise<ModelSyncResult> {
    const { forceUpdate = false, markUnavailable = true } = options;

    const result: ModelSyncResult = {
      success: false,
      totalModels: 0,
      newModels: 0,
      updatedModels: 0,
      unavailableModels: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    try {
      this.fastify.log.info('Starting model synchronization from LiteLLM...');

      // Fetch models from LiteLLM
      const litellmModels = await this.litellmService.getModels();
      result.totalModels = litellmModels.length;

      if (litellmModels.length === 0) {
        result.errors.push('No models received from LiteLLM');
        return result;
      }

      // Get existing models from database
      const existingModels = await this.getExistingModels();
      const existingModelIds = new Set(existingModels.map((m) => m.id));
      const litellmModelIds = new Set(litellmModels.map((m) => m.model_name));

      // Process each LiteLLM model
      for (const litellmModel of litellmModels) {
        try {
          const modelId = litellmModel.model_name;
          if (existingModelIds.has(modelId)) {
            // Update existing model
            const updated = await this.updateModel(litellmModel, forceUpdate);
            if (updated) {
              result.updatedModels++;
            }
          } else {
            // Insert new model
            await this.insertModel(litellmModel);
            result.newModels++;
          }
        } catch (error) {
          this.fastify.log.error(
            { modelId: litellmModel.model_name, error },
            'Failed to sync model',
          );
          result.errors.push(
            `Failed to sync model ${litellmModel.model_name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Mark unavailable models
      if (markUnavailable) {
        const unavailableModelIds = Array.from(existingModelIds).filter(
          (id) => !litellmModelIds.has(id),
        );
        for (const modelId of unavailableModelIds) {
          try {
            await this.markModelUnavailable(modelId);
            result.unavailableModels++;
          } catch (error) {
            this.fastify.log.error({ modelId, error }, 'Failed to mark model as unavailable');
            result.errors.push(
              `Failed to mark model ${modelId} as unavailable: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }

      result.success = result.errors.length === 0;

      this.fastify.log.info(
        {
          result,
        },
        'Model synchronization completed',
      );

      return result;
    } catch (error) {
      this.fastify.log.error(error, 'Model synchronization failed');
      result.errors.push(
        `Synchronization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return result;
    }
  }

  /**
   * Get all existing models from database
   */
  private async getExistingModels(): Promise<any[]> {
    const result = await this.fastify.dbUtils.query(`
      SELECT id, name, provider, updated_at, availability, 
             api_base, tpm, rpm, max_tokens
      FROM models
      ORDER BY id
    `);
    return result.rows;
  }

  /**
   * Insert a new model into the database
   */
  private async insertModel(litellmModel: any): Promise<void> {
    // Convert LiteLLM model format to our database format
    const modelId = litellmModel.model_name;
    const modelName = litellmModel.model_name;

    // Extract provider from custom_llm_provider or model path
    const provider =
      litellmModel.litellm_params?.custom_llm_provider ||
      (litellmModel.litellm_params?.model?.includes('/')
        ? litellmModel.litellm_params.model.split('/')[0]
        : 'unknown');

    // Extract backend model name from litellm_params.model
    // Format is usually "openai/gpt-4-turbo" or "provider/backend_model_name"
    const backendModelName = litellmModel.litellm_params?.model?.includes('/')
      ? litellmModel.litellm_params.model.split('/')[1]
      : litellmModel.litellm_params?.model || null;

    // Don't set a default description for synced models - let users add their own
    const description = null;
    const contextLength = litellmModel.model_info?.max_tokens;
    const inputCostPerToken =
      litellmModel.model_info?.input_cost_per_token ||
      litellmModel.litellm_params?.input_cost_per_token;
    const outputCostPerToken =
      litellmModel.model_info?.output_cost_per_token ||
      litellmModel.litellm_params?.output_cost_per_token;

    // Extract admin-specific fields
    const apiBase = litellmModel.litellm_params?.api_base;
    const tpm = litellmModel.litellm_params?.tpm;
    const rpm = litellmModel.litellm_params?.rpm;
    const maxTokens = litellmModel.model_info?.max_tokens;
    const litellmModelId = litellmModel.model_info?.id;

    // Extract capabilities
    const supportsVision = litellmModel.model_info?.supports_vision || false;
    const supportsFunctionCalling = litellmModel.model_info?.supports_function_calling || false;
    const supportsParallelFunctionCalling =
      litellmModel.model_info?.supports_parallel_function_calling || false;
    const supportsToolChoice = litellmModel.model_info?.supports_tool_choice || false;

    // Build features array
    const features = [];
    if (supportsFunctionCalling) features.push('function_calling');
    if (supportsParallelFunctionCalling) features.push('parallel_function_calling');
    if (supportsToolChoice) features.push('tool_choice');
    if (supportsVision) features.push('vision');
    features.push('chat'); // Assume all models support chat

    await this.fastify.dbUtils.query(
      `
      INSERT INTO models (
        id, name, provider, description, category, context_length,
        input_cost_per_token, output_cost_per_token, supports_vision,
        supports_function_calling, supports_tool_choice,
        supports_parallel_function_calling, supports_streaming,
        features, availability, version, metadata,
        api_base, tpm, rpm, max_tokens, litellm_model_id, backend_model_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    `,
      [
        modelId,
        modelName,
        provider,
        description,
        'Language Model', // Default category
        contextLength,
        inputCostPerToken,
        outputCostPerToken,
        supportsVision,
        supportsFunctionCalling,
        supportsToolChoice,
        supportsParallelFunctionCalling,
        true, // supports_streaming - default to true
        features,
        'available',
        '1.0', // Default version
        JSON.stringify({
          litellm_model_info: litellmModel.model_info,
          litellm_params: litellmModel.litellm_params,
        }),
        apiBase,
        tpm,
        rpm,
        maxTokens,
        litellmModelId,
        backendModelName,
      ],
    );

    this.fastify.log.debug({ modelId, backendModelName }, 'Inserted new model');
  }

  /**
   * Update an existing model in the database
   */
  private async updateModel(litellmModel: any, forceUpdate: boolean = false): Promise<boolean> {
    const modelId = litellmModel.model_name;

    // Extract all the same fields as in insertModel
    const modelName = litellmModel.model_name;
    const provider =
      litellmModel.litellm_params?.custom_llm_provider ||
      (litellmModel.litellm_params?.model?.includes('/')
        ? litellmModel.litellm_params.model.split('/')[0]
        : 'unknown');

    // Extract backend model name from litellm_params.model
    const backendModelName = litellmModel.litellm_params?.model?.includes('/')
      ? litellmModel.litellm_params.model.split('/')[1]
      : litellmModel.litellm_params?.model || null;

    // Don't override existing description during sync - let users manage their own descriptions
    const contextLength = litellmModel.model_info?.max_tokens;
    const inputCostPerToken =
      litellmModel.model_info?.input_cost_per_token ||
      litellmModel.litellm_params?.input_cost_per_token;
    const outputCostPerToken =
      litellmModel.model_info?.output_cost_per_token ||
      litellmModel.litellm_params?.output_cost_per_token;

    const supportsVision = litellmModel.model_info?.supports_vision || false;
    const supportsFunctionCalling = litellmModel.model_info?.supports_function_calling || false;
    const supportsParallelFunctionCalling =
      litellmModel.model_info?.supports_parallel_function_calling || false;
    const supportsToolChoice = litellmModel.model_info?.supports_tool_choice || false;

    const features = [];
    if (supportsFunctionCalling) features.push('function_calling');
    if (supportsParallelFunctionCalling) features.push('parallel_function_calling');
    if (supportsToolChoice) features.push('tool_choice');
    if (supportsVision) features.push('vision');
    features.push('chat');

    // Check if update is needed
    if (!forceUpdate) {
      const existing = await this.fastify.dbUtils.queryOne(
        `
        SELECT input_cost_per_token, output_cost_per_token, availability, 
               context_length, supports_vision, supports_function_calling,
               supports_tool_choice, supports_parallel_function_calling,
               supports_streaming, features, version, metadata,
               api_base, tpm, rpm, max_tokens, description, backend_model_name
        FROM models WHERE id = $1
      `,
        [modelId],
      );

      if (existing && this.modelsEqual(existing, litellmModel)) {
        return false; // No update needed
      }
    }

    // Extract admin-specific fields (same as in insertModel)
    const apiBase = litellmModel.litellm_params?.api_base;
    const tpm = litellmModel.litellm_params?.tpm;
    const rpm = litellmModel.litellm_params?.rpm;
    const maxTokens = litellmModel.model_info?.max_tokens;
    const litellmModelId = litellmModel.model_info?.id;

    // Get existing model to preserve user-set description and backend_model_name
    const existing = await this.fastify.dbUtils.queryOne(
      `SELECT description, backend_model_name FROM models WHERE id = $1`,
      [modelId],
    );
    const preservedDescription = existing?.description || null;
    // Only update backend_model_name if it's not already set (preserve user-set values)
    const finalBackendModelName = existing?.backend_model_name || backendModelName;

    await this.fastify.dbUtils.query(
      `
      UPDATE models SET
        name = $2,
        provider = $3,
        description = COALESCE($4, description),
        category = $5,
        context_length = $6,
        input_cost_per_token = $7,
        output_cost_per_token = $8,
        supports_vision = $9,
        supports_function_calling = $10,
        supports_tool_choice = $11,
        supports_parallel_function_calling = $12,
        supports_streaming = $13,
        features = $14,
        availability = $15,
        version = $16,
        metadata = $17,
        api_base = $18,
        tpm = $19,
        rpm = $20,
        max_tokens = $21,
        litellm_model_id = $22,
        backend_model_name = $23,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
      [
        modelId,
        modelName,
        provider,
        preservedDescription,
        'Language Model',
        contextLength,
        inputCostPerToken,
        outputCostPerToken,
        supportsVision,
        supportsFunctionCalling,
        supportsToolChoice,
        supportsParallelFunctionCalling,
        true, // supports_streaming
        features,
        'available',
        '1.0',
        JSON.stringify({
          litellm_model_info: litellmModel.model_info,
          litellm_params: litellmModel.litellm_params,
        }),
        apiBase,
        tpm,
        rpm,
        maxTokens,
        litellmModelId,
        finalBackendModelName,
      ],
    );

    this.fastify.log.debug(
      { modelId, backendModelName: finalBackendModelName },
      'Updated existing model',
    );
    return true;
  }

  /**
   * Mark a model as unavailable
   */
  private async markModelUnavailable(modelId: string): Promise<void> {
    await this.fastify.dbUtils.query(
      `
      UPDATE models 
      SET availability = 'unavailable', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND availability != 'unavailable'
    `,
      [modelId],
    );

    this.fastify.log.debug({ modelId }, 'Marked model as unavailable');
  }

  /**
   * Compare models to determine if update is needed
   */
  private modelsEqual(existing: any, litellmModel: any): boolean {
    // Extract pricing from LiteLLM model
    const inputCostPerToken =
      litellmModel.model_info?.input_cost_per_token ||
      litellmModel.litellm_params?.input_cost_per_token;
    const outputCostPerToken =
      litellmModel.model_info?.output_cost_per_token ||
      litellmModel.litellm_params?.output_cost_per_token;

    const existingPrice = {
      input: parseFloat(existing.input_cost_per_token || '0'),
      output: parseFloat(existing.output_cost_per_token || '0'),
    };

    const newPrice = {
      input: parseFloat(inputCostPerToken || '0'),
      output: parseFloat(outputCostPerToken || '0'),
    };

    // Extract capabilities from LiteLLM model
    const supportsVision = litellmModel.model_info?.supports_vision || false;
    const supportsFunctionCalling = litellmModel.model_info?.supports_function_calling || false;
    const supportsParallelFunctionCalling =
      litellmModel.model_info?.supports_parallel_function_calling || false;
    const supportsToolChoice = litellmModel.model_info?.supports_tool_choice || false;

    // Build expected features
    const expectedFeatures = [];
    if (supportsFunctionCalling) expectedFeatures.push('function_calling');
    if (supportsParallelFunctionCalling) expectedFeatures.push('parallel_function_calling');
    if (supportsToolChoice) expectedFeatures.push('tool_choice');
    if (supportsVision) expectedFeatures.push('vision');
    expectedFeatures.push('chat');

    // Extract admin fields from LiteLLM model
    const apiBase = litellmModel.litellm_params?.api_base;
    const tpm = litellmModel.litellm_params?.tpm;
    const rpm = litellmModel.litellm_params?.rpm;
    const maxTokens = litellmModel.model_info?.max_tokens;

    return (
      existing.availability === 'available' &&
      existing.context_length === (litellmModel.model_info?.max_tokens || null) &&
      Math.abs(existingPrice.input - newPrice.input) < 0.0000000001 &&
      Math.abs(existingPrice.output - newPrice.output) < 0.0000000001 &&
      existing.supports_vision === supportsVision &&
      existing.supports_function_calling === supportsFunctionCalling &&
      existing.supports_tool_choice === supportsToolChoice &&
      existing.supports_parallel_function_calling === supportsParallelFunctionCalling &&
      existing.supports_streaming === true && // We always set this to true
      JSON.stringify(existing.features || []) === JSON.stringify(expectedFeatures) &&
      existing.version === '1.0' && // We always set this to 1.0
      // Compare admin fields
      existing.api_base === (apiBase || null) &&
      existing.tpm === (tpm || null) &&
      existing.rpm === (rpm || null) &&
      existing.max_tokens === (maxTokens || null)
    );
  }

  /**
   * Get synchronization statistics
   */
  async getSyncStats(): Promise<{
    totalModels: number;
    availableModels: number;
    unavailableModels: number;
    lastSyncAt?: string;
  }> {
    const stats = await this.fastify.dbUtils.queryOne(`
      SELECT 
        COUNT(*) as total_models,
        COUNT(*) FILTER (WHERE availability = 'available') as available_models,
        COUNT(*) FILTER (WHERE availability = 'unavailable') as unavailable_models,
        MAX(updated_at) as last_sync_at
      FROM models
    `);

    return {
      totalModels: parseInt(String(stats?.total_models || '0')),
      availableModels: parseInt(String(stats?.available_models || '0')),
      unavailableModels: parseInt(String(stats?.unavailable_models || '0')),
      lastSyncAt: stats?.last_sync_at ? String(stats.last_sync_at) : undefined,
    };
  }

  /**
   * Validate model integrity
   */
  async validateModels(): Promise<{
    validModels: number;
    invalidModels: string[];
    orphanedSubscriptions: number;
  }> {
    // Check for models with missing required fields
    const invalidModels = await this.fastify.dbUtils.queryMany(`
      SELECT id, name FROM models 
      WHERE name IS NULL OR provider IS NULL
    `);

    // Check for subscriptions referencing unavailable models
    const orphanedSubscriptions = await this.fastify.dbUtils.queryOne(`
      SELECT COUNT(*) as count FROM subscriptions s
      JOIN models m ON s.model_id = m.id
      WHERE m.availability = 'unavailable' AND s.status = 'active'
    `);

    const totalModels = await this.fastify.dbUtils.queryOne(`
      SELECT COUNT(*) as count FROM models
    `);

    return {
      validModels: parseInt(String(totalModels?.count || '0')) - invalidModels.length,
      invalidModels: invalidModels.map((m) => `${m.id} (${m.name})`),
      orphanedSubscriptions: parseInt(String(orphanedSubscriptions?.count || '0')),
    };
  }
}

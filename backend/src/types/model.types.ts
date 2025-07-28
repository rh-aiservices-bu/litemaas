export interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string;
  capabilities: string[];
  contextLength?: number;
  pricing?: ModelPricing;
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelPricing {
  input: number;
  output: number;
  unit: 'per_1k_tokens' | 'per_request' | 'per_minute';
}

export interface ModelDetails extends Model {
  metadata: {
    version?: string;
    releaseDate?: string;
    deprecationDate?: string;
    [key: string]: any;
  };
}

export interface CreateModelDto {
  id: string;
  name: string;
  provider: string;
  description?: string;
  capabilities?: string[];
  contextLength?: number;
  pricing?: ModelPricing;
  metadata?: Record<string, any>;
}

export interface UpdateModelDto {
  name?: string;
  description?: string;
  capabilities?: string[];
  contextLength?: number;
  pricing?: ModelPricing;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export interface ModelListParams {
  page?: number;
  limit?: number;
  search?: string;
  provider?: string;
  capability?: string;
  isActive?: boolean;
}

export interface LiteLLMModel {
  model_name: string;
  litellm_params: {
    input_cost_per_token: number;
    output_cost_per_token: number;
    api_base?: string;
    custom_llm_provider?: string;
    use_in_pass_through?: boolean;
    use_litellm_proxy?: boolean;
    merge_reasoning_content_in_choices?: boolean;
    model?: string;
    [key: string]: any;
  };
  model_info: {
    id: string;
    db_model?: boolean;
    max_tokens?: number;
    access_groups?: string[];
    direct_access?: boolean;
    supports_vision?: boolean;
    supports_function_calling?: boolean;
    supports_parallel_function_calling?: boolean;
    supports_assistant_api?: boolean;
    access_via_team_ids?: string[];
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    [key: string]: any;
  };
}

/**
 * Enhanced model interface that combines LiteMaaS model data with LiteLLM information
 */
export interface EnhancedModel extends Model {
  // LiteLLM integration fields
  liteLLMInfo?: {
    id: string; // LiteLLM model ID
    object: string;
    created: number;
    owned_by: string;
    litellm_provider?: string;
    source?: string;
    supports_function_calling?: boolean;
    supports_parallel_function_calling?: boolean;
    supports_vision?: boolean;
    supports_assistant_api?: boolean;
  };

  // Sync metadata
  lastSyncAt?: Date;
  syncStatus?: 'synced' | 'pending' | 'error';
  syncError?: string;
}

/**
 * Request/response types for LiteLLM model operations
 */
export interface LiteLLMModelListResponse {
  object: 'list';
  data: LiteLLMModel[];
}

export interface ModelSyncRequest {
  forceSync?: boolean;
  provider?: string;
  includeInactive?: boolean;
}

export interface ModelSyncResponse {
  syncedCount: number;
  errorCount: number;
  errors?: Array<{
    modelId: string;
    error: string;
  }>;
  lastSyncAt: Date;
}

/**
 * LiteLLM service configuration
 */
export interface LiteLLMConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableMocking: boolean;
}

/**
 * LiteLLM health check response
 */
export interface LiteLLMHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  db?: 'connected' | 'disconnected' | 'unknown';
  redis?: 'connected' | 'disconnected' | 'unknown';
  litellm_version?: string;
}

/**
 * LiteLLM error response
 */
export interface LiteLLMError {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
  detail?: string;
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  user?: string;
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

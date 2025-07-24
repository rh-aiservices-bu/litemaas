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
  // Standard OpenAI-compatible fields
  id: string;
  object: string;
  created: number;
  owned_by: string;
  
  // LiteLLM-specific extensions
  litellm_provider?: string;
  source?: string;
  max_tokens?: number;
  supports_function_calling?: boolean;
  supports_parallel_function_calling?: boolean;
  supports_vision?: boolean;
  supports_assistant_api?: boolean;
  
  // Cost information (if available)
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  
  // Additional metadata
  [key: string]: any;
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

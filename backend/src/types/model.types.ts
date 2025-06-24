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
    model: string;
    api_key?: string;
    api_base?: string;
    [key: string]: any;
  };
  model_info?: {
    max_tokens?: number;
    max_input_tokens?: number;
    max_output_tokens?: number;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    [key: string]: any;
  };
}
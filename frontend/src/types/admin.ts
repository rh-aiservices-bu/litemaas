export interface LiteLLMModelCreate {
  model_name: string;
  api_base: string;
  input_cost_per_token: number;
  output_cost_per_token: number;
  tpm: number;  // tokens per minute
  rpm: number;  // requests per minute
  max_tokens: number;
  supports_vision: boolean;
}

export interface LiteLLMModelUpdate extends Partial<LiteLLMModelCreate> {}

export interface AdminModelResponse {
  success: boolean;
  message: string;
  model?: {
    id: string;
    model_name: string;
    created_at?: string;
    updated_at?: string;
  };
}

export interface AdminModelError {
  error: string;
  message: string;
  statusCode: number;
}

export interface LiteLLMModelDisplay {
  id: string;
  model_name: string;
  provider: string;
  api_base?: string;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  tpm?: number;
  rpm?: number;
  max_tokens?: number;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminModelFormData {
  model_name: string;
  api_base: string;
  input_cost_per_token: number;
  output_cost_per_token: number;
  tpm: number;
  rpm: number;
  max_tokens: number;
  supports_vision: boolean;
}

export interface AdminModelFormErrors {
  model_name?: string;
  api_base?: string;
  input_cost_per_token?: string;
  output_cost_per_token?: string;
  tpm?: string;
  rpm?: string;
  max_tokens?: string;
}
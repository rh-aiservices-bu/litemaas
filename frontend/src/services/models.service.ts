import { apiClient } from './api';

export interface Model {
  id: string;
  model_name: string;
  display_name: string;
  description?: string;
  provider: string;
  model_info: {
    mode: string;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
    max_tokens?: number;
    base_model?: string;
    supports_functions?: boolean;
    supports_vision?: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface ModelsResponse {
  models: Model[];
  total: number;
  page: number;
  limit: number;
}

class ModelsService {
  async getModels(page = 1, limit = 20, search?: string): Promise<ModelsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    return apiClient.get<ModelsResponse>(`/models?${params}`);
  }

  async getModel(modelId: string): Promise<Model> {
    return apiClient.get<Model>(`/models/${modelId}`);
  }

  async refreshModels(): Promise<void> {
    return apiClient.post('/models/refresh');
  }
}

export const modelsService = new ModelsService();

import { apiClient } from './api';

// Backend API Model interface
export interface BackendModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  contextLength: number;
  pricing: {
    input: number;
    output: number;
    unit: string;
  };
}

// Frontend Model interface (matching what components expect)
export interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: string;
  contextLength: number;
  pricing: {
    input: number;
    output: number;
  };
  features: string[];
  availability: 'available' | 'limited' | 'unavailable';
  version: string;
}

export interface ModelsResponse {
  data: BackendModel[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProvidersResponse {
  providers: {
    name: string;
    displayName: string;
    modelCount: number;
    capabilities: string[];
  }[];
}

export interface CapabilitiesResponse {
  capabilities: {
    name: string;
    displayName: string;
    description: string;
    modelCount: number;
  }[];
}

class ModelsService {
  // Helper function to convert backend model to frontend model
  private convertBackendModel(backendModel: BackendModel): Model {
    // Map capabilities to features
    const featureMap: Record<string, string> = {
      chat: 'Chat',
      function_calling: 'Function Calling',
      parallel_function_calling: 'Parallel Functions',
      vision: 'Vision',
    };

    const features = backendModel.capabilities.map((cap) => featureMap[cap] || cap);

    // Determine category based on capabilities
    let category = 'Language Model';
    if (backendModel.capabilities.includes('vision')) {
      category = 'Multimodal';
    } else if (
      backendModel.name.toLowerCase().includes('image') ||
      backendModel.name.toLowerCase().includes('dall') ||
      backendModel.name.toLowerCase().includes('diffusion')
    ) {
      category = 'Image Generation';
    } else if (
      backendModel.name.toLowerCase().includes('whisper') ||
      backendModel.name.toLowerCase().includes('audio')
    ) {
      category = 'Audio';
    }

    // Determine availability (simplified logic)
    const availability: 'available' | 'limited' | 'unavailable' = 'available';

    // Extract version from model name (simplified)
    const versionMatch = backendModel.name.match(/(\d+(?:\.\d+)*)/);
    const version = versionMatch ? versionMatch[1] : '1.0';

    return {
      id: backendModel.id,
      name: backendModel.name,
      provider: backendModel.provider,
      description: backendModel.description,
      category,
      contextLength: backendModel.contextLength,
      pricing: {
        input: backendModel.pricing?.input || 0,
        output: backendModel.pricing?.output || 0,
      },
      features,
      availability,
      version,
    };
  }

  async getModels(
    page = 1,
    limit = 20,
    search?: string,
    provider?: string,
    capability?: string,
  ): Promise<{ models: Model[]; pagination: ModelsResponse['pagination'] }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    if (provider && provider !== 'all') {
      params.append('provider', provider);
    }

    if (capability && capability !== 'all') {
      params.append('capability', capability);
    }

    const response = await apiClient.get<ModelsResponse>(`/models?${params}`);

    return {
      models: response.data.map(this.convertBackendModel),
      pagination: response.pagination,
    };
  }

  async getModel(modelId: string): Promise<Model> {
    const backendModel = await apiClient.get<BackendModel>(`/models/${modelId}`);
    return this.convertBackendModel(backendModel);
  }

  async getProviders(): Promise<ProvidersResponse> {
    return apiClient.get<ProvidersResponse>('/models/providers');
  }

  async getCapabilities(): Promise<CapabilitiesResponse> {
    return apiClient.get<CapabilitiesResponse>('/models/capabilities');
  }

  async refreshModels(): Promise<void> {
    return apiClient.post('/models/refresh');
  }
}

export const modelsService = new ModelsService();

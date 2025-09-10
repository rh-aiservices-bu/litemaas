import { apiClient } from './api';
import type {
  LiteLLMModelCreate,
  LiteLLMModelUpdate,
  AdminModelResponse,
  AdminModelError,
} from '../types/admin';

export class AdminModelsService {
  private readonly basePath = '/admin/models';

  async createModel(modelData: LiteLLMModelCreate): Promise<AdminModelResponse> {
    try {
      const response = await apiClient.post<AdminModelResponse>(this.basePath, modelData);
      return response;
    } catch (error: any) {
      if (error.response?.data) {
        throw error.response.data as AdminModelError;
      }
      throw {
        error: 'NETWORK_ERROR',
        message: 'Failed to create model. Please check your connection and try again.',
        statusCode: error.response?.status || 500,
      } as AdminModelError;
    }
  }

  async updateModel(modelId: string, modelData: LiteLLMModelUpdate): Promise<AdminModelResponse> {
    try {
      const response = await apiClient.put<AdminModelResponse>(
        `${this.basePath}/${encodeURIComponent(modelId)}`,
        modelData,
      );
      return response;
    } catch (error: any) {
      if (error.response?.data) {
        throw error.response.data as AdminModelError;
      }
      throw {
        error: 'NETWORK_ERROR',
        message: 'Failed to update model. Please check your connection and try again.',
        statusCode: error.response?.status || 500,
      } as AdminModelError;
    }
  }

  async deleteModel(modelId: string): Promise<AdminModelResponse> {
    try {
      const response = await apiClient.delete<AdminModelResponse>(
        `${this.basePath}/${encodeURIComponent(modelId)}`,
      );
      return response;
    } catch (error: any) {
      if (error.response?.data) {
        throw error.response.data as AdminModelError;
      }
      throw {
        error: 'NETWORK_ERROR',
        message: 'Failed to delete model. Please check your connection and try again.',
        statusCode: error.response?.status || 500,
      } as AdminModelError;
    }
  }
}

// Export a singleton instance
export const adminModelsService = new AdminModelsService();

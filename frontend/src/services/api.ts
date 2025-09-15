import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { extractErrorDetails, type ExtractedError } from '../utils/error.utils';

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

/**
 * Enhanced error object with correlation ID and detailed information
 * Compatible with existing ApiError interface but with additional context
 */
export interface EnhancedApiError extends ApiError {
  /** Extracted error details using the new error handling system */
  details?: ExtractedError;
  /** Correlation ID for debugging */
  correlationId?: string;
  /** Request URL that caused the error */
  requestUrl?: string;
  /** HTTP method that caused the error */
  requestMethod?: string;
}

/**
 * Extend the Axios error type to include our enhanced error details
 * This allows TypeScript to recognize the enhancedDetails property
 */
declare module 'axios' {
  export interface AxiosError {
    enhancedDetails?: EnhancedApiError;
  }
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config) => {
        // Check for admin bypass first
        const adminUser = localStorage.getItem('litemaas_admin_user');
        if (adminUser) {
          // For admin bypass, generate a development JWT token
          try {
            const user = JSON.parse(adminUser);
            const tokenResponse = await fetch('/api/auth/dev-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                username: user.username,
                roles: user.roles,
              }),
            });

            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              config.headers.Authorization = `Bearer ${tokenData.access_token}`;
            } else {
              console.warn('Failed to generate dev token, proceeding without auth');
            }
          } catch (error) {
            console.warn('Error generating dev token:', error);
          }
          return config;
        }

        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Extract detailed error information using the new error handling system
        const extractedDetails = extractErrorDetails(error);

        // Create enhanced error object with additional context
        const enhancedError: EnhancedApiError = {
          message: extractedDetails.message,
          statusCode: extractedDetails.statusCode || 0,
          error: extractedDetails.code,
          details: extractedDetails,
          correlationId: extractedDetails.requestId,
          requestUrl: error.config?.url,
          requestMethod: error.config?.method?.toUpperCase(),
        };

        // Development mode logging with structured information
        const isDevelopment =
          import.meta.env?.DEV ||
          process.env.NODE_ENV === 'development' ||
          window.location.hostname === 'localhost';

        if (isDevelopment) {
          console.group('🔌 API Client Error');
          console.error('Request Details:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            correlationId: extractedDetails.requestId,
          });
          console.error('Extracted Error Details:', extractedDetails);
          console.error('Original Axios Error:', error);
          console.groupEnd();
        }

        // Handle 401 Unauthorized responses (preserve existing behavior)
        if (error.response?.status === 401) {
          // Check if this is an admin bypass session
          const adminUser = localStorage.getItem('litemaas_admin_user');
          if (!adminUser) {
            // Only redirect to login if not in admin bypass mode
            localStorage.removeItem('access_token');
            window.location.href = '/login';
          }
        }

        // Attach enhanced error information to the original error object
        // This maintains backward compatibility while providing additional context
        error.enhancedDetails = enhancedError;

        return Promise.reject(error);
      },
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

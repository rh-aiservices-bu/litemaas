import { FastifyInstance } from 'fastify';
import {
  LiteLLMModel,
  LiteLLMHealth,
  LiteLLMError,
  LiteLLMConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '../types/model.types.js';
import {
  LiteLLMKeyGenerationRequest,
  LiteLLMKeyGenerationResponse,
  LiteLLMKeyInfo,
} from '../types/api-key.types.js';
import {
  LiteLLMUserRequest,
  LiteLLMUserResponse,
  LiteLLMTeamRequest,
  LiteLLMTeamResponse,
} from '../types/user.types.js';

export class LiteLLMService {
  private config: LiteLLMConfig;
  private fastify: FastifyInstance;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private isCircuitBreakerOpen = false;
  private circuitBreakerFailureCount = 0;
  private circuitBreakerLastFailureTime = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

  // Mock data for development
  private readonly MOCK_MODELS: LiteLLMModel[] = [
    {
      model_name: 'gpt-4o',
      litellm_params: {
        input_cost_per_token: 0.01,
        output_cost_per_token: 0.03,
        custom_llm_provider: 'openai',
        model: 'openai/gpt-4o',
      },
      model_info: {
        id: 'mock-gpt-4o-id',
        db_model: true,
        max_tokens: 128000,
        supports_function_calling: true,
        supports_parallel_function_calling: true,
        supports_vision: true,
        direct_access: true,
        access_via_team_ids: [],
        input_cost_per_token: 0.01,
        output_cost_per_token: 0.03,
      },
    },
    {
      model_name: 'gpt-4o-mini',
      litellm_params: {
        input_cost_per_token: 0.00015,
        output_cost_per_token: 0.0006,
        custom_llm_provider: 'openai',
        model: 'openai/gpt-4o-mini',
      },
      model_info: {
        id: 'mock-gpt-4o-mini-id',
        db_model: true,
        max_tokens: 128000,
        supports_function_calling: true,
        supports_parallel_function_calling: true,
        supports_vision: true,
        direct_access: true,
        access_via_team_ids: [],
        input_cost_per_token: 0.00015,
        output_cost_per_token: 0.0006,
      },
    },
    {
      model_name: 'claude-3-5-sonnet-20241022',
      litellm_params: {
        input_cost_per_token: 0.003,
        output_cost_per_token: 0.015,
        custom_llm_provider: 'anthropic',
        model: 'anthropic/claude-3-5-sonnet-20241022',
      },
      model_info: {
        id: 'mock-claude-3-5-sonnet-id',
        db_model: true,
        max_tokens: 200000,
        supports_function_calling: true,
        supports_parallel_function_calling: false,
        supports_vision: true,
        direct_access: true,
        access_via_team_ids: [],
        input_cost_per_token: 0.003,
        output_cost_per_token: 0.015,
      },
    },
  ];

  constructor(fastify: FastifyInstance, config?: Partial<LiteLLMConfig>) {
    this.fastify = fastify;
    this.config = {
      baseUrl:
        config?.baseUrl ||
        process.env.LITELLM_API_URL ||
        process.env.LITELLM_BASE_URL ||
        'http://localhost:4000',
      apiKey: config?.apiKey || process.env.LITELLM_API_KEY,
      timeout: config?.timeout || 30000,
      retryAttempts: config?.retryAttempts || 3,
      retryDelay: config?.retryDelay || 1000,
      enableMocking:
        config?.enableMocking ??
        (process.env.NODE_ENV === 'development' &&
          !process.env.LITELLM_API_URL &&
          !process.env.LITELLM_BASE_URL),
    };

    this.fastify.log.info(
      {
        baseUrl: this.config.baseUrl,
        enableMocking: this.config.enableMocking,
        timeout: this.config.timeout,
      },
      'LiteLLM service initialized',
    );
  }

  private getCacheKey(key: string): string {
    return `litellm:${key}`;
  }

  private setCache(key: string, data: any, ttl: number = this.DEFAULT_CACHE_TTL): void {
    const cacheKey = this.getCacheKey(key);
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private getCache<T>(key: string): T | null {
    const cacheKey = this.getCacheKey(key);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data as T;
  }

  private clearCacheInternal(pattern?: string): void {
    if (pattern) {
      const keys = Array.from(this.cache.keys()).filter((key) => key.includes(pattern));
      keys.forEach((key) => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  private isCircuitBreakerTripped(): boolean {
    if (!this.isCircuitBreakerOpen) {
      return false;
    }

    if (Date.now() - this.circuitBreakerLastFailureTime > this.CIRCUIT_BREAKER_TIMEOUT) {
      this.fastify.log.info('Circuit breaker timeout expired, attempting to close');
      this.isCircuitBreakerOpen = false;
      this.circuitBreakerFailureCount = 0;
      return false;
    }

    return true;
  }

  private recordSuccess(): void {
    this.circuitBreakerFailureCount = 0;
    this.isCircuitBreakerOpen = false;
  }

  private recordFailure(): void {
    this.circuitBreakerFailureCount++;
    this.circuitBreakerLastFailureTime = Date.now();

    if (this.circuitBreakerFailureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.isCircuitBreakerOpen = true;
      this.fastify.log.warn(
        {
          failureCount: this.circuitBreakerFailureCount,
          threshold: this.CIRCUIT_BREAKER_THRESHOLD,
        },
        'Circuit breaker opened due to consecutive failures',
      );
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    if (this.isCircuitBreakerTripped()) {
      throw new Error('Circuit breaker is open - LiteLLM service unavailable');
    }

    const { method = 'GET', body, headers = {} } = options;

    const url = `${this.config.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.config.apiKey) {
      requestHeaders['x-litellm-api-key'] = this.config.apiKey;
    }

    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.fastify.log.debug(
          {
            url,
            method,
            attempt,
            maxAttempts: this.config.retryAttempts,
          },
          'Making request to LiteLLM',
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = (await response.json()) as LiteLLMError;
          throw new Error(
            `LiteLLM API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`,
          );
        }

        const data = await response.json();
        this.recordSuccess();

        this.fastify.log.debug(
          {
            url,
            method,
            status: response.status,
            attempt,
          },
          'LiteLLM request successful',
        );

        return data as T;
      } catch (error) {
        lastError = error as Error;

        this.fastify.log.warn(
          {
            url,
            method,
            attempt,
            maxAttempts: this.config.retryAttempts,
            error: lastError.message,
          },
          'LiteLLM request failed',
        );

        if (attempt < this.config.retryAttempts) {
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    this.recordFailure();
    throw lastError!;
  }

  private createMockResponse<T>(data: T): Promise<T> {
    const delay = Math.random() * 100 + 50; // 50-150ms
    return new Promise((resolve) => setTimeout(() => resolve(data), delay));
  }

  // Enhanced Model Management
  async getModels(options: { refresh?: boolean; teamId?: string } = {}): Promise<LiteLLMModel[]> {
    const cacheKey = `models:${options.teamId || 'default'}`;

    if (!options.refresh) {
      const cached = this.getCache<LiteLLMModel[]>(cacheKey);
      if (cached) {
        this.fastify.log.debug('Returning cached models');
        return cached;
      }
    }

    if (this.config.enableMocking) {
      this.fastify.log.debug('Using mock models');
      const models = await this.createMockResponse(this.MOCK_MODELS);
      this.setCache(cacheKey, models);
      return models;
    }

    try {
      const queryParams = new URLSearchParams();
      if (options.teamId) {
        queryParams.append('team_id', options.teamId);
      }

      const endpoint = `/model/info${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await this.makeRequest<{ data: LiteLLMModel[] }>(endpoint);
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to fetch models from LiteLLM');

      const cached = this.getCache<LiteLLMModel[]>(cacheKey);
      if (cached) {
        this.fastify.log.warn('Returning stale cached models due to API failure');
        return cached;
      }

      throw error;
    }
  }

  async getModelById(modelId: string): Promise<LiteLLMModel | null> {
    const models = await this.getModels();
    return (
      models.find((model) => model.model_name === modelId || model.model_info.id === modelId) ||
      null
    );
  }

  // Enhanced Health Monitoring
  async getHealth(): Promise<LiteLLMHealth> {
    const cacheKey = 'health';
    const cached = this.getCache<LiteLLMHealth>(cacheKey);

    if (cached) {
      return cached;
    }

    if (this.config.enableMocking) {
      const health: LiteLLMHealth = {
        status: 'healthy',
        db: 'connected',
        redis: 'connected',
        litellm_version: '1.74.3-mock',
      };
      this.setCache(cacheKey, health, 30000);
      return this.createMockResponse(health);
    }

    try {
      const health = await this.makeRequest<LiteLLMHealth>('/health/liveliness');
      this.setCache(cacheKey, health, 30000);
      return health;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to check LiteLLM health');

      const fallbackHealth: LiteLLMHealth = {
        status: 'unhealthy',
        db: 'unknown',
      };

      return fallbackHealth;
    }
  }

  // Enhanced API Key Management
  async generateApiKey(
    request: LiteLLMKeyGenerationRequest,
  ): Promise<LiteLLMKeyGenerationResponse> {
    if (this.config.enableMocking) {
      const mockKey = `sk-litellm-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      const response: LiteLLMKeyGenerationResponse = {
        key: mockKey,
        key_name: request.key_alias || `key-${Date.now()}`,
        user_id: request.user_id || 'mock-user',
        team_id: request.team_id,
        max_budget: request.max_budget || 100,
        current_spend: 0,
        created_by: 'litemaas',
        created_at: new Date().toISOString(),
        expires: request.duration
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
      };

      return this.createMockResponse(response);
    }

    try {
      return await this.makeRequest<LiteLLMKeyGenerationResponse>('/key/generate', {
        method: 'POST',
        body: request,
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to generate API key');
      throw error;
    }
  }

  async getKeyInfo(apiKey: string): Promise<LiteLLMKeyInfo> {
    if (this.config.enableMocking) {
      const mockInfo: LiteLLMKeyInfo = {
        key_name: 'mock-key',
        spend: Math.random() * 50,
        max_budget: 100,
        models: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        tpm_limit: 10000,
        rpm_limit: 100,
        user_id: 'mock-user',
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        budget_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      return this.createMockResponse(mockInfo);
    }

    try {
      return await this.makeRequest<LiteLLMKeyInfo>('/key/info', {
        headers: { 'x-litellm-api-key': apiKey },
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get key info');
      throw error;
    }
  }

  async updateKey(apiKey: string, updates: Partial<LiteLLMKeyGenerationRequest>): Promise<void> {
    if (this.config.enableMocking) {
      return this.createMockResponse(undefined);
    }

    try {
      await this.makeRequest('/key/update', {
        method: 'POST',
        body: { key: apiKey, ...updates },
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update key');
      throw error;
    }
  }

  async deleteKey(apiKey: string): Promise<void> {
    if (this.config.enableMocking) {
      return this.createMockResponse(undefined);
    }

    try {
      await this.makeRequest('/key/delete', {
        method: 'POST',
        body: { keys: [apiKey] },
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to delete key');
      throw error;
    }
  }

  // User Management
  async createUser(request: LiteLLMUserRequest): Promise<LiteLLMUserResponse> {
    if (this.config.enableMocking) {
      const mockResponse: LiteLLMUserResponse = {
        user_id: request.user_id || `user-${Date.now()}`,
        user_email: request.user_email,
        user_alias: request.user_alias,
        user_role: request.user_role || 'internal_user',
        teams: request.teams || [],
        max_budget: request.max_budget || 100,
        spend: 0,
        models: request.models || ['gpt-4o'],
        tpm_limit: request.tpm_limit || 1000,
        rpm_limit: request.rpm_limit || 60,
        created_at: new Date().toISOString(),
        api_key: request.auto_create_key
          ? `sk-litellm-${Math.random().toString(36).substring(2, 15)}`
          : undefined,
      };

      return this.createMockResponse(mockResponse);
    }

    try {
      return await this.makeRequest<LiteLLMUserResponse>('/user/new', {
        method: 'POST',
        body: request,
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create user');
      throw error;
    }
  }

  async getUserInfo(userId: string): Promise<LiteLLMUserResponse> {
    if (this.config.enableMocking) {
      const mockResponse: LiteLLMUserResponse = {
        user_id: userId,
        user_alias: `User ${userId}`,
        user_role: 'internal_user',
        max_budget: 100,
        spend: Math.random() * 50,
        models: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        tpm_limit: 1000,
        rpm_limit: 60,
        created_at: new Date().toISOString(),
      };

      return this.createMockResponse(mockResponse);
    }

    try {
      return await this.makeRequest<LiteLLMUserResponse>(`/user/info?user_id=${userId}`);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user info');
      throw error;
    }
  }

  async updateUser(
    userId: string,
    updates: Partial<LiteLLMUserRequest>,
  ): Promise<LiteLLMUserResponse> {
    if (this.config.enableMocking) {
      const mockResponse: LiteLLMUserResponse = {
        user_id: userId,
        ...updates,
        spend: Math.random() * 50,
        created_at: new Date().toISOString(),
      };

      return this.createMockResponse(mockResponse);
    }

    try {
      return await this.makeRequest<LiteLLMUserResponse>('/user/update', {
        method: 'POST',
        body: { user_id: userId, ...updates },
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update user');
      throw error;
    }
  }

  // Team Management
  async createTeam(request: LiteLLMTeamRequest): Promise<LiteLLMTeamResponse> {
    if (this.config.enableMocking) {
      const mockResponse: LiteLLMTeamResponse = {
        team_id: request.team_id || `team-${Date.now()}`,
        team_alias: request.team_alias,
        max_budget: request.max_budget || 1000,
        spend: 0,
        models: request.models || ['gpt-4o'],
        tpm_limit: request.tpm_limit || 10000,
        rpm_limit: request.rpm_limit || 500,
        admins: request.admins || [],
        members: [],
        created_at: new Date().toISOString(),
      };

      return this.createMockResponse(mockResponse);
    }

    try {
      return await this.makeRequest<LiteLLMTeamResponse>('/team/new', {
        method: 'POST',
        body: request,
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create team');
      throw error;
    }
  }

  async getTeamInfo(teamId: string): Promise<LiteLLMTeamResponse> {
    if (this.config.enableMocking) {
      const mockResponse: LiteLLMTeamResponse = {
        team_id: teamId,
        team_alias: `Team ${teamId}`,
        max_budget: 1000,
        spend: Math.random() * 500,
        models: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        tpm_limit: 10000,
        rpm_limit: 500,
        admins: ['admin-user'],
        members: ['member-user-1', 'member-user-2'],
        created_at: new Date().toISOString(),
      };

      return this.createMockResponse(mockResponse);
    }

    try {
      return await this.makeRequest<LiteLLMTeamResponse>(`/team/info?team_id=${teamId}`);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get team info');
      throw error;
    }
  }

  // LLM Operations
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (this.config.enableMocking) {
      const mockResponse: ChatCompletionResponse = {
        id: `chatcmpl-mock-${Math.random().toString(36).substring(2, 15)}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `This is a mock response for model ${request.model}. Your message was: "${request.messages[request.messages.length - 1]?.content}"`,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: request.messages.reduce((sum, msg) => sum + msg.content.length / 4, 0),
          completion_tokens: 50,
          total_tokens: 0,
        },
      };

      mockResponse.usage.total_tokens =
        mockResponse.usage.prompt_tokens + mockResponse.usage.completion_tokens;

      return this.createMockResponse(mockResponse);
    }

    try {
      return await this.makeRequest<ChatCompletionResponse>('/chat/completions', {
        method: 'POST',
        body: request,
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create chat completion');
      throw error;
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    if (this.config.enableMocking) {
      return apiKey.startsWith('sk-litellm-') || apiKey === 'test-key';
    }

    try {
      await this.getKeyInfo(apiKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Utility Methods
  getMetrics(): {
    cacheSize: number;
    circuitBreakerStatus: {
      isOpen: boolean;
      failureCount: number;
      lastFailureTime: number;
    };
    config: {
      enableMocking: boolean;
      baseUrl: string;
      timeout: number;
    };
  } {
    return {
      cacheSize: this.cache.size,
      circuitBreakerStatus: {
        isOpen: this.isCircuitBreakerOpen,
        failureCount: this.circuitBreakerFailureCount,
        lastFailureTime: this.circuitBreakerLastFailureTime,
      },
      config: {
        enableMocking: this.config.enableMocking,
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
      },
    };
  }

  async clearCache(pattern?: string): Promise<void> {
    this.clearCacheInternal(pattern);
    this.fastify.log.info({ pattern }, 'LiteLLM cache cleared');
  }

  async resetCircuitBreaker(): Promise<void> {
    this.isCircuitBreakerOpen = false;
    this.circuitBreakerFailureCount = 0;
    this.circuitBreakerLastFailureTime = 0;
    this.fastify.log.info('Circuit breaker reset');
  }
}

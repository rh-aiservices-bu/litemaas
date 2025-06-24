import { FastifyInstance } from 'fastify';

export interface LiteLLMModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  permission?: any[];
  root?: string;
  parent?: string;
  max_tokens?: number;
  mode?: string;
  supports_function_calling?: boolean;
  supports_parallel_function_calling?: boolean;
  supports_vision?: boolean;
  litellm_provider?: string;
  source?: string;
}

export interface LiteLLMHealth {
  status: 'healthy' | 'unhealthy';
  db: string;
  redis?: string;
  litellm_version?: string;
  oldest_unprocessed_webhook_age_seconds?: number;
  oldest_unprocessed_spend_log_age_seconds?: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  user?: string;
}

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
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface KeyGenerationRequest {
  models?: string[];
  aliases?: Record<string, string>;
  config?: Record<string, any>;
  spend?: number;
  max_budget?: number;
  user_id?: string;
  team_id?: string;
  max_parallel_requests?: number;
  metadata?: Record<string, any>;
  tpm_limit?: number;
  rpm_limit?: number;
  budget_duration?: string;
  allowed_cache_controls?: string[];
  soft_budget?: number;
  tags?: string[];
  key_alias?: string;
  duration?: string;
  permissions?: Record<string, any>;
  model_max_budget?: Record<string, number>;
}

export interface KeyGenerationResponse {
  key: string;
  expires?: string;
  user_id: string;
  max_budget?: number;
  spend?: number;
  model_max_budget?: Record<string, number>;
  metadata?: Record<string, any>;
  models?: string[];
  tpm_limit?: number;
  rpm_limit?: number;
  budget_duration?: string;
  tags?: string[];
  team_id?: string;
  permissions?: Record<string, any>;
  key_alias?: string;
  soft_budget?: number;
}

export interface LiteLLMError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

interface LiteLLMConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableMocking: boolean;
}

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
      id: 'gpt-4o',
      object: 'model',
      created: 1686935002,
      owned_by: 'openai',
      max_tokens: 128000,
      mode: 'chat',
      supports_function_calling: true,
      supports_parallel_function_calling: true,
      supports_vision: true,
      litellm_provider: 'openai',
      source: 'openai'
    },
    {
      id: 'gpt-4o-mini',
      object: 'model',
      created: 1686935002,
      owned_by: 'openai',
      max_tokens: 128000,
      mode: 'chat',
      supports_function_calling: true,
      supports_parallel_function_calling: true,
      supports_vision: true,
      litellm_provider: 'openai',
      source: 'openai'
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      object: 'model',
      created: 1686935002,
      owned_by: 'anthropic',
      max_tokens: 200000,
      mode: 'chat',
      supports_function_calling: true,
      supports_parallel_function_calling: false,
      supports_vision: true,
      litellm_provider: 'anthropic',
      source: 'anthropic'
    },
    {
      id: 'llama-3.1-8b-instant',
      object: 'model',
      created: 1686935002,
      owned_by: 'meta',
      max_tokens: 131072,
      mode: 'chat',
      supports_function_calling: false,
      supports_parallel_function_calling: false,
      supports_vision: false,
      litellm_provider: 'groq',
      source: 'groq'
    },
    {
      id: 'gemini-1.5-pro',
      object: 'model',
      created: 1686935002,
      owned_by: 'google',
      max_tokens: 2097152,
      mode: 'chat',
      supports_function_calling: true,
      supports_parallel_function_calling: false,
      supports_vision: true,
      litellm_provider: 'vertex_ai',
      source: 'vertex_ai'
    }
  ];

  constructor(fastify: FastifyInstance, config?: Partial<LiteLLMConfig>) {
    this.fastify = fastify;
    this.config = {
      baseUrl: config?.baseUrl || process.env.LITELLM_BASE_URL || 'http://localhost:4000',
      apiKey: config?.apiKey || process.env.LITELLM_API_KEY,
      timeout: config?.timeout || 30000,
      retryAttempts: config?.retryAttempts || 3,
      retryDelay: config?.retryDelay || 1000,
      enableMocking: config?.enableMocking ?? (process.env.NODE_ENV === 'development' || !process.env.LITELLM_BASE_URL),
    };

    this.fastify.log.info({
      baseUrl: this.config.baseUrl,
      enableMocking: this.config.enableMocking,
      timeout: this.config.timeout,
    }, 'LiteLLM service initialized');
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

  private clearCache(pattern?: string): void {
    if (pattern) {
      const keys = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
      keys.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  private isCircuitBreakerTripped(): boolean {
    if (!this.isCircuitBreakerOpen) {
      return false;
    }

    // Check if timeout has passed
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
      this.fastify.log.warn({
        failureCount: this.circuitBreakerFailureCount,
        threshold: this.CIRCUIT_BREAKER_THRESHOLD,
      }, 'Circuit breaker opened due to consecutive failures');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
    } = {}
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
      requestHeaders['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.fastify.log.debug({
          url,
          method,
          attempt,
          maxAttempts: this.config.retryAttempts,
        }, 'Making request to LiteLLM');

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
          const errorData = await response.json() as LiteLLMError;
          throw new Error(`LiteLLM API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        this.recordSuccess();
        
        this.fastify.log.debug({
          url,
          method,
          status: response.status,
          attempt,
        }, 'LiteLLM request successful');

        return data as T;
      } catch (error) {
        lastError = error as Error;
        
        this.fastify.log.warn({
          url,
          method,
          attempt,
          maxAttempts: this.config.retryAttempts,
          error: lastError.message,
        }, 'LiteLLM request failed');

        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    this.recordFailure();
    throw lastError!;
  }

  private createMockResponse<T>(data: T): Promise<T> {
    // Simulate network delay
    const delay = Math.random() * 100 + 50; // 50-150ms
    return new Promise(resolve => setTimeout(() => resolve(data), delay));
  }

  async getModels(options: { refresh?: boolean } = {}): Promise<LiteLLMModel[]> {
    const cacheKey = 'models';
    
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
      const response = await this.makeRequest<{ data: LiteLLMModel[] }>('/models');
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to fetch models from LiteLLM');
      
      // Fallback to cache if available
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
    return models.find(model => model.id === modelId) || null;
  }

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
        litellm_version: '1.0.0-mock',
      };
      this.setCache(cacheKey, health, 30000); // 30 seconds cache
      return this.createMockResponse(health);
    }

    try {
      const health = await this.makeRequest<LiteLLMHealth>('/health');
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

  async generateApiKey(request: KeyGenerationRequest): Promise<KeyGenerationResponse> {
    if (this.config.enableMocking) {
      const mockKey = `sk-mock-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      const response: KeyGenerationResponse = {
        key: mockKey,
        user_id: request.user_id || 'mock-user',
        max_budget: request.max_budget || 100,
        spend: 0,
        models: request.models || ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        tpm_limit: request.tpm_limit || 10000,
        rpm_limit: request.rpm_limit || 100,
        metadata: request.metadata || {},
        tags: request.tags || [],
        expires: request.duration ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      };
      
      return this.createMockResponse(response);
    }

    try {
      return await this.makeRequest<KeyGenerationResponse>('/key/generate', {
        method: 'POST',
        body: request,
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to generate API key');
      throw error;
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (this.config.enableMocking) {
      const mockResponse: ChatCompletionResponse = {
        id: `chatcmpl-mock-${Math.random().toString(36).substring(2, 15)}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: `This is a mock response for model ${request.model}. Your message was: "${request.messages[request.messages.length - 1]?.content}"`
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: request.messages.reduce((sum, msg) => sum + msg.content.length / 4, 0),
          completion_tokens: 50,
          total_tokens: 0
        }
      };
      
      mockResponse.usage.total_tokens = mockResponse.usage.prompt_tokens + mockResponse.usage.completion_tokens;
      
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
      return apiKey.startsWith('sk-mock-') || apiKey === 'test-key';
    }

    try {
      await this.makeRequest('/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

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
    this.clearCache(pattern);
    this.fastify.log.info({ pattern }, 'LiteLLM cache cleared');
  }

  async resetCircuitBreaker(): Promise<void> {
    this.isCircuitBreakerOpen = false;
    this.circuitBreakerFailureCount = 0;
    this.circuitBreakerLastFailureTime = 0;
    this.fastify.log.info('Circuit breaker reset');
  }
}
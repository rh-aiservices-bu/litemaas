import { FastifyInstance } from 'fastify';
import { BaseService } from './base.service.js';
import { LiteLLMModel, LiteLLMHealth, LiteLLMError, LiteLLMConfig } from '../types/model.types.js';
import {
  LiteLLMKeyGenerationRequest,
  LiteLLMKeyGenerationResponse,
  LiteLLMKeyInfo,
} from '../types/api-key.types.js';
import {
  LiteLLMUserRequest,
  LiteLLMUserResponse,
  LiteLLMUserInfoResponse,
  LiteLLMTeamRequest,
  LiteLLMTeamResponse,
} from '../types/user.types.js';

export class LiteLLMService extends BaseService {
  private config: LiteLLMConfig;
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
    super(fastify);
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
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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

  /**
   * Get the LiteLLM token ID for a key by its alias
   */
  async getKeyTokenByAlias(userId: string, keyAlias: string): Promise<string | null> {
    const cacheKey = this.getCacheKey(`key_token:${userId}:${keyAlias}`);
    const cached = this.getCache<string>(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.config.enableMocking) {
      // Return mock token ID
      const mockToken = `mock-token-${keyAlias}`;
      this.setCache(cacheKey, mockToken);
      return mockToken;
    }

    try {
      const queryParams = new URLSearchParams({
        user_id: userId,
        return_full_object: 'true',
        include_team_keys: 'false',
        page: '1',
        size: '100', // Get more keys to find the match
      });

      const response = await this.makeRequest<any>(`/key/list?${queryParams.toString()}`, {
        method: 'GET',
      });

      // Find the key with matching alias
      const keys = response.keys || response.data || [];
      const matchingKey = keys.find(
        (key: any) => key.key_alias === keyAlias || key.key_name === keyAlias,
      );

      if (matchingKey && matchingKey.token) {
        this.setCache(cacheKey, matchingKey.token, 300); // Cache for 5 minutes
        return matchingKey.token;
      }

      return null;
    } catch (error) {
      this.fastify.log.error(error, `Failed to get key token for alias ${keyAlias}`);
      return null;
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
    this.fastify.log.info(
      {
        request: {
          user_id: request.user_id,
          user_email: request.user_email,
          user_alias: request.user_alias,
          user_role: request.user_role,
          max_budget: request.max_budget,
          auto_create_key: request.auto_create_key,
        },
        enableMocking: this.config.enableMocking,
        baseUrl: this.config.baseUrl,
      },
      'LiteLLM createUser called',
    );

    if (this.config.enableMocking) {
      this.fastify.log.warn(
        { user_id: request.user_id },
        'LiteLLM is in MOCK MODE - user will not be created in real LiteLLM instance',
      );

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

      this.fastify.log.info(
        { user_id: request.user_id, mockResponse },
        'Returning mock user creation response',
      );

      return this.createMockResponse(mockResponse);
    }

    try {
      this.fastify.log.info(
        {
          user_id: request.user_id,
          endpoint: '/user/new',
          baseUrl: this.config.baseUrl,
        },
        'Sending real API request to LiteLLM to create user',
      );

      const response = await this.makeRequest<LiteLLMUserResponse>('/user/new', {
        method: 'POST',
        body: request,
      });

      this.fastify.log.info(
        {
          user_id: request.user_id,
          response: {
            user_id: response.user_id,
            user_alias: response.user_alias,
            max_budget: response.max_budget,
            spend: response.spend,
            created_at: response.created_at,
          },
        },
        'Successfully created user in LiteLLM',
      );

      return response;
    } catch (error) {
      this.fastify.log.error(
        {
          user_id: request.user_id,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          baseUrl: this.config.baseUrl,
          endpoint: '/user/new',
        },
        'Failed to create user in LiteLLM',
      );
      throw error;
    }
  }

  async getUserInfo(userId: string): Promise<LiteLLMUserResponse | null> {
    this.fastify.log.debug(
      {
        userId,
        enableMocking: this.config.enableMocking,
        baseUrl: this.config.baseUrl,
      },
      'LiteLLM getUserInfo called',
    );

    if (this.config.enableMocking) {
      this.fastify.log.debug({ userId }, 'LiteLLM is in MOCK MODE - returning mock user info');

      const mockResponse: LiteLLMUserResponse = {
        user_id: userId,
        user_alias: `User ${userId}`,
        user_role: 'internal_user',
        teams: ['default-team'], // Mock users belong to default team
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
      this.fastify.log.debug(
        {
          userId,
          endpoint: `/user/info?user_id=${userId}`,
          baseUrl: this.config.baseUrl,
        },
        'Sending real API request to LiteLLM to get user info',
      );

      const response = await this.makeRequest<LiteLLMUserResponse>(`/user/info?user_id=${userId}`);

      // CRITICAL FIX: Check if user actually exists by examining teams array
      // LiteLLM returns HTTP 200 for any user_id, but non-existent users have empty teams array
      if (!response.teams || response.teams.length === 0) {
        this.fastify.log.info(
          {
            userId,
            response: {
              user_id: response.user_id,
              teams: response.teams,
              models: response.models?.length || 0,
            },
          },
          'User does not exist in LiteLLM (empty teams array)',
        );
        return null; // User doesn't actually exist
      }

      this.fastify.log.debug(
        {
          userId,
          response: {
            user_id: response.user_id,
            user_alias: response.user_alias,
            spend: response.spend,
            max_budget: response.max_budget,
            teams: response.teams,
          },
        },
        'Successfully retrieved user info from LiteLLM',
      );

      return response;
    } catch (error) {
      this.fastify.log.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          baseUrl: this.config.baseUrl,
          endpoint: `/user/info?user_id=${userId}`,
        },
        'Failed to get user info from LiteLLM',
      );
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

  // Get full user info including keys
  async getUserInfoFull(userId: string): Promise<LiteLLMUserInfoResponse | null> {
    this.fastify.log.debug(
      {
        userId,
        enableMocking: this.config.enableMocking,
        baseUrl: this.config.baseUrl,
      },
      'LiteLLM getUserInfo (full) called',
    );

    if (this.config.enableMocking) {
      this.fastify.log.debug({ userId }, 'LiteLLM is in MOCK MODE - returning mock full user info');

      const mockResponse: LiteLLMUserInfoResponse = {
        user_id: userId,
        user_info: {
          user_id: userId,
          user_alias: `User ${userId}`,
          user_email: `user-${userId}@example.com`,
          user_role: 'internal_user',
          teams: ['a0000000-0000-4000-8000-000000000001'],
          max_budget: 100,
          spend: Math.random() * 50,
          models: [],
          tpm_limit: 1000,
          rpm_limit: 60,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        keys: [
          {
            token: 'mock-token-' + Math.random().toString(36).substring(7),
            key_name: 'sk-...mock',
            key_alias: 'mock-key-alias',
            spend: 0,
            models: ['gpt-4o'],
            user_id: userId,
            metadata: {},
            created_at: new Date().toISOString(),
          },
        ],
        teams: [
          {
            team_alias: 'Default Team',
            team_id: 'a0000000-0000-4000-8000-000000000001',
            models: [],
            max_budget: 10000,
            tpm_limit: 50000,
            rpm_limit: 1000,
            spend: 0,
            created_at: new Date().toISOString(),
          },
        ],
      };

      return this.createMockResponse(mockResponse);
    }

    try {
      this.fastify.log.debug(
        {
          userId,
          endpoint: `/user/info?user_id=${userId}`,
          baseUrl: this.config.baseUrl,
        },
        'Sending real API request to LiteLLM to get full user info',
      );

      const response = await this.makeRequest<LiteLLMUserInfoResponse>(
        `/user/info?user_id=${userId}`,
      );

      // Check if user actually exists by examining teams in user_info
      if (!response.user_info?.teams || response.user_info.teams.length === 0) {
        this.fastify.log.info(
          {
            userId,
            response: {
              user_id: response.user_id,
              teams: response.user_info?.teams,
            },
          },
          'User does not exist in LiteLLM (empty teams array)',
        );
        return null;
      }

      this.fastify.log.debug(
        {
          userId,
          keysCount: response.keys?.length || 0,
          teamsCount: response.teams?.length || 0,
        },
        'Successfully retrieved full user info from LiteLLM',
      );

      return response;
    } catch (error) {
      this.fastify.log.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          baseUrl: this.config.baseUrl,
          endpoint: `/user/info?user_id=${userId}`,
        },
        'Failed to get full user info from LiteLLM',
      );
      throw error;
    }
  }

  // Get the internal LiteLLM token for an API key
  async getApiKeyToken(userId: string, liteLLMKeyValue: string): Promise<string | null> {
    try {
      this.fastify.log.debug(
        {
          userId,
          keyValue: liteLLMKeyValue?.substring(0, 10) + '...',
        },
        'Getting API key token from LiteLLM',
      );

      // Get full user info including keys
      const userInfo = await this.getUserInfoFull(userId);
      if (!userInfo || !userInfo.keys) {
        this.fastify.log.warn({ userId }, 'No user info or keys found for user');
        return null;
      }

      // Extract last 4 characters of the liteLLMKeyValue
      const last4Chars = liteLLMKeyValue.slice(-4);

      this.fastify.log.debug(
        {
          userId,
          last4Chars,
          keysCount: userInfo.keys.length,
        },
        'Searching for matching key by last 4 characters',
      );

      // Find the key that matches the last 4 characters
      const matchingKey = userInfo.keys.find((key) => {
        // key_name format is "sk-...XXXX" where XXXX are last 4 chars
        const keyNameLast4 = key.key_name?.slice(-4);
        return keyNameLast4 === last4Chars;
      });

      if (!matchingKey) {
        this.fastify.log.warn(
          {
            userId,
            last4Chars,
            availableKeys: userInfo.keys.map((k) => k.key_name),
          },
          'No matching key found by last 4 characters',
        );
        return null;
      }

      this.fastify.log.info(
        {
          userId,
          keyAlias: matchingKey.key_alias,
          keyName: matchingKey.key_name,
        },
        'Found matching key, returning token',
      );

      return matchingKey.token;
    } catch (error) {
      this.fastify.log.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get API key token',
      );
      return null;
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
        models: request.models || [],
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
        models: [], // Empty array enables all models
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

  /**
   * Get daily activity/usage from LiteLLM filtered by API key
   */
  async getDailyActivity(
    apiKeyHash?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    spend: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    api_requests: number;
    by_model: Array<{
      model: string;
      spend: number;
      tokens: number;
      api_requests: number;
    }>;
    daily_metrics?: Array<{
      date: string;
      spend: number;
      tokens: number;
      requests: number;
    }>;
  }> {
    const cacheKey = this.getCacheKey(`activity:${apiKeyHash}:${startDate}:${endDate}`);
    const cached = this.getCache<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Return mock data in development mode
    if (this.config.enableMocking) {
      this.fastify.log.info(
        { apiKeyHash, startDate, endDate },
        'LiteLLM: Returning mock usage data',
      );
      const mockData = {
        spend: 12.45,
        total_tokens: 125000,
        prompt_tokens: 75000,
        completion_tokens: 50000,
        api_requests: 523,
        by_model: [
          {
            model: 'gpt-4',
            spend: 8.5,
            tokens: 45000,
            api_requests: 150,
          },
          {
            model: 'gpt-3.5-turbo',
            spend: 3.95,
            tokens: 80000,
            api_requests: 373,
          },
        ],
        daily_metrics: [
          {
            date: new Date().toISOString().split('T')[0],
            spend: 12.45,
            tokens: 125000,
            requests: 523,
          },
        ],
      };
      this.setCache(cacheKey, mockData);
      return mockData;
    }

    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('start_date', startDate);
      if (endDate) queryParams.append('end_date', endDate);
      if (apiKeyHash) queryParams.append('api_key', apiKeyHash);

      const response = await this.makeRequest<any>(
        `/user/daily/activity?${queryParams.toString()}`,
        {
          method: 'GET',
        },
      );

      // Parse the response according to the actual LiteLLM format
      const metadata = response.metadata || {};
      const results = response.results || [];

      // Aggregate metrics from all dates
      const totalSpend = metadata.total_spend || 0;
      const totalTokens = metadata.total_tokens || 0;
      const promptTokens = metadata.total_prompt_tokens || 0;
      const completionTokens = metadata.total_completion_tokens || 0;
      const apiRequests = metadata.total_api_requests || 0;

      // Aggregate model breakdown
      const modelBreakdown: { [key: string]: any } = {};
      const dailyMetrics: any[] = [];

      results.forEach((dayResult: any) => {
        // Add to daily metrics
        dailyMetrics.push({
          date: dayResult.date,
          spend: dayResult.metrics?.spend || 0,
          tokens: dayResult.metrics?.total_tokens || 0,
          requests: dayResult.metrics?.api_requests || 0,
        });

        // Aggregate model breakdown
        if (dayResult.breakdown?.models) {
          Object.entries(dayResult.breakdown.models).forEach(
            ([modelName, modelData]: [string, any]) => {
              if (!modelBreakdown[modelName]) {
                modelBreakdown[modelName] = {
                  model: modelName,
                  spend: 0,
                  tokens: 0,
                  api_requests: 0,
                };
              }
              modelBreakdown[modelName].spend += modelData.metrics?.spend || 0;
              modelBreakdown[modelName].tokens += modelData.metrics?.total_tokens || 0;
              modelBreakdown[modelName].api_requests += modelData.metrics?.api_requests || 0;
            },
          );
        }
      });

      const result = {
        spend: totalSpend,
        total_tokens: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        api_requests: apiRequests,
        by_model: Object.values(modelBreakdown),
        daily_metrics: dailyMetrics,
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user daily activity from LiteLLM');
      throw error;
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

  async createModel(modelData: any): Promise<any> {
    const url = '/model/new';

    try {
      this.fastify.log.info({ modelData }, 'Creating model in LiteLLM');
      const response = await this.makeRequest<any>(url, {
        method: 'POST',
        body: modelData,
      });

      this.fastify.log.info({ modelName: modelData.model_name }, 'Model created successfully');
      return response;
    } catch (error) {
      this.fastify.log.error({ error, modelData }, 'Failed to create model');
      throw error;
    }
  }

  async updateModel(modelId: string, modelData: any): Promise<any> {
    const url = `/model/${modelId}/update`;

    try {
      this.fastify.log.info({ modelId, modelData }, 'Updating model in LiteLLM');
      const response = await this.makeRequest<any>(url, {
        method: 'PATCH',
        body: modelData,
      });

      this.fastify.log.info({ modelId }, 'Model updated successfully');
      return response;
    } catch (error) {
      this.fastify.log.error({ error, modelId, modelData }, 'Failed to update model');
      throw error;
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const url = `/model/delete`;

    try {
      this.fastify.log.info({ modelId }, 'Deleting model from LiteLLM');
      await this.makeRequest<void>(url, {
        method: 'POST',
        body: { id: modelId },
      });

      this.fastify.log.info({ modelId }, 'Model deleted successfully');
    } catch (error) {
      this.fastify.log.error({ error, modelId }, 'Failed to delete model');
      throw error;
    }
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

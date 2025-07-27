import { FastifyInstance } from 'fastify';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { LiteLLMService } from './litellm.service.js';
import { 
  EnhancedApiKey, 
  LiteLLMKeyGenerationResponse, 
  LiteLLMKeyInfo,
  ApiKeyListParams,
  CreateApiKeyRequest,
  LegacyCreateApiKeyRequest,
  LiteLLMKeyGenerationRequest,
  ApiKeyValidation
} from '../types/api-key.types.js';

// Types moved to types/api-key.types.ts for consistency
// Keeping legacy interface for backward compatibility in service
export interface ServiceCreateApiKeyRequest {
  subscriptionId: string;
  name?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ApiKeyDetails {
  id: string;
  subscriptionId: string;
  userId: string;
  name?: string;
  keyPrefix: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  revokedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ApiKeyWithSecret {
  id: string;
  userId: string;
  name?: string;
  keyPrefix: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  key: string; // Only returned on creation
  models?: string[]; // Array of model IDs for multi-model support
  modelDetails?: Array<{
    id: string;
    name: string;
    provider: string;
    context_length?: number;
  }>;
  // Backward compatibility
  subscriptionId?: string;
}

// Type moved to types/api-key.types.ts for consistency
// Using the imported ApiKeyValidation interface

export interface ApiKeySpendInfo {
  keyId: string;
  currentSpend: number;
  maxBudget?: number;
  budgetUtilization: number; // percentage
  remainingBudget?: number;
  spendResetAt?: Date;
  lastUpdatedAt: Date;
}

export interface ApiKeyUsage {
  totalRequests: number;
  requestsThisMonth: number;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface ApiKeyStats {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  bySubscription: Record<string, number>;
}

export class ApiKeyService {
  private fastify: FastifyInstance;
  private liteLLMService: LiteLLMService;
  private readonly KEY_PREFIX = 'ltm_';
  private readonly KEY_LENGTH = 32; // 32 bytes = 64 hex characters
  private readonly PREFIX_LENGTH = 4; // First 4 characters for display

  // Mock data for development/fallback
  private readonly MOCK_API_KEYS: EnhancedApiKey[] = [
    {
      id: 'key-mock-1',
      userId: 'user-mock-1',
      models: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
      name: 'Production API Key',
      keyHash: 'mock-hash-1',
      keyPrefix: 'ltm_Ax7m',
      lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      liteLLMKeyId: 'sk-litellm-mock-key-1',
      lastSyncAt: new Date(Date.now() - 30 * 60 * 1000),
      syncStatus: 'synced',
      maxBudget: 500,
      currentSpend: 125.50,
      tpmLimit: 10000,
      rpmLimit: 100,
      metadata: {
        tags: ['production', 'user-subscription'],
        team_id: 'team-prod',
        budget_duration: 'monthly',
        soft_budget: 450,
      },
      modelDetails: [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextLength: 128000 },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextLength: 200000 }
      ],
      subscriptionDetails: [
        { subscriptionId: 'sub-mock-1', modelId: 'gpt-4o', status: 'active', quotaRequests: 1000, usedRequests: 250 }
      ]
    },
    {
      id: 'key-mock-2',
      userId: 'user-mock-1',
      models: ['gpt-4o-mini'],
      name: 'Development API Key',
      keyHash: 'mock-hash-2',
      keyPrefix: 'ltm_Bk9n',
      lastUsedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      isActive: true,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      liteLLMKeyId: 'sk-litellm-mock-key-2',
      lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
      syncStatus: 'synced',
      maxBudget: 100,
      currentSpend: 25.75,
      tpmLimit: 5000,
      rpmLimit: 50,
      metadata: {
        tags: ['development'],
        budget_duration: 'monthly',
        soft_budget: 90,
      },
      modelDetails: [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextLength: 128000 }
      ],
      subscriptionDetails: [
        { subscriptionId: 'sub-mock-2', modelId: 'gpt-4o-mini', status: 'active', quotaRequests: 500, usedRequests: 50 }
      ]
    }
  ];

  constructor(fastify: FastifyInstance, liteLLMService: LiteLLMService) {
    this.fastify = fastify;
    this.liteLLMService = liteLLMService;
  }

  private shouldUseMockData(): boolean {
    const dbUnavailable = this.isDatabaseUnavailable();
    
    this.fastify.log.debug({ 
      dbUnavailable, 
      nodeEnv: process.env.NODE_ENV,
      hasPg: !!this.fastify.pg,
      mockMode: this.fastify.isDatabaseMockMode ? this.fastify.isDatabaseMockMode() : undefined
    }, 'API Key Service: Checking if should use mock data');
    
    return dbUnavailable;
  }

  private isDatabaseUnavailable(): boolean {
    try {
      if (!this.fastify.pg) {
        this.fastify.log.debug('API Key Service: PostgreSQL plugin not available');
        return true;
      }
      
      if (this.fastify.isDatabaseMockMode && this.fastify.isDatabaseMockMode()) {
        this.fastify.log.debug('API Key Service: Database mock mode enabled');
        return true;
      }
      
      return false;
    } catch (error) {
      this.fastify.log.debug({ error }, 'API Key Service: Error checking database availability');
      return true;
    }
  }

  private createMockResponse<T>(data: T): Promise<T> {
    const delay = Math.random() * 200 + 100; // 100-300ms
    return new Promise(resolve => setTimeout(() => resolve(data), delay));
  }

  async createApiKey(
    userId: string,
    request: CreateApiKeyRequest | LegacyCreateApiKeyRequest
  ): Promise<ApiKeyWithSecret> {
    try {
      // Handle backward compatibility
      let modelIds: string[];
      let isLegacyRequest = false;
      
      if ('subscriptionId' in request) {
        // Legacy request - convert subscription to model
        isLegacyRequest = true;
        const subscription = await this.fastify.dbUtils.queryOne(
          `SELECT model_id, status FROM subscriptions WHERE id = $1 AND user_id = $2`,
          [request.subscriptionId, userId]
        );
        
        if (!subscription) {
          throw this.fastify.createNotFoundError('Subscription not found');
        }
        
        if (subscription.status !== 'active') {
          throw this.fastify.createValidationError(
            `Cannot create API key for ${subscription.status} subscription`
          );
        }
        
        modelIds = [subscription.model_id];
        
        this.fastify.log.warn({
          userId,
          subscriptionId: request.subscriptionId,
          message: 'Using deprecated subscriptionId parameter. Please migrate to modelIds.'
        });
      } else {
        modelIds = request.modelIds;
        
        if (!modelIds || modelIds.length === 0) {
          throw this.fastify.createValidationError('At least one model must be selected');
        }
      }

      // Ensure user exists in LiteLLM
      await this.ensureUserExistsInLiteLLM(userId);

      if (this.shouldUseMockData()) {
        // Mock implementation
        const mockKey = this.generateApiKey();
        const mockApiKey: ApiKeyWithSecret = {
          id: `key-${Date.now()}`,
          subscriptionId: isLegacyRequest ? (request as LegacyCreateApiKeyRequest).subscriptionId : undefined,
          userId,
          name: request.name || 'New API Key',
          keyPrefix: mockKey.keyPrefix,
          lastUsedAt: undefined,
          expiresAt: request.expiresAt,
          isActive: true,
          createdAt: new Date(),
          models: modelIds,
          modelDetails: modelIds.map(id => ({
            id,
            name: `Mock Model ${id}`,
            provider: 'mock',
            context_length: 4096
          })),
          key: mockKey.key,
        };

        return this.createMockResponse(mockApiKey);
      }

      // Validate user has active subscriptions for all requested models
      const validModels = await this.fastify.dbUtils.query(
        `SELECT DISTINCT s.model_id, s.id as subscription_id, 
                m.name as model_name, m.provider
         FROM subscriptions s
         JOIN models m ON s.model_id = m.id
         WHERE s.user_id = $1 
           AND s.status = 'active' 
           AND s.model_id = ANY($2::text[])`,
        [userId, modelIds]
      );

      const validModelIds = validModels.map(m => m.model_id);
      const invalidModels = modelIds.filter(id => !validModelIds.includes(id));
      
      if (invalidModels.length > 0) {
        throw this.fastify.createValidationError(
          `You do not have active subscriptions for the following models: ${invalidModels.join(', ')}`
        );
      }

      // Check API key limits per user
      const existingKeysCount = await this.fastify.dbUtils.queryOne(
        `SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      const maxKeysPerUser = 10;
      if (parseInt(existingKeysCount.count) >= maxKeysPerUser) {
        throw this.fastify.createValidationError(
          `Maximum ${maxKeysPerUser} active API keys allowed per user`
        );
      }

      // Generate secure API key
      const { key, keyHash, keyPrefix } = this.generateApiKey();

      // Create API key in LiteLLM with multiple models
      const liteLLMRequest: LiteLLMKeyGenerationRequest = {
        key_alias: request.name || `key-${Date.now()}`,
        duration: request.expiresAt ? this.calculateDuration(request.expiresAt) : undefined,
        models: modelIds,  // Pass all model IDs
        max_budget: request.maxBudget,
        user_id: userId,
        team_id: request.teamId,
        tpm_limit: request.tpmLimit,
        rpm_limit: request.rpmLimit,
        budget_duration: request.budgetDuration,
        permissions: request.permissions ? {
          allow_chat_completions: request.permissions.allowChatCompletions,
          allow_embeddings: request.permissions.allowEmbeddings,
          allow_completions: request.permissions.allowCompletions,
        } : undefined,
        tags: request.tags,
        soft_budget: request.softBudget,
        guardrails: request.guardrails,
        metadata: {
          litemaas_key_id: keyPrefix,
          created_by: 'litemaas',
          model_count: modelIds.length,
          legacy_request: isLegacyRequest,
          ...request.metadata,
        },
      };

      const liteLLMResponse = await this.liteLLMService.generateApiKey(liteLLMRequest);

      // Begin transaction for atomicity
      const client = await this.fastify.pg.connect();
      
      try {
        await client.query('BEGIN');

        // Store the API key (without subscription_id for new keys)
        const apiKey = await client.query(
          `INSERT INTO api_keys (
            user_id, name, key_hash, key_prefix, 
            expires_at, is_active, lite_llm_key_id,
            max_budget, current_spend, tpm_limit, rpm_limit,
            last_sync_at, sync_status, metadata
            ${isLegacyRequest ? ', subscription_id' : ''}
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14${isLegacyRequest ? ', $15' : ''})
          RETURNING *`,
          [
            userId,
            request.name,
            keyHash,
            keyPrefix,
            request.expiresAt,
            true,
            liteLLMResponse.key,
            request.maxBudget,
            0,
            request.tpmLimit,
            request.rpmLimit,
            new Date(),
            'synced',
            request.metadata || {},
            ...(isLegacyRequest ? [(request as LegacyCreateApiKeyRequest).subscriptionId] : [])
          ]
        );

        // Insert model associations
        for (const modelId of modelIds) {
          await client.query(
            `INSERT INTO api_key_models (api_key_id, model_id) VALUES ($1, $2)`,
            [apiKey.rows[0].id, modelId]
          );
        }

        // Create audit log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            'API_KEY_CREATE',
            'API_KEY',
            apiKey.rows[0].id,
            { 
              name: request.name,
              keyPrefix,
              liteLLMKeyId: liteLLMResponse.key,
              models: modelIds,
              modelCount: modelIds.length,
              legacy: isLegacyRequest
            },
          ]
        );

        await client.query('COMMIT');

        this.fastify.log.info({
          userId,
          apiKeyId: apiKey.rows[0].id,
          keyPrefix,
          liteLLMKeyId: liteLLMResponse.key,
          models: modelIds,
          modelCount: modelIds.length,
        }, 'API key created with multi-model support');

        const enhancedApiKey = this.mapToEnhancedApiKey(apiKey.rows[0], liteLLMResponse);
        return {
          id: enhancedApiKey.id,
          userId: enhancedApiKey.userId,
          name: enhancedApiKey.name,
          keyPrefix: enhancedApiKey.keyPrefix,
          lastUsedAt: enhancedApiKey.lastUsedAt,
          expiresAt: enhancedApiKey.expiresAt,
          isActive: enhancedApiKey.isActive,
          createdAt: enhancedApiKey.createdAt,
          key, // Only include the actual key on creation
          models: modelIds,
          modelDetails: validModels,
          subscriptionId: isLegacyRequest ? (request as LegacyCreateApiKeyRequest).subscriptionId : undefined,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        
        // Try to clean up in LiteLLM if key was created
        if (liteLLMResponse?.key) {
          try {
            await this.liteLLMService.deleteKey(liteLLMResponse.key);
          } catch (cleanupError) {
            this.fastify.log.error(cleanupError, 'Failed to cleanup LiteLLM key after error');
          }
        }
        
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create API key');
      throw error;
    }
  }

  async getApiKey(keyId: string, userId: string): Promise<EnhancedApiKey | null> {
    if (this.shouldUseMockData()) {
      const mockKey = this.MOCK_API_KEYS.find(k => k.id === keyId);
      return mockKey ? this.createMockResponse(mockKey) : null;
    }

    try {
      const apiKey = await this.fastify.dbUtils.queryOne(`
        SELECT ak.*, s.user_id
        FROM api_keys ak
        JOIN subscriptions s ON ak.subscription_id = s.id
        WHERE ak.id = $1 AND s.user_id = $2
      `, [keyId, userId]);

      if (!apiKey) {
        return null;
      }

      return this.mapToEnhancedApiKey(apiKey);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get API key');
      throw error;
    }
  }

  async getUserApiKeys(
    userId: string,
    options: ApiKeyListParams = {}
  ): Promise<{ data: EnhancedApiKey[]; total: number }> {
    const { subscriptionId, modelIds, isActive, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    if (this.shouldUseMockData()) {
      this.fastify.log.debug('Using mock API key data');
      
      let filteredKeys = [...this.MOCK_API_KEYS];
      
      if (subscriptionId) {
        // For backward compatibility, check subscriptionDetails
        filteredKeys = filteredKeys.filter(key => 
          key.subscriptionDetails?.some(sub => sub.subscriptionId === subscriptionId)
        );
      }
      
      if (typeof isActive === 'boolean') {
        filteredKeys = filteredKeys.filter(key => key.isActive === isActive);
      }
      
      const total = filteredKeys.length;
      const paginatedData = filteredKeys.slice(offset, offset + limit);
      
      return this.createMockResponse({
        data: paginatedData,
        total
      });
    }

    try {
      // Updated query to include model associations
      let query = `
        SELECT ak.*, 
           ARRAY_AGG(DISTINCT akm.model_id) FILTER (WHERE akm.model_id IS NOT NULL) as models,
           ARRAY_AGG(DISTINCT jsonb_build_object(
             'id', m.id,
             'name', m.name,
             'provider', m.provider,
             'context_length', m.context_length
           )) FILTER (WHERE m.id IS NOT NULL) as model_details
         FROM api_keys ak
         LEFT JOIN api_key_models akm ON ak.id = akm.api_key_id
         LEFT JOIN models m ON akm.model_id = m.id
         WHERE ak.user_id = $1
      `;
      const params: any[] = [userId];

      if (subscriptionId) {
        query += ` AND ak.subscription_id = $${params.length + 1}`;
        params.push(subscriptionId);
      }

      if (modelIds && modelIds.length > 0) {
        query += ` AND akm.model_id = ANY($${params.length + 1}::text[])`;
        params.push(modelIds);
      }

      if (typeof isActive === 'boolean') {
        query += ` AND ak.is_active = $${params.length + 1}`;
        params.push(isActive);
      }

      query += ` GROUP BY ak.id ORDER BY ak.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      // Get count query
      let countQuery = `
        SELECT COUNT(DISTINCT ak.id)
        FROM api_keys ak
        LEFT JOIN api_key_models akm ON ak.id = akm.api_key_id
        WHERE ak.user_id = $1
      `;
      const countParams = [userId];

      if (subscriptionId) {
        countQuery += ` AND ak.subscription_id = $${countParams.length + 1}`;
        countParams.push(subscriptionId);
      }

      if (modelIds && modelIds.length > 0) {
        countQuery += ` AND akm.model_id = ANY($${countParams.length + 1}::text[])`;
        countParams.push(modelIds);
      }

      if (typeof isActive === 'boolean') {
        countQuery += ` AND ak.is_active = $${countParams.length + 1}`;
        countParams.push(isActive);
      }

      const [apiKeys, countResult] = await Promise.all([
        this.fastify.dbUtils.queryMany(query, params),
        this.fastify.dbUtils.queryOne(countQuery, countParams),
      ]);

      // For backward compatibility, include model from subscription if no models in junction table
      for (const key of apiKeys) {
        if ((!key.models || key.models.length === 0) && key.subscription_id) {
          const subscription = await this.fastify.dbUtils.queryOne(
            `SELECT s.model_id, m.name, m.provider, m.context_length
             FROM subscriptions s
             JOIN models m ON s.model_id = m.id
             WHERE s.id = $1`,
            [key.subscription_id]
          );
          
          if (subscription) {
            key.models = [subscription.model_id];
            key.model_details = [{
              id: subscription.model_id,
              name: subscription.name,
              provider: subscription.provider,
              context_length: subscription.context_length
            }];
          }
        }
      }

      return {
        data: apiKeys.map(key => this.mapToEnhancedApiKey(key)),
        total: parseInt(countResult.count),
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user API keys');
      throw error;
    }
  }

  async syncApiKeyWithLiteLLM(keyId: string, userId: string): Promise<EnhancedApiKey> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      if (!apiKey.liteLLMKeyId) {
        throw this.fastify.createValidationError('API key is not integrated with LiteLLM');
      }

      // Get current info from LiteLLM
      const liteLLMInfo = await this.liteLLMService.getKeyInfo(apiKey.liteLLMKeyId);

      // Update local database with LiteLLM data
      const updatedApiKey = await this.fastify.dbUtils.queryOne(
        `UPDATE api_keys 
         SET current_spend = $1, 
             max_budget = $2,
             tpm_limit = $3,
             rpm_limit = $4,
             last_sync_at = CURRENT_TIMESTAMP,
             sync_status = 'synced'
         WHERE id = $5
         RETURNING *`,
        [
          liteLLMInfo.spend,
          liteLLMInfo.max_budget,
          liteLLMInfo.tpm_limit,
          liteLLMInfo.rpm_limit,
          keyId,
        ]
      );

      this.fastify.log.info({
        keyId,
        userId,
        spend: liteLLMInfo.spend,
        maxBudget: liteLLMInfo.max_budget,
      }, 'API key synced with LiteLLM');

      return this.mapToEnhancedApiKey(updatedApiKey, undefined, liteLLMInfo);
    } catch (error) {
      // Mark sync as failed
      await this.fastify.dbUtils.query(
        `UPDATE api_keys 
         SET sync_status = 'error', 
             sync_error = $1,
             last_sync_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error.message, keyId]
      );

      this.fastify.log.error(error, 'Failed to sync API key with LiteLLM');
      throw error;
    }
  }

  async getApiKeySpendInfo(keyId: string, userId: string): Promise<ApiKeySpendInfo> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      // Try to get real-time data from LiteLLM if available
      let currentSpend = apiKey.currentSpend || 0;
      let maxBudget = apiKey.maxBudget;

      if (apiKey.liteLLMKeyId && !this.shouldUseMockData()) {
        try {
          const liteLLMInfo = await this.liteLLMService.getKeyInfo(apiKey.liteLLMKeyId);
          currentSpend = liteLLMInfo.spend;
          maxBudget = liteLLMInfo.max_budget;
        } catch (error) {
          this.fastify.log.warn(error, 'Failed to get real-time spend info from LiteLLM');
        }
      }

      const budgetUtilization = maxBudget ? (currentSpend / maxBudget) * 100 : 0;
      const remainingBudget = maxBudget ? maxBudget - currentSpend : undefined;

      return {
        keyId,
        currentSpend,
        maxBudget,
        budgetUtilization,
        remainingBudget,
        spendResetAt: undefined, // Would need to be fetched from LiteLLM
        lastUpdatedAt: apiKey.lastSyncAt || apiKey.createdAt,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get API key spend info');
      throw error;
    }
  }

  async updateApiKeyLimits(
    keyId: string, 
    userId: string, 
    updates: {
      maxBudget?: number;
      tpmLimit?: number;
      rpmLimit?: number;
      allowedModels?: string[];
    }
  ): Promise<EnhancedApiKey> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      if (!apiKey.isActive) {
        throw this.fastify.createValidationError('Cannot update inactive API key');
      }

      // Update in LiteLLM if integrated
      if (apiKey.liteLLMKeyId && !this.shouldUseMockData()) {
        await this.liteLLMService.updateKey(apiKey.liteLLMKeyId, {
          max_budget: updates.maxBudget,
          tpm_limit: updates.tpmLimit,
          rpm_limit: updates.rpmLimit,
          models: updates.allowedModels,
        });
      }

      // Update local database
      const updatedApiKey = await this.fastify.dbUtils.queryOne(
        `UPDATE api_keys 
         SET max_budget = COALESCE($1, max_budget),
             tpm_limit = COALESCE($2, tpm_limit),
             rpm_limit = COALESCE($3, rpm_limit),
             last_sync_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [updates.maxBudget, updates.tpmLimit, updates.rpmLimit, keyId]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'API_KEY_UPDATE',
          'API_KEY',
          keyId,
          updates,
        ]
      );

      this.fastify.log.info({
        keyId,
        userId,
        updates,
      }, 'API key limits updated');

      return this.mapToEnhancedApiKey(updatedApiKey);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update API key limits');
      throw error;
    }
  }

  async validateApiKey(key: string): Promise<ApiKeyValidation> {
    try {
      if (!this.isValidKeyFormat(key)) {
        return { isValid: false, error: 'Invalid key format' };
      }

      const keyPrefix = this.extractKeyPrefix(key);
      const keyHash = this.hashApiKey(key);

      if (this.shouldUseMockData()) {
        const mockKey = this.MOCK_API_KEYS.find(k => k.keyPrefix === keyPrefix);
        if (mockKey && mockKey.isActive) {
          return {
            isValid: true,
            apiKey: {
              id: mockKey.id,
              userId: mockKey.userId,
              models: mockKey.models || [],
              name: mockKey.name || '',
              keyHash: mockKey.keyHash,
              keyPrefix: mockKey.keyPrefix,
              isActive: mockKey.isActive,
              createdAt: mockKey.createdAt,
              lastUsedAt: mockKey.lastUsedAt,
              expiresAt: mockKey.expiresAt,
              revokedAt: mockKey.revokedAt,
              liteLLMKeyId: mockKey.liteLLMKeyId,
              lastSyncAt: mockKey.lastSyncAt,
              syncStatus: mockKey.syncStatus,
              syncError: mockKey.syncError,
              maxBudget: mockKey.maxBudget,
              currentSpend: mockKey.currentSpend,
              tpmLimit: mockKey.tpmLimit,
              rpmLimit: mockKey.rpmLimit,
              metadata: mockKey.metadata,
            },
          };
        }
        return { isValid: false, error: 'API key not found' };
      }

      const apiKey = await this.fastify.dbUtils.queryOne(
        `SELECT ak.*, 
           ARRAY_AGG(DISTINCT akm.model_id) FILTER (WHERE akm.model_id IS NOT NULL) as models
         FROM api_keys ak
         LEFT JOIN api_key_models akm ON ak.id = akm.api_key_id
         WHERE ak.key_hash = $1 AND ak.is_active = true
         GROUP BY ak.id`,
        [keyHash]
      );

      if (!apiKey) {
        return { isValid: false, error: 'API key not found' };
      }

      // Check if key is expired
      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return { isValid: false, error: 'API key expired' };
      }

      // For backward compatibility, load models from subscription if no models in junction table
      if ((!apiKey.models || apiKey.models.length === 0) && apiKey.subscription_id) {
        const subscription = await this.fastify.dbUtils.queryOne(
          `SELECT s.model_id, s.status FROM subscriptions s WHERE s.id = $1`,
          [apiKey.subscription_id]
        );
        
        if (subscription) {
          if (subscription.status !== 'active') {
            return { isValid: false, error: `Subscription is ${subscription.status}` };
          }
          apiKey.models = [subscription.model_id];
        }
      }

      // Update last used timestamp
      await this.updateLastUsed(apiKey.id);

      return {
        isValid: true,
        apiKey: {
          id: apiKey.id,
          userId: apiKey.user_id,
          models: apiKey.models || [],
          name: apiKey.name || '',
          keyHash: apiKey.key_hash,
          keyPrefix: apiKey.key_prefix,
          isActive: apiKey.is_active,
          createdAt: new Date(apiKey.created_at),
          lastUsedAt: apiKey.last_used_at ? new Date(apiKey.last_used_at) : undefined,
          expiresAt: apiKey.expires_at ? new Date(apiKey.expires_at) : undefined,
          revokedAt: apiKey.revoked_at ? new Date(apiKey.revoked_at) : undefined,
          liteLLMKeyId: apiKey.lite_llm_key_id,
          lastSyncAt: apiKey.last_sync_at ? new Date(apiKey.last_sync_at) : undefined,
          syncStatus: apiKey.sync_status,
          syncError: apiKey.sync_error,
          maxBudget: apiKey.max_budget,
          currentSpend: apiKey.current_spend,
          tpmLimit: apiKey.tpm_limit,
          rpmLimit: apiKey.rpm_limit,
          metadata: apiKey.metadata,
        },
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to validate API key');
      return { isValid: false, error: 'Validation failed' };
    }
  }

  async deleteApiKey(keyId: string, userId: string): Promise<void> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      // Delete from LiteLLM if integrated
      if (apiKey.liteLLMKeyId && !this.shouldUseMockData()) {
        try {
          await this.liteLLMService.deleteKey(apiKey.liteLLMKeyId);
        } catch (error) {
          this.fastify.log.warn(error, 'Failed to delete key from LiteLLM, proceeding with local deletion');
        }
      }

      // Delete from local database
      await this.fastify.dbUtils.query(
        'DELETE FROM api_keys WHERE id = $1',
        [keyId]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'API_KEY_DELETE',
          'API_KEY',
          keyId,
          { 
            models: apiKey.models,
            keyName: apiKey.name,
            keyPrefix: apiKey.keyPrefix
          },
        ]
      );

      this.fastify.log.info({
        userId,
        apiKeyId: keyId,
        models: apiKey.models,
      }, 'API key deleted');
    } catch (error) {
      this.fastify.log.error(error, 'Failed to delete API key');
      throw error;
    }
  }

  // Private helper methods
  private calculateDuration(expiresAt: Date): string {
    const diffMs = expiresAt.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays}d`;
  }

  private generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
    const keyBytes = randomBytes(this.KEY_LENGTH);
    const keyHex = keyBytes.toString('hex');
    const key = `${this.KEY_PREFIX}${keyHex}`;
    const keyHash = this.hashApiKey(key);
    const keyPrefix = this.extractKeyPrefix(key);
    return { key, keyHash, keyPrefix };
  }

  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private extractKeyPrefix(key: string): string {
    return key.substring(0, this.KEY_PREFIX.length + this.PREFIX_LENGTH);
  }

  private isValidKeyFormat(key: string): boolean {
    const expectedLength = this.KEY_PREFIX.length + (this.KEY_LENGTH * 2);
    return (
      typeof key === 'string' &&
      key.length === expectedLength &&
      key.startsWith(this.KEY_PREFIX) &&
      /^[a-f0-9]+$/.test(key.substring(this.KEY_PREFIX.length))
    );
  }

  private verifyKeyHash(providedHash: string, storedHash: string): boolean {
    if (providedHash.length !== storedHash.length) {
      return false;
    }
    const providedBuffer = Buffer.from(providedHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    return timingSafeEqual(providedBuffer, storedBuffer);
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    try {
      await this.fastify.dbUtils.query(
        'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [keyId]
      );
    } catch (error) {
      this.fastify.log.warn(error, 'Failed to update last used timestamp');
    }
  }

  private mapToEnhancedApiKey(
    apiKey: any, 
    liteLLMResponse?: LiteLLMKeyGenerationResponse,
    liteLLMInfo?: LiteLLMKeyInfo
  ): EnhancedApiKey {
    return {
      id: apiKey.id,
      userId: apiKey.user_id,
      models: apiKey.models || [],
      name: apiKey.name,
      keyHash: apiKey.key_hash,
      keyPrefix: apiKey.key_prefix,
      lastUsedAt: apiKey.last_used_at ? new Date(apiKey.last_used_at) : undefined,
      expiresAt: apiKey.expires_at ? new Date(apiKey.expires_at) : undefined,
      isActive: apiKey.is_active,
      createdAt: new Date(apiKey.created_at),
      revokedAt: apiKey.revoked_at ? new Date(apiKey.revoked_at) : undefined,
      liteLLMKeyId: apiKey.lite_llm_key_id || liteLLMResponse?.key,
      lastSyncAt: apiKey.last_sync_at ? new Date(apiKey.last_sync_at) : undefined,
      syncStatus: apiKey.sync_status || 'pending',
      syncError: apiKey.sync_error,
      maxBudget: apiKey.max_budget,
      currentSpend: apiKey.current_spend,
      tpmLimit: apiKey.tpm_limit,
      rpmLimit: apiKey.rpm_limit,
      metadata: apiKey.metadata,
      // Include model details if available
      modelDetails: apiKey.model_details || [],
      // Keep subscription info for backward compatibility
      subscriptionDetails: apiKey.subscription_id ? [{
        subscriptionId: apiKey.subscription_id,
        modelId: apiKey.models?.[0] || '',
        status: 'active',
        quotaRequests: 0,
        usedRequests: 0,
      }] : undefined,
    };
  }

  // Removed duplicate validateApiKey and hashApiKey methods
  // Main validateApiKey method has been updated above to handle multi-model support

  /**
   * Ensures user exists in LiteLLM backend, creating them if necessary
   */
  private async ensureUserExistsInLiteLLM(userId: string): Promise<void> {
    try {
      // First check if user exists in LiteLLM
      await this.liteLLMService.getUserInfo(userId);
      this.fastify.log.debug({ userId }, 'User already exists in LiteLLM');
    } catch (error) {
      // User doesn't exist in LiteLLM, get user from database and create them
      this.fastify.log.info({ userId }, 'Creating user in LiteLLM for API key creation');
      
      try {
        // Get user information from database
        const user = await this.fastify.dbUtils.queryOne(
          'SELECT id, username, email, full_name, roles, max_budget, tpm_limit, rpm_limit FROM users WHERE id = $1',
          [userId]
        );

        if (!user) {
          throw new Error(`User ${userId} not found in database`);
        }

        // Create user in LiteLLM
        await this.liteLLMService.createUser({
          user_id: user.id,
          user_email: user.email,
          user_alias: user.username,
          user_role: user.roles?.includes('admin') ? 'proxy_admin' : 'internal_user',
          max_budget: user.max_budget || 100, // Use user's budget or default
          tpm_limit: user.tpm_limit || 1000,  // Use user's limit or default
          rpm_limit: user.rpm_limit || 60,    // Use user's limit or default
          auto_create_key: false, // Don't auto-create key during user creation
        });

        // Update user sync status in database
        await this.fastify.dbUtils.query(
          'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
          ['synced', userId]
        );

        this.fastify.log.info({ userId }, 'Successfully created user in LiteLLM for API key creation');
      } catch (createError) {
        // Update user sync status to error
        await this.fastify.dbUtils.query(
          'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
          ['error', userId]
        );

        this.fastify.log.error({
          userId,
          error: createError instanceof Error ? createError.message : 'Unknown error'
        }, 'Failed to create user in LiteLLM for API key creation');
        
        throw new Error(`Failed to create user in LiteLLM: ${createError instanceof Error ? createError.message : 'Unknown error'}`);
      }
    }
  }
}
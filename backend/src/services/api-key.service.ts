import { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'crypto';
import { LiteLLMService } from './litellm.service.js';
import { BaseService } from './base.service.js';
import { LiteLLMSyncUtils } from '../utils/litellm-sync.utils.js';
import {
  EnhancedApiKey,
  LiteLLMKeyGenerationResponse,
  LiteLLMKeyInfo,
  ApiKeyListParams,
  CreateApiKeyRequest,
  LegacyCreateApiKeyRequest,
  UpdateApiKeyRequest,
  LiteLLMKeyGenerationRequest,
  ApiKeyValidation,
} from '../types/api-key.types.js';
import { QueryParameter } from '../types/common.types.js';

// Types moved to types/api-key.types.ts for consistency
// Keeping legacy interface for backward compatibility in service
export interface ServiceCreateApiKeyRequest {
  subscriptionId: string;
  name?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
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

export class ApiKeyService extends BaseService {
  private liteLLMService: LiteLLMService;
  private readonly KEY_PREFIX = 'sk-';
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
      keyPrefix: 'sk-Ax7m',
      lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      liteLLMKeyId: 'sk-litellm-mock-key-1',
      lastSyncAt: new Date(Date.now() - 30 * 60 * 1000),
      syncStatus: 'synced',
      maxBudget: 500,
      currentSpend: 125.5,
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
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'anthropic',
          contextLength: 200000,
        },
      ],
      subscriptionDetails: [
        {
          subscriptionId: 'sub-mock-1',
          modelId: 'gpt-4o',
          status: 'active',
          quotaRequests: 1000,
          usedRequests: 250,
        },
      ],
    },
    {
      id: 'key-mock-2',
      userId: 'user-mock-1',
      models: ['gpt-4o-mini'],
      name: 'Development API Key',
      keyHash: 'mock-hash-2',
      keyPrefix: 'sk-Bk9n',
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
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextLength: 128000 },
      ],
      subscriptionDetails: [
        {
          subscriptionId: 'sub-mock-2',
          modelId: 'gpt-4o-mini',
          status: 'active',
          quotaRequests: 500,
          usedRequests: 50,
        },
      ],
    },
  ];

  constructor(fastify: FastifyInstance, liteLLMService: LiteLLMService) {
    super(fastify);
    this.liteLLMService = liteLLMService;
  }

  async createApiKey(
    userId: string,
    request: CreateApiKeyRequest | LegacyCreateApiKeyRequest,
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
          [request.subscriptionId, userId],
        );

        if (!subscription) {
          throw this.createNotFoundError(
            'Subscription',
            request.subscriptionId,
            'Subscription not found. Please verify the subscription exists and is accessible',
          );
        }

        if (subscription.status !== 'active') {
          throw this.createValidationError(
            `Cannot create API key for ${subscription.status} subscription`,
            'subscriptionStatus',
            subscription.status,
            'Subscription must be active to create API keys',
          );
        }

        modelIds = [String(subscription.model_id)];

        this.fastify.log.warn({
          userId,
          subscriptionId: request.subscriptionId,
          message: 'Using deprecated subscriptionId parameter. Please migrate to modelIds.',
        });
      } else {
        modelIds = request.modelIds;

        if (!modelIds || modelIds.length === 0) {
          throw this.createValidationError(
            'At least one model must be selected',
            'modelIds',
            modelIds,
            'Please select at least one model for the API key',
          );
        }
      }

      // Ensure team exists in LiteLLM if team_id is provided
      if (request.teamId) {
        await LiteLLMSyncUtils.ensureTeamExistsInLiteLLM(
          request.teamId,
          this.fastify,
          this.liteLLMService,
        );
      }

      // Ensure user exists in LiteLLM
      await LiteLLMSyncUtils.ensureUserExistsInLiteLLM(userId, this.fastify, this.liteLLMService);

      if (this.shouldUseMockData()) {
        // Mock implementation
        const mockKey = this.generateApiKey();
        const mockApiKey: ApiKeyWithSecret = {
          id: `key-${Date.now()}`,
          subscriptionId: isLegacyRequest
            ? (request as LegacyCreateApiKeyRequest).subscriptionId
            : undefined,
          userId,
          name: request.name || 'New API Key',
          keyPrefix: mockKey.keyPrefix,
          lastUsedAt: undefined,
          expiresAt: request.expiresAt,
          isActive: true,
          createdAt: new Date(),
          models: modelIds,
          modelDetails: modelIds.map((id) => ({
            id,
            name: `Mock Model ${id}`,
            provider: 'mock',
            context_length: 4096,
          })),
          key: mockKey.key,
        };

        return this.createMockResponse(mockApiKey);
      }

      // Validate user has active subscriptions for all requested models
      const validModels = await this.fastify.dbUtils.queryMany(
        `SELECT DISTINCT s.model_id, s.id as subscription_id, 
                m.name as model_name, m.provider
         FROM subscriptions s
         JOIN models m ON s.model_id = m.id
         WHERE s.user_id = $1 
           AND s.status = 'active' 
           AND s.model_id = ANY($2::text[])`,
        [userId, `{${modelIds.join(',')}}`],
      );

      const validModelIds = validModels.map((m) => m.model_id);
      const invalidModels = modelIds.filter((id) => !validModelIds.includes(id));

      if (invalidModels.length > 0) {
        throw this.createValidationError(
          `You do not have active subscriptions for the following models: ${invalidModels.join(', ')}`,
          'modelIds',
          invalidModels,
          'Please ensure you have active subscriptions for all selected models',
        );
      }

      // Check API key limits per user
      const existingKeysCount = await this.fastify.dbUtils.queryOne(
        `SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = true`,
        [userId],
      );

      const maxKeysPerUser = 10;
      if (existingKeysCount && parseInt(String(existingKeysCount.count)) >= maxKeysPerUser) {
        throw this.createValidationError(
          `Maximum ${maxKeysPerUser} active API keys allowed per user`,
          'activeKeysCount',
          existingKeysCount.count,
          `Please revoke some existing API keys before creating new ones. Current limit: ${maxKeysPerUser}`,
        );
      }

      // Create API key in LiteLLM with multiple models
      const liteLLMRequest: LiteLLMKeyGenerationRequest = {
        key_alias: this.generateUniqueKeyAlias(request.name || 'api-key'),
        duration: request.expiresAt ? this.calculateDuration(request.expiresAt) : undefined,
        models: modelIds, // Pass all model IDs
        max_budget: request.maxBudget,
        user_id: userId,
        team_id: request.teamId,
        tpm_limit: request.tpmLimit,
        rpm_limit: request.rpmLimit,
        budget_duration: request.budgetDuration,
        permissions: request.permissions
          ? {
              allow_chat_completions: request.permissions.allowChatCompletions,
              allow_embeddings: request.permissions.allowEmbeddings,
              allow_completions: request.permissions.allowCompletions,
            }
          : undefined,
        tags: request.tags,
        soft_budget: request.softBudget,
        guardrails: request.guardrails,
        metadata: {
          created_by: 'litemaas',
          model_count: modelIds.length,
          legacy_request: isLegacyRequest,
          ...request.metadata,
        },
      };

      const liteLLMResponse = await this.liteLLMService.generateApiKey(liteLLMRequest);

      // FIXED: Validate that we got a proper LiteLLM key and extract correct prefix
      if (!liteLLMResponse || !liteLLMResponse.key) {
        throw this.createNotFoundError(
          'LiteLLM API key',
          undefined,
          'Failed to generate LiteLLM API key. Please try again or contact support',
        );
      }

      // FIXED: Extract prefix and hash from the actual LiteLLM key
      const keyPrefix = this.extractKeyPrefix(liteLLMResponse.key);
      const keyHash = this.hashApiKey(liteLLMResponse.key);

      // Begin transaction for atomicity
      const client = await this.fastify.pg.connect();

      try {
        await client.query('BEGIN');

        // Store the API key with hash of the actual LiteLLM key for authentication
        const apiKey = await client.query(
          `INSERT INTO api_keys (
            user_id, name, key_hash, key_prefix,
            expires_at, is_active, lite_llm_key_value, litellm_key_alias,
            max_budget, current_spend, tpm_limit, rpm_limit,
            budget_duration, soft_budget,
            last_sync_at, sync_status, metadata
            ${isLegacyRequest ? ', subscription_id' : ''}
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17${isLegacyRequest ? ', $18' : ''})
          RETURNING *`,
          [
            userId,
            request.name,
            keyHash,
            keyPrefix,
            request.expiresAt,
            true,
            liteLLMResponse.key,
            liteLLMRequest.key_alias, // Save the key_alias for usage matching
            request.maxBudget,
            0,
            request.tpmLimit,
            request.rpmLimit,
            request.budgetDuration || null,
            request.softBudget || null,
            new Date(),
            'synced',
            request.metadata || {},
            ...(isLegacyRequest ? [(request as LegacyCreateApiKeyRequest).subscriptionId] : []),
          ],
        );

        // Insert model associations
        for (const modelId of modelIds) {
          await client.query(`INSERT INTO api_key_models (api_key_id, model_id) VALUES ($1, $2)`, [
            apiKey.rows[0].id,
            modelId,
          ]);
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
            JSON.stringify({
              name: request.name,
              keyPrefix,
              liteLLMKeyId: liteLLMResponse.key,
              models: modelIds,
              modelCount: modelIds.length,
              legacy: isLegacyRequest,
            }),
          ],
        );

        await client.query('COMMIT');

        this.fastify.log.info(
          {
            userId,
            apiKeyId: apiKey.rows[0].id,
            keyPrefix,
            liteLLMKeyId: liteLLMResponse.key,
            models: modelIds,
            modelCount: modelIds.length,
            keyAlias: liteLLMRequest.key_alias,
            originalName: request.name,
          },
          'API key created with multi-model support',
        );

        const apiKeyData = apiKey.rows[0] as {
          id: string;
          user_id: string;
          models?: string[];
          name?: string;
          key_hash: string;
          key_prefix: string;
          last_used_at?: Date | string;
          expires_at?: Date | string;
          is_active: boolean;
          created_at: Date | string;
          revoked_at?: Date | string;
          lite_llm_key_value?: string;
          last_sync_at?: Date | string;
          sync_status?: string;
          sync_error?: string;
          max_budget?: number;
          current_spend?: number;
          tpm_limit?: number;
          rpm_limit?: number;
          metadata?: Record<string, unknown>;
          subscription_id?: string;
        };
        const enhancedApiKey = this.mapToEnhancedApiKey(apiKeyData, liteLLMResponse);
        return {
          id: enhancedApiKey.id,
          userId: enhancedApiKey.userId,
          name: enhancedApiKey.name,
          keyPrefix: enhancedApiKey.keyPrefix,
          lastUsedAt: enhancedApiKey.lastUsedAt,
          expiresAt: enhancedApiKey.expiresAt,
          isActive: enhancedApiKey.isActive,
          createdAt: enhancedApiKey.createdAt,
          key: liteLLMResponse.key, // FIXED: Return the actual LiteLLM key instead of fake local key
          models: modelIds,
          modelDetails: validModels.map((m) => ({
            id: String(m.model_id),
            name: String(m.model_name),
            provider: String(m.provider),
            context_length: Number(m.context_length),
          })),
          subscriptionId: isLegacyRequest
            ? (request as LegacyCreateApiKeyRequest).subscriptionId
            : undefined,
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
      const mockKey = this.MOCK_API_KEYS.find((k) => k.id === keyId);
      return mockKey ? this.createMockResponse(mockKey) : null;
    }

    try {
      // Updated query to handle both multi-model and legacy subscription-based keys
      const apiKey = await this.fastify.dbUtils.queryOne<{
        id: string;
        user_id: string;
        models?: string[];
        name?: string;
        key_hash: string;
        key_prefix: string;
        last_used_at?: Date | string;
        expires_at?: Date | string;
        is_active: boolean;
        created_at: Date | string;
        revoked_at?: Date | string;
        lite_llm_key_value?: string;
        last_sync_at?: Date | string;
        sync_status?: string;
        sync_error?: string;
        max_budget?: number;
        current_spend?: number;
        tpm_limit?: number;
        rpm_limit?: number;
        metadata?: Record<string, unknown>;
        subscription_id?: string;
      }>(
        `
        SELECT ak.*
        FROM api_keys ak
        WHERE ak.id = $1 AND ak.user_id = $2
      `,
        [keyId, userId],
      );

      if (!apiKey) {
        return null;
      }

      // Get associated models for multi-model keys
      if (!apiKey.subscription_id) {
        const modelRows = await this.fastify.dbUtils.queryMany(
          `
          SELECT m.id as model_id, m.name as model_name, m.provider, m.context_length
          FROM api_key_models akm
          JOIN models m ON akm.model_id = m.id
          WHERE akm.api_key_id = $1
        `,
          [keyId],
        );

        apiKey.models = modelRows.map((row) => String(row.model_id));
      }

      const enhancedKey = this.mapToEnhancedApiKey(apiKey);

      // For individual key retrieval, return the full LiteLLM key
      // This is used when users need to copy the actual key to use
      if (apiKey.lite_llm_key_value) {
        // PHASE 1 FIX: Validate LiteLLM key exists and is valid
        try {
          return {
            ...enhancedKey,
            liteLLMKey: apiKey.lite_llm_key_value, // Full LiteLLM key for individual retrieval
            liteLLMKeyId: apiKey.lite_llm_key_value,
          };
        } catch (error) {
          this.fastify.log.warn({ keyId, error }, 'Failed to retrieve LiteLLM key');
          return {
            ...enhancedKey,
            liteLLMKey: undefined, // No valid LiteLLM key available
            liteLLMKeyId: apiKey.lite_llm_key_value,
          };
        }
      }

      // No LiteLLM key available
      return {
        ...enhancedKey,
        liteLLMKey: undefined,
        liteLLMKeyId: apiKey.lite_llm_key_value,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get API key');
      throw error;
    }
  }

  /**
   * Securely retrieve the full API key value for a user
   * This method includes enhanced security measures and audit logging
   */
  async retrieveFullKey(keyId: string, userId: string): Promise<string> {
    if (this.shouldUseMockData()) {
      const mockKey = this.MOCK_API_KEYS.find((k) => k.id === keyId);
      if (!mockKey) {
        throw this.createNotFoundError('API key', keyId, 'API key not found in mock data');
      }
      // Generate a mock key based on the keyPrefix and id
      return `${mockKey.keyPrefix}-${mockKey.id.replace('key-mock-', 'mockkey')}`;
    }

    try {
      // Verify ownership and get the API key
      const apiKey = await this.fastify.dbUtils.queryOne(
        `SELECT ak.id, ak.user_id, ak.name, ak.lite_llm_key_value, ak.is_active,
                ak.created_at, ak.expires_at, ak.last_used_at
         FROM api_keys ak
         WHERE ak.id = $1 AND ak.user_id = $2`,
        [keyId, userId],
      );

      if (!apiKey) {
        throw this.createNotFoundError(
          'API key',
          keyId,
          'API key not found or you do not have permission to access it',
        );
      }

      // Additional security checks
      if (!apiKey.is_active) {
        throw this.createValidationError(
          'API key is inactive',
          'isActive',
          false,
          'This API key has been deactivated and cannot be used',
        );
      }

      if (apiKey.expires_at && new Date(String(apiKey.expires_at)) < new Date()) {
        throw this.createValidationError(
          'API key has expired',
          'expiresAt',
          apiKey.expires_at,
          'Please create a new API key to continue using the service',
        );
      }

      if (!apiKey.lite_llm_key_value) {
        throw this.createNotFoundError(
          'LiteLLM key',
          keyId,
          'No LiteLLM key associated with this API key. Please sync with LiteLLM',
        );
      }

      // Create comprehensive audit log for key retrieval
      const auditMetadata = {
        timestamp: new Date().toISOString(),
        keyId: keyId,
        keyName: apiKey.name,
        userAgent: null, // Will be added by the route handler
        ipAddress: null, // Will be added by the route handler
        retrievalMethod: 'secure_endpoint',
        securityLevel: 'enhanced',
      };

      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'API_KEY_RETRIEVE_FULL', 'API_KEY', keyId, JSON.stringify(auditMetadata)],
      );

      // Update retrieval tracking (if columns exist)
      try {
        await this.fastify.dbUtils.query(
          `UPDATE api_keys 
           SET last_retrieved_at = NOW(), 
               retrieval_count = COALESCE(retrieval_count, 0) + 1
           WHERE id = $1`,
          [keyId],
        );
      } catch (updateError) {
        // Ignore if columns don't exist yet (they'll be added in Phase 2 migration)
        this.fastify.log.debug('Could not update retrieval tracking, columns may not exist yet');
      }

      this.fastify.log.info(
        {
          userId,
          keyId,
          keyName: apiKey.name,
          lastUsed: apiKey.last_used_at,
        },
        'API key full value retrieved securely',
      );

      return String(apiKey.lite_llm_key_value);
    } catch (error) {
      this.fastify.log.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          keyId,
        },
        'Failed to retrieve full API key',
      );
      throw error;
    }
  }

  async getUserApiKeys(
    userId: string,
    options: ApiKeyListParams = {},
  ): Promise<{ data: EnhancedApiKey[]; total: number }> {
    const { subscriptionId, modelIds, isActive, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    if (this.shouldUseMockData()) {
      this.fastify.log.debug('Using mock API key data');

      let filteredKeys = [...this.MOCK_API_KEYS];

      if (subscriptionId) {
        // For backward compatibility, check subscriptionDetails
        filteredKeys = filteredKeys.filter((key) =>
          key.subscriptionDetails?.some((sub) => sub.subscriptionId === subscriptionId),
        );
      }

      if (typeof isActive === 'boolean') {
        filteredKeys = filteredKeys.filter((key) => key.isActive === isActive);
      }

      const total = filteredKeys.length;
      const paginatedData = filteredKeys.slice(offset, offset + limit);

      return this.createMockResponse({
        data: paginatedData,
        total,
      });
    }

    try {
      // Updated query to include model associations and LiteLLM key
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
      const params: (string | boolean | string[] | number)[] = [userId];

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
        // @ts-expect-error: Array parameter required for PostgreSQL ANY() operation
        countParams.push(modelIds);
      }

      if (typeof isActive === 'boolean') {
        countQuery += ` AND ak.is_active = $${countParams.length + 1}`;
        // @ts-expect-error: Boolean parameter valid for PostgreSQL
        countParams.push(isActive);
      }

      const [apiKeys, countResult] = await Promise.all([
        this.fastify.dbUtils.queryMany(query, params as QueryParameter[]),
        this.fastify.dbUtils.queryOne(countQuery, countParams),
      ]);

      // For backward compatibility, include model from subscription if no models in junction table
      for (const key of apiKeys) {
        if ((!key.models || (key.models as string[]).length === 0) && key.subscription_id) {
          const subscription = await this.fastify.dbUtils.queryOne(
            `SELECT s.model_id, m.name, m.provider, m.context_length
             FROM subscriptions s
             JOIN models m ON s.model_id = m.id
             WHERE s.id = $1`,
            [String(key.subscription_id)],
          );

          if (subscription) {
            key.models = [subscription.model_id];
            key.model_details = [
              {
                id: subscription.model_id,
                name: subscription.name,
                provider: subscription.provider,
                context_length: subscription.context_length,
              },
            ];
          }
        }
      }

      // Enhanced mapping to include masked LiteLLM keys
      return {
        data: apiKeys.map((key) => {
          const typedKey = key as {
            id: string;
            user_id: string;
            models?: string[];
            name?: string;
            key_hash: string;
            key_prefix: string;
            last_used_at?: Date | string;
            expires_at?: Date | string;
            is_active: boolean;
            created_at: Date | string;
            revoked_at?: Date | string;
            lite_llm_key_value?: string;
            last_sync_at?: Date | string;
            sync_status?: string;
            sync_error?: string;
            max_budget?: number;
            current_spend?: number;
            tpm_limit?: number;
            rpm_limit?: number;
            metadata?: Record<string, unknown>;
            model_details?: unknown[];
            subscription_id?: string;
          };
          const enhancedKey = this.mapToEnhancedApiKey(typedKey);

          // Add the actual LiteLLM key with masking for security in list views
          if (typedKey.lite_llm_key_value) {
            // PHASE 1 FIX: Add validation for LiteLLM key format
            try {
              const liteLLMKey = String(typedKey.lite_llm_key_value);
              const maskedKey =
                liteLLMKey.length > 12
                  ? `${liteLLMKey.substring(0, 8)}...${liteLLMKey.substring(liteLLMKey.length - 4)}`
                  : `${liteLLMKey.substring(0, 4)}...`;

              return {
                ...enhancedKey,
                liteLLMKey: maskedKey, // Add masked LiteLLM key for display
                liteLLMKeyId: typedKey.lite_llm_key_value, // Keep full key ID for internal use
              };
            } catch (error) {
              this.fastify.log.warn({ keyId: typedKey.id, error }, 'Failed to mask LiteLLM key');
              return {
                ...enhancedKey,
                liteLLMKey: 'key-***masked***', // Fallback display
                liteLLMKeyId: typedKey.lite_llm_key_value,
              };
            }
          }

          return {
            ...enhancedKey,
            liteLLMKey: undefined, // No LiteLLM key available
            liteLLMKeyId: typedKey.lite_llm_key_value,
          };
        }),
        total: countResult ? parseInt(String(countResult.count)) : 0,
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
        throw this.createNotFoundError(
          'API key',
          keyId,
          'API key not found or you do not have permission to access it',
        );
      }

      if (!apiKey.liteLLMKeyId) {
        throw this.createValidationError(
          'API key is not integrated with LiteLLM',
          'liteLLMKeyId',
          apiKey.liteLLMKeyId,
          'Please sync this API key with LiteLLM first',
        );
      }

      // Get current info from LiteLLM
      const liteLLMInfo = await this.liteLLMService.getKeyInfo(apiKey.liteLLMKeyId);

      // Update local database with LiteLLM data
      const updatedApiKey = await this.fastify.dbUtils.queryOne<{
        id: string;
        user_id: string;
        models?: string[];
        name?: string;
        key_hash: string;
        key_prefix: string;
        last_used_at?: Date | string;
        expires_at?: Date | string;
        is_active: boolean;
        created_at: Date | string;
        revoked_at?: Date | string;
        lite_llm_key_value?: string;
        last_sync_at?: Date | string;
        sync_status?: string;
        sync_error?: string;
        max_budget?: number;
        current_spend?: number;
        tpm_limit?: number;
        rpm_limit?: number;
        metadata?: Record<string, unknown>;
        subscription_id?: string;
      }>(
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
          liteLLMInfo.spend ?? null,
          liteLLMInfo.max_budget ?? null,
          liteLLMInfo.tpm_limit ?? null,
          liteLLMInfo.rpm_limit ?? null,
          keyId,
        ],
      );

      this.fastify.log.info(
        {
          keyId,
          userId,
          spend: liteLLMInfo.spend,
          maxBudget: liteLLMInfo.max_budget,
        },
        'API key synced with LiteLLM',
      );

      if (!updatedApiKey) {
        throw this.createNotFoundError(
          'API key',
          keyId,
          'Failed to update API key. It may have been deleted',
        );
      }

      return this.mapToEnhancedApiKey(updatedApiKey, undefined, liteLLMInfo);
    } catch (error) {
      // Mark sync as failed
      await this.fastify.dbUtils.query(
        `UPDATE api_keys 
         SET sync_status = 'error', 
             sync_error = $1,
             last_sync_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error instanceof Error ? error.message : String(error), keyId],
      );

      this.fastify.log.error(error, 'Failed to sync API key with LiteLLM');
      throw error;
    }
  }

  async getApiKeySpendInfo(keyId: string, userId: string): Promise<ApiKeySpendInfo> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.createNotFoundError(
          'API key',
          keyId,
          'API key not found or you do not have permission to access it',
        );
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
      budgetDuration?: string;
      softBudget?: number;
      allowedModels?: string[];
    },
  ): Promise<EnhancedApiKey> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.createNotFoundError(
          'API key',
          keyId,
          'API key not found or you do not have permission to access it',
        );
      }

      if (!apiKey.isActive) {
        throw this.createValidationError(
          'Cannot update inactive API key',
          'isActive',
          false,
          'Reactivate the API key before making updates',
        );
      }

      // Update in LiteLLM if integrated
      if (apiKey.liteLLMKeyId && !this.shouldUseMockData()) {
        await this.liteLLMService.updateKey(apiKey.liteLLMKeyId, {
          max_budget: updates.maxBudget,
          tpm_limit: updates.tpmLimit,
          rpm_limit: updates.rpmLimit,
          budget_duration: updates.budgetDuration,
          soft_budget: updates.softBudget,
          models: updates.allowedModels,
        });
      }

      // Update local database
      const updatedApiKey = await this.fastify.dbUtils.queryOne<{
        id: string;
        user_id: string;
        models?: string[];
        name?: string;
        key_hash: string;
        key_prefix: string;
        last_used_at?: Date | string;
        expires_at?: Date | string;
        is_active: boolean;
        created_at: Date | string;
        revoked_at?: Date | string;
        lite_llm_key_value?: string;
        last_sync_at?: Date | string;
        sync_status?: string;
        sync_error?: string;
        max_budget?: number;
        current_spend?: number;
        tpm_limit?: number;
        rpm_limit?: number;
        budget_duration?: string;
        soft_budget?: number;
        budget_reset_at?: Date | string;
        metadata?: Record<string, unknown>;
        subscription_id?: string;
      }>(
        `UPDATE api_keys
         SET max_budget = COALESCE($1, max_budget),
             tpm_limit = COALESCE($2, tpm_limit),
             rpm_limit = COALESCE($3, rpm_limit),
             budget_duration = COALESCE($4, budget_duration),
             soft_budget = COALESCE($5, soft_budget),
             last_sync_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [
          updates.maxBudget ?? null,
          updates.tpmLimit ?? null,
          updates.rpmLimit ?? null,
          updates.budgetDuration ?? null,
          updates.softBudget ?? null,
          keyId,
        ],
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'API_KEY_UPDATE', 'API_KEY', keyId, JSON.stringify(updates)],
      );

      this.fastify.log.info(
        {
          keyId,
          userId,
          updates,
        },
        'API key limits updated',
      );

      if (!updatedApiKey) {
        throw this.createNotFoundError(
          'API key',
          keyId,
          'Failed to update API key. It may have been deleted',
        );
      }

      return this.mapToEnhancedApiKey(updatedApiKey);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update API key limits');
      throw error;
    }
  }

  async updateApiKey(
    keyId: string,
    userId: string,
    updates: UpdateApiKeyRequest,
  ): Promise<EnhancedApiKey> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.createNotFoundError(
          'API key',
          keyId,
          'API key not found or you do not have permission to access it',
        );
      }

      if (!apiKey.isActive) {
        throw this.createValidationError(
          'Cannot update inactive API key',
          'isActive',
          false,
          'Reactivate the API key before making updates',
        );
      }

      // Validate models have active subscriptions if modelIds are being updated
      if (updates.modelIds) {
        await this.validateModelsHaveActiveSubscriptions(userId, updates.modelIds);
      }

      // Get the full LiteLLM key for the update call
      let fullKey: string | undefined;
      if (apiKey.liteLLMKeyId && !this.shouldUseMockData()) {
        try {
          // Use the stored LiteLLM key value or try to retrieve it
          fullKey = apiKey.liteLLMKey || (await this.retrieveFullKey(keyId, userId));
        } catch (error) {
          this.fastify.log.warn(
            error,
            'Failed to retrieve full key for LiteLLM update, proceeding with database-only update',
          );
        }
      }

      // Update in LiteLLM if we have the full key
      if (fullKey && !this.shouldUseMockData()) {
        const litellmUpdates: any = {};

        // If name is being updated, also update the key_alias in LiteLLM
        if (updates.name !== undefined) {
          litellmUpdates.key_alias = this.generateUniqueKeyAlias(updates.name);
        }

        if (updates.modelIds) {
          litellmUpdates.models = updates.modelIds;
        }

        if (updates.metadata) {
          litellmUpdates.metadata = updates.metadata;
        }

        await this.liteLLMService.updateKey(fullKey, litellmUpdates);

        this.fastify.log.info(
          {
            keyId,
            userId,
            litellmUpdates,
            nameUpdated: updates.name !== undefined,
            keyAliasGenerated: litellmUpdates.key_alias,
          },
          'LiteLLM API key updated',
        );
      }

      // Build the database update query dynamically
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 0;

      if (updates.name !== undefined) {
        paramCount++;
        updateFields.push(`name = $${paramCount}`);
        updateValues.push(updates.name);
      }

      if (updates.metadata !== undefined) {
        paramCount++;
        updateFields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${paramCount}`);
        updateValues.push(JSON.stringify(updates.metadata));
      }

      // Always update sync timestamp
      updateFields.push(`last_sync_at = CURRENT_TIMESTAMP`);

      // Add WHERE condition
      paramCount++;
      updateValues.push(keyId);
      const whereClause = `WHERE id = $${paramCount}`;

      // Update local database
      const updatedApiKey = await this.fastify.dbUtils.queryOne<{
        id: string;
        user_id: string;
        models?: string[];
        name?: string;
        key_hash: string;
        key_prefix: string;
        last_used_at?: Date | string;
        expires_at?: Date | string;
        is_active: boolean;
        created_at: Date | string;
        revoked_at?: Date | string;
        lite_llm_key_value?: string;
        last_sync_at?: Date | string;
        sync_status?: string;
        sync_error?: string;
        max_budget?: number;
        current_spend?: number;
        tpm_limit?: number;
        rpm_limit?: number;
        metadata?: Record<string, unknown>;
        subscription_id?: string;
      }>(
        `UPDATE api_keys 
         SET ${updateFields.join(', ')}
         ${whereClause}
         RETURNING *`,
        updateValues,
      );

      // Update api_key_models junction table if models were updated
      if (updates.modelIds !== undefined) {
        await this.fastify.dbUtils.query(`DELETE FROM api_key_models WHERE api_key_id = $1`, [
          keyId,
        ]);

        if (updates.modelIds.length > 0) {
          const modelInserts = updates.modelIds.map((_, index) => `($1, $${index + 2})`).join(', ');

          await this.fastify.dbUtils.query(
            `INSERT INTO api_key_models (api_key_id, model_id) VALUES ${modelInserts}`,
            [keyId, ...updates.modelIds],
          );
        }
      }

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'API_KEY_UPDATE', 'API_KEY', keyId, JSON.stringify(updates)],
      );

      this.fastify.log.info(
        {
          keyId,
          userId,
          updates,
        },
        'API key updated',
      );

      if (!updatedApiKey) {
        throw this.createNotFoundError(
          'API key',
          keyId,
          'Failed to update API key. It may have been deleted',
        );
      }

      return this.mapToEnhancedApiKey(updatedApiKey);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update API key');
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
        const mockKey = this.MOCK_API_KEYS.find((k) => k.keyPrefix === keyPrefix);
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
        [keyHash],
      );

      if (!apiKey) {
        return { isValid: false, error: 'API key not found' };
      }

      // Check if key is expired
      if (apiKey.expires_at && new Date(String(apiKey.expires_at)) < new Date()) {
        return { isValid: false, error: 'API key expired' };
      }

      // For backward compatibility, load models from subscription if no models in junction table
      if ((!apiKey.models || (apiKey.models as string[]).length === 0) && apiKey.subscription_id) {
        const subscription = await this.fastify.dbUtils.queryOne(
          `SELECT s.model_id, s.status FROM subscriptions s WHERE s.id = $1`,
          [String(apiKey.subscription_id)],
        );

        if (subscription) {
          if (subscription.status !== 'active') {
            return { isValid: false, error: `Subscription is ${subscription.status}` };
          }
          apiKey.models = [subscription.model_id];
        }
      }

      // Update last used timestamp
      await this.updateLastUsed(String(apiKey.id));

      return {
        isValid: true,
        apiKey: {
          id: String(apiKey.id),
          userId: String(apiKey.user_id),
          models: (apiKey.models as string[]) || [],
          name: String(apiKey.name || ''),
          keyHash: String(apiKey.key_hash),
          keyPrefix: String(apiKey.key_prefix),
          isActive: Boolean(apiKey.is_active),
          createdAt: new Date(String(apiKey.created_at)),
          lastUsedAt: apiKey.last_used_at ? new Date(String(apiKey.last_used_at)) : undefined,
          expiresAt: apiKey.expires_at ? new Date(String(apiKey.expires_at)) : undefined,
          revokedAt: apiKey.revoked_at ? new Date(String(apiKey.revoked_at)) : undefined,
          liteLLMKeyId: apiKey.lite_llm_key_value as string | undefined,
          lastSyncAt: apiKey.last_sync_at ? new Date(String(apiKey.last_sync_at)) : undefined,
          syncStatus: apiKey.sync_status as 'synced' | 'pending' | 'error' | undefined,
          syncError: apiKey.sync_error as string | undefined,
          maxBudget: apiKey.max_budget as number | undefined,
          currentSpend: apiKey.current_spend as number | undefined,
          tpmLimit: apiKey.tpm_limit as number | undefined,
          rpmLimit: apiKey.rpm_limit as number | undefined,
          metadata: apiKey.metadata as Record<string, unknown>,
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
        throw this.createNotFoundError(
          'API key',
          keyId,
          'API key not found or you do not have permission to access it',
        );
      }

      // Delete from LiteLLM if integrated
      if (apiKey.liteLLMKeyId && !this.shouldUseMockData()) {
        try {
          await this.liteLLMService.deleteKey(apiKey.liteLLMKeyId);
        } catch (error) {
          this.fastify.log.warn(
            error,
            'Failed to delete key from LiteLLM, proceeding with local deletion',
          );
        }
      }

      // Delete from local database
      await this.fastify.dbUtils.query('DELETE FROM api_keys WHERE id = $1', [keyId]);

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'API_KEY_DELETE',
          'API_KEY',
          keyId,
          JSON.stringify({
            models: apiKey.models,
            keyName: apiKey.name,
            keyPrefix: apiKey.keyPrefix,
          }),
        ],
      );

      this.fastify.log.info(
        {
          userId,
          apiKeyId: keyId,
          models: apiKey.models,
        },
        'API key deleted',
      );
    } catch (error) {
      this.fastify.log.error(error, 'Failed to delete API key');
      throw error;
    }
  }

  async rotateApiKey(
    keyId: string,
    userId: string,
  ): Promise<{ id: string; key: string; keyPrefix: string }> {
    try {
      // Get existing API key
      const existingKey = await this.getApiKey(keyId, userId);
      if (!existingKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      // Use transaction wrapper
      return await this.fastify.dbUtils.withTransaction(async (client) => {
        // Variables for new key
        let keyPrefix: string;
        let hashedKey: string;
        let newKeyValue: string;

        // If LiteLLM integration is enabled, rotate key there first
        let liteLLMResponse: { key: string } | undefined;
        if (existingKey.liteLLMKeyId && !this.shouldUseMockData()) {
          try {
            // Delete old key from LiteLLM
            await this.liteLLMService.deleteKey(existingKey.liteLLMKeyId);

            // Create new key in LiteLLM
            liteLLMResponse = await this.liteLLMService.generateApiKey({
              models: existingKey.models || [],
              duration: existingKey.expiresAt
                ? this.calculateDuration(existingKey.expiresAt)
                : undefined,
              max_budget: existingKey.maxBudget,
              tpm_limit: existingKey.tpmLimit,
              rpm_limit: existingKey.rpmLimit,
              metadata: {
                ...existingKey.metadata,
                user_id: userId,
                litemaas_key_id: keyId,
                rotated_at: new Date().toISOString(),
              },
            });

            // FIXED: Extract prefix and hash from the actual LiteLLM key
            if (liteLLMResponse?.key) {
              keyPrefix = this.extractKeyPrefix(liteLLMResponse.key);
              hashedKey = this.hashApiKey(liteLLMResponse.key);
              newKeyValue = liteLLMResponse.key;
            } else {
              throw new Error('LiteLLM did not return a key');
            }

            // Update database with LiteLLM key and correct prefix
            await client.query(
              `UPDATE api_keys
               SET key_hash = $1, key_prefix = $2, lite_llm_key_value = $3, updated_at = CURRENT_TIMESTAMP
               WHERE id = $4`,
              [hashedKey, keyPrefix, newKeyValue, keyId],
            );
          } catch (error) {
            this.fastify.log.warn(
              error,
              'Failed to rotate key in LiteLLM, proceeding with local rotation only',
            );

            // Fallback: Generate local key
            const localKey = this.generateApiKey();
            keyPrefix = localKey.keyPrefix;
            hashedKey = this.hashApiKey(localKey.key);
            newKeyValue = localKey.key;

            // Update database with local key only
            await client.query(
              `UPDATE api_keys
               SET key_hash = $1, key_prefix = $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $3`,
              [hashedKey, keyPrefix, keyId],
            );
          }
        } else {
          // No LiteLLM integration - generate local key
          const localKey = this.generateApiKey();
          keyPrefix = localKey.keyPrefix;
          hashedKey = this.hashApiKey(localKey.key);
          newKeyValue = localKey.key;

          await client.query(
            `UPDATE api_keys
             SET key_hash = $1, key_prefix = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [hashedKey, keyPrefix, keyId],
          );
        }

        // Create audit log
        await client.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            'API_KEY_ROTATE',
            'API_KEY',
            keyId,
            JSON.stringify({
              models: existingKey.models,
              keyName: existingKey.name,
              oldPrefix: existingKey.keyPrefix,
              newPrefix: keyPrefix,
            }),
          ],
        );

        this.fastify.log.info(
          {
            userId,
            apiKeyId: keyId,
            models: existingKey.models,
            oldPrefix: existingKey.keyPrefix,
            newPrefix: keyPrefix,
          },
          'API key rotated',
        );

        return {
          id: keyId,
          key: newKeyValue, // Return the new key (LiteLLM or local)
          keyPrefix,
        };
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to rotate API key');
      throw error;
    }
  }

  async getApiKeyStats(userId: string): Promise<{
    total: number;
    active: number;
    expired: number;
    revoked: number;
    bySubscription: Record<string, number>;
    byModel: Record<string, number>;
  }> {
    try {
      // Get counts by status
      const statusResult = await this.fastify.dbUtils.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_active = true AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 END) as active,
          COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 1 END) as expired,
          COUNT(CASE WHEN is_active = false THEN 1 END) as revoked
         FROM api_keys 
         WHERE user_id = $1`,
        [userId],
      );

      // Get count by subscription (legacy)
      const subscriptionResult = await this.fastify.dbUtils.query(
        `SELECT subscription_id, COUNT(*) as count
         FROM api_keys
         WHERE user_id = $1 AND subscription_id IS NOT NULL
         GROUP BY subscription_id`,
        [userId],
      );

      // Get count by model (new multi-model support)
      const modelResult = await this.fastify.dbUtils.query(
        `SELECT akm.model_id, COUNT(DISTINCT ak.id) as count
         FROM api_keys ak
         JOIN api_key_models akm ON ak.id = akm.api_key_id
         WHERE ak.user_id = $1
         GROUP BY akm.model_id`,
        [userId],
      );

      const stats = statusResult.rows[0];
      const bySubscription: Record<string, number> = {};
      const byModel: Record<string, number> = {};

      // Build subscription map
      subscriptionResult.rows.forEach((row) => {
        const typedRow = row as { subscription_id: string; count: string | number };
        bySubscription[typedRow.subscription_id] = parseInt(String(typedRow.count), 10);
      });

      // Build model map
      modelResult.rows.forEach((row) => {
        const typedRow = row as { model_id: string; count: string | number };
        byModel[typedRow.model_id] = parseInt(String(typedRow.count), 10);
      });

      return {
        total: Number(stats?.total || 0),
        active: Number(stats?.active || 0),
        expired: Number(stats?.expired || 0),
        revoked: Number(stats?.revoked || 0),
        bySubscription,
        byModel,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get API key statistics');
      throw error;
    }
  }

  async cleanupExpiredKeys(): Promise<number> {
    try {
      // Use transaction wrapper
      return await this.fastify.dbUtils.withTransaction(async (client) => {
        // Get expired keys with their LiteLLM IDs
        const expiredKeysResult = await client.query(
          `SELECT id, lite_llm_key_value, user_id, name, key_prefix
           FROM api_keys
           WHERE expires_at IS NOT NULL 
           AND expires_at <= NOW()
           AND is_active = true`,
        );

        const expiredKeys = expiredKeysResult.rows;

        if (expiredKeys.length === 0) {
          return 0;
        }

        // Mark expired keys as inactive
        const keyIds = expiredKeys.map((k) => String(k.id));
        await client.query(
          `UPDATE api_keys 
           SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::text[])`,
          [`{${keyIds.join(',')}}`],
        );

        // Delete from LiteLLM if integrated
        if (!this.shouldUseMockData()) {
          for (const key of expiredKeys) {
            if (key.lite_llm_key_value && typeof key.lite_llm_key_value === 'string') {
              try {
                await this.liteLLMService.deleteKey(key.lite_llm_key_value);
              } catch (error) {
                this.fastify.log.warn(
                  { error, litellmKeyId: key.lite_llm_key_value },
                  'Failed to delete expired key from LiteLLM',
                );
              }
            }
          }
        }

        // Create audit logs for each cleaned key
        const auditValues: Array<[string, string, string, string, string]> = expiredKeys.map(
          (key) => [
            String(key.user_id),
            'API_KEY_EXPIRED',
            'API_KEY',
            String(key.id),
            JSON.stringify({
              keyName: key.name,
              keyPrefix: key.key_prefix,
              cleanupReason: 'expired',
            }),
          ],
        );

        if (auditValues.length > 0) {
          const auditQuery = `
            INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
            VALUES ${auditValues.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')}
          `;
          const flattenedValues = auditValues.flat();
          await client.query(auditQuery, flattenedValues);
        }

        this.fastify.log.info(
          {
            cleanedCount: expiredKeys.length,
            keyIds: keyIds,
          },
          'Cleaned up expired API keys',
        );

        return expiredKeys.length;
      });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to cleanup expired API keys');
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

  /**
   * Generates a unique key alias for LiteLLM that ensures global uniqueness
   * while preserving the user's chosen name for display in LiteMaaS
   */
  private generateUniqueKeyAlias(baseName: string): string {
    // Generate a short UUID suffix (8 characters) for uniqueness
    const uuid = randomBytes(4).toString('hex'); // 4 bytes = 8 hex characters

    // Sanitize the base name to remove any problematic characters
    const sanitizedName = baseName
      .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50); // Limit length to keep alias reasonable

    // Return the unique alias
    return `${sanitizedName || 'api-key'}_${uuid}`;
  }

  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private extractKeyPrefix(key: string): string {
    return key.substring(0, this.KEY_PREFIX.length + this.PREFIX_LENGTH);
  }

  private isValidKeyFormat(key: string): boolean {
    const expectedLength = this.KEY_PREFIX.length + this.KEY_LENGTH * 2;
    return (
      typeof key === 'string' &&
      key.length === expectedLength &&
      key.startsWith(this.KEY_PREFIX) &&
      /^[a-f0-9]+$/.test(key.substring(this.KEY_PREFIX.length))
    );
  }

  private async updateLastUsed(keyId: string): Promise<void> {
    try {
      await this.fastify.dbUtils.query(
        'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [keyId],
      );
    } catch (error) {
      this.fastify.log.warn(error, 'Failed to update last used timestamp');
    }
  }

  private mapToEnhancedApiKey(
    apiKey: {
      id: string;
      user_id: string;
      models?: string[];
      name?: string;
      key_hash: string;
      key_prefix: string;
      last_used_at?: Date | string;
      expires_at?: Date | string;
      is_active: boolean;
      created_at: Date | string;
      revoked_at?: Date | string;
      lite_llm_key_value?: string;
      last_sync_at?: Date | string;
      sync_status?: string;
      sync_error?: string;
      max_budget?: number;
      current_spend?: number;
      tpm_limit?: number;
      rpm_limit?: number;
      budget_duration?: string;
      soft_budget?: number;
      budget_reset_at?: Date | string;
      metadata?: Record<string, unknown>;
      model_details?: unknown[];
      subscription_id?: string;
    },
    liteLLMResponse?: LiteLLMKeyGenerationResponse,
    _liteLLMInfo?: LiteLLMKeyInfo,
  ): EnhancedApiKey {
    const budgetUtilization =
      apiKey.max_budget && apiKey.current_spend
        ? Math.round((Number(apiKey.current_spend) / Number(apiKey.max_budget)) * 100)
        : undefined;

    return {
      id: apiKey.id,
      userId: apiKey.user_id,
      models: apiKey.models || [],
      name: apiKey.name || '',
      keyHash: apiKey.key_hash,
      keyPrefix: apiKey.key_prefix,
      lastUsedAt: apiKey.last_used_at ? new Date(apiKey.last_used_at) : undefined,
      expiresAt: apiKey.expires_at ? new Date(apiKey.expires_at) : undefined,
      isActive: apiKey.is_active,
      createdAt: new Date(apiKey.created_at),
      revokedAt: apiKey.revoked_at ? new Date(apiKey.revoked_at) : undefined,
      liteLLMKeyId: apiKey.lite_llm_key_value || liteLLMResponse?.key,
      lastSyncAt: apiKey.last_sync_at ? new Date(apiKey.last_sync_at) : undefined,
      syncStatus: (apiKey.sync_status || 'pending') as 'pending' | 'synced' | 'error',
      syncError: apiKey.sync_error,
      maxBudget: apiKey.max_budget,
      currentSpend: apiKey.current_spend,
      tpmLimit: apiKey.tpm_limit,
      rpmLimit: apiKey.rpm_limit,
      budgetDuration: apiKey.budget_duration,
      softBudget: apiKey.soft_budget,
      budgetResetAt: apiKey.budget_reset_at ? new Date(apiKey.budget_reset_at) : undefined,
      budgetUtilization,
      metadata: apiKey.metadata,
      // Include model details if available
      modelDetails: apiKey.model_details as
        | Array<{
            id: string;
            name: string;
            provider: string;
            contextLength?: number;
          }>
        | undefined,
      // Keep subscription info for backward compatibility
      subscriptionDetails: apiKey.subscription_id
        ? [
            {
              subscriptionId: apiKey.subscription_id,
              modelId: apiKey.models?.[0] || '',
              status: 'active',
              quotaRequests: 0,
              usedRequests: 0,
            },
          ]
        : undefined,
    };
  }

  // Removed duplicate validateApiKey and hashApiKey methods
  // Main validateApiKey method has been updated above to handle multi-model support

  /**
   * Shared validation helper for subscription status
   * Private helper method for approval workflow
   */
  private async validateModelsHaveActiveSubscriptions(
    userId: string,
    modelIds: string[],
  ): Promise<void> {
    if (!modelIds || modelIds.length === 0) {
      return;
    }

    const subscriptions = await this.fastify.dbUtils.queryMany<{
      model_id: string;
      status: string;
    }>(
      `SELECT model_id, status FROM subscriptions
       WHERE user_id = $1 AND model_id = ANY($2)`,
      [userId, modelIds],
    );

    const invalidModels = modelIds.filter((modelId) => {
      const sub = subscriptions.find((s) => s.model_id === modelId);
      return !sub || sub.status !== 'active';
    });

    if (invalidModels.length > 0) {
      throw this.createValidationError(
        `Cannot add models without active subscriptions: ${invalidModels.join(', ')}`,
        'modelIds',
        invalidModels,
        'Ensure all models have active subscriptions before adding them to an API key',
      );
    }
  }

  /**
   * Remove a specific model from all API keys belonging to a user
   * Used when subscription is denied or model becomes restricted
   *
   * CRITICAL: Updates LiteLLM FIRST, then database (security priority)
   * - If LiteLLM update fails → rollback/abort (don't modify database)
   * - If LiteLLM succeeds but database update fails → acceptable (access revoked)
   */
  async removeModelFromUserApiKeys(userId: string, modelId: string): Promise<void> {
    // Get all active API keys for user that contain this model
    const apiKeys = await this.fastify.dbUtils.queryMany<{
      id: string;
      lite_llm_key_value: string;
    }>(
      `SELECT DISTINCT ak.id, ak.lite_llm_key_value
       FROM api_keys ak
       JOIN api_key_models akm ON ak.id = akm.api_key_id
       WHERE ak.user_id = $1
         AND akm.model_id = $2
         AND ak.is_active = true`,
      [userId, modelId],
    );

    if (apiKeys.length === 0) {
      return;
    }

    // STEP 1: Update LiteLLM FIRST (security priority)
    const liteLLMUpdates: { keyId: string; success: boolean; error?: Error }[] = [];

    for (const apiKey of apiKeys) {
      if (apiKey.lite_llm_key_value && !this.shouldUseMockData()) {
        try {
          // Get remaining models for this key (excluding the one being removed)
          const remainingModels = await this.fastify.dbUtils.queryMany<{ model_id: string }>(
            `SELECT model_id FROM api_key_models
             WHERE api_key_id = $1 AND model_id != $2`,
            [apiKey.id, modelId],
          );

          await this.liteLLMService.updateKey(apiKey.lite_llm_key_value, {
            models: remainingModels.map((m) => m.model_id),
          });

          liteLLMUpdates.push({ keyId: apiKey.id, success: true });
        } catch (error) {
          this.fastify.log.error(
            { error, keyId: apiKey.id, modelId },
            'Failed to update LiteLLM key - aborting database update for this key',
          );
          liteLLMUpdates.push({
            keyId: apiKey.id,
            success: false,
            error: error as Error,
          });
        }
      } else {
        // Mock mode or no LiteLLM key - treat as success
        liteLLMUpdates.push({ keyId: apiKey.id, success: true });
      }
    }

    // STEP 2: Only update database for keys where LiteLLM succeeded
    const successfulKeyIds = liteLLMUpdates.filter((u) => u.success).map((u) => u.keyId);

    if (successfulKeyIds.length > 0) {
      await this.fastify.dbUtils.query(
        `DELETE FROM api_key_models
         WHERE api_key_id = ANY($1) AND model_id = $2`,
        [successfulKeyIds, modelId],
      );

      this.fastify.log.info(
        {
          userId,
          modelId,
          keysAffected: successfulKeyIds.length,
          totalKeys: apiKeys.length,
        },
        'Removed model from user API keys',
      );
    }

    // Report failures
    const failures = liteLLMUpdates.filter((u) => !u.success);
    if (failures.length > 0) {
      this.fastify.log.warn(
        {
          userId,
          modelId,
          failedKeys: failures.length,
          totalKeys: apiKeys.length,
        },
        'Some API keys could not be updated in LiteLLM - database unchanged for those keys',
      );
    }
  }
}

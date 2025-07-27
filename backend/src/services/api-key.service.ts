import { FastifyInstance } from 'fastify';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { LiteLLMService } from './litellm.service.js';
import { 
  EnhancedApiKey, 
  LiteLLMKeyGenerationResponse, 
  LiteLLMKeyInfo,
  ApiKeyListParams
} from '../types/api-key.types.js';

export interface CreateApiKeyRequest {
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

export interface ApiKeyWithSecret extends ApiKeyDetails {
  key: string; // Only returned on creation
}

export interface ApiKeyValidation {
  isValid: boolean;
  subscriptionId?: string;
  userId?: string;
  keyId?: string;
  allowedModels?: string[]; // NEW: Models this API key can access
  reason?: string;
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
      subscriptionId: 'sub-mock-1',
      name: 'Production API Key',
      keyHash: 'mock-hash-1',
      keyPrefix: 'ltm_Ax7m',
      lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      liteLLMKeyId: 'sk-litellm-mock-key-1',
      liteLLMInfo: {
        key_name: 'Production API Key',
        max_budget: 500,
        current_spend: 125.50,
        tpm_limit: 10000,
        rpm_limit: 100,
        team_id: 'team-prod',
        budget_duration: 'monthly',
        soft_budget: 450,
        blocked: false,
        tags: ['production', 'user-subscription'],
        models: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        spend_reset_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
      lastSyncAt: new Date(Date.now() - 30 * 60 * 1000),
      syncStatus: 'synced',
    },
    {
      id: 'key-mock-2',
      subscriptionId: 'sub-mock-1',
      name: 'Development API Key',
      keyHash: 'mock-hash-2',
      keyPrefix: 'ltm_Bk9n',
      lastUsedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      isActive: true,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      liteLLMKeyId: 'sk-litellm-mock-key-2',
      liteLLMInfo: {
        key_name: 'Development API Key',
        max_budget: 100,
        current_spend: 25.75,
        tpm_limit: 5000,
        rpm_limit: 50,
        budget_duration: 'monthly',
        soft_budget: 90,
        blocked: false,
        tags: ['development'],
        models: ['gpt-4o-mini'],
        spend_reset_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
      lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
      syncStatus: 'synced',
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
    request: EnhancedCreateApiKeyDto
  ): Promise<ApiKeyWithSecret> {
    const { subscriptionId, name, expiresAt, maxBudget, budgetDuration, tpmLimit, rpmLimit, allowedModels, teamId, tags, permissions, softBudget, guardrails } = request;

    try {
      // NEW: Ensure user exists in LiteLLM before creating API key
      await this.ensureUserExistsInLiteLLM(userId);

      if (this.shouldUseMockData()) {
        // Mock implementation
        const mockKey = this.generateApiKey();
        const mockApiKey: EnhancedApiKey = {
          id: `key-${Date.now()}`,
          subscriptionId,
          name: name || 'New API Key',
          keyHash: mockKey.keyHash,
          keyPrefix: mockKey.keyPrefix,
          expiresAt,
          isActive: true,
          createdAt: new Date(),
          liteLLMKeyId: `sk-litellm-mock-${Date.now()}`,
          liteLLMInfo: {
            key_name: name || 'New API Key',
            max_budget: maxBudget || 100,
            current_spend: 0,
            tpm_limit: tpmLimit || 1000,
            rpm_limit: rpmLimit || 60,
            budget_duration: budgetDuration || 'monthly',
            soft_budget: softBudget,
            blocked: false,
            tags: tags || [],
            models: allowedModels || ['gpt-4o'],
          },
          lastSyncAt: new Date(),
          syncStatus: 'synced',
        };

        return this.createMockResponse({
          ...mockApiKey,
          key: mockKey.key,
        });
      }

      // Validate subscription ownership and status
      const subscription = await this.fastify.dbUtils.queryOne(
        `SELECT id, status, user_id FROM subscriptions 
         WHERE id = $1 AND user_id = $2`,
        [subscriptionId, userId]
      );

      if (!subscription) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      if (subscription.status !== 'active') {
        throw this.fastify.createValidationError(
          `Cannot create API key for ${subscription.status} subscription`
        );
      }

      // Check for existing active keys limit
      const existingKeysCount = await this.fastify.dbUtils.queryOne(
        `SELECT COUNT(*) FROM api_keys 
         WHERE subscription_id = $1 AND is_active = true`,
        [subscriptionId]
      );

      const maxKeysPerSubscription = 5;
      if (parseInt(existingKeysCount.count) >= maxKeysPerSubscription) {
        throw this.fastify.createValidationError(
          `Maximum ${maxKeysPerSubscription} active API keys allowed per subscription`
        );
      }

      // Generate secure API key
      const { key, keyHash, keyPrefix } = this.generateApiKey();

      // Create API key in LiteLLM first
      const liteLLMRequest: LiteLLMKeyGenerationRequest = {
        key_alias: name || `key-${Date.now()}`,
        duration: expiresAt ? this.calculateDuration(expiresAt) : undefined,
        models: allowedModels,
        max_budget: maxBudget,
        user_id: userId,
        team_id: teamId,
        tpm_limit: tpmLimit,
        rpm_limit: rpmLimit,
        budget_duration: budgetDuration,
        permissions: permissions ? {
          allow_chat_completions: permissions.allowChatCompletions,
          allow_embeddings: permissions.allowEmbeddings,
          allow_completions: permissions.allowCompletions,
        } : undefined,
        tags: tags,
        soft_budget: softBudget,
        guardrails: guardrails,
        metadata: {
          litemaas_key_id: keyPrefix,
          subscription_id: subscriptionId,
          created_by: 'litemaas',
        },
      };

      const liteLLMResponse = await this.liteLLMService.generateApiKey(liteLLMRequest);

      // Store the API key locally
      const apiKey = await this.fastify.dbUtils.queryOne(
        `INSERT INTO api_keys (
          subscription_id, user_id, name, key_hash, key_prefix, 
          expires_at, is_active, lite_llm_key_id,
          max_budget, current_spend, tpm_limit, rpm_limit,
          last_sync_at, sync_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          subscriptionId,
          userId,
          name,
          keyHash,
          keyPrefix,
          expiresAt,
          true,
          liteLLMResponse.key,
          maxBudget,
          0,
          tpmLimit,
          rpmLimit,
          new Date(),
          'synced',
        ]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'API_KEY_CREATE',
          'API_KEY',
          apiKey.id,
          { subscriptionId, name, keyPrefix, liteLLMKeyId: liteLLMResponse.key },
        ]
      );

      this.fastify.log.info({
        userId,
        subscriptionId,
        apiKeyId: apiKey.id,
        keyPrefix,
        liteLLMKeyId: liteLLMResponse.key,
      }, 'API key created with LiteLLM integration');

      return {
        ...this.mapToEnhancedApiKey(apiKey, liteLLMResponse),
        key, // Only include the actual key on creation
      };
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
    const { subscriptionId, isActive, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    if (this.shouldUseMockData()) {
      this.fastify.log.debug('Using mock API key data');
      
      let filteredKeys = [...this.MOCK_API_KEYS];
      
      if (subscriptionId) {
        filteredKeys = filteredKeys.filter(key => key.subscriptionId === subscriptionId);
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
      let query = `
        SELECT ak.*, s.user_id
        FROM api_keys ak
        JOIN subscriptions s ON ak.subscription_id = s.id
        WHERE s.user_id = $1
      `;
      const params: any[] = [userId];

      if (subscriptionId) {
        query += ` AND ak.subscription_id = $${params.length + 1}`;
        params.push(subscriptionId);
      }

      if (typeof isActive === 'boolean') {
        query += ` AND ak.is_active = $${params.length + 1}`;
        params.push(isActive);
      }

      query += ` ORDER BY ak.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      // Get count
      let countQuery = `
        SELECT COUNT(*)
        FROM api_keys ak
        JOIN subscriptions s ON ak.subscription_id = s.id
        WHERE s.user_id = $1
      `;
      const countParams = [userId];

      if (subscriptionId) {
        countQuery += ` AND ak.subscription_id = $2`;
        countParams.push(subscriptionId);
      }

      if (typeof isActive === 'boolean') {
        countQuery += ` AND ak.is_active = $${countParams.length + 1}`;
        countParams.push(isActive);
      }

      const [apiKeys, countResult] = await Promise.all([
        this.fastify.dbUtils.queryMany(query, params),
        this.fastify.dbUtils.queryOne(countQuery, countParams),
      ]);

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
      let currentSpend = apiKey.liteLLMInfo?.current_spend || 0;
      let maxBudget = apiKey.liteLLMInfo?.max_budget;

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
        spendResetAt: apiKey.liteLLMInfo?.spend_reset_at,
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
        return { isValid: false, reason: 'Invalid key format' };
      }

      const keyPrefix = this.extractKeyPrefix(key);
      const keyHash = this.hashApiKey(key);

      if (this.shouldUseMockData()) {
        const mockKey = this.MOCK_API_KEYS.find(k => k.keyPrefix === keyPrefix);
        if (mockKey && mockKey.isActive) {
          return {
            isValid: true,
            subscriptionId: mockKey.subscriptionId,
            userId: 'mock-user',
            keyId: mockKey.id,
          };
        }
        return { isValid: false, reason: 'API key not found' };
      }

      const apiKey = await this.fastify.dbUtils.queryOne(`
        SELECT ak.*, s.user_id, s.status as subscription_status
        FROM api_keys ak
        JOIN subscriptions s ON ak.subscription_id = s.id
        WHERE ak.key_prefix = $1 AND ak.is_active = true
      `, [keyPrefix]);

      if (!apiKey) {
        return { isValid: false, reason: 'API key not found' };
      }

      // Timing-safe comparison to prevent timing attacks
      if (!this.verifyKeyHash(keyHash, apiKey.key_hash)) {
        return { isValid: false, reason: 'Invalid API key' };
      }

      // Check if key is expired
      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return { isValid: false, reason: 'API key expired' };
      }

      // Check subscription status
      if (apiKey.subscription_status !== 'active') {
        return { isValid: false, reason: `Subscription is ${apiKey.subscription_status}` };
      }

      // Update last used timestamp
      await this.updateLastUsed(apiKey.id);

      return {
        isValid: true,
        subscriptionId: apiKey.subscription_id,
        userId: apiKey.user_id,
        keyId: apiKey.id,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to validate API key');
      return { isValid: false, reason: 'Validation error' };
    }
  }

  async revokeApiKey(keyId: string, userId: string): Promise<EnhancedApiKey> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      // Revoke in LiteLLM if integrated
      if (apiKey.liteLLMKeyId && !this.shouldUseMockData()) {
        try {
          await this.liteLLMService.deleteKey(apiKey.liteLLMKeyId);
        } catch (error) {
          this.fastify.log.warn(error, 'Failed to delete key from LiteLLM, proceeding with local revocation');
        }
      }

      // Revoke locally
      const revokedApiKey = await this.fastify.dbUtils.queryOne(`
        UPDATE api_keys
        SET is_active = false, revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [keyId]);

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'API_KEY_REVOKE',
          'API_KEY',
          keyId,
          { subscriptionId: apiKey.subscriptionId },
        ]
      );

      this.fastify.log.info({
        userId,
        apiKeyId: keyId,
        subscriptionId: apiKey.subscriptionId,
      }, 'API key revoked');

      return this.mapToEnhancedApiKey(revokedApiKey);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to revoke API key');
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
      subscriptionId: apiKey.subscription_id,
      userId: apiKey.user_id,
      name: apiKey.name,
      keyHash: apiKey.key_hash,
      keyPrefix: apiKey.key_prefix,
      lastUsedAt: apiKey.last_used_at ? new Date(apiKey.last_used_at) : undefined,
      expiresAt: apiKey.expires_at ? new Date(apiKey.expires_at) : undefined,
      isActive: apiKey.is_active,
      createdAt: new Date(apiKey.created_at),
      revokedAt: apiKey.revoked_at ? new Date(apiKey.revoked_at) : undefined,
      liteLLMKeyId: apiKey.lite_llm_key_id || liteLLMResponse?.key,
      liteLLMInfo: liteLLMInfo ? {
        key_name: liteLLMInfo.key_name,
        max_budget: liteLLMInfo.max_budget,
        current_spend: liteLLMInfo.spend,
        tpm_limit: liteLLMInfo.tpm_limit,
        rpm_limit: liteLLMInfo.rpm_limit,
        team_id: liteLLMInfo.team_id,
        budget_duration: liteLLMInfo.budget_reset_at ? 'monthly' : undefined,
        soft_budget: liteLLMInfo.soft_budget,
        blocked: liteLLMInfo.blocked,
        tags: liteLLMInfo.tags,
        models: liteLLMInfo.models,
        spend_reset_at: liteLLMInfo.budget_reset_at ? new Date(liteLLMInfo.budget_reset_at) : undefined,
      } : (apiKey.max_budget || apiKey.tpm_limit || apiKey.rpm_limit) ? {
        max_budget: apiKey.max_budget,
        current_spend: apiKey.current_spend,
        tpm_limit: apiKey.tpm_limit,
        rpm_limit: apiKey.rpm_limit,
        team_id: apiKey.team_id,
        budget_duration: apiKey.budget_duration,
      } : undefined,
      lastSyncAt: apiKey.last_sync_at ? new Date(apiKey.last_sync_at) : undefined,
      syncStatus: apiKey.sync_status || 'pending',
      syncError: apiKey.sync_error,
    };
  }

  /**
   * Validates an API key and returns validation details including allowed models
   */
  async validateApiKey(keyValue: string): Promise<ApiKeyValidation> {
    // Basic format validation
    if (!keyValue || typeof keyValue !== 'string') {
      return {
        isValid: false,
        reason: 'Invalid API key format'
      };
    }

    // Check key format (should start with appropriate prefix)
    if (!keyValue.startsWith('sk-') && !keyValue.startsWith('ltm_')) {
      return {
        isValid: false,
        reason: 'Invalid API key format'
      };
    }

    // Minimum length check
    if (keyValue.length < 32) {
      return {
        isValid: false,
        reason: 'Invalid API key format'
      };
    }

    try {
      // Generate hash for database lookup
      const keyHash = this.hashApiKey(keyValue);

      // Look up API key in database
      const keyRecord = await this.fastify.dbUtils.queryOne(`
        SELECT 
          ak.id, ak.subscription_id, ak.is_active, ak.expires_at, ak.revoked_at,
          s.user_id, s.status as subscription_status, s.model_id
        FROM api_keys ak
        JOIN subscriptions s ON ak.subscription_id = s.id
        WHERE ak.key_hash = $1
      `, [keyHash]);

      if (!keyRecord) {
        return {
          isValid: false,
          reason: 'API key not found'
        };
      }

      // Check if key is active
      if (!keyRecord.is_active) {
        return {
          isValid: false,
          reason: 'API key is inactive'
        };
      }

      // Check if key is revoked
      if (keyRecord.revoked_at) {
        return {
          isValid: false,
          reason: 'API key has been revoked'
        };
      }

      // Check if key is expired
      if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        return {
          isValid: false,
          reason: 'API key has expired'
        };
      }

      // Check subscription status
      if (keyRecord.subscription_status !== 'active') {
        return {
          isValid: false,
          reason: `Subscription is ${keyRecord.subscription_status}`
        };
      }

      // Get allowed models for this subscription
      const allowedModels = keyRecord.model_id ? [keyRecord.model_id] : [];

      // Update last used timestamp
      await this.fastify.dbUtils.query(
        'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
        [keyRecord.id]
      );

      return {
        isValid: true,
        keyId: keyRecord.id,
        subscriptionId: keyRecord.subscription_id,
        userId: keyRecord.user_id,
        allowedModels: allowedModels
      };

    } catch (error) {
      this.fastify.log.error(error, 'Error validating API key');
      return {
        isValid: false,
        reason: 'API key validation failed'
      };
    }
  }

  /**
   * Helper method to hash API keys for secure storage
   */
  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

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
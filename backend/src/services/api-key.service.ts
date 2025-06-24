import { FastifyInstance } from 'fastify';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

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
  private readonly KEY_PREFIX = 'ltm_';
  private readonly KEY_LENGTH = 32; // 32 bytes = 64 hex characters
  private readonly PREFIX_LENGTH = 4; // First 4 characters for display

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async createApiKey(
    userId: string,
    request: CreateApiKeyRequest
  ): Promise<ApiKeyWithSecret> {
    const { subscriptionId, name, expiresAt, metadata = {} } = request;

    try {
      // Validate subscription ownership and status
      const subscription = await this.fastify.dbUtils.queryOne(
        `SELECT id, status FROM subscriptions 
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

      // Check for existing active keys limit (e.g., max 5 per subscription)
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

      // Store the API key
      const apiKey = await this.fastify.dbUtils.queryOne(
        `INSERT INTO api_keys (
          subscription_id, name, key_hash, key_prefix, 
          expires_at, is_active, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          subscriptionId,
          name,
          keyHash,
          keyPrefix,
          expiresAt,
          true,
          metadata,
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
          { subscriptionId, name, keyPrefix },
        ]
      );

      this.fastify.log.info({
        userId,
        subscriptionId,
        apiKeyId: apiKey.id,
        keyPrefix,
      }, 'API key created');

      return {
        ...this.mapToApiKeyDetails(apiKey, userId),
        key, // Only include the actual key on creation
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create API key');
      throw error;
    }
  }

  async getApiKey(keyId: string, userId: string): Promise<ApiKeyDetails | null> {
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

      return this.mapToApiKeyDetails(apiKey, userId);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get API key');
      throw error;
    }
  }

  async getUserApiKeys(
    userId: string,
    options: {
      subscriptionId?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: ApiKeyDetails[]; total: number }> {
    const { subscriptionId, isActive, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

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
        data: apiKeys.map(key => this.mapToApiKeyDetails(key, userId)),
        total: parseInt(countResult.count),
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user API keys');
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

  async revokeApiKey(keyId: string, userId: string): Promise<ApiKeyDetails> {
    try {
      const apiKey = await this.fastify.dbUtils.queryOne(`
        UPDATE api_keys
        SET is_active = false, revoked_at = CURRENT_TIMESTAMP
        FROM subscriptions s
        WHERE api_keys.id = $1 
        AND api_keys.subscription_id = s.id 
        AND s.user_id = $2
        AND api_keys.is_active = true
        RETURNING api_keys.*, s.user_id
      `, [keyId, userId]);

      if (!apiKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'API_KEY_REVOKE',
          'API_KEY',
          keyId,
          { subscriptionId: apiKey.subscription_id },
        ]
      );

      this.fastify.log.info({
        userId,
        apiKeyId: keyId,
        subscriptionId: apiKey.subscription_id,
      }, 'API key revoked');

      return this.mapToApiKeyDetails(apiKey, userId);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to revoke API key');
      throw error;
    }
  }

  async rotateApiKey(keyId: string, userId: string): Promise<ApiKeyWithSecret> {
    try {
      // Get the old API key
      const oldApiKey = await this.getApiKey(keyId, userId);
      if (!oldApiKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      if (!oldApiKey.isActive) {
        throw this.fastify.createValidationError('Cannot rotate inactive API key');
      }

      // Create new API key with same properties
      const { key, keyHash, keyPrefix } = this.generateApiKey();

      // Update the existing record with new key data
      const updatedApiKey = await this.fastify.dbUtils.queryOne(
        `UPDATE api_keys
         SET key_hash = $1, key_prefix = $2, last_used_at = NULL
         WHERE id = $3
         RETURNING *`,
        [keyHash, keyPrefix, keyId]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'API_KEY_ROTATE',
          'API_KEY',
          keyId,
          { 
            subscriptionId: oldApiKey.subscriptionId,
            oldPrefix: oldApiKey.keyPrefix,
            newPrefix: keyPrefix,
          },
        ]
      );

      this.fastify.log.info({
        userId,
        apiKeyId: keyId,
        subscriptionId: oldApiKey.subscriptionId,
        oldPrefix: oldApiKey.keyPrefix,
        newPrefix: keyPrefix,
      }, 'API key rotated');

      return {
        ...this.mapToApiKeyDetails(updatedApiKey, userId),
        key, // Return the new key
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to rotate API key');
      throw error;
    }
  }

  async getApiKeyUsage(keyId: string, userId: string): Promise<ApiKeyUsage> {
    try {
      const apiKey = await this.getApiKey(keyId, userId);
      if (!apiKey) {
        throw this.fastify.createNotFoundError('API key');
      }

      const usage = await this.fastify.dbUtils.queryOne(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) as requests_this_month
        FROM usage_logs
        WHERE api_key_id = $1
      `, [keyId]);

      return {
        totalRequests: parseInt(usage.total_requests) || 0,
        requestsThisMonth: parseInt(usage.requests_this_month) || 0,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get API key usage');
      throw error;
    }
  }

  async getApiKeyStats(userId?: string): Promise<ApiKeyStats> {
    try {
      let query = `
        SELECT 
          ak.is_active,
          ak.expires_at,
          ak.revoked_at,
          ak.subscription_id
        FROM api_keys ak
        JOIN subscriptions s ON ak.subscription_id = s.id
      `;
      const params: any[] = [];

      if (userId) {
        query += ' WHERE s.user_id = $1';
        params.push(userId);
      }

      const keys = await this.fastify.dbUtils.queryMany(query, params);

      const stats: ApiKeyStats = {
        total: keys.length,
        active: 0,
        expired: 0,
        revoked: 0,
        bySubscription: {},
      };

      const now = new Date();

      keys.forEach(key => {
        // Count by subscription
        stats.bySubscription[key.subscription_id] = 
          (stats.bySubscription[key.subscription_id] || 0) + 1;

        // Count by status
        if (key.revoked_at) {
          stats.revoked++;
        } else if (key.expires_at && new Date(key.expires_at) < now) {
          stats.expired++;
        } else if (key.is_active) {
          stats.active++;
        }
      });

      return stats;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get API key stats');
      throw error;
    }
  }

  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await this.fastify.dbUtils.query(
        `UPDATE api_keys 
         SET is_active = false
         WHERE expires_at IS NOT NULL 
         AND expires_at <= CURRENT_TIMESTAMP 
         AND is_active = true`
      );

      const cleanedCount = result.rowCount || 0;

      if (cleanedCount > 0) {
        this.fastify.log.info({
          cleanedCount,
        }, 'Cleaned up expired API keys');
      }

      return cleanedCount;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to cleanup expired API keys');
      return 0;
    }
  }

  private generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
    // Generate random bytes for the key
    const keyBytes = randomBytes(this.KEY_LENGTH);
    const keyHex = keyBytes.toString('hex');
    
    // Create the full key with prefix
    const key = `${this.KEY_PREFIX}${keyHex}`;
    
    // Generate hash for storage
    const keyHash = this.hashApiKey(key);
    
    // Extract prefix for indexing
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
    const expectedLength = this.KEY_PREFIX.length + (this.KEY_LENGTH * 2); // hex encoding doubles length
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

    // Timing-safe comparison
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

  private mapToApiKeyDetails(apiKey: any, userId: string): ApiKeyDetails {
    return {
      id: apiKey.id,
      subscriptionId: apiKey.subscription_id,
      userId,
      name: apiKey.name,
      keyPrefix: apiKey.key_prefix,
      lastUsedAt: apiKey.last_used_at ? new Date(apiKey.last_used_at) : undefined,
      expiresAt: apiKey.expires_at ? new Date(apiKey.expires_at) : undefined,
      isActive: apiKey.is_active,
      createdAt: new Date(apiKey.created_at),
      revokedAt: apiKey.revoked_at ? new Date(apiKey.revoked_at) : undefined,
      metadata: apiKey.metadata || {},
    };
  }
}
import { FastifyInstance } from 'fastify';
import { LiteLLMService } from './litellm.service';

export interface CreateSubscriptionRequest {
  modelId: string;
  quotaRequests?: number;
  quotaTokens?: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionRequest {
  status?: 'active' | 'suspended' | 'cancelled';
  quotaRequests?: number;
  quotaTokens?: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface SubscriptionDetails {
  id: string;
  userId: string;
  modelId: string;
  modelName?: string;
  provider?: string;
  status: 'pending' | 'active' | 'suspended' | 'cancelled' | 'expired';
  quotaRequests: number;
  quotaTokens: number;
  usedRequests: number;
  usedTokens: number;
  remainingRequests: number;
  remainingTokens: number;
  utilizationPercent: {
    requests: number;
    tokens: number;
  };
  resetAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface SubscriptionQuota {
  requests: {
    limit: number;
    used: number;
    remaining: number;
    resetAt?: Date;
  };
  tokens: {
    limit: number;
    used: number;
    remaining: number;
    resetAt?: Date;
  };
}

export interface SubscriptionStats {
  total: number;
  byStatus: Record<string, number>;
  byProvider: Record<string, number>;
  totalQuotaUsage: {
    requests: { used: number; limit: number };
    tokens: { used: number; limit: number };
  };
}

export interface SubscriptionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class SubscriptionService {
  private fastify: FastifyInstance;
  private liteLLMService: LiteLLMService;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.liteLLMService = new LiteLLMService(fastify);
  }

  async createSubscription(
    userId: string, 
    request: CreateSubscriptionRequest
  ): Promise<SubscriptionDetails> {
    const { modelId, quotaRequests = 10000, quotaTokens = 1000000, expiresAt, metadata = {} } = request;

    try {
      // Validate model exists
      const model = await this.liteLLMService.getModelById(modelId);
      if (!model) {
        throw this.fastify.createValidationError(`Model ${modelId} not found`);
      }

      // Check for existing active subscription
      const existingSubscription = await this.fastify.dbUtils.queryOne(
        `SELECT id FROM subscriptions 
         WHERE user_id = $1 AND model_id = $2 AND status = 'active'`,
        [userId, modelId]
      );

      if (existingSubscription) {
        throw this.fastify.createValidationError(
          `Active subscription already exists for model ${modelId}`
        );
      }

      // Create subscription
      const subscription = await this.fastify.dbUtils.queryOne(
        `INSERT INTO subscriptions (
          user_id, model_id, status, quota_requests, quota_tokens, 
          expires_at, reset_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          userId,
          modelId,
          'pending',
          quotaRequests,
          quotaTokens,
          expiresAt,
          this.calculateNextResetDate(),
          metadata,
        ]
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'SUBSCRIPTION_CREATE',
          'SUBSCRIPTION',
          subscription.id,
          { modelId, quotaRequests, quotaTokens },
        ]
      );

      this.fastify.log.info({
        userId,
        subscriptionId: subscription.id,
        modelId,
      }, 'Subscription created');

      return this.mapToSubscriptionDetails(subscription);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create subscription');
      throw error;
    }
  }

  async getSubscription(subscriptionId: string, userId?: string): Promise<SubscriptionDetails | null> {
    try {
      let query = `
        SELECT s.*, m.name as model_name, m.provider
        FROM subscriptions s
        LEFT JOIN models m ON s.model_id = m.id
        WHERE s.id = $1
      `;
      const params = [subscriptionId];

      if (userId) {
        query += ` AND s.user_id = $2`;
        params.push(userId);
      }

      const subscription = await this.fastify.dbUtils.queryOne(query, params);
      
      if (!subscription) {
        return null;
      }

      return this.mapToSubscriptionDetails(subscription);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get subscription');
      throw error;
    }
  }

  async getUserSubscriptions(
    userId: string,
    options: {
      status?: string;
      modelId?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ data: SubscriptionDetails[]; total: number }> {
    const { status, modelId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    try {
      let query = `
        SELECT s.*, m.name as model_name, m.provider
        FROM subscriptions s
        LEFT JOIN models m ON s.model_id = m.id
        WHERE s.user_id = $1
      `;
      const params: any[] = [userId];

      if (status) {
        query += ` AND s.status = $${params.length + 1}`;
        params.push(status);
      }

      if (modelId) {
        query += ` AND s.model_id = $${params.length + 1}`;
        params.push(modelId);
      }

      query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      // Get count
      let countQuery = 'SELECT COUNT(*) FROM subscriptions WHERE user_id = $1';
      const countParams = [userId];

      if (status) {
        countQuery += ` AND status = $${countParams.length + 1}`;
        countParams.push(status);
      }

      if (modelId) {
        countQuery += ` AND model_id = $${countParams.length + 1}`;
        countParams.push(modelId);
      }

      const [subscriptions, countResult] = await Promise.all([
        this.fastify.dbUtils.queryMany(query, params),
        this.fastify.dbUtils.queryOne(countQuery, countParams),
      ]);

      return {
        data: subscriptions.map(sub => this.mapToSubscriptionDetails(sub)),
        total: parseInt(countResult.count),
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get user subscriptions');
      throw error;
    }
  }

  async updateSubscription(
    subscriptionId: string,
    userId: string,
    updates: UpdateSubscriptionRequest
  ): Promise<SubscriptionDetails> {
    try {
      // Validate subscription ownership
      const existing = await this.getSubscription(subscriptionId, userId);
      if (!existing) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      const { status, quotaRequests, quotaTokens, expiresAt, metadata } = updates;

      // Build update query
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        params.push(status);
      }

      if (quotaRequests !== undefined) {
        updateFields.push(`quota_requests = $${paramIndex++}`);
        params.push(quotaRequests);
      }

      if (quotaTokens !== undefined) {
        updateFields.push(`quota_tokens = $${paramIndex++}`);
        params.push(quotaTokens);
      }

      if (expiresAt !== undefined) {
        updateFields.push(`expires_at = $${paramIndex++}`);
        params.push(expiresAt);
      }

      if (metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        params.push(metadata);
      }

      if (updateFields.length === 0) {
        return existing;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(subscriptionId, userId);

      const updatedSubscription = await this.fastify.dbUtils.queryOne(
        `UPDATE subscriptions SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
         RETURNING *`,
        params
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'SUBSCRIPTION_UPDATE',
          'SUBSCRIPTION',
          subscriptionId,
          updates,
        ]
      );

      this.fastify.log.info({
        userId,
        subscriptionId,
        updates,
      }, 'Subscription updated');

      return this.mapToSubscriptionDetails(updatedSubscription);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update subscription');
      throw error;
    }
  }

  async activateSubscription(subscriptionId: string, userId: string): Promise<SubscriptionDetails> {
    try {
      const subscription = await this.getSubscription(subscriptionId, userId);
      if (!subscription) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      if (subscription.status !== 'pending') {
        throw this.fastify.createValidationError(
          `Cannot activate subscription with status: ${subscription.status}`
        );
      }

      return this.updateSubscription(subscriptionId, userId, { status: 'active' });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to activate subscription');
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, userId: string): Promise<SubscriptionDetails> {
    try {
      const subscription = await this.getSubscription(subscriptionId, userId);
      if (!subscription) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      if (['cancelled', 'expired'].includes(subscription.status)) {
        throw this.fastify.createValidationError(
          `Subscription is already ${subscription.status}`
        );
      }

      // Revoke associated API keys
      await this.fastify.dbUtils.query(
        `UPDATE api_keys SET is_active = false, revoked_at = CURRENT_TIMESTAMP
         WHERE subscription_id = $1`,
        [subscriptionId]
      );

      return this.updateSubscription(subscriptionId, userId, { status: 'cancelled' });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to cancel subscription');
      throw error;
    }
  }

  async getSubscriptionQuota(subscriptionId: string, userId: string): Promise<SubscriptionQuota> {
    try {
      const subscription = await this.getSubscription(subscriptionId, userId);
      if (!subscription) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      return {
        requests: {
          limit: subscription.quotaRequests,
          used: subscription.usedRequests,
          remaining: subscription.remainingRequests,
          resetAt: subscription.resetAt,
        },
        tokens: {
          limit: subscription.quotaTokens,
          used: subscription.usedTokens,
          remaining: subscription.remainingTokens,
          resetAt: subscription.resetAt,
        },
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get subscription quota');
      throw error;
    }
  }

  async checkQuotaAvailability(
    subscriptionId: string,
    requestTokens: number
  ): Promise<{ canProceed: boolean; reason?: string }> {
    try {
      const subscription = await this.fastify.dbUtils.queryOne(
        'SELECT * FROM subscriptions WHERE id = $1',
        [subscriptionId]
      );

      if (!subscription) {
        return { canProceed: false, reason: 'Subscription not found' };
      }

      if (subscription.status !== 'active') {
        return { canProceed: false, reason: `Subscription is ${subscription.status}` };
      }

      if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
        return { canProceed: false, reason: 'Subscription has expired' };
      }

      if (subscription.used_requests >= subscription.quota_requests) {
        return { canProceed: false, reason: 'Request quota exceeded' };
      }

      if (subscription.used_tokens + requestTokens > subscription.quota_tokens) {
        return { canProceed: false, reason: 'Token quota would be exceeded' };
      }

      return { canProceed: true };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to check quota availability');
      throw error;
    }
  }

  async resetQuotas(userId?: string): Promise<number> {
    try {
      let query = `
        UPDATE subscriptions 
        SET used_requests = 0, used_tokens = 0, reset_at = $1
        WHERE status = 'active' AND (reset_at IS NULL OR reset_at <= CURRENT_TIMESTAMP)
      `;
      const params = [this.calculateNextResetDate()];

      if (userId) {
        query += ` AND user_id = $2`;
        params.push(userId);
      }

      const result = await this.fastify.dbUtils.query(query, params);
      
      this.fastify.log.info({
        userId,
        resetCount: result.rowCount,
      }, 'Quotas reset');

      return result.rowCount || 0;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to reset quotas');
      throw error;
    }
  }

  async validateSubscription(subscriptionData: CreateSubscriptionRequest): Promise<SubscriptionValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate model exists
      const model = await this.liteLLMService.getModelById(subscriptionData.modelId);
      if (!model) {
        errors.push(`Model ${subscriptionData.modelId} does not exist`);
      }

      // Validate quotas
      if (subscriptionData.quotaRequests && subscriptionData.quotaRequests <= 0) {
        errors.push('Request quota must be greater than 0');
      }

      if (subscriptionData.quotaTokens && subscriptionData.quotaTokens <= 0) {
        errors.push('Token quota must be greater than 0');
      }

      // Validate expiration date
      if (subscriptionData.expiresAt && subscriptionData.expiresAt <= new Date()) {
        errors.push('Expiration date must be in the future');
      }

      // Check for reasonable quota limits
      if (subscriptionData.quotaRequests && subscriptionData.quotaRequests > 1000000) {
        warnings.push('Request quota is unusually high');
      }

      if (subscriptionData.quotaTokens && subscriptionData.quotaTokens > 100000000) {
        warnings.push('Token quota is unusually high');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to validate subscription');
      errors.push('Validation failed due to internal error');
      return { isValid: false, errors, warnings };
    }
  }

  async getSubscriptionStats(userId?: string): Promise<SubscriptionStats> {
    try {
      let query = 'SELECT status, COUNT(*) as count FROM subscriptions';
      const params: any[] = [];

      if (userId) {
        query += ' WHERE user_id = $1';
        params.push(userId);
      }

      query += ' GROUP BY status';

      const statusCounts = await this.fastify.dbUtils.queryMany(query, params);

      // Get provider stats
      let providerQuery = `
        SELECT m.provider, COUNT(*) as count
        FROM subscriptions s
        JOIN models m ON s.model_id = m.id
      `;

      if (userId) {
        providerQuery += ' WHERE s.user_id = $1';
      }

      providerQuery += ' GROUP BY m.provider';

      const providerCounts = await this.fastify.dbUtils.queryMany(providerQuery, params);

      // Get quota usage
      let quotaQuery = `
        SELECT 
          SUM(used_requests) as total_used_requests,
          SUM(quota_requests) as total_quota_requests,
          SUM(used_tokens) as total_used_tokens,
          SUM(quota_tokens) as total_quota_tokens
        FROM subscriptions
        WHERE status = 'active'
      `;

      if (userId) {
        quotaQuery += ' AND user_id = $1';
      }

      const quotaStats = await this.fastify.dbUtils.queryOne(quotaQuery, params);

      const byStatus: Record<string, number> = {};
      let total = 0;

      statusCounts.forEach(row => {
        byStatus[row.status] = parseInt(row.count);
        total += parseInt(row.count);
      });

      const byProvider: Record<string, number> = {};
      providerCounts.forEach(row => {
        byProvider[row.provider] = parseInt(row.count);
      });

      return {
        total,
        byStatus,
        byProvider,
        totalQuotaUsage: {
          requests: {
            used: parseInt(quotaStats?.total_used_requests || '0'),
            limit: parseInt(quotaStats?.total_quota_requests || '0'),
          },
          tokens: {
            used: parseInt(quotaStats?.total_used_tokens || '0'),
            limit: parseInt(quotaStats?.total_quota_tokens || '0'),
          },
        },
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get subscription stats');
      throw error;
    }
  }

  private mapToSubscriptionDetails(subscription: any): SubscriptionDetails {
    const remainingRequests = Math.max(0, subscription.quota_requests - subscription.used_requests);
    const remainingTokens = Math.max(0, subscription.quota_tokens - subscription.used_tokens);

    return {
      id: subscription.id,
      userId: subscription.user_id,
      modelId: subscription.model_id,
      modelName: subscription.model_name,
      provider: subscription.provider,
      status: subscription.status,
      quotaRequests: subscription.quota_requests,
      quotaTokens: subscription.quota_tokens,
      usedRequests: subscription.used_requests,
      usedTokens: subscription.used_tokens,
      remainingRequests,
      remainingTokens,
      utilizationPercent: {
        requests: subscription.quota_requests > 0 
          ? Math.round((subscription.used_requests / subscription.quota_requests) * 100) 
          : 0,
        tokens: subscription.quota_tokens > 0 
          ? Math.round((subscription.used_tokens / subscription.quota_tokens) * 100) 
          : 0,
      },
      resetAt: subscription.reset_at ? new Date(subscription.reset_at) : undefined,
      expiresAt: subscription.expires_at ? new Date(subscription.expires_at) : undefined,
      createdAt: new Date(subscription.created_at),
      updatedAt: new Date(subscription.updated_at),
      metadata: subscription.metadata || {},
    };
  }

  private calculateNextResetDate(): Date {
    // Reset monthly on the first day of the month
    const now = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextReset;
  }
}
import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { LiteLLMService } from './litellm.service';
import { DefaultTeamService } from './default-team.service.js';
import {
  SubscriptionStatus,
  EnhancedSubscription,
  EnhancedCreateSubscriptionDto,
  EnhancedUpdateSubscriptionDto,
  SubscriptionBudgetInfo,
  SubscriptionUsageAnalytics,
  SubscriptionSyncRequest,
  SubscriptionSyncResponse,
  BulkSubscriptionOperation,
  BulkSubscriptionResult,
  SubscriptionQuota,
  SubscriptionStats,
  SubscriptionValidation,
} from '../types/subscription.types.js';
import { LiteLLMKeyGenerationRequest } from '../types/api-key.types.js';

export interface CreateSubscriptionRequest {
  modelId: string;
  quotaRequests?: number;
  quotaTokens?: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

interface DatabaseSubscription {
  id: string;
  user_id: string;
  model_id: string;
  status: SubscriptionStatus;
  quota_requests: number;
  quota_tokens: number;
  used_requests: number;
  used_tokens: number;
  expires_at?: Date;
  reset_at?: Date;
  max_budget?: number;
  budget_duration?: string;
  tpm_limit?: number;
  rpm_limit?: number;
  team_id?: string;
  created_at: Date;
  updated_at: Date;
}

interface CountResult {
  count: string;
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

export class SubscriptionService {
  private fastify: FastifyInstance;
  private liteLLMService: LiteLLMService;

  // Mock data for development/fallback
  private readonly MOCK_SUBSCRIPTIONS: EnhancedSubscription[] = [
    {
      id: 'sub-mock-1',
      userId: 'dev-user-1',
      modelId: 'gpt-4o',
      modelName: 'GPT-4o',
      provider: 'openai',
      status: SubscriptionStatus.ACTIVE,
      quotaRequests: 10000,
      quotaTokens: 1000000,
      usedRequests: 2350,
      usedTokens: 567890,
      remainingRequests: 7650,
      remainingTokens: 432110,
      utilizationPercent: {
        requests: 23.5,
        tokens: 56.8,
      },
      resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      metadata: {
        inputCostPer1kTokens: 0.01,
        outputCostPer1kTokens: 0.03,
        currency: 'USD',
      },
      // Enhanced LiteLLM integration fields
      liteLLMInfo: {
        keyId: 'sk-litellm-mock-key-1',
        teamId: 'team-prod',
        maxBudget: 500,
        currentSpend: 125.5,
        budgetDuration: 'monthly',
        tpmLimit: 10000,
        rpmLimit: 100,
        allowedModels: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        spendResetAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        budgetUtilization: 25.1,
      },
      budgetInfo: {
        maxBudget: 500,
        currentSpend: 125.5,
        remainingBudget: 374.5,
        budgetUtilization: 25.1,
        spendResetAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
      rateLimits: {
        tpmLimit: 10000,
        rpmLimit: 100,
        currentTpm: 2450,
        currentRpm: 15,
      },
      teamId: 'team-prod',
      teamInfo: {
        id: 'team-prod',
        name: 'Production Team',
        role: 'member',
      },
      lastSyncAt: new Date(Date.now() - 30 * 60 * 1000),
      syncStatus: 'synced',
    },
    {
      id: 'sub-mock-2',
      userId: 'dev-user-1',
      modelId: 'claude-3-5-sonnet-20241022',
      modelName: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      status: SubscriptionStatus.ACTIVE,
      quotaRequests: 5000,
      quotaTokens: 500000,
      usedRequests: 890,
      usedTokens: 123456,
      remainingRequests: 4110,
      remainingTokens: 376544,
      utilizationPercent: {
        requests: 17.8,
        tokens: 24.7,
      },
      resetAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      metadata: {
        inputCostPer1kTokens: 0.003,
        outputCostPer1kTokens: 0.015,
        currency: 'USD',
      },
      // Enhanced LiteLLM integration fields
      liteLLMInfo: {
        keyId: 'sk-litellm-mock-key-2',
        maxBudget: 100,
        currentSpend: 25.75,
        budgetDuration: 'monthly',
        tpmLimit: 5000,
        rpmLimit: 50,
        allowedModels: ['claude-3-5-sonnet-20241022'],
        spendResetAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        budgetUtilization: 25.8,
      },
      budgetInfo: {
        maxBudget: 100,
        currentSpend: 25.75,
        remainingBudget: 74.25,
        budgetUtilization: 25.8,
        spendResetAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
      rateLimits: {
        tpmLimit: 5000,
        rpmLimit: 50,
        currentTpm: 890,
        currentRpm: 8,
      },
      lastSyncAt: new Date(Date.now() - 15 * 60 * 1000),
      syncStatus: 'synced',
    },
    {
      id: 'sub-mock-3',
      userId: 'dev-user-1',
      modelId: 'llama-3.1-8b-instant',
      modelName: 'Llama 3.1 8B Instant',
      provider: 'groq',
      status: SubscriptionStatus.SUSPENDED,
      quotaRequests: 20000,
      quotaTokens: 2000000,
      usedRequests: 20000,
      usedTokens: 2000000,
      remainingRequests: 0,
      remainingTokens: 0,
      utilizationPercent: {
        requests: 100,
        tokens: 100,
      },
      resetAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      metadata: {
        inputCostPer1kTokens: 0.0004,
        outputCostPer1kTokens: 0.0008,
        currency: 'USD',
      },
      // Enhanced LiteLLM integration fields
      liteLLMInfo: {
        keyId: 'sk-litellm-mock-key-3',
        teamId: 'team-enterprise',
        maxBudget: 1000,
        currentSpend: 1000,
        budgetDuration: 'monthly',
        tpmLimit: 20000,
        rpmLimit: 200,
        allowedModels: ['llama-3.1-8b-instant'],
        spendResetAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        budgetUtilization: 100,
      },
      budgetInfo: {
        maxBudget: 1000,
        currentSpend: 1000,
        remainingBudget: 0,
        budgetUtilization: 100,
        spendResetAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      },
      rateLimits: {
        tpmLimit: 20000,
        rpmLimit: 200,
        currentTpm: 0,
        currentRpm: 0,
      },
      teamId: 'team-enterprise',
      teamInfo: {
        id: 'team-enterprise',
        name: 'Enterprise Team',
        role: 'admin',
      },
      lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      syncStatus: 'error',
      syncError: 'Budget limit exceeded',
    },
  ];

  constructor(fastify: FastifyInstance, liteLLMService?: LiteLLMService) {
    this.fastify = fastify;
    this.liteLLMService = liteLLMService || new LiteLLMService(fastify);
  }

  private shouldUseMockData(): boolean {
    // Use mock data only if database is not available
    // This allows using real data in development when database is connected
    const dbUnavailable = this.isDatabaseUnavailable();

    this.fastify.log.debug(
      {
        dbUnavailable,
        nodeEnv: process.env.NODE_ENV,
        hasPg: !!this.fastify.pg,
        mockMode: this.fastify.isDatabaseMockMode ? this.fastify.isDatabaseMockMode() : undefined,
      },
      'Checking if should use mock data',
    );

    return dbUnavailable;
  }

  private isDatabaseUnavailable(): boolean {
    // Check if database connection is available
    // This is a simple check - in a real scenario you might want to ping the database
    try {
      // Check if pg plugin is registered and has a working connection
      if (!this.fastify.pg) {
        this.fastify.log.debug('PostgreSQL plugin not available');
        return true;
      }

      // Additional check: if the database plugin detected unavailability during startup,
      // it would have set up mock mode. Check if we're in mock mode.
      if (this.fastify.isDatabaseMockMode && this.fastify.isDatabaseMockMode()) {
        this.fastify.log.debug('Database mock mode enabled');
        return true;
      }

      return false;
    } catch (error) {
      this.fastify.log.debug({ error }, 'Error checking database availability');
      return true;
    }
  }

  private createMockResponse<T>(data: T): Promise<T> {
    // Simulate network delay
    const delay = Math.random() * 200 + 100; // 100-300ms
    return new Promise((resolve) => setTimeout(() => resolve(data), delay));
  }

  async createSubscription(
    userId: string,
    request: EnhancedCreateSubscriptionDto,
  ): Promise<EnhancedSubscription> {
    const {
      modelId,
      quotaRequests = 10000,
      quotaTokens = 1000000,
      expiresAt,
      maxBudget,
      budgetDuration,
      tpmLimit,
      rpmLimit,
      teamId,
    } = request;

    try {
      // NEW: Ensure user exists in LiteLLM before creating subscription
      await this.ensureUserExistsInLiteLLM(userId);

      // Validate model exists
      const model = await this.liteLLMService.getModelById(modelId);
      if (!model) {
        throw this.fastify.createValidationError(`Model ${modelId} not found`);
      }

      // Check for existing subscription (any status)
      const existingSubscription = await this.fastify.dbUtils.queryOne(
        `SELECT id FROM subscriptions 
         WHERE user_id = $1 AND model_id = $2`,
        [userId, modelId],
      );

      if (existingSubscription) {
        throw this.fastify.createValidationError(
          `Subscription already exists for model ${modelId}. Use the existing subscription or cancel it first.`,
        );
      }

      // Create subscription with enhanced fields
      const subscription = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
        `INSERT INTO subscriptions (
          user_id, model_id, status, quota_requests, quota_tokens, 
          expires_at, reset_at, max_budget, budget_duration,
          tpm_limit, rpm_limit, team_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          userId,
          modelId,
          'active',
          quotaRequests,
          quotaTokens,
          expiresAt || null,
          this.calculateNextResetDate(),
          maxBudget || null,
          budgetDuration || null,
          tpmLimit || null,
          rpmLimit || null,
          teamId || null,
        ],
      );

      if (!subscription) {
        throw new Error('Failed to create subscription');
      }

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'SUBSCRIPTION_CREATE',
          'SUBSCRIPTION',
          subscription.id,
          JSON.stringify({ modelId: subscription.model_id, quotaRequests, quotaTokens }),
        ],
      );

      this.fastify.log.info(
        {
          userId,
          subscriptionId: subscription.id,
          modelId,
        },
        'Subscription created',
      );

      return this.mapToEnhancedSubscription(subscription);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create subscription');
      throw error;
    }
  }

  async getSubscription(
    subscriptionId: string,
    userId?: string,
  ): Promise<EnhancedSubscription | null> {
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

      return this.mapToEnhancedSubscription(subscription);
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
    } = {},
  ): Promise<{ data: EnhancedSubscription[]; total: number }> {
    const { status, modelId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    // Use mock data if database is not available
    if (this.shouldUseMockData()) {
      this.fastify.log.debug('Using mock subscription data');

      // Filter mock data based on options
      let filteredSubscriptions = [...this.MOCK_SUBSCRIPTIONS];

      if (status) {
        filteredSubscriptions = filteredSubscriptions.filter((sub) => sub.status === status);
      }

      if (modelId) {
        filteredSubscriptions = filteredSubscriptions.filter((sub) => sub.modelId === modelId);
      }

      const total = filteredSubscriptions.length;
      const paginatedData = filteredSubscriptions.slice(offset, offset + limit);

      return this.createMockResponse({
        data: paginatedData,
        total,
      });
    }

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
        this.fastify.dbUtils.queryMany<DatabaseSubscription>(query, params),
        this.fastify.dbUtils.queryOne<CountResult>(countQuery, countParams),
      ]);

      if (!countResult) {
        throw new Error('Failed to get subscription count');
      }

      return {
        data: subscriptions.map((sub) => this.mapToEnhancedSubscription(sub)),
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
    updates: EnhancedUpdateSubscriptionDto,
  ): Promise<EnhancedSubscription> {
    try {
      // Validate subscription ownership
      const existing = await this.getSubscription(subscriptionId, userId);
      if (!existing) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      const {
        status,
        quotaRequests,
        quotaTokens,
        expiresAt,
        maxBudget,
        budgetDuration,
        tpmLimit,
        rpmLimit,
        allowedModels,
        teamId,
      } = updates;

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

      // Note: metadata column doesn't exist in subscriptions table
      // Skip metadata update

      if (maxBudget !== undefined) {
        updateFields.push(`max_budget = $${paramIndex++}`);
        params.push(maxBudget);
      }

      if (budgetDuration !== undefined) {
        updateFields.push(`budget_duration = $${paramIndex++}`);
        params.push(budgetDuration);
      }

      if (tpmLimit !== undefined) {
        updateFields.push(`tpm_limit = $${paramIndex++}`);
        params.push(tpmLimit);
      }

      if (rpmLimit !== undefined) {
        updateFields.push(`rpm_limit = $${paramIndex++}`);
        params.push(rpmLimit);
      }

      if (allowedModels !== undefined) {
        updateFields.push(`allowed_models = $${paramIndex++}`);
        params.push(JSON.stringify(allowedModels) as any);
      }

      if (teamId !== undefined) {
        updateFields.push(`team_id = $${paramIndex++}`);
        params.push(teamId);
      }

      // Note: soft_budget column doesn't exist in subscriptions table
      // Skip soft_budget update

      if (updateFields.length === 0) {
        return existing;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(subscriptionId, userId);

      const updatedSubscription = await this.fastify.dbUtils.queryOne(
        `UPDATE subscriptions SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
         RETURNING *`,
        params,
      );

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'SUBSCRIPTION_UPDATE', 'SUBSCRIPTION', subscriptionId, JSON.stringify(updates)],
      );

      this.fastify.log.info(
        {
          userId,
          subscriptionId,
          updates,
        },
        'Subscription updated',
      );

      return this.mapToEnhancedSubscription(updatedSubscription);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to update subscription');
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, userId: string): Promise<EnhancedSubscription> {
    try {
      const subscription = await this.getSubscription(subscriptionId, userId);
      if (!subscription) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      if (['cancelled', 'expired'].includes(subscription.status)) {
        throw this.fastify.createValidationError(`Subscription is already ${subscription.status}`);
      }

      // NEW: Check for linked active API keys before allowing cancellation
      const linkedApiKeys = await this.fastify.dbUtils.queryMany(
        `SELECT id, name, key_prefix 
         FROM api_keys 
         WHERE subscription_id = $1 AND is_active = true`,
        [subscriptionId],
      );

      if (linkedApiKeys.length > 0) {
        // Build a descriptive error message with API key details
        const keyDetails = linkedApiKeys
          .map((key) => `${key.name || 'Unnamed'} (${key.key_prefix}***)`)
          .join(', ');

        const errorMessage =
          linkedApiKeys.length === 1
            ? `Cannot cancel subscription: There is 1 active API key linked to this subscription (${keyDetails}). Please delete the API key first, then cancel the subscription.`
            : `Cannot cancel subscription: There are ${linkedApiKeys.length} active API keys linked to this subscription (${keyDetails}). Please delete all API keys first, then cancel the subscription.`;

        throw this.fastify.createValidationError(errorMessage);
      }

      // If no active API keys are linked, proceed with deletion
      // First get the subscription data before deletion for the response
      const subscriptionToDelete = await this.getSubscription(subscriptionId, userId);
      if (!subscriptionToDelete) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      // Delete the subscription from the database
      const deleteResult = await this.fastify.dbUtils.query(
        'DELETE FROM subscriptions WHERE id = $1 AND user_id = $2',
        [subscriptionId, userId],
      );

      // Check if deletion was successful
      if (deleteResult.rowCount === 0) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      this.fastify.log.info({ subscriptionId, userId }, 'Subscription deleted successfully');

      // Return the subscription data with cancelled status for frontend compatibility
      // This allows the frontend to show the cancellation was successful
      return {
        ...subscriptionToDelete,
        status: SubscriptionStatus.CANCELLED,
        updatedAt: new Date(),
      };
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
          limit: subscription.quotaRequests || 0,
          used: subscription.usedRequests || 0,
          remaining: subscription.remainingRequests || 0,
          resetAt: subscription.resetAt,
        },
        tokens: {
          limit: subscription.quotaTokens || 0,
          used: subscription.usedTokens || 0,
          remaining: subscription.remainingTokens || 0,
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
    requestTokens: number,
  ): Promise<{ canProceed: boolean; reason?: string }> {
    try {
      const subscription = await this.fastify.dbUtils.queryOne(
        'SELECT * FROM subscriptions WHERE id = $1',
        [subscriptionId],
      );

      if (!subscription) {
        return { canProceed: false, reason: 'Subscription not found' };
      }

      if (subscription.status !== 'active') {
        return { canProceed: false, reason: `Subscription is ${subscription.status}` };
      }

      if (subscription.expires_at && new Date(String(subscription.expires_at)) < new Date()) {
        return { canProceed: false, reason: 'Subscription has expired' };
      }

      if (Number(subscription.used_requests) >= Number(subscription.quota_requests)) {
        return { canProceed: false, reason: 'Request quota exceeded' };
      }

      if (Number(subscription.used_tokens) + requestTokens > Number(subscription.quota_tokens)) {
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
      const params: any[] = [this.calculateNextResetDate()];

      if (userId) {
        query += ` AND user_id = $2`;
        params.push(userId);
      }

      const result = await this.fastify.dbUtils.query(query, params);

      this.fastify.log.info(
        {
          userId,
          resetCount: result.rowCount,
        },
        'Quotas reset',
      );

      return result.rowCount || 0;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to reset quotas');
      throw error;
    }
  }

  async validateSubscription(
    subscriptionData: EnhancedCreateSubscriptionDto,
  ): Promise<SubscriptionValidation> {
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

      statusCounts.forEach((row) => {
        byStatus[String(row.status)] = parseInt(String(row.count));
        total += parseInt(String(row.count));
      });

      const byProvider: Record<string, number> = {};
      providerCounts.forEach((row) => {
        byProvider[String(row.provider)] = parseInt(String(row.count));
      });

      return {
        total,
        byStatus,
        byProvider,
        totalQuotaUsage: {
          requests: {
            used: parseInt(String(quotaStats?.total_used_requests || '0')),
            limit: parseInt(String(quotaStats?.total_quota_requests || '0')),
          },
          tokens: {
            used: parseInt(String(quotaStats?.total_used_tokens || '0')),
            limit: parseInt(String(quotaStats?.total_quota_tokens || '0')),
          },
        },
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get subscription stats');
      throw error;
    }
  }

  // Enhanced LiteLLM Integration Methods

  async createEnhancedSubscription(
    userId: string,
    request: EnhancedCreateSubscriptionDto,
  ): Promise<EnhancedSubscription> {
    const {
      modelId,
      quotaRequests = 10000,
      quotaTokens = 1000000,
      expiresAt,
      metadata = {},
      maxBudget,
      budgetDuration = 'monthly',
      tpmLimit,
      rpmLimit,
      allowedModels,
      teamId,
      softBudget,
      generateApiKey = false,
      apiKeyAlias,
      apiKeyTags,
      apiKeyPermissions,
    } = request;

    if (this.shouldUseMockData()) {
      // Mock implementation with enhanced features
      const mockSubscription: EnhancedSubscription = {
        id: `sub-enhanced-${Date.now()}`,
        userId,
        modelId,
        status: SubscriptionStatus.ACTIVE,
        quotaRequests,
        quotaTokens,
        usedRequests: 0,
        usedTokens: 0,
        resetAt: this.calculateNextResetDate(),
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        liteLLMInfo: {
          keyId: generateApiKey ? `sk-litellm-mock-${Date.now()}` : undefined,
          teamId,
          maxBudget,
          currentSpend: 0,
          budgetDuration,
          tpmLimit,
          rpmLimit,
          allowedModels: allowedModels || [modelId],
          spendResetAt: this.calculateNextResetDate(),
          budgetUtilization: 0,
        },
        budgetInfo: {
          maxBudget,
          currentSpend: 0,
          remainingBudget: maxBudget,
          budgetUtilization: 0,
          spendResetAt: this.calculateNextResetDate(),
        },
        rateLimits: {
          tpmLimit,
          rpmLimit,
          currentTpm: 0,
          currentRpm: 0,
        },
        teamId,
        lastSyncAt: new Date(),
        syncStatus: 'synced',
      };

      return this.createMockResponse(mockSubscription);
    }

    try {
      // Create subscription with LiteLLM integration
      const baseSubscription = await this.createSubscription(userId, {
        modelId,
        quotaRequests,
        quotaTokens,
        expiresAt,
        metadata,
      });

      // Create associated API key if requested
      let liteLLMKeyId: string | undefined;
      let keyRequest: LiteLLMKeyGenerationRequest | undefined;
      if (generateApiKey) {
        keyRequest = {
          key_alias: this.generateUniqueKeyAlias(
            apiKeyAlias || `subscription-${baseSubscription.id.substring(0, 8)}`,
          ),
          duration: expiresAt ? this.calculateDuration(expiresAt) : undefined,
          models: allowedModels || [modelId],
          max_budget: maxBudget,
          user_id: userId,
          team_id: teamId,
          tpm_limit: tpmLimit,
          rpm_limit: rpmLimit,
          budget_duration: budgetDuration,
          permissions: apiKeyPermissions
            ? {
                allow_chat_completions: apiKeyPermissions.allowChatCompletions,
                allow_embeddings: apiKeyPermissions.allowEmbeddings,
                allow_completions: apiKeyPermissions.allowCompletions,
              }
            : undefined,
          tags: apiKeyTags,
          soft_budget: softBudget,
          metadata: {
            subscription_id: baseSubscription.id,
            created_by: 'litemaas',
          },
        };

        const keyResponse = await this.liteLLMService.generateApiKey(keyRequest);
        liteLLMKeyId = keyResponse.key;
      }

      // Update subscription with LiteLLM data
      const enhancedSubscription = await this.fastify.dbUtils.queryOne(
        `UPDATE subscriptions 
         SET max_budget = $1,
             budget_duration = $2,
             tpm_limit = $3,
             rpm_limit = $4,
             team_id = $5,
             lite_llm_key_value = $6,
             last_sync_at = CURRENT_TIMESTAMP,
             sync_status = 'synced'
         WHERE id = $7
         RETURNING *`,
        [maxBudget ?? null, budgetDuration ?? null, tpmLimit ?? null, rpmLimit ?? null, teamId ?? null, liteLLMKeyId ?? null, baseSubscription.id],
      );

      this.fastify.log.info(
        {
          userId,
          subscriptionId: baseSubscription.id,
          modelId,
          hasApiKey: !!liteLLMKeyId,
          maxBudget,
          teamId,
          keyAlias: generateApiKey && keyRequest ? keyRequest.key_alias : undefined,
          originalAlias: apiKeyAlias,
        },
        'Enhanced subscription created with LiteLLM integration',
      );

      return this.mapToEnhancedSubscription(enhancedSubscription);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to create enhanced subscription');
      throw error;
    }
  }

  async syncSubscriptionWithLiteLLM(
    subscriptionId: string,
    userId: string,
    request: SubscriptionSyncRequest = {},
  ): Promise<SubscriptionSyncResponse> {
    const {
      forceSync = false,
      syncBudget = true,
      syncUsage = true,
      syncRateLimits = true,
    } = request;

    try {
      const subscription = await this.getSubscription(subscriptionId, userId);
      if (!subscription) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      if (!subscription.liteLLMInfo?.keyId) {
        throw this.fastify.createValidationError('Subscription is not integrated with LiteLLM');
      }

      const changes: SubscriptionSyncResponse['changes'] = {};

      // Get current info from LiteLLM
      const liteLLMInfo = await this.liteLLMService.getKeyInfo(subscription.liteLLMInfo.keyId);

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (
        syncBudget &&
        (forceSync || liteLLMInfo.max_budget !== subscription.liteLLMInfo.maxBudget)
      ) {
        updateFields.push(`max_budget = $${paramIndex++}`);
        params.push(liteLLMInfo.max_budget);
        changes.budgetUpdated = true;
      }

      if (syncUsage && (forceSync || liteLLMInfo.spend !== subscription.liteLLMInfo.currentSpend)) {
        updateFields.push(`current_spend = $${paramIndex++}`);
        params.push(liteLLMInfo.spend);
        changes.usageUpdated = true;
      }

      if (
        syncRateLimits &&
        (forceSync ||
          liteLLMInfo.tpm_limit !== subscription.liteLLMInfo.tpmLimit ||
          liteLLMInfo.rpm_limit !== subscription.liteLLMInfo.rpmLimit)
      ) {
        updateFields.push(`tpm_limit = $${paramIndex++}`, `rpm_limit = $${paramIndex++}`);
        params.push(liteLLMInfo.tpm_limit, liteLLMInfo.rpm_limit);
        changes.rateLimitsUpdated = true;
      }

      if (updateFields.length > 0) {
        updateFields.push(`last_sync_at = CURRENT_TIMESTAMP`, `sync_status = 'synced'`);
        params.push(subscriptionId);

        await this.fastify.dbUtils.queryOne(
          `UPDATE subscriptions 
           SET ${updateFields.join(', ')}
           WHERE id = $${paramIndex}
           RETURNING *`,
          params,
        );
      }

      this.fastify.log.info(
        {
          subscriptionId,
          userId,
          changes,
        },
        'Subscription synced with LiteLLM',
      );

      return {
        subscriptionId,
        syncedAt: new Date(),
        success: true,
        changes,
      };
    } catch (error) {
      // Mark sync as failed
      await this.fastify.dbUtils.query(
        `UPDATE subscriptions 
         SET sync_status = 'error', 
             sync_error = $1,
             last_sync_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [error instanceof Error ? error.message : String(error), subscriptionId],
      );

      this.fastify.log.error(error, 'Failed to sync subscription with LiteLLM');

      return {
        subscriptionId,
        syncedAt: new Date(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getSubscriptionBudgetInfo(
    subscriptionId: string,
    userId: string,
  ): Promise<SubscriptionBudgetInfo> {
    try {
      const subscription = await this.getSubscription(subscriptionId, userId);
      if (!subscription) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      // Try to get real-time data from LiteLLM if available
      let currentSpend = subscription.liteLLMInfo?.currentSpend || 0;
      let maxBudget = subscription.liteLLMInfo?.maxBudget;

      if (subscription.liteLLMInfo?.keyId && !this.shouldUseMockData()) {
        try {
          const liteLLMInfo = await this.liteLLMService.getKeyInfo(subscription.liteLLMInfo.keyId);
          currentSpend = liteLLMInfo.spend;
          maxBudget = liteLLMInfo.max_budget;
        } catch (error) {
          this.fastify.log.warn(error, 'Failed to get real-time budget info from LiteLLM');
        }
      }

      const budgetUtilization = maxBudget ? (currentSpend / maxBudget) * 100 : 0;
      const remainingBudget = maxBudget ? maxBudget - currentSpend : undefined;
      const alertTriggered = subscription.liteLLMInfo?.budgetUtilization
        ? subscription.liteLLMInfo.budgetUtilization >= 90
        : false;

      return {
        subscriptionId,
        maxBudget,
        currentSpend,
        budgetUtilization,
        remainingBudget,
        budgetDuration: subscription.liteLLMInfo?.budgetDuration,
        spendResetAt: subscription.liteLLMInfo?.spendResetAt,
        softBudget: subscription.budgetInfo?.maxBudget
          ? subscription.budgetInfo.maxBudget * 0.9
          : undefined,
        alertTriggered,
        lastUpdatedAt: subscription.lastSyncAt || subscription.createdAt,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get subscription budget info');
      throw error;
    }
  }

  async getSubscriptionUsageAnalytics(
    subscriptionId: string,
    userId: string,
    period: {
      start: Date;
      end: Date;
      type: 'day' | 'week' | 'month' | 'year';
    },
  ): Promise<SubscriptionUsageAnalytics> {
    try {
      const subscription = await this.getSubscription(subscriptionId, userId);
      if (!subscription) {
        throw this.fastify.createNotFoundError('Subscription');
      }

      if (this.shouldUseMockData()) {
        // Mock analytics data
        return {
          subscriptionId,
          period,
          usage: {
            requestCount: Math.floor(Math.random() * 1000) + 100,
            tokenCount: Math.floor(Math.random() * 100000) + 10000,
            totalSpend: Math.random() * 50 + 10,
            averageRequestCost: 0.002,
            averageTokenCost: 0.00001,
          },
          models: [
            {
              modelId: subscription.modelId,
              modelName: subscription.modelName || subscription.modelId,
              requestCount: Math.floor(Math.random() * 800) + 80,
              tokenCount: Math.floor(Math.random() * 80000) + 8000,
              spend: Math.random() * 40 + 8,
            },
          ],
          rateLimitEvents: {
            tpmViolations: Math.floor(Math.random() * 5),
            rpmViolations: Math.floor(Math.random() * 3),
          },
        };
      }

      // Real analytics implementation would query usage logs
      const usageQuery = `
        SELECT 
          COUNT(*) as request_count,
          SUM(token_count) as token_count,
          SUM(cost) as total_spend,
          AVG(cost) as average_request_cost,
          model_id
        FROM usage_logs 
        WHERE subscription_id = $1 
          AND created_at >= $2 
          AND created_at <= $3
        GROUP BY model_id
      `;

      const usageData = await this.fastify.dbUtils.queryMany(usageQuery, [
        subscriptionId,
        period.start,
        period.end,
      ]);

      const totalUsage = usageData.reduce(
        (acc, row) => ({
          requestCount: (acc.requestCount as number) + parseInt(String(row.request_count)),
          tokenCount: (acc.tokenCount as number) + parseInt(String(row.token_count || '0')),
          totalSpend: (acc.totalSpend as number) + parseFloat(String(row.total_spend || '0')),
          averageRequestCost: acc.averageRequestCost,
          averageTokenCost: acc.averageTokenCost,
        }),
        {
          requestCount: 0,
          tokenCount: 0,
          totalSpend: 0,
          averageRequestCost: 0,
          averageTokenCost: 0,
        },
      );

      totalUsage.averageRequestCost =
        (totalUsage.requestCount as number) > 0 ? (totalUsage.totalSpend as number) / (totalUsage.requestCount as number) : 0;
      totalUsage.averageTokenCost =
        (totalUsage.tokenCount as number) > 0 ? (totalUsage.totalSpend as number) / (totalUsage.tokenCount as number) : 0;

      return {
        subscriptionId,
        period,
        usage: totalUsage as {
          requestCount: number;
          tokenCount: number;
          totalSpend: number;
          averageRequestCost: number;
          averageTokenCost: number;
        },
        models: usageData.map((row) => ({
          modelId: String(row.model_id),
          modelName: String(row.model_id), // Would be joined from models table in real implementation
          requestCount: parseInt(String(row.request_count)),
          tokenCount: parseInt(String(row.token_count || '0')),
          spend: parseFloat(String(row.total_spend || '0')),
        })),
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get subscription usage analytics');
      throw error;
    }
  }

  async bulkUpdateSubscriptions(
    operation: BulkSubscriptionOperation,
    adminUserId: string,
  ): Promise<BulkSubscriptionResult> {
    const { subscriptionIds, operation: operationType, params = {} } = operation;
    const results: BulkSubscriptionResult['results'] = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const subscriptionId of subscriptionIds) {
        try {
          switch (operationType) {
            case 'suspend':
              await this.updateSubscription(subscriptionId, adminUserId, {
                status: SubscriptionStatus.SUSPENDED,
              });
              break;
            case 'activate':
              await this.updateSubscription(subscriptionId, adminUserId, {
                status: SubscriptionStatus.ACTIVE,
              });
              break;
            case 'update_budget':
              if (params.maxBudget) {
                await this.updateSubscription(subscriptionId, adminUserId, {
                  maxBudget: params.maxBudget,
                });
              }
              break;
            case 'update_limits':
              await this.updateSubscription(subscriptionId, adminUserId, {
                tpmLimit: params.tpmLimit,
                rpmLimit: params.rpmLimit,
              });
              break;
            case 'transfer_team':
              if (params.teamId) {
                await this.updateSubscription(subscriptionId, adminUserId, {
                  teamId: params.teamId,
                });
              }
              break;
            default:
              throw new Error(`Unknown operation: ${operationType}`);
          }

          results.push({ subscriptionId, success: true });
          successCount++;
        } catch (error) {
          results.push({
            subscriptionId,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          errorCount++;
        }
      }

      // Create audit log for bulk operation
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          adminUserId,
          'BULK_SUBSCRIPTION_UPDATE',
          'SUBSCRIPTION',
          JSON.stringify({
            operation: operationType,
            params,
            totalCount: subscriptionIds.length,
            successCount,
            errorCount,
          }),
        ],
      );

      this.fastify.log.info(
        {
          adminUserId,
          operation: operationType,
          totalCount: subscriptionIds.length,
          successCount,
          errorCount,
        },
        'Bulk subscription operation completed',
      );

      return {
        totalCount: subscriptionIds.length,
        successCount,
        errorCount,
        results,
        executedAt: new Date(),
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to execute bulk subscription operation');
      throw error;
    }
  }

  // Helper method for duration calculation
  private calculateDuration(expiresAt: Date): string {
    const diffMs = expiresAt.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays}d`;
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
    return `${sanitizedName || 'subscription'}_${uuid}`;
  }

  private mapToEnhancedSubscription(subscription: any): EnhancedSubscription {
    const remainingRequests = Math.max(
      0,
      (subscription.quota_requests as number) - (subscription.used_requests as number),
    );
    const remainingTokens = Math.max(
      0,
      (subscription.quota_tokens as number) - (subscription.used_tokens as number),
    );

    const baseSubscription = {
      id: subscription.id as string,
      userId: subscription.user_id as string,
      modelId: subscription.model_id as string,
      modelName: subscription.model_name as string,
      provider: subscription.provider as string,
      status: subscription.status as SubscriptionStatus,
      quotaRequests: subscription.quota_requests as number,
      quotaTokens: subscription.quota_tokens as number,
      usedRequests: subscription.used_requests as number,
      usedTokens: subscription.used_tokens as number,
      remainingRequests,
      remainingTokens,
      utilizationPercent: {
        requests:
          (subscription.quota_requests as number) > 0
            ? Math.round(((subscription.used_requests as number) / (subscription.quota_requests as number)) * 100)
            : 0,
        tokens:
          (subscription.quota_tokens as number) > 0
            ? Math.round(((subscription.used_tokens as number) / (subscription.quota_tokens as number)) * 100)
            : 0,
      },
      resetAt: subscription.reset_at ? new Date(subscription.reset_at as string | Date) : undefined,
      expiresAt: subscription.expires_at ? new Date(subscription.expires_at as string | Date) : undefined,
      createdAt: new Date(subscription.created_at as string | Date | number),
      updatedAt: new Date(subscription.updated_at as string | Date | number),
      metadata: {}, // metadata column doesn't exist in database
    };

    // Add enhanced LiteLLM integration fields
    const enhanced: EnhancedSubscription = {
      ...baseSubscription,

      // LiteLLM integration info
      liteLLMInfo: subscription.lite_llm_key_value
        ? {
            keyId: subscription.lite_llm_key_value as string,
            teamId: subscription.team_id as string,
            maxBudget: subscription.max_budget as number,
            currentSpend: (subscription.current_spend as number) || 0,
            budgetDuration: subscription.budget_duration as 'daily' | 'weekly' | 'monthly' | 'yearly',
            tpmLimit: subscription.tpm_limit as number,
            rpmLimit: subscription.rpm_limit as number,
            allowedModels: subscription.allowed_models
              ? JSON.parse(subscription.allowed_models as string)
              : undefined,
            spendResetAt: subscription.spend_reset_at
              ? new Date(subscription.spend_reset_at as string | Date | number)
              : undefined,
            budgetUtilization:
              subscription.max_budget && subscription.current_spend
                ? ((subscription.current_spend as number) / (subscription.max_budget as number)) * 100
                : 0,
          }
        : undefined,

      // Budget information
      budgetInfo: subscription.max_budget
        ? {
            maxBudget: subscription.max_budget as number,
            currentSpend: (subscription.current_spend as number) || 0,
            remainingBudget: (subscription.max_budget as number) - ((subscription.current_spend as number) || 0),
            budgetUtilization:
              subscription.max_budget && subscription.current_spend
                ? ((subscription.current_spend as number) / (subscription.max_budget as number)) * 100
                : 0,
            spendResetAt: subscription.spend_reset_at
              ? new Date(subscription.spend_reset_at as string | Date | number)
              : undefined,
          }
        : undefined,

      // Rate limits
      rateLimits:
        subscription.tpm_limit || subscription.rpm_limit
          ? {
              tpmLimit: subscription.tpm_limit as number,
              rpmLimit: subscription.rpm_limit as number,
              currentTpm: (subscription.current_tpm as number) || 0,
              currentRpm: (subscription.current_rpm as number) || 0,
            }
          : undefined,

      // Team association
      teamId: subscription.team_id as string,
      teamInfo: subscription.team_name
        ? {
            id: subscription.team_id as string,
            name: subscription.team_name as string,
            role: (subscription.team_role as 'admin' | 'member' | 'viewer') || 'member',
          }
        : undefined,

      // Sync metadata
      lastSyncAt: subscription.last_sync_at ? new Date(subscription.last_sync_at as string | Date | number) : undefined,
      syncStatus: (subscription.sync_status as 'error' | 'synced' | 'pending') || 'pending',
      syncError: subscription.sync_error as string,
    };

    return enhanced;
  }

  private calculateNextResetDate(): Date {
    // Reset monthly on the first day of the month
    const now = new Date();
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextReset;
  }

  /**
   * Ensures user exists in LiteLLM backend, creating them if necessary
   */
  /**
   * Ensures team exists in LiteLLM backend, creating it if necessary
   */
  private async ensureTeamExistsInLiteLLM(teamId: string): Promise<void> {
    try {
      // First check if team exists in LiteLLM
      const existingTeam = await this.liteLLMService.getTeamInfo(teamId);
      this.fastify.log.info(
        {
          teamId,
          existingTeam: {
            team_id: existingTeam.team_id,
            team_alias: existingTeam.team_alias,
            spend: existingTeam.spend,
            max_budget: existingTeam.max_budget,
          },
        },
        'Team already exists in LiteLLM',
      );
    } catch (error) {
      // Team doesn't exist in LiteLLM, get team from database and create it
      this.fastify.log.info(
        {
          teamId,
          error: error instanceof Error ? error.message : 'Unknown error',
          isMocking: this.liteLLMService.getMetrics().config.enableMocking,
        },
        'Team not found in LiteLLM, attempting to create',
      );

      try {
        // Get team information from database
        const team = await this.fastify.dbUtils.queryOne(
          'SELECT id, name, description, max_budget, tpm_limit, rpm_limit FROM teams WHERE id = $1',
          [teamId],
        );

        if (!team) {
          throw new Error(`Team ${teamId} not found in database`);
        }

        const createTeamRequest = {
          team_id: String(team.id),
          team_alias: team.name as string,
          max_budget: Number(team.max_budget) || 1000, // Use team's budget or default
          tpm_limit: Number(team.tpm_limit) || 10000, // Use team's limit or default
          rpm_limit: Number(team.rpm_limit) || 500, // Use team's limit or default
          admins: [], // Will be populated from team members
          models: [], // Empty array enables all models
        };

        this.fastify.log.info(
          {
            teamId,
            createTeamRequest,
            isMocking: this.liteLLMService.getMetrics().config.enableMocking,
          },
          'Sending team creation request to LiteLLM',
        );

        // Create team in LiteLLM
        const createdTeam = await this.liteLLMService.createTeam(createTeamRequest);

        this.fastify.log.info(
          {
            teamId,
            createdTeam: {
              team_id: createdTeam.team_id,
              team_alias: createdTeam.team_alias,
              max_budget: createdTeam.max_budget,
              spend: createdTeam.spend,
              created_at: createdTeam.created_at,
            },
            isMocking: this.liteLLMService.getMetrics().config.enableMocking,
          },
          'LiteLLM team creation response received',
        );

        // Verify team was actually created by attempting to fetch it
        try {
          const verificationTeam = await this.liteLLMService.getTeamInfo(teamId);
          this.fastify.log.info(
            {
              teamId,
              verificationTeam: {
                team_id: verificationTeam.team_id,
                team_alias: verificationTeam.team_alias,
              },
            },
            'Verified team exists in LiteLLM after creation',
          );
        } catch (verifyError) {
          this.fastify.log.error(
            {
              teamId,
              verifyError: verifyError instanceof Error ? verifyError.message : 'Unknown error',
              isMocking: this.liteLLMService.getMetrics().config.enableMocking,
            },
            'CRITICAL: Team creation appeared to succeed but team cannot be retrieved from LiteLLM',
          );
          throw new Error(
            `Team creation verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
          );
        }

        this.fastify.log.info(
          { teamId },
          'Successfully created and verified team in LiteLLM for subscription creation',
        );
      } catch (createError) {
        this.fastify.log.error(
          {
            teamId,
            error: createError instanceof Error ? createError.message : 'Unknown error',
            errorStack: createError instanceof Error ? createError.stack : undefined,
            isMocking: this.liteLLMService.getMetrics().config.enableMocking,
          },
          'Failed to create team in LiteLLM for subscription creation',
        );

        throw new Error(
          `Failed to create team in LiteLLM: ${createError instanceof Error ? createError.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async ensureUserExistsInLiteLLM(userId: string): Promise<void> {
    try {
      // First check if user exists in LiteLLM (returns null for non-existent users)
      const existingUser = await this.liteLLMService.getUserInfo(userId);
      if (existingUser) {
        this.fastify.log.info(
          {
            userId,
            existingUser: {
              user_id: existingUser.user_id,
              user_alias: existingUser.user_alias,
              spend: existingUser.spend,
              max_budget: existingUser.max_budget,
              teams: existingUser.teams,
            },
          },
          'User already exists in LiteLLM',
        );
        return; // User exists, nothing to do
      }

      // User doesn't exist in LiteLLM, create them
      this.fastify.log.info(
        {
          userId,
          isMocking: this.liteLLMService.getMetrics().config.enableMocking,
        },
        'User not found in LiteLLM, attempting to create for subscription',
      );

      // Get user information from database
      const user = await this.fastify.dbUtils.queryOne(
        'SELECT id, username, email, full_name, roles, max_budget, tpm_limit, rpm_limit FROM users WHERE id = $1',
        [userId],
      );

      if (!user) {
        throw new Error(`User ${userId} not found in database`);
      }

      // Ensure the default team exists in LiteLLM before creating user
      await this.ensureTeamExistsInLiteLLM(DefaultTeamService.DEFAULT_TEAM_ID);

      // Create user in LiteLLM with default team assignment
      await this.liteLLMService.createUser({
        user_id: user.id as string,
        user_email: user.email as string,
        user_alias: user.username as string,
        user_role: (user.roles as string[])?.includes('admin') ? 'proxy_admin' : 'internal_user',
        max_budget: (user.max_budget as number) || 100, // Use user's budget or default
        tpm_limit: (user.tpm_limit as number) || 1000, // Use user's limit or default
        rpm_limit: (user.rpm_limit as number) || 60, // Use user's limit or default
        auto_create_key: false, // Don't auto-create key during user creation
        teams: [DefaultTeamService.DEFAULT_TEAM_ID], // CRITICAL: Always assign user to default team
      });

      // Update user sync status in database
      await this.fastify.dbUtils.query(
        'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
        ['synced', userId],
      );

      this.fastify.log.info(
        { userId },
        'Successfully created user in LiteLLM for subscription creation',
      );
    } catch (error) {
      // Check if error is due to user already existing (by email)
      if (error instanceof Error && error.message && error.message.includes('already exists')) {
        this.fastify.log.info(
          { userId, error: error.message },
          'User already exists in LiteLLM (by email) - continuing with subscription creation',
        );
        // Don't throw - user exists, which is what we wanted
        // Update sync status to success since user exists
        await this.fastify.dbUtils.query(
          'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
          ['synced', userId],
        );
        return;
      }

      // Update user sync status to error for other errors
      await this.fastify.dbUtils.query(
        'UPDATE users SET sync_status = $1, updated_at = NOW() WHERE id = $2',
        ['error', userId],
      );

      this.fastify.log.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to create user in LiteLLM for subscription creation',
      );

      throw new Error(
        `Failed to create user in LiteLLM: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

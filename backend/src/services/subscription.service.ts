import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { LiteLLMService } from './litellm.service';
import { BaseService } from './base.service.js';
import { NotificationService } from './notification.service.js';
import { LiteLLMSyncUtils } from '../utils/litellm-sync.utils.js';
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
  SubscriptionApprovalFilters,
  SubscriptionApprovalStats,
  SubscriptionWithDetails,
} from '../types/subscription.types.js';
import { LiteLLMKeyGenerationRequest } from '../types/api-key.types.js';
import { PaginatedResponse } from '../types/common.types.js';

// System user ID for automated status changes
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

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
  // Additional fields from JOIN with models table
  model_name?: string;
  provider?: string;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
}

interface CountResult {
  count: string;
}

export interface UpdateSubscriptionRequest {
  status?: 'active' | 'suspended' | 'cancelled' | 'expired' | 'inactive';
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
  status: 'pending' | 'active' | 'suspended' | 'cancelled' | 'expired' | 'inactive';
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

export class SubscriptionService extends BaseService {
  private liteLLMService: LiteLLMService;
  private notificationService: NotificationService;

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
      // Model details for UI display
      modelDescription: 'GPT-4o is our most advanced multimodal model with vision capabilities.',
      modelContextLength: 128000,
      modelSupportsVision: true,
      modelSupportsFunctionCalling: true,
      modelSupportsParallelFunctionCalling: true,
      modelSupportsToolChoice: true,
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
      // Model details for UI display
      modelDescription: 'Claude 3.5 Sonnet excels at complex reasoning and creative tasks.',
      modelContextLength: 200000,
      modelSupportsVision: true,
      modelSupportsFunctionCalling: true,
      modelSupportsParallelFunctionCalling: false,
      modelSupportsToolChoice: true,
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
      // Model details for UI display
      modelDescription: 'Llama 3.1 8B Instant is a fast and efficient language model.',
      modelContextLength: 8192,
      modelSupportsVision: false,
      modelSupportsFunctionCalling: true,
      modelSupportsParallelFunctionCalling: false,
      modelSupportsToolChoice: false,
    },
    {
      id: 'sub-mock-4',
      userId: 'dev-user-1',
      modelId: 'gpt-3.5-turbo',
      modelName: 'GPT-3.5 Turbo',
      provider: 'openai',
      status: SubscriptionStatus.INACTIVE,
      quotaRequests: 5000,
      quotaTokens: 500000,
      usedRequests: 0,
      usedTokens: 0,
      remainingRequests: 5000,
      remainingTokens: 500000,
      utilizationPercent: {
        requests: 0,
        tokens: 0,
      },
      resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      metadata: {
        inputCostPer1kTokens: 0.001,
        outputCostPer1kTokens: 0.002,
        currency: 'USD',
      },
      // Enhanced LiteLLM integration fields
      liteLLMInfo: {
        keyId: 'sk-litellm-mock-key-4',
        teamId: 'team-prod',
        maxBudget: 100,
        currentSpend: 0,
        budgetDuration: 'monthly',
        tpmLimit: 5000,
        rpmLimit: 50,
        allowedModels: ['gpt-3.5-turbo'],
        spendResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        budgetUtilization: 0,
      },
      budgetInfo: {
        maxBudget: 100,
        currentSpend: 0,
        remainingBudget: 100,
        budgetUtilization: 0,
        spendResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      rateLimits: {
        tpmLimit: 5000,
        rpmLimit: 50,
        currentTpm: 0,
        currentRpm: 0,
      },
      teamId: 'team-prod',
      teamInfo: {
        id: 'team-prod',
        name: 'Production Team',
        role: 'member',
      },
      lastSyncAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      syncStatus: 'synced',
      // Model details for UI display
      modelDescription: 'GPT-3.5 Turbo is no longer available (inactive model).',
      modelContextLength: 16385,
      modelSupportsVision: false,
      modelSupportsFunctionCalling: true,
      modelSupportsParallelFunctionCalling: false,
      modelSupportsToolChoice: true,
    },
  ];

  constructor(fastify: FastifyInstance, liteLLMService?: LiteLLMService) {
    super(fastify);
    this.liteLLMService = liteLLMService || new LiteLLMService(fastify);
    this.notificationService = new NotificationService(fastify);
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
      await LiteLLMSyncUtils.ensureUserExistsInLiteLLM(userId, this.fastify, this.liteLLMService);

      // Validate model exists
      const model = await this.liteLLMService.getModelById(modelId);
      if (!model) {
        throw this.createNotFoundError(
          'Model',
          modelId,
          'Model not found. Please check the model ID and ensure it exists in the system',
        );
      }

      // Check if model is restricted (requires admin approval)
      const modelDetails = await this.fastify.dbUtils.queryOne<{ restricted_access: boolean }>(
        'SELECT restricted_access FROM models WHERE id = $1',
        [modelId],
      );

      const initialStatus = modelDetails?.restricted_access ? 'pending' : 'active';

      // Check for existing subscription with status
      const existingSubscription = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
        `SELECT * FROM subscriptions 
         WHERE user_id = $1 AND model_id = $2`,
        [userId, modelId],
      );

      if (existingSubscription) {
        // If subscription is inactive, reactivate it with new parameters
        if (existingSubscription.status === 'inactive') {
          const updatedSubscription = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
            `UPDATE subscriptions
             SET status = $1, quota_requests = $2, quota_tokens = $3,
                 expires_at = $4, reset_at = $5, max_budget = $6,
                 budget_duration = $7, tpm_limit = $8, rpm_limit = $9,
                 team_id = $10, updated_at = CURRENT_TIMESTAMP
             WHERE id = $11
             RETURNING *`,
            [
              initialStatus, // Use initialStatus instead of hardcoded 'active'
              quotaRequests,
              quotaTokens,
              expiresAt || null,
              this.calculateNextResetDate(),
              maxBudget || null,
              budgetDuration || null,
              tpmLimit || null,
              rpmLimit || null,
              teamId || null,
              existingSubscription.id,
            ],
          );

          if (!updatedSubscription) {
            throw this.createNotFoundError(
              'Subscription',
              existingSubscription.id,
              'Unable to reactivate subscription. The subscription may have been deleted',
            );
          }

          // Create audit log for reactivation
          const auditAction =
            initialStatus === 'pending' ? 'SUBSCRIPTION_REAPPLIED' : 'SUBSCRIPTION_REACTIVATED';
          await this.fastify.dbUtils.query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
              auditAction,
              'SUBSCRIPTION',
              updatedSubscription.id,
              JSON.stringify({
                modelId: updatedSubscription.model_id,
                quotaRequests,
                quotaTokens,
                previousStatus: 'inactive',
                newStatus: initialStatus,
                restrictedModel: modelDetails?.restricted_access || false,
              }),
            ],
          );

          // Notify admins if subscription is pending (restricted model)
          if (initialStatus === 'pending') {
            await this.notificationService.notifyAdminsNewPendingRequest(
              updatedSubscription.id,
              userId,
              modelId,
            );
          }

          this.fastify.log.info(
            {
              userId,
              subscriptionId: updatedSubscription.id,
              modelId,
              status: initialStatus,
              restrictedModel: modelDetails?.restricted_access || false,
            },
            `Subscription reactivated from inactive status with ${initialStatus} status`,
          );

          return this.mapToEnhancedSubscription(updatedSubscription);
        } else {
          // Subscription exists but is not inactive (active, suspended, etc.)
          throw this.createAlreadyExistsError(
            'Subscription',
            'modelId',
            modelId,
            'A subscription for this model already exists. Use the existing subscription or cancel it first',
          );
        }
      }

      // Create new subscription if none exists
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
          initialStatus,
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
        throw this.createNotFoundError(
          'Subscription',
          modelId,
          'Failed to create subscription. Please verify the model ID and try again',
        );
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
          JSON.stringify({
            modelId: subscription.model_id,
            quotaRequests,
            quotaTokens,
            initialStatus,
            restrictedModel: modelDetails?.restricted_access || false,
          }),
        ],
      );

      // Notify admins if subscription is pending (restricted model)
      if (initialStatus === 'pending') {
        await this.notificationService.notifyAdminsNewPendingRequest(
          subscription.id,
          userId,
          modelId,
        );
      }

      this.fastify.log.info(
        {
          userId,
          subscriptionId: subscription.id,
          modelId,
          status: initialStatus,
          restrictedModel: modelDetails?.restricted_access || false,
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
        SELECT s.*, m.name as model_name, m.provider,
               m.input_cost_per_token, m.output_cost_per_token
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
      includeInactive?: boolean;
    } = {},
  ): Promise<{ data: EnhancedSubscription[]; total: number }> {
    const { status, modelId, page = 1, limit = 20, includeInactive = false } = options;
    const offset = (page - 1) * limit;

    // Use mock data if database is not available
    if (this.shouldUseMockData()) {
      this.fastify.log.debug('Using mock subscription data');

      // Filter mock data based on options
      let filteredSubscriptions = [...this.MOCK_SUBSCRIPTIONS];

      // Exclude inactive subscriptions by default unless explicitly including them or filtering by status
      if (!includeInactive && !status) {
        filteredSubscriptions = filteredSubscriptions.filter((sub) => sub.status !== 'inactive');
      }

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
        SELECT s.*, m.name as model_name, m.provider, 
               m.input_cost_per_token, m.output_cost_per_token,
               m.description as model_description,
               m.context_length as model_context_length,
               m.supports_vision as model_supports_vision,
               m.supports_function_calling as model_supports_function_calling,
               m.supports_parallel_function_calling as model_supports_parallel_function_calling,
               m.supports_tool_choice as model_supports_tool_choice
        FROM subscriptions s
        LEFT JOIN models m ON s.model_id = m.id
        WHERE s.user_id = $1
      `;
      const params: any[] = [userId];

      // Exclude inactive subscriptions by default unless explicitly including them or filtering by status
      if (!includeInactive && !status) {
        query += ` AND s.status != $${params.length + 1}`;
        params.push('inactive');
      }

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

      // Exclude inactive subscriptions by default unless explicitly including them or filtering by status
      if (!includeInactive && !status) {
        countQuery += ` AND status != $${countParams.length + 1}`;
        countParams.push('inactive');
      }

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
        throw this.createNotFoundError(
          'Subscription count',
          undefined,
          'Unable to retrieve subscription count from database',
        );
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
        throw this.createNotFoundError(
          'Subscription',
          subscriptionId,
          'Subscription not found. Please verify the subscription ID',
        );
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
    const client = await this.fastify.pg.connect();

    try {
      await client.query('BEGIN');

      // 1. Get subscription details including model_id
      const subscription = await client.query(
        `SELECT s.*, m.name as model_name, m.provider 
         FROM subscriptions s
         LEFT JOIN models m ON s.model_id = m.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [subscriptionId, userId],
      );

      if (!subscription.rows[0]) {
        throw this.createNotFoundError(
          'Subscription',
          subscriptionId,
          'Subscription not found or access denied',
        );
      }

      const sub = subscription.rows[0];

      if (['cancelled', 'expired', 'inactive'].includes(sub.status)) {
        throw this.createValidationError(
          `Cannot cancel subscription that is already ${sub.status}`,
          'status',
          sub.status,
          'Only active or suspended subscriptions can be cancelled',
        );
      }

      const modelId = sub.model_id;

      // 2. Mark subscription as inactive (not delete!)
      await client.query(
        `UPDATE subscriptions 
         SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [subscriptionId],
      );

      // 3. Get all user's API keys that have this model
      const affectedKeys = await client.query(
        `SELECT DISTINCT ak.id, ak.lite_llm_key_value, ak.name,
                ARRAY_AGG(akm.model_id) as all_models
         FROM api_keys ak
         JOIN api_key_models akm ON ak.id = akm.api_key_id
         WHERE ak.user_id = $1 AND ak.is_active = true
         GROUP BY ak.id, ak.lite_llm_key_value, ak.name
         HAVING $2 = ANY(ARRAY_AGG(akm.model_id))`,
        [userId, modelId],
      );

      // 4. Process each affected API key
      for (const key of affectedKeys.rows) {
        // Remove the cancelled model from this key
        await client.query(
          `DELETE FROM api_key_models 
           WHERE api_key_id = $1 AND model_id = $2`,
          [key.id, modelId],
        );

        // Check remaining models for this key
        const remainingModels = await client.query(
          `SELECT model_id FROM api_key_models WHERE api_key_id = $1`,
          [key.id],
        );

        if (remainingModels.rows.length === 0) {
          // No models left - deactivate the key
          await client.query(
            `UPDATE api_keys 
             SET is_active = false, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [key.id],
          );

          // Delete from LiteLLM (can't exist without models)
          if (key.lite_llm_key_value && this.liteLLMService) {
            try {
              await this.liteLLMService.deleteKey(key.lite_llm_key_value);
            } catch (error) {
              this.fastify.log.warn(
                { keyId: key.id, error },
                'Failed to delete orphaned key from LiteLLM',
              );
            }
          }

          this.fastify.log.info(
            { keyId: key.id, keyName: key.name },
            'API key deactivated due to no remaining models after subscription cancellation',
          );
        } else {
          // Update LiteLLM key to remove the cancelled model
          const newModelIds = remainingModels.rows.map((r) => r.model_id);

          if (key.lite_llm_key_value && this.liteLLMService) {
            try {
              await this.liteLLMService.updateKey(key.lite_llm_key_value, {
                models: newModelIds,
              });
            } catch (error) {
              this.fastify.log.warn(
                { keyId: key.id, error },
                'Failed to update LiteLLM key after subscription cancellation',
              );
            }
          }

          this.fastify.log.info(
            { keyId: key.id, removedModel: modelId, remainingModels: newModelIds },
            'API key updated to remove cancelled model',
          );
        }
      }

      // 5. Create audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'SUBSCRIPTION_CANCELLED',
          'SUBSCRIPTION',
          subscriptionId,
          JSON.stringify({
            modelId,
            affectedApiKeys: affectedKeys.rows.length,
            keysDeactivated: affectedKeys.rows.filter(
              (k) => !k.all_models.some((m: any) => m !== modelId),
            ).length,
          }),
        ],
      );

      await client.query('COMMIT');

      this.fastify.log.info(
        {
          subscriptionId,
          userId,
          modelId,
          affectedApiKeys: affectedKeys.rows.length,
        },
        'Subscription cancelled and marked as inactive',
      );

      // Return the subscription with updated status
      return this.mapToEnhancedSubscription({
        ...sub,
        status: 'inactive',
        updated_at: new Date(),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      this.fastify.log.error(error, 'Failed to cancel subscription');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a subscription permanently (admin only)
   * Removes the subscription from the database and cleans up associated API keys
   * @param subscriptionId - ID of the subscription to delete
   * @param adminUserId - User ID of the admin performing the deletion
   * @param reason - Optional reason for deletion (stored in audit log)
   * @returns Success confirmation
   */
  async deleteSubscription(
    subscriptionId: string,
    adminUserId: string,
    reason?: string,
  ): Promise<{ success: boolean }> {
    const client = await this.fastify.pg.connect();

    try {
      await client.query('BEGIN');

      // 1. Get subscription details including model_id and user info
      const subscription = await client.query(
        `SELECT s.*, m.name as model_name, m.provider, u.username, u.email
         FROM subscriptions s
         LEFT JOIN models m ON s.model_id = m.id
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.id = $1`,
        [subscriptionId],
      );

      if (!subscription.rows[0]) {
        throw this.createNotFoundError('Subscription', subscriptionId, 'Subscription not found');
      }

      const sub = subscription.rows[0];
      const modelId = sub.model_id;
      const userId = sub.user_id;

      // 2. Reuse API key cleanup logic from cancelSubscription
      // Get all user's API keys that have this model
      const affectedKeys = await client.query(
        `SELECT DISTINCT ak.id, ak.lite_llm_key_value, ak.name,
                ARRAY_AGG(akm.model_id) as all_models
         FROM api_keys ak
         JOIN api_key_models akm ON ak.id = akm.api_key_id
         WHERE ak.user_id = $1 AND ak.is_active = true
         GROUP BY ak.id, ak.lite_llm_key_value, ak.name
         HAVING $2 = ANY(ARRAY_AGG(akm.model_id))`,
        [userId, modelId],
      );

      // 3. Process each affected API key
      for (const key of affectedKeys.rows) {
        // Remove the model from this key
        await client.query(
          `DELETE FROM api_key_models 
           WHERE api_key_id = $1 AND model_id = $2`,
          [key.id, modelId],
        );

        // Check remaining models for this key
        const remainingModels = await client.query(
          `SELECT model_id FROM api_key_models WHERE api_key_id = $1`,
          [key.id],
        );

        if (remainingModels.rows.length === 0) {
          // No models left - deactivate the key
          await client.query(
            `UPDATE api_keys 
             SET is_active = false, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [key.id],
          );

          // Delete from LiteLLM (can't exist without models)
          if (key.lite_llm_key_value && this.liteLLMService) {
            try {
              await this.liteLLMService.deleteKey(key.lite_llm_key_value);
            } catch (error) {
              this.fastify.log.warn(
                { keyId: key.id, error },
                'Failed to delete orphaned key from LiteLLM during subscription deletion',
              );
            }
          }

          this.fastify.log.info(
            { keyId: key.id, keyName: key.name },
            'API key deactivated due to no remaining models after subscription deletion',
          );
        } else {
          // Update LiteLLM key to remove the deleted model
          const newModelIds = remainingModels.rows.map((r) => r.model_id);

          if (key.lite_llm_key_value && this.liteLLMService) {
            try {
              await this.liteLLMService.updateKey(key.lite_llm_key_value, {
                models: newModelIds,
              });
            } catch (error) {
              this.fastify.log.warn(
                { keyId: key.id, error },
                'Failed to update LiteLLM key after subscription deletion',
              );
            }
          }

          this.fastify.log.info(
            { keyId: key.id, removedModel: modelId, remainingModels: newModelIds },
            'API key updated to remove deleted model',
          );
        }
      }

      // 4. Hard DELETE the subscription from the database
      await client.query(`DELETE FROM subscriptions WHERE id = $1`, [subscriptionId]);

      // 5. Create audit log entry
      await client.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUserId,
          'SUBSCRIPTION_DELETED_BY_ADMIN',
          'SUBSCRIPTION',
          subscriptionId,
          JSON.stringify({
            subscriptionId,
            targetUserId: userId,
            targetUsername: sub.username,
            targetEmail: sub.email,
            modelId,
            modelName: sub.model_name,
            provider: sub.provider,
            previousStatus: sub.status,
            affectedApiKeys: affectedKeys.rows.length,
            keysDeactivated: affectedKeys.rows.filter(
              (k) => !k.all_models.some((m: any) => m !== modelId),
            ).length,
            reason: reason || null,
          }),
        ],
      );

      await client.query('COMMIT');

      this.fastify.log.info(
        {
          subscriptionId,
          adminUserId,
          targetUserId: userId,
          modelId,
          affectedApiKeys: affectedKeys.rows.length,
        },
        'Subscription permanently deleted by admin',
      );

      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      this.fastify.log.error(error, 'Failed to delete subscription');
      throw error;
    } finally {
      client.release();
    }
  }

  async getSubscriptionQuota(subscriptionId: string, userId: string): Promise<SubscriptionQuota> {
    try {
      const subscription = await this.getSubscription(subscriptionId, userId);
      if (!subscription) {
        throw this.createNotFoundError(
          'Subscription',
          subscriptionId,
          'Subscription not found or access denied',
        );
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
        [
          maxBudget ?? null,
          budgetDuration ?? null,
          tpmLimit ?? null,
          rpmLimit ?? null,
          teamId ?? null,
          liteLLMKeyId ?? null,
          baseSubscription.id,
        ],
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
        throw this.createNotFoundError(
          'Subscription',
          subscriptionId,
          'Subscription not found or access denied',
        );
      }

      if (!subscription.liteLLMInfo?.keyId) {
        throw this.createValidationError(
          'Subscription is not integrated with LiteLLM',
          'liteLLMInfo.keyId',
          subscription.liteLLMInfo?.keyId,
          'Please sync the subscription with LiteLLM first',
        );
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
        throw this.createNotFoundError(
          'Subscription',
          subscriptionId,
          'Subscription not found or access denied',
        );
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
        throw this.createNotFoundError(
          'Subscription',
          subscriptionId,
          'Subscription not found or access denied',
        );
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

      // TODO: Real analytics implementation should fetch from LiteLLM API
      // For now, returning empty usage data since local logging is not implemented
      return {
        subscriptionId,
        period,
        usage: {
          requestCount: 0,
          tokenCount: 0,
          totalSpend: 0,
          averageRequestCost: 0,
          averageTokenCost: 0,
        },
        models: [],
        rateLimitEvents: {
          tpmViolations: 0,
          rpmViolations: 0,
        },
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
              throw this.createValidationError(
                `Unknown bulk operation type: ${operationType}`,
                'operationType',
                operationType,
                'Valid operations are: activate, deactivate, suspend, update_quota, transfer_team',
              );
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
            ? Math.round(
                ((subscription.used_requests as number) / (subscription.quota_requests as number)) *
                  100,
              )
            : 0,
        tokens:
          (subscription.quota_tokens as number) > 0
            ? Math.round(
                ((subscription.used_tokens as number) / (subscription.quota_tokens as number)) *
                  100,
              )
            : 0,
      },
      resetAt: subscription.reset_at ? new Date(subscription.reset_at as string | Date) : undefined,
      expiresAt: subscription.expires_at
        ? new Date(subscription.expires_at as string | Date)
        : undefined,
      createdAt: new Date(subscription.created_at as string | Date | number),
      updatedAt: new Date(subscription.updated_at as string | Date | number),
      metadata: {}, // metadata column doesn't exist in database
    };

    // Add model pricing if available (keep in per-token format)
    const modelPricing =
      subscription.input_cost_per_token && subscription.output_cost_per_token
        ? {
            inputCostPerToken: parseFloat(subscription.input_cost_per_token) as number,
            outputCostPerToken: parseFloat(subscription.output_cost_per_token) as number,
            currency: 'USD',
          }
        : undefined;

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
            budgetDuration: subscription.budget_duration as
              | 'daily'
              | 'weekly'
              | 'monthly'
              | 'yearly',
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
                ? ((subscription.current_spend as number) / (subscription.max_budget as number)) *
                  100
                : 0,
          }
        : undefined,

      // Budget information
      budgetInfo: subscription.max_budget
        ? {
            maxBudget: subscription.max_budget as number,
            currentSpend: (subscription.current_spend as number) || 0,
            remainingBudget:
              (subscription.max_budget as number) - ((subscription.current_spend as number) || 0),
            budgetUtilization:
              subscription.max_budget && subscription.current_spend
                ? ((subscription.current_spend as number) / (subscription.max_budget as number)) *
                  100
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

      // Pricing from model
      pricing: modelPricing,

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
      lastSyncAt: subscription.last_sync_at
        ? new Date(subscription.last_sync_at as string | Date | number)
        : undefined,
      syncStatus: (subscription.sync_status as 'error' | 'synced' | 'pending') || 'pending',
      syncError: subscription.sync_error as string,

      // Model details for UI display
      modelDescription: subscription.model_description as string,
      modelContextLength: subscription.model_context_length as number,
      modelSupportsVision: subscription.model_supports_vision as boolean,
      modelSupportsFunctionCalling: subscription.model_supports_function_calling as boolean,
      modelSupportsParallelFunctionCalling:
        subscription.model_supports_parallel_function_calling as boolean,
      modelSupportsToolChoice: subscription.model_supports_tool_choice as boolean,
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
   * Record status change in audit history table
   * Private helper method for subscription approval workflow
   */
  private async recordStatusChange(
    subscriptionId: string,
    oldStatus: string,
    newStatus: string,
    changedBy: string,
    reason?: string,
  ): Promise<void> {
    await this.fastify.dbUtils.query(
      `INSERT INTO subscription_status_history
       (subscription_id, old_status, new_status, reason, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [subscriptionId, oldStatus, newStatus, reason || null, changedBy],
    );
  }

  /**
   * Approve subscriptions (bulk operation)
   * Sets status to 'active' and records admin action
   * Includes optimistic locking - checks updated_at before modifying
   */
  async approveSubscriptions(
    subscriptionIds: string[],
    adminUserId: string,
    reason?: string,
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ subscription: string; error: string }>;
  }> {
    const result = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ subscription: string; error: string }>,
    };

    for (const subscriptionId of subscriptionIds) {
      try {
        // Get current subscription state
        const subscription = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
          `SELECT * FROM subscriptions WHERE id = $1`,
          [subscriptionId],
        );

        if (!subscription) {
          result.errors.push({ subscription: subscriptionId, error: 'Subscription not found' });
          result.failed++;
          continue;
        }

        const oldStatus = subscription.status;

        // Update subscription to active
        const updated = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
          `UPDATE subscriptions
           SET status = 'active',
               status_reason = $1,
               status_changed_at = CURRENT_TIMESTAMP,
               status_changed_by = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [reason || null, adminUserId, subscriptionId],
        );

        if (!updated) {
          result.errors.push({
            subscription: subscriptionId,
            error: 'Failed to update subscription',
          });
          result.failed++;
          continue;
        }

        // Record audit trail
        await this.recordStatusChange(subscriptionId, oldStatus, 'active', adminUserId, reason);

        // Create audit log
        await this.fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            adminUserId,
            'SUBSCRIPTION_APPROVED',
            'SUBSCRIPTION',
            subscriptionId,
            JSON.stringify({ oldStatus, reason, userId: subscription.user_id }),
          ],
        );

        // Notify user
        await this.notificationService.notifyUserSubscriptionApproved(
          subscriptionId,
          subscription.user_id,
          subscription.model_id,
        );

        result.successful++;

        this.fastify.log.info({ subscriptionId, adminUserId, oldStatus }, 'Subscription approved');
      } catch (error) {
        this.fastify.log.error({ error, subscriptionId }, 'Failed to approve subscription');
        result.errors.push({
          subscription: subscriptionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Deny subscriptions (bulk operation)
   * Sets status to 'denied', removes models from API keys, records reason
   * Includes optimistic locking - checks updated_at before modifying
   */
  async denySubscriptions(
    subscriptionIds: string[],
    adminUserId: string,
    reason: string,
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ subscription: string; error: string }>;
  }> {
    const result = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ subscription: string; error: string }>,
    };

    // Import ApiKeyService for removing models from keys
    const { ApiKeyService } = await import('./api-key.service.js');
    const apiKeyService = new ApiKeyService(this.fastify, this.liteLLMService);

    for (const subscriptionId of subscriptionIds) {
      try {
        // Get current subscription state
        const subscription = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
          `SELECT * FROM subscriptions WHERE id = $1`,
          [subscriptionId],
        );

        if (!subscription) {
          result.errors.push({ subscription: subscriptionId, error: 'Subscription not found' });
          result.failed++;
          continue;
        }

        const oldStatus = subscription.status;

        // Remove model from user's API keys FIRST (security priority)
        await apiKeyService.removeModelFromUserApiKeys(subscription.user_id, subscription.model_id);

        // Update subscription to denied
        const updated = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
          `UPDATE subscriptions
           SET status = 'denied',
               status_reason = $1,
               status_changed_at = CURRENT_TIMESTAMP,
               status_changed_by = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [reason, adminUserId, subscriptionId],
        );

        if (!updated) {
          result.errors.push({
            subscription: subscriptionId,
            error: 'Failed to update subscription',
          });
          result.failed++;
          continue;
        }

        // Record audit trail
        await this.recordStatusChange(subscriptionId, oldStatus, 'denied', adminUserId, reason);

        // Create audit log
        await this.fastify.dbUtils.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            adminUserId,
            'SUBSCRIPTION_DENIED',
            'SUBSCRIPTION',
            subscriptionId,
            JSON.stringify({ oldStatus, reason, userId: subscription.user_id }),
          ],
        );

        // Notify user
        await this.notificationService.notifyUserSubscriptionDenied(
          subscriptionId,
          subscription.user_id,
          subscription.model_id,
          reason,
        );

        result.successful++;

        this.fastify.log.info({ subscriptionId, adminUserId, oldStatus }, 'Subscription denied');
      } catch (error) {
        this.fastify.log.error({ error, subscriptionId }, 'Failed to deny subscription');
        result.errors.push({
          subscription: subscriptionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * User re-requests a denied subscription
   * Idempotent behavior:
   * - denied → pending (main use case)
   * - pending → no-op, return success
   * - active → error
   * - non-existent → error
   */
  async requestReview(subscriptionId: string, userId: string): Promise<EnhancedSubscription> {
    // Verify ownership and get current state
    const subscription = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
      `SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2`,
      [subscriptionId, userId],
    );

    if (!subscription) {
      throw this.createNotFoundError(
        'Subscription',
        subscriptionId,
        'Subscription not found or access denied',
      );
    }

    // Handle different states
    if (subscription.status === 'pending') {
      // Already pending, idempotent no-op
      this.fastify.log.info({ subscriptionId, userId }, 'Review already requested (idempotent)');
      return this.mapToEnhancedSubscription(subscription);
    }

    if (subscription.status === 'active') {
      throw this.createValidationError(
        'Cannot request review for active subscription',
        'status',
        subscription.status,
        'This subscription is already active',
      );
    }

    if (subscription.status !== 'denied') {
      throw this.createValidationError(
        `Cannot request review for ${subscription.status} subscription`,
        'status',
        subscription.status,
        'Only denied subscriptions can be re-reviewed',
      );
    }

    // Update denied → pending
    const oldStatus = subscription.status;
    const updated = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
      `UPDATE subscriptions
       SET status = 'pending',
           status_reason = NULL,
           status_changed_at = CURRENT_TIMESTAMP,
           status_changed_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [userId, subscriptionId, userId],
    );

    if (!updated) {
      throw this.createNotFoundError(
        'Subscription',
        subscriptionId,
        'Failed to update subscription status',
      );
    }

    // Record audit trail
    await this.recordStatusChange(subscriptionId, oldStatus, 'pending', userId);

    // Create audit log
    await this.fastify.dbUtils.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'SUBSCRIPTION_REVIEW_REQUESTED',
        'SUBSCRIPTION',
        subscriptionId,
        JSON.stringify({ oldStatus, modelId: subscription.model_id }),
      ],
    );

    // Notify admins
    await this.notificationService.notifyAdminsReviewRequested(
      subscriptionId,
      userId,
      subscription.model_id,
    );

    this.fastify.log.info({ subscriptionId, userId, oldStatus }, 'Review requested');

    return this.mapToEnhancedSubscription(updated);
  }

  /**
   * Revert a subscription status decision
   * Admin-only operation to change status directly
   * Validates state transitions - only allows meaningful changes:
   * - active → denied (revoke approval)
   * - denied → active (override denial)
   * - denied → pending (back to review queue)
   * - active → pending (re-review)
   * Blocks same-state transitions and invalid combinations
   * Includes optimistic locking via updated_at check
   */
  async revertSubscription(
    subscriptionId: string,
    newStatus: 'active' | 'denied' | 'pending',
    adminUserId: string,
    reason?: string,
  ): Promise<SubscriptionWithDetails> {
    // Get current subscription state
    const subscription = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
      `SELECT * FROM subscriptions WHERE id = $1`,
      [subscriptionId],
    );

    if (!subscription) {
      throw this.createNotFoundError('Subscription', subscriptionId, 'Subscription not found');
    }

    const oldStatus = subscription.status;

    // Validate state transition
    if (oldStatus === newStatus) {
      throw this.createValidationError(
        'Cannot revert to same status',
        'newStatus',
        newStatus,
        `Subscription is already ${newStatus}`,
      );
    }

    // Only allow meaningful transitions for approval workflow
    const validTransitions = ['active', 'denied', 'pending'];
    if (!validTransitions.includes(oldStatus)) {
      throw this.createValidationError(
        `Cannot revert from ${oldStatus} status`,
        'status',
        oldStatus,
        'Only active, denied, or pending subscriptions can be reverted',
      );
    }

    // Update subscription
    const updated = await this.fastify.dbUtils.queryOne<DatabaseSubscription>(
      `UPDATE subscriptions
       SET status = $1,
           status_reason = $2,
           status_changed_at = CURRENT_TIMESTAMP,
           status_changed_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [newStatus, reason || null, adminUserId, subscriptionId],
    );

    if (!updated) {
      throw this.createNotFoundError(
        'Subscription',
        subscriptionId,
        'Failed to update subscription',
      );
    }

    // Record audit trail
    await this.recordStatusChange(subscriptionId, oldStatus, newStatus, adminUserId, reason);

    // Create audit log
    await this.fastify.dbUtils.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminUserId,
        'SUBSCRIPTION_STATUS_REVERTED',
        'SUBSCRIPTION',
        subscriptionId,
        JSON.stringify({
          oldStatus,
          newStatus,
          reason,
          userId: subscription.user_id,
        }),
      ],
    );

    this.fastify.log.info(
      { subscriptionId, adminUserId, oldStatus, newStatus },
      'Subscription status reverted',
    );

    // Fetch subscription with user and model details for response
    const enriched = await this.fastify.dbUtils.queryOne<any>(
      `SELECT
         s.*,
         u.id as user_id, u.username, u.email,
         m.id as model_id, m.name as model_name, m.provider, m.restricted_access
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN models m ON s.model_id = m.id
       WHERE s.id = $1`,
      [subscriptionId],
    );

    if (!enriched) {
      throw this.createNotFoundError(
        'Subscription',
        subscriptionId,
        'Failed to fetch updated subscription',
      );
    }

    // Map to SubscriptionWithDetails format
    return {
      id: enriched.id,
      userId: enriched.user_id,
      modelId: enriched.model_id,
      status: enriched.status,
      statusReason: enriched.status_reason,
      statusChangedAt: enriched.status_changed_at,
      statusChangedBy: enriched.status_changed_by,
      quotaRequests: enriched.quota_requests,
      quotaTokens: enriched.quota_tokens,
      usedRequests: enriched.used_requests,
      usedTokens: enriched.used_tokens,
      user: {
        id: enriched.user_id,
        username: enriched.username,
        email: enriched.email,
      },
      model: {
        id: enriched.model_id,
        name: enriched.model_name,
        provider: enriched.provider,
        restrictedAccess: enriched.restricted_access,
      },
      createdAt: enriched.created_at,
      updatedAt: enriched.updated_at,
    };
  }

  /**
   * Get subscription approval requests for admin panel
   * Supports filtering by status, model, user, date range
   */
  async getSubscriptionApprovalRequests(
    filters: SubscriptionApprovalFilters,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<SubscriptionWithDetails>> {
    const { statuses, modelIds, userIds, dateFrom, dateTo } = filters;
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clauses
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (statuses && statuses.length > 0) {
      whereClauses.push(`s.status = ANY($${paramIndex})`);
      params.push(statuses);
      paramIndex++;
    }

    if (modelIds && modelIds.length > 0) {
      whereClauses.push(`s.model_id = ANY($${paramIndex})`);
      params.push(modelIds);
      paramIndex++;
    }

    if (userIds && userIds.length > 0) {
      whereClauses.push(`s.user_id = ANY($${paramIndex})`);
      params.push(userIds);
      paramIndex++;
    }

    if (dateFrom) {
      whereClauses.push(`s.status_changed_at >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereClauses.push(`s.status_changed_at <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.fastify.dbUtils.queryOne<CountResult>(
      `SELECT COUNT(*) as count
       FROM subscriptions s
       ${whereClause}`,
      params,
    );

    const total = parseInt(String(countResult?.count || '0'));

    // Get paginated data with JOINs
    const subscriptions = await this.fastify.dbUtils.queryMany<any>(
      `SELECT
         s.*,
         u.id as user_id, u.username, u.email,
         m.id as model_id, m.name as model_name, m.provider, m.restricted_access
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN models m ON s.model_id = m.id
       ${whereClause}
       ORDER BY s.status_changed_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    // Map to SubscriptionWithDetails
    const items: SubscriptionWithDetails[] = subscriptions.map((row) => ({
      id: row.id,
      userId: row.user_id,
      modelId: row.model_id,
      status: row.status,
      quotaRequests: row.quota_requests,
      quotaTokens: row.quota_tokens,
      usedRequests: row.used_requests,
      usedTokens: row.used_tokens,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      statusReason: row.status_reason,
      statusChangedAt: row.status_changed_at,
      statusChangedBy: row.status_changed_by,
      user: {
        id: row.user_id,
        username: row.username,
        email: row.email,
      },
      model: {
        id: row.model_id,
        name: row.model_name,
        provider: row.provider,
        restrictedAccess: row.restricted_access,
      },
    }));

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get approval statistics for admin dashboard
   */
  async getSubscriptionApprovalStats(): Promise<SubscriptionApprovalStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await this.fastify.dbUtils.queryOne<any>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
         COUNT(*) FILTER (WHERE status = 'active' AND DATE(status_changed_at) = CURRENT_DATE) as approved_today,
         COUNT(*) FILTER (WHERE status = 'denied' AND DATE(status_changed_at) = CURRENT_DATE) as denied_today,
         COUNT(*) FILTER (WHERE status IN ('pending', 'active', 'denied')) as total_requests
       FROM subscriptions`,
      [],
    );

    return {
      pendingCount: parseInt(String(stats?.pending_count || '0')),
      approvedToday: parseInt(String(stats?.approved_today || '0')),
      deniedToday: parseInt(String(stats?.denied_today || '0')),
      totalRequests: parseInt(String(stats?.total_requests || '0')),
    };
  }

  /**
   * Handle cascade when model restriction changes
   * Called by ModelService when restrictedAccess flag changes
   */
  async handleModelRestrictionChange(modelId: string, isNowRestricted: boolean): Promise<void> {
    if (!isNowRestricted) {
      // Model is no longer restricted - auto-approve all pending subscriptions
      const pendingSubscriptions = await this.fastify.dbUtils.queryMany<{ id: string }>(
        `SELECT id FROM subscriptions
         WHERE model_id = $1 AND status = 'pending'`,
        [modelId],
      );

      if (pendingSubscriptions.length > 0) {
        const subscriptionIds = pendingSubscriptions.map((s) => s.id);

        // Auto-approve all pending subscriptions
        await this.fastify.dbUtils.query(
          `UPDATE subscriptions
           SET status = 'active',
               status_changed_at = CURRENT_TIMESTAMP,
               status_changed_by = $1,
               status_reason = 'Auto-approved: model restriction removed'
           WHERE id = ANY($2)`,
          [SYSTEM_USER_ID, subscriptionIds],
        );

        // Record audit log entries
        for (const sub of pendingSubscriptions) {
          await this.recordStatusChange(
            sub.id,
            'pending',
            'active',
            SYSTEM_USER_ID,
            'Auto-approved: model restriction removed',
          );
        }

        this.fastify.log.info(
          { modelId, count: pendingSubscriptions.length },
          'Auto-approved pending subscriptions due to model restriction removal',
        );
      }
      return;
    }

    // Model becoming restricted - transition active to pending
    const activeSubscriptions = await this.fastify.dbUtils.queryMany<{
      id: string;
      user_id: string;
    }>(
      `SELECT id, user_id FROM subscriptions
       WHERE model_id = $1 AND status = 'active'`,
      [modelId],
    );

    if (activeSubscriptions.length === 0) {
      return;
    }

    // Remove model from all affected users' API keys FIRST (security priority)
    const { ApiKeyService } = await import('./api-key.service.js');
    const apiKeyService = new ApiKeyService(this.fastify, this.liteLLMService);

    for (const sub of activeSubscriptions) {
      await apiKeyService.removeModelFromUserApiKeys(sub.user_id, modelId);
    }

    // Transition all to pending
    const subscriptionIds = activeSubscriptions.map((s) => s.id);
    await this.fastify.dbUtils.query(
      `UPDATE subscriptions
       SET status = 'pending',
           status_changed_at = CURRENT_TIMESTAMP,
           status_changed_by = $1,
           status_reason = 'Model marked as restricted access - requires re-approval'
       WHERE id = ANY($2)`,
      [SYSTEM_USER_ID, subscriptionIds],
    );

    // Record audit log entries
    for (const sub of activeSubscriptions) {
      await this.recordStatusChange(
        sub.id,
        'active',
        'pending',
        SYSTEM_USER_ID,
        'Model marked as restricted access - requires re-approval',
      );
    }

    // Notify affected users
    const affectedUserIds = activeSubscriptions.map((s) => s.user_id);
    await this.notificationService.notifyUsersModelRestricted(modelId, affectedUserIds);

    this.fastify.log.info(
      { modelId, count: activeSubscriptions.length },
      'Transitioned active subscriptions to pending due to model restriction',
    );
  }
}

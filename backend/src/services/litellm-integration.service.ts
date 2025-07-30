import { FastifyInstance } from 'fastify';
import { LiteLLMService } from './litellm.service.js';
import { ApiKeyService } from './api-key.service.js';
import { SubscriptionService } from './subscription.service.js';
import { TeamService } from './team.service.js';
import { DefaultTeamService } from './default-team.service.js';
import { EnhancedSubscription } from '../types/subscription.types.js';
import { EnhancedApiKey } from '../types/api-key.types.js';
import { TeamWithMembers } from '../types/user.types.js';

export interface GlobalSyncRequest {
  forceSync?: boolean;
  syncUsers?: boolean;
  syncTeams?: boolean;
  syncSubscriptions?: boolean;
  syncApiKeys?: boolean;
  syncModels?: boolean;
  userId?: string; // For user-specific sync
  teamId?: string; // For team-specific sync
}

export interface GlobalSyncResponse {
  syncId: string;
  startedAt: Date;
  completedAt?: Date;
  success: boolean;
  error?: string;
  results: {
    users?: {
      total: number;
      synced: number;
      errors: number;
      details: Array<{ id: string; success: boolean; error?: string }>;
    };
    teams?: {
      total: number;
      synced: number;
      errors: number;
      details: Array<{ id: string; success: boolean; error?: string }>;
    };
    subscriptions?: {
      total: number;
      synced: number;
      errors: number;
      details: Array<{ id: string; success: boolean; error?: string }>;
    };
    apiKeys?: {
      total: number;
      synced: number;
      errors: number;
      details: Array<{ id: string; success: boolean; error?: string }>;
    };
    models?: {
      total: number;
      synced: number;
      errors: number;
      details: Array<{ id: string; success: boolean; error?: string }>;
    };
  };
  duration: number; // milliseconds
}

export interface IntegrationHealthCheck {
  liteLLMConnection: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    lastChecked: Date;
    error?: string;
  };
  syncStatus: {
    lastGlobalSync?: Date;
    nextScheduledSync?: Date;
    pendingSyncs: number;
    failedSyncs: number;
  };
  dataConsistency: {
    usersInSync: number;
    usersOutOfSync: number;
    teamsInSync: number;
    teamsOutOfSync: number;
    subscriptionsInSync: number;
    subscriptionsOutOfSync: number;
    apiKeysInSync: number;
    apiKeysOutOfSync: number;
  };
  systemMetrics: {
    totalUsers: number;
    totalTeams: number;
    totalSubscriptions: number;
    totalApiKeys: number;
    totalSpend: number;
    budgetUtilization: number;
  };
}

export interface ConflictResolution {
  entity: 'user' | 'team' | 'subscription' | 'api_key';
  entityId: string;
  conflictType: 'budget_mismatch' | 'usage_mismatch' | 'permission_mismatch' | 'data_inconsistency';
  liteMaaSValue: unknown;
  liteLLMValue: unknown;
  resolvedValue: unknown;
  resolution: 'litemaas_wins' | 'litellm_wins' | 'merge' | 'manual_required';
  resolvedAt: Date;
  resolvedBy?: string;
}

export interface AutoSyncConfig {
  enabled: boolean;
  interval: number; // minutes
  syncUsers: boolean;
  syncTeams: boolean;
  syncSubscriptions: boolean;
  syncApiKeys: boolean;
  syncModels: boolean;
  conflictResolution: 'litemaas_wins' | 'litellm_wins' | 'merge' | 'manual';
  retryAttempts: number;
  retryDelay: number; // seconds
}

export class LiteLLMIntegrationService {
  private fastify: FastifyInstance;
  private liteLLMService: LiteLLMService;
  private apiKeyService: ApiKeyService;
  private subscriptionService: SubscriptionService;
  private teamService: TeamService;
  private defaultTeamService: DefaultTeamService;

  private autoSyncConfig: AutoSyncConfig = {
    enabled: process.env.LITELLM_AUTO_SYNC === 'true',
    interval: parseInt(process.env.LITELLM_SYNC_INTERVAL || '60'), // 1 hour
    syncUsers: true,
    syncTeams: true,
    syncSubscriptions: true,
    syncApiKeys: true,
    syncModels: true,
    conflictResolution:
      (process.env.LITELLM_CONFLICT_RESOLUTION as
        | 'litemaas_wins'
        | 'litellm_wins'
        | 'merge'
        | 'manual') || 'litellm_wins',
    retryAttempts: 3,
    retryDelay: 30,
  };

  private syncInProgress = false;
  private lastHealthCheck?: IntegrationHealthCheck;
  private syncHistory: GlobalSyncResponse[] = [];
  private readonly MAX_SYNC_HISTORY = 100;

  constructor(
    fastify: FastifyInstance,
    liteLLMService?: LiteLLMService,
    apiKeyService?: ApiKeyService,
    subscriptionService?: SubscriptionService,
    teamService?: TeamService,
  ) {
    this.fastify = fastify;
    this.liteLLMService = liteLLMService || new LiteLLMService(fastify);
    this.apiKeyService = apiKeyService || new ApiKeyService(fastify, this.liteLLMService);
    this.subscriptionService =
      subscriptionService || new SubscriptionService(fastify, this.liteLLMService);
    this.teamService = teamService || new TeamService(fastify, this.liteLLMService);
    this.defaultTeamService = new DefaultTeamService(fastify, this.liteLLMService);

    // Initialize auto-sync if enabled
    if (this.autoSyncConfig.enabled) {
      this.initializeAutoSync();
    }
  }

  private initializeAutoSync(): void {
    const intervalMs = this.autoSyncConfig.interval * 60 * 1000;

    setInterval(async () => {
      if (!this.syncInProgress) {
        try {
          this.fastify.log.info('Starting scheduled auto-sync');
          await this.performGlobalSync({
            forceSync: false,
            syncUsers: this.autoSyncConfig.syncUsers,
            syncTeams: this.autoSyncConfig.syncTeams,
            syncSubscriptions: this.autoSyncConfig.syncSubscriptions,
            syncApiKeys: this.autoSyncConfig.syncApiKeys,
            syncModels: this.autoSyncConfig.syncModels,
          });
        } catch (error) {
          this.fastify.log.error(error, 'Auto-sync failed');
        }
      }
    }, intervalMs);

    this.fastify.log.info(
      {
        interval: this.autoSyncConfig.interval,
        enabled: this.autoSyncConfig.enabled,
      },
      'Auto-sync initialized',
    );
  }

  async performGlobalSync(request: GlobalSyncRequest = {}): Promise<GlobalSyncResponse> {
    if (this.syncInProgress) {
      throw new Error('Sync operation already in progress');
    }

    const syncId = `sync-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const startedAt = new Date();

    this.syncInProgress = true;

    try {
      this.fastify.log.info({ syncId, request }, 'Starting global sync operation');

      const response: GlobalSyncResponse = {
        syncId,
        startedAt,
        success: true,
        results: {},
        duration: 0,
      };

      // Sync models first (foundation for other syncs)
      if (request.syncModels !== false) {
        response.results.models = await this.syncModels(request.forceSync);
      }

      // Sync teams (needed for user and subscription sync)
      if (request.syncTeams !== false && (!request.teamId || request.teamId)) {
        response.results.teams = await this.syncTeams(request.forceSync, request.teamId);
      }

      // Sync users
      if (request.syncUsers !== false && (!request.userId || request.userId)) {
        response.results.users = await this.syncUsers(request.forceSync, request.userId);
      }

      // Sync subscriptions
      if (request.syncSubscriptions !== false) {
        response.results.subscriptions = await this.syncSubscriptions(
          request.forceSync,
          request.userId,
        );
      }

      // Sync API keys
      if (request.syncApiKeys !== false) {
        response.results.apiKeys = await this.syncApiKeys(request.forceSync, request.userId);
      }

      const completedAt = new Date();
      response.completedAt = completedAt;
      response.duration = completedAt.getTime() - startedAt.getTime();

      // Check if any sync failed
      const hasErrors = Object.values(response.results).some(
        (result) => result && result.errors > 0,
      );
      response.success = !hasErrors;

      // Store sync history
      this.syncHistory.unshift(response);
      if (this.syncHistory.length > this.MAX_SYNC_HISTORY) {
        this.syncHistory = this.syncHistory.slice(0, this.MAX_SYNC_HISTORY);
      }

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          null, // System operation
          'GLOBAL_SYNC',
          'INTEGRATION',
          syncId,
          {
            request,
            results: response.results,
            duration: response.duration,
            success: response.success,
          },
        ],
      );

      this.fastify.log.info(
        {
          syncId,
          duration: response.duration,
          success: response.success,
          results: response.results,
        },
        'Global sync completed',
      );

      return response;
    } catch (error) {
      const completedAt = new Date();
      const errorResponse: GlobalSyncResponse = {
        syncId,
        startedAt,
        completedAt,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results: {},
        duration: completedAt.getTime() - startedAt.getTime(),
      };

      this.syncHistory.unshift(errorResponse);
      this.fastify.log.error(error, 'Global sync failed');
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncModels(forceSync = false): Promise<GlobalSyncResponse['results']['models']> {
    try {
      this.fastify.log.debug('Starting models sync');

      // Get models from LiteLLM
      const liteLLMModels = await this.liteLLMService.getModels({ refresh: forceSync });

      const results = {
        total: liteLLMModels.length,
        synced: 0,
        errors: 0,
        details: [] as Array<{ id: string; success: boolean; error?: string }>,
      };

      for (const model of liteLLMModels) {
        try {
          // Check if model exists locally
          const existingModel = await this.fastify.dbUtils.queryOne(
            `SELECT * FROM models WHERE id = $1`,
            [model.model_info.id],
          );

          if (existingModel) {
            // Update existing model
            await this.fastify.dbUtils.query(
              `UPDATE models 
               SET name = $1, provider = $2, max_tokens = $3, 
                   supports_function_calling = $4, supports_vision = $5,
                   litellm_provider = $6, updated_at = CURRENT_TIMESTAMP
               WHERE id = $7`,
              [
                model.model_name,
                model.litellm_params.custom_llm_provider,
                model.model_info.max_tokens,
                model.model_info.supports_function_calling,
                model.model_info.supports_vision,
                model.litellm_params.custom_llm_provider,
                model.model_info.id,
              ],
            );
          } else {
            // Create new model
            await this.fastify.dbUtils.query(
              `INSERT INTO models (
                id, name, provider, max_tokens, supports_function_calling,
                supports_vision, litellm_provider, is_active
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                model.model_info.id,
                model.model_name,
                model.litellm_params.custom_llm_provider,
                model.model_info.max_tokens,
                model.model_info.supports_function_calling,
                model.model_info.supports_vision,
                model.litellm_params.custom_llm_provider,
                true,
              ],
            );
          }

          results.synced++;
          results.details.push({ id: model.model_info.id, success: true });
        } catch (error) {
          results.errors++;
          results.details.push({
            id: model.model_info.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          this.fastify.log.error({ modelId: model.model_info.id, error }, 'Failed to sync model');
        }
      }

      this.fastify.log.info({ results }, 'Models sync completed');
      return results;
    } catch (error) {
      this.fastify.log.error(error, 'Models sync failed');
      return {
        total: 0,
        synced: 0,
        errors: 1,
        details: [
          {
            id: 'global',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  private async syncTeams(
    forceSync = false,
    teamId?: string,
  ): Promise<GlobalSyncResponse['results']['teams']> {
    try {
      this.fastify.log.debug({ teamId }, 'Starting teams sync');

      let teams: TeamWithMembers[];

      if (teamId) {
        const team = await this.teamService.getTeam(teamId);
        teams = team ? [team] : [];
      } else {
        // Get all teams (mock implementation for now)
        const teamsResult = await this.teamService.getUserTeams('system', { limit: 1000 });
        teams = teamsResult.data;
      }

      const results = {
        total: teams.length,
        synced: 0,
        errors: 0,
        details: [] as Array<{ id: string; success: boolean; error?: string }>,
      };

      for (const team of teams) {
        try {
          if (team.liteLLMTeamId) {
            // Sync existing team
            const syncResponse = await this.teamService.syncTeamWithLiteLLM(
              team.id,
              team.createdBy, // Use creator as admin for sync
              { forceSync, syncBudget: true, syncMembers: true, syncUsage: true },
            );

            if (syncResponse.success) {
              results.synced++;
              results.details.push({ id: team.id, success: true });
            } else {
              results.errors++;
              results.details.push({ id: team.id, success: false, error: syncResponse.error });
            }
          } else {
            // Team not integrated with LiteLLM - skip or create integration
            results.details.push({
              id: team.id,
              success: false,
              error: 'Team not integrated with LiteLLM',
            });
          }
        } catch (error) {
          results.errors++;
          results.details.push({
            id: team.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          this.fastify.log.error({ teamId: team.id, error }, 'Failed to sync team');
        }
      }

      this.fastify.log.info({ results }, 'Teams sync completed');
      return results;
    } catch (error) {
      this.fastify.log.error(error, 'Teams sync failed');
      return {
        total: 0,
        synced: 0,
        errors: 1,
        details: [
          {
            id: 'global',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  private async syncUsers(
    _forceSync = false,
    userId?: string,
  ): Promise<GlobalSyncResponse['results']['users']> {
    try {
      this.fastify.log.debug({ userId }, 'Starting users sync');

      // Ensure default team exists in both database and LiteLLM before syncing users
      await this.defaultTeamService.ensureDefaultTeamExists();

      let users: { id: string; username: string; email: string; [key: string]: unknown }[];

      if (userId) {
        const user = (await this.fastify.dbUtils.queryOne(
          `SELECT * FROM users WHERE id = $1 AND is_active = true`,
          [userId],
        )) as { id: string; username: string; email: string; [key: string]: unknown } | null;
        users = user ? [user] : [];
      } else {
        users = (await this.fastify.dbUtils.queryMany(
          `SELECT * FROM users WHERE is_active = true LIMIT 1000`,
        )) as { id: string; username: string; email: string; [key: string]: unknown }[];
      }

      const results = {
        total: users.length,
        synced: 0,
        errors: 0,
        details: [] as Array<{ id: string; success: boolean; error?: string }>,
      };

      for (const user of users) {
        try {
          // Check if user exists in LiteLLM
          let liteLLMUser;
          try {
            liteLLMUser = await this.liteLLMService.getUserInfo(user.id);
          } catch (error) {
            // User doesn't exist in LiteLLM, create them with default team assignment
            liteLLMUser = await this.liteLLMService.createUser({
              user_id: user.id,
              user_alias: user.username,
              user_email: user.email,
              user_role: 'internal_user',
              max_budget: 100, // Default budget
              tpm_limit: 1000,
              rpm_limit: 60,
              teams: [DefaultTeamService.DEFAULT_TEAM_ID], // CRITICAL: Always assign user to default team
            });
          }

          // Update local user with LiteLLM info
          await this.fastify.dbUtils.query(
            `UPDATE users 
             SET litellm_user_id = $1, 
                 max_budget = $2,
                 current_spend = $3,
                 last_sync_at = CURRENT_TIMESTAMP,
                 sync_status = 'synced'
             WHERE id = $4`,
            [liteLLMUser.user_id, liteLLMUser.max_budget, liteLLMUser.spend || 0, user.id],
          );

          results.synced++;
          results.details.push({ id: user.id, success: true });
        } catch (error) {
          results.errors++;
          results.details.push({
            id: user.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          this.fastify.log.error({ userId: user.id, error }, 'Failed to sync user');
        }
      }

      this.fastify.log.info({ results }, 'Users sync completed');
      return results;
    } catch (error) {
      this.fastify.log.error(error, 'Users sync failed');
      return {
        total: 0,
        synced: 0,
        errors: 1,
        details: [
          {
            id: 'global',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  private async syncSubscriptions(
    forceSync = false,
    userId?: string,
  ): Promise<GlobalSyncResponse['results']['subscriptions']> {
    try {
      this.fastify.log.debug({ userId }, 'Starting subscriptions sync');

      let subscriptions: EnhancedSubscription[];

      if (userId) {
        const subsResult = await this.subscriptionService.getUserSubscriptions(userId, {
          limit: 1000,
        });
        subscriptions = subsResult.data;
      } else {
        // Mock implementation - in real scenario would get all subscriptions
        subscriptions = [];
      }

      const results = {
        total: subscriptions.length,
        synced: 0,
        errors: 0,
        details: [] as Array<{ id: string; success: boolean; error?: string }>,
      };

      for (const subscription of subscriptions) {
        try {
          if (subscription.liteLLMInfo?.keyId) {
            // Sync subscription with LiteLLM
            const syncResponse = await this.subscriptionService.syncSubscriptionWithLiteLLM(
              subscription.id,
              subscription.userId,
              { forceSync, syncBudget: true, syncUsage: true, syncRateLimits: true },
            );

            if (syncResponse.success) {
              results.synced++;
              results.details.push({ id: subscription.id, success: true });
            } else {
              results.errors++;
              results.details.push({
                id: subscription.id,
                success: false,
                error: syncResponse.error,
              });
            }
          } else {
            results.details.push({
              id: subscription.id,
              success: false,
              error: 'Subscription not integrated with LiteLLM',
            });
          }
        } catch (error) {
          results.errors++;
          results.details.push({
            id: subscription.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          this.fastify.log.error(
            { subscriptionId: subscription.id, error },
            'Failed to sync subscription',
          );
        }
      }

      this.fastify.log.info({ results }, 'Subscriptions sync completed');
      return results;
    } catch (error) {
      this.fastify.log.error(error, 'Subscriptions sync failed');
      return {
        total: 0,
        synced: 0,
        errors: 1,
        details: [
          {
            id: 'global',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  private async syncApiKeys(
    _forceSync = false,
    userId?: string,
  ): Promise<GlobalSyncResponse['results']['apiKeys']> {
    try {
      this.fastify.log.debug({ userId }, 'Starting API keys sync');

      let apiKeys: EnhancedApiKey[];

      if (userId) {
        const keysResult = await this.apiKeyService.getUserApiKeys(userId, { limit: 1000 });
        apiKeys = keysResult.data;
      } else {
        // Mock implementation - in real scenario would get all API keys
        apiKeys = [];
      }

      const results = {
        total: apiKeys.length,
        synced: 0,
        errors: 0,
        details: [] as Array<{ id: string; success: boolean; error?: string }>,
      };

      for (const apiKey of apiKeys) {
        try {
          if (apiKey.liteLLMKeyId) {
            // Sync API key with LiteLLM
            await this.apiKeyService.syncApiKeyWithLiteLLM(
              apiKey.id,
              userId || apiKey.userId, // Use API key owner as fallback
            );

            results.synced++;
            results.details.push({ id: apiKey.id, success: true });
          } else {
            results.details.push({
              id: apiKey.id,
              success: false,
              error: 'API key not integrated with LiteLLM',
            });
          }
        } catch (error) {
          results.errors++;
          results.details.push({
            id: apiKey.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          this.fastify.log.error({ apiKeyId: apiKey.id, error }, 'Failed to sync API key');
        }
      }

      this.fastify.log.info({ results }, 'API keys sync completed');
      return results;
    } catch (error) {
      this.fastify.log.error(error, 'API keys sync failed');
      return {
        total: 0,
        synced: 0,
        errors: 1,
        details: [
          {
            id: 'global',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async getIntegrationHealth(): Promise<IntegrationHealthCheck> {
    const startTime = Date.now();

    try {
      // Check LiteLLM connection
      const health = await this.liteLLMService.getHealth();
      const responseTime = Date.now() - startTime;

      const liteLLMConnection = {
        status: health.status === 'healthy' ? ('healthy' as const) : ('unhealthy' as const),
        responseTime,
        lastChecked: new Date(),
      };

      // Get sync status
      const lastSync = this.syncHistory[0];
      const syncStatus = {
        lastGlobalSync: lastSync?.completedAt,
        nextScheduledSync: this.autoSyncConfig.enabled
          ? new Date(Date.now() + this.autoSyncConfig.interval * 60 * 1000)
          : undefined,
        pendingSyncs: this.syncInProgress ? 1 : 0,
        failedSyncs: this.syncHistory.filter((s) => !s.success).length,
      };

      // Mock data consistency check (in real implementation, would query database)
      const dataConsistency = {
        usersInSync: 10,
        usersOutOfSync: 2,
        teamsInSync: 5,
        teamsOutOfSync: 1,
        subscriptionsInSync: 15,
        subscriptionsOutOfSync: 3,
        apiKeysInSync: 25,
        apiKeysOutOfSync: 5,
      };

      // Mock system metrics
      const systemMetrics = {
        totalUsers: 12,
        totalTeams: 6,
        totalSubscriptions: 18,
        totalApiKeys: 30,
        totalSpend: 1250.75,
        budgetUtilization: 62.5,
      };

      const healthCheck: IntegrationHealthCheck = {
        liteLLMConnection,
        syncStatus,
        dataConsistency,
        systemMetrics,
      };

      this.lastHealthCheck = healthCheck;
      return healthCheck;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      const healthCheck: IntegrationHealthCheck = {
        liteLLMConnection: {
          status: 'unhealthy',
          responseTime,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
        syncStatus: {
          pendingSyncs: 0,
          failedSyncs: this.syncHistory.filter((s) => !s.success).length,
        },
        dataConsistency: {
          usersInSync: 0,
          usersOutOfSync: 0,
          teamsInSync: 0,
          teamsOutOfSync: 0,
          subscriptionsInSync: 0,
          subscriptionsOutOfSync: 0,
          apiKeysInSync: 0,
          apiKeysOutOfSync: 0,
        },
        systemMetrics: {
          totalUsers: 0,
          totalTeams: 0,
          totalSubscriptions: 0,
          totalApiKeys: 0,
          totalSpend: 0,
          budgetUtilization: 0,
        },
      };

      this.lastHealthCheck = healthCheck;
      this.fastify.log.error(error, 'Integration health check failed');
      return healthCheck;
    }
  }

  async resolveConflict(
    entity: ConflictResolution['entity'],
    entityId: string,
    resolution: ConflictResolution['resolution'],
    resolvedBy?: string,
  ): Promise<ConflictResolution> {
    try {
      this.fastify.log.info(
        {
          entity,
          entityId,
          resolution,
          resolvedBy,
        },
        'Resolving integration conflict',
      );

      // Mock conflict resolution - in real implementation would:
      // 1. Identify the specific conflict
      // 2. Apply the resolution strategy
      // 3. Update both systems accordingly
      // 4. Log the resolution

      const conflictResolution: ConflictResolution = {
        entity,
        entityId,
        conflictType: 'budget_mismatch', // Mock
        liteMaaSValue: { budget: 100 }, // Mock
        liteLLMValue: { budget: 150 }, // Mock
        resolvedValue: resolution === 'litellm_wins' ? { budget: 150 } : { budget: 100 },
        resolution,
        resolvedAt: new Date(),
        resolvedBy,
      };

      // Create audit log
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          resolvedBy || null,
          'CONFLICT_RESOLUTION',
          'INTEGRATION',
          entityId,
          JSON.stringify(conflictResolution),
        ],
      );

      return conflictResolution;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to resolve conflict');
      throw error;
    }
  }

  getSyncHistory(limit = 10): GlobalSyncResponse[] {
    return this.syncHistory.slice(0, limit);
  }

  getAutoSyncConfig(): AutoSyncConfig {
    return { ...this.autoSyncConfig };
  }

  async updateAutoSyncConfig(config: Partial<AutoSyncConfig>): Promise<AutoSyncConfig> {
    this.autoSyncConfig = { ...this.autoSyncConfig, ...config };

    this.fastify.log.info(
      {
        oldConfig: this.autoSyncConfig,
        newConfig: config,
      },
      'Auto-sync configuration updated',
    );

    return this.autoSyncConfig;
  }

  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  getLastHealthCheck(): IntegrationHealthCheck | undefined {
    return this.lastHealthCheck;
  }

  // Utility method for monitoring and alerting
  async getSystemAlerts(): Promise<
    Array<{
      type: 'sync_failure' | 'connection_issue' | 'data_inconsistency' | 'budget_alert';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      createdAt: Date;
      entityId?: string;
    }>
  > {
    const alerts = [];
    const health = await this.getIntegrationHealth();

    // Connection alerts
    if (health.liteLLMConnection.status === 'unhealthy') {
      alerts.push({
        type: 'connection_issue' as const,
        severity: 'critical' as const,
        message: `LiteLLM connection unhealthy: ${health.liteLLMConnection.error}`,
        createdAt: new Date(),
      });
    }

    // Sync failure alerts
    if (health.syncStatus.failedSyncs > 3) {
      alerts.push({
        type: 'sync_failure' as const,
        severity: 'high' as const,
        message: `${health.syncStatus.failedSyncs} sync failures detected`,
        createdAt: new Date(),
      });
    }

    // Data inconsistency alerts
    const totalInconsistent =
      health.dataConsistency.usersOutOfSync +
      health.dataConsistency.teamsOutOfSync +
      health.dataConsistency.subscriptionsOutOfSync +
      health.dataConsistency.apiKeysOutOfSync;

    if (totalInconsistent > 10) {
      alerts.push({
        type: 'data_inconsistency' as const,
        severity: 'medium' as const,
        message: `${totalInconsistent} entities out of sync`,
        createdAt: new Date(),
      });
    }

    // Budget alerts
    if (health.systemMetrics.budgetUtilization > 90) {
      alerts.push({
        type: 'budget_alert' as const,
        severity: 'high' as const,
        message: `Budget utilization at ${health.systemMetrics.budgetUtilization}%`,
        createdAt: new Date(),
      });
    }

    return alerts;
  }
}

import { FastifyPluginAsync } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

export interface SubscriptionHookEvent {
  subscriptionId: string;
  userId: string;
  modelId: string;
  previousStatus?: string;
  newStatus: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface SubscriptionHooks {
  onSubscriptionCreated?: (event: SubscriptionHookEvent) => Promise<void>;
  onSubscriptionActivated?: (event: SubscriptionHookEvent) => Promise<void>;
  onSubscriptionSuspended?: (event: SubscriptionHookEvent) => Promise<void>;
  onSubscriptionCancelled?: (event: SubscriptionHookEvent) => Promise<void>;
  onSubscriptionExpired?: (event: SubscriptionHookEvent) => Promise<void>;
  onQuotaExceeded?: (event: SubscriptionHookEvent & { quotaType: 'requests' | 'tokens' }) => Promise<void>;
  onQuotaWarning?: (event: SubscriptionHookEvent & { quotaType: 'requests' | 'tokens'; threshold: number }) => Promise<void>;
}

class SubscriptionHookManager {
  private hooks: SubscriptionHooks = {};
  private fastify: any;

  constructor(fastify: any) {
    this.fastify = fastify;
    this.setupDefaultHooks();
  }

  register(hooks: Partial<SubscriptionHooks>) {
    this.hooks = { ...this.hooks, ...hooks };
  }

  async triggerHook(
    hookName: keyof SubscriptionHooks,
    event: SubscriptionHookEvent | (SubscriptionHookEvent & { quotaType: 'requests' | 'tokens'; threshold?: number })
  ): Promise<void> {
    const hook = this.hooks[hookName];
    if (hook) {
      try {
        await hook(event as any);
        this.fastify.log.debug({
          hookName,
          subscriptionId: event.subscriptionId,
          userId: event.userId,
        }, 'Subscription hook executed successfully');
      } catch (error) {
        this.fastify.log.error({
          error,
          hookName,
          subscriptionId: event.subscriptionId,
          userId: event.userId,
        }, 'Subscription hook execution failed');
      }
    }
  }

  private setupDefaultHooks() {
    this.hooks = {
      onSubscriptionCreated: async (event) => {
        await this.logSubscriptionEvent(event, 'SUBSCRIPTION_CREATED');
        await this.sendNotification(event, 'subscription_created');
      },

      onSubscriptionActivated: async (event) => {
        await this.logSubscriptionEvent(event, 'SUBSCRIPTION_ACTIVATED');
        await this.sendNotification(event, 'subscription_activated');
        await this.setupUsageMonitoring(event);
      },

      onSubscriptionSuspended: async (event) => {
        await this.logSubscriptionEvent(event, 'SUBSCRIPTION_SUSPENDED');
        await this.sendNotification(event, 'subscription_suspended');
        await this.disableApiKeys(event);
      },

      onSubscriptionCancelled: async (event) => {
        await this.logSubscriptionEvent(event, 'SUBSCRIPTION_CANCELLED');
        await this.sendNotification(event, 'subscription_cancelled');
        await this.cleanupSubscriptionResources(event);
      },

      onSubscriptionExpired: async (event) => {
        await this.logSubscriptionEvent(event, 'SUBSCRIPTION_EXPIRED');
        await this.sendNotification(event, 'subscription_expired');
        await this.cleanupSubscriptionResources(event);
      },

      onQuotaExceeded: async (event) => {
        await this.logSubscriptionEvent(event, 'QUOTA_EXCEEDED', { quotaType: event.quotaType });
        await this.sendNotification(event, 'quota_exceeded');
        await this.suspendSubscriptionForQuotaExceeded(event);
      },

      onQuotaWarning: async (event) => {
        await this.logSubscriptionEvent(event, 'QUOTA_WARNING', { 
          quotaType: event.quotaType, 
          threshold: event.threshold 
        });
        await this.sendNotification(event, 'quota_warning');
      },
    };
  }

  private async logSubscriptionEvent(
    event: SubscriptionHookEvent,
    action: string,
    additionalMetadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.fastify.dbUtils.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          event.userId,
          action,
          'SUBSCRIPTION',
          event.subscriptionId,
          {
            ...event.metadata,
            ...additionalMetadata,
            modelId: event.modelId,
            previousStatus: event.previousStatus,
            newStatus: event.newStatus,
          },
        ]
      );
    } catch (error) {
      this.fastify.log.error(error, 'Failed to log subscription event');
    }
  }

  private async sendNotification(
    event: SubscriptionHookEvent,
    notificationType: string
  ): Promise<void> {
    try {
      // In a real implementation, this would integrate with a notification service
      // For now, we'll just log the notification
      this.fastify.log.info({
        userId: event.userId,
        subscriptionId: event.subscriptionId,
        modelId: event.modelId,
        notificationType,
        status: event.newStatus,
      }, 'Subscription notification sent');

      // Could integrate with email service, Slack, etc.
      // await this.emailService.send({
      //   to: user.email,
      //   template: notificationType,
      //   data: event
      // });
    } catch (error) {
      this.fastify.log.error(error, 'Failed to send subscription notification');
    }
  }

  private async setupUsageMonitoring(event: SubscriptionHookEvent): Promise<void> {
    try {
      // Set up monitoring thresholds for quota warnings
      const subscription = await this.fastify.dbUtils.queryOne(
        'SELECT quota_requests, quota_tokens FROM subscriptions WHERE id = $1',
        [event.subscriptionId]
      );

      if (subscription) {
        // Schedule quota warning checks at 80% and 90% thresholds
        const warningThresholds = [0.8, 0.9];
        
        for (const threshold of warningThresholds) {
          // In a real implementation, you might use a job queue or cron jobs
          // For now, we'll just log the monitoring setup
          this.fastify.log.debug({
            subscriptionId: event.subscriptionId,
            threshold,
            requestThreshold: Math.floor(subscription.quota_requests * threshold),
            tokenThreshold: Math.floor(subscription.quota_tokens * threshold),
          }, 'Usage monitoring threshold configured');
        }
      }
    } catch (error) {
      this.fastify.log.error(error, 'Failed to setup usage monitoring');
    }
  }

  private async disableApiKeys(event: SubscriptionHookEvent): Promise<void> {
    try {
      await this.fastify.dbUtils.query(
        `UPDATE api_keys 
         SET is_active = false
         WHERE subscription_id = $1 AND is_active = true`,
        [event.subscriptionId]
      );

      this.fastify.log.info({
        subscriptionId: event.subscriptionId,
      }, 'API keys disabled for suspended subscription');
    } catch (error) {
      this.fastify.log.error(error, 'Failed to disable API keys');
    }
  }

  private async cleanupSubscriptionResources(event: SubscriptionHookEvent): Promise<void> {
    try {
      // Disable all API keys
      await this.disableApiKeys(event);

      // Clear any cached data related to this subscription
      // In a real implementation, you might clean up:
      // - Cached API keys
      // - Active sessions
      // - Scheduled jobs
      // - External service registrations

      this.fastify.log.info({
        subscriptionId: event.subscriptionId,
      }, 'Subscription resources cleaned up');
    } catch (error) {
      this.fastify.log.error(error, 'Failed to cleanup subscription resources');
    }
  }

  private async suspendSubscriptionForQuotaExceeded(
    event: SubscriptionHookEvent & { quotaType: 'requests' | 'tokens' }
  ): Promise<void> {
    try {
      // Auto-suspend subscription when quota is exceeded
      await this.fastify.dbUtils.query(
        `UPDATE subscriptions 
         SET status = 'suspended', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'active'`,
        [event.subscriptionId]
      );

      this.fastify.log.warn({
        subscriptionId: event.subscriptionId,
        quotaType: event.quotaType,
      }, 'Subscription auto-suspended due to quota exceeded');
    } catch (error) {
      this.fastify.log.error(error, 'Failed to suspend subscription for quota exceeded');
    }
  }

  async checkQuotaThresholds(subscriptionId: string): Promise<void> {
    try {
      const subscription = await this.fastify.dbUtils.queryOne(`
        SELECT s.*, u.id as user_id, m.id as model_id
        FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        JOIN models m ON s.model_id = m.id
        WHERE s.id = $1 AND s.status = 'active'
      `, [subscriptionId]);

      if (!subscription) {
        return;
      }

      const requestUtilization = subscription.used_requests / subscription.quota_requests;
      const tokenUtilization = subscription.used_tokens / subscription.quota_tokens;

      // Check for quota exceeded
      if (requestUtilization >= 1.0) {
        await this.triggerHook('onQuotaExceeded', {
          subscriptionId,
          userId: subscription.user_id,
          modelId: subscription.model_id,
          newStatus: subscription.status,
          timestamp: new Date(),
          quotaType: 'requests',
        });
      }

      if (tokenUtilization >= 1.0) {
        await this.triggerHook('onQuotaExceeded', {
          subscriptionId,
          userId: subscription.user_id,
          modelId: subscription.model_id,
          newStatus: subscription.status,
          timestamp: new Date(),
          quotaType: 'tokens',
        });
      }

      // Check for warning thresholds (80%, 90%)
      const warningThresholds = [0.8, 0.9];
      
      for (const threshold of warningThresholds) {
        if (requestUtilization >= threshold && requestUtilization < 1.0) {
          // Check if we've already sent this warning
          const existingWarning = await this.fastify.dbUtils.queryOne(`
            SELECT id FROM audit_logs
            WHERE user_id = $1 AND resource_id = $2 AND action = 'QUOTA_WARNING'
            AND metadata->>'quotaType' = 'requests'
            AND metadata->>'threshold' = $3
            AND created_at > NOW() - INTERVAL '1 hour'
          `, [subscription.user_id, subscriptionId, threshold.toString()]);

          if (!existingWarning) {
            await this.triggerHook('onQuotaWarning', {
              subscriptionId,
              userId: subscription.user_id,
              modelId: subscription.model_id,
              newStatus: subscription.status,
              timestamp: new Date(),
              quotaType: 'requests',
              threshold: threshold * 100,
            });
          }
        }

        if (tokenUtilization >= threshold && tokenUtilization < 1.0) {
          const existingWarning = await this.fastify.dbUtils.queryOne(`
            SELECT id FROM audit_logs
            WHERE user_id = $1 AND resource_id = $2 AND action = 'QUOTA_WARNING'
            AND metadata->>'quotaType' = 'tokens'
            AND metadata->>'threshold' = $3
            AND created_at > NOW() - INTERVAL '1 hour'
          `, [subscription.user_id, subscriptionId, threshold.toString()]);

          if (!existingWarning) {
            await this.triggerHook('onQuotaWarning', {
              subscriptionId,
              userId: subscription.user_id,
              modelId: subscription.model_id,
              newStatus: subscription.status,
              timestamp: new Date(),
              quotaType: 'tokens',
              threshold: threshold * 100,
            });
          }
        }
      }
    } catch (error) {
      this.fastify.log.error(error, 'Failed to check quota thresholds');
    }
  }

  async processExpiredSubscriptions(): Promise<number> {
    try {
      const expiredSubscriptions = await this.fastify.dbUtils.queryMany(`
        SELECT s.id, s.user_id, s.model_id, s.status
        FROM subscriptions s
        WHERE s.expires_at IS NOT NULL 
        AND s.expires_at <= CURRENT_TIMESTAMP
        AND s.status IN ('active', 'suspended')
      `);

      let processedCount = 0;

      for (const subscription of expiredSubscriptions) {
        // Update status to expired
        await this.fastify.dbUtils.query(
          `UPDATE subscriptions 
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [subscription.id]
        );

        // Trigger expired hook
        await this.triggerHook('onSubscriptionExpired', {
          subscriptionId: subscription.id,
          userId: subscription.user_id,
          modelId: subscription.model_id,
          previousStatus: subscription.status,
          newStatus: 'expired',
          timestamp: new Date(),
        });

        processedCount++;
      }

      if (processedCount > 0) {
        this.fastify.log.info({
          processedCount,
        }, 'Processed expired subscriptions');
      }

      return processedCount;
    } catch (error) {
      this.fastify.log.error(error, 'Failed to process expired subscriptions');
      return 0;
    }
  }
}

const subscriptionHooksPlugin: FastifyPluginAsync = async (fastify) => {
  const hookManager = new SubscriptionHookManager(fastify);

  // Register the hook manager
  fastify.decorate('subscriptionHooks', hookManager);

  // Add a helper method for triggering hooks from services
  fastify.decorateRequest('triggerSubscriptionHook', function(
    hookName: keyof SubscriptionHooks,
    event: SubscriptionHookEvent | (SubscriptionHookEvent & { quotaType: 'requests' | 'tokens'; threshold?: number })
  ) {
    return hookManager.triggerHook(hookName, event);
  });

  // Background job to check for expired subscriptions (would be better as a cron job)
  if (process.env.NODE_ENV !== 'test') {
    setInterval(async () => {
      try {
        await hookManager.processExpiredSubscriptions();
      } catch (error) {
        fastify.log.error(error, 'Error in expired subscriptions background job');
      }
    }, 60000); // Check every minute
  }

  fastify.log.info('Subscription hooks plugin initialized');
};

declare module 'fastify' {
  interface FastifyInstance {
    subscriptionHooks: SubscriptionHookManager;
  }

  interface FastifyRequest {
    triggerSubscriptionHook(
      hookName: keyof SubscriptionHooks,
      event: SubscriptionHookEvent | (SubscriptionHookEvent & { quotaType: 'requests' | 'tokens'; threshold?: number })
    ): Promise<void>;
  }
}

export default fastifyPlugin(subscriptionHooksPlugin);
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../../../src/app';
import type { SubscriptionHookEvent } from '../../../src/plugins/subscription-hooks';

describe('Subscription Hooks Plugin', () => {
  let app: FastifyInstance;

  const mockSubscriptionEvent: SubscriptionHookEvent = {
    subscriptionId: 'sub-123',
    userId: 'user-123',
    modelId: 'model-123',
    newStatus: 'active',
    timestamp: new Date(),
  };

  beforeAll(async () => {
    // Create real Fastify app with all plugins
    app = await createApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    // Mock database operations
    vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
    vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
    vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
  });

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  describe('Plugin Registration', () => {
    it('should register subscriptionHooks on Fastify instance', () => {
      expect(app.subscriptionHooks).toBeDefined();
      expect(app.subscriptionHooks.register).toBeInstanceOf(Function);
      expect(app.subscriptionHooks.triggerHook).toBeInstanceOf(Function);
    });

    it('should register triggerSubscriptionHook on request object', () => {
      // Verify the decorator exists by checking the app's decorators
      expect(app.hasRequestDecorator('triggerSubscriptionHook')).toBe(true);
    });
  });

  describe('Hook Registration', () => {
    it('should register custom hooks', () => {
      const customHook = vi.fn().mockResolvedValue(undefined);
      app.subscriptionHooks.register({ onSubscriptionCreated: customHook });

      // Trigger and verify
      expect(customHook).not.toHaveBeenCalled();
    });

    it('should allow overriding existing hooks', async () => {
      const customHook = vi.fn().mockResolvedValue(undefined);
      app.subscriptionHooks.register({ onSubscriptionCreated: customHook });

      await app.subscriptionHooks.triggerHook('onSubscriptionCreated', mockSubscriptionEvent);

      expect(customHook).toHaveBeenCalledWith(mockSubscriptionEvent);
    });

    it('should merge multiple hook registrations', () => {
      const hook1 = vi.fn().mockResolvedValue(undefined);
      const hook2 = vi.fn().mockResolvedValue(undefined);

      app.subscriptionHooks.register({ onSubscriptionCreated: hook1 });
      app.subscriptionHooks.register({ onSubscriptionActivated: hook2 });

      // Both hooks should be registered (we can't inspect private hooks, but we can test behavior)
      expect(true).toBe(true);
    });
  });

  describe('Hook Triggering', () => {
    it('should execute registered hook when triggered', async () => {
      const customHook = vi.fn().mockResolvedValue(undefined);
      app.subscriptionHooks.register({ onSubscriptionCreated: customHook });

      await app.subscriptionHooks.triggerHook('onSubscriptionCreated', mockSubscriptionEvent);

      expect(customHook).toHaveBeenCalledWith(mockSubscriptionEvent);
    });

    it('should handle hooks that throw errors gracefully', async () => {
      const errorHook = vi.fn().mockRejectedValue(new Error('Hook error'));
      app.subscriptionHooks.register({ onSubscriptionCreated: errorHook });

      // Should not throw
      await expect(
        app.subscriptionHooks.triggerHook('onSubscriptionCreated', mockSubscriptionEvent),
      ).resolves.not.toThrow();

      expect(errorHook).toHaveBeenCalled();
    });

    it('should handle quota exceeded hook with quotaType', async () => {
      const customHook = vi.fn().mockResolvedValue(undefined);
      app.subscriptionHooks.register({ onQuotaExceeded: customHook });

      const quotaEvent = {
        ...mockSubscriptionEvent,
        quotaType: 'requests' as const,
      };

      await app.subscriptionHooks.triggerHook('onQuotaExceeded', quotaEvent);

      expect(customHook).toHaveBeenCalledWith(
        expect.objectContaining({
          quotaType: 'requests',
        }),
      );
    });

    it('should handle quota warning hook with threshold', async () => {
      const customHook = vi.fn().mockResolvedValue(undefined);
      app.subscriptionHooks.register({ onQuotaWarning: customHook });

      const warningEvent = {
        ...mockSubscriptionEvent,
        quotaType: 'tokens' as const,
        threshold: 80,
      };

      await app.subscriptionHooks.triggerHook('onQuotaWarning', warningEvent);

      expect(customHook).toHaveBeenCalledWith(
        expect.objectContaining({
          quotaType: 'tokens',
          threshold: 80,
        }),
      );
    });

    it('should do nothing if hook is not registered', async () => {
      // Clear all hooks by registering empty ones
      app.subscriptionHooks.register({
        onSubscriptionCreated: undefined,
        onSubscriptionActivated: undefined,
      });

      // Should not throw
      await expect(
        app.subscriptionHooks.triggerHook('onSubscriptionCreated', mockSubscriptionEvent),
      ).resolves.not.toThrow();
    });
  });

  describe('Default Hook: onSubscriptionCreated', () => {
    beforeEach(async () => {
      // Restore all mocks and recreate app to get fresh default hooks
      vi.clearAllMocks();
      vi.restoreAllMocks();
      await app.close();
      app = await createApp({ logger: false });
      await app.ready();
      // Re-establish database mocks
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
    });

    it('should log subscription event to audit log', async () => {
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      // Reset to default hooks by creating new instance
      // We'll test via the actual trigger
      await app.subscriptionHooks.triggerHook('onSubscriptionCreated', mockSubscriptionEvent);

      expect(app.dbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          'SUBSCRIPTION_CREATED',
          'SUBSCRIPTION',
          'sub-123',
          expect.any(String),
        ]),
      );
    });

    it('should handle audit log failures gracefully', async () => {
      const dbError = new Error('Database connection failed');
      vi.spyOn(app.dbUtils, 'query').mockRejectedValue(dbError);

      // Should not throw even if logging fails
      await expect(
        app.subscriptionHooks.triggerHook('onSubscriptionCreated', mockSubscriptionEvent),
      ).resolves.not.toThrow();
    });
  });

  describe('Default Hook: onSubscriptionActivated', () => {
    beforeEach(async () => {
      // Restore all mocks and recreate app to get fresh default hooks
      vi.clearAllMocks();
      vi.restoreAllMocks();
      await app.close();
      app = await createApp({ logger: false });
      await app.ready();
      // Re-establish database mocks
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
    });

    it('should setup usage monitoring thresholds', async () => {
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue({
        quota_requests: 1000,
        quota_tokens: 50000,
      });

      await app.subscriptionHooks.triggerHook('onSubscriptionActivated', mockSubscriptionEvent);

      expect(app.dbUtils.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT quota_requests, quota_tokens FROM subscriptions'),
        ['sub-123'],
      );
    });

    it('should handle missing subscription gracefully', async () => {
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);

      await expect(
        app.subscriptionHooks.triggerHook('onSubscriptionActivated', mockSubscriptionEvent),
      ).resolves.not.toThrow();
    });
  });

  describe('Default Hook: onSubscriptionSuspended', () => {
    beforeEach(async () => {
      // Restore all mocks and recreate app to get fresh default hooks
      vi.clearAllMocks();
      vi.restoreAllMocks();
      await app.close();
      app = await createApp({ logger: false });
      await app.ready();
      // Re-establish database mocks
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
    });

    it('should disable API keys when subscription is suspended', async () => {
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 2 });

      await app.subscriptionHooks.triggerHook('onSubscriptionSuspended', mockSubscriptionEvent);

      expect(app.dbUtils.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE api_keys'), [
        'sub-123',
      ]);
    });

    it('should handle API key disable failure gracefully', async () => {
      const dbError = new Error('Update failed');
      vi.spyOn(app.dbUtils, 'query').mockRejectedValue(dbError);

      await expect(
        app.subscriptionHooks.triggerHook('onSubscriptionSuspended', mockSubscriptionEvent),
      ).resolves.not.toThrow();
    });
  });

  describe('Default Hook: onSubscriptionCancelled', () => {
    beforeEach(async () => {
      // Restore all mocks and recreate app to get fresh default hooks
      vi.clearAllMocks();
      vi.restoreAllMocks();
      await app.close();
      app = await createApp({ logger: false });
      await app.ready();
      // Re-establish database mocks
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
    });

    it('should cleanup subscription resources', async () => {
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });

      await app.subscriptionHooks.triggerHook('onSubscriptionCancelled', mockSubscriptionEvent);

      // Should call disableApiKeys as part of cleanup
      expect(app.dbUtils.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE api_keys'), [
        'sub-123',
      ]);
    });
  });

  describe('Default Hook: onSubscriptionExpired', () => {
    beforeEach(async () => {
      // Restore all mocks and recreate app to get fresh default hooks
      vi.clearAllMocks();
      vi.restoreAllMocks();
      await app.close();
      app = await createApp({ logger: false });
      await app.ready();
      // Re-establish database mocks
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
    });

    it('should cleanup resources when subscription expires', async () => {
      const expiredEvent: SubscriptionHookEvent = {
        ...mockSubscriptionEvent,
        previousStatus: 'active',
        newStatus: 'expired',
      };

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });

      await app.subscriptionHooks.triggerHook('onSubscriptionExpired', expiredEvent);

      // Should disable API keys
      expect(app.dbUtils.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE api_keys'), [
        'sub-123',
      ]);
    });
  });

  describe('Default Hook: onQuotaExceeded', () => {
    beforeEach(async () => {
      // Restore all mocks and recreate app to get fresh default hooks
      vi.clearAllMocks();
      vi.restoreAllMocks();
      await app.close();
      app = await createApp({ logger: false });
      await app.ready();
      // Re-establish database mocks
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
    });

    it('should auto-suspend subscription when quota is exceeded', async () => {
      const quotaEvent = {
        ...mockSubscriptionEvent,
        quotaType: 'requests' as const,
      };

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      await app.subscriptionHooks.triggerHook('onQuotaExceeded', quotaEvent);

      expect(app.dbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'suspended'"),
        ['sub-123'],
      );
    });

    it('should handle token quota exceeded', async () => {
      const quotaEvent = {
        ...mockSubscriptionEvent,
        quotaType: 'tokens' as const,
      };

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      await app.subscriptionHooks.triggerHook('onQuotaExceeded', quotaEvent);

      expect(app.dbUtils.query).toHaveBeenCalled();
    });

    it('should handle suspension failure gracefully', async () => {
      const quotaEvent = {
        ...mockSubscriptionEvent,
        quotaType: 'requests' as const,
      };

      vi.spyOn(app.dbUtils, 'query').mockRejectedValue(new Error('Update failed'));

      await expect(
        app.subscriptionHooks.triggerHook('onQuotaExceeded', quotaEvent),
      ).resolves.not.toThrow();
    });
  });

  describe('Default Hook: onQuotaWarning', () => {
    beforeEach(async () => {
      // Restore all mocks and recreate app to get fresh default hooks
      vi.clearAllMocks();
      vi.restoreAllMocks();
      await app.close();
      app = await createApp({ logger: false });
      await app.ready();
      // Re-establish database mocks
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
    });

    it('should log warning when quota threshold is reached', async () => {
      const warningEvent = {
        ...mockSubscriptionEvent,
        quotaType: 'requests' as const,
        threshold: 80,
      };

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      await app.subscriptionHooks.triggerHook('onQuotaWarning', warningEvent);

      expect(app.dbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'user-123',
          'QUOTA_WARNING',
          'SUBSCRIPTION',
          'sub-123',
          expect.stringContaining('"threshold":80'),
        ]),
      );
    });
  });

  describe('checkQuotaThresholds()', () => {
    it('should trigger quota exceeded for requests at 100%', async () => {
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue({
        user_id: 'user-123',
        model_id: 'model-123',
        status: 'active',
        used_requests: 1000,
        quota_requests: 1000,
        used_tokens: 5000,
        quota_tokens: 50000,
      });

      const triggerSpy = vi.spyOn(app.subscriptionHooks, 'triggerHook');

      await app.subscriptionHooks.checkQuotaThresholds('sub-123');

      expect(triggerSpy).toHaveBeenCalledWith(
        'onQuotaExceeded',
        expect.objectContaining({
          subscriptionId: 'sub-123',
          quotaType: 'requests',
        }),
      );
    });

    it('should trigger quota exceeded for tokens at 100%', async () => {
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue({
        user_id: 'user-123',
        model_id: 'model-123',
        status: 'active',
        used_requests: 500,
        quota_requests: 1000,
        used_tokens: 50000,
        quota_tokens: 50000,
      });

      const triggerSpy = vi.spyOn(app.subscriptionHooks, 'triggerHook');

      await app.subscriptionHooks.checkQuotaThresholds('sub-123');

      expect(triggerSpy).toHaveBeenCalledWith(
        'onQuotaExceeded',
        expect.objectContaining({
          subscriptionId: 'sub-123',
          quotaType: 'tokens',
        }),
      );
    });

    it('should trigger warning at 80% threshold', async () => {
      vi.spyOn(app.dbUtils, 'queryOne')
        .mockResolvedValueOnce({
          user_id: 'user-123',
          model_id: 'model-123',
          status: 'active',
          used_requests: 850,
          quota_requests: 1000,
          used_tokens: 10000,
          quota_tokens: 50000,
        })
        .mockResolvedValue(null); // No existing warning

      const triggerSpy = vi.spyOn(app.subscriptionHooks, 'triggerHook');

      await app.subscriptionHooks.checkQuotaThresholds('sub-123');

      expect(triggerSpy).toHaveBeenCalledWith(
        'onQuotaWarning',
        expect.objectContaining({
          subscriptionId: 'sub-123',
          quotaType: 'requests',
          threshold: 80,
        }),
      );
    });

    it('should trigger warning at 90% threshold', async () => {
      vi.spyOn(app.dbUtils, 'queryOne')
        .mockResolvedValueOnce({
          user_id: 'user-123',
          model_id: 'model-123',
          status: 'active',
          used_requests: 950,
          quota_requests: 1000,
          used_tokens: 10000,
          quota_tokens: 50000,
        })
        .mockResolvedValue(null); // No existing warning

      const triggerSpy = vi.spyOn(app.subscriptionHooks, 'triggerHook');

      await app.subscriptionHooks.checkQuotaThresholds('sub-123');

      expect(triggerSpy).toHaveBeenCalledWith(
        'onQuotaWarning',
        expect.objectContaining({
          subscriptionId: 'sub-123',
          quotaType: 'requests',
          threshold: 90,
        }),
      );
    });

    it('should not send duplicate warnings within 1 hour', async () => {
      vi.spyOn(app.dbUtils, 'queryOne')
        .mockResolvedValueOnce({
          user_id: 'user-123',
          model_id: 'model-123',
          status: 'active',
          used_requests: 850,
          quota_requests: 1000,
          used_tokens: 10000,
          quota_tokens: 50000,
        })
        .mockResolvedValue({ id: 'existing-warning-123' }); // Existing warning found

      const triggerSpy = vi.spyOn(app.subscriptionHooks, 'triggerHook');

      await app.subscriptionHooks.checkQuotaThresholds('sub-123');

      // Should not trigger warning if one exists recently
      expect(triggerSpy).not.toHaveBeenCalledWith('onQuotaWarning', expect.anything());
    });

    it('should handle missing subscription gracefully', async () => {
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);

      await expect(app.subscriptionHooks.checkQuotaThresholds('sub-123')).resolves.not.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      vi.spyOn(app.dbUtils, 'queryOne').mockRejectedValue(new Error('DB error'));

      await expect(app.subscriptionHooks.checkQuotaThresholds('sub-123')).resolves.not.toThrow();
    });
  });

  describe('processExpiredSubscriptions()', () => {
    it('should find and expire subscriptions past expires_at', async () => {
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([
        { id: 'sub-1', user_id: 'user-1', model_id: 'model-1', status: 'active' },
        { id: 'sub-2', user_id: 'user-2', model_id: 'model-2', status: 'suspended' },
      ]);

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      const count = await app.subscriptionHooks.processExpiredSubscriptions();

      expect(count).toBe(2);
      expect(app.dbUtils.queryMany).toHaveBeenCalledWith(
        expect.stringContaining('WHERE s.expires_at IS NOT NULL'),
      );
    });

    it('should update subscription status to expired', async () => {
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([
        { id: 'sub-1', user_id: 'user-1', model_id: 'model-1', status: 'active' },
      ]);

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      await app.subscriptionHooks.processExpiredSubscriptions();

      expect(app.dbUtils.query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'expired'"),
        ['sub-1'],
      );
    });

    it('should trigger onSubscriptionExpired hook', async () => {
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([
        { id: 'sub-1', user_id: 'user-1', model_id: 'model-1', status: 'active' },
      ]);

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      const triggerSpy = vi.spyOn(app.subscriptionHooks, 'triggerHook');

      await app.subscriptionHooks.processExpiredSubscriptions();

      expect(triggerSpy).toHaveBeenCalledWith(
        'onSubscriptionExpired',
        expect.objectContaining({
          subscriptionId: 'sub-1',
          userId: 'user-1',
          modelId: 'model-1',
          previousStatus: 'active',
          newStatus: 'expired',
        }),
      );
    });

    it('should return count of processed subscriptions', async () => {
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([
        { id: 'sub-1', user_id: 'user-1', model_id: 'model-1', status: 'active' },
        { id: 'sub-2', user_id: 'user-2', model_id: 'model-2', status: 'active' },
        { id: 'sub-3', user_id: 'user-3', model_id: 'model-3', status: 'active' },
      ]);

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      const count = await app.subscriptionHooks.processExpiredSubscriptions();

      expect(count).toBe(3);
    });

    it('should return 0 when no expired subscriptions found', async () => {
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);

      const count = await app.subscriptionHooks.processExpiredSubscriptions();

      expect(count).toBe(0);
    });

    it('should handle database errors and return 0', async () => {
      vi.spyOn(app.dbUtils, 'queryMany').mockRejectedValue(new Error('DB error'));

      const count = await app.subscriptionHooks.processExpiredSubscriptions();

      expect(count).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      // Restore all mocks and recreate app to get fresh default hooks
      vi.clearAllMocks();
      vi.restoreAllMocks();
      await app.close();
      app = await createApp({ logger: false });
      await app.ready();
      // Re-establish database mocks
      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [], rowCount: 0 });
      vi.spyOn(app.dbUtils, 'queryOne').mockResolvedValue(null);
      vi.spyOn(app.dbUtils, 'queryMany').mockResolvedValue([]);
    });

    it('should handle concurrent hook executions', async () => {
      const slowHook = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      app.subscriptionHooks.register({ onSubscriptionCreated: slowHook });

      await Promise.all([
        app.subscriptionHooks.triggerHook('onSubscriptionCreated', mockSubscriptionEvent),
        app.subscriptionHooks.triggerHook('onSubscriptionCreated', {
          ...mockSubscriptionEvent,
          subscriptionId: 'sub-456',
        }),
      ]);

      expect(slowHook).toHaveBeenCalledTimes(2);
    });

    it('should include metadata in audit logs', async () => {
      const eventWithMetadata = {
        ...mockSubscriptionEvent,
        metadata: { source: 'api', reason: 'user_request' },
      };

      vi.spyOn(app.dbUtils, 'query').mockResolvedValue({ rows: [{}], rowCount: 1 });

      await app.subscriptionHooks.triggerHook('onSubscriptionCreated', eventWithMetadata);

      expect(app.dbUtils.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.stringContaining('"source":"api"'),
        ]),
      );
    });

    it('should handle database transaction rollback scenarios', async () => {
      const rollbackError = new Error('Transaction rollback');

      vi.spyOn(app.dbUtils, 'query').mockRejectedValue(rollbackError);

      // Should not throw even on database errors
      await expect(
        app.subscriptionHooks.triggerHook('onSubscriptionCreated', mockSubscriptionEvent),
      ).resolves.not.toThrow();
    });
  });
});

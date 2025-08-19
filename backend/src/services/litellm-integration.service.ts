import { ModelSyncService } from './model-sync.service';
import type { FastifyInstance } from 'fastify';

export class LiteLLMIntegrationService {
  private syncInterval: NodeJS.Timeout | null = null;
  private modelSyncService: ModelSyncService;
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    // Reuse the existing ModelSyncService for consistency
    this.modelSyncService = new ModelSyncService(fastify);
  }

  /**
   * Start automatic model synchronization
   */
  startAutoSync(): void {
    // Get interval from environment (in minutes)
    const intervalMinutes = parseInt(process.env.LITELLM_SYNC_INTERVAL || '60', 10);
    const intervalMs = intervalMinutes * 60 * 1000;

    this.fastify.log.info(`Starting auto-sync with interval: ${intervalMinutes} minutes`);

    // Run initial sync immediately
    this.runSync();

    // Set up periodic sync
    this.syncInterval = setInterval(() => {
      this.runSync();
    }, intervalMs);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.fastify.log.info('Auto-sync stopped');
    }
  }

  /**
   * Run a single sync operation
   */
  private async runSync(): Promise<void> {
    try {
      this.fastify.log.info('Starting automatic model sync');

      // Delegate to ModelSyncService for actual sync
      const result = await this.modelSyncService.syncModels({
        forceUpdate: false,
        markUnavailable: true,
      });

      // Log results
      if (result.success) {
        this.fastify.log.info({
          msg: 'Automatic model sync completed successfully',
          totalModels: result.totalModels,
          newModels: result.newModels,
          updatedModels: result.updatedModels,
          unavailableModels: result.unavailableModels,
        });
      } else {
        this.fastify.log.warn({
          msg: 'Automatic model sync completed with errors',
          errors: result.errors,
        });
      }
    } catch (error) {
      this.fastify.log.error({ error }, 'Automatic model sync failed');
      // Don't throw - let the next interval retry
    }
  }
}

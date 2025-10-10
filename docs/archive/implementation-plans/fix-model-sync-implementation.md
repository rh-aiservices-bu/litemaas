# Fix Model Sync Implementation Plan

## Overview

This document provides detailed implementation steps to fix the model synchronization functionality in LiteMaaS. The sync is currently broken because the auto-sync service is never initialized and there are multiple conflicting implementations.

## Current Issues

1. `LiteLLMIntegrationService` exists but is never instantiated or started
2. Environment variables for auto-sync are missing
3. Three different sync implementations exist, causing confusion

## Implementation Steps

### Step 1: Add Environment Variables

**File**: `backend/.env`

Add these lines to enable auto-sync:

```env
# Model Synchronization
LITELLM_AUTO_SYNC=true
LITELLM_SYNC_INTERVAL=60
```

**File**: `backend/.env.example`

Add the same lines with comments:

```env
# Model Synchronization Configuration
LITELLM_AUTO_SYNC=true              # Enable automatic model synchronization
LITELLM_SYNC_INTERVAL=60            # Sync interval in minutes
```

### Step 2: Initialize Auto-Sync Service in Database Plugin

**File**: `backend/src/plugins/database.ts`

Add the following imports at the top:

```typescript
import { LiteLLMIntegrationService } from '../services/litellm-integration.service';
```

In the database plugin function, after the existing `ModelSyncService` initialization (around line 85), add:

```typescript
// Initialize LiteLLM integration service for auto-sync
const litellmIntegrationService = new LiteLLMIntegrationService(fastify.db, fastify.log);

// Start auto-sync if enabled
const autoSyncEnabled = process.env.LITELLM_AUTO_SYNC === 'true';
if (autoSyncEnabled) {
  fastify.log.info('Starting automatic model synchronization service');
  litellmIntegrationService.startAutoSync();

  // Register cleanup on server shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Stopping automatic model synchronization service');
    litellmIntegrationService.stopAutoSync();
  });
}
```

### Step 3: Fix LiteLLMIntegrationService to Use ModelSyncService

**File**: `backend/src/services/litellm-integration.service.ts`

Replace the entire class with this unified implementation:

```typescript
import { BaseService } from './base.service';
import { ModelSyncService } from './model-sync.service';
import type { PostgresDb } from '../types/database.types';
import type { FastifyBaseLogger } from 'fastify';

export class LiteLLMIntegrationService extends BaseService {
  private syncInterval: NodeJS.Timeout | null = null;
  private modelSyncService: ModelSyncService;

  constructor(db: PostgresDb, logger: FastifyBaseLogger) {
    super(db, logger);
    // Reuse the existing ModelSyncService for consistency
    this.modelSyncService = new ModelSyncService(db, logger);
  }

  /**
   * Start automatic model synchronization
   */
  startAutoSync(): void {
    // Get interval from environment (in minutes)
    const intervalMinutes = parseInt(process.env.LITELLM_SYNC_INTERVAL || '60', 10);
    const intervalMs = intervalMinutes * 60 * 1000;

    this.logger.info(`Starting auto-sync with interval: ${intervalMinutes} minutes`);

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
      this.logger.info('Auto-sync stopped');
    }
  }

  /**
   * Run a single sync operation
   */
  private async runSync(): Promise<void> {
    try {
      this.logger.info('Starting automatic model sync');

      // Delegate to ModelSyncService for actual sync
      const result = await this.modelSyncService.syncModels({
        forceUpdate: false,
        markUnavailable: true,
      });

      // Log results
      if (result.success) {
        this.logger.info({
          msg: 'Automatic model sync completed successfully',
          totalModels: result.totalModels,
          newModels: result.newModels,
          updatedModels: result.updatedModels,
          unavailableModels: result.unavailableModels,
        });
      } else {
        this.logger.warn({
          msg: 'Automatic model sync completed with errors',
          errors: result.errors,
        });
      }
    } catch (error) {
      this.logger.error({ error }, 'Automatic model sync failed');
      // Don't throw - let the next interval retry
    }
  }
}
```

### Step 4: Ensure ModelSyncService Returns Proper Results

**File**: `backend/src/services/model-sync.service.ts`

Locate the `syncModels` method (around line 50-150) and ensure it returns a proper result object. The method signature should be:

```typescript
async syncModels(options: {
  forceUpdate?: boolean;
  markUnavailable?: boolean;
} = {}): Promise<{
  success: boolean;
  totalModels: number;
  newModels: number;
  updatedModels: number;
  unavailableModels: number;
  errors: string[];
  syncedAt: string;
}> {
  // ... existing implementation ...
}
```

If the method doesn't return this structure, update the end of the method to return:

```typescript
return {
  success: errors.length === 0,
  totalModels: models.length,
  newModels: newCount,
  updatedModels: updatedCount,
  unavailableModels: unavailableCount,
  errors: errors,
  syncedAt: new Date().toISOString(),
};
```

### Step 5: Update Manual Sync Endpoint to Return Full Results

**File**: `backend/src/routes/models.ts`

Find the POST `/sync` endpoint (around line 620-680) and ensure the handler returns the full sync result:

```typescript
handler: async (request, reply) => {
  try {
    // Use the unified ModelSyncService
    const modelSyncService = new ModelSyncService(fastify.db, fastify.log);

    const result = await modelSyncService.syncModels({
      forceUpdate: request.body?.forceUpdate || false,
      markUnavailable: request.body?.markUnavailable !== false,
    });

    // Return the full result to frontend
    return reply.send(result);
  } catch (error) {
    request.log.error({ error }, 'Manual model sync failed');

    // Return error with details
    return reply.code(500).send({
      success: false,
      totalModels: 0,
      newModels: 0,
      updatedModels: 0,
      unavailableModels: 0,
      errors: [error.message || 'Sync failed'],
      syncedAt: new Date().toISOString(),
    });
  }
};
```

### Step 6: Verify Database Plugin Startup Sync Uses ModelSyncService

**File**: `backend/src/plugins/database.ts`

Locate the startup sync code (around line 70-85) and verify it uses ModelSyncService:

```typescript
// Sync models on startup
try {
  const modelSyncService = new ModelSyncService(fastify.db, fastify.log);
  const syncResult = await modelSyncService.syncModels({
    forceUpdate: false,
    markUnavailable: true,
  });

  fastify.log.info({
    msg: 'Initial model sync completed',
    ...syncResult,
  });
} catch (syncError) {
  fastify.log.error({ error: syncError }, 'Failed to sync models on startup');
  // Don't fail startup - continue with cached models
}
```

## Verification Steps

After implementing these changes:

1. **Check environment variables are loaded**:
   - Verify `.env` contains `LITELLM_AUTO_SYNC=true` and `LITELLM_SYNC_INTERVAL=60`

2. **Restart the backend**:

   ```bash
   npm run dev
   ```

3. **Check logs for auto-sync initialization**:
   - Look for: "Starting automatic model synchronization service"
   - Look for: "Starting auto-sync with interval: 60 minutes"

4. **Test manual sync**:
   - Go to Settings page in frontend
   - Click "Refresh Models from LiteLLM"
   - Check for success notification or error details

5. **Monitor auto-sync**:
   - Check backend logs every hour for: "Starting automatic model sync"
   - Verify models are updated in the database

## Summary of Changes

| File                                                  | Change                                         | Purpose                   |
| ----------------------------------------------------- | ---------------------------------------------- | ------------------------- |
| `backend/.env`                                        | Add sync config                                | Enable auto-sync          |
| `backend/src/plugins/database.ts`                     | Initialize and start LiteLLMIntegrationService | Enable periodic sync      |
| `backend/src/services/litellm-integration.service.ts` | Delegate to ModelSyncService                   | Unify sync implementation |
| `backend/src/services/model-sync.service.ts`          | Ensure proper return structure                 | Consistent results        |
| `backend/src/routes/models.ts`                        | Return full sync results                       | Better error reporting    |

## Key Points

- **All sync operations now use `ModelSyncService.syncModels()`** - single source of truth
- **Three sync triggers** all use the same implementation:
  1. Startup sync (database plugin)
  2. Manual sync (API endpoint)
  3. Auto sync (LiteLLMIntegrationService)
- **Consistent error handling and logging** across all sync operations
- **No new features added** - only fixing existing functionality

## Expected Outcome

Once these changes are implemented:

- Models will sync automatically every 60 minutes
- Manual sync from Settings page will work and show detailed results
- All sync operations will use the same code path, making debugging easier
- Errors will be properly logged and reported

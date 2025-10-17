# Restricted Model Subscription Approval Workflow

**Feature Type:** Major Feature
**Status:** Planning
**Created:** 2025-10-15
**Estimated Effort:** 3-4 days

---

## Feature Description

### Overview

Implement a subscription approval workflow for models that require administrative approval. Administrators can flag models as "restricted access", which are visible to all users but require approval before access is granted. This provides controlled access to sensitive or costly models while maintaining visibility in the model catalog.

### Core Requirements

#### Restricted Access Models

- Administrators can mark models as "restricted access" via a boolean flag
- Restricted models remain visible in the model catalog for all users
- Visual indicator (badge/icon/flair) distinguishes restricted models from public ones
- Subscribing to a restricted model creates a subscription in "pending" state

#### Subscription States

1. **Pending** - User has requested access, awaiting admin approval
2. **Active** - Subscription approved and user has access
3. **Denied** - Admin denied the request with optional reason
4. **Inactive** - Standard inactive state (existing)
5. **Suspended/Cancelled/Expired** - Existing states remain unchanged

#### User Workflow

1. User browses model catalog and sees restricted models with special indicator
2. User subscribes to restricted model → subscription created in "pending" state
3. User sees pending subscription in "My Subscriptions" with pending badge
4. Upon admin approval:
   - Subscription becomes "active"
   - User can manually add model to their API keys
5. Upon admin denial:
   - Subscription marked as "denied" with admin's reason visible
   - User can delete the denied subscription OR
   - User can "Request Review" to move back to pending state

#### Admin Workflow

1. Admin views dedicated "Subscription Requests" panel
2. Default view shows only pending requests
3. Admin can filter by:
   - Status (pending, active, denied) - multi-select with checkboxes + "Select All"
   - Model(s) - multi-select with checkboxes + "Select All"
   - User(s) - searchable dropdown
   - Date range (last status change)
4. Table displays:
   - User info (name, email)
   - Model info (name, provider)
   - Current status with badge
   - Admin comment/reason (if denied/approved)
   - Requested date
   - Last status change date
5. Bulk actions:
   - Select multiple subscriptions via checkboxes
   - "Approve Selected" button → Modal with optional comment → Confirms → Approves all
   - "Deny Selected" button → Modal with required reason → Confirms → Denies all
6. Individual actions (via row dropdown):
   - Approve (with optional comment)
   - Deny (with required reason)
   - Revert decision (active → denied, denied → active)

#### Cascade Behavior: Marking Existing Model as Restricted

When an administrator marks a model with active subscriptions as "restricted access":

1. **All active subscriptions for that model:**
   - Status changes from "active" to "pending"
   - Require re-approval by admin

2. **API Keys containing that model:**
   - Model is automatically removed from all affected API keys
   - This immediately revokes access to the model via LiteLLM

3. **After Re-approval:**
   - Admin approves pending subscription → status becomes "active"
   - User must manually re-add the model to desired API key(s)
   - No automatic restoration to prevent unintended key modifications

**Rationale:** Manual re-addition gives users control over which API keys should have access and prevents automatic changes to production keys.

#### Audit Trail

- Full audit log in dedicated `subscription_status_history` table
- Track: subscription_id, old_status, new_status, reason, changed_by (admin user ID), changed_at
- Display audit history in admin panel (optional view per subscription)

#### Permission Model

- **Admin role:** Can approve, deny, revert, view all
- **AdminReadonly role:** Can view all requests but cannot approve/deny/revert
- **User role:** Can only see own subscriptions and request reviews

#### Notification Provisioning

- Design includes provision for future notification hooks
- No actual notification implementation (email/push) in this phase
- Notification triggers identified and documented for future integration

---

## Detailed Requirements from Q&A

### 1. Model Restriction Changes

**Q:** What happens to existing active subscriptions when a model is later marked as restricted?
**A:** Active subscriptions → transition to "pending" and require re-approval. API keys containing that model → automatically remove the model from the key. Upon re-approval, subscription becomes active, but users must manually re-add the model to their API keys.

### 2. Re-requesting Denied Subscriptions

**Q:** Can users re-request access to a denied subscription?
**A:** Yes, users can "Request Review" which changes status from "denied" to "pending". The request appears again in admin's pending list.

### 3. Admin Panel Features

**Q:** What does the admin panel show?
**A:** All subscription requests with their status (pending/active/denied), last status change date, and full audit history. Admins can revert decisions directly (denied → active or active → denied).

### 4. Admin Comments

**Q:** Can admins add comments when denying?
**A:** Yes, admins can add optional comments when approving and required reasons when denying. These are visible to users.

### 5. Role-Based Access

**Q:** Can adminReadonly users view the panel?
**A:** Yes, adminReadonly gets read-only access to the pending subscriptions panel (for demos).

### 6. Bulk Operations

**Q:** Should there be bulk approve/deny actions?
**A:** Yes, checkboxes for multi-selection, Modal for approve/deny with optional/required comment, same reason applied to all selected.

### 7. Audit Trail

**Q:** Should we track who approved/denied?
**A:** Yes, full audit trail in database tracking who, when, what action, and why.

### 8. Notifications

**Q:** Should there be notifications?
**A:** Design for future notification hooks but don't implement actual notification mechanism (no email system yet).

### 9. UI Display

**Q:** Should pending subscriptions show in "My Subscriptions"?
**A:** Yes, with visual status indicators (badges).

### 10. Request Review Button

**Q:** Should denied subscriptions have a "Request Review" action?
**A:** Yes, status badge for "Approved/Denied/Pending", "Request Review" button only shown for "Denied" state.

### 11. Database Schema

**Q:** Status enum?
**A:** `['pending', 'active', 'denied']` with provisions for 'inactive' in validation logic (for future use).

### 12. Model Table

**Q:** How to store restricted flag?
**A:** Simple `restrictedAccess` boolean on models table.

### 13. Storage of Denial Reasons

**Q:** Where to store admin comments?
**A:** Store `statusReason` in subscriptions table for easy access, plus full audit trail in dedicated audit table.

### 14. API Key Validation

**Q:** Should API key creation be blocked for non-active subscriptions?
**A:** Yes, backend enforces status = 'active' when creating/updating API keys. Frontend hides non-active models, backend rejects any attempt to add pending/denied models.

### 15. LiteLLM Integration

**Q:** Should LiteLLM proxy calls fail?
**A:** We don't proxy through LiteLLM. When subscription status changes to denied/pending, we automatically update the API key in LiteLLM (removing the model) using existing API key update mechanism.

### 16. Admin Panel Filters

**Q:** Should the admin panel support filtering?
**A:** Yes, sortable table with filters for model, user, date range, and status.

### 17. Statistics

**Q:** Should we show statistics?
**A:** No, keep the panel lean. Display all subscriptions with default filter showing only pending ones.

### 18. Filter UI Pattern

**Q:** How should status/model filters work?
**A:** Multi-select checkboxes with "Select All" option. Default view: only pending subscriptions selected.

---

## Implementation Plan

### Phase 0: System User Setup

#### 0.1 Create System User

**File:** `backend/src/lib/database-migrations.ts`

```typescript
// Create system user for audit trail of automated actions
export const systemUserSetup = `
-- Create system user with fixed UUID for audit trail
INSERT INTO users (
  id,
  username,
  email,
  oauth_provider,
  oauth_id,
  is_active,
  roles
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system',
  'system@litemaas.internal',
  'system',
  'system',
  false,  -- System user cannot log in
  '{}'    -- No roles needed
) ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN users.id IS 'System user (00000000-0000-0000-0000-000000000001) used for automated status changes in subscription approval workflow';
`;
```

**Rationale:** System-initiated changes (like model restriction cascades) need a valid user ID for the `status_changed_by` foreign key. This fixed UUID is used instead of NULL to maintain referential integrity.

---

### Phase 1: Database Schema Changes

#### 1.1 Update Models Table

**File:** `backend/src/lib/database-migrations.ts`

```typescript
// Add to modelsTable migration:
ALTER TABLE models ADD COLUMN IF NOT EXISTS restricted_access BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_models_restricted_access ON models(restricted_access);

COMMENT ON COLUMN models.restricted_access IS 'When true, subscriptions require admin approval';
```

#### 1.2 Update Subscriptions Table

**File:** `backend/src/lib/database-migrations.ts`

```typescript
// Update subscriptions status constraint to include 'pending' and 'denied'
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'suspended', 'cancelled', 'expired', 'inactive', 'pending', 'denied'));

// Add new columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES users(id);

COMMENT ON COLUMN subscriptions.status_reason IS 'Admin comment when approving/denying subscription';
COMMENT ON COLUMN subscriptions.status_changed_at IS 'Timestamp of last status change';
COMMENT ON COLUMN subscriptions.status_changed_by IS 'User ID of admin who changed status (or system user UUID for automated changes)';

// Add unique constraint to prevent duplicate subscriptions
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_model_unique
  UNIQUE (user_id, model_id);

COMMENT ON CONSTRAINT subscriptions_user_model_unique ON subscriptions IS
  'Ensures one subscription per user per model. Users with denied subscriptions must use Request Review, not create new subscription.';

// Add composite index for admin panel queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_updated
  ON subscriptions(status, status_changed_at DESC);
```

#### 1.3 Create Subscription Audit Table

**File:** `backend/src/lib/database-migrations.ts`

```typescript
export const subscriptionStatusHistoryTable = `
CREATE TABLE IF NOT EXISTS subscription_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id
  ON subscription_status_history(subscription_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_history_changed_by
  ON subscription_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_subscription_history_changed_at
  ON subscription_status_history(changed_at DESC);

COMMENT ON TABLE subscription_status_history IS 'Audit trail for all subscription status changes';
`;
```

#### 1.4 Data Migration Script

**File:** `backend/src/lib/database-migrations.ts`

```typescript
// Migrate existing subscriptions to new schema
export const migrateExistingSubscriptions = `
-- Set default values for existing subscriptions
UPDATE subscriptions
SET
  status_reason = NULL,
  status_changed_at = updated_at,  -- Use existing updated_at timestamp
  status_changed_by = '00000000-0000-0000-0000-000000000001'  -- System user
WHERE status_changed_at IS NULL;

-- Set all existing models to non-restricted (default behavior)
UPDATE models
SET restricted_access = false
WHERE restricted_access IS NULL;

COMMENT ON COLUMN subscriptions.status_changed_by IS
  'Existing subscriptions migrated with system user ID (00000000-0000-0000-0000-000000000001)';
`;
```

**Note:** No audit trail backfill is performed for existing subscriptions. Audit history starts tracking from the point this feature is deployed.

---

### Phase 2: Backend Type Definitions

#### 2.1 Update Subscription Types

**File:** `backend/src/types/subscription.types.ts`

```typescript
export enum SubscriptionStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  INACTIVE = 'inactive',
  PENDING = 'pending', // NEW
  DENIED = 'denied', // NEW
}

export interface Subscription {
  // ... existing fields ...
  statusReason?: string; // NEW
  statusChangedAt?: Date; // NEW
  statusChangedBy?: string; // NEW
}

// NEW: Request types for approval workflow
export interface ApproveSubscriptionsRequest {
  subscriptionIds: string[];
  reason?: string;
}

export interface DenySubscriptionsRequest {
  subscriptionIds: string[];
  reason: string; // Required for denials
}

export interface RevertSubscriptionRequest {
  newStatus: 'active' | 'denied' | 'pending';
  reason?: string;
}

export interface SubscriptionApprovalFilters {
  statuses?: SubscriptionStatus[];
  modelIds?: string[];
  userIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SubscriptionApprovalStats {
  pendingCount: number;
  approvedToday: number;
  deniedToday: number;
  totalRequests: number;
}

export interface SubscriptionWithDetails extends Subscription {
  user: {
    id: string;
    username: string;
    email: string;
  };
  model: {
    id: string;
    name: string;
    provider: string;
    restrictedAccess: boolean;
  };
  history?: SubscriptionStatusHistoryEntry[];
}

export interface SubscriptionStatusHistoryEntry {
  id: string;
  oldStatus?: string;
  newStatus: string;
  reason?: string;
  changedBy?: {
    id: string;
    username: string;
  };
  changedAt: Date;
}
```

#### 2.2 Update Model Types

**File:** `backend/src/types/model.types.ts`

```typescript
export interface Model {
  // ... existing fields ...
  restrictedAccess?: boolean; // NEW
}

export interface UpdateModelDto {
  // ... existing fields ...
  restrictedAccess?: boolean; // NEW
}
```

#### 2.3 Update RBAC Permissions

**File:** `backend/src/services/rbac.service.ts`

**Add New Permission Definitions:**

```typescript
// Add to systemPermissions array (following admin:banners pattern):
{
  id: 'admin:subscriptions:read',
  name: 'View Subscription Requests',
  description: 'View subscription approval requests and history',
  resource: 'subscriptions',
  action: 'read',
},
{
  id: 'admin:subscriptions:write',
  name: 'Manage Subscription Requests',
  description: 'Approve, deny, and revert subscription requests',
  resource: 'subscriptions',
  action: 'write',
},
{
  id: 'admin:subscriptions:delete',
  name: 'Delete Subscription Requests',
  description: 'Permanently delete subscriptions',
  resource: 'subscriptions',
  action: 'delete',
},
```

**Update Role Definitions:**

```typescript
// In systemRoles array:

// Admin role - add all three permissions
{
  id: 'admin',
  permissions: [
    // ... existing permissions ...
    'admin:subscriptions:read',   // NEW
    'admin:subscriptions:write',  // NEW
    'admin:subscriptions:delete', // NEW
  ],
},

// AdminReadonly role - add only read permission
{
  id: 'admin-readonly',
  permissions: [
    // ... existing permissions ...
    'admin:subscriptions:read',   // NEW (no write or delete permission)
  ],
},
```

**Rationale:** Follows the existing `admin:banners:read` / `admin:banners:write` pattern. AdminReadonly can view subscription requests but cannot approve/deny/revert them.

---

### Phase 3: Backend Services

#### 3.1 SubscriptionService Updates

**File:** `backend/src/services/subscription.service.ts`

**New Methods:**

```typescript
/**
 * Approve subscriptions (bulk operation)
 * Sets status to 'active' and records admin action
 */
async approveSubscriptions(
  subscriptionIds: string[],
  adminUserId: string,
  reason?: string
): Promise<{ successful: number; failed: number; errors: Array<{ subscription: string; error: string }> }>;

/**
 * Deny subscriptions (bulk operation)
 * Sets status to 'denied', removes models from API keys, records reason
 */
async denySubscriptions(
  subscriptionIds: string[],
  adminUserId: string,
  reason: string
): Promise<{ successful: number; failed: number; errors: Array<{ subscription: string; error: string }> }>;

/**
 * User re-requests a denied subscription
 * Idempotent behavior:
 * - denied → pending (main use case)
 * - pending → no-op, return success
 * - active → error
 * - non-existent → error
 */
async requestReview(
  subscriptionId: string,
  userId: string
): Promise<Subscription>;

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
  reason?: string
): Promise<Subscription>;

/**
 * Get subscription approval requests for admin panel
 * Supports filtering by status, model, user, date range
 */
async getSubscriptionApprovalRequests(
  filters: SubscriptionApprovalFilters,
  pagination: { page: number; limit: number }
): Promise<PaginatedResponse<SubscriptionWithDetails>>;

/**
 * Get approval statistics for admin dashboard
 */
async getSubscriptionApprovalStats(): Promise<SubscriptionApprovalStats>;

/**
 * Handle cascade when model restriction changes
 * Called by ModelService when restrictedAccess flag changes
 */
async handleModelRestrictionChange(
  modelId: string,
  isNowRestricted: boolean
): Promise<void>;

/**
 * Record status change in audit history table
 * Private helper method
 */
private async recordStatusChange(
  subscriptionId: string,
  oldStatus: string,
  newStatus: string,
  adminUserId: string,
  reason?: string
): Promise<void>;
```

**Modified Methods:**

```typescript
/**
 * createSubscription - Modified to check model restriction
 */
async createSubscription(
  userId: string,
  request: EnhancedCreateSubscriptionDto
): Promise<EnhancedSubscription> {
  // ... existing code ...

  // NEW: Check if model is restricted
  const model = await this.liteLLMService.getModelById(modelId);
  const modelDetails = await this.fastify.dbUtils.queryOne(
    'SELECT restricted_access FROM models WHERE id = $1',
    [modelId]
  );

  const initialStatus = modelDetails?.restricted_access ? 'pending' : 'active';

  // Create subscription with appropriate status
  const subscription = await this.fastify.dbUtils.queryOne(
    `INSERT INTO subscriptions (..., status) VALUES (..., $X) RETURNING *`,
    [..., initialStatus]
  );

  // ... rest of existing code ...
}
```

**Cascade Logic Implementation:**

```typescript
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

async handleModelRestrictionChange(
  modelId: string,
  isNowRestricted: boolean
): Promise<void> {
  if (!isNowRestricted) {
    // Model is no longer restricted - auto-approve all pending subscriptions
    const pendingSubscriptions = await this.fastify.dbUtils.queryMany<{ id: string }>(
      `SELECT id FROM subscriptions
       WHERE model_id = $1 AND status = 'pending'`,
      [modelId]
    );

    if (pendingSubscriptions.length > 0) {
      const subscriptionIds = pendingSubscriptions.map(s => s.id);

      // Auto-approve all pending subscriptions
      await this.fastify.dbUtils.query(
        `UPDATE subscriptions
         SET status = 'active',
             status_changed_at = CURRENT_TIMESTAMP,
             status_changed_by = $1,
             status_reason = 'Auto-approved: model restriction removed'
         WHERE id = ANY($2)`,
        [SYSTEM_USER_ID, subscriptionIds]
      );

      // Record audit log entries
      for (const sub of pendingSubscriptions) {
        await this.recordStatusChange(
          sub.id,
          'pending',
          'active',
          SYSTEM_USER_ID,
          'Auto-approved: model restriction removed'
        );
      }

      this.fastify.log.info(
        { modelId, count: pendingSubscriptions.length },
        'Auto-approved pending subscriptions due to model restriction removal'
      );
    }
    return;
  }

  // Model becoming restricted - transition active to pending
  const activeSubscriptions = await this.fastify.dbUtils.queryMany<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM subscriptions
     WHERE model_id = $1 AND status = 'active'`,
    [modelId]
  );

  if (activeSubscriptions.length === 0) {
    return;
  }

  // Remove model from all affected users' API keys FIRST (security priority)
  const apiKeyService = new ApiKeyService(this.fastify);
  for (const sub of activeSubscriptions) {
    await apiKeyService.removeModelFromUserApiKeys(sub.user_id, modelId);
  }

  // Transition all to pending
  const subscriptionIds = activeSubscriptions.map(s => s.id);
  await this.fastify.dbUtils.query(
    `UPDATE subscriptions
     SET status = 'pending',
         status_changed_at = CURRENT_TIMESTAMP,
         status_changed_by = $1,
         status_reason = 'Model marked as restricted access - requires re-approval'
     WHERE id = ANY($2)`,
    [SYSTEM_USER_ID, subscriptionIds]
  );

  // Record audit log entries
  for (const sub of activeSubscriptions) {
    await this.recordStatusChange(
      sub.id,
      'active',
      'pending',
      SYSTEM_USER_ID,
      'Model marked as restricted access - requires re-approval'
    );
  }

  this.fastify.log.info(
    { modelId, count: activeSubscriptions.length },
    'Transitioned active subscriptions to pending due to model restriction'
  );
}
```

#### 3.2 ApiKeyService Updates

**File:** `backend/src/services/api-key.service.ts`

**New Methods:**

```typescript
/**
 * Remove a specific model from all API keys belonging to a user
 * Used when subscription is denied or model becomes restricted
 *
 * CRITICAL: Updates LiteLLM FIRST, then database (security priority)
 * - If LiteLLM update fails → rollback/abort (don't modify database)
 * - If LiteLLM succeeds but database update fails → acceptable (access revoked)
 */
async removeModelFromUserApiKeys(
  userId: string,
  modelId: string
): Promise<void> {
  // Get all active API keys for user that contain this model
  const apiKeys = await this.fastify.dbUtils.queryMany<{ id: string; lite_llm_key_value: string }>(
    `SELECT DISTINCT ak.id, ak.lite_llm_key_value
     FROM api_keys ak
     JOIN api_key_models akm ON ak.id = akm.api_key_id
     WHERE ak.user_id = $1
       AND akm.model_id = $2
       AND ak.is_active = true`,
    [userId, modelId]
  );

  if (apiKeys.length === 0) {
    return;
  }

  // STEP 1: Update LiteLLM FIRST (security priority)
  const liteLLMUpdates: { keyId: string; success: boolean; error?: Error }[] = [];

  for (const apiKey of apiKeys) {
    if (apiKey.lite_llm_key_value && !this.shouldUseMockData()) {
      try {
        // Get remaining models for this key (excluding the one being removed)
        const remainingModels = await this.fastify.dbUtils.queryMany<{ model_id: string }>(
          `SELECT model_id FROM api_key_models
           WHERE api_key_id = $1 AND model_id != $2`,
          [apiKey.id, modelId]
        );

        await this.liteLLMService.updateKey(apiKey.lite_llm_key_value, {
          models: remainingModels.map(m => m.model_id)
        });

        liteLLMUpdates.push({ keyId: apiKey.id, success: true });
      } catch (error) {
        this.fastify.log.error(
          { error, keyId: apiKey.id, modelId },
          'Failed to update LiteLLM key - aborting database update for this key'
        );
        liteLLMUpdates.push({
          keyId: apiKey.id,
          success: false,
          error: error as Error
        });
      }
    } else {
      // Mock mode or no LiteLLM key - treat as success
      liteLLMUpdates.push({ keyId: apiKey.id, success: true });
    }
  }

  // STEP 2: Only update database for keys where LiteLLM succeeded
  const successfulKeyIds = liteLLMUpdates
    .filter(u => u.success)
    .map(u => u.keyId);

  if (successfulKeyIds.length > 0) {
    await this.fastify.dbUtils.query(
      `DELETE FROM api_key_models
       WHERE api_key_id = ANY($1) AND model_id = $2`,
      [successfulKeyIds, modelId]
    );

    this.fastify.log.info(
      { userId, modelId, keysAffected: successfulKeyIds.length, totalKeys: apiKeys.length },
      'Removed model from user API keys'
    );
  }

  // Report failures
  const failures = liteLLMUpdates.filter(u => !u.success);
  if (failures.length > 0) {
    this.fastify.log.warn(
      { userId, modelId, failedKeys: failures.length, totalKeys: apiKeys.length },
      'Some API keys could not be updated in LiteLLM - database unchanged for those keys'
    );
  }
}
```

**Modified Methods:**

```typescript
/**
 * Shared validation helper for subscription status
 */
private async validateModelsHaveActiveSubscriptions(
  userId: string,
  modelIds: string[]
): Promise<void> {
  if (!modelIds || modelIds.length === 0) {
    return;
  }

  const subscriptions = await this.fastify.dbUtils.queryMany<{ model_id: string; status: string }>(
    `SELECT model_id, status FROM subscriptions
     WHERE user_id = $1 AND model_id = ANY($2)`,
    [userId, modelIds]
  );

  const invalidModels = modelIds.filter(modelId => {
    const sub = subscriptions.find(s => s.model_id === modelId);
    return !sub || sub.status !== 'active';
  });

  if (invalidModels.length > 0) {
    throw this.createValidationError(
      `Cannot add models without active subscriptions: ${invalidModels.join(', ')}`,
      'modelIds',
      modelIds,
      'Ensure all models have active subscriptions before adding them to an API key'
    );
  }
}

/**
 * createApiKey - Add validation for subscription status
 */
async createApiKey(userId: string, request: CreateApiKeyRequest): Promise<ApiKeyWithSecret> {
  // ... existing code ...

  // NEW: Validate all models have active subscriptions
  await this.validateModelsHaveActiveSubscriptions(userId, request.modelIds);

  // ... rest of existing code ...
}

/**
 * updateApiKey - Add validation for subscription status
 */
async updateApiKey(
  userId: string,
  keyId: string,
  request: UpdateApiKeyRequest
): Promise<ApiKey> {
  // ... existing code ...

  // NEW: Validate all models have active subscriptions
  if (request.modelIds) {
    await this.validateModelsHaveActiveSubscriptions(userId, request.modelIds);
  }

  // ... rest of existing code ...
}
```

#### 3.3 ModelService Updates

**File:** `backend/src/services/model-sync.service.ts` or new `backend/src/services/model-admin.service.ts`

**New Methods:**

```typescript
/**
 * Update model restriction status
 * Triggers cascade logic for existing subscriptions
 */
async updateModelRestriction(
  modelId: string,
  restrictedAccess: boolean,
  adminUserId: string
): Promise<void> {
  // Get current restriction status
  const currentModel = await this.fastify.dbUtils.queryOne<{ restricted_access: boolean }>(
    'SELECT restricted_access FROM models WHERE id = $1',
    [modelId]
  );

  if (!currentModel) {
    throw this.createNotFoundError('Model', modelId);
  }

  // Update the model
  await this.fastify.dbUtils.query(
    'UPDATE models SET restricted_access = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [restrictedAccess, modelId]
  );

  // If newly restricted, handle cascade
  if (restrictedAccess && !currentModel.restricted_access) {
    const subscriptionService = new SubscriptionService(this.fastify);
    await subscriptionService.handleModelRestrictionChange(modelId, true);
  }

  // Audit log
  await this.fastify.dbUtils.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      adminUserId,
      'MODEL_RESTRICTION_CHANGE',
      'MODEL',
      modelId,
      JSON.stringify({ restrictedAccess, previousValue: currentModel.restricted_access })
    ]
  );

  this.fastify.log.info(
    { modelId, restrictedAccess, adminUserId },
    'Model restriction status updated'
  );
}
```

#### 3.4 Notification Service (Placeholder)

**File:** `backend/src/services/notification.service.ts` (NEW)

```typescript
import { FastifyInstance } from 'fastify';

/**
 * NotificationService - Placeholder for future notification integration
 * All methods are async no-ops ready for external service integration
 */
export class NotificationService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Notify admins of new pending subscription request
   * TODO: Implement email/push notification
   */
  async notifyAdminsNewPendingRequest(
    subscriptionId: string,
    userId: string,
    modelId: string,
  ): Promise<void> {
    this.fastify.log.debug(
      { subscriptionId, userId, modelId },
      'Notification hook: New pending subscription request (not implemented)',
    );
    // Future: Send email/push to admins
  }

  /**
   * Notify user their subscription was approved
   * TODO: Implement email/push notification
   */
  async notifyUserSubscriptionApproved(
    subscriptionId: string,
    userId: string,
    modelId: string,
  ): Promise<void> {
    this.fastify.log.debug(
      { subscriptionId, userId, modelId },
      'Notification hook: Subscription approved (not implemented)',
    );
    // Future: Send email/push to user
  }

  /**
   * Notify user their subscription was denied
   * TODO: Implement email/push notification
   */
  async notifyUserSubscriptionDenied(
    subscriptionId: string,
    userId: string,
    modelId: string,
    reason: string,
  ): Promise<void> {
    this.fastify.log.debug(
      { subscriptionId, userId, modelId, reason },
      'Notification hook: Subscription denied (not implemented)',
    );
    // Future: Send email/push to user with denial reason
  }

  /**
   * Notify admins user requested review of denied subscription
   * TODO: Implement email/push notification
   */
  async notifyAdminsReviewRequested(
    subscriptionId: string,
    userId: string,
    modelId: string,
  ): Promise<void> {
    this.fastify.log.debug(
      { subscriptionId, userId, modelId },
      'Notification hook: Review requested (not implemented)',
    );
    // Future: Send email/push to admins
  }

  /**
   * Notify users their model became restricted
   * TODO: Implement email/push notification
   */
  async notifyUsersModelRestricted(modelId: string, affectedUserIds: string[]): Promise<void> {
    this.fastify.log.debug(
      { modelId, userCount: affectedUserIds.length },
      'Notification hook: Model restricted (not implemented)',
    );
    // Future: Send bulk email/push to affected users
  }
}
```

**Integration Points:**

- Call `notifyAdminsNewPendingRequest()` in `createSubscription()` when status is 'pending'
- Call `notifyUserSubscriptionApproved()` in `approveSubscriptions()`
- Call `notifyUserSubscriptionDenied()` in `denySubscriptions()`
- Call `notifyAdminsReviewRequested()` in `requestReview()`
- Call `notifyUsersModelRestricted()` in `handleModelRestrictionChange()`

---

### Phase 4: Backend Routes & Schemas

#### 4.1 New Admin Route

**File:** `backend/src/routes/admin-subscriptions.ts` (NEW)

```typescript
import { FastifyPluginAsync } from 'fastify';
import { SubscriptionService } from '../services/subscription.service';
import { AuthenticatedRequest } from '../types';

const adminSubscriptionsRoutes: FastifyPluginAsync = async (fastify) => {
  const subscriptionService = new SubscriptionService(fastify);

  // Get subscription requests (with filters)
  fastify.get('/subscriptions', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Get subscription approval requests',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          statuses: { type: 'array', items: { type: 'string' } },
          modelIds: { type: 'array', items: { type: 'string' } },
          userIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:read')],
    handler: async (request, reply) => {
      const {
        statuses,
        modelIds,
        userIds,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
      } = request.query as any;

      const result = await subscriptionService.getSubscriptionApprovalRequests(
        { statuses, modelIds, userIds, dateFrom, dateTo },
        { page, limit },
      );

      return result;
    },
  });

  // Get approval statistics
  fastify.get('/subscriptions/stats', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Get subscription approval statistics',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:read')],
    handler: async (request, reply) => {
      return await subscriptionService.getSubscriptionApprovalStats();
    },
  });

  // Bulk approve
  fastify.post('/subscriptions/approve', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Approve subscriptions (bulk)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['subscriptionIds'],
        properties: {
          subscriptionIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
          },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:write')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { subscriptionIds, reason } = request.body as any;

      const result = await subscriptionService.approveSubscriptions(
        subscriptionIds,
        authRequest.user.userId,
        reason,
      );

      return result;
    },
  });

  // Bulk deny
  fastify.post('/subscriptions/deny', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Deny subscriptions (bulk)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['subscriptionIds', 'reason'],
        properties: {
          subscriptionIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
          },
          reason: { type: 'string', minLength: 1 },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:write')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { subscriptionIds, reason } = request.body as any;

      const result = await subscriptionService.denySubscriptions(
        subscriptionIds,
        authRequest.user.userId,
        reason,
      );

      return result;
    },
  });

  // Revert subscription status
  fastify.post('/:id/revert', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Revert subscription status decision',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['newStatus'],
        properties: {
          newStatus: { type: 'string', enum: ['active', 'denied', 'pending'] },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:write')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as any;
      const { newStatus, reason } = request.body as any;

      const result = await subscriptionService.revertSubscription(
        id,
        newStatus,
        authRequest.user.userId,
        reason,
      );

      return result;
    },
  });

  // Delete subscription permanently
  fastify.delete<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/:id', {
    schema: {
      tags: ['Admin - Subscriptions'],
      summary: 'Delete subscription permanently',
      description:
        'Permanently delete a subscription and clean up associated API keys. This action cannot be undone.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Optional reason for deletion (saved in audit log)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:subscriptions:delete')],
    handler: async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params;
      const { reason } = (request.body as any) || {};

      const result = await subscriptionService.deleteSubscription(
        id,
        authRequest.user.userId,
        reason,
      );

      return result;
    },
  });
};

export default adminSubscriptionsRoutes;
```

**Register Route:**
**File:** `backend/src/routes/index.ts`

```typescript
// Add to route registration:
await app.register(adminSubscriptionsRoutes, { prefix: '/admin/subscriptions' });
```

#### 4.2 Update User Subscription Routes

**File:** `backend/src/routes/subscriptions.ts`

```typescript
// Add new endpoint for requesting review
fastify.post<{
  Params: { id: string };
}>('/:id/request-review', {
  schema: {
    tags: ['Subscriptions'],
    summary: 'Request review for denied subscription',
    description: 'User can request re-review of a denied subscription',
    security: [{ bearerAuth: [] }],
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },
  preHandler: fastify.authenticateWithDevBypass,
  handler: async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    const { id } = request.params;

    const result = await subscriptionService.requestReview(id, user.userId);
    return result;
  },
});
```

#### 4.3 Update Admin Models Routes

**File:** `backend/src/routes/admin-models.ts`

```typescript
// Update PATCH endpoint to handle restrictedAccess
fastify.patch<{
  Params: { id: string };
  Body: UpdateModelDto;
}>('/:id', {
  // ... existing schema ...
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:models')],
  handler: async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    const authRequest = request as AuthenticatedRequest;

    // If restrictedAccess is being changed, handle cascade
    if (updates.restrictedAccess !== undefined) {
      const modelAdminService = new ModelAdminService(fastify);
      await modelAdminService.updateModelRestriction(
        id,
        updates.restrictedAccess,
        authRequest.user.userId,
      );
    }

    // ... rest of existing update logic ...
  },
});
```

#### 4.4 Schemas

**File:** `backend/src/schemas/admin-subscriptions.ts` (NEW)

```typescript
import { Type } from '@sinclair/typebox';

export const SubscriptionApprovalFiltersSchema = Type.Object({
  statuses: Type.Optional(Type.Array(Type.String())),
  modelIds: Type.Optional(Type.Array(Type.String())),
  userIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  dateFrom: Type.Optional(Type.String({ format: 'date-time' })),
  dateTo: Type.Optional(Type.String({ format: 'date-time' })),
});

export const ApproveSubscriptionsSchema = Type.Object({
  subscriptionIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
  reason: Type.Optional(Type.String()),
});

export const DenySubscriptionsSchema = Type.Object({
  subscriptionIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
  reason: Type.String({ minLength: 1 }),
});

export const RevertSubscriptionSchema = Type.Object({
  newStatus: Type.Union([Type.Literal('active'), Type.Literal('denied'), Type.Literal('pending')]),
  reason: Type.Optional(Type.String()),
});

export const SubscriptionWithDetailsSchema = Type.Object({
  id: Type.String(),
  userId: Type.String(),
  modelId: Type.String(),
  status: Type.String(),
  statusReason: Type.Optional(Type.String()),
  statusChangedAt: Type.Optional(Type.String({ format: 'date-time' })),
  statusChangedBy: Type.Optional(Type.String()),
  user: Type.Object({
    id: Type.String(),
    username: Type.String(),
    email: Type.String(),
  }),
  model: Type.Object({
    id: Type.String(),
    name: Type.String(),
    provider: Type.String(),
    restrictedAccess: Type.Boolean(),
  }),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});
```

**File:** `backend/src/schemas/subscriptions.ts`

```typescript
// Update SubscriptionStatusEnum to include new statuses
export const SubscriptionStatusEnum = Type.Union([
  Type.Literal('active'),
  Type.Literal('suspended'),
  Type.Literal('cancelled'),
  Type.Literal('expired'),
  Type.Literal('inactive'),
  Type.Literal('pending'), // NEW
  Type.Literal('denied'), // NEW
]);

// Update SubscriptionSchema to include new fields
export const SubscriptionSchema = Type.Object({
  // ... existing fields ...
  statusReason: Type.Optional(Type.String()), // NEW
  statusChangedAt: Type.Optional(TimestampSchema), // NEW
  statusChangedBy: Type.Optional(Type.String()), // NEW
});
```

**File:** `backend/src/schemas/models.ts` and `backend/src/schemas/admin-models.ts`

```typescript
// Add to model schemas
restrictedAccess: Type.Optional(Type.Boolean()),
```

---

### Phase 5: Frontend Type Definitions

#### 5.1 Update Subscription Service Types

**File:** `frontend/src/services/subscriptions.service.ts`

```typescript
export type SubscriptionStatus =
  | 'active'
  | 'suspended'
  | 'cancelled'
  | 'expired'
  | 'inactive'
  | 'pending' // NEW
  | 'denied'; // NEW

export interface Subscription {
  // ... existing fields ...
  statusReason?: string; // NEW
  statusChangedAt?: string; // NEW
  statusChangedBy?: string; // NEW
}
```

#### 5.2 Create Admin Subscription Types

**File:** `frontend/src/types/admin.ts`

```typescript
export interface AdminSubscriptionRequest {
  id: string;
  userId: string;
  modelId: string;
  status: SubscriptionStatus;
  statusReason?: string;
  statusChangedAt?: string;
  statusChangedBy?: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  model: {
    id: string;
    name: string;
    provider: string;
    restrictedAccess: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionApprovalFilters {
  statuses?: SubscriptionStatus[];
  modelIds?: string[];
  userIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ApproveSubscriptionsRequest {
  subscriptionIds: string[];
  reason?: string;
}

export interface DenySubscriptionsRequest {
  subscriptionIds: string[];
  reason: string;
}

export interface RevertSubscriptionRequest {
  newStatus: 'active' | 'denied' | 'pending';
  reason?: string;
}

export interface SubscriptionApprovalStats {
  pendingCount: number;
  approvedToday: number;
  deniedToday: number;
  totalRequests: number;
}
```

---

### Phase 6: Frontend Services

#### 6.1 New Admin Subscription Service

**File:** `frontend/src/services/adminSubscriptions.service.ts` (NEW)

```typescript
import apiClient from './api';
import type {
  AdminSubscriptionRequest,
  SubscriptionApprovalFilters,
  ApproveSubscriptionsRequest,
  DenySubscriptionsRequest,
  RevertSubscriptionRequest,
  SubscriptionApprovalStats,
} from '../types/admin';
import type { PaginatedResponse } from './common.types';

export const adminSubscriptionsService = {
  /**
   * Get subscription requests with filters
   */
  async getSubscriptionRequests(
    filters: SubscriptionApprovalFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<AdminSubscriptionRequest>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters.statuses?.length) {
      filters.statuses.forEach((status) => params.append('statuses', status));
    }
    if (filters.modelIds?.length) {
      filters.modelIds.forEach((id) => params.append('modelIds', id));
    }
    if (filters.userIds?.length) {
      filters.userIds.forEach((id) => params.append('userIds', id));
    }
    if (filters.dateFrom) {
      params.append('dateFrom', filters.dateFrom.toISOString());
    }
    if (filters.dateTo) {
      params.append('dateTo', filters.dateTo.toISOString());
    }

    const response = await apiClient.get<PaginatedResponse<AdminSubscriptionRequest>>(
      `/admin/subscriptions?${params.toString()}`,
    );
    return response;
  },

  /**
   * Get approval statistics
   */
  async getSubscriptionStats(): Promise<SubscriptionApprovalStats> {
    const response = await apiClient.get<SubscriptionApprovalStats>('/admin/subscriptions/stats');
    return response;
  },

  /**
   * Approve subscriptions (bulk)
   */
  async bulkApprove(request: ApproveSubscriptionsRequest): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ subscription: string; error: string }>;
  }> {
    const response = await apiClient.post('/admin/subscriptions/approve', request);
    return response;
  },

  /**
   * Deny subscriptions (bulk)
   */
  async bulkDeny(request: DenySubscriptionsRequest): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ subscription: string; error: string }>;
  }> {
    const response = await apiClient.post('/admin/subscriptions/deny', request);
    return response;
  },

  /**
   * Revert subscription status
   */
  async revertSubscription(
    subscriptionId: string,
    request: RevertSubscriptionRequest,
  ): Promise<AdminSubscriptionRequest> {
    const response = await apiClient.post(`/admin/subscriptions/${subscriptionId}/revert`, request);
    return response;
  },

  /**
   * Delete subscription permanently
   */
  async deleteSubscription(subscriptionId: string, reason?: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/admin/subscriptions/${subscriptionId}`, {
      data: { reason },
    });
    return response;
  },
};
```

#### 6.2 Update Subscription Service

**File:** `frontend/src/services/subscriptions.service.ts`

```typescript
// Add new method
export const subscriptionsService = {
  // ... existing methods ...

  /**
   * Request review for denied subscription
   */
  async requestReview(subscriptionId: string): Promise<Subscription> {
    const response = await apiClient.post<Subscription>(
      `/api/v1/subscriptions/${subscriptionId}/request-review`,
    );
    return response.data;
  },
};
```

---

### Phase 7: Frontend Components

#### 7.1 Update SubscriptionsPage

**File:** `frontend/src/pages/SubscriptionsPage.tsx`

**Key Changes:**

```typescript
// Status badge configuration using object maps
const statusVariants = {
  active: 'success',
  suspended: 'warning',
  expired: 'danger',
  pending: 'blue',      // NEW
  denied: 'red',        // NEW
} as const;

const statusIcons = {
  active: <CheckCircleIcon />,
  suspended: <ExclamationTriangleIcon />,
  expired: <TimesCircleIcon />,
  pending: <ClockIcon />,           // NEW - static icon
  denied: <TimesCircleIcon />,      // NEW
};

const statusLabels = {
  active: t('pages.subscriptions.status.active'),
  suspended: t('pages.subscriptions.status.suspended'),
  expired: t('pages.subscriptions.status.expired'),
  pending: t('pages.subscriptions.status.pending'),      // NEW
  denied: t('pages.subscriptions.status.denied'),        // NEW
};

// Render badge with mapped values
<Label color={statusVariants[status]} icon={statusIcons[status]}>
  {statusLabels[status]}
</Label>

// Add Request Review handler
const handleRequestReview = async (subscriptionId: string) => {
  try {
    await subscriptionsService.requestReview(subscriptionId);
    addNotification({
      variant: 'success',
      title: t('pages.subscriptions.requestReviewSuccess'),
    });
    await loadSubscriptions(); // Reload to show updated status
  } catch (error) {
    handleError(error);
  }
};

// In subscription card rendering:
<CardFooter>
  {subscription.status === 'denied' && (
    <Button
      variant="primary"
      onClick={() => handleRequestReview(subscription.id)}
      aria-label={t('pages.subscriptions.requestReview')}
    >
      {t('pages.subscriptions.requestReview')}
    </Button>
  )}
  {/* ... existing buttons ... */}
</CardFooter>

// In details modal, show statusReason if present:
{selectedSubscription?.statusReason && (
  <DescriptionListGroup>
    <DescriptionListTerm>
      {t('pages.subscriptions.statusReason')}
    </DescriptionListTerm>
    <DescriptionListDescription>
      <Alert variant="info" isInline title={selectedSubscription.statusReason} />
    </DescriptionListDescription>
  </DescriptionListGroup>
)}
```

#### 7.2 New Admin Subscriptions Page

**File:** `frontend/src/pages/AdminSubscriptionsPage.tsx` (NEW)

Full implementation available - this is a complex component with:

- Filter panel (status checkboxes, model multi-select, user dropdown, date range)
- Paginated table with selection (always paginated, even with few results)
- Bulk action buttons and result modals
- Individual row actions dropdown
- Manual refresh only (no polling)
- Auto-switch to all statuses when pending filter returns 0 results

Key structure:

```typescript
const AdminSubscriptionsPage: React.FC = () => {
  // State
  const [filters, setFilters] = useState<SubscriptionApprovalFilters>({
    statuses: ['pending'], // Default to pending only
  });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isDenyModalOpen, setIsDenyModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    successCount: number;
    errors: Array<{ id: string; error: string }>;
  } | null>(null);

  // React Query (manual refresh only)
  const { data, isLoading, refetch } = useQuery(
    ['adminSubscriptions', filters, page],
    () => adminSubscriptionsService.getSubscriptionRequests(filters, page),
    // No refetchInterval - manual refresh only
  );

  // Auto-switch to all statuses when pending returns 0
  useEffect(() => {
    if (data?.items.length === 0 && filters.statuses?.includes('pending')) {
      setFilters({ ...filters, statuses: undefined }); // Show all
    }
  }, [data]);

  // Mutations with result modal
  const approveMutation = useMutation(adminSubscriptionsService.bulkApprove, {
    onSuccess: (result) => {
      setBulkResult(result);
      setIsResultModalOpen(true);
      refetch();
    },
  });

  const denyMutation = useMutation(adminSubscriptionsService.bulkDeny, {
    onSuccess: (result) => {
      setBulkResult(result);
      setIsResultModalOpen(true);
      refetch();
    },
  });

  // Render filters, table, modals (including result modal)
  // Include manual "Refresh" button in toolbar
};
```

**Bulk Result Modal:**

- Always shown after bulk operations (success or partial failure)
- Displays table with:
  - Subscription ID
  - User/Model info
  - Status (✓ Success / ✗ Failed)
  - Error message (for failures)
- "Close" button to dismiss

#### 7.3 Update ModelsPage

**File:** `frontend/src/pages/ModelsPage.tsx`

```typescript
// In model card rendering:
{model.restrictedAccess && (
  <Label color="orange" icon={<LockIcon />}>
    {t('pages.models.restrictedAccess')}
  </Label>
)}

// Disable Subscribe button if subscription exists (any status)
const hasExistingSubscription = userSubscriptions.some(
  sub => sub.modelId === model.id
);

<Button
  variant="primary"
  onClick={() => handleSubscribe(model.id)}
  isDisabled={hasExistingSubscription}
  aria-label={
    hasExistingSubscription
      ? t('pages.models.alreadySubscribed')
      : t('pages.models.subscribe')
  }
>
  {hasExistingSubscription
    ? t('pages.models.subscribed')
    : t('pages.models.subscribe')
  }
</Button>
```

**Rationale:** Unique constraint `(user_id, model_id)` prevents duplicate subscriptions. Users with denied subscriptions must use "Request Review", not subscribe again.

#### 7.4 Update AdminModelsPage

**File:** `frontend/src/pages/AdminModelsPage.tsx`

```typescript
// Add to form state
const [formData, setFormData] = useState({
  // ... existing fields ...
  restrictedAccess: false,  // NEW
});

// Add confirmation modal state
const [showRestrictionWarning, setShowRestrictionWarning] = useState(false);
const [pendingRestrictionChange, setPendingRestrictionChange] = useState(false);

// In form rendering:
<Checkbox
  id="restrictedAccess"
  label={t('pages.adminModels.restrictedAccessLabel')}
  isChecked={formData.restrictedAccess}
  onChange={(checked) => {
    // If enabling restriction on existing model, show warning
    if (checked && selectedModel?.id) {
      setShowRestrictionWarning(true);
      setPendingRestrictionChange(true);
    } else {
      setFormData({ ...formData, restrictedAccess: checked });
    }
  }}
/>

// Warning modal
<Modal
  variant={ModalVariant.small}
  title={t('pages.adminModels.restrictedAccessWarning.title')}
  isOpen={showRestrictionWarning}
  onClose={() => {
    setShowRestrictionWarning(false);
    setPendingRestrictionChange(false);
  }}
  actions={[
    <Button key="confirm" variant="primary" onClick={() => {
      setFormData({ ...formData, restrictedAccess: true });
      setShowRestrictionWarning(false);
    }}>
      {t('common.continue')}
    </Button>,
    <Button key="cancel" variant="link" onClick={() => {
      setShowRestrictionWarning(false);
      setPendingRestrictionChange(false);
    }}>
      {t('common.cancel')}
    </Button>
  ]}
>
  <Alert variant="warning" isInline title={t('pages.adminModels.restrictedAccessWarning.message')} />
</Modal>
```

---

### Phase 8: Internationalization

#### 8.1 Translation Keys (All 9 Languages)

**File:** `frontend/src/i18n/locales/en/translation.json` (and all other language files)

```json
{
  "pages": {
    "subscriptions": {
      "status": {
        "pending": "Pending Approval",
        "denied": "Access Denied"
      },
      "requestReview": "Request Review",
      "requestReviewSuccess": "Review requested successfully",
      "statusReason": "Admin Comment"
    },
    "adminSubscriptions": {
      "title": "Subscription Requests",
      "filters": {
        "status": "Status",
        "model": "Model",
        "user": "User",
        "dateRange": "Date Range",
        "selectAll": "Select All"
      },
      "table": {
        "user": "User",
        "model": "Model",
        "status": "Status",
        "reason": "Reason",
        "requestedDate": "Requested",
        "statusChangedDate": "Last Updated"
      },
      "bulkApprove": "Approve Selected",
      "bulkDeny": "Deny Selected",
      "confirmApproval": "Confirm Approval",
      "confirmDenial": "Confirm Denial",
      "approvalModalTitle": "Approve Subscriptions",
      "denialModalTitle": "Deny Subscriptions",
      "reasonLabel": "Comment (optional for approval, required for denial)",
      "reasonPlaceholder": "Enter reason for this decision...",
      "approveSuccess": "Subscriptions approved successfully",
      "denySuccess": "Subscriptions denied successfully",
      "stats": {
        "pending": "Pending Requests",
        "approvedToday": "Approved Today",
        "deniedToday": "Denied Today"
      }
    },
    "models": {
      "restrictedAccess": "Restricted Access"
    },
    "adminModels": {
      "restrictedAccessLabel": "Require Admin Approval",
      "restrictedAccessHelp": "Users must request access and receive admin approval",
      "restrictedAccessWarning": {
        "title": "Enable Restricted Access?",
        "message": "This will move all active subscriptions for this model to pending status and remove the model from existing API keys. Users will need to be re-approved."
      }
    }
  }
}
```

**Note:** Repeat for all languages (es, fr, de, it, ja, ko, zh, elv) with appropriate translations.

---

### Phase 9: Testing

#### 9.1 Backend Unit Tests

**File:** `backend/tests/unit/services/subscription.service.test.ts`

```typescript
describe('SubscriptionService - Approval Workflow', () => {
  describe('createSubscription with restricted model', () => {
    it('should create subscription with pending status for restricted model', async () => {
      // Test that restricted models create pending subscriptions
    });

    it('should create subscription with active status for non-restricted model', async () => {
      // Test that normal models create active subscriptions
    });
  });

  describe('approveSubscriptions', () => {
    it('should approve single subscription and record audit trail', async () => {
      // Test approval flow with audit logging
    });

    it('should approve multiple subscriptions in bulk', async () => {
      // Test bulk approval
    });

    it('should handle partial failures in bulk approval', async () => {
      // Test error handling in bulk operations
    });
  });

  describe('denySubscriptions', () => {
    it('should deny subscription with required reason', async () => {
      // Test denial with reason
    });

    it('should remove model from user API keys on denial', async () => {
      // Test cascade to API keys
    });
  });

  describe('handleModelRestrictionChange', () => {
    it('should transition active subscriptions to pending when model becomes restricted', async () => {
      // Test cascade logic
    });

    it('should remove model from all affected API keys', async () => {
      // Test API key updates
    });

    it('should create audit trail for system-initiated changes', async () => {
      // Test audit logging
    });
  });

  describe('requestReview', () => {
    it('should change denied subscription to pending', async () => {
      // Test re-request flow
    });

    it('should clear previous denial reason', async () => {
      // Test reason clearing
    });
  });
});
```

**File:** `backend/tests/unit/services/api-key.service.test.ts`

```typescript
describe('ApiKeyService - Subscription Validation', () => {
  describe('createApiKey with subscription validation', () => {
    it('should allow creating key with active subscription models', async () => {
      // Test valid creation
    });

    it('should reject creating key with pending subscription models', async () => {
      // Test pending rejection
    });

    it('should reject creating key with denied subscription models', async () => {
      // Test denied rejection
    });
  });

  describe('removeModelFromUserApiKeys', () => {
    it('should remove model from all user API keys', async () => {
      // Test removal
    });

    it('should update LiteLLM keys with remaining models', async () => {
      // Test LiteLLM sync
    });
  });
});
```

#### 9.2 Backend Integration Tests

**File:** `backend/tests/integration/admin-subscriptions.test.ts`

```typescript
describe('Admin Subscription Routes', () => {
  describe('GET /admin/subscriptions', () => {
    it('should return filtered subscription requests for admin', async () => {
      // Test filtering and pagination
    });

    it('should return read-only data for adminReadonly', async () => {
      // Test RBAC with admin:subscriptions:read permission
    });

    it('should reject requests from regular users', async () => {
      // Test RBAC enforcement
    });
  });

  describe('POST /admin/subscriptions/approve', () => {
    it('should approve subscriptions and allow API key creation', async () => {
      // Test full approval workflow
      // Verify return structure: { successful, failed, errors }
    });

    it('should reject approval from adminReadonly', async () => {
      // Test write permission check (requires admin:subscriptions:write)
    });

    it('should handle partial failures in bulk operations', async () => {
      // Test that some subscriptions can succeed while others fail
      // Verify error objects have { subscription, error } structure
    });
  });

  describe('POST /admin/subscriptions/deny', () => {
    it('should deny subscriptions and remove from API keys', async () => {
      // Test full denial workflow
      // Verify return structure: { successful, failed, errors }
    });

    it('should require reason for denial', async () => {
      // Test that reason field is required
    });
  });

  describe('POST /admin/subscriptions/:id/revert', () => {
    it('should revert subscription status with admin:subscriptions:write permission', async () => {
      // Test status reversion
    });

    it('should reject revert from adminReadonly', async () => {
      // Test write permission required
    });
  });

  describe('DELETE /admin/subscriptions/:id', () => {
    it('should delete subscription with admin:subscriptions:delete permission', async () => {
      // Test permanent deletion
    });

    it('should reject deletion from adminReadonly', async () => {
      // Test delete permission required
    });

    it('should create audit log entry for deletion', async () => {
      // Test audit trail
    });
  });
});
```

#### 9.3 Frontend Component Tests

**File:** `frontend/src/test/pages/AdminSubscriptionsPage.test.tsx`

```typescript
describe('AdminSubscriptionsPage', () => {
  it('should render with default pending filter', async () => {
    // Test default state
  });

  it('should filter subscriptions by status', async () => {
    // Test status filter
  });

  it('should select multiple rows and enable bulk actions', async () => {
    // Test selection
  });

  it('should open approval modal and approve subscriptions using bulkApprove', async () => {
    // Test approval flow
    // Verify calls to adminSubscriptionsService.bulkApprove
  });

  it('should open denial modal and deny subscriptions with required reason using bulkDeny', async () => {
    // Test denial flow
    // Verify calls to adminSubscriptionsService.bulkDeny
  });

  it('should display result modal after bulk operations', async () => {
    // Test that result modal shows successful/failed counts and errors
  });

  it('should open delete modal and delete subscription', async () => {
    // Test deletion flow
    // Verify calls to adminSubscriptionsService.deleteSubscription
  });

  it('should be read-only for adminReadonly users', async () => {
    // Test RBAC - approve/deny/delete buttons should be disabled
  });

  it('should hide delete action for adminReadonly users', async () => {
    // Test that delete option is not available without admin:subscriptions:delete
  });
});
```

**File:** `frontend/src/test/pages/SubscriptionsPage.test.tsx`

```typescript
describe('SubscriptionsPage - Approval Workflow', () => {
  it('should display pending badge for pending subscriptions', async () => {
    // Test pending display
  });

  it('should display denied badge with request review button', async () => {
    // Test denied display
  });

  it('should request review when button clicked', async () => {
    // Test re-request flow
  });

  it('should show status reason in details modal', async () => {
    // Test reason display
  });
});
```

---

### Phase 10: Documentation

#### 10.1 User/Admin Documentation

**File:** `docs/features/subscription-approval-workflow.md` (NEW)

```markdown
# Subscription Approval Workflow

## For Users

### Subscribing to Restricted Models

1. Browse model catalog - restricted models have an orange "Restricted Access" badge
2. Click "Subscribe" on a restricted model
3. Subscription created in "Pending" state
4. Wait for admin approval (you'll see "Pending Approval" in My Subscriptions)
5. Upon approval, subscription becomes "Active" - manually add model to API keys
6. Upon denial, subscription shows "Access Denied" with admin's reason

### Re-requesting Access

If your request was denied:

1. Go to My Subscriptions
2. Find the denied subscription
3. Click "Request Review" button
4. Request moves back to "Pending" for admin review

## For Administrators

### Viewing Subscription Requests

1. Navigate to Admin → Subscription Requests
2. By default, only pending requests are shown
3. Use filters to find specific requests:
   - Status (pending, active, denied)
   - Model
   - User
   - Date range

### Approving Requests

**Single Approval:**

1. Click row actions menu (⋮)
2. Select "Approve"
3. Optionally add comment
4. Confirm

**Bulk Approval:**

1. Select multiple requests using checkboxes
2. Click "Approve Selected"
3. Optionally add comment (applies to all)
4. Confirm

### Denying Requests

**Single Denial:**

1. Click row actions menu (⋮)
2. Select "Deny"
3. Enter required reason
4. Confirm

**Bulk Denial:**

1. Select multiple requests using checkboxes
2. Click "Deny Selected"
3. Enter required reason (applies to all)
4. Confirm

### Reverting Decisions

1. Find the subscription in the list
2. Click row actions menu (⋮)
3. Select "Revert Status"
4. Choose new status
5. Optionally add reason
6. Confirm

### Deleting Subscriptions (Admin Only)

⚠️ **Warning**: This action permanently deletes the subscription and cannot be undone.

**Requirements**: Admin role with `admin:subscriptions:delete` permission (not available to adminReadonly)

1. Find the subscription in the list
2. Click row actions menu (⋮)
3. Select "Delete Subscription"
4. Optionally enter reason (saved in audit log)
5. Confirm deletion
6. Subscription is permanently removed from database

**Use Cases**:

- Removing test/duplicate subscriptions
- Cleaning up obsolete subscription requests
- Administrative data management

**Note**: All deletion actions are logged in the audit trail with the admin user ID and optional reason.

### Marking Models as Restricted

1. Navigate to Admin → Models
2. Edit existing model or create new one
3. Check "Require Admin Approval"
4. If model has active subscriptions, confirm cascade:
   - Active subscriptions → Pending
   - Model removed from all API keys
5. Save

## Status Flow Diagram
```

          Subscribe to Restricted Model
                    ↓
                 PENDING
                    ↓
          ┌─────────┴─────────┐
          ↓                   ↓
       APPROVED            DENIED
       (Active)               ↓
                       Request Review
                              ↓
                          PENDING

```

```

#### 10.2 API Documentation Updates

**File:** `docs/api/rest-api.md`

Add documentation for all new endpoints with request/response examples.

#### 10.3 Database Schema Documentation

**File:** `docs/architecture/database-schema.md`

Document new columns and tables:

- `models.restricted_access`
- `subscriptions.status_reason`, `status_changed_at`, `status_changed_by`
- `subscription_status_history` table

---

## Summary

This implementation plan provides a complete, production-ready subscription approval workflow for restricted models. Key features include:

✅ Admin-controlled model access with visual indicators
✅ Comprehensive admin panel with filtering and bulk operations
✅ User-friendly re-request flow for denied subscriptions
✅ Full audit trail for compliance
✅ Automatic cascade when marking models as restricted
✅ RBAC enforcement with granular permissions (read/write/delete)
✅ Subscription deletion capability with audit logging
✅ Complete i18n support (9 languages)
✅ Comprehensive test coverage
✅ Future-proof notification hooks

**Implementation Status:** Completed (Phases 0-8 implemented and deployed).

---

## Review Notes & Design Decisions

This section documents critical design decisions made during the technical review process:

### Security-First Design

1. **LiteLLM Update Order**: LiteLLM updates execute BEFORE database changes to ensure access revocation takes priority over record-keeping
2. **System User UUID**: Fixed UUID `00000000-0000-0000-0000-000000000001` for audit trail integrity
3. **Duplicate Prevention**: Unique constraint `(user_id, model_id)` enforced at database level

### State Management

4. **Model Unrestriction**: Pending subscriptions auto-approve when model restriction removed
5. **State Transitions**: Validation ensures only meaningful transitions (active↔denied, denied↔pending, active→pending)
6. **Idempotent Request-Review**: Safe to call multiple times (pending→pending is no-op)

### Concurrency & Performance

7. **No Optimistic Locking**: Implementation does not use optimistic locking - updates performed directly
8. **Manual Refresh**: No polling - admin must manually refresh to see updates (reduces server load)
9. **Empty State Handling**: Auto-switch to "all statuses" when pending filter returns 0 results

### User Experience

10. **Bulk Operation Results**: Always display modal with detailed success/failure breakdown
11. **Subscribe Button**: Disabled when subscription exists (any status) - use Request Review instead
12. **Validation**: Both `createApiKey` and `updateApiKey` enforce active subscription requirement

### Future-Proofing

13. **Notification Hooks**: `NotificationService` with async placeholders ready for external integration
14. **No Rate Limiting**: Deliberately omitted in v1 (can be added later if needed)
15. **Migration Strategy**: Existing subscriptions migrate gracefully with system user attribution

### Additional Features

16. **Subscription Deletion**: Admin-only DELETE endpoint with `admin:subscriptions:delete` permission for permanent removal
17. **Return Type Structure**: Bulk operations return `{ successful, failed, errors }` with detailed error tracking
18. **Service Method Naming**: Frontend uses `bulkApprove`/`bulkDeny` for clarity in bulk operations

**Implementation Status:** Completed (Phases 0-8 implemented and deployed).

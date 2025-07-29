# Migration Notes

## API Key Deletion Workflow Change (January 2025)

### Overview
Changed the API key management workflow from "revoke" (soft delete) to "delete" (hard delete) to permanently remove API keys from both LiteMaaS and LiteLLM databases.

### Problem
- API keys were previously only marked as revoked (`is_active = false`, `revoked_at = timestamp`) but remained in the database
- This caused storage bloat and potential security concerns with inactive keys persisting
- User expectation was that "delete" would completely remove the key

### Changes Made

#### 1. Backend Service Update (`backend/src/services/api-key.service.ts`)
- Replaced `revokeApiKey()` method with `deleteApiKey()` method
- Changed from UPDATE query to DELETE query for permanent removal
- Updated audit log action from `API_KEY_REVOKE` to `API_KEY_DELETE`
- Enhanced audit log metadata to include key name and prefix for better tracking

**Before:**
```sql
UPDATE api_keys
SET is_active = false, revoked_at = CURRENT_TIMESTAMP
WHERE id = $1
```

**After:**
```sql
DELETE FROM api_keys WHERE id = $1
```

#### 2. API Route Update (`backend/src/routes/api-keys.ts`)
- Updated DELETE `/:id` endpoint response from `revokedAt` to `deletedAt`
- Changed endpoint description from "Revoke API key" to "Delete API key"
- Updated response message from "revoked successfully" to "deleted successfully"

#### 3. Frontend Updates
- Updated API service method from `revokeApiKey()` to `deleteApiKey()`
- Changed UI button text from "Revoke" to "Delete"
- Updated modal title from "Revoke API Key" to "Delete API Key"
- Modified confirmation dialog styling to use danger variant instead of warning
- Updated success notification from "API Key Revoked" to "API Key Deleted"

#### 4. Documentation Updates
- Updated REST API documentation to reflect deletion behavior
- Added warnings about permanent deletion and immediate access termination
- Updated authentication documentation references

### Migration Impact
- **Existing API keys**: No database migration required - existing revoked keys remain as-is for historical purposes
- **New deletions**: All future API key deletions will be permanent
- **Audit trail**: Deletion actions are still logged in `audit_logs` table with enhanced metadata
- **LiteLLM integration**: Keys are still removed from LiteLLM as before

### Testing
Verified the changes work by:
1. Deleting an API key through the UI
2. Confirming it's completely removed from the database
3. Verifying LiteLLM integration still removes the key
4. Checking audit log entry is created with proper metadata

### Breaking Changes
- API clients expecting `revokedAt` field should update to use `deletedAt`
- Frontend components expecting "revoke" terminology should update to "delete"

## API Keys user_id Column Fix (January 2025)

### Overview
Fixed a critical issue where API keys were failing to create in the database due to a missing `user_id` value in the INSERT query, despite the column being NOT NULL in the database schema.

### Problem
- API keys were successfully created in LiteLLM but failed to insert into the database
- Error: `null value in column "user_id" of relation "api_keys" violates not-null constraint`
- The `user_id` was passed to the service method but not included in the INSERT query

### Changes Made

#### 1. Database Service Update (`backend/src/services/api-key.service.ts`)
- Updated the INSERT query to include the `user_id` column
- Added `userId` to the parameters array at position $2
- Updated the `mapToEnhancedApiKey` method to include `userId` in the response

**Before:**
```sql
INSERT INTO api_keys (
  subscription_id, name, key_hash, key_prefix, 
  expires_at, is_active, lite_llm_key_id,
  max_budget, current_spend, tpm_limit, rpm_limit,
  last_sync_at, sync_status
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
```

**After:**
```sql
INSERT INTO api_keys (
  subscription_id, user_id, name, key_hash, key_prefix, 
  expires_at, is_active, lite_llm_key_id,
  max_budget, current_spend, tpm_limit, rpm_limit,
  last_sync_at, sync_status
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
```

#### 2. TypeScript Interface Update (`backend/src/types/api-key.types.ts`)
- Added `userId: string` to the `ApiKey` interface to ensure type safety

#### 3. Documentation Updates
- Updated database schema documentation to explicitly show `user_id` column in api_keys table
- Updated API documentation to include `userId` in API key response examples

### Migration Steps
For existing deployments, no database migration is needed as the `user_id` column already exists in the schema. The fix only affects the application code.

### Testing
Verified the fix works by:
1. Creating a new API key through the API
2. Confirming it creates successfully in both LiteLLM and the database
3. Verifying the response includes the userId field

### Impact
- Resolves API key creation failures
- Ensures proper user ownership tracking for API keys
- Maintains referential integrity with the users table
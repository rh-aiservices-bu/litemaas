# Migration Notes

## API Keys user_id Column Fix (July 2025)

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
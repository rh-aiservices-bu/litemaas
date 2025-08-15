# LiteLLM Integration Architecture

## Overview

LiteMaaS integrates with LiteLLM as its core proxy service for managing AI model access, user authentication, API key generation, and usage tracking. This document describes the integration architecture and key workflows.

## Core Integration Points

### 1. User Management

#### User Creation Flow

1. User authenticates via OAuth
2. LiteMaaS creates user in local database with UUID
3. User is created in LiteLLM using the same UUID as `user_id`
4. User is automatically assigned to the Default Team
5. No separate `lite_llm_user_id` needed - the user's ID is used directly

#### User Existence Detection

- **Problem**: LiteLLM's `/user/info` endpoint returns HTTP 200 for any user_id
- **Solution**: Check if user has teams assigned - empty teams array means user doesn't exist
- **Default Team**: All users are assigned to team `a0000000-0000-4000-8000-000000000001`

### 2. API Key Management

#### Key Creation Process

1. User requests API key creation in LiteMaaS
2. LiteMaaS generates key in LiteLLM with:
   - Unique key alias (format: `user_chosen_name_XXXXXXXX`)
   - Model associations
   - Budget and rate limits
3. LiteLLM returns the actual key value (format: `sk-...XXXX`)
4. LiteMaaS stores the key value in `lite_llm_key_value` column

#### Key Structure in LiteLLM

```json
{
  "token": "internal-token-hash", // Internal LiteLLM token for tracking
  "key_name": "sk-...XXXX", // Last 4 chars of actual key
  "key_alias": "production-key_a5f2b1c3", // User's name + UUID suffix
  "models": ["gpt-4", "claude-3"],
  "metadata": {
    "created_by": "litemaas",
    "model_count": 2
  }
}
```

### 3. Usage Tracking

#### The Multi-Step Process

**Critical**: LiteLLM's `/user/daily/activity` endpoint requires an internal token, not the API key value.

##### Step 1: Get User Info with Keys

```http
GET /user/info?user_id={userId}
```

Returns full user information including all API keys with their internal tokens.

##### Step 2: Match API Key

- Extract last 4 characters from `lite_llm_key_value` stored in database
- Find matching key in response where `key_name` ends with same 4 characters
- Extract the `token` field from matched key

##### Step 3: Query Usage

```http
GET /user/daily/activity?api_key={token}&start_date=2025-07-28&end_date=2025-08-04
```

Use the internal token (not the API key) for usage queries.

#### Implementation Details

```typescript
// In LiteLLMService
async getApiKeyToken(userId: string, liteLLMKeyValue: string): Promise<string | null> {
  // Get full user info
  const userInfo = await this.getUserInfoFull(userId);

  // Match by last 4 characters
  const last4Chars = liteLLMKeyValue.slice(-4);
  const matchingKey = userInfo.keys.find(key =>
    key.key_name?.slice(-4) === last4Chars
  );

  return matchingKey?.token || null;
}
```

### 4. Model Synchronization

#### Sync Process

1. On startup, LiteMaaS queries `/model/info` from LiteLLM
2. Models are mapped to local database:
   - `model_name` → `id`, `name`
   - `litellm_params.custom_llm_provider` → `provider`
   - `model_info.max_tokens` → `context_length`
   - Cost information → `input_cost_per_token`, `output_cost_per_token`
3. Models are marked as available for subscription

### 5. Team Management

#### Default Team Implementation

- **UUID**: `a0000000-0000-4000-8000-000000000001`
- **Purpose**: Ensures all users have team membership for existence detection
- **Models**: Empty array `[]` grants access to all models
- **Auto-assignment**: All user creation flows assign default team

## Service Architecture

### LiteLLMService Class

Key methods:

- `getUserInfo()`: Returns basic user info
- `getUserInfoFull()`: Returns complete info with keys array
- `getApiKeyToken()`: Matches API key and returns internal token
- `getDailyActivity()`: Fetches usage data using internal token
- `createUser()`: Creates user with default team assignment
- `generateKey()`: Creates API key with unique alias

### Usage Stats Service Integration

The usage stats service coordinates between:

1. Frontend requests with API key selection
2. Database queries for key metadata
3. LiteLLM API for actual usage data
4. Fallback to local database if LiteLLM unavailable

## Error Handling

### Common Patterns

#### User Already Exists

```typescript
if (error.message?.includes('already exists')) {
  // User exists - continue with operation
  // Update sync status to 'synced'
}
```

#### Key Alias Conflicts

- Append UUID suffix to ensure uniqueness
- Format: `user_chosen_name_XXXXXXXX`

#### Missing Usage Data

- Fallback to local database queries
- Return mock data in development mode
- Cache successful responses for 5 minutes

## Configuration

### Environment Variables

```bash
LITELLM_API_URL=http://localhost:4000
LITELLM_API_KEY=sk-1104
```

### Mock Mode

- Enable with `NODE_ENV=development`
- Returns realistic mock data for all endpoints
- Useful for frontend development without LiteLLM

## Migration Notes

### Recent Changes

1. **Removed `lite_llm_user_id` column**:
   - User's UUID is used directly as LiteLLM user_id
   - Simplified user creation and sync processes

2. **Fixed usage tracking**:
   - Now correctly uses internal tokens for API usage queries
   - Matches keys by last 4 characters of key value

3. **Default team implementation**:
   - All users assigned to default team
   - Empty models array grants full access
   - Reliable user existence detection

## Troubleshooting

### Usage Data Not Showing

1. Check API key has `lite_llm_key_value` populated
2. Verify user exists in LiteLLM with teams assigned
3. Confirm key matching by last 4 characters works
4. Check LiteLLM logs for token validation

### User Creation Failures

1. Ensure default team exists in LiteLLM
2. Check for email uniqueness conflicts
3. Verify budget and rate limit values are valid
4. Review LiteLLM API response for specific errors

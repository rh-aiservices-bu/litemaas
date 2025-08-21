# LiteLLM Integration Architecture

## Overview

LiteMaaS integrates with LiteLLM as its core proxy service for managing AI model access, user authentication, API key generation, and usage tracking. This document describes the integration architecture, key workflows, and provides a complete API reference for potential migration to alternative engines.

## LiteLLM API Endpoint Reference

The following table lists all LiteLLM endpoints currently used by LiteMaaS:

| Endpoint               | Method | Purpose                   | Used By                                |
| ---------------------- | ------ | ------------------------- | -------------------------------------- |
| `/model/info`          | GET    | Fetch available models    | Model sync, model listing              |
| `/health/liveliness`   | GET    | Check service health      | Health monitoring                      |
| `/user/new`            | POST   | Create new user           | User registration                      |
| `/user/info`           | GET    | Get user information      | User existence check, key token lookup |
| `/user/update`         | POST   | Update user properties    | User profile updates                   |
| `/key/generate`        | POST   | Generate new API key      | API key creation                       |
| `/key/list`            | GET    | List user's API keys      | Key token lookup by alias              |
| `/key/info`            | GET    | Get API key details       | Key validation, spend tracking         |
| `/key/update`          | POST   | Update API key properties | Budget/limit updates                   |
| `/key/delete`          | POST   | Delete API keys           | Key cleanup                            |
| `/team/new`            | POST   | Create new team           | Team creation                          |
| `/team/info`           | GET    | Get team details          | Team info, spend tracking              |
| `/user/daily/activity` | GET    | Get usage statistics      | Usage analytics                        |

## Detailed Endpoint Documentation

### Model Management

#### `GET /model/info`

**Purpose**: Fetch available AI models from LiteLLM with optional team filtering

**Query Parameters**:

- `team_id` (optional): Filter models by team access

**Response Format**:

```json
{
  "data": [
    {
      "model_name": "gpt-4o",
      "litellm_params": {
        "input_cost_per_token": 0.01,
        "output_cost_per_token": 0.03,
        "custom_llm_provider": "openai",
        "model": "openai/gpt-4o"
      },
      "model_info": {
        "id": "gpt-4o-id",
        "db_model": true,
        "max_tokens": 128000,
        "supports_function_calling": true,
        "supports_vision": true,
        "direct_access": true,
        "access_via_team_ids": []
      }
    }
  ]
}
```

**Usage**: Called during startup for model synchronization and by model listing endpoints

#### `GET /health/liveliness`

**Purpose**: Check LiteLLM service health status

**Response Format**:

```json
{
  "status": "healthy",
  "db": "connected",
  "redis": "connected",
  "litellm_version": "1.74.3"
}
```

**Usage**: Health monitoring and service status checks

### User Management

#### `POST /user/new`

**Purpose**: Create a new user in LiteLLM with budget and team assignment

**Request Body**:

```json
{
  "user_id": "uuid-string",
  "user_email": "user@example.com",
  "user_alias": "Display Name",
  "user_role": "internal_user",
  "teams": ["a0000000-0000-4000-8000-000000000001"],
  "max_budget": 100.0,
  "models": [],
  "tpm_limit": 1000,
  "rpm_limit": 60,
  "auto_create_key": false,
  "budget_duration": "monthly"
}
```

**Response Format**:

```json
{
  "user_id": "uuid-string",
  "user_email": "user@example.com",
  "user_alias": "Display Name",
  "user_role": "internal_user",
  "teams": ["a0000000-0000-4000-8000-000000000001"],
  "max_budget": 100.0,
  "spend": 0,
  "models": [],
  "tpm_limit": 1000,
  "rpm_limit": 60,
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Critical Behavior**: Users are automatically assigned to Default Team (`a0000000-0000-4000-8000-000000000001`)

#### `GET /user/info?user_id={userId}`

**Purpose**: Get user information, with enhanced version returning API keys

**Query Parameters**:

- `user_id` (required): User UUID

**Response Format (Basic)**:

```json
{
  "user_id": "uuid-string",
  "user_alias": "Display Name",
  "user_role": "internal_user",
  "teams": ["a0000000-0000-4000-8000-000000000001"],
  "max_budget": 100.0,
  "spend": 25.5,
  "models": [],
  "tpm_limit": 1000,
  "rpm_limit": 60,
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Response Format (Full - with keys)**:

```json
{
  "user_id": "uuid-string",
  "user_info": {
    /* Basic user info */
  },
  "keys": [
    {
      "token": "internal-token-hash",
      "key_name": "sk-...XXXX",
      "key_alias": "production-key_a5f2b1c3",
      "spend": 10.5,
      "models": ["gpt-4"],
      "user_id": "uuid-string",
      "metadata": {},
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "teams": [
    /* Team details */
  ]
}
```

**Critical Behavior**: Empty `teams` array indicates user doesn't exist (LiteLLM returns HTTP 200 for any user_id)

#### `POST /user/update`

**Purpose**: Update user properties like budget and limits

**Request Body**:

```json
{
  "user_id": "uuid-string",
  "max_budget": 200.0,
  "tpm_limit": 2000,
  "rpm_limit": 120
}
```

### API Key Management

#### `POST /key/generate`

**Purpose**: Generate new API key with associated models and limits

**Request Body**:

```json
{
  "key_alias": "production-key_a5f2b1c3",
  "user_id": "uuid-string",
  "team_id": "a0000000-0000-4000-8000-000000000001",
  "models": ["gpt-4", "claude-3"],
  "max_budget": 50.0,
  "tpm_limit": 1000,
  "rpm_limit": 60,
  "duration": "30d",
  "metadata": {
    "created_by": "litemaas",
    "model_count": 2
  }
}
```

**Response Format**:

```json
{
  "key": "sk-litellm-abc123def456...",
  "key_name": "production-key_a5f2b1c3",
  "user_id": "uuid-string",
  "team_id": "a0000000-0000-4000-8000-000000000001",
  "max_budget": 50.0,
  "current_spend": 0,
  "created_by": "litemaas",
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Critical Behavior**: Key alias must be unique; append UUID suffix if conflicts occur

#### `GET /key/list`

**Purpose**: List API keys for a user (used for token lookup by alias)

**Query Parameters**:

- `user_id` (required): User UUID
- `return_full_object`: "true"
- `include_team_keys`: "false"
- `page`: "1"
- `size`: "100"

**Usage**: Finding internal token by matching key alias

#### `GET /key/info`

**Purpose**: Get API key details and current spend

**Headers**:

- `x-litellm-api-key`: The actual API key value

**Response Format**:

```json
{
  "key_name": "production-key",
  "spend": 25.5,
  "max_budget": 50.0,
  "models": ["gpt-4", "claude-3"],
  "tpm_limit": 1000,
  "rpm_limit": 60,
  "user_id": "uuid-string",
  "expires": "2025-02-01T00:00:00Z",
  "budget_reset_at": "2025-02-01T00:00:00Z"
}
```

#### `POST /key/update`

**Purpose**: Update API key properties

**Request Body**:

```json
{
  "key": "sk-litellm-abc123def456...",
  "max_budget": 100.0,
  "tpm_limit": 2000,
  "models": ["gpt-4", "claude-3", "gpt-4o"]
}
```

#### `POST /key/delete`

**Purpose**: Delete one or more API keys

**Request Body**:

```json
{
  "keys": ["sk-litellm-abc123def456..."]
}
```

### Team Management

#### `POST /team/new`

**Purpose**: Create a new team with budget and model access

**Request Body**:

```json
{
  "team_id": "uuid-string",
  "team_alias": "Development Team",
  "max_budget": 1000.0,
  "models": [],
  "tpm_limit": 10000,
  "rpm_limit": 500,
  "budget_duration": "monthly",
  "admins": ["admin-user-id"]
}
```

**Critical Behavior**: Empty `models` array grants access to all models

#### `GET /team/info?team_id={teamId}`

**Purpose**: Get team details including current spend

**Query Parameters**:

- `team_id` (required): Team UUID

**Response Format**:

```json
{
  "team_id": "uuid-string",
  "team_alias": "Development Team",
  "max_budget": 1000.0,
  "spend": 150.75,
  "models": [],
  "tpm_limit": 10000,
  "rpm_limit": 500,
  "admins": ["admin-user-id"],
  "members": ["user1", "user2"],
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Usage Tracking

#### `GET /user/daily/activity`

**Purpose**: Get detailed usage statistics for cost tracking

**Query Parameters**:

- `api_key` (required): Internal LiteLLM token (NOT the API key value)
- `start_date` (optional): YYYY-MM-DD format
- `end_date` (optional): YYYY-MM-DD format

**Response Format**:

```json
{
  "metadata": {
    "total_spend": 45.3,
    "total_tokens": 125000,
    "total_prompt_tokens": 75000,
    "total_completion_tokens": 50000,
    "total_api_requests": 523
  },
  "results": [
    {
      "date": "2025-01-15",
      "metrics": {
        "spend": 12.45,
        "total_tokens": 35000,
        "api_requests": 150
      },
      "breakdown": {
        "models": {
          "gpt-4": {
            "metrics": {
              "spend": 8.5,
              "total_tokens": 15000,
              "api_requests": 50
            }
          }
        }
      }
    }
  ]
}
```

**Critical Behavior**: Requires internal token from `/user/info` response, not the API key value

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

The main service class that handles all LiteLLM API interactions with built-in caching, circuit breaker, and mock mode support.

#### Core Methods

**User Management**:

- `createUser(request)`: Creates user with default team assignment
- `getUserInfo(userId)`: Returns basic user info (checks teams array for existence)
- `getUserInfoFull(userId)`: Returns complete info with keys and teams arrays
- `updateUser(userId, updates)`: Updates user properties

**API Key Management**:

- `generateApiKey(request)`: Creates API key with unique alias and models
- `getKeyInfo(apiKey)`: Gets key details using API key as auth header
- `getKeyTokenByAlias(userId, keyAlias)`: Finds internal token by key alias
- `getApiKeyToken(userId, keyValue)`: Matches key by last 4 characters to get token
- `updateKey(apiKey, updates)`: Updates key properties
- `deleteKey(apiKey)`: Deletes API key

**Team Management**:

- `createTeam(request)`: Creates team with budget and model access
- `getTeamInfo(teamId)`: Gets team details and current spend

**Model Management**:

- `getModels(options)`: Fetches available models with optional team filtering
- `getModelById(modelId)`: Gets specific model details

**Usage Tracking**:

- `getDailyActivity(token, startDate, endDate)`: Gets usage statistics using internal token

**Health and Monitoring**:

- `getHealth()`: Checks service health status
- `validateApiKey(apiKey)`: Validates API key by attempting to get info
- `getMetrics()`: Returns service metrics and circuit breaker status
- `clearCache(pattern)`: Clears service cache
- `resetCircuitBreaker()`: Resets circuit breaker state

#### Advanced Features

**Caching**: 5-minute TTL cache for frequently accessed data (models, health, user info)

**Circuit Breaker**: Automatic failover after 5 consecutive failures, 30-second timeout

**Mock Mode**: Development mode with realistic test data when LiteLLM unavailable

**Retry Logic**: 3 retry attempts with exponential backoff for failed requests

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

## Authentication & Headers

All LiteLLM API requests require authentication via the `x-litellm-api-key` header:

```http
x-litellm-api-key: sk-1104
```

**Exception**: The `/key/info` endpoint uses the actual API key being queried as the authentication header value.

## Error Handling Patterns

### Common Error Responses

LiteLLM returns errors in this format:

```json
{
  "error": {
    "message": "Detailed error description",
    "type": "validation_error",
    "code": "INVALID_REQUEST"
  },
  "detail": "Additional context"
}
```

### Key Error Scenarios

1. **User Already Exists**: When creating a user that already exists, continue with operation and update sync status
2. **Key Alias Conflicts**: Append UUID suffix to ensure uniqueness
3. **Missing Usage Data**: Fallback to local database queries or mock data in development
4. **Circuit Breaker**: After 5 consecutive failures, service enters circuit breaker mode for 30 seconds

## Migration Requirements for Alternative Engines

This section provides requirements for implementing a LiteLLM-compatible API that can serve as a drop-in replacement.

### Required Endpoints

A replacement engine must implement all 13 endpoints listed in the API reference table with identical:

- Request/response formats
- Authentication mechanisms
- Error response structures
- Critical behaviors (detailed below)

### Critical Behaviors to Replicate

#### User Existence Detection

- `/user/info` must return HTTP 200 for any user_id
- Non-existent users must return empty `teams` array
- Existing users must have at least one team in the array

#### API Key Token System

- Keys must have both a public key (`sk-...`) and internal token
- `/user/info` response must include `keys` array with both values
- `/user/daily/activity` must accept internal token, not public key
- Key matching by last 4 characters of public key must work

#### Default Team Pattern

- Team UUID `a0000000-0000-4000-8000-000000000001` must exist
- All users must be assigned to this team automatically
- Empty `models` array must grant access to all models

#### Budget and Rate Limiting

- Support daily, weekly, monthly, yearly budget durations
- Track spend per user, team, and API key
- Enforce TPM (tokens per minute) and RPM (requests per minute) limits
- Provide budget reset mechanisms

### Data Model Requirements

#### User Object

```typescript
interface User {
  user_id: string;
  user_email?: string;
  user_alias?: string;
  user_role: 'proxy_admin' | 'internal_user' | 'internal_user_viewer';
  teams: string[];
  max_budget?: number;
  spend: number;
  models: string[];
  tpm_limit?: number;
  rpm_limit?: number;
  created_at: string;
  budget_reset_at?: string;
}
```

#### API Key Object

```typescript
interface ApiKey {
  token: string; // Internal token for usage tracking
  key_name: string; // Public key (last 4 chars visible)
  key_alias: string; // User-provided alias
  spend: number;
  max_budget?: number;
  models: string[];
  user_id: string;
  team_id?: string;
  tpm_limit?: number;
  rpm_limit?: number;
  expires?: string;
  created_at: string;
  metadata?: object;
}
```

#### Team Object

```typescript
interface Team {
  team_id: string;
  team_alias: string;
  max_budget?: number;
  spend: number;
  models: string[]; // Empty array = access to all models
  tpm_limit?: number;
  rpm_limit?: number;
  admins: string[];
  members: string[];
  created_at: string;
}
```

#### Model Object

```typescript
interface Model {
  model_name: string;
  litellm_params: {
    input_cost_per_token: number;
    output_cost_per_token: number;
    custom_llm_provider: string;
    model: string;
  };
  model_info: {
    id: string;
    max_tokens?: number;
    supports_function_calling?: boolean;
    supports_vision?: boolean;
    direct_access?: boolean;
    access_via_team_ids?: string[];
  };
}
```

### Development and Testing

#### Mock Mode Support

The replacement engine should support a mock/development mode that:

- Returns realistic test data without actual AI model integration
- Maintains the same response structures as production
- Allows frontend development without backend dependencies
- Provides consistent mock user and key data

#### Health Monitoring

Implement the `/health/liveliness` endpoint for service monitoring with:

- Database connectivity status
- Service version information
- Overall health status indicators

### Security Considerations

#### API Key Security

- Store API keys securely (hashed when possible)
- Implement key rotation capabilities
- Support key expiration and renewal
- Audit all key operations

#### Budget Protection

- Implement soft budget warnings before hard limits
- Provide spending alerts and notifications
- Support budget cooldown periods
- Track and prevent budget overruns

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

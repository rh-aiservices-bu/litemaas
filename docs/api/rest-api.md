# API Contracts

## Base URL

- Development: `http://localhost:8080`
- Production: `https://api.litemaas.com`

## API Structure

The API is organized into two main paths:

- `/api/auth/*` - OAuth authentication flow endpoints (unversioned)
- `/api/v1/*` - All versioned API endpoints

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Authentication Flow (/api/auth)

These endpoints handle OAuth authentication and must remain unversioned for OAuth provider compatibility.

#### POST /api/auth/login

Initiates OAuth flow

```json
Response:
{
  "authUrl": "https://oauth.openshift.com/oauth/authorize?..."
}
```

#### GET /api/auth/callback

OAuth callback endpoint

```
Query Parameters:
- code: OAuth authorization code
- state: OAuth state parameter

Response: Redirects to frontend with JWT token
```

#### POST /api/auth/logout

Invalidates user session

```json
Response:
{
  "message": "Logged out successfully"
}
```

### User Profile (/api/v1/auth)

Authenticated user operations that are part of the versioned API.

#### GET /api/v1/auth/me

Get current user basic info

```json
Response:
{
  "id": "uuid",
  "username": "user@example.com",
  "email": "user@example.com",
  "name": "User Name",
  "roles": ["user"]
}
```

#### GET /api/v1/auth/profile

Get current user detailed profile

```json
Response:
{
  "id": "uuid",
  "username": "user@example.com",
  "email": "user@example.com",
  "fullName": "User Full Name",
  "roles": ["user"],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Models (/api/v1/models)

#### GET /api/v1/models

List available models

```json
Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- search: string
- provider: string
- capability: string

Response:
{
  "data": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "description": "Advanced language model",
      "capabilities": ["chat", "completion"],
      "contextLength": 8192,
      "pricing": {
        "input": 0.03,
        "output": 0.06,
        "unit": "per_1k_tokens"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### GET /api/v1/models/:id

Get model details

```json
Response:
{
  "id": "gpt-4",
  "name": "GPT-4",
  "provider": "openai",
  "description": "Advanced language model",
  "capabilities": ["chat", "completion"],
  "contextLength": 8192,
  "pricing": {
    "input": 0.03,
    "output": 0.06,
    "unit": "per_1k_tokens"
  },
  "metadata": {
    "version": "0613",
    "releaseDate": "2023-06-13",
    "deprecationDate": null
  }
}
```

### Subscriptions

#### GET /api/v1/subscriptions

List user subscriptions

```json
Query Parameters:
- status: string (optional) - Filter by status (active, cancelled, suspended, expired)
- modelId: string (optional) - Filter by model ID
- page: number (default: 1)
- limit: number (default: 20)

Response:
{
  "data": [
    {
      "id": "sub_123",
      "userId": "user_123",
      "modelId": "gpt-4",
      "modelName": "GPT-4",
      "provider": "OpenAI",
      "status": "active",
      "quotaRequests": 10000,
      "quotaTokens": 1000000,
      "usedRequests": 1500,
      "usedTokens": 150000,
      "inputCostPerToken": 0.00003,
      "outputCostPerToken": 0.00006,
      "requestUtilization": 15,
      "tokenUtilization": 15,
      "estimatedMonthlyCost": 9.75,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-20T10:00:00Z",
      "expiresAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

#### GET /api/v1/subscriptions/:id

Get subscription details

```json
Response:
{
  "id": "sub_123",
  "userId": "user_123",
  "modelId": "gpt-4",
  "modelName": "GPT-4",
  "provider": "OpenAI",
  "status": "active",
  "quotaRequests": 10000,
  "quotaTokens": 1000000,
  "usedRequests": 1500,
  "usedTokens": 150000,
  "inputCostPerToken": 0.00003,
  "outputCostPerToken": 0.00006,
  "contextLength": 8192,
  "features": ["Code Generation", "Creative Writing"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z",
  "expiresAt": null
}
```

#### POST /api/v1/subscriptions

Create new subscription

```json
Request:
{
  "modelId": "gpt-4",
  "quotaRequests": 10000,      // Optional, defaults to 10K
  "quotaTokens": 1000000       // Optional, defaults to 1M
}

Response:
{
  "id": "sub_123",
  "userId": "user_123",
  "modelId": "gpt-4",
  "modelName": "GPT-4",
  "provider": "OpenAI",
  "status": "active",
  "quotaRequests": 10000,
  "quotaTokens": 1000000,
  "usedRequests": 0,
  "usedTokens": 0,
  "inputCostPerToken": 0.00003,
  "outputCostPerToken": 0.00006,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "expiresAt": null
}
```

#### PUT /api/v1/subscriptions/:id/quotas

Update subscription quotas

```json
Request:
{
  "quotaRequests": 20000,
  "quotaTokens": 2000000
}

Response:
{
  "id": "sub_123",
  "modelId": "gpt-4",
  "status": "active",
  "quotaRequests": 20000,
  "quotaTokens": 2000000,
  "usedRequests": 1500,
  "usedTokens": 150000,
  "updatedAt": "2024-01-20T10:00:00Z"
}
```

#### GET /api/v1/subscriptions/:id/pricing

Get subscription pricing information

```json
Response:
{
  "subscriptionId": "sub_123",
  "usedRequests": 1500,
  "usedTokens": 150000,
  "inputCostPerToken": 0.00003,
  "outputCostPerToken": 0.00006,
  "estimatedCost": 9.75,
  "costBreakdown": {
    "inputTokens": 75000,
    "outputTokens": 75000,
    "inputCost": 2.25,
    "outputCost": 4.50,
    "totalCost": 6.75
  },
  "billingPeriod": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  }
}
```

#### GET /api/v1/subscriptions/:id/usage

Get subscription usage and quota information

```json
Response:
{
  "subscriptionId": "sub_123",
  "quotaRequests": 10000,
  "quotaTokens": 1000000,
  "usedRequests": 1500,
  "usedTokens": 150000,
  "requestUtilization": 15,
  "tokenUtilization": 15,
  "withinRequestLimit": true,
  "withinTokenLimit": true,
  "resetDate": "2024-02-01T00:00:00Z",
  "warningThresholds": {
    "requests": 8000,
    "tokens": 800000
  }
}
```

#### POST /api/v1/subscriptions/:id/cancel

Cancel subscription

**Important**: A subscription can only be cancelled if there are no active API keys linked to it. If active API keys exist, the cancellation will be rejected with a 400 error.

**Note**: Cancelling a subscription permanently deletes it from the database. This action cannot be undone.

```json
Response (Success):
{
  "id": "sub_123",
  "userId": "user_123",
  "modelId": "gpt-4",
  "modelName": "GPT-4",
  "provider": "OpenAI",
  "status": "cancelled",
  "quotaRequests": 10000,
  "quotaTokens": 1000000,
  "usedRequests": 1500,
  "usedTokens": 150000,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z",
  "expiresAt": null
}

Response (Error - Active API Keys):
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Cannot cancel subscription: There are 2 active API keys linked to this subscription (Production Key (sk-litemaas_abc123***), Development Key (sk-litemaas_def456***)). Please delete all API keys first, then cancel the subscription."
}
```

**Cancellation Workflow**:

1. Check for linked API keys: `GET /api-keys?subscriptionId={id}`
2. Delete all active API keys: `DELETE /api-keys/{keyId}` for each key
3. Cancel subscription: `POST /subscriptions/{id}/cancel`

**Notes**:

- Only subscriptions with status `active` or `suspended` can be cancelled
- Subscriptions already `cancelled` or `expired` cannot be cancelled again
- The cancellation permanently deletes the subscription from the database and cannot be undone
- The subscription will no longer appear in subscription lists after cancellation

### API Keys

> API Keys support multi-model access with proper LiteLLM compatibility. Keys use 'sk-' prefix format and display actual key values.

#### GET /api/v1/api-keys

List user API keys with multi-model support

```json
Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- subscriptionId: string (optional) - LEGACY: Filter by subscription ID
- modelIds: string[] (optional) - NEW: Filter by model IDs
- isActive: boolean (optional) - Filter by active status

Response:
{
  "data": [
    {
      "id": "key_123",
      "name": "Production Key",
      "prefix": "sk-LaAy",                    // Shows actual LiteLLM key prefix
      "keyPreview": "sk-LaAy...",            // Shows real key preview
      "models": ["gpt-4", "gpt-3.5-turbo"],  // Array of model IDs
      "modelDetails": [                      // Detailed model information
        {
          "id": "gpt-4",
          "name": "GPT-4",
          "provider": "openai",
          "contextLength": 8192
        },
        {
          "id": "gpt-3.5-turbo",
          "name": "GPT-3.5 Turbo",
          "provider": "openai",
          "contextLength": 4096
        }
      ],
      "subscriptionId": "sub_123",           // For backward compatibility
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "expiresAt": null,
      "isActive": true,
      "isLiteLLMKey": true,                   // Indicates LiteLLM compatibility
      "metadata": {}
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### POST /api/v1/api-keys

Generate new API key with multi-model support

**Multi-Model Format** (Recommended):

```json
Request:
{
  "modelIds": ["gpt-4", "gpt-3.5-turbo"],  // Array of model IDs
  "name": "Development Key",
  "expiresAt": "2024-12-31T23:59:59Z",     // Optional
  "maxBudget": 100.00,                     // Optional
  "budgetDuration": "monthly",             // Optional: daily, weekly, monthly, yearly
  "tpmLimit": 1000,                        // Optional: tokens per minute
  "rpmLimit": 60,                          // Optional: requests per minute
  "teamId": "team_123",                    // Optional
  "tags": ["production", "api"],           // Optional
  "permissions": {                         // Optional
    "allowChatCompletions": true,
    "allowEmbeddings": false,
    "allowCompletions": true
  },
  "metadata": {                            // Optional
    "environment": "production",
    "application": "chatbot"
  }
}

Response:
{
  "id": "key_456",
  "name": "Development Key",
  "key": "sk-litellm-abcdef1234567890",      // Returns actual LiteLLM key on creation
  "keyPrefix": "sk-litellm",               // Shows correct LiteLLM prefix
  "models": ["gpt-4", "gpt-3.5-turbo"],
  "modelDetails": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "contextLength": 8192
    },
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "provider": "openai",
      "contextLength": 4096
    }
  ],
  "subscriptionId": "sub_123",             // LEGACY: For backward compatibility
  "isLiteLLMKey": true,                     // NEW: Indicates LiteLLM compatibility
  "createdAt": "2024-01-20T00:00:00Z",
  "expiresAt": "2024-12-31T23:59:59Z",
  "isActive": true,
  "metadata": {
    "environment": "production",
    "application": "chatbot"
  }
}
```

**Legacy Subscription Format** (Deprecated but supported):

```json
Request:
{
  "subscriptionId": "sub_123",             // DEPRECATED: Use modelIds instead
  "name": "Development Key"
}

Response Headers:
X-API-Deprecation-Warning: subscriptionId parameter is deprecated. Use modelIds array instead.
X-API-Migration-Guide: See /docs/api/api-migration-guide for details on upgrading to multi-model API keys.

Response:
{
  "id": "key_456",
  "name": "Development Key",
  "key": "lm_abcdef1234567890",
  "models": ["gpt-4"],                     // Derived from subscription's model
  "modelDetails": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "contextLength": 8192
    }
  ],
  "subscriptionId": "sub_123",             // Legacy field maintained
  "createdAt": "2024-01-20T00:00:00Z",
  "isActive": true
}
```

#### GET /api/v1/api-keys/:id

Get API key details with multi-model information

```json
Response:
{
  "id": "key_123",
  "name": "Production Key",
  "prefix": "lm_1234",
  "models": ["gpt-4", "gpt-3.5-turbo"],
  "modelDetails": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "contextLength": 8192
    },
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "provider": "openai",
      "contextLength": 4096
    }
  ],
  "subscriptionId": "sub_123",           // LEGACY: For backward compatibility
  "lastUsedAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": null,
  "isActive": true,
  "metadata": {
    "environment": "production"
  }
}
```

#### POST /api/v1/api-keys/:id/retrieve-key

Securely retrieve full API key value

**Security Features**:

- Requires valid JWT authentication
- Rate limited (5 requests per minute per user)
- Audit logged with user ID, timestamp, and IP address
- Only key owner can retrieve their keys

```json
Request:
POST /api-keys/key_456/retrieve-key

Response:
{
  "key": "sk-litellm-abcdef1234567890",      // The full LiteLLM API key
  "keyType": "litellm",                      // Key type for reference
  "retrievedAt": "2024-01-20T10:00:00Z"     // Timestamp of retrieval
}

Error Responses:
// Rate limit exceeded
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "retryAfter": 60
}

// Key not found or access denied
{
  "error": "Not Found",
  "message": "API key not found or access denied"
}
```

**Usage Example**:

```bash
curl -X POST "http://localhost:8080/api/api-keys/key_456/retrieve-key" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

#### POST /api/v1/api-keys/:id/rotate

Rotate API key

```json
Response:
{
  "id": "key_456",
  "key": "sk-litellm-newkey1234567890",      // Returns new LiteLLM key
  "keyPrefix": "sk-litellm",                 // Shows correct LiteLLM prefix
  "rotatedAt": "2024-01-20T10:00:00Z",
  "oldPrefix": "sk-litellm"                  // Old prefix was also LiteLLM format
}
```

#### DELETE /api/v1/api-keys/:id

Delete API key

**Important**: This permanently deletes the API key from both LiteMaaS and LiteLLM. This action cannot be undone. Applications using this key will lose access immediately.

```json
Response:
{
  "message": "API key deleted successfully",
  "deletedAt": "2024-01-20T10:00:00Z"
}
```

**Notes**:

- Only active API keys can be deleted
- The API key is completely removed from the database
- An audit log entry is created to track the deletion
- All active connections using this key will be immediately terminated

#### GET /api/v1/api-keys/:id/usage

Get API key usage statistics

```json
Response:
{
  "totalRequests": 15000,
  "requestsThisMonth": 2500,
  "lastUsedAt": "2024-01-20T09:30:00Z",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/v1/api-keys/stats

Get user API key statistics

```json
Response:
{
  "total": 10,
  "active": 8,
  "expired": 1,
  "revoked": 1,
  "bySubscription": {                    // For backward compatibility
    "sub_123": 3,
    "sub_456": 2
  },
  "byModel": {                           // Count by model
    "gpt-4": 5,
    "gpt-3.5-turbo": 7,
    "claude-3": 2
  }
}
```

#### POST /api/v1/api-keys/validate

Validate API key (admin endpoint)

```json
Request:
{
  "key": "sk-litellm-abcdef1234567890"      // Uses actual LiteLLM key format
}

Response:
{
  "isValid": true,
  "subscriptionId": "sub_123",           // For backward compatibility
  "models": ["gpt-4", "gpt-3.5-turbo"], // Array of accessible models
  "userId": "user_123",
  "keyId": "key_456",
  "reason": null
}
```

### Usage Statistics

#### GET /api/v1/usage/summary

Get usage summary

```json
Query Parameters:
- startDate: ISO date
- endDate: ISO date

Response:
{
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "totals": {
    "requests": 15000,
    "tokens": 1500000,
    "cost": 45.00
  },
  "byModel": [
    {
      "modelId": "gpt-4",
      "requests": 10000,
      "tokens": 1000000,
      "cost": 30.00
    }
  ]
}
```

#### GET /api/v1/usage/timeseries

Get usage time series

```json
Query Parameters:
- startDate: ISO date
- endDate: ISO date
- interval: hour|day|week|month
- modelId: string (optional)

Response:
{
  "interval": "day",
  "data": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "requests": 500,
      "tokens": 50000,
      "cost": 1.50
    }
  ]
}
```

#### GET /api/v1/usage/export

Export usage data

```json
Query Parameters:
- startDate: ISO date
- endDate: ISO date
- format: csv|json

Response: File download
```

### Teams

> **Default Team**: All users are automatically assigned to the Default Team (`a0000000-0000-4000-8000-000000000001`) during registration or API key creation. This team has an empty `allowed_models` array which enables access to all available models.

#### GET /api/v1/teams

List user teams

```json
Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)

Response:
{
  "data": [
    {
      "id": "a0000000-0000-4000-8000-000000000001",
      "name": "Default Team",
      "description": "Default team for all users until team management is implemented",
      "maxBudget": 10000.00,
      "currentSpend": 245.50,
      "allowedModels": [], // Empty array enables all models
      "members": [
        {
          "userId": "user_123",
          "role": "member",
          "joinedAt": "2024-01-01T00:00:00Z"
        }
      ],
      "liteLLMTeamId": "a0000000-0000-4000-8000-000000000001",
      "metadata": {
        "auto_created": true,
        "default_team": true,
        "created_by": "system"
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### POST /api/v1/teams

Create new team

```json
Request:
{
  "name": "New Team",
  "description": "Team description",
  "maxBudget": 500.00
}

Response:
{
  "id": "team_456",
  "name": "New Team",
  "description": "Team description",
  "maxBudget": 500.00,
  "currentSpend": 0.00,
  "liteLLMTeamId": "litellm_team_789",
  "createdAt": "2024-01-20T10:00:00Z"
}
```

#### POST /api/v1/teams/:id/sync

Sync team with LiteLLM

```json
Request:
{
  "forceSync": true,
  "syncBudget": true,
  "syncMembers": true,
  "syncUsage": true
}

Response:
{
  "success": true,
  "syncedAt": "2024-01-20T10:00:00Z",
  "changes": {
    "budget": "updated",
    "members": "no_changes",
    "usage": "updated"
  }
}
```

### Integration

#### GET /api/v1/integration/health

LiteLLM integration health check

```json
Response:
{
  "liteLLMConnection": {
    "status": "healthy",
    "responseTime": 45,
    "lastChecked": "2024-01-20T10:00:00Z"
  },
  "syncStatus": {
    "lastGlobalSync": "2024-01-20T09:00:00Z",
    "nextScheduledSync": "2024-01-20T11:00:00Z",
    "pendingSyncs": 0,
    "failedSyncs": 1
  },
  "dataConsistency": {
    "usersInSync": 10,
    "usersOutOfSync": 2,
    "teamsInSync": 5,
    "teamsOutOfSync": 1
  }
}
```

#### POST /api/v1/integration/sync

Perform global synchronization

```json
Request:
{
  "forceSync": false,
  "syncUsers": true,
  "syncTeams": true,
  "syncSubscriptions": true,
  "syncApiKeys": true,
  "syncModels": true,
  "userId": "user_123",  // Optional: sync specific user
  "teamId": "team_456"   // Optional: sync specific team
}

Response:
{
  "syncId": "sync-1642674000-abc123",
  "startedAt": "2024-01-20T10:00:00Z",
  "completedAt": "2024-01-20T10:02:15Z",
  "success": true,
  "results": {
    "users": {
      "total": 12,
      "synced": 10,
      "errors": 2
    },
    "teams": {
      "total": 6,
      "synced": 5,
      "errors": 1
    },
    "models": {
      "total": 25,
      "synced": 25,
      "errors": 0
    }
  },
  "duration": 135000
}
```

#### GET /api/v1/integration/alerts

Get system alerts

```json
Response:
{
  "alerts": [
    {
      "type": "budget_alert",
      "severity": "high",
      "message": "Budget utilization at 92%",
      "createdAt": "2024-01-20T10:00:00Z",
      "entityId": "team_123"
    },
    {
      "type": "sync_failure",
      "severity": "medium",
      "message": "3 sync failures detected",
      "createdAt": "2024-01-20T09:30:00Z"
    }
  ]
}
```

### Health & Status

#### GET /api/v1/health

Health check

```json
Response:
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:00:00Z",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "litellm": "healthy"
  }
}
```

#### GET /api/v1/metrics

Prometheus metrics

```
Response: Prometheus format metrics
```

## Error Responses

All errors follow consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "modelId",
      "reason": "Model not found"
    }
  },
  "requestId": "req_123456"
}
```

### Error Codes

- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data
- `QUOTA_EXCEEDED`: Usage quota exceeded
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

Default limits:

- Anonymous: 10 requests/minute
- Authenticated: 100 requests/minute
- Per API Key: Configurable

Headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

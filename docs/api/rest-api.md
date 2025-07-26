# API Contracts

## Base URL
- Development: `http://localhost:8080/api`
- Production: `https://api.litemaas.com/api`

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Authentication

#### POST /auth/login
Initiates OAuth flow
```json
Response:
{
  "authUrl": "https://oauth.openshift.com/oauth/authorize?..."
}
```

#### GET /auth/callback
OAuth callback endpoint
```
Query Parameters:
- code: OAuth authorization code
- state: OAuth state parameter

Response: Redirects to frontend with JWT token
```

#### POST /auth/logout
Invalidates user session
```json
Response:
{
  "message": "Logged out successfully"
}
```

#### GET /auth/profile
Get current user profile
```json
Response:
{
  "id": "uuid",
  "username": "user@example.com",
  "email": "user@example.com",
  "roles": ["user"],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Models

#### GET /models
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

#### GET /models/:id
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

#### GET /subscriptions
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

#### GET /subscriptions/:id
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

#### POST /subscriptions
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

#### PUT /subscriptions/:id/quotas
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

#### GET /subscriptions/:id/pricing
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

#### GET /subscriptions/:id/usage
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

#### POST /subscriptions/:id/cancel
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

#### GET /api-keys
List user API keys
```json
Response:
{
  "data": [
    {
      "id": "key_123",
      "name": "Production Key",
      "prefix": "lm_1234",
      "subscriptionId": "sub_123",
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api-keys
Generate new API key
```json
Request:
{
  "subscriptionId": "sub_123",
  "name": "Development Key"
}

Response:
{
  "id": "key_456",
  "name": "Development Key",
  "key": "lm_abcdef1234567890",
  "subscriptionId": "sub_123",
  "createdAt": "2024-01-20T00:00:00Z"
}
```

#### POST /api-keys/:id/rotate
Rotate API key
```json
Response:
{
  "id": "key_456",
  "key": "lm_newkey1234567890",
  "rotatedAt": "2024-01-20T10:00:00Z"
}
```

#### DELETE /api-keys/:id
Revoke API key
```json
Response:
{
  "message": "API key revoked successfully"
}
```

### Usage Statistics

#### GET /usage/summary
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

#### GET /usage/timeseries
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

#### GET /usage/export
Export usage data
```json
Query Parameters:
- startDate: ISO date
- endDate: ISO date
- format: csv|json

Response: File download
```

### Teams

#### GET /teams
List user teams
```json
Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)

Response:
{
  "data": [
    {
      "id": "team_123",
      "name": "Development Team",
      "description": "Main development team",
      "maxBudget": 1000.00,
      "currentSpend": 245.50,
      "members": [
        {
          "userId": "user_123",
          "role": "admin",
          "joinedAt": "2024-01-01T00:00:00Z"
        }
      ],
      "liteLLMTeamId": "litellm_team_456",
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

#### POST /teams
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

#### POST /teams/:id/sync
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

#### GET /integration/health
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

#### POST /integration/sync
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

#### GET /integration/alerts
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

#### GET /health
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

#### GET /metrics
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
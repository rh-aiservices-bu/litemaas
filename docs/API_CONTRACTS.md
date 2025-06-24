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
Response:
{
  "data": [
    {
      "id": "sub_123",
      "userId": "user_123",
      "modelId": "gpt-4",
      "status": "active",
      "quota": {
        "requests": 10000,
        "tokens": 1000000
      },
      "usage": {
        "requests": 5000,
        "tokens": 500000
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "expiresAt": "2024-12-31T23:59:59Z"
    }
  ]
}
```

#### POST /subscriptions
Create new subscription
```json
Request:
{
  "modelId": "gpt-4",
  "quota": {
    "requests": 10000,
    "tokens": 1000000
  }
}

Response:
{
  "id": "sub_123",
  "userId": "user_123",
  "modelId": "gpt-4",
  "status": "active",
  "quota": {
    "requests": 10000,
    "tokens": 1000000
  },
  "apiKey": {
    "id": "key_123",
    "key": "lm_1234567890abcdef",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

#### PATCH /subscriptions/:id
Update subscription
```json
Request:
{
  "quota": {
    "requests": 20000,
    "tokens": 2000000
  }
}

Response:
{
  "id": "sub_123",
  "status": "active",
  "quota": {
    "requests": 20000,
    "tokens": 2000000
  }
}
```

#### DELETE /subscriptions/:id
Cancel subscription
```json
Response:
{
  "message": "Subscription cancelled successfully"
}
```

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
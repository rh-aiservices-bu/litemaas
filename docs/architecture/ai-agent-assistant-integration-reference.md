# AI Agent Assistant — Integration Reference

> **Status**: Companion to [ai-agent-assistant.md](ai-agent-assistant.md)
> **Last Updated**: 2026-04-27
> **Purpose**: Self-contained reference for the agent project — everything it needs to know about the systems it integrates with

---

## 1. Introduction

This document is a companion to the [AI Agent Assistant Architecture](ai-agent-assistant.md). While the architecture doc describes *how the agent works*, this document describes *what the agent talks to*.

The agent project lives in a separate repository. This reference provides all the information needed to implement tools, validate JWTs, and build the frontend widget without reading the LiteMaaS source code.

**When to update this document**: Any time a LiteMaaS API endpoint changes its response shape, a new endpoint is added that the agent should call, or the authentication mechanism changes.

---

## 2. JWT Authentication

### 2.1 Current Implementation (HS256)

> **Note**: The architecture document references `JWT_PUBLIC_KEY` and assumes asymmetric signing (RS256). The **actual LiteMaaS implementation** uses **HS256 (HMAC-SHA256) with a symmetric `JWT_SECRET`**.
>
> **For the PoC**: The agent receives the same `JWT_SECRET` as LiteMaaS. This is acceptable for a proof-of-concept — both containers are in the same trusted network and deployment.
>
> **For production hardening**: Migrate LiteMaaS to RS256 (asymmetric) so the agent only needs the public key for validation. This eliminates the risk of token forgery if the agent container is compromised. Update the architecture doc's `JWT_PUBLIC_KEY` / `JWT_AUDIENCE` references at that time.

**Algorithm**: HS256 (HMAC-SHA256, symmetric)
**Secret**: `JWT_SECRET` environment variable
**Default Expiration**: 24 hours (configurable via `JWT_EXPIRES_IN`)

### 2.2 Token Claims

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "username": "alice",
  "email": "alice@example.com",
  "roles": ["user"],
  "iat": 1714200000,
  "exp": 1714286400
}
```

| Claim | Type | Description |
|---|---|---|
| `userId` | `string` (UUID) | User's unique identifier. This is what the agent injects as `LETTA_USER_ID` |
| `username` | `string` | User's login name (from OAuth provider) |
| `email` | `string` | User's email address |
| `roles` | `string[]` | Array of role values (see [Section 2.3](#23-role-system)) |
| `iat` | `number` | Issued-at timestamp (seconds since epoch) |
| `exp` | `number` | Expiration timestamp (seconds since epoch) |

### 2.3 Role System

**Role values** (from most to least privileged):

| Role | Description | Permissions |
|---|---|---|
| `admin` | Full system access | Manage users, models, view all analytics, approve subscriptions |
| `admin-readonly` | Read-only admin access | View all data but cannot modify |
| `user` | Standard user | Manage own API keys and subscriptions |
| `readonly` | Read-only user | View own data only |

**Role hierarchy**: `admin` > `admin-readonly` > `user` > `readonly`

**How roles are determined** (merged from three sources):

1. **OAuth group mapping** — Groups from the identity provider are mapped to roles:
   ```
   litemaas-admins     → [admin, user]
   administrators      → [admin, user]
   litemaas-users      → [user]
   developers          → [user]
   litemaas-readonly   → [admin-readonly, user]
   viewers             → [admin-readonly, user]
   ```

2. **Initial admin users** — Usernames listed in `INITIAL_ADMIN_USERS` env var get `[admin, user]` on first login

3. **Database-stored roles** — Roles persisted in the `users.roles` column, preserved across logins

The `user` role is always present as a base role. All sources are merged (union).

**For the agent proxy**: To determine if a user is admin, check if `roles` array contains `"admin"`. For admin-readonly, check for `"admin-readonly"`.

### 2.4 Python Validation

```python
import jwt

def validate_litemaas_token(token: str, secret: str) -> dict | None:
    """Validate a LiteMaaS JWT token.

    Args:
        token: The JWT token string (from Authorization: Bearer <token>)
        secret: The JWT_SECRET shared with LiteMaaS

    Returns:
        Decoded payload dict if valid, None if invalid/expired.
    """
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidSignatureError, jwt.DecodeError):
        return None


def extract_user_context(payload: dict) -> dict:
    """Extract user context from validated JWT payload."""
    return {
        "user_id": payload["userId"],       # UUID string
        "username": payload["username"],
        "email": payload["email"],
        "roles": payload["roles"],           # list of strings
        "is_admin": "admin" in payload["roles"],
    }
```

> **Production hardening**: When LiteMaaS migrates to RS256, replace `secret` with the public key and change `algorithms=["RS256"]`.

### 2.5 Alternative Authentication Methods

LiteMaaS also supports two API key authentication methods. The agent proxy should be aware of these but does **not** need to validate them — the agent only accepts JWT tokens from the LiteMaaS backend.

| Key Format | Purpose | User Context Created |
|---|---|---|
| `ltm_admin_*` | Admin API keys (set via `ADMIN_API_KEYS` env var) | `userId: "admin-api-key"`, `roles: ["admin", "api"]` |
| `sk-litellm-*` | User API keys (from database) | `userId: <key owner>`, `roles: ["user", "api"]` |

### 2.6 Token Extraction from Request

The token is sent in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The LiteMaaS backend forwards this header as-is when proxying to the agent container.

---

## 3. LiteMaaS API Reference

These are the endpoints the agent's read-only tools call. All responses use JSON. Pagination follows a consistent format across all list endpoints.

### 3.0 Common Patterns

**Authentication header** (for authenticated endpoints):
```
Authorization: Bearer <JWT token>
```

**Pagination response format** (all list endpoints):
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

**Date format**: ISO 8601 (`2026-04-27T14:30:00Z`)

**Null handling**: Budget/limit fields can be `null` (meaning unlimited) or a number.

---

### 3.1 Models API

#### `GET /api/v1/models` — List all models

**Authentication**: Not required (public endpoint)

**Agent tool**: `list_models()`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number (min: 1) |
| `limit` | number | 20 | Results per page (1–1000) |
| `search` | string | — | Filter by model name, provider, or description |
| `provider` | string | — | Filter by provider (e.g., `openai`, `anthropic`) |
| `capability` | string | — | Filter by capability (e.g., `vision`, `function_calling`) |
| `isActive` | boolean | — | Filter by active status |

**Response**:
```json
{
  "data": [
    {
      "id": "string",
      "name": "gpt-4o",
      "provider": "openai",
      "description": "GPT-4o multimodal model",
      "isActive": true,
      "restrictedAccess": false,
      "inputCostPerToken": 0.0025,
      "outputCostPerToken": 0.01,
      "maxTokens": 128000,
      "tpm": 2000000,
      "rpm": 10000,
      "supportsVision": true,
      "supportsFunctionCalling": true,
      "supportsParallelFunctionCalling": true,
      "supportsToolChoice": true,
      "supportsChat": true,
      "supportsEmbeddings": false,
      "supportsTokenize": false,
      "supportsConvert": false,
      "backendModelName": "openai/gpt-4o",
      "apiBase": "https://api.openai.com",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-04-20T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

**Key fields for the agent**:
- `restrictedAccess` — If `true`, users need admin approval to subscribe
- `isActive` — If `false`, the model is disabled
- `supportsChat` / `supportsEmbeddings` / `supportsConvert` — Model type indicators
- `inputCostPerToken` / `outputCostPerToken` — Pricing information

---

#### `GET /api/v1/models/:id` — Get model details

**Authentication**: Not required

**Agent tool**: `get_model_details()`

**Response**: Same shape as a single item from the list endpoint, with additional metadata:
```json
{
  "id": "string",
  "name": "gpt-4o",
  "provider": "openai",
  "description": "GPT-4o multimodal model",
  "metadata": {
    "litellmModelId": "string|null",
    "apiBase": "string|null",
    "backendModelName": "string|null",
    "maxTokens": 128000,
    "supportsVision": true,
    "supportsFunctionCalling": true,
    "supportsParallelFunctionCalling": true,
    "supportsToolChoice": true,
    "supportsChat": true,
    "supportsEmbeddings": false,
    "supportsTokenize": false,
    "supportsConvert": false,
    "inputCostPerToken": 0.0025,
    "outputCostPerToken": 0.01,
    "tpm": 2000000,
    "rpm": 10000
  },
  "isActive": true,
  "restrictedAccess": false,
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-04-20T14:30:00Z"
}
```

---

### 3.2 Subscriptions API

#### `GET /api/v1/subscriptions` — List user's subscriptions

**Authentication**: Required (user JWT)

**Agent tool**: `check_subscription()`

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Results per page (1–100) |
| `status` | string | — | Filter: `active`, `suspended`, `cancelled`, `expired`, `inactive`, `pending`, `denied` |
| `modelId` | string | — | Filter by model ID |

**Response**:
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440099",
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "modelId": "gpt-4o",
      "modelName": "GPT-4o",
      "provider": "openai",
      "status": "active",
      "quotaRequests": 10000,
      "quotaTokens": 1000000,
      "usedRequests": 2500,
      "usedTokens": 250000,
      "remainingRequests": 7500,
      "remainingTokens": 750000,
      "utilizationPercent": {
        "requests": 25,
        "tokens": 25
      },
      "pricing": {
        "inputCostPerToken": 0.0025,
        "outputCostPerToken": 0.01
      },
      "resetAt": "2026-05-01T00:00:00Z",
      "expiresAt": null,
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-04-20T14:30:00Z",
      "modelDescription": "GPT-4o multimodal model",
      "modelContextLength": 128000,
      "modelSupportsVision": true,
      "modelSupportsFunctionCalling": true,
      "modelSupportsParallelFunctionCalling": true,
      "modelSupportsToolChoice": true
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

**Key fields for the agent**:
- `status` — Subscription state. `pending` / `denied` are for restricted models awaiting approval
- `utilizationPercent` — Quick read on how much quota is used
- `remainingRequests` / `remainingTokens` — How much is left
- `resetAt` — When quota resets (null = never)

---

#### `GET /api/v1/subscriptions/stats` — Subscription statistics

**Authentication**: Required (user JWT)

**Agent tool**: `get_subscription_status()`

**Response**:
```json
{
  "total": 5,
  "byStatus": {
    "active": 3,
    "pending": 1,
    "denied": 1
  },
  "byProvider": {
    "openai": 2,
    "anthropic": 3
  },
  "totalQuotaUsage": {
    "requests": {
      "used": 5000,
      "limit": 50000
    },
    "tokens": {
      "used": 500000,
      "limit": 5000000
    }
  }
}
```

---

### 3.3 API Keys API

#### `GET /api/v1/api-keys` — List user's API keys

**Authentication**: Required (user JWT)

**Agent tool**: `get_user_api_keys()`

> **Security note**: This endpoint returns key **prefixes** (e.g., `sk-...1234`), never full key values. The agent should never attempt to retrieve or display full API key values.

**Query Parameters**:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Results per page (1–100) |
| `isActive` | boolean | — | Filter by active status |

**Response**:
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440088",
      "name": "My Production Key",
      "prefix": "sk-...a1b2",
      "keyPrefix": "sk-...a1b2",
      "models": ["gpt-4o", "claude-3-5-sonnet"],
      "isActive": true,
      "lastUsedAt": "2026-04-25T14:30:00Z",
      "createdAt": "2026-03-01T10:00:00Z",
      "expiresAt": "2027-03-01T10:00:00Z",
      "revokedAt": null,
      "maxBudget": 100.0,
      "currentSpend": 25.5,
      "budgetDuration": "monthly",
      "tpmLimit": 10000,
      "rpmLimit": 500,
      "syncStatus": "synced",
      "syncError": null,
      "modelMaxBudget": {
        "gpt-4o": { "budgetLimit": 50, "timePeriod": "monthly" }
      },
      "modelRpmLimit": { "gpt-4o": 250 },
      "modelTpmLimit": { "gpt-4o": 5000 }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

**Key fields for the agent**:
- `isActive` / `revokedAt` — Key status (revoked keys have a timestamp)
- `maxBudget` / `currentSpend` — Budget usage (common cause of "key stopped working")
- `expiresAt` — Key expiration (null = no expiry)
- `budgetDuration` — Reset period (`daily`, `weekly`, `monthly`, `yearly`, or custom like `30d`)
- `models` — Which models the key can access
- `syncStatus` — Whether the key is synced with LiteLLM (`synced`, `pending`, `error`)

---

### 3.4 Usage API

#### `GET /api/v1/usage/budget` — User budget info

**Authentication**: Required (user JWT)

**Agent tool**: `get_usage_stats()`

**Response**:
```json
{
  "maxBudget": 1000.0,
  "currentSpend": 250.5,
  "budgetDuration": "monthly",
  "budgetResetAt": "2026-05-01T00:00:00Z"
}
```

**Notes**:
- `maxBudget` can be `null` (unlimited)
- `budgetResetAt` can be `null` (no reset)

---

#### `GET /api/v1/usage/summary` — Usage summary

**Authentication**: Required (user JWT)

**Agent tool**: `get_usage_stats()`

**Query Parameters**:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `startDate` | string (YYYY-MM-DD) | Yes | Period start |
| `endDate` | string (YYYY-MM-DD) | Yes | Period end |
| `modelId` | string | No | Filter by model |
| `granularity` | string | No | `hour`, `day`, `week`, `month` (default: `day`) |

**Response**:
```json
{
  "period": {
    "start": "2026-04-01T00:00:00Z",
    "end": "2026-04-27T23:59:59Z"
  },
  "totals": {
    "requests": 5000,
    "tokens": 500000,
    "cost": 15.50,
    "promptTokens": 250000,
    "completionTokens": 250000,
    "averageLatency": 245,
    "errorRate": 1.5,
    "successRate": 98.5
  },
  "byModel": [
    {
      "modelId": "gpt-4o",
      "modelName": "GPT-4o",
      "requests": 3000,
      "tokens": 300000,
      "cost": 10.0
    }
  ]
}
```

---

### 3.5 Admin Endpoints

These endpoints are called by **admin-only agent tools**. They require a JWT with the `admin` role.

#### `GET /api/v1/admin/users/:id` — Get user details (admin)

**Authentication**: Required (admin JWT, permission: `users:read`)

**Agent tool**: `lookup_user_subscriptions()`

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "username": "alice",
  "email": "alice@example.com",
  "roles": ["user"],
  "maxBudget": 1000.0,
  "currentSpend": 250.5,
  "budgetDuration": "monthly",
  "tpmLimit": 100000,
  "rpmLimit": 5000,
  "createdAt": "2026-01-01T00:00:00Z",
  "lastActive": "2026-04-25T14:30:00Z",
  "subscriptionCount": 5,
  "apiKeyCount": 3
}
```

---

#### `GET /api/v1/admin/users/:id/subscriptions` — User subscriptions (admin)

**Authentication**: Required (admin JWT, permission: `users:read`)

**Agent tool**: `lookup_user_subscriptions()`

**Query Parameters**: Same as `GET /api/v1/subscriptions` (page, limit, status)

**Response**: Same shape as `GET /api/v1/subscriptions` but for the target user.

---

#### `POST /api/v1/admin/usage/analytics` — Global usage analytics (admin)

**Authentication**: Required (admin JWT, permission: `admin:usage`)

**Agent tool**: `get_global_usage_stats()`

> **Note**: This is a POST endpoint (not GET) because it accepts complex filter arrays in the request body.

**Request Body**:
```json
{
  "startDate": "2026-04-01",
  "endDate": "2026-04-27",
  "userIds": ["user-id-1"],
  "modelIds": ["gpt-4o"],
  "providerIds": ["openai"]
}
```

All filter fields are optional.

**Response**:
```json
{
  "period": {
    "start": "2026-04-01",
    "end": "2026-04-27"
  },
  "totals": {
    "requests": 50000,
    "tokens": 5000000,
    "cost": 155.00,
    "successRate": 98.5,
    "averageLatency": 245
  },
  "modelBreakdown": [
    {
      "modelId": "gpt-4o",
      "modelName": "GPT-4o",
      "provider": "openai",
      "requests": 30000,
      "tokens": 3000000,
      "cost": 100.0,
      "uniqueUsers": 12,
      "successRate": 99.0,
      "averageLatency": 200
    }
  ],
  "providerBreakdown": [
    {
      "providerId": "openai",
      "providerName": "OpenAI",
      "requests": 30000,
      "tokens": 3000000,
      "cost": 100.0,
      "modelsCount": 3,
      "uniqueUsers": 12
    }
  ]
}
```

---

#### `GET /api/v1/admin/subscriptions/stats` — Approval queue statistics (admin)

**Authentication**: Required (admin JWT, permission: `admin:subscriptions:read`)

**Agent tool**: Could be used by an admin tool to report on pending approvals.

**Response**:
```json
{
  "pendingCount": 5,
  "approvedToday": 3,
  "deniedToday": 1,
  "totalRequests": 42
}
```

---

## 4. LiteLLM API Reference

The agent calls LiteLLM directly for model health checks, model configuration info, and rate limit status. These endpoints are served by the LiteLLM proxy (separate from LiteMaaS backend).

### 4.0 Common Patterns

**Authentication header**: LiteLLM uses a custom header (not the standard `Authorization: Bearer`):
```
x-litellm-api-key: <API key>
```

**Base URL**: Configured via `LITELLM_API_URL` environment variable.

**Important quirks**:
- The sentinel value `2147483647` (max int32) means "unlimited" for TPM/RPM fields
- Response shapes can differ between LiteLLM versions — the agent should handle both formats where noted
- Some error responses return HTTP 200 with error details in the body

---

### 4.1 Health Check

#### `GET /health/liveness` — LiteLLM health status

**Agent tool**: `check_model_health()`

**Headers**: `x-litellm-api-key` (optional)

**Response** (JSON format):
```json
{
  "status": "healthy",
  "db": "connected",
  "redis": "connected",
  "litellm_version": "1.81.0"
}
```

**Alternative response** (plain text, v1.81.0+): Some versions return just `I'm alive!` as plain text.

**Status values**: `healthy`, `unhealthy`, `degraded`

> **Implementation note**: The agent tool should handle both JSON and plain text responses. A plain text "I'm alive!" response should be treated as `healthy`.

---

### 4.2 Model Information

#### `GET /model/info` — List all models with configuration

**Agent tool**: `get_model_info()`

**Headers**: `x-litellm-api-key: <API key>`

**Response**:
```json
{
  "data": [
    {
      "model_name": "gpt-4o",
      "litellm_params": {
        "model": "openai/gpt-4o",
        "api_base": "https://api.openai.com",
        "custom_llm_provider": "openai",
        "input_cost_per_token": 0.0025,
        "output_cost_per_token": 0.01,
        "tpm": 2000000,
        "rpm": 10000
      },
      "model_info": {
        "id": "unique-model-id",
        "db_model": true,
        "max_tokens": 128000,
        "supports_vision": true,
        "supports_function_calling": true,
        "supports_parallel_function_calling": true,
        "supports_tool_choice": false,
        "input_cost_per_token": 0.0025,
        "output_cost_per_token": 0.01
      }
    }
  ]
}
```

**Key fields for the agent**:
- `model_name` — The name users reference when subscribing
- `litellm_params.model` — The actual model identifier sent to the provider
- `litellm_params.api_base` — Provider endpoint URL
- `litellm_params.tpm` / `rpm` — Configured rate limits
- `model_info.max_tokens` — Maximum context length

> **Cache note**: LiteMaaS caches this endpoint for 5 minutes. The agent may see stale data if models were just added/removed.

---

### 4.3 API Key Information

#### `GET /key/info` — Get key details and rate limit status

**Agent tool**: `check_rate_limits()`

**Headers**: `x-litellm-api-key: <the specific API key to query>`

**Response** (v1.81.0+ — nested format):
```json
{
  "key": "sk-litellm-xxxxx",
  "info": {
    "key_name": "sk-...xxxx",
    "key_alias": "my-api-key",
    "spend": 25.50,
    "max_budget": 100.00,
    "models": ["gpt-4o", "claude-3-5-sonnet"],
    "tpm_limit": 10000,
    "rpm_limit": 100,
    "budget_duration": "monthly",
    "budget_reset_at": "2026-05-01T00:00:00Z",
    "model_max_budget": {
      "gpt-4o": { "budget_limit": 50, "time_period": "monthly" }
    },
    "model_rpm_limit": { "gpt-4o": 250 },
    "model_tpm_limit": { "gpt-4o": 5000 },
    "model_spend": { "gpt-4o": 15.00 },
    "user_id": "user-123",
    "expires": "2027-03-01T10:00:00Z",
    "soft_budget": 80.00,
    "blocked": false
  }
}
```

**Response** (older versions — flat format):
```json
{
  "key_name": "sk-...xxxx",
  "key_alias": "my-api-key",
  "spend": 25.50,
  "max_budget": 100.00,
  "models": ["gpt-4o"],
  "tpm_limit": 10000,
  "rpm_limit": 100
}
```

> **Version handling**: The agent tool should check if the response has an `info` key (nested format) or not (flat format) and normalize accordingly:
> ```python
> data = response.json()
> key_info = data.get("info", data)  # Handles both formats
> ```

**Key fields for the agent**:
- `spend` / `max_budget` — Budget utilization (common cause of key failures)
- `tpm_limit` / `rpm_limit` — Rate limits (sentinel `2147483647` = unlimited)
- `blocked` — Whether the key is blocked
- `budget_reset_at` — When the budget resets
- `model_spend` — Per-model spend breakdown

---

### 4.4 User Information

#### `GET /user/info` — Get user details from LiteLLM

**Agent tool**: `check_rate_limits()` (supplementary)

**Headers**: `x-litellm-api-key: <API key>`

**Query Parameters**: `user_id=<user-id>`

**Response**:
```json
{
  "user_id": "user-123",
  "user_alias": "alice",
  "user_email": "alice@example.com",
  "user_role": "internal_user",
  "max_budget": 500.00,
  "spend": 125.50,
  "models": ["gpt-4o", "claude-3-5-sonnet"],
  "tpm_limit": 10000,
  "rpm_limit": 500
}
```

> **Detection quirk**: For non-existent users, older LiteLLM versions return HTTP 200 with an empty `teams` array. v1.81.0+ returns HTTP 404.

---

## 5. Data Models

These are the key entity shapes as they appear in API responses. The agent's `format_*()` helper functions need to parse these into human-readable summaries.

### 5.1 Model

```typescript
interface Model {
  id: string;                    // Unique identifier
  name: string;                  // Display name (e.g., "gpt-4o")
  provider: string;              // Provider name (e.g., "openai")
  description: string;           // Human-readable description
  isActive: boolean;             // Whether the model is available
  restrictedAccess: boolean;     // Whether admin approval is required

  // Capabilities (boolean flags)
  supportsChat: boolean;
  supportsEmbeddings: boolean;
  supportsTokenize: boolean;
  supportsConvert: boolean;      // Document conversion
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  supportsParallelFunctionCalling: boolean;
  supportsToolChoice: boolean;

  // Pricing
  inputCostPerToken: number;     // Cost per input token
  outputCostPerToken: number;    // Cost per output token

  // Limits
  maxTokens: number;             // Maximum context length
  tpm: number;                   // Tokens per minute limit
  rpm: number;                   // Requests per minute limit

  // LiteLLM integration
  backendModelName: string | null;  // LiteLLM model identifier
  apiBase: string | null;           // Provider API base URL

  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

### 5.2 Subscription

```typescript
interface Subscription {
  id: string;                    // UUID
  userId: string;                // UUID of the subscribing user
  modelId: string;               // Model identifier
  modelName: string;             // Model display name
  provider: string;              // Provider name

  // Status
  status: "active" | "suspended" | "cancelled" | "expired"
        | "inactive" | "pending" | "denied";

  // Quota (null = unlimited)
  quotaRequests: number | null;
  quotaTokens: number | null;
  usedRequests: number;
  usedTokens: number;
  remainingRequests: number | null;
  remainingTokens: number | null;
  utilizationPercent: {
    requests: number;            // 0–100
    tokens: number;              // 0–100
  };

  // Pricing
  pricing: {
    inputCostPerToken: number;
    outputCostPerToken: number;
  };

  // Dates
  resetAt: string | null;        // When quota resets
  expiresAt: string | null;      // When subscription expires
  createdAt: string;
  updatedAt: string;

  // Model metadata (denormalized for convenience)
  modelDescription: string;
  modelContextLength: number;
  modelSupportsVision: boolean;
  modelSupportsFunctionCalling: boolean;
  modelSupportsParallelFunctionCalling: boolean;
  modelSupportsToolChoice: boolean;
}
```

### 5.3 API Key

```typescript
interface ApiKey {
  id: string;                    // UUID
  name: string;                  // User-given name
  prefix: string;               // Key prefix (e.g., "sk-...a1b2") — NEVER the full key
  keyPrefix: string;             // Same as prefix (legacy field)
  models: string[];              // Models this key can access
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;      // null = no expiration
  revokedAt: string | null;      // Non-null = key is revoked

  // Budget
  maxBudget: number | null;      // null = unlimited
  currentSpend: number;
  budgetDuration: string | null; // "daily", "weekly", "monthly", "yearly", or custom

  // Rate limits
  tpmLimit: number | null;       // Tokens per minute (null = unlimited)
  rpmLimit: number | null;       // Requests per minute (null = unlimited)

  // Per-model limits (optional, may be empty objects)
  modelMaxBudget: Record<string, { budgetLimit: number; timePeriod: string }>;
  modelRpmLimit: Record<string, number>;
  modelTpmLimit: Record<string, number>;

  // Sync status with LiteLLM
  syncStatus: "synced" | "pending" | "error";
  syncError: string | null;

  // LiteLLM reference
  liteLLMKeyId: string | null;
}
```

### 5.4 User (Admin View)

```typescript
interface UserAdmin {
  id: string;                    // UUID
  username: string;
  email: string;
  roles: string[];               // e.g., ["admin", "user"]

  // Budget & limits
  maxBudget: number | null;      // null = unlimited
  currentSpend: number;
  budgetDuration: string | null;
  tpmLimit: number | null;
  rpmLimit: number | null;

  // Activity
  createdAt: string;
  lastActive: string | null;
  subscriptionCount: number;
  apiKeyCount: number;
}
```

---

## 6. Frontend Integration Patterns

This section documents how the existing LiteMaaS frontend implements chat UI and streaming, so the assistant widget can follow identical patterns.

### 6.1 PatternFly Chatbot Component

**Package**: `@patternfly/chatbot` v6.3.2

**Import style**: Dynamic imports from `@patternfly/chatbot/dist/dynamic/*`:
```typescript
import Chatbot, { ChatbotDisplayMode } from '@patternfly/chatbot/dist/dynamic/Chatbot';
import ChatbotContent from '@patternfly/chatbot/dist/dynamic/ChatbotContent';
import ChatbotHeader from '@patternfly/chatbot/dist/dynamic/ChatbotHeader';
import ChatbotHeaderMain from '@patternfly/chatbot/dist/dynamic/ChatbotHeaderMain';
import ChatbotHeaderTitle from '@patternfly/chatbot/dist/dynamic/ChatbotHeaderTitle';
import ChatbotHeaderActions from '@patternfly/chatbot/dist/dynamic/ChatbotHeaderActions';
import ChatbotFooter from '@patternfly/chatbot/dist/dynamic/ChatbotFooter';
import MessageBar from '@patternfly/chatbot/dist/dynamic/MessageBar';
import MessageBox from '@patternfly/chatbot/dist/dynamic/MessageBox';
import Message from '@patternfly/chatbot/dist/dynamic/Message';
import ChatbotWelcomePrompt from '@patternfly/chatbot/dist/dynamic/ChatbotWelcomePrompt';
```

**Required CSS** (must be imported once):
```typescript
import '@patternfly/chatbot/dist/css/main.css';
```

**Component hierarchy**:
```
<Chatbot displayMode={ChatbotDisplayMode.embedded}>
  <ChatbotHeader>
    <ChatbotHeaderMain>
      <ChatbotHeaderTitle>Assistant</ChatbotHeaderTitle>
    </ChatbotHeaderMain>
    <ChatbotHeaderActions>...</ChatbotHeaderActions>
  </ChatbotHeader>
  <ChatbotContent>
    <MessageBox>
      {messages.length === 0 ? (
        <ChatbotWelcomePrompt title="..." description="..." />
      ) : (
        messages.map(msg => (
          <Message
            key={msg.id}
            role={msg.role === 'assistant' ? 'bot' : msg.role}
            content={msg.content}
            timestamp={msg.timestamp.toLocaleTimeString()}
            avatar={msg.role === 'assistant' ? botAvatar : userAvatar}
          />
        ))
      )}
      {isLoading && <Message role="bot" content="" isLoading avatar={botAvatar} />}
    </MessageBox>
  </ChatbotContent>
  <ChatbotFooter>
    <MessageBar
      onSendMessage={handleSend}
      isDisabled={isStreaming}
    />
  </ChatbotFooter>
</Chatbot>
```

**Key patterns**:
- Role mapping: PF chatbot uses `"bot"` not `"assistant"` — map accordingly
- Loading state: Use `<Message isLoading />` for typing indicator
- Empty state: Use `<ChatbotWelcomePrompt>` when no messages
- Disable input during streaming via `MessageBar.isDisabled`

### 6.2 Message Structure

```typescript
interface ChatMessage {
  id: string;           // Format: "msg_<timestamp>_<random>"
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}
```

### 6.3 SSE Streaming Pattern

The existing chatbot uses `fetch()` with `ReadableStream` for streaming. The assistant widget should follow the same pattern but with a different protocol (the agent uses a custom SSE format, not OpenAI-compatible).

**Existing pattern** (for reference — the chatbot talks directly to LiteLLM):
```typescript
const response = await fetch(`${litellmUrl}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ ...request, stream: true }),
  signal: abortController.signal,
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      const chunk = JSON.parse(data);
      // Process chunk...
    }
  }
}
```

**Assistant widget adaptation**: The agent proxy uses a different SSE format:
```
data: {"chunk": "Hello, how can I", "index": 0}
data: {"chunk": " help you today?", "index": 1}
data: {"retract_chunk": 2, "placeholder": "...removed..."}
data: {"done": true, "safety_notice": null}
```

Key differences from the chatbot streaming:
- Uses POST-based SSE (same as chatbot)
- Chunks include an `index` field for retract UX
- `retract_chunk` events replace an already-displayed chunk with a placeholder
- `done` event signals completion and may include a safety notice
- No `[DONE]` sentinel — instead a JSON object with `done: true`

### 6.4 Streaming State Management

```typescript
interface StreamingState {
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingContent: string;          // Accumulated safe content
  abortController: AbortController | null;
}
```

**Abort handling**: When the user clicks "Stop", the accumulated content is preserved (partial response stays visible):
```typescript
const handleStop = () => {
  streamingState.abortController?.abort();
  // Keep current content in message — don't discard partial response
  setMessages(prev =>
    prev.map(msg =>
      msg.id === streamingState.streamingMessageId
        ? { ...msg, content: streamingState.streamingContent }
        : msg
    )
  );
  resetStreamingState();
};
```

### 6.5 API Client

**HTTP client**: Axios with JWT interceptor

```typescript
// Base client (used for non-streaming requests)
import { apiClient } from '../services/api';

// Token source
const token = localStorage.getItem('access_token');

// Request interceptor adds token automatically:
config.headers.Authorization = `Bearer ${token}`;

// Base URL: /api/v1 (relative — Vite dev proxy handles routing)
```

**Streaming calls use raw `fetch()`** because Axios doesn't support `ReadableStream`. The assistant widget should follow the same split: Axios for non-streaming, `fetch()` for SSE.

### 6.6 Error Handling

```typescript
interface ChatError {
  type: 'api_error' | 'network_error' | 'validation_error'
      | 'rate_limit' | 'auth_error' | 'aborted';
  message: string;
  details?: unknown;
  retryable: boolean;
}
```

Use the `useErrorHandler` hook for non-streaming errors:
```typescript
const { handleError } = useErrorHandler();

try {
  await sendMessage(...);
} catch (err) {
  if ((err as ChatError).type === 'aborted') {
    // Silent — user clicked stop
  } else {
    handleError(err);
  }
}
```

### 6.7 Internationalization

Use `useTranslation()` hook. Define keys under a dedicated namespace:
```json
{
  "pages": {
    "assistant": {
      "title": "Platform Assistant",
      "welcome": {
        "title": "Hi! I'm your LiteMaaS assistant",
        "description": "I can help with model subscriptions, API keys, usage questions, and troubleshooting."
      },
      "placeholder": "Ask me about LiteMaaS...",
      "unavailable": "The assistant is currently unavailable. Please try again later.",
      "safetyNotice": "Part of this response has been removed for safety reasons.",
      "feedback": {
        "helpful": "Helpful",
        "notHelpful": "Not helpful"
      }
    }
  }
}
```

### 6.8 Key Differences: Assistant Widget vs Chat Playground

| Aspect | Chat Playground (`/chatbot`) | Assistant Widget |
|---|---|---|
| **Purpose** | Direct model interaction | Platform support |
| **Model selection** | User selects model + API key | Fixed (agent backend) |
| **Settings** | Temperature, max tokens, system prompt | None |
| **Backend** | LiteLLM directly | Agent proxy → Letta |
| **SSE format** | OpenAI-compatible chunks | Custom: `chunk`, `retract_chunk`, `done` |
| **Guardrails** | None | Input/output rails with retract UX |
| **Position** | Full page (`/chatbot` route) | Floating panel (all pages) |
| **History** | Current session | Current session (agent uses recall memory) |
| **Feedback** | None | Thumbs up/down per response |

---

## 7. LiteMaaS Backend Integration

What needs to be added to the LiteMaaS backend to support the assistant widget.

### 7.1 New Route: `/api/v1/assistant/*`

A thin proxy route that forwards requests to the agent container, passing through the user's JWT:

**File to create**: `backend/src/routes/assistant.ts`

**Endpoints**:
- `POST /api/v1/assistant/chat` — Non-streaming chat (proxy to agent `/v1/chat`)
- `POST /api/v1/assistant/chat/stream` — Streaming chat via SSE (proxy to agent `/v1/chat/stream`)
- `GET /api/v1/assistant/health` — Agent health check (proxy to agent `/v1/health`)

**Pattern**: Forward the `Authorization` header as-is. The agent proxy validates the JWT independently.

### 7.2 Environment Variable

| Variable | Required | Default | Description |
|---|---|---|---|
| `AGENT_URL` | No | — | Agent proxy base URL (e.g., `http://agent:8400`). If not set, assistant routes are not registered. |

### 7.3 Feature Flag

Assistant routes should only be registered when `AGENT_URL` is configured:

```typescript
// In route registration (backend/src/routes/index.ts)
if (fastify.config.AGENT_URL) {
  fastify.register(assistantRoutes, { prefix: '/api/v1/assistant' });
}
```

This allows LiteMaaS deployments without the agent container to work normally — the assistant button in the frontend checks the health endpoint and shows as disabled if unavailable.

### 7.4 Frontend Health Check

The assistant widget checks agent availability on mount:

```typescript
// On mount, check if agent is reachable
const checkAgentHealth = async () => {
  try {
    const response = await apiClient.get('/assistant/health');
    setAgentAvailable(response.status === 'healthy');
  } catch {
    setAgentAvailable(false);
  }
};
```

If unavailable, the floating button is disabled/grayed out with a tooltip: "The assistant is currently unavailable."

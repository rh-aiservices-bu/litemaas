# LiteLLM API Integration Reference

> **Version**: 1.81.0 (updated from 1.74.3)
> **Base URL**: http://localhost:4000
> **Authentication**: API Key Header (`x-litellm-api-key`) or Bearer Token (`Authorization: Bearer sk-...`)
> **Integration Status**: FULLY IMPLEMENTED - All critical endpoints integrated

This document provides a comprehensive reference for integrating LiteMaaS with the LiteLLM API server.

---

## MIGRATION GUIDE: v1.74.3 to v1.81.0

> **IMPORTANT**: This section documents breaking changes that require LiteMaaS code updates.

### BREAKING CHANGE 1: `GET /key/info` response format changed

The response is now **nested** under a `key` + `info` wrapper.

**Old format (v1.74.3)** - flat response:

```json
{
  "key_name": "user-john-production",
  "spend": 15.75,
  "max_budget": 100.0,
  "models": ["gpt-4o", "gpt-3.5-turbo"],
  "tpm_limit": 1000,
  "rpm_limit": 60,
  ...
}
```

**New format (v1.81.0)** - nested response:

```json
{
  "key": "sk-litellm-1234567890abcdef",
  "info": {
    "key_name": "user-john-production",
    "spend": 15.75,
    "max_budget": 100.0,
    "models": ["gpt-4o", "gpt-3.5-turbo"],
    "tpm_limit": 1000,
    "rpm_limit": 60,
    "user_id": "user_12345",
    "team_id": "team_67890",
    "expires": "2024-08-24T14:06:00Z",
    "budget_reset_at": "2024-08-01T00:00:00Z"
  }
}
```

**Required LiteMaaS change**: Unwrap `response.info` when reading key details. Example:

```typescript
// Before (v1.74.3)
const keyInfo = response.data;
const spend = keyInfo.spend;

// After (v1.81.0)
const keyInfo = response.data.info;
const spend = keyInfo.spend;
const rawKey = response.data.key; // also available now
```

**Source**: `litellm/proxy/management_endpoints/key_management_endpoints.py:2007`

---

### BREAKING CHANGE 2: `/budget/info` changed from GET to POST

The HTTP method changed and the request/response format is different.

**Old (v1.74.3):**

```http
GET /budget/info?budget_id=eng_team_monthly
```

Old response:

```json
{
  "budget_id": "eng_team_monthly",
  "max_budget": 2000.0,
  "spend": 850.30,
  "remaining": 1149.70,
  "reset_at": "2024-08-01T00:00:00Z",
  "soft_limit": 1800.0,
  "alert_triggered": false,
  "team_id": "litemaas_team_eng"
}
```

**New (v1.81.0):**

```http
POST /budget/info
Content-Type: application/json

{
  "budgets": ["eng_team_monthly"]
}
```

New response (array of raw database rows):

```json
[
  {
    "budget_id": "eng_team_monthly",
    "max_budget": 2000.0,
    "soft_budget": 1800.0,
    "max_parallel_requests": null,
    "tpm_limit": null,
    "rpm_limit": null,
    "model_max_budget": null,
    "budget_duration": "monthly",
    "budget_reset_at": "2024-08-01T00:00:00Z",
    "created_at": "2024-07-01T00:00:00Z"
  }
]
```

**Key differences**:
- HTTP method changed from GET to POST
- Request uses JSON body with `budgets` array instead of query parameter
- Response is an **array** (supports querying multiple budgets at once)
- Response returns raw database rows from `LiteLLM_BudgetTable`
- `remaining`, `alert_triggered`, and `team_id` fields are **no longer returned** (must be computed client-side)
- `spend` is **not included** in the budget table response (track via key/user spend)

**Required LiteMaaS change**: Update HTTP method, request format, and response parsing:

```typescript
// Before (v1.74.3)
const response = await axios.get('/budget/info', {
  params: { budget_id: 'eng_team_monthly' }
});
const remaining = response.data.remaining;

// After (v1.81.0)
const response = await axios.post('/budget/info', {
  budgets: ['eng_team_monthly']
});
const budget = response.data[0]; // response is an array
// 'remaining' must be computed: remaining = budget.max_budget - currentSpend
```

**Source**: `litellm/proxy/management_endpoints/budget_management_endpoints.py:145-173`

---

### BREAKING CHANGE 3: `x-ratelimit-reset-requests` header NOT returned

The rate limit headers returned by LiteLLM do **not** include the `x-ratelimit-reset-requests` header (and never included `x-ratelimit-reset-tokens`).

**Headers actually returned (v1.81.0):**

```http
x-ratelimit-remaining-requests: 45
x-ratelimit-limit-requests: 60
x-ratelimit-remaining-tokens: 750
x-ratelimit-limit-tokens: 1000
```

**NOT returned:**
- `x-ratelimit-reset-requests` (no reset timestamp)
- `x-ratelimit-reset-tokens` (no reset timestamp)

**Required LiteMaaS change**: If LiteMaaS depends on `x-ratelimit-reset-requests` for retry-after logic, implement a fallback (e.g., fixed 60-second window assumption or exponential backoff).

**Source**: `litellm/proxy/hooks/parallel_request_limiter.py:848-859`

---

## Authentication

All API calls require authentication via API key header:

```http
x-litellm-api-key: sk-your-api-key-here
```

Or via standard Bearer token:

```http
Authorization: Bearer sk-your-api-key-here
```

---

## Quick Reference

### Essential Endpoints for LiteMaaS Integration

| Endpoint             | Method | Purpose                                  | Priority     |
| -------------------- | ------ | ---------------------------------------- | ------------ |
| `/health/liveliness` | GET    | Service health check (legacy spelling)   | **Critical** |
| `/health/liveness`   | GET    | Service health check (K8s standard)      | **Critical** |
| `/model/info`        | GET    | List available models with detailed info | **Critical** |
| `/key/generate`      | POST   | Create API keys                          | **Critical** |
| `/key/info`          | GET    | Get key details (RESPONSE CHANGED)       | **High**     |
| `/key/update`        | POST   | Update key settings                      | **High**     |
| `/key/delete`        | POST   | Delete or revoke keys                    | **High**     |
| `/user/new`          | POST   | Create internal users                    | **High**     |
| `/budget/info`       | POST   | Budget tracking (WAS GET, NOW POST)      | **Medium**   |
| `/team/new`          | POST   | Team management                          | **Medium**   |
| `/key/block`         | POST   | Block a key (NEW)                        | **Medium**   |
| `/key/unblock`       | POST   | Unblock a key (NEW)                      | **Medium**   |
| `/key/regenerate`    | POST   | Regenerate/rotate a key (NEW)            | **Medium**   |

---

## Health & Monitoring

### Health Check

```http
GET /health/liveliness
```

Or the Kubernetes-standard spelling (NEW in v1.81.0):

```http
GET /health/liveness
```

**Response**: `200 OK` - Service is healthy

**Integration Use**: Use for service availability checks in LiteMaaS health monitoring. The `/health/liveness` endpoint is recommended for new integrations as it follows Kubernetes naming conventions. Both endpoints are functionally identical.

### Readiness Check

```http
GET /health/readiness
```

**Response**: `200 OK` - Service is ready to receive requests

**Note**: This endpoint requires authentication, unlike the liveness probes.

### Full Health Check

```http
GET /health
```

**Response**: Health status for all configured models. Requires authentication.

---

## Model Management

### List Available Models with Detailed Information

```http
GET /model/info
```

**Response**:

```json
{
  "data": [
    {
      "model_name": "gpt-4o",
      "litellm_params": {
        "input_cost_per_token": 0.01,
        "output_cost_per_token": 0.03,
        "api_base": "https://api.openai.com/v1",
        "custom_llm_provider": "openai",
        "use_in_pass_through": false,
        "use_litellm_proxy": false,
        "model": "openai/gpt-4o"
      },
      "model_info": {
        "id": "model-uuid-123",
        "db_model": true,
        "max_tokens": 128000,
        "access_groups": [],
        "direct_access": true,
        "supports_vision": true,
        "supports_function_calling": true,
        "supports_parallel_function_calling": true,
        "access_via_team_ids": ["team-id-1", "team-id-2"],
        "input_cost_per_token": 0.01,
        "output_cost_per_token": 0.03
      }
    }
  ]
}
```

**Integration Use**:

- Populate LiteMaaS model registry with accurate pricing and capabilities
- Extract model capabilities (`supports_vision`, `supports_function_calling`, etc.)
- Validate subscription model access via `access_via_team_ids`
- Display real-time pricing information to users
- Handle missing data gracefully (undefined values for missing `max_tokens` or pricing)

### Model Discovery with Filters

```http
GET /model/info?team_id=team_123
```

**Query Parameters**:

- `team_id`: Filter models accessible by specific team

---

## API Key Management

### Generate API Key

```http
POST /key/generate
Content-Type: application/json

{
  "key_alias": "production-key_a5f2b1c3",
  "duration": "30d",
  "models": ["gpt-4o", "gpt-3.5-turbo"],
  "max_budget": 100.00,
  "user_id": "user_12345",
  "team_id": "team_67890",
  "organization_id": "org_abc",
  "tpm_limit": 1000,
  "rpm_limit": 60,
  "budget_duration": "monthly",
  "soft_budget": 80.00,
  "metadata": {
    "subscription_id": "sub_abc123",
    "created_by": "litemaas"
  },
  "permissions": {
    "allow_chat_completions": true,
    "allow_embeddings": true
  },
  "tags": ["production", "user-subscription"],
  "key_type": "default",
  "auto_rotate": false,
  "rotation_interval": null
}
```

**New optional fields in v1.81.0:**

| Field | Type | Description |
|-------|------|-------------|
| `key_type` | `string` | One of `"default"`, `"llm_api"`, `"management"`, `"read_only"` |
| `auto_rotate` | `boolean` | Enable automatic key rotation (default: `false`) |
| `rotation_interval` | `string` | Key rotation interval (e.g., `"30d"`) |
| `soft_budget` | `float` | Soft budget threshold for alerts (requests won't fail) |
| `organization_id` | `string` | Organization ID for the key |
| `budget_id` | `string` | Reference to a pre-created budget |
| `send_invite_email` | `boolean` | Send invite email on key creation |
| `guardrails` | `string[]` | List of active guardrail names |
| `object_permission` | `object` | Object-level permissions (MCP, Vector Stores, etc.) |
| `model_rpm_limit` | `dict` | Model-specific RPM limits, e.g., `{"gpt-4o": 10}` |
| `model_tpm_limit` | `dict` | Model-specific TPM limits |
| `model_max_budget` | `dict` | Model-specific budget configs |

**Response**:

```json
{
  "key": "sk-litellm-1234567890abcdef",
  "key_name": "production-key_a5f2b1c3",
  "expires": "2024-08-24T14:06:00Z",
  "token_id": "token_abc123",
  "user_id": "user_12345",
  "team_id": "team_67890",
  "max_budget": 100.0,
  "soft_budget": 80.0,
  "created_at": "2024-07-24T14:06:00Z"
}
```

### Get Key Information

> **BREAKING CHANGE**: Response format changed in v1.81.0. See Migration Guide above.

```http
GET /key/info?key=sk-litellm-1234567890abcdef
```

If no `key` query parameter is provided, uses the key from the `Authorization` header:

```http
GET /key/info
Authorization: Bearer sk-litellm-1234567890abcdef
```

**Response (v1.81.0)**:

```json
{
  "key": "sk-litellm-1234567890abcdef",
  "info": {
    "key_name": "production-key_a5f2b1c3",
    "key_alias": "production-key_a5f2b1c3",
    "spend": 15.75,
    "max_budget": 100.0,
    "soft_budget": 80.0,
    "models": ["gpt-4o", "gpt-3.5-turbo"],
    "tpm_limit": 1000,
    "rpm_limit": 60,
    "max_parallel_requests": null,
    "user_id": "user_12345",
    "team_id": "team_67890",
    "organization_id": "org_abc",
    "expires": "2024-08-24T14:06:00Z",
    "budget_duration": "monthly",
    "budget_reset_at": "2024-08-01T00:00:00Z",
    "metadata": {"subscription_id": "sub_abc123", "created_by": "litemaas"},
    "permissions": {"allow_chat_completions": true, "allow_embeddings": true},
    "tags": ["production", "user-subscription"],
    "key_type": "default",
    "auto_rotate": false,
    "rotation_interval": null,
    "blocked": false,
    "litellm_budget_table": {
      "budget_id": null,
      "max_budget": 100.0,
      "soft_budget": 80.0,
      "budget_duration": "monthly",
      "budget_reset_at": "2024-08-01T00:00:00Z"
    },
    "created_at": "2024-07-24T14:06:00Z",
    "updated_at": "2024-07-24T14:06:00Z"
  }
}
```

### Get Key Information (v2 - POST)

New alternative endpoint using POST with JSON body:

```http
POST /v2/key/info
Content-Type: application/json

{
  "keys": ["sk-litellm-1234567890abcdef"]
}
```

**Response**: Same nested format as `GET /key/info`, but supports querying multiple keys.

### Update Key Settings

```http
POST /key/update
Content-Type: application/json

{
  "key": "sk-litellm-1234567890abcdef",
  "max_budget": 200.00,
  "models": ["gpt-4o", "gpt-3.5-turbo", "claude-3-opus"],
  "duration": "60d",
  "metadata": {"updated_by": "litemaas"},
  "blocked": false,
  "auto_rotate": true,
  "rotation_interval": "30d"
}
```

**New optional fields for update:**

| Field | Type | Description |
|-------|------|-------------|
| `blocked` | `boolean` | Block/unblock the key |
| `auto_rotate` | `boolean` | Enable/disable automatic key rotation |
| `rotation_interval` | `string` | Key rotation interval |
| `temp_budget_increase` | `float` | Temporary budget increase amount |
| `temp_budget_expiry` | `datetime` | When the temporary budget increase expires |
| `guardrails` | `string[]` | Update active guardrails |
| `model_rpm_limit` | `dict` | Model-specific RPM limits |
| `model_tpm_limit` | `dict` | Model-specific TPM limits |

### Delete Key

```http
POST /key/delete
Content-Type: application/json

{
  "keys": ["sk-litellm-1234567890abcdef"]
}
```

**New in v1.81.0**: Can also delete by key alias:

```json
{
  "key_aliases": ["production-key_a5f2b1c3"]
}
```

One of `keys` or `key_aliases` must be provided.

### Block Key (NEW in v1.81.0)

```http
POST /key/block
Content-Type: application/json

{
  "keys": ["sk-litellm-1234567890abcdef"]
}
```

Blocks a key without deleting it. Blocked keys will receive `403 Forbidden` on API calls.

### Unblock Key (NEW in v1.81.0)

```http
POST /key/unblock
Content-Type: application/json

{
  "keys": ["sk-litellm-1234567890abcdef"]
}
```

Re-enables a previously blocked key.

### Regenerate Key (NEW in v1.81.0)

```http
POST /key/regenerate
Content-Type: application/json

{
  "key": "sk-litellm-old-key",
  "new_key": "sk-litellm-custom-new-key",
  "duration": "30d"
}
```

Or using path parameter:

```http
POST /key/sk-litellm-old-key/regenerate
```

Rotates a key while preserving all its settings (budget, models, team, etc.). If `new_key` is not provided, a new key is auto-generated.

### List Keys

```http
GET /key/list?page=1&page_size=25
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `int` | `1` | Page number |
| `page_size` | `int` | `25` | Items per page |
| `team_id` | `string` | - | Filter by team |
| `user_id` | `string` | - | Filter by user |
| `organization_id` | `string` | - | Filter by organization |
| `key_alias` | `string` | - | Filter by key alias |
| `search_term` | `string` | - | Search across keys |
| `include_deleted` | `boolean` | `false` | Include deleted keys |

---

## User Management

### Create Internal User

```http
POST /user/new
Content-Type: application/json

{
  "user_id": "litemaas_user_12345",
  "user_alias": "John Doe",
  "user_email": "john.doe@company.com",
  "user_role": "internal_user",
  "teams": ["team_67890"],
  "max_budget": 500.00,
  "models": ["gpt-4o", "gpt-3.5-turbo"],
  "auto_create_key": true,
  "tpm_limit": 2000,
  "rpm_limit": 120,
  "budget_duration": "monthly",
  "metadata": {
    "source": "litemaas",
    "subscription_tier": "premium"
  }
}
```

**New optional fields in v1.81.0:**

| Field | Type | Description |
|-------|------|-------------|
| `sso_user_id` | `string` | SSO provider user ID |
| `organizations` | `string[]` | Organization IDs to add user to |
| `send_invite_email` | `boolean` | Send invite email on creation |
| `guardrails` | `string[]` | Active guardrails for the user |
| `object_permission` | `object` | Object-level permissions |

**Available `user_role` values:**
- `"proxy_admin"` - Full admin access
- `"proxy_admin_viewer"` - Admin read-only access
- `"internal_user"` - Regular user
- `"internal_user_viewer"` - User read-only access

**Response**:

```json
{
  "user_id": "litemaas_user_12345",
  "key": "sk-litellm-auto-generated-key",
  "expires": null,
  "max_budget": 500.0,
  "user_email": "john.doe@company.com",
  "user_role": "internal_user",
  "teams": ["team_67890"],
  "user_alias": "John Doe",
  "created_at": "2024-07-24T14:06:00Z",
  "updated_at": "2024-07-24T14:06:00Z"
}
```

**Note**: The response extends `GenerateKeyResponse` - the `key` field contains the auto-created API key when `auto_create_key` is `true` (default).

### Create User with Team-Specific Budgets

New in v1.81.0, you can specify per-team budgets when creating users:

```json
{
  "user_id": "litemaas_user_12345",
  "teams": [
    {
      "team_id": "team_67890",
      "max_budget_in_team": 100.0,
      "user_role": "user"
    }
  ]
}
```

### Get User Information

```http
GET /user/info?user_id=litemaas_user_12345
```

**Response**:

```json
{
  "user_id": "litemaas_user_12345",
  "user_info": {
    "user_id": "litemaas_user_12345",
    "max_budget": 500.0,
    "spend": 125.50,
    "user_email": "john.doe@company.com",
    "user_alias": "John Doe",
    "models": ["gpt-4o", "gpt-3.5-turbo"],
    "tpm_limit": 2000,
    "rpm_limit": 120,
    "user_role": "internal_user",
    "teams": ["team_67890"],
    "budget_duration": "monthly",
    "budget_reset_at": "2024-08-01T00:00:00Z",
    "metadata": {"source": "litemaas"},
    "sso_user_id": null,
    "created_at": "2024-07-24T14:06:00Z",
    "updated_at": "2024-07-24T14:06:00Z"
  },
  "keys": [...],
  "teams": [...]
}
```

### Update User

```http
POST /user/update
Content-Type: application/json

{
  "user_id": "litemaas_user_12345",
  "max_budget": 750.00,
  "user_role": "internal_user",
  "models": ["gpt-4o", "gpt-3.5-turbo", "claude-3-opus"],
  "metadata": {"subscription_tier": "enterprise"}
}
```

Either `user_id` or `user_email` must be provided.

### Delete User

```http
POST /user/delete
Content-Type: application/json

{
  "user_ids": ["litemaas_user_12345"]
}
```

### List Users

```http
GET /user/list?page=1&page_size=25
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `int` | `1` | Page number |
| `page_size` | `int` | `25` | Items per page (max 100) |
| `role` | `string` | - | Filter by user role |
| `user_ids` | `string` | - | Comma-separated user IDs |
| `sso_user_ids` | `string` | - | Comma-separated SSO user IDs (NEW) |
| `user_email` | `string` | - | Filter by email (partial match) |
| `team` | `string` | - | Filter by team ID |
| `sort_by` | `string` | - | Sort column (`user_id`, `user_email`, `created_at`, `spend`, `user_alias`, `user_role`) |
| `sort_order` | `string` | `"asc"` | Sort order (`asc` or `desc`) |

### Bulk Update Users (NEW in v1.81.0)

```http
POST /user/bulk_update
Content-Type: application/json

{
  "users": [
    {
      "user_id": "user_1",
      "max_budget": 200.0
    },
    {
      "user_id": "user_2",
      "max_budget": 300.0
    }
  ]
}
```

**Response**:

```json
{
  "results": [...],
  "total_requested": 2,
  "successful_updates": 2,
  "failed_updates": 0
}
```

**Limit**: Maximum 500 users per batch.

---

## Team Management

### Create Team

```http
POST /team/new
Content-Type: application/json

{
  "team_alias": "Engineering Team",
  "team_id": "litemaas_team_eng",
  "max_budget": 2000.00,
  "models": ["gpt-4o", "claude-3-opus"],
  "tpm_limit": 10000,
  "rpm_limit": 600,
  "budget_duration": "monthly",
  "metadata": {
    "department": "engineering",
    "cost_center": "eng-001"
  },
  "admins": ["litemaas_user_12345"],
  "members_with_roles": [
    {
      "user_id": "litemaas_user_12345",
      "role": "admin"
    }
  ]
}
```

**New optional fields in v1.81.0:**

| Field | Type | Description |
|-------|------|-------------|
| `router_settings` | `dict` | Custom router settings for the team |
| `model_rpm_limit` | `dict` | Model-specific RPM limits, e.g., `{"gpt-4o": 100}` |
| `model_tpm_limit` | `dict` | Model-specific TPM limits |
| `team_member_budget` | `float` | Default budget per team member |
| `team_member_rpm_limit` | `int` | Default RPM limit per team member |
| `team_member_tpm_limit` | `int` | Default TPM limit per team member |
| `team_member_budget_duration` | `string` | Budget reset period for members |
| `team_member_key_duration` | `string` | Default key duration for members |
| `guardrails` | `string[]` | Active guardrails for the team |
| `object_permission` | `object` | Object-level permissions |
| `allowed_vector_store_indexes` | `array` | Allowed vector store indexes |
| `allowed_passthrough_routes` | `list` | Allowed passthrough routes |
| `model_aliases` | `dict` | Model alias mappings |
| `tags` | `list` | Team tags |

### Update Team

```http
POST /team/update
Content-Type: application/json

{
  "team_id": "litemaas_team_eng",
  "max_budget": 3000.00,
  "models": ["gpt-4o", "claude-3-opus", "claude-3.5-sonnet"],
  "team_member_budget": 200.0,
  "team_member_rpm_limit": 30
}
```

### Get Team Information

```http
GET /team/info?team_id=litemaas_team_eng
```

### List Teams

```http
GET /team/list?page=1&page_size=25
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `int` | `1` | Page number |
| `page_size` | `int` | `25` | Items per page (max 100) |
| `user_id` | `string` | - | Filter by user ID |
| `sort_by` | `string` | - | Sort column |
| `sort_order` | `string` | `"asc"` | Sort order |

### List Teams v2 (NEW in v1.81.0)

```http
GET /v2/team/list
```

Enhanced version with additional fields in the response.

### Delete Team

```http
POST /team/delete
Content-Type: application/json

{
  "team_ids": ["litemaas_team_eng"]
}
```

### Add Team Member

```http
POST /team/member_add
Content-Type: application/json

{
  "team_id": "litemaas_team_eng",
  "member": {
    "user_id": "litemaas_user_67890",
    "role": "user"
  },
  "max_budget_in_team": 200.0
}
```

### Bulk Add Team Members (NEW in v1.81.0)

```http
POST /team/bulk_member_add
Content-Type: application/json

{
  "team_id": "litemaas_team_eng",
  "members": [
    {"user_id": "user_1", "role": "user"},
    {"user_id": "user_2", "role": "admin"}
  ]
}
```

### Remove Team Member

```http
POST /team/member_delete
Content-Type: application/json

{
  "team_id": "litemaas_team_eng",
  "user_id": "litemaas_user_67890"
}
```

Either `user_id` or `user_email` can be provided.

### Block/Unblock Team (NEW in v1.81.0)

```http
POST /team/block
Content-Type: application/json

{
  "team_id": "litemaas_team_eng"
}
```

```http
POST /team/unblock
Content-Type: application/json

{
  "team_id": "litemaas_team_eng"
}
```

### Add/Remove Team Models (NEW in v1.81.0)

```http
POST /team/model/add
Content-Type: application/json

{
  "team_id": "litemaas_team_eng",
  "models": ["new-model-name"]
}
```

```http
POST /team/model/delete
Content-Type: application/json

{
  "team_id": "litemaas_team_eng",
  "models": ["model-to-remove"]
}
```

---

## Budget Management

### Create Budget

```http
POST /budget/new
Content-Type: application/json

{
  "budget_id": "eng_team_monthly",
  "max_budget": 2000.00,
  "soft_budget": 1800.00,
  "budget_duration": "monthly",
  "tpm_limit": 10000,
  "rpm_limit": 600,
  "max_parallel_requests": 50,
  "model_max_budget": {
    "gpt-4o": {
      "max_budget": 500.0,
      "budget_duration": "1d",
      "tpm_limit": 1000,
      "rpm_limit": 100
    }
  }
}
```

**Note**: The `budget_id` is auto-generated if not provided. Fields like `team_id`, `reset_at`, `soft_limit`, and `alert_emails` from the old docs are **not** part of the `BudgetNewRequest` model - budgets are associated with teams/keys/users at the entity level, not in the budget definition itself.

### Update Budget

```http
POST /budget/update
Content-Type: application/json

{
  "budget_id": "eng_team_monthly",
  "max_budget": 2500.00,
  "soft_budget": 2200.00
}
```

`budget_id` is required for updates.

### Get Budget Information

> **BREAKING CHANGE**: Changed from GET to POST. See Migration Guide above.

```http
POST /budget/info
Content-Type: application/json

{
  "budgets": ["eng_team_monthly"]
}
```

**Response** (array of raw database rows):

```json
[
  {
    "budget_id": "eng_team_monthly",
    "max_budget": 2000.0,
    "soft_budget": 1800.0,
    "max_parallel_requests": 50,
    "tpm_limit": 10000,
    "rpm_limit": 600,
    "model_max_budget": null,
    "budget_duration": "monthly",
    "budget_reset_at": "2024-08-01T00:00:00Z",
    "created_at": "2024-07-01T00:00:00Z"
  }
]
```

### Get Budget Settings

```http
GET /budget/settings?budget_id=eng_team_monthly
```

Returns a list of configurable fields with their current values and descriptions. Useful for building admin UIs.

### List All Budgets

```http
GET /budget/list
```

Requires `proxy_admin` role. Returns all budget entries.

### Delete Budget

```http
POST /budget/delete
Content-Type: application/json

{
  "id": "eng_team_monthly"
}
```

---

## LLM Operations (OpenAI Compatible)

### Chat Completions

```http
POST /chat/completions
Content-Type: application/json
Authorization: Bearer sk-litellm-1234567890abcdef

{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 150
}
```

Also available at `/v1/chat/completions`, `/engines/{model}/chat/completions`, `/openai/deployments/{model}/chat/completions`.

### Text Completions

```http
POST /completions
Content-Type: application/json
Authorization: Bearer sk-litellm-1234567890abcdef

{
  "model": "gpt-3.5-turbo-instruct",
  "prompt": "Once upon a time",
  "max_tokens": 50,
  "temperature": 0.7
}
```

### Embeddings

```http
POST /embeddings
Content-Type: application/json
Authorization: Bearer sk-litellm-1234567890abcdef

{
  "model": "text-embedding-ada-002",
  "input": "Hello world"
}
```

---

## Rate Limits & Quotas

### Default Limits

- **Requests per minute**: Configurable per key via `rpm_limit`
- **Tokens per minute**: Configurable per key via `tpm_limit`
- **Budget limits**: Configurable per key via `max_budget`
- **Parallel requests**: Configurable per key via `max_parallel_requests`

### Rate Limit Hierarchy

Limits are enforced at multiple levels (from most to least specific):

1. **Model-per-key level** - `model_tpm_limit`, `model_rpm_limit` per key
2. **API Key level** - `max_parallel_requests`, `tpm_limit`, `rpm_limit`
3. **User level** - `user_tpm_limit`, `user_rpm_limit`
4. **Team level** - `team_tpm_limit`, `team_rpm_limit`
5. **End-user level** - `end_user_tpm_limit`, `end_user_rpm_limit`
6. **Global level** - `global_max_parallel_requests`

### Limit Headers

LiteLLM returns rate limit information in response headers:

```http
x-ratelimit-limit-requests: 60
x-ratelimit-remaining-requests: 45
x-ratelimit-limit-tokens: 1000
x-ratelimit-remaining-tokens: 750
```

**Headers returned:**

| Header | Description |
|--------|-------------|
| `x-ratelimit-limit-requests` | Total RPM limit for the key |
| `x-ratelimit-remaining-requests` | Remaining requests in current window |
| `x-ratelimit-limit-tokens` | Total TPM limit for the key |
| `x-ratelimit-remaining-tokens` | Remaining tokens in current window |

**Headers NOT returned:**
- `x-ratelimit-reset-requests` - No reset timestamp is provided
- `x-ratelimit-reset-tokens` - No reset timestamp is provided

**Note**: Headers are only included when limits are configured on the key. If no `rpm_limit` is set, the request-related headers are omitted. Same for `tpm_limit` and token-related headers.

### Limit Types (NEW in v1.81.0)

Keys can specify limit enforcement types:

| Type | Description |
|------|-------------|
| `"guaranteed_throughput"` | Hard limit - always enforced |
| `"best_effort_throughput"` | Soft limit - best effort enforcement |
| `"dynamic"` | Dynamic limit adjustment |

Set via `rpm_limit_type` and `tpm_limit_type` on key creation/update.

---

## Integration Best Practices

### 1. Service Health Monitoring

```typescript
// Health check with timeout - use the K8s standard endpoint
async checkLiteLLMHealth(): Promise<boolean> {
  try {
    const response = await axios.get('/health/liveness', {
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}
```

### 2. Key Generation for Subscriptions

```typescript
async createLiteLLMKey(subscription: Subscription): Promise<string> {
  const keyRequest = {
    key_alias: generateUniqueKeyAlias(subscription.name),
    duration: subscription.duration,
    models: subscription.allowedModels,
    max_budget: subscription.budget,
    soft_budget: subscription.budget * 0.9,  // alert at 90%
    user_id: subscription.userId,
    team_id: subscription.teamId,
    metadata: {
      subscription_id: subscription.id,
      created_by: 'litemaas'
    }
  };

  const response = await this.liteLLMClient.post('/key/generate', keyRequest);
  return response.data.key;
}
```

### 3. Spend Tracking Integration

```typescript
async syncSpendData(apiKey: string): Promise<void> {
  // v1.81.0: response is nested under .info
  const response = await this.liteLLMClient.get('/key/info', {
    params: { key: apiKey }
  });
  const keyInfo = response.data.info;  // NOTE: unwrap .info

  await this.updateApiKeySpend(apiKey, {
    currentSpend: keyInfo.spend,
    lastSyncAt: new Date(),
    budgetUtilization: keyInfo.max_budget
      ? (keyInfo.spend / keyInfo.max_budget) * 100
      : null
  });
}
```

### 4. Budget Tracking

```typescript
async getBudgetStatus(budgetId: string): Promise<BudgetStatus> {
  // v1.81.0: POST with JSON body, response is an array
  const response = await this.liteLLMClient.post('/budget/info', {
    budgets: [budgetId]
  });

  const budget = response.data[0]; // first item in array
  // 'remaining' and 'spend' must be computed separately
  return {
    budgetId: budget.budget_id,
    maxBudget: budget.max_budget,
    softBudget: budget.soft_budget,
    duration: budget.budget_duration,
    resetAt: budget.budget_reset_at,
  };
}
```

### 5. Key Lifecycle Management

```typescript
// Block a key (new in v1.81.0) - alternative to delete
async blockKey(apiKey: string): Promise<void> {
  await this.liteLLMClient.post('/key/block', {
    keys: [apiKey]
  });
}

// Rotate a key (new in v1.81.0)
async rotateKey(oldKey: string): Promise<string> {
  const response = await this.liteLLMClient.post('/key/regenerate', {
    key: oldKey,
    duration: '30d'
  });
  return response.data.key; // new key value
}

// Delete by alias (new in v1.81.0)
async deleteKeyByAlias(alias: string): Promise<void> {
  await this.liteLLMClient.post('/key/delete', {
    key_aliases: [alias]
  });
}
```

### 6. Error Handling

```typescript
interface LiteLLMError {
  detail: string | {
    error: string;
  } | Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}

async handleLiteLLMError(error: AxiosError<LiteLLMError>): Promise<never> {
  if (error.response?.status === 422) {
    const detail = error.response.data?.detail;
    throw new ValidationError('LiteLLM validation failed', detail);
  }

  if (error.response?.status === 401) {
    throw new AuthenticationError('Invalid LiteLLM API key');
  }

  if (error.response?.status === 403) {
    throw new AuthorizationError('Insufficient permissions or key blocked');
  }

  if (error.response?.status === 404) {
    throw new NotFoundError('Resource not found');
  }

  if (error.response?.status === 429) {
    // Rate limited - check headers for remaining quota
    const remaining = error.response.headers['x-ratelimit-remaining-requests'];
    throw new RateLimitError('Rate limit exceeded', { remaining });
  }

  throw new ServiceError('LiteLLM service error', error.message);
}
```

---

## Data Model Mappings

### LiteMaaS to LiteLLM User Mapping

```typescript
interface UserSyncMapping {
  // LiteMaaS User          -> LiteLLM Field
  id: string;                // -> user_id
  username: string;          // -> user_alias
  email: string;             // -> user_email
  roles: string[];           // -> user_role (single role string)
  maxBudget: number;         // -> max_budget
  currentSpend: number;      // -> tracked via spend sync
  tpmLimit: number;          // -> tpm_limit
  rpmLimit: number;          // -> rpm_limit
  liteLLMUserId: string;     // -> LiteLLM user_id mapping
  lastSyncAt: Date;          // -> sync timestamp (LiteMaaS-side)
  syncStatus: string;        // -> sync status tracking (LiteMaaS-side)
  ssoUserId: string;         // -> sso_user_id (NEW)
  organizations: string[];   // -> organizations (NEW)
}
```

### LiteMaaS to LiteLLM API Key Mapping

```typescript
interface ApiKeySyncMapping {
  // LiteMaaS ApiKey         -> LiteLLM Field
  subscriptionId: string;    // -> metadata.subscription_id
  expiresAt: Date;           // -> duration (calculated)
  maxBudget: number;         // -> max_budget
  softBudget: number;        // -> soft_budget (NEW)
  currentSpend: number;      // -> tracked via key/info .info.spend (CHANGED: nested)
  tpmLimit: number;          // -> tpm_limit
  rpmLimit: number;          // -> rpm_limit
  teamId: string;            // -> team_id
  organizationId: string;    // -> organization_id (NEW)
  liteLLMKeyId: string;      // -> LiteLLM key mapping
  liteLLMKeyAlias: string;   // -> key_alias
  keyType: string;           // -> key_type (NEW: default|llm_api|management|read_only)
  autoRotate: boolean;       // -> auto_rotate (NEW)
  rotationInterval: string;  // -> rotation_interval (NEW)
  blocked: boolean;          // -> blocked (NEW: via /key/block, /key/unblock)
  lastSyncAt: Date;          // -> sync timestamp (LiteMaaS-side)
  syncStatus: string;        // -> sync status tracking (LiteMaaS-side)
}
```

### LiteMaaS Team to LiteLLM Team Mapping

```typescript
interface TeamSyncMapping {
  // LiteMaaS Team           -> LiteLLM Field
  id: string;                // -> team_id
  name: string;              // -> team_alias
  maxBudget: number;         // -> max_budget
  currentSpend: number;      // -> tracked via spend sync
  budgetDuration: string;    // -> budget_duration
  tpmLimit: number;          // -> tpm_limit
  rpmLimit: number;          // -> rpm_limit
  memberBudget: number;      // -> team_member_budget (NEW)
  memberRpmLimit: number;    // -> team_member_rpm_limit (NEW)
  memberTpmLimit: number;    // -> team_member_tpm_limit (NEW)
  modelRpmLimit: object;     // -> model_rpm_limit (NEW)
  modelTpmLimit: object;     // -> model_tpm_limit (NEW)
  routerSettings: object;    // -> router_settings (NEW)
  liteLLMTeamId: string;     // -> LiteLLM team mapping
  lastSyncAt: Date;          // -> sync timestamp (LiteMaaS-side)
  syncStatus: string;        // -> sync status tracking (LiteMaaS-side)
}
```

---

## New Endpoints Summary (v1.81.0)

These endpoints are new since v1.74.3 and may be useful for LiteMaaS:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health/liveness` | GET | K8s-standard liveness probe |
| `/key/block` | POST | Block a key without deleting it |
| `/key/unblock` | POST | Unblock a previously blocked key |
| `/key/regenerate` | POST | Rotate/regenerate a key |
| `/key/{key}/regenerate` | POST | Rotate a specific key (path param) |
| `/v2/key/info` | POST | Query key info via POST with body |
| `/key/list` | GET | Paginated key listing with filters |
| `/key/aliases` | GET | List all key aliases |
| `/v2/team/list` | GET | Enhanced team listing |
| `/team/block` | POST | Block a team |
| `/team/unblock` | POST | Unblock a team |
| `/team/bulk_member_add` | POST | Batch add team members |
| `/team/member_update` | POST | Update team member settings |
| `/team/model/add` | POST | Add models to team |
| `/team/model/delete` | POST | Remove models from team |
| `/user/bulk_update` | POST | Batch update users (max 500) |
| `/user/daily/activity` | GET | User spend analytics (beta) |
| `/budget/settings` | GET | Get configurable budget fields |
| `/budget/list` | GET | List all budgets |

---

## Additional Resources

- [LiteLLM Documentation](https://docs.litellm.ai/)
- [OpenAI API Compatibility](https://docs.litellm.ai/docs/proxy/openai_compatible)
- [LiteLLM Admin Panel](http://localhost:4000/ui) (when running)
- [Model Cost Map](https://models.litellm.ai/)

---

_This documentation is based on LiteLLM v1.81.0 source code analysis. Updated from v1.74.3. All endpoint schemas verified against actual handler code in the LiteLLM repository._

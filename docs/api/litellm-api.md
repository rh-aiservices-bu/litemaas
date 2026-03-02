# LiteLLM API Integration Reference

> **Version**: 1.81.0
> **Base URL**: http://localhost:4000  
> **Authentication**: API Key Header (`x-litellm-api-key`)  
> **Integration Status**: ✅ **FULLY IMPLEMENTED** - All critical endpoints integrated

This document provides a comprehensive reference for integrating LiteMaaS with the LiteLLM API server.

**🎉 Integration Complete**: All migration phases have been successfully implemented.

## 🔐 Authentication

All API calls require authentication via API key header:

```http
x-litellm-api-key: sk-your-api-key-here
```

## 📋 Quick Reference

### Essential Endpoints for LiteMaaS Integration

| Endpoint             | Method | Purpose                                  | Priority     |
| -------------------- | ------ | ---------------------------------------- | ------------ |
| `/health/liveness` | GET    | Service health check                     | **Critical** |
| `/model/info`        | GET    | List available models with detailed info | **Critical** |
| `/key/generate`      | POST   | Create API keys                          | **Critical** |
| `/key/info`          | GET    | Get key details                          | **High**     |
| `/user/new`          | POST   | Create internal users                    | **High**     |
| `/budget/info`       | GET    | Budget tracking                          | **Medium**   |
| `/team/new`          | POST   | Team management                          | **Medium**   |

---

## 🏥 Health & Monitoring

### Health Check

```http
GET /health/liveliness
```

**Response**: `200 OK` - Service is healthy

**Integration Use**: Use for service availability checks in LiteMaaS health monitoring.

---

## 🤖 Model Management

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

## 🔑 API Key Management

### Generate API Key

```http
POST /key/generate
Content-Type: application/json

{
  "key_alias": "production-key_a5f2b1c3", // Unique alias with UUID suffix
  "duration": "30d",
  "models": ["gpt-4o", "gpt-3.5-turbo"],
  "max_budget": 100.00,
  "user_id": "user_12345",
  "team_id": "team_67890",
  "tpm_limit": 1000,
  "rpm_limit": 60,
  "budget_duration": "monthly",
  "metadata": {
    "subscription_id": "sub_abc123",
    "created_by": "litemaas"
  },
  "permissions": {
    "allow_chat_completions": true,
    "allow_embeddings": true
  },
  "tags": ["production", "user-subscription"]
}
```

**Response**:

```json
{
  "key": "sk-litellm-1234567890abcdef",
  "key_name": "user-john-production",
  "expires": "2024-08-24T14:06:00Z",
  "token_id": "token_abc123",
  "user_id": "user_12345",
  "team_id": "team_67890",
  "max_budget": 100.0,
  "current_spend": 0.0,
  "created_at": "2024-07-24T14:06:00Z"
}
```

### Get Key Information

```http
GET /key/info
x-litellm-api-key: sk-litellm-1234567890abcdef
```

**Response** (v1.81.0+):

```json
{
  "key": "sk-litellm-1234567890abcdef",
  "info": {
    "key_name": "user-john-production",
    "key_alias": "production-key_a5f2b1c3",
    "soft_budget_cooldown": false,
    "spend": 15.75,
    "max_budget": 100.0,
    "soft_budget": 80.0,
    "models": ["gpt-4o", "gpt-3.5-turbo"],
    "tpm_limit": 1000,
    "rpm_limit": 60,
    "max_parallel_requests": null,
    "budget_duration": "monthly",
    "budget_reset_at": "2024-08-01T00:00:00Z",
    "model_max_budget": {},
    "model_rpm_limit": {},
    "model_tpm_limit": {},
    "model_spend": {},
    "user_id": "user_12345",
    "team_id": "team_67890",
    "organization_id": null,
    "expires": "2024-08-24T14:06:00Z",
    "budget_id": "budget_xyz",
    "blocked": false,
    "tags": ["production"],
    "metadata": {"subscription_id": "sub_abc123", "created_by": "litemaas"},
    "allowed_cache_controls": [],
    "allowed_routes": [],
    "permissions": {},
    "created_at": "2024-07-24T14:06:00Z",
    "updated_at": "2024-07-24T14:06:00Z",
    "litellm_budget_table": {
      "budget_id": null,
      "max_budget": 100.0,
      "soft_budget": 80.0,
      "tpm_limit": null,
      "rpm_limit": null,
      "max_parallel_requests": null,
      "model_max_budget": {},
      "budget_duration": "monthly",
      "budget_reset_at": "2024-08-01T00:00:00Z",
      "created_at": "2024-07-24T14:06:00Z",
      "updated_at": "2024-07-24T14:06:00Z"
    }
  }
}
```

> **Note**: In v1.74.x, the response was flat (without the `key`/`info` wrapper). LiteMaaS handles both formats.
>
> **Important**: `soft_budget` is stored in the nested `litellm_budget_table` object. While it may also appear at the top level of `.info`, the authoritative value is in `.info.litellm_budget_table.soft_budget`. LiteMaaS reads from both locations with the budget table taking precedence.

### Update Key Settings

```http
POST /key/update
Content-Type: application/json

{
  "key": "sk-litellm-1234567890abcdef",
  "max_budget": 200.00,
  "models": ["gpt-4o", "gpt-3.5-turbo", "claude-3-opus"]
}
```

### Delete/Block Key

```http
POST /key/delete
Content-Type: application/json

{
  "keys": ["sk-litellm-1234567890abcdef"]
}
```

---

## 👥 User Management

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

**Response**:

```json
{
  "user_id": "litemaas_user_12345",
  "user_email": "john.doe@company.com",
  "teams": ["team_67890"],
  "max_budget": 500.0,
  "spend": 0.0,
  "api_key": "sk-litellm-auto-generated-key",
  "created_at": "2024-07-24T14:06:00Z"
}
```

### Get User Information

```http
GET /user/info?user_id=litemaas_user_12345
```

### List Users

```http
GET /user/list
```

---

## 🏢 Team Management

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
  "admins": ["litemaas_user_12345"]
}
```

### Get Team Information

```http
GET /team/info?team_id=litemaas_team_eng
```

---

## 💰 Budget Management

### Create Budget

```http
POST /budget/new
Content-Type: application/json

{
  "budget_id": "eng_team_monthly",
  "max_budget": 2000.00,
  "duration": "monthly",
  "team_id": "litemaas_team_eng",
  "reset_at": "first_of_month",
  "soft_limit": 1800.00,
  "alert_emails": ["admin@company.com"]
}
```

### Get Budget Information

```http
GET /budget/info?budget_id=eng_team_monthly
```

**Response**:

```json
{
  "budget_id": "eng_team_monthly",
  "max_budget": 2000.0,
  "spend": 850.3,
  "remaining": 1149.7,
  "reset_at": "2024-08-01T00:00:00Z",
  "soft_limit": 1800.0,
  "alert_triggered": false,
  "team_id": "litemaas_team_eng"
}
```

---

## 🔍 Audit & Analytics

### Get Audit Logs

```http
GET /audit?user_id=litemaas_user_12345&limit=100
```

**Response**:

```json
{
  "data": [
    {
      "id": "audit_123",
      "timestamp": "2024-07-24T14:06:00Z",
      "event_type": "key_created",
      "user_id": "litemaas_user_12345",
      "details": {
        "key_name": "user-john-production",
        "max_budget": 100.0
      }
    }
  ]
}
```

---

## 🚀 LLM Operations (OpenAI Compatible)

### Chat Completions

```http
POST /chat/completions
Content-Type: application/json
x-litellm-api-key: sk-litellm-1234567890abcdef

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

### Text Completions

```http
POST /completions
Content-Type: application/json
x-litellm-api-key: sk-litellm-1234567890abcdef

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
x-litellm-api-key: sk-litellm-1234567890abcdef

{
  "model": "text-embedding-ada-002",
  "input": "Hello world"
}
```

---

## 🔧 Integration Best Practices

### 1. Service Health Monitoring

```typescript
// Health check with timeout
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
    key_alias: generateUniqueKeyAlias(subscription.name), // e.g., "production-key_a5f2b1c3"
    duration: subscription.duration,
    models: subscription.allowedModels,
    max_budget: subscription.budget,
    user_id: subscription.userId,
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
  const keyInfo = await this.getLiteLLMKeyInfo(apiKey);

  // Update local database with spend info
  await this.updateApiKeySpend(apiKey, {
    currentSpend: keyInfo.spend,
    lastSyncAt: new Date(),
    budgetUtilization: (keyInfo.spend / keyInfo.max_budget) * 100
  });
}
```

### 4. Error Handling

```typescript
interface LiteLLMError {
  detail: Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}

async handleLiteLLMError(error: AxiosError): Promise<never> {
  if (error.response?.status === 422) {
    const validationError = error.response.data as LiteLLMError;
    throw new ValidationError('LiteLLM validation failed', validationError.detail);
  }

  if (error.response?.status === 401) {
    throw new AuthenticationError('Invalid LiteLLM API key');
  }

  throw new ServiceError('LiteLLM service error', error.message);
}
```

---

## 📊 Data Model Mappings

### LiteMaaS → LiteLLM User Mapping (IMPLEMENTED)

```typescript
interface UserSyncMapping {
  // LiteMaaS User → LiteLLM User
  id: string; // → user_id
  username: string; // → user_alias
  email: string; // → user_email
  roles: string[]; // → user_role (convert to single role)
  // ✅ IMPLEMENTED in LiteMaaS:
  maxBudget: number; // → max_budget
  currentSpend: number; // → tracked via spend sync
  tpmLimit: number; // → tpm_limit
  rpmLimit: number; // → rpm_limit
  liteLLMUserId: string; // → LiteLLM user_id mapping
  lastSyncAt: Date; // → sync timestamp
  syncStatus: string; // → sync status tracking
}
```

### LiteMaaS → LiteLLM API Key Mapping (IMPLEMENTED)

```typescript
interface ApiKeySyncMapping {
  // LiteMaaS ApiKey → LiteLLM Key
  subscriptionId: string; // → metadata.subscription_id
  expiresAt: Date; // → duration (calculate)
  // ✅ IMPLEMENTED in LiteMaaS:
  maxBudget: number; // → max_budget
  softBudget: number; // → soft_budget (in litellm_budget_table)
  currentSpend: number; // → tracked via .info.spend
  tpmLimit: number; // → tpm_limit
  rpmLimit: number; // → rpm_limit
  budgetDuration: string; // → budget_duration
  budgetResetAt: Date; // → budget_reset_at (synced from LiteLLM)
  maxParallelRequests: number; // → max_parallel_requests
  teamId: string; // → team_id
  liteLLMKeyId: string; // → LiteLLM key mapping
  liteLLMKeyAlias: string; // → key_alias
  lastSyncAt: Date; // → sync timestamp
  syncStatus: string; // → sync status tracking
}
```

> **Note**: During sync, `soft_budget` is read from `.info.litellm_budget_table.soft_budget` (preferred) or `.info.soft_budget` (fallback). Empty objects (`{}`) for `model_max_budget`, `model_rpm_limit`, and `model_tpm_limit` are stored as `null` in the LiteMaaS database.

### LiteMaaS Team → LiteLLM Team Mapping (IMPLEMENTED)

```typescript
interface TeamSyncMapping {
  // LiteMaaS Team → LiteLLM Team
  id: string; // → team_id
  name: string; // → team_alias
  maxBudget: number; // → max_budget
  currentSpend: number; // → tracked via spend sync
  budgetDuration: string; // → budget_duration
  tpmLimit: number; // → tpm_limit
  rpmLimit: number; // → rpm_limit
  liteLLMTeamId: string; // → LiteLLM team mapping
  lastSyncAt: Date; // → sync timestamp
  syncStatus: string; // → sync status tracking
}
```

---

## 🚨 Rate Limits & Quotas

### Default Limits

- **Requests per minute**: 60 (configurable per key)
- **Tokens per minute**: 1000 (configurable per key)
- **Budget limits**: $100/month (configurable per key)

### Limit Headers

LiteLLM returns rate limit information in response headers:

```http
x-ratelimit-limit-requests: 60
x-ratelimit-remaining-requests: 45
x-ratelimit-reset-requests: 2024-07-24T14:07:00Z
x-ratelimit-limit-tokens: 1000
x-ratelimit-remaining-tokens: 750
```

---

## 📚 Additional Resources

- [LiteLLM Documentation](https://docs.litellm.ai/)
- [OpenAI API Compatibility](https://docs.litellm.ai/docs/proxy/openai_compatible)
- [LiteLLM Admin Panel](http://localhost:4000/ui) (when running)
- [Model Cost Map](https://models.litellm.ai/)

---

_This documentation is maintained alongside the LiteMaaS codebase and should be updated when LiteLLM API changes occur._

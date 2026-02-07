# LiteLLM Rate Limiting, Budget & Access Control Reference

## 1. Introduction & Context

LiteLLM is a proxy server that sits in front of 100+ LLM providers (OpenAI, Anthropic, Azure, etc.), exposing a unified OpenAI-compatible API. The proxy manages **virtual API keys**, **users**, **teams**, and **organizations** — each of which can have independent controls on usage.

This document describes **all mechanisms** for controlling usage within LiteLLM:

- **Rate limits** (RPM/TPM) — throttle request volume per time window
- **Spending budgets** — cap USD spend over a configurable duration
- **Model access control** — restrict which models an entity can call
- **Quotas** — per-model spend budgets on individual keys

The analysis is based on the codebase at commit `4c119c27ad` (HEAD of `main`).

### Key Terminology

| Term | Definition |
|------|-----------|
| **Virtual Key** | A proxy API key created via `/key/generate`. Maps to one or more backend LLM provider keys. Stored as a hashed token in `LiteLLM_VerificationToken`. |
| **RPM** | Requests per minute. The number of API calls allowed within a sliding window (default 60s). |
| **TPM** | Tokens per minute. Sum of prompt + completion tokens consumed within a sliding window. |
| **Max Parallel Requests** | Maximum number of concurrent in-flight requests for a key or team. |
| **Budget (hard)** | `max_budget` — maximum USD spend. Requests are **blocked** with HTTP 429 when `spend >= max_budget`. |
| **Budget (soft)** | `soft_budget` — warning threshold. Alerts are sent but requests **continue**. |
| **Budget Duration** | Time period after which spend resets (e.g., `"30d"`, `"1h"`, `"1mo"`). |
| **Model Group** | A logical model name (e.g., `"gpt-4"`) that may map to multiple backend deployments via the router. |
| **End User** | The `user` parameter passed in `/chat/completions` requests — represents the downstream consumer, distinct from the key owner. |

---

## 2. Architecture Overview — Three Control Planes

LiteLLM enforces usage control through three **independent** systems. A request must pass **all three** to proceed:

```
┌─────────────────────────────────────────────────────────────────┐
│                        INCOMING REQUEST                         │
│                    (with virtual API key)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  1. ACCESS CONTROL     │  Which models can this
              │  (Auth Layer)          │  key/user/team/org use?
              │                        │
              │  user_api_key_auth.py  │  ── Reject if model
              │  auth_checks.py        │     not in allowed list
              └────────────┬───────────┘
                           │ PASS
                           ▼
              ┌────────────────────────┐
              │  2. BUDGET CONTROL     │  Is the key/user/team/org
              │  (Auth Layer + Hooks)  │  within spending budget?
              │                        │
              │  auth_checks.py        │  ── Reject if spend
              │  max_budget_limiter.py │     >= max_budget
              └────────────┬───────────┘
                           │ PASS
                           ▼
              ┌────────────────────────┐
              │  3. RATE LIMITING      │  Is the key/user/team
              │  (Hooks)               │  within RPM/TPM limits?
              │                        │
              │  parallel_request_     │  ── Reject if counters
              │    limiter_v3.py       │     exceed limits
              └────────────┬───────────┘
                           │ PASS
                           ▼
              ┌────────────────────────┐
              │  REQUEST EXECUTES      │
              │  (routed to backend)   │
              └────────────────────────┘
```

**Source files**:
- `litellm/proxy/auth/user_api_key_auth.py` — main auth entry point, key validation
- `litellm/proxy/auth/auth_checks.py:80-104` — `common_checks()` function, budget + model access
- `litellm/proxy/hooks/__init__.py:20-26` — hook registry (`PROXY_HOOKS` dict)
- `litellm/proxy/utils.py:424-443` — `_add_proxy_hooks()`, hook initialization

---

## 3. Rate Limiting in Detail

### 3.1 Key/User/Team Rate Limiting (Always Active)

This system is **always active** — no configuration needed to enable it. It is auto-registered as part of the default proxy hooks.

**Implementation**: `_PROXY_MaxParallelRequestsHandler_v3` class in `litellm/proxy/hooks/parallel_request_limiter_v3.py:146-1647`.

**Registration**: Auto-registered via `PROXY_HOOKS["parallel_request_limiter"]` in `litellm/proxy/hooks/__init__.py:22`. The `_add_proxy_hooks()` method in `litellm/proxy/utils.py:424-443` iterates over all hooks and adds them as logging callbacks.

**Algorithm**: Sliding window counter. Window size is configurable via the `LITELLM_RATE_LIMIT_WINDOW_SIZE` environment variable (default: 60 seconds). See `parallel_request_limiter_v3.py:169`.

**Cache backends**:
- **Redis** (recommended for multi-instance deployments): Uses Lua scripts for atomic increment-and-check operations (`BATCH_RATE_LIMITER_SCRIPT`, `TOKEN_INCREMENT_SCRIPT`)
- **In-memory**: Fallback when Redis is not configured; works for single-instance deployments

**Three types of limits**:
1. **RPM** (`rpm_limit`) — requests per window
2. **TPM** (`tpm_limit`) — tokens per window (prompt + completion)
3. **Max Parallel Requests** (`max_parallel_requests`) — concurrent in-flight requests

#### Entities That Can Have Rate Limits

| Entity | Set via | Key params | Cache key format |
|--------|---------|------------|-----------------|
| API Key | `/key/generate` | `rpm_limit`, `tpm_limit`, `max_parallel_requests` | `{api_key:<hash>}:requests` / `:tokens` / `:max_parallel_requests` |
| User | `/user/new` | `rpm_limit`, `tpm_limit` | `{user:<user_id>}:requests` / `:tokens` |
| Team | `/team/new` | `rpm_limit`, `tpm_limit`, `max_parallel_requests` | `{team:<team_id>}:requests` / `:tokens` |
| Team Member | `/team/member_add` | `rpm_limit`, `tpm_limit` (inherited from membership) | `{team_member:<team_id>:<user_id>}:requests` / `:tokens` |
| End User | request `user` param | configured via end-user budget table | `{end_user:<end_user_id>}:requests` / `:tokens` |
| Organization | `/organization/new` | `rpm_limit`, `tpm_limit` | `{organization:<org_id>}:requests` / `:tokens` |
| Model-per-Key | `/key/generate` | `model_rpm_limit`, `model_tpm_limit` (dict) | `{model_per_key:<api_key>:<model>}:requests` / `:tokens` |
| Model-per-Team | team config | via team model settings in metadata | `{model_per_team:<team_id>:<model>}:requests` / `:tokens` |
| Model-per-Org | org config | via org model settings | `{model_per_organization:<org_id>:<model>}:requests` / `:tokens` |

Cache key generation is handled by `create_rate_limit_keys()` at `parallel_request_limiter_v3.py:278-289`:
```python
def create_rate_limit_keys(self, key, value, rate_limit_type):
    counter_key = f"{{{key}:{value}}}:{rate_limit_type}"
    return counter_key
```

The curly braces `{}` around `key:value` are Redis hash tags — they ensure all counters for the same entity land on the same Redis shard in cluster mode.

#### Request Flow Through the Rate Limiter

1. **`async_pre_call_hook()`** (`parallel_request_limiter_v3.py:1123-1209`) — entry point
2. Creates `RateLimitDescriptor` objects for each entity (key, user, team, etc.) at `_create_rate_limit_descriptors()` (`parallel_request_limiter_v3.py:794-918`)
3. Calls `should_rate_limit()` (`parallel_request_limiter_v3.py:448-589`)
4. If `OVER_LIMIT`, raises `HTTPException(429)` with `retry-after` header
5. On success, token counts are updated post-call via `async_log_success_event()` (`parallel_request_limiter_v3.py:1385-1546`)

#### Legacy Mode

You can revert to the v2 rate limiter by setting:
```
LEGACY_MULTI_INSTANCE_RATE_LIMITING=true
```
This swaps the hook class at `hooks/__init__.py:29-30`.

---

### 3.2 Model-Level Dynamic Rate Limiting (Opt-in)

This system is **NOT active by default** — it must be explicitly enabled. It provides **model capacity management** using priority-based admission control.

**Implementation**: `_PROXY_DynamicRateLimitHandlerV3` class in `litellm/proxy/hooks/dynamic_rate_limiter_v3.py:28-795`.

**Purpose**: Prevents overloading backend model deployments. The RPM/TPM values here represent the **capacity of the backend deployment**, not per-user limits.

#### How to Enable

```yaml
litellm_settings:
  callbacks:
    - dynamic_rate_limiter_v3
```

The callback is registered via `litellm/litellm_core_utils/litellm_logging.py` when the callback name `"dynamic_rate_limiter_v3"` is found in the configured callbacks list.

#### How It Works

1. **Get model capacity**: Reads `ModelGroupInfo.rpm` and `ModelGroupInfo.tpm` from the router for the requested model group (`dynamic_rate_limiter_v3.py:583-585`)
2. **Check saturation**: `_check_model_saturation()` (`dynamic_rate_limiter_v3.py:210-284`) queries current request/token counters from cache and calculates `saturation = current_count / capacity_limit`
3. **Three-phase rate limit check** (`dynamic_rate_limiter_v3.py:533-628`):
   - **Phase 1**: Read-only check of ALL limits (no counter increments)
   - **Phase 2**: Decide enforcement — if `saturation >= saturation_threshold`, enforce priority-based limits; otherwise, allow generous borrowing
   - **Phase 3**: Increment counters atomically only if the request will be allowed
4. Keys with higher explicit priority get preference; lower-priority keys may be rejected when saturated

#### Priority Configuration

```yaml
litellm_settings:
  priority_reservation_settings:
    default_priority: 0.25       # Weight for keys without explicit priority (25% of capacity)
    saturation_threshold: 0.50   # At what saturation level to start enforcing priorities
    saturation_check_cache_ttl: 60  # TTL in seconds for local cache reads
```

Priority is set per-key via metadata:
```json
{
  "metadata": {
    "priority": "prod"
  }
}
```

Priority weights are configured via `litellm.priority_reservation`:
```python
litellm.priority_reservation = {
    "prod": 0.75,    # 75% of capacity reserved for prod
    "staging": 0.25  # 25% for staging
}
```

**Important distinction**: This is NOT per-user rate limiting. It's global model capacity management. For per-user rate limits, use the key/team RPM/TPM limits from Section 3.1.

**Source files**:
- `litellm/proxy/hooks/dynamic_rate_limiter_v3.py:28-795` — full implementation
- `litellm/types/utils.py:3376-3399` — `PriorityReservationSettings` class
- `litellm/types/router.py:564-602` — `ModelGroupInfo` with `rpm`/`tpm` fields

---

## 4. Budget/Spend Control in Detail

### 4.1 Budget Hierarchy

Budgets are checked at multiple levels. All checks must pass. The enforcement order in `auth_checks.py:80-258` is:

| # | Level | Entity | Set via | Key fields | Enforcement location |
|---|-------|--------|---------|------------|---------------------|
| 1 | Virtual Key | API Key | `/key/generate` | `max_budget`, `soft_budget`, `budget_duration` | `user_api_key_auth.py:1058-1064` |
| 2 | Per-Model per Key | API Key + Model | `/key/generate` | `model_max_budget` (dict) | `user_api_key_auth.py:1084-1096` |
| 3 | Team | Team | `/team/new` | `max_budget`, `budget_duration` | `auth_checks.py:140-145` (`_team_max_budget_check`) |
| 4 | Organization | Organization | `/organization/new` | via `LiteLLM_BudgetTable` FK | `auth_checks.py:147-154` (`_organization_max_budget_check`) |
| 5 | Tag | Request tag | tag config | via `LiteLLM_BudgetTable` FK | `auth_checks.py:156-162` (`_tag_max_budget_check`) |
| 6 | User (personal) | User | `/user/new` | `max_budget`, `budget_duration` | `auth_checks.py:164-177` (only when key has no team) |
| 7 | Team Member | User within Team | `/team/member_add` | `max_budget_in_team` | `auth_checks.py:179-187` (`_check_team_member_budget`) |
| 8 | End User | Downstream user | end-user config | via `LiteLLM_BudgetTable` FK | `auth_checks.py:189-197` |
| 9 | Global Proxy | Entire proxy | config YAML `general_settings` | `max_budget`, `budget_duration` | `auth_checks.py:245-258` |
| 10 | Provider | LLM provider | config YAML `router_settings` | `budget_limit`, `time_period` | Router-level routing decision |

**Key rule**: When a key belongs to a team, the **team budget** takes precedence over the user's personal budget. The user personal budget check (level 6) only runs when `team_object is None or team_object.team_id is None` (see `auth_checks.py:166-167`). A team member can have an individual budget within the team via `max_budget_in_team` (level 7).

---

### 4.2 Hard Budget vs Soft Budget

**Hard budget** (`max_budget`):
- Request is **blocked** with `BudgetExceededError` (HTTP 429) when `spend >= max_budget`
- Checked in `_virtual_key_max_budget_check()` at `auth_checks.py:2117-2165`
- Also triggers a budget alert via `proxy_logging_obj.budget_alerts()` when the threshold is approaching

**Soft budget** (`soft_budget`):
- Alert sent when `spend >= soft_budget`, but request **continues**
- Checked in `_virtual_key_soft_budget_check()` at `auth_checks.py:2168-2204`
- Uses `soft_budget_cooldown` flag on the key to avoid repeated alerts

**Max budget alert** (80% warning):
- A pre-emptive alert fires when spend crosses 80% of `max_budget` but hasn't exceeded it yet
- Checked in `_virtual_key_max_budget_alert_check()` at `auth_checks.py:2207-2259`
- The 80% threshold is defined by `EMAIL_BUDGET_ALERT_MAX_SPEND_ALERT_PERCENTAGE` constant

---

### 4.3 Per-Model Budgets on Keys

Set via the `model_max_budget` parameter on `/key/generate`:
```json
{
  "model_max_budget": {
    "gpt-4": {"budget_limit": 10.00, "time_period": "1d"},
    "gpt-3.5-turbo": {"budget_limit": 50.00, "time_period": "30d"}
  }
}
```

Uses `BudgetConfig` type from `litellm/types/utils.py`.

**Implementation**: `_PROXY_VirtualKeyModelMaxBudgetLimiter` in `litellm/proxy/hooks/model_max_budget_limiter.py:20`.

**Registration**: Instantiated at module level in `litellm/proxy/proxy_server.py:1209-1212` and added as a logging callback:
```python
model_max_budget_limiter = _PROXY_VirtualKeyModelMaxBudgetLimiter(dual_cache=user_api_key_cache)
litellm.logging_callback_manager.add_litellm_callback(model_max_budget_limiter)
```

**Spend tracking**: Per key+model combination in `DualCache` with key format: `virtual_key_spend:<key_hash>:<model>:<duration>`.

When the budget is exceeded, raises `BudgetExceededError` with details about the key and model (`model_max_budget_limiter.py:78-80`).

---

### 4.4 Spend Tracking Pipeline

After a request executes successfully, spend is tracked through this pipeline:

1. **Response received** with token counts (prompt_tokens, completion_tokens)
2. **Cost calculated** using model pricing from `litellm.model_cost` map
3. **Spend callback fires**: `_ProxyDBLogger.async_log_success_event()` → `_PROXY_track_cost_callback()` in `litellm/proxy/hooks/proxy_track_cost_callback.py:116-241`
4. **Database updated** asynchronously via batch writer: `proxy_logging_obj.db_spend_update_writer.update_database()` (`proxy_track_cost_callback.py:171-182`). This uses `SpendUpdateQueue` to batch and aggregate updates.
5. **Cache updated** immediately (in-memory + Redis) for fast pre-call budget checks: `update_cache()` called via `asyncio.create_task()` (`proxy_track_cost_callback.py:185-195`)
6. **Spend log entry** created in `LiteLLM_SpendLogs` table with full request metadata
7. **Daily aggregation tables** updated: `LiteLLM_DailyUserSpend`, `LiteLLM_DailyTeamSpend`, etc.

Cache-hit responses have their cost set to `0.0` (`proxy_track_cost_callback.py:155-156`).

---

### 4.5 Budget Reset Mechanism

Budgets with a `budget_duration` are automatically reset by a cron job.

**Implementation**: `ResetBudgetJob` in `litellm/proxy/common_utils/reset_budget_job.py:19`.

**What it resets** (called from `reset_budget()` at line 28):
1. **Keys**: `reset_budget_for_litellm_keys()` — all keys where `budget_reset_at <= now()`
2. **Users**: `reset_budget_for_litellm_users()` — all users where `budget_reset_at <= now()`
3. **Teams**: `reset_budget_for_litellm_teams()` — all teams where `budget_reset_at <= now()`
4. **Budget Table entries** (End Users, Team Members): `reset_budget_for_litellm_budget_table()` — resets spend on `LiteLLM_BudgetTable` rows and related end users/team members

**Reset logic**: Sets `spend = 0` and advances `budget_reset_at = now() + duration_in_seconds(budget_duration)`.

**Scheduling**: Frequency configurable via `proxy_budget_rescheduler_min_time` / `proxy_budget_rescheduler_max_time` in `general_settings`.

**Duration format examples**:
| Format | Meaning |
|--------|---------|
| `"30s"` | 30 seconds |
| `"30m"` | 30 minutes |
| `"30h"` | 30 hours |
| `"30d"` | 30 days |
| `"1mo"` | 1 month |

---

## 5. Model Access Control

Keys, users, teams, and organizations can each restrict which models are accessible.

**Configuration**: Set via the `models` parameter (a list of model names) on the respective entity.

**Special values**:
- Empty list `[]` → access to all proxy models
- `["*"]` → access to all proxy models
- `["all-proxy-models"]` → access to all proxy models

**Enforcement order** in auth:
1. **Team model access** — `can_team_access_model()` at `auth_checks.py:117-130`
2. **User model access** (if no team) — `can_user_call_model()` at `auth_checks.py:132-138`
3. **Key model access** — `can_key_call_model()` at `user_api_key_auth.py:952-964`

**Core check**: `_can_object_call_model()` at `auth_checks.py:1911-1981`:
- Accepts model name (or list of models)
- Checks against the entity's allowed models list
- Supports model aliases (via `litellm.model_alias_map` and `llm_router.model_group_alias`)
- Supports team model aliases (via `team_model_aliases`)
- Raises `ProxyException` with HTTP 401 if access denied

Model access is checked during auth, **BEFORE** rate limits or budgets are evaluated.

---

## 6. Practical Guide — Complete Setup Example

### Use Case: Create a controlled virtual key for a user

#### Step 1: Create a user with an overall budget

```bash
curl -X POST http://localhost:4000/user/new \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-jane",
    "max_budget": 100.00,
    "budget_duration": "30d",
    "rpm_limit": 500,
    "tpm_limit": 100000
  }'
```

#### Step 2: Generate a key with model restrictions, rate limits, and budgets

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-jane",
    "models": ["gpt-4", "gpt-3.5-turbo"],
    "rpm_limit": 60,
    "tpm_limit": 50000,
    "max_parallel_requests": 5,
    "max_budget": 50.00,
    "soft_budget": 40.00,
    "budget_duration": "30d",
    "model_max_budget": {
      "gpt-4": {"budget_limit": 30.00, "time_period": "30d"},
      "gpt-3.5-turbo": {"budget_limit": 20.00, "time_period": "30d"}
    },
    "model_rpm_limit": {
      "gpt-4": 10,
      "gpt-3.5-turbo": 50
    },
    "model_tpm_limit": {
      "gpt-4": 10000,
      "gpt-3.5-turbo": 40000
    }
  }'
```

#### Step 3 (Optional): Team-based setup with member budgets

```bash
# Create team
curl -X POST http://localhost:4000/team/new \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "team_alias": "engineering",
    "models": ["gpt-4", "gpt-3.5-turbo"],
    "max_budget": 500.00,
    "budget_duration": "30d",
    "rpm_limit": 200,
    "tpm_limit": 200000
  }'

# Add member with individual budget within team
curl -X POST http://localhost:4000/team/member_add \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": "<team_id>",
    "member": {
      "role": "user",
      "user_id": "user-jane"
    },
    "max_budget_in_team": 100.00
  }'

# Generate key tied to team
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer sk-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-jane",
    "team_id": "<team_id>",
    "rpm_limit": 60,
    "tpm_limit": 50000,
    "max_budget": 50.00,
    "budget_duration": "30d"
  }'
```

#### Step 4: Monitor spend

```bash
# Check key spend
curl http://localhost:4000/key/info?key=sk-generated-key \
  -H "Authorization: Bearer sk-master-key"

# Check user spend
curl http://localhost:4000/user/info?user_id=user-jane \
  -H "Authorization: Bearer sk-master-key"

# Check team spend
curl http://localhost:4000/team/info?team_id=<team_id> \
  -H "Authorization: Bearer sk-master-key"
```

---

## 7. Complete Request Flow Diagram

The full enforcement order from request arrival to response:

```
REQUEST ARRIVES
     │
     ▼
┌──────────────────────────────────┐
│  user_api_key_auth()             │
│  (user_api_key_auth.py)          │
│                                  │
│  1. Validate API key exists      │
│  2. Check key not expired        │
│  3. Check key not blocked        │
│                                  │
│  4. Key model access check       │  ← can_key_call_model()
│     (key.models list)            │     user_api_key_auth.py:952
│                                  │
│  5. Key hard budget check        │  ← _virtual_key_max_budget_check()
│     spend >= max_budget → 429    │     user_api_key_auth.py:1060
│                                  │
│  6. Key soft budget alert        │  ← _virtual_key_soft_budget_check()
│     spend >= soft_budget → alert │     user_api_key_auth.py:1074
│                                  │
│  7. Per-model budget check       │  ← model_max_budget_limiter
│     model spend >= limit → 429   │     user_api_key_auth.py:1084
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  common_checks()                 │
│  (auth_checks.py:80-258)         │
│                                  │
│  1. Team blocked check           │     auth_checks.py:111-115
│  2. Team model access            │     auth_checks.py:117-130
│  2.1 User model access           │     auth_checks.py:132-138
│  3. Team budget                  │     auth_checks.py:140-145
│  3.1 Organization budget         │     auth_checks.py:147-154
│  3.2 Tag budget                  │     auth_checks.py:156-162
│  4. User personal budget         │     auth_checks.py:164-177
│     (only if no team)            │
│  4.1 Team member budget          │     auth_checks.py:179-187
│  5. End user budget              │     auth_checks.py:189-197
│  7. Global proxy budget          │     auth_checks.py:245-258
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Pre-call Hooks                  │
│  (registered via PROXY_HOOKS)    │
│                                  │
│  ┌──────────────────────────┐    │
│  │ max_budget_limiter       │    │  ← User-level max budget
│  │ (max_budget_limiter.py)  │    │     (from cache)
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │ parallel_request_limiter │    │  ← RPM/TPM/max_parallel
│  │ (v3)                     │    │     for key, user, team,
│  │                          │    │     org, end_user, model
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │ dynamic_rate_limiter_v3  │    │  ← Model capacity check
│  │ (if enabled)             │    │     (opt-in only)
│  └──────────────────────────┘    │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  REQUEST EXECUTES                │
│  (routed to backend LLM)        │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Post-call Hooks                 │
│                                  │
│  1. Token count (TPM update)     │  ← async_log_success_event()
│     parallel_request_limiter_v3  │     Updates token counters
│                                  │
│  2. Cost tracking                │  ← _PROXY_track_cost_callback()
│     proxy_track_cost_callback.py │     Updates spend in cache + DB
│                                  │
│  3. Rate limit headers           │  ← Added to response
│     (x-ratelimit-remaining, etc) │
└──────────────────────────────────┘
```

---

## 8. Configuration Reference

### Full YAML Config Example

```yaml
general_settings:
  master_key: sk-master-key
  database_url: postgresql://user:pass@host:5432/litellm

  # Global proxy budget
  max_budget: 10000.00
  budget_duration: "30d"

  # Budget reset job frequency (seconds)
  proxy_budget_rescheduler_min_time: 597
  proxy_budget_rescheduler_max_time: 605

model_list:
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: sk-...
    model_info:
      rpm: 500     # Backend deployment capacity (used by dynamic_rate_limiter_v3)
      tpm: 100000

  - model_name: gpt-3.5-turbo
    litellm_params:
      model: openai/gpt-3.5-turbo
      api_key: sk-...
    model_info:
      rpm: 3000
      tpm: 1000000

litellm_settings:
  # Enable dynamic rate limiter (opt-in)
  callbacks:
    - dynamic_rate_limiter_v3

  # Priority settings (only used with dynamic_rate_limiter_v3)
  priority_reservation_settings:
    default_priority: 0.25
    saturation_threshold: 0.50
    saturation_check_cache_ttl: 60

router_settings:
  # Provider-level budget (optional)
  provider_budget_config:
    openai:
      budget_limit: 5000.00
      time_period: "30d"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LITELLM_RATE_LIMIT_WINDOW_SIZE` | `60` | Sliding window size in seconds for RPM/TPM counters |
| `LEGACY_MULTI_INSTANCE_RATE_LIMITING` | `false` | Set to `true` to use v2 rate limiter instead of v3 |
| `DATABASE_URL` | (none) | PostgreSQL connection string for Prisma |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | (none) | Redis connection for distributed rate limiting |

---

## 9. Database Schema Reference

Key tables from `litellm/proxy/schema.prisma`:

### LiteLLM_BudgetTable (schema.prisma:11-31)

Central budget configuration shared by orgs, keys, end-users, tags, and team members.

| Field | Type | Description |
|-------|------|-------------|
| `budget_id` | String (PK) | UUID |
| `max_budget` | Float? | Hard budget limit in USD |
| `soft_budget` | Float? | Soft budget alert threshold |
| `max_parallel_requests` | Int? | Max concurrent requests |
| `tpm_limit` | BigInt? | Tokens per minute limit |
| `rpm_limit` | BigInt? | Requests per minute limit |
| `model_max_budget` | Json? | Per-model budget config |
| `budget_duration` | String? | Reset period (e.g., "30d") |
| `budget_reset_at` | DateTime? | Next reset time |

### LiteLLM_VerificationToken (schema.prisma:262-303)

Virtual API keys.

| Field | Type | Description |
|-------|------|-------------|
| `token` | String (PK) | Hashed API key |
| `key_name` | String? | Human-readable name |
| `key_alias` | String? | Alias for the key |
| `spend` | Float (default 0.0) | Current accumulated spend |
| `expires` | DateTime? | Key expiration time |
| `models` | String[] | Allowed model names |
| `user_id` | String? | Owner user ID |
| `team_id` | String? | Associated team ID |
| `max_parallel_requests` | Int? | Max concurrent requests |
| `tpm_limit` | BigInt? | Tokens per minute limit |
| `rpm_limit` | BigInt? | Requests per minute limit |
| `max_budget` | Float? | Hard budget limit |
| `budget_duration` | String? | Reset period |
| `budget_reset_at` | DateTime? | Next reset time |
| `model_spend` | Json (default "{}") | Per-model spend tracking |
| `model_max_budget` | Json (default "{}") | Per-model budget config |
| `soft_budget_cooldown` | Boolean (default false) | Alert cooldown flag |
| `budget_id` | String? | FK to BudgetTable |
| `organization_id` | String? | FK to OrganizationTable |

### LiteLLM_UserTable (schema.prisma:179-212)

User accounts.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | String (PK) | User identifier |
| `teams` | String[] | Team memberships |
| `user_role` | String? | Role (e.g., "proxy_admin") |
| `max_budget` | Float? | Hard budget limit |
| `spend` | Float (default 0.0) | Current spend |
| `models` | String[] | Allowed models |
| `max_parallel_requests` | Int? | Max concurrent requests |
| `tpm_limit` | BigInt? | Tokens per minute limit |
| `rpm_limit` | BigInt? | Requests per minute limit |
| `budget_duration` | String? | Reset period |
| `budget_reset_at` | DateTime? | Next reset time |
| `model_spend` | Json (default "{}") | Per-model spend |
| `model_max_budget` | Json (default "{}") | Per-model budget config |

### LiteLLM_TeamTable (schema.prisma:105-133)

Teams (groups of users/keys).

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | String (PK) | Team identifier |
| `team_alias` | String? | Display name |
| `organization_id` | String? | Parent org |
| `max_budget` | Float? | Hard budget limit |
| `spend` | Float (default 0.0) | Current spend |
| `models` | String[] | Allowed models |
| `max_parallel_requests` | Int? | Max concurrent requests |
| `tpm_limit` | BigInt? | Tokens per minute |
| `rpm_limit` | BigInt? | Requests per minute |
| `budget_duration` | String? | Reset period |
| `budget_reset_at` | DateTime? | Next reset time |
| `model_spend` | Json (default "{}") | Per-model spend |
| `model_max_budget` | Json (default "{}") | Per-model budget |
| `blocked` | Boolean (default false) | Block all requests |

### LiteLLM_OrganizationTable (schema.prisma:71-90)

Organizations (contain teams).

| Field | Type | Description |
|-------|------|-------------|
| `organization_id` | String (PK) | Org identifier |
| `organization_alias` | String | Display name |
| `budget_id` | String | FK to BudgetTable (required) |
| `models` | String[] | Allowed models |
| `spend` | Float (default 0.0) | Current spend |
| `model_spend` | Json (default "{}") | Per-model spend |

### LiteLLM_SpendLogs (schema.prisma:393-428)

Per-request spend log entries.

| Field | Type | Description |
|-------|------|-------------|
| `request_id` | String (PK) | Unique request ID |
| `call_type` | String | API endpoint type |
| `api_key` | String | Hashed API key |
| `spend` | Float (default 0.0) | Cost for this request |
| `total_tokens` | Int | Total tokens used |
| `prompt_tokens` | Int | Input tokens |
| `completion_tokens` | Int | Output tokens |
| `model` | String | Model used |
| `model_group` | String? | Public model group name |
| `user` | String? | Key owner user_id |
| `team_id` | String? | Team ID |
| `organization_id` | String? | Org ID |
| `end_user` | String? | End user ID |
| `startTime` | DateTime | Request start time |
| `endTime` | DateTime | Request end time |

---

## 10. Source File Index

| File | Role |
|------|------|
| `litellm/proxy/auth/user_api_key_auth.py` | Main auth entry point. Validates keys, checks expiry, key budgets, per-model budgets, model access. |
| `litellm/proxy/auth/auth_checks.py` | Common checks across JWT + key auth. Team/org/user/end-user budgets, model access, global proxy budget. |
| `litellm/proxy/hooks/__init__.py` | Hook registry. Defines `PROXY_HOOKS` dict and `get_proxy_hook()` factory. |
| `litellm/proxy/hooks/parallel_request_limiter_v3.py` | Core rate limiter. Sliding window RPM/TPM/max_parallel for all entity types. Always active. |
| `litellm/proxy/hooks/dynamic_rate_limiter_v3.py` | Model capacity manager. Priority-based admission control using saturation detection. Opt-in. |
| `litellm/proxy/hooks/max_budget_limiter.py` | User-level max budget hook. Checks user spend against max_budget from cache. Always active. |
| `litellm/proxy/hooks/model_max_budget_limiter.py` | Per-model per-key budget hook. Tracks and enforces model-specific budgets on virtual keys. |
| `litellm/proxy/hooks/proxy_track_cost_callback.py` | Spend tracking callback. Calculates cost, updates cache + database after each request. |
| `litellm/proxy/utils.py` | `ProxyLogging` class. Manages hook lifecycle, `_add_proxy_hooks()` initializes all hooks. |
| `litellm/proxy/proxy_server.py` | FastAPI application. Loads config, instantiates `model_max_budget_limiter`, orchestrates auth flow. |
| `litellm/proxy/common_utils/reset_budget_job.py` | Budget reset cron job. Resets spend for keys, users, teams, end-users when `budget_reset_at <= now()`. |
| `litellm/proxy/db/db_transaction_queue/spend_update_queue.py` | Batched spend update writer. Aggregates spend updates before flushing to database. |
| `litellm/proxy/schema.prisma` | Prisma schema. Defines all database tables for keys, users, teams, orgs, spend logs, budgets. |
| `litellm/types/utils.py` | Type definitions. `BudgetConfig`, `PriorityReservationSettings`, `StandardLoggingPayload`. |
| `litellm/types/router.py` | Router types. `ModelGroupInfo` with `rpm`/`tpm` fields for model capacity. |
| `litellm/litellm_core_utils/litellm_logging.py` | Callback registration. Resolves callback names (like `"dynamic_rate_limiter_v3"`) to classes. |

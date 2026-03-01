# Quotas & Limits — Manual Test Guide

A step-by-step playbook for manually testing API key quota defaults, user self-service key creation with quotas, admin user-level budget/rate limits, bulk limit updates, and LiteLLM enforcement.

> **Prerequisites**: PostgreSQL running, LiteLLM proxy accessible on `:4000`, and the database seeded with at least one admin and one regular user (the default `npm run db:seed` does this).

---

## Part 0: Setup & Environment Variables

### Start the development servers

From the repository root:

```bash
npm install        # first time only
npm run dev        # starts backend (:8081) + frontend (:3000) with auto-reload
```

Or, if you want structured log files instead of console output:

```bash
npm run dev:logged
# logs are written to logs/backend.log and logs/frontend.log
```

Wait until you see both servers ready, then verify:

```bash
curl -s http://localhost:8081/api/v1/health | jq .
```

### Set base URLs

```bash
export BASE_URL="http://localhost:8081"
export LITELLM_URL="http://localhost:4000"
```

### Obtain JWT tokens via the dev-token endpoint

In development mode the backend exposes `POST /api/auth/dev-token`. It generates a JWT with whatever username and roles you specify.

**Admin token** (roles: `admin`, `user`):

```bash
export ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/dev-token" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin@example.com", "roles": ["admin", "user"]}' \
  | jq -r '.access_token')

echo "ADMIN_TOKEN=$ADMIN_TOKEN"
```

**Regular user token** (role: `user` only):

```bash
export USER_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/dev-token" \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "roles": ["user"]}' \
  | jq -r '.access_token')

echo "USER_TOKEN=$USER_TOKEN"
```

> **Caveat**: The dev-token endpoint always embeds the same hardcoded user ID (`550e8400-e29b-41d4-a716-446655440001`) regardless of the username you pass. The two tokens above differ only in their **roles** claim — the admin token passes `requirePermission('admin:users')` checks while the user token gets `403` on admin endpoints. For the admin-users scenarios (Part 3/5) you need a *different* user ID as the target — see "Find user IDs" below.

You can also list the seeded mock users if you need to check who exists:

```bash
curl -s "$BASE_URL/api/auth/mock-users" | jq .
```

### Discover available models

```bash
curl -s "$BASE_URL/api/v1/models" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[:3]'
```

Pick a model ID and export it:

```bash
export MODEL_ID="your-model-id"
```

### Find user IDs

```bash
curl -s "$BASE_URL/api/v1/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.users[:5]'
```

Pick a user ID that is **different** from the dev-token user (`550e8400-e29b-41d4-a716-446655440001`) — this is the user you will manage via the admin endpoints in Parts 3 and 5:

```bash
export USER_ID="target-user-uuid"
```

---

## Part 1: Admin API Key Quota Defaults

### Scenario 1: Read current defaults (admin endpoint)

**Purpose**: Verify the admin endpoint returns the defaults/maximums structure.

```bash
curl -s "$BASE_URL/api/v1/admin/settings/api-key-defaults" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**Expected**: `200`. Response has `defaults` and `maximums` objects. On a fresh system, all values are `null`.

### Scenario 2: Read current defaults (public endpoint)

**Purpose**: Verify the public config endpoint returns the same structure without auth.

```bash
curl -s "$BASE_URL/api/v1/config/api-key-defaults" | jq .
```

**Expected**: `200`. Same structure as Scenario 1 (same `defaults` and `maximums` values).

### Scenario 3: Set defaults and maximums

**Purpose**: Configure default quota values and maximum caps for user-created keys.

```bash
curl -s -X PUT "$BASE_URL/api/v1/admin/settings/api-key-defaults" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "defaults": {
      "maxBudget": 50,
      "tpmLimit": 5000,
      "rpmLimit": 30,
      "budgetDuration": "monthly",
      "softBudget": 40
    },
    "maximums": {
      "maxBudget": 200,
      "tpmLimit": 20000,
      "rpmLimit": 100
    }
  }' | jq .
```

**Expected**: `200`. Response mirrors the input — `defaults.maxBudget=50`, `defaults.tpmLimit=5000`, `defaults.rpmLimit=30`, `defaults.budgetDuration="monthly"`, `defaults.softBudget=40`, `maximums.maxBudget=200`, `maximums.tpmLimit=20000`, `maximums.rpmLimit=100`.

### Scenario 4: Validation — defaults cannot exceed maximums

**Purpose**: Verify the server rejects defaults that exceed the corresponding maximum.

```bash
curl -s -X PUT "$BASE_URL/api/v1/admin/settings/api-key-defaults" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "defaults": {
      "maxBudget": 300
    },
    "maximums": {
      "maxBudget": 200
    }
  }' | jq .
```

**Expected**: `400`. Error message: `"Default max budget cannot exceed the maximum limit"`.

---

## Part 2: User Self-Service Key Creation

> **Prerequisite**: Ensure Scenario 3 has been run so defaults and maximums are configured.

### Scenario 5: Create key without quotas (defaults applied)

**Purpose**: When a user creates a key without specifying quotas, admin defaults are applied automatically.

```bash
curl -s -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"test-key-defaults\",
    \"modelIds\": [\"$MODEL_ID\"]
  }" | jq .
```

**Expected**: `201`. Key is created. Save the returned `key` value and `id`:

```bash
export TEST_KEY_1="sk-..."
export TEST_KEY_1_ID="returned-key-id"
```

Verify defaults were applied via LiteLLM key info:

```bash
curl -s "$LITELLM_URL/key/info" \
  -H "Authorization: Bearer $TEST_KEY_1" | jq '.info | {max_budget, tpm_limit, rpm_limit, budget_duration, soft_budget}'
```

**Expected**: `max_budget=50`, `tpm_limit=5000`, `rpm_limit=30`, `budget_duration="monthly"`, `soft_budget=40` (matching admin defaults from Scenario 3).

### Scenario 6: Create key with custom quotas under maximum

**Purpose**: User specifies custom quotas within the allowed maximum.

```bash
curl -s -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"test-key-custom\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"maxBudget\": 100,
    \"tpmLimit\": 10000,
    \"rpmLimit\": 50,
    \"budgetDuration\": \"weekly\"
  }" | jq .
```

**Expected**: `201`. Key created successfully. Save the `id`:

```bash
export TEST_KEY_2_ID="returned-key-id"
```

### Scenario 7: Create key exceeding maximum

**Purpose**: Verify the server rejects quota values that exceed the admin-configured maximums.

```bash
curl -s -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"test-key-over-limit\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"maxBudget\": 500
  }" | jq .
```

**Expected**: `400`. Error message contains `"Quota limits exceeded"` and mentions `"maxBudget: 500 exceeds maximum 200"`.

### Scenario 8: Create key with explicit zero values

**Purpose**: Verify that `0` is preserved as the value and not replaced by the default.

```bash
curl -s -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"test-key-zero\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"maxBudget\": 0,
    \"tpmLimit\": 0,
    \"rpmLimit\": 0
  }" | jq .
```

**Expected**: `201`. Key created. Verify via LiteLLM that `max_budget=0`, `tpm_limit=0`, `rpm_limit=0` (not replaced by defaults of 50/5000/30). Save the `id`:

```bash
export TEST_KEY_3_ID="returned-key-id"
```

---

## Part 3: Admin User-Level Limits

### Scenario 9: View user details

**Purpose**: Check current budget and rate limits for a specific user.

```bash
curl -s "$BASE_URL/api/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{id, username, maxBudget, tpmLimit, rpmLimit}'
```

**Expected**: `200`. Returns user details with current `maxBudget`, `tpmLimit`, `rpmLimit` (may be `null` if never set).

### Scenario 10: Update individual user limits

**Purpose**: Set specific budget and rate limits for one user.

```bash
curl -s -X PATCH "$BASE_URL/api/v1/admin/users/$USER_ID/budget-limits" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxBudget": 25,
    "tpmLimit": 2000,
    "rpmLimit": 10
  }' | jq .
```

**Expected**: `200`. Response includes `maxBudget=25`, `tpmLimit=2000`, `rpmLimit=10`, and an `updatedAt` timestamp.

### Scenario 11: Partial update (only one field)

**Purpose**: Verify that updating a single field does not clear the others.

```bash
curl -s -X PATCH "$BASE_URL/api/v1/admin/users/$USER_ID/budget-limits" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rpmLimit": 50
  }' | jq .
```

**Expected**: `200`. `rpmLimit=50`. `maxBudget` and `tpmLimit` remain at their previous values (25 and 2000 respectively from Scenario 10).

Verify by fetching user details again:

```bash
curl -s "$BASE_URL/api/v1/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{maxBudget, tpmLimit, rpmLimit}'
```

**Expected**: `maxBudget=25`, `tpmLimit=2000`, `rpmLimit=50`.

---

## Part 4: Bulk User Limits

### Scenario 12: Bulk update all users

**Purpose**: Apply rate limits to all active users at once.

```bash
curl -s -X POST "$BASE_URL/api/v1/admin/users/bulk-update-limits" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxBudget": 75,
    "tpmLimit": 8000,
    "rpmLimit": 40
  }' | jq .
```

**Expected**: `200`. Response includes `totalUsers`, `successCount`, `failedCount`, `errors` (array), and `processedAt` timestamp. `successCount` should equal `totalUsers` and `failedCount` should be `0`.

### Scenario 13: Bulk update validation — empty body

**Purpose**: Verify the server rejects a request with no limit values.

```bash
curl -s -X POST "$BASE_URL/api/v1/admin/users/bulk-update-limits" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

**Expected**: `400`. Error message: `"At least one limit value must be provided"`.

---

## Part 5: Admin Creates Key for User

### Scenario 14: Admin creates key with quotas

**Purpose**: Admin creates an API key on behalf of a user with specific quota values.

```bash
curl -s -X POST "$BASE_URL/api/v1/admin/users/$USER_ID/api-keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"admin-created-key\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"maxBudget\": 30,
    \"tpmLimit\": 1000,
    \"rpmLimit\": 5,
    \"budgetDuration\": \"daily\"
  }" | jq .
```

**Expected**: `201`. Response includes `id`, `name`, `key` (full key shown once), `keyPrefix`, `models`, `isActive=true`, `createdAt`. Save the key:

```bash
export ADMIN_KEY="sk-..."
export ADMIN_KEY_ID="returned-key-id"
```

### Scenario 15: Admin creates key with per-model limits

**Purpose**: Verify per-model budget and rate limit JSONB fields are accepted.

```bash
curl -s -X POST "$BASE_URL/api/v1/admin/users/$USER_ID/api-keys" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"admin-key-per-model\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"maxBudget\": 50,
    \"rpmLimit\": 20,
    \"modelMaxBudget\": {
      \"$MODEL_ID\": {
        \"budgetLimit\": 10,
        \"timePeriod\": \"1d\"
      }
    },
    \"modelRpmLimit\": {
      \"$MODEL_ID\": 5
    },
    \"modelTpmLimit\": {
      \"$MODEL_ID\": 500
    }
  }" | jq .
```

**Expected**: `201`. Key created successfully. Save the `id`:

```bash
export ADMIN_KEY_2_ID="returned-key-id"
```

---

## Part 6: Budget Duration Variants

### Scenario 16: Predefined duration

**Purpose**: Verify predefined budget duration strings are accepted.

```bash
curl -s -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"test-key-monthly\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"maxBudget\": 50,
    \"budgetDuration\": \"monthly\"
  }" | jq .
```

**Expected**: `201`. Verify via LiteLLM key info that `budget_duration` is set.

```bash
export DURATION_KEY="sk-..."
export DURATION_KEY_ID="returned-key-id"

curl -s "$LITELLM_URL/key/info" \
  -H "Authorization: Bearer $DURATION_KEY" | jq '.info.budget_duration'
```

**Expected**: `"monthly"` (or LiteLLM's internal representation of it).

### Scenario 17: Custom LiteLLM duration

**Purpose**: Verify custom duration strings (e.g., `30d`) pass schema validation.

```bash
curl -s -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"test-key-30d\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"maxBudget\": 50,
    \"budgetDuration\": \"30d\"
  }" | jq .
```

**Expected**: `201`. Key created. Save the `id`:

```bash
export CUSTOM_DURATION_KEY_ID="returned-key-id"
```

---

## Part 7: LiteLLM Enforcement

> These scenarios verify that LiteLLM actually enforces the quotas set by LiteMaaS.

### Scenario 18: Make a model call with a valid key

**Purpose**: Confirm a newly created key works for inference.

```bash
curl -s -X POST "$LITELLM_URL/chat/completions" \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$MODEL_ID\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Say hello in one word.\"}],
    \"max_tokens\": 5
  }" | jq '{id, model, choices: [.choices[0].message.content]}'
```

**Expected**: `200`. A valid chat completion response with `id`, `model`, and a `choices` array.

### Scenario 19: RPM limit enforcement

**Purpose**: Trigger the RPM rate limit by exceeding requests-per-minute.

First, create a key with a very low RPM limit:

```bash
curl -s -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"test-key-low-rpm\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"rpmLimit\": 2
  }" | jq .
```

Save the key:

```bash
export RPM_KEY="sk-..."
export RPM_KEY_ID="returned-key-id"
```

Fire 3 requests in quick succession:

```bash
for i in 1 2 3; do
  echo "--- Request $i ---"
  curl -s -X POST "$LITELLM_URL/chat/completions" \
    -H "Authorization: Bearer $RPM_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"$MODEL_ID\",
      \"messages\": [{\"role\": \"user\", \"content\": \"Hi\"}],
      \"max_tokens\": 3
    }" | jq '{status: .error.code // "ok", message: .error.message // .choices[0].message.content}'
done
```

**Expected**: Requests 1 and 2 succeed. Request 3 returns a rate limit error (HTTP `429` or an error message about exceeding RPM).

> **Note**: LiteLLM may use a sliding window; exact enforcement timing can vary. If all 3 succeed, wait a moment and try a 4th request.

### Scenario 20: Budget enforcement

**Purpose**: Exceed a very low budget to trigger budget-exceeded error.

Create a key with an extremely low budget:

```bash
curl -s -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"test-key-low-budget\",
    \"modelIds\": [\"$MODEL_ID\"],
    \"maxBudget\": 0.001
  }" | jq .
```

Save the key:

```bash
export BUDGET_KEY="sk-..."
export BUDGET_KEY_ID="returned-key-id"
```

Make repeated calls until the budget is exceeded:

```bash
for i in 1 2 3 4 5; do
  echo "--- Request $i ---"
  curl -s -X POST "$LITELLM_URL/chat/completions" \
    -H "Authorization: Bearer $BUDGET_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"$MODEL_ID\",
      \"messages\": [{\"role\": \"user\", \"content\": \"Count to three.\"}],
      \"max_tokens\": 10
    }" | jq '{status: .error.code // "ok", message: .error.message // .choices[0].message.content}'
done
```

**Expected**: After the budget is exhausted, subsequent requests fail with a budget-exceeded error (HTTP `400` or `429` with a message about exceeding the budget).

> **Note**: Budget tracking in LiteLLM may have a slight delay. A very small model (low cost per token) may require more requests to trigger.

---

## Part 8: RBAC Enforcement

### Scenario 21: User cannot access admin settings

**Purpose**: Verify regular users are blocked from admin endpoints.

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/admin/settings/api-key-defaults" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected**: `403`.

### Scenario 22: User cannot bulk update

**Purpose**: Verify regular users cannot perform bulk limit updates.

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/v1/admin/users/bulk-update-limits" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxBudget": 999}'
```

**Expected**: `403`.

### Scenario 23: Public endpoint needs no auth

**Purpose**: Verify the public config endpoint is accessible without any token.

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/v1/config/api-key-defaults"
```

**Expected**: `200`.

---

## Part 9: Cleanup

### Revoke test API keys

Delete all keys created during testing. Substitute the actual key IDs you saved:

```bash
for KEY_ID in $TEST_KEY_1_ID $TEST_KEY_2_ID $TEST_KEY_3_ID $DURATION_KEY_ID $CUSTOM_DURATION_KEY_ID $RPM_KEY_ID $BUDGET_KEY_ID; do
  echo "Deleting $KEY_ID..."
  curl -s -X DELETE "$BASE_URL/api/v1/api-keys/$KEY_ID" \
    -H "Authorization: Bearer $USER_TOKEN" | jq .
done
```

Delete admin-created keys (requires admin token and the admin-users route):

```bash
for KEY_ID in $ADMIN_KEY_ID $ADMIN_KEY_2_ID; do
  echo "Deleting admin key $KEY_ID..."
  curl -s -X DELETE "$BASE_URL/api/v1/admin/users/$USER_ID/api-keys/$KEY_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
done
```

### Reset defaults to empty

```bash
curl -s -X PUT "$BASE_URL/api/v1/admin/settings/api-key-defaults" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "defaults": {},
    "maximums": {}
  }' | jq .
```

**Expected**: `200`. All values reset to `null`.

### Reset user limits (optional)

If you want to clear the user-level limits set during testing:

```bash
curl -s -X PATCH "$BASE_URL/api/v1/admin/users/$USER_ID/budget-limits" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxBudget": 0,
    "tpmLimit": 0,
    "rpmLimit": 0
  }' | jq .
```

---

## Quick Reference: Endpoints Tested

| # | Method | Endpoint | Auth | Part |
|---|--------|----------|------|------|
| 1 | GET | `/api/v1/admin/settings/api-key-defaults` | Admin | 1 |
| 2 | GET | `/api/v1/config/api-key-defaults` | None | 1 |
| 3-4 | PUT | `/api/v1/admin/settings/api-key-defaults` | Admin | 1 |
| 5-8 | POST | `/api/v1/api-keys` | User | 2 |
| 9 | GET | `/api/v1/admin/users/:id` | Admin | 3 |
| 10-11 | PATCH | `/api/v1/admin/users/:id/budget-limits` | Admin | 3 |
| 12-13 | POST | `/api/v1/admin/users/bulk-update-limits` | Admin | 4 |
| 14-15 | POST | `/api/v1/admin/users/:id/api-keys` | Admin | 5 |
| 16-17 | POST | `/api/v1/api-keys` | User | 6 |
| 18-20 | POST | `$LITELLM_URL/chat/completions` | API Key | 7 |
| 21-22 | Various | Admin endpoints | User | 8 |
| 23 | GET | `/api/v1/config/api-key-defaults` | None | 8 |

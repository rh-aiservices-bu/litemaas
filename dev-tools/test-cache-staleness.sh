#!/usr/bin/env bash
#
# Test script: Reproduce stale cache / missing request count issue
#
# This script demonstrates two bugs in the usage analytics pipeline:
#
# BUG 1: Enrichment only uses active keys (WHERE is_active = true)
#   - If a key is revoked/deleted BEFORE its usage data is cached,
#     its requests are attributed to "Unknown User" and lost when filtering by userId
#
# BUG 2: Permanent historical cache with baked-in enrichment
#   - Once a day's data is cached as "historical" (is_complete=true),
#     it's never re-enriched even if key mappings change
#   - Combined with Bug 1: clearing the cache and re-enriching loses data
#     for deleted keys
#
# BUG 3: Yesterday (daysDiff=1) always re-fetched
#   - isHistoricalDate() returns true only for daysDiff > 1
#   - isToday() returns true only for daysDiff == 0
#   - Yesterday falls through both checks and is always re-fetched
#
# This script bypasses the backend API entirely and tests the enrichment
# and caching logic directly via LiteLLM API + PostgreSQL queries.
#
# Prerequisites:
#   - LiteLLM running on port 4000 (via host.containers.internal)
#   - PostgreSQL accessible
#   - At least one working model in LiteLLM
#
# Usage:
#   PGPASSWORD="thisisadmin" ./dev-tools/test-cache-staleness.sh

set -euo pipefail

# Configuration
LITELLM_URL="${LITELLM_URL:-http://host.containers.internal:4000}"
LITELLM_MASTER_KEY="${LITELLM_MASTER_KEY:-sk-your-master-key}"
DB_HOST="${DB_HOST:-host.containers.internal}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-litemaas}"
DB_USER="${DB_USER:-pgadmin}"
# PGPASSWORD should be set in environment

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()  { echo -e "${GREEN}[OK]${NC}   $1"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
fail(){ echo -e "${RED}[FAIL]${NC} $1"; }
header() { echo -e "\n${CYAN}=== $1 ===${NC}\n"; }

psql_cmd() {
  PGPASSWORD="${PGPASSWORD}" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -A -q -c "$1"
}

echo "============================================================"
echo " Test: Usage Analytics Enrichment & Cache Bugs"
echo " (Direct DB + LiteLLM API - no backend auth needed)"
echo "============================================================"
echo ""

# ---------------------------------------------------------------
# Step 0: Pick a real user and model to test with
# ---------------------------------------------------------------
header "Step 0: Finding test user and model"

# Exclude the system user (00000000-0000-0000-0000-000000000001)
TEST_USER_ID=$(psql_cmd "SELECT id FROM users WHERE id <> '00000000-0000-0000-0000-000000000001' LIMIT 1;")
if [[ -z "$TEST_USER_ID" ]]; then
  fail "No non-system user found in database"
  exit 1
fi
TEST_USERNAME=$(psql_cmd "SELECT username FROM users WHERE id = '$TEST_USER_ID';")
log "Test user: $TEST_USERNAME ($TEST_USER_ID)"

# Find a model that works (try chat completion)
TEST_MODEL=$(curl -s "$LITELLM_URL/model/info" -H "Authorization: Bearer $LITELLM_MASTER_KEY" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for m in data.get('data', []):
    name = m.get('model_name', '')
    mode = m.get('model_info', {}).get('mode', '')
    if mode not in ('embedding',):
        print(name)
        break
" 2>/dev/null)

if [[ -z "$TEST_MODEL" ]]; then
  fail "No suitable model found in LiteLLM"
  exit 1
fi
log "Test model: $TEST_MODEL"

# ---------------------------------------------------------------
# Step 1: Create a temporary API key via LiteLLM directly
# ---------------------------------------------------------------
header "Step 1: Creating temporary test key in LiteLLM"

KEY_ALIAS="cache-test-key-$(date +%s)"
KEY_RESPONSE=$(curl -s "$LITELLM_URL/key/generate" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$TEST_USER_ID\",
    \"key_alias\": \"$KEY_ALIAS\",
    \"models\": [\"$TEST_MODEL\"],
    \"max_budget\": 100
  }")

TEST_KEY=$(echo "$KEY_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin)['key'])" 2>/dev/null)
if [[ -z "$TEST_KEY" ]]; then
  fail "Failed to create test key in LiteLLM"
  echo "Response: $KEY_RESPONSE"
  exit 1
fi

TEST_KEY_HASH=$(echo -n "$TEST_KEY" | sha256sum | awk '{print $1}')

ok "Created key: $KEY_ALIAS"
log "Key hash: $TEST_KEY_HASH"
log "Key value: ${TEST_KEY:0:20}..."

# Clean up any leftover test keys from previous runs
psql_cmd "DELETE FROM api_keys WHERE name = 'cache-test-key';" > /dev/null

# Register key in LiteMaaS database so enrichment can find it
psql_cmd "
INSERT INTO api_keys (user_id, name, key_hash, key_prefix, lite_llm_key_value, litellm_key_alias, is_active, sync_status, migration_status)
VALUES ('$TEST_USER_ID', 'cache-test-key', '$TEST_KEY_HASH', '${TEST_KEY:0:10}', '$TEST_KEY', '$KEY_ALIAS', true, 'synced', 'complete');
" > /dev/null
ok "Registered key in LiteMaaS database (is_active=true)"

# ---------------------------------------------------------------
# Step 2: Generate usage data by making a request through LiteLLM
# ---------------------------------------------------------------
header "Step 2: Making test request through LiteLLM"

CHAT_RESPONSE=$(curl -s "$LITELLM_URL/v1/chat/completions" \
  -H "Authorization: Bearer $TEST_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"$TEST_MODEL\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Say hello in one word\"}],
    \"max_tokens\": 10
  }" 2>/dev/null)

CHAT_STATUS=$(echo "$CHAT_RESPONSE" | python3 -c "
import json, sys
d = json.load(sys.stdin)
if 'choices' in d:
    print('success')
elif 'error' in d:
    print(f\"error: {d['error'].get('message', 'unknown')[:80]}\")
else:
    print('unknown')
" 2>/dev/null)

if [[ "$CHAT_STATUS" == "success" ]]; then
  ok "Chat request succeeded"
else
  warn "Chat request status: $CHAT_STATUS (test will continue - failed requests also count)"
fi

# Wait for LiteLLM to record the spend log
sleep 5

# ---------------------------------------------------------------
# Step 3: Verify LiteLLM recorded the activity
# ---------------------------------------------------------------
header "Step 3: Verifying LiteLLM recorded the activity"

TODAY=$(date +%Y-%m-%d)

# Query all activity for today and extract our test key's requests from the breakdown
ACTIVITY=$(curl -s "$LITELLM_URL/user/daily/activity?start_date=$TODAY&end_date=$TODAY&page=1&page_size=100" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" 2>/dev/null)

LITELLM_REQUESTS=$(echo "$ACTIVITY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
key_hash = '$TEST_KEY_HASH'
total = 0
for result in d.get('results', []):
    api_keys = result.get('breakdown', {}).get('api_keys', {})
    if key_hash in api_keys:
        total += api_keys[key_hash]['metrics']['api_requests']
print(total)
" 2>/dev/null)

if [[ "$LITELLM_REQUESTS" -gt 0 ]]; then
  ok "LiteLLM recorded $LITELLM_REQUESTS request(s) for test key hash"
else
  # LiteLLM may take a few seconds to index - retry once
  log "No requests found yet, waiting 5 more seconds..."
  sleep 5
  ACTIVITY=$(curl -s "$LITELLM_URL/user/daily/activity?start_date=$TODAY&end_date=$TODAY&page=1&page_size=100" \
    -H "Authorization: Bearer $LITELLM_MASTER_KEY" 2>/dev/null)
  LITELLM_REQUESTS=$(echo "$ACTIVITY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
key_hash = '$TEST_KEY_HASH'
total = 0
for result in d.get('results', []):
    api_keys = result.get('breakdown', {}).get('api_keys', {})
    if key_hash in api_keys:
        total += api_keys[key_hash]['metrics']['api_requests']
print(total)
" 2>/dev/null)
  if [[ "$LITELLM_REQUESTS" -gt 0 ]]; then
    ok "LiteLLM recorded $LITELLM_REQUESTS request(s) for test key hash (after retry)"
  else
    fail "LiteLLM shows 0 requests for test key - cannot proceed"
    echo "  Key hash: $TEST_KEY_HASH"
    echo "  Available keys in today's activity:"
    echo "$ACTIVITY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for result in d.get('results', []):
    for kh, info in result.get('breakdown', {}).get('api_keys', {}).items():
        print(f'    {kh[:20]}... = {info[\"metrics\"][\"api_requests\"]} requests')
" 2>/dev/null
    exit 1
  fi
fi

# ---------------------------------------------------------------
# Step 4: Test Bug 1 - Enrichment only queries active keys
# ---------------------------------------------------------------
header "Step 4: Testing Bug 1 - Enrichment WHERE is_active = true"

log "Simulating enrichment query WITH is_active filter (current buggy code)..."
ENRICHED_ACTIVE=$(psql_cmd "
  SELECT ak.key_hash, ak.user_id, u.username
  FROM api_keys ak
  JOIN users u ON ak.user_id = u.id
  WHERE ak.is_active = true
    AND ak.key_hash = '$TEST_KEY_HASH';
")

if [[ -n "$ENRICHED_ACTIVE" ]]; then
  ok "Key IS found when active: $ENRICHED_ACTIVE"
else
  fail "Key NOT found even when active - test setup error"
  exit 1
fi

# Now deactivate the key
log "Deactivating the test key (is_active=false)..."
psql_cmd "UPDATE api_keys SET is_active = false WHERE key_hash = '$TEST_KEY_HASH';" > /dev/null
ok "Key deactivated"

log "Simulating enrichment query WITH is_active filter (buggy)..."
ENRICHED_AFTER_DEACTIVATE=$(psql_cmd "
  SELECT ak.key_hash, ak.user_id, u.username
  FROM api_keys ak
  JOIN users u ON ak.user_id = u.id
  WHERE ak.is_active = true
    AND ak.key_hash = '$TEST_KEY_HASH';
")

log "Simulating enrichment query WITHOUT is_active filter (fixed)..."
ENRICHED_WITHOUT_FILTER=$(psql_cmd "
  SELECT ak.key_hash, ak.user_id, u.username
  FROM api_keys ak
  JOIN users u ON ak.user_id = u.id
  WHERE ak.key_hash = '$TEST_KEY_HASH';
")

echo ""
echo "  Results after key deactivation:"
if [[ -z "$ENRICHED_AFTER_DEACTIVATE" ]]; then
  fail "BUG 1 CONFIRMED: Buggy query (WHERE is_active=true) returns NO results"
  echo "       -> This key's requests would be attributed to 'Unknown User'"
  echo "       -> They would be filtered out in user-scoped views"
else
  ok "Buggy query still finds the key (unexpected)"
fi

if [[ -n "$ENRICHED_WITHOUT_FILTER" ]]; then
  ok "Fixed query (no is_active filter) finds key: $ENRICHED_WITHOUT_FILTER"
else
  fail "Fixed query also misses the key (unexpected)"
fi

# ---------------------------------------------------------------
# Step 5: Test Bug 2 - Permanent cache with stale enrichment
# ---------------------------------------------------------------
header "Step 5: Testing Bug 2 - Permanent historical cache"

# Reactivate the key first
psql_cmd "UPDATE api_keys SET is_active = true WHERE key_hash = '$TEST_KEY_HASH';" > /dev/null

log "Simulating cache write with key ACTIVE (enrichment succeeds)..."
# The enrichment result when key is active
ENRICHED_USER=$(psql_cmd "
  SELECT u.username FROM api_keys ak
  JOIN users u ON ak.user_id = u.id
  WHERE ak.is_active = true AND ak.key_hash = '$TEST_KEY_HASH';
")
ok "Enrichment maps key to user: $ENRICHED_USER"

log "Writing simulated cache entry for today (is_complete=false, current day)..."
# Simulate what the backend does: cache the enriched data
# Schema: raw_data, aggregated_by_user, aggregated_by_model, aggregated_by_provider, total_metrics
RAW_DATA=$(python3 -c "
import json
data = {'breakdowns': [{'api_key': '$TEST_KEY_HASH', 'model': '$TEST_MODEL', 'total_requests': $LITELLM_REQUESTS, 'total_tokens': 100, 'total_spend': 0.01}]}
print(json.dumps(data))
")
AGG_BY_USER=$(python3 -c "
import json
data = {
    '$TEST_USER_ID': {
        'userId': '$TEST_USER_ID',
        'username': '$ENRICHED_USER',
        'totalRequests': $LITELLM_REQUESTS,
        'totalTokens': 100,
        'totalSpend': 0.01,
        'models': {}
    }
}
print(json.dumps(data))
")
TOTAL_METRICS=$(python3 -c "
import json
data = {'totalRequests': $LITELLM_REQUESTS, 'totalTokens': 100, 'totalSpend': 0.01}
print(json.dumps(data))
")

psql_cmd "
  DELETE FROM daily_usage_cache WHERE date = '$TODAY';
  INSERT INTO daily_usage_cache (date, raw_data, aggregated_by_user, total_metrics, is_complete, updated_at)
  VALUES ('$TODAY', '$RAW_DATA'::jsonb, '$AGG_BY_USER'::jsonb, '$TOTAL_METRICS'::jsonb, false, NOW());
" > /dev/null
ok "Cache written with user mapping intact"

# Verify we can find the user's data in the cache
CACHED_REQUESTS=$(psql_cmd "
  SELECT (aggregated_by_user->'$TEST_USER_ID'->>'totalRequests')::int
  FROM daily_usage_cache WHERE date = '$TODAY';
")
ok "Cache shows $CACHED_REQUESTS request(s) for user $TEST_USERNAME"

# Now simulate Bug 2: mark as historical, deactivate key, clear and rebuild
log ""
log "Now simulating Bug 2 scenario:"
log "  1. Mark cache as historical (is_complete=true)"
log "  2. Deactivate the key"
log "  3. Clear and re-enrich the cache"
log "  -> The permanently cached data should be stale"

psql_cmd "UPDATE daily_usage_cache SET is_complete = true WHERE date = '$TODAY';" > /dev/null
ok "Cache marked as historical (is_complete=true)"

psql_cmd "UPDATE api_keys SET is_active = false WHERE key_hash = '$TEST_KEY_HASH';" > /dev/null
ok "Key deactivated"

log ""
log "Scenario A: Cache NOT cleared -> serves old (correct) data"
CACHED_REQUESTS_STALE=$(psql_cmd "
  SELECT (aggregated_by_user->'$TEST_USER_ID'->>'totalRequests')::int
  FROM daily_usage_cache WHERE date = '$TODAY';
")
if [[ "$CACHED_REQUESTS_STALE" -gt 0 ]]; then
  ok "Historical cache still has $CACHED_REQUESTS_STALE request(s) (stale but correct)"
  warn "This data is frozen - if re-enriched, it would lose the user mapping"
fi

log ""
log "Scenario B: Cache cleared -> re-enrichment loses data"
psql_cmd "DELETE FROM daily_usage_cache WHERE date = '$TODAY';" > /dev/null
ok "Cache cleared"

# Simulate re-enrichment with deactivated key
ENRICHED_AFTER=$(psql_cmd "
  SELECT u.username FROM api_keys ak
  JOIN users u ON ak.user_id = u.id
  WHERE ak.is_active = true AND ak.key_hash = '$TEST_KEY_HASH';
")

if [[ -z "$ENRICHED_AFTER" ]]; then
  fail "BUG 2 CONFIRMED: Re-enrichment after cache clear cannot map key to user"
  echo "       -> Key hash '$TEST_KEY_HASH' has no match in active keys"
  echo "       -> LiteLLM still shows $LITELLM_REQUESTS request(s) for this key"
  echo "       -> But re-cached data would attribute them to 'Unknown User'"
  echo "       -> User-scoped views would show 0 requests"
else
  ok "Re-enrichment still finds the key (unexpected)"
fi

# ---------------------------------------------------------------
# Step 6: Test Bug 3 - Yesterday cache gap
# ---------------------------------------------------------------
header "Step 6: Testing Bug 3 - Yesterday cache gap"

log "Testing isHistoricalDate() and isToday() logic:"
log ""

# Show the logic
python3 -c "
from datetime import datetime, timedelta
import math

now = datetime.now()
dates = {
    'Today': now,
    'Yesterday': now - timedelta(days=1),
    'Two days ago': now - timedelta(days=2),
    'Three days ago': now - timedelta(days=3),
}

for label, d in dates.items():
    days_diff = math.floor((now.timestamp() - d.timestamp()) / (60*60*24))
    is_historical = days_diff > 1
    is_today = d.date() == now.date()

    # Determine cache behavior
    if is_historical:
        behavior = 'CACHED (permanent, is_complete=true)'
    elif is_today:
        behavior = 'CACHED (5-min TTL, is_complete=false)'
    else:
        behavior = 'ALWAYS RE-FETCHED (falls through both checks!)'

    status = '  OK ' if (is_historical or is_today) else ' BUG'
    print(f'  [{status}] {label:16s} daysDiff={days_diff}  isHistorical={str(is_historical):5s}  isToday={str(is_today):5s}  -> {behavior}')
"

echo ""
warn "Bug 3: Yesterday (daysDiff=1) is neither historical (>1) nor today (==0)"
warn "       It falls through both cache checks and is ALWAYS re-fetched from LiteLLM"
warn "       Impact: Performance - unnecessary API calls for yesterday's data"

# ---------------------------------------------------------------
# Step 7: Show the actual buggy code locations
# ---------------------------------------------------------------
header "Step 7: Summary of bug locations"

echo ""
echo "  BUG 1: Enrichment only queries active keys"
echo "  ----------------------------------------"
echo "  File: backend/src/services/admin-usage/admin-usage-aggregation.service.ts"
echo "  Look for: WHERE ak.is_active = true"
echo "  Fix: Remove is_active filter from enrichment query, or use:"
echo "       WHERE (ak.is_active = true OR ak.is_active = false)"
echo "       This ensures deleted/revoked keys still map to their users."
echo ""
echo "  BUG 2: Historical cache never re-enriches"
echo "  ----------------------------------------"
echo "  File: backend/src/services/admin-usage/admin-usage-aggregation.service.ts"
echo "  Method: getCachedOrFetch()"
echo "  Issue: Enrichment is baked in at cache-write time."
echo "         If cache is invalidated and rebuilt after key deletion,"
echo "         the re-enrichment misses inactive keys (compounds with Bug 1)."
echo "  Fix: Either fix Bug 1 (preferred) or store raw LiteLLM data"
echo "       separately from enriched data."
echo ""
echo "  BUG 3: Yesterday always re-fetched"
echo "  ----------------------------------------"
echo "  File: backend/src/services/admin-usage/admin-usage-aggregation.service.ts"
echo "  Method: getCachedOrFetch()"
echo "  File: backend/src/services/admin-usage/admin-usage.utils.ts"
echo "  Function: isHistoricalDate() - uses daysDiff > 1 (should be >= 1)"
echo "  Fix: Change isHistoricalDate() to: return daysDiff >= 1"
echo "       Or add explicit yesterday check in getCachedOrFetch()"
echo ""

# ---------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------
header "Cleanup"

# Delete test key from LiteLLM
curl -s "$LITELLM_URL/key/delete" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"keys\": [\"$TEST_KEY\"]}" > /dev/null 2>&1

# Delete test key from LiteMaaS
psql_cmd "DELETE FROM api_keys WHERE key_hash = '$TEST_KEY_HASH';" > /dev/null

# Reset cache for today
psql_cmd "DELETE FROM daily_usage_cache WHERE date = '$TODAY';" > /dev/null

ok "Test key and cache cleaned up"

echo ""
echo "============================================================"
echo " Test complete. See bug locations above for fixes."
echo "============================================================"
echo ""

#!/usr/bin/env bash
#
# revoke-all-keys.sh — Revoke active LiteLLM API keys managed by LiteMaaS.
#
# Keys are deleted from LiteLLM first (stop working immediately), then archived
# in the LiteMaaS database (soft revoke — same as the UI delete button).
#
# Two scopes:
#
#   Self-service (default): revoke all active keys owned by the authenticated
#   user via /api/v1/api-keys.
#
#   Admin (--all-users): iterate over every user in the system via
#   /api/v1/admin/users, list each user's active keys and revoke them via
#   /api/v1/admin/users/:id/api-keys/:keyId. Requires an admin token
#   (permissions: admin:usage, users:read, users:write). Use --user <id> to
#   target a single user. adminReadonly can list but revocations will fail 403.
#
# Authentication normally goes through SSO in the browser, which the CLI can't
# do headlessly. Three options:
#
#   1. Paste a token (simplest): log into the LiteMaaS UI, open DevTools console
#      and run:  localStorage.getItem('access_token')
#      Then either pass it with --token or paste it when prompted.
#      Tokens are short-lived; the script auto-refreshes once if a refresh
#      token is available (also visible in localStorage as 'refresh_token').
#
#   2. Dev token (dev/test environments only): if POST /api/v1/auth/dev-token
#      is enabled (non-production NODE_ENV), the script can mint a token itself:
#        revoke-all-keys.sh --dev-user <username> [--dev-role admin]
#
#   3. Refresh token: pass --refresh-token "<token>" and the script will
#      exchange it for an access token via POST /api/auth/refresh.
#
# Usage:
#   revoke-all-keys.sh [options]
#
# Options:
#   -A, --all-users           Admin mode: revoke active keys of ALL users
#       --user ID             Admin mode: revoke active keys of one user
#       --start-user ID       Admin mode: begin the --all-users scan at this
#                             userId (skip everyone before them)
#       --permanent           Hard-delete keys instead of soft revoking
#   -u, --base-url URL        Backend base URL (default:
#                             https://litemaas-portal.rhoai.rh-aiservices-bu.com,
#                             env: LITEMAAS_URL)
#   -t, --token TOKEN         Access token (env: LITEMAAS_TOKEN)
#   -r, --refresh-token TKN   Refresh token used to obtain an access token
#                             (env: LITEMAAS_REFRESH_TOKEN)
#       --dev-user NAME       Mint a dev token for NAME (dev environments only)
#       --dev-role ROLE       Roles for the dev token (default: admin,user)
#   -n, --dry-run             List what would be revoked without revoking
#   -y, --yes                 Skip the confirmation prompt
#   -h, --help                Show this help
#
# Examples:
#   revoke-all-keys.sh --all-users -n              # admin: list all active keys
#   revoke-all-keys.sh --all-users                 # admin: revoke everything
#   revoke-all-keys.sh --all-users --permanent     # admin: hard delete
#   revoke-all-keys.sh --all-users --start-user 7d7f...   # resume after rate limit
#   revoke-all-keys.sh --user 42ab...              # admin: one user's keys
#   revoke-all-keys.sh -t "$TOKEN"                 # revoke own keys
#   revoke-all-keys.sh --dev-user developer        # dev environment
#
set -euo pipefail

BASE_URL="${LITEMAAS_URL:-https://litemaas-portal.rhoai.rh-aiservices-bu.com}"
ACCESS_TOKEN="${LITEMAAS_TOKEN:-}"
REFRESH_TOKEN="${LITEMAAS_REFRESH_TOKEN:-}"
DEV_USER=""
DEV_ROLES='["admin","user"]'
ALL_USERS=0
TARGET_USER=""
START_USER=""
PERMANENT=0
DRY_RUN=0
ASSUME_YES=0

die() { echo "Error: $*" >&2; exit 1; }

usage() { cat <<'EOF'
Usage: revoke-all-keys.sh [options]

Options:
  -A, --all-users           Admin mode: revoke active keys of ALL users
      --user ID             Admin mode: revoke active keys of one user
      --start-user ID       Admin mode: begin the --all-users scan at this
                            userId (skip everyone before them)
      --permanent           Hard-delete keys instead of soft revoking
  -u, --base-url URL        Backend base URL (default:
                            https://litemaas-portal.rhoai.rh-aiservices-bu.com,
                            env: LITEMAAS_URL)
  -t, --token TOKEN         Access token (env: LITEMAAS_TOKEN)
  -r, --refresh-token TKN   Refresh token used to obtain an access token
                            (env: LITEMAAS_REFRESH_TOKEN)
      --dev-user NAME       Mint a dev token for NAME (dev environments only)
      --dev-role ROLE       Roles for the dev token (default: admin,user)
  -n, --dry-run             List what would be revoked without revoking
  -y, --yes                 Skip the confirmation prompt
  -h, --help                Show this help

Examples:
  revoke-all-keys.sh --all-users -n              # admin: list all active keys
  revoke-all-keys.sh --all-users                 # admin: revoke everything
  revoke-all-keys.sh --all-users --permanent     # admin: hard delete
  revoke-all-keys.sh --all-users --start-user 7d7f...   # resume after rate limit
  revoke-all-keys.sh --user 42ab...              # admin: one user's keys
  revoke-all-keys.sh -t "$TOKEN"                 # revoke own keys
  revoke-all-keys.sh --dev-user developer        # dev environment
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -A|--all-users)     ALL_USERS=1; shift ;;
    --user)             TARGET_USER="$2"; shift 2 ;;
    --start-user)       START_USER="$2"; shift 2 ;;
    --permanent)        PERMANENT=1; shift ;;
    -u|--base-url)      BASE_URL="$2"; shift 2 ;;
    -t|--token)         ACCESS_TOKEN="$2"; shift 2 ;;
    -r|--refresh-token) REFRESH_TOKEN="$2"; shift 2 ;;
    --dev-user)         DEV_USER="$2"; shift 2 ;;
    --dev-role)         DEV_ROLES="[\"$2\"]"; shift 2 ;;
    -n|--dry-run)       DRY_RUN=1; shift ;;
    -y|--yes)           ASSUME_YES=1; shift ;;
    -h|--help)          usage; exit 0 ;;
    *)                  die "Unknown option: $1 (see --help)" ;;
  esac
done

[[ "$ALL_USERS" -eq 0 || -z "$TARGET_USER" ]] || die "--all-users and --user are mutually exclusive"
[[ -z "$START_USER" || "$ALL_USERS" -eq 1 ]] || die "--start-user requires --all-users"

command -v curl >/dev/null || die "curl is required"
preflight() {
  # Fail fast on unreachable base URL with an actionable hint
  local probe
  probe="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' \
    "$BASE_URL/api/v1/health" 2>/dev/null || true)"
  if [[ "$probe" =~ ^(0|000)$ ]]; then
    die "cannot reach $BASE_URL — pass the portal origin for OpenShift deployments:
  revoke-all-keys.sh -u https://litemaas-portal.rhoai.rh-aiservices-bu.com ...
(the deployed frontend's nginx proxies /api/ to the backend)"
  fi
  echo "Backend reachable (health probe: HTTP $probe)"
}

command -v jq >/dev/null || die "jq is required"
preflight

api() { # method path [json-body]
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS --max-time 30 -X "$method" -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H 'Content-Type: application/json' -d "$body" "$BASE_URL$path"
  else
    curl -sS --max-time 30 -X "$method" -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL$path"
  fi
}

# Listing endpoints trigger per-key LiteLLM spend enrichment on the backend,
# which can take minutes per user when LiteLLM is slow, and can hit the API's
# 1000 req/5m rate limit. Be patient: honor retryAfterMs on 429s, retry up to
# 10x. DELETEs stay fast (no enrichment; a failure there is a real failure).
api_list() { # path
  local path="$1" attempt resp wait_s
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    resp="$(curl -sS --max-time 120 -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL$path" 2>&1 || true)"
    # A valid response must be JSON AND not an error body ({error: ...})
    if jq -e . <<<"${resp:-}" >/dev/null 2>&1 \
       && ! jq -e 'has("error")' <<<"${resp:-}" >/dev/null 2>&1; then
      printf '%s' "$resp"; return 0
    fi
    # Honor Retry-After for rate limiting; wait it out instead of hammering
    wait_s="$(jq -r '.. | .retryAfterMs? // empty' <<<"${resp:-}" 2>/dev/null | tail -1 | awk '{printf "%d", $1/1000 + 2}')"
    [[ -z "$wait_s" || "$wait_s" -eq 0 ]] && wait_s=15
    echo "  (list attempt $attempt failed or rate-limited — waiting ${wait_s}s)" >&2
    sleep "$wait_s"
  done
  printf '%s' "$resp"
}

# --- Obtain an access token -------------------------------------------------

if [[ -n "$DEV_USER" ]]; then
  echo "Minting dev token for '$DEV_USER' from $BASE_URL ..."
  resp="$(curl -sS --max-time 30 -X POST -H 'Content-Type: application/json' \
    -d "{\"username\":\"$DEV_USER\",\"roles\":$DEV_ROLES}" \
    "$BASE_URL/api/v1/auth/dev-token")" || die "dev-token request failed"
  ACCESS_TOKEN="$(jq -er '.access_token // empty' <<<"$resp")" \
    || die "dev-token failed: $resp"
elif [[ -z "$ACCESS_TOKEN" && -n "$REFRESH_TOKEN" ]]; then
  echo "Exchanging refresh token for access token ..."
  resp="$(curl -sS --max-time 30 -X POST -H 'Content-Type: application/json' \
    -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" "$BASE_URL/api/auth/refresh")"
  ACCESS_TOKEN="$(jq -er '.accessToken // empty' <<<"$resp")" \
    || die "refresh failed: $resp"
elif [[ -z "$ACCESS_TOKEN" ]]; then
  echo "No token supplied. Log into the LiteMaaS web UI (SSO), then in the"
  echo "browser DevTools console run:  localStorage.getItem('access_token')"
  read -r -p "Paste access token: " ACCESS_TOKEN
  [[ -n "$ACCESS_TOKEN" ]] || die "no token provided"
fi

# --- Verify identity ----------------------------------------------------------

me="$(api GET /api/v1/auth/me || true)"
if ! jq -e '.id' <<<"${me:-}" >/dev/null 2>&1; then
  # Token may be expired — try one refresh if possible, then re-verify.
  if [[ -n "$REFRESH_TOKEN" ]]; then
    echo "Token rejected; refreshing ..."
    resp="$(curl -sS --max-time 30 -X POST -H 'Content-Type: application/json' \
      -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}" "$BASE_URL/api/auth/refresh")" || true
    ACCESS_TOKEN="$(jq -er '.accessToken // empty' <<<"$resp" || true)" \
      || die "refresh failed: $resp"
    me="$(api GET /api/v1/auth/me || true)"
  fi
  jq -e '.id' <<<"${me:-}" >/dev/null 2>&1 \
    || die "authentication failed (invalid/expired token?): ${me:-<no response>}"
fi
USER_ID="$(jq -r '.id' <<<"$me")"
USER_NAME="$(jq -r '.username // .name // .id' <<<"$me")"
echo "Authenticated as: $USER_NAME ($USER_ID)"

# --- Collect active keys ------------------------------------------------------

declare -a KEY_IDS=() KEY_NAMES=() KEY_OWNERS=() KEY_OWNER_NAMES=()

collect_self_keys() { # $1 = owner label
  local label="$1" page=1 resp n total_pages
  while :; do
    resp="$(api_list "/api/v1/api-keys?page=$page&limit=100&isActive=true")"
    jq -e '.data' <<<"${resp:-}" >/dev/null 2>&1 \
      || die "failed to list API keys (page $page): ${resp:-<no response>}"
    n="$(jq '.data | length' <<<"$resp")"
    [[ "$n" -eq 0 ]] && break
    while IFS=$'\t' read -r id name; do
      KEY_IDS+=("$id"); KEY_NAMES+=("$name")
      KEY_OWNERS+=("$USER_ID"); KEY_OWNER_NAMES+=("$label")
    done < <(jq -r '.data[] | [.id, .name] | @tsv' <<<"$resp")
    total_pages="$(jq -r '.pagination.totalPages // 1' <<<"$resp")"
    [[ "$page" -ge "$total_pages" ]] && break
    page=$((page + 1))
  done
}

collect_admin_keys() { # $1 = user id, $2 = username
  local uid="$1" uname="$2" page=1 resp n total_pages
  while :; do
    resp="$(api_list "/api/v1/admin/users/$uid/api-keys?page=$page&limit=100&isActive=true")"
    jq -e '.data' <<<"${resp:-}" >/dev/null 2>&1 \
      || die "failed to list keys of user $uname ($uid), page $page: ${resp:-<no response>}"
    n="$(jq '.data | length' <<<"$resp")"
    [[ "$n" -eq 0 ]] && break
    while IFS=$'\t' read -r id name; do
      KEY_IDS+=("$id"); KEY_NAMES+=("$name")
      KEY_OWNERS+=("$uid"); KEY_OWNER_NAMES+=("$uname")
    done < <(jq -r '.data[] | [.id, .name] | @tsv' <<<"$resp")
    total_pages="$(jq -r '.pagination.totalPages // 1' <<<"$resp")"
    [[ "$page" -ge "$total_pages" ]] && break
    page=$((page + 1))
  done
}

if [[ "$ALL_USERS" -eq 1 ]]; then
  resp="$(api_list /api/v1/admin/users)"
  jq -e '.users' <<<"${resp:-}" >/dev/null 2>&1 \
    || die "failed to list users (need admin:usage permission): ${resp:-<no response>}"
  total_users="$(jq '.users | length' <<<"$resp")"
  if [[ -n "$START_USER" ]]; then
    start_idx="$(jq -r --arg id "$START_USER" '.users | to_entries | map(select(.value.userId == $id)) | .[0].key // empty' <<<"$resp")"
    [[ -n "$start_idx" ]] || die "--start-user $START_USER not found in user list"
    start_idx=$((start_idx + 1))   # resume WITH the failing user (its keys were not collected)
    echo "Resuming from user $START_USER (index $start_idx/$total_users); skipping earlier users."
  else
    start_idx=1
  fi
  echo "Admin mode: $total_users user(s) in system. Collecting active keys..."
  i=0
  while IFS=$'\t' read -r uid uname; do
    i=$((i + 1))
    if [[ "$i" -lt "$start_idx" ]]; then continue; fi
    printf '\r  [%d/%d] %s' "$i" "$total_users" "$uname"
    collect_admin_keys "$uid" "$uname"
  done < <(jq -r '.users[] | [.userId, .username] | @tsv' <<<"$resp")
  echo
elif [[ -n "$TARGET_USER" ]]; then
  echo "Admin mode: collecting active keys of user $TARGET_USER..."
  collect_admin_keys "$TARGET_USER" "$TARGET_USER"
else
  echo "Self mode: collecting your active keys..."
  collect_self_keys "$USER_NAME"
fi

total="${#KEY_IDS[@]}"
echo
if [[ "$total" -eq 0 ]]; then
  echo "No active API keys found. Nothing to do."
  exit 0
fi

mode_word="active"
[[ "$PERMANENT" -eq 1 ]] && mode_word="permanent deletion of"
echo "$mode_word keys ($total):"
for i in "${!KEY_IDS[@]}"; do
  if [[ "$ALL_USERS" -eq 1 || -n "$TARGET_USER" ]]; then
    echo "  - [${KEY_OWNER_NAMES[$i]}] ${KEY_NAMES[$i]}  (${KEY_IDS[$i]})"
  else
    echo "  - ${KEY_NAMES[$i]}  (${KEY_IDS[$i]})"
  fi
done

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "Dry run: no keys were revoked."
  exit 0
fi

# --- Confirm ------------------------------------------------------------------

if [[ "$ASSUME_YES" -ne 1 ]]; then
  echo
  read -r -p "Revoke ALL $total key(s) above? This cannot be undone. [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# --- Revoke -------------------------------------------------------------------

ok=0; failed=0
for i in "${!KEY_IDS[@]}"; do
  id="${KEY_IDS[$i]}"
  owner="${KEY_OWNERS[$i]}"
  rc=0
  if [[ "$ALL_USERS" -eq 1 || -n "$TARGET_USER" ]]; then
    qs=""; [[ "$PERMANENT" -eq 1 ]] && qs="?permanent=true"
    resp="$(api DELETE "/api/v1/admin/users/$owner/api-keys/$id$qs" || true)"
    jq -e '.success == true' <<<"${resp:-}" >/dev/null 2>&1 || rc=1
  else
    resp="$(api DELETE "/api/v1/api-keys/$id" || true)"
    jq -e '.deletedAt' <<<"${resp:-}" >/dev/null 2>&1 || rc=1
  fi
  if [[ "$rc" -eq 0 ]]; then
    echo "ok"
    ok=$((ok + 1))
  else
    echo "FAILED: ${resp:-<no response>}"
    failed=$((failed + 1))
  fi
done

echo
echo "Done: $ok revoked, $failed failed."
[[ "$failed" -eq 0 ]]

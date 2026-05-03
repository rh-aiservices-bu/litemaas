# CLAUDE.md - LiteMaaS Backend Context

> **Note for AI Assistants**: This is a backend-specific context file for the LiteMaaS Fastify API server. For project overview, see root CLAUDE.md. For frontend context, see frontend/CLAUDE.md.

## 🎯 Backend Overview

**@litemaas/backend** - Fastify-based API server with PostgreSQL, OAuth2/JWT authentication, role-based access control, and LiteLLM integration.

**Development Server**: Running on port 8081 with auto-reload (`tsx watch`) and structured logging (`pino-pretty`)

## 🚨 CRITICAL FOR AI ASSISTANTS - Server and Logging

**⚠️ The backend server is already running!** Do not start new processes.

### Checking Backend Status and Logs

```bash
# DO NOT run npm run dev - server is already running!

# Check recent backend logs (last 100 lines):
tail -n 100 ../logs/backend.log

# Watch backend logs in real-time:
tail -f ../logs/backend.log

# Check for errors:
grep -i error ../logs/backend.log | tail -n 20

# Check for specific route activity:
grep "POST /api" ../logs/backend.log | tail -n 20

# Check server health:
curl http://localhost:8081/api/v1/health

# Check API documentation:
curl http://localhost:8081/docs
```

### Server Information

- **API URL**: `http://localhost:8081`
- **Health Check**: `http://localhost:8081/api/v1/health`
- **API Docs**: `http://localhost:8081/docs`
- **Auto-reload**: Enabled - changes to `.ts` files automatically restart the server
- **Log Location**: `../logs/backend.log` (relative to backend directory)

### Debugging Workflow

1. **Make code changes** - Save the file
2. **Check logs for compilation** - `tail -n 50 ../logs/backend.log`
3. **If compilation errors** - Fix and save, auto-reload will retry
4. **If runtime errors** - Read stack trace in logs
5. **Test with curl or Playwright** - Don't restart server

## 📁 Backend Structure

See [`docs/architecture/project-structure.md`](../docs/architecture/project-structure.md) for complete backend directory structure.

## 🔌 Plugin Architecture

Fastify plugins are registered in specific order:

1. **env** - Load environment variables
2. **database** - PostgreSQL connection pool
3. **redis** - Optional Redis connection for LiteLLM cache flush after model CRUD (`REDIS_HOST`/`REDIS_PORT`)
4. **auth** - JWT token handling
5. **oauth** - OAuth2 provider setup
6. **session** - Session management
7. **rbac** - Role-based access control
8. **rate-limit** - Request rate limiting
9. **swagger** - API documentation
10. **subscription-hooks** - Subscription lifecycle hooks

## 🗄️ Database Schema

**Core Tables**: users, teams, models, subscriptions, api_keys, audit_logs, daily_usage_cache, subscription_status_history, branding_settings, system_settings

**Subscription Approval Workflow**: `subscription_status_history` table tracks all status changes with full audit trail. Models table includes `restricted_access` boolean. Subscriptions enhanced with `status_reason`, `status_changed_at`, `status_changed_by` fields and unique constraint `(user_id, model_id)`.

**Encrypted API Key Storage**: Models table includes `encrypted_api_key` (TEXT) column storing provider API keys encrypted with AES-256-GCM. Used to enable configuration testing during model editing without re-entering the key. Encryption key derived from `LITELLM_MASTER_KEY` (falls back to `LITELLM_API_KEY`). See `src/utils/encryption.ts`.

**Branding Customization**: `branding_settings` singleton table (enforced via `CHECK (id = 1)`) stores login page and header branding — custom logos (base64), title, subtitle, and per-element enable/disable toggles. Public `GET` endpoints serve settings metadata and images; admin `PATCH`/`PUT`/`DELETE` endpoints require `admin:banners:write` permission. See `src/services/branding.service.ts` and `src/routes/branding.ts`.

**System Settings**: `system_settings` table is a key-value store with JSONB values for admin-configurable settings. The `api_key_defaults` row stores default and maximum quota values (max budget, TPM, RPM, budget duration, soft budget) for user self-service API key creation. Updates are audit-logged. See `src/services/settings.service.ts` and `src/routes/admin-settings.ts`.

**System User**: Fixed UUID `00000000-0000-0000-0000-000000000001` for audit trail of automated actions (e.g., model restriction cascades).

**Admin User Management Audit**: All admin-initiated user management actions (API key creation/revocation, budget updates) are logged to `audit_logs` with action type, admin user ID, target user ID, and operation metadata.

**Admin Usage Analytics Caching**: `daily_usage_cache` table implements intelligent day-by-day incremental caching:

- **Historical days** (>1 day old): Permanent cache with `is_complete = true`, never refreshed
- **Current day**: 5-minute TTL with `is_complete = false`, auto-refreshed when stale
- **Data enrichment**: LiteLLM raw data enriched with user mappings by joining API keys
- **Configuration**: Cache TTL exposed via `/api/v1/config` endpoint, consumed by frontend ConfigContext for dynamic React Query `staleTime`
- **7 Admin Endpoints**: `/analytics`, `/by-user`, `/by-model`, `/by-provider`, `/export`, `/refresh-today`, `/filter-options`

For complete schema and caching details, see [`docs/architecture/database-schema.md`](../docs/architecture/database-schema.md).

## 🔐 Authentication & Authorization

**OAuth2/OIDC Flow**: `/api/auth/login -> OAuth/OIDC provider -> /api/auth/callback -> JWT token with roles`

**Dual Provider Support** (`AUTH_PROVIDER` env var):
- **`openshift`** (default): OpenShift OAuth with Kubernetes user API for groups
- **`oidc`**: Standard OpenID Connect with auto-discovery, PKCE (S256), nonce validation, and audience claim verification. Supports Keycloak, Auth0, Okta, Azure AD, and any OIDC-compliant provider.

**Key Auth Files**:
- `src/services/oauth.service.ts` — Core OAuth/OIDC logic (discovery caching, PKCE, token exchange, user provisioning)
- `src/plugins/oauth.ts` — Session state management (state, code verifier, nonce, frontend origin)
- `src/routes/auth.ts` — OAuth flow endpoints (`/api/auth/login`, `/callback`, `/logout`, `/validate`)

**OIDC Security**: Discovery document cached 24h with stale-cache failover; nonce and aud claims validated on ID tokens; PKCE S256 challenge for authorization code flow.

**RBAC**: Three-tier hierarchy `admin > adminReadonly > user` with group mapping (OpenShift groups or OIDC group claims via `OIDC_GROUPS_CLAIM`).

**Subscription Approval Permissions**: `admin:subscriptions:read` (admin, adminReadonly), `admin:subscriptions:write` (admin only), `admin:subscriptions:delete` (admin only)

**User Management Permissions**: `users:read` (admin, adminReadonly — view user details, API keys, subscriptions), `users:write` (admin only — update budget/limits, create/revoke API keys)

**Backup Permissions**: `admin:backup` (admin only — create, download, delete, restore, test-restore backups)

**API Keys**: `Authorization: Bearer sk-litellm-{key}`

**Development**: `OAUTH_MOCK_ENABLED=true` for auto-login (also enabled by default when `NODE_ENV=development`).

For details, see [`docs/features/user-roles-administration.md`](../docs/features/user-roles-administration.md) and [`docs/deployment/authentication.md`](../docs/deployment/authentication.md).

## 🎯 Service Layer Pattern

**BaseService Inheritance**: All services extend `BaseService` for consistent CRUD operations, transaction support, and error handling.

**Core Services**:

- **User/Auth**: RBACService, OAuthService, TokenService
- **Resources**: ApiKeyService, SubscriptionService (enhanced with approval workflow), ModelSyncService, TeamService
- **Analytics** (Major Feature):
  - `UsageStatsService` - User-level usage analytics
  - `AdminUsageStatsService` - **System-wide analytics** with trend analysis and multi-dimensional filtering
  - `DailyUsageCacheManager` - **Day-by-day incremental caching** (permanent historical cache, 5-min TTL for current day)
- **Integration**: LiteLLMService, LiteLLMIntegrationService
- **Admin**: AdminService, admin-users route (user details, budget/limits, API keys, subscriptions)
- **Settings**: SettingsService (API key quota defaults and maximums via `system_settings` table)
- **Branding**: BrandingService (login page and header customization)
- **Backup**: BackupService (database backup/restore for LiteMaaS and LiteLLM with type-aware SQL serialization)

**Admin Analytics Architecture**: Uses specialized service architecture with orchestrator pattern:

- `AdminUsageStatsService` - Main orchestrator
- `AdminUsageAggregationService` - Multi-dimensional filtering and aggregation
- `AdminUsageEnrichmentService` - Data enrichment with batch queries
- `AdminUsageTrendCalculator` - Trend analysis and comparisons
- `AdminUsageExportService` - CSV/JSON exports

See [`docs/architecture/services.md`](../docs/architecture/services.md) for complete service architecture and data flows.

## ⚠️ Implementation Patterns - MUST FOLLOW

**All patterns and code examples**: See [`docs/development/pattern-reference.md`](../docs/development/pattern-reference.md) for authoritative implementation patterns.

**Critical Rules**:

1. **Services**: MUST extend `BaseService` - provides validation, error handling, transactions
2. **Errors**: MUST use `ApplicationError` factory methods - never `new Error()`
3. **Routes**: MUST use `preHandler` middleware for auth/RBAC - never manual checks
4. **Database**: MUST use `executeQuery*` helpers with error mapping
5. **Admin Routes**: Use `app.requirePermission('admin:usage')` for granular permissions
6. **Caching Pattern**: Follow day-by-day incremental caching model (see AdminUsageStatsService)

**Pattern Examples Available**:

- Service implementation with BaseService inheritance
- Route patterns with RBAC middleware
- Error handling with ApplicationError
- Day-by-day caching with intelligent TTL
- Admin-only endpoints with permission checks
- Database transactions and query helpers

## 📄 LiteLLM Integration

**Model Sync**: Auto-sync on startup from `/model/info` endpoint with LiteLLM database cross-reference (`LiteLLM_ProxyModelTable`) to filter stale cache entries. Direct DB insert on model creation for immediate frontend availability. Full cascade on model deletion (subscriptions, API key associations, model row).

**API Key Flow**: Database creation → LiteLLM key generation → One-time user display.

**⚠️ LiteLLM Null Value Gotcha**: LiteLLM's `/user/update` silently ignores `null` values for `tpm_limit`, `rpm_limit`, and `budget_duration` (the `v is not None` check in `_update_internal_user_params` filters them out). Only `max_budget` supports `null` (special-cased via `fields_set`). To "clear" TPM/RPM limits, send `2147483647` (max int32, defined as `LITELLM_UNLIMITED`) as a sentinel for "unlimited". See [`docs/architecture/litellm-integration.md`](../docs/architecture/litellm-integration.md) for full details.

**⚠️ Fastify/Ajv Null Coercion Gotcha**: Fastify uses Ajv with `coerceTypes: true`. In TypeBox `Type.Union([Type.Integer(), Type.Null()])`, Ajv evaluates `anyOf` schemas in order and coerces `null → 0` for the integer branch before reaching the null branch. **Always put `Type.Null()` first**: `Type.Union([Type.Null(), Type.Integer()])`. See [`docs/development/pattern-reference.md`](../docs/development/pattern-reference.md) for the pattern.

For details, see [`docs/architecture/litellm-integration.md`](../docs/architecture/litellm-integration.md).

## 🚀 Development Commands

```bash
# ⚠️ FOR AI ASSISTANTS: These commands are for human developers
# The server is already running - just read the logs!

# Development with auto-reload and logging (ALREADY RUNNING)
npm run dev:logged

# Development with auto-reload (no logging)
npm run dev

# Development with OAuth (requires .env.oauth.local)
npm run dev:oauth
npm run dev:oauth:logged  # With logging

# Check logs (USE THESE INSTEAD OF STARTING SERVERS)
npm run logs              # View backend logs
npm run logs:clear        # Clear log file

# Testing
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:security    # Security tests
npm run test:coverage    # Coverage report
npm run test:perf       # K6 performance tests

# Database
npm run db:seed         # Seed test data
npm run db:setup        # Initialize database

# Code quality
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix issues
npm run build           # TypeScript compilation
```

## 🧪 Testing

**IMPORTANT**: Tests use a separate `litemaas_test` database, NOT the development database.

### Test Database Setup

Before running tests for the first time:

```bash
# Create test database
psql -U pgadmin -h localhost -p 5432 -d postgres -c "CREATE DATABASE litemaas_test;"

# Initialize schema
npm run test:db:setup
```

### Running Tests

```bash
npm run test:unit        # Unit tests (mocked, no database)
npm run test:integration # Integration tests (real database: litemaas_test)
npm run test:security    # Security tests
npm run test:coverage    # Coverage report
npm run test:perf        # K6 performance tests
```

### Test Database Management

```bash
npm run test:db:reset    # Reset test database to clean state
npm run test:db:setup    # Initialize/reset test database schema
```

**Safety**: Tests include multiple safety checks to prevent running against development/production databases. The test database URL is hardcoded in `vitest.config.ts`, and integration tests will fail immediately if they detect a non-test database.

## 🔧 Key Implementation Details

### Default Team Pattern

- UUID: `a0000000-0000-4000-8000-000000000001`
- Auto-assigned to all users, empty `allowed_models: []` grants access to all models

### Multi-Model API Keys

Modern approach supports multiple models per key with budget/TPM limits. Legacy single-subscription approach shows deprecation warnings.

### Security Features

- Role-based route protection with middleware validation
- Data access control (users see own data, admins see all)
- Audit logging for all admin actions
- Rate limiting with role-specific limits

For implementation examples, see [`docs/development/backend-guide.md`](../docs/development/backend-guide.md).

### Concurrency Handling

**Advisory Locks**: Uses PostgreSQL advisory locks to prevent race conditions during cache rebuilds with non-blocking locks, grace period logic for midnight boundaries, and idempotent UPSERT patterns.

**Cache Metrics**: `GET /api/v1/admin/usage/cache/metrics` tracks hits/misses, rebuilds, lock contention.

See [`docs/development/concurrency-strategy.md`](../docs/development/concurrency-strategy.md) for implementation details and usage examples.

## ⚙️ Admin Analytics Configuration

All admin analytics business logic constants are centralized in `src/config/admin-analytics.config.ts` with Zod validation.

**Key Categories**: Cache settings (TTL, batch sizes), pagination limits, trend thresholds, export limits, date range limits.

**Access**: `getAdminAnalyticsConfig()` in services, `fastify.getAdminAnalyticsConfig()` in routes.

**Public API**: `GET /api/v1/config/admin-analytics` returns safe subset (frontend-safe values only).

## 🔗 Environment Variables

Key configuration: DATABASE_URL, JWT_SECRET, OAUTH_CLIENT_ID, LITELLM_API_URL, OAUTH_MOCK_ENABLED, LITELLM_DATABASE_URL (backup/restore + model sync cross-reference), BACKUP_STORAGE_PATH, REDIS_HOST/REDIS_PORT (optional, LiteLLM cache flush), plus 15+ admin analytics settings.

See [`docs/deployment/configuration.md`](../docs/deployment/configuration.md) and `.env.example` for complete list.

## 🚨 Error Handling Architecture

**ApplicationError Class**: Structured error handling with factory methods for common error types.

**BaseService Integration**: Built-in validation helpers, error creation methods, and database error mapping.

**Key Features**: Standardized responses, i18n support, retry logic, contextual logging.

For details, see [`docs/development/error-handling.md`](../docs/development/error-handling.md).

## 🛠️ Troubleshooting for AI Assistants

### Common Issues and How to Check

1. **"Cannot connect to backend"**

   ```bash
   # Check if server is running
   tail -n 20 ../logs/backend.log
   curl http://localhost:8081/health
   ```

2. **"Database connection error"**

   ```bash
   # Check for database errors
   grep -i "database\|postgres" ../logs/backend.log | tail -n 20
   ```

3. **"Route not found"**

   ```bash
   # Check registered routes
   grep "Route registered" ../logs/backend.log | tail -n 50
   ```

4. **"Authentication failed"**

   ```bash
   # Check auth errors
   grep -i "auth\|jwt\|oauth" ../logs/backend.log | tail -n 20
   ```

5. **"TypeScript compilation error"**

   ```bash
   # Check for compilation errors (auto-reload will show these)
   grep -i "error\|failed" ../logs/backend.log | tail -n 30
   ```

### Remember

- **DO NOT** start new server processes
- **DO NOT** run `npm run dev` (it's already running)
- **DO** read the logs to understand what's happening
- **DO** let auto-reload handle code changes
- **DO** tell the user if they need to manually restart

## 📚 Related Documentation

- Root [`CLAUDE.md`](../CLAUDE.md) - Project overview
- Frontend [`CLAUDE.md`](../frontend/CLAUDE.md) - Frontend context
- [`docs/api/`](../docs/api/) - API documentation
- [`docs/architecture/`](../docs/architecture/) - System design
- [`docs/deployment/`](../docs/deployment/) - Deployment guides
- [`docs/development/error-handling.md`](../docs/development/error-handling.md) - Error handling best practices

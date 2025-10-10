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
3. **auth** - JWT token handling
4. **oauth** - OAuth2 provider setup
5. **session** - Session management
6. **rbac** - Role-based access control
7. **rate-limit** - Request rate limiting
8. **swagger** - API documentation
9. **subscription-hooks** - Subscription lifecycle hooks

## 🗄️ Database Schema

**Core Tables**: users, teams, models, subscriptions, api_keys, audit_logs, daily_usage_cache

**Admin Usage Analytics Caching**: `daily_usage_cache` table implements intelligent day-by-day incremental caching:

- **Historical days** (>1 day old): Permanent cache with `is_complete = true`, never refreshed
- **Current day**: 5-minute TTL with `is_complete = false`, auto-refreshed when stale
- **Data enrichment**: LiteLLM raw data enriched with user mappings by joining API keys
- **Configuration**: Cache TTL exposed via `/api/v1/config` endpoint, consumed by frontend ConfigContext for dynamic React Query `staleTime`
- **7 Admin Endpoints**: `/analytics`, `/by-user`, `/by-model`, `/by-provider`, `/export`, `/refresh-today`, `/filter-options`

For complete schema and caching details, see [`docs/architecture/database-schema.md`](../docs/architecture/database-schema.md).

## 🔐 Authentication & Authorization

**OAuth2 Flow**: `/api/auth/login -> OAuth provider -> /api/auth/callback -> JWT token with roles`

**RBAC**: Three-tier hierarchy `admin > adminReadonly > user` with OpenShift group mapping.

**API Keys**: `Authorization: Bearer sk-litellm-{key}`

**Development**: `MOCK_AUTH=true` for auto-login.

For details, see [`docs/features/user-roles-administration.md`](../docs/features/user-roles-administration.md).

## 🎯 Service Layer Pattern

**BaseService Inheritance**: All services extend `BaseService` for consistent CRUD operations, transaction support, and error handling.

**Core Services**:

- **User/Auth**: RBACService, OAuthService, TokenService
- **Resources**: ApiKeyService, SubscriptionService, ModelSyncService, TeamService
- **Analytics** (Major Feature):
  - `UsageStatsService` - User-level usage analytics
  - `AdminUsageStatsService` - **System-wide analytics** with trend analysis and multi-dimensional filtering
  - `DailyUsageCacheManager` - **Day-by-day incremental caching** (permanent historical cache, 5-min TTL for current day)
- **Integration**: LiteLLMService, LiteLLMIntegrationService
- **Admin**: AdminService

For service architecture and data flows, see [`docs/architecture/services.md`](../docs/architecture/services.md).

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

**Model Sync**: Auto-sync on startup from `/model/info` endpoint with graceful fallback to mock data.

**API Key Flow**: Database creation → LiteLLM key generation → One-time user display.

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

## 🔗 Environment Variables

Key configuration: DATABASE_URL, JWT_SECRET, OAUTH_CLIENT_ID, LITELLM_API_URL, MOCK_AUTH

See [`docs/deployment/configuration.md`](../docs/deployment/configuration.md) for complete list.

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

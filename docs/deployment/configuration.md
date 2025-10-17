# LiteMaaS Configuration Guide

This document consolidates all environment variables used in the LiteMaaS application. Each variable is documented with its purpose, default value, and usage examples.

## Table of Contents

- [Database Configuration](#database-configuration)
- [OAuth Configuration](#oauth-configuration)
- [JWT Configuration](#jwt-configuration)
- [LiteLLM Integration](#litellm-integration)
- [Backend API Protection](#backend-api-protection)
- [Default User Values](#default-user-values)
- [Admin Analytics Configuration](#admin-analytics-configuration)
- [Admin Analytics Rate Limits](#admin-analytics-rate-limits)
- [Server Configuration](#server-configuration)
- [Frontend Configuration](#frontend-configuration-vite)
- [Environment Templates](#environment-templates)

## Database Configuration

| Variable                | Description                            | Default                                              | Required |
| ----------------------- | -------------------------------------- | ---------------------------------------------------- | -------- |
| `DATABASE_URL`          | PostgreSQL connection string           | `postgresql://user:password@localhost:5432/litemaas` | Yes      |
| `DB_MAX_CONNECTIONS`    | Maximum database connection pool size  | `20`                                                 | No       |
| `DB_IDLE_TIMEOUT`       | Connection idle timeout (milliseconds) | `30000`                                              | No       |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (milliseconds)      | `5000`                                               | No       |

### Example

```bash
DATABASE_URL=postgresql://admin:secure-password@db.example.com:5432/litemaas_prod
DB_MAX_CONNECTIONS=50
DB_IDLE_TIMEOUT=60000
DB_CONNECTION_TIMEOUT=10000
```

## OAuth Configuration

| Variable                  | Description                                                          | Default                                   | Required |
| ------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | -------- |
| `OAUTH_CLIENT_ID`         | OpenShift OAuth client ID                                            | -                                         | Yes      |
| `OAUTH_CLIENT_SECRET`     | OpenShift OAuth client secret                                        | -                                         | Yes      |
| `OAUTH_ISSUER`            | OAuth provider URL                                                   | -                                         | Yes      |
| `OAUTH_CALLBACK_URL`      | OAuth callback URL                                                   | `http://localhost:8081/api/auth/callback` | No       |
| `K8S_API_SKIP_TLS_VERIFY` | Skip TLS verification for Kubernetes API calls (⚠️ Use with caution) | -                                         | No       |

### OAuth Flow Architecture

In containerized deployments, the OAuth flow works through NGINX as a reverse proxy:

```mermaid
graph LR
    A[Browser] -->|1. Login Request| B[NGINX :8080]
    B -->|2. Proxy /api/*| C[Backend :8081]
    C -->|3. OAuth URL| A
    A -->|4. Auth| D[OAuth Provider]
    D -->|5. Callback| B
    B -->|6. Proxy| C
    C -->|7. Process & Redirect| B
    B -->|8. Serve Frontend| A
```

### OAuth Callback URL Configuration

The `OAUTH_CALLBACK_URL` must **always** point to `/api/auth/callback` through your public-facing URL:

| Environment          | Example Value                               | Notes                              |
| -------------------- | ------------------------------------------- | ---------------------------------- |
| Development (Vite)   | `http://localhost:3000/api/auth/callback`   | Vite dev server proxies to backend |
| Development (Direct) | `http://localhost:8081/api/auth/callback`   | Running backend directly           |
| Container Test       | `http://localhost:8081/api/auth/callback`   | NGINX proxies to backend           |
| Production           | `https://app.example.com/api/auth/callback` | Through load balancer/ingress      |

**Dynamic Callback URL Detection (Enhanced)**:
As of the latest update, the backend implements intelligent OAuth callback URL handling:

1. **Automatic Detection**: The backend detects the appropriate callback URL from the request origin
2. **State Preservation**: The callback URL is stored with the OAuth state parameter during authorization
3. **Exact Matching**: The same stored callback URL is reused during token exchange (OAuth 2.0 compliance)
4. **Fallback Support**: `OAUTH_CALLBACK_URL` serves as a fallback when automatic detection isn't possible

**How It Works**:

```
1. User initiates login → Backend detects origin (e.g., http://localhost:8081)
2. Backend stores callback URL with state → Uses for authorization request
3. OAuth provider redirects to callback → Backend retrieves stored URL
4. Token exchange uses same URL → Ensures redirect_uri matches exactly
```

**Setting OAUTH_CALLBACK_URL**:

- This is now primarily a fallback value
- Set to your most common development URL
- The automatic detection handles environment differences

**Important**:

- Register ALL possible callback URLs with your OAuth provider
- The backend uses relative redirects (`/auth/callback`) after processing
- No `FRONTEND_URL` configuration needed

### Example

```bash
OAUTH_CLIENT_ID=litemaas-oauth-client
OAUTH_CLIENT_SECRET=super-secret-oauth-key
OAUTH_ISSUER=https://oauth.openshift.example.com
# Fallback URL - automatic detection handles most cases
OAUTH_CALLBACK_URL=http://localhost:3000/api/auth/callback
```

### OAuth Provider Setup

For OpenShift OAuth, register ALL possible callback URLs:

```yaml
apiVersion: oauth.openshift.io/v1
kind: OAuthClient
metadata:
  name: litemaas
secret: your-secret-here
redirectURIs:
  # Development environments
  - http://localhost:3000/api/auth/callback # Vite dev server
  - http://localhost:8081/api/auth/callback # Direct backend / Container
  - http://localhost:8081/api/auth/callback # Backend on alt port
  # Production
  - https://app.example.com/api/auth/callback # Production domain
grantMethod: prompt
```

**Note**: The application automatically selects the correct callback URL based on request origin. This allows the same deployment to work across different environments without configuration changes.

### Kubernetes API TLS Verification

In some OpenShift/Kubernetes environments, the API server endpoint (`https://api.<cluster>:6443`) may not have proper SSL certificates configured, even though Ingress routes and load balancers do. This can cause SSL verification errors when the backend fetches user information from the Kubernetes API during OAuth authentication.

**Environment Variable**: `K8S_API_SKIP_TLS_VERIFY`

**Default**: SSL verification is **ENABLED** (secure, recommended for production)

**When to use**: Set to `true` only when:

- You're in a development/testing environment
- The Kubernetes API endpoint lacks proper SSL certificates
- You're experiencing SSL certificate verification errors during login
- You trust the network and cluster (e.g., internal corporate network)

⚠️ **Security Warning**:

- Only use this in **trusted environments**
- This affects **only** the Kubernetes API user info endpoint
- OAuth token exchange and other endpoints are not affected
- Never use in production unless absolutely necessary and the risk is understood

**Example**:

```bash
# Only enable if experiencing SSL errors with K8s API
K8S_API_SKIP_TLS_VERIFY=true
```

**Logging**: When enabled, the backend will log a warning message indicating that TLS verification is being skipped for visibility and security audit purposes.

## JWT Configuration

| Variable         | Description               | Default                     | Required |
| ---------------- | ------------------------- | --------------------------- | -------- |
| `JWT_SECRET`     | JWT signing secret        | `your-super-secret-jwt-key` | Yes      |
| `JWT_EXPIRES_IN` | JWT token expiration time | `24h`                       | No       |

### Example

```bash
JWT_SECRET=your-256-bit-secure-random-string-here
JWT_EXPIRES_IN=7d
```

### Supported Expiration Formats

- Hours: `1h`, `24h`
- Days: `1d`, `7d`, `30d`
- Minutes: `60m`, `1440m`

## LiteLLM Integration

| Variable                      | Description                                    | Default                 | Required |
| ----------------------------- | ---------------------------------------------- | ----------------------- | -------- |
| `LITELLM_API_URL`             | LiteLLM API URL                                | `http://localhost:4000` | No       |
| `LITELLM_API_KEY`             | LiteLLM API key (if required)                  | -                       | No       |
| `LITELLM_AUTO_SYNC`           | Enable automatic model sync on startup         | `true`                  | No       |
| `LITELLM_SYNC_INTERVAL`       | Auto-sync interval (seconds)                   | `60`                    | No       |
| `LITELLM_CONFLICT_RESOLUTION` | Sync conflict resolution strategy              | `litellm_wins`          | No       |
| `LITELLM_TIMEOUT`             | Request timeout (milliseconds)                 | `30000`                 | No       |
| `LITELLM_RETRIES`             | Number of retry attempts                       | `3`                     | No       |
| `LITELLM_RETRY_DELAY`         | Retry delay (milliseconds)                     | `1000`                  | No       |
| `USAGE_CACHE_TTL_MINUTES`     | Cache TTL for current day usage data (minutes) | `5`                     | No       |

### Example

```bash
LITELLM_API_URL=http://litellm-service:4000
LITELLM_API_KEY=your-litellm-api-key
LITELLM_AUTO_SYNC=true
LITELLM_SYNC_INTERVAL=300
LITELLM_CONFLICT_RESOLUTION=database_wins
LITELLM_TIMEOUT=60000
LITELLM_RETRIES=5
LITELLM_RETRY_DELAY=2000

# Usage data cache TTL (affects both backend and frontend refresh rates)
USAGE_CACHE_TTL_MINUTES=5    # Default: 5 minutes
# USAGE_CACHE_TTL_MINUTES=2  # Faster refresh (more API calls to LiteLLM)
# USAGE_CACHE_TTL_MINUTES=10 # Slower refresh (fewer API calls, less current data)
```

### Conflict Resolution Strategies

- `litellm_wins`: LiteLLM data takes precedence
- `database_wins`: Database data takes precedence
- `merge`: Attempt to merge conflicts (not yet implemented)

## Backend API Protection

> **Important**: These settings protect the LiteMaaS backend management API endpoints (user management, API key creation, etc.). They do NOT affect LLM request rate limits, which are configured in LiteLLM using the TPM/RPM values from the Default User Values section.

| Variable                   | Description                              | Default                                                       | Required |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------- | -------- |
| `ADMIN_API_KEYS`           | Comma-separated admin API keys           | -                                                             | No       |
| `RATE_LIMIT_MAX`           | Max backend API requests per time window | `100`                                                         | No       |
| `RATE_LIMIT_TIME_WINDOW`   | Backend API rate limit time window       | `1m`                                                          | No       |
| `ALLOWED_FRONTEND_ORIGINS` | Comma-separated allowed origins          | `localhost:3000,localhost:3001,127.0.0.1:3000,127.0.0.1:3001` | No       |

### Example

```bash
ADMIN_API_KEYS=admin-key-1,admin-key-2,admin-key-3

# Backend API rate limiting (protects management endpoints)
RATE_LIMIT_MAX=200                    # 200 backend API calls per time window
RATE_LIMIT_TIME_WINDOW=5m             # 5 minute window

ALLOWED_FRONTEND_ORIGINS=app.example.com,staging.example.com
```

### What Backend Rate Limiting Protects

These limits apply to LiteMaaS management operations:

- **User management**: Creating/updating users, role assignments
- **API key operations**: Creating, rotating, listing API keys
- **Subscription management**: Creating/updating model subscriptions
- **Model synchronization**: Syncing models from LiteLLM
- **Admin operations**: Bulk updates, system configuration
- **Usage queries**: Fetching usage statistics and reports

**Not affected**: Actual LLM requests to AI models (handled by LiteLLM directly)

### Rate Limit Time Window Formats

- Minutes: `1m`, `5m`, `15m`
- Hours: `1h`, `2h`
- Seconds: `30s`, `60s`

## Default User Values

These variables control the default limits assigned to new users when they first log into LiteMaaS via OAuth. These values are applied during user creation in both the LiteMaaS database and LiteLLM.

| Variable                  | Description                       | Default | Required |
| ------------------------- | --------------------------------- | ------- | -------- |
| `DEFAULT_USER_MAX_BUDGET` | Default budget limit (USD)        | `100`   | No       |
| `DEFAULT_USER_TPM_LIMIT`  | Default tokens per minute limit   | `1000`  | No       |
| `DEFAULT_USER_RPM_LIMIT`  | Default requests per minute limit | `60`    | No       |

### Example

```bash
# Production settings - higher limits
DEFAULT_USER_MAX_BUDGET=500
DEFAULT_USER_TPM_LIMIT=5000
DEFAULT_USER_RPM_LIMIT=300

# Development settings - conservative limits
DEFAULT_USER_MAX_BUDGET=50
DEFAULT_USER_TPM_LIMIT=500
DEFAULT_USER_RPM_LIMIT=30
```

### Important Notes

- **Existing users**: These settings do not affect existing users
- **Fallback behavior**: If not set, system uses hardcoded defaults shown above
- **Admin override**: Administrators can bulk update user limits via the admin API
- **Per-user customization**: Individual user limits can be modified after account creation
- **LLM vs Backend**: These TPM/RPM limits control LLM requests through LiteLLM. For backend API protection, see [Backend API Protection](#backend-api-protection) section

### User Creation Flow

When a user logs in for the first time:

1. **Database record**: Created with configured default values
2. **LiteLLM user**: Created with same default values
3. **Team assignment**: User is assigned to the default team
4. **Inheritance**: User inherits team-level settings where applicable

## Admin Analytics Configuration

These variables control the behavior of the admin analytics feature, including caching, pagination, exports, and trend analysis. All values are configurable via environment variables with sensible defaults.

### Cache Configuration

| Variable                                        | Description                                  | Default | Required |
| ----------------------------------------------- | -------------------------------------------- | ------- | -------- |
| `ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES` | Cache TTL for current day data (minutes)     | `5`     | No       |
| `ADMIN_ANALYTICS_CACHE_HISTORICAL_TTL_DAYS`     | Cache TTL for historical data (days)         | `365`   | No       |
| `ADMIN_ANALYTICS_CACHE_REBUILD_BATCH_SIZE`      | Batch size for cache rebuilds (days)         | `100`   | No       |
| `ADMIN_ANALYTICS_CACHE_SIZE_WARNING_MB`         | Log warning if cache exceeds size (MB)       | `100`   | No       |
| `ADMIN_ANALYTICS_CACHE_GRACE_PERIOD_MINUTES`    | Grace period for midnight boundary (minutes) | `5`     | No       |

### Trend Analysis

| Variable                                    | Description                                | Default | Required |
| ------------------------------------------- | ------------------------------------------ | ------- | -------- |
| `ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD` | Percentage change threshold for stable (%) | `1.0`   | No       |
| `ADMIN_ANALYTICS_TREND_PRECISION`           | Decimal places for trend calculations      | `2`     | No       |

### Pagination

| Variable                            | Description            | Default | Required |
| ----------------------------------- | ---------------------- | ------- | -------- |
| `ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE` | Default items per page | `50`    | No       |
| `ADMIN_ANALYTICS_MAX_PAGE_SIZE`     | Maximum items per page | `500`   | No       |
| `ADMIN_ANALYTICS_MIN_PAGE_SIZE`     | Minimum items per page | `10`    | No       |

### Top N Limits

| Variable                              | Description                  | Default | Required |
| ------------------------------------- | ---------------------------- | ------- | -------- |
| `ADMIN_ANALYTICS_TOP_USERS_LIMIT`     | Number of top users to show  | `10`    | No       |
| `ADMIN_ANALYTICS_TOP_MODELS_LIMIT`    | Number of top models to show | `10`    | No       |
| `ADMIN_ANALYTICS_TOP_PROVIDERS_LIMIT` | Number of top providers      | `5`     | No       |

### Export Limits

| Variable                                  | Description                   | Default | Required |
| ----------------------------------------- | ----------------------------- | ------- | -------- |
| `ADMIN_ANALYTICS_MAX_EXPORT_ROWS`         | Maximum rows in export        | `10000` | No       |
| `ADMIN_ANALYTICS_MAX_EXPORT_FILE_SIZE_MB` | Maximum export file size (MB) | `50`    | No       |

### Warning Thresholds

| Variable                                        | Description                                  | Default | Required |
| ----------------------------------------------- | -------------------------------------------- | ------- | -------- |
| `ADMIN_ANALYTICS_LARGE_DATE_RANGE_WARNING_DAYS` | Log warning for date ranges exceeding (days) | `30`    | No       |

### Date Range Limits

| Variable                             | Description                                     | Default | Required |
| ------------------------------------ | ----------------------------------------------- | ------- | -------- |
| `ADMIN_ANALYTICS_MAX_ANALYTICS_DAYS` | Maximum date range for analytics queries (days) | `90`    | No       |
| `ADMIN_ANALYTICS_MAX_EXPORT_DAYS`    | Maximum date range for data exports (days)      | `365`   | No       |

### Example

```bash
# Cache Configuration
ADMIN_ANALYTICS_CACHE_CURRENT_DAY_TTL_MINUTES=5    # Default: 5 minutes
ADMIN_ANALYTICS_CACHE_HISTORICAL_TTL_DAYS=365      # Default: 365 days (permanent)
ADMIN_ANALYTICS_CACHE_REBUILD_BATCH_SIZE=100       # Default: 100 days
ADMIN_ANALYTICS_CACHE_SIZE_WARNING_MB=100          # Default: 100 MB
ADMIN_ANALYTICS_CACHE_GRACE_PERIOD_MINUTES=5       # Default: 5 minutes

# Trend Analysis
ADMIN_ANALYTICS_TREND_STABILITY_THRESHOLD=1.0      # Default: 1.0%
ADMIN_ANALYTICS_TREND_PRECISION=2                  # Default: 2 decimal places

# Pagination
ADMIN_ANALYTICS_DEFAULT_PAGE_SIZE=50               # Default: 50
ADMIN_ANALYTICS_MAX_PAGE_SIZE=500                  # Default: 500
ADMIN_ANALYTICS_MIN_PAGE_SIZE=10                   # Default: 10

# Top N Limits
ADMIN_ANALYTICS_TOP_USERS_LIMIT=10                 # Default: 10
ADMIN_ANALYTICS_TOP_MODELS_LIMIT=10                # Default: 10
ADMIN_ANALYTICS_TOP_PROVIDERS_LIMIT=5              # Default: 5

# Export Limits
ADMIN_ANALYTICS_MAX_EXPORT_ROWS=10000              # Default: 10,000
ADMIN_ANALYTICS_MAX_EXPORT_FILE_SIZE_MB=50         # Default: 50 MB

# Warning Thresholds
ADMIN_ANALYTICS_LARGE_DATE_RANGE_WARNING_DAYS=30   # Default: 30 days

# Date Range Limits
ADMIN_ANALYTICS_MAX_ANALYTICS_DAYS=90              # Default: 90 days
ADMIN_ANALYTICS_MAX_EXPORT_DAYS=365                # Default: 365 days
```

### Important Notes

- **Cache Configuration**: The current day cache refreshes based on TTL, while historical data is cached permanently
- **Grace Period**: Handles midnight boundary transitions to prevent historical cache from getting short TTL
- **Date Range Limits**: Queries exceeding these limits will be rejected with 400 errors
- **Export Limits**: File size limit is enforced internally, not exposed to frontend
- **Trend Analysis**: Stability threshold determines when changes are considered "stable" vs. trending
- **Configuration Exposure**: Only safe values are exposed via `/api/v1/config/admin-analytics` endpoint

## Admin Analytics Rate Limits

These rate limits protect admin analytics endpoints from abuse. They are separate from general backend API rate limits and LLM request rate limits.

| Variable                     | Description                           | Default | Required |
| ---------------------------- | ------------------------------------- | ------- | -------- |
| `ADMIN_ANALYTICS_RATE_LIMIT` | Max analytics queries per time window | `10`    | No       |
| `ADMIN_CACHE_REBUILD_LIMIT`  | Max cache rebuilds per time window    | `1`     | No       |
| `ADMIN_EXPORT_RATE_LIMIT`    | Max export requests per time window   | `5`     | No       |

### Rate Limit Time Windows

- **Analytics queries**: 1 minute (moderate cost operations)
- **Cache rebuilds**: 5 minutes (very high cost operations)
- **Exports**: 1 minute (moderate-high cost operations)

### Example

```bash
# Admin Analytics Rate Limits
ADMIN_ANALYTICS_RATE_LIMIT=10        # 10 analytics queries per minute
ADMIN_CACHE_REBUILD_LIMIT=1          # 1 cache rebuild per 5 minutes
ADMIN_EXPORT_RATE_LIMIT=5            # 5 export requests per minute
```

### Important Notes

- **Per-user limits**: Rate limits are applied per user (extracted from JWT token)
- **Endpoint protection**: These limits protect admin analytics endpoints only
- **Not for LLM requests**: LLM request limits are configured separately via `DEFAULT_USER_TPM_LIMIT` and `DEFAULT_USER_RPM_LIMIT`
- **Not for backend API**: General backend API protection uses `RATE_LIMIT_MAX` and `RATE_LIMIT_TIME_WINDOW`
- **Cache rebuild restriction**: Very restrictive to prevent system overload from expensive full cache rebuilds

## Server Configuration

| Variable      | Description         | Default                 | Required |
| ------------- | ------------------- | ----------------------- | -------- |
| `HOST`        | Server host address | `0.0.0.0`               | No       |
| `PORT`        | Server port         | `8080`                  | No       |
| `LOG_LEVEL`   | Logging level       | `info`                  | No       |
| `NODE_ENV`    | Environment mode    | `development`           | No       |
| `CORS_ORIGIN` | CORS allowed origin | `http://localhost:3000` | No       |

### Example

```bash
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=debug
NODE_ENV=production
CORS_ORIGIN=https://app.example.com
```

### Log Levels (in order of verbosity)

- `fatal`: Only fatal errors
- `error`: Errors and above
- `warn`: Warnings and above
- `info`: Info messages and above
- `debug`: Debug messages and above
- `trace`: All messages (very verbose)

## Frontend Configuration (Vite)

These variables are used during the frontend build process and must be prefixed with `VITE_`.

| Variable                  | Description                  | Default                 | Required |
| ------------------------- | ---------------------------- | ----------------------- | -------- |
| `VITE_API_URL`            | Backend API URL              | `http://localhost:8081` | Yes      |
| `VITE_OAUTH_CLIENT_ID`    | OAuth client ID for frontend | -                       | Yes      |
| `VITE_OAUTH_REDIRECT_URL` | OAuth redirect URL           | -                       | Yes      |
| `VITE_APP_NAME`           | Application name             | `LiteMaaS`              | No       |
| `VITE_APP_VERSION`        | Application version          | `1.0.0`                 | No       |

### Example

```bash
VITE_API_URL=https://api.example.com
VITE_OAUTH_CLIENT_ID=litemaas-frontend
VITE_OAUTH_REDIRECT_URL=https://app.example.com/auth/callback
VITE_APP_NAME=My LiteMaaS Instance
VITE_APP_VERSION=2.0.0
```

## Environment Templates

### Development Template (.env.development)

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/litemaas_dev

# OAuth (Mock/Development)
OAUTH_CLIENT_ID=dev-client
OAUTH_CLIENT_SECRET=dev-secret
OAUTH_ISSUER=http://localhost:8081

# JWT
JWT_SECRET=development-secret-key-not-for-production

# LiteLLM
LITELLM_API_URL=http://localhost:4000
LITELLM_AUTO_SYNC=false

# Server
LOG_LEVEL=debug
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:8081
VITE_OAUTH_CLIENT_ID=dev-client
VITE_OAUTH_REDIRECT_URL=http://localhost:3000/auth/callback
```

### Production Template (.env.production)

```bash
# Database
DATABASE_URL=postgresql://prod_user:${DB_PASSWORD}@db.internal:5432/litemaas_prod
DB_MAX_CONNECTIONS=50
DB_IDLE_TIMEOUT=60000

# OAuth
OAUTH_CLIENT_ID=${OAUTH_PROD_CLIENT_ID}
OAUTH_CLIENT_SECRET=${OAUTH_PROD_CLIENT_SECRET}
OAUTH_ISSUER=https://oauth.production.com
OAUTH_CALLBACK_URL=https://app.production.com/api/auth/callback

# JWT
JWT_SECRET=${JWT_PROD_SECRET}
JWT_EXPIRES_IN=7d

# LiteLLM
LITELLM_API_URL=http://litellm-service.internal:4000
LITELLM_API_KEY=${LITELLM_PROD_KEY}
LITELLM_AUTO_SYNC=true
LITELLM_SYNC_INTERVAL=300
LITELLM_TIMEOUT=60000
LITELLM_RETRIES=5

# Security
ADMIN_API_KEYS=${ADMIN_KEY_1},${ADMIN_KEY_2}
RATE_LIMIT_MAX=1000
RATE_LIMIT_TIME_WINDOW=5m
ALLOWED_FRONTEND_ORIGINS=app.production.com,www.production.com

# Server
HOST=0.0.0.0
PORT=8080
LOG_LEVEL=warn
NODE_ENV=production
CORS_ORIGIN=https://app.production.com

# Frontend (build-time variables)
VITE_API_URL=https://api.production.com
VITE_OAUTH_CLIENT_ID=${OAUTH_PROD_CLIENT_ID}
VITE_OAUTH_REDIRECT_URL=https://app.production.com/auth/callback
VITE_APP_NAME=LiteMaaS Production
VITE_APP_VERSION=${APP_VERSION}
```

## Security Best Practices

1. **Never commit secrets**: Use environment variables or secret management tools
2. **Use strong secrets**: Generate cryptographically secure random values for secrets
3. **Rotate regularly**: Change API keys and secrets periodically
4. **Principle of least privilege**: Only set admin keys when necessary
5. **Environment separation**: Use different values for dev, staging, and production
6. **Secure storage**: Use tools like HashiCorp Vault, AWS Secrets Manager, or Kubernetes Secrets

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify `DATABASE_URL` format and credentials
   - Check network connectivity to database
   - Ensure database exists and user has permissions

2. **OAuth Authentication Failed**
   - Verify `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`
   - Check `OAUTH_ISSUER` URL is correct and accessible
   - Ensure callback URL is registered with OAuth provider

3. **LiteLLM Sync Failed**
   - Verify `LITELLM_API_URL` is accessible
   - Check if `LITELLM_API_KEY` is required and valid
   - Review sync logs for specific error messages

4. **Rate Limiting Too Restrictive**
   - Increase `RATE_LIMIT_MAX` value
   - Adjust `RATE_LIMIT_TIME_WINDOW` for your use case
   - Consider different limits for different environments

### Debug Mode

For troubleshooting, enable debug logging:

```bash
LOG_LEVEL=debug
NODE_ENV=development
```

This will provide detailed logs for all operations, including database queries, API calls, and authentication flows.

# LiteMaaS Configuration Guide

This document consolidates all environment variables used in the LiteMaaS application. Each variable is documented with its purpose, default value, and usage examples.

## Table of Contents
- [Database Configuration](#database-configuration)
- [OAuth Configuration](#oauth-configuration)
- [JWT Configuration](#jwt-configuration)
- [LiteLLM Integration](#litellm-integration)
- [Security & Rate Limiting](#security--rate-limiting)
- [Server Configuration](#server-configuration)
- [Frontend Configuration](#frontend-configuration-vite)
- [Environment Templates](#environment-templates)

## Database Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/litemaas` | Yes |
| `DB_MAX_CONNECTIONS` | Maximum database connection pool size | `20` | No |
| `DB_IDLE_TIMEOUT` | Connection idle timeout (milliseconds) | `30000` | No |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (milliseconds) | `5000` | No |

### Example
```bash
DATABASE_URL=postgresql://admin:secure-password@db.example.com:5432/litemaas_prod
DB_MAX_CONNECTIONS=50
DB_IDLE_TIMEOUT=60000
DB_CONNECTION_TIMEOUT=10000
```

## OAuth Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OAUTH_CLIENT_ID` | OpenShift OAuth client ID | - | Yes |
| `OAUTH_CLIENT_SECRET` | OpenShift OAuth client secret | - | Yes |
| `OAUTH_ISSUER` | OAuth provider URL | - | Yes |
| `OAUTH_CALLBACK_URL` | OAuth callback URL | `http://localhost:8080/api/auth/callback` | No |

### Example
```bash
OAUTH_CLIENT_ID=litemaas-oauth-client
OAUTH_CLIENT_SECRET=super-secret-oauth-key
OAUTH_ISSUER=https://oauth.openshift.example.com
OAUTH_CALLBACK_URL=https://app.example.com/api/auth/callback
```

## JWT Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret | `your-super-secret-jwt-key` | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration time | `24h` | No |

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

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LITELLM_API_URL` | Primary LiteLLM API URL | `http://localhost:4000` | No |
| `LITELLM_API_KEY` | LiteLLM API key (if required) | - | No |
| `LITELLM_AUTO_SYNC` | Enable automatic model sync on startup | `true` | No |
| `LITELLM_SYNC_INTERVAL` | Auto-sync interval (seconds) | `60` | No |
| `LITELLM_CONFLICT_RESOLUTION` | Sync conflict resolution strategy | `litellm_wins` | No |
| `LITELLM_TIMEOUT` | Request timeout (milliseconds) | `30000` | No |
| `LITELLM_RETRIES` | Number of retry attempts | `3` | No |
| `LITELLM_RETRY_DELAY` | Retry delay (milliseconds) | `1000` | No |

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
```

### Conflict Resolution Strategies
- `litellm_wins`: LiteLLM data takes precedence
- `database_wins`: Database data takes precedence
- `merge`: Attempt to merge conflicts (not yet implemented)

## Security & Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ADMIN_API_KEYS` | Comma-separated admin API keys | - | No |
| `RATE_LIMIT_MAX` | Max requests per time window | `100` | No |
| `RATE_LIMIT_TIME_WINDOW` | Rate limit time window | `1m` | No |
| `ALLOWED_FRONTEND_ORIGINS` | Comma-separated allowed origins | `localhost:3000,localhost:3001,127.0.0.1:3000,127.0.0.1:3001` | No |

### Example
```bash
ADMIN_API_KEYS=admin-key-1,admin-key-2,admin-key-3
RATE_LIMIT_MAX=200
RATE_LIMIT_TIME_WINDOW=5m
ALLOWED_FRONTEND_ORIGINS=app.example.com,staging.example.com
```

### Rate Limit Time Window Formats
- Minutes: `1m`, `5m`, `15m`
- Hours: `1h`, `2h`
- Seconds: `30s`, `60s`

## Server Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HOST` | Server host address | `0.0.0.0` | No |
| `PORT` | Server port | `8080` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `CORS_ORIGIN` | CORS allowed origin | `http://localhost:3000` | No |

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

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8080` | Yes |
| `VITE_OAUTH_CLIENT_ID` | OAuth client ID for frontend | - | Yes |
| `VITE_OAUTH_REDIRECT_URL` | OAuth redirect URL | - | Yes |
| `VITE_APP_NAME` | Application name | `LiteMaaS` | No |
| `VITE_APP_VERSION` | Application version | `1.0.0` | No |

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
OAUTH_ISSUER=http://localhost:8080

# JWT
JWT_SECRET=development-secret-key-not-for-production

# LiteLLM
LITELLM_API_URL=http://localhost:4000
LITELLM_AUTO_SYNC=false

# Server
LOG_LEVEL=debug
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:8080
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
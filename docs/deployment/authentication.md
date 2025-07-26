# LiteMaaS Authentication Guide

## Overview

LiteMaaS implements a multi-layered authentication system that supports different access methods based on use case and environment. The system is designed to be secure in production while remaining developer-friendly during local development.

## Authentication Methods

### 1. JWT Tokens (Frontend Sessions)
- **Purpose**: User authentication for web interface
- **Usage**: Generated after OAuth2/OpenShift SSO login
- **Format**: Standard JWT with user claims
- **Storage**: Frontend stores in memory/localStorage
- **Header**: `Authorization: Bearer <jwt_token>`

### 2. Admin API Keys
- **Purpose**: Administrative and external system access
- **Format**: `ltm_admin_<unique_identifier>`
- **Storage**: Environment variables (never in code)
- **Header**: `Authorization: Bearer ltm_admin_<key>`
- **Example**: `ltm_admin_dev123456789`

### 3. User API Keys
- **Purpose**: Programmatic access to LiteLLM through LiteMaaS
- **Format**: `ltm_<unique_identifier>`
- **Storage**: Hashed in database
- **Header**: `Authorization: Bearer ltm_<key>`
- **Management**: Created/revoked through UI or API

### 4. Development Bypass
- **Purpose**: Frontend development without authentication setup
- **Availability**: Only when `NODE_ENV=development`
- **Mechanism**: Detects requests from allowed localhost origins
- **Security**: Logs all access, disabled in production

## Setup Instructions

### 1. Basic Configuration

```bash
# Backend environment variables (.env)

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret-here
JWT_EXPIRES_IN=24h

# OAuth2 (OpenShift SSO)
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_ISSUER_URL=https://your-openshift-instance
OAUTH_REDIRECT_URI=http://localhost:8080/api/auth/callback

# Admin API Keys (comma-separated)
ADMIN_API_KEYS=ltm_admin_dev123456789,ltm_admin_test987654321

# Development Settings
ALLOWED_FRONTEND_ORIGINS=localhost:3000,localhost:3001,127.0.0.1:3000
ALLOW_DEV_TOKENS=true

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### 2. Production Configuration

```bash
# Production environment variables

# Remove or comment out development settings
# ALLOWED_FRONTEND_ORIGINS=
# ALLOW_DEV_TOKENS=false

# Use strong, randomly generated keys
ADMIN_API_KEYS=ltm_admin_prod_<32-char-random-string>

# Ensure proper OAuth configuration
OAUTH_REDIRECT_URI=https://your-production-domain/api/auth/callback

# Strict CORS
CORS_ORIGIN=https://your-production-domain
```

### 3. OAuth2/OpenShift SSO Setup

1. Register application in OpenShift:
   - Redirect URI: `<your-domain>/api/auth/callback`
   - Grant Type: Authorization Code
   - Scopes: openid, profile, email

2. Configure environment variables with provided credentials

3. Test OAuth flow:
   ```bash
   # Navigate to login endpoint
   curl http://localhost:8080/api/auth/login
   ```

## Testing Procedures

### 1. Quick Health Check

```bash
# Run the health check script
npm run check-backend

# Expected output:
# ✅ Backend is running on port 8080
# ✅ Public endpoints accessible
# ✅ Protected endpoints secured
# ✅ Admin API key authentication working
```

### 2. Manual Testing

#### Test Public Endpoints (No Auth Required)
```bash
# Should return 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/models
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/models/providers
```

#### Test Protected Endpoints (Auth Required)
```bash
# Without auth - should return 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/subscriptions

# With admin key - should return 200
curl -s -H "Authorization: Bearer ltm_admin_dev123456789" \
     -o /dev/null -w "%{http_code}" http://localhost:8080/api/subscriptions

# With frontend bypass (dev mode) - should return 200
curl -s -H "Origin: http://localhost:3000" \
     -H "User-Agent: Mozilla/5.0" \
     -o /dev/null -w "%{http_code}" http://localhost:8080/api/subscriptions
```

### 3. Frontend Integration Testing

1. Start both backend and frontend:
   ```bash
   npm run dev
   ```

2. Navigate to protected pages:
   - http://localhost:3000/subscriptions
   - http://localhost:3000/api-keys
   - http://localhost:3000/usage

3. Verify no authentication errors in console

## Common Issues and Troubleshooting

### Issue: "Cannot connect to backend"

**Symptoms**: Frontend shows connection errors on protected pages

**Solutions**:
1. Verify backend is running:
   ```bash
   npm run check-backend
   ```

2. Check port availability:
   ```bash
   lsof -i :8080
   ```

3. Restart services:
   ```bash
   # Kill existing processes
   pkill -f "tsx.*index.ts"
   
   # Start fresh
   npm run dev
   ```

### Issue: 401 Unauthorized Errors

**Symptoms**: API calls return 401 even with credentials

**Solutions**:
1. Verify authentication header format:
   ```bash
   # Correct
   Authorization: Bearer ltm_admin_dev123456789
   
   # Incorrect
   Authorization: ltm_admin_dev123456789
   Authorization: Bearer: ltm_admin_dev123456789
   ```

2. Check admin key in environment:
   ```bash
   grep ADMIN_API_KEYS backend/.env
   ```

3. For frontend bypass, ensure origin header:
   ```bash
   curl -H "Origin: http://localhost:3000" \
        -H "User-Agent: Mozilla/5.0" \
        http://localhost:8080/api/subscriptions
   ```

### Issue: OAuth Login Not Working

**Symptoms**: OAuth redirect fails or returns error

**Solutions**:
1. Verify OAuth environment variables are set
2. Check redirect URI matches OAuth provider configuration
3. Ensure callback URL is accessible
4. Review backend logs for OAuth errors

### Issue: Frontend Bypass Not Working

**Symptoms**: Frontend gets 401 errors in development

**Solutions**:
1. Verify `NODE_ENV` is not set to "production"
2. Check `ALLOWED_FRONTEND_ORIGINS` includes your port
3. Clear browser cache and cookies
4. Ensure Vite proxy is configured correctly

## Security Best Practices

### 1. API Key Management
- **Never commit API keys** to version control
- **Rotate keys regularly** (monthly in production)
- **Use strong keys**: At least 32 characters, randomly generated
- **Limit scope**: Create separate keys for different systems
- **Monitor usage**: Track API key usage patterns

### 2. Production Security
- **Disable development bypass**: Remove `ALLOWED_FRONTEND_ORIGINS`
- **Use HTTPS everywhere**: Enforce TLS for all connections
- **Implement rate limiting**: Prevent brute force attacks
- **Enable audit logging**: Track all authentication events
- **Set secure headers**: Use Helmet.js defaults

### 3. Token Security
- **Short expiration**: JWT tokens should expire within 24 hours
- **Refresh tokens**: Implement refresh token rotation
- **Secure storage**: Never store tokens in localStorage in production
- **CSRF protection**: Implement CSRF tokens for state-changing operations

### 4. OAuth Security
- **Validate redirect URIs**: Prevent open redirect vulnerabilities
- **Use PKCE**: Implement Proof Key for Code Exchange
- **Validate state parameter**: Prevent CSRF in OAuth flow
- **Secure client secret**: Never expose OAuth client secret

## API Endpoint Security

### Public Endpoints (No Authentication)
- `GET /api/models` - Browse available models
- `GET /api/models/:id` - Model details
- `GET /api/models/providers` - List providers
- `GET /api/models/capabilities` - List capabilities
- `GET /api/health` - Health check

### Protected Endpoints (Authentication Required)
- `GET /api/subscriptions` - User subscriptions
- `POST /api/subscriptions` - Create subscription
- `GET /api/api-keys` - List API keys
- `POST /api/api-keys` - Generate API key
- `DELETE /api/api-keys/:id` - Revoke API key
- `GET /api/usage/*` - Usage metrics
- `GET /api/teams/*` - Team management
- `POST /api/models/sync` - Admin only

### Authentication Flow

```mermaid
graph TD
    A[Client Request] --> B{Has Auth Header?}
    B -->|Yes| C{Valid JWT?}
    B -->|No| D{Dev Mode?}
    C -->|Yes| E[Authorized]
    C -->|No| F{Valid API Key?}
    F -->|Yes| E
    F -->|No| G[401 Unauthorized]
    D -->|Yes| H{From Localhost?}
    D -->|No| G
    H -->|Yes| E
    H -->|No| G
```

## Migration to Production

### 1. Pre-Production Checklist
- [ ] Generate strong production API keys
- [ ] Configure OAuth with production URLs
- [ ] Disable development bypass
- [ ] Enable HTTPS/TLS
- [ ] Configure rate limiting
- [ ] Set up monitoring/alerting
- [ ] Review security headers
- [ ] Enable audit logging

### 2. Configuration Changes
```bash
# Production .env
NODE_ENV=production
ALLOW_DEV_TOKENS=false
# Remove ALLOWED_FRONTEND_ORIGINS
JWT_SECRET=<strong-production-secret>
ADMIN_API_KEYS=<strong-production-keys>
```

### 3. Testing Production Auth
1. Verify all development bypasses are disabled
2. Test OAuth flow with production URLs
3. Validate API key authentication
4. Confirm audit logging is working
5. Run security scan on endpoints

## Monitoring and Auditing

### 1. Authentication Events to Monitor
- Failed login attempts
- API key usage patterns
- Token expiration/refresh
- Unusual access patterns
- Rate limit violations

### 2. Audit Log Fields
- Timestamp
- User/API key identifier
- IP address
- Endpoint accessed
- Response status
- Request duration

### 3. Alerting Thresholds
- 5+ failed logins from same IP in 5 minutes
- API key used from multiple IPs simultaneously
- Spike in 401/403 responses
- Unusual endpoint access patterns

## Additional Resources

- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

---

**Last Updated**: 2025-01-26  
**Version**: 1.0.0  
**Status**: Production Ready
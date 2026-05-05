# LiteMaaS Authentication Guide

## Overview

LiteMaaS implements a multi-layered authentication system that supports different access methods based on use case and environment. The system is designed to be secure in production while remaining developer-friendly during local development.

**Updated**: 2026-03-09

- **OIDC Support**: Standard OpenID Connect authentication alongside OpenShift OAuth
- **Role-Based Access Control (RBAC)**: Three-tier role hierarchy with group mapping (OpenShift groups or OIDC claims)
- **Administrative Features**: Admin endpoints for user and system management
- OAuth endpoints reorganized: `/api/auth` for flow, `/api/v1/auth` for user operations
- Enhanced OAuth/OIDC integration with configurable providers

## Authentication Methods

### 1. JWT Tokens (Frontend Sessions)

- **Purpose**: User authentication for web interface
- **Usage**: Generated after OAuth2/OpenShift SSO or OIDC login
- **Format**: Standard JWT with user claims
- **Storage**: Frontend stores in memory/localStorage
- **Header**: `Authorization: Bearer <jwt_token>`

### 2. Admin API Keys

- **Purpose**: Administrative and external system access
- **Format**: `ltm_admin_<unique_identifier>`
- **Storage**: Environment variables (never in code)
- **Header**: `Authorization: Bearer ltm_admin_<key>`
- **Example**: `ltm_admin_dev123456789`

### 3. User API Keys (UPDATED - Session 2025-01-29)

- **Purpose**: Direct programmatic access to LiteLLM endpoints
- **Format**: `sk-litellm-<unique_identifier>` (Full LiteLLM compatible format)
- **Storage**: Actual LiteLLM key value stored in `lite_llm_key_value` column (not hashed)
- **Header**: `Authorization: Bearer sk-litellm-<key>`
- **Management**: Created/deleted through UI or API with secure retrieval endpoint
- **Key Features**:
  - ✅ Multi-model support per key
  - ✅ Rate limiting (TPM/RPM)
  - ✅ Budget limits per key
  - ✅ Secure retrieval with audit logging
  - ✅ Direct LiteLLM compatibility

### 4. Development Bypass

- **Purpose**: Frontend development without authentication setup
- **Availability**: Only when `NODE_ENV=development`
- **Mechanism**: Detects requests from allowed localhost origins
- **Security**: Logs all access, disabled in production

## Setup Instructions

### 1. Basic Configuration

```bash
# Backend environment variables (.env)

# Authentication Provider: 'openshift' (default) or 'oidc'
AUTH_PROVIDER=openshift
OPENSHIFT_API_URL=https://api.your-cluster.com:6443

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret-here
JWT_EXPIRES_IN=24h

# OAuth2 / OIDC
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_ISSUER=https://oauth-openshift.apps.your-cluster.com
OAUTH_CALLBACK_URL=http://localhost:8081/api/auth/callback

# OIDC-specific (only when AUTH_PROVIDER=oidc)
# OIDC_GROUPS_CLAIM=groups
# OIDC_SCOPES=openid profile email

# Admin API Keys (comma-separated, must start with "ltm_admin_")
ADMIN_API_KEYS=ltm_admin_dev123456789,ltm_admin_test987654321

# Admin Read-Only API Keys (comma-separated, must start with "ltm_readonly_")
ADMIN_READONLY_API_KEYS=ltm_readonly_dev123456789

# Development Settings
ALLOWED_FRONTEND_ORIGINS=localhost:3000,localhost:3001,127.0.0.1:3000
ALLOW_DEV_TOKENS=true

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### 2. Production Configuration

```bash
# Production environment variables

# Authentication Provider
AUTH_PROVIDER=openshift  # or 'oidc' for standard OIDC providers
OPENSHIFT_API_URL=https://api.your-cluster.com:6443

# Remove or comment out development settings
# ALLOWED_FRONTEND_ORIGINS=
# ALLOW_DEV_TOKENS=false

# Use strong, randomly generated keys
ADMIN_API_KEYS=ltm_admin_prod_<32-char-random-string>
ADMIN_READONLY_API_KEYS=ltm_readonly_prod_<32-char-random-string>

# Ensure proper OAuth/OIDC configuration
OAUTH_REDIRECT_URI=https://your-production-domain/api/auth/callback

# Strict CORS
CORS_ORIGIN=https://your-production-domain
```

### 3. Authentication Provider Setup

LiteMaaS supports two authentication providers, controlled by the `AUTH_PROVIDER` environment variable:

- **`openshift`** (default): Uses OpenShift-specific OAuth endpoints and the Kubernetes user API for user info and group membership.
- **`oidc`**: Uses standard OpenID Connect with auto-discovery (`.well-known/openid-configuration`). Works with Keycloak, Auth0, Okta, Azure AD, and any OIDC-compliant provider.

Both providers map group memberships to LiteMaaS roles using the same role mapping logic.

#### Option 1: Standard OIDC Provider (Keycloak, Auth0, Okta, Azure AD, etc.)

> **Keycloak users**: See the [Keycloak OIDC Setup Guide](keycloak-oidc-setup.md) for step-by-step instructions with screenshots-level detail.

1. Register LiteMaaS as a client in your OIDC provider:
   - **Client ID**: Choose a name (e.g., `litemaas`)
   - **Client Secret**: Generate a secure secret
   - **Redirect URI**: `https://your-domain.com/api/auth/callback`
   - **Grant Type**: Authorization Code
   - **Scopes**: `openid`, `profile`, `email` (and `groups` if your provider requires it)

2. Configure environment variables:

   ```bash
   AUTH_PROVIDER=oidc
   OAUTH_CLIENT_ID=litemaas
   OAUTH_CLIENT_SECRET=your-oidc-client-secret
   OAUTH_ISSUER=https://keycloak.example.com/realms/myrealm
   OAUTH_CALLBACK_URL=https://your-domain.com/api/auth/callback
   ```

3. (Optional) Configure group claim and scopes:

   ```bash
   # If your provider uses a different claim name for groups
   OIDC_GROUPS_CLAIM=groups  # Default. Keycloak uses 'groups', Auth0 may use custom claims

   # If your provider requires additional scopes for group information
   OIDC_SCOPES=openid profile email groups
   ```

4. Configure role mapping via groups. The same group-to-role mapping applies:

   | Group Name         | LiteMaaS Role(s)          |
   |--------------------|---------------------------|
   | `litemaas-admins`  | `admin`, `user`           |
   | `administrators`   | `admin`, `user`           |
   | `litemaas-readonly`| `admin-readonly`, `user`  |
   | `litemaas-users`   | `user`                    |
   | `developers`       | `user`                    |

   Create these groups in your OIDC provider and assign users accordingly.

5. When deploying with the Helm chart:

   ```yaml
   oauth:
     mode: external
     authProvider: oidc
     issuer: "https://keycloak.example.com/realms/myrealm"
     oidc:
       groupsClaim: groups
       scopes: "openid profile email groups"
   backend:
     auth:
       oauthClientId: "litemaas"
       oauthClientSecret: "your-oidc-client-secret"
   ```

#### Provider-Specific Notes

**Auth0**: Issuer URL format is `https://{domain}/`. Group claims require a custom Action to add groups to tokens. Use a namespaced claim like `https://litemaas/groups` and set `OIDC_GROUPS_CLAIM` accordingly.

**Okta**: Issuer URL format is `https://{domain}/oauth2/default`. The `groups` claim is available by default but must be added to the ID token in the Authorization Server claims settings.

**Azure AD (Microsoft Entra ID)**: Issuer URL format is `https://login.microsoftonline.com/{tenant-id}/v2.0`. Groups claim returns object IDs by default — configure "Emit groups as role claims" for human-readable names. May require `GroupMember.Read.All` API permission.

#### Option 2: OpenShift OAuth

There are two approaches for configuring OAuth on OpenShift:

#### Option A: ServiceAccount as OAuth Client (Recommended for Helm)

When deploying with the Helm chart, the default `oauth.mode: serviceaccount` uses the Kubernetes ServiceAccount as an OAuth client. This requires **no cluster-admin privileges** — only namespace-level permissions.

How it works:
- The ServiceAccount is annotated with `serviceaccounts.openshift.io/oauth-redirecturi.litemaas`
- The OAuth client ID is `system:serviceaccount:<namespace>:<sa-name>`
- The OAuth client secret is the ServiceAccount's API token (from a `kubernetes.io/service-account-token` Secret)
- The chart creates the token Secret and wires everything automatically

No manual `OAuthClient` CR creation is needed. See [Helm Deployment Guide](helm-deployment.md#openshift-with-serviceaccount-oauth-default) for configuration details.

#### Option B: OAuthClient Custom Resource (Traditional)

This approach requires cluster-admin privileges to create an `OAuthClient` CR:

1. Register application in OpenShift:

   ```yaml
   kind: OAuthClient
   apiVersion: oauth.openshift.io/v1
   metadata:
     name: litemaas
   secret: your-client-secret-here
   redirectURIs:
     - 'http://localhost:8081/api/auth/callback' # Development
     - 'https://your-domain/api/auth/callback' # Production
   grantMethod: prompt
   ```

   When using the Helm chart, set `oauth.mode: external` and provide the credentials via `backend.auth.oauthClientId`, `backend.auth.oauthClientSecret`, and `backend.auth.oauthIssuer`.

2. Configure environment variables with provided credentials:
   - `OAUTH_ISSUER`: OAuth server URL (e.g., `https://oauth-openshift.apps.cluster.com`)
   - `OAUTH_CLIENT_ID`: Client name from OAuthClient
   - `OAUTH_CLIENT_SECRET`: Secret from OAuthClient
   - `OAUTH_CALLBACK_URL`: Must match redirectURIs

3. **Role-Based Access Control Setup**:

   Create OpenShift groups for role assignment:

   ```bash
   # Create admin group
   oc adm groups new litemaas-admins
   oc adm groups add-users litemaas-admins admin@company.com

   # Create read-only admin group
   oc adm groups new litemaas-readonly
   oc adm groups add-users litemaas-readonly readonly-admin@company.com

   # Create users group (optional - users get this role by default)
   oc adm groups new litemaas-users
   oc adm groups add-users litemaas-users user@company.com
   ```

   **Role Mapping Configuration**:

   ```javascript
   // OpenShift group to LiteMaaS role mapping
   const GROUP_ROLE_MAPPING = {
     'litemaas-admins': 'admin', // Full system access
     'litemaas-readonly': 'adminReadonly', // Read-only admin access
     'litemaas-users': 'user', // Standard user access
   };
   ```

4. **Initial Admin Users** (Alternative to OpenShift Groups):

   If you don't have cluster-admin access to create OpenShift groups, you can bootstrap admin users via the `INITIAL_ADMIN_USERS` environment variable:

   ```bash
   # Backend environment variable
   INITIAL_ADMIN_USERS=admin@example.com,lead@example.com
   ```

   When deploying with the Helm chart, this is auto-detected from the deploying user on OpenShift, or can be set explicitly:

   ```yaml
   backend:
     auth:
       initialAdminUsers: "admin@example.com"
   ```

   Users listed in `INITIAL_ADMIN_USERS` are granted the `admin` role on login, in addition to any roles from OpenShift groups. This is additive and does not replace group-based role assignment.

5. Test OAuth flow:

   ```bash
   # Initiate login - returns auth URL
   curl -X POST http://localhost:8081/api/auth/login

   # Response:
   # {"authUrl":"https://oauth-openshift.apps.cluster.com/oauth/authorize?..."}
   ```

6. **Verify Role Assignment**:

   After login, check user roles:

   ```bash
   # Get user profile (requires JWT token from OAuth)
   curl -H "Authorization: Bearer <jwt-token>" \
        http://localhost:8081/api/v1/auth/me

   # Response should include roles array:
   # {
   #   "id": "user-123",
   #   "username": "admin@company.com",
   #   "roles": ["admin", "user"]  // Based on OpenShift groups
   # }
   ```

### Switching Authentication Providers

To switch from OpenShift OAuth to OIDC:
1. Set `AUTH_PROVIDER=oidc`
2. Update `OAUTH_ISSUER` to your OIDC provider's issuer URL
3. Configure `OIDC_GROUPS_CLAIM` if your provider uses a non-standard claim name
4. Add `OIDC_SCOPES` if additional scopes are needed

To switch from OIDC to OpenShift OAuth:
1. Set `AUTH_PROVIDER=openshift` (or remove — it's the default)
2. Set `OAUTH_ISSUER` to your OpenShift API URL
3. Remove OIDC-specific env vars (optional — they are ignored)

**Important notes:**
- Existing JWT tokens remain valid until expiry regardless of provider change
- The `oauth_provider` column in the database tracks which provider authenticated each user
- Group-to-role mapping works identically for both providers
- A backend restart is required after changing the authentication provider

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
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/models
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/models/providers
```

#### Test Protected Endpoints (Auth Required)

```bash
# Without auth - should return 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/subscriptions

# With admin key - should return 200
curl -s -H "Authorization: Bearer ltm_admin_dev123456789" \
     -o /dev/null -w "%{http_code}" http://localhost:8081/api/subscriptions

# With frontend bypass (dev mode) - should return 200
curl -s -H "Origin: http://localhost:3000" \
     -H "User-Agent: Mozilla/5.0" \
     -o /dev/null -w "%{http_code}" http://localhost:8081/api/subscriptions
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

### 4. API Key Security Testing (NEW - Session 2025-01-29)

#### Test API Key Creation and Retrieval

```bash
# Create a new API key via API (requires JWT token)
curl -X POST "http://localhost:8081/api/api-keys" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "modelIds": ["gpt-4"],
    "name": "Test Key"
  }'

# Expected response includes actual LiteLLM key
# {
#   "id": "key_123",
#   "key": "sk-litellm-abcdef123456...",
#   "keyPrefix": "sk-litellm",
#   "isLiteLLMKey": true
# }
```

#### Test Secure Key Retrieval Endpoint

```bash
# Retrieve full API key securely (rate limited)
curl -X POST "http://localhost:8081/api/api-keys/key_123/retrieve-key" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "key": "sk-litellm-abcdef123456...",
#   "keyType": "litellm",
#   "retrievedAt": "2025-01-29T10:00:00Z"
# }
```

#### Test Rate Limiting

```bash
# Test rate limiting (should fail after 5 requests/minute)
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST "http://localhost:8081/api/api-keys/key_123/retrieve-key" \
    -H "Authorization: Bearer <your-jwt-token>" \
    -H "Content-Type: application/json"
  echo ""
done

# Requests 1-5 should succeed
# Request 6 should return 429 Too Many Requests
```

#### Test LiteLLM Compatibility

```bash
# Test the retrieved key directly with LiteLLM endpoint
LITELLM_KEY="sk-litellm-abcdef123456..."  # Use key from above
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello, test!"}],
    "max_tokens": 50
  }'

# Should return successful chat completion
```

### 5. Role-Based Access Control Testing (NEW - 2025-08-19)

#### Test Standard User Access

```bash
# Login as standard user and get JWT token
USER_TOKEN="<jwt-token-from-standard-user-login>"

# Test user can access own resources - should return 200
curl -H "Authorization: Bearer $USER_TOKEN" \
     "http://localhost:8081/api/v1/subscriptions"

# Test user cannot access admin endpoints - should return 403
curl -H "Authorization: Bearer $USER_TOKEN" \
     "http://localhost:8081/api/v1/admin/users"

# Test user cannot access other users' resources - should return 403
curl -H "Authorization: Bearer $USER_TOKEN" \
     "http://localhost:8081/api/v1/subscriptions?userId=another-user-id"
```

#### Test Read-Only Admin Access

```bash
# Login as read-only admin and get JWT token
READONLY_ADMIN_TOKEN="<jwt-token-from-readonly-admin-login>"

# Test read-only admin can view all users - should return 200
curl -H "Authorization: Bearer $READONLY_ADMIN_TOKEN" \
     "http://localhost:8081/api/v1/admin/users"

# Test read-only admin can view system status - should return 200
curl -H "Authorization: Bearer $READONLY_ADMIN_TOKEN" \
     "http://localhost:8081/api/v1/admin/system/status"

# Test read-only admin cannot create users - should return 403
curl -X POST \
     -H "Authorization: Bearer $READONLY_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"username": "test@example.com", "email": "test@example.com"}' \
     "http://localhost:8081/api/v1/admin/users"

# Test read-only admin cannot modify system - should return 403
curl -X POST \
     -H "Authorization: Bearer $READONLY_ADMIN_TOKEN" \
     "http://localhost:8081/api/v1/admin/sync/models"
```

#### Test Full Admin Access

```bash
# Login as full admin and get JWT token
ADMIN_TOKEN="<jwt-token-from-admin-login>"

# Test admin can view all users - should return 200
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8081/api/v1/admin/users"

# Test admin can create users - should return 201
curl -X POST \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "username": "newuser@example.com",
       "email": "newuser@example.com",
       "fullName": "New Test User",
       "roles": ["user"]
     }' \
     "http://localhost:8081/api/v1/admin/users"

# Test admin can trigger system operations - should return 200
curl -X POST \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"forceSync": true}' \
     "http://localhost:8081/api/v1/admin/sync/models"

# Test admin can access any user's resources - should return 200
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:8081/api/v1/subscriptions?userId=any-user-id"
```

#### Test Multi-Role User Behavior

```bash
# Login as user with multiple roles (e.g., ["admin", "user"])
MULTI_ROLE_TOKEN="<jwt-token-from-multi-role-user>"

# Verify user has admin access (most powerful role wins)
curl -H "Authorization: Bearer $MULTI_ROLE_TOKEN" \
     "http://localhost:8081/api/v1/admin/users"

# Check that user profile shows multiple roles
curl -H "Authorization: Bearer $MULTI_ROLE_TOKEN" \
     "http://localhost:8081/api/v1/auth/me"

# Expected response:
# {
#   "id": "user-123",
#   "username": "admin@example.com",
#   "roles": ["admin", "user"]  // Multiple roles preserved
# }
```

#### Test Role Display in Frontend

```bash
# Start frontend and login with different user types
npm run dev

# Navigate to any protected page and check the sidebar
# - Standard user: Should show "User" role
# - Read-only admin: Should show "Administrator (Read-only)" role
# - Full admin: Should show "Administrator" role
# - Multi-role user: Should show most powerful role ("Administrator")
```

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
        http://localhost:8081/api/subscriptions
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
- **PKCE**: PKCE (Proof Key for Code Exchange) is implemented for OIDC providers using S256 challenge method. OpenShift OAuth does not use PKCE.
- **Validate state parameter**: Prevent CSRF in OAuth flow
- **Secure client secret**: Never expose OAuth client secret

## API Endpoint Security

### Public Endpoints (No Authentication)

- `GET /api/models` - Browse available models
- `GET /api/models/:id` - Model details
- `GET /api/models/providers` - List providers
- `GET /api/models/capabilities` - List capabilities
- `GET /api/health` - Health check

### Role-Based Access Control

LiteMaaS implements a three-tier role hierarchy:

```
admin > adminReadonly > user
```

#### Role Definitions and Permissions

- **`admin`**: Full system access including user management, system operations, and all data
- **`adminReadonly`**: Read access to all system data, but cannot modify anything
- **`user`**: Standard access to own resources only

### Protected Endpoints (Authentication Required)

#### OAuth Flow Endpoints (Unversioned at `/api/auth`)

**Role Requirement**: None (public during OAuth flow)

- `POST /api/auth/login` - Initiate OAuth flow
- `GET /api/auth/callback` - OAuth callback
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/validate` - Validate JWT token

#### User Profile Endpoints (Versioned at `/api/v1/auth`)

**Role Requirement**: Any authenticated user

- `GET /api/v1/auth/me` - Get current user (simple format)
- `GET /api/v1/auth/profile` - Get detailed user profile

#### User Resource Endpoints (Versioned at `/api/v1`)

**Role Requirement**: Any authenticated user (access to own resources only)
**Admin Access**: Admins can access all users' resources

- `GET /api/v1/subscriptions` - User subscriptions
- `POST /api/v1/subscriptions` - Create subscription
- `GET /api/v1/api-keys` - List API keys
- `POST /api/v1/api-keys` - Generate API key
- `DELETE /api/v1/api-keys/:id` - Delete API key
- `GET /api/v1/usage/*` - Usage metrics
- `GET /api/v1/teams/*` - Team management

#### Admin Endpoints (Versioned at `/api/v1/admin`)

**Role Requirement**: `admin` or `adminReadonly` (read operations)
**Write Operations**: `admin` role only

- `GET /api/v1/admin/users` - List all users (`admin` + `adminReadonly`)
- `POST /api/v1/admin/users` - Create user (`admin` only)
- `PUT /api/v1/admin/users/:id` - Update user (`admin` only)
- `DELETE /api/v1/admin/users/:id` - Deactivate user (`admin` only)
- `GET /api/v1/admin/system/status` - System status (`admin` + `adminReadonly`)
- `POST /api/v1/admin/sync/models` - Sync models (`admin` only)
- `GET /api/v1/integration/health` - Integration health (`admin` + `adminReadonly`)
- `POST /api/v1/integration/sync` - Global sync (`admin` only)
- `GET /api/v1/metrics` - Prometheus metrics (`admin` + `adminReadonly`)

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
- [ ] **Set up OpenShift role groups** (litemaas-admins, litemaas-readonly, litemaas-users)
- [ ] **Assign initial administrator users** to litemaas-admins group
- [ ] **Test role-based access control** with different user types
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
ADMIN_API_KEYS=ltm_admin_<strong-random-string>
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
- **Role escalation attempts** (users accessing admin endpoints)
- **Admin action auditing** (user management, system changes)
- **Cross-user resource access** (users accessing other users' data)

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
- **403 Forbidden responses** from admin endpoints (potential privilege escalation)
- **Multiple admin actions** from same user in short timeframe
- **Role changes** in OpenShift groups affecting LiteMaaS users

## Troubleshooting

### SSL Certificate Errors During Login

**Problem**: SSL certificate verification errors when fetching user information from Kubernetes API during OAuth authentication.

**Symptoms**:

- Login fails with SSL/TLS certificate errors
- Backend logs show errors like "unable to verify the first certificate" or "self-signed certificate"
- Error occurs after OAuth provider redirects back to the application
- Ingress/Routes work fine with valid certificates, but K8s API endpoint doesn't

**Root Cause**: In many OpenShift/Kubernetes environments, the API server endpoint (`https://api.<cluster>:6443`) may not have proper SSL certificates configured, even though Ingress routes and load balancers do have valid certificates.

**Solution**: Use the `K8S_API_SKIP_TLS_VERIFY` environment variable to disable SSL verification for Kubernetes API calls.

⚠️ **Important Security Considerations**:

- Only use this workaround in **development/testing** environments or **trusted internal networks**
- This setting only affects the Kubernetes API user info endpoint, not OAuth token exchange
- The backend will log a warning message when this setting is enabled
- In production, properly configure SSL certificates for the Kubernetes API server instead

**Configuration**:

```bash
# Add to backend .env file
K8S_API_SKIP_TLS_VERIFY=true
```

**Verification**:

1. Check backend logs for the warning message confirming TLS verification is skipped
2. Attempt login through OAuth flow
3. Verify successful authentication and user creation

**Alternative Solutions** (Recommended for Production):

1. Configure proper SSL certificates for the Kubernetes API server
2. Add the cluster's CA certificate to the trusted certificate store
3. Use a corporate certificate authority for all cluster endpoints
4. Implement certificate management tools like cert-manager

For more details, see [Configuration Guide - Kubernetes API TLS Verification](configuration.md#kubernetes-api-tls-verification).

### Failed to Fetch OIDC Discovery Document

**Symptoms**: Backend fails to start or login fails with discovery-related errors.

**Solutions**:

1. Verify `OAUTH_ISSUER` URL is correct and reachable from the backend
2. Test with `curl <OAUTH_ISSUER>/.well-known/openid-configuration`
3. Check egress firewall rules between the backend pod and the OIDC provider
4. Ensure the URL includes the full realm path (e.g., `https://keycloak.example.com/realms/myrealm`)

### Groups Not Appearing in User Roles

**Symptoms**: Users authenticate successfully but are not assigned expected roles.

**Solutions**:

1. Verify `OIDC_GROUPS_CLAIM` matches your provider's claim name
2. Some providers require the `groups` scope — add it to `OIDC_SCOPES`
3. Check that a group membership mapper is configured in your identity provider

### Discovery Endpoint Caching

The OIDC discovery document is cached for 24 hours. If your OIDC provider changes its endpoints, restart the backend to refresh the cache.

### Clock Skew / Token Validation Issues

**Symptoms**: JWT validation fails intermittently or immediately after login.

**Solutions**:

1. Ensure clock synchronization (NTP) between the backend pod and OIDC provider
2. JWT validation can fail with even small clock differences

## Additional Resources

- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

---

**Last Updated**: 2026-03-09
**Version**: 2.0.0
**Status**: Production Ready

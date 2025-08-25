# OpenShift OAuth Integration

**Updated**: 2025-01-30

- Fixed OAuth callback to use correct OpenShift API endpoints
- Added proper user info retrieval from OpenShift API server
- Implemented Default Team assignment for all users
- Enhanced error handling and logging

## Overview

OpenShift provides OAuth 2.0 authentication through its built-in OAuth server. This document outlines the integration approach for LiteMaaS.

## OpenShift OAuth Flow

### 1. Authorization Code Flow

```text
User → Frontend → OAuth Authorize → OpenShift → Callback → Backend → JWT → Frontend
```

### 2. Key Endpoints

- **OAuth Server**: `https://oauth-openshift.apps.your-cluster.example.com`
  - Authorization: `/oauth/authorize`
  - Token: `/oauth/token`
- **API Server**: `https://api.your-cluster.example.com:6443`
  - User Info: `/apis/user.openshift.io/v1/users/~`

### 3. Required Parameters

- `client_id`: OAuth application client ID
- `client_secret`: OAuth application client secret
- `redirect_uri`: Callback URL for our application
- `scope`: Requested permissions (user:info, user:check-access)

## Implementation Strategy

### Development Environment

- **Mock OAuth Provider**: Simulate OpenShift OAuth for development
- **Mock Users**: Predefined test users with different roles
- **JWT Tokens**: Generate valid tokens for testing

### Production Environment

- **Real OAuth Integration**: Connect to actual OpenShift cluster
- **User Synchronization**: Sync OpenShift users to local database
- **Role Mapping**: Map OpenShift groups to application roles

## Security Considerations

### Token Management

- Short-lived JWT access tokens (15-30 minutes)
- Refresh tokens for token renewal
- Secure token storage (httpOnly cookies)
- Token rotation on refresh

### PKCE (Proof Key for Code Exchange)

- Generate code verifier and challenge
- Protect against authorization code interception
- Required for public clients (SPAs)

### State Parameter

- Prevent CSRF attacks
- Unique state per authorization request
- Verify state on callback

## Configuration

### Environment Variables

```bash
# OAuth Configuration
OAUTH_CLIENT_ID=litemaas
OAUTH_CLIENT_SECRET=your-secret-here
OAUTH_ISSUER=https://oauth-openshift.apps.your-cluster.com
OAUTH_CALLBACK_URL=http://localhost:8081/api/auth/callback

# Development Mock
OAUTH_MOCK_ENABLED=true  # Set to false for production
```

### OAuth Client Registration

```yaml
apiVersion: oauth.openshift.io/v1
kind: OAuthClient
metadata:
  name: litemaas
secret: your-secret-here
redirectURIs:
  - http://localhost:8081/api/auth/callback # Development
  - https://litemaas.apps.your-cluster.com/api/auth/callback # Production
grantMethod: prompt # or 'auto' for automatic approval
```

## User Information Structure

### OpenShift User Response

```json
{
  "metadata": {
    "name": "user@example.com",
    "uid": "12345-abcde-67890"
  },
  "fullName": "John Doe",
  "identities": ["ldap:user@example.com"],
  "groups": ["developers", "litemaas-users"]
}
```

### Application User Mapping

```typescript
interface OAuthUser {
  id: string; // metadata.uid
  username: string; // metadata.name
  email: string; // metadata.name (if email format)
  fullName?: string; // fullName
  groups: string[]; // groups array
  provider: 'openshift';
}
```

## Error Handling

### OAuth Errors

- `invalid_request`: Missing or invalid parameters
- `unauthorized_client`: Client not authorized
- `access_denied`: User denied authorization
- `unsupported_response_type`: Invalid response type
- `invalid_scope`: Invalid scope requested
- `server_error`: OAuth server error
- `temporarily_unavailable`: Service temporarily unavailable

### Application Error Mapping

```typescript
const oauthErrorMap = {
  access_denied: 'User denied authorization',
  invalid_request: 'Invalid OAuth request',
  server_error: 'Authentication service unavailable',
  temporarily_unavailable: 'Authentication service temporarily unavailable',
};
```

## Testing Strategy

### Unit Tests

- OAuth flow simulation
- Token generation and validation
- Error handling scenarios
- Role mapping logic

### Integration Tests

- Full OAuth flow with mock provider
- User synchronization
- Session management
- API authentication

### End-to-End Tests

- Browser-based OAuth flow
- Multi-user scenarios
- Permission testing
- Session persistence

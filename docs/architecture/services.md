# Service Layer Architecture

## Overview

The LiteMaaS backend service layer implements the business logic and core functionality of the application. Services are designed following the single responsibility principle, with clear separation of concerns between authentication, model management, subscription handling, and external integrations.

## Core Services

### ApiKeyService
**Purpose**: API key lifecycle management with LiteLLM integration

**Responsibilities**:
- Generate secure API keys for programmatic access
- Validate API key authenticity and permissions
- Manage API key rotation and expiration
- Integrate with LiteLLM for key synchronization
- Track API key usage and enforce budget limits

**Dependencies**:
- Database connection for key storage
- LiteLLMService for external synchronization
- TokenService for key generation
- UsageStatsService for tracking

**Key Operations**:
- `createApiKey()` - Generate new API key with budget constraints
- `validateApiKey()` - Verify key validity and permissions
- `rotateApiKey()` - Rotate existing key for security
- `revokeApiKey()` - Disable key and prevent further usage
- `syncWithLiteLLM()` - Synchronize key data with LiteLLM

---

### LiteLLMService
**Purpose**: Core integration with LiteLLM instances

**Responsibilities**:
- Establish and maintain connection to LiteLLM API
- Fetch model information from `/model/info` endpoint
- Handle API authentication with LiteLLM
- Implement circuit breaker for resilient communication
- Provide fallback to mock data in development mode

**Dependencies**:
- HTTP client for API communication
- Configuration service for API credentials
- Circuit breaker implementation

**Key Operations**:
- `getModels()` - Fetch available models from LiteLLM
- `getModelInfo()` - Get detailed information for specific model
- `testConnection()` - Verify LiteLLM connectivity
- `executeWithFallback()` - Execute API calls with fallback strategy

---

### ModelSyncService
**Purpose**: Automated model synchronization between LiteLLM and database

**Responsibilities**:
- Synchronize model catalog from LiteLLM to local database
- Update model metadata (pricing, capabilities, limits)
- Mark unavailable models while preserving subscriptions
- Handle incremental updates for efficiency
- Generate synchronization reports

**Dependencies**:
- LiteLLMService for model data source
- Database connection for persistence
- LiteLLMIntegrationService for orchestration

**Key Operations**:
- `syncModels()` - Full model synchronization
- `updateModelMetadata()` - Update specific model information
- `markUnavailableModels()` - Handle removed models
- `validateModelIntegrity()` - Check data consistency
- `generateSyncReport()` - Create synchronization statistics

---

### LiteLLMIntegrationService
**Purpose**: Centralized synchronization and orchestration

**Responsibilities**:
- Coordinate synchronization across multiple services
- Manage synchronization scheduling and automation
- Handle conflict resolution strategies
- Monitor integration health
- Provide admin API for manual sync operations

**Dependencies**:
- ModelSyncService for model operations
- SubscriptionService for subscription sync
- ApiKeyService for key synchronization
- Audit logging for tracking

**Key Operations**:
- `performFullSync()` - Execute complete system synchronization
- `scheduleAutoSync()` - Set up automatic sync intervals
- `resolveConflicts()` - Handle data conflicts between systems
- `getIntegrationHealth()` - Monitor sync status and health
- `generateAuditLog()` - Create detailed sync audit trail

---

### TeamService
**Purpose**: Team management with budget tracking

**Responsibilities**:
- Create and manage teams
- Handle team membership and roles
- Track team-level budgets and spending
- Enforce team quotas and limits
- Integrate with LiteLLM for team synchronization

**Dependencies**:
- Database for team persistence
- RBACService for permission management
- UsageStatsService for budget tracking
- LiteLLMService for external sync

**Key Operations**:
- `createTeam()` - Initialize new team with budget
- `addTeamMember()` - Add users to team
- `updateTeamBudget()` - Modify budget limits
- `getTeamUsage()` - Track team spending
- `enforceTeamLimits()` - Apply budget constraints

---

### OAuthService
**Purpose**: OAuth2 authentication flows

**Responsibilities**:
- Handle OAuth2 authorization with OpenShift
- Manage OAuth state and PKCE flow
- Exchange authorization codes for tokens
- Handle token refresh and expiration
- Integrate with user profile retrieval

**Dependencies**:
- OAuth2 provider configuration
- SessionService for state management
- TokenService for JWT generation
- HTTP client for OAuth requests

**Key Operations**:
- `initiateOAuthFlow()` - Start OAuth authorization
- `handleCallback()` - Process OAuth callback
- `exchangeCodeForToken()` - Get access token
- `refreshAccessToken()` - Refresh expired tokens
- `getUserProfile()` - Fetch user information

---

### RBACService
**Purpose**: Permission and role management

**Responsibilities**:
- Define and enforce role-based permissions
- Check user authorization for resources
- Manage role assignments
- Handle permission inheritance
- Audit permission changes

**Dependencies**:
- Database for role storage
- User context from authentication
- Audit logging service

**Key Operations**:
- `checkPermission()` - Verify user has required permission
- `assignRole()` - Grant role to user
- `getRolePermissions()` - List permissions for role
- `enforceAccess()` - Apply access control
- `auditPermissionChange()` - Log permission modifications

---

### SessionService
**Purpose**: Session state management

**Responsibilities**:
- Manage OAuth session state
- Store temporary authentication data
- Handle session expiration
- Prevent CSRF attacks
- Clean up expired sessions

**Dependencies**:
- In-memory or Redis storage
- Cryptographic utilities
- Configuration for session timeout

**Key Operations**:
- `createSession()` - Initialize new session
- `getSessionData()` - Retrieve session information
- `validateSession()` - Check session validity
- `destroySession()` - Clean up session data
- `cleanupExpiredSessions()` - Maintenance task

---

### SubscriptionService
**Purpose**: Model subscription logic with LiteLLM sync

**Responsibilities**:
- Create and manage user subscriptions
- Enforce subscription quotas (requests/tokens)
- Track subscription usage and costs
- Handle subscription lifecycle (pending/active/cancelled)
- Synchronize subscriptions with LiteLLM

**Dependencies**:
- Database for subscription storage
- ModelSyncService for model availability
- UsageStatsService for tracking
- LiteLLMService for external sync

**Key Operations**:
- `createSubscription()` - Initialize new subscription
- `activateSubscription()` - Enable subscription usage
- `updateQuotas()` - Modify subscription limits
- `checkQuotaUsage()` - Verify remaining quota
- `cancelSubscription()` - Terminate subscription
- `syncWithLiteLLM()` - Update LiteLLM configuration

---

### TokenService
**Purpose**: JWT token management

**Responsibilities**:
- Generate JWT access tokens
- Validate token signatures and claims
- Handle token expiration
- Manage token refresh flow
- Implement token revocation

**Dependencies**:
- JWT library for token operations
- Cryptographic keys for signing
- Configuration for token lifetime

**Key Operations**:
- `generateAccessToken()` - Create new JWT
- `validateToken()` - Verify token validity
- `refreshToken()` - Issue new token
- `extractClaims()` - Get token payload
- `revokeToken()` - Invalidate token

---

### UsageStatsService
**Purpose**: Usage analytics and reporting

**Responsibilities**:
- Track API usage per user/team/model
- Calculate token consumption and costs
- Generate usage reports and analytics
- Monitor budget utilization
- Provide real-time usage metrics

**Dependencies**:
- Database for usage storage
- Model pricing information
- Real-time aggregation engine

**Key Operations**:
- `recordUsage()` - Log API usage event
- `calculateCosts()` - Compute usage costs
- `generateReport()` - Create usage analytics
- `getRealtimeMetrics()` - Fetch current usage
- `alertOnThreshold()` - Trigger budget alerts

## Service Interaction Patterns

### Authentication Flow
1. OAuthService initiates OAuth flow
2. SessionService manages OAuth state
3. OAuthService exchanges code for token
4. TokenService generates JWT
5. RBACService assigns user permissions

### Subscription Creation
1. SubscriptionService validates model availability
2. ModelSyncService ensures model data is current
3. SubscriptionService creates subscription record
4. LiteLLMIntegrationService syncs with external system
5. UsageStatsService initializes tracking

### API Key Usage
1. ApiKeyService validates incoming key
2. RBACService checks permissions
3. UsageStatsService tracks request
4. SubscriptionService verifies quotas
5. TeamService enforces team limits

### Model Synchronization
1. LiteLLMIntegrationService triggers sync
2. LiteLLMService fetches model data
3. ModelSyncService updates database
4. SubscriptionService handles unavailable models
5. Audit log records sync operation

## Error Handling

All services implement consistent error handling:
- Structured error responses with error codes
- Detailed logging for debugging
- Graceful degradation where possible
- Circuit breaker patterns for external calls
- Automatic retry with exponential backoff

## Performance Considerations

- Connection pooling for database operations
- Caching for frequently accessed data
- Batch operations where applicable
- Asynchronous processing for heavy tasks
- Rate limiting to prevent abuse

## Security Measures

- Input validation on all service methods
- Authorization checks before operations
- Audit logging for sensitive actions
- Encryption for sensitive data
- Rate limiting per user/team/API key
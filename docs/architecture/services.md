# Service Layer Architecture

**Last Updated**: 2025-08-04 - Updated with simplified user ID management and correct LiteLLM usage tracking

## Overview

The LiteMaaS backend service layer implements the business logic and core functionality of the application. Services are designed following the single responsibility principle, with clear separation of concerns between authentication, model management, subscription handling, and external integrations.

### Recent Updates

**2025-08-06**:

- ✅ **Major Refactoring**: Eliminated code duplication across services
- ✅ **BaseService Introduction**: Abstract base class for common service patterns
- ✅ **Utility Extraction**: Created LiteLLMSyncUtils and ValidationUtils
- ✅ **Code Reduction**: ~25% reduction in duplicate code

**2025-08-04**:

- ✅ **Simplified User ID Management**: Removed `lite_llm_user_id` column, using `user.id` directly
- ✅ **Fixed LiteLLM Usage Tracking**: Correctly uses internal tokens instead of API key values
- ✅ **Enhanced Token Resolution**: Multi-step process to match API keys and retrieve internal tokens

**2025-07-30**:

- ✅ **Comprehensive Default Team Implementation**: All services now consistently implement default team assignment
- ✅ **User Existence Detection Fix**: Team-based validation instead of unreliable HTTP status codes
- ✅ **Model Access Control Fix**: Removed hardcoded model restrictions, enabled all-model access
- ✅ **Standardized Error Handling**: Consistent "already exists" error handling across all services

## Core Services

### BaseService ✅ **NEW 2025-08-06**

**Purpose**: Abstract base class eliminating duplicate code across services

**Responsibilities**:

- Provide common mock data handling pattern
- Implement database availability checking
- Standardize mock response creation
- Reduce code duplication across all services

**Key Methods**:

- `shouldUseMockData()` - Determine if mock data should be used
- `isDatabaseUnavailable()` - Check database connection status
- `createMockResponse<T>()` - Create delayed mock responses

**Extended By**:

- ApiKeyService, SubscriptionService, TeamService, UsageStatsService, LiteLLMService

---

### ApiKeyService ✅ **UPDATED 2025-08-06**

**Purpose**: API key lifecycle management with LiteLLM integration

**Extends**: BaseService

**Responsibilities**:

- Generate secure API keys for programmatic access
- Validate API key authenticity and permissions
- Manage API key rotation and expiration
- Integrate with LiteLLM for key synchronization
- Track API key usage and enforce budget limits
- ✅ **Default team assignment for all API key operations**
- ✅ **Fixed model access control** - removed hardcoded gpt-4o restriction

**Dependencies**:

- Database connection for key storage
- LiteLLMService for external synchronization
- TokenService for key generation
- UsageStatsService for tracking
- ✅ **DefaultTeamService** for team management
- ✅ **LiteLLMSyncUtils** for user/team synchronization

**Key Operations**:

- `createApiKey()` - Generate new API key with budget constraints
- `updateApiKey(keyId, userId, updates)` - Update key name, models, and metadata with LiteLLM sync
- `validateApiKey()` - Verify key validity and permissions
- `rotateApiKey()` - Rotate existing key for security
- `revokeApiKey()` - Disable key and prevent further usage
- `syncWithLiteLLM()` - Synchronize key data with LiteLLM
- `ensureUserExistsInLiteLLM()` - Check/create user with graceful "already exists" handling

**Default Team Integration**:

- ✅ **Fixed team creation**: Line 1869 changed from `models: ['gpt-4o']` to `models: []`
- ✅ **All-model access**: Empty models array enables access to all models instead of hardcoded restrictions

---

### LiteLLMService ✅ **UPDATED 2025-08-06**

**Purpose**: Core integration with LiteLLM instances

**Extends**: BaseService

**Responsibilities**:

- Establish and maintain connection to LiteLLM API
- Fetch model information from `/model/info` endpoint
- Handle API authentication with LiteLLM
- Implement circuit breaker for resilient communication
- Provide fallback to mock data in development mode
- ✅ **Team-based user existence detection** - fixed unreliable `/user/info` validation
- ✅ **Fixed mock responses** to use empty models arrays for all-model access
- ✅ **Token resolution for usage tracking** - matches API keys to internal tokens

**Dependencies**:

- HTTP client for API communication
- Configuration service for API credentials
- Circuit breaker implementation

**Key Operations**:

- `getModels()` - Fetch available models from LiteLLM
- `getModelInfo()` - Get detailed information for specific model
- `testConnection()` - Verify LiteLLM connectivity
- `executeWithFallback()` - Execute API calls with fallback strategy
- ✅ **`getUserInfo()` with team validation** - checks teams array for actual user existence
- ✅ **`getUserInfoFull()`** - returns complete user info with API keys array
- ✅ **`getApiKeyToken()`** - matches API key by last 4 chars and returns internal token
- ✅ **`getDailyActivity()`** - fetches usage data using internal token (not API key value)
- ✅ **`createTeam()` and `getTeamInfo()`** - fixed mock responses to return `models: []`

**User Existence Detection Fix**:

- ✅ **Before**: HTTP 200 always returned, causing false positives
- ✅ **After**: Empty teams array = user doesn't exist in LiteLLM
- ✅ **Implementation**: Lines 699 and 728 fixed in mock responses

**Usage Tracking Fix (2025-08-04)**:

- ✅ **Problem**: LiteLLM `/user/daily/activity` requires internal token, not API key value
- ✅ **Solution**: Multi-step token resolution process
- ✅ **Implementation**:
  1. Call `/user/info?user_id={userId}` to get all keys
  2. Match API key by last 4 characters
  3. Extract internal `token` field
  4. Use token for usage queries

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

### LiteLLMIntegrationService ✅ **UPDATED 2025-07-30**

**Purpose**: Centralized synchronization and orchestration

**Responsibilities**:

- Coordinate synchronization across multiple services
- Manage synchronization scheduling and automation
- Handle conflict resolution strategies
- Monitor integration health
- Provide admin API for manual sync operations
- ✅ **Bulk user synchronization with default team assignment**
- ✅ **Comprehensive default team integration in sync operations**

**Dependencies**:

- ModelSyncService for model operations
- SubscriptionService for subscription sync
- ApiKeyService for key synchronization
- Audit logging for tracking
- ✅ **DefaultTeamService** for team management

**Key Operations**:

- `performFullSync()` - Execute complete system synchronization
- `scheduleAutoSync()` - Set up automatic sync intervals
- `resolveConflicts()` - Handle data conflicts between systems
- `getIntegrationHealth()` - Monitor sync status and health
- `generateAuditLog()` - Create detailed sync audit trail
- ✅ **`syncUsers()` with default team support** - ensures team exists before bulk user sync

**Default Team Integration**:

- ✅ **Line 6**: Added DefaultTeamService import
- ✅ **Line 127, 165**: DefaultTeamService instance initialization
- ✅ **Line 497**: `await this.defaultTeamService.ensureDefaultTeamExists()` before user sync
- ✅ **Line 536**: User creation includes `teams: [DefaultTeamService.DEFAULT_TEAM_ID]`

---

### DefaultTeamService

**Purpose**: Default team management and user existence detection

**Responsibilities**:

- Ensure default team exists in database and LiteLLM
- Auto-assign users to default team during onboarding
- Provide fallback team for users without explicit team membership
- Solve LiteLLM user existence detection issue via teams array validation
- Support orphaned user migration to default team

**Dependencies**:

- Database connection for team and membership operations
- LiteLLMService for external team synchronization
- Logging service for comprehensive audit trail

**Key Operations**:

- `ensureDefaultTeamExists()` - Create default team in DB and LiteLLM if missing
- `assignUserToDefaultTeam()` - Add user to default team with proper role
- `getUserPrimaryTeam()` - Get user's team with fallback to default team
- `migrateOrphanedUsersToDefaultTeam()` - Migrate users without team membership
- `getDefaultTeamStats()` - Return team statistics and budget utilization

**Default Team Details**:

- **UUID**: `a0000000-0000-4000-8000-000000000001`
- **Name**: "Default Team"
- **Models**: Empty `allowed_models` array enables access to all models
- **Budget**: $10,000 monthly budget with usage tracking
- **Rate Limits**: 50K TPM, 1K RPM limits

---

### TeamService ✅ **UPDATED 2025-08-06**

**Purpose**: Team management with budget tracking

**Extends**: BaseService

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

### OAuthService ✅ **UPDATED 2025-07-30**

**Purpose**: OAuth2 authentication flows

**Responsibilities**:

- Handle OAuth2 authorization with OpenShift
- Manage OAuth state and PKCE flow
- Exchange authorization codes for tokens
- Handle token refresh and expiration
- Integrate with user profile retrieval
- ✅ **Default team assignment during OAuth login flow**
- ✅ **Ensures default team exists before user creation**

**Dependencies**:

- OAuth2 provider configuration
- SessionService for state management
- TokenService for JWT generation
- HTTP client for OAuth requests
- ✅ **DefaultTeamService** for team management

**Key Operations**:

- `initiateOAuthFlow()` - Start OAuth authorization
- `handleCallback()` - Process OAuth callback
- `exchangeCodeForToken()` - Get access token
- `refreshAccessToken()` - Refresh expired tokens
- `getUserProfile()` - Fetch user information
- ✅ **User creation with default team assignment** - all OAuth users assigned to default team

**Default Team Integration**:

- ✅ **Line 321**: `await this.defaultTeamService.ensureDefaultTeamExists()` before user creation
- ✅ **User creation**: Includes `teams: [DefaultTeamService.DEFAULT_TEAM_ID]` in LiteLLM user creation
- ✅ **Fixed first-login flow**: Default team created before user, preventing team-related errors

---

### RBACService ✅ **UPDATED 2025-08-19**

**Purpose**: Role-based access control and permission management

**Responsibilities**:

- Enforce three-tier role hierarchy: `admin > adminReadonly > user`
- Validate user permissions for API endpoints and resources
- Handle role-based filtering for data access
- Manage role assignments during OAuth flow
- Audit all permission and role changes
- Support multi-role users with hierarchical precedence

**Role Hierarchy Implementation**:

```typescript
// Role precedence (highest to lowest)
const ROLE_HIERARCHY = ['admin', 'adminReadonly', 'user'];

// Get most powerful role for user
getMostPowerfulRole(roles: string[]): string {
  for (const role of ROLE_HIERARCHY) {
    if (roles.includes(role)) return role;
  }
  return 'user'; // default fallback
}
```

**Dependencies**:

- Database for role storage in users.roles array
- User context from JWT authentication
- Audit logging service for role changes
- OAuth service for role assignment during login

**Key Operations**:

- `checkPermission(user, resource, action)` - Verify user can perform action
- `hasRole(user, role)` - Check if user has specific role
- `canAccessAdminFeatures(user)` - Check for admin/adminReadonly access
- `filterResourcesByRole(user, resources)` - Apply role-based data filtering
- `enforceApiAccess(user, endpoint)` - Validate API endpoint access
- `auditRoleChange(user, oldRoles, newRoles, changedBy)` - Log role modifications

**Role-Based Permissions**:

- **admin**: Full system access, user management, all CRUD operations
- **adminReadonly**: Read access to all data, no modifications allowed
- **user**: Access only to own resources, standard user operations

**Frontend Integration**:

- Provides role hierarchy logic used by `getMostPowerfulRole()` in Layout component
- Supports conditional UI rendering based on user roles
- Handles multi-role users by displaying most powerful role

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

- Cryptographic utilities
- Configuration for session timeout

**Key Operations**:

- `createSession()` - Initialize new session
- `getSessionData()` - Retrieve session information
- `validateSession()` - Check session validity
- `destroySession()` - Clean up session data
- `cleanupExpiredSessions()` - Maintenance task

---

### SubscriptionService ✅ **UPDATED 2025-08-06**

**Purpose**: Model subscription logic with LiteLLM sync

**Extends**: BaseService

**Responsibilities**:

- Create and manage user subscriptions
- Enforce subscription quotas (requests/tokens)
- Track subscription usage and costs
- Handle subscription lifecycle (pending/active/deletion)
- Synchronize subscriptions with LiteLLM
- ✅ **Default team assignment for all subscription users**
- ✅ **Team-based user existence detection and creation**

**Dependencies**:

- Database for subscription storage
- ModelSyncService for model availability
- UsageStatsService for tracking
- LiteLLMService for external sync
- ✅ **DefaultTeamService** for team management
- ✅ **LiteLLMSyncUtils** for user/team synchronization

**Key Operations**:

- `createSubscription()` - Initialize new subscription
- `activateSubscription()` - Enable subscription usage
- `updateQuotas()` - Modify subscription limits
- `checkQuotaUsage()` - Verify remaining quota
- `cancelSubscription()` - Permanently delete subscription
- `syncWithLiteLLM()` - Update LiteLLM configuration
- ✅ **`ensureTeamExistsInLiteLLM()`** - comprehensive team management (lines 1584-1706)
- ✅ **`ensureUserExistsInLiteLLM()`** - user creation with team assignment (lines 1748-1761)

**Default Team Integration**:

- ✅ **Added DefaultTeamService import and instance**
- ✅ **Team existence check**: Ensures default team exists before user operations
- ✅ **User creation**: Includes `teams: [DefaultTeamService.DEFAULT_TEAM_ID]` in all user creation
- ✅ **Fixed error handling**: Graceful handling of "already exists" errors in user creation

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

### UsageStatsService ✅ **UPDATED 2025-08-06**

**Purpose**: Usage analytics and reporting with LiteLLM integration

**Extends**: BaseService

**Responsibilities**:

- Track API usage per user/team/model
- Calculate token consumption and costs
- Generate usage reports and analytics
- Monitor budget utilization
- Provide real-time usage metrics
- ✅ **Integrate with LiteLLM for real-time usage data**
- ✅ **Handle token resolution for usage queries**

**Dependencies**:

- Database for usage storage
- Model pricing information
- Real-time aggregation engine
- ✅ **LiteLLMService for token resolution and usage data**

**Key Operations**:

- `recordUsage()` - Log API usage event
- `calculateCosts()` - Compute usage costs
- `generateReport()` - Create usage analytics
- `getRealtimeMetrics()` - Fetch current usage
- `alertOnThreshold()` - Trigger budget alerts
- ✅ **`getUsageFromLiteLLM()`** - Fetches usage with proper token resolution
- ✅ **`getUsageMetrics()`** - Main endpoint that tries LiteLLM first, falls back to DB

**Usage Tracking Implementation (2025-08-04)**:

- ✅ **SQL Query Fix**: Changed from `u.user_id` to `u.id` for LiteLLM user ID
- ✅ **Token Resolution**: Gets internal token before calling LiteLLM usage endpoint
- ✅ **Fallback Strategy**: Returns local database data if LiteLLM unavailable
- ✅ **Mock Data**: Provides realistic mock data in development mode

## Utility Classes ✅ **NEW 2025-08-06**

### LiteLLMSyncUtils

**Purpose**: Centralized LiteLLM synchronization utilities

**Location**: `/backend/src/utils/litellm-sync.utils.ts`

**Responsibilities**:

- Eliminate duplicate user/team synchronization code
- Provide consistent error handling for LiteLLM operations
- Centralize "already exists" error handling patterns
- Manage default team assignment logic

**Key Methods**:

- `ensureUserExistsInLiteLLM()` - Check/create user with graceful error handling
- `ensureTeamExistsInLiteLLM()` - Check/create team with proper model access
- `getUserPrimaryTeam()` - Get user's primary team with default fallback

**Used By**: ApiKeyService, SubscriptionService

---

### ValidationUtils

**Purpose**: Comprehensive input validation utilities

**Location**: `/backend/src/utils/validation.utils.ts`

**Responsibilities**:

- Centralize validation logic across services
- Provide type-safe validation methods
- Ensure consistent validation patterns
- Reduce code duplication

**Key Methods**:

- `isValidEmail()` - Email format validation
- `isValidUUID()` - UUID v4 validation
- `isValidModelId()` - Model identifier validation
- `validateBudget()` - Budget constraint validation
- `validateRateLimits()` - TPM/RPM limit validation
- `isValidTeamName()` - Team name validation
- `isValidApiKeyName()` - API key name validation
- `validateDateRange()` - Date range validation
- `isValidStatus()` - Status enum validation
- `sanitizeString()` - String sanitization for security
- `validateMetadata()` - Metadata object validation

**Used By**: All service classes for input validation

---

## Service Interaction Patterns

### Authentication Flow

1. OAuthService initiates OAuth flow
2. SessionService manages OAuth state
3. OAuthService exchanges code for token
4. **DefaultTeamService ensures user belongs to default team**
5. TokenService generates JWT
6. RBACService assigns user permissions

### Subscription Creation

1. SubscriptionService validates model availability
2. ModelSyncService ensures model data is current
3. SubscriptionService creates subscription record
4. LiteLLMIntegrationService syncs with external system
5. UsageStatsService initializes tracking

### Subscription Cancellation

1. SubscriptionService validates API key dependencies
2. ApiKeyService checks for active keys linked to subscription
3. If active keys exist, cancellation is rejected with error
4. If no active keys, SubscriptionService permanently deletes subscription
5. Database record is removed completely

### API Key Creation

1. **DefaultTeamService gets user's primary team (fallback to default)**
2. ApiKeyService validates user permissions
3. **DefaultTeamService ensures user exists in LiteLLM with team assignment**
4. ApiKeyService creates key with team context
5. LiteLLMIntegrationService syncs key to external system

### API Key Usage

1. ApiKeyService validates incoming key
2. RBACService checks permissions
3. UsageStatsService tracks request
4. SubscriptionService verifies quotas
5. TeamService enforces team limits

### User Existence Detection (LiteLLM Integration)

1. **LiteLLMService calls `/user/info` endpoint**
2. **Service checks teams array in response**
3. **Empty teams array = user doesn't exist**
4. **Non-empty teams array = user exists and is integrated**
5. **DefaultTeamService ensures all users have team membership**

### Model Synchronization

1. LiteLLMIntegrationService triggers sync
2. LiteLLMService fetches model data
3. ModelSyncService updates database
4. SubscriptionService handles unavailable models
5. Audit log records sync operation

### Usage Tracking Flow (Updated 2025-08-04)

1. **Frontend requests usage metrics with API key ID**
2. **UsageStatsService queries database for key metadata**
3. **Service retrieves user ID and LiteLLM key value**
4. **LiteLLMService.getUserInfoFull() fetches complete user info**
5. **Service matches API key by last 4 characters**
6. **Extracts internal token from matched key**
7. **LiteLLMService.getDailyActivity() uses token for usage query**
8. **Falls back to local database if LiteLLM unavailable**

## Error Handling

All services implement consistent error handling:

- Structured error responses with error codes
- Detailed logging for debugging
- Graceful degradation where possible
- Circuit breaker patterns for external calls
- Automatic retry with exponential backoff

### LiteLLM User Creation Pattern (Fixed 2025-07-30)

**Issue**: Inconsistent handling of "already exists" errors across services led to API key creation failures.

**Standardized Pattern**:

```typescript
// 1. Check existence first
const existingUser = await this.liteLLMService.getUserInfo(userId);
if (existingUser) {
  return; // User exists, we're done
}

// 2. Create user if needed
await this.liteLLMService.createUser(userRequest);

// 3. Handle "already exists" as success (safety net)
catch (error) {
  if (error.message?.includes('already exists')) {
    return; // Treat as success - user exists
  }
  throw error; // Re-throw other errors
}
```

**Applied to**: ApiKeyService, SubscriptionService, OAuthService

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

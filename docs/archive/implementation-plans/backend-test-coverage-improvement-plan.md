# Backend Test Coverage Improvement Plan

**Document Version:** 1.1
**Created:** 2025-10-09
**Last Updated:** 2025-10-09
**Baseline Coverage:** 56.36%
**Current Coverage:** 69.44% ⬆️ +13.08%
**Target Coverage:** 80%+
**Status:** Phase 3 Complete ✅

## Executive Summary

This document outlines a comprehensive plan to improve the backend test coverage from **56.36% to 80%+** through systematic testing of critical services, routes, plugins, and utilities. The plan is divided into 6 phases with clear priorities, estimated impact, and implementation guidelines.

## Current Coverage Analysis

### Overall Metrics (as of 2025-10-09)

```
Overall Coverage: 56.36%
├── Statements:  56.36%
├── Branch:      64.62%
├── Functions:   52.81%
└── Lines:       56.36%

Test Files: 18 passed, 1 skipped (19 total)
Tests:      449 passed, 46 skipped (495 total)
Duration:   48.24s
```

### Coverage Breakdown by Category

| Category       | Files | Avg Coverage | Status        |
| -------------- | ----- | ------------ | ------------- |
| **Services**   | 16    | 52.09%       | 🔴 Needs Work |
| **Routes**     | 13    | 57.23%       | 🔴 Needs Work |
| **Plugins**    | 10    | 48.04%       | 🔴 Needs Work |
| **Middleware** | 2     | 59.87%       | 🟡 Fair       |
| **Utils**      | 4     | 82.96%       | 🟢 Good       |
| **Schemas**    | 11    | 86.35%       | 🟢 Good       |

### Critical Gaps

#### Zero Coverage (0%) - CRITICAL

| File                    | Lines | Priority    | Impact                   |
| ----------------------- | ----- | ----------- | ------------------------ |
| `team.service.ts`       | 1,331 | 🔴 CRITICAL | Largest untested service |
| `subscription-hooks.ts` | 512   | 🔴 CRITICAL | Lifecycle hooks untested |
| `users.ts` (schema)     | 293   | 🟡 High     | Validation logic         |
| `database.ts` (config)  | 25    | 🟡 Medium   | Connection logic         |
| `oauth.ts` (config)     | 15    | 🟡 Medium   | OAuth config             |
| `index.ts` (entry)      | 29    | 🟢 Low      | Entry point              |

#### Very Low Coverage (<30%) - HIGH PRIORITY

| File                      | Coverage | Lines Uncovered | Priority    |
| ------------------------- | -------- | --------------- | ----------- |
| `api-key.service.ts`      | 21.09%   | ~1,450          | 🔴 CRITICAL |
| `admin.service.ts`        | 22.99%   | ~177            | 🔴 High     |
| `oauth.service.ts`        | 23.97%   | ~380            | 🔴 High     |
| `subscription.service.ts` | 25.06%   | ~250            | 🔴 High     |
| `token.service.ts`        | 28.44%   | ~144            | 🔴 High     |
| `admin.validator.ts`      | 28.83%   | ~270            | 🟡 Medium   |

#### Routes Needing Integration Tests

| Route            | Coverage | Skipped Tests | Priority    |
| ---------------- | -------- | ------------- | ----------- |
| `admin-usage.ts` | 41.49%   | 44 tests!     | 🔴 CRITICAL |
| `auth-user.ts`   | 42.05%   | 0             | 🟡 High     |
| `health.ts`      | 41.41%   | 0             | 🟡 High     |
| `users.ts`       | 44.23%   | 0             | 🟡 High     |
| `auth.ts`        | 50.24%   | 0             | 🟡 Medium   |
| `models.ts`      | 51.49%   | 0             | 🟡 Medium   |
| `usage.ts`       | 53.75%   | 0             | 🟡 Medium   |

### Well-Tested Areas (Reference Examples)

| File                           | Coverage | Tests | Use As Example For  |
| ------------------------------ | -------- | ----- | ------------------- |
| `errors.ts`                    | 100%     | 61    | Error handling      |
| `daily-usage-cache-manager.ts` | 99.08%   | 22    | Cache logic         |
| `error-helpers.ts`             | 95.6%    | 34    | Helper functions    |
| `admin-usage-stats.service.ts` | 87.92%   | 40    | Service testing     |
| `rbac.service.ts`              | 80.97%   | 41    | Authorization logic |
| `banner.service.ts`            | 80.09%   | 31    | CRUD operations     |

## Implementation Plan

### Phase 1: Enable Skipped Tests (Quick Win)

**Impact:** +8-10% coverage
**Effort:** Low (1-2 hours)
**Priority:** 🔴 CRITICAL

#### Tasks

1. **Enable admin-usage integration tests**
   - **File:** `tests/integration/admin-usage.test.ts`
   - **Issue:** 44 tests are skipped with `describe.skip`
   - **Action:** Remove `.skip` and verify all tests pass
   - **Expected Impact:** +8-10% coverage boost

   ```bash
   # Test command
   npm run test:integration admin-usage.test.ts
   ```

   **Note:** Tests were skipped because the service returned 501 (NOT_IMPLEMENTED). Verify implementation is complete before enabling.

#### Acceptance Criteria

- [ ] All 44 tests passing
- [ ] No failing assertions
- [ ] Coverage report shows admin-usage routes >70%

---

### Phase 2: Critical Services Unit Tests

**Impact:** +15-20% coverage
**Effort:** High (2-3 weeks)
**Priority:** 🔴 CRITICAL

#### 2.1 Create team.service.test.ts

**Priority:** 🔴 HIGHEST
**Estimated Tests:** 50-60
**Coverage Impact:** +5-7%

**Test Scope:**

```typescript
describe('TeamService', () => {
  describe('Team CRUD Operations', () => {
    // Create team
    it('should create a new team with valid data');
    it('should validate required fields when creating team');
    it('should prevent duplicate team names');
    it('should set default values for optional fields');

    // Read team
    it('should retrieve team by ID');
    it('should retrieve team with members');
    it('should handle non-existent team ID');
    it('should list teams with pagination');
    it('should filter teams by search criteria');

    // Update team
    it('should update team properties');
    it('should update team budget');
    it('should update allowed models');
    it('should prevent invalid budget values');

    // Delete team
    it('should delete team and cascade to members');
    it('should prevent deleting team with active subscriptions');
  });

  describe('LiteLLM Team Sync', () => {
    it('should sync team to LiteLLM on creation');
    it('should handle LiteLLM API errors gracefully');
    it('should retry sync on transient failures');
    it('should sync budget changes to LiteLLM');
    it('should sync member changes to LiteLLM');
  });

  describe('Team Budget Management', () => {
    it('should calculate current spend from usage data');
    it('should calculate budget utilization percentage');
    it('should calculate remaining budget');
    it('should handle unlimited budget (null max_budget)');
    it('should handle budget reset periods');
    it('should aggregate member spending');
  });

  describe('Team Member Assignment', () => {
    it('should add member to team');
    it('should remove member from team');
    it('should prevent duplicate member assignments');
    it('should retrieve all team members');
    it('should update member role in team');
  });

  describe('Team Usage Statistics', () => {
    it('should aggregate usage by period (day/week/month)');
    it('should calculate member usage breakdown');
    it('should calculate model usage breakdown');
    it('should calculate cost metrics');
    it('should handle teams with no usage data');
  });

  describe('Error Handling', () => {
    it('should throw NotFoundError for non-existent team');
    it('should throw ValidationError for invalid budget');
    it('should throw ConflictError for duplicate team name');
    it('should handle database connection errors');
  });
});
```

**Mocking Strategy:**

```typescript
// Mock LiteLLM service
vi.mock('../../../src/services/litellm.service.js');

// Mock database queries
const mockDb = {
  query: vi.fn(),
  transaction: vi.fn(),
};
```

**Files to Create:**

- `backend/tests/unit/services/team.service.test.ts`

---

#### 2.2 Create token.service.test.ts

**Priority:** 🔴 High
**Estimated Tests:** 20-25
**Coverage Impact:** +2-3%

**Test Scope:**

```typescript
describe('TokenService', () => {
  describe('JWT Token Generation', () => {
    it('should generate valid JWT token for user');
    it('should include user ID in token payload');
    it('should include roles in token payload');
    it('should set correct expiration time');
    it('should sign token with JWT secret');
  });

  describe('JWT Token Validation', () => {
    it('should validate authentic token');
    it('should reject expired token');
    it('should reject token with invalid signature');
    it('should reject malformed token');
    it('should extract user data from valid token');
  });

  describe('Token Refresh', () => {
    it('should generate new token from refresh token');
    it('should validate refresh token before issuing new token');
    it('should reject expired refresh token');
    it('should update token expiration on refresh');
  });

  describe('Role Encoding', () => {
    it('should encode single role in token');
    it('should encode multiple roles in token');
    it('should handle role hierarchy correctly');
  });

  describe('Error Handling', () => {
    it('should throw UnauthorizedError for invalid token');
    it('should throw UnauthorizedError for expired token');
    it('should handle missing JWT secret gracefully');
  });
});
```

**Files to Create:**

- `backend/tests/unit/services/token.service.test.ts`

---

#### 2.3 Create admin.service.test.ts

**Priority:** 🔴 High
**Estimated Tests:** 25-30
**Coverage Impact:** +2-3%

**Test Scope:**

```typescript
describe('AdminService', () => {
  describe('User Role Management', () => {
    it('should assign role to user');
    it('should remove role from user');
    it('should list users by role');
    it('should prevent invalid role assignment');
    it('should validate role hierarchy on assignment');
  });

  describe('Admin Operations', () => {
    it('should retrieve all users with admin view');
    it('should retrieve user details including roles');
    it('should update user properties');
    it('should deactivate user account');
    it('should reactivate user account');
  });

  describe('Audit Logging', () => {
    it('should log user creation by admin');
    it('should log role changes by admin');
    it('should log user deactivation by admin');
    it('should include admin user ID in audit log');
    it('should include timestamp in audit log');
  });

  describe('Bulk Operations', () => {
    it('should bulk assign role to multiple users');
    it('should bulk deactivate users');
    it('should handle partial failures in bulk operations');
    it('should return operation results summary');
  });

  describe('Error Handling', () => {
    it('should throw ForbiddenError for non-admin operations');
    it('should throw ValidationError for invalid role');
    it('should throw NotFoundError for non-existent user');
  });
});
```

**Files to Create:**

- `backend/tests/unit/services/admin.service.test.ts`

---

#### 2.4 Expand api-key.service tests

**Priority:** 🔴 High
**Estimated Additional Tests:** 30-35
**Coverage Impact:** +5-7%

**Current State:** Only integration tests exist (21.09% coverage)

**Test Scope (Unit Tests):**

```typescript
describe('ApiKeyService - Unit Tests', () => {
  describe('Key Generation', () => {
    it('should generate unique API key');
    it('should prefix key with "sk-litellm-"');
    it('should hash key before storage');
    it('should generate cryptographically secure keys');
  });

  describe('Key Validation', () => {
    it('should validate key format');
    it('should verify key exists in database');
    it('should verify key is not expired');
    it('should verify key is active');
    it('should load associated user and permissions');
  });

  describe('Multi-Model Budget', () => {
    it('should calculate total budget across models');
    it('should calculate budget per model');
    it('should validate budget limits on key creation');
    it('should update budget for specific model');
    it('should track budget utilization');
  });

  describe('Key Rotation', () => {
    it('should generate new key and revoke old key');
    it('should preserve key metadata on rotation');
    it('should maintain budget settings on rotation');
    it('should update LiteLLM with new key');
  });

  describe('Key Revocation', () => {
    it('should revoke key immediately');
    it('should remove key from LiteLLM');
    it('should maintain audit trail of revocation');
    it('should prevent re-activation of revoked key');
  });

  describe('Error Handling', () => {
    it('should throw ValidationError for invalid budget');
    it('should throw NotFoundError for non-existent key');
    it('should throw ForbiddenError for unauthorized access');
    it('should handle LiteLLM sync failures gracefully');
  });
});
```

**Files to Create:**

- `backend/tests/unit/services/api-key.service.test.ts`

---

#### 2.5 Expand subscription.service tests

**Priority:** 🟡 Medium
**Estimated Additional Tests:** 15-20
**Coverage Impact:** +2-3%

**Current Coverage:** 25.06% (20 existing tests)

**Additional Test Scope:**

```typescript
describe('SubscriptionService - Additional Tests', () => {
  describe('Budget Validation', () => {
    it('should validate budget exceeds minimum threshold');
    it('should validate budget format (cents vs dollars)');
    it('should handle unlimited budget (null)');
    it('should prevent negative budget values');
  });

  describe('Subscription Lifecycle Hooks', () => {
    it('should trigger pre-create hook before creation');
    it('should trigger post-create hook after creation');
    it('should trigger update hooks on modification');
    it('should trigger deletion hooks on removal');
    it('should rollback on hook failure');
  });

  describe('Multi-Model Subscriptions', () => {
    it('should create subscription with multiple models');
    it('should calculate per-model budget allocation');
    it('should validate total budget equals sum of model budgets');
    it('should handle model addition to existing subscription');
    it('should handle model removal from subscription');
  });

  describe('Edge Cases', () => {
    it('should handle concurrent subscription updates');
    it('should handle subscription to deprecated model');
    it('should handle zero-budget subscriptions');
    it('should prevent duplicate subscriptions');
  });
});
```

**Files to Modify:**

- `backend/tests/unit/services/subscription.service.test.ts`

---

#### 2.6 Expand oauth.service tests

**Priority:** 🟡 Medium
**Estimated Additional Tests:** 15-20
**Coverage Impact:** +2-3%

**Current Coverage:** 23.97% (15 existing tests)

**Additional Test Scope:**

```typescript
describe('OAuthService - Additional Tests', () => {
  describe('OAuth Flow Steps', () => {
    it('should generate authorization URL with state parameter');
    it('should validate state parameter on callback');
    it('should exchange code for access token');
    it('should retrieve user info from OAuth provider');
    it('should handle PKCE flow if supported');
  });

  describe('Token Exchange', () => {
    it('should validate authorization code');
    it('should exchange code for access and refresh tokens');
    it('should handle token exchange errors');
    it('should refresh access token using refresh token');
  });

  describe('Role Mapping', () => {
    it('should map OpenShift groups to roles');
    it('should handle multiple group memberships');
    it('should default to "user" role if no groups match');
    it('should respect role hierarchy in mapping');
  });

  describe('Error Handling', () => {
    it('should handle OAuth provider timeout');
    it('should handle invalid authorization code');
    it('should handle expired state parameter');
    it('should handle user denying authorization');
  });
});
```

**Files to Modify:**

- `backend/tests/unit/services/oauth.service.test.ts`

---

### Phase 3: Plugin & Middleware Coverage ✅ COMPLETE

**Impact:** +10-12% coverage (Achieved: +13.08%)
**Effort:** Medium (1-2 weeks)
**Priority:** 🔴 High
**Status:** ✅ Complete (2025-10-09)
**Actual Coverage Gain:** +13.08% (from 56.36% to 69.44%)

#### 3.1 Create subscription-hooks.test.ts ✅

**Priority:** 🔴 CRITICAL
**Estimated Tests:** 30-35 (Actual: 38)
**Coverage Impact:** +6-8% (Actual: subscription-hooks.ts = 91.99%)
**Status:** ✅ Complete - Refactored to use real Fastify app instance

**Test Scope:**

```typescript
describe('Subscription Hooks Plugin', () => {
  describe('Pre-Create Hooks', () => {
    it('should validate subscription before creation');
    it('should check budget limits before creation');
    it('should verify model availability before creation');
    it('should check user permissions before creation');
    it('should prevent creation if hooks fail');
  });

  describe('Post-Create Hooks', () => {
    it('should sync subscription to LiteLLM after creation');
    it('should create audit log entry after creation');
    it('should send notification after creation');
    it('should update usage cache after creation');
    it('should rollback on post-hook failure');
  });

  describe('Update Hooks', () => {
    it('should validate budget changes');
    it('should sync budget updates to LiteLLM');
    it('should log budget modifications');
    it('should handle model list changes');
  });

  describe('Deletion Hooks', () => {
    it('should remove subscription from LiteLLM');
    it('should revoke associated API keys');
    it('should archive usage data');
    it('should create deletion audit log');
  });

  describe('Hook Error Handling', () => {
    it('should rollback transaction on hook failure');
    it('should log hook errors');
    it('should preserve database consistency');
    it('should retry idempotent hooks on failure');
  });

  describe('LiteLLM Integration', () => {
    it('should create LiteLLM key on subscription creation');
    it('should update LiteLLM key on subscription update');
    it('should delete LiteLLM key on subscription deletion');
    it('should handle LiteLLM API errors gracefully');
  });
});
```

**Files Created:**

- ✅ `backend/tests/unit/plugins/subscription-hooks.test.ts` (38 tests)
- ✅ Plugin registered in `src/app.ts`
- ✅ Plugin exported in `src/plugins/index.ts`

**Key Implementation Details:**

- Tests use real Fastify app instance (not mocks) for accurate coverage
- Database operations mocked with `vi.spyOn(app.dbUtils, ...)`
- Test isolation achieved by recreating app for default hook tests
- Coverage: 91.99% statements, 93.44% branches, 100% functions

---

#### 3.2 Expand auth-hooks.test.ts ✅

**Priority:** 🟡 Medium
**Estimated Additional Tests:** 10-15 (Actual: 16 added)
**Coverage Impact:** +1-2%
**Status:** ✅ Complete

**Previous Coverage:** 54.97% (7 existing tests)
**Current Coverage:** 54.97% (23 total tests)

**Additional Test Scope:**

```typescript
describe('Auth Hooks - Additional Tests', () => {
  describe('Authentication Edge Cases', () => {
    it('should handle missing Authorization header');
    it('should handle malformed Bearer token');
    it('should handle empty token string');
    it('should handle token with extra whitespace');
  });

  describe('Token Validation Edge Cases', () => {
    it('should reject token from different issuer');
    it('should reject token with tampered signature');
    it('should handle token with missing claims');
    it('should handle token with invalid role format');
  });

  describe('Role-Based Access Edge Cases', () => {
    it('should handle user with no roles');
    it('should handle user with unknown role');
    it('should respect role hierarchy for mixed roles');
  });
});
```

**Files Modified:**

- ✅ `backend/tests/unit/middleware/auth-hooks.test.ts` (expanded from 7 to 23 tests)

**Added Test Coverage:**

- Authentication edge cases (missing header, malformed token, whitespace)
- Token validation edge cases (different issuer, tampered signature, missing claims)
- Role-based access edge cases (no roles, unknown role, role hierarchy)
- Rate limiting edge cases (zero attempts, retry-after header)

---

#### 3.3 Create error-handler.test.ts ✅

**Priority:** 🟡 Medium
**Estimated Tests:** 15-20 (Actual: 23)
**Coverage Impact:** +2-3%
**Status:** ✅ Complete

**Current Coverage:** 65.34% (23 tests created)

**Test Scope:**

```typescript
describe('Error Handler Middleware', () => {
  describe('Error Transformation', () => {
    it('should transform ApplicationError to HTTP response');
    it('should transform ValidationError to 400 response');
    it('should transform NotFoundError to 404 response');
    it('should transform ForbiddenError to 403 response');
    it('should transform UnauthorizedError to 401 response');
  });

  describe('Status Code Mapping', () => {
    it('should map database errors to 500');
    it('should map Fastify validation errors to 400');
    it('should preserve custom status codes');
    it('should default to 500 for unknown errors');
  });

  describe('Error Logging', () => {
    it('should log errors with stack trace');
    it('should include request context in logs');
    it('should log user ID if authenticated');
    it('should redact sensitive data from logs');
  });

  describe('Error Response Format', () => {
    it('should return standardized error JSON');
    it('should include error code in response');
    it('should include error message in response');
    it('should include validation details if applicable');
    it('should exclude stack traces in production');
  });
});
```

**Files Created:**

- ✅ `backend/tests/unit/middleware/error-handler.test.ts` (23 tests)

**Test Coverage:**

- ApplicationError handling (3 tests)
- Validation error handling (2 tests)
- Database error handling (3 tests - unique violations, foreign key, not-null)
- JWT error handling (2 tests)
- Rate limit error handling (2 tests)
- Status code mapping (3 tests)
- Error logging (3 tests)
- Not found handler (2 tests)
- Error response format (3 tests)

---

### Phase 4: Route Integration Tests

**Impact:** +8-12% coverage
**Effort:** Medium-High (2-3 weeks)
**Priority:** 🟡 High

#### 4.1 Create auth routes integration tests

**Priority:** 🔴 High
**Estimated Tests:** 20-25
**Coverage Impact:** +3-4%

**Test Scope:**

```typescript
describe('Auth Routes Integration', () => {
  describe('POST /api/auth/login', () => {
    it('should redirect to OAuth provider');
    it('should include state parameter in redirect');
    it('should include PKCE code challenge if supported');
    it('should handle missing OAuth configuration');
  });

  describe('GET /api/auth/callback', () => {
    it('should exchange code for token');
    it('should create user session');
    it('should redirect to frontend with session cookie');
    it('should validate state parameter');
    it('should handle invalid authorization code');
    it('should handle OAuth provider errors');
  });

  describe('POST /api/auth/logout', () => {
    it('should destroy user session');
    it('should clear session cookie');
    it('should return success response');
    it('should handle logout when not authenticated');
  });

  describe('GET /api/auth/refresh', () => {
    it('should refresh access token');
    it('should extend session expiration');
    it('should reject invalid refresh token');
    it('should reject expired refresh token');
  });
});
```

**Files to Create:**

- `backend/tests/integration/routes/auth.test.ts`

---

#### 4.2 Create users routes integration tests

**Priority:** 🟡 High
**Estimated Tests:** 25-30
**Coverage Impact:** +2-3%

**Test Scope:**

```typescript
describe('Users Routes Integration', () => {
  describe('GET /api/users', () => {
    it('should list users for admin');
    it('should return only own user for regular user');
    it('should support pagination');
    it('should support search filtering');
    it('should support role filtering');
  });

  describe('GET /api/users/:id', () => {
    it('should retrieve user by ID for admin');
    it('should retrieve own user for regular user');
    it('should forbid access to other users for non-admin');
    it('should return 404 for non-existent user');
  });

  describe('PUT /api/users/:id', () => {
    it('should update user properties for admin');
    it('should update own user for regular user');
    it('should forbid updating other users for non-admin');
    it('should validate update data');
    it('should prevent role self-elevation');
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user for admin');
    it('should forbid deletion for non-admin');
    it('should cascade delete user resources');
    it('should prevent self-deletion');
  });

  describe('RBAC Enforcement', () => {
    it('should require admin role for user list');
    it('should allow user to view own profile');
    it('should prevent user from viewing other profiles');
  });
});
```

**Files to Create:**

- `backend/tests/integration/routes/users.test.ts`

---

#### 4.3 Create models routes integration tests

**Priority:** 🟡 Medium
**Estimated Tests:** 15-20
**Coverage Impact:** +1-2%

**Test Scope:**

```typescript
describe('Models Routes Integration', () => {
  describe('GET /api/models', () => {
    it('should list all available models');
    it('should filter by provider');
    it('should filter by category');
    it('should support pagination');
    it('should return models with pricing info');
  });

  describe('GET /api/models/:id', () => {
    it('should retrieve model details');
    it('should include model capabilities');
    it('should include pricing information');
    it('should return 404 for non-existent model');
  });

  describe('Role-Based Visibility', () => {
    it('should show all models to admin');
    it('should show only allowed models to user');
    it('should respect team model restrictions');
  });
});
```

**Files to Create:**

- `backend/tests/integration/routes/models.test.ts`

---

#### 4.4 Create usage routes integration tests

**Priority:** 🟡 Medium
**Estimated Tests:** 20-25
**Coverage Impact:** +2-3%

**Test Scope:**

```typescript
describe('Usage Routes Integration', () => {
  describe('GET /api/usage/stats', () => {
    it('should retrieve usage stats for user');
    it('should filter by date range');
    it('should aggregate by period (day/week/month)');
    it('should return cost breakdown');
    it('should return model usage breakdown');
  });

  describe('GET /api/usage/history', () => {
    it('should retrieve usage history for user');
    it('should support pagination');
    it('should filter by model');
    it('should filter by date range');
    it('should include request details');
  });

  describe('RBAC Enforcement', () => {
    it('should allow user to view own usage');
    it('should forbid viewing other user usage');
    it('should allow admin to view all usage');
  });

  describe('Data Privacy', () => {
    it('should not expose other users data to regular user');
    it('should redact sensitive request data');
  });
});
```

**Files to Create:**

- `backend/tests/integration/routes/usage.test.ts`

---

#### 4.5 Create health routes integration tests

**Priority:** 🟢 Low
**Estimated Tests:** 10-12
**Coverage Impact:** +1%

**Test Scope:**

```typescript
describe('Health Routes Integration', () => {
  describe('GET /api/health', () => {
    it('should return 200 when all systems healthy');
    it('should return 503 when database unavailable');
    it('should return 503 when LiteLLM unavailable');
    it('should include component status details');
  });

  describe('GET /api/health/ready', () => {
    it('should return 200 when ready to serve requests');
    it('should check database connectivity');
    it('should check required services availability');
  });

  describe('GET /api/health/live', () => {
    it('should return 200 when application is running');
    it('should respond quickly (<100ms)');
  });
});
```

**Files to Create:**

- `backend/tests/integration/routes/health.test.ts`

---

#### 4.6 Create config routes integration tests

**Priority:** 🟢 Low
**Estimated Tests:** 8-10
**Coverage Impact:** +1%

**Test Scope:**

```typescript
describe('Config Routes Integration', () => {
  describe('GET /api/config', () => {
    it('should return public configuration');
    it('should not expose sensitive config values');
    it('should include OAuth provider info');
    it('should include feature flags');
  });

  describe('Configuration Privacy', () => {
    it('should not expose JWT_SECRET');
    it('should not expose DATABASE_URL');
    it('should not expose internal URLs');
  });
});
```

**Files to Create:**

- `backend/tests/integration/routes/config.test.ts`

---

#### 4.7 Create auth-user routes integration tests

**Priority:** 🟢 Low
**Estimated Tests:** 10-12
**Coverage Impact:** +1%

**Test Scope:**

```typescript
describe('Auth User Routes Integration', () => {
  describe('GET /api/auth/user', () => {
    it('should retrieve authenticated user profile');
    it('should include user roles');
    it('should include user teams');
    it('should include user permissions');
    it('should return 401 when not authenticated');
  });

  describe('User Profile Data', () => {
    it('should include user ID and email');
    it('should include display name');
    it('should not expose sensitive data');
  });
});
```

**Files to Create:**

- `backend/tests/integration/routes/auth-user.test.ts`

---

### Phase 5: Schema & Validator Tests

**Impact:** +3-5% coverage
**Effort:** Low-Medium (3-5 days)
**Priority:** 🟢 Medium

#### 5.1 Create users schema tests

**Priority:** 🟡 Medium
**Estimated Tests:** 15-20
**Coverage Impact:** +2-3%

**Test Scope:**

```typescript
describe('Users Schema', () => {
  describe('CreateUserSchema', () => {
    it('should validate valid user creation data');
    it('should require email field');
    it('should validate email format');
    it('should require username field');
    it('should validate username format');
    it('should allow optional display name');
  });

  describe('UpdateUserSchema', () => {
    it('should validate valid user update data');
    it('should allow partial updates');
    it('should prevent updating immutable fields');
    it('should validate email format on update');
  });

  describe('UserQuerySchema', () => {
    it('should validate pagination parameters');
    it('should validate search parameters');
    it('should validate role filter');
    it('should set default pagination values');
  });

  describe('Schema Transformations', () => {
    it('should trim whitespace from strings');
    it('should lowercase email addresses');
    it('should sanitize input data');
  });
});
```

**Files to Create:**

- `backend/tests/unit/schemas/users.test.ts`

---

#### 5.2 Expand admin validator tests

**Priority:** 🟢 Low
**Estimated Additional Tests:** 10-15
**Coverage Impact:** +1-2%

**Current Coverage:** 28.83% (no dedicated tests)

**Test Scope:**

```typescript
describe('Admin Validator - Additional Tests', () => {
  describe('Role Assignment Validation', () => {
    it('should validate role exists in system');
    it('should validate role hierarchy');
    it('should prevent invalid role combinations');
  });

  describe('Bulk Operation Validation', () => {
    it('should validate bulk operation payload');
    it('should validate user ID array');
    it('should limit bulk operation size');
  });

  describe('Custom Validators', () => {
    it('should validate admin-specific constraints');
    it('should provide detailed error messages');
  });
});
```

**Files to Create:**

- `backend/tests/unit/validators/admin.validator.test.ts`

---

### Phase 6: Utils & Config Coverage

**Impact:** +2-4% coverage
**Effort:** Low (2-3 days)
**Priority:** 🟢 Low

#### 6.1 Create config tests

**Priority:** 🟢 Low
**Estimated Tests:** 10-12
**Coverage Impact:** +1-2%

**Test Scope:**

```typescript
describe('Configuration', () => {
  describe('Environment Variable Loading', () => {
    it('should load required environment variables');
    it('should throw error for missing required vars');
    it('should use default values for optional vars');
    it('should validate environment variable format');
  });

  describe('Configuration Validation', () => {
    it('should validate DATABASE_URL format');
    it('should validate JWT_SECRET length');
    it('should validate OAuth configuration');
    it('should validate port number range');
  });

  describe('Default Values', () => {
    it('should set default port to 8081');
    it('should set default log level to "info"');
    it('should set default NODE_ENV to "development"');
  });
});
```

**Files to Create:**

- `backend/tests/unit/config/index.test.ts`
- `backend/tests/unit/config/database.test.ts`
- `backend/tests/unit/config/oauth.test.ts`

---

#### 6.2 Expand model-sync utils tests

**Priority:** 🟢 Low
**Estimated Additional Tests:** 8-10
**Coverage Impact:** +1%

**Current Coverage:** 51.77% (no dedicated tests but covered by integration)

**Test Scope:**

```typescript
describe('Model Sync Utils - Additional Tests', () => {
  describe('Model Synchronization Logic', () => {
    it('should parse LiteLLM model response');
    it('should transform model data to database format');
    it('should handle malformed model data');
    it('should deduplicate models by ID');
  });

  describe('Error Handling', () => {
    it('should handle LiteLLM API timeout');
    it('should fallback to cached models on error');
    it('should log sync errors');
  });
});
```

**Files to Create:**

- `backend/tests/unit/utils/model-sync.utils.test.ts`

---

#### 6.3 Expand subscription utils tests

**Priority:** 🟢 Low
**Estimated Additional Tests:** 10-12
**Coverage Impact:** +1%

**Current Coverage:** 53.39% (no dedicated tests)

**Test Scope:**

```typescript
describe('Subscription Utils - Additional Tests', () => {
  describe('Budget Calculations', () => {
    it('should calculate total budget from model budgets');
    it('should calculate per-model budget percentage');
    it('should calculate budget utilization');
    it('should handle unlimited budget (null)');
  });

  describe('Validation Helpers', () => {
    it('should validate budget is non-negative');
    it('should validate budget format (cents)');
    it('should validate model list is not empty');
    it('should validate TPM/RPM limits are positive');
  });

  describe('Subscription Transformations', () => {
    it('should transform API response to database format');
    it('should transform database record to API response');
  });
});
```

**Files to Create:**

- `backend/tests/unit/utils/subscription.utils.test.ts`

---

## Testing Patterns & Best Practices

### 1. Test Structure

Follow the **AAA Pattern** (Arrange, Act, Assert):

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', async () => {
      // Arrange - Set up test data and mocks
      const testData = { ... };
      vi.mocked(dependency).mockResolvedValue(expectedResult);

      // Act - Execute the code under test
      const result = await service.methodName(testData);

      // Assert - Verify the results
      expect(result).toEqual(expectedResult);
      expect(dependency).toHaveBeenCalledWith(testData);
    });
  });
});
```

### 2. Mocking Strategy

**Mock External Dependencies:**

```typescript
// Mock external services
vi.mock('../../../src/services/litellm.service.js');

// Mock database
const mockDb = {
  query: vi.fn(),
  transaction: vi.fn(),
};

// Mock Fastify app
const mockApp = {
  authenticate: vi.fn(),
  requireRole: vi.fn(),
};
```

**Use Test Factories:**

```typescript
// tests/helpers/factories.ts
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  roles: ['user'],
  ...overrides,
});
```

### 3. Test Naming Conventions

**Good Test Names:**

```typescript
✅ it('should create user with valid data')
✅ it('should throw ValidationError when email is missing')
✅ it('should return 403 when user lacks admin role')
```

**Bad Test Names:**

```typescript
❌ it('works')
❌ it('test create user')
❌ it('should work correctly')
```

### 4. Testing Error Scenarios

**Always test error paths:**

```typescript
describe('Error Handling', () => {
  it('should throw NotFoundError when user does not exist', async () => {
    vi.mocked(db.query).mockResolvedValue({ rows: [] });

    await expect(service.getUserById('invalid-id')).rejects.toThrow(
      ApplicationError.notFound('User', 'invalid-id'),
    );
  });

  it('should handle database connection errors', async () => {
    vi.mocked(db.query).mockRejectedValue(new Error('Connection failed'));

    await expect(service.getUsers()).rejects.toThrow(/database error/i);
  });
});
```

### 5. Integration Test Patterns

**Use Test Helpers:**

```typescript
import { createTestApp } from '../helpers/test-app';
import { generateTestToken } from '../integration/setup';

describe('Route Integration', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = generateTestToken('admin-user', ['admin']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should require authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/protected',
    });

    expect(response.statusCode).toBe(401);
  });
});
```

### 6. Coverage Goals by Test Type

| Test Type             | Target Coverage     | Focus                                 |
| --------------------- | ------------------- | ------------------------------------- |
| **Unit Tests**        | 80%+ statements     | Business logic, edge cases            |
| **Integration Tests** | 70%+ routes         | API contracts, RBAC, validation       |
| **Security Tests**    | 100% critical paths | Auth, authorization, input validation |

### 7. Test Data Management

**Use Fixtures:**

```typescript
// tests/fixtures/users.ts
export const mockUsers = {
  admin: {
    id: 'admin-123',
    email: 'admin@example.com',
    roles: ['admin'],
  },
  user: {
    id: 'user-123',
    email: 'user@example.com',
    roles: ['user'],
  },
};
```

**Reset State Between Tests:**

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### 8. Reference Test Files

**Excellent Examples to Study:**

1. **`admin-usage-stats.service.test.ts`** (87.92% coverage)
   - Comprehensive service testing
   - Database mocking
   - Error scenarios
   - Edge cases

2. **`banner.service.test.ts`** (80.09% coverage)
   - CRUD operations
   - RBAC testing
   - Validation

3. **`daily-usage-cache-manager.test.ts`** (99.08% coverage)
   - Cache logic
   - TTL handling
   - Concurrent access

4. **`error-helpers.test.ts`** (95.6% coverage)
   - Utility function testing
   - Error transformation
   - Multiple scenarios

5. **`routes/banners.test.ts`** (integration)
   - Full API testing
   - Authentication
   - Authorization
   - Validation

---

## Progress Tracking

### Phase Completion Checklist

- [ ] **Phase 1: Enable Skipped Tests**
  - [ ] Enable admin-usage integration tests (44 tests)
  - [ ] All tests passing
  - [ ] Coverage increase: +8-10%

- [ ] **Phase 2: Critical Services Unit Tests**
  - [ ] Create team.service.test.ts (50-60 tests)
  - [ ] Create token.service.test.ts (20-25 tests)
  - [ ] Create admin.service.test.ts (25-30 tests)
  - [ ] Expand api-key.service tests (30-35 tests)
  - [ ] Expand subscription.service tests (15-20 tests)
  - [ ] Expand oauth.service tests (15-20 tests)
  - [ ] Coverage increase: +15-20%

- [ ] **Phase 3: Plugin & Middleware Coverage**
  - [ ] Create subscription-hooks.test.ts (30-35 tests)
  - [ ] Expand auth-hooks.test.ts (10-15 tests)
  - [ ] Create error-handler.test.ts (15-20 tests)
  - [ ] Coverage increase: +10-12%

- [ ] **Phase 4: Route Integration Tests**
  - [ ] Create auth routes tests (20-25 tests)
  - [ ] Create users routes tests (25-30 tests)
  - [ ] Create models routes tests (15-20 tests)
  - [ ] Create usage routes tests (20-25 tests)
  - [ ] Create health routes tests (10-12 tests)
  - [ ] Create config routes tests (8-10 tests)
  - [ ] Create auth-user routes tests (10-12 tests)
  - [ ] Coverage increase: +8-12%

- [ ] **Phase 5: Schema & Validator Tests**
  - [ ] Create users schema tests (15-20 tests)
  - [ ] Expand admin validator tests (10-15 tests)
  - [ ] Coverage increase: +3-5%

- [ ] **Phase 6: Utils & Config Coverage**
  - [ ] Create config tests (10-12 tests)
  - [ ] Expand model-sync utils tests (8-10 tests)
  - [ ] Expand subscription utils tests (10-12 tests)
  - [ ] Coverage increase: +2-4%

### Coverage Milestones

| Milestone             | Target Coverage | Expected After Phase |
| --------------------- | --------------- | -------------------- |
| **Current**           | 56.36%          | Baseline             |
| **Quick Win**         | 64-66%          | Phase 1              |
| **Critical Services** | 79-86%          | Phase 2              |
| **Core Coverage**     | 89-98%          | Phase 3              |
| **Target Met**        | 80%+            | Phase 4              |

### Test Count Progression

| Phase   | Estimated New Tests  | Total Tests      |
| ------- | -------------------- | ---------------- |
| Current | -                    | 495 (449 active) |
| Phase 1 | +44 (enable skipped) | 539              |
| Phase 2 | +150-175             | 689-714          |
| Phase 3 | +55-70               | 744-784          |
| Phase 4 | +108-134             | 852-918          |
| Phase 5 | +25-35               | 877-953          |
| Phase 6 | +28-34               | 905-987          |

**Expected Final Test Count:** ~900-1000 tests

---

## Execution Guidelines

### Running Tests

```bash
# Run all tests with coverage
npm run test:coverage

# Run specific test file
npm run test:unit services/team.service.test.ts

# Run integration tests
npm run test:integration

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with verbose output
npm run test:unit -- --reporter=verbose
```

### Coverage Thresholds

Update `vitest.config.ts` with coverage thresholds after Phase 2:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: [
        'src/index.ts', // Entry point
        'src/lib/run-migrations.ts', // Migration runner
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/tests/**',
      ],
    },
  },
});
```

### Continuous Integration

Add coverage checks to CI pipeline:

```yaml
# .github/workflows/backend-tests.yml
- name: Run tests with coverage
  run: npm --prefix backend run test:coverage

- name: Check coverage thresholds
  run: npm --prefix backend run test:coverage -- --coverage.thresholdAutoUpdate=false

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./backend/coverage/lcov.info
```

---

## Success Criteria

### Coverage Targets (MUST MEET)

- [ ] **Overall statement coverage ≥ 80%**
- [ ] **Branch coverage ≥ 75%**
- [ ] **Function coverage ≥ 80%**
- [ ] **Line coverage ≥ 80%**

### Quality Targets (SHOULD MEET)

- [ ] All critical services have unit tests (team, token, admin, api-key)
- [ ] All routes have integration tests
- [ ] Zero files with 0% coverage (except entry points)
- [ ] All tests passing (no skipped tests unless justified)
- [ ] Test execution time < 60 seconds (optimize if needed)
- [ ] All error scenarios tested
- [ ] All RBAC scenarios tested

### Documentation (NICE TO HAVE)

- [ ] Test README with running instructions
- [ ] Test helpers documented
- [ ] Mock factories documented
- [ ] Common test patterns documented

---

## Maintenance & Updates

### Ongoing Test Maintenance

1. **Add tests for new features** - Maintain 80%+ coverage for new code
2. **Update tests when changing code** - Keep tests in sync with implementation
3. **Review coverage weekly** - Run `npm run test:coverage` and check trends
4. **Refactor brittle tests** - Improve test maintainability over time

### Coverage Monitoring

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open backend/coverage/index.html

# Check coverage diff
npm run test:coverage -- --coverage.reporter=json-summary
```

### Test Performance Optimization

If test execution time exceeds 60 seconds:

1. Parallelize test execution
2. Use test database snapshots
3. Mock heavy external services
4. Reduce test data size
5. Use `test.concurrent` for independent tests

---

## Appendix

### A. Test File Naming Conventions

```
Unit Tests:
  backend/tests/unit/services/{service-name}.service.test.ts
  backend/tests/unit/utils/{util-name}.test.ts
  backend/tests/unit/middleware/{middleware-name}.test.ts

Integration Tests:
  backend/tests/integration/routes/{route-name}.test.ts
  backend/tests/integration/{feature-name}.test.ts

Security Tests:
  backend/tests/security/{security-area}.test.ts
```

### B. Coverage Report Interpretation

```
% Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------

% Stmts  : Percentage of statements executed
% Branch : Percentage of conditional branches tested
% Funcs  : Percentage of functions called
% Lines  : Percentage of code lines executed
Uncovered: Line numbers not covered by tests
```

### C. Useful Testing Resources

**Vitest Documentation:**

- https://vitest.dev/guide/
- https://vitest.dev/api/
- https://vitest.dev/guide/mocking.html

**Fastify Testing:**

- https://www.fastify.io/docs/latest/Guides/Testing/

**Testing Best Practices:**

- https://github.com/goldbergyoni/javascript-testing-best-practices

### D. Common Test Utilities

**Assertion Helpers:**

```typescript
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toMatchObject(partial);
expect(fn).toThrow(error);
expect(fn).toHaveBeenCalledWith(args);
expect(promise).resolves.toBe(value);
expect(promise).rejects.toThrow(error);
```

**Mock Helpers:**

```typescript
vi.fn(); // Create mock function
vi.mock('module'); // Mock module
vi.mocked(fn); // Get mocked function
vi.clearAllMocks(); // Clear all mock calls
vi.resetAllMocks(); // Reset all mocks
vi.restoreAllMocks(); // Restore original implementations
```

---

**Document End**

_Last Updated: 2025-10-09_
_Next Review: After Phase 2 completion_

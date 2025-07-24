# LiteMaaS Workflow Fixes - Implementation Plan

*Created: 2025-01-24*  
*Priority: Critical - User Workflow Blocking Issues*  
*Estimated Timeline: 3-5 days*

## 🎯 Overview

This implementation plan addresses three critical workflow disconnections in LiteMaaS that prevent the proper user experience flow. The issues are well-defined with existing infrastructure to support the fixes.

**Reference**: See [WORKFLOW_ANALYSIS.md](./WORKFLOW_ANALYSIS.md) for detailed technical analysis.

## 📋 Implementation Phases

### Phase 1: Critical Workflow Fixes (Days 1-3)
**Priority**: CRITICAL - Blocking user workflows  
**Estimated Effort**: 2-3 days

#### Task 1.1: Fix OAuth → LiteLLM User Creation
**File**: `backend/src/services/oauth.service.ts`  
**Priority**: Critical  
**Estimated Time**: 4-6 hours

**Changes Required**:
```typescript
// Modify processOAuthUser method to include LiteLLM user creation
async processOAuthUser(userInfo: OAuthUserInfo): Promise<User> {
  // 1. Create/update user in local database (existing)
  const user = await this.createOrUpdateUser(userInfo);
  
  // 2. NEW: Ensure user exists in LiteLLM
  try {
    await this.ensureLiteLLMUser(user);
    user.sync_status = 'synced';
  } catch (error) {
    this.fastify.log.warn(error, 'Failed to sync user to LiteLLM during auth');
    user.sync_status = 'error';
    // Continue - user can still use app, sync will retry later
  }
  
  return user;
}

// NEW: Helper method for user verification/creation
private async ensureLiteLLMUser(user: User): Promise<void> {
  try {
    // Check if user exists in LiteLLM
    await this.liteLLMService.getUserInfo(user.id);
  } catch (error) {
    // User doesn't exist, create them
    await this.liteLLMService.createUser({
      user_id: user.id,
      user_email: user.email,
      user_alias: user.username,
      max_budget: 100, // Default budget
      tpm_limit: 1000,
      rpm_limit: 60
    });
  }
}
```

**Testing Requirements**:
- Unit tests for `ensureLiteLLMUser` method
- Integration tests for OAuth flow with LiteLLM
- Error handling tests for LiteLLM failures

#### Task 1.2: Implement Model Access Validation
**Files**: 
- `backend/src/plugins/api-key-auth.ts` (primary)
- `backend/src/types/auth.types.ts` (type updates)

**Priority**: Critical  
**Estimated Time**: 6-8 hours

**Changes Required**:

1. **Update Type Definitions**:
```typescript
// backend/src/types/auth.types.ts
export interface ApiKeyValidation {
  isValid: boolean;
  apiKey?: ApiKey;
  subscription?: {
    id: string;
    userId: string;
    modelId: string;        // ✅ Already exists
    allowedModels?: string[]; // NEW: For multi-model subscriptions
    status: string;
  };
  error?: string;
}

export interface ApiKeyAuthRequest extends FastifyRequest {
  apiKey?: {
    keyId: string;
    subscriptionId: string;
    userId: string;
    allowedModels: string[]; // NEW: Model access list
  };
}
```

2. **Enhance API Key Validation**:
```typescript
// backend/src/services/api-key.service.ts
async validateApiKey(keyValue: string): Promise<ApiKeyValidation> {
  // Existing validation logic...
  
  if (keyRecord && subscription) {
    // NEW: Get allowed models for this subscription
    const allowedModels = await this.getSubscriptionModels(subscription.id);
    
    return {
      isValid: true,
      apiKey: keyRecord,
      subscription: {
        ...subscription,
        allowedModels
      }
    };
  }
}

// NEW: Helper method
private async getSubscriptionModels(subscriptionId: string): Promise<string[]> {
  const subscription = await this.db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { model: true }
  });
  
  return subscription ? [subscription.model.id] : [];
}
```

3. **Add Model Access Middleware**:
```typescript
// backend/src/plugins/api-key-auth.ts
export const requireModelAccess = (requestedModel: string) => {
  return async (request: ApiKeyAuthRequest, reply: FastifyReply) => {
    if (!request.apiKey) {
      throw fastify.httpErrors.unauthorized('Valid API key required');
    }
    
    if (!request.apiKey.allowedModels.includes(requestedModel)) {
      throw fastify.httpErrors.forbidden(
        `API key does not have access to model: ${requestedModel}`
      );
    }
  };
};
```

**Testing Requirements**:
- Unit tests for enhanced validation logic
- Integration tests for model access enforcement
- Security tests for unauthorized access attempts

#### Task 1.3: Add User Verification to Critical Flows
**Files**:
- `backend/src/services/api-key.service.ts`
- `backend/src/services/subscription.service.ts`

**Priority**: Critical  
**Estimated Time**: 4-6 hours

**Changes Required**:

1. **Enhance API Key Creation**:
```typescript
// backend/src/services/api-key.service.ts
async createApiKey(userId: string, subscriptionId: string, request: CreateApiKeyDto) {
  // NEW: Verify user exists in LiteLLM before creating API key
  await this.ensureUserExistsInLiteLLM(userId);
  
  // Existing API key creation logic...
}

// NEW: User verification helper
private async ensureUserExistsInLiteLLM(userId: string): Promise<void> {
  try {
    await this.liteLLMService.getUserInfo(userId);
  } catch (error) {
    // User doesn't exist, create them
    const user = await this.getUserFromDatabase(userId);
    await this.liteLLMService.createUser({
      user_id: user.id,
      user_email: user.email,
      user_alias: user.username,
      max_budget: user.max_budget || 100,
      tpm_limit: user.tpm_limit || 1000,
      rpm_limit: user.rpm_limit || 60
    });
  }
}
```

2. **Enhance Subscription Creation**:
```typescript
// backend/src/services/subscription.service.ts
async createEnhancedSubscription(userId: string, request: EnhancedCreateSubscriptionDto) {
  // NEW: Ensure user exists in LiteLLM first
  await this.ensureUserExistsInLiteLLM(userId);
  
  // Existing subscription creation logic...
  
  // If auto-generating API key
  if (request.generate_api_key) {
    // User existence already verified above
    const apiKey = await this.apiKeyService.createApiKey(userId, subscription.id, {
      name: request.api_key_name || `${subscription.id}-key`
    });
  }
}
```

**Testing Requirements**:
- Unit tests for user verification methods
- Integration tests for subscription + API key creation
- Error handling tests for LiteLLM communication failures

### Phase 2: Enhanced Error Handling (Day 4)
**Priority**: High  
**Estimated Effort**: 1 day

#### Task 2.1: Implement Circuit Breaker Pattern
**File**: `backend/src/services/litellm.service.ts`  
**Estimated Time**: 4-6 hours

**Changes Required**:
```typescript
import { CircuitBreaker } from 'opossum';

export class LiteLLMService {
  private circuitBreaker: CircuitBreaker;
  
  constructor() {
    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });
  }
  
  async createUser(request: LiteLLMUserRequest) {
    return this.circuitBreaker.fire('POST', '/user/new', request);
  }
  
  // Apply to all LiteLLM API calls
}
```

#### Task 2.2: Add Integration Health Monitoring
**File**: `backend/src/routes/health.ts`  
**Estimated Time**: 2-3 hours

**Changes Required**:
```typescript
// Add detailed health check for LiteLLM integration
fastify.get('/health/integration', async (request, reply) => {
  const health = {
    litellm: {
      status: 'unknown',
      latency: null,
      last_sync: null,
      circuit_breaker: 'closed'
    }
  };
  
  try {
    const start = Date.now();
    await liteLLMService.healthCheck();
    health.litellm.status = 'healthy';
    health.litellm.latency = Date.now() - start;
  } catch (error) {
    health.litellm.status = 'unhealthy';
  }
  
  return health;
});
```

### Phase 3: User Experience Improvements (Day 5)
**Priority**: Medium  
**Estimated Effort**: 1 day

#### Task 3.1: Frontend Model Access Display
**File**: `frontend/src/pages/ApiKeysPage.tsx`  
**Estimated Time**: 3-4 hours

**Changes Required**:
```typescript
// Show model restrictions for each API key
const ApiKeyCard = ({ apiKey }: { apiKey: ApiKey }) => {
  return (
    <Card>
      <CardTitle>{apiKey.name}</CardTitle>
      <CardBody>
        <DescriptionList>
          <DescriptionListGroup>
            <DescriptionListTerm>Model Access</DescriptionListTerm>
            <DescriptionListDescription>
              <Label color="blue">{apiKey.subscription.model.name}</Label>
            </DescriptionListDescription>
          </DescriptionListGroup>
          {/* Existing fields */}
        </DescriptionList>
      </CardBody>
    </Card>
  );
};
```

#### Task 3.2: Enhanced Error Messages
**File**: `frontend/src/services/api.service.ts`  
**Estimated Time**: 2-3 hours

**Changes Required**:
```typescript
// Map backend errors to user-friendly messages
const errorMessages = {
  'MODEL_ACCESS_DENIED': 'Your API key does not have access to this model. Please check your subscription.',
  'USER_NOT_FOUND_LITELLM': 'Account setup in progress. Please try again in a moment.',
  'LITELLM_UNAVAILABLE': 'Service temporarily unavailable. Please try again later.'
};
```

## 🧪 Testing Strategy

### Unit Tests (Required for each task)
```bash
# Backend tests
npm run test:backend -- --testNamePattern="oauth|api-key|subscription"

# Frontend tests  
npm run test:frontend -- --testNamePattern="ApiKey|Model"
```

### Integration Tests
```bash
# Test complete user workflow
npm run test:integration -- --testNamePattern="workflow|user-creation|model-access"
```

### End-to-End Tests
```bash
# Test critical user paths
npm run test:e2e -- --testNamePattern="authentication|subscription|api-key"
```

## 🚀 Deployment Strategy

### Phase 1 Deployment (Critical Fixes)
1. **Feature Flags**: Implement feature flags for new model access validation
2. **Gradual Rollout**: Deploy to staging first, then production
3. **Monitoring**: Enhanced logging for new authentication flows
4. **Rollback Plan**: Quick rollback capability if issues arise

### Database Migrations
No schema changes required - using existing relationships.

### Configuration Updates
```env
# Add configuration for enhanced error handling
LITELLM_TIMEOUT=5000
CIRCUIT_BREAKER_THRESHOLD=50
INTEGRATION_HEALTH_CHECK=true
```

## 📊 Success Metrics

### User Experience Metrics
- **API Key Creation Success Rate**: Target >95% (currently ~80%)
- **Authentication Flow Completion**: Target >99%
- **Model Access Errors**: Target <1% false negatives

### Technical Metrics
- **LiteLLM Integration Uptime**: Target >99.5%
- **User Sync Success Rate**: Target >95%
- **Response Time**: API key creation <2s, validation <200ms

### Security Metrics
- **Unauthorized Model Access Attempts**: Target 0
- **API Key Misuse Detection**: Implement monitoring

## 🔍 Monitoring and Alerting

### New Alerts to Implement
1. **High API Key Creation Failure Rate** (>5%)
2. **LiteLLM User Creation Failures** (>2%)
3. **Model Access Validation Errors** (>1%)
4. **Circuit Breaker Open** (immediate alert)

### Dashboards to Update
1. **User Authentication Flow** success rates
2. **LiteLLM Integration Health** metrics
3. **API Key Usage by Model** analytics

## 🎯 Definition of Done

### Phase 1 Complete When:
- [ ] Users are automatically created in LiteLLM during OAuth
- [ ] API keys enforce model access restrictions
- [ ] No race conditions in subscription → API key flow
- [ ] All unit and integration tests pass
- [ ] Manual testing validates complete user workflow

### Phase 2 Complete When:
- [ ] Circuit breaker protects against LiteLLM failures
- [ ] Health monitoring shows integration status
- [ ] Error handling provides graceful degradation
- [ ] Performance tests show stable response times

### Phase 3 Complete When:
- [ ] Frontend clearly shows model access restrictions
- [ ] Error messages are user-friendly and actionable
- [ ] User experience flows smoothly end-to-end

## 🚨 Risk Mitigation

### High Risk Items
1. **LiteLLM Service Availability**: Circuit breaker pattern implemented
2. **Database Transaction Consistency**: Proper error handling and rollback
3. **User Experience Disruption**: Feature flags and gradual rollout

### Rollback Procedures
1. **Feature Flags**: Instant disable of new validation logic
2. **Code Rollback**: Previous version deployment within 15 minutes
3. **Database Rollback**: No schema changes, data rollback not needed

## 📋 Prerequisites

### Development Environment
- [ ] Access to LiteLLM development instance
- [ ] Test user accounts in OpenShift SSO
- [ ] Database with test data for all scenarios

### Team Coordination
- [ ] Frontend team availability for UX changes (Phase 3)
- [ ] DevOps team for deployment coordination
- [ ] Product team for user acceptance testing

---

**Next Steps**: Begin with Phase 1, Task 1.1 (OAuth → LiteLLM User Creation) as it's the foundation for the other fixes.
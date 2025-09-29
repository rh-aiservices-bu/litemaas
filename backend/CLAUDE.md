# CLAUDE.md - LiteMaaS Backend Context

> **Note for AI Assistants**: This is a backend-specific context file for the LiteMaaS Fastify API server. For project overview, see root CLAUDE.md. For frontend context, see frontend/CLAUDE.md.

## 🎯 Backend Overview

**@litemaas/backend** - Fastify-based API server with PostgreSQL, OAuth2/JWT authentication, role-based access control, and LiteLLM integration.

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

**Core Tables**: users, teams, models, subscriptions, api_keys, usage_logs, audit_logs

For complete schema, see [`docs/architecture/database-schema.md`](../docs/architecture/database-schema.md).

## 🔐 Authentication & Authorization

**OAuth2 Flow**: `/api/auth/login -> OAuth provider -> /api/auth/callback -> JWT token with roles`

**RBAC**: Three-tier hierarchy `admin > adminReadonly > user` with OpenShift group mapping.

**API Keys**: `Authorization: Bearer sk-litellm-{key}`

**Development**: `MOCK_AUTH=true` for auto-login.

For details, see [`docs/features/user-roles-administration.md`](../docs/features/user-roles-administration.md).

## 🎯 Service Layer Pattern

**BaseService Inheritance**: All services extend `BaseService` for consistent CRUD operations, transaction support, and error handling.

**Core Services**: RBACService, OAuthService, ApiKeyService, SubscriptionService, UsageStatsService, AdminService

For implementation details, see [`docs/development/backend-guide.md`](../docs/development/backend-guide.md).

## ⚠️ Implementation Patterns - MUST FOLLOW

### Service Implementation Pattern
```typescript
// ✅ CORRECT - Extend BaseService
export class MyService extends BaseService {
  async createItem(data: CreateRequest) {
    // Use built-in validation
    this.validateRequiredFields(data, ['name', 'email']);
    this.validateEmail(data.email);

    try {
      return await this.executeQueryOne<Item>('INSERT...', [data]);
    } catch (error) {
      // Use ApplicationError factory methods
      if (error.code === '23505') {
        throw ApplicationError.alreadyExists('Item', 'name', data.name);
      }
      throw this.mapDatabaseError(error, 'item creation');
    }
  }
}

// ❌ WRONG - Don't create services without BaseService
export class MyService {
  async createItem(data) {
    if (!data.name) throw new Error('Name required'); // Wrong!
    // Direct database access without error mapping
  }
}
```

### Route Pattern with RBAC
```typescript
// ✅ CORRECT - Use preHandler for role validation
app.post('/api/admin/items',
  {
    preHandler: [app.authenticate, app.requireRole('admin')],
    schema: { body: CreateItemSchema }
  },
  async (request, reply) => {
    const result = await itemService.create(request.body);
    return { data: result };
  }
);

// ❌ WRONG - Don't manually check roles in handler
app.post('/api/admin/items', async (request, reply) => {
  if (request.user.role !== 'admin') { // Wrong!
    throw new Error('Unauthorized');
  }
  // ...
});
```

### Error Handling Pattern
```typescript
// ✅ CORRECT - Use ApplicationError factory methods
throw ApplicationError.validation('Invalid format', 'field', value, 'suggestion');
throw ApplicationError.notFound('User', userId);
throw ApplicationError.forbidden('Admin access required', 'admin');

// ❌ WRONG - Don't use generic errors
throw new Error('Invalid format'); // Wrong!
throw { statusCode: 404, message: 'Not found' }; // Wrong!
```

### Anti-Patterns to Avoid
1. **Never** create services without extending BaseService
2. **Never** use `new Error()` - use ApplicationError factory methods
3. **Never** handle authentication/authorization manually - use middleware
4. **Never** access database directly without error mapping
5. **Never** skip validation helpers from BaseService

## 🔄 LiteLLM Integration

**Model Sync**: Auto-sync on startup from `/model/info` endpoint with graceful fallback to mock data.

**API Key Flow**: Database creation → LiteLLM key generation → One-time user display.

For details, see [`docs/architecture/litellm-integration.md`](../docs/architecture/litellm-integration.md).

## 🚀 Development Commands

```bash
# Development with auto-reload
npm run dev

# Development with OAuth (requires .env.oauth.local)
npm run dev:oauth

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

## 📚 Related Documentation

- Root [`CLAUDE.md`](../CLAUDE.md) - Project overview
- Frontend [`CLAUDE.md`](../frontend/CLAUDE.md) - Frontend context
- [`docs/api/`](../docs/api/) - API documentation
- [`docs/architecture/`](../docs/architecture/) - System design
- [`docs/deployment/`](../docs/deployment/) - Deployment guides
- [`docs/development/error-handling.md`](../docs/development/error-handling.md) - Error handling best practices

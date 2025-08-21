# CLAUDE.md - LiteMaaS Backend Context

> **Note for AI Assistants**: This is a backend-specific context file for the LiteMaaS Fastify API server. For project overview, see root CLAUDE.md. For frontend context, see frontend/CLAUDE.md.

## 🎯 Backend Overview

**@litemaas/backend** - Fastify-based API server with PostgreSQL, OAuth2/JWT authentication, role-based access control, and LiteLLM integration.

## 📁 Backend Structure

```
backend/
├── src/
│   ├── config/            # Configuration modules
│   │   └── database.ts    # Database connection config
│   ├── lib/               # Database utilities
│   │   └── database-migrations.ts # Database migration utilities
│   ├── middleware/        # Fastify middleware
│   │   ├── api-key-auth.ts # API key validation
│   │   ├── auth-hooks.ts  # Auth lifecycle hooks
│   │   └── error-handler.ts # Error handling
│   ├── plugins/           # Fastify plugins (registered in order)
│   │   ├── env.ts        # Environment variables
│   │   ├── database.ts   # PostgreSQL connection pool
│   │   ├── auth.ts       # JWT authentication
│   │   ├── oauth.ts      # OAuth2 provider
│   │   ├── session.ts    # Session management
│   │   ├── rbac.ts       # Role-based access control
│   │   ├── rate-limit.ts # Rate limiting
│   │   ├── swagger.ts    # API documentation
│   │   └── subscription-hooks.ts # Subscription lifecycle
│   ├── routes/            # API endpoints (flat structure)
│   │   ├── auth.ts       # OAuth flow endpoints (/api/auth)
│   │   ├── auth-user.ts  # User profile endpoints (/api/v1/auth)
│   │   ├── models.ts     # Model management (/api/v1/models)
│   │   ├── subscriptions.ts # Subscription CRUD (/api/v1/subscriptions)
│   │   ├── api-keys.ts   # API key management (/api/v1/api-keys)
│   │   ├── users.ts      # User management (/api/v1/users)
│   │   ├── admin.ts      # Admin endpoints (/api/v1/admin)
│   │   ├── usage.ts      # Usage tracking (/api/v1/usage)
│   │   ├── config.ts     # Configuration endpoints (/api/v1/config)
│   │   ├── health.ts     # Health check (/api/v1/health)
│   │   └── index.ts      # Route registration
│   ├── schemas/           # TypeBox validation schemas
│   │   ├── common.ts     # Common schemas (UUID, pagination)
│   │   ├── models.ts     # Model schemas
│   │   ├── subscriptions.ts # Subscription schemas
│   │   ├── api-keys.ts   # API key schemas
│   │   ├── auth.ts       # Authentication schemas
│   │   ├── users.ts      # User schemas
│   │   ├── usage.ts      # Usage schemas
│   │   ├── health.ts     # Health check schemas
│   │   └── index.ts      # Schema exports
│   ├── services/          # Business logic layer
│   │   ├── base.service.ts # Base service class (inheritance pattern)
│   │   ├── api-key.service.ts # API key operations
│   │   ├── default-team.service.ts # Default team management
│   │   ├── litellm.service.ts # LiteLLM API client
│   │   ├── litellm-integration.service.ts # LiteLLM integration layer
│   │   ├── model-sync.service.ts # Model synchronization
│   │   ├── oauth.service.ts # OAuth provider integration
│   │   ├── rbac.service.ts # Role-based access control
│   │   ├── session.service.ts # Session management
│   │   ├── subscription.service.ts # Subscription management
│   │   ├── team.service.ts # Team operations
│   │   ├── token.service.ts # Token generation and validation
│   │   └── usage-stats.service.ts # Usage analytics
│   ├── types/             # TypeScript definitions
│   │   ├── fastify.ts    # Fastify decorators
│   │   ├── api-key.types.ts # API key types
│   │   ├── auth.types.ts # Authentication types
│   │   ├── common.types.ts # Common types
│   │   ├── model.types.ts # Model types
│   │   ├── subscription.types.ts # Subscription types
│   │   ├── usage.types.ts # Usage types
│   │   ├── user.types.ts # User types
│   │   └── index.ts      # Type exports
│   ├── utils/             # Utility functions
│   │   ├── validation.utils.ts # Input validation helpers
│   │   └── litellm-sync.utils.ts # LiteLLM sync utilities
│   ├── validators/        # Input validators
│   │   └── usage.validator.ts # Usage tracking validation
│   ├── app.ts            # Fastify app configuration
│   └── index.ts          # Server entry point
├── tests/
│   ├── fixtures/         # Test data and mocks
│   ├── integration/      # API integration tests
│   ├── performance/      # K6 load testing
│   ├── security/         # Auth and security tests
│   └── unit/            # Service unit tests
└── dist/                # TypeScript build output
```

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

### Core Tables

- **users** - User accounts with OAuth integration and roles array
- **teams** - Team collaboration (includes Default Team)
- **models** - AI models synced from LiteLLM
- **subscriptions** - User-model subscriptions
- **api_keys** - API authentication keys
- **api_key_models** - Many-to-many API key to model mapping
- **usage_logs** - Request and token usage tracking
- **audit_logs** - Security and compliance logging
- **user_roles** - Role assignments and permissions (stored in users.roles array)
- **admin_actions** - Administrator action auditing

### Key Relationships

```sql
users <-> teams (many-to-many via team_members)
users -> subscriptions (one-to-many)
users -> api_keys (one-to-many)
api_keys <-> models (many-to-many via api_key_models)
subscriptions -> models (many-to-one)
```

## 🔐 Authentication & Authorization

### OAuth2 Flow (Primary)

```
/api/auth/login -> OAuth provider -> /api/auth/callback -> JWT token with roles
```

### Role-Based Access Control (RBAC)

Three-tier role hierarchy with OpenShift group mapping:

```
admin > adminReadonly > user
```

#### Role Definitions

- **`admin`**: Full system access including user management and system operations
- **`adminReadonly`**: Read access to all data and system information
- **`user`**: Standard access to own resources only

#### OpenShift Group Mapping

```typescript
const GROUP_ROLE_MAPPING = {
  'litemaas-admins': 'admin',
  'litemaas-readonly': 'adminReadonly',
  'litemaas-users': 'user',
};
```

#### Multi-Role Support

Users can have multiple roles; most powerful role determines permissions:

```typescript
// User with admin role has full access
user.roles = ['admin', 'user'] -> Effective role: admin

// Read-only admin cannot perform write operations
user.roles = ['adminReadonly', 'user'] -> Can view all, cannot modify
```

### API Key Authentication

```
Authorization: Bearer sk-litellm-{key} -> Validate -> Access granted
```

### Development Mock Mode

```
MOCK_AUTH=true -> Auto-login as test user (dev only)
```

## 🎯 Service Layer Pattern

### BaseService Inheritance

All services extend `BaseService` for consistent patterns:

#### Core Services

- **RBACService**: Role-based access control and permission validation
- **OAuthService**: OAuth2 integration with role assignment from OpenShift groups
- **ApiKeyService**: API key management with user permission checks
- **SubscriptionService**: Subscription management with role-based data filtering
- **UsageStatsService**: Usage analytics with admin/user data scoping
- **AdminService**: Administrative operations (admin role required)

```typescript
export abstract class BaseService {
  protected db: PostgresDb;
  protected logger: FastifyBaseLogger;

  // Common CRUD operations
  protected async findOne<T>(table: string, conditions: object): Promise<T | null>;
  protected async findMany<T>(table: string, conditions?: object): Promise<T[]>;
  protected async create<T>(table: string, data: object): Promise<T>;
  protected async update<T>(table: string, conditions: object, data: object): Promise<T>;
  protected async delete(table: string, conditions: object): Promise<boolean>;

  // Transaction support
  protected async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
}
```

## 🔄 LiteLLM Integration

### Model Synchronization

- Auto-sync on startup from `/model/info` endpoint
- Graceful fallback to mock data if LiteLLM unavailable
- Field mapping:
  ```typescript
  model_name -> id, name
  litellm_params.custom_llm_provider -> provider
  model_info.max_tokens -> context_length
  model_info.input_cost_per_token -> input_cost
  model_info.output_cost_per_token -> output_cost
  ```

### API Key Creation Flow

```typescript
// 1. Create in database
const dbKey = await apiKeyService.create({
  userId,
  teamId,
  modelIds,
  metadata,
});

// 2. Generate LiteLLM key
const litellmKey = await litellmService.generateKey({
  user_id: userId,
  team_id: teamId,
  models: modelIds,
  metadata: { ...metadata, db_key_id: dbKey.id },
});

// 3. Return to user (one-time view)
return { key: litellmKey.key, models: modelIds };
```

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
- Auto-assigned to all users on creation
- Empty `allowed_models: []` grants access to all models
- Ensures LiteLLM team requirement is always met

### Multi-Model API Keys

```typescript
// Modern multi-model approach
{
  modelIds: ["gpt-4", "claude-3"],
  maxBudget: 1000.00,
  tpmLimit: 10000,
  permissions: { read: true, write: true }
}

// Legacy single-subscription (deprecated)
{
  subscriptionId: "sub_123" // Shows deprecation warning
}
```

### Role-Based Route Protection

```typescript
// Admin-only endpoints
fastify.register(adminRoutes, {
  preHandler: [authenticateUser, requireRole(['admin', 'adminReadonly'])],
});

// Write operations require full admin
fastify.post('/admin/users', {
  preHandler: [authenticateUser, requireRole(['admin'])],
  handler: createUser,
});

// User resource endpoints with ownership validation
fastify.get('/subscriptions', {
  preHandler: [authenticateUser, validateResourceAccess],
  handler: getSubscriptions,
});
```

### Admin Features

#### User Management

```typescript
// List all users (admin/adminReadonly)
GET /api/v1/admin/users

// Create user (admin only)
POST /api/v1/admin/users

// Update user roles (admin only)
PUT /api/v1/admin/users/:id

// Deactivate user (admin only)
DELETE /api/v1/admin/users/:id
```

#### System Operations

```typescript
// System status (admin/adminReadonly)
GET / api / v1 / admin / system / status;

// Model synchronization (admin only)
POST / api / v1 / admin / sync / models;

// Global sync operations (admin only)
POST / api / v1 / integration / sync;
```

### Error Handling Strategy

- Graceful "already exists" handling in user/team creation
- Circuit breaker pattern for LiteLLM communication
- Detailed error logging with request correlation IDs
- Client-friendly error messages with status codes

### Rate Limiting Configuration

```typescript
{
  global: { max: 100, timeWindow: '1 minute' },
  authenticated: { max: 1000, timeWindow: '1 minute' },
  apiKey: { max: 10000, timeWindow: '1 minute' },
  admin: { max: 5000, timeWindow: '1 minute' } // Higher limits for admin
}
```

### Security Features

#### Role Validation

```typescript
// Middleware validates user roles on every request
const requireRole = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRoles = request.user?.roles || [];

    // Check if user has any of the required roles
    const hasRequiredRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
};
```

#### Data Access Control

```typescript
// Filter data based on user role
const filterUserData = (user: User, requestedUserId?: string) => {
  // Admin can access any user's data
  if (user.roles.includes('admin') || user.roles.includes('adminReadonly')) {
    return requestedUserId || 'all';
  }

  // Regular users can only access their own data
  if (requestedUserId && requestedUserId !== user.id) {
    throw new ForbiddenError("Cannot access other users' data");
  }

  return user.id;
};
```

#### Audit Logging

```typescript
// All admin actions are logged
const auditAdminAction = async (action: string, userId: string, details: object) => {
  await auditService.log({
    action,
    userId,
    timestamp: new Date(),
    details,
    userAgent: request.headers['user-agent'],
    ipAddress: request.ip,
  });
};
```

## 📊 Performance Targets

- API response time: <200ms (p95)
- Database query time: <50ms (p95)
- Concurrent connections: 1000+
- Memory usage: <512MB under normal load

## 🔗 Environment Variables

Key backend configuration:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/litemaas
DATABASE_POOL_SIZE=20

# Authentication
JWT_SECRET=your-secret-key
OAUTH_CLIENT_ID=client-id
OAUTH_CLIENT_SECRET=client-secret

# LiteLLM Integration
LITELLM_API_URL=http://localhost:4000
LITELLM_API_KEY=sk-litellm-key

# Role-Based Access Control
DEFAULT_USER_ROLES=["user"]
ADMIN_BOOTSTRAP_USERS=admin@company.com,system@company.com

# Development
MOCK_AUTH=false
LOG_LEVEL=info
NODE_ENV=development
```

See `docs/deployment/configuration.md` for complete list.

## 📚 Related Documentation

- Root [`CLAUDE.md`](../CLAUDE.md) - Project overview
- Frontend [`CLAUDE.md`](../frontend/CLAUDE.md) - Frontend context
- [`docs/api/`](../docs/api/) - API documentation
- [`docs/architecture/`](../docs/architecture/) - System design
- [`docs/deployment/`](../docs/deployment/) - Deployment guides

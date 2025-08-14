# CLAUDE.md - LiteMaaS Backend Context

> **Note for AI Assistants**: This is a backend-specific context file for the LiteMaaS Fastify API server. For project overview, see root CLAUDE.md. For frontend context, see frontend/CLAUDE.md.

## 🎯 Backend Overview

**@litemaas/backend** - Fastify-based API server with PostgreSQL, OAuth2/JWT authentication, and LiteLLM integration.

## 📁 Backend Structure

```
backend/
├── src/
│   ├── config/            # Configuration modules
│   │   └── database.ts    # Database connection config
│   ├── middleware/        # Fastify middleware
│   │   ├── auth.ts       # JWT/API key validation
│   │   ├── error.ts      # Error handling
│   │   └── cors.ts       # CORS configuration
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
│   ├── routes/            # API endpoints
│   │   ├── auth/         # OAuth flow (unversioned)
│   │   └── v1/           # Versioned API routes
│   │       ├── auth.ts   # User profile endpoints
│   │       ├── models.ts # Model management
│   │       ├── subscriptions.ts # Subscription CRUD
│   │       ├── api-keys.ts # API key management
│   │       ├── teams.ts  # Team collaboration
│   │       └── usage.ts  # Usage tracking
│   ├── schemas/           # TypeBox validation schemas
│   │   ├── shared.ts     # Common schemas (UUID, pagination)
│   │   ├── model.ts      # Model schemas
│   │   ├── subscription.ts # Subscription schemas
│   │   └── api-key.ts    # API key schemas
│   ├── services/          # Business logic layer
│   │   ├── base.service.ts # Base service class (inheritance pattern)
│   │   ├── litellm.service.ts # LiteLLM API client
│   │   ├── model-sync.service.ts # Model synchronization
│   │   ├── subscription.service.ts # Subscription management
│   │   ├── api-key.service.ts # API key operations
│   │   ├── default-team.service.ts # Default team management
│   │   └── usage-stats.service.ts # Usage analytics
│   ├── types/             # TypeScript definitions
│   │   ├── fastify.d.ts  # Fastify decorators
│   │   ├── models.ts     # Database models
│   │   └── litellm.ts    # LiteLLM types
│   ├── utils/             # Utility functions
│   │   ├── validation.ts # Input validation helpers
│   │   ├── sync.ts       # LiteLLM sync utilities
│   │   └── errors.ts     # Error handling utilities
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
- **users** - User accounts with OAuth integration
- **teams** - Team collaboration (includes Default Team)
- **models** - AI models synced from LiteLLM
- **subscriptions** - User-model subscriptions
- **api_keys** - API authentication keys
- **api_key_models** - Many-to-many API key to model mapping
- **usage_logs** - Request and token usage tracking
- **audit_logs** - Security and compliance logging

### Key Relationships
```sql
users <-> teams (many-to-many via team_members)
users -> subscriptions (one-to-many)
users -> api_keys (one-to-many)
api_keys <-> models (many-to-many via api_key_models)
subscriptions -> models (many-to-one)
```

## 🔐 Authentication Flow

### OAuth2 Flow (Primary)
```
/api/auth/login -> OAuth provider -> /api/auth/callback -> JWT token
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

```typescript
export abstract class BaseService {
  protected db: PostgresDb;
  protected logger: FastifyBaseLogger;
  
  // Common CRUD operations
  protected async findOne<T>(table: string, conditions: object): Promise<T | null>
  protected async findMany<T>(table: string, conditions?: object): Promise<T[]>
  protected async create<T>(table: string, data: object): Promise<T>
  protected async update<T>(table: string, conditions: object, data: object): Promise<T>
  protected async delete(table: string, conditions: object): Promise<boolean>
  
  // Transaction support
  protected async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>
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
  userId, teamId, modelIds, metadata
});

// 2. Generate LiteLLM key
const litellmKey = await litellmService.generateKey({
  user_id: userId,
  team_id: teamId,
  models: modelIds,
  metadata: { ...metadata, db_key_id: dbKey.id }
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
  apiKey: { max: 10000, timeWindow: '1 minute' }
}
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
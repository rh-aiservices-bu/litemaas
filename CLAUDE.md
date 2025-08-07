# CLAUDE.md - LiteMaaS AI Context File

> **Note for AI Assistants**: This is a condensed context file for AI-powered development tools. For comprehensive documentation, see:
> - **API Documentation**: `docs/api/`
> - **Architecture**: `docs/architecture/`
> - **Development**: `docs/development/`
> - **Deployment**: `docs/deployment/`

## 🚀 Project Overview

**LiteMaaS** is a model subscription and management platform that bridges users and AI model services through LiteLLM integration.

## 🏗️ Architecture Overview

**Monorepo** with two packages:
- **Backend** (`@litemaas/backend`): Fastify API server
- **Frontend** (`@litemaas/frontend`): React + PatternFly 6 UI

### Tech Stack Summary
- **Backend**: Fastify, TypeScript, PostgreSQL, OAuth2/JWT, LiteLLM integration
- **Frontend**: React, TypeScript, Vite, PatternFly 6, React Router, React Query
- **Testing**: Vitest, Playwright, K6
- **i18n**: EN, ES, FR

## 📁 Project Structure

```
litemaas/
├── backend/                    # Fastify API Server
│   ├── src/
│   │   ├── config/            # Configuration modules
│   │   ├── middleware/        # Auth, error handling, CORS
│   │   ├── models/            # Database models (TypeScript interfaces)
│   │   ├── plugins/           # Fastify plugins (auth, db, swagger, etc.)
│   │   ├── routes/            # API endpoints (/auth, /users, /models, etc.)
│   │   ├── schemas/           # TypeBox validation schemas
│   │   ├── services/          # Business logic layer (with BaseService)
│   │   ├── types/             # TypeScript type definitions
│   │   ├── utils/             # Utility functions (validation, sync)
│   │   ├── app.ts            # Main Fastify application setup
│   │   └── index.ts          # Application entry point
│   ├── tests/
│   │   ├── fixtures/         # Test data and mocks
│   │   ├── integration/      # API integration tests
│   │   ├── performance/      # K6 load testing scripts
│   │   ├── security/         # Security and auth tests
│   │   └── unit/            # Unit tests for services
│   └── dist/                # Compiled JavaScript output
├── frontend/                  # React Application
│   ├── src/
│   │   ├── assets/           # Static assets (images, icons)
│   │   ├── components/       # Reusable React components
│   │   ├── config/           # App configuration (navigation)
│   │   ├── contexts/         # React Context providers
│   │   ├── hooks/            # Custom React hooks
│   │   ├── i18n/             # Internationalization setup
│   │   ├── pages/            # Page-level components
│   │   ├── routes/           # Routing configuration
│   │   ├── services/         # API service layer (Axios-based)
│   │   ├── types/            # TypeScript interfaces
│   │   └── utils/            # Utility functions
│   ├── public/              # Static public assets
│   └── dist/                # Vite build output
├── docs/                    # Project documentation
└── package.json            # Workspace configuration
```

## 🔧 Key Features

### Backend
- Fastify plugin architecture (auth, db, rate limiting, RBAC, swagger)
- OAuth2 + JWT authentication with API key support
- PostgreSQL database with migration system
- LiteLLM integration for model synchronization
- Budget management and usage tracking
- Team collaboration features with Default Team implementation
- **Refactored service layer** with BaseService inheritance pattern
- **Centralized utilities** for validation and LiteLLM synchronization

### Database Tables
`users`, `teams`, `models`, `subscriptions`, `api_keys`, `api_key_models`, `usage_logs`, `audit_logs`

> Added `api_key_models` junction table for multi-model API key support
> Added Default Team (`a0000000-0000-4000-8000-000000000001`) for reliable user existence detection

### API Routes Structure
- **OAuth Flow** (`/api/auth/*`): login, callback, logout - unversioned for provider compatibility
- **User Profile** (`/api/v1/auth/*`): me, profile - versioned API endpoints
- **Business API** (`/api/v1/*`): models, subscriptions, api-keys, teams, usage - all versioned

*See `docs/api/rest-api.md` for complete endpoint documentation*

## 🎨 Frontend
- React Context API for state (Auth, Notifications)
- React Query for server state management with intelligent caching
- Axios service layer with JWT interceptors
- PatternFly 6 components (`pf-v6-` prefix required)
- Main routes: `/home`, `/models`, `/subscriptions`, `/api-keys`, `/usage`, `/settings`

## 🎯 PatternFly 6 Integration

⚠️ **CRITICAL**: PatternFly 6 requires `pf-v6-` prefix for all classes. See [PATTERNFLY6_RULES.md](./PATTERNFLY6_RULES.md).

## 🚀 Quick Start

**Development:**
```bash
npm install        # Install dependencies
npm run dev        # Start both backend and frontend with auto-reload
```

> **Note**: In development, both backend and frontend servers run with auto-reload enabled. Any code changes are automatically detected and applied without needing to restart the servers.

**Production (OpenShift):**
```bash
oc apply -k deployment/openshift/  # Deploy to OpenShift/Kubernetes
```

**Development (Container):**
```bash
docker-compose up -d  # Local development with containers
```

*See `docs/development/` for detailed setup and `docs/deployment/configuration.md` for environment variables*

## 🔒 Security & Performance

- **Auth**: OAuth2 (OpenShift) + JWT + API keys + Development mock mode
- **Security**: Rate limiting, CORS, CSP, encrypted storage
- **Performance**: <200ms API response, <3s frontend load
- **i18n**: EN, ES, FR via react-i18next
- **CI/CD**: GitHub Actions, 80%+ coverage requirement

## 🔗 LiteLLM Integration

- **Model Sync**: Auto-sync from LiteLLM `/model/info` endpoint on startup
- **Budget Management**: User/team/subscription-level budgets with alerts
- **Rate Limiting**: TPM/RPM limits with burst capacity
- **Data Handling**: Graceful handling of missing data (returns `undefined`, UI shows "N/A")
- **Circuit Breaker**: Resilient API communication with mock data fallback
- **User Management**: Standardized user existence checking and creation across all services
- **Error Handling**: Graceful handling of "already exists" errors in user creation flows

*See `docs/architecture/litellm-integration.md` for details*

## 📝 Key Implementation Notes

### Default Team Implementation
- **Purpose**: Ensures all users belong to at least one team for proper LiteLLM integration
- **Default Team UUID**: `a0000000-0000-4000-8000-000000000001`
- **Key Feature**: Empty `allowed_models: []` array enables access to all models
- **Usage**: Automatically assigned to all new users during creation

### Multi-Model API Keys
> API keys now support multi-model access instead of single subscription binding

- **Architecture**: Many-to-many relationship between API keys and models via `api_key_models` junction table
- **Backward Compatibility**: Legacy subscription-based keys still work with deprecation warnings
- **Enhanced Features**: Budget limits, rate limiting, team support, metadata, and expiration per key
- **Migration Strategy**: Gradual transition with full compatibility maintained

### Subscription Management
- Browse models → Select → Subscribe (creates "active" status immediately)
- Self-service model: No approval workflow required
- Default quotas: 10K requests/month, 1M tokens/month
- Unique constraint: One subscription per user-model pair

### Model Data Mapping
```typescript
// LiteLLM → Database
model_name → id, name
litellm_params.custom_llm_provider → provider
model_info.max_tokens → context_length
model_info.input/output_cost_per_token → pricing
```

### API Key Management

#### Key Alias Uniqueness
- **Format**: `${userChosenName}_${8charUUID}` (e.g., `production-key_a5f2b1c3`)
- **Purpose**: Ensures global uniqueness for LiteLLM while preserving user-friendly names

### API Key Structure
```typescript
// Multi-model API key creation with proper LiteLLM format
{
  "modelIds": ["gpt-4", "gpt-3.5-turbo"],  // Multiple models per key
  "maxBudget": 500.00,                     // Per-key budget limits
  "tpmLimit": 2000,                        // Rate limiting
  "permissions": {...},                    // Fine-grained permissions
  "metadata": {...}                        // Custom metadata
}

// Response includes actual LiteLLM key
{
  "id": "key_123",
  "key": "sk-litellm-abcdef1234567890",    // Returns actual LiteLLM key
  "keyPrefix": "sk-litellm",               // Correct LiteLLM prefix  
  "isLiteLLMKey": true,                    // Indicates LiteLLM compatibility
  "models": ["gpt-4", "gpt-3.5-turbo"]
}

// LEGACY: Single subscription (still supported)
{
  "subscriptionId": "sub_123"              // Deprecated with warnings
}
```


## 📚 Documentation Structure

```
docs/
├── api/                    # API endpoints, schemas, examples
├── architecture/           # System design, services, integration
├── deployment/            # Configuration, environment setup, container deployment
├── development/           # Setup guide, testing, conventions
└── features/              # Feature-specific documentation
```

### Key Documentation Files
- `docs/api/rest-api.md` - Complete API reference with multi-model support
- `docs/api/api-migration-guide.md` - Multi-model API migration guide
- `docs/architecture/database-schema.md` - Database schema with multi-model tables
- `docs/features/multi-model-api-keys-implementation.md` - Implementation details
- `docs/features/default-team-implementation.md` - Default Team implementation and user existence detection
- `docs/features/authentication-flow.md` - OAuth flow and user creation with error handling fixes
- `docs/api/subscriptions-api.md` - Subscription endpoints
- `docs/api/model-sync-api.md` - Model synchronization
- `docs/architecture/services.md` - Service layer details with BaseService inheritance and utilities
- `docs/deployment/configuration.md` - Environment variables
- `docs/deployment/containers.md` - Container deployment guide with Docker/Podman
- `docs/development/README.md` - Development setup
- `PATTERNFLY6_RULES.md` - PatternFly 6 migration rules

## 🔨 Recent Backend Refactoring (2025-08-06)

### Refactoring Improvements
- **BaseService Abstract Class**: All services now extend BaseService, eliminating ~200+ lines of duplicate mock data handling code
- **LiteLLMSyncUtils**: Centralized user/team synchronization utilities, removing ~300+ lines of duplicate code
- **ValidationUtils**: Comprehensive validation utilities for consistent input validation across all services
- **Code Reduction**: ~25% reduction in duplicate code across the service layer
- **Improved Maintainability**: Services now follow DRY principle with shared base functionality

### New Utility Files
- `/backend/src/services/base.service.ts` - Abstract base class for all services
- `/backend/src/utils/litellm-sync.utils.ts` - LiteLLM synchronization utilities
- `/backend/src/utils/validation.utils.ts` - Input validation utilities

---

*This is an AI context file. For human-readable documentation, see the `docs/` directory.*
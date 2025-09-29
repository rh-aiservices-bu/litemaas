# Project Structure

This document provides a comprehensive overview of the LiteMaaS project structure, including all directories and key files across the monorepo.

## Overview

LiteMaaS is organized as a monorepo with two main packages:

- **Backend** (`@litemaas/backend`): Fastify API server
- **Frontend** (`@litemaas/frontend`): React + PatternFly 6 UI

## Complete Project Structure

```
litemaas/
├── backend/                    # Fastify API Server
│   ├── src/
│   │   ├── config/            # Configuration modules
│   │   │   └── database.ts    # Database connection config
│   │   ├── lib/               # Database utilities
│   │   │   └── database-migrations.ts # Database migration utilities
│   │   ├── middleware/        # Fastify middleware
│   │   │   ├── api-key-auth.ts # API key validation
│   │   │   ├── auth-hooks.ts  # Auth lifecycle hooks
│   │   │   └── error-handler.ts # Error handling
│   │   ├── plugins/           # Fastify plugins (registered in order)
│   │   │   ├── env.ts        # Environment variables
│   │   │   ├── database.ts   # PostgreSQL connection pool
│   │   │   ├── auth.ts       # JWT authentication
│   │   │   ├── oauth.ts      # OAuth2 provider
│   │   │   ├── session.ts    # Session management
│   │   │   ├── rbac.ts       # Role-based access control
│   │   │   ├── rate-limit.ts # Rate limiting
│   │   │   ├── swagger.ts    # API documentation
│   │   │   └── subscription-hooks.ts # Subscription lifecycle
│   │   ├── routes/            # API endpoints (flat structure)
│   │   │   ├── auth.ts       # OAuth flow endpoints (/api/auth)
│   │   │   ├── auth-user.ts  # User profile endpoints (/api/v1/auth)
│   │   │   ├── models.ts     # Model management (/api/v1/models)
│   │   │   ├── subscriptions.ts # Subscription CRUD (/api/v1/subscriptions)
│   │   │   ├── api-keys.ts   # API key management (/api/v1/api-keys)
│   │   │   ├── users.ts      # User management (/api/v1/users)
│   │   │   ├── admin.ts      # Admin endpoints (/api/v1/admin)
│   │   │   ├── usage.ts      # Usage tracking (/api/v1/usage)
│   │   │   ├── config.ts     # Configuration endpoints (/api/v1/config)
│   │   │   ├── health.ts     # Health check (/api/v1/health)
│   │   │   └── index.ts      # Route registration
│   │   ├── schemas/           # TypeBox validation schemas
│   │   │   ├── common.ts     # Common schemas (UUID, pagination)
│   │   │   ├── models.ts     # Model schemas
│   │   │   ├── subscriptions.ts # Subscription schemas
│   │   │   ├── api-keys.ts   # API key schemas
│   │   │   ├── auth.ts       # Authentication schemas
│   │   │   ├── users.ts      # User schemas
│   │   │   ├── usage.ts      # Usage schemas
│   │   │   ├── health.ts     # Health check schemas
│   │   │   └── index.ts      # Schema exports
│   │   ├── services/          # Business logic layer
│   │   │   ├── base.service.ts # Base service class (inheritance pattern)
│   │   │   ├── api-key.service.ts # API key operations
│   │   │   ├── default-team.service.ts # Default team management
│   │   │   ├── litellm.service.ts # LiteLLM API client
│   │   │   ├── litellm-integration.service.ts # LiteLLM integration layer
│   │   │   ├── model-sync.service.ts # Model synchronization
│   │   │   ├── oauth.service.ts # OAuth provider integration
│   │   │   ├── rbac.service.ts # Role-based access control
│   │   │   ├── session.service.ts # Session management
│   │   │   ├── subscription.service.ts # Subscription management
│   │   │   ├── team.service.ts # Team operations
│   │   │   ├── token.service.ts # Token generation and validation
│   │   │   └── usage-stats.service.ts # Usage analytics
│   │   ├── types/             # TypeScript definitions
│   │   │   ├── fastify.ts    # Fastify decorators
│   │   │   ├── api-key.types.ts # API key types
│   │   │   ├── auth.types.ts # Authentication types
│   │   │   ├── common.types.ts # Common types
│   │   │   ├── model.types.ts # Model types
│   │   │   ├── subscription.types.ts # Subscription types
│   │   │   ├── usage.types.ts # Usage types
│   │   │   ├── user.types.ts # User types
│   │   │   └── index.ts      # Type exports
│   │   ├── utils/             # Utility functions
│   │   │   ├── validation.utils.ts # Input validation helpers
│   │   │   └── litellm-sync.utils.ts # LiteLLM sync utilities
│   │   ├── validators/        # Input validators
│   │   │   └── usage.validator.ts # Usage tracking validation
│   │   ├── app.ts            # Fastify app configuration
│   │   └── index.ts          # Server entry point
│   ├── tests/
│   │   ├── fixtures/         # Test data and mocks
│   │   ├── integration/      # API integration tests
│   │   ├── performance/      # K6 load testing
│   │   ├── security/         # Auth and security tests
│   │   └── unit/            # Service unit tests
│   └── dist/                # TypeScript build output
├── frontend/                  # React Application
│   ├── src/
│   │   ├── assets/           # Static assets
│   │   │   ├── images/       # Images and logos
│   │   │   └── icons/        # Custom icons
│   │   ├── components/        # Reusable components
│   │   │   ├── charts/       # Chart components (AccessibleChart, etc.)
│   │   │   ├── AlertToastGroup.tsx # Toast notifications
│   │   │   ├── ComponentErrorBoundary.tsx # Component-level error handling
│   │   │   ├── ErrorBoundary.tsx # Global error handling
│   │   │   ├── Layout.tsx    # Main app layout
│   │   │   ├── NotificationDrawer.tsx # Notification UI
│   │   │   ├── ProtectedRoute.tsx # Auth route guard
│   │   │   ├── ScreenReaderAnnouncement.tsx # ARIA live regions
│   │   │   └── index.ts      # Component exports
│   │   ├── config/            # App configuration
│   │   │   └── navigation.ts # Navigation structure
│   │   ├── contexts/          # React Context providers
│   │   │   ├── AuthContext.tsx # Authentication state
│   │   │   └── NotificationContext.tsx # Notifications
│   │   ├── hooks/             # Custom React hooks
│   │   │   └── useAsyncError.ts # Async error handling hook
│   │   ├── i18n/              # Internationalization
│   │   │   ├── index.ts      # i18n configuration
│   │   │   └── locales/      # Translation files (9 languages)
│   │   │       ├── en/       # English
│   │   │       ├── es/       # Spanish
│   │   │       ├── fr/       # French
│   │   │       ├── de/       # German
│   │   │       ├── it/       # Italian
│   │   │       ├── ja/       # Japanese
│   │   │       ├── ko/       # Korean
│   │   │       ├── zh/       # Chinese
│   │   │       └── elv/      # Elvish
│   │   ├── pages/             # Page components (flat structure)
│   │   │   ├── HomePage.tsx  # Dashboard
│   │   │   ├── ModelsPage.tsx # Model catalog
│   │   │   ├── SubscriptionsPage.tsx # Subscription management
│   │   │   ├── ApiKeysPage.tsx # API key management
│   │   │   ├── AdminModelsPage.tsx # Admin model management with configuration testing
│   │   │   ├── UsagePage.tsx # Usage analytics
│   │   │   ├── ToolsPage.tsx    # Admin tools
│   │   │   ├── ChatbotPage.tsx # AI chatbot interface
│   │   │   ├── LoginPage.tsx # Authentication
│   │   │   └── AuthCallbackPage.tsx # OAuth callback
│   │   ├── routes/            # Routing configuration
│   │   │   └── index.tsx     # Route definitions
│   │   ├── services/          # API service layer
│   │   │   ├── api.ts        # Axios instance & interceptors
│   │   │   ├── auth.service.ts # Authentication API
│   │   │   ├── models.service.ts # Models API
│   │   │   ├── subscriptions.service.ts # Subscriptions API
│   │   │   ├── apiKeys.service.ts # API keys API
│   │   │   ├── usage.service.ts # Usage analytics API
│   │   │   ├── chat.service.ts # Chatbot API
│   │   │   ├── prompts.service.ts # Prompt management API
│   │   │   └── config.service.ts # Configuration API
│   │   ├── types/             # TypeScript interfaces
│   │   │   ├── auth.ts       # Auth types
│   │   │   ├── models.ts     # Model types
│   │   │   └── api.ts        # API response types
│   │   ├── utils/             # Utility functions
│   │   │   ├── formatters.ts # Data formatting
│   │   │   ├── validators.ts # Form validation
│   │   │   └── constants.ts  # App constants
│   │   ├── App.tsx           # Root component
│   │   ├── main.tsx          # Entry point
│   │   └── index.css         # Global styles
│   ├── public/               # Static public assets
│   ├── tests/               # Test files
│   └── dist/                # Build output
├── docs/                    # Project documentation
│   ├── api/                 # API endpoints, schemas, examples
│   ├── architecture/        # System design, services, integration
│   ├── deployment/          # Configuration, environment, containers
│   ├── development/         # Setup guide, testing, conventions
│   │   ├── accessibility/   # WCAG 2.1 AA compliance and testing
│   │   └── pf6-guide/      # PatternFly 6 authoritative guide
│   ├── features/            # Feature-specific documentation
│   └── archive/             # Historical documentation
├── dev-tools/               # Development utilities
│   └── run_with_stderr.sh  # Bash tool workaround script
├── deployment/              # Deployment configurations
│   └── openshift/          # OpenShift/Kubernetes manifests
├── .github/                # GitHub workflows and templates
├── package.json            # Workspace configuration
├── compose.yaml            # Docker Compose for development
├── CLAUDE.md               # AI assistant context (root)
├── CONTRIBUTING.md         # Contribution guidelines
└── README.md               # Project overview
```

## Key Directory Descriptions

### Backend (`backend/`)

#### Core Directories

- **`src/config/`** - Configuration modules for database connections and environment setup
- **`src/plugins/`** - Fastify plugins registered in specific order (env → database → auth → oauth → session → rbac → rate-limit → swagger → subscription-hooks)
- **`src/routes/`** - API endpoints organized by functionality, following flat structure
- **`src/services/`** - Business logic layer with BaseService inheritance pattern
- **`src/schemas/`** - TypeBox validation schemas for request/response validation
- **`src/types/`** - TypeScript type definitions and interfaces
- **`src/middleware/`** - Custom Fastify middleware for auth, error handling, etc.

#### Testing Structure

- **`tests/fixtures/`** - Test data, mocks, and sample payloads
- **`tests/integration/`** - API endpoint integration tests
- **`tests/unit/`** - Service layer unit tests
- **`tests/security/`** - Authentication and authorization tests
- **`tests/performance/`** - K6 load testing scripts

### Frontend (`frontend/`)

#### Core Directories

- **`src/components/`** - Reusable React components following PatternFly 6 standards
- **`src/pages/`** - Top-level page components (flat structure)
- **`src/services/`** - API service layer with Axios-based HTTP client
- **`src/contexts/`** - React Context providers for global state management
- **`src/hooks/`** - Custom React hooks for shared functionality
- **`src/i18n/`** - Internationalization setup supporting 9 languages

#### UI Architecture

- **`src/components/charts/`** - Accessible chart components for data visualization
- **`src/components/ErrorBoundary.tsx`** - Error isolation and recovery
- **`src/components/ScreenReaderAnnouncement.tsx`** - ARIA live regions for accessibility
- **`src/pages/AdminModelsPage.tsx`** - Admin interface with model configuration testing

### Documentation (`docs/`)

- **`api/`** - Complete API reference and integration guides
- **`architecture/`** - System design, database schema, service architecture
- **`deployment/`** - Production deployment guides and configuration
- **`development/`** - Development setup, conventions, and guidelines
- **`features/`** - Feature-specific documentation and implementation details
- **`archive/`** - Historical documentation and debug sessions

## Important Files

### Root Level

- **`CLAUDE.md`** - AI assistant context for project overview
- **`package.json`** - Monorepo workspace configuration
- **`compose.yaml`** - Docker Compose for local development
- **`dev-tools/run_with_stderr.sh`** - Workaround for Bash tool stderr limitation

### Backend Key Files

- **`src/app.ts`** - Main Fastify application setup and plugin registration
- **`src/index.ts`** - Server entry point and startup logic
- **`src/services/base.service.ts`** - Base service class with common CRUD operations
- **`src/plugins/rbac.ts`** - Role-based access control implementation

### Frontend Key Files

- **`src/App.tsx`** - Root React component with routing and providers
- **`src/main.tsx`** - Application entry point and React root mounting
- **`src/services/api.ts`** - Axios configuration with interceptors
- **`src/contexts/AuthContext.tsx`** - Authentication state management

## Navigation Tips

- **Backend development**: Start with `backend/CLAUDE.md` for specific implementation context
- **Frontend development**: Start with `frontend/CLAUDE.md` for UI development patterns
- **Complete documentation**: See `docs/README.md` for comprehensive guide index
- **API integration**: Review `docs/api/rest-api.md` for endpoint documentation
- **Deployment**: Check `docs/deployment/` for production deployment guides

## Related Documentation

- [Architecture Overview](overview.md) - High-level system design
- [Database Schema](database-schema.md) - Complete database structure
- [Development Setup](../development/setup.md) - Local development environment
- [API Documentation](../api/README.md) - Complete API reference

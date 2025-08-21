# CLAUDE.md - LiteMaaS AI Context File

> **Note for AI Assistants**: This is the root context file providing project overview. For detailed implementation context:
>
> - **Backend Context**: [`backend/CLAUDE.md`](backend/CLAUDE.md) - Fastify API implementation details
> - **Frontend Context**: [`frontend/CLAUDE.md`](frontend/CLAUDE.md) - React/PatternFly 6 implementation details
> - **Documentation**: See `docs/` for comprehensive guides

## 🚀 Project Overview

**LiteMaaS** is a model subscription and management platform that bridges users and AI model services through LiteLLM integration.

## 🏗️ Architecture Overview

**Monorepo** with two packages:

- **Backend** (`@litemaas/backend`): Fastify API server
- **Frontend** (`@litemaas/frontend`): React + PatternFly 6 UI

### Tech Stack Summary

- **Backend**: Fastify, TypeScript, PostgreSQL, OAuth2/JWT, RBAC, LiteLLM integration
- **Frontend**: React, TypeScript, Vite, PatternFly 6, React Router, React Query
- **Security**: Role-based access control with three-tier hierarchy (admin > adminReadonly > user)
- **Testing**: Vitest, Playwright, K6
- **i18n**: EN, ES, FR, DE, IT, JA, KO, ZH, ELV (9 languages)

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
│   │   ├── pages/            # Page-level components (including ChatbotPage)
│   │   ├── routes/           # Routing configuration
│   │   ├── services/         # API service layer (Axios-based, chat, prompts)
│   │   ├── types/            # TypeScript interfaces
│   │   └── utils/            # Utility functions
│   ├── public/              # Static public assets
│   └── dist/                # Vite build output
├── docs/                    # Project documentation
└── package.json            # Workspace configuration
```

## 🔧 Key Features

### Role-Based Access Control (RBAC)

**Three-Tier Hierarchy**: `admin > adminReadonly > user`

- **OpenShift Integration**: Automatic role assignment from OpenShift groups
- **Multi-Role Support**: Users can have multiple roles; most powerful determines access
- **Frontend Role Display**: User's most powerful role shown in navigation with translations
- **Admin Features**: Dedicated admin pages for user management and system operations
- **Audit Trail**: All admin actions logged for compliance and security

### Backend (`@litemaas/backend`)

- Fastify plugin architecture with PostgreSQL
- OAuth2 + JWT authentication with API key support
- **Role-based access control (RBAC)** with OpenShift group mapping
- **Administrative endpoints** for user and system management
- LiteLLM integration for model synchronization
- Multi-model API key support with budget management
- Team collaboration with Default Team pattern

_See [`backend/CLAUDE.md`](backend/CLAUDE.md) for implementation details_

### Frontend (`@litemaas/frontend`)

- React 18 with TypeScript and Vite
- PatternFly 6 component library (`pf-v6-` prefix required)
- **Role-based UI rendering** with conditional admin features
- **User role display** in navigation sidebar with translation support
- React Query for server state management
- AI Chatbot integration with conversation management
- Internationalization (9 languages supported)
- Responsive design with dark theme support
- WCAG 2.1 AA accessibility compliance

_See [`frontend/CLAUDE.md`](frontend/CLAUDE.md) for implementation details_

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
docker compose up -d  # Local development with containers (using compose.yaml)
```

_See `docs/development/` for detailed setup and `docs/deployment/configuration.md` for environment variables_

## 🚨 CRITICAL DEVELOPMENT NOTES

### Bash Tool Limitation

**⚠️ CRITICAL**: stderr redirects are broken in the Bash tool - you can't use `2>&1` in bash commands. The Bash tool will mangle the stderr redirect and pass a "2" as an arg, and you won't see stderr.

**Workaround**: Use the wrapper script: `./dev-tools/run_with_stderr.sh command args` to capture both stdout and stderr.

See <https://github.com/anthropics/claude-code/issues/4711> for details.

## 🔒 Security & Performance

### Authentication & Authorization

- **Auth**: OAuth2 (OpenShift) + JWT + API keys + Development mock mode
- **RBAC**: Three-tier role hierarchy with OpenShift group mapping:
  ```
  admin > adminReadonly > user
  ```
- **Role Assignment**: Automatic from OpenShift groups (`litemaas-admins`, `litemaas-readonly`, `litemaas-users`)
- **Multi-Role Support**: Users can have multiple roles; most powerful determines permissions
- **Resource Protection**: Role-based data access with admin oversight capabilities

### Security Features

- **API Endpoint Protection**: Role-based access control on all admin endpoints
- **Data Isolation**: Users can only access own resources; admins can access all
- **Audit Logging**: All admin actions and role changes logged
- **Rate Limiting**: Role-specific rate limits (higher for admins)
- **Security Headers**: CORS, CSP, encrypted storage

### Performance Targets

- **API Response**: <200ms (standard), <300ms (admin endpoints)
- **Frontend Load**: <3s initial, <1s role-based navigation updates
- **Testing**: Vitest, Playwright, K6 with 80%+ coverage requirement
- **CI/CD**: GitHub Actions for automated testing and deployment

## 🔗 Core Integration Points

### LiteLLM Integration

- Auto-sync models from LiteLLM `/model/info` endpoint
- Multi-model API key support with budget management
- Circuit breaker pattern for resilient communication
- Graceful fallback to mock data in development

### Authentication Flows

- **Production**: OAuth2 with OpenShift provider + role assignment from groups
- **Development**: Mock auth mode with configurable test user roles
- **API Keys**: LiteLLM-compatible key generation with user role inheritance

### Role-Based Features

#### Admin Capabilities (`admin` role)

- **User Management**: Create, update, deactivate users and assign roles
- **System Operations**: Model synchronization, global sync operations
- **Data Access**: View and modify all user resources
- **System Monitoring**: Access to system status, metrics, and health checks

#### Read-Only Admin (`adminReadonly` role)

- **System Visibility**: View all users, data, and system information
- **Monitoring Access**: System status, metrics, audit logs
- **No Modifications**: Cannot create, update, or delete resources
- **Reporting**: Access to usage analytics and system reports

#### Standard User (`user` role)

- **Personal Resources**: Manage own subscriptions, API keys, usage data
- **Self-Service**: Update profile, preferences, and settings
- **Model Access**: Subscribe to and use available AI models
- **Limited Scope**: Cannot view other users or system information

_For detailed implementation, see workspace-specific CLAUDE.md files_

## 📚 Documentation Structure

### AI Context Files (Start Here)

- **[`./CLAUDE.md`](CLAUDE.md)** - This file, project overview
- **[`backend/CLAUDE.md`](backend/CLAUDE.md)** - Backend implementation context
- **[`frontend/CLAUDE.md`](frontend/CLAUDE.md)** - Frontend implementation context

### Comprehensive Documentation

```
docs/
├── api/                    # API endpoints, schemas, examples
├── architecture/           # System design, services, integration
├── deployment/            # Configuration, environment, containers
├── development/           # Setup guide, testing, conventions
│   ├── accessibility/     # WCAG 2.1 AA compliance and testing
│   └── pf6-guide/        # PatternFly 6 authoritative guide
└── features/              # Feature-specific documentation
```

### Quick References

- **User Roles Guide**: `docs/features/user-roles-administration.md` - **RBAC system authority**
- **Authentication Setup**: `docs/deployment/authentication.md` - **OAuth & role configuration**
- **PatternFly 6**: `docs/development/pf6-guide/` - UI development authority
- **Accessibility Guide**: `docs/development/accessibility/` - WCAG 2.1 AA compliance
- **API Reference**: `docs/api/rest-api.md` - Complete endpoint documentation with role requirements
- **Database Schema**: `docs/architecture/database-schema.md` - Table structures
- **Environment Config**: `docs/deployment/configuration.md` - All env variables
- **Development Setup**: `docs/development/setup.md` - Getting started with admin user setup
- **Chatbot Implementation**: `docs/development/chatbot-implementation.md` - AI chat features

## 🎯 For AI Assistants

When working on:

- **Backend tasks** → Load `backend/CLAUDE.md` for Fastify/service details
- **Frontend tasks** → Load `frontend/CLAUDE.md` for React/PatternFly details
- **Role/Admin tasks** → Load `docs/features/user-roles-administration.md` for RBAC details
- **Authentication tasks** → Load `docs/deployment/authentication.md` for OAuth/role setup
- **Full-stack tasks** → Start with this file, then load specific contexts as needed

### Security Note for AI Assistants

⚠️ **Role-Based Development**: When implementing features that involve user roles or administrative functions:

1. **Always implement backend validation first** - Frontend role checks are UX only
2. **Use role hierarchy** - Check for most powerful role when multiple roles exist
3. **Follow data access patterns** - Users see own data, admins see all data
4. **Test with different roles** - Verify access control with user, adminReadonly, and admin accounts
5. **Document role requirements** - Clearly specify which roles can access new endpoints/features

---

_This is an AI context file optimized for development assistance. For comprehensive documentation, see the `docs/` directory._

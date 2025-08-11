# CLAUDE.md - LiteMaaS AI Context File

> **Note for AI Assistants**: This is the root context file providing project overview. For detailed implementation context:
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

### Backend (`@litemaas/backend`)
- Fastify plugin architecture with PostgreSQL
- OAuth2 + JWT authentication with API key support
- LiteLLM integration for model synchronization
- Multi-model API key support with budget management
- Team collaboration with Default Team pattern

*See [`backend/CLAUDE.md`](backend/CLAUDE.md) for implementation details*

### Frontend (`@litemaas/frontend`)
- React 18 with TypeScript and Vite
- PatternFly 6 component library (`pf-v6-` prefix required)
- React Query for server state management
- Internationalization (EN, ES, FR)
- Responsive design with dark theme support

*See [`frontend/CLAUDE.md`](frontend/CLAUDE.md) for implementation details*

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

## 🚨 CRITICAL DEVELOPMENT NOTES

### Bash Tool Limitation
**⚠️ CRITICAL**: stderr redirects are broken in the Bash tool - you can't use `2>&1` in bash commands. The Bash tool will mangle the stderr redirect and pass a "2" as an arg, and you won't see stderr.

**Workaround**: Use the wrapper script: `./dev-tools/run_with_stderr.sh command args` to capture both stdout and stderr.

See https://github.com/anthropics/claude-code/issues/4711 for details.



## 🔒 Security & Performance

- **Auth**: OAuth2 (OpenShift) + JWT + API keys + Development mock mode
- **Security**: Rate limiting, CORS, CSP, encrypted storage
- **Performance**: <200ms API response, <3s frontend load
- **Testing**: Vitest, Playwright, K6 with 80%+ coverage requirement
- **CI/CD**: GitHub Actions for automated testing and deployment

## 🔗 Core Integration Points

### LiteLLM Integration
- Auto-sync models from LiteLLM `/model/info` endpoint
- Multi-model API key support with budget management
- Circuit breaker pattern for resilient communication
- Graceful fallback to mock data in development

### Authentication Flows
- **Production**: OAuth2 with OpenShift provider
- **Development**: Mock auth mode for rapid development
- **API Keys**: LiteLLM-compatible key generation

*For detailed implementation, see workspace-specific CLAUDE.md files*


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
│   └── pf6-guide/        # PatternFly 6 authoritative guide
└── features/              # Feature-specific documentation
```

### Quick References
- **PatternFly 6**: `docs/development/pf6-guide/` - UI development authority
- **API Reference**: `docs/api/rest-api.md` - Complete endpoint documentation
- **Database Schema**: `docs/architecture/database-schema.md` - Table structures
- **Environment Config**: `docs/deployment/configuration.md` - All env variables
- **Development Setup**: `docs/development/README.md` - Getting started

## 🎯 For AI Assistants

When working on:
- **Backend tasks** → Load `backend/CLAUDE.md` for Fastify/service details
- **Frontend tasks** → Load `frontend/CLAUDE.md` for React/PatternFly details
- **Full-stack tasks** → Start with this file, then load specific contexts as needed

---

*This is an AI context file optimized for development assistance. For comprehensive documentation, see the `docs/` directory.*
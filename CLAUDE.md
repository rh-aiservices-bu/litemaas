# CLAUDE.md - LiteMaaS Project Documentation

## 🚀 Project Overview

**LiteMaaS** (LiteLLM User Application) is a comprehensive model subscription and management platform that provides a user-friendly interface for managing AI model subscriptions, API keys, and usage tracking. It's designed to work seamlessly with LiteLLM instances and serves as a bridge between users and AI model services.

## 🏗️ Architecture Overview

### Project Type
**Monorepo** using npm workspaces with two main packages:
- **Backend** (`@litemaas/backend`): High-performance Fastify-based API server
- **Frontend** (`@litemaas/frontend`): Modern React application with PatternFly 6 UI

### Technology Stack

#### Backend Stack
- **Framework**: Fastify 4.26.1 (high-performance Node.js web framework)
- **Language**: TypeScript 5.3.3 with strict mode
- **Database**: PostgreSQL with @fastify/postgres
- **Authentication**: OAuth2 (OpenShift) + JWT tokens
- **API Docs**: Swagger/OpenAPI with @fastify/swagger
- **Security**: Helmet, CORS, Rate limiting, JWT
- **Validation**: @sinclair/typebox with Fastify Type Provider
- **Testing**: Vitest (unit/integration), K6 (performance)
- **Logging**: Pino structured logging

#### Frontend Stack
- **Framework**: React 18.2.0 with TypeScript 5.3.3
- **Build Tool**: Vite 5.1.4
- **UI Framework**: PatternFly 6 (Red Hat's design system)
- **State Management**: React Context API
- **Routing**: React Router v6.22.1
- **HTTP Client**: Axios with interceptors
- **i18n**: react-i18next (EN, ES, FR)
- **Testing**: Vitest + React Testing Library + Playwright

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
│   │   ├── services/          # Business logic layer
│   │   ├── types/             # TypeScript type definitions
│   │   ├── utils/             # Utility functions
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

## 🔧 Backend Architecture

### Core Components

#### Plugin System
- **Authentication Plugin**: JWT + OAuth2 (OpenShift SSO)
- **Database Plugin**: PostgreSQL with connection pooling
- **Rate Limiting Plugin**: API protection and throttling
- **Session Plugin**: OAuth state management
- **RBAC Plugin**: Role-based access control
- **Swagger Plugin**: Auto-generated API documentation
- **Security Plugin**: Helmet, CORS, CSP headers

#### API Routes (prefix: `/api`)
- `/auth` - Authentication and OAuth flows
- `/users` - User management and profiles
- `/models` - AI model registry and metadata
- `/subscriptions` - User subscription management
- `/api-keys` - API key generation and validation
- `/teams` - Team management and collaboration
- `/integration` - LiteLLM integration and synchronization
- `/usage` - Usage tracking and analytics
- `/health` - System health checks

#### Service Layer
- **ApiKeyService**: API key lifecycle management with LiteLLM integration
- **LiteLLMService**: Core integration with LiteLLM instances
- **LiteLLMIntegrationService**: Centralized synchronization and orchestration
- **TeamService**: Team management with budget tracking
- **OAuthService**: OAuth2 authentication flows
- **RBACService**: Permission and role management
- **SessionService**: Session state management
- **SubscriptionService**: Model subscription logic with LiteLLM sync
- **TokenService**: JWT token management
- **UsageStatsService**: Usage analytics and reporting

### Database Schema
PostgreSQL tables:
- `users` - User accounts with OAuth integration and LiteLLM synchronization
- `teams` - Team management with budget tracking and LiteLLM integration
- `models` - AI model registry and metadata synchronized with LiteLLM
- `subscriptions` - User model subscriptions with enhanced budget and rate limiting
- `api_keys` - API access keys with LiteLLM integration and budget tracking
- `usage_logs` - Detailed usage tracking with cost calculation
- `audit_logs` - Security and admin audit trail including sync operations

### Security Features
- Multi-layered authentication (JWT + OAuth2 + API keys)
- Rate limiting and request throttling
- CORS protection with configurable origins
- Security headers via Helmet.js
- Request ID tracking for audit trails
- Development mode bypass for testing

## 🎨 Frontend Architecture

### Component Architecture
- **Pages**: Route-level components (`/pages`)
- **Components**: Reusable UI components (`/components`)
- **Layouts**: Page layout wrappers
- **Forms**: Form components with validation

### State Management
- **AuthContext**: User authentication state
- **NotificationContext**: App-wide notifications
- No external state libraries - uses React Context API

### Routing Structure
- `/home` - Dashboard and overview
- `/models` - Browse available models
- `/subscriptions` - Manage model subscriptions
- `/api-keys` - API key management
- `/usage` - Usage analytics and reports
- `/settings` - User settings and preferences
- `/login` - Authentication page

### API Integration
- Centralized Axios client with interceptors
- Automatic JWT token handling
- Service layer pattern for API calls
- Error handling and retry logic

## 🎯 PatternFly 6 Integration

⚠️ **IMPORTANT**: This project uses PatternFly 6. For detailed PatternFly 6 rules, guidelines, and migration instructions, see **[PATTERNFLY6_RULES.md](./PATTERNFLY6_RULES.md)**.

### Key Requirements
- **Class Prefixes**: All classes MUST use `pf-v6-` prefix
- **Design Tokens**: Use semantic tokens instead of CSS variables
- **Units**: Rem-based breakpoints (divide pixels by 16)
- **Dark Theme**: Support via `pf-v6-theme-dark` class

### Components Used
- `@patternfly/react-core`: Main component library
- `@patternfly/react-charts`: Data visualization
- `@patternfly/react-icons`: Icon library
- `@patternfly/react-table`: Advanced table components

## 🚀 Development Workflow

### Environment Setup
```bash
# Install dependencies
npm install

# Start development (both backend and frontend)
npm run dev

# Backend only (http://localhost:8080)
npm run dev:backend

# Frontend only (http://localhost:3000)
npm run dev:frontend
```

### Environment Variables
#### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/litemaas

# OAuth (OpenShift)
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_ISSUER_URL=https://your-openshift-instance

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# LiteLLM Integration
LITELLM_API_URL=http://localhost:4000
LITELLM_API_KEY=your-litellm-key
LITELLM_AUTO_SYNC=true
LITELLM_SYNC_INTERVAL=60
LITELLM_CONFLICT_RESOLUTION=litellm_wins

# Security
ADMIN_API_KEYS=key1,key2,key3
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:8080
VITE_OAUTH_CLIENT_ID=your-client-id
VITE_APP_NAME=LiteMaaS
VITE_APP_VERSION=1.0.0
```

### Testing Strategy
- **Unit Tests**: Service logic and utilities
- **Integration Tests**: API endpoints and database
- **E2E Tests**: User workflows with Playwright
- **Performance Tests**: Load testing with K6
- **Security Tests**: Authentication and authorization

### Build Process
```bash
# Build both packages
npm run build

# Test all packages
npm run test

# Lint and format
npm run lint
npm run format
```

## 🔒 Security Considerations

### Authentication Flow
1. User initiates OAuth2 flow with OpenShift
2. Backend handles OAuth callback and exchanges code
3. JWT token issued for subsequent API calls
4. API keys generated for programmatic access with LiteLLM integration
5. Budget and rate limiting enforced at multiple levels

### Security Headers
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

### Data Protection
- Sensitive data encrypted at rest
- API keys hashed before storage
- Audit logging for all admin actions and sync operations
- Rate limiting to prevent abuse
- Budget enforcement to prevent cost overruns
- Circuit breaker pattern for external API resilience

## 📊 Performance Characteristics

### Backend Performance
- Fastify provides 2x+ performance over Express
- Connection pooling for database efficiency
- Response time targets: <200ms for API calls
- Memory usage: <500MB under normal load

### Frontend Performance
- Vite for fast development and builds
- Code splitting for optimal bundle sizes
- PatternFly components are tree-shakeable
- Target: <3s load time on 3G networks

## 🔄 CI/CD Pipeline

### GitHub Actions
- Node.js 18.x and 20.x testing matrix
- PostgreSQL service for integration tests
- Code coverage with Codecov
- Automated linting and type checking
- Security scanning with npm audit

### Quality Gates
- All tests must pass
- Code coverage >80%
- No high-severity security vulnerabilities
- TypeScript compilation without errors
- Linting passes without warnings

## 🌐 Internationalization

### Supported Languages
- English (default)
- Spanish (es)
- French (fr)

### i18n Implementation
- react-i18next for React components
- Browser language detection
- LocalStorage for user preference
- Namespace organization by feature

## 🔗 LiteLLM Integration

### Core Integration Features
- **Bidirectional Synchronization**: Two-way sync between LiteMaaS and LiteLLM
- **Budget Management**: Per-user, per-team, and per-subscription budget tracking
- **Rate Limiting**: Configurable TPM (tokens per minute) and RPM (requests per minute) limits
- **Team Management**: Multi-tenant team support with shared budgets
- **Auto-Sync**: Configurable automatic synchronization with conflict resolution

### Integration Architecture
- **LiteLLMService**: Core API integration layer
- **LiteLLMIntegrationService**: Centralized sync orchestration
- **Enhanced Data Models**: Extended types with LiteLLM compatibility
- **Circuit Breaker**: Resilient API communication with fallback strategies

### Synchronization Features
- **Global Sync**: System-wide synchronization of all entities
- **Selective Sync**: Sync specific users, teams, or subscriptions
- **Conflict Resolution**: Configurable strategies (LiteLLM wins, LiteMaaS wins, merge)
- **Health Monitoring**: Integration health checks and alerting
- **Audit Trail**: Complete sync operation logging

### Budget and Rate Limiting
- **Multi-Level Budgets**: User, team, and subscription-level budget controls
- **Usage Tracking**: Real-time spend monitoring and alerts
- **Rate Limiting**: TPM/RPM limits with burst capacity
- **Budget Alerts**: Automated alerts at configurable thresholds
- **Cost Calculation**: Accurate cost tracking with pricing models

## 📈 Usage Analytics

### Metrics Tracked
- API calls per user/model
- Token consumption and costs
- Response times and latencies
- Error rates and failure patterns
- User engagement patterns
- Budget utilization and spending

### Analytics Features
- Real-time usage dashboards
- Historical usage reports
- Cost tracking and billing
- Usage quotas and limits
- Team-based analytics
- Integration health monitoring

## 🛠️ Development Commands

```bash
# Development
npm run dev                    # Start both backend and frontend
npm run dev:backend           # Backend only
npm run dev:frontend          # Frontend only

# Building
npm run build                 # Build both packages
npm run build:backend         # Backend only
npm run build:frontend        # Frontend only

# Testing
npm run test                  # All tests
npm run test:backend          # Backend tests only
npm run test:frontend         # Frontend tests only
npm run test:e2e             # End-to-end tests

# Code Quality
npm run lint                  # Lint all code
npm run format               # Format code
npm run type-check           # TypeScript checking

# Database
npm run db:migrate           # Run database migrations
npm run db:seed              # Seed test data

# Utilities
npm run check-backend        # Backend health check
npm run clean               # Clean build artifacts
```

## 📚 Additional Resources

### Documentation
- [Fastify Documentation](https://www.fastify.io/docs/)
- [React Documentation](https://react.dev/)
- [PatternFly 6 Upgrade Guide](https://www.patternfly.org/get-started/upgrade/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### API Documentation
- Swagger UI: http://localhost:8080/docs (when backend running)
- OpenAPI spec: http://localhost:8080/docs/json

---

*This documentation is automatically updated to reflect the current project state. Last updated based on project analysis.*
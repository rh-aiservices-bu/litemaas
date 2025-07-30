# System Architecture

**Last Updated**: 2025-07-30 - Default team implementation completed

## Overview

LiteMaaS follows a microservices architecture with clear separation between frontend and backend services, utilizing OpenShift OAuth for authentication and deep integration with LiteLLM for model management, budget tracking, and usage analytics.

### Recent Architecture Updates (2025-07-30)
- ✅ **Default Team Implementation**: Comprehensive team-based user management across all services
- ✅ **User Existence Detection**: Team-based validation replacing unreliable HTTP status checking
- ✅ **Model Access Control**: Fixed hardcoded restrictions, enabled all-model access via empty arrays
- ✅ **Service Standardization**: Consistent error handling and user creation patterns across all services

## High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend ├─────┤ Fastify Backend ├─────┤    LiteLLM      │
│  (PatternFly 6) │     │   (Node.js)     │     │    Instance     │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼───┐  ┌─────▼─────┐  ┌──▼──────────┐
            │           │  │           │  │             │
            │PostgreSQL │  │ OpenShift │  │   Redis     │
            │ Database  │  │   OAuth   │  │   Cache     │
            │           │  │           │  │             │
            └───────────┘  └───────────┘  └─────────────┘
```

## Component Details

### Frontend (React + PatternFly)
- **Purpose**: User interface for model discovery, subscription, and usage monitoring
- **Technology**: React 18, TypeScript, PatternFly 6, Vite
- **Key Features**:
  - SPA with client-side routing
  - OAuth integration for authentication
  - Real-time usage statistics
  - Responsive design

### Backend (Fastify)
- **Purpose**: API server handling business logic and LiteLLM integration
- **Technology**: Fastify, TypeScript, Node.js
- **Key Features**:
  - RESTful API with OpenAPI documentation
  - JWT-based authentication
  - Multi-level budget and rate limiting
  - Bidirectional LiteLLM synchronization
  - Team management and collaboration
  - Real-time cost tracking and analytics

### Database (PostgreSQL)
- **Purpose**: Persistent storage for user data, teams, subscriptions, and cost analytics
- **Schema**: Users, Teams, Subscriptions, API Keys, Usage Metrics with Cost Tracking
- **Features**:
  - Transaction support
  - JSON data types for flexible model metadata
  - Partitioned tables for high-volume usage logs
  - LiteLLM synchronization metadata
  - Multi-level budget and spend tracking
  - Indexes for performance

### Cache (Redis)
- **Purpose**: Session storage and caching layer
- **Use Cases**:
  - User sessions
  - Model list caching
  - Rate limiting counters
  - Temporary API responses

### External Services

#### OpenShift OAuth Provider
- **Purpose**: Enterprise authentication
- **Integration**: OAuth 2.0 flow
- **User Info**: Retrieves user profile and groups

#### LiteLLM Instance
- **Purpose**: AI model proxy with budget management
- **Integration**: Bidirectional REST API synchronization
- **Features**: 
  - Model listing and metadata
  - Completion requests with cost tracking
  - User and team budget management
  - Rate limiting (TPM/RPM)
  - API key generation and management
  - Real-time usage analytics

## LiteLLM Integration Architecture

### Integration Layers
```
┌─────────────────────────────────────────────────────────────┐
│                    LiteMaaS Backend                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│ LiteLLM         │ Team            │ LiteLLM Integration     │
│ Service         │ Service         │ Service                 │
├─────────────────┼─────────────────┼─────────────────────────┤
│ API Key         │ Subscription    │ Enhanced Data Models    │
│ Service         │ Service         │ with Sync Metadata     │
└─────────────────┴─────────────────┴─────────────────────────┘
                            │
                    ┌───────┼───────┐
                    │       │       │
        ┌───────────▼───┐   │   ┌───▼─────────┐
        │               │   │   │             │
        │  PostgreSQL   │   │   │  LiteLLM    │
        │  Database     │   │   │  Instance   │
        │               │   │   │             │
        └───────────────┘   │   └─────────────┘
                            │
                    ┌───────▼───────┐
                    │               │
                    │ Sync & Health │
                    │  Monitoring   │
                    │               │
                    └───────────────┘
```

### Synchronization Strategy
- **Bidirectional Sync**: Changes flow both directions between LiteMaaS and LiteLLM
- **Conflict Resolution**: Configurable strategies (LiteLLM wins, LiteMaaS wins, merge)
- **Circuit Breaker**: Resilient communication with automatic fallback
- **Health Monitoring**: Continuous integration health checks
- **Audit Trail**: Complete sync operation logging
- ✅ **Default Team Integration**: All user operations include mandatory team assignment
- ✅ **User Existence Detection**: Team-based validation (`teams` array) instead of HTTP status

### Default Team Architecture (Implemented 2025-07-30)

**Core Problem Solved**: LiteLLM's `/user/info` endpoint always returns HTTP 200, making user existence detection unreliable.

**Solution**: Team-based user validation using the `teams` array as the source of truth.

#### Default Team Strategy
```
Default Team (UUID: a0000000-0000-4000-8000-000000000001)
├── All users automatically assigned during creation
├── Empty models array = access to all models
├── Serves as existence indicator for LiteLLM validation  
└── Foundation for future team management features
```

#### Service Integration Pattern
```typescript
// Standard pattern across all services:
1. await this.defaultTeamService.ensureDefaultTeamExists()
2. User creation with teams: [DefaultTeamService.DEFAULT_TEAM_ID]
3. Validation via teams array (empty = doesn't exist)
4. Graceful "already exists" error handling
```

#### Implementation Coverage
- ✅ **SubscriptionService**: Lines 1584-1706, 1748-1761
- ✅ **ApiKeyService**: Line 1869 (fixed hardcoded models)
- ✅ **OAuthService**: Line 321 (team existence check)
- ✅ **LiteLLMIntegrationService**: Lines 497, 536 (bulk sync)
- ✅ **LiteLLMService**: Lines 699, 728 (mock responses)

### Budget Management Hierarchy
```
Organization Level
├── Team Budgets (shared across team members)
│   ├── User Budgets (individual limits within team)
│   └── Subscription Budgets (per-model limits)
│       └── API Key Budgets (granular access control)
```

### Data Flow Architecture
1. **User Actions** → LiteMaaS API → Database Updates
2. **Sync Process** → LiteLLM API Updates → Bidirectional Synchronization
3. **Usage Events** → LiteLLM → Usage Logs → Cost Calculation
4. **Budget Monitoring** → Real-time Alerts → Automated Actions

## Security Architecture

### Authentication Flow
```
User → Frontend → OAuth Redirect → OpenShift → Callback → Backend → JWT → Frontend
```

### API Security
- JWT tokens for API authentication
- Rate limiting per user/API key
- CORS configuration
- Helmet.js for security headers
- Input validation with JSON Schema

### Data Security
- Encryption at rest (PostgreSQL)
- Encryption in transit (TLS)
- Sensitive data masking in logs
- API key hashing

## Deployment Architecture

### Kubernetes/OpenShift
```
Namespace: litemaas
├── Deployments
│   ├── frontend (3 replicas)
│   ├── backend (3 replicas)
│   └── redis (1 replica)
├── Services
│   ├── frontend-svc
│   ├── backend-svc
│   └── redis-svc
├── Routes/Ingress
│   ├── app.litemaas.com → frontend
│   └── api.litemaas.com → backend
├── ConfigMaps
│   ├── frontend-config
│   └── backend-config
└── Secrets
    ├── oauth-credentials
    ├── jwt-secret
    └── database-credentials
```

## Scalability Considerations

### Horizontal Scaling
- Stateless backend services
- Redis for session distribution
- Database connection pooling
- Load balancing via OpenShift

### Performance Optimization
- Frontend: Code splitting, lazy loading
- Backend: Response caching, query optimization
- Database: Indexes, partitioning for metrics
- CDN for static assets

## Monitoring & Observability

### Metrics (Prometheus)
- Application metrics (response times, error rates)
- Business metrics (subscriptions, API usage)
- Infrastructure metrics (CPU, memory, disk)

### Logging (ELK Stack)
- Structured JSON logging
- Request/response logging
- Error tracking
- Audit trails

### Tracing (Jaeger)
- Distributed request tracing
- Performance bottleneck identification
- Service dependency mapping

## Disaster Recovery

### Backup Strategy
- Database: Daily automated backups
- Configuration: Version controlled
- Secrets: Encrypted backups

### High Availability
- Multi-zone deployment
- Database replication
- Redis sentinel for failover
- Health checks and auto-recovery
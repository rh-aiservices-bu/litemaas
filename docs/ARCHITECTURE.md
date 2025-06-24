# System Architecture

## Overview

LiteMaaS follows a microservices architecture with clear separation between frontend and backend services, utilizing OpenShift OAuth for authentication and LiteLLM as the model provider.

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
- **Purpose**: API server handling business logic and integrations
- **Technology**: Fastify, TypeScript, Node.js
- **Key Features**:
  - RESTful API with OpenAPI documentation
  - JWT-based authentication
  - Rate limiting and quota management
  - LiteLLM proxy

### Database (PostgreSQL)
- **Purpose**: Persistent storage for user data, subscriptions, and usage metrics
- **Schema**: Users, Subscriptions, API Keys, Usage Metrics
- **Features**:
  - Transaction support
  - JSON data types for flexible model metadata
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
- **Purpose**: Model provider and proxy
- **Integration**: REST API
- **Features**: Model listing, completion requests, usage tracking

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
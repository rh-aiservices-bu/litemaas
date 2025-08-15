# System Architecture

## Overview

LiteMaaS follows a microservices architecture with clear separation between frontend and backend services, utilizing OAuth2 for authentication and deep integration with LiteLLM for model management, budget tracking, and usage analytics.

## High-Level Architecture

```mermaid
graph TB
    subgraph "User Layer"
        Browser[Web Browser]
        API[API Clients]
    end

    subgraph "Frontend Layer"
        React[React SPA<br/>PatternFly 6 UI]
        Static[Static Assets<br/>JS, CSS, Images]
    end

    subgraph "Backend Services"
        Fastify[Fastify API Server<br/>Node.js + TypeScript]
        Auth[Auth Service<br/>OAuth2 + JWT]
        Workers[Background Workers<br/>Sync & Cleanup]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Primary Database)]
    end

    subgraph "External Services"
        LiteLLM[LiteLLM Gateway<br/>Model Proxy]
        OAuth[OAuth Provider<br/>OpenShift/Custom]
        Models[AI Models<br/>GPT-4, Claude, etc.]
    end

    Browser --> React
    API --> Fastify
    React --> Fastify
    Fastify --> Auth
    Fastify --> PG
    Auth --> OAuth
    Fastify --> LiteLLM
    LiteLLM --> Models
    Workers --> PG
    Workers --> LiteLLM

    style React fill:#61dafb,stroke:#333,stroke-width:2px
    style Fastify fill:#000000,stroke:#333,stroke-width:2px,color:#fff
    style PG fill:#336791,stroke:#333,stroke-width:2px,color:#fff
    style LiteLLM fill:#7c3aed,stroke:#333,stroke-width:2px,color:#fff
```

## Container Architecture

In production and containerized deployments, NGINX serves as the single entry point:

```mermaid
graph TB
    subgraph "External Traffic"
        User[User Browser]
        OAuth[OAuth Provider]
    end

    subgraph "Container Stack"
        NGINX[NGINX<br/>Port 8080<br/>Entry Point]
        Backend[Backend API<br/>Port 8081<br/>Business Logic]
        Frontend[Frontend SPA<br/>Static Files<br/>Served by NGINX]
        DB[(PostgreSQL<br/>Database)]
        LiteLLM[LiteLLM<br/>Service]
    end

    User -->|HTTPS| NGINX
    NGINX -->|/api/*| Backend
    NGINX -->|/*| Frontend
    Backend <--> DB
    Backend <--> LiteLLM
    Backend <--> OAuth

    style NGINX fill:#f9f,stroke:#333,stroke-width:4px
    style Backend fill:#bbf,stroke:#333,stroke-width:2px
    style Frontend fill:#bfb,stroke:#333,stroke-width:2px
```

### Key Architectural Principles

1. **Single Entry Point**: NGINX handles all external traffic
2. **API Separation**: `/api/*` routes proxied to backend
3. **Static File Serving**: Frontend SPA served directly by NGINX
4. **Environment Agnostic**: Relative redirects enable deployment flexibility
5. **Secure by Default**: No direct backend exposure

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

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant DB as PostgreSQL
    participant LiteLLM
    participant AI as AI Models

    User->>Frontend: Browse Models
    Frontend->>Backend: GET /api/v1/models
    Backend->>DB: Query models table
    Backend->>Frontend: Return model list

    User->>Frontend: Subscribe to Model
    Frontend->>Backend: POST /api/v1/subscriptions
    Backend->>DB: Create subscription
    Backend->>LiteLLM: Sync user/budget
    Backend->>Frontend: Subscription created

    User->>Frontend: Create API Key
    Frontend->>Backend: POST /api/v1/api-keys
    Backend->>LiteLLM: Generate key
    LiteLLM->>Backend: Return key + token
    Backend->>DB: Store key metadata
    Backend->>Frontend: Return API key

    User->>AI: Use API key
    AI->>LiteLLM: Validate & track
    LiteLLM->>LiteLLM: Update usage

    Backend->>LiteLLM: Sync usage (periodic)
    LiteLLM->>Backend: Usage data
    Backend->>DB: Update metrics
```

## Service Layer Architecture

```mermaid
graph TB
    subgraph "API Routes"
        AuthRoute["/api/auth/*"]
        UserRoute["/api/v1/users/*"]
        ModelRoute["/api/v1/models/*"]
        SubRoute["/api/v1/subscriptions/*"]
        KeyRoute["/api/v1/api-keys/*"]
        UsageRoute["/api/v1/usage/*"]
    end

    subgraph "Service Layer"
        AuthService[Auth Service]
        UserService[User Service]
        ModelService[Model Service]
        SubService[Subscription Service]
        KeyService[API Key Service]
        UsageService[Usage Service]
        LiteLLMService[LiteLLM Service]
        TeamService[Default Team Service]
    end

    subgraph "Data Access"
        DB[(PostgreSQL)]
        LiteLLM[LiteLLM API]
    end

    AuthRoute --> AuthService
    UserRoute --> UserService
    ModelRoute --> ModelService
    SubRoute --> SubService
    KeyRoute --> KeyService
    UsageRoute --> UsageService

    AuthService --> Cache
    UserService --> DB
    ModelService --> DB
    SubService --> DB
    SubService --> LiteLLMService
    KeyService --> DB
    KeyService --> LiteLLMService
    UsageService --> DB
    UsageService --> LiteLLMService
    LiteLLMService --> LiteLLM

    UserService --> TeamService
    SubService --> TeamService
    KeyService --> TeamService

    style LiteLLMService fill:#e1bee7
    style TeamService fill:#c5e1a5
```

## Security Architecture

```mermaid
graph TB
    subgraph "Authentication Flow"
        User[User]
        OAuth[OAuth Provider]
        JWT[JWT Token]
        Session[Session Store]
    end

    subgraph "Authorization Layers"
        RouteAuth[Route Guards]
        ServiceAuth[Service Layer Auth]
        DataAuth[Data Access Control]
    end

    subgraph "API Security"
        RateLimit[Rate Limiting]
        CORS[CORS Policy]
        CSP[Content Security]
        Audit[Audit Logging]
    end

    User --> OAuth
    OAuth --> JWT
    JWT --> Session
    JWT --> RouteAuth
    RouteAuth --> ServiceAuth
    ServiceAuth --> DataAuth

    RouteAuth --> RateLimit
    RouteAuth --> CORS
    RouteAuth --> CSP
    ServiceAuth --> Audit

    style OAuth fill:#ffccbc
    style JWT fill:#d7ccc8
    style Audit fill:#b0bec5
```

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

## OAuth Authentication Flow

The OAuth flow is central to LiteMaaS security and works differently in development vs containerized environments:

### Development Environment Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Fastify
    participant OAuth
    participant DB

    User->>Browser: Click Login
    Browser->>Fastify: POST /api/auth/login
    Fastify->>Browser: Return OAuth URL
    Browser->>OAuth: Redirect to OAuth
    User->>OAuth: Authenticate
    OAuth->>Fastify: Callback with code
    Fastify->>OAuth: Exchange code
    OAuth->>Fastify: Return token
    Fastify->>DB: Create/update user
    Fastify->>Browser: Redirect /auth/callback
    Note over Browser: Same origin redirect
```

### Container/Production Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant NGINX
    participant Backend
    participant OAuth
    participant DB

    User->>Browser: Click Login
    Browser->>NGINX: POST /api/auth/login
    NGINX->>Backend: Proxy request
    Backend->>NGINX: Return OAuth URL
    NGINX->>Browser: Return OAuth URL
    Browser->>OAuth: Redirect to OAuth
    User->>OAuth: Authenticate

    Note over OAuth: Callback configured as<br/>https://app.com/api/auth/callback

    OAuth->>Browser: Redirect to callback
    Browser->>NGINX: GET /api/auth/callback
    NGINX->>Backend: Proxy to backend
    Backend->>OAuth: Exchange code
    OAuth->>Backend: Return token
    Backend->>DB: Create/update user
    Backend->>NGINX: 302 /auth/callback
    NGINX->>Browser: 302 Redirect
    Browser->>NGINX: GET /auth/callback
    NGINX->>Browser: Serve SPA
    Note over Browser: Frontend extracts token
```

### OAuth Configuration Requirements

| Component      | Configuration                                | Purpose                                |
| -------------- | -------------------------------------------- | -------------------------------------- |
| OAuth Provider | Redirect URI: `<base-url>/api/auth/callback` | Where to send user after auth          |
| Backend        | `OAUTH_CALLBACK_URL` env var                 | Validate OAuth responses               |
| Backend        | Relative redirect: `/auth/callback`          | Environment-agnostic frontend redirect |
| NGINX          | Proxy `/api/*` to backend                    | Route OAuth callbacks correctly        |
| Frontend       | Handle `/auth/callback` route                | Extract and store JWT token            |

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
├── Services
│   ├── frontend-svc
│   ├── backend-svc
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
- Health checks and auto-recovery

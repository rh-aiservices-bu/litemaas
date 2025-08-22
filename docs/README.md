# LiteMaaS Documentation

Welcome to the LiteMaaS documentation! This guide will help you understand, deploy, and contribute to the LiteMaaS platform.

## 📚 Documentation Structure

### Getting Started

- **[Architecture Overview](architecture/overview.md)** - System design and components
- **[Development Setup](development/setup.md)** - Local development environment
- **[API Quick Start](api/)** - API documentation and examples

### Core Documentation

#### 🏗️ Architecture

- **[System Overview](architecture/overview.md)** - High-level architecture with diagrams
- **[Database Schema](architecture/database-schema.md)** - Complete database design
- **[Services](architecture/services.md)** - Backend service architecture
- **[LiteLLM Integration](architecture/litellm-integration.md)** - Model proxy integration

#### 🔌 API Reference

- **[REST API](api/rest-api.md)** - Complete API endpoint reference
- **[LiteLLM API](api/litellm-api.md)** - LiteLLM integration endpoints
- **[Model Sync API](api/model-sync-api.md)** - Model synchronization endpoints
- **[Usage API](api/usage-api.md)** - Usage tracking and analytics
- **[Migration Guide](api/api-migration-guide.md)** - Upgrading to multi-model keys

#### 🚀 Deployment

- **[Configuration](deployment/configuration.md)** - Environment variables and settings
- **[OpenShift Deployment](deployment/openshift-deployment.md)** - Kubernetes/OpenShift guide
- **[Container Deployment](deployment/containers.md)** - Docker/Podman deployment
- **[Production Guide](deployment/production-guide.md)** - Production best practices
- **[Authentication Setup](deployment/authentication.md)** - OAuth configuration
- **[OAuth Setup Guide](deployment/oauth-setup.md)** - Detailed OAuth configuration

#### 💻 Development

- **[Setup Guide](development/setup.md)** - Local development environment
- **[Backend Guide](development/backend-guide.md)** - Fastify development
- **[UI Guidelines](development/pf6-guide/README.md)** - PatternFly 6 best practices
- **[Translation Management](development/translation-management.md)** - i18n and translation tools
- **[Migration Notes](development/migration-notes.md)** - Database migrations
- **[Accessibility Guide](development/accessibility/README.md)** - WCAG 2.1 AA compliance and testing

#### ✨ Features

- **[Multi-Model API Keys](features/multi-model-api-keys-implementation.md)** - Enhanced API key system
- **[Default Team](features/default-team-implementation.md)** - Team-based user management
- **[Authentication Flow](features/authentication-flow.md)** - OAuth integration details
- **[Chatbot Implementation](development/chatbot-implementation.md)** - AI chatbot integration
- **[Model Sync](development/model-sync.md)** - Model synchronization processes
- **[RBAC](features/user-roles-administration.md)** - Administration roles

## 🎯 Quick Links by Role

### For Developers

1. Start with [Development Setup](development/setup.md)
2. Review [Architecture Overview](architecture/overview.md)
3. Check [API Documentation](api/)
4. Follow [UI Guidelines](development/pf6-guide/README.md)

### For DevOps/SREs

1. Read [OpenShift Deployment](deployment/openshift-deployment.md)
2. Configure using [Configuration Guide](deployment/configuration.md)
3. Review [Production Guide](deployment/production-guide.md)
4. Set up [Authentication](deployment/authentication.md)

### For API Users

1. Start with [API Quick Start](api/)
2. Review [REST API Reference](api/rest-api.md)
3. Learn about [Multi-Model Keys](api/api-migration-guide.md)
4. Check [Usage API](api/usage-api.md)

## 📊 Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface"
        Browser[Web Browser]
        CLI[API Clients]
    end

    subgraph "LiteMaaS Platform"
        Frontend[React Frontend<br/>PatternFly 6]
        Backend[Fastify API<br/>Node.js]
        DB[(PostgreSQL)]
    end

    subgraph "External Services"
        LiteLLM[LiteLLM Gateway]
        OAuth[OAuth Provider]
        AI[AI Models]
    end

    Browser --> Frontend
    CLI --> Backend
    Frontend --> Backend
    Backend --> DB
    Backend --> LiteLLM
    Backend --> OAuth
    LiteLLM --> AI

    style Frontend fill:#61dafb
    style Backend fill:#000000,color:#fff
    style LiteLLM fill:#7c3aed,color:#fff
```

## 🤝 Contributing

See our [Contributing Guide](../CONTRIBUTING.md) for information on:

- Code style and conventions
- Pull request process
- Testing requirements
- Documentation standards

## 📞 Support

- **Documentation**: You're here!
- **Issues**: [GitHub Issues](https://github.com/rh-aiservices-bu/litemaas/issues)
- **Discussions**: [GitHub Discussions](https://github.com/rh-aiservices-bu/litemaas/discussions)

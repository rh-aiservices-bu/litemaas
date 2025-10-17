# LiteMaaS Documentation

Welcome to the LiteMaaS documentation! This guide will help you understand, deploy, and contribute to the LiteMaaS platform.

## 📚 Documentation Structure

### Getting Started

- **[Architecture Overview](architecture/overview.md)** - System design and components
- **[Development Setup](development/setup.md)** - Local development environment
- **[API Quick Start](api/README.md)** - API documentation and examples

### Core Documentation

#### 🏗️ Architecture

- **[System Overview](architecture/overview.md)** - High-level architecture with diagrams
- **[Project Structure](architecture/project-structure.md)** - Complete directory structure and file organization
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
- **[UI Guidelines](development/pf6-guide/README.md)** - PatternFly 6 comprehensive guide with setup, components, and patterns
- **[Error Handling Guide](development/error-handling.md)** - Comprehensive error handling patterns
- **[Pattern Reference](development/pattern-reference.md)** - Authoritative code patterns and anti-patterns
- **[Translation Management](development/translation-management.md)** - i18n and translation tools
- **[Chart Components Guide](development/chart-components-guide.md)** - Chart component patterns and utilities
- **[Chatbot Implementation](development/chatbot-implementation.md)** - AI chatbot integration
- **[Model Sync](development/model-sync.md)** - Model synchronization processes
- **[Concurrency Strategy](development/concurrency-strategy.md)** - Concurrency handling patterns
- **[Code Review Checklist](development/code-review-checklist.md)** - Code review guidelines
- **[Accessibility Guide](development/accessibility/README.md)** - WCAG 2.1 AA compliance and testing
  - **[ARIA Live Regions](development/accessibility/aria-live-regions.md)** - Screen reader announcements
  - **[Accessibility Patterns](development/accessibility/patterns.md)** - Common accessibility patterns
  - **[Frontend Testing](development/accessibility/frontend-testing.md)** - Accessibility testing
  - **[Testing Guide](development/accessibility/testing-guide.md)** - Comprehensive testing approaches

#### ✨ Features

- **[User Roles & Administration](features/user-roles-administration.md)** - RBAC with three-tier role hierarchy
- **[Admin Tools](features/admin-tools.md)** - Administrative tools and model sync
- **[Admin Usage API Key Filter](features/admin-usage-api-key-filter.md)** - API key filtering for usage analytics
- **[Authentication Flow](features/authentication-flow.md)** - OAuth integration details
- **[Model Configuration Testing](features/model-configuration-testing.md)** - Configuration validation feature
- **[Test Chatbot](features/test-chatbot.md)** - Chatbot testing guide

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

1. Start with [API Quick Start](api/README.md)
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

## 🤖 For AI Assistants (Claude)

### Quick Document Lookup

- **Project Structure**: `docs/architecture/project-structure.md`
- **Error Handling**: `docs/development/error-handling.md`
- **Pattern Reference**: `docs/development/pattern-reference.md`
- **Admin Features**: `docs/features/admin-tools.md`
- **User Roles/RBAC**: `docs/features/user-roles-administration.md`
- **PatternFly 6 Components**: `docs/development/pf6-guide/`
- **Accessibility Testing**: `docs/development/accessibility/`
- **API Documentation**: `docs/api/rest-api.md`
- **Authentication Setup**: `docs/deployment/authentication.md`
- **Chatbot Implementation**: `docs/development/chatbot-implementation.md`

### Document Discovery Commands

```bash
# Find all documentation files
find docs -name "*.md" | sort

# Search for content across all docs
grep -r "search_term" docs/

# List files by category
ls docs/development/     # Development guides
ls docs/features/        # Feature documentation
ls docs/api/            # API documentation
ls docs/deployment/     # Deployment guides
ls docs/archive/        # Historical documents

# Recent documentation changes
git log --oneline docs/
```

### Navigation Tips

- **Start with**: `docs/README.md` (this file) for complete index
- **Development**: Begin with `docs/development/setup.md`
- **Architecture**: Review `docs/architecture/overview.md`
- **Specific features**: Check `docs/features/` directory
- **API integration**: See `docs/api/` directory
- **Production deployment**: Use `docs/deployment/` guides

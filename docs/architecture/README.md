# Architecture Documentation

This directory contains documentation about the LiteMaaS system architecture, design patterns, and technical implementation.

## Architecture Guides

- **[System Overview](overview.md)** - High-level architecture with diagrams and component overview
- **[Project Structure](project-structure.md)** - Complete directory structure and file organization
- **[Database Schema](database-schema.md)** - Database design, tables, and relationships
- **[Services](services.md)** - Backend service architecture and patterns
- **[LiteLLM Integration](litellm-integration.md)** - Integration with LiteLLM model proxy

## Architecture Overview

LiteMaaS is built as a monorepo with two main packages:

- **Backend**: Fastify-based API server with PostgreSQL database
- **Frontend**: React application with PatternFly 6 UI components

The system integrates with LiteLLM to provide unified access to multiple AI model providers.

## Key Architectural Patterns

- **Service Layer**: BaseService pattern for consistent service implementation
- **Plugin Architecture**: Modular backend plugin system
- **RBAC**: Three-tier role hierarchy (admin > adminReadonly > user)
- **State Management**: React Context + React Query on frontend

## Related Documentation

- [Development Setup](../development/setup.md)
- [Backend Guide](../development/backend-guide.md)
- [API Reference](../api/README.md)
- [Deployment Guides](../deployment/README.md)

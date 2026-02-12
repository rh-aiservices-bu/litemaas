# Deployment Documentation

This directory contains guides for deploying and configuring LiteMaaS in various environments.

## Deployment Guides

- **[Configuration](configuration.md)** - Environment variables and application settings
- **[Authentication Setup](authentication.md)** - OAuth2 and JWT configuration
- **[OAuth Setup Guide](oauth-setup.md)** - Detailed OAuth provider configuration
- **[Helm Chart Deployment](helm-deployment.md)** - Helm-based deployment for Kubernetes and OpenShift
- **[Kustomize Deployment](kustomize-deployment.md)** - Kustomize-based deployment for OpenShift
- **[Container Deployment](containers.md)** - Docker and Podman deployment
- **[Production Guide](production-guide.md)** - Production deployment best practices

## Quick Start

For local development setup, see [Development Setup](../development/setup.md).

For production deployment:

1. Review [Configuration](configuration.md) for required environment variables
2. Set up [Authentication](authentication.md) with your OAuth provider
3. Follow one of:
   - [Helm Chart Deployment](helm-deployment.md) for Kubernetes or OpenShift (recommended)
   - [Kustomize Deployment](kustomize-deployment.md) for Kustomize-based OpenShift deployment
   - [Container Deployment](containers.md) for Docker/Podman
4. Review [Production Guide](production-guide.md) for best practices

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Development Setup](../development/setup.md)
- [API Documentation](../api/README.md)

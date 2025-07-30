# OpenShift Deployment Files

This directory contains Kubernetes manifests and Kustomize configuration for deploying LiteMaaS on OpenShift Container Platform.

## Quick Start

```bash
# Deploy to current project
oc apply -k .

# Deploy to specific namespace
oc apply -k . -n my-namespace
```

## Files Overview

### Core Resources
- `namespace.yaml` - Namespace definition
- `postgres-deployment.yaml` - PostgreSQL StatefulSet
- `postgres-service.yaml` - PostgreSQL service
- `backend-deployment.yaml` - LiteMaaS backend deployment
- `backend-service.yaml` - Backend service
- `frontend-deployment.yaml` - LiteMaaS frontend deployment
- `frontend-service.yaml` - Frontend service
- `litellm-deployment.yaml` - LiteLLM service deployment
- `litellm-service.yaml` - LiteLLM service

### External Access
- `frontend-route.yaml` - OpenShift Route for LiteMaaS UI
- `litellm-route.yaml` - OpenShift Route for LiteLLM admin UI

### Security & Configuration
- `postgres-secret.yaml` - Database credentials
- `backend-secret.yaml` - Backend configuration secrets
- `litellm-secret.yaml` - LiteLLM configuration secrets

### Kustomize
- `kustomization.yaml` - Main Kustomize configuration

## Prerequisites

1. **OpenShift cluster access** with project creation permissions
2. **OpenShift CLI (oc)** installed and logged in
3. **OAuth client configured** in OpenShift (see full deployment guide)
4. **Container images** available at:
   - `quay.io/rh-aiservice-bu/litemaas-backend:latest`
   - `quay.io/rh-aiservice-bu/litemaas-frontend:latest`

## Important Notes

⚠️ **BEFORE DEPLOYMENT**: You must customize the secret files with your actual values. The included secrets contain placeholder values that will not work in production.

🔐 **Security**: All secrets should be updated with secure, randomly generated values before deployment.

📚 **Complete Guide**: For detailed setup instructions, see [OpenShift Deployment Guide](../../docs/deployment/openshift-deployment.md)

## Access Points

After successful deployment:
- **LiteMaaS Application**: `https://litemaas-<namespace>.apps.<cluster-domain>`
- **LiteLLM Admin UI**: `https://litellm-<namespace>.apps.<cluster-domain>`

## Support

For troubleshooting and detailed configuration, see the complete deployment guide in `docs/deployment/openshift-deployment.md`.
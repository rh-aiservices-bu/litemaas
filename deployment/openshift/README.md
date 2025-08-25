# OpenShift Deployment

This directory contains Kubernetes manifests and Kustomize configuration for deploying LiteMaaS on OpenShift Container Platform.

## Prerequisites

1. **OpenShift cluster access** with project creation permissions
2. **OpenShift CLI (oc)** installed and logged in
3. **OAuth client configured** in OpenShift (see [full deployment guide](../../docs/deployment/openshift-deployment.md#oauth-client-configuration))
4. **Container images** available at:
   - `quay.io/rh-aiservices-bu/litemaas-backend`
   - `quay.io/rh-aiservices-bu/litemaas-frontend`

## Important Notes

⚠️ **BEFORE DEPLOYMENT**: You must customize the secret files with your actual values. The included secrets contain placeholder values that will not work in production.

🔐 **Security**: All secrets should be updated with secure, randomly generated values before deployment.

📚 **Complete Guide**: For detailed setup instructions, see [OpenShift Deployment Guide](../../docs/deployment/openshift-deployment.md)

## Quick Start

### Prepare the configuration file

The deployment uses a **template-based configuration system**:

- Make a copy of `user-values.env.example`, renaming it `user-values.env`
- Edit `user-values.env` and enter the values you want to use for the deployment
- Prepare the deployment files using the `preparation.sh` script

```bash
# Prepare the local configuration files (generates *.local from *.template)
./preparation.sh
```

> **Template System**: Files ending in `.template` are processed by `preparation.sh` using environment variable substitution from `user-values.env`. This generates `.local` files with your actual configuration values.

- Apply the configuration files to deploy all elements: PostgreSQL database, LiteLLM, Backend and Frontend.

```bash
# Deploy to current project
oc apply -k .
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

## Access Points

After successful deployment:

- **LiteMaaS Application**: `https://litemaas-<namespace>.<cluster-domain>`
- **LiteLLM Admin UI**: `https://litellm-<namespace>.<cluster-domain>`

## Post-Deployment tasks

- ~~Connect to LiteLLM dashboard and create Models~~
- You can now use LiteMaaS to directly create the models, no need to connect to LiteLLM directly.
- Wait for the backend to sync models, or start a Rollout of the deployment to initiate the refresh.

## Support

For troubleshooting and detailed configuration, see the complete deployment guide in `docs/deployment/openshift-deployment.md`.

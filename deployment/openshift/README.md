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

1. **Copy the example configuration**:

   ```bash
   cp user-values.env.example user-values.env
   ```

2. **Edit `user-values.env`** and customize the following **required values**:
   - `LITEMAAS_VERSION` - LiteMaaS version to deploy (e.g., `0.1.2`)
   - `CLUSTER_DOMAIN_NAME` - Your OpenShift cluster domain (e.g., `apps.cluster.example.com`)
   - `NAMESPACE` - Namespace/project name (e.g., `litemaas`)
   - `PG_ADMIN_PASSWORD` - Secure PostgreSQL password (generate with `openssl rand -base64 32`)
   - `JWT_SECRET` - Secure JWT signing key (generate with `openssl rand -base64 32`)
   - `OAUTH_CLIENT_ID` - OAuth client ID from OpenShift (see prerequisites)
   - `OAUTH_CLIENT_SECRET` - OAuth client secret from OpenShift
   - `ADMIN_API_KEY` - Admin API key for backend management operations (generate with `openssl rand -base64 32`)
   - `LITELLM_API_KEY` - LiteLLM master API key (generate with `openssl rand -base64 32`, must start with `sk-`)
   - `LITELLM_UI_USERNAME` - LiteLLM admin UI username
   - `LITELLM_UI_PASSWORD` - LiteLLM admin UI password

   > ⚠️ **Security**: Never use the example placeholder values in production! Generate secure random values for all passwords, secrets, and API keys.

3. **Run the preparation script** to generate deployment files:

   ```bash
   ./preparation.sh
   ```

4. **Verify the generated files**:

   ```bash
   # Check that .local files were created successfully
   ls -la *.local

   # Should show:
   # - backend-deployment.yaml.local
   # - backend-secret.yaml.local
   # - frontend-deployment.yaml.local
   # - litellm-secret.yaml.local
   # - namespace.yaml.local
   # - postgres-secret.yaml.local
   # - kustomization.yaml
   ```

> **Template System**: Files ending in `.template` are processed by `preparation.sh` using environment variable substitution from `user-values.env`. This generates `.local` files with your actual configuration values.

> 📚 **Optional Configuration**: The deployment uses sensible defaults for rate limiting, user quotas, and caching. To customize these values, see the [Configuration Guide](../../docs/deployment/configuration.md).

### Deploy to OpenShift

Apply the configuration files to deploy all components: PostgreSQL database, LiteLLM, Backend and Frontend.

```bash
# Deploy to current project
oc apply -k .
```

5. **Validate the deployment**:

   After deployment completes, validate all components are running correctly:

   ```bash
   # Quick validation
   oc get pods -n <your-namespace>
   # All pods should show 1/1 Running

   # Comprehensive validation
   # See VALIDATION.md for complete checklist
   ```

   📋 **Validation Guide**: For a comprehensive deployment validation checklist, see [VALIDATION.md](VALIDATION.md)

## Files Overview

### Core Resources

- `namespace.yaml` - Namespace definition
- `postgres-statefulset.yaml` - PostgreSQL StatefulSet
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

- `postgres-secret.yaml` - Database credentials for PostgreSQL
- `backend-secret.yaml` - Backend configuration including:
  - Database connection string
  - JWT signing secret
  - OAuth client credentials
  - Admin API key (for backend management API, NOT for LLM requests)
  - LiteLLM API key
- `litellm-secret.yaml` - LiteLLM configuration including:
  - LiteLLM database connection string
  - Master API key
  - Admin UI credentials

> **Note**: `ADMIN_API_KEY` protects LiteMaaS backend management endpoints (user/subscription management, model sync). It does NOT control AI model access - that's handled by per-user API keys created through LiteMaaS.

### Kustomize

- `kustomization.yaml` - Main Kustomize configuration

### Documentation

- `README.md` - Quick start guide (this file)
- `VALIDATION.md` - Comprehensive deployment validation checklist
- `preparation.sh` - Template processing script
- `user-values.env.example` - Configuration template

## Access Points

After successful deployment:

- **LiteMaaS Application**: `https://litemaas-<namespace>.<cluster-domain>`
- **LiteLLM Admin UI**: `https://litellm-<namespace>.<cluster-domain>`

## Post-Deployment tasks

- Use LiteMaaS to directly create the models. You can also connect to LiteLLM directly for advanced configuration.
- Wait for the backend to sync models, or start a Rollout of the deployment to initiate the refresh.

## Support

For troubleshooting and detailed configuration, see the complete deployment guide in `docs/deployment/openshift-deployment.md`.

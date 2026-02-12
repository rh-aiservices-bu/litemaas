# Helm Chart Deployment

This guide covers deploying LiteMaaS using the Helm chart, which works on both vanilla Kubernetes and OpenShift Container Platform.

> **Alternative deployment method**: For Kustomize-based OpenShift deployment, see the [Kustomize Deployment Guide](kustomize-deployment.md).

## Prerequisites

1. **Kubernetes cluster** (v1.25+) or **OpenShift** (v4.12+)
2. **Helm** (v3.10+) installed
3. **kubectl** or **oc** CLI configured and authenticated
4. **OAuth configured** — On OpenShift, the chart can use a ServiceAccount as an OAuth client (default, no cluster-admin needed). For other setups, see [Authentication Guide](authentication.md).
5. **Container images** available at:
   - `quay.io/rh-aiservices-bu/litemaas-backend`
   - `quay.io/rh-aiservices-bu/litemaas-frontend`

## Quick Start

### 1. Create a values file

```bash
cp deployment/helm/litemaas/values.yaml my-values.yaml
```

Edit `my-values.yaml` with your configuration. At minimum, set:

```yaml
# Required: change all default secrets
postgresql:
  auth:
    password: "<secure-random-password>"    # openssl rand -base64 32

litellm:
  auth:
    masterKey: "sk-<secure-random-key>"     # Must start with sk-
    uiUsername: "admin"
    uiPassword: "<secure-password>"

backend:
  auth:
    jwtSecret: "<secure-random-key>"        # openssl rand -base64 32
    adminApiKeys: "<secure-random-key>"     # openssl rand -base64 32
    litellmApiKey: "sk-<same-as-masterKey>" # Must match litellm.auth.masterKey
```

> **Note**: OAuth client ID, secret, and issuer are auto-configured when using the default ServiceAccount OAuth mode on OpenShift. See [OAuth Configuration](#oauth-configuration) for details.

### 2. Install the chart

**Kubernetes:**

```bash
helm install litemaas deployment/helm/litemaas/ \
  -n litemaas --create-namespace \
  -f my-values.yaml
```

**OpenShift:**

```bash
# Create the project first (grants you admin rights in the namespace)
oc new-project litemaas

helm install litemaas deployment/helm/litemaas/ \
  -n litemaas \
  -f my-values.yaml \
  --set global.platform=openshift \
  --set route.enabled=true \
  --set route.litellm.enabled=true
```

> **Note**: On OpenShift, use `oc new-project` instead of `--create-namespace`. OpenShift Projects automatically grant the creator admin rights in the namespace, which Helm needs to manage resources.

### 3. Verify the deployment

```bash
kubectl get pods -n litemaas
# All pods should show Running status

helm test litemaas -n litemaas
# Tests should pass
```

## Configuration Reference

### Global Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.platform` | Target platform: `kubernetes` or `openshift` | `kubernetes` |
| `global.clusterDomain` | Cluster apps domain (auto-detected via post-install hook if empty) | `""` |
| `global.clusterScopedLookups` | Enable cluster-scoped API lookups at template time (requires cluster-admin) | `false` |
| `global.imagePullSecrets` | Global image pull secrets | `[]` |
| `global.imagePullPolicy` | Global image pull policy | `IfNotPresent` |
| `hook.image.repository` | Image for the post-install OAuth setup hook | `bitnami/kubectl` |
| `hook.image.tag` | Hook image tag | `latest` |

### OAuth Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `oauth.mode` | OAuth mode: `serviceaccount` (SA as OAuth client, OpenShift) or `external` (bring your own) | `serviceaccount` |
| `oauth.issuer` | OAuth issuer URL (auto-constructed on OpenShift if empty) | `""` |
| `oauth.existingTokenSecret` | Pre-existing SA token Secret name (chart creates one if empty) | `""` |

### PostgreSQL

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Deploy built-in PostgreSQL | `true` |
| `postgresql.image.repository` | PostgreSQL image | `postgres` |
| `postgresql.image.tag` | PostgreSQL image tag | `16-alpine` |
| `postgresql.auth.username` | Database admin username | `litemaas_admin` |
| `postgresql.auth.password` | Database admin password | `changeme` |
| `postgresql.auth.existingSecret` | Use an existing Secret (keys: `username`, `password`) | `""` |
| `postgresql.persistence.size` | PVC storage size | `10Gi` |
| `postgresql.persistence.storageClass` | StorageClass name (empty = cluster default) | `""` |

### LiteLLM

| Parameter | Description | Default |
|-----------|-------------|---------|
| `litellm.enabled` | Deploy built-in LiteLLM proxy | `true` |
| `litellm.image.repository` | LiteLLM image | `ghcr.io/berriai/litellm-non_root` |
| `litellm.image.tag` | LiteLLM image tag | `main-v1.74.7-stable` |
| `litellm.databaseUrl` | Explicit database URL (auto-built when `postgresql.enabled`) | `""` |
| `litellm.auth.masterKey` | LiteLLM master/API key | `changeme` |
| `litellm.auth.uiUsername` | Admin UI username | `admin` |
| `litellm.auth.uiPassword` | Admin UI password | `changeme` |
| `litellm.auth.existingSecret` | Use an existing Secret (keys: `database-url`, `master-key`, `ui-username`, `ui-password`) | `""` |

### Backend

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.image.repository` | Backend image | `quay.io/rh-aiservices-bu/litemaas-backend` |
| `backend.image.tag` | Backend image tag (defaults to chart `appVersion`) | `""` |
| `backend.databaseUrl` | Explicit database URL (auto-built when `postgresql.enabled`) | `""` |
| `backend.litellmApiUrl` | Explicit LiteLLM URL (auto-built when `litellm.enabled`) | `""` |
| `backend.corsOrigin` | CORS origin (auto-derived from ingress/route hostname) | `""` |
| `backend.auth.jwtSecret` | JWT signing secret | `changeme` |
| `backend.auth.jwtExpiresIn` | JWT token expiration | `24h` |
| `backend.auth.oauthClientId` | OAuth client ID (only when `oauth.mode: external`) | `""` |
| `backend.auth.oauthClientSecret` | OAuth client secret (only when `oauth.mode: external`) | `""` |
| `backend.auth.oauthIssuer` | OAuth issuer URL (only when `oauth.mode: external`) | `""` |
| `backend.auth.oauthCallbackUrl` | OAuth callback URL (auto-derived from hostname) | `""` |
| `backend.auth.adminApiKeys` | Admin API keys (comma-separated) | `changeme` |
| `backend.auth.initialAdminUsers` | Initial admin users (comma-separated usernames; auto-detected on OpenShift if empty) | `""` |
| `backend.auth.litellmApiKey` | LiteLLM API key (must match `litellm.auth.masterKey`) | `changeme` |
| `backend.auth.existingSecret` | Use an existing Secret (keys: `database-url`, `cors-origin`, `jwt-secret`, `oauth-client-id`, `oauth-client-secret`, `oauth-issuer`, `oauth-callback-url`, `admin-api-keys`, `litellm-api-key`) | `""` |
| `backend.rateLimit.max` | Rate limit max requests | `1000` |
| `backend.rateLimit.timeWindow` | Rate limit time window | `5m` |
| `backend.defaultUser.maxBudget` | Default user max budget | `100` |
| `backend.defaultUser.tpmLimit` | Default user TPM limit | `100000` |
| `backend.defaultUser.rpmLimit` | Default user RPM limit | `120` |
| `backend.nodeTlsRejectUnauthorized` | Set to `"0"` to disable TLS verification | `""` |

### Frontend

| Parameter | Description | Default |
|-----------|-------------|---------|
| `frontend.image.repository` | Frontend image | `quay.io/rh-aiservices-bu/litemaas-frontend` |
| `frontend.image.tag` | Frontend image tag (defaults to chart `appVersion`) | `""` |
| `frontend.backendUrl` | Backend URL (auto-constructed from service name) | `""` |

### Ingress (Kubernetes)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable Kubernetes Ingress | `false` |
| `ingress.className` | Ingress class name (e.g., `nginx`) | `""` |
| `ingress.annotations` | Ingress annotations | `{}` |
| `ingress.frontend.host` | Frontend hostname | `""` |
| `ingress.frontend.tls` | Frontend TLS config | `[]` |
| `ingress.litellm.enabled` | Enable LiteLLM Ingress | `false` |
| `ingress.litellm.host` | LiteLLM hostname | `""` |
| `ingress.litellm.tls` | LiteLLM TLS config | `[]` |

### Route (OpenShift)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `route.enabled` | Enable OpenShift Routes | `false` |
| `route.annotations` | Route annotations | `{}` |
| `route.frontend.host` | Frontend hostname (auto-generated if empty) | `""` |
| `route.frontend.termination` | TLS termination type | `edge` |
| `route.litellm.enabled` | Enable LiteLLM Route | `false` |
| `route.litellm.host` | LiteLLM hostname (auto-generated if empty) | `""` |
| `route.litellm.termination` | TLS termination type | `edge` |

## Common Scenarios

### Using External PostgreSQL

To use an external PostgreSQL instance instead of the built-in one:

```yaml
postgresql:
  enabled: false

backend:
  databaseUrl: "postgresql://user:password@external-db.example.com:5432/litemaas_db?sslmode=require"

litellm:
  databaseUrl: "postgresql://user:password@external-db.example.com:5432/litellm_db?sslmode=require"
```

### Using External LiteLLM

To connect to an existing LiteLLM instance:

```yaml
litellm:
  enabled: false

backend:
  litellmApiUrl: "https://litellm.example.com"
```

### Using External Secret Managers

Each component supports referencing pre-existing Kubernetes Secrets:

```yaml
postgresql:
  auth:
    existingSecret: "my-postgres-credentials"

litellm:
  auth:
    existingSecret: "my-litellm-secrets"

backend:
  auth:
    existingSecret: "my-backend-secrets"
```

### Kubernetes with Ingress (nginx)

```yaml
global:
  platform: kubernetes

ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
  frontend:
    host: litemaas.example.com
    tls:
      - secretName: litemaas-tls
        hosts:
          - litemaas.example.com
  litellm:
    enabled: true
    host: litellm.example.com
    tls:
      - secretName: litellm-tls
        hosts:
          - litellm.example.com
```

### OpenShift with Routes

```yaml
global:
  platform: openshift

route:
  enabled: true
  frontend:
    host: litemaas.apps.cluster.example.com
  litellm:
    enabled: true
    host: litellm.apps.cluster.example.com
```

### OpenShift with ServiceAccount OAuth (default)

The default `oauth.mode: serviceaccount` uses the ServiceAccount as an OpenShift OAuth client. This requires only namespace-level permissions (no cluster-admin):

```yaml
global:
  platform: openshift

route:
  enabled: true
  litellm:
    enabled: true
```

The chart will:
- Set the OAuth client ID to `system:serviceaccount:<namespace>:<sa-name>`
- Create a ServiceAccount token Secret for the OAuth client secret
- Run a **post-install hook** that automatically:
  1. Reads the Route hostname assigned by OpenShift
  2. Annotates the ServiceAccount with the OAuth redirect URI
  3. Patches the backend Secret with CORS origin, OAuth issuer, and callback URL
  4. Restarts the backend deployment to pick up the new values

> **Note**: The backend may restart once shortly after install while the hook configures OAuth. This is expected and takes ~10–20 seconds.

If you prefer to set the cluster domain explicitly (e.g., for `helm template` or to avoid the brief startup delay):

```yaml
global:
  platform: openshift
  clusterDomain: apps.cluster.example.com
  clusterScopedLookups: true           # resolve values at template time (requires cluster-admin)
```

> **Advanced**: `global.clusterScopedLookups` (default `false`) controls whether the chart attempts to auto-detect the cluster domain at template-rendering time via `config.openshift.io/v1 Ingress`. This requires cluster-admin read access. When `false` (the default), the post-install hook handles auto-detection instead, which works for any user with namespace-level permissions.

### Initial Admin Users

By default on OpenShift, the chart auto-detects the deploying user (via the `user.openshift.io/v1` API) and grants them the `admin` role on first login. This removes the need for cluster-admin access to manage OpenShift groups for the initial setup.

To explicitly set initial admins (works on any platform):

```yaml
backend:
  auth:
    initialAdminUsers: "admin@example.com,lead@example.com"
```

The `INITIAL_ADMIN_USERS` env var is a comma-separated list of usernames. When a user matching this list logs in via OAuth, they are automatically granted the `admin` role in addition to any roles derived from OpenShift groups.

> **Note**: This is additive — it does not remove roles from other sources. Once an admin is established, they can manage other users' roles through the application.

### OpenShift with External OAuth (OAuthClient CR)

If you already have an `OAuthClient` custom resource or want to use a non-OpenShift OAuth provider:

```yaml
global:
  platform: openshift

oauth:
  mode: external

backend:
  auth:
    oauthClientId: "my-oauth-client"
    oauthClientSecret: "my-oauth-secret"
    oauthIssuer: "https://oauth-openshift.apps.cluster.example.com"

route:
  enabled: true
  litellm:
    enabled: true
```

> **Migration note**: If upgrading from a previous chart version that used an `OAuthClient` CR, set `oauth.mode: external` to preserve your existing configuration.

## Upgrading

```bash
helm upgrade litemaas deployment/helm/litemaas/ \
  -n litemaas \
  -f my-values.yaml
```

## Uninstalling

```bash
helm uninstall litemaas -n litemaas
```

> **Note**: PersistentVolumeClaims created by the PostgreSQL StatefulSet are not automatically deleted. To remove the data volume:
> ```bash
> kubectl delete pvc -l app.kubernetes.io/component=database -n litemaas
> ```

## Post-Deployment

1. Configure AI models via the LiteMaaS UI or LiteLLM admin UI
2. Wait for the backend to sync models, or restart the backend deployment to trigger an immediate sync
3. See [Configuration Guide](configuration.md) for advanced settings

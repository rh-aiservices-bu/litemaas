# LiteMaaS Helm Chart

Helm chart for deploying LiteMaaS on OpenShift or Kubernetes.

## Quick Start

```bash
# Create a values file from the defaults
cp deployment/helm/litemaas/values.yaml my-values.yaml
# Edit my-values.yaml — at minimum, change all `changeme` secrets

# OpenShift
oc new-project litemaas
helm install litemaas deployment/helm/litemaas/ \
  -n litemaas \
  -f my-values.yaml \
  --set global.platform=openshift \
  --set route.enabled=true

# Kubernetes
helm install litemaas deployment/helm/litemaas/ \
  -n litemaas --create-namespace \
  -f my-values.yaml
```

## What Gets Deployed

| Component  | Default Image |
|------------|---------------|
| PostgreSQL | `postgres:16-alpine` |
| LiteLLM    | `ghcr.io/berriai/litellm-non_root:main-v1.74.7-stable` |
| Backend    | `quay.io/rh-aiservices-bu/litemaas-backend:<appVersion>` |
| Frontend   | `quay.io/rh-aiservices-bu/litemaas-frontend:<appVersion>` |

Backend and frontend image tags default to the chart's `appVersion` (currently `0.2.0`). Override with `backend.image.tag` / `frontend.image.tag`.

## Documentation

For the full configuration reference, common scenarios (external database, external OAuth, Ingress/Route setup), and upgrade instructions, see:

**[Helm Deployment Guide](../../docs/deployment/helm-deployment.md)**

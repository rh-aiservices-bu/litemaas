# Upgrading LiteMaaS to v0.2.0

This guide is for operators upgrading an existing LiteMaaS deployment to v0.2.0. If you are deploying LiteMaaS for the first time, follow the standard [Helm](helm-deployment.md) or [Kustomize](kustomize-deployment.md) deployment guides instead.

## What's New in v0.2.0

See the [CHANGELOG](../../CHANGELOG.md) for the full list of changes. Highlights include:

- Admin user management with a consolidated modal workflow
- Helm chart default changes (OpenShift platform, LiteLLM Route/Ingress enabled)
- Bundled LiteLLM proxy updated from v1.74.x to v1.81.0

## Important: Two-Phase Upgrade Required

Version 0.2.0 ships with a newer version of [LiteLLM](https://github.com/BerriAI/litellm), the AI model proxy that LiteMaaS uses under the hood. The new LiteLLM version introduces an internal API change that is **not backward-compatible** with older LiteMaaS releases.

This means the upgrade must be done in two phases:

1. **First**, deploy the updated LiteMaaS application (backend and frontend).
2. **Then**, upgrade the LiteLLM component.

Doing it in this order is safe because the updated LiteMaaS works with both the old and new LiteLLM versions. Upgrading LiteLLM first without updating LiteMaaS would cause API key details (spend, budget) to display incorrectly.

## Pre-upgrade Checklist

- [ ] Back up both databases (`litemaas_db` and `litellm_db`)
- [ ] Review the [CHANGELOG](../../CHANGELOG.md) for any configuration changes that may affect your deployment
- [ ] Build and push new LiteMaaS v0.2.0 container images (or pull them from your registry)

## Phase 1: Update LiteMaaS

Deploy the new LiteMaaS backend and frontend images while keeping the existing LiteLLM version unchanged.

### Helm

```bash
helm upgrade litemaas deployment/helm/litemaas/ -n litemaas \
  --set backend.image.tag=<new-litemaas-tag> \
  --set litellm.image.tag=main-v1.74.7-stable  # keep current version explicitly
```

### Kustomize

Update the LiteMaaS backend and frontend images in your kustomization overlay. Keep the LiteLLM deployment image unchanged at its current version (`main-v1.74.7-stable`).

### Verify

```bash
# Health check
curl <backend-url>/api/v1/health
# Expected: 200 with litellm: "healthy"
```

- Create an API key via the UI
- View API key details -- spend and budget values display correctly
- Model list loads correctly

## Phase 2: Update LiteLLM

Once Phase 1 is verified, upgrade LiteLLM to the version bundled with v0.2.0.

### Helm

```bash
helm upgrade litemaas deployment/helm/litemaas/ -n litemaas \
  --set litellm.image.tag=main-v1.81.0-stable
```

### Kustomize

Update the LiteLLM deployment image to `ghcr.io/berriai/litellm-non_root:main-v1.81.0-stable`.

### Verify

Wait for the LiteLLM pods to become ready (LiteLLM runs its own database migrations on startup), then verify:

```bash
# LiteLLM health
curl <litellm-url>:4000/health/liveness
# Expected: 200
```

- View API key details -- spend and budget values still display correctly
- Create a new API key
- Run a chat completion via the frontend
- Admin usage analytics dashboard loads

### Key Alias Backfill (Optional)

LiteMaaS runs an automatic key alias backfill on startup. If the backend pods were not restarted after Phase 2, you can trigger it manually:

```bash
kubectl rollout restart deployment/<backend-deployment> -n litemaas
kubectl logs deployment/<backend-deployment> -n litemaas | grep -i backfill
```

## Rollback

| Scenario | Action | Risk |
|----------|--------|------|
| Phase 1 fails | `helm rollback litemaas` -- LiteLLM is unchanged | Low |
| Phase 2 fails | Revert LiteLLM image to `main-v1.74.7-stable` -- updated LiteMaaS handles both versions | Low-Medium (LiteLLM DB migrations may need backup restore) |
| Both fail | Restore both databases from backup + `helm rollback` | Medium |

The updated LiteMaaS is backward-compatible with the older LiteLLM, so reverting LiteLLM alone is always safe.

## Appendix: LiteLLM v1.81.0 Breaking Changes

This section provides technical detail for operators who want to understand what changed in LiteLLM. This is informational only -- the upgrade procedure above handles everything.

### `/key/info` response format change

The `/key/info` endpoint changed from a flat response to a nested format:

```jsonc
// v1.74.x (flat)
{ "key_name": "my-key", "spend": 25.5, "max_budget": 100, ... }

// v1.81.0 (nested)
{ "key": "sk-...", "info": { "key_name": "my-key", "spend": 25.5, "max_budget": 100, ... } }
```

LiteMaaS v0.2.0 detects both formats automatically in `getKeyInfo()` and `getKeyAlias()`, which is why it works with either LiteLLM version.

### `/health/liveliness` renamed to `/health/liveness`

The health endpoint spelling was corrected. LiteMaaS already uses `/health/liveness`, and the older LiteLLM version supports both spellings, so this has no operational impact.

### Other changes (not applicable to LiteMaaS)

- **`/budget/info` method change** (GET to POST): Not called by LiteMaaS.
- **Rate limit header changes**: Not parsed by LiteMaaS.

### Files modified in LiteMaaS

| File | Change |
|------|--------|
| `backend/src/services/litellm.service.ts` | Dual-format detection for `/key/info` responses; `/health/liveness` endpoint |
| `backend/src/types/api-key.types.ts` | `LiteLLMKeyInfoResponse` type for nested format |
| `deployment/helm/litemaas/values.yaml` | Default LiteLLM image tag updated |
| `deployment/kustomize/litellm-deployment.yaml` | LiteLLM image tag updated |
| `dev-tools/compose.yaml` | LiteLLM image tag updated for local development |

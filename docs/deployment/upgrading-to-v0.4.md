# Upgrading LiteMaaS to v0.4.0

This guide is for operators upgrading an existing LiteMaaS deployment (v0.3.x) to v0.4.0. If you are deploying LiteMaaS for the first time, follow the standard [Helm](helm-deployment.md) or [Kustomize](kustomize-deployment.md) deployment guides instead.

> **Upgrading from v0.1.x?** First follow the [v0.2.0 Upgrade Guide](upgrading-to-v0.2.md), then return here.

## What's New in v0.4.0

See the [CHANGELOG](../../CHANGELOG.md) for the full list of changes. Highlights include:

- **Model Capability Management**: Multi-type model support (Chat, Embeddings, Document Conversion) with Tokenize capability and type-specific UI behavior
- **Custom LiteLLM fork** with Docling document conversion endpoint and `/tokenize` support
- **Optional Redis integration** for faster model CRUD propagation across LiteLLM proxy pods
- **Model sync reliability fixes** preventing deleted models from reappearing
- **`LITELLM_DATABASE_URL` expanded role** — now used for model sync cross-referencing in addition to backup/restore

## Key Changes

| Change | Required? | What | Why |
|--------|-----------|------|-----|
| **LiteLLM image** | **Yes** | Switch from upstream `ghcr.io/berriai/litellm-non_root` to custom fork `quay.io/rh-aiservices-bu/litellm-non-root:main-v1.81.0-stable-custom` | Adds Docling document conversion and `/tokenize` endpoints |
| **`LITELLM_DATABASE_URL`** | Recommended | Ensure this env var is set (may already be if backup/restore is configured) | Now also used by model sync to cross-reference `LiteLLM_ProxyModelTable`, preventing deleted models from reappearing |
| **Redis** | Optional | Deploy a Redis instance shared by LiteLLM and the backend | When available, the backend flushes LiteLLM's cache after model CRUD for immediate propagation. Without it, changes still work but may take longer to appear across proxy pods |

## Pre-upgrade Checklist

- [ ] Back up both databases (`litemaas_db` and `litellm_db`) — use the built-in Backup feature or `pg_dump`
- [ ] Review the [CHANGELOG](../../CHANGELOG.md) for any configuration changes that affect your deployment
- [ ] Build and push new LiteMaaS v0.4.0 container images (or pull them from your registry)
- [ ] Check whether `LITELLM_DATABASE_URL` is set in your deployment (check your Helm values or Kustomize secrets) — if not, consider adding it

## Upgrade Steps

### Helm

```bash
helm upgrade litemaas deployment/helm/litemaas/ -n litemaas \
  --set backend.image.tag=0.4.0 \
  --set frontend.image.tag=0.4.0
```

With the default Helm values, this automatically:
- Switches the LiteLLM image to the custom fork (new default in `values.yaml`)
- Deploys Redis (`redis.enabled: true` by default)
- Auto-constructs `REDIS_HOST` from the release name
- Auto-constructs `LITELLM_DATABASE_URL` from PostgreSQL credentials (if `postgresql.enabled` is true)

**If you override `litellm.image` in your values file**, update it explicitly:

```yaml
litellm:
  image:
    repository: quay.io/rh-aiservices-bu/litellm-non-root
    tag: "main-v1.81.0-stable-custom"
```

**If you don't want Redis**, disable it:

```yaml
redis:
  enabled: false
```

Everything still works — cache flush is silently skipped.

**If you already have an external Redis**, disable the built-in one and point to yours:

```yaml
redis:
  enabled: false

backend:
  redis:
    host: "my-external-redis.example.com"
    port: "6379"
```

### Kustomize

1. **Update LiteMaaS images** in your deployment manifests to v0.4.0.

2. **Update the LiteLLM image** in `litellm-deployment.yaml`:
   ```yaml
   image: quay.io/rh-aiservices-bu/litellm-non-root:main-v1.81.0-stable-custom
   ```

3. **(Optional) Add Redis** — `redis-deployment.yaml` and `redis-service.yaml` are included in the Kustomize base. To enable, ensure they are listed in your `kustomization.yaml` and that `REDIS_HOST` is set in the backend deployment env vars:
   ```yaml
   resources:
     - redis-deployment.yaml
     - redis-service.yaml
   ```

4. **Verify `LITELLM_DATABASE_URL`** is set in your `backend-secret`. If you already use backup/restore, it should be there. If not, adding it is recommended to prevent deleted models from reappearing after sync.

5. Apply:
   ```bash
   oc apply -k deployment/kustomize/
   ```

## Verify

Wait for all pods to become ready, then verify:

```bash
# Backend health
curl <backend-url>/api/v1/health
# Expected: 200 with litellm: "healthy"

# LiteLLM health
curl <litellm-url>:4000/health/liveness
# Expected: 200
```

Then test through the UI:

- [ ] Model list loads correctly with capability labels (Chat, Embeddings, etc.)
- [ ] Create a model via Admin > Models — verify it appears immediately without needing a sync
- [ ] Delete a model — verify it does not reappear after a few seconds
- [ ] Create an API key — View Key modal shows correct curl example for the model type
- [ ] Chat Playground only shows chat-capable models
- [ ] If using Document Conversion models: create one with type "Document Conversion" and verify the `/health` endpoint test works

## Rollback

| Scenario | Action | Risk |
|----------|--------|------|
| LiteMaaS update fails | `helm rollback litemaas` | Low |
| LiteLLM fork issues | Revert `litellm.image` to previous upstream image — LiteMaaS still works but Docling/tokenize features are unavailable | Low |
| Redis issues | Set `redis.enabled: false` and remove `REDIS_HOST` — cache flush is silently skipped, model CRUD still works | Low |

## New Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_HOST` | Redis hostname for LiteLLM cache flush after model CRUD | - | No |
| `REDIS_PORT` | Redis port | `6379` | No |

`LITELLM_DATABASE_URL` is not new but its role has expanded — it is now also used by model sync to verify models against LiteLLM's database. See the [Configuration Guide](configuration.md#litellm-database--backup) for details.

## Optional Infrastructure: Redis

Redis can be used by both LiteLLM (model/key caching) and the LiteMaaS backend (cache flush after model CRUD). A single shared instance is sufficient.

- **Helm**: Deployed automatically when `redis.enabled: true` (default). Uses `redis:7-alpine` with 64Mi-128Mi memory limits. Disable with `redis.enabled: false`.
- **Kustomize**: Available via `redis-deployment.yaml` and `redis-service.yaml`. Add them to your `kustomization.yaml` if desired.
- **Without Redis**: Everything works. Cache flush after model CRUD is silently skipped. Model changes may take longer to propagate to all LiteLLM proxy pods (depends on LiteLLM's internal cache TTL).

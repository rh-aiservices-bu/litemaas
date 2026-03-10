# Kustomize OIDC Overlay

This overlay configures LiteMaaS to use a standard OpenID Connect (OIDC) provider (e.g., Keycloak, Auth0, Okta, Azure AD) instead of the default OpenShift OAuth.

## Prerequisites

1. Run the base `preparation.sh` script first to generate local files from templates
2. Configure your OIDC provider (client, groups, redirect URI)
3. Update `backend-secret.yaml.local` with your OIDC provider's client credentials:
   - `oauth-client-id`: Your OIDC client ID
   - `oauth-client-secret`: Your OIDC client secret
   - `oauth-issuer`: Your OIDC issuer URL (e.g., `https://keycloak.example.com/realms/myrealm`)
   - `oauth-callback-url`: Your LiteMaaS callback URL (e.g., `https://litemaas.example.com/api/auth/callback`)

## Usage

```bash
# From the repository root
oc apply -k deployment/kustomize/overlays/oidc/
```

## Customization

Edit `backend-oidc-patch.yaml` to adjust:

| Variable | Default | Description |
|---|---|---|
| `AUTH_PROVIDER` | `oidc` | Authentication provider type |
| `OIDC_GROUPS_CLAIM` | `groups` | Claim name containing user groups |
| `OIDC_SCOPES` | `openid profile email` | Scopes to request (add `groups` if required by provider) |

## Further Reading

- [Authentication Guide](../../../docs/deployment/authentication.md)
- [Keycloak OIDC Setup](../../../docs/deployment/keycloak-oidc-setup.md)
- [Configuration Reference](../../../docs/deployment/configuration.md)

# Keycloak OIDC Setup Guide

Quick-start reference for configuring Keycloak as an OIDC authentication provider for LiteMaaS.

**Prerequisites**: A running Keycloak instance (v21+) with admin access.

## 1. Create a Realm (or use an existing one)

If you don't already have a realm for your organization:

1. Log in to the Keycloak Admin Console
2. Click the realm dropdown (top-left) and select **Create Realm**
3. Enter a **Realm name** (e.g., `litemaas`) and click **Create**

Your OIDC issuer URL will be:

```
https://<keycloak-host>/realms/<realm-name>
```

## 2. Create the LiteMaaS Client

1. Navigate to **Clients** and click **Create client**
2. Fill in:
   - **Client type**: OpenID Connect
   - **Client ID**: `litemaas`
3. Click **Next**, then configure:
   - **Client authentication**: ON (this makes it a confidential client)
   - **Authorization**: OFF
   - **Authentication flow**: Check only **Standard flow** (Authorization Code)
4. Click **Next**, then set:
   - **Root URL**: `https://your-litemaas-domain.com`
   - **Valid redirect URIs**:
     ```
     https://your-litemaas-domain.com/api/auth/callback
     http://localhost:3000/api/auth/callback
     http://localhost:8081/api/auth/callback
     ```
   - **Web origins**: `+` (allows all valid redirect URI origins) or list your specific origins
5. Click **Save**

### Get the Client Secret

1. Go to the **Credentials** tab of the `litemaas` client
2. Copy the **Client secret** value — you'll need this for `OAUTH_CLIENT_SECRET`

## 3. Configure Group Membership in Tokens

By default, Keycloak does not include group memberships in the userinfo response. You need to add a protocol mapper.

### Option A: Client-level Mapper (recommended)

1. Go to **Clients** > `litemaas` > **Client scopes** tab
2. Click `litemaas-dedicated` (the dedicated scope for this client)
3. Click **Add mapper** > **By configuration**
4. Select **Group Membership**
5. Configure:
   - **Name**: `groups`
   - **Token Claim Name**: `groups`
   - **Full group path**: OFF (gives clean group names like `litemaas-admins` instead of `/litemaas-admins`)
   - **Add to ID token**: ON
   - **Add to access token**: ON
   - **Add to userinfo**: ON
6. Click **Save**

### Option B: Realm-level Mapper (applies to all clients)

1. Go to **Client scopes** > `profile` > **Mappers**
2. Click **Add mapper** > **By configuration** > **Group Membership**
3. Same settings as Option A

## 4. Create Groups and Assign Users

Create groups matching LiteMaaS role mapping:

1. Go to **Groups** and create:

   | Group Name          | LiteMaaS Role        |
   |---------------------|----------------------|
   | `litemaas-admins`   | Admin (full access)  |
   | `litemaas-readonly`  | Admin (read-only)    |
   | `litemaas-users`    | Standard user        |

2. Assign users to groups:
   - Go to **Users** > select a user > **Groups** tab
   - Click **Join Group** and select the appropriate group

> **Note**: All authenticated users automatically receive the `user` role in LiteMaaS regardless of group membership. Groups are used to grant elevated roles.

## 5. Configure LiteMaaS

### Environment Variables

```bash
AUTH_PROVIDER=oidc
OAUTH_CLIENT_ID=litemaas
OAUTH_CLIENT_SECRET=<client-secret-from-step-2>
OAUTH_ISSUER=https://<keycloak-host>/realms/<realm-name>
OAUTH_CALLBACK_URL=https://your-litemaas-domain.com/api/auth/callback

# These are the defaults and can be omitted unless customized
OIDC_GROUPS_CLAIM=groups
OIDC_SCOPES=openid profile email
```

### Helm Values

```yaml
oauth:
  mode: external
  authProvider: oidc
  issuer: "https://<keycloak-host>/realms/<realm-name>"
  oidc:
    groupsClaim: groups
    scopes: ""  # defaults to "openid profile email"

backend:
  auth:
    oauthClientId: "litemaas"
    oauthClientSecret: "<client-secret-from-step-2>"
```

### Kustomize

In `backend-secret.yaml.template`, update:

```yaml
stringData:
  oauth-client-id: litemaas
  oauth-client-secret: <client-secret>
  oauth-issuer: https://<keycloak-host>/realms/<realm-name>
  oauth-callback-url: https://litemaas-${NAMESPACE}.${CLUSTER_DOMAIN_NAME}/api/auth/callback
```

In `backend-deployment.yaml.template`, uncomment and set:

```yaml
- name: AUTH_PROVIDER
  value: 'oidc'
```

## 6. Verify the Setup

### Check OIDC Discovery

Confirm Keycloak's discovery endpoint is accessible:

```bash
curl -s https://<keycloak-host>/realms/<realm-name>/.well-known/openid-configuration | jq '{
  authorization_endpoint,
  token_endpoint,
  userinfo_endpoint
}'
```

### Test the Login Flow

1. Navigate to your LiteMaaS instance and click **Login**
2. You should be redirected to the Keycloak login page
3. After authenticating, you should be redirected back to LiteMaaS
4. Check your user profile to verify roles were assigned correctly

### Verify Group Claims

Test that groups appear in the userinfo response:

```bash
# Get a token (use the direct access grant for testing — enable it temporarily in the client)
TOKEN=$(curl -s -X POST \
  "https://<keycloak-host>/realms/<realm-name>/protocol/openid-connect/token" \
  -d "client_id=litemaas" \
  -d "client_secret=<secret>" \
  -d "grant_type=password" \
  -d "username=<test-user>" \
  -d "password=<test-password>" | jq -r '.access_token')

# Check userinfo
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://<keycloak-host>/realms/<realm-name>/protocol/openid-connect/userinfo" | jq .
```

The response should include a `groups` array:

```json
{
  "sub": "12345-abcde-67890",
  "email_verified": true,
  "name": "John Doe",
  "preferred_username": "john.doe",
  "email": "john.doe@example.com",
  "groups": ["litemaas-admins"]
}
```

> **Important**: Disable the direct access grant (`Direct Access Grants Enabled: OFF`) on the client after testing. It is only needed for this verification step.

## Troubleshooting

### Groups not appearing in userinfo

- Verify the **Group Membership** mapper is configured with **Add to userinfo: ON**
- Check **Full group path** is OFF (otherwise groups will appear as `/litemaas-admins` which won't match)
- Ensure the user is actually assigned to the group in Keycloak

### Login redirects to an error page

- Verify **Valid redirect URIs** includes the exact callback URL being used
- Check that the LiteMaaS backend can reach the Keycloak discovery endpoint (network/firewall)
- Review backend logs: `grep -i "oidc\|discovery\|auth" logs/backend.log | tail -n 30`

### User gets only the "user" role despite being in litemaas-admins

- Check the `OIDC_GROUPS_CLAIM` value matches the mapper's **Token Claim Name** (both should be `groups`)
- Verify the group name is exactly `litemaas-admins` (case-sensitive)

### SSL/TLS errors

- If Keycloak uses a self-signed certificate, you may need to set `NODE_TLS_REJECT_UNAUTHORIZED=0` in the backend environment (not recommended for production)
- For production, configure proper certificates or add the CA to the trusted store

## Further Reading

- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [LiteMaaS Authentication Guide](authentication.md)
- [LiteMaaS Configuration Reference](configuration.md)

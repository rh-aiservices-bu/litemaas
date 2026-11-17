# Dev Tools

This directory contains development utilities and scripts for the LiteMaaS project.

## Database Initialization

The database schema is automatically initialized by the backend on first startup. The schema is defined in `backend/src/lib/database-migrations.ts` to avoid duplication.

### Automatic Initialization

When you start the backend for the first time, it will:

1. Connect to PostgreSQL
2. Create all necessary tables
3. Initialize model data from LiteLLM

### Manual Database Setup

If you need to set up the database manually:

```bash
# Create the database
createdb litemaas

# The backend will create tables on startup
cd backend && npm run dev

# For development with test data
cd backend && npm run db:setup
```

### Export Current Schema

To export the current schema for reference:

```bash
node dev-tools/export-schema.js > dev-tools/schema-export.sql
```

This creates a SQL file with the current schema that can be used for:

- Documentation
- Manual database setup
- Database comparisons
- CI/CD pipelines

## Revoke All API Keys

`revoke-all-keys.sh` revokes active LiteLLM API keys managed by LiteMaaS. Keys
are deleted from LiteLLM first (they stop working immediately), then archived
in the LiteMaaS database (soft revoke — same as the UI delete button).

**Scopes** (both use the same authentication):

| Mode | Effect | Requires |
|---|---|---|
| (default) | revoke all active keys owned by the authenticated user | any user |
| `--all-users` | revoke active keys of **every user on the system** | admin (`users:write`) |
| `--user <id>` | revoke active keys of one user | admin (`users:write`) |

`--permanent` hard-deletes instead of soft revoking (admin endpoints only).
Admin revocations are audit-logged (`ADMIN_REVOKE_API_KEY` /
`ADMIN_DELETE_API_KEY`).

Authentication (SSO happens in the browser; the CLI needs a bearer token).
The script targets `https://litemaas-portal.rhoai.rh-aiservices-bu.com` by
default — override with `-u` or `LITEMAAS_URL` (e.g. `http://localhost:8081`
for local dev):

1. **Paste a token** — log into the LiteMaaS UI, run
   `localStorage.getItem('access_token')` in the browser console, paste when
   prompted (or pass `-t`).
2. **Dev token** — `--dev-user <name>` mints a token via
   `POST /api/v1/auth/dev-token` (dev environments only).
3. **Refresh token** — `-r <token>` exchanges it for an access token.

```bash
dev-tools/revoke-all-keys.sh -n          # list keys, revoke nothing
dev-tools/revoke-all-keys.sh             # prompt for token, confirm, revoke
```

Exit code is non-zero if any revocation fails; failed keys stay active and
can be retried by re-running the script.

## Other Dev Tools

(Add other development tools documentation here as needed)

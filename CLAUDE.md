# CLAUDE.md - LiteMaaS AI Context File

> **Note for AI Assistants**: This is the root context file providing project overview. For detailed implementation context:
>
> - **Backend Context**: [`backend/CLAUDE.md`](backend/CLAUDE.md) - Fastify API implementation details
> - **Frontend Context**: [`frontend/CLAUDE.md`](frontend/CLAUDE.md) - React/PatternFly 6 implementation details
> - **Project Structure**: [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md) - Complete directory structure
> - **Documentation**: See `docs/` for comprehensive guides

## 🚀 Project Overview

**LiteMaaS** is a model subscription and management platform that bridges users and AI model services through LiteLLM integration.

**Monorepo** with two packages:
- **Backend** (`@litemaas/backend`): Fastify API server with PostgreSQL, OAuth2/JWT, RBAC
- **Frontend** (`@litemaas/frontend`): React + PatternFly 6 UI with 9-language i18n support

**Tech Stack**: Fastify, React, TypeScript, PostgreSQL, PatternFly 6, LiteLLM integration

## 📁 Project Structure

See [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md) for complete directory structure and file organization.

## 🔧 Key Features

**Role-Based Access Control (RBAC)**: Three-tier hierarchy `admin > adminReadonly > user` with OpenShift integration.

For detailed features, see:
- [`backend/CLAUDE.md`](backend/CLAUDE.md) - API implementation details
- [`frontend/CLAUDE.md`](frontend/CLAUDE.md) - UI implementation details
- [`docs/features/user-roles-administration.md`](docs/features/user-roles-administration.md) - Complete RBAC guide

## 🚀 Quick Start

**Development:**

```bash
npm install        # Install dependencies
npm run dev        # Start both backend and frontend with auto-reload
```

**Production (OpenShift):**

```bash
oc apply -k deployment/openshift/  # Deploy to OpenShift/Kubernetes
```

**Development (Container):**

```bash
docker compose up -d  # Local development with containers (using compose.yaml)
```

_See `docs/development/` for detailed setup and `docs/deployment/configuration.md` for environment variables_

## 🚨 CRITICAL DEVELOPMENT NOTES

### Bash Tool Limitation

**⚠️ CRITICAL**: stderr redirects are broken in the Bash tool - you can't use `2>&1` in bash commands. The Bash tool will mangle the stderr redirect and pass a "2" as an arg, and you won't see stderr.

**Workaround**: Use the wrapper script: `./dev-tools/run_with_stderr.sh command args` to capture both stdout and stderr.

See <https://github.com/anthropics/claude-code/issues/4711> for details.

### Changes tests

**IMPORTANT**: In development, both backend and frontend servers run with auto-reload enabled. Any code changes are automatically detected and applied without needing to restart the servers. In most cases YOU DON'T NEED to start or restart the servers. Backend is listening on port 8081, and frontend is listening on port 3000.

USE Playwright to test your modifications live.

## 🔒 Security & Authentication

**OAuth2 + JWT** with role-based access control. Three-tier hierarchy: `admin > adminReadonly > user`.

For details, see [`docs/deployment/authentication.md`](docs/deployment/authentication.md) and [`docs/features/user-roles-administration.md`](docs/features/user-roles-administration.md).

## 📚 Documentation

**Complete guide index**: [`docs/README.md`](docs/README.md)

**Key documentation**:
- **Project Structure**: [`docs/architecture/project-structure.md`](docs/architecture/project-structure.md)
- **Development Setup**: [`docs/development/setup.md`](docs/development/setup.md)
- **API Reference**: [`docs/api/rest-api.md`](docs/api/rest-api.md)
- **Authentication**: [`docs/deployment/authentication.md`](docs/deployment/authentication.md)
- **RBAC Guide**: [`docs/features/user-roles-administration.md`](docs/features/user-roles-administration.md)

## 🎯 For AI Assistants

When working on:

- **Backend tasks** → Load `backend/CLAUDE.md` for Fastify/service details
- **Frontend tasks** → Load `frontend/CLAUDE.md` for React/PatternFly details
- **Role/Admin tasks** → Load `docs/features/user-roles-administration.md` for RBAC details
- **Authentication tasks** → Load `docs/deployment/authentication.md` for OAuth/role setup
- **Full-stack tasks** → Start with this file, then load specific contexts as needed

### Security Note for AI Assistants

⚠️ **Role-Based Development**: When implementing features that involve user roles or administrative functions:

1. **Always implement backend validation first** - Frontend role checks are UX only
2. **Use role hierarchy** - Check for most powerful role when multiple roles exist
3. **Follow data access patterns** - Users see own data, admins see all data
4. **Test with different roles** - Verify access control with user, adminReadonly, and admin accounts
5. **Document role requirements** - Clearly specify which roles can access new endpoints/features

---

_This is an AI context file optimized for development assistance. For comprehensive documentation, see the `docs/` directory._

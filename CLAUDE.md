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

**Admin Usage Analytics** (Major feature - 2025 Q3): Enterprise-grade analytics with comprehensive system-wide visibility:

- **Day-by-day incremental caching** with intelligent TTL (permanent historical, 5-min current day)
- **Multi-dimensional filtering**: users, models, providers, API keys with cascading filter dependencies
- **Trend analysis** with automatic comparison period calculations
- **Rich visualizations**: usage trends, model distribution, weekly heatmap (component ready, integration pending)
- **Data export**: CSV/JSON with filter preservation
- **Configurable cache TTL** via ConfigContext integration with React Query

**State Management**: React Context for auth/notifications/config, React Query for server state with dynamic cache TTL from backend configuration.

**Shared Chart Utilities**: Consistent formatting, accessibility, and styling across all chart components via shared utility modules.

For detailed features, see:

- [`backend/CLAUDE.md`](backend/CLAUDE.md) - API implementation, service layer, caching patterns
- [`frontend/CLAUDE.md`](frontend/CLAUDE.md) - UI components, state management, PatternFly 6
- [`docs/features/user-roles-administration.md`](docs/features/user-roles-administration.md) - Complete RBAC guide
- [`docs/features/admin-usage-analytics-implementation-plan.md`](docs/features/admin-usage-analytics-implementation-plan.md) - Comprehensive admin analytics implementation (2000 lines)
- [`docs/development/chart-components-guide.md`](docs/development/chart-components-guide.md) - Chart component patterns and utilities
- [`docs/development/pattern-reference.md`](docs/development/pattern-reference.md) - Authoritative code patterns and anti-patterns

## 🚀 Quick Start

**Development:**

```bash
npm install        # Install dependencies
npm run dev        # Start both backend and frontend with auto-reload and logging
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

### Development Server and Logging Setup

**⚠️ IMPORTANT FOR CLAUDE CODE AND AI ASSISTANTS**:

The development servers are configured to run with hot-reload and write logs to files for AI assistant visibility.

**Current Setup:**

- **Backend**: Running on port 8081 with `tsx watch` and `pino-pretty` logging
- **Frontend**: Running on port 3000 with Vite dev server
- **Logs**: Both servers write to `logs/` directory in the monorepo root

**For AI Assistants (Claude Code):**

```bash
# DO NOT start new server processes - they are already running!

# To check backend logs (most recent 100 lines):
tail -n 100 logs/backend.log

# To check frontend logs:
tail -n 100 logs/frontend.log

# To watch logs in real-time:
tail -f logs/backend.log
tail -f logs/frontend.log

# To search for errors:
grep -i error logs/backend.log | tail -n 20
grep -i error logs/frontend.log | tail -n 20

# To check server status (if needed):
curl http://localhost:8081/api/v1/health  # Backend health check
curl http://localhost:3000          # Frontend dev server
```

**Server URLs:**

- Backend API: `http://localhost:8081`
- Frontend Dev Server: `http://localhost:3000`
- API Documentation: `http://localhost:8081/docs`

**Starting/Stopping Servers (for human developers):**

```bash
# Start with logging (recommended for AI-assisted development):
npm run dev:logged

# Start without logging (for regular development):
npm run dev

# Clear log files:
npm run logs:clear
```

### Bash Tool Limitation

**⚠️ CRITICAL**: stderr redirects are broken in the Bash tool - you can't use `2>&1` in bash commands. The Bash tool will mangle the stderr redirect and pass a "2" as an arg, and you won't see stderr.

**Workaround**: Use the wrapper script: `./dev-tools/run_with_stderr.sh command args` to capture both stdout and stderr.

See <https://github.com/anthropics/claude-code/issues/4711> for details.

### Changes and Testing

**IMPORTANT**: In development, both backend and frontend servers run with auto-reload enabled. Any code changes are automatically detected and applied without needing to restart the servers.

**YOU DON'T NEED TO**:

- Start new server processes (they're already running)
- Restart servers after code changes (auto-reload handles this)
- Run `npm run dev` again (servers are persistent)

**INSTEAD, DO**:

- Read the log files to see server output
- Use Playwright to test your modifications live
- Check the logs for compilation errors or runtime issues

## 🔐 Security & Authentication

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

### ⚠️ BEFORE YOU CODE - Server and Log Check

**FIRST STEP**: Always check if servers are running and read recent logs:

```bash
# Check recent backend activity
tail -n 50 logs/backend.log

# Check recent frontend activity
tail -n 50 logs/frontend.log

# Look for any errors
grep -i error logs/*.log | tail -n 20
```

### ⚠️ BEFORE YOU CODE - Pattern Discovery Checklist

**MANDATORY**: Before implementing ANY new feature, you MUST:

1. **Search for existing implementations**:
   - Use `find_symbol` to locate similar components/services
   - Use `search_for_pattern` to find code patterns
   - Check relevant memory files: `code_style_conventions`, `error_handling_architecture`

2. **Follow established patterns**:
   - **Backend**: ALWAYS extend `BaseService`, use `ApplicationError` factory methods
   - **Frontend**: ALWAYS use `useErrorHandler` hook, follow PatternFly 6 prefix (`pf-v6-`)
   - **Testing**: ALWAYS test error scenarios, use `./dev-tools/run_with_stderr.sh` for stderr

3. **Verify against pattern reference**:
   - See [`docs/development/pattern-reference.md`](docs/development/pattern-reference.md) for comprehensive patterns
   - Check existing code in similar features before creating new patterns

### Working on Specific Tasks

When working on:

- **Backend tasks** → Load `backend/CLAUDE.md` for Fastify/service details
- **Frontend tasks** → Load `frontend/CLAUDE.md` for React/PatternFly details
- **Role/Admin tasks** → Load `docs/features/user-roles-administration.md` for RBAC details
- **Authentication tasks** → Load `docs/deployment/authentication.md` for OAuth/role setup
- **Full-stack tasks** → Start with this file, then load specific contexts as needed

### Debugging Workflow for AI Assistants

1. **Check logs first** - Don't start new processes:

   ```bash
   tail -n 100 logs/backend.log
   tail -n 100 logs/frontend.log
   ```

2. **If you see compilation errors** - Fix the code and check logs again (auto-reload will recompile)

3. **If you see runtime errors** - Read the stack trace from logs and fix

4. **If servers appear down** - Tell the user to restart manually:

   ```bash
   # User should run this, not the AI:
   npm run dev:logged
   ```

### Context7 Usage Guidelines

⚠️ **Important for AI tools using Context7**:

- ✅ **Use Context7 for**: Backend libraries (Fastify, PostgreSQL, LiteLLM), non-UI frontend libraries (React Query, Axios, Vite)
- ❌ **Don't use Context7 for**: PatternFly 6 components (use `docs/development/pf6-guide/` + PatternFly.org instead)

Context7 may contain outdated PatternFly versions. For all PatternFly 6 UI development, refer to the local PF6 guide and official PatternFly.org documentation.

### Security Note for AI Assistants

⚠️ **Role-Based Development**: When implementing features that involve user roles or administrative functions:

1. **Always implement backend validation first** - Frontend role checks are UX only
2. **Use role hierarchy** - Check for most powerful role when multiple roles exist
3. **Follow data access patterns** - Users see own data, admins see all data
4. **Test with different roles** - Verify access control with user, adminReadonly, and admin accounts
5. **Document role requirements** - Clearly specify which roles can access new endpoints/features

---

_This is an AI context file optimized for development assistance. For comprehensive documentation, see the `docs/` directory._

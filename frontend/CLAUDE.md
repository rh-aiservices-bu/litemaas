# CLAUDE.md - LiteMaaS Frontend Context

> **Note for AI Assistants**: This is a frontend-specific context file for the LiteMaaS React application. For project overview, see root CLAUDE.md. For backend context, see backend/CLAUDE.md.

## 🎯 Frontend Overview

**@litemaas/frontend** - React 18 application with TypeScript, Vite, and PatternFly 6 component library.

**Development Server**: Running on port 3000 with Vite HMR (Hot Module Replacement) and auto-refresh

## 🚨 CRITICAL FOR AI ASSISTANTS - Server and Logging

**⚠️ The frontend dev server is already running!** Do not start new processes.

### Checking Frontend Status and Logs

```bash
# DO NOT run npm run dev - server is already running!

# Check recent frontend logs (last 100 lines):
tail -n 100 ../logs/frontend.log

# Watch frontend logs in real-time:
tail -f ../logs/frontend.log

# Check for compilation errors:
grep -i "error\|failed" ../logs/frontend.log | tail -n 20

# Check for warnings (React, deprecations):
grep -i "warning" ../logs/frontend.log | tail -n 20

# Check Vite HMR updates:
grep "hmr" ../logs/frontend.log | tail -n 20

# Verify server is responding:
curl http://localhost:3000
```

### Server Information

- **Dev Server URL**: `http://localhost:3000`
- **HMR**: Enabled - changes to components instantly reflect in browser
- **Auto-refresh**: Browser automatically updates on file save
- **Log Location**: `../logs/frontend.log` (relative to frontend directory)
- **Build Output**: Check logs for TypeScript/ESLint errors

### Debugging Workflow

1. **Make component changes** - Save the file
2. **Check logs for compilation** - `tail -n 50 ../logs/frontend.log`
3. **If TypeScript errors** - Fix types and save, Vite will recompile
4. **If ESLint warnings** - Fix or add disable comment if intentional
5. **Check browser** - HMR should auto-update, check browser console for runtime errors
6. **If HMR fails** - Browser will show error overlay with details

### Common Frontend Log Patterns

```bash
# Check for failed API calls:
grep -i "axios\|fetch\|401\|403\|404\|500" ../logs/frontend.log | tail -n 20

# Check for React errors:
grep -i "react\|hook\|render\|component" ../logs/frontend.log | tail -n 20

# Check for PatternFly issues:
grep -i "patternfly\|pf-v6" ../logs/frontend.log | tail -n 20

# Check for build/bundle issues:
grep -i "vite\|rollup\|bundle\|chunk" ../logs/frontend.log | tail -n 20
```

## 📁 Frontend Structure

See [`docs/architecture/project-structure.md`](../docs/architecture/project-structure.md) for complete frontend directory structure.

## 🎨 PatternFly 6 Critical Requirements

⚠️ **MANDATORY**: Follow the [PatternFly 6 Development Guide](../docs/development/pf6-guide/README.md) as the **AUTHORITATIVE SOURCE** for all UI development.

### Essential Rules

1. **Class Prefix**: ALL PatternFly classes MUST use `pf-v6-` prefix
2. **Design Tokens**: Use semantic tokens only, never hardcode colors
3. **Component Import**: Import from `@patternfly/react-core` v6 and other @patternfly libraries
4. **Theme Testing**: Test in both light and dark themes
5. **Table Patterns**: Follow guide's table implementation (current code may be outdated)

### Common Mistakes and Token Usage

**Critical rules** - See [`docs/development/pf6-guide/guidelines/styling-standards.md`](../docs/development/pf6-guide/guidelines/styling-standards.md) for complete guide:

- ✅ ALWAYS use `pf-v6-` prefix for component classes
- ✅ ALWAYS use `--pf-t--` prefix for design tokens (semantic tokens with `-t-`)
- ✅ Choose tokens by meaning (e.g., `--pf-t--global--color--brand--default`), not appearance
- ❌ NEVER hardcode colors or measurements
- ❌ NEVER use legacy `--pf-v6-global--` tokens or numbered base tokens

## 🗃️ State Management

**React Context**:

- **AuthContext** - Authentication state (user, roles, isAuthenticated)
- **NotificationContext** - App-wide notification system
- **BrandingContext** - Branding settings from `/api/v1/branding` endpoint (5-min stale time, fallback to defaults)
- **ConfigContext** - Application configuration from `/api/v1/config` endpoint
  - **Base Config**: `usageCacheTtlMinutes`, `version`, `environment`
  - **Admin Analytics Config**: All UI-relevant admin analytics settings (pagination, limits, thresholds)
  - Integrates with React Query `staleTime`: `config.usageCacheTtlMinutes * 60 * 1000`
  - Pattern: Dynamic cache TTL eliminates hardcoded values in query hooks

**React Query**: Server state management with dynamic stale time from ConfigContext, 10min cache time, 3 retries

### Admin Analytics Configuration

**Hook**: `useAdminAnalyticsConfig()` provides pagination limits, date range limits, trend thresholds, and export limits from backend.

**Integration**: Dynamic configuration eliminates hardcoded values, integrates with React Query `staleTime` via ConfigContext.

**Admin Component Structure**:

- `components/admin/` - Admin-specific UI components
  - `MetricsOverview.tsx` - Shared usage analytics dashboard with trend indicators and auth-aware admin sections
  - `TopUsersTable.tsx` - Admin-only user usage breakdown table rendered by `MetricsOverview`
  - `UserFilterSelect.tsx` - Multi-select user filter with search
  - `ApiKeyFilterSelect.tsx` - Cascading API key filter (depends on selected users)
  - `ProviderBreakdownTable.tsx` - Provider metrics (component ready, integration pending)
- `components/admin/` - Admin user management components
  - `UserProfileTab.tsx` - User profile display with role toggles
  - `UserBudgetLimitsTab.tsx` - Budget and rate limit configuration with utilization tracking
  - `UserApiKeysTab.tsx` - API key lifecycle management (create, view, revoke)
  - `UserSubscriptionsTab.tsx` - Read-only subscription list with status display
- `components/charts/` - Shared chart components
  - `UsageTrends.tsx`, `ModelDistributionChart.tsx`, `ModelUsageTrends.tsx`
  - `UsageHeatmap.tsx` - Weekly heatmap (component ready, integration pending)
  - `AccessibleChart.tsx` - Accessibility wrapper for Victory charts

## 🔌 API Service Layer

**Axios Configuration**: Base client with JWT token interceptors and 401 error handling.

**Service Pattern**: Consistent service structure for all API endpoints:

- `auth.service.ts` - Authentication (OAuth, profile)
- `models.service.ts` - Model catalog (includes `supportsChat`, `supportsEmbeddings`, `supportsTokenize`, `supportsConvert` capability flags)
- `subscriptions.service.ts` - User subscriptions (includes request-review endpoint)
- `adminSubscriptions.service.ts` - **Admin subscription approval** (approval requests, bulk operations, stats)
- `apiKeys.service.ts` - API key management
- `usage.service.ts` - **User usage analytics** (individual user data)
- `adminUsage.service.ts` - **Admin usage analytics** (system-wide data, all endpoints)
- `users.service.ts` - **Admin user management** (user details, budget/limits, API keys, subscriptions)
- `branding.service.ts` - **Branding customization** (settings, image upload/delete)
- `chat.service.ts` - Chatbot integration
- `config.service.ts` - Application configuration and API key quota defaults
- `admin.service.ts` - Admin operations (API key quota defaults CRUD, bulk user limits, system stats)
- `backup.service.ts` - **Database backup & restore** (capabilities, create, list, download, delete, restore, test-restore)

## 🌍 Routing Structure

**Main Routes**: `/home`, `/models`, `/subscriptions`, `/api-keys`, `/usage`, `/admin/*`

**Admin Routes** (admin/adminReadonly roles required):

- `/admin/usage` - **Usage Analytics (AdminUsagePage.tsx)** - Major feature with comprehensive system-wide analytics:
  - Global metrics with trend analysis
  - Multi-dimensional filtering (users, models, providers, API keys)
  - Day-by-day incremental caching (5-min TTL for current day)
  - Data export (CSV/JSON)
  - ConfigContext integration for dynamic cache TTL
- `/admin/models` - **Model Management (AdminModelsPage.tsx)** - Model CRUD with type selection (Chat/Embeddings/Document Conversion), Tokenize capability, configuration testing, and adaptive form fields
- `/admin/subscriptions` - **Subscription Management (AdminSubscriptionsPage.tsx)** - Approve/deny restricted model access:
  - Multi-dimensional filtering (status, model, user, date range)
  - Bulk approve/deny operations with result modals
  - Granular RBAC (admin vs adminReadonly)
  - Manual refresh only (no polling)
  - Full audit trail display
- `/admin/users` - **Users Management (UsersPage.tsx)** - Consolidated modal-based interface:
  - Tabbed management: Profile, Budget & Limits, API Keys, Subscriptions
  - Role management with admin/adminReadonly/user toggles
  - Budget and rate limit configuration with progress indicators
  - API key creation with auto-subscription and revocation
  - RBAC: admin (full access) vs adminReadonly (view only)
- `/admin/tools` - **Settings and Tools (ToolsPage.tsx)** - Tabs: Limits, Banners, Branding, Currency, Models Sync, Backup
  - Limits tab: Bulk User Limits (max budget, TPM, RPM for all users) and API Key Quota Defaults (admin-configurable defaults and maximums)
  - Backup tab: Create/restore/test-restore/download/delete database backups for LiteMaaS and LiteLLM (admin only, visible read-only for adminReadonly)

**Protection**: `ProtectedRoute` for auth, `RoleProtectedRoute` for admin routes with required roles

## 🌐 Internationalization (i18n)

**Languages**: EN, ES, FR, DE, IT, JA, KO, ZH, ELV (9 languages)

**Usage**: `useTranslation()` hook with `t('key')` function

**Translation Check**: `npm run check:translations` - check for missing keys and duplicates

For details, see [`docs/development/translation-management.md`](../docs/development/translation-management.md).

## 🎯 Component Patterns

**Page Structure**: Standard hooks pattern with React Query, local state, and handlers

**Form Handling**: Validation, error state, submit handling

**Modal Patterns**: Used in AdminModelsPage for model configuration testing with async validation

For implementation examples, see [`docs/development/pf6-guide/`](../docs/development/pf6-guide/).

## 📊 Chart Component Development

**Shared Utilities**: Use `chartFormatters.ts`, `chartConstants.ts`, and `chartAccessibility.ts` for consistent formatting, styling, and ARIA support across all charts.

See [`docs/development/chart-components-guide.md`](../docs/development/chart-components-guide.md) for complete patterns and API reference.

## ⚠️ Component Development Checklist - MUST FOLLOW

**All patterns and code examples**: See [`docs/development/pattern-reference.md`](../docs/development/pattern-reference.md) for authoritative implementation patterns.

### Before Creating ANY Component

1. **Search for similar components first** - Use `find_symbol` and `search_for_pattern`
2. **Follow PatternFly 6 requirements** - ALWAYS use `pf-v6-` prefix, semantic tokens, v6 imports
3. **Use established patterns** - Check pattern-reference.md first

**Critical Rules**:

1. **Error Handling**: MUST use `useErrorHandler` hook - never console.error or alert()
2. **Data Fetching**: MUST use React Query - never manual fetch/useState
3. **Internationalization**: MUST use `t()` function - never hardcode text
4. **Accessibility**: MUST include ARIA labels and live regions
5. **Forms**: MUST validate with `FieldErrors` component and handleValidationError
6. **Cascading Filters**: Follow ApiKeyFilterSelect pattern (filter options based on other selections)

**Pattern Examples Available**:

- Component structure with React Query and error handling
- Form validation with server-side error display
- Cascading filter pattern (dependent filters)
- ConfigContext integration with React Query staleTime
- Admin-only components with role checks
- Accessibility patterns with ARIA and screen reader announcements

## 🚀 Development Commands

```bash
# ⚠️ FOR AI ASSISTANTS: These commands are for human developers
# The dev server is already running - just read the logs!

# Development server with HMR (ALREADY RUNNING)
npm run dev:logged      # With logging to ../logs/frontend.log
npm run dev             # Without logging

# Check logs (USE THESE INSTEAD OF STARTING SERVERS)
npm run logs            # View frontend logs
npm run logs:clear      # Clear log file

# Building
npm run build          # Production build
npm run preview        # Preview production build

# Testing
npm run test           # Run all tests
npm run test:unit      # Unit tests only
npm run test:e2e       # Playwright E2E tests
npm run test:e2e:ui    # Playwright UI mode
npm run test:coverage  # Coverage report

# Code quality
npm run lint           # ESLint check
npm run lint:fix       # Auto-fix issues

# Cleanup
npm run clean          # Remove build artifacts

# Internationalization (i18n)
npm run check:translations  # Check all locale files for missing keys
```

## 🧪 Testing

**Framework**: Vitest with React Testing Library and centralized test utilities in `src/test/test-utils.tsx`.

**Key Patterns**:

- **Auth Testing**: Use `renderWithAuth()` helper with `mockUser`, `mockAdminUser`, `mockAdminReadonlyUser`
- **ConfigContext**: Mock entire context (not just service) to avoid loading state
- **PatternFly 6**: Modals/dropdowns work in JSDOM; modals use `role="dialog"`, dropdowns use `role="menuitem"`
- **Debugging**: Use `screen.debug()` to inspect DOM, `npm test -- File.test.tsx` for specific files

**Test Guides**:

- [`docs/development/pf6-guide/testing-patterns/modals.md`](../docs/development/pf6-guide/testing-patterns/modals.md) - Modal testing patterns
- [`docs/development/pf6-guide/testing-patterns/dropdowns-pagination.md`](../docs/development/pf6-guide/testing-patterns/dropdowns-pagination.md) - Dropdown/pagination patterns
- [`docs/development/pf6-guide/testing-patterns/context-dependent-components.md`](../docs/development/pf6-guide/testing-patterns/context-dependent-components.md) - Context-dependent components
- [`docs/development/pf6-guide/testing-patterns/switch-components.md`](../docs/development/pf6-guide/testing-patterns/switch-components.md) - Switch component patterns

**Coverage**: 98.5% passing (975/990 tests, 15 skipped). See [`docs/archive/implementation-plans/test-improvement-plan.md`](../docs/archive/implementation-plans/test-improvement-plan.md) for known limitations.

## 🎨 Styling Guidelines

Use PatternFly 6 design tokens, avoid hardcoded values. Support dark theme with `[data-theme='dark']` overrides.

## 🔧 Key Implementation Notes

**Authentication Flow**: OAuth/OIDC provider → JWT token → localStorage → Auth context
- Frontend initiates login via `POST /api/auth/login` → receives `authUrl` → redirects to provider
- After authentication, backend redirects to `/auth/callback#token=<jwt>&expires_in=<seconds>`
- `AuthCallbackPage.tsx` extracts token from URL hash, stores in localStorage, redirects to dashboard
- `AuthContext` manages auth state (user, roles, isAuthenticated) with token validation via `/api/v1/auth/me`
- Supports both OpenShift OAuth and standard OIDC providers (configured server-side via `AUTH_PROVIDER`)

**Error Boundaries**: Global `<ErrorBoundary>` and component-level `<ComponentErrorBoundary>`

**Data Fetching**: React Query with pagination, prefetching, and optimistic updates

**Accessibility**: ARIA live regions with `ScreenReaderAnnouncement` component

For detailed patterns, see [`docs/development/accessibility/`](../docs/development/accessibility/).

## 🔗 Environment Variables

Key configuration: `VITE_API_BASE_URL`, `VITE_AUTH_URL`, `VITE_ENABLE_MOCK_AUTH`, `VITE_DEFAULT_LOCALE`

See [`docs/deployment/configuration.md`](../docs/deployment/configuration.md) for complete list.

## 🚨 Error Handling Architecture

**useErrorHandler Hook**: Specialized handlers (`handleError`, `handleValidationError`, `withErrorHandler`) with automatic notifications and retry logic.

**Key Features**: PatternFly 6 integration, error boundaries, React Query integration, i18n support.

For details, see [`docs/development/error-handling.md`](../docs/development/error-handling.md).

## 🛠️ Troubleshooting for AI Assistants

### Common Frontend Issues and How to Check

1. **"Page not loading/blank screen"**

   ```bash
   # Check for React errors
   grep -i "error\|uncaught\|exception" ../logs/frontend.log | tail -n 20
   # Also check browser console for client-side errors
   ```

2. **"Component not updating"**

   ```bash
   # Check HMR status
   grep -i "hmr\|update\|reload" ../logs/frontend.log | tail -n 20
   ```

3. **"API calls failing"**

   ```bash
   # Check for network errors
   grep -i "401\|403\|404\|500\|axios\|network" ../logs/frontend.log | tail -n 20
   ```

4. **"TypeScript errors"**

   ```bash
   # Check compilation errors
   grep -i "typescript\|ts\|type error" ../logs/frontend.log | tail -n 30
   ```

5. **"Styling issues"**

   ```bash
   # Check for CSS/PatternFly warnings
   grep -i "css\|style\|patternfly\|pf-" ../logs/frontend.log | tail -n 20
   ```

6. **"Build/Bundle errors"**

   ```bash
   # Check Vite bundling issues
   grep -i "vite\|rollup\|module\|import" ../logs/frontend.log | tail -n 30
   ```

### Browser Console Integration

Remember that frontend errors may also appear in the browser console. For runtime errors:

1. Check `../logs/frontend.log` for build/compile issues
2. Check browser DevTools Console for runtime JavaScript errors
3. Check Network tab for failed API requests

### Remember

- **DO NOT** start new dev server processes
- **DO NOT** run `npm run dev` (it's already running)
- **DO** read the logs to understand compilation/build issues
- **DO** check browser console for runtime errors
- **DO** let HMR handle component updates automatically
- **DO** tell the user if they need to manually restart for config changes

## 📚 Related Documentation

- Root [`CLAUDE.md`](../CLAUDE.md) - Project overview
- Backend [`CLAUDE.md`](../backend/CLAUDE.md) - Backend context
- [`docs/development/pf6-guide/`](../docs/development/pf6-guide/) - **PatternFly 6 Guide (AUTHORITATIVE)**
- [`docs/development/accessibility/`](../docs/development/accessibility/) - **Accessibility Guide (WCAG 2.1 AA)**
- [`docs/development/error-handling.md`](../docs/development/error-handling.md) - Error handling best practices
- [`docs/development/`](../docs/development/) - Development setup
- [`docs/architecture/`](../docs/architecture/) - System design

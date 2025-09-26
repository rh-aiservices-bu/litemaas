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
- **ConfigContext** - Application configuration from `/api/v1/config` endpoint
  - Provides `usageCacheTtlMinutes` from backend config
  - Integrates with React Query `staleTime`: `config.usageCacheTtlMinutes * 60 * 1000`
  - Pattern: Dynamic cache TTL eliminates hardcoded values in query hooks

**React Query**: Server state management with dynamic stale time from ConfigContext, 10min cache time, 3 retries

**Admin Component Structure**:

- `components/admin/` - Admin-specific UI components
  - `MetricsOverview.tsx` - Main analytics dashboard with trend indicators
  - `TopUsersTable.tsx` - User usage breakdown table
  - `UserFilterSelect.tsx` - Multi-select user filter with search
  - `ApiKeyFilterSelect.tsx` - Cascading API key filter (depends on selected users)
  - `ProviderBreakdownTable.tsx` - Provider metrics (component ready, integration pending)
- `components/charts/` - Shared chart components
  - `UsageTrends.tsx`, `ModelDistributionChart.tsx`, `ModelUsageTrends.tsx`
  - `UsageHeatmap.tsx` - Weekly heatmap (component ready, integration pending)
  - `AccessibleChart.tsx` - Accessibility wrapper for Victory charts

## 🔌 API Service Layer

**Axios Configuration**: Base client with JWT token interceptors and 401 error handling.

**Service Pattern**: Consistent service structure for all API endpoints:

- `auth.service.ts` - Authentication (OAuth, profile)
- `models.service.ts` - Model catalog
- `subscriptions.service.ts` - User subscriptions
- `apiKeys.service.ts` - API key management
- `usage.service.ts` - **User usage analytics** (individual user data)
- `adminUsage.service.ts` - **Admin usage analytics** (system-wide data, all endpoints)
- `chat.service.ts` - Chatbot integration
- `config.service.ts` - Application configuration

## 🌍 Routing Structure

**Main Routes**: `/home`, `/models`, `/subscriptions`, `/api-keys`, `/usage`, `/admin/*`

**Admin Routes** (admin/adminReadonly roles required):

- `/admin/users` - User management (UsersPage.tsx)
- `/admin/models` - Model configuration testing (AdminModelsPage.tsx)
- `/admin/tools` - Administrative tools (ToolsPage.tsx)
- `/admin/usage` - **Admin usage analytics (AdminUsagePage.tsx)** - Major feature with comprehensive system-wide analytics:
  - Global metrics with trend analysis
  - Multi-dimensional filtering (users, models, providers, API keys)
  - Day-by-day incremental caching (5-min TTL for current day)
  - Data export (CSV/JSON)
  - ConfigContext integration for dynamic cache TTL

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

**Shared Utilities**: Chart components use shared formatters, constants, and accessibility helpers to ensure consistency.

**Key Files**:

- `utils/chartFormatters.ts` - Y/X axis formatting, padding calculations
- `utils/chartConstants.ts` - Styling constants (padding, tooltips, grids, animations)
- `utils/chartAccessibility.ts` - ARIA descriptions, color schemes

**Quick Guidelines**:

- ✅ Use `formatYTickByMetric()`, `formatXTickWithSkipping()`, `calculateLeftPaddingByMetric()`
- ✅ Import constants from `chartConstants.ts` (never hardcode values)
- ✅ Use unique SVG filter IDs (e.g., `tooltip-shadow-myChart`) to avoid conflicts
- ✅ Include accessibility data transformation with `AccessibleChart` wrapper
- ✅ Use `generateChartAriaDescription()` for consistent screen reader support

**Full Guide**: See [`docs/development/chart-components-guide.md`](../docs/development/chart-components-guide.md) for complete API reference and examples.

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

## 🧪 Testing Best Practices and Debugging

### Test Infrastructure

**Test Framework**: Vitest with React Testing Library
**Test Utilities**: `src/test/test-utils.tsx` - Centralized provider setup
**Mock Strategy**: vi.mock() at module level with proper hoisting

### Critical Testing Patterns

#### 1. ConfigContext Mocking (CRITICAL)

**Issue**: ConfigProvider uses React Query which starts in loading state, blocking all tests.

**Solution**: Mock ConfigContext in test-utils.tsx to provide config synchronously:

```typescript
// ✅ CORRECT - Mock the entire module
vi.mock('../contexts/ConfigContext', () => {
  const React = require('react');
  const mockConfig = { version: '1.0.0-test', usageCacheTTL: 300, environment: 'test' };
  const mockConfigContext = React.createContext({ config: mockConfig, isLoading: false, error: null });

  return {
    useConfig: () => {
      const context = React.useContext(mockConfigContext);
      if (!context) throw new Error('useConfig must be used within a ConfigProvider');
      return context;
    },
    ConfigProvider: ({ children }) =>
      React.createElement(mockConfigContext.Provider,
        { value: { config: mockConfig, isLoading: false, error: null } },
        children
      ),
  };
});

// ❌ WRONG - Don't mock just the service
vi.mock('../services/config.service', () => ({
  configService: { getConfig: vi.fn().mockResolvedValue({...}) }
}));
```

**Why**: The service mock still leaves React Query in loading state. Must mock the entire context.

#### 2. vi.mock() Hoisting Rules

**Issue**: Vitest hoists vi.mock() calls, preventing access to top-level variables.

```typescript
// ❌ WRONG - Top-level variable not accessible in mock factory
const mockConfig = { version: '1.0.0' };
vi.mock('../context', () => ({
  useConfig: () => mockConfig, // ReferenceError: Cannot access 'mockConfig' before initialization
}));

// ✅ CORRECT - Define inside factory or use require()
vi.mock('../context', () => {
  const mockConfig = { version: '1.0.0' }; // Defined inside
  return {
    useConfig: () => mockConfig,
  };
});
```

#### 3. Mock Conflict Resolution

**Issue**: File-level mocks can conflict with test-utils global mocks.

**Example**: AdminModelsPage.test.tsx mocks useAuth locally, but test-utils also provides AuthProvider.

**Resolution Strategies**:

1. **Prefer global mocks** - Use test-utils for consistent behavior
2. **Override selectively** - Use vi.mocked() to override specific implementations
3. **Document conflicts** - Add TODO comments for tests that need refactoring

```typescript
// ✅ CORRECT - Override global mock for specific test
import { useAuth } from '../contexts/AuthContext';
vi.mocked(useAuth).mockReturnValue({ user: { roles: ['admin'] }, isAuthenticated: true });

// ❌ WRONG - Duplicate mock conflicts with test-utils
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(), // Conflicts!
}));
```

#### 4. Auth Testing Pattern (RECOMMENDED)

**Issue**: Testing components with different user roles requires consistent auth mocking approach.

**Solution**: Use `renderWithAuth()` helper from test-utils instead of mocking useAuth directly.

**Available Mock Users**:

- `mockUser` - Regular user with `['user']` roles
- `mockAdminUser` - Admin user with `['admin']` roles
- `mockAdminReadonlyUser` - Read-only admin with `['admin-readonly']` roles

**Usage Examples**:

```typescript
import { renderWithAuth, mockUser, mockAdminUser, mockAdminReadonlyUser } from '../test-utils';

// ✅ CORRECT - Test with regular user
it('should deny access for regular users', () => {
  renderWithAuth(<AdminModelsPage />, { user: mockUser });
  expect(screen.getByText(/accessDenied/)).toBeInTheDocument();
});

// ✅ CORRECT - Test with admin user
it('should show full access for admin', () => {
  renderWithAuth(<AdminModelsPage />, { user: mockAdminUser });
  expect(screen.getByText(/createModel/)).toBeInTheDocument();
});

// ✅ CORRECT - Test with admin readonly user
it('should hide create button for readonly admin', () => {
  renderWithAuth(<AdminModelsPage />, { user: mockAdminReadonlyUser });
  expect(screen.queryByText(/createModel/)).not.toBeInTheDocument();
});

// ✅ CORRECT - Test with custom user
it('should work with custom roles', () => {
  renderWithAuth(<MyComponent />, {
    user: { id: '123', email: 'test@example.com', roles: ['custom-role'], isAdmin: false }
  });
});
```

**Why This Approach**:

- ✅ No mock conflicts - directly injects auth context value
- ✅ Explicit and readable - auth state clear in test setup
- ✅ Type-safe - uses actual AuthContext interface
- ✅ Consistent - same pattern across all role-based tests
- ✅ Flexible - supports custom users and route testing

**Migration from Old Pattern**:

```typescript
// ❌ OLD PATTERN - File-level mock conflicts with test-utils
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

it('test', () => {
  mockUseAuth.mockReturnValue({ user: { roles: ['admin'] } });
  render(<Component />, { wrapper: TestWrapper });
});

// ✅ NEW PATTERN - Use renderWithAuth
import { renderWithAuth, mockAdminUser } from '../test-utils';

it('test', () => {
  renderWithAuth(<Component />, { user: mockAdminUser });
});
```

**Role Names (IMPORTANT)**:

- Use `'admin'` for admin role
- Use `'admin-readonly'` for read-only admin (hyphenated, not camelCase!)
- Use `'user'` for regular user role
- Roles are checked with `user.roles.includes('role-name')`

### PatternFly 6 Component Testing

**Common Issues**:

1. **Heading Levels**: Components may use h2/h3, not h1. Check actual DOM structure.
2. **ARIA Labels**: PatternFly generates specific labels - use browser output to verify.
3. **Landmarks**: May not render properly in JSDOM - test with E2E if critical.

```typescript
// ✅ CORRECT - Verify actual structure first
const headings = screen.getAllByRole('heading', { level: 2 }); // Not level 3!

// ❌ WRONG - Assuming heading level without checking
expect(screen.getByRole('heading', { level: 3, name: 'Models' })).toBeInTheDocument();
```

#### Modal Component Testing

✅ **PatternFly 6 Modals work perfectly in JSDOM** - No special workarounds needed!

**Quick Reference**:

- Use `waitFor()` for all modal operations
- Query modals with `role="dialog"`
- Be specific with close button queries (modals have multiple close buttons)
- Act() warnings are informational only with proper `waitFor()` usage

**Complete Guide**: [`docs/development/pf6-guide/testing-patterns/modals.md`](../docs/development/pf6-guide/testing-patterns/modals.md)

- Step-by-step testing patterns with code examples
- Opening/closing modals, form submission, backdrop clicks
- Common issues and solutions (multiple close buttons, form validation)
- ARIA compliance testing

#### Dropdown & Pagination Component Testing

✅ **PatternFly 6 Dropdowns work perfectly in JSDOM** - Use correct ARIA role!

**Critical Discovery**: PatternFly 6 dropdowns use `role="menuitem"` (NOT `role="option"`).

**Quick Reference**:

- Use `role="menuitem"` to find dropdown options
- Use `waitFor()` for dropdown menu rendering
- Find options by text content matching
- Don't use `role="option"` (that's for native select elements)

**Complete Guide**: [`docs/development/pf6-guide/testing-patterns/dropdowns-pagination.md`](../docs/development/pf6-guide/testing-patterns/dropdowns-pagination.md)

- Comprehensive dropdown and pagination testing patterns with code examples
- Solutions to common query issues
- Pagination navigation and items-per-page selection
- Complete troubleshooting guide

#### Context-Dependent Component Testing

✅ **Context-dependent components require correct parent props** - Common pattern in PatternFly 6!

**Critical Discovery**: Components like `AlertActionCloseButton` require specific parent props to provide context.

**Quick Reference**:

- Use correct parent prop (e.g., `actionClose` for Alert, not `actionLinks`)
- Always render context-dependent components with parent
- Check PatternFly docs for correct prop usage
- Don't render context consumers outside their providers

**Common Context-Dependent Components**:

- `AlertActionCloseButton` → requires `Alert` parent with `actionClose` prop
- `ModalBoxCloseButton` → requires `Modal` parent (auto-rendered)
- Custom context consumers → require appropriate `Context.Provider`

**Complete Guide**: [`docs/development/pf6-guide/testing-patterns/context-dependent-components.md`](../docs/development/pf6-guide/testing-patterns/context-dependent-components.md)

- Detailed context requirements with code examples
- Fix examples for common errors (wrong prop usage)
- Parent component testing patterns
- Alternative testing strategies

### Test Debugging Workflow

1. **Run specific test file**:

   ```bash
   npm test -- ComponentName.test.tsx
   ```

2. **Check for "Loading configuration..."** - ConfigContext not mocked properly

3. **Check for mock hoisting errors** - Move variables inside factory function

4. **Inspect actual DOM**:

   ```typescript
   screen.debug(); // Print entire DOM
   screen.logTestingPlaygroundURL(); // Interactive inspector
   ```

5. **Skip temporarily with TODO**:
   ```typescript
   // TODO: Fix mock conflict - see docs/development/test-improvement-plan.md
   it.skip('test name', () => {
     // Test code here
   });
   ```

### Test Coverage Goals

- **Unit Tests**: All components, hooks, utilities
- **Integration Tests**: Page-level rendering and interactions
- **Accessibility Tests**: WCAG 2.1 AA compliance
- **E2E Tests**: Critical user flows (login, model subscription)

**Current Status**: 98.5% passing (975/990 tests, 15 skipped)

### Known Test Limitations

1. **AdminModelsPage role-based tests**: Mock conflicts need refactoring
2. **comprehensive-accessibility heading hierarchy**: JSDOM rendering differences
3. **comprehensive-accessibility landmarks**: May need E2E verification

See [`docs/development/test-improvement-plan.md`](../../docs/development/test-improvement-plan.md) for roadmap to address these.

## 🎨 Styling Guidelines

Use PatternFly 6 design tokens, avoid hardcoded values. Support dark theme with `[data-theme='dark']` overrides.

## 🔧 Key Implementation Notes

**Authentication Flow**: OAuth provider → JWT token → localStorage → Auth context

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

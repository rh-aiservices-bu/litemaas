# CLAUDE.md - LiteMaaS Frontend Context

> **Note for AI Assistants**: This is a frontend-specific context file for the LiteMaaS React application. For project overview, see root CLAUDE.md. For backend context, see backend/CLAUDE.md.

## 🎯 Frontend Overview

**@litemaas/frontend** - React 18 application with TypeScript, Vite, and PatternFly 6 component library.

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

### Common Mistakes to Avoid

```typescript
// ❌ WRONG - Missing pf-v6- prefix
<div className="c-card">

// ✅ CORRECT
<div className="pf-v6-c-card">

// ❌ WRONG - Hardcoded color
style={{ color: '#0066CC' }}

// ✅ CORRECT - Use design token
style={{ color: 'var(--pf-v6-global--primary-color--100)' }}
```

## 🏗️ State Management

**React Context**: AuthContext (authentication state), NotificationContext (app notifications)

**React Query**: Server state management with 5min stale time, 10min cache time, 3 retries

## 🔌 API Service Layer

**Axios Configuration**: Base client with JWT token interceptors and 401 error handling.

**Service Pattern**: Consistent service structure for all API endpoints (auth, models, subscriptions, etc.)

## 🌐 Routing Structure

**Main Routes**: `/home`, `/models`, `/subscriptions`, `/api-keys`, `/usage`, `/admin/*`

**Protection**: `ProtectedRoute` for auth, `RoleProtectedRoute` for admin routes with required roles

## 🌍 Internationalization (i18n)

**Languages**: EN, ES, FR, DE, IT, JA, KO, ZH, ELV (9 languages)

**Usage**: `useTranslation()` hook with `t('key')` function

**Translation Check**: `npm run check:translations` - check for missing keys and duplicates

For details, see [`docs/development/translation-management.md`](../docs/development/translation-management.md).

## 🎯 Component Patterns

**Page Structure**: Standard hooks pattern with React Query, local state, and handlers

**Form Handling**: Validation, error state, submit handling

**Modal Patterns**: Used in AdminModelsPage for model configuration testing with async validation

For implementation examples, see [`docs/development/pf6-guide/`](../docs/development/pf6-guide/).

## 🚀 Development Commands

```bash
# Development server with HMR
npm run dev             # Starts on http://localhost:3000

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

## 📚 Related Documentation

- Root [`CLAUDE.md`](../CLAUDE.md) - Project overview
- Backend [`CLAUDE.md`](../backend/CLAUDE.md) - Backend context
- [`docs/development/pf6-guide/`](../docs/development/pf6-guide/) - **PatternFly 6 Guide (AUTHORITATIVE)**
- [`docs/development/accessibility/`](../docs/development/accessibility/) - **Accessibility Guide (WCAG 2.1 AA)**
- [`docs/development/error-handling.md`](../docs/development/error-handling.md) - Error handling best practices
- [`docs/development/`](../docs/development/) - Development setup
- [`docs/architecture/`](../docs/architecture/) - System design

# Code Review Checklist

**Purpose**: Ensure code quality, consistency, and adherence to project standards

**Last Updated**: 2025-10-12

---

## Table of Contents

1. [Error Handling](#error-handling)
2. [Component Development](#component-development)
3. [State Management](#state-management)
4. [Internationalization (i18n)](#internationalization-i18n)
5. [Accessibility (A11y)](#accessibility-a11y)
6. [Performance](#performance)
7. [Testing](#testing)
8. [Security](#security)
9. [Code Style](#code-style)

---

## Error Handling

**Critical Standards** - See [Error Handling Guide](./error-handling-guide.md)

### Required Patterns

- [ ] All React Query queries use `onError: (err) => handleError(err)`
- [ ] `useErrorHandler` hook imported and used correctly
- [ ] No manual error state management (`useState<Error>`)
- [ ] No `console.error` for user-facing errors (use `handleError` instead)
- [ ] Error messages are user-friendly and i18n-ized
- [ ] Appropriate i18n keys provided (`fallbackMessageKey`)
- [ ] Component name or context provided for debugging
- [ ] Custom error titles for different error scenarios
- [ ] Error handling covered by tests

### Anti-patterns to Reject

#### ❌ Manual Error State

```typescript
// ❌ DON'T DO THIS
const [error, setError] = useState<Error | null>(null);

const { data } = useQuery(['key'], apiCall, {
  onError: (err) => setError(err),
});
```

**Feedback**: "Please use `useErrorHandler` hook instead of manual error state. See [Error Handling Guide](./error-handling-guide.md#react-query-error-handling)."

#### ❌ console.error for User Errors

```typescript
// ❌ DON'T DO THIS
try {
  await apiCall();
} catch (error) {
  console.error(error); // No user notification
}
```

**Feedback**: "Please use `handleError()` to show user-friendly notifications. See [Error Handling Guide](./error-handling-guide.md#pattern-5-async-event-handler-with-error-handling)."

#### ❌ Redundant Error Handling

```typescript
// ❌ DON'T DO THIS
const { data, error } = useQuery(['key'], apiCall, {
  onError: (err) => handleError(err), // ✅ Good
});

React.useEffect(() => {
  if (error) {
    handleError(error); // ❌ Redundant - causes duplicate notifications
  }
}, [error, handleError]);
```

**Feedback**: "Remove the `useEffect` - error is already handled in `onError` callback. This causes duplicate notifications."

#### ❌ Inline Error UI (Unless Critical)

```typescript
// ❌ DON'T DO THIS (unless critical feature like login)
if (error) {
  return <div>Error: {error.message}</div>;
}
```

**Feedback**: "Remove inline error UI - `useErrorHandler` shows toast notifications. Only use inline errors for critical features."

#### ❌ Generic Error Messages

```typescript
// ❌ DON'T DO THIS
handleError(error, {
  fallbackMessageKey: 'errors.general', // Too vague
});
```

**Feedback**: "Use specific error keys like `'adminUsage.errors.fetchMetrics'` for better user experience."

### ✅ Correct Pattern

```typescript
const { handleError } = useErrorHandler();

const { data, isLoading } = useQuery(['users'], fetchUsers, {
  onError: (err) =>
    handleError(err, {
      fallbackMessageKey: 'errors.users.fetch',
    }),
});
```

---

## Component Development

### PatternFly 6 Requirements

**Critical** - See [PatternFly 6 Guide](./pf6-guide/README.md)

- [ ] All PatternFly classes use `pf-v6-` prefix (NOT `pf-v5-`)
- [ ] Design tokens use `--pf-t--` prefix (semantic tokens, NOT `--pf-v6-global--`)
- [ ] Components imported from `@patternfly/react-core` v6
- [ ] Custom styles use semantic design tokens, never hardcoded values
- [ ] Tested in both light and dark themes
- [ ] No legacy PatternFly v4 or v5 patterns

### Component Structure

- [ ] Follows established patterns (see [Pattern Reference](./pattern-reference.md))
- [ ] Proper TypeScript interfaces for props
- [ ] Functional components with hooks (not class components)
- [ ] Memoization used appropriately (`useMemo`, `useCallback`, `React.memo`)
- [ ] Proper cleanup in `useEffect` hooks (return cleanup function)

### Example Feedback

```typescript
// ❌ Wrong prefix
<div className="pf-c-card">  // v4 prefix

// ✅ Correct prefix
<div className="pf-v6-c-card">  // v6 prefix
```

**Feedback**: "Please update to PatternFly 6 prefix `pf-v6-`. See [PF6 Migration Guide](./pf6-guide/guidelines/styling-standards.md)."

---

## State Management

### React Query Usage

- [ ] All data fetching uses React Query (not manual `fetch`/`useState`)
- [ ] Proper query keys (array format, includes dependencies)
- [ ] `keepPreviousData: true` for paginated data
- [ ] Appropriate `staleTime` configured (5 minutes default)
- [ ] Mutations invalidate affected queries with `queryClient.invalidateQueries`

### React Context

- [ ] Use existing contexts (Auth, Notification, Config) appropriately
- [ ] Don't create new contexts without justification
- [ ] Context providers only wrap necessary components, not entire app

### Local State

- [ ] `useState` only for UI state (modals, dropdowns, form fields)
- [ ] Don't duplicate server state in local state
- [ ] State lifted appropriately (not passed through many levels)

### Example Feedback

```typescript
// ❌ Manual data fetching
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  fetch('/api/users')
    .then((res) => res.json())
    .then(setData)
    .finally(() => setLoading(false));
}, []);

// ✅ Use React Query
const { data, isLoading } = useQuery(['users'], () => userService.getUsers());
```

**Feedback**: "Please use React Query for data fetching instead of manual `fetch`/`useState`. See [State Management Guide](../../frontend/CLAUDE.md#state-management)."

---

## Internationalization (i18n)

**Critical** - All user-facing text must be internationalized

### Required Patterns

- [ ] All user-facing text uses `t()` function
- [ ] No hardcoded strings in UI
- [ ] Proper i18n keys with fallback values: `t('key', 'Fallback')`
- [ ] Keys follow naming convention: `feature.context.specific`
- [ ] Translations added to all language files (9 languages: EN, ES, FR, DE, IT, JA, KO, ZH, ELV)
- [ ] Pluralization handled correctly with `t('key', { count })`
- [ ] Variables interpolated properly: `t('key', { variable })`

### Anti-patterns

#### ❌ Hardcoded Strings

```typescript
// ❌ DON'T DO THIS
<Button>Create User</Button>
<Alert title="Error" description="Failed to load data" />
```

**Feedback**: "Please internationalize all user-facing text using `t()`. Example: `t('users.create', 'Create User')`"

#### ❌ Missing Fallback

```typescript
// ❌ DON'T DO THIS
<Button>{t('users.create')}</Button>  // No fallback

// ✅ DO THIS
<Button>{t('users.create', 'Create User')}</Button>  // With fallback
```

**Feedback**: "Please provide fallback values for all `t()` calls to ensure text displays even if translation is missing."

### Checking Translations

Run translation check before committing:

```bash
npm --prefix frontend run check:translations
```

This validates:

- All keys have translations in all languages
- No missing or extra keys
- Proper JSON formatting

---

## Accessibility (A11y)

**Critical** - Must meet WCAG 2.1 AA standards

### Required Patterns

- [ ] All interactive elements have accessible labels (`aria-label` or visible text)
- [ ] Form inputs have associated `<label>` elements
- [ ] Buttons have descriptive text (not just icons)
- [ ] Images have `alt` text
- [ ] Color contrast meets WCAG AA standards (4.5:1 for text)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus indicators visible and clear
- [ ] Screen reader announcements for dynamic content (`aria-live`)
- [ ] Proper heading hierarchy (h1 → h2 → h3, no skipping levels)
- [ ] ARIA landmarks used appropriately (`role="main"`, `nav`, etc.)

### PatternFly Accessibility

- [ ] Use PatternFly components' built-in accessibility features
- [ ] Don't override ARIA attributes without justification
- [ ] Test with PatternFly's accessibility patterns

### Screen Reader Testing

- [ ] Dynamic updates use `ScreenReaderAnnouncement` component
- [ ] Loading states announced (`aria-live="polite"`)
- [ ] Error states announced with appropriate severity
- [ ] Success messages announced

### Example Feedback

```typescript
// ❌ Icon button without label
<Button variant="plain">
  <TrashIcon />
</Button>

// ✅ With accessible label
<Button
  variant="plain"
  aria-label={t('actions.delete', 'Delete')}
>
  <TrashIcon />
</Button>
```

**Feedback**: "Please add `aria-label` to icon-only buttons for screen reader users."

---

## Performance

### React Query Optimization

- [ ] `staleTime` configured to avoid unnecessary refetches
- [ ] `cacheTime` configured appropriately
- [ ] `keepPreviousData: true` for paginated data
- [ ] Pagination implemented for large datasets (backend + frontend)
- [ ] Debouncing for search inputs

### Component Optimization

- [ ] Expensive calculations wrapped in `useMemo`
- [ ] Event handlers wrapped in `useCallback` when passed as props
- [ ] Large lists use virtualization if needed (react-window)
- [ ] Images lazy-loaded when appropriate
- [ ] No unnecessary re-renders (check with React DevTools Profiler)

### Bundle Size

- [ ] No unnecessary dependencies added
- [ ] Tree-shaking friendly imports: `import { Component } from 'lib'` not `import * as Lib from 'lib'`
- [ ] Code splitting for large features (lazy loading routes)

---

## Testing

### Required Coverage

- [ ] Unit tests for all new components
- [ ] Tests for error scenarios
- [ ] Tests for accessibility (ARIA labels, keyboard navigation)
- [ ] Integration tests for page-level components
- [ ] E2E tests for critical user flows (if applicable)

### Test Quality

- [ ] Tests use `test-utils.tsx` for consistent provider setup
- [ ] Mocks use proper patterns (see [Frontend Testing Guide](../../frontend/CLAUDE.md#testing-best-practices-and-debugging))
- [ ] Tests query by accessible roles, not test IDs or classes
- [ ] Async operations use `waitFor` appropriately
- [ ] No `act()` warnings in test output

### Example Patterns

```typescript
// ✅ Good test
it('should handle fetch errors', async () => {
  const mockHandleError = vi.fn();
  vi.mocked(useErrorHandler).mockReturnValue({
    handleError: mockHandleError,
  });

  mockApiService.getUsers.mockRejectedValue(new Error('Network error'));

  render(<UserList />);

  await waitFor(() => {
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        fallbackMessageKey: 'errors.users.fetch',
      })
    );
  });
});
```

---

## Security

### Authentication & Authorization

- [ ] Protected routes use `ProtectedRoute` or `RoleProtectedRoute`
- [ ] Role checks on frontend (UX only, backend validates)
- [ ] No sensitive data in client-side code or logs
- [ ] Tokens stored securely (localStorage with HttpOnly considerations)

### Input Validation

- [ ] All user input validated (frontend + backend)
- [ ] No SQL injection vectors (use parameterized queries in backend)
- [ ] No XSS vulnerabilities (React auto-escapes, but check dangerouslySetInnerHTML)
- [ ] CSRF protection via JWT tokens

### API Security

- [ ] All API calls include authentication tokens
- [ ] No API keys or secrets in frontend code
- [ ] Environment variables used for configuration

---

## Code Style

### TypeScript

- [ ] Proper type definitions (no `any` unless absolutely necessary)
- [ ] Interfaces for component props
- [ ] Types imported from service files
- [ ] No TypeScript errors or warnings

### Formatting

- [ ] Code formatted with Prettier (run `npm run lint:fix`)
- [ ] ESLint rules followed (no warnings)
- [ ] Consistent naming conventions (camelCase for variables, PascalCase for components)
- [ ] Imports organized (React, third-party, local)

### Comments

- [ ] Complex logic has explanatory comments
- [ ] No commented-out code (remove or uncomment)
- [ ] JSDoc comments for exported functions/components
- [ ] TODO comments have owner and issue number

### File Organization

- [ ] Files in correct directories (see [Project Structure](../architecture/project-structure.md))
- [ ] No files > 500 lines (split if needed)
- [ ] Related code co-located (component + styles + tests)

---

## Review Workflow

### Before Requesting Review

**Developer Checklist**:

1. [ ] Run `npm run lint` - No errors
2. [ ] Run `npm run typecheck` - No errors
3. [ ] Run `npm test` - All tests passing
4. [ ] Run `npm run check:translations` - All translations present
5. [ ] Test manually in browser (both light and dark themes)
6. [ ] Test error scenarios
7. [ ] Test accessibility with keyboard navigation
8. [ ] Review own code for common issues
9. [ ] Update documentation if needed
10. [ ] Write clear PR description with testing steps

### During Review

**Reviewer Checklist**:

1. [ ] Read PR description and understand changes
2. [ ] Check code against this checklist
3. [ ] Verify tests are comprehensive
4. [ ] Look for edge cases not covered
5. [ ] Check for security issues
6. [ ] Verify error handling follows patterns
7. [ ] Ensure i18n for all user-facing text
8. [ ] Check accessibility considerations
9. [ ] Review for performance issues
10. [ ] Provide constructive feedback with examples

### Approval Criteria

**Merge when**:

- ✅ All checklist items addressed
- ✅ All tests passing
- ✅ No unresolved comments
- ✅ Changes align with project standards
- ✅ Documentation updated if needed

---

## Common Review Comments

### Helpful Feedback Templates

**Error Handling**:

> "Please use `useErrorHandler` hook for consistent error handling. See [Error Handling Guide](./error-handling-guide.md#react-query-error-handling)."

**Internationalization**:

> "Please internationalize this text: `t('feature.action', 'Fallback text')`. See [i18n Guide](./translation-management.md)."

**Accessibility**:

> "Please add `aria-label` to this icon-only button for screen reader users. See [Accessibility Guide](./accessibility/README.md)."

**PatternFly 6**:

> "Please update to PatternFly 6 prefix `pf-v6-`. See [PF6 Guide](./pf6-guide/README.md)."

**Performance**:

> "Consider wrapping this callback in `useCallback` to prevent unnecessary re-renders."

**Testing**:

> "Please add a test for the error scenario. See [Testing Guide](../../frontend/CLAUDE.md#testing-best-practices-and-debugging)."

---

## References

- [Error Handling Guide](./error-handling-guide.md)
- [PatternFly 6 Guide](./pf6-guide/README.md)
- [Pattern Reference](./pattern-reference.md)
- [Accessibility Guide](./accessibility/README.md)
- [Translation Management](./translation-management.md)
- [Frontend Context](../../frontend/CLAUDE.md)
- [Backend Context](../../backend/CLAUDE.md)

---

**End of Code Review Checklist**

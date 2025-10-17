# PatternFly Guidelines

Core development rules for AI coders building PatternFly React applications.

## Related Files

- [**Component Rules**](./component-architecture.md) - Component structure requirements
- [**Styling Rules**](./styling-standards.md) - CSS and styling requirements
- [**Migration Codemods**](./migration-codemods.md) - Automated migration tools
- [**Layout Rules**](../components/layout/README.md) - Page structure requirements

## Essential Rules

### Version Requirements

- ✅ **ALWAYS use PatternFly v6** - Use `pf-v6-` prefixed classes only
- ❌ **NEVER use legacy versions** - No `pf-v5-`, `pf-v4-`, or `pf-c-` classes
- ✅ **Match component and CSS versions** - Ensure compatibility
- ⚠️ **Exception** - Only use non-versioned classes if explicitly supporting legacy PatternFly versions

### Component Usage Rules

- ✅ **Use PatternFly components first** - Before creating custom solutions
- ✅ **Compose components** - Build complex UIs by combining PatternFly components
- ❌ **Don't override component internals** - Use provided props and APIs

### Text Components (v6+)

```jsx
// ✅ Correct
import { Content } from '@patternfly/react-core';
<Content component="h1">Title</Content>

// ❌ Wrong - Don't use old Text components
<Text component="h1">Title</Text>
```

### Icon Usage

```jsx
// ✅ Correct - Wrap with Icon component
import { Icon } from '@patternfly/react-core';
import { UserIcon } from '@patternfly/react-icons';
<Icon size="md">
  <UserIcon />
</Icon>;
```

### Styling Rules

- ✅ **Use PatternFly utilities** - Before writing custom CSS
- ✅ **Use semantic design tokens** for custom CSS (e.g., `var(--pf-t--global--color--brand--default)`), not base tokens with numbers (e.g., `--pf-t--global--text--color--regular`) or hardcoded values
- ❌ **Don't mix PatternFly versions** - Stick to v6 throughout

### Documentation Requirements

1. **Check [PatternFly.org](https://www.patternfly.org/) first** - Primary source for APIs
2. **Check the [PatternFly React GitHub repository](https://github.com/patternfly/patternfly-react)** for the latest source code, examples, and release notes
3. **Use "View Code" sections** - Copy working examples
4. **Reference version-specific docs** - Match your project's PatternFly version
5. **Provide context to AI** - Share links and code snippets when asking for help

> For the most up-to-date documentation, use both the official docs and the source repositories. When using AI tools for PatternFly 6, use the local documentation and PatternFly.org. Note: Context7 may have outdated PatternFly versions - use it for other libraries but NOT for PatternFly 6.

### Accessibility Requirements

- ✅ **WCAG 2.1 AA compliance** - All components must meet standards
- ✅ **Proper ARIA labels** - Use semantic markup and labels
- ✅ **Keyboard navigation** - Ensure full keyboard accessibility
- ✅ **Focus management** - Logical focus order and visible indicators

## Quality Assurance Checklist

### Before Code Review

- [ ] All `pf-c-`, `pf-u-`, `pf-l-` classes updated to `pf-v6-` versions
- [ ] All global CSS variables replaced with design tokens
- [ ] All codemods run successfully without errors (see [Migration Codemods](./migration-codemods.md))
- [ ] Custom CSS overrides reviewed and updated or removed
- [ ] Tests updated for new component structures
- [ ] Breakpoint logic updated to use rem units (divide px by 16)

### During Development

- [ ] Uses PatternFly v6 classes only
- [ ] Use semantic tokens, not base/palette tokens
- [ ] Choose tokens by meaning, not by old variable names
- [ ] Avoid CSS overrides when possible
- [ ] Components render correctly across browsers
- [ ] Responsive on mobile and desktop (using rem-based breakpoints)
- [ ] Test in both light and dark themes
- [ ] Keyboard navigation works
- [ ] Screen readers can access content
- [ ] No console errors or warnings
- [ ] Performance is acceptable

### Post-Implementation Validation

- [ ] Product builds without errors
- [ ] Visual regression testing completed
- [ ] All tests pass with new PatternFly 6 changes
- [ ] Performance impact assessed
- [ ] Accessibility compliance maintained (WCAG 2.1 AA)
- [ ] Verify responsive behavior with new rem-based breakpoints

## When Issues Occur

1. **Check [PatternFly.org](https://www.patternfly.org/)** - Verify component API
2. **Inspect elements** - Use browser dev tools for PatternFly classes
3. **Search [GitHub issues](https://github.com/patternfly/patternfly-react/issues)** - Look for similar problems
4. **Provide context** - Share code snippets and error messages

See [Common Issues](../troubleshooting/common-issues.md) for specific problems.

## Important Notes

### Migration Considerations

- **No Rollback**: Once upgraded to PatternFly 6, rolling back requires significant work
- **PatternFly 5 Support**: Ends with PatternFly 7 release (following N-1 support policy)
- **Visual Changes**: PatternFly 6 includes significant visual updates - review all UIs
- **Custom Themes**: Products with custom PatternFly replications need complete re-skinning

### Breaking Changes

- **Button Component**: `isDisabled` prop now uses `disabled` attribute, not `aria-disabled`
- **Typography**: Default font changed from Overpass to RedHatText and RedHatDisplay
- **Units**: All breakpoints now use rem instead of pixels (divide px by 16)
- **Dark Theme**: Add `pf-v6-theme-dark` class to `<html>` tag to enable

For complete migration guidance, see [Migration Codemods](./migration-codemods.md).

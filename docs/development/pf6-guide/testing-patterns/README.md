# PatternFly 6 Testing Patterns

This directory contains comprehensive testing guides for PatternFly 6 components in JSDOM test environments (Vitest).

## Testing Guides

- **[Modal Testing](modals.md)** - Complete guide for testing PatternFly 6 Modal components
- **[Dropdown & Pagination Testing](dropdowns-pagination.md)** - Testing dropdowns, menus, and pagination components
- **[Context-Dependent Components](context-dependent-components.md)** - Testing components that require parent context (Alert, Modal, etc.)
- **[Switch Components](switch-components.md)** - Testing PatternFly 6 Switch components

## Common Testing Patterns

### Key Principles

1. **Use PatternFly Testing Utilities** - Leverage official testing helpers
2. **Mock Portal Rendering** - Handle components that render to portals
3. **Test Accessibility** - Verify ARIA attributes and keyboard navigation
4. **Handle Async Updates** - Use `waitFor` and proper async testing patterns

### Common Issues

- **Portal Components**: Modals, dropdowns, and tooltips render to `document.body`
- **Context Requirements**: Some components need parent context providers
- **Async Rendering**: PatternFly components may have delayed DOM updates

## Testing Stack

- **Vitest**: Test runner
- **React Testing Library**: Component testing utilities
- **@testing-library/user-event**: User interaction simulation
- **@patternfly/react-core**: PatternFly 6 components

## Related Documentation

- **[PatternFly Guidelines](../guidelines/README.md)** - Development principles
- **[Common Issues](../troubleshooting/common-issues.md)** - Troubleshooting guide
- **[Accessibility Testing](../../accessibility/testing-guide.md)** - Accessibility testing procedures

## External Resources

- [PatternFly Testing Documentation](https://www.patternfly.org/get-started/develop#testing)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Documentation](https://vitest.dev/)

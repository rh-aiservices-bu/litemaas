# Accessibility Documentation

This directory contains comprehensive accessibility documentation for the LiteMaaS project, focusing on WCAG 2.1 AA compliance and inclusive design practices.

## Documentation Overview

### 📋 [Testing Guide](testing-guide.md)

Comprehensive accessibility testing procedures, tools, and methodologies for ensuring WCAG 2.1 AA compliance. Includes automated testing setup, manual testing procedures, screen reader testing, and CI/CD integration.

**Key topics:**

- Automated testing with axe-core and Playwright
- Manual keyboard navigation testing
- Screen reader testing procedures (NVDA, JAWS, VoiceOver)
- Color contrast validation
- Development mode testing utilities

### 🔄 [ARIA Live Regions](aria-live-regions.md)

Implementation summary of ARIA live regions for dynamic content announcements to screen readers. Details the ScreenReaderAnnouncement component and integration patterns.

**Key topics:**

- ScreenReaderAnnouncement component implementation
- Pages enhanced with live region support
- Translation keys for accessibility announcements
- Browser and screen reader compatibility

### 🎨 [Accessibility Patterns](patterns.md)

Common accessibility patterns and implementation guidelines for React components using PatternFly 6.

**Key topics:**

- Component accessibility patterns
- ARIA attributes and semantic HTML
- Focus management strategies
- PatternFly 6 accessibility best practices

### 🔍 [Frontend Testing](frontend-testing.md)

Frontend-specific accessibility testing procedures and utilities tailored to the React application.

**Key topics:**

- Component-level accessibility testing
- Integration testing for accessibility features
- Testing utilities and helpers
- Page-specific accessibility requirements

## Quick Reference

### Essential Tools

- **axe-core**: Runtime accessibility testing in development
- **Playwright + axe**: E2E accessibility testing
- **PatternFly 6**: WCAG-compliant component library
- **Screen readers**: NVDA (Windows), VoiceOver (macOS), JAWS (Windows)

### Key Components

- `ScreenReaderAnnouncement`: ARIA live region component for dynamic announcements
- `Layout`: Main application layout with accessibility landmarks
- Accessible charts and data visualization components

### Testing Commands

```bash
# Run accessibility tests
npm run test -- --testNamePattern="accessibility"

# E2E accessibility testing
npm run test:e2e -- accessibility.spec.ts

# Development mode with axe-core
npm run dev
```

### WCAG 2.1 AA Compliance

All components and pages in LiteMaaS are designed to meet:

- ✅ **Perceivable**: Content is presentable to users in ways they can perceive
- ✅ **Operable**: Interface components are operable via keyboard and assistive technologies
- ✅ **Understandable**: Information and UI operation are understandable
- ✅ **Robust**: Content is robust enough to be interpreted by assistive technologies

## Getting Started

1. **For Developers**: Start with [Testing Guide](testing-guide.md) to understand our testing approach
2. **For Implementation**: Review [Accessibility Patterns](patterns.md) for component guidelines
3. **For Dynamic Content**: See [ARIA Live Regions](aria-live-regions.md) for announcement patterns
4. **For Frontend Testing**: Use [Frontend Testing](frontend-testing.md) for component-specific procedures

## Resources

- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa)
- [PatternFly Accessibility Guide](https://www.patternfly.org/accessibility/accessibility-guide)
- [WebAIM Resources](https://webaim.org/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)

---

_This documentation is actively maintained and should be updated as accessibility features and testing procedures evolve._

# Accessibility Testing Guide for LiteMaaS Frontend

This document provides comprehensive guidance for testing accessibility in the LiteMaaS frontend application. Our goal is to ensure WCAG 2.1 AA compliance and excellent user experience for all users, including those using assistive technologies.

## Table of Contents

- [Overview](#overview)
- [Automated Testing](#automated-testing)
- [Manual Testing](#manual-testing)
- [Screen Reader Testing](#screen-reader-testing)
- [Keyboard Testing](#keyboard-testing)
- [Color and Contrast Testing](#color-and-contrast-testing)
- [Component-Specific Testing](#component-specific-testing)
- [Testing Tools and Setup](#testing-tools-and-setup)
- [Common Issues and Solutions](#common-issues-and-solutions)
- [Accessibility Checklist](#accessibility-checklist)

## Overview

The LiteMaaS frontend includes comprehensive accessibility testing infrastructure:

- **Runtime Testing**: Axe-core integration for development-time accessibility checking
- **Unit Testing**: Jest-axe integration for component-level accessibility tests
- **E2E Testing**: Playwright with @axe-core/playwright for full-page accessibility testing
- **PatternFly 6**: Accessible-by-design components with proper ARIA patterns

### Key Accessibility Standards

- **WCAG 2.1 AA**: Minimum compliance level
- **Section 508**: U.S. federal accessibility requirements
- **ARIA 1.1**: Modern ARIA patterns and best practices

## Automated Testing

### Development-Time Testing

The application includes real-time accessibility testing during development:

```typescript
// Automatically initialized in development mode
// Check browser console for accessibility violations
window.a11yDebug.highlightViolations(); // Highlight violations visually
window.a11yDebug.printSummary(); // Print accessibility summary
window.a11yDebug.clearHighlights(); // Clear visual highlights
```

### Unit Testing with Jest-Axe

Run comprehensive accessibility tests on individual components:

```bash
# Run all accessibility tests
npm run test:unit -- --testNamePattern="accessibility"

# Run specific component accessibility tests
npm run test:unit -- src/test/components/ModelsPage.accessibility.test.tsx

# Run all tests with coverage
npm run test:coverage
```

Example component test:

```typescript
import { renderWithAccessibility, runCommonA11yTests } from '../accessibility-test-utils';

describe('ComponentName Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { testAccessibility } = renderWithAccessibility(<ComponentName />);
    await testAccessibility();
  });

  it('should support keyboard navigation', async () => {
    const { testKeyboardNavigation } = renderWithAccessibility(<ComponentName />);
    await testKeyboardNavigation();
  });

  it('should have proper ARIA attributes', async () => {
    const { testAriaAttributes } = renderWithAccessibility(<ComponentName />);
    testAriaAttributes();
  });
});
```

### E2E Accessibility Testing

Run full-page accessibility tests with Playwright:

```bash
# Run all E2E accessibility tests
npm run test:e2e -- tests/accessibility.spec.ts

# Run specific page tests
npm run test:e2e -- --grep "ModelsPage should pass accessibility tests"

# Run with UI mode for debugging
npm run test:e2e:ui -- tests/accessibility.spec.ts
```

## Manual Testing

### Keyboard Navigation Testing

Test all interactive elements are keyboard accessible:

#### Tab Order Testing

1. Start at the top of the page
2. Press `Tab` repeatedly to navigate through all interactive elements
3. Verify logical tab order (left-to-right, top-to-bottom)
4. Ensure focus indicators are visible and clear
5. Test `Shift + Tab` for reverse navigation

#### Keyboard Shortcuts Testing

- `Enter`: Activate buttons and links
- `Space`: Activate buttons, checkboxes, and toggle states
- `Escape`: Close modals, dropdowns, and cancel operations
- `Arrow Keys`: Navigate through lists, menus, and tab panels
- `Home/End`: Jump to first/last item in lists
- `Page Up/Down`: Scroll through long content

#### Focus Management Testing

1. **Modal Focus Trap**: Focus should be trapped within modals
2. **Focus Restoration**: Focus should return to trigger element when closing modals
3. **Skip Links**: Test skip links functionality (usually hidden until focused)
4. **Dynamic Content**: Focus should move to newly added content when appropriate

### Visual Testing

#### Focus Indicators

- All interactive elements must have visible focus indicators
- Focus indicators should have sufficient color contrast (3:1 minimum)
- Focus indicators should be clearly distinguishable from normal states

#### Color Contrast

Test color combinations meet WCAG AA standards:

- **Normal Text**: 4.5:1 contrast ratio minimum
- **Large Text** (18pt+ or 14pt+ bold): 3:1 contrast ratio minimum
- **Non-text Elements**: 3:1 contrast ratio for UI components and graphics

Use tools like:

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)
- Browser developer tools accessibility panel

## Screen Reader Testing

### Recommended Screen Readers

#### Windows

- **NVDA** (Free): Most commonly used for testing
- **JAWS**: Widely used in enterprise environments
- **Windows Narrator**: Built-in screen reader

#### macOS

- **VoiceOver**: Built-in screen reader (Cmd + F5 to toggle)

#### Linux

- **Orca**: GNOME screen reader

### Screen Reader Testing Process

#### Basic Navigation

1. **Headings Navigation**: Use heading navigation (H key in NVDA/JAWS)
2. **Landmarks Navigation**: Navigate by landmarks (D key for main content)
3. **Links Navigation**: Navigate by links (K key)
4. **Forms Navigation**: Navigate form elements (F key for form fields)

#### Content Testing

1. **Reading Order**: Ensure content is read in logical order
2. **Alternative Text**: All images have appropriate alt text
3. **Form Labels**: All form controls have clear labels
4. **Table Headers**: Data tables have proper header associations
5. **Live Regions**: Dynamic content changes are announced

#### ARIA Testing

Verify proper ARIA implementation:

- **Roles**: Elements have appropriate roles
- **Properties**: aria-label, aria-labelledby, aria-describedby
- **States**: aria-expanded, aria-selected, aria-checked
- **Live Regions**: aria-live, aria-atomic for dynamic content

### VoiceOver Testing Commands (macOS)

```
VO + Arrow Keys    - Navigate content
VO + Space         - Activate element
VO + Shift + Down  - Enter group/table
VO + Shift + Up    - Exit group/table
VO + H             - Navigate by headings
VO + L             - Navigate by links
VO + J             - Navigate by form controls
Control            - Stop speech
```

### NVDA Testing Commands (Windows)

```
H/Shift+H          - Navigate headings
K/Shift+K          - Navigate links
F/Shift+F          - Navigate form fields
D/Shift+D          - Navigate landmarks
T/Shift+T          - Navigate tables
Insert + Space     - Toggle browse/focus mode
Insert + T         - Read title
Insert + F7        - Elements list
```

## Color and Contrast Testing

### Automated Tools

- **axe DevTools**: Browser extension for comprehensive accessibility testing
- **WAVE**: Web accessibility evaluation tool
- **Lighthouse**: Accessibility audit in Chrome DevTools

### Manual Testing Tools

- **Color Oracle**: Colorblindness simulator
- **Sim Daltonism**: macOS colorblindness simulator
- **Coblis**: Online colorblind web page filter

### Testing Checklist

- [ ] Text has sufficient contrast against background
- [ ] UI components have sufficient contrast
- [ ] Focus indicators have sufficient contrast
- [ ] Information is not conveyed through color alone
- [ ] Content is readable for users with colorblindness

## Component-Specific Testing

### PatternFly Components

#### Buttons

- [ ] Have accessible names (text, aria-label, or aria-labelledby)
- [ ] Support Enter and Space key activation
- [ ] Have appropriate role (button, link, etc.)
- [ ] Disabled state is properly communicated

#### Forms

- [ ] All inputs have labels
- [ ] Required fields are marked with aria-required or required attribute
- [ ] Error messages are associated with inputs (aria-describedby)
- [ ] Field validation is announced to screen readers

#### Tables

- [ ] Column headers are properly associated with data cells
- [ ] Row headers are used when appropriate
- [ ] Caption describes table purpose
- [ ] Complex tables use appropriate ARIA

#### Modals

- [ ] Focus is trapped within modal
- [ ] Focus returns to trigger element when closed
- [ ] Modal has aria-labelledby or aria-label
- [ ] Background content is inert (aria-hidden or inert attribute)
- [ ] Escape key closes modal

#### Navigation

- [ ] Navigation landmarks are present (nav role)
- [ ] Current page is indicated (aria-current="page")
- [ ] Skip links are provided for keyboard users
- [ ] Breadcrumbs use appropriate ARIA

### LiteMaaS-Specific Components

#### Model Cards

- [ ] Each card has unique accessible name
- [ ] Pricing information is properly structured
- [ ] Status indicators are clearly labeled
- [ ] Feature tags are properly associated

#### API Key Tables

- [ ] Table structure is accessible
- [ ] Actions are keyboard accessible
- [ ] Status information is announced
- [ ] Copy functionality provides feedback

#### Subscription Management

- [ ] Form validation is accessible
- [ ] Progress indicators are announced
- [ ] Success/error states are communicated

## Testing Tools and Setup

### Browser Extensions

#### Chrome/Edge

- [axe DevTools](https://chrome.google.com/webstore/detail/axe-devtools-web-accessib/lhdoppojpmngadmnindnejefpokejbdd)
- [WAVE Evaluation Tool](https://chrome.google.com/webstore/detail/wave-evaluation-tool/jbbplnpkjmmeebjpijfedlgcdilocofh)
- [Accessibility Insights](https://accessibilityinsights.io/)

#### Firefox

- [axe DevTools](https://addons.mozilla.org/en-US/firefox/addon/axe-devtools/)
- [WAVE](https://addons.mozilla.org/en-US/firefox/addon/wave-accessibility-evaluation/)

### Command Line Tools

```bash
# Install axe-core CLI
npm install -g @axe-core/cli

# Test a URL
axe http://localhost:3000 --tags wcag2a,wcag2aa

# Test with specific rules
axe http://localhost:3000 --rules color-contrast,keyboard-navigation
```

### Development Environment Setup

The accessibility testing tools are already configured in the project:

```bash
# Start development server with accessibility checking
npm run dev

# The browser console will show accessibility violations in real-time
# Use window.a11yDebug for additional debugging utilities
```

## Common Issues and Solutions

### Focus Management

**Issue**: Modal doesn't trap focus
**Solution**: Implement focus trap with `focus-trap-react` or similar

**Issue**: Focus lost after dynamic content changes  
**Solution**: Programmatically move focus to new content

### ARIA Issues

**Issue**: Missing accessible names
**Solution**: Add aria-label or aria-labelledby attributes

**Issue**: Incorrect ARIA roles
**Solution**: Use semantic HTML elements or correct ARIA roles

**Issue**: Missing live region announcements
**Solution**: Add aria-live regions for dynamic content

### Keyboard Navigation

**Issue**: Elements not keyboard accessible
**Solution**: Add tabindex="0" and keyboard event handlers

**Issue**: Illogical tab order
**Solution**: Reorder DOM elements or use tabindex values

### Color and Contrast

**Issue**: Insufficient color contrast
**Solution**: Use PatternFly design tokens with tested contrast ratios

**Issue**: Information conveyed only through color
**Solution**: Add icons, text labels, or patterns

## Accessibility Checklist

### Pre-Release Checklist

#### Automated Testing

- [ ] All axe-core tests pass in development
- [ ] Unit tests with jest-axe pass
- [ ] E2E accessibility tests pass
- [ ] No accessibility violations in browser console

#### Manual Testing

- [ ] All functionality is keyboard accessible
- [ ] Focus indicators are visible and consistent
- [ ] Tab order is logical
- [ ] Focus management works correctly in modals/dropdowns

#### Screen Reader Testing

- [ ] Content is announced in logical order
- [ ] Form labels are properly associated
- [ ] Dynamic content changes are announced
- [ ] All images have appropriate alternative text

#### Color and Contrast

- [ ] All text meets WCAG AA contrast requirements
- [ ] UI components meet contrast requirements
- [ ] Information is not conveyed through color alone
- [ ] Content is usable with high contrast mode

### Component Review Checklist

When creating new components:

- [ ] Use semantic HTML elements
- [ ] Add appropriate ARIA attributes
- [ ] Implement keyboard support
- [ ] Provide accessible names/descriptions
- [ ] Test with screen readers
- [ ] Verify color contrast
- [ ] Add accessibility unit tests

### Code Review Checklist

- [ ] New interactive elements are keyboard accessible
- [ ] ARIA attributes are used correctly
- [ ] Focus management is handled properly
- [ ] Accessibility tests are included
- [ ] No accessibility regressions introduced

## Resources and Documentation

### WCAG 2.1 Guidelines

- [Web Content Accessibility Guidelines 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)

### ARIA Specifications

- [WAI-ARIA 1.1](https://www.w3.org/TR/wai-aria-1.1/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)

### Testing Resources

- [WebAIM](https://webaim.org/): Comprehensive accessibility testing resources
- [Deque Axe](https://www.deque.com/axe/): Accessibility testing tools and guides
- [A11y Project](https://www.a11yproject.com/): Community-driven accessibility resource

### PatternFly Resources

- [PatternFly Accessibility Guidelines](https://www.patternfly.org/accessibility/accessibility-fundamentals)
- [PatternFly Component Documentation](https://www.patternfly.org/components)

## Support and Reporting Issues

### Getting Help

- Check the [PatternFly accessibility documentation](https://www.patternfly.org/accessibility/accessibility-fundamentals)
- Review existing accessibility test examples in the codebase
- Consult WCAG 2.1 guidelines for specific requirements

### Reporting Accessibility Issues

When reporting accessibility issues, include:

- Steps to reproduce
- Screen reader and browser version
- Expected vs. actual behavior
- WCAG success criterion affected
- Suggested solution if known

The comprehensive accessibility testing infrastructure in LiteMaaS ensures that all users can effectively use the application regardless of their abilities or the assistive technologies they use.

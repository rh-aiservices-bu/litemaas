# Accessibility Testing Guide for LiteMaaS

## Overview

LiteMaaS is committed to providing an accessible experience that meets WCAG 2.1 AA standards. This document outlines our comprehensive accessibility testing approach, tools, and procedures to ensure the frontend application is usable by everyone, including users with disabilities.

## Table of Contents

1. [Testing Tools and Setup](#testing-tools-and-setup)
2. [Automated Testing](#automated-testing)
3. [Manual Testing Procedures](#manual-testing-procedures)
4. [Screen Reader Testing](#screen-reader-testing)
5. [Keyboard Navigation Testing](#keyboard-navigation-testing)
6. [Color and Contrast Testing](#color-and-contrast-testing)
7. [Focus Management Testing](#focus-management-testing)
8. [Running Tests](#running-tests)
9. [CI/CD Integration](#cicd-integration)
10. [Accessibility Checklist](#accessibility-checklist)
11. [Common Issues and Solutions](#common-issues-and-solutions)

## Testing Tools and Setup

### Installed Tools

- **@axe-core/react**: Runtime accessibility testing in development
- **@axe-core/playwright**: E2E accessibility testing
- **jest-axe**: Accessibility testing in unit tests
- **axe-core**: Core accessibility testing engine

### Development Setup

The accessibility testing is automatically initialized in development mode:

```typescript
// In main.tsx - automatically runs in development
if (process.env.NODE_ENV === 'development') {
  initializeAxeAccessibility(ReactDOM, React, 1000);
}
```

### Browser Extensions (Recommended)

- **axe DevTools**: Chrome/Firefox extension for manual testing
- **WAVE**: Web accessibility evaluation tool
- **Lighthouse**: Built into Chrome DevTools
- **Accessibility Insights**: Microsoft's accessibility testing extension

## Automated Testing

### Unit Tests with axe-core

Our custom accessibility testing utilities provide comprehensive automated testing:

```typescript
import { renderWithAccessibility, runCommonA11yTests } from '../test/accessibility-test-utils';

// Basic accessibility test
const { testAccessibility } = renderWithAccessibility(<Component />);
await testAccessibility();

// Comprehensive test suite
await runCommonA11yTests(container);
```

### E2E Tests with Playwright

End-to-end accessibility tests run with Playwright and axe-core:

```typescript
// Example E2E accessibility test
const accessibilityScanResults = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
  .analyze();

expect(accessibilityScanResults.violations).toEqual([]);
```

### Runtime Testing in Development

When running the development server, axe-core automatically:

- Scans the page for accessibility violations
- Reports issues in the browser console
- Provides detailed violation information with fix suggestions

Access debugging utilities in browser console:

```javascript
// Highlight violations on page
window.a11yDebug.highlightViolations();

// Clear highlights
window.a11yDebug.clearHighlights();

// Print accessibility summary
window.a11yDebug.printSummary();
```

## Manual Testing Procedures

### 1. Keyboard Navigation Test

**Procedure:**

1. Disconnect your mouse/trackpad
2. Use only Tab, Shift+Tab, Enter, Space, and Arrow keys
3. Navigate through all interactive elements
4. Verify focus indicators are visible
5. Test that focus doesn't get trapped unexpectedly

**Expected Results:**

- All interactive elements are reachable via keyboard
- Focus order is logical and follows visual layout
- Focus indicators are clearly visible
- Modal dialogs trap focus appropriately
- Escape key closes modals/dropdowns

### 2. Screen Reader Testing

**Required Screen Readers:**

- **NVDA** (Windows) - Free
- **JAWS** (Windows) - Commercial
- **VoiceOver** (macOS) - Built-in
- **Orca** (Linux) - Free

**Testing Procedure:**

1. Turn on screen reader
2. Navigate using screen reader shortcuts
3. Verify all content is announced appropriately
4. Test form navigation and error announcements
5. Verify live region announcements work

**VoiceOver Commands (macOS):**

- `Cmd + F5`: Toggle VoiceOver
- `Ctrl + Opt + A`: Start reading
- `Ctrl + Opt + →/←`: Navigate by element
- `Ctrl + Opt + U`: Open rotor (headings, links, etc.)

### 3. Color Contrast Testing

**Tools:**

- Chrome DevTools Accessibility panel
- WebAIM Contrast Checker
- Colour Contrast Analyser (CCA)

**Requirements:**

- **Normal text**: 4.5:1 contrast ratio minimum
- **Large text**: 3:1 contrast ratio minimum
- **UI components**: 3:1 contrast ratio minimum

### 4. Zoom and Scaling Testing

**Procedure:**

1. Test at 200% zoom level
2. Test at 400% zoom level (if supported)
3. Verify content remains accessible and usable
4. Check for horizontal scrolling issues

## Screen Reader Testing

### Testing Checklist

- [ ] **Headings**: Proper hierarchy (h1, h2, h3, etc.)
- [ ] **Links**: Descriptive link text (avoid "click here")
- [ ] **Buttons**: Clear purpose and state
- [ ] **Forms**: Labels associated with inputs
- [ ] **Images**: Appropriate alt text or marked decorative
- [ ] **Tables**: Headers properly associated with data
- [ ] **Lists**: Proper list markup for grouped items
- [ ] **Landmarks**: Main, nav, aside, footer regions
- [ ] **Live regions**: Dynamic content announced
- [ ] **Status messages**: Success/error messages announced

### Common Screen Reader Shortcuts

**NVDA (Windows):**

- `Insert + Space`: Toggle focus/browse mode
- `H/Shift+H`: Navigate headings
- `F/Shift+F`: Navigate form fields
- `B/Shift+B`: Navigate buttons
- `L/Shift+L`: Navigate links

**JAWS (Windows):**

- `Insert + F7`: List headings
- `Insert + F5`: List form fields
- `Insert + F8`: List links
- `Tab/Shift+Tab`: Navigate form fields

## Keyboard Navigation Testing

### Navigation Patterns

1. **Sequential Navigation** (Tab/Shift+Tab)
   - Through all interactive elements
   - Logical focus order
   - Visible focus indicators

2. **Menu Navigation** (Arrow keys)
   - Up/Down arrows in vertical menus
   - Left/Right arrows in horizontal menus
   - Enter/Space to select
   - Escape to close

3. **Table Navigation** (Arrow keys)
   - Arrow keys between cells
   - Tab to exit table
   - Headers announced with data

4. **Modal Focus Management**
   - Focus moves to modal on open
   - Focus trapped within modal
   - Focus returns to trigger on close
   - Escape closes modal

### Testing Checklist

- [ ] All interactive elements reachable via keyboard
- [ ] Focus order matches visual layout
- [ ] Focus indicators visible and high contrast
- [ ] No keyboard traps (except modals)
- [ ] Shortcuts work as expected
- [ ] Custom components support keyboard interaction

## Color and Contrast Testing

### Automated Testing

Color contrast is automatically tested in our accessibility test suite:

```typescript
// Included in comprehensive tests
const { testColorContrast } = renderWithAccessibility(<Component />);
await testColorContrast();
```

### Manual Testing Tools

1. **Chrome DevTools**:
   - Open Elements panel
   - Click Accessibility tab
   - View contrast ratio in color picker

2. **WebAIM Contrast Checker**:
   - Enter foreground and background colors
   - Verify WCAG AA compliance

3. **Colour Contrast Analyser (CCA)**:
   - Desktop app for precise measurements
   - Eyedropper tool for accurate color selection

### PatternFly Color Standards

LiteMaaS uses PatternFly 6, which provides WCAG-compliant color tokens:

```css
/* High contrast text colors */
.pf-v6-u-color-100  /* Dark text on light backgrounds */
.pf-v6-u-color-200  /* Medium contrast text */

/* Status colors with proper contrast */
.pf-v6-u-success-color-100
.pf-v6-u-warning-color-100
.pf-v6-u-danger-color-100
```

## Focus Management Testing

### Focus Requirements

1. **Visible Focus Indicators**
   - 2px minimum outline width
   - High contrast against background
   - Consistent across all components

2. **Logical Focus Order**
   - Follows reading order (left-to-right, top-to-bottom)
   - Groups related controls together
   - Skips non-interactive content

3. **Focus Trapping in Modals**
   - Focus moves to modal on open
   - Tab cycles within modal only
   - Shift+Tab cycles backward within modal
   - Focus returns to trigger element on close

### Testing Procedures

```javascript
// Test focus management programmatically
const { testFocusManagement } = renderWithAccessibility(<Component />);
await testFocusManagement();

// Test keyboard navigation
const { testKeyboardNavigation } = renderWithAccessibility(<Component />);
await testKeyboardNavigation();
```

## Running Tests

### Unit Tests with Accessibility

```bash
# Run all tests including accessibility
npm run test

# Run only accessibility tests
npm run test -- --testNamePattern="accessibility"

# Run with coverage
npm run test:coverage
```

### E2E Accessibility Tests

```bash
# Run all E2E tests including accessibility
npm run test:e2e

# Run only accessibility E2E tests
npx playwright test accessibility.spec.ts

# Run with UI mode
npm run test:e2e:ui
```

### Development Mode Testing

```bash
# Start development server (axe-core runs automatically)
npm run dev

# Open browser console to see accessibility reports
# Use window.a11yDebug utilities for manual testing
```

## CI/CD Integration

### GitHub Actions Workflow

Our CI/CD pipeline includes accessibility testing:

```yaml
# In .github/workflows/frontend-tests.yml
- name: Run accessibility tests
  run: |
    npm run test -- --testNamePattern="accessibility"
    npm run test:e2e -- accessibility.spec.ts
```

### Build Process Integration

Accessibility checks are integrated into the build process:

```json
// In package.json
{
  "scripts": {
    "build": "tsc && vite build && npm run test:a11y",
    "test:a11y": "npm run test -- --testNamePattern=\"accessibility\" --run"
  }
}
```

### Quality Gates

Builds will fail if:

- Critical accessibility violations are found
- Accessibility tests fail
- Color contrast ratios are below WCAG AA standards

## Accessibility Checklist

### Pre-Release Checklist

#### ✅ Automated Testing

- [ ] All axe-core unit tests pass
- [ ] E2E accessibility tests pass
- [ ] No critical violations in development mode
- [ ] Color contrast tests pass

#### ✅ Manual Testing

- [ ] Keyboard navigation works completely
- [ ] Screen reader testing completed (at least one screen reader)
- [ ] Focus management works in all modals/dialogs
- [ ] Zoom testing up to 200% completed
- [ ] High contrast mode testing completed

#### ✅ Content Review

- [ ] All images have appropriate alt text
- [ ] Form labels are present and descriptive
- [ ] Headings follow proper hierarchy
- [ ] Link text is descriptive
- [ ] Error messages are clear and actionable

#### ✅ Component-Specific

- [ ] Tables have proper headers
- [ ] Lists use proper markup
- [ ] Buttons have clear purposes
- [ ] Status messages are announced
- [ ] Loading states are accessible

### Page-Specific Checklists

#### Models Page

- [ ] Model cards are keyboard accessible
- [ ] Search functionality works with screen readers
- [ ] Filter controls are properly labeled
- [ ] Modal subscription forms are accessible
- [ ] Pagination controls work via keyboard

#### API Keys Page

- [ ] Table navigation works with screen readers
- [ ] Create/edit forms are fully accessible
- [ ] Action buttons have clear labels
- [ ] Confirmation dialogs are accessible
- [ ] Copy functionality is announced

#### Usage Page

- [ ] Charts have alternative text descriptions
- [ ] Data tables are screen reader accessible
- [ ] Date pickers work via keyboard
- [ ] Filter controls are labeled

## Common Issues and Solutions

### Issue: Missing Form Labels

**Problem**: Screen readers can't identify form fields

```html
<!-- Problematic -->
<input type="text" placeholder="Enter name" />
```

**Solution**: Add proper labels

```html
<!-- Fixed -->
<label htmlFor="name">Name</label>
<input type="text" id="name" placeholder="Enter name" />

<!-- Or with aria-label -->
<input type="text" aria-label="Name" placeholder="Enter name" />
```

### Issue: Poor Color Contrast

**Problem**: Text doesn't meet WCAG contrast requirements

**Solution**: Use PatternFly color tokens

```css
/* Instead of custom colors, use PatternFly tokens */
.text-primary {
  color: var(--pf-v6-global--Color--100); /* High contrast text */
}
```

### Issue: Inaccessible Modal Dialogs

**Problem**: Focus escapes modal, no keyboard access

**Solution**: Implement proper focus management

```typescript
// Use PatternFly Modal component with proper props
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  aria-labelledby="modal-title"
  hasNoBodyWrapper
>
  <ModalHeader>
    <Title headingLevel="h1" id="modal-title">Modal Title</Title>
  </ModalHeader>
  <ModalBody>{content}</ModalBody>
  <ModalFooter>
    <Button onClick={handleClose}>Close</Button>
  </ModalFooter>
</Modal>
```

### Issue: Missing Live Region Announcements

**Problem**: Dynamic content changes aren't announced

**Solution**: Use ScreenReaderAnnouncement component

```typescript
// Announce status changes
<ScreenReaderAnnouncement
  message="API key created successfully"
  priority="assertive"
/>
```

### Issue: Keyboard Trap in Custom Components

**Problem**: Focus gets stuck in custom components

**Solution**: Implement proper focus management

```typescript
// Handle escape key and tab cycling
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeComponent();
  }
  // Implement tab cycling logic
};
```

## Resources and References

### WCAG Guidelines

- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa)
- [WebAIM WCAG Checklist](https://webaim.org/standards/wcag/checklist)

### Testing Tools

- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [Playwright Accessibility](https://playwright.dev/docs/accessibility-testing)
- [WebAIM Resources](https://webaim.org/)

### PatternFly Accessibility

- [PatternFly Accessibility Guide](https://www.patternfly.org/accessibility/accessibility-guide)
- [PatternFly Component Accessibility](https://www.patternfly.org/accessibility/component-accessibility)

### Screen Reader Resources

- [NVDA User Guide](https://www.nvaccess.org/documentation/)
- [VoiceOver Commands](https://support.apple.com/guide/voiceover/welcome/mac)
- [JAWS Shortcuts](https://support.freedomscientific.com/Content/Documents/Manuals/JAWS/Keystrokes.htm)

## Contact and Support

For accessibility questions or issues:

- Review this document and run the testing procedures
- Check the [PatternFly Accessibility Guide](https://www.patternfly.org/accessibility/accessibility-guide)
- File accessibility issues in the project repository
- Consult with UX/accessibility team members

---

_This document is living documentation and should be updated as new accessibility features and testing procedures are added to the LiteMaaS application._

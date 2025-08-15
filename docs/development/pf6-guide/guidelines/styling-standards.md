# Styling Standards

Essential CSS and styling rules for PatternFly React applications.

## Related Files

- [**PatternFly Guidelines**](./README.md) - Core development principles
- [**Component Rules**](./component-architecture.md) - Component structure patterns
- [**Layout Rules**](../components/layout/README.md) - Page layout styling

## Class Naming Rules

### PatternFly v6 Requirements

- ✅ **ALWAYS use `pf-v6-` prefix** - All PatternFly v6 classes
- ❌ **NEVER use legacy prefixes** - No `pf-v5-`, `pf-v4-`, or `pf-c-`

```css
/* ✅ Correct v6 classes */
.pf-v6-c-button          /* Components */
.pf-v6-u-margin-md       /* Utilities */
.pf-v6-l-grid            /* Layouts */

/* ❌ Wrong - Don't use these */
.pf-v5-c-button
.pf-c-button
```

## Utility-First Rules

> **No inline styles:** Use PatternFly layout and spacing utilities instead of `style` props or custom CSS for layout and spacing.

### Use PatternFly Utilities First

```jsx
// ✅ Correct - Use PatternFly utilities
<div className="pf-v6-u-text-align-center pf-v6-u-margin-md">

// ❌ Wrong - Custom CSS when utilities exist
<div className="custom-centered-title">
```

### Common Utility Patterns

```css
/* Spacing */
.pf-v6-u-margin-{xs|sm|md|lg|xl}
.pf-v6-u-padding-{xs|sm|md|lg|xl}
.pf-v6-u-margin-top-md
.pf-v6-u-padding-left-lg

/* Typography */
.pf-v6-u-text-align-{left|center|right}
.pf-v6-u-font-weight-{light|normal|bold}
.pf-v6-u-font-size-{sm|md|lg}

/* Colors */
.pf-v6-u-color-{primary|secondary|success|warning|danger}
.pf-v6-u-background-color-primary
```

## Design Token System

### Token Structure and Naming Convention

PatternFly 6 introduces a new semantic design token system. The token structure follows this pattern:

```
--pf-v6--[scope]--[component]--[property]--[concept]--[variant]--[state]
```

- **Scope**: `global` or `chart`
- **Component**: `background`, `text`, `icon`, `border`, `box-shadow`, `motion`, `spacer`
- **Property**: `color`, `size`, `radius`, `width`
- **Concept**: `primary`, `status`, `nonstatus`, `action`
- **Variant**: Specific variation needed
- **State**: `hover`, `focus`, `disabled`, etc.

### Token Layer Hierarchy

1. **Semantic Tokens** (✅ Use These): `--pf-v6-global--text--color--regular`
2. **Base Tokens** (❌ Avoid): Lower-level tokens ending in numbers
3. **Palette Tokens** (❌ Avoid): Raw color values

### Token Selection Guidelines

- **Semantic First**: Choose tokens based on their semantic meaning, not color/size
- **Fuzzy Matching**: Use VS Code plugin for token discovery (type `pf6` then relevant keywords)
- **Example Process**: For disabled state → `pf6` + `back` (background) + `dis` (disabled)

### Migration from Global Variables

- **OLD**: `--pf-v5-global--FontSize--lg`
- **NEW**: `--pf-v6-global--font--size--lg`
- **React Tokens**: `global_FontSize_lg` becomes `global_font_size_lg`

```css
.custom-component {
  /* ✅ Correct - Use semantic design tokens */
  color: var(--pf-v6-global--text--color--regular);
  background: var(--pf-v6-global--background--color--primary--default);
  margin: var(--pf-v6-global--spacer--md);

  /* ❌ Wrong - Don't use old global variables or base tokens */
  /* color: var(--pf-v5-global--Color--100); */
  /* color: var(--pf-global--Color--dark-100); */
  /* margin: 16px; */
}
```

### Essential Token Categories

```css
/* Text Colors */
--pf-v6-global--text--color--regular
--pf-v6-global--text--color--subtle
--pf-v6-global--text--color--disabled
--pf-v6-global--text--color--brand
--pf-v6-global--text--color--on-brand

/* Background Colors */
--pf-v6-global--background--color--primary--default
--pf-v6-global--background--color--primary--hover
--pf-v6-global--background--color--secondary--default
--pf-v6-global--background--color--disabled

/* Status Colors */
--pf-v6-global--color--status--success
--pf-v6-global--color--status--warning
--pf-v6-global--color--status--danger
--pf-v6-global--color--status--info

/* Spacing */
--pf-v6-global--spacer--xs
--pf-v6-global--spacer--sm
--pf-v6-global--spacer--md
--pf-v6-global--spacer--lg
--pf-v6-global--spacer--xl

/* Typography */
--pf-v6-global--font--family--body
--pf-v6-global--font--family--heading
--pf-v6-global--font--size--body--default
--pf-v6-global--font--size--heading--xl
--pf-v6-global--font--weight--body--default
--pf-v6-global--font--weight--heading--default

/* Borders */
--pf-v6-global--border--color--default
--pf-v6-global--border--width--regular
--pf-v6-global--border--radius--small
```

### Dark Theme Support

- **Implementation**: Add `pf-v6-theme-dark` class to `<html>` tag
- **Automatic**: Token system automatically adapts to dark theme when class is present
- **No Manual Switching**: Tokens handle light/dark theme transitions automatically

```jsx
// Enable dark theme
document.documentElement.classList.add('pf-v6-theme-dark');

// Disable dark theme
document.documentElement.classList.remove('pf-v6-theme-dark');
```

### Hot Pink Temporary Tokens

If you encounter `--pf-v6-temp--dev--tbd` tokens (displayed as hot pink), these are temporary placeholders that need manual replacement. Choose appropriate semantic tokens based on the context.

## CSS Override Rules

### Temporary Removal During Upgrade

- **MANDATORY**: Remove ALL existing CSS overrides before starting PatternFly 6 upgrade
- **Reason**: Overrides targeting PatternFly 5 variables will not work with PatternFly 6 tokens
- **Process**: Remove → Run codemods → Evaluate what's still needed

### Post-Upgrade CSS Guidelines

- **Preference**: Avoid CSS overrides whenever possible for easier future upgrades
- **If Required**: Update variable names to use appropriate semantic tokens
- **No 1:1 Mapping**: Choose tokens based on semantic meaning, not old variable names

```css
/* ✅ If overrides are absolutely necessary, use semantic tokens */
.custom-override {
  background: var(--pf-v6-global--background--color--primary--hover);
  border-color: var(--pf-v6-global--border--color--default);
}

/* ❌ Never override PatternFly component internals */
.pf-v6-c-button__text {
  /* Don't do this */
}
```

## Responsive Design Rules

### Units Changed from Pixels to Rems

- **MANDATORY**: All breakpoint logic must use rem units instead of pixels
- **Conversion**: Divide pixel values by 16 to get rem equivalent
- **Example**: `768px` becomes `48rem` (768 ÷ 16)
- **Table Breakpoints**: Special attention needed - adjusted by 1px in v6

### Use PatternFly Responsive Utilities

```css
/* Mobile-first responsive patterns with rem-based breakpoints */
.pf-v6-u-display-none-on-sm      /* Hide on small screens */
.pf-v6-u-display-block-on-md     /* Show on medium+ (48rem) */
.pf-v6-u-text-align-center-on-lg /* Center on large+ (64rem) */
```

### Grid Layout Patterns

```jsx
<div className="pf-v6-l-grid pf-v6-m-gutter">
  <div className="pf-v6-l-grid__item pf-v6-m-12-col pf-v6-m-6-col-on-md">Responsive content</div>
</div>
```

### Breakpoint Reference (v6)

```css
/* PatternFly 6 breakpoints in rem units */
--pf-v6-global--breakpoint--xs: 0;
--pf-v6-global--breakpoint--sm: 36rem; /* 576px ÷ 16 */
--pf-v6-global--breakpoint--md: 48rem; /* 768px ÷ 16 */
--pf-v6-global--breakpoint--lg: 64rem; /* 1024px ÷ 16 */
--pf-v6-global--breakpoint--xl: 80rem; /* 1280px ÷ 16 */
--pf-v6-global--breakpoint--2xl: 96rem; /* 1536px ÷ 16 */
```

## Typography Changes

### Font Family Updates

- **Default Font Changed**: From Overpass to RedHatText and RedHatDisplay
- **Legacy Support**: Add `pf-m-overpass-font` class to continue using Overpass
- **Tabular Numbers**: Use `.pf-v6-m-tabular-nums` modifier for numerical data

```jsx
// Enable tabular numbers for better numerical alignment
<span className="pf-v6-m-tabular-nums">1,234.56</span>

// Use legacy Overpass font if needed
<div className="pf-m-overpass-font">Legacy content</div>
```

## Component Styling Rules

> **No emojis or raw icons:** Always use PatternFly's React icon components (from `@patternfly/react-icons`) for all icons, including status, trend, and navigation icons.
>
> **No direct HTML headings or paragraphs:** Use PatternFly's `Title` for headings and `Content` with `component="p"` for paragraphs.

### Button Styling

```jsx
// ✅ Use PatternFly variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>

// ✅ Add utilities for spacing
<Button className="pf-v6-u-margin-right-sm">Save</Button>
```

### Form Styling

```jsx
<Form className="pf-v6-u-margin-md">
  <FormGroup label="Username" isRequired>
    <TextInput className="pf-v6-u-width-100" />
  </FormGroup>
</Form>
```

## Performance Rules

### CSS Efficiency

- ✅ **Use single utility classes** - More efficient than custom CSS
- ✅ **Import only needed CSS** - Tree shake unused styles
- ❌ **Don't create custom classes** - When PatternFly utilities exist

## Troubleshooting Rules

### Common Issues

1. **Missing styles** - Ensure PatternFly CSS is imported
2. **Class conflicts** - PatternFly classes should not be overridden
3. **Version mismatches** - All PatternFly packages must use same version

### Debug Tools

- **Browser DevTools** - Inspect applied PatternFly classes
- **PatternFly DevTools** - Browser extension for debugging

## Utility Class Usage Guidance

> **Caution:** Avoid over-relying on utility classes to style components. Prefer using the component's own props and API for layout and appearance, as these are designed for recommended use cases. Use utility classes only when necessary, and add a comment explaining why the utility class is required. This approach helps ensure your code remains maintainable and aligned with future PatternFly updates.

## Essential Do's and Don'ts

### ✅ Do's

- Use PatternFly v6 classes exclusively
- Prefer component props and API for styling before using utility classes
- Use utility classes minimally, with comments explaining their necessity
- Use PatternFly design tokens for custom styles
- Test responsive behavior on different screen sizes
- Follow mobile-first responsive patterns

### ❌ Don'ts

- Over-rely on utility classes to force component appearance
- Mix PatternFly versions
- Override PatternFly component internals
- Use hardcoded values instead of design tokens
- Create custom CSS when utilities exist
- Ignore responsive design requirements

## Quick Reference

- **[PatternFly Utilities](https://www.patternfly.org/utilities)** - Complete utility documentation
- **[Design Tokens](https://www.patternfly.org/tokens)** - Available design tokens
- **[Responsive Design](https://www.patternfly.org/layouts)** - Layout and responsive patterns

## Do/Don't Examples

### No Inline Styles

**Do:**

```jsx
// Use PatternFly utility classes
<div className="pf-v6-u-margin-md pf-v6-u-text-align-center">Content</div>
```

**Don't:**

```jsx
// Avoid style props for layout/spacing
<div style={{ margin: 16, textAlign: 'center' }}>Content</div>
```

### No Emojis or Raw Icons

**Do:**

```jsx
import ArrowUpIcon from '@patternfly/react-icons/dist/esm/icons/arrow-up-icon';
<ArrowUpIcon title="Trend up" />;
```

**Don't:**

```jsx
<span role="img" aria-label="trend up">
  📈
</span>
```

### No Direct HTML Headings or Paragraphs

**Do:**

```jsx
import { Title, Content } from '@patternfly/react-core';
<Title headingLevel="h1">Dashboard</Title>
<Content component="p">This is a PatternFly app.</Content>
```

**Don't:**

```jsx
<h1>Dashboard</h1>
<p>This is a PatternFly app.</p>
```

---

> **Note:** `PageHeader` is not a PatternFly component in v6+. Use `PageSection`, `Title`, and layout components instead.

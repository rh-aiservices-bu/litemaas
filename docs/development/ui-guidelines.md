# PATTERNFLY6_RULES.md - PatternFly 6 Rules and Guidelines

This document outlines the mandatory rules and guidelines that must be followed when working with PatternFly 6. These rules ensure code consistency, proper token usage, and adherence to the latest PatternFly 6 standards.

## 🚨 Critical Breaking Changes in PatternFly 6

### 1. Version Prefix Requirements
- **MANDATORY**: All PatternFly class names MUST use the `pf-v6-` prefix
- **OLD**: `pf-c-button`, `pf-u-mt-lg`, `pf-l-grid`
- **NEW**: `pf-v6-c-button`, `pf-v6-u-mt-lg`, `pf-v6-l-grid`
- **Exception**: Only use non-versioned classes if explicitly supporting legacy PatternFly versions

### 2. Design Token System (Required)
- **MANDATORY**: Use semantic design tokens instead of global CSS variables
- **Token Structure**: `--pf-t--[scope]--[component]--[property]--[concept]--[variant]--[state]`
- **OLD**: `--pf-v5-global--FontSize--lg`
- **NEW**: `--pf-t--global--font--size--lg`
- **React Tokens**: `global_FontSize_lg` becomes `t_global_font_size_lg`

### 3. Units Changed from Pixels to Rems
- **MANDATORY**: All breakpoint logic must use rem units instead of pixels
- **Conversion**: Divide pixel values by 16 to get rem equivalent
- **Example**: `768px` becomes `48rem` (768 ÷ 16)

## 🎯 Component-Specific Rules

### Button Component
- **Breaking Change**: `isDisabled` prop now assigns value for `disabled` attribute, not `aria-disabled`
- **Testing Impact**: Tests looking for `aria-disabled` will fail
- **New Wrapper**: Buttons now have a wrapping div around text content
- **Testing Fix**: Use `byRole` with button text in `name` instead of `byText`

### Dark Theme Support
- **Implementation**: Add `pf-v6-theme-dark` class to `<html>` tag to enable dark theme
- **Automatic**: Token system automatically adapts to dark theme when class is present

### Typography
- **New Modifier**: Use `.pf-v6-m-tabular-nums` for tabular numbers
- **Font Change**: Default font changed from Overpass to RedHatText and RedHatDisplay
- **Legacy Support**: Add `pf-m-overpass-font` class to continue using Overpass

## 📝 CSS Override Rules

### 1. Temporary Removal During Upgrade
- **MANDATORY**: Remove ALL existing CSS overrides before starting PatternFly 6 upgrade
- **Reason**: Overrides targeting PatternFly 5 variables will not work with PatternFly 6 tokens
- **Process**: Remove → Run codemods → Evaluate what's still needed

### 2. Post-Upgrade CSS Guidelines
- **Preference**: Avoid CSS overrides whenever possible for easier future upgrades
- **If Required**: Update variable names to use appropriate semantic tokens
- **No 1:1 Mapping**: Choose tokens based on semantic meaning, not old variable names

## 🔧 Codemod Requirements

### 1. Mandatory Codemods (Run in Order)
1. **class-name-updater**: Updates class names from `pf-v5-` to `pf-v6-`
   ```bash
   npx @patternfly/class-name-updater --v6 --fix path/to/code
   ```

2. **pf-codemods**: Updates React component code
   ```bash
   npx @patternfly/pf-codemods --v6 --fix path/to/code
   ```

3. **tokens-update**: Updates CSS variables to design tokens
   ```bash
   npx @patternfly/tokens-update --fix path/to/code
   ```

### 2. Codemod Best Practices
- **MANDATORY**: Run codemods BEFORE making manual changes
- **Multiple Passes**: Run codemods multiple times until no new issues are found
- **Manual Review**: Always review codemod changes before committing
- **Hot Pink Tokens**: Replace any `--pf-t--temp--dev--tbd` tokens manually

## 🎨 Design Token Usage Rules

### 1. Token Selection Guidelines
- **Semantic First**: Choose tokens based on their semantic meaning, not color/size
- **Fuzzy Matching**: Use VS Code plugin for token discovery (type `pft` then relevant keywords)
- **Example Process**: For disabled state → `pft` + `back` (background) + `dis` (disabled)

### 2. Token Naming Structure
```
--pf-t--[scope]--[component]--[property]--[concept]--[variant]--[state]
```
- **Scope**: `global` or `chart`
- **Component**: `background`, `text`, `icon`, `border`, `box-shadow`, `motion`, `spacer`
- **Property**: `color`, `size`, `radius`, `width`
- **Concept**: `primary`, `status`, `nonstatus`, `action`
- **Variant**: Specific variation needed
- **State**: `hover`, `focus`, `disabled`, etc.

### 3. Token Layer Hierarchy
1. **Semantic Tokens** (Use These): `--pf-t--global--text--color--regular`
2. **Base Tokens** (Avoid): Lower-level tokens
3. **Palette Tokens** (Avoid): Raw color values

## 🧪 Testing Updates Required

### 1. Component Testing
- **Button Tests**: Update tests expecting `aria-disabled` to look for `disabled` attribute
- **Text Queries**: Replace `byText` with `byRole` for buttons due to new wrapper divs
- **Class Names**: Update all test selectors to use `pf-v6-` prefixed classes

### 2. Breakpoint Testing
- **Unit Changes**: Update any hardcoded pixel breakpoints to rem values
- **Table Breakpoints**: Special attention needed - table breakpoints were adjusted by 1px

## 🚫 Deprecated/Removed Features

### 1. No Longer Supported
- **UMD Builds**: Individual package UMD builds removed
- **PropTypes**: Removed in favor of TypeScript types
- **Global Variables**: Replaced entirely with design token system

### 2. Component-Specific Deprecations
- **Select Component**: Old Select implementations deprecated, use new Select
- **Dropdown Component**: Old Dropdown implementations deprecated
- **Wizard Component**: Old Wizard implementations deprecated
- **Table Component**: Old Table implementations deprecated

## ✅ Quality Assurance Checklist

### Before Code Review
- [ ] All `pf-c-`, `pf-u-`, `pf-l-` classes updated to `pf-v6-` versions
- [ ] All global CSS variables replaced with design tokens
- [ ] All codemods run successfully without errors
- [ ] Custom CSS overrides reviewed and updated or removed
- [ ] Tests updated for new component structures
- [ ] Breakpoint logic updated to use rem units

### During Development
- [ ] Use semantic tokens, not base/palette tokens
- [ ] Choose tokens by meaning, not by old variable names
- [ ] Avoid CSS overrides when possible
- [ ] Test in both light and dark themes
- [ ] Verify responsive behavior with new rem-based breakpoints

### Post-Upgrade Validation
- [ ] Product builds without errors
- [ ] Visual regression testing completed
- [ ] All tests pass with new PatternFly 6 changes
- [ ] Performance impact assessed
- [ ] Accessibility compliance maintained

## 🆘 Support and Resources

### Documentation
- [PatternFly 6 Upgrade Guide](https://www.patternfly.org/get-started/upgrade/)
- [Design Tokens Documentation](https://www.patternfly.org/tokens/)
- [Release Highlights](https://www.patternfly.org/get-started/release-highlights/)

### Community Support
- **Slack**: PatternFly community Slack
- **GitHub**: [Discussion board](https://github.com/patternfly/patternfly-org/discussions)
- **Issues**: Report problems on relevant PatternFly repositories

### Migration Tools
- [@patternfly/pf-codemods](https://www.npmjs.com/package/@patternfly/pf-codemods)
- [@patternfly/class-name-updater](https://github.com/patternfly/class-name-updater)
- [PatternFly 6 Design Kit](https://www.patternfly.org/get-started/design/)

---

## ⚠️ Important Notes

1. **No Rollback**: Once upgraded to PatternFly 6, rolling back requires significant work
2. **PatternFly 5 Support**: Ends with PatternFly 7 release (following N-1 support policy)
3. **Visual Changes**: PatternFly 6 includes significant visual updates - review all UIs
4. **Custom Themes**: Products with custom PatternFly replications need complete re-skinning

---

*Last Updated: Based on PatternFly 6 upgrade documentation and release highlights*
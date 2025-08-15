# Migration Codemods

Automated migration tools and processes for upgrading to PatternFly 6.

## Introduction

PatternFly 6 provides automated codemods to help migrate your codebase from previous versions. These tools handle most of the mechanical changes required for the upgrade, though manual review and adjustments are still necessary.

## Related Files

- [**PatternFly Guidelines**](./README.md) - Core development principles
- [**Styling Standards**](./styling-standards.md) - Design token migration
- [**Common Issues**](../troubleshooting/common-issues.md) - Migration troubleshooting

## Mandatory Codemods (Run in Order)

### 1. Class Name Updater

Updates class names from `pf-v5-` to `pf-v6-` prefix.

```bash
npx @patternfly/class-name-updater --v6 --fix path/to/code
```

**What it does:**

- Updates all PatternFly class prefixes
- Converts `pf-c-`, `pf-u-`, `pf-l-` to `pf-v6-` versions
- Handles both JSX className and CSS files

### 2. PatternFly Codemods

Updates React component code to PatternFly 6 standards.

```bash
npx @patternfly/pf-codemods --v6 --fix path/to/code
```

**What it does:**

- Updates component imports and props
- Handles breaking API changes
- Migrates deprecated component patterns

### 3. Tokens Update

Replaces CSS variables with new design tokens.

```bash
npx @patternfly/tokens-update --fix path/to/code
```

**What it does:**

- Converts global CSS variables to semantic design tokens
- Updates `--pf-global-*` to `--pf-t--global-*` format
- Identifies tokens that need manual replacement

## Codemod Best Practices

### Before Running Codemods

1. **Commit all changes** - Ensure clean git state
2. **Create a branch** - Isolate migration work
3. **Remove CSS overrides** - Temporarily remove custom CSS that targets PatternFly classes
4. **Document custom patterns** - Note any non-standard implementations

### Running Codemods

1. **Multiple Passes**: Run each codemod multiple times until no new changes are detected
2. **Order Matters**: Always run codemods in the specified order
3. **Review Changes**: Use `git diff` to review all modifications
4. **Test Incrementally**: Test after each codemod to identify issues early

### After Running Codemods

1. **Manual Review**: Check for patterns the codemods couldn't handle
2. **Hot Pink Tokens**: Replace any `--pf-t--temp--dev--tbd` tokens manually
3. **Test Coverage**: Run all tests and fix any failures
4. **Visual QA**: Verify UI appearance matches expectations

## Common Codemod Scenarios

### Component Migration Examples

#### Button Component

```jsx
// Before (v5)
<Button isDisabled={true}>Click me</Button>

// After (v6) - codemod handles this
<Button disabled={true}>Click me</Button>
```

#### Select Component

```jsx
// Old Select deprecated - manual migration needed
// Codemod will flag but not auto-migrate
```

#### Table Component

```jsx
// Class updates handled automatically
// Component structure changes need manual review
```

### CSS Variable Migration

```css
/* Before */
.custom-class {
  color: var(--pf-global--Color--100);
  margin: var(--pf-global--spacer--md);
}

/* After - codemod result */
.custom-class {
  color: var(--pf-t--global--text--color--regular);
  margin: var(--pf-t--global--spacer--md);
}
```

## Manual Migration Tasks

### Tasks Codemods Don't Handle

1. **Component Structure Changes**
   - New wrapper divs in buttons
   - Table component restructuring
   - Select/Dropdown pattern updates

2. **Test Updates**
   - Change `aria-disabled` checks to `disabled`
   - Update `byText` queries to `byRole` for buttons
   - Fix breakpoint tests for rem units

3. **Custom Patterns**
   - Non-standard component usage
   - Complex CSS overrides
   - Custom theme implementations

### Hot Pink Token Resolution

When you see `--pf-t--temp--dev--tbd` tokens:

1. **Identify Context**: Understand what the token is styling
2. **Choose Semantic Token**: Select based on meaning, not color
3. **Use Token Finder**: VS Code plugin - type `pft` + keywords
4. **Test Both Themes**: Verify in light and dark modes

Example resolution:

```css
/* Hot pink token found */
background: var(--pf-t--temp--dev--tbd);

/* Analyze context - it's a disabled state */
/* Choose appropriate semantic token */
background: var(--pf-t--global--background--color--disabled);
```

## Deprecated Components

The following components are deprecated in v6 and require manual migration:

### Completely Deprecated

- **Old Select**: Migrate to new Select implementation
- **Old Dropdown**: Migrate to new Dropdown patterns
- **Old Wizard**: Use new Wizard component
- **Old Table**: Update to composable Table components

### Changed Components

- **Button**: `isDisabled` → `disabled` prop
- **Text**: Use `Content` component instead
- **PageHeader**: No longer exists, use `PageSection` + `Title`

## Testing After Migration

### Required Test Updates

1. **Button Tests**

```jsx
// Before
expect(button).toHaveAttribute('aria-disabled', 'true');

// After
expect(button).toBeDisabled();
```

2. **Text Queries**

```jsx
// Before - may fail due to wrapper divs
screen.getByText('Button text');

// After - more reliable
screen.getByRole('button', { name: 'Button text' });
```

3. **Class Name Checks**

```jsx
// Before
expect(element).toHaveClass('pf-c-button');

// After
expect(element).toHaveClass('pf-v6-c-button');
```

## Troubleshooting Codemod Issues

### Common Problems

#### Codemod Won't Run

```bash
# Clear npm cache
npm cache clean --force

# Install globally
npm install -g @patternfly/pf-codemods
```

#### Partial Updates

- Run codemod again on the same path
- Check for syntax errors blocking parsing
- Manually handle complex patterns

#### TypeScript Errors

- Update PatternFly type definitions
- Rebuild TypeScript cache: `npx tsc --build --clean`

## Rollback Strategy

If migration issues are severe:

1. **Git Reset**: Return to pre-migration commit
2. **Gradual Migration**: Migrate components incrementally
3. **Parallel Versions**: Temporarily run both versions (not recommended)

## Resources

### Documentation

- [PatternFly 6 Upgrade Guide](https://www.patternfly.org/get-started/upgrade/)
- [Codemod Documentation](https://github.com/patternfly/pf-codemods)
- [Design Token Migration](https://www.patternfly.org/tokens/)

### Tools

- [@patternfly/pf-codemods](https://www.npmjs.com/package/@patternfly/pf-codemods)
- [@patternfly/class-name-updater](https://github.com/patternfly/class-name-updater)
- [@patternfly/tokens-update](https://www.npmjs.com/package/@patternfly/tokens-update)

### Support

- **Slack**: PatternFly community Slack
- **GitHub Issues**: Report codemod bugs
- **Discussion Board**: Migration questions

## Migration Checklist

- [ ] Clean git state before starting
- [ ] Remove existing CSS overrides
- [ ] Run class-name-updater codemod
- [ ] Run pf-codemods
- [ ] Run tokens-update codemod
- [ ] Replace hot pink tokens manually
- [ ] Update component tests
- [ ] Fix TypeScript errors
- [ ] Visual regression testing
- [ ] Performance validation
- [ ] Accessibility audit

---

_Remember: Codemods handle ~80% of the migration work. The remaining 20% requires careful manual attention and testing._

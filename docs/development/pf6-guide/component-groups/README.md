# PatternFly Component Groups Rules

Essential rules for using and contributing to PatternFly React Component Groups.

## Overview

PatternFly Component Groups are opinionated React components that combine and extend PatternFly base components to provide standardized, reusable solutions for common product needs. They are maintained collaboratively by the PatternFly and Red Hat Hybrid Cloud Console teams, with a focus on accessibility, design consistency, and extensibility.

- [Component Groups NPM](https://www.npmjs.com/package/@patternfly/react-component-groups)
- [Component Groups GitHub](https://github.com/patternfly/react-component-groups)
- [Migration Guide](https://github.com/patternfly/react-component-groups/blob/main/migration.md)

## Installation Rules

### Required Installation

```bash
npm install @patternfly/react-component-groups
```

### Required CSS Import

```jsx
import '@patternfly/react-component-groups/dist/css/main.css';
```

## Import Rules

### Required Import Pattern

- ✅ **Use dynamic imports** from `/dist/dynamic/` paths
- ❌ **Don't use standard imports**

```jsx
// ✅ Correct
import { BulkSelect } from '@patternfly/react-component-groups/dist/dynamic/BulkSelect';

// ❌ Wrong
import { BulkSelect } from '@patternfly/react-component-groups';
```

## Implementation Rules

### Component Usage

- ✅ **Use component groups for complex, opinionated UI patterns**
- ✅ **Reference official PatternFly and component group demos**
- ❌ **Don't reimplement existing group functionality with custom code**

### Example Usage

```jsx
import { BulkSelect } from '@patternfly/react-component-groups/dist/dynamic/BulkSelect';

<BulkSelect items={items} selectedItems={selectedItems} onSelect={handleSelect} />;
```

### Component API Rules

- Use PatternFly naming conventions for props (e.g., `variant`, `onClick`)
- Extend PatternFly types when possible
- Document all props and usage examples
- Avoid unnecessary external dependencies

## Contribution Guidelines

- Ensure new components are sufficiently complex and valuable
- Follow the [component structure and API rules](https://github.com/patternfly/react-component-groups#readme)
- Add unit and Cypress tests for all new components
- Document new components with markdown and usage examples

## Accessibility Rules

- Provide proper ARIA labels and roles
- Ensure keyboard navigation and screen reader support
- Follow PatternFly accessibility best practices

## Essential Do's and Don'ts

### ✅ Do's

- Use dynamic imports and import required CSS
- Reference official demos and documentation
- Write accessible, well-documented components
- Use JSS for styling and follow naming conventions
- Add tests for all new functionality

### ❌ Don'ts

- Skip CSS imports or use standard imports
- Reimplement existing group components from scratch
- Ignore accessibility or documentation requirements
- Use `pf-v6-u-XXX` utility classes (use CSS variables instead)

## Common Issues

- **Missing styles:** Ensure CSS is imported
- **Import errors:** Use `/dist/dynamic/` paths
- **Component not found:** Check package installation and import paths
- **Accessibility:** Run a11y tests and review ARIA usage

## Quick Reference

- [Component Groups Gallery](https://www.patternfly.org/patternfly-ai/component-groups/overview)
- [Component Groups GitHub](https://github.com/patternfly/react-component-groups)
- [Migration Guide](https://github.com/patternfly/react-component-groups/blob/main/migration.md)

**Note:** Component group guidance takes precedence over general PatternFly patterns for these components. Always consult the latest documentation and demo source code.

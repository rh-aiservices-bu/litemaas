# Component Architecture

This document outlines the essential rules for structuring PatternFly components, managing state, and ensuring performance. It is a high-level guide that links to more detailed documentation for specific patterns.

## Related Files

- [**Layout Rules**](../components/layout/README.md) - For page structure and layout patterns.
- [**Table Component Rules**](../components/data-display/table.md) - For table usage, selection, and actions.
- [**Data View Component Rules**](../components/data-display/README.md) - For data view usage.
- [**Styling Rules**](./styling-standards.md) - For CSS and styling approaches.

## 1. Component Composition

### PatternFly-First Approach

Always start with standard PatternFly components and compose them to build complex UIs. Avoid creating custom components when a PatternFly solution already exists.

```jsx
// ✅ Correct: Compose existing PatternFly components
import { Card, CardTitle, CardBody, Button, Content } from '@patternfly/react-core';

const UserCard = ({ user, onEdit }) => (
  <Card>
    <CardTitle>{user.name}</CardTitle>
    <CardBody>
      <Content component="p">{user.email}</Content>
      <Button variant="secondary" onClick={onEdit}>
        Edit
      </Button>
    </CardBody>
  </Card>
);
```

### Component Hierarchy

Structure your application in a clear hierarchy:

1.  **Page Components**: Top-level page structure.
2.  **Section Components**: Major page sections, often corresponding to a `PageSection`.
3.  **Feature Components**: Components that encapsulate a specific piece of functionality.
4.  **PatternFly Components**: The base building blocks from `@patternfly/react-core`.

### Data Display

For displaying labeled data or key-value pairs, always use PatternFly's `DescriptionList` components for clarity and accessibility.

- **See**: [DescriptionList Documentation](https://www.patternfly.org/components/description-list)

## 2. State Management

### Local vs. Shared State

- **Local State (`useState`)**: Use for component-specific UI state like form inputs or toggles.
- **Shared State (`useContext`)**: Use for state that needs to be accessed by multiple components in a tree.
- **Complex State (`useReducer`)**: Use for state with complex update logic.

Keep state as local as possible and only lift it when necessary.

## 3. Common Patterns

For detailed guidance and code examples on common UI patterns, refer to the specific documentation:

- **Selectable Tables**: See [Table Component Rules](../components/data-display/table.md).
- **Dropdown Actions**: See the [Dropdown Documentation](https://www.patternfly.org/components/menus/dropdown).
- **Toolbar with Filters**: See the [Toolbar Documentation](https://www.patternfly.org/components/toolbar).

## 4. Error Handling and Data States

Always account for different data states in your components:

- ✅ **Loading State**: Show a `Spinner` or `Skeleton` while data is fetching.
- ✅ **Error State**: Display a clear error message, often using `EmptyState`.
- ✅ **Empty State**: Provide a message when there is no data to display.

```jsx
// ✅ Required: Handle all data states
import { EmptyState, Spinner } from '@patternfly/react-core';

if (isLoading) return <Spinner />;
if (error) return <EmptyState titleText="Error" icon={ErrorIcon} />;
if (!data?.length) return <EmptyState titleText="No results found" />;

return <MyComponent data={data} />;
```

## 5. Performance

- **Memoization**: Use `React.memo`, `useCallback`, and `useMemo` to prevent unnecessary re-renders, especially in lists.
- **Virtualization**: For long lists or tables (1000+ rows), use a virtualization library to ensure performance.
- **Lazy Loading**: Use `React.lazy` and `Suspense` to code-split parts of your application and load them on demand.

## 6. Testing

- **Focus on Behavior**: Test what the user can do (e.g., clicking a button, filling a form), not component implementation details.
- **Accessibility**: Always include tests for ARIA attributes and keyboard navigation.
- **Don't Test PatternFly**: Trust that PatternFly components are already tested. Focus your tests on your application's logic.

## Quick Reference

- [**PatternFly Components**](https://www.patternfly.org/components) - Official component documentation
- [**React Patterns**](https://reactpatterns.com/) - Common React patterns and best practices
- [**Testing Library**](https://testing-library.com/) - Component testing best practices

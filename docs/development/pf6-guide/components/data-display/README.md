# Data Display Rules

Essential rules for PatternFly data display components including lists, data presentation, and data view patterns.

## Related Files

- [**Component Architecture**](../../guidelines/component-architecture.md) - Data component structure rules
- [**Layout Rules**](../layout/README.md) - Page structure patterns
- [**Table Documentation**](./table.md) - Table component rules and best practices

## Dropdown Action Rules

### Required Dropdown Pattern

- ✅ **Use MenuToggle with variant="plain"** - For kebab-style dropdowns
- ✅ **Configure popperProps** - Prevent clipping issues
- ✅ **Use EllipsisVIcon** - Standard kebab menu icon

```jsx
// ✅ Required dropdown pattern
import { Dropdown, DropdownList, DropdownItem, MenuToggle, Divider } from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';

<Dropdown
  popperProps={{
    position: 'right',
    enableFlip: true,
    appendTo: () => document.body, // Prevents clipping
  }}
  toggle={(toggleRef) => (
    <MenuToggle ref={toggleRef} variant="plain" aria-label={`Actions for ${item.name}`}>
      <EllipsisVIcon />
    </MenuToggle>
  )}
>
  <DropdownList>
    <DropdownItem onClick={() => onEdit(item)}>Edit</DropdownItem>
    <Divider />
    <DropdownItem onClick={() => onDelete(item)}>Delete</DropdownItem>
  </DropdownList>
</Dropdown>;
```

## Toolbar Rules

### Required Toolbar Pattern

- ✅ **Use clearAllFilters prop** - For "Clear all filters" functionality
- ✅ **Use ToolbarFilter with labels** - Display active filters as chips
- ✅ **Use ToolbarToggleGroup** - For responsive filter collapsing
- ✅ **Show bulk actions when items selected** - Conditional bulk action UI

```jsx
// ✅ Required toolbar pattern
import { Toolbar, ToolbarContent, ToolbarFilter, ToolbarToggleGroup } from '@patternfly/react-core';

<Toolbar
  clearAllFilters={onClearFilters}
  clearFiltersButtonText="Clear all filters"
  collapseListedFiltersBreakpoint="xl"
>
  <ToolbarContent>
    {selectedCount > 0 && (
      <ToolbarGroup>
        <ToolbarItem>{selectedCount} selected</ToolbarItem>
        <ToolbarItem>
          <BulkActionsDropdown />
        </ToolbarItem>
      </ToolbarGroup>
    )}
    <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
      <ToolbarFilter labels={activeFilters} deleteLabel={removeFilter}>
        <SearchInput />
      </ToolbarFilter>
    </ToolbarToggleGroup>
  </ToolbarContent>
</Toolbar>;
```

## State Management Rules

### Required State Patterns

- ✅ **Use Set for selection** - More efficient than arrays
- ✅ **Handle loading states** - Show spinners or skeletons
- ✅ **Handle empty states** - Show appropriate messages
- ✅ **Handle error states** - Show error messages with retry

```jsx
// ✅ Required state management
const [selectedItems, setSelectedItems] = useState(new Set());
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);

if (isLoading) return <Skeleton />;
if (error)
  return (
    <EmptyState>
      <EmptyStateHeader titleText="Error" />
    </EmptyState>
  );
if (!data?.length)
  return (
    <EmptyState>
      <EmptyStateHeader titleText="No data" />
    </EmptyState>
  );
```

## Performance Rules

### Required Optimizations

- ✅ **Use pagination for large datasets** - Better UX than virtualization
- ✅ **Memoize table rows** - React.memo for performance
- ✅ **Use useCallback for handlers** - Stable references

```jsx
// ✅ Required for large datasets
import { Pagination } from '@patternfly/react-core';

// For better UX, use pagination
<Pagination itemCount={data.length} perPage={20} page={page} />;
```

## Essential Do's and Don'ts

### ✅ Do's

- Use composable Table components (Thead, Tbody, Tr, Th, Td)
- Implement proper sorting with sort prop on Th components
- Use Checkbox components for selectable rows
- Configure dropdown positioning with popperProps
- Provide empty states for no data and filtered results
- Implement loading states with skeletons or spinners
- Use proper ARIA labels for accessibility

### ❌ Don'ts

- Create custom table components when PatternFly Table exists
- Ignore responsive design for data tables
- Skip loading and empty states
- Forget to handle dropdown clipping issues
- Use inconsistent selection patterns
- Skip accessibility considerations for interactive elements

## Common Issues

### Dropdown Clipping

```jsx
// ✅ Solution: Use appendTo to prevent clipping
<Dropdown popperProps={{ appendTo: () => document.body }}>
```

### Performance Issues

- **1000+ rows**: Use virtualization with react-window
- **Large datasets**: Implement pagination
- **Slow rendering**: Memoize components with React.memo

### Selection Issues

- **Use Set not Array**: More efficient for selection state
- **Handle indeterminate**: For "select all" checkbox state
- **Provide feedback**: Show selected count and bulk actions

## Quick Reference

- **[Table Component](https://www.patternfly.org/components/table)** - Official table documentation
- **[Toolbar Component](https://www.patternfly.org/components/toolbar)** - Toolbar with filters
- **[Dropdown Component](https://www.patternfly.org/components/menus/dropdown)** - Dropdown positioning

## Using the Data View Component

The `@patternfly/react-data-view` component is a powerful, opinionated tool for building consistent data-driven tables and lists. It composes standard PatternFly components like `Table`, `Toolbar`, and `Pagination` into a single, streamlined API.

### When to Use Data View

- ✅ **Use for standard list pages**: When you need to display a list of resources with common functionality like filtering, sorting, selection, and actions.
- ✅ **To enforce consistency**: Use it across your application to ensure all data tables look and behave the same.
- ❌ **Not for highly custom layouts**: If your layout deviates significantly from a standard table or list view, composing individual PatternFly components may be a better approach.

## Data view documentation

- **[Data view](https://www.patternfly.org/extensions/data-view/overview)** - Official data view documentation
- **[Table Component](https://www.patternfly.org/extensions/data-view/table)** - Data view's table documentation and examples
- **[Toolbar Component](https://www.patternfly.org/extensions/data-view/toolbar/)** - Data view's toolbar documentation and examples

### Required Setup

1.  **Installation**:

    ```bash
    npm install @patternfly/react-data-view
    ```

2.  **CSS Import**:

    ```jsx
    // Import required CSS in your application's entrypoint
    import '@patternfly/react-data-view/dist/css/main.css';
    ```

3.  **Component Import**:
    ```jsx
    // Use dynamic imports for better performance
    import DataView from '@patternfly/react-data-view/dist/dynamic/DataView';
    ```

### Best Practices

- **Provide stable data and columns**: For performance, memoize the `data` and `columns` props passed to `DataView`, especially if they are derived from other state.

  ```jsx
  const columns = useMemo(() => [...], []);
  const data = useMemo(() => [...], [sourceData]);

  <DataView data={data} columns={columns} />
  ```

- **Leverage the built-in toolbar**: `DataView` includes a `Toolbar` with filtering capabilities. Provide filter configurations instead of building your own toolbar from scratch.

- **Use the provided action resolver**: For row actions, use the `onRowAction` prop and provide an action resolver function. This ensures actions are handled consistently.

### Real-World Example: OpenShift Console

A production example of PatternFly Data View usage can be found in the OpenShift Console codebase. It's an excellent resource for seeing how `DataView` is integrated with live Kubernetes data and Redux for state management.

- **[DataViewPodList.tsx on GitHub](https://github.com/openshift/console/blob/79d29bca8440a5ad82b5257bb0f37bc24384eb0e/frontend/public/components/data-view-poc/DataViewPodList.tsx)**

Key integration patterns from this example include:

- Integrating Data View with live Kubernetes data and application state.
- Passing dynamic data and columns to the component.
- Handling loading, error, and empty states in a production context.
- Using PatternFly composable components for custom row rendering and actions.
- Connecting Data View to Redux or other state management solutions.

> For advanced usage, review the linked file to see how Data View is composed with other PatternFly and application-specific components.

> **Note:** Always consult the latest PatternFly Data View documentation and demo source code for the most up-to-date usage patterns and best practices.

- [PatternFly React Data View GitHub](https://github.com/patternfly/react-data-view)
- [PatternFly Data View NPM](https://www.npmjs.com/package/@patternfly/react-data-view)

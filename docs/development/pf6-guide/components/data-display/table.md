# Table Component Rules

Essential rules for PatternFly table components, including usage, sorting, selection, performance, accessibility, and best practices.

## Required Table Structure

- ✅ **Use composable Table components** - `Table`, `Thead`, `Tbody`, `Tr`, `Th`, `Td`
- ✅ **Import from @patternfly/react-table** - Not @patternfly/react-core
- ❌ **Don't create custom table components** - Use PatternFly's composable approach

```jsx
// ✅ Correct table structure
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';

<Table>
  <Thead>
    <Tr>
      <Th>Name</Th>
      <Th>Email</Th>
    </Tr>
  </Thead>
  <Tbody>
    {data.map((item) => (
      <Tr key={item.id}>
        <Td>{item.name}</Td>
        <Td>{item.email}</Td>
      </Tr>
    ))}
  </Tbody>
</Table>;
```

## Sorting Rules

- ✅ **Use sort prop on Th components** - Configure sorting via the `sort` prop
- ✅ **Manage sort state with useState** - Track sortBy state
- ✅ **Use useMemo for sorted data** - Performance optimization

```jsx
// ✅ Required sorting pattern
const [sortBy, setSortBy] = useState({});

<Th sort={{ sortBy, onSort: handleSort, columnIndex: 0 }}>Name</Th>;
```

## Selection Rules

- ✅ **Use Set for selection state** - More efficient than arrays
- ✅ **Handle indeterminate state** - For "select all" checkbox
- ✅ **Use proper ARIA labels** - For accessibility

```jsx
// ✅ Required selection pattern
const [selectedItems, setSelectedItems] = useState(new Set());

const isAllSelected = selectedItems.size === data.length && data.length > 0;
const isPartiallySelected = selectedItems.size > 0 && selectedItems.size < data.length;

<Checkbox
  isChecked={isAllSelected ? true : isPartiallySelected ? null : false}
  onChange={handleSelectAll}
  aria-label="Select all rows"
/>;
```

## Column and Header Management

PatternFly provides powerful props for controlling column widths and making headers and columns "sticky" for better usability with wide or long tables.

### Column Width Control

Use the `width` modifier on the `<Th>` component to specify column widths as a percentage of the table's total width.

- ✅ **Use `width(percentage)`**: Best for flexible, responsive layouts.
- ❌ **Avoid fixed pixel widths**: Can break responsiveness.

```jsx
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { width } from '@patternfly/react-table';

<Table>
  <Thead>
    <Tr>
      <Th width={40}>User ID</Th>
      <Th width={30}>Name</Th>
      <Th width={30}>Email</Th>
    </Tr>
  </Thead>
  <Tbody>{/* ... */}</Tbody>
</Table>;
```

### Controlling Text and Column Width

In addition to setting explicit widths, you can control how text behaves within cells using the `modifier` prop on `<Th>` and `<Td>` components. This influences column dimensions and text overflow.

Key text modifiers include:

- **`truncate`**: Truncates text with an ellipsis.
- **`wrap`**: Forces text to wrap, which is useful for long header text.
- **`nowrap`**: Prevents text from wrapping.
- **`breakWord`**: Forces long, unbreakable strings (like URLs) to break.
- **`fitContent`**: Shrinks the column to fit its content.

For detailed usage and code examples, see the official PatternFly documentation and the example in the PatternFly React repository.

- [**Controlling Text in Tables (PatternFly Docs)**](https://www.patternfly.org/components/table/controlling-text)
- [**TableControllingText.tsx Example on GitHub**](https://github.com/patternfly/patternfly-react/blob/main/packages/react-table/src/components/Table/examples/TableControllingText.tsx)

### Sticky Headers and Columns

For tables that scroll horizontally or vertically, you can make the header, specific columns, or the action column "sticky."

- **`isStickyHeader`**: Add this prop to the `<Table>` component to make the header row stick to the top during vertical scrolling.
- **`isSticky`**: Add this prop to a `<Th>` or `<Td>` component to make an entire column sticky during horizontal scrolling. This is commonly used for the first column (e.g., selection checkbox or ID), or last column (e.g. columns containing actions menus).

```jsx
// ✅ Sticky header, first column, and action column
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';

<Table isStickyHeader>
  <Thead>
    <Tr>
      <Th isSticky>ID</Th>
      <Th>Name</Th>
      {/* ... more columns */}
      <Th>Actions</Th>
    </Tr>
  </Thead>
  <Tbody>
    {data.map((item) => (
      <Tr key={item.id}>
        <Td isSticky>{item.id}</Td>
        <Td>{item.name}</Td>
        {/* ... more cells */}
        <Td isSticky>
          <ActionsDropdown />
        </Td>
      </Tr>
    ))}
  </Tbody>
</Table>;
```

## Performance Rules

- ✅ **Use Skeleton for loading states** - Provide visual feedback
- ✅ **Ensure responsive behavior** - Test on multiple screen sizes
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

### Selection Issues

- **Use Set not Array**: More efficient for selection state
- **Handle indeterminate**: For "select all" checkbox state
- **Provide feedback**: Show selected count and bulk actions

## Quick Reference

- **[Table Component](https://www.patternfly.org/components/table)** - Official table documentation

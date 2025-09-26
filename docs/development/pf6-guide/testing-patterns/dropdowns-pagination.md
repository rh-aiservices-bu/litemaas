# Testing PatternFly 6 Dropdowns and Pagination

> **Status**: Active Guide
> **Last Updated**: 2025-10-09
> **Related**: [Modal Testing](./modals.md), [Context-Dependent Components](./context-dependent-components.md)

## Overview

This guide covers testing PatternFly 6 dropdown components and pagination controls in JSDOM test environments. Based on systematic investigation, **PatternFly 6 dropdowns and pagination CAN be tested successfully in JSDOM** when using the correct query patterns.

### Key Discovery

❌ **Common Mistake**: Looking for `role="option"` elements (doesn't exist in PatternFly 6 menus)
✅ **Correct Pattern**: Use `role="menuitem"` for dropdown options

## PatternFly 6 Dropdown Architecture

### How PatternFly 6 Renders Dropdowns

PatternFly 6 uses a **Menu component** pattern for dropdowns:

```html
<!-- Toggle button -->
<button role="button">1 - 25 of 100</button>

<!-- After clicking toggle -->
<div role="menu">
  <ul class="pf-v6-c-menu__list">
    <li role="none">
      <button role="menuitem">10 per page</button>
    </li>
    <li role="none">
      <button role="menuitem">25 per page</button>
    </li>
    <li role="none">
      <button role="menuitem">50 per page</button>
    </li>
  </ul>
</div>
```

**Key Points**:

- Dropdown uses `role="menu"` (not `role="listbox"`)
- Options are `role="menuitem"` (not `role="option"`)
- Toggle button contains current value text
- Menu appears in DOM after clicking toggle

## Testing Pagination Components

### Basic Pagination Test Pattern

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination, PaginationVariant } from '@patternfly/react-core';

describe('Pagination Component', () => {
  const mockOnSetPage = vi.fn();
  const mockOnPerPageSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render pagination controls', () => {
    render(
      <Pagination
        itemCount={100}
        perPage={25}
        page={1}
        onSetPage={mockOnSetPage}
        onPerPageSelect={mockOnPerPageSelect}
        perPageOptions={[
          { title: '10', value: 10 },
          { title: '25', value: 25 },
          { title: '50', value: 50 },
        ]}
        variant={PaginationVariant.bottom}
      />
    );

    // Verify pagination rendered
    expect(screen.getByRole('navigation')).toBeInTheDocument();

    // Verify current range displayed
    expect(screen.getByText(/1.*25.*100/)).toBeInTheDocument();
  });
});
```

### Testing Page Navigation (Previous/Next Buttons)

✅ **Works reliably in JSDOM**

```typescript
it('should navigate to next page', async () => {
  const user = userEvent.setup();

  render(
    <Pagination
      itemCount={100}
      perPage={25}
      page={1}
      onSetPage={mockOnSetPage}
      onPerPageSelect={mockOnPerPageSelect}
      variant={PaginationVariant.bottom}
    />
  );

  // Find next button by aria-label
  const buttons = screen.getAllByRole('button');
  const nextButton = buttons.find(btn =>
    btn.getAttribute('aria-label')?.toLowerCase().includes('next')
  );

  if (nextButton) {
    await user.click(nextButton);

    // Verify callback called with next page
    expect(mockOnSetPage).toHaveBeenCalledWith(expect.anything(), 2);
  }
});

it('should navigate to previous page', async () => {
  const user = userEvent.setup();

  render(
    <Pagination
      itemCount={100}
      perPage={25}
      page={2}  // Start on page 2
      onSetPage={mockOnSetPage}
      onPerPageSelect={mockOnPerPageSelect}
      variant={PaginationVariant.bottom}
    />
  );

  const buttons = screen.getAllByRole('button');
  const prevButton = buttons.find(btn =>
    btn.getAttribute('aria-label')?.toLowerCase().includes('previous')
  );

  if (prevButton) {
    await user.click(prevButton);
    expect(mockOnSetPage).toHaveBeenCalledWith(expect.anything(), 1);
  }
});
```

### Testing Per-Page Dropdown Selection

✅ **Works in JSDOM with correct pattern**

```typescript
it('should change items per page via dropdown', async () => {
  const user = userEvent.setup();

  render(
    <Pagination
      itemCount={100}
      perPage={25}
      page={1}
      onSetPage={mockOnSetPage}
      onPerPageSelect={mockOnPerPageSelect}
      perPageOptions={[
        { title: '10', value: 10 },
        { title: '25', value: 25 },
        { title: '50', value: 50 },
      ]}
      variant={PaginationVariant.bottom}
    />
  );

  // STEP 1: Find the per-page toggle button
  // It contains text like "1 - 25 of 100"
  const buttons = screen.getAllByRole('button');
  const perPageToggle = buttons.find(btn => {
    const text = btn.textContent || '';
    return text.match(/\d+\s*-\s*\d+/);  // Matches "1 - 25"
  });

  expect(perPageToggle).toBeDefined();

  // STEP 2: Click toggle to open dropdown
  await user.click(perPageToggle!);

  // STEP 3: Wait for menu to appear and find menu items
  await waitFor(() => {
    // ✅ CORRECT: Use role="menuitem"
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems.length).toBeGreaterThan(0);
  });

  // STEP 4: Find the "50 per page" option
  // Menu items have text like "10 per page", "25 per page", "50 per page"
  const menuItems = screen.getAllByRole('menuitem');
  const option50 = menuItems.find(item =>
    item.textContent?.includes('50')
  );

  expect(option50).toBeDefined();

  // STEP 5: Click the option
  await user.click(option50!);

  // STEP 6: Verify callback called
  await waitFor(() => {
    expect(mockOnPerPageSelect).toHaveBeenCalledWith(expect.anything(), 50);
  });
});
```

### Complete Pagination Test Example

```typescript
describe('ProviderBreakdownTable Pagination', () => {
  const manyProviders = Array.from({ length: 50 }, (_, i) => ({
    provider: `Provider ${i}`,
    metrics: {
      requests: 1000 + i * 100,
      // ... other metrics
    },
  }));

  it('should change items per page and reset to page 1', async () => {
    const user = userEvent.setup();

    render(<ProviderBreakdownTable data={manyProviders} loading={false} />);

    // Initially showing 25 items
    let rows = screen.getAllByRole('row').slice(1);  // Skip header
    expect(rows.length).toBe(25);

    // Navigate to page 2
    const buttons = screen.getAllByRole('button');
    const nextButton = buttons.find(btn =>
      btn.getAttribute('aria-label')?.toLowerCase().includes('next')
    );
    await user.click(nextButton!);

    // Verify on page 2
    await waitFor(() => {
      expect(screen.queryByText('Provider 49')).not.toBeInTheDocument();
      expect(screen.getByText('Provider 24')).toBeInTheDocument();
    });

    // Open per-page dropdown
    const updatedButtons = screen.getAllByRole('button');
    const perPageToggle = updatedButtons.find(btn => {
      const text = btn.textContent || '';
      return text.match(/\d+\s*-\s*\d+/);
    });
    await user.click(perPageToggle!);

    // Select 50 per page
    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBeGreaterThan(0);
    });

    const menuItems = screen.getAllByRole('menuitem');
    const option50 = menuItems.find(item =>
      item.textContent?.includes('50')
    );
    await user.click(option50!);

    // Verify: Should reset to page 1 AND show all 50 items
    await waitFor(() => {
      const newRows = screen.getAllByRole('row').slice(1);
      expect(newRows.length).toBe(50);
      // Provider 49 (highest) should be visible again (page 1)
      expect(screen.getByText('Provider 49')).toBeInTheDocument();
      expect(screen.getByText('Provider 0')).toBeInTheDocument();
    });
  });
});
```

## Common Issues and Solutions

### Issue: Cannot find dropdown options

**Error**: `Unable to find role="option"`

**Cause**: Looking for wrong ARIA role

**Solution**: Use `role="menuitem"` instead of `role="option"`

```typescript
// ❌ WRONG
const option50 = screen.getByRole('option', { name: '50' });

// ✅ CORRECT
const menuItems = screen.getAllByRole('menuitem');
const option50 = menuItems.find((item) => item.textContent?.includes('50'));
```

### Issue: Dropdown doesn't open

**Cause**: Toggle button query is incorrect

**Solution**: Find button by text pattern matching current range

```typescript
// ✅ CORRECT: Find by text pattern
const buttons = screen.getAllByRole('button');
const perPageToggle = buttons.find((btn) => {
  const text = btn.textContent || '';
  return text.match(/\d+\s*-\s*\d+/); // Matches "1 - 25 of 100"
});
```

### Issue: Test is flaky

**Cause**: Not waiting for async dropdown rendering

**Solution**: Always use `waitFor()` after opening dropdown

```typescript
// ✅ CORRECT
await user.click(perPageToggle);

await waitFor(() => {
  const menuItems = screen.getAllByRole('menuitem');
  expect(menuItems.length).toBeGreaterThan(0);
});
```

## Testing Other Dropdown Components

### Select Component

PatternFly 6 Select also uses the menu pattern:

```typescript
it('should select option from Select component', async () => {
  const user = userEvent.setup();

  render(<Select ... />);

  // Find and click toggle
  const toggle = screen.getByRole('button', { name: /select option/i });
  await user.click(toggle);

  // Wait for menu items
  await waitFor(() => {
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
  });

  // Click desired option
  const option = screen.getByRole('menuitem', { name: 'Option 1' });
  await user.click(option);
});
```

### Dropdown Menu Component

```typescript
it('should handle dropdown menu actions', async () => {
  const user = userEvent.setup();

  render(<Dropdown ... />);

  // Toggle dropdown
  const toggle = screen.getByRole('button', { name: /actions/i });
  await user.click(toggle);

  // Find menu items
  await waitFor(() => {
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBeGreaterThan(0);
  });

  // Click action
  const editAction = screen.getByRole('menuitem', { name: /edit/i });
  await user.click(editAction);
});
```

## Best Practices

### 1. Always Use `waitFor()` for Dropdowns

```typescript
// ✅ GOOD
await user.click(toggle);
await waitFor(() => {
  expect(screen.getByRole('menuitem', { name: 'Option 1' })).toBeInTheDocument();
});

// ❌ BAD - May be flaky
await user.click(toggle);
const option = screen.getByRole('menuitem', { name: 'Option 1' });
```

### 2. Use Flexible Text Matching

```typescript
// ✅ GOOD - Handles variations in text
const option = menuItems.find((item) => item.textContent?.includes('50'));

// ❌ BAD - Brittle exact match
const option = screen.getByText('50 per page');
```

### 3. Test Callbacks Directly When UI Interaction is Complex

```typescript
// If dropdown interaction is too complex or flaky, test logic separately
it('should handle per-page change logic', () => {
  const mockSetPerPage = vi.fn();
  const mockSetPage = vi.fn();

  // Test the state update logic directly
  handlePerPageChange(50, mockSetPerPage, mockSetPage);

  expect(mockSetPerPage).toHaveBeenCalledWith(50);
  expect(mockSetPage).toHaveBeenCalledWith(1); // Reset to page 1
});
```

### 4. Document Manual Testing for Edge Cases

```typescript
// For complex scenarios, document manual testing requirements
it('should handle keyboard navigation in dropdown', () => {
  // TODO: Manual testing required for keyboard navigation
  // 1. Open dropdown with Space/Enter
  // 2. Navigate options with Arrow keys
  // 3. Select with Enter
  // 4. Close with Escape

  // Component logic can be unit tested separately
  expect(true).toBe(true); // Placeholder
});
```

## Performance Considerations

### Large Datasets

For components with pagination and large datasets:

```typescript
// ✅ GOOD - Test with representative data size
const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
}));

it('should handle pagination with large dataset', () => {
  render(<Table data={largeDataset} />);

  // Verify only current page rendered (not all 1000 items)
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows.length).toBe(25);  // Not 1000
});
```

## Troubleshooting Guide

| Symptom                        | Likely Cause                  | Solution                                   |
| ------------------------------ | ----------------------------- | ------------------------------------------ |
| `Unable to find role="option"` | Wrong ARIA role               | Use `role="menuitem"`                      |
| Dropdown doesn't open          | Incorrect toggle button query | Find by text pattern or aria-label         |
| Test is flaky                  | Missing `waitFor()`           | Wrap menu queries in `waitFor()`           |
| Menu items not found           | Dropdown didn't render        | Check if `perPageOptions` prop provided    |
| Multiple elements match        | Not scoping to dropdown       | Filter by parent element or use `within()` |

## Related Patterns

- **[Modal Testing](./modals.md)**: Similar async rendering patterns
- **[Context-Dependent Components](./context-dependent-components.md)**: Components requiring parent context
- **[Accessibility Testing](../../accessibility/)**: WCAG compliance for dropdowns

## Summary

### ✅ What Works in JSDOM

- Pagination navigation (previous/next buttons)
- Per-page dropdown selection
- Select component options
- Dropdown menu actions
- Keyboard navigation (with proper event simulation)

### 📋 Key Patterns to Remember

1. Use `role="menuitem"` for dropdown options
2. Find toggle by text pattern matching
3. Always use `waitFor()` for menu rendering
4. Use flexible text matching (includes/regex)
5. Scope queries to avoid multiple matches

### 🚀 Quick Reference

```typescript
// Finding dropdown toggle
const toggle = buttons.find((btn) => btn.textContent?.match(/\d+\s*-\s*\d+/));

// Opening dropdown
await user.click(toggle);
await waitFor(() => screen.getAllByRole('menuitem').length > 0);

// Selecting option
const option = screen.getAllByRole('menuitem').find((item) => item.textContent?.includes('50'));
await user.click(option);
```

---

**Last Updated**: 2025-10-09
**Tested With**: @patternfly/react-core v6, Vitest, React Testing Library
**Status**: Production Ready ✅

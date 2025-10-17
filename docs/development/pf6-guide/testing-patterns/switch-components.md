# PatternFly 6 Switch Component Testing Patterns

**Last Updated**: 2025-10-09
**Applies To**: PatternFly 6 Switch components in LiteMaaS frontend

## Overview

PatternFly 6 `Switch` components use `role="switch"` (NOT `role="checkbox"`). This is a critical distinction for testing and differs from native HTML checkboxes.

## Discovery Context

During Phase 2 of test coverage improvement, we discovered that tests using `getByRole('checkbox')` to query Switch components were failing. PatternFly 6 Switch components implement the ARIA `switch` role for better accessibility compliance.

**Issue Encountered**:

```typescript
// ❌ WRONG - This will fail
const switches = screen.getAllByRole('checkbox');
// Error: Unable to find an accessible element with the role "checkbox"
```

**Correct Solution**:

```typescript
// ✅ CORRECT - Use role="switch"
const switches = screen.getAllByRole('switch');
```

## Testing Switch Components

### Basic Switch Query

```typescript
import { render, screen } from '@testing-library/react';
import { Switch } from '@patternfly/react-core';

it('should find switch by role', () => {
  render(
    <Switch
      id="my-switch"
      label="Enable Feature"
      isChecked={false}
      onChange={() => {}}
    />
  );

  // Query by switch role
  const switchElement = screen.getByRole('switch');
  expect(switchElement).toBeInTheDocument();
});
```

### Multiple Switches

```typescript
it('should find all switches', () => {
  render(
    <div>
      <Switch id="switch-1" label="Option 1" isChecked={false} onChange={() => {}} />
      <Switch id="switch-2" label="Option 2" isChecked={true} onChange={() => {}} />
      <Switch id="switch-3" label="Option 3" isChecked={false} onChange={() => {}} />
    </div>
  );

  const switches = screen.getAllByRole('switch');
  expect(switches).toHaveLength(3);
});
```

### Checking Switch State

```typescript
it('should check if switch is checked', () => {
  render(
    <Switch
      id="my-switch"
      label="Enable Feature"
      isChecked={true}
      onChange={() => {}}
    />
  );

  const switchElement = screen.getByRole('switch');
  expect(switchElement).toBeChecked();
});

it('should check if switch is unchecked', () => {
  render(
    <Switch
      id="my-switch"
      label="Enable Feature"
      isChecked={false}
      onChange={() => {}}
    />
  );

  const switchElement = screen.getByRole('switch');
  expect(switchElement).not.toBeChecked();
});
```

### Testing Switch Interactions

```typescript
import userEvent from '@testing-library/user-event';

it('should toggle switch when clicked', async () => {
  const handleChange = vi.fn();
  const user = userEvent.setup();

  render(
    <Switch
      id="my-switch"
      label="Enable Feature"
      isChecked={false}
      onChange={(event, checked) => handleChange(checked)}
    />
  );

  const switchElement = screen.getByRole('switch');
  expect(switchElement).not.toBeChecked();

  await user.click(switchElement);

  expect(handleChange).toHaveBeenCalledWith(true);
});
```

### Testing Disabled Switches

```typescript
it('should not allow interaction when disabled', async () => {
  const handleChange = vi.fn();
  const user = userEvent.setup();

  render(
    <Switch
      id="my-switch"
      label="Enable Feature"
      isChecked={false}
      isDisabled={true}
      onChange={handleChange}
    />
  );

  const switchElement = screen.getByRole('switch');
  expect(switchElement).toBeDisabled();

  await user.click(switchElement);

  // Should not trigger onChange
  expect(handleChange).not.toHaveBeenCalled();
});
```

## Real-World Example: Role Management

From `UserEditModal.test.tsx`:

```typescript
describe('Role Management', () => {
  it('should display role switches for admin users', () => {
    const user = createMockUser();
    renderWithAuth(
      <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
      { user: mockAdminUser },
    );

    // Get all switches - there should be 3 role switches (PatternFly Switch uses role="switch")
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3);
  });

  it('should pre-select user roles correctly', () => {
    const user = createMockUser({ roles: ['user', 'admin'] });
    renderWithAuth(
      <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
      { user: mockAdminUser },
    );

    // Get all switches - 2 should be checked (user and admin)
    const switches = screen.getAllByRole('switch');
    const checkedSwitches = switches.filter((sw) => (sw as HTMLInputElement).checked);
    expect(checkedSwitches).toHaveLength(2);
  });

  it('should toggle role when switch is clicked', async () => {
    const user = createMockUser({ roles: ['user'] });
    const userEvent = await import('@testing-library/user-event').then((m) => m.default.setup());

    renderWithAuth(
      <UserEditModal user={user} canEdit={true} onClose={mockOnClose} onSave={mockOnSave} />,
      { user: mockAdminUser },
    );

    const switches = screen.getAllByRole('switch');
    // Find the admin switch (should be the second one - index 1)
    const adminSwitch = switches[1];
    expect(adminSwitch).not.toBeChecked();

    await userEvent.click(adminSwitch);

    expect(adminSwitch).toBeChecked();
  });
});
```

## Accessibility Notes

### Why `role="switch"` Instead of `role="checkbox"`?

PatternFly 6 uses `role="switch"` for better semantic meaning:

- **Switch**: Represents an on/off toggle (binary state)
- **Checkbox**: Represents a selection from a set (can be part of a group)

From an accessibility perspective:

- Screen readers announce "switch" controls differently than "checkbox" controls
- The switch role better communicates the immediate state change behavior
- Follows ARIA 1.2+ best practices

### ARIA Attributes on PatternFly Switch

PatternFly Switch components include:

```html
<button role="switch" aria-checked="true" aria-label="Enable Feature" class="pf-v6-c-switch">
  <!-- switch content -->
</button>
```

## Common Pitfalls

### ❌ Using Checkbox Role

```typescript
// This will fail with PatternFly 6 Switch
const switchElement = screen.getByRole('checkbox');
```

### ❌ Querying by Input Element

```typescript
// Switch is not an input element, it's a button with role="switch"
const switchElement = screen.getByRole('input');
```

### ❌ Using Label Text Without Proper Query

```typescript
// May not work as expected - use aria-label or role query
const switchElement = screen.getByLabelText('Enable Feature');
```

## Best Practices

### ✅ Always Use `role="switch"`

```typescript
const switches = screen.getAllByRole('switch');
```

### ✅ Test Both Checked States

```typescript
expect(switchElement).toBeChecked();
expect(switchElement).not.toBeChecked();
```

### ✅ Test Disabled State

```typescript
expect(switchElement).toBeDisabled();
```

### ✅ Verify onChange Behavior

```typescript
await user.click(switchElement);
expect(handleChange).toHaveBeenCalledWith(expectedValue);
```

## Read-Only Mode Testing

When switches are not rendered (read-only view):

```typescript
it('should not render switches in read-only mode', () => {
  renderWithAuth(
    <UserEditModal user={user} canEdit={false} onClose={mockOnClose} onSave={mockOnSave} />,
    { user: mockAdminUser },
  );

  // Switches should not be present in read-only mode
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});
```

## Related Documentation

- [PatternFly 6 Switch Component Docs](https://www.patternfly.org/components/forms/switch)
- [ARIA Switch Role Spec](https://www.w3.org/TR/wai-aria-1.2/#switch)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Modal Testing Patterns](./modals.md)
- [Dropdown Testing Patterns](./dropdowns-pagination.md)

## See Also

- [Context-Dependent Components](./context-dependent-components.md) - For components requiring specific parent props
- [Modals](./modals.md) - For testing components within modal dialogs
- [Dropdowns & Pagination](./dropdowns-pagination.md) - For other PatternFly 6 interactive components

# Testing PatternFly 6 Modal Components

> **Status**: Active Guide
> **Last Updated**: 2025-10-09
> **Purpose**: Comprehensive guide for testing PatternFly 6 Modal components in JSDOM environment

---

## Table of Contents

1. [Overview](#overview)
2. [Modal Behavior in JSDOM](#modal-behavior-in-jsdom)
3. [Basic Testing Pattern](#basic-testing-pattern)
4. [Common Testing Scenarios](#common-testing-scenarios)
5. [Common Issues and Solutions](#common-issues-and-solutions)
6. [Best Practices](#best-practices)
7. [Examples](#examples)
8. [References](#references)

---

## Overview

### What You'll Learn

- How PatternFly 6 modals render in JSDOM test environment
- Proven testing patterns for modal interactions
- Solutions to common modal testing issues
- Best practices for modal accessibility testing

### Key Takeaway

✅ **PatternFly 6 modals work perfectly in JSDOM** with no special workarounds needed!

---

## Modal Behavior in JSDOM

### DOM Structure

When a PatternFly 6 Modal opens, it creates the following structure:

```html
<body class="pf-v6-c-backdrop__open">
  <!-- Original content becomes hidden -->
  <div aria-hidden="true">
    <button>Open Modal</button>
  </div>

  <!-- Modal portal rendered as direct child of body -->
  <div class="pf-v6-c-backdrop" id="pf-modal-part-X">
    <div class="pf-v6-l-bullseye">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-modal-part-X"
        class="pf-v6-c-modal-box pf-m-md"
      >
        <!-- Built-in close button (X icon) -->
        <div class="pf-v6-c-modal-box__close">
          <button aria-label="Close">×</button>
        </div>

        <!-- Modal header -->
        <header class="pf-v6-c-modal-box__header">
          <h1 class="pf-v6-c-modal-box__title">
            <span class="pf-v6-c-modal-box__title-text">Modal Title</span>
          </h1>
        </header>

        <!-- Modal body with your content -->
        <div class="pf-v6-c-modal-box__body">
          <!-- Your modal content here -->
        </div>

        <!-- Optional modal footer -->
        <footer class="pf-v6-c-modal-box__footer">
          <!-- Footer buttons -->
        </footer>
      </div>
    </div>
  </div>
</body>
```

### Portal Behavior

✅ **Modal portals to document.body** (not React root):

- Creates `<div class="pf-v6-c-backdrop">` as direct child of `<body>`
- Original page content gets `aria-hidden="true"` when modal opens
- Body element gets class `pf-v6-c-backdrop__open` when modal is active
- All content remains accessible to React Testing Library queries

### ARIA Attributes

✅ **All ARIA attributes render correctly**:

- `role="dialog"` - Identifies the modal
- `aria-modal="true"` - Indicates modal behavior
- `aria-labelledby="pf-modal-part-X"` - Links to modal title
- `aria-describedby` - Optional, links to description
- Built-in close button has `aria-label="Close"`

---

## Basic Testing Pattern

### Step-by-Step Approach

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, ModalBody, ModalHeader, Button } from '@patternfly/react-core';

it('should open and interact with modal', async () => {
  // 1. Set up user event
  const user = userEvent.setup();

  // 2. Render component
  render(<ComponentWithModal />);

  // 3. Open modal
  await user.click(screen.getByRole('button', { name: /open/i }));

  // 4. Wait for modal to appear
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // 5. Verify modal content
  expect(screen.getByText(/modal content/i)).toBeInTheDocument();

  // 6. Interact with modal elements
  const input = screen.getByLabelText(/name/i);
  await user.type(input, 'Test Value');

  // 7. Submit or close modal
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // 8. Verify modal is closed
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

### Essential Rules

1. ✅ **Always use `waitFor()`** - Modal rendering is async
2. ✅ **Use `queryByRole('dialog')`** - To check if modal exists
3. ✅ **Use `getByRole('dialog')`** - When modal should be present (throws if not found)
4. ✅ **Set up userEvent** - Use `userEvent.setup()` for better async handling

---

## Common Testing Scenarios

### 1. Opening a Modal

```typescript
it('should open modal when button clicked', async () => {
  const user = userEvent.setup();
  render(<ComponentWithModal />);

  // Verify modal is closed initially
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // Click trigger button
  await user.click(screen.getByRole('button', { name: /create/i }));

  // Wait for and verify modal is open
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

### 2. Closing a Modal

```typescript
it('should close modal when cancel clicked', async () => {
  const user = userEvent.setup();
  render(<ComponentWithModal />);

  // Open modal
  await user.click(screen.getByRole('button', { name: /open/i }));
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // Click cancel button
  await user.click(screen.getByRole('button', { name: /cancel/i }));

  // Verify modal is closed
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

### 3. Form Submission in Modal

```typescript
it('should submit form data from modal', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<ComponentWithModal onSubmit={onSubmit} />);

  // Open modal
  await user.click(screen.getByRole('button', { name: /create/i }));
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // Fill form
  await user.type(screen.getByLabelText(/name/i), 'Test Name');
  await user.type(screen.getByLabelText(/description/i), 'Test Description');

  // Submit
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Verify submission
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test Name',
      description: 'Test Description'
    });
  });

  // Verify modal closed
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

### 4. Testing ARIA Attributes

```typescript
it('should have proper ARIA attributes', async () => {
  const user = userEvent.setup();
  render(<ComponentWithModal />);

  await user.click(screen.getByRole('button', { name: /open/i }));

  await waitFor(() => {
    const dialog = screen.getByRole('dialog');

    // Verify ARIA attributes
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      dialog.getAttribute('aria-labelledby') ||
      dialog.getAttribute('aria-label')
    ).toBeTruthy();
  });
});
```

### 5. Testing Modal Content Accessibility

```typescript
it('should make modal content accessible', async () => {
  const user = userEvent.setup();
  render(<ComponentWithModal />);

  await user.click(screen.getByRole('button', { name: /open/i }));
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // All content should be queryable
  expect(screen.getByRole('heading', { name: /modal title/i })).toBeInTheDocument();
  expect(screen.getByText(/modal description/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/input field/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
});
```

---

## Common Issues and Solutions

### Issue 1: Multiple Close Buttons

**Problem**: PatternFly Modal includes a built-in close button (X icon) AND your component may have custom close buttons (Cancel, Close, etc.). Both may match generic queries like `/close/i`.

**Error**:

```
TestingLibraryElementError: Found multiple elements with the role "button" and name `/close/i`
```

**Solutions**:

#### Option 1: Use Exact Match for Built-in Close Button

```typescript
// Find built-in close button by exact aria-label
const closeButton = screen.getByRole('button', { name: 'Close' });
await user.click(closeButton);
```

#### Option 2: Find Custom Button by Text Content

```typescript
// Find all close buttons, then filter by text
const closeButtons = screen.getAllByRole('button', { name: /close/i });
const customButton = closeButtons.find((btn) => btn.textContent === 'Cancel');
await user.click(customButton);
```

#### Option 3: Use `within()` to Scope Query

```typescript
import { within } from '@testing-library/react';

// Scope query to modal body only
const modal = screen.getByRole('dialog');
const modalBody = modal.querySelector('.pf-v6-c-modal-box__body');
const cancelButton = within(modalBody).getByRole('button', { name: /cancel/i });
await user.click(cancelButton);
```

#### Option 4: Use More Specific Query

```typescript
// Query by specific button text
await user.click(screen.getByRole('button', { name: 'Cancel' }));
await user.click(screen.getByRole('button', { name: 'Submit' }));
```

---

### Issue 2: Act() Warnings

**Problem**: Tests show warnings about React state updates not wrapped in `act()`:

```
Warning: An update to ComponentWithModal inside a test was not wrapped in act(...)
```

**Analysis**:

- These warnings appear when modal state updates (open/close) trigger React re-renders
- Warnings are **informational only** and do not cause test failures
- Tests pass successfully with proper async handling

**Solution**: Use `waitFor()` for all modal operations:

```typescript
// ✅ CORRECT - waitFor handles async state updates
await waitFor(() => {
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

// ❌ WRONG - Direct query may not wait for state update
expect(screen.getByRole('dialog')).toBeInTheDocument();
```

**Note**: You can safely ignore act() warnings in modal tests as long as you're using `waitFor()` and your tests are passing. The warnings don't indicate broken functionality.

---

### Issue 3: Modal Not Found

**Problem**: `screen.getByRole('dialog')` fails to find modal.

**Possible Causes**:

#### 1. Modal Not Open

**Check**: Verify modal state is `isOpen={true}`

```typescript
// Debug modal state
const modal = screen.queryByRole('dialog');
console.log('Modal open:', modal !== null);
```

**Solution**: Ensure you've clicked the trigger button and waited for modal to open:

```typescript
await user.click(screen.getByRole('button', { name: /open/i }));
await waitFor(() => {
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

#### 2. Missing waitFor()

**Check**: Are you waiting for the modal to render?

**Solution**: Always use `waitFor()` when checking for modal:

```typescript
await waitFor(() => {
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

#### 3. Provider Issues

**Check**: Does your component need NotificationProvider or other context?

**Solution**: Use proper test setup with all required providers:

```typescript
import { renderWithProviders } from '../test-utils';

renderWithProviders(<ComponentWithModal />);
```

---

### Issue 4: Form Validation Errors Not Showing

**Problem**: Modal form validation errors don't appear in tests.

**Cause**: Validation may be async or require specific user interactions.

**Solution**:

```typescript
it('should show validation errors', async () => {
  const user = userEvent.setup();
  render(<ComponentWithModal />);

  await user.click(screen.getByRole('button', { name: /create/i }));
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // Try to submit without filling required fields
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Wait for validation errors
  await waitFor(() => {
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });
});
```

---

## Best Practices

### 1. Always Use waitFor() for Modal Operations

```typescript
// ✅ CORRECT
await waitFor(() => {
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

// ❌ WRONG - Race condition
expect(screen.getByRole('dialog')).toBeInTheDocument();
```

### 2. Test Modal in Isolation First

Create a simple test to verify basic modal behavior before testing complex interactions:

```typescript
describe('Modal behavior', () => {
  it('should open and close', async () => {
    // Basic open/close test
  });

  it('should show modal content', async () => {
    // Content verification
  });

  it('should submit form', async () => {
    // Complex interaction
  });
});
```

### 3. Use Specific Queries

```typescript
// ✅ GOOD - Specific query
screen.getByRole('button', { name: 'Create API Key' });

// ❌ BAD - Too generic
screen.getByText(/create/i);
```

### 4. Clean Up Between Tests

```typescript
describe('Modal tests', () => {
  beforeEach(() => {
    // Ensure clean slate
    document.body.innerHTML = '';
  });

  // Tests here
});
```

### 5. Test Accessibility

Always verify ARIA attributes and keyboard navigation:

```typescript
it('should be keyboard accessible', async () => {
  const user = userEvent.setup();
  render(<ComponentWithModal />);

  // Open with Enter key
  const trigger = screen.getByRole('button', { name: /open/i });
  trigger.focus();
  await user.keyboard('{Enter}');

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // Close with Escape key
  await user.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

---

## Examples

### Complete Modal Test Suite

```typescript
import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Modal, ModalBody, ModalHeader, Button, FormGroup, TextInput } from '@patternfly/react-core';

// Example component with modal
const CreateItemModal: React.FC<{ onSubmit: (data: any) => void }> = ({ onSubmit }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    onSubmit({ name, description });
    setIsOpen(false);
    setName('');
    setDescription('');
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Create Item</Button>
      <Modal
        title="Create New Item"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        variant="medium"
      >
        <ModalHeader title="Create New Item" />
        <ModalBody>
          <FormGroup label="Name" isRequired>
            <TextInput
              value={name}
              onChange={(_, value) => setName(value)}
              aria-label="Item name"
            />
          </FormGroup>
          <FormGroup label="Description">
            <TextInput
              value={description}
              onChange={(_, value) => setDescription(value)}
              aria-label="Item description"
            />
          </FormGroup>
        </ModalBody>
        <footer className="pf-v6-c-modal-box__footer">
          <Button variant="primary" onClick={handleSubmit}>
            Submit
          </Button>
          <Button variant="link" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
        </footer>
      </Modal>
    </>
  );
};

describe('CreateItemModal', () => {
  it('should open modal when Create button clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateItemModal onSubmit={onSubmit} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create item/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should close modal when Cancel clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateItemModal onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /create item/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with entered data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateItemModal onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /create item/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/item name/i), 'Test Item');
    await user.type(screen.getByLabelText(/item description/i), 'Test Description');

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Test Item',
        description: 'Test Description'
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should have proper ARIA attributes', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateItemModal onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /create item/i }));

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(
        dialog.getAttribute('aria-labelledby') ||
        dialog.getAttribute('aria-label')
      ).toBeTruthy();
    });
  });

  it('should make all modal content accessible', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateItemModal onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /create item/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/item name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/item description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
```

---

## References

### Documentation

- [PatternFly 6 Modal Component](https://www.patternfly.org/components/modal)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about/)
- [userEvent API](https://testing-library.com/docs/user-event/intro/)

### Related Files

- Research test: `frontend/src/test/research/modal-investigation.test.tsx`
- Research findings: `docs/development/pf6-testing-research.md`
- Test utilities: `frontend/src/test/test-utils.tsx`

### Additional Resources

- [WCAG 2.1 Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [PatternFly 6 Accessibility](https://www.patternfly.org/accessibility/accessibility-fundamentals)

---

**Last Updated**: 2025-10-09
**Next Review**: After ApiKeysPage modal tests migration

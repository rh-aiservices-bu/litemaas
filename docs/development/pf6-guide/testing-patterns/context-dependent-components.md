# Testing PatternFly 6 Context-Dependent Components

> **Status**: Active Guide
> **Last Updated**: 2025-10-09
> **Related**: [Modal Testing](./modals.md), [Dropdown Testing](./dropdowns-pagination.md)

## Overview

This guide covers testing PatternFly 6 components that require parent component context to function correctly. Based on systematic investigation, **most context-dependent components CAN be tested in JSDOM** when using the correct parent component props.

### Key Discovery

❌ **Common Mistake**: Using context-dependent components outside their required parent
✅ **Correct Pattern**: Always render context-dependent components with the correct parent prop

## PatternFly 6 Context Patterns

### What Are Context-Dependent Components?

Context-dependent components rely on React Context provided by their parent component to access shared state or configuration.

**Common Examples**:

- `AlertActionCloseButton` - Requires `Alert` parent
- `ModalBoxCloseButton` - Requires `Modal` parent
- `WizardFooter` - Requires `Wizard` parent
- Menu items in complex components

### How PatternFly 6 Uses Context

```typescript
// Inside AlertActionCloseButton component:
const { title, variantLabel } = useContext(AlertContext);
// ↑ Expects Alert parent to provide this context
```

If the component is rendered outside its parent, context is `null` and you get:

```
TypeError: Cannot destructure property 'title' of 'object null' as it is null
```

## Testing AlertActionCloseButton

### The Problem (Original Error)

```typescript
// ❌ WRONG - Using actionLinks prop
<Alert
  variant="danger"
  title="Error"
  actionLinks={
    <AlertActionCloseButton onClose={handleClose} />  // ERROR!
  }
>
  Content
</Alert>

// Error: Cannot destructure property 'title' of 'object null'
```

**Why it fails**: `actionLinks` prop doesn't provide the Alert context that `AlertActionCloseButton` needs.

### The Solution

```typescript
// ✅ CORRECT - Using actionClose prop
<Alert
  variant="danger"
  title="Error"
  actionClose={
    <AlertActionCloseButton title="Close" onClose={handleClose} />
  }
>
  Content
</Alert>
```

**Why it works**: `actionClose` prop properly provides the Alert context.

### Complete Test Example

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';

describe('Alert with Close Button', () => {
  it('should render close button', () => {
    const mockOnClose = vi.fn();

    render(
      <Alert
        variant="danger"
        title="Test Error"
        actionClose={<AlertActionCloseButton title="Close" onClose={mockOnClose} />}
      >
        <p>Error message</p>
      </Alert>
    );

    // ✅ Close button renders and is queryable
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveAttribute('title', 'Close');
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();

    render(
      <Alert
        variant="danger"
        title="Test Error"
        actionClose={<AlertActionCloseButton title="Close" onClose={mockOnClose} />}
      >
        <p>Error message</p>
      </Alert>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should support keyboard activation', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();

    render(
      <Alert
        variant="danger"
        title="Test Error"
        actionClose={<AlertActionCloseButton title="Close" onClose={mockOnClose} />}
      >
        <p>Error message</p>
      </Alert>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });

    // Focus and press Enter
    closeButton.focus();
    await user.keyboard('{Enter}');
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Press Space
    await user.keyboard(' ');
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
```

### Testing in Parent Components

For components like `ErrorAlert` that wrap Alert:

```typescript
describe('ErrorAlert Component', () => {
  it('should render with close button when closable is true', () => {
    const mockOnClose = vi.fn();
    const error = {
      message: 'Something went wrong',
      code: 'TEST_ERROR',
    };

    render(
      <ErrorAlert
        error={error}
        closable={true}
        onClose={mockOnClose}
      />
    );

    // Close button should be present
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('should not render close button when closable is false', () => {
    const error = {
      message: 'Something went wrong',
      code: 'TEST_ERROR',
    };

    render(
      <ErrorAlert
        error={error}
        closable={false}
      />
    );

    // No close button should be present
    const closeButton = screen.queryByRole('button', { name: /close/i });
    expect(closeButton).not.toBeInTheDocument();
  });

  it('should handle close action in parent component', async () => {
    const user = userEvent.setup();

    // Test with stateful parent
    const TestParent = () => {
      const [visible, setVisible] = React.useState(true);

      if (!visible) return <div>Alert closed</div>;

      return (
        <ErrorAlert
          error={{ message: 'Test error', code: 'TEST' }}
          closable={true}
          onClose={() => setVisible(false)}
        />
      );
    };

    render(<TestParent />);

    // Verify alert is visible
    expect(screen.getByText('Test error')).toBeInTheDocument();

    // Click close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    // Verify alert is hidden
    await waitFor(() => {
      expect(screen.queryByText('Test error')).not.toBeInTheDocument();
      expect(screen.getByText('Alert closed')).toBeInTheDocument();
    });
  });
});
```

## Common Context-Dependent Components

### 1. AlertActionCloseButton

**Parent**: `Alert` component
**Required Prop**: `actionClose` (NOT `actionLinks`)
**Context Needed**: `{ title, variantLabel }`

```typescript
// ✅ CORRECT
<Alert
  variant="danger"
  title="Error"
  actionClose={<AlertActionCloseButton title="Close" onClose={handleClose} />}
/>

// ❌ WRONG
<Alert
  variant="danger"
  title="Error"
  actionLinks={<AlertActionCloseButton onClose={handleClose} />}
/>
```

### 2. ModalBoxCloseButton

**Parent**: `Modal` component
**Required Prop**: Part of modal header
**Context Needed**: Modal close functionality

```typescript
// ✅ CORRECT - Documented in modal testing guide
<Modal
  variant={ModalVariant.small}
  title="Confirm Action"
  isOpen={isOpen}
  onClose={handleClose}
  // ModalBoxCloseButton rendered automatically in header
>
  <ModalBoxBody>Content</ModalBoxBody>
</Modal>
```

**Note**: See [Modal Testing Guide](./modals.md) for complete modal testing patterns.

### 3. Custom Context-Dependent Components

If you create custom components using React Context:

```typescript
// Custom context component
const MyContext = React.createContext(null);

const MyContextConsumer = () => {
  const value = useContext(MyContext);
  if (!value) throw new Error('Must be used within MyContext.Provider');
  return <div>{value.data}</div>;
};

// Testing pattern
describe('MyContextConsumer', () => {
  it('should render with context', () => {
    render(
      <MyContext.Provider value={{ data: 'Test Data' }}>
        <MyContextConsumer />
      </MyContext.Provider>
    );

    expect(screen.getByText('Test Data')).toBeInTheDocument();
  });

  it('should throw error without context', () => {
    // Test error boundary behavior
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<MyContextConsumer />);
    }).toThrow('Must be used within MyContext.Provider');

    consoleError.mockRestore();
  });
});
```

## Fixing Context Errors in Existing Code

### Diagnosis Steps

1. **Identify the Error**:

   ```
   TypeError: Cannot destructure property 'X' of 'object null' as it is null
   ```

2. **Check Component Source**:
   - Look for `useContext()` calls
   - Identify which context is needed
   - Find the providing parent component

3. **Verify Parent Component Usage**:
   - Check which prop accepts the child component
   - Ensure correct prop is used (e.g., `actionClose` vs `actionLinks`)

### Example Fix: ErrorAlert Component

**Before (Broken)**:

```typescript
// ErrorAlert.tsx - BROKEN
export const ErrorAlert = ({ error, closable, onClose }) => {
  const actionButtons = [];

  if (closable && onClose) {
    actionButtons.push(
      <AlertActionCloseButton key="close" title="Close" onClose={onClose} />
    );
  }

  return (
    <Alert
      variant="danger"
      title={error.message}
      actionLinks={  // ❌ WRONG PROP
        actionButtons.length > 0 ? (
          <Flex>
            {actionButtons.map((button, index) => (
              <FlexItem key={index}>{button}</FlexItem>
            ))}
          </Flex>
        ) : undefined
      }
    >
      {/* content */}
    </Alert>
  );
};
```

**After (Fixed)**:

```typescript
// ErrorAlert.tsx - FIXED
export const ErrorAlert = ({ error, closable, onClose }) => {
  return (
    <Alert
      variant="danger"
      title={error.message}
      actionClose={  // ✅ CORRECT PROP
        closable && onClose ? (
          <AlertActionCloseButton title="Close" onClose={onClose} />
        ) : undefined
      }
    >
      {/* content */}
    </Alert>
  );
};
```

**Test Update**:

```typescript
// ErrorAlert.test.tsx - Now passing!
it('should show close button when closable is true', () => {
  const mockOnClose = vi.fn();

  render(
    <ErrorAlert
      error={{ message: 'Test', code: 'TEST' }}
      closable={true}
      onClose={mockOnClose}
    />
  );

  // ✅ This now works!
  const closeButton = screen.getByRole('button', { name: /close/i });
  expect(closeButton).toBeInTheDocument();
});
```

## Alternative Testing Strategies

### 1. Integration Testing

When context setup is complex, test through the parent component:

```typescript
// Instead of testing AlertActionCloseButton directly,
// test through ErrorAlert component
describe('ErrorAlert with close functionality', () => {
  it('should handle close action', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();

    render(
      <ErrorAlert
        error={{ message: 'Test error' }}
        closable={true}
        onClose={mockOnClose}
      />
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
```

### 2. Test Context Provider Directly

For custom contexts, you can test the provider:

```typescript
describe('MyContextProvider', () => {
  it('should provide context values to children', () => {
    const TestConsumer = () => {
      const { value } = useMyContext();
      return <div>{value}</div>;
    };

    render(
      <MyContextProvider initialValue="test">
        <TestConsumer />
      </MyContextProvider>
    );

    expect(screen.getByText('test')).toBeInTheDocument();
  });
});
```

### 3. Mock Context (Last Resort)

Only when parent component is unavailable or too complex:

```typescript
// ⚠️ Use sparingly - prefer testing with real parent
vi.mock('../contexts/MyContext', () => ({
  useMyContext: () => ({ value: 'mocked' }),
  MyContext: {
    Provider: ({ children }) => children,
  },
}));
```

## Common Issues and Solutions

### Issue: Context destructuring error

**Error**: `Cannot destructure property 'X' of 'object null'`

**Cause**: Component used outside its required parent

**Solution**: Render with correct parent component and prop

```typescript
// ❌ WRONG
<AlertActionCloseButton onClose={handleClose} />

// ✅ CORRECT
<Alert actionClose={<AlertActionCloseButton title="Close" onClose={handleClose} />} />
```

### Issue: Multiple close buttons in test

**Cause**: Parent and child both may render close buttons

**Solution**: Scope query to specific component

```typescript
// If testing a modal with an alert inside it
const alert = screen.getByRole('alert'); // or other container
const alertCloseButton = within(alert).getByRole('button', { name: /close/i });
```

### Issue: Close button has unexpected aria-label

**PatternFly auto-generates aria-labels** like:

```
"Close Danger alert: alert: Test Error"
```

**Solution**: Use flexible matching

```typescript
// ✅ FLEXIBLE
const closeButton = screen.getByRole('button', { name: /close/i });

// ❌ TOO SPECIFIC
const closeButton = screen.getByRole('button', { name: 'Close' });
```

## Best Practices

### 1. Always Render with Parent Component

```typescript
// ✅ GOOD
render(
  <Alert actionClose={<AlertActionCloseButton ... />}>
    Content
  </Alert>
);

// ❌ BAD
render(<AlertActionCloseButton ... />);
```

### 2. Test Through Public API

```typescript
// ✅ GOOD - Test the component users interact with
describe('ErrorAlert', () => {
  it('should close when close button clicked', async () => {
    // Test ErrorAlert, not AlertActionCloseButton directly
  });
});

// ❌ BAD - Testing implementation details
describe('AlertActionCloseButton', () => {
  it('should access alert context', () => {
    // This is testing PatternFly internals
  });
});
```

### 3. Document Context Requirements

```typescript
/**
 * ErrorAlert Component
 *
 * @param closable - When true, renders close button via Alert's actionClose prop
 * @note Uses AlertActionCloseButton which requires Alert parent context
 */
export const ErrorAlert = ({ closable, onClose, ... }) => {
  // ...
};
```

### 4. Verify Correct Prop Usage

When using PatternFly components, consult documentation for correct props:

| Component                | Parent           | Correct Prop  | Wrong Prop    |
| ------------------------ | ---------------- | ------------- | ------------- |
| AlertActionCloseButton   | Alert            | `actionClose` | `actionLinks` |
| ModalBoxCloseButton      | Modal            | Auto-rendered | N/A           |
| Custom context consumers | Context.Provider | N/A           | N/A           |

## Decision Framework

### When to Fix vs Skip

**Fix the test** if:

- ✅ Component should work with correct parent prop
- ✅ Error is due to wrong prop usage
- ✅ Context is part of public API
- ✅ Fix takes < 1 hour

**Document as permanent skip** if:

- ❌ Testing internal PatternFly context implementation
- ❌ Context setup requires excessive mocking
- ❌ Functionality verified through integration tests
- ❌ Fix requires significant PatternFly version changes

**Migrate to E2E** if:

- ⚠️ Context behavior differs between JSDOM and browser
- ⚠️ Complex user interactions span multiple contexts
- ⚠️ Visual validation needed (focus management, etc.)

## Troubleshooting Guide

| Symptom                                            | Likely Cause                   | Solution                                                          |
| -------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `Cannot destructure property 'X' of 'object null'` | Missing parent context         | Use correct parent component prop                                 |
| Close button not found                             | Wrong prop used                | Check parent component API (e.g., `actionClose` vs `actionLinks`) |
| Multiple elements match close button query         | Multiple close buttons in tree | Use `within()` to scope query                                     |
| Unexpected aria-label                              | PatternFly auto-generation     | Use flexible regex matching                                       |

## Related Patterns

- **[Modal Testing](./modals.md)**: ModalBoxCloseButton context
- **[Dropdown Testing](./dropdowns-pagination.md)**: Menu component context
- **[Error Handling](../../error-handling.md)**: ErrorAlert implementation

## Summary

### ✅ What Works in JSDOM

- AlertActionCloseButton (with `actionClose` prop)
- ModalBoxCloseButton (auto-rendered in Modal)
- Custom React Context providers and consumers
- Keyboard interactions with context-dependent buttons

### 📋 Key Patterns to Remember

1. Always use correct parent component prop
2. For Alert close button, use `actionClose` (not `actionLinks`)
3. Test through parent component, not context consumer alone
4. Use flexible aria-label matching (PatternFly auto-generates labels)
5. Document context requirements in component docs

### 🚀 Quick Reference

```typescript
// Correct Alert close button pattern
<Alert
  variant="danger"
  title="Error"
  actionClose={<AlertActionCloseButton title="Close" onClose={handleClose} />}
>
  Content
</Alert>

// Finding close button in tests
const closeButton = screen.getByRole('button', { name: /close/i });
```

---

**Last Updated**: 2025-10-09
**Tested With**: @patternfly/react-core v6, Vitest, React Testing Library
**Status**: Production Ready ✅

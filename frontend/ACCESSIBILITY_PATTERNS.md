# Accessibility Patterns for LiteMaaS Frontend

This document outlines the standardized accessibility patterns implemented across the LiteMaaS frontend to ensure WCAG 2.1 AA compliance and provide an excellent user experience for all users, including those using assistive technologies.

## Button and Link Accessibility

### 1. Contextual Button Labels

All buttons should have descriptive, contextual labels that clearly indicate what action will be performed and on which data:

#### Good Examples:

- ❌ "View" → ✅ "View details for GPT-4 subscription"
- ❌ "Delete" → ✅ "Delete API key Production-Key"
- ❌ "Subscribe" → ✅ "Subscribe to GPT-4 model"
- ❌ "Export" → ✅ "Export usage data for the selected time period"

#### Implementation Pattern:

```tsx
// Use aria-label for contextual descriptions
<Button
  variant="primary"
  onClick={handleAction}
  aria-label={t('pages.section.actionWithContext', { itemName: item.name })}
>
  {t('pages.section.action')}
</Button>
```

### 2. Card Navigation Actions

Cards that navigate to other pages should have descriptive aria-labels:

```tsx
<Card isCompact isClickable>
  <CardHeader
    selectableActions={{
      to: '/models',
      selectableActionAriaLabel: t('pages.home.cards.modelsAriaLabel'),
    }}
  />
  <CardBody>{/* Card content */}</CardBody>
</Card>
```

### 3. Icon-Only Buttons

All icon-only buttons must have appropriate aria-labels:

```tsx
<Button
  variant="plain"
  size="sm"
  onClick={toggleVisibility}
  icon={isVisible ? <EyeSlashIcon /> : <EyeIcon />}
  aria-label={t('pages.section.toggleVisibility', { itemName: item.name })}
  aria-expanded={isVisible}
/>
```

## Translation Key Patterns

### Contextual Aria Labels

```json
{
  "pages": {
    "section": {
      "action": "Action",
      "actionWithContext": "Action for {{itemName}}",
      "actionAriaLabel": "Descriptive action that provides full context"
    }
  }
}
```

### Navigation Labels for Cards

```json
{
  "pages": {
    "home": {
      "cards": {
        "sectionAriaLabel": "Navigate to Section page to perform specific actions"
      }
    }
  }
}
```

## Modal Accessibility

### Focus Management

- Set initial focus to the primary action button or first form element
- Implement focus trap within modal
- Restore focus to trigger element on close
- Use `ref` for consistent focus management

### Example Implementation:

```tsx
useEffect(() => {
  if (isModalOpen) {
    setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 100);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        // Focus trap implementation
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }
}, [isModalOpen]);
```

## Table Accessibility

### Table Headers and Captions

- Use descriptive captions for screen readers
- Provide table structure information
- Include row/column counts

```tsx
<Table aria-label={t('pages.section.tableLabel')} variant="compact">
  <caption className="pf-v6-screen-reader">
    {t('pages.section.tableCaption', {
      count: items.length,
      description: t('pages.section.tableStructure'),
    })}
  </caption>
  <Thead>
    <Tr>
      <Th scope="col">{t('column.header')}</Th>
    </Tr>
  </Thead>
</Table>
```

## Empty State Accessibility

### Screen Reader Support

- Provide appropriate roles (alert, region)
- Include hidden text for screen readers
- Use aria-labelledby and aria-describedby

```tsx
<EmptyState
  variant={EmptyStateVariant.lg}
  role="region"
  aria-labelledby="empty-title"
  aria-describedby="empty-description"
>
  <Title headingLevel="h2" size="lg" id="empty-title">
    {t('pages.section.emptyTitle')}
  </Title>
  <EmptyStateBody id="empty-description">
    {t('pages.section.emptyDescription')}
    <div className="pf-v6-screen-reader" aria-live="polite">
      {t('pages.section.emptyScreenReader')}
    </div>
  </EmptyStateBody>
</EmptyState>
```

## Loading State Accessibility

### Screen Reader Announcements

- Use ScreenReaderAnnouncement component
- Provide loading context
- Set appropriate aria-busy states

```tsx
<ScreenReaderAnnouncement
  message={t('pages.section.loadingDescription')}
  priority="polite"
  announcementKey={loading ? 1 : 0}
/>

<Spinner size="xl" aria-busy="true" />
```

## Form Accessibility

### Required Fields

- Mark required fields appropriately
- Provide validation error messages
- Use aria-invalid and aria-describedby

```tsx
<FormGroup
  label={t('form.label')}
  isRequired
  fieldId="form-field"
  helperTextInvalid={errors.field}
  validated={errors.field ? 'error' : 'default'}
>
  <TextInput
    isRequired
    id="form-field"
    aria-required="true"
    aria-invalid={errors.field ? 'true' : 'false'}
    aria-describedby={errors.field ? 'field-error' : undefined}
    validated={errors.field ? 'error' : 'default'}
  />
</FormGroup>
```

## Error Handling Accessibility

### Error Announcements

- Use assertive priority for errors
- Provide recovery instructions
- Include context about what failed

```tsx
// In error handlers
announce(t('pages.section.errorMessage'), 'assertive');

addNotification({
  title: t('error.title'),
  description: t('error.description'),
  variant: 'danger',
});
```

## Testing Guidelines

### Manual Testing Checklist

- [ ] All buttons have meaningful labels
- [ ] Tab navigation flows logically
- [ ] Screen reader announces content correctly
- [ ] Focus is properly managed in modals
- [ ] Color is not the only means of conveying information
- [ ] All interactive elements are keyboard accessible

### Automated Testing

- Use axe-core for accessibility testing
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Verify color contrast ratios
- Test with keyboard-only navigation

## PatternFly 6 Specific Considerations

- Always use `pf-v6-` prefix for custom CSS classes
- Leverage PatternFly's built-in accessibility features
- Follow PatternFly's component documentation for ARIA patterns
- Use PatternFly's screen reader utilities (`pf-v6-screen-reader`)

## Implementation Status

### ✅ Completed

- [x] HomePage card navigation aria-labels
- [x] ModelsPage subscribe button context
- [x] SubscriptionsPage view/cancel button context
- [x] ApiKeysPage already has excellent accessibility
- [x] UsagePage export button context

### 🔄 In Progress

- [ ] Complete translation keys for all languages
- [ ] Audit remaining components for accessibility gaps
- [ ] Add automated accessibility testing

### 📋 Future Improvements

- [ ] Implement skip links for main navigation
- [ ] Add keyboard shortcuts documentation
- [ ] Enhance error message specificity
- [ ] Implement focus indicators customization

---

This document should be updated as new accessibility patterns are implemented or existing ones are refined.

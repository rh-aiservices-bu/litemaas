# PatternFly 6 Clickable Cards Pattern

## Important Pattern for Clickable Cards

In PatternFly 6, clickable cards should use the `CardHeader` component with `selectableActions` prop instead of using `onClick` directly on the Card component.

### Why?

- The `isClickable` prop on Card adds the `pf-m-clickable` modifier class which sets `border-width: 0` on the card's `::before` pseudo-element
- Using `CardHeader` with `selectableActions` properly handles the clickable behavior while maintaining the card's border styling

### Pattern for Navigation

```tsx
<Card isCompact isClickable>
  <CardHeader
    selectableActions={{
      to: '/destination-route',
      selectableActionAriaLabelledby: 'unique-label-id',
    }}
  />
  <CardBody>{/* Card content */}</CardBody>
</Card>
```

### Pattern for Custom Actions (e.g., opening modals)

```tsx
<Card isClickable>
  <CardHeader
    selectableActions={{
      onClickAction: () => handleAction(),
      selectableActionAriaLabelledby: 'unique-label-id',
    }}
  >
    <CardTitle id="unique-label-id">{/* Title content */}</CardTitle>
  </CardHeader>
  <CardBody>{/* Card content */}</CardBody>
</Card>
```

### Key Points

1. Always use `CardHeader` with `selectableActions` for clickable cards
2. Use `to` property for navigation (CardTitle stays outside CardHeader)
3. Use `onClickAction` for custom actions (CardTitle goes inside CardHeader with matching id)
4. Always provide `selectableActionAriaLabelledby` for accessibility
5. Use `isClickable` prop on Card (not `isSelectable`)
6. Don't add custom border styles - PatternFly handles this correctly

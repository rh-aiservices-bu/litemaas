# Layout Components

This section covers PatternFly layout components and page structure patterns for building consistent application layouts.

> **Note:** For up-to-date code examples, this documentation now links directly to the official PatternFly documentation and the PatternFly React GitHub repository. Inline code has been replaced with links to ensure you always see the latest patterns and best practices. **All layout examples should use PatternFly React layout components (e.g., Grid, GridItem, Flex, FlexItem) instead of divs with utility classes.**

## Introduction

PatternFly layout components provide the foundation for structuring application pages and organizing content. These components ensure consistent spacing, responsive behavior, and proper semantic structure across your application.

## Reference Documentation

- [PatternFly Layouts on PatternFly.org](https://www.patternfly.org/layouts)
- [PatternFly React GitHub Repository](https://github.com/patternfly/patternfly-react)

> For the most up-to-date documentation and code examples, consult both PatternFly.org and the official GitHub repository. When using AI tools for PatternFly 6, use the local documentation and PatternFly.org. Note: Context7 may have outdated PatternFly versions - use it for other libraries but NOT for PatternFly 6.

## Related Files

- [**Component Architecture**](../../guidelines/component-architecture.md) - Component structure patterns
- [**Styling Standards**](../../guidelines/styling-standards.md) - Layout styling guidelines

## Core Layout Components

### PageSection Component

The [`PageSection`](https://www.patternfly.org/components/page/page-section) component is the primary building block for page content structure. It is highly versatile and supports multiple variants, padding options, and responsive configurations.

For detailed examples of all its features, refer to the official documentation.

- [**PageSection Official Docs**](https://www.patternfly.org/components/page/page-section)
- [**PageSection Code Examples on GitHub**](https://github.com/patternfly/patternfly-react/tree/main/packages/react-core/src/components/PageSection/examples)

## Common Layout Patterns

This section describes common page layout patterns and links to their official documentation and examples.

### Standard Page Layout

A standard page layout typically consists of a page title, an optional toolbar for actions, and a main content area.

- [**Page Layout Documentation**](https://www.patternfly.org/layouts/page)
- [**Page Component Examples on GitHub**](https://github.com/patternfly/patternfly-react/tree/main/packages/react-core/src/components/Page/examples)

### Dashboard Layout

A dashboard is used to display a high-level overview of system status and key metrics using a grid of cards and charts.

- [**Dashboard Layout Documentation**](https://www.patternfly.org/layouts/dashboard)
- [**Grid Layout Examples on GitHub**](https://github.com/patternfly/patternfly-react/tree/main/packages/react-core/src/layouts/Grid/examples)

### Form Layout

Forms should be presented clearly within a card or a dedicated page section, often in a two-column layout on larger screens to separate the form from supplementary help text.

- [**Form Component Documentation**](https://www.patternfly.org/components/form)
- [**Form Code Examples on GitHub**](https://github.com/patternfly/patternfly-react/tree/main/packages/react-core/src/components/Form/examples)

## Grid System Integration

The PatternFly `Grid` and `GridItem` components are used to create flexible, responsive layouts. For detailed examples of basic and responsive grid patterns, refer to the official documentation.

- [**Grid Layout Documentation**](https://www.patternfly.org/layouts/grid)
- [**Grid Code Examples on GitHub**](https://github.com/patternfly/patternfly-react/tree/main/packages/react-core/src/layouts/Grid/examples)

## Responsive Design Considerations

Use the `Flex` and `FlexItem` components along with breakpoint modifiers to create layouts that adapt to different screen sizes. A mobile-first approach is recommended, where the default layout is for mobile and is enhanced for larger screens.

- [**Flex Layout Documentation**](https://www.patternfly.org/layouts/flex)
- [**Flex Code Examples on GitHub**](https://github.com/patternfly/patternfly-react/tree/main/packages/react-core/src/layouts/Flex/examples)
- [**Responsive Utilities Documentation**](https://www.patternfly.org/utilities/responsive)

## Accessibility Considerations

### Semantic Structure

Always use the correct heading hierarchy (`<h1>`, `<h2>`, `<h3>`, etc.) to structure your page content logically. Use the `component` prop on PatternFly components to render the correct HTML element.

### Skip to Content and Back to Top

For accessible and user-friendly navigation on long pages, PatternFly provides the `SkipToContent` and `BackToTop` components, which are integrated directly into the `Page` component.

- **`SkipToContent`**: Allows keyboard users to bypass navigation and jump directly to the main content area.
- **`BackToTop`**: Allows all users to quickly return to the top of the page after scrolling.

**Best Practices**:

- ✅ Use `SkipToContent` on every page with navigation, linking its `href` to the main content `id`.
- ✅ Use `BackToTop` on any page that requires significant scrolling, linking `scrollableSelector` to the main content `id`.
- ✅ Assign the `mainContainerId` on the `Page` component to ensure both helpers work correctly.

```jsx
// ✅ Correct: Use SkipToContent and BackToTop together
import { Page, PageSection, SkipToContent, BackToTop } from '@patternfly/react-core';

const AppLayout = () => {
  const mainContentId = 'main-content';

  return (
    <Page
      mainContainerId={mainContentId}
      skipToContent={<SkipToContent href={`#${mainContentId}`}>Skip to content</SkipToContent>}
      backToTop={<BackToTop scrollableSelector={`#${mainContentId}`} />}
    >
      <PageSection>{/* ... long content that requires scrolling ... */}</PageSection>
    </Page>
  );
};
```

**Reference Documentation**:

- [SkipToContent Component Docs](https://www.patternfly.org/components/skip-to-content)
- [BackToTop Component Docs](https://www.patternfly.org/components/back-to-top)

### ARIA Landmarks

Use ARIA landmarks to define regions of a page like `main`, `aside`, `nav`, etc. This can be done by passing the `component` prop to `PageSection`.

- [**ARIA Landmarks in PatternFly**](https://www.patternfly.org/accessibility/aria-landmarks)

## Performance Optimization

### Lazy Loading and Conditional Rendering

For performance-critical applications, use standard React patterns like lazy loading and conditional rendering to defer loading of non-critical components or sections of the page.

- [**React Docs: Code-Splitting and Lazy Loading**](https://react.dev/reference/react/lazy)
- [**React Docs: Conditional Rendering**](https://react.dev/learn/conditional-rendering)

## Best Practices

- ✅ Use PageSection for all major page areas
- ✅ Follow consistent page structure patterns
- ✅ Implement responsive design from mobile-first
- ✅ Use proper semantic HTML structure
- ✅ Maintain consistent spacing with PatternFly utilities
- ✅ Test layouts across different screen sizes
- ✅ Use hasBodyWrapper for standard content padding

- ❌ Skip PageSection for page structure
- ❌ Mix layout systems inconsistently
- ❌ Ignore responsive design requirements
- ❌ Use custom CSS when PatternFly layout classes exist
- ❌ Create overly complex nested layouts
- ❌ Forget accessibility considerations
- ❌ Hardcode spacing values instead of using utilities

## Common Layout Issues

For troubleshooting, see [Common Issues](../../troubleshooting/common-issues.md#layout-issues).

## Valid PatternFly Page Layout (v6+)

A valid PatternFly v6+ application layout is built by composing the `Page`, `Masthead`, `PageSidebar`, and `PageSection` components. The `Page` component acts as the root, and other major elements like the masthead and sidebar are passed in as props.

For a complete, working example of a full application layout, refer to the official PatternFly documentation.

- [**Page Component Documentation & Examples**](https://www.patternfly.org/components/page)
- [**Page Component Code Examples on GitHub**](https://github.com/patternfly/patternfly-react/tree/main/packages/react-core/src/components/Page/examples)

### Layout Summary Table

| Layout Element | PatternFly Component(s)                           | Notes                                         |
| -------------- | ------------------------------------------------- | --------------------------------------------- |
| Root           | `Page`                                            | Use `masthead`, `sidebar`, `breadcrumb` props |
| Masthead       | `Masthead`, `MastheadMain`, `MastheadBrand`, etc. | Compose for logo, toggles, user menu          |
| Sidebar        | `PageSidebar`, `PageSidebarBody`, `Nav`           | Use for navigation                            |
| Main Content   | `PageSection`, `Title`, `Content`                 | Use for each page/view                        |
| Breadcrumbs    | `Breadcrumb`                                      | Pass as `breadcrumb` prop to `Page`           |
| Page Header    | _No `PageHeader`_                                 | Use `PageSection` + `Title` instead           |

> **Note:** `PageHeader` is not a PatternFly component in v6+. Use `PageSection`, `Title`, and layout components instead.

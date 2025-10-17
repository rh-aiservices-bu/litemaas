# Charts Rules

Essential rules for PatternFly Charts implementation using Victory.js and ECharts.

## Related Files

- [**Component Architecture**](../guidelines/component-architecture.md) - Chart component structure rules
- [**Common Issues**](../troubleshooting/common-issues.md) - Troubleshooting guide including performance

## Installation Rules

### Required Installation

```bash
# ✅ Victory-based charts (recommended)
npm install @patternfly/react-charts victory

# ✅ ECharts-based charts (alternative)
npm install @patternfly/react-charts echarts
```

### Import Rules

- ✅ **Use specific import paths** - Import from `/victory` or `/echarts` subdirectories
- ❌ **Don't use general imports** - Avoid importing from main package

```jsx
// ✅ Correct imports
import { ChartDonut, ChartLine, ChartBar } from '@patternfly/react-charts/victory';
import { EChart } from '@patternfly/react-charts/echarts';

// ❌ Wrong imports
import { ChartDonut } from '@patternfly/react-charts';
```

### Troubleshooting Import Issues

If "module not found" errors occur:

1. **Clear cache**: `rm -rf node_modules package-lock.json`
2. **Reinstall**: `npm install`
3. **Verify paths**: Check import paths match installed version

## Chart Implementation Rules

### Color Rules

- ✅ **Use PatternFly chart color tokens** - For consistency with design system
- ❌ **Don't use hardcoded colors** - Use design tokens instead

```jsx
// ✅ Correct - Use PatternFly color tokens
const chartColors = [
  'var(--pf-v6-chart-color-blue-300)',
  'var(--pf-v6-chart-color-green-300)',
  'var(--pf-v6-chart-color-orange-300)',
];

<ChartDonut data={data} colorScale={chartColors} />;
```

### Responsive Rules

- ✅ **Implement responsive sizing** - Charts must work on all screen sizes
- ✅ **Use container-based dimensions** - Not fixed width/height
- ❌ **Don't hardcode dimensions** - Charts must be responsive

```jsx
// ✅ Required responsive pattern
const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

useEffect(() => {
  const updateDimensions = () => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  };
  updateDimensions();
  window.addEventListener('resize', updateDimensions);
  return () => window.removeEventListener('resize', updateDimensions);
}, []);
```

### Accessibility Rules

- ✅ **Provide ARIA labels** - For screen reader support
- ✅ **Use high contrast colors** - Meet WCAG standards
- ✅ **Support keyboard navigation** - Add tabIndex and role

```jsx
// ✅ Required accessibility pattern
<ChartDonut
  data={data}
  ariaDesc="Chart showing user distribution"
  ariaTitle="User Status Chart"
  tabIndex={0}
  role="img"
/>
```

### State Management Rules

- ✅ **Handle loading states** - Show spinners during data loading
- ✅ **Handle error states** - Show error messages with retry
- ✅ **Handle empty states** - Show appropriate empty messages
- ✅ **Use data memoization** - For performance optimization

```jsx
// ✅ Required state handling
if (isLoading) return <Spinner />;
if (error)
  return (
    <EmptyState>
      <EmptyStateHeader titleText="Chart error" />
    </EmptyState>
  );
if (!data?.length)
  return (
    <EmptyState>
      <EmptyStateHeader titleText="No data" />
    </EmptyState>
  );

const processedData = useMemo(() => {
  return rawData.map((item) => ({ x: item.date, y: item.value }));
}, [rawData]);
```

### Integration Rules

- ✅ **Use with PatternFly components** - Integrate charts in Cards, PageSections
- ✅ **Follow grid layouts** - Use PatternFly grid for chart dashboards
- ❌ **Don't create standalone chart pages** - Integrate with PatternFly layout

```jsx
// ✅ Required integration pattern
import { Card, CardTitle, CardBody } from '@patternfly/react-core';

<Card>
  <CardTitle>Chart Title</CardTitle>
  <CardBody>
    <ChartDonut data={data} />
  </CardBody>
</Card>;
```

## Performance Rules

### Required Optimizations

- ✅ **Use lazy loading for heavy charts** - Improve initial page load
- ✅ **Memoize data processing** - Use useMemo for expensive calculations
- ✅ **Implement proper loading states** - Show feedback during data loading

```jsx
// ✅ Required performance patterns
const LazyChart = lazy(() => import('./HeavyChart'));

<Suspense fallback={<Spinner />}>
  <LazyChart />
</Suspense>;
```

## Essential Do's and Don'ts

### ✅ Do's

- Use PatternFly chart color tokens for consistency
- Implement responsive sizing for different screen sizes
- Provide proper ARIA labels and descriptions
- Handle loading, error, and empty states
- Use appropriate chart types for your data
- Optimize performance with data memoization
- Integrate charts with PatternFly layout components

### ❌ Don'ts

- Hardcode chart dimensions without responsive design
- Use colors that don't meet accessibility standards
- Skip loading states for charts with async data
- Ignore keyboard navigation and screen reader support
- Create overly complex charts
- Mix different charting libraries inconsistently
- Forget to handle empty data states

## Common Issues

### Module Not Found

- **Clear cache**: `rm -rf node_modules package-lock.json`
- **Reinstall**: `npm install`
- **Check paths**: Verify import paths are correct

### Chart Not Rendering

- **Check container dimensions**: Ensure parent has width/height
- **Verify data format**: Data must match chart expectations
- **Check console**: Look for Victory.js or ECharts warnings

### Performance Issues

- **Use data memoization**: useMemo for expensive calculations
- **Implement lazy loading**: For heavy chart components
- **Optimize re-renders**: Use React.memo for chart components

## Quick Reference

- **[PatternFly Charts README](https://github.com/patternfly/patternfly-react/tree/main/packages/react-charts#readme)** - Installation and usage
- **[Victory.js Documentation](https://formidable.com/open-source/victory/)** - Chart library documentation
- **[PatternFly Chart Guidelines](https://www.patternfly.org/charts/about)** - Design guidelines

## Reference Documentation

- [PatternFly Charts on PatternFly.org](https://www.patternfly.org/charts/about)
- [PatternFly React Charts GitHub Repository](https://github.com/patternfly/patternfly-react/tree/main/packages/react-charts)

> For the most up-to-date documentation and code examples, consult both PatternFly.org and the official GitHub repository. When using AI tools for PatternFly 6, use the local documentation and PatternFly.org. Note: Context7 may have outdated PatternFly versions - use it for other libraries but NOT for PatternFly 6.

# Common Issues - PatternFly 6 Frontend

This document covers frequently encountered problems and their solutions when developing with PatternFly 6 React components.

## Introduction

PatternFly 6 development with Vite can present various challenges ranging from setup issues to component-specific problems. This guide focuses on frontend-specific issues and their solutions.

## Related Files

- [**Component Issues**](./component-issues.md) - Component-specific troubleshooting
- [**Performance Optimization**](./performance.md) - Performance-related problems and solutions
- [**Setup Guide**](../setup/README.md) - Initial setup troubleshooting
- [**External References**](../resources/external-links.md) - Additional troubleshooting resources

## Setup Issues

### Node.js and npm Problems

#### Issue: Command not found errors

```bash
# Error messages
'node' is not recognized as an internal or external command
'npm' is not recognized as an internal or external command
```

**Solutions**:

1. **Verify Installation**:

   ```bash
   # Check if Node.js is installed
   node --version
   npm --version
   ```

2. **Reinstall Node.js**:
   - Download from [https://nodejs.org/](https://nodejs.org/)
   - Choose LTS version for stability
   - Restart terminal after installation

3. **PATH Configuration**:

   ```bash
   # Windows: Add to PATH environment variable
   C:\Program Files\nodejs\

   # macOS/Linux: Add to shell profile
   export PATH="/usr/local/bin/node:$PATH"
   ```

#### Issue: npm permission errors

```bash
# Error message
EACCES: permission denied, access '/usr/local/lib/node_modules'
```

**Solutions**:

1. **Use nvm (Recommended)**:

   ```bash
   # Install nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Install and use Node.js
   nvm install node
   nvm use node
   ```

2. **Fix npm permissions**:

   ```bash
   # Create global directory
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'

   # Add to PATH
   export PATH=~/.npm-global/bin:$PATH
   ```

### Project Setup Issues

#### Issue: Git clone failures

```bash
# Error message
fatal: repository 'https://github.com/patternfly/patternfly-react-seed' not found
```

**Solutions**:

1. **Check Network Connection**: Verify internet connectivity
2. **Use HTTPS instead of SSH**:
   ```bash
   git clone https://github.com/patternfly/patternfly-react-seed
   ```
3. **Check Repository URL**: Verify the repository exists and URL is correct

#### Issue: npm install failures

```bash
# Error messages
npm ERR! network request failed
npm ERR! peer dep missing
```

**Solutions**:

1. **Clear npm cache**:

   ```bash
   npm cache clean --force
   ```

2. **Delete node_modules and reinstall**:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check npm registry**:

   ```bash
   npm config get registry
   # Should return: https://registry.npmjs.org/
   ```

4. **Install with legacy peer deps**:
   ```bash
   npm install --legacy-peer-deps
   ```

### Development Server Issues

#### Issue: Port already in use

```bash
# Error message
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions**:

1. **Find and kill process**:

   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F

   # macOS/Linux
   lsof -ti:3000 | xargs kill -9
   ```

2. **Use different port**:
   ```typescript
   // vite.config.ts
   server: {
     port: 3001,
   }
   ```

#### Issue: Development server not starting

```bash
# Error message
Error: Cannot find module 'vite'
Error: Failed to resolve plugin
```

**Solutions**:

1. **Reinstall frontend dependencies**:

   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check Vite configuration**:

   ```typescript
   // Verify frontend/vite.config.ts exists
   ```

3. **Clear Vite cache**:
   ```bash
   rm -rf frontend/node_modules/.vite
   npm run dev:frontend
   ```

## Import and Module Issues

### PatternFly Component Import Errors

#### Issue: Module not found errors

```bash
# Error message
Module not found: Can't resolve '@patternfly/react-core'
```

**Solutions**:

1. **Install PatternFly packages**:

   ```bash
   npm install @patternfly/react-core @patternfly/react-table @patternfly/react-icons
   ```

2. **Check import syntax**:

   ```jsx
   // Correct imports
   import { Button, Card } from '@patternfly/react-core';
   import { Table, Thead, Tbody } from '@patternfly/react-table';
   import { UserIcon } from '@patternfly/react-icons';
   ```

3. **Verify package.json dependencies**:
   ```json
   {
     "dependencies": {
       "@patternfly/react-core": "^6.x.x",
       "@patternfly/react-table": "^6.x.x",
       "@patternfly/react-icons": "^6.x.x"
     }
   }
   ```

#### Issue: Charts module not found

```bash
# Error message
Module not found: Can't resolve '@patternfly/react-charts/victory'
```

**Solutions**:

1. **Install charts dependencies**:

   ```bash
   npm install @patternfly/react-charts victory
   ```

2. **Use correct import paths**:

   ```jsx
   // Correct chart imports
   import { ChartDonut, ChartLine } from '@patternfly/react-charts/victory';
   ```

3. **Clear cache and reinstall**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

#### Issue: Chatbot module not found

```bash
# Error message
Module not found: Can't resolve '@patternfly/chatbot/dist/dynamic/Chatbot'
```

**Solutions**:

1. **Install chatbot package**:

   ```bash
   npm install @patternfly/chatbot
   ```

2. **Import CSS**:

   ```jsx
   import '@patternfly/chatbot/dist/css/main.css';
   ```

3. **Use correct import paths**:
   ```jsx
   import { Chatbot } from '@patternfly/chatbot/dist/dynamic/Chatbot';
   ```

## Styling Issues

### CSS and Class Problems

#### Issue: PatternFly styles not applied

```bash
# Symptoms: Components appear unstyled or with default browser styles
```

**Solutions**:

1. **Import PatternFly CSS**:

   ```jsx
   // In your main App.js or index.js
   import '@patternfly/react-core/dist/styles/base.css';
   ```

2. **Check CSS import order**:

   ```jsx
   // PatternFly CSS should be imported before custom CSS
   import '@patternfly/react-core/dist/styles/base.css';
   import './custom-styles.css';
   ```

3. **Verify webpack CSS handling**:
   ```javascript
   // webpack.config.js
   module.exports = {
     module: {
       rules: [
         {
           test: /\.css$/,
           use: ['style-loader', 'css-loader'],
         },
       ],
     },
   };
   ```

#### Issue: Wrong PatternFly version classes

```jsx
// Problem: Using old class names
<div className="pf-c-button">  // v4 class
<div className="pf-v5-c-button">  // v5 class
```

**Solutions**:

1. **Use PatternFly v6 classes**:

   ```jsx
   // Correct v6 classes
   <div className="pf-v6-c-button">
   <div className="pf-v6-u-margin-md">
   ```

2. **Update class references**:

   ```bash
   # Find and replace old classes
   grep -r "pf-c-" src/
   grep -r "pf-v5-" src/
   ```

3. **Use PatternFly components instead**:
   ```jsx
   // Instead of manual classes, use components
   import { Button } from '@patternfly/react-core';
   <Button variant="primary">Click me</Button>;
   ```

### Layout and Responsive Issues

#### Issue: Components not responsive

```jsx
// Problem: Fixed widths and heights
<div style={{ width: '800px', height: '600px' }}>
```

**Solutions**:

1. **Use PatternFly responsive utilities**:

   ```jsx
   <div className="pf-v6-u-width-100 pf-v6-u-height-auto">
   ```

2. **Implement responsive patterns**:

   ```jsx
   <div className="pf-v6-l-grid pf-v6-m-gutter">
     <div className="pf-v6-l-grid__item pf-v6-m-12-col pf-v6-m-6-col-on-md">Content</div>
   </div>
   ```

3. **Use container-based sizing**:

   ```jsx
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

## PatternFly 6 Deprecated Components

### Completely Deprecated in v6

These components are no longer supported and require migration:

#### Old Select Component

```jsx
// ❌ Deprecated
import { Select, SelectOption } from '@patternfly/react-core/deprecated';

// ✅ Use new Select
import { Select, SelectOption } from '@patternfly/react-core';
```

#### Old Dropdown Component

```jsx
// ❌ Deprecated
import { Dropdown, DropdownToggle } from '@patternfly/react-core/deprecated';

// ✅ Use new Dropdown
import { Dropdown, DropdownList, DropdownItem } from '@patternfly/react-core';
```

#### Old Wizard Component

```jsx
// ❌ Deprecated
import { Wizard } from '@patternfly/react-core/deprecated';

// ✅ Use new Wizard
import { Wizard, WizardStep } from '@patternfly/react-core';
```

#### Old Table Component

```jsx
// ❌ Deprecated non-composable table

// ✅ Use composable table
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
```

### Component API Changes

#### Button isDisabled → disabled

```jsx
// ❌ Old
<Button isDisabled={true}>Click</Button>

// ✅ New
<Button disabled={true}>Click</Button>
```

#### Text → Content

```jsx
// ❌ Old
import { Text } from '@patternfly/react-core';
<Text component="h1">Title</Text>;

// ✅ New
import { Content } from '@patternfly/react-core';
<Content component="h1">Title</Content>;
```

#### PageHeader Removed

```jsx
// ❌ Old
<PageHeader title="My Page" />

// ✅ New - Use PageSection with Title
<PageSection>
  <Title headingLevel="h1">My Page</Title>
</PageSection>
```

## Component-Specific Issues

### Dropdown Clipping Issues

#### Issue: Dropdown menu gets clipped

```jsx
// Problem: Dropdown appears cut off in scrollable containers
```

**Solutions**:

1. **Use appendTo prop**:

   ```jsx
   <Dropdown
     popperProps={{
       appendTo: () => document.body,
       position: 'right',
       enableFlip: true
     }}
   >
   ```

2. **Configure positioning**:
   ```jsx
   <Dropdown
     popperProps={{
       position: 'right',
       enableFlip: true,
       preventOverflow: true
     }}
   >
   ```

### Table Performance Issues

#### Issue: Slow rendering with large datasets

```jsx
// Problem: Table becomes unresponsive with 1000+ rows
```

**Solutions**:

1. **Implement pagination**:

   ```jsx
   import { Pagination } from '@patternfly/react-core';

   const [page, setPage] = useState(1);
   const [perPage, setPerPage] = useState(20);
   const paginatedData = data.slice((page - 1) * perPage, page * perPage);
   ```

2. **Use virtualization**:

   ```jsx
   import { DndProvider, useDrag, useDrop } from 'react-dnd';
   import { HTML5Backend } from 'react-dnd-html5-backend';
   import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';

   const DraggableRow = ({ id, text, index, moveRow }) => {
   // ... existing code ...
   ```

3. **Optimize re-renders**:
   ```jsx
   const MemoizedRow = React.memo(({ item }) => (
     <Tr>
       <Td>{item.name}</Td>
       <Td>{item.email}</Td>
     </Tr>
   ));
   ```

## Vite-Specific Issues

### HMR (Hot Module Replacement) Not Working

#### Issue: Changes not reflecting in browser

```bash
# Symptoms: File saves don't trigger browser updates
```

**Solutions**:

1. **Clear Vite cache**:

   ```bash
   rm -rf frontend/node_modules/.vite
   ```

2. **Check Vite config**:

   ```typescript
   // vite.config.ts
   server: {
     hmr: {
       overlay: true;
     }
   }
   ```

3. **Use polling for WSL/Docker**:
   ```typescript
   server: {
     watch: {
       usePolling: true;
     }
   }
   ```

### API Integration Issues

#### Issue: API calls failing

```bash
# Error: 404 on /api/* routes or CORS errors
```

**Solutions**:

1. **Check proxy configuration**:

   ```typescript
   // vite.config.ts
   proxy: {
     '/api': {
       target: 'http://localhost:8081',
       changeOrigin: true,
     }
   }
   ```

2. **Use environment variables**:
   ```typescript
   // Use VITE_API_URL for API calls
   const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8081';
   ```

## Frontend Build Issues

### Build Failures

#### Issue: Vite build process fails

```bash
# Error message
Error: [vite]: Rollup failed to resolve import
```

**Solutions**:

1. **Check for TypeScript errors**:

   ```bash
   cd frontend && npx tsc --noEmit
   ```

2. **Verify all imports**:

   ```bash
   npm run lint
   ```

3. **Clear build output**:
   ```bash
   rm -rf frontend/dist
   npm run build:frontend
   ```

#### Issue: Bundle size too large

```bash
# Warning: Bundle size exceeds recommended limit
```

**Solutions**:

1. **Analyze Vite bundle**:

   ```bash
   # Build with analysis
   cd frontend && npx vite build --mode analyze

   # Or use rollup-plugin-visualizer
   npm install --save-dev rollup-plugin-visualizer
   ```

2. **Implement code splitting**:

   ```jsx
   // Vite handles dynamic imports automatically
   const LazyComponent = React.lazy(() => import('./HeavyComponent'));

   <Suspense fallback={<Spinner />}>
     <LazyComponent />
   </Suspense>;
   ```

3. **Optimize imports**:
   ```typescript
   // vite.config.ts
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'react-vendor': ['react', 'react-dom'],
           'patternfly-vendor': ['@patternfly/react-core']
         }
       }
     }
   }
   ```

## Browser Compatibility Issues

### Cross-Browser Problems

#### Issue: Components not working in specific browsers

```bash
# Symptoms: Features work in Chrome but not Safari/Firefox
```

**Solutions**:

1. **Check Vite browser targets**:

   ```typescript
   // vite.config.ts
   export default defineConfig({
     build: {
       target: 'es2015',
     },
   });
   ```

2. **Add polyfills if needed**:

   ```bash
   npm install @vitejs/plugin-legacy
   ```

   ```typescript
   // vite.config.ts
   import legacy from '@vitejs/plugin-legacy';

   plugins: [
     legacy({
       targets: ['defaults', 'not IE 11'],
     }),
   ];
   ```

3. **Test across browsers**:
   - Use browser dev tools
   - Test on actual devices
   - Use Playwright for automated testing

## Frontend-Specific Issues

### Module Resolution

#### Issue: PatternFly modules not found

```bash
# Error: Cannot find module '@patternfly/react-core'
```

**Solutions**:

1. **Install PatternFly packages**:

   ```bash
   cd frontend
   npm install @patternfly/react-core @patternfly/react-table @patternfly/react-icons
   ```

2. **Verify package versions**:

   ```bash
   npm list @patternfly/react-core
   ```

3. **Clean install if needed**:
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

## Debugging Strategies

### Frontend Debugging Approach

1. **Browser Console**: Check for React and PatternFly warnings
2. **React DevTools**: Inspect component props and state
3. **Network Tab**: Monitor API calls and asset loading
4. **TypeScript**: Run `npm run type-check` for type errors
5. **Documentation**: Reference this pf6-guide for best practices

### Debug Tools

- **React DevTools**: Inspect component state and props
- **Browser DevTools**: Network, console, and element inspection
- **Vite Inspector**: Press `h` in terminal for Vite shortcuts
- **Playwright UI**: Run `npm run test:e2e:ui` for visual debugging
- **Vitest UI**: Run `npm run test:ui` for test debugging

### Getting Help

1. **GitHub Issues**: Search and create issues with minimal reproduction
2. **Stack Overflow**: Use `patternfly` tag for questions
3. **Community Slack**: Real-time help from community
4. **Documentation**: Always check latest official documentation

## Prevention Strategies

### Best Practices

- **Keep Dependencies Updated**: Update PatternFly 6 packages together
- **Use pf6-guide**: Follow this guide as the source of truth for PatternFly practices
- **Test Both Themes**: Always test in light and dark themes
- **Use Rem Units**: Convert px to rem (divide by 16) for breakpoints
- **Follow Token System**: Use semantic design tokens, not hardcoded values
- **Run Codemods**: Use migration tools when upgrading

### Code Quality

- **Type Safety**: Use TypeScript when possible
- **Testing**: Write unit tests for components
- **Code Review**: Review changes for PatternFly compliance
- **Performance Monitoring**: Track bundle size and performance metrics

Remember: When encountering issues, always check the [official PatternFly documentation](https://www.patternfly.org/) first, then search [GitHub issues](https://github.com/patternfly/patternfly-react/issues) for similar problems. Provide specific error messages, code snippets, and version information when seeking help.

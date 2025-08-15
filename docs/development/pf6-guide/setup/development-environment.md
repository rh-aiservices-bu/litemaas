# Frontend Development Environment

This guide covers the configuration of development tools and environment settings for PatternFly 6 React development.

## Introduction

The frontend uses Vite as its build system, providing fast development builds and Hot Module Replacement (HMR). This guide covers IDE setup, debugging tools, and frontend-specific development workflow.

## Related Files

- [**Setup Guide**](./README.md) - Initial project setup
- [**Quick Start**](./quick-start.md) - Project initialization steps
- [**Styling Standards**](../guidelines/styling-standards.md) - CSS and styling configuration
- [**Performance Optimization**](../troubleshooting/performance.md) - Development performance tips

## Vite Development Server

### Configuration

- **Port**: `3000` (configurable in `vite.config.ts`)
- **Hot Module Replacement**: Enabled by default
- **Source Maps**: Enabled for debugging
- **API Proxy**: Routes `/api` calls to backend when needed

### Starting the Frontend Server

```bash
# Start frontend development server
npm run dev:frontend

# Or from frontend directory
cd frontend && npm run dev

# Stop server
Ctrl+C
```

### Frontend Environment Variables

Create `frontend/.env` for local development:

```env
# Vite requires VITE_ prefix for client-side variables
VITE_API_URL=http://localhost:8081
VITE_APP_NAME=LiteMaaS
VITE_DEBUG_MODE=true
```

**Important**:

- Only `VITE_` prefixed variables are exposed to the browser
- Never put secrets in frontend environment variables
- Use `.env.example` as a template

## IDE and Editor Configuration

### Recommended Extensions (VS Code)

- **ES7+ React/Redux/React-Native snippets**: React development shortcuts
- **Auto Rename Tag**: Automatic HTML/JSX tag renaming
- **Bracket Pair Colorizer**: Visual bracket matching
- **GitLens**: Enhanced Git integration
- **Prettier**: Code formatting
- **ESLint**: Code linting

### TypeScript Configuration

LiteMaaS uses TypeScript throughout. The frontend configuration (`frontend/tsconfig.json`):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## Debugging Configuration

### Browser DevTools Setup

1. **React Developer Tools**: Install browser extension for React debugging
2. **PatternFly DevTools**: Use browser inspector to examine PatternFly classes
3. **Network Tab**: Monitor API calls and resource loading
4. **Console**: Check for PatternFly-specific warnings or errors

### VS Code Debugging

Create `.vscode/launch.json` for frontend debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Frontend in Chrome",
      "request": "launch",
      "type": "chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/frontend/src",
      "sourceMaps": true,
      "sourceMapPathOverrides": {
        "/@fs/*": "${webRoot}/*"
      }
    }
  ]
}
```

**Tips**:

- Set breakpoints directly in VS Code
- Use React Developer Tools browser extension
- Enable "Pause on exceptions" for debugging

## Frontend Build and Testing

### Build Commands

```bash
# Build frontend for production
npm run build:frontend

# Preview production build
cd frontend && npm run preview
```

### Testing PatternFly Components

```bash
# Run frontend unit tests
npm run test:unit

# Test with coverage
npm run test:coverage

# Watch mode for TDD
npm run test:watch
```

### Code Quality

```bash
# Lint frontend code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Type checking
npm run type-check
```

## Frontend Dependencies

### Core PatternFly 6 Packages

```json
{
  "@patternfly/react-core": "^6.0.0",
  "@patternfly/react-table": "^6.0.0",
  "@patternfly/react-icons": "^6.0.0",
  "@patternfly/react-charts": "^8.0.0"
}
```

### Version Management

```bash
# Check for PatternFly updates
cd frontend && npm outdated | grep patternfly

# Update all PatternFly packages together
npm update @patternfly/react-core @patternfly/react-table @patternfly/react-icons

# Verify compatibility
npm run type-check && npm test
```

**Important**: Always update all PatternFly packages together to maintain compatibility.

## Performance Optimization

### Development Performance

- **Code Splitting**: Implement lazy loading for large components
- **Bundle Analysis**: Regular bundle size monitoring
- **Memory Management**: Monitor for memory leaks during development

### Vite Performance Features

- **Hot Module Replacement**: Instant updates without losing state
- **Fast Refresh**: React-specific HMR for components
- **Dependency Pre-bundling**: Faster cold starts
- **Build Optimization**: Automatic code splitting and tree shaking

## Frontend Development Tools

### Recommended VS Code Extensions

- **ES7+ React snippets** - React development shortcuts
- **Prettier** - Code formatting
- **ESLint** - Linting integration
- **GitLens** - Git integration
- **Thunder Client** - API testing
- **PatternFly Snippets** - PatternFly component snippets

### Browser Extensions

- **React Developer Tools** - Component inspection
- **Redux DevTools** - If using Redux
- **Accessibility Insights** - WCAG testing

## Troubleshooting Frontend Development

### Vite Issues

- **HMR not working**:
  ```bash
  rm -rf frontend/node_modules/.vite
  npm run dev:frontend
  ```
- **Port 3000 in use**:
  - Change in `frontend/vite.config.ts`
  - Or kill process: `lsof -ti:3000 | xargs kill -9`

### PatternFly Issues

- **Styles not loading**: Verify `@patternfly/react-core/dist/styles/base.css` import
- **Wrong prefix**: Ensure using `pf-v6-` not `pf-c-` or `pf-v5-`
- **Theme not working**: Check `pf-v6-theme-dark` class on `<html>` element

### Performance Monitoring

- Use React DevTools Profiler
- Monitor bundle size: `npm run build -- --analyze`
- Check network waterfall in browser DevTools

## PatternFly 6 Development Best Practices

### Component Development

1. **Always use `pf-v6-` prefixed classes**
2. **Follow design token system** - No hardcoded values
3. **Test in both themes** - Light and dark
4. **Verify accessibility** - WCAG 2.1 AA compliance
5. **Use TypeScript** - Maintain type safety

### Performance Optimization

- **Code Splitting**: Use React.lazy() for large components
- **Bundle Analysis**: Run `npm run build -- --analyze`
- **Memoization**: Use React.memo and useMemo appropriately
- **Image Optimization**: Use appropriate formats and lazy loading

### Development Workflow

1. **Use HMR** - Make changes and see them instantly
2. **DevTools** - Use React DevTools for debugging
3. **Type Check** - Run frequently during development
4. **Lint Often** - Fix issues as you code
5. **Test Components** - Write tests alongside components

For more frontend-specific guidance, see the [PatternFly Guidelines](../guidelines/README.md).

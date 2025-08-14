# Frontend Test Failure Fix Plan

## Executive Summary

**Current Test Status:**
- **Total Tests:** 951
- **Passing:** 703 (73.9%)
- **Failing:** 245 (25.8%)
- **Skipped:** 3 (0.3%)
- **Unhandled Errors:** 3

**Target:** Achieve 90%+ test pass rate (855+ tests passing)

## Critical Issues Requiring Immediate Attention

### 1. Unhandled Errors (Blocking)
- **AbortSignal RequestInit Issues** - Router navigation problems
- **Missing react-dom/client Mock** - Main app entry point failures  
- **Vitest Mock Factory Errors** - Top-level variable hoisting issues

### 2. Context Provider Issues (High Impact)
- **NotificationProvider Missing** - Many tests fail due to missing provider wrapper
- **AuthContext Integration** - Authentication state not properly mocked across tests
- **React Router Context** - Navigation and routing context issues

### 3. React Testing Best Practices (Medium Impact)
- **Act() Warnings** - State updates not wrapped properly
- **DOM Manipulation** - document.createElement failures in test environment
- **Accessibility Testing** - axe-core initialization and DOM setup issues

## Issue Categories & Root Causes

### Category 1: Mock Configuration Issues

**Files Affected:** 47 test files
**Root Causes:**
- Vitest v6 incompatible mock syntax with top-level variables
- Missing default exports in mocks
- Incorrect hoisting of mock factory functions
- Asset import resolution failures

**Key Examples:**
```typescript
// PROBLEM: Top-level variable in vi.mock factory
let mockIdCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `mock-uuid-${++mockIdCounter}`, // ❌ Hoisting issue
}));

// SOLUTION: Factory function approach
vi.mock('uuid', () => ({
  v4: vi.fn(),
}));
```

**Affected Test Patterns:**
- UUID generation mocks
- Service method mocks  
- Component prop mocks
- Asset import mocks

### Category 2: React Context Provider Issues

**Files Affected:** 38 test files
**Root Causes:**
- Tests not wrapped with required providers
- Provider hierarchy not matching app structure
- Context values not properly initialized for tests
- Missing provider dependencies (React Router, Notifications, Auth)

**Key Examples:**
```typescript
// PROBLEM: Missing provider wrapper
renderHook(() => useNotifications()); // ❌ No NotificationProvider

// SOLUTION: Proper provider wrapping
const wrapper = ({ children }) => (
  <NotificationProvider>
    <Router>
      {children}
    </Router>
  </NotificationProvider>
);
renderHook(() => useNotifications(), { wrapper });
```

**Critical Providers Missing:**
- `NotificationProvider` - Required for toast/alert functionality
- `BrowserRouter` - Required for navigation hooks
- `QueryClient` - Required for React Query hooks
- `AuthProvider` - Required for authentication state

### Category 3: DOM Environment & Accessibility

**Files Affected:** 25 test files  
**Root Causes:**
- JSDOM environment not fully compatible with complex DOM operations
- axe-core accessibility testing initialization failures
- Canvas context and measurement APIs not available
- Document.createElement timing issues in async tests

**Key Examples:**
```typescript
// PROBLEM: DOM operations in wrong environment
document.createElement is not a function

// PROBLEM: Accessibility testing setup
axe-core initialization fails in test environment
```

**Components Most Affected:**
- Chart components (Canvas requirements)
- Dropdown/Select components (Positioning)
- Accessibility test utilities
- File upload components

### Category 4: Async Operations & State Management

**Files Affected:** 31 test files
**Root Causes:**
- Promise resolution not awaited properly
- React state updates not wrapped in act()
- Async useEffect hooks not handled correctly
- Timer and animation mocks interfering

**Key Examples:**
```typescript
// PROBLEM: Unhandled promise rejections
TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal

// PROBLEM: State updates not wrapped
Warning: An update to NotificationProvider inside a test was not wrapped in act(...)
```

### Category 5: Module Resolution & Import Issues

**Files Affected:** 19 test files
**Root Causes:**
- ES modules vs CommonJS conflicts
- Dynamic imports not handled properly
- Asset imports not resolved correctly
- PatternFly component import issues

**Key Examples:**
```typescript
// PROBLEM: Missing asset mock
Error: No "default" export is defined on the "react-dom/client" mock

// PROBLEM: Dynamic import resolution
Cannot resolve module './assets/logo.png'
```

## Detailed Fix Strategies

### Strategy 1: Mock System Overhaul

**Objective:** Fix all Vitest v6 compatibility issues and improve mock reliability

**Tasks:**
1. **Convert Mock Factories** (`litemaas-frontend-developer`)
   - Update all `vi.mock()` factories to avoid top-level variables
   - Use factory functions with proper scoping
   - Fix UUID and other utility mocks
   - **Files:** `src/test/**/*.test.tsx` (scan all)
   - **Expected Impact:** 40-50 test fixes

2. **Asset Mock Consolidation** (`litemaas-frontend-developer`)
   - Update `src/test/__mocks__/assets.ts` with proper default exports
   - Fix image, CSS, and font import mocks
   - Ensure consistent asset handling across all tests
   - **Files:** `vitest.config.ts`, `src/test/__mocks__/assets.ts`
   - **Expected Impact:** 15-20 test fixes

3. **React-DOM Mock Addition** (`litemaas-frontend-developer`)
   - Create proper `react-dom/client` mock in `__mocks__`
   - Ensure createRoot and other DOM APIs are properly mocked
   - **Files:** `src/test/__mocks__/react-dom/client.ts` (create)
   - **Expected Impact:** 25-30 test fixes

### Strategy 2: Provider Infrastructure Fix

**Objective:** Ensure all tests have proper React context provider setup

**Tasks:**
1. **Enhanced Test Utils** (`litemaas-frontend-developer`)
   - Update `src/test/test-utils.tsx` with comprehensive provider wrapper
   - Include NotificationProvider, Router, AuthProvider, QueryClient
   - Add provider hierarchy matching real app structure
   - **Files:** `src/test/test-utils.tsx`
   - **Expected Impact:** 60-70 test fixes

2. **Context Provider Mocks** (`litemaas-frontend-developer`)
   - Fix `AuthContext` mock to include all required methods
   - Ensure `NotificationContext` is properly wrapped
   - Update Router context mocks for navigation tests
   - **Files:** Context test files and mocks
   - **Expected Impact:** 25-30 test fixes

### Strategy 3: DOM Environment Improvements

**Objective:** Resolve DOM API compatibility and accessibility testing issues

**Tasks:**
1. **JSDOM Enhancement** (`litemaas-frontend-developer`)
   - Add missing DOM APIs to test setup
   - Improve canvas context mocking
   - Fix document.createElement timing issues
   - **Files:** `src/test/setup.ts`
   - **Expected Impact:** 15-20 test fixes

2. **Accessibility Testing Fix** (`litemaas-frontend-developer`)
   - Fix axe-core initialization in test environment  
   - Improve accessibility test utilities
   - Add proper DOM element creation for a11y tests
   - **Files:** `src/test/utils/accessibility-setup.test.ts`
   - **Expected Impact:** 10-15 test fixes

### Strategy 4: Async Operations Stabilization

**Objective:** Fix all async/await and state management issues in tests

**Tasks:**
1. **Act() Wrapper Implementation** (`litemaas-frontend-developer`)
   - Wrap all state updates in act()
   - Fix async useEffect testing
   - Improve promise handling in tests
   - **Files:** Component test files with async operations
   - **Expected Impact:** 30-40 test fixes

2. **AbortSignal Mock Fix** (`litemaas-backend-developer`)
   - Fix RequestInit AbortSignal compatibility issues
   - Update MSW configuration for better signal handling
   - Ensure proper cleanup of async operations
   - **Files:** `src/test/setup.ts`, MSW handlers
   - **Expected Impact:** 20-25 test fixes

### Strategy 5: Component-Specific Fixes

**Objective:** Fix remaining component-specific issues

**Tasks:**
1. **LoginPage Test Stabilization** (`litemaas-frontend-developer`)
   - Fix async config service loading
   - Improve authentication state mocking
   - Resolve language selector dropdown issues
   - **Files:** `src/test/components/LoginPage*.test.tsx`
   - **Expected Impact:** 15-20 test fixes

2. **Navigation & Routing Tests** (`litemaas-frontend-developer`)
   - Fix router navigation mocks
   - Improve protected route testing
   - Update route context providers
   - **Files:** Route-related test files
   - **Expected Impact:** 10-15 test fixes

## Delegation Plan

### Phase 1: Critical Infrastructure (Priority 1)
**Delegate to: `litemaas-frontend-developer`**
**Timeline: Day 1-2**

1. **Mock System Fixes**
   - Fix all vi.mock factories for Vitest v6 compatibility
   - Add missing react-dom/client mock
   - Update asset mocks with proper exports

2. **Provider Infrastructure**
   - Enhance test-utils.tsx with complete provider setup
   - Fix context provider mocks and hierarchy

### Phase 2: DOM & Async Operations (Priority 2)  
**Delegate to: `litemaas-frontend-developer` + `litemaas-backend-developer`**
**Timeline: Day 2-3**

1. **Frontend Developer Tasks:**
   - JSDOM environment improvements
   - Accessibility testing fixes
   - Act() wrapper implementation

2. **Backend Developer Tasks:**
   - AbortSignal and MSW configuration fixes
   - Server-side rendering test compatibility

### Phase 3: Component Stabilization (Priority 3)
**Delegate to: `litemaas-frontend-developer`**  
**Timeline: Day 3-4**

1. **Component-Specific Fixes**
   - LoginPage test stabilization
   - Navigation and routing test fixes
   - Form component test improvements

### Phase 4: Validation & Coverage (Priority 4)
**Delegate to: `litemaas-system-architect`**
**Timeline: Day 4-5**

1. **System Validation**
   - Run full test suite validation
   - Analyze remaining failures
   - Performance optimization
   - Coverage gap analysis

## Implementation Steps for Each Agent

### For `litemaas-frontend-developer`

#### Step 1: Mock Factory Conversion
```bash
# Search for problematic mock patterns
grep -r "vi.mock.*=>" src/test --include="*.tsx" --include="*.ts"
# Fix each vi.mock factory to use proper scoping
# Remove top-level variables inside factories
# Use vi.fn() for dynamic values
```

#### Step 2: Provider Setup Enhancement
```typescript
// Update test-utils.tsx with comprehensive wrapper
const AllProviders = ({ children }) => (
  <BrowserRouter>
    <QueryClient client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </AuthProvider>
    </QueryClient>
  </BrowserRouter>
);
```

#### Step 3: Component Test Fixes
```typescript
// Pattern for fixing async component tests
await act(async () => {
  render(<Component />);
});

await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 3000 });
```

### For `litemaas-backend-developer`

#### Step 1: MSW & Network Configuration
```typescript
// Fix AbortSignal issues in MSW setup
server.listen({ 
  onUnhandledRequest: 'warn',
  // Add proper signal handling
});
```

#### Step 2: Node.js Test Environment
```typescript
// Improve Node.js compatibility for SSR tests
if (typeof process !== 'undefined') {
  // Add proper process error handling
}
```

### For `litemaas-system-architect`

#### Step 1: Test Architecture Review
- Analyze test configuration patterns
- Identify architectural improvements
- Recommend testing strategy changes
- Design better test organization

#### Step 2: Performance Optimization
- Memory usage analysis
- Test execution optimization
- Parallel execution improvements
- CI/CD integration enhancement

## Success Criteria

### Phase 1 Success (Infrastructure Fixed)
- [ ] All vi.mock factories work without hoisting errors
- [ ] All context providers properly wrap test components  
- [ ] No more "useX must be used within Provider" errors
- [ ] Asset imports resolve correctly
- [ ] **Target: 80%+ tests passing**

### Phase 2 Success (Stability Achieved)
- [ ] No unhandled promise rejections
- [ ] All act() warnings resolved
- [ ] DOM environment fully functional
- [ ] Accessibility tests working
- [ ] **Target: 85%+ tests passing**

### Phase 3 Success (Component Coverage)
- [ ] All component tests pass
- [ ] Navigation and routing tests work
- [ ] Form validation tests stable
- [ ] Authentication flow tests complete
- [ ] **Target: 90%+ tests passing**

### Final Success (Production Ready)
- [ ] 95%+ test pass rate (900+ tests passing)
- [ ] Zero unhandled errors
- [ ] Full coverage of critical paths
- [ ] Fast test execution (<30s total)
- [ ] Reliable CI/CD integration

## Risk Mitigation

### High-Risk Areas
1. **Complex Async Operations** - Require careful act() wrapping
2. **Third-party Dependencies** - May need additional mocking
3. **Browser-specific APIs** - Need enhanced JSDOM setup

### Fallback Strategies
1. **Progressive Enhancement** - Fix highest-impact issues first
2. **Test Quarantine** - Temporarily skip unstable tests if needed
3. **Mock Escalation** - Add more comprehensive mocks if needed

## Monitoring & Validation

### Key Metrics to Track
- Test pass rate percentage
- Test execution time
- Memory usage during tests
- Number of unhandled errors/warnings
- Coverage percentage by component type

### Validation Commands
```bash
# Run tests with detailed reporting
npm run test -- --reporter=verbose

# Check specific test categories
npm run test -- src/test/components/
npm run test -- src/test/contexts/
npm run test -- src/test/utils/

# Coverage analysis
npm run test:coverage
```

---

**Next Steps:** Begin Phase 1 implementation with `litemaas-frontend-developer` focusing on mock system fixes and provider infrastructure.
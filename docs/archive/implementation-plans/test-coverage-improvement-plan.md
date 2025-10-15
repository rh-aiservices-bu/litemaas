# Frontend Test Coverage Improvement Plan

**Date:** 2025-10-09
**Current Coverage:** 83.37% statements, 78.21% branches, 77.99% functions, 83.64% lines
**Target Coverage:** 90%+ statements, 85%+ branches, 85%+ functions
**Estimated Timeline:** 4 weeks
**Status:** 🟡 **Phase 2 In Progress** (Week 2)

---

## 📊 Implementation Progress

### Phase 1: High-Impact Page Tests ✅ COMPLETED

- [x] ToolsPage.test.tsx (50+ tests)
- [x] UsersPage.test.tsx (60+ tests)
- [x] ChatbotPage.test.tsx (80+ tests)
- **Status:** ✅ All Phase 1 tests completed

### Phase 2: Missing Component Tests 🟡 IN PROGRESS

- [x] UserEditModal.test.tsx (30/30 tests) - **COMPLETED 2025-10-09**
- [ ] MetricsOverview.test.tsx (0/15 tests) - **NEXT**
- [ ] TopUsersTable.test.tsx (0/15 tests)
- [ ] UserFilterSelect.test.tsx (0/12 tests)
- [ ] BannerEditModal.test.tsx (0/20 tests)
- [ ] BannerTable.test.tsx (0/18 tests)
- **Status:** 🟡 1/6 components completed (16.7%)

### Phase 3: Branch & Function Coverage ⏳ PENDING

- [ ] Improve branch coverage in admin components
- [ ] Improve function coverage in pages
- **Status:** ⏳ Not started

### Phase 4: Integration Tests ⏳ PENDING

- [ ] Admin usage analytics flow
- [ ] Model subscription flow
- [ ] API key lifecycle flow
- **Status:** ⏳ Not started

### Key Discoveries & Documentation

- ✅ **PatternFly 6 Switch Pattern**: Documented in [switch-components.md](./pf6-guide/testing-patterns/switch-components.md)
- ✅ **renderWithAuth() Pattern**: Established for role-based testing
- ✅ **Multiple Modal Buttons**: Pattern for handling X and footer close buttons

---

## 📊 Coverage Analysis Summary

### Current State (as of 2025-10-09)

```
File                      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------------|---------|----------|---------|---------|-------------------
All files                 |   83.37 |    78.21 |   77.99 |   83.64 |
 src                      |   34.05 |        0 |      40 |   34.05 |
  main.tsx                |   34.05 |        0 |      40 |   34.05 | 20,25-50,79-86,99,115-117
 src/components           |   62.41 |    71.23 |   58.33 |    62.5 |
 src/components/admin     |      65 |    40.62 |      50 |      65 |
 src/pages                |   77.41 |    67.85 |      60 |   77.46 |
```

### Strong Areas (>95% coverage - Maintain)

✅ **Hooks:** 100% coverage

- All hooks thoroughly tested
- Error handling patterns well-covered
- No action needed

✅ **Utils:** 99.69% coverage

- Excellent coverage across all utility modules
- accessibility-setup, chartAccessibility, chartDataTransformers, chartFormatters
- security.utils, error.utils all >99%

✅ **Charts:** 97.82% coverage

- AccessibleChart, ModelDistributionChart, UsageTrends well-tested
- Accessibility features thoroughly validated
- Good branch coverage

✅ **Services:** 95.74% coverage

- All API services tested
- Error handling tested
- Minor gaps acceptable

✅ **Error Components:** 94.82% coverage

- ErrorAlert and FieldErrors well-tested
- Error boundary components covered

✅ **Contexts:** 94.14% coverage

- AuthContext, NotificationContext, BannerContext tested
- ConfigContext properly mocked in test-utils

### Weak Areas (<80% coverage - Focus Here)

⚠️ **main.tsx:** 34% coverage

- Entry point with browser-specific code
- Favicon generation logic hard to test
- **Action:** Document as low-priority (see Section 8)

⚠️ **components/:** 62.41% coverage

- Missing tests for several key components
- **Action:** Phase 2 - Add missing component tests

⚠️ **components/admin/:** 65% statements, 40.62% branches

- UserFilterSelect, MetricsOverview, TopUsersTable untested
- Low branch coverage indicates missing conditional tests
- **Action:** Phase 2 & 3

⚠️ **pages/:** 77.41% statements, 60% functions

- ToolsPage, UsersPage, ChatbotPage completely untested
- Many event handlers and callbacks untested
- **Action:** Phase 1 - Highest priority

---

## 🎯 Phase 1: High-Impact Page Tests (Weeks 1-2)

**Expected Coverage Gain:** +10-13% statements

### 1.1 ToolsPage.tsx (Priority: CRITICAL)

**Lines of Code:** ~740 lines
**Complexity:** High - 3 major feature areas
**Current Coverage:** 0%
**Estimated Coverage After Testing:** 80-85%

#### Test File Location

`src/test/components/ToolsPage.test.tsx`

#### Features to Test

##### A. Models Sync Tab

```typescript
describe('ToolsPage - Models Sync', () => {
  it('should render models sync section for admin users');
  it('should display sync button disabled for non-admin users');
  it('should show tooltip explaining admin requirement for disabled button');
  it('should call modelsService.refreshModels when sync button clicked');
  it('should display sync results after successful sync');
  it('should show success notification with sync details');
  it('should handle sync errors and display error notification');
  it('should update last sync result state with metrics');
  it('should format sync timestamp correctly');
  it('should display sync errors list when present');
  it('should disable sync button while sync in progress');
  it('should show loading state during sync');
});
```

##### B. Limits Management Tab

```typescript
describe('ToolsPage - Limits Management', () => {
  it('should render limits tab for admin and admin-readonly users');
  it('should not render limits tab for regular users');
  it('should display form with maxBudget, tpmLimit, rpmLimit fields');
  it('should update form state when input values change');
  it('should show confirmation modal when form submitted');
  it('should validate that at least one field has a value');
  it('should show warning notification when no values provided');
  it('should call adminService.bulkUpdateUserLimits on confirm');
  it('should display success notification with update counts');
  it('should display warning notification if some updates failed');
  it('should show last update results after successful operation');
  it('should reset form after successful update');
  it('should disable inputs for admin-readonly users');
  it('should handle update errors gracefully');
  it('should display failed user list when errors occur');
});
```

##### C. Banner Management Tab

```typescript
describe('ToolsPage - Banner Management', () => {
  it('should render banner tab for admin and admin-readonly users');
  it('should load all banners on mount using React Query');
  it('should display create banner button for admin users');
  it('should hide create banner button for admin-readonly users');
  it('should open BannerEditModal in create mode when create clicked');
  it('should open BannerEditModal in edit mode with banner data');
  it('should update visibility state when toggle clicked');
  it('should enforce single visible banner constraint');
  it('should track pending visibility changes in state');
  it('should apply visibility changes when apply button clicked');
  it('should call bulkUpdateVisibility with correct payload');
  it('should refresh banner list after visibility update');
  it('should handle delete banner operation');
  it('should show confirmation for banner deletion');
  it('should invalidate queries after banner deletion');
  it('should handle banner save (create/update)');
  it('should close modal after successful save');
  it('should show unsaved changes indicator');
  it('should display read-only table for admin-readonly users');
});
```

##### D. Tab Navigation & General

```typescript
describe('ToolsPage - General', () => {
  it('should render page title');
  it('should switch between tabs correctly');
  it('should persist active tab in state');
  it('should render models tab as default');
  it('should only show tabs based on user permissions');
  it('should handle loading states');
  it('should handle React Query errors');
});
```

#### Mock Setup

```typescript
vi.mock('../services/models.service');
vi.mock('../services/admin.service');
vi.mock('../services/banners.service');
vi.mock('../contexts/BannerContext');
vi.mock('react-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));
```

**Estimated Tests:** 50-60 tests
**Coverage Gain:** +3-4%

---

### 1.2 UsersPage.tsx (Priority: CRITICAL)

**Lines of Code:** ~710 lines
**Complexity:** High - Complex filtering and pagination
**Current Coverage:** 0%
**Estimated Coverage After Testing:** 85-90%

#### Test File Location

`src/test/components/UsersPage.test.tsx`

#### Features to Test

##### A. User List & Data Fetching

```typescript
describe('UsersPage - User List', () => {
  it('should render users page title');
  it('should load users using React Query on mount');
  it('should display users in table format');
  it('should show user avatar icon for each user');
  it('should display username, email, fullName, roles, status');
  it('should format roles as badges with colors');
  it('should show "Not Provided" for missing fullName');
  it('should display active/inactive badge with icons');
  it('should handle loading state with spinner');
  it('should show loading message during data fetch');
  it('should handle empty user list');
  it('should display empty state message');
  it('should show pagination controls when multiple pages');
  it('should display total user count');
  it('should update page when pagination clicked');
  it('should update perPage when items-per-page changed');
  it('should reset to page 1 when perPage changes');
});
```

##### B. Search & Filtering

```typescript
describe('UsersPage - Search & Filters', () => {
  it('should render search input');
  it('should update search value on input change');
  it('should reset to page 1 when searching');
  it('should update URL params with search term');
  it('should render role filter dropdown');
  it('should display available roles in dropdown');
  it('should update role filter on selection');
  it('should toggle role filter off when selecting same role');
  it('should render status filter dropdown');
  it('should filter by active status');
  it('should filter by inactive status');
  it('should show "Clear All Filters" button when filters active');
  it('should clear all filters when button clicked');
  it('should sync filters with URL search params');
  it('should load initial filters from URL on mount');
  it('should show "No matches" when filters return no results');
  it('should show "Adjust filters" message in empty state');
});
```

##### C. View User Modal

```typescript
describe('UsersPage - View User Modal', () => {
  it('should open view modal when view action clicked');
  it('should display user details in modal');
  it('should show all user fields (username, email, roles, etc)');
  it('should format lastLoginAt as localized date');
  it('should show "Never" for null lastLoginAt');
  it('should display inactive warning alert for inactive users');
  it('should display admin info alert for admin users');
  it('should show Edit button for users with modify permission');
  it('should hide Edit button for users without modify permission');
  it('should close modal when Close button clicked');
  it('should close modal when Escape key pressed');
  it('should restore focus to trigger element after close');
  it('should trap focus within modal when open');
  it('should handle Tab key for focus wrapping');
  it('should handle Shift+Tab for reverse focus wrapping');
  it('should transition to edit modal from view modal');
});
```

##### D. Edit User Modal Integration

```typescript
describe('UsersPage - Edit User Modal', () => {
  it('should open edit modal when edit action clicked');
  it('should pass selected user to UserEditModal');
  it('should pass canEdit permission to modal');
  it('should close edit modal on cancel');
  it('should refresh user list after successful save');
  it('should restore focus to trigger element after close');
  it('should clear selected user state after close');
  it('should not render modal when user is null');
});
```

##### E. Permissions & Access Control

```typescript
describe('UsersPage - Permissions', () => {
  it('should check canReadUsers permission on mount');
  it('should show access denied for users without read permission');
  it('should display permission error message');
  it('should check canModifyUsers for edit actions');
  it('should hide edit actions for users without modify permission');
  it('should render view-only mode for admin-readonly users');
});
```

##### F. Error Handling

```typescript
describe('UsersPage - Error Handling', () => {
  it('should display error state when user fetch fails');
  it('should show error message from API');
  it('should provide "Try Again" button in error state');
  it('should refetch data when "Try Again" clicked');
  it('should show notification on fetch error');
  it('should handle React Query onError callback');
});
```

#### Mock Setup

```typescript
vi.mock('../services/users.service');
vi.mock('react-query', () => ({
  useQuery: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  useSearchParams: vi.fn(),
}));
```

**Estimated Tests:** 60-70 tests
**Coverage Gain:** +3-4%

---

### 1.3 ChatbotPage.tsx (Priority: HIGH)

**Lines of Code:** ~890 lines
**Complexity:** Very High - Streaming, state management
**Current Coverage:** 0%
**Estimated Coverage After Testing:** 75-80%

#### Test File Location

`src/test/components/ChatbotPage.test.tsx`

#### Features to Test

##### A. Initial Setup & Configuration Loading

```typescript
describe('ChatbotPage - Initialization', () => {
  it('should show loading spinner on initial load');
  it('should load API keys on mount');
  it('should load models on mount');
  it('should load config from backend');
  it('should auto-select first API key if available');
  it('should filter models based on selected API key');
  it('should auto-select first available model');
  it('should handle loading errors gracefully');
  it('should display error notification on data load failure');
});
```

##### B. Configuration Panel

```typescript
describe('ChatbotPage - Configuration Panel', () => {
  it('should render expandable configuration section');
  it('should toggle configuration panel expansion');
  it('should display API key select dropdown');
  it('should update selected API key on selection');
  it('should reset model when API key changes');
  it('should display available models for selected key');
  it('should show model count badge for each API key');
  it('should disable model select when no API key selected');
  it('should show loading spinner in model select while loading');
  it('should render temperature slider');
  it('should update temperature on slider change');
  it('should display current temperature value');
  it('should render max tokens input');
  it('should update max tokens on input change');
  it('should render streaming toggle switch');
  it('should update streaming enabled state');
});
```

##### C. Message Sending (Non-Streaming)

```typescript
describe('ChatbotPage - Message Sending (Non-Streaming)', () => {
  it('should add user message to messages array');
  it('should retrieve full API key before sending');
  it('should call chatService.sendMessage with correct params');
  it('should include system prompt if provided');
  it('should add assistant response to messages');
  it('should update response metrics after response');
  it('should disable input while sending');
  it('should handle API errors during send');
  it('should display error notification on failure');
  it('should not send empty messages');
  it('should trim message content before sending');
  it('should handle key retrieval errors');
});
```

##### D. Message Sending (Streaming)

```typescript
describe('ChatbotPage - Streaming', () => {
  it('should create empty assistant message for streaming');
  it('should set streaming state with abort controller');
  it('should call chatService.sendStreamingMessage');
  it('should update message content as chunks arrive');
  it('should capture time to first token (TTFT)');
  it('should display TTFT immediately when available');
  it('should update streaming content in state');
  it('should update metrics when stream completes');
  it('should reset streaming state on completion');
  it('should handle streaming errors');
  it('should preserve content when stream aborted');
  it('should show stop button during streaming');
  it('should hide clear button during streaming');
  it('should abort stream when stop clicked');
  it('should not show notification for aborted streams');
});
```

##### E. Response Metrics Display

```typescript
describe('ChatbotPage - Response Metrics', () => {
  it('should render expandable response info panel');
  it('should show "No data" message initially');
  it('should display TTFT for streaming responses');
  it('should display total response time');
  it('should display token usage (prompt + completion + total)');
  it('should calculate and display tokens per second');
  it('should format metrics correctly');
  it('should update metrics panel after each response');
  it('should show TTFT immediately, other metrics after completion');
});
```

##### F. Chat Interface

```typescript
describe('ChatbotPage - Chat Interface', () => {
  it('should render chatbot header with model name');
  it('should show selected API key badge in header');
  it('should show "Select model first" when no model selected');
  it('should render welcome prompt when no messages');
  it('should render messages in message box');
  it('should display user avatar for user messages');
  it('should display bot avatar for assistant messages');
  it('should show timestamp for each message');
  it('should show loading message indicator during non-streaming send');
  it('should disable message bar when no API key selected');
  it('should disable message bar when no model selected');
  it('should disable message bar while sending');
  it('should show appropriate placeholder based on state');
  it('should clear conversation when clear button clicked');
  it('should show confirmation notification after clear');
  it('should reset metrics when conversation cleared');
  it('should stop streaming before clearing');
});
```

##### G. Full API Key Retrieval

```typescript
describe('ChatbotPage - API Key Retrieval', () => {
  it('should check cache before retrieving key');
  it('should return cached key if available');
  it('should call apiKeysService.retrieveFullKey if not cached');
  it('should cache retrieved key');
  it('should handle key retrieval errors');
  it('should show error notification for retrieval failures');
  it('should abort message send if key retrieval fails');
});
```

#### Mock Setup

```typescript
vi.mock('../services/apiKeys.service')
vi.mock('../services/models.service')
vi.mock('../services/chat.service')
vi.mock('../services/config.service')
vi.mock('@patternfly/chatbot/dist/dynamic/Chatbot', () => ({
  default: ({ children }) => <div>{children}</div>
}))
// Mock all chatbot subcomponents similarly
```

**Estimated Tests:** 70-80 tests
**Coverage Gain:** +4-5%

---

## 🎯 Phase 2: Missing Component Tests (Week 2-3)

**Expected Coverage Gain:** +2-3.5% statements

### 2.1 UserEditModal.tsx ✅ COMPLETED

**Test File Location:** `src/test/components/UserEditModal.test.tsx`
**Status:** ✅ **COMPLETED** - 30/30 tests passing (2025-10-09)

#### Key Discoveries

- **PatternFly 6 Switch Components**: Use `role="switch"` NOT `role="checkbox"`
- **Multiple Close Buttons**: Modals have both X button and footer button, use `getAllByRole()`
- **Role Testing Pattern**: Use `renderWithAuth()` helper with mock users

#### Test Coverage (30 tests)

```typescript
describe('UserEditModal', () => {
  // Modal Rendering (7 tests)
  it('should render modal with user data in edit mode');
  it('should render modal with view title when canEdit is false');
  it('should display username field as read-only');
  it('should display email field as read-only');
  it('should display full name or N/A if not provided');
  it('should format createdAt date correctly');
  it('should display "Never" for null lastLoginAt');

  // Role Management (7 tests)
  it('should display role switches for admin users'); // Uses role="switch"
  it('should pre-select user roles correctly');
  it('should toggle role when switch is clicked');
  it('should show role conflict warning when admin and admin-readonly are both selected');
  it('should display roles as badges in read-only mode');
  it('should display "No roles assigned" when user has no roles');
  it('should disable role switches when canEdit is false');

  // Save Functionality (6 tests)
  it('should call usersService.updateUser when save button is clicked');
  it('should call onSave callback after successful update');
  it('should show success notification after successful save');
  it('should disable save button when no changes are made');
  it('should enable save button when roles are changed');
  it('should disable save button while updating');

  // Error Handling (3 tests)
  it('should display error notification on update failure');
  it('should handle API error with message');
  it('should not call onSave when update fails');

  // Close Functionality (3 tests)
  it('should call onClose when cancel button is clicked');
  it('should call onClose when close button is clicked in read-only mode');
  it('should disable cancel button while updating');

  // Status Display (2 tests)
  it('should display active status badge');
  it('should display inactive status badge');

  // Permissions (2 tests)
  it('should hide save button when canEdit is false');
  it('should not allow role changes when canEdit is false');
});
```

**Actual Tests:** 30 tests
**Coverage Gain:** +0.5-1% (estimated)

---

### 2.2 Admin Components

#### UserFilterSelect.tsx

**Test File:** `src/test/components/admin/UserFilterSelect.test.tsx`

```typescript
describe('UserFilterSelect', () => {
  it('should render select dropdown');
  it('should display "All Users" when no selection');
  it('should display available users from API');
  it('should call onChange when user selected');
  it('should handle multiple user selection');
  it('should clear selection correctly');
  it('should handle loading state');
  it('should handle error state');
  it('should format user display names correctly');
});
```

**Estimated Tests:** 10-12 tests

#### MetricsOverview.tsx

**Test File:** `src/test/components/admin/MetricsOverview.test.tsx`

```typescript
describe('MetricsOverview', () => {
  it('should render metric cards');
  it('should display total requests metric');
  it('should display total tokens metric');
  it('should display total cost metric');
  it('should display average response time metric');
  it('should format large numbers with abbreviations');
  it('should show trend indicators');
  it('should display trend percentages');
  it('should use correct icons for metrics');
  it('should handle null/undefined metrics');
  it('should show loading skeleton when loading');
  it('should display "No data" when metrics are empty');
});
```

**Estimated Tests:** 12-15 tests

#### TopUsersTable.tsx

**Test File:** `src/test/components/admin/TopUsersTable.test.tsx`

```typescript
describe('TopUsersTable', () => {
  it('should render table with top users');
  it('should display user columns (username, requests, tokens, cost)');
  it('should sort users by requests by default');
  it('should allow sorting by different columns');
  it('should format numbers with thousand separators');
  it('should format cost as currency');
  it('should show user rank badges');
  it('should handle empty user list');
  it('should display "No users" message when empty');
  it('should limit table to configurable row count');
  it('should highlight top 3 users');
});
```

**Estimated Tests:** 12-15 tests

**Total Admin Components Coverage Gain:** +1-1.5%

---

### 2.3 Banner Components

#### BannerEditModal.tsx

**Test File:** `src/test/components/banners/BannerEditModal.test.tsx`

```typescript
describe('BannerEditModal', () => {
  it('should render modal in create mode');
  it('should render modal in edit mode with banner data');
  it('should display name input field');
  it('should display content textarea');
  it('should display variant select (info, warning, danger, success)');
  it('should display dismissible checkbox');
  it('should display markdown enabled checkbox');
  it('should show markdown preview when enabled');
  it('should update preview when content changes');
  it('should validate required fields');
  it('should show validation errors');
  it('should disable save when invalid');
  it('should call onSave with banner data');
  it('should close modal on cancel');
  it('should reset form on close');
  it('should handle save errors');
  it('should show loading state during save');
  it('should disable inputs when canEdit is false');
});
```

**Estimated Tests:** 18-20 tests

#### BannerTable.tsx

**Test File:** `src/test/components/banners/BannerTable.test.tsx`

```typescript
describe('BannerTable', () => {
  it('should render table with banners');
  it('should display banner columns (name, content, variant, status)');
  it('should show visibility toggle switch');
  it('should call onVisibilityToggle when switch clicked');
  it('should show pending changes indicator');
  it('should display edit action button');
  it('should display delete action button');
  it('should call onEdit when edit clicked');
  it('should call onDelete when delete clicked');
  it('should show confirmation before delete');
  it('should disable actions when readOnly is true');
  it('should highlight banner with pending changes');
  it('should show banner preview');
  it('should format variant as badge');
  it('should handle empty banner list');
});
```

**Estimated Tests:** 15-18 tests

**Total Banner Components Coverage Gain:** +0.5-1%

---

## 🎯 Phase 3: Branch & Function Coverage (Week 3)

**Expected Coverage Gain:** +3-5% branches, +2-3% functions

### 3.1 Improve Branch Coverage in Admin Components

**Target:** Increase from 40.62% to 70%+

#### Strategy

```typescript
// Test all conditional rendering paths
describe('Conditional Rendering', () => {
  it('should show content when data exists');
  it('should show empty state when data is null');
  it('should show loading state when isLoading is true');
  it('should show error state when error exists');
});

// Test permission-based UI changes
describe('Permission-Based Rendering', () => {
  it('should show edit button for admin users');
  it('should hide edit button for readonly users');
  it('should disable inputs for users without permission');
  it('should show read-only message when canEdit is false');
});

// Test edge cases
describe('Edge Cases', () => {
  it('should handle undefined props gracefully');
  it('should handle empty arrays');
  it('should handle null values in optional fields');
  it('should handle very large numbers');
  it('should handle very long text content');
});
```

#### Components to Enhance

- UserFilterSelect: Add tests for all conditional branches
- MetricsOverview: Test all data states (null, zero, negative, very large)
- TopUsersTable: Test sorting edge cases, empty data
- ApiKeyFilterSelect: Add missing branch tests
- ProviderBreakdownTable: Enhance with edge case tests

**Estimated New Tests:** 30-40 tests
**Coverage Gain:** +1-2% branches

---

### 3.2 Improve Function Coverage in Pages

**Target:** Increase from 60% to 80%+

#### Strategy

```typescript
// Test all event handlers
describe('Event Handlers', () => {
  it('should call handler when button clicked');
  it('should call handler with correct arguments');
  it('should update state in handler');
  it('should prevent default when needed');
});

// Test all useEffect hooks
describe('Effects', () => {
  it('should run effect on mount');
  it('should run effect when dependency changes');
  it('should cleanup on unmount');
  it('should not run effect when dependency unchanged');
});

// Test all helper functions
describe('Helper Functions', () => {
  it('should format data correctly');
  it('should calculate values correctly');
  it('should handle edge cases');
});
```

#### Pages to Enhance

- Existing page tests (HomePage, ModelsPage, ApiKeysPage, etc.)
- Add tests for untested callbacks
- Add tests for all useEffect hooks
- Add tests for inline helper functions

**Estimated New Tests:** 40-50 tests
**Coverage Gain:** +2-3% functions

---

## 🎯 Phase 4: Integration Tests (Week 4)

**Expected Coverage Gain:** +1-2%

### 4.1 Critical User Flow E2E Tests

#### Admin Usage Analytics Flow

**Test File:** `src/test/integration/admin-usage-flow.test.tsx`

```typescript
describe('Admin Usage Analytics Flow', () => {
  it('should complete full analytics workflow', async () => {
    // 1. Navigate to admin usage page
    // 2. Apply user filter
    // 3. Apply model filter
    // 4. Apply date range filter
    // 5. View updated metrics
    // 6. Export to CSV
    // 7. Verify export data
  });

  it('should handle filter interactions correctly');
  it('should update charts when filters change');
  it('should persist filters in URL');
  it('should load filters from URL on mount');
});
```

#### Model Subscription Flow

**Test File:** `src/test/integration/model-subscription-flow.test.tsx`

```typescript
describe('Model Subscription Flow', () => {
  it('should complete subscription workflow', async () => {
    // 1. Navigate to models page
    // 2. Browse available models
    // 3. Click subscribe
    // 4. Fill subscription form
    // 5. Submit subscription
    // 6. Verify success notification
    // 7. Check subscriptions page
  });
});
```

#### API Key Lifecycle Flow

**Test File:** `src/test/integration/api-key-lifecycle.test.tsx`

```typescript
describe('API Key Lifecycle Flow', () => {
  it('should complete API key lifecycle', async () => {
    // 1. Create new API key
    // 2. View full key (one-time)
    // 3. Test key in chatbot
    // 4. Edit key settings
    // 5. Revoke key
    // 6. Verify key is revoked
  });
});
```

**Estimated Tests:** 15-20 integration tests
**Coverage Gain:** +1-2%

---

## 📋 Testing Best Practices & Patterns

### 1. Role-Based Testing Pattern

```typescript
import { renderWithAuth, mockUser, mockAdminUser, mockAdminReadonlyUser } from '../test-utils';

describe('Component Role Testing', () => {
  it('should show limited view for regular users', () => {
    renderWithAuth(<MyComponent />, { user: mockUser });
    expect(screen.queryByText(/admin only/i)).not.toBeInTheDocument();
  });

  it('should show full access for admin users', () => {
    renderWithAuth(<MyComponent />, { user: mockAdminUser });
    expect(screen.getByText(/admin only/i)).toBeInTheDocument();
  });

  it('should show read-only view for admin-readonly users', () => {
    renderWithAuth(<MyComponent />, { user: mockAdminReadonlyUser });
    expect(screen.getByText(/admin only/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });
});
```

### 2. React Query Mocking Pattern

```typescript
import { useQuery } from '@tanstack/react-query';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

describe('Component with React Query', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  it('should handle loading state', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<MyComponent />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
```

### 3. Modal Testing Pattern

```typescript
describe('Modal Component', () => {
  it('should open and close modal correctly', async () => {
    render(<ComponentWithModal />);

    // Open modal
    const openButton = screen.getByRole('button', { name: /open modal/i });
    await userEvent.click(openButton);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Close modal - be specific to avoid multiple close buttons
    const modalCloseButton = within(screen.getByRole('dialog'))
      .getByRole('button', { name: /close/i });
    await userEvent.click(modalCloseButton);

    // Wait for modal to disappear
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
```

### 4. PatternFly 6 Dropdown Testing Pattern

```typescript
describe('Dropdown Component', () => {
  it('should select option from dropdown', async () => {
    render(<ComponentWithDropdown />);

    // Open dropdown
    const toggle = screen.getByRole('button', { name: /select/i });
    await userEvent.click(toggle);

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    // Select option (PatternFly 6 uses role="menuitem", NOT "option")
    const option = screen.getByRole('menuitem', { name: /option text/i });
    await userEvent.click(option);

    // Verify selection
    expect(toggle).toHaveTextContent(/option text/i);
  });
});
```

### 5. Accessibility Testing Pattern

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<MyComponent />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have correct ARIA labels', () => {
    render(<MyComponent />);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('should support keyboard navigation', async () => {
    render(<MyComponent />);
    const firstButton = screen.getByRole('button', { name: /first/i });
    const secondButton = screen.getByRole('button', { name: /second/i });

    firstButton.focus();
    expect(firstButton).toHaveFocus();

    await userEvent.tab();
    expect(secondButton).toHaveFocus();
  });
});
```

### 6. Async Operation Testing Pattern

```typescript
describe('Async Operations', () => {
  it('should handle async operation with loading state', async () => {
    render(<MyComponent />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    // Check loading state appears
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for operation to complete
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    // Check loading state removed
    expect(submitButton).not.toBeDisabled();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
```

### 7. Error Handling Testing Pattern

```typescript
describe('Error Handling', () => {
  it('should display error notification on API failure', async () => {
    const mockService = vi.spyOn(myService, 'fetchData');
    mockService.mockRejectedValue(new Error('API Error'));

    render(<MyComponent />);

    const button = screen.getByRole('button', { name: /load/i });
    await userEvent.click(button);

    // Wait for error to be handled
    await waitFor(() => {
      expect(screen.getByText(/api error/i)).toBeInTheDocument();
    });

    // Verify error was logged
    expect(console.error).toHaveBeenCalled();
  });
});
```

---

## 🚫 What NOT to Test (Low ROI)

### 1. main.tsx Favicon Logic (34% coverage - acceptable)

**Why Skip:**

- Browser-specific canvas rendering is hard to mock
- Favicon generation is non-critical path
- Falls back gracefully if it fails
- Would require complex JSDOM mocking with minimal value

**Recommendation:** Document as intentionally untested

### 2. Third-Party Library Internals

**Don't Test:**

- PatternFly component rendering logic
- React Query internal state management
- Axios request/response interceptors (test your usage, not axios)
- i18next translation engine

**Do Test:**

- Your usage of these libraries
- Your configuration of these libraries
- Your custom wrappers around these libraries

### 3. Simple Pass-Through Components

**Example of Low-Value Test:**

```typescript
// Don't bother testing this:
const MyWrapper = ({ children }) => (
  <div className="wrapper">{children}</div>
);
```

### 4. React Framework Behavior

**Don't Test:**

- React rendering lifecycle
- React state update batching
- React context propagation (test your context values, not React's mechanism)

---

## 📊 Progress Tracking

### Week-by-Week Milestones

#### Week 1

- [ ] ToolsPage.test.tsx completed (50-60 tests)
- [ ] UsersPage.test.tsx completed (60-70 tests)
- [ ] ChatbotPage.test.tsx started (40/80 tests)
- **Target Coverage:** 86-88%

#### Week 2

- [x] ChatbotPage.test.tsx completed (80 tests) - **DONE**
- [x] UserEditModal.test.tsx completed (30 tests) - **DONE 2025-10-09**
- [ ] Admin component tests started (20/40 tests) - **IN PROGRESS**
- **Target Coverage:** 88-90%

#### Week 3

- [ ] All admin component tests completed (40 tests)
- [ ] Banner component tests completed (35 tests)
- [ ] Branch coverage improvements started
- **Target Coverage:** 89-91%

#### Week 4

- [ ] Branch coverage improvements completed
- [ ] Integration tests completed (15-20 tests)
- [ ] Final coverage review and gap filling
- **Target Coverage:** 90-92%

### Coverage Tracking Script

Add to `package.json`:

```json
{
  "scripts": {
    "test:coverage:track": "npm run test:coverage && node scripts/track-coverage.js"
  }
}
```

Create `scripts/track-coverage.js`:

```javascript
const fs = require('fs');
const coverage = require('../coverage/coverage-summary.json');

const timestamp = new Date().toISOString();
const total = coverage.total;

const record = {
  timestamp,
  statements: total.statements.pct,
  branches: total.branches.pct,
  functions: total.functions.pct,
  lines: total.lines.pct,
};

const historyFile = './coverage-history.json';
const history = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile)) : [];

history.push(record);
fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

console.log('Coverage tracked:', record);
```

---

## 🎯 Success Criteria

### Coverage Targets (Must Achieve)

- ✅ Statements: ≥90%
- ✅ Branches: ≥83%
- ✅ Functions: ≥85%
- ✅ Lines: ≥90%

### Quality Targets (Must Achieve)

- ✅ All pages have tests
- ✅ All components have tests
- ✅ All critical user flows have integration tests
- ✅ No untested error handlers
- ✅ All role-based features tested

### Documentation Targets

- ✅ Testing patterns documented
- ✅ Mock setup patterns documented
- ✅ Common issues and solutions documented
- ✅ Coverage tracking automated

---

## 📚 Resources & References

### Internal Documentation

- [PatternFly 6 Testing Patterns](./pf6-guide/testing-patterns/)
  - [Switch Components](./pf6-guide/testing-patterns/switch-components.md) - **NEW 2025-10-09**
  - [Modals](./pf6-guide/testing-patterns/modals.md)
  - [Dropdowns & Pagination](./pf6-guide/testing-patterns/dropdowns-pagination.md)
  - [Context-Dependent Components](./pf6-guide/testing-patterns/context-dependent-components.md)
- [Frontend CLAUDE.md](../frontend/CLAUDE.md)
- [Error Handling Guide](./error-handling.md)
- [Accessibility Testing](./accessibility/)

### External Resources

- [React Testing Library Docs](https://testing-library.com/react)
- [Vitest Documentation](https://vitest.dev/)
- [PatternFly React Docs](https://www.patternfly.org/get-started/develop)
- [jest-axe for Accessibility](https://github.com/nickcolley/jest-axe)

### Testing Philosophy

- Test behavior, not implementation
- Test from user perspective
- Prefer integration tests over unit tests
- Mock external dependencies, not internal modules
- Write tests that provide confidence, not just coverage

---

## 🔄 Continuous Improvement

### After Plan Completion

1. **Review Gaps:** Analyze remaining uncovered code
2. **Update Patterns:** Document new testing patterns discovered
3. **Share Learnings:** Update team on testing best practices
4. **Maintain Coverage:** Set up CI gates to prevent regression
5. **Iterate:** Continue improving coverage incrementally

### Coverage Gates for CI/CD

```yaml
# .github/workflows/test.yml
- name: Check Coverage
  run: npm run test:coverage

- name: Enforce Coverage Thresholds
  run: |
    node -e "
      const coverage = require('./coverage/coverage-summary.json');
      const { statements, branches, functions, lines } = coverage.total;

      if (statements.pct < 90) process.exit(1);
      if (branches.pct < 83) process.exit(1);
      if (functions.pct < 85) process.exit(1);
      if (lines.pct < 90) process.exit(1);
    "
```

---

**Plan Status:** DRAFT
**Last Updated:** 2025-10-09
**Next Review:** After Phase 1 completion

# Admin Usage Analytics - API Key Filter Implementation

## Overview

This document provides a detailed technical explanation of how the API key filter feature works within the Admin Usage Analytics page, including data flow, transformation logic, and implementation details.

## Current System Architecture

### Data Flow (Before API Key Filter)

1. **Raw Data Source**: LiteLLM `/user/daily/activity` endpoint
   - Returns aggregated usage data with `api_key_breakdown` per model
   - Each API key entry contains `metadata.key_alias` (the `litellm_key_alias` value)

2. **Enrichment Process** (`enrichWithUserMapping`):
   - Extracts all unique `key_alias` values from raw data
   - Queries database to map `litellm_key_alias` → `user_id`
   - Creates user-grouped aggregations from API key data

3. **Aggregation Process** (`aggregateDailyData`):
   - Aggregates enriched data by user, model, and provider
   - Applies `userIds` and `modelIds` filters during aggregation
   - Produces final analytics with filtered totals

4. **Current Filters**:
   - **Date Range**: `startDate`, `endDate`
   - **Users**: `userIds[]` - filters during user aggregation
   - **Models**: `modelIds[]` - filters during model aggregation
   - **Providers**: `providerIds[]` - filters during provider aggregation

## New Feature: API Key Filter

### Problem Statement

Currently, usage data is aggregated at the user level, but the raw data is actually keyed by API keys. Users may have multiple API keys, and administrators need the ability to:

1. Filter analytics by specific API key(s)
2. See which API keys are generating usage
3. When users are selected, only show API keys belonging to those users

### Solution Design

#### Data Structure

**Raw LiteLLM Data** (per day, per model):

```json
{
  "date": "2025-10-04",
  "breakdown": {
    "models": {
      "gpt-4": {
        "metrics": { "api_requests": 100, ... },
        "api_key_breakdown": {
          "sk-...hash...": {
            "metadata": {
              "key_alias": "user1-key-alpha"  // litellm_key_alias from database
            },
            "metrics": { "api_requests": 50, ... }
          },
          "sk-...hash...": {
            "metadata": {
              "key_alias": "user2-key-beta"
            },
            "metrics": { "api_requests": 50, ... }
          }
        }
      }
    }
  }
}
```

**Database Mapping**:

```sql
-- api_keys table
id              | user_id  | name           | litellm_key_alias
uuid            | uuid     | varchar        | varchar
----------------+----------+----------------+-------------------
key-1-uuid      | user-1   | "My Key Alpha" | "user1-key-alpha"
key-2-uuid      | user-2   | "My Key Beta"  | "user2-key-beta"
```

**Enriched Data Structure**:

```typescript
interface EnrichedDayData {
  date: string;
  breakdown: {
    users: {
      [userId: string]: {
        userId: string;
        username: string;
        email: string;
        models: {
          [modelName: string]: {
            api_keys: {
              [keyAlias: string]: {
                // NEW: Preserve API key breakdown
                keyAlias: string;
                keyName: string;
                metrics: UsageMetrics;
              };
            };
            metrics: UsageMetrics; // Aggregated totals
          };
        };
        metrics: UsageMetrics;
      };
    };
    models: {
      // Models breakdown remains aggregated only (no API key granularity)
      [modelName: string]: {
        metrics: UsageMetrics;
        // NO api_keys field here - only in users breakdown
      };
    };
  };
}
```

**Note on Data Structure**:

- **users breakdown**: Contains full API key granularity (`api_keys` object within each model)
- **models breakdown**: Contains only aggregated metrics (no API key details)
- This design preserves API key data where needed while minimizing memory usage

### Implementation Details

#### 1. Backend: Data Enrichment Changes

**File**: `backend/src/services/admin-usage-stats.service.ts`

**Current Behavior** (`enrichWithUserMapping`):

- Maps `key_alias` → `user_id`
- Aggregates all API key data into user totals
- **Loses individual API key granularity**

**New Behavior**:

- Preserve API key breakdown within each user's model data
- Store `keyAlias` and `keyName` for each API key's metrics
- Still aggregate to user totals, but maintain API key details

```typescript
// Pseudo-code for enrichment changes
Object.entries(modelData.api_keys).forEach(([keyHash, keyData]) => {
  const keyAlias = keyData.metadata?.key_alias;
  const userMapping = keyToUser.get(keyAlias);

  let userId: string;
  let keyName: string;

  if (userMapping) {
    userId = userMapping.userId;
    keyName = userMapping.keyName;
  } else {
    // Handle unmapped API keys - aggregate to special "Unknown User"
    userId = '__unmapped__';
    keyName = 'Unknown Key';

    // Initialize unmapped user if not exists
    if (!enrichedData.breakdown.users['__unmapped__']) {
      enrichedData.breakdown.users['__unmapped__'] = {
        userId: '__unmapped__',
        username: 'Unknown User',
        email: 'unmapped@system',
        models: {},
        metrics: {
          /* initialize empty metrics */
        },
      };
    }
  }

  // Initialize user's model if needed
  if (!enrichedData.breakdown.users[userId].models[modelName]) {
    enrichedData.breakdown.users[userId].models[modelName] = {
      metrics: {
        /* initialize empty metrics */
      },
      api_keys: {}, // NEW: Store API key breakdown
    };
  }

  // NEW: Preserve API key data
  enrichedData.breakdown.users[userId].models[modelName].api_keys[keyAlias] = {
    keyAlias: keyAlias,
    keyName: keyName,
    metrics: keyData.metrics,
  };

  // Aggregate to model totals
  const modelMetrics = enrichedData.breakdown.users[userId].models[modelName].metrics;
  modelMetrics.api_requests += keyData.metrics.api_requests;
  // ... other metrics
});
```

**Unmapped API Key Handling**:

- API keys without database mapping are aggregated to a special `__unmapped__` user
- This ensures no data loss and provides visibility into orphaned API keys
- Admins can identify and investigate unmapped keys in the analytics

#### 2. Backend: Filtering Logic

**File**: `backend/src/services/admin-usage-stats.service.ts`

**Filter Application Point**: During `aggregateDailyData()`

**Filter Order** (applied sequentially):

1. **API Key Filter** (NEW): Filter at the API key level
2. **Model Filter**: Skip models not in `filters.modelIds`
3. **User Filter**: Skip users not in `filters.userIds`

**Aggregation Flow with API Key Filter**:

```typescript
private aggregateDailyData(
  dailyData: EnrichedDayData[],
  filters: AdminUsageFilters
): AggregatedUsageData {
  dailyData.forEach(day => {
    Object.entries(day.breakdown.users).forEach(([userId, userData]) => {
      // User-level filter (existing)
      if (filters.userIds?.length && !filters.userIds.includes(userId)) {
        return; // Skip user
      }

      Object.entries(userData.models).forEach(([modelName, modelData]) => {
        // Model-level filter (existing)
        if (filters.modelIds?.length && !filters.modelIds.includes(modelName)) {
          return; // Skip model
        }

        // NEW: Conditional aggregation based on API key filter
        if (filters.apiKeyIds?.length) {
          // API key filter active - iterate through api_keys
          Object.entries(modelData.api_keys || {}).forEach(([keyAlias, keyData]) => {
            // Filter by API key alias
            if (!filters.apiKeyIds.includes(keyAlias)) {
              return; // Skip this API key's metrics
            }

            // Aggregate only the filtered API key's metrics
            userAgg.api_requests += keyData.metrics.api_requests;
            userAgg.total_tokens += keyData.metrics.total_tokens;
            // ... etc
          });
        } else {
          // No API key filter - use pre-aggregated totals (fast path)
          userAgg.api_requests += modelData.metrics.api_requests;
          userAgg.total_tokens += modelData.metrics.total_tokens;
          // ... etc
        }
      });
    });
  });
}
```

**Key Insights**:

- **Without API key filter**: Use pre-aggregated `modelData.metrics` (fast path - existing behavior)
- **With API key filter**: Iterate through `modelData.api_keys` and sum only matching keys
- This conditional logic preserves performance when the filter is not used
- All filters use **AND logic** - they must all match for data to be included

#### 3. Backend: API Keys List Endpoint

**File**: `backend/src/routes/admin.ts`

**New Endpoint**: `GET /admin/api-keys`

**Query Parameters**:

- `userIds[]` (**required**): Filter API keys by owner user IDs
  - Returns empty array if not provided or empty
  - Prevents accidentally returning all API keys in the system

**Design Decision**: API key filter is only available when user filter is active. This prevents:

- Loading thousands of API keys in large deployments
- Overwhelming dropdown UI
- Performance issues

**Implementation**:

```typescript
fastify.get('/api-keys', {
  schema: {
    querystring: {
      userIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
    },
    response: {
      200: {
        apiKeys: Type.Array({
          id: Type.String(), // UUID (for reference, not filtering)
          name: Type.String(), // Display name
          keyAlias: Type.String(), // Used as filter value
          userId: Type.String(),
          username: Type.String(),
          email: Type.String(),
        }),
        total: Type.Number(),
      },
    },
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    const { userIds } = request.query;

    // Return empty if no users specified (required filter)
    if (!userIds?.length) {
      return {
        apiKeys: [],
        total: 0,
      };
    }

    const apiKeys = await fastify.dbUtils.queryMany(
      `SELECT
        ak.id,
        ak.name,
        ak.litellm_key_alias as "keyAlias",
        ak.user_id as "userId",
        u.username,
        u.email
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.user_id = ANY($1)
      ORDER BY u.username, ak.name`,
      [userIds],
    );

    return {
      apiKeys,
      total: apiKeys.length,
    };
  },
});
```

**Notes**:

- Uses `keyAlias` (litellm_key_alias) as the filter identifier, not UUID `id`
- `id` field included for reference but not used in filtering
- Permission: Uses existing `admin:usage` permission (no new permission needed)

**Response Example**:

```json
{
  "apiKeys": [
    {
      "id": "key-1-uuid",
      "name": "Production Key",
      "keyAlias": "user1-key-alpha",
      "userId": "user-1-uuid",
      "username": "john.doe",
      "email": "john@example.com"
    },
    {
      "id": "key-2-uuid",
      "name": "Dev Key",
      "keyAlias": "user1-key-beta",
      "userId": "user-1-uuid",
      "username": "john.doe",
      "email": "john@example.com"
    }
  ],
  "total": 2
}
```

#### 4. Frontend: Component Architecture

**File**: `frontend/src/components/admin/ApiKeyFilterSelect.tsx`

**Pattern**: Copy from `UserFilterSelect.tsx` with modifications

**Key Differences**:

1. **Data Source**: `/admin/api-keys` instead of `/admin/users`
2. **Display Format**: `{keyName} ({username})` instead of `{username} ({email})`
3. **Dynamic Filtering**: React Query key includes `selectedUserIds` for cache invalidation
4. **Conditional Enabling**: Component disabled when no users selected

**Props Interface**:

```typescript
interface ApiKeyFilterSelectProps {
  selected: string[]; // Selected keyAlias values
  onSelect: (keyAliases: string[]) => void;
  selectedUserIds: string[]; // For cascading filter
  isDisabled?: boolean; // Disabled when no users selected
}
```

**React Query Configuration**:

```typescript
const { data: apiKeysData } = useQuery(
  ['api-keys-for-filter', selectedUserIds.sort().join(',')], // Serialized for stable cache key
  async () => {
    const params = new URLSearchParams();
    selectedUserIds.forEach((id) => params.append('userIds[]', id));
    const response = await apiClient.get<{ apiKeys: ApiKeyOption[] }>(
      `/admin/api-keys?${params.toString()}`,
    );
    return response.apiKeys;
  },
  {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: selectedUserIds.length > 0, // Only fetch when users selected
  },
);
```

**Cache Key Explanation**:

- Serializes `selectedUserIds` array as sorted comma-separated string
- Ensures stable cache key regardless of array reference
- Handles order changes gracefully (`['a','b']` and `['b','a']` produce same key)
- Follows React Query best practices for array dependencies

**Cascading Filter Logic**:

```typescript
// In AdminUsagePage.tsx
const handleUserFilterChange = (userIds: string[]) => {
  setSelectedUserIds(userIds);

  if (userIds.length > 0) {
    // Filter out API keys that no longer belong to selected users
    const filteredApiKeys = selectedApiKeyIds.filter((keyAlias) => {
      const key = allApiKeys.find((k) => k.keyAlias === keyAlias);
      return key && userIds.includes(key.userId);
    });

    if (filteredApiKeys.length !== selectedApiKeyIds.length) {
      setSelectedApiKeyIds(filteredApiKeys);
    }
  } else {
    // No users selected - clear all API key selections
    setSelectedApiKeyIds([]);
  }
};
```

**Cascading Behavior**:

1. **When users are selected**: Remove API keys not belonging to those users
2. **When users are cleared**: Clear all API key selections
3. **UI State**: Dropdown is disabled when `selectedUserIds.length === 0`
4. **React Query**: Query is disabled (won't fetch) when no users selected

#### 5. Frontend: Page Integration

**File**: `frontend/src/pages/AdminUsagePage.tsx`

**State Management**:

```typescript
const [selectedApiKeyIds, setSelectedApiKeyIds] = useState<string[]>([]);
```

**Filters Object**:

```typescript
const filters: AdminUsageFilters = {
  ...getDateRange(),
  ...(selectedModelIds.length > 0 && { modelIds: selectedModelIds }),
  ...(selectedUserIds.length > 0 && { userIds: selectedUserIds }),
  ...(selectedApiKeyIds.length > 0 && { apiKeyIds: selectedApiKeyIds }), // NEW
};
```

**Toolbar Layout**:

```tsx
<Toolbar>
  <ToolbarContent>
    <DateRangeFilter ... />
    <ToolbarItem>
      <ModelFilterSelect ... />
    </ToolbarItem>
    <ToolbarItem>
      <UserFilterSelect
        selected={selectedUserIds}
        onSelect={handleUserFilterChange}
      />
    </ToolbarItem>
    <ToolbarItem>
      <ApiKeyFilterSelect
        selected={selectedApiKeyIds}
        onSelect={setSelectedApiKeyIds}
        selectedUserIds={selectedUserIds}         // For cascading filter
        isDisabled={selectedUserIds.length === 0} // Disabled when no users
      />
    </ToolbarItem>
  </ToolbarContent>
</Toolbar>
```

**Filter Dependency Flow**:

1. Date Range → always available
2. Model Filter → always available
3. User Filter → always available
4. **API Key Filter** → requires User Filter to be active (disabled otherwise)

### Data Transformation Examples

#### Example 1: No API Key Filter

**Input**: User selects "User A" in user filter

**Filter Applied**:

```typescript
{
  userIds: ['user-a-uuid'];
}
```

**Result**: All API keys belonging to User A are included in aggregation

- API Key Alpha (User A): 50 requests ✓
- API Key Beta (User A): 30 requests ✓
- **Total**: 80 requests

#### Example 2: With API Key Filter

**Input**: User selects "User A" in user filter AND "API Key Alpha" in API key filter

**Filter Applied**:

```typescript
{
  userIds: ["user-a-uuid"],
  apiKeyIds: ["user-a-key-alpha"]
}
```

**Result**: Only API Key Alpha's data is aggregated

- API Key Alpha (User A): 50 requests ✓
- API Key Beta (User A): ~~30 requests~~ (filtered out)
- **Total**: 50 requests

#### Example 3: Cascading Filter Behavior

**Scenario**: User selects multiple users, then narrows to one user

1. **Initial State**:
   - Selected Users: [User A, User B]
   - Selected API Keys: [User A - Key Alpha, User B - Key Beta]

2. **User Changes Filter**: Deselects User B
   - Selected Users: [User A]
   - API Keys dropdown auto-filters: Only shows User A's keys
   - Selected API Keys: Auto-cleared "User B - Key Beta" (no longer valid)
   - Selected API Keys: [User A - Key Alpha] (preserved)

3. **Query Sent to Backend**:
   ```json
   {
     "userIds": ["user-a-uuid"],
     "apiKeyIds": ["user-a-key-alpha"]
   }
   ```

### Performance Considerations

1. **API Key Endpoint Caching**:
   - React Query caches with key `['api-keys-for-filter', selectedUserIds.sort().join(',')]`
   - Cache is invalidated when user selection changes
   - 5-minute stale time reduces redundant requests

2. **Database Query Optimization**:
   - Index on `api_keys.user_id` for fast filtering
   - Index on `api_keys.litellm_key_alias` for enrichment lookups
   - JOIN on users table is acceptable (small table, indexed)

3. **Aggregation Impact**:
   - API key filtering happens during aggregation loop
   - No additional database queries during aggregation
   - Conditional logic preserves fast path when filter not used
   - Minimal performance impact when filter is active (additional array iteration)

### Memory Impact

**Enrichment Strategy**: Data is enriched BEFORE filtering (Scenario A)

1. **Backend Memory Usage**:
   - All users' data is enriched with API key breakdowns before filtering
   - Estimated memory per request: ~45MB for large dataset (90 days, 100 users, 500 API keys)
   - Memory is temporary and request-scoped
   - **Not a concern**: Backend has sufficient memory, data released after request completes

2. **Frontend Memory Usage**:
   - Frontend receives only aggregated results (small payload)
   - No memory concerns on client side

3. **Why This Approach**:
   - Simplifies implementation (single enrichment pass)
   - Filtering at aggregation time allows flexible filter combinations
   - Backend memory is acceptable trade-off for cleaner architecture

### Error Handling

1. **No API Keys Found**:
   - Display "No API keys found" message in dropdown
   - Allow clearing the filter
   - Show helpful message when no users are selected

2. **Unmapped API Keys** (no database match):
   - Backend: Aggregate to special `__unmapped__` user
   - Shown as "Unknown User" in analytics
   - Ensures no data loss and provides visibility into orphaned keys

3. **API Key No Longer Exists**:
   - Frontend: Clear invalid selections on user filter change
   - Cascading logic automatically removes invalid keys

4. **Permission Denied**:
   - Backend: Requires `admin:usage` permission (same as user filter)
   - Frontend: Component only rendered for admins
   - No new permission needed

### Translation Keys

All locale files in `frontend/src/i18n/locales/*/translation.json` require these keys:

```json
{
  "adminUsage": {
    "filters": {
      "apiKeys": "Filter by API keys",
      "apiKeysPlaceholder": "Select users first to filter by API keys",
      "apiKeysPlaceholderActive": "All API keys (click to filter)",
      "selectedApiKeys": "Selected API keys",
      "noApiKeysFound": "No API keys found for \"{{query}}\"",
      "clearApiKeysFilter": "Clear API key filter",
      "apiKeysLoadError": "Failed to load API keys",
      "noApiKeysAvailable": "No API keys available for selected users"
    }
  }
}
```

**Translation Notes**:

- Display format `{keyName} ({username})` is hardcoded (not translated)
- Total keys to translate: 8 per language × 9 languages = 72 translations

### Accessibility Requirements

**WCAG AA Compliance**:

1. **PatternFly Select Built-in Features**:
   - Combobox role (ARIA)
   - aria-activedescendant for keyboard navigation
   - aria-expanded for dropdown state
   - Keyboard navigation (Arrow keys, Enter, Escape)

2. **Custom ARIA Live Region**:

```tsx
<div role="status" aria-live="polite" className="pf-v6-screen-reader">
  {announceMessage}
</div>
```

3. **Announcement Triggers**:
   - **Filter becomes enabled**: "API key filter is now available"
   - **Filter becomes disabled**: "API key filter disabled - select users first"
   - **Cascading clear**: "{{count}} API key selections cleared due to user filter change"
   - **API keys loaded**: Rely on PatternFly's built-in announcements

4. **Implementation Notes**:
   - Use `pf-v6-screen-reader` class to visually hide announcements
   - Update `announceMessage` state when filter state changes
   - Clear announcement after 5 seconds to avoid clutter

### Testing Checklist

#### Backend Unit Tests

**File**: `backend/tests/unit/services/admin-usage-stats.service.test.ts`

- [ ] Enrichment preserves API key data structure correctly
- [ ] Enrichment aggregates unmapped keys to `__unmapped__` user
- [ ] Enrichment preserves key names from database
- [ ] Aggregation with only `apiKeyIds` filter (no users, no models)
- [ ] Aggregation with `apiKeyIds` + `userIds` filter (both matching)
- [ ] Aggregation with `apiKeyIds` + `modelIds` filter
- [ ] Aggregation with all filters (`apiKeyIds` + `userIds` + `modelIds` + `providerIds`)
- [ ] Aggregation without `apiKeyIds` uses fast path (pre-aggregated metrics)
- [ ] Aggregation with `apiKeyIds` iterates through api_keys object
- [ ] Filtering with non-existent API key alias returns zero results
- [ ] AND logic: provider filter + API key filter both must match

#### Backend Integration Tests

**File**: `backend/tests/integration/admin-api-keys.test.ts` (new)

- [ ] GET /admin/api-keys returns all keys for selected users
- [ ] GET /admin/api-keys returns empty when no userIds provided
- [ ] GET /admin/api-keys enforces admin:usage permission
- [ ] GET /admin/api-keys returns correct user information (joins)
- [ ] GET /admin/api-keys orders by username, name
- [ ] GET /admin/api-keys filters by multiple users correctly

#### Frontend Component Tests

**File**: `frontend/src/components/admin/ApiKeyFilterSelect.test.tsx` (new)

- [ ] Component disabled when selectedUserIds is empty
- [ ] Component enabled when selectedUserIds has values
- [ ] React Query fetches with correct parameters
- [ ] React Query disabled when no users selected
- [ ] Cache key changes when selectedUserIds changes
- [ ] Cache key stable for same users in different order
- [ ] Displays API keys in correct format: "keyName (username)"
- [ ] Clear button clears selections
- [ ] Search/filter works correctly
- [ ] Shows placeholder when disabled
- [ ] Shows different placeholder when enabled

#### Frontend Integration Tests

**File**: `frontend/src/pages/AdminUsagePage.test.tsx`

- [ ] Clearing user filter clears API key selections
- [ ] Changing user filter removes invalid API key selections
- [ ] Changing user filter preserves valid API key selections
- [ ] API key filter state updates correctly
- [ ] Filter object includes apiKeyIds when selected
- [ ] Filter object excludes apiKeyIds when empty

#### E2E Tests (Playwright)

**File**: `frontend/tests/e2e/admin-usage-api-key-filter.spec.ts` (new)

- [ ] Complete filter workflow: date → user → API key
- [ ] API key dropdown disabled until users selected
- [ ] API key dropdown populates with correct keys
- [ ] Selecting API key updates analytics display
- [ ] Cascading filter clears API keys when users cleared
- [ ] Cascading filter removes invalid keys when users changed
- [ ] Screen reader announcements work correctly
- [ ] All 9 language translations display correctly
- [ ] Keyboard navigation works (Tab, Arrow keys, Enter, Escape)
- [ ] Loading states display correctly
- [ ] Error states display correctly (no permission, API error)

### Migration Path

**Phase 1: Backend Foundation**

- Update types and schemas (`AdminUsageFilters` interface)
- Add `/admin/api-keys` endpoint with `admin:usage` permission
- Write integration tests for endpoint
- Test endpoint manually with Playwright

**Phase 2: Backend Filtering**

- Modify enrichment to preserve API key data in `users` breakdown
- Add unmapped key handling (`__unmapped__` user)
- Update aggregation with conditional logic (fast path vs. API key iteration)
- Add unit tests for enrichment and filtering logic
- Verify all filter combinations work correctly

**Phase 3: Frontend Component**

- Create `ApiKeyFilterSelect` component based on `UserFilterSelect`
- Implement disabled state and React Query conditional fetching
- Add all 72 translations (8 keys × 9 languages)
- Write component tests
- Test in isolation

**Phase 4: Integration**

- Add to AdminUsagePage toolbar
- Implement cascading filter logic in page component
- Add ARIA live region for announcements
- Write integration tests
- Verify accessibility with screen reader

**Phase 5: Validation**

- E2E testing with Playwright (complete workflow)
- Verify all filter combinations
- Test cascading behavior thoroughly
- Performance testing with large datasets (90 days, 100 users)
- Accessibility audit (WCAG AA compliance)

### Deferred Features

**Export Functionality Integration** (not included in initial implementation):

- CSV/JSON export with API key column
- Export respects API key filter
- Will be addressed in separate implementation phase

### Future Enhancements

1. **API Key Search**: Add typeahead/autocomplete in dropdown for many keys
2. **API Key Metadata**: Show additional info (creation date, last used, total usage)
3. **API Key Analytics Tab**: Dedicated breakdown view focused on API keys
4. **Bulk Selection**: "Select all keys for current users" button
5. **Default Filters**: Remember last used API key filter per session (localStorage)
6. **API Key Usage Trends**: Chart showing usage over time per API key

## Conclusion

The API key filter feature leverages the existing data structure where usage is already tracked at the API key level. By preserving this granularity during enrichment and applying conditional filtering during aggregation, we provide administrators with fine-grained control over usage analytics without significant architectural changes.

### Key Design Decisions

1. **Conditional Aggregation**: Preserves performance by using pre-aggregated totals when API key filter is not active
2. **keyAlias as Identifier**: Simplifies implementation by using the existing `litellm_key_alias` field throughout
3. **Cascading Filters**: API key filter requires user filter to be active, preventing UI/performance issues
4. **Unmapped Keys Visibility**: Orphaned API keys are shown as "Unknown User" to ensure no data loss
5. **Memory Trade-off**: Backend enriches all data before filtering (acceptable temporary memory usage)
6. **AND Filter Logic**: All filters combine with AND logic for intuitive behavior

### User Experience Highlights

- **Intuitive Workflow**: Filters cascade naturally (date → model → user → API key)
- **Clear Disabled State**: API key filter clearly indicates when it becomes available
- **Accessibility**: Full WCAG AA compliance with screen reader announcements
- **Performance**: No degradation when filter is not used (fast path preserved)

The cascading filter behavior (user selection → API key dropdown) provides an intuitive UX that helps admins quickly narrow down to specific API keys while maintaining data consistency and preventing overwhelming the UI with thousands of options.

# Phase Pre-2: Fix HTTP Method Inconsistency for Admin Usage Endpoints

**Phase**: Pre-2 - Critical Bug Fix
**Priority**: 🔴 CRITICAL
**Issue**: URL Overflow Risk with Array Parameters
**Related**: Phase 2 Session 2A (Backend Pagination)

---

## Navigation

- **Next**: [Phase 2, Session 2A: Backend Pagination](./phase-2-session-2a-backend-pagination.md)
- **Related**: [Phase 2, Session 2B: Frontend Pagination](./phase-2-session-2b-frontend-pagination.md)
- **Parent**: [Refactoring Overview](./00-overview.md)

---

## Problem Statement

### The Issue

The admin usage breakdown endpoints currently use **GET with query parameters**, but they accept **array filters** that can overflow URL length limits:

```typescript
// Current (BROKEN for large filter arrays)
GET /api/v1/admin/usage/by-user?startDate=2024-01-01&endDate=2024-01-31&userIds[]=uuid1&userIds[]=uuid2&...&userIds[]=uuid100
```

**AdminUsageFilters interface** contains arrays:

```typescript
interface AdminUsageFilters {
  startDate: string;
  endDate: string;
  userIds?: string[]; // ⚠️ Can have 100+ UUIDs (36 chars each = 3,600+ chars)
  modelIds?: string[]; // ⚠️ Can have dozens of model IDs
  providerIds?: string[]; // ⚠️ Can have multiple providers
  apiKeyIds?: string[]; // ⚠️ Can have many API keys
}
```

**URL Length Limits**:

- Most browsers: ~2048 characters
- Nginx default: 4096 characters
- RFC 2616: No hard limit, but practical limits exist

With 100 user UUIDs, the URL can easily exceed 3,600+ characters, causing:

- 414 Request-URI Too Large errors
- Silent truncation in some clients
- Inconsistent behavior across environments

### Root Cause

**Inconsistent implementation**: The `/analytics` endpoint correctly uses POST, but the breakdown endpoints (`/by-user`, `/by-model`, `/by-provider`) and `/export` were incorrectly implemented with GET.

**Comparison**:

```typescript
// ✅ CORRECT: /analytics endpoint (Line 73)
fastify.post<{
  Body: AdminUsageFilters;
}>('/analytics', {
  // Filters in request body - no URL length issues
});

// ❌ WRONG: Breakdown endpoints (Lines 207, 352, 494)
fastify.get<{
  Querystring: AdminUsageFilters & { page?; limit?; sortBy?; sortOrder? };
}>('/by-user', {
  // Filters in query string - URL overflow risk!
});
```

### Impact

**Current Risk Level**: 🔴 **CRITICAL**

- Production systems with 100+ users will fail
- Export functionality will break with large filters
- No way to filter by many users/models simultaneously

---

## Correct Design Pattern

The **Phase 2A refactoring plan** correctly specified POST:

```bash
POST /api/v1/admin/usage/user-breakdown?page=1&limit=50&sortBy=totalTokens&sortOrder=desc
Content-Type: application/json

{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "userIds": ["uuid1", "uuid2", ..., "uuid100"],
  "modelIds": ["gpt-4", "gpt-3.5"],
  "providerIds": ["openai"],
  "apiKeyIds": ["key1", "key2"]
}
```

**Benefits**:

- ✅ Unlimited filter array size
- ✅ Consistent with `/analytics` endpoint
- ✅ Follows REST best practice for complex queries
- ✅ Pagination params in query string (cacheable, bookmarkable)
- ✅ Filter data in body (unlimited size)

---

## Files Affected

### Backend Files

| File                                                       | Lines              | Changes                          | Impact           |
| ---------------------------------------------------------- | ------------------ | -------------------------------- | ---------------- |
| `backend/src/routes/admin-usage.ts`                        | 207, 352, 494, 632 | Change GET to POST, split params | 4 endpoints      |
| `backend/tests/integration/admin-usage-pagination.test.ts` | 45+ occurrences    | Change method: 'GET' to 'POST'   | 45+ test cases   |
| `backend/src/schemas/admin-usage.ts`                       | New schemas        | Split querystring/body schemas   | Type definitions |

### Frontend Files

| File                                                      | Changes                              | Impact              |
| --------------------------------------------------------- | ------------------------------------ | ------------------- |
| `frontend/src/services/adminUsage.service.ts`             | 4 methods (lines 226, 249, 272, 298) | Change GET to POST  |
| `frontend/src/test/mocks/handlers.ts`                     | MSW handlers                         | Update HTTP method  |
| `frontend/src/test/components/admin/ExportModal.test.tsx` | Test assertions                      | Update expectations |
| `frontend/src/test/components/AdminUsagePage.test.tsx`    | Test assertions                      | Update expectations |

### Documentation Files

| File                                                                  | Changes                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `docs/api/rest-api.md`                                                | Lines 1568-1695: Update all endpoints to POST, add pagination docs |
| `docs/development/refactor/phase-2-session-2a-backend-pagination.md`  | Confirm POST pattern is correct                                    |
| `docs/development/refactor/phase-2-session-2b-frontend-pagination.md` | Update frontend examples to use POST                               |

---

## Implementation Steps

### Step Pre-2.1: Update Backend Schemas (30 minutes)

**File**: `backend/src/schemas/admin-usage.ts`

Create new schemas that separate querystring (pagination) from body (filters):

```typescript
// Add after line 82 (before ExportQuerySchema)

/**
 * Pagination query parameters for breakdown endpoints
 * Used in querystring for all paginated endpoints
 */
export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  sortBy: Type.Optional(Type.String({ default: 'totalTokens' })),
  sortOrder: Type.Optional(
    Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
      default: 'desc',
    }),
  ),
});

/**
 * Request body schema for breakdown endpoints with filters
 * Combines filters + optional pagination overrides
 */
export const BreakdownRequestSchema = Type.Object({
  startDate: Type.String({ format: 'date' }),
  endDate: Type.String({ format: 'date' }),
  userIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  modelIds: Type.Optional(Type.Array(Type.String())),
  providerIds: Type.Optional(Type.Array(Type.String())),
  apiKeyIds: Type.Optional(Type.Array(Type.String())),
});

// Export types
export type PaginationQuery = Static<typeof PaginationQuerySchema>;
export type BreakdownRequest = Static<typeof BreakdownRequestSchema>;
```

**Update ExportQuerySchema** (line 83):

```typescript
// Change from current implementation to split query/body
export const ExportRequestSchema = Type.Object({
  startDate: Type.String({ format: 'date' }),
  endDate: Type.String({ format: 'date' }),
  format: Type.Optional(
    Type.Union([Type.Literal('csv'), Type.Literal('json')], {
      default: 'csv',
    }),
  ),
  userIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  modelIds: Type.Optional(Type.Array(Type.String())),
  providerIds: Type.Optional(Type.Array(Type.String())),
  apiKeyIds: Type.Optional(Type.Array(Type.String())),
});

export type ExportRequest = Static<typeof ExportRequestSchema>;
```

**Validation**:

```bash
npm --prefix backend run typecheck
# Expected: No errors
```

---

### Step Pre-2.2: Update Backend Route Handlers (1 hour)

**File**: `backend/src/routes/admin-usage.ts`

#### 2.2.1: Update `/by-user` endpoint (Line 207)

**Before**:

```typescript
fastify.get<{
  Querystring: AdminUsageFilters & {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}>('/by-user', {
  schema: {
    querystring: AdminUsageFiltersWithPaginationSchema,
    // ...
  },
  handler: async (request, reply) => {
    const queryFilters = request.query;
    // ...
  },
});
```

**After**:

```typescript
fastify.post<{
  Body: AdminUsageFilters;
  Querystring: PaginationQuery;
}>('/by-user', {
  schema: {
    tags: ['Admin Usage Analytics'],
    summary: 'Get paginated usage breakdown by user',
    description:
      'Get detailed usage metrics broken down by user with pagination and sorting support. Requires admin or adminReadonly role.',
    security: [{ bearerAuth: [] }],
    body: BreakdownRequestSchema,
    querystring: PaginationQuerySchema,
    response: {
      200: UserBreakdownResponseSchema,
      400: AdminUsageErrorResponseSchema,
      401: AdminUsageErrorResponseSchema,
      403: AdminUsageErrorResponseSchema,
      429: AdminUsageErrorResponseSchema,
      500: AdminUsageErrorResponseSchema,
    },
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const bodyFilters = request.body; // ← Changed from request.query
    const paginationQuery = request.query; // ← New: pagination from query
    let filters: AdminUsageFilters | undefined;

    try {
      // Use date strings directly (no timezone conversion)
      const startDate = bodyFilters.startDate; // ← Changed
      const endDate = bodyFilters.endDate; // ← Changed

      // Validate date range size
      const validation = validateDateRangeWithWarning(
        startDate,
        endDate,
        ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS,
        ADMIN_USAGE_LIMITS.WARNING_DATE_RANGE_DAYS,
      );

      if (!validation.valid) {
        const suggestedRanges = suggestDateRanges(
          startDate,
          endDate,
          ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS,
        );

        return reply.code(400).send({
          error: validation.error,
          code: validation.code,
          details: {
            requestedDays: validation.days,
            maxAllowedDays: ADMIN_USAGE_LIMITS.MAX_DATE_RANGE_DAYS,
            suggestion: `Break your request into ${suggestedRanges.length} smaller date ranges`,
            suggestedRanges: suggestedRanges.slice(0, 4),
          },
        });
      }

      // Log warning for large ranges
      if (validation.warning) {
        fastify.log.warn(
          {
            userId: authRequest.user?.userId,
            startDate,
            endDate,
            rangeInDays: validation.days,
            endpoint: '/by-user',
          },
          'Large date range requested for user breakdown',
        );
      }

      // Create filters object with string dates
      filters = {
        startDate,
        endDate,
        userIds: bodyFilters.userIds, // ← Changed
        modelIds: bodyFilters.modelIds, // ← Changed
        providerIds: bodyFilters.providerIds, // ← Changed
        apiKeyIds: bodyFilters.apiKeyIds, // ← New
      };

      // Extract pagination parameters from query
      const paginationParams = {
        page: paginationQuery.page,
        limit: paginationQuery.limit,
        sortBy: paginationQuery.sortBy,
        sortOrder: paginationQuery.sortOrder,
      };

      fastify.log.info(
        {
          adminUser: authRequest.user?.userId,
          filters: bodyFilters,
          pagination: paginationParams,
          action: 'get_user_breakdown',
        },
        'Admin requested user breakdown with pagination',
      );

      const result = await adminUsageStatsService.getUserBreakdown(filters, paginationParams);
      const serializedResult = serializeDates(result);

      return reply.code(200).send(serializedResult);
    } catch (error) {
      fastify.log.error(
        {
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          adminUser: authRequest.user?.userId,
          filters: filters || bodyFilters,
        },
        'Failed to get user breakdown',
      );

      return reply.code(500).send({
        error: 'Internal server error while retrieving user breakdown',
        code: 'USER_BREAKDOWN_FAILED',
      });
    }
  },
});
```

#### 2.2.2: Update `/by-model` endpoint (Line 352)

Apply same pattern as above:

- Change `fastify.get` to `fastify.post`
- Change `Querystring` to `Body` + separate `Querystring` for pagination
- Update schema to use `BreakdownRequestSchema` and `PaginationQuerySchema`
- Change `request.query` to `request.body` for filters
- Add `request.query` for pagination params

#### 2.2.3: Update `/by-provider` endpoint (Line 494)

Apply same pattern as above.

#### 2.2.4: Update `/export` endpoint (Line 632)

**Special case**: Export only needs filters in body, format can stay in query or move to body.

**Recommended approach** - Move everything to body:

```typescript
fastify.post<{
  Body: ExportRequest;
}>('/export', {
  schema: {
    tags: ['Admin Usage Analytics'],
    summary: 'Export usage data',
    description: 'Export comprehensive usage data in CSV or JSON format. Requires admin or adminReadonly role.',
    security: [{ bearerAuth: [] }],
    body: ExportRequestSchema,
    response: {
      200: {
        type: 'string',
        description: 'File download (CSV or JSON)',
      },
      400: AdminUsageErrorResponseSchema,
      401: AdminUsageErrorResponseSchema,
      403: AdminUsageErrorResponseSchema,
      429: AdminUsageErrorResponseSchema,
      500: AdminUsageErrorResponseSchema,
    },
  },
  preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  handler: async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const exportRequest = request.body;  // ← Changed from request.query

    try {
      // Rest of handler logic...
      const { startDate, endDate, format, userIds, modelIds, providerIds, apiKeyIds } = exportRequest;

      // ... existing validation and export logic
    }
  }
});
```

**Validation**:

```bash
# Check TypeScript compilation
npm --prefix backend run typecheck

# Check linting
npm --prefix backend run lint
```

---

### Step Pre-2.3: Update Backend Integration Tests (45 minutes)

**File**: `backend/tests/integration/admin-usage-pagination.test.ts`

**Changes**: Update all test cases from GET to POST (45+ occurrences)

**Pattern**:

**Before**:

```typescript
const response = await app.inject({
  method: 'GET',
  url: '/api/v1/admin/usage/by-user?startDate=2024-01-01&endDate=2024-01-31&page=1&limit=10',
  headers: {
    Authorization: `Bearer ${adminToken}`,
  },
});
```

**After**:

```typescript
const response = await app.inject({
  method: 'POST',
  url: '/api/v1/admin/usage/by-user?page=1&limit=10',
  headers: {
    Authorization: `Bearer ${adminToken}`,
  },
  payload: {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  },
});
```

**All affected test cases** (search for `method: 'GET'` and `/by-user|/by-model|/by-provider`):

- Lines 44-50: Default pagination test
- Lines 80-86: Custom page parameter test
- Lines 97-103: Custom limit parameter test
- Lines 113-119: Invalid page test
- Lines 129-135: Limit exceeds max test
- Lines 145-151: Default limit test
- Lines 162-168: Empty results test
- Lines 183-189: Sort by totalTokens test
- Lines 205-211: Sort by username test
- Lines 227-233: Sort by totalRequests test
- Lines 249-255: Invalid sort field test
- Lines 266-272: Invalid sort order test
- Lines 297-303: Valid sort fields loop
- Lines 313-319: Model breakdown pagination test
- Lines 332-338: Model breakdown limit test
- Lines 358-364: Model breakdown sort fields loop
- Lines 373-379: Provider breakdown pagination test
- Lines 392-398: Provider breakdown limit test
- Lines 418-424: Provider breakdown sort fields loop
- Lines 435-441: Large date range test
- Lines 457-463: Multiple pages test
- Lines 476-502: Last page test
- Lines 516-536: No duplicate data test
- Lines 555-574: Sorting consistency across pages test

**Helper for bulk update**:

```bash
# Use sed to help with pattern replacement (review each change!)
sed -i "s/method: 'GET',$/method: 'POST',/" backend/tests/integration/admin-usage-pagination.test.ts

# Then manually add payload for each test case
```

**Validation**:

```bash
npm --prefix backend test admin-usage-pagination.test.ts
# Expected: All tests passing
```

---

### Step Pre-2.4: Update Frontend Service Layer (30 minutes)

**File**: `frontend/src/services/adminUsage.service.ts`

#### 4.1: Update `getUserBreakdown()` (Line 226)

**Before**:

```typescript
async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  if (filters.userIds) {
    filters.userIds.forEach((id) => params.append('userIds[]', id));
  }
  if (filters.modelIds) {
    filters.modelIds.forEach((id) => params.append('modelIds[]', id));
  }
  if (filters.providerIds) {
    filters.providerIds.forEach((id) => params.append('providerIds[]', id));
  }

  const response = await apiClient.get<{ users: UserBreakdown[]; total: number }>(
    `/admin/usage/by-user?${params.toString()}`,
  );
  return response.users;
}
```

**After**:

```typescript
async getUserBreakdown(
  filters: AdminUsageFilters,
  pagination?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
): Promise<{ data: UserBreakdown[]; pagination: PaginationMetadata }> {
  // Build query params for pagination only
  const params = new URLSearchParams();
  if (pagination?.page) params.set('page', pagination.page.toString());
  if (pagination?.limit) params.set('limit', pagination.limit.toString());
  if (pagination?.sortBy) params.set('sortBy', pagination.sortBy);
  if (pagination?.sortOrder) params.set('sortOrder', pagination.sortOrder);

  // Send filters in body
  const response = await apiClient.post<{
    data: UserBreakdown[];
    pagination: PaginationMetadata;
  }>(`/admin/usage/by-user${params.toString() ? '?' + params.toString() : ''}`, {
    startDate: filters.startDate,
    endDate: filters.endDate,
    userIds: filters.userIds,
    modelIds: filters.modelIds,
    providerIds: filters.providerIds,
    apiKeyIds: filters.apiKeyIds,
  });

  return response;
}
```

**Add type definition**:

```typescript
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
```

#### 4.2: Update `getModelBreakdown()` (Line 249)

Apply same pattern as `getUserBreakdown()`.

#### 4.3: Update `getProviderBreakdown()` (Line 272)

Apply same pattern as `getUserBreakdown()`.

#### 4.4: Update `exportUsageData()` (Line 298)

**Before**:

```typescript
async exportUsageData(filters: AdminUsageFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    format,
  });

  if (filters.userIds) {
    filters.userIds.forEach((id) => params.append('userIds[]', id));
  }
  if (filters.modelIds) {
    filters.modelIds.forEach((id) => params.append('modelIds[]', id));
  }
  if (filters.providerIds) {
    filters.providerIds.forEach((id) => params.append('providerIds[]', id));
  }

  const response = await fetch(`/api/v1/admin/usage/export?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export usage data');
  }

  return response.blob();
}
```

**After**:

```typescript
async exportUsageData(filters: AdminUsageFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
  const response = await fetch(`/api/v1/admin/usage/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
    body: JSON.stringify({
      startDate: filters.startDate,
      endDate: filters.endDate,
      format,
      userIds: filters.userIds,
      modelIds: filters.modelIds,
      providerIds: filters.providerIds,
      apiKeyIds: filters.apiKeyIds,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to export usage data');
  }

  return response.blob();
}
```

**Validation**:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run lint
```

---

### Step Pre-2.5: Update Frontend Test Mocks (15 minutes)

**File**: `frontend/src/test/mocks/handlers.ts`

Find MSW handlers for admin usage endpoints and update from `rest.get` to `rest.post`:

**Before**:

```typescript
rest.get('/api/v1/admin/usage/by-user', (req, res, ctx) => {
  // Mock handler
}),
rest.get('/api/v1/admin/usage/by-model', (req, res, ctx) => {
  // Mock handler
}),
rest.get('/api/v1/admin/usage/by-provider', (req, res, ctx) => {
  // Mock handler
}),
rest.get('/api/v1/admin/usage/export', (req, res, ctx) => {
  // Mock handler
}),
```

**After**:

```typescript
rest.post('/api/v1/admin/usage/by-user', (req, res, ctx) => {
  const { startDate, endDate, userIds, modelIds, providerIds } = req.body;
  const page = req.url.searchParams.get('page') || '1';
  const limit = req.url.searchParams.get('limit') || '50';
  // Mock handler implementation
}),
rest.post('/api/v1/admin/usage/by-model', (req, res, ctx) => {
  // Same pattern
}),
rest.post('/api/v1/admin/usage/by-provider', (req, res, ctx) => {
  // Same pattern
}),
rest.post('/api/v1/admin/usage/export', (req, res, ctx) => {
  // Same pattern
}),
```

---

### Step Pre-2.6: Update Frontend Component Tests (30 minutes)

**Files**:

- `frontend/src/test/components/admin/ExportModal.test.tsx`
- `frontend/src/test/components/AdminUsagePage.test.tsx`

**Changes**: Update test assertions to expect POST calls instead of GET.

**Validation**:

```bash
npm --prefix frontend test ExportModal.test.tsx
npm --prefix frontend test AdminUsagePage.test.tsx
```

---

### Step Pre-2.7: Update API Documentation (45 minutes)

**File**: `docs/api/rest-api.md`

#### 7.1: Add Pagination Overview Section (Before Line 1568)

Insert new section documenting pagination for breakdown endpoints:

````markdown
#### Pagination Support for Breakdown Endpoints

All breakdown endpoints (`/by-user`, `/by-model`, `/by-provider`) support pagination and sorting via a hybrid approach:

- **Pagination parameters**: Passed via query string (cacheable, bookmarkable)
- **Filter data**: Passed via request body (unlimited array sizes)

This design prevents URL overflow while maintaining the benefits of query parameters for pagination state.

##### Common Pagination Query Parameters

All breakdown endpoints accept these optional query parameters:

| Parameter   | Type    | Default       | Description                                 |
| ----------- | ------- | ------------- | ------------------------------------------- |
| `page`      | integer | 1             | Page number (1-indexed, minimum: 1)         |
| `limit`     | integer | 50            | Items per page (minimum: 1, maximum: 200)   |
| `sortBy`    | string  | `totalTokens` | Field to sort by (see allowed fields below) |
| `sortOrder` | string  | `desc`        | Sort direction: `asc` or `desc`             |

##### Pagination Response Format

All paginated endpoints return:

```json
{
  "data": [...],  // Array of breakdown items for current page
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,        // Total number of items across all pages
    "totalPages": 5,     // Total number of pages
    "hasNext": true,     // Whether there is a next page
    "hasPrevious": false // Whether there is a previous page
  }
}
```
````

##### Allowed Sort Fields

**User Breakdown** (`/by-user`):

- `username` - Sort by username (alphabetical)
- `totalRequests` - Sort by total request count
- `totalTokens` - Sort by total token count (default)
- `promptTokens` - Sort by prompt tokens
- `completionTokens` - Sort by completion tokens
- `totalCost` - Sort by total cost

**Model Breakdown** (`/by-model`):

- `modelName` - Sort by model name (alphabetical)
- `totalRequests` - Sort by total request count
- `totalTokens` - Sort by total token count (default)
- `promptTokens` - Sort by prompt tokens
- `completionTokens` - Sort by completion tokens
- `totalCost` - Sort by total cost

**Provider Breakdown** (`/by-provider`):

- `providerName` - Sort by provider name (alphabetical)
- `totalRequests` - Sort by total request count
- `totalTokens` - Sort by total token count (default)
- `promptTokens` - Sort by prompt tokens
- `completionTokens` - Sort by completion tokens
- `totalCost` - Sort by total cost

##### Pagination Error Responses

**400 Bad Request** - Invalid pagination parameters:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Page number must be >= 1",
  "details": {
    "field": "page",
    "value": 0
  }
}
```

**400 Bad Request** - Invalid sort field:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid sort field: invalidField",
  "details": {
    "field": "sortBy",
    "value": "invalidField",
    "allowedFields": ["username", "totalRequests", "totalTokens", ...]
  }
}
```

##### Best Practices

1. **Use appropriate page sizes**:
   - Small tables: `limit=25`
   - Medium tables: `limit=50` (default)
   - Large tables: `limit=100`
   - Never exceed: `limit=200`

2. **Always sort by a meaningful field**:
   - Default (`totalTokens`) shows highest-impact users/models
   - Sort by name fields for alphabetical navigation
   - Sort by cost for budget analysis

3. **Handle pagination metadata**:
   - Use `hasNext`/`hasPrevious` to enable/disable navigation buttons
   - Use `totalPages` to show page count
   - Use `total` to show "Showing X-Y of Z results"

4. **Performance considerations**:
   - Smaller page sizes = faster response times
   - Sorting is in-memory (fast for < 10K records)
   - Results are cached per date range

5. **Array filters in request body**:
   - Always send filter arrays (`userIds`, `modelIds`, etc.) in request body
   - Never attempt to send large arrays via query parameters
   - Maximum recommended: 1000 items per filter array

````

#### 7.2: Update Individual Endpoint Documentation (Lines 1568-1675)

**For each endpoint** (`/by-user`, `/by-model`, `/by-provider`):

1. Change method from `GET` to `POST`
2. Split parameters into Query Parameters (pagination) and Request Body (filters)
3. Update response format to show paginated structure
4. Add example requests with both query and body

**Example for `/by-user`** (replace lines 1568-1603):

```markdown
#### POST /api/v1/admin/usage/by-user

**Authorization**: Requires `admin` or `adminReadonly` role

Get usage metrics broken down by user with pagination and sorting support.

**Query Parameters**:
- `page`: integer (optional, default: 1) - Page number
- `limit`: integer (optional, default: 50, max: 200) - Items per page
- `sortBy`: string (optional, default: 'totalTokens') - Field to sort by
- `sortOrder`: string (optional, default: 'desc') - Sort direction ('asc' or 'desc')

**Allowed `sortBy` values**: `username`, `totalRequests`, `totalTokens`, `promptTokens`, `completionTokens`, `totalCost`

**Request Body**:
```json
{
  "startDate": "2024-01-01",          // Required: YYYY-MM-DD
  "endDate": "2024-01-31",            // Required: YYYY-MM-DD
  "userIds": ["uuid1", "uuid2"],      // Optional: Filter by user UUIDs
  "modelIds": ["gpt-4", "gpt-3.5"],   // Optional: Filter by model IDs
  "providerIds": ["openai", "azure"], // Optional: Filter by provider IDs
  "apiKeyIds": ["key1", "key2"]       // Optional: Filter by API key IDs
}
````

**Example Request**:

```bash
POST /api/v1/admin/usage/by-user?page=1&limit=50&sortBy=totalTokens&sortOrder=desc
Content-Type: application/json
Authorization: Bearer {token}

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "userIds": ["uuid1", "uuid2"],
  "modelIds": ["gpt-4"]
}
```

**Response**:

```json
{
  "data": [
    {
      "userId": "uuid",
      "username": "john.doe",
      "email": "john@example.com",
      "role": "user",
      "metrics": {
        "requests": 1500,
        "tokens": {
          "total": 300000,
          "prompt": 220000,
          "completion": 80000
        },
        "cost": 45.5,
        "lastActive": "2024-01-31T15:30:00Z"
      }
    }
    // ... up to 50 users
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

````

**Apply similar changes for**:
- `/by-model` (lines 1605-1640)
- `/by-provider` (lines 1642-1675)

#### 7.3: Update Export Endpoint Documentation (Lines 1677-1694)

Change to POST with body:

```markdown
#### POST /api/v1/admin/usage/export

**Authorization**: Requires `admin` or `adminReadonly` role

Export comprehensive usage data in CSV or JSON format.

**Request Body**:
```json
{
  "startDate": "2024-01-01",          // Required: YYYY-MM-DD
  "endDate": "2024-01-31",            // Required: YYYY-MM-DD
  "format": "csv",                    // Optional: "csv" or "json" (default: "csv")
  "userIds": ["uuid1", "uuid2"],      // Optional: Filter by user UUIDs
  "modelIds": ["gpt-4"],              // Optional: Filter by model IDs
  "providerIds": ["openai"],          // Optional: Filter by provider IDs
  "apiKeyIds": ["key1"]               // Optional: Filter by API key IDs
}
````

**Response**: File download with appropriate Content-Type and Content-Disposition headers

- Filename format: `admin-usage-export-{startDate}-to-{endDate}.{format}`
- Content-Type: `text/csv` or `application/json`

**Example Request**:

```bash
POST /api/v1/admin/usage/export
Content-Type: application/json
Authorization: Bearer {token}

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "format": "csv",
  "userIds": ["uuid1", "uuid2"]
}
```

````

---

### Step Pre-2.8: Update Refactor Plan Documents (15 minutes)

#### 8.1: Update Phase 2A Plan

**File**: `docs/development/refactor/phase-2-session-2a-backend-pagination.md`

**Changes**:
- Line 71: Confirm POST pattern is correct
- Add note about URL overflow risk
- Reference this pre-2 plan for historical context

Add note at line 71:
```markdown
**Note**: This plan correctly specified POST method to avoid URL overflow with array parameters.
The initial implementation incorrectly used GET, which was corrected in [Phase Pre-2](./phase-pre-2-fix-http-method-inconsistency.md).
````

#### 8.2: Update Phase 2B Plan

**File**: `docs/development/refactor/phase-2-session-2b-frontend-pagination.md`

**Changes**:

- Update all frontend service examples to use POST
- Update fetch examples to show request body
- Reference Phase Pre-2 for POST requirement

Add note at top of session objectives:

```markdown
**Prerequisites**: Phase Pre-2 must be completed first to convert endpoints from GET to POST.
```

---

## Validation & Testing

### Backend Validation

```bash
# Type checking
npm --prefix backend run typecheck

# Linting
npm --prefix backend run lint

# Unit tests (pagination utilities)
npm --prefix backend test pagination.utils.test.ts

# Integration tests (all endpoints)
npm --prefix backend test admin-usage-pagination.test.ts

# Manual API testing
curl -X POST "http://localhost:8081/api/v1/admin/usage/by-user?page=1&limit=10&sortBy=totalTokens&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "userIds": ["uuid1", "uuid2"]
  }'
```

### Frontend Validation

```bash
# Type checking
npm --prefix frontend run typecheck

# Linting
npm --prefix frontend run lint

# Component tests
npm --prefix frontend test ExportModal.test.tsx
npm --prefix frontend test AdminUsagePage.test.tsx

# Full test suite
npm --prefix frontend test
```

### Manual End-to-End Testing

1. **Test with small filter arrays** (< 10 items):
   - Verify pagination works
   - Verify sorting works
   - Verify filters apply correctly

2. **Test with large filter arrays** (100+ items):
   - Send 100+ userIds in request body
   - Verify no 414 errors
   - Verify response includes correct filtered data

3. **Test export with large filters**:
   - Export with 100+ userIds
   - Verify CSV/JSON download works
   - Verify file contains filtered data

4. **Test error cases**:
   - Invalid pagination params (page=0, limit=500)
   - Invalid sort field
   - Invalid date range

---

## Acceptance Criteria

### Must Have ✅

- [ ] All 4 endpoints converted from GET to POST
- [ ] Pagination params in query string
- [ ] Filter arrays in request body
- [ ] All backend tests passing (45+ test cases)
- [ ] All frontend tests passing
- [ ] API documentation updated
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Manual testing with 100+ filter items succeeds

### Should Have ✅

- [ ] Refactor plan documents updated
- [ ] Comprehensive pagination documentation added
- [ ] Error response examples documented
- [ ] Best practices guide included

### Nice to Have 🎯

- [ ] Performance benchmarks with large filter arrays
- [ ] Cache key strategy documented for POST endpoints
- [ ] Migration guide for API consumers

---

## Rollback Plan

If issues arise:

1. **Revert backend routes**: Change POST back to GET
2. **Revert frontend services**: Change POST back to GET
3. **Revert tests**: Change method back to GET
4. **Keep schemas**: No harm in keeping new schemas

**Git Commands**:

```bash
# Revert specific files
git checkout HEAD -- backend/src/routes/admin-usage.ts
git checkout HEAD -- frontend/src/services/adminUsage.service.ts
git checkout HEAD -- backend/tests/integration/admin-usage-pagination.test.ts
```

---

## Timeline

**Total Estimated Duration**: 4-5 hours

| Step                       | Duration | Dependencies     |
| -------------------------- | -------- | ---------------- |
| Pre-2.1: Backend Schemas   | 30 min   | None             |
| Pre-2.2: Backend Routes    | 1 hour   | Pre-2.1          |
| Pre-2.3: Backend Tests     | 45 min   | Pre-2.2          |
| Pre-2.4: Frontend Services | 30 min   | Pre-2.2          |
| Pre-2.5: Frontend Mocks    | 15 min   | Pre-2.4          |
| Pre-2.6: Frontend Tests    | 30 min   | Pre-2.4, Pre-2.5 |
| Pre-2.7: API Documentation | 45 min   | None             |
| Pre-2.8: Refactor Docs     | 15 min   | None             |
| **Validation & Testing**   | 30 min   | All steps        |

---

## Success Metrics

**Before Fix**:

- ❌ URL length: 3,600+ chars with 100 userIds
- ❌ 414 errors with large filter arrays
- ❌ Inconsistent HTTP methods across endpoints

**After Fix**:

- ✅ URL length: ~150 chars (pagination only)
- ✅ No URL length limits (filters in body)
- ✅ Consistent POST method for all filtered endpoints
- ✅ All tests passing
- ✅ Can filter by 1,000+ users without errors

---

## Notes

**Why POST for Read Operations?**

While GET is semantically correct for read operations, POST is acceptable when:

1. Request data is too large for URL (RFC 7231 allows it)
2. Request contains sensitive data
3. Request structure is complex (nested arrays/objects)

**Precedent**: Many APIs use POST for complex queries:

- Elasticsearch `_search` API
- GraphQL queries
- SQL query APIs
- Analytics query APIs (like ours)

**Alternative Considered**: GraphQL - Would solve this problem but requires complete API redesign.

---

**End of Phase Pre-2 Plan**

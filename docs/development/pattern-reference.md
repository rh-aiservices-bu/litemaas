# LiteMaaS Pattern Reference Guide

> **⚠️ CRITICAL**: This document contains the authoritative patterns for LiteMaaS development. All new features MUST follow these established patterns rather than creating new ones.

## Table of Contents

1. [Pattern Discovery Commands](#pattern-discovery-commands)
2. [Backend Patterns](#backend-patterns)
3. [Frontend Patterns](#frontend-patterns)
4. [Error Handling Patterns](#error-handling-patterns)
5. [Testing Patterns](#testing-patterns)
6. [Common Anti-Patterns](#common-anti-patterns)

## Pattern Discovery Commands

Before implementing ANY new feature, use these commands to find existing implementations:

```bash
# Find similar services/components
find_symbol "ServiceName"
find_symbol "ComponentName"

# Search for patterns in code
search_for_pattern "functionality keyword"
search_for_pattern "similar feature"

# Check existing structure
list_dir backend/src/services false
list_dir frontend/src/pages false
list_dir frontend/src/components false

# Review memory files for conventions
read_memory code_style_conventions
read_memory error_handling_architecture
```

## Backend Patterns

### Service Layer Pattern

**MANDATORY**: All services MUST extend `BaseService`

```typescript
// ✅ CORRECT - Service extending BaseService
import { BaseService } from './base.service';
import { ApplicationError } from '../utils/errors';

export class UserService extends BaseService {
  constructor() {
    super('UserService');
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    // 1. Use built-in validation helpers
    this.validateRequiredFields(userData, ['email', 'name', 'teamId']);
    this.validateEmail(userData.email);
    this.validateUUID(userData.teamId);

    // 2. Use transaction wrapper for multiple operations
    return await this.executeTransaction(async (client) => {
      // 3. Use query helpers with proper error mapping
      const user = await this.executeQueryOne<User>(
        'INSERT INTO users (email, name, team_id) VALUES ($1, $2, $3) RETURNING *',
        [userData.email, userData.name, userData.teamId],
        client,
      );

      // 4. Audit logging for important operations
      await this.logAudit('USER_CREATED', user.id, { email: userData.email });

      return user;
    });
  }

  async getUserById(userId: string): Promise<User> {
    this.validateUUID(userId);

    const user = await this.executeQueryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);

    if (!user) {
      // 5. Use ApplicationError factory methods
      throw ApplicationError.notFound('User', userId, 'Check the user ID and try again');
    }

    return user;
  }
}

// ❌ WRONG - Service without BaseService
export class UserService {
  async createUser(userData: any) {
    // No validation!
    // Direct database access!
    // No error mapping!
    const result = await db.query('INSERT INTO users...', [userData]);
    return result;
  }
}
```

### Service Decomposition Pattern

**When to Use**: When a service exceeds 500 lines or has multiple responsibilities.

**Pattern**: Decompose into specialized services with a main orchestrator service.

```typescript
// ❌ ANTI-PATTERN: Monolithic service
export class AdminUsageStatsService extends BaseService {
  // 2,833 lines of mixed concerns
  async getAnalytics() {
    // Fetching data from LiteLLM
    const data = await this.liteLLMService.getData();

    // Enriching with user mappings (500 lines of logic)
    const enriched = this.enrichWithUserMapping(data);

    // Aggregating (300 lines of logic)
    const aggregated = this.aggregateData(enriched);

    // Calculating trends (200 lines of logic)
    const trends = this.calculateTrends(aggregated);

    // Generating charts (200 lines of logic)
    const charts = this.generateCharts(aggregated);

    // Exporting data (150 lines of logic)
    // ... 200 more lines ...
  }

  // ... 200 more methods with mixed responsibilities
}

// ✅ CORRECT PATTERN: Specialized services with orchestrator
// Main orchestrator (~500 lines)
export class AdminUsageStatsService extends BaseService {
  private aggregationService: AdminUsageAggregationService;
  private enrichmentService: AdminUsageEnrichmentService;
  private trendCalculator: AdminUsageTrendCalculator;
  private exportService: AdminUsageExportService;

  constructor(
    fastify: FastifyInstance,
    liteLLMService: LiteLLMService,
    cacheManager?: IDailyUsageCacheManager,
  ) {
    super(fastify);

    // Initialize specialized services
    this.aggregationService = new AdminUsageAggregationService(fastify);
    this.enrichmentService = new AdminUsageEnrichmentService(fastify);
    this.trendCalculator = new AdminUsageTrendCalculator(fastify);
    this.exportService = new AdminUsageExportService(fastify);
  }

  async getAnalytics(filters: AdminUsageFilters): Promise<Analytics> {
    try {
      // 1. Aggregate current period data (delegates to aggregation service)
      const currentData = await this.aggregationService.aggregateUsageData(filters, 'total');

      // 2. Calculate comparison period
      const { comparisonStartDate, comparisonEndDate } = calculateComparisonPeriod(
        filters.startDate,
        filters.endDate,
      );

      // 3. Aggregate comparison period data
      const comparisonData = await this.aggregationService.aggregateUsageData(
        { ...filters, startDate: comparisonStartDate, endDate: comparisonEndDate },
        'total',
      );

      // 4. Calculate totals
      const currentTotals = this.aggregationService.calculateTotals(currentData.data);
      const comparisonTotals = this.aggregationService.calculateTotals(comparisonData.data);

      // 5. Calculate trends (delegates to trend calculator)
      const trends = this.trendCalculator.calculateAllTrends(currentTotals, comparisonTotals);

      // 6. Get top users and models (delegates to aggregation service)
      const topUsers = await this.getTopUsers(filters, 10);
      const topModels = await this.getTopModels(filters, 10);

      // 7. Format and return
      return {
        period: { startDate: filters.startDate, endDate: filters.endDate },
        metrics: currentTotals,
        trends,
        topUsers,
        topModels,
        dataSource: currentData.dataSource,
      };
    } catch (error) {
      throw ApplicationError.fromUnknown(error, 'getting analytics data');
    }
  }

  // Thin wrapper methods that delegate to specialized services
  async getUserBreakdown(filters: AdminUsageFilters): Promise<UserBreakdown[]> {
    const data = await this.aggregationService.aggregateUsageData(filters, 'user');
    return this.enrichmentService.enrichWithUserData(data);
  }

  async exportToCSV(data: any[], filters: AdminUsageFilters): Promise<string> {
    return this.exportService.exportUserBreakdownToCSV(data, filters);
  }
}

// Specialized service example (~400 lines)
export class AdminUsageTrendCalculator extends BaseService {
  /**
   * Calculate all trends between current and comparison period
   */
  calculateAllTrends(current: Metrics, comparison: Metrics): TrendData {
    return {
      requestsTrend: this.calculateTrend('requests', current.requests, comparison.requests),
      costTrend: this.calculateTrend('cost', current.cost, comparison.cost),
      usersTrend: this.calculateTrend('users', current.users, comparison.users),
      // ... other trends
    };
  }

  /**
   * Calculate individual trend with direction and percentage
   */
  private calculateTrend(metric: string, current: number, previous: number): TrendData {
    const percentageChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;

    return {
      metric,
      current,
      previous,
      percentageChange,
      direction: this.determineTrendDirection(percentageChange),
    };
  }

  private determineTrendDirection(change: number): 'up' | 'down' | 'stable' {
    if (Math.abs(change) < 1.0) return 'stable';
    return change > 0 ? 'up' : 'down';
  }
}
```

**Guidelines**:

1. **Main Service as Orchestrator**: Keep main service < 500 lines, focused on workflow coordination
2. **Single Responsibility**: Each specialized service handles one concern (aggregation, enrichment, trends, exports, etc.)
3. **Pure Utilities**: Extract pure functions (no dependencies) to utility modules
4. **Dependency Injection**: Pass dependencies through constructor, not as method parameters
5. **Test Independently**: Each service should be testable in isolation
6. **Clear Naming**: Service names should clearly indicate their responsibility

**Benefits**:

- **Maintainability**: Smaller, focused services are easier to understand and modify
- **Testability**: Each service can be tested independently with clear mocks
- **Reusability**: Specialized services can be reused in different contexts
- **Extensibility**: Easy to add new services without touching existing code
- **Code Quality**: Enforces single responsibility principle, reduces duplication

**File Organization**:

```
backend/src/services/
├── admin-usage-stats.service.ts          (~500 lines) - Main orchestrator
└── admin-usage/
    ├── admin-usage-aggregation.service.ts (~700 lines) - Aggregation logic
    ├── admin-usage-enrichment.service.ts  (~350 lines) - Data enrichment
    ├── admin-usage-trend-calculator.ts    (~400 lines) - Trend calculations
    ├── admin-usage-export.service.ts      (~250 lines) - Export generation
    └── admin-usage.utils.ts               (~400 lines) - Pure utility functions
```

### Route Pattern with RBAC

```typescript
// ✅ CORRECT - Route with proper authentication and validation
import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

const userRoutes: FastifyPluginAsync = async (app) => {
  // Public route - no auth
  app.get('/api/health', async () => {
    return { status: 'healthy' };
  });

  // Authenticated route - user role
  app.get(
    '/api/users/me',
    {
      preHandler: [app.authenticate], // JWT validation
      schema: {
        response: {
          200: UserResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await userService.getUserById(request.user.id);
      return { data: user };
    },
  );

  // Admin route - admin role required
  app.post(
    '/api/admin/users',
    {
      preHandler: [app.authenticate, app.requireRole('admin')],
      schema: {
        body: CreateUserSchema,
        response: {
          201: UserResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await userService.createUser(request.body);
      reply.code(201);
      return { data: user };
    },
  );

  // Admin readonly route
  app.get(
    '/api/admin/users',
    {
      preHandler: [app.authenticate, app.requireRole('adminReadonly')],
      schema: {
        querystring: PaginationSchema,
        response: {
          200: UsersListResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const users = await userService.listUsers(request.query);
      return { data: users };
    },
  );
};
```

### Database Query Patterns

```typescript
// ✅ CORRECT - Using BaseService query helpers
class SubscriptionService extends BaseService {
  async createSubscription(data: CreateSubscriptionRequest) {
    // Single query with automatic error handling
    const subscription = await this.executeQueryOne<Subscription>(
      'INSERT INTO subscriptions (user_id, model_id) VALUES ($1, $2) RETURNING *',
      [data.userId, data.modelId],
    );

    // Multiple results
    const allSubscriptions = await this.executeQuery<Subscription[]>(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [data.userId],
    );

    // Transaction for complex operations
    return await this.executeTransaction(async (client) => {
      // All queries in transaction use the client
      await client.query(
        'UPDATE users SET subscription_count = subscription_count + 1 WHERE id = $1',
        [data.userId],
      );
      const sub = await client.query('INSERT INTO subscriptions...', [data]);
      await client.query('INSERT INTO audit_logs...', [auditData]);
      return sub.rows[0];
    });
  }
}
```

## Frontend Patterns

### Component Structure Pattern

```typescript
// ✅ CORRECT - Standard component structure
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  Button,
  Alert,
  Spinner
} from '@patternfly/react-core';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { userService } from '../services/user.service';
import { ScreenReaderAnnouncement } from '../components/ScreenReaderAnnouncement';

export const UserProfilePage: React.FC = () => {
  // 1. Hooks first
  const { t } = useTranslation();
  const { handleError, handleValidationError } = useErrorHandler();

  // 2. React Query for data fetching
  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => userService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // 3. Mutations for updates
  const updateMutation = useMutation({
    mutationFn: (data: UpdateProfileRequest) => userService.updateProfile(data),
    onSuccess: () => {
      refetch();
      // Show success notification
    },
    onError: (error) => {
      handleValidationError(error);
    }
  });

  // 4. Local state for UI
  const [isEditing, setIsEditing] = useState(false);

  // 5. Handlers
  const handleSave = useCallback(async (formData: UpdateProfileRequest) => {
    try {
      await updateMutation.mutateAsync(formData);
      setIsEditing(false);
    } catch (error) {
      // Error handled by mutation onError
    }
  }, [updateMutation]);

  // 6. Loading state
  if (isLoading) {
    return (
      <div className="pf-v6-u-text-align-center">
        <Spinner size="lg" />
        <ScreenReaderAnnouncement message={t('loading.profile')} />
      </div>
    );
  }

  // 7. Error state
  if (error) {
    return (
      <Alert
        variant="danger"
        title={t('errors.loadingProfile')}
        actionClose={<Button variant="plain" onClick={() => refetch()}>
          {t('retry')}
        </Button>}
      />
    );
  }

  // 8. Main render
  return (
    <Card className="pf-v6-u-mb-lg">
      <CardBody>
        {/* Component content */}
      </CardBody>
    </Card>
  );
};
```

### React Context Pattern

**Use Cases**: Global state like authentication, configuration, notifications. Use React Query for server state instead.

```typescript
// ✅ CORRECT - ConfigContext pattern with proper typing
// File: contexts/ConfigContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { configService } from '../services/config.service';

interface AppConfig {
  usageCacheTtlMinutes: number;
  maxExportRows: number;
  features: {
    adminAnalytics: boolean;
    modelTesting: boolean;
  };
}

interface ConfigContextValue {
  config: AppConfig | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const data = await configService.getConfig();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const value: ConfigContextValue = {
    config,
    isLoading,
    error,
    refetch: fetchConfig,
  };

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

// Custom hook with proper error handling
export const useConfig = (): ConfigContextValue => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

// ✅ CORRECT - Usage in components
const MyComponent: React.FC = () => {
  const { config, isLoading } = useConfig();

  const staleTime = config?.usageCacheTtlMinutes
    ? config.usageCacheTtlMinutes * 60 * 1000
    : 5 * 60 * 1000;

  const { data } = useQuery({
    queryKey: ['usage'],
    queryFn: fetchUsage,
    staleTime, // Use config value
  });

  return <div>{/* ... */}</div>;
};

// ❌ WRONG - Storing server data in Context instead of React Query
const DataContext = createContext<{ users: User[] }>({ users: [] });
// Use React Query for server state instead!

// ❌ WRONG - Missing error handling in useContext hook
export const useConfig = () => {
  return useContext(ConfigContext); // Missing undefined check!
};
```

**When to Use**:

- ✅ Authentication state (AuthContext)
- ✅ Application configuration (ConfigContext)
- ✅ UI notifications (NotificationContext)
- ✅ Theme/locale settings
- ❌ Server data (use React Query)
- ❌ Form state (use local state)

### Form Handling Pattern

```typescript
// ✅ CORRECT - Form with validation and error handling
import { Form, FormGroup, TextInput, FormHelperText } from '@patternfly/react-core';
import { FieldErrors } from '../components/errors';

export const UserForm: React.FC<UserFormProps> = ({ onSubmit }) => {
  const { t } = useTranslation();
  const { handleValidationError } = useErrorHandler();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field validation
  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'email':
        if (!value) return t('validation.required');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return t('validation.invalidEmail');
        }
        break;
      case 'name':
        if (!value) return t('validation.required');
        if (value.length < 2) return t('validation.nameTooShort');
        break;
    }
    return undefined;
  };

  // Handle field change
  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    Object.entries(formData).forEach(([field, value]) => {
      const error = validateField(field, value);
      if (error) newErrors[field] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      handleValidationError(error);
      // Set field-specific errors from server
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <FieldErrors errors={errors} />

      <FormGroup
        label={t('fields.name')}
        isRequired
        fieldId="name"
      >
        <TextInput
          id="name"
          value={formData.name}
          onChange={(_, value) => handleFieldChange('name', value)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <FormHelperText id="name-error" error>
            {errors.name}
          </FormHelperText>
        )}
      </FormGroup>

      <Button
        type="submit"
        variant="primary"
        isLoading={isSubmitting}
        isDisabled={isSubmitting}
      >
        {t('buttons.submit')}
      </Button>
    </Form>
  );
};
```

### Table Pattern with PatternFly 6

```typescript
// ✅ CORRECT - PatternFly 6 table implementation
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableText
} from '@patternfly/react-table';

export const UsersTable: React.FC = () => {
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getAll
  });

  const columnNames = {
    name: t('table.columns.name'),
    email: t('table.columns.email'),
    role: t('table.columns.role'),
    actions: t('table.columns.actions')
  };

  return (
    <Table aria-label={t('tables.users')}>
      <Thead>
        <Tr>
          <Th>{columnNames.name}</Th>
          <Th>{columnNames.email}</Th>
          <Th>{columnNames.role}</Th>
          <Th>{columnNames.actions}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {users?.map(user => (
          <Tr key={user.id}>
            <Td dataLabel={columnNames.name}>
              <TableText>{user.name}</TableText>
            </Td>
            <Td dataLabel={columnNames.email}>
              <TableText>{user.email}</TableText>
            </Td>
            <Td dataLabel={columnNames.role}>
              <TableText>{user.role}</TableText>
            </Td>
            <Td dataLabel={columnNames.actions}>
              <Button variant="link" onClick={() => handleEdit(user.id)}>
                {t('actions.edit')}
              </Button>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};
```

### Chart Component Pattern

**Shared Utilities**: Use `chartFormatters.ts`, `chartConstants.ts`, and `chartAccessibility.ts` for all chart components.

```typescript
// ✅ CORRECT - Using shared utilities
import {
  formatYTickByMetric,
  formatXTickWithSkipping,
  calculateLeftPaddingByMetric,
} from '../../utils/chartFormatters';
import { CHART_PADDING, GRID_STYLES, AXIS_STYLES } from '../../utils/chartConstants';
import { generateChartAriaDescription } from '../../utils/chartAccessibility';

// Use formatters instead of duplicating logic
<ChartAxis
  tickFormat={(value) => formatYTickByMetric(value, metricType)}
  style={{
    tickLabels: { fontSize: AXIS_STYLES.tickLabelFontSize },
    grid: { stroke: GRID_STYLES.stroke, strokeDasharray: GRID_STYLES.strokeDasharray },
  }}
/>

// Use unique SVG filter IDs to avoid conflicts
<filter id="tooltip-shadow-myChart" ... />

// ❌ WRONG - Duplicating formatting logic
const formatYTick = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
};
```

**Full Guide**: See [`chart-components-guide.md`](./chart-components-guide.md)

## Error Handling Patterns

### Backend Error Pattern

```typescript
// ✅ CORRECT - Comprehensive error handling
import { ApplicationError } from '../utils/errors';

export class ApiKeyService extends BaseService {
  async createApiKey(data: CreateApiKeyRequest): Promise<ApiKey> {
    try {
      // Validation with specific errors
      if (!data.name || data.name.length < 3) {
        throw ApplicationError.validation(
          'API key name must be at least 3 characters',
          'name',
          data.name,
          'Provide a descriptive name for the API key',
        );
      }

      // Check for duplicates
      const existing = await this.executeQueryOne(
        'SELECT id FROM api_keys WHERE name = $1 AND user_id = $2',
        [data.name, data.userId],
      );

      if (existing) {
        throw ApplicationError.alreadyExists(
          'API Key',
          'name',
          data.name,
          'Choose a different name for the API key',
        );
      }

      // Create with transaction
      return await this.executeTransaction(async (client) => {
        const apiKey = await this.executeQueryOne<ApiKey>(
          'INSERT INTO api_keys (name, user_id) VALUES ($1, $2) RETURNING *',
          [data.name, data.userId],
          client,
        );

        // External service call with error handling
        try {
          const litellmKey = await this.litellmService.createKey(apiKey.id);
          apiKey.key = litellmKey;
        } catch (error) {
          // Map external service errors
          throw ApplicationError.externalService(
            'LiteLLM',
            error.code,
            'Failed to generate API key',
            true, // retryable
          );
        }

        return apiKey;
      });
    } catch (error) {
      // Re-throw ApplicationError instances
      if (error instanceof ApplicationError) {
        throw error;
      }

      // Map database errors
      throw this.mapDatabaseError(error, 'API key creation');
    }
  }
}
```

### Frontend Error Pattern

```typescript
// ✅ CORRECT - useErrorHandler integration
import { useErrorHandler } from '../hooks/useErrorHandler';

export const ApiKeyPage: React.FC = () => {
  const { handleError, handleValidationError, withErrorHandler } = useErrorHandler();

  // Simple error handling
  const handleDelete = async (id: string) => {
    try {
      await apiKeyService.delete(id);
      refetch();
    } catch (error) {
      handleError(error, {
        context: { operation: 'deleteApiKey', keyId: id },
      });
    }
  };

  // With retry capability
  const handleCreate = withErrorHandler(
    async (data: CreateApiKeyRequest) => {
      const result = await apiKeyService.create(data);
      refetch();
      return result;
    },
    {
      enableRetry: true,
      maxRetries: 3,
      onError: (error, extracted) => {
        if (extracted.code === 'QUOTA_EXCEEDED') {
          // Custom handling for specific errors
          showUpgradeModal();
        }
      },
    },
  );

  // Form validation errors
  const handleFormSubmit = async (data: FormData) => {
    try {
      await apiKeyService.create(data);
    } catch (error) {
      // This will display field-specific errors
      handleValidationError(error);
    }
  };
};
```

## Testing Patterns

### Backend Test Pattern

```typescript
// ✅ CORRECT - Comprehensive test coverage
describe('UserService', () => {
  let userService: UserService;
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    userService = new UserService(mockDb);
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        teamId: 'team-123',
      };

      const result = await userService.createUser(userData);

      expect(result).toMatchObject({
        email: userData.email,
        name: userData.name,
        id: expect.any(String),
      });
    });

    it('should throw validation error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        name: 'Test User',
        teamId: 'team-123',
      };

      await expect(userService.createUser(userData)).rejects.toThrow(ApplicationError);

      try {
        await userService.createUser(userData);
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.details.field).toBe('email');
      }
    });

    it('should handle database constraint violations', async () => {
      mockDb.setError({
        code: '23505', // unique_violation
        constraint: 'users_email_key',
      });

      const userData = {
        email: 'existing@example.com',
        name: 'Test User',
        teamId: 'team-123',
      };

      await expect(userService.createUser(userData)).rejects.toThrow(ApplicationError);

      try {
        await userService.createUser(userData);
      } catch (error) {
        expect(error.code).toBe('ALREADY_EXISTS');
        expect(error.statusCode).toBe(409);
      }
    });
  });
});
```

### Frontend Test Pattern

```typescript
// ✅ CORRECT - Component testing with mocks
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProfilePage } from '../pages/UserProfilePage';

describe('UserProfilePage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          {component}
        </NotificationProvider>
      </QueryClientProvider>
    );
  };

  it('should display user profile', async () => {
    const mockUser = {
      id: '123',
      name: 'Test User',
      email: 'test@example.com'
    };

    // Mock API call
    jest.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);

    renderWithProviders(<UserProfilePage />);

    // Check loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Wait for data
    await waitFor(() => {
      expect(screen.getByText(mockUser.name)).toBeInTheDocument();
      expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    });
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Failed to load profile');
    jest.spyOn(userService, 'getProfile').mockRejectedValue(error);

    renderWithProviders(<UserProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load profile/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
```

## Common Anti-Patterns

### ❌ Backend Anti-Patterns to Avoid

```typescript
// ❌ WRONG - Direct database access without BaseService
const result = await db.query('SELECT * FROM users');

// ❌ WRONG - Generic error throwing
throw new Error('Something went wrong');

// ❌ WRONG - Manual role checking in handlers
if (request.user.role !== 'admin') {
  throw new Error('Unauthorized');
}

// ❌ WRONG - No validation
async function createUser(data) {
  return await db.query('INSERT INTO users...', [data]);
}

// ❌ WRONG - No transaction for multiple operations
await db.query('INSERT INTO subscriptions...', [subData]);
await db.query('UPDATE users...', [userId]); // Could fail!

// ❌ WRONG - No error mapping
catch (error) {
  throw error; // Raw database error exposed to client!
}
```

### ❌ Frontend Anti-Patterns to Avoid

```typescript
// ❌ WRONG - Manual data fetching without React Query
useEffect(() => {
  fetch('/api/users')
    .then(res => res.json())
    .then(setData);
}, []);

// ❌ WRONG - Console.error instead of user notification
catch (error) {
  console.error(error); // User doesn't know something failed!
}

// ❌ WRONG - Alert for errors
catch (error) {
  alert(error.message); // Poor UX!
}

// ❌ WRONG - Hardcoded text
<Button>Submit</Button> // Should use t('buttons.submit')

// ❌ WRONG - Wrong PatternFly prefix
<div className="c-card"> // Should be pf-v6-c-card

// ❌ WRONG - Hardcoded colors
style={{ color: '#0066CC' }} // Use design tokens!

// ❌ WRONG - Missing accessibility
<div onClick={handleClick}>Click me</div> // No keyboard support!
```

## Workflow Commands

### Development Workflow

```bash
# Start development servers
npm run dev

# Run tests with proper stderr handling
./dev-tools/run_with_stderr.sh npm test

# Check for pattern violations
npm run lint
npm run build

# Verify translations
npm run check:translations
```

### Pattern Verification Checklist

Before marking any task complete:

1. ✅ Service extends BaseService (backend)
2. ✅ Uses ApplicationError factory methods
3. ✅ Routes use preHandler for auth/roles
4. ✅ Components use useErrorHandler hook
5. ✅ Data fetching uses React Query
6. ✅ PatternFly 6 prefix (pf-v6-) used
7. ✅ Text uses i18n t() function
8. ✅ Accessibility attributes included
9. ✅ Error scenarios tested
10. ✅ Lint and build pass

## Admin Analytics Patterns

### Day-by-Day Incremental Caching Pattern

**Use Case**: Fetch and cache large datasets efficiently by processing one day at a time.

**Implementation**: `AdminUsageStatsService` + `DailyUsageCacheManager`

```typescript
// ✅ CORRECT - Day-by-day incremental caching with intelligent TTL
export class AdminUsageStatsService extends BaseService {
  async getAnalytics(filters: AdminUsageFilters): Promise<AnalyticsResponse> {
    const { startDate, endDate } = filters;

    // Process each day in the date range
    const allDaysData = [];
    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
      // Check if day is cached
      const cached = await this.cacheManager.getCachedDay(date);

      if (cached && !this.isDayStale(cached, date)) {
        // Use cached data
        allDaysData.push(cached);
      } else {
        // Fetch from LiteLLM
        const rawData = await this.liteLLMService.getDailyActivity(date);

        // Enrich with user mappings
        const enrichedData = await this.enrichWithUserData(rawData);

        // Cache with appropriate TTL
        const isCurrentDay = isSameDay(date, new Date());
        await this.cacheManager.cacheDay(date, enrichedData, !isCurrentDay);

        allDaysData.push(enrichedData);
      }
    }

    // Aggregate all days
    return this.aggregateData(allDaysData, filters);
  }

  private isDayStale(cached: CachedDay, date: Date): boolean {
    const isCurrentDay = isSameDay(date, new Date());
    if (!isCurrentDay) return false; // Historical data never stale

    const FIVE_MINUTES = 5 * 60 * 1000;
    return Date.now() - cached.updated_at.getTime() > FIVE_MINUTES;
  }
}
```

**Benefits**:

- Scales to any date range without memory issues
- Historical data cached permanently, never refetched
- Current day has 5-minute TTL for near-real-time data
- Graceful handling of missing days

**Database Schema**:

```sql
CREATE TABLE daily_usage_cache (
    date DATE PRIMARY KEY,
    raw_data JSONB NOT NULL,
    enriched_data JSONB,
    is_complete BOOLEAN DEFAULT true,  -- false for current day
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

### Filter Cascade Pattern

**Use Case**: Dependent filters where one filter's options depend on another filter's selection.

**Implementation**: `ApiKeyFilterSelect` depends on `UserFilterSelect`

```typescript
// ✅ CORRECT - Cascading filter with dynamic options
export const ApiKeyFilterSelect: React.FC = ({ selectedUserIds, onChange }) => {
  const { config } = useConfig();
  const staleTime = config?.usageCacheTtlMinutes ? config.usageCacheTtlMinutes * 60 * 1000 : 5 * 60 * 1000;

  // Fetch API keys, filtered by selected users
  const { data: apiKeys } = useQuery({
    queryKey: ['admin', 'apiKeys', selectedUserIds],
    queryFn: () => adminUsageService.getFilterOptions({ userIds: selectedUserIds }),
    staleTime,
    enabled: selectedUserIds.length > 0, // Only fetch if users selected
  });

  // Clear selection when user filter changes
  useEffect(() => {
    onChange([]);  // Reset API key selection
  }, [selectedUserIds, onChange]);

  return (
    <Select
      isDisabled={selectedUserIds.length === 0}
      placeholderText={selectedUserIds.length === 0
        ? t('filters.selectUsersFirst')
        : t('filters.selectApiKeys')}
      selections={selectedValue}
      onSelect={handleSelect}
    >
      {apiKeys?.map(key => (
        <SelectOption key={key.id} value={key.id}>
          {key.name}
        </SelectOption>
      ))}
    </Select>
  );
};
```

**Key Aspects**:

- `enabled` prevents unnecessary queries
- Auto-reset dependent filter when parent changes
- User feedback for filter dependencies
- Query key includes parent filter for proper caching

---

### ConfigContext + React Query Integration Pattern

**Use Case**: Dynamic cache TTL from backend configuration instead of hardcoded values.

**Implementation**: ConfigContext provides backend config to React Query hooks

```typescript
// ✅ CORRECT - ConfigContext providing dynamic staleTime
// 1. Backend exposes configuration
// backend/src/routes/config.ts
app.get('/api/v1/config', async (request, reply) => {
  return {
    usageCacheTtlMinutes: parseInt(process.env.USAGE_CACHE_TTL_MINUTES || '5'),
    maxExportRows: parseInt(process.env.MAX_EXPORT_ROWS || '10000'),
    version: process.env.npm_package_version,
  };
});

// 2. Frontend ConfigContext fetches and provides config
// contexts/ConfigContext.tsx
export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    configService.getConfig().then(setConfig);
  }, []);

  return <ConfigContext.Provider value={{ config, isLoading: !config }}>
    {children}
  </ConfigContext.Provider>;
};

// 3. Components use config for dynamic staleTime
// pages/AdminUsagePage.tsx
const { config } = useConfig();
const staleTime = config?.usageCacheTtlMinutes
  ? config.usageCacheTtlMinutes * 60 * 1000
  : 5 * 60 * 1000; // Fallback

const { data } = useQuery({
  queryKey: ['admin', 'usage', filters],
  queryFn: () => adminUsageService.getAnalytics(filters),
  staleTime, // Dynamic from backend!
});
```

**Benefits**:

- Single source of truth (backend environment variable)
- No hardcoded cache durations in frontend
- Easy tuning without redeployment
- Consistent TTL across all admin usage queries

---

### Admin-Only Route Pattern

**Use Case**: Endpoints accessible only to admin/adminReadonly roles.

```typescript
// ✅ CORRECT - Admin route with permission check
fastify.post(
  '/api/v1/admin/usage/analytics',
  {
    schema: {
      tags: ['Admin Usage Analytics'],
      security: [{ bearerAuth: [] }],
      body: AdminUsageFiltersSchema,
      response: {
        200: AnalyticsResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    // Use requirePermission for granular control
    preHandler: [fastify.authenticate, fastify.requirePermission('admin:usage')],
  },
  async (request, reply) => {
    const filters = request.body;
    const analytics = await adminUsageStatsService.getAnalytics(filters);
    return { data: analytics };
  },
);

// ❌ WRONG - Manual role checking in handler
fastify.post('/api/v1/admin/usage/analytics', async (request, reply) => {
  if (!request.user.roles.includes('admin')) {
    throw ApplicationError.forbidden('Admin access required');
  }
  // ... handler logic
});
```

**RBAC Middleware**:

```typescript
// plugins/rbac.ts
fastify.decorate('requirePermission', (permission: string) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    // Check permission based on role
    if (permission === 'admin:usage') {
      const hasAccess = user.roles.includes('admin') || user.roles.includes('adminReadonly');
      if (!hasAccess) {
        throw ApplicationError.forbidden('Admin access required', 'admin');
      }
    }

    // Check for write-only operations
    if (permission === 'admin:write') {
      if (!user.roles.includes('admin')) {
        throw ApplicationError.forbidden('Admin write access required', 'admin');
      }
    }
  };
});
```

---

_This is the authoritative pattern reference for LiteMaaS. Always check existing code and this document before implementing new features._

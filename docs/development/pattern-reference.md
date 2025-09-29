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

---

_This is the authoritative pattern reference for LiteMaaS. Always check existing code and this document before implementing new features._

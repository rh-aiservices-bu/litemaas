# User Roles and Administration

## Overview

LiteMaaS implements a three-tier role-based access control (RBAC) system that governs user permissions and access to system features. This document outlines the role hierarchy, permissions, and administrative capabilities.

## Role Hierarchy

The system implements a strict role hierarchy where users can have multiple roles, but the most powerful role determines their effective permissions:

```
admin > adminReadonly > user
```

### Role Definitions

#### `admin` - System Administrator

- **Full system access**: Can perform all operations in the system
- **User management**: Create, update, deactivate users and manage roles
- **System configuration**: Modify system settings and configurations
- **Data management**: Full CRUD operations on all resources
- **Audit access**: View all system logs and audit trails

#### `adminReadonly` - Read-Only Administrator

- **System visibility**: Can view all data and configurations
- **Audit access**: View all system logs and user activities
- **No modifications**: Cannot create, update, or delete any resources
- **Monitoring**: Can access all dashboards and reports
- **User viewing**: Can view all user information but cannot modify

#### `user` - Standard User

- **Own data only**: Can only access and modify their own resources
- **Standard operations**: Create subscriptions, manage API keys, view usage
- **Self-service**: Update own profile and preferences
- **No system access**: Cannot view other users or system configurations

## Frontend Role Display Implementation

### Role Display Logic

The frontend displays the most powerful role for users with multiple roles using a helper function in the Layout component:

**Location**: `frontend/src/components/Layout.tsx` (lines 61-67)

```typescript
// Helper function to get the most powerful role
const getMostPowerfulRole = (roles: string[]): string => {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('adminReadonly')) return 'adminReadonly';
  if (roles.includes('user')) return 'user';
  return 'user'; // default fallback
};
```

### Usage in UI

**Location**: `frontend/src/components/Layout.tsx` (lines 291-293)

```typescript
<Content component={ContentVariants.h4}>
  {user?.roles ? t('role.' + getMostPowerfulRole(user.roles)) : ''}
</Content>
```

### Translation Support

Role names are translated using the `role` key in translation files across all 9 supported languages:

```json
{
  "role": {
    "admin": "Administrator",
    "adminReadonly": "Administrator (Read-only)",
    "user": "User"
  }
}
```

**Supported Languages**: EN, ES, FR, DE, IT, JA, KO, ZH, ELV (Elvish)

## Role Assignment and Management

### OAuth Integration

Roles are assigned during OAuth authentication based on OpenShift group membership:

```typescript
// OpenShift group to role mapping
const GROUP_ROLE_MAPPING = {
  'litemaas-admins': 'admin',
  'litemaas-readonly': 'adminReadonly',
  'litemaas-users': 'user',
};
```

### Default Assignment

- New users receive `['user']` role by default
- Users must be explicitly added to admin groups for elevated permissions
- Multiple roles can be assigned to a single user

### Role Persistence

Roles are stored in the `users` table as a PostgreSQL array:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  roles TEXT[] DEFAULT ARRAY['user'], -- Role array with default
  -- ... other fields
);
```

## Permissions Matrix

| Feature               | admin | adminReadonly | user |
| --------------------- | ----- | ------------- | ---- |
| **User Management**   |
| View all users        | ✅    | ✅            | ❌   |
| Create/modify users   | ✅    | ❌            | ❌   |
| Assign/modify roles   | ✅    | ❌            | ❌   |
| **Data Access**       |
| View own data         | ✅    | ✅            | ✅   |
| View all user data    | ✅    | ✅            | ❌   |
| Modify own data       | ✅    | ❌            | ✅   |
| Modify all data       | ✅    | ❌            | ❌   |
| **System Operations** |
| System configuration  | ✅    | ❌            | ❌   |
| View system logs      | ✅    | ✅            | ❌   |
| Model synchronization | ✅    | ❌            | ❌   |
| **API Access**        |
| Admin endpoints       | ✅    | Limited       | ❌   |
| User endpoints        | ✅    | ✅            | ✅   |
| System endpoints      | ✅    | ❌            | ❌   |
| **Admin Tools Page**  |
| Access Tools page     | ✅    | ✅            | ❌   |
| Trigger model sync    | ✅    | ❌            | ❌   |
| View sync results     | ✅    | ✅            | ❌   |

## Admin Tools Page Access

The Admin Tools page (`/admin/tools`) provides role-based access to system management tools, with different capabilities for each admin role type.

### Access Control

#### Admin Users (`admin` role)

- **Full access** to the Tools page at `/admin/tools`
- **Can trigger manual model sync**: Refresh button is enabled
- **View detailed sync results**: Access to all sync statistics and error details
- **Real-time sync monitoring**: Can monitor sync progress and receive notifications

#### Admin-Readonly Users (`adminReadonly` role)

- **View-only access** to the Tools page at `/admin/tools`
- **Cannot trigger sync**: Refresh button is disabled with tooltip explanation
- **View sync results**: Can see sync statistics and error details from previous syncs
- **Monitor sync history**: Track when syncs were last performed by admin users

#### Standard Users (`user` role)

- **No access** to the Tools page
- Attempts to navigate to `/admin/tools` result in redirect or 403 error
- Cannot view or interact with any admin settings functionality

### Tools Page Features by Role

| Feature                         | admin | adminReadonly | user |
| ------------------------------- | ----- | ------------- | ---- |
| Access `/admin/tools` page      | ✅    | ✅            | ❌   |
| View Models Management panel    | ✅    | ✅            | ❌   |
| Click "Refresh Models" button   | ✅    | ❌ (disabled) | ❌   |
| See sync progress/loading state | ✅    | ❌            | ❌   |
| View sync statistics            | ✅    | ✅            | ❌   |
| View sync error details         | ✅    | ✅            | ❌   |
| Receive sync notifications      | ✅    | ❌            | ❌   |

### UI Implementation Details

The Tools page implements role-based functionality through conditional rendering:

```typescript
// Check if user has admin permission (not admin-readonly)
const canSync = user?.roles?.includes('admin') ?? false;

// Button is disabled for non-admin users with explanatory tooltip
<Button
  isDisabled={!canSync || isLoading}
  onClick={handleRefreshModels}
>
  {isLoading ? 'Synchronizing models...' : 'Refresh Models from LiteLLM'}
</Button>

// Tooltip for disabled button
{!canSync && (
  <Tooltip content="Admin access required to sync models">
    {syncButton}
  </Tooltip>
)}
```

For complete Tools page documentation, see [Admin Tools Guide](./admin-tools.md).

## API Role Requirements

### Admin-Only Endpoints

```
GET    /api/v1/admin/users           # List all users (admin + adminReadonly)
POST   /api/v1/admin/users           # Create user (admin only)
PUT    /api/v1/admin/users/:id       # Update user (admin only)
DELETE /api/v1/admin/users/:id       # Delete user (admin only)
POST   /api/v1/admin/sync/models     # Sync models (admin only)
GET    /api/v1/admin/system/status   # System status (admin + adminReadonly)
```

### Role-Based Filtering

- **Standard endpoints**: Users can only access their own resources
- **Admin endpoints**: Return all data for administrators
- **Read-only admins**: Can access view endpoints but not modification endpoints

## UI Conditional Rendering

### Navigation Menu

Admin features are conditionally displayed based on user roles:

```typescript
// Navigation configuration with role requirements
const adminNavItems = [
  {
    id: 'users',
    label: 'nav.admin.users',
    path: '/admin/users',
    icon: UsersIcon,
    requiredRoles: ['admin', 'adminReadonly'], // Visible to both admin types
  },
];
```

### Component-Level Access Control

```typescript
// Example: Admin panel only visible to admins
{user?.roles?.includes('admin') && (
  <AdminControlPanel />
)}

// Example: Read-only admin see view-only version
{user?.roles?.some(role => ['admin', 'adminReadonly'].includes(role)) && (
  <SystemStatusView readOnly={!user.roles.includes('admin')} />
)}
```

## New User Defaults

When a user logs in for the first time via OAuth, their account is created with default values regardless of their assigned role. These defaults ensure consistent initial experience and can be customized for different environments.

### Default Values Applied

All new users receive the following default limits:

| Setting    | Default Value | Description                    |
| ---------- | ------------- | ------------------------------ |
| Max Budget | $100 USD      | Maximum spending limit         |
| TPM Limit  | 1000          | Tokens per minute rate limit   |
| RPM Limit  | 60            | Requests per minute rate limit |

### Configuration

These defaults are configurable via environment variables:

```bash
# Production settings - higher limits
DEFAULT_USER_MAX_BUDGET=500
DEFAULT_USER_TPM_LIMIT=5000
DEFAULT_USER_RPM_LIMIT=300

# Development settings - conservative limits
DEFAULT_USER_MAX_BUDGET=50
DEFAULT_USER_TPM_LIMIT=500
DEFAULT_USER_RPM_LIMIT=30
```

See [Configuration Guide](../deployment/configuration.md#default-user-values) for complete documentation.

### Role Independence

These default values are applied **regardless of user role**:

- **Admin users** get the same defaults as standard users
- **Read-only admins** receive identical limits to other users
- **Role changes** do not automatically update these values

### Post-Creation Management

After account creation, these values can be modified through:

1. **Individual updates**: Admin users can modify limits for specific users
2. **Bulk updates**: Admin API endpoint for updating all active users
3. **Script-based updates**: Administrative scripts for mass changes

```bash
# Example: Update all users with new limits
curl -X PUT /api/v1/admin/users/bulk-update \
  -H "Authorization: Bearer admin-token" \
  -d '{"maxBudget": 200, "tpmLimit": 2000, "rpmLimit": 100}'
```

## Security Considerations

### Backend Enforcement

- **Middleware validation**: Every protected endpoint validates user roles
- **Database queries**: Automatically filtered by user context for non-admin users
- **API key validation**: Role inheritance from user to generated keys

### Frontend Security

- **UI hiding**: Admin features hidden from non-admin users
- **Route protection**: Admin routes redirect non-admin users
- **Component guards**: Sensitive components check roles before rendering

**Important**: Frontend role checks are for UX only. All security enforcement happens on the backend.

## Development and Testing

### Test Users

Development mode includes test users with different roles:

```typescript
const MOCK_USERS = [
  {
    id: 'admin-001',
    username: 'admin@example.com',
    fullName: 'System Administrator',
    roles: ['admin', 'user'],
  },
  {
    id: 'readonly-001',
    username: 'readonly@example.com',
    fullName: 'Read-Only Administrator',
    roles: ['adminReadonly', 'user'],
  },
  {
    id: 'user-001',
    username: 'user@example.com',
    fullName: 'Standard User',
    roles: ['user'],
  },
];
```

### Testing Scenarios

1. **Multi-role users**: Verify most powerful role displays correctly
2. **Role transitions**: Test user experience when roles change
3. **Access control**: Verify unauthorized access is properly blocked
4. **UI consistency**: Ensure role display works across all languages
5. **Edge cases**: Test users with no roles, invalid roles, etc.

## Migration Notes

### Existing Users

All existing users are automatically assigned the `user` role during system migration. Administrator roles must be manually assigned through:

1. **OpenShift group membership**: Add users to `litemaas-admins` or `litemaas-readonly` groups
2. **Database update**: Direct role assignment via database migration
3. **API update**: Use admin APIs to modify user roles (once admins exist)

### Role Evolution

The role system is designed to be extensible. Future roles can be added by:

1. Adding new role strings to the hierarchy function
2. Updating translation files with new role names
3. Configuring appropriate permissions in the middleware
4. Updating UI components with new role checks

## Audit and Compliance

### Role Change Logging

All role modifications are logged with:

- **User ID**: Who was modified
- **Modified by**: Which admin made the change
- **Timestamp**: When the change occurred
- **Previous roles**: What roles they had before
- **New roles**: What roles they have now
- **Context**: OAuth sync, manual change, etc.

### Access Monitoring

Admin access is monitored and logged:

- **Login events**: Admin users logging in
- **Privilege escalation**: Users gaining admin roles
- **Sensitive operations**: Admin-only actions performed
- **Failed access**: Unauthorized admin access attempts

## Troubleshooting

### Common Issues

**Role not displaying correctly**:

- Check `getMostPowerfulRole()` function logic
- Verify user.roles array is properly populated
- Ensure translation keys exist for the role

**Admin features not visible**:

- Verify user has admin or adminReadonly role
- Check navigation configuration requires correct roles
- Ensure frontend role checks match backend requirements

**Access denied errors**:

- Verify JWT token includes correct roles claim
- Check backend middleware validates roles properly
- Ensure database roles array is correctly formatted

### Development Debugging

```bash
# Check user roles in development
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:8081/api/auth/me

# Response should include roles array
{
  "id": "user-123",
  "name": "Admin User",
  "roles": ["admin", "user"]
}
```

# LiteMaaS Development Setup Guide

This guide walks you through setting up a complete development environment for LiteMaaS.

## Prerequisites

- **Node.js**: 18.x or 20.x (use [nvm](https://github.com/nvm-sh/nvm) for version management)
- **npm**: 8.x or later
- **PostgreSQL**: 12+ (can use Docker)
- **Git**: 2.x or later
- **Code Editor**: VS Code recommended

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/rh-aiservices-bu/litemaas.git
cd litemaas
```

### 2. Install Dependencies

```bash
# Install all dependencies for both packages
npm install

# This runs install in both backend and frontend workspaces
```

### 3. Environment Configuration

#### Backend Environment

```bash
# Copy the example environment file
cp backend/.env.example backend/.env

# Edit backend/.env with your configuration
# See docs/deployment/configuration.md for all available options
```

Minimum backend configuration:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/litemaas_dev

# JWT (use a different secret for production!)
JWT_SECRET=development-secret-key-change-in-production

# OAuth (for development)
OAUTH_CLIENT_ID=litemaas
OAUTH_CLIENT_SECRET=dev-secret
OAUTH_ISSUER=https://oauth-openshift.apps.your-cluster.com
OAUTH_CALLBACK_URL=http://localhost:8081/api/auth/callback
OAUTH_MOCK_ENABLED=true  # Use mock OAuth in development

# Role-Based Access Control
DEFAULT_USER_ROLES=["user"]
ADMIN_BOOTSTRAP_USERS=admin@company.com,developer@company.com

# Default User Values (optional - customizes new user limits)
DEFAULT_USER_MAX_BUDGET=100      # Budget in USD
DEFAULT_USER_TPM_LIMIT=1000      # Tokens per minute
DEFAULT_USER_RPM_LIMIT=60        # Requests per minute

# Development mode
NODE_ENV=development
LOG_LEVEL=debug
```

#### Frontend Environment

No configuration is needed.

### 4. Database Setup

#### Option 1: Using Docker (Recommended)

```bash
# Start PostgreSQL using the provided compose file
docker compose -f dev-tools/compose.yaml up -d postgres

# The database will be available at localhost:5432
# Default credentials: postgres/postgres
```

#### Option 2: Local PostgreSQL

```bash
# Create the database
createdb litemaas_dev

# Update DATABASE_URL in backend/.env with your credentials
```

### 5. Initialize the Database

```bash
# Database tables are created automatically on first start
npm run dev:backend

# Optional: Seed with test data
cd backend && npm run db:seed
```

## Running the Application

### Full Stack Development

```bash
# Run both backend and frontend
npm run dev

# Backend: http://localhost:8081
# Frontend: http://localhost:3000
# API Docs: http://localhost:8081/docs
```

### Backend Only

```bash
npm run dev:backend
# or
cd backend && npm run dev
```

### Frontend Only

```bash
npm run dev:frontend
# or
cd frontend && npm run dev
```

## Frontend Technology Stack

### React Query Integration

The frontend uses React Query for server state management:

- **QueryClient Setup**: Configured in `frontend/src/routes/index.tsx`
- **Cache Configuration**: 5-minute stale time, 10-minute cache time
- **Error Handling**: Automatic retry with 2 attempts
- **Usage**: Available via `useQueryClient()` hook throughout the application

### Key Libraries

- **React**: 18.x with hooks and modern patterns
- **React Router**: 6.x for client-side routing
- **React Query**: 3.x for server state management
- **PatternFly 6**: Component library and design system
- **Axios**: HTTP client with interceptors for authentication
- **React i18next**: Internationalization (EN, ES, FR)

## Development Tools

### VS Code Extensions

Recommended extensions for the best development experience:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- PostgreSQL (for database queries)
- Thunder Client or REST Client (for API testing)

### API Documentation

- Swagger UI: <http://localhost:8081/docs>
- OpenAPI Spec: <http://localhost:8081/docs/json>

### Database Management

- pgAdmin: Web-based PostgreSQL admin
- TablePlus: Native PostgreSQL client
- DBeaver: Universal database tool

## Authentication in Development

### Mock OAuth Mode

By default, development uses mock OAuth to avoid needing a real OpenShift cluster:

1. **Mock Users**: Three pre-configured test users with different roles:
   - **Admin**: `admin@example.com` - Full system access (roles: ["admin", "user"])
   - **Read-Only Admin**: `readonly@example.com` - View-only admin access (roles: ["adminReadonly", "user"])
   - **Standard User**: `user@example.com` - Standard user access (roles: ["user"])

2. **Using Mock OAuth**:
   - Click "Login with OpenShift" on the login page
   - Select a mock user from the list
   - You'll be automatically logged in with that user's roles
   - **Admin users** will see additional navigation items and admin features
   - **Role display** appears in the left sidebar showing the most powerful role

3. **Testing Role-Based Access**:

   **As Admin User**:

   ```bash
   # Login as admin@example.com
   # Navigate to /admin/users (should be accessible)
   # Try creating/editing users (should work)
   # Check sidebar shows "Administrator" role
   ```

   **As Read-Only Admin**:

   ```bash
   # Login as readonly@example.com
   # Navigate to /admin/users (should be accessible)
   # Try creating/editing users (should show "Access Denied")
   # Check sidebar shows "Administrator (Read-only)" role
   ```

   **As Standard User**:

   ```bash
   # Login as user@example.com
   # Try navigating to /admin/* (should redirect or show error)
   # Only see own subscriptions/API keys
   # Check sidebar shows "User" role
   ```

### Real OpenShift OAuth with Role Mapping

To test with a real OpenShift cluster including role-based access:

1. **Create OpenShift Groups for Role Mapping**:

   ```bash
   # Create admin group
   oc adm groups new litemaas-admins
   oc adm groups add-users litemaas-admins admin@company.com developer@company.com

   # Create read-only admin group
   oc adm groups new litemaas-readonly
   oc adm groups add-users litemaas-readonly readonly-admin@company.com

   # Create users group (optional - users get this role by default)
   oc adm groups new litemaas-users
   oc adm groups add-users litemaas-users user1@company.com user2@company.com
   ```

2. **Create OAuth Client** in OpenShift:

   ```bash
   oc create -f - <<EOF
   apiVersion: oauth.openshift.io/v1
   kind: OAuthClient
   metadata:
     name: litemaas
   secret: your-secret-here
   redirectURIs:
   - http://localhost:8081/api/auth/callback
   grantMethod: prompt
   EOF
   ```

3. **Update Environment**:

   ```env
   OAUTH_MOCK_ENABLED=false
   OAUTH_CLIENT_ID=litemaas
   OAUTH_CLIENT_SECRET=your-secret-here
   OAUTH_ISSUER=https://oauth-openshift.apps.your-cluster.com

   # Role configuration
   DEFAULT_USER_ROLES=["user"]
   ADMIN_BOOTSTRAP_USERS=admin@company.com,developer@company.com
   ```

4. **Test Role-Based Login**:
   - Click "Login with OpenShift"
   - You'll be redirected to OpenShift login
   - After authentication, roles are assigned based on OpenShift group membership:
     - **litemaas-admins group** → `admin` role + full access
     - **litemaas-readonly group** → `adminReadonly` role + read-only admin access
     - **litemaas-users group** → `user` role + standard access
     - **No specific group** → `user` role (default)
   - Check your role display in the sidebar and test appropriate access levels

## Admin User Setup for Development

### Creating Your First Admin User

1. **Using Mock OAuth** (Recommended for development):

   ```bash
   # Set OAUTH_MOCK_ENABLED=true in backend/.env
   # Login as admin@example.com from the mock user selection
   ```

2. **Using Real OpenShift OAuth**:

   ```bash
   # Add your email to the admin bootstrap list in backend/.env:
   ADMIN_BOOTSTRAP_USERS=your-email@company.com

   # Add yourself to the litemaas-admins OpenShift group:
   oc adm groups add-users litemaas-admins your-email@company.com

   # Login through OAuth - you'll automatically get admin role
   ```

3. **Verify Admin Access**:
   ```bash
   # After login, check that you can access admin features:
   # - Navigate to http://localhost:3000/admin/users
   # - Sidebar should show "Administrator" role
   # - Admin menu items should be visible in navigation
   ```

### Testing Multi-User Scenarios

```bash
# Test with different user types simultaneously using different browsers:

# Browser 1: Login as admin@example.com
# - Full access to all features
# - Can create/edit users
# - Can trigger system operations

# Browser 2: Login as readonly@example.com
# - Can view all users and data
# - Cannot modify anything
# - Gets "Access Denied" on write operations

# Browser 3: Login as user@example.com
# - Can only see own resources
# - Cannot access /admin/* paths
# - Limited to standard user operations
```

## Common Development Tasks

### Running Tests

```bash
# All tests
npm run test

# Backend tests only
npm run test:backend

# Frontend tests only
npm run test:frontend

# Watch mode for development
cd backend && npm run test:watch
cd frontend && npm run test:watch
```

### Code Quality

```bash
# Lint all code
npm run lint

# Auto-fix linting issues
npm run lint -- --fix

# Format code
npm run format

# Check translation completeness
npm run check:translations
```

### Translation Management

The frontend includes a translation checker script to ensure all locales are synchronized with the English source:

```bash
# Check translation completeness for all languages
cd frontend && npm run check:translations

# Role-specific testing
npm run test:roles  # Run role-based access control tests

# The script will:
# - Compare all translation files with English (source of truth)
# - Report completeness percentage for each language
# - List any missing keys that need translation
# - Identify extra keys not present in the source
# - Exit with error code if translations are incomplete (useful for CI/CD)
```

**Translation Files Location**: `frontend/src/i18n/locales/`

- Supported languages: English (en), Spanish (es), French (fr), German (de), Italian (it), Japanese (ja), Korean (ko), Chinese (zh), Elvish (elv)
- All translation files must maintain the same JSON structure and key ordering as the English source
- **Role translations** are available under the `role` key:
  ```json
  {
    "role": {
      "admin": "Administrator",
      "adminReadonly": "Administrator (Read-only)",
      "user": "User"
    }
  }
  ```

### Building for Production

```bash
# Build both packages
npm run build

# Build outputs:
# - Backend: backend/dist/
# - Frontend: frontend/dist/
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check DATABASE_URL format
3. Ensure database exists
4. Check user permissions

### Node Version Issues

```bash
# Install correct Node version with nvm
nvm install 18
nvm use 18
```

### Frontend Proxy Issues

If the frontend can't reach the backend:

1. Verify backend is running on port 8080
2. Check VITE_API_URL in frontend/.env
3. Clear browser cache

## Next Steps

- **Role-Based Development**: Read [User Roles Guide](../features/user-roles-administration.md) for RBAC implementation
- **Authentication Setup**: Review [Authentication Guide](../deployment/authentication.md) for OAuth and role configuration
- Read the [Backend Development Guide](backend-guide.md)
- Review [UI Guidelines](./pf6-guide/README.md) for frontend work
- Check [API Reference](../api/rest-api.md) for endpoint documentation with role requirements
- Join the development chat for questions

## Useful Links

- **[User Roles & Administration](../features/user-roles-administration.md)** - Role-based access control guide
- **[Authentication Setup](../deployment/authentication.md)** - OAuth and role configuration
- [Configuration Reference](../deployment/configuration.md)
- [Architecture Overview](../architecture/overview.md)
- [API Reference](../api/rest-api.md) - Endpoints with role requirements
- [Contributing Guide](../../CONTRIBUTING.md)
- [Project Plan](../../PROJECT_PLAN.md)

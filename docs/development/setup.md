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
# See Configuration Guide for all options
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
OAUTH_CALLBACK_URL=http://localhost:8080/api/auth/callback
OAUTH_MOCK_ENABLED=true  # Use mock OAuth in development

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

1. **Mock Users**: Three pre-configured test users are available:
   - Admin: `admin@example.com` (admin role)
   - User: `user@example.com` (user role)
   - ReadOnly: `readonly@example.com` (readonly role)

2. **Using Mock OAuth**:
   - Click "Login with OpenShift" on the login page
   - Select a mock user from the list
   - You'll be automatically logged in with that user's permissions

### Real OpenShift OAuth

To test with a real OpenShift cluster:

1. **Create OAuth Client** in OpenShift:

   ```bash
   oc create -f - <<EOF
   apiVersion: oauth.openshift.io/v1
   kind: OAuthClient
   metadata:
     name: litemaas
   secret: your-secret-here
   redirectURIs:
   - http://localhost:8080/api/auth/callback
   grantMethod: prompt
   EOF
   ```

2. **Update Environment**:

   ```env
   OAUTH_MOCK_ENABLED=false
   OAUTH_CLIENT_ID=litemaas
   OAUTH_CLIENT_SECRET=your-secret-here
   OAUTH_ISSUER=https://oauth-openshift.apps.your-cluster.com
   ```

3. **Test Login**:
   - Click "Login with OpenShift"
   - You'll be redirected to OpenShift login
   - After authentication, you'll return to LiteMaaS

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

- Read the [Backend Development Guide](backend-guide.md)
- Review [UI Guidelines](./pf6-guide/README.md) for frontend work
- Check [API Reference](../api/README.md) for endpoint documentation
- Join the development chat for questions

## Useful Links

- [Configuration Reference](../deployment/configuration.md)
- [Architecture Overview](../architecture/overview.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Project Plan](../../PROJECT_PLAN.md)

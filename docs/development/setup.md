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
git clone https://github.com/your-org/litemaas.git
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
OAUTH_CLIENT_ID=dev-client
OAUTH_CLIENT_SECRET=dev-secret
OAUTH_ISSUER=http://localhost:8080

# Development mode
NODE_ENV=development
LOG_LEVEL=debug
```

#### Frontend Environment
```bash
# Copy the example environment file
cp frontend/.env.example frontend/.env

# Edit frontend/.env
```

Minimum frontend configuration:
```env
VITE_API_URL=http://localhost:8080
VITE_OAUTH_CLIENT_ID=dev-client
VITE_OAUTH_REDIRECT_URL=http://localhost:3000/auth/callback
```

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
# Run migrations (automatic on first start)
npm run dev:backend

# Or manually run migrations
cd backend && npm run db:migrate

# Optional: Seed with test data
cd backend && npm run db:seed
```

## Running the Application

### Full Stack Development
```bash
# Run both backend and frontend
npm run dev

# Backend: http://localhost:8080
# Frontend: http://localhost:3000
# API Docs: http://localhost:8080/docs
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
- Swagger UI: http://localhost:8080/docs
- OpenAPI Spec: http://localhost:8080/docs/json

### Database Management
- pgAdmin: Web-based PostgreSQL admin
- TablePlus: Native PostgreSQL client
- DBeaver: Universal database tool

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

- Read the [Backend Development Guide](backend-guide.md)
- Review [UI Guidelines](ui-guidelines.md) for frontend work
- Check [API Reference](../api/README.md) for endpoint documentation
- Join the development chat for questions

## Useful Links

- [Configuration Reference](../deployment/configuration.md)
- [Architecture Overview](../architecture/overview.md)
- [Contributing Guide](../../CONTRIBUTING.md)
- [Project Plan](../../PROJECT_PLAN.md)
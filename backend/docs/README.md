# LiteMaaS Backend Documentation

This directory contains comprehensive documentation for the LiteMaaS backend system.

## Documentation Index

### Architecture & Overview
- **[../CLAUDE.md](../CLAUDE.md)** - Complete project overview and architecture guide
- **[../README.md](../README.md)** - Quick start guide and project setup

### Model Synchronization System
- **[MODEL_SYNC_API.md](./MODEL_SYNC_API.md)** - API endpoints for model synchronization
- **[MODEL_SYNC_CONFIG.md](./MODEL_SYNC_CONFIG.md)** - Configuration guide and system behavior

### API Documentation
- **[Swagger UI](http://localhost:8080/docs)** - Interactive API documentation (when backend running)
- **[OpenAPI Spec](http://localhost:8080/docs/json)** - Raw OpenAPI specification

## Key Features

### 🔄 Model Synchronization
The backend automatically synchronizes AI models from LiteLLM to the local database:

- **Automatic Startup Sync**: Models are synchronized when the application starts
- **Manual Sync API**: Admin endpoints for on-demand synchronization
- **Incremental Updates**: Only updates models when changes are detected
- **Availability Management**: Missing models marked as "unavailable" but preserved
- **Error Recovery**: Robust error handling with detailed reporting

### 🗄️ Database Management
Comprehensive database management with automatic setup:

- **Automatic Migrations**: Database schema applied on startup
- **UUID Support**: Proper UUID handling for all entities
- **Foreign Key Constraints**: Data integrity with proper relationships
- **Audit Logging**: Complete audit trail for all operations
- **Connection Pooling**: Optimized database connections

### 🔐 Authentication & Authorization
Multi-layer security with OAuth2 and RBAC:

- **OAuth2 Integration**: OpenShift OAuth with mock mode for development
- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access**: Granular permissions for different operations
- **API Key Management**: Programmatic access with budget tracking
- **Session Management**: Secure session handling

### 🏗️ Service Architecture
Clean service layer architecture:

- **LiteLLMService**: Core integration with LiteLLM backend
- **ModelSyncService**: Handles model synchronization logic
- **ApiKeyService**: API key lifecycle management
- **TeamService**: Multi-tenant team management
- **SubscriptionService**: Model subscription management

## Quick Start

### Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Database migrations run automatically on startup
   npm run dev
   ```

4. **Seed Test Data** (Optional)
   ```bash
   npm run db:seed
   ```

### Production Deployment

1. **Build Application**
   ```bash
   npm run build
   ```

2. **Set Environment Variables**
   ```bash
   export DATABASE_URL="postgresql://..."
   export LITELLM_API_URL="http://litellm:4000"
   export JWT_SECRET="your-secret"
   ```

3. **Start Production Server**
   ```bash
   npm start
   ```

## API Endpoints

### Core Endpoints
- `GET /api/v1/health` - System health check
- `POST /api/v1/auth/login` - User authentication
- `GET /api/v1/models` - List available models
- `POST /api/v1/subscriptions` - Create model subscription

### Model Synchronization
- `POST /api/v1/models/sync` - Manual model synchronization (Admin)
- `GET /api/v1/models/sync/stats` - Synchronization statistics
- `GET /api/v1/models/validate` - Model integrity validation
- `GET /api/v1/models/health` - Model sync health check

### Administration
- `GET /api/v1/users` - User management (Admin)
- `GET /api/v1/teams` - Team management
- `GET /api/v1/audit-logs` - Audit trail (Admin)

## Environment Variables

### Required
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/litemaas
JWT_SECRET=your-jwt-secret
```

### LiteLLM Integration
```bash
LITELLM_API_URL=http://localhost:4000    # LiteLLM backend URL
LITELLM_API_KEY=your-api-key             # Optional API key
```

### OAuth Configuration
```bash
OAUTH_CLIENT_ID=your-oauth-client-id
OAUTH_CLIENT_SECRET=your-oauth-secret
OAUTH_ISSUER_URL=https://your-oauth-provider
```

### Optional Settings
```bash
NODE_ENV=production                      # Environment mode
PORT=8080                               # Server port
DB_MAX_CONNECTIONS=10                   # Database pool size
RATE_LIMIT_MAX=100                      # Rate limiting
```

## Development Workflow

### Database Operations
```bash
npm run db:migrate    # Run database migrations (automatic on startup)
npm run db:seed       # Seed test data (users and teams only)
```

### Testing
```bash
npm run test          # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
```

### Code Quality
```bash
npm run lint          # ESLint checking
npm run format        # Prettier formatting
npm run type-check    # TypeScript validation
```

## Monitoring & Debugging

### Health Checks
- **Application**: `GET /api/v1/health`
- **Database**: `GET /api/v1/health/database`
- **Model Sync**: `GET /api/v1/models/health`
- **LiteLLM**: Health check integrated in model sync

### Logging
- **Structured Logging**: Pino logger with JSON output
- **Request Tracking**: Unique request IDs for tracing
- **Error Aggregation**: Comprehensive error reporting
- **Audit Trail**: All admin operations logged

### Debugging
```bash
# Enable debug logging
DEBUG=litemaas:* npm run dev

# Check application logs
docker logs litemaas-backend

# Database query logging
PGDEBUG=1 npm run dev
```

## Common Issues & Solutions

### Model Sync Issues
```bash
# Check LiteLLM connectivity
curl -I $LITELLM_API_URL/model/info

# Trigger manual sync
curl -X POST localhost:8080/api/v1/models/sync \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check sync health
curl localhost:8080/api/v1/models/health
```

### Database Issues
```bash
# Test database connection
npm run check-backend

# Reset database (development only)
npm run db:reset
```

### Authentication Issues
```bash
# Check OAuth configuration
curl localhost:8080/api/v1/auth/config

# Test token validation
curl -H "Authorization: Bearer YOUR_TOKEN" \
  localhost:8080/api/v1/auth/me
```

## Contributing

1. Follow the established code patterns
2. Add tests for new functionality
3. Update documentation for changes
4. Use conventional commit messages
5. Ensure all quality checks pass

## Support

For additional support:
- Check the main project documentation in [CLAUDE.md](../CLAUDE.md)
- Review API documentation at http://localhost:8080/docs
- Check application logs for detailed error information
- Use health endpoints to diagnose system issues
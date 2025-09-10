# Backend Development Guide

This guide covers backend-specific development workflows and debugging tips for LiteMaaS.

## Documentation Links

- **[Architecture Overview](../architecture/README.md)** - System architecture and design decisions
- **[API Reference](../api/README.md)** - Complete API documentation
- **[Deployment Guide](../deployment/backend-deployment.md)** - Production deployment instructions
- **[Model Sync Configuration](../../backend/docs/MODEL_SYNC_CONFIG.md)** - Model synchronization setup

## Development Workflow

### Backend-Only Commands

```bash
# Start backend in development mode (port 8080)
npm run dev:backend

# Build backend TypeScript
npm run build:backend

# Run backend tests only
npm run test:backend

# Backend-specific linting
cd backend && npm run lint

# Type checking
cd backend && npm run type-check
```

### Database Operations

```bash
# Database is auto-migrated on startup, but for manual operations:
cd backend

# Check database connection
npm run check-backend

# Seed test data (users and teams only - models are synced from LiteLLM)
npm run db:seed

# Reset database (development only)
npm run db:reset
```

## Debugging Tips

### Enable Debug Logging

```bash
# Verbose logging for all backend modules
DEBUG=litemaas:* npm run dev:backend

# Specific module debugging
DEBUG=litemaas:auth npm run dev:backend
DEBUG=litemaas:models npm run dev:backend
DEBUG=litemaas:sync npm run dev:backend

# PostgreSQL query logging
PGDEBUG=1 npm run dev:backend
```

### Common Debugging Scenarios

#### Model Sync Issues

```bash
# Check LiteLLM connectivity directly
curl -I $LITELLM_API_URL/model/info

# Trigger manual sync (requires admin token)
curl -X POST localhost:8081/api/v1/models/sync \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Check sync health and last sync time
curl localhost:8081/api/v1/models/health
```

#### Authentication Problems

```bash
# Test OAuth config (mock mode in development)
curl localhost:8081/api/v1/auth/config

# Validate JWT token
curl -H "Authorization: Bearer $TOKEN" localhost:8081/api/v1/auth/me
```

#### Database Connection Issues

```bash
# Test raw database connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool status
curl localhost:8081/api/v1/health/database
```

## Backend-Specific Configuration

### Mock Mode Development

Set `NODE_ENV=development` to enable:

- Mock OAuth authentication (no real OAuth required)
- Mock LiteLLM responses when API unavailable
- Detailed error messages in responses
- Request/response logging

### Performance Profiling

```bash
# Run with Node.js profiler
node --prof dist/index.js

# Generate flamegraph
0x -o dist/index.js
```

### Load Testing

```bash
# Run K6 performance tests
cd backend/tests/performance
k6 run load-test.js
```

## Quick Reference

- **API Docs**: http://localhost:8081/docs (Swagger UI)
- **Health Check**: http://localhost:8081/api/v1/health
- **Default Port**: 8080
- **Database**: PostgreSQL with auto-migration
- **Logger**: Pino with structured JSON output

# LiteMaaS API Documentation

This directory contains comprehensive API documentation for the LiteMaaS platform.

## API Documentation Structure

### Core APIs

- **[REST API Reference](rest-api.md)** - Main LiteMaaS REST API endpoints
  - Authentication endpoints
  - User management
  - Subscription management
  - API key operations
  - Usage analytics

### Integration APIs

- **[Model Sync API](model-sync-api.md)** - Model synchronization endpoints
  - Manual sync triggers
  - Sync status monitoring
  - Model validation
  - Health checks

- **[LiteLLM Integration](litellm-api.md)** - LiteLLM service integration
  - Model information retrieval
  - Budget management
  - Usage tracking
  - Team synchronization

## API Access

### Base URL
- Development: `http://localhost:8080/api`
- Production: `https://api.your-domain.com/api`

### Authentication
All API endpoints require authentication via one of:
1. JWT Bearer token (obtained via OAuth flow)
2. API Key (for programmatic access)
3. Admin API Key (for administrative operations)

### API Documentation Tools
- **Swagger UI**: Available at `/docs` when the backend is running
- **OpenAPI Spec**: Available at `/docs/json`

## Quick Links

- [Authentication Guide](../deployment/authentication.md)
- [Configuration Reference](../deployment/configuration.md)
- [Development Setup](../development/setup.md)

## API Versioning

The API follows semantic versioning:
- Current version: `v1`
- Version prefix: `/api/v1/`

Breaking changes will result in a new major version with appropriate migration guides.

## Rate Limiting

Default rate limits:
- Standard users: 100 requests per minute
- API key access: 200 requests per minute
- Admin access: 1000 requests per minute

See [Configuration Guide](../deployment/configuration.md#security--rate-limiting) for customization options.

## Error Handling

All APIs follow a consistent error response format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error
# LiteMaaS API Documentation

## Quick Start

```bash
# Get your API token via OAuth login
curl -X POST https://api.litemaas.com/api/auth/login

# List available models
curl -H "Authorization: Bearer $TOKEN" \
  https://api.litemaas.com/api/v1/models

# Create an API key for multiple models
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"modelIds": ["gpt-4", "claude-3"], "name": "My Key"}' \
  https://api.litemaas.com/api/v1/api-keys
```

## API Documentation

### Core APIs

- **[REST API Reference](rest-api.md)** - Complete API endpoint documentation
  - Authentication & authorization flows
  - User profile management
  - Model browsing and subscription
  - Multi-model API key management
  - Usage analytics and reporting

### Specialized APIs

- **[Model Sync API](model-sync-api.md)** - Model synchronization with LiteLLM
- **[Usage API](usage-api.md)** - Detailed usage tracking and analytics
- **[Migration Guide](api-migration-guide.md)** - Upgrading to multi-model API keys

## API Access

### Base URL

- Development: `http://localhost:8081/api`
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

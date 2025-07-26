# Model Synchronization API Documentation

This document describes the Model Synchronization API endpoints available in LiteMaaS for managing model data synchronization between LiteLLM and the application database.

## Overview

The Model Synchronization system automatically keeps the LiteMaaS database in sync with available models from the LiteLLM backend. This ensures that:

- New models from LiteLLM are automatically added to the database
- Existing models are updated with latest pricing and capabilities
- Models no longer available in LiteLLM are marked as "unavailable" but preserved for existing subscriptions
- All model operations use consistent, up-to-date data

## Authentication

All model synchronization endpoints require authentication and admin permissions:
- **Authentication**: Bearer token required
- **Permissions**: `models:read` for read operations, `models:write` for sync operations

## Endpoints

### POST /api/v1/models/sync

Manually trigger model synchronization from LiteLLM to the database.

**Authentication**: Required (Admin only)  
**Permissions**: `models:write`

#### Request Body

```json
{
  "forceUpdate": false,      // Optional: Force update all models even if unchanged
  "markUnavailable": true    // Optional: Mark missing models as unavailable
}
```

#### Response

**Success (200)**
```json
{
  "success": true,
  "totalModels": 15,
  "newModels": 3,
  "updatedModels": 2,
  "unavailableModels": 1,
  "errors": [],
  "syncedAt": "2025-07-25T15:08:53.676Z"
}
```

**Error (500)**
```json
{
  "error": {
    "code": "SYNC_FAILED",
    "message": "Model synchronization failed: Connection timeout"
  }
}
```

#### Example

```bash
curl -X POST http://localhost:8080/api/v1/models/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "forceUpdate": false,
    "markUnavailable": true
  }'
```

### GET /api/v1/models/sync/stats

Get model synchronization statistics and status.

**Authentication**: Required  
**Permissions**: `models:read`

#### Response

```json
{
  "totalModels": 15,
  "availableModels": 14,
  "unavailableModels": 1,
  "lastSyncAt": "2025-07-25T15:08:53.676Z"
}
```

#### Example

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/v1/models/sync/stats
```

### GET /api/v1/models/validate

Validate model data integrity and check for inconsistencies.

**Authentication**: Required  
**Permissions**: `models:read`

#### Response

```json
{
  "validModels": 14,
  "invalidModels": [
    "gpt-4-invalid (Missing provider)"
  ],
  "orphanedSubscriptions": 2
}
```

#### Example

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/v1/models/validate
```

### GET /api/v1/models/health

Check the health status of the model synchronization system.

**Authentication**: Not required (public health check)

#### Response

```json
{
  "status": "healthy",
  "lastSync": "2025-07-25T15:08:53.676Z",
  "modelsCount": 15,
  "litellmConnected": true,
  "issues": []
}
```

**With Issues**
```json
{
  "status": "warning",
  "lastSync": "2025-07-25T15:08:53.676Z",
  "modelsCount": 15,
  "litellmConnected": false,
  "issues": [
    "Cannot connect to LiteLLM backend",
    "2 subscriptions reference unavailable models"
  ]
}
```

#### Example

```bash
curl http://localhost:8080/api/v1/models/health
```

## Synchronization Process

### Automatic Synchronization

Models are automatically synchronized when the application starts:

1. **Database Migrations**: Ensure all required tables exist
2. **LiteLLM Connection**: Test connection to LiteLLM backend
3. **Model Fetch**: Retrieve current models from `/model/info` endpoint
4. **Database Comparison**: Compare with existing models in database
5. **Sync Operations**: Add new, update existing, mark unavailable
6. **Audit Logging**: Record sync results and any errors

### Manual Synchronization

Administrators can trigger manual synchronization at any time using the sync API endpoint. This is useful for:

- Getting latest model updates without restarting
- Recovering from sync errors
- Testing synchronization process
- Updating models after LiteLLM configuration changes

## Data Mapping

### LiteLLM to Database Field Mapping

| LiteLLM Field | Database Field | Description |
|---------------|----------------|-------------|
| `model_name` | `id`, `name` | Unique model identifier |
| `litellm_params.custom_llm_provider` | `provider` | Model provider (openai, anthropic, etc.) |
| `model_info.max_tokens` | `context_length` | Maximum context window |
| `model_info.input_cost_per_token` | `input_cost_per_token` | Input pricing |
| `model_info.output_cost_per_token` | `output_cost_per_token` | Output pricing |
| `model_info.supports_vision` | `supports_vision` | Vision capability |
| `model_info.supports_function_calling` | `supports_function_calling` | Function calling |
| `model_info.supports_parallel_function_calling` | `supports_parallel_function_calling` | Parallel functions |

### Capability Mapping

Capabilities are extracted from model metadata and stored as an array:

```javascript
const features = [];
if (model_info.supports_function_calling) features.push('function_calling');
if (model_info.supports_parallel_function_calling) features.push('parallel_function_calling');
if (model_info.supports_vision) features.push('vision');
features.push('chat'); // All models support chat
```

## Error Handling

### Common Errors

1. **Connection Errors**: LiteLLM backend unavailable
2. **Authentication Errors**: Invalid or missing API keys
3. **Database Errors**: Database connection or constraint violations
4. **Data Format Errors**: Unexpected model data structure

### Error Recovery

The synchronization system includes robust error handling:

- **Circuit Breaker**: Prevents cascading failures during LiteLLM outages
- **Partial Success**: Continues processing other models if individual models fail
- **Detailed Logging**: Comprehensive error reporting for debugging
- **Graceful Degradation**: Falls back to existing database data when sync fails

## Monitoring and Observability

### Audit Logs

All synchronization operations are logged to the `audit_logs` table:

```sql
SELECT * FROM audit_logs 
WHERE action = 'MODELS_SYNC' 
ORDER BY created_at DESC;
```

### Health Monitoring

Use the health endpoint to monitor sync system status:

- **Status**: healthy, warning, error
- **Connectivity**: LiteLLM backend connection status
- **Data Integrity**: Model validation results
- **Issues**: Specific problems that need attention

### Metrics

Key metrics to monitor:

- **Sync Frequency**: How often syncs are performed
- **Success Rate**: Percentage of successful sync operations
- **Model Count**: Total available and unavailable models
- **Error Patterns**: Common failure types and frequencies

## Configuration

### Environment Variables

```bash
# LiteLLM Integration
LITELLM_API_URL=http://localhost:4000
LITELLM_API_KEY=your-api-key

# Sync Behavior
LITELLM_AUTO_SYNC=true           # Enable automatic startup sync
LITELLM_SYNC_INTERVAL=60         # Sync interval in seconds (future use)
```

### Database Configuration

Ensure proper database setup with required tables:

```bash
npm run db:migrate  # Creates all required tables including models
```

## Best Practices

### For Administrators

1. **Monitor Health**: Regularly check `/models/health` endpoint
2. **Handle Errors**: Address issues reported in health checks
3. **Validate Data**: Periodically run `/models/validate` to check integrity
4. **Audit Logs**: Review sync operations in audit logs

### For Developers

1. **Test Locally**: Use mock mode for development when LiteLLM unavailable
2. **Handle Undefined**: Check for undefined values in model data
3. **Graceful Fallback**: Always have fallback when models unavailable
4. **Error Boundaries**: Implement error handling in UI components

## Troubleshooting

### Common Issues

**Sync Fails on Startup**
- Check LiteLLM_API_URL and connectivity
- Verify database migrations have run
- Check application logs for specific errors

**Models Not Updating**
- Trigger manual sync via API
- Check forceUpdate parameter
- Verify LiteLLM has model changes

**Pricing Information Missing**  
- LiteLLM may not provide pricing for all models
- UI should display "N/A" for missing pricing
- Check model metadata in LiteLLM response

**Database Constraint Errors**
- Usually indicates duplicate model IDs
- Check for model name conflicts
- Verify database schema is up to date

### Support

For additional support:
- Check application logs for detailed error messages
- Use health endpoint to diagnose connectivity issues
- Review audit logs for sync operation history
- Contact development team with specific error details
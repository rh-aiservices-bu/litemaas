# Model Synchronization Configuration Guide

This document provides comprehensive configuration guidance for the LiteMaaS Model Synchronization system.

## Overview

The Model Synchronization system maintains consistency between LiteLLM backend models and the LiteMaaS database. It supports both automatic and manual synchronization with configurable behavior.

## Architecture Components

### Core Services

1. **ModelSyncService** (`src/services/model-sync.service.ts`)
   - Handles model synchronization logic
   - Manages field mapping between LiteLLM and database
   - Provides sync statistics and validation

2. **LiteLLMService** (`src/services/litellm.service.ts`)
   - Communicates with LiteLLM `/model/info` endpoint
   - Handles authentication and error recovery
   - Provides caching and circuit breaker functionality

3. **Database Plugin** (`src/plugins/database.ts`)
   - Triggers automatic synchronization on startup
   - Manages database connections and migrations
   - Provides database utilities for services

## Environment Configuration

### Required Variables

```bash
# LiteLLM Backend Configuration
LITELLM_API_URL=http://localhost:4000    # Primary LiteLLM API URL
LITELLM_BASE_URL=http://localhost:4000   # Alternative/fallback URL
LITELLM_API_KEY=your-litellm-api-key     # Optional: LiteLLM API key

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/litemaas
```

### Optional Variables

```bash
# Sync Behavior (Future Enhancements)
LITELLM_AUTO_SYNC=true                   # Enable automatic startup sync
LITELLM_SYNC_INTERVAL=60                 # Sync interval in seconds
LITELLM_CONFLICT_RESOLUTION=litellm_wins # Conflict resolution strategy

# Performance Tuning
DB_MAX_CONNECTIONS=10                    # Database connection pool size
DB_IDLE_TIMEOUT=30000                    # Connection idle timeout (ms)
DB_CONNECTION_TIMEOUT=2000               # Connection timeout (ms)

# Development/Testing
NODE_ENV=development                     # Enables mock mode fallback
```

## Database Schema

### Models Table Structure

```sql
CREATE TABLE models (
    id VARCHAR(255) PRIMARY KEY,                    -- LiteLLM model_name
    name VARCHAR(255) NOT NULL,                     -- Display name
    provider VARCHAR(100) NOT NULL,                 -- Provider (openai, anthropic, etc.)
    description TEXT,                               -- Model description
    category VARCHAR(100) DEFAULT 'Language Model', -- Model category
    context_length INTEGER,                         -- Max context window
    input_cost_per_token DECIMAL(12,10),           -- Input pricing
    output_cost_per_token DECIMAL(12,10),          -- Output pricing
    supports_vision BOOLEAN DEFAULT FALSE,          -- Vision capability
    supports_function_calling BOOLEAN DEFAULT FALSE, -- Function calling
    supports_tool_choice BOOLEAN DEFAULT FALSE,     -- Tool choice
    supports_parallel_function_calling BOOLEAN DEFAULT FALSE, -- Parallel functions
    supports_streaming BOOLEAN DEFAULT TRUE,        -- Streaming support
    features TEXT[],                                -- Capability array
    availability VARCHAR(20) DEFAULT 'available',   -- available | unavailable
    version VARCHAR(50) DEFAULT '1.0',             -- Model version
    metadata JSONB,                                 -- Raw LiteLLM data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes and Constraints

```sql
-- Performance indexes
CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_availability ON models(availability);
CREATE INDEX idx_models_updated ON models(updated_at);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_models_updated_at
    BEFORE UPDATE ON models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## Synchronization Behavior Configuration

### Sync Options

The synchronization process supports various configuration options:

```typescript
interface ModelSyncOptions {
  forceUpdate?: boolean; // Update all models regardless of changes
  markUnavailable?: boolean; // Mark missing models as unavailable
}
```

### Default Behavior

**Automatic Startup Sync**:

- Runs after database migrations complete
- Uses default options: `{ forceUpdate: false, markUnavailable: true }`
- Logs results and continues startup even if sync fails

**Model Processing Logic**:

1. **New Models**: Insert with all available metadata
2. **Existing Models**: Update only if changes detected (unless forceUpdate=true)
3. **Missing Models**: Mark as unavailable if markUnavailable=true
4. **Error Handling**: Log errors but continue processing other models

### Sync Timing

```typescript
// Automatic sync triggers
1. Application startup (after database ready)
2. Manual API calls (POST /api/v1/models/sync)

// Future enhancements
3. Scheduled intervals (configurable)
4. Webhook-triggered sync
5. Health check recovery sync
```

## Data Mapping Configuration

### Field Mapping Rules

The system maps LiteLLM model data to database fields using these rules:

```typescript
// Primary identification
modelId = litellmModel.model_name;
modelName = litellmModel.model_name;

// Provider extraction priority
provider =
  litellmModel.litellm_params?.custom_llm_provider ||
  (litellmModel.litellm_params?.model?.includes('/')
    ? litellmModel.litellm_params.model.split('/')[0]
    : 'unknown');

// Pricing with fallback
inputCost =
  litellmModel.model_info?.input_cost_per_token ||
  litellmModel.litellm_params?.input_cost_per_token;
outputCost =
  litellmModel.model_info?.output_cost_per_token ||
  litellmModel.litellm_params?.output_cost_per_token;

// Context length
contextLength = litellmModel.model_info?.max_tokens;

// Capabilities
supportsVision = litellmModel.model_info?.supports_vision || false;
supportsFunctionCalling = litellmModel.model_info?.supports_function_calling || false;
supportsParallelFunctionCalling =
  litellmModel.model_info?.supports_parallel_function_calling || false;
```

### Capability Feature Array

```typescript
const features = [];
if (supportsFunctionCalling) features.push('function_calling');
if (supportsParallelFunctionCalling) features.push('parallel_function_calling');
if (supportsVision) features.push('vision');
features.push('chat'); // All models assumed to support chat
```

### Metadata Storage

Raw LiteLLM data is preserved in the metadata JSONB field:

```typescript
metadata = JSON.stringify({
  litellm_model_info: litellmModel.model_info,
  litellm_params: litellmModel.litellm_params,
});
```

## Error Handling Configuration

### Circuit Breaker Settings

```typescript
const CIRCUIT_BREAKER_THRESHOLD = 5; // Failures before opening
const CIRCUIT_BREAKER_TIMEOUT = 30000; // Timeout before retry (ms)
```

### Retry Configuration

```typescript
const config = {
  timeout: 30000, // Request timeout
  retryAttempts: 3, // Max retry attempts
  retryDelay: 1000, // Base retry delay (ms)
};
```

### Error Categories

1. **Connection Errors**: LiteLLM backend unavailable
2. **Authentication Errors**: Invalid API keys
3. **Data Errors**: Malformed model data
4. **Database Errors**: Constraint violations, connection issues
5. **Timeout Errors**: Request or circuit breaker timeouts

## Performance Configuration

### Database Optimization

```typescript
// Connection pooling
max: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
```

### Caching Strategy

```typescript
// LiteLLMService caching
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const HEALTH_CACHE_TTL = 30000; // 30 seconds
```

### Batch Processing

Models are processed individually with error isolation:

- Each model sync is wrapped in try-catch
- Errors don't stop processing of other models
- Results aggregated at the end

## Monitoring Configuration

### Logging Levels

```typescript
// Sync operation logging
fastify.log.info('Starting model synchronization...');
fastify.log.debug({ modelId }, 'Inserted new model');
fastify.log.warn('Initial model synchronization completed with errors');
fastify.log.error({ error }, 'Model synchronization failed');
```

### Audit Trail

All sync operations are logged to the audit_logs table:

```sql
INSERT INTO audit_logs (user_id, action, resource_type, metadata, success)
VALUES ($1, 'MODELS_SYNC', 'MODEL', $2, $3);
```

### Health Check Configuration

```typescript
// Health check components
- LiteLLM connectivity test
- Model count validation
- Data integrity checks
- Sync timestamp tracking
```

## Development Configuration

### Mock Mode

```typescript
// Automatic mock mode triggers
enableMocking: process.env.NODE_ENV === 'development' &&
  !process.env.LITELLM_API_URL &&
  !process.env.LITELLM_BASE_URL;
```

### Mock Data

```typescript
const MOCK_MODELS = [
  {
    model_name: 'gpt-4o',
    litellm_params: {
      input_cost_per_token: 0.01,
      output_cost_per_token: 0.03,
      custom_llm_provider: 'openai',
      model: 'openai/gpt-4o',
    },
    model_info: {
      max_tokens: 128000,
      supports_function_calling: true,
      supports_parallel_function_calling: true,
      supports_vision: true,
      // ... additional fields
    },
  },
];
```

## Frontend Integration

### Admin Tools Page

The model sync functionality is exposed to administrators through the Tools page at `/admin/tools`.

**Location**: `frontend/src/pages/ToolsPage.tsx`

#### Implementation Overview

The Tools page provides a **Models Management** panel that allows administrators to trigger manual model synchronization:

```typescript
// Role-based access control
const canSync = user?.roles?.includes('admin') ?? false;

// Sync handler
const handleRefreshModels = async () => {
  if (!canSync) return;

  setIsLoading(true);
  try {
    const result = await modelsService.refreshModels();
    setLastSyncResult(result);

    addNotification({
      variant: 'success',
      title: 'Models synchronized successfully',
      description: `${result.totalModels} total models (${result.newModels} new, ${result.updatedModels} updated)`,
    });
  } catch (error) {
    addNotification({
      variant: 'danger',
      title: 'Failed to synchronize models',
      description: error.message,
    });
  } finally {
    setIsLoading(false);
  }
};
```

#### Service Integration

**Location**: `frontend/src/services/models.service.ts`

The frontend communicates with the sync API through the models service:

```typescript
class ModelsService {
  async refreshModels(): Promise<any> {
    const response = await apiClient.post('/models/sync');
    return response;
  }
}
```

#### Role-Based UI Behavior

| User Role       | Access Level | Button State          | Notifications                      |
| --------------- | ------------ | --------------------- | ---------------------------------- |
| `admin`         | Full access  | Enabled               | Receives sync result notifications |
| `adminReadonly` | View only    | Disabled with tooltip | No sync notifications              |
| `user`          | No access    | Cannot access page    | N/A                                |

#### UI Features

1. **Manual Sync Button**: Triggers immediate model synchronization
2. **Loading State**: Shows progress during sync operation
3. **Results Display**: Shows detailed sync statistics after completion
4. **Error Handling**: Displays error messages and details
5. **Role Tooltips**: Explains disabled functionality for admin-readonly users

#### Sync Result Display

After a successful sync, the UI displays:

- **Total Models**: Complete count in database
- **New Models**: Models added during sync
- **Updated Models**: Models modified during sync
- **Sync Timestamp**: When synchronization completed
- **Error Details**: Any specific sync failures

#### Translation Support

All UI text is internationalized with keys under `pages.tools`:

```json
{
  "pages": {
    "tools": {
      "models": "Models Management",
      "refreshModels": "Refresh Models from LiteLLM",
      "syncInProgress": "Synchronizing models...",
      "syncSuccess": "Models synchronized successfully",
      "syncError": "Failed to synchronize models",
      "adminRequired": "Admin access required to sync models"
    }
  }
}
```

Supported in all 9 languages: EN, ES, FR, DE, IT, JA, KO, ZH, ELV

#### Testing

The Tools page includes comprehensive test coverage:

- **Unit Tests**: `frontend/src/test/components/ToolsPage.test.tsx`
- **Accessibility Tests**: `frontend/src/test/components/ToolsPage.accessibility.test.tsx`
- **Role-based Testing**: Admin, admin-readonly, and user scenarios
- **API Integration**: Success and error response handling
- **WCAG Compliance**: Full accessibility test suite

## Production Deployment

### Pre-deployment Checklist

1. ✅ Database migrations applied
2. ✅ Environment variables configured
3. ✅ LiteLLM connectivity tested
4. ✅ Database connection pool sized appropriately
5. ✅ Monitoring and logging configured
6. ✅ Health checks accessible

### Startup Sequence

```
1. Load configuration
2. Initialize services
3. Connect to database
4. Run migrations
5. Perform initial model sync
6. Start API server
7. Health checks ready
```

### Rollback Considerations

- Model data is preserved during failed syncs
- Database transactions prevent partial updates
- Previous model data remains available if sync fails
- Manual recovery possible via API endpoints

## Troubleshooting

### Common Configuration Issues

**Environment Variables Not Set**

```bash
# Check required variables
echo $LITELLM_API_URL
echo $DATABASE_URL
```

**Database Connection Issues**

```sql
-- Test database connectivity
SELECT NOW() as current_time;
```

**Model Sync Failures**

```bash
# Check API connectivity
curl -I $LITELLM_API_URL/model/info

# Check application logs
docker logs litemaas-backend

# Test manual sync
curl -X POST localhost:8081/api/v1/models/sync
```

### Configuration Validation

```typescript
// Service initialization validation
- Database connection test
- LiteLLM API connectivity
- Required environment variables
- Database schema verification
```

## Security Considerations

### API Key Management

- Store LiteLLM API keys securely
- Use environment variables, not hardcoded values
- Rotate keys regularly
- Monitor key usage and permissions

### Database Security

- Use connection pooling with proper limits
- Implement proper SSL/TLS for production
- Regular security updates for PostgreSQL
- Monitor for unusual query patterns

### Access Control

- Model sync endpoints require admin permissions
- API authentication required for all operations
- Audit logging for all administrative actions
- Rate limiting to prevent abuse

## Future Enhancements

### Planned Features

1. **Scheduled Synchronization**: Automatic periodic sync
2. **Webhook Integration**: Real-time sync triggers
3. **Conflict Resolution**: Configurable merge strategies
4. **Model Versioning**: Track model changes over time
5. **Bulk Operations**: Mass model management
6. **Advanced Filtering**: Selective sync by provider/type

### Configuration Extensions

```typescript
// Future configuration options
interface AdvancedSyncConfig {
  scheduleEnabled: boolean;
  scheduleInterval: string; // cron expression
  conflictResolution: 'litellm_wins' | 'database_wins' | 'merge';
  selectiveSync: {
    providers: string[]; // Only sync specific providers
    modelPatterns: string[]; // Regex patterns for model names
  };
  webhookEndpoints: string[]; // External notification URLs
  retentionPolicy: {
    keepUnavailableModels: boolean;
    unavailableRetentionDays: number;
  };
}
```

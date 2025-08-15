# API Migration Guide: Multi-Model API Keys

## Overview

LiteMaaS has been upgraded to support **multi-model API keys**, allowing a single API key to access multiple models instead of being tied to a single subscription. This guide helps you migrate from the legacy subscription-based API keys to the new multi-model format.

## What Changed

### Before (Legacy)

- ❌ One API key per subscription
- ❌ Each API key could only access one model
- ❌ Required multiple API keys for multiple models

### After (New Multi-Model)

- ✅ One API key can access multiple models
- ✅ Simplified key management
- ✅ Better alignment with LiteLLM's native capabilities
- ✅ Full backward compatibility maintained

## Migration Strategy

### Option 1: Gradual Migration (Recommended)

1. **Continue using existing API keys** (they still work)
2. **Create new multi-model keys** for new use cases
3. **Gradually replace legacy keys** during normal key rotation cycles
4. **Take advantage of deprecation warnings** to identify legacy usage

### Option 2: Immediate Migration

1. **Audit existing API keys** using the new API endpoints
2. **Create equivalent multi-model keys** for each existing key
3. **Update applications** to use new keys
4. **Delete old keys** after successful testing

## API Changes

### 🔄 Updated Endpoints

#### 1. Create API Key - POST /api-keys

**NEW FORMAT** (Recommended):

```json
{
  "modelIds": ["gpt-4", "gpt-3.5-turbo"], // NEW: Multiple models
  "name": "Multi-Model Production Key",
  "expiresAt": "2024-12-31T23:59:59Z",
  "maxBudget": 500.0,
  "tpmLimit": 2000,
  "rpmLimit": 100
}
```

**LEGACY FORMAT** (Still supported with deprecation warnings):

```json
{
  "subscriptionId": "sub_123", // DEPRECATED
  "name": "Legacy Production Key"
}
```

#### 2. List API Keys - GET /api-keys

**NEW RESPONSE FORMAT**:

```json
{
  "data": [
    {
      "id": "key_123",
      "models": ["gpt-4", "gpt-3.5-turbo"], // NEW: Array of models
      "modelDetails": [
        // NEW: Rich model info
        {
          "id": "gpt-4",
          "name": "GPT-4",
          "provider": "openai",
          "contextLength": 8192
        }
      ],
      "subscriptionId": "sub_123" // LEGACY: Still present
      // ... other fields
    }
  ]
}
```

**NEW QUERY PARAMETERS**:

```
GET /api-keys?modelIds=gpt-4,claude-3       // NEW: Filter by models
GET /api-keys?subscriptionId=sub_123        // LEGACY: Still works
```

### 🆕 New Features

#### Enhanced Filtering

```bash
# Filter by multiple models
GET /api-keys?modelIds=gpt-4,gpt-3.5-turbo

# Get keys that can access specific model
GET /api-keys?modelIds=gpt-4
```

#### Rich Model Information

```json
{
  "modelDetails": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "contextLength": 8192
    }
  ]
}
```

#### Enhanced Statistics

```json
{
  "byModel": {
    // NEW: Statistics by model
    "gpt-4": 5,
    "gpt-3.5-turbo": 3
  },
  "bySubscription": {
    // LEGACY: Still included
    "sub_123": 3,
    "sub_456": 2
  }
}
```

## Migration Examples

### Example 1: Single Model Migration

**Before (Legacy)**:

```bash
# Create API key for GPT-4
curl -X POST /api-keys \
  -H "Authorization: Bearer $JWT" \
  -d '{"subscriptionId": "sub_gpt4", "name": "GPT-4 Key"}'
```

**After (Multi-Model)**:

```bash
# Create API key for GPT-4 (same result, better format)
curl -X POST /api-keys \
  -H "Authorization: Bearer $JWT" \
  -d '{"modelIds": ["gpt-4"], "name": "GPT-4 Key"}'
```

### Example 2: Multiple Models Consolidation

**Before (Legacy)**:

```bash
# Required 2 separate API keys
curl -X POST /api-keys -d '{"subscriptionId": "sub_gpt4", "name": "GPT-4 Key"}'
curl -X POST /api-keys -d '{"subscriptionId": "sub_gpt35", "name": "GPT-3.5 Key"}'
```

**After (Multi-Model)**:

```bash
# Single API key for both models
curl -X POST /api-keys \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "modelIds": ["gpt-4", "gpt-3.5-turbo"],
    "name": "Multi-Model Key",
    "maxBudget": 1000.00,
    "tpmLimit": 5000
  }'
```

## Application Code Migration

### JavaScript/Node.js

**Before**:

```javascript
// Separate keys for each model
const gpt4Key = 'lm_gpt4_key123';
const gpt35Key = 'lm_gpt35_key456';

// Use different keys for different models
const useGpt4 = () => callAPI(gpt4Key, 'gpt-4');
const useGpt35 = () => callAPI(gpt35Key, 'gpt-3.5-turbo');
```

**After**:

```javascript
// Single key for multiple models
const multiModelKey = 'lm_multi_key789';

// Same key works for all authorized models
const useGpt4 = () => callAPI(multiModelKey, 'gpt-4');
const useGpt35 = () => callAPI(multiModelKey, 'gpt-3.5-turbo');

// Key validation includes model access check
const validateAccess = async (model) => {
  const response = await fetch('/api-keys/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ key: multiModelKey }),
  });
  const result = await response.json();
  return result.models.includes(model);
};
```

### Python

**Before**:

```python
# Separate keys for each model
API_KEYS = {
    'gpt-4': 'lm_gpt4_key123',
    'gpt-3.5-turbo': 'lm_gpt35_key456'
}

def call_model(model, prompt):
    key = API_KEYS[model]
    return make_request(key, model, prompt)
```

**After**:

```python
# Single key for multiple models
MULTI_MODEL_KEY = 'lm_multi_key789'

def call_model(model, prompt):
    # Same key works for all authorized models
    return make_request(MULTI_MODEL_KEY, model, prompt)

def get_available_models():
    """Get models available to current API key"""
    response = requests.post('/api-keys/validate',
        headers={'Authorization': f'Bearer {jwt}'},
        json={'key': MULTI_MODEL_KEY})
    return response.json()['models']
```

## Backward Compatibility

### Guaranteed Compatibility

- ✅ **Existing API keys continue to work** without changes
- ✅ **Legacy API endpoints** remain functional
- ✅ **Subscription-based creation** still supported
- ✅ **Response formats** include both old and new fields

### Deprecation Warnings

Look for these headers in API responses to identify legacy usage:

```http
X-API-Deprecation-Warning: subscriptionId parameter is deprecated. Use modelIds array instead.
X-API-Migration-Guide: See /docs/api/migration-guide for details on upgrading to multi-model API keys.
```

### Sunset Timeline

- **Phase 1** (Current): Full backward compatibility with deprecation warnings
- **Phase 2** (6 months): Legacy endpoints marked as deprecated in OpenAPI spec
- **Phase 3** (12 months): Legacy parameters removed from documentation
- **Phase 4** (18 months): Legacy endpoints return 410 Gone status

## Testing Your Migration

### 1. Validate API Key Access

```bash
# Test which models your key can access
curl -X POST /api-keys/validate \
  -H "Authorization: Bearer $JWT" \
  -d '{"key": "your-api-key"}'
```

### 2. Check Response Format

```bash
# Verify you're handling both legacy and new fields
curl -H "Authorization: Bearer $JWT" /api-keys
```

### 3. Test Model Access

```bash
# Confirm multi-model access works
curl -X POST /v1/chat/completions \
  -H "Authorization: Bearer your-multi-model-key" \
  -d '{"model": "gpt-4", "messages": [...]}'

curl -X POST /v1/chat/completions \
  -H "Authorization: Bearer your-multi-model-key" \
  -d '{"model": "gpt-3.5-turbo", "messages": [...]}'
```

## Best Practices

### 1. Key Management

- ✅ **Use descriptive names** for multi-model keys
- ✅ **Set appropriate budgets** and rate limits
- ✅ **Group related models** in the same key
- ✅ **Use metadata** to track key purposes

### 2. Security

- ✅ **Rotate keys regularly** using new multi-model format
- ✅ **Use principle of least privilege** - only include needed models
- ✅ **Monitor usage patterns** for anomalies
- ✅ **Set up budget alerts** to prevent overruns

### 3. Application Design

- ✅ **Cache model availability** from API key validation
- ✅ **Handle model access errors** gracefully
- ✅ **Use feature flags** for gradual rollouts
- ✅ **Implement fallback strategies** for model unavailability

## Troubleshooting

### Common Issues

#### Issue: API key can't access expected model

```bash
# Check what models your key can access
curl -X POST /api-keys/validate \
  -H "Authorization: Bearer $JWT" \
  -d '{"key": "your-key"}'
```

#### Issue: Legacy subscriptionId still required

```bash
# Update to new format
# OLD: {"subscriptionId": "sub_123"}
# NEW: {"modelIds": ["gpt-4"]}
```

#### Issue: Missing model details in response

```bash
# Ensure you're using updated endpoints
curl -H "Authorization: Bearer $JWT" /api-keys
# Look for "modelDetails" array in response
```

### Getting Help

- 📖 **Documentation**: `/docs/api/rest-api.md`
- 🔍 **API Reference**: `/docs/api/openapi.yaml`
- 🐛 **Issue Tracker**: `https://github.com/rh-aiservices-bu/litemaas/issues`
- 💬 **Support**: `support@litemaas.com`

## Summary

The multi-model API key upgrade provides:

1. **Simplified Management**: Fewer keys to manage
2. **Enhanced Flexibility**: One key, multiple models
3. **Better Performance**: Reduced API overhead
4. **Future-Proof**: Aligned with LiteLLM capabilities
5. **Zero Downtime**: Full backward compatibility

Start your migration today by creating new multi-model keys for new use cases, while existing keys continue to work seamlessly.

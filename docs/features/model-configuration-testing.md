# Model Configuration Testing Feature

## Overview

The Model Configuration Testing feature allows administrators to validate model configurations before creating or updating models in LiteMaaS. This feature tests connectivity to external AI model endpoints and verifies that the specified model is available.

## Purpose

- **Validate Connectivity**: Ensure the API endpoint is reachable and responsive
- **Verify Authentication**: Confirm that the provided API key has proper access
- **Check Model Availability**: Verify that the specified model exists at the endpoint
- **Improve User Experience**: Provide immediate feedback before model creation
- **Reduce Configuration Errors**: Catch configuration issues early in the setup process

## How to Use

### In the Admin Models Page

1. Navigate to **Admin → Models** in the LiteMaaS interface
2. Click **Create Model** or edit an existing model
3. Fill in the required model configuration fields:
   - **API Base URL**: The base URL of the AI model service
   - **API Key**: The authentication key for accessing the service (required for new models; optional when editing)
   - **Backend Model Name**: The exact name of the model as it appears in the service

### Testing Configuration

1. After filling in the required fields, click the **Test Configuration** button
2. The system will attempt to validate the configuration by:
   - Connecting to the `{API_BASE_URL}/models` endpoint
   - Using Bearer token authentication with the provided API key (or the stored encrypted key when editing)
   - Retrieving the list of available models
   - Verifying that the specified model name exists in the response

### Edit Mode — Testing Without Re-entering API Key

When editing an existing model, the API key field is intentionally left empty for security (provider APIs never expose stored keys). The Test Configuration button remains **enabled** without an API key because:

- The backend stores an encrypted copy of the API key (AES-256-GCM) when a model is created or updated
- When testing in edit mode without an API key, the backend decrypts the stored key and uses it for the test
- If the admin enters a new API key, the entered key takes priority and the stored key is updated

**Note**: Models created before this feature was enabled will not have a stored key. In this case the backend returns a `missing_stored_key` result and the admin is prompted to enter an API key manually.

### Test Results

The test results will appear in the modal footer above the action buttons:

#### Success Scenarios

- **✅ Connection Successful**: "Connection successful! You can create the model."
  - Appears when the endpoint is reachable, authentication succeeds, and the model is found

#### Error Scenarios

- **❌ Cannot Contact Endpoint**: Network connectivity issues or invalid URL
- **❌ Authentication Failed**: Invalid API key or insufficient permissions
- **⚠️ Model Not Available**: Model name not found in the available models list
  - Includes up to 5 available models as suggestions
- **⚠️ No Stored API Key**: Model was created before encrypted key storage was enabled (edit mode only)
  - Admin is prompted to enter an API key manually

## Technical Implementation

### Architecture

Model configuration testing is performed **server-side** via a dedicated backend endpoint (`POST /api/v1/admin/models/test`). The frontend sends the configuration to the backend, which makes the external API call and returns a structured result. This ensures API keys are never exposed in browser network requests.

### API Validation Process

1. **Field Validation**: Frontend ensures required fields are present (API Base URL, Backend Model Name; API Key required only in create mode)
2. **Backend Request**: Frontend calls `POST /api/v1/admin/models/test` with the configuration (includes `model_id` when editing without an API key)
3. **API Key Resolution**: Backend uses the provided API key, or if absent, decrypts the stored encrypted key from the database
4. **External HTTP Request**: Backend makes a GET request to `{API_BASE_URL}/models` with a 10-second timeout
5. **Authentication**: Backend uses Bearer token authentication with the resolved API key
6. **Response Parsing**: Backend parses the JSON response to extract the model list from `data` array
7. **Model Verification**: Backend checks if the specified model name exists in the returned model IDs
8. **Structured Result**: Backend returns a typed result (`model_found`, `model_not_found`, `auth_error`, `connection_error`, `timeout`, `missing_stored_key`)

### Expected API Response Format

```json
{
  "object": "list",
  "data": [
    {
      "id": "model-name-1",
      "object": "model",
      "created": 1758888561,
      "owned_by": "provider",
      "max_model_len": 32768
      // ... other model properties
    },
    {
      "id": "model-name-2",
      "object": "model"
      // ... other properties
    }
  ]
}
```

### Error Handling

The feature handles various error conditions:

- **Network Errors**: Connection timeouts, DNS resolution failures
- **HTTP Errors**:
  - `401/403`: Authentication failures
  - `404/500`: Server errors
  - Other status codes: General connectivity issues
- **Response Parsing Errors**: Invalid JSON or unexpected response structure
- **Model Validation**: Model name not found in available models

## User Interface Elements

### Test Configuration Button

- **Location**: Modal footer, left of the Create/Cancel buttons
- **State Management**:
  - **Create mode**: Disabled when API Base URL, API Key, or Backend Model Name is missing
  - **Edit mode**: Disabled when API Base URL or Backend Model Name is missing (API Key is optional — stored key is used)
  - Shows loading spinner during testing
  - Enabled after test completion

### Result Alert

- **Location**: Modal footer, above the action buttons
- **Types**:
  - Success (green): Configuration validated successfully
  - Danger (red): Critical errors (network, authentication)
  - Warning (yellow): Model not found, with suggestions
- **Auto-clear**: Results clear when form data changes

## Internationalization

The feature supports all 9 LiteMaaS languages with appropriate translations:

- English (EN), Spanish (ES), French (FR), German (DE)
- Italian (IT), Japanese (JA), Korean (KO), Chinese (ZH)
- Elvish (ELV) for demonstration purposes

### Translation Keys

```json
{
  "models.admin.testConfiguration": "Test Configuration",
  "models.admin.testingConfiguration": "Testing Configuration...",
  "models.admin.connectionSuccessful": "Connection successful! You can create the model.",
  "models.admin.cannotContactEndpoint": "Cannot contact the endpoint",
  "models.admin.authenticationFailed": "Authentication failed",
  "models.admin.modelNotAvailable": "Model not available at this endpoint",
  "models.admin.availableModels": "Available models",
  "models.admin.noStoredApiKey": "This model was created before API key storage was enabled. Please enter an API key to test the configuration."
}
```

## Security Considerations

- **Server-Side Execution**: Configuration testing runs on the backend, so API keys are never sent from or exposed in the browser
- **RBAC Protection**: The test endpoint requires `admin:models` permission
- **Encrypted API Key Storage**: Provider API keys are stored encrypted in the database using AES-256-GCM with a random IV per encryption, derived from `LITELLM_MASTER_KEY` (or `LITELLM_API_KEY` as fallback)
- **Key Never in Plaintext**: The `encrypted_api_key` column contains only base64-encoded ciphertext (IV + ciphertext + auth tag); plaintext is never persisted
- **HTTPS Requirements**: All external API calls should use HTTPS endpoints
- **Error Information**: Error messages don't expose sensitive configuration details
- **Request Timeout**: Backend enforces a 10-second timeout on external API calls

## Best Practices

### For Administrators

1. Always test configuration before creating models
2. Use specific model names exactly as they appear in the API response
3. Ensure API keys have appropriate permissions for model access
4. Verify base URLs include the correct protocol (https://)

### For Developers

1. Handle network timeouts gracefully
2. Provide clear, actionable error messages
3. Clear previous test results when form data changes
4. Implement proper loading states for better UX

## Related Documentation

- [Admin Tools Guide](admin-tools.md) - Overview of administrative features
- [User Roles Administration](user-roles-administration.md) - Role-based access control
- [API Reference](../api/rest-api.md) - Backend API documentation
- [Frontend Development](../development/pf6-guide/) - PatternFly 6 component usage

## Implementation Files

- **Backend Route**: `backend/src/routes/admin-models.ts` — `POST /test` endpoint, encrypted key storage on create/update
- **Backend Schemas**: `backend/src/schemas/admin-models.ts` — `AdminTestModelConfigSchema`, `AdminTestModelConfigResponseSchema`
- **Encryption Utility**: `backend/src/utils/encryption.ts` — `encryptApiKey()`, `decryptApiKey()` (AES-256-GCM)
- **Database Migration**: `backend/src/lib/database-migrations.ts` — `encrypted_api_key` column on `models` table
- **Frontend Service**: `frontend/src/services/adminModels.service.ts` — `testConfiguration()` method
- **Frontend Types**: `frontend/src/types/admin.ts` — `TestModelConfigRequest`, `TestModelConfigResponse`
- **Frontend Page**: `frontend/src/pages/AdminModelsPage.tsx` — UI integration, edit-mode button logic
- **Translations**: `frontend/src/i18n/locales/*/translation.json`

# Admin Tools Page

## Overview

The Admin Tools page (`/admin/tools`) provides administrative tools for managing LiteMaaS system configurations. Currently, it focuses on **Models Management**, allowing administrators to manually synchronize AI models from LiteLLM.

### Access Requirements

The Tools page is restricted to users with administrative privileges:

- **Admin users**: Full access with ability to trigger synchronization
- **Admin-readonly users**: View-only access to sync information and statistics
- **Regular users**: No access (redirected or receive 403 error)

## Models Management Panel

The Models Management panel is the primary feature of the Tools page, providing control over model synchronization between LiteLLM and the LiteMaaS database. It also includes model configuration testing capabilities for validating new model setups.

### Purpose

Model synchronization ensures that:

- LiteMaaS has up-to-date information about available models
- New models added to LiteLLM are immediately accessible
- Model metadata (pricing, capabilities, context length) is current
- Unavailable models are properly marked

### Manual Synchronization

#### When to Use Manual Sync

Manual synchronization is useful when:

- You've just added new models to LiteLLM
- You've removed or updated models in LiteLLM
- Automatic sync has failed or seems outdated
- You want to verify model availability immediately
- Testing new model configurations

## Model Configuration Testing

In addition to manual synchronization, the admin interface includes a **Test Configuration** feature for validating model configurations before creation. This feature is accessible through the Create/Edit Model modal on the Admin → Models page.

### Purpose

Model configuration testing allows administrators to:

- **Validate Connectivity**: Test if API endpoints are reachable and responsive
- **Verify Authentication**: Confirm API keys have proper access permissions
- **Check Model Availability**: Ensure specified models exist at the configured endpoints
- **Prevent Configuration Errors**: Catch setup issues before model creation
- **Improve Setup Reliability**: Provide immediate feedback during model configuration

### How to Use Test Configuration

1. Navigate to **Admin → Models** in the LiteMaaS interface
2. Click **Create Model** or edit an existing model
3. Fill in the required configuration fields:
   - **API Base URL**: Base URL of the AI model service
   - **API Key**: Authentication key for accessing the service
   - **Backend Model Name**: Exact model name as it appears in the service
4. Click the **Test Configuration** button (located left of Create/Cancel buttons)
5. Review the test results displayed above the action buttons

### Test Results and Error Handling

#### Success Scenario

- **✅ Connection Successful**: "Connection successful! You can create the model."
- Indicates the endpoint is reachable, authentication works, and the model exists

#### Error Scenarios

- **❌ Cannot Contact Endpoint**: Network issues or invalid URL
- **❌ Authentication Failed**: Invalid API key or insufficient permissions
- **⚠️ Model Not Available**: Model name not found in endpoint's model list
  - Shows up to 5 available model suggestions

### Technical Details

The test configuration feature:

- Connects to `{API_BASE_URL}/models` endpoint
- Uses Bearer token authentication with the provided API key
- Parses the JSON response to extract available model IDs from the `data` array
- Verifies the specified model name exists in the returned list
- Handles various error conditions with specific user-friendly messages

For complete technical documentation, see [Model Configuration Testing](model-configuration-testing.md).

#### How to Trigger Sync

1. Navigate to `/admin/tools` in the LiteMaaS interface
2. Locate the **Models Management** panel
3. Click the **"Refresh Models from LiteLLM"** button
4. Wait for the synchronization to complete
5. Review the sync results displayed

#### Sync Process

During synchronization, the system:

1. Connects to LiteLLM's `/model/info` endpoint
2. Retrieves current model information
3. Compares with existing database records
4. Creates new model entries
5. Updates changed model metadata
6. Marks unavailable models (if configured)
7. Returns detailed statistics

### Understanding Sync Results

After a successful sync, you'll see detailed statistics in the **Last Synchronization** section:

#### Sync Statistics

- **Total Models**: Complete count of models in the database
- **New Models**: Number of models added during this sync
- **Updated Models**: Number of existing models that were modified
- **Sync Time**: Timestamp when the synchronization completed

#### Success Indicators

✅ **Successful Sync**:

- Green success alert displays
- Statistics show expected model counts
- No errors listed
- Recent timestamp

⚠️ **Partial Success**:

- Alert shows with some models processed
- Error list shows specific failures
- Some models may be marked unavailable

❌ **Sync Failure**:

- Red error alert displays
- Error notification appears
- No statistics updated
- Previous sync results remain visible

### Role-Based Functionality

#### Admin Users (Full Access)

Admin users can:

- ✅ **Trigger manual sync**: Click refresh button to start sync
- ✅ **View sync results**: See all statistics and error details
- ✅ **Monitor sync history**: Track when syncs were performed
- ✅ **Handle sync errors**: See detailed error messages for troubleshooting

#### Admin-Readonly Users (View Only)

Admin-readonly users can:

- ✅ **View sync results**: See statistics and sync status
- ✅ **Monitor sync history**: View when syncs were last performed
- ✅ **See error details**: Review any sync errors for awareness
- ❌ **Cannot trigger sync**: Refresh button is disabled with explanatory tooltip

### Error Handling

#### Common Sync Errors

**Connection Errors**:

```
Failed to connect to LiteLLM at http://localhost:4000
```

- **Cause**: LiteLLM service is down or unreachable
- **Solution**: Verify LiteLLM is running and network connectivity

**Authentication Errors**:

```
Authentication failed: Invalid API key
```

- **Cause**: Incorrect or expired LiteLLM API key
- **Solution**: Update `LITELLM_API_KEY` environment variable

**Timeout Errors**:

```
Request timeout after 30 seconds
```

- **Cause**: LiteLLM is slow to respond or overloaded
- **Solution**: Retry after a few minutes, or check LiteLLM performance

**Model Validation Errors**:

```
Model validation failed for gpt-4: missing pricing information
```

- **Cause**: Model configuration in LiteLLM is incomplete
- **Solution**: Fix model configuration in LiteLLM and re-sync

#### Error Recovery

When sync errors occur:

1. **Review error messages** in the sync results panel
2. **Check LiteLLM status** and logs for additional context
3. **Verify configuration** (API keys, URLs, model settings)
4. **Retry sync** after addressing underlying issues
5. **Contact support** if errors persist

### Troubleshooting

#### Sync Button Disabled

**Admin-readonly users**:

- **Expected behavior**: Button shows tooltip "Admin access required to sync models"
- **Solution**: Contact an admin user to perform sync, or request admin role upgrade

**Network issues**:

- **Symptoms**: Button appears stuck in loading state
- **Solution**: Refresh page, check network connectivity, verify LiteLLM accessibility

#### No Sync Results Displayed

**Symptoms**: Panel shows but no "Last Synchronization" section appears

- **Cause**: No sync has been performed since page load
- **Solution**: Trigger a manual sync or check if automatic sync is enabled

#### Outdated Model Information

**Symptoms**: Models in LiteMaaS don't match what's in LiteLLM

- **Cause**: Sync hasn't run recently or failed silently
- **Solution**: Trigger manual sync and review results for errors

#### Sync Statistics Seem Wrong

**Symptoms**: Numbers don't match expected model counts

- **Possible causes**:
  - Models exist in LiteLLM but are not accessible due to configuration
  - Duplicate model entries in LiteLLM
  - Models filtered out due to validation rules
- **Solution**: Review error messages and LiteLLM model configuration

## Best Practices

### Regular Maintenance

1. **Monitor sync frequency**: Check sync timestamps regularly
2. **Review sync results**: Look for patterns in errors or failures
3. **Update documentation**: Keep track of model changes and sync procedures
4. **Test after changes**: Sync after any LiteLLM configuration changes

### Performance Considerations

1. **Avoid frequent syncs**: Don't sync more often than necessary (impacts performance)
2. **Monitor during peak usage**: Avoid syncing during high-traffic periods
3. **Plan for large updates**: Large model additions may take longer to sync

### Security Considerations

1. **Limit admin access**: Only give admin permissions to trusted users
2. **Monitor sync activities**: Track who performs syncs and when
3. **Review sync logs**: Check for any unauthorized access attempts
4. **Audit model changes**: Verify that model updates are intentional

## Integration with Automated Sync

The manual sync functionality complements the automatic sync system:

- **Automatic sync** runs on startup and periodically (if configured)
- **Manual sync** provides immediate control when needed
- Both use the same underlying sync service and produce identical results
- Manual sync can be used to verify or supplement automatic sync

For more technical details about the sync process, see:

- [Model Sync Development Guide](../development/model-sync.md)
- [Model Sync API Documentation](../api/model-sync-api.md)

## Branding Customization

The Branding Customization feature allows administrators to personalize the login page and application header with custom logos, titles, and subtitles. It is accessible from the **Branding** tab on the Admin Tools page (`/admin/tools`).

### Access Requirements

| Role | Capabilities |
|------|-------------|
| Admin | Full access — toggle settings, edit text, upload/delete images |
| Admin-readonly | View-only access — see current branding configuration |
| Regular user | No access |

### Customizable Elements

| Element | Type | Constraints |
|---------|------|-------------|
| Login Logo | Image upload | 2 MB max; JPEG, PNG, SVG, GIF, WebP |
| Login Title | Text input | 200 characters max |
| Login Subtitle | Textarea | 500 characters max |
| Header Brand (Light) | Image upload | 2 MB max; JPEG, PNG, SVG, GIF, WebP |
| Header Brand (Dark) | Image upload | 2 MB max; JPEG, PNG, SVG, GIF, WebP |

### How to Customize Branding

1. Navigate to **Admin → Tools** and select the **Branding** tab
2. Toggle the elements you want to customize (Login Logo, Login Title, Login Subtitle, Header Brand)
3. For images: click **Upload Image** and select a file (takes effect immediately)
4. For text: enter the desired title or subtitle
5. Click **Save** to persist toggle and text changes

For complete details, see the [Branding Customization](branding-customization.md) feature documentation.

## Limits Management

The Limits Management feature is accessible from the **Limits** tab on the Admin Tools page (`/admin/tools`). It provides two sections for managing resource limits across the system.

### Bulk User Limits

Allows administrators to update max budget, TPM limit, and RPM limit for all active users in a single operation. A confirmation modal previews the changes before they are applied.

### API Key Quota Defaults

Administrators can configure default and maximum quota values that apply when users create API keys through the self-service interface.

#### Purpose

- **Consistency**: Ensure all new API keys start with sensible resource limits
- **Cost control**: Set hard maximums that users cannot exceed
- **Simplified onboarding**: Users see pre-filled quota values based on admin configuration

#### Configurable Fields

| Field | Type | Description |
|-------|------|-------------|
| `maxBudget` | number (nullable) | Default/maximum budget in dollars |
| `tpmLimit` | integer (nullable) | Default/maximum tokens per minute |
| `rpmLimit` | integer (nullable) | Default/maximum requests per minute |
| `budgetDuration` | string (nullable) | Budget reset period (`daily`, `weekly`, `monthly`, `yearly`, or custom like `30d`, `1mo`) |
| `softBudget` | number (nullable) | Soft budget threshold for warnings (defaults only) |

Each field has both a **default** value (auto-applied when users omit the field) and a **maximum** value (hard limit that rejects user requests if exceeded). Setting a value to `null` means "not configured" (no default or no limit).

#### How It Works

1. **Admin configures** defaults and maximums via the Limits tab or `PUT /api/v1/admin/settings/api-key-defaults`
2. **User opens Create Key modal** — frontend fetches defaults from `GET /api/v1/config/api-key-defaults` (public, no auth)
3. **Form pre-fills** quota fields with admin defaults; helper text shows configured maximums
4. **User submits** — backend validates that user values do not exceed admin maximums, applies defaults for omitted fields

#### Validation Behavior

- Default values must be ≤ their corresponding maximum values (enforced on admin save)
- User-provided values must be ≤ admin maximums (enforced on key creation)
- `null` maximums mean no upper limit — users can set any value

#### Access Requirements

| Role | Capabilities |
|------|-------------|
| Admin | Full access — view and modify defaults and maximums |
| Admin-readonly | View-only access to current configuration |
| Regular user | No direct access (but benefits from pre-filled defaults in Create Key modal) |

#### API Endpoints

- `GET /api/v1/admin/settings/api-key-defaults` — Get current configuration (admin, adminReadonly)
- `PUT /api/v1/admin/settings/api-key-defaults` — Update configuration (admin only)
- `GET /api/v1/config/api-key-defaults` — Public endpoint for frontend pre-fill (no auth)

For API details, see the [REST API Reference](../api/rest-api.md#admin-settings-apiv1adminsettings).

## Usage Analytics

The Admin Usage Analytics feature (`/admin/usage`) provides comprehensive system-wide visibility into AI model usage across all users, models, and providers.

### Access Requirements

- **Admin users**: Full access including data refresh capabilities
- **Admin-readonly users**: View-only access to all analytics and reports
- **Regular users**: No access (redirected or receive 403 error)

### Purpose

Usage analytics allows administrators to:

- **Monitor System-Wide Usage**: Track requests, tokens, and costs across all users
- **Analyze Trends**: View historical trends and comparison metrics
- **Identify Top Users**: See which users are consuming the most resources
- **Track Model Performance**: Monitor usage patterns by model and provider
- **Export Data**: Generate reports in CSV or JSON format for external analysis
- **Optimize Resources**: Make data-driven decisions about model availability and capacity

### Key Features

#### Comprehensive Metrics Dashboard

The analytics dashboard displays:

- **Period Overview**: Selected date range with total and active user counts
- **Usage Metrics**: Total requests, tokens (prompt/completion), and costs
- **Success Rates**: Request success percentage and average latency
- **Cost Breakdowns**: Costs by provider and by model
- **Trend Analysis**: Percentage changes compared to previous period
- **Top Performers**: Highest-usage users and models
- **Daily Charts**: Visual representation of usage over time

#### Multi-Dimensional Filtering

Filter analytics by:

- **Date Range**: Predefined presets (1d, 7d, 30d, 90d) or custom range
- **Models**: Select specific models to analyze
- **Users**: Filter by specific users
- **API Keys**: Filter by specific API keys (cascading filter with user selection)

#### Intelligent Caching

The system uses sophisticated caching for optimal performance:

- **Historical Data**: Permanent cache for days older than 1 day
- **Current Day**: 5-minute TTL with automatic stale detection
- **On-Demand Refresh**: Admins can force refresh current day data
- **LiteLLM Integration**: Data fetched from `/user/daily/activity` endpoint
- **User Enrichment**: API keys mapped to users via local database

### Using the Analytics Dashboard

1. **Navigate** to `/admin/usage` in LiteMaaS
2. **Select Date Range** using the date picker or presets
3. **Apply Filters** (optional) to focus on specific models, users, or API keys
4. **Review Metrics** in the overview cards and charts
5. **Export Data** for external analysis if needed
6. **Refresh Today** to get latest current-day data (admin only)

### Role-Based Functionality

#### Admin Users (Full Access)

- ✅ View all analytics and metrics
- ✅ Apply any combination of filters
- ✅ Export data in CSV or JSON format
- ✅ Force refresh current day data
- ✅ Access all breakdown reports (by user, model, provider)

#### Admin-Readonly Users (View Only)

- ✅ View all analytics and metrics
- ✅ Apply any combination of filters
- ✅ Export data in CSV or JSON format
- ❌ Cannot refresh current day data (button disabled with tooltip)

### Data Export

Export functionality provides:

- **CSV Format**: Spreadsheet-compatible for Excel/Google Sheets
- **JSON Format**: Structured data for programmatic processing
- **Complete Data**: All metrics for selected date range and filters
- **Automatic Filename**: `admin-usage-export-{startDate}-to-{endDate}.{format}`

### Performance Considerations

The caching strategy ensures:

- **Fast Response Times**: Historical data served from cache instantly
- **Fresh Current Data**: Today's data refreshed every 5 minutes
- **Reduced LiteLLM Load**: Minimizes API calls to LiteLLM service
- **Scalability**: Supports large date ranges without performance degradation

### Technical Details

For complete technical documentation, see:

- **[Admin Usage Analytics Implementation](../archive/features/admin-usage-analytics-implementation-plan.md)** - Complete feature specification
- **[Usage API Documentation](../api/usage-api.md#admin-endpoints)** - API endpoints and data formats
- **[REST API Reference](../api/rest-api.md#admin-usage-analytics-apiv1adminusage)** - Detailed endpoint specifications

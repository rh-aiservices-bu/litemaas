# Settings and Tools Page

## Overview

The Settings and Tools page (`/admin/tools`) provides administrative tools for managing LiteMaaS system configurations. It includes tabs for Limits, Banners, Branding, Currency, Backup, and Models Sync.

### Access Requirements

The Settings and Tools page is restricted to users with administrative privileges:

- **Admin users**: Full access with ability to trigger synchronization
- **Admin-readonly users**: View-only access to sync information and statistics
- **Regular users**: No access (redirected or receive 403 error)

## Models Sync

The Models Sync tab provides control over model synchronization between LiteLLM and the LiteMaaS database. It also includes model configuration testing capabilities for validating new model setups.

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
2. Select the **Models Sync** tab
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

The Branding Customization feature allows administrators to personalize the login page and application header with custom logos, titles, and subtitles. It is accessible from the **Branding** tab on the Settings and Tools page (`/admin/tools`).

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

1. Navigate to **Admin → Settings and Tools** and select the **Branding** tab
2. Toggle the elements you want to customize (Login Logo, Login Title, Login Subtitle, Header Brand)
3. For images: click **Upload Image** and select a file (takes effect immediately)
4. For text: enter the desired title or subtitle
5. Click **Save** to persist toggle and text changes

For complete details, see the [Branding Customization](branding-customization.md) feature documentation.

## Limits

The Limits feature is accessible from the **Limits** tab on the Settings and Tools page (`/admin/tools`). It provides three sections for managing resource limits across the system.

### New User Defaults

Administrators can configure default TPM, RPM, and max budget values that are applied to newly registered users on first login.

#### Configurable Fields

| Field | Type | Description |
|-------|------|-------------|
| `maxBudget` | number (nullable) | Default max budget for new users |
| `tpmLimit` | integer (nullable) | Default TPM limit for new users |
| `rpmLimit` | integer (nullable) | Default RPM limit for new users |

Setting a value to `null` (or leaving it empty) means "not configured" — the system falls back to environment variable defaults (`DEFAULT_USER_TPM_LIMIT`, `DEFAULT_USER_RPM_LIMIT`, `DEFAULT_USER_MAX_BUDGET`), which are shown as placeholders in the form.

#### Access Requirements

| Role | Capabilities |
|------|-------------|
| Admin | Full access — view and modify defaults |
| Admin-readonly | View-only access to current configuration |
| Regular user | No direct access |

#### API Endpoints

- `GET /api/v1/admin/settings/user-defaults` — Get current configuration (admin, adminReadonly)
- `PUT /api/v1/admin/settings/user-defaults` — Update configuration (admin only)

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
| `expirationDays` | integer (nullable) | Default/maximum expiration period in days (e.g., 30, 60, 90, 180, 365) |

Each field has both a **default** value (auto-applied when users omit the field) and a **maximum** value (hard limit that rejects user requests if exceeded). Setting a value to `null` means "not configured" (no default or no limit). When a maximum `expirationDays` is set, the "Never" expiration option is removed from the user-facing Create Key modal.

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

### Bulk User Limits

Allows administrators to update max budget, TPM limit, and RPM limit for **all active users** in a single operation. A confirmation modal previews the changes before they are applied, and results show the number of successfully updated and failed users.

#### Access Requirements

| Role | Capabilities |
|------|-------------|
| Admin | Full access — execute bulk updates |
| Admin-readonly | View-only (execute button disabled) |
| Regular user | No access |

#### API Endpoint

- `POST /api/v1/admin/bulk-update-user-limits` — Apply limits to all active users (admin only)

## Currency Settings

The Currency Settings feature is accessible from the **Currency** tab on the Settings and Tools page (`/admin/tools`). It allows administrators to configure the currency used for all monetary value displays across the platform.

### Purpose

By default, LiteMaaS displays all monetary values (budgets, spend, costs) using USD ($). Organizations using a different currency can change the display currency to match their billing currency, ensuring consistent and meaningful cost reporting.

### Access Requirements

| Role | Capabilities |
|------|-------------|
| Admin | Full access — view and change currency |
| Admin-readonly | View-only access to current configuration |
| Regular user | No direct access (but sees the configured currency in all cost displays) |

### Supported Currencies

LiteMaaS supports 25 currencies: USD, EUR, GBP, JPY, CNY, CAD, AUD, CHF, INR, KRW, BRL, MXN, SGD, HKD, NZD, SEK, NOK, DKK, PLN, ZAR, TRY, THB, AED, SAR, ILS.

### How to Change Currency

1. Navigate to **Admin → Settings and Tools** and select the **Currency** tab
2. Select the desired currency from the dropdown
3. Click **Save** to apply the change

The change takes effect immediately across all pages and for all users.

### Where Currency Is Displayed

The configured currency symbol appears in:

- **Usage analytics**: Metrics overview, trend charts, model distribution, heatmap, breakdown tables
- **API key management**: Spend displays, budget columns, progress bars
- **Admin interfaces**: User budget/limits, API key quota defaults, user defaults
- **Model pages**: Pricing information on models, subscriptions, and admin models pages
- **Data exports**: CSV and JSON usage exports

### API Endpoints

- `GET /api/v1/admin/settings/currency` — Get current currency (admin, adminReadonly)
- `GET /api/v1/admin/settings/currency/supported` — Get all supported currencies (admin, adminReadonly)
- `PUT /api/v1/admin/settings/currency` — Update currency (admin only)
- `GET /api/v1/config` — Public endpoint includes `currency` field for frontend consumption

For API details, see the [REST API Reference](../api/rest-api.md#admin-settings-apiv1adminsettings).

---

## Backup & Restore

The Backup & Restore feature is accessible from the **Backup** tab on the Settings and Tools page (`/admin/tools`). It provides full database backup and restore capabilities for both the LiteMaaS and LiteLLM databases.

### Purpose

Database backup and restore allows administrators to:

- **Create backups**: Generate compressed `.sql.gz` backup files for LiteMaaS and/or LiteLLM databases
- **Download backups**: Download backup files for off-site storage
- **Test restore**: Perform non-destructive restore to a temporary schema to validate backup integrity
- **Full restore**: Restore a backup to the production database (destructive, with confirmation)
- **Manage backups**: List, download, and delete existing backup files
- **CLI restore**: Use a standalone script for catastrophic recovery when the web UI is unavailable

### Access Requirements

| Role | Capabilities |
|------|-------------|
| Admin | Full access -- create, download, delete, restore, and test-restore backups |
| Admin-readonly | View-only access -- can see the Backup tab but all actions are disabled |
| Regular user | No access |

**Permission**: `admin:backup` (admin role only)

### Prerequisites

- **LiteMaaS database**: Always available for backup (uses the application's `DATABASE_URL`)
- **LiteLLM database**: Requires `LITELLM_DATABASE_URL` environment variable to be set. This is a direct PostgreSQL connection string to LiteLLM's database, **not** the LiteLLM API URL. When not configured, only LiteMaaS backup is available.

For environment variable configuration, see the [Configuration Guide](../deployment/configuration.md#backup--restore).

### How to Create a Backup

1. Navigate to **Admin > Settings and Tools** and select the **Backup** tab
2. Select which databases to back up (LiteMaaS, LiteLLM, or both)
3. Click **Create Backup**
4. The backup file (`.sql.gz`) will appear in the backup list once complete

### How to Restore a Backup

#### Test Restore (Recommended First Step)

1. Select a backup from the list
2. Click **Test Restore**
3. Optionally edit the temporary schema name
4. The restore runs against a temporary schema and validates data integrity without affecting production data
5. Review the test results

#### Full Restore

1. Select a backup from the list
2. Click **Restore**
3. Type the confirmation text in the safety modal
4. The backup is restored to the production database, replacing existing data

### CLI Restore (Catastrophic Recovery)

When the web UI is unavailable, use the standalone restore script:

```bash
cd backend
npx tsx src/scripts/restore-backup.ts <path-to-backup.sql.gz>
```

The script requires `DATABASE_URL` and/or `LITELLM_DATABASE_URL` environment variables to be set. Backup files are also compatible with standard PostgreSQL tools:

```bash
gunzip -c backup.sql.gz | psql <database-url>
```

### Technical Details

- **Backup format**: Compressed SQL (`.sql.gz`), compatible with `psql` for manual restore
- **Type-aware serialization**: Correct handling of PostgreSQL array columns (`TEXT[]`) vs JSON/JSONB arrays, quoted identifiers for mixed-case table names (LiteLLM), and timestamp precision preservation
- **Storage**: Configurable via `BACKUP_STORAGE_PATH` (default: `./data/backups`)
- **Audit logging**: All backup operations (create, download, delete, restore, test-restore) are logged to the `audit_logs` table

### API Endpoints

- `GET /api/v1/admin/backup/capabilities` -- Check which databases are available for backup
- `GET /api/v1/admin/backup` -- List existing backups
- `POST /api/v1/admin/backup` -- Create a new backup
- `GET /api/v1/admin/backup/:filename` -- Download a backup file
- `DELETE /api/v1/admin/backup/:filename` -- Delete a backup file
- `POST /api/v1/admin/backup/restore` -- Full restore from a backup
- `POST /api/v1/admin/backup/test-restore` -- Test restore to a temporary schema

---

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

## Audit Log

The Audit Log page (`/admin/audit`) provides administrators with a comprehensive view of all system-wide administrative actions recorded in the `audit_logs` table.

### Access Requirements

- **Roles**: `admin`, `adminReadonly`
- **Permission**: `admin:audit`

### Key Features

- **Category and Action Filtering**: Category dropdown filters available actions dynamically. Selecting a category narrows the action dropdown to only show actions within that category.
- **API Access Toggle**: "Show API requests" switch (off by default) controls whether `API_ACCESS` entries are included. When off, API proxy request logs are excluded to reduce noise.
- **Human-Readable Labels**: ~50 action types and 11 categories are displayed with human-readable labels (e.g., `MODEL_CREATED` → "Model Created"). Raw database values are shown in tooltips.
- **Search and Date Filters**: Free-text search across action, resource ID, and metadata. Date range filters for start and end dates.
- **Pagination**: Configurable page size with top and bottom pagination controls.
- **Expandable Rows**: Rows with metadata can be expanded to view full JSON details and error messages.

### Navigation

Access from the admin sidebar: **Audit Log** menu item.

### API Endpoints

- `GET /api/v1/admin/audit` — Paginated logs with filtering
- `GET /api/v1/admin/audit/actions` — Distinct action types (filterable by category)
- `GET /api/v1/admin/audit/categories` — Distinct resource types (categories)

For detailed endpoint documentation, see the [REST API Reference](../api/rest-api.md#admin-audit-log-apiv1adminaudit).

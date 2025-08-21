# Admin Tools Page

## Overview

The Admin Tools page (`/admin/tools`) provides administrative tools for managing LiteMaaS system configurations. Currently, it focuses on **Models Management**, allowing administrators to manually synchronize AI models from LiteLLM.

### Access Requirements

The Tools page is restricted to users with administrative privileges:

- **Admin users**: Full access with ability to trigger synchronization
- **Admin-readonly users**: View-only access to sync information and statistics
- **Regular users**: No access (redirected or receive 403 error)

## Models Management Panel

The Models Management panel is the primary feature of the Tools page, providing control over model synchronization between LiteLLM and the LiteMaaS database.

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

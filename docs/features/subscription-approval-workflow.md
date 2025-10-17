# Subscription Approval Workflow

## Overview

The subscription approval workflow enables administrators to control access to sensitive or costly AI models through a restriction and approval system. Models marked as "restricted access" require administrative approval before users can access them, providing governance and cost control while maintaining model visibility in the catalog.

## Key Features

- **Restricted Model Flagging**: Administrators can mark models as requiring approval
- **Pending Approval State**: Subscription requests enter a pending state awaiting admin review
- **Bulk Operations**: Approve or deny multiple requests simultaneously
- **Request Review**: Users can re-request access after denial
- **Full Audit Trail**: Complete history of all status changes with reasons
- **Role-Based Permissions**: Granular access control (admin vs adminReadonly)
- **Automatic Cascade**: Access revocation when models become restricted

---

## For Users

### Subscribing to Restricted Models

Restricted models are identified with an orange "Restricted Access" badge in the model catalog.

**Subscription Process**:

1. **Browse Models**: Navigate to the model catalog
2. **Identify Restricted Models**: Look for models with the "Restricted Access" badge
3. **Subscribe**: Click "Subscribe" on a restricted model
4. **Pending State**: Your subscription is created with status "Pending Approval"
5. **Wait for Approval**: Check "My Subscriptions" to see the pending status
6. **After Approval**: Manually add the model to your API keys

**Important Notes**:

- You can only have one subscription per model (enforced at database level)
- Pending subscriptions cannot be used to create API keys
- You'll see "Pending Approval" status until an admin reviews your request

### Understanding Subscription Statuses

Your subscription can have the following statuses:

| Status      | Badge Color | Description               | Actions Available                    |
| ----------- | ----------- | ------------------------- | ------------------------------------ |
| **Pending** | Blue        | Awaiting admin approval   | Cancel subscription                  |
| **Active**  | Green       | Approved and ready to use | Add to API keys, Cancel subscription |
| **Denied**  | Red         | Request was denied        | Request Review, Delete subscription  |

### Re-requesting Access After Denial

If your subscription request was denied, you can request a review:

**Steps**:

1. Go to **My Subscriptions**
2. Find the subscription with "Access Denied" status
3. Read the admin's denial reason (displayed under "Admin Comment")
4. Click **"Request Review"** button
5. Your subscription moves back to "Pending" status
6. Wait for admin to review your request again

**Important**:

- You cannot create a new subscription if you already have a denied one for the same model
- Use "Request Review" instead to move the denied subscription back to pending
- Previous denial reasons are cleared when you request review

---

## For Administrators

### Viewing Subscription Requests

Navigate to **Admin → Subscription Requests** to access the management panel.

**Default View**: Shows only pending requests

**Filters Available**:

- **Status**: pending, active, denied (multi-select with checkboxes + "Select All")
- **Model**: Multi-select specific models
- **User**: Searchable dropdown to find specific users
- **Date Range**: Filter by last status change date

**Table Columns**:

- User information (name, email)
- Model information (name, provider)
- Current status with badge
- Admin comment/reason
- Requested date
- Last status change date
- Actions menu (⋮)

**Manual Refresh**: Click the "Refresh" button to reload data (no automatic polling)

### Approving Subscription Requests

#### Single Approval

1. Find the pending subscription in the table
2. Click the actions menu (⋮) in the row
3. Select **"Approve"**
4. Optionally add a comment (e.g., "Approved for research project")
5. Click **"Confirm"**

**Result**: Subscription status changes to "active" and user can add model to API keys

#### Bulk Approval

1. Select multiple pending subscriptions using checkboxes
2. Click **"Approve Selected"** button at the top
3. Optionally add a comment (applies to all selected subscriptions)
4. Click **"Confirm"**

**Result**: A modal shows success/failure counts for each subscription

**Bulk Result Modal**:

- Shows table with subscription ID, user/model info, status (✓/✗), and error messages
- Displays success count and failure count
- Lists any errors that occurred during bulk operation

### Denying Subscription Requests

#### Single Denial

1. Find the subscription in the table
2. Click the actions menu (⋮)
3. Select **"Deny"**
4. **Enter required reason** (e.g., "Model requires data science certification")
5. Click **"Confirm"**

**Result**:

- Subscription status changes to "denied"
- Model is automatically removed from all user's API keys
- User sees the denial reason in their subscription view

#### Bulk Denial

1. Select multiple subscriptions using checkboxes
2. Click **"Deny Selected"** button
3. **Enter required reason** (applies to all selected subscriptions)
4. Click **"Confirm"**

**Result**: A modal shows success/failure counts for each subscription

**Important**:

- Denial reason is **required** for all denials
- Reasons are visible to users
- Models are automatically removed from API keys upon denial

### Reverting Subscription Decisions

Administrators can change subscription status directly for corrections or policy changes.

**Allowed Transitions**:

- active → denied (revoke approval)
- denied → active (override denial)
- denied → pending (back to review queue)
- active → pending (re-review required)

**Steps**:

1. Find the subscription you want to revert
2. Click the actions menu (⋮)
3. Select **"Revert Status"**
4. Choose the new status
5. Optionally add a reason for the change
6. Click **"Confirm"**

**Important**:

- Same-state transitions are blocked (e.g., active → active)
- All changes are logged in the audit trail
- Reasons are visible to users

### Deleting Subscriptions Permanently

⚠️ **Admin-Only Operation** - Requires `admin:subscriptions:delete` permission

**Permission Check**: This feature is **NOT available** to adminReadonly users. Only users with the full `admin` role can permanently delete subscriptions.

**Use Cases**:

- Removing test/duplicate subscriptions
- Cleaning up obsolete subscription requests
- Administrative data management

**Steps**:

1. Find the subscription in the table
2. Click the actions menu (⋮)
3. Select **"Delete Subscription"** (only visible to admin users)
4. Optionally enter a reason (saved in audit log)
5. Confirm deletion

**Important**:

- This action **permanently** deletes the subscription from the database
- Cannot be undone
- Creates an audit log entry with admin user ID and optional reason
- Users will need to create a new subscription if they want access later

### Marking Models as Restricted Access

Control which models require approval through the Admin Models interface.

**Steps**:

1. Navigate to **Admin → Models**
2. Edit an existing model or create a new one
3. Check the **"Require Admin Approval"** checkbox
4. If the model has active subscriptions, you'll see a warning modal
5. Confirm the restriction change

**Warning Modal** (for existing models with active subscriptions):

```
Enable Restricted Access?

This will move all active subscriptions for this model to pending status and
remove the model from existing API keys. Users will need to be re-approved.

[Continue] [Cancel]
```

### Cascade Behavior: Marking Existing Model as Restricted

When you mark a model with active subscriptions as "restricted access", the system automatically:

**1. Active Subscriptions → Pending**:

- All active subscriptions for that model transition to "pending" status
- Require re-approval by admin
- Status reason set to: "Model marked as restricted access - requires re-approval"

**2. Remove from API Keys**:

- Model is automatically removed from all affected users' API keys
- Updates happen in LiteLLM **first** (security priority)
- Database updates only after LiteLLM succeeds
- Users immediately lose access to the model

**3. After Re-approval**:

- Admin approves the pending subscription
- Subscription becomes "active"
- User must **manually** re-add the model to desired API key(s)
- No automatic restoration (prevents unintended key modifications)

**Rationale**: Manual re-addition gives users control over which API keys should have access and prevents automatic changes to production keys.

**Unrestricting Models**:
When you remove the "restricted access" flag from a model:

- All pending subscriptions automatically become "active"
- Status reason set to: "Auto-approved: model restriction removed"
- Users can immediately add the model to API keys

### Permission Levels

The subscription approval workflow uses three permission levels:

| Permission                   | Role                 | Capabilities                                |
| ---------------------------- | -------------------- | ------------------------------------------- |
| `admin:subscriptions:read`   | admin, adminReadonly | View all subscription requests and history  |
| `admin:subscriptions:write`  | admin                | Approve, deny, revert subscription requests |
| `admin:subscriptions:delete` | admin                | Permanently delete subscriptions            |

**AdminReadonly Behavior**:

- Can view the subscription requests panel
- Can see all pending, active, and denied subscriptions
- **Cannot** approve, deny, or revert subscriptions (buttons disabled)
- **Cannot** delete subscriptions (action not shown in menu)
- Useful for demonstration and monitoring purposes

---

## Status Flow Diagram

```
                Subscribe to Restricted Model
                            ↓
                       PENDING
                            ↓
                   ┌────────┴─────────┐
                   ↓                  ↓
               APPROVED            DENIED
               (Active)               ↓
                                Request Review
                                     ↓
                                 PENDING
                                     ↓
                           (Admin re-reviews)
```

**State Descriptions**:

- **PENDING**: Awaiting admin approval, cannot be used
- **ACTIVE**: Approved by admin, can be added to API keys
- **DENIED**: Rejected by admin with reason, can request review

---

## Audit Trail

All subscription status changes are tracked in the `subscription_status_history` table.

**Tracked Information**:

- Subscription ID
- Old status → New status
- Change reason
- Changed by (admin user ID or system user)
- Timestamp of change

**System User**: Automated changes (like model restriction cascades) use a special system user ID: `00000000-0000-0000-0000-000000000001`

**Accessing Audit History**:

- Currently tracked in the database
- Future enhancement: Display full history in admin panel per subscription

---

## Notification Provisioning

The system includes hooks for future notification integration:

**Notification Triggers** (implemented but not sent):

- New pending subscription request → Notify admins
- Subscription approved → Notify user
- Subscription denied → Notify user with reason
- Review requested → Notify admins
- Model became restricted → Notify affected users

**Implementation**: `NotificationService` with async no-op methods ready for external service integration (email, push notifications, etc.)

---

## API Endpoints

For API integration details, see [REST API Documentation](../api/rest-api.md#admin-subscription-approval-endpoints).

**Key Endpoints**:

- `GET /api/v1/admin/subscriptions` - List subscription requests
- `POST /api/v1/admin/subscriptions/approve` - Bulk approve
- `POST /api/v1/admin/subscriptions/deny` - Bulk deny
- `POST /api/v1/admin/subscriptions/:id/revert` - Revert status
- `DELETE /api/v1/admin/subscriptions/:id` - Delete permanently
- `POST /api/v1/subscriptions/:id/request-review` - User request review

---

## Database Schema

For complete database schema details, see [Database Schema Documentation](../architecture/database-schema.md).

**Key Tables**:

- `models.restricted_access` - Boolean flag for restricted models
- `subscriptions` - Enhanced with status_reason, status_changed_at, status_changed_by
- `subscription_status_history` - Complete audit trail

---

## Best Practices

### For Administrators

1. **Provide Clear Denial Reasons**: Users see these reasons - be specific and helpful
2. **Review Regularly**: Check pending requests frequently to avoid user frustration
3. **Use Bulk Operations**: Efficiently process multiple similar requests
4. **Document Policies**: Maintain clear guidelines for which models require approval
5. **Audit Regularly**: Review approval patterns for compliance and consistency

### For System Administrators

1. **Monitor Cascade Operations**: Watch logs when marking models as restricted
2. **Backup Before Mass Changes**: Especially when unrestricting models with many pending subscriptions
3. **Test Permission Changes**: Verify adminReadonly users have read-only access
4. **Plan Communications**: Notify users before marking popular models as restricted

---

## Troubleshooting

### Users Cannot Add Model to API Key

**Symptom**: User has "active" subscription but cannot add model to API key

**Causes**:

1. Subscription status is not actually "active" (check My Subscriptions)
2. Frontend cache is stale (refresh the page)
3. Backend validation rejecting non-active subscriptions

**Solution**: Verify subscription status is "active", refresh page, contact admin if issue persists

### Bulk Operation Partially Failed

**Symptom**: Some subscriptions approved/denied, others failed

**Cause**: Individual subscription validation errors (duplicate, not found, etc.)

**Solution**: Check the bulk result modal for specific error messages, retry failed subscriptions individually

### Model Removed from API Keys Unexpectedly

**Symptom**: Model disappeared from user's API keys

**Causes**:

1. Admin marked model as restricted (check subscription status)
2. Admin denied user's subscription
3. Model was deleted from system

**Solution**: Check subscription status, request review if denied, contact admin if model is restricted

### Cannot Delete Subscription

**Symptom**: Delete action not available or fails

**Causes**:

1. User has adminReadonly role (delete requires full admin)
2. Subscription already deleted
3. Database constraint preventing deletion

**Solution**: Verify admin role has `admin:subscriptions:delete` permission, check if subscription exists

---

## Related Documentation

- [User Roles & Administration](user-roles-administration.md) - RBAC system details
- [REST API Reference](../api/rest-api.md) - Complete API endpoint documentation
- [Database Schema](../architecture/database-schema.md) - Database structure and constraints

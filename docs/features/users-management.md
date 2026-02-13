# Users Management

## Overview

The admin users management feature provides a consolidated interface for administrators to view and manage individual users. Accessed from the Admin Users table, it opens a modal with tabbed views covering a user's profile, budget and rate limits, API keys, and subscriptions — all in one place.

## Key Features

- **Consolidated Management Modal**: Single modal with four tabs for complete user management
- **Role Management**: Toggle user/admin/adminReadonly roles with conflict detection
- **Budget & Rate Limits**: Configure max budget, TPM, and RPM limits with utilization tracking
- **API Key Lifecycle**: Create, view, and revoke API keys for users
- **Auto-Subscription**: API key creation automatically creates or reactivates model subscriptions
- **Subscription Visibility**: View all user subscriptions with status and reason tracking
- **Full Audit Trail**: All admin actions logged with admin user ID, target user, and metadata
- **RBAC**: Two permission levels control view-only vs. full management access

---

## RBAC Permissions

| Permission    | Role                | Capabilities                                                |
| ------------- | ------------------- | ----------------------------------------------------------- |
| `users:read`  | admin, adminReadonly | View user details, API keys, subscriptions                  |
| `users:write` | admin                | Update budget/limits, create/revoke API keys, update models |

**AdminReadonly Behavior**:

- Can view all user details, API keys, and subscriptions
- Cannot modify budget/limits (form fields shown as read-only)
- Cannot create or revoke API keys (buttons hidden)
- Cannot toggle user roles (switches disabled)

---

## UI Components

### Management Modal Tabs

The user management modal contains four tabs:

#### 1. Profile Tab (`UserProfileTab`)

Displays user profile information and role management.

**Information Shown**:

- Username, email, full name
- Account status (active/inactive) with icon and tooltip
- Last login date
- Account creation date

**Role Toggles** (admin only):

- `user` — Standard user access
- `admin` — Full administrative access
- `admin-readonly` — Read-only administrative access
- Conflict detection: warns if both admin and admin-readonly are selected

#### 2. Budget & Limits Tab (`UserBudgetLimitsTab`)

Configure budget and rate limits with real-time utilization display.

**Fields**:

- **Max Budget**: Dollar amount with $10 increment (shows current spend progress bar)
- **TPM Limit**: Tokens per minute with 1,000 increment
- **RPM Limit**: Requests per minute with 10 increment

**Utilization Display**:

- Progress bar with color coding: green (< 80%), warning (80-95%), danger (> 95%)
- Current spend / max budget ratio

#### 3. API Keys Tab (`UserApiKeysTab`)

Full API key lifecycle management.

**Table Columns**: Name, Status (color-coded label), Models (first 2 + overflow count), Last Used

**Actions** (admin only):

- **Create API Key**: Modal with name, model multi-select, expiration preset (never/30/60/90 days), max budget
- **Revoke**: Confirmation modal before deactivation
- **View Usage**: Link to admin usage analytics filtered by key

**Generated Key Display**: One-time display modal with copy-to-clipboard and security warning

#### 4. Subscriptions Tab (`UserSubscriptionsTab`)

Read-only view of all user subscriptions.

**Table Columns**: Model Name, Provider, Status (color-coded), Created Date

**Status Colors**: green = active, orange = pending, red = denied/revoked/suspended

---

## API Endpoints

All endpoints are under `/api/v1/admin/users`.

| Method | Path                       | Permission    | Description                          |
| ------ | -------------------------- | ------------- | ------------------------------------ |
| GET    | `/:id`                     | `users:read`  | Get detailed user info               |
| PATCH  | `/:id/budget-limits`       | `users:write` | Update budget and rate limits        |
| GET    | `/:id/api-keys`            | `users:read`  | List user's API keys                 |
| POST   | `/:id/api-keys`            | `users:write` | Create API key (auto-subscription)   |
| DELETE | `/:id/api-keys/:keyId`     | `users:write` | Revoke an API key                    |
| PATCH  | `/:id/api-keys/:keyId`     | `users:write` | Update API key models/name           |
| GET    | `/:id/subscriptions`       | `users:read`  | List user's subscriptions            |

For complete request/response schemas, see [REST API Reference](../api/rest-api.md#user-management-apiv1adminusers).

---

## Auto-Subscription System

When an admin creates or updates an API key for a user, the system automatically handles subscriptions:

1. **Check existing subscriptions** for each specified model
2. **Create new subscription** if none exists (status: `active`)
3. **Reactivate subscription** if a cancelled one exists for that model
4. **Skip** if an active subscription already exists
5. **Log** all auto-created/reactivated subscriptions in the audit trail

This eliminates the manual step of creating subscriptions before assigning API keys, streamlining the admin workflow.

---

## Audit Trail

All admin user management actions are logged to the `audit_logs` table.

**Tracked Actions**:

| Action                    | Details Logged                                     |
| ------------------------- | -------------------------------------------------- |
| Budget/limits update      | Admin ID, target user ID, old values, new values   |
| API key creation          | Admin ID, target user ID, key ID, models           |
| API key revocation        | Admin ID, target user ID, key ID, reason           |
| API key model update      | Admin ID, target user ID, key ID, model changes    |
| Auto-subscription create  | Admin ID, target user ID, model ID, subscription ID |

---

## Typical Admin Workflow

### Setting Up a New User

1. Navigate to **Admin → Users**
2. Find the user in the table and click to open management modal
3. **Profile Tab**: Verify user information, assign appropriate roles
4. **Budget & Limits Tab**: Set max budget and rate limits
5. **API Keys Tab**: Click "Create API Key"
   - Enter a descriptive name
   - Select the models the user needs access to
   - Set expiration and budget if needed
   - Click "Create" — subscriptions are auto-created
6. Copy the generated key and provide it to the user

### Reviewing User Resources

1. Open the user management modal
2. **Budget & Limits Tab**: Check utilization progress bar
3. **API Keys Tab**: Review active keys, check last used dates
4. **Subscriptions Tab**: Verify subscription statuses

### Revoking Access

1. Open the user management modal
2. **API Keys Tab**: Click revoke on the target API key
3. Confirm revocation — key is deactivated in both LiteMaaS and LiteLLM

---

## Related Documentation

- [User Roles & Administration](user-roles-administration.md) — RBAC system details
- [Subscription Approval Workflow](subscription-approval-workflow.md) — Restricted model approval process
- [REST API Reference](../api/rest-api.md#user-management-apiv1adminusers) — Complete API endpoint documentation

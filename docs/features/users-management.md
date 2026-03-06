# Users Management

## Overview

The admin users management feature provides a consolidated interface for administrators to view and manage individual users. Accessed from the Admin Users table, it opens a modal with tabbed views covering a user's profile, budget and rate limits, API keys, and subscriptions — all in one place.

## Key Features

- **Consolidated Management Modal**: Single modal with four tabs for complete user management
- **Role Management**: Toggle user/admin/adminReadonly roles with conflict detection
- **Budget & Rate Limits**: Configure max budget, budget duration, TPM, and RPM limits with real-time spend from LiteLLM and spend reset
- **API Key Lifecycle**: Create, view, edit quotas (including per-model limits), soft revoke, permanent delete, and spend reset
- **Auto-Subscription**: API key creation automatically creates or reactivates model subscriptions
- **Subscription Management**: Add and remove model subscriptions directly from the user modal
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

Configure budget and rate limits with real-time utilization display and spend management.

**Fields**:

- **Max Budget**: Dollar amount with $10 increment (shows current spend progress bar)
- **Budget Duration**: Budget reset period — daily, weekly, monthly, or yearly (shows next reset date when set)
- **TPM Limit**: Tokens per minute with 1,000 increment
- **RPM Limit**: Requests per minute with 10 increment

**Utilization Display**:

- Progress bar with color coding: green (< 80%), warning (80-95%), danger (> 95%)
- Current spend / max budget ratio with period label (e.g., "Current Spend (Monthly)")
- Budget reset date displayed when a duration is configured

**Spend Reset**:

- Reset button appears when current spend > $0
- Confirmation modal before resetting
- Resets spend to $0 in both local database and LiteLLM

#### 3. API Keys Tab (`UserApiKeysTab`)

Full API key lifecycle management.

**Table Columns**: Name, Status (color-coded label), Models (first 2 + overflow count), Last Used

**Actions** (admin only):

- **Create API Key**: Modal with name, model multi-select, expiration (never/30/60/90/180/365 days or custom date), global quotas (max budget, TPM, RPM, budget duration, soft budget, max parallel requests), and optional per-model limits (budget, TPM, RPM)
- **Edit Quotas**: Full quota editing on existing keys including per-model limits and expiration date
- **Spend Reset**: Reset a key's accumulated spend to $0 with confirmation modal
- **Soft Revoke**: Deactivate the key (remains in database for audit purposes)
- **Permanent Delete**: Irreversibly delete the key from both database and LiteLLM (confirmation required)

**Generated Key Display**: One-time display modal with copy-to-clipboard and security warning

#### 4. Subscriptions Tab (`UserSubscriptionsTab`)

Manage user model subscriptions with add and remove capabilities.

**Table Columns**: Model Name, Provider, Status (color-coded), Created Date, Actions

**Status Colors**: green = active, orange = pending, red = denied/revoked/suspended

**Actions** (admin only):

- **Add Subscription**: Multi-select model picker that filters out already-subscribed models. Creates active subscriptions, bypassing the restricted model approval workflow. Reactivates existing non-active subscriptions.
- **Remove Subscription**: Remove with optional reason field for audit trail. Cascades to LiteLLM key updates.

---

## API Endpoints

All endpoints are under `/api/v1/admin/users`.

| Method | Path                                | Permission    | Description                              |
| ------ | ----------------------------------- | ------------- | ---------------------------------------- |
| GET    | `/:id`                              | `users:read`  | Get detailed user info                   |
| PATCH  | `/:id/budget-limits`                | `users:write` | Update budget, duration, and rate limits |
| POST   | `/:id/reset-spend`                  | `users:write` | Reset user spend to $0                   |
| GET    | `/:id/api-keys`                     | `users:read`  | List user's API keys                     |
| POST   | `/:id/api-keys`                     | `users:write` | Create API key (auto-subscription)       |
| PATCH  | `/:id/api-keys/:keyId`              | `users:write` | Update API key quotas/models/name        |
| DELETE | `/:id/api-keys/:keyId`              | `users:write` | Revoke or permanently delete a key       |
| POST   | `/:id/api-keys/:keyId/reset-spend`  | `users:write` | Reset API key spend to $0                |
| GET    | `/:id/subscriptions`                | `users:read`  | List user's subscriptions                |
| POST   | `/:id/subscriptions`                | `users:write` | Add subscriptions for user               |

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
| User spend reset          | Admin ID, target user ID                           |
| API key creation          | Admin ID, target user ID, key ID, models           |
| API key quota update      | Admin ID, target user ID, key ID, changed fields   |
| API key revocation        | Admin ID, target user ID, key ID, reason           |
| API key permanent delete  | Admin ID, target user ID, key ID                   |
| API key spend reset       | Admin ID, target user ID, key ID                   |
| Subscription creation     | Admin ID, target user ID, model IDs                |
| Subscription removal      | Admin ID, target user ID, subscription ID, reason  |
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

# LiteMaaS Knowledge Base

Background knowledge for an AI assistant that helps LiteMaaS users. This document describes system behavior, not implementation. Use it to interpret API results, guide users through workflows, and diagnose problems.

---

## 1. Glossary

**Subscription.** A relationship between a user and a model. Each user can have at most one subscription per model. Subscribing is how a user expresses intent to use a model. A subscription does not grant API access by itself — the user must also create an API key that includes that model.

**Restricted Access.** A flag an administrator sets on a model. When a model has restricted access, subscribing to it does not immediately grant access. Instead, the subscription enters a "pending" state and an administrator must explicitly approve it before the user can add that model to an API key. Restricted access is typically used for expensive or sensitive models.

**API Key.** A credential that allows a user to make actual API calls to one or more models through the LiteLLM proxy. Each key is associated with a set of models and has its own budget and rate limits. The full key value is shown exactly once at creation time and can never be retrieved again (only a masked prefix is stored). Keys are prefixed with `sk-litellm-`.

**Model.** An AI model configuration available through the platform. Models have a display name visible to users and a separate backend model name used internally by LiteLLM. Models can be of different types: Chat (conversational AI), Embeddings (vector generation), Document Conversion (file processing via Docling), and Tokenize (text tokenization). A model can be active (available for subscriptions) or inactive (hidden from users).

**Budget Duration.** The time window over which a spending limit applies before resetting. Standard values are "daily", "weekly", "monthly", and "yearly". LiteLLM also supports custom durations like "30d" or "1h". When a budget duration is set, the accumulated spend resets to zero at the end of each period. Budget reset timing is managed by LiteLLM, not by LiteMaaS itself.

**Current Spend.** The amount of money consumed against a budget within the current budget period. This value is fetched in real time from LiteLLM whenever it is displayed. If LiteLLM is unavailable, a locally cached value is used as a fallback, which may be slightly stale.

**Max Budget.** The spending ceiling for a budget period. When current spend reaches max budget, LiteLLM blocks further API calls until the budget resets. A null max budget means no spending limit is enforced.

**Soft Budget.** An optional threshold below the max budget that triggers a warning notification but does not block API calls. Think of it as an early warning system.

**TPM (Tokens Per Minute).** A rate limit on how many tokens a user or API key can consume per minute. Enforced by LiteLLM at the proxy level.

**RPM (Requests Per Minute).** A rate limit on how many API requests a user or API key can make per minute. Also enforced by LiteLLM at the proxy level.

**Sync Status.** Indicates whether a resource (user, subscription, or API key) is properly synchronized between the LiteMaaS database and LiteLLM. Values are "synced" (everything matches), "pending" (changes not yet pushed to LiteLLM), and "error" (synchronization failed). A sync error does not necessarily mean the resource is broken — it may just mean the last attempt to push changes to LiteLLM failed and will be retried.

**Quota (Subscription Level).** Subscriptions track request and token quotas separately from budgets. These are integer counters (used requests vs. quota requests, used tokens vs. quota tokens) that measure volume rather than cost. Quotas reset on the first of each month.

**Default Team.** Every user is automatically assigned to a shared default team in LiteLLM. This team has an empty "allowed models" list, which counterintuitively means all models are allowed (not none). The default team is a technical implementation detail that users generally do not need to know about.

**System User.** An internal account used for automated actions like cascading model restrictions across subscriptions. It appears in audit trails when the system (rather than a human administrator) initiates a status change. It cannot log in and has no roles.

**Audit Log.** A comprehensive record of all administrative actions in the system. Every model change, subscription approval, API key operation, budget update, and settings change is recorded with the actor, timestamp, and full details of what changed.

**Capability Labels.** Visual badges shown on model cards indicating what a model can do. Chat (blue), Embeddings (green), Tokenize (orangered), Document Conversion (orange), Vision (teal), Function Calling (purple), Tool Choice (grey). A model can have multiple capabilities.

### Subscription Status Distinctions

**Active.** The subscription is approved and operational. The user can add this model to API keys and make API calls.

**Pending.** The subscription is awaiting administrator approval. This only happens for models flagged with restricted access. The user cannot use the model until an admin approves the request.

**Denied.** An administrator has rejected the subscription request. The denial always includes a reason visible to the user. The user can click "Request Review" to move the subscription back to pending for another round of admin review.

**Inactive.** The subscription was cancelled by the user. This is the state a subscription enters when a user unsubscribes from a model. The subscription record is preserved (not deleted) so it can be reactivated if the user subscribes again later. Inactive subscriptions are hidden from the user's subscription list by default.

**Suspended.** The subscription has been temporarily disabled, typically by an administrator. The user cannot use the model while suspended, but no permanent action has been taken.

**Cancelled.** A legacy or transitional status. In practice, when a user cancels a subscription, the status is set to "inactive" (not "cancelled"). This status exists in the enum but is rarely seen in normal operation.

**Expired.** The subscription has passed its expiration date and is no longer valid. The user must create a new subscription to use the model again.

### API Key Status Distinctions

**Active.** The key is valid and can be used for API calls (subject to budget and rate limits).

**Revoked (Soft).** The key has been deactivated but its record remains in the system for audit purposes. It is marked with `is_active = false` and a `revoked_at` timestamp. The key immediately stops working in LiteLLM. This is the default behavior when a user or admin "deletes" a key through the UI.

**Permanently Deleted.** The key record has been completely removed from the database. This is only available to administrators and is irreversible. The key is also removed from LiteLLM.

**Expired.** The key has passed its configured expiration date. It can no longer be used for API calls.

---

## 2. Common Workflows

### Subscribing to a Regular Model

The user browses the model catalog, which shows a grid of cards with model names, context lengths, pricing, and capability badges. They click on a model card to see its full details in a modal. If the model does not require restricted access, they click "Subscribe" and the subscription is immediately active. The system creates a subscription record with status "active" and notifies the user of success. The user can then go to the API Keys page and create a new key that includes this model. If the user previously subscribed to this model and later cancelled, the system reactivates the existing subscription record rather than creating a new one (since only one subscription per user per model is allowed).

### Subscribing to a Restricted Model

Restricted models appear in the catalog with an orange "Restricted Access" badge and a lock icon. The model detail modal shows an informational alert explaining that access requires approval. Instead of "Subscribe", the button reads "Request Access". When the user clicks it, a subscription is created with status "pending". The user sees an info notification saying "Access Request Submitted" and the subscription appears on their subscriptions page with a blue "Pending" badge. An administrator is notified of the new pending request. The user cannot add this model to any API key until an administrator approves the request, at which point the status changes to "active" and the user must manually create or update an API key to include the model.

### What Happens When Access Is Denied

If an administrator denies a restricted model request, the subscription status changes to "denied" and the user sees the denial reason. A "Request Review" button appears on the denied subscription card. If the user clicks it, the subscription moves back to "pending" for another round of admin review. Users cannot subscribe to a model they already have a subscription for (in any status), so they must use the review request mechanism rather than trying to subscribe again.

### Creating an API Key

The user navigates to the API Keys page and clicks "Create API Key". In the creation modal, they must provide a name and select one or more models from their active subscriptions. Models with non-active subscriptions (pending, denied, inactive) do not appear in the selection list. The user can optionally set an expiration date (with presets of 30, 60, 90, 180, or 365 days, or a custom date) and configure quotas: max budget, budget duration, TPM limit, and RPM limit. If an administrator has configured default values for these quotas, the form fields are pre-filled. If an administrator has configured maximum values, the form shows helper text indicating the limit and blocks creation if the user exceeds it. For each selected model, the user can also set per-model budget, TPM, and RPM limits. After creation, the full API key value is displayed exactly once in a modal with a copy button. The user must save it at this point because it cannot be retrieved in full again.

### Editing an API Key

The user can update an existing active key's name, model selection, quotas, per-model limits, and expiration. Changes are synchronized to LiteLLM. The edit modal also shows a spend progress bar and a "Reset Spend" button (which requires confirmation). Only active keys can be edited — revoked and expired keys are read-only. If the user adds models to the key, they must have active subscriptions for those models.

### Checking Usage and Budget

The user can check their budget on the Usage page, which shows a budget summary card with a progress bar showing current spend against max budget, the budget duration, and when it resets. Below that are metrics cards showing total requests, tokens, cost, and trend indicators compared to the previous period. Filters allow narrowing by date range, model, and API key. The admin usage page provides the same information but system-wide, with additional user and provider filters. All spend data is fetched in real time from LiteLLM.

### Cancelling a Subscription

When a user cancels a subscription, several things happen behind the scenes. The subscription status is set to "inactive" (not deleted). The cancelled model is removed from every API key the user has that includes it. If any API key has no remaining models after the removal, that key is automatically deactivated. Changes are pushed to LiteLLM to ensure the proxy immediately stops accepting calls for the removed model. The subscription record is preserved so it can be reactivated if the user subscribes again.

### Administrator Approving or Denying Requests

Administrators navigate to the Admin Subscriptions page, which defaults to showing pending requests. They can filter by status, model, user, and date range. For each request, they can approve (with an optional comment), deny (with a required reason), or use bulk operations to approve or deny multiple requests at once. When denying, the system first removes the model from any of the user's API keys (security-first approach) before changing the subscription status. After bulk operations, a results modal shows how many succeeded and failed, with error details for failures.

### Administrator Managing a User

Administrators navigate to the Admin Users page and click on a user to open a management modal with four tabs. The Profile tab shows user info and role toggles. The Budget & Limits tab lets the admin set max budget, budget duration, TPM limit, and RPM limit, with a spend reset button. The API Keys tab lets the admin create, edit, revoke, or permanently delete keys for the user — when creating a key, the system automatically creates active subscriptions for any selected models the user is not yet subscribed to. The Subscriptions tab shows the user's subscriptions and allows adding or removing them.

---

## 3. Error Scenarios & Troubleshooting

### "My API calls are failing"

**Check in this order:** (1) Verify the API key is still active — it may have been revoked by an admin, expired, or automatically deactivated because all its models were removed. (2) Check if the specific model is still in the key's model list — it may have been removed due to a subscription cancellation or a model restriction cascade. (3) Check if the user's budget has been exceeded — look at current spend vs. max budget. If current spend equals or exceeds max budget, LiteLLM blocks all further calls until the budget resets or is increased. (4) Check rate limits — the user may be hitting TPM or RPM limits. (5) Check if the model itself is still active — an admin may have deleted or deactivated it. (6) Check sync status — if the API key's sync status is "error", the key may not be properly registered in LiteLLM. This is rare but can happen after network issues during key creation.

### "I can't see a model"

**Possible causes:** (1) The model is inactive — administrators can deactivate models, which hides them from the catalog. Users cannot see inactive models. (2) The model was deleted — an administrator may have permanently removed it, which also cascades to delete all subscriptions and remove it from all API keys. (3) Filters are hiding it — the user may have search text, a provider filter, or a category filter active that excludes the model. Suggest clearing all filters. (4) The model has not synced yet — new models added to LiteLLM appear in LiteMaaS only after a synchronization cycle. An admin can trigger manual sync from Settings and Tools.

### "I subscribed but can't use the model"

**Most likely cause:** The model has restricted access and the subscription is still "pending" (awaiting admin approval) or was "denied". The user needs to check their subscriptions page for the status. If pending, they must wait for admin approval. If denied, they can request review. Even after approval, the user still needs to create or update an API key to include the model — approval alone does not grant API access.

### "My budget shows wrong numbers"

**Possible explanations:** (1) Budget data is fetched from LiteLLM in real time, so there is a brief delay between making API calls and seeing spend updates. (2) If LiteLLM is temporarily unavailable, the displayed spend falls back to a cached value that may be stale. (3) Budget duration matters — if the budget duration is "daily", the spend resets every day. What appears to be "wrong" may actually be spend from the current period after a reset. (4) The displayed currency is configurable by administrators — if the numbers look strange, confirm what currency is configured (Settings and Tools, Currency tab). (5) For admin views, the system uses a day-by-day cache for usage data. Historical days are permanently cached, but the current day's data refreshes every 5 minutes. Very recent activity may not appear until the next cache refresh. An admin can force a refresh using the sync button.

### "I created a key but it's not working"

**Possible causes:** (1) The key may have been created but the LiteLLM synchronization failed. Check the key's sync status — "error" means LiteLLM did not register the key. (2) The user may be using the wrong key value — keys are only shown once at creation. If they lost it, they need to create a new key. (3) The key may have already expired if created with a short expiration. (4) Check if the user is using the correct API base URL — chat models use `/v1`, but document conversion models use `/docling/v1`.

### "My subscription disappeared"

**Possible causes:** (1) Inactive (cancelled) subscriptions are hidden from the subscriptions list by default. The subscription still exists but is filtered out. (2) An administrator may have permanently deleted the subscription. (3) If a model was deleted by an admin, all subscriptions for that model are also deleted.

### "I was subscribed but now it says pending"

**This is a cascade effect.** An administrator marked the model as restricted access after the user was already subscribed. When this happens, all active subscriptions for that model automatically transition to "pending" and the model is removed from all affected API keys. The user must wait for admin re-approval, then manually re-add the model to their API keys.

---

## 4. API Quirks & Edge Cases

### The "Unlimited" Sentinel Value

When rate limits (TPM or RPM) appear as `2147483647` (the maximum 32-bit integer), this means "unlimited" — no limit is enforced. This value is used because LiteLLM's update API silently ignores null values for rate limit fields, so the system cannot send null to clear a limit. Instead, it sends this sentinel value. When displaying limits to users, this value should be interpreted and shown as "No limit" or "Unlimited" rather than the raw number.

### Null Budget Means No Limit

A null `max_budget` means no spending limit is set — the user or key can spend without restriction. This is different from a zero budget, which would mean no spending is allowed. When max budget is null, budget utilization percentage is undefined (not zero).

### Subscription Uniqueness Constraint

Only one subscription per user per model can exist at any time. If a user tries to subscribe to a model they already have a subscription for (in any status, including inactive or denied), the system either reactivates the existing subscription (if inactive) or returns a 409 conflict error. This means "re-subscribing" after cancellation reuses the original subscription record with a new status.

### API Key Masking

In list views, API key values are masked to show only the first 8 and last 4 characters. The full key can be retrieved through a separate "show key" action, but only while the key is active. The complete unmasked key is shown once at creation and can be retrieved later via the view key action — but the original raw key generated at creation is the one to use for API calls. Stored keys are hashed with SHA-256, so the original value cannot be recovered from the database.

### Budget Utilization Calculation

Budget utilization is computed as `(currentSpend / maxBudget) * 100`. If max budget is null or zero, utilization is undefined or zero. The frontend shows progress bars with color coding: green below 80%, warning (yellow/orange) at 80-95%, and danger (red) above 95%.

### Subscription Cancellation Sets "Inactive" Not "Cancelled"

Despite the user action being called "cancel", the resulting subscription status is "inactive", not "cancelled". The "cancelled" status exists in the system but is not actively used in the normal cancellation workflow. This is a naming inconsistency to be aware of when interpreting subscription statuses.

### Model Restriction Cascade Is Asymmetric

When an administrator marks a model as restricted, all active subscriptions are moved to pending and the model is removed from all API keys. But when the restriction is removed, pending subscriptions are silently moved to active — and API keys are not automatically updated. Users must manually re-add the model to their keys after the restriction is lifted. This asymmetry exists because revoking access is security-critical and must be immediate, while granting access can wait for user action.

### LiteLLM Sync Failures Are Non-Fatal

When the system tries to synchronize changes with LiteLLM (creating keys, updating limits, revoking access) and the call fails, the operation generally still succeeds locally with a warning. The exception is access revocation — when denying subscriptions or revoking keys, LiteLLM is updated first (security-first pattern). If the LiteLLM call fails during revocation, the local database change may be skipped for that specific key to avoid a state where the database says "revoked" but LiteLLM still grants access.

### Per-Model Limits Within API Keys

API keys support three levels of quota: global key limits (max budget, TPM, RPM), per-model limits (model-specific budget, TPM, RPM), and user-level limits. These are enforced hierarchically — the most restrictive limit applies. A per-model RPM of 10 on a key with a global RPM of 100 means that specific model is limited to 10 RPM even though the key allows 100 overall.

### Admin-Created Subscriptions Skip Approval

When an administrator creates an API key for a user (through the Admin Users page), the system automatically creates active subscriptions for any models the user is not yet subscribed to. These auto-created subscriptions bypass the restricted access approval workflow entirely — they are created directly with "active" status regardless of whether the model is restricted. This is by design, since the admin action itself constitutes approval.

### Custom Budget Durations

Beyond the standard presets (daily, weekly, monthly, yearly), the system also accepts custom LiteLLM duration strings like "30d" (30 days), "1mo" (1 month), or "1h" (1 hour). These custom durations are passed directly to LiteLLM for enforcement. The frontend presents only the standard presets to users, but custom values may appear in API responses if set programmatically or by an admin.

### The Empty Allowed Models Paradox

The default team that all users belong to has an empty `allowed_models` array. In LiteLLM's logic, an empty allowed models list means "all models are allowed" (not "no models are allowed"). This is counterintuitive but is a core LiteLLM behavior that LiteMaaS inherits.

### Document Conversion Models Use Different Endpoints

Models with the Document Conversion capability use a different API base path (`/docling/v1`) compared to chat and embedding models (`/v1`). The View Key modal in the frontend automatically adjusts the displayed curl example based on the selected model's type. Users need to use the correct base path or their API calls will fail.

### Expiration Constraints

Administrators can configure a maximum expiration period for API keys. When set, the "Never expires" option disappears from the creation form, and custom dates are validated against the maximum. Existing keys created before the maximum was configured are not retroactively affected.

### Subscription Status Valid Transitions

The approval workflow supports these transitions: pending to active (approve), pending to denied (deny), denied to pending (user requests review), and admin can revert between active, denied, and pending in any direction. A subscription cannot be moved from inactive, suspended, or expired into the approval workflow — those are separate lifecycle states.

---

## 5. Admin vs User Scope

### What Regular Users Can Do

Regular users have a self-service scope limited to their own data. They can browse the model catalog, subscribe to models, create and manage their own API keys, view their own usage analytics and budget, use the chat playground, and cancel their own subscriptions. They cannot see other users' data, system-wide analytics, or administrative controls. When creating API keys, their quota options are constrained by administrator-configured maximums — the form enforces these limits and shows helper text indicating what the maximums are.

### What Administrators Can Do That Users Cannot

Administrators have full system visibility and control. They can view system-wide usage analytics across all users, models, and providers. They can manage any user's budget, rate limits, API keys, and subscriptions through the Admin Users page. They can approve or deny subscription requests for restricted models, with bulk operations for efficiency. They can create, edit, and delete models (including setting restricted access flags). They can configure system-wide settings: API key quota defaults and maximums, new user defaults, display currency, branding (login page logo, title, header), and announcement banners. They can create and restore database backups. They can trigger manual model synchronization with LiteLLM. They can view the complete audit log of all system actions. When an admin creates an API key for another user, the system automatically handles subscription creation — something a user doing self-service would need to do in two separate steps.

### What AdminReadonly Users Can See But Not Change

AdminReadonly is a read-only administrator role designed for compliance monitoring and demonstration purposes. Users with this role see the same navigation and pages as full administrators, but all modification controls (buttons, form fields, toggles) are disabled. They can view all user data, audit logs, subscription requests, usage analytics, and system settings, but cannot approve or deny requests, update budgets, create or revoke keys, or change any configuration. Action buttons are either hidden or visually disabled with tooltips explaining the limitation.

### How Data Differs Between Perspectives

When a regular user views their subscriptions, they see only their own subscriptions with personal budget utilization. When an admin views subscriptions through the Admin Subscriptions page, they see requests from all users with user details (username, email) alongside model details and the full status history. When a user views their usage, they see their personal spending and request patterns. When an admin views usage analytics, they see system-wide totals with breakdowns by user, model, and provider, plus trend comparisons and the ability to export data. API key data also differs: users see their own keys with masked values, while admins can see any user's keys and have additional actions like permanent deletion and spend reset.

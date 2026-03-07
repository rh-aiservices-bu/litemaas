import type { TFunction } from 'i18next';

interface LabelMapping {
  i18nKey: string;
  defaultLabel: string;
}

export const AUDIT_CATEGORIES: Record<string, LabelMapping> = {
  AUTH: { i18nKey: 'pages.audit.categories.auth', defaultLabel: 'Authentication' },
  SECURITY: { i18nKey: 'pages.audit.categories.security', defaultLabel: 'Security' },
  API_KEY: { i18nKey: 'pages.audit.categories.apiKey', defaultLabel: 'API Keys' },
  API_KEY_OPERATION: {
    i18nKey: 'pages.audit.categories.apiKeyOperation',
    defaultLabel: 'API Key Operations',
  },
  SUBSCRIPTION: { i18nKey: 'pages.audit.categories.subscription', defaultLabel: 'Subscriptions' },
  USER: { i18nKey: 'pages.audit.categories.user', defaultLabel: 'Users' },
  MODEL: { i18nKey: 'pages.audit.categories.model', defaultLabel: 'Models' },
  TEAM: { i18nKey: 'pages.audit.categories.team', defaultLabel: 'Teams' },
  SYSTEM_SETTINGS: { i18nKey: 'pages.audit.categories.settings', defaultLabel: 'Settings' },
  USAGE_LOG: { i18nKey: 'pages.audit.categories.usage', defaultLabel: 'Usage' },
  API_ACCESS: { i18nKey: 'pages.audit.categories.apiAccess', defaultLabel: 'API Access' },
  backup: { i18nKey: 'pages.audit.categories.backup', defaultLabel: 'Backup' },
};

export const AUDIT_ACTION_LABELS: Record<string, LabelMapping> = {
  // Authentication
  LOGIN: { i18nKey: 'pages.audit.actions.login', defaultLabel: 'Login' },
  LOGOUT: { i18nKey: 'pages.audit.actions.logout', defaultLabel: 'Logout' },
  AUTH_DENIED: { i18nKey: 'pages.audit.actions.authDenied', defaultLabel: 'Auth Denied' },
  AUTH_FAILED: { i18nKey: 'pages.audit.actions.authFailed', defaultLabel: 'Auth Failed' },
  TOKEN_TOO_OLD: {
    i18nKey: 'pages.audit.actions.tokenTooOld',
    defaultLabel: 'Token Expired (Too Old)',
  },

  // Security
  RATE_LIMIT_EXCEEDED: {
    i18nKey: 'pages.audit.actions.rateLimitExceeded',
    defaultLabel: 'Rate Limit Exceeded',
  },
  KEY_OPERATION_RATE_LIMITED: {
    i18nKey: 'pages.audit.actions.keyOperationRateLimited',
    defaultLabel: 'Key Operation Rate Limited',
  },

  // API Keys
  API_KEY_CREATE: { i18nKey: 'pages.audit.actions.apiKeyCreate', defaultLabel: 'API Key Created' },
  API_KEY_UPDATE: { i18nKey: 'pages.audit.actions.apiKeyUpdate', defaultLabel: 'API Key Updated' },
  API_KEY_REVOKE: { i18nKey: 'pages.audit.actions.apiKeyRevoke', defaultLabel: 'API Key Revoked' },
  API_KEY_DELETE: { i18nKey: 'pages.audit.actions.apiKeyDelete', defaultLabel: 'API Key Deleted' },
  API_KEY_ROTATE: { i18nKey: 'pages.audit.actions.apiKeyRotate', defaultLabel: 'API Key Rotated' },
  API_KEY_EXPIRED: {
    i18nKey: 'pages.audit.actions.apiKeyExpired',
    defaultLabel: 'API Key Expired',
  },
  API_KEY_RETRIEVE_FULL: {
    i18nKey: 'pages.audit.actions.apiKeyRetrieveFull',
    defaultLabel: 'API Key Retrieved (Full)',
  },
  API_KEYS_CLEANUP: {
    i18nKey: 'pages.audit.actions.apiKeysCleanup',
    defaultLabel: 'API Keys Cleanup',
  },

  // Admin API Key Operations
  ADMIN_CREATE_API_KEY: {
    i18nKey: 'pages.audit.actions.adminCreateApiKey',
    defaultLabel: 'Admin Created API Key',
  },
  ADMIN_UPDATE_API_KEY: {
    i18nKey: 'pages.audit.actions.adminUpdateApiKey',
    defaultLabel: 'Admin Updated API Key',
  },
  ADMIN_REVOKE_API_KEY: {
    i18nKey: 'pages.audit.actions.adminRevokeApiKey',
    defaultLabel: 'Admin Revoked API Key',
  },
  ADMIN_DELETE_API_KEY: {
    i18nKey: 'pages.audit.actions.adminDeleteApiKey',
    defaultLabel: 'Admin Deleted API Key',
  },
  ADMIN_RESET_API_KEY_SPEND: {
    i18nKey: 'pages.audit.actions.adminResetApiKeySpend',
    defaultLabel: 'Admin Reset API Key Spend',
  },

  // Subscriptions
  SUBSCRIPTION_CREATE: {
    i18nKey: 'pages.audit.actions.subscriptionCreate',
    defaultLabel: 'Subscription Created',
  },
  SUBSCRIPTION_UPDATE: {
    i18nKey: 'pages.audit.actions.subscriptionUpdate',
    defaultLabel: 'Subscription Updated',
  },
  SUBSCRIPTION_CANCELLED: {
    i18nKey: 'pages.audit.actions.subscriptionCancelled',
    defaultLabel: 'Subscription Cancelled',
  },
  SUBSCRIPTION_APPROVED: {
    i18nKey: 'pages.audit.actions.subscriptionApproved',
    defaultLabel: 'Subscription Approved',
  },
  SUBSCRIPTION_DENIED: {
    i18nKey: 'pages.audit.actions.subscriptionDenied',
    defaultLabel: 'Subscription Denied',
  },
  SUBSCRIPTION_REVIEW_REQUESTED: {
    i18nKey: 'pages.audit.actions.subscriptionReviewRequested',
    defaultLabel: 'Subscription Review Requested',
  },
  SUBSCRIPTION_STATUS_REVERTED: {
    i18nKey: 'pages.audit.actions.subscriptionStatusReverted',
    defaultLabel: 'Subscription Status Reverted',
  },
  SUBSCRIPTION_DELETED_BY_ADMIN: {
    i18nKey: 'pages.audit.actions.subscriptionDeletedByAdmin',
    defaultLabel: 'Subscription Deleted by Admin',
  },
  BULK_SUBSCRIPTION_UPDATE: {
    i18nKey: 'pages.audit.actions.bulkSubscriptionUpdate',
    defaultLabel: 'Bulk Subscription Update',
  },
  ADMIN_CREATE_SUBSCRIPTIONS: {
    i18nKey: 'pages.audit.actions.adminCreateSubscriptions',
    defaultLabel: 'Admin Created Subscriptions',
  },
  ADMIN_AUTO_CREATE_SUBSCRIPTION: {
    i18nKey: 'pages.audit.actions.adminAutoCreateSubscription',
    defaultLabel: 'Auto-Created Subscription',
  },
  ADMIN_AUTO_ACTIVATE_SUBSCRIPTION: {
    i18nKey: 'pages.audit.actions.adminAutoActivateSubscription',
    defaultLabel: 'Auto-Activated Subscription',
  },

  // Users
  USER_UPDATE: { i18nKey: 'pages.audit.actions.userUpdate', defaultLabel: 'User Updated' },
  USER_BUDGET_UPDATE: {
    i18nKey: 'pages.audit.actions.userBudgetUpdate',
    defaultLabel: 'User Budget Updated',
  },
  USER_SPEND_RESET: {
    i18nKey: 'pages.audit.actions.userSpendReset',
    defaultLabel: 'User Spend Reset',
  },
  PROFILE_UPDATE: {
    i18nKey: 'pages.audit.actions.profileUpdate',
    defaultLabel: 'Profile Updated',
  },

  // Models
  MODEL_CREATE: { i18nKey: 'pages.audit.actions.modelCreate', defaultLabel: 'Model Created' },
  MODEL_UPDATE: { i18nKey: 'pages.audit.actions.modelUpdate', defaultLabel: 'Model Updated' },
  MODEL_DELETE: { i18nKey: 'pages.audit.actions.modelDelete', defaultLabel: 'Model Deleted' },
  MODELS_REFRESH: {
    i18nKey: 'pages.audit.actions.modelsRefresh',
    defaultLabel: 'Models Refreshed',
  },
  MODEL_MARKED_UNAVAILABLE_WITH_CASCADE: {
    i18nKey: 'pages.audit.actions.modelMarkedUnavailable',
    defaultLabel: 'Model Marked Unavailable (Cascade)',
  },
  MODEL_RESTRICTION_CHANGE: {
    i18nKey: 'pages.audit.actions.modelRestrictionChange',
    defaultLabel: 'Model Restriction Changed',
  },

  // Teams
  TEAM_CREATE: { i18nKey: 'pages.audit.actions.teamCreate', defaultLabel: 'Team Created' },
  TEAM_UPDATE: { i18nKey: 'pages.audit.actions.teamUpdate', defaultLabel: 'Team Updated' },
  TEAM_DELETE: { i18nKey: 'pages.audit.actions.teamDelete', defaultLabel: 'Team Deleted' },
  TEAM_MEMBER_ADD: {
    i18nKey: 'pages.audit.actions.teamMemberAdd',
    defaultLabel: 'Team Member Added',
  },
  TEAM_MEMBER_REMOVE: {
    i18nKey: 'pages.audit.actions.teamMemberRemove',
    defaultLabel: 'Team Member Removed',
  },
  TEAM_MEMBER_ROLE_UPDATE: {
    i18nKey: 'pages.audit.actions.teamMemberRoleUpdate',
    defaultLabel: 'Team Member Role Updated',
  },

  // Settings
  UPDATE_API_KEY_DEFAULTS: {
    i18nKey: 'pages.audit.actions.updateApiKeyDefaults',
    defaultLabel: 'API Key Defaults Updated',
  },
  UPDATE_USER_DEFAULTS: {
    i18nKey: 'pages.audit.actions.updateUserDefaults',
    defaultLabel: 'User Defaults Updated',
  },
  UPDATE_CURRENCY_SETTINGS: {
    i18nKey: 'pages.audit.actions.updateCurrencySettings',
    defaultLabel: 'Currency Settings Updated',
  },

  // Usage
  USAGE_DATA_CLEANUP: {
    i18nKey: 'pages.audit.actions.usageDataCleanup',
    defaultLabel: 'Usage Data Cleanup',
  },

  // Backup
  'backup:create': {
    i18nKey: 'pages.audit.actions.backupCreate',
    defaultLabel: 'Backup Created',
  },
  'backup:download': {
    i18nKey: 'pages.audit.actions.backupDownload',
    defaultLabel: 'Backup Downloaded',
  },
  'backup:delete': {
    i18nKey: 'pages.audit.actions.backupDelete',
    defaultLabel: 'Backup Deleted',
  },
  'backup:restore': {
    i18nKey: 'pages.audit.actions.backupRestore',
    defaultLabel: 'Backup Restored',
  },
  'backup:test-restore': {
    i18nKey: 'pages.audit.actions.backupTestRestore',
    defaultLabel: 'Backup Test Restored',
  },
};

export function getActionLabel(action: string, t: TFunction): string {
  const mapping = AUDIT_ACTION_LABELS[action];
  if (mapping) {
    return t(mapping.i18nKey, mapping.defaultLabel);
  }
  return action;
}

export function getCategoryLabel(resourceType: string, t: TFunction): string {
  const mapping = AUDIT_CATEGORIES[resourceType];
  if (mapping) {
    return t(mapping.i18nKey, mapping.defaultLabel);
  }
  return resourceType;
}

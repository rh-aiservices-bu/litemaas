/**
 * Test-specific i18n setup
 *
 * Provides a properly initialized i18next instance for testing
 * that doesn't conflict with the main application i18n setup
 */

import i18next from 'i18next';
import type { i18n as I18nInstance, TOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';

// Common test translations that match the patterns used in tests
const testTranslations = {
  // Navigation
  'nav.models': 'Models',
  'nav.subscriptions': 'Subscriptions',
  'nav.apiKeys': 'API Keys',
  'nav.usage': 'Usage',
  'nav.admin.settings': 'Settings',
  'nav.admin.users': 'Settings',
  'nav.home': 'Home',

  // Common UI elements
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.retry': 'Retry',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.view': 'View',
  'common.create': 'Create',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.actions': 'Actions',
  'common.status': 'Status',
  'common.name': 'Name',
  'common.description': 'Description',
  'common.createdAt': 'Created',
  'common.updatedAt': 'Updated',
  'common.yes': 'Yes',
  'common.no': 'No',

  // Pages
  'pages.home.title': 'Welcome to LiteMaaS',
  'pages.home.subtitle': 'Your AI Model Management Platform',
  'pages.home.cards.modelsAriaLabel': 'View available AI models',
  'pages.home.cards.modelsDescription': 'Browse and manage AI models',
  'pages.home.cards.subscriptionsAriaLabel': 'View your model subscriptions',
  'pages.home.cards.subscriptionsDescription': 'Manage your AI model subscriptions',
  'pages.home.cards.apiKeysAriaLabel': 'View your API keys',
  'pages.home.cards.apiKeysDescription': 'Manage your API access keys',
  'pages.home.cards.usageAriaLabel': 'View usage statistics',
  'pages.home.cards.usageDescription': 'Monitor your API usage and costs',

  // Models
  'pages.models.title': 'Available Models',
  'pages.models.subtitle': 'Browse and subscribe to AI models',
  'pages.models.searchPlaceholder': 'Search models...',
  'pages.models.filterByCategory': 'Filter by category',
  'pages.models.subscribe': 'Subscribe',
  'pages.models.subscribed': 'Subscribed',
  'pages.models.details': 'View Details',
  'pages.models.loadingTitle': 'Loading Models...',
  'pages.models.loadingDescription': 'Discovering available AI models from all providers',
  'pages.models.filters.allProviders': 'All Providers',
  'pages.models.filters.allCategories': 'All Categories',
  'pages.models.notifications.loadFailed': 'Failed to load models',
  'pages.models.notifications.loadError': 'Failed to load models',
  'pages.models.notifications.loadErrorDesc': 'An error occurred while loading models.',
  'pages.models.searchResults': '{{count}} result(s) found',
  'pages.models.modelUnavailable': 'This model is currently unavailable.',
  'pages.models.contextLabel': 'Context length:',
  'pages.models.pricingLabel': 'Pricing information unavailable',
  'pages.models.moreFeatures': '{{count}} more',
  'pages.models.subscribeToModel': 'Subscribe to Model',
  'pages.models.subscribing': 'Subscribing...',

  // Subscriptions
  'pages.subscriptions.title': 'My Subscriptions',
  'pages.subscriptions.subtitle': 'Manage your model subscriptions',
  'pages.subscriptions.pageTitle': 'My Subscriptions',
  'pages.subscriptions.pageSubtitle': 'Manage your model subscriptions',
  'pages.subscriptions.noSubscriptions': 'No subscriptions found',
  'pages.subscriptions.noSubscriptionsTitle': 'No subscriptions found',
  'pages.subscriptions.noSubscriptionsDescription':
    "You don't have any active subscriptions. Start by subscribing to an AI model.",
  'pages.subscriptions.status.active': 'Active',
  'pages.subscriptions.status.inactive': 'Inactive',
  'pages.subscriptions.status.pending': 'Pending',
  'pages.subscriptions.status.suspended': 'Suspended',
  'pages.subscriptions.status.expired': 'Expired',
  'pages.subscriptions.unsubscribe': 'Unsubscribe',
  'pages.subscriptions.newSubscription': 'New Subscription',
  'pages.subscriptions.viewDetails': 'View Details',
  'pages.subscriptions.viewDetailsForModel': 'View details for {{modelName}}',
  'pages.subscriptions.loadingTitle': 'Loading Subscriptions...',
  'pages.subscriptions.loadingDescription': 'Retrieving your subscription information',
  'pages.subscriptions.pricingUnavailable': 'Pricing information is not available',
  'pages.subscriptions.tokenUsageThisMonth': 'Token usage this month',
  'pages.subscriptions.quotaFormat': 'Quota: {{requests}} requests, {{tokens}} tokens',
  'pages.subscriptions.detailsTitle': 'Subscription Details',
  'pages.subscriptions.pricing': 'Pricing',
  'pages.subscriptions.statusLabel': 'Status',
  'pages.subscriptions.requestQuota': 'Request quota',
  'pages.subscriptions.tokenQuota': 'Token quota',
  'pages.subscriptions.requestsUsed': 'Requests used',
  'pages.subscriptions.tokensUsed': 'Tokens used',
  'pages.subscriptions.requests': 'requests',
  'pages.subscriptions.tokens': 'tokens',
  'pages.subscriptions.perMonth': 'per month',
  'pages.subscriptions.cancelSubscription': 'Cancel Subscription',
  'pages.subscriptions.cancelSubscriptionForModel': 'Cancel subscription for {{modelName}}',
  'pages.subscriptions.cancelling': 'Cancelling...',
  'pages.subscriptions.close': 'Close',
  'pages.subscriptions.alerts.suspended': 'Subscription suspended',
  'pages.subscriptions.alerts.expired': 'Subscription expired',
  'pages.subscriptions.suspendedMessage': 'This subscription is currently suspended.',
  'pages.subscriptions.expiredMessage': 'This subscription expired on {{date}}.',
  'pages.subscriptions.notifications.loadError': 'Failed to load subscriptions',
  'pages.subscriptions.notifications.loadErrorDesc':
    'An error occurred while loading subscriptions.',
  'pages.subscriptions.notifications.cancelSuccess': 'Subscription cancelled',
  'pages.subscriptions.notifications.cancelError': 'Failed to cancel subscription',
  'pages.subscriptions.notifications.cancelErrorDesc':
    'An error occurred while cancelling the subscription.',
  'pages.subscriptions.notifications.cannotCancel': 'Cannot cancel subscription',
  'pages.subscriptions.notifications.cannotCancelDesc':
    'This subscription cannot be cancelled at this time.',

  // API Keys
  'pages.apiKeys.title': 'API Keys',
  'pages.apiKeys.subtitle': 'Manage your API access keys',
  'pages.apiKeys.createKey': 'Create API Key',
  'pages.apiKeys.viewKey': 'View Key',
  'pages.apiKeys.deleteKey': 'Delete API Key',
  'pages.apiKeys.noModelsAssigned': 'No models assigned',
  'pages.apiKeys.copied': 'Copied',
  'pages.apiKeys.copyToClipboard': 'Copy to clipboard',
  'pages.apiKeys.clipboard.copy': 'Copy',
  'pages.apiKeys.clipboard.copied': 'Copied',
  'pages.apiKeys.forms.name': 'Name',
  'pages.apiKeys.forms.apiKey': 'API Key',
  'pages.apiKeys.forms.models': 'Models',
  'pages.apiKeys.forms.modelsAriaLabel': 'Select models',
  'pages.apiKeys.forms.yourNewApiKey': 'Your new API key',
  'pages.apiKeys.labels.actions': 'Actions',
  'pages.apiKeys.labels.cancel': 'Cancel',
  'pages.apiKeys.labels.close': 'Close',
  'pages.apiKeys.labels.created': 'Created',
  'pages.apiKeys.labels.totalRequests': 'Total Requests',
  'pages.apiKeys.messages.managementDescription': 'Manage your API access keys',
  'pages.apiKeys.messages.loadingTitle': 'Loading API Keys...',
  'pages.apiKeys.messages.loadingDescription': 'Retrieving your API keys',
  'pages.apiKeys.messages.noKeysTitle': 'No API keys found',
  'pages.apiKeys.messages.noKeysDescription': 'Create your first API key to get started',
  'pages.apiKeys.messages.noKeysScreenReader':
    'No API keys found. Use the create button to add one.',
  'pages.apiKeys.showKey': 'Show API Key',
  'pages.apiKeys.hideKey': 'Hide API Key',
  'pages.apiKeys.showKeyAriaLabel': 'Show API Key',
  'pages.apiKeys.hideKeyAriaLabel': 'Hide API Key',
  'pages.apiKeys.viewKeyAriaLabel': 'View API Key',
  'pages.apiKeys.deleteKeyAriaLabel': 'Delete API Key',
  'pages.apiKeys.fullKeyVisible': 'Full API key for {{keyName}} is visible',
  'pages.apiKeys.keyPreviewOnly': 'Preview of API key for {{keyName}}',
  'pages.apiKeys.tableHeaders.apiKeysTable': 'API Keys table',
  'pages.apiKeys.tableHeaders.apiKeysTableCaption': 'Table of API keys',
  'pages.apiKeys.tableHeaders.apiKeysTableStructure': 'Name, API Key, Models, Actions',
  'pages.apiKeys.tableHeaders.keyDetails': 'Key details',
  'pages.apiKeys.tableHeaders.keyDetailsCaption': 'Details for key {{keyName}}',
  'pages.apiKeys.tableHeaders.generatedKeyDetails': 'Generated key details',
  'pages.apiKeys.tableHeaders.generatedKeyDetailsCaption': 'Details for generated key {{keyName}}',
  'pages.apiKeys.modals.createTitle': 'Create API Key',
  'pages.apiKeys.selectModels': 'Select models',
  'pages.apiKeys.modelsSelected': '{{count}} selected',
  'pages.apiKeys.selectAll': 'Select all',
  'pages.apiKeys.messages.loadingModels': 'Loading models...',
  'pages.apiKeys.messages.noSubscribedModels': 'No subscribed models available',
  'pages.apiKeys.messages.noSubscribedModelsError':
    'You must subscribe to at least one model to create an API key.',
  'pages.apiKeys.notifications.loadError': 'Failed to load API keys',
  'pages.apiKeys.notifications.loadErrorDesc': 'An error occurred while loading API keys.',
  'pages.apiKeys.notifications.createSuccess': 'API key created',
  'pages.apiKeys.notifications.createError': 'Failed to create API key',
  'pages.apiKeys.notifications.createErrorDesc': 'An error occurred while creating the API key.',
  'pages.apiKeys.notifications.deleteSuccess': 'API key deleted',
  'pages.apiKeys.notifications.deleteError': 'Failed to delete API key',
  'pages.apiKeys.notifications.deleteErrorDesc': 'An error occurred while deleting the API key.',
  'pages.apiKeys.notifications.validationError': 'Validation error',
  'pages.apiKeys.notifications.pleaseFixFormErrors': 'Please fix the form errors and try again.',
  'pages.apiKeys.notifications.loadModelError': 'Failed to load models',
  'pages.apiKeys.notifications.loadModelErrorDesc': 'An error occurred while loading models.',

  // Usage
  'pages.usage.title': 'Usage Analytics',
  'pages.usage.subtitle': 'Monitor your API usage and costs',
  'pages.usage.metrics.tokens': 'tokens',
  'pages.usage.totalRequests': 'Total Requests',
  'pages.usage.totalTokens': 'Total Tokens',
  'pages.usage.totalCost': 'Total Cost',
  'pages.usage.averageResponseTime': 'Avg Response Time',
  'pages.usage.successRate': 'Success Rate',
  'pages.usage.activeModels': 'Active Models',
  'pages.usage.dateRange': 'Date Range',
  'pages.usage.exportData': 'Export Data',

  // Settings
  'pages.settings.title': 'Settings',
  'pages.settings.subtitle': 'Manage your account preferences',
  'pages.settings.profile': 'Profile',
  'pages.settings.preferences': 'Preferences',
  'pages.settings.security': 'Security',
  'pages.settings.notifications': 'Notifications',

  // Settings - Models Management
  'pages.settings.models': 'Models Management',
  'pages.settings.modelsDescription':
    'Synchronize AI models from LiteLLM to ensure you have access to the latest available models.',
  'pages.settings.refreshModels': 'Refresh Models from LiteLLM',
  'pages.settings.syncInProgress': 'Synchronizing models...',
  'pages.settings.syncSuccess': 'Models synchronized successfully',
  'pages.settings.syncSuccessDetails':
    '{{totalModels}} total models ({{newModels}} new, {{updatedModels}} updated)',
  'pages.settings.syncError': 'Failed to synchronize models',
  'pages.settings.syncErrorGeneric':
    'An error occurred while synchronizing models. Please try again.',
  'pages.settings.adminRequired': 'Admin access required to sync models',
  'pages.settings.lastSync': 'Last Synchronization',
  'pages.settings.totalModels': 'Total Models',
  'pages.settings.newModels': 'New Models',
  'pages.settings.updatedModels': 'Updated Models',
  'pages.settings.syncErrors': 'Errors:',
  'pages.settings.syncTime': 'Sync Time',

  // Settings - Limits Management
  'pages.settings.limitsManagement': 'Limits Management',
  'pages.settings.limitsDescription': 'Apply user limits to all active users in the system.',
  'pages.settings.maxBudgetLabel': 'Maximum Budget ($)',
  'pages.settings.tpmLimitLabel': 'Tokens per Minute Limit',
  'pages.settings.rpmLimitLabel': 'Requests per Minute Limit',
  'pages.settings.leaveEmptyToKeep': 'Leave empty to keep current value',
  'pages.settings.maxBudgetHelper': 'Maximum budget allowed per user',
  'pages.settings.tpmLimitHelper': 'Maximum tokens per minute per user',
  'pages.settings.rpmLimitHelper': 'Maximum requests per minute per user',
  'pages.settings.applyToAllUsers': 'Apply to All Users',
  'pages.settings.processing': 'Processing...',
  'pages.settings.bulkUpdateSuccess': 'User limits updated successfully',
  'pages.settings.bulkUpdatePartial': 'Partial success updating user limits',
  'pages.settings.bulkUpdateError': 'Failed to update user limits',
  'pages.settings.bulkUpdateErrorGeneric':
    'An error occurred while updating user limits. Please try again.',
  'pages.settings.noValuesProvided': 'No values provided',
  'pages.settings.noValuesProvidedDescription': 'Please provide at least one value to update.',
  'pages.settings.confirmBulkUpdate': 'Confirm Bulk Update',
  'pages.settings.confirmBulkUpdateMessage':
    'Are you sure you want to apply these limits to all active users?',
  'pages.settings.changesToApply': 'Changes to Apply',
  'pages.settings.confirmApply': 'Confirm and Apply',
  'pages.settings.lastLimitsUpdate': 'Last Limits Update',
  'pages.settings.updateTime': 'Update Time',
  'pages.settings.totalUsersUpdated': 'Total Users',
  'pages.settings.successfulUpdates': 'Successful Updates',
  'pages.settings.failedUpdates': 'Failed Updates',
  'pages.settings.updateErrors': 'Update Errors',

  // Auth
  'auth.login.title': 'Login to LiteMaaS',
  'auth.login.subtitle': 'Access your AI model management platform',
  'auth.login.loginButton': 'Login with OpenShift',
  'auth.login.loading': 'Signing in...',
  'auth.logout': 'Logout',
  'auth.profile': 'Profile',

  // Login page specific
  'pages.login.brandAlt': 'LiteMaaS Logo',
  'pages.login.title': 'Welcome to LiteMaaS',
  'pages.login.subtitle': 'Model-as-a-Service Platform',
  'pages.login.loginWithOpenShift': 'Login with OpenShift',
  'pages.login.developmentMode': 'Development Mode',
  'pages.login.loginAsAdmin': 'Login as Admin',
  'pages.login.bypassAuthentication': 'Bypass authentication for testing',

  // Language selector
  'ui.language.selector': 'Language',
  'ui.language.english': 'English',
  'ui.language.spanish': 'Español',
  'ui.language.french': 'Français',
  'ui.language.german': 'Deutsch',
  'ui.language.italian': 'Italiano',
  'ui.language.korean': '한국어',
  'ui.language.japanese': '日本語',
  'ui.language.chinese': '中文',
  'ui.language.elvish': 'Elvish',

  // Layout
  'layout.skipToContent': 'Skip to content',
  'layout.mainNavigation': 'Main navigation',
  'layout.userMenu': 'User menu',
  'layout.notifications': 'Notifications',
  'layout.toggleSidebar': 'Toggle sidebar',
  'layout.language': 'Language',
  'layout.theme': 'Theme',

  // Notifications
  'notifications.title': 'Notifications',
  'notifications.markAllRead': 'Mark all as read',
  'notifications.clearAll': 'Clear all',
  'notifications.noNotifications': 'No notifications',
  'notifications.success': 'Success',
  'notifications.error': 'Error',
  'notifications.warning': 'Warning',
  'notifications.info': 'Information',

  // Errors
  'errors.general': 'Something went wrong. Please try again.',
  'errors.network': 'Network error. Please check your connection.',
  'errors.unauthorized': 'You are not authorized to perform this action.',
  'errors.notFound': 'The requested resource was not found.',
  'errors.validationFailed': 'Validation failed. Please check your input.',
  'errors.serverError': 'Server error. Please try again later.',
  'errors.retry': 'Retry',
  'errors.goBack': 'Go Back',
  'errors.contactSupport': 'Contact Support',

  // Charts and accessibility
  'charts.legend': 'Chart legend',
  'charts.dataTable': 'Data table',
  'charts.downloadData': 'Download chart data',
  'charts.noData': 'No data available',
  'charts.loading': 'Loading chart...',

  // Forms
  'forms.required': 'This field is required',
  'forms.invalidEmail': 'Please enter a valid email address',
  'forms.passwordTooShort': 'Password must be at least 8 characters',
  'forms.confirmPassword': 'Passwords do not match',
  'forms.save': 'Save',
  'forms.cancel': 'Cancel',
  'forms.reset': 'Reset',
};

// Create a test-specific i18n instance
const createTestI18n = (): I18nInstance => {
  const testI18n: I18nInstance = i18next.createInstance();

  testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: testTranslations,
      },
    },
    // Disable language detection in tests
    detection: {
      order: [],
    },
    // Ensure synchronous initialization for tests
    initImmediate: false,
  });

  return testI18n;
};

// Export the configured test i18n instance
export const testI18n: I18nInstance = createTestI18n();

// Export translation function for direct testing
export const testT = (key: string, options?: TOptions): string => testI18n.t(key, options);

// Export function to create new instances if needed
export { createTestI18n };

// Default export for convenience
export default testI18n;

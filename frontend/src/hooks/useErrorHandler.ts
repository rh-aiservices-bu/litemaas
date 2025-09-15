import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../contexts/NotificationContext';
import {
  extractErrorDetails,
  getUserErrorMessage,
  isRetryableError,
  type ExtractedError,
} from '../utils/error.utils';

/**
 * Configuration options for error handling
 */
export interface ErrorHandlerOptions {
  /** Whether to show a notification for this error (default: true) */
  showNotification?: boolean;
  /** Whether to log the error to console (default: true in development) */
  logError?: boolean;
  /** Custom callback to handle the error */
  onError?: (error: unknown, extracted: ExtractedError) => void;
  /** i18n key for fallback error message (default: 'errors.general') */
  fallbackMessageKey?: string;
  /** Whether to enable retry for retryable errors (default: false) */
  enableRetry?: boolean;
  /** Custom retry callback function */
  onRetry?: () => void | Promise<void>;
  /** Maximum number of automatic retries (default: 0) */
  maxRetries?: number;
  /** Custom notification variant override */
  notificationVariant?: 'danger' | 'warning' | 'info';
  /** Additional context to include in error details */
  context?: Record<string, any>;
}

/**
 * React hook for comprehensive error handling
 *
 * Provides a unified interface for handling errors throughout the application
 * with notification integration, i18n support, retry logic, and development logging.
 *
 * @returns Object containing handleError function and utilities
 */
export function useErrorHandler() {
  const { t } = useTranslation();
  const { addNotification } = useNotifications();

  /**
   * Main error handling function
   *
   * @param error - The error to handle (can be any type)
   * @param options - Configuration options for handling this error
   */
  const handleError = useCallback(
    (error: unknown, options: ErrorHandlerOptions = {}, retryCount: number = 0) => {
      const {
        showNotification = true,
        logError = process.env.NODE_ENV === 'development',
        onError,
        fallbackMessageKey = 'errors.general',
        enableRetry = false,
        onRetry,
        maxRetries = 0,
        notificationVariant = 'danger',
        context = {},
      } = options;

      // Guard clause to prevent infinite recursion
      if (retryCount >= (maxRetries || 3)) {
        // Stop recursion and show final error
        if (showNotification) {
          const userMessage = getUserErrorMessage(error, fallbackMessageKey, t);
          addNotification({
            title: t('errors.maxRetriesExceeded', 'Maximum retries exceeded'),
            description: userMessage,
            variant: 'danger',
          });
        }
        return;
      }

      // Extract standardized error information
      const extracted = extractErrorDetails(error);

      // Add additional context to error details
      if (Object.keys(context).length > 0) {
        extracted.details = {
          ...extracted.details,
          ...context,
        };
      }

      // Log error in development or when explicitly requested
      if (logError) {
        console.group('🚨 Error Handler');
        console.error('Original error:', error);
        console.table(extracted);
        if (Object.keys(context).length > 0) {
          console.log('Additional context:', context);
        }
        console.groupEnd();
      }

      // Get user-friendly error message
      const userMessage = getUserErrorMessage(error, fallbackMessageKey, t);

      // Determine if this error can be retried
      const canRetry = enableRetry && isRetryableError(error) && onRetry;

      // Create notification actions
      const notificationActions = [];

      // Add retry action if applicable
      if (canRetry) {
        notificationActions.push({
          label: t('common.retry', 'Retry'),
          onClick: async () => {
            try {
              await onRetry();
            } catch (retryError) {
              // Handle retry failures with iterative approach to prevent recursion
              handleError(
                retryError,
                {
                  ...options,
                  context: {
                    ...context,
                    originalError: extracted.code,
                    retryAttempt: true,
                  },
                },
                retryCount + 1,
              );
            }
          },
        });
      }

      // Add help link action if available
      if (extracted.helpUrl) {
        notificationActions.push({
          label: t('common.learnMore', 'Learn More'),
          onClick: () => {
            window.open(extracted.helpUrl, '_blank', 'noopener,noreferrer');
          },
        });
      }

      // Show notification if requested
      if (showNotification) {
        // Determine notification variant based on error type
        let variant = notificationVariant;

        // Network errors get warning variant
        if (extracted.code === 'NETWORK_ERROR') {
          variant = 'warning';
        }

        // Validation errors get info variant
        if (extracted.code === 'VALIDATION_ERROR') {
          variant = 'info';
        }

        // Rate limit errors get warning variant and custom title
        if (extracted.code === 'RATE_LIMITED') {
          variant = 'warning';

          const details = extracted.details || {};
          const limit = details.limit || 'unknown';
          const timeWindow = details.timeWindow || 'unknown';
          const retryAfter = extracted.retryAfter || Math.ceil((details.remaining || 60000) / 1000);

          addNotification({
            title: t('errors.rateLimited', 'Rate Limit Exceeded'),
            description: t('errors.rateLimitedDescription', {
              defaultValue: `Too many requests. Limit: {{limit}} per {{timeWindow}}. Please wait {{retryAfter}} seconds before trying again.`,
              limit,
              timeWindow,
              retryAfter,
            }),
            variant,
            actions: notificationActions.length > 0 ? notificationActions : undefined,
          });

          // Early return to skip the default notification
          return;
        }

        addNotification({
          title: t('errors.title', 'Error'),
          description: userMessage,
          variant,
          actions: notificationActions.length > 0 ? notificationActions : undefined,
        });
      }

      // Call custom error handler if provided
      if (onError) {
        try {
          onError(error, extracted);
        } catch (handlerError) {
          // Prevent infinite recursion from custom error handlers
          console.error('Error in custom error handler:', handlerError);
        }
      }

      // Return extracted error details for further processing if needed
      return extracted;
    },
    [t, addNotification],
  );

  /**
   * Specialized handler for validation errors
   *
   * @param error - Validation error to handle
   * @param options - Error handling options
   */
  const handleValidationError = useCallback(
    (error: unknown, options: Omit<ErrorHandlerOptions, 'notificationVariant'> = {}) => {
      return handleError(error, {
        ...options,
        notificationVariant: 'info',
        fallbackMessageKey: 'errors.validation.general',
      });
    },
    [handleError],
  );

  /**
   * Specialized handler for network errors
   *
   * @param error - Network error to handle
   * @param options - Error handling options
   */
  const handleNetworkError = useCallback(
    (
      error: unknown,
      options: Omit<ErrorHandlerOptions, 'notificationVariant' | 'enableRetry'> = {},
    ) => {
      return handleError(error, {
        ...options,
        notificationVariant: 'warning',
        enableRetry: true,
        fallbackMessageKey: 'errors.network.general',
      });
    },
    [handleError],
  );

  /**
   * Specialized handler for authentication errors
   *
   * @param error - Authentication error to handle
   * @param options - Error handling options
   */
  const handleAuthError = useCallback(
    (error: unknown, options: Omit<ErrorHandlerOptions, 'notificationVariant'> = {}) => {
      return handleError(error, {
        ...options,
        notificationVariant: 'danger',
        fallbackMessageKey: 'errors.auth.general',
        context: {
          ...options.context,
          authError: true,
        },
      });
    },
    [handleError],
  );

  /**
   * Create a higher-order function that wraps async operations with error handling
   *
   * @param asyncFn - The async function to wrap
   * @param options - Default error handling options
   * @returns Wrapped function that handles errors automatically
   */
  const withErrorHandler = useCallback(
    <TArgs extends any[], TReturn>(
      asyncFn: (...args: TArgs) => Promise<TReturn>,
      options: ErrorHandlerOptions = {},
    ) => {
      return async (...args: TArgs): Promise<TReturn | undefined> => {
        try {
          return await asyncFn(...args);
        } catch (error) {
          handleError(error, options);
          return undefined;
        }
      };
    },
    [handleError],
  );

  /**
   * Iterative retry handler to prevent stack overflow
   *
   * @param retryFn - The function to retry
   * @param maxAttempts - Maximum number of attempts (default: 3)
   * @returns Promise that resolves on success or rejects with final error
   */
  const handleRetry = useCallback(
    async (retryFn: () => Promise<void>, maxAttempts: number = 3) => {
      let attempts = 0;
      let lastError: unknown;

      while (attempts < maxAttempts) {
        try {
          await retryFn();
          return; // Success
        } catch (error) {
          lastError = error;
          attempts++;

          if (attempts < maxAttempts) {
            // Exponential backoff
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          }
        }
      }

      // Final error after all retries
      handleError(lastError, { showNotification: true });
    },
    [handleError],
  );

  return {
    handleError,
    handleValidationError,
    handleNetworkError,
    handleAuthError,
    withErrorHandler,
    handleRetry,
  };
}

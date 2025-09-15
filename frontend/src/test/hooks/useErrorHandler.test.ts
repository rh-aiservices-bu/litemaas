import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import * as errorUtils from '../../utils/error.utils';

// Create mock functions that we can control in tests
const mockAddNotification = vi.fn();
const mockT = vi.fn((key: string, defaultValue?: string) => defaultValue || key);

// Mock the dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: mockAddNotification,
  }),
}));

// Store original console methods
const originalConsole = {
  error: console.error,
  group: console.group,
  groupEnd: console.groupEnd,
  table: console.table,
  log: console.log,
};

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddNotification.mockClear();
    mockT.mockClear();

    // Restore original console methods
    console.error = originalConsole.error;
    console.group = originalConsole.group;
    console.groupEnd = originalConsole.groupEnd;
    console.table = originalConsole.table;
    console.log = originalConsole.log;
  });

  it('should handle errors with default options', () => {
    const { result } = renderHook(() => useErrorHandler());

    const testError = new Error('Test error');
    const mockExtracted = {
      message: 'Test error',
      code: 'TEST_ERROR',
    };

    const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
    const messageSpy = vi
      .spyOn(errorUtils, 'getUserErrorMessage')
      .mockReturnValue('User friendly message');

    let extractedResult;
    act(() => {
      extractedResult = result.current.handleError(testError);
    });

    expect(errorUtils.extractErrorDetails).toHaveBeenCalledWith(testError);
    expect(errorUtils.getUserErrorMessage).toHaveBeenCalledWith(
      testError,
      'errors.general',
      expect.any(Function),
    );
    expect(extractedResult).toEqual(mockExtracted);

    // Clean up spies immediately
    extractSpy.mockRestore();
    messageSpy.mockRestore();
  });

  it('should log errors when logError is true', () => {
    // Mock console methods for this test
    const consoleSpy = vi.fn();
    const consoleGroupSpy = vi.fn();
    const consoleGroupEndSpy = vi.fn();
    const consoleTableSpy = vi.fn();

    console.error = consoleSpy;
    console.group = consoleGroupSpy;
    console.groupEnd = consoleGroupEndSpy;
    console.table = consoleTableSpy;

    const { result } = renderHook(() => useErrorHandler());

    const testError = new Error('Test error');
    const mockExtracted = {
      message: 'Test error',
      code: 'TEST_ERROR',
    };

    const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
    const messageSpy = vi
      .spyOn(errorUtils, 'getUserErrorMessage')
      .mockReturnValue('User friendly message');

    act(() => {
      result.current.handleError(testError, { logError: true });
    });

    expect(consoleGroupSpy).toHaveBeenCalledWith('🚨 Error Handler');
    expect(consoleSpy).toHaveBeenCalledWith('Original error:', testError);
    expect(consoleTableSpy).toHaveBeenCalledWith(mockExtracted);
    expect(consoleGroupEndSpy).toHaveBeenCalled();

    // Clean up spies immediately
    extractSpy.mockRestore();
    messageSpy.mockRestore();
  });

  it('should not log errors when logError is false', () => {
    // Mock console methods to verify they're not called
    const consoleSpy = vi.fn();
    const consoleGroupSpy = vi.fn();

    console.error = consoleSpy;
    console.group = consoleGroupSpy;

    const { result } = renderHook(() => useErrorHandler());

    const testError = new Error('Test error');
    const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue({
      message: 'Test error',
      code: 'TEST_ERROR',
    });
    const messageSpy = vi
      .spyOn(errorUtils, 'getUserErrorMessage')
      .mockReturnValue('User friendly message');

    act(() => {
      result.current.handleError(testError, { logError: false });
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(consoleGroupSpy).not.toHaveBeenCalled();

    // Clean up spies immediately
    extractSpy.mockRestore();
    messageSpy.mockRestore();
  });

  it('should call custom error handler when provided', () => {
    const { result } = renderHook(() => useErrorHandler());
    const customHandler = vi.fn();

    const testError = new Error('Test error');
    const mockExtracted = {
      message: 'Test error',
      code: 'TEST_ERROR',
    };

    const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
    const messageSpy = vi
      .spyOn(errorUtils, 'getUserErrorMessage')
      .mockReturnValue('User friendly message');

    act(() => {
      result.current.handleError(testError, { onError: customHandler });
    });

    expect(customHandler).toHaveBeenCalledWith(testError, mockExtracted);

    // Clean up spies immediately
    extractSpy.mockRestore();
    messageSpy.mockRestore();
  });

  it('should handle validation errors with specialized handler', () => {
    const { result } = renderHook(() => useErrorHandler());

    const testError = new Error('Validation failed');
    const mockExtracted = {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
    };

    const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
    const messageSpy = vi
      .spyOn(errorUtils, 'getUserErrorMessage')
      .mockReturnValue('Validation message');

    act(() => {
      result.current.handleValidationError(testError);
    });

    expect(errorUtils.getUserErrorMessage).toHaveBeenCalledWith(
      testError,
      'errors.validation.general',
      expect.any(Function),
    );

    // Clean up spies immediately
    extractSpy.mockRestore();
    messageSpy.mockRestore();
  });

  it('should handle network errors with retry enabled', () => {
    const { result } = renderHook(() => useErrorHandler());

    const testError = new Error('Network error');
    const mockExtracted = {
      message: 'Network error',
      code: 'NETWORK_ERROR',
      retryable: true,
    };

    const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
    const messageSpy = vi
      .spyOn(errorUtils, 'getUserErrorMessage')
      .mockReturnValue('Network message');

    act(() => {
      result.current.handleNetworkError(testError);
    });

    expect(errorUtils.getUserErrorMessage).toHaveBeenCalledWith(
      testError,
      'errors.network.general',
      expect.any(Function),
    );

    // Clean up spies immediately
    extractSpy.mockRestore();
    messageSpy.mockRestore();
  });

  it('should handle async errors without retry options', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const asyncFn = vi.fn().mockRejectedValue(new Error('Async error'));
    const mockExtracted = {
      message: 'Async error',
      code: 'ASYNC_ERROR',
    };

    const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
    const messageSpy = vi.spyOn(errorUtils, 'getUserErrorMessage').mockReturnValue('Async message');

    let wrappedFn: (...args: any[]) => Promise<any>;
    let wrappedResult: any;

    // First get the wrapped function without executing it
    act(() => {
      wrappedFn = result.current.withErrorHandler(asyncFn);
    });

    // Then execute the async function
    await act(async () => {
      wrappedResult = await wrappedFn('test', 'args');
    });

    expect(asyncFn).toHaveBeenCalledWith('test', 'args');
    expect(wrappedResult).toBeUndefined();
    expect(errorUtils.extractErrorDetails).toHaveBeenCalledWith(new Error('Async error'));

    // Clean up spies immediately
    extractSpy.mockRestore();
    messageSpy.mockRestore();
  });

  it('should add context to error details', () => {
    const { result } = renderHook(() => useErrorHandler());

    const testError = new Error('Test error');
    const mockExtracted = {
      message: 'Test error',
      code: 'TEST_ERROR',
      details: {},
    };

    const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
    const messageSpy = vi
      .spyOn(errorUtils, 'getUserErrorMessage')
      .mockReturnValue('User friendly message');

    const context = { userId: '123', action: 'test' };

    act(() => {
      result.current.handleError(testError, { context });
    });

    expect(mockExtracted.details).toEqual(context);

    // Clean up spies immediately
    extractSpy.mockRestore();
    messageSpy.mockRestore();
  });

  describe('notification integration', () => {
    it('should show notification with default variant', () => {
      const { result } = renderHook(() => useErrorHandler());

      const testError = new Error('Test error');
      const mockExtracted = {
        message: 'Test error',
        code: 'TEST_ERROR',
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('User friendly message');

      act(() => {
        result.current.handleError(testError);
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        title: 'Error',
        description: 'User friendly message',
        variant: 'danger',
        actions: undefined,
      });

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });

    it('should show notification with warning variant for network errors', () => {
      const { result } = renderHook(() => useErrorHandler());

      const testError = new Error('Network error');
      const mockExtracted = {
        message: 'Network error',
        code: 'NETWORK_ERROR',
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Network message');

      act(() => {
        result.current.handleError(testError);
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Network message',
        variant: 'warning',
        actions: undefined,
      });

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });

    it('should show notification with info variant for validation errors', () => {
      const { result } = renderHook(() => useErrorHandler());

      const testError = new Error('Validation error');
      const mockExtracted = {
        message: 'Validation error',
        code: 'VALIDATION_ERROR',
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Validation message');

      act(() => {
        result.current.handleError(testError);
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Validation message',
        variant: 'info',
        actions: undefined,
      });

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });

    it('should not show notification when showNotification is false', () => {
      const { result } = renderHook(() => useErrorHandler());

      const testError = new Error('Test error');
      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue({
        message: 'Test error',
        code: 'TEST_ERROR',
      });
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('User friendly message');

      act(() => {
        result.current.handleError(testError, { showNotification: false });
      });

      expect(mockAddNotification).not.toHaveBeenCalled();

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });

    it('should include retry action for retryable errors', () => {
      const { result } = renderHook(() => useErrorHandler());
      const onRetry = vi.fn();

      const testError = new Error('Retryable error');
      const mockExtracted = {
        message: 'Retryable error',
        code: 'RETRYABLE_ERROR',
        retryable: true,
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Retryable message');
      const retrySpy = vi.spyOn(errorUtils, 'isRetryableError').mockReturnValue(true);

      act(() => {
        result.current.handleError(testError, { enableRetry: true, onRetry });
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Retryable message',
        variant: 'danger',
        actions: expect.arrayContaining([
          expect.objectContaining({
            label: 'Retry',
            onClick: expect.any(Function),
          }),
        ]),
      });

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
      retrySpy.mockRestore();
    });

    it('should include help link action when helpUrl is present', () => {
      const { result } = renderHook(() => useErrorHandler());

      // Store original window.open
      const originalOpen = window.open;
      const mockOpen = vi.fn();
      window.open = mockOpen;

      const testError = new Error('Help error');
      const mockExtracted = {
        message: 'Help error',
        code: 'HELP_ERROR',
        helpUrl: 'https://help.example.com',
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Help message');

      act(() => {
        result.current.handleError(testError);
      });

      expect(mockAddNotification).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Help message',
        variant: 'danger',
        actions: expect.arrayContaining([
          expect.objectContaining({
            label: 'Learn More',
            onClick: expect.any(Function),
          }),
        ]),
      });

      // Test help action click
      const actions = mockAddNotification.mock.calls[0][0].actions;
      const helpAction = actions.find((action: any) => action.label === 'Learn More');
      helpAction.onClick();

      expect(mockOpen).toHaveBeenCalledWith(
        'https://help.example.com',
        '_blank',
        'noopener,noreferrer',
      );

      // Restore original window.open
      window.open = originalOpen;

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });
  });

  describe('retry functionality', () => {
    it('should execute retry callback successfully', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const onRetry = vi.fn().mockResolvedValue(undefined);

      const testError = new Error('Retryable error');
      const mockExtracted = {
        message: 'Retryable error',
        code: 'RETRYABLE_ERROR',
        retryable: true,
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Retryable message');
      const retrySpy = vi.spyOn(errorUtils, 'isRetryableError').mockReturnValue(true);

      act(() => {
        result.current.handleError(testError, { enableRetry: true, onRetry });
      });

      // Get retry action and execute it
      const actions = mockAddNotification.mock.calls[0][0].actions;
      const retryAction = actions.find((action: any) => action.label === 'Retry');

      await act(async () => {
        await retryAction.onClick();
      });

      expect(onRetry).toHaveBeenCalled();

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
      retrySpy.mockRestore();
    });

    it('should handle retry failures with max retries', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const onRetry = vi.fn().mockRejectedValue(new Error('Retry failed'));

      const testError = new Error('Retryable error');
      const mockExtracted = {
        message: 'Retryable error',
        code: 'RETRYABLE_ERROR',
        retryable: true,
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Retryable message');
      const retrySpy = vi.spyOn(errorUtils, 'isRetryableError').mockReturnValue(true);

      act(() => {
        result.current.handleError(testError, { enableRetry: true, onRetry, maxRetries: 1 });
      });

      // Get retry action and execute it
      const actions = mockAddNotification.mock.calls[0][0].actions;
      const retryAction = actions.find((action: any) => action.label === 'Retry');

      await act(async () => {
        await retryAction.onClick();
      });

      expect(onRetry).toHaveBeenCalled();
      expect(mockAddNotification).toHaveBeenCalledTimes(2); // Original error + retry failure

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
      retrySpy.mockRestore();
    });
  });

  describe('custom error handler', () => {
    it('should call custom error handler and handle exceptions', () => {
      const { result } = renderHook(() => useErrorHandler());
      const customHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      const consoleSpy = vi.fn();
      console.error = consoleSpy;

      const testError = new Error('Test error');
      const mockExtracted = {
        message: 'Test error',
        code: 'TEST_ERROR',
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('User friendly message');

      act(() => {
        result.current.handleError(testError, { onError: customHandler });
      });

      expect(customHandler).toHaveBeenCalledWith(testError, mockExtracted);
      expect(consoleSpy).toHaveBeenCalledWith('Error in custom error handler:', expect.any(Error));

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });
  });

  describe('specialized error handlers', () => {
    it('should properly extract and format error messages for different error types', () => {
      const { result } = renderHook(() => useErrorHandler());

      const testError = new Error('Auth failed');
      const mockExtracted = {
        message: 'Auth failed',
        code: 'AUTH_ERROR',
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Auth message');

      act(() => {
        result.current.handleAuthError(testError);
      });

      expect(errorUtils.getUserErrorMessage).toHaveBeenCalledWith(
        testError,
        'errors.auth.general',
        expect.any(Function),
      );

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });

    it('should handle auth errors with additional context', () => {
      const { result } = renderHook(() => useErrorHandler());

      const testError = new Error('Auth failed');
      const mockExtracted = {
        message: 'Auth failed',
        code: 'AUTH_ERROR',
        details: {},
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Auth message');

      act(() => {
        result.current.handleAuthError(testError, { context: { userId: '123' } });
      });

      expect(mockExtracted.details).toEqual({
        userId: '123',
        authError: true,
      });

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });
  });

  describe('withErrorHandler wrapper', () => {
    it('should return successful result when no error occurs', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const asyncFn = vi.fn().mockResolvedValue('success');

      let wrappedFn: (...args: any[]) => Promise<any>;
      let wrappedResult: any;

      // First get the wrapped function
      act(() => {
        wrappedFn = result.current.withErrorHandler(asyncFn);
      });

      // Then execute it
      await act(async () => {
        wrappedResult = await wrappedFn('test', 'args');
      });

      expect(asyncFn).toHaveBeenCalledWith('test', 'args');
      expect(wrappedResult).toBe('success');
    });

    it('should handle errors and return undefined', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const asyncFn = vi.fn().mockRejectedValue(new Error('Async error'));

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue({
        message: 'Async error',
        code: 'ASYNC_ERROR',
      });
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('Async message');

      let wrappedFn: (...args: any[]) => Promise<any>;
      let wrappedResult: any;

      // First get the wrapped function
      act(() => {
        wrappedFn = result.current.withErrorHandler(asyncFn);
      });

      // Then execute it
      await act(async () => {
        wrappedResult = await wrappedFn('test', 'args');
      });

      expect(asyncFn).toHaveBeenCalledWith('test', 'args');
      expect(wrappedResult).toBeUndefined();
      expect(errorUtils.extractErrorDetails).toHaveBeenCalledWith(new Error('Async error'));

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });
  });

  describe('development mode features', () => {
    it('should log additional context in development mode', () => {
      const { result } = renderHook(() => useErrorHandler());

      // Mock console methods for this test
      const consoleSpy = vi.fn();
      const consoleGroupSpy = vi.fn();
      const consoleGroupEndSpy = vi.fn();
      const consoleTableSpy = vi.fn();
      const consoleLogSpy = vi.fn();

      console.error = consoleSpy;
      console.group = consoleGroupSpy;
      console.groupEnd = consoleGroupEndSpy;
      console.table = consoleTableSpy;
      console.log = consoleLogSpy;

      const testError = new Error('Test error');
      const mockExtracted = {
        message: 'Test error',
        code: 'TEST_ERROR',
        details: {},
      };

      const extractSpy = vi.spyOn(errorUtils, 'extractErrorDetails').mockReturnValue(mockExtracted);
      const messageSpy = vi
        .spyOn(errorUtils, 'getUserErrorMessage')
        .mockReturnValue('User friendly message');

      const context = { userId: '123', action: 'test' };

      act(() => {
        result.current.handleError(testError, { logError: true, context });
      });

      expect(consoleGroupSpy).toHaveBeenCalledWith('🚨 Error Handler');
      expect(consoleSpy).toHaveBeenCalledWith('Original error:', testError);
      expect(consoleTableSpy).toHaveBeenCalledWith(mockExtracted);
      expect(consoleLogSpy).toHaveBeenCalledWith('Additional context:', context);
      expect(consoleGroupEndSpy).toHaveBeenCalled();

      // Clean up spies immediately
      extractSpy.mockRestore();
      messageSpy.mockRestore();
    });
  });
});

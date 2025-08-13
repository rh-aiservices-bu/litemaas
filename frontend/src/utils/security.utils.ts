// Security utilities for safe data handling in charts and UI components
// Provides XSS prevention and data sanitization functions

/**
 * Masks API key to show only last 4 characters
 * Provides secure display of sensitive API key data
 */
export const maskApiKey = (apiKey: string): string => {
  if (!apiKey || typeof apiKey !== 'string') {
    return 'Invalid Key';
  }

  // Ensure minimum length for security
  if (apiKey.length < 8) {
    return '****';
  }

  // Show last 4 characters with appropriate prefix
  const lastFour = apiKey.slice(-4);
  const prefix = apiKey.startsWith('sk-') ? 'sk-' : '';
  return `${prefix}****${lastFour}`;
};

/**
 * Sanitizes chart labels to prevent XSS attacks
 * Removes or escapes potentially dangerous characters from user-provided data
 */
export const sanitizeChartLabel = (label: string): string => {
  if (!label || typeof label !== 'string') {
    return '';
  }

  let sanitized = label;

  // Special handling for data URLs with script content
  if (sanitized.includes('data:text/html')) {
    sanitized = sanitized.replace(
      /data:text\/html[^,]*,<script[^>]*>.*?<\/script>/gi,
      'data:text/html,',
    );
  }

  // Remove script blocks and well-formed HTML tags (but not standalone < > characters)
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script blocks entirely
    .replace(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, '') // Remove opening HTML tags
    .replace(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g, '') // Remove closing HTML tags
    .replace(/\/\*.*?\*\//g, ''); // Remove comment blocks

  // Escape dangerous characters for safe display (including standalone < >)
  sanitized = sanitized.replace(/[<>'"&]/g, (match) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '&': '&amp;',
    };
    return escapeMap[match] || match;
  });

  return sanitized.trim().substring(0, 100); // Limit length to prevent overflow
};

/**
 * Validates chart data to ensure it's safe and properly formatted
 * Checks data types, ranges, and prevents injection attacks
 */
export const validateChartData = <T extends Record<string, any>>(
  data: T[],
  requiredFields: (keyof T)[],
): { isValid: boolean; errors: string[]; sanitizedData: T[] } => {
  const errors: string[] = [];
  const sanitizedData: T[] = [];

  if (!Array.isArray(data)) {
    return {
      isValid: false,
      errors: ['Data must be an array'],
      sanitizedData: [],
    };
  }

  // Check each data point
  data.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Item at index ${index} is not a valid object`);
      return;
    }

    // Validate required fields
    const missingFields = requiredFields.filter((field) => !(field in item));
    if (missingFields.length > 0) {
      errors.push(`Item at index ${index} missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Sanitize string fields
    const sanitizedItem = { ...item } as any;
    Object.keys(sanitizedItem).forEach((key) => {
      const value = sanitizedItem[key];
      if (typeof value === 'string') {
        sanitizedItem[key] = sanitizeChartLabel(value);
      } else if (typeof value === 'number') {
        // Validate numeric data
        if (!isFinite(value) || value < 0) {
          errors.push(`Item at index ${index} has invalid numeric value for ${key}: ${value}`);
          sanitizedItem[key] = 0; // Default to 0 for invalid numbers
        }
      }
    });

    sanitizedData.push(sanitizedItem);
  });

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData,
  };
};

/**
 * Validates and sanitizes numeric values for charts
 * Ensures values are finite, non-negative, and within reasonable ranges
 */
export const sanitizeNumericValue = (
  value: unknown,
  options: {
    min?: number;
    max?: number;
    defaultValue?: number;
    allowNegative?: boolean;
  } = {},
): number => {
  const { min, max = Number.MAX_SAFE_INTEGER, defaultValue = 0, allowNegative = false } = options;

  // Convert to number
  const numValue = Number(value);

  // Check if valid number
  if (!isFinite(numValue)) {
    return defaultValue;
  }

  // Apply negative constraint
  if (!allowNegative && numValue < 0) {
    return defaultValue;
  }

  // Determine effective minimum based on allowNegative
  const effectiveMin = min !== undefined ? min : allowNegative ? Number.NEGATIVE_INFINITY : 0;

  // Apply min/max constraints
  if (numValue < effectiveMin) {
    return effectiveMin === Number.NEGATIVE_INFINITY ? numValue : effectiveMin;
  }

  if (numValue > max) {
    return max;
  }

  return numValue;
};

/**
 * Sanitizes model name for safe display
 * Removes potentially dangerous characters while preserving readability
 */
export const sanitizeModelName = (modelName: string): string => {
  if (!modelName || typeof modelName !== 'string') {
    return 'Unknown Model';
  }

  // Extract content from HTML tags while preserving all content inside tags
  const sanitized = modelName
    .replace(/<([^>]+)>/g, (_match, content) => {
      // Extract all content from inside tags (tag name, attributes, etc.)
      return content.replace(/[=/]/g, ''); // Remove = and / signs but keep the rest
    }) // Convert <img src=x onerror=alert(1)> to img srcx onerroralert1
    .replace(/<\/([^>]+)>/g, (_match, content) => {
      // Extract closing tag content without the forward slash
      return content.replace(/[=/]/g, '');
    }) // Convert </script> to script
    .replace(/[<>]/g, '') // Remove any remaining angle brackets
    .replace(/[^a-zA-Z0-9\-_./\s]/g, '') // Remove dangerous characters but keep alphanumeric and safe punctuation
    .replace(/--+/g, '') // Remove SQL comment markers
    .trim()
    .substring(0, 50); // Limit length

  return sanitized || 'Unknown Model';
};

/**
 * Validates date strings for chart filtering
 * Ensures dates are in valid format and within reasonable ranges
 */
export const validateDateRange = (
  startDate: string,
  endDate: string,
): { isValid: boolean; error?: string; sanitizedDates?: { start: string; end: string } } => {
  if (!startDate || !endDate) {
    return {
      isValid: false,
      error: 'Both start and end dates are required',
    };
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        isValid: false,
        error: 'Invalid date format',
      };
    }

    // Check date order
    if (start >= end) {
      return {
        isValid: false,
        error: 'Start date must be before end date',
      };
    }

    // Check reasonable date range (not more than 2 years)
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 730) {
      return {
        isValid: false,
        error: 'Date range cannot exceed 2 years',
      };
    }

    // Check dates are not in the future (with 1 day buffer)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (end > tomorrow) {
      return {
        isValid: false,
        error: 'End date cannot be in the future',
      };
    }

    return {
      isValid: true,
      sanitizedDates: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid date format',
    };
  }
};

/**
 * Formats currency values consistently with proper localization
 * Ensures secure and consistent monetary display
 */
export const formatCurrency = (amount: number): string => {
  const sanitizedAmount = sanitizeNumericValue(amount, {
    allowNegative: false,
    defaultValue: 0,
  });

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(sanitizedAmount);
};

/**
 * Type guard to check if a value is a valid chart data point
 */
export const isValidChartDataPoint = (
  value: unknown,
): value is { x: string | number; y: number } => {
  return (
    value !== null &&
    typeof value === 'object' &&
    'x' in value &&
    'y' in value &&
    (typeof (value as any).x === 'string' || typeof (value as any).x === 'number') &&
    typeof (value as any).y === 'number' &&
    isFinite((value as any).y)
  );
};

/**
 * Sanitizes and validates an array of chart data points
 */
export const sanitizeChartDataArray = <T extends { x: string | number; y: number }>(
  data: unknown[],
): T[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is { x: string | number; y: unknown } => {
      // Filter out items with completely invalid structure
      if (!item || typeof item !== 'object' || !('x' in item) || !('y' in item)) {
        return false;
      }

      const x = (item as any).x;
      const y = (item as any).y;

      // x must be string or number
      if (typeof x !== 'string' && typeof x !== 'number') {
        return false;
      }

      // y must be a number or numeric value that can be meaningfully sanitized
      // String values that aren't numbers should be filtered out
      if (typeof y === 'string' && (isNaN(Number(y)) || y.trim() === '')) {
        return false;
      }

      return true;
    })
    .map((point) => ({
      ...point,
      x: typeof point.x === 'string' ? sanitizeChartLabel(point.x) : point.x,
      y: sanitizeNumericValue(point.y), // Will handle -50, Infinity, etc.
    })) as T[];
};

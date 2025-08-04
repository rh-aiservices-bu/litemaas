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

  // Remove HTML tags and dangerous characters
  return label
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, (match) => {
      // Escape dangerous characters
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return escapeMap[match] || match;
    })
    .trim()
    .substring(0, 100); // Limit length to prevent overflow
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
  const {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    defaultValue = 0,
    allowNegative = false,
  } = options;

  // Convert to number
  const numValue = Number(value);

  // Check if valid number
  if (!isFinite(numValue)) {
    return defaultValue;
  }

  // Apply constraints
  if (!allowNegative && numValue < 0) {
    return defaultValue;
  }

  if (numValue < min) {
    return min;
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

  // Allow alphanumeric, hyphens, underscores, dots, and spaces
  const sanitized = modelName
    .replace(/[^a-zA-Z0-9\-_./\s]/g, '')
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

  return data.filter(isValidChartDataPoint).map((point) => ({
    ...point,
    x: typeof point.x === 'string' ? sanitizeChartLabel(point.x) : point.x,
    y: sanitizeNumericValue(point.y),
  })) as T[];
};

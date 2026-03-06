/**
 * Centralized formatting utilities for consistent data display across the application
 * These functions format numeric values for display purposes only.
 * Always store and export raw values, format only for display.
 */

/**
 * Format large numbers with K/M abbreviations for compact display
 * @param value - The number to format
 * @returns Formatted string (e.g., "1.2K", "3.5M") or localized number for small values
 * @example
 * formatNumber(1234) // "1.2K"
 * formatNumber(1234567) // "1.2M"
 * formatNumber(42) // "42"
 */
export const formatNumber = (value: number): string => {
  if (!isFinite(value) || value < 0) {
    return '0';
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

/**
 * Format currency values consistently
 * @param value - Amount in currency units
 * @param currencyCode - ISO 4217 currency code (default: 'USD')
 * @returns Formatted currency string (e.g., "$1,234.56", "€1,234.56")
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(1234.56, 'EUR') // "€1,234.56"
 */
export const formatCurrency = (value: number, currencyCode: string = 'USD'): string => {
  if (!isFinite(value) || value < 0) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format percentage values with consistent decimal places
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "98.5%")
 * @example
 * formatPercentage(98.5) // "98.5%"
 * formatPercentage(100) // "100.0%"
 * formatPercentage(45.678, 2) // "45.68%"
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  if (!isFinite(value)) {
    return '0.0%';
  }

  return `${value.toFixed(decimals)}%`;
};

/**
 * Format latency values in milliseconds
 * @param value - Latency in milliseconds
 * @returns Formatted latency string (e.g., "125ms", "1.2s")
 * @example
 * formatLatency(125) // "125ms"
 * formatLatency(1500) // "1.5s"
 */
export const formatLatency = (value: number): string => {
  if (!isFinite(value) || value < 0) {
    return '0ms';
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
};

/**
 * Format bytes to human-readable size
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 KB", "3.2 MB")
 * @example
 * formatBytes(1536) // "1.5 KB"
 * formatBytes(1048576) // "1.0 MB"
 */
export const formatBytes = (bytes: number): string => {
  if (!isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Format a date as relative time (e.g., "2 days ago", "3 hours ago")
 * @param dateString - ISO 8601 date string
 * @returns Formatted relative time string
 * @example
 * formatRelativeTime('2024-01-01T00:00:00Z') // "2 days ago"
 */
export const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return years === 1 ? '1 year ago' : `${years} years ago`;
    }
  } catch {
    return 'Unknown';
  }
};

/**
 * Format a date for display
 * @param dateString - ISO 8601 date string
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string in YYYY-MM-DD format
 * @example
 * formatDate('2024-01-15T10:30:00Z') // "2024-01-15"
 */
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateString;
  }
};

/**
 * Format a date string to YYYY-MM-DD HH:MM:SS
 * @returns Formatted datetime string
 * @example
 * formatDateTime('2024-01-15T10:30:00Z') // "2024-01-15 10:30:00"
 */
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateString;
  }
};

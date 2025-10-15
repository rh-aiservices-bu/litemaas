// backend/src/utils/pagination.utils.ts

import { ApplicationError } from './errors';
import {
  PaginationParams,
  PaginationMetadata,
  PaginatedResponse,
  PAGINATION_DEFAULTS,
} from '../types/admin-usage.types';

/**
 * Validate and normalize pagination parameters
 *
 * Ensures page/limit are within acceptable ranges and provides defaults.
 *
 * @param params - Raw pagination parameters from request
 * @returns Validated and normalized parameters
 * @throws ApplicationError if parameters are invalid
 */
export function validatePaginationParams(params: Partial<PaginationParams>): PaginationParams {
  const page = params.page ?? PAGINATION_DEFAULTS.PAGE;
  const limit = params.limit ?? PAGINATION_DEFAULTS.LIMIT;
  const sortBy = params.sortBy ?? 'totalTokens'; // Default sort by most impactful metric
  const sortOrder = params.sortOrder ?? PAGINATION_DEFAULTS.SORT_ORDER;

  // Validate page number
  if (page < 1) {
    throw ApplicationError.validation('Page number must be >= 1', 'page', page);
  }

  // Validate limit
  if (limit < 1) {
    throw ApplicationError.validation('Limit must be >= 1', 'limit', limit);
  }

  if (limit > PAGINATION_DEFAULTS.MAX_LIMIT) {
    throw ApplicationError.validation(
      `Limit must be <= ${PAGINATION_DEFAULTS.MAX_LIMIT}`,
      'limit',
      limit,
    );
  }

  // Validate sort order
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw ApplicationError.validation('Sort order must be "asc" or "desc"', 'sortOrder', sortOrder);
  }

  return {
    page,
    limit,
    sortBy,
    sortOrder,
  };
}

/**
 * Validate sort field against allowed fields
 *
 * @param sortBy - Field to sort by
 * @param allowedFields - Array of allowed field names
 * @throws ApplicationError if field is not allowed
 */
export function validateSortField(sortBy: string, allowedFields: readonly string[]): void {
  if (!allowedFields.includes(sortBy)) {
    throw ApplicationError.validation(`Invalid sort field: ${sortBy}`, 'sortBy', sortBy);
  }
}

/**
 * Paginate an array of data
 *
 * Generic function to paginate any array with metadata generation.
 *
 * @template T - Type of data items
 * @param data - Full dataset to paginate
 * @param params - Pagination parameters
 * @returns Paginated response with metadata
 */
export function paginateArray<T>(data: T[], params: PaginationParams): PaginatedResponse<T> {
  const { page, limit } = params;

  // Calculate pagination values
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Slice data for current page
  const pageData = data.slice(offset, offset + limit);

  // Build metadata
  const metadata: PaginationMetadata = {
    page,
    limit,
    total,
    totalPages,
    hasNext: offset + limit < total,
    hasPrevious: page > 1,
  };

  return {
    data: pageData,
    pagination: metadata,
  };
}

/**
 * Generic sort function
 *
 * Sorts array by a specified field in ascending or descending order.
 *
 * @template T - Type of data items
 * @param data - Data to sort
 * @param sortBy - Field name to sort by
 * @param sortOrder - Sort direction
 * @returns Sorted array (new array, does not mutate input)
 */
export function sortArray<T>(data: T[], sortBy: keyof T, sortOrder: 'asc' | 'desc'): T[] {
  const sorted = [...data]; // Create copy to avoid mutation

  sorted.sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    // Handle undefined/null values
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;

    // Compare values
    let comparison = 0;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      // String comparison (case-insensitive)
      comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      // Number comparison
      comparison = aValue - bValue;
    } else {
      // Fallback: convert to string
      comparison = String(aValue).localeCompare(String(bValue));
    }

    // Apply sort order
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Combined sort and paginate helper
 *
 * Convenience function that sorts and paginates in one call.
 *
 * @template T - Type of data items
 * @param data - Data to sort and paginate
 * @param params - Pagination parameters
 * @returns Paginated response with sorted data
 */
export function sortAndPaginate<T>(data: T[], params: PaginationParams): PaginatedResponse<T> {
  // Sort first
  const sorted = sortArray(data, params.sortBy as keyof T, params.sortOrder);

  // Then paginate
  return paginateArray(sorted, params);
}

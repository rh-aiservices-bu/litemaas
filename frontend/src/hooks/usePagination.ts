import { useState, useCallback } from 'react';
import { PAGINATION_DEFAULTS } from '../services/adminUsage.service';

export interface UsePaginationOptions {
  /** Initial page number (default: 1) */
  initialPage?: number;

  /** Initial items per page (default: 50) */
  initialPerPage?: number;

  /** Initial sort field */
  initialSortBy?: string;

  /** Initial sort order (default: 'desc') */
  initialSortOrder?: 'asc' | 'desc';
}

export interface UsePaginationReturn {
  /** Current page number (1-indexed) */
  page: number;

  /** Current items per page */
  perPage: number;

  /** Current sort field */
  sortBy: string;

  /** Current sort order */
  sortOrder: 'asc' | 'desc';

  /** Set page number */
  setPage: (_event: unknown, page: number) => void;

  /** Set items per page */
  setPerPage: (_event: unknown, perPage: number) => void;

  /** Set sort field and order */
  setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void;

  /** Reset to initial values */
  reset: () => void;

  /** Pagination parameters for API calls */
  paginationParams: {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

/**
 * Hook for managing pagination state
 *
 * Provides state management for page, perPage, sortBy, and sortOrder
 * with helper functions and automatic reset on filter changes.
 *
 * @param options - Initial pagination values
 * @returns Pagination state and helpers
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = PAGINATION_DEFAULTS.PAGE,
    initialPerPage = PAGINATION_DEFAULTS.LIMIT,
    initialSortBy = 'totalTokens',
    initialSortOrder = PAGINATION_DEFAULTS.SORT_ORDER,
  } = options;

  const [page, setPageState] = useState(initialPage);
  const [perPage, setPerPageState] = useState(initialPerPage);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  /**
   * Set page number
   * PatternFly Pagination passes event as first arg, page as second
   */
  const setPage = useCallback((_event: unknown, newPage: number) => {
    setPageState(newPage);
  }, []);

  /**
   * Set items per page
   * Reset to page 1 when changing per-page value
   */
  const setPerPage = useCallback((_event: unknown, newPerPage: number) => {
    setPerPageState(newPerPage);
    setPageState(1); // Reset to first page when changing page size
  }, []);

  /**
   * Set sort field and order
   * Reset to page 1 when changing sort
   */
  const setSort = useCallback((newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPageState(1); // Reset to first page when changing sort
  }, []);

  /**
   * Reset all pagination state to initial values
   */
  const reset = useCallback(() => {
    setPageState(initialPage);
    setPerPageState(initialPerPage);
    setSortBy(initialSortBy);
    setSortOrder(initialSortOrder);
  }, [initialPage, initialPerPage, initialSortBy, initialSortOrder]);

  return {
    page,
    perPage,
    sortBy,
    sortOrder,
    setPage,
    setPerPage,
    setSort,
    reset,
    paginationParams: {
      page,
      limit: perPage,
      sortBy,
      sortOrder,
    },
  };
}

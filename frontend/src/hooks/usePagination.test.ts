import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePagination } from './usePagination';

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination());

    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(50);
    expect(result.current.sortBy).toBe('totalTokens');
    expect(result.current.sortOrder).toBe('desc');
  });

  it('should initialize with custom values', () => {
    const { result } = renderHook(() =>
      usePagination({
        initialPage: 2,
        initialPerPage: 25,
        initialSortBy: 'username',
        initialSortOrder: 'asc',
      }),
    );

    expect(result.current.page).toBe(2);
    expect(result.current.perPage).toBe(25);
    expect(result.current.sortBy).toBe('username');
    expect(result.current.sortOrder).toBe('asc');
  });

  it('should update page', () => {
    const { result } = renderHook(() => usePagination());

    act(() => {
      result.current.setPage(null as any, 3);
    });

    expect(result.current.page).toBe(3);
  });

  it('should update perPage and reset to page 1', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 5 }));

    expect(result.current.page).toBe(5);

    act(() => {
      result.current.setPerPage(null as any, 100);
    });

    expect(result.current.perPage).toBe(100);
    expect(result.current.page).toBe(1); // Should reset to page 1
  });

  it('should update sort and reset to page 1', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 3 }));

    expect(result.current.page).toBe(3);

    act(() => {
      result.current.setSort('username', 'asc');
    });

    expect(result.current.sortBy).toBe('username');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.page).toBe(1); // Should reset to page 1
  });

  it('should reset to initial values', () => {
    const { result } = renderHook(() =>
      usePagination({
        initialPage: 1,
        initialPerPage: 50,
        initialSortBy: 'totalTokens',
        initialSortOrder: 'desc',
      }),
    );

    // Make changes
    act(() => {
      result.current.setPage(null as any, 5);
      result.current.setPerPage(null as any, 100);
      result.current.setSort('username', 'asc');
    });

    expect(result.current.page).toBe(1); // Reset by setPerPage/setSort
    expect(result.current.perPage).toBe(100);
    expect(result.current.sortBy).toBe('username');

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(50);
    expect(result.current.sortBy).toBe('totalTokens');
    expect(result.current.sortOrder).toBe('desc');
  });

  it('should provide paginationParams object', () => {
    const { result } = renderHook(() => usePagination());

    expect(result.current.paginationParams).toEqual({
      page: 1,
      limit: 50,
      sortBy: 'totalTokens',
      sortOrder: 'desc',
    });
  });
});

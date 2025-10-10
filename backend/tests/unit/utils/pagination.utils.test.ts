// backend/tests/unit/utils/pagination.utils.test.ts

import { describe, it, expect } from 'vitest';
import {
  validatePaginationParams,
  validateSortField,
  paginateArray,
  sortArray,
  sortAndPaginate,
} from '../../../src/utils/pagination.utils';
import { PAGINATION_DEFAULTS } from '../../../src/types/admin-usage.types';

describe('pagination.utils', () => {
  describe('validatePaginationParams', () => {
    it('should apply defaults for missing parameters', () => {
      const result = validatePaginationParams({});

      expect(result.page).toBe(PAGINATION_DEFAULTS.PAGE);
      expect(result.limit).toBe(PAGINATION_DEFAULTS.LIMIT);
      expect(result.sortOrder).toBe(PAGINATION_DEFAULTS.SORT_ORDER);
      expect(result.sortBy).toBe('totalTokens');
    });

    it('should accept valid parameters', () => {
      const result = validatePaginationParams({
        page: 2,
        limit: 100,
        sortBy: 'username',
        sortOrder: 'asc',
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(100);
      expect(result.sortBy).toBe('username');
      expect(result.sortOrder).toBe('asc');
    });

    it('should reject page < 1', () => {
      expect(() => {
        validatePaginationParams({ page: 0 });
      }).toThrow('Page number must be >= 1');
    });

    it('should reject limit < 1', () => {
      expect(() => {
        validatePaginationParams({ limit: 0 });
      }).toThrow('Limit must be >= 1');
    });

    it('should reject limit > MAX_LIMIT', () => {
      expect(() => {
        validatePaginationParams({ limit: 500 });
      }).toThrow(`Limit must be <= ${PAGINATION_DEFAULTS.MAX_LIMIT}`);
    });

    it('should reject invalid sort order', () => {
      expect(() => {
        validatePaginationParams({ sortOrder: 'invalid' as any });
      }).toThrow('Sort order must be "asc" or "desc"');
    });
  });

  describe('validateSortField', () => {
    const allowedFields = ['name', 'age', 'email'];

    it('should accept valid field', () => {
      expect(() => {
        validateSortField('name', allowedFields);
      }).not.toThrow();
    });

    it('should reject invalid field', () => {
      expect(() => {
        validateSortField('invalid', allowedFields);
      }).toThrow('Invalid sort field: invalid');
    });
  });

  describe('paginateArray', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    it('should paginate first page correctly', () => {
      const result = paginateArray(data, {
        page: 1,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(1);
      expect(result.data[9].id).toBe(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it('should paginate middle page correctly', () => {
      const result = paginateArray(data, {
        page: 5,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(41);
      expect(result.data[9].id).toBe(50);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should paginate last page correctly', () => {
      const result = paginateArray(data, {
        page: 10,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(91);
      expect(result.data[9].id).toBe(100);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should handle partial last page', () => {
      const shortData = Array.from({ length: 95 }, (_, i) => ({ id: i + 1 }));
      const result = paginateArray(shortData, {
        page: 10,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(5); // Only 5 items on last page
      expect(result.pagination.totalPages).toBe(10);
    });

    it('should handle empty array', () => {
      const result = paginateArray([], {
        page: 1,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'asc',
      });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
    });
  });

  describe('sortArray', () => {
    const data = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 35 },
    ];

    it('should sort by string field ascending', () => {
      const result = sortArray(data, 'name', 'asc');

      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Charlie');
    });

    it('should sort by string field descending', () => {
      const result = sortArray(data, 'name', 'desc');

      expect(result[0].name).toBe('Charlie');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Alice');
    });

    it('should sort by number field ascending', () => {
      const result = sortArray(data, 'age', 'asc');

      expect(result[0].age).toBe(25);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(35);
    });

    it('should sort by number field descending', () => {
      const result = sortArray(data, 'age', 'desc');

      expect(result[0].age).toBe(35);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(25);
    });

    it('should not mutate original array', () => {
      const original = [...data];
      sortArray(data, 'name', 'asc');

      expect(data).toEqual(original);
    });
  });

  describe('sortAndPaginate', () => {
    const data = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      score: Math.random() * 100,
    }));

    it('should sort and paginate in one call', () => {
      const result = sortAndPaginate(data, {
        page: 1,
        limit: 10,
        sortBy: 'score',
        sortOrder: 'desc',
      });

      expect(result.data).toHaveLength(10);
      expect(result.pagination.total).toBe(50);

      // Verify sorting (descending)
      for (let i = 0; i < result.data.length - 1; i++) {
        expect(result.data[i].score).toBeGreaterThanOrEqual(result.data[i + 1].score);
      }
    });
  });
});

/**
 * React DOM Client Mock
 *
 * Provides a centralized mock for react-dom/client to resolve
 * Vitest v6 compatibility issues and ensure consistent behavior
 * across all tests.
 */

import { vi } from 'vitest';

// Mock root instance
export const mockRoot = {
  render: vi.fn(),
  unmount: vi.fn(),
};

// Mock createRoot function
export const createRoot = vi.fn(() => mockRoot);

// Default export for compatibility
export default {
  createRoot,
};

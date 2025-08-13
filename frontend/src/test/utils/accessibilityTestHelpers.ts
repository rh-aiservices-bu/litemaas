/**
 * Accessibility testing utilities for chart components
 * Provides common patterns and helpers for testing WCAG 2.1 AA compliance
 */

import { axe, toHaveNoViolations } from 'jest-axe';
import { render, RenderResult } from '@testing-library/react';
import { ReactElement } from 'react';

// Extend jest matchers
expect.extend(toHaveNoViolations);

/**
 * Configuration for axe-core accessibility testing
 * Focused on chart-specific accessibility requirements
 */
export const chartAccessibilityRules = {
  rules: {
    // Chart-specific rules
    'color-contrast': { enabled: true }, // Ensure text meets contrast requirements
    'focus-order-semantics': { enabled: true }, // Logical focus order
    keyboard: { enabled: true }, // Keyboard accessibility
    'landmark-unique': { enabled: true }, // Unique landmarks

    // ARIA-specific rules for charts
    'aria-allowed-attr': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },

    // Interactive element rules
    'button-name': { enabled: true },
    'link-name': { enabled: true },
    'interactive-supports-focus': { enabled: true },

    // Table accessibility (for chart table alternatives)
    'table-fake-caption': { enabled: true },
    'th-has-data-cells': { enabled: true },
    'td-headers-attr': { enabled: true },

    // Skip rules that may conflict with chart libraries
    'svg-img-alt': { enabled: false }, // Chart SVGs often use role="img" instead
    'image-alt': { enabled: false }, // Chart images handled by aria-label/aria-describedby
  },
};

/**
 * Tests a component for accessibility violations using axe-core
 * @param component React component to test
 * @param options Additional axe configuration options
 * @returns Promise resolving to axe results
 */
export const testAccessibility = async (component: ReactElement, options?: any): Promise<void> => {
  const { container } = render(component);
  const results = await axe(container, {
    ...chartAccessibilityRules,
    ...options,
  });

  expect(results).toHaveNoViolations();
};

/**
 * Tests keyboard navigation for chart components
 * @param renderResult Rendered component
 * @param expectedFocusableElements Array of expected focusable element selectors
 */
export const testKeyboardNavigation = (
  renderResult: RenderResult,
  expectedFocusableElements: string[],
): void => {
  const { container } = renderResult;

  // Test that expected elements are focusable
  expectedFocusableElements.forEach((selector) => {
    const element = container.querySelector(selector);
    expect(element).toBeInTheDocument();

    if (element) {
      // Check if element is focusable (has tabindex >= 0 or is naturally focusable)
      const tabIndex = element.getAttribute('tabindex');
      const isFocusable =
        tabIndex !== '-1' &&
        (tabIndex !== null ||
          ['button', 'input', 'select', 'textarea', 'a'].includes(element.tagName.toLowerCase()));

      expect(isFocusable).toBe(true);
    }
  });
};

/**
 * Tests screen reader announcements by checking for live regions
 * @param container DOM container
 * @param expectedAnnouncements Array of expected announcement text
 */
export const testScreenReaderAnnouncements = (
  container: HTMLElement,
  expectedAnnouncements: string[],
): void => {
  // Check for aria-live regions
  const liveRegions = container.querySelectorAll('[aria-live]');
  expect(liveRegions.length).toBeGreaterThan(0);

  // Check for screen reader content
  const screenReaderElements = container.querySelectorAll('.pf-v6-screen-reader');
  expect(screenReaderElements.length).toBeGreaterThan(0);

  // Verify expected announcements are present
  expectedAnnouncements.forEach((announcement) => {
    const announcementElement = Array.from(screenReaderElements).find((element) =>
      element.textContent?.includes(announcement),
    );
    expect(announcementElement).toBeDefined();
  });
};

/**
 * Tests ARIA attributes for chart components
 * @param element DOM element to test
 * @param expectedAttributes Object with expected ARIA attributes and values
 */
export const testAriaAttributes = (
  element: Element | null,
  expectedAttributes: Record<string, string | boolean | null>,
): void => {
  expect(element).toBeInTheDocument();

  if (!element) return;

  Object.entries(expectedAttributes).forEach(([attribute, expectedValue]) => {
    const actualValue = element.getAttribute(attribute);

    if (expectedValue === null) {
      expect(actualValue).toBeNull();
    } else if (typeof expectedValue === 'boolean') {
      expect(actualValue).toBe(expectedValue ? 'true' : 'false');
    } else {
      expect(actualValue).toBe(expectedValue);
    }
  });
};

/**
 * Tests color contrast for chart elements
 * Note: This is a simplified test - full color contrast testing requires
 * actual pixel analysis which is complex in a testing environment
 * @param element DOM element containing color information
 * @param expectedMinContrast Minimum expected contrast ratio
 */
export const testColorContrast = (
  element: Element,
  _expectedMinContrast: number = 4.5, // WCAG AA standard
): void => {
  // For chart components, we primarily test that high-contrast colors are used
  const computedStyle = window.getComputedStyle(element);
  const color = computedStyle.color;
  const backgroundColor = computedStyle.backgroundColor;

  // Basic test: ensure colors are not the same (would result in no contrast)
  expect(color).not.toBe(backgroundColor);

  // Test that colors are not transparent or inherit (which could cause contrast issues)
  expect(color).not.toBe('transparent');
  expect(backgroundColor).not.toBe('transparent');
};

/**
 * Tests table accessibility for chart table alternatives
 * @param table Table element to test
 */
export const testTableAccessibility = (table: HTMLTableElement): void => {
  expect(table).toBeInTheDocument();
  expect(table).toHaveAttribute('role', 'table');

  // Check for table caption or aria-label
  const caption = table.querySelector('caption');
  const ariaLabel = table.getAttribute('aria-label');
  const ariaLabelledBy = table.getAttribute('aria-labelledby');

  expect(caption || ariaLabel || ariaLabelledBy).toBeTruthy();

  // Check for proper header structure
  const headers = table.querySelectorAll('th');
  expect(headers.length).toBeGreaterThan(0);

  // Check that headers have scope attribute
  headers.forEach((header) => {
    const scope = header.getAttribute('scope');
    expect(['col', 'row', 'colgroup', 'rowgroup'].includes(scope || '')).toBe(true);
  });

  // Check for proper row structure
  const rows = table.querySelectorAll('tr');
  expect(rows.length).toBeGreaterThan(1); // At least header + one data row
};

/**
 * Common accessibility test suite for chart components
 * @param component React component to test
 * @param options Test configuration options
 */
export const runChartAccessibilityTests = async (
  component: ReactElement,
  options: {
    hasToggleButtons?: boolean;
    hasExportButton?: boolean;
    hasTableView?: boolean;
    expectedFocusableElements?: string[];
    expectedAnnouncements?: string[];
  } = {},
): Promise<RenderResult> => {
  const renderResult = render(component);
  const { container } = renderResult;

  // Test basic accessibility
  await testAccessibility(component);

  // Test keyboard navigation if focusable elements expected
  if (options.expectedFocusableElements) {
    testKeyboardNavigation(renderResult, options.expectedFocusableElements);
  }

  // Test screen reader announcements if expected
  if (options.expectedAnnouncements) {
    testScreenReaderAnnouncements(container, options.expectedAnnouncements);
  }

  // Test table accessibility if table view is expected
  if (options.hasTableView) {
    const table = container.querySelector('table');
    if (table) {
      testTableAccessibility(table);
    }
  }

  return renderResult;
};

/**
 * Mock user interactions for accessibility testing
 */
export const mockUserInteractions = {
  /**
   * Simulate keyboard navigation through focusable elements
   */
  simulateTabNavigation: (container: HTMLElement): HTMLElement[] => {
    const focusableElements = Array.from(
      container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ) as HTMLElement[];

    // Simulate focus on each element
    focusableElements.forEach((element) => {
      element.focus();
    });

    return focusableElements;
  },

  /**
   * Simulate screen reader announcement checking
   */
  checkLiveRegions: (container: HTMLElement): string[] => {
    const liveRegions = container.querySelectorAll('[aria-live]');
    return Array.from(liveRegions).map((region) => region.textContent || '');
  },
};

/**
 * Accessibility test configuration presets for different chart types
 */
export const accessibilityPresets = {
  lineChart: {
    expectedFocusableElements: ['[role="img"]', 'button'],
    expectedAnnouncements: ['Chart focused', 'data points'],
    hasToggleButtons: true,
    hasExportButton: true,
    hasTableView: true,
  },

  donutChart: {
    expectedFocusableElements: ['button'],
    expectedAnnouncements: ['Distribution', 'categories'],
    hasToggleButtons: true,
    hasExportButton: true,
    hasTableView: true,
  },

  legend: {
    expectedFocusableElements: [],
    expectedAnnouncements: ['Legend contains', 'items'],
    hasToggleButtons: false,
    hasExportButton: false,
    hasTableView: false,
  },
};

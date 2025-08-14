/**
 * Accessibility Setup Utility
 *
 * This module initializes axe-core for runtime accessibility testing
 * in development mode. It provides automated a11y violation detection
 * and reporting during development.
 */

import * as React from 'react';
import type { AxeResults } from 'axe-core';

/**
 * Initialize axe-core for accessibility testing in development mode
 *
 * This function configures axe-core to run accessibility checks
 * and report violations to the browser console during development.
 * It only runs in development mode and when DOM is available.
 *
 * @param reactDOMInstance - The React DOM instance to test
 * @param React - The React instance
 * @param timeout - Debounce timeout in milliseconds (default: 1000)
 */
export const initializeAxeAccessibility = async (
  reactDOMInstance: any,
  React: any,
  timeout: number = 1000,
): Promise<void> => {
  // Only run in development mode
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Only run in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Dynamically import @axe-core/react to avoid TypeScript compilation issues
    const axeReact = await import('@axe-core/react');
    const configure = axeReact.default;

    configure(reactDOMInstance, React, timeout, {
      // Use runOnly to specify which rules to run
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
    });

    console.info('✅ Axe-core accessibility testing initialized for development');
  } catch (error) {
    console.warn('⚠️ Failed to initialize axe-core accessibility testing:', error);
  }
};

/**
 * Manual accessibility test runner for specific elements
 *
 * This function allows running accessibility tests on specific
 * DOM elements or selectors programmatically during development.
 *
 * @param selector - CSS selector or DOM element to test
 * @param options - Additional axe-core options
 * @returns Promise resolving to axe results
 */
export const runAccessibilityTest = async (
  selector?: string | Element,
  options: any = {},
): Promise<AxeResults | null> => {
  // Only run in development mode
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Accessibility tests only run in development mode');
    return null;
  }

  // Only run in browser environment
  if (typeof window === 'undefined') {
    console.warn('Accessibility tests require browser environment');
    return null;
  }

  try {
    // Import axe-core dynamically to avoid TypeScript compilation issues
    const axe = (await import('axe-core')) as any;

    const defaultOptions = {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
      resultTypes: ['violations', 'incomplete'] as ['violations', 'incomplete'],
      ...options,
    };

    const results = (await axe.run(selector || document, defaultOptions)) as AxeResults;

    if (results.violations.length > 0) {
      console.group('🚫 Accessibility Violations Found');
      results.violations.forEach((violation) => {
        console.error(`${violation.impact} - ${violation.help}`);
        console.error('Description:', violation.description);
        console.error('Nodes:', violation.nodes);
        console.error('Help URL:', violation.helpUrl);
      });
      console.groupEnd();
    }

    if (results.incomplete.length > 0) {
      console.group('⚠️ Accessibility Checks Incomplete');
      results.incomplete.forEach((item) => {
        console.warn(`${item.impact} - ${item.help}`);
        console.warn('Description:', item.description);
        console.warn('Nodes:', item.nodes);
      });
      console.groupEnd();
    }

    if (results.violations.length === 0 && results.incomplete.length === 0) {
      console.info('✅ No accessibility violations found');
    }

    return results;
  } catch (error) {
    console.error('❌ Failed to run accessibility test:', error);
    return null;
  }
};

/**
 * Hook for component-level accessibility testing
 *
 * This utility can be used in React components to run
 * accessibility tests on mount or when dependencies change.
 *
 * @param elementRef - React ref to the element to test
 * @param dependencies - Dependencies array for re-running tests
 */
export const useAccessibilityTest = (
  elementRef: React.RefObject<Element>,
  dependencies: any[] = [],
): void => {
  // Only import React hooks in development
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  try {
    const { useEffect } = require('react');

    useEffect(() => {
      if (elementRef.current) {
        // Delay test to ensure component is fully rendered
        const timeoutId = setTimeout(() => {
          runAccessibilityTest(elementRef.current!);
        }, 100);

        return () => clearTimeout(timeoutId);
      }
      // Explicitly return undefined when elementRef.current is null
      return undefined;
    }, dependencies);
  } catch (error) {
    console.warn('⚠️ useAccessibilityTest hook failed:', error);
  }
};

/**
 * Development-only accessibility debugging utilities
 */
export const a11yDebug = {
  /**
   * Highlight all elements with accessibility issues
   */
  highlightViolations: async (): Promise<void> => {
    if (process.env.NODE_ENV !== 'development') return;

    try {
      const results = await runAccessibilityTest();
      if (!results) return;

      // Remove existing highlights
      document.querySelectorAll('[data-a11y-violation]').forEach((el) => {
        el.removeAttribute('data-a11y-violation');
        (el as HTMLElement).style.outline = '';
      });

      // Add highlights for violations
      results.violations.forEach((violation) => {
        violation.nodes.forEach((node) => {
          const elements = document.querySelectorAll(node.target.join(','));
          elements.forEach((el: Element) => {
            el.setAttribute('data-a11y-violation', violation.impact);
            (el as HTMLElement).style.outline = `3px solid ${
              violation.impact === 'critical'
                ? '#d73502'
                : violation.impact === 'serious'
                  ? '#ff6900'
                  : violation.impact === 'moderate'
                    ? '#ffab00'
                    : '#ffeb3b'
            }`;
          });
        });
      });

      console.info('🎯 Accessibility violations highlighted with colored outlines');
    } catch (error) {
      console.error('❌ Failed to highlight violations:', error);
    }
  },

  /**
   * Remove violation highlights
   */
  clearHighlights: (): void => {
    document.querySelectorAll('[data-a11y-violation]').forEach((el) => {
      el.removeAttribute('data-a11y-violation');
      (el as HTMLElement).style.outline = '';
    });
    console.info('🧹 Accessibility violation highlights cleared');
  },

  /**
   * Print accessibility summary
   */
  printSummary: async (): Promise<void> => {
    const results = await runAccessibilityTest();
    if (!results) return;

    console.group('📊 Accessibility Summary');
    console.info(`✅ Passed: ${results.passes.length} checks`);
    console.info(`🚫 Violations: ${results.violations.length}`);
    console.info(`⚠️ Incomplete: ${results.incomplete.length}`);
    console.info(`ℹ️ Inapplicable: ${results.inapplicable.length}`);
    console.groupEnd();
  },
};

// Make debug utilities available globally in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).a11yDebug = a11yDebug;
  console.info('🔧 Accessibility debugging utilities available at window.a11yDebug');
}
